import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Send,
  Camera,
  Mic,
  CheckCheck,
  Bell,
  Clock,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Sparkles,
  Brain,
  Ticket as TicketIcon,
  ChevronRight,
  ChevronDown,
  Phone,
  Video,
  PanelRightClose,
  PanelRightOpen,
  Paperclip,
  RefreshCw,
  ShieldAlert,
  ExternalLink,
  Settings,
  X,
  MessageSquare,
  FileBadge2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../auth/AuthProvider';
import {
  ticketService,
  computeTicketAiTimeBenchmark,
  type Ticket,
  type TicketCategory,
  type TicketComment,
  type CompanyAgent,
} from '../../services/tickets';
import { storageService } from '../../services/storage';

interface ParsedChatBubble {
  id: string;
  senderType: 'client' | 'staff' | 'announcement';
  senderName: string;
  text: string;
  timeLabel: string;
  createdAt: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'file' | 'audio';
  mediaName?: string;
  ticketTitle?: string;
  aiCategory?: string;
  isRecurringAlert?: boolean;
}

export type SupportChannelType = 'soporte' | 'contabilidad' | 'ventas' | 'otros';

export const SUPPORT_CHANNELS: Record<
  SupportChannelType,
  { id: SupportChannelType; label: string; shortLabel: string; badgeBg: string; badgeText: string }
> = {
  soporte: {
    id: 'soporte',
    label: '🛠️ Soporte Técnico',
    shortLabel: '🛠️ Soporte',
    badgeBg: 'bg-indigo-100 border-indigo-200',
    badgeText: 'text-indigo-800',
  },
  contabilidad: {
    id: 'contabilidad',
    label: '📊 Contabilidad / IVA',
    shortLabel: '📊 Contabilidad',
    badgeBg: 'bg-sky-100 border-sky-200',
    badgeText: 'text-sky-800',
  },
  ventas: {
    id: 'ventas',
    label: '💰 Ventas / Precios',
    shortLabel: '💰 Ventas / Precios',
    badgeBg: 'bg-emerald-100 border-emerald-200',
    badgeText: 'text-emerald-800',
  },
  otros: {
    id: 'otros',
    label: '📦 Otros / General',
    shortLabel: '📦 Otros',
    badgeBg: 'bg-slate-100 border-slate-200',
    badgeText: 'text-slate-700',
  },
};

const DEFAULT_PROMPTS: Record<SupportChannelType, string> = {
  soporte:
    'Eres el Asistente IA de Soporte Técnico de Arias Defense / ERP Facturación Electrónica (DTE Hacienda). Lee o escucha lo que el cliente reportó y respóndele de forma amable, clara y resolutiva en máximo 3 líneas por WhatsApp. Confírmale que entendiste su reporte técnico y pídele captura de pantalla del error o su código de AnyDesk si requiere revisión en su equipo.',
  contabilidad:
    'Eres el Asistente IA del Área Contable y Fiscal (Libros de IVA, Planillas, Declaraciones F07/F14, Anexos Hacienda y Retenciones). Lee o escucha la consulta del cliente y respóndele de forma profesional, precisa y amable en máximo 3 líneas por WhatsApp. Si necesita revisión de algún libro, anexo o cuadre contable, pídele el período (mes/año) o captura del reporte para que el especialista contable lo valide.',
  ventas:
    'Eres el Asesor Comercial IA de Arias Defense (Sistemas ERP, Facturación Electrónica DTE, Contabilidad, POS e Inventarios). El cliente está consultando por precios, planes, demostración o nuevos productos. Respóndele con entusiasmo, cortesía y enfoque comercial en máximo 3 líneas por WhatsApp: infórmale que contamos con planes adaptados a su volumen de facturación/operación y pregúntale su giro de negocio o cantidad aproximada de documentos mensuales para enviarle su cotización o agendar una demo.',
  otros:
    'Eres el Asistente IA de Atención al Cliente de Arias Defense. Lee o escucha el mensaje del cliente y respóndele de forma cortés, clara y servicial en máximo 3 líneas por WhatsApp, confirmando que recibimos su consulta y canalizándola con el área correspondiente.',
};

function detectTicketSupportChannel(t: Ticket): SupportChannelType {
  const meta = (t.metadata || {}) as Record<string, any>;
  const combined = `${t.title || ''} ${t.description || ''} ${meta.ai_category || ''}`.toLowerCase();

  // If it clearly describes a DTE / Hacienda / technical error, it's ALWAYS Soporte (existing client)
  if (
    /dte|hacienda|desconfigurado|no imprime|error al emitir|rechazado|contingencia|invalidaci|firmador|previsualizaci|gaveta|anydesk/i.test(
      combined
    )
  ) {
    return 'soporte';
  }

  if (
    meta.support_channel &&
    ['soporte', 'contabilidad', 'ventas', 'otros'].includes(meta.support_channel)
  ) {
    return meta.support_channel as SupportChannelType;
  }

  if (
    /cuanto cuesta|cuánto cuesta|cuanto vale|cuánto vale|precio del sistema|precios de|cotizaci[oó]n|mensualidad|quiero comprar|contratar|me interesa el sistema|demo del sistema/i.test(
      combined
    )
  ) {
    return 'ventas';
  }
  if (
    /contabilidad|contable|libro de iva|libros de iva|declaraci[oó]n|anexo|f07|f14|retenci[oó]n|planilla|balance general|partida contable/i.test(
      combined
    )
  ) {
    return 'contabilidad';
  }
  if (/otro producto|otros productos|información general|catalogo|catálogo/i.test(combined)) {
    return 'otros';
  }
  return 'soporte';
}

interface SupportCircle {
  circleId: string;
  clientName: string;
  phone: string;
  whatsappJid: string;
  isWhatsApp: boolean;
  isExistingClient: boolean;
  supportChannel: SupportChannelType;
  promotedLeadId: string | null;
  activeTicket: Ticket;
  allClientTickets: Ticket[];
  unreadOrWaitingReply: boolean;
  lastMessageText: string;
  lastMessageSender: string;
  lastMessageAt: string;
  assignedTechId: string | null;
  assignedTechName: string;
  categoryCode: string;
  categoryName: string;
  categoryColor: string;
  totalMessagesCount: number;
  repeatTicketsCount: number;
}

const SUPPORT_QUICK_REPLIES = [
  {
    label: '👋 En revisión',
    text: 'Hola, hemos recibido su reporte en Soporte Técnico. Nuestro ingeniero ya está revisando su caso y le daremos respuesta en breve.',
  },
  {
    label: '🚫 Pedir Texto + Captura (No Audio)',
    text: 'Estimado cliente, para resolver su inconveniente lo más rápido posible, ¿nos podría enviar por favor el detalle en TEXTO ESCRITO acompañado de una CAPTURA DE PANTALLA del error?',
  },
  {
    label: '✅ Validar Solución DTE',
    text: '¡Listo! Ya aplicamos la corrección correspondiente en el sistema. ¿Nos confirma por favor si ya le permite emitir y transmitir su DTE sin inconvenientes?',
  },
  {
    label: '💻 Solicitar AnyDesk',
    text: 'Para revisar directamente en su equipo, ¿nos podría compartir por favor su código de conexión remota (AnyDesk) y confirmar cuando esté disponible?',
  },
];

function normalizeCircleClientName(raw: string): string {
  const clean = (raw || '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'Cliente Soporte';
  if (/arg[oó]z|argos/i.test(clean)) return 'Corporación Argoz';
  if (/don\s+carret[oó]n/i.test(clean)) return 'Don Carretón';
  if (/la\s+econ[oó]mica/i.test(clean)) return 'La Económica';
  if (/medicina\s+popular/i.test(clean)) return 'Medicina Popular';
  if (/conta\s*ohs/i.test(clean)) return 'Conta OHS';
  if (/salinera\s+san\s+jorge/i.test(clean)) return 'Salinera San Jorge';
  if (/moda\s+[ií]ntima/i.test(clean)) return 'Moda Íntima';
  if (/udp\s+volea/i.test(clean)) return 'UDP Volea';
  return clean;
}

function extractClientFromTicket(t: Ticket): string {
  const combined = `${t.title || ''} ${t.lead_name || ''}`;
  if (/arg[oó]z|argos/i.test(combined)) return 'Corporación Argoz';

  if (t.lead_name && t.lead_name.trim().length > 1) {
    return normalizeCircleClientName(t.lead_name.replace(/\(\+\d+\)/g, '').trim());
  }

  const waMatch = (t.title || '').match(/\[WhatsApp[^\]]*\]\s*([^:(]+?)(?:\s*\(\+\d+\))?\s*:/i);
  if (waMatch && waMatch[1]) {
    return normalizeCircleClientName(waMatch[1].trim());
  }

  const colonMatch = (t.title || '').match(
    /^(?:soporte\s+t[eé]cnico|error\s+reportado|capacitaci[oó]n(?:\s+presencial)?|pregunta\s+frecuente|go\s*live|solicitud(?:\s+de\s+cliente)?)\s*:\s*([^-\n(|]+)/i
  );
  if (colonMatch && colonMatch[1]) {
    return normalizeCircleClientName(colonMatch[1].trim());
  }

  return normalizeCircleClientName(t.title || 'Cliente Soporte');
}

function detectShortCategory(catName: string, title: string): { code: string; name: string; color: string } {
  const text = `${catName} ${title}`.toLowerCase();
  if (text.startsWith('p1') || /hacienda|dte|factura\s+electr/i.test(text)) {
    return { code: 'P1', name: catName || 'P1 - Hacienda / DTE', color: '#EF4444' };
  }
  if (text.startsWith('p2') || /error\s+reportado/i.test(text)) {
    return { code: 'P2', name: catName || 'P2 - Errores Sistema', color: '#F97316' };
  }
  if (text.startsWith('p4')) {
    return { code: 'P4', name: catName || 'P4 - Mejoras', color: '#3B82F6' };
  }
  if (/pegunta|pregunta\s+frecuente/i.test(text)) {
    return { code: 'FAQ', name: 'Preguntas Frecuentes', color: '#10B981' };
  }
  return { code: 'P3', name: catName || 'P3 - Soporte Técnico', color: '#F59E0B' };
}

export const SupportChatCircles: React.FC = () => {
  const navigate = useNavigate();
  const { profile, simulatedCompanyId } = useAuth();
  const activeCompanyId = simulatedCompanyId || profile?.company_id;

  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [agents, setAgents] = useState<CompanyAgent[]>([]);
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  // Filters in left Circles column (default to 'all' with WhatsApp & Unanswered at the very top)
  const [searchQuery, setSearchQuery] = useState('');
  const [circleFilter, setCircleFilter] = useState<
    'all' | 'whatsapp' | 'waiting' | 'ventas' | 'soporte' | 'contabilidad'
  >('all');

  // Message input & sending state
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [promotingLead, setPromotingLead] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Live timer measuring how many seconds/minutes the tech spends on this chat
  const [activeChatSeconds, setActiveChatSeconds] = useState(0);

  // Right Control Drawer state (Closed by default for clean Photo 4 layout!)
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [showHistoryAccordion, setShowHistoryAccordion] = useState(false);
  const [savingResolution, setSavingResolution] = useState(false);
  const [resForm, setResForm] = useState({
    actual_hours: '',
    findings: '',
    root_cause: '',
    solution: '',
    time_justification: '',
  });

  // Evolution API Direct Settings Modal (pre-filled with Gerson's instance & API key)
  const [showEvoModal, setShowEvoModal] = useState(false);
  const [evoConfig, setEvoConfig] = useState(() => ({
    url: localStorage.getItem('crm_evo_url') || '',
    key: localStorage.getItem('crm_evo_key') || '10C73BF4-D3D9-4CDB-9855-85E346468546',
    instance: localStorage.getItem('crm_evo_instance') || 'soporte',
  }));

  // Multi-Category AI Auto-Responder (BOTH Text & Audio + OpenAI Live Verification)
  // Default OFF (false) so AI only classifies & transcribes unless explicitly enabled by admin
  const [showAiPromptModal, setShowAiPromptModal] = useState(false);
  const [activePromptTab, setActivePromptTab] = useState<SupportChannelType>('soporte');
  const [aiAutoReplyText, setAiAutoReplyText] = useState(false);
  const [aiAutoReplyAudio, setAiAutoReplyAudio] = useState(false);
  const [aiPrompts, setAiPrompts] = useState<Record<SupportChannelType, string>>(() => ({
    soporte: localStorage.getItem('crm_support_ai_prompt_soporte') || DEFAULT_PROMPTS.soporte,
    contabilidad:
      localStorage.getItem('crm_support_ai_prompt_contabilidad') || DEFAULT_PROMPTS.contabilidad,
    ventas: localStorage.getItem('crm_support_ai_prompt_ventas') || DEFAULT_PROMPTS.ventas,
    otros: localStorage.getItem('crm_support_ai_prompt_otros') || DEFAULT_PROMPTS.otros,
  }));
  const [openAiStatus, setOpenAiStatus] = useState<{
    checking: boolean;
    verified: boolean;
    model: string;
    error: string;
  }>({
    checking: true,
    verified: false,
    model: 'gpt-4o-mini',
    error: '',
  });
  const [savingAiConfig, setSavingAiConfig] = useState(false);

  const verifyAndLoadAiConfig = async (showToast = false) => {
    setOpenAiStatus((p) => ({ ...p, checking: true }));
    try {
      const { data, error } = await supabase.functions.invoke('evolution-whatsapp-webhook', {
        body: { action: 'get_ai_config' },
      });
      if (error) throw error;
      if (data) {
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
          if (data.openai_verified) {
            toast.success(`OpenAI Conectado y Verificado (${data.openai_model || 'gpt-4o-mini'} + Whisper)`);
          } else {
            toast.error(`OpenAI no respondió: ${data.openai_error || 'Verificar API Key'}`);
          }
        }
      }
    } catch (e: any) {
      setOpenAiStatus({
        checking: false,
        verified: false,
        model: 'gpt-4o-mini',
        error: e?.message || 'Error al verificar',
      });
    }
  };

  useEffect(() => {
    if (activeCompanyId) {
      loadSupportData();
      verifyAndLoadAiConfig(false);
    }
  }, [activeCompanyId]);

  // Realtime subscription to tickets & ticket_comments so new WhatsApp messages pop in live!
  useEffect(() => {
    if (!activeCompanyId) return;
    const channel = supabase
      .channel('support_circles_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets' },
        () => {
          loadSupportData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ticket_comments' },
        (payload: any) => {
          const newComment = payload.new as TicketComment;
          setComments((prev) => {
            if (prev.some((c) => c.id === newComment.id)) return prev;
            return [...prev, newComment];
          });
          loadSupportData(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCompanyId]);

  const loadSupportData = async (silent = false) => {
    if (!activeCompanyId) return;
    if (!silent) setLoading(true);
    try {
      const [tks, cats, ags] = await Promise.all([
        ticketService.getTickets(activeCompanyId),
        ticketService.getCategories(activeCompanyId),
        ticketService.getAgents(activeCompanyId),
      ]);
      setTickets(tks);
      setCategories(cats);
      setAgents(ags);
    } catch (err) {
      console.error('[SupportChatCircles] Error loading:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Build "Circles" (1 Circle per Client / WhatsApp Thread — all clients preserved!)
  const circles = useMemo<SupportCircle[]>(() => {
    const catMap = new Map<string, TicketCategory>();
    categories.forEach((c) => catMap.set(c.id, c));

    const agentMap = new Map<string, string>();
    agents.forEach((a) => agentMap.set(a.id, a.full_name || a.email));

    const groupMap = new Map<string, Ticket[]>();

    tickets.forEach((t) => {
      // Skip shift wrapper logs
      if (/^\s*jornada\s+(melvin|gerson)/i.test(t.title || '')) return;

      const meta = (t.metadata || {}) as Record<string, any>;
      const clientName = extractClientFromTicket(t);
      const key =
        clientName !== 'Cliente Soporte'
          ? clientName
          : String(meta.whatsapp_phone || meta.whatsapp_jid || t.id);

      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(t);
    });

    const list: SupportCircle[] = [];

    groupMap.forEach((clientTickets, key) => {
      const sorted = [...clientTickets].sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at).getTime() -
          new Date(a.updated_at || a.created_at).getTime()
      );

      // Check if ANY ticket for this client came via WhatsApp
      const waTicket = sorted.find((t) => {
        const m = (t.metadata || {}) as Record<string, any>;
        return (
          m.source === 'whatsapp_evolution' ||
          Boolean(m.whatsapp_phone) ||
          Boolean(m.whatsapp_jid) ||
          /\[whatsapp/i.test(t.title || '')
        );
      });
      const isWhatsApp = Boolean(waTicket);

      // Prefer an open WhatsApp ticket first, then any WhatsApp ticket, then open ticket, then most recent
      const activeTicket =
        sorted.find((t) => {
          const m = (t.metadata || {}) as Record<string, any>;
          const isWa =
            m.source === 'whatsapp_evolution' ||
            Boolean(m.whatsapp_phone) ||
            Boolean(m.whatsapp_jid) ||
            /\[whatsapp/i.test(t.title || '');
          return isWa && ['new', 'open', 'pending'].includes(t.status);
        }) ||
        waTicket ||
        sorted.find((t) => ['new', 'open', 'pending'].includes(t.status)) ||
        sorted[0];

      const meta = (activeTicket.metadata || {}) as Record<string, any>;
      const waMeta = ((waTicket?.metadata || meta) as Record<string, any>) || {};
      const phone = String(meta.whatsapp_phone || waMeta.whatsapp_phone || '').replace(/\D/g, '');
      const whatsappJid = String(meta.whatsapp_jid || waMeta.whatsapp_jid || '');
      const clientName = extractClientFromTicket(activeTicket);

      const catObj = activeTicket.category_id ? catMap.get(activeTicket.category_id) : undefined;
      const catInfo = detectShortCategory(catObj?.name || '', activeTicket.title || '');

      const assignedTechId = activeTicket.assigned_to || null;
      const assignedTechName =
        (assignedTechId && agentMap.get(assignedTechId)) ||
        activeTicket.assigned_profile?.full_name ||
        'Sin asignar';

      // Extract last message from description or metadata
      const descLines = (activeTicket.description || '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const lastChatLine = [...descLines]
        .reverse()
        .find((l) => l.startsWith('[') && (l.includes('👤') || l.includes('👨‍💻')));

      let lastMessageSender = clientName;
      let lastMessageText = String(meta.last_whatsapp_message || activeTicket.title || '');
      if (lastChatLine) {
        const m = lastChatLine.match(/^\[[^\]]+\]\s*([^:]+):\s*(.+)$/);
        if (m) {
          lastMessageSender = m[1].replace(/[👤👨‍💻]/g, '').trim();
          lastMessageText = m[2].trim();
        }
      }

      const isOpen = ['new', 'open', 'pending'].includes(activeTicket.status);
      const lastWasClient = !lastChatLine || lastChatLine.includes('👤');
      const unreadOrWaitingReply = isOpen && lastWasClient;

      // Smart automatic recognition: Existing Client vs. New Lead/Prospect
      const combinedText = `${activeTicket.title || ''} ${activeTicket.description || ''} ${clientName}`.toLowerCase();
      const hasExistingSystemIssue =
        /dte|hacienda|factura|facturaci|desconfigurado|no imprime|impresora|contingencia|invalidaci|firmador|anexo|f07|f14|libro de iva|retenci|planilla|gaveta|corte de caja|anydesk|erp|sistema/i.test(
          combinedText
        );
      const isKnownClientName =
        /yanci|walter|jimmy|arg[oó]z|argos|carret[oó]n|econ[oó]mica|medicina popular|conta\s*ohs|salinera|moda [ií]ntima|volea|kinder|ferreter[ií]a/i.test(
          clientName
        );

      const isExistingClient =
        !isWhatsApp ||
        sorted.length > 1 ||
        Boolean(assignedTechId) ||
        hasExistingSystemIssue ||
        isKnownClientName;

      let supportChannel = detectTicketSupportChannel(activeTicket);
      // If a brand-new unknown WhatsApp contact writes for the first time (not an existing client),
      // classify them under 'ventas' (Posible Lead / Nuevo Contacto) unless already in contabilidad
      if (!isExistingClient && isWhatsApp && supportChannel === 'soporte') {
        supportChannel = 'ventas';
      }

      const promotedLeadId =
        !isExistingClient || supportChannel === 'ventas'
          ? String(activeTicket.lead_id || meta.promoted_lead_id || '') || null
          : null;

      list.push({
        circleId: key,
        clientName,
        phone,
        whatsappJid,
        isWhatsApp,
        isExistingClient,
        supportChannel,
        promotedLeadId,
        activeTicket,
        allClientTickets: sorted,
        unreadOrWaitingReply,
        lastMessageText,
        lastMessageSender,
        lastMessageAt: activeTicket.updated_at || activeTicket.created_at,
        assignedTechId,
        assignedTechName,
        categoryCode: catInfo.code,
        categoryName: catInfo.name,
        categoryColor: catInfo.color,
        totalMessagesCount: Number(meta.whatsapp_message_count || sorted.length),
        repeatTicketsCount: Math.max(0, sorted.length - 1),
      });
    });

    // Sort: WhatsApp active chats first, then open waiting reply (NUEVO), then most recent
    return list.sort((a, b) => {
      if (a.isWhatsApp !== b.isWhatsApp) return a.isWhatsApp ? -1 : 1;
      if (a.unreadOrWaitingReply !== b.unreadOrWaitingReply)
        return a.unreadOrWaitingReply ? -1 : 1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });
  }, [tickets, categories, agents]);

  const channelCounts = useMemo(() => {
    const waCircles = circles.filter((c) => c.isWhatsApp);
    return {
      whatsapp: waCircles.length,
      soporte: circles.filter((c) => c.isExistingClient && c.supportChannel === 'soporte').length,
      contabilidad: circles.filter((c) => c.supportChannel === 'contabilidad').length,
      ventas: circles.filter((c) => !c.isExistingClient || c.supportChannel === 'ventas').length,
      waiting: circles.filter((c) => c.unreadOrWaitingReply).length,
      all: circles.length,
    };
  }, [circles]);

  // Filtered Circles in left sidebar
  const filteredCircles = useMemo(() => {
    return circles.filter((c) => {
      if (circleFilter === 'waiting' && !c.unreadOrWaitingReply) return false;
      if (circleFilter === 'whatsapp' && !c.isWhatsApp) return false;
      if (circleFilter === 'soporte' && !(c.isExistingClient && c.supportChannel === 'soporte'))
        return false;
      if (circleFilter === 'contabilidad' && c.supportChannel !== 'contabilidad') return false;
      if (circleFilter === 'ventas' && !(!c.isExistingClient || c.supportChannel === 'ventas'))
        return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.clientName.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.lastMessageText.toLowerCase().includes(q) ||
          c.assignedTechName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [circles, circleFilter, searchQuery]);

  // Auto-select first circle
  useEffect(() => {
    if (!selectedCircleId && filteredCircles.length > 0) {
      setSelectedCircleId(filteredCircles[0].circleId);
    }
  }, [filteredCircles, selectedCircleId]);

  const activeCircle = useMemo(
    () => circles.find((c) => c.circleId === selectedCircleId) || circles[0] || null,
    [circles, selectedCircleId]
  );

  // Load ticket_comments and reset resolution form when activeCircle changes
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

    setLoadingComments(true);
    ticketService
      .getComments(t.id)
      .then((data) => setComments(data || []))
      .catch(() => setComments([]))
      .finally(() => setLoadingComments(false));
  }, [activeCircle?.activeTicket.id]);

  // Live timer tick every second while viewing this chat
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveChatSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeCircle?.activeTicket.id]);

  // Build visual chat bubbles (Announcement banner + parsed WhatsApp lines + comments + attachments)
  const chatBubbles = useMemo<ParsedChatBubble[]>(() => {
    if (!activeCircle) return [];
    const t = activeCircle.activeTicket;
    const meta = (t.metadata || {}) as Record<string, any>;
    const list: ParsedChatBubble[] = [];

    // 1. System Announcement Card (like "🔔 Announcement from..." in the screenshot)
    list.push({
      id: `ann-${t.id}`,
      senderType: 'announcement',
      senderName: `Ticket #${t.id.slice(0, 8).toUpperCase()} · ${activeCircle.categoryName}`,
      text: t.title,
      timeLabel: new Date(t.created_at).toLocaleTimeString('es-SV', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      createdAt: t.created_at,
      aiCategory: String(meta.ai_category || activeCircle.categoryName),
      isRecurringAlert: activeCircle.repeatTicketsCount > 0,
    });

    // 2. If comments exist, parse them into bubbles; otherwise parse lines from description
    if (comments.length > 0) {
      comments.forEach((c) => {
        const raw = (c.body || '').trim();
        const lineMatch = raw.match(/^\[([^\]]+)\]\s*(👤|👨‍💻)?\s*([^:]+):\s*([\s\S]+)$/);
        if (lineMatch) {
          const timeStr = lineMatch[1];
          const icon = lineMatch[2] || '';
          const sender = lineMatch[3].trim();
          const rawBodyText = lineMatch[4].trim();

          const audioUrlMatch = rawBodyText.match(/\[AUDIO_URL:([^\]]+)\]/i);
          const extractedAudioUrl = audioUrlMatch ? audioUrlMatch[1].trim() : undefined;
          const cleanBodyText = rawBodyText.replace(/\s*\[AUDIO_URL:[^\]]+\]/gi, '').trim();

          const isClientSender =
            icon === '👤' ||
            /jimmy arias/i.test(sender) ||
            sender.toLowerCase() === activeCircle.clientName.toLowerCase();

          const isStaff =
            !isClientSender &&
            (icon === '👨‍💻' ||
              Boolean(c.author_id) ||
              /melvin|gerson|soporte|equipo|platform owner|simulaci|🤖 ia|ia /i.test(sender));

          list.push({
            id: c.id,
            senderType: isStaff ? 'staff' : 'client',
            senderName: sender.replace(/\(Reporte Inicial\)/i, '').trim(),
            text: cleanBodyText,
            timeLabel: timeStr,
            createdAt: c.created_at,
            mediaUrl: extractedAudioUrl,
            mediaType: extractedAudioUrl ? 'audio' : undefined,
          });
        } else {
          const agent = agents.find((a) => a.id === c.author_id);
          const isStaff = Boolean(c.author_id);
          const audioUrlMatch = raw.match(/\[AUDIO_URL:([^\]]+)\]/i);
          const extractedAudioUrl = audioUrlMatch ? audioUrlMatch[1].trim() : undefined;
          const cleanBodyText = raw.replace(/\s*\[AUDIO_URL:[^\]]+\]/gi, '').trim();
          list.push({
            id: c.id,
            senderType: isStaff ? 'staff' : 'client',
            senderName: isStaff ? agent?.full_name || 'Ingeniero Soporte' : activeCircle.clientName,
            text: cleanBodyText,
            timeLabel: new Date(c.created_at).toLocaleTimeString('es-SV', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            createdAt: c.created_at,
            mediaUrl: extractedAudioUrl,
            mediaType: extractedAudioUrl ? 'audio' : undefined,
          });
        }
      });
    } else if (t.description) {
      const lines = t.description.split('\n');
      let foundChatLines = false;
      lines.forEach((line, idx) => {
        const lineMatch = line
          .trim()
          .match(/^\[([^\]]+)\]\s*(👤|👨‍💻)?\s*([^:]+):\s*([\s\S]+)$/);
        if (lineMatch) {
          foundChatLines = true;
          const sender = lineMatch[3].trim();
          const isClientSender =
            lineMatch[2] === '👤' ||
            /jimmy arias/i.test(sender) ||
            sender.toLowerCase() === activeCircle.clientName.toLowerCase();
          const isStaff =
            !isClientSender &&
            (lineMatch[2] === '👨‍💻' ||
              /melvin|gerson|soporte|equipo|platform owner|simulaci|🤖 ia|ia /i.test(sender));
          list.push({
            id: `desc-${idx}`,
            senderType: isStaff ? 'staff' : 'client',
            senderName: sender,
            text: lineMatch[4].trim(),
            timeLabel: lineMatch[1],
            createdAt: t.created_at,
          });
        }
      });

      if (!foundChatLines && t.description.trim()) {
        list.push({
          id: `desc-main`,
          senderType: 'client',
          senderName: activeCircle.clientName,
          text: t.description.trim(),
          timeLabel: new Date(t.created_at).toLocaleTimeString('es-SV', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          createdAt: t.created_at,
        });
      }
    }

    // 3. Append any media attachments from ticket metadata.attachments (like the video/image card in screenshot!)
    const attachments = Array.isArray(meta.attachments) ? meta.attachments : [];
    attachments.forEach((att: any, i: number) => {
      const isVideo = String(att.type || '').startsWith('video/');
      const isImage = String(att.type || '').startsWith('image/');
      list.push({
        id: `att-${i}`,
        senderType: 'staff',
        senderName: activeCircle.assignedTechName || 'Soporte',
        text: att.name || 'Archivo adjunto',
        timeLabel: new Date(att.uploaded_at || t.updated_at || t.created_at).toLocaleTimeString(
          'es-SV',
          { hour: '2-digit', minute: '2-digit' }
        ),
        createdAt: att.uploaded_at || t.updated_at || t.created_at,
        mediaUrl: att.url,
        mediaType: isVideo ? 'video' : isImage ? 'image' : 'file',
        mediaName: att.name,
      });
    });

    return list;
  }, [activeCircle, comments, agents]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatBubbles.length, activeCircle?.circleId]);

  // AI Time Audit for the Right Control Panel
  const aiTimeAudit = useMemo(() => {
    if (!activeCircle) return null;
    const t = activeCircle.activeTicket;
    return computeTicketAiTimeBenchmark(
      t.title || '',
      t.description || '',
      activeCircle.categoryName,
      Number(resForm.actual_hours) || 0
    );
  }, [activeCircle, resForm.actual_hours]);

  // Send Reply from the Chat Input Bar (Instant Optimistic UI + 1s WhatsApp Bridge Delivery)
  const handleSendReply = async (customText?: string) => {
    const textToSend = (customText ?? messageInput).trim();
    if (!textToSend || !activeCircle || !activeCompanyId) return;

    const t = activeCircle.activeTicket;
    const rawAuthor = profile?.full_name || profile?.email || 'Ingeniero Soporte';
    const authorName = /simulaci/i.test(rawAuthor) ? 'Soporte Técnico' : rawAuthor;
    const responseMinutes = Math.max(1, Math.round(activeChatSeconds / 60));

    // 1. Instant optimistic clear & bubble so the button NEVER feels stuck
    if (!customText) setMessageInput('');
    const nowTimeStr = new Date().toLocaleTimeString('es-SV', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const optimisticId = `temp-${Date.now()}`;
    const optimisticComment: TicketComment = {
      id: optimisticId,
      ticket_id: t.id,
      company_id: activeCompanyId,
      author_id: profile?.id || null,
      body: `[${nowTimeStr}] 👨‍💻 ${authorName}: ${textToSend}`,
      is_internal: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setComments((prev) => [...prev, optimisticComment]);

    // Immediately mark this ticket as answered in local state so it switches from BOLD to non-bold right away
    setTickets((prev) =>
      prev.map((tk) =>
        tk.id === t.id
          ? {
              ...tk,
              description: `${tk.description || ''}\n[${nowTimeStr}] 👨‍💻 ${authorName}: ${textToSend}`,
              updated_at: new Date().toISOString(),
            }
          : tk
      )
    );

    if (!resForm.actual_hours || Number(resForm.actual_hours) <= 0) {
      setResForm((p) => ({ ...p, actual_hours: '0.2' }));
    }

    setSendingMessage(true);
    try {
      const { data, error } = await supabase.functions.invoke('evolution-whatsapp-webhook', {
        body: {
          action: 'send_reply',
          ticket_id: t.id,
          company_id: activeCompanyId,
          author_id: profile?.id || null,
          author_name: authorName,
          message_text: textToSend,
          response_minutes: responseMinutes,
          custom_evolution_url: evoConfig.url || undefined,
          custom_evolution_key: evoConfig.key || undefined,
          custom_evolution_instance: evoConfig.instance || undefined,
        },
      });

      if (error) throw error;

      if (data?.comment) {
        setComments((prev) =>
          prev.map((c) => (c.id === optimisticId ? data.comment : c))
        );
      }

      toast.success('Mensaje enviado directo al WhatsApp del cliente ✓✓');
      loadSupportData(true);
    } catch (err: any) {
      console.error('Error sending reply:', err);
      toast.error(err?.message || 'Error al enviar mensaje');
    } finally {
      setSendingMessage(false);
    }
  };

  // Upload image/video attachment directly from the bottom bar
  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeCircle || !activeCompanyId) return;
    setUploadingFile(true);
    try {
      const t = activeCircle.activeTicket;
      const uploaded = await storageService.uploadTicketAttachment(activeCompanyId, file);
      const meta = (t.metadata || {}) as Record<string, any>;
      const prevAtt = Array.isArray(meta.attachments) ? meta.attachments : [];
      const newAtt = [
        ...prevAtt,
        {
          name: file.name,
          url: uploaded.url,
          type: file.type,
          size: file.size,
          uploaded_at: new Date().toISOString(),
        },
      ];
      await ticketService.updateTicket(t.id, {
        metadata: { ...meta, attachments: newAtt },
      });
      await handleSendReply(`📎 Archivo adjunto enviado: ${file.name}`);
      toast.success('Imagen / archivo adjuntado al chat');
    } catch (err: any) {
      toast.error(err?.message || 'Error al subir archivo');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Assign Technician with 1 click
  const handleAssignTech = async (techId: string) => {
    if (!activeCircle) return;
    try {
      await ticketService.updateTicket(activeCircle.activeTicket.id, {
        assigned_to: techId || null,
      });
      toast.success('Ingeniero asignado al chat');
      loadSupportData(true);
    } catch (err: any) {
      toast.error(err?.message || 'Error al asignar');
    }
  };

  // Switch Channel Category (Soporte | Contabilidad | Ventas | Otros) with 1 click
  const handleSwitchChannel = async (newChannel: SupportChannelType) => {
    if (!activeCircle) return;
    try {
      const { error } = await supabase.functions.invoke('evolution-whatsapp-webhook', {
        body: {
          action: 'set_ticket_channel',
          ticket_id: activeCircle.activeTicket.id,
          support_channel: newChannel,
        },
      });
      if (error) throw error;
      toast.success(`Canal cambiado a ${SUPPORT_CHANNELS[newChannel].label}`);
      loadSupportData(true);
    } catch (err: any) {
      toast.error(err?.message || 'Error al cambiar categoría');
    }
  };

  // 1-Click Promote WhatsApp Chat to Sales Lead ("Pasar a Ventas")
  const handlePromoteToLead = async () => {
    if (!activeCircle) return;
    if (activeCircle.promotedLeadId) {
      navigate('/leads');
      return;
    }
    setPromotingLead(true);
    try {
      const { data, error } = await supabase.functions.invoke('evolution-whatsapp-webhook', {
        body: {
          action: 'promote_to_lead',
          ticket_id: activeCircle.activeTicket.id,
          client_name: activeCircle.clientName,
          phone: activeCircle.phone,
        },
      });
      if (error) throw error;
      toast.success(
        data?.already_existed
          ? `Vinculado con Lead existente en Ventas (${activeCircle.clientName})`
          : `¡Prospecto creado en Ventas (Leads) para ${activeCircle.clientName}!`
      );
      loadSupportData(true);
    } catch (err: any) {
      toast.error(err?.message || 'Error al crear Lead en Ventas');
    } finally {
      setPromotingLead(false);
    }
  };

  // Save Resolution + Time + Optionally Close & Notify Client
  const handleCompleteAndCloseTicket = async (notifyClient: boolean) => {
    if (!activeCircle || !aiTimeAudit) return;
    const hrs = Number(resForm.actual_hours) || 0;
    if (hrs <= 0) {
      toast.error('⚠️ Nadie puede cerrar un ticket sin poner el Tiempo Real (> 0 horas).');
      return;
    }
    if (
      resForm.findings.trim().length < 5 ||
      resForm.root_cause.trim().length < 5 ||
      resForm.solution.trim().length < 5
    ) {
      toast.error(
        '⚠️ Debes completar Hallazgos, Causa Raíz y Solución antes de cerrar el ticket.'
      );
      return;
    }
    if (aiTimeAudit.status === 'inflated' && resForm.time_justification.trim().length < 8) {
      toast.error(
        `⚠️ La IA detectó tiempo inflado (+${aiTimeAudit.differenceHours}h sobre lo esperado). Escribe la justificación.`
      );
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
        await handleSendReply(
          `✅ Su caso ha sido resuelto (${resForm.solution.trim()}). Quedamos atentos a su confirmación.`
        );
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

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const greetingTime = () => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Buenos días';
    if (hr < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };

  return (
    <div className="h-screen flex-1 flex flex-col bg-[#F5F6FA] overflow-hidden select-none">
      {/* =====================================================================
          1. TOP HEADER BAR (EXACT CLEAN AESTHETIC FROM SCREENSHOT)
         ===================================================================== */}
      <header className="h-14 bg-white border-b border-slate-200/80 px-5 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full bg-indigo-600" />
            <span className="text-sm font-black text-slate-900 tracking-tight">
              Support Chat
            </span>
          </div>
          <span className="text-slate-300">|</span>
          <span className="text-xs font-medium text-slate-600 hidden sm:inline">
            {greetingTime()},{' '}
            <strong className="font-black text-slate-900">
              {profile?.full_name?.split(' ')[0] || 'Admin'}
            </strong>{' '}
            👋
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#EEF0FF] text-indigo-700">
            <Phone className="w-3 h-3 text-indigo-600" />
            +503 7971-8911
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="hidden md:inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#EEF0FF] text-indigo-700">
            {profile?.role === 'super_admin' ? 'ADMINISTRATOR' : 'SUPPORT'}
          </span>

          <button
            onClick={() => setShowAiPromptModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#EEF0FF] text-indigo-700 hover:bg-indigo-100 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>IA</span>
          </button>

          <button
            onClick={() => setShowEvoModal(true)}
            title="Configuración WhatsApp"
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <Settings className="w-4 h-4" />
          </button>

          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-sm">
            {(profile?.full_name || 'AD')
              .split(' ')
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </div>
        </div>
      </header>

      {/* =====================================================================
          2. CLEAN WORKSPACE (EXACT PHOTO 4 LAYOUT: LEFT CIRCLES + WIDE CHAT)
         ===================================================================== */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── LEFT COLUMN: CIRCLES (Clean, spacious, all chats accessible) ── */}
        <aside className="w-80 bg-white border-r border-slate-200/70 flex flex-col shrink-0">
          {/* Circles Title + Refresh button (Exact match to Photo 4) */}
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Circles</h2>
              <p className="text-[11px] font-medium text-slate-400">
                {filteredCircles.length} conversaciones
              </p>
            </div>
            <button
              onClick={() => loadSupportData()}
              title="Actualizar chats"
              className="w-9 h-9 rounded-xl bg-[#EEF0FF] hover:bg-indigo-100 text-indigo-600 flex items-center justify-center transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Search input */}
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar cliente, teléfono o mensaje..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/70 rounded-full text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {/* Clean filter pills: Todos | WhatsApp | Sin Contestar | Clientes | Leads | Contabilidad */}
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              {[
                { id: 'all', label: `Todos (${channelCounts.all})` },
                { id: 'whatsapp', label: `💬 WhatsApp (${channelCounts.whatsapp})` },
                {
                  id: 'waiting',
                  label: `Sin Contestar (${channelCounts.waiting})`,
                  isAlert: channelCounts.waiting > 0,
                },
                { id: 'ventas', label: `🆕 Leads (${channelCounts.ventas})` },
                { id: 'soporte', label: `🏢 Clientes (${channelCounts.soporte})` },
                { id: 'contabilidad', label: `📊 Contabilidad (${channelCounts.contabilidad})` },
              ].map((tab) => {
                const active = circleFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setCircleFilter(tab.id as any)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition flex items-center gap-1 ${
                      active
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                    }`}
                  >
                    {tab.isAlert && !active && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    )}
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Circles List (BOLD for unanswered, NON-BOLD for answered) */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredCircles.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 font-medium">
                No hay conversaciones en esta vista.
              </div>
            ) : (
              filteredCircles.map((circle) => {
                const isSelected = activeCircle?.circleId === circle.circleId;
                const timeStr = new Date(circle.lastMessageAt).toLocaleTimeString('es-SV', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const isSalesLead =
                  !circle.isExistingClient ||
                  circle.supportChannel === 'ventas' ||
                  Boolean(circle.promotedLeadId);
                const isUnread = circle.unreadOrWaitingReply;

                return (
                  <button
                    key={circle.circleId}
                    type="button"
                    onClick={() => setSelectedCircleId(circle.circleId)}
                    className={`w-full text-left px-4 py-3.5 flex items-center gap-3.5 transition relative ${
                      isSelected
                        ? 'bg-[#EEF0FF]/90'
                        : isUnread
                        ? 'bg-white hover:bg-slate-50'
                        : 'bg-slate-50/30 hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Avatar (Exact size & clean look from Photo 4) */}
                    <div className="relative shrink-0">
                      <div
                        className={`w-11 h-11 rounded-full flex items-center justify-center text-xs text-white ${
                          isUnread ? 'font-black' : 'font-normal opacity-80'
                        } ${
                          isSalesLead
                            ? 'bg-emerald-600'
                            : circle.supportChannel === 'contabilidad'
                            ? 'bg-sky-600'
                            : 'bg-indigo-600'
                        }`}
                      >
                        {circle.clientName
                          .split(' ')
                          .map((w) => w[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      {isUnread && (
                        <span className="w-3 h-3 rounded-full bg-rose-500 border-2 border-white absolute -top-0.5 -right-0.5" />
                      )}
                    </div>

                    {/* Clean 2-Line Text Preview: BOLD when unanswered, NON-BOLD when already answered */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`text-xs uppercase tracking-tight truncate ${
                              isUnread
                                ? 'font-black text-slate-950'
                                : 'font-normal text-slate-500'
                            }`}
                          >
                            {circle.clientName}
                          </span>
                          {isUnread && (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-rose-500 text-white shrink-0">
                              NUEVO
                            </span>
                          )}
                          {isSalesLead ? (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                              LEAD
                            </span>
                          ) : circle.isWhatsApp ? (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-indigo-50 text-indigo-700 shrink-0">
                              Cliente
                            </span>
                          ) : null}
                        </div>
                        <span
                          className={`text-[10px] shrink-0 ${
                            isUnread
                              ? 'font-extrabold text-indigo-600'
                              : 'font-normal text-slate-400'
                          }`}
                        >
                          {timeStr}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p
                          className={`text-xs truncate ${
                            isUnread
                              ? 'text-slate-900 font-bold'
                              : 'text-slate-400 font-normal'
                          }`}
                        >
                          {circle.lastMessageSender}: {circle.lastMessageText}
                        </p>
                        {circle.supportChannel === 'contabilidad' && (
                          <span className="text-[9px] font-medium text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded shrink-0">
                            Contab.
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

        {/* ── CENTER COLUMN: THE LIVE CHAT (Exact wide, clean Photo 4 style) ── */}
        {activeCircle ? (
          <main className="flex-1 flex flex-col bg-[#F3F4F8] overflow-hidden">
            {/* Active Circle Header (Clean like "JOVENES / 0 members" in Photo 4) */}
            <div className="h-16 bg-white border-b border-slate-200/70 px-6 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-full text-white font-black text-xs flex items-center justify-center shrink-0 ${
                    !activeCircle.isExistingClient || activeCircle.supportChannel === 'ventas'
                      ? 'bg-emerald-600'
                      : 'bg-indigo-600'
                  }`}
                >
                  {activeCircle.clientName
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight truncate">
                      {activeCircle.clientName}
                    </h3>
                    {activeCircle.isExistingClient && activeCircle.supportChannel !== 'ventas' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60 shrink-0">
                        🏢 Cliente Activo ({activeCircle.allClientTickets.length} tickets)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 shrink-0">
                        🆕 Posible Lead / Prospecto
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-slate-400 truncate">
                    {activeCircle.phone ? `+${activeCircle.phone}` : 'Canal Soporte'} · Atiende:{' '}
                    {activeCircle.assignedTechName}
                  </p>
                </div>
              </div>

              {/* Clean, minimal right controls in Chat Header */}
              <div className="flex items-center gap-2">
                {/* Subtle Category Selector */}
                <select
                  value={activeCircle.supportChannel}
                  onChange={(e) => handleSwitchChannel(e.target.value as SupportChannelType)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200/70 text-slate-700 cursor-pointer focus:outline-none transition"
                >
                  <option value="soporte">🛠️ Soporte (Cliente)</option>
                  <option value="contabilidad">📊 Contabilidad (Cliente)</option>
                  <option value="ventas">💰 Lead Ventas (Prospecto)</option>
                  <option value="otros">📦 Otros</option>
                </select>

                {/* ONLY show "+ Crear Lead" when it's a New Prospect / Lead (never on existing clients like Yanci!) */}
                {(!activeCircle.isExistingClient || activeCircle.supportChannel === 'ventas') && (
                  <button
                    type="button"
                    disabled={promotingLead}
                    onClick={handlePromoteToLead}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      activeCircle.promotedLeadId
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>
                      {promotingLead
                        ? 'Guardando...'
                        : activeCircle.promotedLeadId
                        ? 'En Leads ✓'
                        : 'Pasar a Ventas (Lead)'}
                    </span>
                  </button>
                )}

                {/* Toggle Ticket Resolution Drawer (Icon button like Photo 4's right button) */}
                <button
                  type="button"
                  onClick={() => setShowRightPanel(!showRightPanel)}
                  title="Abrir panel para cerrar ticket o asignar técnico"
                  className={`w-10 h-9 rounded-xl flex items-center justify-center transition ${
                    showRightPanel
                      ? 'bg-indigo-600 text-white'
                      : 'bg-[#EEF0FF] text-indigo-600 hover:bg-indigo-100'
                  }`}
                >
                  {showRightPanel ? (
                    <PanelRightClose className="w-4 h-4" />
                  ) : (
                    <PanelRightOpen className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Chat Messages Stream (Spacious & clean like Photo 4) */}
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
              {/* "Today" Pill at the top (Exact match to Photo 4) */}
              <div className="flex justify-center mb-2">
                <span className="px-3.5 py-1 rounded-full bg-white text-[11px] font-bold text-slate-600 shadow-2xs">
                  Today
                </span>
              </div>

              {loadingComments ? (
                <div className="text-center py-12 text-xs font-medium text-slate-400">
                  Cargando mensajes...
                </div>
              ) : (
                chatBubbles.map((b) => {
                  // 1. Center Announcement Card (Exact clean 2-line style from Photo 4!)
                  if (b.senderType === 'announcement') {
                    return (
                      <div key={b.id} className="flex justify-center my-2">
                        <div className="max-w-sm w-full bg-[#E6E9FF] rounded-2xl px-4 py-3 shadow-2xs">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600">
                            <Bell className="w-3.5 h-3.5" />
                            <span>Announcement · {b.senderName}</span>
                          </div>
                          <p className="text-xs font-medium text-slate-800 mt-1 leading-snug">
                            {b.text}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  // 2. Outgoing Staff Message (Right-aligned soft lavender bubble with green ✓✓ like Photo 4!)
                  if (b.senderType === 'staff') {
                    return (
                      <div key={b.id} className="flex justify-end">
                        <div className="max-w-md bg-[#DFE3FF] text-slate-900 rounded-2xl rounded-br-xs px-4 py-2.5 shadow-2xs">
                          {b.mediaUrl && b.mediaType === 'video' && (
                            <video
                              src={b.mediaUrl}
                              controls
                              className="w-64 rounded-xl mb-2"
                            />
                          )}
                          {b.mediaUrl && b.mediaType === 'image' && (
                            <a href={b.mediaUrl} target="_blank" rel="noopener noreferrer">
                              <img
                                src={b.mediaUrl}
                                alt={b.mediaName || 'Imagen'}
                                className="w-64 rounded-xl mb-2 object-cover"
                              />
                            </a>
                          )}

                          {b.mediaUrl && b.mediaType === 'audio' && (
                            <div className="my-1.5">
                              <audio
                                src={b.mediaUrl}
                                controls
                                preload="metadata"
                                className="w-72 h-9 rounded-full"
                              />
                            </div>
                          )}

                          <p className="text-xs font-medium text-slate-900 whitespace-pre-wrap leading-relaxed">
                            {b.text}
                          </p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-[10px] font-medium text-slate-500">
                              {b.timeLabel}
                            </span>
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // 3. Incoming Client Message (Left-aligned clean card)
                  return (
                    <div key={b.id} className="flex justify-start">
                      <div className="max-w-md bg-white text-slate-900 rounded-2xl rounded-bl-xs px-4 py-3 shadow-2xs">
                        <p className="text-[11px] font-bold text-indigo-600 mb-0.5">
                          {b.senderName}
                        </p>

                        {b.mediaUrl && b.mediaType === 'audio' && (
                          <div className="my-2">
                            <audio
                              src={b.mediaUrl}
                              controls
                              preload="metadata"
                              className="w-72 h-9"
                            />
                          </div>
                        )}

                        <p className="text-xs font-medium text-slate-800 whitespace-pre-wrap leading-relaxed">
                          {b.text}
                        </p>
                        <div className="flex items-center justify-end mt-1">
                          <span className="text-[10px] font-medium text-slate-400">
                            {b.timeLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Message Bar (Exact match to Photo 4: + [ Message... ] 📷 ➤) */}
            <div className="bg-white px-5 py-3 border-t border-slate-200/70 flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,application/pdf"
                onChange={handleUploadAttachment}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                title="Adjuntar imagen o archivo"
                className="w-8 h-8 rounded-full text-slate-500 hover:bg-slate-100 flex items-center justify-center transition shrink-0"
              >
                <Plus className="w-5 h-5" />
              </button>

              <div className="flex-1 relative">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                  placeholder="Message..."
                  className="w-full px-4 py-2.5 bg-[#F3F4F8] border border-slate-200/80 rounded-full text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                title="Subir imagen"
                className="p-2 rounded-full text-slate-500 hover:bg-slate-100 transition"
              >
                <Camera className="w-4 h-4" />
              </button>

              <button
                type="button"
                disabled={!messageInput.trim() || sendingMessage}
                onClick={() => handleSendReply()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold transition"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </main>
        ) : (
          <main className="flex-1 flex items-center justify-center bg-[#F3F4F8] text-slate-400 text-sm font-bold">
            Selecciona un cliente en la columna izquierda ("Circles") para ver su chat.
          </main>
        )}

        {/* =====================================================================
            3. RIGHT MINI-MODULE: CONTROL DEL TICKET, TIEMPO OBLIGATORIO & IA
           ===================================================================== */}
        {activeCircle && showRightPanel && (
          <aside className="w-96 bg-white border-l border-slate-200/80 flex flex-col overflow-y-auto shrink-0">
            {/* Header del Mini-Módulo */}
            <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-[#EEF0FF]/70 to-white">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700">
                  📋 Mini-Módulo de Control & IA
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${['resolved', 'closed'].includes(activeCircle.activeTicket.status)
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-900'
                    }`}
                >
                  {['resolved', 'closed'].includes(activeCircle.activeTicket.status)
                    ? '✓ Resuelto'
                    : '⏳ Abierto'}
                </span>
              </div>
              <h4 className="text-sm font-black text-slate-900 mt-1">
                Ticket #{activeCircle.activeTicket.id.slice(0, 8).toUpperCase()}
              </h4>
              <p className="text-[11px] text-slate-500 font-medium line-clamp-2 mt-0.5">
                {activeCircle.activeTicket.title}
              </p>
            </div>

            <div className="p-4 space-y-4 flex-1">
              {/* 1. Asignación Rápida de Técnico (Melvin / Gerson) */}
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                  1. Ingeniero Responsable
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

              {/* 2. Auditor IA de Tiempo (Obligatorio > 0h para cerrar) */}
              {aiTimeAudit && (
                <div
                  className={`rounded-2xl p-3.5 border space-y-2.5 ${aiTimeAudit.status === 'inflated'
                      ? 'bg-rose-50/70 border-rose-200'
                      : aiTimeAudit.status === 'missing_time'
                        ? 'bg-amber-50/60 border-amber-200'
                        : 'bg-emerald-50/60 border-emerald-200'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-800">
                      ⏱️ 2. Tiempo Real vs. IA *
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black ${aiTimeAudit.status === 'inflated'
                          ? 'bg-rose-100 text-rose-800'
                          : aiTimeAudit.status === 'missing_time'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                    >
                      {aiTimeAudit.verdictLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[9px] font-bold text-slate-500 uppercase">
                        Horas Trabajadas *
                      </p>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        placeholder="Ej: 0.5"
                        value={resForm.actual_hours}
                        onChange={(e) =>
                          setResForm((p) => ({ ...p, actual_hours: e.target.value }))
                        }
                        className="mt-0.5 w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900"
                      />
                    </div>
                    <div className="bg-white/90 rounded-xl p-2 border border-slate-200/70">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">
                        🤖 Esperado IA
                      </p>
                      <p className="text-xs font-black text-indigo-700">
                        {aiTimeAudit.expectedHours}h{' '}
                        <span className="text-[10px] text-slate-400">
                          (máx {aiTimeAudit.maxReasonableHours}h)
                        </span>
                      </p>
                      <p className="text-[9px] font-bold text-slate-500">
                        Dif:{' '}
                        {aiTimeAudit.reportedHours > 0
                          ? `${aiTimeAudit.differenceHours > 0 ? '+' : ''}${aiTimeAudit.differenceHours}h`
                          : 'Sin tiempo'}
                      </p>
                    </div>
                  </div>

                  {/* Quick Time Pills */}
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
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition ${resForm.actual_hours === b.val
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-600 border-slate-200'
                          }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>

                  {aiTimeAudit.status === 'inflated' && (
                    <div>
                      <label className="text-[9px] font-black text-rose-700 uppercase">
                        ⚠️ Justificación por diferencia (+{aiTimeAudit.differenceHours}h) *
                      </label>
                      <textarea
                        rows={2}
                        value={resForm.time_justification}
                        onChange={(e) =>
                          setResForm((p) => ({ ...p, time_justification: e.target.value }))
                        }
                        placeholder="Explica por qué tomó más tiempo que el estimado IA..."
                        className="mt-1 w-full px-2.5 py-1.5 bg-white border border-rose-300 rounded-xl text-[11px] font-medium"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* 3. Reporte de Resolución Obligatorio (Hallazgos, Causa Raíz, Solución) */}
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 space-y-2.5">
                <p className="text-[10px] font-black uppercase text-slate-700 flex items-center gap-1.5">
                  <FileBadge2 className="w-3.5 h-3.5 text-violet-600" />
                  3. Resolución Obligatoria (A la 1ª vez)
                </p>

                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase">
                    Hallazgos (¿Qué encontraste?) *
                  </label>
                  <textarea
                    rows={2}
                    value={resForm.findings}
                    onChange={(e) => setResForm((p) => ({ ...p, findings: e.target.value }))}
                    placeholder="Síntoma o error verificado..."
                    className="mt-0.5 w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-[11px]"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase">
                    Causa Raíz (¿Por qué ocurrió?) *
                  </label>
                  <textarea
                    rows={2}
                    value={resForm.root_cause}
                    onChange={(e) => setResForm((p) => ({ ...p, root_cause: e.target.value }))}
                    placeholder="Causa técnica raíz..."
                    className="mt-0.5 w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-[11px]"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase">
                    Solución Definitiva (Para que no regrese) *
                  </label>
                  <textarea
                    rows={2}
                    value={resForm.solution}
                    onChange={(e) => setResForm((p) => ({ ...p, solution: e.target.value }))}
                    placeholder="Qué se corrigió exactamente..."
                    className="mt-0.5 w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-[11px]"
                  />
                </div>

                <div className="pt-1 space-y-1.5">
                  <button
                    type="button"
                    disabled={savingResolution}
                    onClick={() => handleCompleteAndCloseTicket(true)}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-black shadow-sm transition"
                  >
                    {savingResolution
                      ? 'Guardando...'
                      : '✅ Cerrar Ticket y Avisar por WhatsApp'}
                  </button>
                  <button
                    type="button"
                    disabled={savingResolution}
                    onClick={() => handleCompleteAndCloseTicket(false)}
                    className="w-full py-2 px-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-bold transition"
                  >
                    Guardar y Cerrar (Sin enviar mensaje)
                  </button>
                </div>
              </div>

              {/* 4. Acordeón de Historial de este Cliente */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowHistoryAccordion(!showHistoryAccordion)}
                  className="w-full px-3.5 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-black text-slate-800 transition"
                >
                  <span>
                    📂 Historial de {activeCircle.clientName} (
                    {activeCircle.allClientTickets.length})
                  </span>
                  {showHistoryAccordion ? (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  )}
                </button>
                {showHistoryAccordion && (
                  <div className="divide-y divide-slate-100 bg-white max-h-60 overflow-y-auto">
                    {activeCircle.allClientTickets.map((ht) => (
                      <div key={ht.id} className="p-3 text-[11px] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-slate-800">
                            #{ht.id.slice(0, 6).toUpperCase()}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(ht.created_at).toLocaleDateString('es-SV')} ·{' '}
                            {Number(ht.actual_hours || 0)}h
                          </span>
                        </div>
                        <p className="text-slate-700 font-semibold line-clamp-2">{ht.title}</p>
                        {ht.solution && (
                          <p className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            ✓ Solución: {ht.solution}
                          </p>
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

      {/* Modal opcional para configurar URL y API Key de Evolution API si desean envío directo */}
      {showEvoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">
                Conexión de Envío Evolution API
              </h3>
              <button
                onClick={() => setShowEvoModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              El webhook detecta automáticamente el servidor Evolution cuando entra un mensaje. Si
              quieres fijar manualmente la URL y API Key de Gerson para respuestas salientes,
              puedes guardarlas aquí:
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500">
                  URL del Servidor Evolution API
                </label>
                <input
                  type="text"
                  placeholder="https://evolution.tudominio.com"
                  value={evoConfig.url}
                  onChange={(e) => setEvoConfig((p) => ({ ...p, url: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500">
                  Instance Name
                </label>
                <input
                  type="text"
                  placeholder="arias"
                  value={evoConfig.instance}
                  onChange={(e) => setEvoConfig((p) => ({ ...p, instance: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500">
                  Global / Instance API Key
                </label>
                <input
                  type="password"
                  placeholder="API Key de Evolution..."
                  value={evoConfig.key}
                  onChange={(e) => setEvoConfig((p) => ({ ...p, key: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowEvoModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  localStorage.setItem('crm_evo_url', evoConfig.url.trim());
                  localStorage.setItem('crm_evo_key', evoConfig.key.trim());
                  localStorage.setItem('crm_evo_instance', evoConfig.instance.trim() || 'soporte');
                  toast.success('Configuración de Evolution API guardada');
                  setShowEvoModal(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Guardar Conexión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para configurar Prompts de Instrucciones IA por Categoría (Texto + Notas de Voz) */}
      {showAiPromptModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h3 className="text-base font-black text-slate-900">
                  IA Automática por Categoría (Texto y Notas de Voz)
                </h3>
              </div>
              <button
                onClick={() => setShowAiPromptModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live OpenAI Status Verification Banner */}
            <div
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl border ${openAiStatus.checking
                  ? 'bg-slate-50 border-slate-200 text-slate-700'
                  : openAiStatus.verified
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
            >
              <div className="flex items-center gap-2 text-xs font-bold">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${openAiStatus.checking
                      ? 'bg-amber-400 animate-pulse'
                      : openAiStatus.verified
                        ? 'bg-emerald-500'
                        : 'bg-rose-500'
                    }`}
                />
                <span>
                  {openAiStatus.checking
                    ? 'Verificando conexión en vivo con OpenAI...'
                    : openAiStatus.verified
                      ? `🟢 OpenAI Conectado (${openAiStatus.model} + Whisper-1 Audio)`
                      : `🔴 OpenAI Error: ${openAiStatus.error || 'Sin conexión'}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => verifyAndLoadAiConfig(true)}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-black text-slate-700 transition"
              >
                🔄 Probar Conexión
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Cuando un cliente o prospecto escribe en <strong>Texto</strong> o envía una{' '}
              <strong>Nota de Voz</strong> por WhatsApp, la IA detecta automáticamente si es{' '}
              <strong>🛠️ Soporte</strong>, <strong>📊 Contabilidad</strong> o{' '}
              <strong>💰 Ventas / Precios</strong> y le responde siguiendo el prompt de esa área:
            </p>

            {/* Switches for BOTH Text and Voice Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiAutoReplyText}
                  onChange={(e) => setAiAutoReplyText(e.target.checked)}
                  className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-xs font-black text-slate-800">
                  💬 Responder a Mensajes de TEXTO
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiAutoReplyAudio}
                  onChange={(e) => setAiAutoReplyAudio(e.target.checked)}
                  className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-xs font-black text-slate-800">
                  🎤 Responder a Notas de VOZ (Audio)
                </span>
              </label>
            </div>

            {/* 4 Category Prompt Tabs */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                {(
                  [
                    { id: 'soporte', label: '🛠️ Soporte Técnico' },
                    { id: 'contabilidad', label: '📊 Contabilidad / IVA' },
                    { id: 'ventas', label: '💰 Ventas / Precios' },
                    { id: 'otros', label: '📦 Otros / General' },
                  ] as { id: SupportChannelType; label: string }[]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActivePromptTab(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${activePromptTab === tab.id
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-500">
                  Instrucciones IA para: {SUPPORT_CHANNELS[activePromptTab].label}
                </label>
                <textarea
                  rows={5}
                  value={aiPrompts[activePromptTab]}
                  onChange={(e) =>
                    setAiPrompts((prev) => ({
                      ...prev,
                      [activePromptTab]: e.target.value,
                    }))
                  }
                  className="mt-1 w-full px-3.5 py-2.5 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAiPromptModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                disabled={savingAiConfig}
                onClick={async () => {
                  setSavingAiConfig(true);
                  try {
                    localStorage.setItem('crm_support_ai_prompt_soporte', aiPrompts.soporte.trim());
                    localStorage.setItem(
                      'crm_support_ai_prompt_contabilidad',
                      aiPrompts.contabilidad.trim()
                    );
                    localStorage.setItem('crm_support_ai_prompt_ventas', aiPrompts.ventas.trim());
                    localStorage.setItem('crm_support_ai_prompt_otros', aiPrompts.otros.trim());

                    const { error } = await supabase.functions.invoke(
                      'evolution-whatsapp-webhook',
                      {
                        body: {
                          action: 'save_ai_config',
                          ticket_id: activeCircle?.activeTicket?.id || undefined,
                          auto_reply_text: aiAutoReplyText,
                          auto_reply_audio: aiAutoReplyAudio,
                          prompts: {
                            soporte: aiPrompts.soporte.trim(),
                            contabilidad: aiPrompts.contabilidad.trim(),
                            ventas: aiPrompts.ventas.trim(),
                            otros: aiPrompts.otros.trim(),
                          },
                        },
                      }
                    );
                    if (error) throw error;
                    toast.success(
                      'Configuración IA guardada (Texto + Voz para Soporte, Contabilidad y Ventas)'
                    );
                    setShowAiPromptModal(false);
                  } catch (e: any) {
                    toast.error(e?.message || 'Error al guardar configuración IA');
                  } finally {
                    setSavingAiConfig(false);
                  }
                }}
                className="px-4 py-2 rounded-xl text-xs font-black bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {savingAiConfig ? 'Guardando...' : 'Guardar Instrucciones IA'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportChatCircles;

