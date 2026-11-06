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

export type SupportChannelType = 'soporte' | 'contabilidad' | 'ventas' | 'otros';

export const DEFAULT_AI_PROMPTS: Record<SupportChannelType, string> = {
  soporte:
    'Eres el Asistente IA de Soporte Técnico de Arias Defense / ERP Facturación Electrónica (DTE Hacienda). Lee o escucha lo que el cliente reportó y respóndele de forma amable, clara y resolutiva en máximo 3 líneas por WhatsApp. Confírmale que entendiste su reporte técnico y pídele captura de pantalla del error o su código de AnyDesk si requiere revisión en su equipo.',
  contabilidad:
    'Eres el Asistente IA del Área Contable y Fiscal (Libros de IVA, Planillas, Declaraciones F07/F14, Anexos Hacienda y Retenciones). Lee o escucha la consulta del cliente y respóndele de forma profesional, precisa y amable en máximo 3 líneas por WhatsApp. Si necesita revisión de algún libro, anexo o cuadre contable, pídele el período (mes/año) o captura del reporte para que el especialista contable lo valide.',
  ventas:
    'Eres el Asesor Comercial IA de Arias Defense (Sistemas ERP, Facturación Electrónica DTE, Contabilidad, POS e Inventarios). El cliente está consultando por precios, planes, demostración o nuevos productos. Respóndele con entusiasmo, cortesía y enfoque comercial en máximo 3 líneas por WhatsApp: infórmale que contamos con planes adaptados a su volumen de facturación/operación y pregúntale su giro de negocio o cantidad aproximada de documentos mensuales para enviarle su cotización o agendar una demo.',
  otros:
    'Eres el Asistente IA de Atención al Cliente de Arias Defense. Lee o escucha el mensaje del cliente y respóndele de forma cortés, clara y servicial en máximo 3 líneas por WhatsApp, confirmando que recibimos su consulta y canalizándola con el área correspondiente.',
};

// 2. Detect if a message describes a support problem, accounting query, sales/pricing lead, or general inquiry
function classifyIssueCategory(text: string): {
  category: string;
  shortCategoryTag: string;
  supportChannel: SupportChannelType;
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

  const salesKeywords = [
    'precio',
    'precios',
    'costo',
    'costos',
    'cotizacion',
    'cotización',
    'cotizar',
    'cuanto cuesta',
    'cuánto cuesta',
    'cuanto vale',
    'cuánto vale',
    'planes',
    'mensualidad',
    'anualidad',
    'demo',
    'demostracion',
    'demostración',
    'comprar',
    'adquirir',
    'contratar',
    'licencia',
    'licencias',
    'paquete',
    'paquetes',
    'tarifa',
    'tarifas',
    'implementacion',
    'implementación',
    'me interesa el sistema',
    'informacion del sistema',
    'información del sistema',
    'quiero informacion',
    'quiero información',
    'venden',
    'ofrecen',
    'prospecto',
  ];

  const accountingKeywords = [
    'contabilidad',
    'contable',
    'contador',
    'libro de iva',
    'libros de iva',
    'libro compras',
    'libro ventas',
    'consumidor final',
    'contribuyente',
    'declaracion',
    'declaración',
    'anexo',
    'anexos',
    'f07',
    'f-07',
    'f14',
    'f-14',
    'f11',
    'retencion',
    'retención',
    'percepcion',
    'percepción',
    'planilla',
    'planillas',
    'isss',
    'afp',
    'renta',
    'balance general',
    'estado de resultado',
    'partida contable',
    'partidas',
    'catalogo de cuentas',
    'catálogo de cuentas',
    'cierre contable',
    'conciliacion',
    'conciliación',
  ];

  const otherProductKeywords = [
    'otro producto',
    'otros productos',
    'otro servicio',
    'otros servicios',
    'catalogo',
    'catálogo',
    'horario de atencion',
    'horario de atención',
    'ubicacion',
    'ubicación',
    'direccion',
    'dirección',
    'estado de cuenta',
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
    'no imprime',
    'impresora',
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
    'consulta',
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
    'nota de voz',
    'imagen enviada',
    'documento:',
  ];

  const isUrgent = urgentKeywords.some((k) => lower.includes(k));
  const isSales = salesKeywords.some((k) => lower.includes(k));
  const isAccounting = accountingKeywords.some((k) => lower.includes(k));
  const isOtherProduct = otherProductKeywords.some((k) => lower.includes(k));
  const hasProblemKeyword = problemIndicators.some((k) => lower.includes(k));
  const isClosingOrGreeting = isGreetingOrClosingAgreement(text);

  const isActualSupportProblem =
    (isUrgent || isSales || isAccounting || isOtherProduct || hasProblemKeyword) &&
    !isClosingOrGreeting;

  let supportChannel: SupportChannelType = 'soporte';
  let category = 'Soporte General / Consulta';
  let shortCategoryTag = 'Soporte';

  if (isSales) {
    supportChannel = 'ventas';
    category = 'Ventas / Precios / Cotización';
    shortCategoryTag = 'Ventas / Precios';
  } else if (isAccounting) {
    supportChannel = 'contabilidad';
    category = 'Contabilidad / IVA / Planillas';
    shortCategoryTag = 'Contabilidad';
  } else if (isOtherProduct && !hasProblemKeyword) {
    supportChannel = 'otros';
    category = 'Otros Productos / Información General';
    shortCategoryTag = 'Otros Productos';
  } else if (
    /dte|hacienda|factura|invalidaci|credito fiscal|crédito fiscal|fe\b|contingencia|sello|firmador/i.test(
      lower
    )
  ) {
    supportChannel = 'soporte';
    category = 'Facturación Electrónica / DTE / Hacienda';
    shortCategoryTag = 'Facturación DTE';
  } else if (/whatsapp|mensaje|cola|api|envio|envío|notificaci/i.test(lower)) {
    supportChannel = 'soporte';
    category = 'WhatsApp / Mensajería / API';
    shortCategoryTag = 'WhatsApp API';
  } else if (/login|acceso|usuario|permiso|contrase|rol|sesion|sesión/i.test(lower)) {
    supportChannel = 'soporte';
    category = 'Accesos / Usuarios / Permisos';
    shortCategoryTag = 'Accesos/Permisos';
  } else if (/reporte|excel|pdf|descarga|filtro|estadistica|dashboard/i.test(lower)) {
    supportChannel = 'soporte';
    category = 'Reportes / Exportación / Datos';
    shortCategoryTag = 'Reportes';
  } else if (/calculo|cálculo|monto|total|descuento|pago|cobro/i.test(lower)) {
    supportChannel = 'contabilidad';
    category = 'Cálculos / Finanzas / Pagos';
    shortCategoryTag = 'Contabilidad';
  } else if (/lento|carga|caido|caído|servidor|base de datos|sql|sincroni/i.test(lower)) {
    supportChannel = 'soporte';
    category = 'Infraestructura / Base de Datos / Lentitud';
    shortCategoryTag = 'Base de Datos/Server';
  }

  return {
    category,
    shortCategoryTag,
    supportChannel,
    isActualSupportProblem,
    priority: isUrgent ? 'urgent' : isSales ? 'high' : 'high',
  };
}

async function loadSupportAiConfig(supabase: any): Promise<{
  integrationId: string | null;
  openAiKey: string;
  rawSettings: Record<string, any>;
  autoReplyText: boolean;
  autoReplyAudio: boolean;
  prompts: Record<SupportChannelType, string>;
}> {
  const { data: openAiInt } = await supabase
    .from('marketing_integrations')
    .select('id, settings')
    .eq('provider', 'openai')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  const rawSettings = (openAiInt?.settings || {}) as Record<string, any>;
  const openAiKey = String(rawSettings.apiKey || Deno.env.get('OPENAI_API_KEY') || '').trim();
  const savedCfg = (rawSettings.support_ai_config || {}) as Record<string, any>;

  return {
    integrationId: openAiInt?.id || null,
    openAiKey,
    rawSettings,
    autoReplyText: Boolean(savedCfg.auto_reply_text === true),
    autoReplyAudio: Boolean(savedCfg.auto_reply_audio === true),
    prompts: {
      soporte: String(savedCfg.prompt_soporte || DEFAULT_AI_PROMPTS.soporte).trim(),
      contabilidad: String(
        savedCfg.prompt_contabilidad || DEFAULT_AI_PROMPTS.contabilidad
      ).trim(),
      ventas: String(savedCfg.prompt_ventas || DEFAULT_AI_PROMPTS.ventas).trim(),
      otros: String(savedCfg.prompt_otros || DEFAULT_AI_PROMPTS.otros).trim(),
    },
  };
}

function getChannelAiBotLabel(ch: SupportChannelType): string {
  if (ch === 'contabilidad') return '🤖 IA Contabilidad';
  if (ch === 'ventas') return '🤖 IA Ventas';
  if (ch === 'otros') return '🤖 IA Atención';
  return '🤖 IA Soporte';
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

        const needsGroupSubjectSync =
          typeof m.whatsapp_jid === 'string' &&
          m.whatsapp_jid.endsWith('@g.us') &&
          !m.group_subject_synced;

        if (pendingItems.length === 0 && pendingAudio.length === 0 && !needsGroupSubjectSync) continue;

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
              ...(needsGroupSubjectSync ? { group_subject_synced: true } : {}),
            },
          })
          .eq('id', row.id);

        if (needsGroupSubjectSync) {
          const rawInst = !m.evolution_instance || m.evolution_instance === 'arias' ? 'soporte' : m.evolution_instance;
          const inst = String(rawInst).replace(/[^a-zA-Z0-9_-]/g, '');
          const key = String(m.evolution_apikey || '10C73BF4-D3D9-4CDB-9855-85E346468546').replace(/[^a-zA-Z0-9_-]/g, '');
          const syncUrl = `https://mtxqqamitglhehaktgxm.supabase.co/functions/v1/evolution-whatsapp-webhook?action=sync_group_subject&ticket_id=${row.id}`;
          shellLines.push(
            `curl -s "http://localhost:8085/group/findGroupInfos/${inst}?groupJid=${encodeURIComponent(m.whatsapp_jid)}" -H "apikey: ${key}" | curl -s -X POST "${syncUrl}" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1`
          );
        }

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

    // ─── GET / VERIFY GLOBAL AI CONFIG & OPENAI LIVE CONNECTION ───────────────
    if (queryAction === 'get_ai_config' || queryAction === 'test_openai') {
      const aiCfg = await loadSupportAiConfig(supabase);
      let openAiVerified = false;
      let openAiModel = 'gpt-4o-mini';
      let openAiError = '';

      if (aiCfg.openAiKey) {
        try {
          const pingRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${aiCfg.openAiKey}`,
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              max_tokens: 8,
              messages: [{ role: 'user', content: 'Responde OK' }],
            }),
          });
          if (pingRes.ok) {
            const pJson = await pingRes.json();
            openAiVerified = true;
            openAiModel = pJson?.model || 'gpt-4o-mini';
          } else {
            openAiError = `HTTP ${pingRes.status}`;
          }
        } catch (e: any) {
          openAiError = e?.message || 'Network error';
        }
      } else {
        openAiError = 'No OpenAI API Key found';
      }

      return new Response(
        JSON.stringify({
          ok: true,
          openai_verified: openAiVerified,
          openai_model: openAiModel,
          openai_error: openAiError,
          auto_reply_text: aiCfg.autoReplyText,
          auto_reply_audio: aiCfg.autoReplyAudio,
          prompts: aiCfg.prompts,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── SAVE GLOBAL MULTI-CATEGORY AI PROMPTS (SOPORTE, CONTABILIDAD, VENTAS, OTROS) ───
    if (queryAction === 'save_ai_config' || queryAction === 'save_ai_prompt') {
      const aiCfg = await loadSupportAiConfig(supabase);
      const newSupportAiConfig = {
        auto_reply_text:
          payload?.auto_reply_text !== undefined
            ? Boolean(payload.auto_reply_text)
            : aiCfg.autoReplyText,
        auto_reply_audio:
          payload?.auto_reply_audio !== undefined
            ? Boolean(payload.auto_reply_audio)
            : payload?.ai_auto_reply_enabled !== undefined
            ? Boolean(payload.ai_auto_reply_enabled)
            : aiCfg.autoReplyAudio,
        prompt_soporte: String(
          payload?.prompts?.soporte || payload?.ai_voice_prompt || aiCfg.prompts.soporte
        ).trim(),
        prompt_contabilidad: String(
          payload?.prompts?.contabilidad || aiCfg.prompts.contabilidad
        ).trim(),
        prompt_ventas: String(payload?.prompts?.ventas || aiCfg.prompts.ventas).trim(),
        prompt_otros: String(payload?.prompts?.otros || aiCfg.prompts.otros).trim(),
        updated_at: new Date().toISOString(),
      };

      if (aiCfg.integrationId) {
        await supabase
          .from('marketing_integrations')
          .update({
            settings: {
              ...aiCfg.rawSettings,
              support_ai_config: newSupportAiConfig,
            },
          })
          .eq('id', aiCfg.integrationId);
      }

      if (payload?.ticket_id) {
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
                ai_voice_prompt: newSupportAiConfig.prompt_soporte,
                ai_auto_reply_enabled: newSupportAiConfig.auto_reply_audio,
                ai_auto_reply_text_enabled: newSupportAiConfig.auto_reply_text,
              },
            })
            .eq('id', payload.ticket_id);
        }
      }

      return new Response(
        JSON.stringify({ ok: true, config: newSupportAiConfig }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── SWITCH TICKET CHANNEL (SOPORTE | CONTABILIDAD | VENTAS | OTROS) ──────
    if (queryAction === 'set_ticket_channel' && payload?.ticket_id && payload?.support_channel) {
      const ch = payload.support_channel as SupportChannelType;
      const { data: tRow } = await supabase
        .from('tickets')
        .select('metadata')
        .eq('id', payload.ticket_id)
        .maybeSingle();

      if (tRow) {
        const labelMap: Record<SupportChannelType, string> = {
          soporte: 'Facturación Electrónica / DTE / Soporte',
          contabilidad: 'Contabilidad / IVA / Planillas',
          ventas: 'Ventas / Precios / Cotización',
          otros: 'Otros Productos / Información General',
        };
        await supabase
          .from('tickets')
          .update({
            updated_at: new Date().toISOString(),
            metadata: {
              ...(tRow.metadata || {}),
              support_channel: ch,
              ai_category: labelMap[ch] || (tRow.metadata || {}).ai_category,
            },
          })
          .eq('id', payload.ticket_id);
      }

      return new Response(
        JSON.stringify({ ok: true, support_channel: ch }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── 1-CLICK PROMOTE WHATSAPP CHAT TO SALES LEAD ("Pasar a Ventas") ───────
    if (queryAction === 'promote_to_lead' && payload?.ticket_id) {
      const { data: tRow } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', payload.ticket_id)
        .maybeSingle();

      if (!tRow) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Ticket no encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const meta = tRow.metadata || {};
      const cleanPhone = String(payload.phone || meta.whatsapp_phone || '').replace(/\D/g, '');
      const clientName = String(
        payload.client_name || tRow.lead_name || meta.whatsapp_push_name || 'Prospecto WhatsApp'
      )
        .replace(/\(\+\d+\)/g, '')
        .trim();

      let existingLeadId: string | null = tRow.lead_id || meta.promoted_lead_id || null;
      if (!existingLeadId && cleanPhone.length >= 8) {
        const last8 = cleanPhone.slice(-8);
        const { data: foundLeads } = await supabase
          .from('leads')
          .select('id, name')
          .eq('company_id', tRow.company_id)
          .ilike('phone', `%${last8}%`)
          .limit(1);
        if (foundLeads && foundLeads.length > 0) {
          existingLeadId = foundLeads[0].id;
        }
      }

      let createdOrLinkedLead: any = null;
      if (existingLeadId) {
        const { data: uLead } = await supabase
          .from('leads')
          .update({
            next_action_notes: `[Consulta desde WhatsApp Soporte]: ${
              meta.last_whatsapp_message || tRow.title || ''
            }`,
          })
          .eq('id', existingLeadId)
          .select('id, name, phone, status')
          .maybeSingle();
        createdOrLinkedLead = uLead || { id: existingLeadId, name: clientName };
      } else {
        const { data: newLead, error: leadErr } = await supabase
          .from('leads')
          .insert({
            company_id: tRow.company_id,
            name: clientName,
            company_name: clientName,
            phone: cleanPhone ? `+${cleanPhone}` : null,
            status: 'Prospecto',
            priority: 'high',
            source: 'WhatsApp',
            next_action_notes: `[Promovido desde Chat WhatsApp]: ${
              meta.last_whatsapp_message || tRow.title || ''
            }`,
          })
          .select('id, name, phone, status')
          .single();

        if (leadErr) throw leadErr;
        createdOrLinkedLead = newLead;
      }

      await supabase
        .from('tickets')
        .update({
          lead_id: createdOrLinkedLead?.id || null,
          updated_at: new Date().toISOString(),
          metadata: {
            ...meta,
            support_channel: 'ventas',
            ai_category: 'Ventas / Precios / Cotización',
            promoted_lead_id: createdOrLinkedLead?.id || null,
            promoted_to_sales_at: new Date().toISOString(),
          },
        })
        .eq('id', tRow.id);

      return new Response(
        JSON.stringify({
          ok: true,
          lead: createdOrLinkedLead,
          already_existed: Boolean(existingLeadId),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

      // Fetch ticket & global AI config for Whisper transcription + category-aware AI auto-reply
      const { data: ticketRow } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', ticketId)
        .maybeSingle();

      const aiCfg = await loadSupportAiConfig(supabase);
      const openAiKey = aiCfg.openAiKey;

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

      // Re-classify support channel based on what the client said in the voice note!
      const meta = ticketRow?.metadata || {};
      const voiceClass = transcriptText
        ? classifyIssueCategory(transcriptText)
        : null;
      const detectedChannel: SupportChannelType =
        (voiceClass && voiceClass.supportChannel !== 'soporte'
          ? voiceClass.supportChannel
          : (meta.support_channel as SupportChannelType)) ||
        voiceClass?.supportChannel ||
        'soporte';

      // Generate & send automatic AI reply if enabled
      let aiReplySent = false;
      let aiReplyText = '';
      if (ticketRow && autoReplyFlag && aiCfg.autoReplyAudio && openAiKey) {
        const categoryPrompt =
          aiCfg.prompts[detectedChannel] ||
          meta.ai_voice_prompt ||
          DEFAULT_AI_PROMPTS.soporte;

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
                { role: 'system', content: categoryPrompt },
                {
                  role: 'user',
                  content: transcriptText
                    ? `El cliente (${ticketRow.lead_name || 'Cliente'}) envió una nota de voz diciendo: "${transcriptText}". Redacta la respuesta que se enviará a su WhatsApp.`
                    : `El cliente (${ticketRow.lead_name || 'Cliente'}) envió una nota de voz. Redacta una respuesta amable confirmando recepción de su nota de voz y que el equipo ya la está escuchando para apoyarle.`,
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
          const botLabel = getChannelAiBotLabel(detectedChannel);
          const aiFormattedLine = `[${nowTimeStr}] 👨‍💻 ${botLabel}: ${aiReplyText}`;

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
                support_channel: detectedChannel,
                ...(voiceClass ? { ai_category: voiceClass.category } : {}),
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
      } else if (ticketRow) {
        await supabase
          .from('tickets')
          .update({
            updated_at: new Date().toISOString(),
            metadata: {
              ...meta,
              support_channel: detectedChannel,
              ...(voiceClass ? { ai_category: voiceClass.category } : {}),
              last_audio_url: publicAudioUrl,
              last_audio_transcript: transcriptText,
            },
          })
          .eq('id', ticketId);
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

    if (queryAction === 'sync_group_subject') {
      const ticketId = url.searchParams.get('ticket_id') || payload?.ticket_id;
      const subject = String(
        payload?.subject || payload?.data?.subject || payload?.groupMetadata?.subject || ''
      ).trim();

      if (ticketId && subject) {
        const { data: tRow } = await supabase
          .from('tickets')
          .select('id, title, metadata')
          .eq('id', ticketId)
          .maybeSingle();
        if (tRow) {
          const m = tRow.metadata || {};
          await supabase
            .from('tickets')
            .update({
              lead_name: subject,
              metadata: {
                ...m,
                is_group: true,
                whatsapp_group_subject: subject,
                group_subject_synced: true,
              },
            })
            .eq('id', ticketId);
        }
      }
      return new Response(JSON.stringify({ ok: true, subject }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
    const remoteJidAlt: string =
      key?.remoteJidAlt ||
      key?.senderPn ||
      msgEntry?.remoteJidAlt ||
      msgEntry?.senderPn ||
      payload?.senderPn ||
      '';
    const pushName: string =
      msgEntry?.pushName || payload?.pushName || payload?.sender || 'Cliente WhatsApp';

    // Unwrap ephemeralMessage (Mensajes Temporales 24h), viewOnceMessage, deviceSentMessage, etc.
    const rawMsgObj = msgEntry?.message || payload?.message || {};
    const msgObj =
      rawMsgObj?.ephemeralMessage?.message ||
      rawMsgObj?.viewOnceMessage?.message ||
      rawMsgObj?.viewOnceMessageV2?.message ||
      rawMsgObj?.viewOnceMessageV2Extension?.message ||
      rawMsgObj?.documentWithCaptionMessage?.message ||
      rawMsgObj?.deviceSentMessage?.message ||
      rawMsgObj?.editedMessage?.message?.protocolMessage?.editedMessage ||
      rawMsgObj;

    const extTextObj = msgObj?.extendedTextMessage || rawMsgObj?.extendedTextMessage || {};
    const messageText: string =
      msgObj?.conversation ||
      extTextObj?.text ||
      extTextObj?.matchedText ||
      extTextObj?.canonicalUrl ||
      extTextObj?.title ||
      msgObj?.imageMessage?.caption ||
      msgObj?.videoMessage?.caption ||
      msgObj?.documentMessage?.caption ||
      msgObj?.buttonsResponseMessage?.selectedDisplayText ||
      msgObj?.listResponseMessage?.title ||
      msgObj?.templateButtonReplyMessage?.selectedDisplayText ||
      msgObj?.interactiveResponseMessage?.body?.text ||
      msgEntry?.body ||
      msgEntry?.text ||
      (msgObj?.imageMessage ? '[Imagen enviada por WhatsApp]' : '') ||
      (msgObj?.audioMessage ? '[Nota de voz enviada por WhatsApp]' : '') ||
      (msgObj?.videoMessage ? '[Video enviado por WhatsApp]' : '') ||
      (msgObj?.stickerMessage ? '[Sticker enviado por WhatsApp]' : '') ||
      (msgObj?.contactMessage || msgObj?.contactsArrayMessage ? '[Contacto enviado por WhatsApp]' : '') ||
      (msgObj?.locationMessage ? '[Ubicacion enviada por WhatsApp]' : '') ||
      (msgObj?.documentMessage
        ? `[Documento: ${msgObj.documentMessage.fileName || 'Archivo'}]`
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
    // We ONLY read `clients` and `leads` (read-only) to see if the phone belongs to an existing client.
    let matchedLead: { id: string; name: string; phone: string | null } | null = null;
    let matchedClient: { id: string; name: string; company_name: string | null; phone: string | null } | null = null;
    if (!isTeamStaffReply && cleanPhone && cleanPhone.length >= 8) {
      const last8 = cleanPhone.slice(-8);
      const [{ data: clientsByPhone }, { data: leadsByPhone }] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name, company_name, phone')
          .eq('company_id', companyId)
          .ilike('phone', `%${last8}%`)
          .limit(1),
        supabase
          .from('leads')
          .select('id, name, phone')
          .eq('company_id', companyId)
          .ilike('phone', `%${last8}%`)
          .limit(1),
      ]);
      if (clientsByPhone && clientsByPhone.length > 0) {
        matchedClient = clientsByPhone[0];
      }
      if (leadsByPhone && leadsByPhone.length > 0) {
        matchedLead = leadsByPhone[0];
      }
    }

    // Find if this client/group ALREADY has an active ticket (or one closed in the last 4 hours)
    const { data: recentClientTickets } = await supabase
      .from('tickets')
      .select(
        'id, title, status, priority, assigned_to, metadata, description, lead_id, lead_name, resolved_at, created_at'
      )
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(80);

    // Resolve WhatsApp Group Name (if message is from a @g.us Group)
    const rawGroupSubject = String(
      msgEntry?.groupMetadata?.subject ||
        rawData?.groupMetadata?.subject ||
        payload?.groupSubject ||
        msgEntry?.groupSubject ||
        payload?.data?.groupSubject ||
        msgEntry?.chatName ||
        payload?.chatName ||
        ''
    ).trim();

    const prevGroupTicketWithSubject = isGroup
      ? (recentClientTickets || []).find(
          (t: any) =>
            t.metadata?.whatsapp_jid === remoteJid && t.metadata?.whatsapp_group_subject
        )
      : null;

    const inferKnownGroupSubject = (sender: string): string => {
      const s = (sender || '').toLowerCase();
      if (s.includes('yanci')) return 'Soporte tecnico Arias - Corp Argoz';
      if (s.includes('carloxavy')) return 'Soporte Tecnico Medicina Popular';
      if (s.includes('mel espinoza')) return 'Soporte tecnico ERP Arias - Aillio Latam';
      if (s.includes('norma pineda')) return 'Soporte Técnico Salinera San Jorge';
      if (s.includes('magdalena')) return 'Soporte técnico Boutique América + Johanna Garcia';
      if (s.includes('francisco colorado')) return 'Soporte técnico Rustic Barber';
      if (s.includes('dennis')) return 'Soporte tecnico ERP Arias - Dennis Soto';
      if (s.includes('lucy pineda') || s.includes('rafael lazo')) return 'Salvadoran American PAC';
      return '';
    };

    const resolvedGroupSubject = isGroup
      ? rawGroupSubject ||
        String(prevGroupTicketWithSubject?.metadata?.whatsapp_group_subject || '') ||
        inferKnownGroupSubject(pushName)
      : '';

    const clientDisplayName = isGroup
      ? resolvedGroupSubject ||
        matchedLead?.name ||
        (pushName && pushName !== 'Cliente WhatsApp' ? `Soporte Técnico - ${pushName}` : 'Grupo Soporte Técnico')
      : matchedLead?.name ||
        (pushName && pushName !== 'Cliente WhatsApp'
          ? cleanPhone
            ? `${pushName} (+${cleanPhone})`
            : pushName
          : cleanPhone
          ? `WhatsApp +${cleanPhone}`
          : 'Cliente WhatsApp');

    // Check if 1-on-1 sender is actually a member/participant of an existing WhatsApp Support Group (@g.us)
    const isGroupParticipantIn1on1 =
      !isGroup &&
      (Boolean(inferKnownGroupSubject(pushName)) ||
        (recentClientTickets || []).some((t: any) => {
          const m = t.metadata || {};
          if (!m.is_group && !String(m.whatsapp_jid || '').endsWith('@g.us')) return false;
          if (
            cleanPhone &&
            cleanPhone.length >= 8 &&
            String(m.whatsapp_phone || '')
              .replace(/\D/g, '')
              .slice(-8) === cleanPhone.slice(-8)
          ) {
            return true;
          }
          if (
            pushName &&
            pushName.length >= 4 &&
            pushName !== 'Cliente WhatsApp' &&
            String(m.whatsapp_push_name || '').trim().toLowerCase() === pushName.trim().toLowerCase()
          ) {
            return true;
          }
          return false;
        }));

    const classification = classifyIssueCategory(messageText);
    const isExistingClientContact = isGroup || Boolean(matchedClient) || isGroupParticipantIn1on1;
    // All WhatsApp Groups (@g.us), group participants, and contacts in the ~210 `clients` table are 100% Existing Support Clients!
    // All 1-on-1 individual WhatsApp chats (`!isGroup`) NOT in `clients` and NOT in any Support Group are New Leads (`ventas`)!
    if (isExistingClientContact && classification.supportChannel === 'ventas') {
      classification.supportChannel = 'soporte';
    } else if (!isExistingClientContact) {
      classification.supportChannel = 'ventas';
      classification.category = 'Ventas / Precios / Nuevo Lead';
      classification.shortCategoryTag = 'Nuevo Lead';
    }

    const nowTimeStr = new Date().toLocaleTimeString('es-SV', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/El_Salvador',
    });
    const senderLabel = isTeamStaffReply
      ? `👨‍💻 ${matchedTechProfile?.full_name || 'Equipo Soporte'}`
      : `👤 ${pushName || 'Cliente'}`;

    const matchingClientTickets = (recentClientTickets || []).filter((t: any) => {
      const meta = t.metadata || {};
      if (remoteJid && meta.whatsapp_jid === remoteJid) return true;
      if (isGroup) {
        // For groups, match strictly by Group JID or Group Name so all 7 numbers stay in 1 Group Circle!
        if (
          resolvedGroupSubject &&
          (t.lead_name === resolvedGroupSubject || meta.whatsapp_group_subject === resolvedGroupSubject)
        ) {
          return true;
        }
        return false;
      }
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

      const resolvedChannel: SupportChannelType =
        (!isTeamStaffReply && classification.supportChannel !== 'soporte'
          ? classification.supportChannel
          : (currentMeta.support_channel as SupportChannelType)) ||
        classification.supportChannel ||
        'soporte';

      const shouldUpgradeProblemTitle =
        !isTeamStaffReply &&
        classification.isActualSupportProblem &&
        isGenericProblemTitle(activeTicket.title) &&
        messageText.length >= 15;

      const prevDesc = activeTicket.description || '';
      const newChatLine = `[${nowTimeStr}] ${senderLabel}: ${messageText}`;
      let updatedDescription = prevDesc.includes('💬 Historial de WhatsApp:')
        ? `${prevDesc}\n${newChatLine}`
        : `${prevDesc}\n\n💬 Historial de WhatsApp:\n${newChatLine}`;

      let updatedOutbox: any[] = Array.isArray(currentMeta.pending_whatsapp_outbox)
        ? currentMeta.pending_whatsapp_outbox
        : [];
      let lastWhatsappMsgPreview = messageText.slice(0, 200);
      let aiTextReplySent = false;

      // Auto-reply with OpenAI GPT-4o-mini for incoming client TEXT messages when enabled!
      if (
        !isTeamStaffReply &&
        !isIncomingAudio &&
        !isGreetingOrClosingAgreement(messageText) &&
        currentMeta.ai_auto_reply_text_enabled !== false
      ) {
        const aiCfg = await loadSupportAiConfig(supabase);
        if (aiCfg.autoReplyText && aiCfg.openAiKey) {
          const categoryPrompt =
            aiCfg.prompts[resolvedChannel] || DEFAULT_AI_PROMPTS.soporte;
          try {
            const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${aiCfg.openAiKey}`,
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                temperature: 0.4,
                messages: [
                  { role: 'system', content: categoryPrompt },
                  {
                    role: 'user',
                    content: `El cliente (${clientDisplayName}) escribió por WhatsApp: "${messageText}". Redacta la respuesta breve y directa que se enviará a su WhatsApp.`,
                  },
                ],
              }),
            });
            if (gptRes.ok) {
              const gptJson = await gptRes.json();
              const aiReplyText = (gptJson?.choices?.[0]?.message?.content || '').trim();
              if (aiReplyText) {
                const botLabel = getChannelAiBotLabel(resolvedChannel);
                const aiLine = `[${nowTimeStr}] 👨‍💻 ${botLabel}: ${aiReplyText}`;
                await supabase.from('ticket_comments').insert({
                  ticket_id: activeTicket.id,
                  company_id: companyId,
                  author_id: null,
                  body: aiLine,
                  is_internal: false,
                });
                updatedDescription = `${updatedDescription}\n${aiLine}`;
                lastWhatsappMsgPreview = aiReplyText.slice(0, 200);
                const targetJid = remoteJid || currentMeta.whatsapp_jid || cleanPhone;
                if (targetJid) {
                  updatedOutbox = [
                    ...updatedOutbox.slice(-9),
                    {
                      id: crypto.randomUUID(),
                      status: 'pending',
                      number: targetJid,
                      text: aiReplyText,
                      instance:
                        instanceName === 'arias'
                          ? 'soporte'
                          : instanceName || currentMeta.evolution_instance || 'soporte',
                      apikey:
                        incomingEvoApiKey ||
                        currentMeta.evolution_apikey ||
                        '10C73BF4-D3D9-4CDB-9855-85E346468546',
                      created_at: new Date().toISOString(),
                    },
                  ];
                  aiTextReplySent = true;
                }
              }
            }
          } catch (aiErr) {
            console.error('AI text auto-reply error:', aiErr);
          }
        }
      }

      const updatedFields: Record<string, any> = {
        description: updatedDescription,
        updated_at: new Date().toISOString(),
        ...(isGroup && resolvedGroupSubject ? { lead_name: resolvedGroupSubject } : {}),
        metadata: {
          ...currentMeta,
          ...(isGroup ? { is_group: true } : {}),
          ...(resolvedGroupSubject ? { whatsapp_group_subject: resolvedGroupSubject } : {}),
          support_channel: isGroup ? 'soporte' : resolvedChannel,
          whatsapp_message_count: msgCount + (aiTextReplySent ? 1 : 0),
          last_whatsapp_message: lastWhatsappMsgPreview,
          last_whatsapp_at: new Date().toISOString(),
          pending_audio_jobs: updatedAudioJobs,
          pending_whatsapp_outbox: updatedOutbox,
          ...(incomingEvoServerUrl ? { evolution_server_url: incomingEvoServerUrl } : {}),
          ...(incomingEvoApiKey ? { evolution_apikey: incomingEvoApiKey } : {}),
          evolution_instance:
            instanceName === 'arias'
              ? 'soporte'
              : instanceName || currentMeta.evolution_instance || 'soporte',
          ai_category:
            shouldUpgradeProblemTitle || classification.supportChannel !== 'soporte'
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
          support_channel: resolvedChannel,
          ai_text_reply_sent: aiTextReplySent,
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

    // ─── CASE C: Only ignore closing agreements ("ok, de acuerdo, gracias") when a recently closed ticket exists!
    // NEVER ignore a new 1-on-1 lead (`!isGroup`) or a contact with no previous tickets (`matchingClientTickets.length === 0`)!
    if (
      !classification.isActualSupportProblem &&
      isGreetingOrClosingAgreement(messageText) &&
      recentlyClosedTicket
    ) {
      await supabase.from('ticket_comments').insert({
        ticket_id: recentlyClosedTicket.id,
        company_id: companyId,
        body: `[${nowTimeStr}] ${senderLabel}: ${messageText}`,
        is_internal: false,
      });

      return new Response(
        JSON.stringify({
          ok: true,
          ignored: true,
          action: 'non_problem_message_ignored',
          reason: 'Closing courtesy reply appended to recently closed ticket',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── CASE D: Client or New Lead writes and has NO open ticket ─────
    // Create 1 consolidated Ticket in `tickets` ONLY (NEVER in `leads` automatically!)
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
          evolution_instance: instanceName === 'arias' ? 'soporte' : instanceName || 'soporte',
          ...(incomingEvoServerUrl ? { evolution_server_url: incomingEvoServerUrl } : {}),
          ...(incomingEvoApiKey ? { evolution_apikey: incomingEvoApiKey } : {}),
          whatsapp_jid: remoteJid,
          whatsapp_phone: cleanPhone,
          whatsapp_push_name: pushName,
          is_group: isGroup,
          is_existing_client: isExistingClientContact,
          ...(resolvedGroupSubject ? { whatsapp_group_subject: resolvedGroupSubject } : {}),
          ...(rawGroupSubject ? { group_subject_synced: true } : {}),
          support_channel: classification.supportChannel,
          ai_category: classification.category,
          whatsapp_message_count: 1,
          last_whatsapp_message: messageText.slice(0, 200),
          last_whatsapp_at: new Date().toISOString(),
          is_recurring_client_issue: Boolean(previousSameCategoryTicket),
          previous_ticket_id: previousSameCategoryTicket?.id || null,
        },
      })
      .select('id, title, metadata')
      .single();

    if (insertError) {
      throw insertError;
    }

    if (createdTicket?.id) {
      const { data: firstComment } = await supabase
        .from('ticket_comments')
        .insert({
          ticket_id: createdTicket.id,
          company_id: companyId,
          body: `[${nowTimeStr}] ${senderLabel} (Reporte Inicial): ${messageText}`,
          is_internal: false,
        })
        .select('id')
        .single();

      // If the very first message of a new ticket is a voice note, queue the audio job immediately!
      if (isIncomingAudio && firstComment?.id) {
        await supabase
          .from('tickets')
          .update({
            metadata: {
              ...(createdTicket.metadata || {}),
              pending_audio_jobs: [
                {
                  id: crypto.randomUUID(),
                  status: 'pending',
                  comment_id: firstComment.id,
                  ticket_id: createdTicket.id,
                  remote_jid: remoteJid,
                  message_key: key,
                  instance: instanceName === 'arias' ? 'soporte' : instanceName || 'soporte',
                  apikey: incomingEvoApiKey || '10C73BF4-D3D9-4CDB-9855-85E346468546',
                  auto_reply: true,
                  created_at: new Date().toISOString(),
                },
              ],
            },
          })
          .eq('id', createdTicket.id);
      } else if (!isIncomingAudio && !isGreetingOrClosingAgreement(messageText)) {
        // If it's a new incoming TEXT inquiry, auto-reply with OpenAI GPT-4o-mini using its category prompt!
        const aiCfg = await loadSupportAiConfig(supabase);
        if (aiCfg.autoReplyText && aiCfg.openAiKey) {
          const categoryPrompt =
            aiCfg.prompts[classification.supportChannel] || DEFAULT_AI_PROMPTS.soporte;
          try {
            const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${aiCfg.openAiKey}`,
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                temperature: 0.4,
                messages: [
                  { role: 'system', content: categoryPrompt },
                  {
                    role: 'user',
                    content: `El cliente (${clientDisplayName}) inició conversación por WhatsApp diciendo: "${messageText}". Redacta la respuesta breve y directa que se enviará a su WhatsApp.`,
                  },
                ],
              }),
            });
            if (gptRes.ok) {
              const gptJson = await gptRes.json();
              const aiReplyText = (gptJson?.choices?.[0]?.message?.content || '').trim();
              if (aiReplyText) {
                const botLabel = getChannelAiBotLabel(classification.supportChannel);
                const aiLine = `[${nowTimeStr}] 👨‍💻 ${botLabel}: ${aiReplyText}`;
                await supabase.from('ticket_comments').insert({
                  ticket_id: createdTicket.id,
                  company_id: companyId,
                  author_id: null,
                  body: aiLine,
                  is_internal: false,
                });

                const targetJid = remoteJid || cleanPhone;
                await supabase
                  .from('tickets')
                  .update({
                    description: `${initialDescription}\n${aiLine}`,
                    metadata: {
                      ...(createdTicket.metadata || {}),
                      last_whatsapp_message: aiReplyText.slice(0, 200),
                      last_whatsapp_at: new Date().toISOString(),
                      pending_whatsapp_outbox: targetJid
                        ? [
                            {
                              id: crypto.randomUUID(),
                              status: 'pending',
                              number: targetJid,
                              text: aiReplyText,
                              instance:
                                instanceName === 'arias'
                                  ? 'soporte'
                                  : instanceName || 'soporte',
                              apikey:
                                incomingEvoApiKey ||
                                '10C73BF4-D3D9-4CDB-9855-85E346468546',
                              created_at: new Date().toISOString(),
                            },
                          ]
                        : [],
                    },
                  })
                  .eq('id', createdTicket.id);
              }
            }
          } catch (aiErr) {
            console.error('Initial ticket AI auto-reply error:', aiErr);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        action: 'ticket_created',
        ticket_id: createdTicket?.id,
        title: createdTicket?.title,
        support_channel: classification.supportChannel,
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
