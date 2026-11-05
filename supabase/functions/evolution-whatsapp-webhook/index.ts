import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-evolution-apikey',
};

// 1. Detect greetings, courtesy replies, or closing agreements (e.g. "ok, de acuerdo, esta bien...")
// These must NEVER open a brand-new ticket on their own!
function isGreetingOrClosingAgreement(text: string): boolean {
  const clean = (text || '')
    .toLowerCase()
    .replace(/[¡!¿?.,;:👍🙏👌✅👋]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (clean.length < 4) return true;

  const startsWithAgreement =
    /^(ok|okay|va|dale|de acuerdo|esta bien|está bien|perfecto|excelente|entendido|muchas gracias|gracias|mil gracias|ah ok|ah bueno|listo|ya quedo|ya quedó|si esta bien|sí está bien|bueno)\b/i.test(
      clean
    );

  const hasExplicitNewErrorAfterOk =
    /\b(pero sigue|sigue dando error|no funciono|no funcionó|volvio a fallar|volvió a fallar|otro problema|otro error)\b/i.test(
      clean
    );

  if (startsWithAgreement && !hasExplicitNewErrorAfterOk) {
    return true;
  }

  const pureGreeting =
    /^(hola|buenas|buenos dias|buenos días|buenas tardes|buenas noches|saludos|hey|alo|aló)(\s+(equipo|melvin|gerson|soporte|amigo|amigos|inge|ingeniero|como estan|cómo están))?$/i.test(
      clean
    );

  return pureGreeting;
}

// 2. Detect if a message actually describes a problem, error, bug, or support request
function classifyIssueCategory(text: string): {
  category: string;
  shortCategoryTag: string;
  isActualSupportProblem: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
} {
  const lower = (text || '').toLowerCase();

  const urgentKeywords = [
    'urgente',
    'caido',
    'caído',
    'no funciona nada',
    'bloqueado',
    'no podemos facturar',
    'produccion',
    'producción',
    'error critico',
    'error crítico',
  ];

  const problemIndicators = [
    'error',
    'problema',
    'falla',
    'fallando',
    'fallo',
    'falló',
    'no deja',
    'no puedo',
    'no podemos',
    'no carga',
    'no sale',
    'no aparece',
    'no funciona',
    'no genera',
    'no transmite',
    'no envia',
    'no envía',
    'no cuadra',
    'ayuda',
    'ayudarme',
    'apoyo',
    'soporte',
    'revisar',
    'revisen',
    'arreglar',
    'corregir',
    'bug',
    'lento',
    'traba',
    'pegado',
    'rechaza',
    'rechazado',
    'inconveniente',
    'duda',
    'consulta sobre',
    'como hago',
    'cómo hago',
    'factura',
    'dte',
    'hacienda',
    'invalidacion',
    'invalidación',
    'credito fiscal',
    'crédito fiscal',
    'sello',
    'firmador',
    'contingencia',
    'planilla',
    'calculo',
    'cálculo',
    'permiso',
    'acceso',
    'contraseña',
    'login',
    'sincroniza',
    'base de datos',
  ];

  const isUrgent = urgentKeywords.some((k) => lower.includes(k));
  const hasProblemKeyword = problemIndicators.some((k) => lower.includes(k));
  const isClosingOrGreeting = isGreetingOrClosingAgreement(text);

  const isActualSupportProblem = (isUrgent || hasProblemKeyword) && !isClosingOrGreeting;

  let category = 'Soporte General / Consulta';
  let shortCategoryTag = 'Soporte';

  if (
    /dte|hacienda|factura|invalidaci|credito fiscal|crédito fiscal|fe\b|contingencia|sello|firmador/i.test(
      lower
    )
  ) {
    category = 'Facturación Electrónica / DTE / Hacienda';
    shortCategoryTag = 'Facturación DTE';
  } else if (/whatsapp|mensaje|cola|api|envio|envío|notificaci/i.test(lower)) {
    category = 'WhatsApp / Mensajería / API';
    shortCategoryTag = 'WhatsApp API';
  } else if (/login|acceso|usuario|permiso|contrase|rol|sesion|sesión/i.test(lower)) {
    category = 'Accesos / Usuarios / Permisos';
    shortCategoryTag = 'Accesos/Permisos';
  } else if (/reporte|excel|pdf|descarga|filtro|estadistica|dashboard/i.test(lower)) {
    category = 'Reportes / Exportación / Datos';
    shortCategoryTag = 'Reportes';
  } else if (/calculo|cálculo|monto|iva|total|descuento|planilla|pago|cobro/i.test(lower)) {
    category = 'Cálculos / Finanzas / Pagos';
    shortCategoryTag = 'Cálculos/Pagos';
  } else if (/lento|carga|caido|caído|servidor|base de datos|sql|sincroni/i.test(lower)) {
    category = 'Infraestructura / Base de Datos / Lentitud';
    shortCategoryTag = 'Base de Datos/Server';
  }

  return {
    category,
    shortCategoryTag,
    isActualSupportProblem,
    priority: isUrgent ? 'urgent' : 'high',
  };
}

function isGenericProblemTitle(title: string): boolean {
  const lower = (title || '').toLowerCase();
  return (
    lower.length < 32 ||
    /tengo un problema|necesito ayuda|una consulta|me ayudan|hay un error|no funciona$/i.test(
      lower
    )
  );
}

async function resolveMainCompanyId(
  supabase: any,
  companyIdParam: string | null
): Promise<string | null> {
  if (companyIdParam) return companyIdParam;

  const { data: recentTicket } = await supabase
    .from('tickets')
    .select('company_id')
    .not('company_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentTicket?.company_id) return recentTicket.company_id;

  const { data: mainProf } = await supabase
    .from('profiles')
    .select('company_id')
    .or('email.ilike.%jarias%,full_name.ilike.%Melvin%,full_name.ilike.%Gerson%')
    .not('company_id', 'is', null)
    .limit(1)
    .maybeSingle();

  if (mainProf?.company_id) return mainProf.company_id;

  const { data: comp } = await supabase
    .from('companies')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return comp?.id || null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('CRM_SUPABASE_URL') || Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey =
    Deno.env.get('CRM_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const getAction = url.searchParams.get('action');

    // Zero-restart local bridge for Gerson's localhost:8085 Evolution API (no YML edit, no Docker restart)
    if (getAction === 'bridge_sh') {
      const { data: recentTickets } = await supabase
        .from('tickets')
        .select('id, metadata')
        .order('updated_at', { ascending: false })
        .limit(25);

      const shellLines: string[] = [];
      for (const row of recentTickets || []) {
        const m = row.metadata || {};
        const queue: any[] = Array.isArray(m.pending_whatsapp_outbox) ? m.pending_whatsapp_outbox : [];
        const pendingItems = queue.filter((item) => item && item.status === 'pending');

        const audioQueue: any[] = Array.isArray(m.pending_audio_jobs) ? m.pending_audio_jobs : [];
        const pendingAudio = audioQueue.filter((item) => item && item.status === 'pending');

        if (pendingItems.length === 0 && pendingAudio.length === 0) continue;

        const updatedQueue = queue.map((item) =>
          item && item.status === 'pending'
            ? { ...item, status: 'dispatched', dispatched_at: new Date().toISOString() }
            : item
        );
        const updatedAudioQueue = audioQueue.map((item) =>
          item && item.status === 'pending'
            ? { ...item, status: 'dispatched', dispatched_at: new Date().toISOString() }
            : item
        );

        await supabase
          .from('tickets')
          .update({
            metadata: {
              ...m,
              pending_whatsapp_outbox: updatedQueue.slice(-10),
              pending_audio_jobs: updatedAudioQueue.slice(-10),
            },
          })
          .eq('id', row.id);

        for (const item of pendingItems) {
          const payloadJson = JSON.stringify({
            number: item.number,
            text: item.text,
          });
          const b64Payload = btoa(unescape(encodeURIComponent(payloadJson)));
          const rawInst = !item.instance || item.instance === 'arias' ? 'soporte' : item.instance;
          const inst = rawInst.replace(/[^a-zA-Z0-9_-]/g, '');
          const key = (item.apikey || '10C73BF4-D3D9-4CDB-9855-85E346468546').replace(/[^a-zA-Z0-9_-]/g, '');
          shellLines.push(
            `EVO_OUT=$(echo "${b64Payload}" | base64 -d | curl -s -X POST "http://localhost:8085/message/sendText/${inst}" -H "Content-Type: application/json" -H "apikey: ${key}" -d @-); curl -s -X POST "https://mtxqqamitglhehaktgxm.supabase.co/functions/v1/evolution-whatsapp-webhook?action=bridge_ack&ticket_id=${row.id}" -H "Content-Type: application/json" -d "{\\"action\\":\\"bridge_ack\\",\\"ticket_id\\":\\"${row.id}\\",\\"evo_response\\":$(echo "$EVO_OUT" | jq -Rs . 2>/dev/null || echo '""')}" >/dev/null 2>&1`
          );
        }

        for (const aJob of pendingAudio) {
          const rawInst = !aJob.instance || aJob.instance === 'arias' ? 'soporte' : aJob.instance;
          const inst = rawInst.replace(/[^a-zA-Z0-9_-]/g, '');
          const key = (aJob.apikey || '10C73BF4-D3D9-4CDB-9855-85E346468546').replace(/[^a-zA-Z0-9_-]/g, '');
          const uploadUrl = `https://mtxqqamitglhehaktgxm.supabase.co/functions/v1/evolution-whatsapp-webhook?action=upload_voice_note&ticket_id=${row.id}&comment_id=${aJob.comment_id || ''}&auto_reply=${aJob.auto_reply !== false ? '1' : '0'}`;

          if (aJob.message_key?.id) {
            const mediaReqJson = JSON.stringify({
              message: { key: aJob.message_key },
              convertToMp4: false,
            });
            const b64MediaReq = btoa(unescape(encodeURIComponent(mediaReqJson)));
            shellLines.push(
              `echo "${b64MediaReq}" | base64 -d | curl -s -X POST "http://localhost:8085/chat/getBase64FromMediaMessage/${inst}" -H "Content-Type: application/json" -H "apikey: ${key}" -d @- | curl -s -X POST "${uploadUrl}" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1`
            );
          } else if (aJob.remote_jid) {
            // Find the latest audioMessage key from Evolution chat/findMessages and then extract base64
            const findReqJson = JSON.stringify({
              where: { key: { remoteJid: aJob.remote_jid } },
            });
            const b64FindReq = btoa(unescape(encodeURIComponent(findReqJson)));
            shellLines.push(
              `MSG_KEY=$(echo "${b64FindReq}" | base64 -d | curl -s -X POST "http://localhost:8085/chat/findMessages/${inst}" -H "Content-Type: application/json" -H "apikey: ${key}" -d @- | jq -c '(.. | objects | select(.messageType? == "audioMessage" or .message?.audioMessage != null) | .key) // empty' 2>/dev/null | head -n 1); if [ -n "$MSG_KEY" ]; then curl -s -X POST "http://localhost:8085/chat/getBase64FromMediaMessage/${inst}" -H "Content-Type: application/json" -H "apikey: ${key}" -d "{\\"message\\":{\\"key\\":$MSG_KEY},\\"convertToMp4\\":false}" | curl -s -X POST "${uploadUrl}" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1; fi`
            );
          }
        }
      }

      return new Response(shellLines.length > 0 ? shellLines.join('\n') + '\n' : '# idle\n', {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        status: 'active',
        service: 'evolution-whatsapp-webhook (50379718911 - Tickets Only, Zero Leads)',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const payload = await req.json();
    const companyIdParam = url.searchParams.get('company_id');
    const queryAction = url.searchParams.get('action') || payload?.action;

    // ─── SAVE CUSTOM AI VOICE/CHAT INSTRUCTIONS PROMPT ────────────────────────
    if (queryAction === 'save_ai_prompt' && payload?.ticket_id) {
      const { data: tRow } = await supabase
        .from('tickets')
        .select('metadata')
        .eq('id', payload.ticket_id)
        .maybeSingle();
      if (tRow) {
        await supabase
          .from('tickets')
          .update({
            metadata: {
              ...(tRow.metadata || {}),
              ai_voice_prompt: payload.ai_voice_prompt || '',
              ai_auto_reply_enabled: payload.ai_auto_reply_enabled !== false,
            },
          })
          .eq('id', payload.ticket_id);
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── PROCESS VOICE NOTE UPLOADED BY GERSON'S LOCAL BRIDGE (Playable + Whisper + AI Reply) ───
    if (queryAction === 'upload_voice_note') {
      const ticketId = url.searchParams.get('ticket_id') || payload?.ticket_id;
      const commentId = url.searchParams.get('comment_id') || payload?.comment_id;
      const autoReplyFlag = (url.searchParams.get('auto_reply') || '1') !== '0';
      const rawBase64: string =
        payload?.base64 ||
        payload?.data?.base64 ||
        payload?.message?.base64 ||
        '';

      if (!ticketId || !rawBase64) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Missing ticket_id or base64 audio' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const cleanBase64 = rawBase64.replace(/^data:[^;]+;base64,/, '').trim();
      const binaryStr = atob(cleanBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const fileName = `tickets/voice-notes/${ticketId}-${commentId || Date.now()}.ogg`;
      await supabase.storage.from('lead-documents').upload(fileName, bytes.buffer, {
        contentType: 'audio/ogg',
        upsert: true,
      });

      const publicAudioUrl = `${supabaseUrl}/storage/v1/object/public/lead-documents/${fileName}`;

      // Fetch ticket & OpenAI API key for Whisper transcription + AI auto-reply
      const { data: ticketRow } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', ticketId)
        .maybeSingle();

      const { data: openAiInt } = await supabase
        .from('marketing_integrations')
        .select('settings')
        .eq('provider', 'openai')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      const openAiKey =
        openAiInt?.settings?.apiKey || Deno.env.get('OPENAI_API_KEY') || '';

      let transcriptText = '';
      if (openAiKey) {
        try {
          const form = new FormData();
          const audioBlob = new Blob([bytes], { type: 'audio/ogg' });
          form.append('file', audioBlob, 'voice.ogg');
          form.append('model', 'whisper-1');
          form.append('language', 'es');

          const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${openAiKey}`,
            },
            body: form,
          });
          if (whisperRes.ok) {
            const wJson = await whisperRes.json();
            transcriptText = (wJson?.text || '').trim();
          }
        } catch (wErr) {
          console.error('Whisper error:', wErr);
        }
      }

      // Update the comment with [AUDIO_URL:...] and the AI transcription!
      if (commentId) {
        const { data: existingComment } = await supabase
          .from('ticket_comments')
          .select('body')
          .eq('id', commentId)
          .maybeSingle();

        if (existingComment) {
          const cleanPrevBody = (existingComment.body || '')
            .replace(/👨‍💻\s*Jimmy Arias:/i, '👤 Jimmy Arias:')
            .replace(/\s*\[AUDIO_URL:[^\]]+\]/g, '');
          const updatedBody = transcriptText
            ? `${cleanPrevBody} [AUDIO_URL:${publicAudioUrl}]\n📝 Transcripción IA: "${transcriptText}"`
            : `${cleanPrevBody} [AUDIO_URL:${publicAudioUrl}]`;

          await supabase
            .from('ticket_comments')
            .update({ body: updatedBody, author_id: null })
            .eq('id', commentId);
        }
      }

      // Generate & send automatic AI reply if enabled
      let aiReplySent = false;
      let aiReplyText = '';
      if (ticketRow && autoReplyFlag && openAiKey) {
        const meta = ticketRow.metadata || {};
        const customPrompt =
          meta.ai_voice_prompt ||
          'Eres el Asistente IA de Soporte Técnico de Arias Defense / ERP Facturación Electrónica (DTE Hacienda). Escucha lo que el cliente dijo en su nota de voz y respóndele de forma amable, clara y resolutiva en máximo 3 líneas por WhatsApp. Confírmale exactamente que entendiste su reporte y pídele captura de pantalla o código de AnyDesk si requiere revisión técnica.';

        try {
          const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${openAiKey}`,
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              temperature: 0.4,
              messages: [
                { role: 'system', content: customPrompt },
                {
                  role: 'user',
                  content: transcriptText
                    ? `El cliente (${ticketRow.lead_name || 'Cliente'}) envió una nota de voz diciendo: "${transcriptText}". Redacta la respuesta que se enviará a su WhatsApp.`
                    : `El cliente (${ticketRow.lead_name || 'Cliente'}) envió una nota de voz de soporte técnico. Redacta una respuesta amable confirmando recepción de su nota de voz y que el equipo técnico ya la está escuchando para apoyarle.`,
                },
              ],
            }),
          });
          if (gptRes.ok) {
            const gptJson = await gptRes.json();
            aiReplyText = (gptJson?.choices?.[0]?.message?.content || '').trim();
          }
        } catch (gErr) {
          console.error('GPT auto-reply error:', gErr);
        }

        if (aiReplyText) {
          const nowTimeStr = new Date().toLocaleTimeString('es-SV', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/El_Salvador',
          });
          const aiFormattedLine = `[${nowTimeStr}] 👨‍💻 🤖 IA Soporte: ${aiReplyText}`;

          await supabase.from('ticket_comments').insert({
            ticket_id: ticketId,
            company_id: ticketRow.company_id,
            author_id: null,
            body: aiFormattedLine,
            is_internal: false,
          });

          const targetJid = meta.whatsapp_jid || meta.whatsapp_phone || '';
          const prevOutbox: any[] = Array.isArray(meta.pending_whatsapp_outbox)
            ? meta.pending_whatsapp_outbox
            : [];
          const updatedOutbox = targetJid
            ? [
                ...prevOutbox.slice(-9),
                {
                  id: crypto.randomUUID(),
                  status: 'pending',
                  number: targetJid,
                  text: aiReplyText,
                  instance:
                    !meta.evolution_instance || meta.evolution_instance === 'arias'
                      ? 'soporte'
                      : meta.evolution_instance,
                  apikey: meta.evolution_apikey || '10C73BF4-D3D9-4CDB-9855-85E346468546',
                  created_at: new Date().toISOString(),
                },
              ]
            : prevOutbox;

          await supabase
            .from('tickets')
            .update({
              updated_at: new Date().toISOString(),
              metadata: {
                ...meta,
                last_audio_url: publicAudioUrl,
                last_audio_transcript: transcriptText,
                last_whatsapp_message: aiReplyText.slice(0, 200),
                last_whatsapp_at: new Date().toISOString(),
                pending_whatsapp_outbox: updatedOutbox,
              },
            })
            .eq('id', ticketId);

          aiReplySent = true;
        }
      }

      return new Response(
        JSON.stringify({
          ok: true,
          audio_url: publicAudioUrl,
          transcript: transcriptText,
          ai_reply_sent: aiReplySent,
          ai_reply_text: aiReplyText,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (payload?.action === 'bridge_ack' && payload?.ticket_id) {
      const { data: tRow } = await supabase
        .from('tickets')
        .select('metadata')
        .eq('id', payload.ticket_id)
        .maybeSingle();
      if (tRow) {
        await supabase
          .from('tickets')
          .update({
            metadata: {
              ...(tRow.metadata || {}),
              last_bridge_ack_at: new Date().toISOString(),
              last_bridge_evo_response: payload.evo_response || null,
            },
          })
          .eq('id', payload.ticket_id);
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── OUTBOUND REPLY FROM CRM SUPPORT CHAT ("Circles / Live Chat") ─────────
    if (payload?.action === 'send_reply') {
      const {
        ticket_id,
        company_id,
        author_id,
        author_name,
        message_text,
        response_minutes,
        custom_evolution_url,
        custom_evolution_key,
        custom_evolution_instance,
      } = payload;

      if (!ticket_id || !message_text?.trim()) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Missing ticket_id or message_text' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: ticketRow } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', ticket_id)
        .maybeSingle();

      if (!ticketRow) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Ticket not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const nowTimeStr = new Date().toLocaleTimeString('es-SV', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/El_Salvador',
      });
      const techLabel = `👨‍💻 ${author_name || 'Soporte CRM'}`;
      const formattedLine = `[${nowTimeStr}] ${techLabel}: ${message_text.trim()}`;

      // 1. Insert into ticket_comments
      const { data: createdComment } = await supabase
        .from('ticket_comments')
        .insert({
          ticket_id,
          company_id: company_id || ticketRow.company_id,
          author_id: author_id || null,
          body: formattedLine,
          is_internal: false,
        })
        .select('*')
        .single();

      // 2. Append to ticket description + track staff text reply metrics
      const meta = ticketRow.metadata || {};
      const prevDesc = ticketRow.description || '';
      const updatedDescription = prevDesc.includes('💬 Historial de WhatsApp:')
        ? `${prevDesc}\n${formattedLine}`
        : `${prevDesc}\n\n💬 Historial de WhatsApp:\n${formattedLine}`;

      const prevReplies = Number(meta.staff_text_reply_count || 0) + 1;
      const prevReplyMins = Number(meta.text_reply_minutes || 0) + (Number(response_minutes) || 2);

      let evoKey =
        custom_evolution_key ||
        meta.evolution_apikey ||
        Deno.env.get('EVOLUTION_API_KEY') ||
        '10C73BF4-D3D9-4CDB-9855-85E346468546';
      let evoInstance =
        custom_evolution_instance ||
        meta.evolution_instance ||
        Deno.env.get('EVOLUTION_INSTANCE') ||
        'soporte';
      if (evoInstance === 'arias') evoInstance = 'soporte';

      const targetNumberOrJid = meta.whatsapp_jid || meta.whatsapp_phone || '';
      let whatsappDelivered = Boolean(targetNumberOrJid);
      let whatsappDeliveryNote = 'QUEUED_TO_ACTIVE_LOCAL_BRIDGE';

      const prevOutbox: any[] = Array.isArray(meta.pending_whatsapp_outbox)
        ? meta.pending_whatsapp_outbox
        : [];
      const outboxItemId = crypto.randomUUID();
      const updatedOutbox = targetNumberOrJid
        ? [
            ...prevOutbox.slice(-9),
            {
              id: outboxItemId,
              status: 'pending',
              number: targetNumberOrJid,
              text: message_text.trim(),
              instance: evoInstance || 'soporte',
              apikey: evoKey || '10C73BF4-D3D9-4CDB-9855-85E346468546',
              created_at: new Date().toISOString(),
            },
          ]
        : prevOutbox;

      const updatedMeta = {
        ...meta,
        whatsapp_message_count: Number(meta.whatsapp_message_count || 1) + 1,
        last_whatsapp_message: message_text.trim().slice(0, 200),
        last_whatsapp_at: new Date().toISOString(),
        last_staff_reply_at: new Date().toISOString(),
        last_staff_reply_by: author_name || 'Soporte',
        staff_text_reply_count: prevReplies,
        text_reply_minutes: prevReplyMins,
        pending_whatsapp_outbox: updatedOutbox,
        ...(custom_evolution_key ? { evolution_apikey: custom_evolution_key } : {}),
        ...(custom_evolution_instance ? { evolution_instance: custom_evolution_instance } : {}),
      };

      const updateTicketPayload: Record<string, any> = {
        description: updatedDescription,
        updated_at: new Date().toISOString(),
        metadata: updatedMeta,
      };
      if (author_id && !ticketRow.assigned_to) {
        updateTicketPayload.assigned_to = author_id;
      }

      await supabase.from('tickets').update(updateTicketPayload).eq('id', ticket_id);

      return new Response(
        JSON.stringify({
          ok: true,
          action: 'reply_logged',
          whatsapp_delivered: whatsappDelivered,
          whatsapp_note: whatsappDeliveryNote,
          comment: createdComment,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const eventType = String(payload?.event || payload?.type || 'messages.upsert').toLowerCase();
    const instanceName = payload?.instance || payload?.instanceName || 'soporte';
    const rawEvoServerUrl = payload?.server_url || payload?.serverUrl || '';
    const callerPublicIp =
      req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-real-ip') ||
      (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
      '';
    const incomingEvoServerUrl =
      /localhost|127\.0\.0\.1/i.test(rawEvoServerUrl) && callerPublicIp
        ? rawEvoServerUrl.replace(/localhost|127\.0\.0\.1/i, callerPublicIp)
        : rawEvoServerUrl;
    const incomingEvoApiKey =
      payload?.apikey ||
      req.headers.get('apikey') ||
      req.headers.get('x-evolution-apikey') ||
      '10C73BF4-D3D9-4CDB-9855-85E346468546';

    const rawData = payload?.data || payload;
    const msgEntry = Array.isArray(rawData)
      ? rawData[0]
      : Array.isArray(rawData?.messages)
      ? rawData.messages[0]
      : rawData;

    const key = msgEntry?.key || payload?.key || {};
    const remoteJid: string =
      key?.remoteJid || msgEntry?.remoteJid || payload?.remoteJid || payload?.sender || '';

    if (!remoteJid || remoteJid === 'status@broadcast') {
      return new Response(
        JSON.stringify({ ok: true, ignored: true, reason: 'Status broadcast ignored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fromMe: boolean = Boolean(key?.fromMe ?? msgEntry?.fromMe ?? false);
    const participant: string = key?.participant || msgEntry?.participant || '';
    const remoteJidAlt: string = key?.remoteJidAlt || msgEntry?.remoteJidAlt || '';
    const pushName: string =
      msgEntry?.pushName || payload?.pushName || payload?.sender || 'Cliente WhatsApp';

    const msgObj = msgEntry?.message || payload?.message || {};
    const messageText: string =
      msgObj?.conversation ||
      msgObj?.extendedTextMessage?.text ||
      msgObj?.imageMessage?.caption ||
      msgObj?.videoMessage?.caption ||
      msgObj?.documentMessage?.caption ||
      msgObj?.buttonsResponseMessage?.selectedDisplayText ||
      msgObj?.listResponseMessage?.title ||
      msgEntry?.body ||
      msgEntry?.text ||
      (msgObj?.imageMessage ? '[📷 Imagen enviada por WhatsApp]' : '') ||
      (msgObj?.audioMessage ? '[🎤 Nota de voz enviada por WhatsApp]' : '') ||
      (msgObj?.documentMessage
        ? `[📄 Documento: ${msgObj.documentMessage.fileName || 'Archivo'}]`
        : '') ||
      '';

    if (!messageText || messageText.trim().length < 1) {
      return new Response(
        JSON.stringify({
          ok: true,
          ignored: true,
          event: eventType,
          reason: 'No text or media content in payload',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isGroup = remoteJid.endsWith('@g.us');
    const isLid = remoteJid.endsWith('@lid') && !remoteJidAlt;

    const rawJidForPhone = remoteJidAlt || (isGroup ? participant : remoteJid);
    const digitsOnly = rawJidForPhone
      .replace(/@s\.whatsapp\.net|@g\.us|@c\.us|@lid/g, '')
      .replace(/\D/g, '');
    const isRealPhone = !isLid && digitsOnly.length >= 8 && digitsOnly.length <= 12;
    const cleanPhone = isRealPhone ? digitsOnly : '';

    const companyId = await resolveMainCompanyId(supabase, companyIdParam);
    if (!companyId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No company_id resolved' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load internal company team profiles (Melvin, Gerson, etc.) so we know when a technician is speaking!
    const { data: companyProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('company_id', companyId);

    const matchedTechProfile = (companyProfiles || []).find((p: any) => {
      const fullName = (p.full_name || '').toLowerCase().trim();
      const senderLower = (pushName || '').toLowerCase().trim();
      if (!fullName || !senderLower || senderLower === 'cliente whatsapp') return false;
      if (
        (senderLower.includes('gerson') && fullName.includes('gerson')) ||
        (senderLower.includes('melvin') && fullName.includes('melvin'))
      ) {
        return true;
      }
      return false;
    });

    const isTeamStaffReply = fromMe || Boolean(matchedTechProfile);
    const isIncomingAudio = Boolean(msgObj?.audioMessage) && !fromMe;

    // ⚠️ IMPORTANT: NEVER call process_incoming_marketing_message and NEVER insert into `leads`!
    // We ONLY read `leads` (read-only) to see if the phone belongs to an existing client name.
    let matchedLead: { id: string; name: string; phone: string | null } | null = null;
    if (!isTeamStaffReply && cleanPhone && cleanPhone.length >= 8) {
      const last8 = cleanPhone.slice(-8);
      const { data: leadsByPhone } = await supabase
        .from('leads')
        .select('id, name, phone')
        .eq('company_id', companyId)
        .ilike('phone', `%${last8}%`)
        .limit(1);
      if (leadsByPhone && leadsByPhone.length > 0) {
        matchedLead = leadsByPhone[0];
      }
    }

    const clientDisplayName =
      matchedLead?.name ||
      (pushName && pushName !== 'Cliente WhatsApp'
        ? cleanPhone
          ? `${pushName} (+${cleanPhone})`
          : pushName
        : cleanPhone
        ? `WhatsApp +${cleanPhone}`
        : 'Cliente WhatsApp');

    const classification = classifyIssueCategory(messageText);
    const nowTimeStr = new Date().toLocaleTimeString('es-SV', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/El_Salvador',
    });
    const senderLabel = isTeamStaffReply
      ? `👨‍💻 ${matchedTechProfile?.full_name || 'Equipo Soporte'}`
      : `👤 ${pushName || 'Cliente'}`;

    // Find if this client/group ALREADY has an active ticket (or one closed in the last 4 hours)
    const { data: recentClientTickets } = await supabase
      .from('tickets')
      .select(
        'id, title, status, priority, assigned_to, metadata, description, lead_id, lead_name, resolved_at, created_at'
      )
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(80);

    const matchingClientTickets = (recentClientTickets || []).filter((t: any) => {
      const meta = t.metadata || {};
      if (remoteJid && meta.whatsapp_jid === remoteJid) return true;
      if (cleanPhone && meta.whatsapp_phone === cleanPhone) return true;
      if (matchedLead?.id && t.lead_id === matchedLead.id) return true;
      if (
        !isTeamStaffReply &&
        pushName &&
        pushName.length >= 4 &&
        t.lead_name &&
        t.lead_name.toLowerCase().includes(pushName.toLowerCase())
      ) {
        return true;
      }
      return false;
    });

    const activeTicket = matchingClientTickets.find((t: any) =>
      ['new', 'open', 'pending'].includes(t.status)
    );

    const recentlyClosedTicket = !activeTicket
      ? matchingClientTickets.find((t: any) => {
          if (!['resolved', 'closed'].includes(t.status)) return false;
          const closedTime = new Date(t.resolved_at || t.created_at).getTime();
          const hoursSinceClosed = (Date.now() - closedTime) / (1000 * 60 * 60);
          return hoursSinceClosed <= 4;
        })
      : null;

    const isResolutionReply =
      isTeamStaffReply &&
      /listo|resuelto|solucionado|arreglado|ya quedo|ya quedó|corregido|actualizado/i.test(
        messageText
      );

    // ─── CASE A: Client/Group ALREADY has an open/pending Ticket ──────────────
    // Append all 40 messages into THIS SAME TICKET (both in Notas and in Descripción)!
    if (activeTicket) {
      const { data: insertedComment } = await supabase
        .from('ticket_comments')
        .insert({
          ticket_id: activeTicket.id,
          company_id: companyId,
          author_id: matchedTechProfile?.id || null,
          body: `[${nowTimeStr}] ${senderLabel}: ${messageText}`,
          is_internal: false,
        })
        .select('id')
        .single();

      const currentMeta = activeTicket.metadata || {};
      const msgCount = Number(currentMeta.whatsapp_message_count || 1) + 1;
      const prevAudioJobs: any[] = Array.isArray(currentMeta.pending_audio_jobs)
        ? currentMeta.pending_audio_jobs
        : [];
      const updatedAudioJobs =
        isIncomingAudio && insertedComment?.id
          ? [
              ...prevAudioJobs.slice(-9),
              {
                id: crypto.randomUUID(),
                status: 'pending',
                comment_id: insertedComment.id,
                ticket_id: activeTicket.id,
                remote_jid: remoteJid,
                message_key: key,
                instance: instanceName === 'arias' ? 'soporte' : instanceName || 'soporte',
                apikey: incomingEvoApiKey || '10C73BF4-D3D9-4CDB-9855-85E346468546',
                auto_reply: currentMeta.ai_auto_reply_enabled !== false,
                created_at: new Date().toISOString(),
              },
            ]
          : prevAudioJobs;

      const shouldUpgradeProblemTitle =
        !isTeamStaffReply &&
        classification.isActualSupportProblem &&
        isGenericProblemTitle(activeTicket.title) &&
        messageText.length >= 15;

      const prevDesc = activeTicket.description || '';
      const newChatLine = `[${nowTimeStr}] ${senderLabel}: ${messageText}`;
      const updatedDescription = prevDesc.includes('💬 Historial de WhatsApp:')
        ? `${prevDesc}\n${newChatLine}`
        : `${prevDesc}\n\n💬 Historial de WhatsApp:\n${newChatLine}`;

      const updatedFields: Record<string, any> = {
        description: updatedDescription,
        updated_at: new Date().toISOString(),
        metadata: {
          ...currentMeta,
          whatsapp_message_count: msgCount,
          last_whatsapp_message: messageText.slice(0, 200),
          last_whatsapp_at: new Date().toISOString(),
          pending_audio_jobs: updatedAudioJobs,
          ...(incomingEvoServerUrl ? { evolution_server_url: incomingEvoServerUrl } : {}),
          ...(incomingEvoApiKey ? { evolution_apikey: incomingEvoApiKey } : {}),
          evolution_instance: instanceName === 'arias' ? 'soporte' : instanceName || currentMeta.evolution_instance || 'soporte',
          ai_category: shouldUpgradeProblemTitle
            ? classification.category
            : currentMeta.ai_category || classification.category,
        },
      };

      // Auto-assign ticket to Melvin or Gerson if they reply to it and it was unassigned!
      if (matchedTechProfile?.id && !activeTicket.assigned_to) {
        updatedFields.assigned_to = matchedTechProfile.id;
      }

      if (shouldUpgradeProblemTitle) {
        const cleanSnippet =
          messageText.length > 85 ? `${messageText.slice(0, 82).trim()}...` : messageText.trim();
        updatedFields.title = `[WhatsApp · ${classification.shortCategoryTag}] ${clientDisplayName}: ${cleanSnippet}`;
      }

      if (isResolutionReply) {
        updatedFields.status = 'resolved';
        updatedFields.resolved_at = new Date().toISOString();
        updatedFields.last_status_change_at = new Date().toISOString();
        updatedFields.solution = messageText;
      }

      await supabase.from('tickets').update(updatedFields).eq('id', activeTicket.id);

      return new Response(
        JSON.stringify({
          ok: true,
          action: isResolutionReply ? 'ticket_resolved' : 'message_appended_to_existing_ticket',
          ticket_id: activeTicket.id,
          total_messages_in_ticket: msgCount,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── CASE B: Sender is a Team Member (Melvin/Gerson) and no open ticket exists
    // Never create a support ticket where Melvin or Gerson is the "client"!
    if (isTeamStaffReply) {
      return new Response(
        JSON.stringify({
          ok: true,
          ignored: true,
          reason: 'Staff message with no open ticket — ignored so staff never creates self-tickets',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── CASE C: Message is an agreement/courtesy/greeting ("ok, de acuerdo, esta bien...", "Hola", "Gracias")
    if (!classification.isActualSupportProblem) {
      if (recentlyClosedTicket) {
        await supabase.from('ticket_comments').insert({
          ticket_id: recentlyClosedTicket.id,
          company_id: companyId,
          body: `[${nowTimeStr}] ${senderLabel}: ${messageText}`,
          is_internal: false,
        });
      }

      return new Response(
        JSON.stringify({
          ok: true,
          ignored: true,
          action: 'non_problem_message_ignored',
          reason: 'Greeting or agreement reply — no ticket or lead created',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── CASE D: Client reports an ACTUAL PROBLEM and has NO open ticket ─────
    // Create 1 consolidated Ticket in `tickets` ONLY (NEVER in `leads`!)
    const shortTitle =
      messageText.length > 85 ? `${messageText.slice(0, 82).trim()}...` : messageText.trim();

    const previousSameCategoryTicket = matchingClientTickets.find(
      (t: any) =>
        ['resolved', 'closed'].includes(t.status) &&
        t.metadata?.ai_category === classification.category
    );

    const initialDescription = [
      `📌 PROBLEMA REPORTADO (${classification.category}):`,
      messageText.trim(),
      ``,
      `💬 Historial de WhatsApp:`,
      `[${nowTimeStr}] ${senderLabel}: ${messageText.trim()}`,
    ].join('\n');

    const { data: createdTicket, error: insertError } = await supabase
      .from('tickets')
      .insert({
        company_id: companyId,
        lead_id: matchedLead?.id || null,
        lead_name: clientDisplayName,
        parent_ticket_id: previousSameCategoryTicket?.id || null,
        title: `[WhatsApp · ${classification.shortCategoryTag}] ${clientDisplayName}: ${shortTitle}`,
        description: initialDescription,
        status: 'open',
        priority: classification.priority,
        metadata: {
          source: 'whatsapp_evolution',
          support_phone: '50379718911',
          evolution_instance: instanceName,
          ...(incomingEvoServerUrl ? { evolution_server_url: incomingEvoServerUrl } : {}),
          ...(incomingEvoApiKey ? { evolution_apikey: incomingEvoApiKey } : {}),
          whatsapp_jid: remoteJid,
          whatsapp_phone: cleanPhone,
          whatsapp_push_name: pushName,
          is_group: isGroup,
          ai_category: classification.category,
          whatsapp_message_count: 1,
          is_recurring_client_issue: Boolean(previousSameCategoryTicket),
          previous_ticket_id: previousSameCategoryTicket?.id || null,
        },
      })
      .select('id, title')
      .single();

    if (insertError) {
      throw insertError;
    }

    if (createdTicket?.id) {
      await supabase.from('ticket_comments').insert({
        ticket_id: createdTicket.id,
        company_id: companyId,
        body: `[${nowTimeStr}] ${senderLabel} (Reporte Inicial): ${messageText}`,
        is_internal: false,
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        action: 'ticket_created',
        ticket_id: createdTicket?.id,
        title: createdTicket?.title,
        is_recurring: Boolean(previousSameCategoryTicket),
        category: classification.category,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[evolution-whatsapp-webhook] Error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
