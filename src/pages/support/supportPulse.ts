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

export interface PulseTicketInput {
  id: string;
  title?: string | null;
  lead_name?: string | null;
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
  techChatMetrics: Record<string, TechChatMetrics>;
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
  options?: { daysRange?: number; pingPongThreshold?: number; nowMs?: number };
}): SupportPulseResult {
  const nowMs = input.options?.nowMs ?? Date.now();
  const daysRange = Math.max(1, input.options?.daysRange ?? 15);
  const pingPongThreshold = Math.max(4, input.options?.pingPongThreshold ?? 12);

  // Start at midnight El Salvador time (UTC-6 year round) for (daysRange - 1) days ago
  const todayKey = toDayKey(nowMs);
  const [ty, tm, td] = todayKey.split('-').map(Number);
  const todayMidnightSvUtcMs = Date.UTC(ty, tm - 1, td, 6, 0, 0); // 00:00 America/El_Salvador
  const cutoffMs = todayMidnightSvUtcMs - (daysRange - 1) * 24 * 60 * 60 * 1000;
  const maxAllowedMs = nowMs + 60 * 1000;

  // Map canonical support tickets
  const ticketMap = new Map<string, PulseTicketInput>();
  for (const t of input.tickets || []) {
    if (!t?.id) continue;
    const meta = (t.metadata || {}) as Record<string, any>;
    if (meta.merged_into) continue;
    if (/^\s*jornada\s+(melvin|gerson)/i.test(String(t.title || ''))) continue;
    ticketMap.set(t.id, t);
  }

  // Profile indexes
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
    ms: number;
    dayKey: string;
    isStaff: boolean;
    staffName: string | null; // null if client or automated bot
  }

  const events: UnifiedMsgEvent[] = [];
  const usedCommentIds = new Set<string>();
  const outboundWaMsByTicket = new Map<string, number[]>();

  // 1. Primary pass: whatsapp_messages
  for (const m of input.waMessages || []) {
    if (!m || !ticketMap.has(m.ticket_id)) continue;
    const ms = Date.parse(String(m.message_ts || ''));
    if (!Number.isFinite(ms) || ms < cutoffMs || ms > maxAllowedMs) continue;

    if (m.from_me) {
      const arr = outboundWaMsByTicket.get(m.ticket_id) || [];
      arr.push(ms);
      outboundWaMsByTicket.set(m.ticket_id, arr);
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
    const isStaff = Boolean(staffName) || Boolean(m.from_me) || Boolean(linkedComment?.author_id) || commentHasStaffIcon;

    let finalStaffName: string | null = null;
    if (isStaff && !isBot) {
      finalStaffName = staffName || (m.from_me ? 'WhatsApp Soporte' : 'Equipo Soporte');
    }

    events.push({
      ticketId: m.ticket_id,
      ms,
      dayKey: toDayKey(ms),
      isStaff,
      staffName: finalStaffName,
    });
  }

  // 2. Fallback pass: ticket_comments not already represented by whatsapp_messages
  for (const c of input.comments || []) {
    if (!c || c.is_internal || usedCommentIds.has(c.id)) continue;
    if (!ticketMap.has(c.ticket_id)) continue;
    const ms = Date.parse(String(c.created_at || ''));
    if (!Number.isFinite(ms) || ms < cutoffMs || ms > maxAllowedMs) continue;

    const body = String(c.body || '');
    const { isBot, staffName } = resolveStaffFromComment(c);
    const hasStaffMarker = Boolean(staffName) || Boolean(c.author_id) || body.includes('👨‍💻');

    // Echo guard: skip CRM-written outgoing comment if a matching from_me waMessage occurred within +-15s
    if (hasStaffMarker) {
      const outArr = outboundWaMsByTicket.get(c.ticket_id);
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
      ms,
      dayKey: toDayKey(ms),
      isStaff: hasStaffMarker,
      staffName: finalStaffName,
    });
  }

  // Initialize daily calendar buckets (chronological oldest -> newest)
  const dailyMap = new Map<
    string,
    {
      dayKey: string;
      clients: Set<string>;
      totalMessages: number;
      clientMessages: number;
      staffMessages: number;
      estStaffMinutes: number;
      msgsByTicket: Map<string, number>;
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
      msgsByTicket: new Map<string, number>(),
    });
  }

  // Per-ticket & per-staff aggregations
  interface TicketAgg {
    ticketId: string;
    totalMessages: number;
    clientMsgs: number;
    staffMsgs: number;
    lastMsgMs: number;
    dayCounts: Map<string, number>;
    staffCounts: Map<string, number>;
    staffTimestamps: number[];
  }
  const ticketAggMap = new Map<string, TicketAgg>();
  const staffEventsMap = new Map<string, Array<{ ms: number; dayKey: string; ticketId: string }>>();
  const uniqueClientsInPeriod = new Set<string>();

  let totalMessages = 0;
  let clientMessages = 0;
  let staffMessages = 0;

  for (const ev of events) {
    totalMessages += 1;
    if (ev.isStaff) staffMessages += 1;
    else clientMessages += 1;
    uniqueClientsInPeriod.add(ev.ticketId);

    // Daily bucket
    let dBucket = dailyMap.get(ev.dayKey);
    if (!dBucket) {
      dBucket = {
        dayKey: ev.dayKey,
        clients: new Set<string>(),
        totalMessages: 0,
        clientMessages: 0,
        staffMessages: 0,
        estStaffMinutes: 0,
        msgsByTicket: new Map<string, number>(),
      };
      dailyMap.set(ev.dayKey, dBucket);
    }
    dBucket.clients.add(ev.ticketId);
    dBucket.totalMessages += 1;
    if (ev.isStaff) dBucket.staffMessages += 1;
    else dBucket.clientMessages += 1;
    dBucket.msgsByTicket.set(ev.ticketId, (dBucket.msgsByTicket.get(ev.ticketId) || 0) + 1);

    // Ticket bucket
    let tAgg = ticketAggMap.get(ev.ticketId);
    if (!tAgg) {
      tAgg = {
        ticketId: ev.ticketId,
        totalMessages: 0,
        clientMsgs: 0,
        staffMsgs: 0,
        lastMsgMs: ev.ms,
        dayCounts: new Map<string, number>(),
        staffCounts: new Map<string, number>(),
        staffTimestamps: [],
      };
      ticketAggMap.set(ev.ticketId, tAgg);
    }
    tAgg.totalMessages += 1;
    if (ev.isStaff) tAgg.staffMsgs += 1;
    else tAgg.clientMsgs += 1;
    if (ev.ms > tAgg.lastMsgMs) tAgg.lastMsgMs = ev.ms;
    tAgg.dayCounts.set(ev.dayKey, (tAgg.dayCounts.get(ev.dayKey) || 0) + 1);

    if (ev.isStaff && ev.staffName) {
      tAgg.staffCounts.set(ev.staffName, (tAgg.staffCounts.get(ev.staffName) || 0) + 1);
      tAgg.staffTimestamps.push(ev.ms);

      const sList = staffEventsMap.get(ev.staffName) || [];
      sList.push({ ms: ev.ms, dayKey: ev.dayKey, ticketId: ev.ticketId });
      staffEventsMap.set(ev.staffName, sList);
    }
  }

  // Burst-based active chat time per technician & per day
  const techChatMetrics: Record<string, TechChatMetrics> = {};
  const ticketPingPongSet = new Set<string>();

  // Identify ping-pong tickets first
  const pingPongAlerts: PingPongChatAlert[] = [];
  for (const tAgg of ticketAggMap.values()) {
    let peakDayKey = '';
    let peakDayMessages = 0;
    for (const [dk, cnt] of tAgg.dayCounts.entries()) {
      if (cnt > peakDayMessages || (cnt === peakDayMessages && dk > peakDayKey)) {
        peakDayMessages = cnt;
        peakDayKey = dk;
      }
    }
    if (peakDayMessages < pingPongThreshold) continue;

    ticketPingPongSet.add(tAgg.ticketId);
    const ticket = ticketMap.get(tAgg.ticketId)!;

    // Pick primary technician
    let primaryTech = 'WhatsApp Soporte';
    let bestTechCount = -1;
    for (const [name, cnt] of tAgg.staffCounts.entries()) {
      if (cnt > bestTechCount) {
        bestTechCount = cnt;
        primaryTech = name;
      }
    }

    // Burst minutes inside this ticket
    const sortedTs = [...tAgg.staffTimestamps].sort((a, b) => a - b);
    let ticketBurstMin = 0;
    let prevMs: number | null = null;
    for (const ts of sortedTs) {
      if (prevMs === null || ts - prevMs > BURST_GAP_MS) {
        ticketBurstMin += BURST_BASE_MIN;
      } else {
        ticketBurstMin += Math.max(0, (ts - prevMs) / 60000);
      }
      prevMs = ts;
    }

    const entries = extractRootCauseEntries(ticket.metadata);
    pingPongAlerts.push({
      ticketId: tAgg.ticketId,
      circleId: deriveCircleId(ticket),
      clientName: deriveTicketClientName(ticket),
      peakDayKey,
      peakDayLabel: toDayLabel(peakDayKey),
      peakDayMessages,
      totalPeriodMessages: tAgg.totalMessages,
      clientMsgs: tAgg.clientMsgs,
      staffMsgs: tAgg.staffMsgs,
      primaryTech,
      estMinutes: Math.round(ticketBurstMin),
      lastRootCause: entries[0] || null,
      lastMessageAt: new Date(tAgg.lastMsgMs).toISOString(),
    });
  }

  pingPongAlerts.sort(
    (a, b) =>
      b.peakDayMessages - a.peakDayMessages ||
      b.totalPeriodMessages - a.totalPeriodMessages,
  );

  // Build per-tech metrics & credit estStaffMinutes to dailyMap
  let estTotalStaffMinutes = 0;
  for (const [techName, sEvents] of staffEventsMap.entries()) {
    const sorted = [...sEvents].sort((a, b) => a.ms - b.ms);
    let techMinutes = 0;
    let prevMs: number | null = null;
    const uniqueClients = new Set<string>();
    const activeDaysSet = new Set<string>();
    const techPingPongTickets = new Set<string>();

    for (const ev of sorted) {
      uniqueClients.add(ev.ticketId);
      activeDaysSet.add(ev.dayKey);
      if (ticketPingPongSet.has(ev.ticketId)) {
        techPingPongTickets.add(ev.ticketId);
      }
      const deltaMin =
        prevMs === null || ev.ms - prevMs > BURST_GAP_MS
          ? BURST_BASE_MIN
          : Math.max(0, (ev.ms - prevMs) / 60000);
      prevMs = ev.ms;

      techMinutes += deltaMin;
      estTotalStaffMinutes += deltaMin;
      const dBucket = dailyMap.get(ev.dayKey);
      if (dBucket) dBucket.estStaffMinutes += deltaMin;
    }

    const estChatHours = +(techMinutes / 60).toFixed(1);
    const activeDays = activeDaysSet.size;
    techChatMetrics[techName] = {
      techName,
      staffMessages: sorted.length,
      uniqueClientsHelped: uniqueClients.size,
      avgMsgsPerClient: uniqueClients.size > 0 ? +(sorted.length / uniqueClients.size).toFixed(1) : 0,
      pingPongChatsCount: techPingPongTickets.size,
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

  // Root-cause queue & counts across all tickets
  const rcCounts: Record<SupportRootCauseType, number> = {
    system_bug: 0,
    temp_patch: 0,
    client_training: 0,
    external_mh: 0,
  };
  const pendingForDev: RootCauseQueueItem[] = [];
  let resolvedByDevCount = 0;
  let totalTagged = 0;

  for (const ticket of ticketMap.values()) {
    const entries = extractRootCauseEntries(ticket.metadata);
    if (entries.length === 0) continue;
    const clientName = deriveTicketClientName(ticket);
    const circleId = deriveCircleId(ticket);
    const tAgg = ticketAggMap.get(ticket.id);
    const periodMessages = tAgg?.totalMessages || 0;

    for (const entry of entries) {
      const entryMs = Date.parse(entry.at);
      const inRange = Number.isFinite(entryMs) && entryMs >= cutoffMs && entryMs <= maxAllowedMs;
      const isEscalatedDev = entry.type === 'system_bug' || entry.type === 'temp_patch';
      const isPendingDev = isEscalatedDev && !entry.dev_resolved_at;

      if (inRange) {
        rcCounts[entry.type] += 1;
        totalTagged += 1;
        if (entry.dev_resolved_at) resolvedByDevCount += 1;

        const normTech = normalizeStaffDisplayName(entry.by_name);
        if (normTech && techChatMetrics[normTech]) {
          techChatMetrics[normTech].rootCauseCounts[entry.type] += 1;
        }
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
      for (const cnt of d.msgsByTicket.values()) {
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
    techChatMetrics,
    rootCauseQueue: {
      counts: rcCounts,
      pendingForDev,
      resolvedByDevCount,
      totalTagged,
    },
  };
}
