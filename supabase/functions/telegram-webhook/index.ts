// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Send a Telegram message using the company's bot token
async function sendTelegramMessage(botToken: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

serve(async (req) => {
  try {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    const update = await req.json();
    if (!update.message) return new Response('OK', { status: 200 });

    const msg = update.message;
    const chatId = msg.chat.id.toString();
    const senderName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ');

    // ── Identify company from URL param ─────────────────────────────────
    const url = new URL(req.url);
    const targetCompanyId = url.searchParams.get('company_id');
    if (!targetCompanyId) {
      console.error('CRITICAL: No company_id in webhook URL');
      return new Response('OK', { status: 200 });
    }

    const { data: integration } = await supabase
      .from('marketing_integrations')
      .select('company_id, settings')
      .eq('company_id', targetCompanyId)
      .eq('provider', 'telegram')
      .eq('is_active', true)
      .maybeSingle();

    const companyId = integration?.company_id;
    const botToken = integration?.settings?.token;

    if (!companyId) {
      console.error(`No active Telegram integration for company: ${targetCompanyId}`);
      return new Response('OK', { status: 200 });
    }

    // ── STAFF REGISTRATION: detect email from team member ────────────────
    // If the message is an email matching a profile in this company,
    // register their telegram_chat_id automatically — no tech knowledge needed.
    if (msg.text) {
      const emailPattern = /^[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}$/;
      const trimmedText = msg.text.trim().toLowerCase();

      if (emailPattern.test(trimmedText)) {
        const { data: staffProfile } = await supabase
          .from('profiles')
          .select('id, full_name, telegram_chat_id')
          .eq('email', trimmedText)
          .eq('company_id', companyId)
          .maybeSingle();

        if (staffProfile) {
          await supabase
            .from('profiles')
            .update({ telegram_chat_id: chatId })
            .eq('id', staffProfile.id);

          const firstName = staffProfile.full_name?.split(' ')[0] || 'equipo';
          const isUpdate = !!staffProfile.telegram_chat_id;

          if (botToken) {
            await sendTelegramMessage(
              botToken,
              chatId,
              isUpdate
                ? `✅ *Notificaciones actualizadas, ${firstName}!*\n\nEste chat ya está vinculado a tu cuenta del CRM.`
                : `✅ *¡Listo, ${firstName}!*\n\nTu Telegram ya está vinculado al CRM de Arias Defense.\n\nAhora recibirás notificaciones directamente aquí cuando un cliente avance a una etapa que tienes asignada. 🎉`
            );
          }

          console.log(`[Telegram] Staff registered: ${staffProfile.full_name} → chatId ${chatId}`);
          return new Response('OK', { status: 200 }); // Don't process as marketing message
        }
        // Email not in staff → fall through to normal marketing processing
      }
    }

    // ── NORMAL MARKETING MESSAGE PROCESSING ──────────────────────────────
    let content = '';
    let type = 'text';
    let metadata: any = {
      telegram_message_id: msg.message_id,
      raw_data: msg,
      phone: null
    };

    if (msg.text) {
      content = msg.text;
    } else if (msg.photo) {
      type = 'image';
      const photo = msg.photo[msg.photo.length - 1];
      content = '[Imagen recibida]';
      metadata.file_id = photo.file_id;
    } else if (msg.document) {
      type = 'file';
      content = `[Archivo: ${msg.document.file_name}]`;
      metadata.file_id = msg.document.file_id;
      metadata.fileName = msg.document.file_name;
    } else if (msg.voice) {
      type = 'audio';
      content = '[Nota de voz]';
      metadata.file_id = msg.voice.file_id;
      metadata.duration = msg.voice.duration;
      metadata.mime_type = msg.voice.mime_type;
      metadata.is_voice = true;
    } else if (msg.audio) {
      type = 'audio';
      content = `[Audio: ${msg.audio.title || 'Desconocido'}]`;
      metadata.file_id = msg.audio.file_id;
      metadata.duration = msg.audio.duration;
      metadata.fileName = msg.audio.file_name;
      metadata.is_voice = false;
    } else {
      return new Response('OK', { status: 200 });
    }

    metadata.type = type;

    const { data, error } = await supabase.rpc('process_incoming_marketing_message', {
      p_company_id: companyId,
      p_channel: 'telegram',
      p_external_id: chatId,
      p_sender_name: senderName || 'Usuario Telegram',
      p_content: content,
      p_metadata: metadata
    });

    if (!error && data) {
      const aiPromise = supabase.functions.invoke('ai-chat-processor', {
        body: { conversationId: data }
      });
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        EdgeRuntime.waitUntil(aiPromise);
      } else {
        aiPromise.catch(e => console.error('AI error:', e));
      }
    }

    if (error) {
      console.error('RPC Error:', error);
      return new Response('Internal Saved Error', { status: 200 });
    }

    return new Response(JSON.stringify({ success: true, conversation_id: data }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error('Webhook Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
