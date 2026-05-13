import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Brain, Zap, Users, TrendingUp, AlertTriangle, CheckCircle2,
    Clock, ArrowLeft, RefreshCw, Play, Pause, ArrowRight,
    MessageSquare, Target, Star, Activity, ChevronRight, Bot, Settings2
} from 'lucide-react';
import { leadMemoryService, type CockpitMetrics, type LeadMemory } from '../../services/marketing/leadMemoryService';
import { useAuth } from '../../auth/AuthProvider';
import toast from 'react-hot-toast';

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    nuevo:        { label: 'Nuevo',        color: 'text-slate-600', bg: 'bg-slate-100' },
    calificado:   { label: 'Calificado',   color: 'text-blue-600',  bg: 'bg-blue-100' },
    cotizado:     { label: 'Cotizado',     color: 'text-violet-600',bg: 'bg-violet-100' },
    seguimiento:  { label: 'Seguimiento',  color: 'text-amber-600', bg: 'bg-amber-100' },
    negociacion:  { label: 'Negociación',  color: 'text-orange-600',bg: 'bg-orange-100' },
    cerrado:      { label: 'Cerrado ✓',    color: 'text-emerald-600',bg: 'bg-emerald-100' },
    perdido:      { label: 'Perdido',      color: 'text-red-600',   bg: 'bg-red-100' },
};

const ACTION_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
    calificar:         { label: 'Calificar',       icon: '🎯', color: 'text-blue-600' },
    enviar_propuesta:  { label: 'Enviar Propuesta', icon: '📋', color: 'text-violet-600' },
    seguimiento:       { label: 'Seguimiento',      icon: '⏰', color: 'text-amber-600' },
    demo:              { label: 'Agendar Demo',     icon: '📅', color: 'text-indigo-600' },
    escalar_humano:    { label: '⚠️ Escalar',       icon: '🚨', color: 'text-red-600' },
};

function SentimentBar({ score }: { score: number }) {
    const color = score >= 70 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-400' : 'bg-red-400';
    const label = score >= 70 ? 'Entusiasmado' : score >= 50 ? 'Neutral' : 'Dudoso';
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
            </div>
            <span className="text-[9px] font-bold text-slate-500 w-20">{label} {score}%</span>
        </div>
    );
}

function MetricCard({ title, value, subtitle, icon: Icon, color, bg }: any) {
    return (
        <div className={`p-5 rounded-2xl border ${bg} border-transparent relative overflow-hidden`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{title}</p>
                    <p className={`text-3xl font-black ${color}`}>{value}</p>
                    {subtitle && <p className="text-[11px] text-slate-500 mt-1 font-medium">{subtitle}</p>}
                </div>
                <div className={`w-10 h-10 rounded-xl ${color.replace('text-', 'bg-').replace('600', '100')} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                </div>
            </div>
        </div>
    );
}

export default function AiAgentCockpit() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const [metrics, setMetrics] = useState<CockpitMetrics | null>(null);
    const [memories, setMemories] = useState<(LeadMemory & { lead: any })[]>([]);
    const [escalations, setEscalations] = useState<(LeadMemory & { lead: any })[]>([]);
    const [activeTab, setActiveTab] = useState<'overview' | 'leads' | 'escalations'>('overview');
    const [stageFilter, setStageFilter] = useState('all');
    const [isRunning, setIsRunning] = useState(false);
    const [loading, setLoading] = useState(true);
    const [lastRun, setLastRun] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        if (!profile?.company_id) return;
        try {
            const [met, mems, escs] = await Promise.all([
                leadMemoryService.getCockpitMetrics(profile.company_id),
                leadMemoryService.getCompanyMemories(profile.company_id, { limit: 100 }),
                leadMemoryService.getEscalationQueue(profile.company_id),
            ]);
            setMetrics(met);
            setMemories(mems as any);
            setEscalations(escs as any);
        } catch (e: any) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [profile?.company_id]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleRunFollowups = async () => {
        if (!profile?.company_id) return;
        try {
            setIsRunning(true);
            toast.loading('Ejecutando seguimientos automáticos...', { id: 'followup-run' });
            const result = await leadMemoryService.triggerFollowupRun(profile.company_id);
            toast.success(
                `✅ ${result.followups_sent} seguimientos enviados · ${result.escalations} escalaciones`,
                { id: 'followup-run', duration: 5000 }
            );
            setLastRun(new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }));
            await loadData();
        } catch (e: any) {
            toast.error('Error: ' + e.message, { id: 'followup-run' });
        } finally {
            setIsRunning(false);
        }
    };

    const handleTogglePause = async (leadId: string, paused: boolean) => {
        try {
            await leadMemoryService.toggleFollowupPause(leadId, paused);
            toast.success(paused ? 'Seguimientos pausados' : 'Seguimientos reanudados');
            await loadData();
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    const handleResetFollowups = async (leadId: string, leadName: string) => {
        if (!confirm(`¿Reiniciar contador de seguimientos para ${leadName}?`)) return;
        try {
            await leadMemoryService.resetFollowups(leadId);
            toast.success('Contador reiniciado');
            await loadData();
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    const filteredMemories = memories.filter(m =>
        stageFilter === 'all' ? true : m.conversation_stage === stageFilter
    );

    if (loading) return (
        <div className="flex h-screen items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-4">
                <Brain className="w-10 h-10 text-blue-500 animate-pulse" />
                <p className="text-slate-400 font-medium text-sm">Cargando Cerebro del Agente...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-violet-50/20 p-6 font-sans">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <Link to="/marketing" className="p-2 hover:bg-white rounded-xl transition-colors text-slate-500 shadow-sm border border-slate-100">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                            <Brain className="w-7 h-7 text-blue-600" />
                            Cockpit del Agente AI
                        </h1>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                            Memoria de leads · Seguimientos autónomos · Inteligencia de ventas
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {lastRun && (
                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Último run: {lastRun}
                        </span>
                    )}
                    <Link
                        to="/marketing/followup-settings"
                        className="p-2.5 bg-white border border-slate-100 rounded-xl text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
                        title="Configurar seguimientos"
                    >
                        <Settings2 className="w-4 h-4" />
                    </Link>
                    <button
                        onClick={loadData}
                        className="p-2.5 bg-white border border-slate-100 rounded-xl text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
                        title="Refrescar"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleRunFollowups}
                        disabled={isRunning}
                        className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2 disabled:opacity-50"
                    >
                        {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        Ejecutar Seguimientos
                    </button>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <MetricCard title="Total Leads Rastreados" value={metrics?.total_leads_tracked || 0} icon={Users} color="text-blue-600" bg="bg-white" subtitle="con memoria activa" />
                <MetricCard title="En Seguimiento Auto" value={metrics?.en_seguimiento_auto || 0} icon={Activity} color="text-violet-600" bg="bg-white" subtitle="bot activo" />
                <MetricCard title="Sentiment Promedio" value={`${metrics?.avg_sentiment || 0}%`} icon={Star} color="text-amber-600" bg="bg-white" subtitle="engagement promedio" />
                <MetricCard
                    title="Pendientes Escalar"
                    value={metrics?.pendientes_escalar || 0}
                    icon={AlertTriangle}
                    color={metrics?.pendientes_escalar ? 'text-red-600' : 'text-emerald-600'}
                    bg={metrics?.pendientes_escalar ? 'bg-red-50' : 'bg-white'}
                    subtitle="requieren humano"
                />
            </div>

            {/* Pipeline Summary */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6">
                <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4">Pipeline del Bot</h2>
                <div className="flex gap-2 flex-wrap">
                    {Object.entries(STAGE_CONFIG).map(([key, cfg]) => {
                        const count = key === 'nuevo' ? metrics?.leads_nuevos
                            : key === 'calificado' ? metrics?.leads_calificados
                            : key === 'cotizado' ? metrics?.leads_cotizados
                            : key === 'seguimiento' ? metrics?.leads_en_seguimiento
                            : key === 'cerrado' ? metrics?.leads_cerrados
                            : key === 'perdido' ? metrics?.leads_perdidos : 0;
                        return (
                            <button
                                key={key}
                                onClick={() => { setStageFilter(key); setActiveTab('leads'); }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all hover:shadow-sm ${cfg.bg} border-transparent`}
                            >
                                <span className={`text-lg font-black ${cfg.color}`}>{count || 0}</span>
                                <span className={`text-[10px] font-bold ${cfg.color}`}>{cfg.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-6">
                {[
                    { id: 'overview', label: 'Resumen', icon: Target },
                    { id: 'leads', label: 'Leads con Memoria', icon: Brain },
                    { id: 'escalations', label: `Escalar (${escalations.length})`, icon: AlertTriangle },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-black transition-all ${activeTab === tab.id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <tab.icon className="w-3.5 h-3.5" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Escalations Tab */}
            {activeTab === 'escalations' && (
                <div className="space-y-3">
                    {escalations.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
                            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                            <p className="font-bold text-slate-700">¡Sin pendientes de escalación!</p>
                            <p className="text-sm text-slate-400 mt-1">El bot está manejando todos los leads correctamente.</p>
                        </div>
                    ) : escalations.map((mem: any) => (
                        <div key={mem.id} className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center gap-5">
                            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center text-red-600 font-black text-lg shrink-0">
                                {mem.lead?.name?.[0] || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-black text-slate-900">{mem.lead?.name || 'Desconocido'}</h3>
                                    <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-[9px] font-black">ESCALAR</span>
                                </div>
                                <p className="text-xs text-slate-500">{mem.lead?.company_name} · {mem.followup_count} seguimientos enviados</p>
                                {mem.last_objection && <p className="text-xs text-red-500 mt-1">Objeción: {mem.last_objection}</p>}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => navigate('/marketing/chat', { state: { lead: mem.lead } })}
                                    className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black hover:bg-blue-600 transition-all"
                                >
                                    Abrir Chat
                                </button>
                                <button
                                    onClick={() => handleResetFollowups(mem.lead_id, mem.lead?.name)}
                                    className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black hover:bg-slate-50 transition-all"
                                >
                                    Reiniciar Bot
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Leads Tab */}
            {activeTab === 'leads' && (
                <div>
                    <div className="flex gap-2 mb-4 flex-wrap">
                        <button onClick={() => setStageFilter('all')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${stageFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-100 text-slate-500'}`}>
                            Todos ({memories.length})
                        </button>
                        {Object.entries(STAGE_CONFIG).map(([key, cfg]) => (
                            <button key={key} onClick={() => setStageFilter(key)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${stageFilter === key ? `${cfg.bg} ${cfg.color}` : 'bg-white border border-slate-100 text-slate-500'}`}>
                                {cfg.label}
                            </button>
                        ))}
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        {filteredMemories.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">
                                <Brain className="w-8 h-8 mx-auto mb-3 opacity-30" />
                                <p className="font-medium">Sin leads con memoria en esta etapa</p>
                            </div>
                        ) : filteredMemories.map((mem: any, idx) => {
                            const stageCfg = STAGE_CONFIG[mem.conversation_stage] || STAGE_CONFIG.nuevo;
                            const actionCfg = ACTION_CONFIG[mem.next_action] || { label: mem.next_action, icon: '→', color: 'text-slate-600' };
                            return (
                                <div key={mem.id} className={`flex items-center gap-5 p-4 hover:bg-slate-50 transition-colors ${idx < filteredMemories.length - 1 ? 'border-b border-slate-50' : ''}`}>
                                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-600 shrink-0">
                                        {mem.lead?.name?.[0] || '?'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-black text-slate-900 text-sm truncate">{mem.lead?.name || 'Desconocido'}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${stageCfg.bg} ${stageCfg.color}`}>{stageCfg.label}</span>
                                        </div>
                                        <p className="text-xs text-slate-400 truncate">{mem.lead?.company_name || mem.lead?.phone || '—'}</p>
                                        <SentimentBar score={mem.sentiment_score || 50} />
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className={`text-[10px] font-black ${actionCfg.color} mb-1`}>{actionCfg.icon} {actionCfg.label}</p>
                                        {mem.last_objection && <p className="text-[9px] text-slate-400">Objeción: {mem.last_objection}</p>}
                                        <p className="text-[9px] text-slate-300">Flws: {mem.followup_count}</p>
                                    </div>
                                    <div className="flex gap-1.5 shrink-0">
                                        <button
                                            onClick={() => handleTogglePause(mem.lead_id, !mem.followup_paused)}
                                            className={`p-2 rounded-lg border transition-all text-xs ${mem.followup_paused ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-white border-slate-100 text-slate-400 hover:text-blue-600'}`}
                                            title={mem.followup_paused ? 'Reanudar seguimientos' : 'Pausar seguimientos'}
                                        >
                                            {mem.followup_paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                                        </button>
                                        <button
                                            onClick={() => navigate('/marketing/chat', { state: { lead: mem.lead } })}
                                            className="p-2 rounded-lg bg-white border border-slate-100 text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all"
                                            title="Abrir chat"
                                        >
                                            <MessageSquare className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Escalations widget */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                        <h3 className="font-black text-slate-900 flex items-center gap-2 mb-4">
                            <AlertTriangle className="w-4 h-4 text-red-500" /> Requieren Atención Humana
                        </h3>
                        {escalations.length === 0 ? (
                            <div className="text-center py-6">
                                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                                <p className="text-sm text-slate-500">Todo bajo control 🎉</p>
                            </div>
                        ) : escalations.slice(0, 5).map((mem: any) => (
                            <div key={mem.id} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
                                <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-black text-sm shrink-0">
                                    {mem.lead?.name?.[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-slate-800 truncate">{mem.lead?.name}</p>
                                    <p className="text-[10px] text-slate-400">{mem.followup_count} intentos sin respuesta</p>
                                </div>
                                <button onClick={() => navigate('/marketing/chat', { state: { lead: mem.lead } })} className="text-[10px] font-black text-blue-600 hover:underline flex items-center gap-1">
                                    Atender <ChevronRight className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Recent brain activity */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                        <h3 className="font-black text-slate-900 flex items-center gap-2 mb-4">
                            <Bot className="w-4 h-4 text-blue-500" /> Actividad Reciente del Bot
                        </h3>
                        {memories.slice(0, 6).map((mem: any) => {
                            const stageCfg = STAGE_CONFIG[mem.conversation_stage] || STAGE_CONFIG.nuevo;
                            return (
                                <div key={mem.id} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-black text-sm shrink-0">
                                        {mem.lead?.name?.[0] || '?'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-slate-800 truncate">{mem.lead?.name || 'Lead'}</p>
                                        <SentimentBar score={mem.sentiment_score || 50} />
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${stageCfg.bg} ${stageCfg.color}`}>
                                        {stageCfg.label}
                                    </span>
                                </div>
                            );
                        })}
                        <button onClick={() => setActiveTab('leads')} className="mt-3 w-full py-2 text-[10px] font-black text-blue-600 hover:bg-blue-50 rounded-xl transition-all flex items-center justify-center gap-1">
                            Ver todos los leads <ArrowRight className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
