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
  ChevronLeft,
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
  MoreHorizontal,
  Calendar,
  Pencil,
  Trash2,
  Target,
  Video,
  RotateCcw,
  Activity,
  Bug,
  Pause,
  Play,
  Ticket as TicketIcon,
  CornerUpLeft,
  MoreVertical,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  SUPPORT_ROOT_CAUSE_META,
  appendRootCauseMetadataPatch,
  extractRootCauseEntries,
  countChatMessagesLast24h,
  type SupportRootCauseType,
} from './supportPulse';
import { LiveDemoHUDModal, parseAriasAnswersFromNotes } from '../../components/leads/LiveDemoHUDModal';
import { WhatsAppReactivationModal, type ReactivationTouchInfo } from '../../components/leads/WhatsAppReactivationModal';
import type { Lead } from '../../types';
import NewFollowUpModal from '../../components/NewFollowUpModal';
import GoogleMeetScheduler from '../../components/GoogleMeetScheduler';
import { CreateTicketFromChatModal } from './components/CreateTicketFromChatModal';
import { resolveCircleLeadStatus, shouldPauseAiOnLeadStatus } from '../../lib/leadStatusSync';
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
import {
  getWaViewerScopes,
  getWaScope,
  isWhatsappTicket,
  isSupportTicket,
  WA_SCOPE_LABELS,
  WA_ACCESS_MODE_OPTIONS,
  type WaScope,
  type WaAccessMode,
} from '../../lib/whatsappScopes';
import {
  readLocalQuickReplies,
  loadCompanyQuickReplies,
  saveCompanyQuickReplies,
  syncTicketReadState,
  computeEffectiveCircleUnread,
  buildReadStateMetadataPatch,
  maxIsoTimestamp,
  type TicketReadSyncMode,
} from '../../services/whatsappSync';
import type {
  LightClientRow,
  SupportChannelType,
  LeadStageSubFilter,
  QuickReplyTemplate,
  SupportCircle,
  LeadQuoteSummary,
  TeamWaAccessMember,
  OwnerSubFilter,
  WaMessageRow,
  OutboxRow,
  ChatItem,
  WaGroupRow,
  CircleBucket,
  SpecialTray,
  CircleStateFilter,
} from './whatsapp/types';
import {
  TZ,
  stripEmojis,
  fmtTime,
  dayKey,
  dayLabel,
  listTimeLabel,
  initials,
  formatBytes,
  SUPPORT_CHANNEL_LABELS,
  DEFAULT_PROMPTS,
  DEFAULT_RESOLVED_REPLY_TEMPLATE,
  DEFAULT_RESOLVED_TRIGGER_PHRASES,
  isAlreadyResolvedReply,
  renderResolvedReplyTemplate,
  DEFAULT_SUPPORT_QUICK_REPLIES,
  DEFAULT_SALES_QUICK_REPLIES,
  LEAD_STATUS_OPTIONS,
  getUnlockedAudioCtx,
  playWaAlertSound,
  formatWaitDuration,
  isInternalDevOrSystemTaskTitle,
  extractClientGreetingFirstName,
  extractLegacyClientName,
  detectShortCategory,
  SCOPE_STYLE,
  parseChatLine,
  getCachedTicketDescStats,
  computeCircleTeamActivity,
  toggleBucketSelection,
  toggleStateFilterSelection,
  matchesCircleBucketAndTray,
  matchesCircleStateFilters,
  isCourtesyClosingMessage,
  formatQuotedReplyText,
  parseQuotedReplyPrefix,
  type QuotedReplyRef,
} from './whatsapp/helpers';
import { ActiveSessionTimer, CircleListRow } from './whatsapp/CircleListRow';
import { ChatComposer, type ChatComposerHandle } from './whatsapp/ChatComposer';
import { ClientPickerModal } from './whatsapp/modals/ClientPickerModal';
import { BridgeStatusModal } from './whatsapp/modals/BridgeStatusModal';
import { QuickReplyManagerModal } from './whatsapp/modals/QuickReplyManagerModal';
import { TeamWaAccessModal } from './whatsapp/modals/TeamWaAccessModal';
import { AiPromptConfigModal } from './whatsapp/modals/AiPromptConfigModal';

export type { SupportChannelType, QuickReplyTemplate };
export { playWaAlertSound };

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
  const [realClients, setRealClients] = useState<LightClientRow[]>([]);
  const [companyLeads, setCompanyLeads] = useState<TicketLead[]>([]);
  const [waGroups, setWaGroups] = useState<WaGroupRow[]>([]);
  const [nonWaTicketIds, setNonWaTicketIds] = useState<Set<string>>(() => new Set());
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

  const applyTicketReadPatchToState = useCallback(
    (ticketId: string | undefined, mode: TicketReadSyncMode, lastMessageAt: string) => {
      if (!ticketId || !profile?.id) return;
      setTickets((prev) =>
        prev.map((row) =>
          row.id === ticketId
            ? {
                ...row,
                metadata: buildReadStateMetadataPatch(
                  (row.metadata || {}) as Record<string, any>,
                  profile.id,
                  mode,
                  lastMessageAt,
                ),
              }
            : row,
        ),
      );
    },
    [profile?.id],
  );

  const markCircleAsRead = (
    circleId: string,
    lastMessageAt: string,
    ticketId?: string,
    skipRemoteSync = false,
  ) => {
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
    if (ticketId && profile?.id && !skipRemoteSync) {
      applyTicketReadPatchToState(ticketId, 'read', lastMessageAt);
      void syncTicketReadState(ticketId, profile.id, 'read', lastMessageAt);
    }
  };

  const [dismissedWaitingMap, setDismissedWaitingMap] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('crm_wa_dismissed_waiting') || '{}');
    } catch {
      return {};
    }
  });
  const handleMarkCircleAttended = async (circle: SupportCircle) => {
    markCircleAsRead(circle.circleId, circle.lastMessageAt, circle.activeTicket.id, true);
    setDismissedWaitingMap((prev) => {
      const next = { ...prev, [circle.circleId]: circle.lastMessageAt };
      try {
        localStorage.setItem('crm_wa_dismissed_waiting', JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
    applyTicketReadPatchToState(circle.activeTicket.id, 'attended', circle.lastMessageAt);
    try {
      if (profile?.id) {
        await syncTicketReadState(circle.activeTicket.id, profile.id, 'attended', circle.lastMessageAt);
      } else {
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
      }
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
    applyTicketReadPatchToState(circle.activeTicket.id, 'unread', circle.lastMessageAt);
    try {
      if (profile?.id) {
        await syncTicketReadState(circle.activeTicket.id, profile.id, 'unread', circle.lastMessageAt);
      } else {
        const currentMeta = (circle.activeTicket.metadata || {}) as Record<string, any>;
        if (currentMeta.wa_attended_at) {
          const nextMeta = { ...currentMeta };
          delete nextMeta.wa_attended_at;
          await supabase
            .from('tickets')
            .update({ metadata: nextMeta })
            .eq('id', circle.activeTicket.id);
        }
      }
      loadSupportData(true);
    } catch {
      // ignore
    }
    toast.success('Conversación marcada como No leída');
  };

  const [searchQuery, setSearchQuery] = useState('');
  const defaultBuckets: CircleBucket[] =
    searchParams.get('filter') === 'reactivados'
      ? ['reactivados']
      : scopes.all
      ? []
      : scopes.soporte && !scopes.leads
      ? ['soporte']
      : scopes.leads && !scopes.soporte
      ? ['por_clasificar']
      : [];
  const [selectedBuckets, setSelectedBuckets] = useState<CircleBucket[]>(defaultBuckets);
  const [stateFilters, setStateFilters] = useState<CircleStateFilter[]>([]);
  const [specialTray, setSpecialTray] = useState<SpecialTray | null>(null);
  const [ownerFilter, setOwnerFilter] = useState<OwnerSubFilter>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | SupportChannelType>('all');
  const [leadSubFilter, setLeadSubFilter] = useState<LeadStageSubFilter>('activos');

  const [visibleCircleLimit, setVisibleCircleLimit] = useState(80);
  const composerRef = useRef<ChatComposerHandle>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientPickerQuery, setClientPickerQuery] = useState('');
  const [showReclassifyMenu, setShowReclassifyMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
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
  const [showResendReactivationModal, setShowResendReactivationModal] = useState<boolean>(false);
  const [showRootCausePopover, setShowRootCausePopover] = useState<boolean>(false);
  const [rootCauseType, setRootCauseType] = useState<SupportRootCauseType>('system_bug');
  const [rootCauseNote, setRootCauseNote] = useState<string>('');
  const [rootCauseMarkAttended, setRootCauseMarkAttended] = useState<boolean>(true);
  const [savingRootCause, setSavingRootCause] = useState<boolean>(false);
  const [dismissedPingPongCircleMap, setDismissedPingPongCircleMap] = useState<Record<string, boolean>>({});

  // Handle return from CotizadorPro or SupportIntelligence with active chat & newly generated quote
  useEffect(() => {
    const st = (location.state || {}) as { waCircleId?: string; newWaQuoteId?: string };
    if (st.waCircleId) {
      setSpecialTray(null);
      setStateFilters([]);
      setSelectedBuckets([]);
      setOwnerFilter('all');
      setChannelFilter('all');
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
        const ownerFallback =
          profile.email === 'jarias7604@gmail.com' || profile.email === 'jarias@ariasdefense.com'
            ? 'Jimmy Arias'
            : profile.email?.split('@')[0] || 'Asesor Comercial';
        const rawName =
          profile.full_name &&
          !/simulaci[oó]n|platform\s*owner|company_admin|super_admin|collaborator/i.test(profile.full_name.trim())
            ? profile.full_name.trim()
            : ownerFallback;
        const cleanSlug = `${bookingService.slugify(rawName)}-${profile.id.slice(0, 4)}`;
        const existing = await bookingService.getMyBookingLink();
        if (cancelled) return;
        if (
          existing?.slug &&
          !existing.slug.startsWith('platform-owner') &&
          !existing.slug.startsWith('simulacion') &&
          !/simulaci[oó]n|platform\s*owner/i.test(existing.display_name || '')
        ) {
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

  // Customizable SaaS Quick Replies per company (synced to DB with instant local cache)
  const defaultQuickReplies = useMemo(
    () => [...DEFAULT_SALES_QUICK_REPLIES, ...DEFAULT_SUPPORT_QUICK_REPLIES],
    [],
  );
  const [customQuickReplies, setCustomQuickReplies] = useState<QuickReplyTemplate[]>(defaultQuickReplies);
  const [showQuickReplyModal, setShowQuickReplyModal] = useState(false);
  const [quickReplyInitialScope, setQuickReplyInitialScope] = useState<'soporte' | 'ventas'>('ventas');
  const [editingQuickReply, setEditingQuickReply] = useState<QuickReplyTemplate | null>(null);

  useEffect(() => {
    if (!activeCompanyId) return;
    let cancelled = false;
    setCustomQuickReplies(readLocalQuickReplies(activeCompanyId, defaultQuickReplies));
    loadCompanyQuickReplies(activeCompanyId, defaultQuickReplies).then((synced) => {
      if (!cancelled) setCustomQuickReplies(synced);
    });
    return () => {
      cancelled = true;
    };
  }, [activeCompanyId, defaultQuickReplies]);

  const saveCustomQuickReplies = (next: QuickReplyTemplate[]) => {
    setCustomQuickReplies(next);
    if (activeCompanyId) {
      void saveCompanyQuickReplies(activeCompanyId, next);
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

  const [chatSessionStartedAt, setChatSessionStartedAt] = useState<number>(() => Date.now());
  const getActiveChatSeconds = () => Math.max(0, Math.floor((Date.now() - chatSessionStartedAt) / 1000));
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [leftListCollapsed, setLeftListCollapsed] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<QuotedReplyRef | null>(null);
  const [showMobileActionsSheet, setShowMobileActionsSheet] = useState(false);

  useEffect(() => {
    setSelectedMessageId(null);
    setReplyingToMessage(null);
    setShowMobileActionsSheet(false);
  }, [selectedCircleId]);

  useEffect(() => {
    const isOpen = Boolean(mobileChatOpen && selectedCircleId);
    window.dispatchEvent(new CustomEvent('arias:mobile-chat-open', { detail: isOpen }));
    return () => {
      window.dispatchEvent(new CustomEvent('arias:mobile-chat-open', { detail: false }));
    };
  }, [mobileChatOpen, selectedCircleId]);

  useEffect(() => {
    if (!mobileChatOpen || typeof window === 'undefined' || !window.visualViewport) return;
    const handleViewportResize = () => {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      });
    };
    window.visualViewport.addEventListener('resize', handleViewportResize);
    return () => window.visualViewport?.removeEventListener('resize', handleViewportResize);
  }, [mobileChatOpen]);

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
  const [togglingTechTicket, setTogglingTechTicket] = useState(false);
  const [showCreateTicketModal, setShowCreateTicketModal] = useState(false);
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
  const [reconnectingBridge, setReconnectingBridge] = useState(false);
  const [waConnectionState, setWaConnectionState] = useState<'open' | 'close' | 'connecting' | null>(null);

  // AI auto-responder settings (admin)
  const [showAiPromptModal, setShowAiPromptModal] = useState(false);
  const [activePromptTab, setActivePromptTab] = useState<SupportChannelType | 'ya_resolvimos'>('soporte');
  const [aiAutoReplyText, setAiAutoReplyText] = useState(false);
  const [aiAutoReplyAudio, setAiAutoReplyAudio] = useState(false);
  const [autoReplyResolvedEnabled, setAutoReplyResolvedEnabled] = useState(false);
  const [autoResolvedMarkLost, setAutoResolvedMarkLost] = useState(true);
  const [resolvedReplyTemplate, setResolvedReplyTemplate] = useState(DEFAULT_RESOLVED_REPLY_TEMPLATE);
  const [resolvedTriggerPhrasesText, setResolvedTriggerPhrasesText] = useState(DEFAULT_RESOLVED_TRIGGER_PHRASES.join(', '));
  const [showTriggerPhrasesEditor, setShowTriggerPhrasesEditor] = useState(false);
  const [selectedPendingResolvedIds, setSelectedPendingResolvedIds] = useState<string[]>([]);
  const [sendingBatchResolved, setSendingBatchResolved] = useState(false);
  const [batchResolvedProgress, setBatchResolvedProgress] = useState({ current: 0, total: 0 });
  const [aiPrompts, setAiPrompts] = useState<Record<SupportChannelType, string>>({ ...DEFAULT_PROMPTS });
  const [openAiStatus, setOpenAiStatus] = useState({ checking: false, verified: false, model: 'gpt-4o-mini', error: '' });
  const [savingAiConfig, setSavingAiConfig] = useState(false);
  const aiVerifiedOnceRef = useRef(false);

  // Restore AI config from localStorage immediately on company switch (0 network calls, 0 OpenAI pings)
  useEffect(() => {
    aiVerifiedOnceRef.current = false;
    if (!activeCompanyId) return;
    try {
      const raw = localStorage.getItem(`crm_wa_ai_cfg_${activeCompanyId}`);
      if (!raw) return;
      const cached = JSON.parse(raw);
      if (typeof cached.auto_reply_text === 'boolean') setAiAutoReplyText(cached.auto_reply_text);
      if (typeof cached.auto_reply_audio === 'boolean') setAiAutoReplyAudio(cached.auto_reply_audio);
      if (typeof cached.auto_reply_resolved_enabled === 'boolean') setAutoReplyResolvedEnabled(cached.auto_reply_resolved_enabled);
      if (typeof cached.auto_resolved_mark_lost === 'boolean') setAutoResolvedMarkLost(cached.auto_resolved_mark_lost);
      if (typeof cached.resolved_reply_template === 'string' && cached.resolved_reply_template.trim()) {
        setResolvedReplyTemplate(cached.resolved_reply_template);
      }
      if (Array.isArray(cached.resolved_trigger_phrases) && cached.resolved_trigger_phrases.length > 0) {
        setResolvedTriggerPhrasesText(cached.resolved_trigger_phrases.join(', '));
      }
      if (cached.prompts) {
        setAiPrompts({
          soporte: cached.prompts.soporte || DEFAULT_PROMPTS.soporte,
          contabilidad: cached.prompts.contabilidad || DEFAULT_PROMPTS.contabilidad,
          ventas: cached.prompts.ventas || DEFAULT_PROMPTS.ventas,
          otros: cached.prompts.otros || DEFAULT_PROMPTS.otros,
        });
      }
    } catch {
      // ignore invalid cache
    }
  }, [activeCompanyId]);

  const invoke = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('evolution-whatsapp-webhook', {
      body: { company_id: activeCompanyId || undefined, ...body },
    });
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

  const [togglingQualifier, setTogglingQualifier] = useState(false);

  const handleToggleThreadQualifier = async (active: boolean) => {
    if (!activeCircle) return;
    const t = activeCircle.activeTicket;
    setTogglingQualifier(true);
    try {
      await invoke({
        action: 'set_qualifier_thread_state',
        ticket_id: t.id,
        active,
      });
      setTickets((prev) =>
        prev.map((row) =>
          row.id === t.id
            ? {
                ...row,
                metadata: {
                  ...((row.metadata || {}) as Record<string, any>),
                  ai_qualifier_enrolled: true,
                  ai_qualifier_active: active,
                  ai_qualifier_status: active ? 'active' : 'paused',
                },
              }
            : row,
        ),
      );
      toast.success(active ? 'Calificador IA reactivado en este chat' : 'Calificador IA pausado en este chat');
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo actualizar el estado del Calificador IA');
    } finally {
      setTogglingQualifier(false);
    }
  };

  const verifyAndLoadAiConfig = async (showToast = false) => {
    setOpenAiStatus((p) => ({ ...p, checking: true }));
    try {
      const data = await invoke({ action: 'get_ai_config', company_id: activeCompanyId });
      setOpenAiStatus({
        checking: false,
        verified: Boolean(data.openai_verified),
        model: data.openai_model || 'gpt-4o-mini',
        error: data.openai_error || '',
      });
      if (typeof data.auto_reply_text === 'boolean') setAiAutoReplyText(data.auto_reply_text);
      if (typeof data.auto_reply_audio === 'boolean') setAiAutoReplyAudio(data.auto_reply_audio);
      if (typeof data.auto_reply_resolved_enabled === 'boolean') setAutoReplyResolvedEnabled(data.auto_reply_resolved_enabled);
      if (typeof data.auto_resolved_mark_lost === 'boolean') setAutoResolvedMarkLost(data.auto_resolved_mark_lost);
      if (typeof data.resolved_reply_template === 'string' && data.resolved_reply_template.trim()) {
        setResolvedReplyTemplate(data.resolved_reply_template);
      }
      if (Array.isArray(data.resolved_trigger_phrases) && data.resolved_trigger_phrases.length > 0) {
        setResolvedTriggerPhrasesText(data.resolved_trigger_phrases.join(', '));
      }
      if (data.prompts) {
        setAiPrompts({
          soporte: data.prompts.soporte || DEFAULT_PROMPTS.soporte,
          contabilidad: data.prompts.contabilidad || DEFAULT_PROMPTS.contabilidad,
          ventas: data.prompts.ventas || DEFAULT_PROMPTS.ventas,
          otros: data.prompts.otros || DEFAULT_PROMPTS.otros,
        });
      }
      if (activeCompanyId) {
        try {
          localStorage.setItem(
            `crm_wa_ai_cfg_${activeCompanyId}`,
            JSON.stringify({
              auto_reply_text: data.auto_reply_text,
              auto_reply_audio: data.auto_reply_audio,
              auto_reply_resolved_enabled: data.auto_reply_resolved_enabled,
              auto_resolved_mark_lost: data.auto_resolved_mark_lost,
              resolved_reply_template: data.resolved_reply_template,
              resolved_trigger_phrases: data.resolved_trigger_phrases,
              prompts: data.prompts,
            }),
          );
        } catch {
          // ignore quota errors
        }
      }
      if (showToast) {
        if (data.openai_verified) toast.success(`OpenAI conectado (${data.openai_model || 'gpt-4o-mini'} + Whisper)`);
        else toast.error(`OpenAI no respondió: ${data.openai_error || 'Verificar API Key'}`);
      }
    } catch (e: any) {
      setOpenAiStatus({ checking: false, verified: false, model: 'gpt-4o-mini', error: e?.message || 'Error al verificar' });
    }
  };

  // ── Data loading (split into Reference tables vs Tickets so silent updates never re-download 7 tables) ──
  const refsLoadedForCompanyRef = useRef<string | null>(null);
  const lastTicketsSyncRef = useRef<number>(0);

  const loadReferenceData = useCallback(async () => {
    if (!activeCompanyId) return;
    const [cats, ags, cls, lds, grps, existsFalseIds] = await Promise.all([
      ticketService.getCategories(activeCompanyId).catch(() => [] as TicketCategory[]),
      ticketService.getAgents(activeCompanyId).catch(() => [] as CompanyAgent[]),
      supabase
        .from('clients')
        .select('id, nombre, contacto, telefono')
        .eq('company_id', activeCompanyId)
        .then((r) => (r.data || []) as LightClientRow[], () => [] as LightClientRow[]),
      ticketService.getLeads(activeCompanyId).catch(() => [] as TicketLead[]),
      supabase
        .from('whatsapp_groups')
        .select('group_jid, subject, client_id')
        .eq('company_id', activeCompanyId)
        .then((r) => (r.data || []) as WaGroupRow[], () => [] as WaGroupRow[]),
      (async () => {
        const { data: errRows } = await supabase
          .from('whatsapp_outbox')
          .select('ticket_id')
          .eq('company_id', activeCompanyId)
          .eq('status', 'error')
          .ilike('error', '%exists":false%')
          .limit(1000);
        const ids = new Set<string>();
        for (const r of (errRows || []) as { ticket_id: string | null }[]) {
          if (r.ticket_id) ids.add(r.ticket_id);
        }
        if (ids.size === 0) return ids;
        const { data: sentRows } = await supabase
          .from('whatsapp_outbox')
          .select('ticket_id')
          .in('ticket_id', Array.from(ids))
          .eq('status', 'sent')
          .not('wa_message_id', 'is', null);
        for (const r of (sentRows || []) as { ticket_id: string | null }[]) {
          if (r.ticket_id) ids.delete(r.ticket_id);
        }
        return ids;
      })().catch(() => new Set<string>()),
    ]);
    setCategories(cats);
    setAgents(ags);
    setRealClients(cls);
    setCompanyLeads(lds);
    setWaGroups(grps);
    setNonWaTicketIds(existsFalseIds);
    refsLoadedForCompanyRef.current = activeCompanyId;
  }, [activeCompanyId]);

  const loadTicketsOnly = useCallback(async () => {
    if (!activeCompanyId) return;
    const tks = await ticketService.getTickets(activeCompanyId, { includeNonSupportWhatsapp: true });
    lastTicketsSyncRef.current = Date.now();
    setTickets(tks);
  }, [activeCompanyId]);

  const loadSupportData = useCallback(
    async (silent = false, refreshRefs = false) => {
      if (!activeCompanyId) return;
      if (!silent) setLoading(true);
      try {
        const needRefs = !silent || refreshRefs || refsLoadedForCompanyRef.current !== activeCompanyId;
        if (needRefs) {
          await Promise.all([loadTicketsOnly(), loadReferenceData()]);
        } else {
          await loadTicketsOnly();
        }
      } catch (err) {
        console.error('[SupportChatCircles] Error loading:', err);
        if (!silent) toast.error('No se pudieron cargar los chats');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [activeCompanyId, loadTicketsOnly, loadReferenceData],
  );

  useEffect(() => {
    if (activeCompanyId && scopes.any) {
      loadSupportData(false, true);
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
    const leadByPhone = new Map<string, TicketLead & { assigned_to?: string | null }>();
    companyLeads.forEach((l) => {
      leadMap.set(l.id, l as any);
      const l8 = String(l.phone || '').replace(/\D/g, '').slice(-8);
      if (l8.length === 8 && !leadByPhone.has(l8)) leadByPhone.set(l8, l as any);
    });
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

      const rawScope: WaScope = isWa ? getWaScope(latest) : 'soporte';
      const isGroup = isWa && (Boolean(meta.is_group) || String(meta.whatsapp_jid || '').endsWith('@g.us'));
      const phone = String(meta.whatsapp_phone || '').replace(/\D/g, '');
      const rawLeadId = (activeTicket.lead_id || latest.lead_id || null) as string | null;
      const lead = (rawLeadId ? leadMap.get(rawLeadId) : undefined) || (phone.length >= 8 ? leadByPhone.get(phone.slice(-8)) : undefined);
      const leadId = rawLeadId || lead?.id || null;
      const isReactivationTicket = Boolean(meta.wa_reactivation || activeMeta.wa_reactivation);
      const scope: WaScope =
        rawScope === 'por_clasificar' && (Boolean(leadId) || isReactivationTicket) ? 'lead' : rawScope;

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

      // Last message preview & unread state (cached per ticket revision)
      const staffDisplayName = profile?.full_name || 'Asesor Comercial';
      const descStats = getCachedTicketDescStats(latest, staffDisplayName);
      let lastMessageSender = cleanPushName || clientName;
      let lastMessageText = stripEmojis(String(meta.last_whatsapp_message || latest.title || ''));
      const parsed = descStats.parsedLastLine;
      if (parsed) {
        lastMessageSender = sanitizeWaName(parsed.sender) || clientName;
        lastMessageText = stripEmojis(parsed.text);
      }
      lastMessageSender = lastMessageSender
        .replace(/Simulaci[oó]n:\s*[a-zA-Z0-9_-]+/gi, staffDisplayName)
        .replace(/Platform\s*Owner/gi, staffDisplayName);
      lastMessageText = lastMessageText
        .replace(/Simulaci[oó]n:\s*[a-zA-Z0-9_-]+/gi, staffDisplayName)
        .replace(/Platform\s*Owner/gi, staffDisplayName);
      const lastFromNormalized: 'client' | 'staff' =
        (meta.last_message_from || (parsed ? (parsed.icon === '👨‍💻' ? 'staff' : 'client') : 'client')) === 'staff'
          ? 'staff'
          : 'client';
      const isOpen = ['new', 'open', 'pending'].includes(activeTicket.status);
      const lastMessageAt = String(meta.last_whatsapp_at || latest.updated_at || latest.created_at);

      // Detect polite closing messages ("Muchas gracias", "Está bien, gracias por la observación", "Bueno, muchas gracias", etc.)
      // so they don't trigger false red SLA alarms or clutter Sin abrir.
      const isCourtesyClosing = scope !== 'por_clasificar' && isCourtesyClosingMessage(lastMessageText);

      const attendedAt = String(meta.wa_attended_at || activeMeta.wa_attended_at || '');
      const isManuallyAttended =
        Boolean(attendedAt && attendedAt >= lastMessageAt) || dismissedWaitingMap[key] === lastMessageAt;

      const hasClientLine = descStats.hasClientLine;
      const staffLineCount = descStats.staffLineCount;
      const metaLeadStatus = String(meta.wa_lead_status || activeMeta.wa_lead_status || '').trim() || null;
      const hasManualOverride = Boolean(
        meta.wa_lead_status_override || activeMeta.wa_lead_status_override
      );
      const isNonWaError =
        !hasClientLine &&
        lastFromNormalized !== 'client' &&
        (metaLeadStatus === 'Erróneo' ||
          Boolean(meta.wa_delivery_error || activeMeta.wa_delivery_error) ||
          nonWaTicketIds.has(activeTicket.id) ||
          nonWaTicketIds.has(latest.id));

      const resolvedLeadStatus = resolveCircleLeadStatus({
        leadStatus: lead?.status,
        metaLeadStatus,
        isNonWaError,
        hasManualOverride,
      });
      const isDiscardedLead = resolvedLeadStatus === 'Perdido' || resolvedLeadStatus === 'Erróneo';
      const mergedReadByMap: Record<string, string> = {};
      for (const srcMap of [meta.wa_read_by, activeMeta.wa_read_by]) {
        if (srcMap && typeof srcMap === 'object' && !Array.isArray(srcMap)) {
          for (const [uid, ts] of Object.entries(srcMap as Record<string, unknown>)) {
            const cleanUid = String(uid || '').trim();
            const cleanTs = String(ts || '').trim();
            if (cleanUid && cleanTs) {
              mergedReadByMap[cleanUid] = maxIsoTimestamp(mergedReadByMap[cleanUid], cleanTs);
            }
          }
        }
      }
      if (profile?.id && readCirclesMap[key]) {
        mergedReadByMap[profile.id] = maxIsoTimestamp(mergedReadByMap[profile.id], readCirclesMap[key]);
      }

      const syncedReadAt = profile?.id ? mergedReadByMap[profile.id] || null : null;
      const syncedForcedUnreadAt = profile?.id
        ? String(
            (activeMeta.wa_forced_unread_by as Record<string, string> | undefined)?.[profile.id] ||
              (meta.wa_forced_unread_by as Record<string, string> | undefined)?.[profile.id] ||
              '',
          ) || null
        : null;
      const isForcedUnread =
        forcedUnreadMap[key] === lastMessageAt ||
        (syncedForcedUnreadAt === lastMessageAt && readCirclesMap[key] !== lastMessageAt);

      const unreadOrWaitingReply =
        lastFromNormalized === 'client' &&
        scope !== 'interno' &&
        scope !== 'spam' &&
        !isDiscardedLead &&
        !isManuallyAttended &&
        !isCourtesyClosing &&
        (scope !== 'soporte' || isOpen || activeMeta.is_technical_ticket === false);

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
      const reactivationSentAt = String(
        meta.wa_reactivation_sent_at || activeMeta.wa_reactivation_sent_at || latest.created_at || lastMessageAt
      );
      const reactivationTouch = Number(
        meta.wa_reactivation_touch || activeMeta.wa_reactivation_touch || (isReactivation ? 1 : 0)
      );
      const hoursSinceReactivation = isReactivation
        ? Math.max(0, Math.floor((Date.now() - new Date(reactivationSentAt).getTime()) / 3600000))
        : 0;
      const reactivationReplied =
        isReactivation &&
        (lastFromNormalized === 'client' || hasClientLine || Boolean(meta.wa_reactivation_replied || activeMeta.wa_reactivation_replied));
      const hasActiveConversation =
        !isDiscardedLead &&
        (Boolean(
          resolvedLeadStatus &&
            ['Lead calificado', 'En seguimiento', 'Negociación', 'En Negociación', 'Cotizado', 'Cerrado'].includes(
              resolvedLeadStatus
            )
        ) ||
          (hasClientLine && staffLineCount >= 2));

      const teamActivity = computeCircleTeamActivity({
        lastFrom: lastFromNormalized,
        lastMessageAt,
        unreadOrWaitingReply,
        isManuallyAttended,
        isCourtesyClosing,
        readByMap: mergedReadByMap,
        currentUserId: profile?.id,
        currentUserName: profile?.full_name,
        agentMap,
        lastStaffReplyBy: String(meta.last_staff_reply_by || activeMeta.last_staff_reply_by || ''),
        lastMessageSender,
        clientName,
        attendedByUserId: String(activeMeta.wa_attended_by || meta.wa_attended_by || ''),
        isReactivation,
        reactivationReplied,
      });

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
          if (
            !adminPreviewMode &&
            assignedTechId !== profile?.id &&
            leadOwnerId !== profile?.id &&
            !(scopes.leadsPool && !assignedTechId && !leadOwnerId)
          )
            return;
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
        interestedProductId: (lead as any)?.interested_product_id || null,
        leadOwnerId,
        leadOwnerName: leadOwnerId ? agentMap.get(leadOwnerId) || null : null,
        activeTicket,
        allClientTickets: sorted,
        lastFrom: lastFromNormalized,
        unreadOrWaitingReply,
        waitMinutes,
        syncedReadAt,
        syncedForcedUnreadAt,
        seenByOtherNames: teamActivity.seenByOtherNames,
        seenByMe: teamActivity.seenByMe,
        isManuallyAttended,
        attendedByShortName: teamActivity.attendedByShortName,
        repliedByShortName: teamActivity.repliedByShortName,
        isForcedUnread,
        teamStatus: teamActivity.teamStatus,
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
        reactivationSentAt,
        reactivationTouch,
        hoursSinceReactivation,
        hasActiveConversation,
      });
    });

    return list.sort((a, b) => {
      if (a.isWhatsApp !== b.isWhatsApp) return a.isWhatsApp ? -1 : 1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, categories, agents, realClients, companyLeads, nonWaTicketIds, scopes, profile?.id, profile?.full_name, adminPreviewMode, slaTick, dismissedWaitingMap, forcedUnreadMap, readCirclesMap]);

  const parsedResolvedTriggerPhrases = useMemo(() => {
    const arr = resolvedTriggerPhrasesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return arr.length > 0 ? arr : DEFAULT_RESOLVED_TRIGGER_PHRASES;
  }, [resolvedTriggerPhrasesText]);

  const pendingResolvedCircles = useMemo(() => {
    return circles.filter((c) => {
      if (!c.isWhatsApp || c.isGroup) return false;
      if (!c.isReactivation && c.scope !== 'lead' && c.scope !== 'por_clasificar') return false;
      if (
        c.leadStatus === 'Perdido' ||
        c.leadStatus === 'Erróneo' ||
        c.leadStatus === 'Cerrado' ||
        c.leadStatus === 'Cliente'
      ) {
        return false;
      }
      if (!c.unreadOrWaitingReply) return false;
      const meta = (c.activeTicket.metadata || {}) as Record<string, any>;
      if (meta.auto_resolved_replied_at) return false;
      return isAlreadyResolvedReply(c.lastMessageText, parsedResolvedTriggerPhrases);
    });
  }, [circles, parsedResolvedTriggerPhrases]);

  useEffect(() => {
    if (showAiPromptModal) {
      setSelectedPendingResolvedIds(pendingResolvedCircles.map((c) => c.circleId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAiPromptModal, pendingResolvedCircles.length]);

  const handleSendBatchResolvedReplies = async () => {
    const targets = pendingResolvedCircles.filter((c) => selectedPendingResolvedIds.includes(c.circleId));
    if (targets.length === 0 || sendingBatchResolved) return;
    setSendingBatchResolved(true);
    setBatchResolvedProgress({ current: 0, total: targets.length });
    try {
      await invoke({
        action: 'save_ai_config',
        company_id: activeCompanyId,
        auto_reply_text: aiAutoReplyText,
        auto_reply_audio: aiAutoReplyAudio,
        auto_reply_resolved_enabled: autoReplyResolvedEnabled,
        auto_resolved_mark_lost: autoResolvedMarkLost,
        resolved_reply_template: resolvedReplyTemplate.trim() || DEFAULT_RESOLVED_REPLY_TEMPLATE,
        resolved_trigger_phrases: parsedResolvedTriggerPhrases,
        prompts: {
          soporte: aiPrompts.soporte.trim(),
          contabilidad: aiPrompts.contabilidad.trim(),
          ventas: aiPrompts.ventas.trim(),
          otros: aiPrompts.otros.trim(),
        },
      });
    } catch {
      // non-blocking config save before batch send
    }

    let sentCount = 0;
    for (let i = 0; i < targets.length; i++) {
      const c = targets[i];
      setBatchResolvedProgress({ current: i + 1, total: targets.length });
      const personalizedText = renderResolvedReplyTemplate(resolvedReplyTemplate, c.clientName);
      try {
        await invoke({
          action: 'send_reply',
          ticket_id: c.activeTicket.id,
          lead_id: c.leadId || undefined,
          message_text: personalizedText,
          response_minutes: 1,
          is_resolved_auto_reply: true,
          mark_lead_lost: autoResolvedMarkLost,
        });
        sentCount++;
        markCircleAsRead(c.circleId, c.lastMessageAt, c.activeTicket.id);
        setDismissedWaitingMap((prev) => {
          const next = { ...prev, [c.circleId]: c.lastMessageAt };
          try {
            localStorage.setItem('crm_wa_dismissed_waiting', JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
        if (autoResolvedMarkLost && c.leadId) {
          setCompanyLeads((prev) =>
            prev.map((l) => (l.id === c.leadId && l.status !== 'Cliente' && l.status !== 'Cerrado' ? { ...l, status: 'Perdido' } : l))
          );
        }
        if (i < targets.length - 1) {
          await new Promise((r) => setTimeout(r, 1100));
        }
      } catch (err: any) {
        console.error('Error auto-replying resolved lead:', c.clientName, err);
      }
    }

    setSendingBatchResolved(false);
    setBatchResolvedProgress({ current: 0, total: 0 });
    if (sentCount > 0) {
      toast.success(
        autoResolvedMarkLost
          ? `Se respondieron ${sentCount} chats y se movieron a Perdidos`
          : `Se respondieron ${sentCount} chats automáticamente`
      );
      loadSupportData(true);
      if (activeCircle && targets.some((t) => t.circleId === activeCircle.circleId)) {
        loadThread(false);
      }
    } else {
      toast.error('No se pudieron enviar las respuestas');
    }
  };

  const isUnread = (c: SupportCircle) =>
    computeEffectiveCircleUnread({
      lastMessageAt: c.lastMessageAt,
      unreadOrWaitingReply: c.unreadOrWaitingReply,
      localReadAt: readCirclesMap[c.circleId],
      syncedReadAt: c.syncedReadAt,
      localForcedUnreadAt: forcedUnreadMap[c.circleId],
      syncedForcedUnreadAt: c.syncedForcedUnreadAt,
    });
  const isMine = (c: SupportCircle) =>
    Boolean(profile?.id && (c.assignedTechId === profile.id || c.leadOwnerId === profile.id));
  const isUnassigned = (c: SupportCircle) => !c.isGroup && !c.assignedTechId && !c.leadOwnerId && c.scope !== 'interno' && c.scope !== 'spam';

  const counts = useMemo(() => {
    // WhatsApp conversations only; old Service Hub tickets live in their own tab.
    const wa = circles.filter((c) => c.isWhatsApp && c.scope !== 'spam');
    const by = (s: WaScope) => circles.filter((c) => c.isWhatsApp && c.scope === s).length;
    const unreadList = wa.filter((c) => isUnread(c));
    const waitingList = wa.filter((c) => c.unreadOrWaitingReply);
    const slaCritical = waitingList.filter((c) => c.waitMinutes >= 15 && c.waitMinutes <= 24 * 60).length;
    const mine = wa.filter((c) => isMine(c)).length;
    const unassigned = wa.filter((c) => isUnassigned(c)).length;
    const reactivatedTotal = wa.filter((c) => c.isReactivation && c.leadStatus !== 'Erróneo').length;
    const reactivatedReplied = wa.filter((c) => c.reactivationReplied && c.leadStatus !== 'Erróneo').length;
    return {
      all: wa.length,
      unread: unreadList.length,
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
  }, [circles, readCirclesMap, forcedUnreadMap, profile?.id]);

  const contextCounts = useMemo(() => {
    const base = circles.filter((c) => matchesCircleBucketAndTray(c, selectedBuckets, specialTray));
    const waitingList = base.filter((c) => c.unreadOrWaitingReply);
    return {
      total: base.length,
      unopened: base.filter((c) => c.teamStatus === 'unopened').length,
      unread: base.filter((c) => isUnread(c)).length,
      waiting: waitingList.length,
      replied: base.filter((c) => c.teamStatus === 'replied' || c.teamStatus === 'attended').length,
      mine: base.filter((c) => isMine(c)).length,
      unassigned: base.filter((c) => isUnassigned(c)).length,
      urgent: waitingList.filter((c) => c.waitMinutes >= 15 && c.waitMinutes <= 24 * 60).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circles, selectedBuckets, specialTray, readCirclesMap, forcedUnreadMap, profile?.id]);

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

  const singleBucket: CircleBucket | null =
    specialTray === null && selectedBuckets.length === 1 ? selectedBuckets[0] : null;

  const bucketTabs = useMemo(() => {
    const tabs: { id: CircleBucket; label: string; alert?: boolean }[] = [];
    if (scopes.soporte) {
      tabs.push({ id: 'soporte', label: `Soporte (${counts.soporte})` });
    }
    if (scopes.leads) {
      if (scopes.leadsPool) {
        tabs.push({ id: 'por_clasificar', label: `Por tomar (${counts.por_clasificar})`, alert: counts.por_clasificar > 0 });
      }
      tabs.push({ id: 'lead', label: `${scopes.all ? 'Leads' : 'Mis leads'} (${counts.lead})` });
      if (counts.reactivatedTotal > 0 || selectedBuckets.includes('reactivados')) {
        tabs.push({
          id: 'reactivados',
          label: `Reactivados (${counts.reactivatedReplied}/${counts.reactivatedTotal})`,
          alert: counts.reactivatedReplied > 0,
        });
      }
    }
    return tabs;
  }, [counts, scopes, selectedBuckets]);

  const leadSubCounts = useMemo(() => {
    const base = circles.filter((c) => {
      if (!c.isWhatsApp) return false;
      if (singleBucket === 'reactivados') return c.isReactivation;
      if (singleBucket === 'lead') return c.scope === 'lead';
      return false;
    });
    let activos = 0;
    let sinResponder = 0;
    let readyForResend48h = 0;
    let maxHoursUnder48 = 0;
    let conversando = 0;
    let perdidos = 0;
    let erroneos = 0;
    for (const c of base) {
      const isPerdido = c.leadStatus === 'Perdido';
      const isErroneo = c.leadStatus === 'Erróneo';
      if (isPerdido) perdidos++;
      else if (isErroneo) erroneos++;
      else {
        if (singleBucket === 'reactivados') {
          if (c.reactivationReplied) {
            activos++;
          } else {
            sinResponder++;
            if (c.hoursSinceReactivation >= 48) {
              readyForResend48h++;
            } else if (c.hoursSinceReactivation > maxHoursUnder48) {
              maxHoursUnder48 = c.hoursSinceReactivation;
            }
          }
        } else {
          activos++;
        }
        if (c.hasActiveConversation) conversando++;
      }
    }
    const minHoursUntil48h = sinResponder > 0 && readyForResend48h === 0 ? Math.max(1, 48 - maxHoursUnder48) : 0;
    return { activos, sinResponder, readyForResend48h, minHoursUntil48h, conversando, perdidos, erroneos, todos: base.length };
  }, [circles, singleBucket]);

  const { resendLeadsPool, resendTouchInfoMap } = useMemo(() => {
    const pool: Lead[] = [];
    const touchMap: Record<string, ReactivationTouchInfo> = {};
    const seenIds = new Set<string>();
    for (const c of circles) {
      if (!c.isWhatsApp || c.isGroup || c.scope === 'interno' || c.scope === 'spam') continue;
      if (c.leadStatus === 'Erróneo') continue;
      if (!c.phone || c.phone.length < 8) continue;
      const id = c.leadId || c.activeTicket.id;
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      const effectiveStatus =
        c.scope === 'soporte' && (!c.leadStatus || c.leadStatus === 'Prospecto')
          ? 'Cliente'
          : c.leadStatus || 'Prospecto';
      pool.push({
        id,
        name: c.clientName,
        company_name: c.clientName,
        phone: c.phone,
        email: null,
        status: effectiveStatus as any,
        priority: 'medium' as any,
        value: 0,
        source: 'WhatsApp',
        assigned_to: c.leadOwnerId || c.assignedTechId || profile?.id || null,
        last_follow_up_at: c.reactivationSentAt || c.lastMessageAt,
        created_at: c.activeTicket.created_at,
        contact_count: c.reactivationTouch || 1,
        interested_product_id: c.interestedProductId || null,
      } as Lead);
      touchMap[id] = {
        touch: c.reactivationTouch || 1,
        sentAt: c.reactivationSentAt || c.lastMessageAt,
        hoursSinceSent: c.hoursSinceReactivation,
        isReactivation: c.isReactivation,
        replied: c.reactivationReplied,
        ticketId: c.activeTicket.id,
        realLeadId: c.leadId || null,
      };
    }
    return { resendLeadsPool: pool, resendTouchInfoMap: touchMap };
  }, [circles, profile?.id]);

  const filteredCircles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const res = circles.filter((c) => {
      if (!matchesCircleBucketAndTray(c, selectedBuckets, specialTray)) return false;
      if (!matchesCircleStateFilters(c, stateFilters, isUnread(c))) return false;

      if (ownerFilter === 'mine' && !isMine(c)) return false;
      if (ownerFilter === 'unassigned' && !isUnassigned(c)) return false;
      if (ownerFilter === 'urgent' && !(c.unreadOrWaitingReply && c.waitMinutes >= 15 && c.waitMinutes <= 24 * 60)) return false;

      if (channelFilter !== 'all' && c.scope === 'soporte' && c.supportChannel !== channelFilter) return false;

      // Apply Lead / Reactivados sub-filter when viewing that single bucket and not actively searching
      if (!q && (singleBucket === 'reactivados' || singleBucket === 'lead')) {
        const isPerdido = c.leadStatus === 'Perdido';
        const isErroneo = c.leadStatus === 'Erróneo';
        if (leadSubFilter === 'activos') {
          if (isPerdido || isErroneo) return false;
          if (singleBucket === 'reactivados' && !c.reactivationReplied) return false;
        } else if (leadSubFilter === 'sin_responder') {
          if (isPerdido || isErroneo || c.reactivationReplied) return false;
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

    if (singleBucket === 'reactivados' || singleBucket === 'lead') {
      return [...res].sort((a, b) => {
        if (singleBucket === 'reactivados' && leadSubFilter === 'sin_responder') {
          return b.hoursSinceReactivation - a.hoursSinceReactivation;
        }
        if (singleBucket === 'reactivados' && a.reactivationReplied !== b.reactivationReplied) {
          return a.reactivationReplied ? -1 : 1;
        }
        if (stateFilters.includes('waiting') || stateFilters.includes('unopened') || ownerFilter === 'urgent') {
          if (b.waitMinutes !== a.waitMinutes) return b.waitMinutes - a.waitMinutes;
        }
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      });
    }
    if (stateFilters.includes('waiting') || stateFilters.includes('unopened') || ownerFilter === 'urgent') {
      return [...res].sort((a, b) => {
        if (b.waitMinutes !== a.waitMinutes) return b.waitMinutes - a.waitMinutes;
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      });
    }
    return res;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circles, selectedBuckets, stateFilters, specialTray, singleBucket, ownerFilter, channelFilter, leadSubFilter, searchQuery, readCirclesMap, forcedUnreadMap, profile?.id]);

  useEffect(() => {
    setVisibleCircleLimit(80);
  }, [selectedBuckets, stateFilters, specialTray, ownerFilter, channelFilter, leadSubFilter, searchQuery]);

  const visibleCircles = useMemo(() => {
    if (filteredCircles.length <= visibleCircleLimit) return filteredCircles;
    if (selectedCircleId) {
      const idx = filteredCircles.findIndex((c) => c.circleId === selectedCircleId);
      if (idx >= visibleCircleLimit) {
        return filteredCircles.slice(0, Math.min(filteredCircles.length, idx + 15));
      }
    }
    return filteredCircles.slice(0, visibleCircleLimit);
  }, [filteredCircles, visibleCircleLimit, selectedCircleId]);

  const handleCirclesScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (visibleCircleLimit >= filteredCircles.length) return;
      const el = e.currentTarget;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 420) {
        setVisibleCircleLimit((prev) =>
          prev >= filteredCircles.length ? prev : Math.min(filteredCircles.length, prev + 80),
        );
      }
    },
    [visibleCircleLimit, filteredCircles.length],
  );

  // Mobile (< lg) uses native window scrolling so swiping up retracts browser chrome
  useEffect(() => {
    if (mobileChatOpen || visibleCircleLimit >= filteredCircles.length) return;
    const onWindowScroll = () => {
      if (window.innerWidth >= 1024) return;
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 450) {
        setVisibleCircleLimit((prev) =>
          prev >= filteredCircles.length ? prev : Math.min(filteredCircles.length, prev + 80),
        );
      }
    };
    window.addEventListener('scroll', onWindowScroll, { passive: true });
    return () => window.removeEventListener('scroll', onWindowScroll);
  }, [mobileChatOpen, visibleCircleLimit, filteredCircles.length]);

  const handleSelectCircle = useCallback((circle: SupportCircle) => {
    markCircleAsRead(circle.circleId, circle.lastMessageAt, circle.activeTicket.id);
    setSelectedCircleId(circle.circleId);
    setMobileChatOpen(true);
  }, []);

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
    setChatSessionStartedAt(Date.now());
    setShowReclassifyMenu(false);
    setShowClientPicker(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCircle?.activeTicket.id]);

  useEffect(() => {
    loadThread(true);
  }, [loadThread]);

  // ── Realtime (incremental in-memory patching — zero full-table storms) ────
  const threadIdsRef = useRef<string[]>([]);
  threadIdsRef.current = threadTicketIds;
  const threadTimer = useRef<number | null>(null);
  const loadThreadRef = useRef(loadThread);
  loadThreadRef.current = loadThread;
  const knownLeadIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    knownLeadIdsRef.current = new Set(companyLeads.map((l) => l.id));
  }, [companyLeads]);

  useEffect(() => {
    if (!activeCompanyId || !scopes.any) return;
    const scheduleThread = (ticketId?: string) => {
      if (ticketId && !threadIdsRef.current.includes(ticketId)) return;
      if (threadTimer.current) window.clearTimeout(threadTimer.current);
      threadTimer.current = window.setTimeout(() => loadThreadRef.current(false), 320);
    };
    const fetchMissingLead = async (leadId: string) => {
      if (!leadId || knownLeadIdsRef.current.has(leadId)) return;
      knownLeadIdsRef.current.add(leadId);
      const { data } = await supabase
        .from('leads')
        .select('id, name, email, phone, status, es_cliente, assigned_to, interested_product_id')
        .eq('id', leadId)
        .maybeSingle();
      if (data) {
        setCompanyLeads((prev) => {
          const exists = prev.some((l) => l.id === data.id);
          return exists ? prev.map((l) => (l.id === data.id ? (data as TicketLead) : l)) : [...prev, data as TicketLead];
        });
      }
    };

    const filter = `company_id=eq.${activeCompanyId}`;
    const channel = supabase
      .channel(`support_circles_${activeCompanyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter }, (p: any) => {
        lastTicketsSyncRef.current = Date.now();
        if (p.eventType === 'DELETE') {
          const deletedId = p.old?.id;
          if (deletedId) {
            setTickets((prev) => prev.filter((t) => t.id !== deletedId));
          }
          return;
        }
        const incoming = p.new as Ticket | undefined;
        if (!incoming?.id) return;
        setTickets((prev) => {
          const idx = prev.findIndex((t) => t.id === incoming.id);
          if (idx === -1) return [incoming, ...prev];
          const next = prev.slice();
          next[idx] = { ...prev[idx], ...incoming };
          return next;
        });
        if (incoming.lead_id && !knownLeadIdsRef.current.has(incoming.lead_id)) {
          fetchMissingLead(incoming.lead_id).catch(() => {});
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter }, (p: any) => {
        if (p.eventType === 'DELETE') {
          const deletedId = p.old?.id;
          if (deletedId) {
            setCompanyLeads((prev) => prev.filter((l) => l.id !== deletedId));
          }
          return;
        }
        const row = p.new;
        if (!row?.id) return;
        const patched: TicketLead = {
          id: row.id,
          name: row.name || '',
          email: row.email ?? null,
          phone: row.phone ?? null,
          status: row.status ?? null,
          es_cliente: row.es_cliente ?? null,
          assigned_to: row.assigned_to ?? null,
          interested_product_id: row.interested_product_id ?? null,
        };
        knownLeadIdsRef.current.add(row.id);
        setCompanyLeads((prev) => {
          const idx = prev.findIndex((l) => l.id === row.id);
          if (idx === -1) return [...prev, patched];
          const next = prev.slice();
          next[idx] = { ...prev[idx], ...patched };
          return next;
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_comments', filter }, (p: any) => {
        scheduleThread(p.new?.ticket_id || p.old?.ticket_id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_messages', filter }, (p: any) =>
        scheduleThread(p.new?.ticket_id),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_outbox', filter }, (p: any) => {
        const tId = p.new?.ticket_id as string | undefined;
        if (tId) {
          if (p.new?.status === 'sent' && p.new?.wa_message_id) {
            setNonWaTicketIds((prev) => {
              if (!prev.has(tId)) return prev;
              const next = new Set(prev);
              next.delete(tId);
              return next;
            });
          } else if (p.new?.status === 'error' && String(p.new?.error || '').includes('"exists":false')) {
            setNonWaTicketIds((prev) => {
              if (prev.has(tId)) return prev;
              const next = new Set(prev);
              next.add(tId);
              return next;
            });
          }
        }
        scheduleThread(tId);
      })
      .subscribe();

    const handleVisibilityChange = () => {
      if (!document.hidden && Date.now() - lastTicketsSyncRef.current > 120_000) {
        loadTicketsOnly().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (threadTimer.current) window.clearTimeout(threadTimer.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [activeCompanyId, scopes.any, loadTicketsOnly]);

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

      const staffDisplayName = profile?.full_name || 'Asesor Comercial';
      const raw = String(c.body || '')
        .replace(/Simulaci[oó]n:\s*[a-zA-Z0-9_-]+/gi, staffDisplayName)
        .replace(/Platform\s*Owner/gi, staffDisplayName)
        .trim();
      if (c.is_internal) {
        items.push({ id: c.id, kind: 'system', senderName: '', text: stripEmojis(raw), createdAt: c.created_at, ticketId: c.ticket_id });
        return;
      }
      const parsed = parseChatLine(raw, staffDisplayName);
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
        (parsed?.sender || agentName || (isStaff ? 'Equipo' : activeCircle.clientName))
          .replace(/\(Reporte Inicial\)/i, '')
          .replace(/Simulaci[oó]n:\s*[a-zA-Z0-9_-]+/gi, staffDisplayName)
          .replace(/Platform\s*Owner/gi, staffDisplayName)
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

  const handleSendReply = async (customText: string): Promise<boolean> => {
    const cleanInput = String(customText || '').trim();
    if (!cleanInput || !activeCircle || !activeCompanyId || !canSend) return false;
    const textToSend = formatQuotedReplyText(replyingToMessage, cleanInput);
    markCircleAsRead(activeCircle.circleId, activeCircle.lastMessageAt, activeCircle.activeTicket.id);
    const t = activeCircle.activeTicket;
    const nowIso = new Date().toISOString();
    const optimistic: TicketComment = {
      id: `temp-${Date.now()}`,
      ticket_id: t.id,
      company_id: activeCompanyId,
      author_id: profile?.id || null,
      body: `[--] 👨‍💻 ${profile?.full_name || 'Equipo'}: ${textToSend}`,
      is_internal: false,
      created_at: nowIso,
      updated_at: nowIso,
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
        response_minutes: Math.max(1, Math.round(getActiveChatSeconds() / 60)),
      });
      if (data?.comment) {
        setComments((prev) => prev.map((c) => (c.id === optimistic.id ? (data.comment as TicketComment) : c)));
      }
      setReplyingToMessage(null);
      const replyIso = String((data?.comment as TicketComment | undefined)?.created_at || new Date().toISOString());
      markCircleAsRead(activeCircle.circleId, replyIso, t.id);
      setTickets((prev) =>
        prev.map((row) =>
          row.id === t.id
            ? {
                ...row,
                updated_at: replyIso,
                metadata: {
                  ...((row.metadata || {}) as Record<string, unknown>),
                  last_whatsapp_message: cleanInput,
                  last_message_from: 'staff',
                  last_whatsapp_at: replyIso,
                },
              }
            : row,
        ),
      );
      loadThread(false);
      return true;
    } catch (err: any) {
      setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
      toast.error(err?.message || 'Error al enviar mensaje');
      return false;
    } finally {
      setSendingMessage(false);
    }
  };

  const handleUploadAttachment = async (file: File, caption: string): Promise<boolean> => {
    if (!file || !activeCircle || !canSend) return false;
    if (file.size > 45 * 1024 * 1024) {
      toast.error('El archivo es muy grande (máximo 45 MB)');
      return false;
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
        caption: caption.trim(),
      });
      toast.success('Archivo enviado');
      loadThread(false);
      loadSupportData(true);
      return true;
    } catch (err: any) {
      toast.error(err?.message || 'Error al enviar archivo');
      return false;
    } finally {
      setUploadingFile(false);
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

  const handleToggleTechnicalTicket = async (
    makeTechnical: boolean,
    opts?: { closeChat?: boolean; customTitle?: string },
  ) => {
    if (!activeCircle || togglingTechTicket) return;
    setTogglingTechTicket(true);
    try {
      await invoke({
        action: 'set_technical_ticket',
        ticket_id: activeCircle.activeTicket.id,
        is_technical_ticket: makeTechnical,
        close_chat: opts?.closeChat,
        custom_title: opts?.customTitle,
      });
      if (opts?.closeChat) {
        toast.success('Conversación marcada como atendida (sin ticket)');
      } else if (makeTechnical) {
        toast.success('Convertido en Ticket Técnico');
      } else {
        toast.success('Movido a Solo Chat (no cuenta como ticket técnico)');
      }
      await loadSupportData(true);
    } catch (err: any) {
      toast.error(err?.message || 'Error al actualizar tipo de caso');
    } finally {
      setTogglingTechTicket(false);
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
      if (data?.lead?.id) {
        const ld = data.lead;
        knownLeadIdsRef.current.add(ld.id);
        setCompanyLeads((prev) => {
          const exists = prev.some((l) => l.id === ld.id);
          const nextLead: TicketLead = {
            id: ld.id,
            name: ld.name || '',
            email: ld.email ?? null,
            phone: ld.phone ?? null,
            status: ld.status ?? null,
            es_cliente: ld.es_cliente ?? null,
            assigned_to: ld.assigned_to ?? null,
            interested_product_id: ld.interested_product_id ?? null,
          };
          return exists ? prev.map((l) => (l.id === ld.id ? { ...l, ...nextLead } : l)) : [...prev, nextLead];
        });
      }
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

  const handleSaveInternalNote = async (rawText: string): Promise<boolean> => {
    const text = String(rawText || '').trim();
    if (!text || !activeCircle || !activeCompanyId) return false;
    const t = activeCircle.activeTicket;
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
      return true;
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo guardar la nota interna');
      return false;
    } finally {
      setSendingMessage(false);
    }
  };

  const activeChatMsgs24h = useMemo(() => countChatMessagesLast24h(comments), [comments]);
  const activeRootCauseEntries = useMemo(
    () => (activeCircle ? extractRootCauseEntries(activeCircle.activeTicket.metadata as Record<string, any>) : []),
    [activeCircle],
  );
  const latestActiveRootCause = activeRootCauseEntries[0] || null;

  useEffect(() => {
    setShowRootCausePopover(false);
    setRootCauseNote('');
  }, [activeCircle?.circleId]);

  const handleSaveRootCauseTag = async () => {
    if (!activeCircle || !activeCompanyId) return;
    const t = activeCircle.activeTicket;
    setSavingRootCause(true);
    try {
      const { data: latestRow } = await supabase
        .from('tickets')
        .select('metadata')
        .eq('id', t.id)
        .maybeSingle();

      const freshMeta = ((latestRow?.metadata || t.metadata || {}) as Record<string, any>);
      const nowIso = new Date().toISOString();
      const rawStaff = String(profile?.full_name || 'Equipo Soporte').trim();
      const cleanStaffName = /simulaci[oó]n|platform\s*owner/i.test(rawStaff) ? 'Jimmy Arias' : rawStaff;
      const entryId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const nextMeta = appendRootCauseMetadataPatch(freshMeta, {
        id: entryId,
        at: nowIso,
        by: profile?.id || null,
        by_name: cleanStaffName,
        type: rootCauseType,
        note: rootCauseNote.trim() || undefined,
        msg_count_24h: activeChatMsgs24h,
      });

      const { error: updErr } = await supabase
        .from('tickets')
        .update({ metadata: nextMeta, updated_at: nowIso })
        .eq('id', t.id);
      if (updErr) throw updErr;

      setTickets((prev) =>
        prev.map((row) => (row.id === t.id ? { ...row, metadata: nextMeta, updated_at: nowIso } : row)),
      );

      const rcMeta = SUPPORT_ROOT_CAUSE_META[rootCauseType];
      const auditBody = `🏷️ Causa Raíz: ${rcMeta.label}${rootCauseNote.trim() ? ` — ${rootCauseNote.trim()}` : ''}`;
      const { data: noteRow } = await supabase
        .from('ticket_comments')
        .insert({
          ticket_id: t.id,
          company_id: activeCompanyId,
          author_id: profile?.id || null,
          body: auditBody,
          is_internal: true,
        })
        .select('*')
        .single();
      if (noteRow) {
        setComments((prev) => [...prev, noteRow as TicketComment]);
      }

      if (rootCauseMarkAttended && activeCircle.unreadOrWaitingReply) {
        await handleMarkCircleAttended(activeCircle);
      }

      toast.success(
        rcMeta.escalatesToAdmin
          ? `${rcMeta.shortLabel} escalado a Jimmy en Control`
          : `Marcado como ${rcMeta.shortLabel}`,
      );
      setShowRootCausePopover(false);
      setRootCauseNote('');
      loadSupportData(true);
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo guardar la causa raíz');
    } finally {
      setSavingRootCause(false);
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
    const pauseAi = shouldPauseAiOnLeadStatus(newStatus);
    const nowIso = new Date().toISOString();

    const phoneDigits = String(circle.phone || '').replace(/\D/g, '');
    const resolvedLeadId =
      circle.leadId ||
      (phoneDigits.length >= 8
        ? companyLeads.find(
            (l) => String(l.phone || '').replace(/\D/g, '').slice(-8) === phoneDigits.slice(-8)
          )?.id || null
        : null);

    const prevLeadsSnapshot = companyLeads;
    const prevNonWaSnapshot = nonWaTicketIds;
    const circleTicketIds = (circle.allClientTickets && circle.allClientTickets.length > 0
      ? circle.allClientTickets
      : [circle.activeTicket]
    ).map((t) => t.id);

    // Instant optimistic UI update
    if (resolvedLeadId) {
      setCompanyLeads((prev) => {
        const exists = prev.some((l) => l.id === resolvedLeadId);
        if (exists) {
          return prev.map((l) => (l.id === resolvedLeadId ? { ...l, status: newStatus } : l));
        }
        return [
          ...prev,
          {
            id: resolvedLeadId,
            name: circle.clientName,
            email: null,
            phone: circle.phone,
            status: newStatus,
            es_cliente: false,
          } as TicketLead,
        ];
      });
    }
    if (newStatus !== 'Erróneo') {
      setNonWaTicketIds((prev) => {
        const next = new Set(prev);
        circleTicketIds.forEach((tid) => next.delete(tid));
        return next;
      });
    }
    if (isDiscard) {
      markCircleAsRead(circle.circleId, circle.lastMessageAt, circle.activeTicket.id, true);
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
      let leadUpdatedDirectly = false;
      if (resolvedLeadId) {
        const { data: updatedRows, error } = await supabase
          .from('leads')
          .update({ status: newStatus })
          .eq('id', resolvedLeadId)
          .eq('company_id', activeCompanyId)
          .select('id, status');
        if (!error && updatedRows && updatedRows.length > 0) {
          leadUpdatedDirectly = true;
        }
      }

      if (!leadUpdatedDirectly) {
        // Fallback via service-role edge function (handles RLS edge cases & links lead_id by phone)
        const res = await invoke({
          action: 'update_lead_status',
          ticket_id: circle.activeTicket.id,
          lead_id: resolvedLeadId || undefined,
          status: newStatus,
        });
        if (!res?.ok) {
          throw new Error(res?.error || 'No se pudo sincronizar el estado con el lead');
        }
      } else {
        // Sync all tickets in this circle so metadata matches leads.status cleanly
        const ticketsToSync =
          circle.allClientTickets && circle.allClientTickets.length > 0
            ? circle.allClientTickets
            : [circle.activeTicket];
        for (const tRow of ticketsToSync) {
          const curMeta = { ...((tRow.metadata || {}) as Record<string, any>) };
          if (newStatus !== 'Erróneo') {
            delete curMeta.wa_delivery_error;
          }
          await supabase
            .from('tickets')
            .update({
              ...(resolvedLeadId && !tRow.lead_id ? { lead_id: resolvedLeadId } : {}),
              metadata: {
                ...curMeta,
                ...(curMeta.wa_scope === 'por_clasificar' ? { wa_scope: 'lead' } : {}),
                wa_lead_status: newStatus,
                wa_lead_status_override: true,
                ...(isDiscard ? { wa_attended_at: nowIso } : {}),
                ...(pauseAi ? { ai_qualifier_active: false } : {}),
              },
            })
            .eq('id', tRow.id);
        }

        if (pauseAi && resolvedLeadId) {
          await supabase
            .from('lead_qualifier_sessions')
            .update({
              status: 'closed_discarded',
              handoff_reason: `Etapa cambiada a ${newStatus} desde Chat WhatsApp`,
              handoff_at: nowIso,
            })
            .eq('company_id', activeCompanyId)
            .eq('lead_id', resolvedLeadId)
            .in('status', ['active', 'pending_first_touch', 'waiting_reply']);
        }

        await supabase.from('ticket_comments').insert({
          ticket_id: circle.activeTicket.id,
          company_id: activeCompanyId,
          author_id: profile?.id || null,
          body: `${profile?.full_name || 'Equipo'} actualizó etapa del lead a: ${newStatus}`,
          is_internal: true,
        });
      }

      toast.success(
        isDiscard
          ? `Lead y chat marcados como ${newStatus} ✓`
          : `Etapa sincronizada en Lead y Chat: ${newStatus}`
      );
      loadSupportData(true);
      if (activeCircle?.circleId === circle.circleId) {
        loadThread(false);
      }
    } catch (err: any) {
      setCompanyLeads(prevLeadsSnapshot);
      setNonWaTicketIds(prevNonWaSnapshot);
      toast.error(err?.message || 'No se pudo actualizar la etapa en el Lead');
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
      const cleanName = extractClientGreetingFirstName(clientName);
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

      markCircleAsRead(activeCircle.circleId, activeCircle.lastMessageAt, t.id);
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
    for (const t of activeCircle.allClientTickets) {
      const fromTicket = (t.metadata as any)?.wa_discovery;
      if (fromTicket && typeof fromTicket === 'object') {
        const cleaned: Record<string, string> = {};
        for (let i = 1; i <= 7; i++) {
          const val = fromTicket[`q${i}`];
          if (typeof val === 'string' && val.trim()) cleaned[`q${i}`] = val.trim();
        }
        if (Object.keys(cleaned).length > 0) return cleaned;
      }
    }
    const combinedComments = comments.map((c) => c.body || '').join('\n\n');
    return parseAriasAnswersFromNotes(combinedComments);
  }, [activeCircle, comments]);

  const buildDiscoveryWhatsAppText = useCallback(() => {
    if (!activeCircle) return '';
    const targetId = activeCircle.activeTicket.id;
    const url = `${window.location.origin}/diagnostico/${targetId}`;
    const cleanFirst = extractClientGreetingFirstName(activeCircle.clientName);
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
      composerRef.current?.setDraft(text, 'whatsapp');
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
    const effectiveSlug = myBookingSlug || (profile?.id ? `jimmy-arias-${profile.id.slice(0, 4)}` : 'jimmy-arias');
    const bookingUrl = `${window.location.origin}/book/${effectiveSlug}`;
    const cleanFirst = extractClientGreetingFirstName(activeCircle.clientName);
    const msg = [
      `Hola${cleanFirst}, le comparto mi enlace de calendario para que elija el día y la hora que mejor le convenga para nuestra reunión o demostración:`,
      '',
      bookingUrl,
    ].join('\n');

    if (sendImmediately) {
      await handleSendReply(msg);
      toast.success('Enlace de calendario enviado al WhatsApp');
    } else {
      composerRef.current?.setDraft(msg, 'whatsapp');
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
        const cleanFirst = extractClientGreetingFirstName(activeCircle.clientName);
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
          composerRef.current?.setDraft(msgText, 'whatsapp');
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
          chat_session_seconds: getActiveChatSeconds(),
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

  const refreshBridgeStatus = async () => {
    try {
      const res = await invoke({ action: 'bridge_status' });
      setBridgeStatus(res);
      if (res?.evo_connection_state) {
        setWaConnectionState(res.evo_connection_state);
      }
      return res;
    } catch (e: any) {
      setBridgeStatus({ ok: false, error: e?.message });
      return null;
    }
  };

  const openBridgeStatus = async () => {
    setShowStatusModal(true);
    setBridgeStatus(null);
    await refreshBridgeStatus();
  };

  const handleReconnectBridge = async () => {
    setReconnectingBridge(true);
    try {
      await invoke({ action: 'request_evo_heal', mode: 'restart_and_catchup' });
      toast.success('Reconexión solicitada al servidor WhatsApp…');
      for (const delay of [5000, 9000]) {
        await new Promise((r) => setTimeout(r, delay));
        const st = await refreshBridgeStatus();
        if (st?.evo_connection_state === 'open') {
          toast.success('WhatsApp (+503 7971-8911) reconectado');
          break;
        }
        if (st?.evo_qr_base64) {
          toast('Escanea el código QR en pantalla desde +503 7971-8911', { duration: 6000 });
          break;
        }
      }
    } catch (e: any) {
      toast.error(e?.message || 'Error al solicitar reconexión');
    } finally {
      setReconnectingBridge(false);
    }
  };

  useEffect(() => {
    if (!activeCompanyId || !scopes.any) return;
    let cancelled = false;
    invoke({ action: 'bridge_status' })
      .then((res) => {
        if (!cancelled && res?.evo_connection_state) {
          setWaConnectionState(res.evo_connection_state);
        }
      })
      .catch(() => {
        /* ignore background probe */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompanyId, scopes.any]);

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
    <div className="min-h-[100dvh] lg:min-h-0 lg:h-full flex-1 flex flex-col bg-[#F5F6FA] lg:overflow-hidden">
      {/* ── TOP HEADER (Fixed on mobile list scroll; hidden on mobile when inside an active chat) ── */}
      <header
        className={`fixed top-0 left-0 right-0 lg:static h-14 md:h-12 bg-white border-b border-slate-200/80 px-4 md:px-5 items-center justify-between shrink-0 z-30 ${
          mobileChatOpen && activeCircle ? 'hidden lg:flex' : 'flex'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 md:h-4.5 rounded-full bg-indigo-600" />
            <span className="text-[17px] md:text-[15px] font-bold text-slate-900 tracking-tight">Chat WhatsApp</span>
          </div>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <span className="text-[13px] text-slate-500 hidden sm:inline truncate">
            {greetingTime()},{' '}
            <strong className="font-bold text-slate-800">
              {profile?.full_name && !/simulaci[oó]n|platform\s*owner/i.test(profile.full_name)
                ? profile.full_name.split(' ')[0]
                : 'Jimmy'}
            </strong>
          </span>
          <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[13px] font-medium bg-slate-100 text-slate-600 border border-slate-200/70">
            <Phone className="w-3.5 h-3.5 text-indigo-600" />
            +503 7971-8911
          </span>
        </div>

        <div className="flex items-center gap-2">
          {(scopes.all || scopes.soporte) && (
            <button
              type="button"
              onClick={() => navigate('/support/intelligence')}
              title="Ver Pulso Diario, Chats Ping-Pong y Bugs escalados a Jimmy"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200/80 text-[12.5px] font-semibold transition"
            >
              <Activity className="w-3.5 h-3.5 text-indigo-600" />
              <span>Control</span>
            </button>
          )}
          {/* Quick sound toggle */}
          <button
            type="button"
            onClick={toggleSound}
            title={soundEnabled ? 'Alarma sonora activada (clic para silenciar)' : 'Alarma silenciada (clic para activar y probar)'}
            className="hidden sm:inline-flex p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-600 transition"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-indigo-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>

          {/* Interactive Alert Bell & Notification Center */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAlertsPopover((v) => !v)}
              title="Centro de Alertas y Seguimiento"
              className="relative inline-flex items-center gap-1.5 px-3 py-2 md:py-1.5 rounded-xl md:rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 text-[14px] md:text-[13px] font-semibold transition"
            >
              {alertCircles.total > 0 || bellRinging ? (
                <BellRing className={`w-4 h-4 text-indigo-600 ${bellRinging ? 'animate-bounce' : ''}`} />
              ) : (
                <Bell className="w-4 h-4 text-slate-500" />
              )}
              <span className="hidden sm:inline">Alertas</span>
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
                  className="fixed inset-0 bg-slate-900/35 md:bg-slate-900/15 backdrop-blur-[1px] z-[200] md:z-40"
                  onClick={() => setShowAlertsPopover(false)}
                />
                <div className="fixed inset-x-3 top-16 max-h-[calc(100dvh-5.5rem)] flex flex-col z-[210] md:inset-auto md:absolute md:right-0 md:top-full md:mt-2 md:w-[480px] md:max-w-[92vw] md:max-h-[82vh] md:z-50 bg-[#F4F6FA] border-2 border-indigo-200/90 ring-1 ring-slate-900/10 rounded-2xl shadow-[0_24px_60px_rgba(15,23,42,0.24)] overflow-hidden">
                  <div className="px-4 py-3 bg-[#EEF0FF] border-b border-indigo-200/80 flex items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-2xs shrink-0">
                        <Bell className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[16px] md:text-[13.5px] font-bold text-indigo-950 tracking-tight truncate">
                        Centro de Alertas WhatsApp
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const ok = playWaAlertSound('test');
                          if (ok) toast.success('Alarma sonora verificada correctamente');
                          else toast.error('El navegador bloqueó el audio; haz clic e intenta de nuevo');
                        }}
                        className="px-3 py-1.5 md:px-2.5 md:py-1 rounded-lg bg-white hover:bg-indigo-50 border border-indigo-200 text-[13.5px] md:text-xs font-semibold text-indigo-700 shadow-2xs transition"
                      >
                        <span className="sm:hidden">Sonido</span>
                        <span className="hidden sm:inline">Probar sonido</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAlertsPopover(false)}
                        className="p-1.5 md:p-1 rounded-lg text-indigo-700/70 hover:text-indigo-950 hover:bg-indigo-100/70"
                      >
                        <X className="w-5 h-5 md:w-4 md:h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="px-4 py-2.5 md:py-2 bg-white border-b border-slate-200/80 flex items-center justify-between gap-2 flex-wrap text-[14px] md:text-xs shrink-0">
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
                        className="text-[13.5px] md:text-xs font-semibold text-indigo-600 hover:underline"
                      >
                        Activar aviso en escritorio
                      </button>
                    )}
                  </div>

                  {scopes.all && (
                    <div className="px-4 py-2.5 md:py-2 bg-white border-b border-slate-200/80 flex items-center gap-1 flex-wrap shrink-0">
                      <span className="text-[13.5px] md:text-xs font-medium text-slate-400 mr-1.5">Área:</span>
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
                          className={`px-3 py-1.5 md:px-2.5 md:py-1 rounded-lg text-[13.5px] md:text-xs transition ${
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

                  <div className="flex-1 min-h-0 md:max-h-[420px] overflow-y-auto p-3 space-y-3 bg-[#F4F6FA]">
                    {alertCircles.total === 0 ? (
                      <div className="p-8 bg-white rounded-xl border border-slate-200/80 text-center space-y-1">
                        <CheckCircle2 className="w-6 h-6 text-slate-400 mx-auto" />
                        <p className="text-[15.5px] md:text-[13px] font-bold text-slate-800">Todo al día</p>
                        <p className="text-[13.5px] md:text-xs text-slate-400">No hay conversaciones ni leads pendientes de respuesta.</p>
                      </div>
                    ) : (
                      <>
                        {alertCircles.newLeads.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="px-1 flex items-center justify-between">
                              <span className="text-[12.5px] md:text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
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
                                    setSpecialTray(null);
                                    setStateFilters([]);
                                    setSelectedBuckets(['por_clasificar']);
                                    setSelectedCircleId(c.circleId);
                                    setMobileChatOpen(true);
                                    setShowAlertsPopover(false);
                                  }}
                                  className="w-full text-left px-3.5 py-2.5 bg-white hover:bg-indigo-50/40 rounded-xl border border-slate-200/90 hover:border-indigo-300 shadow-2xs flex items-center gap-3 transition"
                                >
                                  <div className="w-10 h-10 md:w-9 md:h-9 rounded-full bg-indigo-50 text-indigo-700 font-semibold text-[13.5px] md:text-xs flex items-center justify-center shrink-0">
                                    {initials(c.clientName)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="text-[15.5px] md:text-[13.5px] font-bold md:font-semibold text-slate-900 truncate">{c.clientName}</span>
                                        <span className="hidden md:inline text-xs text-slate-400 shrink-0">· Por tomar</span>
                                      </div>
                                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/70 text-[12px] md:text-[11px] font-semibold shrink-0">
                                        {c.waitMinutes > 0 ? formatWaitDuration(c.waitMinutes) : listTimeLabel(c.lastMessageAt)}
                                      </span>
                                    </div>
                                    <p className="text-[14px] md:text-[12.5px] text-slate-500 truncate mt-0.5">{c.lastMessageText}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {alertCircles.urgent.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="px-1 flex items-center justify-between">
                              <span className="text-[12.5px] md:text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
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
                                        setSpecialTray(null);
                                        setStateFilters([]);
                                        setSelectedBuckets([]);
                                        setSelectedCircleId(c.circleId);
                                        setMobileChatOpen(true);
                                        setShowAlertsPopover(false);
                                      }}
                                      className="flex-1 min-w-0 text-left flex items-center gap-3"
                                    >
                                      <div className="w-10 h-10 md:w-9 md:h-9 rounded-full bg-slate-100 text-slate-600 font-semibold text-[13.5px] md:text-xs flex items-center justify-center shrink-0">
                                        {c.isGroup ? <Users className="w-4 h-4" /> : initials(c.clientName)}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="text-[15.5px] md:text-[13.5px] font-bold md:font-semibold text-slate-900 truncate">{c.clientName}</span>
                                            <span className="hidden md:inline text-xs text-slate-400 shrink-0">· {shortType}</span>
                                          </div>
                                          <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-200/80 text-[12px] md:text-[11px] font-semibold shrink-0">
                                            {formatWaitDuration(c.waitMinutes)}
                                          </span>
                                        </div>
                                        <p className="text-[14px] md:text-[12.5px] text-slate-500 truncate mt-0.5">{c.lastMessageText}</p>
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
                              <span className="text-[12.5px] md:text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
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
                                      setSpecialTray(null);
                                      setStateFilters([]);
                                      setSelectedBuckets([]);
                                      setSelectedCircleId(c.circleId);
                                      setMobileChatOpen(true);
                                      setShowAlertsPopover(false);
                                    }}
                                    className="w-full text-left px-3.5 py-2.5 bg-white hover:bg-indigo-50/40 rounded-xl border border-slate-200/90 hover:border-indigo-300 shadow-2xs flex items-center gap-3 transition"
                                  >
                                    <div className="w-10 h-10 md:w-9 md:h-9 rounded-full bg-slate-100 text-slate-600 font-semibold text-[13.5px] md:text-xs flex items-center justify-center shrink-0">
                                      {c.isGroup ? <Users className="w-4 h-4" /> : initials(c.clientName)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span className="text-[15.5px] md:text-[13.5px] font-bold md:font-semibold text-slate-900 truncate">{c.clientName}</span>
                                          <span className="hidden md:inline text-xs text-slate-400 shrink-0">· {shortType}</span>
                                        </div>
                                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/70 text-[12px] md:text-[11px] font-semibold shrink-0">
                                          {formatWaitDuration(c.waitMinutes)}
                                        </span>
                                      </div>
                                      <p className="text-[14px] md:text-[12.5px] text-slate-500 truncate mt-0.5">{c.lastMessageText}</p>
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
                setSpecialTray(null);
                setStateFilters([]);
                setSelectedBuckets([]);
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
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 transition"
              >
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>Accesos</span>
              </button>
              <button
                onClick={() => {
                  if (selectedBuckets.includes('reactivados') || pendingResolvedCircles.length > 0) {
                    setActivePromptTab('ya_resolvimos');
                  }
                  setShowAiPromptModal(true);
                  if (!aiVerifiedOnceRef.current) {
                    aiVerifiedOnceRef.current = true;
                    verifyAndLoadAiConfig(false);
                  }
                }}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold bg-indigo-50/70 hover:bg-indigo-100/70 text-indigo-700 border border-indigo-200/60 transition"
              >
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>IA</span>
                {pendingResolvedCircles.length > 0 && (
                  <span
                    title={`${pendingResolvedCircles.length} chats de "Ya resolvimos" pendientes de contestar`}
                    className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-black leading-tight"
                  >
                    {pendingResolvedCircles.length}
                  </span>
                )}
              </button>
              <button
                onClick={openBridgeStatus}
                title="Estado de la conexión WhatsApp"
                className="relative hidden md:inline-flex p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200/80 transition"
              >
                <Settings className="w-4 h-4" />
                {waConnectionState && waConnectionState !== 'open' && (
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 border-2 border-white absolute -top-1 -right-1 animate-pulse" />
                )}
              </button>
            </>
          )}
          <div className="w-9 h-9 md:w-8 md:h-8 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-bold text-[14px] md:text-[13px] flex items-center justify-center">
            {initials(profile?.full_name || 'AD')}
          </div>
        </div>
      </header>

      <div className="flex-1 flex lg:overflow-hidden">
        {/* ── LEFT: chat list (Responsive on Tablet/Mobile + Collapsible on Desktop) ── */}
        <aside
          style={{ ['--left-w' as any]: `${leftPanelWidth}px` }}
          className={`bg-white flex-col shrink-0 relative w-full lg:w-[var(--left-w)] pt-14 lg:pt-0 ${
            mobileChatOpen && activeCircle ? 'hidden' : 'flex'
          } ${leftListCollapsed ? 'lg:hidden' : 'lg:flex'}`}
        >
          <div className="px-4 pt-3 pb-2.5 md:px-3.5 md:pt-2.5 md:pb-1.5 border-b border-slate-100 space-y-2.5 md:space-y-1.5 relative">
            <div className="flex items-center gap-2 md:gap-1.5">
              <div className="relative flex-1">
                <Search className="w-4.5 h-4.5 md:w-4 md:h-4 text-slate-400 absolute left-3.5 md:left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar cliente, grupo o teléfono..."
                  className="w-full pl-10 md:pl-9 pr-8 py-2.5 md:py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-[15px] md:text-[13px] font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    title="Limpiar búsqueda"
                    className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 absolute right-2 top-1/2 -translate-y-1/2 transition"
                  >
                    <X className="w-4 h-4 md:w-3.5 md:h-3.5" />
                  </button>
                )}
              </div>

              {(() => {
                const extraFilterCount =
                  (ownerFilter !== 'all' ? 1 : 0) +
                  (channelFilter !== 'all' ? 1 : 0) +
                  (stateFilters.includes('replied') ? 1 : 0) +
                  (specialTray !== null ? 1 : 0);
                return (
                  <button
                    type="button"
                    onClick={() => setShowFilterMenu((v) => !v)}
                    className={`px-3 py-2.5 md:px-2.5 md:py-1.5 rounded-xl border text-[13.5px] md:text-[12.5px] font-semibold inline-flex items-center gap-1.5 shrink-0 transition ${
                      extraFilterCount > 0
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90'
                    }`}
                  >
                    <Filter className="w-4 h-4 md:w-3.5 md:h-3.5 text-slate-500" />
                    <span>Filtros</span>
                    {extraFilterCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[10px] font-bold leading-tight">
                        {extraFilterCount}
                      </span>
                    )}
                    <ChevronDown className="w-3.5 h-3.5 md:w-3 md:h-3 text-slate-400" />
                  </button>
                );
              })()}

              <button
                onClick={() => loadSupportData(false, true)}
                title={`Actualizar (${filteredCircles.length} conversaciones)`}
                className="hidden md:flex p-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200/80 items-center justify-center transition shrink-0"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
              </button>
            </div>

            {/* Clean Filter Dropdown Menu (Centered modal on mobile, anchored popover on desktop) */}
            {showFilterMenu && (
              <>
                <div
                  className="md:hidden fixed inset-0 bg-slate-900/35 backdrop-blur-[1px] z-[200]"
                  onClick={() => setShowFilterMenu(false)}
                />
                <div className="fixed inset-x-3 top-28 max-h-[72dvh] overflow-y-auto z-[210] md:inset-auto md:absolute md:right-4 md:top-11 md:w-64 md:max-h-none md:z-30 bg-white border border-slate-200 rounded-2xl shadow-xl p-3.5 md:p-1.5 space-y-1.5 md:space-y-1 text-[15.5px] md:text-xs">
                <div className="px-3 py-1.5 md:px-2.5 md:py-1 text-[14px] md:text-[11px] font-bold md:font-semibold text-slate-500 md:text-slate-400 flex items-center justify-between">
                  <span>Refinar conversaciones</span>
                  <button type="button" onClick={() => setShowFilterMenu(false)} className="p-1.5 md:p-0 text-slate-400 hover:text-slate-600">
                    <X className="w-4.5 h-4.5 md:w-3 md:h-3" />
                  </button>
                </div>

                {/* Estado adicional combinable */}
                <button
                  type="button"
                  onClick={() => {
                    if (leadSubFilter === 'sin_responder') setLeadSubFilter('activos');
                    setStateFilters((prev) => toggleStateFilterSelection(prev, 'replied'));
                    setShowFilterMenu(false);
                  }}
                  className={`w-full px-3 py-2.5 md:px-2.5 md:py-1.5 rounded-xl flex items-center justify-between transition ${
                    stateFilters.includes('replied')
                      ? 'bg-emerald-50 text-emerald-700 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCheck className="w-4.5 h-4.5 md:w-3.5 md:h-3.5 text-emerald-600" />
                    Ya respondidos / atendidos
                  </span>
                  <span className="text-[14.5px] md:text-xs font-semibold md:font-normal text-slate-400">{contextCounts.replied}</span>
                </button>

                <div className="pt-1 mt-1 border-t border-slate-100 space-y-0.5">
                  <div className="px-3 py-1 md:px-2.5 md:py-0.5 text-[12px] md:text-[10px] font-bold uppercase tracking-wider text-slate-400">Responsable / SLA</div>
                  {(
                    [
                      { id: 'all', label: 'Todos los agentes', count: contextCounts.total },
                      { id: 'mine', label: 'Asignados a mí', count: contextCounts.mine },
                      { id: 'unassigned', label: 'Sin asignar', count: contextCounts.unassigned },
                      { id: 'urgent', label: 'Espera > 15 min', count: contextCounts.urgent, urgent: true },
                    ] as { id: OwnerSubFilter; label: string; count: number; urgent?: boolean }[]
                  ).map((sf) => {
                    const active = ownerFilter === sf.id && specialTray === null;
                    return (
                      <button
                        key={sf.id}
                        type="button"
                        onClick={() => {
                          if (specialTray !== null) setSpecialTray(null);
                          setOwnerFilter(sf.id);
                          setShowFilterMenu(false);
                        }}
                        className={`w-full px-3 py-2.5 md:px-2.5 md:py-1.5 rounded-xl flex items-center justify-between transition ${
                          active
                            ? 'bg-indigo-50 text-indigo-700 font-semibold'
                            : sf.urgent && sf.count > 0
                            ? 'text-rose-600 hover:bg-rose-50/60 font-medium'
                            : 'text-slate-700 hover:bg-slate-50 font-medium'
                        }`}
                      >
                        <span>{sf.label}</span>
                        <span className="text-[14.5px] md:text-xs font-semibold md:font-normal text-slate-400">{sf.count}</span>
                      </button>
                    );
                  })}
                </div>

                {scopes.all && (
                  <div className="pt-1.5 mt-1 border-t border-slate-100 space-y-0.5">
                    <div className="px-3 py-1 md:px-2.5 md:py-0.5 text-[12px] md:text-[10px] font-bold uppercase tracking-wider text-slate-400">Otras bandejas</div>
                    {(
                      [
                        { id: 'interno' as SpecialTray, label: 'Equipo interno', count: counts.interno },
                        { id: 'spam' as SpecialTray, label: 'Spam / bloqueados', count: counts.spam },
                        ...(counts.tickets > 0 ? [{ id: 'tickets' as SpecialTray, label: 'Otros tickets (no WhatsApp)', count: counts.tickets }] : []),
                      ]
                    ).map((sec) => {
                      const active = specialTray === sec.id;
                      return (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setOwnerFilter('all');
                            setChannelFilter('all');
                            setSelectedBuckets([]);
                            setSpecialTray(active ? null : sec.id);
                            setShowFilterMenu(false);
                          }}
                          className={`w-full px-3 py-2.5 md:px-2.5 md:py-1.5 rounded-xl flex items-center justify-between transition ${
                            active ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700 hover:bg-slate-50 font-medium'
                          }`}
                        >
                          <span>{sec.label}</span>
                          <span className="text-[14.5px] md:text-xs font-semibold md:font-normal text-slate-400">{sec.count}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {scopes.soporte && (selectedBuckets.length === 0 || selectedBuckets.includes('soporte')) && (
                  <div className="pt-1.5 mt-1 border-t border-slate-100 px-2 pb-1 space-y-1">
                    <span className="text-[13.5px] md:text-[11px] font-semibold text-slate-400">Área de soporte</span>
                    <select
                      value={channelFilter}
                      onChange={(e) => {
                        setChannelFilter(e.target.value as 'all' | SupportChannelType);
                        setShowFilterMenu(false);
                      }}
                      className="w-full px-3 py-2.5 md:px-2.5 md:py-1.5 rounded-xl text-[15px] md:text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200 focus:outline-none"
                    >
                      <option value="all">Todas las áreas</option>
                      <option value="soporte">Soporte / Operaciones</option>
                      <option value="contabilidad">Contabilidad / Finanzas</option>
                      <option value="otros">Otros</option>
                    </select>
                  </div>
                )}
              </div>
              </>
            )}

            {/* Row 1: Bandejas (1 sola fila deslizable en móvil; multi-selección en desktop) */}
            <div className="flex items-center gap-1.5 md:gap-1 overflow-x-auto pb-0.5 md:pb-0 md:flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setSpecialTray(null);
                  setSelectedBuckets([]);
                  setLeadSubFilter('activos');
                }}
                className={`px-3.5 md:px-2 py-1.5 md:py-1 rounded-full md:rounded-lg text-[13px] md:text-[12px] whitespace-nowrap transition shrink-0 ${
                  specialTray === null && selectedBuckets.length === 0 && !stateFilters.includes('waiting')
                    ? 'bg-slate-900 md:bg-indigo-50 text-white md:text-indigo-700 font-bold'
                    : 'text-slate-600 hover:bg-slate-50 font-medium'
                }`}
              >
                Todos ({counts.all})
              </button>
              <button
                type="button"
                onClick={() => {
                  if (leadSubFilter === 'sin_responder') setLeadSubFilter('activos');
                  setStateFilters((prev) => toggleStateFilterSelection(prev, 'waiting'));
                }}
                className={`md:hidden px-3.5 py-1.5 rounded-full text-[13px] whitespace-nowrap transition shrink-0 inline-flex items-center gap-1 ${
                  stateFilters.includes('waiting')
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-slate-100 text-slate-700 font-medium'
                }`}
              >
                <span>Sin contestar ({contextCounts.waiting})</span>
              </button>
              {bucketTabs.map((tab) => {
                const active = specialTray === null && selectedBuckets.includes(tab.id);
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setSpecialTray(null);
                      setLeadSubFilter('activos');
                      setSelectedBuckets((prev) => toggleBucketSelection(prev, tab.id));
                    }}
                    className={`px-3.5 md:px-2 py-1.5 md:py-1 rounded-full md:rounded-lg text-[13px] md:text-[12px] whitespace-nowrap transition shrink-0 inline-flex items-center gap-1 ${
                      active
                        ? 'bg-indigo-50 text-indigo-700 font-bold ring-1 ring-indigo-200/80'
                        : 'text-slate-600 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    {tab.alert && !active && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
              {specialTray !== null && (
                <button
                  type="button"
                  onClick={() => setSpecialTray(null)}
                  className="px-2 py-1 rounded-lg text-[12px] whitespace-nowrap shrink-0 bg-indigo-50 text-indigo-700 font-bold inline-flex items-center gap-1"
                >
                  <span>
                    {specialTray === 'interno'
                      ? `Equipo (${counts.interno})`
                      : specialTray === 'spam'
                      ? `Spam (${counts.spam})`
                      : `Tickets (${counts.tickets})`}
                  </span>
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Row 2: Estados de atención combinables (solo desktop; móvil usa 1 fila aireada) */}
            <div className="hidden md:flex items-center gap-1 flex-wrap">
              {(
                [
                  { id: 'unopened' as CircleStateFilter, label: `Sin abrir (${contextCounts.unopened})`, count: contextCounts.unopened, primary: true },
                  { id: 'unread' as CircleStateFilter, label: `No leídos (${contextCounts.unread})`, count: contextCounts.unread },
                  { id: 'waiting' as CircleStateFilter, label: `Sin contestar (${contextCounts.waiting})`, count: contextCounts.waiting },
                ]
              ).map((st) => {
                const active = stateFilters.includes(st.id);
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      if (leadSubFilter === 'sin_responder') setLeadSubFilter('activos');
                      setStateFilters((prev) => toggleStateFilterSelection(prev, st.id));
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[11.5px] whitespace-nowrap transition inline-flex items-center gap-1 ${
                      active
                        ? st.primary
                          ? 'bg-indigo-600 text-white font-semibold shadow-2xs'
                          : 'bg-slate-800 text-white font-semibold shadow-2xs'
                        : st.primary && st.count > 0
                        ? 'bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100/70 font-medium'
                        : 'text-slate-500 hover:bg-slate-100/80 font-medium'
                    }`}
                  >
                    {st.primary && st.count > 0 && !active && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />
                    )}
                    <span>{st.label}</span>
                  </button>
                );
              })}

              {stateFilters.includes('replied') && (
                <button
                  type="button"
                  onClick={() => setStateFilters((prev) => prev.filter((f) => f !== 'replied'))}
                  className="px-2 py-0.5 rounded-lg text-[11.5px] whitespace-nowrap bg-emerald-600 text-white font-semibold inline-flex items-center gap-1"
                >
                  <span>Respondidos ({contextCounts.replied})</span>
                  <X className="w-3 h-3" />
                </button>
              )}

              {(selectedBuckets.length > 0 ||
                stateFilters.length > 0 ||
                ownerFilter !== 'all' ||
                channelFilter !== 'all' ||
                specialTray !== null) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBuckets([]);
                    setStateFilters([]);
                    setSpecialTray(null);
                    setOwnerFilter('all');
                    setChannelFilter('all');
                    setLeadSubFilter('activos');
                  }}
                  className="ml-auto px-1.5 py-0.5 text-[11.5px] font-medium text-slate-400 hover:text-indigo-600 transition whitespace-nowrap"
                >
                  Limpiar
                </button>
              )}
            </div>

            {(singleBucket === 'reactivados' || singleBucket === 'lead') && (
              <div className="pt-1 border-t border-slate-100 space-y-1.5">
                {singleBucket === 'reactivados' && counts.reactivatedTotal > 0 && (
                  <div className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 text-[11.5px] text-slate-600">
                    <div className="min-w-0 truncate">
                      <span>
                        Respondieron: <b className="text-slate-900">{counts.reactivatedReplied}/{counts.reactivatedTotal}</b>{' '}
                        <span className="text-indigo-600 font-semibold">
                          ({Math.round((counts.reactivatedReplied / Math.max(1, counts.reactivatedTotal)) * 100)}%)
                        </span>
                      </span>
                      {leadSubCounts.sinResponder > 0 && (
                        <span className="text-slate-500">
                          {' '}·{' '}
                          {leadSubCounts.readyForResend48h > 0
                            ? `${leadSubCounts.readyForResend48h} listos (+48h)`
                            : `Reenvío en ~${leadSubCounts.minHoursUntil48h}h`}
                        </span>
                      )}
                    </div>
                    {leadSubCounts.sinResponder > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setLeadSubFilter('sin_responder');
                          setShowResendReactivationModal(true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold shrink-0 transition"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Reenviar / Flyer</span>
                      </button>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1 flex-wrap">
                  {(
                    [
                      {
                        id: 'activos' as LeadStageSubFilter,
                        label: singleBucket === 'reactivados' ? `Interesados (${leadSubCounts.activos})` : `Activos (${leadSubCounts.activos})`,
                        show: true,
                      },
                      {
                        id: 'sin_responder' as LeadStageSubFilter,
                        label: `Sin responder (${leadSubCounts.sinResponder})`,
                        show: singleBucket === 'reactivados',
                      },
                      { id: 'conversando' as LeadStageSubFilter, label: `Seguimiento / Demo (${leadSubCounts.conversando})`, show: true },
                      { id: 'perdidos' as LeadStageSubFilter, label: `Perdidos (${leadSubCounts.perdidos})`, show: true },
                      { id: 'erroneos' as LeadStageSubFilter, label: `Erróneos (${leadSubCounts.erroneos})`, show: true },
                      { id: 'todos' as LeadStageSubFilter, label: `Todos (${leadSubCounts.todos})`, show: true },
                    ]
                  )
                    .filter((sf) => sf.show)
                    .map((sf) => {
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

          <div className="flex-1 lg:overflow-y-auto divide-y divide-slate-100" onScroll={handleCirclesScroll}>
            {loading && circles.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-slate-400 font-medium">Cargando chats…</div>
            ) : filteredCircles.length === 0 ? (
              <div className="p-8 text-center space-y-2.5">
                <p className="text-[13px] text-slate-400 font-medium">No hay conversaciones con estos filtros.</p>
                {(searchQuery ||
                  selectedBuckets.length > 0 ||
                  stateFilters.length > 0 ||
                  specialTray !== null ||
                  ownerFilter !== 'all' ||
                  channelFilter !== 'all' ||
                  (singleBucket !== null && leadSubFilter !== 'todos')) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedBuckets([]);
                      setStateFilters([]);
                      setSpecialTray(null);
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
              visibleCircles.map((circle) => (
                <CircleListRow
                  key={circle.circleId}
                  circle={circle}
                  isSelected={activeCircle?.circleId === circle.circleId}
                  unread={isUnread(circle)}
                  onSelect={handleSelectCircle}
                />
              ))
            )}
          </div>
        </aside>

        {/* ── Resizer (Desktop only, hidden when left list is collapsed) ── */}
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
          className={`hidden ${leftListCollapsed ? 'lg:hidden' : 'lg:flex'} w-1.5 shrink-0 cursor-col-resize relative group transition-colors items-center justify-center z-20 ${
            isResizingLeft ? 'bg-indigo-600' : 'bg-slate-200/80 hover:bg-indigo-500'
          }`}
        >
          <div className={`w-1 h-10 rounded-full transition-all ${isResizingLeft ? 'bg-white scale-y-125' : 'bg-slate-400/60 group-hover:bg-white'}`} />
        </div>

        {/* ── CENTER: chat ── */}
        {activeCircle ? (
          <main
            className={`flex-1 flex-col bg-[#F3F4F8] pt-[60px] pb-[76px] lg:pt-0 lg:pb-0 lg:overflow-hidden min-w-0 ${
              mobileChatOpen ? 'flex' : 'hidden lg:flex'
            }`}
          >
            {/* Chat header (Fixed 60px Mobile Native Header & 1-Bar Desktop Header) */}
            <div className="fixed top-0 left-0 right-0 lg:static z-30 h-[60px] md:h-auto bg-white border-b border-slate-200/70 px-3 sm:px-4 py-2 md:py-1.5 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                {/* Tablet / Mobile Back to List Button */}
                <button
                  type="button"
                  onClick={() => {
                    setMobileChatOpen(false);
                    window.scrollTo({ top: 0, behavior: 'auto' });
                  }}
                  title="Volver a la lista de conversaciones"
                  className="lg:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[13px] font-bold shrink-0 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Chats</span>
                  {counts.waiting > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[11px] font-bold">
                      {counts.waiting}
                    </span>
                  )}
                </button>

                {/* Desktop / Tablet Landscape: Toggle Left List for Fullscreen Chat */}
                <button
                  type="button"
                  onClick={() => setLeftListCollapsed((v) => !v)}
                  title={leftListCollapsed ? 'Mostrar lista de chats' : 'Ocultar lista para pantalla completa'}
                  className="hidden lg:inline-flex p-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200/80 transition shrink-0"
                >
                  {leftListCollapsed ? <PanelRightClose className="w-4 h-4 text-indigo-600" /> : <PanelRightOpen className="w-4 h-4" />}
                </button>

                <div className={`w-10 h-10 md:w-9 md:h-9 rounded-full font-bold text-[14px] md:text-[13px] flex items-center justify-center shrink-0 ${SCOPE_STYLE[activeCircle.scope].avatar}`}>
                  {activeCircle.isGroup ? <Users className="w-4.5 h-4.5 md:w-4 md:h-4" /> : initials(activeCircle.clientName)}
                </div>
                <div className="min-w-0 flex-1">
                  {/* Line 1: Name + essential status badges only (no duplicate Lead/Por tomar pill clutter) */}
                  <div className="flex items-center gap-1.5 whitespace-nowrap overflow-hidden">
                    <h3 className="text-[16px] md:text-[15px] font-bold text-slate-900 tracking-tight truncate max-w-[180px] sm:max-w-[240px] 2xl:max-w-[300px]">
                      {activeCircle.clientName}
                    </h3>
                    {activeCircle.scope !== 'lead' && (
                      <span className="hidden md:inline-flex">
                        <ScopeChip circle={activeCircle} compact />
                      </span>
                    )}
                    {activeCircle.isReactivation && (
                      <span
                        title={activeCircle.reactivationCampaign || 'Campaña de reactivación WhatsApp'}
                        className={`hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold border shrink-0 ${
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
                        className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-600 border border-rose-200/80 shrink-0"
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
                        className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 transition shrink-0"
                      >
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>Atendido</span>
                      </button>
                    )}
                    {activeCircle.scope === 'soporte' && (
                      <button
                        type="button"
                        onClick={() => {
                          setRootCauseMarkAttended(activeCircle.unreadOrWaitingReply);
                          setShowRootCausePopover((v) => !v);
                        }}
                        title="Clasificar Causa Raíz o escalar Bug de sistema a Jimmy"
                        className={`hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold border transition shrink-0 ${
                          latestActiveRootCause && !latestActiveRootCause.dev_resolved_at
                            ? SUPPORT_ROOT_CAUSE_META[latestActiveRootCause.type].badgeClass
                            : 'bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border-slate-200/80'
                        }`}
                      >
                        <Bug className="w-2.5 h-2.5" />
                        <span>
                          {latestActiveRootCause && !latestActiveRootCause.dev_resolved_at
                            ? SUPPORT_ROOT_CAUSE_META[latestActiveRootCause.type].shortLabel
                            : 'Causa'}
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleMarkCircleUnread(activeCircle)}
                      title="Devolver conversación a No leído (Nuevo / Sin contestar)"
                      className={`hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold border transition shrink-0 ${
                        isUnread(activeCircle)
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : 'bg-slate-100/90 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border-slate-200/80'
                      }`}
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span className="hidden sm:inline">No leído</span>
                    </button>
                  </div>

                  {/* Line 2: Phone, PushName, Owner & Groups inline on a single truncated row */}
                  <div className="flex items-center gap-1.5 text-[13px] md:text-[12px] font-medium text-slate-400 whitespace-nowrap overflow-hidden mt-0.5">
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
                      {activeCircle.scope === 'lead' || activeCircle.scope === 'por_clasificar'
                        ? ` · Vendedor: ${activeCircle.leadOwnerName || 'Sin asignar'}`
                        : ''}
                    </span>
                    {!activeCircle.isGroup && activeCircle.memberOfGroups.length > 0 && (
                      <div className="hidden sm:inline-flex items-center gap-1 shrink-0">
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
                {/* Mobile Single ⋮ Action Sheet Trigger */}
                <button
                  type="button"
                  onClick={() => setShowMobileActionsSheet(true)}
                  title="Acciones rápidas en móvil"
                  className="md:hidden w-10 h-10 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 flex items-center justify-center transition"
                >
                  <MoreVertical className="w-4.5 h-4.5" />
                </button>

                {/* Support area selector + ticket status + quick tech assignment (Desktop/Tablet) */}
                {activeCircle.scope === 'soporte' && activeCircle.isWhatsApp && (() => {
                  const isTechTicket = isSupportTicket(activeCircle.activeTicket);
                  const isClosed = ['resolved', 'closed'].includes(activeCircle.activeTicket.status);
                  return (
                    <div className="hidden md:flex items-center gap-1.5">
                      {isTechTicket ? (
                        <span
                          title="Ticket técnico activo en Service Hub"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80"
                        >
                          <TicketIcon className="w-3.5 h-3.5" />
                          Ticket #{activeCircle.activeTicket.id.slice(0, 8).toUpperCase()}
                        </span>
                      ) : (
                        <>
                          <span
                            title="Conversación de saludo o consulta general (no genera ticket técnico)"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200/80"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                            Solo Chat
                          </span>
                          <button
                            type="button"
                            disabled={togglingTechTicket}
                            onClick={() => setShowCreateTicketModal(true)}
                            title="Convertir esta conversación en Ticket Técnico formal"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 transition disabled:opacity-50"
                          >
                            <TicketIcon className="w-3.5 h-3.5" />
                            Crear Ticket Técnico
                          </button>
                          {!isClosed && (
                            <button
                              type="button"
                              disabled={togglingTechTicket}
                              onClick={() => handleToggleTechnicalTicket(false, { closeChat: true })}
                              title="Marcar saludo o consulta como atendida sin llenar formulario de ticket"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 transition disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Atendido
                            </button>
                          )}
                        </>
                      )}
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
                    </div>
                  );
                })()}

                {/* Commercial Lead & Quote controls (Clean 1-button Stage selector + Actions) */}
                {!activeCircle.isGroup &&
                  activeCircle.isWhatsApp &&
                  (activeCircle.scope === 'lead' || activeCircle.scope === 'por_clasificar') &&
                  (scopes.all || scopes.leads) && (
                    <>
                      {/* Single Clean Custom Dropdown for Lead Stage (Desktop/Tablet; mobile uses ⋮ sheet) */}
                      <div className="relative hidden md:block">
                        <button
                          type="button"
                          onClick={() => {
                            setShowStagePopover((v) => !v);
                            setShowDiscoveryPopover(false);
                            setShowCalendarPopover(false);
                            setShowQuotesPopover(false);
                          }}
                          title="Cambiar etapa del Lead (1 clic)"
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[12.5px] font-semibold border transition ${
                            showStagePopover
                              ? 'bg-white text-slate-900 border-indigo-300 shadow-2xs'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200/80'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              activeCircle.leadStatus === 'Cerrado'
                                ? 'bg-emerald-500'
                                : activeCircle.leadStatus === 'En seguimiento' ||
                                  activeCircle.leadStatus === 'Negociación' ||
                                  activeCircle.leadStatus === 'Lead calificado'
                                ? 'bg-indigo-500'
                                : activeCircle.leadStatus === 'Perdido' || activeCircle.leadStatus === 'Erróneo'
                                ? 'bg-rose-500'
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

                      {/* Diagnóstico Express + Método ARIAS (Desktop/Landscape Header; on narrow Tablet moves to bottom touch bar) */}
                      <div className="relative hidden md:block">
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
                      <div className="relative hidden md:block">
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
                        className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[12.5px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition disabled:opacity-50"
                      >
                        {creatingQuote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Receipt className="w-3.5 h-3.5" />}
                        <span>Cotizar</span>
                      </button>

                      {/* Existing quotes dropdown with 1-click send to WhatsApp */}
                      {leadQuotes.length > 0 && (
                        <div className="relative hidden md:block">
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
                                            composerRef.current?.setDraft(
                                              buildQuoteWhatsAppText(q, activeCircle.clientName, true),
                                              'whatsapp',
                                            );
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

                {/* Unified More Options Popover (Desktop/Tablet; mobile uses ⋮ sheet) */}
                {(canClassify || activeCircle.leadId) && (
                  <div className="relative hidden md:block">
                    <button
                      type="button"
                      onClick={() => setShowReclassifyMenu((v) => !v)}
                      title="Más opciones, vendedor y clasificación"
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 transition"
                    >
                      <MoreHorizontal className="w-4 h-4 text-slate-500" />
                    </button>
                    {showReclassifyMenu && (
                      <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 p-2 space-y-1">
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

                        {scopes.all && (activeCircle.scope === 'lead' || activeCircle.scope === 'por_clasificar') && (
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
                                { t: 'por_clasificar', label: 'Deshacer (Por clasificar)', icon: HelpCircle, show: scopes.all && activeCircle.scope !== 'por_clasificar' },
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
                    className={`hidden md:flex w-9 h-8 rounded-xl items-center justify-center border transition ${
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

            {/* Compact, non-intrusive bar ONLY for genuinely unknown numbers (not existing leads) */}
            {activeCircle.scope === 'por_clasificar' && !activeCircle.leadId && !activeCircle.isReactivation && canClassify && (
              <div className="bg-slate-50 border-b border-slate-200/80 px-4 py-1.5 flex items-center justify-between gap-2 flex-wrap shrink-0">
                <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Contacto nuevo sin clasificar:</span>
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    disabled={classifying}
                    onClick={() => classify('lead')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    {classifying ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
                    <span>Tomar Lead</span>
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
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer focus:outline-none disabled:opacity-50"
                    >
                      <option value="" disabled>
                        Asignar a vendedor...
                      </option>
                      {agents.map((ag) => (
                        <option key={ag.id} value={ag.id}>
                          {ag.full_name || ag.email}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    disabled={classifying}
                    onClick={() => setShowClientPicker(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
                  >
                    <Building2 className="w-3 h-3 text-slate-500" />
                    <span>Es cliente</span>
                  </button>
                </div>
              </div>
            )}

            {/* Sales Lead AI Qualifier Control Strip */}
            {!activeCircle.isGroup &&
              activeCircle.scope === 'lead' &&
              Boolean((activeCircle.activeTicket?.metadata as any)?.ai_qualifier_enrolled) && (() => {
                const qMeta = (activeCircle.activeTicket?.metadata || {}) as Record<string, any>;
                const isQActive = qMeta.ai_qualifier_active === true;
                const qStatus = String(qMeta.ai_qualifier_status || (isQActive ? 'active' : 'paused'));
                return (
                  <div
                    className={`hidden md:flex px-4 py-1.5 border-b items-center justify-between gap-2 flex-wrap shrink-0 text-xs ${
                      qStatus === 'handed_off'
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : isQActive
                        ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900'
                        : 'bg-slate-100/80 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Bot className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-bold truncate">
                        {qStatus === 'handed_off'
                          ? 'Lead solicitó hablar con un asesor humano'
                          : qStatus === 'demo_booked'
                          ? 'Demo agendada automáticamente por IA'
                          : qStatus === 'human_takeover'
                          ? 'Asesor humano tomó control (IA pausada)'
                          : isQActive
                          ? 'Calificador IA Activo (si respondes tú, se pausa solo)'
                          : 'Calificador IA Pausado en esta conversación'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={togglingQualifier}
                        onClick={() => handleToggleThreadQualifier(!isQActive)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition disabled:opacity-50 ${
                          isQActive
                            ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                            : 'bg-[#4449AA] text-white hover:bg-[#383d8f]'
                        }`}
                      >
                        {togglingQualifier ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : isQActive ? (
                          <Pause className="w-3 h-3" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                        <span>{isQActive ? 'Pausar IA aquí' : 'Reactivar IA aquí'}</span>
                      </button>
                      {isRealAdmin && (
                        <button
                          type="button"
                          onClick={() => navigate('/leads/calificador-ia')}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 text-[11px] font-semibold"
                        >
                          <Settings className="w-3 h-3" />
                          <span>Configurar</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

            {/* Messages */}
            <div
              onClick={(e) => {
                if (e.target === e.currentTarget) setSelectedMessageId(null);
              }}
              className="flex-1 lg:overflow-y-auto px-3 py-4 md:px-8 md:py-6 space-y-3"
            >
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
                    const isSelected = selectedMessageId === b.id && !isEditing;
                    const parsedStaff = parseQuotedReplyPrefix(b.text || '');
                    return (
                      <React.Fragment key={b.id}>
                        {daySep}
                        <div className="flex flex-col items-end group/msg">
                          <div className="flex justify-end items-start gap-1.5 w-full">
                            {!isEditing && (
                              <div className="hidden md:flex opacity-0 group-hover/msg:opacity-100 transition-opacity items-center gap-1 bg-white border border-slate-200/90 rounded-xl px-1.5 py-1 shadow-2xs self-center">
                                {canSend && parsedStaff.body && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReplyingToMessage({ id: b.id, senderName: b.senderName, text: parsedStaff.body });
                                      composerRef.current?.setDraft('', 'whatsapp');
                                    }}
                                    title="Responder citando este mensaje"
                                    className="p-1 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition"
                                  >
                                    <CornerUpLeft className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {canModifyComment(b) && (
                                  <>
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
                                  </>
                                )}
                              </div>
                            )}
                            <div
                              onClick={() => {
                                if (!isEditing) setSelectedMessageId((prev) => (prev === b.id ? null : b.id));
                              }}
                              className={`max-w-[85%] md:max-w-lg bg-[#DFE3FF] text-slate-900 rounded-2xl rounded-br-xs px-3.5 py-2.5 md:px-4 md:py-3 shadow-2xs transition cursor-pointer ${
                                isSelected ? 'ring-2 ring-indigo-400 ring-offset-1' : ''
                              }`}
                            >
                              <p className="text-[13px] md:text-[12.5px] font-semibold text-indigo-700/85 mb-0.5">{b.senderName}</p>
                              {renderMedia(b)}
                              {isEditing ? (
                                <div className="mt-1.5 space-y-2 min-w-0 w-full sm:min-w-[340px]" onClick={(e) => e.stopPropagation()}>
                                  <textarea
                                    rows={4}
                                    value={editingCommentText}
                                    onChange={(e) => setEditingCommentText(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-white border border-indigo-200 text-[13.5px] font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
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
                                <>
                                  {parsedStaff.quote && (
                                    <div className="mb-1.5 px-2.5 py-1.5 rounded-xl bg-white/60 border-l-2 border-indigo-600 text-slate-700">
                                      <p className="text-[11px] font-bold text-indigo-700 truncate">{parsedStaff.quote.author}</p>
                                      <p className="text-[11.5px] text-slate-600 line-clamp-2">{parsedStaff.quote.text}</p>
                                    </div>
                                  )}
                                  {parsedStaff.body && (
                                    <p className="text-[15.5px] md:text-[14.5px] font-normal text-slate-800 whitespace-pre-wrap leading-relaxed break-words">
                                      {parsedStaff.body}
                                    </p>
                                  )}
                                </>
                              )}
                              <div className="flex items-center justify-end gap-1 mt-1">
                                <span className="text-xs font-normal text-slate-500">{b.id.startsWith('temp-') ? 'enviando…' : fmtTime(b.createdAt)}</span>
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
                          {isSelected && (
                            <div className="mt-1.5 inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-2 py-1 shadow-md z-20">
                              {canSend && parsedStaff.body && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedMessageId(null);
                                    setReplyingToMessage({ id: b.id, senderName: b.senderName, text: parsedStaff.body });
                                    composerRef.current?.setDraft('', 'whatsapp');
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-xs font-semibold transition"
                                >
                                  <CornerUpLeft className="w-3.5 h-3.5" />
                                  <span>Responder</span>
                                </button>
                              )}
                              {canModifyComment(b) && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedMessageId(null);
                                      handleStartEditComment(b);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full hover:bg-amber-50 text-slate-700 hover:text-amber-700 text-xs font-semibold transition"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                    <span>Editar</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedMessageId(null);
                                      handleDeleteComment(b);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full hover:bg-rose-50 text-rose-600 text-xs font-semibold transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Borrar</span>
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  }
                  const isClientSelected = selectedMessageId === b.id;
                  const parsedClient = parseQuotedReplyPrefix(b.text || '');
                  return (
                    <React.Fragment key={b.id}>
                      {daySep}
                      <div className="flex flex-col items-start group/msg">
                        <div className="flex justify-start items-start gap-1.5 w-full">
                          <div
                            onClick={() => setSelectedMessageId((prev) => (prev === b.id ? null : b.id))}
                            className={`max-w-[85%] md:max-w-lg bg-white text-slate-900 rounded-2xl rounded-bl-xs px-3.5 py-2.5 md:px-4 md:py-3 shadow-2xs transition cursor-pointer ${
                              isClientSelected ? 'ring-2 ring-indigo-400 ring-offset-1' : ''
                            }`}
                          >
                            <p className="text-[13px] md:text-[12.5px] font-semibold text-indigo-600 mb-0.5">{b.senderName}</p>
                            {renderMedia(b)}
                            {parsedClient.quote && (
                              <div className="mb-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 border-l-2 border-indigo-500 text-slate-600">
                                <p className="text-[11px] font-bold text-indigo-600 truncate">{parsedClient.quote.author}</p>
                                <p className="text-[11.5px] text-slate-500 line-clamp-2">{parsedClient.quote.text}</p>
                              </div>
                            )}
                            {parsedClient.body && (
                              <p className="text-[15.5px] md:text-[14.5px] font-normal text-slate-800 whitespace-pre-wrap leading-relaxed break-words">
                                {parsedClient.body}
                              </p>
                            )}
                            {b.transcript && (
                              <p className="mt-1.5 text-[13px] text-slate-600 bg-slate-50 rounded-lg px-2.5 py-1.5 italic">
                                <Mic className="w-3.5 h-3.5 inline mr-1 text-indigo-500" />
                                {b.transcript}
                              </p>
                            )}
                            <div className="flex items-center justify-end mt-1">
                              <span className="text-xs font-normal text-slate-400">{fmtTime(b.createdAt)}</span>
                            </div>
                          </div>
                          {canSend && (parsedClient.body || b.transcript) && (
                            <div className="hidden md:flex opacity-0 group-hover/msg:opacity-100 transition-opacity items-center bg-white border border-slate-200/90 rounded-xl px-1.5 py-1 shadow-2xs self-center">
                              <button
                                type="button"
                                onClick={() => {
                                  const replySnippet = parsedClient.body || b.transcript || '';
                                  setReplyingToMessage({ id: b.id, senderName: b.senderName, text: replySnippet });
                                  composerRef.current?.setDraft('', 'whatsapp');
                                }}
                                title="Responder citando este mensaje"
                                className="p-1 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition"
                              >
                                <CornerUpLeft className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                        {isClientSelected && canSend && (parsedClient.body || b.transcript) && (
                          <div className="mt-1.5 inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-2 py-1 shadow-md z-20">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMessageId(null);
                                const replySnippet = parsedClient.body || b.transcript || '';
                                setReplyingToMessage({ id: b.id, senderName: b.senderName, text: replySnippet });
                                composerRef.current?.setDraft('', 'whatsapp');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-xs font-semibold transition"
                            >
                              <CornerUpLeft className="w-3.5 h-3.5" />
                              <span>Responder</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={messagesEndRef} className="scroll-mb-24 lg:scroll-mb-0" />
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
                      composerRef.current?.setDraft(
                        buildQuoteWhatsAppText(pendingQuote, activeCircle.clientName, true),
                        'whatsapp',
                      );
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

            {/* Regla 6+ mensajes: aviso automático para frenar chats de 30-40 mensajes */}
            {activeCircle.scope === 'soporte' &&
              activeChatMsgs24h >= 8 &&
              !dismissedPingPongCircleMap[activeCircle.circleId] && (
                <div className="bg-amber-50/90 border-t border-amber-200 px-4 py-1.5 flex items-center justify-between gap-2 text-xs shrink-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="font-semibold text-amber-950 truncate">
                      {activeChatMsgs24h} mensajes en 24h (Regla 6+): si no se resuelve rápido, llamada/AnyDesk 5 min o escala Bug a Jimmy.
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setRootCauseType('system_bug');
                        setRootCauseMarkAttended(activeCircle.unreadOrWaitingReply);
                        setShowRootCausePopover(true);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] transition"
                    >
                      Escalar Bug
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDismissedPingPongCircleMap((prev) => ({
                          ...prev,
                          [activeCircle.circleId]: true,
                        }))
                      }
                      title="Ocultar aviso en este chat"
                      className="p-0.5 rounded text-amber-700/70 hover:text-amber-950"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

            {/* Modal limpio de Causa Raíz (1 clic para escalar Bug/Parche a Jimmy) */}
            {showRootCausePopover && activeCircle.scope === 'soporte' && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-[1px] p-4"
                onClick={() => setShowRootCausePopover(false)}
              >
                <div
                  className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 space-y-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bug className="w-4 h-4 text-rose-600" />
                      <h4 className="text-sm font-black text-slate-900">
                        Clasificar Causa Raíz · {activeCircle.clientName}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowRootCausePopover(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-1.5">
                    {(Object.keys(SUPPORT_ROOT_CAUSE_META) as SupportRootCauseType[]).map((key) => {
                      const rcMeta = SUPPORT_ROOT_CAUSE_META[key];
                      const selected = rootCauseType === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setRootCauseType(key)}
                          className={`w-full text-left px-3 py-2 rounded-xl border text-xs transition ${
                            selected
                              ? `${rcMeta.activeClass} font-bold shadow-2xs`
                              : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800 font-semibold'
                          }`}
                        >
                          <div>{rcMeta.label}</div>
                          <div
                            className={`text-[10.5px] font-normal mt-0.5 ${
                              selected ? 'text-white/90' : 'text-slate-500'
                            }`}
                          >
                            {rcMeta.hint}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <input
                    type="text"
                    value={rootCauseNote}
                    onChange={(e) => setRootCauseNote(e.target.value)}
                    placeholder="Nota corta (ej: Error al anular CCF, falta stock...)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />

                  {activeCircle.unreadOrWaitingReply && (
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rootCauseMarkAttended}
                        onChange={(e) => setRootCauseMarkAttended(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600"
                      />
                      <span>También marcar conversación como Atendido</span>
                    </label>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowRootCausePopover(false)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={savingRootCause}
                      onClick={handleSaveRootCauseTag}
                      className="px-4 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition"
                    >
                      {savingRootCause ? 'Guardando...' : 'Guardar Causa'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Single-Row Clean Composer (Fixed bottom flush on mobile, static on desktop) */}
            <div className="fixed bottom-0 left-0 right-0 lg:static z-30 shrink-0">
              <ChatComposer
                ref={composerRef}
                canSend={Boolean(canSend)}
                scope={activeCircle.scope}
                sendingMessage={sendingMessage}
                uploadingFile={uploadingFile}
                activeQuickReplies={activeQuickReplies}
                replyingTo={replyingToMessage}
                onCancelReply={() => setReplyingToMessage(null)}
                onSendWhatsApp={handleSendReply}
                onSaveInternalNote={handleSaveInternalNote}
                onUploadAttachment={handleUploadAttachment}
                onOpenNewQuickReply={() => {
                  setEditingQuickReply(null);
                  setQuickReplyInitialScope(activeCircle.scope === 'lead' || activeCircle.scope === 'por_clasificar' ? 'ventas' : 'soporte');
                  setShowQuickReplyModal(true);
                }}
                onEditQuickReply={(q) => {
                  setQuickReplyInitialScope(q.scope);
                  setEditingQuickReply(q);
                  setShowQuickReplyModal(true);
                }}
                onNavigateTickets={() => navigate('/support/tickets')}
              />
            </div>
          </main>
        ) : (
          <main className="hidden lg:flex flex-1 items-center justify-center bg-[#F3F4F8] text-slate-400 text-sm font-bold">
            Selecciona un chat de la lista para verlo.
          </main>
        )}

        {/* ── RIGHT: ticket control (support only) ── */}
        {activeCircle && showRightPanel && activeCircle.scope === 'soporte' && (() => {
          const isTechTicket = isSupportTicket(activeCircle.activeTicket);
          const isClosedTicket = ['resolved', 'closed'].includes(activeCircle.activeTicket.status);
          return (
          <aside className="w-96 bg-white border-l border-slate-200/80 flex flex-col overflow-y-auto shrink-0">
            <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-[#EEF0FF]/70 to-white">
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider ${isTechTicket ? 'text-indigo-700' : 'text-slate-600'}`}>
                  {isTechTicket ? <FileText className="w-3.5 h-3.5 text-indigo-600" /> : <MessageSquare className="w-3.5 h-3.5 text-slate-500" />}
                  {isTechTicket ? 'Control del ticket' : 'Solo Chat (Sin Ticket)'}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    isClosedTicket
                      ? 'bg-emerald-100 text-emerald-800'
                      : !isTechTicket
                      ? 'bg-slate-100 text-slate-700'
                      : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {isClosedTicket ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" /> {isTechTicket ? 'Resuelto' : 'Atendido'}
                    </>
                  ) : !isTechTicket ? (
                    <>
                      <MessageSquare className="w-3 h-3" /> Conversación
                    </>
                  ) : (
                    <>
                      <Clock className="w-3 h-3" /> Abierto · <ActiveSessionTimer startedAt={chatSessionStartedAt} />
                    </>
                  )}
                </span>
              </div>
              <h4 className="text-sm font-black text-slate-900 mt-1">
                {isTechTicket
                  ? `Ticket #${activeCircle.activeTicket.id.slice(0, 8).toUpperCase()}`
                  : `Chat #${activeCircle.activeTicket.id.slice(0, 8).toUpperCase()}`}
              </h4>
              <p className="text-[11px] text-slate-500 font-medium line-clamp-2 mt-0.5">{stripEmojis(activeCircle.activeTicket.title)}</p>
            </div>

            <div className="p-4 space-y-4 flex-1">
              {!isTechTicket ? (
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      No genera ticket técnico automático
                    </p>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Este mensaje se detectó como saludo, cortesía o consulta sin problema técnico. No cuenta en <strong>Tickets</strong>, <strong>Atrasados</strong> ni <strong>IA QA</strong>. Si el cliente describe una falla luego, se promoverá automáticamente.
                    </p>
                  </div>
                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      disabled={togglingTechTicket}
                      onClick={() => setShowCreateTicketModal(true)}
                      className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-black shadow-sm transition inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <TicketIcon className="w-4 h-4" />
                      <span>{togglingTechTicket ? 'Procesando...' : 'Convertir en Ticket Técnico'}</span>
                    </button>
                    {!isClosedTicket && (
                      <button
                        type="button"
                        disabled={togglingTechTicket}
                        onClick={() => handleToggleTechnicalTicket(false, { closeChat: true })}
                        className="w-full py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Marcar como Atendido (Sin Ticket)</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
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

              {activeCircle.isWhatsApp && (
                <button
                  type="button"
                  disabled={togglingTechTicket}
                  onClick={() => handleToggleTechnicalTicket(false)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-[11px] font-bold transition inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                  <span>{togglingTechTicket ? 'Actualizando...' : 'Pasar a Solo Chat (No es ticket técnico)'}</span>
                </button>
              )}
                </>
              )}

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
          );
        })()}
      </div>

      {/* ── "Es cliente" picker ── */}
      <ClientPickerModal
        isOpen={showClientPicker}
        activeCircle={activeCircle}
        query={clientPickerQuery}
        onQueryChange={setClientPickerQuery}
        options={pickerOptions}
        classifying={classifying}
        onClassifyClient={(extra) => classify('cliente', extra)}
        onClose={() => setShowClientPicker(false)}
      />

      {/* ── WhatsApp connection status (admin) ── */}
      <BridgeStatusModal
        isOpen={showStatusModal}
        bridgeStatus={bridgeStatus}
        onClose={() => setShowStatusModal(false)}
        onRefresh={refreshBridgeStatus}
        onReconnect={handleReconnectBridge}
        reconnecting={reconnectingBridge}
        isAdmin={isRealAdmin}
      />

      {/* ── AI prompts (admin) ── */}
      <AiPromptConfigModal
        isOpen={showAiPromptModal}
        onClose={() => setShowAiPromptModal(false)}
        openAiStatus={openAiStatus}
        onTestOpenAi={() => verifyAndLoadAiConfig(true)}
        aiAutoReplyText={aiAutoReplyText}
        onChangeAiAutoReplyText={setAiAutoReplyText}
        aiAutoReplyAudio={aiAutoReplyAudio}
        onChangeAiAutoReplyAudio={setAiAutoReplyAudio}
        activePromptTab={activePromptTab}
        onChangeActivePromptTab={setActivePromptTab}
        aiPrompts={aiPrompts}
        onChangeAiPrompt={(tab, value) => setAiPrompts((prev) => ({ ...prev, [tab]: value }))}
        autoReplyResolvedEnabled={autoReplyResolvedEnabled}
        onChangeAutoReplyResolvedEnabled={setAutoReplyResolvedEnabled}
        autoResolvedMarkLost={autoResolvedMarkLost}
        onChangeAutoResolvedMarkLost={setAutoResolvedMarkLost}
        resolvedReplyTemplate={resolvedReplyTemplate}
        onChangeResolvedReplyTemplate={setResolvedReplyTemplate}
        resolvedTriggerPhrasesText={resolvedTriggerPhrasesText}
        onChangeResolvedTriggerPhrasesText={setResolvedTriggerPhrasesText}
        parsedResolvedTriggerPhrases={parsedResolvedTriggerPhrases}
        showTriggerPhrasesEditor={showTriggerPhrasesEditor}
        onToggleTriggerPhrasesEditor={() => setShowTriggerPhrasesEditor((v) => !v)}
        pendingResolvedCircles={pendingResolvedCircles}
        selectedPendingResolvedIds={selectedPendingResolvedIds}
        onToggleAllPendingResolved={() =>
          setSelectedPendingResolvedIds((prev) =>
            prev.length === pendingResolvedCircles.length ? [] : pendingResolvedCircles.map((c) => c.circleId),
          )
        }
        onTogglePendingResolvedId={(circleId, checked) =>
          setSelectedPendingResolvedIds((prev) => (checked ? [...prev, circleId] : prev.filter((id) => id !== circleId)))
        }
        sendingBatchResolved={sendingBatchResolved}
        batchResolvedProgress={batchResolvedProgress}
        onSendBatchResolvedReplies={handleSendBatchResolvedReplies}
        savingAiConfig={savingAiConfig}
        onSaveConfig={async () => {
          setSavingAiConfig(true);
          try {
            await invoke({
              action: 'save_ai_config',
              company_id: activeCompanyId,
              auto_reply_text: aiAutoReplyText,
              auto_reply_audio: aiAutoReplyAudio,
              auto_reply_resolved_enabled: autoReplyResolvedEnabled,
              auto_resolved_mark_lost: autoResolvedMarkLost,
              resolved_reply_template: resolvedReplyTemplate.trim() || DEFAULT_RESOLVED_REPLY_TEMPLATE,
              resolved_trigger_phrases: parsedResolvedTriggerPhrases,
              prompts: {
                soporte: aiPrompts.soporte.trim(),
                contabilidad: aiPrompts.contabilidad.trim(),
                ventas: aiPrompts.ventas.trim(),
                otros: aiPrompts.otros.trim(),
              },
            });
            if (activeCompanyId) {
              try {
                localStorage.setItem(
                  `crm_wa_ai_cfg_${activeCompanyId}`,
                  JSON.stringify({
                    auto_reply_text: aiAutoReplyText,
                    auto_reply_audio: aiAutoReplyAudio,
                    auto_reply_resolved_enabled: autoReplyResolvedEnabled,
                    auto_resolved_mark_lost: autoResolvedMarkLost,
                    resolved_reply_template: resolvedReplyTemplate.trim() || DEFAULT_RESOLVED_REPLY_TEMPLATE,
                    resolved_trigger_phrases: parsedResolvedTriggerPhrases,
                    prompts: {
                      soporte: aiPrompts.soporte.trim(),
                      contabilidad: aiPrompts.contabilidad.trim(),
                      ventas: aiPrompts.ventas.trim(),
                      otros: aiPrompts.otros.trim(),
                    },
                  }),
                );
              } catch {
                // ignore quota errors
              }
            }
            toast.success('Configuración guardada');
            setShowAiPromptModal(false);
          } catch (e: any) {
            toast.error(e?.message || 'Error al guardar configuración IA');
          } finally {
            setSavingAiConfig(false);
          }
        }}
      />

      {/* ── Customizable Quick Replies Modal (SaaS Multi-Industry) ── */}
      <QuickReplyManagerModal
        isOpen={showQuickReplyModal}
        onClose={() => setShowQuickReplyModal(false)}
        quickReplies={customQuickReplies}
        onSaveQuickReplies={saveCustomQuickReplies}
        initialScope={quickReplyInitialScope}
        initialEditingReply={editingQuickReply}
      />

      {/* ── Team WhatsApp Access & Role Control Modal (Admin) ── */}
      <TeamWaAccessModal
        isOpen={showTeamAccessModal}
        onClose={() => setShowTeamAccessModal(false)}
        adminPreviewMode={adminPreviewMode}
        onChangeAdminPreviewMode={(mode, nextFilter) => {
          setAdminPreviewMode(mode);
          setSpecialTray(null);
          setStateFilters([]);
          setSelectedBuckets(
            nextFilter === 'soporte' || nextFilter === 'por_clasificar' ? [nextFilter] : [],
          );
        }}
        loadingTeamAccess={loadingTeamAccess}
        teamAccessList={teamAccessList}
        savingUserAccessId={savingUserAccessId}
        onChangeUserWaAccess={handleChangeUserWaAccess}
      />

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

      {/* Modal estructurado para convertir chat de WhatsApp en Ticket Técnico formal */}
      {activeCircle && activeCompanyId && showCreateTicketModal && (
        <CreateTicketFromChatModal
          isOpen={showCreateTicketModal}
          onClose={() => setShowCreateTicketModal(false)}
          ticketId={activeCircle.activeTicket.id}
          clientName={activeCircle.clientName}
          companyId={activeCompanyId}
          currentUserId={profile?.id || ''}
          currentUserName={profile?.full_name || profile?.email || 'Equipo Soporte'}
          agents={agents}
          categories={categories}
          onCreated={() => {
            loadSupportData(true);
            loadThread(false);
          }}
        />
      )}

      {/* Resend Reactivation Modal (Touch 2 / Flyer / Video) exclusively for non-responding reactivated prospects */}
      {showResendReactivationModal && activeCompanyId && (
        <WhatsAppReactivationModal
          isOpen={showResendReactivationModal}
          onClose={() => setShowResendReactivationModal(false)}
          mode="resend"
          leadsPool={resendLeadsPool}
          touchInfoByLeadId={resendTouchInfoMap}
          companyId={activeCompanyId}
          currentUser={{
            id: profile?.id || '',
            full_name: profile?.full_name,
            email: profile?.email,
          }}
          defaultCampaignName="Reactivación · Toque 2"
          onCompleted={() => {
            loadSupportData(true);
            loadThread(false);
          }}
        />
      )}
      {/* Mobile-Only Bottom Sheet (Essential quick actions; advanced tools stay on Desktop/Tablet) */}
      {activeCircle && showMobileActionsSheet && (
        <div
          className="md:hidden fixed inset-0 z-[200] flex flex-col justify-end"
          onClick={() => setShowMobileActionsSheet(false)}
        >
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]" />
          <div
            className="relative bg-white rounded-t-3xl px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto" />
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="min-w-0 pr-2">
                <p className="text-[16.5px] font-bold text-slate-900 truncate">{activeCircle.clientName}</p>
                <p className="text-[13.5px] text-slate-500 truncate">
                  {activeCircle.isGroup ? 'Grupo de WhatsApp' : activeCircle.phone ? `+${activeCircle.phone}` : 'Chat WhatsApp'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileActionsSheet(false)}
                className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {!activeCircle.isGroup &&
              (activeCircle.scope === 'lead' || activeCircle.scope === 'por_clasificar') &&
              (scopes.all || scopes.leads) && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-slate-400">
                    <Tag className="w-3.5 h-3.5 text-amber-600" />
                    <span>Cambiar estado del Lead</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {LEAD_STATUS_OPTIONS.map((st) => {
                      const active = (activeCircle.leadStatus || 'Prospecto') === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => {
                            setShowMobileActionsSheet(false);
                            handleUpdateLeadStatus(st);
                          }}
                          className={`px-3.5 py-2 rounded-xl text-[14px] font-semibold border transition ${
                            active
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          {st}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            <div className="space-y-2">
              {activeCircle.scope === 'soporte' && activeCircle.isWhatsApp && !isSupportTicket(activeCircle.activeTicket) && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileActionsSheet(false);
                    setShowCreateTicketModal(true);
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200/80 text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                      <TicketIcon className="w-4.5 h-4.5" />
                    </span>
                    <div>
                      <p className="text-[15px] font-bold text-indigo-950">Crear Ticket Técnico (con IA)</p>
                      <p className="text-[13px] text-indigo-700">Módulo — Problema concreto</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4.5 h-4.5 text-indigo-500 shrink-0" />
                </button>
              )}

              {activeCircle.unreadOrWaitingReply ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileActionsSheet(false);
                    handleMarkCircleAttended(activeCircle);
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4.5 h-4.5" />
                    </span>
                    <div>
                      <p className="text-[15px] font-bold text-emerald-950">Marcar como Atendido</p>
                      <p className="text-[13px] text-emerald-700">Limpia la alerta de espera</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileActionsSheet(false);
                    handleMarkCircleUnread(activeCircle);
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                      <RotateCcw className="w-4.5 h-4.5" />
                    </span>
                    <div>
                      <p className="text-[15px] font-bold text-slate-900">Devolver a No leído</p>
                      <p className="text-[13px] text-slate-500">Para retomar después</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                </button>
              )}

              {!activeCircle.isGroup && activeCircle.phone && (
                <a
                  href={`tel:+${activeCircle.phone.replace(/\D/g, '')}`}
                  onClick={() => setShowMobileActionsSheet(false)}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                      <Phone className="w-4.5 h-4.5" />
                    </span>
                    <div>
                      <p className="text-[15px] font-bold text-slate-900">Llamar al contacto</p>
                      <p className="text-[13px] text-slate-500">+{activeCircle.phone}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                </a>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-100 text-[12.5px] text-slate-600 leading-snug">
              <strong>Cotizar, Diagnóstico, Agendar Meet, Ficha completa e IA</strong> están optimizados para <strong>Laptop / Desktop / Tablet</strong>.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportChatCircles;
