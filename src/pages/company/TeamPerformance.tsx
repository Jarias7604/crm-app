import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Trophy, Users, TrendingUp, TrendingDown, DollarSign, Target, Crown,
    Loader2, ChevronDown, BarChart3, Award, Zap, ArrowUpRight,
    ArrowDownRight, Minus, CalendarDays, CheckCircle, Settings, X, Save,
    Phone, PhoneCall, Sparkles, Printer, Info, Database, Copy, Mail, Clock, Send,
} from 'lucide-react';
import { ActivityDashboard } from '../../components/ActivityDashboard';
import { AIPerformanceChat } from '../../components/AIPerformanceChat';
import toast from 'react-hot-toast';
import { useAuth } from '../../auth/AuthProvider';
import {
    teamPerformanceService,
    getDateRange,
    getPreviousPeriodFilters,
    type UserPerformance,
    type TeamPerformance,
    type PerformanceFilters,
    type CompanySummary,
} from '../../services/teamPerformance';
import { teamsService, type Team } from '../../services/teams';
import { performanceGoalsService, type PerformanceGoal } from '../../services/performanceGoals';
import { forecastService, type ForecastWithActual } from '../../services/forecastService';
import { callActivityService, type CallActivitySummary, type CallGoal, type ContactActivitySummary, ACTION_TYPE_CONFIG, type CallActivity } from '../../services/callActivity';
import { supabase } from '../../services/supabase';

// === WEEKDAY UTILS ===
const getActiveWeekdaysForUser = (companyId: string, userId: string): number[] => {
    const stored = localStorage.getItem(`crm_work_weekdays_${companyId}_${userId}`);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {}
    }
    return [1, 2, 3, 4, 5, 6]; // Default Monday to Saturday
};

const getActiveDaysInMonth = (weekdays: number[]) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    let count = 0;
    const current = new Date(year, month, 1);
    while (current.getMonth() === month) {
        if (weekdays.includes(current.getDay())) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    return count || 24;
};

// === CONSTANTS ===
const PERIODS = [
    { value: 'today', label: 'Hoy', icon: '☀️' },
    { value: 'week', label: 'Última Semana', icon: '📅' },
    { value: 'month', label: 'Este Mes', icon: '📆' },
    { value: 'quarter', label: 'Este Trimestre', icon: '📊' },
    { value: 'year', label: 'Este Año', icon: '🗓️' },
    { value: 'all', label: 'Todo el Tiempo', icon: '♾️' },
    { value: 'custom', label: 'Rango Personalizado', icon: '📅' },
] as const;

// === UTILITIES ===
function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

function formatPercent(value: number): string {
    return `${value.toFixed(1)}%`;
}

function formatResponseTime(hours?: number): string {
    if (hours === undefined || hours === null || hours === 0 || isNaN(hours)) return '—';
    if (hours < 1) {
        const mins = Math.round(hours * 60);
        return `${mins} min`;
    }
    if (hours < 24) {
        return `${hours.toFixed(1)} h`;
    }
    const days = hours / 24;
    return `${days.toFixed(1)} d`;
}

/** Monthly goals are scaled based on the active period filter */
function getGoalScale(period: string): number {
    switch (period) {
        case 'today':
            return 1 / 30;
        case 'week':
            return 1;
        case 'month':
            return 1;
        case 'quarter':
            return 3;
        case 'year':
            return 12;
        case 'all':
            return 12;
        case 'custom':
            return 1;
        default:
            return 1;
    }
}

function getGoalPeriodLabel(period: string): string {
    switch (period) {
        case 'today':
            return 'diario';
        case 'quarter':
            return 'trimestral';
        case 'year':
        case 'all':
            return 'anual';
        default:
            return 'mensual';
    }
}

function getProjectionScalingFactor(filters: PerformanceFilters): number {
    if (filters.period === 'all') return 1;
    
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;
    
    if (filters.period === 'custom') {
        start = filters.date_from ? new Date(filters.date_from) : null;
        end = filters.date_to ? new Date(filters.date_to + 'T23:59:59') : null;
    } else {
        const range = getDateRange(filters);
        start = range.start;
        end = range.end;
    }
    
    if (!start || !end) return 1;
    
    const totalMs = end.getTime() - start.getTime();
    if (totalMs <= 0) return 0;
    
    // If the period has already ended
    if (now.getTime() >= end.getTime()) {
        return 0; // Period is in the past, no future closing possible
    }
    
    // If period is in the future
    if (now.getTime() <= start.getTime()) {
        return 1; // 100% of period remains
    }
    
    // Active period
    const remainingMs = end.getTime() - now.getTime();
    return Math.max(0, Math.min(1, remainingMs / totalMs));
}

// === MAIN COMPONENT ===
export default function TeamPerformancePage() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [userPerformance, setUserPerformance] = useState<UserPerformance[]>([]);
    const [teamPerformance, setTeamPerformance] = useState<TeamPerformance[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'users' | 'teams' | 'charts' | 'forecast' | 'calls'>('users');
    const [filters, setFilters] = useState<PerformanceFilters>({ period: 'all' });

    // Conversion rate calculation mode
    const [conversionMode, setConversionMode] = useState<'real' | 'custom'>(() => {
        const stored = localStorage.getItem('crm_conversion_mode');
        return (stored as any) || 'real';
    });
    const [customConversionRate, setCustomConversionRate] = useState<number>(() => {
        const stored = localStorage.getItem('crm_custom_conversion_rate');
        return stored ? parseFloat(stored) : 15;
    });

    useEffect(() => {
        localStorage.setItem('crm_conversion_mode', conversionMode);
    }, [conversionMode]);

    useEffect(() => {
        localStorage.setItem('crm_custom_conversion_rate', String(customConversionRate));
    }, [customConversionRate]);

    // Restore state from Leads detail page if coming back
    useEffect(() => {
        if (location.state) {
            const state = location.state as any;
            if (state.activeTab) {
                setActiveTab(state.activeTab);
            }
            if (state.filters) {
                setFilters(state.filters);
            }
        }
    }, [location.state]);
    const [profileNames, setProfileNames] = useState<Record<string, string>>({});
    const [profileAvatars, setProfileAvatars] = useState<Record<string, string | null>>({});
    const [companySummary, setCompanySummary] = useState<CompanySummary>({ totalLeads: 0, wonDeals: 0, lostDeals: 0, totalValue: 0, totalClosing: 0 });
    const [previousPerformance, setPreviousPerformance] = useState<UserPerformance[] | null>(null);

    // Call Activity KPIs
    const [callSummary, setCallSummary] = useState<CallActivitySummary[]>([]);
    const [callGoals, setCallGoals] = useState<CallGoal[]>([]);
    const [callStatusEvolution, setCallStatusEvolution] = useState<{ from: string; to: string; count: number }[]>([]);
    const [contactSummary, setContactSummary] = useState<ContactActivitySummary[]>([]);
    const [callLogs, setCallLogs] = useState<CallActivity[]>([]);

    // Goals
    const [goals, setGoals] = useState<PerformanceGoal[]>([]);
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);

    // Dropdown states
    const [isTeamDropdownOpen, setIsTeamDropdownOpen] = useState(false);
    const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
    const [isAiChatOpen, setIsAiChatOpen] = useState(false);
    const teamDropdownRef = useRef<HTMLDivElement>(null);
    const periodDropdownRef = useRef<HTMLDivElement>(null);

    const isAdmin = profile?.role === 'super_admin' || profile?.role === 'company_admin';

    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (teamDropdownRef.current && !teamDropdownRef.current.contains(e.target as Node))
                setIsTeamDropdownOpen(false);
            if (periodDropdownRef.current && !periodDropdownRef.current.contains(e.target as Node))
                setIsPeriodDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadData = useCallback(async () => {
        if (!profile?.company_id) return;
        setLoading(true);
        try {
            const [userData, teamData, teamsData, goalsData, summaryData] = await Promise.all([
                teamPerformanceService.getUserPerformance(profile.company_id, filters),
                teamPerformanceService.getTeamPerformance(profile.company_id, filters),
                teamsService.getTeams(profile.company_id),
                performanceGoalsService.getGoals(profile.company_id),
                teamPerformanceService.getCompanySummary(profile.company_id, filters),
            ]);
            setUserPerformance(userData);
            setTeamPerformance(teamData);
            setTeams(teamsData);
            setGoals(goalsData);
            setCompanySummary(summaryData);

            // Load previous period for trend arrows (non-blocking)
            const prevFilters = getPreviousPeriodFilters(filters);
            if (prevFilters) {
                teamPerformanceService.getUserPerformance(profile.company_id, prevFilters)
                    .then(setPreviousPerformance)
                    .catch(() => setPreviousPerformance(null));
            } else {
                setPreviousPerformance(null);
            }

            const names: Record<string, string> = {};
            const avatars: Record<string, string | null> = {};
            userData.forEach((u) => {
                names[u.user_id] = u.full_name;
                avatars[u.user_id] = u.avatar_url;
            });
            setProfileNames(names);
            setProfileAvatars(avatars);

            // Load call activity data (non-blocking)
            try {
                const dateRange = getDateRange(filters);
                const dateFrom = dateRange.start?.toISOString();
                const dateTo = dateRange.end?.toISOString();
                const [callData, callGoalsData, statusEvo, contactData, logsData] = await Promise.all([
                    callActivityService.getCallSummary(profile.company_id, dateFrom, dateTo),
                    callActivityService.getGoals(profile.company_id),
                    callActivityService.getStatusEvolution(profile.company_id, dateFrom, dateTo),
                    callActivityService.getContactSummary(profile.company_id, dateFrom, dateTo),
                    callActivityService.getCompanyCalls(profile.company_id, dateFrom, dateTo),
                ]);
                setCallSummary(callData);
                setCallGoals(callGoalsData);
                setCallStatusEvolution(statusEvo);
                setContactSummary(contactData);
                setCallLogs(logsData);
            } catch (callErr) {
                console.warn('Call activity data not available yet (tables may not exist):', callErr);
            }
        } catch (err) {
            console.error('Error loading performance data:', err);
        } finally {
            setLoading(false);
        }
    }, [profile?.company_id, filters]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // === COMPUTED (company-wide totals from companySummary for KPI parity with Dashboard) ===
    const totalLeads = companySummary.totalLeads;
    const totalWon = companySummary.wonDeals;
    const totalLost = companySummary.lostDeals;
    const totalClosing = companySummary.totalClosing;
    const totalValue = companySummary.totalValue;
    // Win rate = won / (won + lost) — Salesforce/HubSpot standard
    const decidedTotal = totalWon + totalLost;
    const overallWinRate = decidedTotal > 0 ? (totalWon / decidedTotal) * 100 : 0;
    const topUser = userPerformance.length > 0 ? userPerformance[0] : null;

    const scale = getGoalScale(filters.period);
    const periodLabel = getGoalPeriodLabel(filters.period);

    // Goal lookups
    const getUserGoal = (userId: string) => {
        const g = goals.find((x) => x.user_id === userId && !x.team_id);
        if (!g) return null;
        return { leads: g.goal_leads * scale, value: Number(g.goal_value) * scale };
    };
    const getTeamGoal = (teamId: string) => {
        const g = goals.find((x) => x.team_id === teamId && !x.user_id);
        if (!g) return null;
        return { leads: g.goal_leads * scale, value: Number(g.goal_value) * scale };
    };

    // Dropdown labels
    const selectedTeamLabel = filters.team_id
        ? (() => {
            const t = teams.find((t) => t.id === filters.team_id);
            return t ? `${t.emoji} ${t.name}` : 'Equipo';
        })()
        : 'Todos los Equipos';
    const selectedPeriodLabel = PERIODS.find((p) => p.value === filters.period)?.label || 'Periodo';

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <Loader2 className="w-10 h-10 text-[#4449AA] animate-spin" />
                <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                    Calculando rendimiento...
                </p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[1500px] mx-auto pb-6 space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-200">
                        <Trophy className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-2xl font-extrabold text-[#4449AA] tracking-tight uppercase">
                            Rendimiento <span className="text-gray-900 font-black">de Equipos</span>
                        </h1>
                        <p className="text-[13px] text-gray-400 font-medium">
                            Métricas de ventas, cierres y productividad por persona y equipo
                        </p>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Configure Goals Button */}
                    {isAdmin && (
                        <button
                            onClick={() => setIsGoalModalOpen(true)}
                            className="flex items-center gap-2 bg-gradient-to-r from-violet-500 to-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:shadow-lg hover:shadow-violet-200 transition-all h-10"
                        >
                            <Settings className="w-3.5 h-3.5" />
                            Metas
                        </button>
                    )}

                    {/* Team Filter */}
                    <div className="relative" ref={teamDropdownRef}>
                        <button
                            onClick={() => { setIsTeamDropdownOpen(!isTeamDropdownOpen); setIsPeriodDropdownOpen(false); }}
                            className={`flex items-center space-x-2 bg-white border px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-all shadow-sm h-10 min-w-[180px] justify-between ${filters.team_id ? 'border-blue-300 text-blue-600' : 'border-gray-100 text-[#4449AA]'}`}
                        >
                            <div className="flex items-center gap-2">
                                <Users className="h-3.5 w-3.5" />
                                <span className="truncate max-w-[130px]">{selectedTeamLabel}</span>
                            </div>
                            <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-300 ${isTeamDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isTeamDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-50 z-50 py-2 animate-in fade-in slide-in-from-top-2">
                                <button onClick={() => { setFilters({ ...filters, team_id: undefined }); setIsTeamDropdownOpen(false); }} className={`w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-between ${!filters.team_id ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>
                                    <span>Todos los Equipos</span>
                                    {!filters.team_id && <CheckCircle className="w-4 h-4 text-blue-500" />}
                                </button>
                                <div className="border-t border-gray-100 my-1" />
                                {teams.map((t) => (
                                    <button key={t.id} onClick={() => { setFilters({ ...filters, team_id: t.id }); setIsTeamDropdownOpen(false); }} className={`w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-between ${filters.team_id === t.id ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>
                                        <span className="flex items-center gap-2"><span className="text-sm">{t.emoji}</span>{t.name}</span>
                                        {filters.team_id === t.id && <CheckCircle className="w-4 h-4 text-blue-500" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Period Filter */}
                    <div className="relative" ref={periodDropdownRef}>
                        <button
                            onClick={() => { setIsPeriodDropdownOpen(!isPeriodDropdownOpen); setIsTeamDropdownOpen(false); }}
                            className={`flex items-center space-x-2 bg-white border px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-all shadow-sm h-10 min-w-[180px] justify-between ${filters.period !== 'all' ? 'border-violet-300 text-violet-600' : 'border-gray-100 text-[#4449AA]'}`}
                        >
                            <div className="flex items-center gap-2">
                                <CalendarDays className="h-3.5 w-3.5" />
                                <span className="truncate max-w-[140px]">{selectedPeriodLabel}</span>
                            </div>
                            <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-300 ${isPeriodDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isPeriodDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-50 z-50 py-2 animate-in fade-in slide-in-from-top-2">
                                {PERIODS.map((p) => (
                                    <button key={p.value} onClick={() => { const period = p.value; setFilters(period === 'custom' ? { ...filters, period, date_from: new Date(Date.now() - 13 * 86400000).toISOString().split('T')[0], date_to: new Date().toISOString().split('T')[0] } : { ...filters, period, date_from: undefined, date_to: undefined }); setIsPeriodDropdownOpen(false); }} className={`w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-between ${filters.period === p.value ? 'bg-violet-50 text-violet-600' : 'text-gray-500 hover:bg-gray-50'}`}>
                                        <span className="flex items-center gap-2"><span className="text-sm">{p.icon}</span>{p.label}</span>
                                        {filters.period === p.value && <CheckCircle className="w-4 h-4 text-violet-500" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Custom Date Range */}
                    {filters.period === 'custom' && (
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 h-10">
                                <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
                                <input type="date" value={filters.date_from || ''} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} className="text-[11px] font-bold text-gray-600 outline-none bg-transparent w-[110px]" />
                            </div>
                            <span className="text-[9px] font-black text-gray-300 uppercase">a</span>
                            <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 h-10">
                                <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
                                <input type="date" value={filters.date_to || ''} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} className="text-[11px] font-bold text-gray-600 outline-none bg-transparent w-[110px]" />
                            </div>
                        </div>
                    )}

                    {/* Reference Conversion Mode */}
                    <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-3 h-10 shadow-sm">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">Conversión Ref.</span>
                        <select
                            value={conversionMode}
                            onChange={(e) => setConversionMode(e.target.value as any)}
                            className="text-[11px] font-black text-slate-700 bg-transparent outline-none cursor-pointer border-none py-1"
                        >
                            <option value="real">Real del Periodo</option>
                            <option value="custom">Meta Personalizada</option>
                        </select>
                        {conversionMode === 'custom' && (
                            <div className="flex items-center gap-1 border-l border-gray-200 pl-2 ml-1 shrink-0">
                                <input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={customConversionRate}
                                    onChange={(e) => setCustomConversionRate(Math.min(100, Math.max(1, parseFloat(e.target.value) || 0)))}
                                    className="w-10 text-center text-[11px] font-black text-indigo-600 outline-none focus:bg-indigo-50 rounded"
                                />
                                <span className="text-[10px] font-bold text-gray-400">%</span>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Global Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                <StatCard icon={Target} label="Total Leads" value={String(totalLeads)} bg="bg-blue-50" iconColor="text-blue-500" />
                <StatCard icon={Trophy} label="Ganados" value={String(totalWon)} bg="bg-emerald-50" iconColor="text-emerald-500" />
                <StatCard icon={TrendingUp} label="Tasa de Cierre" value={formatPercent(overallWinRate)} bg="bg-violet-50" iconColor="text-violet-500" />
                <StatCard icon={DollarSign} label="Valor Pipeline" value={formatCurrency(totalValue)} bg="bg-amber-50" iconColor="text-amber-500" />
                <StatCard icon={Zap} label="Monto Cerrado" value={formatCurrency(totalClosing)} bg="bg-rose-50" iconColor="text-rose-500" />
                <StatCard icon={ArrowUpRight} label="Conversión Pipeline" value={totalValue > 0 ? `${Math.min(100, Math.round((totalClosing / totalValue) * 100))}%` : '0%'} bg={totalValue > 0 && (totalClosing / totalValue) >= 0.6 ? 'bg-emerald-50' : totalValue > 0 && (totalClosing / totalValue) >= 0.3 ? 'bg-amber-50' : 'bg-red-50'} iconColor={totalValue > 0 && (totalClosing / totalValue) >= 0.6 ? 'text-emerald-500' : totalValue > 0 && (totalClosing / totalValue) >= 0.3 ? 'text-amber-500' : 'text-red-500'} />
            </div>

            {/* Top Performer Highlight */}
            {topUser && topUser.total_leads > 0 && (
                <div className="bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 rounded-2xl border border-amber-100 p-5 flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-200 shrink-0">
                        <Crown className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-0.5">🏆 TOP PERFORMER</p>
                        <p className="text-lg font-black text-gray-900 tracking-tight truncate">{topUser.full_name}</p>
                        <div className="flex items-center gap-4 mt-1">
                            <span className="text-[11px] font-bold text-gray-500">{topUser.leads_won} cierre{topUser.leads_won !== 1 ? 's' : ''}</span>
                            <span className="text-[11px] font-bold text-emerald-600">{formatPercent(topUser.win_rate)} tasa de cierre</span>
                            <span className="text-[11px] font-bold text-amber-600">{formatCurrency(topUser.total_closing_amount)} cerrado</span>
                        </div>
                    </div>
                    {topUser.team_names.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 shrink-0">
                            {topUser.team_names.map((name, i) => (
                                <span key={name} className="px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest text-white" style={{ backgroundColor: topUser.team_colors[i] || '#4449AA' }}>{name}</span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Tabs & AI */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
                    {([
                        { key: 'users' as const, icon: Users, label: 'Por Persona' },
                        { key: 'teams' as const, icon: BarChart3, label: 'Por Equipo' },
                        { key: 'calls' as const, icon: PhoneCall, label: '📊 Actividad' },
                        { key: 'charts' as const, icon: TrendingUp, label: 'Gráficas' },
                        { key: 'forecast' as const, icon: Target, label: '📊 Forecast' },
                    ] as const).map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.key ? 'bg-white text-[#4449AA] shadow-sm' : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            <tab.icon className="w-3.5 h-3.5 inline mr-1.5" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <button
                    onClick={() => setIsAiChatOpen(true)}
                    className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl shadow-[0_4px_14px_rgba(147,51,234,0.39)] transition-all transform hover:scale-105"
                >
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Sofía AI Analyst</span>
                </button>
            </div>

            {/* Content */}
            {activeTab === 'users' ? (
                <UserPerformanceTable 
                    data={userPerformance} 
                    getUserGoal={getUserGoal} 
                    periodLabel={periodLabel} 
                    scale={scale} 
                    companySummary={companySummary} 
                    previousData={previousPerformance} 
                    filters={filters} 
                    conversionMode={conversionMode}
                    customConversionRate={customConversionRate}
                />
            ) : activeTab === 'teams' ? (
                <TeamPerformanceGrid data={teamPerformance} profileNames={profileNames} profileAvatars={profileAvatars} getTeamGoal={getTeamGoal} periodLabel={periodLabel} />
            ) : activeTab === 'calls' ? (
                <CallActivitySection
                    callSummary={callSummary}
                    callGoals={callGoals}
                    statusEvolution={callStatusEvolution}
                    contactSummary={contactSummary}
                    profileNames={profileNames}
                    profileAvatars={profileAvatars}
                    companyId={profile?.company_id || ''}
                    isAdmin={isAdmin}
                    onGoalsSaved={() => loadData()}
                    filters={filters}
                    callLogs={callLogs}
                    userPerformance={userPerformance}
                    getUserGoal={getUserGoal}
                    conversionMode={conversionMode}
                    customConversionRate={customConversionRate}
                />
            ) : activeTab === 'forecast' ? (
                <ForecastSection companyId={profile?.company_id || ''} isAdmin={isAdmin} />
            ) : (
                <PerformanceCharts
                    userPerformance={userPerformance}
                    teamPerformance={teamPerformance}
                    getUserGoal={getUserGoal}
                    getTeamGoal={getTeamGoal}
                    periodLabel={periodLabel}
                />
            )}

            {/* Goal Config Modal */}
            {isGoalModalOpen && (
                <GoalConfigModal
                    userPerformance={userPerformance}
                    teams={teams}
                    goals={goals}
                    callSummary={callSummary}
                    callGoals={callGoals}
                    companyId={profile?.company_id || ''}
                    onClose={() => setIsGoalModalOpen(false)}
                    onSaved={() => {
                        setIsGoalModalOpen(false);
                        loadData();
                    }}
                />
            )}

            {/* AI Performance Chat */}
            <AIPerformanceChat
                companyId={profile?.company_id || ''}
                isOpen={isAiChatOpen}
                onClose={() => setIsAiChatOpen(false)}
                performanceContext={{ userPerformance, callSummary, profileNames }}
            />
        </div>
    );
}

// === SUB-COMPONENTS ===

function StatCard({ icon: Icon, label, value, bg, iconColor }: { icon: any; label: string; value: string; bg: string; iconColor: string }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${iconColor}`} />
                </div>
                <div className="min-w-0">
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
                    <p className="text-lg font-black text-gray-900 tracking-tight truncate">{value}</p>
                </div>
            </div>
        </div>
    );
}

// === GOAL PROGRESS BAR ===
function GoalProgressBar({ actual, goal, goalToDate, type = 'number' }: { actual: number; goal: number; goalToDate?: number; type?: 'number' | 'currency' }) {
    const pct = goal > 0 ? Math.min((actual / goal) * 100, 100) : 0;
    const color = pct >= 80 ? 'from-emerald-400 to-emerald-500' : pct >= 50 ? 'from-amber-400 to-amber-500' : 'from-red-400 to-red-500';
    const label = type === 'currency' ? formatCurrency(goal) : String(goal);
    // Deviation vs today's pro-rated goal
    const deviation = goalToDate != null ? actual - goalToDate : null;
    const deviationLabel = deviation != null ? (deviation >= 0 ? `+${Math.round(deviation)}` : String(Math.round(deviation))) : null;
    const deviationColor = deviation != null ? (deviation >= 0 ? 'text-emerald-600' : 'text-rose-500') : '';

    return (
        <div className="mt-1">
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[7px] font-bold text-gray-400 mt-0.5 flex items-center gap-1">
                <span>{pct.toFixed(0)}% de {label}</span>
                {deviationLabel && goalToDate != null && goalToDate > 0 && (
                    <span className={`font-black ${deviationColor}`} title={`Meta a la fecha: ${type === 'currency' ? formatCurrency(goalToDate) : Math.round(goalToDate)}`}>
                        ({deviationLabel})
                    </span>
                )}
            </p>
        </div>
    );
}

function UserPerformanceTable({ 
    data, 
    getUserGoal, 
    periodLabel, 
    scale, 
    companySummary, 
    previousData, 
    filters,
    conversionMode = 'real',
    customConversionRate = 15
}: {
    data: UserPerformance[];
    getUserGoal: (userId: string) => { leads: number; value: number } | null;
    periodLabel: string;
    scale: number;
    companySummary?: CompanySummary;
    previousData?: UserPerformance[] | null;
    filters: PerformanceFilters;
    conversionMode?: 'real' | 'custom';
    customConversionRate?: number;
}) {
    const navigate = useNavigate();
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
    if (data.length === 0) {
        return (
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-16 flex flex-col items-center text-center">
                <Users className="w-12 h-12 text-gray-200 mb-4" />
                <p className="text-[12px] font-black text-gray-400 uppercase tracking-widest mb-1">Sin datos</p>
                <p className="text-[11px] text-gray-400">No hay datos de rendimiento para el periodo seleccionado</p>
            </div>
        );
    }

    const hasAnyGoals = data.some((u) => getUserGoal(u.user_id) !== null);

    return (
        <div className="bg-white rounded-[2rem] border border-gray-100/50 shadow-[0_8px_40px_rgb(0,0,0,0.03)] overflow-hidden">
            {hasAnyGoals && (
                <div className="px-6 py-2 bg-violet-50/50 border-b border-violet-100">
                    <p className="text-[9px] font-black text-violet-500 uppercase tracking-widest">
                        📊 Metas {periodLabel === 'diario' ? 'diarias' : `${periodLabel}es`} activas — las barras de progreso muestran el avance vs meta
                    </p>
                </div>
            )}
            <div className="grid grid-cols-12 gap-2 px-6 py-3 bg-gray-50/80 border-b border-gray-100 text-[8px] font-black text-gray-400 uppercase tracking-widest">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-2">Vendedor</div>
                <div className="col-span-1 text-center">Leads</div>
                <div className="col-span-1 text-center">Ganados</div>
                <div className="col-span-1 text-center">Perdidos</div>
                <div className="col-span-1 text-center flex flex-col items-center justify-center">
                    <span className="text-[7.5px] font-black uppercase tracking-wider text-slate-500">Cierre</span>
                    <span className="text-[6.5px] text-violet-500 font-bold uppercase tracking-wider">Conv. Real</span>
                </div>
                <div className="col-span-1 text-center flex items-center justify-center gap-1">
                    Abordaje
                    <span className="relative group inline-block cursor-help text-gray-400 hover:text-gray-650 transition-colors">
                        <span className="w-3.5 h-3.5 rounded-full border border-gray-300 hover:border-gray-400 flex items-center justify-center text-[9px] font-black leading-none font-sans">!</span>
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-900 text-white text-[10px] rounded-xl p-3.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl whitespace-normal leading-normal font-medium normal-case">
                            <p className="font-black border-b border-white/10 pb-1 mb-1 text-white uppercase tracking-wider text-[8px]">Tiempo de Abordaje Promedio</p>
                            <p className="text-white/90 text-left">Tiempo transcurrido desde la asignación del lead hasta el registro del primer seguimiento. ¡Un abordaje rápido evita que los leads se enfríen e incrementa la conversión en más de 300%!</p>
                            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                        </span>
                    </span>
                </div>
                <div className="col-span-1 text-center">Días/Cierre</div>
                <div className="col-span-1 text-right">Avg Deal</div>
                <div className="col-span-1 text-right">Pipeline</div>
                <div className="col-span-1 text-right">Monto Cerrado</div>
            </div>
            <div className="divide-y divide-gray-50">
                {data.map((user, index) => {
                    const goal = getUserGoal(user.user_id);
                    const prev = previousData?.find(p => p.user_id === user.user_id);
                    // Trend helpers
                    const wonDiff = prev != null ? user.leads_won - prev.leads_won : null;
                    const closingDiff = prev != null ? user.total_closing_amount - prev.total_closing_amount : null;
                    const isExpanded = expandedUserId === user.user_id;
                    return (
                        <Fragment key={user.user_id}>
                            <div 
                                onClick={() => setExpandedUserId(isExpanded ? null : user.user_id)}
                                className={`grid grid-cols-12 gap-2 px-6 py-4 items-center hover:bg-gray-50/50 transition-all duration-200 group cursor-pointer ${
                                    isExpanded ? 'bg-indigo-50/10 border-l-4 border-indigo-500 pl-5' : ''
                                }`}
                            >
                                {/* Rank */}
                                <div className="col-span-1 flex justify-center">
                                    {index === 0 ? (
                                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm"><span className="text-[10px] font-black text-white">1</span></div>
                                    ) : index === 1 ? (
                                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center shadow-sm"><span className="text-[10px] font-black text-white">2</span></div>
                                    ) : index === 2 ? (
                                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center shadow-sm"><span className="text-[10px] font-black text-white">3</span></div>
                                    ) : (
                                        <span className="text-[11px] font-bold text-gray-300">{index + 1}</span>
                                    )}
                                </div>
                                {/* User Info */}
                                <div className="col-span-2 flex items-center gap-2 min-w-0">
                                    <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden shrink-0 border border-gray-200/40">
                                        {user.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover" alt="" /> : <Users className="w-4 h-4 text-gray-300" />}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-black text-gray-800 uppercase tracking-tight truncate flex items-center gap-1">
                                            {user.full_name}
                                            <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform duration-300 shrink-0 group-hover:text-gray-650 ${isExpanded ? 'rotate-180 text-indigo-500' : ''}`} />
                                        </p>
                                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                            {user.team_names.length > 0 ? user.team_names.map((name, i) => (
                                                <span key={name} className="px-1.5 py-0.5 rounded text-[7px] font-black uppercase text-white" style={{ backgroundColor: user.team_colors[i] || '#999' }}>{name}</span>
                                            )) : <span className="text-[9px] text-gray-300 font-medium">Sin equipo</span>}
                                        </div>
                                    </div>
                                </div>
                                {/* Leads */}
                                <div className="col-span-1 text-center">
                                    {user.total_leads > 0 ? (
                                        <span className="text-[13px] font-black text-gray-700 cursor-pointer hover:text-blue-600 hover:underline transition-colors" onClick={(e) => { e.stopPropagation(); navigate('/leads', { state: { assignedFilter: user.user_id } }); }}>{user.total_leads}</span>
                                    ) : <span className="text-[13px] font-black text-gray-700">{user.total_leads}</span>}
                                </div>
                                {/* Won */}
                                <div className="col-span-1 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                        {user.leads_won > 0 ? (
                                            <span className="text-[13px] font-black text-emerald-600 cursor-pointer hover:text-emerald-800 hover:underline transition-colors" onClick={(e) => { e.stopPropagation(); navigate('/leads', { state: { assignedFilter: user.user_id, status: ['Cerrado', 'Cliente'] } }); }}>{user.leads_won}</span>
                                        ) : <span className="text-[13px] font-black text-emerald-600">{user.leads_won}</span>}
                                        {goal && goal.leads > 0 && (() => {
                                            // Deviation vs FULL period goal (how many more wins needed)
                                            // goal.leads already has scale applied, divide back to get base monthly goal for display
                                            const baseGoal = scale > 0 ? Math.round(goal.leads / scale) : goal.leads;
                                            const remaining = user.leads_won - baseGoal;
                                            const devLabel = remaining >= 0 ? `+${remaining}` : String(remaining);
                                            const devColor = remaining >= 0 ? 'text-emerald-500' : 'text-rose-500';
                                            return (
                                                <span className={`text-[8px] font-black ${devColor}`} title={`Meta mensual: ${baseGoal} cierres`}>
                                                    {devLabel}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                    {goal && goal.leads > 0 && (
                                        <GoalProgressBar
                                            actual={user.leads_won}
                                            goal={scale > 0 ? Math.round(goal.leads / scale) : goal.leads}
                                            goalToDate={undefined}
                                        />
                                    )}
                                </div>
                                {/* Lost */}
                                <div className="col-span-1 text-center">
                                    {user.leads_lost > 0 ? (
                                        <span className="text-[13px] font-black text-red-400 cursor-pointer hover:text-red-600 hover:underline transition-colors" onClick={(e) => { e.stopPropagation(); navigate('/leads', { state: { assignedFilter: user.user_id, status: 'Perdido' } }); }}>{user.leads_lost}</span>
                                    ) : <span className="text-[13px] font-black text-red-400">{user.leads_lost}</span>}
                                </div>
                                {/* Win Rate & Conversion Rate */}
                                <div className="col-span-1 flex flex-col items-center gap-0.5 justify-center">
                                    <WinRateBadge rate={user.win_rate} />
                                    <span className="text-[9px] font-bold text-slate-500 bg-slate-50 border border-slate-100/50 rounded px-1.5 py-0.5" title="Conversión de todos los leads asignados">
                                        {user.conversion_rate.toFixed(1)}% Real
                                    </span>
                                </div>
                                {/* Abordaje */}
                                <div className="col-span-1 text-center">
                                    <span className={`text-[12px] font-black ${user.avg_response_time && user.avg_response_time > 0 ? (user.avg_response_time <= 2 ? 'text-emerald-650' : user.avg_response_time <= 24 ? 'text-amber-600' : 'text-rose-600') : 'text-gray-300'}`}>
                                        {formatResponseTime(user.avg_response_time)}
                                    </span>
                                </div>
                                {/* Días/Cierre */}
                                <div className="col-span-1 text-center">
                                    {user.avg_days_to_close > 0 ? (
                                        <div className="flex flex-col items-center">
                                            <span className="text-[12px] font-black text-violet-600">{user.avg_days_to_close}d</span>
                                            <span className="text-[7px] text-gray-400 font-bold">prom. cierre</span>
                                        </div>
                                    ) : <span className="text-[11px] text-gray-300 font-bold">—</span>}
                                </div>
                                {/* Avg Deal */}
                                <div className="col-span-1 text-right">
                                    {user.avg_deal_size > 0 ? (
                                        <div className="flex flex-col items-end">
                                            <span className="text-[11px] font-black text-amber-600">{formatCurrency(user.avg_deal_size)}</span>
                                            <span className="text-[7px] text-gray-400 font-bold">avg deal</span>
                                        </div>
                                    ) : <span className="text-[11px] text-gray-300">—</span>}
                                </div>
                                {/* Pipeline Value */}
                                <div className="col-span-1 text-right">
                                    <span className="text-[11px] font-black text-gray-500">{formatCurrency(user.total_value)}</span>
                                </div>
                                {/* Closing Amount */}
                                <div className="col-span-1 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <span className="text-[13px] font-black text-[#4449AA]">{formatCurrency(user.total_closing_amount)}</span>
                                        {closingDiff !== null && closingDiff !== 0 && (
                                            <span className={`text-[8px] font-black ${closingDiff > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                                                {closingDiff > 0 ? `+${formatCurrency(closingDiff)}` : formatCurrency(closingDiff)}
                                            </span>
                                        )}
                                    </div>
                                    {goal && goal.value > 0 && <GoalProgressBar actual={user.total_closing_amount} goal={goal.value} type="currency" />}
                                </div>
                            </div>

                            {/* Row Expanded Details Card */}
                            {isExpanded && (() => {
                                const totalWon = data.reduce((s, u) => s + u.leads_won, 0);
                                const totalLeads = data.reduce((s, u) => s + u.total_leads, 0);
                                const companyConversionRate = totalLeads > 0 ? (totalWon / totalLeads) * 100 : 15;
                                const realRate = user.conversion_rate > 0 ? user.conversion_rate : companyConversionRate;
                                const rate = conversionMode === 'custom' ? customConversionRate : realRate;

                                return (
                                    <div className="col-span-12 px-8 py-6 bg-slate-50/50 border-t border-b border-slate-100 space-y-6">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {/* Card 1: Cost of Opportunity (Impacto Negativo) */}
                                            <div className={`rounded-2xl border p-5 bg-white shadow-sm transition-all duration-300 ${user.leads_without_follow_up > 0 ? 'border-rose-100 hover:shadow-rose-50/30 shadow-rose-100/5' : 'border-slate-100 hover:shadow-slate-100/30'}`}>
                                                <div className="flex items-center justify-between mb-4">
                                                    <h5 className="text-[10.5px] font-black text-rose-850 uppercase tracking-widest flex items-center gap-1.5">
                                                        ⚠️ Oportunidad Perdida por Falta de Seguimiento
                                                    </h5>
                                                    <span className={`text-[8px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${user.leads_without_follow_up > 0 ? 'bg-rose-50 text-rose-600 border border-rose-100/30' : 'bg-emerald-50 text-emerald-600 border border-emerald-100/30'}`}>
                                                        {user.leads_without_follow_up > 0 ? 'Pérdidas Detectadas' : 'Eficiencia Máxima'}
                                                    </span>
                                                </div>
                                                {user.leads_without_follow_up > 0 ? (
                                                    <div className="space-y-4">
                                                        <p className="text-[11.5px] text-slate-500 font-semibold leading-relaxed">
                                                            Este asesor tiene <span className="text-slate-850 font-black">{user.leads_without_follow_up} leads sin ningún seguimiento</span>. Al no contactarlos, se asume un impacto negativo en su embudo:
                                                        </p>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="bg-rose-50/20 border border-rose-100/30 rounded-xl p-3.5">
                                                                <p className="text-[8.5px] font-bold text-rose-700 uppercase tracking-wider mb-0.5">Cierres Perdidos (Est.)</p>
                                                                <p className="text-xl font-black text-rose-600">
                                                                    -{(user.leads_without_follow_up * (rate / 100)).toFixed(1)} <span className="text-[9px] text-rose-450 font-bold">ventas</span>
                                                                </p>
                                                            </div>
                                                            <div className="bg-rose-50/20 border border-rose-100/30 rounded-xl p-3.5">
                                                                <p className="text-[8.5px] font-bold text-rose-700 uppercase tracking-wider mb-0.5">Monto de Pérdida (Est.)</p>
                                                                <p className="text-xl font-black text-rose-600">
                                                                    -{formatCurrency((user.leads_without_follow_up * (rate / 100)) * user.avg_deal_size)} USD
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-[11.5px] text-emerald-800 font-semibold leading-relaxed">
                                                        ¡Excelente! Este asesor no tiene leads activos sin seguimiento. Su costo de oportunidad es <span className="font-extrabold text-emerald-600">$0.00 USD</span>.
                                                    </p>
                                                )}
                                            </div>

                                            {/* Card 2: Potential Ideal Scenario (Escenario Ideal con Seguimiento Completo) */}
                                            <div className="rounded-2xl border p-5 bg-white shadow-sm transition-all duration-300 border-emerald-100 hover:shadow-emerald-50/30 shadow-emerald-100/5">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h5 className="text-[10.5px] font-black text-emerald-850 uppercase tracking-widest flex items-center gap-1.5">
                                                        🏆 Escenario Ideal (Si Hiciera el 100% de Seguimientos)
                                                    </h5>
                                                    <span className="text-[8px] font-black px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100/30 uppercase tracking-wider">
                                                        Rendimiento Máximo
                                                    </span>
                                                </div>
                                                {(() => {
                                                    const lostLeadsEst = user.leads_without_follow_up * (rate / 100);
                                                    const lostRevenueEst = lostLeadsEst * user.avg_deal_size;
                                                    const potentialLeadsWon = user.leads_won + lostLeadsEst;
                                                    const potentialRevenue = user.total_closing_amount + lostRevenueEst;
                                                    const targetLeads = goal?.leads || 0;
                                                    
                                                    return (
                                                        <div className="space-y-4">
                                                            <p className="text-[11.5px] text-slate-500 font-semibold leading-relaxed">
                                                                Si se hubieran contactado todos los leads perdidos, su potencial de cierre estimado basado en su tasa de conversión del {rate.toFixed(1)}% sería:
                                                            </p>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="bg-emerald-50/20 border border-emerald-100/30 rounded-xl p-3.5">
                                                                    <p className="text-[8.5px] font-bold text-emerald-700 uppercase tracking-wider mb-0.5">Ventas Potenciales</p>
                                                                    <p className="text-xl font-black text-emerald-600">
                                                                        {potentialLeadsWon.toFixed(1)} <span className="text-[9px] text-emerald-500 font-bold">cierres</span>
                                                                    </p>
                                                                </div>
                                                                <div className="bg-emerald-50/20 border border-emerald-100/30 rounded-xl p-3.5">
                                                                    <p className="text-[8.5px] font-bold text-emerald-700 uppercase tracking-wider mb-0.5">Facturación Potencial</p>
                                                                    <p className="text-xl font-black text-emerald-600">
                                                                        {formatCurrency(potentialRevenue)} USD
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            {targetLeads > 0 && (
                                                                <div className="text-[10px] font-bold mt-2">
                                                                    {potentialLeadsWon >= targetLeads ? (
                                                                        <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100/30 inline-block">
                                                                            🎉 ¡Con seguimiento completo habría superado su meta de {targetLeads} cierres! (Logrando {potentialLeadsWon.toFixed(1)})
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-amber-605 bg-amber-50 px-2 py-1 rounded border border-amber-100/30 inline-block">
                                                                            ⚠ Con seguimiento completo habría cerrado {potentialLeadsWon.toFixed(1)} (brecha de {(targetLeads - potentialLeadsWon).toFixed(1)} vs la meta de {targetLeads}).
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                            {/* Card 3: Forecast closing (Proyección Realista) */}
                                            <div className="rounded-2xl border border-slate-100 p-5 bg-white shadow-sm hover:shadow-slate-100/30 transition-all duration-300">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h5 className="text-[10.5px] font-black text-indigo-850 uppercase tracking-widest flex items-center gap-1.5">
                                                        📈 Proyección Realista al Cierre (Con Embudo Activo)
                                                    </h5>
                                                    <span className="text-[8px] font-black px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-650 border border-indigo-100/30 uppercase tracking-wider">
                                                        Pipeline Proyectado
                                                    </span>
                                                </div>
                                                {(() => {
                                                    const projectionFactor = getProjectionScalingFactor(filters);
                                                    const projLeads = Math.round(user.leads_won + (user.leads_active * (rate / 100) * projectionFactor));
                                                    const projValue = Math.round(user.total_closing_amount + (user.total_value * (rate / 100) * projectionFactor));
                                                    const targetLeads = goal?.leads || 0;
                                                    const targetValue = goal?.value || 0;
                                                    const valueDiff = projValue - targetValue;

                                                    return (
                                                        <div className="space-y-4">
                                                            <p className="text-[11.5px] text-slate-500 font-semibold leading-relaxed">
                                                                Basado en su conversión real ({rate.toFixed(1)}%) aplicada a sus {user.leads_active} leads activos en pipeline (valorados en {formatCurrency(user.total_value)} USD):
                                                            </p>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                                                                    <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Cierres Proyectados</p>
                                                                    <p className="text-xl font-black text-slate-800">
                                                                        {projLeads} <span className="text-[9px] text-slate-400 font-bold">de meta {targetLeads}</span>
                                                                    </p>
                                                                </div>
                                                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                                                                    <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Monto Proyectado</p>
                                                                    <p className="text-xl font-black text-slate-800">
                                                                        {formatCurrency(projValue)} <span className="text-[9px] text-slate-400 font-bold">USD</span>
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            {targetValue > 0 && (
                                                                <p className="text-[10px] font-bold mt-2">
                                                                    {valueDiff >= 0 ? (
                                                                        <span className="text-emerald-600">✓ Superávit proyectado de +{formatCurrency(valueDiff)} USD sobre la meta.</span>
                                                                    ) : (
                                                                        <span className="text-rose-600">✗ Brecha proyectada de -{formatCurrency(Math.abs(valueDiff))} USD para la meta.</span>
                                                                    )}
                                                                </p>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                            {/* Card 4: Transparencia y Origen de Datos (Data Provenance) */}
                                            <div className="rounded-2xl border border-slate-100 p-5 bg-slate-50/40 shadow-sm hover:shadow-slate-100/20 transition-all duration-300 flex flex-col justify-between">
                                                <div>
                                                    <div className="flex items-center justify-between mb-4">
                                                        <h5 className="text-[10.5px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                                                            <Database className="w-3.5 h-3.5 text-slate-500" />
                                                            Procedencia y Transparencia de Datos
                                                        </h5>
                                                        <span className="text-[8px] font-black px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200/50 uppercase tracking-wider flex items-center gap-1">
                                                            <Info className="w-3 h-3 text-slate-400" />
                                                            Datos Reales
                                                        </span>
                                                    </div>
                                                    <div className="space-y-3 text-[10.5px] text-slate-500 leading-normal">
                                                        <div>
                                                            <p className="font-extrabold text-slate-700">🔍 Leads sin Seguimiento:</p>
                                                            <p>Obtenido en tiempo real filtrando los leads activos asignados al vendedor que no registran llamadas telefónicas ni notas de seguimiento en la bitácora del CRM.</p>
                                                        </div>
                                                        <div>
                                                            <p className="font-extrabold text-slate-700">📊 Tasa de Conversión Real:</p>
                                                            <p>Calculado del historial de leads del vendedor: <code className="font-mono text-[9px] bg-slate-100 px-1 py-0.5 rounded text-indigo-600">(Ganados / Total Asignados)</code>. Esto mide la probabilidad matemática de cerrar un lead aleatorio.</p>
                                                        </div>
                                                        <div>
                                                            <p className="font-extrabold text-slate-700">🎯 Meta del Periodo ({periodLabel}):</p>
                                                            <p>Meta mensual configurada de {goal ? (goal.leads / scale).toFixed(0) : 0} cierres, multiplicada proporcionalmente por la escala de tiempo seleccionada ({scale.toFixed(1)}x).</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="mt-4 pt-3 border-t border-slate-200/40 flex items-center justify-between text-[8.5px] font-black text-slate-400 uppercase tracking-wider">
                                                    <span>Auditoría de Datos Activa</span>
                                                    <span>Arias CRM Engine</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </Fragment>
                    );
                })}
                {/* Unassigned row if there are leads not assigned to any user */}
                {companySummary && (() => {
                    const assignedLeads = data.reduce((s, u) => s + u.total_leads, 0);
                    const assignedWon = data.reduce((s, u) => s + u.leads_won, 0);
                    const assignedLost = data.reduce((s, u) => s + u.leads_lost, 0);
                    const assignedValue = data.reduce((s, u) => s + u.total_value, 0);
                    const assignedClosing = data.reduce((s, u) => s + u.total_closing_amount, 0);
                    const unLeads = companySummary.totalLeads - assignedLeads;
                    const unWon = companySummary.wonDeals - assignedWon;
                    const unLost = companySummary.lostDeals - assignedLost;
                    const unValue = companySummary.totalValue - assignedValue;
                    const unClosing = companySummary.totalClosing - assignedClosing;
                    if (unLeads <= 0 && unWon <= 0) return null;
                    return (
                        <div className="grid grid-cols-12 gap-2 px-6 py-4 items-center bg-gray-50/80 border-t border-gray-200">
                            <div className="col-span-1 flex justify-center">
                                <span className="text-[11px] font-bold text-gray-300">—</span>
                            </div>
                            <div className="col-span-3 flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                                    <Users className="w-4 h-4 text-gray-400" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[12px] font-black text-gray-400 uppercase tracking-tight">Sin Asignar</p>
                                    <span className="text-[9px] text-gray-300 font-medium">Leads sin vendedor</span>
                                </div>
                            </div>
                            <div className="col-span-1 text-center">
                                {unLeads > 0 ? (
                                    <span className="text-[13px] font-black text-gray-400 cursor-pointer hover:text-blue-600 hover:underline transition-colors" onClick={() => navigate('/leads', { state: { assignedFilter: 'unassigned' } })}>{unLeads}</span>
                                ) : <span className="text-[13px] font-black text-gray-400">{unLeads}</span>}
                            </div>
                            <div className="col-span-1 text-center">
                                {unWon > 0 ? (
                                    <span className="text-[13px] font-black text-emerald-400 cursor-pointer hover:text-emerald-600 hover:underline transition-colors" onClick={() => navigate('/leads', { state: { assignedFilter: 'unassigned', status: ['Cerrado', 'Cliente'] } })}>{unWon}</span>
                                ) : <span className="text-[13px] font-black text-emerald-400">{unWon}</span>}
                            </div>
                            <div className="col-span-1 text-center">
                                {unLost > 0 ? (
                                    <span className="text-[13px] font-black text-red-300 cursor-pointer hover:text-red-500 hover:underline transition-colors" onClick={() => navigate('/leads', { state: { assignedFilter: 'unassigned', status: 'Perdido' } })}>{unLost}</span>
                                ) : <span className="text-[13px] font-black text-red-300">{unLost}</span>}
                            </div>
                            <div className="col-span-1 text-center"><span className="text-[11px] font-bold text-gray-300">—</span></div>
                            <div className="col-span-2 text-right"><span className="text-[12px] font-black text-gray-400">{formatCurrency(unValue)}</span></div>
                            <div className="col-span-2 text-right"><span className="text-[13px] font-black text-gray-400">{formatCurrency(unClosing)}</span></div>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}

// === TEAM GRID ===
function TeamPerformanceGrid({ data, profileNames, profileAvatars, getTeamGoal, periodLabel }: {
    data: TeamPerformance[];
    profileNames: Record<string, string>;
    profileAvatars: Record<string, string | null>;
    getTeamGoal: (teamId: string) => { leads: number; value: number } | null;
    periodLabel: string;
}) {
    if (data.length === 0) {
        return (
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-16 flex flex-col items-center text-center">
                <BarChart3 className="w-12 h-12 text-gray-200 mb-4" />
                <p className="text-[12px] font-black text-gray-400 uppercase tracking-widest mb-1">Sin equipos</p>
                <p className="text-[11px] text-gray-400">Crea equipos y asigna miembros para ver métricas</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.map((team, index) => {
                const goal = getTeamGoal(team.team_id);
                return (
                    <div key={team.team_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-lg transition-all group">
                        <div className="px-6 py-4 flex items-center gap-4" style={{ backgroundColor: team.team_color + '08', borderBottom: `2px solid ${team.team_color}20` }}>
                            {/* Member avatars stack */}
                            <div className="flex items-center shrink-0">
                                <div className="flex -space-x-2.5">
                                    {team.member_ids.slice(0, 4).map((uid) => {
                                        const avatar = profileAvatars[uid];
                                        const name = profileNames[uid] || '?';
                                        const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                                        return avatar ? (
                                            <img
                                                key={uid}
                                                src={avatar}
                                                alt={name}
                                                className="w-9 h-9 rounded-full border-2 border-white object-cover shadow-sm"
                                            />
                                        ) : (
                                            <div
                                                key={uid}
                                                className="w-9 h-9 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black text-white shadow-sm"
                                                style={{ backgroundColor: team.team_color || '#4449AA' }}
                                            >
                                                {initials}
                                            </div>
                                        );
                                    })}
                                    {team.member_ids.length > 4 && (
                                        <div className="w-9 h-9 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[10px] font-black text-gray-500 shadow-sm">
                                            +{team.member_ids.length - 4}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    {index === 0 && data.length > 1 && <Award className="w-4 h-4 text-amber-500 shrink-0" />}
                                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight truncate">{team.team_name}</h3>
                                </div>
                                <p className="text-[10px] text-gray-400 font-bold mt-0.5">{team.member_count} miembro{team.member_count !== 1 ? 's' : ''}</p>
                            </div>
                        </div>
                        <div className="px-6 py-4 space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                                <MetricItem label="Leads" value={String(team.total_leads)} />
                                <MetricItem label="Ganados" value={String(team.leads_won)} color="text-emerald-600" />
                                <MetricItem label="Tasa" value={formatPercent(team.win_rate)} color={team.win_rate >= 50 ? 'text-emerald-600' : team.win_rate >= 25 ? 'text-amber-600' : 'text-red-500'} />
                            </div>
                            {goal && goal.leads > 0 && (
                                <div>
                                    <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest mb-1">Meta Cierres ({periodLabel})</p>
                                    <GoalProgressBar actual={team.leads_won} goal={goal.leads} />
                                </div>
                            )}
                            <div className="h-px bg-gray-100" />
                            <div className="grid grid-cols-2 gap-3">
                                <MetricItem label="Pipeline" value={formatCurrency(team.total_value)} />
                                <MetricItem label="Cerrado" value={formatCurrency(team.total_closing_amount)} color="text-[#4449AA]" />
                            </div>
                            {/* Conversion % Pipeline → Cerrado */}
                            {team.total_value > 0 && (() => {
                                const convPct = Math.min(100, Math.round((team.total_closing_amount / team.total_value) * 100));
                                const convColor = convPct >= 60 ? '#10b981' : convPct >= 30 ? '#f59e0b' : '#ef4444';
                                return (
                                    <div className="bg-gray-50/80 rounded-xl px-3 py-2.5 border border-gray-100">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[7px] font-black text-gray-400 uppercase tracking-widest">Conversión Pipeline</span>
                                            <span className="text-[11px] font-black" style={{ color: convColor }}>{convPct}%</span>
                                        </div>
                                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-700"
                                                style={{ width: `${convPct}%`, backgroundColor: convColor }}
                                            />
                                        </div>
                                    </div>
                                );
                            })()}
                            {goal && goal.value > 0 && (
                                <div>
                                    <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest mb-1">Meta Valor ({periodLabel})</p>
                                    <GoalProgressBar actual={team.total_closing_amount} goal={goal.value} type="currency" />
                                </div>
                            )}
                            {team.top_performer && profileNames[team.top_performer] && (
                                <div className="flex items-center gap-2 bg-amber-50 rounded-xl px-3 py-2 border border-amber-100">
                                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                                    <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Top:</span>
                                    <span className="text-[11px] font-black text-gray-700 truncate">{profileNames[team.top_performer]}</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// === PERFORMANCE CHARTS (Vertical Bars) ===
function PerformanceCharts({ userPerformance, teamPerformance, getUserGoal, getTeamGoal, periodLabel }: {
    userPerformance: UserPerformance[];
    teamPerformance: TeamPerformance[];
    getUserGoal: (id: string) => { leads: number; value: number } | null;
    getTeamGoal: (id: string) => { leads: number; value: number } | null;
    periodLabel: string;
}) {
    const [chartView, setChartView] = useState<'users' | 'teams'>('users');
    const items = chartView === 'users'
        ? userPerformance.map((u) => ({ id: u.user_id, name: u.full_name.split(' ')[0], won: u.leads_won, value: u.total_closing_amount, goal: getUserGoal(u.user_id) }))
        : teamPerformance.map((t) => ({ id: t.team_id, name: t.team_name, won: t.leads_won, value: t.total_closing_amount, goal: getTeamGoal(t.team_id) }));

    const hasGoals = items.some((i) => i.goal !== null);
    const CHART_HEIGHT = 220;

    // Y-axis helpers
    const maxLeads = Math.max(...items.map((i) => Math.max(i.won, i.goal?.leads || 0)), 1);
    const maxValue = Math.max(...items.map((i) => Math.max(i.value, i.goal?.value || 0)), 1);
    const leadsSteps = getYAxisSteps(maxLeads);
    const valueSteps = getYAxisSteps(maxValue);

    // Bar colors per user
    const barGradients = [
        ['#6366f1', '#818cf8'], // indigo
        ['#06b6d4', '#22d3ee'], // cyan
        ['#f59e0b', '#fbbf24'], // amber
        ['#10b981', '#34d399'], // emerald
        ['#f43f5e', '#fb7185'], // rose
        ['#8b5cf6', '#a78bfa'], // violet
        ['#ec4899', '#f472b6'], // pink
        ['#14b8a6', '#2dd4bf'], // teal
    ];

    return (
        <div className="space-y-6">
            {/* Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
                <button onClick={() => setChartView('users')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${chartView === 'users' ? 'bg-white text-[#4449AA] shadow-sm' : 'text-gray-400'}`}>
                    <Users className="w-3.5 h-3.5 inline mr-1" />Por Persona
                </button>
                <button onClick={() => setChartView('teams')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${chartView === 'teams' ? 'bg-white text-[#4449AA] shadow-sm' : 'text-gray-400'}`}>
                    <BarChart3 className="w-3.5 h-3.5 inline mr-1" />Por Equipo
                </button>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Leads Closed Chart */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-[11px] font-black text-gray-700 uppercase tracking-widest">🏆 Leads Cerrados {hasGoals ? `vs Meta` : ''}</h3>
                        {hasGoals && (
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded-sm bg-gradient-to-t from-indigo-500 to-indigo-400" />
                                    <span className="text-[8px] font-bold text-gray-400">Actual</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded-sm bg-gray-200 border border-dashed border-gray-400" />
                                    <span className="text-[8px] font-bold text-gray-400">Meta</span>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex">
                        {/* Y-Axis */}
                        <div className="flex flex-col justify-between pr-2" style={{ height: CHART_HEIGHT }}>
                            {leadsSteps.reverse().map((step) => (
                                <span key={step} className="text-[8px] font-bold text-gray-300 text-right w-8">{step}</span>
                            ))}
                        </div>
                        {/* Bars */}
                        <div className="flex-1 relative">
                            {/* Grid Lines */}
                            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                                {leadsSteps.map((_, i) => (
                                    <div key={i} className="border-t border-gray-50 w-full" />
                                ))}
                            </div>
                            <div className="flex items-end justify-around gap-1 relative" style={{ height: CHART_HEIGHT }}>
                                {items.map((item, idx) => {
                                    const goalLeads = item.goal?.leads || 0;
                                    const barH = (item.won / Math.max(maxLeads, 1)) * CHART_HEIGHT;
                                    const goalH = goalLeads > 0 ? (goalLeads / Math.max(maxLeads, 1)) * CHART_HEIGHT : 0;
                                    const pct = goalLeads > 0 ? (item.won / goalLeads) * 100 : 0;
                                    const [colorFrom, colorTo] = barGradients[idx % barGradients.length];

                                    return (
                                        <div key={item.id} className="flex flex-col items-center gap-1 flex-1 max-w-[80px] group relative">
                                            {/* Tooltip on hover */}
                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[8px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                                                {item.won} cerrados{goalLeads > 0 ? ` • Meta: ${goalLeads} (${pct.toFixed(0)}%)` : ''}
                                            </div>
                                            {/* Value label */}
                                            <span className="text-[9px] font-black text-gray-600 mb-1">{item.won}</span>
                                            {/* Bar group */}
                                            <div className="flex items-end gap-0.5 w-full justify-center">
                                                {/* Actual bar */}
                                                <div
                                                    className="rounded-t-lg transition-all duration-700 ease-out hover:opacity-90 relative"
                                                    style={{
                                                        height: Math.max(barH, 2),
                                                        width: hasGoals ? '45%' : '60%',
                                                        background: `linear-gradient(to top, ${colorFrom}, ${colorTo})`,
                                                        boxShadow: `0 -4px 12px ${colorFrom}30`,
                                                    }}
                                                />
                                                {/* Goal bar */}
                                                {goalLeads > 0 && (
                                                    <div
                                                        className="rounded-t-lg border-2 border-dashed transition-all duration-700 ease-out"
                                                        style={{
                                                            height: Math.max(goalH, 2),
                                                            width: '45%',
                                                            borderColor: `${colorFrom}60`,
                                                            backgroundColor: `${colorFrom}08`,
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {/* X-axis labels */}
                            <div className="flex justify-around mt-3 border-t border-gray-100 pt-2">
                                {items.map((item, idx) => {
                                    const pct = (item.goal?.leads || 0) > 0 ? (item.won / item.goal!.leads) * 100 : 0;
                                    return (
                                        <div key={item.id} className="flex flex-col items-center gap-0.5 flex-1 max-w-[80px]">
                                            <span className="text-[9px] font-black text-gray-600 truncate max-w-full">{item.name}</span>
                                            {(item.goal?.leads || 0) > 0 && (
                                                <span className="text-[7px] font-bold">{pct >= 80 ? '🟢' : pct >= 50 ? '🟡' : '🔴'} {pct.toFixed(0)}%</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Value Closed Chart */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-[11px] font-black text-gray-700 uppercase tracking-widest">💰 Valor Cerrado {hasGoals ? `vs Meta` : ''}</h3>
                        {hasGoals && (
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded-sm bg-gradient-to-t from-emerald-500 to-emerald-400" />
                                    <span className="text-[8px] font-bold text-gray-400">Actual</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded-sm bg-gray-200 border border-dashed border-gray-400" />
                                    <span className="text-[8px] font-bold text-gray-400">Meta</span>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex">
                        {/* Y-Axis */}
                        <div className="flex flex-col justify-between pr-2" style={{ height: CHART_HEIGHT }}>
                            {valueSteps.reverse().map((step) => (
                                <span key={step} className="text-[8px] font-bold text-gray-300 text-right w-12">{formatCompact(step)}</span>
                            ))}
                        </div>
                        {/* Bars */}
                        <div className="flex-1 relative">
                            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                                {valueSteps.map((_, i) => (
                                    <div key={i} className="border-t border-gray-50 w-full" />
                                ))}
                            </div>
                            <div className="flex items-end justify-around gap-1 relative" style={{ height: CHART_HEIGHT }}>
                                {items.map((item, idx) => {
                                    const goalVal = item.goal?.value || 0;
                                    const barH = (item.value / Math.max(maxValue, 1)) * CHART_HEIGHT;
                                    const goalH = goalVal > 0 ? (goalVal / Math.max(maxValue, 1)) * CHART_HEIGHT : 0;
                                    const pct = goalVal > 0 ? (item.value / goalVal) * 100 : 0;
                                    const colors = [
                                        ['#10b981', '#34d399'],
                                        ['#06b6d4', '#22d3ee'],
                                        ['#f59e0b', '#fbbf24'],
                                        ['#6366f1', '#818cf8'],
                                        ['#f43f5e', '#fb7185'],
                                        ['#8b5cf6', '#a78bfa'],
                                        ['#ec4899', '#f472b6'],
                                        ['#14b8a6', '#2dd4bf'],
                                    ];
                                    const [cFrom, cTo] = colors[idx % colors.length];

                                    return (
                                        <div key={item.id} className="flex flex-col items-center gap-1 flex-1 max-w-[80px] group relative">
                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[8px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                                                {formatCurrency(item.value)}{goalVal > 0 ? ` • Meta: ${formatCurrency(goalVal)} (${pct.toFixed(0)}%)` : ''}
                                            </div>
                                            <span className="text-[8px] font-black text-gray-500 mb-1">{formatCompact(item.value)}</span>
                                            <div className="flex items-end gap-0.5 w-full justify-center">
                                                <div
                                                    className="rounded-t-lg transition-all duration-700 ease-out hover:opacity-90"
                                                    style={{
                                                        height: Math.max(barH, 2),
                                                        width: hasGoals ? '45%' : '60%',
                                                        background: `linear-gradient(to top, ${cFrom}, ${cTo})`,
                                                        boxShadow: `0 -4px 12px ${cFrom}30`,
                                                    }}
                                                />
                                                {goalVal > 0 && (
                                                    <div
                                                        className="rounded-t-lg border-2 border-dashed transition-all duration-700 ease-out"
                                                        style={{
                                                            height: Math.max(goalH, 2),
                                                            width: '45%',
                                                            borderColor: `${cFrom}60`,
                                                            backgroundColor: `${cFrom}08`,
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex justify-around mt-3 border-t border-gray-100 pt-2">
                                {items.map((item) => {
                                    const pct = (item.goal?.value || 0) > 0 ? (item.value / item.goal!.value) * 100 : 0;
                                    return (
                                        <div key={item.id} className="flex flex-col items-center gap-0.5 flex-1 max-w-[80px]">
                                            <span className="text-[9px] font-black text-gray-600 truncate max-w-full">{item.name}</span>
                                            {(item.goal?.value || 0) > 0 && (
                                                <span className="text-[7px] font-bold">{pct >= 80 ? '🟢' : pct >= 50 ? '🟡' : '🔴'} {pct.toFixed(0)}%</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            {hasGoals && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {items.slice(0, 4).map((item, idx) => {
                        const leadsPct = (item.goal?.leads || 0) > 0 ? (item.won / item.goal!.leads) * 100 : 0;
                        const valuePct = (item.goal?.value || 0) > 0 ? (item.value / item.goal!.value) * 100 : 0;
                        const avgPct = ((leadsPct + valuePct) / 2);
                        const statusColor = avgPct >= 80 ? 'from-emerald-500 to-emerald-600' : avgPct >= 50 ? 'from-amber-500 to-amber-600' : 'from-red-500 to-red-600';
                        const statusBg = avgPct >= 80 ? 'bg-emerald-50 border-emerald-100' : avgPct >= 50 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100';

                        return (
                            <div key={item.id} className={`rounded-2xl border p-4 ${statusBg}`}>
                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest truncate">{item.name}</p>
                                <p className={`text-2xl font-black bg-gradient-to-r ${statusColor} bg-clip-text text-transparent mt-1`}>
                                    {avgPct.toFixed(0)}%
                                </p>
                                <p className="text-[8px] font-bold text-gray-400 mt-0.5">Promedio Meta {periodLabel}</p>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// Y-axis step helper
function getYAxisSteps(maxVal: number): number[] {
    if (maxVal <= 0) return [0];
    const step = Math.ceil(maxVal / 4);
    const steps: number[] = [];
    for (let i = 0; i <= 4; i++) steps.push(step * i);
    return steps;
}

// Compact number formatter
function formatCompact(n: number): string {
    if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
    return n < 100 ? String(n) : `$${n}`;
}

// === GOAL CONFIG MODAL ===
function GoalConfigModal({ 
    userPerformance, 
    teams, 
    goals, 
    callSummary, 
    callGoals, 
    companyId, 
    onClose, 
    onSaved 
}: {
    userPerformance: UserPerformance[];
    teams: Team[];
    goals: PerformanceGoal[];
    callSummary: CallActivitySummary[];
    callGoals: CallGoal[];
    companyId: string;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [modalTab, setModalTab] = useState<'users' | 'teams'>('users');
    const [saving, setSaving] = useState(false);

    const WEEKDAYS_CONFIG = [
        { label: 'L', value: 1 },
        { label: 'M', value: 2 },
        { label: 'M', value: 3 },
        { label: 'J', value: 4 },
        { label: 'V', value: 5 },
        { label: 'S', value: 6 },
        { label: 'D', value: 0 }
    ];

    // Días laborales por usuario
    const [userWeekdays, setUserWeekdays] = useState<Record<string, number[]>>(() => {
        const map: Record<string, number[]> = {};
        userPerformance.forEach((u) => {
            const stored = localStorage.getItem(`crm_work_weekdays_${companyId}_${u.user_id}`);
            if (stored) {
                try {
                    map[u.user_id] = JSON.parse(stored);
                } catch (e) {
                    map[u.user_id] = [1, 2, 3, 4, 5, 6];
                }
            } else {
                map[u.user_id] = [1, 2, 3, 4, 5, 6];
            }
        });
        return map;
    });

    // User goals state
    const [userGoals, setUserGoals] = useState<Record<string, { monthlyLeads: number; value: number }>>(() => {
        const map: Record<string, { monthlyLeads: number; value: number }> = {};
        userPerformance.forEach((u) => {
            const existing = goals.find((g) => g.user_id === u.user_id && !g.team_id);
            map[u.user_id] = { monthlyLeads: existing?.goal_leads || 0, value: Number(existing?.goal_value || 0) };
        });
        return map;
    });

    const getUserDailyLeads = (userId: string) => {
        const monthly = userGoals[userId]?.monthlyLeads || 0;
        const weekdays = userWeekdays[userId] || [1, 2, 3, 4, 5, 6];
        const daysInMonth = getActiveDaysInMonth(weekdays);
        return monthly / daysInMonth;
    };

    // Team goals state
    const [teamGoals, setTeamGoals] = useState<Record<string, { leads: number; value: number }>>(() => {
        const map: Record<string, { leads: number; value: number }> = {};
        teams.forEach((t) => {
            const existing = goals.find((g) => g.team_id === t.id && !g.user_id);
            map[t.id] = { leads: existing?.goal_leads || 0, value: Number(existing?.goal_value || 0) };
        });
        return map;
    });

    // Metas de llamadas diarias
    const [callGoalsState, setCallGoalsState] = useState<Record<string, number>>(() => {
        const map: Record<string, number> = {};
        userPerformance.forEach((u) => {
            const existing = callGoals.find((g) => g.user_id === u.user_id && !g.team_id);
            map[u.user_id] = existing?.daily_call_goal || 0;
        });
        return map;
    });

    const getRecommendedCalls = (userId: string, dailyLeads: number) => {
        if (!dailyLeads) return 0;
        const uPerf = userPerformance.find((p) => p.user_id === userId);
        const leadsWon = uPerf ? uPerf.leads_won : 0;
        const summary = callSummary.find((s) => s.user_id === userId);
        const actualCalls = summary ? summary.calls_total : 0;
        let callsPerClose = leadsWon > 0 ? (actualCalls / leadsWon) : 0;
        if (callsPerClose <= 0) {
            const totalActualCalls = callSummary.reduce((s, u) => s + u.calls_total, 0);
            const globalWon = userPerformance.reduce((s, p) => s + p.leads_won, 0);
            callsPerClose = globalWon > 0 ? (totalActualCalls / globalWon) : 40;
        }
        callsPerClose = Math.max(10, callsPerClose);
        return Math.ceil(dailyLeads * callsPerClose);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (modalTab === 'users') {
                const formattedUserGoals = Object.entries(userGoals).map(([user_id, g]) => {
                    return {
                        user_id,
                        goal_leads: g.monthlyLeads,
                        goal_value: g.value
                    };
                });
                
                await performanceGoalsService.saveUserGoals(companyId, formattedUserGoals);
                
                const callGoalsArray = Object.entries(callGoalsState).map(([user_id, daily_call_goal]) => ({
                    user_id,
                    daily_call_goal,
                }));
                await callActivityService.saveUserGoals(companyId, callGoalsArray);
                
                // Save weekdays and working_days to localStorage
                Object.entries(userWeekdays).forEach(([userId, weekdaysList]) => {
                    localStorage.setItem(`crm_work_weekdays_${companyId}_${userId}`, JSON.stringify(weekdaysList));
                    const daysInMonth = getActiveDaysInMonth(weekdaysList);
                    localStorage.setItem(`crm_working_days_${companyId}_${userId}`, String(daysInMonth));
                });
            } else {
                await performanceGoalsService.saveTeamGoals(
                    companyId,
                    Object.entries(teamGoals).map(([team_id, g]) => ({ team_id, goal_leads: g.leads, goal_value: g.value }))
                );
            }
            toast.success('Metas guardadas correctamente');
            onSaved();
        } catch (err) {
            console.error('Error saving goals:', err);
            toast.error('Error al guardar las metas');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
            <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden animate-in zoom-in-95 fade-in duration-300 flex flex-col">
                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-indigo-50 shrink-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-black text-[#4449AA] tracking-tight">🎯 Configurar Metas de Ventas</h2>
                            <p className="text-[11px] text-gray-400 font-bold mt-1">
                                Configura la meta mensual o diaria de cierres y seguimientos, y selecciona los días laborables de cada asesor.
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                            <X className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>
                    <div className="flex items-center gap-1 bg-white/80 rounded-xl p-1 w-fit mt-4">
                        <button onClick={() => setModalTab('users')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${modalTab === 'users' ? 'bg-white text-[#4449AA] shadow-sm' : 'text-gray-400'}`}>
                            <Users className="w-3.5 h-3.5 inline mr-1" />Por Persona
                        </button>
                        <button onClick={() => setModalTab('teams')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${modalTab === 'teams' ? 'bg-white text-[#4449AA] shadow-sm' : 'text-gray-400'}`}>
                            <BarChart3 className="w-3.5 h-3.5 inline mr-1" />Por Equipo
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="px-8 py-4 overflow-y-auto flex-1">
                    {modalTab === 'users' ? (
                        <div className="space-y-1">
                            <div className="grid grid-cols-12 gap-2 py-2 text-[8px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 items-center">
                                <div className="col-span-2">Vendedor</div>
                                <div className="col-span-2 text-center">Cierres Meta/Mes</div>
                                <div className="col-span-2 text-center">Meta Valor ($)/Mes</div>
                                <div className="col-span-3 text-center">Días Laborables Semanales</div>
                                <div className="col-span-2 text-center">Seguimientos/Día</div>
                                <div className="col-span-1 text-center">Copiar</div>
                            </div>
                            {userPerformance.map((u) => (
                                <div key={u.user_id} className="grid grid-cols-12 gap-2 py-3 items-center hover:bg-gray-50/50 rounded-xl transition-colors">
                                    {/* User Info */}
                                    <div className="col-span-2 flex items-center gap-2 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                                            {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" alt="" /> : <Users className="w-3.5 h-3.5 text-gray-300" />}
                                        </div>
                                        <span className="text-[11px] font-black text-gray-700 truncate leading-tight">{u.full_name}</span>
                                    </div>
                                    {/* Monthly Lead Goal */}
                                    <div className="col-span-2 flex flex-col items-center">
                                        <input
                                            type="number"
                                            min={0}
                                            value={userGoals[u.user_id]?.monthlyLeads || ''}
                                            onChange={(e) => {
                                                const monthlyLeads = parseInt(e.target.value) || 0;
                                                setUserGoals({ ...userGoals, [u.user_id]: { ...userGoals[u.user_id], monthlyLeads } });
                                                
                                                // Calculate daily leads equivalent for call recommendations
                                                const weekdays = userWeekdays[u.user_id] || [1, 2, 3, 4, 5, 6];
                                                const daysInMonth = getActiveDaysInMonth(weekdays);
                                                const dailyLeads = monthlyLeads / daysInMonth;
                                                const rec = getRecommendedCalls(u.user_id, dailyLeads);
                                                if (rec > 0 && (callGoalsState[u.user_id] === 0 || !callGoalsState[u.user_id])) {
                                                    setCallGoalsState(prev => ({ ...prev, [u.user_id]: rec }));
                                                }
                                            }}
                                            placeholder="0"
                                            className="w-16 h-9 text-center text-[12px] font-bold text-gray-700 border border-gray-200 rounded-xl outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
                                        />
                                        {(() => {
                                            const weekdays = userWeekdays[u.user_id] || [1, 2, 3, 4, 5, 6];
                                            const daysInMonth = getActiveDaysInMonth(weekdays);
                                            const monthly = userGoals[u.user_id]?.monthlyLeads || 0;
                                            const daily = monthly > 0 ? (monthly / daysInMonth).toFixed(2) : '0.00';
                                            return (
                                                <span className="text-[7.5px] font-bold text-gray-400 mt-1">
                                                    ~{daily}/día
                                                </span>
                                            );
                                        })()}
                                    </div>
                                    {/* Monthly Value Goal */}
                                    <div className="col-span-2 flex justify-center">
                                        <div className="flex items-center gap-0.5 border border-gray-200 rounded-xl px-1.5 h-9 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100 transition-all w-20">
                                            <span className="text-[10px] font-bold text-gray-400">$</span>
                                            <input
                                                type="number"
                                                min={0}
                                                value={userGoals[u.user_id]?.value || ''}
                                                onChange={(e) => setUserGoals({ ...userGoals, [u.user_id]: { ...userGoals[u.user_id], value: parseFloat(e.target.value) || 0 } })}
                                                placeholder="0"
                                                className="w-full text-center text-[11px] font-bold text-gray-700 outline-none bg-transparent"
                                            />
                                        </div>
                                    </div>
                                    {/* Weekdays Config Selector */}
                                    <div className="col-span-3 flex items-center justify-center gap-1">
                                        {WEEKDAYS_CONFIG.map((day) => {
                                            const isActive = (userWeekdays[u.user_id] || []).includes(day.value);
                                            return (
                                                <button
                                                    key={day.value}
                                                    type="button"
                                                    onClick={() => {
                                                        const currentDays = userWeekdays[u.user_id] || [];
                                                        const nextDays = currentDays.includes(day.value)
                                                            ? currentDays.filter(d => d !== day.value)
                                                            : [...currentDays, day.value];
                                                        
                                                        setUserWeekdays({ ...userWeekdays, [u.user_id]: nextDays });
                                                        
                                                        // Update recommended calls if daily leads is configured
                                                        const dailyLeads = (userGoals[u.user_id]?.monthlyLeads || 0) / getActiveDaysInMonth(nextDays);
                                                        const rec = getRecommendedCalls(u.user_id, dailyLeads);
                                                        if (rec > 0) {
                                                            setCallGoalsState(prev => ({ ...prev, [u.user_id]: rec }));
                                                        }
                                                    }}
                                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black border transition-all cursor-pointer ${
                                                        isActive 
                                                            ? 'bg-[#4449AA] text-white border-transparent shadow-sm' 
                                                            : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                                                    }`}
                                                    title={day.value === 0 ? 'Domingo' : day.value === 6 ? 'Sábado' : 'Día Laboral'}
                                                >
                                                    {day.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {/* Daily Follow-ups Goal */}
                                    <div className="col-span-2 flex flex-col items-center justify-center gap-0.5">
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="number"
                                                min={0}
                                                max={100}
                                                value={callGoalsState[u.user_id] || ''}
                                                onChange={(e) => setCallGoalsState({ ...callGoalsState, [u.user_id]: parseInt(e.target.value) || 0 })}
                                                placeholder="0"
                                                className="w-14 h-9 text-center text-[12px] font-bold text-gray-700 border border-gray-200 rounded-xl outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
                                            />
                                            <span className="text-[9px] text-gray-400 font-bold">/día</span>
                                        </div>
                                        {(() => {
                                            const dailyLeads = getUserDailyLeads(u.user_id);
                                            const rec = getRecommendedCalls(u.user_id, dailyLeads);
                                            return rec > 0 ? (
                                                <span className="text-[7.5px] font-black text-emerald-600 bg-emerald-50 px-1 rounded uppercase tracking-wider">
                                                    Sugerido: {rec}
                                                </span>
                                            ) : null;
                                        })()}
                                    </div>
                                    {/* Clone to all button */}
                                    <div className="col-span-1 flex justify-center">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const sourceGoals = userGoals[u.user_id];
                                                const sourceWeekdays = userWeekdays[u.user_id] || [1, 2, 3, 4, 5, 6];
                                                const sourceCallGoal = callGoalsState[u.user_id] || 0;
                                                
                                                const nextGoals = { ...userGoals };
                                                const nextWeekdays = { ...userWeekdays };
                                                const nextCallGoals = { ...callGoalsState };
                                                
                                                userPerformance.forEach(otherUser => {
                                                    nextGoals[otherUser.user_id] = { ...sourceGoals };
                                                    nextWeekdays[otherUser.user_id] = [...sourceWeekdays];
                                                    nextCallGoals[otherUser.user_id] = sourceCallGoal;
                                                });
                                                
                                                setUserGoals(nextGoals);
                                                setUserWeekdays(nextWeekdays);
                                                setCallGoalsState(nextCallGoals);
                                                toast.success(`Configuración de ${u.full_name} aplicada a todos los asesores`);
                                            }}
                                            className="p-1.5 hover:bg-violet-50 hover:text-[#4449AA] text-gray-400 rounded-xl transition-colors cursor-pointer"
                                            title="Aplicar esta configuración a todos los asesores"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <div className="grid grid-cols-12 gap-2 py-2 text-[8px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                <div className="col-span-5">Equipo</div>
                                <div className="col-span-3 text-center">Meta Leads / Mes</div>
                                <div className="col-span-4 text-center">Meta Valor ($) / Mes</div>
                            </div>
                            {teams.map((t) => (
                                <div key={t.id} className="grid grid-cols-12 gap-2 py-3 items-center hover:bg-gray-50/50 rounded-xl transition-colors">
                                    <div className="col-span-5 flex items-center gap-2">
                                        <span className="text-lg">{t.emoji}</span>
                                        <span className="text-[11px] font-black text-gray-700 truncate">{t.name}</span>
                                    </div>
                                    <div className="col-span-3 flex justify-center">
                                        <input
                                            type="number"
                                            min={0}
                                            value={teamGoals[t.id]?.leads || ''}
                                            onChange={(e) => setTeamGoals({ ...teamGoals, [t.id]: { ...teamGoals[t.id], leads: parseInt(e.target.value) || 0 } })}
                                            placeholder="0"
                                            className="w-20 h-9 text-center text-[12px] font-bold text-gray-700 border border-gray-200 rounded-xl outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
                                        />
                                    </div>
                                    <div className="col-span-4 flex justify-center">
                                        <div className="flex items-center gap-1 border border-gray-200 rounded-xl px-2 h-9 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100 transition-all">
                                            <span className="text-[11px] font-bold text-gray-400">$</span>
                                            <input
                                                type="number"
                                                min={0}
                                                value={teamGoals[t.id]?.value || ''}
                                                onChange={(e) => setTeamGoals({ ...teamGoals, [t.id]: { ...teamGoals[t.id], value: parseFloat(e.target.value) || 0 } })}
                                                placeholder="0"
                                                className="w-24 text-center text-[12px] font-bold text-gray-700 outline-none bg-transparent"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-8 py-5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 rounded-xl transition-all">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:shadow-lg hover:shadow-violet-200 transition-all disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Guardar Metas
                    </button>
                </div>
            </div>
        </div>
    );
}

// === HELPER COMPONENTS ===
function MetricItem({ label, value, color = 'text-gray-800' }: { label: string; value: string; color?: string }) {
    return (
        <div>
            <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
            <p className={`text-sm font-black ${color} tracking-tight mt-0.5`}>{value}</p>
        </div>
    );
}

function WinRateBadge({ rate }: { rate: number }) {
    const color =
        rate >= 50
            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
            : rate >= 25
                ? 'bg-amber-50 text-amber-600 border-amber-100'
                : rate > 0
                    ? 'bg-red-50 text-red-500 border-red-100'
                    : 'bg-gray-50 text-gray-400 border-gray-100';
    const Icon = rate >= 50 ? ArrowUpRight : rate >= 25 ? Minus : ArrowDownRight;

    return (
        <span className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-black border ${color}`}>
            {rate > 0 && <Icon className="w-3 h-3" />}
            {formatPercent(rate)}
        </span>
    );
}

// === FORECAST SECTION ===
function ForecastSection({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const [year, setYear] = useState(currentYear);
    const [data, setData] = useState<ForecastWithActual[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    const loadForecast = useCallback(async () => {
        if (!companyId) return;
        setLoading(true);
        try {
            const result = await forecastService.getForecastWithActuals(companyId, year);
            setData(result);
        } catch (err) {
            console.error('Error loading forecast:', err);
        } finally {
            setLoading(false);
        }
    }, [companyId, year]);

    useEffect(() => { loadForecast(); }, [loadForecast]);

    const hasForecast = data.some(d => d.goal_leads > 0 || d.goal_value > 0);
    const totalGoalLeads = data.reduce((s, d) => s + d.goal_leads, 0);
    const totalGoalValue = data.reduce((s, d) => s + d.goal_value, 0);
    const totalActualLeads = data.reduce((s, d) => s + d.actual_leads, 0);
    const totalActualValue = data.reduce((s, d) => s + d.actual_value, 0);
    const leadsProgress = totalGoalLeads > 0 ? Math.round((totalActualLeads / totalGoalLeads) * 100) : 0;
    const valueProgress = totalGoalValue > 0 ? Math.round((totalActualValue / totalGoalValue) * 100) : 0;

    // Chart calculations
    const CHART_H = 260;
    const maxVal = Math.max(...data.map(d => Math.max(d.goal_value, d.actual_value)), 1);
    const maxLeads = Math.max(...data.map(d => Math.max(d.goal_leads, d.actual_leads)), 1);

    const fmtCompact = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n}`;
    const getSteps = (max: number) => {
        const step = max <= 5 ? 1 : max <= 20 ? 5 : max <= 100 ? 20 : Math.ceil(max / 5 / 10) * 10;
        const steps: number[] = [];
        for (let i = 0; i <= max; i += step) steps.push(i);
        if (steps[steps.length - 1] < max) steps.push(Math.ceil(max / step) * step);
        return steps;
    };

    const valueSteps = getSteps(maxVal);
    const leadsSteps = getSteps(maxLeads);
    const actualMaxVal = valueSteps[valueSteps.length - 1] || 1;
    const actualMaxLeads = leadsSteps[leadsSteps.length - 1] || 1;

    // Trend line calculation (linear regression on actual values up to current month)
    const calcTrendLine = (values: number[]) => {
        const n = values.length;
        if (n === 0) return values;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        values.forEach((y, x) => { sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x; });
        const denom = n * sumX2 - sumX * sumX;
        if (denom === 0) return values.map(() => sumY / n);
        const slope = (n * sumXY - sumX * sumY) / denom;
        const intercept = (sumY - slope * sumX) / n;
        return values.map((_, x) => Math.max(0, slope * x + intercept));
    };

    const trendValues = calcTrendLine(data.map(d => d.actual_value));

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 text-[#4449AA] animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-black text-gray-900 tracking-tight">Forecast Anual</h2>
                    <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-0.5">
                        <button
                            onClick={() => setYear(year - 1)}
                            className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white transition-all flex items-center justify-center font-black text-sm"
                        >
                            ‹
                        </button>
                        <span className="px-3 py-1 text-sm font-black text-[#4449AA] min-w-[60px] text-center">{year}</span>
                        <button
                            onClick={() => setYear(year + 1)}
                            className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white transition-all flex items-center justify-center font-black text-sm"
                        >
                            ›
                        </button>
                    </div>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 bg-gradient-to-r from-violet-500 to-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:shadow-lg hover:shadow-violet-200 transition-all h-10"
                    >
                        <Settings className="w-3.5 h-3.5" />
                        Configurar Forecast
                    </button>
                )}
            </div>

            {!hasForecast ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                    <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Target className="w-8 h-8 text-violet-400" />
                    </div>
                    <h3 className="text-lg font-black text-gray-800 mb-2">Sin forecast configurado</h3>
                    <p className="text-sm text-gray-400 mb-6">Configura las metas mensuales para ver la proyección anual</p>
                    {isAdmin && (
                        <button
                            onClick={() => setShowModal(true)}
                            className="bg-gradient-to-r from-violet-500 to-indigo-600 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:shadow-lg transition-all"
                        >
                            Configurar Forecast {year}
                        </button>
                    )}
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Meta Leads Anual</p>
                            <p className="text-2xl font-black text-gray-900">{totalGoalLeads}</p>
                            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all" style={{ width: `${Math.min(100, leadsProgress)}%` }} />
                            </div>
                            <p className="text-[9px] font-bold text-gray-400 mt-1">{totalActualLeads} cerrados ({leadsProgress}%)</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Meta Valor Anual</p>
                            <p className="text-2xl font-black text-gray-900">{formatCurrency(totalGoalValue)}</p>
                            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all" style={{ width: `${Math.min(100, valueProgress)}%` }} />
                            </div>
                            <p className="text-[9px] font-bold text-gray-400 mt-1">{formatCurrency(totalActualValue)} cerrado ({valueProgress}%)</p>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Leads Restantes</p>
                            <p className={`text-2xl font-black ${totalGoalLeads - totalActualLeads > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {Math.max(0, totalGoalLeads - totalActualLeads)}
                            </p>
                            <p className="text-[9px] font-bold text-gray-400 mt-1">
                                {year === currentYear ? `${12 - currentMonth} meses restantes` : year < currentYear ? 'Año completado' : '12 meses por delante'}
                            </p>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Valor Restante</p>
                            <p className={`text-2xl font-black ${totalGoalValue - totalActualValue > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {formatCurrency(Math.max(0, totalGoalValue - totalActualValue))}
                            </p>
                            <p className="text-[9px] font-bold text-gray-400 mt-1">
                                {year === currentYear && currentMonth < 12
                                    ? `Prom. necesario: ${formatCurrency(Math.max(0, (totalGoalValue - totalActualValue) / Math.max(1, 12 - currentMonth)))}/mes`
                                    : year < currentYear ? 'Año completado' : `${formatCurrency(totalGoalValue / 12)}/mes promedio`}
                            </p>
                        </div>
                    </div>

                    {/* === CHARTS SIDE BY SIDE === */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* VALUE CHART */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-[13px] font-black text-gray-700 uppercase tracking-wide">💰 Valor vs Meta</h3>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3.5 h-3.5 rounded-sm bg-orange-300" />
                                        <span className="text-[10px] font-bold text-gray-500">Actual</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3.5 h-3.5 rounded-sm bg-violet-200 border border-dashed border-violet-400" />
                                        <span className="text-[10px] font-bold text-gray-500">Meta</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-6 h-0.5 bg-amber-400" />
                                        <span className="text-[10px] font-bold text-gray-500">Tendencia</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex">
                                <div className="flex flex-col justify-between pr-2" style={{ height: CHART_H }}>
                                    {[...valueSteps].reverse().map((step, si) => (
                                        <span key={`vs-${si}`} className="text-[10px] font-bold text-gray-400 text-right w-14">{fmtCompact(step)}</span>
                                    ))}
                                </div>
                                <div className="flex-1 flex items-end gap-0.5" style={{ height: CHART_H }}>
                                    {data.map((d, i) => {
                                        const barH = (d.actual_value / actualMaxVal) * CHART_H;
                                        const goalH = (d.goal_value / actualMaxVal) * CHART_H;
                                        const trendH = (trendValues[i] / actualMaxVal) * CHART_H;
                                        const isPast = year < currentYear || (year === currentYear && d.month <= currentMonth);
                                        const isCurrent = year === currentYear && d.month === currentMonth;
                                        return (
                                            <div key={d.month} className="flex-1 flex flex-col items-center gap-1 group relative">
                                                <div className="absolute -top-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white rounded-xl px-3 py-2 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap pointer-events-none shadow-xl">
                                                    <p className="font-black">{forecastService.MONTH_NAMES[d.month - 1]}</p>
                                                    <p>Meta: {fmtCompact(d.goal_value)}</p>
                                                    <p>Actual: {fmtCompact(d.actual_value)}</p>
                                                    {d.goal_value > 0 && <p>{Math.round((d.actual_value / d.goal_value) * 100)}% cumplido</p>}
                                                </div>
                                                <div className="w-full relative" style={{ height: CHART_H }}>
                                                    <div
                                                        className="absolute bottom-0 left-[10%] right-[10%] bg-violet-100 border border-dashed border-violet-300 rounded-t-md transition-all"
                                                        style={{ height: goalH }}
                                                    />
                                                    {isPast && (
                                                        <div
                                                            className={`absolute bottom-0 left-[20%] right-[20%] rounded-t-md transition-all ${isCurrent
                                                                ? 'bg-blue-400 shadow-md shadow-blue-200'
                                                                : 'bg-orange-300'
                                                                }`}
                                                            style={{ height: barH }}
                                                        />
                                                    )}
                                                    <div
                                                        className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-400 border-2 border-white shadow-sm z-10"
                                                        style={{ bottom: Math.max(0, trendH - 4) }}
                                                    />
                                                    {i < data.length - 1 && (
                                                        <svg className="absolute top-0 left-0 w-[200%] pointer-events-none z-[5]" style={{ height: CHART_H, overflow: 'visible' }}>
                                                            <line
                                                                x1="50%" y1={CHART_H - trendH}
                                                                x2="150%" y2={CHART_H - (trendValues[i + 1] / actualMaxVal) * CHART_H}
                                                                stroke="#f59e0b" strokeWidth="2" strokeDasharray="4,3" opacity="0.7"
                                                            />
                                                        </svg>
                                                    )}
                                                </div>
                                                <span className={`text-[11px] font-black uppercase ${isCurrent ? 'text-blue-600' : isPast ? 'text-gray-600' : 'text-gray-300'}`}>
                                                    {forecastService.MONTH_NAMES_SHORT[d.month - 1]}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* LEADS CHART */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-[13px] font-black text-gray-700 uppercase tracking-wide">🏆 Leads vs Meta</h3>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3.5 h-3.5 rounded-sm bg-sky-400" />
                                        <span className="text-[10px] font-bold text-gray-500">Actual</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3.5 h-3.5 rounded-sm bg-violet-200 border border-dashed border-violet-400" />
                                        <span className="text-[10px] font-bold text-gray-500">Meta</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex">
                                <div className="flex flex-col justify-between pr-2" style={{ height: CHART_H }}>
                                    {[...leadsSteps].reverse().map((step, si) => (
                                        <span key={`ls-${si}`} className="text-[10px] font-bold text-gray-400 text-right w-8">{step}</span>
                                    ))}
                                </div>
                                <div className="flex-1 flex items-end gap-0.5" style={{ height: CHART_H }}>
                                    {data.map((d) => {
                                        const barH = (d.actual_leads / actualMaxLeads) * CHART_H;
                                        const goalH = (d.goal_leads / actualMaxLeads) * CHART_H;
                                        const isPast = year < currentYear || (year === currentYear && d.month <= currentMonth);
                                        const isCurrent = year === currentYear && d.month === currentMonth;
                                        return (
                                            <div key={d.month} className="flex-1 flex flex-col items-center gap-1 group relative">
                                                <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-gray-900 text-white rounded-xl px-3 py-2 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap pointer-events-none shadow-xl">
                                                    <p className="font-black">{forecastService.MONTH_NAMES[d.month - 1]}</p>
                                                    <p>Meta: {d.goal_leads} leads</p>
                                                    <p>Actual: {d.actual_leads} leads</p>
                                                </div>
                                                <div className="w-full relative" style={{ height: CHART_H }}>
                                                    <div className="absolute bottom-0 left-[10%] right-[10%] bg-violet-100 border border-dashed border-violet-300 rounded-t-md" style={{ height: goalH }} />
                                                    {isPast && (
                                                        <div
                                                            className={`absolute bottom-0 left-[20%] right-[20%] rounded-t-md transition-all ${isCurrent
                                                                ? 'bg-blue-400 shadow-md shadow-blue-200'
                                                                : 'bg-sky-400'
                                                                }`}
                                                            style={{ height: barH }}
                                                        />
                                                    )}
                                                </div>
                                                <span className={`text-[11px] font-black uppercase ${isCurrent ? 'text-blue-600' : isPast ? 'text-gray-600' : 'text-gray-300'}`}>
                                                    {forecastService.MONTH_NAMES_SHORT[d.month - 1]}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Monthly breakdown table */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100">
                            <h3 className="text-[11px] font-black text-gray-700 uppercase tracking-widest">📋 Detalle Mensual — {year}</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50">
                                        <th className="text-left text-[9px] font-black text-gray-400 uppercase tracking-widest px-6 py-3">Mes</th>
                                        <th className="text-right text-[9px] font-black text-gray-400 uppercase tracking-widest px-4 py-3">Meta Leads</th>
                                        <th className="text-right text-[9px] font-black text-gray-400 uppercase tracking-widest px-4 py-3">Actual Leads</th>
                                        <th className="text-right text-[9px] font-black text-gray-400 uppercase tracking-widest px-4 py-3">%</th>
                                        <th className="text-right text-[9px] font-black text-gray-400 uppercase tracking-widest px-4 py-3">Meta Valor</th>
                                        <th className="text-right text-[9px] font-black text-gray-400 uppercase tracking-widest px-4 py-3">Actual Valor</th>
                                        <th className="text-right text-[9px] font-black text-gray-400 uppercase tracking-widest px-6 py-3">%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map((d) => {
                                        const isPast = year < currentYear || (year === currentYear && d.month <= currentMonth);
                                        const isCurrent = year === currentYear && d.month === currentMonth;
                                        const leadPct = d.goal_leads > 0 ? Math.round((d.actual_leads / d.goal_leads) * 100) : 0;
                                        const valPct = d.goal_value > 0 ? Math.round((d.actual_value / d.goal_value) * 100) : 0;
                                        return (
                                            <tr key={d.month} className={`border-b border-gray-50 ${isCurrent ? 'bg-blue-50/50' : ''}`}>
                                                <td className={`px-6 py-3 text-sm font-bold ${isCurrent ? 'text-blue-600' : isPast ? 'text-gray-800' : 'text-gray-300'}`}>
                                                    {isCurrent && <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2 animate-pulse" />}
                                                    {forecastService.MONTH_NAMES[d.month - 1]}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-bold text-gray-500 text-right">{d.goal_leads}</td>
                                                <td className="px-4 py-3 text-sm font-black text-gray-900 text-right">{isPast ? d.actual_leads : '—'}</td>
                                                <td className="px-4 py-3 text-right">
                                                    {isPast && d.goal_leads > 0 ? (
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${leadPct >= 100 ? 'bg-emerald-50 text-emerald-600' : leadPct >= 70 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}>
                                                            {leadPct}%
                                                        </span>
                                                    ) : <span className="text-gray-300 text-sm">—</span>}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-bold text-gray-500 text-right">{formatCurrency(d.goal_value)}</td>
                                                <td className="px-4 py-3 text-sm font-black text-gray-900 text-right">{isPast ? formatCurrency(d.actual_value) : '—'}</td>
                                                <td className="px-6 py-3 text-right">
                                                    {isPast && d.goal_value > 0 ? (
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${valPct >= 100 ? 'bg-emerald-50 text-emerald-600' : valPct >= 70 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}>
                                                            {valPct}%
                                                        </span>
                                                    ) : <span className="text-gray-300 text-sm">—</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {/* Totals row */}
                                    <tr className="bg-gray-50 font-black">
                                        <td className="px-6 py-3 text-sm text-gray-900">TOTAL {year}</td>
                                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{totalGoalLeads}</td>
                                        <td className="px-4 py-3 text-sm text-gray-900 text-right">{totalActualLeads}</td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${leadsProgress >= 100 ? 'bg-emerald-50 text-emerald-600' : 'bg-violet-50 text-violet-600'}`}>
                                                {leadsProgress}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{formatCurrency(totalGoalValue)}</td>
                                        <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatCurrency(totalActualValue)}</td>
                                        <td className="px-6 py-3 text-right">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${valueProgress >= 100 ? 'bg-emerald-50 text-emerald-600' : 'bg-violet-50 text-violet-600'}`}>
                                                {valueProgress}%
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* Modal */}
            {showModal && (
                <ForecastConfigModal
                    companyId={companyId}
                    year={year}
                    existingData={data}
                    onClose={() => setShowModal(false)}
                    onSaved={() => { setShowModal(false); loadForecast(); }}
                />
            )}
        </div>
    );
}

// === FORECAST CONFIG MODAL ===
function ForecastConfigModal({ companyId, year, existingData, onClose, onSaved }: {
    companyId: string;
    year: number;
    existingData: ForecastWithActual[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const [months, setMonths] = useState(
        Array.from({ length: 12 }, (_, i) => {
            const existing = existingData.find(d => d.month === i + 1);
            return {
                month: i + 1,
                goal_leads: existing?.goal_leads || 0,
                goal_value: existing?.goal_value || 0,
            };
        })
    );
    const [saving, setSaving] = useState(false);

    const totalLeads = months.reduce((s, m) => s + m.goal_leads, 0);
    const totalValue = months.reduce((s, m) => s + m.goal_value, 0);

    const handleSave = async () => {
        setSaving(true);
        try {
            await forecastService.saveForecast(companyId, year, months);
            toast.success(`Forecast ${year} guardado exitosamente`);
            onSaved();
        } catch (err) {
            toast.error('Error al guardar forecast');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const applyToAll = (field: 'goal_leads' | 'goal_value', value: number) => {
        setMonths(months.map(m => ({ ...m, [field]: value })));
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[700px] max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="h-14 bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-3">
                        <Target className="w-5 h-5 text-white" />
                        <h2 className="text-sm font-black text-white uppercase tracking-widest">Forecast {year}</h2>
                    </div>
                    <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                        <X className="w-4 h-4 text-white" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Quick fill */}
                    <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Llenar todos:</span>
                        <div className="flex items-center gap-2">
                            <input
                                type="number" min="0" placeholder="Leads" className="w-20 h-8 border border-gray-200 rounded-lg text-center text-xs font-bold text-gray-700 focus:border-violet-400 focus:ring-2 focus:ring-violet-50 outline-none"
                                onKeyDown={(e) => { if (e.key === 'Enter') applyToAll('goal_leads', Number((e.target as HTMLInputElement).value)); }}
                                onBlur={(e) => { if (e.target.value) applyToAll('goal_leads', Number(e.target.value)); }}
                            />
                            <input
                                type="number" min="0" placeholder="Valor $" className="w-28 h-8 border border-gray-200 rounded-lg text-center text-xs font-bold text-gray-700 focus:border-violet-400 focus:ring-2 focus:ring-violet-50 outline-none"
                                onKeyDown={(e) => { if (e.key === 'Enter') applyToAll('goal_value', Number((e.target as HTMLInputElement).value)); }}
                                onBlur={(e) => { if (e.target.value) applyToAll('goal_value', Number(e.target.value)); }}
                            />
                        </div>
                    </div>

                    {/* Month rows */}
                    <div className="space-y-2">
                        {months.map((m, i) => (
                            <div key={m.month} className="flex items-center gap-4 group">
                                <span className="w-24 text-sm font-bold text-gray-600 shrink-0">
                                    {forecastService.MONTH_NAMES[i]}
                                </span>
                                <div className="flex items-center gap-2 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[8px] font-black text-gray-300 uppercase">Leads</span>
                                        <input
                                            type="number" min="0"
                                            value={m.goal_leads || ''}
                                            onChange={(e) => {
                                                const val = Number(e.target.value) || 0;
                                                setMonths(months.map((mm, j) => j === i ? { ...mm, goal_leads: val } : mm));
                                            }}
                                            className="w-20 h-9 border border-gray-200 rounded-xl text-center text-sm font-bold text-gray-700 focus:border-violet-400 focus:ring-2 focus:ring-violet-50 outline-none transition-all"
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[8px] font-black text-gray-300 uppercase">Valor</span>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">$</span>
                                            <input
                                                type="number" min="0"
                                                value={m.goal_value || ''}
                                                onChange={(e) => {
                                                    const val = Number(e.target.value) || 0;
                                                    setMonths(months.map((mm, j) => j === i ? { ...mm, goal_value: val } : mm));
                                                }}
                                                className="w-32 h-9 border border-gray-200 rounded-xl text-center text-sm font-bold text-gray-700 focus:border-violet-400 focus:ring-2 focus:ring-violet-50 outline-none pl-7 transition-all"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-6">
                        <div>
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Total Leads</p>
                            <p className="text-lg font-black text-gray-900">{totalLeads}</p>
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Total Valor</p>
                            <p className="text-lg font-black text-emerald-600">{formatCurrency(totalValue)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="px-5 py-2.5 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors">
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 bg-gradient-to-r from-violet-500 to-indigo-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:shadow-lg hover:shadow-violet-200 transition-all disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            Guardar Forecast
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// === CALL ACTIVITY SECTION ===
function CallActivitySection({
    callSummary,
    callGoals,
    statusEvolution,
    contactSummary,
    profileNames,
    profileAvatars,
    companyId,
    isAdmin,
    onGoalsSaved,
    filters,
    callLogs,
    userPerformance,
    getUserGoal,
    conversionMode = 'real',
    customConversionRate = 15,
}: {
    callSummary: CallActivitySummary[];
    callGoals: CallGoal[];
    statusEvolution: { from: string; to: string; count: number }[];
    contactSummary: ContactActivitySummary[];
    profileNames: Record<string, string>;
    profileAvatars: Record<string, string | null>;
    companyId: string;
    isAdmin: boolean;
    onGoalsSaved: () => void;
    filters: PerformanceFilters;
    callLogs: CallActivity[];
    userPerformance: UserPerformance[];
    getUserGoal: (userId: string) => { leads: number; value: number } | null;
    conversionMode?: 'real' | 'custom';
    customConversionRate?: number;
}) {
    const navigate = useNavigate();
    const [isGoalPanelOpen, setIsGoalPanelOpen] = useState(false);
    const [editGoals, setEditGoals] = useState<Record<string, number>>({});
    const [savingGoals, setSavingGoals] = useState(false);
    const [subTab, setSubTab] = useState<'dashboard' | 'report' | 'master_report'>('dashboard');
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
    const [printingUserId, setPrintingUserId] = useState<string | null>(null);
    const [sendReportModal, setSendReportModal] = useState<{
        isOpen: boolean;
        advisorId: string;
        advisorName: string;
        advisorEmail: string;
        tab: 'now' | 'schedule';
        recipientEmail: string;
        frequency: 'weekly' | 'monthly';
        dayOfWeek: number;
        dayOfMonth: number;
        sendHour: number;
        period: string;
        sending: boolean;
        scheduling: boolean;
        sent: boolean;
    } | null>(null);

    const openSendModal = (advisorId: string, advisorName: string, advisorEmail: string) => {
        setSendReportModal({
            isOpen: true, advisorId, advisorName, advisorEmail,
            tab: 'now', recipientEmail: advisorEmail,
            frequency: 'weekly', dayOfWeek: 1, dayOfMonth: 1,
            sendHour: 8,
            period: filters.period || 'month',
            sending: false, scheduling: false, sent: false,
        });
    };

    const handleSendReportNow = async () => {
        if (!sendReportModal) return;
        const row = reportData.find(r => r.userId === sendReportModal.advisorId);
        if (!row) return;

        setSendReportModal(prev => prev ? { ...prev, sending: true } : null);

        // Build day grid data
        const daysRng = getDatesInRange();
        const activeWD = getActiveWeekdaysForUser(companyId, row.userId);
        const userDays = daysRng.filter(d => activeWD.includes(d.getDay()));
        const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
        const pastDays = userDays.filter(d => d <= todayEnd);
        const futureDays = userDays.filter(d => d > todayEnd);
        const daysOK = pastDays.filter(d => {
            const c = getUserCallsForDate(row.userId, d).length;
            return row.dailyGoal > 0 ? c >= row.dailyGoal : c > 0;
        }).length;
        const dayGrid = userDays.map(date => ({
            label: date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }),
            count: getUserCallsForDate(row.userId, date).length,
            goal: row.dailyGoal,
            isFuture: date > todayEnd,
        }));

        try {
            const { supabase } = await import('../../services/supabase');
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-performance-report`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.access_token}`,
                    },
                    body: JSON.stringify({
                        companyId,
                        advisorId: row.userId,
                        advisorName: row.userName,
                        advisorEmail: sendReportModal.advisorEmail,
                        recipientEmail: sendReportModal.recipientEmail,
                        periodLabel: getFormattedDateRange(),
                        generatedAt: new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                        actual: row.actual,
                        actualConnected: row.actualConnected,
                        goalUpToDate: row.goalUpToDate,
                        periodGoal: row.periodGoal,
                        dailyGoal: row.dailyGoal,
                        deviation: row.deviation,
                        percent: row.percent,
                        avgResponseTime: row.avgResponseTime,
                        dayGrid,
                        daysOK,
                        pastDaysCount: pastDays.length,
                        leadsWithoutFollowUp: row.leadsWithoutFollowUp,
                        deficit: row.deficit,
                        userNeglectLoss: row.userNeglectLoss,
                        userActivityLoss: row.userActivityLoss,
                        userConsolidated: row.userConsolidated,
                        conversionRate: row.conversionRate,
                        avgDealSize: row.avgDealSize,
                    }),
                }
            );
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Error enviando reporte');
            }
            toast.success(`✅ Reporte enviado a ${sendReportModal.recipientEmail}`);
            setSendReportModal(prev => prev ? { ...prev, sending: false, sent: true } : null);
            setTimeout(() => setSendReportModal(null), 2000);
        } catch (err: any) {
            toast.error(err.message || 'Error enviando reporte');
            setSendReportModal(prev => prev ? { ...prev, sending: false } : null);
        }
    };

    const handleSaveSchedule = async () => {
        if (!sendReportModal) return;
        setSendReportModal(prev => prev ? { ...prev, scheduling: true } : null);
        try {
            const { supabase } = await import('../../services/supabase');
            // Compute next_send_at
            const now = new Date();
            let nextSend = new Date();
            if (sendReportModal.frequency === 'weekly') {
                const diff = (sendReportModal.dayOfWeek - now.getDay() + 7) % 7 || 7;
                nextSend.setDate(now.getDate() + diff);
            } else {
                nextSend.setDate(sendReportModal.dayOfMonth);
                if (nextSend <= now) nextSend.setMonth(nextSend.getMonth() + 1);
            }
            nextSend.setHours(sendReportModal.sendHour, 0, 0, 0);

            const { error } = await supabase.from('report_schedules').insert({
                company_id: companyId,
                advisor_id: sendReportModal.advisorId,
                advisor_name: sendReportModal.advisorName,
                recipient_emails: sendReportModal.recipientEmail,
                frequency: sendReportModal.frequency,
                day_of_week: sendReportModal.frequency === 'weekly' ? sendReportModal.dayOfWeek : null,
                day_of_month: sendReportModal.frequency === 'monthly' ? sendReportModal.dayOfMonth : null,
                period: sendReportModal.period,
                is_active: true,
                next_send_at: nextSend.toISOString(),
            });
            if (error) throw error;
            toast.success(`📅 Reporte programado — próximo envío: ${nextSend.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} a las ${String(sendReportModal.sendHour).padStart(2,'0')}:00`);
            setSendReportModal(null);
        } catch (err: any) {
            toast.error(err.message || 'Error guardando programación');
            setSendReportModal(prev => prev ? { ...prev, scheduling: false } : null);
        }
    };

    const handlePrintUserReport = (userId: string) => {
        const row = reportData.find(r => r.userId === userId);
        if (!row) return;
        setExpandedUserId(userId);

        // Pre-compute day data before opening new window
        const daysRng = getDatesInRange();
        const activeWD = getActiveWeekdaysForUser(companyId, userId);
        const userDays = daysRng.filter(d => activeWD.includes(d.getDay()));
        const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
        const pastDays = userDays.filter(d => d <= todayEnd);
        const daysOK = pastDays.filter(d => {
            const c = getUserCallsForDate(userId, d).length;
            return row.dailyGoal > 0 ? c >= row.dailyGoal : c > 0;
        }).length;

        const dayGridHTML = pastDays.map(date => {
            const count = getUserCallsForDate(userId, date).length;
            const g = row.dailyGoal;
            const p = g > 0 ? (count / g) * 100 : 0;
            const lbl = date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
            const c = p >= 100 ? '#10b981' : p >= 80 ? '#14b8a6' : p >= 50 ? '#f59e0b' : count > 0 ? '#f97316' : '#ef4444';
            return `<div style="border:1.5px solid ${c}40;background:${c}0d;border-radius:8px;padding:10px 4px;text-align:center;"><p style="font-size:8px;font-weight:800;color:#64748b;text-transform:uppercase;margin:0 0 4px;letter-spacing:.5px;">${lbl}</p><p style="font-size:20px;font-weight:900;color:${c};margin:0;">${count}</p><p style="font-size:8px;color:#94a3b8;margin:3px 0 0;">/${g}</p></div>`;
        }).join('');

        const periodLabel = getFormattedDateRange();
        const generatedAt = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const rtColor = row.avgResponseTime === 0 ? '#94a3b8' : row.avgResponseTime <= 2 ? '#10b981' : row.avgResponseTime <= 24 ? '#f59e0b' : '#ef4444';
        const pctColor = row.percent >= 100 ? '#10b981' : row.percent >= 75 ? '#f59e0b' : '#ef4444';
        const devLabel = row.deviation >= 0 ? `+${row.deviation}` : `${row.deviation}`;
        const devColor = row.deviation >= 0 ? '#10b981' : '#ef4444';

        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>Reporte — ${row.userName}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#f8fafc;color:#1e293b;padding:36px 40px}@media print{body{background:white;padding:24px 28px}}
.hdr{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:2px solid #e2e8f0;padding-bottom:20px;margin-bottom:24px}
.brand{font-size:9px;font-weight:900;color:#6366f1;letter-spacing:3px;text-transform:uppercase}
.advisor-name{font-size:24px;font-weight:900;color:#0f172a;margin:6px 0 0;text-transform:uppercase;letter-spacing:.5px}
.meta{font-size:11px;color:#64748b;font-weight:600;margin-top:6px;line-height:1.6}
.avatar{width:60px;height:60px;border-radius:14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;color:white;flex-shrink:0}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.kpi{background:white;border:1px solid #e2e8f0;border-radius:14px;padding:16px;position:relative}
.kpi-label{font-size:8px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px}
.kpi-val{font-size:24px;font-weight:900;line-height:1}
.kpi-sub{font-size:9px;color:#94a3b8;font-weight:600;margin-top:5px}
.section{background:white;border:1px solid #e2e8f0;border-radius:14px;padding:20px;margin-bottom:16px}
.sec-title{font-size:9px;font-weight:900;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;margin-bottom:14px}
.daygrid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.stat{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #f1f5f9}
.stat:last-child{border:none}
.slabel{font-size:10px;color:#64748b;font-weight:600}
.sval{font-size:12px;font-weight:900;color:#1e293b}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
.source-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-top:10px}
.source-row{display:flex;gap:10px;margin-bottom:8px;align-items:flex-start}
.source-badge{font-size:8px;font-weight:900;color:white;padding:3px 7px;border-radius:4px;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap;flex-shrink:0}
.source-text{font-size:9px;color:#64748b;font-weight:500;line-height:1.5}
.footer{margin-top:24px;padding-top:14px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:1px}
.badge-ok{background:#10b981}.badge-warn{background:#f59e0b}.badge-danger{background:#ef4444}.badge-info{background:#6366f1}
</style></head><body>
<div class="hdr">
  <div>
    <div class="brand">Arias CRM · Reporte Individual de Rendimiento</div>
    <div class="advisor-name">${row.userName}</div>
    <div class="meta">📅 Período analizado: <strong>${periodLabel}</strong><br/>🕐 Generado el: ${generatedAt}</div>
  </div>
  <div class="avatar">${row.userName.charAt(0)}</div>
</div>
<div class="kpis">
  <div class="kpi"><div class="kpi-label">Llamadas Realizadas</div><div class="kpi-val" style="color:#4f46e5">${row.actual}</div><div class="kpi-sub">de ${row.goalUpToDate} meta a la fecha</div></div>
  <div class="kpi"><div class="kpi-label">Cumplimiento</div><div class="kpi-val" style="color:${pctColor}">${Math.round(row.percent)}%</div><div class="kpi-sub">${daysOK}/${pastDays.length} días con meta OK</div></div>
  <div class="kpi"><div class="kpi-label">Abordaje Prom.</div><div class="kpi-val" style="color:${rtColor};font-size:18px;">${row.avgResponseTime > 0 ? row.avgResponseTime <= 1 ? '&lt;1h' : row.avgResponseTime < 24 ? row.avgResponseTime.toFixed(1)+'h' : Math.round(row.avgResponseTime/24)+'d' : 'N/A'}</div><div class="kpi-sub">asignación→primer contacto</div></div>
  <div class="kpi"><div class="kpi-label">Desviación</div><div class="kpi-val" style="color:${devColor}">${devLabel}</div><div class="kpi-sub">meta diaria: ${row.dailyGoal} llamadas</div></div>
</div>
${pastDays.length > 0 ? `<div class="section"><div class="sec-title">📆 Desglose Diario — Solo días transcurridos (${pastDays.length} días laborables)</div><div class="daygrid">${dayGridHTML}</div></div>` : ''}
<div class="two-col">
  <div class="section"><div class="sec-title">📊 Resumen de Actividad de Llamadas</div>
    <div class="stat"><span class="slabel">Meta diaria configurada</span><span class="sval">${row.dailyGoal} llamadas/día</span></div>
    <div class="stat"><span class="slabel">Meta total del período</span><span class="sval">${row.periodGoal} llamadas</span></div>
    <div class="stat"><span class="slabel">Meta proporcional a la fecha</span><span class="sval">${row.goalUpToDate} llamadas</span></div>
    <div class="stat"><span class="slabel">Llamadas realizadas</span><span class="sval" style="color:${devColor}">${row.actual}</span></div>
    <div class="stat"><span class="slabel">Llamadas conectadas</span><span class="sval" style="color:#10b981">${row.actualConnected}</span></div>
    <div class="stat"><span class="slabel">Días laborables evaluados</span><span class="sval">${pastDays.length}</span></div>
    <div class="stat"><span class="slabel">Días con meta cumplida</span><span class="sval" style="color:#10b981">${daysOK}</span></div>
  </div>
  <div class="section"><div class="sec-title">💸 Análisis de Oportunidad Perdida</div>
    ${row.userConsolidated > 0 ? `
    <div class="stat"><span class="slabel">Leads activos sin contacto (período)</span><span class="sval" style="color:#ef4444">${row.leadsWithoutFollowUp}</span></div>
    <div class="stat"><span class="slabel">Llamadas faltantes vs meta</span><span class="sval" style="color:#ef4444">-${row.deficit}</span></div>
    <div class="stat"><span class="slabel">Pérdida estimada — Negligencia</span><span class="sval" style="color:#ef4444">-$${Math.round(row.userNeglectLoss).toLocaleString()}</span></div>
    <div class="stat"><span class="slabel">Pérdida estimada — Inactividad</span><span class="sval" style="color:#f59e0b">-$${Math.round(row.userActivityLoss).toLocaleString()}</span></div>
    <div class="stat"><span class="slabel">Tasa conversión usada</span><span class="sval">${row.conversionRate.toFixed(1)}%</span></div>
    <div class="stat"><span class="slabel">Ticket promedio usado</span><span class="sval">$${Math.round(row.avgDealSize).toLocaleString()}</span></div>
    <div class="stat" style="border-top:2px solid #e2e8f0;margin-top:4px;"><span class="slabel" style="font-weight:900;color:#0f172a;">Costo Total Estimado</span><span class="sval" style="color:#ef4444;font-size:15px;">-$${Math.round(row.userConsolidated).toLocaleString()}</span></div>
    ` : '<p style="font-size:11px;color:#10b981;font-weight:700;padding:12px 0;">✓ Sin oportunidades perdidas detectadas.</p>'}
  </div>
</div>
<div class="section"><div class="sec-title">🔍 Origen y Metodología de los Datos</div>
  <div class="source-box">
    <div class="source-row"><span class="source-badge badge-info">Llamadas</span><span class="source-text"><strong>Origen:</strong> Tabla <code>call_activities</code> filtrada por asesor y período seleccionado. Cuenta registros únicos de cualquier tipo de acción (llamada, WhatsApp, cotización, nota).</span></div>
    <div class="source-row"><span class="source-badge badge-info">Meta a la Fecha</span><span class="source-text"><strong>Fórmula:</strong> Meta diaria configurada × días laborables transcurridos hasta hoy. Excluye días futuros del período.</span></div>
    <div class="source-row"><span class="source-badge badge-warn">Negligencia</span><span class="source-text"><strong>Origen:</strong> Leads con status activo (excluye Cerrado, Cliente, Perdido, Erróneo) asignados al asesor que NO tienen ninguna <code>call_activity</code> registrada en el período.</span></div>
    <div class="source-row"><span class="source-badge badge-danger">Oportunidad Perdida</span><span class="source-text"><strong>Fórmula:</strong> (Leads sin contacto × Tasa de conversión × Ticket promedio) + (Llamadas faltantes ÷ Llamadas por cierre × Tasa conversión × Ticket). Estimación estadística, no garantía.</span></div>
    <div class="source-row"><span class="source-badge badge-ok">Abordaje</span><span class="source-text"><strong>Origen:</strong> Promedio de horas entre <code>assigned_at</code> (o <code>created_at</code>) y <code>first_follow_up_at</code> para leads con ambas fechas registradas.</span></div>
  </div>
</div>
<div class="footer"><span>Arias CRM — Sistema de Rendimiento de Equipos</span><span>Confidencial · Uso interno</span><span>Generado automáticamente</span></div>
<script>window.onload=function(){setTimeout(function(){window.print();},400);}</script>
</body></html>`;

        const win = window.open('', '_blank', 'width=960,height=760,scrollbars=yes');
        if (win) { win.document.write(html); win.document.close(); }
    };

    const countWorkingDaysInRange = (start: Date, end: Date, activeWeekdays: number[] = [1, 2, 3, 4, 5, 6]) => {
        let count = 0;
        const current = new Date(start.getTime());
        current.setHours(12, 0, 0, 0);
        const limit = new Date(end.getTime());
        limit.setHours(12, 0, 0, 0);
        while (current <= limit) {
            if (activeWeekdays.includes(current.getDay())) {
                count++;
            }
            current.setDate(current.getDate() + 1);
        }
        return count;
    };

    const getPeriodProgress = () => {
        const range = getDateRange(filters);
        const now = new Date();
        if (!range.start || !range.end) {
            return { elapsed: 24, total: 24, ratio: 1 };
        }
        const defaultWeekdays = [1, 2, 3, 4, 5, 6];
        if (filters.period === 'today') {
            const today = new Date();
            const isWorking = defaultWeekdays.includes(today.getDay());
            return { elapsed: isWorking ? 1 : 0, total: isWorking ? 1 : 0, ratio: isWorking ? 1 : 1 };
        }
        const totalDays = countWorkingDaysInRange(range.start, range.end, defaultWeekdays);
        const effectiveEnd = new Date(Math.min(now.getTime(), range.end.getTime()));
        const elapsedDays = countWorkingDaysInRange(range.start, effectiveEnd, defaultWeekdays);
        return {
            elapsed: elapsedDays,
            total: totalDays,
            ratio: totalDays > 0 ? elapsedDays / totalDays : 1,
        };
    };

    const getWorkingDaysInPeriod = (userId: string) => {
        const activeWeekdays = getActiveWeekdaysForUser(companyId, userId);
        if (filters.period === 'today') {
            const today = new Date();
            return activeWeekdays.includes(today.getDay()) ? 1 : 0;
        }
        const range = getDateRange(filters);
        if (!range.start || !range.end) {
            return getActiveDaysInMonth(activeWeekdays);
        }
        return countWorkingDaysInRange(range.start, range.end, activeWeekdays);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-SV', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(val);
    };

    const getDaysInPeriod = () => {
        if (filters.period === 'today') return 1;
        if (filters.period === 'all') return 30; // standard fallback
        const range = getDateRange(filters);
        if (!range.start || !range.end) return 1;
        const diffTime = Math.abs(range.end.getTime() - range.start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays || 1;
    };

    const formatDateSimple = (d: Date) => {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const getFormattedDateRange = () => {
        const range = getDateRange(filters);
        if (!range.start || !range.end) return 'Todo el tiempo';
        return `${formatDateSimple(range.start)} al ${formatDateSimple(range.end)}`;
    };

    const getRecommendation = (userName: string, actual: number, goalUpToDate: number) => {
        if (goalUpToDate === 0) {
            return `Asignar una meta diaria de llamadas a ${userName} para medir su rendimiento.`;
        }
        const percent = (actual / goalUpToDate) * 100;
        if (percent >= 100) {
            return `Excelente desempeño a la fecha. ${userName} superó la meta proporcional por un ${Math.round(percent - 100)}%. Seguir así.`;
        } else if (percent >= 80) {
            return `Buen ritmo de llamadas a la fecha (${Math.round(percent)}%). Le falta poco para el 100% del proporcional. Incrementar ligeramente el ritmo diario.`;
        } else if (percent > 0) {
            return `Bajo cumplimiento a la fecha (${Math.round(percent)}%). Se recomienda revisar bloqueos de agenda y priorizar llamadas diarias.`;
        } else {
            return `Crítico: 0 llamadas registradas a la fecha. Validar si ${userName} tiene problemas con la telefonía o reasignar tareas.`;
        }
    };

    const getGlobalRecommendation = (actual: number, totalGoalUpToDate: number, totalPeriodGoal: number) => {
        if (totalGoalUpToDate === 0) {
            return "Configure las metas de actividad de llamadas para el equipo de ventas para habilitar las recomendaciones automáticas.";
        }
        const percent = (actual / totalGoalUpToDate) * 100;
        if (percent >= 100) {
            return `🎉 ¡Felicidades! El equipo ha alcanzado el ${Math.round(percent)}% del objetivo de contacto a la fecha (Meta a la fecha: ${totalGoalUpToDate} de ${totalPeriodGoal} totales). La prospección está en un nivel saludable para garantizar el cierre de tratos.`;
        } else if (percent >= 80) {
            return `📈 Buen avance global del ${Math.round(percent)}% a la fecha (Meta a la fecha: ${totalGoalUpToDate} de ${totalPeriodGoal} totales). Para asegurar el cumplimiento del embudo de ventas, incentive a los asesores a realizar 2 o 3 llamadas más por día.`;
        } else {
            return `🚨 Alerta de Prospección: El equipo está al ${Math.round(percent)}% de la meta de llamadas a la fecha (Meta a la fecha: ${totalGoalUpToDate} de ${totalPeriodGoal} totales). Un bajo volumen de contacto impactará directamente en la creación de cotizaciones y cierres. Se recomienda una sesión de alineación con el equipo.`;
        }
    };

    const getDatesInRange = (uncapped = false) => {
        const range = getDateRange(filters);
        let start = range.start;
        let end = range.end;
        
        if (!start || !end) {
            // Align to the latest call log dates to show relevant days in all-time view
            if (callLogs.length > 0) {
                const latestTime = Math.max(...callLogs.map(l => new Date(l.call_date).getTime()));
                end = new Date(latestTime);
                start = new Date(latestTime);
                start.setDate(start.getDate() - 13);
            } else {
                end = new Date();
                start = new Date();
                start.setDate(start.getDate() - 13);
            }
        }
        
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Cap at 31 days if not uncapped. If it's more (e.g. quarterly or yearly), show the last 14 days of that period
        if (!uncapped && diffDays > 31) {
            const adjustedStart = new Date(end);
            adjustedStart.setDate(adjustedStart.getDate() - 13);
            start = adjustedStart;
        }
        
        const dates: Date[] = [];
        const current = new Date(start);
        current.setHours(0,0,0,0);
        const targetEnd = new Date(end);
        targetEnd.setHours(23,59,59,999);
        
        while (current <= targetEnd) {
            dates.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
        return dates;
    };

    const getUserCallsForDate = (userId: string, date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const day = date.getDate();
        
        return callLogs.filter(log => {
            if (log.user_id !== userId) return false;
            if (log.action_type !== 'call') return false;
            const logDate = new Date(log.call_date);
            return logDate.getFullYear() === year &&
                   logDate.getMonth() === month &&
                   logDate.getDate() === day;
        });
    };

    const getDetailedRecommendation = (
        userName: string,
        dailyGoal: number,
        days: number,
        goalUpToDate: number,
        totalCalls: number,
        totalConnected: number,
        daysRange: Date[],
        userId: string
    ) => {
        if (dailyGoal === 0) {
            return `Asignar una meta diaria de llamadas a ${userName} para medir su rendimiento.`;
        }
        
        const periodGoal = dailyGoal * days;
        const totalPct = goalUpToDate > 0 ? (totalCalls / goalUpToDate) * 100 : 0;
        const connectRate = totalCalls > 0 ? (totalConnected / totalCalls) * 100 : 0;
        
        if (totalCalls === 0) {
            return `🚨 Alerta Crítica: ${userName} no registra llamadas en este periodo. Se requiere supervisión inmediata para verificar fallas técnicas o reasignación de prioridades.`;
        }
        
        let text = `🎯 Desempeño: Completó el ${Math.round(totalPct)}% de la meta a la fecha (${totalCalls} de ${goalUpToDate} llamadas, meta del periodo completo: ${periodGoal}). `;
        
        // Consistency check to date
        const progress = getPeriodProgress();
        const elapsedWorkingDays = progress.ratio * days;
        const elapsedWorkingDaysRounded = Math.max(1, Math.round(elapsedWorkingDays));
        
        let metGoalDays = 0;
        const activeWeekdays = getActiveWeekdaysForUser(companyId, userId);
        daysRange.forEach(date => {
            if (!activeWeekdays.includes(date.getDay())) return;
            const calls = getUserCallsForDate(userId, date);
            if (calls.length >= dailyGoal) {
                metGoalDays++;
            }
        });
        
        const consistencyPct = (metGoalDays / elapsedWorkingDaysRounded) * 100;
        if (consistencyPct >= 80) {
            text += `Excelente constancia, alcanzando la meta diaria en ${metGoalDays} de ${elapsedWorkingDaysRounded} días laborales transcurridos. `;
        } else if (consistencyPct >= 40) {
            text += `Consistencia moderada. Cumplió la meta en ${metGoalDays} de ${elapsedWorkingDaysRounded} días laborales transcurridos, pero se observan fluctuaciones. `;
        } else {
            text += `Baja constancia. Solo cumplió la meta diaria en ${metGoalDays} de ${elapsedWorkingDaysRounded} días laborales transcurridos. Se recomienda establecer bloqueos de horario fijos para prospección. `;
        }
        
        if (connectRate >= 45) {
            text += `Alta tasa de conexión (${Math.round(connectRate)}%), lo que indica calidad en su prospección.`;
        } else if (connectRate < 25) {
            text += `La tasa de respuesta es baja (${Math.round(connectRate)}%). Se recomienda revisar los horarios de llamada.`;
        } else {
            text += `Tasa de conexión estable de ${Math.round(connectRate)}%.`;
        }
        
        return text;
    };

    const handleCallClick = async (userId: string, type: 'all' | 'connected' | 'no_answer' | 'unique' | 'status_change') => {
        try {
            const dateRange = getDateRange(filters);
            const dateFrom = dateRange.start?.toISOString();
            const dateTo = dateRange.end?.toISOString();

            let query = supabase
                .from('call_activities')
                .select('lead_id, outcome, status_before, status_after')
                .eq('user_id', userId);

            if (dateFrom) query = query.gte('call_date', dateFrom);
            if (dateTo) query = query.lte('call_date', dateTo);

            const { data, error } = await query;
            if (error) throw error;

            let filtered = data || [];
            if (type === 'connected') {
                filtered = filtered.filter(c => c.outcome === 'connected');
            } else if (type === 'no_answer') {
                filtered = filtered.filter(c => c.outcome !== 'connected');
            } else if (type === 'status_change') {
                filtered = filtered.filter(c => c.status_before && c.status_after && c.status_before !== c.status_after);
            }

            const leadIds = [...new Set(filtered.map(c => c.lead_id))];
            navigate('/leads', { state: { assignedFilter: userId, leadIds, fromPerformance: true, activeTab: 'calls', filters } });
        } catch (err) {
            console.error('Error filtering leads by call activity:', err);
            navigate('/leads', { state: { assignedFilter: userId, fromPerformance: true, activeTab: 'calls', filters } });
        }
    };

    const handleChannelClick = async (actionType: string) => {
        try {
            const dateRange = getDateRange(filters);
            const dateFrom = dateRange.start?.toISOString();
            const dateTo = dateRange.end?.toISOString();

            let query = supabase
                .from('call_activities')
                .select('lead_id')
                .eq('action_type', actionType);

            if (dateFrom) query = query.gte('call_date', dateFrom);
            if (dateTo) query = query.lte('call_date', dateTo);

            const { data, error } = await query;
            if (error) throw error;

            const leadIds = data ? [...new Set(data.map(r => r.lead_id))] : [];
            navigate('/leads', { state: { leadIds, fromPerformance: true, activeTab: 'calls', filters } });
        } catch (err) {
            console.error('Error filtering leads by channel activity:', err);
            navigate('/leads', { state: { actionTypeFilter: actionType, fromPerformance: true, activeTab: 'calls', filters } });
        }
    };

    // Totals from legacy summary
    const totalCalls = callSummary.reduce((s, u) => s + u.calls_total, 0);
    const totalConnected = callSummary.reduce((s, u) => s + u.calls_connected, 0);
    const totalUniqueLeads = callSummary.reduce((s, u) => s + u.unique_leads_called, 0);
    const totalStatusChanges = callSummary.reduce((s, u) => s + u.leads_with_status_change, 0);
    const overallConnectRate = totalCalls > 0 ? (totalConnected / totalCalls) * 100 : 0;

    // Multi-channel totals
    const totalAllActions = contactSummary.reduce((s, c) => s + c.total_actions, 0);
    const channelBreakdown = (Object.keys(ACTION_TYPE_CONFIG) as (keyof typeof ACTION_TYPE_CONFIG)[])
        .map(type => ({
            type,
            ...ACTION_TYPE_CONFIG[type],
            count: contactSummary.filter(c => c.action_type === type).reduce((s, c) => s + c.total_actions, 0),
        }))
        .filter(c => c.count > 0)
        .sort((a, b) => b.count - a.count);

    // Goal lookup
    const getUserCallGoal = (userId: string) => {
        const g = callGoals.find(g => g.user_id === userId && !g.team_id);
        return g?.daily_call_goal || 0;
    };

    // Initialize goal editor
    const openGoalPanel = () => {
        const goals: Record<string, number> = {};
        callSummary.forEach(u => {
            goals[u.user_id] = getUserCallGoal(u.user_id);
        });
        setEditGoals(goals);
        setIsGoalPanelOpen(true);
    };

    const handleSaveGoals = async () => {
        setSavingGoals(true);
        try {
            const userGoals = Object.entries(editGoals)
                .filter(([_, goal]) => goal > 0)
                .map(([user_id, daily_call_goal]) => ({ user_id, daily_call_goal }));
            await callActivityService.saveUserGoals(companyId, userGoals);
            toast.success('Metas de llamadas guardadas');
            setIsGoalPanelOpen(false);
            onGoalsSaved();
        } catch (err) {
            console.error('Error saving call goals:', err);
            toast.error('Error al guardar metas');
        } finally {
            setSavingGoals(false);
        }
    };

    if (userPerformance.length === 0 && callSummary.length === 0) {
        return (
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-16 flex flex-col items-center text-center">
                <Phone className="w-12 h-12 text-gray-200 mb-4" />
                <p className="text-[12px] font-black text-gray-400 uppercase tracking-widest mb-1">Sin datos de llamadas</p>
                <p className="text-[11px] text-gray-400">Registra llamadas desde la vista de leads para ver KPIs aquí</p>
            </div>
        );
    }

    const days = getDaysInPeriod();
    const progress = getPeriodProgress();
    const tempReportData = userPerformance.map(user => {
        const summary = callSummary.find(s => s.user_id === user.user_id) || {
            calls_total: 0,
            calls_connected: 0,
            calls_no_answer: 0,
            calls_voicemail: 0,
            calls_busy: 0,
            calls_wrong_number: 0,
            unique_leads_called: 0,
            leads_with_status_change: 0,
            connect_rate: 0
        };
        const dailyGoal = getUserCallGoal(user.user_id);
        const userPeriodWorkingDays = getWorkingDaysInPeriod(user.user_id);
        const periodGoal = Math.round(dailyGoal * userPeriodWorkingDays);
        
        // Pro-rated target to-date based on user-specific elapsed days
        const activeWeekdays = getActiveWeekdaysForUser(companyId, user.user_id);
        const range = getDateRange(filters);
        let elapsedWorkingDays = 0;
        if (!range.start || !range.end) {
            // 'all' or no range: count working days from month start to TODAY (not full month)
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            elapsedWorkingDays = countWorkingDaysInRange(monthStart, now, activeWeekdays);
        } else {
            if (filters.period === 'today') {
                const today = new Date();
                elapsedWorkingDays = activeWeekdays.includes(today.getDay()) ? 1 : 0;
            } else {
                const now = new Date();
                const effectiveEnd = new Date(Math.min(now.getTime(), range.end.getTime()));
                elapsedWorkingDays = countWorkingDaysInRange(range.start, effectiveEnd, activeWeekdays);
            }
        }
        const goalUpToDate = Math.round(dailyGoal * elapsedWorkingDays);
        
        const actual = summary.calls_total;
        const actualConnected = summary.calls_connected;
        const deviation = actual - goalUpToDate;
        const percent = goalUpToDate > 0 ? (actual / goalUpToDate) * 100 : 0;
        const userName = user.full_name || user.email.split('@')[0];
        const avatarUrl = user.avatar_url;
        
        return {
            userId: user.user_id,
            userName,
            avatarUrl,
            dailyGoal,
            periodGoal,
            goalUpToDate,
            actual,
            actualConnected,
            deviation,
            percent,
            recommendation: getRecommendation(userName, actual, goalUpToDate),
            avgResponseTime: user.avg_response_time || 0,
        };
    });

    const activeUsersWithResponse = userPerformance.filter(u => u.avg_response_time && u.avg_response_time > 0);
    const globalAvgResponseTime = activeUsersWithResponse.length > 0 
        ? activeUsersWithResponse.reduce((s, u) => s + (u.avg_response_time || 0), 0) / activeUsersWithResponse.length
        : 0;
    
    const totalPeriodGoal = tempReportData.reduce((s, r) => s + r.periodGoal, 0);
    const totalGoalUpToDate = tempReportData.reduce((s, r) => s + r.goalUpToDate, 0);
    const totalActualCalls = tempReportData.reduce((s, r) => s + r.actual, 0);
    const globalPercent = totalGoalUpToDate > 0 ? (totalActualCalls / totalGoalUpToDate) * 100 : 0;
    const globalDeviation = totalActualCalls - totalGoalUpToDate;

    const globalWon = userPerformance.reduce((s, p) => s + p.leads_won, 0);
    const globalLost = userPerformance.reduce((s, p) => s + p.leads_lost, 0);
    const globalLeads = userPerformance.reduce((s, p) => s + p.total_leads, 0);
    const globalClosing = userPerformance.reduce((s, p) => s + p.total_closing_amount, 0);
    const companyCallsPerClose = globalWon > 0 ? (totalActualCalls / globalWon) : 40;
    const companyAvgDealSize = globalWon > 0 ? (globalClosing / globalWon) : 2500;
    const companyWinRate = (globalWon + globalLost) > 0 ? (globalWon / (globalWon + globalLost)) * 100 : 15;
    const companyConversionRate = globalLeads > 0 ? (globalWon / globalLeads) * 100 : 15;

    const reportData = tempReportData.map(row => {
        const uPerf = userPerformance.find(p => p.user_id === row.userId);
        const leadsWithoutFollowUp = uPerf ? uPerf.leads_without_follow_up : 0;
        const winRate = uPerf && uPerf.win_rate > 0 ? uPerf.win_rate : companyWinRate;
        const realConversionRate = uPerf && uPerf.conversion_rate > 0 ? uPerf.conversion_rate : companyConversionRate;
        const conversionRate = conversionMode === 'custom' ? customConversionRate : realConversionRate;
        const avgDealSize = uPerf && uPerf.avg_deal_size > 0 ? uPerf.avg_deal_size : companyAvgDealSize;
        const actualWon = uPerf ? uPerf.leads_won : 0;
        const actualRevenue = uPerf ? uPerf.total_closing_amount : 0;
        
        const deficit = Math.max(0, row.goalUpToDate - row.actual);
        
        let actionsPerClose = actualWon > 0 ? (row.actual / actualWon) : companyCallsPerClose;
        if (actionsPerClose < 5) {
            actionsPerClose = companyCallsPerClose;
        }
        if (actionsPerClose < 5) {
            actionsPerClose = 5;
        }

        const lostSalesNeglect = leadsWithoutFollowUp * (conversionRate / 100);
        const lostSalesActivity = (deficit / actionsPerClose) * (conversionRate / 100);
        const userNeglectLoss = lostSalesNeglect * avgDealSize;
        const userActivityLoss = lostSalesActivity * avgDealSize;
        const userConsolidated = userNeglectLoss + userActivityLoss;

        const potentialLeadsWon = actualWon + lostSalesActivity + lostSalesNeglect;
        const potentialRevenue = actualRevenue + userNeglectLoss + userActivityLoss;

        return {
            ...row,
            deficit,
            leadsWithoutFollowUp,
            winRate,
            conversionRate,
            avgDealSize,
            actualWon,
            actualRevenue,
            actionsPerClose,
            lostSalesNeglect,
            lostSalesActivity,
            userNeglectLoss,
            userActivityLoss,
            userConsolidated,
            potentialLeadsWon,
            potentialRevenue,
            lostLeadsEst: lostSalesNeglect,
            lostRevenueEst: userNeglectLoss,
        };
    }).sort((a, b) => b.percent - a.percent);

    const totalLostLeadsEst = reportData.reduce((s, r) => s + r.lostLeadsEst, 0);
    const totalLostRevenueEst = reportData.reduce((s, r) => s + r.lostRevenueEst, 0);
    const totalLeadsWithoutFollowUp = reportData.reduce((s, r) => s + r.leadsWithoutFollowUp, 0);

    return (
        <div className="space-y-5">
            {/* ── Executive Header ─────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Actividad de Llamadas</h3>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">{getFormattedDateRange()} · {days} {days === 1 ? 'día' : 'días'}</p>
                </div>
                <div className="flex items-center gap-2">
                    {isAdmin && (
                        <button
                            onClick={openGoalPanel}
                            className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:border-teal-300 hover:text-teal-600 transition-all"
                        >
                            <Settings className="w-3 h-3" />
                            Metas
                        </button>
                    )}
                </div>
            </div>

            {/* ── KPI Strip ────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                    { label: 'Total Acciones', value: totalAllActions || totalCalls, color: 'text-slate-800', sub: 'registradas' },
                    { label: 'Conectadas', value: totalConnected, color: 'text-emerald-600', sub: `${overallConnectRate.toFixed(1)}% tasa` },
                    { label: 'Leads Únicos', value: totalUniqueLeads, color: 'text-indigo-600', sub: 'contactados' },
                    { label: 'Cambios Estado', value: totalStatusChanges, color: 'text-violet-600', sub: 'en pipeline' },
                    { label: 'Meta Global', value: `${globalPercent.toFixed(0)}%`, color: globalPercent >= 100 ? 'text-emerald-600' : globalPercent >= 75 ? 'text-amber-500' : 'text-rose-600', sub: `${totalActualCalls}/${totalGoalUpToDate} llamadas` },
                    { label: 'Abordaje Prom.', value: formatResponseTime(globalAvgResponseTime), color: globalAvgResponseTime > 0 ? (globalAvgResponseTime <= 2 ? 'text-emerald-600' : globalAvgResponseTime <= 24 ? 'text-amber-500' : 'text-rose-600') : 'text-slate-400', sub: 'resp. promedio' },
                ].map((kpi, i) => (
                    <div key={i} className="bg-white border border-slate-100 rounded-xl p-4 hover:border-slate-200 hover:shadow-sm transition-all">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{kpi.label}</p>
                        <p className={`text-xl font-black ${kpi.color} leading-none`}>{kpi.value}</p>
                        <p className="text-[9px] text-slate-400 mt-1 font-medium">{kpi.sub}</p>
                    </div>
                ))}
            </div>

            {/* ── Canal Breakdown (compact chips) ───────────────────── */}
            {channelBreakdown.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Canales:</span>
                    {channelBreakdown.map(ch => (
                        <button
                            key={ch.type}
                            onClick={() => handleChannelClick(ch.type)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-100 text-[9px] font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700 transition-all cursor-pointer"
                        >
                            <span>{ch.icon}</span>{ch.label} <span className="font-black">{ch.count}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* ── Advisor Performance Table ─────────────────────────── */}
            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-12 gap-0 px-5 py-3 bg-slate-50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                    <div className="col-span-3">Asesor</div>
                    <div className="col-span-2 text-center">Llamadas</div>
                    <div className="col-span-2 text-center">Meta a la Fecha</div>
                    <div className="col-span-2 text-center">Cumplimiento</div>
                    <div className="col-span-2 text-center">Abordaje</div>
                    <div className="col-span-1 text-center">Ver</div>
                </div>

                {/* Advisor rows */}
                <div className="divide-y divide-slate-50">
                    {reportData.map((row) => {
                        const daysRange = getDatesInRange();
                        const uncappedDaysRange = getDatesInRange(true);
                        const activeWeekdays = getActiveWeekdaysForUser(companyId, row.userId);
                        const userDaysRange = daysRange.filter(d => activeWeekdays.includes(d.getDay()));
                        const detailedRecommendationText = getDetailedRecommendation(
                            row.userName, row.dailyGoal, getWorkingDaysInPeriod(row.userId),
                            row.goalUpToDate, row.actual, row.actualConnected, uncappedDaysRange, row.userId
                        );
                        const isExpanded = expandedUserId === row.userId;
                        const pct = Math.min(row.percent, 100);
                        const pctColor = row.percent >= 100 ? 'bg-emerald-500' : row.percent >= 75 ? 'bg-amber-400' : 'bg-rose-500';
                        const deviationLabel = row.deviation >= 0 ? `+${row.deviation}` : `${row.deviation}`;

                        return (
                            <div key={row.userId} data-user-id={row.userId} className="print-card">
                                {/* Row */}
                                <div
                                    onClick={() => setExpandedUserId(isExpanded ? null : row.userId)}
                                    className="grid grid-cols-12 gap-0 px-5 py-4 items-center cursor-pointer hover:bg-slate-50/60 transition-colors"
                                >
                                    {/* Asesor */}
                                    <div className="col-span-3 flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 border border-slate-200/40">
                                            {row.avatarUrl ? <img src={row.avatarUrl} className="w-full h-full object-cover" alt="" /> : <Users className="w-4 h-4 text-slate-400" />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate">{row.userName}</p>
                                            {row.dailyGoal > 0 && <p className="text-[9px] text-slate-400 font-medium">Meta diaria: {row.dailyGoal}</p>}
                                        </div>
                                    </div>

                                    {/* Llamadas */}
                                    <div className="col-span-2 text-center">
                                        <button onClick={(e) => { e.stopPropagation(); handleCallClick(row.userId, 'all'); }} className="group">
                                            <span className="text-base font-black text-slate-800 group-hover:text-indigo-600 transition-colors">{row.actual}</span>
                                            <span className="text-[9px] text-slate-400 font-medium block">llamadas</span>
                                        </button>
                                    </div>

                                    {/* Meta a la fecha */}
                                    <div className="col-span-2 text-center">
                                        <span className="text-base font-black text-slate-600">{row.goalUpToDate}</span>
                                        <span className={`text-[9px] font-bold block ${row.deviation >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{deviationLabel}</span>
                                    </div>

                                    {/* Progress bar + % */}
                                    <div className="col-span-2 px-2">
                                        {row.dailyGoal > 0 ? (
                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className={`text-[10px] font-black ${row.percent >= 100 ? 'text-emerald-600' : row.percent >= 75 ? 'text-amber-500' : 'text-rose-600'}`}>
                                                        {Math.round(row.percent)}%
                                                    </span>
                                                    <span className="text-[8px] text-slate-400 font-medium">de meta</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full transition-all duration-700 ${pctColor}`} style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-[9px] text-slate-400 font-medium">Sin meta</span>
                                        )}
                                    </div>

                                    {/* Abordaje */}
                                    <div className="col-span-2 text-center">
                                        <span className={`text-[10px] font-black ${row.avgResponseTime === 0 ? 'text-slate-400' : row.avgResponseTime <= 2 ? 'text-emerald-600' : row.avgResponseTime <= 24 ? 'text-amber-500' : 'text-rose-600'}`}>
                                            {formatResponseTime(row.avgResponseTime)}
                                        </span>
                                    </div>

                                    {/* Expand */}
                                    <div className="col-span-1 flex items-center justify-center gap-1">
                                        <button onClick={(e) => { e.stopPropagation(); handlePrintUserReport(row.userId); }} className="w-6 h-6 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center hover:bg-slate-100 transition-colors text-slate-400 no-print" title="Imprimir reporte">
                                            <Printer className="w-3 h-3" />
                                        </button>
                                        {isAdmin && (
                                            <button onClick={(e) => { e.stopPropagation(); const uPerf = userPerformance.find(u => u.user_id === row.userId); openSendModal(row.userId, row.userName, uPerf?.email || ''); }} className="w-6 h-6 rounded-md bg-indigo-50 border border-indigo-100 flex items-center justify-center hover:bg-indigo-100 transition-colors text-indigo-400 no-print" title="Enviar reporte por email">
                                                <Mail className="w-3 h-3" />
                                            </button>
                                        )}
                                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                    </div>
                                </div>

                                {/* Expanded detail */}
                                {isExpanded && (
                                    <div className="border-t border-slate-100 bg-slate-50/30 p-5 space-y-5 animate-in slide-in-from-top-2 duration-200">
                                        {/* Print-only header */}
                                        <div className="hidden print:block border-b border-slate-200 pb-3 mb-4">
                                            <h1 className="text-lg font-black text-[#4449AA] uppercase">Reporte: {row.userName}</h1>
                                            <p className="text-[9px] text-slate-400 font-bold uppercase">Arias CRM · {getFormattedDateRange()}</p>
                                        </div>

                                        {/* Day-by-day grid */}
                                        {userDaysRange.length > 0 && (() => {
                                            const today = new Date();
                                            today.setHours(23, 59, 59, 999);
                                            const pastDays = userDaysRange.filter(d => d <= today);
                                            const futureDays = userDaysRange.filter(d => d > today);
                                            const daysCompliant = pastDays.filter(d => {
                                                const c = getUserCallsForDate(row.userId, d).length;
                                                return row.dailyGoal > 0 ? c >= row.dailyGoal : c > 0;
                                            }).length;
                                            return (
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Desglose diario</p>
                                                        {row.dailyGoal > 0 && pastDays.length > 0 && (
                                                            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${daysCompliant === pastDays.length ? 'bg-emerald-50 text-emerald-600' : daysCompliant >= pastDays.length * 0.7 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
                                                                {daysCompliant}/{pastDays.length} días OK {futureDays.length > 0 ? `· ${futureDays.length} pendientes` : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 print-grid">
                                                        {userDaysRange.map(date => {
                                                            const isFuture = date > today;
                                                            const count = getUserCallsForDate(row.userId, date).length;
                                                            const goal = row.dailyGoal;
                                                            const p = goal > 0 ? (count / goal) * 100 : 0;
                                                            const dateLabel = date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
                                                            const bg = isFuture
                                                                ? 'bg-slate-50 border-slate-200/60 text-slate-400 opacity-50'
                                                                : goal === 0 ? 'bg-slate-50 border-slate-100 text-slate-500'
                                                                : p >= 100 ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                                                : p >= 80 ? 'bg-teal-50 border-teal-200 text-teal-700'
                                                                : p >= 50 ? 'bg-amber-50 border-amber-200 text-amber-700'
                                                                : count > 0 ? 'bg-orange-50 border-orange-200 text-orange-700'
                                                                : 'bg-rose-50 border-rose-200 text-rose-700';
                                                            return (
                                                                <div key={date.getTime()} className={`border ${bg} rounded-lg p-2 text-center`}>
                                                                    <p className="text-[8px] font-bold uppercase opacity-70 truncate">{dateLabel}</p>
                                                                    <p className="text-base font-black mt-0.5">{isFuture ? '—' : count}</p>
                                                                    <p className="text-[8px] opacity-50">{isFuture ? 'pend.' : `/${goal}`}</p>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Stats + Loss row */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {/* Compliance summary */}
                                            <div className="bg-white border border-slate-100 rounded-xl p-4">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-3">Resumen de Actividad</p>
                                                <div className="space-y-2">
                                                    {[
                                                        { label: 'Meta diaria', val: row.dailyGoal },
                                                        { label: 'Meta periodo', val: row.periodGoal },
                                                        { label: 'Meta a la fecha', val: row.goalUpToDate },
                                                        { label: 'Realizadas', val: row.actual },
                                                    ].map(s => (
                                                        <div key={s.label} className="flex items-center justify-between">
                                                            <span className="text-[9px] text-slate-500 font-medium">{s.label}</span>
                                                            <span className="text-[11px] font-black text-slate-800">{s.val}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Opportunity cost */}
                                            <div className={`bg-white border rounded-xl p-4 ${row.userConsolidated > 0 ? 'border-rose-100' : 'border-slate-100'}`}>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-3">Oportunidad Perdida</p>
                                                {row.userConsolidated > 0 ? (
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between"><span className="text-[9px] text-slate-500">Negligencia ({row.leadsWithoutFollowUp} leads)</span><span className="text-[11px] font-black text-rose-600">-{formatCurrency(row.userNeglectLoss)}</span></div>
                                                        <div className="flex justify-between"><span className="text-[9px] text-slate-500">Inactividad (-{row.deficit} llam.)</span><span className="text-[11px] font-black text-amber-600">-{formatCurrency(row.userActivityLoss)}</span></div>
                                                        <div className="flex justify-between pt-2 border-t border-slate-100"><span className="text-[9px] font-bold text-slate-600">Total</span><span className="text-sm font-black text-rose-700">-{formatCurrency(row.userConsolidated)}</span></div>
                                                    </div>
                                                ) : (
                                                    <p className="text-[10px] text-emerald-600 font-bold">✓ Sin pérdidas detectadas</p>
                                                )}
                                            </div>

                                            {/* Sofia AI */}
                                            <div className="bg-white border border-teal-100/60 rounded-xl p-4">
                                                <p className="text-[9px] font-black text-teal-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                                                    <Sparkles className="w-3 h-3" />Sofía AI
                                                </p>
                                                <p className="text-[10px] text-slate-600 leading-relaxed font-medium">{detailedRecommendationText}</p>
                                            </div>
                                        </div>

                                        {/* ── Data Transparency ─── */}
                                        <details className="group">
                                            <summary className="cursor-pointer list-none flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                                                <span className="flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase tracking-wider">
                                                    <Info className="w-3 h-3 text-slate-400" />
                                                    Fuentes &amp; Metodología de Datos
                                                </span>
                                                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-open:rotate-180 transition-transform duration-200" />
                                            </summary>
                                            <div className="mt-2 space-y-2 px-1">
                                                {([
                                                    { badge: 'Llamadas', color: 'bg-indigo-500', text: 'Registros de call_activities del asesor en el período. Incluye llamadas, WhatsApp, cotizaciones y notas.' },
                                                    { badge: 'Meta a la Fecha', color: 'bg-violet-500', text: `Meta diaria (${row.dailyGoal}) × días laborables transcurridos hasta hoy. Excluye días futuros — evita penalizar al asesor por días que aún no ocurrieron.` },
                                                    { badge: 'Leads Sin Contacto', color: 'bg-amber-500', text: 'Leads activos asignados al asesor que NO tienen ninguna call_activity registrada en el período seleccionado. No incluye leads Perdidos ni Cerrados.' },
                                                    { badge: 'Pérd. Negligencia', color: 'bg-rose-500', text: `Leads sin contacto (${row.leadsWithoutFollowUp}) × Tasa conversión (${row.conversionRate.toFixed(1)}%) × Ticket promedio ($${Math.round(row.avgDealSize).toLocaleString()}). Ventas que se pudieron cerrar si se hubieran contactado.` },
                                                    { badge: 'Pérd. Inactividad', color: 'bg-orange-500', text: `Llamadas faltantes (${row.deficit}) ÷ Llamadas promedio por cierre × Tasa conversión × Ticket. Ventas perdidas por no cumplir la meta de actividad.` },
                                                    { badge: 'Abordaje', color: 'bg-emerald-500', text: 'Promedio de horas entre la asignación del lead (assigned_at) y el primer seguimiento registrado (first_follow_up_at). Solo leads con ambas fechas.' },
                                                ] as const).map(item => (
                                                    <div key={item.badge} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white border border-slate-100">
                                                        <span className={`text-[7px] font-black text-white px-2 py-1 rounded-md ${item.color} shrink-0 mt-0.5 uppercase tracking-wide`}>{item.badge}</span>
                                                        <p className="text-[9px] text-slate-500 font-medium leading-relaxed">{item.text}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </details>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Global Recommendation ─────────────────────────────── */}
            <div className="bg-white border border-slate-100 rounded-xl p-4 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                    <p className="text-[9px] font-black text-teal-600 uppercase tracking-wider mb-1">Sofía AI · Equipo</p>
                    <p className="text-[11px] text-slate-700 leading-relaxed font-medium">{getGlobalRecommendation(totalActualCalls, totalGoalUpToDate, totalPeriodGoal)}</p>
                </div>
            </div>

            {/* ── Consolidated Loss Panel ───────────────────────────── */}
            {(() => {
                const totalNeglectLoss = reportData.reduce((s, r) => s + r.userNeglectLoss, 0);
                const totalActivityLoss = reportData.reduce((s, r) => s + r.userActivityLoss, 0);
                const consolidatedGlobalLoss = totalNeglectLoss + totalActivityLoss;
                if (consolidatedGlobalLoss <= 0) return null;

                return (
                    <div className="bg-white border border-rose-100 rounded-2xl overflow-hidden">
                        {/* Panel header */}
                        <div className="px-5 py-3.5 border-b border-rose-100/60 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <TrendingDown className="w-4 h-4 text-rose-500" />
                                <p className="text-[10px] font-black text-rose-700 uppercase tracking-wider">Control de Oportunidades Perdidas</p>
                            </div>
                            <button onClick={() => window.print()} className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 hover:text-slate-700 border border-slate-200 bg-white px-2.5 py-1 rounded-lg transition-all no-print">
                                <Printer className="w-3 h-3" />Exportar
                            </button>
                        </div>

                        {/* 3 summary cards */}
                        <div className="grid grid-cols-3 divide-x divide-rose-100/50 p-0">
                            <div className="p-5">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Por Negligencia</p>
                                <p className="text-xl font-black text-rose-600">{formatCurrency(totalNeglectLoss)}</p>
                                <p className="text-[9px] text-slate-400 mt-1">{totalLeadsWithoutFollowUp} leads sin contacto</p>
                            </div>
                            <div className="p-5">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Por Inactividad</p>
                                <p className="text-xl font-black text-amber-600">{formatCurrency(totalActivityLoss)}</p>
                                <p className="text-[9px] text-slate-400 mt-1">{reportData.reduce((s, r) => s + r.deficit, 0)} llamadas faltantes</p>
                            </div>
                            <div className="p-5 bg-rose-50/30">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pérdida Total</p>
                                <p className="text-2xl font-black text-rose-700">{formatCurrency(consolidatedGlobalLoss)}</p>
                                <p className="text-[9px] text-slate-400 mt-1">impacto estimado en USD</p>
                            </div>
                        </div>

                        {/* Breakdown table */}
                        <div className="border-t border-rose-100/50">
                            <div className="grid grid-cols-12 px-5 py-2 bg-slate-50 text-[8px] font-black text-slate-400 uppercase tracking-wider">
                                <div className="col-span-3">Asesor</div>
                                <div className="col-span-2 text-center">Leads Sin Contacto</div>
                                <div className="col-span-2 text-center">Llamadas (Hecho/Meta)</div>
                                <div className="col-span-2 text-center">Déficit</div>
                                <div className="col-span-3 text-right">Pérdida Total</div>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {reportData.sort((a, b) => b.userConsolidated - a.userConsolidated).map(row => (
                                    <div key={row.userId} className="grid grid-cols-12 px-5 py-3.5 items-center hover:bg-slate-50/50 transition-colors">
                                        <div className="col-span-3 flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                                                {row.avatarUrl ? <img src={row.avatarUrl} className="w-full h-full object-cover" alt="" /> : <Users className="w-3.5 h-3.5 text-slate-400" />}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-800 uppercase">{row.userName}</p>
                                                <p className="text-[8px] text-slate-400">Conv: {row.conversionRate.toFixed(1)}%</p>
                                            </div>
                                        </div>
                                        <div className="col-span-2 text-center">
                                            <span className={`text-[11px] font-black ${row.leadsWithoutFollowUp > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{row.leadsWithoutFollowUp}</span>
                                        </div>
                                        <div className="col-span-2 text-center text-[11px]">
                                            <span className="font-black text-slate-700">{row.actual}</span>
                                            <span className="text-slate-300 mx-0.5">/</span>
                                            <span className="text-slate-400">{row.goalUpToDate}</span>
                                        </div>
                                        <div className="col-span-2 text-center">
                                            {row.deficit > 0 ? <span className="text-[11px] font-black text-rose-600">-{row.deficit}</span> : <span className="text-[11px] font-black text-emerald-600">0</span>}
                                        </div>
                                        <div className="col-span-3 text-right font-black text-[11px] text-rose-700">{formatCurrency(row.userConsolidated)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── Activity Dashboard ────────────────────────────────── */}
            <ActivityDashboard
                companyId={companyId}
                profileNames={profileNames}
                profileAvatars={profileAvatars}
                availableUserIds={callSummary.map(u => u.user_id)}
            />

            {/* ── Goal Modal ────────────────────────────────────────── */}

            {/* ── Send Report Modal ─────────────────────────────────── */}
            {sendReportModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                                    <Mail className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-white/70 uppercase tracking-wider">Reporte Individual</p>
                                    <p className="text-[13px] font-black text-white uppercase tracking-tight">{sendReportModal.advisorName}</p>
                                </div>
                            </div>
                            <button onClick={() => setSendReportModal(null)} className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
                                <X className="w-3.5 h-3.5 text-white" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-slate-100">
                            {([{ id: 'now', label: 'Enviar Ahora', icon: Send }, { id: 'schedule', label: 'Programar', icon: Clock }] as const).map(t => (
                                <button key={t.id} onClick={() => setSendReportModal(prev => prev ? { ...prev, tab: t.id } : null)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[9px] font-black uppercase tracking-wider transition-all ${
                                        sendReportModal.tab === t.id ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-400 hover:text-slate-600'
                                    }`}>
                                    <t.icon className="w-3 h-3" />{t.label}
                                </button>
                            ))}
                        </div>

                        <div className="p-5 space-y-4">
                            {sendReportModal.tab === 'now' ? (
                                <>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Enviar a (email)</label>
                                        <input
                                            type="email"
                                            value={sendReportModal.recipientEmail}
                                            onChange={(e) => setSendReportModal(prev => prev ? { ...prev, recipientEmail: e.target.value } : null)}
                                            placeholder="email@ejemplo.com"
                                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[11px] font-medium text-slate-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 outline-none"
                                        />
                                        <p className="text-[8px] text-slate-400 font-medium mt-1">El reporte incluye: KPIs, desglose diario, análisis de oportunidad y metodología.</p>
                                    </div>
                                    <div className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Período del reporte</p>
                                        <p className="text-[11px] font-bold text-slate-700 mt-0.5">{getFormattedDateRange()}</p>
                                    </div>
                                    {sendReportModal.sent ? (
                                        <div className="flex items-center justify-center gap-2 py-2">
                                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                                            <span className="text-[11px] font-black text-emerald-600">¡Enviado correctamente!</span>
                                        </div>
                                    ) : (
                                        <button onClick={handleSendReportNow} disabled={sendReportModal.sending || !sendReportModal.recipientEmail}
                                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:shadow-lg hover:shadow-indigo-200 transition-all disabled:opacity-50">
                                            {sendReportModal.sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                            {sendReportModal.sending ? 'Enviando...' : 'Enviar Reporte'}
                                        </button>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Destinatario (email)</label>
                                        <input
                                            type="email"
                                            value={sendReportModal.recipientEmail}
                                            onChange={(e) => setSendReportModal(prev => prev ? { ...prev, recipientEmail: e.target.value } : null)}
                                            placeholder="email@ejemplo.com"
                                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[11px] font-medium text-slate-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Frecuencia</label>
                                        <div className="flex gap-2">
                                            {([{ id: 'weekly', label: 'Semanal' }, { id: 'monthly', label: 'Mensual' }] as const).map(f => (
                                                <button key={f.id} onClick={() => setSendReportModal(prev => prev ? { ...prev, frequency: f.id } : null)}
                                                    className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all ${
                                                        sendReportModal.frequency === f.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-200'
                                                    }`}>
                                                    {f.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {sendReportModal.frequency === 'weekly' ? (
                                        <div>
                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Día de envío</label>
                                            <div className="flex gap-1">
                                                {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((d, i) => (
                                                    <button key={i} onClick={() => setSendReportModal(prev => prev ? { ...prev, dayOfWeek: i } : null)}
                                                        className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all ${
                                                            sendReportModal.dayOfWeek === i ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                                                        }`}>
                                                        {d}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Día del mes</label>
                                            <input type="number" min={1} max={28}
                                                value={sendReportModal.dayOfMonth}
                                                onChange={(e) => setSendReportModal(prev => prev ? { ...prev, dayOfMonth: parseInt(e.target.value) || 1 } : null)}
                                                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[11px] font-bold text-slate-700 focus:border-indigo-400 outline-none"
                                            />
                                        </div>
                                    )}
                                    {/* Time picker */}
                                    <div>
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Hora de envío</label>
                                        <div className="flex gap-1.5 items-center">
                                            {[6, 8, 10, 12].map(h => (
                                                <button key={h} onClick={() => setSendReportModal(prev => prev ? { ...prev, sendHour: h } : null)}
                                                    className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all ${
                                                        sendReportModal.sendHour === h ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 border border-slate-200'
                                                    }`}>
                                                    {h === 12 ? '12PM' : `${h}AM`}
                                                </button>
                                            ))}
                                            <input
                                                type="number" min={0} max={23}
                                                value={sendReportModal.sendHour}
                                                onChange={(e) => setSendReportModal(prev => prev ? { ...prev, sendHour: Math.min(23, Math.max(0, parseInt(e.target.value) || 0)) } : null)}
                                                className="w-14 border border-slate-200 rounded-lg px-2 py-2 text-[10px] font-bold text-center text-slate-700 focus:border-indigo-400 outline-none"
                                                title="Hora personalizada (0-23)"
                                            />
                                        </div>
                                        <p className="text-[8px] text-slate-400 mt-1">
                                            Envío a las <strong className="text-indigo-600">{String(sendReportModal.sendHour).padStart(2,'0')}:00</strong> hora local del servidor (UTC)
                                        </p>
                                    </div>
                                    <div className="bg-indigo-50 rounded-xl px-3 py-2.5 border border-indigo-100">
                                        <p className="text-[8px] font-black text-indigo-600 uppercase tracking-wider">Período del reporte automático</p>
                                        <div className="flex gap-2 mt-1.5 flex-wrap">
                                            {(['week', 'month', 'quarter'] as const).map(p => (
                                                <button key={p} onClick={() => setSendReportModal(prev => prev ? { ...prev, period: p } : null)}
                                                    className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${
                                                        sendReportModal.period === p ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-400 border border-indigo-200'
                                                    }`}>
                                                    {p === 'week' ? 'Última semana' : p === 'month' ? 'Este mes' : 'Trimestre'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <button onClick={handleSaveSchedule} disabled={sendReportModal.scheduling || !sendReportModal.recipientEmail}
                                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:shadow-lg hover:shadow-indigo-200 transition-all disabled:opacity-50">
                                        {sendReportModal.scheduling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                                        {sendReportModal.scheduling ? 'Guardando...' : 'Guardar Programación'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {isGoalPanelOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col border border-slate-200">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
                                    <Phone className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Metas de Llamadas</h2>
                                    <p className="text-[9px] text-slate-400 font-medium">Llamadas diarias por asesor</p>
                                </div>
                            </div>
                            <button onClick={() => setIsGoalPanelOpen(false)} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                                <X className="w-3.5 h-3.5 text-slate-400" />
                            </button>
                        </div>
                        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-2">
                            {callSummary.map(user => (
                                <div key={user.user_id} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                                    <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                                        {profileAvatars[user.user_id] ? <img src={profileAvatars[user.user_id]!} className="w-full h-full object-cover" alt="" /> : <Users className="w-3 h-3 text-slate-400" />}
                                    </div>
                                    <p className="text-[10px] font-black text-slate-700 uppercase flex-1 truncate">{profileNames[user.user_id] || 'Desconocido'}</p>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number" min={0} max={100}
                                            value={editGoals[user.user_id] || 0}
                                            onChange={(e) => setEditGoals(prev => ({ ...prev, [user.user_id]: parseInt(e.target.value) || 0 }))}
                                            className="w-14 h-7 border border-slate-200 rounded-lg text-center text-[11px] font-bold text-slate-700 focus:border-teal-400 focus:ring-2 focus:ring-teal-50 outline-none"
                                        />
                                        <span className="text-[8px] font-bold text-slate-400">/día</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
                            <button onClick={() => setIsGoalPanelOpen(false)} className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleSaveGoals} disabled={savingGoals} className="flex items-center gap-1.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:shadow-lg hover:shadow-teal-200 transition-all disabled:opacity-50">
                                {savingGoals ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
