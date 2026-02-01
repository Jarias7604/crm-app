// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * 🚀 OUTBOUND MESSAGE DISPATCHER (WhatsApp Meta Cloud API)
 * --------------------------------------------------------
 * Triggers on new outbound 'whatsapp' messages.
 * Reads credentials dynamically from 'company_integrations'.
 */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const payload = await req.json();
        const record = payload.record;

        // Validation
        if (!record || record.direction !== 'outbound' || record.status === 'delivered') {
            return new Response('Skipped', { status: 200, headers: corsHeaders });
        }

        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 1. Get Conversation Context (Company & External ID)
        const { data: conversation, error: convError } = await supabase
            .from('marketing_conversations')
            .select('external_id, channel, company_id')
            .eq('id', record.conversation_id)
            .single();

        if (convError || !conversation || conversation.channel !== 'whatsapp') {
            return new Response('Not WhatsApp or Conv missing', { status: 200, headers: corsHeaders });
        }

        const toPhone = conversation.external_id; // Valid E.164 phone number
        const companyId = conversation.company_id;

        // 2. Fetch Meta Credentials (Multi-tenant)
        const { data: integration } = await supabase
            .from('company_integrations')
            .select('credentials')
            .eq('company_id', companyId)
            .eq('provider', 'whatsapp')
            .eq('is_active', true)
            .single();

        // Check for required keys (token + phoneNumberId)
        if (!integration?.credentials?.token || !integration?.credentials?.phoneNumberId) {
            console.error(`Missing WhatsApp credentials for company ${companyId}`);
            await supabase.from('marketing_messages').update({
                status: 'failed',
                metadata: { ...record.metadata, error: 'Credentials (Token/PhoneID) missing' }
            }).eq('id', record.id);
            return new Response('Credentials missing', { status: 400, headers: corsHeaders });
        }

        const { token, phoneNumberId } = integration.credentials;

        // 3. Prepare Payload for Meta Graph API
        const url = `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`;

        let body: any = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: toPhone,
            type: "text",
            text: { preview_url: false, body: record.content }
        };

        // Handle Media (Simple image support for V1)
        if (record.type === 'image' && record.metadata?.url) {
            body = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: toPhone,
                type: "image",
                image: { link: record.metadata.url, caption: record.content || '' }
            };
        } else if (record.type === 'file' && record.metadata?.url) {
            body = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: toPhone,
                type: "document",
                document: { link: record.metadata.url, caption: record.content || '', filename: record.metadata.fileName || 'document.pdf' }
            };
        }

        console.log(`[Send-WhatsApp] Dispatching to ${toPhone} using PhoneID ${phoneNumberId}`);

        // 4. Send Request
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const result = await res.json();

        // 5. Handle Result
        if (!res.ok) {
            console.error('[Send-WhatsApp] Meta API Error:', JSON.stringify(result));
            await supabase.from('marketing_messages').update({
                status: 'failed',
                metadata: { ...record.metadata, meta_error: result }
            }).eq('id', record.id);
            return new Response('Meta API Error', { status: 400, headers: corsHeaders });
        }

        // Success!
        await supabase.from('marketing_messages').update({
            status: 'delivered',
            external_message_id: result.messages?.[0]?.id
        }).eq('id', record.id);

        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err) {
        console.error('[Send-WhatsApp] Global Error:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});
