// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * 🚀 META WEBHOOK HANDLER — WhatsApp Messages + Lead Ads (Facebook/Instagram)
 * ---------------------------------------------------------------------------
 * POST body.object === 'page'                      → Meta Lead Ads → creates CRM lead
 * POST body.object === 'whatsapp_business_account' → WhatsApp messages → AI chat processor
 * GET                                              → Meta webhook verification
 *
 * Required env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   META_PAGE_ACCESS_TOKEN  (for fetching Lead Ads field data from Graph API)
 */

const SUPABASE_URL            = Deno.env.get('CRM_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('CRM_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─── LEAD ADS PROCESSOR ──────────────────────────────────────────────────────
async function processLeadAd(entry: any, companyId: string, platform: 'facebook' | 'instagram') {
    try {
        const changes = entry.changes || [];
        for (const change of changes) {
            if (change.field !== 'leadgen') continue;

            const leadgenId = change.value?.leadgen_id;
            const formId    = change.value?.form_id;
            if (!leadgenId) continue;

            // Fetch full lead data from Meta Graph API
            const metaToken = Deno.env.get('META_PAGE_ACCESS_TOKEN');
            if (!metaToken) {
                console.error('META_PAGE_ACCESS_TOKEN not set — cannot fetch lead details');
                continue;
            }

            const graphRes = await fetch(
                `https://graph.facebook.com/v19.0/${leadgenId}?fields=field_data,created_time,ad_name,campaign_name,form_id&access_token=${metaToken}`
            );
            const leadData = await graphRes.json();

            if (leadData.error) {
                console.error('Meta Graph API error:', leadData.error);
                continue;
            }

            // Parse field_data [] → flat key/value map
            const fields: Record<string, string> = {};
            for (const field of (leadData.field_data || [])) {
                fields[field.name?.toLowerCase()] = field.values?.[0] || '';
            }

            const name    = fields['full_name']
                         || fields['name']
                         || `${fields['first_name'] || ''} ${fields['last_name'] || ''}`.trim()
                         || 'Lead desde Meta Ads';
            const email   = fields['email'] || '';
            const phone   = fields['phone_number'] || fields['phone'] || '';
            const company = fields['company_name'] || fields['company'] || '';
            const source  = platform === 'instagram' ? 'Instagram Ads' : 'Facebook Ads';

            // Build notes with ad context + any extra fields
            const extraFields = Object.entries(fields)
                .filter(([k]) => !['full_name','name','first_name','last_name','email','phone_number','phone','company_name','company'].includes(k))
                .map(([k, v]) => `${k}: ${v}`);

            const notes = [
                leadData.ad_name       ? `📢 Anuncio: ${leadData.ad_name}`      : '',
                leadData.campaign_name ? `📣 Campaña: ${leadData.campaign_name}` : '',
                `🆔 Lead Form ID: ${formId || 'n/a'}`,
                ...extraFields,
            ].filter(Boolean).join('\n');

            // Insert lead into CRM
            const { data: lead, error: leadError } = await supabase
                .from('leads')
                .insert({
                    name,
                    email:        email   || null,
                    phone:        phone   || null,
                    company_name: company || null,
                    source,
                    status:       'Prospecto',
                    company_id:   companyId,
                    notes:        notes   || null,
                    created_at:   new Date().toISOString(),
                })
                .select('id')
                .single();

            if (leadError) {
                console.error(`Error creating lead from ${source}:`, leadError);
            } else {
                console.log(`✅ Lead created from ${source}: ${name} (ID: ${lead?.id})`);

                // Traceability note in lead_notes
                await supabase.from('lead_notes').insert({
                    lead_id:    lead?.id,
                    company_id: companyId,
                    content:    `Lead capturado automáticamente desde ${source}.\n${notes}`,
                    created_at: new Date().toISOString(),
                });
            }
        }
    } catch (err) {
        console.error('processLeadAd error:', err);
    }
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
serve(async (req) => {
    try {
        const url = new URL(req.url);

        // ── GET: Meta webhook verification ──────────────────────────────────
        if (req.method === 'GET') {
            const mode      = url.searchParams.get('hub.mode');
            const token     = url.searchParams.get('hub.verify_token');
            const challenge = url.searchParams.get('hub.challenge');

            if (mode === 'subscribe' && token === 'crm_secure_verify') {
                console.log('Meta Webhook Verified ✅');
                return new Response(challenge, { status: 200 });
            }
            return new Response('Forbidden', { status: 403 });
        }

        // ── POST: Incoming events ────────────────────────────────────────────
        if (req.method === 'POST') {
            const body = await req.json();

            // A. META LEAD ADS ─ Facebook Ads / Instagram Ads ─────────────────
            if (body.object === 'page') {
                const companyId = url.searchParams.get('company_id');
                if (!companyId) {
                    console.error('Lead Ads webhook: missing ?company_id= in URL');
                    return new Response('OK', { status: 200 });
                }

                for (const entry of (body.entry || [])) {
                    const isInstagram = (entry.changes || []).some(
                        (c: any) => c.field === 'leadgen' && c.value?.platform === 'instagram'
                    );
                    await processLeadAd(entry, companyId, isInstagram ? 'instagram' : 'facebook');
                }
                return new Response('EVENT_RECEIVED', { status: 200 });
            }

            // B. WHATSAPP MESSAGES ─────────────────────────────────────────────
            if (body.object === 'whatsapp_business_account') {
                if (!body.entry || body.entry.length === 0) return new Response('OK', { status: 200 });

                for (const entry of body.entry) {
                    for (const change of (entry.changes || [])) {
                        if (!change.value?.messages) continue;

                        const messages      = change.value.messages;
                        const phoneNumberId = change.value.metadata.phone_number_id;

                        // Resolve company
                        let companyId: string | null = url.searchParams.get('company_id');

                        if (companyId) {
                            const { data: integ } = await supabase
                                .from('marketing_integrations')
                                .select('company_id')
                                .eq('company_id', companyId)
                                .eq('provider', 'whatsapp')
                                .eq('is_active', true)
                                .maybeSingle();
                            if (!integ) companyId = null;
                        }

                        if (!companyId && phoneNumberId) {
                            const { data: byPhone } = await supabase
                                .from('marketing_integrations')
                                .select('company_id')
                                .eq('provider', 'whatsapp')
                                .eq('is_active', true)
                                .filter('settings->>phoneNumberId', 'eq', phoneNumberId)
                                .maybeSingle();
                            if (byPhone) companyId = byPhone.company_id;
                        }

                        if (!companyId) {
                            const { data: first } = await supabase
                                .from('marketing_integrations')
                                .select('company_id')
                                .eq('provider', 'whatsapp')
                                .eq('is_active', true)
                                .limit(1)
                                .maybeSingle();
                            if (first) companyId = first.company_id;
                        }

                        if (!companyId) { console.error(`No company for WhatsApp PhoneID: ${phoneNumberId}`); continue; }

                        for (const msg of messages) {
                            const contact    = change.value.contacts?.find((c: any) => c.wa_id === msg.from);
                            const senderName = contact?.profile?.name || msg.from;
                            const chatId     = msg.from;

                            let content  = '';
                            const metadata: any = { whatsapp_id: msg.id, phone_number_id: phoneNumberId, raw_data: msg };

                            if (msg.type === 'text')         { content = msg.text.body; }
                            else if (msg.type === 'image')   { content = '[Imagen recibida]'; metadata.file_id = msg.image.id; metadata.mime_type = msg.image.mime_type; }
                            else if (msg.type === 'document'){ content = `[Documento: ${msg.document.filename}]`; metadata.file_id = msg.document.id; metadata.fileName = msg.document.filename; }
                            else                             { content = `[Mensaje tipo ${msg.type}]`; }

                            const { data: convId, error } = await supabase.rpc('process_incoming_marketing_message', {
                                p_company_id:  companyId,
                                p_channel:     'whatsapp',
                                p_external_id: chatId,
                                p_sender_name: senderName,
                                p_content:     content,
                                p_metadata:    metadata,
                            });

                            if (error) {
                                console.error('RPC Error saving WhatsApp msg:', error);
                            } else if (convId) {
                                const aiPromise = supabase.functions.invoke('ai-chat-processor', { body: { conversationId: convId } });
                                if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(aiPromise);
                            }
                        }
                    }
                }
                return new Response('EVENT_RECEIVED', { status: 200 });
            }

            return new Response('Unknown object type', { status: 404 });
        }

        return new Response('Method Not Allowed', { status: 405 });

    } catch (err) {
        console.error('Meta Webhook Error:', err);
        return new Response('Internal Error', { status: 500 });
    }
});
