import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Plus,
  Send,
  Mic,
  CheckCheck,
  Check,
  Bell,
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
  type TicketLead,
} from '../../services/tickets';
import { clientsService } from '../../services/clients';
import type { Client } from '../../types/clients';
import {
  getWaViewerScopes,
  getWaScope,
  isWhatsappTicket,
  WA_SCOPE_LABELS,
  type WaScope,
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
  soporte: 'Soporte Técnico',
  contabilidad: 'Contabilidad / IVA',
  ventas: 'Ventas / Precios',
  otros: 'Otros / General',
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

const SUPPORT_QUICK_REPLIES = [
  {
    label: 'En revisión',
    text: 'Hola, hemos recibido su reporte en Soporte Técnico. Nuestro ingeniero ya está revisando su caso y le daremos respuesta en breve.',
  },
  {
    label: 'Pedir Texto + Captura',
    text: 'Estimado cliente, para resolver su inconveniente lo más rápido posible, ¿nos podría enviar por favor el detalle en TEXTO ESCRITO acompañado de una CAPTURA DE PANTALLA del error?',
  },
  {
    label: 'Validar Solución DTE',
    text: '¡Listo! Ya aplicamos la corrección correspondiente en el sistema. ¿Nos confirma por favor si ya le permite emitir y transmitir su DTE sin inconvenientes?',
  },
  {
    label: 'Solicitar AnyDesk',
    text: 'Para revisar directamente en su equipo, ¿nos podría compartir por favor su código de conexión remota (AnyDesk) y confirmar cuando esté disponible?',
  },
];

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
  if (text.startsWith('p1') || /hacienda|dte|factura\s+electr/i.test(text)) {
    return { code: 'P1', name: catName || 'P1 - Hacienda / DTE', color: '#EF4444' };
  }
  if (text.startsWith('p2') || /error\s+reportado/i.test(text)) {
    return { code: 'P2', name: catName || 'P2 - Errores Sistema', color: '#F97316' };
  }
  if (text.startsWith('p4')) return { code: 'P4', name: catName || 'P4 - Mejoras', color: '#3B82F6' };
  if (/pegunta|pregunta\s+frecuente/i.test(text)) return { code: 'FAQ', name: 'Preguntas Frecuentes', color: '#10B981' };
  return { code: 'P3', name: catName || 'P3 - Soporte Técnico', color: '#F59E0B' };
}

const SCOPE_STYLE: Record<WaScope, { avatar: string; chip: string; icon: React.ElementType }> = {
  soporte: { avatar: 'bg-indigo-600', chip: 'bg-indigo-50 text-indigo-700 border-indigo-200/60', icon: Building2 },
  por_clasificar: { avatar: 'bg-amber-500', chip: 'bg-amber-50 text-amber-800 border-amber-200', icon: HelpCircle },
  lead: { avatar: 'bg-emerald-600', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200/70', icon: UserPlus },
  interno: { avatar: 'bg-slate-500', chip: 'bg-slate-100 text-slate-700 border-slate-200', icon: ShieldCheck },
  spam: { avatar: 'bg-rose-400', chip: 'bg-rose-50 text-rose-700 border-rose-200', icon: Ban },
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
  leadOwnerName: string | null;
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
  supportChannel: SupportChannelType;
}

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

type CircleFilter = 'all' | 'waiting' | 'soporte' | 'por_clasificar' | 'lead' | 'interno' | 'spam';

// Parse "[10:42 a. m.] 👤 Nombre: texto" chat lines written by the webhook.
function parseChatLine(raw: string): { icon: string; sender: string; text: string } | null {
  const m = raw.match(/^\[([^\]]+)\]\s*(👤|👨‍💻)?\s*([^:\n]+):\s*([\s\S]*)$/);
  if (!m) return null;
  return { icon: m[2] || '', sender: m[3].trim(), text: m[4] };
}

// =============================================================================

export const SupportChatCircles: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, simulatedCompanyId } = useAuth();
  const activeCompanyId = simulatedCompanyId || profile?.company_id;
  const scopes = useMemo(() => getWaViewerScopes(profile as any), [profile]);

  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [agents, setAgents] = useState<CompanyAgent[]>([]);
  const [realClients, setRealClients] = useState<Client[]>([]);
  const [companyLeads, setCompanyLeads] = useState<TicketLead[]>([]);
  const [waGroups, setWaGroups] = useState<WaGroupRow[]>([]);
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(() => {
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
  };

  const [searchQuery, setSearchQuery] = useState('');
  const defaultFilter: CircleFilter = scopes.all ? 'all' : scopes.soporte && !scopes.leads ? 'soporte' : scopes.leads && !scopes.soporte ? 'por_clasificar' : 'all';
  const [circleFilter, setCircleFilter] = useState<CircleFilter>(defaultFilter);

  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientPickerQuery, setClientPickerQuery] = useState('');
  const [showReclassifyMenu, setShowReclassifyMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [activeChatSeconds, setActiveChatSeconds] = useState(0);
  const [showRightPanel, setShowRightPanel] = useState(false);

  // Resizable left column
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem('crm_circles_left_width'));
    return saved >= 260 && saved <= 750 ? saved : 380;
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

      const clientName = isWa
        ? stripEmojis(
            String(
              (isGroup ? meta.whatsapp_group_subject : '') ||
                latest.lead_name ||
                meta.whatsapp_push_name ||
                (phone ? `+${phone}` : 'WhatsApp')
            )
          )
        : extractLegacyClientName(activeTicket);

      // Last message preview & unread state
      const descLines = String(latest.description || '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const lastChatLine = [...descLines].reverse().find((l) => l.startsWith('[') && (l.includes('👤') || l.includes('👨‍💻')));
      let lastMessageSender = stripEmojis(String(meta.whatsapp_push_name || clientName));
      let lastMessageText = stripEmojis(String(meta.last_whatsapp_message || latest.title || ''));
      const parsed = lastChatLine ? parseChatLine(lastChatLine) : null;
      if (parsed) {
        lastMessageSender = stripEmojis(parsed.sender);
        lastMessageText = stripEmojis(parsed.text);
      }
      const lastFrom: string = meta.last_message_from || (parsed ? (parsed.icon === '👨‍💻' ? 'staff' : 'client') : 'client');
      const isOpen = ['new', 'open', 'pending'].includes(activeTicket.status);
      const unreadOrWaitingReply = lastFrom === 'client' && (scope !== 'soporte' || isOpen);

      const catObj = activeTicket.category_id ? catMap.get(activeTicket.category_id) : undefined;
      const catInfo = detectShortCategory(catObj?.name || '', activeTicket.title || '');
      const assignedTechId = activeTicket.assigned_to || null;
      const ch = String(activeMeta.support_channel || 'soporte') as SupportChannelType;

      list.push({
        circleId: key,
        clientName,
        pushName: stripEmojis(String(meta.whatsapp_push_name || '')),
        phone,
        whatsappJid: String(meta.whatsapp_jid || ''),
        isWhatsApp: isWa,
        isGroup,
        scope,
        scopeReason: String(meta.wa_scope_reason || ''),
        memberOfGroups: Array.isArray(meta.member_of_groups) ? meta.member_of_groups : [],
        leadId,
        leadStatus: lead?.status || null,
        leadOwnerName: lead && (lead as any).assigned_to ? agentMap.get((lead as any).assigned_to) || null : null,
        activeTicket,
        allClientTickets: sorted,
        unreadOrWaitingReply,
        lastMessageText,
        lastMessageSender,
        lastMessageAt: String(meta.last_whatsapp_at || latest.updated_at || latest.created_at),
        assignedTechId,
        assignedTechName: (assignedTechId && agentMap.get(assignedTechId)) || 'Sin asignar',
        categoryCode: catInfo.code,
        categoryName: catInfo.name,
        supportChannel: ['soporte', 'contabilidad', 'otros'].includes(ch) ? ch : 'soporte',
      });
    });

    return list.sort((a, b) => {
      if (a.isWhatsApp !== b.isWhatsApp) return a.isWhatsApp ? -1 : 1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });
  }, [tickets, categories, agents, realClients, companyLeads, scopes.soporte]);

  const isUnread = (c: SupportCircle) => c.unreadOrWaitingReply && readCirclesMap[c.circleId] !== c.lastMessageAt;

  const counts = useMemo(() => {
    const by = (s: WaScope) => circles.filter((c) => c.scope === s).length;
    return {
      all: circles.filter((c) => c.scope !== 'spam').length,
      waiting: circles.filter((c) => c.scope !== 'spam' && isUnread(c)).length,
      soporte: by('soporte'),
      por_clasificar: by('por_clasificar'),
      lead: by('lead'),
      interno: by('interno'),
      spam: by('spam'),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circles, readCirclesMap]);

  const filterTabs = useMemo(() => {
    const tabs: { id: CircleFilter; label: string; icon: React.ElementType; alert?: boolean }[] = [
      { id: 'all', label: `Todos (${counts.all})`, icon: MessageSquare },
      { id: 'waiting', label: `Sin contestar (${counts.waiting})`, icon: Clock, alert: counts.waiting > 0 },
    ];
    if (scopes.soporte) tabs.push({ id: 'soporte', label: `Soporte (${counts.soporte})`, icon: Building2 });
    if (scopes.leads) {
      tabs.push({ id: 'por_clasificar', label: `Por clasificar (${counts.por_clasificar})`, icon: HelpCircle, alert: counts.por_clasificar > 0 });
      tabs.push({ id: 'lead', label: `${scopes.all ? 'Leads' : 'Mis leads'} (${counts.lead})`, icon: UserPlus });
    }
    if (scopes.all) {
      tabs.push({ id: 'interno', label: `Equipo (${counts.interno})`, icon: ShieldCheck });
      tabs.push({ id: 'spam', label: `Spam (${counts.spam})`, icon: Ban });
    }
    return tabs;
  }, [counts, scopes]);

  const filteredCircles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return circles.filter((c) => {
      if (circleFilter === 'all' && c.scope === 'spam') return false;
      if (circleFilter === 'waiting' && (c.scope === 'spam' || !isUnread(c))) return false;
      if (!['all', 'waiting'].includes(circleFilter) && c.scope !== circleFilter) return false;
      if (q) {
        return (
          c.clientName.toLowerCase().includes(q) ||
          c.pushName.toLowerCase().includes(q) ||
          c.phone.includes(q.replace(/\D/g, '') || '§') ||
          c.lastMessageText.toLowerCase().includes(q) ||
          c.assignedTechName.toLowerCase().includes(q)
        );
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circles, circleFilter, searchQuery, readCirclesMap]);

  useEffect(() => {
    if (!selectedCircleId && filteredCircles.length > 0) setSelectedCircleId(filteredCircles[0].circleId);
  }, [filteredCircles, selectedCircleId]);

  const activeCircle = useMemo(
    () => circles.find((c) => c.circleId === selectedCircleId) || null,
    [circles, selectedCircleId]
  );

  useEffect(() => {
    if (activeCircle) markCircleAsRead(activeCircle.circleId, activeCircle.lastMessageAt);
  }, [activeCircle?.circleId, activeCircle?.lastMessageAt]);

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
      if (media && /^\[(Imagen|Video|Sticker|Nota de voz)[^\]]*\]$/i.test(body)) body = '';
      if (media && media.message_type === 'document' && /^\[Documento: [^\]]*\]$/i.test(body)) body = '';

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
        por_clasificar: 'Por clasificar',
      };
      toast.success(
        type === 'lead' && data?.lead?.name ? `Lead creado y asignado: ${data.lead.name}` : `Clasificado como ${labels[type]}`
      );
      setShowClientPicker(false);
      setShowReclassifyMenu(false);
      await loadSupportData(true);
      loadThread(false);
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo clasificar');
      loadSupportData(true);
    } finally {
      setClassifying(false);
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
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-bold shrink-0 ${st.chip}`}>
        <Icon className="w-2.5 h-2.5" />
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
      {/* ── TOP HEADER ── */}
      <header className="h-14 bg-white border-b border-slate-200/80 px-5 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full bg-indigo-600" />
            <span className="text-sm font-black text-slate-900 tracking-tight">Chat WhatsApp</span>
          </div>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <span className="text-xs font-medium text-slate-600 hidden sm:inline truncate">
            {greetingTime()}, <strong className="font-black text-slate-900">{profile?.full_name?.split(' ')[0] || ''}</strong>
          </span>
          <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#EEF0FF] text-indigo-700">
            <Phone className="w-3 h-3 text-indigo-600" />
            +503 7971-8911
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="hidden md:inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#EEF0FF] text-indigo-700">
            {roleChip}
          </span>
          {scopes.all && (
            <>
              <button
                onClick={() => setShowAiPromptModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#EEF0FF] text-indigo-700 hover:bg-indigo-100 transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>IA</span>
              </button>
              <button
                onClick={openBridgeStatus}
                title="Estado de la conexión WhatsApp"
                className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <Settings className="w-4 h-4" />
              </button>
            </>
          )}
          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-sm">
            {initials(profile?.full_name || 'AD')}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* ── LEFT: chat list ── */}
        <aside style={{ width: `${leftPanelWidth}px` }} className="bg-white flex flex-col shrink-0 relative">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Chats</h2>
              <p className="text-[11px] font-medium text-slate-400">{filteredCircles.length} conversaciones</p>
            </div>
            <button
              onClick={() => loadSupportData()}
              title="Actualizar chats"
              className="w-9 h-9 rounded-xl bg-[#EEF0FF] hover:bg-indigo-100 text-indigo-600 flex items-center justify-center transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar grupo, cliente, teléfono o mensaje..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200/70 rounded-full text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              {filterTabs.map((tab) => {
                const active = circleFilter === tab.id;
                const IconComp = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setCircleFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition inline-flex items-center gap-1.5 ${
                      active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                    }`}
                  >
                    {tab.alert && !active ? <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> : <IconComp className="w-3 h-3 shrink-0" />}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loading && circles.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 font-medium">Cargando chats…</div>
            ) : filteredCircles.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 font-medium">No hay conversaciones en esta vista.</div>
            ) : (
              filteredCircles.map((circle) => {
                const isSelected = activeCircle?.circleId === circle.circleId;
                const unread = isUnread(circle);
                return (
                  <button
                    key={circle.circleId}
                    type="button"
                    onClick={() => {
                      markCircleAsRead(circle.circleId, circle.lastMessageAt);
                      setSelectedCircleId(circle.circleId);
                    }}
                    className={`w-full text-left px-4 py-3.5 flex items-center gap-3.5 transition relative ${
                      isSelected ? 'bg-[#EEF0FF]/90' : unread ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/30 hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div
                        className={`w-11 h-11 rounded-full flex items-center justify-center text-xs text-white ${
                          unread ? 'font-black' : 'font-normal opacity-80'
                        } ${SCOPE_STYLE[circle.scope].avatar}`}
                      >
                        {circle.isGroup ? <Users className="w-5 h-5 text-white" /> : initials(circle.clientName)}
                      </div>
                      {unread && <span className="w-3 h-3 rounded-full bg-rose-500 border-2 border-white absolute -top-0.5 -right-0.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`text-xs uppercase tracking-tight truncate ${unread ? 'font-black text-slate-950' : 'font-normal text-slate-500'}`}>
                            {circle.clientName}
                          </span>
                          <ScopeChip circle={circle} compact />
                          {circle.memberOfGroups.length > 0 && !circle.isGroup && (
                            <span title={`Miembro de: ${circle.memberOfGroups.map((g) => g.subject).join(', ')}`} className="shrink-0">
                              <Users className="w-3 h-3 text-indigo-500" />
                            </span>
                          )}
                        </div>
                        <span className={`text-[10px] shrink-0 ${unread ? 'font-extrabold text-indigo-600' : 'font-normal text-slate-400'}`}>
                          {listTimeLabel(circle.lastMessageAt)}
                        </span>
                      </div>
                      <p className={`text-xs truncate mt-0.5 ${unread ? 'text-slate-900 font-bold' : 'text-slate-400 font-normal'}`}>
                        {circle.lastMessageSender}: {circle.lastMessageText}
                      </p>
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
            {/* Chat header */}
            <div className="bg-white border-b border-slate-200/70 px-6 py-2.5 flex items-center justify-between gap-3 shrink-0 min-h-16">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-full text-white font-black text-xs flex items-center justify-center shrink-0 ${SCOPE_STYLE[activeCircle.scope].avatar}`}>
                  {activeCircle.isGroup ? <Users className="w-5 h-5 text-white" /> : initials(activeCircle.clientName)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight truncate max-w-[280px]">{activeCircle.clientName}</h3>
                    <ScopeChip circle={activeCircle} />
                    {activeCircle.scope === 'lead' && activeCircle.leadOwnerName && (
                      <span className="text-[10px] font-semibold text-slate-500">Vendedor: {activeCircle.leadOwnerName}</span>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-slate-400 truncate">
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
                  </p>
                  {!activeCircle.isGroup && activeCircle.memberOfGroups.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <Users className="w-3 h-3 text-indigo-500" />
                      <span className="text-[10px] font-bold text-indigo-700">Este número es del grupo:</span>
                      {activeCircle.memberOfGroups.slice(0, 3).map((g) => {
                        const groupCircleId = `wa:${g.jid}`;
                        const exists = circles.some((c) => c.circleId === groupCircleId);
                        return (
                          <button
                            key={g.jid}
                            type="button"
                            disabled={!exists}
                            onClick={() => exists && setSelectedCircleId(groupCircleId)}
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60 hover:bg-indigo-100 disabled:opacity-70 disabled:cursor-default"
                          >
                            {g.subject || 'Grupo'}
                            {exists && <ExternalLink className="w-2.5 h-2.5 inline ml-1" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {activeCircle.scope === 'soporte' && activeCircle.isWhatsApp && (
                  <div className="relative flex items-center">
                    <Wrench className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
                    <select
                      value={activeCircle.supportChannel}
                      onChange={(e) => handleSwitchChannel(e.target.value as SupportChannelType)}
                      className="pl-8 pr-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200/70 text-slate-700 cursor-pointer focus:outline-none transition"
                    >
                      <option value="soporte">Soporte técnico</option>
                      <option value="contabilidad">Contabilidad</option>
                      <option value="otros">Otros</option>
                    </select>
                  </div>
                )}

                {activeCircle.leadId && (activeCircle.scope === 'lead' || activeCircle.scope === 'spam') && (
                  <button
                    type="button"
                    onClick={() => navigate('/leads', { state: { leadId: activeCircle.leadId, _t: Date.now() } })}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Abrir ficha del lead
                  </button>
                )}

                {canClassify && activeCircle.scope !== 'por_clasificar' && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowReclassifyMenu((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200/70 text-slate-700 transition"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      Clasificación
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    {showReclassifyMenu && (
                      <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 p-1.5">
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
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 text-left"
                              >
                                <I className="w-3.5 h-3.5 text-slate-500" />
                                {o.label}
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}

                {activeCircle.scope === 'soporte' && (
                  <button
                    type="button"
                    onClick={() => setShowRightPanel(!showRightPanel)}
                    title="Panel del ticket: asignar técnico, tiempo y cierre"
                    className={`w-10 h-9 rounded-xl flex items-center justify-center transition ${
                      showRightPanel ? 'bg-indigo-600 text-white' : 'bg-[#EEF0FF] text-indigo-600 hover:bg-indigo-100'
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {classifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                      Crear lead (asignado a mí)
                    </button>
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
                <div className="text-center py-12 text-xs font-medium text-slate-400">Cargando mensajes…</div>
              ) : chatItems.length === 0 ? (
                <div className="text-center py-12 text-xs font-medium text-slate-400">Sin mensajes todavía.</div>
              ) : (
                chatItems.map((b, idx) => {
                  const prev = chatItems[idx - 1];
                  const showDay = !prev || dayKey(prev.createdAt) !== dayKey(b.createdAt);
                  const daySep = showDay ? (
                    <div key={`day-${b.id}`} className="flex justify-center my-3">
                      <span className="px-3.5 py-1 rounded-full bg-white text-[11px] font-bold text-slate-600 shadow-2xs capitalize">{dayLabel(b.createdAt)}</span>
                    </div>
                  ) : null;

                  if (b.kind === 'ticket') {
                    return (
                      <React.Fragment key={b.id}>
                        {daySep}
                        <div className="flex justify-center my-2">
                          <div className="max-w-md w-full bg-[#E6E9FF] rounded-2xl px-4 py-2.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600">
                              <Bell className="w-3.5 h-3.5" />
                              <span>{b.senderName}</span>
                            </div>
                            <p className="text-xs font-medium text-slate-800 mt-0.5 leading-snug line-clamp-2">{b.text}</p>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  }
                  if (b.kind === 'system') {
                    return (
                      <React.Fragment key={b.id}>
                        {daySep}
                        <div className="flex justify-center">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-900">
                            <Tag className="w-3 h-3" />
                            {b.text}
                            <span className="text-amber-600 font-normal">· {fmtTime(b.createdAt)}</span>
                          </span>
                        </div>
                      </React.Fragment>
                    );
                  }
                  if (b.kind === 'staff') {
                    return (
                      <React.Fragment key={b.id}>
                        {daySep}
                        <div className="flex justify-end">
                          <div className="max-w-md bg-[#DFE3FF] text-slate-900 rounded-2xl rounded-br-xs px-4 py-2.5 shadow-2xs">
                            <p className="text-[10px] font-bold text-indigo-700/80 mb-0.5">{b.senderName}</p>
                            {renderMedia(b)}
                            {b.text && <p className="text-xs font-medium text-slate-900 whitespace-pre-wrap leading-relaxed break-words">{b.text}</p>}
                            <div className="flex items-center justify-end gap-1 mt-1">
                              <span className="text-[10px] font-medium text-slate-500">{b.id.startsWith('temp-') ? 'enviando…' : fmtTime(b.createdAt)}</span>
                              {b.delivery === 'sent' ? (
                                <CheckCheck className="w-3.5 h-3.5 text-emerald-500" aria-label="Entregado a WhatsApp" />
                              ) : b.delivery === 'error' ? (
                                <span title={b.deliveryError || 'No se pudo enviar'} className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-600">
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
                        <div className="max-w-md bg-white text-slate-900 rounded-2xl rounded-bl-xs px-4 py-2.5 shadow-2xs">
                          <p className="text-[11px] font-bold text-indigo-600 mb-0.5">{b.senderName}</p>
                          {renderMedia(b)}
                          {b.text && <p className="text-xs font-medium text-slate-800 whitespace-pre-wrap leading-relaxed break-words">{b.text}</p>}
                          {b.transcript && (
                            <p className="mt-1.5 text-[11px] text-slate-600 bg-slate-50 rounded-lg px-2 py-1 italic">
                              <Mic className="w-3 h-3 inline mr-1 text-indigo-500" />
                              {b.transcript}
                            </p>
                          )}
                          <div className="flex items-center justify-end mt-1">
                            <span className="text-[10px] font-medium text-slate-400">{fmtTime(b.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick replies (support) */}
            {activeCircle.scope === 'soporte' && canSend && (
              <div className="bg-white/70 px-5 pt-2 flex items-center gap-1.5 overflow-x-auto">
                {SUPPORT_QUICK_REPLIES.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => setMessageInput(q.text)}
                    className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 whitespace-nowrap"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            )}

            {/* Composer */}
            {canSend ? (
              <div className="bg-white px-5 py-3 border-t border-slate-200/70 flex items-end gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
                  onChange={handleUploadAttachment}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                  title="Enviar imagen, documento o archivo"
                  className="w-9 h-9 rounded-full text-slate-500 hover:bg-slate-100 flex items-center justify-center transition shrink-0 disabled:opacity-50"
                >
                  {uploadingFile ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                </button>
                <textarea
                  rows={1}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                  placeholder="Escribe un mensaje… (Shift+Enter = nueva línea)"
                  className="flex-1 resize-none max-h-32 px-4 py-2.5 bg-[#F3F4F8] border border-slate-200/80 rounded-2xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  type="button"
                  disabled={!messageInput.trim() || sendingMessage}
                  onClick={() => handleSendReply()}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold transition"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="bg-white px-5 py-3 border-t border-slate-200/70 text-center text-[11px] font-semibold text-slate-400">
                {activeCircle.scope === 'spam' ? 'Este número está marcado como spam.' : 'Este ticket no es de WhatsApp; respóndelo desde Tickets.'}
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
    </div>
  );
};

export default SupportChatCircles;
