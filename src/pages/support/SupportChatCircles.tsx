import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  Search,
  Plus,
  Send,
  Mic,
  CheckCheck,
  Check,
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  Clock,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Phone,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Settings,
  X,
  MessageSquare,
  FileBadge2,
  Users,
  Building2,
  UserPlus,
  Wrench,
  Calculator,
  DollarSign,
  Package,
  FolderOpen,
  Bot,
  FileText,
  Download,
  Ban,
  HelpCircle,
  ShieldCheck,
  Tag,
  ExternalLink,
  Loader2,
  ImageOff,
  Paperclip,
  StickyNote,
  Receipt,
  Flame,
  User,
  Filter,
  Zap,
  MoreHorizontal,
  Calendar,
  Pencil,
  Trash2,
  Target,
  Video,
  RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { LiveDemoHUDModal, parseAriasAnswersFromNotes } from '../../components/leads/LiveDemoHUDModal';
import NewFollowUpModal from '../../components/NewFollowUpModal';
import GoogleMeetScheduler from '../../components/GoogleMeetScheduler';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { cotizacionesService } from '../../services/cotizaciones';
import { pdfService } from '../../services/pdfService';
import { bookingService } from '../../services/bookingService';
import {
  ticketService,
  computeTicketAiTimeBenchmark,
  type Ticket,
  type TicketCategory,
  type TicketComment,
  type CompanyAgent,
  type TicketLead,
} from '../../services/tickets';
import { clientsService } from '../../services/clients';
import type { Client } from '../../types/clients';
import {
  getWaViewerScopes,
  getWaScope,
  isWhatsappTicket,
  WA_SCOPE_LABELS,
  WA_ACCESS_MODE_OPTIONS,
  type WaScope,
  type WaAccessMode,
} from '../../lib/whatsappScopes';

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Strip all emoji characters so UI uses 100% vector icons only
function stripEmojis(text: string): string {
  return (text || '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{2702}-\u{27B0}]/gu, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

const TZ = 'America/El_Salvador';

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
}

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
}

function dayLabel(iso: string): string {
  const k = dayKey(iso);
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86400000).toISOString());
  if (k === today) return 'Hoy';
  if (k === yesterday) return 'Ayer';
  return new Date(iso).toLocaleDateString('es-SV', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: k.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric',
    timeZone: TZ,
  });
}

function listTimeLabel(iso: string): string {
  return dayKey(iso) === dayKey(new Date().toISOString()) ? fmtTime(iso) : dayLabel(iso);
}

function initials(name: string): string {
  return (
    stripEmojis(name)
      .replace(/\(\+?[\d\s-]+\)/g, '')
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  );
}

function formatBytes(n?: number | null): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export type SupportChannelType = 'soporte' | 'contabilidad' | 'ventas' | 'otros';

const SUPPORT_CHANNEL_LABELS: Record<SupportChannelType, string> = {
  soporte: 'Soporte / Operaciones',
  contabilidad: 'Contabilidad / Finanzas',
  ventas: 'Ventas / Cotizaciones',
  otros: 'Otros / General',
};

const DEFAULT_PROMPTS: Record<SupportChannelType, string> = {
  soporte:
    'Eres el Asistente IA de Soporte y Operaciones de nuestra empresa. Lee o escucha lo que el cliente reportó y respóndele de forma amable, clara y resolutiva en máximo 3 líneas por WhatsApp. Confírmale que entendiste su solicitud y pídele captura de pantalla, foto o detalle adicional si requiere revisión.',
  contabilidad:
    'Eres el Asistente IA del Área Contable, Facturación y Finanzas. Lee o escucha la consulta del cliente y respóndele de forma profesional, precisa y amable en máximo 3 líneas por WhatsApp. Si necesita revisión de algún estado de cuenta, factura o reporte, pídele el período o comprobante para validarlo.',
  ventas:
    'Eres el Asesor Comercial IA de nuestra empresa. El prospecto está consultando por precios, planes, catálogo o cotización. Respóndele con entusiasmo, cortesía y enfoque comercial en máximo 3 líneas por WhatsApp: infórmale que contamos con opciones adaptadas a su necesidad y pregúntale su giro o requerimiento principal para enviarle su cotización formal o agendar una demostración.',
  otros:
    'Eres el Asistente IA de Atención al Cliente. Lee o escucha el mensaje del cliente y respóndele de forma cortés, clara y servicial en máximo 3 líneas por WhatsApp, confirmando que recibimos su consulta y canalizándola con el especialista correspondiente.',
};

export interface QuickReplyTemplate {
  id: string;
  scope: 'soporte' | 'ventas';
  label: string;
  text: string;
}

const DEFAULT_SUPPORT_QUICK_REPLIES: QuickReplyTemplate[] = [
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

const DEFAULT_SALES_QUICK_REPLIES: QuickReplyTemplate[] = [
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

const LEAD_STATUS_OPTIONS = [
  'Prospecto',
  'Llamada fría',
  'En Nutrición',
  'Lead calificado',
  'En seguimiento',
  'Negociación',
  'Cerrado',
  'Perdido',
  'Erróneo',
] as const;

type LeadStageSubFilter = 'activos' | 'conversando' | 'perdidos' | 'erroneos' | 'todos';

// Web Audio API synthesizer — zero external audio files, works across all modern browsers.
let sharedAudioCtx: AudioContext | null = null;
function getUnlockedAudioCtx(): AudioContext | null {
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

function formatWaitDuration(mins: number): string {
  if (mins <= 1) return '1m';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

// Internal developer/system task titles that are NOT clients (legacy non-WhatsApp tickets).
function isInternalDevOrSystemTaskTitle(rawTitle: string): boolean {
  const clean = stripEmojis(rawTitle || '').toLowerCase();
  return /^(importaci[oó]n de proveedores|estandarizar dise[ñn]o|actualizar precios de mayoreo|importar precios por mayoreo|ajustes de estilos|estilos cotizacion|cotizaciones:\s*(personas|quitar)|cotizaciones\s+2\s*hours|revisi[oó]n de cambios normativa|apertura de gaveta de dinero|faq erp\b|nota de remisi[oó]n\b|factura de exportaci[oó]n\b|pos\s*1\b|jornada\s+(melvin|gerson)|comunicado oficial|libro de iva para mantenimientos)/i.test(
    clean
  );
}

// Client name for legacy (non-WhatsApp) support tickets.
function extractLegacyClientName(t: Ticket): string {
  if (t.lead_name && t.lead_name.trim().length > 1) {
    return stripEmojis(t.lead_name.replace(/\(\+\d+\)/g, '').trim());
  }
  const colonMatch = (t.title || '').match(
    /^(?:soporte\s+t[eé]cnico|error(?:\s+en\s+json)?\s+reportado|capacitaci[oó]n(?:\s+presencial)?|pregunta\s+frecuente|go\s*live|solicitud(?:\s+de\s+cliente)?)\s*:\s*([^-\n(|]+)/i
  );
  if (colonMatch && colonMatch[1]) return stripEmojis(colonMatch[1].trim());
  return stripEmojis(t.title || 'Cliente Soporte');
}

function detectShortCategory(catName: string, title: string): { code: string; name: string; color: string } {
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

const SCOPE_STYLE: Record<WaScope, { avatar: string; chip: string; icon: React.ElementType }> = {
  soporte: { avatar: 'bg-slate-100 text-slate-700', chip: 'bg-slate-100 text-slate-600 border-slate-200/80', icon: Building2 },
  por_clasificar: { avatar: 'bg-amber-50 text-amber-700', chip: 'bg-amber-50 text-amber-800 border-amber-200/80', icon: HelpCircle },
  lead: { avatar: 'bg-indigo-50 text-indigo-700', chip: 'bg-slate-100 text-slate-600 border-slate-200/80', icon: UserPlus },
  interno: { avatar: 'bg-slate-100 text-slate-600', chip: 'bg-slate-100 text-slate-600 border-slate-200/80', icon: ShieldCheck },
  spam: { avatar: 'bg-rose-50 text-rose-600', chip: 'bg-rose-50 text-rose-700 border-rose-200/80', icon: Ban },
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface SupportCircle {
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
  leadOwnerId: string | null;
  leadOwnerName: string | null;
  activeTicket: Ticket;
  allClientTickets: Ticket[];
  unreadOrWaitingReply: boolean;
  waitMinutes: number;
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
  hasActiveConversation: boolean;
}

interface LeadQuoteSummary {
  id: string;
  plan_nombre: string;
  total_anual: number;
  total_mensual: number;
  estado: string;
  created_at: string;
}

interface TeamWaAccessMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  role_label: string;
  is_system_admin: boolean;
  access_mode: WaAccessMode;
}

type OwnerSubFilter = 'all' | 'mine' | 'unassigned' | 'urgent';

interface WaMessageRow {
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

interface OutboxRow {
  id: string;
  comment_id: string | null;
  status: 'pending' | 'dispatched' | 'sent' | 'error';
  error: string | null;
}

interface ChatItem {
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
}

interface WaGroupRow {
  group_jid: string;
  subject: string | null;
  client_id: string | null;
}

type CircleFilter = 'all' | 'waiting' | 'soporte' | 'por_clasificar' | 'lead' | 'reactivados' | 'interno' | 'spam' | 'tickets';

// Parse "[10:42 a. m.] 👤 Nombre: texto" chat lines written by the webhook.
function parseChatLine(raw: string): { icon: string; sender: string; text: string } | null {
  const m = raw.match(/^\[([^\]]+)\]\s*(👤|👨‍💻)?\s*([^:\n]+):\s*([\s\S]*)$/);
  if (!m) return null;
  return { icon: m[2] || '', sender: m[3].trim(), text: m[4] };
}

// =============================================================================

export const SupportChatCircles: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { profile, simulatedCompanyId } = useAuth();
  const activeCompanyId = simulatedCompanyId || profile?.company_id;
  const isRealAdmin = Boolean(
    profile?.is_platform_owner === true ||
      profile?.role === 'super_admin' ||
      profile?.role === 'company_admin' ||
      (profile?.permissions as any)?.wa_chat_all === true ||
      (profile?.permissions as any)?.wa_access_mode === 'admin_all'
  );
  const [adminPreviewMode, setAdminPreviewMode] = useState<WaAccessMode | null>(null);
  const scopes = useMemo(() => getWaViewerScopes(profile as any, adminPreviewMode), [profile, adminPreviewMode]);

  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [agents, setAgents] = useState<CompanyAgent[]>([]);
  const [realClients, setRealClients] = useState<Client[]>([]);
  const [companyLeads, setCompanyLeads] = useState<TicketLead[]>([]);
  const [waGroups, setWaGroups] = useState<WaGroupRow[]>([]);
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(() => {
    const stateCircleId = (location.state as any)?.waCircleId;
    if (stateCircleId) return String(stateCircleId);
    const jid = searchParams.get('jid');
    return jid ? `wa:${jid}` : null;
  });

  // Thread (all tickets of the selected chat)
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [waMessages, setWaMessages] = useState<WaMessageRow[]>([]);
  const [outboxRows, setOutboxRows] = useState<OutboxRow[]>([]);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [loadingComments, setLoadingComments] = useState(false);

  const [readCirclesMap, setReadCirclesMap] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('crm_circles_read_map') || '{}');
    } catch {
      return {};
    }
  });
  const [forcedUnreadMap, setForcedUnreadMap] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('crm_circles_forced_unread') || '{}');
    } catch {
      return {};
    }
  });
  const markCircleAsRead = (circleId: string, lastMessageAt: string) => {
    setReadCirclesMap((prev) => {
      if (prev[circleId] === lastMessageAt) return prev;
      const next = { ...prev, [circleId]: lastMessageAt };
      try {
        localStorage.setItem('crm_circles_read_map', JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
    setForcedUnreadMap((prev) => {
      if (!prev[circleId]) return prev;
      const next = { ...prev };
      delete next[circleId];
      try {
        localStorage.setItem('crm_circles_forced_unread', JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  };

  const [dismissedWaitingMap, setDismissedWaitingMap] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('crm_wa_dismissed_waiting') || '{}');
    } catch {
      return {};
    }
  });
  const handleMarkCircleAttended = async (circle: SupportCircle) => {
    markCircleAsRead(circle.circleId, circle.lastMessageAt);
    setDismissedWaitingMap((prev) => {
      const next = { ...prev, [circle.circleId]: circle.lastMessageAt };
      try {
        localStorage.setItem('crm_wa_dismissed_waiting', JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
    try {
      const currentMeta = (circle.activeTicket.metadata || {}) as Record<string, any>;
      await supabase
        .from('tickets')
        .update({
          metadata: {
            ...currentMeta,
            wa_attended_at: circle.lastMessageAt,
          },
        })
        .eq('id', circle.activeTicket.id);
      toast.success('Conversación marcada como atendida');
      loadSupportData(true);
    } catch {
      toast.success('Marcado como atendido');
    }
  };

  const handleMarkCircleUnread = async (circle: SupportCircle) => {
    setReadCirclesMap((prev) => {
      const next = { ...prev };
      delete next[circle.circleId];
      try {
        localStorage.setItem('crm_circles_read_map', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    setDismissedWaitingMap((prev) => {
      const next = { ...prev };
      delete next[circle.circleId];
      try {
        localStorage.setItem('crm_wa_dismissed_waiting', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    setForcedUnreadMap((prev) => {
      const next = { ...prev, [circle.circleId]: circle.lastMessageAt };
      try {
        localStorage.setItem('crm_circles_forced_unread', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    try {
      const currentMeta = (circle.activeTicket.metadata || {}) as Record<string, any>;
      if (currentMeta.wa_attended_at) {
        const nextMeta = { ...currentMeta };
        delete nextMeta.wa_attended_at;
        await supabase
          .from('tickets')
          .update({ metadata: nextMeta })
          .eq('id', circle.activeTicket.id);
      }
      loadSupportData(true);
    } catch {
      // ignore
    }
    toast.success('Conversación marcada como No leída');
  };

  const [searchQuery, setSearchQuery] = useState('');
  const defaultFilter: CircleFilter =
    searchParams.get('filter') === 'reactivados'
      ? 'reactivados'
      : scopes.all
      ? 'all'
      : scopes.soporte && !scopes.leads
      ? 'soporte'
      : scopes.leads && !scopes.soporte
      ? 'por_clasificar'
      : 'all';
  const [circleFilter, setCircleFilter] = useState<CircleFilter>(defaultFilter);
  const [ownerFilter, setOwnerFilter] = useState<OwnerSubFilter>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | SupportChannelType>('all');
  const [leadSubFilter, setLeadSubFilter] = useState<LeadStageSubFilter>('activos');

  const [messageInput, setMessageInput] = useState('');
  const [composerMode, setComposerMode] = useState<'whatsapp' | 'internal'>('whatsapp');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientPickerQuery, setClientPickerQuery] = useState('');
  const [showReclassifyMenu, setShowReclassifyMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showQuickRepliesPopover, setShowQuickRepliesPopover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Alarm & Notification Center (Bell)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('crm_wa_sound_enabled') !== 'false';
  });
  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('crm_wa_sound_enabled', String(next));
      if (next) playWaAlertSound('test');
      return next;
    });
  };
  const [showAlertsPopover, setShowAlertsPopover] = useState(false);
  const [alertAreaFilter, setAlertAreaFilter] = useState<'all' | 'ventas' | 'soporte'>('all');
  const [bellRinging, setBellRinging] = useState(false);
  const [slaTick, setSlaTick] = useState(0);
  const prevLastMsgRef = useRef<Record<string, string>>({});
  const initialLoadedRef = useRef(false);

  // Team WhatsApp Access & Role Control Modal (Admin)
  const [showTeamAccessModal, setShowTeamAccessModal] = useState(false);
  const [teamAccessList, setTeamAccessList] = useState<TeamWaAccessMember[]>([]);
  const [loadingTeamAccess, setLoadingTeamAccess] = useState(false);
  const [savingUserAccessId, setSavingUserAccessId] = useState<string | null>(null);

  // Quotes & Lead management inside chat
  const [leadQuotes, setLeadQuotes] = useState<LeadQuoteSummary[]>([]);
  const [showQuotesPopover, setShowQuotesPopover] = useState(false);
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [pendingQuoteId, setPendingQuoteId] = useState<string | null>(() => (location.state as any)?.newWaQuoteId || null);
  const [sendingQuotePdfId, setSendingQuotePdfId] = useState<string | null>(null);
  const [myBookingSlug, setMyBookingSlug] = useState<string>('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState<string>('');
  const [savingCommentEdit, setSavingCommentEdit] = useState<boolean>(false);

  // Discovery (Método ARIAS 7 Preguntas) & Post-Quote Follow-Up inside chat
  const [showDiscoveryPopover, setShowDiscoveryPopover] = useState<boolean>(false);
  const [showDiscoveryHUD, setShowDiscoveryHUD] = useState<boolean>(false);
  const [postQuoteFollowupCircleId, setPostQuoteFollowupCircleId] = useState<string | null>(null);
  const [schedulingFollowup, setSchedulingFollowup] = useState<boolean>(false);
  const [showCalendarPopover, setShowCalendarPopover] = useState<boolean>(false);
  const [showNewFollowUpModal, setShowNewFollowUpModal] = useState<boolean>(false);
  const [showMeetSchedulerModal, setShowMeetSchedulerModal] = useState<boolean>(false);
  const [showStagePopover, setShowStagePopover] = useState<boolean>(false);

  // Handle return from CotizadorPro with active chat & newly generated quote
  useEffect(() => {
    const st = (location.state || {}) as { waCircleId?: string; newWaQuoteId?: string };
    if (st.waCircleId) {
      setSelectedCircleId(st.waCircleId);
    }
    if (st.newWaQuoteId) {
      setPendingQuoteId(st.newWaQuoteId);
    }
    if (st.waCircleId || st.newWaQuoteId) {
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  // Load or auto-provision the salesperson's booking link slug (/book/:slug)
  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const rawName =
          profile.full_name && !/^platform\s*owner$/i.test(profile.full_name.trim())
            ? profile.full_name.trim()
            : 'Jimmy Arias';
        const cleanSlug = `${bookingService.slugify(rawName)}-${profile.id.slice(0, 4)}`;
        const existing = await bookingService.getMyBookingLink();
        if (cancelled) return;
        if (existing?.slug && !existing.slug.startsWith('platform-owner')) {
          setMyBookingSlug(existing.slug);
          return;
        }
        const saved = await bookingService.upsertBookingLink({
          ...(existing?.id ? { id: existing.id } : {}),
          slug: cleanSlug,
          display_name: rawName,
          title: 'Revisión de Propuesta Comercial',
          description: 'Sesión breve para revisar los detalles de su cotización y resolver cualquier consulta.',
          duration_minutes: 30,
          is_active: true,
        });
        if (!cancelled && saved?.slug) {
          setMyBookingSlug(saved.slug);
        }
      } catch {
        // Fallback if offline or table unavailable
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id, profile?.full_name]);

  // Customizable SaaS Quick Replies per company (all templates editable & deletable)
  const [customQuickReplies, setCustomQuickReplies] = useState<QuickReplyTemplate[]>([
    ...DEFAULT_SALES_QUICK_REPLIES,
    ...DEFAULT_SUPPORT_QUICK_REPLIES,
  ]);
  const [showQuickReplyModal, setShowQuickReplyModal] = useState(false);
  const [newQrLabel, setNewQrLabel] = useState('');
  const [newQrText, setNewQrText] = useState('');
  const [newQrScope, setNewQrScope] = useState<'soporte' | 'ventas'>('ventas');
  const [editingQrId, setEditingQrId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCompanyId) return;
    try {
      const v2Key = `crm_wa_quick_replies_v2_${activeCompanyId}`;
      const savedV2 = localStorage.getItem(v2Key);
      if (savedV2) {
        const parsed = JSON.parse(savedV2);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCustomQuickReplies(parsed);
          return;
        }
      }
      // Migrate any legacy v1 custom templates alongside defaults
      const legacy = localStorage.getItem(`crm_wa_quick_replies_${activeCompanyId}`);
      const legacyArr: QuickReplyTemplate[] = legacy ? JSON.parse(legacy) : [];
      const merged = [...DEFAULT_SALES_QUICK_REPLIES, ...DEFAULT_SUPPORT_QUICK_REPLIES, ...legacyArr];
      setCustomQuickReplies(merged);
      localStorage.setItem(v2Key, JSON.stringify(merged));
    } catch {
      setCustomQuickReplies([...DEFAULT_SALES_QUICK_REPLIES, ...DEFAULT_SUPPORT_QUICK_REPLIES]);
    }
  }, [activeCompanyId]);

  const saveCustomQuickReplies = (next: QuickReplyTemplate[]) => {
    setCustomQuickReplies(next);
    if (activeCompanyId) {
      try {
        localStorage.setItem(`crm_wa_quick_replies_v2_${activeCompanyId}`, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
    }
  };

  // Unlock Web Audio on first user interaction so alarms always sound
  useEffect(() => {
    const unlock = () => {
      getUnlockedAudioCtx();
    };
    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Tick every 30s to keep SLA wait minutes fresh
  useEffect(() => {
    const t = window.setInterval(() => setSlaTick((x) => x + 1), 30000);
    return () => window.clearInterval(t);
  }, []);

  const [activeChatSeconds, setActiveChatSeconds] = useState(0);
  const [showRightPanel, setShowRightPanel] = useState(false);

  // Resizable left column
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem('crm_circles_left_width'));
    return saved >= 260 && saved <= 750 ? saved : 400;
  });
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const resizeStartXRef = useRef<number>(0);
  const resizeStartWidthRef = useRef<number>(380);
  useEffect(() => {
    if (!isResizingLeft) return;
    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartXRef.current;
      const nextWidth = Math.min(720, Math.max(260, resizeStartWidthRef.current + delta));
      setLeftPanelWidth(nextWidth);
      localStorage.setItem('crm_circles_left_width', String(nextWidth));
    };
    const handleMouseUp = () => {
      setIsResizingLeft(false);
      document.body.style.cursor = '';
    };
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingLeft]);

  const [showHistoryAccordion, setShowHistoryAccordion] = useState(false);
  const [savingResolution, setSavingResolution] = useState(false);
  const [resForm, setResForm] = useState({
    actual_hours: '',
    findings: '',
    root_cause: '',
    solution: '',
    time_justification: '',
  });

  // WhatsApp connection status (admin)
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<Record<string, any> | null>(null);

  // AI auto-responder settings (admin)
  const [showAiPromptModal, setShowAiPromptModal] = useState(false);
  const [activePromptTab, setActivePromptTab] = useState<SupportChannelType>('soporte');
  const [aiAutoReplyText, setAiAutoReplyText] = useState(false);
  const [aiAutoReplyAudio, setAiAutoReplyAudio] = useState(false);
  const [aiPrompts, setAiPrompts] = useState<Record<SupportChannelType, string>>({ ...DEFAULT_PROMPTS });
  const [openAiStatus, setOpenAiStatus] = useState({ checking: true, verified: false, model: 'gpt-4o-mini', error: '' });
  const [savingAiConfig, setSavingAiConfig] = useState(false);

  const invoke = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('evolution-whatsapp-webhook', { body });
    if (error) {
      // supabase-js wraps non-2xx responses; surface the server's message.
      let msg = error.message;
      try {
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === 'function') {
          const j = await ctx.json();
          if (j?.error) msg = j.error;
        }
      } catch {
        // keep generic message
      }
      throw new Error(msg);
    }
    if (data && data.ok === false) throw new Error(data.error || 'Error');
    return data;
  };

  const verifyAndLoadAiConfig = async (showToast = false) => {
    setOpenAiStatus((p) => ({ ...p, checking: true }));
    try {
      const data = await invoke({ action: 'get_ai_config' });
      setOpenAiStatus({
        checking: false,
        verified: Boolean(data.openai_verified),
        model: data.openai_model || 'gpt-4o-mini',
        error: data.openai_error || '',
      });
      if (typeof data.auto_reply_text === 'boolean') setAiAutoReplyText(data.auto_reply_text);
      if (typeof data.auto_reply_audio === 'boolean') setAiAutoReplyAudio(data.auto_reply_audio);
      if (data.prompts) {
        setAiPrompts({
          soporte: data.prompts.soporte || DEFAULT_PROMPTS.soporte,
          contabilidad: data.prompts.contabilidad || DEFAULT_PROMPTS.contabilidad,
          ventas: data.prompts.ventas || DEFAULT_PROMPTS.ventas,
          otros: data.prompts.otros || DEFAULT_PROMPTS.otros,
        });
      }
      if (showToast) {
        if (data.openai_verified) toast.success(`OpenAI conectado (${data.openai_model || 'gpt-4o-mini'} + Whisper)`);
        else toast.error(`OpenAI no respondió: ${data.openai_error || 'Verificar API Key'}`);
      }
    } catch (e: any) {
      setOpenAiStatus({ checking: false, verified: false, model: 'gpt-4o-mini', error: e?.message || 'Error al verificar' });
    }
  };

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadSupportData = useCallback(
    async (silent = false) => {
      if (!activeCompanyId) return;
      if (!silent) setLoading(true);
      try {
        const [tks, cats, ags, cls, lds, grps] = await Promise.all([
          ticketService.getTickets(activeCompanyId, { includeNonSupportWhatsapp: true }),
          ticketService.getCategories(activeCompanyId).catch(() => [] as TicketCategory[]),
          ticketService.getAgents(activeCompanyId).catch(() => [] as CompanyAgent[]),
          clientsService.getAll({ companyId: activeCompanyId }).catch(() => [] as Client[]),
          ticketService.getLeads(activeCompanyId).catch(() => [] as TicketLead[]),
          supabase
            .from('whatsapp_groups')
            .select('group_jid, subject, client_id')
            .eq('company_id', activeCompanyId)
            .then((r) => (r.data || []) as WaGroupRow[]),
        ]);
        setTickets(tks);
        setCategories(cats);
        setAgents(ags);
        setRealClients(cls);
        setCompanyLeads(lds);
        setWaGroups(grps);
      } catch (err) {
        console.error('[SupportChatCircles] Error loading:', err);
        if (!silent) toast.error('No se pudieron cargar los chats');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [activeCompanyId]
  );

  useEffect(() => {
    if (activeCompanyId && scopes.any) {
      loadSupportData();
      if (scopes.all) verifyAndLoadAiConfig(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompanyId, scopes.any]);

  // ── Circles (one per WhatsApp chat; legacy tickets grouped by client) ─────
  const circles = useMemo<SupportCircle[]>(() => {
    const catMap = new Map<string, TicketCategory>();
    categories.forEach((c) => catMap.set(c.id, c));
    const agentMap = new Map<string, string>();
    agents.forEach((a) => agentMap.set(a.id, a.full_name || a.email));
    const leadMap = new Map<string, TicketLead & { assigned_to?: string | null }>();
    companyLeads.forEach((l) => leadMap.set(l.id, l as any));
    const clientNames = new Set(realClients.map((c) => (c.nombre || '').trim().toLowerCase()).filter(Boolean));

    const groupMap = new Map<string, Ticket[]>();
    tickets.forEach((t) => {
      if (isInternalDevOrSystemTaskTitle(t.title || '')) return;
      const meta = (t.metadata || {}) as Record<string, any>;
      if (meta.merged_into) return;
      let key: string;
      if (isWhatsappTicket(t)) {
        key = `wa:${meta.whatsapp_jid || meta.whatsapp_phone || t.id}`;
      } else {
        // Legacy support tickets (not WhatsApp): only for people who handle support.
        if (!scopes.soporte) return;
        const clientName = extractLegacyClientName(t);
        const hasExplicitClientColon =
          /^(?:soporte\s+t[eé]cnico|error\s+reportado|capacitaci[oó]n(?:\s+presencial)?|pregunta\s+frecuente|go\s*live|solicitud(?:\s+de\s+cliente)?)\s*:/i.test(
            t.title || ''
          );
        const hasLeadRef = Boolean(t.lead_id) || Boolean(t.lead_name && t.lead_name.trim().length > 1);
        const inClientDb = clientNames.has(clientName.toLowerCase());
        if (isInternalDevOrSystemTaskTitle(clientName)) return;
        if (clientName.length > 38 && !inClientDb) return;
        if (!hasExplicitClientColon && !hasLeadRef && !inClientDb) return;
        key = `client:${clientName.toLowerCase()}`;
      }
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(t);
    });

    const list: SupportCircle[] = [];
    groupMap.forEach((clientTickets, key) => {
      const sorted = [...clientTickets].sort(
        (a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
      );
      const isWa = key.startsWith('wa:');
      const activeTicket = sorted.find((t) => ['new', 'open', 'pending'].includes(t.status)) || sorted[0];
      const latest = sorted[0];
      const meta = (latest.metadata || {}) as Record<string, any>;
      const activeMeta = (activeTicket.metadata || {}) as Record<string, any>;

      const scope: WaScope = isWa ? getWaScope(latest) : 'soporte';
      const isGroup = isWa && (Boolean(meta.is_group) || String(meta.whatsapp_jid || '').endsWith('@g.us'));
      const phone = String(meta.whatsapp_phone || '').replace(/\D/g, '');
      const leadId = (activeTicket.lead_id || latest.lead_id || null) as string | null;
      const lead = leadId ? leadMap.get(leadId) : undefined;

      const sanitizeWaName = (raw?: string | null): string => {
        const cleaned = stripEmojis(String(raw || '')).trim();
        if (!cleaned) return '';
        if (/^(voc[eê]|you|t[uú])$/i.test(cleaned)) return '';
        return cleaned;
      };

      const cleanPushName = sanitizeWaName(meta.whatsapp_push_name);
      const cleanLeadName = sanitizeWaName(latest.lead_name);

      const clientName = isWa
        ? stripEmojis(
            String(
              (isGroup ? meta.whatsapp_group_subject : '') ||
                cleanLeadName ||
                cleanPushName ||
                (phone ? `+${phone}` : 'Contacto WhatsApp')
            )
          )
        : extractLegacyClientName(activeTicket);

      // Last message preview & unread state
      const descLines = String(latest.description || '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const lastChatLine = [...descLines].reverse().find((l) => l.startsWith('[') && (l.includes('👤') || l.includes('👨‍💻')));
      let lastMessageSender = cleanPushName || clientName;
      let lastMessageText = stripEmojis(String(meta.last_whatsapp_message || latest.title || ''));
      const parsed = lastChatLine ? parseChatLine(lastChatLine) : null;
      if (parsed) {
        lastMessageSender = sanitizeWaName(parsed.sender) || clientName;
        lastMessageText = stripEmojis(parsed.text);
      }
      const lastFrom: string = meta.last_message_from || (parsed ? (parsed.icon === '👨‍💻' ? 'staff' : 'client') : 'client');
      const isOpen = ['new', 'open', 'pending'].includes(activeTicket.status);
      const lastMessageAt = String(meta.last_whatsapp_at || latest.updated_at || latest.created_at);

      // Detect polite closing messages ("Muchas gracias", "Gracias por resolverme el problema", "Ok", "Está bien", etc.)
      // and internal team chats so they don't trigger false red SLA alarms
      const normMsg = lastMessageText
        .toLowerCase()
        .replace(/[¡!¿?.,;:👍🙏👌✅🙌😊🤝]+/g, '')
        .trim();
      const isCourtesyClosing =
        scope !== 'por_clasificar' &&
        normMsg.length > 0 &&
        normMsg.length <= 65 &&
        (/^(ok|okay|okey|si|sí|gracias|muchas gracias|mil gracias|perfecto|esta bien|está bien|entendido|de acuerdo|listo|excelente|bueno|va|dale|super|súper|gracias muy amable|muchas gracias muy amable|ok gracias|ok muchas gracias|perfecto gracias|esta bien gracias|está bien gracias|listo gracias)$/i.test(
          normMsg
        ) ||
          /^(muchas\s+gracias|mil\s+gracias|gracias)\s+(por\s+|muy\s+amable|amigo|equipo|ingeniero|lic)/i.test(normMsg));

      const attendedAt = String(meta.wa_attended_at || activeMeta.wa_attended_at || '');
      const isManuallyAttended =
        Boolean(attendedAt && attendedAt >= lastMessageAt) || dismissedWaitingMap[key] === lastMessageAt;

      const resolvedLeadStatus =
        lead?.status || String(meta.wa_lead_status || activeMeta.wa_lead_status || '').trim() || null;
      const isDiscardedLead = resolvedLeadStatus === 'Perdido' || resolvedLeadStatus === 'Erróneo';
      const isForcedUnread = forcedUnreadMap[key] === lastMessageAt;

      const unreadOrWaitingReply =
        isForcedUnread ||
        (lastFrom === 'client' &&
          scope !== 'interno' &&
          scope !== 'spam' &&
          !isDiscardedLead &&
          !isManuallyAttended &&
          !isCourtesyClosing &&
          (scope !== 'soporte' || isOpen));

      const catObj = activeTicket.category_id ? catMap.get(activeTicket.category_id) : undefined;
      const catInfo = detectShortCategory(catObj?.name || '', activeTicket.title || '');
      const assignedTechId = activeTicket.assigned_to || null;
      const leadOwnerId = (lead && (lead as any).assigned_to) || null;
      const ch = String(activeMeta.support_channel || 'soporte') as SupportChannelType;
      const waitMinutes = unreadOrWaitingReply
        ? Math.max(1, Math.floor((Date.now() - new Date(lastMessageAt).getTime()) / 60000))
        : 0;
      const isReactivation = Boolean(meta.wa_reactivation || activeMeta.wa_reactivation);
      const reactivationCampaign = String(meta.wa_reactivation_campaign || activeMeta.wa_reactivation_campaign || '').trim() || null;
      const hasClientLine = descLines.some((l) => l.includes('👤'));
      const staffLineCount = descLines.filter((l) => l.includes('👨‍💻')).length;
      const reactivationReplied =
        isReactivation &&
        (lastFrom === 'client' || hasClientLine || Boolean(meta.wa_reactivation_replied || activeMeta.wa_reactivation_replied));
      const hasActiveConversation =
        !isDiscardedLead &&
        (Boolean(
          resolvedLeadStatus &&
            ['Lead calificado', 'En seguimiento', 'Negociación', 'En Negociación', 'Cotizado', 'Cerrado'].includes(
              resolvedLeadStatus
            )
        ) ||
          (hasClientLine && staffLineCount >= 2));

      // Strict per-role scope & alert isolation (enforced both here and in DB RLS):
      // - Técnicos only see 'soporte' (never sales leads or unclassified pool).
      // - Vendedores only see 'por_clasificar' (if leadsPool) and their own 'lead' (never support or other vendors' leads).
      // - Admins ('all') see everything.
      if (!scopes.all) {
        if (scope === 'interno' || scope === 'spam') return;
        if (scope === 'soporte') {
          if (!scopes.soporte) return;
          if (scopes.soporteAssignedOnly && assignedTechId !== profile?.id) return;
        }
        if (scope === 'por_clasificar') {
          if (!scopes.leads || !scopes.leadsPool) return;
        }
        if (scope === 'lead') {
          if (!scopes.leads) return;
          // In live session, vendor only sees leads assigned to them.
          // (If Admin is previewing 'ventas_pool'/'ventas_assigned', show leads assigned to Admin or all if none assigned to Admin so preview is informative)
          if (!adminPreviewMode && assignedTechId !== profile?.id && leadOwnerId !== profile?.id) return;
        }
      }

      list.push({
        circleId: key,
        clientName,
        pushName: cleanPushName,
        phone,
        whatsappJid: String(meta.whatsapp_jid || ''),
        isWhatsApp: isWa,
        isGroup,
        scope,
        scopeReason: String(meta.wa_scope_reason || ''),
        memberOfGroups: Array.isArray(meta.member_of_groups) ? meta.member_of_groups : [],
        leadId,
        leadStatus: resolvedLeadStatus,
        leadOwnerId,
        leadOwnerName: leadOwnerId ? agentMap.get(leadOwnerId) || null : null,
        activeTicket,
        allClientTickets: sorted,
        unreadOrWaitingReply,
        waitMinutes,
        lastMessageText,
        lastMessageSender,
        lastMessageAt,
        assignedTechId,
        assignedTechName: (assignedTechId && agentMap.get(assignedTechId)) || 'Sin asignar',
        categoryCode: catInfo.code,
        categoryName: catInfo.name,
        supportChannel: ['soporte', 'contabilidad', 'otros'].includes(ch) ? ch : 'soporte',
        isReactivation,
        reactivationCampaign,
        reactivationReplied,
        hasActiveConversation,
      });
    });

    return list.sort((a, b) => {
      if (a.isWhatsApp !== b.isWhatsApp) return a.isWhatsApp ? -1 : 1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, categories, agents, realClients, companyLeads, scopes, profile?.id, adminPreviewMode, slaTick, dismissedWaitingMap, forcedUnreadMap]);

  const isUnread = (c: SupportCircle) =>
    forcedUnreadMap[c.circleId] === c.lastMessageAt ||
    (c.unreadOrWaitingReply && readCirclesMap[c.circleId] !== c.lastMessageAt);
  const isMine = (c: SupportCircle) =>
    Boolean(profile?.id && (c.assignedTechId === profile.id || c.leadOwnerId === profile.id));
  const isUnassigned = (c: SupportCircle) => !c.isGroup && !c.assignedTechId && !c.leadOwnerId && c.scope !== 'interno' && c.scope !== 'spam';

  const counts = useMemo(() => {
    // WhatsApp conversations only; old Service Hub tickets live in their own tab.
    const wa = circles.filter((c) => c.isWhatsApp && c.scope !== 'spam');
    const by = (s: WaScope) => circles.filter((c) => c.isWhatsApp && c.scope === s).length;
    const waitingList = wa.filter((c) => c.unreadOrWaitingReply);
    const slaCritical = waitingList.filter((c) => c.waitMinutes >= 15 && c.waitMinutes <= 24 * 60).length;
    const mine = wa.filter((c) => isMine(c)).length;
    const unassigned = wa.filter((c) => isUnassigned(c)).length;
    const reactivatedTotal = wa.filter((c) => c.isReactivation).length;
    const reactivatedReplied = wa.filter((c) => c.reactivationReplied).length;
    return {
      all: wa.length,
      waiting: waitingList.length,
      waitingTotal: waitingList.length,
      slaCritical,
      mine,
      unassigned,
      reactivatedTotal,
      reactivatedReplied,
      tickets: circles.filter((c) => !c.isWhatsApp).length,
      soporte: by('soporte'),
      por_clasificar: by('por_clasificar'),
      lead: by('lead'),
      interno: by('interno'),
      spam: by('spam'),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circles, readCirclesMap, profile?.id]);

  // Real-time sound + desktop notification + bell shake when new incoming message arrives
  useEffect(() => {
    const waCircles = circles.filter((c) => c.isWhatsApp && c.scope !== 'spam');
    if (waCircles.length === 0) return;

    if (!initialLoadedRef.current) {
      const initMap: Record<string, string> = {};
      waCircles.forEach((c) => {
        initMap[c.circleId] = c.lastMessageAt;
      });
      prevLastMsgRef.current = initMap;
      initialLoadedRef.current = true;
      return;
    }

    let triggeredAlert: SupportCircle | null = null;
    const nextMap: Record<string, string> = { ...prevLastMsgRef.current };
    for (const c of waCircles) {
      const prevAt = prevLastMsgRef.current[c.circleId];
      if ((!prevAt || new Date(c.lastMessageAt).getTime() > new Date(prevAt).getTime()) && c.unreadOrWaitingReply) {
        if (!triggeredAlert) triggeredAlert = c;
      }
      nextMap[c.circleId] = c.lastMessageAt;
    }
    prevLastMsgRef.current = nextMap;

    if (triggeredAlert) {
      const isUrgentScope = triggeredAlert.scope === 'por_clasificar' || triggeredAlert.scope === 'lead';
      if (soundEnabled) {
        playWaAlertSound(isUrgentScope ? 'urgent' : 'message');
      }
      setBellRinging(true);
      window.setTimeout(() => setBellRinging(false), 6000);

      const alertCircle = triggeredAlert;
      toast.custom(
        (t) => (
          <div
            className={`${
              t.visible ? 'animate-enter' : 'animate-leave'
            } max-w-sm w-full bg-white shadow-2xl rounded-2xl pointer-events-auto flex items-center gap-3 p-3.5 border-2 border-indigo-500`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-xs shrink-0 ${SCOPE_STYLE[alertCircle.scope].avatar}`}>
              <BellRing className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-slate-900 truncate">
                {alertCircle.scope === 'por_clasificar' ? 'Nuevo Lead por WhatsApp' : `Mensaje: ${alertCircle.clientName}`}
              </p>
              <p className="text-[11px] font-medium text-slate-600 truncate mt-0.5">{alertCircle.lastMessageText}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedCircleId(alertCircle.circleId);
                toast.dismiss(t.id);
              }}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black shrink-0"
            >
              Ver
            </button>
          </div>
        ),
        { duration: 6000 }
      );

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
        try {
          const n = new Notification(
            alertCircle.scope === 'por_clasificar'
              ? `Nuevo Lead WhatsApp: ${alertCircle.clientName}`
              : `WhatsApp · ${alertCircle.clientName}`,
            { body: `${alertCircle.lastMessageSender}: ${alertCircle.lastMessageText}` }
          );
          n.onclick = () => {
            window.focus();
            setSelectedCircleId(alertCircle.circleId);
          };
        } catch {
          // ignore desktop notification errors
        }
      }
    }
  }, [circles, soundEnabled]);

  // Browser tab title badge so agents/admins see pending messages even on another tab
  useEffect(() => {
    const baseTitle = 'Arias CRM · Chat WhatsApp';
    const alertTotal = counts.waiting + counts.por_clasificar;
    if (alertTotal > 0) {
      document.title = `(${alertTotal}) Sin contestar · ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
    return () => {
      document.title = 'Arias CRM';
    };
  }, [counts.waiting, counts.por_clasificar]);

  const filterTabs = useMemo(() => {
    const tabs: { id: CircleFilter; label: string; icon: React.ElementType; alert?: boolean }[] = [
      { id: 'all', label: `Todos (${counts.all})`, icon: MessageSquare },
      { id: 'waiting', label: `Sin contestar (${counts.waiting})`, icon: Clock, alert: counts.waiting > 0 },
    ];
    if (scopes.soporte) tabs.push({ id: 'soporte', label: `Soporte (${counts.soporte})`, icon: Building2 });
    if (scopes.leads) {
      if (scopes.leadsPool) {
        tabs.push({ id: 'por_clasificar', label: `Por tomar (${counts.por_clasificar})`, icon: HelpCircle, alert: counts.por_clasificar > 0 });
      }
      tabs.push({ id: 'lead', label: `${scopes.all ? 'Leads' : 'Mis leads'} (${counts.lead})`, icon: UserPlus });
      if (counts.reactivatedTotal > 0 || circleFilter === 'reactivados') {
        tabs.push({
          id: 'reactivados',
          label: `Reactivados (${counts.reactivatedReplied}/${counts.reactivatedTotal})`,
          icon: Sparkles,
          alert: counts.reactivatedReplied > 0,
        });
      }
    }
    if (circleFilter === 'interno') tabs.push({ id: 'interno', label: `Equipo (${counts.interno})`, icon: ShieldCheck });
    if (circleFilter === 'spam') tabs.push({ id: 'spam', label: `Spam (${counts.spam})`, icon: Ban });
    if (circleFilter === 'tickets') tabs.push({ id: 'tickets', label: `Tickets (${counts.tickets})`, icon: FileText });
    return tabs;
  }, [counts, scopes, circleFilter]);

  const leadSubCounts = useMemo(() => {
    const base = circles.filter((c) => {
      if (!c.isWhatsApp) return false;
      if (circleFilter === 'reactivados') return c.isReactivation;
      if (circleFilter === 'lead') return c.scope === 'lead';
      return false;
    });
    let activos = 0;
    let conversando = 0;
    let perdidos = 0;
    let erroneos = 0;
    for (const c of base) {
      const isPerdido = c.leadStatus === 'Perdido';
      const isErroneo = c.leadStatus === 'Erróneo';
      if (isPerdido) perdidos++;
      else if (isErroneo) erroneos++;
      else {
        if (circleFilter === 'reactivados') {
          if (c.reactivationReplied) activos++;
        } else {
          activos++;
        }
        if (c.hasActiveConversation) conversando++;
      }
    }
    return { activos, conversando, perdidos, erroneos, todos: base.length };
  }, [circles, circleFilter]);

  const filteredCircles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const res = circles.filter((c) => {
      if (circleFilter === 'tickets') {
        if (c.isWhatsApp) return false;
      } else if (!c.isWhatsApp) {
        return false;
      }
      if (circleFilter === 'all' && c.scope === 'spam') return false;
      if (circleFilter === 'waiting' && (c.scope === 'spam' || !c.unreadOrWaitingReply)) return false;
      if (circleFilter === 'reactivados' && !c.isReactivation) return false;
      if (!['all', 'waiting', 'reactivados', 'tickets'].includes(circleFilter) && c.scope !== circleFilter) return false;

      if (ownerFilter === 'mine' && !isMine(c)) return false;
      if (ownerFilter === 'unassigned' && !isUnassigned(c)) return false;
      if (ownerFilter === 'urgent' && !(c.unreadOrWaitingReply && c.waitMinutes >= 15 && c.waitMinutes <= 24 * 60)) return false;

      if (circleFilter === 'soporte' && channelFilter !== 'all' && c.supportChannel !== channelFilter) return false;

      // Apply Lead / Reactivados sub-filter when not actively searching
      if (!q && (circleFilter === 'reactivados' || circleFilter === 'lead')) {
        const isPerdido = c.leadStatus === 'Perdido';
        const isErroneo = c.leadStatus === 'Erróneo';
        if (leadSubFilter === 'activos') {
          if (isPerdido || isErroneo) return false;
          if (circleFilter === 'reactivados' && !c.reactivationReplied) return false;
        } else if (leadSubFilter === 'conversando') {
          if (isPerdido || isErroneo || !c.hasActiveConversation) return false;
        } else if (leadSubFilter === 'perdidos') {
          if (!isPerdido) return false;
        } else if (leadSubFilter === 'erroneos') {
          if (!isErroneo) return false;
        }
      }

      if (q) {
        return (
          c.clientName.toLowerCase().includes(q) ||
          c.pushName.toLowerCase().includes(q) ||
          c.phone.includes(q.replace(/\D/g, '') || '§') ||
          c.lastMessageText.toLowerCase().includes(q) ||
          c.assignedTechName.toLowerCase().includes(q) ||
          (c.leadOwnerName || '').toLowerCase().includes(q) ||
          (c.reactivationCampaign || '').toLowerCase().includes(q) ||
          (c.leadStatus || '').toLowerCase().includes(q)
        );
      }
      return true;
    });

    if (circleFilter === 'reactivados' || circleFilter === 'lead') {
      return [...res].sort((a, b) => {
        if (circleFilter === 'reactivados' && a.reactivationReplied !== b.reactivationReplied) {
          return a.reactivationReplied ? -1 : 1;
        }
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      });
    }
    if (circleFilter === 'waiting' || ownerFilter === 'urgent') {
      return [...res].sort((a, b) => b.waitMinutes - a.waitMinutes);
    }
    return res;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circles, circleFilter, ownerFilter, channelFilter, leadSubFilter, searchQuery, readCirclesMap, profile?.id]);

  useEffect(() => {
    if (!selectedCircleId && filteredCircles.length > 0) setSelectedCircleId(filteredCircles[0].circleId);
  }, [filteredCircles, selectedCircleId]);

  const activeCircle = useMemo(
    () => circles.find((c) => c.circleId === selectedCircleId) || null,
    [circles, selectedCircleId]
  );

  // Load quotes (cotizaciones) for the active lead / phone so sales can send proposal links in 1 click
  useEffect(() => {
    setShowQuotesPopover(false);
    if (!activeCircle || !activeCompanyId || activeCircle.isGroup || !activeCircle.isWhatsApp) {
      setLeadQuotes([]);
      return;
    }
    const leadId = activeCircle.leadId;
    const l8 = activeCircle.phone.slice(-8);
    if (!leadId && l8.length < 8 && !pendingQuoteId) {
      setLeadQuotes([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        let q = supabase
          .from('cotizaciones')
          .select('id, plan_nombre, total_anual, total_mensual, estado, created_at, lead_id, telefono_cliente')
          .eq('company_id', activeCompanyId)
          .order('created_at', { ascending: false })
          .limit(20);
        if (leadId) {
          q = q.eq('lead_id', leadId);
        } else if (l8.length >= 4) {
          q = q.like('telefono_cliente', `%${l8.slice(-4)}%`);
        }
        const { data } = await q;
        if (cancelled) return;
        let list = ((data || []) as any[]).filter(
          (row) =>
            (leadId && row.lead_id === leadId) ||
            (l8.length >= 8 && String(row.telefono_cliente || '').replace(/\D/g, '').endsWith(l8)) ||
            (pendingQuoteId && row.id === pendingQuoteId)
        );
        if (pendingQuoteId && !list.some((r) => r.id === pendingQuoteId)) {
          const { data: singleQuote } = await supabase
            .from('cotizaciones')
            .select('id, plan_nombre, total_anual, total_mensual, estado, created_at, lead_id, telefono_cliente')
            .eq('id', pendingQuoteId)
            .maybeSingle();
          if (singleQuote) {
            list = [singleQuote, ...list];
          }
        }
        setLeadQuotes(
          list.slice(0, 8).map((r) => ({
            id: r.id,
            plan_nombre: r.plan_nombre || 'Cotización',
            total_anual: Number(r.total_anual || 0),
            total_mensual: Number(r.total_mensual || 0),
            estado: r.estado || 'borrador',
            created_at: r.created_at,
          }))
        );
      } catch {
        if (!cancelled) setLeadQuotes([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeCircle?.circleId, activeCircle?.leadId, activeCircle?.phone, activeCompanyId, pendingQuoteId]);

  // ── Thread loading: every ticket of this chat, in real WhatsApp order ─────
  const threadTicketIds = useMemo(
    () => (activeCircle ? activeCircle.allClientTickets.slice(0, 25).map((t) => t.id) : []),
    [activeCircle?.circleId, activeCircle?.allClientTickets.length]
  );
  const threadKey = threadTicketIds.join(',');

  const loadThread = useCallback(
    async (showSpinner = false) => {
      if (threadTicketIds.length === 0) {
        setComments([]);
        setWaMessages([]);
        setOutboxRows([]);
        return;
      }
      if (showSpinner) setLoadingComments(true);
      try {
        const [cRes, mRes, oRes] = await Promise.all([
          supabase
            .from('ticket_comments')
            .select('*')
            .in('ticket_id', threadTicketIds)
            .order('created_at', { ascending: true })
            .limit(1500),
          supabase
            .from('whatsapp_messages')
            .select('id, ticket_id, comment_id, message_type, media_status, media_path, media_mime, media_filename, media_size, media_error, from_me')
            .in('ticket_id', threadTicketIds)
            .neq('media_status', 'none'),
          supabase
            .from('whatsapp_outbox')
            .select('id, comment_id, status, error')
            .in('ticket_id', threadTicketIds),
        ]);
        const msgs = (mRes.data || []) as WaMessageRow[];
        setComments((cRes.data || []) as TicketComment[]);
        setWaMessages(msgs);
        setOutboxRows((oRes.data || []) as OutboxRow[]);

        const paths = msgs.filter((m) => m.media_status === 'ready' && m.media_path).map((m) => m.media_path as string);
        const missing = paths.filter((p) => !mediaUrls[p]);
        if (missing.length > 0) {
          const { data: signed } = await supabase.storage.from('whatsapp-media').createSignedUrls(missing, 60 * 60 * 6);
          const next: Record<string, string> = {};
          (signed || []).forEach((s) => {
            if (s.path && s.signedUrl) next[s.path] = s.signedUrl;
          });
          if (Object.keys(next).length > 0) setMediaUrls((prev) => ({ ...prev, ...next }));
        }
      } catch (e) {
        console.error('[SupportChatCircles] thread load error', e);
      } finally {
        if (showSpinner) setLoadingComments(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [threadKey]
  );

  useEffect(() => {
    if (!activeCircle) return;
    const t = activeCircle.activeTicket;
    const meta = (t.metadata || {}) as Record<string, any>;
    setResForm({
      actual_hours: t.actual_hours && Number(t.actual_hours) > 0 ? String(t.actual_hours) : '',
      findings: t.findings || '',
      root_cause: t.root_cause || '',
      solution: t.solution || '',
      time_justification: String(meta.time_justification || ''),
    });
    setActiveChatSeconds(0);
    setShowReclassifyMenu(false);
    setShowClientPicker(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCircle?.activeTicket.id]);

  useEffect(() => {
    loadThread(true);
  }, [loadThread]);

  useEffect(() => {
    const interval = setInterval(() => setActiveChatSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [activeCircle?.activeTicket.id]);

  // ── Realtime (debounced) ──────────────────────────────────────────────────
  const threadIdsRef = useRef<string[]>([]);
  threadIdsRef.current = threadTicketIds;
  const listTimer = useRef<number | null>(null);
  const threadTimer = useRef<number | null>(null);
  const loadThreadRef = useRef(loadThread);
  loadThreadRef.current = loadThread;

  useEffect(() => {
    if (!activeCompanyId || !scopes.any) return;
    const scheduleList = () => {
      if (listTimer.current) window.clearTimeout(listTimer.current);
      listTimer.current = window.setTimeout(() => loadSupportData(true), 700);
    };
    const scheduleThread = (ticketId?: string) => {
      if (ticketId && !threadIdsRef.current.includes(ticketId)) return;
      if (threadTimer.current) window.clearTimeout(threadTimer.current);
      threadTimer.current = window.setTimeout(() => loadThreadRef.current(false), 400);
    };
    const filter = `company_id=eq.${activeCompanyId}`;
    const channel = supabase
      .channel(`support_circles_${activeCompanyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter }, scheduleList)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_comments', filter }, (p: any) => {
        scheduleThread(p.new?.ticket_id || p.old?.ticket_id);
        scheduleList();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_messages', filter }, (p: any) =>
        scheduleThread(p.new?.ticket_id)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_outbox', filter }, (p: any) =>
        scheduleThread(p.new?.ticket_id)
      )
      .subscribe();
    return () => {
      if (listTimer.current) window.clearTimeout(listTimer.current);
      if (threadTimer.current) window.clearTimeout(threadTimer.current);
      supabase.removeChannel(channel);
    };
  }, [activeCompanyId, scopes.any, loadSupportData]);

  // ── Chat items ────────────────────────────────────────────────────────────
  const chatItems = useMemo<ChatItem[]>(() => {
    if (!activeCircle) return [];
    const mediaByComment = new Map<string, WaMessageRow>();
    waMessages.forEach((m) => m.comment_id && mediaByComment.set(m.comment_id, m));
    const outboxByComment = new Map<string, OutboxRow>();
    outboxRows.forEach((o) => o.comment_id && outboxByComment.set(o.comment_id, o));
    const ticketById = new Map(activeCircle.allClientTickets.map((t) => [t.id, t]));

    const items: ChatItem[] = [];
    let lastTicketId = '';
    const showTicketMarkers = activeCircle.scope === 'soporte';

    comments.forEach((c) => {
      if (showTicketMarkers && c.ticket_id !== lastTicketId) {
        const t = ticketById.get(c.ticket_id);
        if (t) {
          items.push({
            id: `ticket-${t.id}`,
            kind: 'ticket',
            senderName: `Ticket #${t.id.slice(0, 8).toUpperCase()}`,
            text: stripEmojis(t.title || '').replace(/^\[WhatsApp · [^\]]*\]\s*/, ''),
            createdAt: c.created_at,
            ticketId: t.id,
          });
        }
      }
      lastTicketId = c.ticket_id;

      const raw = String(c.body || '').trim();
      if (c.is_internal) {
        items.push({ id: c.id, kind: 'system', senderName: '', text: stripEmojis(raw), createdAt: c.created_at, ticketId: c.ticket_id });
        return;
      }
      const parsed = parseChatLine(raw);
      let body = parsed ? parsed.text : raw;
      let transcript: string | undefined;
      const tIdx = body.indexOf('📝 Transcripción IA:');
      if (tIdx >= 0) {
        transcript = body.slice(tIdx + '📝 Transcripción IA:'.length).trim().replace(/^"|"$/g, '');
        body = body.slice(0, tIdx).trim();
      }
      const audioUrlMatch = body.match(/\[AUDIO_URL:([^\]]+)\]/i);
      body = body.replace(/\s*\[AUDIO_URL:[^\]]+\]/gi, '').trim();

      const isStaff = parsed ? parsed.icon === '👨‍💻' || (!parsed.icon && Boolean(c.author_id)) : Boolean(c.author_id);
      const agentName = c.author_id ? agents.find((a) => a.id === c.author_id)?.full_name : undefined;
      const senderName = stripEmojis(
        (parsed?.sender || agentName || (isStaff ? 'Equipo' : activeCircle.clientName)).replace(/\(Reporte Inicial\)/i, '')
      );
      const media = mediaByComment.get(c.id);
      const ob = outboxByComment.get(c.id);
      // Media placeholders are redundant once the file itself is shown.
      if (media) {
        body = body.replace(/^\[(?:Imagen|Video|Sticker|Nota de voz|Documento|Archivo)[^\]]*\]\s*/i, '').trim();
      }

      items.push({
        id: c.id,
        kind: isStaff ? 'staff' : 'client',
        senderName,
        text: stripEmojis(body),
        transcript,
        createdAt: c.created_at,
        ticketId: c.ticket_id,
        media: media ? { ...media, url: media.media_path ? mediaUrls[media.media_path] : undefined } : undefined,
        legacyMedia: audioUrlMatch ? { url: audioUrlMatch[1], type: 'audio' } : undefined,
        delivery: ob?.status,
        deliveryError: ob?.error,
      });
    });

    // Tickets without comments (created in Tickets / Service Hub, or old WhatsApp rows):
    // show their description so the conversation is never empty.
    const ticketsWithComments = new Set(comments.map((c) => c.ticket_id));
    activeCircle.allClientTickets.slice(0, 25).forEach((t) => {
      if (ticketsWithComments.has(t.id)) return;
      const desc = String(t.description || '').trim();
      if (showTicketMarkers) {
        items.push({
          id: `ticket-${t.id}`,
          kind: 'ticket',
          senderName: `Ticket #${t.id.slice(0, 8).toUpperCase()}`,
          text: stripEmojis(t.title || '').replace(/^\[WhatsApp · [^\]]*\]\s*/, ''),
          createdAt: t.created_at,
          ticketId: t.id,
        });
      }
      if (!desc) return;
      const chatLines = desc.split('\n').map((l) => l.trim()).filter((l) => parseChatLine(l) && /👤|👨‍💻/.test(l));
      if (chatLines.length > 0) {
        chatLines.forEach((l, i) => {
          const p = parseChatLine(l)!;
          items.push({
            id: `desc-${t.id}-${i}`,
            kind: p.icon === '👨‍💻' ? 'staff' : 'client',
            senderName: stripEmojis(p.sender.replace(/\(Reporte Inicial\)/i, '')),
            text: stripEmojis(p.text),
            createdAt: new Date(new Date(t.created_at).getTime() + i).toISOString(),
            ticketId: t.id,
          });
        });
      } else {
        items.push({
          id: `desc-${t.id}`,
          kind: 'client',
          senderName: activeCircle.clientName,
          text: stripEmojis(desc),
          createdAt: new Date(new Date(t.created_at).getTime() + 1).toISOString(),
          ticketId: t.id,
        });
      }
    });

    // Legacy attachments stored on the ticket (before media was tracked per message).
    activeCircle.allClientTickets.forEach((t) => {
      const att = Array.isArray((t.metadata as any)?.attachments) ? ((t.metadata as any).attachments as any[]) : [];
      att.forEach((a, i) => {
        const type = String(a.type || '');
        items.push({
          id: `att-${t.id}-${i}`,
          kind: 'staff',
          senderName: 'Equipo',
          text: '',
          createdAt: a.uploaded_at || t.updated_at || t.created_at,
          ticketId: t.id,
          legacyMedia: { url: a.url, type: type.startsWith('video/') ? 'video' : type.startsWith('image/') ? 'image' : 'file', name: a.name },
        });
      });
    });

    return items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [activeCircle, comments, waMessages, outboxRows, mediaUrls, agents]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatItems.length, activeCircle?.circleId]);

  const aiTimeAudit = useMemo(() => {
    if (!activeCircle) return null;
    const t = activeCircle.activeTicket;
    return computeTicketAiTimeBenchmark(t.title || '', t.description || '', activeCircle.categoryName, Number(resForm.actual_hours) || 0);
  }, [activeCircle, resForm.actual_hours]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const canSend = activeCircle && activeCircle.isWhatsApp && activeCircle.scope !== 'spam';
  const canClassify = Boolean(
    activeCircle &&
      activeCircle.isWhatsApp &&
      !activeCircle.isGroup &&
      (scopes.all || (scopes.leads && (activeCircle.scope === 'por_clasificar' || (activeCircle.scope === 'lead' && activeCircle.activeTicket.assigned_to === profile?.id))))
  );

  const handleSendReply = async (customText?: string) => {
    const textToSend = (customText ?? messageInput).trim();
    if (!textToSend || !activeCircle || !activeCompanyId || !canSend) return;
    markCircleAsRead(activeCircle.circleId, activeCircle.lastMessageAt);
    const t = activeCircle.activeTicket;
    if (!customText) setMessageInput('');
    const optimistic: TicketComment = {
      id: `temp-${Date.now()}`,
      ticket_id: t.id,
      company_id: activeCompanyId,
      author_id: profile?.id || null,
      body: `[--] 👨‍💻 ${profile?.full_name || 'Equipo'}: ${textToSend}`,
      is_internal: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setComments((prev) => [...prev, optimistic]);
    if (activeCircle.scope === 'soporte' && (!resForm.actual_hours || Number(resForm.actual_hours) <= 0)) {
      setResForm((p) => ({ ...p, actual_hours: '0.2' }));
    }
    setSendingMessage(true);
    try {
      const data = await invoke({
        action: 'send_reply',
        ticket_id: t.id,
        message_text: textToSend,
        response_minutes: Math.max(1, Math.round(activeChatSeconds / 60)),
      });
      setComments((prev) => prev.map((c) => (c.id === optimistic.id ? (data.comment as TicketComment) : c)));
      loadThread(false);
      loadSupportData(true);
    } catch (err: any) {
      setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
      if (!customText) setMessageInput(textToSend);
      toast.error(err?.message || 'Error al enviar mensaje');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeCircle || !canSend) return;
    if (file.size > 45 * 1024 * 1024) {
      toast.error('El archivo es muy grande (máximo 45 MB)');
      return;
    }
    setUploadingFile(true);
    try {
      const t = activeCircle.activeTicket;
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
      const path = `outgoing/${t.company_id}/${t.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from('whatsapp-media')
        .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
      if (upErr) throw upErr;
      await invoke({
        action: 'send_media',
        ticket_id: t.id,
        storage_path: path,
        file_name: file.name,
        mime: file.type || 'application/octet-stream',
        size: file.size,
        caption: messageInput.trim(),
      });
      setMessageInput('');
      toast.success('Archivo enviado');
      loadThread(false);
      loadSupportData(true);
    } catch (err: any) {
      toast.error(err?.message || 'Error al enviar archivo');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRetryMedia = async (rowId: string) => {
    try {
      await invoke({ action: 'retry_media', wa_message_row_id: rowId });
      toast.success('Reintentando descarga…');
      loadThread(false);
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo reintentar');
    }
  };

  const handleAssignTech = async (techId: string) => {
    if (!activeCircle) return;
    try {
      await ticketService.updateTicket(activeCircle.activeTicket.id, { assigned_to: techId || null });
      toast.success('Responsable asignado');
      loadSupportData(true);
    } catch (err: any) {
      toast.error(err?.message || 'Error al asignar');
    }
  };

  const handleSwitchChannel = async (newChannel: SupportChannelType) => {
    if (!activeCircle) return;
    try {
      await invoke({ action: 'set_ticket_channel', ticket_id: activeCircle.activeTicket.id, support_channel: newChannel });
      toast.success(`Categoría: ${SUPPORT_CHANNEL_LABELS[newChannel]}`);
      loadSupportData(true);
    } catch (err: any) {
      toast.error(err?.message || 'Error al cambiar categoría');
    }
  };

  const classify = async (
    type: 'cliente' | 'lead' | 'interno' | 'spam' | 'por_clasificar',
    extra: Record<string, unknown> = {}
  ) => {
    if (!activeCircle) return;
    setClassifying(true);
    try {
      const data = await invoke({ action: 'classify_contact', ticket_id: activeCircle.activeTicket.id, contact_type: type, ...extra });
      const labels: Record<string, string> = {
        cliente: 'Cliente (Soporte)',
        lead: 'Lead de Ventas',
        interno: 'Equipo interno',
        spam: 'Spam',
        por_clasificar: 'Lead nuevo (por tomar)',
      };
      toast.success(
        type === 'lead' && data?.lead?.name ? `Lead creado y asignado: ${data.lead.name}` : `Clasificado como ${labels[type]}`
      );
      setShowClientPicker(false);
      setShowReclassifyMenu(false);
      await loadSupportData(true);
      loadThread(false);
      return data;
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo clasificar');
      loadSupportData(true);
      return null;
    } finally {
      setClassifying(false);
    }
  };

  const handleSaveInternalNote = async () => {
    const text = messageInput.trim();
    if (!text || !activeCircle || !activeCompanyId) return;
    const t = activeCircle.activeTicket;
    setMessageInput('');
    setSendingMessage(true);
    try {
      const noteBody = `Nota interna (${profile?.full_name || 'Equipo'}): ${text}`;
      const { data: inserted, error } = await supabase
        .from('ticket_comments')
        .insert({
          ticket_id: t.id,
          company_id: activeCompanyId,
          author_id: profile?.id || null,
          body: noteBody,
          is_internal: true,
        })
        .select('*')
        .single();
      if (error) throw error;
      if (inserted) setComments((prev) => [...prev, inserted as TicketComment]);
      toast.success('Nota interna guardada en el chat');
      setComposerMode('whatsapp');
    } catch (err: any) {
      setMessageInput(text);
      toast.error(err?.message || 'No se pudo guardar la nota interna');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleComposerSubmit = () => {
    if (composerMode === 'internal') {
      handleSaveInternalNote();
    } else {
      handleSendReply();
    }
  };

  const canModifyComment = (b: ChatItem) =>
    (b.kind === 'staff' || b.kind === 'system') &&
    !b.id.startsWith('temp-') &&
    !b.id.startsWith('desc-') &&
    !b.id.startsWith('att-') &&
    !b.id.startsWith('ticket-');

  const handleStartEditComment = (b: ChatItem) => {
    setEditingCommentId(b.id);
    setEditingCommentText(b.text || '');
  };

  const handleSaveEditedComment = async (b: ChatItem, resendToWhatsApp = false) => {
    const trimmed = editingCommentText.trim();
    if (!trimmed || !activeCircle) return;
    setSavingCommentEdit(true);
    try {
      const existingRow = comments.find((c) => c.id === b.id);
      let newBody = trimmed;
      if (b.kind === 'staff') {
        const timePart = fmtTime(b.createdAt);
        const sender = b.senderName || profile?.full_name || 'Equipo';
        newBody = `[${timePart}] 👨‍💻 ${sender}: ${trimmed}`;
      } else if (b.kind === 'system') {
        newBody = trimmed.toLowerCase().startsWith('nota interna')
          ? trimmed
          : `Nota interna (${profile?.full_name || 'Equipo'}): ${trimmed}`;
      }
      if (existingRow) {
        const { error } = await supabase
          .from('ticket_comments')
          .update({ body: newBody, updated_at: new Date().toISOString() })
          .eq('id', b.id);
        if (error) throw error;
        setComments((prev) => prev.map((c) => (c.id === b.id ? { ...c, body: newBody } : c)));
      }
      // If this was the latest comment on the active ticket, refresh the sidebar preview too
      const isLast = chatItems[chatItems.length - 1]?.id === b.id;
      if (isLast && b.kind === 'staff') {
        const meta = (activeCircle.activeTicket.metadata || {}) as Record<string, any>;
        await supabase
          .from('tickets')
          .update({
            metadata: {
              ...meta,
              last_message_preview: trimmed.slice(0, 140),
            },
          })
          .eq('id', activeCircle.activeTicket.id);
      }
      setEditingCommentId(null);
      setEditingCommentText('');
      if (resendToWhatsApp && b.kind === 'staff') {
        await handleSendReply(trimmed);
        toast.success('Mensaje actualizado y reenviado por WhatsApp');
      } else {
        toast.success('Mensaje actualizado');
        loadSupportData(true);
      }
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo editar el mensaje');
    } finally {
      setSavingCommentEdit(false);
    }
  };

  const handleDeleteComment = async (b: ChatItem) => {
    if (!activeCircle) return;
    try {
      const { error } = await supabase.from('ticket_comments').delete().eq('id', b.id);
      if (error) throw error;
      const nextComments = comments.filter((c) => c.id !== b.id);
      setComments(nextComments);

      // Update sidebar preview if the deleted message was the latest one
      const remainingItems = chatItems.filter((item) => item.id !== b.id && (item.kind === 'staff' || item.kind === 'client'));
      const newLast = remainingItems[remainingItems.length - 1];
      if (newLast) {
        const meta = (activeCircle.activeTicket.metadata || {}) as Record<string, any>;
        await supabase
          .from('tickets')
          .update({
            metadata: {
              ...meta,
              last_message_preview: (newLast.text || '[Archivo adjunto]').slice(0, 140),
              last_message_from: newLast.kind === 'staff' ? 'staff' : 'client',
              last_message_sender: newLast.senderName,
            },
          })
          .eq('id', activeCircle.activeTicket.id);
      }
      toast.success('Mensaje eliminado del chat');
      loadSupportData(true);
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo eliminar el mensaje');
    }
  };

  const handleUpdateLeadStatus = async (newStatus: string, targetCircle?: SupportCircle) => {
    const circle = targetCircle || activeCircle;
    if (!circle || !activeCompanyId) return;
    const isDiscard = newStatus === 'Perdido' || newStatus === 'Erróneo';
    const nowIso = new Date().toISOString();

    // Instant optimistic UI update
    if (circle.leadId) {
      setCompanyLeads((prev) => {
        const exists = prev.some((l) => l.id === circle.leadId);
        if (exists) {
          return prev.map((l) => (l.id === circle.leadId ? { ...l, status: newStatus } : l));
        }
        return [
          ...prev,
          {
            id: circle.leadId!,
            name: circle.clientName,
            email: null,
            phone: circle.phone,
            status: newStatus,
            es_cliente: false,
          } as TicketLead,
        ];
      });
    }
    if (isDiscard) {
      markCircleAsRead(circle.circleId, circle.lastMessageAt);
      setDismissedWaitingMap((prev) => {
        const next = { ...prev, [circle.circleId]: circle.lastMessageAt };
        try {
          localStorage.setItem('crm_wa_dismissed_waiting', JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    }

    try {
      if (circle.leadId) {
        const { error } = await supabase
          .from('leads')
          .update({ status: newStatus })
          .eq('id', circle.leadId)
          .eq('company_id', activeCompanyId);
        if (error) throw error;
      }

      const curMeta = (circle.activeTicket.metadata || {}) as Record<string, any>;
      await supabase
        .from('tickets')
        .update({
          metadata: {
            ...curMeta,
            wa_lead_status: newStatus,
            ...(isDiscard ? { wa_attended_at: nowIso } : {}),
          },
        })
        .eq('id', circle.activeTicket.id);

      await supabase.from('ticket_comments').insert({
        ticket_id: circle.activeTicket.id,
        company_id: activeCompanyId,
        author_id: profile?.id || null,
        body: `${profile?.full_name || 'Equipo'} actualizó etapa del lead a: ${newStatus}`,
        is_internal: true,
      });
      toast.success(isDiscard ? `Marcado como ${newStatus} y atendido` : `Etapa del lead: ${newStatus}`);
      loadSupportData(true);
      if (activeCircle?.circleId === circle.circleId) {
        loadThread(false);
      }
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo actualizar la etapa');
    }
  };

  const handleAssignLeadOwner = async (ownerId: string) => {
    if (!activeCircle || !activeCompanyId) return;
    try {
      if (activeCircle.leadId) {
        const { error } = await supabase
          .from('leads')
          .update({ assigned_to: ownerId || null })
          .eq('id', activeCircle.leadId)
          .eq('company_id', activeCompanyId);
        if (error) throw error;
      }
      await ticketService.updateTicket(activeCircle.activeTicket.id, { assigned_to: ownerId || null });
      toast.success('Responsable comercial actualizado');
      loadSupportData(true);
    } catch (err: any) {
      toast.error(err?.message || 'Error al asignar vendedor');
    }
  };

  const handleOpenQuoteBuilder = async () => {
    if (!activeCircle) return;
    setCreatingQuote(true);
    try {
      let leadId = activeCircle.leadId;
      let leadName = activeCircle.clientName;
      if (!leadId && activeCircle.scope === 'por_clasificar') {
        const res = await classify('lead');
        if (res?.lead?.id) {
          leadId = res.lead.id;
          leadName = res.lead.name || leadName;
        }
      }
      navigate('/cotizaciones/nueva-pro', {
        state: {
          fromWaChat: true,
          waCircleId: activeCircle.circleId,
          waTicketId: activeCircle.activeTicket.id,
          lead: {
            id: leadId,
            name: leadName,
            company_name: leadName,
            phone: activeCircle.phone ? `+${activeCircle.phone}` : '',
          },
        },
      });
    } finally {
      setCreatingQuote(false);
    }
  };

  const buildQuoteWhatsAppText = useCallback(
    (q: LeadQuoteSummary, clientName: string, includeMeeting = true) => {
      const publicUrl = `${window.location.origin}/propuesta/${q.id}`;
      const bookingUrl = myBookingSlug ? `${window.location.origin}/book/${myBookingSlug}` : '';
      const cleanName =
        clientName && !clientName.startsWith('+') && !/^(contacto whatsapp|cliente whatsapp)$/i.test(clientName.trim())
          ? ` ${clientName.trim().split(' ')[0]}`
          : '';
      const lines = [
        `Hola${cleanName}, le comparto nuestra propuesta comercial (${q.plan_nombre}).`,
        '',
        `Enlace para revisar, aprobar y firmar en línea:`,
        publicUrl,
      ];
      if (includeMeeting) {
        lines.push(
          '',
          `¿Qué día de esta semana (por ejemplo mañana a las 10:00 a. m. o 3:00 p. m.) le queda mejor para una breve llamada de 10 minutos, responder sus dudas y revisarla juntos?`
        );
        if (bookingUrl) {
          lines.push(`También puede elegir su horario directo aquí: ${bookingUrl}`);
        }
      }
      return lines.join('\n');
    },
    [myBookingSlug]
  );

  const handleSendQuotePdfToWhatsApp = async (q: LeadQuoteSummary, includeLinksInCaption = true) => {
    if (!activeCircle || !canSend) return;
    setSendingQuotePdfId(q.id);
    const toastId = `wa-quote-pdf-${q.id}`;
    toast.loading('Generando y enviando propuesta PDF…', { id: toastId });
    try {
      const fullQuote = await cotizacionesService.getCotizacion(q.id);
      const pdfBlob = await pdfService.generateQuotePDFBlob(fullQuote as any);
      const t = activeCircle.activeTicket;
      const safePlan = (q.plan_nombre || 'Propuesta').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 45);
      const fileName = `Propuesta_${safePlan}.pdf`;
      const path = `outgoing/${t.company_id}/${t.id}/${crypto.randomUUID()}-${fileName}`;

      const { error: upErr } = await supabase.storage
        .from('whatsapp-media')
        .upload(path, pdfBlob, { contentType: 'application/pdf', upsert: false });
      if (upErr) throw upErr;

      const caption = includeLinksInCaption
        ? buildQuoteWhatsAppText(q, activeCircle.clientName, true)
        : `Propuesta comercial · ${q.plan_nombre}`;

      await invoke({
        action: 'send_media',
        ticket_id: t.id,
        storage_path: path,
        file_name: fileName,
        mime: 'application/pdf',
        size: pdfBlob.size,
        caption,
      });

      markCircleAsRead(activeCircle.circleId, activeCircle.lastMessageAt);
      if (activeCircle.leadId && activeCompanyId) {
        await supabase
          .from('leads')
          .update({ status: 'En seguimiento' })
          .eq('id', activeCircle.leadId)
          .eq('company_id', activeCompanyId);
      }

      if (pendingQuoteId === q.id) setPendingQuoteId(null);
      setShowQuotesPopover(false);
      setPostQuoteFollowupCircleId(activeCircle.circleId);
      toast.success('Propuesta PDF enviada · Agenda el seguimiento en 1 clic', { id: toastId });
      loadThread(false);
      loadSupportData(true);
    } catch (err: any) {
      toast.error(err?.message || 'Error al enviar propuesta PDF', { id: toastId });
    } finally {
      setSendingQuotePdfId(null);
    }
  };

  const activeDiscoveryAnswers = useMemo<Record<string, string>>(() => {
    if (!activeCircle) return {};
    const fromTicket = (activeCircle.activeTicket.metadata as any)?.wa_discovery;
    if (fromTicket && typeof fromTicket === 'object') {
      const cleaned: Record<string, string> = {};
      for (let i = 1; i <= 7; i++) {
        const val = fromTicket[`q${i}`];
        if (typeof val === 'string' && val.trim()) cleaned[`q${i}`] = val.trim();
      }
      if (Object.keys(cleaned).length > 0) return cleaned;
    }
    return {};
  }, [activeCircle]);

  const buildDiscoveryWhatsAppText = useCallback(() => {
    if (!activeCircle) return '';
    const targetId = activeCircle.activeTicket.id;
    const url = `${window.location.origin}/diagnostico/${targetId}`;
    const rawName = activeCircle.clientName || '';
    const cleanFirst =
      rawName && !rawName.startsWith('+') && !/^(contacto whatsapp|cliente whatsapp)$/i.test(rawName.trim())
        ? ` ${rawName.trim().split(' ')[0]}`
        : '';
    return [
      `Hola${cleanFirst}, con mucho gusto le brindo los precios y detalles.`,
      `Para prepararle la propuesta exacta según su operación, ¿me apoya respondiendo estas breves preguntas (toma 30 segundos)?`,
      '',
      url,
    ].join('\n');
  }, [activeCircle]);

  const handleSendDiscoveryFormLink = async (sendImmediately: boolean) => {
    const text = buildDiscoveryWhatsAppText();
    if (!text) return;
    setShowDiscoveryPopover(false);
    if (sendImmediately) {
      await handleSendReply(text);
      toast.success('Formulario de diagnóstico enviado al WhatsApp');
    } else {
      setComposerMode('whatsapp');
      setMessageInput(text);
    }
  };

  const handleApplyDiscoveryFindings = async (notes: string, structuredAnswers?: Record<string, string>) => {
    if (!activeCircle || !activeCompanyId) return;
    try {
      const t = activeCircle.activeTicket;
      const currentMeta = (t.metadata || {}) as Record<string, any>;
      const mergedDiscovery = {
        ...(currentMeta.wa_discovery || {}),
        ...(structuredAnswers || parseAriasAnswersFromNotes(notes)),
        updated_at: new Date().toISOString(),
      };
      await supabase
        .from('tickets')
        .update({
          metadata: {
            ...currentMeta,
            wa_discovery: mergedDiscovery,
          },
        })
        .eq('id', t.id);

      let targetLeadId = activeCircle.leadId;
      if (!targetLeadId && activeCircle.scope === 'por_clasificar') {
        const res = await classify('lead');
        targetLeadId = res?.lead?.id || null;
      }
      if (targetLeadId) {
        const { data: leadRow } = await supabase
          .from('leads')
          .select('next_action_notes')
          .eq('id', targetLeadId)
          .maybeSingle();
        const prevNotes = leadRow?.next_action_notes ? `${leadRow.next_action_notes}\n\n` : '';
        await supabase
          .from('leads')
          .update({
            status: 'Lead calificado',
            next_action_notes: `${prevNotes}${notes}`,
          })
          .eq('id', targetLeadId)
          .eq('company_id', activeCompanyId);
      }

      await supabase.from('ticket_comments').insert({
        ticket_id: t.id,
        company_id: activeCompanyId,
        author_id: profile?.id || null,
        is_internal: true,
        body: `[--] 📋 Diagnóstico ARIAS actualizado por ${profile?.full_name || 'Ejecutivo'}`,
      });

      setShowDiscoveryHUD(false);
      loadThread(false);
      loadSupportData(true);
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar diagnóstico');
    }
  };

  const handleSchedulePostQuoteFollowup = async (daysFromNow: number, label: string) => {
    if (!activeCircle || !activeCompanyId) return;
    setSchedulingFollowup(true);
    try {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysFromNow);
      targetDate.setHours(10, 0, 0, 0);
      const dateIso = targetDate.toISOString().split('T')[0];

      let targetLeadId = activeCircle.leadId;
      if (!targetLeadId && activeCircle.scope === 'por_clasificar') {
        const res = await classify('lead');
        targetLeadId = res?.lead?.id || null;
      }

      if (targetLeadId) {
        await supabase
          .from('leads')
          .update({
            status: 'En seguimiento',
            next_followup_date: targetDate.toISOString(),
            next_action_assignee: profile?.id || null,
          })
          .eq('id', targetLeadId)
          .eq('company_id', activeCompanyId);

        await supabase.from('follow_ups').insert({
          lead_id: targetLeadId,
          company_id: activeCompanyId,
          date: dateIso,
          action_type: 'call',
          notes: `Seguimiento de cotización enviada por WhatsApp (${label}) — resolver dudas y cierre.`,
          completed: false,
          created_by: profile?.id || null,
        });
      }

      await supabase.from('ticket_comments').insert({
        ticket_id: activeCircle.activeTicket.id,
        company_id: activeCompanyId,
        author_id: profile?.id || null,
        is_internal: true,
        body: `[--] 📅 Seguimiento post-cotización agendado: ${label} (${targetDate.toLocaleDateString('es-SV')})`,
      });

      setPostQuoteFollowupCircleId(null);
      toast.success(`Seguimiento agendado para ${label}`);
      loadThread(false);
      loadSupportData(true);
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo agendar el seguimiento');
    } finally {
      setSchedulingFollowup(false);
    }
  };

  const handleOpenCalendarModal = async (mode: 'followup' | 'meeting') => {
    if (!activeCircle) return;
    setShowCalendarPopover(false);
    if (!activeCircle.leadId && activeCircle.scope === 'por_clasificar') {
      await classify('lead');
    }
    if (mode === 'meeting') {
      setShowMeetSchedulerModal(true);
    } else {
      setShowNewFollowUpModal(true);
    }
  };

  const handleSendBookingLinkToChat = async (sendImmediately: boolean) => {
    if (!activeCircle) return;
    setShowCalendarPopover(false);
    const bookingUrl = myBookingSlug
      ? `${window.location.origin}/book/${myBookingSlug}`
      : `${window.location.origin}/calendar`;
    const rawName = activeCircle.clientName || '';
    const cleanFirst =
      rawName && !rawName.startsWith('+') && !/^(contacto whatsapp|cliente whatsapp)$/i.test(rawName.trim())
        ? ` ${rawName.trim().split(' ')[0]}`
        : '';
    const msg = [
      `Hola${cleanFirst}, le comparto mi enlace de calendario para que elija el día y la hora que mejor le convenga para nuestra reunión o demostración:`,
      '',
      bookingUrl,
    ].join('\n');

    if (sendImmediately) {
      await handleSendReply(msg);
      toast.success('Enlace de calendario enviado al WhatsApp');
    } else {
      setComposerMode('whatsapp');
      setMessageInput(msg);
    }
  };

  const handleCalendarScheduledShare = async (opts: {
    label: string;
    dateStr: string;
    timeStr: string;
    meetLink?: string | null;
    sendImmediately?: boolean;
    shareToWhatsApp?: boolean;
  }) => {
    if (!activeCircle || !activeCompanyId) return;
    try {
      if (activeCircle.leadId) {
        await supabase
          .from('leads')
          .update({ status: 'En seguimiento' })
          .eq('id', activeCircle.leadId)
          .eq('company_id', activeCompanyId);
      }

      await supabase.from('ticket_comments').insert({
        ticket_id: activeCircle.activeTicket.id,
        company_id: activeCompanyId,
        author_id: profile?.id || null,
        is_internal: true,
        body: `[--] 📅 ${opts.label} agendado en calendario: ${opts.dateStr} · ${opts.timeStr}`,
      });

      if (opts.shareToWhatsApp !== false) {
        const rawName = activeCircle.clientName || '';
        const cleanFirst =
          rawName && !rawName.startsWith('+') && !/^(contacto whatsapp|cliente whatsapp)$/i.test(rawName.trim())
            ? ` ${rawName.trim().split(' ')[0]}`
            : '';
        const bookingUrl = myBookingSlug ? `${window.location.origin}/book/${myBookingSlug}` : '';
        const linkToShare = opts.meetLink || bookingUrl;

        const lines = [
          `Hola${cleanFirst}, le confirmo que hemos agendado nuestro espacio (${opts.label}) para el ${opts.dateStr} a las ${opts.timeStr}.`,
        ];
        if (opts.meetLink) {
          lines.push('', `Enlace directo a la videollamada (Google Meet):`, opts.meetLink);
        } else if (linkToShare) {
          lines.push('', `Si necesita reprogramar o revisar los detalles de la cita, puede hacerlo aquí:`, linkToShare);
        }

        const msgText = lines.join('\n');
        if (opts.sendImmediately && canSend) {
          await handleSendReply(msgText);
          toast.success('Cita y enlace enviados al WhatsApp del cliente');
        } else {
          setComposerMode('whatsapp');
          setMessageInput(msgText);
          toast.success('Mensaje de confirmación listo en el chat para enviar');
        }
      }

      loadThread(false);
      loadSupportData(true);
    } catch (err: any) {
      toast.error(err?.message || 'Error al registrar cita en el chat');
    }
  };

  const pendingQuote = useMemo(
    () => (pendingQuoteId ? leadQuotes.find((q) => q.id === pendingQuoteId) || leadQuotes[0] || null : null),
    [pendingQuoteId, leadQuotes]
  );

  const activeQuickReplies = useMemo(() => {
    if (!activeCircle) return [];
    const isSalesScope = activeCircle.scope === 'lead' || activeCircle.scope === 'por_clasificar';
    const targetScope: 'soporte' | 'ventas' = isSalesScope ? 'ventas' : 'soporte';
    return customQuickReplies.filter((q) => q.scope === targetScope);
  }, [activeCircle, customQuickReplies]);

  const alertCircles = useMemo(() => {
    const wa = circles.filter((c) => {
      if (!c.isWhatsApp || c.scope === 'spam') return false;
      if (scopes.all && alertAreaFilter === 'ventas') {
        return c.scope === 'por_clasificar' || c.scope === 'lead';
      }
      if (scopes.all && alertAreaFilter === 'soporte') {
        return c.scope === 'soporte';
      }
      return true;
    });
    const urgent = wa
      .filter((c) => c.unreadOrWaitingReply && c.waitMinutes >= 15 && c.waitMinutes <= 24 * 60 && c.scope !== 'por_clasificar')
      .sort((a, b) => b.waitMinutes - a.waitMinutes);
    const newLeads = wa.filter((c) => c.scope === 'por_clasificar');
    const waitingRecent = wa
      .filter((c) => c.unreadOrWaitingReply && c.waitMinutes < 15 && c.scope !== 'por_clasificar')
      .sort((a, b) => b.waitMinutes - a.waitMinutes);
    return { urgent, newLeads, waitingRecent, total: urgent.length + newLeads.length + waitingRecent.length };
  }, [circles, scopes.all, alertAreaFilter]);

  const openTeamAccessModal = async () => {
    setShowTeamAccessModal(true);
    setLoadingTeamAccess(true);
    try {
      const res = await invoke({ action: 'get_wa_team_access', company_id: activeCompanyId });
      setTeamAccessList((res?.members || []) as TeamWaAccessMember[]);
    } catch (e: any) {
      toast.error(e?.message || 'Error al cargar accesos del equipo');
    } finally {
      setLoadingTeamAccess(false);
    }
  };

  const handleChangeUserWaAccess = async (targetUserId: string, nextMode: WaAccessMode) => {
    setSavingUserAccessId(targetUserId);
    try {
      await invoke({
        action: 'set_wa_user_access',
        target_user_id: targetUserId,
        access_mode: nextMode,
      });
      setTeamAccessList((prev) =>
        prev.map((m) => (m.id === targetUserId ? { ...m, access_mode: nextMode } : m))
      );
      const opt = WA_ACCESS_MODE_OPTIONS.find((o) => o.mode === nextMode);
      toast.success(`Acceso actualizado: ${opt?.shortLabel || nextMode}`);
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo actualizar el acceso');
    } finally {
      setSavingUserAccessId(null);
    }
  };

  const handleCompleteAndCloseTicket = async (notifyClient: boolean) => {
    if (!activeCircle || !aiTimeAudit) return;
    const hrs = Number(resForm.actual_hours) || 0;
    if (hrs <= 0) {
      toast.error('Nadie puede cerrar un ticket sin poner el Tiempo Real (> 0 horas).');
      return;
    }
    if (resForm.findings.trim().length < 5 || resForm.root_cause.trim().length < 5 || resForm.solution.trim().length < 5) {
      toast.error('Debes completar Hallazgos, Causa Raíz y Solución antes de cerrar el ticket.');
      return;
    }
    if (aiTimeAudit.status === 'inflated' && resForm.time_justification.trim().length < 8) {
      toast.error(`La IA detectó tiempo inflado (+${aiTimeAudit.differenceHours}h sobre lo esperado). Escribe la justificación.`);
      return;
    }
    setSavingResolution(true);
    try {
      const t = activeCircle.activeTicket;
      const meta = (t.metadata || {}) as Record<string, any>;
      await ticketService.updateTicket(t.id, {
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        actual_hours: hrs,
        findings: resForm.findings.trim(),
        root_cause: resForm.root_cause.trim(),
        solution: resForm.solution.trim(),
        metadata: {
          ...meta,
          time_justification: resForm.time_justification.trim(),
          ai_expected_hours: aiTimeAudit.expectedHours,
          ai_time_verdict: aiTimeAudit.status,
          chat_session_seconds: activeChatSeconds,
        },
      });
      if (notifyClient) {
        await handleSendReply(`Su caso ha sido resuelto (${resForm.solution.trim()}). Quedamos atentos a su confirmación.`);
      } else {
        toast.success('Ticket resuelto y auditado con éxito');
      }
      loadSupportData(true);
    } catch (err: any) {
      toast.error(err?.message || 'Error al cerrar el ticket');
    } finally {
      setSavingResolution(false);
    }
  };

  const openBridgeStatus = async () => {
    setShowStatusModal(true);
    setBridgeStatus(null);
    try {
      setBridgeStatus(await invoke({ action: 'bridge_status' }));
    } catch (e: any) {
      setBridgeStatus({ ok: false, error: e?.message });
    }
  };

  const formatTimer = (sec: number) => `${Math.floor(sec / 60)}m ${sec % 60 < 10 ? '0' : ''}${sec % 60}s`;
  const greetingTime = () => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Buenos días';
    if (hr < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const pickerOptions = useMemo(() => {
    const q = clientPickerQuery.trim().toLowerCase();
    const groups = waGroups
      .filter((g) => g.subject)
      .map((g) => ({ key: `g:${g.group_jid}`, label: g.subject as string, sub: 'Grupo de WhatsApp', group_jid: g.group_jid, client_id: g.client_id }));
    const cls = realClients.map((c) => ({ key: `c:${c.id}`, label: c.nombre, sub: c.contacto || c.telefono || 'Cliente', group_jid: null as string | null, client_id: c.id }));
    return [...groups, ...cls].filter((o) => !q || o.label.toLowerCase().includes(q) || String(o.sub).toLowerCase().includes(q)).slice(0, 40);
  }, [clientPickerQuery, waGroups, realClients]);

  // ── Render helpers ────────────────────────────────────────────────────────
  const ScopeChip: React.FC<{ circle: SupportCircle; compact?: boolean }> = ({ circle, compact }) => {
    const st = SCOPE_STYLE[circle.scope];
    const Icon = circle.isGroup ? Users : st.icon;
    let label: string = WA_SCOPE_LABELS[circle.scope];
    if (circle.scope === 'soporte') label = circle.isGroup ? 'Grupo' : circle.isWhatsApp ? 'Cliente' : 'Ticket';
    if (circle.scope === 'lead' && circle.leadStatus && !compact) label = `Lead · ${circle.leadStatus}`;
    if (circle.scope === 'spam' && circle.leadStatus) label = `Spam · Lead ${circle.leadStatus}`;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11.5px] font-bold shrink-0 ${st.chip}`}>
        <Icon className="w-3 h-3" />
        {label}
      </span>
    );
  };

  const renderMedia = (item: ChatItem) => {
    const m = item.media;
    if (m) {
      if (m.media_status === 'pending' || m.media_status === 'requested') {
        return (
          <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-50 rounded-xl px-3 py-2 my-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Descargando {m.message_type === 'image' ? 'imagen' : m.message_type === 'audio' ? 'nota de voz' : m.message_type === 'video' ? 'video' : 'archivo'}…
          </div>
        );
      }
      if (m.media_status === 'failed') {
        return (
          <div className="flex items-center gap-2 text-[11px] text-rose-700 bg-rose-50 rounded-xl px-3 py-2 my-1">
            <ImageOff className="w-3.5 h-3.5" />
            <span>No se pudo descargar el archivo</span>
            <button type="button" onClick={() => handleRetryMedia(m.id)} className="ml-auto font-bold underline">
              Reintentar
            </button>
          </div>
        );
      }
      if (!m.url) {
        return <div className="w-56 h-32 rounded-xl bg-slate-100 animate-pulse my-1" />;
      }
      if (m.message_type === 'image' || m.message_type === 'sticker' || (m.media_mime || '').startsWith('image/')) {
        return (
          <a href={m.url} target="_blank" rel="noopener noreferrer" className="block my-1">
            <img
              src={m.url}
              alt={m.media_filename || 'Imagen'}
              className={`${m.message_type === 'sticker' ? 'w-28 h-28 object-contain' : 'max-w-xs max-h-80 object-cover'} rounded-xl`}
              loading="lazy"
            />
          </a>
        );
      }
      if (m.message_type === 'video' || (m.media_mime || '').startsWith('video/')) {
        return <video src={m.url} controls className="max-w-xs rounded-xl my-1" />;
      }
      if (m.message_type === 'audio' || (m.media_mime || '').startsWith('audio/')) {
        return <audio src={m.url} controls preload="metadata" className="w-72 h-9 my-1" />;
      }
      return (
        <a
          href={m.url}
          target="_blank"
          rel="noopener noreferrer"
          download={m.media_filename || undefined}
          className="flex items-center gap-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 my-1 transition"
        >
          <FileText className="w-8 h-8 text-indigo-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800 truncate max-w-[220px]">{m.media_filename || 'Documento'}</p>
            <p className="text-[10px] text-slate-500">{[m.media_mime?.split('/')[1]?.toUpperCase(), formatBytes(m.media_size)].filter(Boolean).join(' · ')}</p>
          </div>
          <Download className="w-4 h-4 text-slate-500 ml-auto shrink-0" />
        </a>
      );
    }
    const lm = item.legacyMedia;
    if (lm) {
      if (lm.type === 'audio') return <audio src={lm.url} controls preload="metadata" className="w-72 h-9 my-1" />;
      if (lm.type === 'image')
        return (
          <a href={lm.url} target="_blank" rel="noopener noreferrer" className="block my-1">
            <img src={lm.url} alt={lm.name || 'Imagen'} className="max-w-xs rounded-xl" />
          </a>
        );
      if (lm.type === 'video') return <video src={lm.url} controls className="max-w-xs rounded-xl my-1" />;
      return (
        <a href={lm.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-bold text-indigo-700 underline my-1">
          <Paperclip className="w-3.5 h-3.5" />
          {lm.name || 'Archivo adjunto'}
        </a>
      );
    }
    return null;
  };

  // ── Access guard ──────────────────────────────────────────────────────────
  if (profile && !scopes.any) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#F5F6FA] p-8">
        <div className="bg-white rounded-3xl p-8 max-w-md text-center shadow-sm border border-slate-200">
          <ShieldCheck className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h2 className="text-lg font-black text-slate-900">Sin acceso al Chat WhatsApp</h2>
          <p className="text-sm text-slate-600 mt-2">
            Pide a un administrador que active en tu rol el permiso <strong>Chat WhatsApp: Clientes de Soporte</strong> o{' '}
            <strong>Chat WhatsApp: Leads</strong> (Equipo → Roles).
          </p>
        </div>
      </div>
    );
  }

  const roleChip = scopes.all ? 'ADMIN' : scopes.soporte && scopes.leads ? 'SOPORTE + VENTAS' : scopes.soporte ? 'SOPORTE' : 'VENTAS';

  return (
    <div className="h-screen flex-1 flex flex-col bg-[#F5F6FA] overflow-hidden">
      {/* ── TOP HEADER (100% Light & Vector Clean) ── */}
      <header className="h-12 bg-white border-b border-slate-200/80 px-5 flex items-center justify-between shrink-0 z-30 relative">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4.5 rounded-full bg-indigo-600" />
            <span className="text-[15px] font-bold text-slate-900 tracking-tight">Chat WhatsApp</span>
          </div>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <span className="text-[13px] text-slate-500 hidden sm:inline truncate">
            {greetingTime()}, <strong className="font-bold text-slate-800">{profile?.full_name?.split(' ')[0] || ''}</strong>
          </span>
          <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[13px] font-medium bg-slate-100 text-slate-600 border border-slate-200/70">
            <Phone className="w-3.5 h-3.5 text-indigo-600" />
            +503 7971-8911
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick sound toggle */}
          <button
            type="button"
            onClick={toggleSound}
            title={soundEnabled ? 'Alarma sonora activada (clic para silenciar)' : 'Alarma silenciada (clic para activar y probar)'}
            className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-600 transition"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-indigo-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>

          {/* Interactive Alert Bell & Notification Center */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAlertsPopover((v) => !v)}
              title="Centro de Alertas y Seguimiento"
              className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 text-[13px] font-semibold transition"
            >
              {alertCircles.total > 0 || bellRinging ? (
                <BellRing className={`w-4 h-4 text-indigo-600 ${bellRinging ? 'animate-bounce' : ''}`} />
              ) : (
                <Bell className="w-4 h-4 text-slate-500" />
              )}
              <span>Alertas</span>
              {alertCircles.total > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold border ${
                    alertCircles.urgent.length > 0 || alertCircles.newLeads.length > 0
                      ? 'bg-rose-50 text-rose-600 border-rose-200'
                      : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  }`}
                >
                  {alertCircles.total}
                </span>
              )}
            </button>

            {showAlertsPopover && (
              <>
                <div
                  className="fixed inset-0 bg-slate-900/15 backdrop-blur-[1px] z-40"
                  onClick={() => setShowAlertsPopover(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-[480px] max-w-[92vw] bg-[#F4F6FA] border-2 border-indigo-200/90 ring-1 ring-slate-900/10 rounded-2xl shadow-[0_24px_60px_rgba(15,23,42,0.24)] z-50 overflow-hidden">
                  <div className="px-4 py-3 bg-[#EEF0FF] border-b border-indigo-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-2xs">
                        <Bell className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[13.5px] font-bold text-indigo-950 tracking-tight">Centro de Alertas WhatsApp</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const ok = playWaAlertSound('test');
                          if (ok) toast.success('Alarma sonora verificada correctamente');
                          else toast.error('El navegador bloqueó el audio; haz clic e intenta de nuevo');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-700 shadow-2xs transition"
                      >
                        Probar sonido
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAlertsPopover(false)}
                        className="p-1 rounded-lg text-indigo-700/70 hover:text-indigo-950 hover:bg-indigo-100/70"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="px-4 py-2 bg-white border-b border-slate-200/80 flex items-center justify-between gap-2 text-xs">
                    <label className="flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={soundEnabled}
                        onChange={toggleSound}
                        className="rounded border-slate-300 text-indigo-600"
                      />
                      <span>Sonido al recibir mensajes</span>
                    </label>
                    {typeof Notification !== 'undefined' && Notification.permission !== 'granted' && (
                      <button
                        type="button"
                        onClick={() => {
                          Notification.requestPermission().then((p) => {
                            if (p === 'granted') toast.success('Alertas de escritorio activadas');
                          });
                        }}
                        className="text-xs font-semibold text-indigo-600 hover:underline"
                      >
                        Activar aviso en escritorio
                      </button>
                    )}
                  </div>

                  {scopes.all && (
                    <div className="px-4 py-2 bg-white border-b border-slate-200/80 flex items-center gap-1">
                      <span className="text-xs font-medium text-slate-400 mr-1.5">Área:</span>
                      {(
                        [
                          { id: 'all', label: 'Todo' },
                          { id: 'ventas', label: 'Ventas / Leads' },
                          { id: 'soporte', label: 'Soporte Técnico' },
                        ] as const
                      ).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setAlertAreaFilter(f.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs transition ${
                            alertAreaFilter === f.id
                              ? 'bg-indigo-50 text-indigo-700 font-bold'
                              : 'text-slate-600 hover:bg-slate-50 font-medium'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="max-h-[420px] overflow-y-auto p-3 space-y-3 bg-[#F4F6FA]">
                    {alertCircles.total === 0 ? (
                      <div className="p-8 bg-white rounded-xl border border-slate-200/80 text-center space-y-1">
                        <CheckCircle2 className="w-6 h-6 text-slate-400 mx-auto" />
                        <p className="text-[13px] font-bold text-slate-800">Todo al día</p>
                        <p className="text-xs text-slate-400">No hay conversaciones ni leads pendientes de respuesta.</p>
                      </div>
                    ) : (
                      <>
                        {alertCircles.newLeads.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="px-1 flex items-center justify-between">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
                                Leads nuevos por tomar ({alertCircles.newLeads.length})
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              {alertCircles.newLeads.slice(0, 6).map((c) => (
                                <button
                                  key={c.circleId}
                                  type="button"
                                  onClick={() => {
                                    setSearchQuery('');
                                    setOwnerFilter('all');
                                    setChannelFilter('all');
                                    setCircleFilter('por_clasificar');
                                    setSelectedCircleId(c.circleId);
                                    setShowAlertsPopover(false);
                                  }}
                                  className="w-full text-left px-3.5 py-2.5 bg-white hover:bg-indigo-50/40 rounded-xl border border-slate-200/90 hover:border-indigo-300 shadow-2xs flex items-center gap-3 transition"
                                >
                                  <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-700 font-semibold text-xs flex items-center justify-center shrink-0">
                                    {initials(c.clientName)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="text-[13.5px] font-semibold text-slate-900 truncate">{c.clientName}</span>
                                        <span className="text-xs text-slate-400 shrink-0">· Por tomar</span>
                                      </div>
                                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/70 text-[11px] font-semibold shrink-0">
                                        {c.waitMinutes > 0 ? formatWaitDuration(c.waitMinutes) : listTimeLabel(c.lastMessageAt)}
                                      </span>
                                    </div>
                                    <p className="text-[12.5px] text-slate-500 truncate mt-0.5">{c.lastMessageText}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {alertCircles.urgent.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="px-1 flex items-center justify-between">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-rose-500" />
                                Espera mayor a 15 min ({alertCircles.urgent.length})
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              {alertCircles.urgent.slice(0, 8).map((c) => {
                                const shortType = c.scope === 'soporte' ? (c.isGroup ? 'Grupo' : 'Cliente') : 'Lead';
                                return (
                                  <div
                                    key={c.circleId}
                                    className="px-3.5 py-2.5 bg-white hover:bg-indigo-50/40 rounded-xl border border-slate-200/90 hover:border-indigo-300 shadow-2xs flex items-center gap-3 transition"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSearchQuery('');
                                        setOwnerFilter('all');
                                        setChannelFilter('all');
                                        setCircleFilter('all');
                                        setSelectedCircleId(c.circleId);
                                        setShowAlertsPopover(false);
                                      }}
                                      className="flex-1 min-w-0 text-left flex items-center gap-3"
                                    >
                                      <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 font-semibold text-xs flex items-center justify-center shrink-0">
                                        {c.isGroup ? <Users className="w-4 h-4" /> : initials(c.clientName)}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="text-[13.5px] font-semibold text-slate-900 truncate">{c.clientName}</span>
                                            <span className="text-xs text-slate-400 shrink-0">· {shortType}</span>
                                          </div>
                                          <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-200/80 text-[11px] font-semibold shrink-0">
                                            {formatWaitDuration(c.waitMinutes)}
                                          </span>
                                        </div>
                                        <p className="text-[12.5px] text-slate-500 truncate mt-0.5">{c.lastMessageText}</p>
                                      </div>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleMarkCircleAttended(c)}
                                      title="Marcar como ya atendido"
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-200/70 transition shrink-0"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {alertCircles.waitingRecent.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="px-1 flex items-center justify-between">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                En espera reciente ({alertCircles.waitingRecent.length})
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              {alertCircles.waitingRecent.slice(0, 6).map((c) => {
                                const shortType = c.scope === 'soporte' ? (c.isGroup ? 'Grupo' : 'Cliente') : 'Lead';
                                return (
                                  <button
                                    key={c.circleId}
                                    type="button"
                                    onClick={() => {
                                      setSearchQuery('');
                                      setOwnerFilter('all');
                                      setChannelFilter('all');
                                      setCircleFilter('all');
                                      setSelectedCircleId(c.circleId);
                                      setShowAlertsPopover(false);
                                    }}
                                    className="w-full text-left px-3.5 py-2.5 bg-white hover:bg-indigo-50/40 rounded-xl border border-slate-200/90 hover:border-indigo-300 shadow-2xs flex items-center gap-3 transition"
                                  >
                                    <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 font-semibold text-xs flex items-center justify-center shrink-0">
                                      {c.isGroup ? <Users className="w-4 h-4" /> : initials(c.clientName)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span className="text-[13.5px] font-semibold text-slate-900 truncate">{c.clientName}</span>
                                          <span className="text-xs text-slate-400 shrink-0">· {shortType}</span>
                                        </div>
                                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/70 text-[11px] font-semibold shrink-0">
                                          {formatWaitDuration(c.waitMinutes)}
                                        </span>
                                      </div>
                                      <p className="text-[12.5px] text-slate-500 truncate mt-0.5">{c.lastMessageText}</p>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {adminPreviewMode ? (
            <button
              type="button"
              onClick={() => {
                setAdminPreviewMode(null);
                setCircleFilter('all');
                toast.success('Volviste a la vista completa de Administrador');
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition"
              title="Salir de la vista previa y volver a ver todo como Admin"
            >
              <span>
                Vista previa: {WA_ACCESS_MODE_OPTIONS.find((o) => o.mode === adminPreviewMode)?.shortLabel}
              </span>
              <X className="w-3 h-3" />
            </button>
          ) : (
            <span className="hidden md:inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200/70">
              {roleChip}
            </span>
          )}
          {isRealAdmin && (
            <>
              <button
                type="button"
                onClick={openTeamAccessModal}
                title="Configurar qué ven los Técnicos, los Vendedores y los Administradores"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 transition"
              >
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>Accesos</span>
              </button>
              <button
                onClick={() => setShowAiPromptModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold bg-indigo-50/70 hover:bg-indigo-100/70 text-indigo-700 border border-indigo-200/60 transition"
              >
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>IA</span>
              </button>
              <button
                onClick={openBridgeStatus}
                title="Estado de la conexión WhatsApp"
                className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200/80 transition"
              >
                <Settings className="w-4 h-4" />
              </button>
            </>
          )}
          <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-bold text-[13px] flex items-center justify-center">
            {initials(profile?.full_name || 'AD')}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* ── LEFT: chat list (Clean, Airy, Uncluttered) ── */}
        <aside style={{ width: `${leftPanelWidth}px` }} className="bg-white flex flex-col shrink-0 relative">
          <div className="px-3.5 pt-2.5 pb-1.5 border-b border-slate-100 space-y-1.5 relative">
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar cliente, grupo o teléfono..."
                  className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-[13px] font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    title="Limpiar búsqueda"
                    className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 absolute right-2 top-1/2 -translate-y-1/2 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowFilterMenu((v) => !v)}
                className={`px-2.5 py-1.5 rounded-xl border text-[12.5px] font-semibold inline-flex items-center gap-1.5 shrink-0 transition ${
                  ownerFilter !== 'all' || channelFilter !== 'all' || ['interno', 'spam', 'tickets'].includes(circleFilter)
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90'
                }`}
              >
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <span>Filtros</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              <button
                onClick={() => loadSupportData()}
                title={`Actualizar (${filteredCircles.length} conversaciones)`}
                className="p-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200/80 flex items-center justify-center transition shrink-0"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
              </button>
            </div>

            {/* Clean Filter Dropdown Menu */}
            {showFilterMenu && (
              <div className="absolute right-4 top-11 w-60 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 z-30 space-y-1 text-xs">
                <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                  <span>Filtrar conversaciones</span>
                  <button type="button" onClick={() => setShowFilterMenu(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                {(
                  [
                    { id: 'all', label: 'Todas las conversaciones', count: counts.all },
                    { id: 'mine', label: 'Asignadas a mí', count: counts.mine },
                    { id: 'unassigned', label: 'Sin asignar', count: counts.unassigned },
                    { id: 'urgent', label: 'Espera > 15 min', count: counts.slaCritical, urgent: true },
                  ] as { id: OwnerSubFilter; label: string; count: number; urgent?: boolean }[]
                ).map((sf) => {
                  const active = ownerFilter === sf.id && !['interno', 'spam', 'tickets'].includes(circleFilter);
                  return (
                    <button
                      key={sf.id}
                      type="button"
                      onClick={() => {
                        if (['interno', 'spam', 'tickets'].includes(circleFilter)) setCircleFilter('all');
                        setOwnerFilter(sf.id);
                        setShowFilterMenu(false);
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-xl flex items-center justify-between transition ${
                        active
                          ? 'bg-indigo-50 text-indigo-700 font-semibold'
                          : sf.urgent && sf.count > 0
                          ? 'text-rose-600 hover:bg-rose-50/60 font-medium'
                          : 'text-slate-700 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      <span>{sf.label}</span>
                      <span className="text-slate-400">{sf.count}</span>
                    </button>
                  );
                })}

                {scopes.all && (
                  <div className="pt-1.5 mt-1 border-t border-slate-100 space-y-0.5">
                    <div className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Otras bandejas</div>
                    {(
                      [
                        ...(counts.reactivatedTotal > 0
                          ? [
                              {
                                id: 'reactivados' as CircleFilter,
                                label: `Reactivados WhatsApp (${counts.reactivatedReplied}/${counts.reactivatedTotal})`,
                                count: counts.reactivatedTotal,
                              },
                            ]
                          : []),
                        { id: 'interno' as CircleFilter, label: 'Equipo interno', count: counts.interno },
                        { id: 'spam' as CircleFilter, label: 'Spam / bloqueados', count: counts.spam },
                        ...(counts.tickets > 0 ? [{ id: 'tickets' as CircleFilter, label: 'Otros tickets (no WhatsApp)', count: counts.tickets }] : []),
                      ]
                    ).map((sec) => {
                      const active = circleFilter === sec.id;
                      return (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setOwnerFilter('all');
                            setChannelFilter('all');
                            setCircleFilter(sec.id);
                            setShowFilterMenu(false);
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-xl flex items-center justify-between transition ${
                            active ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700 hover:bg-slate-50 font-medium'
                          }`}
                        >
                          <span>{sec.label}</span>
                          <span className="text-slate-400">{sec.count}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {circleFilter === 'soporte' && (
                  <div className="pt-1.5 mt-1 border-t border-slate-100 px-2 pb-1 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400">Área de soporte</span>
                    <select
                      value={channelFilter}
                      onChange={(e) => {
                        setChannelFilter(e.target.value as 'all' | SupportChannelType);
                        setShowFilterMenu(false);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200 focus:outline-none"
                    >
                      <option value="all">Todas las áreas</option>
                      <option value="soporte">Soporte / Operaciones</option>
                      <option value="contabilidad">Contabilidad / Finanzas</option>
                      <option value="otros">Otros</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Single clean row of primary scope tabs (compact height, resets stuck search/subfilters on switch) */}
            <div className="flex items-center gap-1 flex-wrap">
              {filterTabs.map((tab) => {
                const active = circleFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setOwnerFilter('all');
                      setChannelFilter('all');
                      setLeadSubFilter('activos');
                      setCircleFilter(tab.id);
                    }}
                    className={`px-2 py-1 rounded-lg text-[12.5px] whitespace-nowrap transition inline-flex items-center gap-1 ${
                      active
                        ? 'bg-indigo-50 text-indigo-700 font-bold'
                        : 'text-slate-600 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    {tab.alert && !active && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {(circleFilter === 'reactivados' || circleFilter === 'lead') && (
              <div className="pt-1 border-t border-slate-100 space-y-1">
                {circleFilter === 'reactivados' && counts.reactivatedTotal > 0 && (
                  <div className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-between text-[12px] text-slate-600">
                    <span>
                      Enviados: <b className="text-slate-800">{counts.reactivatedTotal}</b> · Respondieron:{' '}
                      <b className="text-slate-900">{counts.reactivatedReplied}</b>
                    </span>
                    <span className="font-bold text-indigo-700">
                      {Math.round((counts.reactivatedReplied / Math.max(1, counts.reactivatedTotal)) * 100)}% respuesta
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-1 flex-wrap">
                  {(
                    [
                      {
                        id: 'activos' as LeadStageSubFilter,
                        label: circleFilter === 'reactivados' ? `Interesados (${leadSubCounts.activos})` : `Activos (${leadSubCounts.activos})`,
                      },
                      { id: 'conversando' as LeadStageSubFilter, label: `Seguimiento / Demo (${leadSubCounts.conversando})` },
                      { id: 'perdidos' as LeadStageSubFilter, label: `Perdidos (${leadSubCounts.perdidos})` },
                      { id: 'erroneos' as LeadStageSubFilter, label: `Erróneos (${leadSubCounts.erroneos})` },
                      { id: 'todos' as LeadStageSubFilter, label: `Todos (${leadSubCounts.todos})` },
                    ]
                  ).map((sf) => {
                    const active = leadSubFilter === sf.id;
                    return (
                      <button
                        key={sf.id}
                        type="button"
                        onClick={() => setLeadSubFilter(sf.id)}
                        className={`px-2 py-0.5 rounded-md text-[12px] transition ${
                          active
                            ? 'bg-slate-800 text-white font-semibold'
                            : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 font-medium'
                        }`}
                      >
                        {sf.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loading && circles.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-slate-400 font-medium">Cargando chats…</div>
            ) : filteredCircles.length === 0 ? (
              <div className="p-8 text-center space-y-2.5">
                <p className="text-[13px] text-slate-400 font-medium">No hay conversaciones en esta vista.</p>
                {(searchQuery || ownerFilter !== 'all' || channelFilter !== 'all' || leadSubFilter !== 'todos') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setOwnerFilter('all');
                      setChannelFilter('all');
                      setLeadSubFilter('todos');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Ver todos</span>
                  </button>
                )}
              </div>
            ) : (
              filteredCircles.map((circle) => {
                const isSelected = activeCircle?.circleId === circle.circleId;
                const unread = isUnread(circle);
                const isOverdue = circle.unreadOrWaitingReply && circle.waitMinutes >= 15 && circle.waitMinutes <= 24 * 60;
                const shortType =
                  circle.scope === 'soporte'
                    ? circle.isGroup
                      ? 'Grupo'
                      : 'Cliente'
                    : circle.scope === 'por_clasificar'
                    ? 'Por tomar'
                    : circle.scope === 'lead'
                    ? circle.leadStatus && circle.leadStatus !== 'Prospecto'
                      ? circle.leadStatus
                      : 'Lead'
                    : circle.scope === 'interno'
                    ? 'Equipo'
                    : 'Spam';

                return (
                  <button
                    key={circle.circleId}
                    type="button"
                    onClick={() => {
                      markCircleAsRead(circle.circleId, circle.lastMessageAt);
                      setSelectedCircleId(circle.circleId);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 flex items-center gap-2.5 transition relative border-l-[3px] ${
                      isSelected
                        ? 'bg-indigo-50/80 border-l-indigo-600'
                        : unread
                        ? 'bg-[#F5F7FF] hover:bg-indigo-50/60 border-l-indigo-500'
                        : 'bg-white hover:bg-slate-50/80 border-l-transparent'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div
                        className={`w-9.5 h-9.5 rounded-full flex items-center justify-center text-[13px] ${
                          unread
                            ? 'bg-indigo-100 text-indigo-700 font-bold ring-1 ring-indigo-200/80'
                            : isSelected
                            ? 'bg-indigo-100 text-indigo-700 font-semibold'
                            : 'bg-slate-100 text-slate-500 font-semibold'
                        }`}
                      >
                        {circle.isGroup ? <Users className="w-4 h-4" /> : initials(circle.clientName)}
                      </div>
                      {unread && <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 border-2 border-white absolute -top-0.5 -right-0.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`text-[14px] truncate ${unread ? 'font-extrabold text-slate-950' : 'font-semibold text-slate-700'}`}>
                            {circle.clientName}
                          </span>
                          <span
                            className={`text-[12px] shrink-0 ${
                              circle.leadStatus === 'Perdido' || circle.leadStatus === 'Erróneo'
                                ? 'text-slate-500 font-semibold'
                                : 'text-slate-400'
                            }`}
                          >
                            · {shortType}
                          </span>
                          {circle.isReactivation && (
                            <span
                              title={circle.reactivationCampaign || 'Campaña de reactivación WhatsApp'}
                              className={`px-1.5 py-0.5 rounded text-[11px] font-medium shrink-0 ${
                                circle.reactivationReplied
                                  ? 'bg-slate-100 text-slate-700 border border-slate-200/80'
                                  : 'text-slate-400'
                              }`}
                            >
                              {circle.reactivationReplied ? 'Respondió' : 'Reactivación'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isOverdue && (
                            <span
                              title={`Esperando respuesta hace ${formatWaitDuration(circle.waitMinutes)}`}
                              className="px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-200 text-[11.5px] font-semibold inline-flex items-center gap-0.5"
                            >
                              <Clock className="w-3 h-3" />
                              {formatWaitDuration(circle.waitMinutes)}
                            </span>
                          )}
                          <span className={`text-[12px] ${unread ? 'font-bold text-indigo-600' : 'text-slate-400'}`}>
                            {listTimeLabel(circle.lastMessageAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className={`text-[13px] truncate ${unread ? 'text-slate-800 font-semibold' : 'text-slate-400 font-normal'}`}>
                          {circle.lastMessageSender}: {circle.lastMessageText}
                        </p>
                        {unread && (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10.5px] font-bold leading-none shrink-0">
                            Nuevo
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ── Resizer ── */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            resizeStartXRef.current = e.clientX;
            resizeStartWidthRef.current = leftPanelWidth;
            setIsResizingLeft(true);
          }}
          onDoubleClick={() => {
            const next = leftPanelWidth < 480 ? 520 : 360;
            setLeftPanelWidth(next);
            localStorage.setItem('crm_circles_left_width', String(next));
          }}
          title="Arrastra para cambiar el ancho de la lista (doble clic para expandir)"
          className={`w-1.5 shrink-0 cursor-col-resize relative group transition-colors flex items-center justify-center z-20 ${
            isResizingLeft ? 'bg-indigo-600' : 'bg-slate-200/80 hover:bg-indigo-500'
          }`}
        >
          <div className={`w-1 h-10 rounded-full transition-all ${isResizingLeft ? 'bg-white scale-y-125' : 'bg-slate-400/60 group-hover:bg-white'}`} />
        </div>

        {/* ── CENTER: chat ── */}
        {activeCircle ? (
          <main className="flex-1 flex flex-col bg-[#F3F4F8] overflow-hidden min-w-0">
            {/* Chat header (Compact 2-line height, Uncluttered, 100% Vector Icons) */}
            <div className="bg-white border-b border-slate-200/70 px-4 py-1.5 flex items-center justify-between gap-2 flex-wrap xl:flex-nowrap shrink-0">
              <div className="flex items-center gap-2.5 min-w-[200px] flex-1 overflow-hidden">
                <div className={`w-9 h-9 rounded-full font-bold text-[13px] flex items-center justify-center shrink-0 ${SCOPE_STYLE[activeCircle.scope].avatar}`}>
                  {activeCircle.isGroup ? <Users className="w-4 h-4" /> : initials(activeCircle.clientName)}
                </div>
                <div className="min-w-0 flex-1">
                  {/* Line 1: Name + compact status chips (Never wraps vertically) */}
                  <div className="flex items-center gap-1.5 whitespace-nowrap overflow-hidden">
                    <h3 className="text-[15px] font-bold text-slate-900 tracking-tight truncate max-w-[190px] 2xl:max-w-[260px]">
                      {activeCircle.clientName}
                    </h3>
                    <ScopeChip circle={activeCircle} compact={Boolean(activeCircle.leadId)} />
                    {activeCircle.isReactivation && (
                      <span
                        title={activeCircle.reactivationCampaign || 'Campaña de reactivación WhatsApp'}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold border shrink-0 ${
                          activeCircle.reactivationReplied
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                            : 'bg-indigo-50/70 text-indigo-700 border-indigo-200/80'
                        }`}
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>{activeCircle.reactivationReplied ? 'Respondió' : 'Reactivación'}</span>
                      </span>
                    )}
                    {activeCircle.unreadOrWaitingReply && activeCircle.waitMinutes >= 15 && activeCircle.waitMinutes <= 24 * 60 && (
                      <span
                        title={`Esperando respuesta hace ${formatWaitDuration(activeCircle.waitMinutes)}`}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-600 border border-rose-200/80 shrink-0"
                      >
                        <Clock className="w-2.5 h-2.5" />
                        <span>{formatWaitDuration(activeCircle.waitMinutes)}</span>
                      </span>
                    )}
                    {activeCircle.unreadOrWaitingReply && (
                      <button
                        type="button"
                        onClick={() => handleMarkCircleAttended(activeCircle)}
                        title="Marcar conversación como ya atendida (quita la alerta de espera)"
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 transition shrink-0"
                      >
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>Atendido</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleMarkCircleUnread(activeCircle)}
                      title="Devolver conversación a No leído (Nuevo / Sin contestar)"
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold border transition shrink-0 ${
                        isUnread(activeCircle)
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : 'bg-slate-100/90 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border-slate-200/80'
                      }`}
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>No leído</span>
                    </button>
                  </div>

                  {/* Line 2: Phone, PushName, Owner & Groups inline on a single truncated row */}
                  <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate-400 whitespace-nowrap overflow-hidden mt-0.5">
                    <span className="truncate">
                      {activeCircle.isGroup
                        ? 'Grupo de WhatsApp'
                        : [
                            activeCircle.phone ? `+${activeCircle.phone}` : null,
                            activeCircle.pushName && activeCircle.pushName.toLowerCase() !== activeCircle.clientName.toLowerCase()
                              ? `WhatsApp: ${activeCircle.pushName}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                      {activeCircle.scope === 'soporte' ? ` · Atiende: ${activeCircle.assignedTechName}` : ''}
                      {activeCircle.scope === 'lead' ? ` · Vendedor: ${activeCircle.leadOwnerName || 'Sin asignar'}` : ''}
                    </span>
                    {!activeCircle.isGroup && activeCircle.memberOfGroups.length > 0 && (
                      <div className="inline-flex items-center gap-1 shrink-0">
                        <span className="text-slate-300">·</span>
                        {activeCircle.memberOfGroups.slice(0, 2).map((g) => {
                          const groupCircleId = `wa:${g.jid}`;
                          const exists = circles.some((c) => c.circleId === groupCircleId);
                          return (
                            <button
                              key={g.jid}
                              type="button"
                              disabled={!exists}
                              onClick={() => exists && setSelectedCircleId(groupCircleId)}
                              className="text-[10.5px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200/70 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-70 transition"
                            >
                              {g.subject || 'Grupo'}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-1.5 shrink-0 ml-auto">
                {/* Support area selector + quick tech assignment */}
                {activeCircle.scope === 'soporte' && activeCircle.isWhatsApp && (
                  <>
                    <div className="relative flex items-center">
                      <Wrench className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                      <select
                        value={activeCircle.supportChannel}
                        onChange={(e) => handleSwitchChannel(e.target.value as SupportChannelType)}
                        className="pl-8 pr-3 py-1 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 cursor-pointer focus:outline-none transition"
                      >
                        <option value="soporte">Soporte / Operaciones</option>
                        <option value="contabilidad">Contabilidad / Finanzas</option>
                        <option value="otros">Otros</option>
                      </select>
                    </div>
                    {!activeCircle.assignedTechId && profile?.id && (
                      <button
                        type="button"
                        onClick={() => handleAssignTech(profile.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 transition"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Tomar caso
                      </button>
                    )}
                  </>
                )}

                {/* Commercial Lead & Quote controls (Sales & Multi-Industry SaaS) */}
                {!activeCircle.isGroup &&
                  activeCircle.isWhatsApp &&
                  (activeCircle.scope === 'lead' || activeCircle.scope === 'por_clasificar') &&
                  (scopes.all || scopes.leads) && (
                    <>
                      {activeCircle.leadId && (
                        <div className="relative flex items-center gap-0.5 bg-slate-50 border border-slate-200/80 rounded-xl p-0.5">
                          {(
                            [
                              { st: 'En seguimiento', label: 'Seguimiento' },
                              { st: 'Perdido', label: 'Perdido' },
                              { st: 'Erróneo', label: 'Erróneo' },
                            ] as const
                          ).map((quick) => {
                            const active = activeCircle.leadStatus === quick.st;
                            return (
                              <button
                                key={quick.st}
                                type="button"
                                onClick={() => {
                                  setShowStagePopover(false);
                                  handleUpdateLeadStatus(quick.st);
                                }}
                                title={`Cambiar etapa a ${quick.st}`}
                                className={`px-2 py-1 rounded-lg text-[12px] transition ${
                                  active
                                    ? 'bg-slate-800 text-white font-bold shadow-2xs'
                                    : 'text-slate-600 hover:bg-white font-semibold'
                                }`}
                              >
                                {quick.label}
                              </button>
                            );
                          })}

                          {/* Modern Custom Dropdown for Lead Stage */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                setShowStagePopover((v) => !v);
                                setShowDiscoveryPopover(false);
                                setShowCalendarPopover(false);
                                setShowQuotesPopover(false);
                              }}
                              title="Cambiar etapa del Lead"
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[12px] font-semibold transition ${
                                showStagePopover
                                  ? 'bg-white text-slate-900 shadow-2xs'
                                  : 'text-slate-700 hover:bg-white'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  activeCircle.leadStatus === 'Cerrado'
                                    ? 'bg-emerald-500'
                                    : activeCircle.leadStatus === 'En seguimiento' ||
                                      activeCircle.leadStatus === 'Negociación' ||
                                      activeCircle.leadStatus === 'Lead calificado'
                                    ? 'bg-indigo-500'
                                    : activeCircle.leadStatus === 'Perdido' || activeCircle.leadStatus === 'Erróneo'
                                    ? 'bg-rose-400'
                                    : 'bg-slate-400'
                                }`}
                              />
                              <span>{activeCircle.leadStatus || 'Prospecto'}</span>
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            </button>

                            {showStagePopover && (
                              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 p-1.5 space-y-0.5">
                                <div className="px-2.5 py-1 flex items-center justify-between border-b border-slate-100 mb-0.5">
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                    Etapa del Lead
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setShowStagePopover(false)}
                                    className="text-slate-400 hover:text-slate-600"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                {LEAD_STATUS_OPTIONS.map((st) => {
                                  const isSelected = (activeCircle.leadStatus || 'Prospecto') === st;
                                  const dotColor =
                                    st === 'Cerrado'
                                      ? 'bg-emerald-500'
                                      : st === 'En seguimiento' || st === 'Negociación' || st === 'Lead calificado'
                                      ? 'bg-indigo-500'
                                      : st === 'Perdido' || st === 'Erróneo'
                                      ? 'bg-rose-400'
                                      : 'bg-slate-400';
                                  return (
                                    <button
                                      key={st}
                                      type="button"
                                      onClick={() => {
                                        setShowStagePopover(false);
                                        handleUpdateLeadStatus(st);
                                      }}
                                      className={`w-full px-2.5 py-1.5 rounded-xl text-[13px] flex items-center justify-between transition ${
                                        isSelected
                                          ? 'bg-indigo-50 text-indigo-700 font-bold'
                                          : 'text-slate-700 hover:bg-slate-50 font-medium'
                                      }`}
                                    >
                                      <span className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                                        <span>{st}</span>
                                      </span>
                                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Diagnóstico Express + Método ARIAS (7 Preguntas) */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setShowDiscoveryPopover((v) => !v);
                            setShowStagePopover(false);
                            setShowCalendarPopover(false);
                            setShowQuotesPopover(false);
                          }}
                          title="Enviar formulario de diagnóstico al prospecto o abrir las 7 preguntas del Método ARIAS"
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[12.5px] font-semibold border transition ${
                            Object.keys(activeDiscoveryAnswers).length > 0
                              ? 'bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-800 border-emerald-200'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80'
                          }`}
                        >
                          <Target className="w-3.5 h-3.5 text-slate-600" />
                          <span>Diagnóstico</span>
                          {Object.keys(activeDiscoveryAnswers).length > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10.5px] font-bold">
                              {Object.keys(activeDiscoveryAnswers).length}/7
                            </span>
                          )}
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        </button>

                        {showDiscoveryPopover && (
                          <div className="absolute right-0 top-full mt-1.5 w-84 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 p-3 space-y-2.5">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                              <div>
                                <p className="text-xs font-bold text-slate-900">Diagnóstico previo a cotizar</p>
                                <p className="text-[11px] text-slate-500">
                                  El prospecto lo llena en 30 seg y se guarda en su ficha
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowDiscoveryPopover(false)}
                                className="text-slate-400 hover:text-slate-600"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {Object.keys(activeDiscoveryAnswers).length > 0 && (
                              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1 text-[11px] text-slate-700">
                                <p className="font-bold text-slate-900 flex items-center justify-between">
                                  <span>Respuestas recibidas</span>
                                  <span className="text-emerald-700 font-bold">
                                    {Object.keys(activeDiscoveryAnswers).length} de 7
                                  </span>
                                </p>
                                {activeDiscoveryAnswers.q1 && (
                                  <p className="truncate">
                                    <span className="font-semibold text-slate-500">Dolor:</span> {activeDiscoveryAnswers.q1}
                                  </p>
                                )}
                                {activeDiscoveryAnswers.q6 && (
                                  <p className="truncate">
                                    <span className="font-semibold text-slate-500">Presupuesto:</span> {activeDiscoveryAnswers.q6}
                                  </p>
                                )}
                                {activeDiscoveryAnswers.q5 && (
                                  <p className="truncate">
                                    <span className="font-semibold text-slate-500">Plazo:</span> {activeDiscoveryAnswers.q5}
                                  </p>
                                )}
                              </div>
                            )}

                            <div className="space-y-1.5">
                              <button
                                type="button"
                                disabled={!canSend || sendingMessage}
                                onClick={() => handleSendDiscoveryFormLink(true)}
                                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold transition"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>Enviar formulario al WhatsApp (1 clic)</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleSendDiscoveryFormLink(false)}
                                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 text-xs font-semibold transition"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                                <span>Pasar link al cuadro de texto</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setShowDiscoveryPopover(false);
                                  setShowDiscoveryHUD(true);
                                }}
                                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-bold transition"
                              >
                                <Target className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Abrir 7 Preguntas (Método ARIAS)</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Calendario Manual: Agendar Cita / Demo / Seguimiento sin salir del chat */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setShowCalendarPopover((v) => !v);
                            setShowStagePopover(false);
                            setShowDiscoveryPopover(false);
                            setShowQuotesPopover(false);
                          }}
                          title="Agendar cita, demostración o seguimiento en el calendario sin salir del chat"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[12.5px] font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 transition"
                        >
                          <Calendar className="w-3.5 h-3.5 text-slate-600" />
                          <span>Agendar</span>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        </button>

                        {showCalendarPopover && (
                          <div className="absolute right-0 top-full mt-1.5 w-84 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 p-3 space-y-2">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                              <div>
                                <p className="text-xs font-bold text-slate-900">Calendario y Citas</p>
                                <p className="text-[11px] text-slate-500">
                                  Agenda desde aquí sin salir del chat y comparte el link
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowCalendarPopover(false)}
                                className="text-slate-400 hover:text-slate-600"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="space-y-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenCalendarModal('followup')}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition text-left"
                              >
                                <Calendar className="w-3.5 h-3.5 shrink-0" />
                                <div className="min-w-0">
                                  <p className="leading-tight">Agendar Seguimiento / Cita</p>
                                  <p className="text-[10px] font-normal text-slate-300 truncate">
                                    Llamada, reunión, WhatsApp o cotización en fecha y hora
                                  </p>
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenCalendarModal('meeting')}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/90 text-xs font-bold transition text-left"
                              >
                                <Video className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                <div className="min-w-0">
                                  <p className="leading-tight">Agendar Reunión / Demo (Google Meet)</p>
                                  <p className="text-[10px] font-normal text-slate-500 truncate">
                                    Crea videollamada en calendario y envía el link al chat
                                  </p>
                                </div>
                              </button>

                              <div className="pt-1 border-t border-slate-100 flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={!canSend || sendingMessage}
                                  onClick={() => handleSendBookingLinkToChat(true)}
                                  className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[11px] font-semibold transition disabled:opacity-50"
                                >
                                  <Send className="w-3 h-3 text-slate-500" />
                                  <span>Enviar mi link de agenda</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSendBookingLinkToChat(false)}
                                  title="Colocar mi link de agenda en el cuadro de texto"
                                  className="px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80 text-[11px] font-semibold transition shrink-0"
                                >
                                  Pasar texto
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 1-Click Quote Builder */}
                      <button
                        type="button"
                        disabled={creatingQuote || classifying}
                        onClick={handleOpenQuoteBuilder}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[12.5px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition disabled:opacity-50"
                      >
                        {creatingQuote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Receipt className="w-3.5 h-3.5" />}
                        <span>Cotizar</span>
                      </button>

                      {/* Existing quotes dropdown with 1-click send to WhatsApp */}
                      {leadQuotes.length > 0 && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setShowQuotesPopover((v) => !v);
                              setShowStagePopover(false);
                              setShowDiscoveryPopover(false);
                              setShowCalendarPopover(false);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[12.5px] font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 transition"
                          >
                            <FileText className="w-3.5 h-3.5 text-slate-500" />
                            <span>Propuestas ({leadQuotes.length})</span>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                          {showQuotesPopover && (
                            <div className="absolute right-0 top-full mt-1.5 w-88 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 p-2.5 space-y-2">
                              <div className="px-2 py-1 flex items-center justify-between border-b border-slate-100">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  Propuestas del contacto
                                </span>
                                <button onClick={() => setShowQuotesPopover(false)} className="text-slate-400 hover:text-slate-600">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="max-h-72 overflow-y-auto space-y-1.5">
                                {leadQuotes.map((q) => {
                                  const amount = q.total_anual || q.total_mensual || 0;
                                  const isSendingThis = sendingQuotePdfId === q.id;
                                  return (
                                    <div key={q.id} className="p-2.5 rounded-xl bg-[#F4F6FA] border border-slate-200/80 space-y-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-bold text-slate-900 truncate">{q.plan_nombre}</span>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <span className="text-xs font-bold text-indigo-700">${amount.toLocaleString()}</span>
                                          <button
                                            type="button"
                                            onClick={() => navigate(`/cotizaciones/${q.id}`)}
                                            title="Ver detalle de cotización"
                                            className="p-1 rounded-md bg-white border border-slate-200/80 text-slate-500 hover:text-indigo-600 transition"
                                          >
                                            <ExternalLink className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          disabled={isSendingThis}
                                          onClick={() => handleSendQuotePdfToWhatsApp(q, true)}
                                          className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-semibold transition"
                                        >
                                          {isSendingThis ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                                          <span>Enviar PDF + Firma y Reunión</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setComposerMode('whatsapp');
                                            setMessageInput(buildQuoteWhatsAppText(q, activeCircle.clientName, true));
                                            setShowQuotesPopover(false);
                                          }}
                                          title="Colocar enlaces de firma y reunión en el cuadro de texto para editar antes de enviar"
                                          className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200/90 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold transition shrink-0"
                                        >
                                          Pasar texto
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                {/* Unified More Options Popover (Ficha Lead, Vendedor Assignment, Clasificación) */}
                {(canClassify || activeCircle.leadId) && activeCircle.scope !== 'por_clasificar' && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowReclassifyMenu((v) => !v)}
                      title="Más opciones y clasificación"
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 transition"
                    >
                      <MoreHorizontal className="w-4 h-4 text-slate-500" />
                    </button>
                    {showReclassifyMenu && (
                      <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 p-2 space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            setShowReclassifyMenu(false);
                            handleMarkCircleUnread(activeCircle);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 text-left"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
                          Marcar como no leído
                        </button>

                        {activeCircle.leadId && (activeCircle.scope === 'lead' || activeCircle.scope === 'spam') && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowReclassifyMenu(false);
                              navigate('/leads', { state: { leadId: activeCircle.leadId, _t: Date.now() } });
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-700 hover:bg-indigo-50 text-left"
                          >
                            <User className="w-3.5 h-3.5 text-indigo-600" />
                            Abrir Ficha del Lead
                          </button>
                        )}

                        {scopes.all && activeCircle.scope === 'lead' && (
                          <div className="px-3 py-2 border-y border-slate-100 space-y-1">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Vendedor asignado</span>
                            <select
                              value={activeCircle.leadOwnerId || activeCircle.assignedTechId || ''}
                              onChange={(e) => {
                                handleAssignLeadOwner(e.target.value);
                                setShowReclassifyMenu(false);
                              }}
                              className="w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none"
                            >
                              <option value="">Sin vendedor</option>
                              {agents.map((ag) => (
                                <option key={ag.id} value={ag.id}>
                                  {ag.full_name || ag.email}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {canClassify && (
                          <>
                            <div className="px-3 pt-1.5 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Clasificación del contacto
                            </div>
                            {(
                              [
                                { t: 'cliente', label: 'Es cliente (Soporte)', icon: Building2, show: activeCircle.scope !== 'soporte' },
                                { t: 'lead', label: 'Es lead (Ventas)', icon: UserPlus, show: activeCircle.scope !== 'lead' },
                                { t: 'interno', label: 'Es del equipo', icon: ShieldCheck, show: scopes.all && activeCircle.scope !== 'interno' },
                                { t: 'spam', label: 'Spam / bloquear', icon: Ban, show: activeCircle.scope !== 'spam' },
                                { t: 'por_clasificar', label: 'Deshacer (Por clasificar)', icon: HelpCircle, show: scopes.all },
                              ] as const
                            )
                              .filter((o) => o.show)
                              .map((o) => {
                                const I = o.icon;
                                return (
                                  <button
                                    key={o.t}
                                    type="button"
                                    disabled={classifying}
                                    onClick={() => (o.t === 'cliente' ? (setShowClientPicker(true), setShowReclassifyMenu(false)) : classify(o.t))}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 text-left"
                                  >
                                    <I className="w-3.5 h-3.5 text-slate-400" />
                                    {o.label}
                                  </button>
                                );
                              })}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeCircle.scope === 'soporte' && (
                  <button
                    type="button"
                    onClick={() => setShowRightPanel(!showRightPanel)}
                    title="Panel del ticket: asignar técnico, tiempo y cierre"
                    className={`w-9 h-8 rounded-xl flex items-center justify-center border transition ${
                      showRightPanel
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100'
                    }`}
                  >
                    {showRightPanel ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>

            {/* Classification card for unknown numbers */}
            {activeCircle.scope === 'por_clasificar' && (
              <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-3 flex-wrap shrink-0">
                <HelpCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <div className="mr-auto">
                  <p className="text-xs font-black text-amber-900">Número nuevo — ¿quién es?</p>
                  <p className="text-[11px] text-amber-800">Clasifícalo una vez y el sistema lo recordará para siempre.</p>
                </div>
                {canClassify ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={classifying}
                      onClick={() => setShowClientPicker(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      Es cliente
                    </button>
                    <button
                      type="button"
                      disabled={classifying}
                      onClick={() => classify('lead')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs disabled:opacity-50"
                    >
                      {classifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                      Tomar Lead (asignado a mí)
                    </button>
                    {scopes.all && agents.length > 0 && (
                      <select
                        disabled={classifying}
                        defaultValue=""
                        onChange={(e) => {
                          const targetAgentId = e.target.value;
                          if (!targetAgentId) return;
                          classify('lead', { assign_to: targetAgentId });
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50 cursor-pointer focus:outline-none disabled:opacity-50"
                      >
                        <option value="" disabled>
                          Asignar directo a vendedor...
                        </option>
                        {agents.map((ag) => (
                          <option key={ag.id} value={ag.id}>
                            {ag.full_name || ag.email}
                          </option>
                        ))}
                      </select>
                    )}
                    {scopes.all && (
                      <button
                        type="button"
                        disabled={classifying}
                        onClick={() => classify('interno')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Es del equipo
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={classifying}
                      onClick={() => classify('spam')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      Spam
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] font-semibold text-amber-800">Un vendedor o administrador debe clasificarlo.</span>
                )}
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-3">
              {loadingComments ? (
                <div className="text-center py-12 text-[13px] font-medium text-slate-400">Cargando mensajes…</div>
              ) : chatItems.length === 0 ? (
                <div className="text-center py-12 text-[13px] font-medium text-slate-400">Sin mensajes todavía.</div>
              ) : (
                chatItems.map((b, idx) => {
                  const prev = chatItems[idx - 1];
                  const showDay = !prev || dayKey(prev.createdAt) !== dayKey(b.createdAt);
                  const daySep = showDay ? (
                    <div key={`day-${b.id}`} className="flex justify-center my-3">
                      <span className="px-4 py-1 rounded-full bg-white text-xs font-bold text-slate-600 shadow-2xs capitalize">{dayLabel(b.createdAt)}</span>
                    </div>
                  ) : null;

                  if (b.kind === 'ticket') {
                    return (
                      <React.Fragment key={b.id}>
                        {daySep}
                        <div className="flex justify-center my-2">
                          <div className="max-w-lg w-full bg-[#E6E9FF] rounded-2xl px-4 py-2.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600">
                              <Bell className="w-3.5 h-3.5" />
                              <span>{b.senderName}</span>
                            </div>
                            <p className="text-[13px] font-medium text-slate-800 mt-0.5 leading-snug line-clamp-2">{b.text}</p>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  }
                  if (b.kind === 'system') {
                    const isEditing = editingCommentId === b.id;
                    return (
                      <React.Fragment key={b.id}>
                        {daySep}
                        <div className="flex justify-center group/msg">
                          {isEditing ? (
                            <div className="max-w-lg w-full bg-amber-50 border border-amber-300 rounded-2xl p-3 space-y-2 shadow-xs">
                              <textarea
                                rows={2}
                                value={editingCommentText}
                                onChange={(e) => setEditingCommentText(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-white border border-amber-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                              />
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingCommentId(null)}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-amber-100/60 transition"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  disabled={savingCommentEdit || !editingCommentText.trim()}
                                  onClick={() => handleSaveEditedComment(b, false)}
                                  className="px-3 py-1 rounded-lg text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 transition"
                                >
                                  Guardar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900">
                              <StickyNote className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              {b.text}
                              <span className="text-amber-600 font-normal">· {fmtTime(b.createdAt)}</span>
                              {canModifyComment(b) && (
                                <span className="inline-flex items-center gap-1 ml-1 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditComment(b)}
                                    title="Editar nota"
                                    className="p-0.5 rounded hover:bg-amber-200/60 text-amber-700"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteComment(b)}
                                    title="Eliminar nota"
                                    className="p-0.5 rounded hover:bg-rose-100 text-rose-600"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  }
                  if (b.kind === 'staff') {
                    const isEditing = editingCommentId === b.id;
                    return (
                      <React.Fragment key={b.id}>
                        {daySep}
                        <div className="flex justify-end items-start gap-1.5 group/msg">
                          {canModifyComment(b) && !isEditing && (
                            <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-1 bg-white border border-slate-200/90 rounded-xl px-1.5 py-1 shadow-2xs self-center">
                              <button
                                type="button"
                                onClick={() => handleStartEditComment(b)}
                                title="Editar mensaje"
                                className="p-1 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(b)}
                                title="Eliminar mensaje"
                                className="p-1 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                          <div className="max-w-lg bg-[#DFE3FF] text-slate-900 rounded-2xl rounded-br-xs px-4 py-3 shadow-2xs">
                            <p className="text-[13px] font-bold text-indigo-700/85 mb-0.5">{b.senderName}</p>
                            {renderMedia(b)}
                            {isEditing ? (
                              <div className="mt-1.5 space-y-2 min-w-[280px] sm:min-w-[360px]">
                                <textarea
                                  rows={4}
                                  value={editingCommentText}
                                  onChange={(e) => setEditingCommentText(e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl bg-white border border-indigo-200 text-[13.5px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
                                />
                                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => setEditingCommentId(null)}
                                    className="px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white text-slate-600 text-xs font-semibold transition"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    disabled={savingCommentEdit || !editingCommentText.trim()}
                                    onClick={() => handleSaveEditedComment(b, false)}
                                    className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 text-xs font-bold disabled:opacity-50 transition"
                                  >
                                    Guardar en chat
                                  </button>
                                  <button
                                    type="button"
                                    disabled={savingCommentEdit || !editingCommentText.trim()}
                                    onClick={() => handleSaveEditedComment(b, true)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-50 transition"
                                  >
                                    <Send className="w-3 h-3" />
                                    Guardar y reenviar a WhatsApp
                                  </button>
                                </div>
                              </div>
                            ) : (
                              b.text && <p className="text-[14.5px] font-medium text-slate-900 whitespace-pre-wrap leading-relaxed break-words">{b.text}</p>
                            )}
                            <div className="flex items-center justify-end gap-1 mt-1">
                              <span className="text-xs font-medium text-slate-500">{b.id.startsWith('temp-') ? 'enviando…' : fmtTime(b.createdAt)}</span>
                              {b.delivery === 'sent' ? (
                                <CheckCheck className="w-3.5 h-3.5 text-emerald-500" aria-label="Entregado a WhatsApp" />
                              ) : b.delivery === 'error' ? (
                                <span title={b.deliveryError || 'No se pudo enviar'} className="inline-flex items-center gap-0.5 text-xs font-bold text-rose-600">
                                  <AlertTriangle className="w-3 h-3" /> No enviado
                                </span>
                              ) : b.delivery ? (
                                <Check className="w-3.5 h-3.5 text-slate-400" aria-label="En cola de envío" />
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  }
                  return (
                    <React.Fragment key={b.id}>
                      {daySep}
                      <div className="flex justify-start">
                        <div className="max-w-lg bg-white text-slate-900 rounded-2xl rounded-bl-xs px-4 py-3 shadow-2xs">
                          <p className="text-[13px] font-bold text-indigo-600 mb-0.5">{b.senderName}</p>
                          {renderMedia(b)}
                          {b.text && <p className="text-[14.5px] font-medium text-slate-800 whitespace-pre-wrap leading-relaxed break-words">{b.text}</p>}
                          {b.transcript && (
                            <p className="mt-1.5 text-[13px] text-slate-600 bg-slate-50 rounded-lg px-2.5 py-1.5 italic">
                              <Mic className="w-3.5 h-3.5 inline mr-1 text-indigo-500" />
                              {b.transcript}
                            </p>
                          )}
                          <div className="flex items-center justify-end mt-1">
                            <span className="text-xs font-medium text-slate-400">{fmtTime(b.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Clean, single-line bar when returning from CotizadorPro with a newly generated quote */}
            {canSend && pendingQuote && (
              <div className="bg-[#EEF0FF] border-t border-indigo-200/80 px-5 py-2 flex items-center justify-between gap-3 flex-wrap shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-white border border-indigo-200/80 flex items-center justify-center text-indigo-600 shrink-0">
                    <Receipt className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      Propuesta lista: {pendingQuote.plan_nombre}{' '}
                      <span className="text-indigo-700">
                        (${(pendingQuote.total_anual || pendingQuote.total_mensual || 0).toLocaleString()})
                      </span>
                    </p>
                    <p className="text-[11px] font-medium text-slate-500 truncate">
                      Incluye PDF oficial, enlace de aprobación con firma digital y agenda de reunión
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={sendingQuotePdfId === pendingQuote.id}
                    onClick={() => handleSendQuotePdfToWhatsApp(pendingQuote, true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-2xs transition"
                  >
                    {sendingQuotePdfId === pendingQuote.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Enviar PDF + Firma y Reunión</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setComposerMode('whatsapp');
                      setMessageInput(buildQuoteWhatsAppText(pendingQuote, activeCircle.clientName, true));
                      setPendingQuoteId(null);
                      setPostQuoteFollowupCircleId(activeCircle.circleId);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-indigo-200/90 hover:bg-indigo-50/50 text-slate-700 text-xs font-semibold transition"
                  >
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Editar texto en chat</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingQuoteId(null)}
                    title="Ocultar barra"
                    className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/60 flex items-center justify-center transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Post-Quote 1-Click Follow-Up Scheduler Bar so no quote is left without follow-up */}
            {canSend && postQuoteFollowupCircleId === activeCircle.circleId && (
              <div className="bg-slate-50 border-t border-slate-200/90 px-5 py-2 flex items-center justify-between gap-3 flex-wrap shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Calendar className="w-4 h-4 text-slate-600 shrink-0" />
                  <p className="text-xs font-semibold text-slate-800 truncate">
                    Cotización enviada · <span className="font-bold">Agendar seguimiento para resolver dudas:</span>
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  {(
                    [
                      { days: 1, label: 'Mañana 10:00 a. m.' },
                      { days: 2, label: 'En 2 días' },
                      { days: 4, label: 'En 4 días' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.days}
                      type="button"
                      disabled={schedulingFollowup}
                      onClick={() => handleSchedulePostQuoteFollowup(opt.days, opt.label)}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-900 hover:text-white text-slate-700 border border-slate-200/90 text-[11px] font-semibold transition disabled:opacity-50"
                    >
                      {opt.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPostQuoteFollowupCircleId(null)}
                    title="Ocultar"
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Single-Row Clean Composer (WhatsApp message vs Internal Team Note + Floating Plantillas Popover) */}
            {canSend ? (
              <div
                className={`px-5 py-3 border-t flex items-end gap-2 transition-colors relative ${
                  composerMode === 'internal' ? 'bg-amber-50/70 border-amber-200' : 'bg-white border-slate-200/70'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
                  onChange={handleUploadAttachment}
                  className="hidden"
                />
                {composerMode === 'whatsapp' && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    title="Enviar imagen, documento o archivo"
                    className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-500 hover:bg-slate-100 flex items-center justify-center transition shrink-0 disabled:opacity-50"
                  >
                    {uploadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  </button>
                )}

                {/* Floating Quick Replies Popover Button (Replaces permanent horizontal bar) */}
                {composerMode === 'whatsapp' && (
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowQuickRepliesPopover((v) => !v)}
                      title="Respuestas rápidas y plantillas"
                      className={`px-3.5 py-2.5 rounded-xl text-[13px] font-semibold inline-flex items-center gap-1.5 border transition ${
                        showQuickRepliesPopover
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100'
                      }`}
                    >
                      <Zap className="w-4 h-4 text-indigo-600" />
                      <span className="hidden sm:inline">Plantillas</span>
                    </button>
                    {showQuickRepliesPopover && (
                      <div className="absolute left-0 bottom-full mb-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 p-2 space-y-1">
                        <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-slate-100">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            {activeCircle.scope === 'lead' || activeCircle.scope === 'por_clasificar'
                              ? 'Plantillas de Ventas'
                              : 'Plantillas de Soporte'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setShowQuickRepliesPopover(false);
                              setEditingQrId(null);
                              setNewQrLabel('');
                              setNewQrText('');
                              setNewQrScope(activeCircle.scope === 'lead' || activeCircle.scope === 'por_clasificar' ? 'ventas' : 'soporte');
                              setShowQuickReplyModal(true);
                            }}
                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-0.5"
                          >
                            <Plus className="w-3 h-3" />
                            Nueva / Editar
                          </button>
                        </div>
                        <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                          {activeQuickReplies.map((q) => (
                            <div
                              key={q.id}
                              className="w-full px-3 py-2 rounded-xl hover:bg-slate-50 transition flex items-start justify-between gap-2 group"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setMessageInput(q.text);
                                  setShowQuickRepliesPopover(false);
                                }}
                                className="flex-1 text-left min-w-0"
                              >
                                <p className="text-[13px] font-semibold text-slate-800">{q.label}</p>
                                <p className="text-xs text-slate-400 truncate mt-0.5">{q.text}</p>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowQuickRepliesPopover(false);
                                  setNewQrScope(q.scope);
                                  setEditingQrId(q.id);
                                  setNewQrLabel(q.label);
                                  setNewQrText(q.text);
                                  setShowQuickReplyModal(true);
                                }}
                                title="Editar esta plantilla"
                                className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition shrink-0"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Mode switcher: WhatsApp vs Nota Interna */}
                <button
                  type="button"
                  onClick={() => setComposerMode((m) => (m === 'whatsapp' ? 'internal' : 'whatsapp'))}
                  title={
                    composerMode === 'internal'
                      ? 'Modo Nota Interna activo (el cliente NO recibe este mensaje). Clic para volver a WhatsApp.'
                      : 'Cambiar a Nota Interna para dejar instrucciones al equipo dentro del chat'
                  }
                  className={`px-3.5 py-2.5 rounded-xl text-[13px] font-semibold inline-flex items-center gap-1.5 shrink-0 border transition ${
                    composerMode === 'internal'
                      ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200'
                  }`}
                >
                  <StickyNote className="w-4 h-4" />
                  <span className="hidden sm:inline">{composerMode === 'internal' ? 'Nota interna' : 'Nota'}</span>
                </button>

                <textarea
                  rows={1}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleComposerSubmit();
                    }
                  }}
                  placeholder={
                    composerMode === 'internal'
                      ? 'Escribe una nota interna para el equipo (NO se envía al WhatsApp del cliente)…'
                      : 'Escribe un mensaje a WhatsApp… (Shift+Enter = nueva línea)'
                  }
                  className={`flex-1 resize-none max-h-32 px-4 py-2.5 rounded-xl text-[14.5px] font-medium focus:outline-none focus:ring-2 transition ${
                    composerMode === 'internal'
                      ? 'bg-white border-2 border-amber-300 text-amber-950 placeholder:text-amber-700/60 focus:ring-amber-500/20'
                      : 'bg-slate-50 border border-slate-200/80 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-indigo-500/20'
                  }`}
                />
                <button
                  type="button"
                  disabled={!messageInput.trim() || sendingMessage}
                  onClick={handleComposerSubmit}
                  className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl disabled:opacity-40 text-white text-[13px] font-bold transition ${
                    composerMode === 'internal' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {composerMode === 'internal' ? <StickyNote className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                  {composerMode === 'internal' && <span className="hidden sm:inline">Guardar nota</span>}
                </button>
              </div>
            ) : (
              <div className="bg-white px-5 py-3 border-t border-slate-200/70 text-center text-[11px] font-semibold text-slate-400">
                {activeCircle.scope === 'spam' ? (
                  'Este número está marcado como spam.'
                ) : (
                  <>
                    Este ticket no vino por WhatsApp.{' '}
                    <button type="button" onClick={() => navigate('/support/tickets')} className="text-indigo-600 font-bold underline">
                      Gestionarlo en Tickets
                    </button>
                  </>
                )}
              </div>
            )}
          </main>
        ) : (
          <main className="flex-1 flex items-center justify-center bg-[#F3F4F8] text-slate-400 text-sm font-bold">
            Selecciona un chat de la lista para verlo.
          </main>
        )}

        {/* ── RIGHT: ticket control (support only) ── */}
        {activeCircle && showRightPanel && activeCircle.scope === 'soporte' && (
          <aside className="w-96 bg-white border-l border-slate-200/80 flex flex-col overflow-y-auto shrink-0">
            <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-[#EEF0FF]/70 to-white">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-700">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  Control del ticket
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    ['resolved', 'closed'].includes(activeCircle.activeTicket.status) ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {['resolved', 'closed'].includes(activeCircle.activeTicket.status) ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" /> Resuelto
                    </>
                  ) : (
                    <>
                      <Clock className="w-3 h-3" /> Abierto · {formatTimer(activeChatSeconds)}
                    </>
                  )}
                </span>
              </div>
              <h4 className="text-sm font-black text-slate-900 mt-1">Ticket #{activeCircle.activeTicket.id.slice(0, 8).toUpperCase()}</h4>
              <p className="text-[11px] text-slate-500 font-medium line-clamp-2 mt-0.5">{stripEmojis(activeCircle.activeTicket.title)}</p>
            </div>

            <div className="p-4 space-y-4 flex-1">
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                  1. Ingeniero responsable
                </label>
                <select
                  value={activeCircle.assignedTechId || ''}
                  onChange={(e) => handleAssignTech(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800"
                >
                  <option value="">Sin asignar</option>
                  {agents.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.full_name || ag.email}
                    </option>
                  ))}
                </select>
              </div>

              {aiTimeAudit && (
                <div
                  className={`rounded-2xl p-3.5 border space-y-2.5 ${
                    aiTimeAudit.status === 'inflated'
                      ? 'bg-rose-50/70 border-rose-200'
                      : aiTimeAudit.status === 'missing_time'
                      ? 'bg-amber-50/60 border-amber-200'
                      : 'bg-emerald-50/60 border-emerald-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-800">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      2. Tiempo real vs. IA *
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        aiTimeAudit.status === 'inflated'
                          ? 'bg-rose-100 text-rose-800'
                          : aiTimeAudit.status === 'missing_time'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {stripEmojis(aiTimeAudit.verdictLabel)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[9px] font-bold text-slate-500 uppercase">Horas trabajadas *</p>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        placeholder="Ej: 0.5"
                        value={resForm.actual_hours}
                        onChange={(e) => setResForm((p) => ({ ...p, actual_hours: e.target.value }))}
                        className="mt-0.5 w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900"
                      />
                    </div>
                    <div className="bg-white/90 rounded-xl p-2 border border-slate-200/70">
                      <p className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase">
                        <Bot className="w-3 h-3 text-indigo-500" />
                        Esperado IA
                      </p>
                      <p className="text-xs font-black text-indigo-700">
                        {aiTimeAudit.expectedHours}h <span className="text-[10px] text-slate-400">(máx {aiTimeAudit.maxReasonableHours}h)</span>
                      </p>
                      <p className="text-[9px] font-bold text-slate-500">
                        Dif:{' '}
                        {aiTimeAudit.reportedHours > 0
                          ? `${aiTimeAudit.differenceHours > 0 ? '+' : ''}${aiTimeAudit.differenceHours}h`
                          : 'Sin tiempo'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {[
                      { label: '12m (0.2h)', val: '0.2' },
                      { label: '30m (0.5h)', val: '0.5' },
                      { label: '1h', val: '1' },
                      { label: '1.5h', val: '1.5' },
                      { label: '2h', val: '2' },
                    ].map((b) => (
                      <button
                        key={b.val}
                        type="button"
                        onClick={() => setResForm((p) => ({ ...p, actual_hours: b.val }))}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition ${
                          resForm.actual_hours === b.val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                  {aiTimeAudit.status === 'inflated' && (
                    <div>
                      <label className="inline-flex items-center gap-1 text-[9px] font-black text-rose-700 uppercase">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        Justificación por diferencia (+{aiTimeAudit.differenceHours}h) *
                      </label>
                      <textarea
                        rows={2}
                        value={resForm.time_justification}
                        onChange={(e) => setResForm((p) => ({ ...p, time_justification: e.target.value }))}
                        placeholder="Explica por qué tomó más tiempo que el estimado IA..."
                        className="mt-1 w-full px-2.5 py-1.5 bg-white border border-rose-300 rounded-xl text-[11px] font-medium"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 space-y-2.5">
                <p className="text-[10px] font-black uppercase text-slate-700 flex items-center gap-1.5">
                  <FileBadge2 className="w-3.5 h-3.5 text-violet-600" />
                  3. Resolución obligatoria
                </p>
                {(
                  [
                    { k: 'findings', label: 'Hallazgos (¿Qué encontraste?) *', ph: 'Síntoma o error verificado...' },
                    { k: 'root_cause', label: 'Causa raíz (¿Por qué ocurrió?) *', ph: 'Causa técnica raíz...' },
                    { k: 'solution', label: 'Solución definitiva *', ph: 'Qué se corrigió exactamente...' },
                  ] as const
                ).map((f) => (
                  <div key={f.k}>
                    <label className="text-[9px] font-black text-slate-500 uppercase">{f.label}</label>
                    <textarea
                      rows={2}
                      value={resForm[f.k]}
                      onChange={(e) => setResForm((p) => ({ ...p, [f.k]: e.target.value }))}
                      placeholder={f.ph}
                      className="mt-0.5 w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-[11px]"
                    />
                  </div>
                ))}
                <div className="pt-1 space-y-1.5">
                  <button
                    type="button"
                    disabled={savingResolution}
                    onClick={() => handleCompleteAndCloseTicket(true)}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-black shadow-sm transition inline-flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{savingResolution ? 'Guardando...' : 'Cerrar ticket y avisar por WhatsApp'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={savingResolution}
                    onClick={() => handleCompleteAndCloseTicket(false)}
                    className="w-full py-2 px-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-bold transition"
                  >
                    Guardar y cerrar (sin enviar mensaje)
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowHistoryAccordion(!showHistoryAccordion)}
                  className="w-full px-3.5 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-black text-slate-800 transition"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-indigo-600" />
                    Historial ({activeCircle.allClientTickets.length})
                  </span>
                  {showHistoryAccordion ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                </button>
                {showHistoryAccordion && (
                  <div className="divide-y divide-slate-100 bg-white max-h-60 overflow-y-auto">
                    {activeCircle.allClientTickets.map((ht) => (
                      <div key={ht.id} className="p-3 text-[11px] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-slate-800">#{ht.id.slice(0, 6).toUpperCase()}</span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(ht.created_at).toLocaleDateString('es-SV')} · {Number(ht.actual_hours || 0)}h
                          </span>
                        </div>
                        <p className="text-slate-700 font-semibold line-clamp-2">{stripEmojis(ht.title)}</p>
                        {ht.solution && (
                          <p className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Solución: {stripEmojis(ht.solution)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* ── "Es cliente" picker ── */}
      {showClientPicker && activeCircle && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => setShowClientPicker(false)}>
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">¿De qué cliente es este número?</h3>
              <button onClick={() => setShowClientPicker(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              {activeCircle.pushName ? `"${activeCircle.pushName}" ` : ''}
              {activeCircle.phone ? `+${activeCircle.phone}` : ''} pasará a <strong>Soporte</strong>.
            </p>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                autoFocus
                value={clientPickerQuery}
                onChange={(e) => setClientPickerQuery(e.target.value)}
                placeholder="Buscar grupo o cliente…"
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs"
              />
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-2xl">
              {pickerOptions.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  disabled={classifying}
                  onClick={() => classify('cliente', { client_id: o.client_id || undefined, group_jid: o.group_jid || undefined })}
                  className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 flex items-center gap-2"
                >
                  {o.group_jid ? <Users className="w-4 h-4 text-indigo-500 shrink-0" /> : <Building2 className="w-4 h-4 text-slate-400 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{o.label}</p>
                    <p className="text-[10px] text-slate-500 truncate">{o.sub}</p>
                  </div>
                </button>
              ))}
              {pickerOptions.length === 0 && <p className="p-4 text-center text-xs text-slate-400">Sin resultados</p>}
            </div>
            <button
              type="button"
              disabled={classifying}
              onClick={() => classify('cliente')}
              className="w-full py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              Es cliente, pero no está en la lista
            </button>
          </div>
        </div>
      )}

      {/* ── WhatsApp connection status (admin) ── */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => setShowStatusModal(false)}>
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">Estado de la conexión WhatsApp</h3>
              <button onClick={() => setShowStatusModal(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            {!bridgeStatus ? (
              <p className="text-xs text-slate-500">Consultando…</p>
            ) : bridgeStatus.ok === false ? (
              <p className="text-xs text-rose-700">{bridgeStatus.error}</p>
            ) : (
              (() => {
                const ago = (iso?: string | null) => {
                  if (!iso) return 'nunca';
                  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
                  if (s < 90) return `hace ${s}s`;
                  if (s < 5400) return `hace ${Math.round(s / 60)} min`;
                  return new Date(iso).toLocaleString('es-SV');
                };
                const pollOk = bridgeStatus.bridge_last_poll && Date.now() - new Date(bridgeStatus.bridge_last_poll).getTime() < 2 * 60 * 1000;
                const rows: [string, React.ReactNode][] = [
                  [
                    'Servidor Evolution (puente)',
                    <span className={pollOk ? 'text-emerald-700' : 'text-rose-700'}>
                      {pollOk ? 'Conectado' : 'Sin señal'} · {ago(bridgeStatus.bridge_last_poll)}
                    </span>,
                  ],
                  ['Último envío confirmado', ago(bridgeStatus.bridge_last_ack)],
                  ['Mensajes en cola', String(bridgeStatus.outbox_pending)],
                  ['Envíos con error (24h)', String(bridgeStatus.outbox_errors_24h)],
                  ['Archivos descargándose', String(bridgeStatus.media_pending)],
                  ['Archivos con error', String(bridgeStatus.media_failed)],
                  ['Grupos sincronizados', `${bridgeStatus.groups_count} · ${ago(bridgeStatus.groups_synced_at)}`],
                  ['Clave Evolution configurada', bridgeStatus.evolution_key_configured ? 'Sí' : 'No'],
                ];
                return (
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl">
                    {rows.map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between px-3.5 py-2 text-xs">
                        <span className="text-slate-500 font-medium">{k}</span>
                        <span className="font-bold text-slate-800">{v}</span>
                      </div>
                    ))}
                    {bridgeStatus.bridge_last_error && (
                      <p className="px-3.5 py-2 text-[11px] text-rose-700 break-all">Último error: {bridgeStatus.bridge_last_error}</p>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* ── AI prompts (admin) ── */}
      {showAiPromptModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h3 className="text-base font-black text-slate-900">IA por categoría (texto y notas de voz)</h3>
              </div>
              <button onClick={() => setShowAiPromptModal(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl border ${
                openAiStatus.checking
                  ? 'bg-slate-50 border-slate-200 text-slate-700'
                  : openAiStatus.verified
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className={`w-2.5 h-2.5 rounded-full ${openAiStatus.checking ? 'bg-amber-400 animate-pulse' : openAiStatus.verified ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <span>
                  {openAiStatus.checking
                    ? 'Verificando conexión con OpenAI...'
                    : openAiStatus.verified
                    ? `OpenAI conectado (${openAiStatus.model} + Whisper)`
                    : `OpenAI error: ${openAiStatus.error || 'Sin conexión'}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => verifyAndLoadAiConfig(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-black text-slate-700 transition"
              >
                <RefreshCw className="w-3 h-3" />
                Probar
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Las notas de voz siempre se transcriben. Las respuestas automáticas están <strong>apagadas</strong> salvo que las actives aquí; nunca se
              responde a Equipo ni a Spam.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={aiAutoReplyText} onChange={(e) => setAiAutoReplyText(e.target.checked)} className="rounded border-slate-300 text-purple-600" />
                <MessageSquare className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span className="text-xs font-black text-slate-800">Responder mensajes de texto</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={aiAutoReplyAudio} onChange={(e) => setAiAutoReplyAudio(e.target.checked)} className="rounded border-slate-300 text-purple-600" />
                <Mic className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span className="text-xs font-black text-slate-800">Responder notas de voz</span>
              </label>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                {(
                  [
                    { id: 'soporte', label: 'Soporte técnico', icon: Wrench },
                    { id: 'contabilidad', label: 'Contabilidad / IVA', icon: Calculator },
                    { id: 'ventas', label: 'Ventas / Leads', icon: DollarSign },
                    { id: 'otros', label: 'Otros', icon: Package },
                  ] as { id: SupportChannelType; label: string; icon: React.ElementType }[]
                ).map((tab) => {
                  const TabIcon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActivePromptTab(tab.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition ${
                        activePromptTab === tab.id ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <TabIcon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
              <textarea
                rows={5}
                value={aiPrompts[activePromptTab]}
                onChange={(e) => setAiPrompts((prev) => ({ ...prev, [activePromptTab]: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAiPromptModal(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">
                Cancelar
              </button>
              <button
                disabled={savingAiConfig}
                onClick={async () => {
                  setSavingAiConfig(true);
                  try {
                    await invoke({
                      action: 'save_ai_config',
                      auto_reply_text: aiAutoReplyText,
                      auto_reply_audio: aiAutoReplyAudio,
                      prompts: {
                        soporte: aiPrompts.soporte.trim(),
                        contabilidad: aiPrompts.contabilidad.trim(),
                        ventas: aiPrompts.ventas.trim(),
                        otros: aiPrompts.otros.trim(),
                      },
                    });
                    toast.success('Configuración IA guardada');
                    setShowAiPromptModal(false);
                  } catch (e: any) {
                    toast.error(e?.message || 'Error al guardar configuración IA');
                  } finally {
                    setSavingAiConfig(false);
                  }
                }}
                className="px-4 py-2 rounded-xl text-xs font-black bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {savingAiConfig ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Customizable Quick Replies Modal (SaaS Multi-Industry) ── */}
      {showQuickReplyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={() => setShowQuickReplyModal(false)}>
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">Plantillas de Respuesta Rápida</h3>
                <p className="text-xs text-slate-500">Adapta las respuestas en 1 clic al giro de tu empresa (Ventas y Soporte).</p>
              </div>
              <button onClick={() => setShowQuickReplyModal(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setNewQrScope('ventas')}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition ${
                  newQrScope === 'ventas' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Ventas / Leads
              </button>
              <button
                type="button"
                onClick={() => setNewQrScope('soporte')}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition ${
                  newQrScope === 'soporte' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Soporte / Clientes
              </button>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase text-slate-500">
                  {editingQrId ? 'Editar plantilla' : `Nueva plantilla (${newQrScope === 'ventas' ? 'Ventas' : 'Soporte'})`}
                </p>
                {editingQrId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingQrId(null);
                      setNewQrLabel('');
                      setNewQrText('');
                    }}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-700"
                  >
                    Cancelar edición
                  </button>
                )}
              </div>
              <input
                type="text"
                value={newQrLabel}
                onChange={(e) => setNewQrLabel(e.target.value)}
                placeholder="Título corto del botón (ej. Enviar Catálogo, Pedir Requisitos)"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
              />
              <textarea
                rows={3}
                value={newQrText}
                onChange={(e) => setNewQrText(e.target.value)}
                placeholder="Texto completo que se escribirá en el chat al hacer clic..."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
              />
              <button
                type="button"
                disabled={!newQrLabel.trim() || !newQrText.trim()}
                onClick={() => {
                  if (editingQrId) {
                    const updated = customQuickReplies.map((q) =>
                      q.id === editingQrId
                        ? { ...q, scope: newQrScope, label: newQrLabel.trim(), text: newQrText.trim() }
                        : q
                    );
                    saveCustomQuickReplies(updated);
                    setEditingQrId(null);
                    setNewQrLabel('');
                    setNewQrText('');
                    toast.success('Plantilla actualizada');
                  } else {
                    const item: QuickReplyTemplate = {
                      id: `custom-${Date.now()}`,
                      scope: newQrScope,
                      label: newQrLabel.trim(),
                      text: newQrText.trim(),
                    };
                    saveCustomQuickReplies([...customQuickReplies, item]);
                    setNewQrLabel('');
                    setNewQrText('');
                    toast.success('Plantilla agregada');
                  }
                }}
                className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold transition"
              >
                {editingQrId ? 'Guardar cambios' : 'Guardar plantilla'}
              </button>
            </div>

            <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-2xl">
              {customQuickReplies
                .filter((q) => q.scope === newQrScope)
                .map((q) => {
                  const isEditingThis = editingQrId === q.id;
                  return (
                    <div
                      key={q.id}
                      className={`px-3.5 py-2.5 flex items-start justify-between gap-2 ${
                        isEditingThis ? 'bg-indigo-50/70' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-900">{q.label}</span>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{q.text}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingQrId(q.id);
                            setNewQrScope(q.scope);
                            setNewQrLabel(q.label);
                            setNewQrText(q.text);
                          }}
                          className="text-[11px] font-bold text-indigo-600 hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (editingQrId === q.id) {
                              setEditingQrId(null);
                              setNewQrLabel('');
                              setNewQrText('');
                            }
                            saveCustomQuickReplies(customQuickReplies.filter((x) => x.id !== q.id));
                            toast.success('Plantilla eliminada');
                          }}
                          className="text-[11px] font-bold text-rose-600 hover:underline"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ── Team WhatsApp Access & Role Control Modal (Admin) ── */}
      {showTeamAccessModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          onClick={() => setShowTeamAccessModal(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-base font-black text-slate-900">
                    Control de Accesos WhatsApp por Área (Admin · Técnicos · Ventas)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Define en 1 clic qué bandeja, chats y alertas puede ver cada miembro de tu equipo (protegido también por base de datos RLS).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTeamAccessModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Visual Guide of the 3 Core Profiles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200/80 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-indigo-100 space-y-1">
                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800">
                  Administradores
                </span>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Ven <strong>Todo</strong>: Soporte, Leads nuevos, todos los Leads de todos los vendedores, Equipo, Spam e IA.
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-sky-100 space-y-1">
                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-100 text-sky-800">
                  Técnicos (Soporte)
                </span>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Solo ven <strong>Soporte</strong> (grupos y clientes). <strong>0% acceso a Ventas/Leads</strong>; su campana solo suena por Soporte.
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-emerald-100 space-y-1">
                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                  Vendedores (Ventas)
                </span>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Solo ven <strong>Leads nuevos · por tomar</strong> y <strong>Mis leads</strong>. No ven los leads de otro vendedor ni Soporte.
                </p>
              </div>
            </div>

            {/* 1-Click Preview Mode for Admin */}
            <div className="flex items-center justify-between gap-2 flex-wrap bg-[#EEF0FF]/70 px-3.5 py-2.5 rounded-2xl border border-indigo-200/70">
              <div className="text-xs">
                <span className="font-black text-indigo-950">Simulador rápido de vista:</span>{' '}
                <span className="text-indigo-800 font-medium">Comprueba cómo ve la pantalla cada perfil sin cerrar sesión.</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(
                  [
                    { mode: null, label: 'Vista Admin (Todo)' },
                    { mode: 'soporte_team' as WaAccessMode, label: 'Probar como Técnico' },
                    { mode: 'ventas_pool' as WaAccessMode, label: 'Probar como Vendedor' },
                  ]
                ).map((p) => {
                  const active = adminPreviewMode === p.mode;
                  return (
                    <button
                      key={String(p.mode)}
                      type="button"
                      onClick={() => {
                        setAdminPreviewMode(p.mode);
                        if (p.mode === 'soporte_team') setCircleFilter('soporte');
                        else if (p.mode === 'ventas_pool') setCircleFilter('por_clasificar');
                        else setCircleFilter('all');
                        toast.success(`Vista cambiada a: ${p.label}`);
                      }}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-black transition ${
                        active
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white text-indigo-800 border border-indigo-200 hover:bg-indigo-50'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Team Member Access Table */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl">
              {loadingTeamAccess ? (
                <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>Cargando miembros del equipo...</span>
                </div>
              ) : teamAccessList.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">No se encontraron usuarios activos en la empresa.</div>
              ) : (
                teamAccessList.map((member) => {
                  const currentOpt =
                    WA_ACCESS_MODE_OPTIONS.find((o) => o.mode === member.access_mode) || WA_ACCESS_MODE_OPTIONS[0];
                  const isSaving = savingUserAccessId === member.id;
                  return (
                    <div key={member.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/70 font-bold text-xs flex items-center justify-center shrink-0">
                          {initials(member.full_name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-black text-slate-900 truncate">{member.full_name}</p>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${currentOpt.badgeColor}`}>
                              {currentOpt.shortLabel}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">
                            {member.email} · Rol base: <span className="font-semibold text-slate-700">{member.role_label}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />}
                        {member.is_system_admin ? (
                          <span className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-black">
                            Administrador del Sistema (Ve Todo)
                          </span>
                        ) : (
                          <select
                            disabled={isSaving}
                            value={member.access_mode}
                            onChange={(e) => handleChangeUserWaAccess(member.id, e.target.value as WaAccessMode)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-300 text-slate-800 hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer disabled:opacity-50"
                          >
                            {WA_ACCESS_MODE_OPTIONS.map((opt) => (
                              <option key={opt.mode} value={opt.mode}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
              <span>Los cambios se aplican en tiempo real sin necesidad de que el usuario cierre sesión.</span>
              <button
                type="button"
                onClick={() => setShowTeamAccessModal(false)}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Método ARIAS 7 Preguntas Drawer directly inside WhatsApp Chat */}
      {activeCircle && (
        <LiveDemoHUDModal
          isOpen={showDiscoveryHUD}
          onClose={() => setShowDiscoveryHUD(false)}
          leadName={activeCircle.clientName}
          leadCompany={activeCircle.clientName}
          initialAnswers={activeDiscoveryAnswers}
          onApplyFindings={handleApplyDiscoveryFindings}
        />
      )}

      {/* Manual Calendar Follow-Up Modal directly inside WhatsApp Chat (never leaves chat) */}
      {activeCircle && showNewFollowUpModal && (
        <NewFollowUpModal
          isOpen={showNewFollowUpModal}
          onClose={() => setShowNewFollowUpModal(false)}
          initialLeadId={activeCircle.leadId || undefined}
          initialLeadName={activeCircle.clientName}
          companyId={activeCompanyId || undefined}
          companyTimezone={TZ}
          currentUserId={profile?.id}
          teamMembers={agents.map((a) => ({
            id: a.id,
            full_name: a.full_name || a.email || 'Usuario',
            role: a.role || '',
          }))}
          canAssignOthers={scopes.all}
          shareToWhatsAppOption={true}
          onScheduledDetails={(details) => {
            handleCalendarScheduledShare({
              label: details.actionLabel,
              dateStr: details.date,
              timeStr: details.displayTime,
              shareToWhatsApp: details.shareToWhatsApp,
              sendImmediately: false,
            });
          }}
          onSuccess={() => {
            loadSupportData(true);
          }}
        />
      )}

      {/* Google Meet & Calendar Appointment Scheduler directly inside WhatsApp Chat */}
      {activeCircle && showMeetSchedulerModal && (
        <GoogleMeetScheduler
          onClose={() => setShowMeetSchedulerModal(false)}
          initialLeadId={activeCircle.leadId || undefined}
          initialLeadName={activeCircle.clientName}
          onShareToWhatsApp={(details) => {
            handleCalendarScheduledShare({
              label: details.title,
              dateStr: details.dateStr,
              timeStr: details.timeStr,
              meetLink: details.meetLink,
              sendImmediately: details.sendImmediately,
              shareToWhatsApp: true,
            });
          }}
        />
      )}
    </div>
  );
};

export default SupportChatCircles;
