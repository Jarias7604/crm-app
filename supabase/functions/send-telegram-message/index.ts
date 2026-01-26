// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * 🚀 OUTBOUND MESSAGE DISPATCHER (Telegram)
 * ----------------------------------------
 * This function triggers when a new 'outbound' message is inserted into 'marketing_messages'.
 * It pushes the content/files to the external provider (Telegram API).
 */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // 1. Handle CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const payload = await req.json();

        // This is a Database Webhook payload or manual invoke
        const record = payload.record;

        if (!record || record.direction !== 'outbound' || record.status === 'delivered') {
            return new Response('Skipped', { status: 200, headers: corsHeaders });
        }

        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 1. Get Conversation to find Company and External ID
        const { data: conversation, error: convError } = await supabase
            .from('marketing_conversations')
            .select('external_id, channel, company_id')
            .eq('id', record.conversation_id)
            .single();

        if (convError || !conversation || conversation.channel !== 'telegram') {
            console.error('Conv Error or not Telegram:', convError);
            return new Response('Not Telegram or Conv not found', { status: 200, headers: corsHeaders });
        }

        const chatId = conversation.external_id;
        const companyId = conversation.company_id;

        // 2. Fetch the Telegram Token for this specific company
        const { data: integration, error: intError } = await supabase
            .from('marketing_integrations')
            .select('settings')
            .eq('company_id', companyId)
            .eq('type', 'telegram')
            .eq('is_active', true)
            .single();

        if (intError || !integration?.settings?.token) {
            console.error('Integration Token Error:', intError);
            await supabase.from('marketing_messages').update({
                status: 'failed',
                metadata: { ...record.metadata, error: 'Telegram Integration not configured or token missing for this company' }
            }).eq('id', record.id);
            return new Response('Integration Missing', { status: 400, headers: corsHeaders });
        }

        const botToken = integration.settings.token;

        // 3. SEND TO TELEGRAM
        let telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
        let body: any = {
            chat_id: chatId,
            text: record.content,
            parse_mode: 'HTML'
        };

        // Handle Files/Images
        if (record.type === 'file' || record.type === 'image') {
            const fileUrl = record.metadata?.url;
            if (fileUrl) {
                if (record.type === 'image') {
                    telegramUrl = `https://api.telegram.org/bot${botToken}/sendPhoto`;
                    body = { chat_id: chatId, photo: fileUrl, caption: record.content };
                } else {
                    telegramUrl = `https://api.telegram.org/bot${botToken}/sendDocument`;
                    body = { chat_id: chatId, document: fileUrl, caption: record.content };
                }
            }
        }

        const res = await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const telegramResult = await res.json();

        if (!telegramResult.ok) {
            console.error('Telegram API Error:', telegramResult);
            await supabase.from('marketing_messages').update({
                status: 'failed',
                metadata: { ...record.metadata, error: telegramResult }
            }).eq('id', record.id);
            return new Response('Telegram Error', { status: 400, headers: corsHeaders });
        }

        // 4. Mark as delivered
        await supabase.from('marketing_messages').update({
            status: 'delivered',
            external_message_id: telegramResult.result.message_id
        }).eq('id', record.id);

        return new Response(JSON.stringify(telegramResult), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error('Global Error in Edge Function:', err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
