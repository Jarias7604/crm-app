import type React from 'react';
import { Building2, HelpCircle, UserPlus, ShieldCheck, Ban } from 'lucide-react';
import type { Ticket } from '../../../services/tickets';
import type { WaScope } from '../../../lib/whatsappScopes';
import type {
  CachedTicketDescStats,
  QuickReplyTemplate,
  SupportChannelType,
} from './types';

// ─── Helpers (Cached Intl & String Formatters for 60fps UI) ─────────────────

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{2702}-\u{27B0}]/gu;
const stripEmojiCache = new Map<string, string>();

// Strip all emoji characters so UI uses 100% vector icons only
export function stripEmojis(text: string): string {
  if (!text) return '';
  const hit = stripEmojiCache.get(text);
  if (hit !== undefined) return hit;
  const out = text.replace(EMOJI_RE, '').replace(/[ \t]+/g, ' ').trim();
  if (stripEmojiCache.size > 4000) stripEmojiCache.clear();
  stripEmojiCache.set(text, out);
  return out;
}

export const TZ = 'America/El_Salvador';
const TIME_FORMATTER = new Intl.DateTimeFormat('es-SV', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const DAY_KEY_FORMATTER = new Intl.DateTimeFormat('en-CA', { timeZone: TZ });
const DAY_NO_YEAR_FORMATTER = new Intl.DateTimeFormat('es-SV', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: TZ,
});
const DAY_WITH_YEAR_FORMATTER = new Intl.DateTimeFormat('es-SV', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: TZ,
});

const fmtTimeCache = new Map<string, string>();
const dayKeyCache = new Map<string, string>();
const initialsCache = new Map<string, string>();
let cachedRelativeDayBounds = { ts: 0, today: '', yesterday: '', yearPrefix: '' };

function getRelativeDayBounds() {
  const now = Date.now();
  if (now - cachedRelativeDayBounds.ts < 15000 && cachedRelativeDayBounds.today) {
    return cachedRelativeDayBounds;
  }
  const today = DAY_KEY_FORMATTER.format(new Date(now));
  const yesterday = DAY_KEY_FORMATTER.format(new Date(now - 86400000));
  cachedRelativeDayBounds = { ts: now, today, yesterday, yearPrefix: today.slice(0, 4) };
  return cachedRelativeDayBounds;
}

export function fmtTime(iso: string): string {
  if (!iso) return '';
  const hit = fmtTimeCache.get(iso);
  if (hit !== undefined) return hit;
  const d = new Date(iso);
  const out = Number.isNaN(d.getTime()) ? '' : TIME_FORMATTER.format(d);
  if (fmtTimeCache.size > 4000) fmtTimeCache.clear();
  fmtTimeCache.set(iso, out);
  return out;
}

export function dayKey(iso: string): string {
  if (!iso) return '';
  const hit = dayKeyCache.get(iso);
  if (hit !== undefined) return hit;
  const d = new Date(iso);
  const out = Number.isNaN(d.getTime()) ? '' : DAY_KEY_FORMATTER.format(d);
  if (dayKeyCache.size > 4000) dayKeyCache.clear();
  dayKeyCache.set(iso, out);
  return out;
}

export function dayLabel(iso: string): string {
  const k = dayKey(iso);
  if (!k) return '';
  const { today, yesterday, yearPrefix } = getRelativeDayBounds();
  if (k === today) return 'Hoy';
  if (k === yesterday) return 'Ayer';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return k.slice(0, 4) === yearPrefix ? DAY_NO_YEAR_FORMATTER.format(d) : DAY_WITH_YEAR_FORMATTER.format(d);
}

export function listTimeLabel(iso: string): string {
  const k = dayKey(iso);
  if (!k) return '';
  const { today } = getRelativeDayBounds();
  return k === today ? fmtTime(iso) : dayLabel(iso);
}

export function initials(name: string): string {
  if (!name) return '?';
  const hit = initialsCache.get(name);
  if (hit !== undefined) return hit;
  const out =
    stripEmojis(name)
      .replace(/\(\+?[\d\s-]+\)/g, '')
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?';
  if (initialsCache.size > 3000) initialsCache.clear();
  initialsCache.set(name, out);
  return out;
}

export function formatBytes(n?: number | null): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const SUPPORT_CHANNEL_LABELS: Record<SupportChannelType, string> = {
  soporte: 'Soporte / Operaciones',
  contabilidad: 'Contabilidad / Finanzas',
  ventas: 'Ventas / Cotizaciones',
  otros: 'Otros / General',
};

export const DEFAULT_PROMPTS: Record<SupportChannelType, string> = {
  soporte:
    'Eres el Asistente IA de Soporte y Operaciones de nuestra empresa. Lee o escucha lo que el cliente reportó y respóndele de forma amable, clara y resolutiva en máximo 3 líneas por WhatsApp. Confírmale que entendiste su solicitud y pídele captura de pantalla, foto o detalle adicional si requiere revisión.',
  contabilidad:
    'Eres el Asistente IA del Área Contable, Facturación y Finanzas. Lee o escucha la consulta del cliente y respóndele de forma profesional, precisa y amable en máximo 3 líneas por WhatsApp. Si necesita revisión de algún estado de cuenta, factura o reporte, pídele el período o comprobante para validarlo.',
  ventas:
    'Eres el Asesor Comercial IA de nuestra empresa. El prospecto está consultando por precios, planes, catálogo o cotización. Respóndele con entusiasmo, cortesía y enfoque comercial en máximo 3 líneas por WhatsApp: infórmale que contamos con opciones adaptadas a su necesidad y pregúntale su giro o requerimiento principal para enviarle su cotización formal o agendar una demostración.',
  otros:
    'Eres el Asistente IA de Atención al Cliente. Lee o escucha el mensaje del cliente y respóndele de forma cortés, clara y servicial en máximo 3 líneas por WhatsApp, confirmando que recibimos su consulta y canalizándola con el especialista correspondiente.',
};

export const DEFAULT_RESOLVED_REPLY_TEMPLATE =
  '¡Muchas gracias por comentarnos, {nombre}! Qué gusto saber que ya cuentan con una solución. Quedamos a su entera disposición por si en el futuro desean evaluar nuevas opciones o apoyo adicional. ¡Muchos éxitos en sus operaciones!';

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

export function normalizeResolvedPhraseText(raw: string): string {
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
  if (/[?¿]/.test(raw)) return false;

  const norm = normalizeResolvedPhraseText(raw);
  if (!norm || norm.length < 6) return false;

  const blockRegex =
    /\b(cotiz\w*|precio\w*|costo\w*|cuanto\w*|plan|planes|demo\w*|informaci\w*|info|interesa\w*|comenzando|iniciando|adelante|despues|proxim\w*|llamar\w*|llamame|reuni\w*|agendar|visita\w*|error\w*|falla\w*|problema\w*|ayuda\w*|soporte|anydesk)\b/i;
  if (blockRegex.test(norm)) return false;

  const phrases = Array.isArray(customPhrases) && customPhrases.length > 0 ? customPhrases : DEFAULT_RESOLVED_TRIGGER_PHRASES;
  for (const p of phrases) {
    const np = normalizeResolvedPhraseText(p);
    if (np && np.length >= 5 && norm.includes(np)) {
      return true;
    }
  }
  return false;
}

export function isBusinessOrGenericName(raw?: string | null): boolean {
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

export function extractCleanLeadFirstName(rawName?: string | null): string {
  const clean = String(rawName || '')
    .replace(/\(\+?\d+\)/g, '')
    .trim();
  if (!clean || isBusinessOrGenericName(clean)) return '';
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
  const firstName = extractCleanLeadFirstName(rawName);
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

export const DEFAULT_SUPPORT_QUICK_REPLIES: QuickReplyTemplate[] = [
  {
    id: 'sup-rev',
    scope: 'soporte',
    label: 'En revisión',
    text: 'Hola, hemos recibido su mensaje. Nuestro especialista ya está revisando su caso y le daremos respuesta en breve.',
  },
  {
    id: 'sup-cap',
    scope: 'soporte',
    label: 'Pedir detalle / captura',
    text: 'Estimado cliente, para ayudarle lo más rápido posible, ¿nos podría compartir por favor el detalle por escrito acompañado de una captura de pantalla o foto?',
  },
  {
    id: 'sup-ok',
    scope: 'soporte',
    label: 'Confirmar solución',
    text: '¡Listo! Ya aplicamos la solución correspondiente a su solicitud. ¿Nos confirma por favor si ya todo le funciona correctamente?',
  },
  {
    id: 'sup-rem',
    scope: 'soporte',
    label: 'Asistencia remota / llamada',
    text: 'Para asistirle directamente, ¿nos confirma por favor en qué horario está disponible o nos comparte su acceso remoto?',
  },
];

export const DEFAULT_SALES_QUICK_REPLIES: QuickReplyTemplate[] = [
  {
    id: 'sal-welcome',
    scope: 'ventas',
    label: 'Saludo comercial',
    text: '¡Hola! Muchas gracias por escribirnos. Con gusto le asesoramos con información y precios. ¿Para qué tipo de negocio o necesidad busca la solución?',
  },
  {
    id: 'sal-quote-data',
    scope: 'ventas',
    label: 'Pedir datos para cotizar',
    text: 'Con mucho gusto le preparamos su cotización formal ahora mismo. ¿Me confirma por favor su nombre o empresa, correo electrónico y el requerimiento o volumen aproximado?',
  },
  {
    id: 'sal-demo',
    scope: 'ventas',
    label: 'Agendar demo / llamada',
    text: '¿Le gustaría que agendemos una breve llamada o demostración de 15 minutos hoy o mañana para mostrarle cómo funciona y resolver todas sus dudas?',
  },
  {
    id: 'sal-followup',
    scope: 'ventas',
    label: 'Seguimiento de propuesta',
    text: 'Hola, le escribo para saber si pudo revisar la cotización que le compartimos y si tiene alguna consulta o ajuste que desee que revisemos.',
  },
];

export const LEAD_STATUS_OPTIONS = [
  'Prospecto',
  'Llamada fría',
  'En Nutrición',
  'Lead calificado',
  'En seguimiento',
  'Negociación',
  'Cerrado',
  'Cliente',
  'Perdido',
  'Erróneo',
] as const;

// Web Audio API synthesizer — zero external audio files, works across all modern browsers.
let sharedAudioCtx: AudioContext | null = null;
export function getUnlockedAudioCtx(): AudioContext | null {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!sharedAudioCtx) sharedAudioCtx = new Ctx();
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

export function playWaAlertSound(kind: 'message' | 'urgent' | 'test' = 'message'): boolean {
  const ctx = getUnlockedAudioCtx();
  if (!ctx) return false;
  try {
    const now = ctx.currentTime;
    const notes =
      kind === 'urgent' || kind === 'test'
        ? [
            { freq: 659.25, start: 0, dur: 0.14, gain: 0.28 },
            { freq: 880.0, start: 0.15, dur: 0.14, gain: 0.3 },
            { freq: 1046.5, start: 0.3, dur: 0.2, gain: 0.32 },
            { freq: 880.0, start: 0.55, dur: 0.14, gain: 0.28 },
            { freq: 1174.66, start: 0.7, dur: 0.28, gain: 0.34 },
          ]
        : [
            { freq: 587.33, start: 0, dur: 0.15, gain: 0.24 },
            { freq: 880.0, start: 0.16, dur: 0.24, gain: 0.26 },
          ];
    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, now + n.start);
      g.gain.setValueAtTime(0.0001, now + n.start);
      g.gain.exponentialRampToValueAtTime(n.gain, now + n.start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + n.start);
      osc.stop(now + n.start + n.dur + 0.02);
    });
    return true;
  } catch {
    return false;
  }
}

export function formatWaitDuration(mins: number): string {
  if (mins <= 1) return '1m';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

// Internal developer/system task titles that are NOT clients (legacy non-WhatsApp tickets).
export function isInternalDevOrSystemTaskTitle(rawTitle: string): boolean {
  const clean = stripEmojis(rawTitle || '').toLowerCase();
  return /^(importaci[oó]n de proveedores|estandarizar dise[ñn]o|actualizar precios de mayoreo|importar precios por mayoreo|ajustes de estilos|estilos cotizacion|cotizaciones:\s*(personas|quitar)|cotizaciones\s+2\s*hours|revisi[oó]n de cambios normativa|apertura de gaveta de dinero|faq erp\b|nota de remisi[oó]n\b|factura de exportaci[oó]n\b|pos\s*1\b|jornada\s+(melvin|gerson)|comunicado oficial|libro de iva para mantenimientos)/i.test(
    clean
  );
}

// Safe first-name greeting helper for WhatsApp messages (quotes, diagnostics, booking links).
// Returns " Nombre" (with leading space) or "" if the name is a company, placeholder, or handle.
export function extractClientGreetingFirstName(rawName?: string | null): string {
  const clean = String(rawName || '')
    .replace(/\(\+?\d+\)/g, '')
    .trim();
  if (!clean || clean.startsWith('+') || /[_@]/.test(clean)) return '';
  if (/^(sin\s+nombre|contacto|cliente|prospecto|lead|soporte|admin|usuario|desconocido|\+?\d+)/i.test(clean)) {
    return '';
  }
  if (
    /\b(inversiones|lotificaci[oó]n|lotificadora|comedor|constructora|corporaci[oó]n|corp\b|grupo|residencial|tienda|ferreter[ií]a|cl[ií]nica|hotel|restaurante|autolote|auto\s+lote|taller|farmacia|supermercado|distribuidora|importadora|servicios|soluciones|agencia|asociaci[oó]n|fundaci[oó]n|iglesia|colegio|escuela|academia|laboratorio|panader[ií]a|pasteler[ií]a|est[eé]tica|sal[oó]n|barber[ií]a|gym|gimnasio|transporte|transportes|log[ií]stica|inmobiliaria|bienes\s+ra[ií]ces|desarrollos|urbanica|bosque|villas|finca|hacienda|agro|veterinaria|[oó]ptica|dental|odontolog[ií]a|abogados|bufete|contadores|despacho|consultor[ií]a|ingenier[ií]a|arquitectura|proyectos|multitienda|variedades|bazar|librer[ií]a|papeler[ií]a|imprenta|sublimaci[oó]n|publicidad|marketing|tecnolog[ií]a|sistemas|repuestos|lubricantes|llantas|motos|lavander[ií]a|florister[ií]a|eventos|banquetes|catering|seguridad|vigilancia|mantenimiento|refrigeraci[oó]n|el[eé]ctrica|plomer[ií]a|vidrier[ií]a|estructuras|carpinter[ií]a|muebler[ií]a|muebles|textiles|confecciones|bordados|serigraf[ií]a|pl[aá]sticos|empaques|reciclaje|gasolinera|cooperativa|financiera|seguros|corredora|aduana|aduanal|naviera|carga|courier|encomiendas|turismo|viajes|tours|alquiler|bodega|bodegas|almac[eé]n|mayorista|av[ií]cola|granero|granja|beneficio|caf[eé]|cafeter[ií]a|pizzer[ií]a|taquer[ií]a|pupuser[ií]a|asados|mariscos|cevicher[ií]a|spa\b|plaza\b|mercado|sucursal|boutique|s\.a\.|de\s+c\.v\.)\b/i.test(
      clean
    )
  ) {
    return '';
  }
  const withoutTitle = clean
    .replace(/^(lic(da|do)?|ing|arq|dr|dra|sr|sra|srta|don|doña|prof|abog|pastor|cnel|gral)\.?\s+/i, '')
    .trim();
  if (!withoutTitle) return '';
  const tokens = withoutTitle.split(/[\s,.-]+/).filter(Boolean);
  const first = tokens[0] || '';
  if (first.length < 2 || /\d/.test(first)) return '';
  if (tokens.length === 1 && first.length > 10) return '';
  return ` ${first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()}`;
}

// Client name for legacy (non-WhatsApp) support tickets.
export function extractLegacyClientName(t: Ticket): string {
  if (t.lead_name && t.lead_name.trim().length > 1) {
    return stripEmojis(t.lead_name.replace(/\(\+\d+\)/g, '').trim());
  }
  const colonMatch = (t.title || '').match(
    /^(?:soporte\s+t[eé]cnico|error(?:\s+en\s+json)?\s+reportado|capacitaci[oó]n(?:\s+presencial)?|pregunta\s+frecuente|go\s*live|solicitud(?:\s+de\s+cliente)?)\s*:\s*([^-\n(|]+)/i
  );
  if (colonMatch && colonMatch[1]) return stripEmojis(colonMatch[1].trim());
  return stripEmojis(t.title || 'Cliente Soporte');
}

export function detectShortCategory(catName: string, title: string): { code: string; name: string; color: string } {
  const text = `${catName} ${title}`.toLowerCase();
  if (text.startsWith('p1') || /urgente|cr[ií]tico|hacienda|dte|factura\s+electr/i.test(text)) {
    return { code: 'P1', name: catName || 'P1 - Prioridad Alta', color: '#EF4444' };
  }
  if (text.startsWith('p2') || /error\s+reportado/i.test(text)) {
    return { code: 'P2', name: catName || 'P2 - Incidencia', color: '#F97316' };
  }
  if (text.startsWith('p4')) return { code: 'P4', name: catName || 'P4 - Mejoras', color: '#3B82F6' };
  if (/pegunta|pregunta\s+frecuente/i.test(text)) return { code: 'FAQ', name: 'Preguntas Frecuentes', color: '#10B981' };
  return { code: 'P3', name: catName || 'P3 - Soporte General', color: '#F59E0B' };
}

export const SCOPE_STYLE: Record<WaScope, { avatar: string; chip: string; icon: React.ElementType }> = {
  soporte: { avatar: 'bg-slate-100 text-slate-700', chip: 'bg-slate-100 text-slate-600 border-slate-200/80', icon: Building2 },
  por_clasificar: { avatar: 'bg-amber-50 text-amber-700', chip: 'bg-amber-50 text-amber-800 border-amber-200/80', icon: HelpCircle },
  lead: { avatar: 'bg-indigo-50 text-indigo-700', chip: 'bg-slate-100 text-slate-600 border-slate-200/80', icon: UserPlus },
  interno: { avatar: 'bg-slate-100 text-slate-600', chip: 'bg-slate-100 text-slate-600 border-slate-200/80', icon: ShieldCheck },
  spam: { avatar: 'bg-rose-50 text-rose-600', chip: 'bg-rose-50 text-rose-700 border-rose-200/80', icon: Ban },
};

// Parse "[10:42 a. m.] 👤 Nombre: texto" chat lines written by the webhook.
export function parseChatLine(
  raw: string,
  staffFallback = 'Asesor Comercial',
): { icon: string; sender: string; text: string } | null {
  const cleanedRaw = String(raw || '')
    .replace(/👨‍💻\s*Simulaci[oó]n:\s*[a-zA-Z0-9_-]+:/gi, `👨‍💻 ${staffFallback}:`)
    .replace(/Simulaci[oó]n:\s*[a-zA-Z0-9_-]+/gi, staffFallback)
    .replace(/\bPlatform Owner\b/gi, staffFallback);
  const m = cleanedRaw.match(/^\[([^\]]+)\]\s*(👤|👨‍💻)?\s*([^:\n]+):\s*([\s\S]*)$/);
  if (!m) return null;
  return { icon: m[2] || '', sender: m[3].trim(), text: m[4] };
}

const ticketDescStatsCache = new Map<string, CachedTicketDescStats>();
export function getCachedTicketDescStats(
  ticket: Ticket,
  staffFallback = 'Asesor Comercial',
): CachedTicketDescStats {
  const desc = String(ticket.description || '');
  const rev = `${ticket.updated_at || ticket.created_at}|${desc.length}|${staffFallback}`;
  const cached = ticketDescStatsCache.get(ticket.id);
  if (cached && cached.rev === rev) return cached;

  let hasClientLine = false;
  let staffLineCount = 0;
  let lastChatLine = '';
  if (desc) {
    const lines = desc.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim();
      if (!l) continue;
      const hasClient = l.includes('👤');
      const hasStaff = l.includes('👨‍💻');
      if (hasClient) hasClientLine = true;
      if (hasStaff) staffLineCount++;
      if (l.startsWith('[') && (hasClient || hasStaff)) {
        lastChatLine = l;
      }
    }
  }
  const computed: CachedTicketDescStats = {
    rev,
    parsedLastLine: lastChatLine ? parseChatLine(lastChatLine, staffFallback) : null,
    hasClientLine,
    staffLineCount,
  };
  if (ticketDescStatsCache.size > 3500) ticketDescStatsCache.clear();
  ticketDescStatsCache.set(ticket.id, computed);
  return computed;
}
