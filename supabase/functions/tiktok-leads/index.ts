// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * 🎵 TIKTOK LEAD GENERATION WEBHOOK
 * ----------------------------------
 * Captures leads from TikTok Lead Generation Ads and creates them in the CRM.
 *
 * Setup in TikTok Events Manager:
 *   URL:          https://<project>.supabase.co/functions/v1/tiktok-leads?company_id=YOUR_UUID
 *   Verify Token: crm_secure_tiktok
 *
 * Required env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   TIKTOK_ACCESS_TOKEN   (TikTok for Business access token — to fetch form field data)
 *   TIKTOK_APP_SECRET     (for HMAC-SHA256 signature verification)
 */

const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TIKTOK_APP_SECRET        = Deno.env.get('TIKTOK_APP_SECRET') || '';
const TIKTOK_ACCESS_TOKEN      = Deno.env.get('TIKTOK_ACCESS_TOKEN') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─── HMAC-SHA256 SIGNATURE VERIFICATION ─────────────────────────────────────
async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
    if (!TIKTOK_APP_SECRET) return true; // Skip if secret not configured yet
    const signature = req.headers.get('x-tiktok-signature') || '';
    const encoder   = new TextEncoder();
    const key       = await crypto.subtle.importKey('raw', encoder.encode(TIKTOK_APP_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac       = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
    const hex       = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');
    return hex === signature;
}

// ─── FETCH LEAD DETAILS FROM TIKTOK API ──────────────────────────────────────
async function fetchTikTokLeadData(leadId: string, advertiser_id: string): Promise<Record<string, string>> {
    if (!TIKTOK_ACCESS_TOKEN) {
        console.warn('TIKTOK_ACCESS_TOKEN not set — cannot fetch lead field data');
        return {};
    }

    const res = await fetch(
        `https://business-api.tiktok.com/open_api/v1.3/lead/data/?advertiser_id=${advertiser_id}&form_id=${leadId}`,
        { headers: { 'Access-Token': TIKTOK_ACCESS_TOKEN } }
    );
    const json = await res.json();

    if (json.code !== 0) {
        console.error('TikTok API error:', json.message);
        return {};
    }

    // Flatten answers array → key/value
    const fields: Record<string, string> = {};
    for (const answer of (json.data?.answers || [])) {
        fields[answer.field_id?.toLowerCase() || answer.field_name?.toLowerCase()] = answer.value || '';
    }
    return fields;
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
serve(async (req) => {
    try {
        const url = new URL(req.url);

        // ── GET: TikTok webhook verification ────────────────────────────────
        if (req.method === 'GET') {
            const challenge = url.searchParams.get('challenge');
            if (challenge) {
                // TikTok sends ?challenge=XYZ — echo it back as JSON
                return new Response(JSON.stringify({ challenge }), {
                    status:  200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            return new Response('OK', { status: 200 });
        }

        // ── POST: Lead event ─────────────────────────────────────────────────
        if (req.method === 'POST') {
            const rawBody = await req.text();

            // Verify signature
            const valid = await verifySignature(req, rawBody);
            if (!valid) {
                console.error('TikTok signature verification failed');
                return new Response('Unauthorized', { status: 401 });
            }

            const body      = JSON.parse(rawBody);
            const companyId = url.searchParams.get('company_id');

            if (!companyId) {
                console.error('tiktok-leads: missing ?company_id= in webhook URL');
                return new Response('OK', { status: 200 });
            }

            // Process each lead event
            const events = body.data || body.events || [body];
            for (const event of events) {
                const leadId       = event.lead_id || event.leadgen_id;
                const advertiserId = event.advertiser_id || '';
                const adName       = event.ad_name || event.campaign_name || '';
                const formId       = event.form_id || '';

                // Try to get detailed field data
                let fields: Record<string, string> = {};

                // Some webhooks include fields inline
                if (event.questions && Array.isArray(event.questions)) {
                    for (const q of event.questions) {
                        fields[q.key?.toLowerCase() || q.field_name?.toLowerCase()] = q.answer || q.value || '';
                    }
                }

                // If no inline fields, fetch from API
                if (Object.keys(fields).length === 0 && leadId && advertiserId) {
                    fields = await fetchTikTokLeadData(formId || leadId, advertiserId);
                }

                const name  = fields['name']      || fields['full_name']     || fields['contact_name']
                           || `${fields['first_name'] || ''} ${fields['last_name'] || ''}`.trim()
                           || 'Lead desde TikTok Ads';
                const email = fields['email']      || fields['contact_email'] || '';
                const phone = fields['phone']      || fields['phone_number']  || fields['mobile'] || '';
                const company_name = fields['company'] || fields['company_name'] || '';

                const notes = [
                    adName ? `📢 Anuncio: ${adName}` : '',
                    formId ? `🆔 Form ID: ${formId}` : '',
                    advertiserId ? `📣 Advertiser: ${advertiserId}` : '',
                    ...Object.entries(fields)
                        .filter(([k]) => !['name','full_name','first_name','last_name','email','phone','phone_number','mobile','company','company_name','contact_name','contact_email'].includes(k))
                        .map(([k, v]) => `${k}: ${v}`)
                ].filter(Boolean).join('\n');

                const { data: lead, error: leadError } = await supabase
                    .from('leads')
                    .insert({
                        name,
                        email:        email        || null,
                        phone:        phone        || null,
                        company_name: company_name || null,
                        source:       'TikTok Ads',
                        status:       'Prospecto',
                        company_id:   companyId,
                        notes:        notes        || null,
                        created_at:   new Date().toISOString(),
                    })
                    .select('id')
                    .single();

                if (leadError) {
                    console.error('Error creating TikTok lead:', leadError);
                } else {
                    console.log(`✅ TikTok lead created: ${name} (ID: ${lead?.id})`);

                    await supabase.from('lead_notes').insert({
                        lead_id:    lead?.id,
                        company_id: companyId,
                        content:    `Lead capturado automáticamente desde TikTok Ads.\n${notes}`,
                        created_at: new Date().toISOString(),
                    });
                }
            }

            return new Response(JSON.stringify({ ok: true }), {
                status:  200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response('Method Not Allowed', { status: 405 });

    } catch (err) {
        console.error('TikTok Webhook Error:', err);
        return new Response('Internal Error', { status: 500 });
    }
});
