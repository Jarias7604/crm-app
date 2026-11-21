import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ExternalLink,
  Copy,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  MicOff,
  Bug,
  BookOpen,
  Flame,
  ShieldAlert,
  Ticket as TicketIcon,
  Target,
  Filter,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../auth/AuthProvider';
import {
  computeTicketAiTimeBenchmark,
  type Ticket,
  type TicketCategory,
  type CompanyAgent,
  type TicketLead,
} from '../../services/tickets';
import { TicketPanel } from './components/TicketPanel';
import { isSupportTicket, isWhatsappTicket } from '../../lib/whatsappScopes';
import {
  computeSupportWhatsAppPulse,
  buildExecutiveSupportOverview,
  buildSupportParetoAnalysis,
  classifySupportWorkBucket,
  normalizeSupportClientName,
  SUPPORT_ROOT_CAUSE_META,
  SUPPORT_OPERATING_RULES,
  SUPPORT_OPERATING_RULES_COPY_TEXT,
  markRootCauseDevResolvedPatch,
  type SupportPulseResult,
  type SupportErrorPatternKey,
  type SupportParetoMetric,
  type SupportParetoItem,
  type SupportWorkBucket,
  type PulseWaMessageInput,
  type PulseCommentInput,
  type PulseProfileInput,
} from './supportPulse';

interface ParetoChartRow extends SupportParetoItem {
  barValue: number;
}

const ParetoTooltipCard: React.FC<{
  active?: boolean;
  payload?: Array<{ payload?: ParetoChartRow }>;
  metric: SupportParetoMetric;
}> = ({ active, payload, metric }) => {
  const row = active && payload && payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="bg-white/95 backdrop-blur-xs border border-slate-200 rounded-xl shadow-lg px-3.5 py-2.5 text-xs max-w-xs space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold text-slate-900 leading-snug">{row.label}</p>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${row.isVitalFew80
            ? 'bg-rose-50 text-rose-700 border border-rose-200'
            : 'bg-slate-100 text-slate-600'
            }`}
        >
          {row.isVitalFew80 ? 'Prioridad 80%' : 'Resto 20%'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-600 pt-0.5">
        <span>
          Tiempo:{' '}
          <strong className={metric === 'hours' ? 'text-slate-900' : 'text-slate-700'}>
            {row.reactiveHours}h
          </strong>
        </span>
        <span>
          Clientes:{' '}
          <strong className={metric === 'clients' ? 'text-slate-900' : 'text-slate-700'}>
            {row.clientCount}
          </strong>
        </span>
        <span>
          Peso individual: <strong className="text-slate-900">{row.sharePct}%</strong>
        </span>
        <span>
          Acumulado: <strong className="text-indigo-700">{row.cumulativePct}%</strong>
        </span>
      </div>

      <p className="text-[10.5px] text-slate-400 pt-1 border-t border-slate-100">
        Clic en la barra para ver clientes y mensajes reales
      </p>
    </div>
  );
};

type HealthFilter = 'all' | 'critical' | 'open' | 'stable';

interface UnifiedSupportRecord {
  id: string;
  source: 'ticket' | 'task';
  rawTicket?: Ticket;
  title: string;
  description: string;
  clientName: string;
  isInternalSystemTask: boolean;
  techId: string;
  techName: string;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: string;
  resolvedAt: string | null;
  ticketCategoryCode: string;
  ticketCategoryName: string;
  ticketCategoryColor: string;
  workBucket: SupportWorkBucket;
  workBucketLabel: string;
  reclassifiedFromP4: boolean;
  reportedHours: number;
  expectedAiHours: number;
  maxReasonableAiHours: number;
  diffAiHours: number;
  aiTimeStatus: 'missing_time' | 'inflated' | 'fair' | 'fast';
  aiTimeVerdictLabel: string;
  categoryKey: string;
  categoryLabel: string;
  findings: string;
  rootCause: string;
  solution: string;
  isRepeatForSameClient: boolean;
  repeatSequenceNumber: number;
  isWhatsapp: boolean;
}

function inferClientAndScope(
  leadName?: string | null,
  projectName?: string | null,
  title?: string,
  description?: string,
  categoryCode?: string,
  knownLeads: string[] = [],
): { clientName: string; isInternalSystemTask: boolean } {
  const combined = `${title || ''} ${description || ''} ${projectName || ''} ${leadName || ''}`;

  if (/arg[oó]z|argos/i.test(combined)) {
    return { clientName: 'Corporación Argoz', isInternalSystemTask: false };
  }

  if (leadName && leadName.trim().length > 1 && !/general|interno|sin cliente/i.test(leadName)) {
    return {
      clientName: normalizeSupportClientName(leadName),
      isInternalSystemTask: false,
    };
  }

  if (title) {
    const colonPrefixMatch = title.match(
      /^(?:soporte\s+t[eé]cnico|error\s+reportado|capacitaci[oó]n(?:\s+presencial|\s+virtual)?|pregunta\s+frecuente|implementaci[oó]n|go\s*live|solicitud(?:\s+de\s+cliente)?|configuraci[oó]n|migraci[oó]n|revisi[oó]n|dte|facturaci[oó]n)\s*:\s*([^-\n(|]+)/i,
    );
    if (colonPrefixMatch?.[1]) {
      const extracted = colonPrefixMatch[1].trim();
      if (extracted.length >= 2 && !/^(general|interno|sistema|error|prueba)$/i.test(extracted)) {
        return { clientName: normalizeSupportClientName(extracted), isInternalSystemTask: false };
      }
    }

    const waMatch = title.match(/\[WhatsApp[^\]]*\]\s*([^:(]+?)(?:\s*\(\+?\d+\))?\s*:/i);
    if (waMatch?.[1] && waMatch[1].trim().length > 2) {
      return {
        clientName: normalizeSupportClientName(waMatch[1]),
        isInternalSystemTask: false,
      };
    }
  }

  if (
    projectName &&
    projectName.trim().length > 1 &&
    !/^(general|interno|soporte|crm|tareas)$/i.test(projectName.trim())
  ) {
    return {
      clientName: normalizeSupportClientName(projectName),
      isInternalSystemTask: false,
    };
  }

  for (const lead of knownLeads) {
    if (lead && lead.length >= 4 && combined.toLowerCase().includes(lead.toLowerCase())) {
      return { clientName: normalizeSupportClientName(lead), isInternalSystemTask: false };
    }
  }

  if (categoryCode === 'P5') return { clientName: 'Inmalux', isInternalSystemTask: false };

  return {
    clientName: 'Tareas Internas de Desarrollo (P4 / Sin cliente)',
    isInternalSystemTask: true,
  };
}

function detectCategoryCode(
  categoryName: string,
  title: string,
  description: string,
): { code: string; label: string; color: string } {
  const catLower = (categoryName || '').toLowerCase();
  const text = `${categoryName} ${title} ${description}`.toLowerCase();

  if (catLower.startsWith('p1') || /hacienda|dte|firmador|sello|contingencia/i.test(catLower)) {
    return { code: 'P1', label: 'P1 · Hacienda', color: '#EF4444' };
  }
  if (catLower.startsWith('p2') || /^error\s+reportado/i.test(title)) {
    return { code: 'P2', label: 'P2 · Errores', color: '#F97316' };
  }
  if (catLower.startsWith('p3') || /^soporte\s+t[eé]cnico/i.test(title)) {
    return { code: 'P3', label: 'P3 · Soporte', color: '#F59E0B' };
  }
  if (catLower.startsWith('p4') || catLower.startsWith('p6')) {
    return { code: 'P4', label: 'P4 · Mejoras', color: '#3B82F6' };
  }
  if (catLower.startsWith('p5') || /inmalux/i.test(text)) {
    return { code: 'P5', label: 'P5 · Inmalux', color: '#8B5CF6' };
  }
  if (/pegunta|pregunta\s+frecuente/i.test(text)) {
    return { code: 'FAQ', label: 'Preguntas', color: '#10B981' };
  }
  if (/hacienda|dte|factura\s+electr[oó]nica|invalidaci[oó]n|json/i.test(text)) {
    return { code: 'P1', label: 'P1 · Hacienda', color: '#EF4444' };
  }
  if (/error|falla|bug|no\s+deja|no\s+carga/i.test(text)) {
    return { code: 'P2', label: 'P2 · Errores', color: '#F97316' };
  }
  return { code: 'P3', label: 'P3 · Soporte', color: '#F59E0B' };
}

function classifyProblemTopic(
  title: string,
  description: string,
): { categoryKey: string; categoryLabel: string } {
  const text = `${title} ${description}`.toLowerCase();
  if (/dte|factura|hacienda|mh|invalidaci|ccf|firmador|sello|json/i.test(text)) {
    return { categoryKey: 'dte', categoryLabel: 'Facturación DTE' };
  }
  if (/go\s*live|capacitaci|implementaci/i.test(text)) {
    return { categoryKey: 'golive', categoryLabel: 'Implementación' };
  }
  if (/inventario|stock|kardex|reconciliaci/i.test(text)) {
    return { categoryKey: 'inv', categoryLabel: 'Inventario' };
  }
  if (/c[aá]lculo|iva|retenci|planilla|contab/i.test(text)) {
    return { categoryKey: 'calc', categoryLabel: 'Cálculos / Planilla' };
  }
  if (/reporte|pdf|excel|impresi|filtro/i.test(text)) {
    return { categoryKey: 'rep', categoryLabel: 'Reportes / PDF' };
  }
  return { categoryKey: 'soporte', categoryLabel: 'Soporte Sistema' };
}

function resolveSupportEngineerName(rawName: string, titleText: string): string {
  const combined = `${rawName} ${titleText}`.toLowerCase();
  if (combined.includes('melvin')) return 'Melvin Rodriguez';
  if (combined.includes('gerson')) return 'Gerson Gutierrez';
  return 'Sin asignar';
}

async function fetchChunkedSupportRows<T>(
  ticketIds: string[],
  chunkQueryFactory: (
    chunkIds: string[],
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: any }>,
  chunkSize = 60,
  pageSize = 1000,
  maxPagesPerChunk = 3,
): Promise<T[]> {
  if (ticketIds.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ticketIds.length; i += chunkSize) {
    chunks.push(ticketIds.slice(i, i + chunkSize));
  }
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const rowsAcc: T[] = [];
      for (let page = 0; page < maxPagesPerChunk; page++) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await chunkQueryFactory(chunk, from, to);
        if (error) {
          console.warn('[SupportIntelligence] chunked fetch warning:', error.message);
          break;
        }
        const rows = (data || []) as T[];
        rowsAcc.push(...rows);
        if (rows.length < pageSize) break;
      }
      return rowsAcc;
    }),
  );
  return results.flat();
}

export const SupportIntelligence: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const activeCompanyId = profile?.company_id;

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<UnifiedSupportRecord[]>([]);
  const [rawTicketsList, setRawTicketsList] = useState<Ticket[]>([]);
  const [rootCauseTicketsList, setRootCauseTicketsList] = useState<Ticket[]>([]);
  const [categoriesList, setCategoriesList] = useState<TicketCategory[]>([]);
  const [agentsList, setAgentsList] = useState<CompanyAgent[]>([]);
  const [leadsList, setLeadsList] = useState<TicketLead[]>([]);
  const [waMessagesList, setWaMessagesList] = useState<PulseWaMessageInput[]>([]);
  const [waCommentsList, setWaCommentsList] = useState<PulseCommentInput[]>([]);
  const [profilesPulseList, setProfilesPulseList] = useState<PulseProfileInput[]>([]);

  const [selectedTicketForDrawer, setSelectedTicketForDrawer] = useState<Ticket | null>(null);
  const [showRulesPanel, setShowRulesPanel] = useState<boolean>(false);
  const [resolvingEntryKey, setResolvingEntryKey] = useState<string | null>(null);

  // Unified filters & clean 3-tab navigation
  const [activeTab, setActiveTab] = useState<'resumen' | 'pareto' | 'clientes'>('resumen');
  const [selectedTechFilter, setSelectedTechFilter] = useState<string>('all');
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('all');
  const [paretoMetric, setParetoMetric] = useState<SupportParetoMetric>('hours');
  const [selectedPatternKey, setSelectedPatternKey] = useState<SupportErrorPatternKey | null>(null);
  const [tablePatternFilter, setTablePatternFilter] = useState<SupportErrorPatternKey | null>(null);
  const [daysRange, setDaysRange] = useState<number>(15);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedClientKey, setExpandedClientKey] = useState<string | null>(null);
  const [showInternalTasks, setShowInternalTasks] = useState<boolean>(false);

  useEffect(() => {
    if (activeCompanyId) {
      loadIntelligenceData();
    }
  }, [activeCompanyId, daysRange]);

  const loadIntelligenceData = async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysRange);
      const cutoffIso = cutoffDate.toISOString();

      const [profsRes, leadsRes, catsRes, ticketsRes, taggedTicketsRes, projectsRes] =
        await Promise.all([
          supabase
            .from('profiles')
            .select('id, full_name, email, role, avatar_url, phone')
            .eq('company_id', activeCompanyId),
          supabase
            .from('leads')
            .select('id, name, email, phone')
            .eq('company_id', activeCompanyId)
            .limit(400),
          supabase
            .from('ticket_categories')
            .select('*')
            .eq('company_id', activeCompanyId)
            .order('name'),
          supabase
            .from('tickets')
            .select('*')
            .eq('company_id', activeCompanyId)
            .or('metadata->>wa_scope.is.null,metadata->>wa_scope.eq.soporte')
            .gte('updated_at', cutoffIso)
            .order('updated_at', { ascending: false })
            .limit(1000),
          supabase
            .from('tickets')
            .select('*')
            .eq('company_id', activeCompanyId)
            .or('metadata->>wa_scope.is.null,metadata->>wa_scope.eq.soporte')
            .not('metadata->>wa_root_cause_last', 'is', null)
            .order('updated_at', { ascending: false })
            .limit(200),
          supabase.from('crm_projects').select('id, name').eq('company_id', activeCompanyId),
        ]);

      const profs = (profsRes.data || []) as (CompanyAgent & { phone?: string | null })[];
      const leads = (leadsRes.data || []) as TicketLead[];
      const cats = (catsRes.data || []) as TicketCategory[];
      const rawTickets = ((ticketsRes.data || []) as Ticket[]).filter((t) => isSupportTicket(t));
      const taggedTickets = ((taggedTicketsRes.data || []) as Ticket[]).filter((t) =>
        isSupportTicket(t),
      );
      const projects = projectsRes.data || [];

      const supportTicketIds = Array.from(
        new Set([...rawTickets.map((t) => t.id), ...taggedTickets.map((t) => t.id)]),
      );

      const [waMsgsRows, commentRows] = await Promise.all([
        fetchChunkedSupportRows<PulseWaMessageInput>(supportTicketIds, (chunkIds, from, to) =>
          supabase
            .from('whatsapp_messages')
            .select(
              'id, ticket_id, comment_id, from_me, sender_phone, sender_name, message_ts, message_type, body',
            )
            .eq('company_id', activeCompanyId)
            .in('ticket_id', chunkIds)
            .gte('message_ts', cutoffIso)
            .order('message_ts', { ascending: false })
            .range(from, to),
        ),
        fetchChunkedSupportRows<PulseCommentInput>(supportTicketIds, (chunkIds, from, to) =>
          supabase
            .from('ticket_comments')
            .select('id, ticket_id, author_id, body, is_internal, created_at')
            .eq('company_id', activeCompanyId)
            .eq('is_internal', false)
            .in('ticket_id', chunkIds)
            .gte('created_at', cutoffIso)
            .order('created_at', { ascending: false })
            .range(from, to),
        ),
      ]);

      setAgentsList(profs);
      setProfilesPulseList(
        profs.map((p) => ({
          id: p.id,
          full_name: p.full_name,
          email: p.email,
          phone: p.phone || null,
        })),
      );
      setLeadsList(leads);
      setCategoriesList(cats);
      setRawTicketsList(rawTickets);
      setRootCauseTicketsList(taggedTickets);
      setWaMessagesList(waMsgsRows);
      setWaCommentsList(commentRows);

      const profileMap = new Map<string, string>();
      profs.forEach((p: any) => profileMap.set(p.id, p.full_name || p.email || ''));

      const categoryMap = new Map<string, TicketCategory>();
      cats.forEach((c) => categoryMap.set(c.id, c));

      const projectMap = new Map<string, string>();
      projects.forEach((p: any) => projectMap.set(p.id, p.name));

      const knownLeadNames = leads.map((l) => l.name).filter(Boolean);

      let projectTasks: any[] = [];
      if (projects.length > 0) {
        const { data: cTasks } = await supabase
          .from('crm_tasks')
          .select('*')
          .in(
            'project_id',
            projects.map((p: any) => p.id),
          )
          .gte('created_at', cutoffIso)
          .order('created_at', { ascending: false })
          .limit(350);
        projectTasks = cTasks || [];
      }

      const unified: UnifiedSupportRecord[] = [];
      const seenIds = new Set<string>();

      rawTickets.forEach((t: any) => {
        seenIds.add(t.id);
        if (/^\s*jornada\s+(melvin|gerson)/i.test(t.title || '')) return;

        const isWa = isWhatsappTicket(t);
        const reportedHours = +(Number(t.actual_hours) || 0).toFixed(2);
        // Zero-hour WhatsApp wrapper tickets are already tracked accurately by computeSupportWhatsAppPulse
        if (isWa && reportedHours <= 0) return;

        const catObj = t.category_id ? categoryMap.get(t.category_id) : undefined;
        const catInfo = detectCategoryCode(catObj?.name || '', t.title || '', t.description || '');
        const rawAssigned = (t.assigned_to && profileMap.get(t.assigned_to)) || '';
        const techName = resolveSupportEngineerName(rawAssigned, t.title || '');
        const isClosedOrResolved = t.status === 'resolved' || t.status === 'closed';

        const { clientName, isInternalSystemTask } = inferClientAndScope(
          t.lead_name,
          null,
          t.title || '',
          t.description || '',
          catInfo.code,
          knownLeadNames,
        );

        const topic = classifyProblemTopic(t.title || '', t.description || '');
        const workInfo = classifySupportWorkBucket(t.title || '', t.description || '', catInfo.code);

        const aiAudit = computeTicketAiTimeBenchmark(
          t.title || '',
          t.description || '',
          catInfo.label,
          Number(t.estimated_hours) || 0,
          reportedHours,
        );

        unified.push({
          id: t.id,
          source: 'ticket',
          rawTicket: {
            ...t,
            category_name: catObj?.name || catInfo.label,
            category_color: catObj?.color || catInfo.color,
            agent_name: techName,
            lead_name: clientName,
          },
          title: t.title || 'Ticket de Soporte',
          description: t.description || '',
          clientName,
          isInternalSystemTask,
          techId: t.assigned_to || techName,
          techName,
          status: isClosedOrResolved ? 'resolved' : t.status === 'pending' ? 'pending' : 'open',
          priority: t.priority || 'medium',
          createdAt: t.created_at,
          resolvedAt: t.resolved_at,
          ticketCategoryCode: catInfo.code,
          ticketCategoryName: catInfo.label,
          ticketCategoryColor: catObj?.color || catInfo.color,
          workBucket: workInfo.bucket,
          workBucketLabel: workInfo.label,
          reclassifiedFromP4: workInfo.reclassifiedFromP4,
          reportedHours,
          expectedAiHours: aiAudit.expectedHours,
          maxReasonableAiHours: aiAudit.maxReasonableHours,
          diffAiHours: aiAudit.differenceHours,
          aiTimeStatus: aiAudit.status,
          aiTimeVerdictLabel: aiAudit.verdictLabel,
          categoryKey: topic.categoryKey,
          categoryLabel: topic.categoryLabel,
          findings: String(t.findings || '').trim(),
          rootCause: String(t.root_cause || '').trim(),
          solution: String(t.solution || '').trim(),
          isRepeatForSameClient: false,
          repeatSequenceNumber: 1,
          isWhatsapp: isWa,
        });
      });

      projectTasks.forEach((ct: any) => {
        if (seenIds.has(ct.id)) return;
        seenIds.add(ct.id);

        const projName = projectMap.get(ct.project_id) || 'General';
        const catInfo = detectCategoryCode('', ct.title || '', ct.description || '');
        const rawAssigned = (ct.assigned_to && profileMap.get(ct.assigned_to)) || '';
        const techName = resolveSupportEngineerName(rawAssigned, ct.title || '');
        const isDone = ct.status === 'completed' || ct.status === 'done';

        const { clientName, isInternalSystemTask } = inferClientAndScope(
          null,
          projName,
          ct.title || '',
          ct.description || '',
          catInfo.code,
          knownLeadNames,
        );

        const topic = classifyProblemTopic(ct.title || '', ct.description || '');
        const workInfo = classifySupportWorkBucket(ct.title || '', ct.description || '', catInfo.code);

        const reportedHours = +(Number(ct.actual_hours) || 0).toFixed(2);
        const aiAudit = computeTicketAiTimeBenchmark(
          ct.title || '',
          ct.description || '',
          catInfo.label,
          Number(ct.estimated_hours) || 0,
          reportedHours,
        );

        unified.push({
          id: ct.id,
          source: 'task',
          title: ct.title || 'Tarea de Proyecto',
          description: ct.description || '',
          clientName,
          isInternalSystemTask,
          techId: ct.assigned_to || techName,
          techName,
          status: isDone ? 'resolved' : 'open',
          priority: ct.priority === 'high' || ct.priority === 'urgent' ? ct.priority : 'medium',
          createdAt: ct.created_at,
          resolvedAt: ct.completed_at || (isDone ? ct.updated_at : null),
          ticketCategoryCode: catInfo.code,
          ticketCategoryName: catInfo.label,
          ticketCategoryColor: catInfo.color,
          workBucket: workInfo.bucket,
          workBucketLabel: workInfo.label,
          reclassifiedFromP4: workInfo.reclassifiedFromP4,
          reportedHours,
          expectedAiHours: aiAudit.expectedHours,
          maxReasonableAiHours: aiAudit.maxReasonableHours,
          diffAiHours: aiAudit.differenceHours,
          aiTimeStatus: aiAudit.status,
          aiTimeVerdictLabel: aiAudit.verdictLabel,
          categoryKey: topic.categoryKey,
          categoryLabel: topic.categoryLabel,
          findings: '',
          rootCause: '',
          solution: ct.description || '',
          isRepeatForSameClient: false,
          repeatSequenceNumber: 1,
          isWhatsapp: false,
        });
      });

      const sortedChron = [...unified].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      const clientPatternCounter = new Map<string, number>();
      sortedChron.forEach((r) => {
        if (r.isInternalSystemTask) return;
        const key = `${r.clientName}__${r.categoryKey}`;
        const seq = (clientPatternCounter.get(key) || 0) + 1;
        clientPatternCounter.set(key, seq);
        r.repeatSequenceNumber = seq;
        r.isRepeatForSameClient = seq > 1;
      });

      setRecords(unified);
    } catch (err) {
      console.error('[SupportIntelligence] Error:', err);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const pulse = useMemo<SupportPulseResult>(() => {
    const mergedMap = new Map<string, Ticket>();
    for (const t of rawTicketsList) mergedMap.set(t.id, t);
    for (const t of rootCauseTicketsList) {
      if (!mergedMap.has(t.id)) mergedMap.set(t.id, t);
    }
    return computeSupportWhatsAppPulse({
      tickets: Array.from(mergedMap.values()),
      waMessages: waMessagesList,
      comments: waCommentsList,
      profiles: profilesPulseList,
      options: { daysRange, pingPongThreshold: 12, techFilter: selectedTechFilter },
    });
  }, [
    rawTicketsList,
    rootCauseTicketsList,
    waMessagesList,
    waCommentsList,
    profilesPulseList,
    daysRange,
    selectedTechFilter,
  ]);

  const overview = useMemo(
    () =>
      buildExecutiveSupportOverview<Ticket>({
        pulse,
        records,
        techFilter: selectedTechFilter,
      }),
    [pulse, records, selectedTechFilter],
  );

  const pareto = useMemo(
    () =>
      buildSupportParetoAnalysis<Ticket>({
        pulse,
        records,
        techFilter: selectedTechFilter,
        metric: paretoMetric,
        daysRange,
      }),
    [pulse, records, selectedTechFilter, paretoMetric, daysRange],
  );

  const selectedParetoItem = useMemo(
    () => pareto.items.find((i) => i.patternKey === selectedPatternKey) || null,
    [pareto.items, selectedPatternKey],
  );

  const activeTablePattern = useMemo(
    () => pareto.items.find((i) => i.patternKey === tablePatternFilter) || null,
    [pareto.items, tablePatternFilter],
  );

  const paretoHasHours = pareto.totalReactiveHours > 0;
  const paretoChartData = useMemo<ParetoChartRow[]>(
    () =>
      pareto.items.slice(0, 8).map((item) => ({
        ...item,
        barValue:
          paretoMetric === 'clients'
            ? item.clientCount
            : paretoHasHours
              ? item.reactiveHours
              : item.messageCount + item.ticketCount,
      })),
    [pareto.items, paretoMetric, paretoHasHours],
  );

  const clientHealthCounts = useMemo(() => {
    const list = overview.unifiedClients;
    return {
      all: list.length,
      critical: list.filter((c) => c.health === 'critical').length,
      open: list.filter((c) => c.openTickets > 0).length,
      stable: list.filter((c) => c.health === 'stable').length,
    };
  }, [overview.unifiedClients]);

  const visibleClients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const patternClientSet = activeTablePattern ? new Set(activeTablePattern.clientKeys) : null;
    return overview.unifiedClients.filter((c) => {
      if (healthFilter === 'critical' && c.health !== 'critical') return false;
      if (healthFilter === 'open' && c.openTickets <= 0) return false;
      if (healthFilter === 'stable' && c.health !== 'stable') return false;
      if (patternClientSet && !patternClientSet.has(c.clientKey)) return false;
      if (q) {
        return (
          c.clientName.toLowerCase().includes(q) ||
          c.primaryModuleLabel.toLowerCase().includes(q) ||
          c.primaryTech.toLowerCase().includes(q) ||
          c.records.some((r) => r.title.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [overview.unifiedClients, healthFilter, activeTablePattern, searchQuery]);

  const handleMarkDevResolved = async (
    item: SupportPulseResult['rootCauseQueue']['pendingForDev'][number],
  ) => {
    const key = `${item.ticketId}:${item.entryId}`;
    setResolvingEntryKey(key);
    try {
      const { data: row, error: readErr } = await supabase
        .from('tickets')
        .select('metadata')
        .eq('id', item.ticketId)
        .maybeSingle();
      if (readErr) throw readErr;

      const rawUser = String(profile?.full_name || 'Jimmy Arias').trim();
      const resolverName = /simulaci[oó]n|platform\s*owner/i.test(rawUser)
        ? 'Jimmy Arias'
        : rawUser;
      const nowIso = new Date().toISOString();
      const nextMeta = markRootCauseDevResolvedPatch(
        (row?.metadata || {}) as Record<string, any>,
        item.entryId,
        resolverName,
        nowIso,
      );

      const { error: updErr } = await supabase
        .from('tickets')
        .update({ metadata: nextMeta, updated_at: nowIso })
        .eq('id', item.ticketId);
      if (updErr) throw updErr;

      if (activeCompanyId) {
        await supabase.from('ticket_comments').insert({
          ticket_id: item.ticketId,
          company_id: activeCompanyId,
          author_id: profile?.id || null,
          body: `✅ Causa raíz resuelta definitivamente por ${resolverName}${item.note ? ` (${item.note})` : ''}`,
          is_internal: true,
        });
      }

      toast.success(`Marcado como resuelto de raíz (${item.clientName})`);
      await loadIntelligenceData();
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo marcar como resuelto');
    } finally {
      setResolvingEntryKey(null);
    }
  };

  const copyOfficialNoAudioPolicy = () => {
    const message =
      `📢 *Aviso de Soporte Técnico (+503 7971-8911)*\n\n` +
      `Estimado cliente: para resolver su caso a la 1ª vez y en el menor tiempo posible, por favor envíenos su reporte *únicamente en TEXTO ESCRITO acompañado de una CAPTURA DE PANTALLA del error* (sin notas de voz).\n\n` +
      `✅ *Incluya:* 1) Empresa · 2) Qué error aparece · 3) Captura de pantalla.`;
    navigator.clipboard.writeText(message);
    toast.success('Mensaje oficial "Solo Texto + Captura" copiado');
  };

  const copyOperatingRules = () => {
    navigator.clipboard.writeText(SUPPORT_OPERATING_RULES_COPY_TEXT);
    toast.success('3 Reglas Operativas copiadas para enviar a Melvin');
  };

  const copyParetoPlan = () => {
    navigator.clipboard.writeText(pareto.copyPlanText);
    toast.success('Plan Pareto 80/20 copiado para el equipo');
  };

  const handleOpenClientsFromPareto = (patternKey: SupportErrorPatternKey) => {
    setTablePatternFilter(patternKey);
    setHealthFilter('all');
    setSelectedPatternKey(null);
    setActiveTab('clientes');
  };

  const { totals } = overview;
  const visibleDays = pulse.dailySeries.slice(-14);
  const maxDayMsgs = Math.max(1, ...visibleDays.map((d) => d.totalMessages));
  const top3Problems = pareto.items.slice(0, 3);
  const urgentClientsBadge =
    totals.returningClientsCount + pulse.rootCauseQueue.pendingForDev.length;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16">
      {/* ── CLEAN EXECUTIVE HEADER + 3 NAVIGATION TABS ── */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              Control de Operaciones
            </h1>

            {/* Segmented Technician Switcher */}
            <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/70">
              {[
                { id: 'all', label: 'Equipo' },
                { id: 'Melvin Rodriguez', label: 'Melvin' },
                { id: 'Gerson Gutierrez', label: 'Gerson' },
              ].map((opt) => {
                const active = selectedTechFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedTechFilter(opt.id);
                      setExpandedClientKey(null);
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                      active
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={daysRange}
              onChange={(e) => setDaysRange(Number(e.target.value))}
              className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-700"
            >
              <option value={7}>7 días</option>
              <option value={15}>15 días</option>
              <option value={30}>30 días</option>
              <option value={60}>60 días</option>
              <option value={120}>4 meses</option>
            </select>

            <button
              type="button"
              onClick={() => setShowRulesPanel((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                showRulesPanel
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Reglas
            </button>

            <button
              type="button"
              onClick={() => navigate('/support/chat')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Chat
            </button>

            <button
              type="button"
              onClick={() => navigate('/support/tickets')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition"
            >
              <TicketIcon className="w-3.5 h-3.5" />
              Tickets
            </button>

            <button
              type="button"
              onClick={loadIntelligenceData}
              title="Actualizar datos"
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 border border-slate-200 bg-white transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Clean 3-Tab Navigation Bar */}
        <div className="max-w-6xl mx-auto px-6 flex items-center gap-6 border-t border-slate-100 overflow-x-auto">
          {[
            { id: 'resumen' as const, label: 'Resumen' },
            {
              id: 'pareto' as const,
              label: 'Qué arreglar (80/20)',
              pill: pareto.vitalFewCount > 0 ? `${pareto.vitalFewCount} focos` : undefined,
            },
            {
              id: 'clientes' as const,
              label: `Clientes (${clientHealthCounts.all})`,
              alertDot: urgentClientsBadge > 0,
            },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative py-2.5 text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap border-b-2 transition ${
                  active
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>{tab.label}</span>
                {tab.pill && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      active ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.pill}
                  </span>
                )}
                {tab.alertDot && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
                )}
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-6 space-y-6">
        {/* ── COLLAPSIBLE OPERATING RULES ── */}
        {showRulesPanel && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                Reglas Operativas del Equipo
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={copyOfficialNoAudioPolicy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
                >
                  <MicOff className="w-3.5 h-3.5 text-slate-600" />
                  Copiar Regla Sin Audios
                </button>
                <button
                  type="button"
                  onClick={copyOperatingRules}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copiar 3 reglas para equipo
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {SUPPORT_OPERATING_RULES.map((rule) => (
                <div
                  key={rule.id}
                  className="rounded-xl bg-slate-50 border border-slate-200/70 p-3.5 space-y-1"
                >
                  <p className="text-xs font-bold text-slate-900">{rule.title}</p>
                  <p className="text-[11px] font-medium text-slate-500">{rule.trigger}</p>
                  <p className="text-xs text-slate-700 pt-0.5 leading-relaxed">{rule.action}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB 1 · RESUMEN GERENCIAL (¿CÓMO VAMOS?)                             */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'resumen' && (
          <div className="space-y-6">
            {/* 3 Clean Executive KPI Cards */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* KPI 1: Tiempo en mejoras */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">
                    Tiempo en mejoras
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold ${
                      !totals.hasLoggedTickets
                        ? 'bg-amber-50 text-amber-800'
                        : totals.buildPct >= totals.targetBuildPct
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {!totals.hasLoggedTickets
                      ? 'Sin tickets'
                      : `Meta ${totals.targetBuildPct}%`}
                  </span>
                </div>
                <p className="text-3xl font-bold text-slate-900 tracking-tight">
                  {totals.hasLoggedTickets ? `${totals.buildPct}%` : '—'}
                </p>
                <p className="text-xs text-slate-500">
                  {totals.hasLoggedTickets
                    ? `${totals.buildHours}h construyendo producto y Go-Live`
                    : 'No hay tickets de mejora registrados en este período'}
                </p>
              </div>

              {/* KPI 2: Tiempo en fallas y chats */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">
                    Tiempo en fallas y chats
                  </span>
                  {totals.reclassifiedP4BugHours > 0 && (
                    <span className="px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-amber-50 text-amber-800">
                      Incl. {totals.reclassifiedP4BugHours}h bugs en P4
                    </span>
                  )}
                </div>
                <p className="text-3xl font-bold text-slate-900 tracking-tight">
                  {totals.hasLoggedTickets
                    ? `${totals.reactivePct}%`
                    : `~${totals.unloggedChatHours}h`}
                </p>
                <p className="text-xs text-slate-500">
                  {totals.hasLoggedTickets
                    ? `${totals.totalReactiveHours}h (${totals.ticketReactiveHours}h tickets + ~${totals.unloggedChatHours}h chat WA)`
                    : 'Solo actividad visible en WhatsApp'}
                </p>
              </div>

              {/* KPI 3: Clientes reincidentes */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">
                    Clientes que regresan
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {pulse.summary.avgClientsPerDay} clientes/día
                  </span>
                </div>
                <p className="text-3xl font-bold text-slate-900 tracking-tight">
                  {totals.returningClientsCount}{' '}
                  <span className="text-base font-semibold text-slate-400">
                    de {totals.activeClientsCount}
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  {totals.returningPct}% volvió varios días · {pulse.summary.pingPongCount} chats largos
                </p>
              </div>
            </section>

            {/* Clean Balance Meter */}
            <section className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {totals.verdictTone === 'good' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle
                      className={`w-4 h-4 shrink-0 ${
                        totals.verdictTone === 'critical' ? 'text-rose-600' : 'text-amber-600'
                      }`}
                    />
                  )}
                  <h2 className="text-sm font-bold text-slate-900">{totals.verdictTitle}</h2>
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  Objetivo recomendado: 80–90% Mejoras · ≤5% Fallas
                </span>
              </div>

              <div className="relative h-3 w-full rounded-full bg-slate-100 overflow-hidden flex">
                {!totals.hasLoggedTickets ? (
                  totals.unloggedChatHours > 0 && (
                    <div className="h-full w-full bg-amber-400/75" />
                  )
                ) : (
                  <>
                    {totals.buildPct > 0 && (
                      <div
                        style={{ width: `${totals.buildPct}%` }}
                        className="h-full bg-emerald-500 transition-all"
                      />
                    )}
                    {totals.reactivePct > 0 && (
                      <div
                        style={{ width: `${totals.reactivePct}%` }}
                        className="h-full bg-rose-500 transition-all"
                      />
                    )}
                    <div
                      style={{ left: `${totals.targetBuildPct}%` }}
                      title={`Meta: ${totals.targetBuildPct}% mejoras`}
                      className="absolute top-0 bottom-0 w-0.5 bg-slate-900/75"
                    />
                  </>
                )}
              </div>
            </section>

            {/* Equipo: Melvin vs. Gerson (Clean Side-by-Side) */}
            <section className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Desempeño por técnico
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {overview.techSummaries.map((tech) => {
                  const isSelected = selectedTechFilter === tech.techName;
                  return (
                    <button
                      key={tech.techName}
                      type="button"
                      onClick={() => {
                        setSelectedTechFilter(isSelected ? 'all' : tech.techName);
                        setExpandedClientKey(null);
                      }}
                      className={`text-left bg-white rounded-2xl p-5 border transition shadow-2xs ${
                        isSelected
                          ? 'border-indigo-600 ring-2 ring-indigo-500/15'
                          : selectedTechFilter !== 'all'
                          ? 'border-slate-200/80 opacity-60 hover:opacity-100'
                          : 'border-slate-200/80 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                            {tech.techName
                              .split(' ')
                              .map((w) => w[0])
                              .join('')}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{tech.techName}</p>
                            <p className="text-xs text-slate-500">
                              {tech.waClients} clientes WA · {tech.totalTickets} tickets
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          {!tech.hasLoggedTickets ? (
                            <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              Sin tickets
                            </span>
                          ) : (
                            <p className="text-xs font-bold">
                              <span className="text-emerald-700">{tech.buildPct}% Mejoras</span>
                              <span className="text-slate-300 mx-1">·</span>
                              <span className="text-rose-600">{tech.reactivePct}% Fallas</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden flex mt-3.5">
                        {!tech.hasLoggedTickets ? (
                          tech.totalReactiveHours > 0 && (
                            <div className="bg-amber-400/75 h-full w-full" />
                          )
                        ) : (
                          <>
                            {tech.buildPct > 0 && (
                              <div
                                style={{ width: `${tech.buildPct}%` }}
                                className="bg-emerald-500 h-full"
                              />
                            )}
                            {tech.reactivePct > 0 && (
                              <div
                                style={{ width: `${tech.reactivePct}%` }}
                                className="bg-rose-500 h-full"
                              />
                            )}
                          </>
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                        {!tech.hasLoggedTickets ? (
                          <span>
                            Solo <strong className="text-slate-900">~{tech.totalReactiveHours}h</strong> visibles en chat WA
                          </span>
                        ) : (
                          <span>
                            Mejoras: <strong className="text-slate-900">{tech.buildHours}h</strong> · Fallas:{' '}
                            <strong className="text-slate-900">{tech.totalReactiveHours}h</strong>
                          </span>
                        )}
                        <span>
                          <strong className={tech.returningClientsCount > 0 ? 'text-rose-600' : 'text-slate-900'}>
                            {tech.returningClientsCount}
                          </strong>{' '}
                          reincidentes
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Bottom Summary Row: Top 3 Problems + Daily WhatsApp Rhythm */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Top 3 focos que más tiempo consumen
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('pareto')}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
                  >
                    Ver plan 80/20 →
                  </button>
                </div>

                {top3Problems.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4">
                    Sin fallas registradas en este período.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {top3Problems.map((item, idx) => (
                      <button
                        key={item.patternKey}
                        type="button"
                        onClick={() => {
                          setActiveTab('pareto');
                          setSelectedPatternKey(item.patternKey);
                        }}
                        className="w-full py-2.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50/70 rounded-lg px-2 -mx-2 transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-5 h-5 rounded-md bg-rose-50 text-rose-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {item.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 text-xs">
                          <span className="font-bold text-slate-800">{item.reactiveHours}h</span>
                          <span className="text-slate-400 hidden sm:inline">
                            {item.clientCount} clientes
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10.5px] font-semibold ${
                              item.audit.verdict === 'root_fixed'
                                ? 'bg-emerald-50 text-emerald-700'
                                : item.audit.verdict === 'partial_patch'
                                ? 'bg-amber-50 text-amber-800'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {item.audit.verdictLabel}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    Ritmo diario WhatsApp ({visibleDays.length}d)
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Hoy: {pulse.summary.todayClients} clientes
                  </span>
                </div>

                <div
                  className="grid gap-1"
                  style={{ gridTemplateColumns: `repeat(${Math.max(1, visibleDays.length)}, minmax(0, 1fr))` }}
                >
                  {visibleDays.map((d) => {
                    const hPct =
                      d.totalMessages > 0
                        ? Math.max(14, Math.round((d.totalMessages / maxDayMsgs) * 100))
                        : 5;
                    return (
                      <div
                        key={d.dayKey}
                        title={`${d.label}: ${d.activeClients} clientes · ${d.totalMessages} msgs · ~${d.estStaffHours}h`}
                        className="flex flex-col items-center justify-end rounded-lg bg-slate-50 py-1.5 px-0.5"
                      >
                        <span className="text-[9.5px] font-bold text-slate-700">{d.totalMessages}</span>
                        <div className="w-full h-10 flex items-end justify-center my-0.5">
                          <div
                            style={{ height: `${hPct}%` }}
                            className={`w-2 rounded-t ${
                              d.pingPongChats > 0
                                ? 'bg-rose-500'
                                : d.totalMessages > 0
                                ? 'bg-indigo-500'
                                : 'bg-slate-200'
                            }`}
                          />
                        </div>
                        <span className="text-[8.5px] text-slate-400 truncate max-w-full">
                          {d.label.split(' ')[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB 2 · QUÉ ARREGLAR (PARETO 80/20 + TABLA EJECUTIVA)                */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'pareto' && (
          <div className="space-y-5">
            <section className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-5">
              {/* Header + Metric Toggle + Copy Plan */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Target className="w-4 h-4 text-rose-600" />
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">
                      {pareto.headline}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500">
                    Haz clic en cualquier barra o fila para ver qué hizo el equipo y la solución definitiva recomendada
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/70">
                    {[
                      { id: 'hours' as SupportParetoMetric, label: 'Por horas' },
                      { id: 'clients' as SupportParetoMetric, label: 'Por clientes' },
                    ].map((opt) => {
                      const active = paretoMetric === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setParetoMetric(opt.id)}
                          className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                            active
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  {pareto.items.length > 0 && (
                    <button
                      type="button"
                      onClick={copyParetoPlan}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition"
                    >
                      <Copy className="w-3.5 h-3.5 text-indigo-600" />
                      Copiar plan 80/20
                    </button>
                  )}
                </div>
              </div>

              {pareto.items.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Sin fallas registradas en los últimos {daysRange} días.
                </div>
              ) : (
                <>
                  {/* Clean Pareto Chart */}
                  <div className="w-full h-[255px] min-w-0 outline-none [&_.recharts-wrapper]:outline-none [&_svg]:outline-none">
                    <ResponsiveContainer width="100%" height={255}>
                      <ComposedChart
                        data={paretoChartData}
                        margin={{ top: 12, right: 12, left: -8, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis
                          dataKey="shortLabel"
                          axisLine={false}
                          tickLine={false}
                          interval={0}
                          height={32}
                          tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }}
                        />
                        <YAxis
                          yAxisId="left"
                          axisLine={false}
                          tickLine={false}
                          width={42}
                          tick={{ fill: '#94A3B8', fontSize: 11 }}
                          tickFormatter={(v) =>
                            paretoMetric === 'clients' || !paretoHasHours ? `${v}` : `${v}h`
                          }
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          domain={[0, 100]}
                          ticks={[0, 20, 40, 60, 80, 100]}
                          axisLine={false}
                          tickLine={false}
                          width={40}
                          tick={{ fill: '#6366F1', fontSize: 11 }}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <ReferenceLine
                          yAxisId="right"
                          y={80}
                          stroke="#4F46E5"
                          strokeDasharray="5 5"
                          strokeOpacity={0.5}
                          label={{
                            value: 'Corte 80%',
                            position: 'insideTopRight',
                            fill: '#4F46E5',
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        />
                        <Tooltip
                          cursor={{ fill: '#F8FAFC' }}
                          content={(props) => (
                            <ParetoTooltipCard
                              active={props.active}
                              payload={props.payload as Array<{ payload?: ParetoChartRow }>}
                              metric={paretoMetric}
                            />
                          )}
                        />
                        <Bar
                          yAxisId="left"
                          dataKey="barValue"
                          radius={[7, 7, 0, 0]}
                          maxBarSize={48}
                          className="cursor-pointer outline-none"
                          onClick={(_barData, index) => {
                            const target = paretoChartData[index];
                            if (target) setSelectedPatternKey(target.patternKey);
                          }}
                        >
                          {paretoChartData.map((entry) => {
                            const isSelected = selectedPatternKey === entry.patternKey;
                            const fill = isSelected
                              ? entry.isVitalFew80
                                ? '#BE123C'
                                : '#475569'
                              : entry.isVitalFew80
                                ? '#F43F5E'
                                : '#CBD5E1';
                            return <Cell key={entry.patternKey} fill={fill} />;
                          })}
                        </Bar>
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="cumulativePct"
                          stroke="#4F46E5"
                          strokeWidth={2.5}
                          dot={{ r: 3.5, fill: '#FFFFFF', stroke: '#4F46E5', strokeWidth: 2 }}
                          activeDot={{ r: 5.5, fill: '#4F46E5', stroke: '#FFFFFF', strokeWidth: 2 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Minimal Chart Legend */}
                  <div className="flex flex-wrap items-center gap-5 text-[11px] text-slate-500 px-1">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                      <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" />
                      Prioridad 80%
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-slate-300 inline-block" />
                      Resto 20%
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-semibold text-indigo-700">
                      <span className="w-3 h-0.5 bg-indigo-600 inline-block" />
                      % Acumulado
                    </span>
                  </div>
                </>
              )}
            </section>

            {/* Clean Executive Table (replaces multi-card grid) */}
            {pareto.items.length > 0 && (
              <section className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wide text-slate-400 bg-slate-50/60">
                        <th className="py-3 px-4 w-10">#</th>
                        <th className="py-3 px-4">Problema</th>
                        <th className="py-3 px-4">Tiempo</th>
                        <th className="py-3 px-4">Clientes</th>
                        <th className="py-3 px-4">Estado de solución</th>
                        <th className="py-3 px-4 text-right">Detalle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pareto.items.map((item, idx) => {
                        const isSelected = selectedPatternKey === item.patternKey;
                        const statusPillCls =
                          item.audit.verdict === 'root_fixed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : item.audit.verdict === 'partial_patch'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200';
                        return (
                          <tr
                            key={item.patternKey}
                            onClick={() => setSelectedPatternKey(item.patternKey)}
                            className={`cursor-pointer transition ${
                              isSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-50/80'
                            }`}
                          >
                            <td className="py-3.5 px-4">
                              <span
                                className={`w-6 h-6 rounded-md text-[11px] font-bold flex items-center justify-center ${
                                  item.isVitalFew80
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {idx + 1}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <p className="font-bold text-slate-900">{item.label}</p>
                              <p className="text-[11px] text-slate-400">
                                {item.sharePct}% del total · Acumulado {item.cumulativePct}%
                              </p>
                            </td>
                            <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                              {item.reactiveHours}h
                            </td>
                            <td className="py-3.5 px-4 text-slate-700 font-medium whitespace-nowrap">
                              {item.clientCount} cliente{item.clientCount === 1 ? '' : 's'}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${statusPillCls}`}
                              >
                                {item.audit.verdictLabel}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <span className="text-indigo-600 font-semibold hover:underline">
                                Ver detalle →
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB 3 · CLIENTES Y ESCALACIONES                                      */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'clientes' && (
          <div className="space-y-5">
            {/* Escalated Bugs Queue (ONLY shown when pending > 0) */}
            {pulse.rootCauseQueue.pendingForDev.length > 0 && (
              <section className="bg-white rounded-2xl border border-rose-200/80 p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Bug className="w-4 h-4 text-rose-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Bugs escalados desde WhatsApp pendientes de resolver
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-rose-50 text-rose-700">
                    {pulse.rootCauseQueue.pendingForDev.length} pendientes
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {pulse.rootCauseQueue.pendingForDev.map((item) => {
                    const rcMeta = SUPPORT_ROOT_CAUSE_META[item.type];
                    const itemKey = `${item.ticketId}:${item.entryId}`;
                    const isSaving = resolvingEntryKey === itemKey;
                    return (
                      <div key={itemKey} className="py-2.5 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${rcMeta.badgeClass}`}
                            >
                              {rcMeta.shortLabel}
                            </span>
                            <span className="text-xs font-bold text-slate-900">
                              {item.clientName}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              · {item.byName.split(' ')[0]}
                            </span>
                          </div>
                          {item.note && (
                            <p className="text-xs text-slate-600 mt-1">{item.note}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.circleId && (
                            <button
                              type="button"
                              onClick={() => navigate('/support/chat', { state: { waCircleId: item.circleId } })}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs"
                            >
                              Chat
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleMarkDevResolved(item)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold text-xs disabled:opacity-50"
                          >
                            {isSaving ? '...' : 'Marcar resuelto'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Clean Unified Client Health Table */}
            <section
              id="client-health-section"
              className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs"
            >
              <div className="p-4 border-b border-slate-200/80 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: 'all' as HealthFilter, label: `Todos (${clientHealthCounts.all})` },
                    { id: 'critical' as HealthFilter, label: `Reincidentes (${clientHealthCounts.critical})` },
                    { id: 'open' as HealthFilter, label: `Con abiertos (${clientHealthCounts.open})` },
                    { id: 'stable' as HealthFilter, label: `Estables (${clientHealthCounts.stable})` },
                  ].map((pill) => {
                    const active = healthFilter === pill.id;
                    return (
                      <button
                        key={pill.id}
                        type="button"
                        onClick={() => setHealthFilter(pill.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                          active
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {pill.label}
                      </button>
                    );
                  })}

                  {activeTablePattern && (
                    <button
                      type="button"
                      onClick={() => setTablePatternFilter(null)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200"
                    >
                      <Filter className="w-3 h-3" />
                      {activeTablePattern.shortLabel} ×
                    </button>
                  )}
                </div>

                <div className="relative w-full lg:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar cliente, técnico o error..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-medium"
                  />
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {visibleClients.length === 0 ? (
                  <div className="p-10 text-center text-xs text-slate-400 font-medium">
                    No hay clientes con este filtro.
                  </div>
                ) : (
                  visibleClients.map((client) => {
                    const isExpanded = expandedClientKey === client.clientKey;
                    const badgeClass =
                      client.health === 'critical'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : client.health === 'watch'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    return (
                      <div key={client.clientKey}>
                        <div
                          className={`px-5 py-3 flex flex-wrap items-center justify-between gap-3 transition ${
                            isExpanded ? 'bg-indigo-50/40' : 'hover:bg-slate-50'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedClientKey(isExpanded ? null : client.clientKey)
                            }
                            className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-indigo-600 shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                            )}

                            <span
                              className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold border shrink-0 ${badgeClass}`}
                            >
                              {client.health === 'critical'
                                ? 'Reincidente'
                                : client.health === 'watch'
                                ? 'Atención'
                                : 'Estable'}
                            </span>

                            <span className="text-sm font-bold text-slate-900 truncate">
                              {client.clientName}
                            </span>

                            <span className="px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-slate-100 text-slate-600 shrink-0">
                              {client.primaryModuleLabel}
                            </span>

                            {client.isPingPong && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold shrink-0">
                                <Flame className="w-3 h-3" />
                                {client.peakDayMessages} msgs
                              </span>
                            )}

                            {client.distinctDaysReported >= 2 && (
                              <span className="text-[11px] font-medium text-rose-700 shrink-0 hidden md:inline">
                                · Volvió {client.distinctDaysReported} días
                              </span>
                            )}
                          </button>

                          <div className="flex items-center gap-3 text-xs shrink-0">
                            <span className="text-slate-500 font-medium hidden sm:inline">
                              {client.primaryTech.split(' ')[0]}
                            </span>

                            <span
                              title={`${client.ticketReactiveHours}h en tickets + ~${client.unloggedChatHours}h chat WA sin ticket`}
                              className="font-bold text-slate-900"
                            >
                              {client.totalReactiveHours}h
                            </span>

                            {client.openTickets > 0 && (
                              <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-rose-600 text-white">
                                {client.openTickets} abiertos
                              </span>
                            )}

                            {client.circleId && (
                              <button
                                type="button"
                                onClick={() =>
                                  navigate('/support/chat', { state: { waCircleId: client.circleId } })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[11px] transition"
                              >
                                Abrir chat →
                              </button>
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="bg-slate-50/70 px-5 py-3.5 border-t border-slate-100 space-y-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                              <span>
                                <strong>Detalle:</strong> {client.healthReason} · WA:{' '}
                                {client.waMessages} mensajes (~{client.waEstHours}h)
                              </span>
                              {client.buildHours > 0 && (
                                <span className="font-semibold text-emerald-700">
                                  + {client.buildHours}h en Mejoras / Go-Live
                                </span>
                              )}
                            </div>

                            {client.records.length === 0 ? (
                              <p className="text-xs text-slate-400 italic">
                                Solo conversaciones por WhatsApp en este período.
                              </p>
                            ) : (
                              <div className="bg-white rounded-xl border border-slate-200/80 overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-200/80 text-[10px] font-bold uppercase text-slate-400 bg-slate-50/50">
                                      <th className="py-2 px-3">Fecha</th>
                                      <th className="py-2 px-3">Tipo</th>
                                      <th className="py-2 px-3">Caso</th>
                                      <th className="py-2 px-3">Técnico</th>
                                      <th className="py-2 px-3">Tiempo</th>
                                      <th className="py-2 px-3 text-right">Detalle</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {client.records.map((rec) => (
                                      <tr key={rec.id} className="hover:bg-slate-50/80">
                                        <td className="py-2 px-3 whitespace-nowrap">
                                          <span className="font-semibold text-slate-700">
                                            {new Date(rec.createdAt).toLocaleDateString('es-SV', {
                                              day: '2-digit',
                                              month: 'short',
                                            })}
                                          </span>
                                          <span
                                            className={`ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                              rec.status === 'resolved'
                                                ? 'bg-emerald-50 text-emerald-700'
                                                : 'bg-rose-50 text-rose-700'
                                            }`}
                                          >
                                            {rec.status === 'resolved' ? 'Cerrado' : 'Abierto'}
                                          </span>
                                        </td>
                                        <td className="py-2 px-3 whitespace-nowrap">
                                          <span
                                            className="px-2 py-0.5 rounded text-[10px] font-bold text-white"
                                            style={{ backgroundColor: rec.ticketCategoryColor }}
                                          >
                                            {rec.ticketCategoryCode}
                                          </span>
                                        </td>
                                        <td className="py-2 px-3 max-w-sm">
                                          <p className="font-semibold text-slate-900 truncate">{rec.title}</p>
                                          {rec.solution && (
                                            <p className="text-[11px] text-slate-500 truncate">
                                              {rec.solution}
                                            </p>
                                          )}
                                        </td>
                                        <td className="py-2 px-3 whitespace-nowrap text-slate-700">
                                          {rec.techName.split(' ')[0]}
                                        </td>
                                        <td className="py-2 px-3 whitespace-nowrap font-bold text-slate-800">
                                          {rec.reportedHours}h
                                        </td>
                                        <td className="py-2 px-3 text-right whitespace-nowrap">
                                          {rec.rawTicket && (
                                            <button
                                              type="button"
                                              onClick={() => setSelectedTicketForDrawer(rec.rawTicket!)}
                                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[11px]"
                                            >
                                              Ver <ExternalLink className="w-3 h-3" />
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                {overview.internalDev.count > 0 && (
                  <div className="bg-slate-50/70">
                    <button
                      type="button"
                      onClick={() => setShowInternalTasks((v) => !v)}
                      className="w-full text-left px-5 py-3 flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      <span className="inline-flex items-center gap-2">
                        <ShieldAlert className="w-3.5 h-3.5 text-emerald-600" />
                        Mejoras internas de producto (P4 · {overview.internalDev.count} tareas ·{' '}
                        {overview.internalDev.totalHours}h)
                      </span>
                      <span>{showInternalTasks ? 'Ocultar' : 'Ver'}</span>
                    </button>
                    {showInternalTasks && (
                      <div className="px-5 pb-4 space-y-1.5">
                        {overview.internalDev.records.map((rec) => (
                          <div
                            key={rec.id}
                            className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-200/70 text-xs"
                          >
                            <span className="font-medium text-slate-800 truncate">
                              {rec.title}{' '}
                              <span className="text-slate-400">({rec.techName.split(' ')[0]})</span>
                            </span>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="font-bold text-emerald-700">{rec.reportedHours}h</span>
                              {rec.rawTicket && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedTicketForDrawer(rec.rawTicket!)}
                                  className="text-indigo-600 font-semibold"
                                >
                                  Ver →
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Slide-Over Detail Drawer for Selected Pareto Problem */}
      {selectedParetoItem && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedPatternKey(null);
          }}
          className="fixed inset-0 z-40 flex justify-end bg-slate-900/35 backdrop-blur-xs"
        >
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl overflow-hidden flex flex-col">
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-3 bg-white">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded text-[10.5px] font-bold ${
                      selectedParetoItem.isVitalFew80
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {selectedParetoItem.isVitalFew80 ? 'Prioridad 80%' : 'Resto 20%'}
                  </span>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedParetoItem.label}
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  {selectedParetoItem.reactiveHours}h perdidas · {selectedParetoItem.clientCount}{' '}
                  cliente{selectedParetoItem.clientCount === 1 ? '' : 's'} ·{' '}
                  {selectedParetoItem.sharePct}% del soporte reactivo
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPatternKey(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F8FAFC]">
              {/* Section 1: Manager Recommendation */}
              <div className="bg-white rounded-2xl border border-indigo-200/75 p-5 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wide text-indigo-700">
                    Qué pedirle al equipo
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                      selectedParetoItem.audit.verdict === 'root_fixed'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : selectedParetoItem.audit.verdict === 'partial_patch'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {selectedParetoItem.audit.verdictLabel}
                  </span>
                </div>

                <p className="text-xs text-slate-500 font-medium">
                  {selectedParetoItem.audit.summary}
                </p>

                <p className="text-sm text-slate-900 font-medium leading-relaxed">
                  {selectedParetoItem.audit.recommendedRootCauseFix}
                </p>

                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Preguntas para validar en reunión
                  </p>
                  <ul className="space-y-1.5">
                    {selectedParetoItem.audit.seniorChecklist.map((q, qIdx) => (
                      <li key={qIdx} className="flex items-start gap-2 text-xs text-slate-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Section 2: What the Team Actually Did */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Qué ha hecho el equipo en tickets recientes
                </h4>

                {selectedParetoItem.audit.documentedSolutions.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200/80 p-4 text-xs text-slate-500">
                    No hay soluciones técnicas documentadas para este problema en el período; todo se atendió por WhatsApp o cierres genéricos.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {selectedParetoItem.audit.documentedSolutions.map((sol) => (
                      <div
                        key={sol.ticketId}
                        className="bg-white rounded-xl border border-slate-200/80 p-4 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                sol.verdict === 'root_cause_fix'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              {sol.verdictLabel}
                            </span>
                            <p className="text-xs font-bold text-slate-900">{sol.title}</p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 text-[11px]">
                            <span className="text-slate-500">
                              {sol.techName.split(' ')[0]} · {sol.hours}h
                            </span>
                            {sol.rawTicket && (
                              <button
                                type="button"
                                onClick={() => setSelectedTicketForDrawer(sol.rawTicket!)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold"
                              >
                                Ticket <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {sol.rootCause && (
                          <p className="text-xs text-slate-600 leading-relaxed">
                            <strong className="text-slate-800">Por qué falló:</strong> {sol.rootCause}
                          </p>
                        )}
                        {sol.solution && (
                          <p className="text-xs text-slate-600 leading-relaxed">
                            <strong className="text-slate-800">Qué aplicaron:</strong> {sol.solution}
                          </p>
                        )}
                        {sol.seniorFlag && (
                          <p className="rounded-lg bg-amber-50 border border-amber-200/80 px-2.5 py-1.5 text-[11px] font-medium text-amber-900">
                            {sol.seniorFlag}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {selectedParetoItem.audit.undocumentedCount > 0 && (
                  <p className="text-xs text-rose-700 font-medium px-1">
                    {selectedParetoItem.audit.undocumentedCount} ticket(s) (
                    {selectedParetoItem.audit.undocumentedHours}h) fueron cerrados sin explicar causa raíz.
                  </p>
                )}
              </div>

              {/* Section 3: Affected Clients & Sample Messages */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Clientes afectados ({selectedParetoItem.clients.length})
                  </h4>
                  {selectedParetoItem.clientCount > 0 && (
                    <button
                      type="button"
                      onClick={() => handleOpenClientsFromPareto(selectedParetoItem.patternKey)}
                      className="text-xs font-semibold text-indigo-600 hover:underline"
                    >
                      Ver en pestaña Clientes →
                    </button>
                  )}
                </div>

                {selectedParetoItem.clients.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedParetoItem.clients.slice(0, 6).map((c) => (
                      <div
                        key={c.clientKey}
                        className="bg-white border border-slate-200/80 rounded-xl px-3 py-2 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{c.clientName}</p>
                          <p className="text-[11px] text-slate-500">
                            {c.reactiveHours}h · {c.messages} msgs
                          </p>
                        </div>
                        {c.circleId && (
                          <button
                            type="button"
                            onClick={() =>
                              navigate('/support/chat', { state: { waCircleId: c.circleId } })
                            }
                            className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[11px] shrink-0"
                          >
                            Chat
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {selectedParetoItem.examples.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {selectedParetoItem.examples.slice(0, 3).map((ex, idx) => (
                      <div
                        key={`${ex.clientName}-${idx}`}
                        className="bg-white border border-slate-200/80 rounded-xl p-3 space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="font-bold text-slate-900">{ex.clientName}</span>
                          <span>
                            {ex.source === 'whatsapp' ? 'WhatsApp' : 'Ticket'} ·{' '}
                            {new Date(ex.at).toLocaleDateString('es-SV', {
                              day: '2-digit',
                              month: 'short',
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700">&ldquo;{ex.text}&rdquo;</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Drawer (z-50 sits cleanly above Pareto Slide-Over) */}
      {selectedTicketForDrawer && activeCompanyId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl overflow-hidden flex flex-col">
            <TicketPanel
              ticket={selectedTicketForDrawer}
              allTickets={rawTicketsList}
              categories={categoriesList}
              agents={agentsList}
              leads={leadsList}
              companyId={activeCompanyId}
              authorId={profile?.id || ''}
              onClose={() => setSelectedTicketForDrawer(null)}
              onUpdate={(updated) => {
                setSelectedTicketForDrawer(updated);
                loadIntelligenceData();
              }}
              onDelete={() => {
                setSelectedTicketForDrawer(null);
                loadIntelligenceData();
              }}
              onSelectTicket={(t) => setSelectedTicketForDrawer(t)}
              onCreateSubticket={() => {}}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportIntelligence;
