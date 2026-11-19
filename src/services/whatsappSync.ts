import { supabase } from './supabase';

export interface QuickReplyTemplate {
  id: string;
  scope: 'soporte' | 'ventas';
  label: string;
  text: string;
}

export type TicketReadSyncMode = 'read' | 'unread' | 'attended';

export interface EffectiveUnreadInput {
  lastMessageAt: string;
  unreadOrWaitingReply: boolean;
  localReadAt?: string | null;
  syncedReadAt?: string | null;
  localForcedUnreadAt?: string | null;
  syncedForcedUnreadAt?: string | null;
}

const LOCAL_QR_V2_PREFIX = 'crm_wa_quick_replies_v2_';
const LOCAL_QR_V1_PREFIX = 'crm_wa_quick_replies_';
const pendingTicketSyncs = new Map<string, Promise<boolean>>();

function compareTimestamps(a: string, b: string): number {
  const msA = Date.parse(a);
  const msB = Date.parse(b);
  if (Number.isFinite(msA) && Number.isFinite(msB)) {
    return msA === msB ? 0 : msA > msB ? 1 : -1;
  }
  return a === b ? 0 : a > b ? 1 : -1;
}

export function maxIsoTimestamp(a?: string | null, b?: string | null): string {
  const ca = String(a || '').trim();
  const cb = String(b || '').trim();
  if (!ca) return cb;
  if (!cb) return ca;
  return compareTimestamps(ca, cb) >= 0 ? ca : cb;
}

export function normalizeQuickReplyList(raw: unknown): QuickReplyTemplate[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: QuickReplyTemplate[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const id = String(rec.id || '').trim();
    const label = String(rec.label || '').trim();
    const text = String(rec.text || '').trim();
    const scope = rec.scope === 'soporte' || rec.scope === 'ventas' ? rec.scope : null;
    if (!id || !label || !text || !scope || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, scope, label, text });
  }
  return out;
}

export function mergeQuickRepliesWithDefaults(
  remoteRaw: unknown,
  localV2Raw: unknown,
  legacyV1Raw: unknown,
  defaults: QuickReplyTemplate[],
): { replies: QuickReplyTemplate[]; shouldBackfillRemote: boolean } {
  const remote = normalizeQuickReplyList(remoteRaw);
  if (remote.length > 0) {
    return { replies: remote, shouldBackfillRemote: false };
  }

  const localV2 = normalizeQuickReplyList(localV2Raw);
  if (localV2.length > 0) {
    return { replies: localV2, shouldBackfillRemote: true };
  }

  const legacy = normalizeQuickReplyList(legacyV1Raw);
  const merged = normalizeQuickReplyList([...defaults, ...legacy]);
  return {
    replies: merged.length > 0 ? merged : [...defaults],
    shouldBackfillRemote: legacy.length > 0,
  };
}

export function computeEffectiveCircleUnread(input: EffectiveUnreadInput): boolean {
  const effectiveReadAt = maxIsoTimestamp(input.localReadAt, input.syncedReadAt);
  const isMarkedRead = Boolean(
    effectiveReadAt &&
      input.lastMessageAt &&
      compareTimestamps(effectiveReadAt, input.lastMessageAt) >= 0,
  );
  const isForcedUnread =
    (Boolean(input.lastMessageAt) && input.localForcedUnreadAt === input.lastMessageAt) ||
    (Boolean(input.lastMessageAt) &&
      input.syncedForcedUnreadAt === input.lastMessageAt &&
      input.localReadAt !== input.lastMessageAt);

  return isForcedUnread || (input.unreadOrWaitingReply && !isMarkedRead);
}

function capStringTimestampMap(
  rawMap: unknown,
  maxUsers: number,
): Record<string, string> {
  if (!rawMap || typeof rawMap !== 'object' || Array.isArray(rawMap)) return {};
  const entries = Object.entries(rawMap as Record<string, unknown>)
    .map(([k, v]) => [String(k).trim(), String(v || '').trim()] as const)
    .filter(([k, v]) => Boolean(k) && Boolean(v))
    .sort((a, b) => compareTimestamps(b[1], a[1]))
    .slice(0, Math.max(1, maxUsers));
  return Object.fromEntries(entries);
}

export function buildReadStateMetadataPatch(
  currentMeta: Record<string, any> | null | undefined,
  userId: string,
  mode: TicketReadSyncMode,
  lastMessageAt: string,
  maxUsers = 25,
): Record<string, any> {
  const nextMeta: Record<string, any> = { ...(currentMeta || {}) };
  const cleanUserId = String(userId || '').trim();
  const cleanTs = String(lastMessageAt || '').trim() || new Date().toISOString();

  const waReadBy = capStringTimestampMap(nextMeta.wa_read_by, maxUsers + 5);
  const waForcedUnreadBy = capStringTimestampMap(nextMeta.wa_forced_unread_by, maxUsers + 5);

  if (cleanUserId) {
    if (mode === 'read' || mode === 'attended') {
      waReadBy[cleanUserId] = maxIsoTimestamp(waReadBy[cleanUserId], cleanTs);
      delete waForcedUnreadBy[cleanUserId];
    } else if (mode === 'unread') {
      delete waReadBy[cleanUserId];
      waForcedUnreadBy[cleanUserId] = cleanTs;
    }
  }

  if (mode === 'attended') {
    const prevAttended = typeof nextMeta.wa_attended_at === 'string' ? nextMeta.wa_attended_at : '';
    nextMeta.wa_attended_at = maxIsoTimestamp(prevAttended, cleanTs);
  } else if (mode === 'unread') {
    delete nextMeta.wa_attended_at;
  }

  const cappedReadBy = capStringTimestampMap(waReadBy, maxUsers);
  const cappedForcedUnread = capStringTimestampMap(waForcedUnreadBy, maxUsers);

  if (Object.keys(cappedReadBy).length > 0) {
    nextMeta.wa_read_by = cappedReadBy;
  } else {
    delete nextMeta.wa_read_by;
  }

  if (Object.keys(cappedForcedUnread).length > 0) {
    nextMeta.wa_forced_unread_by = cappedForcedUnread;
  } else {
    delete nextMeta.wa_forced_unread_by;
  }

  return nextMeta;
}

function readJsonLocalStorage(key: string): unknown {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJsonLocalStorage(key: string, value: unknown): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage quota errors
  }
}

export function readLocalQuickReplies(
  companyId: string,
  defaults: QuickReplyTemplate[],
): QuickReplyTemplate[] {
  const localV2 = readJsonLocalStorage(`${LOCAL_QR_V2_PREFIX}${companyId}`);
  const v2List = normalizeQuickReplyList(localV2);
  if (v2List.length > 0) return v2List;

  const legacyV1 = readJsonLocalStorage(`${LOCAL_QR_V1_PREFIX}${companyId}`);
  const legacyList = normalizeQuickReplyList(legacyV1);
  const merged = normalizeQuickReplyList([...defaults, ...legacyList]);
  return merged.length > 0 ? merged : [...defaults];
}

export async function saveCompanyQuickReplies(
  companyId: string,
  replies: QuickReplyTemplate[],
): Promise<boolean> {
  if (!companyId) return false;
  const cleanReplies = normalizeQuickReplyList(replies);
  writeJsonLocalStorage(`${LOCAL_QR_V2_PREFIX}${companyId}`, cleanReplies);

  try {
    const { data, error: readErr } = await supabase
      .from('companies')
      .select('features')
      .eq('id', companyId)
      .maybeSingle();
    if (readErr) return false;

    const currentFeatures =
      data?.features && typeof data.features === 'object' && !Array.isArray(data.features)
        ? (data.features as Record<string, unknown>)
        : {};

    const { error: updateErr } = await supabase
      .from('companies')
      .update({
        features: {
          ...currentFeatures,
          wa_quick_replies: cleanReplies,
        },
      })
      .eq('id', companyId);

    return !updateErr;
  } catch {
    return false;
  }
}

export async function loadCompanyQuickReplies(
  companyId: string,
  defaults: QuickReplyTemplate[],
): Promise<QuickReplyTemplate[]> {
  if (!companyId) return [...defaults];

  const localV2 = readJsonLocalStorage(`${LOCAL_QR_V2_PREFIX}${companyId}`);
  const legacyV1 = readJsonLocalStorage(`${LOCAL_QR_V1_PREFIX}${companyId}`);

  try {
    const { data, error } = await supabase
      .from('companies')
      .select('features')
      .eq('id', companyId)
      .maybeSingle();

    if (error) {
      return readLocalQuickReplies(companyId, defaults);
    }

    const remoteRaw =
      data?.features && typeof data.features === 'object' && !Array.isArray(data.features)
        ? (data.features as Record<string, unknown>).wa_quick_replies
        : null;

    const { replies, shouldBackfillRemote } = mergeQuickRepliesWithDefaults(
      remoteRaw,
      localV2,
      legacyV1,
      defaults,
    );

    writeJsonLocalStorage(`${LOCAL_QR_V2_PREFIX}${companyId}`, replies);

    if (shouldBackfillRemote) {
      void saveCompanyQuickReplies(companyId, replies);
    }

    return replies;
  } catch {
    return readLocalQuickReplies(companyId, defaults);
  }
}

export function syncTicketReadState(
  ticketId: string,
  userId: string,
  mode: TicketReadSyncMode,
  lastMessageAt: string,
): Promise<boolean> {
  if (!ticketId || !userId) return Promise.resolve(false);

  const prev = pendingTicketSyncs.get(ticketId) || Promise.resolve(true);
  const run = prev
    .catch(() => false)
    .then(async () => {
      try {
        const { data, error: readErr } = await supabase
          .from('tickets')
          .select('metadata')
          .eq('id', ticketId)
          .maybeSingle();
        if (readErr) return false;

        const nextMeta = buildReadStateMetadataPatch(
          (data?.metadata || {}) as Record<string, any>,
          userId,
          mode,
          lastMessageAt,
        );

        const { error: updateErr } = await supabase
          .from('tickets')
          .update({ metadata: nextMeta })
          .eq('id', ticketId);

        return !updateErr;
      } catch {
        return false;
      }
    })
    .finally(() => {
      if (pendingTicketSyncs.get(ticketId) === run) {
        pendingTicketSyncs.delete(ticketId);
      }
    });

  pendingTicketSyncs.set(ticketId, run);
  return run;
}
