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
  Clock,
  AlertTriangle,
  Sparkles,
  MicOff,
  Ticket as TicketIcon,
} from 'lucide-react';
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

type WorkBucket = 'text_reply' | 'implementation' | 'troubleshooting' | 'development';

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
  ticketCategoryCode: string; // 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'FAQ'
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
  timeJustification: string;
  categoryKey: string;
  categoryLabel: string;
  hasVoiceNote: boolean;
  findings: string;
  rootCause: string;
  solution: string;
  hasResolutionReport: boolean;
  closedWithoutResolution: boolean;
  closedWithoutTime: boolean;
  isRepeatForSameClient: boolean;
  repeatSequenceNumber: number;
}

interface ClientAccordionSummary {
  clientName: string;
  isInternalGroup: boolean;
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  repeatReturnsCount: number;
  firstTimeRightPct: number;
  totalReportedHours: number;
  totalExpectedAiHours: number;
  totalDiffAiHours: number;
  inflatedCount: number;
  missingTimeCount: number;
  textReplyHours: number;
  implementationHours: number;
  troubleshootingHours: number;
  developmentHours: number;
  categoryPills: { code: string; count: number; color: string }[];
  techSummaryText: string;
  records: UnifiedSupportRecord[];
}

interface TechExecutiveCard {
  techName: string;
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  textReplyHours: number;
  textReplyCount: number;
  implementationHours: number;
  implementationCount: number;
  troubleshootingHours: number;
  troubleshootingCount: number;
  developmentHours: number;
  developmentCount: number;
  firstTimeRightPct: number;
  clientReturnedCount: number;
  totalReportedHours: number;
  totalExpectedAiHours: number;
  totalDiffAiHours: number;
  inflatedTicketsCount: number;
  missingTimeClosedCount: number;
}

function normalizeClientDisplayName(raw: string): string {
  const clean = raw.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const lower = clean.toLowerCase();

  if (/arg[oó]z|argos/i.test(lower)) return 'Corporación Argoz';
  if (/cartopaq|cartopack/i.test(lower)) return 'Cartopaq';
  if (/don\s+carret[oó]n/i.test(lower)) return 'Don Carretón';
  if (/la\s+econ[oó]mica/i.test(lower)) return 'La Económica';
  if (/medicina\s+popular/i.test(lower)) return 'Medicina Popular';
  if (/conta\s*ohs/i.test(lower)) return 'Conta OHS';
  if (/salinera\s+san\s+jorge/i.test(lower)) return 'Salinera San Jorge';
  if (/moda\s+[ií]ntima/i.test(lower)) return 'Moda Íntima';
  if (/udp\s+volea/i.test(lower)) return 'UDP Volea';
  if (/marisela\s+lino/i.test(lower)) return 'Marisela Lino';
  if (/labelimend/i.test(lower)) return 'Labelimend';
  if (/wilfredo\s+valiente/i.test(lower)) return 'Wilfredo Valiente';
  if (/gaco\s+y\s+jeco/i.test(lower)) return 'Gaco y Jeco';
  if (/transportes\s+rivera/i.test(lower)) return 'Transportes Rivera';
  if (/corpo\s+auto/i.test(lower)) return 'Corpo Auto';
  if (/texaco\s+el\s+triunfo|gasolinera\s+el\s+triunfo/i.test(lower)) return 'Texaco El Triunfo';
  if (/multiservicios\s+integrales/i.test(lower)) return 'Multiservicios Integrales';
  if (/inversiones\s+diversas\s+del\s+mar/i.test(lower)) return 'Inversiones Diversas del Mar';
  if (/comercial\s+mendez/i.test(lower)) return 'Comercial Méndez';
  if (/prisma\s+hielo/i.test(lower)) return 'Prisma Hielo';
  if (/panader[ií]a\s+santa\s+eduviges/i.test(lower)) return 'Panadería Santa Eduviges';
  if (/erp\s*-\s*gasolineras/i.test(lower)) return 'ERP - Gasolineras';
  if (/inmalux/i.test(lower)) return 'Inmalux';
  if (/facturaci[oó]n\s+clientes\s+varios/i.test(lower)) return 'Facturación Clientes Varios';

  return clean
    .split(' ')
    .map((w) => (w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function inferClientAndScope(
  leadName?: string | null,
  projectName?: string | null,
  title?: string,
  description?: string,
  categoryCode?: string,
  knownLeads: string[] = []
): { clientName: string; isInternalSystemTask: boolean } {
  const combined = `${title || ''} ${description || ''} ${projectName || ''} ${leadName || ''}`;

  if (/arg[oó]z|argos/i.test(combined)) {
    return { clientName: 'Corporación Argoz', isInternalSystemTask: false };
  }

  if (leadName && leadName.trim().length > 1 && !/general|interno|sin cliente/i.test(leadName)) {
    return {
      clientName: normalizeClientDisplayName(leadName.replace(/\(\+\d+\)/g, '').trim()),
      isInternalSystemTask: false,
    };
  }

  if (title) {
    const colonPrefixMatch = title.match(
      /^(?:soporte\s+t[eé]cnico|error\s+reportado|capacitaci[oó]n(?:\s+presencial|\s+virtual)?|pregunta\s+frecuente|implementaci[oó]n|go\s*live|solicitud(?:\s+de\s+cliente)?|configuraci[oó]n|migraci[oó]n|revisi[oó]n|dte|facturaci[oó]n)\s*:\s*([^-\n(|]+)/i
    );
    if (colonPrefixMatch && colonPrefixMatch[1]) {
      const extracted = colonPrefixMatch[1].trim();
      if (extracted.length >= 2 && !/^(general|interno|sistema|error|prueba)$/i.test(extracted)) {
        return { clientName: normalizeClientDisplayName(extracted), isInternalSystemTask: false };
      }
    }

    const waMatch = title.match(/\[WhatsApp[^\]]*\]\s*([^:(]+?)(?:\s*\(\+\d+\))?\s*:/i);
    if (waMatch && waMatch[1] && waMatch[1].trim().length > 2) {
      return {
        clientName: normalizeClientDisplayName(waMatch[1].trim()),
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
      clientName: normalizeClientDisplayName(projectName.trim()),
      isInternalSystemTask: false,
    };
  }

  for (const lead of knownLeads) {
    if (lead && lead.length >= 4 && combined.toLowerCase().includes(lead.toLowerCase())) {
      return { clientName: normalizeClientDisplayName(lead), isInternalSystemTask: false };
    }
  }

  const knownClientRegexes = [
    /don\s+carret[oó]n/i,
    /la\s+econ[oó]mica/i,
    /medicina\s+popular/i,
    /conta\s*ohs/i,
    /salinera\s+san\s+jorge/i,
    /moda\s+[ií]ntima/i,
    /udp\s+volea/i,
    /marisela\s+lino/i,
    /labelimend/i,
    /wilfredo\s+valiente/i,
    /gaco\s+y\s+jeco/i,
    /transportes\s+rivera/i,
    /corpo\s+auto/i,
    /texaco\s+el\s+triunfo/i,
    /multiservicios\s+integrales/i,
    /inversiones\s+diversas\s+del\s+mar/i,
    /comercial\s+mendez/i,
    /prisma\s+hielo/i,
    /panader[ií]a\s+santa\s+eduviges/i,
    /inmalux/i,
  ];
  for (const rx of knownClientRegexes) {
    const m = combined.match(rx);
    if (m) return { clientName: normalizeClientDisplayName(m[0]), isInternalSystemTask: false };
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
  description: string
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
  categoryCode: string
): { bucket: WorkBucket; label: string } {
  const text = `${title} ${description}`.toLowerCase();
  if (
    categoryCode === 'FAQ' ||
    /^pregunta\s+frecuente/i.test(title) ||
    /consulta|duda|respondiendo\s+texto/i.test(text)
  ) {
    return { bucket: 'text_reply', label: '💬 Textos / Consultas' };
  }
  if (
    /^go\s*live|^capacitaci[oó]n|^implementaci[oó]n/i.test(title) ||
    /go\s*live|capacitaci[oó]n|implementaci[oó]n|entrenamiento/i.test(text)
  ) {
    return { bucket: 'implementation', label: '🚀 Implementación / Go-Live' };
  }
  if (categoryCode === 'P4') {
    return { bucket: 'development', label: '⚙️ Desarrollo P4' };
  }
  return { bucket: 'troubleshooting', label: '🛠️ Solución de Falla' };
}

function classifyProblemTopic(title: string, description: string): {
  categoryKey: string;
  categoryLabel: string;
} {
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

// Normalize technician name so ONLY real support engineers (Melvin, Gerson) or "Sin asignar" appear
function resolveSupportEngineerName(rawName: string, titleText: string): string {
  const combined = `${rawName} ${titleText}`.toLowerCase();
  if (combined.includes('melvin')) return 'Melvin Rodriguez';
  if (combined.includes('gerson')) return 'Gerson Gutierrez';
  return 'Sin asignar';
}

export const SupportIntelligence: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const activeCompanyId = profile?.company_id;

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<UnifiedSupportRecord[]>([]);
  const [rawTicketsList, setRawTicketsList] = useState<Ticket[]>([]);
  const [categoriesList, setCategoriesList] = useState<TicketCategory[]>([]);
  const [agentsList, setAgentsList] = useState<CompanyAgent[]>([]);
  const [leadsList, setLeadsList] = useState<TicketLead[]>([]);

  const [selectedTicketForDrawer, setSelectedTicketForDrawer] = useState<Ticket | null>(null);

  // Clean Single-Row Filters
  const [activeFilterPill, setActiveFilterPill] = useState<string>('all'); // 'all' | 'P1' | 'P2' | 'P3' | 'FAQ' | 'P4' | 'inflated' | 'repeat' | 'missing_time'
  const [selectedTechFilter, setSelectedTechFilter] = useState<string>('all');
  const [daysRange, setDaysRange] = useState<number>(60);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Accordion state (Corporación Argoz open by default)
  const [expandedClientName, setExpandedClientName] = useState<string | null>('Corporación Argoz');
  const [showInternalTasksAccordion, setShowInternalTasksAccordion] = useState<boolean>(false);

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

      const [profsRes, leadsRes, catsRes, ticketsRes, projectsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email, role, avatar_url')
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
          .gte('created_at', cutoffIso)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('crm_projects')
          .select('id, name')
          .eq('company_id', activeCompanyId),
      ]);

      const profs = (profsRes.data || []) as CompanyAgent[];
      const leads = (leadsRes.data || []) as TicketLead[];
      const cats = (catsRes.data || []) as TicketCategory[];
      const rawTickets = (ticketsRes.data || []) as Ticket[];
      const projects = projectsRes.data || [];

      setAgentsList(profs);
      setLeadsList(leads);
      setCategoriesList(cats);
      setRawTicketsList(rawTickets);

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
            projects.map((p: any) => p.id)
          )
          .gte('created_at', cutoffIso)
          .order('created_at', { ascending: false })
          .limit(350);
        projectTasks = cTasks || [];
      }

      const unified: UnifiedSupportRecord[] = [];
      const seenIds = new Set<string>();

      // 1. Formal Tickets
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
          knownLeadNames
        );

        const topic = classifyProblemTopic(t.title || '', t.description || '');
        const workInfo = classifyWorkBucket(t.title || '', t.description || '', catInfo.code);

        const reportedHours = +(Number(t.actual_hours) || 0).toFixed(2);
        const aiAudit = computeTicketAiTimeBenchmark(
          t.title || '',
          t.description || '',
          catInfo.label,
          reportedHours
        );

        const meta = t.metadata || {};
        const findingsStr = String(t.findings || '').trim();
        const rootCauseStr = String(t.root_cause || '').trim();
        const solutionStr = String(t.solution || '').trim();
        const hasResReport =
          findingsStr.length >= 3 && rootCauseStr.length >= 3 && solutionStr.length >= 3;

        const hasAudio =
          /\[Audio\s*\/\s*Nota\s+de\s+voz\]|nota\s+de\s+voz|audioMessage/i.test(
            `${t.title || ''} ${t.description || ''}`
          ) || Boolean(meta.has_audio);

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
          timeJustification: String(meta.time_justification || ''),
          categoryKey: topic.categoryKey,
          categoryLabel: topic.categoryLabel,
          hasVoiceNote: hasAudio,
          findings: findingsStr,
          rootCause: rootCauseStr,
          solution: solutionStr,
          hasResolutionReport: hasResReport,
          closedWithoutResolution: isClosedOrResolved && !hasResReport,
          closedWithoutTime: isClosedOrResolved && reportedHours <= 0,
          isRepeatForSameClient: false,
          repeatSequenceNumber: 1,
        });
      });

      // 2. Project Tasks (e.g., lotificaciones ARGOZ, ERP - Gasolineras)
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
          knownLeadNames
        );

        const topic = classifyProblemTopic(ct.title || '', ct.description || '');
        const workInfo = classifyWorkBucket(ct.title || '', ct.description || '', catInfo.code);

        const reportedHours = +(Number(ct.actual_hours) || (isDone ? 1 : 0)).toFixed(2);
        const aiAudit = computeTicketAiTimeBenchmark(
          ct.title || '',
          ct.description || '',
          catInfo.label,
          reportedHours
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
          timeJustification: '',
          categoryKey: topic.categoryKey,
          categoryLabel: topic.categoryLabel,
          hasVoiceNote: false,
          findings: '',
          rootCause: '',
          solution: ct.description || '',
          hasResolutionReport: Boolean(ct.description && ct.description.trim().length > 8),
          closedWithoutResolution: false,
          closedWithoutTime: isDone && reportedHours <= 0,
          isRepeatForSameClient: false,
          repeatSequenceNumber: 1,
        });
      });

      // 3. Detect repeats per client
      const sortedChron = [...unified].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
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

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (activeFilterPill !== 'all') {
        if (['P1', 'P2', 'P3', 'P4', 'FAQ'].includes(activeFilterPill)) {
          if (r.ticketCategoryCode !== activeFilterPill) return false;
        } else if (activeFilterPill === 'inflated' && r.aiTimeStatus !== 'inflated') {
          return false;
        } else if (activeFilterPill === 'repeat' && !r.isRepeatForSameClient) {
          return false;
        } else if (activeFilterPill === 'missing_time' && r.reportedHours > 0) {
          return false;
        }
      }
      if (selectedTechFilter !== 'all' && r.techName !== selectedTechFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.clientName.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.techName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [records, activeFilterPill, selectedTechFilter, searchQuery]);

  // Pill counts
  const pillCounts = useMemo(() => {
    const c: Record<string, number> = {
      all: records.length,
      P1: 0,
      P2: 0,
      P3: 0,
      FAQ: 0,
      P4: 0,
      inflated: 0,
      repeat: 0,
    };
    records.forEach((r) => {
      c[r.ticketCategoryCode] = (c[r.ticketCategoryCode] || 0) + 1;
      if (r.aiTimeStatus === 'inflated') c.inflated += 1;
      if (r.isRepeatForSameClient) c.repeat += 1;
    });
    return c;
  }, [records]);

  // ONLY Melvin Rodriguez & Gerson Gutierrez in the Technician Comparison (Clean, Zero Noise!)
  const mainTechCards = useMemo<TechExecutiveCard[]>(() => {
    const targetNames = ['Melvin Rodriguez', 'Gerson Gutierrez'];
    return targetNames.map((techName) => {
      const recs = filteredRecords.filter((r) => r.techName === techName);
      const openTickets = recs.filter((r) => r.status !== 'resolved').length;
      const resolvedTickets = recs.filter((r) => r.status === 'resolved').length;

      const sumHrs = (arr: UnifiedSupportRecord[]) =>
        +arr.reduce((acc, x) => acc + x.reportedHours, 0).toFixed(1);

      const textRecs = recs.filter((r) => r.workBucket === 'text_reply');
      const impRecs = recs.filter((r) => r.workBucket === 'implementation');
      const trbRecs = recs.filter((r) => r.workBucket === 'troubleshooting');
      const devRecs = recs.filter((r) => r.workBucket === 'development');

      const clientRecs = recs.filter((r) => !r.isInternalSystemTask);
      const clientReturnedCount = clientRecs.filter((r) => r.isRepeatForSameClient).length;
      const firstTimeRightPct =
        clientRecs.length > 0
          ? Math.round(((clientRecs.length - clientReturnedCount) / clientRecs.length) * 100)
          : 100;

      const totalReportedHours = sumHrs(recs);
      const totalExpectedAiHours = +recs
        .reduce((acc, x) => acc + x.expectedAiHours, 0)
        .toFixed(1);
      const totalDiffAiHours = +(totalReportedHours - totalExpectedAiHours).toFixed(1);

      return {
        techName,
        totalTickets: recs.length,
        openTickets,
        resolvedTickets,
        textReplyHours: sumHrs(textRecs),
        textReplyCount: textRecs.length,
        implementationHours: sumHrs(impRecs),
        implementationCount: impRecs.length,
        troubleshootingHours: sumHrs(trbRecs),
        troubleshootingCount: trbRecs.length,
        developmentHours: sumHrs(devRecs),
        developmentCount: devRecs.length,
        firstTimeRightPct,
        clientReturnedCount,
        totalReportedHours,
        totalExpectedAiHours,
        totalDiffAiHours,
        inflatedTicketsCount: recs.filter((r) => r.aiTimeStatus === 'inflated').length,
        missingTimeClosedCount: recs.filter((r) => r.closedWithoutTime).length,
      };
    });
  }, [filteredRecords]);

  // Client Accordions
  const { clientAccordions, internalSystemAccordion } = useMemo(() => {
    const map = new Map<string, UnifiedSupportRecord[]>();
    filteredRecords.forEach((r) => {
      if (!map.has(r.clientName)) map.set(r.clientName, []);
      map.get(r.clientName)!.push(r);
    });

    const buildSummary = (
      clientName: string,
      recs: UnifiedSupportRecord[]
    ): ClientAccordionSummary => {
      const sorted = [...recs].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      const isInternalGroup = recs.every((r) => r.isInternalSystemTask);
      const openTickets = sorted.filter((r) => r.status !== 'resolved').length;
      const resolvedTickets = sorted.filter((r) => r.status === 'resolved').length;
      const repeatReturnsCount = sorted.filter((r) => r.isRepeatForSameClient).length;
      const firstTimeRightPct =
        sorted.length > 0
          ? Math.round(((sorted.length - repeatReturnsCount) / sorted.length) * 100)
          : 100;

      const sumHrs = (arr: UnifiedSupportRecord[]) =>
        +arr.reduce((acc, x) => acc + x.reportedHours, 0).toFixed(1);

      const totalReportedHours = sumHrs(sorted);
      const totalExpectedAiHours = +sorted
        .reduce((acc, x) => acc + x.expectedAiHours, 0)
        .toFixed(1);
      const totalDiffAiHours = +(totalReportedHours - totalExpectedAiHours).toFixed(1);

      const catMap = new Map<string, { code: string; count: number; color: string }>();
      sorted.forEach((r) => {
        const cur = catMap.get(r.ticketCategoryCode) || {
          code: r.ticketCategoryCode,
          count: 0,
          color: r.ticketCategoryColor,
        };
        cur.count += 1;
        catMap.set(r.ticketCategoryCode, cur);
      });

      const techCounts = new Map<string, number>();
      sorted.forEach((r) => {
        const shortName = r.techName.split(' ')[0];
        techCounts.set(shortName, (techCounts.get(shortName) || 0) + 1);
      });
      const techSummaryText = Array.from(techCounts.entries())
        .map(([n, c]) => `${n} (${c})`)
        .join(', ');

      return {
        clientName,
        isInternalGroup,
        totalTickets: sorted.length,
        openTickets,
        resolvedTickets,
        repeatReturnsCount,
        firstTimeRightPct,
        totalReportedHours,
        totalExpectedAiHours,
        totalDiffAiHours,
        inflatedCount: sorted.filter((r) => r.aiTimeStatus === 'inflated').length,
        missingTimeCount: sorted.filter((r) => r.closedWithoutTime).length,
        textReplyHours: sumHrs(sorted.filter((r) => r.workBucket === 'text_reply')),
        implementationHours: sumHrs(sorted.filter((r) => r.workBucket === 'implementation')),
        troubleshootingHours: sumHrs(sorted.filter((r) => r.workBucket === 'troubleshooting')),
        developmentHours: sumHrs(sorted.filter((r) => r.workBucket === 'development')),
        categoryPills: Array.from(catMap.values()).sort((a, b) => b.count - a.count),
        techSummaryText,
        records: sorted,
      };
    };

    const clients: ClientAccordionSummary[] = [];
    let internalGroup = null as ClientAccordionSummary | null;

    map.forEach((recs, clientName) => {
      const summary = buildSummary(clientName, recs);
      if (summary.isInternalGroup) {
        internalGroup = summary;
      } else {
        clients.push(summary);
      }
    });

    clients.sort((a, b) => b.totalTickets - a.totalTickets);
    return { clientAccordions: clients, internalSystemAccordion: internalGroup };
  }, [filteredRecords]);

  // Global Minimalist Strip Metrics
  const kpis = useMemo(() => {
    const clientOnly = filteredRecords.filter((r) => !r.isInternalSystemTask);
    const openCount = filteredRecords.filter((r) => r.status !== 'resolved').length;
    const repeatCount = clientOnly.filter((r) => r.isRepeatForSameClient).length;
    const firstTimePct =
      clientOnly.length > 0
        ? Math.round(((clientOnly.length - repeatCount) / clientOnly.length) * 100)
        : 100;

    const reported = +filteredRecords.reduce((a, r) => a + r.reportedHours, 0).toFixed(1);
    const expected = +filteredRecords.reduce((a, r) => a + r.expectedAiHours, 0).toFixed(1);
    const diff = +(reported - expected).toFixed(1);
    const inflated = filteredRecords.filter((r) => r.aiTimeStatus === 'inflated').length;

    const textHours = +filteredRecords
      .filter((r) => r.workBucket === 'text_reply')
      .reduce((a, r) => a + r.reportedHours, 0)
      .toFixed(1);
    const impHours = +filteredRecords
      .filter((r) => r.workBucket === 'implementation')
      .reduce((a, r) => a + r.reportedHours, 0)
      .toFixed(1);
    const fixHours = +filteredRecords
      .filter((r) => r.workBucket === 'troubleshooting')
      .reduce((a, r) => a + r.reportedHours, 0)
      .toFixed(1);

    return {
      openCount,
      repeatCount,
      firstTimePct,
      reported,
      expected,
      diff,
      inflated,
      textHours,
      impHours,
      fixHours,
    };
  }, [filteredRecords]);

  const copyOfficialNoAudioPolicy = () => {
    const message =
      `📢 *Aviso de Soporte Técnico (+503 7971-8911)*\n\n` +
      `Estimado cliente: para resolver su caso a la 1ª vez y en el menor tiempo posible, por favor envíenos su reporte *únicamente en TEXTO ESCRITO acompañado de una CAPTURA DE PANTALLA del error* (sin notas de voz).\n\n` +
      `✅ *Incluya:* 1) Empresa · 2) Qué error aparece · 3) Captura de pantalla.`;
    navigator.clipboard.writeText(message);
    toast.success('Mensaje oficial "Solo Texto + Captura" copiado');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16">
      {/* ── MINIMALIST SINGLE-ROW TOP BAR (56px, Zero Clutter) ── */}
      <header className="bg-white border-b border-slate-200/80 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-black text-slate-900 tracking-tight">
              Control de Soporte, Tiempos & IA
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              WhatsApp +503 7971-8911
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={copyOfficialNoAudioPolicy}
              title="Copiar mensaje para pedir texto en vez de audios a los clientes"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
            >
              <MicOff className="w-3.5 h-3.5 text-purple-600" />
              Copiar Regla: Sin Audios
            </button>

            <button
              onClick={() => navigate('/support/chat')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-2xs transition"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Chat Soporte (Circles)
            </button>

            <button
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
              <option value={15}>15 días</option>
              <option value={30}>30 días</option>
              <option value={60}>60 días</option>
              <option value={120}>4 meses</option>
            </select>

            <button
              onClick={loadIntelligenceData}
              className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-100 border border-slate-200 bg-white transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 pt-5 space-y-5">
        {/* ── 1. ULTRA-CLEAN 4-KPI STRIP (Linear/Stripe Style) ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl px-4 py-3.5 border border-slate-200/80 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase">Bien a la 1ª Vez</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{kpis.firstTimePct}%</p>
              <p className="text-[11px] font-semibold text-rose-600">
                {kpis.repeatCount} regresos del cliente
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl px-4 py-3.5 border border-slate-200/80 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase">
                Tiempo Real vs. IA
              </p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">
                {kpis.reported}h{' '}
                <span className="text-xs font-bold text-indigo-600">vs {kpis.expected}h IA</span>
              </p>
              <p className="text-[11px] font-semibold text-rose-600">
                {kpis.inflated} tickets con tiempo inflado
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl px-4 py-3.5 border border-slate-200/80 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase">Uso del Tiempo</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs font-black text-emerald-700">
                  💬 Textos {kpis.textHours}h
                </span>
                <span className="text-xs font-black text-violet-700">
                  🚀 Go-Live {kpis.impHours}h
                </span>
                <span className="text-xs font-black text-amber-700">
                  🛠️ Fallas {kpis.fixHours}h
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Textos vs. Implementaciones vs. Fallas
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl px-4 py-3.5 border border-slate-200/80 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase">Pendientes Hoy</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{kpis.openCount}</p>
              <p className="text-[11px] font-semibold text-slate-500">
                Tickets esperando cierre
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* ── 2. SLEEK SIDE-BY-SIDE: MELVIN RODRIGUEZ VS. GERSON GUTIERREZ ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {mainTechCards.map((tech) => {
            const isSelected = selectedTechFilter === tech.techName;
            const totalH = Math.max(tech.totalReportedHours, 0.1);
            const wText = Math.round((tech.textReplyHours / totalH) * 100);
            const wImp = Math.round((tech.implementationHours / totalH) * 100);
            const wTrb = Math.round((tech.troubleshootingHours / totalH) * 100);
            const wDev = Math.max(0, 100 - wText - wImp - wTrb);

            return (
              <div
                key={tech.techName}
                className={`bg-white rounded-2xl p-4 border transition ${
                  isSelected
                    ? 'border-indigo-600 ring-2 ring-indigo-500/15'
                    : 'border-slate-200/80 hover:border-slate-300'
                }`}
              >
                {/* Row 1: Name + Key Stats + Filter Toggle */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-black text-xs flex items-center justify-center">
                      {tech.techName
                        .split(' ')
                        .map((w) => w[0])
                        .join('')}
                    </div>
                    <div>
                      <h2 className="text-sm font-black text-slate-900">{tech.techName}</h2>
                      <p className="text-xs text-slate-500 font-medium">
                        <strong>{tech.totalTickets} casos</strong> ({tech.resolvedTickets} cerrados
                        ·{' '}
                        <span className="text-rose-600 font-bold">
                          {tech.openTickets} abiertos
                        </span>
                        )
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      setSelectedTechFilter(isSelected ? 'all' : tech.techName)
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {isSelected ? '✓ Filtrado' : 'Ver solo él'}
                  </button>
                </div>

                {/* Row 2: Clean Segmented Bar of Time Breakdown */}
                <div className="mt-3.5 space-y-2">
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden flex">
                    {wText > 0 && (
                      <div
                        style={{ width: `${wText}%` }}
                        className="bg-emerald-500 h-full"
                        title={`Textos: ${tech.textReplyHours}h`}
                      />
                    )}
                    {wImp > 0 && (
                      <div
                        style={{ width: `${wImp}%` }}
                        className="bg-violet-500 h-full"
                        title={`Implementaciones: ${tech.implementationHours}h`}
                      />
                    )}
                    {wTrb > 0 && (
                      <div
                        style={{ width: `${wTrb}%` }}
                        className="bg-amber-500 h-full"
                        title={`Fallas: ${tech.troubleshootingHours}h`}
                      />
                    )}
                    {wDev > 0 && (
                      <div
                        style={{ width: `${wDev}%` }}
                        className="bg-blue-500 h-full"
                        title={`Mejoras P4: ${tech.developmentHours}h`}
                      />
                    )}
                  </div>

                  {/* 4 Minimalist Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
                    <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/60">
                      <span className="text-slate-500 font-semibold block">💬 Textos</span>
                      <strong className="text-slate-900 font-black">
                        {tech.textReplyHours}h
                      </strong>{' '}
                      <span className="text-slate-400">({tech.textReplyCount})</span>
                    </div>
                    <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/60">
                      <span className="text-slate-500 font-semibold block">🚀 Go-Live</span>
                      <strong className="text-slate-900 font-black">
                        {tech.implementationHours}h
                      </strong>{' '}
                      <span className="text-slate-400">({tech.implementationCount})</span>
                    </div>
                    <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/60">
                      <span className="text-slate-500 font-semibold block">🛠️ Fallas</span>
                      <strong className="text-slate-900 font-black">
                        {tech.troubleshootingHours}h
                      </strong>{' '}
                      <span className="text-slate-400">({tech.troubleshootingCount})</span>
                    </div>
                    <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/60">
                      <span className="text-slate-500 font-semibold block">⚙️ Mejoras P4</span>
                      <strong className="text-slate-900 font-black">
                        {tech.developmentHours}h
                      </strong>{' '}
                      <span className="text-slate-400">({tech.developmentCount})</span>
                    </div>
                  </div>
                </div>

                {/* Row 3: Compact Footer (Quality 1st time + AI Time Audit) */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md font-black bg-emerald-50 text-emerald-700">
                      🎯 {tech.firstTimeRightPct}% bien a la 1ª
                    </span>
                    {tech.clientReturnedCount > 0 && (
                      <span className="text-rose-600 font-bold">
                        🔄 {tech.clientReturnedCount} regresaron
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700">
                      ⏱️ {tech.totalReportedHours}h{' '}
                      <span className="text-slate-400 font-normal">
                        vs {tech.totalExpectedAiHours}h IA
                      </span>
                    </span>
                    {tech.inflatedTicketsCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-md font-black bg-rose-100 text-rose-700">
                        🚨 {tech.inflatedTicketsCount} inflados
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md font-bold bg-slate-100 text-slate-600">
                        ✓ Tiempo OK
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── 3. ACORDEÓN MINIMALISTA DE EMPRESAS (Visible inmediatamente) ── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
          {/* Single Clean Filter & Search Bar */}
          <div className="p-4 border-b border-slate-200/80 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'all', label: `Todas las Empresas (${pillCounts.all || 0})` },
                { id: 'P1', label: `🔥 P1 Hacienda (${pillCounts.P1 || 0})` },
                { id: 'P2', label: `🚨 P2 Errores (${pillCounts.P2 || 0})` },
                { id: 'P3', label: `🛠️ P3 Soporte (${pillCounts.P3 || 0})` },
                { id: 'FAQ', label: `💬 Consultas (${pillCounts.FAQ || 0})` },
                { id: 'P4', label: `⚙️ P4 Mejoras (${pillCounts.P4 || 0})` },
                { id: 'inflated', label: `🚨 Tiempo Inflado (${pillCounts.inflated || 0})` },
                { id: 'repeat', label: `🔄 Reincidentes (${pillCounts.repeat || 0})` },
              ].map((pill) => {
                const active = activeFilterPill === pill.id;
                return (
                  <button
                    key={pill.id}
                    onClick={() => setActiveFilterPill(pill.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      active
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>

            <div className="relative w-full lg:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar empresa (ej. Argoz)..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-medium"
              />
            </div>
          </div>

          {/* Accordion List */}
          <div className="divide-y divide-slate-100">
            {clientAccordions.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400 font-semibold">
                No hay registros con este filtro.
              </div>
            ) : (
              clientAccordions.map((client) => {
                const isExpanded = expandedClientName === client.clientName;
                return (
                  <div key={client.clientName}>
                    {/* Clean Accordion Header Row */}
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedClientName(isExpanded ? null : client.clientName)
                      }
                      className={`w-full text-left px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 transition ${
                        isExpanded ? 'bg-indigo-50/50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-indigo-600 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                        )}

                        <span className="text-sm font-black text-slate-900">
                          {client.clientName}
                        </span>

                        <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-700">
                          {client.totalTickets} tickets
                        </span>

                        {client.categoryPills.map((cp) => (
                          <span
                            key={cp.code}
                            className="px-1.5 py-0.5 rounded text-[10px] font-black text-white"
                            style={{ backgroundColor: cp.color }}
                          >
                            {cp.code}: {cp.count}
                          </span>
                        ))}

                        {client.repeatReturnsCount > 0 && (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            🔄 {client.repeatReturnsCount} reincidentes
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-slate-500 font-medium hidden sm:inline">
                          👨‍💻 {client.techSummaryText}
                        </span>

                        <div className="font-bold text-slate-800">
                          {client.totalReportedHours}h{' '}
                          <span className="text-slate-400 font-normal">
                            / IA {client.totalExpectedAiHours}h
                          </span>
                        </div>

                        {client.inflatedCount > 0 && (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-rose-100 text-rose-700">
                            🚨 {client.inflatedCount} inflados
                          </span>
                        )}

                        {client.openTickets > 0 ? (
                          <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-red-600 text-white">
                            {client.openTickets} abiertos
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700">
                            Al día
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Clean Expanded Ticket Table */}
                    {isExpanded && (
                      <div className="bg-slate-50/70 px-5 py-4 border-t border-slate-100">
                        <div className="bg-white rounded-xl border border-slate-200/80 overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-slate-200/80 text-[10px] font-black uppercase text-slate-400 bg-slate-50/50">
                                <th className="py-2.5 px-3">Fecha</th>
                                <th className="py-2.5 px-3">Tipo</th>
                                <th className="py-2.5 px-3">Problema</th>
                                <th className="py-2.5 px-3">Técnico</th>
                                <th className="py-2.5 px-3">Tiempo vs. IA</th>
                                <th className="py-2.5 px-3">Solución</th>
                                <th className="py-2.5 px-3 text-right">Detalle</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {client.records.map((rec) => (
                                <tr key={rec.id} className="hover:bg-slate-50/80">
                                  <td className="py-2.5 px-3 whitespace-nowrap">
                                    <span className="font-bold text-slate-700">
                                      {new Date(rec.createdAt).toLocaleDateString('es-SV', {
                                        day: '2-digit',
                                        month: 'short',
                                      })}
                                    </span>
                                    <span
                                      className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                        rec.status === 'resolved'
                                          ? 'bg-emerald-50 text-emerald-700'
                                          : 'bg-red-50 text-red-600'
                                      }`}
                                    >
                                      {rec.status === 'resolved' ? 'Cerrado' : 'Abierto'}
                                    </span>
                                  </td>

                                  <td className="py-2.5 px-3 whitespace-nowrap">
                                    <span
                                      className="px-2 py-0.5 rounded text-[10px] font-black text-white"
                                      style={{ backgroundColor: rec.ticketCategoryColor }}
                                    >
                                      {rec.ticketCategoryCode}
                                    </span>
                                    <span className="ml-1.5 text-[11px] text-slate-500 font-medium">
                                      {rec.workBucketLabel}
                                    </span>
                                  </td>

                                  <td className="py-2.5 px-3 max-w-sm">
                                    <p className="font-bold text-slate-900 truncate">
                                      {rec.title}
                                    </p>
                                    {rec.isRepeatForSameClient && (
                                      <span className="inline-block mt-0.5 text-[10px] font-bold text-rose-600">
                                        🔄 Regreso #{rec.repeatSequenceNumber} por{' '}
                                        {rec.categoryLabel}
                                      </span>
                                    )}
                                  </td>

                                  <td className="py-2.5 px-3 whitespace-nowrap font-semibold text-slate-700">
                                    {rec.techName.split(' ')[0]}
                                  </td>

                                  <td className="py-2.5 px-3 whitespace-nowrap">
                                    <span className="font-black text-slate-900">
                                      {rec.reportedHours}h
                                    </span>{' '}
                                    <span className="text-slate-400">
                                      / IA {rec.expectedAiHours}h
                                    </span>
                                    <span
                                      className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-black ${
                                        rec.aiTimeStatus === 'inflated'
                                          ? 'bg-rose-100 text-rose-700'
                                          : rec.aiTimeStatus === 'missing_time'
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-emerald-50 text-emerald-700'
                                      }`}
                                    >
                                      {rec.aiTimeStatus === 'inflated'
                                        ? `🚨 +${rec.diffAiHours}h`
                                        : rec.aiTimeStatus === 'missing_time'
                                        ? '❌ 0h'
                                        : '✓ OK'}
                                    </span>
                                  </td>

                                  <td className="py-2.5 px-3 max-w-xs truncate text-slate-600">
                                    {rec.solution || rec.rootCause || (
                                      <span className="text-slate-300">—</span>
                                    )}
                                  </td>

                                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                    {rec.rawTicket && (
                                      <button
                                        onClick={() =>
                                          setSelectedTicketForDrawer(rec.rawTicket!)
                                        }
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] transition"
                                      >
                                        Ver
                                        <ExternalLink className="w-3 h-3" />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Collapsible Internal Dev Tasks at the bottom */}
            {internalSystemAccordion && (
              <div className="bg-slate-50/60">
                <button
                  type="button"
                  onClick={() => setShowInternalTasksAccordion(!showInternalTasksAccordion)}
                  className="w-full text-left px-5 py-3 flex items-center justify-between text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  <span>
                    ⚙️ {internalSystemAccordion.clientName} (
                    {internalSystemAccordion.totalTickets} tareas ·{' '}
                    {internalSystemAccordion.totalReportedHours}h)
                  </span>
                  <span>{showInternalTasksAccordion ? 'Ocultar' : 'Ver'}</span>
                </button>
                {showInternalTasksAccordion && (
                  <div className="px-5 pb-4 space-y-1.5">
                    {internalSystemAccordion.records.map((rec) => (
                      <div
                        key={rec.id}
                        className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-200/70 text-xs"
                      >
                        <span className="font-semibold text-slate-800 truncate">
                          {rec.title}{' '}
                          <span className="text-slate-400">({rec.techName.split(' ')[0]})</span>
                        </span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-bold text-slate-600">{rec.reportedHours}h</span>
                          {rec.rawTicket && (
                            <button
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
        </div>
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
              onCreateSubticket={() => {}}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportIntelligence;
