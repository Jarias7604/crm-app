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
  normalizeSupportClientName,
  SUPPORT_ROOT_CAUSE_META,
  SUPPORT_OPERATING_RULES,
  SUPPORT_OPERATING_RULES_COPY_TEXT,
  markRootCauseDevResolvedPatch,
  type SupportPulseResult,
  type SupportErrorPatternKey,
  type SupportParetoMetric,
  type SupportParetoItem,
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
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
            row.isVitalFew80
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

type WorkBucket = 'text_reply' | 'implementation' | 'troubleshooting' | 'development';
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
  workBucket: WorkBucket;
  workBucketLabel: string;
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

function classifyWorkBucket(
  title: string,
  description: string,
  categoryCode: string,
): { bucket: WorkBucket; label: string } {
  const text = `${title} ${description}`.toLowerCase();
  if (
    categoryCode === 'FAQ' ||
    /^pregunta\s+frecuente/i.test(title) ||
    /consulta|duda|respondiendo\s+texto/i.test(text)
  ) {
    return { bucket: 'text_reply', label: '💬 Consulta' };
  }
  if (
    /^go\s*live|^capacitaci[oó]n|^implementaci[oó]n/i.test(title) ||
    /go\s*live|capacitaci[oó]n|implementaci[oó]n|entrenamiento/i.test(text)
  ) {
    return { bucket: 'implementation', label: '🚀 Go-Live' };
  }
  if (categoryCode === 'P4') {
    return { bucket: 'development', label: '⚙️ Mejora P4' };
  }
  return { bucket: 'troubleshooting', label: '🛠️ Falla' };
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

  // Unified filters
  const [selectedTechFilter, setSelectedTechFilter] = useState<string>('all');
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('all');
  const [paretoMetric, setParetoMetric] = useState<SupportParetoMetric>('hours');
  const [selectedPatternKey, setSelectedPatternKey] = useState<SupportErrorPatternKey | null>(null);
  const [tablePatternFilter, setTablePatternFilter] = useState<SupportErrorPatternKey | null>(null);
  const [showAllParetoItems, setShowAllParetoItems] = useState<boolean>(false);
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
        const workInfo = classifyWorkBucket(t.title || '', t.description || '', catInfo.code);

        const reportedHours = +(Number(t.actual_hours) || 0).toFixed(2);
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
          isWhatsapp: isWhatsappTicket(t),
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
        const workInfo = classifyWorkBucket(ct.title || '', ct.description || '', catInfo.code);

        const reportedHours = +(Number(ct.actual_hours) || (isDone ? 1 : 0)).toFixed(2);
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

  const handleFilterClientsByPattern = (patternKey: SupportErrorPatternKey) => {
    setTablePatternFilter((prev) => (prev === patternKey ? null : patternKey));
    setHealthFilter('all');
    setTimeout(() => {
      document.getElementById('client-health-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 60);
  };

  const { totals } = overview;
  const verdictStyles =
    totals.verdictTone === 'good'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
      : totals.verdictTone === 'warn'
        ? 'bg-amber-50 border-amber-200 text-amber-950'
        : totals.verdictTone === 'critical'
          ? 'bg-rose-50 border-rose-200 text-rose-950'
          : 'bg-slate-50 border-slate-200 text-slate-800';

  const visibleDays = pulse.dailySeries.slice(-14);
  const maxDayMsgs = Math.max(1, ...visibleDays.map((d) => d.totalMessages));

  const vitalItems = pareto.items.filter((item) => item.isVitalFew80);
  const displayedPriorityItems = showAllParetoItems
    ? pareto.items
    : vitalItems.length >= 3
    ? vitalItems
    : pareto.items.slice(0, 3);
  const maxPriorityShare = Math.max(1, ...pareto.items.map((item) => item.sharePct));

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16">
      {/* ── CLEAN 1-ROW HEADER WITH TOP TECH FILTER ── */}
      <header className="bg-white border-b border-slate-200/80 px-6 py-3.5 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-base font-black text-slate-900 tracking-tight">
              Control de Soporte &amp; Producto
            </h1>

            {/* Segmented Technician Switcher */}
            <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/70">
              {[
                { id: 'all', label: 'Todo el equipo' },
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
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${active
                      ? 'bg-white text-indigo-700 shadow-2xs'
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
            <button
              type="button"
              onClick={() => setShowRulesPanel((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${showRulesPanel
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Reglas
            </button>

            <button
              type="button"
              onClick={() => navigate('/support/chat')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 transition"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Chat WhatsApp
            </button>

            <button
              type="button"
              onClick={() => navigate('/support/tickets')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition"
            >
              <TicketIcon className="w-3.5 h-3.5" />
              Tickets
            </button>

            <select
              value={daysRange}
              onChange={(e) => setDaysRange(Number(e.target.value))}
              className="px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-xl text-slate-700"
            >
              <option value={7}>7 días</option>
              <option value={15}>15 días</option>
              <option value={30}>30 días</option>
              <option value={60}>60 días</option>
              <option value={120}>4 meses</option>
            </select>

            <button
              type="button"
              onClick={loadIntelligenceData}
              title="Actualizar datos"
              className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-100 border border-slate-200 bg-white transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 pt-5 space-y-5">
        {/* ── COLLAPSIBLE OPERATING RULES ── */}
        {showRulesPanel && (
          <div className="bg-white rounded-2xl border border-indigo-200 p-4 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-black text-slate-900">
                Reglas Operativas (Cortar chats largos + Escalar bugs a Jimmy)
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={copyOfficialNoAudioPolicy}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
                >
                  <MicOff className="w-3.5 h-3.5 text-purple-600" />
                  Copiar Regla Sin Audios
                </button>
                <button
                  type="button"
                  onClick={copyOperatingRules}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copiar 3 reglas para Melvin
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {SUPPORT_OPERATING_RULES.map((rule) => (
                <div
                  key={rule.id}
                  className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 space-y-1"
                >
                  <p className="text-xs font-black text-indigo-900">{rule.title}</p>
                  <p className="text-[11px] font-semibold text-slate-500">{rule.trigger}</p>
                  <p className="text-xs text-slate-700 pt-0.5">{rule.action}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* BLOQUE 1 · SEMÁFORO 2 SEGUNDOS: ¿MEJORANDO PRODUCTO O APAGANDO FUEGOS? */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <section className="space-y-3">
          <div className={`rounded-2xl border p-5 shadow-2xs space-y-4 ${verdictStyles}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {totals.verdictTone === 'good' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle
                      className={`w-5 h-5 shrink-0 ${totals.verdictTone === 'critical' ? 'text-rose-600' : 'text-amber-600'
                        }`}
                    />
                  )}
                  <h2 className="text-base font-black tracking-tight">{totals.verdictTitle}</h2>
                </div>
                <p className="text-xs opacity-85">{totals.verdictDetail}</p>
              </div>

              <div className="text-right shrink-0">
                <p className="text-[11px] font-bold uppercase opacity-70">Meta ideal</p>
                <p className="text-xs font-black">
                  🟢 {totals.targetBuildPct}–90% Mejoras · 🔴 ≤{totals.targetReactivePct}% Errores
                </p>
              </div>
            </div>

            {/* Unified 2-color progress meter (with 80% target line) */}
            <div className="bg-white/90 rounded-xl p-3.5 border border-black/5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-black">
                <span className="text-emerald-700">
                  🟢 Construyendo / Mejoras P4 + Go-Live: {totals.buildPct}% ({totals.buildHours}h)
                </span>
                <span className="text-rose-700">
                  🔴 Resolviendo Errores + Chat: {totals.reactivePct}% ({totals.totalReactiveHours}h)
                  <span className="font-semibold text-slate-500">
                    {' '}
                    ({totals.ticketReactiveHours}h tickets + ~{totals.unloggedChatHours}h WA sin ticket)
                  </span>
                </span>
              </div>

              <div className="relative h-4 w-full rounded-full bg-slate-100 overflow-hidden flex">
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
                  title={`Meta: ${totals.targetBuildPct}% construyendo producto`}
                  className="absolute top-0 bottom-0 w-0.5 bg-slate-900/70"
                />
              </div>

              {/* 3 minimal clarity metrics below the bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
                <span className="font-semibold text-slate-700">
                  🔄 Clientes que regresan:{' '}
                  <strong className={totals.returningClientsCount > 0 ? 'text-rose-700' : 'text-emerald-700'}>
                    {totals.returningClientsCount} de {totals.activeClientsCount} ({totals.returningPct}%)
                  </strong>
                </span>
                <span className="font-semibold text-slate-700">
                  💬 WhatsApp ({daysRange}d):{' '}
                  <strong>{pulse.summary.avgClientsPerDay} clientes/día</strong> · Hoy:{' '}
                  <strong>{pulse.summary.todayClients}</strong> ·{' '}
                  <strong className={pulse.summary.pingPongCount > 0 ? 'text-rose-700' : 'text-slate-800'}>
                    {pulse.summary.pingPongCount} ping-pong (≥12 msgs/día)
                  </strong>
                </span>
                <span className="font-semibold text-slate-700">
                  🐛 Escalados para Jimmy:{' '}
                  <strong className={pulse.summary.pendingDevCount > 0 ? 'text-rose-700' : 'text-emerald-700'}>
                    {pulse.summary.pendingDevCount} pendientes
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Compact Side-by-Side: Melvin vs. Gerson (Always shows true numbers) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {overview.techSummaries.map((tech) => {
              const isSelected = selectedTechFilter === tech.techName;
              return (
                <button
                  key={tech.techName}
                  type="button"
                  onClick={() => {
                    const next = isSelected ? 'all' : tech.techName;
                    setSelectedTechFilter(next);
                    setExpandedClientKey(null);
                  }}
                  className={`text-left bg-white rounded-2xl p-4 border transition ${isSelected
                    ? 'border-indigo-600 ring-2 ring-indigo-500/15'
                    : selectedTechFilter !== 'all'
                      ? 'border-slate-200/80 opacity-60 hover:opacity-100'
                      : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-slate-900 text-white font-black text-xs flex items-center justify-center">
                        {tech.techName
                          .split(' ')
                          .map((w) => w[0])
                          .join('')}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">{tech.techName}</p>
                        <p className="text-[11px] font-semibold text-slate-500">
                          WA: {tech.waClients} clientes · {tech.waMessages} msgs · Tickets: {tech.totalTickets} ({tech.openTickets} abiertos)
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs font-black">
                        <span className="text-emerald-700">{tech.buildPct}% Mejoras</span>
                        <span className="text-slate-300 mx-1">·</span>
                        <span className={tech.reactivePct > 20 ? 'text-rose-600' : 'text-slate-700'}>
                          {tech.reactivePct}% Errores
                        </span>
                      </p>
                      <p className="text-[10.5px] font-semibold text-slate-400">
                        {isSelected ? '✓ Filtrando toda la vista' : 'Clic para filtrar'}
                      </p>
                    </div>
                  </div>

                  {/* Mini 2-color split bar */}
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden flex mt-3">
                    {tech.buildPct > 0 && (
                      <div style={{ width: `${tech.buildPct}%` }} className="bg-emerald-500 h-full" />
                    )}
                    {tech.reactivePct > 0 && (
                      <div style={{ width: `${tech.reactivePct}%` }} className="bg-rose-500 h-full" />
                    )}
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-slate-600">
                    <span>
                      🟢 Mejoras: <strong className="text-slate-900">{tech.buildHours}h</strong> · 🔴 Errores/Chat:{' '}
                      <strong className="text-slate-900">{tech.totalReactiveHours}h</strong>
                    </span>
                    <span>
                      🔄 <strong className={tech.returningClientsCount > 0 ? 'text-rose-700' : 'text-emerald-700'}>{tech.returningClientsCount}</strong> reincidentes · 🔥{' '}
                      <strong className={tech.pingPongCount > 0 ? 'text-rose-700' : 'text-slate-800'}>{tech.pingPongCount}</strong> ping-pong
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* BLOQUE 2A · PARETO 80/20: QUÉ RESOLVER DE RAÍZ PRIMERO               */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-2xl border border-slate-200/75 p-5 sm:p-6 shadow-2xs space-y-5">
          {/* Header row: clean title + metric toggle + copy action */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-black text-slate-900 tracking-tight">
                  Pareto 80/20 · Qué errores resolver de raíz primero
                </h3>
                {selectedTechFilter !== 'all' && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                    Solo {selectedTechFilter.split(' ')[0]}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Patrones reales de WhatsApp y tickets en los últimos {daysRange} días
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/70">
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
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                        active
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition"
                >
                  <Copy className="w-3.5 h-3.5 text-indigo-600" />
                  Copiar plan 80/20
                </button>
              )}
            </div>
          </div>

          {pareto.items.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400 font-medium">
              Sin fallas reactivas registradas en los últimos {daysRange} días.
            </div>
          ) : (
            <>
              {/* 2-second Executive Headline Strip */}
              <div className="rounded-xl bg-gradient-to-r from-rose-50/75 via-slate-50/60 to-indigo-50/50 border border-slate-200/80 px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-rose-100/90 text-rose-600 flex items-center justify-center shrink-0">
                    <Target className="w-4 h-4" />
                  </div>
                  <p className="text-sm font-bold text-slate-900 leading-snug">
                    {pareto.headline}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-bold shrink-0 flex-wrap">
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200/80 text-rose-700">
                    {pareto.vitalFewCount} foco{pareto.vitalFewCount === 1 ? '' : 's'} clave (80%)
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200/80 text-slate-700">
                    ~{pareto.vitalFewHoursSaved}h recuperables
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200/80 text-slate-700">
                    {pareto.vitalFewClientsImpacted} cliente{pareto.vitalFewClientsImpacted === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              {/* Minimalist Composed Pareto Chart */}
              <div className="space-y-2">
                <div className="w-full h-[265px] min-w-0">
                  <ResponsiveContainer width="100%" height={265}>
                    <ComposedChart
                      data={paretoChartData}
                      margin={{ top: 14, right: 12, left: -8, bottom: 6 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis
                        dataKey="shortLabel"
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                        height={34}
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
                        strokeOpacity={0.55}
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
                        radius={[8, 8, 0, 0]}
                        maxBarSize={52}
                        className="cursor-pointer"
                        onClick={(_barData, index) => {
                          const target = paretoChartData[index];
                          if (target) {
                            setSelectedPatternKey((prev) =>
                              prev === target.patternKey ? null : target.patternKey,
                            );
                          }
                        }}
                      >
                        {paretoChartData.map((entry) => {
                          const isSelected = selectedPatternKey === entry.patternKey;
                          const dimmed =
                            Boolean(selectedPatternKey) && selectedPatternKey !== entry.patternKey;
                          const fill = isSelected
                            ? entry.isVitalFew80
                              ? '#BE123C'
                              : '#475569'
                            : entry.isVitalFew80
                            ? '#F43F5E'
                            : '#CBD5E1';
                          return (
                            <Cell
                              key={entry.patternKey}
                              fill={fill}
                              fillOpacity={dimmed ? 0.45 : 1}
                            />
                          );
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

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 px-1">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                      <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" />
                      Prioridad 80% (resolver primero)
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-slate-300 inline-block" />
                      Cola restante (20%)
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-semibold text-indigo-700">
                      <span className="w-3 h-0.5 bg-indigo-600 inline-block" />
                      % Acumulado
                    </span>
                  </div>
                  <span className="text-slate-400">
                    Haz clic en cualquier barra o tarjeta para ver evidencia real
                  </span>
                </div>
              </div>

              {/* Clean Priority Cards Grid */}
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {displayedPriorityItems.map((item) => {
                    const rank = pareto.items.findIndex((i) => i.patternKey === item.patternKey) + 1;
                    const isSelected = selectedPatternKey === item.patternKey;
                    const widthPct = Math.max(8, Math.round((item.sharePct / maxPriorityShare) * 100));
                    return (
                      <button
                        key={item.patternKey}
                        type="button"
                        onClick={() =>
                          setSelectedPatternKey((prev) =>
                            prev === item.patternKey ? null : item.patternKey,
                          )
                        }
                        className={`text-left rounded-xl p-3.5 border transition ${
                          isSelected
                            ? 'bg-rose-50/50 border-rose-300 ring-2 ring-rose-500/15'
                            : 'bg-slate-50/60 hover:bg-slate-50 border-slate-200/70 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-5 h-5 rounded-md text-[10.5px] font-black flex items-center justify-center shrink-0 ${
                                item.isVitalFew80
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-slate-200/80 text-slate-600'
                              }`}
                            >
                              {rank}
                            </span>
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {item.label}
                            </span>
                          </div>
                          <span className="text-xs font-black text-slate-800 shrink-0">
                            {item.sharePct}%
                          </span>
                        </div>

                        <div className="h-1 w-full rounded-full bg-slate-200/75 overflow-hidden my-2.5">
                          <div
                            style={{ width: `${widthPct}%` }}
                            className={`h-full rounded-full ${
                              item.isVitalFew80 ? 'bg-rose-500' : 'bg-slate-400'
                            }`}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                          <span>
                            <strong className="text-slate-700">{item.reactiveHours}h</strong> ·{' '}
                            {item.clientCount} cliente{item.clientCount === 1 ? '' : 's'} ·{' '}
                            {item.messageCount + item.ticketCount} rep.
                          </span>
                          <span className="text-indigo-600 font-semibold">
                            Acum. {item.cumulativePct}%
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {pareto.items.length > displayedPriorityItems.length || showAllParetoItems ? (
                  pareto.items.length > 3 && pareto.items.length > vitalItems.length && (
                    <div className="flex justify-center pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAllParetoItems((v) => !v)}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
                      >
                        {showAllParetoItems
                          ? 'Mostrar solo focos principales'
                          : `Ver todas las categorías (${pareto.items.length})`}
                      </button>
                    </div>
                  )
                ) : null}
              </div>

              {/* 1-Click Drill-Down Evidence Panel */}
              {selectedParetoItem && (
                <div className="rounded-xl bg-slate-50/90 border border-slate-200/85 p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold ${
                          selectedParetoItem.isVitalFew80
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {selectedParetoItem.isVitalFew80 ? 'Prioridad 80%' : 'Resto 20%'}
                      </span>
                      <h4 className="text-sm font-black text-slate-900">
                        {selectedParetoItem.label}
                      </h4>
                      <span className="text-xs text-slate-500 font-medium">
                        {selectedParetoItem.reactiveHours}h · {selectedParetoItem.clientCount}{' '}
                        clientes · {selectedParetoItem.messageCount} msgs ·{' '}
                        {selectedParetoItem.ticketCount} tickets
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleFilterClientsByPattern(selectedParetoItem.patternKey)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                          tablePatternFilter === selectedParetoItem.patternKey
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'
                        }`}
                      >
                        <Filter className="w-3.5 h-3.5" />
                        {tablePatternFilter === selectedParetoItem.patternKey
                          ? 'Quitando filtro abajo'
                          : 'Ver estos clientes abajo'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedPatternKey(null)}
                        title="Cerrar evidencia"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Affected Clients */}
                    <div className="lg:col-span-5 space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Clientes afectados ({selectedParetoItem.clients.length})
                      </p>
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {selectedParetoItem.clients.slice(0, 8).map((c) => (
                          <div
                            key={c.clientKey}
                            className="bg-white border border-slate-200/75 rounded-xl px-3 py-2 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate">
                                {c.clientName}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {c.reactiveHours}h · {c.messages} msgs
                                {c.tickets > 0 ? ` · ${c.tickets} ticket(s)` : ''}
                              </p>
                            </div>
                            {c.circleId && (
                              <button
                                type="button"
                                onClick={() =>
                                  navigate('/support/chat', { state: { waCircleId: c.circleId } })
                                }
                                className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] shrink-0 transition"
                              >
                                Chat →
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Real Evidence Quotes */}
                    <div className="lg:col-span-7 space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Reportes reales recientes
                      </p>
                      {selectedParetoItem.examples.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-4">
                          Sin extractos de texto detallados en este período.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {selectedParetoItem.examples.map((ex, idx) => (
                            <div
                              key={`${ex.clientName}-${idx}`}
                              className="bg-white border border-slate-200/75 rounded-xl p-3 space-y-1"
                            >
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-bold text-slate-900 truncate">
                                    {ex.clientName}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold shrink-0">
                                    {ex.source === 'whatsapp' ? 'WhatsApp' : 'Ticket'}
                                  </span>
                                </div>
                                <span className="text-slate-400 shrink-0">
                                  {new Date(ex.at).toLocaleDateString('es-SV', {
                                    day: '2-digit',
                                    month: 'short',
                                  })}
                                </span>
                              </div>
                              <p className="text-xs text-slate-700 leading-relaxed">
                                &ldquo;{ex.text}&rdquo;
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* BLOQUE 2B · RITMO DIARIO WHATSAPP + BUGS ESCALADOS A JIMMY          */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Daily Rhythm */}
          <div className="bg-white rounded-2xl border border-slate-200/75 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2.5">
                <span className="text-xs font-black uppercase tracking-wide text-slate-800">
                  Ritmo diario WhatsApp ({visibleDays.length}d)
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  Rojo = día con chat ping-pong
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
                      className="flex flex-col items-center justify-end rounded-lg bg-slate-50 border border-slate-100 py-1 px-0.5"
                    >
                      <span className="text-[9.5px] font-black text-slate-700">{d.totalMessages}</span>
                      <div className="w-full h-9 flex items-end justify-center my-0.5">
                        <div
                          style={{ height: `${hPct}%` }}
                          className={`w-2.5 rounded-t ${d.pingPongChats > 0
                            ? 'bg-rose-500'
                            : d.totalMessages > 0
                              ? 'bg-indigo-500'
                              : 'bg-slate-200'
                            }`}
                        />
                      </div>
                      <span className="text-[9px] font-bold text-emerald-700">{d.activeClients}c</span>
                      <span className="text-[8.5px] text-slate-400 truncate max-w-full">
                        {d.label.split(' ')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Jimmy's Escalation Queue */}
          <div className="bg-white rounded-2xl border border-slate-200/75 p-4 flex flex-col">
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <Bug className="w-4 h-4 text-rose-600" />
                <h3 className="text-xs font-black uppercase tracking-wide text-slate-800">
                  Bugs escalados para Jimmy (Botón &quot;Causa&quot; en chat)
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-slate-100 text-slate-700">
                {pulse.rootCauseQueue.pendingForDev.length} pendientes
              </span>
            </div>

            {pulse.rootCauseQueue.pendingForDev.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium py-5">
                Sin bugs escalados manualmente todavía. Usa el botón <strong>Causa</strong> en el Chat WhatsApp cuando un error de sistema requiera arreglo definitivo.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto pt-1">
                {pulse.rootCauseQueue.pendingForDev.map((item) => {
                  const rcMeta = SUPPORT_ROOT_CAUSE_META[item.type];
                  const itemKey = `${item.ticketId}:${item.entryId}`;
                  const isSaving = resolvingEntryKey === itemKey;
                  return (
                    <div key={itemKey} className="py-2 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-black border ${rcMeta.badgeClass}`}
                          >
                            {rcMeta.shortLabel}
                          </span>
                          <span className="text-xs font-black text-slate-900 truncate">
                            {item.clientName}
                          </span>
                          <span className="text-[10.5px] text-slate-400">
                            · {item.byName.split(' ')[0]}
                          </span>
                        </div>
                        {item.note && (
                          <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{item.note}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.circleId && (
                          <button
                            type="button"
                            onClick={() => navigate('/support/chat', { state: { waCircleId: item.circleId } })}
                            className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px]"
                          >
                            Chat
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleMarkDevResolved(item)}
                          className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-[11px] disabled:opacity-50"
                        >
                          {isSaving ? '...' : '✓ Resuelto'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* BLOQUE 3 · 1 SOLA TABLA UNIFICADA DE CLIENTES (CHAT + TICKETS)       */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <section
          id="client-health-section"
          className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
        >
          <div className="p-4 border-b border-slate-200/80 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'all' as HealthFilter, label: `Todos los Clientes (${clientHealthCounts.all})` },
                { id: 'critical' as HealthFilter, label: `🔴 Reincidentes (${clientHealthCounts.critical})` },
                { id: 'open' as HealthFilter, label: `🔥 Con Abiertos (${clientHealthCounts.open})` },
                { id: 'stable' as HealthFilter, label: `🟢 Estables (${clientHealthCounts.stable})` },
              ].map((pill) => {
                const active = healthFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setHealthFilter(pill.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${active
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
                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200"
                >
                  Error: {activeTablePattern.shortLabel} ×
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
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-medium"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {visibleClients.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400 font-semibold">
                No hay clientes con este filtro.
              </div>
            ) : (
              visibleClients.map((client) => {
                const isExpanded = expandedClientKey === client.clientKey;
                const badgeClass =
                  client.health === 'critical'
                    ? 'bg-rose-100 text-rose-700 border-rose-200'
                    : client.health === 'watch'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200';
                return (
                  <div key={client.clientKey}>
                    <div
                      className={`px-5 py-3 flex flex-wrap items-center justify-between gap-3 transition ${isExpanded ? 'bg-indigo-50/40' : 'hover:bg-slate-50'
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
                          className={`px-2 py-0.5 rounded-md text-[10.5px] font-black border shrink-0 ${badgeClass}`}
                        >
                          {client.health === 'critical'
                            ? 'Reincidente'
                            : client.health === 'watch'
                              ? 'Atención'
                              : 'Estable'}
                        </span>

                        <span className="text-sm font-black text-slate-900 truncate">
                          {client.clientName}
                        </span>

                        <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-slate-100 text-slate-600 shrink-0">
                          {client.primaryModuleLabel}
                        </span>

                        {client.isPingPong && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black shrink-0">
                            <Flame className="w-3 h-3" />
                            {client.peakDayMessages} msgs ({client.peakDayLabel})
                          </span>
                        )}

                        {client.distinctDaysReported >= 2 && (
                          <span className="text-[11px] font-bold text-rose-700 shrink-0 hidden md:inline">
                            · Volvió {client.distinctDaysReported} días
                          </span>
                        )}
                      </button>

                      <div className="flex items-center gap-3 text-xs shrink-0">
                        <span className="text-slate-500 font-semibold hidden sm:inline">
                          {client.primaryTech.split(' ')[0]}
                        </span>

                        {client.waMessages > 0 && (
                          <span className="text-slate-600 font-semibold">
                            {client.waMessages} msgs
                          </span>
                        )}

                        <span
                          title={`${client.ticketReactiveHours}h en tickets + ~${client.unloggedChatHours}h chat WA sin ticket`}
                          className="font-black text-slate-900"
                        >
                          {client.totalReactiveHours}h{' '}
                          <span className="text-[10.5px] font-normal text-slate-400">soporte</span>
                        </span>

                        {client.openTickets > 0 && (
                          <span className="px-2 py-0.5 rounded-md text-[10.5px] font-black bg-red-600 text-white">
                            {client.openTickets} abiertos
                          </span>
                        )}

                        {client.circleId && (
                          <button
                            type="button"
                            onClick={() =>
                              navigate('/support/chat', { state: { waCircleId: client.circleId } })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] transition"
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
                            <strong>Diagnóstico:</strong> {client.healthReason} · Mensajes WA:{' '}
                            {client.waMessages} (Cliente {client.waClientMsgs} / Equipo {client.waStaffMsgs}) · Tiempo chat ~{client.waEstHours}h
                          </span>
                          {client.buildHours > 0 && (
                            <span className="font-bold text-emerald-700">
                              + {client.buildHours}h en Mejoras / Go-Live
                            </span>
                          )}
                        </div>

                        {client.records.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">
                            Solo conversaciones por WhatsApp (sin tickets formales registrados en el período).
                          </p>
                        ) : (
                          <div className="bg-white rounded-xl border border-slate-200/80 overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="border-b border-slate-200/80 text-[10px] font-black uppercase text-slate-400 bg-slate-50/50">
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
                                      <span className="font-bold text-slate-700">
                                        {new Date(rec.createdAt).toLocaleDateString('es-SV', {
                                          day: '2-digit',
                                          month: 'short',
                                        })}
                                      </span>
                                      <span
                                        className={`ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${rec.status === 'resolved'
                                          ? 'bg-emerald-50 text-emerald-700'
                                          : 'bg-red-50 text-red-600'
                                          }`}
                                      >
                                        {rec.status === 'resolved' ? 'Cerrado' : 'Abierto'}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 whitespace-nowrap">
                                      <span
                                        className="px-2 py-0.5 rounded text-[10px] font-black text-white"
                                        style={{ backgroundColor: rec.ticketCategoryColor }}
                                      >
                                        {rec.ticketCategoryCode}
                                      </span>
                                      <span className="ml-1.5 text-[11px] text-slate-500">
                                        {rec.workBucketLabel}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 max-w-sm">
                                      <p className="font-bold text-slate-900 truncate">{rec.title}</p>
                                      {rec.solution && (
                                        <p className="text-[11px] text-slate-500 truncate">
                                          {rec.solution}
                                        </p>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 whitespace-nowrap font-semibold text-slate-700">
                                      {rec.techName.split(' ')[0]}
                                    </td>
                                    <td className="py-2 px-3 whitespace-nowrap font-bold text-slate-800">
                                      {rec.reportedHours}h
                                      {rec.aiTimeStatus === 'inflated' && (
                                        <span className="ml-1.5 px-1 py-0.5 rounded text-[9.5px] bg-rose-100 text-rose-700">
                                          +{rec.diffAiHours}h vs IA
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 text-right whitespace-nowrap">
                                      {rec.rawTicket && (
                                        <button
                                          type="button"
                                          onClick={() => setSelectedTicketForDrawer(rec.rawTicket!)}
                                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px]"
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

            {/* Collapsible Internal P4 Dev Tasks */}
            {overview.internalDev.count > 0 && (
              <div className="bg-slate-50/70">
                <button
                  type="button"
                  onClick={() => setShowInternalTasks((v) => !v)}
                  className="w-full text-left px-5 py-3 flex items-center justify-between text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  <span className="inline-flex items-center gap-2">
                    <ShieldAlert className="w-3.5 h-3.5 text-emerald-600" />
                    Desarrollo Interno &amp; Mejoras P4 (Sin cliente · incluidas en 🟢 Mejoras):{' '}
                    {overview.internalDev.count} tareas · {overview.internalDev.totalHours}h
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
                        <span className="font-semibold text-slate-800 truncate">
                          {rec.title}{' '}
                          <span className="text-slate-400">({rec.techName.split(' ')[0]})</span>
                        </span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-bold text-emerald-700">{rec.reportedHours}h</span>
                          {rec.rawTicket && (
                            <button
                              type="button"
                              onClick={() => setSelectedTicketForDrawer(rec.rawTicket!)}
                              className="text-indigo-600 font-bold"
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

      {/* Ticket Drawer */}
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
              onCreateSubticket={() => { }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportIntelligence;
