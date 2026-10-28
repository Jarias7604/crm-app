import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Zap, Clock, Flame, AlertTriangle, ShieldAlert, 
    ArrowRight, DollarSign, Users, HelpCircle, 
    CheckCircle2, PhoneCall, Sparkles, Timer, History,
    BarChart3, Layers, Globe, Calendar, Filter,
    Package, Settings, Check, ChevronDown, X, Calculator,
    Info, BookOpen, ShieldCheck, Sliders, Target
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
    availableProducts?: { id: string; name: string; is_active?: boolean }[];
    selectedProductFilter?: string[];
    onProductFilterChange?: (products: string[]) => void;
}

/** InfoTip reusable con diseño ejecutivo y soporte de fórmulas y viñetas */
const InfoTip = ({ 
    title,
    text, 
    formula,
    bullets,
    position = 'top' 
}: { 
    title?: string;
    text: string; 
    formula?: string;
    bullets?: string[];
    position?: 'top' | 'bottom' | 'left' | 'right';
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const tipRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleOutside = (e: MouseEvent) => {
            if (tipRef.current && !tipRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [isOpen]);

    return (
        <div 
            ref={tipRef}
            className="relative inline-flex items-center" 
            onClick={(e) => {
                e.stopPropagation();
                setIsOpen(prev => !prev);
            }}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
        >
            <button
                type="button"
                className="w-4 h-4 rounded-full flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-help transition-all focus:outline-none"
                title="Ver explicación de la lógica de cálculo"
            >
                <HelpCircle className="w-3.5 h-3.5" />
            </button>

            {isOpen && (
                <div 
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute z-[9999] w-72 sm:w-80 bg-slate-900 text-white rounded-2xl p-3.5 text-[11px] leading-relaxed shadow-2xl border border-slate-700/80 animate-in fade-in zoom-in-95 duration-150 ${
                        position === 'bottom'
                            ? 'top-full left-1/2 -translate-x-1/2 mt-2'
                            : position === 'left'
                                ? 'right-full top-1/2 -translate-y-1/2 mr-2'
                                : position === 'right'
                                    ? 'left-full top-1/2 -translate-y-1/2 ml-2'
                                    : 'bottom-full left-1/2 -translate-x-1/2 mb-2'
                    }`}
                >
                    {title && (
                        <div className="flex items-center gap-1.5 font-black text-indigo-300 text-xs mb-1.5 pb-1 border-b border-slate-800">
                            <Calculator className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span>{title}</span>
                        </div>
                    )}
                    
                    <p className="text-slate-300 font-medium text-[10.5px] leading-normal">{text}</p>
                    
                    {formula && (
                        <div className="mt-2 p-2 rounded-xl bg-slate-800/90 border border-slate-700 font-mono text-[9.5px] text-amber-300 tracking-tight">
                            <span className="text-slate-400 text-[8px] uppercase tracking-wider block font-sans font-bold mb-0.5">📐 Fórmula:</span>
                            {formula}
                        </div>
                    )}

                    {bullets && bullets.length > 0 && (
                        <ul className="mt-2 space-y-1 text-[10px] text-slate-300 border-t border-slate-800/80 pt-1.5">
                            {bullets.map((b, idx) => (
                                <li key={idx} className="flex items-start gap-1.5">
                                    <span className="text-indigo-400 font-bold">•</span>
                                    <span>{b}</span>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className={`absolute w-2.5 h-2.5 bg-slate-900 border-slate-700/80 rotate-45 ${
                        position === 'bottom'
                            ? '-top-1.5 left-1/2 -translate-x-1/2 border-t border-l'
                            : position === 'left'
                                ? '-right-1.5 top-1/2 -translate-y-1/2 border-t border-r'
                                : position === 'right'
                                    ? '-left-1.5 top-1/2 -translate-y-1/2 border-b border-l'
                                    : '-bottom-1.5 left-1/2 -translate-x-1/2 border-b border-r'
                    }`} />
                </div>
            )}
        </div>
    );
};

export function OperationalSpeedControl({
    companyId,
    startDate,
    endDate,
    assignedTo,
    canViewFinancials,
    uncontactedLeads = [],
    averageTicket = 0,
    isLoading = false,
    availableProducts = [],
    selectedProductFilter: selectedProductFilterProp,
    onProductFilterChange
}: OperationalSpeedControlProps) {
    const navigate = useNavigate();

    // ── Meta KPI de Tiempo de Contacto (Default: 24 horas = 1440 min) ───────────
    const [slaTargetMinutes, setSlaTargetMinutes] = useState<number>(() => {
        try {
            const saved = localStorage.getItem('dashboard_sla_target_minutes');
            return saved ? parseInt(saved) : 1440; // 24 horas por defecto
        } catch {
            return 1440;
        }
    });

    const [isSlaTargetDropdownOpen, setIsSlaTargetDropdownOpen] = useState(false);

    const handleSlaTargetChange = (minutes: number) => {
        setSlaTargetMinutes(minutes);
        try {
            localStorage.setItem('dashboard_sla_target_minutes', minutes.toString());
        } catch (e) {}
        setIsSlaTargetDropdownOpen(false);
    };

    // ── Alcance temporal: 'all_time' (Histórico integral completo) vs 'period' (Filtro del Dashboard) ──
    const [timeScope, setTimeScope] = useState<'all_time' | 'period'>('all_time');

    // ── Modo de visualización: 'all' (Integral Retroactivo) vs 'queue' (Cola Pendiente) vs 'attended' (Solo Atendidos) ──
    const [viewMode, setViewMode] = useState<'all' | 'queue' | 'attended'>('all');

    // ── Estado del Filtro de Productos (Sincronizado con Dashboard y con LocalStorage) ──
    const [internalProductFilter, setInternalProductFilter] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('dashboard_uncontacted_product_filter');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    const effectiveProductFilter = selectedProductFilterProp !== undefined 
        ? selectedProductFilterProp 
        : internalProductFilter;

    const handleProductFilterToggle = (productId: string) => {
        let newFilter: string[];
        if (effectiveProductFilter.includes(productId)) {
            newFilter = effectiveProductFilter.filter(id => id !== productId);
        } else {
            newFilter = [...effectiveProductFilter, productId];
        }

        if (onProductFilterChange) {
            onProductFilterChange(newFilter);
        } else {
            setInternalProductFilter(newFilter);
        }

        try {
            localStorage.setItem('dashboard_uncontacted_product_filter', JSON.stringify(newFilter));
        } catch (e) {}
    };

    const handleProductFilterClear = () => {
        if (onProductFilterChange) {
            onProductFilterChange([]);
        } else {
            setInternalProductFilter([]);
        }
        try {
            localStorage.setItem('dashboard_uncontacted_product_filter', JSON.stringify([]));
        } catch (e) {}
    };

    // ── Dropdowns de Productos y Meta SLA ───────────────────────────────────────
    const [activeDropdown, setActiveDropdown] = useState<'header' | 'speed' | 'radar' | 'risk' | null>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;
            if (!target.closest('.product-dropdown-container')) {
                setActiveDropdown(null);
            }
            if (!target.closest('.sla-target-dropdown-container')) {
                setIsSlaTargetDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // ── Modal de Lógica y Fórmulas ────────────────────────────────────────────
    const [isLogicModalOpen, setIsLogicModalOpen] = useState(false);

    // ── Fallback de Productos cargados directamente desde la base de datos ──
    const [dbProducts, setDbProducts] = useState<{ id: string; name: string; is_active?: boolean }[]>([]);

    // ── Datos Reales de la Base de Datos ───────────────────────────────────────
    const [rawLeads, setRawLeads] = useState<any[]>([]);
    const [followUpMap, setFollowUpMap] = useState<Map<string, number>>(new Map());
    const [isLoadingData, setIsLoadingData] = useState(false);

    // ── Respetar modo simulación multi-inquilino ─────────────────────────────
    const effectiveCompanyId = (typeof window !== 'undefined' ? localStorage.getItem('simulated_company_id') : null) || companyId;

    // Cargar productos de la empresa si no fueron provistos como props
    useEffect(() => {
        if (!effectiveCompanyId) return;
        if (availableProducts && availableProducts.length > 0) return;

        supabase
            .from('lead_products')
            .select('id, name, is_active')
            .eq('company_id', effectiveCompanyId)
            .eq('is_active', true)
            .order('name', { ascending: true })
            .then(({ data }) => {
                if (data) setDbProducts(data);
            });
    }, [effectiveCompanyId, availableProducts]);

    const effectiveProducts = (availableProducts && availableProducts.length > 0) ? availableProducts : dbProducts;

    useEffect(() => {
        if (!effectiveCompanyId) return;

        let isMounted = true;
        setIsLoadingData(true);

        const fetchOperationalData = async () => {
            try {
                // 1. Consultar prospectos con columnas estándar de la base de datos
                // 🛑 EXCLUIR CLIENTES: Los clientes ya cumplieron su objetivo comercial, no son prospectos en seguimiento
                // 📦 INCLUIR interested_product_id para filtrar dinámicamente por tipo de producto
                let qLeads = supabase
                    .from('leads')
                    .select('id, name, company_name, created_at, last_follow_up_at, status, value, priority, contact_count, assigned_to, interested_product_id')
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

    // ── Conteo de Prospectos por Producto en este conjunto ───────────────────────
    const leadsCountByProduct = useMemo(() => {
        const counts: Record<string, number> = {};
        effectiveLeads.forEach(l => {
            const key = l.interested_product_id || 'none';
            counts[key] = (counts[key] || 0) + 1;
        });
        return counts;
    }, [effectiveLeads]);

    // ── Filtrado dinámico por Producto Seleccionado ─────────────────────────────
    const filteredEffectiveLeads = useMemo(() => {
        if (!effectiveProductFilter || effectiveProductFilter.length === 0) {
            return effectiveLeads;
        }
        return effectiveLeads.filter(lead => {
            const key = lead.interested_product_id || 'none';
            return effectiveProductFilter.includes(key);
        });
    }, [effectiveLeads, effectiveProductFilter]);

    // ── Motor Analítico Retroactivo: Evalúa el 100% de los Prospectos Filtrados ──
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

        filteredEffectiveLeads.forEach(lead => {
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
                    withinSla: elapsedMinutes <= slaTargetMinutes
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
                    withinSla: elapsedMinutes <= slaTargetMinutes
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
        const fresh: AnalyzedLead[] = [];      // < 15 min (Ventana Óptima)
        const warm: AnalyzedLead[] = [];       // 15m - 2h (Atención en Turno)
        const atRisk: AnalyzedLead[] = [];     // 2h - 12h (Atención Tardía)
        const critical: AnalyzedLead[] = [];   // > 12h o > 24h (Demora Crítica)

        const withinSlaItems: AnalyzedLead[] = [];
        const exceededSlaItems: AnalyzedLead[] = [];

        let totalMinutes = 0;

        activeDataset.forEach(item => {
            totalMinutes += item.elapsedMinutes;
            if (item.withinSla) {
                withinSlaItems.push(item);
            } else {
                exceededSlaItems.push(item);
            }

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
        const withinSlaCount = withinSlaItems.length;
        const exceededSlaCount = exceededSlaItems.length;
        const slaComplianceRate = totalCount > 0 ? Math.round((withinSlaCount / totalCount) * 100) : 0;

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
            withinSlaLeadIds: withinSlaItems.map(i => i.lead.id),
            exceededSlaLeadIds: exceededSlaItems.map(i => i.lead.id),
            fresh: { items: fresh, count: fresh.length, pct: totalCount > 0 ? Math.round((fresh.length / totalCount) * 100) : 0 },
            warm: { items: warm, count: warm.length, pct: totalCount > 0 ? Math.round((warm.length / totalCount) * 100) : 0 },
            atRisk: { items: atRisk, count: atRisk.length, pct: totalCount > 0 ? Math.round((atRisk.length / totalCount) * 100) : 0 },
            critical: { items: critical, count: critical.length, pct: totalCount > 0 ? Math.round((critical.length / totalCount) * 100) : 0 },
            highRiskLeads,
            allAnalyzedCount: allAnalyzed.length
        };
    }, [filteredEffectiveLeads, followUpMap, viewMode, slaTargetMinutes]);

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
                pipelineView: 'all',
                productFilter: effectiveProductFilter.length === 0 ? 'all' : (effectiveProductFilter.length === 1 ? effectiveProductFilter[0] : effectiveProductFilter)
            }
        });
    };

    // ── Texto de Etiqueta de Productos Activos ────────────────────────────────
    const activeProductLabels = useMemo(() => {
        if (effectiveProductFilter.length === 0) return 'Todos los productos';
        return effectiveProductFilter.map(id => {
            if (id === 'none') return 'Sin producto';
            return effectiveProducts.find(p => p.id === id)?.name || id;
        }).join(', ');
    }, [effectiveProductFilter, effectiveProducts]);

    // ── Opciones Disponibles para la Meta SLA KPI ─────────────────────────────
    const SLA_OPTIONS = [
        { label: '15 Minutos (Ventana de Oro)', minutes: 15, tag: 'Inmediato' },
        { label: '1 Hora (Atención Rápida)', minutes: 60, tag: 'Rápido' },
        { label: '2 Horas (Mismo Turno)', minutes: 120, tag: 'Turno' },
        { label: '4 Horas (Media Jornada)', minutes: 240, tag: 'Medio Día' },
        { label: '12 Horas (Mismo Día)', minutes: 720, tag: 'Día' },
        { label: '24 Horas (1 Día Hábil)', minutes: 1440, tag: 'Estándar', isRecommended: true },
        { label: '48 Horas (2 Días Hábiles)', minutes: 2880, tag: 'Flexible' },
    ];

    // ── Menú Desplegable de Configuración de Meta SLA ─────────────────────────
    const renderSlaTargetDropdown = () => (
        <div 
            onClick={(e) => e.stopPropagation()} 
            className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-[9999] py-2 animate-in fade-in zoom-in-95"
        >
            <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-indigo-600" />
                    Configurar Meta SLA (KPI)
                </span>
                <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                    Admin
                </span>
            </div>

            <div className="p-2 space-y-1">
                {SLA_OPTIONS.map(opt => {
                    const isSelected = slaTargetMinutes === opt.minutes;
                    return (
                        <button
                            key={opt.minutes}
                            onClick={() => handleSlaTargetChange(opt.minutes)}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-between ${
                                isSelected ? 'bg-indigo-600 text-white font-bold shadow-sm' : 'text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                                    isSelected ? 'border-white bg-white text-indigo-600' : 'border-slate-300'
                                }`}>
                                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                                </div>
                                <span>{opt.label}</span>
                            </div>
                            {opt.isRecommended && (
                                <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                                    isSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'
                                }`}>
                                    Recomendado
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
            
            <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 leading-snug">
                💡 Los administradores pueden cambiar este umbral en cualquier momento para medir el cumplimiento real de su equipo.
            </div>
        </div>
    );

    // ── Componente Reutilizable: Menú Desplegable de Selección de Productos ────
    const renderProductDropdownMenu = () => (
        <div 
            onClick={(e) => e.stopPropagation()} 
            className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-[9999] py-2 animate-in fade-in zoom-in-95 max-h-80 overflow-y-auto"
        >
            <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-indigo-600" />
                    Filtrar por Producto
                </span>
                {effectiveProductFilter.length > 0 && (
                    <button
                        onClick={handleProductFilterClear}
                        className="text-[9px] font-bold text-rose-600 hover:text-rose-800 transition-colors"
                    >
                        Limpiar ({effectiveProductFilter.length})
                    </button>
                )}
            </div>

            {/* Opción 1: Todos los productos */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    handleProductFilterClear();
                    setActiveDropdown(null);
                }}
                className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors flex items-center justify-between ${
                    effectiveProductFilter.length === 0 ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'
                }`}
            >
                <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                        effectiveProductFilter.length === 0 ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                    }`}>
                        {effectiveProductFilter.length === 0 && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className="font-bold">Todos los productos</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                    effectiveProductFilter.length === 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                }`}>
                    {effectiveLeads.length}
                </span>
            </button>

            <div className="border-t border-slate-100 my-1" />

            {/* Opción 2: Cada producto disponible */}
            {effectiveProducts.map(prod => {
                const isChecked = effectiveProductFilter.includes(prod.id);
                const count = leadsCountByProduct[prod.id] || 0;
                return (
                    <button
                        key={prod.id}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleProductFilterToggle(prod.id);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors flex items-center justify-between ${
                            isChecked ? 'bg-indigo-50/80 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                                isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                            }`}>
                                {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <span className="truncate">{prod.name}</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black shrink-0 ${
                            isChecked ? 'bg-indigo-100 text-indigo-700' : count > 0 ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-300'
                        }`}>
                            {count}
                        </span>
                    </button>
                );
            })}

            {/* Opción 3: Leads sin producto asignado */}
            {(leadsCountByProduct['none'] || 0) > 0 && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleProductFilterToggle('none');
                    }}
                    className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors flex items-center justify-between ${
                        effectiveProductFilter.includes('none') ? 'bg-indigo-50/80 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                            effectiveProductFilter.includes('none') ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                        }`}>
                            {effectiveProductFilter.includes('none') && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="truncate italic text-slate-500 font-medium">Sin producto</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black shrink-0 ${
                        effectiveProductFilter.includes('none') ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                        {leadsCountByProduct['none']}
                    </span>
                </button>
            )}
        </div>
    );

    // ── Pill Badge de Producto Activo Reutilizable en Tarjetas ─────────────────
    const renderActiveProductPill = () => {
        if (effectiveProductFilter.length === 0) return null;
        return (
            <div className="flex flex-wrap items-center gap-1 mb-2.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-50 border border-rose-200/90 text-rose-800 text-[10px] font-black tracking-wide shadow-sm animate-in fade-in">
                    <Package className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span className="truncate max-w-[170px]" title={activeProductLabels}>
                        {activeProductLabels}
                    </span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleProductFilterClear();
                        }}
                        className="hover:bg-rose-200 rounded p-0.5 ml-0.5 cursor-pointer text-rose-700 transition-colors"
                        title="Ver todos los productos"
                    >
                        ✕
                    </button>
                </span>
            </div>
        );
    };

    return (
        <div className="lg:col-span-12 relative z-0">
            {/* Header del bloque ejecutivo con selectores Retroactivos y Filtro de Producto */}
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

                    {/* Botón de Ayuda General: ¿Cómo se calculan los datos? */}
                    <button
                        onClick={() => setIsLogicModalOpen(true)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50/90 hover:bg-indigo-100 text-indigo-700 font-extrabold text-[9px] uppercase tracking-wider transition-all border border-indigo-200/80 shadow-sm cursor-pointer ml-1"
                        title="Ver detalle completo de las fórmulas y reglas de cálculo del sistema"
                    >
                        <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Lógica de Cálculo</span>
                    </button>
                </div>

                {/* Controles de Vista, Alcance y Filtro de Productos */}
                <div className="flex flex-wrap items-center gap-2">

                    {/* 📦 Selector de Productos (Estilo idéntico a card Sin Contactar) */}
                    <div className="relative product-dropdown-container">
                        <button
                            onClick={() => setActiveDropdown(activeDropdown === 'header' ? null : 'header')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border shadow-sm cursor-pointer ${
                                effectiveProductFilter.length > 0
                                    ? 'bg-rose-50 text-rose-700 border-rose-300 ring-2 ring-rose-200'
                                    : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50'
                            }`}
                            title="Filtrar métricas de velocidad por tipo de producto"
                        >
                            <Package className={`w-3.5 h-3.5 ${effectiveProductFilter.length > 0 ? 'text-rose-600' : 'text-slate-500'}`} />
                            <span className="max-w-[130px] truncate">
                                {effectiveProductFilter.length === 0 
                                    ? 'Todos los Productos' 
                                    : effectiveProductFilter.length === 1 
                                        ? (effectiveProductFilter[0] === 'none' ? 'Sin producto' : effectiveProducts.find(p => p.id === effectiveProductFilter[0])?.name || '1 producto')
                                        : `${effectiveProductFilter.length} productos`}
                            </span>
                            <span className={`text-[8px] px-1.5 py-0.2 rounded-full font-black ${
                                effectiveProductFilter.length > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                                {analysis.allAnalyzedCount}
                            </span>
                            <ChevronDown className="w-3 h-3 text-slate-400" />
                        </button>

                        {activeDropdown === 'header' && renderProductDropdownMenu()}
                    </div>

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
                                    <h3 className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                                        Speed-to-Lead (SLA)
                                        <InfoTip 
                                            title="Lógica Speed-to-Lead (SLA)"
                                            text={`Mide el tiempo real entre la llegada del prospecto y su primer contacto. Evalúa si el equipo está cumpliendo la meta definida por el admin (${formatDuration(slaTargetMinutes)}).`}
                                            formula="Promedio = Σ(Tiempo de contacto o espera) ÷ Total Leads"
                                            bullets={[
                                                `Meta Actual: ≤ ${formatDuration(slaTargetMinutes)} (Configurable con el botón 'Meta SLA').`,
                                                'Leads atendidos: primer contacto (llamada o seguimiento) menos fecha de creación.',
                                                'Leads sin atender: tiempo transcurrido desde su llegada hasta este momento.',
                                                'Excluye Clientes ya ganados (cumplieron su meta comercial).'
                                            ]}
                                            position="bottom"
                                        />
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
                            
                            {/* Grupo Superior Derecho: Selector de Meta SLA + Gear de Producto EXACTO como Sin Contactar */}
                            <div className="flex items-center gap-1.5">
                                
                                {/* 🎯 Selector de Meta SLA (ej. 24h, 15m, etc.) */}
                                <div className="relative sla-target-dropdown-container">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsSlaTargetDropdownOpen(prev => !prev);
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 text-[9px] font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                                        title="Haz clic para cambiar la meta de tiempo de contacto (ej. 24h, 15m)"
                                    >
                                        <Target className="w-3 h-3 text-indigo-600" />
                                        <span>Meta &lt; {formatDuration(slaTargetMinutes)}</span>
                                        <ChevronDown className="w-2.5 h-2.5 text-indigo-500" />
                                    </button>
                                    {isSlaTargetDropdownOpen && renderSlaTargetDropdown()}
                                </div>

                                {/* ⚙️ Gear de Producto (Diseño EXACTO idéntico al card Sin Contactar) */}
                                <div className="relative product-dropdown-container">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveDropdown(activeDropdown === 'speed' ? null : 'speed');
                                        }}
                                        className={`p-2 rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center ${
                                            effectiveProductFilter.length > 0 
                                                ? 'bg-rose-600 text-white ring-2 ring-rose-300 shadow-rose-200' 
                                                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                                        }`}
                                        title="Filtrar por Tipo de Producto (ERP, Sin Producto, etc.)"
                                    >
                                        <Settings className="w-4 h-4 stroke-[2.5]" />
                                    </button>
                                    {activeDropdown === 'speed' && renderProductDropdownMenu()}
                                </div>
                            </div>
                        </div>

                        {/* Pill del producto activo */}
                        {renderActiveProductPill()}

                        {/* ── COMPARATIVA VISUAL: REALIDAD VS KPI META ── */}
                        {analysis.totalCount > 0 && (
                            <div className={`p-3 rounded-2xl border transition-all mb-3 ${
                                analysis.avgMinutes <= slaTargetMinutes
                                    ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900 shadow-sm'
                                    : 'bg-rose-50/90 border-rose-200 text-rose-900 shadow-sm'
                            }`}>
                                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider mb-1">
                                    <span className="flex items-center gap-1.5">
                                        {analysis.avgMinutes <= slaTargetMinutes ? (
                                            <>
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                <span className="text-emerald-700">DENTRO DE LA META</span>
                                            </>
                                        ) : (
                                            <>
                                                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 animate-pulse" />
                                                <span className="text-rose-700">TENEMOS QUE MEJORAR</span>
                                            </>
                                        )}
                                    </span>
                                    <span className="font-mono text-[9px] px-2 py-0.5 rounded-full bg-white/90 font-bold border border-black/5 shadow-2xs">
                                        Meta: ≤ {formatDuration(slaTargetMinutes)}
                                    </span>
                                </div>
                                <p className="text-[11px] font-bold leading-tight">
                                    {analysis.avgMinutes <= slaTargetMinutes 
                                        ? `Excelente: la demora promedio (${formatDuration(analysis.avgMinutes)}) cumple el objetivo de ${formatDuration(slaTargetMinutes)}.`
                                        : `Alerta operativa: la demora promedio (${formatDuration(analysis.avgMinutes)}) supera la meta de ${formatDuration(slaTargetMinutes)} por ${formatDuration(analysis.avgMinutes - slaTargetMinutes)}.`}
                                </p>
                            </div>
                        )}

                        {/* Métrica Principal: Demora Promedio */}
                        <div className="mt-1 mb-3">
                            {analysis.totalCount > 0 ? (
                                <>
                                    <div className="flex items-baseline gap-2">
                                        <span className={`text-3xl xl:text-4xl font-black tracking-tight ${
                                            analysis.avgMinutes <= slaTargetMinutes ? 'text-slate-900' : 'text-rose-600'
                                        }`}>
                                            {formatDuration(analysis.avgMinutes)}
                                        </span>
                                        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                                            {viewMode === 'attended' ? 'respuesta promedio' : 'demora / espera prom.'}
                                            <InfoTip
                                                title="Cálculo de Demora Promedio"
                                                text="Suma de minutos transcurridos de todos los prospectos analizados dividido entre el total de prospectos en este filtro."
                                                formula="Demora Promedio = (Σ Minutos transcurridos) ÷ Total Leads"
                                                bullets={[
                                                    `Meta configurada: ≤ ${formatDuration(slaTargetMinutes)}`,
                                                    `Verde: Dentro de la meta`,
                                                    `Rojo: Excede la meta`
                                                ]}
                                                position="top"
                                            />
                                        </span>
                                    </div>

                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                        <span className="text-[9px] font-bold text-slate-400">
                                            ({analysis.totalCount} leads analizados)
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <div className="py-2">
                                    <p className="text-base font-black text-slate-500">Sin datos en este filtro</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Selecciona "Todos los productos" o "Todo el Histórico" para ver la trayectoria global.</p>
                                </div>
                            )}
                        </div>

                        {/* ── AUDITORÍA 1-CLIC: CUÁLES ESTÁN DENTRO DE LA META Y CUÁLES NO ── */}
                        <div className="grid grid-cols-2 gap-2 my-3">
                            {/* Leads Dentro de Meta */}
                            <div 
                                onClick={() => handleNavigateWithLeads(analysis.withinSlaLeadIds)}
                                className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 hover:bg-emerald-100 hover:border-emerald-300 transition-all cursor-pointer group/within shadow-xs"
                                title="Clic para ver la lista de prospectos que CUMPLIERON la meta"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        En Meta
                                    </span>
                                    <ArrowRight className="w-3 h-3 text-emerald-500 group-hover/within:translate-x-0.5 transition-transform" />
                                </div>
                                <div className="flex items-baseline gap-1.5 mt-0.5">
                                    <span className="text-xl font-black text-emerald-800 font-mono">
                                        {analysis.withinSlaCount}
                                    </span>
                                    <span className="text-[10px] font-black text-emerald-600">
                                        ({analysis.slaComplianceRate}%)
                                    </span>
                                </div>
                                <p className="text-[8.5px] text-emerald-700 font-semibold mt-0.5 truncate">
                                    ≤ {formatDuration(slaTargetMinutes)}
                                </p>
                            </div>

                            {/* Leads Fuera de Meta */}
                            <div 
                                onClick={() => handleNavigateWithLeads(analysis.exceededSlaLeadIds)}
                                className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200/80 hover:bg-rose-100 hover:border-rose-300 transition-all cursor-pointer group/exceed shadow-xs"
                                title="Clic para ver la lista de prospectos que INCUMPLIERON la meta para atacarlos"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black text-rose-800 uppercase tracking-wider flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                                        Fuera Meta
                                    </span>
                                    <ArrowRight className="w-3 h-3 text-rose-500 group-hover/exceed:translate-x-0.5 transition-transform" />
                                </div>
                                <div className="flex items-baseline gap-1.5 mt-0.5">
                                    <span className="text-xl font-black text-rose-800 font-mono">
                                        {analysis.exceededSlaCount}
                                    </span>
                                    <span className="text-[10px] font-black text-rose-600">
                                        ({100 - analysis.slaComplianceRate}%)
                                    </span>
                                </div>
                                <p className="text-[8.5px] text-rose-700 font-semibold mt-0.5 truncate">
                                    &gt; {formatDuration(slaTargetMinutes)} (Atacar)
                                </p>
                            </div>
                        </div>

                        {/* Cumplimiento SLA Barra */}
                        <div className="space-y-1.5 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
                                <span className="text-slate-500 flex items-center gap-1">
                                    Cumplimiento SLA (&lt; {formatDuration(slaTargetMinutes)})
                                    <InfoTip
                                        title="Cumplimiento de Meta SLA"
                                        text={`Porcentaje de prospectos contactados o atendidos dentro del objetivo de ${formatDuration(slaTargetMinutes)}.`}
                                        formula={`(Leads con tiempo ≤ ${formatDuration(slaTargetMinutes)} ÷ Total Leads) × 100`}
                                        bullets={[
                                            '≥ 70%: Nivel de excelencia comercial.',
                                            '40% - 69%: Riesgo operativo moderado.',
                                            '< 40%: Cuello de botella crítico en guardia de ventas.'
                                        ]}
                                        position="top"
                                    />
                                </span>
                                <span className={
                                    analysis.slaComplianceRate >= 70 
                                        ? 'text-emerald-600 font-black' 
                                        : analysis.slaComplianceRate >= 40 
                                            ? 'text-amber-600 font-black' 
                                            : 'text-rose-600 font-black'
                                }>
                                    {analysis.slaComplianceRate}% a tiempo
                                </span>
                            </div>

                            <div className="h-2 w-full bg-slate-200/70 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full rounded-full transition-all duration-1000 ${
                                        analysis.slaComplianceRate >= 70 ? 'bg-emerald-500' : analysis.slaComplianceRate >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                                    }`}
                                    style={{ width: `${Math.max(5, analysis.slaComplianceRate)}%` }}
                                />
                            </div>

                            <p className="text-[9px] text-slate-400 font-medium">
                                {analysis.withinSlaCount} de {analysis.totalCount} prospectos contactados o atendidos dentro de las {formatDuration(slaTargetMinutes)}.
                            </p>
                        </div>
                    </div>

                    {/* Footer con Alerta Viva y Estado de Producto */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        {analysis.exceededSlaCount > 0 ? (
                            <div 
                                onClick={() => handleNavigateWithLeads(analysis.exceededSlaLeadIds)}
                                className="flex items-center gap-1.5 text-[10px] font-black text-rose-600 hover:text-rose-700 cursor-pointer group/link"
                            >
                                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                                <span>{analysis.exceededSlaCount} fuera de meta</span>
                                <ArrowRight className="w-3 h-3 group-hover/link:translate-x-0.5 transition-transform" />
                            </div>
                        ) : (
                            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Flujo 100% al día en meta
                            </span>
                        )}
                        
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            {effectiveProductFilter.length > 0 
                                ? `• ${analysis.totalCount} EN ${effectiveProductFilter.length === 1 ? (effectiveProductFilter[0] === 'none' ? 'Sin producto' : effectiveProducts.find(p => p.id === effectiveProductFilter[0])?.name || '1 PROD.') : `${effectiveProductFilter.length} PROD.`}` 
                                : (timeScope === 'all_time' ? 'Histórico Global' : 'Período')}
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
                                    <h3 className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                                        Radar de Envejecimiento
                                        <InfoTip 
                                            title="Lógica de Tramos de Envejecimiento"
                                            text="Clasifica el 100% de los prospectos evaluados según su tiempo de respuesta histórico o su tiempo de espera actual."
                                            formula="Tramo = Intervalo de tiempo transcurrido desde la creación del lead"
                                            bullets={[
                                                '< 15 min: Ventana de Oro. Receptividad máxima inmediata.',
                                                '15m - 2h: Atención en turno. Lead aún caliente.',
                                                '2h - 12h: Demora tardía. Alto riesgo de que consulte competidores.',
                                                '> 24h: Demora crítica. Leads con más de 1 día de atraso.',
                                                'Haz clic en cualquier tramo para ver y atacar esos leads.'
                                            ]}
                                            position="bottom"
                                        />
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-medium">Distribución por tramo operativo</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                                <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider">
                                    {analysis.totalCount} evaluados
                                </span>

                                {/* ⚙️ Gear de Producto (Diseño EXACTO idéntico al card Sin Contactar) */}
                                <div className="relative product-dropdown-container">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveDropdown(activeDropdown === 'radar' ? null : 'radar');
                                        }}
                                        className={`p-2 rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center ${
                                            effectiveProductFilter.length > 0 
                                                ? 'bg-rose-600 text-white ring-2 ring-rose-300 shadow-rose-200' 
                                                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                                        }`}
                                        title="Filtrar por Tipo de Producto (ERP, Sin Producto, etc.)"
                                    >
                                        <Settings className="w-4 h-4 stroke-[2.5]" />
                                    </button>
                                    {activeDropdown === 'radar' && renderProductDropdownMenu()}
                                </div>
                            </div>
                        </div>

                        {/* Pill del producto activo */}
                        {renderActiveProductPill()}

                        {/* Lista de 4 Tramos con Clic Directo */}
                        <div className="space-y-2 mt-2">
                            {/* Nivel 1: < 15 min */}
                            <div 
                                onClick={() => handleNavigateWithLeads(analysis.fresh.items.map(i => i.lead.id))}
                                className="group/item flex items-center justify-between p-2 rounded-xl hover:bg-emerald-50/70 border border-transparent hover:border-emerald-100 transition-all cursor-pointer"
                                title="Ver prospectos en la ventana óptima"
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
                                title="Ver prospectos atendidos en turno"
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
                                title="Ver prospectos con atención tardía"
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
                                title="Ver prospectos con demora crítica"
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
                            {effectiveProductFilter.length > 0 
                                ? `• ${analysis.totalCount} EN ${effectiveProductFilter.length === 1 ? (effectiveProductFilter[0] === 'none' ? 'Sin producto' : effectiveProducts.find(p => p.id === effectiveProductFilter[0])?.name || '1 PROD.') : `${effectiveProductFilter.length} PROD.`}` 
                                : (timeScope === 'all_time' ? 'Histórico Global' : 'Filtro Actual')}
                        </span>
                        <span className="text-[9px] font-extrabold text-indigo-600">
                            Filtro 1-Clic
                        </span>
                    </div>
                </div>

                {/* ── TARJETA 3: Capital en Riesgo & Fuga Comercial (CFO Radar) ── */}
                <div className="bg-white p-5 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/70 flex flex-col justify-between group hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] transition-all duration-500 relative">
                    <div>
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-white shadow-md shadow-rose-200">
                                    <ShieldAlert className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                                        Capital en Riesgo
                                        <InfoTip 
                                            title="Lógica de Capital en Riesgo (CFO)"
                                            text="Calcula la pérdida potencial y fuga publicitaria de prospectos activos con demora superior a 2 horas."
                                            formula="Pipeline = Σ Valor real | Pauta = Leads demorados × $15 CAC"
                                            bullets={[
                                                '🔒 REGLA ESTRICTA: Excluye clientes ya ganados (como tratos cerrados) y leads descartados/erróneos.',
                                                'Pipeline: Suma el valor cotizado real en CRM (o proyecta con el ticket promedio).',
                                                'Pauta en Riesgo: Dinero publicitario (Meta/Google Ads) en peligro de desperdicio.'
                                            ]}
                                            position="bottom"
                                        />
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-medium">Fuga financiera & CAC</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                                <span className="bg-rose-50 text-rose-700 border border-rose-100 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider">
                                    CFO Radar
                                </span>

                                {/* ⚙️ Gear de Producto (Diseño EXACTO idéntico al card Sin Contactar) */}
                                <div className="relative product-dropdown-container">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveDropdown(activeDropdown === 'risk' ? null : 'risk');
                                        }}
                                        className={`p-2 rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center ${
                                            effectiveProductFilter.length > 0 
                                                ? 'bg-rose-600 text-white ring-2 ring-rose-300 shadow-rose-200' 
                                                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                                        }`}
                                        title="Filtrar por Tipo de Producto (ERP, Sin Producto, etc.)"
                                    >
                                        <Settings className="w-4 h-4 stroke-[2.5]" />
                                    </button>
                                    {activeDropdown === 'risk' && renderProductDropdownMenu()}
                                </div>
                            </div>
                        </div>

                        {/* Pill del producto activo */}
                        {renderActiveProductPill()}

                        {/* Métricas Financieras Clave con Ticket Promedio Real */}
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            <div className="bg-rose-50/60 p-2.5 rounded-xl border border-rose-100/60">
                                <div className="flex items-center justify-between mb-0.5">
                                    <p className="text-[9px] font-black text-rose-700 uppercase tracking-wider">
                                        Pipeline en Peligro
                                    </p>
                                    <InfoTip
                                        title="Cálculo del Pipeline en Peligro"
                                        text="Suma del valor cotizado en CRM de todos los prospectos activos demorados (> 2 horas). Si el valor no está configurado, proyecta multiplicando por el Ticket Promedio."
                                        formula="Σ(Valor del Lead en BD) o (Leads demorados × Ticket Promedio)"
                                        position="top"
                                    />
                                </div>
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
                                <div className="flex items-center justify-between mb-0.5">
                                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-wider">
                                        Pauta en Riesgo
                                    </p>
                                    <InfoTip
                                        title="Cálculo de Pauta en Riesgo (CAC)"
                                        text="Representa la inversión publicitaria en Meta Ads o Google Ads que se está perdiendo al no contactar al lead rápidamente."
                                        formula="Pauta en Riesgo = Leads activos demorados (> 2h) × $15 CAC"
                                        position="top"
                                    />
                                </div>
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
                                        <InfoTip
                                            title="Priorización de Urgencia"
                                            text="Muestra los prospectos activos demorados con mayor valor económico y mayor tiempo acumulado sin respuesta para atacarlos primero."
                                            position="top"
                                        />
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
                                    : filteredEffectiveLeads.filter(l => l.status !== 'Cliente' && l.status !== 'Cerrado' && l.status !== 'Perdido' && l.status !== 'Erróneo').map(l => l.id)
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

            {/* ── MODAL EXPLICATIVO DE LÓGICA Y FÓRMULAS MATEMÁTICAS ────────────────── */}
            {isLogicModalOpen && (
                <div 
                    className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
                    onClick={() => setIsLogicModalOpen(false)}
                >
                    <div 
                        className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200/90 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header del Modal */}
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
                                    <Calculator className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-base font-black text-slate-900 leading-tight">
                                        Lógica y Fórmulas de Cálculo
                                    </h2>
                                    <p className="text-xs text-slate-500 font-medium">
                                        Metodología ejecutiva y reglas de negocio del Centro de Control
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => setIsLogicModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Contenido en 3 Bloques Didácticos */}
                        <div className="mt-5 space-y-4">

                            {/* Bloque 1: Speed-to-Lead */}
                            <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                                <div className="flex items-center gap-2 text-indigo-900 font-black text-xs uppercase tracking-wide mb-1.5">
                                    <Zap className="w-4 h-4 text-indigo-600" />
                                    <span>1. Speed-to-Lead y Meta KPI Personalizable</span>
                                </div>
                                <p className="text-xs text-slate-700 leading-relaxed">
                                    Mide el tiempo transcurrido desde la llegada del prospecto al CRM hasta su <strong>primer contacto real registrado</strong> (llamadas en <code className="text-indigo-700 font-mono">call_activities</code> o seguimientos en <code className="text-indigo-700 font-mono">follow_ups</code>).
                                </p>
                                
                                <div className="mt-2.5 bg-white p-3 rounded-xl border border-indigo-200/80 font-mono text-xs text-indigo-950 space-y-1">
                                    <div><strong>Fórmula Demora Promedio:</strong> Σ(Minutos transcurridos de cada lead) ÷ Total Leads</div>
                                    <div><strong>Fórmula Cumplimiento Meta:</strong> (Leads con tiempo ≤ Meta ÷ Total Leads) × 100</div>
                                </div>

                                <div className="mt-2.5 text-[11px] text-slate-600 space-y-1">
                                    <p>• <strong>Meta Personalizable por el Admin:</strong> Puedes definir si tu objetivo es contactar en 15m, 1h, 2h, 4h, 12h o <strong>24 horas</strong>.</p>
                                    <p>• <strong>Prospectos en cola (pendientes):</strong> Se evalúa su tiempo de espera acumulado hasta el momento actual.</p>
                                </div>
                            </div>

                            {/* Bloque 2: Radar de Envejecimiento */}
                            <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100">
                                <div className="flex items-center gap-2 text-amber-900 font-black text-xs uppercase tracking-wide mb-1.5">
                                    <Clock className="w-4 h-4 text-amber-600" />
                                    <span>2. Radar de Envejecimiento Operativo</span>
                                </div>
                                <p className="text-xs text-slate-700 leading-relaxed">
                                    Segmenta los prospectos en 4 ventanas de tiempo para identificar cuellos de botella inmediatos:
                                </p>

                                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                    <div className="bg-white p-2.5 rounded-xl border border-amber-200/80">
                                        <p className="font-bold text-emerald-700">&lt; 15 min · Ventana Óptima</p>
                                        <p className="text-[10.5px] text-slate-500 mt-0.5">Leads recién llegados o atendidos de inmediato. Máxima receptividad.</p>
                                    </div>
                                    <div className="bg-white p-2.5 rounded-xl border border-amber-200/80">
                                        <p className="font-bold text-amber-700">15m - 2h · Atención en Turno</p>
                                        <p className="text-[10.5px] text-slate-500 mt-0.5">Atendidos en el mismo turno de guardia antes de que se enfríen.</p>
                                    </div>
                                    <div className="bg-white p-2.5 rounded-xl border border-amber-200/80">
                                        <p className="font-bold text-orange-700">2h - 12h · Atención Tardía</p>
                                        <p className="text-[10.5px] text-slate-500 mt-0.5">Demora mayor a 2 horas. Riesgo de que cotice con competidores.</p>
                                    </div>
                                    <div className="bg-white p-2.5 rounded-xl border border-amber-200/80">
                                        <p className="font-bold text-rose-700">&gt; 24h · Demora Crítica</p>
                                        <p className="text-[10.5px] text-slate-500 mt-0.5">Más de 1 día sin respuesta. Requiere reenganche urgente.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Bloque 3: Capital en Riesgo */}
                            <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100">
                                <div className="flex items-center gap-2 text-rose-900 font-black text-xs uppercase tracking-wide mb-1.5">
                                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                                    <span>3. Capital en Riesgo y Fuga de Pauta (CFO Radar)</span>
                                </div>
                                <p className="text-xs text-slate-700 leading-relaxed">
                                    Cuantifica el impacto financiero directo que produce la demora en la atención:
                                </p>

                                <div className="mt-2.5 bg-white p-3 rounded-xl border border-rose-200/80 font-mono text-xs text-rose-950 space-y-1">
                                    <div><strong>Pipeline en Peligro:</strong> Σ(Valor de leads activos demorados &gt; 2h)</div>
                                    <div><strong>Pauta en Riesgo:</strong> Leads activos demorados &gt; 2h × ~$15 CAC</div>
                                </div>

                                <div className="mt-2.5 text-[11px] text-slate-600 space-y-1">
                                    <p>• <strong>Exclusión Estricta de Clientes:</strong> Los prospectos que ya compraron y cerraron la venta (estado <code className="text-rose-700 font-bold">Cliente</code>) están <strong>100% excluidos</strong> de esta métrica, pues ya lograron el objetivo comercial.</p>
                                    <p>• <strong>Ticket Promedio:</strong> Si un lead no tiene valor cotizado asignado, se proyecta con el ticket promedio histórico (${averageTicket > 0 ? averageTicket : 250}).</p>
                                </div>
                            </div>

                        </div>

                        {/* Botón de Cierre */}
                        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setIsLogicModalOpen(false)}
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-indigo-200"
                            >
                                Entendido, Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
