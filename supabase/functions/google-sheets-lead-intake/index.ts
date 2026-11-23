// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  DEFAULT_COMPANY_ID,
  normalizeSheetRow,
  doesLeadMatchContact,
  buildSheetRowKey,
  buildNewLeadNotes,
  buildReentryNote,
  appendNotePreservingExisting,
  extractSyncKeys,
  formatSheetStatusCell,
  buildAiMemoryFacts,
} from './helpers.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sheets-sync-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const MAX_BATCH_ROWS = 50;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  const len = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < len; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const configuredSecret = Deno.env.get('SHEETS_SYNC_SECRET') || '';
  if (!configuredSecret) {
    console.error('[google-sheets-lead-intake] SHEETS_SYNC_SECRET is not configured');
    return jsonResponse({ ok: false, error: 'Server secret not configured' }, 500);
  }

  const providedSecret = req.headers.get('x-sheets-sync-secret') || '';
  if (!timingSafeEqual(providedSecret, configuredSecret)) {
    return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
  }

  if (req.method === 'GET') {
    return jsonResponse({
      ok: true,
      service: 'google-sheets-lead-intake',
      defaultCompanyId: DEFAULT_COMPANY_ID,
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method Not Allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('CRM_SUPABASE_URL') || Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey =
      Deno.env.get('CRM_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ ok: false, error: 'Supabase credentials missing' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const spreadsheetId = String(body?.spreadsheetId || '').trim();
    const sheetName = String(body?.sheetName || 'Google Sheets').trim() || 'Google Sheets';
    const companyId = String(body?.companyId || DEFAULT_COMPANY_ID).trim() || DEFAULT_COMPANY_ID;
    const dryRun = Boolean(body?.dryRun);

    const rawItems: Array<{ rowNumber: number; row: Record<string, unknown> }> = Array.isArray(body?.rows)
      ? body.rows
      : body?.row
      ? [{ rowNumber: Number(body.rowNumber || 0), row: body.row }]
      : [];

    if (rawItems.length === 0) {
      return jsonResponse({ ok: true, results: [], processed: 0 });
    }

    const items = rawItems.slice(0, MAX_BATCH_ROWS);
    const advisorNameCache = new Map<string, string>();

    const upsertLeadAiMemory = async (params: {
      leadId: string;
      lead: ReturnType<typeof normalizeSheetRow>;
      syncedAt: string;
      rowNumber: number;
    }) => {
      try {
        const { data: prevMem } = await supabase
          .from('lead_ai_memory')
          .select('known_facts, conversation_stage, next_action')
          .eq('lead_id', params.leadId)
          .maybeSingle();

        const prevFacts =
          prevMem?.known_facts && typeof prevMem.known_facts === 'object'
            ? prevMem.known_facts
            : {};

        const incomingFacts = buildAiMemoryFacts(params.lead, {
          sheetName,
          rowNumber: params.rowNumber,
          syncedAt: params.syncedAt,
        });

        await supabase
          .from('lead_ai_memory')
          .upsert(
            {
              lead_id: params.leadId,
              company_id: companyId,
              known_facts: { ...prevFacts, ...incomingFacts },
              conversation_stage: prevMem?.conversation_stage || 'nuevo',
              next_action: prevMem?.next_action || 'calificar',
              updated_at: params.syncedAt,
            },
            { onConflict: 'lead_id' },
          );
      } catch (memErr: any) {
        console.warn('[google-sheets-lead-intake] lead_ai_memory non-blocking warning:', memErr?.message || memErr);
      }
    };

    const resolveAdvisorName = async (assignedTo: string | null): Promise<string> => {
      if (!assignedTo) return 'Sin asignar';
      if (advisorNameCache.has(assignedTo)) return advisorNameCache.get(assignedTo)!;
      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', assignedTo)
        .maybeSingle();
      const label = prof?.full_name || prof?.email || 'Asesor asignado';
      advisorNameCache.set(assignedTo, label);
      return label;
    };

    const findMatchingLead = async (phoneMatchKey: string, email: string | null) => {
      const candidates: any[] = [];

      if (phoneMatchKey) {
        const { data: phoneHits, error: phoneErr } = await supabase
          .from('leads')
          .select('id, name, phone, email, assigned_to, status, next_action_notes, raw_meta_payload, updated_at')
          .eq('company_id', companyId)
          .ilike('phone', `%${phoneMatchKey}`)
          .limit(10);
        if (phoneErr) throw phoneErr;
        if (phoneHits) candidates.push(...phoneHits);
      }

      if (candidates.length === 0 && email) {
        const { data: emailHits, error: emailErr } = await supabase
          .from('leads')
          .select('id, name, phone, email, assigned_to, status, next_action_notes, raw_meta_payload, updated_at')
          .eq('company_id', companyId)
          .ilike('email', email)
          .limit(10);
        if (emailErr) throw emailErr;
        if (emailHits) candidates.push(...emailHits);
      }

      const verified = candidates
        .map((c) => ({
          lead: c,
          matchedBy: doesLeadMatchContact(c, { phoneMatchKey, email }),
        }))
        .filter((x): x is { lead: any; matchedBy: 'phone' | 'email' } => x.matchedBy !== null);

      if (verified.length === 0) return null;

      verified.sort((a, b) => {
        const aPhoneScore = a.matchedBy === 'phone' ? 1 : 0;
        const bPhoneScore = b.matchedBy === 'phone' ? 1 : 0;
        if (aPhoneScore !== bPhoneScore) return bPhoneScore - aPhoneScore;
        const aAssigned = a.lead.assigned_to ? 1 : 0;
        const bAssigned = b.lead.assigned_to ? 1 : 0;
        if (aAssigned !== bAssigned) return bAssigned - aAssigned;
        return String(b.lead.updated_at || '').localeCompare(String(a.lead.updated_at || ''));
      });

      return verified[0];
    };

    const results: Array<Record<string, unknown>> = [];

    for (const item of items) {
      const rowNumber = Number(item?.rowNumber || 0);
      const lead = normalizeSheetRow((item?.row || {}) as Record<string, unknown>);

      if (!lead.phoneMatchKey && !lead.email) {
        results.push({
          rowNumber,
          action: 'invalid',
          statusText: formatSheetStatusCell({
            action: 'invalid',
            reason: 'sin teléfono ni correo',
          }),
        });
        continue;
      }

      const now = new Date();
      const rowKey = buildSheetRowKey({
        spreadsheetId,
        sheetName,
        rowNumber,
        phoneMatchKey: lead.phoneMatchKey,
        email: lead.email,
        submittedAt: lead.submittedAt,
      });

      const match = await findMatchingLead(lead.phoneMatchKey, lead.email);

      if (match) {
        const existing = match.lead;
        const advisorName = await resolveAdvisorName(existing.assigned_to || null);
        const existingSyncKeys = extractSyncKeys(existing.raw_meta_payload);

        if (existingSyncKeys.includes(rowKey)) {
          results.push({
            rowNumber,
            action: 'already_synced',
            leadId: existing.id,
            matchedBy: match.matchedBy,
            advisorName,
            statusText: formatSheetStatusCell({
              action: 'already_synced',
              advisorName,
              now,
            }),
          });
          continue;
        }

        if (dryRun) {
          results.push({
            rowNumber,
            action: 'dry_run_existing',
            leadId: existing.id,
            matchedBy: match.matchedBy,
            advisorName,
            statusText: formatSheetStatusCell({
              action: 'dry_run_existing',
              advisorName,
              now,
            }),
          });
          continue;
        }

        const reentryNote = buildReentryNote(lead, { sheetName, rowNumber, now });
        const nextActionNotes = appendNotePreservingExisting(existing.next_action_notes, reentryNote);
        const prevMeta =
          existing.raw_meta_payload && typeof existing.raw_meta_payload === 'object'
            ? existing.raw_meta_payload
            : {};
        const prevReentries = Array.isArray(prevMeta.reentries) ? prevMeta.reentries : [];
        const nextMeta = {
          ...prevMeta,
          sheet_sync_keys: [...existingSyncKeys, rowKey].slice(-50),
          last_sheet_reentry_at: now.toISOString(),
          reentries: [
            ...prevReentries.slice(-19),
            {
              at: now.toISOString(),
              sheet_name: sheetName,
              row_number: rowNumber,
              ad_name: lead.adName,
              product: lead.productLabel,
              urgency: lead.urgency,
              improvement_area: lead.improvementArea,
              comments: lead.comments,
              fields: lead.rawFields,
            },
          ],
        };

        const { error: updErr } = await supabase
          .from('leads')
          .update({
            next_action_notes: nextActionNotes,
            raw_meta_payload: nextMeta,
            updated_at: now.toISOString(),
          })
          .eq('id', existing.id);

        if (updErr) throw updErr;

        await upsertLeadAiMemory({
          leadId: existing.id,
          lead,
          syncedAt: now.toISOString(),
          rowNumber,
        });

        results.push({
          rowNumber,
          action: 'existing_noted',
          leadId: existing.id,
          matchedBy: match.matchedBy,
          advisorName,
          statusText: formatSheetStatusCell({
            action: 'existing_noted',
            advisorName,
            now,
          }),
        });
        continue;
      }

      if (dryRun) {
        results.push({
          rowNumber,
          action: 'dry_run_create',
          product: lead.productLabel,
          priority: lead.priority,
          industry: lead.mappedIndustry,
          statusText: formatSheetStatusCell({ action: 'dry_run_create', now }),
        });
        continue;
      }

      const insertRow = {
        company_id: companyId,
        assigned_to: null,
        name: lead.name || lead.companyName || lead.phoneDisplay || 'Prospecto Formulario',
        company_name: lead.companyName,
        email: lead.email,
        phone: lead.phoneDisplay,
        source: 'facebook_ads',
        status: 'Prospecto',
        priority: lead.priority,
        value: 0,
        closing_amount: 0,
        contact_count: 0,
        engagement_score: 0,
        es_cliente: false,
        industry: lead.mappedIndustry,
        interested_product_id: lead.productId,
        meta_campaign_name: lead.adName,
        next_action_notes: buildNewLeadNotes(lead, { sheetName, rowNumber }),
        raw_meta_payload: {
          source: 'google_sheets',
          spreadsheet_id: spreadsheetId || null,
          sheet_name: sheetName,
          row_number: rowNumber,
          sheet_sync_keys: [rowKey],
          fields: lead.rawFields,
          synced_at: now.toISOString(),
        },
        created_at: now.toISOString(),
      };

      const { data: inserted, error: insErr } = await supabase
        .from('leads')
        .insert(insertRow)
        .select('id')
        .single();

      if (insErr) throw insErr;

      if (inserted?.id) {
        await upsertLeadAiMemory({
          leadId: inserted.id,
          lead,
          syncedAt: now.toISOString(),
          rowNumber,
        });

        // Dispara el motor Calificador IA / Auto-Enrutamiento sin bloquear la respuesta a Google Sheets
        try {
          const engineUrl = `${supabaseUrl}/functions/v1/lead-qualifier-engine`;
          await Promise.race([
            fetch(engineUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-sheets-sync-secret': configuredSecret,
              },
              body: JSON.stringify({
                action: 'enroll_new_lead',
                company_id: companyId,
                lead_id: inserted.id,
                source: 'google_sheets',
              }),
            }),
            new Promise((resolve) => setTimeout(resolve, 2500)),
          ]);
        } catch (qualErr: any) {
          console.warn('[google-sheets-lead-intake] qualifier trigger warn:', qualErr?.message || qualErr);
        }
      }

      results.push({
        rowNumber,
        action: 'created',
        leadId: inserted?.id || null,
        product: lead.productLabel,
        priority: lead.priority,
        industry: lead.mappedIndustry,
        statusText: formatSheetStatusCell({ action: 'created', now }),
      });
    }

    return jsonResponse({
      ok: true,
      processed: results.length,
      results,
    });
  } catch (err: any) {
    console.error('[google-sheets-lead-intake] Error:', err?.message || err);
    return jsonResponse({ ok: false, error: err?.message || 'Internal Error' }, 500);
  }
});
