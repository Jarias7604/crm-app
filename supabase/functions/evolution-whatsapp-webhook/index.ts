// =============================================================================
// evolution-whatsapp-webhook — WhatsApp Soporte (+503 7971-8911) via Evolution API
//
// Inbound:  Evolution -> POST (messages.upsert / send.message)
// Outbound: CRM -> outbox in ticket metadata -> Evolution bridge polls
//           GET ?action=bridge_sh and runs the returned shell lines against
//           its localhost:8085 Evolution API (port 8085 is not public).
//
// Conversation model: each WhatsApp chat (group or 1-on-1) is stored as tickets
// (metadata.source = 'whatsapp_evolution') + ticket_comments (one per message).
// metadata.wa_scope decides who can see it (enforced by RLS):
//   soporte | por_clasificar | lead | interno | spam
// Classification is decided ONLY here (single source of truth).
// =============================================================================
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { decode as decodeBase64 } from 'https://deno.land/std@0.168.0/encoding/base64.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-evolution-apikey',
};

const SUPPORT_PHONE = '50379718911';
const MEDIA_BUCKET = 'whatsapp-media';
const MEDIA_MAX_ATTEMPTS = 3;
const MEDIA_RETRY_AFTER_MS = 2 * 60 * 1000;
const GROUP_SYNC_EVERY_MS = 6 * 60 * 60 * 1000;
// A phone present in a large share of ALL client groups is our own staff (techs/owners
// are added to every group); clients/accountants appear in only a few.
const STAFF_GROUP_MIN = 5;
const STAFF_GROUP_SHARE = 0.3;

async function staffGroupThreshold(supabase: any, companyId: string): Promise<number> {
  const { count } = await supabase
    .from('whatsapp_groups')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId);
  return Math.max(STAFF_GROUP_MIN, Math.ceil((count || 0) * STAFF_GROUP_SHARE));
}
const TZ = 'America/El_Salvador';

type WaScope = 'soporte' | 'por_clasificar' | 'lead' | 'interno' | 'spam';
export type SupportChannelType = 'soporte' | 'contabilidad' | 'ventas' | 'otros';

const SCOPE_TITLE_TAG: Record<WaScope, string> = {
  soporte: 'Soporte',
  por_clasificar: 'Por clasificar',
  lead: 'Lead',
  interno: 'Equipo',
  spam: 'Spam',
};

const MEDIA_KINDS: Record<string, 'image' | 'video' | 'audio' | 'document' | 'sticker'> = {
  imageMessage: 'image',
  videoMessage: 'video',
  ptvMessage: 'video',
  audioMessage: 'audio',
  documentMessage: 'document',
  stickerMessage: 'sticker',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function digits(v: unknown): string {
  return String(v || '').replace(/\D/g, '');
}

function last8(v: unknown): string {
  const d = digits(v);
  return d.length >= 8 ? d.slice(-8) : '';
}

function jidPhone(jid: string): string {
  return /@(s\.whatsapp\.net|c\.us)$/.test(jid || '') ? digits(jid.split('@')[0]) : '';
}

function jidLid(jid: string): string {
  return /@lid$/.test(jid || '') ? digits(jid.split('@')[0]) : '';
}

// Only [A-Za-z0-9_-] may ever reach a shell line.
function shellSafe(v: unknown): string {
  return String(v || '').replace(/[^a-zA-Z0-9_-]/g, '');
}

function b64Utf8(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
}

function normName(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function messageDate(entry: any): Date {
  const raw = entry?.messageTimestamp;
  const n = Number(typeof raw === 'object' && raw !== null ? raw.low : raw);
  if (!Number.isFinite(n) || n <= 0) return new Date();
  const ms = n > 1e12 ? n : n * 1000;
  // Never trust a timestamp in the future (clock skew) or older than 30 days for "now" ordering.
  if (ms > Date.now() + 5 * 60 * 1000) return new Date();
  return new Date(ms);
}

// ─── Classification of the PROBLEM category (support only) ───────────────────

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
  if (startsWithAgreement && !hasExplicitNewErrorAfterOk) return true;
  return /^(hola|buenas|buenos dias|buenos días|buenas tardes|buenas noches|saludos|hey|alo|aló)(\s+(equipo|melvin|gerson|soporte|amigo|amigos|inge|ingeniero|como estan|cómo están))?$/i.test(
    clean
  );
}

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

function classifyIssueCategory(text: string): {
  category: string;
  shortCategoryTag: string;
  supportChannel: SupportChannelType;
  isActualSupportProblem: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
} {
  const lower = (text || '').toLowerCase();
  const has = (list: string[]) => list.some((k) => lower.includes(k));

  const isUrgent = has(['urgente', 'caido', 'caído', 'no funciona nada', 'bloqueado', 'no podemos facturar', 'produccion', 'producción', 'error critico', 'error crítico']);
  const isSales = has(['precio', 'precios', 'costo', 'costos', 'cotizacion', 'cotización', 'cotizar', 'cuanto cuesta', 'cuánto cuesta', 'cuanto vale', 'cuánto vale', 'planes', 'mensualidad', 'anualidad', 'demo', 'demostracion', 'demostración', 'comprar', 'adquirir', 'contratar', 'licencia', 'licencias', 'paquete', 'paquetes', 'tarifa', 'tarifas', 'implementacion', 'implementación', 'me interesa el sistema', 'informacion del sistema', 'información del sistema', 'quiero informacion', 'quiero información', 'venden', 'ofrecen', 'prospecto']);
  const isAccounting = has(['contabilidad', 'contable', 'contador', 'libro de iva', 'libros de iva', 'libro compras', 'libro ventas', 'consumidor final', 'contribuyente', 'declaracion', 'declaración', 'anexo', 'anexos', 'f07', 'f-07', 'f14', 'f-14', 'f11', 'retencion', 'retención', 'percepcion', 'percepción', 'planilla', 'planillas', 'isss', 'afp', 'renta', 'balance general', 'estado de resultado', 'partida contable', 'partidas', 'catalogo de cuentas', 'catálogo de cuentas', 'cierre contable', 'conciliacion', 'conciliación']);
  const isOtherProduct = has(['otro producto', 'otros productos', 'otro servicio', 'otros servicios', 'catalogo', 'catálogo', 'horario de atencion', 'horario de atención', 'ubicacion', 'ubicación', 'direccion', 'dirección', 'estado de cuenta']);
  const hasProblemKeyword = has(['error', 'problema', 'falla', 'fallando', 'fallo', 'falló', 'no deja', 'no puedo', 'no podemos', 'no carga', 'no sale', 'no aparece', 'no funciona', 'no genera', 'no transmite', 'no envia', 'no envía', 'no cuadra', 'no imprime', 'impresora', 'ayuda', 'ayudarme', 'apoyo', 'soporte', 'revisar', 'revisen', 'arreglar', 'corregir', 'bug', 'lento', 'traba', 'pegado', 'rechaza', 'rechazado', 'inconveniente', 'duda', 'consulta', 'como hago', 'cómo hago', 'factura', 'dte', 'hacienda', 'invalidacion', 'invalidación', 'credito fiscal', 'crédito fiscal', 'sello', 'firmador', 'contingencia', 'planilla', 'calculo', 'cálculo', 'permiso', 'acceso', 'contraseña', 'login', 'sincroniza', 'base de datos', 'nota de voz', 'imagen enviada', 'documento:']);
  const isClosingOrGreeting = isGreetingOrClosingAgreement(text);
  const isActualSupportProblem =
    (isUrgent || isSales || isAccounting || isOtherProduct || hasProblemKeyword) && !isClosingOrGreeting;

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
  } else if (/dte|hacienda|factura|invalidaci|credito fiscal|crédito fiscal|fe\b|contingencia|sello|firmador/i.test(lower)) {
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
  } else if (/calculo|cálculo|monto|total|descuento|pago|cobro/i.test(lower)) {
    supportChannel = 'contabilidad';
    category = 'Cálculos / Finanzas / Pagos';
    shortCategoryTag = 'Contabilidad';
  } else if (/lento|carga|caido|caído|servidor|base de datos|sql|sincroni/i.test(lower)) {
    category = 'Infraestructura / Base de Datos / Lentitud';
    shortCategoryTag = 'Base de Datos/Server';
  }

  return { category, shortCategoryTag, supportChannel, isActualSupportProblem, priority: isUrgent ? 'urgent' : 'high' };
}

function isGenericProblemTitle(title: string): boolean {
  const lower = (title || '').toLowerCase();
  return (
    lower.length < 32 ||
    /tengo un problema|necesito ayuda|una consulta|me ayudan|hay un error|no funciona$/i.test(lower)
  );
}

// ─── AI config (stored in the active OpenAI marketing integration) ───────────

async function loadSupportAiConfig(supabase: any) {
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
    integrationId: (openAiInt?.id as string) || null,
    openAiKey,
    rawSettings,
    autoReplyText: savedCfg.auto_reply_text === true,
    autoReplyAudio: savedCfg.auto_reply_audio === true,
    prompts: {
      soporte: String(savedCfg.prompt_soporte || DEFAULT_AI_PROMPTS.soporte).trim(),
      contabilidad: String(savedCfg.prompt_contabilidad || DEFAULT_AI_PROMPTS.contabilidad).trim(),
      ventas: String(savedCfg.prompt_ventas || DEFAULT_AI_PROMPTS.ventas).trim(),
      otros: String(savedCfg.prompt_otros || DEFAULT_AI_PROMPTS.otros).trim(),
    } as Record<SupportChannelType, string>,
  };
}

function aiBotLabel(ch: SupportChannelType): string {
  if (ch === 'contabilidad') return '🤖 IA Contabilidad';
  if (ch === 'ventas') return '🤖 IA Ventas';
  if (ch === 'otros') return '🤖 IA Atención';
  return '🤖 IA Soporte';
}

async function askOpenAi(openAiKey: string, systemPrompt: string, userContent: string): Promise<string> {
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
    return String(j?.choices?.[0]?.message?.content || '').trim();
  } catch (e) {
    console.error('[wa] OpenAI error', e);
    return '';
  }
}

async function transcribeAudio(openAiKey: string, bytes: Uint8Array, mime: string): Promise<string> {
  try {
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: mime || 'audio/ogg' }), 'voice.ogg');
    form.append('model', 'whisper-1');
    form.append('language', 'es');
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openAiKey}` },
      body: form,
    });
    if (!res.ok) return '';
    const j = await res.json();
    return String(j?.text || '').trim();
  } catch (e) {
    console.error('[wa] Whisper error', e);
    return '';
  }
}

// ─── Evolution key / instance (never hardcoded, never stored in tickets) ─────

async function getBridgeState(supabase: any, key: string): Promise<Record<string, any>> {
  const { data } = await supabase.from('whatsapp_bridge_state').select('value').eq('key', key).maybeSingle();
  return (data?.value || {}) as Record<string, any>;
}

async function setBridgeState(supabase: any, key: string, value: Record<string, any>) {
  await supabase
    .from('whatsapp_bridge_state')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
}

async function evolutionCredentials(supabase: any): Promise<{ key: string; instance: string }> {
  const envKey = Deno.env.get('EVOLUTION_API_KEY') || '';
  const envInstance = Deno.env.get('EVOLUTION_INSTANCE') || '';
  if (envKey) return { key: envKey, instance: envInstance || 'soporte' };
  const st = await getBridgeState(supabase, 'evolution');
  return { key: String(st.apikey || ''), instance: envInstance || String(st.instance || 'soporte') };
}

function normalizeInstance(name: unknown): string {
  const n = String(name || '').trim();
  return !n || n === 'arias' ? 'soporte' : n;
}

// ─── Company + team helpers ──────────────────────────────────────────────────

async function resolveMainCompanyId(supabase: any, companyIdParam: string | null): Promise<string | null> {
  if (companyIdParam) return companyIdParam;
  const envCompany = Deno.env.get('WA_SUPPORT_COMPANY_ID');
  if (envCompany) return envCompany;
  const { data: waTicket } = await supabase
    .from('tickets')
    .select('company_id')
    .eq('metadata->>source', 'whatsapp_evolution')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (waTicket?.company_id) return waTicket.company_id;
  const { data: anyTicket } = await supabase
    .from('tickets')
    .select('company_id')
    .not('company_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return anyTicket?.company_id || null;
}

interface TeamInfo {
  profiles: { id: string; full_name: string; phone: string | null }[];
  internoPhones: Map<string, { profileId: string | null; name: string | null }>; // last8 -> info
}

async function loadTeam(supabase: any, companyId: string): Promise<TeamInfo> {
  const [{ data: profs }, { data: internos }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, phone').eq('company_id', companyId),
    supabase
      .from('whatsapp_contacts')
      .select('phone, profile_id, display_name, push_name')
      .eq('company_id', companyId)
      .eq('contact_type', 'interno'),
  ]);
  const internoPhones = new Map<string, { profileId: string | null; name: string | null }>();
  for (const p of profs || []) {
    const l8 = last8(p.phone);
    if (l8) internoPhones.set(l8, { profileId: p.id, name: p.full_name });
  }
  for (const c of internos || []) {
    const l8 = last8(c.phone);
    if (l8) internoPhones.set(l8, { profileId: c.profile_id, name: c.display_name || c.push_name });
  }
  return { profiles: profs || [], internoPhones };
}

// Strong staff identification (safe to trust for auto-assign / auto-resolve).
function matchStaffByName(team: TeamInfo, pushName: string): { id: string; full_name: string } | null {
  const n = normName(pushName);
  if (!n || n === 'cliente whatsapp' || n.length < 4) return null;
  for (const p of team.profiles) {
    const full = normName(p.full_name || '');
    if (!full) continue;
    if (full === n) return p;
    if ((n.includes('gerson') && full.includes('gerson')) || (n.includes('melvin') && full.includes('melvin'))) {
      return p;
    }
  }
  return null;
}

// ─── Groups ──────────────────────────────────────────────────────────────────

interface Participant {
  phone: string | null;
  lid: string | null;
  admin?: string | null;
  name?: string | null;
}

function normalizeParticipants(list: any[]): Participant[] {
  const out: Participant[] = [];
  for (const p of Array.isArray(list) ? list : []) {
    const vals = [p?.id, p?.jid, p?.phoneNumber, p?.lid, p?.pn].filter((x) => typeof x === 'string') as string[];
    const pn = vals.find((v) => /@(s\.whatsapp\.net|c\.us)$/.test(v));
    const lid = vals.find((v) => /@lid$/.test(v));
    const item: Participant = {
      phone: pn ? digits(pn.split('@')[0]) : null,
      lid: lid ? digits(lid.split('@')[0]) : null,
      admin: p?.admin ?? null,
      name: p?.name || p?.notify || null,
    };
    if (item.phone || item.lid) out.push(item);
  }
  return out;
}

async function upsertGroup(
  supabase: any,
  companyId: string,
  groupJid: string,
  fields: { subject?: string | null; participants?: Participant[] }
) {
  const row: Record<string, any> = {
    company_id: companyId,
    group_jid: groupJid,
    updated_at: new Date().toISOString(),
  };
  if (fields.subject) row.subject = fields.subject;
  if (fields.participants) {
    row.participants = fields.participants;
    row.participants_synced_at = new Date().toISOString();
  }
  await supabase.from('whatsapp_groups').upsert(row, { onConflict: 'company_id,group_jid' });
}

// Learn a participant from a live group message (cheap incremental sync).
async function rememberParticipant(supabase: any, companyId: string, groupJid: string, part: Participant) {
  if (!part.phone && !part.lid) return;
  const { data: g } = await supabase
    .from('whatsapp_groups')
    .select('id, participants')
    .eq('company_id', companyId)
    .eq('group_jid', groupJid)
    .maybeSingle();
  const list: Participant[] = Array.isArray(g?.participants) ? g.participants : [];
  const idx = list.findIndex(
    (x) => (part.phone && x.phone === part.phone) || (part.lid && x.lid === part.lid)
  );
  if (idx >= 0) {
    const cur = list[idx];
    if ((part.phone && !cur.phone) || (part.lid && !cur.lid) || (part.name && !cur.name)) {
      list[idx] = { ...cur, phone: cur.phone || part.phone, lid: cur.lid || part.lid, name: cur.name || part.name };
    } else {
      return;
    }
  } else {
    list.push(part);
  }
  if (g?.id) {
    await supabase.from('whatsapp_groups').update({ participants: list, updated_at: new Date().toISOString() }).eq('id', g.id);
  } else {
    await supabase.from('whatsapp_groups').insert({ company_id: companyId, group_jid: groupJid, participants: list });
  }
}

async function groupsContaining(
  supabase: any,
  companyId: string,
  phone: string,
  lid: string
): Promise<{ group_jid: string; subject: string | null; client_id: string | null }[]> {
  const found = new Map<string, { group_jid: string; subject: string | null; client_id: string | null }>();
  const queries: Promise<any>[] = [];
  // jsonb containment needs a JSON string (an array would be sent as a Postgres array literal).
  if (phone) {
    queries.push(
      supabase
        .from('whatsapp_groups')
        .select('group_jid, subject, client_id')
        .eq('company_id', companyId)
        .contains('participants', JSON.stringify([{ phone }]))
    );
  }
  if (lid) {
    queries.push(
      supabase
        .from('whatsapp_groups')
        .select('group_jid, subject, client_id')
        .eq('company_id', companyId)
        .contains('participants', JSON.stringify([{ lid }]))
    );
  }
  for (const r of await Promise.all(queries)) {
    for (const g of r?.data || []) found.set(g.group_jid, g);
  }
  return [...found.values()];
}

// ─── Contact scope resolution (THE single source of truth) ───────────────────

interface ScopeInfo {
  scope: WaScope;
  reason: string;
  leadId: string | null;
  leadName: string | null;
  leadStatus: string | null;
  leadOwner: string | null;
  clientId: string | null;
  clientName: string | null;
  profileId: string | null;
  memberOfGroups: { jid: string; subject: string | null }[];
}

async function resolveScope(
  supabase: any,
  companyId: string,
  team: TeamInfo,
  phone: string,
  lid: string
): Promise<ScopeInfo> {
  const base: ScopeInfo = {
    scope: 'por_clasificar',
    reason: 'desconocido',
    leadId: null,
    leadName: null,
    leadStatus: null,
    leadOwner: null,
    clientId: null,
    clientName: null,
    profileId: null,
    memberOfGroups: [],
  };
  const l8 = last8(phone);

  const groups = await groupsContaining(supabase, companyId, phone, lid);
  base.memberOfGroups = groups.map((g) => ({ jid: g.group_jid, subject: g.subject }));

  // 1. Manual classification wins.
  let manual: any = null;
  if (l8) {
    const { data } = await supabase
      .from('whatsapp_contacts')
      .select('*')
      .eq('company_id', companyId)
      .like('phone', `%${l8}`)
      .limit(1);
    manual = data?.[0] || null;
  }
  if (!manual && lid) {
    const { data } = await supabase
      .from('whatsapp_contacts')
      .select('*')
      .eq('company_id', companyId)
      .eq('lid', lid)
      .limit(1);
    manual = data?.[0] || null;
  }

  // Lead lookup (used by manual 'lead' rows and by automatic detection).
  const loadLead = async (leadId: string | null) => {
    let q = supabase
      .from('leads')
      .select('id, name, status, es_cliente, assigned_to, phone')
      .eq('company_id', companyId);
    if (leadId) q = q.eq('id', leadId);
    else if (l8) q = q.like('phone', `%${l8.slice(0, 4)}%`).order('created_at', { ascending: false }).limit(25);
    else return null;
    const { data } = await q;
    const rows = (data || []) as any[];
    return leadId ? rows[0] || null : rows.find((r) => last8(r.phone) === l8) || null;
  };

  const applyLead = (lead: any, info: ScopeInfo, reasonPrefix: string): ScopeInfo => {
    info.leadId = lead.id;
    info.leadName = lead.name;
    info.leadStatus = lead.status;
    info.leadOwner = lead.assigned_to;
    if (lead.es_cliente || ['Cerrado', 'Cliente'].includes(lead.status)) {
      info.scope = 'soporte';
      info.reason = `${reasonPrefix}_cliente`;
    } else if (lead.status === 'Erróneo') {
      info.scope = 'spam';
      info.reason = `${reasonPrefix}_erroneo`;
    } else if (!lead.assigned_to) {
      // A lead nobody owns: put it where salespeople can take it.
      info.scope = 'por_clasificar';
      info.reason = `${reasonPrefix}_sin_vendedor`;
    } else {
      info.scope = 'lead';
      info.reason = reasonPrefix;
    }
    return info;
  };

  if (manual) {
    base.clientId = manual.client_id || null;
    base.profileId = manual.profile_id || null;
    if (manual.contact_type === 'lead') {
      const lead = await loadLead(manual.lead_id || null);
      if (lead) return applyLead(lead, base, 'manual_lead');
      return { ...base, scope: 'lead', reason: 'manual_lead' };
    }
    const map: Record<string, WaScope> = { cliente: 'soporte', interno: 'interno', spam: 'spam' };
    return { ...base, scope: map[manual.contact_type] || 'por_clasificar', reason: `manual_${manual.contact_type}` };
  }

  // 2. Our own team.
  if (l8 && team.internoPhones.has(l8)) {
    return { ...base, scope: 'interno', reason: 'equipo', profileId: team.internoPhones.get(l8)!.profileId };
  }
  if (groups.length >= STAFF_GROUP_MIN && groups.length >= (await staffGroupThreshold(supabase, companyId))) {
    return { ...base, scope: 'interno', reason: 'equipo_en_grupos' };
  }

  // 3. Member of a client support group.
  if (groups.length > 0) {
    return { ...base, scope: 'soporte', reason: 'miembro_grupo', clientId: groups.find((g) => g.client_id)?.client_id || null };
  }

  // 4. Phone registered in Clientes.
  if (l8) {
    const { data: cls } = await supabase
      .from('clients')
      .select('id, nombre, telefono')
      .eq('company_id', companyId)
      .like('telefono', `%${l8.slice(-4)}%`)
      .limit(50);
    const client = (cls || []).find((c: any) => last8(c.telefono) === l8);
    if (client) {
      return { ...base, scope: 'soporte', reason: 'cliente_crm', clientId: client.id, clientName: client.nombre };
    }
  }

  // 5. Lead in the CRM.
  const lead = await loadLead(null);
  if (lead) return applyLead(lead, base, 'lead_crm');

  return base;
}

// ─── Message parsing ─────────────────────────────────────────────────────────

function unwrapMessage(raw: any): any {
  return (
    raw?.ephemeralMessage?.message ||
    raw?.viewOnceMessage?.message ||
    raw?.viewOnceMessageV2?.message ||
    raw?.viewOnceMessageV2Extension?.message ||
    raw?.documentWithCaptionMessage?.message ||
    raw?.deviceSentMessage?.message ||
    raw?.editedMessage?.message?.protocolMessage?.editedMessage ||
    raw ||
    {}
  );
}

function extractMedia(msgObj: any): { field: string; kind: string; obj: any } | null {
  for (const field of Object.keys(MEDIA_KINDS)) {
    if (msgObj?.[field]) return { field, kind: MEDIA_KINDS[field], obj: msgObj[field] };
  }
  return null;
}

function mediaPlaceholder(kind: string, obj: any): string {
  if (kind === 'image') return '[Imagen enviada por WhatsApp]';
  if (kind === 'audio') return '[Nota de voz enviada por WhatsApp]';
  if (kind === 'video') return '[Video enviado por WhatsApp]';
  if (kind === 'sticker') return '[Sticker enviado por WhatsApp]';
  if (kind === 'document') return `[Documento: ${obj?.fileName || obj?.title || 'Archivo'}]`;
  return '[Archivo]';
}

// Media object without thumbnails/context (keeps the shell line small).
function slimMediaObject(obj: any): any {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (/thumbnail|contextInfo|scansSidecar|scanLengths|streamingSidecar|waveform/i.test(k)) continue;
    out[k] = v;
  }
  return out;
}

function extractText(msgObj: any, rawMsgObj: any, entry: any): string {
  const ext = msgObj?.extendedTextMessage || rawMsgObj?.extendedTextMessage || {};
  return String(
    msgObj?.conversation ||
      ext?.text ||
      ext?.matchedText ||
      ext?.canonicalUrl ||
      ext?.title ||
      msgObj?.imageMessage?.caption ||
      msgObj?.videoMessage?.caption ||
      msgObj?.documentMessage?.caption ||
      msgObj?.buttonsResponseMessage?.selectedDisplayText ||
      msgObj?.listResponseMessage?.title ||
      msgObj?.templateButtonReplyMessage?.selectedDisplayText ||
      msgObj?.interactiveResponseMessage?.body?.text ||
      entry?.body ||
      entry?.text ||
      (msgObj?.contactMessage || msgObj?.contactsArrayMessage ? '[Contacto enviado por WhatsApp]' : '') ||
      (msgObj?.locationMessage ? '[Ubicacion enviada por WhatsApp]' : '') ||
      ''
  ).trim();
}

function guessExt(mime: string, fileName: string): string {
  const fromName = (fileName || '').split('.').pop() || '';
  if (fromName && fromName.length <= 5 && fromName !== fileName) return shellSafe(fromName).toLowerCase() || 'bin';
  const m = (mime || '').split(';')[0].trim();
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    'video/mp4': 'mp4', 'video/3gpp': '3gp', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a',
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls', 'application/msword': 'doc', 'text/plain': 'txt',
  };
  return map[m] || 'bin';
}

function mediaTypeForSend(mime: string): 'image' | 'video' | 'audio' | 'document' {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'document';
}

// ─── Auth for actions invoked from the CRM UI ────────────────────────────────

interface Caller {
  userId: string;
  fullName: string;
  companyId: string | null;
  scopes: string[];
  isAdmin: boolean;
  userClient: any; // RLS-scoped client for "can this user see X" checks
}

async function getCaller(req: Request, supabase: any, supabaseUrl: string): Promise<Caller | null> {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data: userData, error } = await supabase.auth.getUser(token);
  if (error || !userData?.user) return null;
  const uid = userData.user.id;
  const { data: prof } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, custom_role_id, company_id, is_active, is_platform_owner')
    .eq('id', uid)
    .maybeSingle();
  if (!prof || prof.is_active === false) return null;
  const role = String(prof.role || '');
  let scopes: string[] = [];
  if (prof.is_platform_owner === true || role === 'super_admin' || role === 'company_admin') {
    scopes = ['all'];
  } else if (prof.custom_role_id) {
    const { data: rp } = await supabase
      .from('role_permissions')
      .select('permission_key')
      .eq('role_id', prof.custom_role_id)
      .eq('is_enabled', true)
      .in('permission_key', ['wa_chat_all', 'wa_chat_soporte', 'wa_chat_leads']);
    const keys = (rp || []).map((r: any) => r.permission_key);
    if (keys.includes('wa_chat_all')) scopes = ['all'];
    else {
      if (keys.includes('wa_chat_soporte')) scopes.push('soporte');
      if (keys.includes('wa_chat_leads')) scopes.push('leads');
    }
  }
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  return {
    userId: uid,
    fullName: prof.full_name || prof.email || 'Equipo',
    companyId: prof.company_id,
    scopes,
    isAdmin: scopes.includes('all'),
    userClient,
  };
}

// The ticket as the CALLER sees it (RLS) — null means "not allowed".
async function ticketVisibleTo(caller: Caller, ticketId: string): Promise<boolean> {
  const { data } = await caller.userClient.from('tickets').select('id').eq('id', ticketId).maybeSingle();
  return Boolean(data?.id);
}

// ─── Outbox (CRM -> WhatsApp through the bridge) ─────────────────────────────
// One row per outgoing message in whatsapp_outbox (atomic, no lost updates).

async function enqueueOutbox(
  supabase: any,
  item: {
    companyId: string;
    ticketId: string;
    commentId: string | null;
    instance: string;
    number: string;
    kind: 'text' | 'media';
    payload: Record<string, any>;
    createdBy?: string | null;
  }
) {
  if (!item.number) return null;
  const { data, error } = await supabase
    .from('whatsapp_outbox')
    .insert({
      company_id: item.companyId,
      ticket_id: item.ticketId,
      comment_id: item.commentId,
      instance: normalizeInstance(item.instance),
      number: item.number,
      kind: item.kind,
      payload: item.payload,
      created_by: item.createdBy || null,
    })
    .select('id')
    .single();
  if (error) {
    console.error('[wa] outbox insert error', error);
    return null;
  }
  return data?.id || null;
}

// Strip secrets / legacy queues that older versions stored in ticket metadata.
function cleanMeta(meta: Record<string, any>): Record<string, any> {
  const m = { ...(meta || {}) };
  delete m.evolution_apikey;
  delete m.pending_audio_jobs;
  delete m.last_bridge_evo_response;
  if (Array.isArray(m.pending_whatsapp_outbox)) {
    m.pending_whatsapp_outbox = m.pending_whatsapp_outbox.map((i: any) => {
      const { apikey: _k, ...rest } = i || {};
      return rest;
    });
  }
  return m;
}

// =============================================================================
// HTTP handler
// =============================================================================

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // CRM_* only matter when this function writes to a DIFFERENT project; for its own
  // project the platform-managed service key is always the valid one.
  const ownUrl = Deno.env.get('SUPABASE_URL') || '';
  const crmUrl = Deno.env.get('CRM_SUPABASE_URL') || '';
  const usesOtherProject = Boolean(crmUrl) && crmUrl.replace(/\/$/, '') !== ownUrl.replace(/\/$/, '');
  const supabaseUrl = usesOtherProject ? crmUrl : ownUrl;
  const serviceKey = usesOtherProject
    ? Deno.env.get('CRM_SERVICE_ROLE_KEY') || ''
    : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const url = new URL(req.url);
  const selfUrl = `${(Deno.env.get('SUPABASE_URL') || supabaseUrl).replace(/\/$/, '')}/functions/v1/evolution-whatsapp-webhook`;

  try {
    if (req.method === 'GET') {
      if (url.searchParams.get('action') === 'bridge_sh') {
        return await handleBridgeSh(supabase, selfUrl);
      }
      return json({ ok: true, status: 'active', service: 'evolution-whatsapp-webhook', version: '2026-11-06' });
    }

    const payload = await req.json().catch(() => ({}));
    const action = url.searchParams.get('action') || payload?.action || '';

    // ── Bridge callbacks (server-to-server, no user session) ──
    if (action === 'bridge_ack') return await handleBridgeAck(supabase, url, payload);
    if (action === 'upload_media') return await handleUploadMedia(supabase, url, payload);
    if (action === 'sync_group_subject') return await handleSyncGroup(supabase, url, payload);
    if (action === 'sync_all_groups') return await handleSyncAllGroups(supabase, url, payload);

    // ── Actions from the CRM UI (require a logged-in user) ──
    const uiActions = [
      'get_ai_config', 'test_openai', 'save_ai_config', 'save_ai_prompt', 'set_ticket_channel',
      'promote_to_lead', 'classify_contact', 'send_reply', 'send_media', 'retry_media', 'bridge_status',
    ];
    if (uiActions.includes(action)) {
      const caller = await getCaller(req, supabase, supabaseUrl);
      if (!caller) return json({ ok: false, error: 'No autorizado' }, 401);
      if (caller.scopes.length === 0) return json({ ok: false, error: 'Sin acceso al Chat WhatsApp' }, 403);

      switch (action) {
        case 'get_ai_config':
        case 'test_openai':
          return await handleGetAiConfig(supabase);
        case 'save_ai_config':
        case 'save_ai_prompt':
          if (!caller.isAdmin) return json({ ok: false, error: 'Solo un administrador puede cambiar la IA' }, 403);
          return await handleSaveAiConfig(supabase, payload);
        case 'set_ticket_channel':
          return await handleSetChannel(supabase, caller, payload);
        case 'promote_to_lead':
          return await handleClassify(supabase, caller, { ...payload, contact_type: 'lead' });
        case 'classify_contact':
          return await handleClassify(supabase, caller, payload);
        case 'send_reply':
          return await handleSendReply(supabase, caller, payload);
        case 'send_media':
          return await handleSendMedia(supabase, caller, payload);
        case 'retry_media':
          return await handleRetryMedia(supabase, caller, payload);
        case 'bridge_status':
          return await handleBridgeStatus(supabase);
      }
    }

    // ── Everything else is an Evolution webhook event ──
    return await handleIncomingMessage(req, supabase, url, payload);
  } catch (err: any) {
    console.error('[evolution-whatsapp-webhook] Error:', err);
    return json({ ok: false, error: err?.message || 'Internal error' }, 500);
  }
});

// =============================================================================
// Inbound message
// =============================================================================

async function handleIncomingMessage(req: Request, supabase: any, url: URL, payload: any): Promise<Response> {
  const eventType = String(payload?.event || payload?.type || 'messages.upsert').toLowerCase();
  if (!/messages[._]upsert|send[._]message/.test(eventType)) {
    return json({ ok: true, ignored: true, reason: `event ${eventType} not handled` });
  }

  const instanceName = normalizeInstance(payload?.instance || payload?.instanceName);
  const incomingKey = String(payload?.apikey || req.headers.get('apikey') || req.headers.get('x-evolution-apikey') || '');
  const envKey = Deno.env.get('EVOLUTION_API_KEY') || '';
  if (envKey && incomingKey && incomingKey !== envKey) {
    return json({ ok: false, error: 'apikey inválida' }, 401);
  }

  const rawData = payload?.data || payload;
  const entry = Array.isArray(rawData) ? rawData[0] : Array.isArray(rawData?.messages) ? rawData.messages[0] : rawData;
  const key = entry?.key || payload?.key || {};
  const remoteJidRaw: string = key?.remoteJid || entry?.remoteJid || payload?.remoteJid || '';
  if (!remoteJidRaw || remoteJidRaw === 'status@broadcast' || remoteJidRaw.endsWith('@newsletter')) {
    return json({ ok: true, ignored: true, reason: 'broadcast/status ignored' });
  }

  const fromMe = Boolean(key?.fromMe ?? entry?.fromMe ?? false);
  const waMessageId: string = String(key?.id || entry?.id || '').trim();
  const isGroup = remoteJidRaw.endsWith('@g.us');
  const pushName: string = String(entry?.pushName || payload?.pushName || '').trim();
  const msgDate = messageDate(entry);

  const rawMsgObj = entry?.message || payload?.message || {};
  const msgObj = unwrapMessage(rawMsgObj);
  if (msgObj?.protocolMessage || msgObj?.reactionMessage || msgObj?.pollUpdateMessage) {
    return json({ ok: true, ignored: true, reason: 'protocol/reaction message' });
  }
  const media = extractMedia(msgObj);
  const text = extractText(msgObj, rawMsgObj, entry);
  const displayText = text || (media ? mediaPlaceholder(media.kind, media.obj) : '');
  if (!displayText) return json({ ok: true, ignored: true, reason: 'No text or media content' });

  // Sender identity
  const participantJid: string = key?.participant || entry?.participant || '';
  const participantAlt: string = key?.participantAlt || key?.participantPn || entry?.participantAlt || '';
  const remoteAlt: string = key?.remoteJidAlt || key?.senderPn || entry?.remoteJidAlt || entry?.senderPn || payload?.senderPn || '';

  const senderPhone = isGroup
    ? jidPhone(participantAlt) || jidPhone(participantJid)
    : jidPhone(remoteAlt) || jidPhone(remoteJidRaw);
  const senderLid = isGroup ? jidLid(participantJid) || jidLid(participantAlt) : jidLid(remoteJidRaw) || jidLid(remoteAlt);
  // Canonical chat id: group jid, or phone jid for 1-on-1 (LID chats are mapped to the phone when known).
  const chatJid = isGroup ? remoteJidRaw : senderPhone ? `${senderPhone}@s.whatsapp.net` : remoteJidRaw;
  const chatPhone = isGroup ? '' : senderPhone;

  const companyId = await resolveMainCompanyId(supabase, url.searchParams.get('company_id'));
  if (!companyId) return json({ ok: false, error: 'No company_id resolved' }, 400);

  // Remember Evolution credentials/instance server-side (never in tickets).
  if (incomingKey || instanceName) {
    const st = await getBridgeState(supabase, 'evolution');
    if ((incomingKey && st.apikey !== incomingKey) || st.instance !== instanceName) {
      await setBridgeState(supabase, 'evolution', { ...st, ...(incomingKey ? { apikey: incomingKey } : {}), instance: instanceName });
    }
  }

  // Dedupe (Evolution may deliver the same message twice).
  if (waMessageId) {
    const { data: dup } = await supabase
      .from('whatsapp_messages')
      .select('id')
      .eq('company_id', companyId)
      .eq('wa_message_id', waMessageId)
      .maybeSingle();
    if (dup) return json({ ok: true, ignored: true, reason: 'duplicate message' });
  }

  const team = await loadTeam(supabase, companyId);

  // Who is speaking?
  const senderL8 = last8(senderPhone);
  const staffByName = matchStaffByName(team, pushName);
  const staffByPhone = senderL8 ? team.internoPhones.get(senderL8) : undefined;
  let isStaff = fromMe || Boolean(staffByName) || Boolean(staffByPhone);
  let staffStrong = isStaff;
  const staffProfileId: string | null = staffByName?.id || staffByPhone?.profileId || null;

  // Group bookkeeping + scope
  let groupSubject = '';
  let scopeInfo: ScopeInfo;
  if (isGroup) {
    const { data: grp } = await supabase
      .from('whatsapp_groups')
      .select('subject, client_id')
      .eq('company_id', companyId)
      .eq('group_jid', chatJid)
      .maybeSingle();
    groupSubject = String(
      entry?.groupMetadata?.subject || rawData?.groupMetadata?.subject || payload?.groupSubject || grp?.subject || ''
    ).trim();
    if (!grp) await upsertGroup(supabase, companyId, chatJid, { subject: groupSubject || null });
    else if (groupSubject && groupSubject !== grp.subject) await upsertGroup(supabase, companyId, chatJid, { subject: groupSubject });
    if (!fromMe && (senderPhone || senderLid)) {
      await rememberParticipant(supabase, companyId, chatJid, { phone: senderPhone || null, lid: senderLid || null, name: pushName || null });
    }
    if (!isStaff && (senderPhone || senderLid)) {
      // Weak staff signal: present in many client groups (label only, no auto-resolve).
      const memberships = await groupsContaining(supabase, companyId, senderPhone, senderLid);
      if (memberships.length >= STAFF_GROUP_MIN && memberships.length >= (await staffGroupThreshold(supabase, companyId))) {
        isStaff = true;
      }
    }
    scopeInfo = {
      scope: 'soporte', reason: 'grupo', leadId: null, leadName: null, leadStatus: null, leadOwner: null,
      clientId: grp?.client_id || null, clientName: null, profileId: null, memberOfGroups: [],
    };
  } else {
    scopeInfo = await resolveScope(supabase, companyId, team, chatPhone, senderLid);
  }

  const scope = scopeInfo.scope;
  const classification = classifyIssueCategory(displayText);
  const supportChannel: SupportChannelType =
    scope === 'soporte' ? (classification.supportChannel === 'ventas' ? 'soporte' : classification.supportChannel) : 'ventas';

  const clientDisplayName = isGroup
    ? groupSubject || 'Grupo WhatsApp'
    : scopeInfo.leadName || scopeInfo.clientName || (pushName ? (chatPhone ? `${pushName} (+${chatPhone})` : pushName) : chatPhone ? `WhatsApp +${chatPhone}` : 'Cliente WhatsApp');

  const senderLabel = isStaff
    ? `👨‍💻 ${staffByName?.full_name || staffByPhone?.name || (fromMe ? 'Equipo Soporte' : pushName || 'Equipo Soporte')}`
    : `👤 ${pushName || (chatPhone ? `+${chatPhone}` : 'Cliente')}`;
  const timeStr = fmtTime(msgDate);

  // fromMe echo of something the CRM itself just sent -> link ids, don't duplicate.
  // ── Find the conversation (ticket) ──
  const { data: jidTickets } = await supabase
    .from('tickets')
    .select('id, title, status, priority, assigned_to, metadata, description, lead_id, lead_name, resolved_at, created_at, updated_at')
    .eq('company_id', companyId)
    .eq('metadata->>source', 'whatsapp_evolution')
    .eq('metadata->>whatsapp_jid', chatJid)
    .order('created_at', { ascending: false })
    .limit(20);
  let tickets = (jidTickets || []) as any[];
  if (tickets.length === 0 && !isGroup && remoteJidRaw !== chatJid) {
    // Legacy rows stored the raw (LID) jid.
    const { data: legacy } = await supabase
      .from('tickets')
      .select('id, title, status, priority, assigned_to, metadata, description, lead_id, lead_name, resolved_at, created_at, updated_at')
      .eq('company_id', companyId)
      .eq('metadata->>source', 'whatsapp_evolution')
      .eq('metadata->>whatsapp_jid', remoteJidRaw)
      .order('created_at', { ascending: false })
      .limit(20);
    tickets = (legacy || []) as any[];
  }
  let activeTicket = tickets.find((t) => ['new', 'open', 'pending'].includes(t.status)) || null;

  // A fromMe message may be the echo of something the CRM itself sent through the bridge.
  if (fromMe && tickets.length > 0) {
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recentOut } = await supabase
      .from('whatsapp_outbox')
      .select('id, ticket_id, comment_id, kind, payload, wa_message_id, status')
      .in('ticket_id', tickets.map((t) => t.id))
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20);
    const outs = (recentOut || []) as any[];
    const echo =
      outs.find((o) => waMessageId && o.wa_message_id === waMessageId) ||
      outs.find(
        (o) =>
          !o.wa_message_id &&
          ((o.kind === 'text' && String(o.payload?.text || '').trim() === displayText.trim()) ||
            (o.kind === 'media' && Boolean(media)))
      );
    if (echo) {
      if (waMessageId) {
        await supabase.from('whatsapp_outbox').update({ wa_message_id: waMessageId }).eq('id', echo.id).is('wa_message_id', null);
        const { data: linked } = await supabase
          .from('whatsapp_messages')
          .update({ wa_message_id: waMessageId })
          .eq('comment_id', echo.comment_id)
          .is('wa_message_id', null)
          .select('id');
        if (!linked || linked.length === 0) {
          await supabase.from('whatsapp_messages').upsert(
            {
              company_id: companyId, ticket_id: echo.ticket_id, comment_id: echo.comment_id, wa_message_id: waMessageId,
              remote_jid: chatJid, from_me: true, message_ts: msgDate.toISOString(), message_type: media?.kind || 'text',
              body: displayText,
            },
            { onConflict: 'company_id,wa_message_id', ignoreDuplicates: true }
          );
        }
      }
      return json({ ok: true, ignored: true, reason: 'echo of CRM-sent message' });
    }
  }

  const recentlyClosed = !activeTicket
    ? tickets.find((t) => {
        if (!['resolved', 'closed'].includes(t.status) || t.metadata?.merged_into) return false;
        const closedAt = new Date(t.resolved_at || t.updated_at || t.created_at).getTime();
        return Date.now() - closedAt <= 4 * 60 * 60 * 1000;
      })
    : null;

  // Staff talking with no open conversation: attach to the latest one, never open a "self-ticket".
  let targetTicket: any = activeTicket;
  if (!targetTicket && isStaff) {
    targetTicket = tickets.find((t) => !t.metadata?.merged_into) || null;
    if (!targetTicket && (scope === 'soporte' || isGroup)) {
      return json({ ok: true, ignored: true, reason: 'Staff message with no conversation — no self-ticket' });
    }
  }
  // Client courtesy ("gracias", "ok") right after closing: attach to the closed ticket, don't reopen.
  if (
    !targetTicket &&
    scope === 'soporte' &&
    recentlyClosed &&
    !classification.isActualSupportProblem &&
    isGreetingOrClosingAgreement(displayText) &&
    !media
  ) {
    targetTicket = recentlyClosed;
  }

  const baseMetaPatch: Record<string, any> = {
    source: 'whatsapp_evolution',
    support_phone: SUPPORT_PHONE,
    evolution_instance: instanceName,
    whatsapp_jid: chatJid,
    whatsapp_phone: chatPhone,
    is_group: isGroup,
    wa_scope: scope,
    wa_scope_reason: scopeInfo.reason,
    is_existing_client: scope === 'soporte',
    member_of_groups: scopeInfo.memberOfGroups,
    ...(isGroup && groupSubject ? { whatsapp_group_subject: groupSubject, group_subject_synced: true } : {}),
    ...(scopeInfo.clientId ? { client_id: scopeInfo.clientId } : {}),
    ...(senderLid && !isGroup ? { whatsapp_lid: senderLid } : {}),
  };
  if (!fromMe && pushName && !isStaff) baseMetaPatch.whatsapp_push_name = pushName;

  // ── Create a new conversation ticket if needed ──
  let createdNew = false;
  if (!targetTicket) {
    const previousSameCategory = tickets.find(
      (t) => ['resolved', 'closed'].includes(t.status) && t.metadata?.ai_category === classification.category
    );
    const shortTitle = displayText.length > 85 ? `${displayText.slice(0, 82).trim()}...` : displayText;
    const tag = scope === 'soporte' ? classification.shortCategoryTag : SCOPE_TITLE_TAG[scope];
    const parentTicketId = scope === 'soporte' ? previousSameCategory?.id || null : null;
    const insertRow = {
      company_id: companyId,
      lead_id: scopeInfo.leadId,
      lead_name: clientDisplayName,
      ...(parentTicketId ? { parent_ticket_id: parentTicketId } : {}),
      assigned_to: scope === 'lead' ? scopeInfo.leadOwner : null,
      title: `[WhatsApp · ${tag}] ${clientDisplayName}: ${shortTitle}`,
      description: [
        scope === 'soporte' ? `📌 PROBLEMA REPORTADO (${classification.category}):` : `💬 Conversación de WhatsApp (${SCOPE_TITLE_TAG[scope]}):`,
        displayText,
        '',
        '💬 Historial de WhatsApp:',
      ].join('\n'),
      status: 'open',
      priority: scope === 'soporte' ? classification.priority : 'medium',
      metadata: {
        ...baseMetaPatch,
        support_channel: supportChannel,
        ai_category: scope === 'soporte' ? classification.category : 'Ventas / Precios / Nuevo Lead',
        whatsapp_message_count: 0,
        is_recurring_client_issue: scope === 'soporte' && Boolean(previousSameCategory),
        previous_ticket_id: scope === 'soporte' ? previousSameCategory?.id || null : null,
      },
    };
    const { data: created, error: createErr } = await supabase.from('tickets').insert(insertRow).select('*').single();
    if (createErr) {
      // Another message for the same chat created it a millisecond earlier (unique open conversation).
      if (String(createErr.code) === '23505') {
        const { data: winner } = await supabase
          .from('tickets')
          .select('*')
          .eq('company_id', companyId)
          .eq('metadata->>source', 'whatsapp_evolution')
          .eq('metadata->>whatsapp_jid', chatJid)
          .in('status', ['new', 'open', 'pending'])
          .maybeSingle();
        if (!winner) throw createErr;
        targetTicket = winner;
      } else {
        throw createErr;
      }
    } else {
      targetTicket = created;
      createdNew = true;
    }
  }

  // ── Claim the message id (dedupe across concurrent deliveries) ──
  let waRowId: string | null = null;
  const waRow: Record<string, any> = {
    company_id: companyId,
    ticket_id: targetTicket.id,
    wa_message_id: waMessageId || null,
    remote_jid: chatJid,
    from_me: fromMe,
    sender_phone: senderPhone || null,
    sender_name: pushName || null,
    message_ts: msgDate.toISOString(),
    message_type: media?.kind || 'text',
    body: displayText,
  };
  if (media) {
    waRow.media_status = 'pending';
    waRow.media_mime = media.obj?.mimetype || null;
    waRow.media_filename = media.obj?.fileName || null;
    waRow.media_size = Number(media.obj?.fileLength?.low ?? media.obj?.fileLength) || null;
    waRow.raw_message = { key: { ...key, remoteJid: remoteJidRaw }, message: { [media.field]: slimMediaObject(media.obj) } };
  }
  const { data: claimed, error: claimErr } = await supabase.from('whatsapp_messages').insert(waRow).select('id').single();
  if (claimErr) {
    if (String(claimErr.code) === '23505') return json({ ok: true, ignored: true, reason: 'duplicate message (race)' });
    throw claimErr;
  }
  waRowId = claimed.id;

  // ── The chat line (comment) ──
  const isFirst = createdNew && !isStaff;
  const line = `[${timeStr}] ${senderLabel}${isFirst && scope === 'soporte' ? ' (Reporte Inicial)' : ''}: ${displayText}`;
  const { data: comment } = await supabase
    .from('ticket_comments')
    .insert({
      ticket_id: targetTicket.id,
      company_id: companyId,
      author_id: isStaff && staffStrong ? staffProfileId : null,
      body: line,
      is_internal: false,
      created_at: msgDate.toISOString(),
    })
    .select('id')
    .single();
  if (comment?.id) await supabase.from('whatsapp_messages').update({ comment_id: comment.id }).eq('id', waRowId);

  // Inline media (Evolution "webhook base64" option) — store right away.
  const inlineB64: string = entry?.message?.base64 || entry?.base64 || payload?.data?.message?.base64 || '';
  if (media && inlineB64 && waRowId) {
    await storeMediaBytes(supabase, waRowId, inlineB64, media.obj?.mimetype || '', media.obj?.fileName || '');
  }

  // ── Update the ticket ──
  const currentMeta = cleanMeta(targetTicket.metadata || {});
  const isResolutionReply =
    staffStrong && scope === 'soporte' && /listo|resuelto|solucionado|arreglado|ya quedo|ya quedó|corregido|actualizado/i.test(displayText);
  const shouldUpgradeTitle =
    scope === 'soporte' &&
    !isStaff &&
    classification.isActualSupportProblem &&
    isGenericProblemTitle(targetTicket.title) &&
    displayText.length >= 15;

  let lastPreview = displayText.slice(0, 200);
  let description = String(targetTicket.description || '');
  description = description.includes('💬 Historial de WhatsApp:')
    ? `${description}\n${line}`
    : `${description}\n\n💬 Historial de WhatsApp:\n${line}`;

  // Optional AI text auto-reply (OFF by default). Never for staff, team, spam or audio (audio replies after transcription).
  let aiReplied = false;
  if (!isStaff && !media && ['soporte', 'lead', 'por_clasificar'].includes(scope) && !isGreetingOrClosingAgreement(displayText) && currentMeta.ai_auto_reply_text_enabled !== false) {
    const aiCfg = await loadSupportAiConfig(supabase);
    if (aiCfg.autoReplyText && aiCfg.openAiKey) {
      const reply = await askOpenAi(
        aiCfg.openAiKey,
        aiCfg.prompts[supportChannel] || DEFAULT_AI_PROMPTS.soporte,
        `El cliente (${clientDisplayName}) escribió por WhatsApp: "${displayText}". Redacta la respuesta breve y directa que se enviará a su WhatsApp.`
      );
      if (reply) {
        const aiLine = `[${fmtTime(new Date())}] 👨‍💻 ${aiBotLabel(supportChannel)}: ${reply}`;
        const { data: aiComment } = await supabase
          .from('ticket_comments')
          .insert({ ticket_id: targetTicket.id, company_id: companyId, author_id: null, body: aiLine, is_internal: false })
          .select('id')
          .single();
        description = `${description}\n${aiLine}`;
        lastPreview = reply.slice(0, 200);
        await enqueueOutbox(supabase, {
          companyId, ticketId: targetTicket.id, commentId: aiComment?.id || null, instance: instanceName,
          number: chatJid, kind: 'text', payload: { text: reply },
        });
        aiReplied = true;
      }
    }
  }

  const prevScope = String(currentMeta.wa_scope || '');
  const scopeChanged = prevScope !== '' && prevScope !== scope;
  const updated: Record<string, any> = {
    description,
    updated_at: new Date().toISOString(),
    metadata: {
      ...currentMeta,
      ...baseMetaPatch,
      support_channel: scope === 'soporte' ? (classification.supportChannel !== 'soporte' && classification.supportChannel !== 'ventas' && !isStaff ? classification.supportChannel : currentMeta.support_channel === 'ventas' ? 'soporte' : currentMeta.support_channel || 'soporte') : 'ventas',
      whatsapp_message_count: Number(currentMeta.whatsapp_message_count || 0) + 1 + (aiReplied ? 1 : 0),
      last_whatsapp_message: lastPreview,
      last_whatsapp_at: msgDate.toISOString(),
      last_message_from: aiReplied || isStaff ? 'staff' : 'client',
      ...(scopeChanged ? { wa_scope_changed_at: new Date().toISOString(), wa_scope_previous: prevScope } : {}),
      ai_category:
        scope !== 'soporte'
          ? 'Ventas / Precios / Nuevo Lead'
          : shouldUpgradeTitle || (classification.supportChannel !== 'soporte' && !isStaff)
          ? classification.category
          : currentMeta.ai_category === 'Ventas / Precios / Nuevo Lead'
          ? classification.category
          : currentMeta.ai_category || classification.category,
    },
  };
  if (isGroup && groupSubject) updated.lead_name = groupSubject;
  if (!isGroup && scopeInfo.leadId && !targetTicket.lead_id) updated.lead_id = scopeInfo.leadId;
  if (!isGroup && (scopeInfo.leadName || scopeInfo.clientName) && targetTicket.lead_name !== clientDisplayName) {
    updated.lead_name = clientDisplayName;
  }
  if (staffStrong && staffProfileId && !targetTicket.assigned_to && scope === 'soporte') updated.assigned_to = staffProfileId;
  if (scope === 'lead' && !targetTicket.assigned_to && scopeInfo.leadOwner) updated.assigned_to = scopeInfo.leadOwner;
  if (shouldUpgradeTitle) {
    const snippet = displayText.length > 85 ? `${displayText.slice(0, 82).trim()}...` : displayText;
    updated.title = `[WhatsApp · ${classification.shortCategoryTag}] ${clientDisplayName}: ${snippet}`;
  } else if (scopeChanged) {
    updated.title = String(targetTicket.title || '').replace(/^\[WhatsApp · [^\]]*\]/, `[WhatsApp · ${scope === 'soporte' ? 'Soporte' : SCOPE_TITLE_TAG[scope]}]`);
  }
  if (isResolutionReply && ['new', 'open', 'pending'].includes(targetTicket.status)) {
    updated.status = 'resolved';
    updated.resolved_at = new Date().toISOString();
    updated.last_status_change_at = new Date().toISOString();
    updated.solution = displayText;
  }

  await supabase.from('tickets').update(updated).eq('id', targetTicket.id);

  return json({
    ok: true,
    action: createdNew ? 'ticket_created' : isResolutionReply ? 'ticket_resolved' : 'message_appended',
    ticket_id: targetTicket.id,
    wa_scope: scope,
    scope_reason: scopeInfo.reason,
    media: media?.kind || null,
  });
}

// =============================================================================
// Media
// =============================================================================

async function storeMediaBytes(
  supabase: any,
  waMsgId: string,
  base64: string,
  mime: string,
  fileName: string
): Promise<{ ok: boolean; path?: string; bytes?: Uint8Array; mime?: string; error?: string }> {
  const { data: row } = await supabase
    .from('whatsapp_messages')
    .select('id, company_id, ticket_id, comment_id, message_type, media_filename, media_mime')
    .eq('id', waMsgId)
    .maybeSingle();
  if (!row) return { ok: false, error: 'message row not found' };
  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(base64.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, ''));
  } catch (_e) {
    return { ok: false, error: 'invalid base64' };
  }
  const finalMime = (mime || row.media_mime || 'application/octet-stream').split(';')[0].trim();
  const finalName = fileName || row.media_filename || '';
  const ext = guessExt(finalMime, finalName);
  const path = `${row.company_id}/${row.ticket_id}/${row.id}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, bytes, { contentType: finalMime, upsert: true });
  if (upErr) {
    await supabase.from('whatsapp_messages').update({ media_status: 'failed', media_error: `storage: ${upErr.message}` }).eq('id', row.id);
    return { ok: false, error: upErr.message };
  }
  await supabase
    .from('whatsapp_messages')
    .update({
      media_status: 'ready',
      media_path: path,
      media_mime: finalMime,
      media_filename: finalName || null,
      media_size: bytes.length,
      media_error: null,
      raw_message: null,
    })
    .eq('id', row.id);
  return { ok: true, path, bytes, mime: finalMime };
}

async function handleUploadMedia(supabase: any, url: URL, payload: any): Promise<Response> {
  const waMsgId = shellSafe(url.searchParams.get('wamsg') || payload?.wamsg || '');
  if (!waMsgId) return json({ ok: false, error: 'missing wamsg' }, 400);

  const b64: string = payload?.base64 || payload?.data?.base64 || payload?.message?.base64 || '';
  if (!b64) {
    const errText = JSON.stringify(payload?.response?.message || payload?.error || payload || {}).slice(0, 400);
    const { data: row } = await supabase.from('whatsapp_messages').select('media_attempts').eq('id', waMsgId).maybeSingle();
    const attempts = Number(row?.media_attempts || 0);
    await supabase
      .from('whatsapp_messages')
      .update({ media_status: attempts >= MEDIA_MAX_ATTEMPTS ? 'failed' : 'pending', media_error: errText || 'empty response' })
      .eq('id', waMsgId);
    return json({ ok: false, error: 'no base64 in Evolution response', detail: errText });
  }

  const stored = await storeMediaBytes(supabase, waMsgId, b64, payload?.mimetype || payload?.data?.mimetype || '', payload?.fileName || payload?.data?.fileName || '');
  if (!stored.ok) return json({ ok: false, error: stored.error });

  // Voice notes: transcription (+ optional AI voice reply).
  const { data: row } = await supabase
    .from('whatsapp_messages')
    .select('id, company_id, ticket_id, comment_id, message_type, from_me')
    .eq('id', waMsgId)
    .maybeSingle();
  if (row?.message_type === 'audio' && !row.from_me && stored.bytes) {
    const aiCfg = await loadSupportAiConfig(supabase);
    if (aiCfg.openAiKey) {
      const transcript = await transcribeAudio(aiCfg.openAiKey, stored.bytes, stored.mime || 'audio/ogg');
      if (transcript && row.comment_id) {
        const { data: c } = await supabase.from('ticket_comments').select('body').eq('id', row.comment_id).maybeSingle();
        if (c && !String(c.body || '').includes('📝 Transcripción IA')) {
          await supabase.from('ticket_comments').update({ body: `${c.body}\n📝 Transcripción IA: "${transcript}"` }).eq('id', row.comment_id);
        }
        await supabase.from('whatsapp_messages').update({ body: transcript }).eq('id', row.id);
      }
      const { data: t } = await supabase.from('tickets').select('*').eq('id', row.ticket_id).maybeSingle();
      const meta = cleanMeta(t?.metadata || {});
      const scope = String(meta.wa_scope || 'soporte') as WaScope;
      if (t && aiCfg.autoReplyAudio && meta.ai_auto_reply_enabled !== false && ['soporte', 'lead', 'por_clasificar'].includes(scope)) {
        const ch: SupportChannelType = scope === 'soporte' ? (meta.support_channel as SupportChannelType) || 'soporte' : 'ventas';
        const reply = await askOpenAi(
          aiCfg.openAiKey,
          aiCfg.prompts[ch] || DEFAULT_AI_PROMPTS.soporte,
          transcript
            ? `El cliente (${t.lead_name || 'Cliente'}) envió una nota de voz diciendo: "${transcript}". Redacta la respuesta que se enviará a su WhatsApp.`
            : `El cliente (${t.lead_name || 'Cliente'}) envió una nota de voz. Redacta una respuesta amable confirmando recepción y que el equipo ya la está escuchando.`
        );
        if (reply) {
          const { data: aiComment } = await supabase
            .from('ticket_comments')
            .insert({ ticket_id: t.id, company_id: t.company_id, author_id: null, body: `[${fmtTime(new Date())}] 👨‍💻 ${aiBotLabel(ch)}: ${reply}`, is_internal: false })
            .select('id')
            .single();
          await enqueueOutbox(supabase, {
            companyId: t.company_id, ticketId: t.id, commentId: aiComment?.id || null,
            instance: normalizeInstance(meta.evolution_instance),
            number: meta.whatsapp_jid || meta.whatsapp_phone, kind: 'text', payload: { text: reply },
          });
          await supabase
            .from('tickets')
            .update({
              updated_at: new Date().toISOString(),
              metadata: {
                ...meta,
                last_whatsapp_message: reply.slice(0, 200),
                last_whatsapp_at: new Date().toISOString(),
                last_message_from: 'staff',
              },
            })
            .eq('id', t.id);
        }
      }
    }
  }
  return json({ ok: true, path: stored.path });
}

async function handleRetryMedia(supabase: any, caller: Caller, payload: any): Promise<Response> {
  const id = String(payload?.wa_message_row_id || '');
  if (!id) return json({ ok: false, error: 'missing wa_message_row_id' }, 400);
  const { data: row } = await supabase.from('whatsapp_messages').select('id, ticket_id, raw_message').eq('id', id).maybeSingle();
  if (!row || !(await ticketVisibleTo(caller, row.ticket_id))) return json({ ok: false, error: 'No permitido' }, 403);
  if (!row.raw_message) return json({ ok: false, error: 'Este archivo ya no se puede volver a descargar' }, 409);
  await supabase.from('whatsapp_messages').update({ media_status: 'pending', media_attempts: 0, media_error: null }).eq('id', id);
  return json({ ok: true });
}

// =============================================================================
// Bridge (polled by the Evolution server) — every user value is base64-encoded
// or reduced to [A-Za-z0-9_-] before reaching the shell.
// =============================================================================

async function handleBridgeSh(supabase: any, selfUrl: string): Promise<Response> {
  const { key, instance } = await evolutionCredentials(supabase);
  const safeKey = shellSafe(key);
  const lines: string[] = [];
  const evo = 'http://localhost:8085';
  const now = new Date();
  await setBridgeState(supabase, 'bridge_last_poll', { at: now.toISOString() });

  if (!safeKey) return new Response('# no evolution key configured\n', { headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' } });

  // 0. Recently active conversations: legacy queued items (pre-upgrade) and group subject sync.
  const { data: recent } = await supabase
    .from('tickets')
    .select('id, company_id, metadata')
    .eq('metadata->>source', 'whatsapp_evolution')
    .order('updated_at', { ascending: false })
    .limit(40);
  for (const row of recent || []) {
    const m = row.metadata || {};
    const queue: any[] = Array.isArray(m.pending_whatsapp_outbox) ? m.pending_whatsapp_outbox : [];
    const legacyPending = queue.filter((i) => i && i.status === 'pending');
    const needsSubject = typeof m.whatsapp_jid === 'string' && m.whatsapp_jid.endsWith('@g.us') && !m.group_subject_synced;
    if (legacyPending.length === 0 && !needsSubject) continue;

    for (const item of legacyPending) {
      await enqueueOutbox(supabase, {
        companyId: row.company_id, ticketId: row.id, commentId: item.comment_id || null,
        instance: item.instance || instance, number: item.number, kind: 'text', payload: { text: item.text },
      });
    }
    if (needsSubject) {
      const inst = shellSafe(normalizeInstance(m.evolution_instance || instance));
      const syncUrl = `${selfUrl}?action=sync_group_subject&ticket_id=${shellSafe(row.id)}`;
      lines.push(
        `curl -s "${evo}/group/findGroupInfos/${inst}?groupJid=${encodeURIComponent(m.whatsapp_jid).replace(/[^a-zA-Z0-9%._-]/g, '')}" -H "apikey: ${safeKey}" | curl -s -X POST "${syncUrl}" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1`
      );
    }
    await supabase
      .from('tickets')
      .update({
        metadata: {
          ...cleanMeta(m),
          pending_whatsapp_outbox: queue.map((i) => {
            const { apikey: _k, ...rest } = i || {};
            return rest.status === 'pending' ? { ...rest, status: 'migrated' } : rest;
          }),
          ...(needsSubject ? { group_subject_synced: true } : {}),
        },
      })
      .eq('id', row.id);
  }

  // 1. Outgoing messages (text + media). Each row is claimed atomically (pending -> dispatched).
  const { data: outRows } = await supabase
    .from('whatsapp_outbox')
    .select('id, ticket_id, instance, number, kind, payload')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(20);
  for (const item of outRows || []) {
    const { data: claimed } = await supabase
      .from('whatsapp_outbox')
      .update({ status: 'dispatched', dispatched_at: now.toISOString() })
      .eq('id', item.id)
      .eq('status', 'pending')
      .select('id');
    if (!claimed || claimed.length === 0) continue; // another poll took it
    const inst = shellSafe(normalizeInstance(item.instance || instance));
    const ackUrl = `${selfUrl}?action=bridge_ack&ticket_id=${shellSafe(item.ticket_id)}&outbox_id=${shellSafe(item.id)}`;
    const p = item.payload || {};
    let endpoint = 'sendText';
    let body: Record<string, any> = { number: item.number, text: p.text || '' };
    if (item.kind === 'media' && p.url) {
      endpoint = 'sendMedia';
      body = {
        number: item.number,
        mediatype: p.mediatype,
        mimetype: p.mimetype,
        caption: p.caption || '',
        media: p.url,
        fileName: p.fileName,
      };
    }
    const b64 = b64Utf8(JSON.stringify(body));
    lines.push(
      `EVO_OUT=$(echo "${b64}" | base64 -d | curl -s -X POST "${evo}/message/${endpoint}/${inst}" -H "Content-Type: application/json" -H "apikey: ${safeKey}" -d @-); printf '%s' "$EVO_OUT" | curl -s -X POST "${ackUrl}" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1`
    );
  }

  // 2. Media downloads (images, documents, audio, video). Retries stale requests.
  const staleBefore = new Date(now.getTime() - MEDIA_RETRY_AFTER_MS).toISOString();
  const { data: mediaJobs } = await supabase
    .from('whatsapp_messages')
    .select('id, raw_message, media_attempts, media_status, media_requested_at')
    .in('media_status', ['pending', 'requested'])
    .lt('media_attempts', MEDIA_MAX_ATTEMPTS)
    .gte('created_at', new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: true })
    .limit(15);
  let mediaQueued = 0;
  for (const job of mediaJobs || []) {
    if (mediaQueued >= 4) break;
    if (job.media_status === 'requested' && job.media_requested_at && job.media_requested_at > staleBefore) continue;
    if (!job.raw_message) continue;
    const inst = shellSafe(instance);
    const upUrl = `${selfUrl}?action=upload_media&wamsg=${shellSafe(job.id)}`;
    const b64 = b64Utf8(JSON.stringify({ message: job.raw_message, convertToMp4: false }));
    lines.push(
      `echo "${b64}" | base64 -d | curl -s -X POST "${evo}/chat/getBase64FromMediaMessage/${inst}" -H "Content-Type: application/json" -H "apikey: ${safeKey}" -d @- | curl -s -X POST "${upUrl}" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1`
    );
    await supabase
      .from('whatsapp_messages')
      .update({ media_status: 'requested', media_attempts: Number(job.media_attempts || 0) + 1, media_requested_at: now.toISOString() })
      .eq('id', job.id);
    mediaQueued++;
  }
  // Give up on jobs that exhausted retries.
  await supabase
    .from('whatsapp_messages')
    .update({ media_status: 'failed', media_error: 'No se pudo descargar después de varios intentos' })
    .eq('media_status', 'requested')
    .gte('media_attempts', MEDIA_MAX_ATTEMPTS)
    .lt('media_requested_at', staleBefore);

  // 3. Periodic full group/participant sync (who belongs to which client group).
  const gs = await getBridgeState(supabase, 'groups_sync');
  const lastReq = gs.requested_at ? new Date(gs.requested_at).getTime() : 0;
  if (now.getTime() - lastReq > GROUP_SYNC_EVERY_MS || gs.force === true) {
    const inst = shellSafe(instance);
    lines.push(
      `curl -s "${evo}/group/fetchAllGroups/${inst}?getParticipants=true" -H "apikey: ${safeKey}" | curl -s -X POST "${selfUrl}?action=sync_all_groups" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1`
    );
    await setBridgeState(supabase, 'groups_sync', { ...gs, requested_at: now.toISOString(), force: false });
  }

  return new Response(lines.length > 0 ? lines.join('\n') + '\n' : '# idle\n', {
    headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

async function handleBridgeAck(supabase: any, url: URL, payload: any): Promise<Response> {
  const ticketId = url.searchParams.get('ticket_id') || payload?.ticket_id;
  const outboxId = url.searchParams.get('outbox_id') || payload?.outbox_id || '';
  if (!ticketId) return json({ ok: false, error: 'missing ticket_id' }, 400);
  // New bridge lines post Evolution's raw response; legacy ones wrap it in evo_response.
  let evo: any = payload?.evo_response !== undefined ? payload.evo_response : payload;
  if (typeof evo === 'string') {
    try {
      evo = JSON.parse(evo);
    } catch (_e) {
      /* keep string */
    }
  }
  const sentId: string = evo?.key?.id || '';
  const evoError = !sentId ? JSON.stringify(evo || {}).slice(0, 300) : '';
  const nowIso = new Date().toISOString();
  await setBridgeState(supabase, 'bridge_last_ack', { at: nowIso, ok: Boolean(sentId), error: evoError || null });

  if (!outboxId) return json({ ok: true, legacy: true });
  const { data: ob } = await supabase
    .from('whatsapp_outbox')
    .update({
      status: sentId ? 'sent' : 'error',
      acked_at: nowIso,
      ...(sentId ? { wa_message_id: sentId, error: null } : { error: evoError || 'Evolution no confirmó el envío' }),
    })
    .eq('id', outboxId)
    .eq('ticket_id', ticketId)
    .select('id, company_id, ticket_id, comment_id, number, kind')
    .maybeSingle();
  if (!ob) return json({ ok: false, error: 'outbox item not found' }, 404);

  if (sentId && ob.comment_id) {
    // Link the WhatsApp id to the chat line so the fromMe echo is recognised as a duplicate.
    const { data: linked } = await supabase
      .from('whatsapp_messages')
      .update({ wa_message_id: sentId })
      .eq('comment_id', ob.comment_id)
      .is('wa_message_id', null)
      .select('id');
    if (!linked || linked.length === 0) {
      await supabase.from('whatsapp_messages').upsert(
        {
          company_id: ob.company_id, ticket_id: ob.ticket_id, comment_id: ob.comment_id, wa_message_id: sentId,
          remote_jid: ob.number, from_me: true, message_type: ob.kind === 'media' ? 'document' : 'text',
        },
        { onConflict: 'company_id,wa_message_id', ignoreDuplicates: true }
      );
    }
  }
  return json({ ok: true, sent: Boolean(sentId) });
}

async function handleSyncGroup(supabase: any, url: URL, payload: any): Promise<Response> {
  const ticketId = url.searchParams.get('ticket_id') || payload?.ticket_id;
  const g = payload?.data || payload || {};
  const subject = String(g?.subject || g?.groupMetadata?.subject || '').trim();
  if (!ticketId) return json({ ok: false, error: 'missing ticket_id' }, 400);
  const { data: t } = await supabase.from('tickets').select('id, company_id, metadata').eq('id', ticketId).maybeSingle();
  if (!t) return json({ ok: false, error: 'ticket not found' }, 404);
  const m = t.metadata || {};
  const jid = String(g?.id || m.whatsapp_jid || '');
  if (subject) {
    await supabase
      .from('tickets')
      .update({ lead_name: subject, metadata: { ...cleanMeta(m), is_group: true, whatsapp_group_subject: subject, group_subject_synced: true } })
      .eq('id', ticketId);
  }
  if (jid.endsWith('@g.us')) {
    await upsertGroup(supabase, t.company_id, jid, {
      subject: subject || null,
      ...(Array.isArray(g?.participants) ? { participants: normalizeParticipants(g.participants) } : {}),
    });
  }
  return json({ ok: true, subject });
}

async function handleSyncAllGroups(supabase: any, url: URL, payload: any): Promise<Response> {
  const list: any[] = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.groups) ? payload.groups : [];
  const companyId = await resolveMainCompanyId(supabase, url.searchParams.get('company_id'));
  if (!companyId) return json({ ok: false, error: 'No company' }, 400);
  if (list.length === 0) {
    await setBridgeState(supabase, 'groups_sync', {
      ...(await getBridgeState(supabase, 'groups_sync')),
      last_error: JSON.stringify(payload || {}).slice(0, 300),
      last_error_at: new Date().toISOString(),
    });
    return json({ ok: false, error: 'empty group list' });
  }
  let n = 0;
  for (const g of list) {
    const jid = String(g?.id || '');
    if (!jid.endsWith('@g.us')) continue;
    await upsertGroup(supabase, companyId, jid, {
      subject: String(g?.subject || '').trim() || null,
      participants: normalizeParticipants(g?.participants || []),
    });
    n++;
  }
  await setBridgeState(supabase, 'groups_sync', {
    ...(await getBridgeState(supabase, 'groups_sync')),
    synced_at: new Date().toISOString(),
    groups: n,
    last_error: null,
  });
  return json({ ok: true, groups: n });
}

async function handleBridgeStatus(supabase: any): Promise<Response> {
  const [poll, ack, gs, { count: pendingMedia }, { count: failedMedia }, { count: pendingOut }, { count: errorOut }] =
    await Promise.all([
      getBridgeState(supabase, 'bridge_last_poll'),
      getBridgeState(supabase, 'bridge_last_ack'),
      getBridgeState(supabase, 'groups_sync'),
      supabase.from('whatsapp_messages').select('id', { count: 'exact', head: true }).in('media_status', ['pending', 'requested']),
      supabase.from('whatsapp_messages').select('id', { count: 'exact', head: true }).eq('media_status', 'failed'),
      supabase.from('whatsapp_outbox').select('id', { count: 'exact', head: true }).in('status', ['pending', 'dispatched']),
      supabase
        .from('whatsapp_outbox')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'error')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    ]);
  const { key } = await evolutionCredentials(supabase);
  return json({
    ok: true,
    bridge_last_poll: poll.at || null,
    bridge_last_ack: ack.at || null,
    bridge_last_error: ack.error || null,
    groups_synced_at: gs.synced_at || null,
    groups_count: gs.groups || 0,
    groups_last_error: gs.last_error || null,
    media_pending: pendingMedia || 0,
    media_failed: failedMedia || 0,
    outbox_pending: pendingOut || 0,
    outbox_errors_24h: errorOut || 0,
    evolution_key_configured: Boolean(key),
  });
}

// =============================================================================
// UI actions
// =============================================================================

async function handleGetAiConfig(supabase: any): Promise<Response> {
  const aiCfg = await loadSupportAiConfig(supabase);
  let verified = false;
  let model = 'gpt-4o-mini';
  let err = '';
  if (aiCfg.openAiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aiCfg.openAiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 8, messages: [{ role: 'user', content: 'Responde OK' }] }),
      });
      if (res.ok) {
        const j = await res.json();
        verified = true;
        model = j?.model || model;
      } else err = `HTTP ${res.status}`;
    } catch (e: any) {
      err = e?.message || 'Network error';
    }
  } else err = 'No OpenAI API Key found';
  return json({
    ok: true,
    openai_verified: verified,
    openai_model: model,
    openai_error: err,
    auto_reply_text: aiCfg.autoReplyText,
    auto_reply_audio: aiCfg.autoReplyAudio,
    prompts: aiCfg.prompts,
  });
}

async function handleSaveAiConfig(supabase: any, payload: any): Promise<Response> {
  const aiCfg = await loadSupportAiConfig(supabase);
  const cfg = {
    auto_reply_text: payload?.auto_reply_text !== undefined ? Boolean(payload.auto_reply_text) : aiCfg.autoReplyText,
    auto_reply_audio:
      payload?.auto_reply_audio !== undefined
        ? Boolean(payload.auto_reply_audio)
        : payload?.ai_auto_reply_enabled !== undefined
        ? Boolean(payload.ai_auto_reply_enabled)
        : aiCfg.autoReplyAudio,
    prompt_soporte: String(payload?.prompts?.soporte || payload?.ai_voice_prompt || aiCfg.prompts.soporte).trim(),
    prompt_contabilidad: String(payload?.prompts?.contabilidad || aiCfg.prompts.contabilidad).trim(),
    prompt_ventas: String(payload?.prompts?.ventas || aiCfg.prompts.ventas).trim(),
    prompt_otros: String(payload?.prompts?.otros || aiCfg.prompts.otros).trim(),
    updated_at: new Date().toISOString(),
  };
  if (aiCfg.integrationId) {
    await supabase
      .from('marketing_integrations')
      .update({ settings: { ...aiCfg.rawSettings, support_ai_config: cfg } })
      .eq('id', aiCfg.integrationId);
  }
  return json({ ok: true, config: cfg });
}

async function handleSetChannel(supabase: any, caller: Caller, payload: any): Promise<Response> {
  const ticketId = String(payload?.ticket_id || '');
  const ch = String(payload?.support_channel || '') as SupportChannelType;
  if (!ticketId || !['soporte', 'contabilidad', 'otros'].includes(ch)) {
    return json({ ok: false, error: 'Canal inválido' }, 400);
  }
  if (!(await ticketVisibleTo(caller, ticketId))) return json({ ok: false, error: 'No permitido' }, 403);
  const { data: t } = await supabase.from('tickets').select('metadata').eq('id', ticketId).maybeSingle();
  if (!t) return json({ ok: false, error: 'Ticket no encontrado' }, 404);
  if ((t.metadata || {}).wa_scope && t.metadata.wa_scope !== 'soporte') {
    return json({ ok: false, error: 'Solo los chats de Soporte tienen categoría' }, 409);
  }
  const labels: Record<string, string> = {
    soporte: 'Facturación Electrónica / DTE / Soporte',
    contabilidad: 'Contabilidad / IVA / Planillas',
    otros: 'Otros Productos / Información General',
  };
  await supabase
    .from('tickets')
    .update({ updated_at: new Date().toISOString(), metadata: { ...cleanMeta(t.metadata || {}), support_channel: ch, ai_category: labels[ch] } })
    .eq('id', ticketId);
  return json({ ok: true, support_channel: ch });
}

// Classify a WhatsApp number: cliente | lead | interno | spam | por_clasificar (undo).
async function handleClassify(supabase: any, caller: Caller, payload: any): Promise<Response> {
  const ticketId = String(payload?.ticket_id || '');
  const type = String(payload?.contact_type || '') as 'cliente' | 'lead' | 'interno' | 'spam' | 'por_clasificar';
  if (!ticketId || !['cliente', 'lead', 'interno', 'spam', 'por_clasificar'].includes(type)) {
    return json({ ok: false, error: 'Clasificación inválida' }, 400);
  }
  const canClassify = caller.isAdmin || caller.scopes.includes('leads');
  if (!canClassify) return json({ ok: false, error: 'Solo administradores y vendedores pueden clasificar números' }, 403);
  if (!caller.isAdmin && ['interno', 'por_clasificar'].includes(type)) {
    return json({ ok: false, error: 'Solo un administrador puede marcar Equipo o deshacer una clasificación' }, 403);
  }
  if (!(await ticketVisibleTo(caller, ticketId))) return json({ ok: false, error: 'No tienes acceso a este chat' }, 403);

  const { data: t } = await supabase.from('tickets').select('*').eq('id', ticketId).maybeSingle();
  if (!t) return json({ ok: false, error: 'Chat no encontrado' }, 404);
  const meta = cleanMeta(t.metadata || {});
  if (meta.source !== 'whatsapp_evolution') return json({ ok: false, error: 'No es un chat de WhatsApp' }, 409);
  if (meta.is_group) return json({ ok: false, error: 'Los grupos siempre son de Soporte' }, 409);
  const phone = digits(meta.whatsapp_phone || jidPhone(String(meta.whatsapp_jid || '')));
  if (!phone) return json({ ok: false, error: 'Este chat no tiene número de teléfono' }, 409);

  // Vendors may only take numbers still "por clasificar" (or their own leads).
  if (!caller.isAdmin && meta.wa_scope !== 'por_clasificar' && !(meta.wa_scope === 'lead' && t.assigned_to === caller.userId)) {
    return json({ ok: false, error: 'Este número ya fue clasificado' }, 409);
  }

  const pushName = String(meta.whatsapp_push_name || '').trim();
  const nowIso = new Date().toISOString();
  const scopeFor: Record<string, WaScope> = { cliente: 'soporte', lead: 'lead', interno: 'interno', spam: 'spam', por_clasificar: 'por_clasificar' };
  const newScope = scopeFor[type];

  // Claim atomically: first one wins when two vendors click at the same time.
  if (!caller.isAdmin) {
    const { data: claimed } = await supabase
      .from('tickets')
      .update({ updated_at: nowIso, metadata: { ...meta, wa_scope: newScope, wa_classifying_by: caller.userId } })
      .eq('id', ticketId)
      .eq('metadata->>wa_scope', meta.wa_scope)
      .select('id');
    if (!claimed || claimed.length === 0) return json({ ok: false, error: 'Otra persona acaba de clasificar este número' }, 409);
  }

  let leadId: string | null = null;
  let leadName: string | null = null;
  let clientName: string | null = null;
  const clientId: string | null = payload?.client_id || null;
  const groupJid: string | null = payload?.group_jid || null;

  try {
    if (type === 'cliente' && clientId) {
      const { data: c } = await supabase.from('clients').select('id, nombre').eq('id', clientId).eq('company_id', t.company_id).maybeSingle();
      if (!c) throw new Error('Cliente no encontrado');
      clientName = c.nombre;
    }
    if (type === 'cliente' && groupJid && !clientName) {
      const { data: g } = await supabase.from('whatsapp_groups').select('subject').eq('company_id', t.company_id).eq('group_jid', groupJid).maybeSingle();
      clientName = g?.subject || null;
    }

    if (type === 'lead') {
      // Re-use an existing lead with this phone; otherwise create a Prospecto assigned to the caller.
      const l8 = last8(phone);
      let existing: any = null;
      if (t.lead_id) {
        const { data } = await supabase.from('leads').select('id, name, assigned_to, status').eq('id', t.lead_id).maybeSingle();
        existing = data;
      }
      if (!existing) {
        const { data } = await supabase
          .from('leads')
          .select('id, name, assigned_to, status, phone')
          .eq('company_id', t.company_id)
          .like('phone', `%${l8.slice(-4)}%`)
          .order('created_at', { ascending: false })
          .limit(25);
        existing = (data || []).find((l: any) => last8(l.phone) === l8) || null;
      }
      if (existing) {
        leadId = existing.id;
        leadName = existing.name;
        if (!existing.assigned_to) {
          // assigned_at is maintained by the trg_lead_assignment trigger.
          await supabase.from('leads').update({ assigned_to: caller.userId }).eq('id', existing.id);
        }
      } else {
        const name = String(payload?.lead_name || pushName || `WhatsApp +${phone}`).replace(/\(\+\d+\)/g, '').trim();
        const { data: created, error } = await supabase
          .from('leads')
          .insert({
            company_id: t.company_id,
            name,
            phone: `+${phone}`,
            status: 'Prospecto',
            priority: 'medium',
            source: 'WhatsApp',
            assigned_to: caller.isAdmin && payload?.assign_to ? payload.assign_to : caller.userId,
            next_action_notes: `[Desde Chat WhatsApp Soporte] ${String(meta.last_whatsapp_message || '').slice(0, 300)}`,
          })
          .select('id, name')
          .single();
        if (error) throw error;
        leadId = created.id;
        leadName = created.name;
      }
    }

    // Directory row (manual classification)
    if (type === 'por_clasificar') {
      await supabase.from('whatsapp_contacts').delete().eq('company_id', t.company_id).like('phone', `%${last8(phone)}`);
    } else {
      await supabase.from('whatsapp_contacts').upsert(
        {
          company_id: t.company_id,
          phone,
          lid: meta.whatsapp_lid || null,
          push_name: pushName || null,
          display_name: leadName || clientName || payload?.display_name || pushName || null,
          contact_type: type,
          client_id: type === 'cliente' ? clientId : null,
          lead_id: type === 'lead' ? leadId : null,
          profile_id: type === 'interno' ? payload?.profile_id || null : null,
          group_jid: type === 'cliente' ? groupJid : null,
          notes: payload?.notes || null,
          classified_by: caller.userId,
          classified_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: 'company_id,phone' }
      );
    }
  } catch (e: any) {
    if (!caller.isAdmin) {
      await supabase.from('tickets').update({ metadata: { ...meta } }).eq('id', ticketId); // release the claim
    }
    return json({ ok: false, error: e?.message || 'No se pudo clasificar' }, 500);
  }

  const labels: Record<string, string> = {
    cliente: 'Cliente (Soporte)', lead: 'Lead de Ventas', interno: 'Equipo interno', spam: 'Spam', por_clasificar: 'Por clasificar',
  };
  const newMeta: Record<string, any> = {
    ...meta,
    wa_scope: newScope,
    wa_scope_reason: `manual_${type}`,
    wa_classified_by: caller.userId,
    wa_classified_by_name: caller.fullName,
    wa_classified_at: nowIso,
    is_existing_client: newScope === 'soporte',
    support_channel: newScope === 'soporte' ? 'soporte' : 'ventas',
    ai_category: newScope === 'soporte' ? 'Soporte General / Consulta' : 'Ventas / Precios / Nuevo Lead',
    ...(clientId ? { client_id: clientId } : {}),
    ...(groupJid ? { linked_group_jid: groupJid } : {}),
  };
  delete newMeta.wa_classifying_by;
  const tag = newScope === 'soporte' ? 'Soporte' : SCOPE_TITLE_TAG[newScope];
  const ticketUpdate: Record<string, any> = {
    updated_at: nowIso,
    metadata: newMeta,
    title: String(t.title || '').replace(/^\[WhatsApp · [^\]]*\]/, `[WhatsApp · ${tag}]`),
  };
  if (leadId) {
    ticketUpdate.lead_id = leadId;
    ticketUpdate.lead_name = leadName;
    ticketUpdate.assigned_to = t.assigned_to || caller.userId;
  }
  if (clientName) ticketUpdate.lead_name = clientName;
  await supabase.from('tickets').update(ticketUpdate).eq('id', ticketId);

  // Audit line inside the chat (internal note, never sent to WhatsApp).
  await supabase.from('ticket_comments').insert({
    ticket_id: ticketId,
    company_id: t.company_id,
    author_id: caller.userId,
    body: `🏷️ ${caller.fullName} clasificó este número como: ${labels[type]}${leadName ? ` — Lead: ${leadName}` : ''}${clientName ? ` — ${clientName}` : ''}`,
    is_internal: true,
  });

  return json({ ok: true, wa_scope: newScope, lead: leadId ? { id: leadId, name: leadName } : null });
}

async function handleSendReply(supabase: any, caller: Caller, payload: any): Promise<Response> {
  const ticketId = String(payload?.ticket_id || '');
  const text = String(payload?.message_text || '').trim();
  if (!ticketId || !text) return json({ ok: false, error: 'Missing ticket_id or message_text' }, 400);
  if (!(await ticketVisibleTo(caller, ticketId))) return json({ ok: false, error: 'No tienes acceso a este chat' }, 403);

  const { data: t } = await supabase.from('tickets').select('*').eq('id', ticketId).maybeSingle();
  if (!t) return json({ ok: false, error: 'Ticket not found' }, 404);
  const meta = cleanMeta(t.metadata || {});
  const target = meta.whatsapp_jid || meta.whatsapp_phone || '';
  const authorName = /simulaci/i.test(caller.fullName) ? 'Soporte Técnico' : caller.fullName;
  const line = `[${fmtTime(new Date())}] 👨‍💻 ${authorName}: ${text}`;

  const { data: comment } = await supabase
    .from('ticket_comments')
    .insert({ ticket_id: ticketId, company_id: t.company_id, author_id: caller.userId, body: line, is_internal: false })
    .select('*')
    .single();

  const description = String(t.description || '').includes('💬 Historial de WhatsApp:')
    ? `${t.description}\n${line}`
    : `${t.description || ''}\n\n💬 Historial de WhatsApp:\n${line}`;
  const outboxId = target
    ? await enqueueOutbox(supabase, {
        companyId: t.company_id, ticketId, commentId: comment?.id || null,
        instance: normalizeInstance(meta.evolution_instance), number: target, kind: 'text',
        payload: { text }, createdBy: caller.userId,
      })
    : null;

  const update: Record<string, any> = {
    description,
    updated_at: new Date().toISOString(),
    metadata: {
      ...meta,
      whatsapp_message_count: Number(meta.whatsapp_message_count || 0) + 1,
      last_whatsapp_message: text.slice(0, 200),
      last_whatsapp_at: new Date().toISOString(),
      last_message_from: 'staff',
      last_staff_reply_at: new Date().toISOString(),
      last_staff_reply_by: authorName,
      staff_text_reply_count: Number(meta.staff_text_reply_count || 0) + 1,
      text_reply_minutes: Number(meta.text_reply_minutes || 0) + (Number(payload?.response_minutes) || 2),
    },
  };
  // Leads keep their owner; support chats get the first technician who answers.
  if (!t.assigned_to && (meta.wa_scope || 'soporte') === 'soporte') update.assigned_to = caller.userId;
  await supabase.from('tickets').update(update).eq('id', ticketId);

  return json({ ok: true, action: 'reply_queued', whatsapp_delivered: Boolean(outboxId), outbox_id: outboxId, comment });
}

async function handleSendMedia(supabase: any, caller: Caller, payload: any): Promise<Response> {
  const ticketId = String(payload?.ticket_id || '');
  const path = String(payload?.storage_path || '');
  const fileName = String(payload?.file_name || 'archivo').slice(0, 120);
  const mime = String(payload?.mime || 'application/octet-stream');
  const caption = String(payload?.caption || '').trim();
  if (!ticketId || !path) return json({ ok: false, error: 'Faltan datos del archivo' }, 400);
  if (!(await ticketVisibleTo(caller, ticketId))) return json({ ok: false, error: 'No tienes acceso a este chat' }, 403);
  const { data: t } = await supabase.from('tickets').select('*').eq('id', ticketId).maybeSingle();
  if (!t) return json({ ok: false, error: 'Chat no encontrado' }, 404);
  if (!path.startsWith(`outgoing/${t.company_id}/`)) return json({ ok: false, error: 'Ruta de archivo inválida' }, 400);

  const meta = cleanMeta(t.metadata || {});
  const target = meta.whatsapp_jid || meta.whatsapp_phone || '';
  const { data: signed, error: signErr } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, 60 * 60 * 24);
  if (signErr || !signed?.signedUrl) return json({ ok: false, error: 'No se pudo preparar el archivo' }, 500);

  const authorName = /simulaci/i.test(caller.fullName) ? 'Soporte Técnico' : caller.fullName;
  const kind = mediaTypeForSend(mime);
  const label = kind === 'image' ? '[Imagen]' : kind === 'video' ? '[Video]' : kind === 'audio' ? '[Audio]' : `[Documento: ${fileName}]`;
  const line = `[${fmtTime(new Date())}] 👨‍💻 ${authorName}: ${label}${caption ? ` ${caption}` : ''}`;
  const { data: comment } = await supabase
    .from('ticket_comments')
    .insert({ ticket_id: ticketId, company_id: t.company_id, author_id: caller.userId, body: line, is_internal: false })
    .select('*')
    .single();
  await supabase.from('whatsapp_messages').insert({
    company_id: t.company_id,
    ticket_id: ticketId,
    comment_id: comment?.id || null,
    remote_jid: target || null,
    from_me: true,
    message_type: kind === 'document' ? 'document' : kind,
    body: caption || label,
    media_status: 'ready',
    media_path: path,
    media_mime: mime,
    media_filename: fileName,
    media_size: Number(payload?.size) || null,
  });
  const outboxId = target
    ? await enqueueOutbox(supabase, {
        companyId: t.company_id, ticketId, commentId: comment?.id || null,
        instance: normalizeInstance(meta.evolution_instance), number: target, kind: 'media',
        payload: { url: signed.signedUrl, mimetype: mime, fileName, mediatype: kind, caption },
        createdBy: caller.userId,
      })
    : null;
  await supabase
    .from('tickets')
    .update({
      updated_at: new Date().toISOString(),
      ...(t.assigned_to || (meta.wa_scope || 'soporte') !== 'soporte' ? {} : { assigned_to: caller.userId }),
      metadata: {
        ...meta,
        last_whatsapp_message: `${label}${caption ? ` ${caption}` : ''}`.slice(0, 200),
        last_whatsapp_at: new Date().toISOString(),
        last_message_from: 'staff',
      },
    })
    .eq('id', ticketId);
  return json({ ok: true, comment, outbox_id: outboxId });
}
