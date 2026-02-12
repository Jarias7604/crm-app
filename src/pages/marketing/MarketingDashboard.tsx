import {
    ChevronDown,
    CheckCircle,
    Calendar,
    MessageSquare,
    Search,
    TrendingUp,
    Zap,
    Settings,
    Bot,
    ExternalLink,
    Users,
    DollarSign,
    Target
} from 'lucide-react';
// import { useTranslation } from 'react-i18next'; // Removed unused
// import { useAuth } from '../../auth/AuthProvider'; // Removed unused
import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo, useRef } from 'react';
import { marketingStatsService, type MarketingStats, type HeatmapLead, type ActiveCampaign } from '../../services/marketing/marketingStats';
import { cn } from '../../lib/utils';
import { DATE_RANGE_OPTIONS, type DateRange } from '../../types';
import {
    startOfToday, endOfToday,
    startOfWeek, endOfWeek,
    startOfMonth,
    subMonths,
    startOfYear
} from 'date-fns';
import { format } from 'date-fns';
import { Button } from '../../components/ui/Button';

export default function MarketingDashboard() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<MarketingStats | null>(null);
    const [heatmapLeads, setHeatmapLeads] = useState<HeatmapLead[]>([]);
    const [activeCampaign, setActiveCampaign] = useState<ActiveCampaign | null>(null);

    // Filter States
    const [selectedDateRange, setSelectedDateRange] = useState<DateRange>(
        (localStorage.getItem('marketing_selected_date_range') as DateRange) || 'all'
    );
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);
    const [activeCardFilter, setActiveCardFilter] = useState<string | null>(null);
    const cardFilterRef = useRef<HTMLDivElement>(null);

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
                endDate = endOfToday().toISOString();
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

    useEffect(() => {
        localStorage.setItem('marketing_selected_date_range', selectedDateRange);
    }, [selectedDateRange]);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const [s, h, a] = await Promise.all([
                    marketingStatsService.getOverviewStats(dateRange.startDate, dateRange.endDate),
                    marketingStatsService.getHeatmapLeads(dateRange.startDate, dateRange.endDate),
                    marketingStatsService.getActiveCampaign()
                ]);
                setStats(s);
                setHeatmapLeads(h);
                setActiveCampaign(a);
            } catch (error) {
                console.error('Error loading dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [dateRange]);

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

    const getDateRangeLabelDisplay = (range: DateRange) => {
        const now = new Date();
        let start: Date | null = null;
        let end: Date | null = null;

        switch (range) {
            case 'today': start = startOfToday(); end = endOfToday(); break;
            case 'this_week': start = startOfWeek(now, { weekStartsOn: 0 }); end = endOfWeek(now, { weekStartsOn: 0 }); break;
            case 'this_month': start = startOfMonth(now); end = endOfToday(); break;
            case 'last_3_months': start = startOfMonth(subMonths(now, 2)); end = endOfToday(); break;
            case 'last_6_months': start = startOfMonth(subMonths(now, 5)); end = endOfToday(); break;
            case 'this_year': start = startOfYear(now); end = endOfToday(); break;
            default: return '';
        }

        if (start && end) {
            if (range === 'today') return `(${format(start, 'dd/MM')})`;
            return `(${format(start, 'dd/MM')} - ${format(end, 'dd/MM')})`;
        }
        return '';
    };

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

    const handleLeadRedirect = (leadId: string) => {
        navigate('/leads', { state: { leadId } });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-[#0f172a] tracking-tight">Marketing Hub</h1>
                    <p className="text-gray-500 mt-1 text-sm font-medium">
                        Gestiona campañas omnicanal, automatizaciones y descubre nuevos clientes con IA.
                    </p>
                </div>
                <div className="flex gap-2 items-center">
                    <Button
                        onClick={() => setStats(null)} // Force reload
                        variant="outline"
                        size="sm"
                        className="h-10 px-4 rounded-xl border-gray-100 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all font-bold text-xs uppercase tracking-widest gap-2"
                    >
                        <TrendingUp className="w-3.5 h-3.5" />
                        Sincronizar
                    </Button>
                    <FilterDropdown />
                    <div className="h-8 w-[1px] bg-gray-100 mx-2" />
                    <Link to="/marketing/settings" className="bg-white text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        Configurar Envíos
                    </Link>
                    <Link to="/marketing/campaign/new" className="bg-gradient-to-r from-indigo-600 to-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        Nueva Campaña
                    </Link>
                </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Link to="/marketing/email">
                    <ActionCard
                        icon={Zap}
                        color="bg-purple-100 text-purple-600"
                        title="Gestión de Campañas"
                        desc="Email, WhatsApp & Telegram"
                    />
                </Link>
                <Link to="/marketing/settings" state={{ tab: 'whatsapp' }}>
                    <ActionCard
                        icon={MessageSquare}
                        color="bg-green-100 text-green-600"
                        title="WhatsApp & Chat"
                        desc="Configura canales y responde"
                    />
                </Link>
                <Link to="/marketing/ai-agents">
                    <ActionCard
                        icon={Bot}
                        color="bg-blue-100 text-blue-600"
                        title="Agentes AI"
                        desc="Configurar bots de venta"
                    />
                </Link>
                <Link to="/marketing/lead-hunter">
                    <ActionCard
                        icon={Search}
                        color="bg-amber-100 text-amber-600"
                        title="Lead Hunter"
                        desc="Descubrir clientes nuevos"
                        isNew={true}
                    />
                </Link>
            </div>

            {/* Stats Overview & Interest Heatmap */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Interest Heatmap Area */}
                <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 min-h-[400px] relative z-0">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-orange-500" />
                                Mapa de Calor de Interés
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">Leads con mayor interacción {dateRange.startDate ? 'en el periodo' : 'histórica'}.</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="relative" ref={activeCardFilter === 'heatmap' ? cardFilterRef : null}>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveCardFilter(activeCardFilter === 'heatmap' ? null : 'heatmap');
                                    }}
                                    className={`p-2 rounded-xl transition-all ${activeCardFilter === 'heatmap' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-50 border border-slate-100/50'}`}
                                >
                                    <Settings className="w-4 h-4" />
                                </button>
                                {activeCardFilter === 'heatmap' && (
                                    <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-2xl border border-indigo-50 z-50 py-2 animate-in fade-in slide-in-from-top-2 overflow-hidden">
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
                            <Link to="/marketing/email" className="text-blue-600 text-sm font-bold hover:underline flex items-center gap-1">
                                Ver todos
                                <ExternalLink className="w-3 h-3" />
                            </Link>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Heatmap List */}
                        <div className="overflow-hidden rounded-2xl border border-gray-100">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400">
                                    <tr>
                                        <th className="px-6 py-4">Prospecto</th>
                                        <th className="px-6 py-4">Envíos</th>
                                        <th className="px-6 py-4">Aperturas</th>
                                        <th className="px-6 py-4">Clicks</th>
                                        <th className="px-6 py-4 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 font-medium text-sm">
                                    {heatmapLeads.map((lead) => (
                                        <tr key={lead.id} className="hover:bg-gray-50/50 transition-colors group/row">
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => handleLeadRedirect(lead.id)}
                                                    className="text-left group/name flex items-center gap-3"
                                                >
                                                    <div className={cn(
                                                        "w-2 h-2 rounded-full",
                                                        lead.clicks > 0 ? "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]" : "bg-gray-300"
                                                    )}></div>
                                                    <div>
                                                        <div className="font-bold text-gray-900 group-hover/name:text-blue-600 transition-colors uppercase tracking-tight">{lead.name}</div>
                                                        <div className="text-[10px] text-gray-400">{lead.email || '-'}</div>
                                                    </div>
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 font-bold">{lead.sent}</td>
                                            <td className="px-6 py-4">
                                                <span className={cn(
                                                    "px-2 py-1 rounded-lg font-black text-[10px]",
                                                    lead.opens > 0 ? "bg-orange-50 text-orange-700" : "bg-gray-50 text-gray-400"
                                                )}>
                                                    {lead.opens} APERTURAS
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={cn(
                                                    "px-2 py-1 rounded-lg font-black text-[10px]",
                                                    lead.clicks > 0 ? "bg-blue-50 text-blue-700" : "bg-gray-50 text-gray-400"
                                                )}>
                                                    {lead.clicks} CLICKS
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleLeadRedirect(lead.id)}
                                                    className="p-2 hover:bg-blue-50 rounded-lg text-blue-400 hover:text-blue-600 transition-all active:scale-90"
                                                    title="Ver perfil del Lead"
                                                >
                                                    <Search className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {heatmapLeads.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-gray-400 text-xs italic">
                                                No hay interacciones registradas en este periodo.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-[10px] text-gray-400 italic text-center">Los datos se sincronizan con los eventos de rastreo en tiempo real.</p>
                    </div>
                </div>

                {/* AI Insights & Active Campaign */}
                <div className="lg:col-span-1 space-y-4">
                    {/* Performance KPIs Section */}
                    <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                        <div
                            onClick={() => navigate('/leads', { state: { leadIds: stats?.opportunityLeadIds } })}
                            className="block transform transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                        >
                            <StatCard
                                title="Oportunidades"
                                value={String(stats?.opportunities || 0)}
                                trend={stats?.opportunityTrend || "+0"}
                                trendUp={true}
                                icon={Users}
                                desc="Leads con cotizaciones"
                                onSettingsClick={(e: any) => {
                                    e.stopPropagation();
                                    setActiveCardFilter(activeCardFilter === 'opps' ? null : 'opps');
                                }}
                                isSettingsActive={activeCardFilter === 'opps'}
                                cardRef={activeCardFilter === 'opps' ? cardFilterRef : null}
                                onDateSelect={(key: DateRange) => {
                                    setSelectedDateRange(key);
                                    setActiveCardFilter(null);
                                }}
                                selectedDateRange={selectedDateRange}
                                getDateRangeLabelDisplay={getDateRangeLabelDisplay}
                            />
                        </div>
                        <div
                            onClick={() => navigate('/cotizaciones')}
                            className="block transform transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                        >
                            <StatCard
                                title="Pipeline Value"
                                value={`$${stats?.pipelineValue.toLocaleString() || "0"}`}
                                trend={stats?.pipelineTrend || "+0%"}
                                trendUp={true}
                                icon={DollarSign}
                                desc="Valor proyectado"
                                onSettingsClick={(e: any) => {
                                    e.stopPropagation();
                                    setActiveCardFilter(activeCardFilter === 'pipeline' ? null : 'pipeline');
                                }}
                                isSettingsActive={activeCardFilter === 'pipeline'}
                                cardRef={activeCardFilter === 'pipeline' ? cardFilterRef : null}
                                onDateSelect={(key: DateRange) => {
                                    setSelectedDateRange(key);
                                    setActiveCardFilter(null);
                                }}
                                selectedDateRange={selectedDateRange}
                                getDateRangeLabelDisplay={getDateRangeLabelDisplay}
                            />
                        </div>
                        <div
                            onClick={() => navigate('/leads', { state: { leadIds: stats?.convertedLeadIds } })}
                            className="block transform transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                        >
                            <StatCard
                                title="Conv. Rate"
                                value={`${stats?.conversionRate || 0}%`}
                                trend={stats?.conversionTrend || "+0%"}
                                trendUp={true}
                                icon={Target}
                                desc="Efectividad Marketing"
                                onSettingsClick={(e: any) => {
                                    e.stopPropagation();
                                    setActiveCardFilter(activeCardFilter === 'conv' ? null : 'conv');
                                }}
                                isSettingsActive={activeCardFilter === 'conv'}
                                cardRef={activeCardFilter === 'conv' ? cardFilterRef : null}
                                onDateSelect={(key: DateRange) => {
                                    setSelectedDateRange(key);
                                    setActiveCardFilter(null);
                                }}
                                selectedDateRange={selectedDateRange}
                                getDateRangeLabelDisplay={getDateRangeLabelDisplay}
                            />
                        </div>
                    </div>

                    <AIInsightsPanel heatmapLeads={heatmapLeads} />

                    {/* Active Campaign Card */}
                    <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] p-6 rounded-3xl text-white relative overflow-hidden shadow-xl shadow-slate-200">
                        {activeCampaign ? (
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-green-400">Campaña Activa</span>
                                </div>
                                <h3 className="text-lg font-bold mb-1 truncate">{activeCampaign.name}</h3>
                                <div className="flex justify-between text-xs text-gray-400 mb-4">
                                    <span>{activeCampaign.sent}/{activeCampaign.total} enviados</span>
                                    <span>{activeCampaign.progress}%</span>
                                </div>
                                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mb-6">
                                    <div
                                        className="bg-gradient-to-r from-blue-400 to-indigo-500 h-full rounded-full shadow-[0_0_8px_rgba(96,165,250,0.5)] transition-all duration-1000"
                                        style={{ width: `${activeCampaign.progress}%` }}
                                    ></div>
                                </div>
                                <Link to={`/marketing/campaign/${activeCampaign.id}/edit`} className="bg-white text-slate-900 px-4 py-2.5 rounded-xl text-sm font-black w-full transition-all flex items-center justify-center gap-2 hover:bg-blue-50 hover:scale-[1.02] active:scale-[0.98]">
                                    Ver Reporte
                                </Link>
                            </div>
                        ) : (
                            <div className="relative z-10 py-8 text-center">
                                <Zap className="w-10 h-10 text-gray-600 mx-auto mb-3 opacity-20" />
                                <p className="text-sm text-gray-500 font-bold">Sin campañas activas hoy</p>
                                <Link to="/marketing/campaign/new" className="mt-4 inline-block text-blue-400 text-xs font-black uppercase tracking-widest hover:text-blue-300">
                                    Crear una ahora +
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function ActionCard({ icon: Icon, color, title, desc, isNew = false }: any) {
    return (
        <div className="w-full bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all text-left group relative overflow-hidden">
            <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                <Icon className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{title}</h3>
            <p className="text-xs text-gray-500 font-medium">{desc}</p>
            {isNew && (
                <span className="absolute top-4 right-4 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                    New
                </span>
            )}
        </div>
    );
}

function StatCard({ title, value, trend, trendUp, icon: Icon, desc, onSettingsClick, isSettingsActive, cardRef, onDateSelect, selectedDateRange, getDateRangeLabelDisplay }: any) {
    return (
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
            <div className="flex justify-between items-start mb-2">
                <div>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{title}</p>
                    <h4 className="text-2xl font-black text-[#0f172a] mt-1">{value}</h4>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative" ref={cardRef}>
                        <button
                            onClick={onSettingsClick}
                            className={`p-1.5 rounded-lg transition-all ${isSettingsActive ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-100/50'}`}
                        >
                            <Settings className="w-3.5 h-3.5" />
                        </button>
                        {isSettingsActive && (
                            <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-2xl border border-indigo-50 z-50 py-2 animate-in fade-in slide-in-from-top-2 overflow-hidden">
                                {(Object.entries(DATE_RANGE_OPTIONS) as [DateRange, { label: string }][]).map(([key, option]) => (
                                    <button
                                        key={key}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDateSelect(key);
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
                    {Icon && (
                        <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-blue-50 transition-colors">
                            <Icon className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                        </div>
                    )}
                </div>
            </div>
            <div className="flex items-center justify-between">
                <p className="text-[10px] text-gray-500 font-medium">{desc}</p>
                <span className={`flex items-center text-[11px] font-black ${trendUp ? 'text-green-500' : 'text-red-500'}`}>
                    {trend}
                    <TrendingUp className={`w-3 h-3 ml-1 ${!trendUp && 'rotate-180'}`} />
                </span>
            </div>
        </div>
    );
}

function AIInsightsPanel({ heatmapLeads }: { heatmapLeads: HeatmapLead[] }) {
    // Generate simple insights based on data
    const hotLeads = heatmapLeads.filter(l => l.clicks > 0).slice(0, 3);

    return (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <Bot className="w-4 h-4 text-indigo-600" />
                </div>
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">IA Sugiere...</h3>
            </div>

            <div className="space-y-3">
                {hotLeads.length > 0 ? hotLeads.map((lead, i) => (
                    <div key={i} className="flex gap-3 items-start p-3 bg-slate-50/50 rounded-2xl border border-transparent hover:border-slate-100 transition-all">
                        <div className="w-2 h-2 bg-orange-500 rounded-full mt-1.5 shadow-[0_0_8px_rgba(249,115,22,0.5)]"></div>
                        <div>
                            <p className="text-xs font-bold text-gray-800 leading-tight">
                                {lead.name} tiene alta intención de compra ({lead.clicks} clicks).
                            </p>
                            <p className="text-[10px] text-gray-500 mt-1 font-medium">Recomendación: Enviar oferta personalizada.</p>
                        </div>
                    </div>
                )) : (
                    <p className="text-xs text-gray-500 italic">No hay suficientes datos para sugerencias hoy.</p>
                )}
            </div>
        </div>
    );
}
