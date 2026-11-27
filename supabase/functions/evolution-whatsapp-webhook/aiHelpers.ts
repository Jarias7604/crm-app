import type { SupportChannelType } from './types.ts';
import { getBridgeState } from './bridgeState.ts';

// ─── AI config (stored per-company + synced with active OpenAI integration) ──

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

export const DEFAULT_RESOLVED_REPLY_TEMPLATE =
  '¡Muchas gracias por comentarnos, {nombre}! Qué gusto saber que ya cuentan con una solución. Quedamos a su entera disposición por si en el futuro desean evaluar nuevas opciones o apoyo adicional. ¡Muchos éxitos en sus operaciones! 🤝';

export const DEFAULT_RESOLVED_TRIGGER_PHRASES: string[] = [
  'ya resolvimos',
  'lo resolvimos',
  'ya se resolvio',
  'ya lo resolvimos',
  'ya resolvi',
  'ya lo resolvi',
  'ya contamos con un servicio',
  'ya contamos con servicio',
  'ya contamos con un sistema',
  'ya contamos con sistema',
  'ya contamos con proveedor',
  'tenemos un servicio',
  'ya tenemos un servicio',
  'ya tenemos servicio',
  'ya tenemos un sistema',
  'ya tenemos sistema',
  'ya tenemos proveedor',
  'ya contratamos',
  'ya adquirimos',
  'ya implementamos',
  'por ahora no necesitamos',
  'no necesitamos por ahora',
  'ya no necesitamos',
  'ya no lo necesitamos',
];

function normalizePhraseText(raw: string): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.,;:¡!¿?\-_/()"'+*👍🙏👌✅🙌😊🤝]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isAlreadyResolvedReply(text: string, customPhrases?: string[]): boolean {
  const raw = String(text || '').trim();
  if (!raw || raw.length > 180) return false;
  // Never auto-reply if the prospect asks a question
  if (/[?¿]/.test(raw)) return false;

  const norm = normalizePhraseText(raw);
  if (!norm || norm.length < 6) return false;

  // Never trigger if message contains buying intent, future follow-up, or support keywords
  const blockRegex =
    /\b(cotiz\w*|precio\w*|costo\w*|cuanto\w*|plan|planes|demo\w*|informaci\w*|info|interesa\w*|comenzando|iniciando|adelante|despues|proxim\w*|llamar\w*|llamame|reuni\w*|agendar|visita\w*|error\w*|falla\w*|problema\w*|ayuda\w*|soporte|anydesk)\b/i;
  if (blockRegex.test(norm)) return false;

  const phrases = Array.isArray(customPhrases) && customPhrases.length > 0 ? customPhrases : DEFAULT_RESOLVED_TRIGGER_PHRASES;
  for (const p of phrases) {
    const np = normalizePhraseText(p);
    if (np && np.length >= 5 && norm.includes(np)) {
      return true;
    }
  }
  return false;
}

function isBusinessOrGenericLeadName(raw?: string | null): boolean {
  const clean = String(raw || '')
    .replace(/\(\+?\d+\)/g, '')
    .trim();
  if (!clean) return true;
  if (/^(sin\s+nombre|contacto|cliente|prospecto|lead|soporte|admin|usuario|desconocido|whatsapp|\+?\d+)/i.test(clean)) {
    return true;
  }
  return /\b(casa|inversiones|lotificaci[oó]n|lotificadora|comedor|constructora|corporaci[oó]n|corp\b|grupo|residencial|tienda|ferreter[ií]a|cl[ií]nica|hotel|restaurante|autolote|auto\s+lote|taller|farmacia|supermercado|distribuidora|importadora|servicios|soluciones|agencia|asociaci[oó]n|fundaci[oó]n|iglesia|colegio|escuela|academia|laboratorio|panader[ií]a|pasteler[ií]a|est[eé]tica|sal[oó]n|barber[ií]a|gym|gimnasio|transporte|transportes|log[ií]stica|inmobiliaria|bienes\s+ra[ií]ces|desarrollos|urbanica|bosque|villas|finca|hacienda|agro|veterinaria|[oó]ptica|dental|odontolog[ií]a|abogados|bufete|contadores|despacho|consultor[ií]a|ingenier[ií]a|arquitectura|proyectos|multitienda|variedades|bazar|librer[ií]a|papeler[ií]a|imprenta|sublimaci[oó]n|publicidad|marketing|tecnolog[ií]a|sistemas|repuestos|lubricantes|llantas|motos|lavander[ií]a|florister[ií]a|eventos|banquetes|catering|seguridad|vigilancia|mantenimiento|refrigeraci[oó]n|el[eé]ctrica|plomer[ií]a|vidrier[ií]a|estructuras|carpinter[ií]a|muebler[ií]a|muebles|textiles|confecciones|bordados|serigraf[ií]a|pl[aá]sticos|empaques|reciclaje|gasolinera|cooperativa|financiera|seguros|corredora|aduana|aduanal|naviera|carga|courier|encomiendas|turismo|viajes|tours|alquiler|bodega|bodegas|almac[eé]n|mayorista|av[ií]cola|granero|granja|beneficio|caf[eé]|cafeter[ií]a|pizzer[ií]a|taquer[ií]a|pupuser[ií]a|asados|mariscos|cevicher[ií]a|spa\b|plaza\b|mercado|sucursal|boutique|s\.a\.|de\s+c\.v\.)\b/i.test(
    clean
  );
}

function extractCleanFirstName(rawName?: string | null): string {
  const clean = String(rawName || '')
    .replace(/\(\+?\d+\)/g, '')
    .trim();
  if (!clean || isBusinessOrGenericLeadName(clean)) return '';
  if (/[_@]/.test(clean)) return '';
  const withoutTitle = clean
    .replace(/^(lic(da|do)?|ing|arq|dr|dra|sr|sra|srta|don|doña|prof|abog|pastor|cnel|gral)\.?\s+/i, '')
    .trim();
  if (!withoutTitle) return '';
  const tokens = withoutTitle.split(/[\s,.-]+/).filter(Boolean);
  const first = tokens[0] || '';
  if (first.length < 2 || /\d/.test(first)) return '';
  if (tokens.length === 1 && first.length > 10) return '';
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function renderResolvedReplyTemplate(template: string, rawName?: string | null): string {
  const base = String(template || DEFAULT_RESOLVED_REPLY_TEMPLATE).trim() || DEFAULT_RESOLVED_REPLY_TEMPLATE;
  const firstName = extractCleanFirstName(rawName);
  const cleanCompany = String(rawName || '').replace(/\(\+?\d+\)/g, '').trim() || 'su empresa';

  let out = base.replace(/\{empresa\}/gi, cleanCompany);
  if (firstName) {
    out = out.replace(/\{nombre\}/gi, firstName);
  } else {
    out = out
      .replace(/,\s*\{nombre\}/gi, '')
      .replace(/\s+\{nombre\}/gi, '')
      .replace(/\{nombre\}/gi, '');
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}

export async function loadSupportAiConfig(supabase: any, companyId?: string | null) {
  const { data: openAiInt } = await supabase
    .from('marketing_integrations')
    .select('id, settings')
    .eq('provider', 'openai')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  const rawSettings = (openAiInt?.settings || {}) as Record<string, any>;
  const openAiKey = String(rawSettings.apiKey || Deno.env.get('OPENAI_API_KEY') || '').trim();
  const globalSavedCfg = (rawSettings.support_ai_config || {}) as Record<string, any>;

  let companySavedCfg: Record<string, any> = {};
  if (companyId) {
    try {
      companySavedCfg = await getBridgeState(supabase, `ai_config_${companyId}`);
    } catch {
      companySavedCfg = {};
    }
  }
  const savedCfg: Record<string, any> = { ...globalSavedCfg, ...companySavedCfg };
  const rawPhrases = savedCfg.resolved_trigger_phrases;
  const resolvedTriggerPhrases: string[] = Array.isArray(rawPhrases)
    ? rawPhrases.map((p: any) => String(p || '').trim()).filter(Boolean)
    : typeof rawPhrases === 'string' && rawPhrases.trim()
    ? rawPhrases
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
    : DEFAULT_RESOLVED_TRIGGER_PHRASES;

  return {
    integrationId: (openAiInt?.id as string) || null,
    openAiKey,
    rawSettings,
    autoReplyText: savedCfg.auto_reply_text === true,
    autoReplyAudio: savedCfg.auto_reply_audio === true,
    autoReplyResolvedEnabled: savedCfg.auto_reply_resolved_enabled === true,
    autoResolvedMarkLost: savedCfg.auto_resolved_mark_lost !== false,
    resolvedReplyTemplate: String(savedCfg.resolved_reply_template || DEFAULT_RESOLVED_REPLY_TEMPLATE).trim(),
    resolvedTriggerPhrases: resolvedTriggerPhrases.length > 0 ? resolvedTriggerPhrases : DEFAULT_RESOLVED_TRIGGER_PHRASES,
    prompts: {
      soporte: String(savedCfg.prompt_soporte || DEFAULT_AI_PROMPTS.soporte).trim(),
      contabilidad: String(savedCfg.prompt_contabilidad || DEFAULT_AI_PROMPTS.contabilidad).trim(),
      ventas: String(savedCfg.prompt_ventas || DEFAULT_AI_PROMPTS.ventas).trim(),
      otros: String(savedCfg.prompt_otros || DEFAULT_AI_PROMPTS.otros).trim(),
    } as Record<SupportChannelType, string>,
  };
}

export function aiBotLabel(ch: SupportChannelType): string {
  if (ch === 'contabilidad') return '🤖 IA Contabilidad';
  if (ch === 'ventas') return '🤖 IA Ventas';
  if (ch === 'otros') return '🤖 IA Atención';
  return '🤖 IA Soporte';
}

export interface WebhookAiUsageCtx {
  supabase: any;
  companyId: string;
  leadId?: string | null;
  ticketId?: string | null;
}

export function calculateWebhookOpenAiCostUsd(input: {
  model: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  audioSeconds?: number | null;
}): number {
  const model = String(input.model || '').toLowerCase().trim();
  const promptTokens = Math.max(0, Number(input.promptTokens) || 0);
  const completionTokens = Math.max(0, Number(input.completionTokens) || 0);
  const audioSeconds = Math.max(0, Number(input.audioSeconds) || 0);
  let cost = 0;
  if (model.includes('whisper')) {
    cost = (audioSeconds / 60) * 0.006;
  } else if (model.includes('mini')) {
    cost = (promptTokens * 0.15) / 1_000_000 + (completionTokens * 0.60) / 1_000_000;
  } else if (model.includes('gpt-4o')) {
    cost = (promptTokens * 2.50) / 1_000_000 + (completionTokens * 10.0) / 1_000_000;
  } else {
    cost = (promptTokens * 0.15) / 1_000_000 + (completionTokens * 0.60) / 1_000_000;
  }
  return Number(cost.toFixed(6));
}

export function estimateWebhookAudioDurationSeconds(byteLength: number): number {
  return Math.max(1, Math.round(Math.max(0, Number(byteLength) || 0) / 3000));
}

async function logWebhookAiUsage(
  usageCtx: WebhookAiUsageCtx | undefined,
  entry: {
    feature: string;
    model: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    audioSeconds?: number;
    metadata?: Record<string, any>;
  },
) {
  if (!usageCtx?.supabase || !usageCtx?.companyId) return;
  try {
    const estimatedCostUsd = calculateWebhookOpenAiCostUsd({
      model: entry.model,
      promptTokens: entry.promptTokens,
      completionTokens: entry.completionTokens,
      audioSeconds: entry.audioSeconds,
    });
    await usageCtx.supabase.from('ai_usage_logs').insert({
      company_id: usageCtx.companyId,
      feature: entry.feature,
      provider: 'openai',
      model: entry.model,
      prompt_tokens: entry.promptTokens || 0,
      completion_tokens: entry.completionTokens || 0,
      total_tokens: entry.totalTokens || (entry.promptTokens || 0) + (entry.completionTokens || 0),
      audio_seconds: entry.audioSeconds || 0,
      estimated_cost_usd: estimatedCostUsd,
      lead_id: usageCtx.leadId || null,
      ticket_id: usageCtx.ticketId || null,
      metadata: entry.metadata || {},
    });
  } catch (e) {
    console.warn('[wa] logWebhookAiUsage warn:', (e as any)?.message || e);
  }
}

export async function askOpenAiTechnicalClassifier(
  openAiKey: string,
  text: string,
  usageCtx?: WebhookAiUsageCtx,
): Promise<boolean> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 40,
        messages: [
          {
            role: 'system',
            content:
              'Eres un clasificador estricto de tickets de Soporte Técnico para software ERP / Facturación Electrónica DTE / Contabilidad. Responde SOLO JSON válido: {"is_technical":true} si el mensaje reporta un error, falla, problema de acceso, caída del sistema, duda operativa técnica, solicitud de soporte/capacitación o problema contable/DTE; o {"is_technical":false} si es solo un saludo, cortesía, agradecimiento, coordinación administrativa, pago/número de cuenta o charla general sin problema técnico.',
          },
          { role: 'user', content: text.slice(0, 600) },
        ],
      }),
    });
    if (!res.ok) return false;
    const j = await res.json();
    if (j?.usage) {
      await logWebhookAiUsage(usageCtx, {
        feature: 'support_ai_classifier',
        model: 'gpt-4o-mini',
        promptTokens: Number(j.usage.prompt_tokens) || 0,
        completionTokens: Number(j.usage.completion_tokens) || 0,
        totalTokens: Number(j.usage.total_tokens) || 0,
      });
    }
    const raw = String(j?.choices?.[0]?.message?.content || '').trim();
    try {
      const parsed = JSON.parse(raw);
      return parsed?.is_technical === true;
    } catch {
      return /"is_technical"\s*:\s*true/i.test(raw);
    }
  } catch (e) {
    console.error('[wa] OpenAI tech classifier error', e);
    return false;
  }
}

export async function askOpenAi(
  openAiKey: string,
  systemPrompt: string,
  userContent: string,
  usageCtx?: WebhookAiUsageCtx,
): Promise<string> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      }),
    });
    if (!res.ok) return '';
    const j = await res.json();
    if (j?.usage) {
      await logWebhookAiUsage(usageCtx, {
        feature: 'support_ai_reply',
        model: 'gpt-4o-mini',
        promptTokens: Number(j.usage.prompt_tokens) || 0,
        completionTokens: Number(j.usage.completion_tokens) || 0,
        totalTokens: Number(j.usage.total_tokens) || 0,
      });
    }
    return String(j?.choices?.[0]?.message?.content || '').trim();
  } catch (e) {
    console.error('[wa] OpenAI error', e);
    return '';
  }
}

export async function transcribeAudio(
  openAiKey: string,
  bytes: Uint8Array,
  mime: string,
  usageCtx?: WebhookAiUsageCtx,
): Promise<string> {
  try {
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: mime || 'audio/ogg' }), 'voice.ogg');
    form.append('model', 'whisper-1');
    form.append('language', 'es');
    form.append('response_format', 'verbose_json');
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openAiKey}` },
      body: form,
    });
    if (!res.ok) return '';
    const j = await res.json();
    const durationSec = Number(j?.duration) > 0 ? Number(j.duration) : estimateWebhookAudioDurationSeconds(bytes.length);
    await logWebhookAiUsage(usageCtx, {
      feature: 'whisper_audio',
      model: 'whisper-1',
      audioSeconds: durationSec,
      metadata: { mime: mime || 'audio/ogg', bytes: bytes.length },
    });
    return String(j?.text || '').trim();
  } catch (e) {
    console.error('[wa] Whisper error', e);
    return '';
  }
}

export const QUALIFIER_CATCHUP_MAX_AGE_MS = 15 * 60 * 1000;

export interface QualifierTriggerInput {
  isCatchup: boolean;
  msgAgeMs: number;
  isStaff: boolean;
  isGroup: boolean;
  scope: string;
  aiQualifierActive: boolean;
  effectiveLeadId: string | null;
  messageText: string;
  hasNonAudioMediaWithoutCaption?: boolean;
}

export function shouldTriggerLeadQualifier(input: QualifierTriggerInput): boolean {
  if (input.isStaff || input.isGroup || !input.aiQualifierActive || !input.effectiveLeadId) {
    return false;
  }
  if (!['lead', 'por_clasificar'].includes(String(input.scope || ''))) {
    return false;
  }
  if (input.isCatchup) {
    if (!Number.isFinite(input.msgAgeMs) || input.msgAgeMs > QUALIFIER_CATCHUP_MAX_AGE_MS || input.msgAgeMs < -5 * 60 * 1000) {
      return false;
    }
  }
  if (input.hasNonAudioMediaWithoutCaption) {
    return false;
  }
  return Boolean(String(input.messageText || '').trim());
}

export function buildQualifierInvokeHeaders(
  syncSecret?: string | null,
  serviceKey?: string | null,
): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const cleanSecret = String(syncSecret || '').trim();
  const cleanService = String(serviceKey || '').trim();
  const effectiveSecret = cleanSecret || cleanService;
  if (effectiveSecret) {
    headers['x-sheets-sync-secret'] = effectiveSecret;
  }
  if (cleanService) {
    headers.Authorization = `Bearer ${cleanService}`;
    headers.apikey = cleanService;
  }
  return headers;
}
