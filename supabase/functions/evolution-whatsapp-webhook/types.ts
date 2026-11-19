export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-evolution-apikey',
};

export const SUPPORT_PHONE = '50379718911';
export const MEDIA_BUCKET = 'whatsapp-media';
export const MEDIA_MAX_ATTEMPTS = 3;
export const MEDIA_RETRY_AFTER_MS = 2 * 60 * 1000;
export const GROUP_SYNC_EVERY_MS = 6 * 60 * 60 * 1000;
// A phone present in a large share of ALL client groups is our own staff (techs/owners
// are added to every group); clients/accountants appear in only a few.
export const STAFF_GROUP_MIN = 5;
export const STAFF_GROUP_SHARE = 0.3;
export const TZ = 'America/El_Salvador';

export type WaScope = 'soporte' | 'por_clasificar' | 'lead' | 'interno' | 'spam';
export type SupportChannelType = 'soporte' | 'contabilidad' | 'ventas' | 'otros';

export const SCOPE_TITLE_TAG: Record<WaScope, string> = {
  soporte: 'Soporte',
  por_clasificar: 'Por clasificar',
  lead: 'Lead',
  interno: 'Equipo',
  spam: 'Spam',
};

export const MEDIA_KINDS: Record<string, 'image' | 'video' | 'audio' | 'document' | 'sticker'> = {
  imageMessage: 'image',
  videoMessage: 'video',
  ptvMessage: 'video',
  audioMessage: 'audio',
  documentMessage: 'document',
  stickerMessage: 'sticker',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function digits(v: unknown): string {
  return String(v || '').replace(/\D/g, '');
}

export function last8(v: unknown): string {
  const d = digits(v);
  return d.length >= 8 ? d.slice(-8) : '';
}

export function jidPhone(jid: string): string {
  return /@(s\.whatsapp\.net|c\.us)$/.test(jid || '') ? digits(jid.split('@')[0]) : '';
}

export function jidLid(jid: string): string {
  return /@lid$/.test(jid || '') ? digits(jid.split('@')[0]) : '';
}

// Only [A-Za-z0-9_-] may ever reach a shell line.
export function shellSafe(v: unknown): string {
  return String(v || '').replace(/[^a-zA-Z0-9_-]/g, '');
}

export function b64Utf8(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

export function fmtTime(d: Date): string {
  return d.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
}

export function normName(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function messageDate(entry: any): Date {
  const raw = entry?.messageTimestamp;
  const n = Number(typeof raw === 'object' && raw !== null ? raw.low : raw);
  if (!Number.isFinite(n) || n <= 0) return new Date();
  const ms = n > 1e12 ? n : n * 1000;
  // Never trust a timestamp in the future (clock skew) or older than 30 days for "now" ordering.
  if (ms > Date.now() + 5 * 60 * 1000) return new Date();
  return new Date(ms);
}
