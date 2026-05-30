import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { BadgeDollarSign, TrendingUp, Users, Target, Building, Building2, Calendar, Clock, CheckCircle, ChevronDown, Edit2, Settings, AlertTriangle, PhoneOff, ArrowRight, Sprout, CreditCard, Brain, Sparkles, MessageSquare, Crosshair, Flame, Zap, HelpCircle } from 'lucide-react';
import { adminService } from '../services/admin';
import { supabase } from '../services/supabase';
import { useEffect, useState, useRef, useMemo } from 'react';
import {
    startOfToday, endOfToday,
    startOfWeek, endOfWeek,
    startOfMonth,
    subMonths,
    startOfYear
} from 'date-fns';
import { useAuth } from '../auth/AuthProvider';
import { STATUS_CONFIG, PRIORITY_CONFIG, SOURCE_CONFIG, DATE_RANGE_OPTIONS, type DateRange } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '../components/ui/Button';
import { logger } from '../utils/logger';
import { useDashboardStats } from '../hooks/useDashboard';
import { MobileQuickActions } from '../components/MobileQuickActions';
import { ManagerLivePulse } from '../components/ManagerLivePulse';
import { WeeklyLeaderboard } from '../components/WeeklyLeaderboard';
import { PanoramaFinancieroWidget } from '../components/financiero/PanoramaFinancieroWidget';
import { pagosService } from '../services/pagos';
import toast from 'react-hot-toast';


const THEME = {
    primary: '#4F46E5',   // Indigo Moderno
    background: '#F8FAFC', // Slate 50 tint
    surface: '#FFFFFF',    // Pure White
    text: '#1E293B',       // Slate 800
    accent: '#F59E0B',     // Amber 500
    success: '#10B981',    // Emerald 500
    neutral: '#64748B',    // Slate 500
    chart1: '#3B82F6',     // Blue 500
    chart2: '#8B5CF6',     // Violet 500
    chart3: '#EC4899',     // Pink 500
};

// Human-readable period labels for SIA widgets (F4 + F5)
const SIA_PERIOD_LABELS: Record<string, string> = {
    today: 'Hoy',
    this_week: 'Esta semana',
    this_month: 'Este mes',
    last_3_months: 'Últimos 3 meses',
    last_6_months: 'Últimos 6 meses',
    this_year: 'Este año',
    all: 'Todo el tiempo',
};


const PIE_COLORS = [THEME.primary, THEME.success, THEME.accent, THEME.chart2, THEME.chart3, '#94A3B8'];

const FunnelInfographic = ({ data, onStageClick, hideClientAmount, hideAmounts }: {
    data: any[];
    onStageClick: (status: string) => void;
    hideClientAmount?: boolean;
    hideAmounts?: boolean;
}) => {
    // Unicode-safe lookup: normalize both sides to NFC to handle accent encoding variations
    const findByStatus = (status: string) => {
        const normalized = status.normalize('NFC');
        return data.find(d => (d.key || '').normalize('NFC') === normalized);
    };
    const count = (status: string) => {
        const item = findByStatus(status);
        return item ? item.value : 0;
    };
    const amount = (status: string) => {
        const item = findByStatus(status);
        return item ? (item.amount || 0) : 0;
    };

    const layers = [
        { label: 'Prospecto', value: count('Prospecto'), amount: amount('Prospecto'), color: '#3b82f6', key: 'Prospecto' },
        { label: 'Llamada fría', value: count('Llamada fría'), amount: amount('Llamada fría'), color: '#ea580c', key: 'Llamada fría' },
        { label: 'Nutrición', value: count('En Nutrición'), amount: amount('En Nutrición'), color: '#0d9488', key: 'En Nutrición' },
        { label: 'Calificado', value: count('Lead calificado'), amount: amount('Lead calificado'), color: '#6366f1', key: 'Lead calificado' },
        { label: 'Seguimiento', value: count('En seguimiento'), amount: amount('En seguimiento'), color: '#8b5cf6', key: 'En seguimiento' },
        { label: 'Negociación', value: count('Negociación'), amount: amount('Negociación'), color: '#f97316', key: 'Negociación' },
        { label: 'Cerrado', value: count('Cerrado'), amount: amount('Cerrado'), color: '#10b981', key: 'Cerrado' },
        { label: 'Cliente', value: count('Cliente'), amount: amount('Cliente'), color: '#059669', key: 'Cliente' }
    ];

    const maxVal = Math.max(...layers.map(l => l.value), 1);

    return (
        <div className="flex flex-col w-full gap-3 py-1">
            {layers.map((layer) => (
                <div
                    key={layer.key}
                    className="group cursor-pointer"
                    onClick={() => onStageClick(layer.key)}
                >
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-indigo-600 transition-colors">{layer.label}</span>
                        <div className="flex items-center gap-2">
                            {layer.amount > 0 && !hideAmounts && !(hideClientAmount && layer.key === 'Cliente') && (
                                <span className="text-[10px] font-bold text-emerald-600">${layer.amount.toLocaleString()}</span>
                            )}
                            <span className="text-[11px] font-black text-slate-900">{layer.value}</span>
                        </div>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-1000 group-hover:brightness-110"
                            style={{
                                width: `${(layer.value / maxVal) * 100}%`,
                                backgroundColor: layer.color
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
};




export default function Dashboard() {
    const { t } = useTranslation();
    const { profile } = useAuth();
    const location = useLocation();

    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);
    const [selectedDateRange, setSelectedDateRange] = useState<DateRange>(
        (localStorage.getItem('dashboard_selected_date_range') as DateRange) || 'all'
    );
    // Custom date range (when user picks specific start/end)
    const [isCustomRange, setIsCustomRange] = useState(false);
    const [customStartDate, setCustomStartDate] = useState<string>(
        localStorage.getItem('dashboard_custom_start') || ''
    );
    const [customEndDate, setCustomEndDate] = useState<string>(
        localStorage.getItem('dashboard_custom_end') || ''
    );
    const [refreshKey, setRefreshKey] = useState(Date.now());

    // Card-specific filter dropdown state
    const [activeCardFilter, setActiveCardFilter] = useState<string | null>(null);
    const cardFilterRef = useRef<HTMLDivElement>(null);
    const escalationRef = useRef<HTMLDivElement>(null);

    // Real data states
    const [stats, setStats] = useState({
        totalLeads: 0,
        totalLeadsTrend: 0,
        totalPipeline: 0,
        totalPipelineTrend: 0,
        wonDeals: 0,
        wonDealsTrend: 0,
        totalWonAmount: 0,
        totalWonPotential: 0,
        conversionRate: 0,
        conversionRateTrend: 0,
        erroneousLeads: 0,
        erroneousLeadsTrend: 0,
    });
    const [funnelData, setFunnelData] = useState<any[]>([]);
    const [sourceData, setSourceData] = useState<any[]>([]);
    const [priorityData, setPriorityData] = useState<any[]>([]);
    const [upcomingFollowUps, setUpcomingFollowUps] = useState<any[]>([]);
    const [recentConversions, setRecentConversions] = useState<any[]>([]);
    const [topOpportunities, setTopOpportunities] = useState<any[]>([]);
    const [lossReasonData, setLossReasonData] = useState<any[]>([]);
    const [lossStageData, setLossStageData] = useState<any[]>([]);
    const [industryData, setIndustryData] = useState<{ name: string; count: number; percentage: number }[]>([]);
    const [salesTrendData, setSalesTrendData] = useState<any[]>([]);
    const [escalationLeads, setEscalationLeads] = useState<any[]>([]);
    const [showEscalation, setShowEscalation] = useState<boolean | 'expanded'>(true);
    const [hotLeads, setHotLeads] = useState<any[]>([]);
    const [financeResumen, setFinanceResumen] = useState<{
        ventaTotal: number;
        totalCobrado: number;
        totalPendiente: number;
        cotizacionesActivas: number;
    } | null>(null);
    const [isFinanceLoading, setIsFinanceLoading] = useState(true);

    // States for AI Cognitive Capsule
    const [selectedAiLead, setSelectedAiLead] = useState<{ id: string; name: string } | null>(null);
    const [aiMemoryData, setAiMemoryData] = useState<any | null>(null);
    const [isLoadingAiMemory, setIsLoadingAiMemory] = useState(false);

    const handleViewAiMemory = async (leadId: string, leadName: string) => {
        setSelectedAiLead({ id: leadId, name: leadName });
        setIsLoadingAiMemory(true);
        try {
            const { data, error } = await supabase
                .from('lead_ai_memory')
                .select('*')
                .eq('lead_id', leadId)
                .maybeSingle();
            
            if (error) throw error;
            setAiMemoryData(data || null);
        } catch (e) {
            logger.error('Error fetching lead AI memory', e);
            toast.error('No se pudo cargar la memoria de la IA');
        } finally {
            setIsLoadingAiMemory(false);
        }
    };

    useEffect(() => {
        if (profile?.company_id) {
            setIsFinanceLoading(true);
            pagosService.getResumen(profile.company_id)
                .then(res => {
                    setFinanceResumen(res);
                })
                .catch(err => {
                    logger.error('Error fetching finance summary', err);
                })
                .finally(() => {
                    setIsFinanceLoading(false);
                });
        }
    }, [profile?.company_id, refreshKey]);

    const navigate = useNavigate();

    // Super Admin states
    const [adminStats, setAdminStats] = useState({
        totalCompanies: 0,
        activeTrials: 0,
        activeLicenses: 0
    });
    const [recentCompanies, setRecentCompanies] = useState<any[]>([]);
    const [companyTrend, setCompanyTrend] = useState<any[]>([]);

    // Collaborator filter (admin only — ver perspectiva de un agente)
    const [companyProfiles, setCompanyProfiles] = useState<{ id: string; full_name: string; role: string; avatar_url?: string | null }[]>([]);
    const [selectedCollabId, setSelectedCollabId] = useState<string | undefined>(undefined);
    const [selectedCollabName, setSelectedCollabName] = useState<string | null>(null);
    const [isCollabOpen, setIsCollabOpen] = useState(false);
    const collabFilterRef = useRef<HTMLDivElement>(null);

    // Detectar móvil/tableta
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Persist date range selection
    useEffect(() => {
        localStorage.setItem('dashboard_selected_date_range', selectedDateRange);
    }, [selectedDateRange]);

    // React Query handles caching — no forced refresh needed on navigation
    // The "Sincronizar" button is available for manual refresh via setRefreshKey

    // Calculate date range labels for the UI
    const getDateRangeLabelDisplay = (range: DateRange) => {
        const now = new Date();
        let start: Date | null = null;
        let end: Date | null = null;

        switch (range) {
            case 'today':
                start = startOfToday();
                end = endOfToday();
                break;
            case 'this_week':
                start = startOfWeek(now, { weekStartsOn: 1 });
                end = endOfWeek(now, { weekStartsOn: 1 });
                break;
            case 'this_month':
                start = startOfMonth(now);
                end = endOfToday();
                break;
            case 'last_3_months':
                start = startOfMonth(subMonths(now, 2));
                end = endOfToday();
                break;
            case 'last_6_months':
                start = startOfMonth(subMonths(now, 5));
                end = endOfToday();
                break;
            case 'this_year':
                start = startOfYear(now);
                end = endOfToday();
                break;
            default:
                return '';
        }

        if (start && end) {
            if (range === 'today') {
                return `(${format(start, 'dd/MM')})`;
            }
            return `(${format(start, 'dd/MM')} - ${format(end, 'dd/MM')})`;
        }
        return '';
    };

    // Calculate date range based on selected filter
    const dateRange = useMemo(() => {
        const now = new Date();
        let startDate: string | undefined;
        let endDate: string | undefined;

        switch (selectedDateRange) {
            case 'today':
                startDate = startOfToday().toISOString();
                endDate = endOfToday().toISOString();
                break;
            case 'this_week':
                startDate = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
                endDate = endOfWeek(now, { weekStartsOn: 1 }).toISOString();
                break;
            case 'this_month':
                startDate = startOfMonth(now).toISOString();
                endDate = endOfToday().toISOString(); // End of today is better for "this month"
                break;
            case 'last_3_months':
                startDate = startOfMonth(subMonths(now, 2)).toISOString();
                endDate = endOfToday().toISOString();
                break;
            case 'last_6_months':
                startDate = startOfMonth(subMonths(now, 5)).toISOString();
                endDate = endOfToday().toISOString();
                break;
            case 'this_year':
                startDate = startOfYear(now).toISOString();
                endDate = endOfToday().toISOString();
                break;
                break;
            case 'all':
                startDate = undefined;
                endDate = undefined;
                break;
        }

        // Custom range overrides preset selection
        if (isCustomRange && customStartDate && customEndDate) {
            return {
                startDate: new Date(customStartDate + 'T00:00:00').toISOString(),
                endDate: new Date(customEndDate + 'T23:59:59').toISOString(),
            };
        }

        return { startDate, endDate };
    }, [selectedDateRange, isCustomRange, customStartDate, customEndDate]);


    // 🔒 Role-based dashboard: collaborators without dashboard_view_company only see their own stats
    const isAdmin = profile?.role === 'super_admin' || profile?.role === 'company_admin';
    const canViewCompanyDashboard = isAdmin || (profile?.permissions?.['dashboard_view_company'] === true);
    const canViewFinancials = isAdmin || (profile?.permissions?.['view_financials'] === true);
    // Admin: puede ver perspectiva de un colaborador específico; Agent: siempre ve lo suyo
    const dashboardAssignedTo = canViewCompanyDashboard ? selectedCollabId : profile?.id;
    const isViewingOwnData = !dashboardAssignedTo || dashboardAssignedTo === profile?.id;
    const canViewActiveFinancials = canViewFinancials || isViewingOwnData;
    const averageTicket = stats.wonDeals > 0 ? Math.round((stats.totalWonAmount || stats.totalWonPotential || 0) / stats.wonDeals) : 0;

    // Use optimized dashboard hook (replaces 5 queries with 1)
    const { data: dashboardData, isLoading: isDashboardLoading, error: dashboardError, refetch } = useDashboardStats(
        profile?.company_id,
        dateRange.startDate,
        dateRange.endDate,
        dashboardAssignedTo
    );

    // Process dashboard data when it arrives
    useEffect(() => {
        if (dashboardData) {
            // Set stats - fall back totalWonAmount if 0 (e.g. when closing_amount is not set or RPC schema is older)
            const adjustedStats = { ...dashboardData.stats };
            if ((adjustedStats.totalWonAmount === 0 || !adjustedStats.totalWonAmount) && adjustedStats.wonDeals > 0) {
                const conversions = dashboardData.recentConversions || [];
                const computedTotal = conversions.reduce((sum: number, l: any) => sum + (l.closing_amount || l.value || 0), 0);
                if (computedTotal > 0) {
                    adjustedStats.totalWonAmount = computedTotal;
                } else if (adjustedStats.totalWonPotential > 0) {
                    adjustedStats.totalWonAmount = adjustedStats.totalWonPotential;
                }
            }
            setStats(adjustedStats);

            // Map funnel data with labels — normalize Unicode keys to NFC for consistent matching
            const mappedFunnelData = dashboardData.byStatus.map((item: any) => {
                const normalizedName = (item.name || '').normalize('NFC');
                const config = STATUS_CONFIG[normalizedName as keyof typeof STATUS_CONFIG];
                return {
                    key: normalizedName,
                    name: config?.label || normalizedName,
                    value: item.value,
                    amount: item.amount || 0
                };
            });
            setFunnelData(mappedFunnelData);

            // Calculate source percentages and sort by value DESC
            const sDataRaw = dashboardData.bySource || [];
            const total = sDataRaw.reduce((sum: number, s: any) => sum + s.value, 0);
            const mappedSources = sDataRaw.map((s: any) => ({
                key: s.name,
                name: SOURCE_CONFIG[s.name as keyof typeof SOURCE_CONFIG]?.label || s.name,
                icon: SOURCE_CONFIG[s.name as keyof typeof SOURCE_CONFIG]?.icon || 'ðŸ“Š',
                value: total > 0 ? Math.round((s.value / total) * 100) : 0,
                count: s.value
            })).sort((a: any, b: any) => b.count - a.count);
            setSourceData(mappedSources);

            // Set top opportunities
            setTopOpportunities(dashboardData.topOpportunities || []);

            // Set upcoming follow-ups
            // Set upcoming follow-ups with dynamic phone/email fetching to enable WhatsApp and dynamic AI quick-actions
            const followups = dashboardData.upcomingFollowUps || [];
            if (followups.length > 0 && profile?.company_id) {
                const leadIds = followups.map((f: any) => f.id);
                supabase
                    .from('leads')
                    .select('id, phone, email')
                    .in('id', leadIds)
                    .then(({ data: leadContactData }) => {
                        if (leadContactData) {
                            const mappedFollowups = followups.map((f: any) => {
                                const contact = leadContactData.find((c: any) => c.id === f.id);
                                return {
                                    ...f,
                                    phone: contact?.phone || '',
                                    email: contact?.email || ''
                                };
                            });
                            setUpcomingFollowUps(mappedFollowups);
                        } else {
                            setUpcomingFollowUps(followups);
                        }
                    });
            } else {
                setUpcomingFollowUps(followups);
            }

            // Set recent conversions
            setRecentConversions(dashboardData.recentConversions || []);

            // Map priority data with labels
            setPriorityData(dashboardData.byPriority.map((p: any) => ({
                name: (PRIORITY_CONFIG as any)[p.name]?.label || p.name,
                value: p.value,
                key: p.name
            })).sort((a: any, b: any) => {
                const order = ['very_high', 'high', 'medium', 'low'];
                return order.indexOf(a.key) - order.indexOf(b.key);
            }));

            // Set loss analytics
            setLossReasonData(dashboardData.lossReasons || []);
            setLossStageData(dashboardData.lossStages || []);
            setSalesTrendData(dashboardData.salesTrend || []);

            // Fetch industry distribution
            const industryQuery = supabase
                .from('leads')
                .select('industry')
                .not('industry', 'is', null)
                .neq('industry', '');
            if (dashboardAssignedTo) industryQuery.eq('assigned_to', dashboardAssignedTo);
            industryQuery.then(({ data: leadsWithIndustry }) => {
                    if (leadsWithIndustry && leadsWithIndustry.length > 0) {
                        const counts: Record<string, number> = {};
                        leadsWithIndustry.forEach((l: any) => {
                            counts[l.industry] = (counts[l.industry] || 0) + 1;
                        });
                        const total = leadsWithIndustry.length;
                        const mapped = Object.entries(counts)
                            .map(([name, count]) => ({
                                name,
                                count,
                                percentage: Math.round((count / total) * 100)
                            }))
                            .sort((a, b) => b.count - a.count);
                        setIndustryData(mapped);
                    }
                });

        }

        // Load escalation leads (Llamada fría with 6+ contact attempts)
        const escalationQuery = supabase
            .from('leads')
            .select('id, name, company_name, phone, email, contact_count, created_at, assigned_to')
            .eq('status', 'Llamada fría')
            .gte('contact_count', 6)
            .order('contact_count', { ascending: false })
            .limit(10);
        if (dashboardAssignedTo) escalationQuery.eq('assigned_to', dashboardAssignedTo);
        escalationQuery.then(({ data }) => {
                setEscalationLeads(data || []);
            });

        // 🔥 Load hot leads (cierre_inminente) for dashboard card
        if (profile?.company_id) {
            const hotQuery = supabase
                .from('lead_ai_memory')
                .select('lead_id, sentiment_score, leads!inner(id, name, company_name, phone, assigned_to)')
                .eq('company_id', profile.company_id)
                .eq('next_action', 'cierre_inminente');
            if (dashboardAssignedTo) {
                hotQuery.eq('leads.assigned_to', dashboardAssignedTo);
            }
            hotQuery.limit(5)
                .then(({ data }) => {
                    setHotLeads((data || []).map((m: any) => ({
                        id: m.lead_id,
                        name: m.leads?.name,
                        company_name: m.leads?.company_name,
                        phone: m.leads?.phone,
                        sentiment_score: m.sentiment_score,
                    })));
                });
        }
    }, [dashboardData, dashboardAssignedTo]);

    useEffect(() => {
        if (profile?.role === 'super_admin') {
            loadSuperAdminData();
        }
    }, [profile, refreshKey]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setIsFilterOpen(false);
            }
            if (cardFilterRef.current && !cardFilterRef.current.contains(event.target as Node)) {
                setActiveCardFilter(null);
            }
            if (escalationRef.current && !escalationRef.current.contains(event.target as Node)) {
                setShowEscalation(prev => prev === 'expanded' ? true : prev);
            }
            if (collabFilterRef.current && !collabFilterRef.current.contains(event.target as Node)) {
                setIsCollabOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Cargar perfiles de la empresa para el filtro de responsable (solo admins)
    useEffect(() => {
        const adminCheck = profile?.role === 'super_admin' || profile?.role === 'company_admin';
        if (!adminCheck || !profile?.company_id) return;
        supabase
            .from('profiles')
            .select('id, full_name, role, avatar_url')
            .eq('company_id', profile.company_id)
            .eq('is_active', true)
            .order('full_name')
            .then(({ data }) => {
                if (data) setCompanyProfiles(data);
            });
    }, [profile?.company_id, profile?.role]);

    const loadSuperAdminData = async () => {
        try {
            const companies = await adminService.getCompanies();
            const totalCompanies = companies.length;
            const activeTrials = companies.filter(c => c.license_status === 'trial').length || 0;
            const activeLicenses = companies.filter(c => c.license_status === 'active').length || 0;

            setAdminStats({ totalCompanies, activeTrials, activeLicenses });
            setRecentCompanies(companies.slice(0, 8));

            setCompanyTrend([
                { name: 'Ene', value: Math.max(1, totalCompanies - 5) },
                { name: 'Feb', value: Math.max(1, totalCompanies - 4) },
                { name: 'Mar', value: Math.max(1, totalCompanies - 3) },
                { name: 'Abr', value: Math.max(1, totalCompanies - 2) },
                { name: 'May', value: Math.max(1, totalCompanies - 1) },
                { name: 'Jun', value: totalCompanies },
            ]);
        } catch (error) {
            logger.error('Failed to load admin data', error, { action: 'loadSuperAdminData' });
        }
    };

    // Only show full page loader on initial load (when no data exists yet)
    if (isDashboardLoading && !dashboardData) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <div className="flex flex-col items-center gap-6">
                    <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin shadow-lg"></div>
                    <div className="text-center">
                        <p className="text-slate-900 font-black text-xs uppercase tracking-[0.3em] mb-1">Optimizando Métricas</p>
                        <p className="text-slate-400 font-medium text-[10px] animate-pulse">Cargando inteligencia de negocio...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (dashboardError) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <div className="text-center max-w-sm px-6 py-10 bg-white rounded-[2.5rem] shadow-xl border border-red-50">
                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <XAxis className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">Error de Conexión</h3>
                    <p className="text-slate-500 text-sm mb-8 leading-relaxed">Hubo un problema al sincronizar tus datos. Por favor, intenta de nuevo.</p>
                    <Button onClick={() => setRefreshKey(Date.now())} className="h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-black px-10 rounded-2xl shadow-xl shadow-indigo-600/20 transition-all">
                        Reintentar Sincronización
                    </Button>
                </div>
            </div>
        );
    }





    const FilterDropdown = () => (
        <div className="relative" ref={filterRef}>
            <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`flex items-center gap-2 border px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm ${isCustomRange && customStartDate && customEndDate ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-100 text-[#4449AA] hover:bg-gray-50'}`}
            >
                <Calendar className={`h-4 w-4 ${isCustomRange && customStartDate ? 'text-white' : 'text-[#007BFF]'}`} />
                <span>
                    {isCustomRange && customStartDate && customEndDate
                        ? `${customStartDate} → ${customEndDate}`
                        : DATE_RANGE_OPTIONS[selectedDateRange].label}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${isFilterOpen ? 'rotate-180' : ''} ${isCustomRange ? 'text-white/70' : 'text-gray-400'}`} />
            </button>

            {isFilterOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-indigo-50 z-50 py-2 animate-in fade-in slide-in-from-top-2">
                    {/* Preset options */}
                    {(Object.entries(DATE_RANGE_OPTIONS) as [DateRange, { label: string }][]).map(([key, option]) => (
                        <button
                            key={key}
                            onClick={() => {
                                setSelectedDateRange(key);
                                setIsCustomRange(false);
                                setIsFilterOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2 text-[11px] transition-colors flex items-center justify-between ${!isCustomRange && selectedDateRange === key
                                ? 'bg-indigo-50 text-indigo-600 font-black'
                                : 'text-slate-600 font-bold hover:bg-gray-50'
                                }`}
                        >
                            <span className="flex items-center gap-2">
                                {option.label}
                                <span className="text-[9px] opacity-30 font-medium">{getDateRangeLabelDisplay(key)}</span>
                            </span>
                            {!isCustomRange && selectedDateRange === key && <CheckCircle className="w-4 h-4 text-indigo-600" />}
                        </button>
                    ))}

                    {/* Custom range section */}
                    <div className="border-t border-gray-100 mt-1 pt-2 px-3 pb-2">
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-1.5 ${isCustomRange ? 'text-indigo-600' : 'text-gray-400'}`}>
                            <Calendar className="w-3 h-3" /> Rango personalizado
                            {isCustomRange && <CheckCircle className="w-3 h-3 ml-auto text-indigo-600" />}
                        </p>
                        <div className="space-y-1.5">
                            <div>
                                <p className="text-[9px] text-gray-400 font-bold mb-0.5">Desde</p>
                                <input
                                    type="date"
                                    value={customStartDate}
                                    max={customEndDate || undefined}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setCustomStartDate(val);
                                        localStorage.setItem('dashboard_custom_start', val);
                                        if (val && customEndDate) setIsCustomRange(true);
                                    }}
                                    className="w-full text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-700"
                                />
                            </div>
                            <div>
                                <p className="text-[9px] text-gray-400 font-bold mb-0.5">Hasta</p>
                                <input
                                    type="date"
                                    value={customEndDate}
                                    min={customStartDate || undefined}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setCustomEndDate(val);
                                        localStorage.setItem('dashboard_custom_end', val);
                                        if (customStartDate && val) setIsCustomRange(true);
                                    }}
                                    className="w-full text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-700"
                                />
                            </div>
                            {customStartDate && customEndDate && (
                                <button
                                    onClick={() => {
                                        setIsCustomRange(true);
                                        setIsFilterOpen(false);
                                    }}
                                    className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black transition-all"
                                >
                                    Aplicar rango
                                </button>
                            )}
                            {isCustomRange && (
                                <button
                                    onClick={() => {
                                        setIsCustomRange(false);
                                        setCustomStartDate('');
                                        setCustomEndDate('');
                                        localStorage.removeItem('dashboard_custom_start');
                                        localStorage.removeItem('dashboard_custom_end');
                                        setIsFilterOpen(false);
                                    }}
                                    className="w-full py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 text-[10px] font-bold transition-all"
                                >
                                    Limpiar rango
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );


    // Si estamos en móvil o tableta y en la ruta raíz (/), mostrar el menú de accesos rápidos por defecto como Home
    if (isMobile && location.pathname === '/') {
        return (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[calc(100vh-160px)]">
                <MobileQuickActions
                    isHome
                    hideFAB
                    onCreateLead={() => navigate('/leads', { state: { openCreateModal: true } })}
                />
            </div>
        );
    }

    // Leemos directamente de localStorage para máxima reactividad
    const localSimRole = localStorage.getItem('simulated_role');

    // Si somos super_admin, comprobamos si hay una simulación de administrador de empresa activa
    const isActuallySimulatingAdmin = profile?.role === 'company_admin' || localSimRole === 'company_admin';

    // CRITICAL OVERRIDE: Si estamos en modo simulación de empresa, SALTAMOS la vista de Super Admin
    if (profile?.role === 'super_admin' && !isActuallySimulatingAdmin) {
        return (
            <div className="space-y-6 pb-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-extrabold text-[#4449AA]">{t('dashboard.superAdmin.title')}</h2>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {[
                        { name: t('dashboard.superAdmin.totalCompanies'), value: adminStats.totalCompanies, icon: Building, color: 'text-[#007BFF]', bg: 'bg-blue-50', status: 'all' },
                        { name: t('dashboard.superAdmin.activeTrials'), value: adminStats.activeTrials, icon: Calendar, color: 'text-[#FFA500]', bg: 'bg-orange-50', status: 'trial' },
                        { name: t('dashboard.superAdmin.activeLicenses'), value: adminStats.activeLicenses, icon: CheckCircle, color: 'text-[#3DCC91]', bg: 'bg-green-50', status: 'active' },
                    ].map((item) => (
                        <div
                            key={item.name}
                            onClick={() => navigate('/admin/companies', { state: { status: item.status } })}
                            className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm border border-gray-50 hover:shadow-md transition-all duration-300 cursor-pointer"
                        >
                            <div className={`p-3 rounded-xl ${item.bg} w-fit mb-3 transition-transform group-hover:scale-110`}>
                                <item.icon className={`h-6 w-6 ${item.color}`} />
                            </div>
                            <dt className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.name}</dt>
                            <dd className="mt-1 text-2xl font-extrabold text-[#4449AA]">{item.value}</dd>
                        </div>
                    ))}
                </div>

                {/* Main Content Area */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Growth Chart */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50">
                        <h3 className="text-lg font-bold text-[#4449AA] mb-4">{t('dashboard.superAdmin.companyGrowthTitle')}</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={companyTrend}>
                                    <defs>
                                        <linearGradient id="colorAdmin" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#007BFF" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#007BFF" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F5F7FA" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Area type="monotone" dataKey="value" stroke="#007BFF" strokeWidth={3} fill="url(#colorAdmin)" dot={{ fill: '#007BFF', strokeWidth: 1, r: 3 }} activeDot={{ r: 5 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Recent Companies */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden">
                        <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-[#4449AA]">{t('dashboard.superAdmin.recentCompaniesTitle')}</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead className="bg-[#F5F7FA]">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('dashboard.superAdmin.columnName')}</th>
                                        <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Plan</th>
                                        <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {recentCompanies.map((comp) => (
                                        <tr
                                            key={comp.id}
                                            onClick={() => navigate('/admin/companies', { state: { editCompanyId: comp.id } })}
                                            className="hover:bg-gray-50 transition-colors cursor-pointer group/row"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="text-xs font-bold text-[#4449AA] group-hover/row:text-indigo-600 transition-colors">{comp.name}</div>
                                                <div className="text-[9px] text-gray-400">{comp.user_count || 0} usuarios</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-full ${comp.license_status === 'active' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'
                                                    }`}>
                                                    {comp.license_status || 'trial'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="text-[#007BFF] hover:bg-blue-50 p-1.5 rounded-lg transition-all opacity-0 group-hover/row:opacity-100">
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>


            </div>
        );
    }

    // CRM DASHBOARD VIEW
    return (
        <div className="w-full max-w-[1580px] mx-auto pb-4 space-y-3 animate-in fade-in duration-700">

            {/* 💰 HOT LEADS — Cierres Inminentes Banner */}
            {hotLeads.length > 0 && (
                <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 rounded-2xl p-5 shadow-xl shadow-emerald-500/20 border border-emerald-400 animate-in fade-in slide-in-from-top-2 duration-500">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl shrink-0 animate-bounce">
                                💰
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white flex items-center gap-2">
                                    {hotLeads.length} Lead{hotLeads.length > 1 ? 's' : ''} listo{hotLeads.length > 1 ? 's' : ''} para cerrar
                                    <span className="text-[10px] bg-white/20 text-white font-black px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">ACCIÓN INMEDIATA</span>
                                </h3>
                                <p className="text-emerald-50 text-xs font-medium mt-0.5">El bot detectó intención de compra confirmada. Contáctalos ahora para enviar factura o link de pago.</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {hotLeads.slice(0, 3).map(lead => (
                                <button
                                    key={lead.id}
                                    onClick={() => navigate('/leads', { state: { leadId: lead.id } })}
                                    className="flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/20 rounded-xl px-3 py-1.5 transition-all"
                                >
                                    <div className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center text-[10px] font-black text-white shrink-0">
                                        {lead.name?.[0] || '?'}
                                    </div>
                                    <span className="text-white text-[11px] font-bold truncate max-w-[100px]">{lead.name}</span>
                                </button>
                            ))}
                            <button
                                onClick={() => navigate('/marketing/cockpit')}
                                className="px-4 py-1.5 bg-white text-emerald-700 rounded-xl text-[11px] font-black shadow-md hover:bg-emerald-50 transition-all shrink-0"
                            >
                                Ver Todos →
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-extrabold text-[#4449AA] leading-tight tracking-tight">{t('dashboard.crm.title')}</h2>
                    <p className="text-[13px] text-gray-400 font-medium font-inter transition-all">Análisis de rendimiento y prospección en tiempo real</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Escalation Pill Notification */}
                    {escalationLeads.length > 0 && (
                        <div className="relative" ref={escalationRef}>
                            <button
                                onClick={() => setShowEscalation(prev => prev === 'expanded' ? true : 'expanded')}
                                className={`flex items-center gap-2 h-10 px-4 rounded-xl border transition-all text-xs font-black ${showEscalation === 'expanded'
                                    ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-200'
                                    : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100 hover:border-red-300'
                                    }`}
                            >
                                <PhoneOff className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Escalación</span>
                                <span className="bg-white/20 backdrop-blur-sm text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                                    {escalationLeads.length}
                                </span>
                            </button>

                            {/* Floating Dropdown Panel */}
                            {showEscalation === 'expanded' && (
                                <div className="absolute right-0 top-full mt-2 w-[380px] bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="bg-gradient-to-r from-red-500 to-orange-500 px-4 py-3">
                                        <p className="text-white font-black text-xs">⚠️ Leads que requieren escalación</p>
                                        <p className="text-white/60 text-[9px] font-bold">6+ intentos de contacto sin respuesta</p>
                                    </div>
                                    <div className="max-h-[280px] overflow-y-auto divide-y divide-gray-50">
                                        {escalationLeads.slice(0, 8).map((lead) => {
                                            const daysSince = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 86400000);
                                            return (
                                                <div
                                                    key={lead.id}
                                                    className="px-4 py-2.5 flex items-center justify-between hover:bg-red-50/40 transition-colors cursor-pointer group/row"
                                                    onClick={() => { setShowEscalation(true); navigate('/leads', { state: { leadId: lead.id } }); }}
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-bold text-gray-900 truncate group-hover/row:text-red-600 transition-colors">{lead.name}</p>
                                                        <p className="text-[10px] text-gray-400 font-medium truncate">{lead.company_name || lead.phone || 'Sin datos'}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0 ml-3">
                                                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${(lead.contact_count || 0) >= 10 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                                                            }`}>
                                                            📞{lead.contact_count}
                                                        </span>
                                                        <span className="text-[9px] font-bold text-gray-300">{daysSince}d</span>
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                await supabase.from('leads').update({ status: 'En Nutrición' }).eq('id', lead.id);
                                                                setEscalationLeads(prev => prev.filter(l => l.id !== lead.id));
                                                                toast.success(`${lead.name} → Nutrición`);
                                                            }}
                                                            className="flex items-center gap-1 bg-teal-50 hover:bg-teal-100 text-teal-700 text-[9px] font-black px-2 py-1 rounded-lg transition-all border border-teal-200"
                                                            title="Mover a En Nutrición"
                                                        >
                                                            <Sprout className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
                                        <button
                                            onClick={() => { setShowEscalation(true); navigate('/leads', { state: { status: 'Llamada fría', minContactCount: 6 } }); }}
                                            className="w-full flex items-center justify-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all"
                                        >
                                            Ver todos en Leads
                                            <ArrowRight className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Responsable Filter — solo admins, igual que en Leads */}
                    {isAdmin && (
                        <div className="relative" ref={collabFilterRef}>
                            <button
                                onClick={() => setIsCollabOpen(!isCollabOpen)}
                                className={`flex items-center gap-1.5 h-10 px-4 rounded-xl border text-xs font-bold transition-all ${
                                    selectedCollabId
                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200'
                                        : 'bg-white border-gray-100 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50'
                                }`}
                            >
                                <Users className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline max-w-[100px] truncate">
                                    {selectedCollabName || 'Responsable'}
                                </span>
                                <ChevronDown className={`w-3 h-3 transition-transform ${isCollabOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isCollabOpen && (
                                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-2xl border border-indigo-50 z-50 py-2 animate-in fade-in slide-in-from-top-2">
                                    {/* Todos los responsables */}
                                    <button
                                        onClick={() => {
                                            setSelectedCollabId(undefined);
                                            setSelectedCollabName(null);
                                            setIsCollabOpen(false);
                                        }}
                                        className={`w-full text-left px-4 py-2 text-[11px] flex items-center gap-2 transition-colors ${
                                            !selectedCollabId
                                                ? 'bg-indigo-50 text-indigo-600 font-black'
                                                : 'text-slate-600 font-bold hover:bg-gray-50'
                                        }`}
                                    >
                                        <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                            <Users className="w-3 h-3 text-slate-400" />
                                        </div>
                                        Todos los responsables
                                        {!selectedCollabId && <CheckCircle className="w-3 h-3 ml-auto shrink-0 text-indigo-600" />}
                                    </button>

                                    {/* Lista de colaboradores */}
                                    {companyProfiles.map(member => (
                                        <button
                                            key={member.id}
                                            onClick={() => {
                                                setSelectedCollabId(member.id);
                                                setSelectedCollabName(member.full_name);
                                                setIsCollabOpen(false);
                                            }}
                                            className={`w-full text-left px-4 py-2 text-[11px] flex items-center gap-2 transition-colors ${
                                                selectedCollabId === member.id
                                                    ? 'bg-indigo-50 text-indigo-600 font-black'
                                                    : 'text-slate-600 font-bold hover:bg-gray-50'
                                            }`}
                                        >
                                            <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[9px] font-black text-indigo-600 shrink-0">
                                                {member.full_name.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="truncate flex-1">{member.full_name}</span>
                                            {selectedCollabId === member.id && (
                                                <CheckCircle className="w-3 h-3 shrink-0 text-indigo-600" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <Button
                        onClick={() => setRefreshKey(Date.now())}
                        variant="outline"
                        size="sm"
                        className="h-10 px-4 rounded-xl border-gray-100 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all font-bold text-xs uppercase tracking-widest gap-2"
                    >
                        <TrendingUp className="w-3.5 h-3.5" />
                        Sincronizar
                    </Button>
                    <FilterDropdown />
                </div>
            </div>

            {/* KPI Cards - Global Standard */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                    {
                        name: t('dashboard.crm.wonDeals'),
                        value: stats.wonDeals,
                        secondaryValue: canViewFinancials ? `| $${(stats.totalWonAmount || 0).toLocaleString()}` : '',
                        icon: Target,
                        color: 'text-emerald-600',
                        bg: 'bg-emerald-50/50',
                        trend: `${stats.wonDealsTrend > 0 ? '+' : ''}${stats.wonDealsTrend}%`,
                        trendColor: stats.wonDealsTrend >= 0 ? 'text-emerald-500' : 'text-rose-500',
                        onClick: () => navigate('/leads', { state: { status: ['Cerrado', 'Cliente'] } })
                    },
                    {
                        name: t('dashboard.crm.totalPipeline'),
                        value: canViewFinancials ? `$${stats.totalPipeline.toLocaleString()}` : '$ •••',
                        icon: BadgeDollarSign,
                        color: 'text-indigo-600',
                        bg: 'bg-indigo-50/50',
                        trend: `${stats.totalPipelineTrend > 0 ? '+' : ''}${stats.totalPipelineTrend}%`,
                        trendColor: stats.totalPipelineTrend >= 0 ? 'text-emerald-500' : 'text-rose-500',
                        onClick: () => navigate('/cotizaciones', { state: { startDate: dateRange.startDate, endDate: dateRange.endDate } })
                    },
                    {
                        name: t('dashboard.crm.conversionRate'),
                        value: `${stats.conversionRate || 0}%`,
                        icon: TrendingUp,
                        color: 'text-amber-600',
                        bg: 'bg-amber-50/50',
                        trend: `${stats.conversionRateTrend > 0 ? '+' : ''}${stats.conversionRateTrend}%`,
                        trendColor: stats.conversionRateTrend >= 0 ? 'text-emerald-500' : 'text-rose-500',
                        onClick: () => navigate('/leads', { state: { status: ['Cerrado', 'Cliente'] } })
                    },
                    {
                        name: t('dashboard.crm.totalLeads'),
                        value: stats.totalLeads,
                        icon: Users,
                        color: 'text-blue-600',
                        bg: 'bg-blue-50/50',
                        trend: `${stats.totalLeadsTrend > 0 ? '+' : ''}${stats.totalLeadsTrend}%`,
                        trendColor: stats.totalLeadsTrend >= 0 ? 'text-emerald-500' : 'text-rose-500',
                        onClick: () => navigate('/leads', { state: { startDate: dateRange.startDate, endDate: dateRange.endDate } })
                    },
                    {
                        name: t('dashboard.crm.erroneousLeads'),
                        value: stats.erroneousLeads || 0,
                        icon: AlertTriangle,
                        color: 'text-rose-400',
                        bg: 'bg-rose-500/10',
                        trend: `${stats.erroneousLeadsTrend > 0 ? '+' : ''}${stats.erroneousLeadsTrend}%`,
                        trendColor: stats.erroneousLeadsTrend <= 0 ? 'text-emerald-500' : 'text-rose-500', // Inverse for errors
                        onClick: () => navigate('/leads', { state: { status: 'Erróneo' } })
                    },
                ].map((item) => {
                    return (
                        <div
                            key={item.name}
                            onClick={item.onClick}
                            className={`group relative rounded-2xl p-4 shadow-[0_2px_15px_rgb(0,0,0,0.03)] border transition-all duration-500 hover:-translate-y-1 cursor-pointer ${activeCardFilter === item.name ? 'z-[101]' : 'z-10'} bg-white border-slate-200/60`}
                        >
                            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                                <div className={`absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-slate-50`}></div>
                            </div>
                            <div className="flex flex-col h-full relative z-10">
                                <div className="flex justify-between items-start mb-3">
                                    <div className={`p-2 rounded-xl ${item.bg} transition-transform group-hover:scale-110 shadow-sm shadow-black/5`}>
                                        <item.icon className={`h-4 w-4 ${item.color}`} />
                                    </div>
                                    <div className="relative" ref={activeCardFilter === item.name ? cardFilterRef : null}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveCardFilter(activeCardFilter === item.name ? null : item.name);
                                            }}
                                            className={`p-1.5 rounded-lg transition-all ${activeCardFilter === item.name ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                        >
                                            <Settings className="w-3.5 h-3.5" />
                                        </button>
                                        {activeCardFilter === item.name && (
                                            <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-2xl border border-indigo-50 z-50 py-2 animate-in fade-in slide-in-from-top-2">
                                                {(Object.entries(DATE_RANGE_OPTIONS) as [DateRange, { label: string }][]).map(([key, option]) => (
                                                    <button
                                                        key={key}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedDateRange(key);
                                                            setActiveCardFilter(null);
                                                        }}
                                                        className={`w-full text-left px-4 py-2 text-[11px] transition-colors flex items-center justify-between ${selectedDateRange === key ? 'bg-indigo-50 text-indigo-600 font-black' : 'text-slate-600 font-bold hover:bg-gray-50'}`}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            {option.label}
                                                            <span className="text-[9px] opacity-30 font-medium">{getDateRangeLabelDisplay(key)}</span>
                                                        </span>
                                                        {selectedDateRange === key && <CheckCircle className="w-4 h-4 text-indigo-600" />}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex-grow">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 text-slate-400">{item.name}</h3>
                                    {item.name === t('dashboard.crm.wonDeals') ? (
                                        <div className="space-y-1.5 mt-1">
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-3xl font-black tracking-tighter text-slate-900">{item.value}</span>
                                                <span className="text-[9px] bg-emerald-100/70 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider">Tratos</span>
                                            </div>
                                            <div className="space-y-1 text-[11px] font-bold font-inter text-slate-600 bg-slate-50/70 p-2 rounded-xl border border-slate-100/50">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-400">🎯 Cierre Real:</span>
                                                    {canViewFinancials ? (
                                                        <span className="text-emerald-600 font-black">${(stats.totalWonAmount || 0).toLocaleString()}</span>
                                                    ) : (
                                                        <span className="text-slate-400 font-black">$•••</span>
                                                    )}
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-400">📊 Potencial:</span>
                                                    {canViewFinancials ? (
                                                        <span className="text-indigo-600 font-black">${(stats.totalWonPotential || 0).toLocaleString()}</span>
                                                    ) : (
                                                        <span className="text-slate-400 font-black">$•••</span>
                                                    )}
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-400">🎟️ Ticket Prom:</span>
                                                    {canViewFinancials ? (
                                                        <span className="text-slate-700 font-black">${averageTicket.toLocaleString()}</span>
                                                    ) : (
                                                        <span className="text-slate-400 font-black">$•••</span>
                                                    )}
                                                </div>
                                                {canViewFinancials && stats.totalWonPotential > 0 && (
                                                    <div className="mt-1.5 pt-1.5 border-t border-slate-200/50 flex justify-between items-center text-[9px]">
                                                        <span className="text-slate-400 uppercase tracking-wider text-[8px] font-black">Efectividad:</span>
                                                        {stats.totalWonAmount >= stats.totalWonPotential ? (
                                                            <span className="text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded font-black">
                                                                🚀 +{Math.round(((stats.totalWonAmount - stats.totalWonPotential) / stats.totalWonPotential) * 100)}%
                                                            </span>
                                                        ) : (
                                                            <span className="text-amber-600 bg-amber-50 px-1 py-0.2 rounded font-black">
                                                                📉 {Math.round((stats.totalWonAmount / stats.totalWonPotential) * 100)}%
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-3xl font-black tracking-tighter text-slate-900">{item.value}</span>
                                            {item.secondaryValue && <span className="text-[11px] font-bold text-slate-400">{item.secondaryValue}</span>}
                                        </div>
                                    )}
                                </div>

                                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <div className={`w-1.5 h-1.5 rounded-full ${item.trendColor.replace('text', 'bg')}`} />
                                        <span className={`text-[9px] font-black tracking-widest uppercase ${item.trendColor}`}>
                                            {item.trend}
                                        </span>
                                    </div>
                                    <span className="text-[8px] font-bold text-slate-300">
                                        {getDateRangeLabelDisplay(selectedDateRange) || 'Todo el tiempo'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Main Content Area: Grouped Proportions */}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch relative z-0">

                {/* Row 1: Funnel + Strategic Priority + Sources */}
                <div className={`bg-white p-3 rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-200/60 lg:col-span-5 flex flex-col group hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all duration-500 relative ${activeCardFilter === 'funnel' ? 'z-[50]' : 'z-0'}`}>
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex flex-col">
                            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('dashboard.crm.funnelTitle')}</h3>
                            <p className="text-[10px] text-gray-400 font-medium">Conversión por etapa</p>
                        </div>
                        <div className="bg-indigo-50 px-2 py-0.5 rounded-full text-[8px] font-black text-indigo-600 tracking-wider">KPI</div>
                        <div className="relative" ref={activeCardFilter === 'funnel' ? cardFilterRef : null}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveCardFilter(activeCardFilter === 'funnel' ? null : 'funnel');
                                }}
                                className={`p-1.5 rounded-lg transition-all ${activeCardFilter === 'funnel' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-300 hover:text-indigo-600 hover:bg-indigo-50'}`}
                            >
                                <Settings className="w-3.5 h-3.5" />
                            </button>
                            {activeCardFilter === 'funnel' && (
                                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-2xl border border-indigo-50 z-[51] py-2 animate-in fade-in slide-in-from-top-2 overflow-hidden">
                                    {(Object.entries(DATE_RANGE_OPTIONS) as [DateRange, { label: string }][]).map(([key, option]) => (
                                        <button
                                            key={key}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedDateRange(key);
                                                setActiveCardFilter(null);
                                            }}
                                            className={`w-full text-left px-4 py-2 text-[10px] transition-colors flex items-center justify-between ${selectedDateRange === key ? 'bg-indigo-50 text-indigo-600 font-black' : 'text-slate-600 font-bold hover:bg-gray-50'}`}
                                        >
                                            <span className="flex items-center gap-1.5">
                                                {option.label}
                                                <span className="text-[9px] opacity-30 font-medium">{getDateRangeLabelDisplay(key)}</span>
                                            </span>
                                            {selectedDateRange === key && <CheckCircle className="w-2.5 h-2.5 text-indigo-600" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex-grow flex items-center justify-center">
                        <FunnelInfographic
                            data={funnelData}
                            onStageClick={(status) => navigate('/leads', { state: { status, startDate: dateRange.startDate, endDate: dateRange.endDate } })}
                            hideClientAmount={!isAdmin}
                            hideAmounts={!canViewActiveFinancials}
                        />
                    </div>
                </div>

                {/* ── ENFOQUE ESTRATÉGICO ── */}
                {(() => {
                    // Calcula etapa con más leads estancados (mayor volumen sin ser Cerrado/Cliente)
                    const STUCK_STAGES = ['Prospecto','Llamada fría','En Nutrición','Lead calificado','En seguimiento','Negociación'];
                    const stuck = funnelData
                        .filter(d => STUCK_STAGES.includes(d.key) && d.value > 0)
                        .sort((a, b) => b.value - a.value);
                    const biggestStuck = stuck[0];

                    // Etapa más cercana al cierre con leads activos
                    const CLOSE_STAGES = ['Negociación','En seguimiento','Lead calificado'];
                    const closestToClose = funnelData
                        .find(d => CLOSE_STAGES.includes(d.key) && d.value > 0);

                    // Potencial desbloqueado si se mueven los leads de la etapa mayor
                    const avgTicket = stats.wonDeals > 0 ? Math.round((stats.totalWonAmount || stats.totalWonPotential || 0) / stats.wonDeals) : 0;
                    const potentialUnlock = biggestStuck ? biggestStuck.value * avgTicket : 0;

                    const focusItems = [
                        biggestStuck && {
                            icon: Flame,
                            color: 'text-rose-500',
                            bg: 'bg-rose-50',
                            label: 'Mayor acumulación',
                            value: biggestStuck.label || biggestStuck.key,
                            sub: `${biggestStuck.value} leads estancados`,
                            action: biggestStuck.key,
                            tooltip: 'La etapa activa que tiene más prospectos acumulados hoy. Representa el cuello de botella más grande de tu equipo.',
                        },
                        closestToClose && {
                            icon: Target,
                            color: 'text-emerald-600',
                            bg: 'bg-emerald-50',
                            label: 'Más cerca del cierre',
                            value: closestToClose.label || closestToClose.key,
                            sub: `${closestToClose.value} lead${closestToClose.value > 1 ? 's' : ''} listo${closestToClose.value > 1 ? 's' : ''}`,
                            action: closestToClose.key,
                            tooltip: 'La etapa más avanzada que contiene leads activos. Estos prospectos están muy cerca de comprar; dales prioridad total hoy.',
                        },
                        avgTicket > 0 && canViewActiveFinancials && {
                            icon: Zap,
                            color: 'text-amber-500',
                            bg: 'bg-amber-50',
                            label: 'Potencial desbloqueado',
                            value: `$${potentialUnlock.toLocaleString()}`,
                            sub: `Si cierras leads de ${biggestStuck?.label || '—'}`,
                            action: biggestStuck?.key || '',
                            tooltip: 'Valor financiero estimado que puedes ganar si cierras todos los prospectos de la etapa con mayor acumulación.',
                        },
                    ].filter(Boolean) as { icon: any; color: string; bg: string; label: string; value: string; sub: string; action: string; tooltip: string }[];

                    return (
                        <div className="bg-white p-3 rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-200/60 lg:col-span-4 flex flex-col group hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all duration-500">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                                        <Crosshair className="w-3.5 h-3.5 text-indigo-400" />
                                        Enfoque Estratégico
                                    </h3>
                                    <p className="text-[10px] text-gray-400 font-medium mt-0.5">Dónde concentrar energía ahora</p>
                                </div>
                                <div className="bg-indigo-50 px-2 py-0.5 rounded-full text-[8px] font-black text-indigo-600 tracking-wider">FOCO</div>
                            </div>

                            {/* Focus items */}
                            {focusItems.length === 0 ? (
                                <div className="flex-grow flex flex-col items-center justify-center py-6 text-center opacity-40">
                                    <CheckCircle className="w-8 h-8 text-emerald-400 mb-2" />
                                    <p className="text-[10px] font-black text-slate-500">Pipeline sin datos aún</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2 flex-grow">
                                    {focusItems.map((item, i) => (
                                        <div
                                            key={i}
                                            onClick={() => item.action && navigate('/leads', { state: { status: item.action } })}
                                            className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50/60 hover:bg-slate-100/80 cursor-pointer transition-all group/item border border-slate-100/80"
                                        >
                                            <div className={`w-8 h-8 rounded-xl ${item.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                                                <item.icon className={`w-4 h-4 ${item.color}`} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{item.label}</p>
                                                    <div className="relative group/tooltip">
                                                        <HelpCircle className="w-2.5 h-2.5 text-slate-300 hover:text-indigo-500 cursor-help transition-colors" />
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block w-48 bg-slate-900 text-white text-[8px] p-2 rounded-lg font-bold leading-normal shadow-xl z-[999] text-center normal-case tracking-normal">
                                                            {item.tooltip}
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-900"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <p className="text-[13px] font-black text-slate-800 leading-tight truncate group-hover/item:text-indigo-600 transition-colors">{item.value}</p>
                                                <p className="text-[9px] text-slate-400 font-medium mt-0.5">{item.sub}</p>
                                            </div>
                                            <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover/item:text-indigo-400 transition-colors shrink-0 mt-1.5" />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Top opportunity CTA */}
                            {topOpportunities.length > 0 && (
                                <div className="mt-3 pt-2.5 border-t border-slate-100">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">🏆 Mejor Oportunidad</p>
                                        <div className="relative group/tooltip">
                                            <HelpCircle className="w-2.5 h-2.5 text-slate-300 hover:text-indigo-500 cursor-help transition-colors" />
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block w-48 bg-slate-900 text-white text-[8px] p-2 rounded-lg font-bold leading-normal shadow-xl z-[999] text-center normal-case tracking-normal">
                                                El lead activo con el valor económico más alto de todo tu pipeline hoy. Tu prioridad VIP del día.
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-900"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div
                                        onClick={() => navigate('/leads', { state: { leadId: topOpportunities[0].id } })}
                                        className="flex items-center gap-2 p-2 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100/60 cursor-pointer hover:border-indigo-200 transition-all"
                                    >
                                        <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center text-white text-[11px] font-black shrink-0">
                                            {(topOpportunities[0].name || '?')[0]}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[11px] font-black text-slate-800 truncate">{topOpportunities[0].name}</p>
                                            {canViewActiveFinancials && topOpportunities[0].value > 0 && (
                                                <p className="text-[9px] font-black text-emerald-600">${topOpportunities[0].value?.toLocaleString()}</p>
                                            )}
                                        </div>
                                        <ArrowRight className="w-3 h-3 text-indigo-400 shrink-0" />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}

                <div className={`bg-white p-3 rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-200/60 lg:col-span-3 flex flex-col group hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all duration-500 relative ${activeCardFilter === 'sources' ? 'z-[50]' : 'z-0'}`}>
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex flex-col">
                            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('dashboard.crm.sourcesTitle')}</h3>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-3xl font-black text-slate-900 tracking-tighter">{stats.totalLeads}</span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prospectos</span>
                            </div>
                        </div>
                        <div className="relative" ref={activeCardFilter === 'sources' ? cardFilterRef : null}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveCardFilter(activeCardFilter === 'sources' ? null : 'sources');
                                }}
                                className={`p-1.5 rounded-lg transition-all ${activeCardFilter === 'sources' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-300 hover:text-indigo-600 hover:bg-indigo-50'}`}
                            >
                                <Settings className="w-3.5 h-3.5" />
                            </button>
                            {activeCardFilter === 'sources' && (
                                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-2xl border border-indigo-50 z-[51] py-2 animate-in fade-in slide-in-from-top-2 overflow-hidden">
                                    {(Object.entries(DATE_RANGE_OPTIONS) as [DateRange, { label: string }][]).map(([key, option]) => (
                                        <button
                                            key={key}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedDateRange(key);
                                                setActiveCardFilter(null);
                                            }}
                                            className={`w-full text-left px-4 py-2 text-[10px] transition-colors flex items-center justify-between ${selectedDateRange === key ? 'bg-indigo-50 text-indigo-600 font-black' : 'text-slate-600 font-bold hover:bg-gray-50'}`}
                                        >
                                            <span className="flex items-center gap-1.5">
                                                {option.label}
                                                <span className="text-[9px] opacity-30 font-medium">{getDateRangeLabelDisplay(key)}</span>
                                            </span>
                                            {selectedDateRange === key && <CheckCircle className="w-2.5 h-2.5 text-indigo-600" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-4 flex-grow">
                        <div className="h-32 w-1/2 relative">
                            {sourceData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={sourceData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={35}
                                            outerRadius={50}
                                            paddingAngle={8}
                                            dataKey="count"
                                            stroke="none"
                                            onClick={(data) => {
                                                if (data && data.key) {
                                                    navigate('/leads', { state: { source: data.key, startDate: dateRange.startDate, endDate: dateRange.endDate } });
                                                }
                                            }}
                                            className="cursor-pointer"
                                        >
                                            {sourceData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-gray-300 font-bold text-[10px]">SIN DATOS</div>
                            )}
                        </div>
                        <div className="flex flex-col gap-3 w-1/2">
                            {sourceData.slice(0, 4).map((entry, index) => (
                                <div
                                    key={index}
                                    onClick={() => navigate('/leads', { state: { source: entry.key, startDate: dateRange.startDate, endDate: dateRange.endDate } })}
                                    className="flex items-start gap-2.5 group/item cursor-pointer hover:bg-slate-50 p-1 rounded-lg transition-all"
                                >
                                    <div
                                        className="w-2.5 h-2.5 rounded-sm mt-1 shrink-0 shadow-sm"
                                        style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                                    />
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="text-xs font-black text-slate-900 leading-none">{entry.value}%</span>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-0.5 truncate group-hover/item:text-indigo-600 transition-colors">{entry.name}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Row 1.5: Sales Trend + Lead Alert KPIs */}
                <div className="lg:col-span-8 bg-white p-4 rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-200/60 flex flex-col group hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all duration-500 relative z-0">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex flex-col">
                            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <TrendingUp className="w-3.5 h-3.5" /> Tendencia de Ventas (Días)
                            </h3>
                            <p className="text-[10px] text-gray-400 font-medium">Volumen de cierres a lo largo del tiempo</p>
                        </div>
                        <div className="bg-emerald-50 px-2 py-0.5 rounded text-[8px] font-black text-emerald-600 tracking-wider">REVENUE</div>
                    </div>
                    <div className="flex-grow w-full h-[220px]">
                        {!canViewActiveFinancials ? (
                            <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-10">
                                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                                    <TrendingUp className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-800 uppercase tracking-wider">Gráfico Confidencial</p>
                                    <p className="text-[10px] text-slate-400 font-medium mt-1 px-4">La tendencia de ingresos solo es visible para administradores o colaboradores con permisos financieros.</p>
                                </div>
                            </div>
                        ) : salesTrendData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={salesTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis 
                                        dataKey="date" 
                                        tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} 
                                        axisLine={false} 
                                        tickLine={false}
                                        tickFormatter={(val) => {
                                            try {
                                                const dateStr = val.includes('T') ? val : `${val}T12:00:00`;
                                                return format(new Date(dateStr), 'dd MMM', { locale: es });
                                            } catch(e) { return val; }
                                        }}
                                    />
                                    <YAxis 
                                        tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} 
                                        axisLine={false} 
                                        tickLine={false}
                                        tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                                    />
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '8px 12px' }}
                                        labelStyle={{ fontSize: '10px', fontWeight: 800, color: '#64748b', marginBottom: '4px' }}
                                        itemStyle={{ fontSize: '12px', fontWeight: 800, color: '#10b981' }}
                                        labelFormatter={(val) => {
                                            try {
                                                const dateStr = val.includes('T') ? val : `${val}T12:00:00`;
                                                return format(new Date(dateStr), 'dd MMM yyyy', { locale: es });
                                            } catch(e) { return val; }
                                        }}
                                        formatter={(value: any) => [`$${value?.toLocaleString() || 0}`, 'Ingresos']}
                                    />
                                    <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-300 font-bold text-[10px] uppercase tracking-widest">Sin datos en este período</div>
                        )}
                    </div>
                </div>

                {/* ── Lead Alert KPIs: 2 stacked cards ── */}
                <div className="lg:col-span-4 flex flex-col gap-3">

                    {/* KPI 1: Seguimientos vencidos */}
                    {(() => {
                        const overdueLeads = upcomingFollowUps.filter((f: any) => {
                            try { return new Date(f.next_followup_date) < new Date(); } catch { return false; }
                        });
                        const urgentCount = overdueLeads.length;
                        return (
                            <div
                                onClick={() => navigate('/leads', { state: { startDate: dateRange.startDate, endDate: dateRange.endDate } })}
                                className="flex-1 bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_15px_rgb(0,0,0,0.03)] p-4 cursor-pointer hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all duration-500 group flex flex-col justify-between min-h-[120px]"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 flex items-center gap-1.5">
                                            <Clock className="w-3 h-3" /> Seguimientos vencidos
                                        </p>
                                        <p className="text-[10px] text-gray-400 font-medium">Pendientes sin atender</p>
                                    </div>
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${ urgentCount > 5 ? 'bg-red-100' : urgentCount > 0 ? 'bg-amber-100' : 'bg-emerald-100' }`}>
                                        <Clock className={`w-4 h-4 ${ urgentCount > 5 ? 'text-red-600' : urgentCount > 0 ? 'text-amber-600' : 'text-emerald-600' }`} />
                                    </div>
                                </div>
                                <div className="mt-3 flex items-end justify-between">
                                    <div className="flex items-baseline gap-2">
                                        <span className={`text-4xl font-black tracking-tighter ${ urgentCount > 5 ? 'text-red-600' : urgentCount > 0 ? 'text-amber-600' : 'text-emerald-600' }`}>{urgentCount}</span>
                                        <span className="text-[10px] font-bold text-slate-400">leads</span>
                                    </div>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${ urgentCount > 5 ? 'bg-red-50 text-red-600' : urgentCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600' }`}>
                                        { urgentCount > 5 ? '🔴 Urgente' : urgentCount > 0 ? '⚠️ Revisar' : '✅ Al día' }
                                    </span>
                                </div>
                                <div className="mt-3 h-1 bg-slate-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all duration-1000 ${ urgentCount > 5 ? 'bg-red-500' : urgentCount > 0 ? 'bg-amber-500' : 'bg-emerald-500' }`}
                                        style={{ width: urgentCount > 0 ? `${Math.min(100, (urgentCount / Math.max(upcomingFollowUps.length, 1)) * 100)}%` : '100%' }}
                                    />
                                </div>
                            </div>
                        );
                    })()}

                    {/* KPI 2: Leads sin actividad +15d */}
                    {(() => {
                        const staleCount = funnelData
                            .filter((s: any) => !['Cerrado', 'Cliente', 'Perdido', 'Erróneo'].includes(s.key))
                            .reduce((sum: number, s: any) => sum + (s.value || 0), 0);
                        const noFollowup = escalationLeads.length;
                        return (
                            <div
                                onClick={() => navigate('/leads')}
                                className="flex-1 bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_15px_rgb(0,0,0,0.03)] p-4 cursor-pointer hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all duration-500 group flex flex-col justify-between min-h-[120px]"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 flex items-center gap-1.5">
                                            <AlertTriangle className="w-3 h-3" /> Pipeline activo
                                        </p>
                                        <p className="text-[10px] text-gray-400 font-medium">Leads en etapas abiertas</p>
                                    </div>
                                    <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                                        <Target className="w-4 h-4 text-indigo-600" />
                                    </div>
                                </div>
                                <div className="mt-3 flex items-end justify-between">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-black tracking-tighter text-indigo-600">{staleCount}</span>
                                        <span className="text-[10px] font-bold text-slate-400">activos</span>
                                    </div>
                                    {noFollowup > 0 && (
                                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">
                                            ⚠️ {noFollowup} en escalación
                                        </span>
                                    )}
                                </div>
                                <div className="mt-3 flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${stats.conversionRate}%` }} />
                                    </div>
                                    <span className="text-[9px] font-black text-indigo-600 shrink-0">{stats.conversionRate}% conv.</span>
                                </div>
                            </div>
                        );
                    })()}

                </div>

                {/* Control de Pagos (CxC) Widget */}
                <div className="lg:col-span-4 bg-white rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-200/60 flex flex-col group hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all duration-500 relative z-0">
                    <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-white">
                        <div className="flex flex-col">
                            <h3 className="text-[11px] font-black text-emerald-800 uppercase tracking-[0.2em] flex items-center gap-1.5">
                                <BadgeDollarSign className="w-3.5 h-3.5" /> Control de Pagos
                            </h3>
                            <p className="text-[10px] text-gray-400 font-medium mt-0.5">Ingresos vs. Cuentas por Cobrar (CxC)</p>
                        </div>
                        {canViewActiveFinancials && (
                            <button 
                                onClick={() => navigate('/finanzas')} 
                                className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2.5 py-1 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all"
                            >
                                Ver Finanzas →
                            </button>
                        )}
                    </div>
                    
                    <div className="p-4 flex-grow flex flex-col justify-between min-h-[220px]">
                        {!canViewActiveFinancials ? (
                            <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-10">
                                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                                    <CreditCard className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-800 uppercase tracking-wider">Acceso Restringido</p>
                                    <p className="text-[10px] text-slate-400 font-medium mt-1 px-4">Esta sección contiene información financiera confidencial y requiere permisos adicionales.</p>
                                </div>
                            </div>
                        ) : isFinanceLoading ? (
                            <div className="h-full flex items-center justify-center py-10 opacity-30 text-[9px] font-black uppercase tracking-widest animate-pulse">Cargando datos...</div>
                        ) : financeResumen ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/50 hover:bg-emerald-50 transition-colors">
                                        <p className="text-[9px] font-black text-emerald-700 uppercase tracking-wider mb-1">💰 Pagado (Income)</p>
                                        <p className="text-xl font-black text-emerald-600 font-mono">${(financeResumen.totalCobrado || 0).toLocaleString()}</p>
                                        <p className="text-[8px] text-slate-400 font-bold">Ingresos cobrados</p>
                                    </div>
                                    <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100/50 hover:bg-amber-50 transition-colors">
                                        <p className="text-[9px] font-black text-amber-700 uppercase tracking-wider mb-1">⏳ Pendiente (CxC)</p>
                                        <p className="text-xl font-black text-amber-600 font-mono">${(financeResumen.totalPendiente || 0).toLocaleString()}</p>
                                        <p className="text-[8px] text-slate-400 font-bold">Cuentas por cobrar</p>
                                    </div>
                                </div>

                                <div className="space-y-1.5 pt-2 border-t border-slate-50">
                                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
                                        <span className="text-slate-400">Progreso de Recaudo</span>
                                        <span className="text-emerald-600 font-mono text-[11px] font-bold">
                                            {financeResumen.ventaTotal > 0 
                                                ? `${Math.round((financeResumen.totalCobrado / financeResumen.ventaTotal) * 100)}%` 
                                                : '0%'}
                                        </span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                        <div 
                                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-1000" 
                                            style={{ 
                                                width: financeResumen.ventaTotal > 0 
                                                    ? `${Math.min(100, (financeResumen.totalCobrado / financeResumen.ventaTotal) * 100)}%` 
                                                    : '0%' 
                                            }} 
                                        />
                                    </div>
                                    <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                                        <span>Total: ${(financeResumen.ventaTotal || 0).toLocaleString()}</span>
                                        <span>{financeResumen.cotizacionesActivas} contratos con pagos</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center py-10 opacity-30 text-[9px] font-black uppercase tracking-widest">Sin datos financieros</div>
                        )}
                    </div>
                </div>

                <div className={`lg:col-span-4 bg-white rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-200/60 flex flex-col group hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all duration-500 relative ${activeCardFilter === 'topOpp' ? 'z-[50]' : 'z-0'}`}>
                    <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-white">
                        <div className="flex flex-col">
                            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">{t('dashboard.crm.topOppTitle')}
                                {topOpportunities.length > 0 && <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full text-[9px] font-black">{topOpportunities.length}</span>}
                            </h3>
                            <p className="text-[10px] text-gray-400 font-medium mt-0.5">Mayores contratos</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => navigate('/leads', { state: { startDate: dateRange.startDate, endDate: dateRange.endDate } })} className="text-[9px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-[0.2em] transition-all">Ver</button>
                            <div className="relative" ref={activeCardFilter === 'topOpp' ? cardFilterRef : null}>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveCardFilter(activeCardFilter === 'topOpp' ? null : 'topOpp');
                                    }}
                                    className={`p-1.5 rounded-lg transition-all ${activeCardFilter === 'topOpp' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-300 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                >
                                    <Settings className="w-3.5 h-3.5" />
                                </button>
                                {activeCardFilter === 'topOpp' && (
                                    <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-2xl border border-indigo-50 z-[51] py-2 animate-in fade-in slide-in-from-top-2 overflow-hidden">
                                        {(Object.entries(DATE_RANGE_OPTIONS) as [DateRange, { label: string }][]).map(([key, option]) => (
                                            <button
                                                key={key}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedDateRange(key);
                                                    setActiveCardFilter(null);
                                                }}
                                                className={`w-full text-left px-4 py-2 text-[10px] transition-colors flex items-center justify-between ${selectedDateRange === key ? 'bg-indigo-50 text-indigo-600 font-black' : 'text-slate-600 font-bold hover:bg-gray-50'}`}
                                            >
                                                <span className="flex items-center gap-1.5">
                                                    {option.label}
                                                    <span className="text-[9px] opacity-30 font-medium">{getDateRangeLabelDisplay(key)}</span>
                                                </span>
                                                {selectedDateRange === key && <CheckCircle className="w-2.5 h-2.5 text-indigo-600" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="p-3 space-y-1.5 flex-grow">
                        {topOpportunities.length > 0 ? topOpportunities.map((lead) => (
                            <div
                                key={lead.id}
                                onClick={() => navigate('/leads', { state: { leadId: lead.id } })}
                                className="p-2.5 bg-gray-50/50 rounded-xl border border-transparent hover:border-indigo-100 hover:bg-white transition-all cursor-pointer group/item flex justify-between items-center"
                            >
                                <div className="flex flex-col gap-0.5 max-w-[60%]">
                                    <h4 className="text-[11px] font-black text-slate-900 truncate group-hover/item:text-indigo-600">{lead.name}</h4>
                                    <div className="flex items-center gap-1.5 opacity-60">
                                        {lead.source && <span className="text-[9px] font-bold text-slate-500">{SOURCE_CONFIG[lead.source]?.icon}</span>}
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter truncate">{lead.company_name || 'Particular'}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    {canViewActiveFinancials ? (
                                        <p className="text-[11px] font-black text-emerald-600 font-mono">${(lead.value || 0).toLocaleString()}</p>
                                    ) : (
                                        <p className="text-[11px] font-black text-slate-400 font-mono">•••</p>
                                    )}
                                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">{STATUS_CONFIG[lead.status as keyof typeof STATUS_CONFIG]?.label || lead.status}</p>
                                </div>
                            </div>
                        )) : (
                            <div className="h-full flex items-center justify-center py-20 opacity-30 text-[9px] font-black uppercase tracking-widest">Sin datos</div>
                        )}
                    </div>
                </div>

                <div className={`lg:col-span-4 bg-white rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-200/60 flex flex-col group hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all duration-500 relative ${activeCardFilter === 'followups' ? 'z-[50]' : 'z-0'}`}>
                    <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-white">
                        <div className="flex flex-col">
                            <h3 className="text-[11px] font-black text-blue-700 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5 animate-pulse text-amber-500" />
                                {selectedCollabName ? (
                                    <span>🔥 Enfoque de {selectedCollabName}</span>
                                ) : (
                                    <span>🔥 Mi Enfoque de Hoy</span>
                                )}
                                {(upcomingFollowUps.length > 0 || hotLeads.length > 0) && (
                                    <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full text-[9px] font-black">
                                        {upcomingFollowUps.length + hotLeads.length}
                                    </span>
                                )}
                            </h3>
                            <p className="text-[10px] text-blue-600/60 font-medium mt-0.5">
                                Priorizado por urgencia y temperatura de cierre
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => navigate('/leads')} className="text-[9px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-[0.2em] transition-all">Ver</button>
                            <div className="relative" ref={activeCardFilter === 'followups' ? cardFilterRef : null}>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveCardFilter(activeCardFilter === 'followups' ? null : 'followups');
                                    }}
                                    className={`p-1.5 rounded-lg transition-all ${activeCardFilter === 'followups' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-300 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                >
                                    <Settings className="w-3.5 h-3.5" />
                                </button>
                                {activeCardFilter === 'followups' && (
                                    <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-2xl border border-indigo-50 z-[51] py-2 animate-in fade-in slide-in-from-top-2 overflow-hidden">
                                        {(Object.entries(DATE_RANGE_OPTIONS) as [DateRange, { label: string }][]).map(([key, option]) => (
                                            <button
                                                key={key}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedDateRange(key);
                                                    setActiveCardFilter(null);
                                                }}
                                                className={`w-full text-left px-4 py-2 text-[10px] transition-colors flex items-center justify-between ${selectedDateRange === key ? 'bg-indigo-50 text-indigo-600 font-black' : 'text-slate-600 font-bold hover:bg-gray-50'}`}
                                            >
                                                <span className="flex items-center gap-1.5">
                                                    {option.label}
                                                    <span className="text-[9px] opacity-30 font-medium">{getDateRangeLabelDisplay(key)}</span>
                                                </span>
                                                {selectedDateRange === key && <CheckCircle className="w-2.5 h-2.5 text-indigo-600" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    {(() => {
                        const items: {
                            id: string;
                            name: string;
                            notes: string;
                            type: 'hot' | 'overdue' | 'today' | 'upcoming';
                            dateLabel: string;
                            phone?: string;
                            email?: string;
                        }[] = [];

                        // 1. Add Hot Leads
                        hotLeads.forEach(hl => {
                            items.push({
                                id: hl.id,
                                name: hl.name || 'Prospecto sin nombre',
                                notes: '🔥 Cierre Inminente (Inteligencia AI)',
                                type: 'hot',
                                dateLabel: 'HOT',
                                phone: hl.phone || ''
                            });
                        });

                        // 2. Add upcoming follow-ups
                        upcomingFollowUps.forEach(uf => {
                            if (items.some(x => x.id === uf.id)) return;
                            
                            const dateObj = new Date(uf.next_followup_date);
                            const isOverdue = dateObj < startOfToday();
                            const isToday = dateObj >= startOfToday() && dateObj <= endOfToday();
                            
                            let type: 'overdue' | 'today' | 'upcoming' = 'upcoming';
                            if (isOverdue) type = 'overdue';
                            else if (isToday) type = 'today';

                            // En "Mi Enfoque de Hoy", solo mostramos tareas vencidas o para hoy
                            if (type !== 'overdue' && type !== 'today') return;

                            let dateLabel = 'N/A';
                            try {
                                dateLabel = format(dateObj, 'dd MMM', { locale: es });
                            } catch (e) {}

                            items.push({
                                id: uf.id,
                                name: uf.name || 'Prospecto sin nombre',
                                notes: uf.next_action_notes || 'Revisar contacto',
                                type,
                                dateLabel,
                                phone: uf.phone || '',
                                email: uf.email || ''
                            });
                        });

                        const typePriority = { hot: 0, overdue: 1, today: 2, upcoming: 3 };
                        items.sort((a, b) => typePriority[a.type] - typePriority[b.type]);

                        return (
                            <div className="p-3 space-y-1.5 max-h-[300px] overflow-y-auto custom-scrollbar flex-grow">
                                {items.length > 0 ? (
                                    items.map((item) => (
                                        <div
                                            key={`${item.id}-${item.type}`}
                                            onClick={() => navigate('/leads', { state: { leadId: item.id } })}
                                            className={`p-2.5 rounded-xl border border-transparent transition-all cursor-pointer group/item flex justify-between items-center bg-gray-50/50 ${
                                                item.type === 'hot' ? 'hover:border-amber-100 hover:bg-amber-50/20' :
                                                item.type === 'overdue' ? 'hover:border-rose-100 hover:bg-rose-50/20' :
                                                'hover:border-blue-100 hover:bg-white'
                                            }`}
                                        >
                                            <div className="flex flex-col gap-0.5 max-w-[70%]">
                                                <h4 className="text-[11px] font-black text-slate-900 truncate group-hover/item:text-indigo-600 flex items-center gap-1.5">
                                                    {item.type === 'hot' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />}
                                                    {item.type === 'overdue' && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />}
                                                    {item.type === 'today' && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                                                    {item.type === 'upcoming' && <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />}
                                                    <span className="truncate">{item.name}</span>
                                                </h4>
                                                <p className={`text-[9px] font-medium line-clamp-1 ${
                                                    item.type === 'hot' ? 'text-amber-600 font-extrabold' : 
                                                    item.type === 'overdue' ? 'text-rose-500 font-extrabold' : 
                                                    'text-slate-500'
                                                }`}>
                                                    {item.notes}
                                                </p>
                                            </div>
                                            <div className="flex items-center shrink-0">
                                                {/* Date Label (visible by default, hidden on hover) */}
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-lg border min-w-[42px] text-center uppercase group-hover/item:hidden transition-all ${
                                                    item.type === 'hot' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                    item.type === 'overdue' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                                                    'bg-blue-50 text-blue-600 border-blue-100'
                                                }`}>
                                                    {item.dateLabel}
                                                </span>

                                                {/* Quick Actions (hidden by default, flex row on hover) */}
                                                <div className="hidden group-hover/item:flex items-center gap-1 transition-all animate-in fade-in slide-in-from-right-1">
                                                    {/* WhatsApp click-to-chat */}
                                                    {item.phone && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const cleanPhone = (item.phone || '').replace(/[^0-9]/g, '');
                                                                const message = `Hola ${item.name}, te saludo de Arias Defense. ¿Cómo te encuentras hoy?`;
                                                                window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`, '_blank');
                                                            }}
                                                            className="p-1 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white transition-all shadow-sm border border-emerald-100"
                                                            title="Chat instantáneo de WhatsApp"
                                                        >
                                                            <MessageSquare className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}

                                                    {/* Instant Snooze +24h */}
                                                    {item.type !== 'hot' && (
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                const tomorrow = new Date();
                                                                tomorrow.setDate(tomorrow.getDate() + 1);
                                                                try {
                                                                    const { error } = await supabase
                                                                        .from('leads')
                                                                        .update({ next_followup_date: tomorrow.toISOString().split('T')[0] })
                                                                        .eq('id', item.id);
                                                                    if (error) throw error;
                                                                    toast.success(`📅 Pospuesto para mañana`);
                                                                    setRefreshKey(p => p + 1);
                                                                    refetch();
                                                                } catch (err) {
                                                                    logger.error('Error snoozing lead', err);
                                                                    toast.error('No se pudo reprogramar');
                                                                }
                                                            }}
                                                            className="p-1 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white transition-all shadow-sm border border-indigo-100"
                                                            title="Snooze 24h (Pospone para mañana)"
                                                        >
                                                            <Calendar className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}

                                                    {/* AI Mind Capsule (Brain Icon) */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleViewAiMemory(item.id, item.name);
                                                        }}
                                                        className="p-1 rounded-lg bg-amber-50 hover:bg-amber-500 text-amber-600 hover:text-white transition-all shadow-sm border border-amber-100"
                                                        title="AI Capsule: Ver memoria cerebral del Lead"
                                                    >
                                                        <Brain className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center py-20 opacity-30">
                                        <CheckCircle className="w-8 h-8 mb-2 text-emerald-500" />
                                        <p className="text-[10px] font-black uppercase tracking-[0.1em]">Al día</p>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>


                {/* Row 5: Industry Distribution */}
                {industryData.length > 0 && (
                    <div className="lg:col-span-12">
                        <div className="bg-white rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-200/60 p-4 hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all duration-500">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                                        <Building2 className="w-4 h-4 text-indigo-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Distribución por Rubro</h3>
                                        <p className="text-[10px] text-gray-400 font-medium mt-0.5">Sectores de los prospectos</p>
                                    </div>
                                </div>
                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                                    {industryData.reduce((s, i) => s + i.count, 0)} leads
                                </span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                {industryData.slice(0, 12).map((item, idx) => (
                                    <div
                                        key={item.name}
                                        className="group/ind bg-slate-50 hover:bg-indigo-50 rounded-xl p-3 transition-all cursor-default border border-transparent hover:border-indigo-100"
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <div
                                                className="w-2 h-2 rounded-full shrink-0"
                                                style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                                            />
                                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight truncate group-hover/ind:text-indigo-700 transition-colors">{item.name}</span>
                                        </div>
                                        <div className="flex items-end justify-between">
                                            <span className="text-lg font-black text-slate-900">{item.count}</span>
                                            <span className="text-[9px] font-black text-slate-300">{item.percentage}%</span>
                                        </div>
                                        <div className="mt-1.5 bg-slate-200/60 rounded-full h-1 overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{ width: `${item.percentage}%`, backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Lost Leads Analysis - Replaces Control Financiero */}
            <div className="relative z-0 mb-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Lost by Stage */}
                <div className={`bg-white p-3 rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-200/60 flex flex-col group hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all duration-500 relative ${activeCardFilter === 'lostByStage' ? 'z-[50]' : 'z-0'}`}>
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex flex-col">
                            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Leads Perdidos por Etapa</h3>
                            <p className="text-[10px] text-gray-400 font-medium mt-0.5">Dónde se están perdiendo las oportunidades</p>
                        </div>
                        <div className="relative" ref={activeCardFilter === 'lostByStage' ? cardFilterRef : null}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveCardFilter(activeCardFilter === 'lostByStage' ? null : 'lostByStage');
                                }}
                                className={`p-1.5 rounded-lg transition-all ${activeCardFilter === 'lostByStage' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-300 hover:text-indigo-600 hover:bg-indigo-50'}`}
                            >
                                <Settings className="w-3.5 h-3.5" />
                            </button>
                            {activeCardFilter === 'lostByStage' && (
                                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-2xl border border-indigo-50 z-[51] py-2 animate-in fade-in slide-in-from-top-2 overflow-hidden">
                                    {(Object.entries(DATE_RANGE_OPTIONS) as [DateRange, { label: string }][]).map(([key, option]) => (
                                        <button
                                            key={key}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedDateRange(key);
                                                setActiveCardFilter(null);
                                            }}
                                            className={`w-full text-left px-4 py-2 text-[11px] transition-colors flex items-center justify-between ${selectedDateRange === key
                                                ? 'bg-indigo-50 text-indigo-600 font-black'
                                                : 'text-slate-600 font-bold hover:bg-gray-50'
                                                }`}
                                        >
                                            <span className="flex items-center gap-2">
                                                {option.label}
                                                <span className="text-[9px] opacity-30 font-medium">{getDateRangeLabelDisplay(key)}</span>
                                            </span>
                                            {selectedDateRange === key && <CheckCircle className="w-4 h-4 text-indigo-600" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex-grow flex flex-col gap-2">
                        {(() => {
                            const stageLossData = lossStageData.map((s, idx) => ({
                                stage: s.stage_name,
                                count: s.loss_count,
                                color: ['bg-blue-500', 'bg-indigo-500', 'bg-teal-500', 'bg-yellow-500', 'bg-red-500'][idx % 5]
                            }));

                            const totalLost = stageLossData.reduce((sum, s) => sum + s.count, 0);

                            return totalLost > 0 ? (
                                stageLossData.map((item, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-all cursor-pointer group/item"
                                        onClick={() => navigate('/leads', { state: { status: 'Perdido', lostAtStage: item.stage, startDate: dateRange.startDate, endDate: dateRange.endDate } })}
                                    >
                                        <div className={`w-3 h-3 rounded-full ${item.color} shadow-sm group-hover/item:scale-125 transition-transform`} />
                                        <div className="flex-1">
                                            <p className="text-xs font-black text-slate-700 group-hover/item:text-indigo-600 transition-colors">{item.stage}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-black text-red-600">{item.count}</p>
                                            <p className="text-[8px] font-black text-slate-300 uppercase">Perdidos</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center py-12 opacity-30">
                                    <CheckCircle className="w-10 h-10 mb-2 text-green-400" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">Sin pérdidas registradas</p>
                                    <p className="text-[9px] font-medium text-slate-300 mt-1">¡Excelente trabajo!</p>
                                </div>
                            );
                        })()}
                    </div>
                </div>

                {/* Lost by Reason */}
                <div className={`bg-white p-3 rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-200/60 flex flex-col group hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all duration-500 relative ${activeCardFilter === 'lostByReason' ? 'z-[50]' : 'z-0'}`}>
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex flex-col">
                            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Motivos de Pérdida</h3>
                            <p className="text-[10px] text-gray-400 font-medium mt-0.5">Por qué se están perdiendo</p>
                        </div>
                        <div className="relative" ref={activeCardFilter === 'lostByReason' ? cardFilterRef : null}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveCardFilter(activeCardFilter === 'lostByReason' ? null : 'lostByReason');
                                }}
                                className={`p-1.5 rounded-lg transition-all ${activeCardFilter === 'lostByReason' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-300 hover:text-indigo-600 hover:bg-indigo-50'}`}
                            >
                                <Settings className="w-3.5 h-3.5" />
                            </button>
                            {activeCardFilter === 'lostByReason' && (
                                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-2xl border border-indigo-50 z-[51] py-2 animate-in fade-in slide-in-from-top-2 overflow-hidden">
                                    {(Object.entries(DATE_RANGE_OPTIONS) as [DateRange, { label: string }][]).map(([key, option]) => (
                                        <button
                                            key={key}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedDateRange(key);
                                                setActiveCardFilter(null);
                                            }}
                                            className={`w-full text-left px-4 py-2 text-[11px] transition-colors flex items-center justify-between ${selectedDateRange === key
                                                ? 'bg-indigo-50 text-indigo-600 font-black'
                                                : 'text-slate-600 font-bold hover:bg-gray-50'
                                                }`}
                                        >
                                            <span className="flex items-center gap-2">
                                                {option.label}
                                                <span className="text-[9px] opacity-30 font-medium">{getDateRangeLabelDisplay(key)}</span>
                                            </span>
                                            {selectedDateRange === key && <CheckCircle className="w-4 h-4 text-indigo-600" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex-grow flex flex-col gap-2">
                        {(() => {
                            const reasonData = lossReasonData.map(r => ({
                                id: r.reason_id,
                                reason: r.reason_name,
                                count: r.loss_count,
                                percentage: Math.round(r.percentage)
                            }));

                            const totalReasonsCount = reasonData.reduce((sum, r) => sum + r.count, 0);

                            return totalReasonsCount > 0 ? (
                                reasonData.filter(r => r.count > 0).map((item, index) => (
                                    <div
                                        key={index}
                                        onClick={() => navigate('/leads', { state: { status: 'Perdido', lossReasonId: item.id, startDate: dateRange.startDate, endDate: dateRange.endDate } })}
                                        className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-all cursor-pointer group/item"
                                    >
                                        <div className="flex-1">
                                            <p className="text-xs font-black text-slate-700 group-hover/item:text-red-500 transition-colors">{item.reason}</p>
                                            <div className="mt-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                <div
                                                    className="bg-red-500 h-full rounded-full transition-all duration-500 group-hover/item:bg-red-600"
                                                    style={{ width: `${item.percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-black text-red-600">{item.count}</p>
                                            <p className="text-[8px] font-black text-slate-300 uppercase">{item.percentage}%</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center py-12 opacity-30">
                                    <CheckCircle className="w-10 h-10 mb-2 text-green-400" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">Sin pérdidas registradas</p>
                                    <p className="text-[9px] font-medium text-slate-300 mt-1">¡Sigue así!</p>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* F4 + F5 — SIA Intelligence Panel (at the bottom, date-filter aware) */}
            {profile?.company_id && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
                    {/* F4 â€” Manager Live Pulse: admin + simulation mode */}
                    {isActuallySimulatingAdmin && (
                        <div className="lg:col-span-8">
                            <ManagerLivePulse
                                companyId={profile.company_id}
                                startDate={dateRange.startDate}
                                endDate={dateRange.endDate}
                                periodLabel={SIA_PERIOD_LABELS[selectedDateRange] || 'este período'}
                            />
                        </div>
                    )}
                    {/* F5 â€” Agent Ranking: all roles */}
                    <div className={isActuallySimulatingAdmin ? 'lg:col-span-4' : 'lg:col-span-12'}>
                        <WeeklyLeaderboard
                            companyId={profile.company_id}
                            currentUserId={profile?.id}
                            startDate={dateRange.startDate}
                            endDate={dateRange.endDate}
                            periodLabel={SIA_PERIOD_LABELS[selectedDateRange] || 'este período'}
                        />
                    </div>
                </div>
            )}
            {/* 🧠 AI Mind Capsule Modal */}
            {selectedAiLead && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[999] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white/95 backdrop-blur-md rounded-2xl max-w-md w-full shadow-2xl border border-indigo-50 overflow-hidden relative p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex justify-between items-start pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                                    <Brain className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-800 tracking-tight">AI Mind Capsule</h3>
                                    <p className="text-[10px] text-indigo-500 font-extrabold uppercase tracking-wider">{selectedAiLead.name}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setSelectedAiLead(null);
                                    setAiMemoryData(null);
                                }}
                                className="text-slate-400 hover:text-slate-600 text-xs font-bold bg-slate-50 hover:bg-slate-100 w-6 h-6 rounded-lg flex items-center justify-center transition-all"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Content */}
                        {isLoadingAiMemory ? (
                            <div className="py-12 flex flex-col items-center justify-center gap-2">
                                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">Leyendo memoria del Lead...</span>
                            </div>
                        ) : aiMemoryData ? (
                            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                                {/* Sentiment Meter */}
                                <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50">
                                    <div className="flex justify-between items-center mb-1.5 text-[10px] font-black uppercase tracking-wider">
                                        <span className="text-indigo-600">Nivel de Engagement (IA)</span>
                                        <span className="text-amber-500 font-black">{aiMemoryData.sentiment_score}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden flex">
                                        <div
                                            className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-amber-500 to-indigo-600"
                                            style={{ width: `${aiMemoryData.sentiment_score}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Objections & Next Action */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                                        <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest block mb-0.5">Última Objeción</span>
                                        <p className="text-[10px] font-bold text-rose-800 line-clamp-2">
                                            {aiMemoryData.last_objection || 'Sin objeción registrada'}
                                        </p>
                                    </div>
                                    <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-100">
                                        <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest block mb-0.5">Acción Recomendada</span>
                                        <p className="text-[10px] font-bold text-amber-800 line-clamp-2 uppercase tracking-tight">
                                            {aiMemoryData.next_action || 'Calificar lead'}
                                        </p>
                                    </div>
                                </div>

                                {/* Facts / Known Facts */}
                                <div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Hechos Clave Registrados</span>
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100/80 space-y-1.5">
                                        {aiMemoryData.known_facts && Object.keys(aiMemoryData.known_facts).length > 0 ? (
                                            Object.entries(aiMemoryData.known_facts).map(([key, val]) => (
                                                <div key={key} className="flex justify-between items-start gap-3 text-[10px] pb-1.5 border-b border-slate-200/50 last:border-0 last:pb-0">
                                                    <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[8px]">{key.replace(/_/g, ' ')}:</span>
                                                    <span className="font-black text-slate-800 text-right">{Array.isArray(val) ? val.join(', ') : String(val)}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-[10px] text-slate-400 italic">No hay hechos calificados por la IA en esta conversación aún.</p>
                                        )}
                                    </div>
                                </div>

                                {/* Contact preference & Time */}
                                {aiMemoryData.best_contact_time && (
                                    <div className="flex items-center gap-1.5 text-[9px] text-indigo-600 font-extrabold">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span>Horario óptimo de contacto: {aiMemoryData.best_contact_time}</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="py-8 flex flex-col items-center justify-center text-center opacity-40">
                                <Sparkles className="w-8 h-8 mb-2 text-indigo-500" />
                                <p className="text-[10px] font-black uppercase tracking-wider">Sin análisis AI registrado</p>
                                <p className="text-[9px] text-slate-500 max-w-[200px] mt-1">
                                    La IA no ha tenido conversaciones directas o analizado a este lead para generar memoria.
                                </p>
                            </div>
                        )}

                        {/* Footer button */}
                        <div className="flex justify-end pt-2 border-t border-slate-100">
                            <Button
                                onClick={() => navigate('/leads', { state: { leadId: selectedAiLead.id } })}
                                className="text-[10px] font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl"
                            >
                                Ver Detalles del Lead
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>

    );
}

