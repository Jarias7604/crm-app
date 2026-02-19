import { useState, useEffect, useCallback, useRef } from 'react';
import { Users, Activity, X, ChevronDown, Loader2, Target, TrendingUp, TrendingDown, Minus, Pencil, Check } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { callActivityService, ACTION_TYPE_CONFIG, type ActionType } from '../services/callActivity';
import { CustomDatePicker } from './ui/CustomDatePicker';

// ─── Channel colors ───
const CHANNEL_COLORS: Record<string, string> = {
    call: '#3B82F6',
    email: '#8B5CF6',
    whatsapp: '#22C55E',
    telegram: '#06B6D4',
    quote_sent: '#F59E0B',
    info_sent: '#EC4899',
    meeting: '#6366F1',
};

type GroupBy = 'day' | 'week' | 'month';

interface Props {
    companyId: string;
    profileNames: Record<string, string>;
    profileAvatars: Record<string, string | null>;
    /** All user IDs that have activity */
    availableUserIds: string[];
}

const PRESETS = [
    { label: 'Hoy', days: 0 },
    { label: '7 días', days: 7 },
    { label: '14 días', days: 14 },
    { label: '30 días', days: 30 },
    { label: '90 días', days: 90 },
    { label: 'Este año', days: -1 },
] as const;

export function ActivityDashboard({ companyId, profileNames, profileAvatars, availableUserIds }: Props) {
    // ─── Filter state ───
    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 14);
        return d.toISOString().split('T')[0];
    });
    const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [groupBy, setGroupBy] = useState<GroupBy>('day');
    const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

    // ─── Goal state ───
    const [dailyGoal, setDailyGoal] = useState(40);
    const [isEditingGoal, setIsEditingGoal] = useState(false);
    const [goalInput, setGoalInput] = useState('40');

    // ─── Data ───
    const [timeline, setTimeline] = useState<{ key: string; label: string; total: number;[k: string]: number | string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [kpis, setKpis] = useState({ total: 0, avgPerDay: 0, topChannel: '', topCount: 0 });

    // Ref to avoid scroll jump
    const containerRef = useRef<HTMLDivElement>(null);
    const userDropdownRef = useRef<HTMLDivElement>(null);

    // ─── Auto-adjust groupBy based on date range ───
    const getSmartGroupBy = useCallback((from: string, to: string): GroupBy => {
        const diff = (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24);
        if (diff <= 31) return 'day';
        if (diff <= 120) return 'week';
        return 'month';
    }, []);

    // ─── Fetch timeline data ───
    const loadTimeline = useCallback(async () => {
        if (!companyId) return;
        setLoading(true);
        try {
            const data = await callActivityService.getActivityTimeline({
                companyId,
                dateFrom: `${dateFrom}T00:00:00`,
                dateTo: `${dateTo}T23:59:59`,
                userIds: selectedUsers.length > 0 ? selectedUsers : undefined,
                groupBy,
            });
            setTimeline(data);

            // Compute KPIs
            const total = data.reduce((s, d) => s + d.total, 0);
            const periods = data.length || 1;
            const channelTotals: Record<string, number> = {};
            const actionTypes: ActionType[] = ['call', 'email', 'whatsapp', 'telegram', 'quote_sent', 'info_sent', 'meeting'];
            actionTypes.forEach(t => {
                channelTotals[t] = data.reduce((s, d) => s + (Number(d[t]) || 0), 0);
            });
            const topEntry = Object.entries(channelTotals).sort((a, b) => b[1] - a[1])[0];
            setKpis({
                total,
                avgPerDay: Math.round((total / periods) * 10) / 10,
                topChannel: topEntry?.[0] || '',
                topCount: topEntry?.[1] || 0,
            });
        } catch (err) {
            console.error('Error loading activity timeline:', err);
        } finally {
            setLoading(false);
        }
    }, [companyId, dateFrom, dateTo, selectedUsers, groupBy]);

    useEffect(() => {
        loadTimeline();
    }, [loadTimeline]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
                setIsUserDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    // ─── Preset handler ───
    const applyPreset = (days: number) => {
        const to = new Date();
        let from: Date;
        if (days === -1) {
            // This year
            from = new Date(to.getFullYear(), 0, 1);
        } else if (days === 0) {
            from = new Date(to);
        } else {
            from = new Date(to);
            from.setDate(from.getDate() - days);
        }
        const newFrom = from.toISOString().split('T')[0];
        const newTo = to.toISOString().split('T')[0];
        setDateFrom(newFrom);
        setDateTo(newTo);
        setGroupBy(getSmartGroupBy(newFrom, newTo));
    };

    // ─── Toggle user selection ───
    const toggleUser = (userId: string) => {
        setSelectedUsers(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    // ─── Active channels (for legend filtering) ───
    const activeChannels = Object.keys(CHANNEL_COLORS).filter(ch =>
        timeline.some(d => Number(d[ch]) > 0)
    );

    const topConfig = ACTION_TYPE_CONFIG[kpis.topChannel as ActionType];

    // ─── Goal calculations ───
    const goalForPeriod = groupBy === 'day' ? dailyGoal : groupBy === 'week' ? dailyGoal * 5 : dailyGoal * 22;
    const goalLabel = groupBy === 'day' ? 'día' : groupBy === 'week' ? 'semana' : 'mes';
    const achievementPct = goalForPeriod > 0 ? Math.round((kpis.avgPerDay / goalForPeriod) * 100) : 0;
    const daysAboveGoal = timeline.filter(d => d.total >= goalForPeriod).length;
    const daysTotal = timeline.length;
    const achievementColor = achievementPct >= 100 ? 'text-emerald-500' : achievementPct >= 70 ? 'text-amber-500' : 'text-red-500';
    const achievementBg = achievementPct >= 100 ? 'bg-emerald-50 border-emerald-100' : achievementPct >= 70 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100';
    const AchievementIcon = achievementPct >= 100 ? TrendingUp : achievementPct >= 70 ? Minus : TrendingDown;

    // Save goal handler
    const saveGoal = () => {
        const parsed = parseInt(goalInput);
        if (!isNaN(parsed) && parsed > 0) {
            setDailyGoal(parsed);
        }
        setIsEditingGoal(false);
    };

    return (
        <div ref={containerRef} className="space-y-5">

            {/* ══════════ FILTER BAR ══════════ */}
            <div className="bg-white/70 backdrop-blur-xl rounded-[1.5rem] border border-gray-100/60 shadow-[0_2px_20px_rgba(0,0,0,0.03)] p-5">
                <div className="flex flex-wrap items-start gap-4">

                    {/* Date Range */}
                    <div className="flex-1 min-w-[320px]">
                        <label className="block text-[8px] font-black uppercase tracking-[0.15em] text-gray-400 mb-2">
                            📅 Período
                        </label>
                        <div className="flex items-center gap-2">
                            <CustomDatePicker
                                value={dateFrom}
                                onChange={(val) => {
                                    if (val) {
                                        setDateFrom(val);
                                        setGroupBy(getSmartGroupBy(val, dateTo));
                                    }
                                }}
                                placeholder="Desde"
                                variant="transparent"
                                className="w-[155px]"
                            />
                            <span className="text-[10px] font-black text-gray-300 tracking-widest">→</span>
                            <CustomDatePicker
                                value={dateTo}
                                onChange={(val) => {
                                    if (val) {
                                        setDateTo(val);
                                        setGroupBy(getSmartGroupBy(dateFrom, val));
                                    }
                                }}
                                placeholder="Hasta"
                                variant="transparent"
                                className="w-[155px]"
                            />
                        </div>
                        {/* Quick presets */}
                        <div className="flex flex-wrap gap-1 mt-2">
                            {PRESETS.map(p => (
                                <button
                                    key={p.label}
                                    onClick={() => applyPreset(p.days)}
                                    className="px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* User Multi-Select */}
                    <div className="min-w-[200px] relative" ref={userDropdownRef}>
                        <label className="block text-[8px] font-black uppercase tracking-[0.15em] text-gray-400 mb-2">
                            <Users className="w-3 h-3 inline mr-1 -mt-0.5" />
                            Agentes
                        </label>
                        <button
                            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                            className="w-full flex items-center justify-between bg-gray-50/80 border border-gray-200/60 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 hover:border-indigo-300 transition-all"
                        >
                            <span className="truncate">
                                {selectedUsers.length === 0
                                    ? 'Todos los agentes'
                                    : `${selectedUsers.length} seleccionado${selectedUsers.length > 1 ? 's' : ''}`
                                }
                            </span>
                            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isUserDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Selected chips */}
                        {selectedUsers.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                                {selectedUsers.map(uid => (
                                    <span
                                        key={uid}
                                        className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 rounded-lg px-2 py-0.5 text-[9px] font-black"
                                    >
                                        {profileNames[uid]?.split(' ')[0] || 'N/A'}
                                        <button onClick={() => toggleUser(uid)} className="hover:text-red-500 transition-colors">
                                            <X className="w-2.5 h-2.5" />
                                        </button>
                                    </span>
                                ))}
                                <button
                                    onClick={() => setSelectedUsers([])}
                                    className="text-[8px] font-black text-gray-400 hover:text-red-500 transition-colors uppercase tracking-wider px-1"
                                >
                                    Limpiar
                                </button>
                            </div>
                        )}

                        {/* Dropdown */}
                        {isUserDropdownOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 py-1 max-h-60 overflow-y-auto">
                                {availableUserIds.map(uid => (
                                    <button
                                        key={uid}
                                        onClick={() => toggleUser(uid)}
                                        className={`w-full text-left px-3 py-2.5 text-xs font-bold flex items-center gap-2.5 transition-colors ${selectedUsers.includes(uid)
                                            ? 'bg-indigo-50 text-indigo-700'
                                            : 'text-gray-600 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                                            {profileAvatars[uid] ? (
                                                <img src={profileAvatars[uid]!} className="w-full h-full object-cover" alt="" />
                                            ) : (
                                                <Users className="w-3 h-3 text-gray-400" />
                                            )}
                                        </div>
                                        <span className="flex-1 truncate">{profileNames[uid] || uid}</span>
                                        {selectedUsers.includes(uid) && (
                                            <div className="w-4 h-4 rounded bg-indigo-500 flex items-center justify-center">
                                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* GroupBy */}
                    <div>
                        <label className="block text-[8px] font-black uppercase tracking-[0.15em] text-gray-400 mb-2">
                            <Activity className="w-3 h-3 inline mr-1 -mt-0.5" />
                            Agrupar por
                        </label>
                        <div className="flex bg-gray-100/80 rounded-xl p-0.5">
                            {([
                                { value: 'day' as GroupBy, label: 'Día' },
                                { value: 'week' as GroupBy, label: 'Semana' },
                                { value: 'month' as GroupBy, label: 'Mes' },
                            ]).map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setGroupBy(opt.value)}
                                    className={`px-3.5 py-2 rounded-[10px] text-[9px] font-black uppercase tracking-widest transition-all ${groupBy === opt.value
                                        ? 'bg-white text-gray-800 shadow-sm'
                                        : 'text-gray-400 hover:text-gray-600'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ══════════ KPI STRIP ══════════ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-100/60 shadow-[0_2px_20px_rgba(0,0,0,0.03)] px-5 py-4">
                    <p className="text-[8px] font-black uppercase tracking-[0.15em] text-gray-400 mb-1">Total Acciones</p>
                    <p className="text-2xl font-black text-gray-900 tracking-tight">{kpis.total.toLocaleString()}</p>
                </div>
                <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-100/60 shadow-[0_2px_20px_rgba(0,0,0,0.03)] px-5 py-4">
                    <p className="text-[8px] font-black uppercase tracking-[0.15em] text-gray-400 mb-1">
                        Promedio / {groupBy === 'day' ? 'Día' : groupBy === 'week' ? 'Semana' : 'Mes'}
                    </p>
                    <p className="text-2xl font-black text-gray-900 tracking-tight">{kpis.avgPerDay}</p>
                    <p className="text-[9px] font-bold text-gray-400 mt-0.5">Meta: {goalForPeriod} / {goalLabel}</p>
                </div>
                {/* Goal Achievement KPI */}
                <div className={`backdrop-blur-xl rounded-2xl border shadow-[0_2px_20px_rgba(0,0,0,0.03)] px-5 py-4 ${achievementBg}`}>
                    <p className="text-[8px] font-black uppercase tracking-[0.15em] text-gray-400 mb-1 flex items-center gap-1">
                        <Target className="w-3 h-3" /> Cumplimiento
                    </p>
                    <div className="flex items-center gap-2">
                        <p className={`text-2xl font-black tracking-tight ${achievementColor}`}>{achievementPct}%</p>
                        <AchievementIcon className={`w-5 h-5 ${achievementColor}`} />
                    </div>
                    <p className="text-[9px] font-bold text-gray-400 mt-0.5">
                        {daysAboveGoal}/{daysTotal} {groupBy === 'day' ? 'días' : groupBy === 'week' ? 'semanas' : 'meses'} alcanzados
                    </p>
                </div>
                {/* Meta Configuration */}
                <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-100/60 shadow-[0_2px_20px_rgba(0,0,0,0.03)] px-5 py-4">
                    <p className="text-[8px] font-black uppercase tracking-[0.15em] text-gray-400 mb-1 flex items-center gap-1">
                        {topConfig ? `${topConfig.icon}` : '📊'} Canal Principal
                    </p>
                    <p className="text-lg font-black text-gray-900 tracking-tight">
                        {topConfig ? `${topConfig.icon} ${topConfig.label}` : '—'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                        <p className="text-[9px] font-bold text-gray-400">{kpis.topCount} acciones</p>
                        <span className="text-[8px] text-gray-300">|</span>
                        <div className="flex items-center gap-1">
                            <span className="text-[9px] font-bold text-gray-400">Meta diaria:</span>
                            {isEditingGoal ? (
                                <div className="flex items-center gap-0.5">
                                    <input
                                        type="number"
                                        value={goalInput}
                                        onChange={(e) => setGoalInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && saveGoal()}
                                        className="w-12 px-1 py-0 text-[10px] font-black text-indigo-600 border border-indigo-300 rounded bg-indigo-50 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                        autoFocus
                                        min={1}
                                    />
                                    <button onClick={saveGoal} className="text-emerald-500 hover:text-emerald-600">
                                        <Check className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => setIsEditingGoal(false)} className="text-gray-400 hover:text-red-500">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => { setGoalInput(String(dailyGoal)); setIsEditingGoal(true); }}
                                    className="flex items-center gap-0.5 text-[10px] font-black text-indigo-600 hover:text-indigo-800 transition-colors"
                                >
                                    {dailyGoal}
                                    <Pencil className="w-2.5 h-2.5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ══════════ CHART ══════════ */}
            <div className="bg-white/70 backdrop-blur-xl rounded-[1.5rem] border border-gray-100/60 shadow-[0_2px_20px_rgba(0,0,0,0.03)] p-6">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-[11px] font-black text-gray-600 uppercase tracking-[0.12em] flex items-center gap-2">
                        📊 Línea de Tiempo
                    </h3>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                            <div className="w-4 h-[2px] bg-red-400" style={{ borderTop: '2px dashed #F87171' }} />
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Meta: {goalForPeriod}/{goalLabel}</span>
                        </div>
                        {loading && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
                    </div>
                </div>

                {timeline.length > 0 ? (
                    <div style={{ width: '100%', height: 320 }}>
                        <ResponsiveContainer>
                            <BarChart data={timeline} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 10, fontWeight: 700, fill: '#9CA3AF' }}
                                    tickLine={false}
                                    axisLine={{ stroke: '#E5E7EB' }}
                                    interval={timeline.length > 20 ? Math.ceil(timeline.length / 15) : 0}
                                />
                                <YAxis
                                    tick={{ fontSize: 10, fontWeight: 700, fill: '#9CA3AF' }}
                                    tickLine={false}
                                    axisLine={false}
                                    allowDecimals={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: 16,
                                        border: 'none',
                                        boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        padding: '12px 16px',
                                    }}
                                    formatter={((value: number | undefined, name: string | undefined) => {
                                        const config = ACTION_TYPE_CONFIG[(name || '') as keyof typeof ACTION_TYPE_CONFIG];
                                        return [value ?? 0, config ? `${config.icon} ${config.label}` : (name || '')];
                                    }) as any}
                                    labelFormatter={(label) => {
                                        const item = timeline.find(d => d.label === label);
                                        const total = item?.total || 0;
                                        const diff = total - goalForPeriod;
                                        const icon = diff >= 0 ? '✅' : '⚠️';
                                        return `${label}  ${icon} ${total}/${goalForPeriod}`;
                                    }}
                                    cursor={{ fill: 'rgba(99, 102, 241, 0.04)' }}
                                />
                                {/* ═══ GOAL REFERENCE LINE ═══ */}
                                <ReferenceLine
                                    y={goalForPeriod}
                                    stroke="#F87171"
                                    strokeDasharray="6 4"
                                    strokeWidth={2}
                                    label={{
                                        value: `Meta: ${goalForPeriod}`,
                                        position: 'right',
                                        fill: '#F87171',
                                        fontSize: 10,
                                        fontWeight: 800,
                                    }}
                                />
                                <Legend
                                    formatter={(value: string) => {
                                        const config = ACTION_TYPE_CONFIG[value as keyof typeof ACTION_TYPE_CONFIG];
                                        return config ? `${config.icon} ${config.label}` : value;
                                    }}
                                    wrapperStyle={{ fontSize: 10, fontWeight: 800, paddingTop: 12 }}
                                    iconType="circle"
                                    iconSize={8}
                                />
                                {activeChannels.map((ch, idx) => (
                                    <Bar
                                        key={ch}
                                        dataKey={ch}
                                        stackId="a"
                                        fill={CHANNEL_COLORS[ch]}
                                        name={ch}
                                        radius={idx === activeChannels.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : !loading ? (
                    <div className="h-64 flex flex-col items-center justify-center">
                        <Activity className="w-10 h-10 text-gray-200 mb-3" />
                        <p className="text-xs font-bold text-gray-400">No hay actividad en este período</p>
                        <p className="text-[10px] text-gray-300 mt-1">Ajusta los filtros o el rango de fechas</p>
                    </div>
                ) : (
                    <div className="h-64 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-indigo-300 animate-spin" />
                    </div>
                )}
            </div>
        </div>
    );
}
