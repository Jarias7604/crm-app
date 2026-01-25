// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * 🚀 OUTBOUND MESSAGE DISPATCHER (Telegram)
 * ----------------------------------------
 * This function triggers when a new 'outbound' message is inserted into 'marketing_messages'.
 * It pushes the content/files to the external provider (Telegram API).
 */

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');

serve(async (req) => {
    try {
        const payload = await req.json();

        // This is a Database Webhook payload
        const record = payload.record;

        if (!record || record.direction !== 'outbound' || record.status === 'delivered') {
            return new Response('Skipped', { status: 200 });
        }

        // We need the conversation to get the external_id (chat_id)
        // Since the DB webhook payload only gives the record, we might need to fetch the conversation
        // OPTION B: The caller could pass context.
        // EASIER: Just fetch it.

        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        const { data: conversation } = await supabase
            .from('marketing_conversations')
            .select('external_id, channel')
            .eq('id', record.conversation_id)
            .single();

        if (!conversation || conversation.channel !== 'telegram') {
            return new Response('Not Telegram', { status: 200 });
        }

        const chatId = conversation.external_id;

        // SEND TO TELEGRAM
        let telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        let body: any = {
            chat_id: chatId,
            text: record.content,
            parse_mode: 'HTML' // Allow bold/italics
        };

        // Handle Files/Images
        if (record.type === 'file' || record.type === 'image') {
            const fileUrl = record.metadata?.url;
            if (fileUrl) {
                if (record.type === 'image') {
                    telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
                    body = { chat_id: chatId, photo: fileUrl, caption: record.content };
                } else {
                    telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`;
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
            // Mark as failed
            await supabase.from('marketing_messages').update({ status: 'failed', metadata: { ...record.metadata, error: telegramResult } }).eq('id', record.id);
            return new Response('Telegram Error', { status: 400 });
        }

        // Mark as delivered
        await supabase.from('marketing_messages').update({ status: 'delivered', external_message_id: telegramResult.result.message_id }).eq('id', record.id);

        return new Response(JSON.stringify(telegramResult), { headers: { 'Content-Type': 'application/json' } });

    } catch (err) {
        console.error(err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
});
