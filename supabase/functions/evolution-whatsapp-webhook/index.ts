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
  // Phones are stored with any formatting ("+503 6836-1482"), so we pre-filter by the
  // last 4 digits (always contiguous) and then compare the exact last 8 digits.
  const loadLead = async (leadId: string | null) => {
    let q = supabase
      .from('leads')
      .select('id, name, status, es_cliente, assigned_to, phone')
      .eq('company_id', companyId);
    if (leadId) q = q.eq('id', leadId);
    else if (l8) q = q.like('phone', `%${l8.slice(-4)}%`).order('created_at', { ascending: false }).limit(1000);
    else return null;
    const { data } = await q;
    const rows = (data || []) as any[];
    return leadId ? rows[0] || null : rows.find((r) => last8(r.phone) === l8) || null;
  };

  const loadClient = async () => {
    if (!l8) return null;
    const { data: cls } = await supabase
      .from('clients')
      .select('id, nombre, telefono')
      .eq('company_id', companyId)
      .like('telefono', `%${l8.slice(-4)}%`)
      .limit(1000);
    return (cls || []).find((c: any) => last8(c.telefono) === l8) || null;
  };
  const groupClientId = groups.find((g) => g.client_id)?.client_id || null;

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
      // Business rule: anyone who belongs to a client support group is a client, never a lead.
      if (groups.length > 0) {
        return { ...base, scope: 'soporte', reason: 'miembro_grupo', clientId: base.clientId || groupClientId };
      }
      const lead = await loadLead(manual.lead_id || null);
      if (lead) return applyLead(lead, base, 'manual_lead');
      return { ...base, scope: 'lead', reason: 'manual_lead' };
    }
    const map: Record<string, WaScope> = { cliente: 'soporte', interno: 'interno', spam: 'spam' };
    return { ...base, scope: map[manual.contact_type] || 'por_clasificar', reason: `manual_${manual.contact_type}` };
  }

  // 2. Our own team (phone registered on a user profile).
  if (l8 && team.internoPhones.has(l8)) {
    return { ...base, scope: 'interno', reason: 'equipo', profileId: team.internoPhones.get(l8)!.profileId };
  }

  // 3. Phone registered in Clientes (checked before the "many groups" staff heuristic so an
  //    accountant who serves several clients is never mistaken for our own staff).
  const client = await loadClient();
  if (client) {
    return {
      ...base,
      scope: 'soporte',
      reason: groups.length > 0 ? 'cliente_crm_y_grupo' : 'cliente_crm',
      clientId: client.id,
      clientName: client.nombre,
    };
  }

  // 4. Present in a large share of all client groups => our own staff.
  if (groups.length >= STAFF_GROUP_MIN && groups.length >= (await staffGroupThreshold(supabase, companyId))) {
    return { ...base, scope: 'interno', reason: 'equipo_en_grupos' };
  }

  // 5. Member of a client support group => client (never a lead).
  if (groups.length > 0) {
    return { ...base, scope: 'soporte', reason: 'miembro_grupo', clientId: groupClientId };
  }

  // 6. Lead in the CRM.
  const lead = await loadLead(null);
  if (lead) return applyLead(lead, base, 'lead_crm');

  // 7. Unknown number => "Leads nuevos (por tomar)".
  return base;
}

// Re-run the classification on existing 1-on-1 chats (after a group sync, or periodically)
// so a chat never stays in the wrong tab because it was classified with older data
// (e.g. before the group participants were loaded, or before a lead status changed).
async function rescopeChats(supabase: any, companyId: string): Promise<{ checked: number; changed: any[] }> {
  const { data: rows } = await supabase
    .from('tickets')
    .select('id, lead_id, status, updated_at, metadata')
    .eq('company_id', companyId)
    .eq('metadata->>source', 'whatsapp_evolution')
    .order('updated_at', { ascending: false })
    .limit(1500);
  const team = await loadTeam(supabase, companyId);
  const latestByJid = new Map<string, any[]>();
  for (const t of rows || []) {
    const m = t.metadata || {};
    if (m.merged_into || m.is_group === true || String(m.whatsapp_jid || '').endsWith('@g.us')) continue;
    const jid = String(m.whatsapp_jid || '');
    if (!jid) continue;
    if (!latestByJid.has(jid)) latestByJid.set(jid, []);
    latestByJid.get(jid)!.push(t);
  }
  const changed: any[] = [];
  for (const [jid, list] of latestByJid.entries()) {
    const m0 = list[0].metadata || {};
    const phone = digits(m0.whatsapp_phone || jidPhone(jid));
    const lid = String(m0.whatsapp_lid || jidLid(jid) || '');
    if (!phone && !lid) continue;
    const info = await resolveScope(supabase, companyId, team, phone, lid);
    for (const t of list) {
      const m = t.metadata || {};
      const sameScope = m.wa_scope === info.scope && m.wa_scope_reason === info.reason;
      const needsLead = !t.lead_id && info.leadId && ['lead', 'spam', 'por_clasificar'].includes(info.scope);
      if (sameScope && !needsLead) continue;
      const patch: Record<string, any> = {
        metadata: {
          ...cleanMeta(m),
          wa_scope: info.scope,
          wa_scope_reason: info.reason,
          is_existing_client: info.scope === 'soporte',
          member_of_groups: info.memberOfGroups,
          support_channel: info.scope === 'soporte' ? (m.support_channel && m.support_channel !== 'ventas' ? m.support_channel : 'soporte') : 'ventas',
          ...(info.clientId ? { client_id: info.clientId } : {}),
        },
      };
      if (needsLead) patch.lead_id = info.leadId;
      await supabase.from('tickets').update(patch).eq('id', t.id);
      if (t === list[0]) changed.push({ jid, from: m.wa_scope || null, to: info.scope, reason: info.reason });
    }
  }
  return { checked: latestByJid.size, changed };
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
    .select('id, full_name, email, role, custom_role_id, company_id, is_active, is_platform_owner, permissions')
    .eq('id', uid)
    .maybeSingle();
  if (!prof || prof.is_active === false) return null;
  const role = String(prof.role || '');
  const p = (prof.permissions && typeof prof.permissions === 'object' ? prof.permissions : {}) as Record<string, any>;
  const explicitMode = String(p.wa_access_mode || '');
  let scopes: string[] = [];
  if (prof.is_platform_owner === true || role === 'super_admin' || role === 'company_admin' || explicitMode === 'admin_all') {
    scopes = ['all'];
  } else if (explicitMode === 'soporte_team' || explicitMode === 'soporte_assigned') {
    scopes = ['soporte'];
  } else if (explicitMode === 'ventas_pool' || explicitMode === 'ventas_assigned') {
    scopes = ['leads'];
  } else if (explicitMode === 'both') {
    scopes = ['soporte', 'leads'];
  } else if (explicitMode === 'none') {
    scopes = [];
  } else {
    let keys: string[] = [];
    if (prof.custom_role_id) {
      const { data: rp } = await supabase
        .from('role_permissions')
        .select('permission_key')
        .eq('role_id', prof.custom_role_id)
        .eq('is_enabled', true)
        .in('permission_key', ['wa_chat_all', 'wa_chat_soporte', 'wa_chat_leads']);
      keys = (rp || []).map((r: any) => r.permission_key);
    }
    if (keys.includes('wa_chat_all') || p.wa_chat_all === true) {
      scopes = ['all'];
    } else {
      if (keys.includes('wa_chat_soporte') || p.wa_chat_soporte === true) scopes.push('soporte');
      if (keys.includes('wa_chat_leads') || p.wa_chat_leads === true || p.leads === true || p.leads_view === true) {
        scopes.push('leads');
      }
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
    if (action === 'import_history') return await handleImportHistory(supabase, url, payload);
    if (action === 'report_evo_heal') return await handleReportEvoHeal(supabase, url, payload);
    if (action === 'catchup_messages') return await handleCatchupMessages(supabase, url, payload);
    if (action === 'watchdog_check') return await handleWatchdogCheck(supabase, url, payload);

    // ── Actions from the CRM UI (require a logged-in user) ──
    const uiActions = [
      'get_ai_config', 'test_openai', 'save_ai_config', 'save_ai_prompt', 'set_ticket_channel',
      'promote_to_lead', 'classify_contact', 'send_reply', 'send_media', 'send_reactivation',
      'retry_media', 'bridge_status', 'rescope_now', 'request_history_import', 'request_evo_heal',
      'get_wa_team_access', 'set_wa_user_access',
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
        case 'get_wa_team_access':
          if (!caller.isAdmin) return json({ ok: false, error: 'Solo un administrador puede ver accesos del equipo' }, 403);
          return await handleGetWaTeamAccess(supabase, caller, payload);
        case 'set_wa_user_access':
          if (!caller.isAdmin) return json({ ok: false, error: 'Solo un administrador puede cambiar accesos del equipo' }, 403);
          return await handleSetWaUserAccess(supabase, caller, payload);
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
        case 'send_reactivation':
          return await handleSendReactivation(supabase, caller, payload);
        case 'retry_media':
          return await handleRetryMedia(supabase, caller, payload);
        case 'bridge_status':
          return await handleBridgeStatus(supabase);
        case 'rescope_now': {
          if (!caller.isAdmin) return json({ ok: false, error: 'Solo un administrador' }, 403);
          const cid = await resolveMainCompanyId(supabase, url.searchParams.get('company_id'));
          if (!cid) return json({ ok: false, error: 'No company' }, 400);
          return json({ ok: true, ...(await rescopeChats(supabase, cid)) });
        }
        case 'request_history_import': {
          if (!caller.isAdmin) return json({ ok: false, error: 'Solo un administrador' }, 403);
          await setBridgeState(supabase, 'history_import', { status: 'requested', requested_at: new Date().toISOString() });
          return json({ ok: true });
        }
        case 'request_evo_heal': {
          if (!caller.isAdmin) return json({ ok: false, error: 'Solo un administrador' }, 403);
          await setBridgeState(supabase, 'evo_heal', {
            status: 'requested',
            mode: String(payload?.mode || 'restart_and_catchup'),
            since: payload?.since || null,
            requested_at: new Date().toISOString(),
          });
          return json({ ok: true });
        }
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

  const companyId = await resolveMainCompanyId(supabase, url.searchParams.get('company_id'));
  if (!companyId) return json({ ok: false, error: 'No company_id resolved' }, 400);

  // Remember Evolution credentials/instance server-side (never in tickets).
  if (incomingKey || instanceName) {
    const st = await getBridgeState(supabase, 'evolution');
    if ((incomingKey && st.apikey !== incomingKey) || st.instance !== instanceName) {
      await setBridgeState(supabase, 'evolution', { ...st, ...(incomingKey ? { apikey: incomingKey } : {}), instance: instanceName });
    }
  }

  const rawData = payload?.data || payload;
  const entries: any[] = Array.isArray(rawData)
    ? rawData
    : Array.isArray(rawData?.messages)
    ? rawData.messages
    : [rawData];

  const sorted = entries.length > 1
    ? [...entries].sort((a, b) => messageDate(a).getTime() - messageDate(b).getTime())
    : entries;

  const team = await loadTeam(supabase, companyId);
  let lastResult: Record<string, any> = { ok: true, ignored: true, reason: 'empty payload' };
  for (const entry of sorted) {
    lastResult = await ingestWhatsAppEntry(supabase, companyId, instanceName, entry, rawData, payload, {
      isCatchup: false,
      teamCache: team,
    });
  }
  await setBridgeState(supabase, 'last_webhook_in', { at: new Date().toISOString() });
  return json(lastResult);
}

async function ingestWhatsAppEntry(
  supabase: any,
  companyId: string,
  instanceName: string,
  entry: any,
  rawData: any,
  payload: any,
  opts?: { isCatchup?: boolean; teamCache?: any }
): Promise<Record<string, any>> {
  const isCatchup = Boolean(opts?.isCatchup);
  const key = entry?.key || payload?.key || {};
  const remoteJidRaw: string = key?.remoteJid || entry?.remoteJid || payload?.remoteJid || '';
  if (!remoteJidRaw || remoteJidRaw === 'status@broadcast' || remoteJidRaw.endsWith('@newsletter')) {
    return { ok: true, ignored: true, reason: 'broadcast/status ignored' };
  }

  const fromMe = Boolean(key?.fromMe ?? entry?.fromMe ?? false);
  const waMessageId: string = String(key?.id || entry?.id || '').trim();
  const isGroup = remoteJidRaw.endsWith('@g.us');
  const pushName: string = String(entry?.pushName || payload?.pushName || '').trim();
  const msgDate = messageDate(entry);

  const rawMsgObj = entry?.message || payload?.message || {};
  const msgObj = unwrapMessage(rawMsgObj);
  if (msgObj?.protocolMessage || msgObj?.reactionMessage || msgObj?.pollUpdateMessage) {
    return { ok: true, ignored: true, reason: 'protocol/reaction message' };
  }
  const media = extractMedia(msgObj);
  const text = extractText(msgObj, rawMsgObj, entry);
  const displayText = text || (media ? mediaPlaceholder(media.kind, media.obj) : '');
  if (!displayText) return { ok: true, ignored: true, reason: 'No text or media content' };

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

  // Dedupe (Evolution may deliver the same message twice).
  if (waMessageId) {
    const { data: dup } = await supabase
      .from('whatsapp_messages')
      .select('id')
      .eq('company_id', companyId)
      .eq('wa_message_id', waMessageId)
      .maybeSingle();
    if (dup) return { ok: true, ignored: true, reason: 'duplicate message' };
  }

  const team = opts?.teamCache || (await loadTeam(supabase, companyId));

  // Who is speaking?
  // In 1-on-1 chats, only fromMe (sent by +503 7971-8911) is the outgoing side; messages sent from
  // the contact's phone (even when the contact is a team member testing) are incoming.
  const senderL8 = last8(senderPhone);
  const staffByName = isGroup ? matchStaffByName(team, pushName) : null;
  const staffByPhone = isGroup && senderL8 ? team.internoPhones.get(senderL8) : undefined;
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
    const since = new Date(msgDate.getTime() - 30 * 60 * 1000).toISOString();
    const until = new Date(msgDate.getTime() + 30 * 60 * 1000).toISOString();
    const { data: recentOut } = await supabase
      .from('whatsapp_outbox')
      .select('id, ticket_id, comment_id, kind, payload, wa_message_id, status')
      .in('ticket_id', tickets.map((t) => t.id))
      .gte('created_at', since)
      .lte('created_at', until)
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
      return { ok: true, ignored: true, reason: 'echo of CRM-sent message' };
    }
  }

  const recentlyClosed = !activeTicket
    ? tickets.find((t) => {
        if (!['resolved', 'closed'].includes(t.status) || t.metadata?.merged_into) return false;
        const closedAt = new Date(t.resolved_at || t.updated_at || t.created_at).getTime();
        return Math.abs(msgDate.getTime() - closedAt) <= 4 * 60 * 60 * 1000;
      })
    : null;

  // Staff talking with no open conversation: attach to the latest one, never open a "self-ticket".
  let targetTicket: any = activeTicket;
  if (!targetTicket && isStaff) {
    targetTicket = tickets.find((t) => !t.metadata?.merged_into) || null;
    if (!targetTicket && (scope === 'soporte' || isGroup)) {
      return { ok: true, ignored: true, reason: 'Staff message with no conversation — no self-ticket' };
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
    if (String(claimErr.code) === '23505') return { ok: true, ignored: true, reason: 'duplicate message (race)' };
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
  const prevLastIso = String(currentMeta.last_whatsapp_at || '');
  const isNewerOrEqual = !prevLastIso || msgDate.toISOString() >= prevLastIso;
  const isResolutionReply =
    isNewerOrEqual &&
    staffStrong &&
    scope === 'soporte' &&
    /listo|resuelto|solucionado|arreglado|ya quedo|ya quedó|corregido|actualizado/i.test(displayText);
  const shouldUpgradeTitle =
    scope === 'soporte' &&
    !isStaff &&
    classification.isActualSupportProblem &&
    isGenericProblemTitle(targetTicket.title) &&
    displayText.length >= 15;

  let lastPreview = displayText.slice(0, 200);
  let description = String(targetTicket.description || '');
  if (!description.includes('💬 Historial de WhatsApp:')) {
    description = `${description}\n\n💬 Historial de WhatsApp:\n${line}`;
  } else if (isNewerOrEqual) {
    description = `${description}\n${line}`;
  } else {
    // Insert before the last chat line so SupportChatCircles preview keeps the newest message at the end.
    const lastNl = description.lastIndexOf('\n');
    description = lastNl > 0 ? `${description.slice(0, lastNl)}\n${line}${description.slice(lastNl)}` : `${description}\n${line}`;
  }

  // Optional AI text auto-reply (OFF by default). Never for catchup, staff, team, spam or audio.
  let aiReplied = false;
  if (!isCatchup && !isStaff && !media && ['soporte', 'lead', 'por_clasificar'].includes(scope) && !isGreetingOrClosingAgreement(displayText) && currentMeta.ai_auto_reply_text_enabled !== false) {
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
    updated_at: isNewerOrEqual ? (isCatchup ? msgDate.toISOString() : new Date().toISOString()) : targetTicket.updated_at || new Date().toISOString(),
    metadata: {
      ...currentMeta,
      ...baseMetaPatch,
      support_channel: scope === 'soporte' ? (classification.supportChannel !== 'soporte' && classification.supportChannel !== 'ventas' && !isStaff ? classification.supportChannel : currentMeta.support_channel === 'ventas' ? 'soporte' : currentMeta.support_channel || 'soporte') : 'ventas',
      whatsapp_message_count: Number(currentMeta.whatsapp_message_count || 0) + 1 + (aiReplied ? 1 : 0),
      last_whatsapp_message: isNewerOrEqual ? lastPreview : currentMeta.last_whatsapp_message,
      last_whatsapp_at: isNewerOrEqual ? msgDate.toISOString() : prevLastIso,
      last_message_from: isNewerOrEqual ? (aiReplied || isStaff ? 'staff' : 'client') : currentMeta.last_message_from,
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

  return {
    ok: true,
    action: createdNew ? 'ticket_created' : isResolutionReply ? 'ticket_resolved' : 'message_appended',
    ticket_id: targetTicket.id,
    wa_scope: scope,
    scope_reason: scopeInfo.reason,
    media: media?.kind || null,
  };
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
    .select('id, company_id, ticket_id, comment_id, message_type, from_me, message_ts')
    .eq('id', waMsgId)
    .maybeSingle();
  // Historical media (imported from the chat history) never triggers an automatic reply.
  const isRecentMsg = !row?.message_ts || Date.now() - new Date(row.message_ts).getTime() < 15 * 60 * 1000;
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
      if (t && isRecentMsg && aiCfg.autoReplyAudio && meta.ai_auto_reply_enabled !== false && ['soporte', 'lead', 'por_clasificar'].includes(scope)) {
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
        `(curl -s "${evo}/group/findGroupInfos/${inst}?groupJid=${encodeURIComponent(m.whatsapp_jid).replace(/[^a-zA-Z0-9%._-]/g, '')}" -H "apikey: ${safeKey}" | curl -s -X POST "${syncUrl}" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1) &`
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

  // 2. Media downloads (images, documents, audio, video). Run in background (&) so they never block outbox polling.
  const staleBefore = new Date(now.getTime() - MEDIA_RETRY_AFTER_MS).toISOString();
  const { data: mediaJobs } = await supabase
    .from('whatsapp_messages')
    .select('id, raw_message, media_attempts, media_status, media_requested_at')
    .in('media_status', ['pending', 'requested'])
    .lt('media_attempts', MEDIA_MAX_ATTEMPTS)
    .gte('created_at', new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: true })
    .limit(6);
  let mediaQueued = 0;
  for (const job of mediaJobs || []) {
    if (mediaQueued >= 3) break;
    if (job.media_status === 'requested' && job.media_requested_at && job.media_requested_at > staleBefore) continue;
    if (!job.raw_message) continue;
    const inst = shellSafe(instance);
    const upUrl = `${selfUrl}?action=upload_media&wamsg=${shellSafe(job.id)}`;
    const b64 = b64Utf8(JSON.stringify({ message: job.raw_message, convertToMp4: false }));
    lines.push(
      `(echo "${b64}" | base64 -d | curl -s -X POST "${evo}/chat/getBase64FromMediaMessage/${inst}" -H "Content-Type: application/json" -H "apikey: ${safeKey}" -d @- | curl -s -X POST "${upUrl}" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1) &`
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
      `(curl -s "${evo}/group/fetchAllGroups/${inst}?getParticipants=true" -H "apikey: ${safeKey}" | curl -s -X POST "${selfUrl}?action=sync_all_groups" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1) &`
    );
    await setBridgeState(supabase, 'groups_sync', { ...gs, requested_at: now.toISOString(), force: false });
  }

  // 4. Periodic re-check of chat classifications (every 10 min) so chats follow CRM changes.
  const rs = await getBridgeState(supabase, 'rescope');
  if (!rs.at || now.getTime() - new Date(rs.at).getTime() > 10 * 60 * 1000) {
    await setBridgeState(supabase, 'rescope', { at: now.toISOString() });
    const cid = await resolveMainCompanyId(supabase, null);
    if (cid) {
      rescopeChats(supabase, cid)
        .then((r) => setBridgeState(supabase, 'rescope', { at: now.toISOString(), checked: r.checked, changed: r.changed.slice(0, 50) }))
        .catch((e) => console.error('[wa] rescope error', e));
    }
  }

  // 5. One-time import of photos / documents / audio / video from the chat history
  //    (messages received before media was tracked). Runs automatically once, a few chats per poll.
  let hi = await getBridgeState(supabase, 'history_import');
  const histCid = !hi.status || hi.status === 'requested' ? await resolveMainCompanyId(supabase, null) : null;
  if (histCid) {
    const cid = histCid;
    const since = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000).toISOString();
    const { data: chats } = await supabase
      .from('tickets')
      .select('metadata, updated_at')
      .eq('company_id', cid)
      .eq('metadata->>source', 'whatsapp_evolution')
      .gte('updated_at', since)
      .order('updated_at', { ascending: false })
      .limit(2000);
    const queue: { q: string; t: string }[] = [];
    const seen = new Set<string>();
    for (const c of chats || []) {
      const m = c.metadata || {};
      const tj = String(m.whatsapp_jid || '');
      if (!tj || m.merged_into) continue;
      const evoJids = [tj];
      if (m.whatsapp_lid && !tj.endsWith('@g.us')) evoJids.push(`${digits(m.whatsapp_lid)}@lid`);
      for (const q of evoJids) {
        if (seen.has(q)) continue;
        seen.add(q);
        queue.push({ q, t: tj });
      }
    }
    hi = { status: 'running', token: crypto.randomUUID().replace(/-/g, ''), queue, next: 0, started_at: now.toISOString() };
    await setBridgeState(supabase, 'history_import', hi);
  }
  if (hi.status === 'running' && Array.isArray(hi.queue)) {
    const inst = shellSafe(instance);
    const batch = 3;
    const start = Number(hi.next || 0);
    for (let i = start; i < Math.min(start + batch, hi.queue.length); i++) {
      for (let page = 1; page <= 3; page++) {
        const body = b64Utf8(JSON.stringify({ where: { key: { remoteJid: hi.queue[i].q } }, page, offset: 50 }));
        const impUrl = `${selfUrl}?action=import_history&i=${i}&token=${shellSafe(hi.token)}`;
        lines.push(
          `(echo "${body}" | base64 -d | curl -s -X POST "${evo}/chat/findMessages/${inst}" -H "Content-Type: application/json" -H "apikey: ${safeKey}" -d @- | curl -s -X POST "${impUrl}" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1) &`
        );
      }
    }
    const next = start + batch;
    await setBridgeState(supabase, 'history_import', {
      ...hi,
      next,
      ...(next >= hi.queue.length ? { status: 'done', finished_at: now.toISOString() } : {}),
    });
  }

  // 6. On-demand or auto-triggered Evolution instance heal (connection check + restart + catchup).
  const heal = await getBridgeState(supabase, 'evo_heal');
  if (heal.status === 'requested') {
    const inst = shellSafe(instance);
    const healToken = crypto.randomUUID().replace(/-/g, '');
    const mode = String(heal.mode || 'restart_and_catchup');
    await setBridgeState(supabase, 'evo_heal', {
      ...heal,
      status: 'dispatched',
      token: healToken,
      dispatched_at: now.toISOString(),
    });
    const healUrl = `${selfUrl}?action=report_evo_heal&token=${shellSafe(healToken)}`;
    if (mode === 'check_only') {
      lines.push(
        `(B1=$(curl -s "${evo}/instance/connectionState/${inst}" -H "apikey: ${safeKey}" | base64 | tr -d '\\n'); B2=$(curl -s "${evo}/webhook/find/${inst}" -H "apikey: ${safeKey}" | base64 | tr -d '\\n'); printf '{"state_before":"%s","webhook":"%s","restart":"","state_after":"%s"}' "$B1" "$B2" "$B1" | curl -s -X POST "${healUrl}" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1) &`
      );
    } else if (mode === 'restore_webhook') {
      const whBody = b64Utf8(
        JSON.stringify({
          webhook: {
            enabled: true,
            url: selfUrl,
            webhookByEvents: false,
            webhookBase64: true,
            events: ['MESSAGES_UPSERT'],
          },
        })
      );
      lines.push(
        `(B1=$(curl -s "${evo}/instance/connectionState/${inst}" -H "apikey: ${safeKey}" | base64 | tr -d '\\n'); echo "${whBody}" | base64 -d | curl -s -X POST "${evo}/webhook/set/${inst}" -H "Content-Type: application/json" -H "apikey: ${safeKey}" -d @- >/dev/null 2>&1; B2=$(curl -s "${evo}/webhook/find/${inst}" -H "apikey: ${safeKey}" | base64 | tr -d '\\n'); B3=$(curl -s "${evo}/instance/connect/${inst}" -H "apikey: ${safeKey}" | base64 | tr -d '\\n'); sleep 8; B4=$(curl -s "${evo}/instance/connectionState/${inst}" -H "apikey: ${safeKey}" | base64 | tr -d '\\n'); printf '{"state_before":"%s","webhook":"%s","restart":"%s","state_after":"%s"}' "$B1" "$B2" "$B3" "$B4" | curl -s -X POST "${healUrl}" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1) &`
      );
    } else if (mode === 'sync_baileys_recv') {
      const { data: signedFix } = await supabase.storage
        .from(MEDIA_BUCKET)
        .createSignedUrl('system/baileys-7.0.0-rc.9-messages-recv.js', 600);
      const fixUrlB64 = b64Utf8(String(signedFix?.signedUrl || ''));
      lines.push(
        `(B1=$(curl -s "${evo}/instance/connectionState/${inst}" -H "apikey: ${safeKey}" | base64 | tr -d '\\n'); DCMD="docker"; if ! docker ps >/dev/null 2>&1 && sudo -n docker ps >/dev/null 2>&1; then DCMD="sudo -n docker"; fi; CID=$($DCMD ps --format '{{.ID}} {{.Ports}}' 2>/dev/null | grep '8085' | head -n 1 | awk '{print $1}'); FURL=$(echo "${fixUrlB64}" | base64 -d); RES="missing_cid"; if [ -n "$CID" ] && [ -n "$FURL" ]; then curl -fsSL "$FURL" -o /tmp/baileys_mr.js && grep -q "CB:status" /tmp/baileys_mr.js && grep -q "sourceMappingURL=messages-recv.js.map" /tmp/baileys_mr.js && $DCMD cp "$CID:/evolution/node_modules/baileys/lib/Socket/messages-recv.js" /tmp/baileys_mr.bak && $DCMD cp /tmp/baileys_mr.js "$CID:/evolution/node_modules/baileys/lib/Socket/messages-recv.js" && RES=$($DCMD restart "$CID" 2>&1); fi; sleep 18; LOGS=$($DCMD logs --tail 25 "$CID" 2>&1); B3=$(printf 'sync=%s\\nlogs=%s' "$RES" "$LOGS" | base64 | tr -d '\\n'); B2=$(curl -s "${evo}/webhook/find/${inst}" -H "apikey: ${safeKey}" | base64 | tr -d '\\n'); B4=$(curl -s "${evo}/instance/connectionState/${inst}" -H "apikey: ${safeKey}" | base64 | tr -d '\\n'); printf '{"state_before":"%s","webhook":"%s","restart":"%s","state_after":"%s"}' "$B1" "$B2" "$B3" "$B4" | curl -s -X POST "${healUrl}" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1) &`
      );
    } else {
      lines.push(
        `(B0=$(curl -s "${evo}/instance/fetchInstances" -H "apikey: ${safeKey}" | base64 | tr -d '\\n'); B1=$(curl -s "${evo}/instance/connectionState/${inst}" -H "apikey: ${safeKey}" | base64 | tr -d '\\n'); B2=$(curl -s "${evo}/webhook/find/${inst}" -H "apikey: ${safeKey}" | base64 | tr -d '\\n'); R1=$(curl -s "${evo}/instance/connect/${inst}" -H "apikey: ${safeKey}"); B3=$(printf '%s' "$R1" | base64 | tr -d '\\n'); sleep 8; B4=$(curl -s "${evo}/instance/connectionState/${inst}" -H "apikey: ${safeKey}" | base64 | tr -d '\\n'); printf '{"evo_info":"%s","state_before":"%s","webhook":"%s","restart":"%s","state_after":"%s"}' "$B0" "$B1" "$B2" "$B3" "$B4" | curl -s -X POST "${healUrl}" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1) &`
      );
    }
  }

  // 7. Sequential multi-page catchup of missed text + media messages (chronological order).
  const mc = await getBridgeState(supabase, 'message_catchup');
  if (mc.status === 'running' && Number(mc.page) >= 1) {
    const notBeforeOk = !mc.not_before || now.getTime() >= new Date(mc.not_before).getTime();
    const inflightExpired = !mc.inflight_at || now.getTime() - new Date(mc.inflight_at).getTime() > 40 * 1000;
    if (notBeforeOk && inflightExpired) {
      const inst = shellSafe(instance);
      const pageNum = Number(mc.page);
      const offsetNum = Number(mc.offset || 80);
      const sinceSec = mc.since ? Math.floor(new Date(mc.since).getTime() / 1000) : Math.floor((now.getTime() - 14 * 3600 * 1000) / 1000);
      const whereClause = mc.no_ts_filter ? {} : { messageTimestamp: { gte: sinceSec } };
      const body = b64Utf8(JSON.stringify({ where: whereClause, page: pageNum, offset: offsetNum }));
      const catchupUrl = `${selfUrl}?action=catchup_messages&page=${pageNum}&token=${shellSafe(mc.token)}`;
      lines.push(
        `(echo "${body}" | base64 -d | curl -s -X POST "${evo}/chat/findMessages/${inst}" -H "Content-Type: application/json" -H "apikey: ${safeKey}" -d @- | curl -s -X POST "${catchupUrl}" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1) &`
      );
      await setBridgeState(supabase, 'message_catchup', { ...mc, inflight_at: now.toISOString() });
    }
  }

  // 8. Permanent 2-minute watchdog: checks connectionState + latest messages, auto-recovers
  //    dropped webhooks and auto-restarts the Evolution instance if its webhook emitter freezes.
  const wd = await getBridgeState(supabase, 'evo_watchdog');
  const lastWdReq = wd.requested_at ? new Date(wd.requested_at).getTime() : 0;
  if (
    heal.status !== 'requested' &&
    heal.status !== 'dispatched' &&
    mc.status !== 'running' &&
    now.getTime() - lastWdReq > 2 * 60 * 1000
  ) {
    const inst = shellSafe(instance);
    const wdToken = crypto.randomUUID().replace(/-/g, '');
    const sinceSec = Math.floor((now.getTime() - 6 * 3600 * 1000) / 1000);
    const wdQuery = wd.no_ts_filter && Number(wd.last_total_pages) > 0
      ? { where: {}, page: Number(wd.last_total_pages), offset: 40 }
      : { where: { messageTimestamp: { gte: sinceSec } }, page: 1, offset: 40 };
    const wdBody = b64Utf8(JSON.stringify(wdQuery));
    const wdUrl = `${selfUrl}?action=watchdog_check&token=${shellSafe(wdToken)}`;
    lines.push(
      `(S1=$(curl -s "${evo}/instance/connectionState/${inst}" -H "apikey: ${safeKey}" | base64 | tr -d '\\n'); M1=$(echo "${wdBody}" | base64 -d | curl -s -X POST "${evo}/chat/findMessages/${inst}" -H "Content-Type: application/json" -H "apikey: ${safeKey}" -d @- | base64 | tr -d '\\n'); printf '{"state":"%s","messages":"%s"}' "$S1" "$M1" | curl -s -X POST "${wdUrl}" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1) &`
    );
    await setBridgeState(supabase, 'evo_watchdog', { ...wd, token: wdToken, requested_at: now.toISOString() });
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
  // Group membership changed => re-check every 1-on-1 chat (a group member is never a lead).
  let rescoped: any = null;
  try {
    rescoped = await rescopeChats(supabase, companyId);
    await setBridgeState(supabase, 'rescope', { at: new Date().toISOString(), checked: rescoped.checked, changed: rescoped.changed.slice(0, 50) });
  } catch (e) {
    console.error('[wa] rescope after group sync error', e);
  }
  return json({ ok: true, groups: n, rescoped: rescoped?.changed?.length || 0 });
}

// Import media (photos, documents, audio, video) from a chat's history in Evolution.
// Only media messages are imported: text history already exists as chat lines.
// Each media message is linked to its existing placeholder line ("[Imagen enviada…]")
// when found; otherwise a new chat line is added at the original time.
async function handleImportHistory(supabase: any, url: URL, payload: any): Promise<Response> {
  const hi = await getBridgeState(supabase, 'history_import');
  const token = shellSafe(url.searchParams.get('token') || '');
  if (!hi.token || token !== hi.token) return json({ ok: false, error: 'invalid token' }, 401);
  const idx = Number(url.searchParams.get('i'));
  const item = Array.isArray(hi.queue) ? hi.queue[idx] : null;
  if (!item) return json({ ok: false, error: 'unknown chat' }, 400);
  const records: any[] = payload?.messages?.records || payload?.records || (Array.isArray(payload) ? payload : []);
  if (records.length === 0) return json({ ok: true, imported: 0 });

  const companyId = await resolveMainCompanyId(supabase, url.searchParams.get('company_id'));
  if (!companyId) return json({ ok: false, error: 'No company' }, 400);
  const ticketJid: string = item.t;
  const isGroup = ticketJid.endsWith('@g.us');

  const { data: tks } = await supabase
    .from('tickets')
    .select('id, created_at, metadata')
    .eq('company_id', companyId)
    .eq('metadata->>source', 'whatsapp_evolution')
    .eq('metadata->>whatsapp_jid', ticketJid)
    .order('created_at', { ascending: true });
  const tickets = (tks || []).filter((t: any) => !t.metadata?.merged_into);
  if (tickets.length === 0) return json({ ok: true, imported: 0, reason: 'no conversation' });
  const ticketIds = tickets.map((t: any) => t.id);
  const team = await loadTeam(supabase, companyId);

  let imported = 0;
  for (const rec of records) {
    const key = rec?.key || {};
    const waId = String(key.id || rec?.id || '').trim();
    if (!waId) continue;
    const msgObj = unwrapMessage(rec?.message || {});
    const media = extractMedia(msgObj);
    if (!media) continue;

    const { data: exists } = await supabase
      .from('whatsapp_messages')
      .select('id')
      .eq('company_id', companyId)
      .eq('wa_message_id', waId)
      .maybeSingle();
    if (exists) continue;

    const ts = messageDate(rec);
    const fromMe = Boolean(key.fromMe);
    const pushName = String(rec?.pushName || '').trim();
    const caption = extractText(msgObj, rec?.message || {}, {});
    const placeholder = mediaPlaceholder(media.kind, media.obj);

    // Conversation (ticket) that was open at that time.
    const target = [...tickets].reverse().find((t: any) => new Date(t.created_at).getTime() <= ts.getTime() + 60 * 1000) || tickets[0];

    // Existing placeholder line within ±3 minutes, not yet linked to a file.
    const fromIso = new Date(ts.getTime() - 3 * 60 * 1000).toISOString();
    const toIso = new Date(ts.getTime() + 3 * 60 * 1000).toISOString();
    const { data: near } = await supabase
      .from('ticket_comments')
      .select('id, ticket_id, body, created_at')
      .in('ticket_id', ticketIds)
      .gte('created_at', fromIso)
      .lte('created_at', toIso);
    const candidates = (near || []).filter((c: any) =>
      /\[(Imagen|Video|Sticker|Nota de voz|Audio|Documento|Archivo)|AUDIO_URL|📎|📷|🎤|🎥/i.test(String(c.body || ''))
    );
    let commentId: string | null = null;
    let commentTicket: string = target.id;
    if (candidates.length > 0) {
      const ids = candidates.map((c: any) => c.id);
      const { data: linked } = await supabase.from('whatsapp_messages').select('comment_id').in('comment_id', ids);
      const linkedSet = new Set((linked || []).map((l: any) => l.comment_id));
      const free = candidates
        .filter((c: any) => !linkedSet.has(c.id))
        .sort((a: any, b: any) => Math.abs(new Date(a.created_at).getTime() - ts.getTime()) - Math.abs(new Date(b.created_at).getTime() - ts.getTime()));
      if (free[0]) {
        commentId = free[0].id;
        commentTicket = free[0].ticket_id;
      }
    }

    if (!commentId) {
      const staff = fromMe || !isGroup ? null : matchStaffByName(team, pushName);
      const senderLabel = fromMe || staff ? `👨‍💻 ${staff?.full_name || 'Equipo Soporte'}` : `👤 ${pushName || 'Cliente'}`;
      const text = caption ? `${placeholder} ${caption}` : placeholder;
      const { data: c } = await supabase
        .from('ticket_comments')
        .insert({
          ticket_id: target.id,
          company_id: companyId,
          author_id: null,
          body: `[${fmtTime(ts)}] ${senderLabel}: ${text}`,
          is_internal: false,
          created_at: ts.toISOString(),
        })
        .select('id')
        .single();
      commentId = c?.id || null;
      commentTicket = target.id;
    }
    if (!commentId) continue;

    const senderJid = isGroup ? String(key.participantAlt || key.participant || '') : String(key.remoteJidAlt || key.remoteJid || '');
    const { error: insErr } = await supabase.from('whatsapp_messages').insert({
      company_id: companyId,
      ticket_id: commentTicket,
      comment_id: commentId,
      wa_message_id: waId,
      remote_jid: ticketJid,
      from_me: fromMe,
      sender_phone: jidPhone(senderJid) || null,
      sender_name: pushName || null,
      message_ts: ts.toISOString(),
      message_type: media.kind,
      body: caption || placeholder,
      media_status: 'pending',
      media_mime: media.obj?.mimetype || null,
      media_filename: media.obj?.fileName || null,
      media_size: Number(media.obj?.fileLength?.low ?? media.obj?.fileLength) || null,
      raw_message: { key, message: { [media.field]: slimMediaObject(media.obj) } },
    });
    if (!insErr) imported++;
  }
  return json({ ok: true, imported });
}

function fromB64Json(b64: unknown): any {
  const s = String(b64 || '').replace(/\s/g, '');
  if (!s) return null;
  try {
    const txt = new TextDecoder().decode(decodeBase64(s));
    try {
      return JSON.parse(txt);
    } catch {
      return txt;
    }
  } catch {
    return null;
  }
}

async function handleReportEvoHeal(supabase: any, url: URL, payload: any): Promise<Response> {
  const heal = await getBridgeState(supabase, 'evo_heal');
  const token = shellSafe(url.searchParams.get('token') || '');
  if (!heal.token || token !== heal.token) return json({ ok: false, error: 'invalid token' }, 401);

  const evoInfo = fromB64Json(payload?.evo_info);
  const stateBefore = fromB64Json(payload?.state_before);
  const webhookCfg = fromB64Json(payload?.webhook);
  const restartRes = fromB64Json(payload?.restart);
  const stateAfter = fromB64Json(payload?.state_after);
  const nowIso = new Date().toISOString();

  const connAfter = String(stateAfter?.instance?.state || stateAfter?.state || 'unknown');
  const whEnabled = webhookCfg?.enabled ?? webhookCfg?.webhook?.enabled;

  await setBridgeState(supabase, 'evo_heal', {
    ...heal,
    status: 'done',
    completed_at: nowIso,
    evo_info: evoInfo || heal.evo_info || null,
    connection_before: stateBefore?.instance?.state || stateBefore?.state || stateBefore,
    connection_after: connAfter,
    state_before: stateBefore,
    webhook: webhookCfg,
    restart: restartRes,
    state_after: stateAfter,
  });

  // If webhook was disabled on Evolution API, automatically re-enable it once.
  if (whEnabled === false && !heal.restore_attempted) {
    await setBridgeState(supabase, 'evo_heal', {
      status: 'requested',
      mode: 'restore_webhook',
      restore_attempted: true,
      since: heal.since || null,
      requested_at: nowIso,
    });
    return json({ ok: true, action: 'scheduled_restore_webhook' });
  }

  // Start catchup at page 1 with messageTimestamp.gte; handleCatchupMessages auto-adapts to pagination order.
  if (String(heal.mode || 'restart_and_catchup') !== 'check_only') {
    const catchupSince = heal.since || new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString();
    await setBridgeState(supabase, 'message_catchup', {
      status: 'running',
      token: crypto.randomUUID().replace(/-/g, ''),
      page: 1,
      end_page: 1,
      step: 1,
      no_ts_filter: false,
      jumped: false,
      offset: 80,
      since: catchupSince,
      not_before: new Date(Date.now() + 4000).toISOString(),
      inflight_at: null,
      pages_done: 0,
      imported_total: 0,
      started_at: nowIso,
    });
  }

  return json({ ok: true, connection_after: connAfter });
}

async function handleCatchupMessages(supabase: any, url: URL, payload: any): Promise<Response> {
  const mc = await getBridgeState(supabase, 'message_catchup');
  const token = shellSafe(url.searchParams.get('token') || '');
  if (!mc.token || token !== mc.token) return json({ ok: false, error: 'invalid token' }, 401);
  const page = Number(url.searchParams.get('page') || 0);
  if (mc.status !== 'running' || page !== Number(mc.page)) {
    return json({ ok: true, skipped: true });
  }

  const companyId = await resolveMainCompanyId(supabase, url.searchParams.get('company_id'));
  if (!companyId) return json({ ok: false, error: 'No company' }, 400);
  const { instance } = await evolutionCredentials(supabase);
  const sinceMs = mc.since ? new Date(mc.since).getTime() : Date.now() - 14 * 60 * 60 * 1000;

  const totalPages = Number(payload?.messages?.pages || payload?.pages || 1);
  const totalRecords = Number(payload?.messages?.total || payload?.total || 0);
  const records: any[] = payload?.messages?.records || payload?.records || (Array.isArray(payload) ? payload : []);

  const firstTs = records.length > 0 ? messageDate(records[0]).toISOString() : null;
  const lastTs = records.length > 0 ? messageDate(records[records.length - 1]).toISOString() : null;

  // Auto-adapt on first probe if Evolution ignored where.messageTimestamp.gte or returned newest-first across >1 pages.
  if (!mc.jumped && page === 1) {
    // Case A: Evolution returned an error on messageTimestamp.gte (records empty & error present) -> retry without ts filter on tail pages.
    if (records.length === 0 && (payload?.error || payload?.status >= 400) && !mc.no_ts_filter) {
      await setBridgeState(supabase, 'message_catchup', {
        ...mc,
        no_ts_filter: true,
        jumped: false,
        page: 1,
        inflight_at: null,
        probe_error: payload?.message || payload?.error,
      });
      return json({ ok: true, action: 'fallback_no_ts_filter' });
    }
    // Case B: Oldest-first pagination across whole history (page 1 has ancient records < sinceMs and totalPages > 1).
    if (records.length > 0 && totalPages > 1 && messageDate(records[records.length - 1]).getTime() < sinceMs && messageDate(records[0]).getTime() < sinceMs) {
      const startTail = Math.max(1, totalPages - 4);
      await setBridgeState(supabase, 'message_catchup', {
        ...mc,
        jumped: true,
        page: startTail,
        end_page: totalPages,
        step: 1,
        inflight_at: null,
        total_pages: totalPages,
        total_records: totalRecords,
      });
      return json({ ok: true, action: 'jump_to_tail', start_page: startTail, end_page: totalPages });
    }
    // Case C: Filtered query succeeded and has multiple pages.
    if (totalPages > 1 && records.length > 1) {
      const isDescending = messageDate(records[0]).getTime() > messageDate(records[records.length - 1]).getTime();
      if (isDescending) {
        const startDesc = Math.min(totalPages, 6);
        await setBridgeState(supabase, 'message_catchup', {
          ...mc,
          jumped: true,
          page: startDesc,
          end_page: 1,
          step: -1,
          inflight_at: null,
          total_pages: totalPages,
          total_records: totalRecords,
        });
        return json({ ok: true, action: 'jump_to_oldest_filtered_page', start_page: startDesc });
      } else {
        await setBridgeState(supabase, 'message_catchup', {
          ...mc,
          jumped: true,
          page: 1,
          end_page: Math.min(totalPages, 8),
          step: 1,
          inflight_at: null,
          total_pages: totalPages,
          total_records: totalRecords,
        });
        // Fall through to process page 1 right now since page 1 IS the oldest filtered page!
        mc.jumped = true;
        mc.end_page = Math.min(totalPages, 8);
        mc.step = 1;
      }
    } else {
      mc.jumped = true;
      mc.end_page = 1;
      mc.step = 1;
    }
  }

  const candidates = records
    .filter((rec) => {
      const key = rec?.key || {};
      const jid = String(key.remoteJid || rec?.remoteJid || '');
      if (!jid || jid === 'status@broadcast' || jid.endsWith('@newsletter')) return false;
      return messageDate(rec).getTime() >= sinceMs;
    })
    .sort((a, b) => messageDate(a).getTime() - messageDate(b).getTime());

  let imported = 0;
  const samples: string[] = [];
  if (candidates.length > 0) {
    const waIds = candidates
      .map((r) => String(r?.key?.id || r?.id || '').trim())
      .filter(Boolean);
    const existingSet = new Set<string>();
    if (waIds.length > 0) {
      const { data: ex } = await supabase
        .from('whatsapp_messages')
        .select('wa_message_id')
        .eq('company_id', companyId)
        .in('wa_message_id', waIds);
      for (const row of ex || []) {
        if (row.wa_message_id) existingSet.add(String(row.wa_message_id));
      }
    }

    const missing = candidates.filter((r) => {
      const id = String(r?.key?.id || r?.id || '').trim();
      return !id || !existingSet.has(id);
    });

    if (missing.length > 0) {
      const team = await loadTeam(supabase, companyId);
      for (const rec of missing) {
        try {
          const res = await ingestWhatsAppEntry(supabase, companyId, instance, rec, payload, payload, {
            isCatchup: true,
            teamCache: team,
          });
          if (res?.ok && !res?.ignored) {
            imported++;
            if (samples.length < 15) {
              samples.push(`${rec?.key?.remoteJid || ''}@${messageDate(rec).toISOString()}`);
            }
          }
        } catch (err) {
          console.error('[wa] catchup ingest error:', err);
        }
      }
    }
  }

  const stepDir = Number(mc.step || 1);
  const endPage = Number(mc.end_page || 1);
  const nextPage = page + stepDir;
  const isDone = stepDir > 0 ? nextPage > endPage : nextPage < endPage;
  const prevSamples: string[] = Array.isArray(mc.samples) ? mc.samples : [];

  await setBridgeState(supabase, 'message_catchup', {
    ...mc,
    page: isDone ? 0 : nextPage,
    inflight_at: null,
    pages_done: Number(mc.pages_done || 0) + 1,
    imported_total: Number(mc.imported_total || 0) + imported,
    samples: [...prevSamples, ...samples].slice(-30),
    total_pages: totalPages,
    total_records: totalRecords,
    last_page_records: records.length,
    last_page_candidates: candidates.length,
    sample_first_ts: firstTs,
    sample_last_ts: lastTs,
    ...(isDone ? { status: 'done', finished_at: new Date().toISOString() } : {}),
  });

  return json({ ok: true, page, imported, next_page: isDone ? 0 : nextPage });
}

async function handleWatchdogCheck(supabase: any, url: URL, payload: any): Promise<Response> {
  const wd = await getBridgeState(supabase, 'evo_watchdog');
  const token = shellSafe(url.searchParams.get('token') || '');
  if (!wd.token || token !== wd.token) return json({ ok: false, error: 'invalid token' }, 401);

  const stateObj = fromB64Json(payload?.state);
  const msgPayload = fromB64Json(payload?.messages);
  const connState = String(stateObj?.instance?.state || stateObj?.state || 'unknown');
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const companyId = await resolveMainCompanyId(supabase, null);
  const { instance } = await evolutionCredentials(supabase);
  const totalPages = Number(msgPayload?.messages?.pages || msgPayload?.pages || 0);
  const records: any[] = msgPayload?.messages?.records || msgPayload?.records || (Array.isArray(msgPayload) ? msgPayload : []);
  const noTsFilter =
    Boolean(wd.no_ts_filter) ||
    (records.length === 0 && Boolean(msgPayload?.error || msgPayload?.status >= 400)) ||
    (records.length > 0 && totalPages > 5 && messageDate(records[records.length - 1]).getTime() < now - 7 * 24 * 3600 * 1000);

  let recovered = 0;
  const newestEvoTs = records.length > 0
    ? new Date(Math.max(...records.map((r) => messageDate(r).getTime()))).toISOString()
    : null;

  if (companyId && records.length > 0) {
    const windowStart = now - 12 * 60 * 60 * 1000;
    const windowEnd = now - 12 * 1000; // give live webhooks 12s before considering a message missed
    const candidates = records
      .filter((rec) => {
        const key = rec?.key || {};
        const jid = String(key.remoteJid || rec?.remoteJid || '');
        if (!jid || jid === 'status@broadcast' || jid.endsWith('@newsletter')) return false;
        const ts = messageDate(rec).getTime();
        return ts >= windowStart && ts <= windowEnd;
      })
      .sort((a, b) => messageDate(a).getTime() - messageDate(b).getTime());

    if (candidates.length > 0) {
      const waIds = candidates.map((r) => String(r?.key?.id || r?.id || '').trim()).filter(Boolean);
      const existingSet = new Set<string>();
      if (waIds.length > 0) {
        const { data: ex } = await supabase
          .from('whatsapp_messages')
          .select('wa_message_id')
          .eq('company_id', companyId)
          .in('wa_message_id', waIds);
        for (const row of ex || []) {
          if (row.wa_message_id) existingSet.add(String(row.wa_message_id));
        }
      }
      const missing = candidates.filter((r) => {
        const id = String(r?.key?.id || r?.id || '').trim();
        return !id || !existingSet.has(id);
      });
      if (missing.length > 0) {
        const team = await loadTeam(supabase, companyId);
        for (const rec of missing) {
          try {
            const res = await ingestWhatsAppEntry(supabase, companyId, instance, rec, msgPayload, msgPayload, {
              isCatchup: true,
              teamCache: team,
            });
            if (res?.ok && !res?.ignored) recovered++;
          } catch (err) {
            console.error('[wa] watchdog ingest error:', err);
          }
        }
      }
    }
  }

  const lastAutoHealMs = wd.last_auto_heal_at ? new Date(wd.last_auto_heal_at).getTime() : 0;
  const canAutoHeal = now - lastAutoHealMs > 15 * 60 * 1000;
  let autoHealTriggered = false;
  if (canAutoHeal && (recovered >= 3 || connState === 'connecting')) {
    await setBridgeState(supabase, 'evo_heal', {
      status: 'requested',
      mode: 'restart_and_catchup',
      reason: recovered >= 3 ? `watchdog_recovered_${recovered}` : 'watchdog_connecting_stuck',
      requested_at: nowIso,
    });
    autoHealTriggered = true;
  }

  await setBridgeState(supabase, 'evo_watchdog', {
    ...wd,
    checked_at: nowIso,
    connection_state: connState,
    no_ts_filter: noTsFilter,
    last_total_pages: totalPages || wd.last_total_pages || 0,
    newest_evo_ts: newestEvoTs,
    recovered_last_run: recovered,
    recovered_total: Number(wd.recovered_total || 0) + recovered,
    ...(autoHealTriggered ? { last_auto_heal_at: nowIso } : {}),
  });

  return json({ ok: true, connection_state: connState, recovered, auto_heal: autoHealTriggered });
}

async function handleBridgeStatus(supabase: any): Promise<Response> {
  const [poll, ack, gs, wd, heal, mc, lastWh, { count: pendingMedia }, { count: failedMedia }, { count: pendingOut }, { count: errorOut }] =
    await Promise.all([
      getBridgeState(supabase, 'bridge_last_poll'),
      getBridgeState(supabase, 'bridge_last_ack'),
      getBridgeState(supabase, 'groups_sync'),
      getBridgeState(supabase, 'evo_watchdog'),
      getBridgeState(supabase, 'evo_heal'),
      getBridgeState(supabase, 'message_catchup'),
      getBridgeState(supabase, 'last_webhook_in'),
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
    last_webhook_in: lastWh.at || null,
    evo_connection_state: wd.connection_state || heal.connection_after || null,
    evo_watchdog_checked_at: wd.checked_at || null,
    evo_watchdog_recovered_total: wd.recovered_total || 0,
    catchup_status: mc.status || null,
    catchup_imported_total: mc.imported_total || 0,
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

async function handleGetWaTeamAccess(supabase: any, caller: Caller, payload: any): Promise<Response> {
  const companyId = String(payload?.company_id || caller.companyId || '');
  if (!companyId) return json({ ok: false, error: 'Missing company_id' }, 400);

  const [{ data: profs }, { data: roles }, { data: rolePerms }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, role, custom_role_id, status, is_active, is_platform_owner, permissions')
      .eq('company_id', companyId)
      .order('full_name', { ascending: true }),
    supabase.from('custom_roles').select('id, name, base_role').eq('company_id', companyId),
    supabase
      .from('role_permissions')
      .select('role_id, permission_key, is_enabled')
      .eq('is_enabled', true)
      .in('permission_key', ['wa_chat_all', 'wa_chat_soporte', 'wa_chat_leads']),
  ]);

  const roleNameMap = new Map<string, string>();
  for (const r of roles || []) roleNameMap.set(r.id, r.name);

  const rolePermMap = new Map<string, Set<string>>();
  for (const rp of rolePerms || []) {
    if (!rolePermMap.has(rp.role_id)) rolePermMap.set(rp.role_id, new Set());
    rolePermMap.get(rp.role_id)!.add(rp.permission_key);
  }

  const members = (profs || [])
    .filter((p: any) => p.is_active !== false && p.status !== 'inactive')
    .map((p: any) => {
      const isSystemAdmin = p.is_platform_owner === true || p.role === 'super_admin' || p.role === 'company_admin';
      const perms = (p.permissions && typeof p.permissions === 'object' ? p.permissions : {}) as Record<string, any>;
      const explicitMode = String(perms.wa_access_mode || '');
      let mode = explicitMode;
      if (!mode) {
        if (isSystemAdmin) mode = 'admin_all';
        else {
          const rPerms = p.custom_role_id ? rolePermMap.get(p.custom_role_id) : undefined;
          const hasAll = Boolean(perms.wa_chat_all) || Boolean(rPerms?.has('wa_chat_all'));
          const hasSoporte = Boolean(perms.wa_chat_soporte) || Boolean(rPerms?.has('wa_chat_soporte'));
          const hasLeads = Boolean(perms.wa_chat_leads) || Boolean(rPerms?.has('wa_chat_leads'));
          if (hasAll) mode = 'admin_all';
          else if (hasSoporte && !hasLeads) mode = perms.wa_soporte_assigned_only ? 'soporte_assigned' : 'soporte_team';
          else if (hasLeads && !hasSoporte) mode = perms.wa_leads_assigned_only ? 'ventas_assigned' : 'ventas_pool';
          else if (hasSoporte && hasLeads) mode = 'admin_all';
          else mode = 'none';
        }
      }
      return {
        id: p.id,
        full_name: p.full_name || p.email || 'Usuario',
        email: p.email || '',
        role: p.role || 'sales_agent',
        role_label: p.custom_role_id ? roleNameMap.get(p.custom_role_id) || p.role : p.role,
        is_system_admin: isSystemAdmin,
        access_mode: mode,
      };
    });

  return json({ ok: true, members });
}

async function handleSetWaUserAccess(supabase: any, caller: Caller, payload: any): Promise<Response> {
  const targetUserId = String(payload?.target_user_id || '');
  const mode = String(payload?.access_mode || '');
  const validModes = ['admin_all', 'soporte_team', 'soporte_assigned', 'ventas_pool', 'ventas_assigned', 'none'];
  if (!targetUserId || !validModes.includes(mode)) {
    return json({ ok: false, error: 'Datos de acceso inválidos' }, 400);
  }

  const { data: targetProf } = await supabase
    .from('profiles')
    .select('id, company_id, custom_role_id, permissions')
    .eq('id', targetUserId)
    .maybeSingle();
  if (!targetProf) return json({ ok: false, error: 'Usuario no encontrado' }, 404);

  const curPerms = (targetProf.permissions && typeof targetProf.permissions === 'object' ? targetProf.permissions : {}) as Record<string, any>;
  const nextPerms: Record<string, any> = {
    ...curPerms,
    wa_access_mode: mode,
    wa_chat_all: mode === 'admin_all',
    wa_chat_soporte: mode === 'admin_all' || mode === 'soporte_team' || mode === 'soporte_assigned',
    wa_chat_leads: mode === 'admin_all' || mode === 'ventas_pool' || mode === 'ventas_assigned',
    wa_soporte_assigned_only: mode === 'soporte_assigned',
    wa_leads_assigned_only: mode === 'ventas_assigned',
  };

  const { error } = await supabase.from('profiles').update({ permissions: nextPerms }).eq('id', targetUserId);
  if (error) return json({ ok: false, error: error.message }, 500);

  return json({ ok: true, target_user_id: targetUserId, access_mode: mode });
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
  let ownsLead = meta.wa_scope === 'lead' && t.assigned_to === caller.userId;
  if (!ownsLead && meta.wa_scope === 'lead' && t.lead_id) {
    const { data: ld } = await supabase.from('leads').select('assigned_to').eq('id', t.lead_id).maybeSingle();
    ownsLead = ld?.assigned_to === caller.userId;
  }
  if (!caller.isAdmin && meta.wa_scope !== 'por_clasificar' && !ownsLead) {
    return json({ ok: false, error: 'Este número ya fue clasificado' }, 409);
  }
  // A member of a client support group is a client, never a lead.
  if (type === 'lead') {
    const groupsOfPhone = await groupsContaining(supabase, t.company_id, phone, digits(meta.whatsapp_lid || ''));
    if (groupsOfPhone.length > 0) {
      const names = groupsOfPhone.map((g) => g.subject || g.group_jid).slice(0, 3).join(', ');
      return json({ ok: false, error: `Este número pertenece a un grupo de soporte (${names}); es cliente, no lead.` }, 409);
    }
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
      const targetOwnerId = caller.isAdmin && payload?.assign_to ? String(payload.assign_to) : caller.userId;
      if (existing) {
        leadId = existing.id;
        leadName = existing.name;
        if (!existing.assigned_to || (caller.isAdmin && payload?.assign_to)) {
          // assigned_at is maintained by the trg_lead_assignment trigger.
          await supabase.from('leads').update({ assigned_to: targetOwnerId }).eq('id', existing.id);
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
            assigned_to: targetOwnerId,
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
    ticketUpdate.assigned_to = (caller.isAdmin && payload?.assign_to ? String(payload.assign_to) : null) || t.assigned_to || caller.userId;
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
  const mediaDesc = String(t.description || '').includes('💬 Historial de WhatsApp:')
    ? `${t.description}\n${line}`
    : `${t.description || ''}\n\n💬 Historial de WhatsApp:\n${line}`;
  await supabase
    .from('tickets')
    .update({
      description: mediaDesc,
      updated_at: new Date().toISOString(),
      ...(t.assigned_to || (meta.wa_scope || 'soporte') !== 'soporte' ? {} : { assigned_to: caller.userId }),
      metadata: {
        ...meta,
        whatsapp_message_count: Number(meta.whatsapp_message_count || 0) + 1,
        last_whatsapp_message: `${label}${caption ? ` ${caption}` : ''}`.slice(0, 200),
        last_whatsapp_at: new Date().toISOString(),
        last_message_from: 'staff',
      },
    })
    .eq('id', ticketId);
  return json({ ok: true, comment, outbox_id: outboxId });
}

async function handleSendReactivation(supabase: any, caller: Caller, payload: any): Promise<Response> {
  if (!caller.isAdmin && !caller.scopes.includes('leads')) {
    return json({ ok: false, error: 'Sin permiso para enviar reactivaciones de Leads' }, 403);
  }

  const companyId = String(payload?.company_id || caller.companyId || (await resolveMainCompanyId(supabase, null)) || '');
  if (!companyId) return json({ ok: false, error: 'Empresa no identificada' }, 400);
  if (!caller.isAdmin && caller.companyId && caller.companyId !== companyId) {
    return json({ ok: false, error: 'Acceso denegado a otra empresa' }, 403);
  }

  let normPhone = digits(payload?.phone || '');
  if (normPhone.length === 8 && /^[67]/.test(normPhone)) {
    normPhone = `503${normPhone}`;
  }
  if (!normPhone || normPhone.length < 8) {
    return json({ ok: false, error: 'Teléfono inválido' }, 400);
  }
  if ((normPhone.length === 8 && normPhone.startsWith('2')) || /^5032\d{7}$/.test(normPhone)) {
    return json({ ok: false, error: 'Teléfono fijo sin WhatsApp (2xxx-xxxx)' }, 400);
  }

  const messageText = String(payload?.message_text || '').trim();
  const uploadedMedia = payload?.uploaded_media && typeof payload.uploaded_media === 'object' ? payload.uploaded_media : null;
  if (!messageText && !uploadedMedia) {
    return json({ ok: false, error: 'Mensaje vacío' }, 400);
  }

  const l8 = last8(normPhone);
  const jid = `${normPhone}@s.whatsapp.net`;
  const now = new Date();
  const nowIso = now.toISOString();
  const campaignTag = String(payload?.campaign_tag || 'Reactivación WhatsApp').trim();
  const rawSellerName = String(payload?.seller_display_name || caller.fullName || 'Equipo Comercial').trim();
  const sellerName = /simulaci|platform\s*owner/i.test(rawSellerName) ? 'Jimmy Arias' : rawSellerName;

  // Verify real lead row in public.leads (prevents FK error when resending from an unlinked WhatsApp ticket).
  let realLead: { id: string; name: string | null; assigned_to: string | null; contact_count: number | null } | null = null;
  const candidateLeadId = String(payload?.lead_id || '').trim();
  if (candidateLeadId) {
    const { data: lRow } = await supabase
      .from('leads')
      .select('id, name, assigned_to, contact_count')
      .eq('id', candidateLeadId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (lRow) realLead = lRow;
  }
  if (!realLead && l8) {
    const { data: byPhone } = await supabase
      .from('leads')
      .select('id, name, assigned_to, contact_count')
      .eq('company_id', companyId)
      .ilike('phone', `%${l8}%`)
      .order('updated_at', { ascending: false })
      .limit(5);
    const match = (byPhone || []).find((r: any) => last8(r.phone || l8) === l8) || (byPhone || [])[0];
    if (match) realLead = match;
  }

  const leadDisplayName = String(payload?.lead_name || realLead?.name || `+${normPhone}`).trim();
  const leadOwner = realLead?.assigned_to || (payload?.lead_assigned_to ? String(payload.lead_assigned_to) : null) || caller.userId;

  // Non-admin sales agents may only reactivate leads assigned to them (or unassigned).
  if (!caller.isAdmin && realLead?.assigned_to && realLead.assigned_to !== caller.userId) {
    return json({ ok: false, error: 'Este prospecto está asignado a otro asesor' }, 403);
  }

  // Targeted open-ticket lookup (no .limit(200) truncation — matches uq_wa_open_ticket_per_chat 1-to-1).
  let existingTicket: any = null;
  const explicitTicketId = String(payload?.ticket_id || '').trim();
  if (explicitTicketId) {
    const { data: tById } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', explicitTicketId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (tById && ['new', 'open', 'pending'].includes(tById.status) && !tById.metadata?.merged_into && !tById.metadata?.is_group) {
      existingTicket = tById;
    }
  }
  if (!existingTicket) {
    const { data: byJid } = await supabase
      .from('tickets')
      .select('*')
      .eq('company_id', companyId)
      .eq('metadata->>source', 'whatsapp_evolution')
      .eq('metadata->>whatsapp_jid', jid)
      .in('status', ['new', 'open', 'pending'])
      .order('updated_at', { ascending: false })
      .limit(5);
    existingTicket = (byJid || []).find((t: any) => !t.metadata?.merged_into && !t.metadata?.is_group) || null;
  }
  if (!existingTicket && realLead?.id) {
    const { data: byLead } = await supabase
      .from('tickets')
      .select('*')
      .eq('company_id', companyId)
      .eq('metadata->>source', 'whatsapp_evolution')
      .eq('lead_id', realLead.id)
      .in('status', ['new', 'open', 'pending'])
      .order('updated_at', { ascending: false })
      .limit(5);
    existingTicket = (byLead || []).find((t: any) => !t.metadata?.merged_into && !t.metadata?.is_group) || null;
  }
  if (!existingTicket && l8) {
    const { data: byL8 } = await supabase
      .from('tickets')
      .select('*')
      .eq('company_id', companyId)
      .eq('metadata->>source', 'whatsapp_evolution')
      .ilike('metadata->>whatsapp_phone', `%${l8}`)
      .in('status', ['new', 'open', 'pending'])
      .order('updated_at', { ascending: false })
      .limit(5);
    existingTicket = (byL8 || []).find((t: any) => !t.metadata?.merged_into && !t.metadata?.is_group) || null;
  }

  let targetTicket: any = existingTicket;
  let nextTouchNumber = 1;

  if (targetTicket) {
    const curMeta = cleanMeta(targetTicket.metadata || {});
    const prevTouch = Number(curMeta.wa_reactivation_touch || (curMeta.wa_reactivation ? 1 : 0));
    nextTouchNumber = prevTouch + 1;
  } else {
    const { instance: defaultInst } = await evolutionCredentials(supabase);
    const insertPayload = {
      company_id: companyId,
      title: `[WhatsApp · Lead] ${leadDisplayName}`,
      description: `Reactivación comercial por WhatsApp (${campaignTag})`,
      status: 'open',
      priority: 'medium',
      lead_id: realLead?.id || null,
      lead_name: leadDisplayName,
      assigned_to: leadOwner,
      metadata: {
        source: 'whatsapp_evolution',
        wa_scope: 'lead',
        support_channel: 'ventas',
        ai_category: 'Ventas / Reactivación Lead',
        whatsapp_phone: normPhone,
        whatsapp_jid: jid,
        evolution_instance: defaultInst,
        wa_reactivation: true,
        wa_reactivation_touch: 1,
        wa_reactivation_campaign: campaignTag,
        wa_reactivation_sent_at: nowIso,
        wa_reactivation_by: caller.userId,
        wa_reactivation_by_name: sellerName,
        wa_attended_at: nowIso,
      },
    };
    const { data: created, error: createErr } = await supabase.from('tickets').insert(insertPayload).select('*').single();
    if (createErr) {
      if (String(createErr.code) === '23505') {
        const { data: winner } = await supabase
          .from('tickets')
          .select('*')
          .eq('company_id', companyId)
          .eq('metadata->>source', 'whatsapp_evolution')
          .eq('metadata->>whatsapp_jid', jid)
          .in('status', ['new', 'open', 'pending'])
          .maybeSingle();
        if (!winner) return json({ ok: false, error: createErr.message }, 500);
        targetTicket = winner;
        const curMeta = cleanMeta(winner.metadata || {});
        const prevTouch = Number(curMeta.wa_reactivation_touch || (curMeta.wa_reactivation ? 1 : 0));
        nextTouchNumber = prevTouch + 1;
      } else {
        return json({ ok: false, error: createErr.message || 'No se pudo crear el chat de WhatsApp' }, 500);
      }
    } else {
      targetTicket = created;
      nextTouchNumber = 1;
    }

    try {
      await supabase.from('whatsapp_contacts').upsert(
        {
          company_id: companyId,
          phone: normPhone,
          display_name: leadDisplayName,
          contact_type: 'lead',
          lead_id: realLead?.id || null,
          classified_by: caller.userId,
          classified_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: 'company_id,phone' }
      );
    } catch {
      // non-blocking
    }
  }

  const ticketId: string = targetTicket.id;
  const curMeta = cleanMeta(targetTicket.metadata || {});
  delete curMeta.wa_delivery_error;
  const instanceName = normalizeInstance(curMeta.evolution_instance);
  const targetNumber = String(curMeta.whatsapp_jid || jid);

  let outboxId: string | null = null;
  let commentRow: any = null;
  let previewText = messageText.slice(0, 200);
  let chatLine = '';

  if (uploadedMedia && uploadedMedia.path) {
    const mediaPath = String(uploadedMedia.path);
    if (!mediaPath.startsWith(`outgoing/${companyId}/`)) {
      return json({ ok: false, error: 'Ruta de archivo inválida' }, 400);
    }
    const fileName = String(uploadedMedia.name || 'archivo').slice(0, 120);
    const mime = String(uploadedMedia.mime || 'application/octet-stream');
    const size = Number(uploadedMedia.size) || null;
    const { data: signed, error: signErr } = await supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUrl(mediaPath, 60 * 60 * 24 * 7);
    if (signErr || !signed?.signedUrl) {
      return json({ ok: false, error: 'No se pudo firmar el archivo adjunto' }, 500);
    }
    const kind = mediaTypeForSend(mime);
    const label = kind === 'image' ? '[Imagen]' : kind === 'video' ? '[Video]' : kind === 'audio' ? '[Audio]' : `[Documento: ${fileName}]`;
    chatLine = `[${fmtTime(now)}] 👨‍💻 ${sellerName}: ${label}${messageText ? ` ${messageText}` : ''}`;
    previewText = `${label}${messageText ? ` ${messageText}` : ''}`.slice(0, 200);

    const { data: c } = await supabase
      .from('ticket_comments')
      .insert({ ticket_id: ticketId, company_id: companyId, author_id: caller.userId, body: chatLine, is_internal: false })
      .select('*')
      .single();
    commentRow = c;

    await supabase.from('whatsapp_messages').insert({
      company_id: companyId,
      ticket_id: ticketId,
      comment_id: c?.id || null,
      remote_jid: targetNumber,
      from_me: true,
      message_type: kind === 'document' ? 'document' : kind,
      body: messageText || label,
      media_status: 'ready',
      media_path: mediaPath,
      media_mime: mime,
      media_filename: fileName,
      media_size: size,
    });

    outboxId = await enqueueOutbox(supabase, {
      companyId,
      ticketId,
      commentId: c?.id || null,
      instance: instanceName,
      number: targetNumber,
      kind: 'media',
      payload: { url: signed.signedUrl, mimetype: mime, fileName, mediatype: kind, caption: messageText },
      createdBy: caller.userId,
    });
  } else {
    chatLine = `[${fmtTime(now)}] 👨‍💻 ${sellerName}: ${messageText}`;
    const { data: c } = await supabase
      .from('ticket_comments')
      .insert({ ticket_id: ticketId, company_id: companyId, author_id: caller.userId, body: chatLine, is_internal: false })
      .select('*')
      .single();
    commentRow = c;

    outboxId = await enqueueOutbox(supabase, {
      companyId,
      ticketId,
      commentId: c?.id || null,
      instance: instanceName,
      number: targetNumber,
      kind: 'text',
      payload: { text: messageText },
      createdBy: caller.userId,
    });
  }

  if (!outboxId) {
    return json({ ok: false, error: 'No se pudo encolar el envío en whatsapp_outbox' }, 500);
  }

  const prevDesc = String(targetTicket.description || '');
  const nextDesc = prevDesc.includes('💬 Historial de WhatsApp:')
    ? `${prevDesc}\n${chatLine}`
    : `${prevDesc}\n\n💬 Historial de WhatsApp:\n${chatLine}`;

  await supabase
    .from('tickets')
    .update({
      description: nextDesc,
      lead_id: targetTicket.lead_id || realLead?.id || null,
      lead_name: targetTicket.lead_name || leadDisplayName,
      assigned_to: targetTicket.assigned_to || leadOwner,
      updated_at: nowIso,
      metadata: {
        ...curMeta,
        source: 'whatsapp_evolution',
        wa_scope: curMeta.wa_scope === 'soporte' ? 'soporte' : 'lead',
        whatsapp_phone: curMeta.whatsapp_phone || normPhone,
        whatsapp_jid: curMeta.whatsapp_jid || jid,
        evolution_instance: instanceName,
        wa_reactivation: true,
        wa_reactivation_touch: nextTouchNumber,
        wa_reactivation_campaign: campaignTag,
        wa_reactivation_sent_at: nowIso,
        wa_reactivation_by: caller.userId,
        wa_reactivation_by_name: sellerName,
        wa_attended_at: nowIso,
        whatsapp_message_count: Number(curMeta.whatsapp_message_count || 0) + 1,
        last_whatsapp_message: previewText,
        last_whatsapp_at: nowIso,
        last_message_from: 'staff',
        last_staff_reply_at: nowIso,
        last_staff_reply_by: sellerName,
      },
    })
    .eq('id', ticketId);

  if (realLead?.id) {
    try {
      const prevCount = Number(realLead.contact_count ?? payload?.lead_contact_count ?? 0);
      await supabase
        .from('leads')
        .update({
          last_follow_up_at: nowIso,
          contact_count: prevCount + 1,
        })
        .eq('id', realLead.id);
    } catch {
      // non-blocking
    }
  }

  return json({
    ok: true,
    ticket_id: ticketId,
    outbox_id: outboxId,
    touch: nextTouchNumber,
    comment: commentRow,
  });
}
