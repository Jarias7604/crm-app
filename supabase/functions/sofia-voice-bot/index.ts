// @ts-nocheck
// sofia-voice-bot v1.0 — Sofía AI Call Engine
// Routes: POST /initiate (manual/cron) | POST /webhook (Telnyx events)
// Stack: Telnyx (calls) + Deepgram (STT) + Cartesia (TTS) + GPT-4o-mini (brain)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
  { auth: { persistSession: false } }
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(...args: any[]) {
  console.log('[sofia-voice-bot]', ...args);
}

function isWithinCallHours(start: string, end: string, days: string[]): boolean {
  const now = new Date();
  const tz = 'America/El_Salvador';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: 'numeric', hour12: false,
    minute: 'numeric', weekday: 'short'
  }).formatToParts(now);
  const hour   = parseInt(parts.find(p => p.type === 'hour')?.value   || '12');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  const day    = parts.find(p => p.type === 'weekday')?.value || 'Mon';
  const dayMap: Record<string,string> = { Mon:'MON', Tue:'TUE', Wed:'WED', Thu:'THU', Fri:'FRI', Sat:'SAT', Sun:'SUN' };
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const nowMin   = hour * 60 + minute;
  const startMin = sh * 60 + sm;
  const endMin   = eh * 60 + em;
  return days.includes(dayMap[day]) && nowMin >= startMin && nowMin < endMin;
}

// ── Vapi: Initiate Zero-Latency outbound call ─────────────────────────────────

async function vapiInitiateCall(params: {
  apiKey: string; assistantId: string; phoneId?: string; customerNumber: string; queueId: string;
}): Promise<{ call_id: string }> {
  const body: any = {
    assistantId: params.assistantId,
    customer: {
      number: params.customerNumber,
    },
    metadata: {
      queue_id: params.queueId
    }
  };

  if (params.phoneId) {
    body.phoneNumberId = params.phoneId;
  }

  const res = await fetch('https://api.vapi.ai/call/phone', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${params.apiKey}`, 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vapi initiate failed (${res.status}): ${err}`);
  }
  const data = await res.json();
  return { call_id: data.id };
}

// ── Telnyx: Initiate outbound call ────────────────────────────────────────────

async function telnyxInitiateCall(params: {
  apiKey: string; connectionId: string; from: string; to: string; webhookUrl: string;
}): Promise<{ call_control_id: string }> {
  const res = await fetch('https://api.telnyx.com/v2/calls', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${params.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      connection_id:       params.connectionId,
      from:                params.from,
      to:                  params.to,
      webhook_url:         params.webhookUrl,
      webhook_url_method:  'POST',
      answering_machine_detection: 'detect',
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telnyx initiate failed (${res.status}): ${err}`);
  }
  const data = await res.json();
  return { call_control_id: data.data?.call_control_id };
}

// ── Telnyx: Send TTS audio via Cartesia ──────────────────────────────────────

async function speakToLead(callControlId: string, text: string, config: any): Promise<void> {
  // Generate audio via Cartesia
  const cartesiaRes = await fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: {
      'X-API-Key':      config.cartesia_api_key,
      'Cartesia-Version': '2024-06-10',
      'Content-Type':   'application/json',
    },
    body: JSON.stringify({
      model_id:   'sonic-multilingual',
      transcript: text,
      voice: { mode: 'id', id: config.cartesia_voice_id },
      output_format: { container: 'wav', encoding: 'pcm_s16le', sample_rate: 8000 },
      language: 'es',
    }),
  });

  if (!cartesiaRes.ok) {
    log('Cartesia TTS error:', await cartesiaRes.text());
    // Fallback: use Telnyx built-in TTS
    await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/speak`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${config.telnyx_api_key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: text, voice: 'Valentina', language: 'es-MX' }),
    });
    return;
  }

  // Stream audio bytes to Telnyx media_url (use base64 inline)
  const audioBuffer = await cartesiaRes.arrayBuffer();
  const base64Audio  = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));

  // Upload to Telnyx as inline media
  await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/playback_start`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${config.telnyx_api_key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audio_url: `data:audio/wav;base64,${base64Audio}`,
    }),
  });
}

// ── GPT-4o-mini: Generate Sofía response ─────────────────────────────────────

async function generateSofiaResponse(
  transcript: {role:string; content:string}[],
  config: any,
  leadData: any,
  apiKey: string
): Promise<{ text: string; outcome: string | null; aiScore: number | null; demoBooked: boolean }> {
  const systemPrompt = config.system_prompt || `Sos Sofía, ejecutiva de Arias Defense.
REGLAS: Hablas en español salvadoreño. NUNCA dices que sos IA. Máximo 2 oraciones cortas.
MISIÓN: Calificar si la empresa necesita Facturación Electrónica DTE.
Al final de la llamada, determina internamente si el lead calificó (>50 DTE/mes) o no.`;

  const messages = [
    { role: 'system', content: systemPrompt + `\n\nLead: ${leadData?.name || 'cliente'} | Tel: ${leadData?.phone || ''}` },
    ...transcript.map(t => ({ role: t.role === 'bot' ? 'assistant' : 'user', content: t.content })),
  ];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.6,
      max_tokens: 150,
      functions: [{
        name: 'call_outcome',
        description: 'Report the final outcome when the call is about to end',
        parameters: {
          type: 'object',
          properties: {
            outcome:     { type: 'string', enum: ['connected_qualified','connected_not_qualified','no_answer'] },
            ai_score:    { type: 'number', description: '0-100 qualification score' },
            demo_booked: { type: 'boolean' },
            summary:     { type: 'string' },
          },
          required: ['outcome','ai_score','demo_booked'],
        }
      }],
    }),
  });

  const data = await res.json();
  const choice = data.choices?.[0];

  // If function call returned, extract outcome
  if (choice?.finish_reason === 'function_call') {
    const args = JSON.parse(choice.message?.function_call?.arguments || '{}');
    return {
      text:       args.summary || 'Gracias por su tiempo.',
      outcome:    args.outcome,
      aiScore:    args.ai_score,
      demoBooked: args.demo_booked || false,
    };
  }

  return {
    text:       choice?.message?.content?.trim() || 'Perdón, ¿me puede repetir eso?',
    outcome:    null,
    aiScore:    null,
    demoBooked: false,
  };
}

// ── POST-CALL: Update CRM, move lead, notify via Telegram ────────────────────

async function handleCallCompletion(queueId: string, outcome: string, aiScore: number,
  demoBooked: boolean, transcript: any[], summary: string, durationSeconds: number): Promise<void> {

  // Get the queue item with config
  const { data: qItem } = await supabase
    .from('call_queue')
    .select('*, lead:leads(id, name, phone, status, assigned_to, company_id)')
    .eq('id', queueId).single();
  if (!qItem) return;

  // Update call_queue row
  await supabase.from('call_queue').update({
    status:           'completed',
    outcome,
    ai_score:         aiScore,
    demo_booked:      demoBooked,
    transcript,
    summary,
    duration_seconds: durationSeconds,
    ended_at:         new Date().toISOString(),
  }).eq('id', queueId);

  // Get company config for outcome_mapping
  const { data: company } = await supabase
    .from('companies')
    .select('features')
    .eq('id', qItem.lead.company_id).single();
  const callBotConfig = (company?.features as any)?.call_bot || {};
  const mapping = callBotConfig.outcome_mapping || {};

  // Move lead in pipeline
  const newStatus = mapping[outcome] || null;
  if (newStatus && qItem.lead.id) {
    await supabase.from('leads').update({
      status:     newStatus,
      updated_at: new Date().toISOString(),
      notes:      `📞 Sofía llamó. Resultado: ${outcome}. Score: ${aiScore}/100. ${summary || ''}`,
    }).eq('id', qItem.lead.id);
  }

  // ── Multi-Tenant Call Memory Sync ──────────────────────────────────────────
  try {
    const interest = Math.min(10, Math.max(0, Math.round(aiScore / 10)));
    let currentStatus = 'cold';
    if (demoBooked) {
      currentStatus = 'demo_scheduled';
    } else if (outcome === 'connected_qualified') {
      currentStatus = 'interested';
    } else if (outcome === 'connected_not_qualified') {
      currentStatus = 'follow_up';
    }

    const nextAction = demoBooked ? 'send_demo' : 'follow_up_call';

    await supabase.rpc('upsert_call_memory', {
      p_company_id:         qItem.lead.company_id,
      p_lead_id:            qItem.lead.id,
      p_prospect_name:      qItem.lead.name || null,
      p_prospect_company:   null,
      p_interest_level:     interest,
      p_current_status:     currentStatus,
      p_transcript_summary: summary || null,
      p_objections:         null,
      p_next_action:        nextAction,
      p_demo_booked_at:     demoBooked ? new Date().toISOString() : null,
    });
    log(`Saved call memory successfully for lead: ${qItem.lead.name}`);
  } catch (e: any) {
    log('Call memory sync failed:', e.message);
  }

  // Notify via Telegram
  try {
    const { data: tgInt } = await supabase.from('marketing_integrations')
      .select('settings').eq('company_id', qItem.lead.company_id)
      .eq('provider', 'telegram').eq('is_active', true).maybeSingle();

    let chatId = tgInt?.settings?.alertChatId;
    if (!chatId && qItem.lead.assigned_to) {
      const { data: agent } = await supabase.from('profiles')
        .select('telegram_chat_id').eq('id', qItem.lead.assigned_to).maybeSingle();
      chatId = agent?.telegram_chat_id;
    }

    if (chatId && tgInt?.settings?.token) {
      const icon = outcome === 'connected_qualified' ? '✅' : outcome === 'no_answer' ? '📵' : '❌';
      const demoLine = demoBooked ? '\n📅 *Demo agendada*' : '';
      const msg = `🎙️ *Sofía terminó una llamada*\n\n👤 Lead: *${qItem.lead.name}*\n📱 ${qItem.lead.phone || 'N/A'}\n${icon} Resultado: *${outcome}*\n📊 Score: ${aiScore}/100${demoLine}\n\n💬 ${summary || 'Sin resumen'}`;
      await fetch(`https://api.telegram.org/bot${tgInt.settings.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' }),
      });
    }
  } catch (e: any) { log('Telegram notify error:', e.message); }
}

// ── AUTO DISPATCH: Cron finds leads to call ───────────────────────────────────

async function handleAutoDispatch(): Promise<Response> {
  log('Auto dispatch triggered');

  // Get all companies with call_bot enabled in AUTO mode
  const { data: companies } = await supabase
    .from('companies')
    .select('id, features')
    .not('features->call_bot->enabled', 'is', null);

  let dispatched = 0;
  const webhookBase = Deno.env.get('SUPABASE_URL')?.replace('/rest/v1', '') || '';

  for (const company of (companies || [])) {
    const cfg = (company.features as any)?.call_bot || {};
    if (!cfg.enabled || cfg.call_mode !== 'auto') continue;
    if (!cfg.telnyx_api_key || !cfg.telnyx_phone) continue;
    if (!isWithinCallHours(cfg.call_hours?.start || '08:00', cfg.call_hours?.end || '18:00', cfg.call_days || ['MON','TUE','WED','THU','FRI'])) continue;

    // Find leads: have phone, no call today, didn't reply to WhatsApp in wa_wait_hours
    const waitHours = cfg.wa_wait_hours || 4;
    const cutoff = new Date(Date.now() - waitHours * 60 * 60 * 1000).toISOString();

    // Leads already called today
    const today = new Date(); today.setHours(0,0,0,0);
    const { data: calledToday } = await supabase.from('call_queue')
      .select('lead_id').eq('company_id', company.id)
      .gte('created_at', today.toISOString());
    const calledIds = (calledToday || []).map((r: any) => r.lead_id);

    // Find qualifying leads
    let q = supabase.from('leads')
      .select('id, name, phone')
      .eq('company_id', company.id)
      .not('phone', 'is', null).neq('phone', '')
      .lte('created_at', cutoff)
      .not('status', 'in', '("Cerrado","Cliente","Perdido")')
      .limit(10);

    if (calledIds.length > 0) {
      q = q.not('id', 'in', `(${calledIds.map((id: string) => `"${id}"`).join(',')})`);
    }

    const { data: leads } = await q;
    for (const lead of (leads || [])) {
      // Queue the call
      const { data: qItem } = await supabase.from('call_queue').insert({
        company_id:   company.id,
        lead_id:      lead.id,
        status:       'pending',
        trigger_type: 'cron_auto',
        mode:         'auto',
        scheduled_at: new Date().toISOString(),
      }).select('id').single();

      if (!qItem) continue;

      // Initiate call
      try {
        const voiceEngine = cfg.voice_engine || 'telnyx';
        if (voiceEngine === 'vapi') {
          const { call_id } = await vapiInitiateCall({
            apiKey: cfg.vapi_api_key,
            assistantId: cfg.vapi_assistant_id,
            phoneId: cfg.vapi_phone_id,
            customerNumber: lead.phone,
            queueId: qItem.id,
          });
          await supabase.from('call_queue').update({ status: 'calling', call_id, started_at: new Date().toISOString() }).eq('id', qItem.id);
        } else {
          const webhookUrl = `${webhookBase}/functions/v1/sofia-voice-bot/webhook?queue_id=${qItem.id}`;
          const { call_control_id } = await telnyxInitiateCall({
            apiKey: cfg.telnyx_api_key, connectionId: cfg.telnyx_connection_id,
            from: cfg.telnyx_phone, to: lead.phone, webhookUrl,
          });
          await supabase.from('call_queue').update({ status: 'calling', call_id: call_control_id, started_at: new Date().toISOString() }).eq('id', qItem.id);
        }
        dispatched++;
      } catch (e: any) {
        log('Call initiation failed:', e.message);
        await supabase.from('call_queue').update({ status: 'failed', error_message: e.message }).eq('id', qItem.id);
      }
    }
  }

  return new Response(JSON.stringify({ success: true, dispatched }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// ── INITIATE: Manual or test call ─────────────────────────────────────────────

async function handleInitiate(body: any): Promise<Response> {
  const { queue_id, test_phone, config: bodyConfig } = body;

  let qItem = null;
  let cfg = bodyConfig || {};
  let toPhone = test_phone;

  if (queue_id) {
    try {
      const { data } = await supabase
        .from('call_queue')
        .select('*, lead:leads(id, name, phone, company_id)')
        .eq('id', queue_id)
        .maybeSingle();
      qItem = data;
    } catch (_) {
      // Ignorar errores de RLS o de tabla inexistente en microservicios
    }

    if (qItem && qItem.lead) {
      if (!toPhone) toPhone = qItem.lead.phone;
      if (!bodyConfig) {
        try {
          const { data: company } = await supabase.from('companies').select('features').eq('id', qItem.lead.company_id).maybeSingle();
          cfg = (company?.features as any)?.call_bot || {};
        } catch (_) {
          // Fallback a config vacía
        }
      }
    }
  }

  // Si no tenemos credenciales explícitas, intentamos buscar la primera empresa en la base de datos local como fallback
  if (!cfg.vapi_api_key && !cfg.telnyx_api_key) {
    try {
      const { data: firstCompany } = await supabase.from('companies').select('features').limit(1).maybeSingle();
      if (firstCompany) {
        cfg = (firstCompany.features as any)?.call_bot || {};
      }
    } catch (_) {
      // Ignorar
    }
  }

  if (!toPhone) {
    return new Response(JSON.stringify({ error: 'No se especificó un número de teléfono de destino válido' }), { status: 400, headers: corsHeaders });
  }

  const voiceEngine = cfg.voice_engine || 'telnyx';
  let callControlId = '';

  try {
    if (voiceEngine === 'vapi') {
      if (!cfg.vapi_api_key || !cfg.vapi_assistant_id) {
        return new Response(JSON.stringify({ error: 'Vapi no configurado. Ingresa tu API Key y Assistant ID.' }), { status: 400, headers: corsHeaders });
      }
      const { call_id } = await vapiInitiateCall({
        apiKey: cfg.vapi_api_key,
        assistantId: cfg.vapi_assistant_id,
        phoneId: cfg.vapi_phone_id,
        customerNumber: toPhone,
        queueId: queue_id || 'test-call-id',
      });
      callControlId = call_id;
    } else {
      if (!cfg.telnyx_api_key || !cfg.telnyx_phone) {
        return new Response(JSON.stringify({ error: 'Telnyx no configurado. Registra tus credenciales SIP.' }), { status: 400, headers: corsHeaders });
      }
      const webhookBase = (Deno.env.get('SUPABASE_URL') || '').replace('/rest/v1','');
      const webhookUrl  = `${webhookBase}/functions/v1/sofia-voice-bot?action=webhook&queue_id=${queue_id || 'test-call-id'}`;

      const { call_control_id } = await telnyxInitiateCall({
        apiKey: cfg.telnyx_api_key, connectionId: cfg.telnyx_connection_id,
        from: cfg.telnyx_phone, to: toPhone, webhookUrl,
      });
      callControlId = call_control_id;
    }

    // Intentar actualizar la tabla call_queue si existe localmente
    if (queue_id && qItem) {
      await supabase.from('call_queue').update({
        status: 'calling', call_id: callControlId, started_at: new Date().toISOString()
      }).eq('id', queue_id).catch(() => {});
    }

    return new Response(JSON.stringify({ success: true, call_control_id: callControlId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('CallBot Initiation Error:', err.message);
    return new Response(JSON.stringify({ error: `Fallo al lanzar llamada: ${err.message}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ── WEBHOOK: Receive Telnyx call events ───────────────────────────────────────

async function handleWebhook(req: Request): Promise<Response> {
  const url      = new URL(req.url);
  const queueId  = url.searchParams.get('queue_id');
  const body     = await req.json();
  const event    = body?.data?.event_type;
  const payload  = body?.data?.payload;

  log(`Webhook event: ${event} | queue: ${queueId}`);
  if (!queueId) return new Response('ok', { headers: corsHeaders });

  const { data: qItem } = await supabase.from('call_queue')
    .select('*, lead:leads(id, name, phone, company_id)').eq('id', queueId).single();
  if (!qItem) return new Response('ok', { headers: corsHeaders });

  const { data: company } = await supabase.from('companies').select('features').eq('id', qItem.lead.company_id).single();
  const cfg = (company?.features as any)?.call_bot || {};
  const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';

  if (event === 'call.answered') {
    // Call was answered — play first message
    await speakToLead(payload.call_control_id, cfg.first_message || 'Buenas, ¿con quién tengo el gusto? Le habla Sofía.', cfg);
    // Start Deepgram media stream for STT
    await fetch(`https://api.telnyx.com/v2/calls/${payload.call_control_id}/actions/streaming_start`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cfg.telnyx_api_key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ stream_url: `wss://api.deepgram.com/v1/listen?encoding=mulaw&sample_rate=8000&language=es`, stream_track: 'inbound_track' }),
    });
  }

  if (event === 'call.speak.ended' || event === 'call.playback.ended') {
    // After Sofia speaks, start listening
    await fetch(`https://api.telnyx.com/v2/calls/${payload.call_control_id}/actions/gather`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cfg.telnyx_api_key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ minimum_digits: 0, time_limit_secs: 15, terminating_digit: '#', action_on_empty_result: true }),
    });
  }

  if (event === 'call.gather.ended') {
    // Lead spoke — STT result available
    const spokenText = payload?.speech?.alternatives?.[0]?.transcript || '';
    if (!spokenText) return new Response('ok', { headers: corsHeaders });

    const transcript = (qItem.transcript || []) as any[];
    transcript.push({ role: 'lead', content: spokenText, timestamp: new Date().toISOString() });

    const { text, outcome, aiScore, demoBooked } = await generateSofiaResponse(transcript, cfg, qItem.lead, openaiKey);
    transcript.push({ role: 'bot', content: text, timestamp: new Date().toISOString() });

    await supabase.from('call_queue').update({ transcript }).eq('id', queueId);

    if (outcome) {
      // Call is wrapping up
      await speakToLead(payload.call_control_id, text, cfg);
      await handleCallCompletion(queueId, outcome, aiScore || 0, demoBooked, transcript, text,
        Math.round((Date.now() - new Date(qItem.started_at || Date.now()).getTime()) / 1000));
      // Hang up
      await fetch(`https://api.telnyx.com/v2/calls/${payload.call_control_id}/actions/hangup`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${cfg.telnyx_api_key}`, 'Content-Type': 'application/json' },
        body: '{}',
      });
    } else {
      await speakToLead(payload.call_control_id, text, cfg);
    }
  }

  if (event === 'call.hangup' || event === 'call.machine.detection.ended') {
    const isVoicemail = payload?.result === 'machine';
    if (isVoicemail) {
      await supabase.from('call_queue').update({ status: 'no_answer', outcome: 'voicemail', ended_at: new Date().toISOString() }).eq('id', queueId);
    } else {
      const current = (await supabase.from('call_queue').select('status').eq('id', queueId).single()).data;
      if (current?.status !== 'completed') {
        await supabase.from('call_queue').update({ status: 'no_answer', outcome: 'no_answer', ended_at: new Date().toISOString() }).eq('id', queueId);
      }
    }
  }

  return new Response('ok', { headers: corsHeaders });
}

// ── VAPI: Receive end-of-call reports for Zero-Latency calls ──────────────────

async function handleVapiWebhook(body: any): Promise<Response> {
  const message = body?.message;
  const type = message?.type;

  log(`Vapi webhook received of type: ${type}`);

  if (type === 'end-of-call-report') {
    const call = message?.call;
    const metadata = call?.metadata || {};
    const queueId = metadata?.queue_id || body?.metadata?.queue_id;

    if (!queueId) {
      log('Vapi: queue_id not found in metadata. Skipping.');
      return new Response(JSON.stringify({ success: false, error: 'No queue_id in metadata' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    log(`Vapi end-of-call-report for queue_id: ${queueId}`);

    // Parse transcript
    const vapiTranscript = message?.transcript || "";
    const transcriptList: {role: string; content: string; timestamp: string}[] = [];
    
    // Parse individual messages if available to structure them
    if (call?.messages && call.messages.length > 0) {
      for (const msg of call.messages) {
        if (msg.role === 'assistant' || msg.role === 'user') {
          transcriptList.push({
            role: msg.role === 'assistant' ? 'bot' : 'lead',
            content: msg.message || '',
            timestamp: new Date(msg.time || Date.now()).toISOString()
          });
        }
      }
    } else {
      // Fallback: put raw transcript in a single block
      transcriptList.push({
        role: 'system',
        content: vapiTranscript,
        timestamp: new Date().toISOString()
      });
    }

    // Extract structured analysis or set high-quality fallbacks
    const analysis = message?.analysis || {};
    const structuredData = analysis?.structuredData || {};
    
    // Detección inteligente del resultado (outcome)
    let outcome = structuredData?.outcome || 'connected_not_qualified';
    if (structuredData?.qualified === true || structuredData?.qualified === 'yes' || analysis?.success === true) {
      outcome = 'connected_qualified';
    } else if (call?.endedReason === 'customer-did-not-answer' || call?.endedReason === 'voicemail') {
      outcome = 'no_answer';
    }

    const aiScore = Number(structuredData?.ai_score || structuredData?.score || (outcome === 'connected_qualified' ? 85 : 45));
    const demoBooked = Boolean(structuredData?.demo_booked || structuredData?.appointment_booked || false);
    const summary = analysis?.summary || `Llamada de Vapi finalizada. Razón: ${call?.endedReason || 'N/A'}`;
    const durationSeconds = Math.round(call?.durationSeconds || 0);

    // Invoke our existing CRM sync and Telegram notify flow!
    await handleCallCompletion(
      queueId,
      outcome,
      aiScore,
      demoBooked,
      transcriptList,
      summary,
      durationSeconds
    );

    // Update status in call_queue to completed to sync with CRM front
    await supabase.from('call_queue').update({
      status: 'completed',
      ended_at: new Date().toISOString()
    }).eq('id', queueId);

    log(`Vapi webhook completed successfully for queue: ${queueId}`);
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// ── MAIN ROUTER ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url    = new URL(req.url);
    const action = url.searchParams.get('action') || '';
    const body   = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

    // Cron auto-dispatch
    if (body?.action === 'auto_dispatch') return await handleAutoDispatch();

    // Telnyx webhook
    if (action === 'webhook' || url.pathname.includes('/webhook')) return await handleWebhook(req);

    // Vapi Webhook (Zero Latency call-reports)
    if (body?.message?.type) return await handleVapiWebhook(body);

    // Manual initiate
    if (body?.queue_id) return await handleInitiate(body);

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: corsHeaders });

  } catch (err: any) {
    log('FATAL:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
