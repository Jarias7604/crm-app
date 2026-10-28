import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Zap, Clock, Flame, AlertTriangle, ShieldAlert, 
    ArrowRight, DollarSign, Users, HelpCircle, 
    CheckCircle2, PhoneCall, Sparkles, Timer, History,
    BarChart3, Layers, Globe, Calendar, Filter
} from 'lucide-react';
import { supabase } from '../../services/supabase';

interface OperationalSpeedControlProps {
    companyId: string;
    startDate?: string;
    endDate?: string;
    assignedTo?: string | string[];
    canViewFinancials: boolean;
    uncontactedLeads: any[];
    averageTicket?: number;
    isLoading?: boolean;
}

/** InfoTip reusable para tooltips explicativos ejecutivos */
const InfoTip = ({ text }: { text: string }) => (
    <div className="relative group/tip inline-flex items-center" onClick={(e) => e.stopPropagation()}>
        <HelpCircle className="w-3 h-3 text-slate-300 hover:text-indigo-500 cursor-help transition-colors shrink-0" />
        <div className="pointer-events-none absolute z-[9999] w-64 bg-slate-900 text-white rounded-xl p-3 text-[10px] font-medium leading-relaxed shadow-2xl opacity-0 group-hover/tip:opacity-100 transition-opacity duration-200 bottom-full left-1/2 -translate-x-1/2 mb-2">
            {text}
            <div className="absolute w-2 h-2 bg-slate-900 rotate-45 -bottom-1 left-1/2 -translate-x-1/2" />
        </div>
    </div>
);

export function OperationalSpeedControl({
    companyId,
    startDate,
    endDate,
    assignedTo,
    canViewFinancials,
    uncontactedLeads = [],
    averageTicket = 0,
    isLoading = false
}: OperationalSpeedControlProps) {
    const navigate = useNavigate();

    // ── Alcance temporal: 'all_time' (Histórico integral completo) vs 'period' (Filtro del Dashboard) ──
    const [timeScope, setTimeScope] = useState<'all_time' | 'period'>('all_time');

    // ── Modo de visualización: 'all' (Integral Retroactivo) vs 'queue' (Cola Pendiente) vs 'attended' (Solo Atendidos) ──
    const [viewMode, setViewMode] = useState<'all' | 'queue' | 'attended'>('all');

    // ── Datos Reales de la Base de Datos ───────────────────────────────────────
    const [rawLeads, setRawLeads] = useState<any[]>([]);
    const [followUpMap, setFollowUpMap] = useState<Map<string, number>>(new Map());
    const [isLoadingData, setIsLoadingData] = useState(false);

    // ── Respetar modo simulación multi-inquilino ─────────────────────────────
    const effectiveCompanyId = (typeof window !== 'undefined' ? localStorage.getItem('simulated_company_id') : null) || companyId;

    useEffect(() => {
        if (!effectiveCompanyId) return;

        let isMounted = true;
        setIsLoadingData(true);

        const fetchOperationalData = async () => {
            try {
                // 1. Consultar prospectos con columnas 100% estándar de la base de datos
                // 🛑 EXCLUIR CLIENTES: Los clientes ya cumplieron su objetivo comercial, no son prospectos en seguimiento
                let qLeads = supabase
                    .from('leads')
                    .select('id, name, company_name, created_at, last_follow_up_at, status, value, priority, contact_count, assigned_to')
                    .eq('company_id', effectiveCompanyId)
                    .neq('status', 'Cliente');

                // Aplicar rango de fechas solo si el usuario seleccionó 'period'
                if (timeScope === 'period') {
                    if (startDate) qLeads = qLeads.gte('created_at', startDate);
                    if (endDate) qLeads = qLeads.lte('created_at', endDate);
                }

                if (assignedTo) {
                    if (Array.isArray(assignedTo)) qLeads = qLeads.in('assigned_to', assignedTo);
                    else qLeads = qLeads.eq('assigned_to', assignedTo);
                }

                // 2. Consultar primer contacto real en seguimiento y llamadas
                let qFollowUps = supabase
                    .from('follow_ups')
                    .select('lead_id, created_at')
                    .eq('company_id', effectiveCompanyId)
                    .order('created_at', { ascending: true });

                let qCalls = supabase
                    .from('call_activities')
                    .select('lead_id, created_at')
                    .eq('company_id', effectiveCompanyId)
                    .order('created_at', { ascending: true });

                const [leadsRes, fuRes, callsRes] = await Promise.all([qLeads, qFollowUps, qCalls]);

                if (!isMounted) return;

                if (leadsRes.error) {
                    console.warn('[OperationalSpeedControl] leads query error:', leadsRes.error);
                }

                const leadsData = (leadsRes.data || []).filter(l => l.status !== 'Cliente');
                setRawLeads(leadsData);

                // Mapear timestamp exacto del primer contacto registrado por cada lead
                const fMap = new Map<string, number>();

                (fuRes.data || []).forEach(f => {
                    if (!f.lead_id || !f.created_at) return;
                    const t = new Date(f.created_at).getTime();
                    const current = fMap.get(f.lead_id);
                    if (!current || t < current) fMap.set(f.lead_id, t);
                });

                (callsRes.data || []).forEach(c => {
                    if (!c.lead_id || !c.created_at) return;
                    const t = new Date(c.created_at).getTime();
                    const current = fMap.get(c.lead_id);
                    if (!current || t < current) fMap.set(c.lead_id, t);
                });

                setFollowUpMap(fMap);
            } catch (err) {
                console.error('[OperationalSpeedControl] error fetching data:', err);
            } finally {
                if (isMounted) setIsLoadingData(false);
            }
        };

        fetchOperationalData();
        return () => { isMounted = false; };
    }, [effectiveCompanyId, startDate, endDate, assignedTo, timeScope]);

    // ── Formateador de Duración en Minutos/Horas/Días ───────────────────────────
    const formatDuration = (mins: number | null) => {
        if (mins === null || isNaN(mins)) return '0 min';
        if (mins <= 0) return '< 1 min';
        if (mins < 60) return `${mins} min`;
        if (mins < 1440) return `${(mins / 60).toFixed(1)} h`;
        const days = (mins / 1440).toFixed(1);
        return `${days} días`;
    };

    // ── Conjunto de Prospectos Efectivos (Combina base de datos + prospectos de cola) ──
    // Excluye estrictamente a clientes ya convertidos
    const effectiveLeads = useMemo(() => {
        const map = new Map<string, any>();
        rawLeads.forEach(l => { 
            if (l?.id && l.status !== 'Cliente') map.set(l.id, l); 
        });
        uncontactedLeads.forEach(l => { 
            if (l?.id && l.status !== 'Cliente' && !map.has(l.id)) map.set(l.id, l); 
        });
        return Array.from(map.values());
    }, [rawLeads, uncontactedLeads]);

    // ── Motor Analítico Retroactivo: Evalúa el 100% de los Prospectos ─────────
    const analysis = useMemo(() => {
        const now = Date.now();

        // Estructuras de clasificación
        interface AnalyzedLead {
            lead: any;
            type: 'contacted' | 'pending';
            elapsedMinutes: number;
            withinSla: boolean;
        }

        const allAnalyzed: AnalyzedLead[] = [];
        const attendedOnly: AnalyzedLead[] = [];
        const pendingOnly: AnalyzedLead[] = [];

        effectiveLeads.forEach(lead => {
            const baseTime = new Date(lead.assigned_at || lead.created_at).getTime();
            const fuTime = followUpMap.get(lead.id);
            const firstContactIso = lead.first_follow_up_at || (fuTime ? new Date(fuTime).toISOString() : null) || lead.last_follow_up_at || lead.internal_won_date;
            const hasContacts = (lead.contact_count && lead.contact_count > 0) || fuTime !== undefined || !!lead.first_follow_up_at;
            const isTerminal = lead.status === 'Cliente' || lead.status === 'Cerrado' || lead.status === 'Perdido' || lead.status === 'Erróneo';
            const movedPastProspect = lead.status !== 'Prospecto' && lead.status !== 'Erróneo';

            if (firstContactIso || hasContacts || movedPastProspect) {
                // Lead atendido históricamente
                const contactTime = firstContactIso ? new Date(firstContactIso).getTime() : (fuTime || (baseTime + (25 * 60000)));
                const elapsedMinutes = Math.max(1, Math.round((contactTime - baseTime) / 60000));
                const item: AnalyzedLead = {
                    lead,
                    type: 'contacted',
                    elapsedMinutes,
                    withinSla: elapsedMinutes <= 15
                };
                allAnalyzed.push(item);
                attendedOnly.push(item);
            } else if (!isTerminal) {
                // Solo prospectos ACTIVOS abiertos en espera (NUNCA cerrados, perdidos ni clientes)
                const elapsedMinutes = Math.max(1, Math.round((now - baseTime) / 60000));
                const item: AnalyzedLead = {
                    lead,
                    type: 'pending',
                    elapsedMinutes,
                    withinSla: elapsedMinutes <= 15 // si fue creado hace menos de 15m sigue dentro de ventana
                };
                allAnalyzed.push(item);
                pendingOnly.push(item);
            }
        });

        // Seleccionar conjunto según viewMode
        let activeDataset = allAnalyzed;
        if (viewMode === 'queue') activeDataset = pendingOnly;
        if (viewMode === 'attended') activeDataset = attendedOnly;

        // Distribución en los 4 Tramos del Radar de Envejecimiento
        const fresh: AnalyzedLead[] = [];      // < 15 min (Ventana Óptima / Meta SLA)
        const warm: AnalyzedLead[] = [];       // 15m - 2h (Atención en Turno)
        const atRisk: AnalyzedLead[] = [];     // 2h - 12h (Atención Tardía / En Riesgo)
        const critical: AnalyzedLead[] = [];   // > 12h o > 24h (Demora Crítica / Abandono)

        let totalMinutes = 0;
        let withinSlaCount = 0;

        activeDataset.forEach(item => {
            totalMinutes += item.elapsedMinutes;
            if (item.withinSla) withinSlaCount++;

            if (item.elapsedMinutes <= 15) {
                fresh.push(item);
            } else if (item.elapsedMinutes <= 120) {
                warm.push(item);
            } else if (item.elapsedMinutes <= 720) {
                atRisk.push(item);
            } else {
                critical.push(item);
            }
        });

        const totalCount = activeDataset.length;
        const avgMinutes = totalCount > 0 ? Math.round(totalMinutes / totalCount) : 0;
        const slaComplianceRate = totalCount > 0 ? Math.round((withinSlaCount / totalCount) * 100) : 0;
        const exceededSlaCount = totalCount - withinSlaCount;

        // Prospectos en riesgo financiero: ÚNICAMENTE prospectos activos (no cerrados, no clientes, no descartados)
        const highRiskItems = [...atRisk, ...critical].filter(item => 
            item.lead.status !== 'Cliente' && 
            item.lead.status !== 'Cerrado' && 
            item.lead.status !== 'Perdido' && 
            item.lead.status !== 'Erróneo'
        );
        const highRiskLeads = highRiskItems.map(i => i.lead);

        return {
            totalCount,
            totalAttended: attendedOnly.length,
            totalPending: pendingOnly.length,
            avgMinutes,
            withinSlaCount,
            exceededSlaCount,
            slaComplianceRate,
            fresh: { items: fresh, count: fresh.length, pct: totalCount > 0 ? Math.round((fresh.length / totalCount) * 100) : 0 },
            warm: { items: warm, count: warm.length, pct: totalCount > 0 ? Math.round((warm.length / totalCount) * 100) : 0 },
            atRisk: { items: atRisk, count: atRisk.length, pct: totalCount > 0 ? Math.round((atRisk.length / totalCount) * 100) : 0 },
            critical: { items: critical, count: critical.length, pct: totalCount > 0 ? Math.round((critical.length / totalCount) * 100) : 0 },
            highRiskLeads,
            allAnalyzedCount: allAnalyzed.length
        };
    }, [effectiveLeads, followUpMap, viewMode]);

    // ── 3. Métricas Financieras y Capital en Riesgo (CFO / CEO) ────────────────
    const financialStats = useMemo(() => {
        // 🔒 CAPITAL EN RIESGO: Únicamente prospectos ACTIVOS que no se han cerrado ni descartado
        const leadsInRisk = analysis.highRiskLeads.filter(lead => 
            lead.status !== 'Cliente' && 
            lead.status !== 'Cerrado' && 
            lead.status !== 'Perdido' && 
            lead.status !== 'Erróneo'
        );

        // Pipeline real configurado explícitamente en BD
        const realPipelineInRisk = leadsInRisk.reduce((acc, lead) => acc + (Number(lead.value) || 0), 0);

        // Potencial financiero calculado con el ticket promedio real de la empresa
        const effectiveTicket = averageTicket > 0 ? averageTicket : 250;
        const potentialRevenueAtRisk = leadsInRisk.length * effectiveTicket;

        // Pauta publicitaria CAC en riesgo (~$15 por lead)
        const adSpendAtRisk = leadsInRisk.length * 15;

        // Prospectos de mayor urgencia (SOLO ACTIVOS)
        const topTargets = [...leadsInRisk].sort((a, b) => {
            const valDiff = (Number(b.value) || 0) - (Number(a.value) || 0);
            if (valDiff !== 0) return valDiff;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }).slice(0, 2);

        return {
            leadsInRiskCount: leadsInRisk.length,
            leadsInRiskIds: leadsInRisk.map(l => l.id),
            realPipelineInRisk,
            potentialRevenueAtRisk,
            adSpendAtRisk,
            topTargets,
            effectiveTicket
        };
    }, [analysis, averageTicket]);

    // ── Navegación con Filtro Directo a Leads.tsx ──────────────────────────────
    const handleNavigateWithLeads = (leadIds: string[]) => {
        if (leadIds.length === 0) return;
        navigate('/leads', {
            state: {
                assignedFilter: assignedTo || 'all',
                leadIds: leadIds,
                pipelineView: 'all'
            }
        });
    };

    return (
        <div className="lg:col-span-12 relative z-0">
            {/* Header del bloque ejecutivo con selectores Retroactivos */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-3 px-1">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">
                        Control de Velocidad & Eficiencia de Contacto
                    </span>
                    <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                        <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                        {timeScope === 'all_time' ? 'Histórico Integral Completo' : 'Período Filtrado'} · {analysis.allAnalyzedCount} Leads
                    </span>
                </div>

                {/* Controles de Vista y Alcance */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Selector de Alcance Temporal (All-Time vs Período) */}
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 shadow-inner">
                        <button
                            onClick={() => setTimeScope('all_time')}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                                timeScope === 'all_time'
                                    ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                            title="Analiza la velocidad retroactiva de todos los prospectos registrados en la historia del CRM"
                        >
                            <Globe className="w-3 h-3 text-indigo-600" />
                            <span>Todo el Histórico</span>
                        </button>
                        <button
                            onClick={() => setTimeScope('period')}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                                timeScope === 'period'
                                    ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                            title="Limita el análisis a los prospectos del rango de fechas seleccionado en el Dashboard"
                        >
                            <Calendar className="w-3 h-3 text-slate-600" />
                            <span>Período Actual</span>
                        </button>
                    </div>

                    {/* Selector de Modo de Análisis (Integral vs Cola vs Atendidos) */}
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 shadow-inner">
                        <button
                            onClick={() => setViewMode('all')}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                                viewMode === 'all'
                                    ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                            title="Diagnóstico integral de todos los prospectos recibidos (tanto atendidos como pendientes en cola)"
                        >
                            <History className="w-3 h-3 text-indigo-600" />
                            <span>Integral Retroactivo</span>
                            <span className="bg-indigo-100/70 text-indigo-800 px-1 py-0.2 rounded text-[8px] font-black ml-0.5">
                                {analysis.allAnalyzedCount}
                            </span>
                        </button>

                        <button
                            onClick={() => setViewMode('queue')}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                                viewMode === 'queue'
                                    ? 'bg-white text-rose-700 shadow-sm border border-slate-200/60'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                            title="Monitorea solo los prospectos que aún no han recibido ningún contacto"
                        >
                            <Timer className="w-3 h-3 text-rose-600" />
                            <span>Cola Pendiente</span>
                            <span className="bg-rose-100 text-rose-800 px-1 py-0.2 rounded text-[8px] font-black ml-0.5">
                                {analysis.totalPending}
                            </span>
                        </button>

                        <button
                            onClick={() => setViewMode('attended')}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                                viewMode === 'attended'
                                    ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/60'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                            title="Monitorea exclusivamente la velocidad de respuesta de los prospectos que ya fueron contactados"
                        >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Solo Atendidos</span>
                            <span className="bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded text-[8px] font-black ml-0.5">
                                {analysis.totalAttended}
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Grid de las 3 Tarjetas de Control */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

                {/* ── TARJETA 1: Speed-to-Lead & Cumplimiento SLA ── */}
                <div className="bg-white p-5 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/70 flex flex-col justify-between group hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] transition-all duration-500 relative">
                    <div>
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
                                    <Zap className="w-4 h-4 fill-white" />
                                </div>
                                <div>
                                    <h3 className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                                        Speed-to-Lead (SLA)
                                        <InfoTip text="Mide el tiempo real entre la llegada del prospecto al CRM y su primer contacto. Evalúa de forma retroactiva el cumplimiento de la meta de contacto en menos de 15 minutos." />
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-medium">
                                        {viewMode === 'all' 
                                            ? 'Demora / Respuesta sobre todo el flujo' 
                                            : viewMode === 'queue' 
                                                ? 'Tiempo de espera en cola activa' 
                                                : 'Velocidad histórica de asesores'}
                                    </p>
                                </div>
                            </div>
                            <span className="bg-indigo-50 text-indigo-600 border border-indigo-100/80 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
                                Meta &lt; 15m
                            </span>
                        </div>

                        {/* Métrica Principal */}
                        <div className="mt-2 mb-4">
                            {analysis.totalCount > 0 ? (
                                <>
                                    <div className="flex items-baseline gap-2">
                                        <span className={`text-3xl xl:text-4xl font-black tracking-tight ${
                                            analysis.slaComplianceRate >= 70 ? 'text-slate-900' : analysis.slaComplianceRate >= 30 ? 'text-amber-600' : 'text-rose-600'
                                        }`}>
                                            {formatDuration(analysis.avgMinutes)}
                                        </span>
                                        <span className="text-[11px] font-bold text-slate-400">
                                            {viewMode === 'attended' ? 'respuesta promedio' : 'demora / espera prom.'}
                                        </span>
                                    </div>

                                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                        {analysis.avgMinutes <= 15 ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-lg">
                                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                Velocidad Óptima (&lt; 15m)
                                            </span>
                                        ) : analysis.avgMinutes <= 120 ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-lg">
                                                <Timer className="w-3 h-3 text-amber-600" />
                                                Atención en Turno (&lt; 2h)
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-700 bg-rose-50 border border-rose-200/60 px-2 py-0.5 rounded-lg">
                                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                                Demora Crítica (&gt; 2h)
                                            </span>
                                        )}

                                        <span className="text-[9px] font-bold text-slate-400">
                                            ({analysis.totalCount} leads analizados)
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <div className="py-2">
                                    <p className="text-base font-black text-slate-500">Sin datos en este filtro</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Selecciona "Todo el Histórico" para ver la trayectoria global.</p>
                                </div>
                            )}
                        </div>

                        {/* Cumplimiento SLA Barra */}
                        <div className="space-y-1.5 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
                                <span className="text-slate-500">
                                    Cumplimiento SLA (&lt; 15m)
                                </span>
                                <span className={
                                    analysis.slaComplianceRate >= 70 
                                        ? 'text-emerald-600 font-black' 
                                        : analysis.slaComplianceRate >= 30 
                                            ? 'text-amber-600 font-black' 
                                            : 'text-rose-600 font-black'
                                }>
                                    {analysis.slaComplianceRate}% a tiempo
                                </span>
                            </div>

                            <div className="h-2 w-full bg-slate-200/70 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full rounded-full transition-all duration-1000 ${
                                        analysis.slaComplianceRate >= 70 ? 'bg-emerald-500' : analysis.slaComplianceRate >= 30 ? 'bg-amber-500' : 'bg-rose-500'
                                    }`}
                                    style={{ width: `${Math.max(5, analysis.slaComplianceRate)}%` }}
                                />
                            </div>

                            <p className="text-[9px] text-slate-400 font-medium">
                                {analysis.withinSlaCount} de {analysis.totalCount} prospectos contactados o atendidos dentro de los primeros 15 min.
                            </p>
                        </div>
                    </div>

                    {/* Footer con Alerta Viva */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        {analysis.exceededSlaCount > 0 ? (
                            <div 
                                onClick={() => handleNavigateWithLeads(financialStats.leadsInRiskIds)}
                                className="flex items-center gap-1.5 text-[10px] font-black text-rose-600 hover:text-rose-700 cursor-pointer group/link"
                            >
                                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                                <span>{analysis.exceededSlaCount} prospectos fuera de SLA</span>
                                <ArrowRight className="w-3 h-3 group-hover/link:translate-x-0.5 transition-transform" />
                            </div>
                        ) : (
                            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Flujo 100% al día en SLA
                            </span>
                        )}
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            Retroactivo
                        </span>
                    </div>
                </div>

                {/* ── TARJETA 2: Radar de Envejecimiento (Lead Aging Radar) ── */}
                <div className="bg-white p-5 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/70 flex flex-col justify-between group hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] transition-all duration-500 relative">
                    <div>
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-md shadow-amber-200">
                                    <Clock className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                                        Radar de Envejecimiento
                                        <InfoTip text="Clasifica todos los prospectos del CRM según el tiempo que tardaron en ser contactados o el tiempo que llevan esperando. Permite atacar inmediatamente cuellos de botella." />
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-medium">Distribución por tramo operativo</p>
                                </div>
                            </div>
                            <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
                                {analysis.totalCount} evaluados
                            </span>
                        </div>

                        {/* Lista de 4 Tramos con Clic Directo */}
                        <div className="space-y-2 mt-2">
                            {/* Nivel 1: < 15 min */}
                            <div 
                                onClick={() => handleNavigateWithLeads(analysis.fresh.items.map(i => i.lead.id))}
                                className="group/item flex items-center justify-between p-2 rounded-xl hover:bg-emerald-50/70 border border-transparent hover:border-emerald-100 transition-all cursor-pointer"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shrink-0" />
                                    <div className="truncate">
                                        <p className="text-[11px] font-black text-slate-800 group-hover/item:text-emerald-700 transition-colors leading-none">
                                            &lt; 15 min · Ventana Óptima 🔥
                                        </p>
                                        <p className="text-[9px] text-slate-400 font-medium mt-0.5">
                                            Atendidos o llegados en la ventana de oro
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-xs font-black text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                                        {analysis.fresh.count}
                                    </span>
                                    <ArrowRight className="w-3 h-3 text-slate-300 group-hover/item:text-emerald-500 transition-colors" />
                                </div>
                            </div>

                            {/* Nivel 2: 15m - 2h */}
                            <div 
                                onClick={() => handleNavigateWithLeads(analysis.warm.items.map(i => i.lead.id))}
                                className="group/item flex items-center justify-between p-2 rounded-xl hover:bg-amber-50/70 border border-transparent hover:border-amber-100 transition-all cursor-pointer"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shrink-0" />
                                    <div className="truncate">
                                        <p className="text-[11px] font-black text-slate-800 group-hover/item:text-amber-700 transition-colors leading-none">
                                            15m - 2h · Atención en Turno ⏳
                                        </p>
                                        <p className="text-[9px] text-slate-400 font-medium mt-0.5">
                                            Contactados o esperando en el mismo turno
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-xs font-black text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-md">
                                        {analysis.warm.count}
                                    </span>
                                    <ArrowRight className="w-3 h-3 text-slate-300 group-hover/item:text-amber-500 transition-colors" />
                                </div>
                            </div>

                            {/* Nivel 3: 2h - 12h */}
                            <div 
                                onClick={() => handleNavigateWithLeads(analysis.atRisk.items.map(i => i.lead.id))}
                                className="group/item flex items-center justify-between p-2 rounded-xl hover:bg-orange-50/70 border border-transparent hover:border-orange-100 transition-all cursor-pointer"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm shrink-0" />
                                    <div className="truncate">
                                        <p className="text-[11px] font-black text-slate-800 group-hover/item:text-orange-700 transition-colors leading-none">
                                            2h - 12h · Atención Tardía ⚠️
                                        </p>
                                        <p className="text-[9px] text-slate-400 font-medium mt-0.5">
                                            Demora superior a 2 horas (riesgo de fuga)
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-xs font-black text-orange-700 bg-orange-100/70 px-2 py-0.5 rounded-md">
                                        {analysis.atRisk.count}
                                    </span>
                                    <ArrowRight className="w-3 h-3 text-slate-300 group-hover/item:text-orange-500 transition-colors" />
                                </div>
                            </div>

                            {/* Nivel 4: > 12h / > 24h */}
                            <div 
                                onClick={() => handleNavigateWithLeads(analysis.critical.items.map(i => i.lead.id))}
                                className="group/item flex items-center justify-between p-2 rounded-xl hover:bg-rose-50/70 border border-transparent hover:border-rose-100 transition-all cursor-pointer"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-2.5 h-2.5 rounded-full bg-rose-600 shadow-sm shrink-0" />
                                    <div className="truncate">
                                        <p className="text-[11px] font-black text-slate-800 group-hover/item:text-rose-700 transition-colors leading-none">
                                            &gt; 24h · Demora Crítica 🚨
                                        </p>
                                        <p className="text-[9px] text-slate-400 font-medium mt-0.5">
                                            Leads con más de 1 día de espera o demora
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-xs font-black text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded-md">
                                        {analysis.critical.count}
                                    </span>
                                    <ArrowRight className="w-3 h-3 text-slate-300 group-hover/item:text-rose-500 transition-colors" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            {timeScope === 'all_time' ? 'Histórico Global' : 'Filtro Actual'}
                        </span>
                        <span className="text-[9px] font-extrabold text-indigo-600">
                            Filtro 1-Clic
                        </span>
                    </div>
                </div>

                {/* ── TARJETA 3: Capital en Riesgo & Fuga Comercial ── */}
                <div className="bg-white p-5 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/70 flex flex-col justify-between group hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] transition-all duration-500 relative">
                    <div>
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-white shadow-md shadow-rose-200">
                                    <ShieldAlert className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                                        Capital en Riesgo
                                        <InfoTip text="Impacto económico retroactivo de los prospectos que se demoraron en contactar o están sin atender. Calcula el pipeline comprometido según el valor del prospecto o el ticket promedio de ventas de la empresa." />
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-medium">Fuga financiera & CAC</p>
                                </div>
                            </div>
                            <span className="bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
                                CFO Radar
                            </span>
                        </div>

                        {/* Métricas Financieras Clave con Ticket Promedio Real */}
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            <div className="bg-rose-50/60 p-2.5 rounded-xl border border-rose-100/60">
                                <p className="text-[9px] font-black text-rose-700 uppercase tracking-wider mb-0.5">
                                    Pipeline en Peligro
                                </p>
                                <p className="text-xl font-black text-rose-700 font-mono">
                                    {canViewFinancials 
                                        ? (financialStats.realPipelineInRisk > 0 
                                            ? `$${financialStats.realPipelineInRisk.toLocaleString()}` 
                                            : financialStats.potentialRevenueAtRisk > 0 
                                                ? `~$${financialStats.potentialRevenueAtRisk.toLocaleString()}`
                                                : '$0')
                                        : '$ •••'}
                                </p>
                                <p className="text-[8px] text-slate-400 font-bold mt-0.5">
                                    {financialStats.realPipelineInRisk > 0
                                        ? `${financialStats.leadsInRiskCount} leads con valor activo`
                                        : financialStats.potentialRevenueAtRisk > 0
                                            ? `Est. ${financialStats.leadsInRiskCount} × $${financialStats.effectiveTicket} ticket prom.`
                                            : `${financialStats.leadsInRiskCount} leads evaluados`}
                                </p>
                            </div>

                            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                <p className="text-[9px] font-black text-slate-600 uppercase tracking-wider mb-0.5">
                                    Pauta en Riesgo
                                </p>
                                <p className="text-xl font-black text-slate-800 font-mono">
                                    {canViewFinancials 
                                        ? `~$${financialStats.adSpendAtRisk.toLocaleString()}` 
                                        : '$ •••'}
                                </p>
                                <p className="text-[8px] text-slate-400 font-bold mt-0.5">
                                    {financialStats.leadsInRiskCount} leads × ~$15 CAC
                                </p>
                            </div>
                        </div>

                        {/* Lista de Prospectos de Mayor Urgencia */}
                        {financialStats.topTargets.length > 0 && (
                            <div className="mt-3 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                        🚨 Mayor Urgencia de Contacto
                                    </span>
                                    <span className="text-[8px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                                        Acción Inmediata
                                    </span>
                                </div>
                                {financialStats.topTargets.map(lead => {
                                    const diffMins = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 60000);
                                    return (
                                        <div 
                                            key={lead.id}
                                            onClick={() => navigate('/leads', { state: { leadId: lead.id } })}
                                            className="bg-slate-50/80 border border-slate-200/60 p-2 rounded-xl flex items-center justify-between hover:bg-indigo-50/60 hover:border-indigo-200 transition-colors cursor-pointer group/lead"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-bold text-slate-800 truncate group-hover/lead:text-indigo-600 transition-colors">
                                                    {lead.name}
                                                </p>
                                                <p className="text-[9px] text-slate-400 truncate">
                                                    {lead.company_name || 'Sin empresa'} · Esperando hace <span className="font-extrabold text-rose-600">{formatDuration(diffMins)}</span>
                                                </p>
                                            </div>
                                            <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover/lead:text-indigo-600 group-hover/lead:translate-x-0.5 transition-transform shrink-0 ml-2" />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Botón de Acción Directa: Atacar Leads en Riesgo */}
                    <div className="mt-4 pt-3 border-t border-slate-100">
                        <button
                            onClick={() => handleNavigateWithLeads(
                                financialStats.leadsInRiskIds.length > 0 
                                    ? financialStats.leadsInRiskIds 
                                    : effectiveLeads.filter(l => l.status !== 'Cliente' && l.status !== 'Cerrado' && l.status !== 'Perdido' && l.status !== 'Erróneo').map(l => l.id)
                            )}
                            disabled={financialStats.leadsInRiskCount === 0}
                            className={`w-full py-2.5 text-white text-[10px] font-black rounded-xl transition-all shadow-md flex items-center justify-center gap-2 uppercase tracking-wider ${
                                financialStats.leadsInRiskCount > 0 
                                    ? 'bg-gradient-to-r from-rose-500 via-red-600 to-indigo-600 hover:opacity-95 shadow-rose-500/20 cursor-pointer' 
                                    : 'bg-slate-300 cursor-not-allowed opacity-60'
                            }`}
                        >
                            <PhoneCall className="w-3.5 h-3.5" />
                            <span>Atacar {financialStats.leadsInRiskCount > 0 ? `${financialStats.leadsInRiskCount} Leads en Riesgo` : 'Sin Leads en Riesgo'} Ahora</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
