import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Trophy, Users, TrendingUp, DollarSign, Target, Crown,
    Loader2, ChevronDown, BarChart3, Award, Zap, ArrowUpRight,
    ArrowDownRight, Minus, CalendarDays, CheckCircle, Settings, X, Save
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../auth/AuthProvider';
import {
    teamPerformanceService,
    type UserPerformance,
    type TeamPerformance,
    type PerformanceFilters,
    type CompanySummary,
} from '../../services/teamPerformance';
import { teamsService, type Team } from '../../services/teams';
import { performanceGoalsService, type PerformanceGoal } from '../../services/performanceGoals';
import { forecastService, type ForecastWithActual } from '../../services/forecastService';

// === CONSTANTS ===
const PERIODS = [
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

/** Monthly goals are scaled based on the active period filter */
function getGoalScale(period: string): number {
    switch (period) {
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
        case 'quarter':
            return 'trimestral';
        case 'year':
        case 'all':
            return 'anual';
        default:
            return 'mensual';
    }
}

// === MAIN COMPONENT ===
export default function TeamPerformancePage() {
    const { profile } = useAuth();
    const [userPerformance, setUserPerformance] = useState<UserPerformance[]>([]);
    const [teamPerformance, setTeamPerformance] = useState<TeamPerformance[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'users' | 'teams' | 'charts' | 'forecast'>('users');
    const [filters, setFilters] = useState<PerformanceFilters>({ period: 'all' });
    const [profileNames, setProfileNames] = useState<Record<string, string>>({});
    const [profileAvatars, setProfileAvatars] = useState<Record<string, string | null>>({});
    const [companySummary, setCompanySummary] = useState<CompanySummary>({ totalLeads: 0, wonDeals: 0, lostDeals: 0, totalValue: 0, totalClosing: 0 });

    // Goals
    const [goals, setGoals] = useState<PerformanceGoal[]>([]);
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);

    // Dropdown states
    const [isTeamDropdownOpen, setIsTeamDropdownOpen] = useState(false);
    const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
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

            const names: Record<string, string> = {};
            const avatars: Record<string, string | null> = {};
            userData.forEach((u) => {
                names[u.user_id] = u.full_name;
                avatars[u.user_id] = u.avatar_url;
            });
            setProfileNames(names);
            setProfileAvatars(avatars);
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
    const totalClosing = companySummary.totalClosing;
    const totalValue = companySummary.totalValue;
    const overallWinRate = totalLeads > 0 ? (totalWon / totalLeads) * 100 : 0;
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
                                    <button key={p.value} onClick={() => { const period = p.value; setFilters(period === 'custom' ? { ...filters, period, date_from: '', date_to: '' } : { ...filters, period, date_from: undefined, date_to: undefined }); setIsPeriodDropdownOpen(false); }} className={`w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-between ${filters.period === p.value ? 'bg-violet-50 text-violet-600' : 'text-gray-500 hover:bg-gray-50'}`}>
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

            {/* Tabs */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
                {([
                    { key: 'users' as const, icon: Users, label: 'Por Persona' },
                    { key: 'teams' as const, icon: BarChart3, label: 'Por Equipo' },
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

            {/* Content */}
            {activeTab === 'users' ? (
                <UserPerformanceTable data={userPerformance} getUserGoal={getUserGoal} periodLabel={periodLabel} companySummary={companySummary} />
            ) : activeTab === 'teams' ? (
                <TeamPerformanceGrid data={teamPerformance} profileNames={profileNames} profileAvatars={profileAvatars} getTeamGoal={getTeamGoal} periodLabel={periodLabel} />
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
                    companyId={profile?.company_id || ''}
                    onClose={() => setIsGoalModalOpen(false)}
                    onSaved={() => {
                        setIsGoalModalOpen(false);
                        loadData();
                    }}
                />
            )}
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
function GoalProgressBar({ actual, goal, type = 'number' }: { actual: number; goal: number; type?: 'number' | 'currency' }) {
    const pct = goal > 0 ? Math.min((actual / goal) * 100, 100) : 0;
    const color = pct >= 80 ? 'from-emerald-400 to-emerald-500' : pct >= 50 ? 'from-amber-400 to-amber-500' : 'from-red-400 to-red-500';
    const emoji = pct >= 80 ? '🟢' : pct >= 50 ? '🟡' : '🔴';
    const label = type === 'currency' ? formatCurrency(goal) : String(goal);

    return (
        <div className="mt-1">
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[7px] font-bold text-gray-400 mt-0.5">
                {emoji} {pct.toFixed(0)}% de {label}
            </p>
        </div>
    );
}

function UserPerformanceTable({ data, getUserGoal, periodLabel, companySummary }: {
    data: UserPerformance[];
    getUserGoal: (userId: string) => { leads: number; value: number } | null;
    periodLabel: string;
    companySummary?: CompanySummary;
}) {
    const navigate = useNavigate();
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
                        📊 Metas {periodLabel}es activas — las barras de progreso muestran el avance vs meta
                    </p>
                </div>
            )}
            <div className="grid grid-cols-12 gap-2 px-6 py-3 bg-gray-50/80 border-b border-gray-100 text-[8px] font-black text-gray-400 uppercase tracking-widest">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-3">Vendedor</div>
                <div className="col-span-1 text-center">Leads</div>
                <div className="col-span-1 text-center">Ganados</div>
                <div className="col-span-1 text-center">Perdidos</div>
                <div className="col-span-1 text-center">Tasa</div>
                <div className="col-span-2 text-right">Valor Pipeline</div>
                <div className="col-span-2 text-right">Monto Cerrado</div>
            </div>
            <div className="divide-y divide-gray-50">
                {data.map((user, index) => {
                    const goal = getUserGoal(user.user_id);
                    return (
                        <div key={user.user_id} className="grid grid-cols-12 gap-2 px-6 py-4 items-center hover:bg-gray-50/50 transition-colors group">
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
                            <div className="col-span-3 flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                                    {user.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover" alt="" /> : <Users className="w-4 h-4 text-gray-300" />}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[12px] font-black text-gray-800 uppercase tracking-tight truncate">{user.full_name}</p>
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
                                {user.leads_won > 0 ? (
                                    <span className="text-[13px] font-black text-emerald-600 cursor-pointer hover:text-emerald-800 hover:underline transition-colors" onClick={(e) => { e.stopPropagation(); navigate('/leads', { state: { assignedFilter: user.user_id, status: ['Cerrado', 'Cliente'] } }); }}>{user.leads_won}</span>
                                ) : <span className="text-[13px] font-black text-emerald-600">{user.leads_won}</span>}
                                {goal && goal.leads > 0 && <GoalProgressBar actual={user.leads_won} goal={goal.leads} />}
                            </div>
                            {/* Lost */}
                            <div className="col-span-1 text-center">
                                {user.leads_lost > 0 ? (
                                    <span className="text-[13px] font-black text-red-400 cursor-pointer hover:text-red-600 hover:underline transition-colors" onClick={(e) => { e.stopPropagation(); navigate('/leads', { state: { assignedFilter: user.user_id, status: 'Perdido' } }); }}>{user.leads_lost}</span>
                                ) : <span className="text-[13px] font-black text-red-400">{user.leads_lost}</span>}
                            </div>
                            {/* Win Rate */}
                            <div className="col-span-1 text-center">
                                <WinRateBadge rate={user.win_rate} />
                            </div>
                            {/* Pipeline Value */}
                            <div className="col-span-2 text-right">
                                <span className="text-[12px] font-black text-gray-600">{formatCurrency(user.total_value)}</span>
                            </div>
                            {/* Closing Amount */}
                            <div className="col-span-2 text-right">
                                <span className="text-[13px] font-black text-[#4449AA]">{formatCurrency(user.total_closing_amount)}</span>
                                {goal && goal.value > 0 && <GoalProgressBar actual={user.total_closing_amount} goal={goal.value} type="currency" />}
                                {user.avg_deal_size > 0 && !goal && (
                                    <p className="text-[8px] text-gray-400 font-bold mt-0.5">Avg: {formatCurrency(user.avg_deal_size)}</p>
                                )}
                            </div>
                        </div>
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
function GoalConfigModal({ userPerformance, teams, goals, companyId, onClose, onSaved }: {
    userPerformance: UserPerformance[];
    teams: Team[];
    goals: PerformanceGoal[];
    companyId: string;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [modalTab, setModalTab] = useState<'users' | 'teams'>('users');
    const [saving, setSaving] = useState(false);

    // User goals state
    const [userGoals, setUserGoals] = useState<Record<string, { leads: number; value: number }>>(() => {
        const map: Record<string, { leads: number; value: number }> = {};
        userPerformance.forEach((u) => {
            const existing = goals.find((g) => g.user_id === u.user_id && !g.team_id);
            map[u.user_id] = { leads: existing?.goal_leads || 0, value: Number(existing?.goal_value || 0) };
        });
        return map;
    });

    // Team goals state
    const [teamGoals, setTeamGoals] = useState<Record<string, { leads: number; value: number }>>(() => {
        const map: Record<string, { leads: number; value: number }> = {};
        teams.forEach((t) => {
            const existing = goals.find((g) => g.team_id === t.id && !g.user_id);
            map[t.id] = { leads: existing?.goal_leads || 0, value: Number(existing?.goal_value || 0) };
        });
        return map;
    });

    const handleSave = async () => {
        setSaving(true);
        try {
            if (modalTab === 'users') {
                await performanceGoalsService.saveUserGoals(
                    companyId,
                    Object.entries(userGoals).map(([user_id, g]) => ({ user_id, goal_leads: g.leads, goal_value: g.value }))
                );
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
            <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-indigo-50">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-black text-[#4449AA] tracking-tight">🎯 Configurar Metas de Ventas</h2>
                            <p className="text-[11px] text-gray-400 font-bold mt-1">
                                Las metas son <span className="text-violet-600">mensuales</span> — se escalan automáticamente según el periodo seleccionado
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
                <div className="px-8 py-4 overflow-y-auto max-h-[50vh]">
                    {modalTab === 'users' ? (
                        <div className="space-y-1">
                            <div className="grid grid-cols-12 gap-2 py-2 text-[8px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                <div className="col-span-5">Vendedor</div>
                                <div className="col-span-3 text-center">Meta Leads / Mes</div>
                                <div className="col-span-4 text-center">Meta Valor ($) / Mes</div>
                            </div>
                            {userPerformance.map((u) => (
                                <div key={u.user_id} className="grid grid-cols-12 gap-2 py-3 items-center hover:bg-gray-50/50 rounded-xl transition-colors">
                                    <div className="col-span-5 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                                            {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" alt="" /> : <Users className="w-3.5 h-3.5 text-gray-300" />}
                                        </div>
                                        <span className="text-[11px] font-black text-gray-700 truncate">{u.full_name}</span>
                                    </div>
                                    <div className="col-span-3 flex justify-center">
                                        <input
                                            type="number"
                                            min={0}
                                            value={userGoals[u.user_id]?.leads || ''}
                                            onChange={(e) => setUserGoals({ ...userGoals, [u.user_id]: { ...userGoals[u.user_id], leads: parseInt(e.target.value) || 0 } })}
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
                                                value={userGoals[u.user_id]?.value || ''}
                                                onChange={(e) => setUserGoals({ ...userGoals, [u.user_id]: { ...userGoals[u.user_id], value: parseFloat(e.target.value) || 0 } })}
                                                placeholder="0"
                                                className="w-24 text-center text-[12px] font-bold text-gray-700 outline-none bg-transparent"
                                            />
                                        </div>
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
