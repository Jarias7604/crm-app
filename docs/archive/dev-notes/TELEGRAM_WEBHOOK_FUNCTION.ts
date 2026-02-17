import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req: Request) => {
    try {
        const payload = await req.json();
        console.log("Incoming Telegram Webhook:", payload);

        if (payload.message) {
            const chatId = payload.message.chat.id.toString();
            const text = payload.message.text || "";
            const firstName = payload.message.from.first_name || "Desconocido";
            const lastName = payload.message.from.last_name || "";
            const fullName = `${firstName} ${lastName}`.trim();

            // IMPORTANT: You need to know the company_id for this bot.
            // Usually you set this in an env var for the function or 
            // fetch it from the marketing_integrations table using the bot token.

            // For now, let's fetch the first active telegram integration to find the company
            const { data: interaction } = await supabase
                .from('marketing_integrations')
                .select('company_id')
                .eq('provider', 'telegram')
                .eq('is_active', true)
                .limit(1)
                .single();

            if (!interaction) {
                return new Response(JSON.stringify({ error: "No active telegram integration found" }), { status: 404 });
            }

            // CALL DB FUNCTION TO STORE AND HANDLE LEAD
            const { data, error } = await supabase.rpc('process_incoming_marketing_message', {
                p_company_id: interaction.company_id,
                p_channel: 'telegram',
                p_external_id: chatId,
                p_sender_name: fullName,
                p_content: text,
                p_metadata: { telegram_user: payload.message.from }
            });

            if (error) {
                console.error("Error processing message:", error);
                return new Response(JSON.stringify({ error: error.message }), { status: 500 });
            }

            return new Response(JSON.stringify({ success: true, conversation_id: data }), { status: 200 });
        }

        return new Response(JSON.stringify({ message: "Payload ok, no action" }), { status: 200 });
    } catch (err) {
        console.error("Webhook processing error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
});
