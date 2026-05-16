import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Zap, Brain, Target, Database, Bot, Phone, Activity, Clock, CheckCircle, XCircle, AlertCircle, Radio } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../auth/AuthProvider';

// ── Agent definitions ────────────────────────────────────────────────────────
const AGENTS = [
    {
        id: 'orchestrator',
        name: 'Orchestrator',
        role: 'Control Central',
        description: 'Coordina todos los agentes y corre el motor cada hora',
        icon: Brain,
        color: 'indigo',
        agent_name_db: 'orchestrator',
    },
    {
        id: 'oracle',
        name: 'Oracle',
        role: 'Lead Scoring',
        description: 'Evalúa urgencia y prioridad de cada lead (0–100)',
        icon: Target,
        color: 'amber',
        agent_name_db: 'oracle',
    },
    {
        id: 'atlas',
        name: 'Atlas',
        role: 'Data Quality',
        description: 'Valida y puntúa la integridad de los datos de leads',
        icon: Database,
        color: 'cyan',
        agent_name_db: 'atlas',
    },
    {
        id: 'maya',
        name: 'Maya',
        role: 'Content AI',
        description: 'Genera mensajes personalizados con GPT-4o-mini',
        icon: Zap,
        color: 'fuchsia',
        agent_name_db: 'maya',
    },
    {
        id: 'sofia',
        name: 'Sofía',
        role: 'Sales Agent',
        description: 'Ejecuta seguimientos por WhatsApp y Telegram',
        icon: Bot,
        color: 'violet',
        agent_name_db: 'sofia',
    },
    {
        id: 'callbot',
        name: 'CallBot',
        role: 'Voice Agent',
        description: 'Llama automáticamente a leads de alta prioridad',
        icon: Phone,
        color: 'emerald',
        agent_name_db: 'callbot',
    },
];

// Color maps
const COLOR_MAP: Record<string, { bg: string; border: string; text: string; glow: string; light: string; badge: string }> = {
    indigo:  { bg: 'bg-indigo-600',  border: 'border-indigo-200',  text: 'text-indigo-600',  glow: 'shadow-indigo-500/30',  light: 'bg-indigo-50',  badge: 'bg-indigo-100 text-indigo-700' },
    amber:   { bg: 'bg-amber-500',   border: 'border-amber-200',   text: 'text-amber-600',   glow: 'shadow-amber-500/30',   light: 'bg-amber-50',   badge: 'bg-amber-100 text-amber-700' },
    cyan:    { bg: 'bg-cyan-500',    border: 'border-cyan-200',    text: 'text-cyan-600',    glow: 'shadow-cyan-500/30',    light: 'bg-cyan-50',    badge: 'bg-cyan-100 text-cyan-700' },
    fuchsia: { bg: 'bg-fuchsia-500', border: 'border-fuchsia-200', text: 'text-fuchsia-600', glow: 'shadow-fuchsia-500/30', light: 'bg-fuchsia-50', badge: 'bg-fuchsia-100 text-fuchsia-700' },
    violet:  { bg: 'bg-violet-600',  border: 'border-violet-200',  text: 'text-violet-600',  glow: 'shadow-violet-500/30',  light: 'bg-violet-50',  badge: 'bg-violet-100 text-violet-700' },
    emerald: { bg: 'bg-emerald-500', border: 'border-emerald-200', text: 'text-emerald-600', glow: 'shadow-emerald-500/30', light: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700' },
};

interface AgentStats {
    total: number;
    last24h: number;
    lastActivity: Date | null;
    status: 'online' | 'idle' | 'offline';
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function AgentNetworkMap() {
    const { profile } = useAuth();
    const [agentStats, setAgentStats] = useState<Record<string, AgentStats>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const [totalToday, setTotalToday] = useState(0);

    const loadStats = useCallback(async () => {
        if (!profile?.company_id) return;
        setIsLoading(true);
        try {
            const { data } = await supabase
                .from('ai_audit_trail')
                .select('agent_name, created_at')
                .eq('company_id', profile.company_id)
                .order('created_at', { ascending: false })
                .limit(500);

            const now = Date.now();
            const stats: Record<string, AgentStats> = {};
            let todayCount = 0;
            const dayMs = 24 * 60 * 60 * 1000;
            const twoHourMs = 2 * 60 * 60 * 1000;

            for (const agent of AGENTS) {
                const entries = (data || []).filter(e => e.agent_name === agent.agent_name_db);
                const last24h = entries.filter(e => now - new Date(e.created_at).getTime() < dayMs).length;
                const lastEntry = entries[0];
                const lastActivity = lastEntry ? new Date(lastEntry.created_at) : null;
                const msSinceLast = lastActivity ? now - lastActivity.getTime() : Infinity;

                let status: 'online' | 'idle' | 'offline' = 'offline';
                if (msSinceLast < twoHourMs) status = 'online';
                else if (msSinceLast < dayMs) status = 'idle';

                todayCount += last24h;
                stats[agent.id] = { total: entries.length, last24h, lastActivity, status };
            }

            setAgentStats(stats);
            setTotalToday(todayCount);
            setLastRefresh(new Date());
        } catch (err) {
            console.error('AgentNetworkMap error:', err);
        } finally {
            setIsLoading(false);
        }
    }, [profile?.company_id]);

    useEffect(() => {
        loadStats();
        const interval = setInterval(loadStats, 60000);
        return () => clearInterval(interval);
    }, [loadStats]);

    const formatLastSeen = (date: Date | null) => {
        if (!date) return 'Sin actividad';
        const mins = Math.floor((Date.now() - date.getTime()) / 60000);
        if (mins < 1) return 'Ahora mismo';
        if (mins < 60) return `Hace ${mins}m`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `Hace ${hrs}h`;
        return `Hace ${Math.floor(hrs / 24)}d`;
    };

    const StatusIcon = ({ status }: { status: 'online' | 'idle' | 'offline' }) => {
        if (status === 'online') return (
            <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </div>
        );
        if (status === 'idle') return <div className="h-3 w-3 rounded-full bg-amber-400" />;
        return <div className="h-3 w-3 rounded-full bg-gray-300" />;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 font-sans">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <Link to="/marketing/cockpit" className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-black text-white flex items-center gap-3">
                            <Radio className="w-6 h-6 text-emerald-400" />
                            Red de Agentes AI
                        </h1>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                            Sistema autónomo 24/7 · Actualiza en tiempo real · Auto-refresh cada 60s
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2">
                        <div className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </div>
                        <span className="text-xs font-bold text-emerald-400">{totalToday} acciones hoy</span>
                    </div>
                    <button
                        onClick={loadStats}
                        disabled={isLoading}
                        className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-400 hover:text-white transition-all"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Flow diagram label */}
            <div className="text-center mb-6">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Flujo de Ejecución Autónoma</p>
            </div>

            {/* ── TIER 1: Orchestrator ─────────────────────────────────── */}
            <div className="flex justify-center mb-3">
                <AgentNode agent={AGENTS[0]} stats={agentStats['orchestrator']} formatLastSeen={formatLastSeen} StatusIcon={StatusIcon} />
            </div>

            {/* Connector down */}
            <FlowConnector />

            {/* ── TIER 2: Oracle + Atlas ───────────────────────────────── */}
            <div className="flex justify-center gap-24 mb-3 relative">
                <AgentNode agent={AGENTS[1]} stats={agentStats['oracle']} formatLastSeen={formatLastSeen} StatusIcon={StatusIcon} />
                <AgentNode agent={AGENTS[2]} stats={agentStats['atlas']} formatLastSeen={formatLastSeen} StatusIcon={StatusIcon} />
                {/* Horizontal connector between them */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1">
                    <div className="w-10 h-px bg-slate-700"></div>
                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">sync</span>
                    <div className="w-10 h-px bg-slate-700"></div>
                </div>
            </div>

            {/* Connector down */}
            <FlowConnector />

            {/* ── TIER 3: Maya ─────────────────────────────────────────── */}
            <div className="flex justify-center mb-3">
                <AgentNode agent={AGENTS[3]} stats={agentStats['maya']} formatLastSeen={formatLastSeen} StatusIcon={StatusIcon} />
            </div>

            {/* Connector down */}
            <FlowConnector />

            {/* ── TIER 4: Sofia + CallBot ───────────────────────────────── */}
            <div className="flex justify-center gap-24 mb-3 relative">
                <AgentNode agent={AGENTS[4]} stats={agentStats['sofia']} formatLastSeen={formatLastSeen} StatusIcon={StatusIcon} />
                <AgentNode agent={AGENTS[5]} stats={agentStats['callbot']} formatLastSeen={formatLastSeen} StatusIcon={StatusIcon} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1">
                    <div className="w-10 h-px bg-slate-700"></div>
                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">canal</span>
                    <div className="w-10 h-px bg-slate-700"></div>
                </div>
            </div>

            {/* ── Legend ──────────────────────────────────────────────────── */}
            <div className="flex justify-center gap-6 mt-10">
                {[
                    { color: 'bg-emerald-500', label: 'Online (actividad < 2h)' },
                    { color: 'bg-amber-400',   label: 'Inactivo (< 24h)' },
                    { color: 'bg-gray-600',    label: 'Sin datos aún' },
                ].map(item => (
                    <div key={item.label} className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                        <span className="text-xs text-slate-500 font-medium">{item.label}</span>
                    </div>
                ))}
            </div>

            <p className="text-center text-xs text-slate-600 mt-3 font-medium">
                Última actualización: {lastRefresh.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
        </div>
    );
}

// ── Sub-component: FlowConnector ─────────────────────────────────────────────
function FlowConnector() {
    return (
        <div className="flex flex-col items-center gap-0.5 my-1">
            <div className="w-px h-4 bg-gradient-to-b from-slate-600 to-slate-700" />
            <div className="w-2 h-2 rotate-45 border-r-2 border-b-2 border-slate-600 -mt-1.5" />
        </div>
    );
}

// ── Sub-component: AgentNode ─────────────────────────────────────────────────
function AgentNode({ agent, stats, formatLastSeen, StatusIcon }: {
    agent: typeof AGENTS[0];
    stats: AgentStats | undefined;
    formatLastSeen: (d: Date | null) => string;
    StatusIcon: React.FC<{ status: 'online' | 'idle' | 'offline' }>;
}) {
    const c = COLOR_MAP[agent.color];
    const Icon = agent.icon;
    const status = stats?.status || 'offline';
    const isOnline = status === 'online';
    const isIdle = status === 'idle';

    return (
        <div className={`
            relative w-64 rounded-2xl border p-5 transition-all duration-500
            ${isOnline
                ? `bg-slate-900 border-slate-700 shadow-xl ${c.glow} shadow-lg`
                : 'bg-slate-900/60 border-slate-800'}
        `}>
            {/* Status glow ring when online */}
            {isOnline && (
                <div className={`absolute inset-0 rounded-2xl ${c.border} border opacity-40 animate-pulse pointer-events-none`} />
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className={`w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center shadow-lg`}>
                    <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex items-center gap-2">
                    <StatusIcon status={status} />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                        isOnline ? 'text-emerald-400' : isIdle ? 'text-amber-400' : 'text-slate-600'
                    }`}>
                        {isOnline ? 'Online' : isIdle ? 'Inactivo' : 'Sin datos'}
                    </span>
                </div>
            </div>

            {/* Name & role */}
            <div className="mb-4">
                <h3 className="text-base font-black text-white">{agent.name}</h3>
                <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${c.text}`}>{agent.role}</p>
                <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">{agent.description}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-800/60 rounded-xl px-3 py-2">
                    <div className="text-lg font-black text-white">{stats?.last24h ?? '—'}</div>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Hoy</div>
                </div>
                <div className="bg-slate-800/60 rounded-xl px-3 py-2">
                    <div className="text-lg font-black text-white">{stats?.total ?? '—'}</div>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Total</div>
                </div>
            </div>

            {/* Last seen */}
            <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-800">
                <Clock className="w-3 h-3 text-slate-600" />
                <span className="text-[10px] text-slate-500 font-medium">
                    {formatLastSeen(stats?.lastActivity || null)}
                </span>
            </div>
        </div>
    );
}
