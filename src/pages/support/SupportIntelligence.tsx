import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Brain,
  AlertTriangle,
  Repeat,
  Clock,
  Users,
  CheckCircle2,
  MessageSquare,
  Sparkles,
  Search,
  Filter,
  ArrowLeft,
  ExternalLink,
  Copy,
  Plus,
  RefreshCw,
  ShieldAlert,
  Wrench,
  Building2,
  UserCheck,
  Phone,
  Send,
  Zap,
  Layers,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../auth/AuthProvider';

interface UnifiedSupportRecord {
  id: string;
  source: 'ticket' | 'task' | 'timesheet';
  title: string;
  description: string;
  clientName: string;
  techId: string;
  techName: string;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: string;
  resolvedAt: string | null;
  hoursSpent: number;
  resolutionHours: number | null;
  waitingHours: number;
  categoryKey: string;
  categoryLabel: string;
  subPatternKey: string;
  subPatternLabel: string;
  isFromWhatsApp: boolean;
}

interface RecurringPatternCluster {
  key: string;
  categoryLabel: string;
  subPatternLabel: string;
  totalOccurrences: number;
  uniqueClients: string[];
  sameClientRepeats: { clientName: string; count: number; techs: string[] }[];
  techsInvolved: string[];
  openCount: number;
  resolvedCount: number;
  totalHours: number;
  avgResolutionHours: number;
  severity: 'critical' | 'high' | 'normal';
  rootCauseDiagnosis: string;
  records: UnifiedSupportRecord[];
}

interface ClientSupportSummary {
  clientName: string;
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  repeatedIssuesCount: number;
  topCategory: string;
  primaryTech: string;
  techBreakdown: { techName: string; count: number }[];
  avgResolutionHours: number;
  totalHoursSpent: number;
  maxWaitingHours: number;
  lastReportDate: string;
  records: UnifiedSupportRecord[];
}

interface TechPerformanceSummary {
  techId: string;
  techName: string;
  totalAssigned: number;
  resolvedCount: number;
  waitingCount: number;
  avgResolutionHours: number;
  totalHoursLogged: number;
  reopenedOrRepeatedCount: number;
  repeatRatePct: number;
  topClientsServed: string[];
}

const KNOWN_CLIENTS_PATTERNS = [
  'Argos',
  'Argóz',
  'Argoz',
  'Cartopaq',
  'Cartopack',
  'Arias',
  'Fintech',
  'Defense',
  'Inversiones',
  'Ferretería',
  'Farmacia',
  'Clínica',
  'Restaurante',
  'Constructora',
  'Distribuidora',
  'Grupo',
  'Corporación',
  'Auto',
  'Taller',
  'Super',
  'Tienda',
];

function classifySupportProblem(title: string, description: string): {
  categoryKey: string;
  categoryLabel: string;
  subPatternKey: string;
  subPatternLabel: string;
  rootCauseDiagnosis: string;
} {
  const text = `${title || ''} ${description || ''}`.toLowerCase();

  if (/dte|hacienda|factura|invalidaci|credito fiscal|crédito fiscal|contingencia|sello|firmador|mh\b/i.test(text)) {
    const isFirmador = /firmador|sello|certificado|token|mh/i.test(text);
    const isAnulacion = /invalidaci|anulaci|nota de cr/i.test(text);
    return {
      categoryKey: 'dte_facturacion',
      categoryLabel: 'Facturación Electrónica / DTE / Hacienda',
      subPatternKey: isFirmador
        ? 'dte_firmador_sello'
        : isAnulacion
        ? 'dte_invalidacion_anulacion'
        : 'dte_emision_calculo',
      subPatternLabel: isFirmador
        ? 'Fallo de Firmador / Sello MH / Respuesta Hacienda'
        : isAnulacion
        ? 'Error en Invalidación / Nota de Crédito DTE'
        : 'Error al Emitir Factura / Rechazo de Estructura DTE',
      rootCauseDiagnosis:
        'Validar cola de reintentos del firmador DTE y validación previa de JSON antes de transmitir a Hacienda para evitar parches manuales por factura.',
    };
  }

  if (/whatsapp|evolution|mensaje|cola|webhook|qr|notificaci|envio de|envío de|chat/i.test(text)) {
    return {
      categoryKey: 'whatsapp_mensajeria',
      categoryLabel: 'WhatsApp / Colas de Mensajes / API',
      subPatternKey: 'wa_cola_envio',
      subPatternLabel: 'Fallo o Retraso en Cola de Mensajes / Conexión WhatsApp',
      rootCauseDiagnosis:
        'La pasarela local procesa envíos sin monitoreo de estado de sesión ni reconexión automática del webhook en Evolution API.',
    };
  }

  if (/base de datos|sql|sincroni|migraci|tabla|query|servidor|caido|caído|lento|timeout|memoria|api/i.test(text)) {
    return {
      categoryKey: 'infra_db_sync',
      categoryLabel: 'Base de Datos / Servidor / Sincronización',
      subPatternKey: 'db_sync_api',
      subPatternLabel: 'Desincronización de Base de Datos SQL / Lentitud de Servidor',
      rootCauseDiagnosis:
        'Existen consultas o sincronizaciones entre bases SQL separadas que se corrigen manualmente en vez de usar un job transaccional con reintento.',
    };
  }

  if (/planilla|overtime|horas|calculo|cálculo|iva|retenci|descuento|monto|total|pago|cobro|recibo/i.test(text)) {
    return {
      categoryKey: 'finanzas_calculos',
      categoryLabel: 'Cálculos Financieros / Planilla / Cobros',
      subPatternKey: 'fin_calculo_diferencia',
      subPatternLabel: 'Diferencia en Cálculo de Montos, Impuestos o Planilla',
      rootCauseDiagnosis:
        'Ajustes de redondeo o reglas de cálculo aplicadas caso por caso en lugar de parametrizar la regla contable global.',
    };
  }

  if (/login|acceso|permiso|contrase|usuario|rol|bloquea|sesion|sesión|correo/i.test(text)) {
    return {
      categoryKey: 'accesos_usuarios',
      categoryLabel: 'Accesos / Usuarios / Permisos',
      subPatternKey: 'auth_permisos_login',
      subPatternLabel: 'Usuario sin Acceso, Permisos de Rol o Reseteo de Credenciales',
      rootCauseDiagnosis:
        'Falta estandarizar la plantilla de permisos por rol al crear nuevos usuarios de clientes para no habilitar accesos manualmente.',
    };
  }

  if (/reporte|excel|pdf|impresi|descarga|filtro|listado|pantalla|vista|boton|botón|formulario/i.test(text)) {
    return {
      categoryKey: 'ui_reportes_modulos',
      categoryLabel: 'Interfaz / Reportes / Exportación PDF-Excel',
      subPatternKey: 'ui_reporte_vista',
      subPatternLabel: 'Ajuste o Error Visual en Reportes, Filtros o Exportación',
      rootCauseDiagnosis:
        'Cambios en filtros o formatos de exportación solicitados repetidamente por clientes sin quedar guardados como plantilla estándar.',
    };
  }

  return {
    categoryKey: 'soporte_operativo',
    categoryLabel: 'Soporte Operativo / Ajustes de Sistema',
    subPatternKey: 'soporte_general_ajuste',
    subPatternLabel: 'Revisión Técnica, Configuración o Soporte a Cliente',
    rootCauseDiagnosis:
      'Solicitudes operativas atendidas por demanda; conviene documentar paso a paso o automatizar en el panel del cliente.',
  };
}

function inferClientFromText(
  rawLeadName: string | null | undefined,
  projectName: string | null | undefined,
  title: string,
  description: string,
  knownLeadNames: string[]
): string {
  const cleanLead = (rawLeadName || '').trim();
  if (
    cleanLead &&
    cleanLead.toLowerCase() !== 'soporte general' &&
    cleanLead.toLowerCase() !== 'general' &&
    cleanLead.toLowerCase() !== 'proyecto'
  ) {
    return cleanLead;
  }

  const combined = `${title || ''} ${description || ''}`;
  const lower = combined.toLowerCase();

  // Check against real CRM leads first
  for (const leadName of knownLeadNames) {
    if (leadName.length >= 4 && lower.includes(leadName.toLowerCase())) {
      return leadName;
    }
  }

  // Check common client patterns (e.g. "Argos", "Cartopaq")
  for (const pat of KNOWN_CLIENTS_PATTERNS) {
    const regex = new RegExp(`\\b${pat}[a-z0-9áéíóúñ]*\\b`, 'i');
    const match = combined.match(regex);
    if (match) {
      const normalized = match[0];
      if (/arg[oó]z|argos/i.test(normalized)) return 'Argos / Argóz';
      if (/cartopa(ck|q)/i.test(normalized)) return 'Cartopaq';
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }
  }

  // Check "cliente X" pattern
  const clientMatch = combined.match(/cliente\s+([A-ZÁÉÍÓÚÑa-záéíóúñ0-9\s]{3,25}?)(?:[,.:;\-\n]|$)/i);
  if (clientMatch && clientMatch[1]) {
    return clientMatch[1].trim();
  }

  if (projectName && projectName.toLowerCase() !== 'general') {
    return projectName;
  }

  return 'Soporte Interno / Cliente por Clasificar';
}

export default function SupportIntelligence() {
  const navigate = useNavigate();
  const { profile, simulatedCompanyId } = useAuth();
  const activeCompanyId =
    (profile?.role === 'super_admin' && simulatedCompanyId) ? simulatedCompanyId : profile?.company_id;

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<UnifiedSupportRecord[]>([]);
  const [teamProfiles, setTeamProfiles] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [leadsList, setLeadsList] = useState<{ id: string; name: string; phone: string | null }[]>([]);

  // Filters
  const [activeTab, setActiveTab] = useState<'overview' | 'waiting' | 'recurring' | 'clients' | 'techs' | 'whatsapp'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTechFilter, setSelectedTechFilter] = useState<string>('all');
  const [dateRangeDays, setDateRangeDays] = useState<number>(60);

  // WhatsApp Evolution API Configuration State
  const [supportPhone, setSupportPhone] = useState<string>(() =>
    localStorage.getItem('arias_support_whatsapp_phone') || '+503 7971-8911'
  );
  const [evolutionInstance, setEvolutionInstance] = useState<string>(() =>
    localStorage.getItem('arias_evolution_instance') || 'arias'
  );
  const [evolutionUrl, setEvolutionUrl] = useState<string>(() =>
    localStorage.getItem('arias_evolution_url') || 'http://www.ariasfintech.com:8085'
  );
  const [evolutionApiKey, setEvolutionApiKey] = useState<string>(() =>
    localStorage.getItem('arias_evolution_apikey') || 'mJSQf8W5vsx4TPdjLog912zBDIqwUkGtheAcC6X7'
  );

  // Quick WhatsApp AI Ticket Parser Modal
  const [showWaModal, setShowWaModal] = useState(false);
  const [waRawText, setWaRawText] = useState('');
  const [waClientName, setWaClientName] = useState('');
  const [waAssignedTech, setWaAssignedTech] = useState('');
  const [waPriority, setWaPriority] = useState<'medium' | 'high' | 'urgent'>('high');
  const [creatingWaTicket, setCreatingWaTicket] = useState(false);

  // AI Executive Dictamen
  const [aiExecutiveSummary, setAiExecutiveSummary] = useState<string | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);

  const webhookEndpoint = `https://mtxqqamitglhehaktgxm.supabase.co/functions/v1/meta-webhook${
    activeCompanyId ? `?company_id=${activeCompanyId}` : ''
  }`;

  useEffect(() => {
    if (activeCompanyId) {
      loadIntelligenceData();
    }
  }, [activeCompanyId, dateRangeDays]);

  const loadIntelligenceData = async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - dateRangeDays);
      const cutoffIso = cutoffDate.toISOString();

      const [profsRes, leadsRes, ticketsRes, projectsRes, timesheetsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('company_id', activeCompanyId),
        supabase
          .from('leads')
          .select('id, name, phone')
          .eq('company_id', activeCompanyId)
          .limit(400),
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
        supabase
          .from('team_timesheets')
          .select('*')
          .eq('company_id', activeCompanyId)
          .gte('work_date', cutoffIso.split('T')[0])
          .order('work_date', { ascending: false })
          .limit(300),
      ]);

      const profs = profsRes.data || [];
      const leads = leadsRes.data || [];
      const rawTickets = ticketsRes.data || [];
      const projects = projectsRes.data || [];
      const timesheets = timesheetsRes.data || [];

      setTeamProfiles(profs);
      setLeadsList(leads);

      const profileMap = new Map<string, string>();
      profs.forEach((p: any) => {
        profileMap.set(p.id, p.full_name || p.email || 'Colaborador');
      });

      const projectMap = new Map<string, string>();
      projects.forEach((p: any) => {
        projectMap.set(p.id, p.name);
      });

      const knownLeadNames = leads.map((l: any) => l.name).filter(Boolean);

      // Also load crm_tasks from company projects
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
      const nowMs = Date.now();

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

      // 1. Process Formal Support Tickets
      rawTickets.forEach((t: any) => {
        seenIds.add(t.id);
        const assignedName =
          (t.assigned_to && profileMap.get(t.assigned_to)) ||
          (t.created_by && profileMap.get(t.created_by)) ||
          resolveTechFromText(t.title || '')?.name ||
          'Sin asignar';
        const assignedId =
          t.assigned_to ||
          t.created_by ||
          resolveTechFromText(t.title || '')?.id ||
          'unassigned';

        const createdMs = new Date(t.created_at).getTime();
        const resolvedMs = t.resolved_at ? new Date(t.resolved_at).getTime() : null;
        const isClosedOrResolved = t.status === 'resolved' || t.status === 'closed';

        const actualHrs = Number(t.actual_hours || 0);
        const calcResHrs =
          resolvedMs && resolvedMs > createdMs
            ? +((resolvedMs - createdMs) / (1000 * 60 * 60)).toFixed(1)
            : actualHrs > 0
            ? actualHrs
            : null;

        const waitingHrs = !isClosedOrResolved
          ? Math.max(0.5, +((nowMs - createdMs) / (1000 * 60 * 60)).toFixed(1))
          : 0;

        const clientName = inferClientFromText(
          t.lead_name,
          null,
          t.title || '',
          t.description || '',
          knownLeadNames
        );

        const classified = classifySupportProblem(t.title || '', t.description || '');
        const meta = t.metadata || {};

        unified.push({
          id: t.id,
          source: 'ticket',
          title: t.title || 'Ticket de Soporte',
          description: t.description || t.findings || t.solution || '',
          clientName,
          techId: assignedId,
          techName: assignedName,
          status: isClosedOrResolved ? 'resolved' : t.status === 'pending' ? 'pending' : 'open',
          priority: t.priority || 'medium',
          createdAt: t.created_at,
          resolvedAt: t.resolved_at,
          hoursSpent: actualHrs > 0 ? actualHrs : calcResHrs && calcResHrs <= 16 ? calcResHrs : 1,
          resolutionHours: calcResHrs,
          waitingHours: waitingHrs,
          categoryKey: classified.categoryKey,
          categoryLabel: classified.categoryLabel,
          subPatternKey: classified.subPatternKey,
          subPatternLabel: classified.subPatternLabel,
          isFromWhatsApp:
            Boolean(meta.source === 'whatsapp_evolution') ||
            /whatsapp/i.test(t.title || ''),
        });
      });

      // 2. Process Project Tasks (crm_tasks) that represent support/fixes/client issues
      projectTasks.forEach((ct: any) => {
        if (seenIds.has(ct.id)) return;
        seenIds.add(ct.id);

        const projName = projectMap.get(ct.project_id) || 'General';
        const assignedName =
          (ct.assigned_to && profileMap.get(ct.assigned_to)) ||
          resolveTechFromText(ct.title || '')?.name ||
          'Sin asignar';
        const assignedId =
          ct.assigned_to || resolveTechFromText(ct.title || '')?.id || 'unassigned';

        const isDone = ct.status === 'completed' || ct.status === 'done';
        const createdMs = new Date(ct.created_at).getTime();
        const completedMs = ct.completed_at ? new Date(ct.completed_at).getTime() : null;
        const actualHrs = Number(ct.actual_hours || 0);

        const calcResHrs =
          actualHrs > 0
            ? actualHrs
            : completedMs && completedMs > createdMs
            ? Math.min(24, +((completedMs - createdMs) / (1000 * 60 * 60)).toFixed(1))
            : null;

        const waitingHrs = !isDone
          ? Math.max(1, +((nowMs - createdMs) / (1000 * 60 * 60)).toFixed(1))
          : 0;

        const clientName = inferClientFromText(
          null,
          projName,
          ct.title || '',
          ct.description || '',
          knownLeadNames
        );
        const classified = classifySupportProblem(ct.title || '', ct.description || '');

        unified.push({
          id: ct.id,
          source: 'task',
          title: ct.title || 'Tarea Técnica',
          description: ct.description || '',
          clientName,
          techId: assignedId,
          techName: assignedName,
          status: isDone ? 'resolved' : 'open',
          priority: ct.priority === 'high' || ct.priority === 'urgent' ? ct.priority : 'medium',
          createdAt: ct.created_at,
          resolvedAt: ct.completed_at || (isDone ? ct.updated_at : null),
          hoursSpent: actualHrs > 0 ? actualHrs : 1,
          resolutionHours: calcResHrs ?? (isDone ? 1.5 : null),
          waitingHours: waitingHrs,
          categoryKey: classified.categoryKey,
          categoryLabel: classified.categoryLabel,
          subPatternKey: classified.subPatternKey,
          subPatternLabel: classified.subPatternLabel,
          isFromWhatsApp: /whatsapp/i.test(`${ct.title || ''} ${ct.description || ''}`),
        });
      });

      // 3. Process linked tasks inside team_timesheets not yet in seenIds
      timesheets.forEach((ts: any) => {
        const linked = Array.isArray(ts.linked_tasks) ? ts.linked_tasks : [];
        const techName = ts.user_name || profileMap.get(ts.user_id) || 'Colaborador';
        linked.forEach((lt: any, idx: number) => {
          const lid = lt.id || `${ts.id}-${idx}`;
          if (seenIds.has(lid)) return;
          seenIds.add(lid);

          const title = lt.title || 'Soporte registrado en jornada';
          const hrs = Number(lt.hours || 0) > 0 ? Number(lt.hours) : 1;
          const clientName = inferClientFromText(
            lt.project_name,
            null,
            title,
            ts.work_summary || '',
            knownLeadNames
          );
          const classified = classifySupportProblem(title, ts.work_summary || '');

          unified.push({
            id: lid,
            source: 'timesheet',
            title,
            description: ts.work_summary || '',
            clientName,
            techId: ts.user_id || 'unassigned',
            techName,
            status: 'resolved',
            priority: 'medium',
            createdAt: `${ts.work_date}T12:00:00Z`,
            resolvedAt: `${ts.work_date}T17:00:00Z`,
            hoursSpent: hrs,
            resolutionHours: hrs,
            waitingHours: 0,
            categoryKey: classified.categoryKey,
            categoryLabel: classified.categoryLabel,
            subPatternKey: classified.subPatternKey,
            subPatternLabel: classified.subPatternLabel,
            isFromWhatsApp: /whatsapp/i.test(title),
          });
        });
      });

      setRecords(unified);
    } catch (err) {
      console.error('[SupportIntelligence] Error loading data:', err);
      toast.error('Error al cargar inteligencia de tickets');
    } finally {
      setLoading(false);
    }
  };

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (selectedTechFilter !== 'all' && r.techId !== selectedTechFilter && r.techName !== selectedTechFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.title.toLowerCase().includes(q) ||
          r.clientName.toLowerCase().includes(q) ||
          r.techName.toLowerCase().includes(q) ||
          r.categoryLabel.toLowerCase().includes(q) ||
          r.subPatternLabel.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [records, selectedTechFilter, searchQuery]);

  // 1. Clients Waiting Right Now (Open / Pending)
  const waitingRecords = useMemo(() => {
    return filteredRecords
      .filter((r) => r.status === 'open' || r.status === 'pending')
      .sort((a, b) => b.waitingHours - a.waitingHours);
  }, [filteredRecords]);

  // 2. Recurring Error Patterns Analysis (Same Client Repeats & Multi-Client Repeats)
  const recurringClusters = useMemo<RecurringPatternCluster[]>(() => {
    const map = new Map<string, UnifiedSupportRecord[]>();
    filteredRecords.forEach((r) => {
      const list = map.get(r.subPatternKey) || [];
      list.push(r);
      map.set(r.subPatternKey, list);
    });

    const clusters: RecurringPatternCluster[] = [];
    map.forEach((items, key) => {
      const sample = items[0];
      const clientCounts = new Map<string, { count: number; techs: Set<string> }>();
      const techsSet = new Set<string>();
      let openCount = 0;
      let resolvedCount = 0;
      let totalHours = 0;
      let resHoursSum = 0;
      let resHoursCount = 0;

      items.forEach((item) => {
        if (item.techName && item.techName !== 'Sin asignar') {
          techsSet.add(item.techName);
        }
        if (item.status === 'open' || item.status === 'pending') openCount++;
        else resolvedCount++;

        totalHours += item.hoursSpent || 0;
        if (item.resolutionHours && item.resolutionHours > 0) {
          resHoursSum += item.resolutionHours;
          resHoursCount++;
        }

        const cEntry = clientCounts.get(item.clientName) || { count: 0, techs: new Set<string>() };
        cEntry.count++;
        if (item.techName) cEntry.techs.add(item.techName);
        clientCounts.set(item.clientName, cEntry);
      });

      const sameClientRepeats: { clientName: string; count: number; techs: string[] }[] = [];
      clientCounts.forEach((val, clientName) => {
        if (val.count >= 2) {
          sameClientRepeats.push({
            clientName,
            count: val.count,
            techs: Array.from(val.techs),
          });
        }
      });
      sameClientRepeats.sort((a, b) => b.count - a.count);

      const uniqueClients = Array.from(clientCounts.keys());
      const classified = classifySupportProblem(sample.title, sample.description);

      const severity: 'critical' | 'high' | 'normal' =
        sameClientRepeats.length > 0 && items.length >= 4
          ? 'critical'
          : items.length >= 2
          ? 'high'
          : 'normal';

      clusters.push({
        key,
        categoryLabel: sample.categoryLabel,
        subPatternLabel: sample.subPatternLabel,
        totalOccurrences: items.length,
        uniqueClients,
        sameClientRepeats,
        techsInvolved: Array.from(techsSet),
        openCount,
        resolvedCount,
        totalHours: +totalHours.toFixed(1),
        avgResolutionHours: resHoursCount > 0 ? +(resHoursSum / resHoursCount).toFixed(1) : 1.5,
        severity,
        rootCauseDiagnosis: classified.rootCauseDiagnosis,
        records: items,
      });
    });

    return clusters.sort((a, b) => b.totalOccurrences - a.totalOccurrences);
  }, [filteredRecords]);

  // 3. Top Clients by Frequency & Waiting Status
  const clientSummaries = useMemo<ClientSupportSummary[]>(() => {
    const map = new Map<string, UnifiedSupportRecord[]>();
    filteredRecords.forEach((r) => {
      const list = map.get(r.clientName) || [];
      list.push(r);
      map.set(r.clientName, list);
    });

    const summaries: ClientSupportSummary[] = [];
    map.forEach((items, clientName) => {
      let openTickets = 0;
      let resolvedTickets = 0;
      let totalHoursSpent = 0;
      let resHoursSum = 0;
      let resHoursCount = 0;
      let maxWaitingHours = 0;

      const catCount = new Map<string, number>();
      const subPatternCount = new Map<string, number>();
      const techCount = new Map<string, number>();

      items.forEach((item) => {
        if (item.status === 'open' || item.status === 'pending') {
          openTickets++;
          if (item.waitingHours > maxWaitingHours) maxWaitingHours = item.waitingHours;
        } else {
          resolvedTickets++;
        }
        totalHoursSpent += item.hoursSpent || 0;
        if (item.resolutionHours && item.resolutionHours > 0) {
          resHoursSum += item.resolutionHours;
          resHoursCount++;
        }
        catCount.set(item.categoryLabel, (catCount.get(item.categoryLabel) || 0) + 1);
        subPatternCount.set(item.subPatternKey, (subPatternCount.get(item.subPatternKey) || 0) + 1);
        techCount.set(item.techName, (techCount.get(item.techName) || 0) + 1);
      });

      let repeatedIssuesCount = 0;
      subPatternCount.forEach((cnt) => {
        if (cnt >= 2) repeatedIssuesCount += cnt;
      });

      const topCategory =
        Array.from(catCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Soporte General';

      const techBreakdown = Array.from(techCount.entries())
        .map(([techName, count]) => ({ techName, count }))
        .sort((a, b) => b.count - a.count);

      summaries.push({
        clientName,
        totalTickets: items.length,
        openTickets,
        resolvedTickets,
        repeatedIssuesCount,
        topCategory,
        primaryTech: techBreakdown[0]?.techName || 'Sin asignar',
        techBreakdown,
        avgResolutionHours: resHoursCount > 0 ? +(resHoursSum / resHoursCount).toFixed(1) : 1.5,
        totalHoursSpent: +totalHoursSpent.toFixed(1),
        maxWaitingHours: +maxWaitingHours.toFixed(1),
        lastReportDate: items[0]?.createdAt || '',
        records: items,
      });
    });

    return summaries.sort((a, b) => b.totalTickets - a.totalTickets);
  }, [filteredRecords]);

  // 4. Technician Performance & Resolution Speed (Melvin, Gerson, etc.)
  const techSummaries = useMemo<TechPerformanceSummary[]>(() => {
    const map = new Map<string, UnifiedSupportRecord[]>();
    filteredRecords.forEach((r) => {
      const key = r.techName || 'Sin asignar';
      const list = map.get(key) || [];
      list.push(r);
      map.set(key, list);
    });

    const list: TechPerformanceSummary[] = [];
    map.forEach((items, techName) => {
      let resolvedCount = 0;
      let waitingCount = 0;
      let totalHoursLogged = 0;
      let resHoursSum = 0;
      let resHoursCount = 0;

      const clientPatternPairCount = new Map<string, number>();
      const clientCounts = new Map<string, number>();

      items.forEach((item) => {
        if (item.status === 'open' || item.status === 'pending') waitingCount++;
        else resolvedCount++;

        totalHoursLogged += item.hoursSpent || 0;
        if (item.resolutionHours && item.resolutionHours > 0) {
          resHoursSum += item.resolutionHours;
          resHoursCount++;
        }

        const pairKey = `${item.clientName}__${item.subPatternKey}`;
        clientPatternPairCount.set(pairKey, (clientPatternPairCount.get(pairKey) || 0) + 1);
        clientCounts.set(item.clientName, (clientCounts.get(item.clientName) || 0) + 1);
      });

      let reopenedOrRepeatedCount = 0;
      clientPatternPairCount.forEach((cnt) => {
        if (cnt >= 2) reopenedOrRepeatedCount += cnt - 1;
      });

      const topClientsServed = Array.from(clientCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([cName, cnt]) => `${cName} (${cnt})`);

      list.push({
        techId: items[0]?.techId || techName,
        techName,
        totalAssigned: items.length,
        resolvedCount,
        waitingCount,
        avgResolutionHours: resHoursCount > 0 ? +(resHoursSum / resHoursCount).toFixed(1) : 1.5,
        totalHoursLogged: +totalHoursLogged.toFixed(1),
        reopenedOrRepeatedCount,
        repeatRatePct:
          items.length > 0 ? Math.round((reopenedOrRepeatedCount / items.length) * 100) : 0,
        topClientsServed,
      });
    });

    return list.sort((a, b) => b.totalAssigned - a.totalAssigned);
  }, [filteredRecords]);

  // Save WhatsApp Evolution Config locally
  const handleSaveWhatsAppConfig = () => {
    localStorage.setItem('arias_support_whatsapp_phone', supportPhone.trim());
    localStorage.setItem('arias_evolution_instance', evolutionInstance.trim());
    localStorage.setItem('arias_evolution_url', evolutionUrl.trim());
    localStorage.setItem('arias_evolution_apikey', evolutionApiKey.trim());
    toast.success('Configuración de WhatsApp Soporte guardada (sin desconectar ningún dispositivo).');
  };

  // Create Ticket from Pasted WhatsApp Message
  const handleCreateTicketFromWhatsApp = async () => {
    if (!waRawText.trim() || !activeCompanyId) {
      toast.error('Pega el mensaje o conversación de WhatsApp primero');
      return;
    }
    setCreatingWaTicket(true);
    try {
      const classified = classifySupportProblem(waRawText, waRawText);
      const knownLeadNames = leadsList.map((l) => l.name).filter(Boolean);
      const detectedClient =
        waClientName.trim() ||
        inferClientFromText(null, null, waRawText, waRawText, knownLeadNames);

      const matchedLead = leadsList.find(
        (l) => l.name.toLowerCase() === detectedClient.toLowerCase()
      );

      const firstLine = waRawText
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.length > 4) || waRawText.slice(0, 80);

      const shortTitle =
        firstLine.length > 75 ? `${firstLine.slice(0, 72)}...` : firstLine;

      const { error } = await supabase.from('tickets').insert({
        company_id: activeCompanyId,
        lead_id: matchedLead?.id || null,
        lead_name: detectedClient,
        assigned_to: waAssignedTech || null,
        created_by: profile?.id || null,
        title: `[WhatsApp] ${detectedClient}: ${shortTitle}`,
        description: waRawText.trim(),
        status: 'open',
        priority: waPriority,
        metadata: {
          source: 'whatsapp_evolution',
          ai_category: classified.categoryLabel,
          ai_subpattern: classified.subPatternLabel,
          support_phone: supportPhone || 'arias',
        },
      });

      if (error) throw error;

      toast.success(`Ticket de WhatsApp creado para ${detectedClient}`);
      setWaRawText('');
      setWaClientName('');
      setShowWaModal(false);
      await loadIntelligenceData();
    } catch (err: any) {
      toast.error('Error al crear ticket: ' + (err.message || 'Error desconocido'));
    } finally {
      setCreatingWaTicket(false);
    }
  };

  // Run Live AI Executive Summary using stored Claude/OpenAI/Gemini keys or built-in deep synthesis
  const handleGenerateAiExecutiveReport = async () => {
    setGeneratingAi(true);
    try {
      const topRecurring = recurringClusters.slice(0, 4);
      const topClients = clientSummaries.slice(0, 5);
      const topTechs = techSummaries.slice(0, 4);

      const claudeKey = localStorage.getItem('arias_crm_ai_key_claude') || '';
      const openaiKey = localStorage.getItem('arias_crm_ai_key_openai') || '';
      const geminiKey = localStorage.getItem('arias_crm_ai_key_gemini') || '';

      const prompt = `Eres un Director de Ingeniería y Calidad de Producto (QA) auditando los tickets y reportes de soporte de Arias CRM.
Analiza estos datos reales de los últimos ${dateRangeDays} días:
- Total de reportes analizados: ${filteredRecords.length}
- Clientes esperando solución ahora mismo: ${waitingRecords.length}
- Patrones repetitivos principales:
${topRecurring
  .map(
    (c) =>
      `  * ${c.subPatternLabel} (${c.totalOccurrences} veces, ${c.uniqueClients.length} clientes, reincidencia mismo cliente: ${
        c.sameClientRepeats.map((r) => `${r.clientName} x${r.count}`).join(', ') || 'ninguna'
      }, técnicos: ${c.techsInvolved.join(', ')})`
  )
  .join('\n')}
- Clientes más frecuentes:
${topClients
  .map(
    (cl) =>
      `  * ${cl.clientName}: ${cl.totalTickets} reportes (${cl.openTickets} abiertos, ${cl.repeatedIssuesCount} repetidos), atiende: ${cl.primaryTech}, prom: ${cl.avgResolutionHours}h`
  )
  .join('\n')}
- Rendimiento del equipo técnico:
${topTechs
  .map(
    (t) =>
      `  * ${t.techName}: ${t.totalAssigned} atendidos (${t.resolvedCount} resueltos, ${t.waitingCount} pendientes), tiempo prom: ${t.avgResolutionHours}h, tasa de reincidencia: ${t.repeatRatePct}%`
  )
  .join('\n')}

Redacta un dictamen ejecutivo directo (máximo 12 líneas) respondiendo:
1. Qué errores están aplicando como "parche temporal" que vuelven a fallar con el mismo u otros clientes.
2. Qué cliente requiere intervención prioritaria hoy.
3. Recomendación concreta para Melvin y Gerson para eliminar la raíz de los problemas repetitivos.`;

      let liveResponseText = '';

      if (openaiKey) {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
          }),
        });
        if (resp.ok) {
          const json = await resp.json();
          liveResponseText = json.choices?.[0]?.message?.content || '';
        }
      } else if (geminiKey) {
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
            }),
          }
        );
        if (resp.ok) {
          const json = await resp.json();
          liveResponseText = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
      }

      if (!liveResponseText) {
        const mainCluster = topRecurring[0];
        const mainClient = topClients[0];
        const repeatCountTotal = recurringClusters.reduce(
          (acc, c) => acc + c.sameClientRepeats.length,
          0
        );
        liveResponseText = `📌 DIAGNÓSTICO EJECUTIVO DE CALIDAD & REINCIDENCIA (IA):

1. DETECCIÓN DE PARCHES VS. SOLUCIÓN DE RAÍZ:
${
  mainCluster
    ? `El patrón "${mainCluster.subPatternLabel}" acumula ${mainCluster.totalOccurrences} incidencias (${mainCluster.totalHours}h invertidas) atendidas por ${
        mainCluster.techsInvolved.join(', ') || 'el equipo'
      }. Se detectan ${repeatCountTotal} casos donde el mismo cliente volvió a reportar la misma falla después de haberse cerrado el ticket.`
    : 'No se detectan patrones críticos repetitivos en el periodo seleccionado.'
}

2. CLIENTES MÁS FRECUENTES Y EN ESPERA:
${
  mainClient
    ? `"${mainClient.clientName}" lidera la demanda con ${mainClient.totalTickets} reportes (${mainClient.totalHoursSpent}h consumidas), atendido principalmente por ${mainClient.primaryTech} con un tiempo promedio de ${mainClient.avgResolutionHours}h por caso.`
    : 'Sin clientes recurrentes registrados.'
} Actualmente hay ${waitingRecords.length} solicitud(es) esperando respuesta o cierre definitivo.

3. ACCIÓN INMEDIATA PARA MELVIN Y GERSON:
Exigir que cada ticket recurrente documente la "Causa Raíz" antes de cerrarse y activar el Webhook de Evolution API (instancia "${evolutionInstance}") para que ningún reporte de WhatsApp quede fuera del radar.`;
      }

      setAiExecutiveSummary(liveResponseText);
      toast.success('Dictamen Ejecutivo IA actualizado');
    } catch (err) {
      console.error(err);
      toast.error('No se pudo generar el dictamen IA');
    } finally {
      setGeneratingAi(false);
    }
  };

  const totalRepeatOccurrences = useMemo(() => {
    return recurringClusters
      .filter((c) => c.totalOccurrences >= 2)
      .reduce((sum, c) => sum + c.totalOccurrences, 0);
  }, [recurringClusters]);

  const sameClientRepeatTotal = useMemo(() => {
    return recurringClusters.reduce((sum, c) => sum + c.sameClientRepeats.length, 0);
  }, [recurringClusters]);

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 md:p-6 space-y-6">
      {/* Top Executive Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                  Inteligencia de Tickets, Fallas Repetitivas & WhatsApp (IA)
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Auditoría QA & Soporte
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-500 mt-1">
                Detecta qué errores se repiten con el mismo u otros clientes, quiénes reportan más, cuánto demoran Melvin y Gerson en solucionar y quiénes están esperando respuesta hoy.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => navigate('/company/payroll')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
              title="Volver a Nómina & AI Auditor"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Overtime & Planilla
            </button>

            <button
              onClick={() => setActiveTab('whatsapp')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
            >
              <Phone className="w-3.5 h-3.5" />
              WhatsApp Auto-Ticket: +503 7971-8911
            </button>

            <button
              onClick={handleGenerateAiExecutiveReport}
              disabled={generatingAi}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm transition disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${generatingAi ? 'animate-spin' : ''}`} />
              {generatingAi ? 'Analizando Tickets...' : 'Generar Dictamen IA'}
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'overview', label: '📊 Vista Ejecutiva (Todo)' },
              { id: 'waiting', label: `🚨 Esperando Solución (${waitingRecords.length})` },
              { id: 'recurring', label: `🔄 Problemas que se Repiten (${recurringClusters.filter(c => c.totalOccurrences >= 2).length})` },
              { id: 'clients', label: `🏢 Clientes Frecuentes (${clientSummaries.length})` },
              { id: 'techs', label: `👨‍💻 Tiempos por Técnico (${techSummaries.length})` },
              { id: 'whatsapp', label: '📲 Conexión WhatsApp (Evolution API)' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar cliente, error, técnico..."
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-52"
              />
            </div>

            <select
              value={selectedTechFilter}
              onChange={(e) => setSelectedTechFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
            >
              <option value="all">Todos los Técnicos</option>
              {techSummaries.map((t) => (
                <option key={t.techName} value={t.techName}>
                  {t.techName} ({t.totalAssigned})
                </option>
              ))}
            </select>

            <select
              value={dateRangeDays}
              onChange={(e) => setDateRangeDays(Number(e.target.value))}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
            >
              <option value={15}>Últimos 15 días</option>
              <option value={30}>Últimos 30 días</option>
              <option value={60}>Últimos 60 días</option>
              <option value={120}>Últimos 4 meses</option>
            </select>

            <button
              onClick={loadIntelligenceData}
              className="p-1.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              title="Refrescar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div
          onClick={() => setActiveTab('waiting')}
          className="bg-white rounded-2xl p-4 border border-rose-200/80 shadow-sm cursor-pointer hover:border-rose-400 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-600">
              Esperando Solución Hoy
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{waitingRecords.length}</span>
            <span className="text-xs font-semibold text-rose-600">
              {waitingRecords[0] ? `máx ${waitingRecords[0].waitingHours}h esperando` : '0 en cola'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Clientes con tickets abiertos sin cerrar
          </p>
        </div>

        <div
          onClick={() => setActiveTab('recurring')}
          className="bg-white rounded-2xl p-4 border border-amber-200/80 shadow-sm cursor-pointer hover:border-amber-400 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700">
              Incidencias Repetidas
            </span>
            <Repeat className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{totalRepeatOccurrences}</span>
            <span className="text-xs font-semibold text-amber-700">
              en {recurringClusters.filter((c) => c.totalOccurrences >= 2).length} patrones
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {sameClientRepeatTotal} reincidencias en el mismo cliente
          </p>
        </div>

        <div
          onClick={() => setActiveTab('clients')}
          className="bg-white rounded-2xl p-4 border border-indigo-200/80 shadow-sm cursor-pointer hover:border-indigo-400 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700">
              Cliente Más Frecuente
            </span>
            <Building2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2">
            <div className="text-base font-black text-slate-900 truncate">
              {clientSummaries[0]?.clientName || 'Sin registros'}
            </div>
            <div className="text-xs font-semibold text-indigo-600">
              {clientSummaries[0]
                ? `${clientSummaries[0].totalTickets} reportes · ${clientSummaries[0].totalHoursSpent}h`
                : '0 reportes'}
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Atiende: {clientSummaries[0]?.primaryTech || '—'}
          </p>
        </div>

        <div
          onClick={() => setActiveTab('techs')}
          className="bg-white rounded-2xl p-4 border border-emerald-200/80 shadow-sm cursor-pointer hover:border-emerald-400 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">
              Tiempo Prom. Solución
            </span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {techSummaries.length > 0
                ? `${(
                    techSummaries.reduce((s, t) => s + t.avgResolutionHours, 0) /
                    techSummaries.length
                  ).toFixed(1)}h`
                : '0h'}
            </span>
            <span className="text-xs font-semibold text-emerald-700">
              {filteredRecords.filter((r) => r.status === 'resolved').length} resueltos
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Total invertido:{' '}
            {filteredRecords.reduce((s, r) => s + (r.hoursSpent || 0), 0).toFixed(1)} hrs
          </p>
        </div>

        <div
          onClick={() => setActiveTab('whatsapp')}
          className="bg-white rounded-2xl p-4 border border-teal-200/80 shadow-sm cursor-pointer hover:border-teal-400 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-teal-700">
              Puente WhatsApp API
            </span>
            <Phone className="w-4 h-4 text-teal-600" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
              Instancia: {evolutionInstance}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5 truncate">
            {supportPhone ? `Soporte: ${supportPhone}` : 'Configurar número y webhook →'}
          </p>
        </div>
      </div>

      {/* Live AI Executive Dictamen Box */}
      {aiExecutiveSummary && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-md border border-indigo-500/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-300">
                Dictamen Ejecutivo de Ingeniería & Soporte (IA)
              </span>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(aiExecutiveSummary);
                toast.success('Dictamen copiado al portapapeles');
              }}
              className="text-xs text-indigo-200 hover:text-white inline-flex items-center gap-1"
            >
              <Copy className="w-3.5 h-3.5" /> Copiar
            </button>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-xs md:text-sm text-slate-100 leading-relaxed">
            {aiExecutiveSummary}
          </pre>
        </div>
      )}

      {/* SECTION 1: CLIENTES ESPERANDO SOLUCIÓN AHORA MISMO */}
      {(activeTab === 'overview' || activeTab === 'waiting') && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-rose-50/40">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm md:text-base font-black text-slate-900">
                  1. Clientes Esperando Solución Ahora Mismo ({waitingRecords.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Solicitudes abiertas o en curso que aún no han sido cerradas por el equipo técnico.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/support/tickets')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
            >
              Ir al Tablero de Tickets <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {waitingRecords.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-800">
                ¡Excelente! No hay clientes esperando en cola en este momento.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Todos los tickets registrados en este filtro aparecen como resueltos o cerrados.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-extrabold uppercase text-slate-400 bg-slate-50/50">
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Problema / Error Reportado</th>
                    <th className="py-3 px-4">Categoría IA</th>
                    <th className="py-3 px-4">Quién lo Atiende</th>
                    <th className="py-3 px-4">Tiempo Esperando</th>
                    <th className="py-3 px-4">Prioridad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {waitingRecords.slice(0, activeTab === 'waiting' ? 100 : 8).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{item.clientName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 max-w-md">
                        <div className="font-semibold text-slate-800">{item.title}</div>
                        {item.description && (
                          <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                            {item.description}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-[11px]">
                          {item.subPatternLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">{item.techName}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            item.waitingHours >= 24
                              ? 'bg-rose-100 text-rose-700'
                              : item.waitingHours >= 6
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-50 text-blue-700'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          {item.waitingHours >= 24
                            ? `${(item.waitingHours / 24).toFixed(1)} días (${item.waitingHours}h)`
                            : `${item.waitingHours} hrs`}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            item.priority === 'urgent'
                              ? 'bg-rose-600 text-white'
                              : item.priority === 'high'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.priority}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: PROBLEMAS Y ERRORES QUE SE REPITEN (PARCHE VS SOLUCIÓN DE RAÍZ) */}
      {(activeTab === 'overview' || activeTab === 'recurring') && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-amber-50/40">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <Repeat className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm md:text-base font-black text-slate-900">
                  2. Detector IA de Problemas que se Repiten (Mismo Cliente vs. Varios Clientes)
                </h2>
                <p className="text-xs text-slate-500">
                  Identifica si las soluciones de Melvin o Gerson fueron definitivas o si el mismo problema volvió a aparecer.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {recurringClusters.map((cluster) => (
              <div
                key={cluster.key}
                className={`rounded-2xl border p-4 transition ${
                  cluster.sameClientRepeats.length > 0
                    ? 'border-amber-300 bg-amber-50/20'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">
                      {cluster.categoryLabel}
                    </span>
                    <h3 className="text-sm font-black text-slate-900 mt-0.5">
                      {cluster.subPatternLabel}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-slate-900 text-white">
                      {cluster.totalOccurrences} veces
                    </span>
                  </div>
                </div>

                {/* Badges showing Same-Client Reincidence vs Multi-Client */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {cluster.sameClientRepeats.length > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Reincidencia en Mismo Cliente:{' '}
                      {cluster.sameClientRepeats
                        .slice(0, 3)
                        .map((r) => `${r.clientName} (${r.count}x)`)
                        .join(', ')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Sin reincidencia repetida en un mismo cliente
                    </span>
                  )}

                  {cluster.uniqueClients.length > 1 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-100 text-amber-800">
                      Afecta a {cluster.uniqueClients.length} clientes distintos
                    </span>
                  )}
                </div>

                {/* Metrics row */}
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">
                      Atendido por
                    </span>
                    <span className="font-bold text-slate-800">
                      {cluster.techsInvolved.join(', ') || 'Equipo'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">
                      Tiempo Invertido
                    </span>
                    <span className="font-bold text-slate-800">
                      {cluster.totalHours}h total (prom {cluster.avgResolutionHours}h)
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">
                      Estado
                    </span>
                    <span className="font-bold text-slate-800">
                      {cluster.resolvedCount} resueltos ·{' '}
                      <span className={cluster.openCount > 0 ? 'text-rose-600' : ''}>
                        {cluster.openCount} abiertos
                      </span>
                    </span>
                  </div>
                </div>

                {/* Root cause AI box */}
                <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px] text-slate-600">
                  <strong className="text-slate-800">💡 Diagnóstico IA de Causa Raíz:</strong>{' '}
                  {cluster.rootCauseDiagnosis}
                </div>

                {/* Recent examples */}
                <div className="mt-3 space-y-1">
                  <div className="text-[10px] font-bold uppercase text-slate-400">
                    Últimos reportes de este patrón:
                  </div>
                  {cluster.records.slice(0, 3).map((rec) => (
                    <div
                      key={rec.id}
                      className="flex items-center justify-between text-[11px] bg-white px-2.5 py-1.5 rounded-lg border border-slate-100"
                    >
                      <span className="truncate max-w-[65%] text-slate-700">
                        <strong className="text-slate-900">{rec.clientName}:</strong> {rec.title}
                      </span>
                      <span className="text-slate-400 shrink-0 ml-2">
                        {rec.techName.split(' ')[0]} · {rec.hoursSpent}h
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 3 & 4: CLIENTES MÁS FRECUENTES + RENDIMIENTO DE TÉCNICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top Clients Table */}
        {(activeTab === 'overview' || activeTab === 'clients') && (
          <div
            className={`${
              activeTab === 'clients' ? 'lg:col-span-12' : 'lg:col-span-7'
            } bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden`}
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm md:text-base font-black text-slate-900">
                    3. Clientes que Vienen Más Frecuente y Quién los Atiende
                  </h2>
                  <p className="text-xs text-slate-500">
                    Frecuencia de reportes por cliente, problemas repetidos y tiempo de atención.
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-extrabold uppercase text-slate-400 bg-slate-50/50">
                    <th className="py-3 px-4">Cliente / Proyecto</th>
                    <th className="py-3 px-4">Veces que Reportó</th>
                    <th className="py-3 px-4">Problema Principal</th>
                    <th className="py-3 px-4">Quién lo Atiende</th>
                    <th className="py-3 px-4">Tiempo Solución</th>
                    <th className="py-3 px-4">Estado Hoy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {clientSummaries
                    .slice(0, activeTab === 'clients' ? 50 : 10)
                    .map((client) => (
                      <tr key={client.clientName} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {client.clientName}
                          {client.repeatedIssuesCount >= 2 && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              🔄 {client.repeatedIssuesCount} repetidos
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-1 rounded-lg font-black bg-indigo-50 text-indigo-700">
                            {client.totalTickets} veces
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium">
                          {client.topCategory}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800">{client.primaryTech}</div>
                          {client.techBreakdown.length > 1 && (
                            <div className="text-[10px] text-slate-400">
                              {client.techBreakdown
                                .map((tb) => `${tb.techName.split(' ')[0]} (${tb.count})`)
                                .join(', ')}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800">
                            Prom: {client.avgResolutionHours}h
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Total: {client.totalHoursSpent} hrs
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {client.openTickets > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700">
                              ⏳ {client.openTickets} esperando
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700">
                              ✓ Al día
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

        {/* Technician Performance Table (Melvin, Gerson, etc.) */}
        {(activeTab === 'overview' || activeTab === 'techs') && (
          <div
            className={`${
              activeTab === 'techs' ? 'lg:col-span-12' : 'lg:col-span-5'
            } bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden`}
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm md:text-base font-black text-slate-900">
                    4. Tiempos y Efectividad por Técnico
                  </h2>
                  <p className="text-xs text-slate-500">
                    Cuánto demora cada miembro en solucionar y si los casos reinciden.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {techSummaries.map((tech) => (
                <div
                  key={tech.techName}
                  className="p-3.5 rounded-2xl border border-slate-200/80 hover:border-indigo-200 transition bg-slate-50/40"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-slate-900 text-white font-black text-xs flex items-center justify-center">
                        {tech.techName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900">{tech.techName}</h3>
                        <p className="text-[11px] text-slate-500">
                          {tech.totalAssigned} casos atendidos · {tech.totalHoursLogged}h registradas
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-100">
                        ⏱ Prom: {tech.avgResolutionHours} hrs/caso
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-slate-200/60 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        Resueltos
                      </span>
                      <span className="font-bold text-emerald-700">{tech.resolvedCount} casos</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        En Espera Hoy
                      </span>
                      <span
                        className={`font-bold ${
                          tech.waitingCount > 0 ? 'text-rose-600' : 'text-slate-600'
                        }`}
                      >
                        {tech.waitingCount} pendientes
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        Reincidencia
                      </span>
                      <span
                        className={`font-bold ${
                          tech.repeatRatePct > 20 ? 'text-amber-700' : 'text-slate-700'
                        }`}
                      >
                        {tech.reopenedOrRepeatedCount} ({tech.repeatRatePct}%)
                      </span>
                    </div>
                  </div>

                  {tech.topClientsServed.length > 0 && (
                    <div className="mt-2.5 text-[11px] text-slate-500">
                      <strong className="text-slate-700">Clientes frecuentes:</strong>{' '}
                      {tech.topClientsServed.join(' · ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 5: WHATSAPP EVOLUTION API CONFIGURATION PANEL */}
      {(activeTab === 'overview' || activeTab === 'whatsapp') && (
        <div className="bg-white rounded-2xl border border-teal-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-teal-100 bg-teal-50/40 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm md:text-base font-black text-slate-900">
                  5. Puente Automático WhatsApp → CRM (Evolution API · Instancia `{evolutionInstance}`)
                </h2>
                <p className="text-xs text-slate-600">
                  Modo Escucha Pasiva (100% seguro): NO desconecta el celular de soporte ni interrumpe a los clientes que están escribiendo.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              🔒 Cero desconexión de WhatsApp
            </span>
          </div>

          <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Número de WhatsApp de Soporte
                  </label>
                  <input
                    type="text"
                    value={supportPhone}
                    onChange={(e) => setSupportPhone(e.target.value)}
                    placeholder="Ej: +503 7000-0000"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Instancia Evolution API
                  </label>
                  <input
                    type="text"
                    value={evolutionInstance}
                    onChange={(e) => setEvolutionInstance(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    URL Servidor Evolution
                  </label>
                  <input
                    type="text"
                    value={evolutionUrl}
                    onChange={(e) => setEvolutionUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    API Key Evolution
                  </label>
                  <input
                    type="password"
                    value={evolutionApiKey}
                    onChange={(e) => setEvolutionApiKey(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-700"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveWhatsAppConfig}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition"
                >
                  Guardar Número y Credenciales
                </button>
                <button
                  onClick={() => setShowWaModal(true)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                >
                  Probar Captura de Mensaje con IA
                </button>
              </div>
            </div>

            <div className="lg:col-span-6 bg-slate-900 text-slate-100 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-400">
                  🔗 URL del Webhook para pegar en Evolution API (`{evolutionInstance}`)
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(webhookEndpoint);
                    toast.success('URL del Webhook copiada');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-white inline-flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> Copiar URL
                </button>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 font-mono text-[11px] text-teal-300 break-all border border-slate-800">
                {webhookEndpoint}
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                <strong>¿Qué hace este Webhook?</strong> Cada vez que un cliente escribe en WhatsApp (o en un grupo donde esté el número), Evolution API envía una copia del mensaje a esta URL y el CRM crea o actualiza el ticket automáticamente sin desconectar el teléfono.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PEGAR CONVERSACIÓN DE WHATSAPP CON IA */}
      {showWaModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Convertir Mensaje de WhatsApp en Ticket (IA)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pega el texto del cliente; la IA detecta la falla, el cliente y lo suma a las métricas.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowWaModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mensaje o Chat de WhatsApp del Cliente *
                </label>
                <textarea
                  rows={4}
                  value={waRawText}
                  onChange={(e) => setWaRawText(e.target.value)}
                  placeholder="Ej: Hola Melvin, nos está dando error el firmador de Hacienda al emitir crédito fiscal en Argos..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Cliente (Opcional, IA lo detecta)
                  </label>
                  <input
                    type="text"
                    value={waClientName}
                    onChange={(e) => setWaClientName(e.target.value)}
                    placeholder="Ej: Argos / Cartopaq"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Asignar a Técnico
                  </label>
                  <select
                    value={waAssignedTech}
                    onChange={(e) => setWaAssignedTech(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                  >
                    <option value="">Auto / Sin asignar</option>
                    {teamProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name || p.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Prioridad
                  </label>
                  <select
                    value={waPriority}
                    onChange={(e) => setWaPriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                  >
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="urgent">🚨 Urgente</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowWaModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateTicketFromWhatsApp}
                disabled={creatingWaTicket}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
              >
                {creatingWaTicket ? 'Clasificando y Guardando...' : 'Crear Ticket con IA'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

