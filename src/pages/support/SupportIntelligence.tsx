import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Brain,
  AlertTriangle,
  Repeat,
  Clock,
  CheckCircle2,
  MessageSquare,
  Search,
  ArrowLeft,
  ExternalLink,
  Copy,
  RefreshCw,
  ShieldAlert,
  Wrench,
  Building2,
  UserCheck,
  Phone,
  ChevronRight,
  ChevronDown,
  FileBadge2,
  MicOff,
  Rocket,
  Sparkles,
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
  source: 'ticket' | 'task' | 'timesheet';
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
  // Official P1..P6 / FAQ Category
  ticketCategoryId: string | null;
  ticketCategoryCode: string; // e.g. 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'FAQ', 'CRM'
  ticketCategoryName: string; // e.g. 'P1 - Hacienda'
  ticketCategoryColor: string;
  // Work type & AI Time Audit
  workBucket: WorkBucket;
  workBucketLabel: string;
  reportedHours: number; // Exact actual_hours entered by tech (0 if missing!)
  expectedAiHours: number;
  maxReasonableAiHours: number;
  diffAiHours: number; // reportedHours - expectedAiHours
  aiTimeStatus: 'missing_time' | 'inflated' | 'fair' | 'fast';
  aiTimeVerdictLabel: string;
  aiTimeExplanation: string;
  timeJustification: string;
  // Waiting & Quality
  waitingHours: number;
  categoryKey: string;
  categoryLabel: string;
  subPatternKey: string;
  subPatternLabel: string;
  isFromWhatsApp: boolean;
  hasVoiceNote: boolean;
  findings: string;
  rootCause: string;
  solution: string;
  hasResolutionReport: boolean;
  closedWithoutResolution: boolean;
  closedWithoutTime: boolean;
  isRepeatForSameClient: boolean;
  repeatSequenceNumber: number; // 1 = 1st time, 2 = returned 2nd time, etc.
}

interface ClientAccordionSummary {
  clientName: string;
  isInternalGroup: boolean;
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  firstTimeRightCount: number;
  repeatReturnsCount: number;
  firstTimeRightPct: number;
  // Time totals
  totalReportedHours: number;
  totalExpectedAiHours: number;
  totalDiffAiHours: number;
  inflatedCount: number;
  missingTimeCount: number;
  missingReportCount: number;
  // Hours by bucket
  textReplyHours: number;
  implementationHours: number;
  troubleshootingHours: number;
  developmentHours: number;
  // Categories & Techs
  categoryPills: { code: string; label: string; count: number; color: string }[];
  techBreakdown: { techName: string; count: number; hours: number }[];
  primaryTech: string;
  lastReportDate: string;
  records: UnifiedSupportRecord[];
}

interface TechClearCardSummary {
  techId: string;
  techName: string;
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  // 4 Clear Buckets
  textReplyCount: number;
  textReplyHours: number;
  implementationCount: number;
  implementationHours: number;
  troubleshootingCount: number;
  troubleshootingHours: number;
  developmentCount: number;
  developmentHours: number;
  // Quality: First-time right vs Client came back
  firstTimeRightCount: number;
  clientReturnedCount: number;
  firstTimeRightPct: number;
  // AI Time Audit
  totalReportedHours: number;
  totalExpectedAiHours: number;
  totalDiffAiHours: number;
  inflatedTicketsCount: number;
  missingTimeClosedCount: number;
  missingReportClosedCount: number;
  topClients: { clientName: string; count: number; hours: number }[];
}

function normalizeClientDisplayName(raw: string): string {
  const clean = raw.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const lower = clean.toLowerCase();

  // UNIFY ALL VARIATIONS OF ARGOZ INTO ONE SINGLE COMPANY!
  if (/arg[oó]z|argos/i.test(lower)) {
    return 'Corporación Argoz (Lotificaciones Argoz)';
  }
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
  if (/texaco\s+el\s+triunfo/i.test(lower)) return 'Texaco El Triunfo';
  if (/multiservicios\s+integrales/i.test(lower)) return 'Multiservicios Integrales';
  if (/inversiones\s+diversas\s+del\s+mar/i.test(lower)) return 'Inversiones Diversas del Mar';
  if (/comercial\s+mendez/i.test(lower)) return 'Comercial Méndez';
  if (/prisma\s+hielo/i.test(lower)) return 'Prisma Hielo';
  if (/panader[ií]a\s+santa\s+eduviges/i.test(lower)) return 'Panadería Santa Eduviges';
  if (/gasolinera\s+el\s+triunfo/i.test(lower)) return 'Texaco El Triunfo';
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

  // 0. Check Argoz anywhere first so lotificaciones ARGOZ, reunion argoz, Corporacion Argoz all merge!
  if (/arg[oó]z|argos/i.test(combined)) {
    return { clientName: 'Corporación Argoz (Lotificaciones Argoz)', isInternalSystemTask: false };
  }

  // 1. Explicit lead_name on ticket
  if (leadName && leadName.trim().length > 1 && !/general|interno|sin cliente/i.test(leadName)) {
    return { clientName: normalizeClientDisplayName(leadName.trim()), isInternalSystemTask: false };
  }

  // 2. Colon prefix pattern in ticket titles:
  // "Soporte tecnico: <Cliente>", "Go live: <Cliente>", "Solicitud de cliente: <Cliente>",
  // "Error reportado: <Cliente>", "Capacitacion presencial: <Cliente>", "Pregunta frecuente: <Cliente>"
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

    // WhatsApp format: "[WhatsApp - Cat] Nombre Cliente (+503...): mensaje"
    const waMatch = title.match(/\[WhatsApp[^\]]*\]\s*([^:(]+?)(?:\s*\(\+\d+\))?\s*:/i);
    if (waMatch && waMatch[1] && waMatch[1].trim().length > 2) {
      return { clientName: normalizeClientDisplayName(waMatch[1].trim()), isInternalSystemTask: false };
    }
  }

  // 3. Project name (if not internal CRM)
  if (
    projectName &&
    projectName.trim().length > 1 &&
    !/^(general|interno|soporte|crm|tareas)$/i.test(projectName.trim())
  ) {
    return { clientName: normalizeClientDisplayName(projectName.trim()), isInternalSystemTask: false };
  }

  // 4. Known clients in text
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
    if (m) {
      return { clientName: normalizeClientDisplayName(m[0]), isInternalSystemTask: false };
    }
  }

  if (categoryCode === 'P5') {
    return { clientName: 'Inmalux', isInternalSystemTask: false };
  }

  // Otherwise it is an internal system improvement / routine log (e.g. P4 - Mejoras y Ajustes, Jornada Melvin)
  return {
    clientName: '⚙️ Desarrollo / Mejoras Internas del Sistema (Sin cliente específico)',
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

  if (catLower.startsWith('p1') || /hacienda|dte|firmador|sello\s+de\s+recepci|contingencia/i.test(catLower)) {
    return { code: 'P1', label: categoryName || 'P1 - Hacienda', color: '#EF4444' };
  }
  if (catLower.startsWith('p2') || /^error\s+reportado/i.test(title)) {
    return { code: 'P2', label: categoryName || 'P2 - Errores del Sistema', color: '#F97316' };
  }
  if (catLower.startsWith('p3') || /^soporte\s+t[eé]cnico/i.test(title)) {
    return { code: 'P3', label: categoryName || 'P3 - Soporte Técnico', color: '#F59E0B' };
  }
  if (catLower.startsWith('p4')) {
    return { code: 'P4', label: categoryName || 'P4 - Mejoras y Ajustes', color: '#3B82F6' };
  }
  if (catLower.startsWith('p5') || /inmalux/i.test(text)) {
    return { code: 'P5', label: categoryName || 'P5 - Inmalux', color: '#8B5CF6' };
  }
  if (catLower.startsWith('p6')) {
    return { code: 'P6', label: categoryName || 'P6 - Nuevos Cambios', color: '#6366F1' };
  }
  if (/pegunta|pregunta\s+frecuente/i.test(text)) {
    return { code: 'FAQ', label: 'Preguntas Frecuentes / Consultas', color: '#10B981' };
  }
  if (/crm/i.test(catLower)) {
    return { code: 'CRM', label: 'CRM', color: '#EC4899' };
  }
  // Fallback inference from title
  if (/hacienda|dte|factura\s+electr[oó]nica|invalidaci[oó]n|json/i.test(text)) {
    return { code: 'P1', label: 'P1 - Hacienda / DTE', color: '#EF4444' };
  }
  if (/error|falla|bug|no\s+deja|no\s+carga/i.test(text)) {
    return { code: 'P2', label: 'P2 - Errores del Sistema', color: '#F97316' };
  }
  return { code: 'P3', label: categoryName || 'P3 - Soporte Técnico', color: '#F59E0B' };
}

function classifyWorkBucket(
  title: string,
  description: string,
  categoryCode: string
): { bucket: WorkBucket; label: string } {
  const text = `${title} ${description}`.toLowerCase();

  // 1. Respondiendo Textos / Preguntas Frecuentes / Chats WhatsApp cortos
  if (
    categoryCode === 'FAQ' ||
    /^pregunta\s+frecuente/i.test(title) ||
    /consulta|duda|respondiendo\s+texto|mensaje\s+de\s+whatsapp|explicaci[oó]n\s+a\s+cliente/i.test(text)
  ) {
    return { bucket: 'text_reply', label: '💬 Respondiendo Textos / Consultas' };
  }

  // 2. Implementaciones / Go-Live / Capacitaciones
  if (
    /^go\s*live|^capacitaci[oó]n|^implementaci[oó]n/i.test(title) ||
    /go\s*live|capacitaci[oó]n|implementaci[oó]n|entrenamiento|puesta\s+en\s+marcha|migraci[oó]n\s+inicial/i.test(text)
  ) {
    return { bucket: 'implementation', label: '🚀 Implementación / Go-Live / Capacitación' };
  }

  // 3. Mejoras / Desarrollo P4 / P6
  if (categoryCode === 'P4' || categoryCode === 'P6') {
    return { bucket: 'development', label: '⚙️ Mejoras y Ajustes del Sistema (P4)' };
  }

  // 4. Solucionando Problemas / Soporte P1, P2, P3, P5
  return { bucket: 'troubleshooting', label: '🛠️ Solucionando Problemas / Soporte (P1-P3)' };
}

function classifySupportProblem(title: string, description: string): {
  categoryKey: string;
  categoryLabel: string;
  subPatternKey: string;
  subPatternLabel: string;
} {
  const text = `${title} ${description}`.toLowerCase();

  if (/dte|factura|facturaci[oó]n|hacienda|mh|invalidaci[oó]n|contingencia|ccf|nota\s+de\s+cr[eé]dito|firmador|sello|json/i.test(text)) {
    if (/invalidaci[oó]n|anular|anulaci[oó]n/i.test(text)) {
      return {
        categoryKey: 'facturacion_dte',
        categoryLabel: 'Facturación Electrónica / DTE / Hacienda',
        subPatternKey: 'dte_invalidacion',
        subPatternLabel: 'Invalidación / Anulación de DTE en Hacienda',
      };
    }
    return {
      categoryKey: 'facturacion_dte',
      categoryLabel: 'Facturación Electrónica / DTE / Hacienda',
      subPatternKey: 'dte_emision_rechazo',
      subPatternLabel: 'Error al Emitir Factura / Rechazo DTE Hacienda',
    };
  }

  if (/go\s*live|capacitaci[oó]n|implementaci[oó]n|entrenamiento/i.test(text)) {
    return {
      categoryKey: 'implementacion_golive',
      categoryLabel: 'Implementación / Go-Live / Capacitación',
      subPatternKey: 'implementacion_cliente',
      subPatternLabel: 'Implementación, Go-Live o Capacitación a Cliente',
    };
  }

  if (/pregunta\s+frecuente|consulta|duda/i.test(text)) {
    return {
      categoryKey: 'consulta_texto',
      categoryLabel: 'Respuesta a Consultas / Textos de Clientes',
      subPatternKey: 'consulta_cliente',
      subPatternLabel: 'Atención de Consulta o Pregunta por Chat/Texto',
    };
  }

  if (/inventario|stock|kardex|bodega|producto|lote|reconciliaci[oó]n/i.test(text)) {
    return {
      categoryKey: 'inventario_stock',
      categoryLabel: 'Inventario / Kardex / Productos',
      subPatternKey: 'descuadre_inventario',
      subPatternLabel: 'Descuadre de Stock o Reconciliación de Inventario',
    };
  }

  if (/c[aá]lculo|iva|retenci[oó]n|total|descuento|redondeo|planilla|comisi[oó]n|finanzas|contab|partida/i.test(text)) {
    return {
      categoryKey: 'calculos_contabilidad',
      categoryLabel: 'Cálculos Financieros / Planilla / Contabilidad',
      subPatternKey: 'diferencia_calculo_monto',
      subPatternLabel: 'Diferencia en Cálculo de Montos, Impuestos o Planilla',
    };
  }

  if (/reporte|pdf|excel|imprimir|impresi[oó]n|descarga|exportar|filtro|tabla/i.test(text)) {
    return {
      categoryKey: 'interfaz_reportes',
      categoryLabel: 'Reportes / Exportación PDF-Excel / Interfaz',
      subPatternKey: 'error_reporte_exportacion',
      subPatternLabel: 'Ajuste o Error en Reportes, Filtros o Impresión',
    };
  }

  return {
    categoryKey: 'soporte_operativo',
    categoryLabel: 'Soporte Técnico / Configuración de Cliente',
    subPatternKey: 'soporte_config_general',
    subPatternLabel: 'Soporte Técnico o Configuración en Sistema del Cliente',
  };
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

  // Active Ticket Panel Drawer (so clicking "Abrir Ticket" opens right here!)
  const [selectedTicketForDrawer, setSelectedTicketForDrawer] = useState<Ticket | null>(null);

  // Filters (Child-Simple & Instant)
  const [selectedCategoryCode, setSelectedCategoryCode] = useState<string>('all'); // 'all' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'FAQ'
  const [selectedWorkBucket, setSelectedWorkBucket] = useState<string>('all'); // 'all' | 'text_reply' | 'implementation' | 'troubleshooting' | 'development' | 'inflated' | 'missing_time' | 'repeat'
  const [selectedTechFilter, setSelectedTechFilter] = useState<string>('all');
  const [daysRange, setDaysRange] = useState<number>(60);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Accordion expanded state: Client Name -> boolean
  const [expandedClientName, setExpandedClientName] = useState<string | null>(
    'Corporación Argoz (Lotificaciones Argoz)'
  );
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
      profs.forEach((p: any) => {
        profileMap.set(p.id, p.full_name || p.email || 'Colaborador');
      });

      const categoryMap = new Map<string, TicketCategory>();
      cats.forEach((c) => {
        categoryMap.set(c.id, c);
      });

      const projectMap = new Map<string, string>();
      projects.forEach((p: any) => {
        projectMap.set(p.id, p.name);
      });

      const knownLeadNames = leads.map((l) => l.name).filter(Boolean);

      // Also load crm_tasks from company projects (like lotificaciones ARGOZ)
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

      const resolveTechFromText = (text: string): { id: string; name: string } | null => {
        const lower = (text || '').toLowerCase();
        for (const p of profs) {
          const firstName = (p.full_name || '').split(' ')[0]?.toLowerCase();
          if (firstName && firstName.length >= 3 && lower.includes(firstName)) {
            return { id: p.id, name: p.full_name || p.email };
          }
        }
        return null;
      };

      const unified: UnifiedSupportRecord[] = [];
      const seenIds = new Set<string>();
      const nowMs = Date.now();

      // 1. Formal Tickets
      rawTickets.forEach((t: any) => {
        seenIds.add(t.id);
        const catObj = t.category_id ? categoryMap.get(t.category_id) : undefined;
        const catInfo = detectCategoryCode(catObj?.name || '', t.title || '', t.description || '');

        const assignedName =
          (t.assigned_to && profileMap.get(t.assigned_to)) ||
          resolveTechFromText(t.title || '')?.name ||
          (t.created_by && profileMap.get(t.created_by)) ||
          'Sin asignar';
        const assignedId =
          t.assigned_to ||
          resolveTechFromText(t.title || '')?.id ||
          t.created_by ||
          'unassigned';

        const createdMs = new Date(t.created_at).getTime();
        const isClosedOrResolved = t.status === 'resolved' || t.status === 'closed';
        const waitingHrs = !isClosedOrResolved
          ? Math.max(0.5, +((nowMs - createdMs) / (1000 * 60 * 60)).toFixed(1))
          : 0;

        // Routine shift logs ("Jornada Melvin 4/11/2026", "jornada gerson 11-03-2026")
        const isShiftSummary = /^\s*jornada\s+(melvin|gerson)/i.test(t.title || '');

        const { clientName, isInternalSystemTask } = inferClientAndScope(
          t.lead_name,
          null,
          t.title || '',
          t.description || '',
          catInfo.code,
          knownLeadNames
        );

        const classified = classifySupportProblem(t.title || '', t.description || '');
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

        if (isShiftSummary) return; // Skip meta shift-log wrapper tickets so they don't distort ticket counts

        unified.push({
          id: t.id,
          source: 'ticket',
          rawTicket: {
            ...t,
            category_name: catObj?.name || catInfo.label,
            category_color: catObj?.color || catInfo.color,
            agent_name: assignedName,
            lead_name: clientName,
          },
          title: t.title || 'Ticket de Soporte',
          description: t.description || '',
          clientName,
          isInternalSystemTask,
          techId: assignedId,
          techName: assignedName,
          status: isClosedOrResolved ? 'resolved' : t.status === 'pending' ? 'pending' : 'open',
          priority: t.priority || 'medium',
          createdAt: t.created_at,
          resolvedAt: t.resolved_at,
          ticketCategoryId: t.category_id || null,
          ticketCategoryCode: catInfo.code,
          ticketCategoryName: catObj?.name || catInfo.label,
          ticketCategoryColor: catObj?.color || catInfo.color,
          workBucket: workInfo.bucket,
          workBucketLabel: workInfo.label,
          reportedHours,
          expectedAiHours: aiAudit.expectedHours,
          maxReasonableAiHours: aiAudit.maxReasonableHours,
          diffAiHours: aiAudit.differenceHours,
          aiTimeStatus: aiAudit.status,
          aiTimeVerdictLabel: aiAudit.verdictLabel,
          aiTimeExplanation: aiAudit.explanation,
          timeJustification: String(meta.time_justification || ''),
          waitingHours: waitingHrs,
          categoryKey: classified.categoryKey,
          categoryLabel: classified.categoryLabel,
          subPatternKey: classified.subPatternKey,
          subPatternLabel: classified.subPatternLabel,
          isFromWhatsApp:
            Boolean(meta.source === 'whatsapp_evolution') || /whatsapp/i.test(t.title || ''),
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
        const assignedName =
          (ct.assigned_to && profileMap.get(ct.assigned_to)) ||
          resolveTechFromText(ct.title || '')?.name ||
          'Sin asignar';
        const assignedId =
          ct.assigned_to || resolveTechFromText(ct.title || '')?.id || 'unassigned';

        const isDone = ct.status === 'completed' || ct.status === 'done';
        const createdMs = new Date(ct.created_at).getTime();
        const waitingHrs = !isDone
          ? Math.max(1, +((nowMs - createdMs) / (1000 * 60 * 60)).toFixed(1))
          : 0;

        const { clientName, isInternalSystemTask } = inferClientAndScope(
          null,
          projName,
          ct.title || '',
          ct.description || '',
          catInfo.code,
          knownLeadNames
        );

        const classified = classifySupportProblem(ct.title || '', ct.description || '');
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
          techId: assignedId,
          techName: assignedName,
          status: isDone ? 'resolved' : 'open',
          priority: ct.priority === 'high' || ct.priority === 'urgent' ? ct.priority : 'medium',
          createdAt: ct.created_at,
          resolvedAt: ct.completed_at || (isDone ? ct.updated_at : null),
          ticketCategoryId: null,
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
          aiTimeExplanation: aiAudit.explanation,
          timeJustification: '',
          waitingHours: waitingHrs,
          categoryKey: classified.categoryKey,
          categoryLabel: classified.categoryLabel,
          subPatternKey: classified.subPatternKey,
          subPatternLabel: classified.subPatternLabel,
          isFromWhatsApp: false,
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

      // 3. Mark repeat issues for the SAME client (Did the client have to come back for the same problem?)
      // Sort chronologically oldest -> newest to number occurrences 1, 2, 3...
      const sortedChron = [...unified].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      const clientPatternCounter = new Map<string, number>();
      sortedChron.forEach((r) => {
        if (r.isInternalSystemTask) return;
        const key = `${r.clientName}__${r.categoryKey}`;
        const prev = clientPatternCounter.get(key) || 0;
        const seq = prev + 1;
        clientPatternCounter.set(key, seq);
        r.repeatSequenceNumber = seq;
        r.isRepeatForSameClient = seq > 1;
      });

      setRecords(unified);
    } catch (err) {
      console.error('[SupportIntelligence] Error:', err);
      toast.error('Error al cargar el análisis de tickets');
    } finally {
      setLoading(false);
    }
  };

  // Filtered records based on pills & search
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (selectedCategoryCode !== 'all' && r.ticketCategoryCode !== selectedCategoryCode) {
        return false;
      }
      if (selectedWorkBucket !== 'all') {
        if (selectedWorkBucket === 'inflated' && r.aiTimeStatus !== 'inflated') return false;
        if (selectedWorkBucket === 'missing_time' && r.reportedHours > 0) return false;
        if (selectedWorkBucket === 'repeat' && !r.isRepeatForSameClient) return false;
        if (
          ['text_reply', 'implementation', 'troubleshooting', 'development'].includes(
            selectedWorkBucket
          ) &&
          r.workBucket !== selectedWorkBucket
        ) {
          return false;
        }
      }
      if (
        selectedTechFilter !== 'all' &&
        r.techId !== selectedTechFilter &&
        r.techName !== selectedTechFilter
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.clientName.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.techName.toLowerCase().includes(q) ||
          r.ticketCategoryName.toLowerCase().includes(q) ||
          r.subPatternLabel.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [records, selectedCategoryCode, selectedWorkBucket, selectedTechFilter, searchQuery]);

  // Category Counts for Top Filter Pills (P1, P2, P3, P4, FAQ, P5)
  const categoryPillCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: records.length,
      P1: 0,
      P2: 0,
      P3: 0,
      P4: 0,
      FAQ: 0,
      P5: 0,
    };
    records.forEach((r) => {
      counts[r.ticketCategoryCode] = (counts[r.ticketCategoryCode] || 0) + 1;
    });
    return counts;
  }, [records]);

  // STEP 1: Technician Clear Cards (Melvin & Gerson first!)
  const techSummaries = useMemo<TechClearCardSummary[]>(() => {
    const map = new Map<string, UnifiedSupportRecord[]>();
    filteredRecords.forEach((r) => {
      const key = r.techName || 'Sin asignar';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });

    const list: TechClearCardSummary[] = [];
    map.forEach((recs, techName) => {
      const openTickets = recs.filter((r) => r.status !== 'resolved').length;
      const resolvedTickets = recs.filter((r) => r.status === 'resolved').length;

      const textRecs = recs.filter((r) => r.workBucket === 'text_reply');
      const impRecs = recs.filter((r) => r.workBucket === 'implementation');
      const trbRecs = recs.filter((r) => r.workBucket === 'troubleshooting');
      const devRecs = recs.filter((r) => r.workBucket === 'development');

      const sumHrs = (arr: UnifiedSupportRecord[]) =>
        +arr.reduce((acc, x) => acc + x.reportedHours, 0).toFixed(1);

      const clientRecs = recs.filter((r) => !r.isInternalSystemTask);
      const clientReturnedCount = clientRecs.filter((r) => r.isRepeatForSameClient).length;
      const firstTimeRightCount = Math.max(0, clientRecs.length - clientReturnedCount);
      const firstTimeRightPct =
        clientRecs.length > 0 ? Math.round((firstTimeRightCount / clientRecs.length) * 100) : 100;

      const totalReportedHours = sumHrs(recs);
      const totalExpectedAiHours = +recs
        .reduce((acc, x) => acc + x.expectedAiHours, 0)
        .toFixed(1);
      const totalDiffAiHours = +(totalReportedHours - totalExpectedAiHours).toFixed(1);

      const inflatedTicketsCount = recs.filter((r) => r.aiTimeStatus === 'inflated').length;
      const missingTimeClosedCount = recs.filter((r) => r.closedWithoutTime).length;
      const missingReportClosedCount = recs.filter((r) => r.closedWithoutResolution).length;

      const clientCountMap = new Map<string, { count: number; hours: number }>();
      clientRecs.forEach((r) => {
        const cur = clientCountMap.get(r.clientName) || { count: 0, hours: 0 };
        cur.count += 1;
        cur.hours = +(cur.hours + r.reportedHours).toFixed(1);
        clientCountMap.set(r.clientName, cur);
      });
      const topClients = Array.from(clientCountMap.entries())
        .map(([clientName, v]) => ({ clientName, count: v.count, hours: v.hours }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);

      list.push({
        techId: recs[0]?.techId || techName,
        techName,
        totalTickets: recs.length,
        openTickets,
        resolvedTickets,
        textReplyCount: textRecs.length,
        textReplyHours: sumHrs(textRecs),
        implementationCount: impRecs.length,
        implementationHours: sumHrs(impRecs),
        troubleshootingCount: trbRecs.length,
        troubleshootingHours: sumHrs(trbRecs),
        developmentCount: devRecs.length,
        developmentHours: sumHrs(devRecs),
        firstTimeRightCount,
        clientReturnedCount,
        firstTimeRightPct,
        totalReportedHours,
        totalExpectedAiHours,
        totalDiffAiHours,
        inflatedTicketsCount,
        missingTimeClosedCount,
        missingReportClosedCount,
        topClients,
      });
    });

    // Put Melvin and Gerson at the very top
    return list.sort((a, b) => {
      const aIsMain = /melvin|gerson/i.test(a.techName) ? 1 : 0;
      const bIsMain = /melvin|gerson/i.test(b.techName) ? 1 : 0;
      if (aIsMain !== bIsMain) return bIsMain - aIsMain;
      return b.totalTickets - a.totalTickets;
    });
  }, [filteredRecords]);

  // STEP 2: Client Accordion Summaries (Real Clients separated from Internal P4 Tasks)
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
      const firstTimeRightCount = Math.max(0, sorted.length - repeatReturnsCount);
      const firstTimeRightPct =
        sorted.length > 0 ? Math.round((firstTimeRightCount / sorted.length) * 100) : 100;

      const sumHrs = (arr: UnifiedSupportRecord[]) =>
        +arr.reduce((acc, x) => acc + x.reportedHours, 0).toFixed(1);

      const totalReportedHours = sumHrs(sorted);
      const totalExpectedAiHours = +sorted
        .reduce((acc, x) => acc + x.expectedAiHours, 0)
        .toFixed(1);
      const totalDiffAiHours = +(totalReportedHours - totalExpectedAiHours).toFixed(1);

      const inflatedCount = sorted.filter((r) => r.aiTimeStatus === 'inflated').length;
      const missingTimeCount = sorted.filter((r) => r.closedWithoutTime).length;
      const missingReportCount = sorted.filter((r) => r.closedWithoutResolution).length;

      const catMap = new Map<string, { code: string; label: string; count: number; color: string }>();
      sorted.forEach((r) => {
        const cur = catMap.get(r.ticketCategoryCode) || {
          code: r.ticketCategoryCode,
          label: r.ticketCategoryName,
          count: 0,
          color: r.ticketCategoryColor,
        };
        cur.count += 1;
        catMap.set(r.ticketCategoryCode, cur);
      });

      const techMap = new Map<string, { count: number; hours: number }>();
      sorted.forEach((r) => {
        const cur = techMap.get(r.techName) || { count: 0, hours: 0 };
        cur.count += 1;
        cur.hours = +(cur.hours + r.reportedHours).toFixed(1);
        techMap.set(r.techName, cur);
      });
      const techBreakdown = Array.from(techMap.entries())
        .map(([techName, v]) => ({ techName, count: v.count, hours: v.hours }))
        .sort((a, b) => b.count - a.count);

      return {
        clientName,
        isInternalGroup,
        totalTickets: sorted.length,
        openTickets,
        resolvedTickets,
        firstTimeRightCount,
        repeatReturnsCount,
        firstTimeRightPct,
        totalReportedHours,
        totalExpectedAiHours,
        totalDiffAiHours,
        inflatedCount,
        missingTimeCount,
        missingReportCount,
        textReplyHours: sumHrs(sorted.filter((r) => r.workBucket === 'text_reply')),
        implementationHours: sumHrs(sorted.filter((r) => r.workBucket === 'implementation')),
        troubleshootingHours: sumHrs(sorted.filter((r) => r.workBucket === 'troubleshooting')),
        developmentHours: sumHrs(sorted.filter((r) => r.workBucket === 'development')),
        categoryPills: Array.from(catMap.values()).sort((a, b) => b.count - a.count),
        techBreakdown,
        primaryTech: techBreakdown[0]?.techName || 'Sin asignar',
        lastReportDate: sorted[0]?.createdAt || new Date().toISOString(),
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

  // Global KPIs for the 4 Child-Simple Top Cards
  const globalKpis = useMemo(() => {
    const clientOnly = filteredRecords.filter((r) => !r.isInternalSystemTask);
    const openCount = filteredRecords.filter((r) => r.status !== 'resolved').length;
    const repeatCount = clientOnly.filter((r) => r.isRepeatForSameClient).length;
    const firstTimeRightPct =
      clientOnly.length > 0
        ? Math.round(((clientOnly.length - repeatCount) / clientOnly.length) * 100)
        : 100;

    const totalReported = +filteredRecords
      .reduce((acc, r) => acc + r.reportedHours, 0)
      .toFixed(1);
    const totalExpected = +filteredRecords
      .reduce((acc, r) => acc + r.expectedAiHours, 0)
      .toFixed(1);
    const totalDiff = +(totalReported - totalExpected).toFixed(1);
    const inflatedCount = filteredRecords.filter((r) => r.aiTimeStatus === 'inflated').length;
    const missingTimeCount = filteredRecords.filter((r) => r.closedWithoutTime).length;
    const voiceNotesCount = filteredRecords.filter((r) => r.hasVoiceNote).length;

    const textHours = +filteredRecords
      .filter((r) => r.workBucket === 'text_reply')
      .reduce((a, b) => a + b.reportedHours, 0)
      .toFixed(1);
    const impHours = +filteredRecords
      .filter((r) => r.workBucket === 'implementation')
      .reduce((a, b) => a + b.reportedHours, 0)
      .toFixed(1);
    const fixHours = +filteredRecords
      .filter((r) => r.workBucket === 'troubleshooting')
      .reduce((a, b) => a + b.reportedHours, 0)
      .toFixed(1);

    return {
      openCount,
      repeatCount,
      firstTimeRightPct,
      totalReported,
      totalExpected,
      totalDiff,
      inflatedCount,
      missingTimeCount,
      voiceNotesCount,
      textHours,
      impHours,
      fixHours,
      topClient: clientAccordions[0] || null,
    };
  }, [filteredRecords, clientAccordions]);

  const copyOfficialNoAudioPolicy = () => {
    const message =
      `📢 *Aviso Importante de Soporte Técnico (+503 7971-8911)*\n\n` +
      `Estimado cliente: para resolver su caso a la 1ª vez y en el menor tiempo posible, por favor envíenos su reporte *únicamente en TEXTO ESCRITO acompañado de una CAPTURA DE PANTALLA o FOTO del error*.\n\n` +
      `🚫 *Por favor evite enviar notas de voz (audios)*, ya que nuestro sistema de Inteligencia Artificial registra automáticamente el problema escrito y asigna su ticket directo al ingeniero especialista.\n\n` +
      `✅ *Formato rápido recomendado:*\n` +
      `1. Nombre de su empresa\n` +
      `2. Qué estaba haciendo y qué error apareció (en texto)\n` +
      `3. Foto o captura de pantalla`;
    navigator.clipboard.writeText(message);
    toast.success('Comunicado oficial para clientes copiado al portapapeles');
  };

  return (
    <div className="min-h-screen bg-slate-50/80 pb-20">
      {/* ── TOP HEADER ── */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shrink-0">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">
                    Radiografía Clara de Soporte, Tiempos e IA
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                    📞 WhatsApp Auto-Ticket: +503 7971-8911
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5 font-medium">
                  1) En qué gastan el tiempo Melvin y Gerson · 2) Haz clic en cualquier empresa (ej.{' '}
                  <strong>Argoz</strong>) para abrir su acordeón de tickets y tiempos · 3) La IA
                  detecta tiempo inflado o tickets sin tiempo.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => navigate('/support/chat')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm transition"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                💬 Abrir Chat Soporte (Circles)
              </button>
              <button
                onClick={() => navigate('/support/tickets')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Ir al Tablero de Tickets
              </button>
              <button
                onClick={loadIntelligenceData}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Actualizar Datos
              </button>
            </div>
          </div>

          {/* ── ROW 1 OF FILTERS: CATEGORÍAS P1, P2, P3, P4, P5, PREGUNTAS ── */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">
                Filtrar por Tipo de Ticket:
              </span>
              {[
                { code: 'all', label: `Todos (${categoryPillCounts.all || 0})`, activeClass: 'bg-slate-900 text-white' },
                { code: 'P1', label: `🔥 P1 - Hacienda / DTE (${categoryPillCounts.P1 || 0})`, activeClass: 'bg-red-600 text-white' },
                { code: 'P2', label: `🚨 P2 - Errores Sistema (${categoryPillCounts.P2 || 0})`, activeClass: 'bg-orange-600 text-white' },
                { code: 'P3', label: `🛠️ P3 - Soporte Técnico (${categoryPillCounts.P3 || 0})`, activeClass: 'bg-amber-600 text-white' },
                { code: 'FAQ', label: `💬 Preguntas / Textos (${categoryPillCounts.FAQ || 0})`, activeClass: 'bg-emerald-600 text-white' },
                { code: 'P4', label: `⚙️ P4 - Mejoras (${categoryPillCounts.P4 || 0})`, activeClass: 'bg-blue-600 text-white' },
                { code: 'P5', label: `📦 P5 - Inmalux (${categoryPillCounts.P5 || 0})`, activeClass: 'bg-violet-600 text-white' },
              ].map((pill) => {
                const active = selectedCategoryCode === pill.code;
                return (
                  <button
                    key={pill.code}
                    onClick={() => setSelectedCategoryCode(pill.code)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                      active
                        ? `${pill.activeClass} shadow-sm`
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>

            {/* ── ROW 2 OF FILTERS: ACTIVIDAD / AUDITORÍA IA + TÉCNICO + BUSCADOR ── */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">
                  Ver por Actividad / IA:
                </span>
                {[
                  { id: 'all', label: 'Todo' },
                  { id: 'text_reply', label: '💬 Respondiendo Textos' },
                  { id: 'implementation', label: '🚀 Implementaciones / Go-Live' },
                  { id: 'troubleshooting', label: '🛠️ Solución de Problemas' },
                  { id: 'inflated', label: '🚨 Tiempo Inflado (IA)' },
                  { id: 'missing_time', label: '❌ Sin Tiempo (0h)' },
                  { id: 'repeat', label: '🔄 Cliente Regresó (Reincidente)' },
                ].map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedWorkBucket(b.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                      selectedWorkBucket === b.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar empresa (ej. Argoz), error..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56 font-medium"
                  />
                </div>

                <select
                  value={selectedTechFilter}
                  onChange={(e) => setSelectedTechFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-700"
                >
                  <option value="all">👨‍💻 Todos los Técnicos</option>
                  {techSummaries.map((t) => (
                    <option key={t.techName} value={t.techName}>
                      {t.techName} ({t.totalTickets})
                    </option>
                  ))}
                </select>

                <select
                  value={daysRange}
                  onChange={(e) => setDaysRange(Number(e.target.value))}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-700"
                >
                  <option value={15}>Últimos 15 días</option>
                  <option value={30}>Últimos 30 días</option>
                  <option value={60}>Últimos 60 días</option>
                  <option value={120}>Últimos 4 meses</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN BODY ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* ── 4 TARJETAS SÚPER CLARAS ("EXPLICADO PARA NIÑOS") ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: ¿Hicieron el trabajo bien a la 1ª vez? */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-emerald-700">
                1. ¿Bien a la 1ª vez?
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900">
                {globalKpis.firstTimeRightPct}%
              </span>
              <span className="text-xs font-bold text-emerald-600">resueltos a la 1ª</span>
            </div>
            <p className="text-xs text-slate-600 mt-1 font-medium">
              {globalKpis.repeatCount > 0 ? (
                <span className="text-rose-600 font-bold">
                  🔄 En {globalKpis.repeatCount} casos el cliente regresó porque el problema siguió
                </span>
              ) : (
                'Ningún cliente ha regresado por el mismo problema'
              )}
            </p>
          </div>

          {/* Card 2: Auditoría IA de Tiempo (¿Correcto o Inflado?) */}
          <div className="bg-white rounded-2xl p-4 border border-rose-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-rose-700">
                2. Auditoría IA de Tiempo
              </span>
              <Clock className="w-4 h-4 text-rose-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {globalKpis.totalReported}h
              </span>
              <span className="text-xs font-bold text-slate-500">
                vs {globalKpis.totalExpected}h IA ({globalKpis.totalDiff > 0 ? '+' : ''}
                {globalKpis.totalDiff}h)
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1 font-medium">
              <span className="text-rose-600 font-bold">
                🚨 {globalKpis.inflatedCount} inflados
              </span>{' '}
              ·{' '}
              <span className="text-amber-700 font-bold">
                ❌ {globalKpis.missingTimeCount} cerrados sin poner tiempo (0h)
              </span>
            </p>
          </div>

          {/* Card 3: ¿En qué se va el tiempo? (Textos vs Implementación vs Fallas) */}
          <div className="bg-white rounded-2xl p-4 border border-indigo-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-indigo-700">
                3. ¿En qué se va el tiempo?
              </span>
              <Sparkles className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
              <div className="bg-emerald-50 rounded-xl p-1.5 border border-emerald-100">
                <p className="text-[10px] font-bold text-emerald-700">💬 Textos</p>
                <p className="text-sm font-black text-emerald-900">{globalKpis.textHours}h</p>
              </div>
              <div className="bg-violet-50 rounded-xl p-1.5 border border-violet-100">
                <p className="text-[10px] font-bold text-violet-700">🚀 Go-Live</p>
                <p className="text-sm font-black text-violet-900">{globalKpis.impHours}h</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-1.5 border border-amber-100">
                <p className="text-[10px] font-bold text-amber-700">🛠️ Fallas</p>
                <p className="text-sm font-black text-amber-900">{globalKpis.fixHours}h</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 font-medium">
              Desglose directo entre responder mensajes, implementar y reparar errores
            </p>
          </div>

          {/* Card 4: Empresa con más tickets + Clientes esperando hoy */}
          <div
            onClick={() => {
              if (globalKpis.topClient) {
                setExpandedClientName(globalKpis.topClient.clientName);
                document
                  .getElementById('accordion-clientes-section')
                  ?.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="bg-white rounded-2xl p-4 border border-amber-200 shadow-sm cursor-pointer hover:border-indigo-400 transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-amber-700">
                4. Empresa #1 en Reportes
              </span>
              <Building2 className="w-4 h-4 text-amber-600" />
            </div>
            <p className="mt-2 text-base font-black text-slate-900 truncate">
              {globalKpis.topClient ? globalKpis.topClient.clientName : 'Sin datos'}
            </p>
            <p className="text-xs text-indigo-600 font-bold mt-1">
              {globalKpis.topClient
                ? `${globalKpis.topClient.totalTickets} tickets · ${globalKpis.topClient.totalReportedHours}h (${globalKpis.openCount} abiertos hoy en total) → Clic para ver`
                : `${globalKpis.openCount} tickets abiertos hoy`}
            </p>
          </div>
        </div>

        {/* =====================================================================
            PASO 1: RADIOGRAFÍA SÚPER CLARA POR TÉCNICO (MELVIN Y GERSON)
           ===================================================================== */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-indigo-50/70 via-white to-violet-50/50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-100 text-indigo-800">
                  Paso 1 · Eficiencia del Equipo
                </span>
                <h2 className="text-lg font-black text-slate-900 mt-1">
                  ¿En qué gastan su tiempo Melvin y Gerson y qué tan bien resuelven a la 1ª vez?
                </h2>
                <p className="text-xs text-slate-600">
                  Compara cuánto tiempo pasa cada uno <strong>respondiendo textos</strong>, en{' '}
                  <strong>implementaciones / Go-Live</strong> y{' '}
                  <strong>solucionando problemas</strong>, más la auditoría IA de tiempos.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {techSummaries.map((tech) => {
              const totalHrs = Math.max(tech.totalReportedHours, 0.1);
              const pctText = Math.round((tech.textReplyHours / totalHrs) * 100);
              const pctImp = Math.round((tech.implementationHours / totalHrs) * 100);
              const pctTrb = Math.round((tech.troubleshootingHours / totalHrs) * 100);
              const pctDev = Math.round((tech.developmentHours / totalHrs) * 100);

              return (
                <div
                  key={tech.techName}
                  className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 flex flex-col justify-between space-y-4 hover:border-indigo-300 transition"
                >
                  {/* Header del Técnico */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white font-black text-base flex items-center justify-center shadow-sm">
                        {tech.techName
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900">{tech.techName}</h3>
                        <p className="text-xs text-slate-600 font-semibold">
                          <strong>{tech.totalTickets} tickets</strong> ({tech.resolvedTickets}{' '}
                          resueltos ·{' '}
                          <span className="text-rose-600 font-bold">
                            {tech.openTickets} pendientes hoy
                          </span>
                          )
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        setSelectedTechFilter(
                          selectedTechFilter === tech.techName ? 'all' : tech.techName
                        )
                      }
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${
                        selectedTechFilter === tech.techName
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-slate-200 text-indigo-700 hover:bg-indigo-50'
                      }`}
                    >
                      {selectedTechFilter === tech.techName
                        ? '✓ Viendo solo sus tickets'
                        : 'Filtrar sus tickets'}
                    </button>
                  </div>

                  {/* A. ¿EN QUÉ SE LE VA EL TIEMPO? (4 Cajas Súper Claras) */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200/90 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-slate-800 uppercase tracking-wide">
                        ⏱️ A. ¿En qué gasta su tiempo? ({tech.totalReportedHours}h registradas)
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* 1. Respondiendo Textos */}
                      <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-emerald-900">
                            💬 Respondiendo Textos
                          </span>
                          <span className="text-xs font-black text-emerald-700">{pctText}%</span>
                        </div>
                        <p className="text-lg font-black text-emerald-950 mt-1">
                          {tech.textReplyHours} hrs{' '}
                          <span className="text-xs font-bold text-emerald-700">
                            ({tech.textReplyCount} consultas)
                          </span>
                        </p>
                        <p className="text-[10px] text-emerald-800 mt-0.5">
                          Preguntas frecuentes y chats de clientes
                        </p>
                      </div>

                      {/* 2. Implementaciones / Go-Live */}
                      <div className="p-3 rounded-xl bg-violet-50/70 border border-violet-200">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-violet-900">
                            🚀 Implementaciones / Go-Live
                          </span>
                          <span className="text-xs font-black text-violet-700">{pctImp}%</span>
                        </div>
                        <p className="text-lg font-black text-violet-950 mt-1">
                          {tech.implementationHours} hrs{' '}
                          <span className="text-xs font-bold text-violet-700">
                            ({tech.implementationCount} casos)
                          </span>
                        </p>
                        <p className="text-[10px] text-violet-800 mt-0.5">
                          Capacitaciones y salidas en vivo de clientes
                        </p>
                      </div>

                      {/* 3. Solucionando Problemas (P1/P2/P3) */}
                      <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-amber-900">
                            🛠️ Solucionando Problemas
                          </span>
                          <span className="text-xs font-black text-amber-700">{pctTrb}%</span>
                        </div>
                        <p className="text-lg font-black text-amber-950 mt-1">
                          {tech.troubleshootingHours} hrs{' '}
                          <span className="text-xs font-bold text-amber-700">
                            ({tech.troubleshootingCount} tickets)
                          </span>
                        </p>
                        <p className="text-[10px] text-amber-800 mt-0.5">
                          Soporte técnico P1 Hacienda, P2 Errores y P3
                        </p>
                      </div>

                      {/* 4. Mejoras / Desarrollo (P4) */}
                      <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-blue-900">
                            ⚙️ Mejoras / Desarrollo (P4)
                          </span>
                          <span className="text-xs font-black text-blue-700">{pctDev}%</span>
                        </div>
                        <p className="text-lg font-black text-blue-950 mt-1">
                          {tech.developmentHours} hrs{' '}
                          <span className="text-xs font-bold text-blue-700">
                            ({tech.developmentCount} tareas)
                          </span>
                        </p>
                        <p className="text-[10px] text-blue-800 mt-0.5">
                          Ajustes y programación interna del sistema
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* B. ¿HIZO EL TRABAJO BIEN A LA 1ª VEZ? + C. AUDITORÍA IA DE TIEMPO */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Calidad a la 1ª vez */}
                    <div className="bg-white rounded-2xl p-3.5 border border-slate-200">
                      <p className="text-[10px] font-black uppercase text-slate-500">
                        🎯 B. ¿Bien a la 1ª vez?
                      </p>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-xl font-black text-emerald-700">
                          ✅ {tech.firstTimeRightPct}% a la 1ª
                        </span>
                        <span className="text-xs font-bold text-rose-600">
                          🔄 {tech.clientReturnedCount} regresaron
                        </span>
                      </div>
                      <div className="w-full h-2 bg-rose-100 rounded-full overflow-hidden mt-2">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${tech.firstTimeRightPct}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1.5">
                        {tech.clientReturnedCount > 0
                          ? `En ${tech.clientReturnedCount} casos el mismo cliente volvió a reportar el problema.`
                          : 'Sus clientes no han tenido que volver por el mismo fallo.'}
                      </p>
                    </div>

                    {/* Auditoría IA de Tiempo (¿Correcto o Inflado?) */}
                    <div
                      className={`rounded-2xl p-3.5 border ${
                        tech.inflatedTicketsCount > 0
                          ? 'bg-rose-50/60 border-rose-200'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <p className="text-[10px] font-black uppercase text-slate-500">
                        🤖 C. Tiempo Real vs. IA
                      </p>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-sm font-black text-slate-900">
                          Reportó: {tech.totalReportedHours}h
                        </span>
                        <span className="text-xs font-bold text-indigo-700">
                          IA: {tech.totalExpectedAiHours}h (
                          {tech.totalDiffAiHours > 0 ? '+' : ''}
                          {tech.totalDiffAiHours}h)
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                            tech.inflatedTicketsCount > 0
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {tech.inflatedTicketsCount > 0
                            ? `🚨 ${tech.inflatedTicketsCount} tiempos inflados`
                            : '✅ Sin tiempos inflados'}
                        </span>
                        {tech.missingTimeClosedCount > 0 && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-800">
                            ❌ {tech.missingTimeClosedCount} cerrados con 0h
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Clientes que más atiende */}
                  {tech.topClients.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[10px] font-black uppercase text-slate-400">
                        Empresas que más atiende:
                      </span>
                      {tech.topClients.map((c) => (
                        <button
                          key={c.clientName}
                          onClick={() => {
                            setExpandedClientName(c.clientName);
                            document
                              .getElementById('accordion-clientes-section')
                              ?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 hover:border-indigo-400 hover:text-indigo-700 transition"
                        >
                          {c.clientName} ({c.count} · {c.hours}h)
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* =====================================================================
            PASO 2: ACORDEÓN DE EMPRESAS / CLIENTES (CLIC EN ARGOZ Y VES TODO)
           ===================================================================== */}
        <div
          id="accordion-clientes-section"
          className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
        >
          <div className="p-5 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-amber-50/70 via-white to-indigo-50/40">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-900">
                  Paso 2 · Acordeón de Empresas y Auditoría IA de Tiempos
                </span>
                <h2 className="text-lg font-black text-slate-900 mt-1">
                  Haz clic en cualquier Empresa (ej. Corporación Argoz) para abrir todos sus
                  tickets y tiempos
                </h2>
                <p className="text-xs text-slate-600">
                  Todas las variantes de <strong>Argoz</strong> están unificadas en una sola fila.
                  Al abrir cada empresa verás: qué problema tuvo, si el cliente regresó, cuánto
                  tiempo reportó el técnico vs. cuánto dice la IA y el botón para abrir el ticket.
                </p>
              </div>
              <div className="text-xs font-bold text-slate-500">
                Mostrando <strong>{clientAccordions.length} empresas</strong> con reportes
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-200">
            {clientAccordions.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-500 font-semibold">
                No hay tickets que coincidan con el filtro seleccionado.
              </div>
            ) : (
              clientAccordions.map((client) => {
                const isExpanded = expandedClientName === client.clientName;
                return (
                  <div key={client.clientName} className="transition-colors">
                    {/* ── CABECERA DEL ACORDEÓN DE LA EMPRESA (CLIC PARA ABRIR/CERRAR) ── */}
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedClientName(isExpanded ? null : client.clientName)
                      }
                      className={`w-full text-left px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 transition ${
                        isExpanded ? 'bg-indigo-50/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start sm:items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition ${
                            isExpanded
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base font-black text-slate-900">
                              {client.clientName}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-800">
                              {client.totalTickets} tickets
                            </span>

                            {/* Category pills (P1, P2, P3, P4) */}
                            {client.categoryPills.map((cp) => (
                              <span
                                key={cp.code}
                                className="px-2 py-0.5 rounded-md text-[10px] font-black text-white"
                                style={{ backgroundColor: cp.color }}
                              >
                                {cp.code}: {cp.count}
                              </span>
                            ))}

                            {/* Did the client have to come back? */}
                            {client.repeatReturnsCount > 0 ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                🔄 {client.repeatReturnsCount} reincidentes (el cliente regresó)
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800">
                                ✅ Resuelto a la 1ª
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-600 font-medium mt-1 flex items-center gap-3 flex-wrap">
                            <span>
                              👨‍💻 <strong>Atiende:</strong>{' '}
                              {client.techBreakdown
                                .map((tb) => `${tb.techName} (${tb.count} · ${tb.hours}h)`)
                                .join(', ')}
                            </span>
                            {client.textReplyHours > 0 && (
                              <span className="text-emerald-700 font-bold">
                                💬 Textos: {client.textReplyHours}h
                              </span>
                            )}
                            {client.implementationHours > 0 && (
                              <span className="text-violet-700 font-bold">
                                🚀 Implementación: {client.implementationHours}h
                              </span>
                            )}
                            {client.troubleshootingHours > 0 && (
                              <span className="text-amber-700 font-bold">
                                🛠️ Fallas: {client.troubleshootingHours}h
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right side of Accordion Header: Time vs AI + Open Status */}
                      <div className="flex items-center gap-3 flex-wrap pl-12 lg:pl-0">
                        <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
                          <span className="font-bold text-slate-500">Tiempo: </span>
                          <strong className="text-slate-900">
                            {client.totalReportedHours}h
                          </strong>{' '}
                          <span className="text-slate-400">vs</span>{' '}
                          <strong className="text-indigo-700">
                            IA {client.totalExpectedAiHours}h
                          </strong>{' '}
                          <span
                            className={`font-black ${
                              client.totalDiffAiHours > 0.5
                                ? 'text-rose-600'
                                : 'text-emerald-600'
                            }`}
                          >
                            ({client.totalDiffAiHours > 0 ? '+' : ''}
                            {client.totalDiffAiHours}h)
                          </span>
                        </div>

                        {client.inflatedCount > 0 && (
                          <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">
                            🚨 {client.inflatedCount} inflados
                          </span>
                        )}

                        {client.missingTimeCount > 0 && (
                          <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                            ❌ {client.missingTimeCount} sin tiempo (0h)
                          </span>
                        )}

                        {client.openTickets > 0 ? (
                          <span className="px-3 py-1 rounded-xl text-xs font-black bg-red-600 text-white shadow-sm">
                            ⏳ {client.openTickets} abiertos hoy
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-xl text-xs font-black bg-emerald-100 text-emerald-800">
                            ✓ Al día
                          </span>
                        )}
                      </div>
                    </button>

                    {/* ── CONTENIDO DESPLEGABLE DEL ACORDEÓN (TODOS LOS TICKETS Y TIEMPOS) ── */}
                    {isExpanded && (
                      <div className="bg-slate-50/90 border-t border-indigo-100 px-4 sm:px-6 py-5 space-y-4">
                        {/* Mini Resumen de la Empresa abierta */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-white p-3 rounded-xl border border-slate-200">
                            <p className="text-[10px] font-black uppercase text-slate-400">
                              Tiempo Total Cobrado / Reportado
                            </p>
                            <p className="text-lg font-black text-slate-900">
                              {client.totalReportedHours} hrs
                            </p>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-slate-200">
                            <p className="text-[10px] font-black uppercase text-indigo-600">
                              🤖 Tiempo Justo según IA
                            </p>
                            <p className="text-lg font-black text-indigo-700">
                              {client.totalExpectedAiHours} hrs
                            </p>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-slate-200">
                            <p className="text-[10px] font-black uppercase text-slate-400">
                              📊 Diferencia para Justificar
                            </p>
                            <p
                              className={`text-lg font-black ${
                                client.totalDiffAiHours > 0.5
                                  ? 'text-rose-600'
                                  : 'text-emerald-600'
                              }`}
                            >
                              {client.totalDiffAiHours > 0 ? '+' : ''}
                              {client.totalDiffAiHours} hrs
                            </p>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-slate-200">
                            <p className="text-[10px] font-black uppercase text-slate-400">
                              🎯 Resuelto bien a la 1ª vez
                            </p>
                            <p className="text-lg font-black text-emerald-700">
                              {client.firstTimeRightPct}%{' '}
                              <span className="text-xs font-bold text-rose-600">
                                ({client.repeatReturnsCount} regresos)
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Tabla clara de todos los tickets de esta empresa */}
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto shadow-sm">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-black uppercase text-slate-600">
                                <th className="py-3 px-3">Fecha</th>
                                <th className="py-3 px-3">Tipo (P1-P4)</th>
                                <th className="py-3 px-3">Problema y ¿Bien a la 1ª?</th>
                                <th className="py-3 px-3">Técnico</th>
                                <th className="py-3 px-3">Tiempo Técnico vs. IA</th>
                                <th className="py-3 px-3">Dictamen IA de Tiempo</th>
                                <th className="py-3 px-3">Causa Raíz / Solución</th>
                                <th className="py-3 px-3 text-right">Acción</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                              {client.records.map((rec) => (
                                <tr
                                  key={rec.id}
                                  className={`hover:bg-indigo-50/30 transition ${
                                    rec.aiTimeStatus === 'inflated'
                                      ? 'bg-rose-50/20'
                                      : rec.closedWithoutTime
                                      ? 'bg-amber-50/20'
                                      : ''
                                  }`}
                                >
                                  {/* 1. Fecha */}
                                  <td className="py-3 px-3 whitespace-nowrap align-top">
                                    <p className="font-bold text-slate-800">
                                      {new Date(rec.createdAt).toLocaleDateString('es-SV', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                      })}
                                    </p>
                                    <span
                                      className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                        rec.status === 'resolved'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-red-100 text-red-700'
                                      }`}
                                    >
                                      {rec.status === 'resolved' ? 'Cerrado' : 'Abierto'}
                                    </span>
                                  </td>

                                  {/* 2. Categoría P1..P4 + Actividad */}
                                  <td className="py-3 px-3 align-top">
                                    <span
                                      className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black text-white"
                                      style={{ backgroundColor: rec.ticketCategoryColor }}
                                    >
                                      {rec.ticketCategoryName}
                                    </span>
                                    <p className="text-[11px] font-bold text-slate-600 mt-1">
                                      {rec.workBucketLabel}
                                    </p>
                                  </td>

                                  {/* 3. Problema + ¿Bien a la 1ª o regresó el cliente? */}
                                  <td className="py-3 px-3 align-top max-w-xs">
                                    <p className="font-black text-slate-900 leading-snug">
                                      {rec.title}
                                    </p>
                                    {rec.description && (
                                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                                        {rec.description}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                                      {rec.isRepeatForSameClient ? (
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                          🔄 Regreso #{rec.repeatSequenceNumber} del cliente por{' '}
                                          {rec.categoryLabel}
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700">
                                          ✅ 1ª vez reportado
                                        </span>
                                      )}
                                      {rec.hasVoiceNote && (
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-100 text-purple-800">
                                          🎤 Cliente envió Audio
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  {/* 4. Técnico */}
                                  <td className="py-3 px-3 align-top whitespace-nowrap">
                                    <span className="font-black text-slate-800">
                                      {rec.techName}
                                    </span>
                                  </td>

                                  {/* 5. Tiempo Reportado vs IA */}
                                  <td className="py-3 px-3 align-top whitespace-nowrap">
                                    <div className="space-y-0.5">
                                      <p className="text-xs">
                                        <span className="text-slate-500 font-semibold">
                                          Técnico:{' '}
                                        </span>
                                        <strong
                                          className={
                                            rec.reportedHours <= 0
                                              ? 'text-red-600 font-black'
                                              : 'text-slate-900 font-black'
                                          }
                                        >
                                          {rec.reportedHours > 0
                                            ? `${rec.reportedHours}h`
                                            : '0h (Sin tiempo)'}
                                        </strong>
                                      </p>
                                      <p className="text-xs">
                                        <span className="text-slate-500 font-semibold">
                                          Esperado IA:{' '}
                                        </span>
                                        <strong className="text-indigo-700 font-black">
                                          {rec.expectedAiHours}h
                                        </strong>
                                      </p>
                                      {rec.reportedHours > 0 && (
                                        <p
                                          className={`text-[11px] font-black ${
                                            rec.diffAiHours > 0.3
                                              ? 'text-rose-600'
                                              : 'text-emerald-600'
                                          }`}
                                        >
                                          Diferencia: {rec.diffAiHours > 0 ? '+' : ''}
                                          {rec.diffAiHours}h
                                        </p>
                                      )}
                                    </div>
                                  </td>

                                  {/* 6. Veredicto IA de Tiempo */}
                                  <td className="py-3 px-3 align-top">
                                    <span
                                      className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-black ${
                                        rec.aiTimeStatus === 'inflated'
                                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                          : rec.aiTimeStatus === 'missing_time'
                                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                          : 'bg-emerald-100 text-emerald-800'
                                      }`}
                                    >
                                      {rec.aiTimeVerdictLabel}
                                    </span>
                                    {rec.timeJustification && (
                                      <p className="text-[10px] text-slate-600 mt-1 italic">
                                        Justificación: "{rec.timeJustification}"
                                      </p>
                                    )}
                                  </td>

                                  {/* 7. Causa Raíz / Solución */}
                                  <td className="py-3 px-3 align-top max-w-xs">
                                    {rec.hasResolutionReport ? (
                                      <div className="space-y-1 text-[11px]">
                                        {rec.rootCause && (
                                          <p className="text-slate-700">
                                            <strong className="text-amber-700">Causa:</strong>{' '}
                                            {rec.rootCause}
                                          </p>
                                        )}
                                        {rec.solution && (
                                          <p className="text-slate-700">
                                            <strong className="text-emerald-700">Solución:</strong>{' '}
                                            {rec.solution}
                                          </p>
                                        )}
                                      </div>
                                    ) : rec.status === 'resolved' ? (
                                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black bg-red-100 text-red-700">
                                        ⚠️ Cerrado sin documentar Causa/Solución
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-slate-400 font-semibold">
                                        En atención...
                                      </span>
                                    )}
                                  </td>

                                  {/* 8. Botón Abrir Ticket */}
                                  <td className="py-3 px-3 align-top text-right whitespace-nowrap">
                                    {rec.rawTicket ? (
                                      <button
                                        type="button"
                                        onClick={() => setSelectedTicketForDrawer(rec.rawTicket!)}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black shadow-sm transition"
                                      >
                                        Abrir Ticket
                                        <ExternalLink className="w-3 h-3" />
                                      </button>
                                    ) : (
                                      <span className="text-[10px] font-bold text-slate-400">
                                        Tarea Proyecto
                                      </span>
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

            {/* Separate Optional Row at the bottom for Internal System Dev (P4 without client) */}
            {internalSystemAccordion && (
              <div className="bg-slate-100/70">
                <button
                  type="button"
                  onClick={() => setShowInternalTasksAccordion(!showInternalTasksAccordion)}
                  className="w-full text-left px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-200/60 transition"
                >
                  <div className="flex items-center gap-3">
                    {showInternalTasksAccordion ? (
                      <ChevronDown className="w-4 h-4 text-slate-600" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    )}
                    <span className="text-xs font-black text-slate-700">
                      {internalSystemAccordion.clientName} ({internalSystemAccordion.totalTickets}{' '}
                      tareas internas · {internalSystemAccordion.totalReportedHours}h)
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-indigo-600">
                    {showInternalTasksAccordion ? 'Ocultar tareas internas' : 'Ver tareas internas P4'}
                  </span>
                </button>
                {showInternalTasksAccordion && (
                  <div className="px-5 py-4 bg-white border-t border-slate-200">
                    <div className="space-y-2">
                      {internalSystemAccordion.records.map((rec) => (
                        <div
                          key={rec.id}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-200 text-xs"
                        >
                          <div>
                            <span className="font-black text-slate-900">{rec.title}</span>
                            <span className="ml-2 text-slate-500">({rec.techName})</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-700">
                              {rec.reportedHours}h / IA {rec.expectedAiHours}h
                            </span>
                            {rec.rawTicket && (
                              <button
                                onClick={() => setSelectedTicketForDrawer(rec.rawTicket!)}
                                className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold"
                              >
                                Abrir
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* =====================================================================
            PASO 3: REGLA Y PLANTILLA PARA AUDIOS DE WHATSAPP (SOLO TEXTO + FOTO)
           ===================================================================== */}
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-md">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-purple-200 text-xs font-black uppercase">
                <MicOff className="w-4 h-4" />
                Paso 3 · Solución al Problema de Clientes que Mandan Audios
              </div>
              <h3 className="text-lg font-black">
                ¿Qué hacemos cuando los clientes mandan audios de WhatsApp?
              </h3>
              <p className="text-xs text-purple-100 leading-relaxed">
                1. <strong>En el CRM:</strong> Si un cliente manda un audio, el puente de WhatsApp
                lo agrupa dentro de su ticket abierto y lo marca como{' '}
                <code className="bg-white/10 px-1.5 py-0.5 rounded">🎤 Cliente envió Audio</code>{' '}
                sin crear múltiples tickets basura.
                <br />
                2. <strong>Recomendación para máxima velocidad:</strong> Los audios hacen perder
                mucho tiempo a Melvin y Gerson escuchando notas largas sin ver el error. Usa este
                comunicado oficial en WhatsApp para pedirles{' '}
                <strong>Texto Escrito + Captura de Pantalla</strong>.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={copyOfficialNoAudioPolicy}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg transition"
              >
                <Copy className="w-4 h-4" />
                Copiar Mensaje Oficial: "Solo Texto + Captura"
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── DRAWER LATERAL DEL TICKET (PARA AUDITAR O JUSTIFICAR SIN SALIR DE AQUÍ) ── */}
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
