// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * 🚀 META (WHATSAPP) WEBHOOK HANDLER
 * ----------------------------------
 * Handles Verification and Incoming Messages.
 * Supports Multi-tenancy via ?company_id=XYZ URL param or PhoneID Lookup.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
    try {
        const url = new URL(req.url);

        // 1. VERIFICATION REQUEST (GET)
        if (req.method === 'GET') {
            const mode = url.searchParams.get('hub.mode');
            const token = url.searchParams.get('hub.verify_token');
            const challenge = url.searchParams.get('hub.challenge');

            // Logic: Verify token. Since we are multi-tenant, we should validate against the company ID in URL
            // OR simpler: Just define a global verify token for the SaaS or check if any company has this token?
            // "Professional" way: Each client sets their own verify token in the dashboard, but Meta requires ONE URL.
            // Simplified: User enters a verify token in Dashboard, we check if it matches.
            // Or simpler V1: We provide a default Verify Token the user must use: 'arias_defense_secure'

            if (mode === 'subscribe' && token === 'crm_secure_verify') {
                console.log("Meta Webhook Verified.");
                return new Response(challenge, { status: 200 });
            } else {
                return new Response('Forbidden', { status: 403 });
            }
        }

        // 2. INCOMING MESSAGES (POST)
        if (req.method === 'POST') {
            const body = await req.json();

            // Validate Meta Payload Structure
            if (body.object === 'whatsapp_business_account') {
                if (!body.entry || body.entry.length === 0) return new Response('OK', { status: 200 });

                for (const entry of body.entry) {
                    const changes = entry.changes;
                    for (const change of changes) {
                        if (change.value && change.value.messages) {
                            const messages = change.value.messages;
                            const phoneNumberId = change.value.metadata.phone_number_id;

                            // IDENTIFY COMPANY
                            // A. Via URL Param (BYOK Best Practice)
                            let targetCompanyId = url.searchParams.get('company_id');
                            let companyId = null;

                            if (targetCompanyId) {
                                // Validate it exists
                                const { data: integration } = await supabase
                                    .from('company_integrations')
                                    .select('company_id')
                                    .eq('company_id', targetCompanyId)
                                    .eq('provider', 'whatsapp')
                                    .eq('is_active', true)
                                    .maybeSingle();
                                if (integration) companyId = integration.company_id;
                            }

                            // B. Fallback: Lookup by Phone Number ID in DB (Smart Multi-tenant)
                            if (!companyId && phoneNumberId) {
                                console.log(`Looking up company for PhoneID: ${phoneNumberId}`);
                                // Access JSONB field: credentials ->> 'phoneNumberId'
                                const { data: integ } = await supabase
                                    .from('company_integrations')
                                    .select('company_id')
                                    .eq('provider', 'whatsapp')
                                    .filter('credentials->>phoneNumberId', 'eq', phoneNumberId)
                                    .maybeSingle();

                                if (integ) companyId = integ.company_id;
                            }

                            if (!companyId) {
                                console.error(`No company found for WhatsApp Message (PhoneID: ${phoneNumberId})`);
                                continue;
                            }

                            // PROCESS MESSAGES
                            for (const msg of messages) {
                                const contact = change.value.contacts?.find((c: any) => c.wa_id === msg.from);
                                const senderName = contact?.profile?.name || msg.from;
                                const chatId = msg.from; // WhatsApp Phone Number with country code

                                let content = '';
                                let type = 'text';
                                let metadata: any = {
                                    whatsapp_id: msg.id,
                                    phone_number_id: phoneNumberId,
                                    raw_data: msg
                                };

                                if (msg.type === 'text') {
                                    content = msg.text.body;
                                } else if (msg.type === 'image') {
                                    type = 'image';
                                    content = '[Imagen recibida]';
                                    metadata.file_id = msg.image.id;
                                    metadata.mime_type = msg.image.mime_type;
                                } else if (msg.type === 'document') {
                                    type = 'file';
                                    content = `[Documento: ${msg.document.filename}]`;
                                    metadata.file_id = msg.document.id;
                                    metadata.fileName = msg.document.filename;
                                } else {
                                    content = `[Mensaje tipo ${msg.type}]`;
                                }

                                // RPC CALL
                                const { error } = await supabase.rpc('process_incoming_marketing_message', {
                                    p_company_id: companyId,
                                    p_channel: 'whatsapp',
                                    p_external_id: chatId,
                                    p_sender_name: senderName,
                                    p_content: content,
                                    p_metadata: metadata
                                });

                                if (error) console.error('RPC Error saving WhatsApp msg:', error);
                            }
                        }
                    }
                }
                return new Response('EVENT_RECEIVED', { status: 200 });
            } else {
                return new Response('Not a WhatsApp event', { status: 404 });
            }
        }

        return new Response('Method Not Allowed', { status: 405 });

    } catch (err) {
        console.error('Meta Webhook Error:', err);
        return new Response('Internal Error', { status: 500 });
    }
});
