import type { Ticket } from '../../../services/tickets';
import type { WaScope, WaAccessMode } from '../../../lib/whatsappScopes';
import type { QuickReplyTemplate } from '../../../services/whatsappSync';

export type { QuickReplyTemplate };

export interface LightClientRow {
  id: string;
  nombre: string;
  contacto?: string | null;
  telefono?: string | null;
}

export type SupportChannelType = 'soporte' | 'contabilidad' | 'ventas' | 'otros';

export type LeadStageSubFilter =
  | 'activos'
  | 'sin_responder'
  | 'conversando'
  | 'perdidos'
  | 'erroneos'
  | 'todos';

export type CircleBucket = 'soporte' | 'por_clasificar' | 'lead' | 'reactivados';

export type SpecialTray = 'interno' | 'spam' | 'tickets';

export type CircleStateFilter = 'unopened' | 'unread' | 'waiting' | 'replied' | 'failed';

export type CircleTeamStatus = 'unopened' | 'seen_waiting' | 'replied' | 'attended' | 'idle';

export interface SupportCircle {
  circleId: string;
  clientName: string;
  pushName: string;
  phone: string;
  whatsappJid: string;
  isWhatsApp: boolean;
  isGroup: boolean;
  scope: WaScope;
  scopeReason: string;
  memberOfGroups: { jid: string; subject: string | null }[];
  leadId: string | null;
  leadStatus: string | null;
  interestedProductId: string | null;
  leadOwnerId: string | null;
  leadOwnerName: string | null;
  activeTicket: Ticket;
  allClientTickets: Ticket[];
  lastFrom: 'client' | 'staff';
  unreadOrWaitingReply: boolean;
  waitMinutes: number;
  syncedReadAt?: string | null;
  syncedForcedUnreadAt?: string | null;
  seenByOtherNames: string[];
  seenByMe: boolean;
  isManuallyAttended: boolean;
  attendedByShortName: string | null;
  repliedByShortName: string | null;
  isForcedUnread: boolean;
  teamStatus: CircleTeamStatus;
  lastMessageText: string;
  lastMessageSender: string;
  lastMessageAt: string;
  assignedTechId: string | null;
  assignedTechName: string;
  categoryCode: string;
  categoryName: string;
  supportChannel: SupportChannelType;
  isReactivation: boolean;
  reactivationCampaign: string | null;
  reactivationReplied: boolean;
  reactivationSentAt: string;
  reactivationTouch: number;
  hoursSinceReactivation: number;
  hasActiveConversation: boolean;
  failedOutboxCount?: number;
}

export interface LeadQuoteSummary {
  id: string;
  plan_nombre: string;
  total_anual: number;
  total_mensual: number;
  estado: string;
  created_at: string;
}

export interface TeamWaAccessMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  role_label: string;
  is_system_admin: boolean;
  access_mode: WaAccessMode;
}

export type OwnerSubFilter = 'all' | 'mine' | 'unassigned' | 'urgent';

export interface WaMessageRow {
  id: string;
  ticket_id: string;
  comment_id: string | null;
  message_type: string;
  media_status: 'none' | 'pending' | 'requested' | 'ready' | 'failed';
  media_path: string | null;
  media_mime: string | null;
  media_filename: string | null;
  media_size: number | null;
  media_error: string | null;
  from_me: boolean;
}

export interface OutboxRow {
  id: string;
  comment_id: string | null;
  status: 'pending' | 'dispatched' | 'sent' | 'error';
  error: string | null;
}

export interface ChatItem {
  id: string;
  kind: 'client' | 'staff' | 'system' | 'ticket';
  senderName: string;
  text: string;
  transcript?: string;
  createdAt: string;
  ticketId: string;
  media?: WaMessageRow & { url?: string };
  legacyMedia?: { url: string; type: 'image' | 'video' | 'file' | 'audio'; name?: string };
  delivery?: OutboxRow['status'];
  deliveryError?: string | null;
  outboxId?: string;
}

export interface WaGroupRow {
  group_jid: string;
  subject: string | null;
  client_id: string | null;
}

export type CircleFilter =
  | 'all'
  | 'unread'
  | 'waiting'
  | 'soporte'
  | 'por_clasificar'
  | 'lead'
  | 'reactivados'
  | 'interno'
  | 'spam'
  | 'tickets';

export interface CachedTicketDescStats {
  rev: string;
  parsedLastLine: { icon: string; sender: string; text: string } | null;
  hasClientLine: boolean;
  staffLineCount: number;
}
