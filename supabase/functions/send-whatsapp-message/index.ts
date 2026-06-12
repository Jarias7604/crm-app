// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * 🚀 OUTBOUND MESSAGE DISPATCHER (WhatsApp Meta Cloud API)
 * --------------------------------------------------------
 * ⚠️  REGLA DE ORO: Nunca hardcodear la versión de API.
 *     Meta depreca versiones cada ~6 meses. Actualizar META_API_VERSION
 *     cuando Meta anuncie deprecación.
 *     Referencia: developers.facebook.com/docs/graph-api/changelog
 *
 * Historial de versiones Meta Graph API:
 * - v17.0 → deprecated May 2025  ← ESTA ERA LA QUE TENÍAMOS - POR ESO FALLÓ
 * - v19.0 → deprecated Feb 2025
 * - v20.0 → deprecated May 2025
 * - v21.0 → deprecated Sep 2025
 * - v22.0 → CURRENT STABLE (2026)  ← ESTA USAMOS AHORA
 * - v23.0 → latest (2026)
 */

// ⚠️ ACTUALIZAR ESTO cuando Meta lance nuevas versiones (cada ~3 meses)
// Próxima revision: Septiembre 2026
const META_API_VERSION = "v22.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const payload = await req.json();
        const record = payload.record;

        if (!record || record.direction !== 'outbound' || record.status === 'delivered') {
            return new Response('Skipped', { status: 200, headers: corsHeaders });
        }

        const SUPABASE_URL = Deno.env.get('CRM_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')!;
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('CRM_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 1. Get Conversation Context
        const { data: conversation, error: convError } = await supabase
            .from('marketing_conversations')
            .select('external_id, channel, company_id')
            .eq('id', record.conversation_id)
            .single();

        if (convError || !conversation || conversation.channel !== 'whatsapp') {
            return new Response('Not WhatsApp or Conv missing', { status: 200, headers: corsHeaders });
        }

        const toPhone = conversation.external_id;
        const companyId = conversation.company_id;

        // 2. Fetch Meta Credentials (Multi-tenant)
        const { data: integration } = await supabase
            .from('marketing_integrations')
            .select('settings')
            .eq('company_id', companyId)
            .eq('provider', 'whatsapp')
            .eq('is_active', true)
            .maybeSingle();

        if (!integration?.settings?.token || !integration?.settings?.phoneNumberId) {
            console.error(`[send-whatsapp] ❌ Missing credentials for company ${companyId}`);
            await supabase.from('marketing_messages').update({
                status: 'failed',
                metadata: { ...record.metadata, error: 'Credentials (Token/PhoneID) missing. Configure WhatsApp in Integrations settings.' }
            }).eq('id', record.id);
            return new Response('Credentials missing', { status: 400, headers: corsHeaders });
        }

        const { token, phoneNumberId } = integration.settings;

        // 3. Build Meta API URL — version defined at top, never hardcoded inline
        const url = `https://graph.facebook.com/${META_API_VERSION}/${phoneNumberId}/messages`;
        console.log(`[send-whatsapp] Sending via Meta API ${META_API_VERSION} to ${toPhone}`);

        let body: any = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: toPhone,
            type: "text",
            text: { preview_url: false, body: record.content }
        };

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

        // 4. Send to Meta
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const result = await res.json();

        // 5. Handle Result — with actionable error messages
        if (!res.ok) {
            const errorCode = result?.error?.code;
            const errorMsg = result?.error?.message || 'Unknown Meta API error';

            let actionableError = errorMsg;
            if (errorCode === 3 && errorMsg.includes('granular permission')) {
                actionableError = `ACCION REQUERIDA: Meta API ${META_API_VERSION} deprecada o token sin permisos WABA. Ir a developers.facebook.com/docs/graph-api/changelog`;
            } else if (errorCode === 190) {
                actionableError = 'ACCION REQUERIDA: Token de WhatsApp expiró. Generar token permanente en Meta Business Manager.';
            } else if (errorCode === 100) {
                actionableError = `Número ${toPhone} mal formateado o no registrado en WhatsApp.`;
            }

            console.error(`[send-whatsapp] ❌ Meta Error ${errorCode}: ${actionableError}`);
            await supabase.from('marketing_messages').update({
                status: 'failed',
                metadata: { ...record.metadata, meta_error: result, actionable_error: actionableError, api_version_used: META_API_VERSION }
            }).eq('id', record.id);
            return new Response('Meta API Error', { status: 400, headers: corsHeaders });
        }

        // Success
        console.log(`[send-whatsapp] ✅ Delivered to ${toPhone} via ${META_API_VERSION}`);
        await supabase.from('marketing_messages').update({
            status: 'delivered',
            external_message_id: result.messages?.[0]?.id
        }).eq('id', record.id);

        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err) {
        console.error('[send-whatsapp] Global Error:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});
