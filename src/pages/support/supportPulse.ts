export type SupportRootCauseType =
  | 'system_bug'
  | 'temp_patch'
  | 'client_training'
  | 'external_mh';

export interface SupportRootCauseEntry {
  id: string;
  at: string;
  by: string | null;
  by_name: string;
  type: SupportRootCauseType;
  note?: string;
  msg_count_24h?: number;
  dev_resolved_at?: string | null;
  dev_resolved_by?: string | null;
}

export const SUPPORT_ROOT_CAUSE_META: Record<
  SupportRootCauseType,
  {
    label: string;
    shortLabel: string;
    hint: string;
    badgeClass: string;
    activeClass: string;
    escalatesToAdmin: boolean;
  }
> = {
  system_bug: {
    label: 'Bug de sistema (Escalar a Jimmy)',
    shortLabel: 'Bug sistema',
    hint: 'Error de código o del sistema que se repite y debe arreglarse de raíz',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    activeClass: 'bg-rose-600 text-white border-rose-600',
    escalatesToAdmin: true,
  },
  temp_patch: {
    label: 'Parche temporal / se repite',
    shortLabel: 'Parche',
    hint: 'Se resolvió momentáneamente al cliente, pero puede volver a pasar',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    activeClass: 'bg-amber-600 text-white border-amber-600',
    escalatesToAdmin: true,
  },
  client_training: {
    label: 'Duda / capacitación cliente',
    shortLabel: 'Duda cliente',
    hint: 'Consulta de uso, guía rápida o falta de capacitación del usuario',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    activeClass: 'bg-sky-600 text-white border-sky-600',
    escalatesToAdmin: false,
  },
  external_mh: {
    label: 'Hacienda / externo',
    shortLabel: 'Hacienda',
    hint: 'Incidencia externa del Ministerio de Hacienda, internet o proveedor tercero',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    activeClass: 'bg-purple-600 text-white border-purple-600',
    escalatesToAdmin: false,
  },
};

export interface SupportOperatingRule {
  id: string;
  title: string;
  trigger: string;
  action: string;
}

export const SUPPORT_OPERATING_RULES: SupportOperatingRule[] = [
  {
    id: 'rule-6-msgs',
    title: 'Regla 1 · Límite de 6 mensajes',
    trigger: 'Si un caso llega a 6 mensajes ida y vuelta sin resolverse por texto',
    action:
      'Se corta el chat: llamada / AnyDesk de 5 min con el cliente o se escala a Jimmy con captura y qué se probó.',
  },
  {
    id: 'rule-2nd-report',
    title: 'Regla 2 · 2º reporte = Causa Raíz',
    trigger: 'Si el mismo error aparece en 2 clientes distintos o 2 veces en 7 días',
    action:
      'Dejar de parcharlo a mano y marcarlo en el botón "Causa" como Bug de sistema para arreglarlo de raíz.',
  },
  {
    id: 'rule-5s-close',
    title: 'Regla 3 · Cierre en 5 segundos por incidente',
    trigger: 'Al resolver cada problema en un grupo o chat individual',
    action:
      'Presionar "Causa" (elegir Bug / Parche / Duda / Hacienda) + "Atendido" para separar incidentes y medir tiempos reales.',
  },
];

export const SUPPORT_OPERATING_RULES_COPY_TEXT =
  `📋 *Reglas Operativas de Soporte WhatsApp*\n\n` +
  `1️⃣ *Regla de los 6 mensajes:* Si en 6 mensajes ida y vuelta no quedó resuelto, cortar el texto → llamada / AnyDesk 5 min o escalar a Jimmy con captura.\n` +
  `2️⃣ *Regla del 2º reporte:* Si el mismo error sale en 2 clientes o se repite en la semana, no seguir parchando → marcar en el CRM como *🐛 Bug de sistema*.\n` +
  `3️⃣ *Cierre en 5 segundos:* Al terminar cada incidente en el chat, marcar *Causa* (Bug / Parche / Duda / Hacienda) + *Atendido*.`;

const TZ = 'America/El_Salvador';
const DAY_KEY_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: TZ });
const DAY_LABEL_FMT = new Intl.DateTimeFormat('es-SV', {
  day: '2-digit',
  month: 'short',
  timeZone: TZ,
});

function toDayKey(ms: number): string {
  return DAY_KEY_FMT.format(new Date(ms));
}

function toDayLabel(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  if (!y || !m || !d) return dayKey;
  return DAY_LABEL_FMT.format(new Date(Date.UTC(y, m - 1, d, 12, 0, 0))).replace('.', '');
}

const VALID_ROOT_CAUSE_TYPES = new Set<SupportRootCauseType>([
  'system_bug',
  'temp_patch',
  'client_training',
  'external_mh',
]);

function normalizeRootCauseEntry(raw: any): SupportRootCauseEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const type = String(raw.type || '').trim() as SupportRootCauseType;
  if (!VALID_ROOT_CAUSE_TYPES.has(type)) return null;
  const at = String(raw.at || '').trim();
  if (!at || !Number.isFinite(Date.parse(at))) return null;
  const id = String(raw.id || `${at}_${type}`).trim();
  return {
    id,
    at,
    by: raw.by ? String(raw.by) : null,
    by_name: String(raw.by_name || 'Equipo').trim() || 'Equipo',
    type,
    ...(raw.note ? { note: String(raw.note).trim() } : {}),
    ...(typeof raw.msg_count_24h === 'number' && Number.isFinite(raw.msg_count_24h)
      ? { msg_count_24h: raw.msg_count_24h }
      : {}),
    ...(raw.dev_resolved_at ? { dev_resolved_at: String(raw.dev_resolved_at) } : {}),
    ...(raw.dev_resolved_by ? { dev_resolved_by: String(raw.dev_resolved_by) } : {}),
  };
}

export function extractRootCauseEntries(
  metadata: Record<string, any> | null | undefined,
): SupportRootCauseEntry[] {
  if (!metadata || typeof metadata !== 'object') return [];
  const list: SupportRootCauseEntry[] = [];
  const seen = new Set<string>();

  const rawLog = Array.isArray(metadata.wa_root_cause_log) ? metadata.wa_root_cause_log : [];
  for (const item of rawLog) {
    const parsed = normalizeRootCauseEntry(item);
    if (!parsed || seen.has(parsed.id)) continue;
    seen.add(parsed.id);
    list.push(parsed);
  }

  const lastParsed = normalizeRootCauseEntry(metadata.wa_root_cause_last);
  if (lastParsed && !seen.has(lastParsed.id)) {
    seen.add(lastParsed.id);
    list.push(lastParsed);
  }

  return list.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export function appendRootCauseMetadataPatch(
  currentMeta: Record<string, any> | null | undefined,
  entry: SupportRootCauseEntry,
  maxEntries = 40,
): Record<string, any> {
  const baseMeta: Record<string, any> = { ...(currentMeta || {}) };
  const existing = extractRootCauseEntries(baseMeta).filter((item) => item.id !== entry.id);
  const nextLog = [entry, ...existing]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, Math.max(1, maxEntries));

  return {
    ...baseMeta,
    wa_root_cause_last: entry,
    wa_root_cause_log: nextLog,
  };
}

export function markRootCauseDevResolvedPatch(
  currentMeta: Record<string, any> | null | undefined,
  entryId: string,
  resolvedBy: string,
  resolvedAt: string,
): Record<string, any> {
  const baseMeta: Record<string, any> = { ...(currentMeta || {}) };
  const existing = extractRootCauseEntries(baseMeta);
  const updatedLog = existing.map((entry) =>
    entry.id === entryId
      ? {
          ...entry,
          dev_resolved_at: resolvedAt,
          dev_resolved_by: resolvedBy,
        }
      : entry,
  );

  const rawLast = normalizeRootCauseEntry(baseMeta.wa_root_cause_last);
  const nextLast =
    rawLast && rawLast.id === entryId
      ? {
          ...rawLast,
          dev_resolved_at: resolvedAt,
          dev_resolved_by: resolvedBy,
        }
      : baseMeta.wa_root_cause_last;

  return {
    ...baseMeta,
    ...(nextLast ? { wa_root_cause_last: nextLast } : {}),
    wa_root_cause_log: updatedLog,
  };
}

export function countChatMessagesLast24h(
  comments: Array<{ created_at: string; is_internal?: boolean }>,
  nowMs = Date.now(),
): number {
  const cutoff = nowMs - 24 * 60 * 60 * 1000;
  let count = 0;
  for (const c of comments || []) {
    if (c.is_internal) continue;
    const ms = Date.parse(String(c.created_at || ''));
    if (Number.isFinite(ms) && ms >= cutoff && ms <= nowMs + 60_000) {
      count += 1;
    }
  }
  return count;
}

export type SupportErrorModuleKey =
  | 'dte'
  | 'inventario'
  | 'reportes'
  | 'calculos'
  | 'acceso'
  | 'general';

export const SUPPORT_ERROR_MODULES: Record<
  SupportErrorModuleKey,
  { label: string; shortLabel: string; barColor: string; badgeClass: string }
> = {
  dte: {
    label: 'Facturación DTE / Hacienda',
    shortLabel: 'DTE / Hacienda',
    barColor: 'bg-rose-500',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  inventario: {
    label: 'Inventario / Stock',
    shortLabel: 'Inventario',
    barColor: 'bg-amber-500',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  reportes: {
    label: 'Reportes / PDF / Impresión',
    shortLabel: 'Reportes / PDF',
    barColor: 'bg-indigo-500',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  calculos: {
    label: 'Cálculos / IVA / Planilla',
    shortLabel: 'Cálculos / IVA',
    barColor: 'bg-violet-500',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200',
  },
  acceso: {
    label: 'Acceso / Permisos / Carga',
    shortLabel: 'Acceso / Carga',
    barColor: 'bg-sky-500',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  general: {
    label: 'Uso General / Otros',
    shortLabel: 'General',
    barColor: 'bg-slate-400',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
};

const KNOWN_CLIENT_ALIASES: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /arg[oó]z|argos/i, canonical: 'Corporación Argoz' },
  { pattern: /\bgo\s*party\b/i, canonical: 'Go Party' },
  { pattern: /cartopaq|cartopack/i, canonical: 'Cartopaq' },
  { pattern: /don\s+carret[oó]n/i, canonical: 'Don Carretón' },
  { pattern: /la\s+econ[oó]mica/i, canonical: 'La Económica' },
  { pattern: /medicina\s+popular/i, canonical: 'Medicina Popular' },
  { pattern: /conta\s*ohs/i, canonical: 'Conta OHS' },
  { pattern: /salinera\s+san\s+jorge/i, canonical: 'Salinera San Jorge' },
  { pattern: /moda\s+[ií]ntima/i, canonical: 'Moda Íntima' },
  { pattern: /udp\s+volea/i, canonical: 'UDP Volea' },
  { pattern: /lupitas?\s+accesorios/i, canonical: 'Lupitas Accesorios' },
  { pattern: /ferreter[ií]a\s+bersab[eé]/i, canonical: 'Ferretería Bersabe' },
  { pattern: /pablo\s+g[oó]mez/i, canonical: 'Pablo Gómez' },
  { pattern: /lumen\s*2000/i, canonical: 'Lumen 2000' },
  { pattern: /suministros\s+diesel/i, canonical: 'Suministros Diesel' },
  { pattern: /ak\s+constructora/i, canonical: 'AK Constructora' },
  { pattern: /inmalux/i, canonical: 'Inmalux' },
  { pattern: /rolando\s+velasco/i, canonical: 'Arias (Rolando Velasco)' },
  { pattern: /marisela\s+lino/i, canonical: 'Marisela Lino' },
  { pattern: /labelimend/i, canonical: 'Labelimend' },
  { pattern: /wilfredo\s+valiente/i, canonical: 'Wilfredo Valiente' },
  { pattern: /gaco\s+y\s+jeco/i, canonical: 'Gaco y Jeco' },
  { pattern: /transportes\s+rivera/i, canonical: 'Transportes Rivera' },
  { pattern: /corpo\s+auto/i, canonical: 'Corpo Auto' },
  { pattern: /texaco\s+el\s+triunfo|gasolinera\s+el\s+triunfo/i, canonical: 'Texaco El Triunfo' },
  { pattern: /multiservicios\s+integrales/i, canonical: 'Multiservicios Integrales' },
  { pattern: /inversiones\s+diversas\s+del\s+mar/i, canonical: 'Inversiones Diversas del Mar' },
  { pattern: /comercial\s+m[eé]ndez/i, canonical: 'Comercial Méndez' },
  { pattern: /prisma\s+hielo/i, canonical: 'Prisma Hielo' },
  { pattern: /panader[ií]a\s+santa\s+eduviges/i, canonical: 'Panadería Santa Eduviges' },
  { pattern: /erp\s*-\s*gasolineras/i, canonical: 'ERP - Gasolineras' },
  { pattern: /facturaci[oó]n\s+clientes\s+varios/i, canonical: 'Facturación Clientes Varios' },
];

export function normalizeSupportClientName(raw: string): string {
  let clean = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'Cliente WhatsApp';

  if (/^\[WhatsApp[^\]]*\]/i.test(clean)) {
    clean = clean.replace(/^\[WhatsApp[^\]]*\]\s*/i, '');
    const colonIdx = clean.indexOf(':');
    if (colonIdx > 1) clean = clean.slice(0, colonIdx);
  }

  clean = clean
    .replace(/^(?:arias\s+)?soporte\s+t[eé]cnico(?:\s+arias)?(?:\s*[-:|]\s*|\s+)/i, '')
    .replace(
      /^(?:error\s+reportado|capacitaci[oó]n(?:\s+presencial|\s+virtual)?|pregunta\s+frecuente|implementaci[oó]n|go\s*live|solicitud(?:\s+de\s+cliente)?|configuraci[oó]n|migraci[oó]n|revisi[oó]n|soporte)\s*[-:|]\s*/i,
      '',
    )
    .replace(/\(\+?\d[\d\s-]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return 'Cliente WhatsApp';

  for (const alias of KNOWN_CLIENT_ALIASES) {
    if (alias.pattern.test(clean)) return alias.canonical;
  }
  if (/^(gp|grupo\s+gp)$/i.test(clean)) return 'GP';

  return clean
    .split(' ')
    .map((w) => {
      if (w.length <= 2 && /^[A-Z0-9]+$/.test(w)) return w;
      return w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w;
    })
    .join(' ');
}

export function supportClientMergeKey(raw: string): string {
  return normalizeSupportClientName(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function detectSupportErrorModule(text: string): SupportErrorModuleKey | null {
  let clean = String(text || '')
    .replace(/^\[[^\]]+\]\s*(?:👤|👨‍💻)?\s*[^:\n]{1,40}:\s*/i, '')
    .replace(/\[(?:Imagen|Nota de voz|Video|Sticker|Documento)[^\]]*\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean || clean.length < 8) return null;

  const norm = clean
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (
    /^(?:buen(?:os|as)\s+(?:dias|tardes|noches)|hola+|ok+|okay|okey|si+|gracias+|muchas\s+gracias|mil\s+gracias|muchisimas\s+gracias|listo+|entendido|esta\s+bien|perfecto|saludos|excelente|va+|dale|de\s+acuerdo|con\s+gusto|para\s+servirle)[¡!.,\s👍🙏👌✅🙌😊🤝]*$/i.test(
      norm,
    )
  ) {
    return null;
  }

  if (
    /\b(dte|hacienda|mh|firmador|sello|invalidaci[oó]n|anula\w*|contingencia|ccf|factura\s+electronica|json|credito\s+fiscal|consumidor\s+final|sujeto\s+excluido|nit|nrc|correlativo|timbr\w*|transmit\w*)\b/i.test(
      norm,
    )
  ) {
    return 'dte';
  }
  if (
    /\b(inventario|stock|kardex|existencia\w*|bodega|traslado|lote|producto\w*|codigo\s+de\s+barra|serie|mercaderia|descarg\w*\s+(?:de\s+|del\s+)?inventario|descuent[ao]\s+de\s+inventario)\b/i.test(
      norm,
    )
  ) {
    return 'inventario';
  }
  if (
    /\b(reporte\w*|pdf|excel|imprim\w*|impresion|impresora|termica|formato|descargar|exportar|logo|ticket\s+de\s+venta)\b/i.test(
      norm,
    )
  ) {
    return 'reportes';
  }
  if (
    /\b(iva|retencion|percepcion|calculo|cuadr\w*|descuadre|centavo|subtotal|planilla|contab\w*|asiento|partida|balance|cierre\s+de\s+caja|corte\s+z|saldo|abono|cxp|cxc)\b/i.test(
      norm,
    )
  ) {
    return 'calculos';
  }
  if (
    /\b(acceso|permiso|usuario|contrasena|clave|login|sesion|no\s+carga|pantalla\s+en\s+blanco|cargando|lento|caido|bloqueado|rol)\b/i.test(
      norm,
    )
  ) {
    return 'acceso';
  }
  if (/\bfactur\w*\b/i.test(norm)) {
    return 'dte';
  }

  if (
    /\b(error|falla|bug|no\s+deja|no\s+me\s+deja|no\s+puedo|no\s+funciona|problema|ayuda|consulta|como\s+(?:hago|se)|revisar|captura|no\s+aparece|no\s+sale|no\s+guarda)\b/i.test(
      norm,
    ) ||
    norm.length >= 22
  ) {
    return 'general';
  }
  return null;
}

export interface ConvPulseSummary {
  convKey: string;
  ticketId: string;
  ticketIds: string[];
  circleId: string | null;
  clientName: string;
  clientKey: string;
  primaryTech: string;
  distinctClientDays: number;
  totalMessages: number;
  clientMsgs: number;
  staffMsgs: number;
  peakDayKey: string;
  peakDayLabel: string;
  peakDayMessages: number;
  isPingPong: boolean;
  estStaffMinutes: number;
  moduleCounts: Record<SupportErrorModuleKey, number>;
  primaryModuleKey: SupportErrorModuleKey;
  lastRootCause: SupportRootCauseEntry | null;
  lastMessageAt: string;
}

export interface PulseTicketInput {
  id: string;
  title?: string | null;
  lead_name?: string | null;
  status?: string | null;
  assigned_to?: string | null;
  metadata?: Record<string, any> | null;
  updated_at?: string | null;
  created_at?: string | null;
}

export interface PulseWaMessageInput {
  id?: string;
  ticket_id: string;
  comment_id?: string | null;
  from_me: boolean;
  sender_phone?: string | null;
  sender_name?: string | null;
  message_ts: string;
  message_type?: string | null;
  body?: string | null;
}

export interface PulseCommentInput {
  id: string;
  ticket_id: string;
  author_id?: string | null;
  body?: string | null;
  is_internal?: boolean;
  created_at: string;
}

export interface PulseProfileInput {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface DailyPulseRow {
  dayKey: string;
  label: string;
  activeClients: number;
  totalMessages: number;
  clientMessages: number;
  staffMessages: number;
  pingPongChats: number;
  estStaffHours: number;
}

export interface PingPongChatAlert {
  ticketId: string;
  circleId: string | null;
  clientName: string;
  peakDayKey: string;
  peakDayLabel: string;
  peakDayMessages: number;
  totalPeriodMessages: number;
  clientMsgs: number;
  staffMsgs: number;
  primaryTech: string;
  estMinutes: number;
  lastRootCause: SupportRootCauseEntry | null;
  lastMessageAt: string;
}

export interface TechChatMetrics {
  techName: string;
  staffMessages: number;
  uniqueClientsHelped: number;
  avgMsgsPerClient: number;
  pingPongChatsCount: number;
  estChatHours: number;
  activeDays: number;
  avgChatHoursPerActiveDay: number;
  rootCauseCounts: Record<SupportRootCauseType, number>;
}

export interface RootCauseQueueItem {
  entryId: string;
  ticketId: string;
  circleId: string | null;
  clientName: string;
  type: SupportRootCauseType;
  note: string | null;
  byName: string;
  at: string;
  msgCount24h: number;
  periodMessages: number;
  devResolvedAt: string | null;
  devResolvedBy: string | null;
}

export interface SupportPulseResult {
  summary: {
    daysRange: number;
    todayClients: number;
    avgClientsPerDay: number;
    uniqueClientsInPeriod: number;
    totalMessages: number;
    clientMessages: number;
    staffMessages: number;
    avgMessagesPerClientDay: number;
    estTotalStaffHours: number;
    pingPongThreshold: number;
    pingPongCount: number;
    pendingDevCount: number;
  };
  dailySeries: DailyPulseRow[];
  pingPongAlerts: PingPongChatAlert[];
  convMetrics: ConvPulseSummary[];
  techChatMetrics: Record<string, TechChatMetrics>;
  primaryTechByTicketId: Record<string, string>;
  rootCauseQueue: {
    counts: Record<SupportRootCauseType, number>;
    pendingForDev: RootCauseQueueItem[];
    resolvedByDevCount: number;
    totalTagged: number;
  };
}

function normalizeStaffDisplayName(rawName?: string | null): string {
  const clean = String(rawName || '')
    .replace(/Simulaci[oó]n:\s*[a-zA-Z0-9_-]+/gi, '')
    .replace(/Platform\s*Owner/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return '';
  const lower = clean.toLowerCase();
  if (lower.includes('melvin')) return 'Melvin Rodriguez';
  if (lower.includes('gerson')) return 'Gerson Gutierrez';
  if (/^(asistente\s+ia|equipo(\s+soporte|\s+comercial)?|whatsapp(\s+soporte)?)$/i.test(clean)) {
    return '';
  }
  return clean;
}

function last8Digits(raw?: string | null): string {
  const d = String(raw || '').replace(/\D/g, '');
  return d.length >= 8 ? d.slice(-8) : '';
}

function deriveTicketClientName(t: PulseTicketInput): string {
  const lead = String(t.lead_name || '')
    .replace(/\(\+?\d[\d\s-]*\)/g, '')
    .trim();
  if (lead && !/^(general|interno|sin cliente)$/i.test(lead)) return lead;

  const title = String(t.title || '');
  const waMatch = title.match(/\[WhatsApp[^\]]*\]\s*([^:(]+?)(?:\s*\(\+?\d+\))?\s*(?::|$)/i);
  if (waMatch?.[1]?.trim()) return waMatch[1].trim();

  const colonMatch = title.match(/^[^:]+:\s*([^-(|]+)/);
  if (colonMatch?.[1]?.trim()) return colonMatch[1].trim();

  return title.slice(0, 48).trim() || 'Cliente WhatsApp';
}

function deriveCircleId(t: PulseTicketInput): string | null {
  const meta = (t.metadata || {}) as Record<string, any>;
  if (meta.source !== 'whatsapp_evolution') return null;
  const ident = meta.whatsapp_jid || meta.whatsapp_phone || t.id;
  return ident ? `wa:${ident}` : null;
}

const BURST_GAP_MS = 10 * 60 * 1000;
const BURST_BASE_MIN = 2.5;
const OUTBOUND_ECHO_WINDOW_MS = 15 * 1000;

export function computeSupportWhatsAppPulse(input: {
  tickets: PulseTicketInput[];
  waMessages: PulseWaMessageInput[];
  comments: PulseCommentInput[];
  profiles: PulseProfileInput[];
  options?: {
    daysRange?: number;
    pingPongThreshold?: number;
    nowMs?: number;
    techFilter?: string;
  };
}): SupportPulseResult {
  const nowMs = input.options?.nowMs ?? Date.now();
  const daysRange = Math.max(1, input.options?.daysRange ?? 15);
  const pingPongThreshold = Math.max(4, input.options?.pingPongThreshold ?? 12);
  const activeTechFilter =
    input.options?.techFilter && input.options.techFilter !== 'all'
      ? input.options.techFilter
      : null;

  // Start at midnight El Salvador time (UTC-6 year round) for (daysRange - 1) days ago
  const todayKey = toDayKey(nowMs);
  const [ty, tm, td] = todayKey.split('-').map(Number);
  const todayMidnightSvUtcMs = Date.UTC(ty, tm - 1, td, 6, 0, 0); // 00:00 America/El_Salvador
  const cutoffMs = todayMidnightSvUtcMs - (daysRange - 1) * 24 * 60 * 60 * 1000;
  const maxAllowedMs = nowMs + 60 * 1000;

  // Profile indexes (built before grouping so fallback assigned_to works)
  const profileNameById = new Map<string, string>();
  const profileNameByLast8 = new Map<string, string>();
  const profileFirstWordMap = new Map<string, string>();

  for (const p of input.profiles || []) {
    const resolvedName = normalizeStaffDisplayName(p.full_name || p.email?.split('@')[0] || '');
    if (p.id && resolvedName) {
      profileNameById.set(p.id, resolvedName);
      const firstWord = resolvedName.split(/\s+/)[0]?.toLowerCase() || '';
      if (firstWord.length >= 3 && !profileFirstWordMap.has(firstWord)) {
        profileFirstWordMap.set(firstWord, resolvedName);
      }
      profileFirstWordMap.set(resolvedName.toLowerCase(), resolvedName);
    }
    const l8 = last8Digits(p.phone);
    if (l8 && resolvedName) {
      profileNameByLast8.set(l8, resolvedName);
    }
  }

  // Group tickets into unified conversations (merges duplicate tickets for the same WhatsApp group)
  interface ConvGroup {
    convKey: string;
    representative: PulseTicketInput;
    tickets: PulseTicketInput[];
    primaryTech: string;
  }
  const ticketMap = new Map<string, PulseTicketInput>();
  const ticketIdToConvKey = new Map<string, string>();
  const convMap = new Map<string, ConvGroup>();

  const ticketFreshnessScore = (t: PulseTicketInput) => {
    const isOpen = ['new', 'open', 'pending'].includes(String(t.status || '')) ? 1 : 0;
    const ts = Date.parse(String(t.updated_at || t.created_at || '')) || 0;
    return { isOpen, ts };
  };

  for (const t of input.tickets || []) {
    if (!t?.id) continue;
    const meta = (t.metadata || {}) as Record<string, any>;
    if (meta.merged_into) continue;
    if (/^\s*jornada\s+(melvin|gerson)/i.test(String(t.title || ''))) continue;

    ticketMap.set(t.id, t);
    const circleId = deriveCircleId(t);
    const convKey = circleId || `ticket:${t.id}`;
    ticketIdToConvKey.set(t.id, convKey);

    const existing = convMap.get(convKey);
    if (!existing) {
      convMap.set(convKey, {
        convKey,
        representative: t,
        tickets: [t],
        primaryTech: 'WhatsApp Soporte',
      });
    } else {
      existing.tickets.push(t);
      const curScore = ticketFreshnessScore(existing.representative);
      const candScore = ticketFreshnessScore(t);
      if (
        candScore.isOpen > curScore.isOpen ||
        (candScore.isOpen === curScore.isOpen && candScore.ts > curScore.ts)
      ) {
        existing.representative = t;
      }
    }
  }

  const resolveStaffFromComment = (c: PulseCommentInput): { isBot: boolean; staffName: string } => {
    const body = String(c.body || '');
    if (c.author_id && profileNameById.has(c.author_id)) {
      return { isBot: false, staffName: profileNameById.get(c.author_id)! };
    }
    const staffMatch = body.match(/👨‍💻\s*([^:\n]+?)\s*:/);
    if (staffMatch?.[1]) {
      const rawAuthor = staffMatch[1].trim();
      if (/asistente\s+ia|auto\s*reply|bot\b/i.test(rawAuthor)) {
        return { isBot: true, staffName: '' };
      }
      const normalized = normalizeStaffDisplayName(rawAuthor);
      if (normalized) {
        const lower = normalized.toLowerCase();
        if (profileFirstWordMap.has(lower)) {
          return { isBot: false, staffName: profileFirstWordMap.get(lower)! };
        }
        const firstWord = lower.split(/\s+/)[0] || '';
        if (profileFirstWordMap.has(firstWord)) {
          return { isBot: false, staffName: profileFirstWordMap.get(firstWord)! };
        }
        return { isBot: false, staffName: normalized };
      }
    }
    return { isBot: false, staffName: '' };
  };

  // Index comments by ID
  const commentById = new Map<string, PulseCommentInput>();
  for (const c of input.comments || []) {
    if (c?.id) commentById.set(c.id, c);
  }

  interface UnifiedMsgEvent {
    ticketId: string;
    convKey: string;
    ms: number;
    dayKey: string;
    isStaff: boolean;
    staffName: string | null; // null if client or automated bot
    body: string;
  }

  const events: UnifiedMsgEvent[] = [];
  const usedCommentIds = new Set<string>();
  const outboundWaMsByConv = new Map<string, number[]>();

  // 1. Primary pass: whatsapp_messages
  for (const m of input.waMessages || []) {
    if (!m || !ticketMap.has(m.ticket_id)) continue;
    const ms = Date.parse(String(m.message_ts || ''));
    if (!Number.isFinite(ms) || ms < cutoffMs || ms > maxAllowedMs) continue;
    const convKey = ticketIdToConvKey.get(m.ticket_id)!;

    if (m.from_me) {
      const arr = outboundWaMsByConv.get(convKey) || [];
      arr.push(ms);
      outboundWaMsByConv.set(convKey, arr);
    }

    const linkedComment = m.comment_id ? commentById.get(m.comment_id) : undefined;
    if (linkedComment) usedCommentIds.add(linkedComment.id);

    let staffName = '';
    let isBot = false;

    if (linkedComment) {
      const res = resolveStaffFromComment(linkedComment);
      staffName = res.staffName;
      isBot = res.isBot;
    }

    if (!staffName && !isBot && m.sender_phone) {
      const l8 = last8Digits(m.sender_phone);
      if (l8 && profileNameByLast8.has(l8)) {
        staffName = profileNameByLast8.get(l8)!;
      }
    }

    if (!staffName && !isBot && m.sender_name) {
      const fromSender = normalizeStaffDisplayName(m.sender_name);
      if (fromSender) {
        const lower = fromSender.toLowerCase();
        if (lower.includes('melvin') || lower.includes('gerson') || profileFirstWordMap.has(lower)) {
          staffName = profileFirstWordMap.get(lower) || fromSender;
        }
      }
    }

    const commentHasStaffIcon = Boolean(linkedComment?.body?.includes('👨‍💻'));
    const isStaff =
      Boolean(staffName) || Boolean(m.from_me) || Boolean(linkedComment?.author_id) || commentHasStaffIcon;

    let finalStaffName: string | null = null;
    if (isStaff && !isBot) {
      finalStaffName = staffName || (m.from_me ? 'WhatsApp Soporte' : 'Equipo Soporte');
    }

    events.push({
      ticketId: m.ticket_id,
      convKey,
      ms,
      dayKey: toDayKey(ms),
      isStaff,
      staffName: finalStaffName,
      body: String(m.body || linkedComment?.body || ''),
    });
  }

  // 2. Fallback pass: ticket_comments not already represented by whatsapp_messages
  for (const c of input.comments || []) {
    if (!c || c.is_internal || usedCommentIds.has(c.id)) continue;
    if (!ticketMap.has(c.ticket_id)) continue;
    const ms = Date.parse(String(c.created_at || ''));
    if (!Number.isFinite(ms) || ms < cutoffMs || ms > maxAllowedMs) continue;
    const convKey = ticketIdToConvKey.get(c.ticket_id)!;

    const body = String(c.body || '');
    const { isBot, staffName } = resolveStaffFromComment(c);
    const hasStaffMarker = Boolean(staffName) || Boolean(c.author_id) || body.includes('👨‍💻');

    // Echo guard: skip CRM-written outgoing comment if a matching from_me waMessage occurred within +-15s
    if (hasStaffMarker) {
      const outArr = outboundWaMsByConv.get(convKey);
      if (outArr && outArr.some((waMs) => Math.abs(waMs - ms) <= OUTBOUND_ECHO_WINDOW_MS)) {
        continue;
      }
    }

    let finalStaffName: string | null = null;
    if (hasStaffMarker && !isBot) {
      finalStaffName = staffName || 'Equipo Soporte';
    }

    events.push({
      ticketId: c.ticket_id,
      convKey,
      ms,
      dayKey: toDayKey(ms),
      isStaff: hasStaffMarker,
      staffName: finalStaffName,
      body,
    });
  }

  // Per-conversation & per-staff aggregations across ALL support conversations
  interface ConvAgg {
    convKey: string;
    totalMessages: number;
    clientMsgs: number;
    staffMsgs: number;
    lastMsgMs: number;
    clientDays: Set<string>;
    dayCounts: Map<string, number>;
    staffCounts: Map<string, number>;
    staffTimestamps: number[];
    moduleCounts: Record<SupportErrorModuleKey, number>;
    isPingPong: boolean;
    peakDayKey: string;
    peakDayMessages: number;
  }
  const convAggMap = new Map<string, ConvAgg>();
  const globalStaffEventsMap = new Map<string, Array<{ ms: number; dayKey: string; convKey: string }>>();

  for (const ev of events) {
    let cAgg = convAggMap.get(ev.convKey);
    if (!cAgg) {
      cAgg = {
        convKey: ev.convKey,
        totalMessages: 0,
        clientMsgs: 0,
        staffMsgs: 0,
        lastMsgMs: ev.ms,
        clientDays: new Set<string>(),
        dayCounts: new Map<string, number>(),
        staffCounts: new Map<string, number>(),
        staffTimestamps: [],
        moduleCounts: {
          dte: 0,
          inventario: 0,
          reportes: 0,
          calculos: 0,
          acceso: 0,
          general: 0,
        },
        isPingPong: false,
        peakDayKey: '',
        peakDayMessages: 0,
      };
      convAggMap.set(ev.convKey, cAgg);
    }
    cAgg.totalMessages += 1;
    if (ev.isStaff) {
      cAgg.staffMsgs += 1;
    } else {
      cAgg.clientMsgs += 1;
      cAgg.clientDays.add(ev.dayKey);
      const detectedMod = detectSupportErrorModule(ev.body);
      if (detectedMod) {
        cAgg.moduleCounts[detectedMod] += 1;
      }
    }
    if (ev.ms > cAgg.lastMsgMs) cAgg.lastMsgMs = ev.ms;
    cAgg.dayCounts.set(ev.dayKey, (cAgg.dayCounts.get(ev.dayKey) || 0) + 1);

    if (ev.isStaff && ev.staffName) {
      cAgg.staffCounts.set(ev.staffName, (cAgg.staffCounts.get(ev.staffName) || 0) + 1);
      cAgg.staffTimestamps.push(ev.ms);

      const sList = globalStaffEventsMap.get(ev.staffName) || [];
      sList.push({ ms: ev.ms, dayKey: ev.dayKey, convKey: ev.convKey });
      globalStaffEventsMap.set(ev.staffName, sList);
    }
  }

  // Assign primaryTech and peak/pingPong flags for every conversation
  const primaryTechByTicketId: Record<string, string> = {};
  for (const conv of convMap.values()) {
    const cAgg = convAggMap.get(conv.convKey);
    let primaryTech = '';
    if (cAgg) {
      let bestTechCount = -1;
      for (const [name, cnt] of cAgg.staffCounts.entries()) {
        const bonus = name === 'WhatsApp Soporte' || name === 'Equipo Soporte' ? 0 : 0.5;
        if (cnt + bonus > bestTechCount) {
          bestTechCount = cnt + bonus;
          primaryTech = name;
        }
      }
      for (const [dk, cnt] of cAgg.dayCounts.entries()) {
        if (cnt > cAgg.peakDayMessages || (cnt === cAgg.peakDayMessages && dk > cAgg.peakDayKey)) {
          cAgg.peakDayMessages = cnt;
          cAgg.peakDayKey = dk;
        }
      }
      cAgg.isPingPong = cAgg.peakDayMessages >= pingPongThreshold;
    }

    if (!primaryTech && conv.representative.assigned_to && profileNameById.has(conv.representative.assigned_to)) {
      primaryTech = profileNameById.get(conv.representative.assigned_to)!;
    }
    if (!primaryTech) {
      const assignedTicket = conv.tickets.find((t) => t.assigned_to && profileNameById.has(t.assigned_to));
      if (assignedTicket?.assigned_to) {
        primaryTech = profileNameById.get(assignedTicket.assigned_to)!;
      }
    }
    conv.primaryTech = primaryTech || 'WhatsApp Soporte';

    for (const t of conv.tickets) {
      primaryTechByTicketId[t.id] = conv.primaryTech;
    }
  }

  // Global per-tech metrics across ALL conversations (always stays populated for comparison cards)
  const techChatMetrics: Record<string, TechChatMetrics> = {};
  for (const [techName, sEvents] of globalStaffEventsMap.entries()) {
    const sorted = [...sEvents].sort((a, b) => a.ms - b.ms);
    let techMinutes = 0;
    let prevMs: number | null = null;
    const uniqueConvs = new Set<string>();
    const activeDaysSet = new Set<string>();
    const techPingPongConvs = new Set<string>();

    for (const ev of sorted) {
      uniqueConvs.add(ev.convKey);
      activeDaysSet.add(ev.dayKey);
      const conv = convMap.get(ev.convKey);
      const cAgg = convAggMap.get(ev.convKey);
      if (cAgg?.isPingPong && conv?.primaryTech === techName) {
        techPingPongConvs.add(ev.convKey);
      }
      const deltaMin =
        prevMs === null || ev.ms - prevMs > BURST_GAP_MS
          ? BURST_BASE_MIN
          : Math.max(0, (ev.ms - prevMs) / 60000);
      prevMs = ev.ms;
      techMinutes += deltaMin;
    }

    const estChatHours = +(techMinutes / 60).toFixed(1);
    const activeDays = activeDaysSet.size;
    techChatMetrics[techName] = {
      techName,
      staffMessages: sorted.length,
      uniqueClientsHelped: uniqueConvs.size,
      avgMsgsPerClient: uniqueConvs.size > 0 ? +(sorted.length / uniqueConvs.size).toFixed(1) : 0,
      pingPongChatsCount: techPingPongConvs.size,
      estChatHours,
      activeDays,
      avgChatHoursPerActiveDay: activeDays > 0 ? +(estChatHours / activeDays).toFixed(1) : 0,
      rootCauseCounts: {
        system_bug: 0,
        temp_patch: 0,
        client_training: 0,
        external_mh: 0,
      },
    };
  }

  // Initialize daily calendar buckets (filtered when techFilter is active)
  const dailyMap = new Map<
    string,
    {
      dayKey: string;
      clients: Set<string>;
      totalMessages: number;
      clientMessages: number;
      staffMessages: number;
      estStaffMinutes: number;
      msgsByConv: Map<string, number>;
    }
  >();

  for (let i = daysRange - 1; i >= 0; i--) {
    const dk = toDayKey(nowMs - i * 24 * 60 * 60 * 1000);
    dailyMap.set(dk, {
      dayKey: dk,
      clients: new Set<string>(),
      totalMessages: 0,
      clientMessages: 0,
      staffMessages: 0,
      estStaffMinutes: 0,
      msgsByConv: new Map<string, number>(),
    });
  }

  const includedConvKeys = new Set<string>();
  for (const conv of convMap.values()) {
    if (!activeTechFilter || conv.primaryTech === activeTechFilter) {
      includedConvKeys.add(conv.convKey);
    }
  }

  const uniqueClientsInPeriod = new Set<string>();
  let totalMessages = 0;
  let clientMessages = 0;
  let staffMessages = 0;
  const filteredStaffEventsByTech = new Map<string, Array<{ ms: number; dayKey: string }>>();

  for (const ev of events) {
    if (!includedConvKeys.has(ev.convKey)) continue;
    totalMessages += 1;
    if (ev.isStaff) staffMessages += 1;
    else clientMessages += 1;
    uniqueClientsInPeriod.add(ev.convKey);

    let dBucket = dailyMap.get(ev.dayKey);
    if (!dBucket) {
      dBucket = {
        dayKey: ev.dayKey,
        clients: new Set<string>(),
        totalMessages: 0,
        clientMessages: 0,
        staffMessages: 0,
        estStaffMinutes: 0,
        msgsByConv: new Map<string, number>(),
      };
      dailyMap.set(ev.dayKey, dBucket);
    }
    dBucket.clients.add(ev.convKey);
    dBucket.totalMessages += 1;
    if (ev.isStaff) dBucket.staffMessages += 1;
    else dBucket.clientMessages += 1;
    dBucket.msgsByConv.set(ev.convKey, (dBucket.msgsByConv.get(ev.convKey) || 0) + 1);

    if (ev.isStaff && ev.staffName) {
      if (!activeTechFilter || ev.staffName === activeTechFilter) {
        const sArr = filteredStaffEventsByTech.get(ev.staffName) || [];
        sArr.push({ ms: ev.ms, dayKey: ev.dayKey });
        filteredStaffEventsByTech.set(ev.staffName, sArr);
      }
    }
  }

  // Burst time for displayed summary + dailySeries
  let estTotalStaffMinutes = 0;
  for (const sEvents of filteredStaffEventsByTech.values()) {
    const sorted = [...sEvents].sort((a, b) => a.ms - b.ms);
    let prevMs: number | null = null;
    for (const ev of sorted) {
      const deltaMin =
        prevMs === null || ev.ms - prevMs > BURST_GAP_MS
          ? BURST_BASE_MIN
          : Math.max(0, (ev.ms - prevMs) / 60000);
      prevMs = ev.ms;
      estTotalStaffMinutes += deltaMin;
      const dBucket = dailyMap.get(ev.dayKey);
      if (dBucket) dBucket.estStaffMinutes += deltaMin;
    }
  }

  // Ping-pong alerts (deduplicated per conversation & respecting techFilter)
  const pingPongAlerts: PingPongChatAlert[] = [];
  for (const cAgg of convAggMap.values()) {
    if (!cAgg.isPingPong || !includedConvKeys.has(cAgg.convKey)) continue;
    const conv = convMap.get(cAgg.convKey)!;

    const sortedTs = [...cAgg.staffTimestamps].sort((a, b) => a - b);
    let convBurstMin = 0;
    let prevMs: number | null = null;
    for (const ts of sortedTs) {
      if (prevMs === null || ts - prevMs > BURST_GAP_MS) {
        convBurstMin += BURST_BASE_MIN;
      } else {
        convBurstMin += Math.max(0, (ts - prevMs) / 60000);
      }
      prevMs = ts;
    }

    const combinedEntries = conv.tickets
      .flatMap((t) => extractRootCauseEntries(t.metadata))
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

    pingPongAlerts.push({
      ticketId: conv.representative.id,
      circleId: deriveCircleId(conv.representative),
      clientName: deriveTicketClientName(conv.representative),
      peakDayKey: cAgg.peakDayKey,
      peakDayLabel: toDayLabel(cAgg.peakDayKey),
      peakDayMessages: cAgg.peakDayMessages,
      totalPeriodMessages: cAgg.totalMessages,
      clientMsgs: cAgg.clientMsgs,
      staffMsgs: cAgg.staffMsgs,
      primaryTech: conv.primaryTech,
      estMinutes: Math.round(convBurstMin),
      lastRootCause: combinedEntries[0] || null,
      lastMessageAt: new Date(cAgg.lastMsgMs).toISOString(),
    });
  }

  pingPongAlerts.sort(
    (a, b) =>
      b.peakDayMessages - a.peakDayMessages ||
      b.totalPeriodMessages - a.totalPeriodMessages,
  );

  // Root-cause queue & counts (deduplicated across tickets of the same conversation)
  const rcCounts: Record<SupportRootCauseType, number> = {
    system_bug: 0,
    temp_patch: 0,
    client_training: 0,
    external_mh: 0,
  };
  const pendingForDev: RootCauseQueueItem[] = [];
  let resolvedByDevCount = 0;
  let totalTagged = 0;

  for (const conv of convMap.values()) {
    const cAgg = convAggMap.get(conv.convKey);
    const periodMessages = cAgg?.totalMessages || 0;
    const clientName = deriveTicketClientName(conv.representative);
    const circleId = deriveCircleId(conv.representative);

    const seenEntryIds = new Set<string>();
    for (const ticket of conv.tickets) {
      const entries = extractRootCauseEntries(ticket.metadata);
      for (const entry of entries) {
        if (seenEntryIds.has(entry.id)) continue;
        seenEntryIds.add(entry.id);

        const entryMs = Date.parse(entry.at);
        const inRange = Number.isFinite(entryMs) && entryMs >= cutoffMs && entryMs <= maxAllowedMs;
        const normAuthor = normalizeStaffDisplayName(entry.by_name);

        if (inRange && normAuthor && techChatMetrics[normAuthor]) {
          techChatMetrics[normAuthor].rootCauseCounts[entry.type] += 1;
        }

        const matchesTechFilter =
          !activeTechFilter ||
          conv.primaryTech === activeTechFilter ||
          normAuthor === activeTechFilter;
        if (!matchesTechFilter) continue;

        const isEscalatedDev = entry.type === 'system_bug' || entry.type === 'temp_patch';
        const isPendingDev = isEscalatedDev && !entry.dev_resolved_at;

        if (inRange) {
          rcCounts[entry.type] += 1;
          totalTagged += 1;
          if (entry.dev_resolved_at) resolvedByDevCount += 1;
        }

        if (isPendingDev) {
          pendingForDev.push({
            entryId: entry.id,
            ticketId: ticket.id,
            circleId,
            clientName,
            type: entry.type,
            note: entry.note || null,
            byName: entry.by_name,
            at: entry.at,
            msgCount24h: entry.msg_count_24h || 0,
            periodMessages,
            devResolvedAt: entry.dev_resolved_at || null,
            devResolvedBy: entry.dev_resolved_by || null,
          });
        }
      }
    }
  }

  pendingForDev.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'system_bug' ? -1 : 1;
    }
    return Date.parse(b.at) - Date.parse(a.at);
  });

  // Finalize dailySeries
  const dailySeries: DailyPulseRow[] = Array.from(dailyMap.values())
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey))
    .map((d) => {
      let dayPingPong = 0;
      for (const cnt of d.msgsByConv.values()) {
        if (cnt >= pingPongThreshold) dayPingPong += 1;
      }
      return {
        dayKey: d.dayKey,
        label: toDayLabel(d.dayKey),
        activeClients: d.clients.size,
        totalMessages: d.totalMessages,
        clientMessages: d.clientMessages,
        staffMessages: d.staffMessages,
        pingPongChats: dayPingPong,
        estStaffHours: +(d.estStaffMinutes / 60).toFixed(1),
      };
    });

  const activeDaysWithClients = dailySeries.filter((d) => d.activeClients > 0);
  const avgClientsPerDay =
    activeDaysWithClients.length > 0
      ? +(
          activeDaysWithClients.reduce((acc, d) => acc + d.activeClients, 0) /
          activeDaysWithClients.length
        ).toFixed(1)
      : 0;
  const totalClientDays = dailySeries.reduce((acc, d) => acc + d.activeClients, 0);
  const avgMessagesPerClientDay =
    totalClientDays > 0 ? +(totalMessages / totalClientDays).toFixed(1) : 0;
  const todayClients = dailyMap.get(todayKey)?.clients.size || 0;

  // Build unified per-conversation summary across ALL support conversations
  const specificModules: SupportErrorModuleKey[] = [
    'dte',
    'inventario',
    'reportes',
    'calculos',
    'acceso',
  ];
  const convMetrics: ConvPulseSummary[] = [];
  for (const [convKey, cAgg] of convAggMap.entries()) {
    const conv = convMap.get(convKey);
    if (!conv) continue;

    const sortedTs = [...cAgg.staffTimestamps].sort((a, b) => a - b);
    let convBurstMin = 0;
    let prevMs: number | null = null;
    for (const ts of sortedTs) {
      if (prevMs === null || ts - prevMs > BURST_GAP_MS) {
        convBurstMin += BURST_BASE_MIN;
      } else {
        convBurstMin += Math.max(0, (ts - prevMs) / 60000);
      }
      prevMs = ts;
    }

    let primaryModuleKey: SupportErrorModuleKey = 'general';
    let bestModCount = 0;
    for (const mk of specificModules) {
      if (cAgg.moduleCounts[mk] > bestModCount) {
        bestModCount = cAgg.moduleCounts[mk];
        primaryModuleKey = mk;
      }
    }
    if (bestModCount === 0) {
      const fromTicket = detectSupportErrorModule(
        `${conv.representative.title || ''} ${(conv.representative as any).description || ''}`,
      );
      if (fromTicket) primaryModuleKey = fromTicket;
    }

    const combinedEntries = conv.tickets
      .flatMap((t) => extractRootCauseEntries(t.metadata))
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

    const clientName = normalizeSupportClientName(deriveTicketClientName(conv.representative));
    convMetrics.push({
      convKey,
      ticketId: conv.representative.id,
      ticketIds: conv.tickets.map((t) => t.id),
      circleId: deriveCircleId(conv.representative),
      clientName,
      clientKey: supportClientMergeKey(clientName),
      primaryTech: conv.primaryTech,
      distinctClientDays: cAgg.clientDays.size,
      totalMessages: cAgg.totalMessages,
      clientMsgs: cAgg.clientMsgs,
      staffMsgs: cAgg.staffMsgs,
      peakDayKey: cAgg.peakDayKey,
      peakDayLabel: toDayLabel(cAgg.peakDayKey),
      peakDayMessages: cAgg.peakDayMessages,
      isPingPong: cAgg.isPingPong,
      estStaffMinutes: Math.round(convBurstMin),
      moduleCounts: { ...cAgg.moduleCounts },
      primaryModuleKey,
      lastRootCause: combinedEntries[0] || null,
      lastMessageAt: new Date(cAgg.lastMsgMs).toISOString(),
    });
  }

  convMetrics.sort(
    (a, b) =>
      b.peakDayMessages - a.peakDayMessages ||
      b.totalMessages - a.totalMessages,
  );

  return {
    summary: {
      daysRange,
      todayClients,
      avgClientsPerDay,
      uniqueClientsInPeriod: uniqueClientsInPeriod.size,
      totalMessages,
      clientMessages,
      staffMessages,
      avgMessagesPerClientDay,
      estTotalStaffHours: +(estTotalStaffMinutes / 60).toFixed(1),
      pingPongThreshold,
      pingPongCount: pingPongAlerts.length,
      pendingDevCount: pendingForDev.length,
    },
    dailySeries,
    pingPongAlerts,
    convMetrics,
    techChatMetrics,
    primaryTechByTicketId,
    rootCauseQueue: {
      counts: rcCounts,
      pendingForDev,
      resolvedByDevCount,
      totalTagged,
    },
  };
}

export interface ExecutiveTicketRecordInput<T = any> {
  id: string;
  source: 'ticket' | 'task';
  rawTicket?: T;
  title: string;
  description?: string | null;
  clientName: string;
  isInternalSystemTask: boolean;
  techName: string;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  ticketCategoryCode: string;
  ticketCategoryColor?: string;
  workBucket: 'text_reply' | 'implementation' | 'troubleshooting' | 'development';
  workBucketLabel?: string;
  reportedHours: number;
  expectedAiHours: number;
  diffAiHours?: number;
  aiTimeStatus: 'missing_time' | 'inflated' | 'fair' | 'fast';
  solution?: string;
  isRepeatForSameClient: boolean;
  createdAt: string;
  resolvedAt?: string | null;
  isWhatsapp?: boolean;
}

export interface ExecutiveTechSummary {
  techName: string;
  buildHours: number;
  ticketReactiveHours: number;
  unloggedChatHours: number;
  totalReactiveHours: number;
  totalHours: number;
  buildPct: number;
  reactivePct: number;
  openTickets: number;
  closedTickets: number;
  totalTickets: number;
  waMessages: number;
  waClients: number;
  pingPongCount: number;
  returningClientsCount: number;
  inflatedCount: number;
}

export interface ErrorModuleHotspot {
  moduleKey: SupportErrorModuleKey;
  label: string;
  shortLabel: string;
  barColor: string;
  badgeClass: string;
  clientCount: number;
  clientNames: string[];
  messageCount: number;
  ticketCount: number;
  reactiveHours: number;
}

export type UnifiedClientHealthStatus = 'critical' | 'watch' | 'stable';

export interface UnifiedClientHealthRow<T = any> {
  clientKey: string;
  clientName: string;
  health: UnifiedClientHealthStatus;
  healthLabel: string;
  healthReason: string;
  distinctDaysReported: number;
  peakDayMessages: number;
  peakDayLabel: string;
  isPingPong: boolean;
  waMessages: number;
  waClientMsgs: number;
  waStaffMsgs: number;
  waEstHours: number;
  ticketCount: number;
  openTickets: number;
  ticketReactiveHours: number;
  unloggedChatHours: number;
  totalReactiveHours: number;
  buildHours: number;
  primaryTech: string;
  primaryModuleKey: SupportErrorModuleKey;
  primaryModuleLabel: string;
  circleId: string | null;
  latestRootCause: SupportRootCauseEntry | null;
  lastActivityAt: string;
  records: ExecutiveTicketRecordInput<T>[];
}

export interface ExecutiveSupportOverview<T = any> {
  totals: {
    buildHours: number;
    ticketReactiveHours: number;
    unloggedChatHours: number;
    totalReactiveHours: number;
    totalHours: number;
    buildPct: number;
    reactivePct: number;
    targetBuildPct: number;
    targetReactivePct: number;
    verdictTone: 'good' | 'warn' | 'critical' | 'neutral';
    verdictTitle: string;
    verdictDetail: string;
    returningClientsCount: number;
    activeClientsCount: number;
    returningPct: number;
    openTicketsCount: number;
  };
  techSummaries: ExecutiveTechSummary[];
  moduleHotspots: ErrorModuleHotspot[];
  unifiedClients: UnifiedClientHealthRow<T>[];
  internalDev: {
    count: number;
    totalHours: number;
    records: ExecutiveTicketRecordInput<T>[];
  };
}

export function buildExecutiveSupportOverview<T = any>(input: {
  pulse: SupportPulseResult;
  records: ExecutiveTicketRecordInput<T>[];
  techFilter?: string;
  targetBuildPct?: number;
  targetReactivePct?: number;
}): ExecutiveSupportOverview<T> {
  const activeTech =
    input.techFilter && input.techFilter !== 'all' ? input.techFilter : null;
  const targetBuildPct = input.targetBuildPct ?? 80;
  const targetReactivePct = input.targetReactivePct ?? 5;

  const computeScopeMetrics = (
    scopedRecords: ExecutiveTicketRecordInput<T>[],
    scopedConvs: ConvPulseSummary[],
  ) => {
    const buildHours = +scopedRecords
      .filter(
        (r) =>
          r.workBucket === 'development' || r.workBucket === 'implementation',
      )
      .reduce((acc, r) => acc + r.reportedHours, 0)
      .toFixed(1);

    const reactiveRecords = scopedRecords.filter(
      (r) => r.workBucket === 'troubleshooting' || r.workBucket === 'text_reply',
    );
    const ticketReactiveHours = +reactiveRecords
      .reduce((acc, r) => acc + r.reportedHours, 0)
      .toFixed(1);

    const waLoggedByClient = new Map<string, number>();
    for (const r of reactiveRecords) {
      if (!r.isWhatsapp) continue;
      const ck = supportClientMergeKey(r.clientName);
      waLoggedByClient.set(ck, (waLoggedByClient.get(ck) || 0) + r.reportedHours);
    }

    const waEstByClient = new Map<string, number>();
    for (const c of scopedConvs) {
      waEstByClient.set(
        c.clientKey,
        (waEstByClient.get(c.clientKey) || 0) + c.estStaffMinutes / 60,
      );
    }

    let unloggedChatHours = 0;
    for (const [ck, waHrs] of waEstByClient.entries()) {
      const loggedHrs = waLoggedByClient.get(ck) || 0;
      unloggedChatHours += Math.max(0, +(waHrs - loggedHrs).toFixed(1));
    }
    unloggedChatHours = +unloggedChatHours.toFixed(1);

    const totalReactiveHours = +(ticketReactiveHours + unloggedChatHours).toFixed(1);
    const totalHours = +(buildHours + totalReactiveHours).toFixed(1);
    const buildPct =
      totalHours > 0 ? Math.round((buildHours / totalHours) * 100) : 0;
    const reactivePct = totalHours > 0 ? 100 - buildPct : 0;

    return {
      buildHours,
      ticketReactiveHours,
      unloggedChatHours,
      totalReactiveHours,
      totalHours,
      buildPct,
      reactivePct,
      reactiveRecords,
    };
  };

  // Build unified client health list & hotspots for a given scope
  const buildClientsForScope = (
    scopedRecords: ExecutiveTicketRecordInput<T>[],
    scopedConvs: ConvPulseSummary[],
  ) => {
    const clientBuckets = new Map<
      string,
      {
        clientName: string;
        records: ExecutiveTicketRecordInput<T>[];
        convs: ConvPulseSummary[];
      }
    >();

    for (const r of scopedRecords) {
      if (r.isInternalSystemTask) continue;
      const cleanName = normalizeSupportClientName(r.clientName);
      const ck = supportClientMergeKey(cleanName);
      if (!ck) continue;
      let bucket = clientBuckets.get(ck);
      if (!bucket) {
        bucket = { clientName: cleanName, records: [], convs: [] };
        clientBuckets.set(ck, bucket);
      }
      bucket.records.push(r);
    }

    for (const c of scopedConvs) {
      let bucket = clientBuckets.get(c.clientKey);
      if (!bucket) {
        bucket = { clientName: c.clientName, records: [], convs: [] };
        clientBuckets.set(c.clientKey, bucket);
      }
      bucket.convs.push(c);
    }

    const unifiedClients: UnifiedClientHealthRow<T>[] = [];

    for (const [clientKey, b] of clientBuckets.entries()) {
      const distinctDaysReported = b.convs.reduce(
        (maxD, c) => Math.max(maxD, c.distinctClientDays),
        0,
      );
      let peakDayMessages = 0;
      let peakDayLabel = '';
      let isPingPong = false;
      let waMessages = 0;
      let waClientMsgs = 0;
      let waStaffMsgs = 0;
      let waEstMinutes = 0;
      let circleId: string | null = null;
      let latestRootCause: SupportRootCauseEntry | null = null;
      let lastActivityMs = 0;

      const techCounts = new Map<string, number>();
      const modScores: Record<SupportErrorModuleKey, number> = {
        dte: 0,
        inventario: 0,
        reportes: 0,
        calculos: 0,
        acceso: 0,
        general: 0,
      };

      for (const c of b.convs) {
        waMessages += c.totalMessages;
        waClientMsgs += c.clientMsgs;
        waStaffMsgs += c.staffMsgs;
        waEstMinutes += c.estStaffMinutes;
        if (c.isPingPong) isPingPong = true;
        if (c.peakDayMessages > peakDayMessages) {
          peakDayMessages = c.peakDayMessages;
          peakDayLabel = c.peakDayLabel;
        }
        if (!circleId && c.circleId) circleId = c.circleId;
        if (
          c.lastRootCause &&
          (!latestRootCause ||
            Date.parse(c.lastRootCause.at) > Date.parse(latestRootCause.at))
        ) {
          latestRootCause = c.lastRootCause;
        }
        const lmMs = Date.parse(c.lastMessageAt) || 0;
        if (lmMs > lastActivityMs) lastActivityMs = lmMs;
        if (c.primaryTech && c.primaryTech !== 'WhatsApp Soporte') {
          techCounts.set(
            c.primaryTech,
            (techCounts.get(c.primaryTech) || 0) + Math.max(1, c.staffMsgs),
          );
        }
        for (const mk of Object.keys(modScores) as SupportErrorModuleKey[]) {
          modScores[mk] += c.moduleCounts[mk] || 0;
        }
      }

      let openTickets = 0;
      let repeatTicketCount = 0;
      let ticketReactiveHours = 0;
      let waLoggedReactiveHours = 0;
      let buildHours = 0;

      for (const r of b.records) {
        if (r.status !== 'resolved' && r.status !== 'closed') openTickets += 1;
        if (r.isRepeatForSameClient) repeatTicketCount += 1;
        const isBuild =
          r.workBucket === 'development' || r.workBucket === 'implementation';
        if (isBuild) {
          buildHours += r.reportedHours;
        } else {
          ticketReactiveHours += r.reportedHours;
          if (r.isWhatsapp) waLoggedReactiveHours += r.reportedHours;
          const rMod =
            detectSupportErrorModule(`${r.title} ${r.description || ''}`) ||
            'general';
          modScores[rMod] += 2;
        }
        if (r.techName && r.techName !== 'Sin asignar') {
          techCounts.set(r.techName, (techCounts.get(r.techName) || 0) + 2);
        }
        const rMs = Date.parse(r.createdAt) || 0;
        if (rMs > lastActivityMs) lastActivityMs = rMs;
      }

      const waEstHours = +(waEstMinutes / 60).toFixed(1);
      ticketReactiveHours = +ticketReactiveHours.toFixed(1);
      buildHours = +buildHours.toFixed(1);
      const unloggedChatHours = Math.max(
        0,
        +(waEstHours - waLoggedReactiveHours).toFixed(1),
      );
      const totalReactiveHours = +(
        ticketReactiveHours + unloggedChatHours
      ).toFixed(1);

      let primaryTech = b.convs[0]?.primaryTech || 'Sin asignar';
      let bestTechScore = -1;
      for (const [tName, sc] of techCounts.entries()) {
        if (sc > bestTechScore) {
          bestTechScore = sc;
          primaryTech = tName;
        }
      }

      let primaryModuleKey: SupportErrorModuleKey = 'general';
      let bestModScore = 0;
      for (const mk of [
        'dte',
        'inventario',
        'reportes',
        'calculos',
        'acceso',
      ] as SupportErrorModuleKey[]) {
        if (modScores[mk] > bestModScore) {
          bestModScore = modScores[mk];
          primaryModuleKey = mk;
        }
      }
      if (bestModScore === 0 && b.convs[0]?.primaryModuleKey) {
        primaryModuleKey = b.convs[0].primaryModuleKey;
      }

      let health: UnifiedClientHealthStatus = 'stable';
      let healthLabel = 'Estable';
      let healthReason = 'Sin regresos ni chat excesivo';

      if (distinctDaysReported >= 2 || isPingPong || repeatTicketCount >= 1) {
        health = 'critical';
        healthLabel = 'Reincidente';
        const parts: string[] = [];
        if (distinctDaysReported >= 2)
          parts.push(`Volvió ${distinctDaysReported} días`);
        if (isPingPong)
          parts.push(`Pico ${peakDayMessages} msgs (${peakDayLabel})`);
        if (repeatTicketCount >= 1)
          parts.push(`${repeatTicketCount} ticket(s) repetido(s)`);
        healthReason = parts.join(' · ');
      } else if (openTickets > 0 || totalReactiveHours > 0 || waMessages > 0) {
        health = 'watch';
        healthLabel = openTickets > 0 ? 'Con caso abierto' : 'Atención';
        healthReason =
          openTickets > 0
            ? `${openTickets} caso(s) sin cerrar`
            : `${waMessages} msgs · ${totalReactiveHours}h soporte`;
      }

      unifiedClients.push({
        clientKey,
        clientName: b.clientName,
        health,
        healthLabel,
        healthReason,
        distinctDaysReported,
        peakDayMessages,
        peakDayLabel,
        isPingPong,
        waMessages,
        waClientMsgs,
        waStaffMsgs,
        waEstHours,
        ticketCount: b.records.length,
        openTickets,
        ticketReactiveHours,
        unloggedChatHours,
        totalReactiveHours,
        buildHours,
        primaryTech,
        primaryModuleKey,
        primaryModuleLabel: SUPPORT_ERROR_MODULES[primaryModuleKey].shortLabel,
        circleId,
        latestRootCause,
        lastActivityAt: lastActivityMs
          ? new Date(lastActivityMs).toISOString()
          : '',
        records: [...b.records].sort(
          (a, b2) => Date.parse(b2.createdAt) - Date.parse(a.createdAt),
        ),
      });
    }

    const healthRank: Record<UnifiedClientHealthStatus, number> = {
      critical: 0,
      watch: 1,
      stable: 2,
    };
    unifiedClients.sort(
      (a, b) =>
        healthRank[a.health] - healthRank[b.health] ||
        (b.isPingPong ? 1 : 0) - (a.isPingPong ? 1 : 0) ||
        b.distinctDaysReported - a.distinctDaysReported ||
        b.totalReactiveHours - a.totalReactiveHours ||
        b.waMessages - a.waMessages,
    );

    return unifiedClients;
  };

  // Scope filtered by activeTech for main view
  const scopedRecords = activeTech
    ? input.records.filter((r) => r.techName === activeTech)
    : input.records;
  const scopedConvs = activeTech
    ? input.pulse.convMetrics.filter((c) => c.primaryTech === activeTech)
    : input.pulse.convMetrics;

  const scopeSplit = computeScopeMetrics(scopedRecords, scopedConvs);
  const unifiedClients = buildClientsForScope(scopedRecords, scopedConvs);

  // Module hotspots across filtered scope
  const hotspotMap = new Map<
    SupportErrorModuleKey,
    {
      clients: Map<string, string>;
      messageCount: number;
      ticketCount: number;
      reactiveHours: number;
    }
  >();
  for (const mk of Object.keys(SUPPORT_ERROR_MODULES) as SupportErrorModuleKey[]) {
    hotspotMap.set(mk, {
      clients: new Map<string, string>(),
      messageCount: 0,
      ticketCount: 0,
      reactiveHours: 0,
    });
  }

  for (const r of scopeSplit.reactiveRecords) {
    if (r.isInternalSystemTask) continue;
    const mk =
      detectSupportErrorModule(`${r.title} ${r.description || ''}`) || 'general';
    const entry = hotspotMap.get(mk)!;
    const cleanName = normalizeSupportClientName(r.clientName);
    entry.clients.set(supportClientMergeKey(cleanName), cleanName);
    entry.ticketCount += 1;
    entry.reactiveHours += r.reportedHours;
  }

  // Attribute unlogged chat hours + WA client messages to hotspots without double counting
  const waLoggedReactiveByConvClient = new Map<string, number>();
  for (const r of scopeSplit.reactiveRecords) {
    if (!r.isWhatsapp) continue;
    const ck = supportClientMergeKey(r.clientName);
    waLoggedReactiveByConvClient.set(
      ck,
      (waLoggedReactiveByConvClient.get(ck) || 0) + r.reportedHours,
    );
  }
  const seenUnloggedClient = new Set<string>();
  for (const c of scopedConvs) {
    let anyModAdded = false;
    for (const mk of Object.keys(SUPPORT_ERROR_MODULES) as SupportErrorModuleKey[]) {
      const cnt = c.moduleCounts[mk] || 0;
      if (cnt > 0) {
        const entry = hotspotMap.get(mk)!;
        entry.clients.set(c.clientKey, c.clientName);
        entry.messageCount += cnt;
        anyModAdded = true;
      }
    }
    if (!anyModAdded && c.clientMsgs > 0) {
      const entry = hotspotMap.get(c.primaryModuleKey)!;
      entry.clients.set(c.clientKey, c.clientName);
      entry.messageCount += c.clientMsgs;
    }

    if (!seenUnloggedClient.has(c.clientKey)) {
      seenUnloggedClient.add(c.clientKey);
      const waTotalHrs = scopedConvs
        .filter((x) => x.clientKey === c.clientKey)
        .reduce((acc, x) => acc + x.estStaffMinutes / 60, 0);
      const unlogged = Math.max(
        0,
        waTotalHrs - (waLoggedReactiveByConvClient.get(c.clientKey) || 0),
      );
      if (unlogged > 0) {
        hotspotMap.get(c.primaryModuleKey)!.reactiveHours += unlogged;
      }
    }
  }

  const moduleHotspots: ErrorModuleHotspot[] = [];
  for (const [mk, h] of hotspotMap.entries()) {
    if (h.clients.size === 0 && h.ticketCount === 0 && h.messageCount === 0) {
      continue;
    }
    const meta = SUPPORT_ERROR_MODULES[mk];
    moduleHotspots.push({
      moduleKey: mk,
      label: meta.label,
      shortLabel: meta.shortLabel,
      barColor: meta.barColor,
      badgeClass: meta.badgeClass,
      clientCount: h.clients.size,
      clientNames: Array.from(h.clients.values()),
      messageCount: h.messageCount,
      ticketCount: h.ticketCount,
      reactiveHours: +h.reactiveHours.toFixed(1),
    });
  }
  moduleHotspots.sort(
    (a, b) =>
      b.clientCount - a.clientCount ||
      b.reactiveHours - a.reactiveHours ||
      b.messageCount - a.messageCount,
  );

  // Per-technician summaries ALWAYS across full team data
  const techSummaries: ExecutiveTechSummary[] = [
    'Melvin Rodriguez',
    'Gerson Gutierrez',
  ].map((techName) => {
    const tRecs = input.records.filter((r) => r.techName === techName);
    const tConvs = input.pulse.convMetrics.filter(
      (c) => c.primaryTech === techName,
    );
    const split = computeScopeMetrics(tRecs, tConvs);
    const tClients = buildClientsForScope(tRecs, tConvs);
    const waStats = input.pulse.techChatMetrics[techName];

    return {
      techName,
      buildHours: split.buildHours,
      ticketReactiveHours: split.ticketReactiveHours,
      unloggedChatHours: split.unloggedChatHours,
      totalReactiveHours: split.totalReactiveHours,
      totalHours: split.totalHours,
      buildPct: split.buildPct,
      reactivePct: split.reactivePct,
      openTickets: tRecs.filter(
        (r) => r.status !== 'resolved' && r.status !== 'closed',
      ).length,
      closedTickets: tRecs.filter(
        (r) => r.status === 'resolved' || r.status === 'closed',
      ).length,
      totalTickets: tRecs.length,
      waMessages: waStats?.staffMessages || 0,
      waClients: waStats?.uniqueClientsHelped || 0,
      pingPongCount: tConvs.filter((c) => c.isPingPong).length,
      returningClientsCount: tClients.filter((c) => c.health === 'critical')
        .length,
      inflatedCount: tRecs.filter((r) => r.aiTimeStatus === 'inflated').length,
    };
  });

  const activeClientsCount = unifiedClients.length;
  const returningClientsCount = unifiedClients.filter(
    (c) => c.health === 'critical',
  ).length;
  const returningPct =
    activeClientsCount > 0
      ? Math.round((returningClientsCount / activeClientsCount) * 100)
      : 0;

  const topHotspot = moduleHotspots[0];
  let verdictTone: ExecutiveSupportOverview['totals']['verdictTone'] = 'neutral';
  let verdictTitle = 'Sin actividad registrada en este período.';
  let verdictDetail = 'Cambia el rango de días para ver métricas.';

  if (scopeSplit.totalHours > 0) {
    if (scopeSplit.buildPct >= targetBuildPct) {
      verdictTone = 'good';
      verdictTitle = `En meta: ${scopeSplit.buildPct}% en Mejoras y ${scopeSplit.reactivePct}% en errores`;
      verdictDetail = `El equipo dedicó ${scopeSplit.buildHours}h a construir/mejorar vs ${scopeSplit.totalReactiveHours}h en soporte y chats.`;
    } else if (scopeSplit.buildPct >= 60) {
      verdictTone = 'warn';
      verdictTitle = `Atención: ${scopeSplit.reactivePct}% del tiempo se va en errores y chats (${scopeSplit.totalReactiveHours}h)`;
      verdictDetail = topHotspot
        ? `Mayor foco de fallas: ${topHotspot.label} (${topHotspot.clientCount} clientes). Meta recomendada: ≤${targetReactivePct}% errores.`
        : `Todavía debajo de la meta del ${targetBuildPct}% construyendo producto.`;
    } else {
      verdictTone = 'critical';
      verdictTitle = `Alerta: ${scopeSplit.reactivePct}% del tiempo se pierde apagando fuegos (${scopeSplit.totalReactiveHours}h)`;
      verdictDetail = topHotspot
        ? `Solo ${scopeSplit.buildPct}% en mejoras (${scopeSplit.buildHours}h). Resolver de raíz: ${topHotspot.label} (${topHotspot.clientCount} clientes).`
        : `Solo ${scopeSplit.buildPct}% en mejoras (${scopeSplit.buildHours}h). Hay que frenar regresos post Go-Live.`;
    }
  }

  const internalRecords = scopedRecords.filter((r) => r.isInternalSystemTask);
  const internalHours = +internalRecords
    .reduce((acc, r) => acc + r.reportedHours, 0)
    .toFixed(1);

  return {
    totals: {
      buildHours: scopeSplit.buildHours,
      ticketReactiveHours: scopeSplit.ticketReactiveHours,
      unloggedChatHours: scopeSplit.unloggedChatHours,
      totalReactiveHours: scopeSplit.totalReactiveHours,
      totalHours: scopeSplit.totalHours,
      buildPct: scopeSplit.buildPct,
      reactivePct: scopeSplit.reactivePct,
      targetBuildPct,
      targetReactivePct,
      verdictTone,
      verdictTitle,
      verdictDetail,
      returningClientsCount,
      activeClientsCount,
      returningPct,
      openTicketsCount: scopedRecords.filter(
        (r) => r.status !== 'resolved' && r.status !== 'closed',
      ).length,
    },
    techSummaries,
    moduleHotspots,
    unifiedClients,
    internalDev: {
      count: internalRecords.length,
      totalHours: internalHours,
      records: internalRecords,
    },
  };
}
