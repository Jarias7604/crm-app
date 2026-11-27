// =============================================================================
// evolution-whatsapp-webhook — WhatsApp Soporte (+503 7971-8911) via Evolution API
//
// Inbound:  Evolution -> POST (messages.upsert / send.message)
// Outbound: CRM -> outbox in ticket metadata -> Evolution bridge polls
//           GET ?action=bridge_sh and runs the returned shell lines against
//           its localhost:8085 Evolution API (port 8085 is not public).
//
// Conversation model: each WhatsApp chat (group or 1-on-1) is stored as tickets
// (metadata.source = 'whatsapp_evolution') + ticket_comments (one per message).
// metadata.wa_scope decides who can see it (enforced by RLS):
//   soporte | por_clasificar | lead | interno | spam
// Classification is decided ONLY here (single source of truth).
// =============================================================================
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { decode as decodeBase64 } from 'https://deno.land/std@0.168.0/encoding/base64.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  corsHeaders,
  SUPPORT_PHONE,
  MEDIA_BUCKET,
  MEDIA_MAX_ATTEMPTS,
  MEDIA_RETRY_AFTER_MS,
  GROUP_SYNC_EVERY_MS,
  STAFF_GROUP_MIN,
  STAFF_GROUP_SHARE,
  TZ,
  type WaScope,
  type SupportChannelType,
  SCOPE_TITLE_TAG,
  MEDIA_KINDS,
  json,
  digits,
  last8,
  jidPhone,
  jidLid,
  shellSafe,
  b64Utf8,
  fmtTime,
  normName,
  messageDate,
} from './types.ts';
import {
  staffGroupThreshold,
  getBridgeState,
  setBridgeState,
  evolutionCredentials,
  normalizeInstance,
  enqueueOutbox,
} from './bridgeState.ts';
import {
  normalizeGreetingText,
  isGreetingOrClosingAgreement,
  isNonTechnicalAdministrativeChat,
  stripLeadingGreetingForTicketTitle,
  classifyIssueCategory,
  isGenericProblemTitle,
} from './classification.ts';
import {
  DEFAULT_AI_PROMPTS,
  DEFAULT_RESOLVED_REPLY_TEMPLATE,
  DEFAULT_RESOLVED_TRIGGER_PHRASES,
  isAlreadyResolvedReply,
  renderResolvedReplyTemplate,
  loadSupportAiConfig,
  aiBotLabel,
  askOpenAiTechnicalClassifier,
  askOpenAi,
  transcribeAudio,
  shouldTriggerLeadQualifier,
  buildQualifierInvokeHeaders,
} from './aiHelpers.ts';
import {
  unwrapMessage,
  extractMedia,
  mediaPlaceholder,
  slimMediaObject,
  extractText,
  guessExt,
  mediaTypeForSend,
  cleanMeta,
  extractChatReadUpdates,
} from './messageParsing.ts';
import {
  handleBridgeSh,
  handleBridgeAck,
  handleBridgeStatus,
} from './bridge.ts';

export type { SupportChannelType };
export {
  DEFAULT_AI_PROMPTS,
  DEFAULT_RESOLVED_REPLY_TEMPLATE,
  DEFAULT_RESOLVED_TRIGGER_PHRASES,
  isAlreadyResolvedReply,
  renderResolvedReplyTemplate,
};

// ─── Company + team helpers ──────────────────────────────────────────────────

async function resolveMainCompanyId(supabase: any, companyIdParam: string | null): Promise<string | null> {
  if (companyIdParam) return companyIdParam;
  const envCompany = Deno.env.get('WA_SUPPORT_COMPANY_ID');
  if (envCompany) return envCompany;
  const { data: waTicket } = await supabase
    .from('tickets')
    .select('company_id')
    .eq('metadata->>source', 'whatsapp_evolution')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (waTicket?.company_id) return waTicket.company_id;
  const { data: anyTicket } = await supabase
    .from('tickets')
    .select('company_id')
    .not('company_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return anyTicket?.company_id || null;
}

interface TeamInfo {
  profiles: { id: string; full_name: string; phone: string | null }[];
  internoPhones: Map<string, { profileId: string | null; name: string | null }>; // last8 -> info
}

async function loadTeam(supabase: any, companyId: string): Promise<TeamInfo> {
  const [{ data: profs }, { data: internos }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, phone').eq('company_id', companyId),
    supabase
      .from('whatsapp_contacts')
      .select('phone, profile_id, display_name, push_name')
      .eq('company_id', companyId)
      .eq('contact_type', 'interno'),
  ]);
  const internoPhones = new Map<string, { profileId: string | null; name: string | null }>();
  for (const p of profs || []) {
    const l8 = last8(p.phone);
    if (l8) internoPhones.set(l8, { profileId: p.id, name: p.full_name });
  }
  for (const c of internos || []) {
    const l8 = last8(c.phone);
    if (l8) internoPhones.set(l8, { profileId: c.profile_id, name: c.display_name || c.push_name });
  }
  return { profiles: profs || [], internoPhones };
}

// Strong staff identification (safe to trust for auto-assign / auto-resolve).
function matchStaffByName(team: TeamInfo, pushName: string): { id: string; full_name: string } | null {
  const n = normName(pushName);
  if (!n || n === 'cliente whatsapp' || n.length < 4) return null;
  for (const p of team.profiles) {
    const full = normName(p.full_name || '');
    if (!full) continue;
    if (full === n) return p;
    if ((n.includes('gerson') && full.includes('gerson')) || (n.includes('melvin') && full.includes('melvin'))) {
      return p;
    }
  }
  return null;
}

// ─── Groups ──────────────────────────────────────────────────────────────────

interface Participant {
  phone: string | null;
  lid: string | null;
  admin?: string | null;
  name?: string | null;
}

function normalizeParticipants(list: any[]): Participant[] {
  const out: Participant[] = [];
  for (const p of Array.isArray(list) ? list : []) {
    const vals = [p?.id, p?.jid, p?.phoneNumber, p?.lid, p?.pn].filter((x) => typeof x === 'string') as string[];
    const pn = vals.find((v) => /@(s\.whatsapp\.net|c\.us)$/.test(v));
    const lid = vals.find((v) => /@lid$/.test(v));
    const item: Participant = {
      phone: pn ? digits(pn.split('@')[0]) : null,
      lid: lid ? digits(lid.split('@')[0]) : null,
      admin: p?.admin ?? null,
      name: p?.name || p?.notify || null,
    };
    if (item.phone || item.lid) out.push(item);
  }
  return out;
}

async function upsertGroup(
  supabase: any,
  companyId: string,
  groupJid: string,
  fields: { subject?: string | null; participants?: Participant[] }
) {
  const row: Record<string, any> = {
    company_id: companyId,
    group_jid: groupJid,
    updated_at: new Date().toISOString(),
  };
  if (fields.subject) row.subject = fields.subject;
  if (fields.participants) {
    row.participants = fields.participants;
    row.participants_synced_at = new Date().toISOString();
  }
  await supabase.from('whatsapp_groups').upsert(row, { onConflict: 'company_id,group_jid' });
}

// Learn a participant from a live group message (cheap incremental sync).
async function rememberParticipant(supabase: any, companyId: string, groupJid: string, part: Participant) {
  if (!part.phone && !part.lid) return;
  const { data: g } = await supabase
    .from('whatsapp_groups')
    .select('id, participants')
    .eq('company_id', companyId)
    .eq('group_jid', groupJid)
    .maybeSingle();
  const list: Participant[] = Array.isArray(g?.participants) ? g.participants : [];
  const idx = list.findIndex(
    (x) => (part.phone && x.phone === part.phone) || (part.lid && x.lid === part.lid)
  );
  if (idx >= 0) {
    const cur = list[idx];
    if ((part.phone && !cur.phone) || (part.lid && !cur.lid) || (part.name && !cur.name)) {
      list[idx] = { ...cur, phone: cur.phone || part.phone, lid: cur.lid || part.lid, name: cur.name || part.name };
    } else {
      return;
    }
  } else {
    list.push(part);
  }
  if (g?.id) {
    await supabase.from('whatsapp_groups').update({ participants: list, updated_at: new Date().toISOString() }).eq('id', g.id);
  } else {
    await supabase.from('whatsapp_groups').insert({ company_id: companyId, group_jid: groupJid, participants: list });
  }
}

async function groupsContaining(
  supabase: any,
  companyId: string,
  phone: string,
  lid: string
): Promise<{ group_jid: string; subject: string | null; client_id: string | null }[]> {
  const found = new Map<string, { group_jid: string; subject: string | null; client_id: string | null }>();
  const queries: Promise<any>[] = [];
  // jsonb containment needs a JSON string (an array would be sent as a Postgres array literal).
  if (phone) {
    queries.push(
      supabase
        .from('whatsapp_groups')
        .select('group_jid, subject, client_id')
        .eq('company_id', companyId)
        .contains('participants', JSON.stringify([{ phone }]))
    );
  }
  if (lid) {
    queries.push(
      supabase
        .from('whatsapp_groups')
        .select('group_jid, subject, client_id')
        .eq('company_id', companyId)
        .contains('participants', JSON.stringify([{ lid }]))
    );
  }
  for (const r of await Promise.all(queries)) {
    for (const g of r?.data || []) found.set(g.group_jid, g);
  }
  return [...found.values()];
}

// ─── Contact scope resolution (THE single source of truth) ───────────────────

interface ScopeInfo {
  scope: WaScope;
  reason: string;
  leadId: string | null;
  leadName: string | null;
  leadStatus: string | null;
  leadOwner: string | null;
  clientId: string | null;
  clientName: string | null;
  profileId: string | null;
  memberOfGroups: { jid: string; subject: string | null }[];
}

async function resolveScope(
  supabase: any,
  companyId: string,
  team: TeamInfo,
  phone: string,
  lid: string
): Promise<ScopeInfo> {
  const base: ScopeInfo = {
    scope: 'por_clasificar',
    reason: 'desconocido',
    leadId: null,
    leadName: null,
    leadStatus: null,
    leadOwner: null,
    clientId: null,
    clientName: null,
    profileId: null,
    memberOfGroups: [],
  };
  const l8 = last8(phone);

  const groups = await groupsContaining(supabase, companyId, phone, lid);
  base.memberOfGroups = groups.map((g) => ({ jid: g.group_jid, subject: g.subject }));

  // 1. Manual classification wins.
  let manual: any = null;
  if (l8) {
    const { data } = await supabase
      .from('whatsapp_contacts')
      .select('*')
      .eq('company_id', companyId)
      .like('phone', `%${l8}`)
      .limit(1);
    manual = data?.[0] || null;
  }
  if (!manual && lid) {
    const { data } = await supabase
      .from('whatsapp_contacts')
      .select('*')
      .eq('company_id', companyId)
      .eq('lid', lid)
      .limit(1);
    manual = data?.[0] || null;
  }

  // Lead lookup (used by manual 'lead' rows and by automatic detection).
  // Phones are stored with any formatting ("+503 6836-1482"), so we pre-filter by the
  // last 4 digits (always contiguous) and then compare the exact last 8 digits.
  const loadLead = async (leadId: string | null) => {
    let q = supabase
      .from('leads')
      .select('id, name, status, es_cliente, assigned_to, phone')
      .eq('company_id', companyId);
    if (leadId) q = q.eq('id', leadId);
    else if (l8) q = q.like('phone', `%${l8.slice(-4)}%`).order('created_at', { ascending: false }).limit(1000);
    else return null;
    const { data } = await q;
    const rows = (data || []) as any[];
    return leadId ? rows[0] || null : rows.find((r) => last8(r.phone) === l8) || null;
  };

  const loadClient = async () => {
    if (!l8) return null;
    const { data: cls } = await supabase
      .from('clients')
      .select('id, nombre, telefono')
      .eq('company_id', companyId)
      .like('telefono', `%${l8.slice(-4)}%`)
      .limit(1000);
    return (cls || []).find((c: any) => last8(c.telefono) === l8) || null;
  };
  const groupClientId = groups.find((g) => g.client_id)?.client_id || null;

  const applyLead = (lead: any, info: ScopeInfo, reasonPrefix: string): ScopeInfo => {
    info.leadId = lead.id;
    info.leadName = lead.name;
    info.leadStatus = lead.status;
    info.leadOwner = lead.assigned_to;
    if (lead.es_cliente || ['Cerrado', 'Cliente'].includes(lead.status)) {
      info.scope = 'soporte';
      info.reason = `${reasonPrefix}_cliente`;
    } else if (lead.status === 'Erróneo') {
      info.scope = 'spam';
      info.reason = `${reasonPrefix}_erroneo`;
    } else if (!lead.assigned_to) {
      // A lead nobody owns: put it where salespeople can take it.
      info.scope = 'por_clasificar';
      info.reason = `${reasonPrefix}_sin_vendedor`;
    } else {
      info.scope = 'lead';
      info.reason = reasonPrefix;
    }
    return info;
  };

  if (manual) {
    base.clientId = manual.client_id || null;
    base.profileId = manual.profile_id || null;
    if (manual.contact_type === 'lead') {
      // Business rule: anyone who belongs to a client support group is a client, never a lead.
      if (groups.length > 0) {
        return { ...base, scope: 'soporte', reason: 'miembro_grupo', clientId: base.clientId || groupClientId };
      }
      const lead = await loadLead(manual.lead_id || null);
      if (lead) return applyLead(lead, base, 'manual_lead');
      return { ...base, scope: 'lead', reason: 'manual_lead' };
    }
    const map: Record<string, WaScope> = { cliente: 'soporte', interno: 'interno', spam: 'spam' };
    return { ...base, scope: map[manual.contact_type] || 'por_clasificar', reason: `manual_${manual.contact_type}` };
  }

  // 2. Our own team (phone registered on a user profile).
  if (l8 && team.internoPhones.has(l8)) {
    return { ...base, scope: 'interno', reason: 'equipo', profileId: team.internoPhones.get(l8)!.profileId };
  }

  // 3. Phone registered in Clientes (checked before the "many groups" staff heuristic so an
  //    accountant who serves several clients is never mistaken for our own staff).
  const client = await loadClient();
  if (client) {
    return {
      ...base,
      scope: 'soporte',
      reason: groups.length > 0 ? 'cliente_crm_y_grupo' : 'cliente_crm',
      clientId: client.id,
      clientName: client.nombre,
    };
  }

  // 4. Present in a large share of all client groups => our own staff.
  if (groups.length >= STAFF_GROUP_MIN && groups.length >= (await staffGroupThreshold(supabase, companyId))) {
    return { ...base, scope: 'interno', reason: 'equipo_en_grupos' };
  }

  // 5. Member of a client support group => client (never a lead).
  if (groups.length > 0) {
    return { ...base, scope: 'soporte', reason: 'miembro_grupo', clientId: groupClientId };
  }

  // 6. Lead in the CRM.
  const lead = await loadLead(null);
  if (lead) return applyLead(lead, base, 'lead_crm');

  // 7. Unknown number => "Leads nuevos (por tomar)".
  return base;
}

// Re-run the classification on existing 1-on-1 chats (after a group sync, or periodically)
// so a chat never stays in the wrong tab because it was classified with older data
// (e.g. before the group participants were loaded, or before a lead status changed).
async function rescopeChats(supabase: any, companyId: string): Promise<{ checked: number; changed: any[] }> {
  const { data: rows } = await supabase
    .from('tickets')
    .select('id, title, description, lead_id, status, assigned_to, updated_at, metadata')
    .eq('company_id', companyId)
    .eq('metadata->>source', 'whatsapp_evolution')
    .order('updated_at', { ascending: false })
    .limit(1500);
  const team = await loadTeam(supabase, companyId);
  const latestByJid = new Map<string, any[]>();
  for (const t of rows || []) {
    const m = t.metadata || {};
    if (m.merged_into || m.is_group === true || String(m.whatsapp_jid || '').endsWith('@g.us')) continue;
    const jid = String(m.whatsapp_jid || '');
    if (!jid) continue;
    if (!latestByJid.has(jid)) latestByJid.set(jid, []);
    latestByJid.get(jid)!.push(t);
  }
  const changed: any[] = [];
  for (const [jid, list] of latestByJid.entries()) {
    const m0 = list[0].metadata || {};
    const phone = digits(m0.whatsapp_phone || jidPhone(jid));
    const lid = String(m0.whatsapp_lid || jidLid(jid) || '');
    if (!phone && !lid) continue;
    const info = await resolveScope(supabase, companyId, team, phone, lid);
    for (const t of list) {
      const m = t.metadata || {};
      const isCommercialLead =
        m.wa_reactivation === true ||
        /^\[WhatsApp\s*·\s*(?:Nuevo\s+)?Lead\]/i.test(String(t.title || '')) ||
        /^Reactivaci[oó]n comercial por WhatsApp/i.test(String(t.description || ''));
      if (isCommercialLead && (info.scope === 'soporte' || m.wa_scope === 'soporte' || !m.wa_scope)) {
        const safeScope: WaScope = ['lead', 'por_clasificar', 'spam'].includes(String(m.wa_scope || ''))
          ? (m.wa_scope as WaScope)
          : t.assigned_to || info.leadOwner
          ? 'lead'
          : 'por_clasificar';
        if (m.wa_scope !== safeScope || m.is_technical_ticket !== false || m.wa_scope_locked !== true) {
          const patch: Record<string, any> = {
            metadata: {
              ...cleanMeta(m),
              wa_scope: safeScope,
              wa_scope_locked: true,
              wa_scope_reason: 'reactivation_or_lead_locked',
              is_existing_client: false,
              is_technical_ticket: false,
              support_channel: 'ventas',
            },
          };
          if (!t.lead_id && info.leadId) patch.lead_id = info.leadId;
          await supabase.from('tickets').update(patch).eq('id', t.id);
          if (t === list[0]) changed.push({ jid, from: m.wa_scope || null, to: safeScope, reason: 'reactivation_or_lead_locked' });
        }
        continue;
      }
      if (m.wa_scope_locked === true) continue;
      const sameScope = m.wa_scope === info.scope && m.wa_scope_reason === info.reason;
      const needsLead = !t.lead_id && info.leadId && ['lead', 'spam', 'por_clasificar'].includes(info.scope);
      if (sameScope && !needsLead) continue;
      const patch: Record<string, any> = {
        metadata: {
          ...cleanMeta(m),
          wa_scope: info.scope,
          wa_scope_reason: info.reason,
          is_existing_client: info.scope === 'soporte',
          ...(info.scope !== 'soporte'
            ? { is_technical_ticket: false }
            : m.is_technical_ticket !== undefined
            ? { is_technical_ticket: m.is_technical_ticket }
            : {}),
          member_of_groups: info.memberOfGroups,
          support_channel: info.scope === 'soporte' ? (m.support_channel && m.support_channel !== 'ventas' ? m.support_channel : 'soporte') : 'ventas',
          ...(info.clientId ? { client_id: info.clientId } : {}),
        },
      };
      if (needsLead) patch.lead_id = info.leadId;
      await supabase.from('tickets').update(patch).eq('id', t.id);
      if (t === list[0]) changed.push({ jid, from: m.wa_scope || null, to: info.scope, reason: info.reason });
    }
  }
  return { checked: latestByJid.size, changed };
}

// ─── Auth for actions invoked from the CRM UI ────────────────────────────────

interface Caller {
  userId: string;
  fullName: string;
  companyId: string | null;
  scopes: string[];
  isAdmin: boolean;
  userClient: any; // RLS-scoped client for "can this user see X" checks
}

let lastCallerAuthError = '';

async function getCaller(req: Request, supabase: any, supabaseUrl: string): Promise<Caller | null> {
  lastCallerAuthError = '';
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    lastCallerAuthError = 'missing_bearer_token';
    return null;
  }

  let uid = '';
  const { data: userData, error: getUserErr } = await supabase.auth.getUser(token);
  if (userData?.user?.id) {
    uid = userData.user.id;
  } else {
    // Fallback: direct Auth REST /user lookup with request apikey or platform anon key
    try {
      const apiKeyHeader =
        Deno.env.get('SUPABASE_ANON_KEY') ||
        req.headers.get('apikey') ||
        Deno.env.get('CRM_SERVICE_ROLE_KEY') ||
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
        '';
      const uRes = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(apiKeyHeader ? { apikey: apiKeyHeader } : {}),
        },
      });
      if (uRes.ok) {
        const uJson = await uRes.json();
        if (uJson?.id) uid = String(uJson.id);
      } else {
        const errBody = await uRes.text().catch(() => '');
        lastCallerAuthError = `auth_user_${uRes.status}: ${errBody.slice(0, 120)}`;
      }
    } catch (fetchErr: any) {
      lastCallerAuthError = `auth_fetch_err: ${String(fetchErr?.message || fetchErr)}`;
    }
  }

  if (!uid) {
    if (!lastCallerAuthError) {
      lastCallerAuthError = `getUser_err: ${getUserErr?.message || 'no_user'}`;
    }
    console.warn('[evolution-whatsapp-webhook] getCaller rejected:', lastCallerAuthError);
    return null;
  }

  let { data: prof, error: profErr } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, custom_role_id, company_id, is_active, is_platform_owner, permissions')
    .eq('id', uid)
    .maybeSingle();

  if (profErr) {
    console.warn('[evolution-whatsapp-webhook] profile full select fallback:', profErr.message);
    const basic = await supabase
      .from('profiles')
      .select('id, full_name, email, role, company_id, is_active, is_platform_owner')
      .eq('id', uid)
      .maybeSingle();
    prof = basic.data;
  }

  if (!prof || prof.is_active === false) {
    lastCallerAuthError = !prof ? `profile_not_found:${uid}` : `profile_inactive:${uid}`;
    return null;
  }
  const role = String(prof.role || '');
  const p = (prof.permissions && typeof prof.permissions === 'object' ? prof.permissions : {}) as Record<string, any>;
  const explicitMode = String(p.wa_access_mode || '');
  let scopes: string[] = [];
  if (prof.is_platform_owner === true || role === 'super_admin' || role === 'company_admin' || explicitMode === 'admin_all') {
    scopes = ['all'];
  } else if (explicitMode === 'soporte_team' || explicitMode === 'soporte_assigned') {
    scopes = ['soporte'];
  } else if (explicitMode === 'ventas_pool' || explicitMode === 'ventas_assigned') {
    scopes = ['leads'];
  } else if (explicitMode === 'both') {
    scopes = ['soporte', 'leads'];
  } else if (explicitMode === 'none') {
    scopes = [];
  } else {
    let keys: string[] = [];
    if (prof.custom_role_id) {
      const { data: rp } = await supabase
        .from('role_permissions')
        .select('permission_key')
        .eq('role_id', prof.custom_role_id)
        .eq('is_enabled', true)
        .in('permission_key', ['wa_chat_all', 'wa_chat_soporte', 'wa_chat_leads']);
      keys = (rp || []).map((r: any) => r.permission_key);
    }
    if (keys.includes('wa_chat_all') || p.wa_chat_all === true) {
      scopes = ['all'];
    } else {
      if (keys.includes('wa_chat_soporte') || p.wa_chat_soporte === true) scopes.push('soporte');
      if (keys.includes('wa_chat_leads') || p.wa_chat_leads === true || p.leads === true || p.leads_view === true) {
        scopes.push('leads');
      }
    }
  }
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  return {
    userId: uid,
    fullName: prof.full_name || prof.email || 'Equipo',
    companyId: prof.company_id,
    scopes,
    isAdmin: scopes.includes('all'),
    userClient,
  };
}

// The ticket as the CALLER sees it (RLS) — null means "not allowed".
async function ticketVisibleTo(caller: Caller, ticketId: string): Promise<boolean> {
  const { data } = await caller.userClient.from('tickets').select('id').eq('id', ticketId).maybeSingle();
  return Boolean(data?.id);
}

// =============================================================================
// HTTP handler
// =============================================================================

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // CRM_* only matter when this function writes to a DIFFERENT project; for its own
  // project the platform-managed service key is always the valid one.
  const ownUrl = Deno.env.get('SUPABASE_URL') || '';
  const crmUrl = Deno.env.get('CRM_SUPABASE_URL') || '';
  const usesOtherProject = Boolean(crmUrl) && crmUrl.replace(/\/$/, '') !== ownUrl.replace(/\/$/, '');
  const supabaseUrl = usesOtherProject ? crmUrl : ownUrl;
  const serviceKey = usesOtherProject
    ? Deno.env.get('CRM_SERVICE_ROLE_KEY') || ''
    : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const url = new URL(req.url);
  const selfUrl = `${(Deno.env.get('SUPABASE_URL') || supabaseUrl).replace(/\/$/, '')}/functions/v1/evolution-whatsapp-webhook`;

  try {
    if (req.method === 'GET') {
      if (url.searchParams.get('action') === 'bridge_sh') {
        return await handleBridgeSh(supabase, selfUrl, { resolveMainCompanyId, rescopeChats });
      }
      return json({ ok: true, status: 'active', service: 'evolution-whatsapp-webhook', version: '2026-11-20-chats-update-v2' });
    }

    const payload = await req.json().catch(() => ({}));
    const action = url.searchParams.get('action') || payload?.action || '';

    // ── Bridge callbacks (server-to-server, no user session) ──
    if (action === 'bridge_ack') return await handleBridgeAck(supabase, url, payload);
    if (action === 'upload_media') return await handleUploadMedia(supabase, url, payload);
    if (action === 'sync_group_subject') return await handleSyncGroup(supabase, url, payload);
    if (action === 'sync_all_groups') return await handleSyncAllGroups(supabase, url, payload);
    if (action === 'import_history') return await handleImportHistory(supabase, url, payload);
    if (action === 'report_evo_heal') return await handleReportEvoHeal(supabase, url, payload);
    if (action === 'catchup_messages') return await handleCatchupMessages(supabase, url, payload);
    if (action === 'watchdog_check') return await handleWatchdogCheck(supabase, url, payload);
    if (action === 'ack_webhook_events') return await handleAckWebhookEvents(supabase, url, payload);

    // ── Actions from the CRM UI (require a logged-in user) ──
    const uiActions = [
      'get_ai_config', 'test_openai', 'save_ai_config', 'save_ai_prompt', 'set_ticket_channel',
      'draft_technical_ticket', 'set_technical_ticket', 'cleanup_auto_junk_tickets',
      'promote_to_lead', 'classify_contact', 'update_lead_status', 'send_reply', 'send_media', 'send_reactivation',
      'retry_media', 'retry_outbox', 'bridge_status', 'rescope_now', 'request_history_import', 'request_evo_heal',
      'get_wa_team_access', 'set_wa_user_access', 'set_qualifier_thread_state',
    ];
    if (uiActions.includes(action)) {
      const caller = await getCaller(req, supabase, supabaseUrl);
      if (!caller) return json({ ok: false, error: 'No autorizado', reason: lastCallerAuthError || 'unknown' }, 401);
      if (caller.scopes.length === 0) return json({ ok: false, error: 'Sin acceso al Chat WhatsApp' }, 403);

      switch (action) {
        case 'get_ai_config':
        case 'test_openai':
          return await handleGetAiConfig(supabase, caller, payload);
        case 'save_ai_config':
        case 'save_ai_prompt':
          if (!caller.isAdmin) return json({ ok: false, error: 'Solo un administrador puede cambiar la IA' }, 403);
          return await handleSaveAiConfig(supabase, caller, payload);
        case 'get_wa_team_access':
          if (!caller.isAdmin) return json({ ok: false, error: 'Solo un administrador puede ver accesos del equipo' }, 403);
          return await handleGetWaTeamAccess(supabase, caller, payload);
        case 'set_wa_user_access':
          if (!caller.isAdmin) return json({ ok: false, error: 'Solo un administrador puede cambiar accesos del equipo' }, 403);
          return await handleSetWaUserAccess(supabase, caller, payload);
        case 'set_ticket_channel':
          return await handleSetChannel(supabase, caller, payload);
        case 'draft_technical_ticket':
          return await handleDraftTechnicalTicket(supabase, caller, payload);
        case 'set_technical_ticket':
          return await handleSetTechnicalTicket(supabase, caller, payload);
        case 'cleanup_auto_junk_tickets':
          if (!caller.isAdmin) return json({ ok: false, error: 'Solo un administrador puede limpiar tickets automáticos' }, 403);
          return await handleCleanupAutoJunkTickets(supabase, caller, payload);
        case 'promote_to_lead':
          return await handleClassify(supabase, caller, { ...payload, contact_type: 'lead' });
        case 'classify_contact':
          return await handleClassify(supabase, caller, payload);
        case 'update_lead_status':
          return await handleUpdateLeadStatusServer(supabase, caller, payload);
        case 'send_reply':
          await pauseQualifierOnHumanReply(supabase, payload?.ticket_id, caller.fullName);
          return await handleSendReply(supabase, caller, payload);
        case 'send_media':
          await pauseQualifierOnHumanReply(supabase, payload?.ticket_id, caller.fullName);
          return await handleSendMedia(supabase, caller, payload);
        case 'set_qualifier_thread_state':
          return await handleSetQualifierThreadState(supabase, caller, payload);
        case 'send_reactivation':
          return await handleSendReactivation(supabase, caller, payload);
        case 'retry_media':
          return await handleRetryMedia(supabase, caller, payload);
        case 'retry_outbox':
          return await handleRetryOutbox(supabase, caller, payload);
        case 'bridge_status':
          return await handleBridgeStatus(supabase);
        case 'rescope_now': {
          if (!caller.isAdmin) return json({ ok: false, error: 'Solo un administrador' }, 403);
          const cid = await resolveMainCompanyId(supabase, url.searchParams.get('company_id'));
          if (!cid) return json({ ok: false, error: 'No company' }, 400);
          return json({ ok: true, ...(await rescopeChats(supabase, cid)) });
        }
        case 'request_history_import': {
          if (!caller.isAdmin) return json({ ok: false, error: 'Solo un administrador' }, 403);
          await setBridgeState(supabase, 'history_import', { status: 'requested', requested_at: new Date().toISOString() });
          return json({ ok: true });
        }
        case 'request_evo_heal': {
          if (!caller.isAdmin) return json({ ok: false, error: 'Solo un administrador' }, 403);
          await setBridgeState(supabase, 'evo_heal', {
            status: 'requested',
            mode: String(payload?.mode || 'restart_and_catchup'),
            since: payload?.since || null,
            requested_at: new Date().toISOString(),
          });
          return json({ ok: true });
        }
      }
    }

    // ── Everything else is an Evolution webhook event ──
    return await handleIncomingMessage(req, supabase, url, payload);
  } catch (err: any) {
    console.error('[evolution-whatsapp-webhook] Error:', err);
    return json({ ok: false, error: err?.message || 'Internal error' }, 500);
  }
});

// =============================================================================
// Sales Lead Qualifier controls & takeover helpers
// =============================================================================

const ALLOWED_SYNC_LEAD_STATUSES = new Set([
  'Prospecto',
  'Llamada fría',
  'En Nutrición',
  'Lead calificado',
  'En seguimiento',
  'Cotizado',
  'Negociación',
  'En Negociación',
  'Cerrado',
  'Cliente',
  'Perdido',
  'Erróneo',
]);

async function handleUpdateLeadStatusServer(supabase: any, caller: Caller, payload: any): Promise<Response> {
  const ticketId = String(payload?.ticket_id || '').trim();
  const newStatus = String(payload?.status || '').trim();
  if (!ticketId || !ALLOWED_SYNC_LEAD_STATUSES.has(newStatus)) {
    return json({ ok: false, error: 'Datos inválidos (ticket_id o status no permitido)' }, 400);
  }
  if (!(await ticketVisibleTo(caller, ticketId))) {
    return json({ ok: false, error: 'No tienes acceso a este chat' }, 403);
  }

  const { data: ticket, error: tErr } = await supabase
    .from('tickets')
    .select('id, company_id, lead_id, metadata')
    .eq('id', ticketId)
    .maybeSingle();
  if (tErr || !ticket) return json({ ok: false, error: 'Chat no encontrado' }, 404);

  const nowIso = new Date().toISOString();
  const meta = cleanMeta(ticket.metadata || {});
  const phoneDigits = String(meta.whatsapp_phone || '').replace(/\D/g, '');
  let targetLeadId = String(payload?.lead_id || ticket.lead_id || '').trim() || null;

  if (!targetLeadId && phoneDigits.length >= 8) {
    const tail8 = phoneDigits.slice(-8);
    const { data: candidateLeads } = await supabase
      .from('leads')
      .select('id, phone')
      .eq('company_id', ticket.company_id)
      .ilike('phone', `%${tail8}%`)
      .limit(10);
    const matched = (candidateLeads || []).find(
      (l: any) => String(l.phone || '').replace(/\D/g, '').slice(-8) === tail8
    );
    if (matched?.id) targetLeadId = String(matched.id);
  }

  if (targetLeadId) {
    const { data: updatedLead, error: lErr } = await supabase
      .from('leads')
      .update({ status: newStatus, updated_at: nowIso })
      .eq('id', targetLeadId)
      .eq('company_id', ticket.company_id)
      .select('id, status')
      .maybeSingle();
    if (lErr) return json({ ok: false, error: lErr.message }, 500);
    if (!updatedLead) return json({ ok: false, error: 'Lead no encontrado en la empresa' }, 404);
  }

  const isDiscard = newStatus === 'Perdido' || newStatus === 'Erróneo';
  const pauseAi = isDiscard || newStatus === 'Cliente' || newStatus === 'Cerrado';

  const { data: relatedTickets } = targetLeadId
    ? await supabase
        .from('tickets')
        .select('id, lead_id, metadata')
        .eq('company_id', ticket.company_id)
        .or(`id.eq.${ticketId},lead_id.eq.${targetLeadId}`)
    : await supabase.from('tickets').select('id, lead_id, metadata').eq('id', ticketId);

  for (const rt of relatedTickets || [ticket]) {
    const rtMeta = cleanMeta(rt.metadata || {});
    const nextMeta: Record<string, any> = {
      ...rtMeta,
      ...(rtMeta.wa_scope === 'por_clasificar' ? { wa_scope: 'lead' } : {}),
      wa_lead_status: newStatus,
      wa_lead_status_override: true,
      ...(isDiscard ? { wa_attended_at: nowIso } : {}),
      ...(pauseAi ? { ai_qualifier_active: false } : {}),
    };
    if (newStatus !== 'Erróneo') {
      delete nextMeta.wa_delivery_error;
    }
    const patch: Record<string, any> = { metadata: nextMeta, updated_at: nowIso };
    if (targetLeadId && !rt.lead_id) patch.lead_id = targetLeadId;
    await supabase.from('tickets').update(patch).eq('id', rt.id);
  }

  if (pauseAi && targetLeadId) {
    await supabase
      .from('lead_qualifier_sessions')
      .update({
        status: 'closed_discarded',
        handoff_reason: `Etapa cambiada a ${newStatus} por ${caller.fullName}`,
        handoff_at: nowIso,
      })
      .eq('company_id', ticket.company_id)
      .eq('lead_id', targetLeadId)
      .in('status', ['active', 'pending_first_touch', 'waiting_reply']);
  }

  await supabase.from('ticket_comments').insert({
    ticket_id: ticketId,
    company_id: ticket.company_id,
    author_id: caller.userId,
    body: `${caller.fullName} actualizó etapa del lead a: ${newStatus}`,
    is_internal: true,
  });

  return json({ ok: true, lead_id: targetLeadId, status: newStatus });
}

async function pauseQualifierOnHumanReply(supabase: any, ticketId: string | undefined, actorName: string) {
  if (!ticketId) return;
  try {
    const { data: ticket } = await supabase
      .from('tickets')
      .select('id, company_id, lead_id, metadata')
      .eq('id', ticketId)
      .maybeSingle();
    if (!ticket) return;
    const meta = cleanMeta(ticket.metadata || {});
    if (meta.ai_qualifier_active !== true) return;
    const nowIso = new Date().toISOString();
    await supabase
      .from('tickets')
      .update({
        metadata: {
          ...meta,
          ai_qualifier_active: false,
          ai_qualifier_status: 'human_takeover',
          ai_qualifier_paused_by: actorName || 'Asesor CRM',
          ai_qualifier_paused_at: nowIso,
        },
      })
      .eq('id', ticket.id);
    if (ticket.lead_id) {
      await supabase
        .from('lead_qualifier_sessions')
        .update({
          status: 'human_takeover',
          handoff_reason: `Asesor humano (${actorName || 'CRM'}) tomó la conversación`,
          handoff_at: nowIso,
        })
        .eq('company_id', ticket.company_id)
        .eq('lead_id', ticket.lead_id);
    }
  } catch (err: any) {
    console.warn('[evolution-whatsapp-webhook] pauseQualifierOnHumanReply warn:', err?.message || err);
  }
}

async function handleSetQualifierThreadState(supabase: any, caller: Caller, payload: any): Promise<Response> {
  const ticketId = String(payload?.ticket_id || '').trim();
  const active = Boolean(payload?.active);
  if (!ticketId) return json({ ok: false, error: 'ticket_id es requerido' }, 400);

  const { data: ticket, error: tErr } = await supabase
    .from('tickets')
    .select('id, company_id, lead_id, metadata')
    .eq('id', ticketId)
    .maybeSingle();
  if (tErr || !ticket) return json({ ok: false, error: 'Ticket no encontrado' }, 404);
  if (!caller.isAdmin && caller.companyId && ticket.company_id !== caller.companyId) {
    return json({ ok: false, error: 'Sin permiso para esta empresa' }, 403);
  }

  const nowIso = new Date().toISOString();
  const meta = cleanMeta(ticket.metadata || {});
  const nextMeta = {
    ...meta,
    ai_qualifier_enrolled: true,
    ai_qualifier_active: active,
    ai_qualifier_status: active ? 'active' : 'paused',
    ai_qualifier_paused_by: active ? null : caller.fullName || 'Asesor CRM',
    ai_qualifier_paused_at: active ? null : nowIso,
  };
  await supabase.from('tickets').update({ metadata: nextMeta }).eq('id', ticket.id);

  if (ticket.lead_id) {
    await supabase
      .from('lead_qualifier_sessions')
      .update({
        status: active ? 'active' : 'paused',
        ...(active ? {} : { handoff_reason: `Pausado manualmente por ${caller.fullName || 'Asesor'}` }),
      })
      .eq('company_id', ticket.company_id)
      .eq('lead_id', ticket.lead_id);
  } else {
    await supabase
      .from('lead_qualifier_sessions')
      .update({ status: active ? 'active' : 'paused' })
      .eq('company_id', ticket.company_id)
      .eq('ticket_id', ticket.id);
  }

  return json({ ok: true, active, status: active ? 'active' : 'paused', ticket_id: ticket.id });
}

async function invokeLeadQualifierReply(params: {
  companyId: string;
  leadId: string;
  ticketId: string;
  messageText: string;
  senderPhone: string;
  waMessageId?: string | null;
}): Promise<{
  handled: boolean;
  replyText?: string | null;
  ticketMetaPatch?: Record<string, any> | null;
  diag: Record<string, any>;
}> {
  const qualBaseUrl = Deno.env.get('CRM_SUPABASE_URL') || Deno.env.get('SUPABASE_URL') || '';
  const syncSecret = (Deno.env.get('SHEETS_SYNC_SECRET') || '').trim();
  const serviceKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  const at = new Date().toISOString();

  if (!qualBaseUrl.startsWith('http') || (!syncSecret && !serviceKey)) {
    const diag = { at, ok: false, status: 0, reason: 'missing_env_or_secret', error: null };
    console.warn('[evolution-whatsapp-webhook] lead-qualifier-engine skipped:', diag.reason);
    return { handled: false, diag };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22000);
  try {
    const resp = await fetch(`${qualBaseUrl}/functions/v1/lead-qualifier-engine`, {
      method: 'POST',
      headers: buildQualifierInvokeHeaders(syncSecret, serviceKey),
      signal: controller.signal,
      body: JSON.stringify({
        action: 'process_inbound_reply',
        company_id: params.companyId,
        lead_id: params.leadId,
        ticket_id: params.ticketId,
        message_text: params.messageText,
        sender_phone: params.senderPhone,
        wa_message_id: params.waMessageId || null,
      }),
    });

    const rawBody = await resp.text().catch(() => '');
    let parsed: any = null;
    try {
      parsed = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      parsed = null;
    }

    if (!resp.ok) {
      const diag = {
        at,
        ok: false,
        status: resp.status,
        reason: parsed?.reason || parsed?.error || 'http_error',
        error: rawBody.slice(0, 200) || `HTTP ${resp.status}`,
      };
      console.warn('[evolution-whatsapp-webhook] lead-qualifier-engine HTTP error:', diag);
      return { handled: false, diag };
    }

    const handled = parsed?.handled === true;
    const diag = {
      at,
      ok: handled,
      status: resp.status,
      reason: parsed?.reason || parsed?.action || (handled ? 'handled' : 'not_handled'),
      error: parsed?.error || null,
    };
    if (!handled) {
      console.warn('[evolution-whatsapp-webhook] lead-qualifier-engine not handled:', diag);
    }
    return {
      handled,
      replyText: typeof parsed?.reply_text === 'string' ? parsed.reply_text : null,
      ticketMetaPatch: parsed?.ticket_meta_patch && typeof parsed.ticket_meta_patch === 'object' ? parsed.ticket_meta_patch : null,
      diag,
    };
  } catch (err: any) {
    const isAbort = err?.name === 'AbortError' || /abort/i.test(String(err?.message || ''));
    const diag = {
      at,
      ok: false,
      status: 0,
      reason: isAbort ? 'timeout_22s' : 'network_exception',
      error: String(err?.message || err).slice(0, 200),
    };
    console.warn('[evolution-whatsapp-webhook] lead-qualifier-engine error:', diag);
    return { handled: false, diag };
  } finally {
    clearTimeout(timer);
  }
}

// =============================================================================
// Inbound message
// =============================================================================

async function handleIncomingMessage(req: Request, supabase: any, url: URL, payload: any): Promise<Response> {
  const eventType = String(payload?.event || payload?.type || 'messages.upsert').toLowerCase();
  const isChatsUpdate = /chats[._]update/.test(eventType);
  if (!isChatsUpdate && !/messages[._]upsert|send[._]message/.test(eventType)) {
    return json({ ok: true, ignored: true, reason: `event ${eventType} not handled` });
  }

  const instanceName = normalizeInstance(payload?.instance || payload?.instanceName);
  const incomingKey = String(payload?.apikey || req.headers.get('apikey') || req.headers.get('x-evolution-apikey') || '');
  const envKey = Deno.env.get('EVOLUTION_API_KEY') || '';
  if (envKey && incomingKey && incomingKey !== envKey) {
    return json({ ok: false, error: 'apikey inválida' }, 401);
  }

  const companyId = await resolveMainCompanyId(supabase, url.searchParams.get('company_id'));
  if (!companyId) return json({ ok: false, error: 'No company_id resolved' }, 400);

  if (isChatsUpdate) {
    return await handleChatsUpdate(supabase, companyId, payload);
  }

  // Remember Evolution credentials/instance server-side (never in tickets).
  if (incomingKey || instanceName) {
    const st = await getBridgeState(supabase, 'evolution');
    if ((incomingKey && st.apikey !== incomingKey) || st.instance !== instanceName) {
      await setBridgeState(supabase, 'evolution', { ...st, ...(incomingKey ? { apikey: incomingKey } : {}), instance: instanceName });
    }
  }

  const rawData = payload?.data || payload;
  const entries: any[] = Array.isArray(rawData)
    ? rawData
    : Array.isArray(rawData?.messages)
    ? rawData.messages
    : [rawData];

  const sorted = entries.length > 1
    ? [...entries].sort((a, b) => messageDate(a).getTime() - messageDate(b).getTime())
    : entries;

  const team = await loadTeam(supabase, companyId);
  let lastResult: Record<string, any> = { ok: true, ignored: true, reason: 'empty payload' };
  for (const entry of sorted) {
    lastResult = await ingestWhatsAppEntry(supabase, companyId, instanceName, entry, rawData, payload, {
      isCatchup: false,
      teamCache: team,
    });
  }
  await setBridgeState(supabase, 'last_webhook_in', { at: new Date().toISOString() });
  return json(lastResult);
}

async function ingestWhatsAppEntry(
  supabase: any,
  companyId: string,
  instanceName: string,
  entry: any,
  rawData: any,
  payload: any,
  opts?: { isCatchup?: boolean; teamCache?: any }
): Promise<Record<string, any>> {
  const isCatchup = Boolean(opts?.isCatchup);
  const key = entry?.key || payload?.key || {};
  const remoteJidRaw: string = key?.remoteJid || entry?.remoteJid || payload?.remoteJid || '';
  if (!remoteJidRaw || remoteJidRaw === 'status@broadcast' || remoteJidRaw.endsWith('@newsletter')) {
    return { ok: true, ignored: true, reason: 'broadcast/status ignored' };
  }

  const fromMe = Boolean(key?.fromMe ?? entry?.fromMe ?? false);
  const waMessageId: string = String(key?.id || entry?.id || '').trim();
  const isGroup = remoteJidRaw.endsWith('@g.us');
  const pushName: string = String(entry?.pushName || payload?.pushName || '').trim();
  const msgDate = messageDate(entry);

  const rawMsgObj = entry?.message || payload?.message || {};
  const msgObj = unwrapMessage(rawMsgObj);
  if (msgObj?.protocolMessage || msgObj?.reactionMessage || msgObj?.pollUpdateMessage) {
    return { ok: true, ignored: true, reason: 'protocol/reaction message' };
  }
  const media = extractMedia(msgObj);
  const text = extractText(msgObj, rawMsgObj, entry);
  const displayText = text || (media ? mediaPlaceholder(media.kind, media.obj) : '');
  if (!displayText) return { ok: true, ignored: true, reason: 'No text or media content' };

  // Sender identity
  const participantJid: string = key?.participant || entry?.participant || '';
  const participantAlt: string = key?.participantAlt || key?.participantPn || entry?.participantAlt || '';
  const remoteAlt: string = key?.remoteJidAlt || key?.senderPn || entry?.remoteJidAlt || entry?.senderPn || payload?.senderPn || '';

  const senderPhone = isGroup
    ? jidPhone(participantAlt) || jidPhone(participantJid)
    : jidPhone(remoteAlt) || jidPhone(remoteJidRaw);
  const senderLid = isGroup ? jidLid(participantJid) || jidLid(participantAlt) : jidLid(remoteJidRaw) || jidLid(remoteAlt);
  // Canonical chat id: group jid, or phone jid for 1-on-1 (LID chats are mapped to the phone when known).
  const chatJid = isGroup ? remoteJidRaw : senderPhone ? `${senderPhone}@s.whatsapp.net` : remoteJidRaw;
  const chatPhone = isGroup ? '' : senderPhone;

  // Dedupe (Evolution may deliver the same message twice).
  if (waMessageId) {
    const { data: dup } = await supabase
      .from('whatsapp_messages')
      .select('id')
      .eq('company_id', companyId)
      .eq('wa_message_id', waMessageId)
      .maybeSingle();
    if (dup) return { ok: true, ignored: true, reason: 'duplicate message' };
  }

  const team = opts?.teamCache || (await loadTeam(supabase, companyId));

  // Who is speaking?
  // In 1-on-1 chats, only fromMe (sent by +503 7971-8911) is the outgoing side; messages sent from
  // the contact's phone (even when the contact is a team member testing) are incoming.
  const senderL8 = last8(senderPhone);
  const staffByName = isGroup ? matchStaffByName(team, pushName) : null;
  const staffByPhone = isGroup && senderL8 ? team.internoPhones.get(senderL8) : undefined;
  let isStaff = fromMe || Boolean(staffByName) || Boolean(staffByPhone);
  let staffStrong = isStaff;
  const staffProfileId: string | null = staffByName?.id || staffByPhone?.profileId || null;

  // Group bookkeeping + scope
  let groupSubject = '';
  let scopeInfo: ScopeInfo;
  if (isGroup) {
    const { data: grp } = await supabase
      .from('whatsapp_groups')
      .select('subject, client_id')
      .eq('company_id', companyId)
      .eq('group_jid', chatJid)
      .maybeSingle();
    groupSubject = String(
      entry?.groupMetadata?.subject || rawData?.groupMetadata?.subject || payload?.groupSubject || grp?.subject || ''
    ).trim();
    if (!grp) await upsertGroup(supabase, companyId, chatJid, { subject: groupSubject || null });
    else if (groupSubject && groupSubject !== grp.subject) await upsertGroup(supabase, companyId, chatJid, { subject: groupSubject });
    if (!fromMe && (senderPhone || senderLid)) {
      await rememberParticipant(supabase, companyId, chatJid, { phone: senderPhone || null, lid: senderLid || null, name: pushName || null });
    }
    if (!isStaff && (senderPhone || senderLid)) {
      // Weak staff signal: present in many client groups (label only, no auto-resolve).
      const memberships = await groupsContaining(supabase, companyId, senderPhone, senderLid);
      if (memberships.length >= STAFF_GROUP_MIN && memberships.length >= (await staffGroupThreshold(supabase, companyId))) {
        isStaff = true;
      }
    }
    scopeInfo = {
      scope: 'soporte', reason: 'grupo', leadId: null, leadName: null, leadStatus: null, leadOwner: null,
      clientId: grp?.client_id || null, clientName: null, profileId: null, memberOfGroups: [],
    };
  } else {
    scopeInfo = await resolveScope(supabase, companyId, team, chatPhone, senderLid);
  }

  let scope: WaScope = scopeInfo.scope;
  const classification = classifyIssueCategory(displayText);
  let supportChannel: SupportChannelType =
    scope === 'soporte' ? (classification.supportChannel === 'ventas' ? 'soporte' : classification.supportChannel) : 'ventas';

  const clientDisplayName = isGroup
    ? groupSubject || 'Grupo WhatsApp'
    : scopeInfo.leadName || scopeInfo.clientName || (pushName ? (chatPhone ? `${pushName} (+${chatPhone})` : pushName) : chatPhone ? `WhatsApp +${chatPhone}` : 'Cliente WhatsApp');

  const senderLabel = isStaff
    ? `👨‍💻 ${staffByName?.full_name || staffByPhone?.name || (fromMe ? 'Equipo Soporte' : pushName || 'Equipo Soporte')}`
    : `👤 ${pushName || (chatPhone ? `+${chatPhone}` : 'Cliente')}`;
  const timeStr = fmtTime(msgDate);

  // fromMe echo of something the CRM itself just sent -> link ids, don't duplicate.
  // ── Find the conversation (ticket) ──
  const { data: jidTickets } = await supabase
    .from('tickets')
    .select('id, title, status, priority, assigned_to, metadata, description, lead_id, lead_name, resolved_at, created_at, updated_at')
    .eq('company_id', companyId)
    .eq('metadata->>source', 'whatsapp_evolution')
    .eq('metadata->>whatsapp_jid', chatJid)
    .order('created_at', { ascending: false })
    .limit(20);
  let tickets = (jidTickets || []) as any[];
  if (tickets.length === 0 && !isGroup && remoteJidRaw !== chatJid) {
    // Legacy rows stored the raw (LID) jid.
    const { data: legacy } = await supabase
      .from('tickets')
      .select('id, title, status, priority, assigned_to, metadata, description, lead_id, lead_name, resolved_at, created_at, updated_at')
      .eq('company_id', companyId)
      .eq('metadata->>source', 'whatsapp_evolution')
      .eq('metadata->>whatsapp_jid', remoteJidRaw)
      .order('created_at', { ascending: false })
      .limit(20);
    tickets = (legacy || []) as any[];
  }
  const activeTicket = tickets.find((t) => ['new', 'open', 'pending'].includes(t.status)) || null;
  const lockSourceTicket = activeTicket || tickets.find((t) => !t.metadata?.merged_into) || tickets[0] || null;
  const lockMeta = lockSourceTicket?.metadata || {};
  const isCommercialLeadThread =
    !isGroup &&
    Boolean(lockSourceTicket) &&
    (lockMeta.wa_reactivation === true ||
      /^\[WhatsApp\s*·\s*(?:Nuevo\s+)?Lead\]/i.test(String(lockSourceTicket.title || '')) ||
      /^Reactivaci[oó]n comercial por WhatsApp/i.test(String(lockSourceTicket.description || '')) ||
      (lockMeta.wa_scope_locked === true && lockMeta.wa_scope === 'lead'));
  if (isCommercialLeadThread && scope === 'soporte') {
    scope = ['lead', 'por_clasificar', 'spam'].includes(String(lockMeta.wa_scope || ''))
      ? (lockMeta.wa_scope as WaScope)
      : lockSourceTicket?.assigned_to || scopeInfo.leadOwner
      ? 'lead'
      : 'por_clasificar';
    supportChannel = 'ventas';
  }

  // Check direct WhatsApp outbox sends without a ticket (e.g. advisor alerts) first so echoes never open spurious chats.
  if (fromMe) {
    const since = new Date(msgDate.getTime() - 30 * 60 * 1000).toISOString();
    const until = new Date(msgDate.getTime() + 30 * 60 * 1000).toISOString();
    const { data: directOut } = await supabase
      .from('whatsapp_outbox')
      .select('id, kind, payload, wa_message_id')
      .eq('company_id', companyId)
      .is('ticket_id', null)
      .eq('number', chatJid)
      .gte('created_at', since)
      .lte('created_at', until)
      .order('created_at', { ascending: false })
      .limit(10);
    const directEcho =
      (directOut || []).find((o: any) => waMessageId && o.wa_message_id === waMessageId) ||
      (directOut || []).find(
        (o: any) =>
          !o.wa_message_id &&
          o.kind === 'text' &&
          String(o.payload?.text || '').trim() === displayText.trim(),
      );
    if (directEcho) {
      if (waMessageId) {
        await supabase
          .from('whatsapp_outbox')
          .update({ wa_message_id: waMessageId })
          .eq('id', directEcho.id)
          .is('wa_message_id', null);
      }
      return { ok: true, ignored: true, reason: 'echo of direct advisor alert' };
    }
  }

  // A fromMe message may be the echo of something the CRM itself sent through the bridge.
  if (fromMe && tickets.length > 0) {
    const since = new Date(msgDate.getTime() - 30 * 60 * 1000).toISOString();
    const until = new Date(msgDate.getTime() + 30 * 60 * 1000).toISOString();
    const { data: recentOut } = await supabase
      .from('whatsapp_outbox')
      .select('id, ticket_id, comment_id, kind, payload, wa_message_id, status')
      .in('ticket_id', tickets.map((t) => t.id))
      .gte('created_at', since)
      .lte('created_at', until)
      .order('created_at', { ascending: false })
      .limit(20);
    const outs = (recentOut || []) as any[];
    const echo =
      outs.find((o) => waMessageId && o.wa_message_id === waMessageId) ||
      outs.find(
        (o) =>
          !o.wa_message_id &&
          ((o.kind === 'text' && String(o.payload?.text || '').trim() === displayText.trim()) ||
            (o.kind === 'media' && Boolean(media)))
      );
    if (echo) {
      if (waMessageId) {
        await supabase.from('whatsapp_outbox').update({ wa_message_id: waMessageId }).eq('id', echo.id).is('wa_message_id', null);
        const { data: linked } = await supabase
          .from('whatsapp_messages')
          .update({ wa_message_id: waMessageId })
          .eq('comment_id', echo.comment_id)
          .is('wa_message_id', null)
          .select('id');
        if (!linked || linked.length === 0) {
          await supabase.from('whatsapp_messages').upsert(
            {
              company_id: companyId, ticket_id: echo.ticket_id, comment_id: echo.comment_id, wa_message_id: waMessageId,
              remote_jid: chatJid, from_me: true, message_ts: msgDate.toISOString(), message_type: media?.kind || 'text',
              body: displayText,
            },
            { onConflict: 'company_id,wa_message_id', ignoreDuplicates: true }
          );
        }
      }
      return { ok: true, ignored: true, reason: 'echo of CRM-sent message' };
    }
  }

  const recentlyClosed = !activeTicket
    ? tickets.find((t) => {
        if (!['resolved', 'closed'].includes(t.status) || t.metadata?.merged_into) return false;
        const closedAt = new Date(t.resolved_at || t.updated_at || t.created_at).getTime();
        return Math.abs(msgDate.getTime() - closedAt) <= 12 * 60 * 60 * 1000;
      })
    : null;

  const nonTechRecent =
    !activeTicket && scope === 'soporte'
      ? tickets.find((t) => {
          if (t.metadata?.merged_into || t.metadata?.is_technical_ticket !== false) return false;
          const updatedAt = new Date(t.updated_at || t.created_at).getTime();
          return Math.abs(msgDate.getTime() - updatedAt) <= 24 * 60 * 60 * 1000;
        })
      : null;

  // Staff talking with no open conversation: attach to the latest one, never open a "self-ticket".
  let targetTicket: any = activeTicket;
  if (!targetTicket && isStaff) {
    targetTicket = tickets.find((t) => !t.metadata?.merged_into) || null;
    if (!targetTicket && (scope === 'soporte' || isGroup)) {
      return { ok: true, ignored: true, reason: 'Staff message with no conversation — no self-ticket' };
    }
  }
  // Client courtesy ("gracias", "ok") right after closing: attach to the closed ticket, don't reopen.
  if (
    !targetTicket &&
    scope === 'soporte' &&
    recentlyClosed &&
    !classification.isActualSupportProblem &&
    isGreetingOrClosingAgreement(displayText) &&
    !media
  ) {
    targetTicket = recentlyClosed;
  }
  if (!targetTicket && nonTechRecent) {
    targetTicket = nonTechRecent;
  }

  let aiCfgCache: any = null;
  const getAiCfg = async () => {
    if (!aiCfgCache) aiCfgCache = await loadSupportAiConfig(supabase, companyId);
    return aiCfgCache;
  };

  // Incoming WhatsApp chats NEVER auto-create active technical tickets.
  // They remain cleanly inside Chat WhatsApp until an agent promotes them
  // explicitly via "Crear Ticket Técnico" (set_technical_ticket).
  const isTechProblem = false;

  const baseMetaPatch: Record<string, any> = {
    source: 'whatsapp_evolution',
    support_phone: SUPPORT_PHONE,
    evolution_instance: instanceName,
    whatsapp_jid: chatJid,
    whatsapp_phone: chatPhone,
    is_group: isGroup,
    wa_scope: scope,
    wa_scope_reason: isCommercialLeadThread && scopeInfo.scope === 'soporte' ? 'reactivation_or_lead_locked' : scopeInfo.reason,
    ...(isCommercialLeadThread && scopeInfo.scope === 'soporte' ? { wa_scope_locked: true } : {}),
    is_existing_client: scope === 'soporte',
    member_of_groups: scopeInfo.memberOfGroups,
    ...(isGroup && groupSubject ? { whatsapp_group_subject: groupSubject, group_subject_synced: true } : {}),
    ...(scopeInfo.clientId ? { client_id: scopeInfo.clientId } : {}),
    ...(senderLid && !isGroup ? { whatsapp_lid: senderLid } : {}),
  };
  if (!fromMe && pushName && !isStaff) baseMetaPatch.whatsapp_push_name = pushName;

  // ── Create a new conversation ticket if needed ──
  let createdNew = false;
  if (!targetTicket) {
    const previousSameCategory = tickets.find(
      (t) => ['resolved', 'closed'].includes(t.status) && t.metadata?.ai_category === classification.category
    );
    const cleanedDisplay =
      scope === 'soporte' && isTechProblem
        ? stripLeadingGreetingForTicketTitle(displayText)
        : displayText.replace(/\s+/g, ' ').trim();
    const shortTitle = cleanedDisplay.length > 85 ? `${cleanedDisplay.slice(0, 82).trim()}...` : cleanedDisplay;
    const tag =
      scope === 'soporte' ? (isTechProblem ? classification.shortCategoryTag : 'Chat') : SCOPE_TITLE_TAG[scope];
    const parentTicketId = scope === 'soporte' ? previousSameCategory?.id || null : null;
    const headerLine =
      scope === 'soporte'
        ? isTechProblem
          ? `📌 PROBLEMA REPORTADO (${classification.category}):`
          : '💬 Conversación de WhatsApp (Soporte):'
        : `💬 Conversación de WhatsApp (${SCOPE_TITLE_TAG[scope]}):`;
    const insertRow = {
      company_id: companyId,
      lead_id: scopeInfo.leadId,
      lead_name: clientDisplayName,
      ...(parentTicketId ? { parent_ticket_id: parentTicketId } : {}),
      assigned_to: scope === 'lead' ? scopeInfo.leadOwner : null,
      title: `[WhatsApp · ${tag}] ${clientDisplayName}: ${shortTitle}`,
      description: [
        headerLine,
        displayText,
        '',
        '💬 Historial de WhatsApp:',
      ].join('\n'),
      status: scope === 'soporte' && !isTechProblem ? 'closed' : 'open',
      priority: scope === 'soporte' && isTechProblem ? classification.priority : 'medium',
      metadata: {
        ...baseMetaPatch,
        support_channel: supportChannel,
        ai_category: scope === 'soporte' ? classification.category : 'Ventas / Precios / Nuevo Lead',
        whatsapp_message_count: 0,
        is_technical_ticket: scope === 'soporte' ? isTechProblem : false,
        awaiting_problem_details: scope === 'soporte' ? !isTechProblem : false,
        is_recurring_client_issue: scope === 'soporte' && Boolean(previousSameCategory),
        previous_ticket_id: scope === 'soporte' ? previousSameCategory?.id || null : null,
      },
    };
    const { data: created, error: createErr } = await supabase.from('tickets').insert(insertRow).select('*').single();
    if (createErr) {
      // Another message for the same chat created it a millisecond earlier (unique open conversation).
      if (String(createErr.code) === '23505') {
        const { data: winner } = await supabase
          .from('tickets')
          .select('*')
          .eq('company_id', companyId)
          .eq('metadata->>source', 'whatsapp_evolution')
          .eq('metadata->>whatsapp_jid', chatJid)
          .in('status', ['new', 'open', 'pending'])
          .maybeSingle();
        if (!winner) throw createErr;
        targetTicket = winner;
      } else {
        throw createErr;
      }
    } else {
      targetTicket = created;
      createdNew = true;
    }
  }

  // ── Claim the message id (dedupe across concurrent deliveries) ──
  let waRowId: string | null = null;
  const waRow: Record<string, any> = {
    company_id: companyId,
    ticket_id: targetTicket.id,
    wa_message_id: waMessageId || null,
    remote_jid: chatJid,
    from_me: fromMe,
    sender_phone: senderPhone || null,
    sender_name: pushName || null,
    message_ts: msgDate.toISOString(),
    message_type: media?.kind || 'text',
    body: displayText,
  };
  if (media) {
    waRow.media_status = 'pending';
    waRow.media_mime = media.obj?.mimetype || null;
    waRow.media_filename = media.obj?.fileName || null;
    waRow.media_size = Number(media.obj?.fileLength?.low ?? media.obj?.fileLength) || null;
    waRow.raw_message = { key: { ...key, remoteJid: remoteJidRaw }, message: { [media.field]: slimMediaObject(media.obj) } };
  }
  const { data: claimed, error: claimErr } = await supabase.from('whatsapp_messages').insert(waRow).select('id').single();
  if (claimErr) {
    if (String(claimErr.code) === '23505') return { ok: true, ignored: true, reason: 'duplicate message (race)' };
    throw claimErr;
  }
  waRowId = claimed.id;

  // ── The chat line (comment) ──
  const isFirst = createdNew && !isStaff;
  const line = `[${timeStr}] ${senderLabel}${isFirst && scope === 'soporte' ? ' (Reporte Inicial)' : ''}: ${displayText}`;
  const { data: comment } = await supabase
    .from('ticket_comments')
    .insert({
      ticket_id: targetTicket.id,
      company_id: companyId,
      author_id: isStaff && staffStrong ? staffProfileId : null,
      body: line,
      is_internal: false,
      created_at: msgDate.toISOString(),
    })
    .select('id')
    .single();
  if (comment?.id) await supabase.from('whatsapp_messages').update({ comment_id: comment.id }).eq('id', waRowId);

  // Inline media (Evolution "webhook base64" option) — store right away + transcribe audio for AI Qualifier.
  const inlineB64: string = entry?.message?.base64 || entry?.base64 || payload?.data?.message?.base64 || '';
  let inlineAudioTranscript = '';
  if (media && inlineB64 && waRowId) {
    const storedInline = await storeMediaBytes(supabase, waRowId, inlineB64, media.obj?.mimetype || '', media.obj?.fileName || '');
    if (
      storedInline.ok &&
      storedInline.bytes &&
      media.kind === 'audio' &&
      !fromMe &&
      !isStaff &&
      Date.now() - msgDate.getTime() < 15 * 60 * 1000
    ) {
      const aiCfg = await getAiCfg();
      if (aiCfg.openAiKey) {
        const transcript = await transcribeAudio(aiCfg.openAiKey, storedInline.bytes, storedInline.mime || 'audio/ogg');
        if (transcript) {
          inlineAudioTranscript = transcript;
          if (comment?.id) {
            await supabase
              .from('ticket_comments')
              .update({ body: `${line}\n📝 Transcripción IA: "${transcript}"` })
              .eq('id', comment.id);
          }
          await supabase.from('whatsapp_messages').update({ body: transcript }).eq('id', waRowId);
        }
      }
    }
  }

  // ── Update the ticket ──
  const currentMeta = cleanMeta(targetTicket.metadata || {});
  const prevLastIso = String(currentMeta.last_whatsapp_at || '');
  const isNewerOrEqual = !prevLastIso || msgDate.toISOString() >= prevLastIso;
  const isResolutionReply =
    isNewerOrEqual &&
    staffStrong &&
    scope === 'soporte' &&
    /listo|resuelto|solucionado|arreglado|ya quedo|ya quedó|corregido|actualizado/i.test(displayText);
  const wasTechTicket = currentMeta.is_technical_ticket === true;
  const promoteToTechTicket = scope === 'soporte' && !isStaff && isTechProblem && currentMeta.is_technical_ticket !== true;
  const shouldUpgradeTitle =
    scope === 'soporte' &&
    !isStaff &&
    isTechProblem &&
    (promoteToTechTicket || isGenericProblemTitle(targetTicket.title)) &&
    displayText.length >= 8;

  let lastPreview = displayText.slice(0, 200);
  let description = String(targetTicket.description || '');
  if (!description.includes('💬 Historial de WhatsApp:')) {
    description = `${description}\n\n💬 Historial de WhatsApp:\n${line}`;
  } else if (isNewerOrEqual) {
    description = `${description}\n${line}`;
  } else {
    // Insert before the last chat line so SupportChatCircles preview keeps the newest message at the end.
    const lastNl = description.lastIndexOf('\n');
    description = lastNl > 0 ? `${description.slice(0, lastNl)}\n${line}${description.slice(lastNl)}` : `${description}\n${line}`;
  }

  // Pause AI Sales Qualifier automatically if staff replies directly from mobile WhatsApp
  if (!isCatchup && isStaff && currentMeta.ai_qualifier_active === true) {
    const pausedAt = new Date().toISOString();
    const takeoverPatch: Record<string, any> = {
      ai_qualifier_active: false,
      ai_qualifier_status: 'human_takeover',
      ai_qualifier_paused_by: pushName || 'Asesor por WhatsApp',
      ai_qualifier_paused_at: pausedAt,
    };
    Object.assign(currentMeta, takeoverPatch);
    await supabase
      .from('tickets')
      .update({ metadata: { ...cleanMeta(currentMeta), ...takeoverPatch } })
      .eq('id', targetTicket.id);
    if (scopeInfo.leadId) {
      await supabase
        .from('lead_qualifier_sessions')
        .update({
          status: 'human_takeover',
          handoff_reason: 'Asesor humano respondió directo por WhatsApp',
          handoff_at: pausedAt,
        })
        .eq('company_id', companyId)
        .eq('lead_id', scopeInfo.leadId);
    }
  }

  // Optional AI text auto-reply (OFF by default). Never for catchup, staff, team, spam or audio.
  let aiReplied = false;
  let aiReplyAuthor = '';
  let autoResolvedMetaPatch: Record<string, any> = {};

  // Dedicated Sales Lead Qualifier AI route (only when this lead chat was enrolled & active)
  const effectiveLeadId = scopeInfo.leadId || targetTicket.lead_id || null;
  const qualifierMessageText = inlineAudioTranscript
    ? `[Nota de voz del prospecto]: "${inlineAudioTranscript}"`
    : text;
  const msgAgeMs = Date.now() - msgDate.getTime();
  const alreadyProcessedByQualifier = Boolean(waMessageId && currentMeta.ai_qualifier_last_msg_id === waMessageId);

  if (
    !alreadyProcessedByQualifier &&
    shouldTriggerLeadQualifier({
      isCatchup,
      msgAgeMs,
      isStaff,
      isGroup,
      scope,
      aiQualifierActive: currentMeta.ai_qualifier_active === true,
      effectiveLeadId,
      messageText: qualifierMessageText,
      hasNonAudioMediaWithoutCaption: Boolean(media && media.kind !== 'audio' && !text),
    })
  ) {
    const qualResult = await invokeLeadQualifierReply({
      companyId,
      leadId: effectiveLeadId!,
      ticketId: targetTicket.id,
      messageText: qualifierMessageText,
      senderPhone: senderPhone || chatPhone || '',
      waMessageId,
    });
    autoResolvedMetaPatch.ai_qualifier_last_diag = qualResult.diag;
    if (qualResult.handled) {
      aiReplied = true;
      aiReplyAuthor = 'Calificador IA';
      if (qualResult.ticketMetaPatch) {
        Object.assign(autoResolvedMetaPatch, qualResult.ticketMetaPatch);
        Object.assign(currentMeta, qualResult.ticketMetaPatch);
      }
      if (qualResult.replyText) {
        const qualLine = `[${fmtTime(new Date())}] 👨‍💻 Calificador IA: ${qualResult.replyText.trim()}`;
        description = `${description}\n${qualLine}`;
        lastPreview = qualResult.replyText.trim().slice(0, 200);
      }
    }
  }

  if (!aiReplied && !isCatchup && !isStaff && !media && ['soporte', 'lead', 'por_clasificar'].includes(scope) && currentMeta.ai_auto_reply_text_enabled !== false) {
    const aiCfg = await getAiCfg();
    if (aiCfg.autoReplyText && aiCfg.openAiKey && !isGreetingOrClosingAgreement(displayText)) {
      const reply = await askOpenAi(
        aiCfg.openAiKey,
        aiCfg.prompts[supportChannel] || DEFAULT_AI_PROMPTS.soporte,
        `El cliente (${clientDisplayName}) escribió por WhatsApp: "${displayText}". Redacta la respuesta breve y directa que se enviará a su WhatsApp.`
      );
      if (reply) {
        const aiLine = `[${fmtTime(new Date())}] 👨‍💻 ${aiBotLabel(supportChannel)}: ${reply}`;
        const { data: aiComment } = await supabase
          .from('ticket_comments')
          .insert({ ticket_id: targetTicket.id, company_id: companyId, author_id: null, body: aiLine, is_internal: false })
          .select('id')
          .single();
        description = `${description}\n${aiLine}`;
        lastPreview = reply.slice(0, 200);
        await enqueueOutbox(supabase, {
          companyId, ticketId: targetTicket.id, commentId: aiComment?.id || null, instance: instanceName,
          number: chatJid, kind: 'text', payload: { text: reply },
        });
        aiReplied = true;
        aiReplyAuthor = aiBotLabel(supportChannel);
      }
    }

    // Isolated Campaign / Lead Auto-Reply for polite closures ("Ya resolvimos", "Ya contamos con servicio")
    if (
      !aiReplied &&
      !isGroup &&
      aiCfg.autoReplyResolvedEnabled &&
      (scope === 'lead' || scope === 'por_clasificar' || Boolean(currentMeta.wa_reactivation)) &&
      !currentMeta.auto_resolved_replied_at &&
      isAlreadyResolvedReply(displayText, aiCfg.resolvedTriggerPhrases)
    ) {
      const resolvedReply = renderResolvedReplyTemplate(aiCfg.resolvedReplyTemplate, clientDisplayName);
      if (resolvedReply) {
        const nowIso = new Date().toISOString();
        const senderTag = String(
          currentMeta.wa_reactivation_by_name || currentMeta.last_staff_reply_by || 'Equipo Comercial'
        )
          .replace(/Simulaci[oó]n:\s*[a-zA-Z0-9_-]+/gi, 'Equipo Comercial')
          .trim();
        const resLine = `[${fmtTime(new Date())}] 👨‍💻 ${senderTag}: ${resolvedReply}`;
        const { data: resComment } = await supabase
          .from('ticket_comments')
          .insert({
            ticket_id: targetTicket.id,
            company_id: companyId,
            author_id: null,
            body: resLine,
            is_internal: false,
          })
          .select('id')
          .single();
        description = `${description}\n${resLine}`;
        lastPreview = resolvedReply.slice(0, 200);
        await enqueueOutbox(supabase, {
          companyId,
          ticketId: targetTicket.id,
          commentId: resComment?.id || null,
          instance: instanceName,
          number: chatJid,
          kind: 'text',
          payload: { text: resolvedReply },
        });
        aiReplied = true;
        aiReplyAuthor = senderTag;
        autoResolvedMetaPatch = {
          auto_resolved_replied_at: nowIso,
          wa_attended_at: nowIso,
          ...(aiCfg.autoResolvedMarkLost ? { wa_lead_status: 'Perdido' } : {}),
        };

        if (aiCfg.autoResolvedMarkLost) {
          const targetLeadId = targetTicket.lead_id || scopeInfo.leadId || null;
          if (targetLeadId) {
            const { data: ld } = await supabase
              .from('leads')
              .select('id, status')
              .eq('id', targetLeadId)
              .maybeSingle();
            if (ld && ld.status !== 'Cliente' && ld.status !== 'Cerrado') {
              await supabase.from('leads').update({ status: 'Perdido' }).eq('id', targetLeadId);
            }
          }
        }
      }
    }
  }

  // Preserve manual promotion if the human already created a formal ticket;
  // otherwise keep the conversation as Chat WhatsApp only (is_technical_ticket: false).
  const nextIsTechTicket = scope !== 'soporte' ? false : wasTechTicket ? true : false;

  const prevScope = String(currentMeta.wa_scope || '');
  const scopeChanged = prevScope !== '' && prevScope !== scope;
  if (shouldUpgradeTitle) {
    description = description.replace(
      /^(?:📌 PROBLEMA REPORTADO \([^)]+\)|💬 Conversación de WhatsApp \([^)]+\)):\n[\s\S]*?(?=\n\n💬 Historial de WhatsApp:)/,
      `📌 PROBLEMA REPORTADO (${classification.category}):\n${displayText}`
    );
  }
  const inboundStaffReplyBy = aiReplied
    ? aiReplyAuthor || aiBotLabel(supportChannel)
    : isStaff
    ? staffByName?.full_name || staffByPhone?.name || (fromMe ? 'WhatsApp' : pushName || 'Equipo')
    : '';
  const updated: Record<string, any> = {
    description,
    updated_at: isNewerOrEqual ? (isCatchup ? msgDate.toISOString() : new Date().toISOString()) : targetTicket.updated_at || new Date().toISOString(),
    metadata: {
      ...currentMeta,
      ...baseMetaPatch,
      ...autoResolvedMetaPatch,
      ...(nextIsTechTicket !== undefined ? { is_technical_ticket: nextIsTechTicket } : {}),
      awaiting_problem_details: scope === 'soporte' ? !(nextIsTechTicket === true) : false,
      support_channel: scope === 'soporte' ? (classification.supportChannel !== 'soporte' && classification.supportChannel !== 'ventas' && !isStaff ? classification.supportChannel : currentMeta.support_channel === 'ventas' ? 'soporte' : currentMeta.support_channel || 'soporte') : 'ventas',
      whatsapp_message_count: Number(currentMeta.whatsapp_message_count || 0) + 1 + (aiReplied && aiReplyAuthor !== 'Calificador IA' ? 1 : 0),
      last_whatsapp_message: isNewerOrEqual ? lastPreview : currentMeta.last_whatsapp_message,
      last_whatsapp_at: isNewerOrEqual ? msgDate.toISOString() : prevLastIso,
      last_message_from: isNewerOrEqual ? (aiReplied || isStaff ? 'staff' : 'client') : currentMeta.last_message_from,
      ...(isNewerOrEqual && (aiReplied || isStaff)
        ? {
            last_staff_reply_at: msgDate.toISOString(),
            last_staff_reply_by: inboundStaffReplyBy,
          }
        : {}),
      ...(scopeChanged ? { wa_scope_changed_at: new Date().toISOString(), wa_scope_previous: prevScope } : {}),
      ai_category:
        scope !== 'soporte'
          ? 'Ventas / Precios / Nuevo Lead'
          : shouldUpgradeTitle || (classification.supportChannel !== 'soporte' && !isStaff)
          ? classification.category
          : currentMeta.ai_category === 'Ventas / Precios / Nuevo Lead'
          ? classification.category
          : currentMeta.ai_category || classification.category,
    },
  };
  if (isGroup && groupSubject) updated.lead_name = groupSubject;
  if (!isGroup && scopeInfo.leadId && !targetTicket.lead_id) updated.lead_id = scopeInfo.leadId;
  if (!isGroup && (scopeInfo.leadName || scopeInfo.clientName) && targetTicket.lead_name !== clientDisplayName) {
    updated.lead_name = clientDisplayName;
  }
  if (scope === 'lead' && !targetTicket.assigned_to && scopeInfo.leadOwner) updated.assigned_to = scopeInfo.leadOwner;
  if (shouldUpgradeTitle) {
    const cleanDesc = stripLeadingGreetingForTicketTitle(displayText);
    const snippet = cleanDesc.length > 85 ? `${cleanDesc.slice(0, 82).trim()}...` : cleanDesc;
    updated.title = `[WhatsApp · ${classification.shortCategoryTag}] ${clientDisplayName}: ${snippet}`;
    if (promoteToTechTicket) {
      updated.priority = classification.priority;
      if (targetTicket.status !== 'open') {
        const reopenIso = new Date().toISOString();
        updated.status = 'open';
        updated.resolved_at = null;
        updated.last_status_change_at = reopenIso;
      }
    }
  } else if (scopeChanged) {
    updated.title = String(targetTicket.title || '').replace(/^\[WhatsApp · [^\]]*\]/, `[WhatsApp · ${scope === 'soporte' ? 'Soporte' : SCOPE_TITLE_TAG[scope]}]`);
  }
  if (isResolutionReply && ['new', 'open', 'pending'].includes(targetTicket.status)) {
    updated.status = 'resolved';
    updated.resolved_at = new Date().toISOString();
    updated.last_status_change_at = new Date().toISOString();
    updated.solution = displayText;
  }

  await supabase.from('tickets').update(updated).eq('id', targetTicket.id);

  return {
    ok: true,
    action: createdNew ? 'ticket_created' : isResolutionReply ? 'ticket_resolved' : 'message_appended',
    ticket_id: targetTicket.id,
    wa_scope: scope,
    scope_reason: scopeInfo.reason,
    media: media?.kind || null,
  };
}

// =============================================================================
// Media
// =============================================================================

async function storeMediaBytes(
  supabase: any,
  waMsgId: string,
  base64: string,
  mime: string,
  fileName: string
): Promise<{ ok: boolean; path?: string; bytes?: Uint8Array; mime?: string; error?: string }> {
  const { data: row } = await supabase
    .from('whatsapp_messages')
    .select('id, company_id, ticket_id, comment_id, message_type, media_filename, media_mime')
    .eq('id', waMsgId)
    .maybeSingle();
  if (!row) return { ok: false, error: 'message row not found' };
  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(base64.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, ''));
  } catch (_e) {
    return { ok: false, error: 'invalid base64' };
  }
  const finalMime = (mime || row.media_mime || 'application/octet-stream').split(';')[0].trim();
  const finalName = fileName || row.media_filename || '';
  const ext = guessExt(finalMime, finalName);
  const path = `${row.company_id}/${row.ticket_id}/${row.id}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, bytes, { contentType: finalMime, upsert: true });
  if (upErr) {
    await supabase.from('whatsapp_messages').update({ media_status: 'failed', media_error: `storage: ${upErr.message}` }).eq('id', row.id);
    return { ok: false, error: upErr.message };
  }
  await supabase
    .from('whatsapp_messages')
    .update({
      media_status: 'ready',
      media_path: path,
      media_mime: finalMime,
      media_filename: finalName || null,
      media_size: bytes.length,
      media_error: null,
      raw_message: null,
    })
    .eq('id', row.id);
  return { ok: true, path, bytes, mime: finalMime };
}

async function handleUploadMedia(supabase: any, url: URL, payload: any): Promise<Response> {
  const waMsgId = shellSafe(url.searchParams.get('wamsg') || payload?.wamsg || '');
  if (!waMsgId) return json({ ok: false, error: 'missing wamsg' }, 400);

  const b64: string = payload?.base64 || payload?.data?.base64 || payload?.message?.base64 || '';
  if (!b64) {
    const errText = JSON.stringify(payload?.response?.message || payload?.error || payload || {}).slice(0, 400);
    const { data: row } = await supabase.from('whatsapp_messages').select('media_attempts').eq('id', waMsgId).maybeSingle();
    const attempts = Number(row?.media_attempts || 0);
    await supabase
      .from('whatsapp_messages')
      .update({ media_status: attempts >= MEDIA_MAX_ATTEMPTS ? 'failed' : 'pending', media_error: errText || 'empty response' })
      .eq('id', waMsgId);
    return json({ ok: false, error: 'no base64 in Evolution response', detail: errText });
  }

  const stored = await storeMediaBytes(supabase, waMsgId, b64, payload?.mimetype || payload?.data?.mimetype || '', payload?.fileName || payload?.data?.fileName || '');
  if (!stored.ok) return json({ ok: false, error: stored.error });

  // Voice notes: transcription (+ Sales Lead Qualifier AI or optional legacy AI voice reply).
  const { data: row } = await supabase
    .from('whatsapp_messages')
    .select('id, company_id, ticket_id, comment_id, wa_message_id, sender_phone, message_type, from_me, message_ts')
    .eq('id', waMsgId)
    .maybeSingle();
  // Historical media (imported from the chat history) never triggers an automatic reply.
  const isRecentMsg = !row?.message_ts || Date.now() - new Date(row.message_ts).getTime() < 15 * 60 * 1000;
  if (row?.message_type === 'audio' && !row.from_me && stored.bytes) {
    const aiCfg = await loadSupportAiConfig(supabase, row.company_id || null);
    if (aiCfg.openAiKey) {
      const transcript = await transcribeAudio(aiCfg.openAiKey, stored.bytes, stored.mime || 'audio/ogg');
      if (transcript && row.comment_id) {
        const { data: c } = await supabase.from('ticket_comments').select('body').eq('id', row.comment_id).maybeSingle();
        if (c && !String(c.body || '').includes('📝 Transcripción IA')) {
          await supabase.from('ticket_comments').update({ body: `${c.body}\n📝 Transcripción IA: "${transcript}"` }).eq('id', row.comment_id);
        }
        await supabase.from('whatsapp_messages').update({ body: transcript }).eq('id', row.id);
      }
      const { data: t } = await supabase.from('tickets').select('*').eq('id', row.ticket_id).maybeSingle();
      let meta = cleanMeta(t?.metadata || {});
      const scope = String(meta.wa_scope || 'soporte') as WaScope;

      let handledByQualifier = false;
      const effectiveLeadId = t?.lead_id || null;
      const alreadyProcessedVoice = Boolean(row.wa_message_id && meta.ai_qualifier_last_msg_id === row.wa_message_id);
      if (
        t &&
        !alreadyProcessedVoice &&
        shouldTriggerLeadQualifier({
          isCatchup: !isRecentMsg,
          msgAgeMs: row.message_ts ? Date.now() - new Date(row.message_ts).getTime() : 0,
          isStaff: false,
          isGroup: meta.is_group === true || String(meta.whatsapp_jid || '').endsWith('@g.us'),
          scope,
          aiQualifierActive: meta.ai_qualifier_active === true,
          effectiveLeadId,
          messageText: transcript ? `[Nota de voz del prospecto]: "${transcript}"` : '',
        })
      ) {
        const qualRes = await invokeLeadQualifierReply({
          companyId: t.company_id || row.company_id,
          leadId: effectiveLeadId!,
          ticketId: t.id,
          messageText: `[Nota de voz del prospecto]: "${transcript}"`,
          senderPhone: row.sender_phone || meta.whatsapp_phone || '',
          waMessageId: row.wa_message_id || null,
        });
        const nextMeta: Record<string, any> = {
          ...meta,
          ai_qualifier_last_diag: qualRes.diag,
          ...(qualRes.ticketMetaPatch || {}),
        };
        if (qualRes.handled) {
          handledByQualifier = true;
          const patchUpdate: Record<string, any> = {
            metadata: nextMeta,
            updated_at: new Date().toISOString(),
          };
          if (qualRes.replyText) {
            const qualLine = `[${fmtTime(new Date())}] 👨‍💻 Calificador IA: ${qualRes.replyText.trim()}`;
            patchUpdate.description = `${String(t.description || '')}\n${qualLine}`;
          }
          await supabase.from('tickets').update(patchUpdate).eq('id', t.id);
        } else {
          await supabase.from('tickets').update({ metadata: nextMeta }).eq('id', t.id);
        }
      }

      // Voice transcripts are saved in chat history & reply context, without
      // auto-promoting chats into technical tickets.
      if (!handledByQualifier && t && isRecentMsg && aiCfg.autoReplyAudio && meta.ai_auto_reply_enabled !== false && ['soporte', 'lead', 'por_clasificar'].includes(scope)) {
        const ch: SupportChannelType = scope === 'soporte' ? (meta.support_channel as SupportChannelType) || 'soporte' : 'ventas';
        const reply = await askOpenAi(
          aiCfg.openAiKey,
          aiCfg.prompts[ch] || DEFAULT_AI_PROMPTS.soporte,
          transcript
            ? `El cliente (${t.lead_name || 'Cliente'}) envió una nota de voz diciendo: "${transcript}". Redacta la respuesta que se enviará a su WhatsApp.`
            : `El cliente (${t.lead_name || 'Cliente'}) envió una nota de voz. Redacta una respuesta amable confirmando recepción y que el equipo ya la está escuchando.`
        );
        if (reply) {
          const { data: aiComment } = await supabase
            .from('ticket_comments')
            .insert({ ticket_id: t.id, company_id: t.company_id, author_id: null, body: `[${fmtTime(new Date())}] 👨‍💻 ${aiBotLabel(ch)}: ${reply}`, is_internal: false })
            .select('id')
            .single();
          await enqueueOutbox(supabase, {
            companyId: t.company_id, ticketId: t.id, commentId: aiComment?.id || null,
            instance: normalizeInstance(meta.evolution_instance),
            number: meta.whatsapp_jid || meta.whatsapp_phone, kind: 'text', payload: { text: reply },
          });
          const aiReplyIso = new Date().toISOString();
          await supabase
            .from('tickets')
            .update({
              updated_at: aiReplyIso,
              metadata: {
                ...meta,
                last_whatsapp_message: reply.slice(0, 200),
                last_whatsapp_at: aiReplyIso,
                last_message_from: 'staff',
                last_staff_reply_at: aiReplyIso,
                last_staff_reply_by: aiBotLabel(ch),
                wa_attended_at: aiReplyIso,
              },
            })
            .eq('id', t.id);
        }
      }
    }
  }
  return json({ ok: true, path: stored.path });
}

async function handleRetryMedia(supabase: any, caller: Caller, payload: any): Promise<Response> {
  const id = String(payload?.wa_message_row_id || '');
  if (!id) return json({ ok: false, error: 'missing wa_message_row_id' }, 400);
  const { data: row } = await supabase.from('whatsapp_messages').select('id, ticket_id, raw_message').eq('id', id).maybeSingle();
  if (!row || !(await ticketVisibleTo(caller, row.ticket_id))) return json({ ok: false, error: 'No permitido' }, 403);
  if (!row.raw_message) return json({ ok: false, error: 'Este archivo ya no se puede volver a descargar' }, 409);
  await supabase.from('whatsapp_messages').update({ media_status: 'pending', media_attempts: 0, media_error: null }).eq('id', id);
  return json({ ok: true });
}

async function handleRetryOutbox(supabase: any, caller: Caller, payload: any): Promise<Response> {
  const outboxId = String(payload?.outbox_id || '').trim();
  const commentId = String(payload?.comment_id || '').trim();
  const ticketId = String(payload?.ticket_id || '').trim();
  if (!outboxId && !commentId) return json({ ok: false, error: 'Falta outbox_id o comment_id' }, 400);

  // Verify WhatsApp connection is open before re-queuing
  const [wdState, healState] = await Promise.all([
    getBridgeState(supabase, 'evo_watchdog'),
    getBridgeState(supabase, 'evo_heal'),
  ]);
  const wdTs = wdState?.checked_at ? new Date(wdState.checked_at).getTime() : 0;
  const healTs = healState?.completed_at ? new Date(healState.completed_at).getTime() : 0;
  const effectiveConnState = healTs >= wdTs
    ? (healState?.connection_after || wdState?.connection_state || null)
    : (wdState?.connection_state || healState?.connection_after || null);
  if (effectiveConnState && effectiveConnState !== 'open') {
    return json(
      {
        ok: false,
        disconnected: true,
        error: 'WhatsApp (+503 7971-8911) está desconectado. Conecta la sesión antes de reenviar.',
      },
      503,
    );
  }

  let obQuery = supabase
    .from('whatsapp_outbox')
    .select('id, company_id, ticket_id, comment_id, status, error')
    .eq('company_id', caller.companyId);
  if (outboxId) {
    obQuery = obQuery.eq('id', outboxId);
  } else {
    obQuery = obQuery.eq('comment_id', commentId).order('created_at', { ascending: false }).limit(1);
  }
  const { data: ob, error: obErr } = await obQuery.maybeSingle();
  if (obErr) return json({ ok: false, error: obErr.message }, 500);
  if (!ob) return json({ ok: false, error: 'No se encontró el envío en cola para reintentar' }, 404);

  const checkTicketId = ob.ticket_id || ticketId;
  if (checkTicketId && !(await ticketVisibleTo(caller, checkTicketId))) {
    return json({ ok: false, error: 'No tienes acceso a este chat' }, 403);
  }

  if (ob.status === 'sent') return json({ ok: true, already_sent: true, outbox_id: ob.id, comment_id: ob.comment_id, ticket_id: ob.ticket_id });
  if (ob.status === 'pending' || ob.status === 'dispatched') {
    return json({ ok: true, already_queued: true, outbox_id: ob.id, comment_id: ob.comment_id, ticket_id: ob.ticket_id });
  }
  if (ob.status !== 'error') return json({ ok: false, error: 'El mensaje no está en estado de error' }, 409);

  if (/exists"?\s*:\s*false/i.test(String(ob.error || '')) && payload?.force !== true) {
    return json({ ok: false, non_whatsapp: true, error: 'Este número no tiene cuenta de WhatsApp activa.' }, 422);
  }

  const { error: upErr } = await supabase
    .from('whatsapp_outbox')
    .update({ status: 'pending', error: null, dispatched_at: null, acked_at: null })
    .eq('id', ob.id)
    .eq('status', 'error');
  if (upErr) return json({ ok: false, error: upErr.message }, 500);

  return json({ ok: true, outbox_id: ob.id, comment_id: ob.comment_id, ticket_id: ob.ticket_id, status: 'pending' });
}

async function handleSyncGroup(supabase: any, url: URL, payload: any): Promise<Response> {
  const ticketId = url.searchParams.get('ticket_id') || payload?.ticket_id;
  const g = payload?.data || payload || {};
  const subject = String(g?.subject || g?.groupMetadata?.subject || '').trim();
  if (!ticketId) return json({ ok: false, error: 'missing ticket_id' }, 400);
  const { data: t } = await supabase.from('tickets').select('id, company_id, metadata').eq('id', ticketId).maybeSingle();
  if (!t) return json({ ok: false, error: 'ticket not found' }, 404);
  const m = t.metadata || {};
  const jid = String(g?.id || m.whatsapp_jid || '');
  if (subject) {
    await supabase
      .from('tickets')
      .update({ lead_name: subject, metadata: { ...cleanMeta(m), is_group: true, whatsapp_group_subject: subject, group_subject_synced: true } })
      .eq('id', ticketId);
  }
  if (jid.endsWith('@g.us')) {
    await upsertGroup(supabase, t.company_id, jid, {
      subject: subject || null,
      ...(Array.isArray(g?.participants) ? { participants: normalizeParticipants(g.participants) } : {}),
    });
  }
  return json({ ok: true, subject });
}

async function handleSyncAllGroups(supabase: any, url: URL, payload: any): Promise<Response> {
  const list: any[] = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.groups) ? payload.groups : [];
  const companyId = await resolveMainCompanyId(supabase, url.searchParams.get('company_id'));
  if (!companyId) return json({ ok: false, error: 'No company' }, 400);
  if (list.length === 0) {
    await setBridgeState(supabase, 'groups_sync', {
      ...(await getBridgeState(supabase, 'groups_sync')),
      last_error: JSON.stringify(payload || {}).slice(0, 300),
      last_error_at: new Date().toISOString(),
    });
    return json({ ok: false, error: 'empty group list' });
  }
  let n = 0;
  for (const g of list) {
    const jid = String(g?.id || '');
    if (!jid.endsWith('@g.us')) continue;
    await upsertGroup(supabase, companyId, jid, {
      subject: String(g?.subject || '').trim() || null,
      participants: normalizeParticipants(g?.participants || []),
    });
    n++;
  }
  await setBridgeState(supabase, 'groups_sync', {
    ...(await getBridgeState(supabase, 'groups_sync')),
    synced_at: new Date().toISOString(),
    groups: n,
    last_error: null,
  });
  // Group membership changed => re-check every 1-on-1 chat (a group member is never a lead).
  let rescoped: any = null;
  try {
    rescoped = await rescopeChats(supabase, companyId);
    await setBridgeState(supabase, 'rescope', { at: new Date().toISOString(), checked: rescoped.checked, changed: rescoped.changed.slice(0, 50) });
  } catch (e) {
    console.error('[wa] rescope after group sync error', e);
  }
  return json({ ok: true, groups: n, rescoped: rescoped?.changed?.length || 0 });
}

// Import media (photos, documents, audio, video) from a chat's history in Evolution.
// Only media messages are imported: text history already exists as chat lines.
// Each media message is linked to its existing placeholder line ("[Imagen enviada…]")
// when found; otherwise a new chat line is added at the original time.
async function handleImportHistory(supabase: any, url: URL, payload: any): Promise<Response> {
  const hi = await getBridgeState(supabase, 'history_import');
  const token = shellSafe(url.searchParams.get('token') || '');
  if (!hi.token || token !== hi.token) return json({ ok: false, error: 'invalid token' }, 401);
  const idx = Number(url.searchParams.get('i'));
  const item = Array.isArray(hi.queue) ? hi.queue[idx] : null;
  if (!item) return json({ ok: false, error: 'unknown chat' }, 400);
  const records: any[] = payload?.messages?.records || payload?.records || (Array.isArray(payload) ? payload : []);
  if (records.length === 0) return json({ ok: true, imported: 0 });

  const companyId = await resolveMainCompanyId(supabase, url.searchParams.get('company_id'));
  if (!companyId) return json({ ok: false, error: 'No company' }, 400);
  const ticketJid: string = item.t;
  const isGroup = ticketJid.endsWith('@g.us');

  const { data: tks } = await supabase
    .from('tickets')
    .select('id, created_at, metadata')
    .eq('company_id', companyId)
    .eq('metadata->>source', 'whatsapp_evolution')
    .eq('metadata->>whatsapp_jid', ticketJid)
    .order('created_at', { ascending: true });
  const tickets = (tks || []).filter((t: any) => !t.metadata?.merged_into);
  if (tickets.length === 0) return json({ ok: true, imported: 0, reason: 'no conversation' });
  const ticketIds = tickets.map((t: any) => t.id);
  const team = await loadTeam(supabase, companyId);

  let imported = 0;
  for (const rec of records) {
    const key = rec?.key || {};
    const waId = String(key.id || rec?.id || '').trim();
    if (!waId) continue;
    const msgObj = unwrapMessage(rec?.message || {});
    const media = extractMedia(msgObj);
    if (!media) continue;

    const { data: exists } = await supabase
      .from('whatsapp_messages')
      .select('id')
      .eq('company_id', companyId)
      .eq('wa_message_id', waId)
      .maybeSingle();
    if (exists) continue;

    const ts = messageDate(rec);
    const fromMe = Boolean(key.fromMe);
    const pushName = String(rec?.pushName || '').trim();
    const caption = extractText(msgObj, rec?.message || {}, {});
    const placeholder = mediaPlaceholder(media.kind, media.obj);

    // Conversation (ticket) that was open at that time.
    const target = [...tickets].reverse().find((t: any) => new Date(t.created_at).getTime() <= ts.getTime() + 60 * 1000) || tickets[0];

    // Existing placeholder line within ±3 minutes, not yet linked to a file.
    const fromIso = new Date(ts.getTime() - 3 * 60 * 1000).toISOString();
    const toIso = new Date(ts.getTime() + 3 * 60 * 1000).toISOString();
    const { data: near } = await supabase
      .from('ticket_comments')
      .select('id, ticket_id, body, created_at')
      .in('ticket_id', ticketIds)
      .gte('created_at', fromIso)
      .lte('created_at', toIso);
    const candidates = (near || []).filter((c: any) =>
      /\[(Imagen|Video|Sticker|Nota de voz|Audio|Documento|Archivo)|AUDIO_URL|📎|📷|🎤|🎥/i.test(String(c.body || ''))
    );
    let commentId: string | null = null;
    let commentTicket: string = target.id;
    if (candidates.length > 0) {
      const ids = candidates.map((c: any) => c.id);
      const { data: linked } = await supabase.from('whatsapp_messages').select('comment_id').in('comment_id', ids);
      const linkedSet = new Set((linked || []).map((l: any) => l.comment_id));
      const free = candidates
        .filter((c: any) => !linkedSet.has(c.id))
        .sort((a: any, b: any) => Math.abs(new Date(a.created_at).getTime() - ts.getTime()) - Math.abs(new Date(b.created_at).getTime() - ts.getTime()));
      if (free[0]) {
        commentId = free[0].id;
        commentTicket = free[0].ticket_id;
      }
    }

    if (!commentId) {
      const staff = fromMe || !isGroup ? null : matchStaffByName(team, pushName);
      const senderLabel = fromMe || staff ? `👨‍💻 ${staff?.full_name || 'Equipo Soporte'}` : `👤 ${pushName || 'Cliente'}`;
      const text = caption ? `${placeholder} ${caption}` : placeholder;
      const { data: c } = await supabase
        .from('ticket_comments')
        .insert({
          ticket_id: target.id,
          company_id: companyId,
          author_id: null,
          body: `[${fmtTime(ts)}] ${senderLabel}: ${text}`,
          is_internal: false,
          created_at: ts.toISOString(),
        })
        .select('id')
        .single();
      commentId = c?.id || null;
      commentTicket = target.id;
    }
    if (!commentId) continue;

    const senderJid = isGroup ? String(key.participantAlt || key.participant || '') : String(key.remoteJidAlt || key.remoteJid || '');
    const { error: insErr } = await supabase.from('whatsapp_messages').insert({
      company_id: companyId,
      ticket_id: commentTicket,
      comment_id: commentId,
      wa_message_id: waId,
      remote_jid: ticketJid,
      from_me: fromMe,
      sender_phone: jidPhone(senderJid) || null,
      sender_name: pushName || null,
      message_ts: ts.toISOString(),
      message_type: media.kind,
      body: caption || placeholder,
      media_status: 'pending',
      media_mime: media.obj?.mimetype || null,
      media_filename: media.obj?.fileName || null,
      media_size: Number(media.obj?.fileLength?.low ?? media.obj?.fileLength) || null,
      raw_message: { key, message: { [media.field]: slimMediaObject(media.obj) } },
    });
    if (!insErr) imported++;
  }
  return json({ ok: true, imported });
}

function fromB64Json(b64: unknown): any {
  const s = String(b64 || '').replace(/\s/g, '');
  if (!s) return null;
  try {
    const txt = new TextDecoder().decode(decodeBase64(s));
    try {
      return JSON.parse(txt);
    } catch {
      return txt;
    }
  } catch {
    return null;
  }
}

async function handleReportEvoHeal(supabase: any, url: URL, payload: any): Promise<Response> {
  const heal = await getBridgeState(supabase, 'evo_heal');
  const token = shellSafe(url.searchParams.get('token') || '');
  if (!heal.token || token !== heal.token) return json({ ok: false, error: 'invalid token' }, 401);

  const evoInfo = fromB64Json(payload?.evo_info);
  const stateBefore = fromB64Json(payload?.state_before);
  const webhookCfg = fromB64Json(payload?.webhook);
  const restartRes = fromB64Json(payload?.restart);
  const stateAfter = fromB64Json(payload?.state_after);
  const nowIso = new Date().toISOString();

  const connAfter = String(stateAfter?.instance?.state || stateAfter?.state || 'unknown');
  const whEnabled = webhookCfg?.enabled ?? webhookCfg?.webhook?.enabled;

  await setBridgeState(supabase, 'evo_heal', {
    ...heal,
    status: 'done',
    completed_at: nowIso,
    evo_info: evoInfo || heal.evo_info || null,
    connection_before: stateBefore?.instance?.state || stateBefore?.state || stateBefore,
    connection_after: connAfter,
    state_before: stateBefore,
    webhook: webhookCfg,
    restart: restartRes,
    state_after: stateAfter,
  });

  // If webhook was disabled on Evolution API, automatically re-enable it once.
  if (whEnabled === false && !heal.restore_attempted) {
    await setBridgeState(supabase, 'evo_heal', {
      status: 'requested',
      mode: 'restore_webhook',
      restore_attempted: true,
      since: heal.since || null,
      requested_at: nowIso,
    });
    return json({ ok: true, action: 'scheduled_restore_webhook' });
  }

  // Start catchup at page 1 with messageTimestamp.gte; handleCatchupMessages auto-adapts to pagination order.
  if (String(heal.mode || 'restart_and_catchup') !== 'check_only') {
    const catchupSince = heal.since || new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString();
    await setBridgeState(supabase, 'message_catchup', {
      status: 'running',
      token: crypto.randomUUID().replace(/-/g, ''),
      page: 1,
      end_page: 1,
      step: 1,
      no_ts_filter: false,
      jumped: false,
      offset: 80,
      since: catchupSince,
      not_before: new Date(Date.now() + 4000).toISOString(),
      inflight_at: null,
      pages_done: 0,
      imported_total: 0,
      started_at: nowIso,
    });
  }

  return json({ ok: true, connection_after: connAfter });
}

async function handleCatchupMessages(supabase: any, url: URL, payload: any): Promise<Response> {
  const mc = await getBridgeState(supabase, 'message_catchup');
  const token = shellSafe(url.searchParams.get('token') || '');
  if (!mc.token || token !== mc.token) return json({ ok: false, error: 'invalid token' }, 401);
  const page = Number(url.searchParams.get('page') || 0);
  if (mc.status !== 'running' || page !== Number(mc.page)) {
    return json({ ok: true, skipped: true });
  }

  const companyId = await resolveMainCompanyId(supabase, url.searchParams.get('company_id'));
  if (!companyId) return json({ ok: false, error: 'No company' }, 400);
  const { instance } = await evolutionCredentials(supabase);
  const sinceMs = mc.since ? new Date(mc.since).getTime() : Date.now() - 14 * 60 * 60 * 1000;

  const totalPages = Number(payload?.messages?.pages || payload?.pages || 1);
  const totalRecords = Number(payload?.messages?.total || payload?.total || 0);
  const records: any[] = payload?.messages?.records || payload?.records || (Array.isArray(payload) ? payload : []);

  const firstTs = records.length > 0 ? messageDate(records[0]).toISOString() : null;
  const lastTs = records.length > 0 ? messageDate(records[records.length - 1]).toISOString() : null;

  // Auto-adapt on first probe if Evolution ignored where.messageTimestamp.gte or returned newest-first across >1 pages.
  if (!mc.jumped && page === 1) {
    // Case A: Evolution returned an error on messageTimestamp.gte (records empty & error present) -> retry without ts filter on tail pages.
    if (records.length === 0 && (payload?.error || payload?.status >= 400) && !mc.no_ts_filter) {
      await setBridgeState(supabase, 'message_catchup', {
        ...mc,
        no_ts_filter: true,
        jumped: false,
        page: 1,
        inflight_at: null,
        probe_error: payload?.message || payload?.error,
      });
      return json({ ok: true, action: 'fallback_no_ts_filter' });
    }
    // Case B: Oldest-first pagination across whole history (page 1 has ancient records < sinceMs and totalPages > 1).
    if (records.length > 0 && totalPages > 1 && messageDate(records[records.length - 1]).getTime() < sinceMs && messageDate(records[0]).getTime() < sinceMs) {
      const startTail = Math.max(1, totalPages - 4);
      await setBridgeState(supabase, 'message_catchup', {
        ...mc,
        jumped: true,
        page: startTail,
        end_page: totalPages,
        step: 1,
        inflight_at: null,
        total_pages: totalPages,
        total_records: totalRecords,
      });
      return json({ ok: true, action: 'jump_to_tail', start_page: startTail, end_page: totalPages });
    }
    // Case C: Filtered query succeeded and has multiple pages.
    if (totalPages > 1 && records.length > 1) {
      const isDescending = messageDate(records[0]).getTime() > messageDate(records[records.length - 1]).getTime();
      if (isDescending) {
        const startDesc = Math.min(totalPages, 6);
        await setBridgeState(supabase, 'message_catchup', {
          ...mc,
          jumped: true,
          page: startDesc,
          end_page: 1,
          step: -1,
          inflight_at: null,
          total_pages: totalPages,
          total_records: totalRecords,
        });
        return json({ ok: true, action: 'jump_to_oldest_filtered_page', start_page: startDesc });
      } else {
        await setBridgeState(supabase, 'message_catchup', {
          ...mc,
          jumped: true,
          page: 1,
          end_page: Math.min(totalPages, 8),
          step: 1,
          inflight_at: null,
          total_pages: totalPages,
          total_records: totalRecords,
        });
        // Fall through to process page 1 right now since page 1 IS the oldest filtered page!
        mc.jumped = true;
        mc.end_page = Math.min(totalPages, 8);
        mc.step = 1;
      }
    } else {
      mc.jumped = true;
      mc.end_page = 1;
      mc.step = 1;
    }
  }

  const candidates = records
    .filter((rec) => {
      const key = rec?.key || {};
      const jid = String(key.remoteJid || rec?.remoteJid || '');
      if (!jid || jid === 'status@broadcast' || jid.endsWith('@newsletter')) return false;
      return messageDate(rec).getTime() >= sinceMs;
    })
    .sort((a, b) => messageDate(a).getTime() - messageDate(b).getTime());

  let imported = 0;
  const samples: string[] = [];
  if (candidates.length > 0) {
    const waIds = candidates
      .map((r) => String(r?.key?.id || r?.id || '').trim())
      .filter(Boolean);
    const existingSet = new Set<string>();
    if (waIds.length > 0) {
      const { data: ex } = await supabase
        .from('whatsapp_messages')
        .select('wa_message_id')
        .eq('company_id', companyId)
        .in('wa_message_id', waIds);
      for (const row of ex || []) {
        if (row.wa_message_id) existingSet.add(String(row.wa_message_id));
      }
    }

    const missing = candidates.filter((r) => {
      const id = String(r?.key?.id || r?.id || '').trim();
      return !id || !existingSet.has(id);
    });

    if (missing.length > 0) {
      const team = await loadTeam(supabase, companyId);
      for (const rec of missing) {
        try {
          const res = await ingestWhatsAppEntry(supabase, companyId, instance, rec, payload, payload, {
            isCatchup: true,
            teamCache: team,
          });
          if (res?.ok && !res?.ignored) {
            imported++;
            if (samples.length < 15) {
              samples.push(`${rec?.key?.remoteJid || ''}@${messageDate(rec).toISOString()}`);
            }
          }
        } catch (err) {
          console.error('[wa] catchup ingest error:', err);
        }
      }
    }
  }

  const stepDir = Number(mc.step || 1);
  const endPage = Number(mc.end_page || 1);
  const nextPage = page + stepDir;
  const isDone = stepDir > 0 ? nextPage > endPage : nextPage < endPage;
  const prevSamples: string[] = Array.isArray(mc.samples) ? mc.samples : [];

  await setBridgeState(supabase, 'message_catchup', {
    ...mc,
    page: isDone ? 0 : nextPage,
    inflight_at: null,
    pages_done: Number(mc.pages_done || 0) + 1,
    imported_total: Number(mc.imported_total || 0) + imported,
    samples: [...prevSamples, ...samples].slice(-30),
    total_pages: totalPages,
    total_records: totalRecords,
    last_page_records: records.length,
    last_page_candidates: candidates.length,
    sample_first_ts: firstTs,
    sample_last_ts: lastTs,
    ...(isDone ? { status: 'done', finished_at: new Date().toISOString() } : {}),
  });

  return json({ ok: true, page, imported, next_page: isDone ? 0 : nextPage });
}

async function handleWatchdogCheck(supabase: any, url: URL, payload: any): Promise<Response> {
  const wd = await getBridgeState(supabase, 'evo_watchdog');
  const token = shellSafe(url.searchParams.get('token') || '');
  if (!wd.token || token !== wd.token) return json({ ok: false, error: 'invalid token' }, 401);

  const stateObj = fromB64Json(payload?.state);
  const msgPayload = fromB64Json(payload?.messages);
  const connState = String(stateObj?.instance?.state || stateObj?.state || 'unknown');
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const companyId = await resolveMainCompanyId(supabase, null);
  const { instance } = await evolutionCredentials(supabase);
  const totalPages = Number(msgPayload?.messages?.pages || msgPayload?.pages || 0);
  const records: any[] = msgPayload?.messages?.records || msgPayload?.records || (Array.isArray(msgPayload) ? msgPayload : []);
  const noTsFilter =
    Boolean(wd.no_ts_filter) ||
    (records.length === 0 && Boolean(msgPayload?.error || msgPayload?.status >= 400)) ||
    (records.length > 0 && totalPages > 5 && messageDate(records[records.length - 1]).getTime() < now - 7 * 24 * 3600 * 1000);

  let recovered = 0;
  const newestEvoTs = records.length > 0
    ? new Date(Math.max(...records.map((r) => messageDate(r).getTime()))).toISOString()
    : null;

  if (companyId && records.length > 0) {
    const windowStart = now - 12 * 60 * 60 * 1000;
    const windowEnd = now - 12 * 1000; // give live webhooks 12s before considering a message missed
    const candidates = records
      .filter((rec) => {
        const key = rec?.key || {};
        const jid = String(key.remoteJid || rec?.remoteJid || '');
        if (!jid || jid === 'status@broadcast' || jid.endsWith('@newsletter')) return false;
        const ts = messageDate(rec).getTime();
        return ts >= windowStart && ts <= windowEnd;
      })
      .sort((a, b) => messageDate(a).getTime() - messageDate(b).getTime());

    if (candidates.length > 0) {
      const waIds = candidates.map((r) => String(r?.key?.id || r?.id || '').trim()).filter(Boolean);
      const existingSet = new Set<string>();
      if (waIds.length > 0) {
        const { data: ex } = await supabase
          .from('whatsapp_messages')
          .select('wa_message_id')
          .eq('company_id', companyId)
          .in('wa_message_id', waIds);
        for (const row of ex || []) {
          if (row.wa_message_id) existingSet.add(String(row.wa_message_id));
        }
      }
      const missing = candidates.filter((r) => {
        const id = String(r?.key?.id || r?.id || '').trim();
        return !id || !existingSet.has(id);
      });
      if (missing.length > 0) {
        const team = await loadTeam(supabase, companyId);
        for (const rec of missing) {
          try {
            const res = await ingestWhatsAppEntry(supabase, companyId, instance, rec, msgPayload, msgPayload, {
              isCatchup: true,
              teamCache: team,
            });
            if (res?.ok && !res?.ignored) recovered++;
          } catch (err) {
            console.error('[wa] watchdog ingest error:', err);
          }
        }
      }
    }
  }

  const baileysUnpatched = String(payload?.baileys_unpatched || '0') === '1';
  const curHeal = await getBridgeState(supabase, 'evo_heal');
  const curHealAt = curHeal?.completed_at ? new Date(curHeal.completed_at).getTime() : 0;
  const recentQrWaiting =
    connState !== 'open' &&
    curHealAt > 0 &&
    now - curHealAt < 30 * 60 * 1000 &&
    Boolean(
      curHeal?.restart?.base64 ||
      curHeal?.restart?.code ||
      curHeal?.restart?.qrcode?.base64 ||
      curHeal?.restart?.pairingCode,
    );
  const lastAutoHealMs = wd.last_auto_heal_at ? new Date(wd.last_auto_heal_at).getTime() : 0;
  const canAutoHeal = now - lastAutoHealMs > 15 * 60 * 1000;
  let autoHealTriggered = false;
  if (baileysUnpatched) {
    await setBridgeState(supabase, 'evo_heal', {
      status: 'requested',
      mode: 'sync_baileys_recv',
      reason: 'watchdog_baileys_status_unpatched',
      requested_at: nowIso,
    });
    autoHealTriggered = true;
  } else if (canAutoHeal && !recentQrWaiting && (recovered >= 3 || connState === 'connecting' || connState === 'close')) {
    await setBridgeState(supabase, 'evo_heal', {
      status: 'requested',
      mode: 'restart_and_catchup',
      reason:
        recovered >= 3
          ? `watchdog_recovered_${recovered}`
          : connState === 'close'
          ? 'watchdog_connection_closed'
          : 'watchdog_connecting_stuck',
      requested_at: nowIso,
    });
    autoHealTriggered = true;
  }

  await setBridgeState(supabase, 'evo_watchdog', {
    ...wd,
    checked_at: nowIso,
    connection_state: connState,
    baileys_shield_ok: !baileysUnpatched,
    no_ts_filter: noTsFilter,
    last_total_pages: totalPages || wd.last_total_pages || 0,
    newest_evo_ts: newestEvoTs,
    recovered_last_run: recovered,
    recovered_total: Number(wd.recovered_total || 0) + recovered,
    ...(autoHealTriggered ? { last_auto_heal_at: nowIso } : {}),
  });

  return json({ ok: true, connection_state: connState, recovered, auto_heal: autoHealTriggered });
}

function capExternalReadBy(rawMap: unknown, maxUsers = 25): Record<string, string> {
  if (!rawMap || typeof rawMap !== 'object' || Array.isArray(rawMap)) return {};
  const entries = Object.entries(rawMap as Record<string, unknown>)
    .map(([k, v]) => [String(k).trim(), String(v || '').trim()] as const)
    .filter(([k, v]) => Boolean(k) && Boolean(v))
    .sort((a, b) => Date.parse(b[1] || '') - Date.parse(a[1] || ''));
  const waEntry = entries.find(([k]) => k === '__whatsapp__');
  const sliced = entries.slice(0, maxUsers);
  if (waEntry && !sliced.some(([k]) => k === '__whatsapp__')) {
    sliced[sliced.length - 1] = waEntry;
  }
  return Object.fromEntries(sliced);
}

async function handleAckWebhookEvents(supabase: any, url: URL, payload: any): Promise<Response> {
  const whSync = await getBridgeState(supabase, 'webhook_events_sync');
  const token = shellSafe(url.searchParams.get('token') || '');
  if (!whSync.token || token !== whSync.token) {
    return json({ ok: false, error: 'invalid token' }, 401);
  }
  const webhookCfg = fromB64Json(payload?.webhook);
  const hasChatsUpdate = JSON.stringify(webhookCfg || {}).toUpperCase().includes('CHATS_UPDATE');
  const nowIso = new Date().toISOString();
  await setBridgeState(supabase, 'webhook_events_sync', {
    ...whSync,
    ...(hasChatsUpdate ? { version: whSync.target_version || '2026-11-20-chats-update', synced_at: nowIso } : {}),
    last_ack_at: nowIso,
    webhook: webhookCfg,
  });
  return json({ ok: true, has_chats_update: hasChatsUpdate });
}

async function handleChatsUpdate(supabase: any, companyId: string, payload: any): Promise<Response> {
  const updates = extractChatReadUpdates(payload).slice(0, 30);
  if (updates.length === 0) {
    return json({ ok: true, ignored: true, reason: 'no chat read updates' });
  }

  let updated = 0;
  for (const upd of updates) {
    if (upd.unreadCount !== 0 && upd.unreadCount !== -1) continue;
    const isGroup = upd.jid.endsWith('@g.us');
    const phone = isGroup ? '' : jidPhone(upd.altJid) || jidPhone(upd.jid);
    const lid = isGroup ? '' : jidLid(upd.jid) || jidLid(upd.altJid);
    const canonicalJid = isGroup ? upd.jid : phone ? `${phone}@s.whatsapp.net` : upd.jid;

    const { data: primaryRows } = await supabase
      .from('tickets')
      .select('id, status, metadata, updated_at, created_at')
      .eq('company_id', companyId)
      .eq('metadata->>source', 'whatsapp_evolution')
      .eq('metadata->>whatsapp_jid', canonicalJid)
      .order('created_at', { ascending: false })
      .limit(5);

    let rows = (primaryRows || []) as any[];
    if (rows.length === 0 && !isGroup && upd.jid !== canonicalJid) {
      const { data: legacyRows } = await supabase
        .from('tickets')
        .select('id, status, metadata, updated_at, created_at')
        .eq('company_id', companyId)
        .eq('metadata->>source', 'whatsapp_evolution')
        .eq('metadata->>whatsapp_jid', upd.jid)
        .order('created_at', { ascending: false })
        .limit(5);
      rows = (legacyRows || []) as any[];
    }
    if (rows.length === 0 && !isGroup && phone.length >= 8) {
      const { data: phoneRows } = await supabase
        .from('tickets')
        .select('id, status, metadata, updated_at, created_at')
        .eq('company_id', companyId)
        .eq('metadata->>source', 'whatsapp_evolution')
        .eq('metadata->>whatsapp_phone', phone)
        .order('created_at', { ascending: false })
        .limit(5);
      rows = (phoneRows || []) as any[];
    }
    if (rows.length === 0 && !isGroup && lid) {
      const { data: lidRows } = await supabase
        .from('tickets')
        .select('id, status, metadata, updated_at, created_at')
        .eq('company_id', companyId)
        .eq('metadata->>source', 'whatsapp_evolution')
        .eq('metadata->>whatsapp_lid', lid)
        .order('created_at', { ascending: false })
        .limit(5);
      rows = (lidRows || []) as any[];
    }
    if (rows.length === 0) continue;

    const ticket = rows.find((t) => ['new', 'open', 'pending'].includes(t.status)) || rows[0];
    const meta = cleanMeta(ticket.metadata || {});
    const rawReadBy =
      meta.wa_read_by && typeof meta.wa_read_by === 'object' && !Array.isArray(meta.wa_read_by)
        ? { ...meta.wa_read_by }
        : {};

    if (upd.unreadCount === 0) {
      const readAt = String(meta.last_whatsapp_at || ticket.updated_at || ticket.created_at || new Date().toISOString());
      if (rawReadBy.__whatsapp__ === readAt) continue;
      rawReadBy.__whatsapp__ = readAt;
      const capped = capExternalReadBy(rawReadBy, 25);
      const { error: updErr } = await supabase
        .from('tickets')
        .update({ metadata: { ...meta, wa_read_by: capped } })
        .eq('id', ticket.id);
      if (!updErr) updated++;
    } else if (upd.unreadCount === -1 && rawReadBy.__whatsapp__) {
      delete rawReadBy.__whatsapp__;
      const nextMeta: Record<string, any> = { ...meta };
      if (Object.keys(rawReadBy).length > 0) {
        nextMeta.wa_read_by = capExternalReadBy(rawReadBy, 25);
      } else {
        delete nextMeta.wa_read_by;
      }
      const { error: updErr } = await supabase
        .from('tickets')
        .update({ metadata: nextMeta })
        .eq('id', ticket.id);
      if (!updErr) updated++;
    }
  }

  await setBridgeState(supabase, 'last_webhook_in', { at: new Date().toISOString() });
  return json({ ok: true, processed: updates.length, updated });
}

// =============================================================================
// UI actions
// =============================================================================

async function handleGetAiConfig(supabase: any, caller?: Caller | null, payload?: any): Promise<Response> {
  const companyId = String(payload?.company_id || caller?.companyId || '');
  const aiCfg = await loadSupportAiConfig(supabase, companyId || null);
  let verified = false;
  let model = 'gpt-4o-mini';
  let err = '';
  if (aiCfg.openAiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aiCfg.openAiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 8, messages: [{ role: 'user', content: 'Responde OK' }] }),
      });
      if (res.ok) {
        const j = await res.json();
        verified = true;
        model = j?.model || model;
      } else err = `HTTP ${res.status}`;
    } catch (e: any) {
      err = e?.message || 'Network error';
    }
  } else err = 'No OpenAI API Key found';
  return json({
    ok: true,
    openai_verified: verified,
    openai_model: model,
    openai_error: err,
    auto_reply_text: aiCfg.autoReplyText,
    auto_reply_audio: aiCfg.autoReplyAudio,
    auto_reply_resolved_enabled: aiCfg.autoReplyResolvedEnabled,
    auto_resolved_mark_lost: aiCfg.autoResolvedMarkLost,
    resolved_reply_template: aiCfg.resolvedReplyTemplate,
    resolved_trigger_phrases: aiCfg.resolvedTriggerPhrases,
    prompts: aiCfg.prompts,
  });
}

async function handleSaveAiConfig(supabase: any, caller: Caller | null, payload: any): Promise<Response> {
  const companyId = String(payload?.company_id || caller?.companyId || '');
  const aiCfg = await loadSupportAiConfig(supabase, companyId || null);
  const rawPhrases = payload?.resolved_trigger_phrases;
  const resolvedTriggerPhrases = Array.isArray(rawPhrases)
    ? rawPhrases.map((p: any) => String(p || '').trim()).filter(Boolean)
    : typeof rawPhrases === 'string' && rawPhrases.trim()
    ? rawPhrases
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
    : aiCfg.resolvedTriggerPhrases;

  const cfg = {
    auto_reply_text: payload?.auto_reply_text !== undefined ? Boolean(payload.auto_reply_text) : aiCfg.autoReplyText,
    auto_reply_audio:
      payload?.auto_reply_audio !== undefined
        ? Boolean(payload.auto_reply_audio)
        : payload?.ai_auto_reply_enabled !== undefined
        ? Boolean(payload.ai_auto_reply_enabled)
        : aiCfg.autoReplyAudio,
    auto_reply_resolved_enabled:
      payload?.auto_reply_resolved_enabled !== undefined
        ? Boolean(payload.auto_reply_resolved_enabled)
        : aiCfg.autoReplyResolvedEnabled,
    auto_resolved_mark_lost:
      payload?.auto_resolved_mark_lost !== undefined
        ? Boolean(payload.auto_resolved_mark_lost)
        : aiCfg.autoResolvedMarkLost,
    resolved_reply_template: String(payload?.resolved_reply_template || aiCfg.resolvedReplyTemplate).trim(),
    resolved_trigger_phrases: resolvedTriggerPhrases.length > 0 ? resolvedTriggerPhrases : DEFAULT_RESOLVED_TRIGGER_PHRASES,
    prompt_soporte: String(payload?.prompts?.soporte || payload?.ai_voice_prompt || aiCfg.prompts.soporte).trim(),
    prompt_contabilidad: String(payload?.prompts?.contabilidad || aiCfg.prompts.contabilidad).trim(),
    prompt_ventas: String(payload?.prompts?.ventas || aiCfg.prompts.ventas).trim(),
    prompt_otros: String(payload?.prompts?.otros || aiCfg.prompts.otros).trim(),
    updated_at: new Date().toISOString(),
  };
  if (companyId) {
    await setBridgeState(supabase, `ai_config_${companyId}`, cfg);
  }
  if (aiCfg.integrationId) {
    await supabase
      .from('marketing_integrations')
      .update({ settings: { ...aiCfg.rawSettings, support_ai_config: cfg } })
      .eq('id', aiCfg.integrationId);
  }
  return json({ ok: true, config: cfg });
}

async function handleGetWaTeamAccess(supabase: any, caller: Caller, payload: any): Promise<Response> {
  const companyId = String(payload?.company_id || caller.companyId || '');
  if (!companyId) return json({ ok: false, error: 'Missing company_id' }, 400);

  const [{ data: profs }, { data: roles }, { data: rolePerms }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, role, custom_role_id, status, is_active, is_platform_owner, permissions')
      .eq('company_id', companyId)
      .order('full_name', { ascending: true }),
    supabase.from('custom_roles').select('id, name, base_role').eq('company_id', companyId),
    supabase
      .from('role_permissions')
      .select('role_id, permission_key, is_enabled')
      .eq('is_enabled', true)
      .in('permission_key', ['wa_chat_all', 'wa_chat_soporte', 'wa_chat_leads']),
  ]);

  const roleNameMap = new Map<string, string>();
  for (const r of roles || []) roleNameMap.set(r.id, r.name);

  const rolePermMap = new Map<string, Set<string>>();
  for (const rp of rolePerms || []) {
    if (!rolePermMap.has(rp.role_id)) rolePermMap.set(rp.role_id, new Set());
    rolePermMap.get(rp.role_id)!.add(rp.permission_key);
  }

  const members = (profs || [])
    .filter((p: any) => p.is_active !== false && p.status !== 'inactive')
    .map((p: any) => {
      const isSystemAdmin = p.is_platform_owner === true || p.role === 'super_admin' || p.role === 'company_admin';
      const perms = (p.permissions && typeof p.permissions === 'object' ? p.permissions : {}) as Record<string, any>;
      const explicitMode = String(perms.wa_access_mode || '');
      let mode = explicitMode;
      if (!mode) {
        if (isSystemAdmin) mode = 'admin_all';
        else {
          const rPerms = p.custom_role_id ? rolePermMap.get(p.custom_role_id) : undefined;
          const hasAll = Boolean(perms.wa_chat_all) || Boolean(rPerms?.has('wa_chat_all'));
          const hasSoporte = Boolean(perms.wa_chat_soporte) || Boolean(rPerms?.has('wa_chat_soporte'));
          const hasLeads = Boolean(perms.wa_chat_leads) || Boolean(rPerms?.has('wa_chat_leads'));
          if (hasAll) mode = 'admin_all';
          else if (hasSoporte && !hasLeads) mode = perms.wa_soporte_assigned_only ? 'soporte_assigned' : 'soporte_team';
          else if (hasLeads && !hasSoporte) mode = perms.wa_leads_assigned_only ? 'ventas_assigned' : 'ventas_pool';
          else if (hasSoporte && hasLeads) mode = 'admin_all';
          else mode = 'none';
        }
      }
      return {
        id: p.id,
        full_name: p.full_name || p.email || 'Usuario',
        email: p.email || '',
        role: p.role || 'sales_agent',
        role_label: p.custom_role_id ? roleNameMap.get(p.custom_role_id) || p.role : p.role,
        is_system_admin: isSystemAdmin,
        access_mode: mode,
      };
    });

  return json({ ok: true, members });
}

async function handleSetWaUserAccess(supabase: any, caller: Caller, payload: any): Promise<Response> {
  const targetUserId = String(payload?.target_user_id || '');
  const mode = String(payload?.access_mode || '');
  const validModes = ['admin_all', 'soporte_team', 'soporte_assigned', 'ventas_pool', 'ventas_assigned', 'none'];
  if (!targetUserId || !validModes.includes(mode)) {
    return json({ ok: false, error: 'Datos de acceso inválidos' }, 400);
  }

  const { data: targetProf } = await supabase
    .from('profiles')
    .select('id, company_id, custom_role_id, permissions')
    .eq('id', targetUserId)
    .maybeSingle();
  if (!targetProf) return json({ ok: false, error: 'Usuario no encontrado' }, 404);

  const curPerms = (targetProf.permissions && typeof targetProf.permissions === 'object' ? targetProf.permissions : {}) as Record<string, any>;
  const nextPerms: Record<string, any> = {
    ...curPerms,
    wa_access_mode: mode,
    wa_chat_all: mode === 'admin_all',
    wa_chat_soporte: mode === 'admin_all' || mode === 'soporte_team' || mode === 'soporte_assigned',
    wa_chat_leads: mode === 'admin_all' || mode === 'ventas_pool' || mode === 'ventas_assigned',
    wa_soporte_assigned_only: mode === 'soporte_assigned',
    wa_leads_assigned_only: mode === 'ventas_assigned',
  };

  const { error } = await supabase.from('profiles').update({ permissions: nextPerms }).eq('id', targetUserId);
  if (error) return json({ ok: false, error: error.message }, 500);

  return json({ ok: true, target_user_id: targetUserId, access_mode: mode });
}

async function handleSetChannel(supabase: any, caller: Caller, payload: any): Promise<Response> {
  const ticketId = String(payload?.ticket_id || '');
  const ch = String(payload?.support_channel || '') as SupportChannelType;
  if (!ticketId || !['soporte', 'contabilidad', 'otros'].includes(ch)) {
    return json({ ok: false, error: 'Canal inválido' }, 400);
  }
  if (!(await ticketVisibleTo(caller, ticketId))) return json({ ok: false, error: 'No permitido' }, 403);
  const { data: t } = await supabase.from('tickets').select('metadata').eq('id', ticketId).maybeSingle();
  if (!t) return json({ ok: false, error: 'Ticket no encontrado' }, 404);
  if ((t.metadata || {}).wa_scope && t.metadata.wa_scope !== 'soporte') {
    return json({ ok: false, error: 'Solo los chats de Soporte tienen categoría' }, 409);
  }
  const labels: Record<string, string> = {
    soporte: 'Facturación Electrónica / DTE / Soporte',
    contabilidad: 'Contabilidad / IVA / Planillas',
    otros: 'Otros Productos / Información General',
  };
  await supabase
    .from('tickets')
    .update({ updated_at: new Date().toISOString(), metadata: { ...cleanMeta(t.metadata || {}), support_channel: ch, ai_category: labels[ch] } })
    .eq('id', ticketId);
  return json({ ok: true, support_channel: ch });
}

const DRAFT_MODULES = [
  'Facturación DTE',
  'Inventario',
  'Contabilidad',
  'Bancos / Caja',
  'POS / Ventas',
  'Compras',
  'Clientes / CRM',
  'Accesos y Usuarios',
  'Reportes / Exportación',
  'Integraciones / WhatsApp',
  'Rendimiento / Sistema',
  'Soporte General',
];

function mapCategoryTagToModule(tag: string, text: string): string {
  const hay = `${tag} ${text}`.toLowerCase();
  if (/inventar|stock|bodega|kardex|existencia|cantidad|producto/i.test(hay)) return 'Inventario';
  if (/dte|factur|ccf|hacienda|mh|nrc|nit|invalidac|anulac|contingencia|firma|json/i.test(hay)) return 'Facturación DTE';
  if (/contab|partida|libro|iva|balance|planilla|asiento|f07|f14/i.test(hay)) return 'Contabilidad';
  if (/banco|caja|conciliac|cierre|arqueo|cobro|pago|cheque/i.test(hay)) return 'Bancos / Caja';
  if (/pos|punto de venta|venta|ticket|cotizac/i.test(hay)) return 'POS / Ventas';
  if (/compra|proveedor|orden de compra|importac/i.test(hay)) return 'Compras';
  if (/acceso|permiso|usuario|contrase|login|rol|clave/i.test(hay)) return 'Accesos y Usuarios';
  if (/reporte|excel|pdf|export|descarg/i.test(hay)) return 'Reportes / Exportación';
  if (/whatsapp|correo|email|smtp|api|integrac|webhook/i.test(hay)) return 'Integraciones / WhatsApp';
  if (/lento|ca[ií]do|error 500|no carga|pantalla en blanco|servidor/i.test(hay)) return 'Rendimiento / Sistema';
  return 'Soporte General';
}

function cleanInlineProblemHeadline(raw: string): string {
  let s = stripLeadingGreetingForTicketTitle(String(raw || ''))
    .replace(/^\[WhatsApp\s*·[^\]]+\]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > 90) s = `${s.slice(0, 87).trim()}...`;
  return s;
}

async function handleDraftTechnicalTicket(supabase: any, caller: Caller, payload: any): Promise<Response> {
  const ticketId = String(payload?.ticket_id || '');
  if (!ticketId) return json({ ok: false, error: 'Falta ticket_id' }, 400);
  if (!(await ticketVisibleTo(caller, ticketId))) return json({ ok: false, error: 'No tienes acceso a este chat' }, 403);

  const { data: t } = await supabase
    .from('tickets')
    .select('id, company_id, title, lead_name, description, metadata')
    .eq('id', ticketId)
    .maybeSingle();
  if (!t) return json({ ok: false, error: 'Ticket no encontrado' }, 404);

  const [{ data: comments }, { data: cats }, aiCfg] = await Promise.all([
    supabase
      .from('ticket_comments')
      .select('body, author_id, is_internal, created_at')
      .eq('ticket_id', ticketId)
      .eq('is_internal', false)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('ticket_categories')
      .select('id, name')
      .eq('company_id', t.company_id)
      .order('name'),
    loadSupportAiConfig(supabase, t.company_id),
  ]);

  const historyLines = ((comments || []) as any[])
    .reverse()
    .map((c) => String(c.body || '').trim())
    .filter(Boolean);

  // Build clean fallback from recent client messages
  let fallbackMsg = '';
  for (const line of [...historyLines].reverse()) {
    const idx = line.indexOf(': ');
    const msg = idx > 0 ? line.slice(idx + 2).trim() : line;
    const isClientLine = !line.includes('👤') ? line.indexOf('Arias') === -1 : line.includes('👤');
    if (
      msg &&
      isClientLine &&
      !isGreetingOrClosingAgreement(msg) &&
      !/^\[(Imagen|Video|Sticker|Nota de voz|Documento|Archivo)/i.test(msg)
    ) {
      fallbackMsg = msg;
      break;
    }
  }
  if (!fallbackMsg && historyLines.length > 0) {
    const last = historyLines[historyLines.length - 1];
    const idx = last.indexOf(': ');
    fallbackMsg = idx > 0 ? last.slice(idx + 2).trim() : last;
  }

  const cls = classifyIssueCategory(fallbackMsg || String(t.title || ''));
  let moduleName = mapCategoryTagToModule(cls.shortCategoryTag, `${fallbackMsg} ${historyLines.join(' ')}`);
  let problemSummary = cleanInlineProblemHeadline(fallbackMsg) || 'Revisión técnica solicitada por cliente';
  let descriptionSummary = fallbackMsg || `Conversación con ${t.lead_name || 'Cliente'}`;
  let priority: 'low' | 'medium' | 'high' | 'urgent' =
    cls.priority === 'urgent' || cls.priority === 'high' || cls.priority === 'low' ? cls.priority : 'medium';

  const catList = ((cats || []) as Array<{ id: string; name: string }>);
  let matchedCategory =
    catList.find((c) => c.name.toLowerCase().includes(moduleName.split(' ')[0].toLowerCase())) ||
    catList.find((c) => c.name.toLowerCase().includes(cls.shortCategoryTag.toLowerCase())) ||
    null;

  if (aiCfg.openAiKey && historyLines.length > 0) {
    try {
      const catNames = catList.map((c) => c.name).join(', ') || 'Ninguna';
      const promptSystem = [
        'Eres analista senior de Soporte Técnico para un ERP con Facturación Electrónica (DTE), Inventario, Contabilidad y CRM.',
        'A partir de la conversación de WhatsApp del cliente, redacta el borrador de un Ticket Técnico claro y accionable.',
        'Responde ÚNICAMENTE con un objeto JSON válido con estas claves exactas:',
        '{',
        `  "module": "<elige UNO exacto de: ${DRAFT_MODULES.join(' | ')}>",`,
        '  "problem": "<problema técnico concreto en español de 4 a 11 palabras, SIN saludos, SIN nombre del cliente, SIN signos ni emojis. Ej: No reduce las cantidades del inventario al facturar>",',
        '  "summary": "<resumen técnico claro en 1 a 3 oraciones explicando qué ocurre, dónde ocurre y datos clave reportados por el cliente>",',
        '  "priority": "<low | medium | high | urgent>",',
        `  "category_name": "<el nombre más cercano de [${catNames}] o vacío>"`,
        '}',
      ].join('\n');
      const userContext = `Cliente: ${t.lead_name || 'Cliente'}\nMensajes recientes:\n${historyLines.join('\n').slice(0, 3000)}`;
      const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aiCfg.openAiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.1,
          max_tokens: 320,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: promptSystem },
            { role: 'user', content: userContext },
          ],
        }),
      });
      if (aiRes.ok) {
        const aiJson = await aiRes.json();
        const raw = String(aiJson?.choices?.[0]?.message?.content || '').trim();
        const parsed = JSON.parse(raw);
        if (parsed?.module && DRAFT_MODULES.includes(String(parsed.module))) {
          moduleName = String(parsed.module);
        }
        if (parsed?.problem && String(parsed.problem).trim().length >= 6) {
          problemSummary = cleanInlineProblemHeadline(String(parsed.problem));
        }
        if (parsed?.summary && String(parsed.summary).trim().length >= 8) {
          descriptionSummary = String(parsed.summary).trim();
        }
        if (['low', 'medium', 'high', 'urgent'].includes(String(parsed?.priority))) {
          priority = parsed.priority;
        }
        if (parsed?.category_name) {
          const byAiCat = catList.find(
            (c) => c.name.toLowerCase() === String(parsed.category_name).trim().toLowerCase()
          );
          if (byAiCat) matchedCategory = byAiCat;
        }
      }
    } catch (e) {
      console.warn('[draft_technical_ticket] OpenAI draft fallback used:', e);
    }
  }

  return json({
    ok: true,
    draft: {
      module: moduleName,
      problem_summary: problemSummary,
      structured_title: `${moduleName} — ${problemSummary}`,
      description_summary: descriptionSummary,
      priority,
      category_id: matchedCategory?.id || '',
    },
  });
}

async function handleSetTechnicalTicket(supabase: any, caller: Caller, payload: any): Promise<Response> {
  const ticketId = String(payload?.ticket_id || '');
  if (!ticketId) return json({ ok: false, error: 'Falta ticket_id' }, 400);
  if (!(await ticketVisibleTo(caller, ticketId))) return json({ ok: false, error: 'No tienes acceso a este chat' }, 403);

  const { data: t } = await supabase
    .from('tickets')
    .select('id, company_id, title, status, lead_id, lead_name, description, metadata, assigned_to, category_id, priority, created_by')
    .eq('id', ticketId)
    .maybeSingle();
  if (!t) return json({ ok: false, error: 'Ticket no encontrado' }, 404);

  const isTech = payload?.is_technical_ticket === true;
  const closeChat = payload?.close_chat === true;
  const customTitle = String(payload?.custom_title || '').trim();
  const moduleName = String(payload?.module || '').trim();
  const problemSummary = String(payload?.problem_summary || '').trim();
  const descriptionSummary = String(payload?.description_summary || '').trim();
  const categoryId = payload?.category_id === null || payload?.category_id === '' ? null : String(payload.category_id);
  const assignedTo = payload?.assigned_to === null || payload?.assigned_to === '' ? null : String(payload.assigned_to);
  const dueDate = payload?.due_date ? String(payload.due_date) : null;
  const requestedPriority = ['low', 'medium', 'high', 'urgent'].includes(String(payload?.priority))
    ? String(payload.priority)
    : null;
  const watchers = Array.isArray(payload?.watchers)
    ? Array.from(new Set(payload.watchers.map((w: any) => String(w || '').trim()).filter(Boolean)))
    : null;
  const nowIso = new Date().toISOString();
  const curMeta = cleanMeta(t.metadata || {});

  const nextMeta: Record<string, any> = {
    ...curMeta,
    is_technical_ticket: isTech,
    awaiting_problem_details: false,
    wa_attended_at: nowIso,
    wa_ticket_manual_override: true,
    wa_ticket_override_by: caller.userId,
    wa_ticket_override_at: nowIso,
  };
  if (moduleName) nextMeta.module_name = moduleName;
  if (problemSummary) nextMeta.problem_summary = problemSummary;
  if (watchers !== null) nextMeta.watchers = watchers;

  const updatePatch: Record<string, any> = {
    updated_at: nowIso,
    metadata: nextMeta,
  };

  if (isTech) {
    let summaryText = problemSummary || customTitle;
    if (!summaryText && isGenericProblemTitle(String(t.title || ''))) {
      const clientLines = String(t.description || '')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('[') && l.includes('👤'));
      for (const line of [...clientLines].reverse()) {
        const idx = line.indexOf(': ');
        const msg = idx > 0 ? line.slice(idx + 2).trim() : '';
        if (msg && !isGreetingOrClosingAgreement(msg) && !/^\[(Imagen|Video|Sticker|Nota de voz|Documento|Archivo)/i.test(msg)) {
          summaryText = msg;
          break;
        }
      }
    }
    const cls = classifyIssueCategory(summaryText || String(t.title || ''));
    const resolvedModule = moduleName || mapCategoryTagToModule(cls.shortCategoryTag, summaryText);
    nextMeta.ai_category = resolvedModule;
    nextMeta.module_name = resolvedModule;

    if (problemSummary) {
      const cleanProblem = cleanInlineProblemHeadline(problemSummary) || problemSummary;
      const structuredTitle = `${resolvedModule} — ${cleanProblem}`;
      updatePatch.title = structuredTitle.length > 130 ? `${structuredTitle.slice(0, 127).trim()}...` : structuredTitle;
    } else if (summaryText) {
      const cleanSummary = customTitle ? summaryText : stripLeadingGreetingForTicketTitle(summaryText);
      const snippet = cleanSummary.length > 85 ? `${cleanSummary.slice(0, 82).trim()}...` : cleanSummary;
      updatePatch.title = `${resolvedModule} — ${snippet}`;
    } else if (/^\[WhatsApp\s*·\s*Chat\]/i.test(String(t.title || ''))) {
      updatePatch.title = String(t.title || '').replace(/^\[WhatsApp\s*·\s*Chat\]/i, `${resolvedModule} —`);
    }

    const headerBody = descriptionSummary || summaryText || '';
    if (headerBody) {
      const currentDesc = String(t.description || '');
      const headerRegex = /^(?:📌 PROBLEMA REPORTADO \([^)]+\)|💬 Conversación de WhatsApp \([^)]+\)):\n[\s\S]*?(?=\n\n💬 Historial de WhatsApp:)/;
      if (headerRegex.test(currentDesc)) {
        updatePatch.description = currentDesc.replace(
          headerRegex,
          `📌 PROBLEMA REPORTADO (${resolvedModule}):\n${headerBody}`
        );
      } else {
        updatePatch.description = `📌 PROBLEMA REPORTADO (${resolvedModule}):\n${headerBody}\n\n💬 Historial de WhatsApp:\n${currentDesc}`;
      }
    }

    if (payload && 'category_id' in payload) updatePatch.category_id = categoryId;
    if (payload && 'assigned_to' in payload) updatePatch.assigned_to = assignedTo;
    if (payload && 'due_date' in payload) updatePatch.due_date = dueDate;
    if (requestedPriority) updatePatch.priority = requestedPriority;

    // Newly promoted WhatsApp chats start cleanly in "Ticket Generado" ('new')
    if (curMeta.is_technical_ticket !== true || ['closed', 'resolved'].includes(t.status)) {
      updatePatch.status = 'new';
      updatePatch.resolved_at = null;
      updatePatch.last_status_change_at = nowIso;
    }
  } else {
    if (['new', 'open', 'pending'].includes(t.status)) {
      updatePatch.status = 'closed';
      updatePatch.resolved_at = null;
      updatePatch.last_status_change_at = nowIso;
    }
  }

  const { data: updatedTicket, error: upErr } = await supabase
    .from('tickets')
    .update(updatePatch)
    .eq('id', ticketId)
    .select('*')
    .single();
  if (upErr) return json({ ok: false, error: upErr.message }, 500);

  await supabase.from('ticket_comments').insert({
    ticket_id: ticketId,
    company_id: t.company_id,
    author_id: caller.userId,
    body: isTech
      ? `🎫 ${caller.fullName} generó el Ticket Técnico: ${updatePatch.title || t.title}`
      : `💬 ${caller.fullName} ${closeChat ? 'cerró el chat (sin problema técnico)' : 'marcó el chat como Solo Conversación (no requiere ticket técnico)'}`,
    is_internal: true,
  });

  return json({ ok: true, is_technical_ticket: isTech, ticket: updatedTicket });
}

async function handleCleanupAutoJunkTickets(supabase: any, caller: Caller, payload: any): Promise<Response> {
  const companyId = String(payload?.company_id || caller.companyId || '');
  if (!companyId) return json({ ok: false, error: 'Falta company_id' }, 400);
  const dryRun = payload?.dry_run === true;

  const { data: rows, error } = await supabase
    .from('tickets')
    .select('id, title, status, assigned_to, category_id, lead_name, metadata, created_at')
    .eq('company_id', companyId)
    .in('status', ['new', 'open', 'pending'])
    .is('assigned_to', null)
    .is('category_id', null)
    .eq('metadata->>source', 'whatsapp_evolution');

  if (error) return json({ ok: false, error: error.message }, 500);

  const candidates = ((rows || []) as any[]).filter((row) => {
    const meta = cleanMeta(row.metadata || {});
    if (meta.wa_ticket_manual_override === true) return false;
    return meta.is_technical_ticket !== false;
  });

  if (dryRun) {
    return json({
      ok: true,
      dry_run: true,
      count: candidates.length,
      tickets: candidates.map((c) => ({ id: c.id, title: c.title, lead_name: c.lead_name, status: c.status, created_at: c.created_at })),
    });
  }

  const nowIso = new Date().toISOString();
  let cleaned = 0;
  for (const row of candidates) {
    const meta = cleanMeta(row.metadata || {});
    const { error: uErr } = await supabase
      .from('tickets')
      .update({
        status: 'closed',
        updated_at: nowIso,
        last_status_change_at: nowIso,
        metadata: {
          ...meta,
          is_technical_ticket: false,
          awaiting_problem_details: false,
          auto_cleaned_at: nowIso,
          auto_cleaned_by: caller.userId,
        },
      })
      .eq('id', row.id);
    if (!uErr) cleaned++;
  }

  return json({ ok: true, dry_run: false, matched: candidates.length, cleaned });
}

// Classify a WhatsApp number: cliente | lead | interno | spam | por_clasificar (undo).
async function handleClassify(supabase: any, caller: Caller, payload: any): Promise<Response> {
  const ticketId = String(payload?.ticket_id || '');
  const type = String(payload?.contact_type || '') as 'cliente' | 'lead' | 'interno' | 'spam' | 'por_clasificar';
  if (!ticketId || !['cliente', 'lead', 'interno', 'spam', 'por_clasificar'].includes(type)) {
    return json({ ok: false, error: 'Clasificación inválida' }, 400);
  }
  const canClassify = caller.isAdmin || caller.scopes.includes('leads');
  if (!canClassify) return json({ ok: false, error: 'Solo administradores y vendedores pueden clasificar números' }, 403);
  if (!caller.isAdmin && ['interno', 'por_clasificar'].includes(type)) {
    return json({ ok: false, error: 'Solo un administrador puede marcar Equipo o deshacer una clasificación' }, 403);
  }
  if (!(await ticketVisibleTo(caller, ticketId))) return json({ ok: false, error: 'No tienes acceso a este chat' }, 403);

  const { data: t } = await supabase.from('tickets').select('*').eq('id', ticketId).maybeSingle();
  if (!t) return json({ ok: false, error: 'Chat no encontrado' }, 404);
  const meta = cleanMeta(t.metadata || {});
  if (meta.source !== 'whatsapp_evolution') return json({ ok: false, error: 'No es un chat de WhatsApp' }, 409);
  if (meta.is_group) return json({ ok: false, error: 'Los grupos siempre son de Soporte' }, 409);
  const phone = digits(meta.whatsapp_phone || jidPhone(String(meta.whatsapp_jid || '')));
  if (!phone) return json({ ok: false, error: 'Este chat no tiene número de teléfono' }, 409);

  // Vendors may only take numbers still "por clasificar" (or their own leads).
  let ownsLead = meta.wa_scope === 'lead' && t.assigned_to === caller.userId;
  if (!ownsLead && meta.wa_scope === 'lead' && t.lead_id) {
    const { data: ld } = await supabase.from('leads').select('assigned_to').eq('id', t.lead_id).maybeSingle();
    ownsLead = ld?.assigned_to === caller.userId;
  }
  if (!caller.isAdmin && meta.wa_scope !== 'por_clasificar' && !ownsLead) {
    return json({ ok: false, error: 'Este número ya fue clasificado' }, 409);
  }
  // A member of a client support group is a client, never a lead.
  if (type === 'lead') {
    const groupsOfPhone = await groupsContaining(supabase, t.company_id, phone, digits(meta.whatsapp_lid || ''));
    if (groupsOfPhone.length > 0) {
      const names = groupsOfPhone.map((g) => g.subject || g.group_jid).slice(0, 3).join(', ');
      return json({ ok: false, error: `Este número pertenece a un grupo de soporte (${names}); es cliente, no lead.` }, 409);
    }
  }

  const pushName = String(meta.whatsapp_push_name || '').trim();
  const nowIso = new Date().toISOString();
  const scopeFor: Record<string, WaScope> = { cliente: 'soporte', lead: 'lead', interno: 'interno', spam: 'spam', por_clasificar: 'por_clasificar' };
  const newScope = scopeFor[type];

  // Claim atomically: first one wins when two vendors click at the same time.
  if (!caller.isAdmin) {
    const { data: claimed } = await supabase
      .from('tickets')
      .update({ updated_at: nowIso, metadata: { ...meta, wa_scope: newScope, wa_classifying_by: caller.userId } })
      .eq('id', ticketId)
      .eq('metadata->>wa_scope', meta.wa_scope)
      .select('id');
    if (!claimed || claimed.length === 0) return json({ ok: false, error: 'Otra persona acaba de clasificar este número' }, 409);
  }

  let leadId: string | null = null;
  let leadName: string | null = null;
  let clientName: string | null = null;
  const clientId: string | null = payload?.client_id || null;
  const groupJid: string | null = payload?.group_jid || null;

  try {
    if (type === 'cliente' && clientId) {
      const { data: c } = await supabase.from('clients').select('id, nombre').eq('id', clientId).eq('company_id', t.company_id).maybeSingle();
      if (!c) throw new Error('Cliente no encontrado');
      clientName = c.nombre;
    }
    if (type === 'cliente' && groupJid && !clientName) {
      const { data: g } = await supabase.from('whatsapp_groups').select('subject').eq('company_id', t.company_id).eq('group_jid', groupJid).maybeSingle();
      clientName = g?.subject || null;
    }

    if (type === 'lead') {
      // Re-use an existing lead with this phone; otherwise create a Prospecto assigned to the caller.
      const l8 = last8(phone);
      let existing: any = null;
      if (t.lead_id) {
        const { data } = await supabase.from('leads').select('id, name, assigned_to, status').eq('id', t.lead_id).maybeSingle();
        existing = data;
      }
      if (!existing) {
        const { data } = await supabase
          .from('leads')
          .select('id, name, assigned_to, status, phone')
          .eq('company_id', t.company_id)
          .like('phone', `%${l8.slice(-4)}%`)
          .order('created_at', { ascending: false })
          .limit(25);
        existing = (data || []).find((l: any) => last8(l.phone) === l8) || null;
      }
      const targetOwnerId = caller.isAdmin && payload?.assign_to ? String(payload.assign_to) : caller.userId;
      if (existing) {
        leadId = existing.id;
        leadName = existing.name;
        if (!existing.assigned_to || (caller.isAdmin && payload?.assign_to)) {
          // assigned_at is maintained by the trg_lead_assignment trigger.
          await supabase.from('leads').update({ assigned_to: targetOwnerId }).eq('id', existing.id);
        }
      } else {
        const name = String(payload?.lead_name || pushName || `WhatsApp +${phone}`).replace(/\(\+\d+\)/g, '').trim();
        const { data: created, error } = await supabase
          .from('leads')
          .insert({
            company_id: t.company_id,
            name,
            phone: `+${phone}`,
            status: 'Prospecto',
            priority: 'medium',
            source: 'WhatsApp',
            assigned_to: targetOwnerId,
            next_action_notes: `[Desde Chat WhatsApp Soporte] ${String(meta.last_whatsapp_message || '').slice(0, 300)}`,
          })
          .select('id, name')
          .single();
        if (error) throw error;
        leadId = created.id;
        leadName = created.name;
      }
    }

    // Directory row (manual classification)
    if (type === 'por_clasificar') {
      await supabase.from('whatsapp_contacts').delete().eq('company_id', t.company_id).like('phone', `%${last8(phone)}`);
    } else {
      await supabase.from('whatsapp_contacts').upsert(
        {
          company_id: t.company_id,
          phone,
          lid: meta.whatsapp_lid || null,
          push_name: pushName || null,
          display_name: leadName || clientName || payload?.display_name || pushName || null,
          contact_type: type,
          client_id: type === 'cliente' ? clientId : null,
          lead_id: type === 'lead' ? leadId : null,
          profile_id: type === 'interno' ? payload?.profile_id || null : null,
          group_jid: type === 'cliente' ? groupJid : null,
          notes: payload?.notes || null,
          classified_by: caller.userId,
          classified_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: 'company_id,phone' }
      );
    }
  } catch (e: any) {
    if (!caller.isAdmin) {
      await supabase.from('tickets').update({ metadata: { ...meta } }).eq('id', ticketId); // release the claim
    }
    return json({ ok: false, error: e?.message || 'No se pudo clasificar' }, 500);
  }

  const labels: Record<string, string> = {
    cliente: 'Cliente (Soporte)', lead: 'Lead de Ventas', interno: 'Equipo interno', spam: 'Spam', por_clasificar: 'Por clasificar',
  };
  const newMeta: Record<string, any> = {
    ...meta,
    wa_scope: newScope,
    wa_scope_reason: `manual_${type}`,
    wa_classified_by: caller.userId,
    wa_classified_by_name: caller.fullName,
    wa_classified_at: nowIso,
    is_existing_client: newScope === 'soporte',
    support_channel: newScope === 'soporte' ? 'soporte' : 'ventas',
    ai_category: newScope === 'soporte' ? 'Soporte General / Consulta' : 'Ventas / Precios / Nuevo Lead',
    ...(clientId ? { client_id: clientId } : {}),
    ...(groupJid ? { linked_group_jid: groupJid } : {}),
  };
  delete newMeta.wa_classifying_by;
  const tag = newScope === 'soporte' ? 'Soporte' : SCOPE_TITLE_TAG[newScope];
  const ticketUpdate: Record<string, any> = {
    updated_at: nowIso,
    metadata: newMeta,
    title: String(t.title || '').replace(/^\[WhatsApp · [^\]]*\]/, `[WhatsApp · ${tag}]`),
  };
  if (leadId) {
    ticketUpdate.lead_id = leadId;
    ticketUpdate.lead_name = leadName;
    ticketUpdate.assigned_to = (caller.isAdmin && payload?.assign_to ? String(payload.assign_to) : null) || t.assigned_to || caller.userId;
  }
  if (clientName) ticketUpdate.lead_name = clientName;
  await supabase.from('tickets').update(ticketUpdate).eq('id', ticketId);

  // Audit line inside the chat (internal note, never sent to WhatsApp).
  await supabase.from('ticket_comments').insert({
    ticket_id: ticketId,
    company_id: t.company_id,
    author_id: caller.userId,
    body: `🏷️ ${caller.fullName} clasificó este número como: ${labels[type]}${leadName ? ` — Lead: ${leadName}` : ''}${clientName ? ` — ${clientName}` : ''}`,
    is_internal: true,
  });

  return json({ ok: true, wa_scope: newScope, lead: leadId ? { id: leadId, name: leadName } : null });
}

async function handleSendReply(supabase: any, caller: Caller, payload: any): Promise<Response> {
  const ticketId = String(payload?.ticket_id || '');
  const text = String(payload?.message_text || '').trim();
  if (!ticketId || !text) return json({ ok: false, error: 'Missing ticket_id or message_text' }, 400);
  if (!(await ticketVisibleTo(caller, ticketId))) return json({ ok: false, error: 'No tienes acceso a este chat' }, 403);

  const { data: t } = await supabase.from('tickets').select('*').eq('id', ticketId).maybeSingle();
  if (!t) return json({ ok: false, error: 'Ticket not found' }, 404);
  const meta = cleanMeta(t.metadata || {});
  const target = meta.whatsapp_jid || meta.whatsapp_phone || '';
  const authorName = /simulaci/i.test(caller.fullName) ? 'Soporte Técnico' : caller.fullName;
  const line = `[${fmtTime(new Date())}] 👨‍💻 ${authorName}: ${text}`;

  const { data: comment } = await supabase
    .from('ticket_comments')
    .insert({ ticket_id: ticketId, company_id: t.company_id, author_id: caller.userId, body: line, is_internal: false })
    .select('*')
    .single();

  const description = String(t.description || '').includes('💬 Historial de WhatsApp:')
    ? `${t.description}\n${line}`
    : `${t.description || ''}\n\n💬 Historial de WhatsApp:\n${line}`;
  const outboxId = target
    ? await enqueueOutbox(supabase, {
        companyId: t.company_id, ticketId, commentId: comment?.id || null,
        instance: normalizeInstance(meta.evolution_instance), number: target, kind: 'text',
        payload: { text }, createdBy: caller.userId,
      })
    : null;

  const nowIso = new Date().toISOString();
  const markLeadLost = payload?.mark_lead_lost === true;
  const isResolvedClosure = payload?.is_resolved_auto_reply === true;
  const update: Record<string, any> = {
    description,
    updated_at: nowIso,
    metadata: {
      ...meta,
      whatsapp_message_count: Number(meta.whatsapp_message_count || 0) + 1,
      last_whatsapp_message: text.slice(0, 200),
      last_whatsapp_at: nowIso,
      last_message_from: 'staff',
      last_staff_reply_at: nowIso,
      last_staff_reply_by: authorName,
      wa_attended_at: nowIso,
      staff_text_reply_count: Number(meta.staff_text_reply_count || 0) + 1,
      text_reply_minutes: Number(meta.text_reply_minutes || 0) + (Number(payload?.response_minutes) || 2),
      ...(isResolvedClosure ? { auto_resolved_replied_at: nowIso } : {}),
      ...(markLeadLost ? { wa_lead_status: 'Perdido' } : {}),
    },
  };
  // Manual ticket assignment only — do not auto-assign support chats when replying.
  await supabase.from('tickets').update(update).eq('id', ticketId);

  if (markLeadLost) {
    const targetLeadId = String(payload?.lead_id || t.lead_id || '').trim();
    if (targetLeadId) {
      const { data: ld } = await supabase.from('leads').select('id, status').eq('id', targetLeadId).maybeSingle();
      if (ld && ld.status !== 'Cliente' && ld.status !== 'Cerrado') {
        await supabase.from('leads').update({ status: 'Perdido' }).eq('id', targetLeadId);
      }
    }
  }

  return json({ ok: true, action: 'reply_queued', whatsapp_delivered: Boolean(outboxId), outbox_id: outboxId, comment });
}

async function handleSendMedia(supabase: any, caller: Caller, payload: any): Promise<Response> {
  const ticketId = String(payload?.ticket_id || '');
  const path = String(payload?.storage_path || '');
  const fileName = String(payload?.file_name || 'archivo').slice(0, 120);
  const mime = String(payload?.mime || 'application/octet-stream');
  const caption = String(payload?.caption || '').trim();
  if (!ticketId || !path) return json({ ok: false, error: 'Faltan datos del archivo' }, 400);
  if (!(await ticketVisibleTo(caller, ticketId))) return json({ ok: false, error: 'No tienes acceso a este chat' }, 403);
  const { data: t } = await supabase.from('tickets').select('*').eq('id', ticketId).maybeSingle();
  if (!t) return json({ ok: false, error: 'Chat no encontrado' }, 404);
  if (!path.startsWith(`outgoing/${t.company_id}/`)) return json({ ok: false, error: 'Ruta de archivo inválida' }, 400);

  const meta = cleanMeta(t.metadata || {});
  const target = meta.whatsapp_jid || meta.whatsapp_phone || '';
  const { data: signed, error: signErr } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, 60 * 60 * 24);
  if (signErr || !signed?.signedUrl) return json({ ok: false, error: 'No se pudo preparar el archivo' }, 500);

  const authorName = /simulaci/i.test(caller.fullName) ? 'Soporte Técnico' : caller.fullName;
  const kind = mediaTypeForSend(mime);
  const label = kind === 'image' ? '[Imagen]' : kind === 'video' ? '[Video]' : kind === 'audio' ? '[Audio]' : `[Documento: ${fileName}]`;
  const line = `[${fmtTime(new Date())}] 👨‍💻 ${authorName}: ${label}${caption ? ` ${caption}` : ''}`;
  const { data: comment } = await supabase
    .from('ticket_comments')
    .insert({ ticket_id: ticketId, company_id: t.company_id, author_id: caller.userId, body: line, is_internal: false })
    .select('*')
    .single();
  await supabase.from('whatsapp_messages').insert({
    company_id: t.company_id,
    ticket_id: ticketId,
    comment_id: comment?.id || null,
    remote_jid: target || null,
    from_me: true,
    message_type: kind === 'document' ? 'document' : kind,
    body: caption || label,
    media_status: 'ready',
    media_path: path,
    media_mime: mime,
    media_filename: fileName,
    media_size: Number(payload?.size) || null,
  });
  const outboxId = target
    ? await enqueueOutbox(supabase, {
        companyId: t.company_id, ticketId, commentId: comment?.id || null,
        instance: normalizeInstance(meta.evolution_instance), number: target, kind: 'media',
        payload: { url: signed.signedUrl, mimetype: mime, fileName, mediatype: kind, caption },
        createdBy: caller.userId,
      })
    : null;
  const mediaDesc = String(t.description || '').includes('💬 Historial de WhatsApp:')
    ? `${t.description}\n${line}`
    : `${t.description || ''}\n\n💬 Historial de WhatsApp:\n${line}`;
  const nowIso = new Date().toISOString();
  await supabase
    .from('tickets')
    .update({
      description: mediaDesc,
      updated_at: nowIso,
      metadata: {
        ...meta,
        whatsapp_message_count: Number(meta.whatsapp_message_count || 0) + 1,
        last_whatsapp_message: `${label}${caption ? ` ${caption}` : ''}`.slice(0, 200),
        last_whatsapp_at: nowIso,
        last_message_from: 'staff',
        last_staff_reply_at: nowIso,
        last_staff_reply_by: authorName,
        wa_attended_at: nowIso,
      },
    })
    .eq('id', ticketId);
  return json({ ok: true, comment, outbox_id: outboxId });
}

async function handleSendReactivation(supabase: any, caller: Caller, payload: any): Promise<Response> {
  if (!caller.isAdmin && !caller.scopes.includes('leads')) {
    return json({ ok: false, error: 'Sin permiso para enviar reactivaciones de Leads' }, 403);
  }

  const companyId = String(payload?.company_id || caller.companyId || (await resolveMainCompanyId(supabase, null)) || '');
  if (!companyId) return json({ ok: false, error: 'Empresa no identificada' }, 400);
  if (!caller.isAdmin && caller.companyId && caller.companyId !== companyId) {
    return json({ ok: false, error: 'Acceso denegado a otra empresa' }, 403);
  }

  let normPhone = digits(payload?.phone || '');
  if (normPhone.length === 8 && /^[267]/.test(normPhone)) {
    normPhone = `503${normPhone}`;
  }
  if (!normPhone || normPhone.length < 8) {
    return json({ ok: false, error: 'Teléfono inválido' }, 400);
  }

  const messageText = String(payload?.message_text || '').trim();
  const uploadedMedia = payload?.uploaded_media && typeof payload.uploaded_media === 'object' ? payload.uploaded_media : null;
  if (!messageText && !uploadedMedia) {
    return json({ ok: false, error: 'Mensaje vacío' }, 400);
  }

  const l8 = last8(normPhone);
  const jid = `${normPhone}@s.whatsapp.net`;
  const now = new Date();
  const nowIso = now.toISOString();

  // Hard Anti-Ban & session guard: never queue cold reactivations while WhatsApp is disconnected or over safe limits
  const [wdState, healState, rateState] = await Promise.all([
    getBridgeState(supabase, 'evo_watchdog'),
    getBridgeState(supabase, 'evo_heal'),
    getBridgeState(supabase, 'reactivation_rate'),
  ]);
  const wdTs = wdState?.checked_at ? new Date(wdState.checked_at).getTime() : 0;
  const healTs = healState?.completed_at ? new Date(healState.completed_at).getTime() : 0;
  const effectiveConnState = healTs >= wdTs
    ? (healState?.connection_after || wdState?.connection_state || null)
    : (wdState?.connection_state || healState?.connection_after || null);
  if (effectiveConnState && effectiveConnState !== 'open') {
    return json(
      {
        ok: false,
        disconnected: true,
        error: 'WhatsApp (+503 7971-8911) está desconectado o restringido. Reconecta la sesión antes de enviar reactivaciones.',
      },
      503,
    );
  }

  const nowMs = now.getTime();
  const dayCutoff = nowMs - 24 * 60 * 60 * 1000;
  const hourCutoff = nowMs - 60 * 60 * 1000;
  const recentTimestamps = Array.isArray(rateState?.timestamps)
    ? (rateState.timestamps as string[]).filter((ts) => {
        const t = Date.parse(String(ts));
        return Number.isFinite(t) && t >= dayCutoff;
      })
    : [];
  const lastHourCount = recentTimestamps.filter((ts) => Date.parse(ts) >= hourCutoff).length;
  const latestSendMs = recentTimestamps.reduce((max, ts) => Math.max(max, Date.parse(ts) || 0), 0);
  if (recentTimestamps.length >= 60) {
    return json(
      {
        ok: false,
        rate_limited: true,
        error: 'Escudo Anti-Ban: límite diario alcanzado (60 reactivaciones/24h). Espera para proteger el número +503 7971-8911.',
      },
      429,
    );
  }
  if (lastHourCount >= 20) {
    return json(
      {
        ok: false,
        rate_limited: true,
        error: 'Escudo Anti-Ban: límite por hora alcanzado (20 reactivaciones/hora). Continúa en la siguiente hora.',
      },
      429,
    );
  }
  if (latestSendMs > 0 && nowMs - latestSendMs < 20_000) {
    return json(
      {
        ok: false,
        rate_limited: true,
        error: 'Escudo Anti-Ban: pausa mínima de 20 segundos entre envíos de reactivación.',
      },
      429,
    );
  }

  const campaignTag = String(payload?.campaign_tag || 'Reactivación WhatsApp').trim();
  const rawSellerName = String(payload?.seller_display_name || caller.fullName || 'Equipo Comercial').trim();
  const sellerName = /simulaci|platform\s*owner/i.test(rawSellerName) ? 'Jimmy Arias' : rawSellerName;

  // Verify real lead row in public.leads (prevents FK error when resending from an unlinked WhatsApp ticket).
  let realLead: { id: string; name: string | null; assigned_to: string | null; contact_count: number | null; status?: string | null } | null = null;
  const candidateLeadId = String(payload?.lead_id || '').trim();
  if (candidateLeadId) {
    const { data: lRow } = await supabase
      .from('leads')
      .select('id, name, assigned_to, contact_count, status')
      .eq('id', candidateLeadId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (lRow) realLead = lRow;
  }
  if (!realLead && l8) {
    const { data: byPhone } = await supabase
      .from('leads')
      .select('id, name, assigned_to, contact_count, status')
      .eq('company_id', companyId)
      .ilike('phone', `%${l8}%`)
      .order('updated_at', { ascending: false })
      .limit(5);
    const match = (byPhone || []).find((r: any) => last8(r.phone || l8) === l8) || (byPhone || [])[0];
    if (match) realLead = match;
  }

  const leadDisplayName = String(payload?.lead_name || realLead?.name || `+${normPhone}`).trim();
  const leadOwner = realLead?.assigned_to || (payload?.lead_assigned_to ? String(payload.lead_assigned_to) : null) || caller.userId;

  // Non-admin sales agents may only reactivate leads assigned to them (or unassigned).
  if (!caller.isAdmin && realLead?.assigned_to && realLead.assigned_to !== caller.userId) {
    return json({ ok: false, error: 'Este prospecto está asignado a otro asesor' }, 403);
  }

  // Server-side guard: never send campaigns to leads marked 'Erróneo' (wrong/invalid contact).
  // 'Perdido' leads ARE allowed on purpose: the team may send them updates / new packages later.
  // (HTTP 200 + ok:false so the CRM shows the real reason instead of a generic error.)
  const realStatus = String(realLead?.status || '').trim();
  if (realStatus === 'Erróneo') {
    return json({ ok: false, skipped: true, error: `Omitido: el prospecto está marcado como ${realStatus}` });
  }

  // Targeted open-ticket lookup (no .limit(200) truncation — matches uq_wa_open_ticket_per_chat 1-to-1).
  let existingTicket: any = null;
  const explicitTicketId = String(payload?.ticket_id || '').trim();
  if (explicitTicketId) {
    const { data: tById } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', explicitTicketId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (tById && ['new', 'open', 'pending'].includes(tById.status) && !tById.metadata?.merged_into && !tById.metadata?.is_group) {
      existingTicket = tById;
    }
  }
  if (!existingTicket) {
    const { data: byJid } = await supabase
      .from('tickets')
      .select('*')
      .eq('company_id', companyId)
      .eq('metadata->>source', 'whatsapp_evolution')
      .eq('metadata->>whatsapp_jid', jid)
      .in('status', ['new', 'open', 'pending'])
      .order('updated_at', { ascending: false })
      .limit(5);
    existingTicket = (byJid || []).find((t: any) => !t.metadata?.merged_into && !t.metadata?.is_group) || null;
  }
  if (!existingTicket && realLead?.id) {
    const { data: byLead } = await supabase
      .from('tickets')
      .select('*')
      .eq('company_id', companyId)
      .eq('metadata->>source', 'whatsapp_evolution')
      .eq('lead_id', realLead.id)
      .in('status', ['new', 'open', 'pending'])
      .order('updated_at', { ascending: false })
      .limit(5);
    existingTicket = (byLead || []).find((t: any) => !t.metadata?.merged_into && !t.metadata?.is_group) || null;
  }
  if (!existingTicket && l8) {
    const { data: byL8 } = await supabase
      .from('tickets')
      .select('*')
      .eq('company_id', companyId)
      .eq('metadata->>source', 'whatsapp_evolution')
      .ilike('metadata->>whatsapp_phone', `%${l8}`)
      .in('status', ['new', 'open', 'pending'])
      .order('updated_at', { ascending: false })
      .limit(5);
    existingTicket = (byL8 || []).find((t: any) => !t.metadata?.merged_into && !t.metadata?.is_group) || null;
  }

  let targetTicket: any = existingTicket;
  let nextTouchNumber = 1;

  if (targetTicket) {
    const curMeta = cleanMeta(targetTicket.metadata || {});
    // Server-side guard: never send a campaign twice to the same chat within 24h.
    const lastSentAt = Date.parse(String(curMeta.wa_reactivation_sent_at || ''));
    if (Number.isFinite(lastSentAt)) {
      const hoursAgo = (Date.now() - lastSentAt) / 3600000;
      if (hoursAgo < 24) {
        return json({
          ok: false,
          skipped: true,
          error: `Omitido: ya se le envió hace ${Math.max(0, Math.floor(hoursAgo))} h (mínimo 24 h entre envíos)`,
        });
      }
    }
    const prevTouch = Number(curMeta.wa_reactivation_touch || (curMeta.wa_reactivation ? 1 : 0));
    nextTouchNumber = prevTouch + 1;
  } else {
    const { instance: defaultInst } = await evolutionCredentials(supabase);
    const insertPayload = {
      company_id: companyId,
      title: `[WhatsApp · Lead] ${leadDisplayName}`,
      description: `Reactivación comercial por WhatsApp (${campaignTag})`,
      status: 'open',
      priority: 'medium',
      lead_id: realLead?.id || null,
      lead_name: leadDisplayName,
      assigned_to: leadOwner,
      metadata: {
        source: 'whatsapp_evolution',
        wa_scope: 'lead',
        wa_scope_locked: true,
        is_existing_client: false,
        is_technical_ticket: false,
        support_channel: 'ventas',
        ai_category: 'Ventas / Reactivación Lead',
        whatsapp_phone: normPhone,
        whatsapp_jid: jid,
        evolution_instance: defaultInst,
        wa_reactivation: true,
        wa_reactivation_touch: 1,
        wa_reactivation_campaign: campaignTag,
        wa_reactivation_sent_at: nowIso,
        wa_reactivation_by: caller.userId,
        wa_reactivation_by_name: sellerName,
        wa_attended_at: nowIso,
      },
    };
    const { data: created, error: createErr } = await supabase.from('tickets').insert(insertPayload).select('*').single();
    if (createErr) {
      if (String(createErr.code) === '23505') {
        const { data: winner } = await supabase
          .from('tickets')
          .select('*')
          .eq('company_id', companyId)
          .eq('metadata->>source', 'whatsapp_evolution')
          .eq('metadata->>whatsapp_jid', jid)
          .in('status', ['new', 'open', 'pending'])
          .maybeSingle();
        if (!winner) return json({ ok: false, error: createErr.message }, 500);
        targetTicket = winner;
        const curMeta = cleanMeta(winner.metadata || {});
        const prevTouch = Number(curMeta.wa_reactivation_touch || (curMeta.wa_reactivation ? 1 : 0));
        nextTouchNumber = prevTouch + 1;
      } else {
        return json({ ok: false, error: createErr.message || 'No se pudo crear el chat de WhatsApp' }, 500);
      }
    } else {
      targetTicket = created;
      nextTouchNumber = 1;
    }

    try {
      await supabase.from('whatsapp_contacts').upsert(
        {
          company_id: companyId,
          phone: normPhone,
          display_name: leadDisplayName,
          contact_type: 'lead',
          lead_id: realLead?.id || null,
          classified_by: caller.userId,
          classified_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: 'company_id,phone' }
      );
    } catch {
      // non-blocking
    }
  }

  const ticketId: string = targetTicket.id;
  const curMeta = cleanMeta(targetTicket.metadata || {});
  delete curMeta.wa_delivery_error;
  const instanceName = normalizeInstance(curMeta.evolution_instance);
  const targetNumber = String(curMeta.whatsapp_jid || jid);

  let outboxId: string | null = null;
  let commentRow: any = null;
  let previewText = messageText.slice(0, 200);
  let chatLine = '';

  if (uploadedMedia && uploadedMedia.path) {
    const mediaPath = String(uploadedMedia.path);
    if (!mediaPath.startsWith(`outgoing/${companyId}/`)) {
      return json({ ok: false, error: 'Ruta de archivo inválida' }, 400);
    }
    const fileName = String(uploadedMedia.name || 'archivo').slice(0, 120);
    const mime = String(uploadedMedia.mime || 'application/octet-stream');
    const size = Number(uploadedMedia.size) || null;
    const { data: signed, error: signErr } = await supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUrl(mediaPath, 60 * 60 * 24 * 7);
    if (signErr || !signed?.signedUrl) {
      return json({ ok: false, error: 'No se pudo firmar el archivo adjunto' }, 500);
    }
    const kind = mediaTypeForSend(mime);
    const label = kind === 'image' ? '[Imagen]' : kind === 'video' ? '[Video]' : kind === 'audio' ? '[Audio]' : `[Documento: ${fileName}]`;
    chatLine = `[${fmtTime(now)}] 👨‍💻 ${sellerName}: ${label}${messageText ? ` ${messageText}` : ''}`;
    previewText = `${label}${messageText ? ` ${messageText}` : ''}`.slice(0, 200);

    const { data: c } = await supabase
      .from('ticket_comments')
      .insert({ ticket_id: ticketId, company_id: companyId, author_id: caller.userId, body: chatLine, is_internal: false })
      .select('*')
      .single();
    commentRow = c;

    await supabase.from('whatsapp_messages').insert({
      company_id: companyId,
      ticket_id: ticketId,
      comment_id: c?.id || null,
      remote_jid: targetNumber,
      from_me: true,
      message_type: kind === 'document' ? 'document' : kind,
      body: messageText || label,
      media_status: 'ready',
      media_path: mediaPath,
      media_mime: mime,
      media_filename: fileName,
      media_size: size,
    });

    outboxId = await enqueueOutbox(supabase, {
      companyId,
      ticketId,
      commentId: c?.id || null,
      instance: instanceName,
      number: targetNumber,
      kind: 'media',
      payload: { url: signed.signedUrl, mimetype: mime, fileName, mediatype: kind, caption: messageText },
      createdBy: caller.userId,
    });
  } else {
    chatLine = `[${fmtTime(now)}] 👨‍💻 ${sellerName}: ${messageText}`;
    const { data: c } = await supabase
      .from('ticket_comments')
      .insert({ ticket_id: ticketId, company_id: companyId, author_id: caller.userId, body: chatLine, is_internal: false })
      .select('*')
      .single();
    commentRow = c;

    outboxId = await enqueueOutbox(supabase, {
      companyId,
      ticketId,
      commentId: c?.id || null,
      instance: instanceName,
      number: targetNumber,
      kind: 'text',
      payload: { text: messageText },
      createdBy: caller.userId,
    });
  }

  if (!outboxId) {
    return json({ ok: false, error: 'No se pudo encolar el envío en whatsapp_outbox' }, 500);
  }

  try {
    await setBridgeState(supabase, 'reactivation_rate', {
      timestamps: [...recentTimestamps, nowIso].slice(-120),
      updated_at: nowIso,
    });
  } catch {
    // non-blocking
  }

  const prevDesc = String(targetTicket.description || '');
  const nextDesc = prevDesc.includes('💬 Historial de WhatsApp:')
    ? `${prevDesc}\n${chatLine}`
    : `${prevDesc}\n\n💬 Historial de WhatsApp:\n${chatLine}`;

  await supabase
    .from('tickets')
    .update({
      description: nextDesc,
      lead_id: targetTicket.lead_id || realLead?.id || null,
      lead_name: targetTicket.lead_name || leadDisplayName,
      assigned_to: targetTicket.assigned_to || leadOwner,
      updated_at: nowIso,
      metadata: {
        ...curMeta,
        source: 'whatsapp_evolution',
        wa_scope: 'lead',
        wa_scope_locked: true,
        is_existing_client: false,
        is_technical_ticket: false,
        support_channel: 'ventas',
        whatsapp_phone: curMeta.whatsapp_phone || normPhone,
        whatsapp_jid: curMeta.whatsapp_jid || jid,
        evolution_instance: instanceName,
        wa_reactivation: true,
        wa_reactivation_touch: nextTouchNumber,
        wa_reactivation_campaign: campaignTag,
        wa_reactivation_sent_at: nowIso,
        wa_reactivation_by: caller.userId,
        wa_reactivation_by_name: sellerName,
        wa_attended_at: nowIso,
        whatsapp_message_count: Number(curMeta.whatsapp_message_count || 0) + 1,
        last_whatsapp_message: previewText,
        last_whatsapp_at: nowIso,
        last_message_from: 'staff',
        last_staff_reply_at: nowIso,
        last_staff_reply_by: sellerName,
      },
    })
    .eq('id', ticketId);

  if (realLead?.id) {
    try {
      const prevCount = Number(realLead.contact_count ?? payload?.lead_contact_count ?? 0);
      await supabase
        .from('leads')
        .update({
          last_follow_up_at: nowIso,
          contact_count: prevCount + 1,
        })
        .eq('id', realLead.id);
    } catch {
      // non-blocking
    }
  }

  return json({
    ok: true,
    ticket_id: ticketId,
    outbox_id: outboxId,
    touch: nextTouchNumber,
    comment: commentRow,
  });
}
