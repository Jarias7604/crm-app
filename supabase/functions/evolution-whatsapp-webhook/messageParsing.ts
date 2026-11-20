import { MEDIA_KINDS, shellSafe } from './types.ts';

// ─── Message parsing ─────────────────────────────────────────────────────────

export function unwrapMessage(raw: any): any {
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

export function extractMedia(msgObj: any): { field: string; kind: string; obj: any } | null {
  for (const field of Object.keys(MEDIA_KINDS)) {
    if (msgObj?.[field]) return { field, kind: MEDIA_KINDS[field], obj: msgObj[field] };
  }
  return null;
}

export function mediaPlaceholder(kind: string, obj: any): string {
  if (kind === 'image') return '[Imagen enviada por WhatsApp]';
  if (kind === 'audio') return '[Nota de voz enviada por WhatsApp]';
  if (kind === 'video') return '[Video enviado por WhatsApp]';
  if (kind === 'sticker') return '[Sticker enviado por WhatsApp]';
  if (kind === 'document') return `[Documento: ${obj?.fileName || obj?.title || 'Archivo'}]`;
  return '[Archivo]';
}

// Media object without thumbnails/context (keeps the shell line small).
export function slimMediaObject(obj: any): any {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (/thumbnail|contextInfo|scansSidecar|scanLengths|streamingSidecar|waveform/i.test(k)) continue;
    out[k] = v;
  }
  return out;
}

export function extractText(msgObj: any, rawMsgObj: any, entry: any): string {
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

export function guessExt(mime: string, fileName: string): string {
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

export function mediaTypeForSend(mime: string): 'image' | 'video' | 'audio' | 'document' {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'document';
}

// Strip secrets / legacy queues that older versions stored in ticket metadata.
export function cleanMeta(meta: Record<string, any>): Record<string, any> {
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

export interface ChatReadUpdate {
  jid: string;
  altJid: string;
  unreadCount: number;
}

export function extractChatReadUpdates(payload: any): ChatReadUpdate[] {
  const rawData = payload?.data ?? payload;
  const entries: any[] = Array.isArray(rawData)
    ? rawData
    : Array.isArray(rawData?.chats)
    ? rawData.chats
    : rawData && typeof rawData === 'object'
    ? [rawData]
    : [];

  const out: ChatReadUpdate[] = [];
  for (const item of entries) {
    if (!item || typeof item !== 'object') continue;
    const jid = String(item.remoteJid || item.id || item.jid || '').trim();
    if (!jid || jid === 'status@broadcast' || jid.endsWith('@newsletter')) continue;
    const rawUnread = item.unreadCount ?? item.unreadMessages ?? item.unread_count;
    if (typeof rawUnread !== 'number' || !Number.isFinite(rawUnread)) continue;
    const altJid = String(item.remoteJidAlt || item.phoneNumber || item.pn || '').trim();
    out.push({ jid, altJid, unreadCount: rawUnread });
  }
  return out;
}
