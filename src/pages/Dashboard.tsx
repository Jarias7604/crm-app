import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { BadgeDollarSign, TrendingUp, Users, Target, Building, Building2, Calendar, Clock, CheckCircle, ChevronDown, Edit2, Settings, AlertTriangle } from 'lucide-react';
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

const PIE_COLORS = [THEME.primary, THEME.success, THEME.accent, THEME.chart2, THEME.chart3, '#94A3B8'];

const FunnelInfographic = ({ data, onStageClick }: { data: any[], onStageClick: (status: string) => void }) => {
    const count = (status: string) => {
        const item = data.find(d => d.key === status);
        return item ? item.value : 0;
    };
    const amount = (status: string) => {
        const item = data.find(d => d.key === status);
        return item ? (item.amount || 0) : 0;
    };

    const layers = [
        { label: 'Prospecto', value: count('Prospecto'), amount: amount('Prospecto'), color: '#3b82f6', key: 'Prospecto' },
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
                            {layer.amount > 0 && (
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
    const [refreshKey, setRefreshKey] = useState(Date.now());

    // Card-specific filter dropdown state
    const [activeCardFilter, setActiveCardFilter] = useState<string | null>(null);
    const cardFilterRef = useRef<HTMLDivElement>(null);

    // Real data states
    const [stats, setStats] = useState({
        totalLeads: 0,
        totalLeadsTrend: 0,
        totalPipeline: 0,
        totalPipelineTrend: 0,
        wonDeals: 0,
        wonDealsTrend: 0,
        totalWonAmount: 0,
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


    const navigate = useNavigate();

    // Super Admin states
    const [adminStats, setAdminStats] = useState({
        totalCompanies: 0,
        activeTrials: 0,
        activeLicenses: 0
    });
    const [recentCompanies, setRecentCompanies] = useState<any[]>([]);
    const [companyTrend, setCompanyTrend] = useState<any[]>([]);

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

    // Refresh data when navigating to Dashboard or when filters change
    useEffect(() => {
        // Update refresh key to force data reload
        setRefreshKey(Date.now());
    }, [location.pathname]);

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
                start = startOfWeek(now, { weekStartsOn: 0 });
                end = endOfWeek(now, { weekStartsOn: 0 });
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
                startDate = startOfWeek(now, { weekStartsOn: 0 }).toISOString();
                endDate = endOfWeek(now, { weekStartsOn: 0 }).toISOString();
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
            case 'all':
                startDate = undefined;
                endDate = undefined;
                break;
        }

        return { startDate, endDate };
    }, [selectedDateRange]);

    // Use optimized dashboard hook (replaces 5 queries with 1)
    const { data: dashboardData, isLoading: isDashboardLoading, error: dashboardError } = useDashboardStats(
        profile?.company_id,
        dateRange.startDate,
        dateRange.endDate
    );

    // Process dashboard data when it arrives
    useEffect(() => {
        if (dashboardData) {
            // Set stats
            setStats(dashboardData.stats);

            // Map funnel data with labels
            const mappedFunnelData = dashboardData.byStatus.map((item: any) => {
                const config = STATUS_CONFIG[item.name as keyof typeof STATUS_CONFIG];
                return {
                    key: item.name,
                    name: config?.label || item.name,
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
                icon: SOURCE_CONFIG[s.name as keyof typeof SOURCE_CONFIG]?.icon || '📊',
                value: total > 0 ? Math.round((s.value / total) * 100) : 0,
                count: s.value
            })).sort((a: any, b: any) => b.count - a.count);
            setSourceData(mappedSources);

            // Set top opportunities
            setTopOpportunities(dashboardData.topOpportunities || []);

            // Set upcoming follow-ups
            setUpcomingFollowUps(dashboardData.upcomingFollowUps || []);

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

            // Fetch industry distribution
            supabase
                .from('leads')
                .select('industry')
                .not('industry', 'is', null)
                .neq('industry', '')
                .then(({ data: leadsWithIndustry }) => {
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
    }, [dashboardData]);

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
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
                className="flex items-center space-x-2 bg-white border border-gray-100 text-[#4449AA] px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-all shadow-sm"
            >
                <Calendar className="h-4 w-4 text-[#007BFF]" />
                <span>{DATE_RANGE_OPTIONS[selectedDateRange].label}</span>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
            </button>

            {isFilterOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-2xl border border-indigo-50 z-50 py-2 animate-in fade-in slide-in-from-top-2">
                    {(Object.entries(DATE_RANGE_OPTIONS) as [DateRange, { label: string }][]).map(([key, option]) => (
                        <button
                            key={key}
                            onClick={() => {
                                setSelectedDateRange(key);
                                setIsFilterOpen(false);
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-extrabold text-[#4449AA] leading-tight tracking-tight">{t('dashboard.crm.title')}</h2>
                    <p className="text-[13px] text-gray-400 font-medium font-inter transition-all">Análisis de rendimiento y prospección en tiempo real</p>
                </div>
                <div className="flex items-center gap-3">
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
                        name: t('dashboard.crm.totalPipeline'),
                        value: `$${stats.totalPipeline.toLocaleString()}`,
                        icon: BadgeDollarSign,
                        color: 'text-indigo-600',
                        bg: 'bg-indigo-50/50',
                        trend: `${stats.totalPipelineTrend > 0 ? '+' : ''}${stats.totalPipelineTrend}%`,
                        trendColor: stats.totalPipelineTrend >= 0 ? 'text-emerald-500' : 'text-rose-500',
                        onClick: () => navigate('/cotizaciones', { state: { startDate: dateRange.startDate, endDate: dateRange.endDate } })
                    },
                    {
                        name: t('dashboard.crm.totalLeads'),
                        value: stats.totalLeads,
                        icon: Users,
                        color: 'text-blue-600',
                        bg: 'bg-blue-50/50',
                        trend: `${stats.totalLeadsTrend > 0 ? '+' : ''}${stats.totalLeadsTrend}%`,
                        trendColor: stats.totalLeadsTrend >= 0 ? 'text-emerald-500' : 'text-rose-500',
                        onClick: () => navigate('/leads', { state: {} })
                    },
                    {
                        name: t('dashboard.crm.wonDeals'),
                        value: stats.wonDeals,
                        secondaryValue: `| $${(stats.totalWonAmount || 0).toLocaleString()}`,
                        icon: Target,
                        color: 'text-emerald-600',
                        bg: 'bg-emerald-50/50',
                        trend: `${stats.wonDealsTrend > 0 ? '+' : ''}${stats.wonDealsTrend}%`,
                        trendColor: stats.wonDealsTrend >= 0 ? 'text-emerald-500' : 'text-rose-500',
                        onClick: () => navigate('/leads', { state: { status: ['Cerrado', 'Cliente'] } })
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
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-3xl font-black tracking-tighter text-slate-900">{item.value}</span>
                                        {item.secondaryValue && <span className="text-[11px] font-bold text-slate-400">{item.secondaryValue}</span>}
                                    </div>
                                </div>

                                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <div className={`w-1.5 h-1.5 rounded-full ${item.trendColor.replace('text', 'bg')}`} />
                                        <span className={`text-[9px] font-black tracking-widest uppercase ${item.trendColor}`}>
                                            {item.trend}
                                        </span>
                                    </div>
                                    <span className="text-[9px] font-bold text-slate-300">
                                        {getDateRangeLabelDisplay(selectedDateRange) || 'Todo el tiempo'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* F4 + F5 — SIA Row: Live Pulse (admin) + Weekly Leaderboard (all) */}
            {profile?.company_id && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
                    {/* F4 — Manager Live Pulse: only for company_admin */}
                    {profile?.role === 'company_admin' && (
                        <div className="lg:col-span-8">
                            <ManagerLivePulse companyId={profile.company_id} />
                        </div>
                    )}
                    {/* F5 — Weekly Leaderboard: all roles */}
                    <div className={profile?.role === 'company_admin' ? 'lg:col-span-4' : 'lg:col-span-12'}>
                        <WeeklyLeaderboard
                            companyId={profile.company_id}
                            currentUserId={profile?.id}
                        />
                    </div>
                </div>
            )}

            {/* Main Content Area: Grouped Proportions */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch relative z-0">

                {/* Row 1: Funnel + Strategic Priority + Sources */}
                <div className={`bg-white p-3 rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-200/60 lg:col-span-4 flex flex-col group hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all duration-500 relative ${activeCardFilter === 'funnel' ? 'z-[50]' : 'z-0'}`}>
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
                        />
                    </div>
                </div >

                <div className={`bg-white p-3 rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-200/60 lg:col-span-4 flex flex-col group hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all duration-500 relative ${activeCardFilter === 'priority' ? 'z-[50]' : 'z-0'}`}>
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex flex-col">
                            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Priorización</h3>
                            <p className="text-[10px] text-gray-400 font-medium">Enfoque estratégico</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Target className="w-5 h-5 text-amber-500 opacity-30" />
                            <div className="relative" ref={activeCardFilter === 'priority' ? cardFilterRef : null}>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveCardFilter(activeCardFilter === 'priority' ? null : 'priority');
                                    }}
                                    className={`p-1.5 rounded-lg transition-all ${activeCardFilter === 'priority' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-300 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                >
                                    <Settings className="w-3.5 h-3.5" />
                                </button>
                                {activeCardFilter === 'priority' && (
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
                    <div className="flex-grow min-h-[200px]">
                        {priorityData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={priorityData} layout="vertical" margin={{ left: -20, right: 10 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }} width={70} />
                                    <Tooltip
                                        cursor={{ fill: 'transparent' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar
                                        dataKey="value"
                                        radius={[0, 4, 4, 0]}
                                        barSize={16}
                                        onClick={(data) => {
                                            if (data && data.key) {
                                                navigate('/leads', { state: { priority: data.key, startDate: dateRange.startDate, endDate: dateRange.endDate } });
                                            }
                                        }}
                                        className="cursor-pointer"
                                    >
                                        {priorityData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={
                                                    entry.key === 'very_high' ? '#EF4444' : // Red 500
                                                        entry.key === 'high' ? '#F97316' :      // Orange 500
                                                            entry.key === 'medium' ? '#FACC15' :    // Yellow 400
                                                                '#D1D5DB'                               // Gray 300
                                                }
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-300 font-bold text-[9px] uppercase tracking-widest">Sin actividad</div>
                        )}
                    </div>
                </div>

                <div className={`bg-white p-3 rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-200/60 lg:col-span-4 flex flex-col group hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all duration-500 relative ${activeCardFilter === 'sources' ? 'z-[50]' : 'z-0'}`}>
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

                {/* Row 2: Operations Modular Grid (Opportunities + Follow-ups + Conversions) */}
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
                                    <p className="text-[11px] font-black text-emerald-600 font-mono">${(lead.value || 0).toLocaleString()}</p>
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
                                <Clock className="w-3 h-3" /> Seguimientos
                                {upcomingFollowUps.length > 0 && <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full text-[9px] font-black">{upcomingFollowUps.length}</span>}
                            </h3>
                            <p className="text-[10px] text-blue-600/60 font-medium mt-0.5">Pendientes</p>
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
                    <div className="p-3 space-y-1.5 max-h-[300px] overflow-y-auto custom-scrollbar">
                        {upcomingFollowUps.length > 0 ? (
                            upcomingFollowUps.map((lead) => (
                                <div
                                    key={lead.id}
                                    onClick={() => navigate('/leads', { state: { leadId: lead.id } })}
                                    className="p-2.5 bg-gray-50/50 rounded-xl border border-transparent hover:border-blue-100 hover:bg-white transition-all cursor-pointer group/item flex justify-between items-center"
                                >
                                    <div className="flex flex-col gap-0.5 max-w-[70%]">
                                        <h4 className="text-[11px] font-black text-slate-900 truncate group-hover/item:text-blue-600">{lead.name}</h4>
                                        <p className="text-[9px] text-slate-500 font-medium line-clamp-1">{lead.next_action_notes || 'Revisar contacto'}</p>
                                    </div>
                                    <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-lg border border-blue-100 min-w-[35px] text-center">
                                        {(() => {
                                            try {
                                                const dateObj = new Date(lead.next_followup_date);
                                                return format(dateObj, 'dd MMM', { locale: es });
                                            } catch (e) { return 'N/A'; }
                                        })()}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center py-20 opacity-30">
                                <CheckCircle className="w-8 h-8 mb-2 text-emerald-500" />
                                <p className="text-[10px] font-black uppercase tracking-[0.1em]">Al día</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className={`lg:col-span-4 bg-white rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-200/60 flex flex-col group hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all duration-500 relative ${activeCardFilter === 'conversions' ? 'z-[50]' : 'z-0'}`}>
                    <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-white">
                        <div className="flex flex-col">
                            <h3 className="text-[11px] font-black text-emerald-700 uppercase tracking-[0.2em] flex items-center gap-2">
                                <TrendingUp className="w-3 h-3" /> Conversiones
                                {recentConversions.length > 0 && <span className="bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full text-[9px] font-black">{recentConversions.length}</span>}
                            </h3>
                            <p className="text-[10px] text-emerald-600/60 font-medium mt-0.5">Últimos cierres</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[8px] font-black tracking-widest uppercase">Winning</div>
                            <div className="relative" ref={activeCardFilter === 'conversions' ? cardFilterRef : null}>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveCardFilter(activeCardFilter === 'conversions' ? null : 'conversions');
                                    }}
                                    className={`p-1.5 rounded-lg transition-all ${activeCardFilter === 'conversions' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-300 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                >
                                    <Settings className="w-3.5 h-3.5" />
                                </button>
                                {activeCardFilter === 'conversions' && (
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
                    </div>
                    <div className="p-3 space-y-1.5 max-h-[300px] overflow-y-auto custom-scrollbar">
                        {recentConversions.length > 0 ? (
                            recentConversions.map((lead) => (
                                <div
                                    key={lead.id}
                                    onClick={() => navigate('/leads', { state: { leadId: lead.id } })}
                                    className="p-2.5 bg-gray-50/50 rounded-xl border border-transparent hover:border-emerald-100 hover:bg-white transition-all cursor-pointer group/item flex justify-between items-center"
                                >
                                    <div className="flex flex-col gap-0.5 max-w-[60%]">
                                        <h4 className="text-[11px] font-black text-slate-900 truncate group-hover/item:text-emerald-600">{lead.name}</h4>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-tighter truncate">{lead.company_name || 'Particular'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[11px] font-black text-emerald-600 font-mono">${(lead.closing_amount || lead.value || 0).toLocaleString()}</p>
                                        <p className="text-[8px] text-slate-300 font-black uppercase tracking-widest">Cerrado</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center py-20 opacity-30">
                                <Target className="w-8 h-8 mb-2 text-indigo-400" />
                                <p className="text-[10px] font-black uppercase tracking-[0.1em]">En busca del cierre</p>
                            </div>
                        )}
                    </div>
                </div>


                {/* Row 4: Lost Leads Analysis */}
                <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-4">
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
        </div>
    );
}
