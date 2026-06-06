import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Brain, Zap, Users, TrendingUp, AlertTriangle, CheckCircle2,
    Clock, ArrowLeft, RefreshCw, Play, Pause, ArrowRight,
    MessageSquare, Target, Star, Activity, ChevronRight, Bot, Settings2, Trash2,
    BarChart2, DollarSign, Percent, Award, PieChart, ShieldCheck
} from 'lucide-react';
import { leadMemoryService, type CockpitMetrics, type LeadMemory, type ConversionReport } from '../../services/marketing/leadMemoryService';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import PredictiveBoard from './PredictiveBoard';
import AuditLogViewer from './AuditLogViewer';
import AutonomyPulse from '../../components/marketing/AutonomyPulse';
import AutonomyToggle from '../../components/marketing/AutonomyToggle';
import AiTaskInbox from './AiTaskInbox';

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    nuevo:        { label: 'Nuevo',        color: 'text-slate-600', bg: 'bg-slate-100' },
    calificado:   { label: 'Calificado',   color: 'text-blue-600',  bg: 'bg-blue-100' },
    cotizado:     { label: 'Cotizado',     color: 'text-violet-600',bg: 'bg-violet-100' },
    seguimiento:  { label: 'Seguimiento',  color: 'text-amber-600', bg: 'bg-amber-100' },
    negociacion:  { label: 'Negociación',  color: 'text-orange-600',bg: 'bg-orange-100' },
    cerrado:      { label: 'Cerrado ✓',    color: 'text-emerald-600',bg: 'bg-emerald-100' },
    perdido:      { label: 'Perdido',      color: 'text-red-600',   bg: 'bg-red-100' },
};

const ACTION_CONFIG: Record<string, { label: string; icon: string; color: string; bg?: string }> = {
    calificar:         { label: 'Calificar',       icon: '🎯', color: 'text-blue-600' },
    enviar_propuesta:  { label: 'Enviar Propuesta', icon: '📋', color: 'text-violet-600' },
    seguimiento:       { label: 'Seguimiento',      icon: '⏰', color: 'text-amber-600' },
    demo:              { label: 'Agendar Demo',     icon: '📅', color: 'text-indigo-600' },
    escalar_humano:    { label: '⚠️ Escalar',       icon: '🚨', color: 'text-red-600' },
    cierre_inminente:  { label: '¡CIERRE INMINENTE!', icon: '💰', color: 'text-emerald-700', bg: 'bg-emerald-100 border border-emerald-300 shadow-sm animate-pulse' },
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

function MetricCard({ title, value, subtitle, icon: Icon, color, bg, tooltip }: any) {
    return (
        <div className={`p-5 rounded-2xl border ${bg} border-transparent relative overflow-hidden`}>
            <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</p>
                        {tooltip && (
                            <div className="relative group/tip">
                                <span className="w-3.5 h-3.5 rounded-full bg-slate-200 text-slate-500 text-[8px] font-black flex items-center justify-center cursor-help shrink-0">?</span>
                                <div className="absolute left-0 bottom-full mb-1.5 z-50 hidden group-hover/tip:block w-56 bg-slate-900 text-white text-[10px] font-medium rounded-xl p-3 shadow-xl leading-relaxed pointer-events-none">
                                    {tooltip}
                                    <div className="absolute top-full left-3 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900" />
                                </div>
                            </div>
                        )}
                    </div>
                    <p className={`text-3xl font-black ${color}`}>{value}</p>
                    {subtitle && <p className="text-[11px] text-slate-500 mt-1 font-medium">{subtitle}</p>}
                </div>
                <div className={`w-10 h-10 rounded-xl ${color.replace('text-', 'bg-').replace('600', '100')} flex items-center justify-center shrink-0`}>
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
    const [priceObjections, setPriceObjections] = useState<(LeadMemory & { lead: any })[]>([]);
    const [activeTab, setActiveTab] = useState<'overview' | 'leads' | 'escalations' | 'precios' | 'conversiones' | 'objeciones' | 'predicciones' | 'decision_log'>('overview');
    const [convReport, setConvReport] = useState<ConversionReport | null>(null);
    const [loadingReport, setLoadingReport] = useState(false);
    const [objAnalysis, setObjAnalysis] = useState<{ tipo: string; count: number; cerrados: number; color: string; emoji: string }[]>([]);
    const [stageFilter, setStageFilter] = useState('all');
    const [discounts, setDiscounts] = useState<Record<string, number>>({});
    const [sendingOffer, setSendingOffer] = useState<string | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [loading, setLoading] = useState(true);
    const [lastRun, setLastRun] = useState<string | null>(null);
    const [execLog, setExecLog] = useState<{ logs: string[]; result: any } | null>(null);

    const loadData = useCallback(async () => {
        if (!profile?.company_id) return;
        try {
            const [met, mems, escs, priceObjs] = await Promise.all([
                leadMemoryService.getCockpitMetrics(profile.company_id),
                leadMemoryService.getCompanyMemories(profile.company_id, { limit: 100 }),
                leadMemoryService.getEscalationQueue(profile.company_id),
                leadMemoryService.getPriceObjections(profile.company_id),
            ]);
            setMetrics(met);
            setMemories(mems as any);
            setEscalations(escs as any);
            setPriceObjections(priceObjs as any);
        } catch (e: any) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [profile?.company_id]);

    const loadConversionReport = useCallback(async () => {
        if (!profile?.company_id) return;
        setLoadingReport(true);
        try {
            const report = await leadMemoryService.getConversionReport(profile.company_id);
            setConvReport(report);
        } catch (e: any) {
            console.error(e);
        } finally {
            setLoadingReport(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile?.company_id]);

    // Build objection analysis from priceObjections + all memories
    useEffect(() => {
        if (!memories.length) return;
        const CATEGORIES = [
            { tipo: 'Precio / Costo',        keywords: ['caro', 'precio', 'expensive', 'costoso', 'barato', 'descuento'], color: 'bg-red-400',    emoji: '💸' },
            { tipo: 'Necesita aprobación',   keywords: ['jefe', 'aprobación', 'directivo', 'permiso', 'gerente', 'socio'], color: 'bg-amber-400', emoji: '👔' },
            { tipo: 'No es prioridad',       keywords: ['después', 'luego', 'no es el momento', 'ocupado', 'busy'],        color: 'bg-blue-400',  emoji: '📅' },
            { tipo: 'Ya tiene solución',     keywords: ['ya tengo', 'ya uso', 'contrato', 'proveedor'],                    color: 'bg-violet-400', emoji: '🔄' },
            { tipo: 'Sin respuesta',         keywords: [],  color: 'bg-slate-400', emoji: '🔇' },
        ];
        const results = CATEGORIES.map(cat => {
            const matched = cat.keywords.length === 0
                ? memories.filter(m => !m.last_objection && (m.followup_count || 0) >= 2)
                : memories.filter(m => {
                    const obj = (m.last_objection || '').toLowerCase();
                    return cat.keywords.some(k => obj.includes(k));
                });
            const cerrados = matched.filter(m => m.conversation_stage === 'cerrado' || (m as any).lead?.status === 'Cliente').length;
            return { tipo: cat.tipo, count: matched.length, cerrados, color: cat.color, emoji: cat.emoji };
        }).filter(r => r.count > 0);
        setObjAnalysis(results);
    }, [memories]);

    useEffect(() => { loadData(); }, [loadData]);
    useEffect(() => { if (activeTab === 'conversiones' && !convReport) loadConversionReport(); }, [activeTab, convReport, loadConversionReport]);

    const handleRunFollowups = async () => {
        if (!profile?.company_id) return;
        try {
            setIsRunning(true);
            toast.loading('🤖 Orquestador ejecutando: Oracle → Atlas → Maya...', { id: 'followup-run' });

            const { data: resultData, error: invokeError } = await supabase.functions.invoke('agent-orchestrator', {
                body: { company_id: profile.company_id }
            });

            if (invokeError) {
                throw new Error(`Orchestrator error: ${invokeError.message || invokeError}`);
            }

            const result = resultData as {
                success: boolean; message: string;
                leads_evaluated?: number; leads_selected?: number;
                tasks_created?: number; tasks_auto_executed?: number;
                tasks_pending_approval?: number; messages_sent?: number;
                autonomy_level?: string; logs?: string[]; skipped?: boolean;
            };

            const logs = result.logs || [];
            if (logs.length === 0) {
                logs.push(`✅ Ejecución completada`);
                if (result.leads_evaluated !== undefined) logs.push(`📊 ${result.leads_evaluated} leads evaluados`);
                if (result.tasks_created !== undefined) logs.push(`📋 ${result.tasks_created} tareas creadas`);
                if (result.messages_sent !== undefined) logs.push(`🚀 ${result.messages_sent} mensajes enviados`);
                if (result.skipped) logs.push(`⏭️  Cola llena — no se crearon tareas nuevas`);
            }

            setExecLog({ logs, result });

            toast.success(
                result.message || `✅ ${result.tasks_created ?? 0} tareas · ${result.messages_sent ?? 0} mensajes enviados`,
                { id: 'followup-run', duration: 4000 }
            );
            setLastRun(new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }));
            await loadData();
        } catch (e: any) {
            console.error('Orchestrator error:', e);
            const errLogs = [
                `❌ Error al llamar al Orchestrator: ${e.message}`,
                `⚠️  Intentando fallback con auto-followup...`,
            ];
            try {
                toast.loading('Ejecutando fallback...', { id: 'followup-run' });
                const result = await leadMemoryService.triggerFollowupRun(profile.company_id);
                errLogs.push(`✅ Fallback OK: ${result.followups_sent} seguimientos · ${result.escalations} escalaciones`);
                setExecLog({ logs: errLogs, result: { followups_sent: result.followups_sent, escalations: result.escalations } });
                toast.success(`✅ Fallback ejecutado`, { id: 'followup-run', duration: 5000 });
            } catch (fallbackErr: any) {
                errLogs.push(`❌ Fallback también falló: ${fallbackErr.message}`);
                setExecLog({ logs: errLogs, result: {} });
                toast.error('Error: ' + e.message, { id: 'followup-run' });
            }
            setLastRun(new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }));
            await loadData();
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

    const handleResetMemory = async (leadId: string, leadName: string) => {
        if (!confirm(`⚠️ ¿Borrar TODA la memoria de Sofía sobre ${leadName}?\n\nEsto elimina el historial de conversación, etapa, objeciones y seguimientos. Sofía tratará a este lead como nuevo.`)) return;
        try {
            await leadMemoryService.resetMemory(leadId);
            toast.success('🧠 Memoria borrada — Sofía empezará desde cero');
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

            {/* FASE 3: AI Task Queue & Autonomy Control */}
            {profile?.company_id && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    <div className="lg:col-span-2">
                        <AiTaskInbox companyId={profile.company_id} />
                    </div>
                    <div className="lg:col-span-1 space-y-6">
                        <AutonomyPulse companyId={profile.company_id} />
                        <AutonomyToggle companyId={profile.company_id} />
                    </div>
                </div>
            )}

            {/* 🔥 Hot Leads Banner (Cierre Inminente) */}
            {(() => {
                const hotLeads = memories.filter(m => m.next_action === 'cierre_inminente');
                if (hotLeads.length === 0) return null;
                return (
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-5 mb-8 text-white shadow-xl shadow-emerald-500/20 flex flex-col md:flex-row items-center justify-between gap-4 border border-emerald-400">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl animate-bounce shrink-0">
                                💰
                            </div>
                            <div>
                                <h3 className="text-xl font-black flex items-center gap-2 text-white">¡Atención! {hotLeads.length} Lead{hotLeads.length > 1 ? 's' : ''} listo{hotLeads.length > 1 ? 's' : ''} para pagar</h3>
                                <p className="text-sm text-emerald-50 font-medium mt-0.5">El bot ha detectado intención de compra confirmada. El equipo humano debe contactarlos de inmediato para enviar el link de pago o cerrar el proceso.</p>
                            </div>
                        </div>
                        <button onClick={() => { setActiveTab('leads'); setStageFilter('negociacion'); }} className="px-5 py-2.5 bg-white text-emerald-700 rounded-xl text-xs font-black shadow-md hover:bg-emerald-50 transition-all shrink-0">
                            Ver Leads Calientes
                        </button>
                    </div>
                );
            })()}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <MetricCard
                    title="Total Leads Rastreados" value={metrics?.total_leads_tracked || 0}
                    icon={Users} color="text-blue-600" bg="bg-white" subtitle="con memoria activa"
                    tooltip="Leads que el bot conoce activamente: nombre, empresa, volumen de DTEs, si ya cotizaron y más. El bot los recuerda en cada conversación."
                />
                <MetricCard
                    title="En Seguimiento Auto" value={metrics?.en_seguimiento_auto || 0}
                    icon={Activity} color="text-violet-600" bg="bg-white" subtitle="bot activo"
                    tooltip="Leads donde Sofía está enviando mensajes automáticos de seguimiento porque llevan más de 24h sin responder. Si es 55, el bot está persiguiendo 55 prospectos mientras tú duermes."
                />
                <MetricCard
                    title="Sentiment Promedio" value={`${metrics?.avg_sentiment || 0}%`}
                    icon={Star} color="text-amber-600" bg="bg-white" subtitle="engagement promedio"
                    tooltip="Estado de ánimo promedio de todos los leads. 70%+ = entusiasmados (listos para cerrar). 40-69% = neutrales. Menos del 40% = fríos o con objeciones de precio."
                />
                <MetricCard
                    title="Pendientes Escalar"
                    value={metrics?.pendientes_escalar || 0}
                    icon={AlertTriangle}
                    color={metrics?.pendientes_escalar ? 'text-red-600' : 'text-emerald-600'}
                    bg={metrics?.pendientes_escalar ? 'bg-red-50' : 'bg-white'}
                    subtitle="requieren humano"
                    tooltip="Leads que el bot ya no puede atender solo: agotó sus 3 intentos sin respuesta o detectó que el lead pide atención humana. Revisa la pestaña 'Escalar' para contactarlos."
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
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-6 flex-wrap">
                {[
                    { id: 'overview',      label: 'Resumen',                                                                  icon: Target },
                    { id: 'predicciones',  label: 'Oracle AI',                                                                icon: Zap },
                    { id: 'decision_log',  label: 'Decision Log',                                                             icon: ShieldCheck },
                    { id: 'leads',         label: `Leads con Memoria (${memories.length})`,                                   icon: Brain },
                    { id: 'conversiones',  label: `Conversiones${convReport ? ` (${convReport.total_closed})` : ''}`,         icon: BarChart2 },
                    { id: 'objeciones',    label: `Objeciones${objAnalysis.length ? ` (${objAnalysis.reduce((s,r)=>s+r.count,0)})` : ''}`, icon: PieChart },
                    { id: 'escalations',   label: `Escalar (${escalations.length})`,                                          icon: AlertTriangle },
                    { id: 'precios',       label: `Ofertas (${priceObjections.length})`,                                      icon: TrendingUp },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-black transition-all ${
                            activeTab === tab.id
                                ? tab.id === 'precios'      ? 'bg-orange-500 shadow-sm text-white'
                                : tab.id === 'escalations'  ? 'bg-red-500 shadow-sm text-white'
                                : tab.id === 'conversiones' ? 'bg-emerald-600 shadow-sm text-white'
                                : tab.id === 'objeciones'   ? 'bg-indigo-600 shadow-sm text-white'
                                : tab.id === 'predicciones' ? 'bg-teal-600 shadow-sm text-white'
                                : tab.id === 'decision_log' ? 'bg-slate-900 shadow-sm text-white'
                                : 'bg-white shadow-sm text-slate-900'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <tab.icon className="w-3.5 h-3.5" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Predicciones Tab */}
            {activeTab === 'predicciones' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <PredictiveBoard isEmbedded />
                </div>
            )}

            {/* Decision Log Tab */}
            {activeTab === 'decision_log' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <AuditLogViewer />
                </div>
            )}

            {/* Objeciones Tab */}
            {activeTab === 'objeciones' && (
                <div className="space-y-6">
                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3">
                        <PieChart className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-black text-indigo-800 text-sm">Análisis de Objeciones</p>
                            <p className="text-[12px] text-indigo-600 mt-1">Agrupación automática. Muestra cuántos leads de cada tipo finalmente cerraron.</p>
                        </div>
                    </div>
                    {objAnalysis.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
                            <PieChart className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                            <p className="font-bold text-slate-500">Sin datos de objeciones aún</p>
                            <p className="text-sm text-slate-400 mt-1">Aparecerá cuando Sofía detecte objeciones en conversaciones.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center">
                                    <p className="text-3xl font-black text-slate-900">{objAnalysis.reduce((s, r) => s + r.count, 0)}</p>
                                    <p className="text-[10px] text-slate-400 font-black uppercase mt-1">Total con objeción</p>
                                </div>
                                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center">
                                    <p className="text-3xl font-black text-emerald-600">{objAnalysis.reduce((s, r) => s + r.cerrados, 0)}</p>
                                    <p className="text-[10px] text-slate-400 font-black uppercase mt-1">Cerraron igual</p>
                                </div>
                                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center">
                                    <p className="text-3xl font-black text-violet-600">
                                        {(() => { const t = objAnalysis.reduce((s,r)=>s+r.count,0); const c = objAnalysis.reduce((s,r)=>s+r.cerrados,0); return t>0?Math.round((c/t)*100):0; })()}%
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-black uppercase mt-1">Tasa cierre global</p>
                                </div>
                                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-center">
                                    <p className="text-2xl font-black text-red-500">{[...objAnalysis].sort((a,b)=>b.count-a.count)[0]?.emoji}</p>
                                    <p className="text-[10px] text-slate-400 font-black uppercase mt-1">Tipo más frecuente</p>
                                </div>
                            </div>
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-50">
                                    <h3 className="font-black text-slate-900 flex items-center gap-2 text-sm">
                                        <PieChart className="w-4 h-4 text-indigo-500" /> Desglose por Categoría
                                    </h3>
                                </div>
                                <div className="p-5 space-y-5">
                                    {[...objAnalysis].sort((a,b)=>b.count-a.count).map((row) => {
                                        const rate = row.count > 0 ? Math.round((row.cerrados / row.count) * 100) : 0;
                                        const maxCount = Math.max(...objAnalysis.map(r => r.count), 1);
                                        return (
                                            <div key={row.tipo}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg">{row.emoji}</span>
                                                        <span className="text-sm font-bold text-slate-800">{row.tipo}</span>
                                                        <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{row.count} leads</span>
                                                    </div>
                                                    <span className={`text-[11px] font-black ${rate>=30?'text-emerald-600':rate>=15?'text-amber-600':'text-red-500'}`}>
                                                        {row.cerrados} cerraron · {rate}%
                                                    </span>
                                                </div>
                                                <div className="h-3 bg-slate-100 rounded-full overflow-hidden relative">
                                                    <div className={`absolute inset-y-0 left-0 ${row.color} opacity-20 rounded-full`}
                                                        style={{ width: `${Math.min((row.count/maxCount)*100,100)}%` }} />
                                                    <div className={`absolute inset-y-0 left-0 ${row.color} rounded-full transition-all`}
                                                        style={{ width: `${Math.min(rate,100)}%` }} />
                                                </div>
                                                <p className="text-[9px] text-slate-300 mt-0.5 text-center">tasa de cierre a pesar de objeción</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            {(() => {
                                const best  = [...objAnalysis].sort((a,b)=>(b.count>0?b.cerrados/b.count:0)-(a.count>0?a.cerrados/a.count:0))[0];
                                const worst = [...objAnalysis].filter(r=>r.count>=2).sort((a,b)=>(a.count>0?a.cerrados/a.count:0)-(b.count>0?b.cerrados/b.count:0))[0];
                                return (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                        {best && <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">💡 Mejor conversión</p>
                                            <p className="font-bold text-emerald-800">{best.emoji} {best.tipo}</p>
                                            <p className="text-[11px] text-emerald-600 mt-1">{best.cerrados}/{best.count} cerraron ({best.count>0?Math.round((best.cerrados/best.count)*100):0}%). Sigue esta estrategia.</p>
                                        </div>}
                                        {worst && worst.tipo !== best?.tipo && <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
                                            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">⚠️ Más difícil</p>
                                            <p className="font-bold text-red-800">{worst.emoji} {worst.tipo}</p>
                                            <p className="text-[11px] text-red-600 mt-1">Solo {worst.cerrados}/{worst.count} cierran ({worst.count>0?Math.round((worst.cerrados/worst.count)*100):0}%). Necesita estrategia específica.</p>
                                        </div>}
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>
            )}

            {/* Conversiones Tab */}
            {activeTab === 'conversiones' && (
                <div className="space-y-6">
                    {/* KPI cards */}
                    {loadingReport ? (
                        <div className="flex items-center justify-center py-16">
                            <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin" />
                            <span className="ml-3 text-slate-400 font-medium text-sm">Calculando conversiones...</span>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Leads Atendidos</p>
                                        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                                            <Users className="w-4 h-4 text-blue-600" />
                                        </div>
                                    </div>
                                    <p className="text-3xl font-black text-blue-600">{convReport?.total_attended ?? '—'}</p>
                                    <p className="text-[11px] text-slate-400 mt-1">por Sofía</p>
                                </div>
                                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Clientes Cerrados</p>
                                        <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                                            <Award className="w-4 h-4 text-emerald-600" />
                                        </div>
                                    </div>
                                    <p className="text-3xl font-black text-emerald-600">{convReport?.total_closed ?? '—'}</p>
                                    <p className="text-[11px] text-slate-400 mt-1">leads convertidos</p>
                                </div>
                                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tasa de Conversión</p>
                                        <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
                                            <Percent className="w-4 h-4 text-violet-600" />
                                        </div>
                                    </div>
                                    <p className="text-3xl font-black text-violet-600">{convReport?.conversion_rate ?? '—'}%</p>
                                    <p className="text-[11px] text-slate-400 mt-1">de atendidos → clientes</p>
                                </div>
                                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Seguimientos Promedio</p>
                                        <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                                            <DollarSign className="w-4 h-4 text-amber-600" />
                                        </div>
                                    </div>
                                    <p className="text-3xl font-black text-amber-600">{convReport?.avg_followups_to_close ?? '—'}</p>
                                    <p className="text-[11px] text-slate-400 mt-1">msgs hasta el cierre</p>
                                </div>
                            </div>

                            {/* ROI banner */}
                            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-5 text-white flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-widest opacity-70">ROI del Sistema</p>
                                    <p className="text-2xl font-black mt-1">Costo APIs: $0/mes</p>
                                    <p className="text-[12px] opacity-80 mt-0.5">
                                        Sofía trabaja 24/7 sin costo por mensaje · {convReport?.total_closed ?? 0} cierres asistidos
                                    </p>
                                </div>
                                <CheckCircle2 className="w-12 h-12 opacity-30" />
                            </div>

                            {/* Closed leads table */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                                    <h3 className="font-black text-slate-900 flex items-center gap-2">
                                        <BarChart2 className="w-4 h-4 text-emerald-600" />
                                        Detalle de Conversiones
                                    </h3>
                                    <button
                                        onClick={loadConversionReport}
                                        className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-400 hover:text-emerald-600"
                                        title="Refrescar"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                    </button>
                                </div>
                                {!convReport?.rows?.length ? (
                                    <div className="p-12 text-center">
                                        <BarChart2 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                        <p className="font-bold text-slate-500">Aún no hay cierres registrados</p>
                                        <p className="text-sm text-slate-400 mt-1">Cuando un lead cambie a estado "Cliente" aparecerá aquí.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-slate-50">
                                                    <th className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Lead</th>
                                                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Canal</th>
                                                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Agente</th>
                                                    <th className="text-center px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Seguimientos</th>
                                                    <th className="text-center px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Sentiment</th>
                                                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha Cierre</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {convReport.rows.map((row, idx) => (
                                                    <tr key={row.lead_id} className={`border-t border-slate-50 hover:bg-slate-50/60 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                                                        <td className="px-5 py-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-sm shrink-0">
                                                                    {row.lead_name?.[0] || '?'}
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-slate-900 text-[13px]">{row.lead_name}</p>
                                                                    {row.company_name && <p className="text-[10px] text-slate-400">{row.company_name}</p>}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase ${
                                                                row.channel === 'whatsapp' ? 'bg-green-100 text-green-700'
                                                                : row.channel === 'telegram' ? 'bg-blue-100 text-blue-700'
                                                                : 'bg-slate-100 text-slate-500'
                                                            }`}>
                                                                {row.channel || '—'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-[12px] text-slate-600 font-medium">{row.assigned_agent || '—'}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className="text-[11px] font-black text-violet-600">{row.followup_count}</span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[40px]">
                                                                    <div
                                                                        className={`h-full rounded-full ${
                                                                            row.sentiment_at_close >= 70 ? 'bg-emerald-500'
                                                                            : row.sentiment_at_close >= 50 ? 'bg-amber-400'
                                                                            : 'bg-red-400'
                                                                        }`}
                                                                        style={{ width: `${row.sentiment_at_close}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-[10px] font-bold text-slate-400">{row.sentiment_at_close}%</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-[11px] text-slate-400">
                                                            {row.closed_at ? new Date(row.closed_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

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
                                        <div className={`inline-flex items-center gap-1 text-[10px] font-black ${actionCfg.color} mb-1 ${actionCfg.bg ? actionCfg.bg + ' px-2.5 py-1 rounded-full' : ''}`}>
                                            <span>{actionCfg.icon}</span> <span>{actionCfg.label}</span>
                                        </div>
                                        {mem.last_objection && <p className="text-[9px] text-slate-400">Objeción: {mem.last_objection}</p>}
                                        <p className="text-[9px] text-slate-300 mt-0.5">Flws: {mem.followup_count}</p>
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
                                        <button
                                            onClick={() => handleResetMemory(mem.lead_id, mem.lead?.name)}
                                            className="p-2 rounded-lg bg-white border border-slate-100 text-slate-400 hover:text-red-500 hover:border-red-200 transition-all"
                                            title="Borrar memoria — Sofía empezará desde cero con este lead"
                                        >
                                            <Trash2 className="w-3 h-3" />
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

            {/* ── Objeciones de Precio Tab ─────────────────────────── */}
            {activeTab === 'precios' && (
                <div className="space-y-4">
                    {/* Header explainer */}
                    <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex items-start gap-3">
                        <TrendingUp className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-black text-orange-800 text-sm">Control de Objeciones por Precio</p>
                            <p className="text-[12px] text-orange-600 mt-1">
                                Leads que dijeron "está caro" o similar. Define un descuento y envía una oferta especial directamente a su Telegram.
                                El lead recibirá el precio con descuento y una ventana de 48h para decidir.
                            </p>
                        </div>
                    </div>

                    {priceObjections.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
                            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                            <p className="font-bold text-slate-700">¡Sin objeciones de precio activas!</p>
                            <p className="text-sm text-slate-400 mt-1">Cuando un lead diga "está caro" aparecerá aquí.</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            {priceObjections.map((mem: any, idx) => {
                                const discount = discounts[mem.lead_id] ?? 10;
                                const originalPrice = parseFloat(mem.known_facts?.last_quoted_price || '89');
                                const finalPrice = (originalPrice * (1 - discount / 100)).toFixed(2);
                                const plan = mem.known_facts?.last_quoted_plan || 'Plan';
                                const objectionText = mem.known_facts?.price_objection_text || mem.last_objection;
                                const objectionDate = mem.known_facts?.price_objection_at
                                    ? new Date(mem.known_facts.price_objection_at).toLocaleDateString('es')
                                    : '—';

                                return (
                                    <div key={mem.id} className={`p-5 ${idx < priceObjections.length - 1 ? 'border-b border-slate-100' : ''}`}>
                                        <div className="flex items-start gap-4">
                                            {/* Avatar */}
                                            <div className="w-11 h-11 rounded-xl bg-orange-100 flex items-center justify-center font-black text-orange-600 shrink-0 text-lg">
                                                {mem.lead?.name?.[0] || '?'}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                {/* Name + date */}
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-black text-slate-900 text-sm">{mem.lead?.name || 'Lead'}</span>
                                                    <span className="text-[10px] text-slate-400">{mem.lead?.company_name}</span>
                                                    <span className="ml-auto text-[10px] text-slate-300">{objectionDate}</span>
                                                </div>

                                                {/* What they said */}
                                                {objectionText && (
                                                    <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 mb-3">
                                                        <p className="text-[11px] text-slate-500 italic">"{objectionText}"</p>
                                                    </div>
                                                )}

                                                {/* Price control */}
                                                <div className="flex items-center gap-4 flex-wrap">
                                                    <div className="flex-1 min-w-[200px]">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide">Descuento a ofrecer</label>
                                                            <span className="text-[11px] font-black text-orange-600">{discount}%</span>
                                                        </div>
                                                        <input
                                                            type="range" min={5} max={40} step={5}
                                                            value={discount}
                                                            onChange={e => setDiscounts(d => ({ ...d, [mem.lead_id]: Number(e.target.value) }))}
                                                            className="w-full accent-orange-500"
                                                        />
                                                        <div className="flex justify-between text-[9px] text-slate-300 mt-0.5">
                                                            <span>5%</span><span>40%</span>
                                                        </div>
                                                    </div>

                                                    {/* Price preview */}
                                                    <div className="text-right shrink-0">
                                                        <p className="text-[10px] text-slate-400 line-through">${originalPrice}/mes</p>
                                                        <p className="text-lg font-black text-emerald-600">${finalPrice}/mes</p>
                                                        <p className="text-[9px] text-slate-400">{plan}</p>
                                                    </div>

                                                    {/* Send button */}
                                                    <button
                                                        disabled={sendingOffer === mem.lead_id}
                                                        onClick={async () => {
                                                            setSendingOffer(mem.lead_id);
                                                            try {
                                                                await leadMemoryService.sendPriceOffer(
                                                                    mem.lead_id, profile!.company_id,
                                                                    discount, originalPrice, plan
                                                                );
                                                                toast.success(`✅ Oferta de ${discount}% enviada a ${mem.lead?.name}`);
                                                            } catch(e: any) {
                                                                toast.error(e.message);
                                                            } finally {
                                                                setSendingOffer(null);
                                                            }
                                                        }}
                                                        className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[10px] font-black transition-all shadow-md shadow-orange-200 flex items-center gap-2 disabled:opacity-50 shrink-0"
                                                    >
                                                        {sendingOffer === mem.lead_id
                                                            ? <RefreshCw className="w-3 h-3 animate-spin" />
                                                            : <Zap className="w-3 h-3" />
                                                        }
                                                        Enviar Oferta
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── EXECUTION LOG MODAL ─────────────────────────────────────────── */}
            {execLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
                            <div>
                                <h2 className="text-base font-black text-white flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-emerald-400" />
                                    Log de Ejecución — Orquestador IA
                                </h2>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Modo: <span className="font-bold text-indigo-400 uppercase">{execLog.result?.autonomy_level || 'copilot'}</span>
                                    {execLog.result?.leads_evaluated !== undefined && ` · ${execLog.result.leads_evaluated} leads evaluados`}
                                    {execLog.result?.tasks_created !== undefined && ` · ${execLog.result.tasks_created} tareas creadas`}
                                    {execLog.result?.messages_sent !== undefined && ` · ${execLog.result.messages_sent} mensajes enviados`}
                                </p>
                            </div>
                            <button
                                onClick={() => setExecLog(null)}
                                className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-white"
                            >
                                <span className="text-lg font-bold">✕</span>
                            </button>
                        </div>

                        {/* Stats bar */}
                        <div className="grid grid-cols-3 divide-x divide-slate-800 border-b border-slate-800">
                            <div className="px-5 py-3 text-center">
                                <div className="text-xl font-black text-white">{execLog.result?.leads_evaluated ?? '—'}</div>
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Evaluados</div>
                            </div>
                            <div className="px-5 py-3 text-center">
                                <div className="text-xl font-black text-indigo-400">{execLog.result?.tasks_created ?? '—'}</div>
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tareas</div>
                            </div>
                            <div className="px-5 py-3 text-center">
                                <div className="text-xl font-black text-emerald-400">{execLog.result?.messages_sent ?? '—'}</div>
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Enviados</div>
                            </div>
                        </div>

                        {/* Log terminal */}
                        <div className="flex-1 overflow-y-auto p-5 font-mono text-xs space-y-1.5 bg-slate-950/50">
                            {execLog.logs.length === 0 ? (
                                <div className="text-slate-500 text-center py-8">
                                    <CheckCircle2 className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                                    No hay logs detallados disponibles. El orquestador corrió sin errores.
                                </div>
                            ) : (
                                execLog.logs.map((line, i) => {
                                    const isSuccess = line.includes('✅') || line.includes('Message delivered') || line.includes('sent');
                                    const isError = line.includes('❌') || line.includes('error') || line.includes('Error');
                                    const isWarn = line.includes('⚠️') || line.includes('Skipping') || line.includes('not delivered');
                                    const isInfo = line.includes('📊') || line.includes('🔗') || line.includes('🚀') || line.includes('📋');
                                    return (
                                        <div key={i} className={`flex items-start gap-2 py-0.5 ${
                                            isError ? 'text-red-400' :
                                            isSuccess ? 'text-emerald-400' :
                                            isWarn ? 'text-amber-400' :
                                            isInfo ? 'text-indigo-400' :
                                            'text-slate-400'
                                        }`}>
                                            <span className="text-slate-600 tabular-nums shrink-0 mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                                            <span className="break-all leading-relaxed">{line.replace(/\[\d{4}-\d{2}-\d{2}T[\d:.Z]+\]\s*/, '')}</span>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-slate-800 flex justify-between items-center">
                            <span className="text-xs text-slate-500">
                                {execLog.logs.length} líneas de log · {new Date().toLocaleTimeString('es')}
                            </span>
                            <button
                                onClick={() => setExecLog(null)}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


