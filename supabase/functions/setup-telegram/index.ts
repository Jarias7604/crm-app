// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { botToken, companyId } = await req.json();

        if (!botToken || !companyId) {
            throw new Error("Bot Token and Company ID are required");
        }

        // 1. Construct the Webhook URL (pointing to our valid public Edge Function)
        // We use the same project URL pattern.
        // NOTE: In production, Deno.env.get('SUPABASE_URL') usually gives the project URL.
        // We append /functions/v1/telegram-webhook
        // Query param ?company_id=XXX is crucial for multi-tenancy routing.

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook?company_id=${companyId}`;

        console.log(`Setting Telegram Webhook to: ${webhookUrl}`);

        // 2. Call Telegram API
        const telegramApi = `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;

        const response = await fetch(telegramApi);
        const data = await response.json();

        if (!data.ok) {
            throw new Error(`Telegram API Error: ${data.description}`);
        }

        return new Response(JSON.stringify({ success: true, telegram_response: data }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
