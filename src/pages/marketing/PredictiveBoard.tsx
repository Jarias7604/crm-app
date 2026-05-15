import { useState, useEffect, useCallback } from 'react';
import {
    Target, TrendingUp, TrendingDown, Minus, RefreshCw,
    AlertTriangle, Zap, Users, BarChart2, ChevronRight,
    ArrowUpRight, ArrowDownRight, Clock, Phone, Mail
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import {
    predictiveScoringService,
    PREDICTED_ACTION_CONFIG,
    type PredictionResult
} from '../../services/marketing/predictiveScoring';
import toast from 'react-hot-toast';

// ─── Trend Icon ─────────────────────────────────────────────────────────────
function TrendBadge({ trend }: { trend: PredictionResult['trend'] }) {
    const cfg = {
        improving: { icon: <TrendingUp className="w-3 h-3" />, label: 'Mejorando', c: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
        stable:    { icon: <Minus className="w-3 h-3" />,      label: 'Estable',   c: 'text-gray-500 bg-gray-50 border-gray-200' },
        declining: { icon: <TrendingDown className="w-3 h-3" />, label: 'Bajando', c: 'text-red-600 bg-red-50 border-red-200' },
    }[trend];
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${cfg.c}`}>
            {cfg.icon}{cfg.label}
        </span>
    );
}

// ─── Score Ring ──────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
    const radius = (size - 6) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size/2} cy={size/2} r={radius} stroke="#f3f4f6" strokeWidth="4" fill="none" />
                <circle cx={size/2} cy={size/2} r={radius} stroke={color} strokeWidth="4" fill="none"
                    strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
                    className="transition-all duration-700"
                />
            </svg>
            <span className="absolute text-sm font-black" style={{ color }}>{score}%</span>
        </div>
    );
}

// ─── Factor Bar ─────────────────────────────────────────────────────────────
function FactorBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
    const pct = Math.round((value / max) * 100);
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
                <span className="font-bold text-gray-500 uppercase tracking-wider">{label}</span>
                <span className="font-black text-gray-700">{value}/{max}</span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

// ─── Lead Card ──────────────────────────────────────────────────────────────
function LeadPredictionCard({ prediction, expanded, onToggle }: {
    prediction: PredictionResult;
    expanded: boolean;
    onToggle: () => void;
}) {
    const actionCfg = PREDICTED_ACTION_CONFIG[prediction.predictedAction];

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            <button onClick={onToggle} className="w-full text-left p-4 flex items-center gap-4">
                <ScoreRing score={prediction.closeProb} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-black text-gray-900 truncate">{prediction.leadName}</h4>
                        <TrendBadge trend={prediction.trend} />
                    </div>
                    <p className="text-xs text-gray-500 truncate">{prediction.companyName || 'Sin empresa'} · {prediction.status}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black border ${actionCfg.bgColor} ${actionCfg.color}`}>
                            {actionCfg.icon} {actionCfg.label}
                        </span>
                        {prediction.predictedCloseDate && (
                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Cierre est.: {new Date(prediction.predictedCloseDate + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                            </span>
                        )}
                    </div>
                </div>
                <ChevronRight className={`w-4 h-4 text-gray-300 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>

            {expanded && (
                <div className="px-4 pb-4 border-t border-gray-50 pt-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Desglose de Score</p>
                            <div className="space-y-2">
                                <FactorBar label="Engagement" value={prediction.factors.engagement} max={25} color="bg-blue-500" />
                                <FactorBar label="Momentum" value={prediction.factors.momentum} max={25} color="bg-violet-500" />
                                <FactorBar label="Calidad Datos" value={prediction.factors.dataQuality} max={15} color="bg-cyan-500" />
                                <FactorBar label="Interacción" value={prediction.factors.interactionQuality} max={20} color="bg-emerald-500" />
                                <FactorBar label="Behavioral" value={prediction.factors.behavioral} max={10} color="bg-amber-500" />
                                <FactorBar label="Temporal" value={prediction.factors.temporal} max={5} color="bg-pink-500" />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="bg-gray-50 rounded-xl p-3">
                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Sentiment</p>
                                <div className="flex items-center gap-2">
                                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${prediction.sentimentScore >= 60 ? 'bg-emerald-500' : prediction.sentimentScore >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                                            style={{ width: `${prediction.sentimentScore}%` }} />
                                    </div>
                                    <span className="text-xs font-black text-gray-700">{prediction.sentimentScore}</span>
                                </div>
                            </div>
                            {prediction.lastObjection && (
                                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-rose-400 mb-1">Última Objeción</p>
                                    <p className="text-xs font-bold text-rose-700 capitalize">{prediction.lastObjection}</p>
                                </div>
                            )}
                            <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
                                <p className="text-[9px] font-black uppercase tracking-widest text-violet-400 mb-1">Stage Bot</p>
                                <p className="text-xs font-bold text-violet-700 capitalize">{prediction.conversationStage || 'Sin memoria'}</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span className="font-bold">Follow-ups:</span>
                                <span className="font-black">{prediction.followupCount}</span>
                            </div>
                            {prediction.phone && (
                                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                    <Phone className="w-3 h-3" /> {prediction.phone}
                                </div>
                            )}
                            {prediction.email && (
                                <div className="flex items-center gap-1.5 text-xs text-gray-500 truncate">
                                    <Mail className="w-3 h-3" /> {prediction.email}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className={`rounded-xl p-3 border ${actionCfg.bgColor}`}>
                        <div className="flex items-center gap-2">
                            <span className="text-lg">{actionCfg.icon}</span>
                            <div>
                                <p className={`text-xs font-black ${actionCfg.color}`}>{actionCfg.label}</p>
                                <p className="text-[11px] text-gray-600">{actionCfg.description}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function PredictiveBoard({ isEmbedded = false }: { isEmbedded?: boolean }) {
    const { profile } = useAuth();
    const [predictions, setPredictions] = useState<PredictionResult[]>([]);
    const [summary, setSummary] = useState<{
        hotLeads: number; avgCloseProb: number; atRisk: number;
        readyToClose: number; needsNurture: number; projectedCloses: number;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'hot' | 'risk' | 'nurture'>('all');

    const load = useCallback(async () => {
        if (!profile?.company_id) return;
        setLoading(true);
        try {
            const [preds, summ] = await Promise.all([
                predictiveScoringService.scoreCompanyLeads(profile.company_id, { limit: 40 }),
                predictiveScoringService.getPredictionSummary(profile.company_id),
            ]);
            setPredictions(preds);
            setSummary(summ);
        } catch (e: any) {
            console.error(e);
            toast.error('Error al cargar predicciones');
        } finally {
            setLoading(false);
        }
    }, [profile?.company_id]);

    useEffect(() => { load(); }, [load]);

    const filtered = predictions.filter(p => {
        if (filter === 'hot') return p.closeProb >= 60;
        if (filter === 'risk') return p.trend === 'declining';
        if (filter === 'nurture') return p.predictedAction === 'nurture';
        return true;
    });

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500 font-medium">Oracle analizando leads…</p>
            </div>
        </div>
    );

    return (
        <div className={isEmbedded ? "space-y-6" : "min-h-screen bg-gray-50/50 p-4 sm:p-6 max-w-7xl mx-auto space-y-6"}>
            {/* HERO */}
            <div className="relative bg-gradient-to-br from-teal-900 via-cyan-900 to-slate-900 rounded-3xl p-6 sm:p-8 overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-teal-600/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20 shadow-xl">
                            <span className="text-2xl">🎯</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-black text-white">Oracle — Predicciones AI</h1>
                                <span className="bg-teal-500/30 text-teal-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-teal-400/30 uppercase tracking-widest">
                                    Zero Cost
                                </span>
                            </div>
                            <p className="text-sm text-slate-400 font-medium mt-0.5">
                                Probabilidad de cierre calculada con datos reales de tu CRM
                            </p>
                        </div>
                    </div>
                    <button onClick={load} className="flex items-center gap-2 px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white text-sm font-bold hover:bg-white/20 transition">
                        <RefreshCw className="w-4 h-4" /> Recalcular
                    </button>
                </div>

                {/* KPIs */}
                {summary && (
                    <div className="relative grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
                        {[
                            { label: 'Hot Leads', value: summary.hotLeads, icon: <Zap className="w-4 h-4" />, color: 'text-amber-300' },
                            { label: 'Prob. Media', value: `${summary.avgCloseProb}%`, icon: <Target className="w-4 h-4" />, color: 'text-teal-300' },
                            { label: 'En Riesgo', value: summary.atRisk, icon: <AlertTriangle className="w-4 h-4" />, color: 'text-red-300' },
                            { label: 'Listos p/ Cerrar', value: summary.readyToClose, icon: <ArrowUpRight className="w-4 h-4" />, color: 'text-emerald-300' },
                            { label: 'Necesitan Nurture', value: summary.needsNurture, icon: <Users className="w-4 h-4" />, color: 'text-violet-300' },
                            { label: 'Cierres Proyectados', value: summary.projectedCloses, icon: <BarChart2 className="w-4 h-4" />, color: 'text-cyan-300' },
                        ].map(kpi => (
                            <div key={kpi.label} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-3">
                                <div className={`flex items-center gap-1.5 ${kpi.color} mb-1.5`}>
                                    {kpi.icon}
                                    <span className="text-[9px] font-black uppercase tracking-widest opacity-70">{kpi.label}</span>
                                </div>
                                <p className="text-xl font-black text-white">{kpi.value}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* FILTERS */}
            <div className="flex gap-1 bg-white rounded-2xl p-1.5 border border-gray-100 shadow-sm w-fit">
                {([
                    { id: 'all',     label: 'Todos',     icon: <Users className="w-4 h-4" />,         count: predictions.length },
                    { id: 'hot',     label: 'Hot Leads',  icon: <Zap className="w-4 h-4" />,          count: predictions.filter(p => p.closeProb >= 60).length },
                    { id: 'risk',    label: 'En Riesgo',  icon: <AlertTriangle className="w-4 h-4" />, count: predictions.filter(p => p.trend === 'declining').length },
                    { id: 'nurture', label: 'Nurture',    icon: <ArrowDownRight className="w-4 h-4" />, count: predictions.filter(p => p.predictedAction === 'nurture').length },
                ] as const).map(t => (
                    <button key={t.id} onClick={() => setFilter(t.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black transition-all ${
                            filter === t.id ? 'bg-teal-600 text-white shadow-lg shadow-teal-200' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                        }`}>
                        {t.icon}{t.label}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filter === t.id ? 'bg-white/20' : 'bg-gray-100'}`}>{t.count}</span>
                    </button>
                ))}
            </div>

            {/* LEAD LIST */}
            {filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                    <div className="text-4xl mb-3">🎯</div>
                    <p className="text-sm font-bold text-gray-500">No hay leads en esta categoría</p>
                    <p className="text-xs text-gray-400 mt-1">Oracle necesita leads activos para calcular predicciones</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(pred => (
                        <LeadPredictionCard
                            key={pred.leadId}
                            prediction={pred}
                            expanded={expandedId === pred.leadId}
                            onToggle={() => setExpandedId(expandedId === pred.leadId ? null : pred.leadId)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
