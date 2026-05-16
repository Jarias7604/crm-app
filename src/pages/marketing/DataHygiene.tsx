import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { atlasAgentService, type AtlasSummary, type LeadDataReport } from '../../services/marketing/atlasAgent';
import {
    Database, AlertTriangle, CheckCircle, RefreshCw,
    Phone, Mail, Building2, Target, ChevronRight, Zap
} from 'lucide-react';

// ─── SEVERITY STYLES ─────────────────────────────────────────────────────────
const severityConfig = {
    critical: { label: 'Crítico', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500' },
    warning:  { label: 'Advertencia', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-400' },
    info:     { label: 'Info', color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-400' },
};

// ─── SCORE RING ───────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
    const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
    const r = 20;
    const circ = 2 * Math.PI * r;
    const offset = circ - (score / 100) * circ;

    return (
        <div className="relative w-14 h-14 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 52 52">
                <circle cx="26" cy="26" r={r} fill="none" stroke="#f3f4f6" strokeWidth="4" />
                <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="4"
                    strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-gray-800">
                {score}%
            </span>
        </div>
    );
}

// ─── LEAD ROW ─────────────────────────────────────────────────────────────────
function LeadRow({ report, expanded, onToggle }: {
    report: LeadDataReport;
    expanded: boolean;
    onToggle: () => void;
}) {
    return (
        <div className={`rounded-2xl border transition-all ${expanded ? 'border-indigo-200 shadow-md' : 'border-gray-100'} bg-white`}>
            <button onClick={onToggle} className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50/50 rounded-2xl">
                <ScoreRing score={report.completeness_score} />
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{report.lead_name}</p>
                    <p className="text-xs text-gray-500 truncate">{report.company_name || 'Empresa desconocida'} · {report.status}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-400 font-medium hidden sm:block">
                        {report.issues.length} {report.issues.length === 1 ? 'problema' : 'problemas'}
                    </span>
                    <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                </div>
            </button>

            {expanded && (
                <div className="px-4 pb-4 space-y-2 border-t border-gray-50 pt-3">
                    {report.issues.length === 0 ? (
                        <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                            <CheckCircle className="w-4 h-4" /> Datos completos
                        </div>
                    ) : (
                        <>
                            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Problemas detectados</p>
                            {report.issues.map((issue, i) => {
                                const cfg = severityConfig[issue.severity];
                                return (
                                    <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.bg} ${cfg.border}`}>
                                        <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${cfg.dot}`} />
                                        <div>
                                            <p className={`text-xs font-bold ${cfg.color}`}>{issue.label}</p>
                                            {issue.fix && <p className="text-xs text-gray-500 mt-0.5">{issue.fix}</p>}
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function DataHygiene() {
    const { profile } = useAuth();
    const companyId = profile?.company_id || '';

    const [summary, setSummary] = useState<AtlasSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'healthy'>('all');

    const load = useCallback(async () => {
        if (!companyId) return;
        setLoading(true);
        const result = await atlasAgentService.analyzeDataQuality(companyId);
        setSummary(result);
        setLoading(false);
    }, [companyId]);

    useEffect(() => { load(); }, [load]);

    const filtered = summary?.reports.filter(r => {
        if (filter === 'critical')  return r.completeness_score < 50;
        if (filter === 'warning')   return r.completeness_score >= 50 && r.completeness_score < 80;
        if (filter === 'healthy')   return r.completeness_score >= 80;
        return true;
    }) ?? [];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 p-6">
            {/* Header */}
            <div className="max-w-4xl mx-auto mb-8">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-600/20">
                            <Database className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-900">Atlas — Higiene de Datos</h1>
                            <p className="text-sm text-gray-500 font-medium mt-0.5">Análisis de calidad · Datos incompletos · Acciones correctivas</p>
                        </div>
                    </div>
                    <button onClick={load} disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Analizar
                    </button>
                </div>
            </div>

            <div className="max-w-4xl mx-auto space-y-6">
                {/* KPI Cards */}
                {summary && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            { label: 'Total Leads', value: summary.total_leads, icon: Target, color: 'text-gray-700', bg: 'bg-gray-100' },
                            { label: 'Saludables', value: summary.healthy, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                            { label: 'Atención', value: summary.needs_attention, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
                            { label: 'Críticos', value: summary.critical, icon: Zap, color: 'text-red-600', bg: 'bg-red-50' },
                        ].map(({ label, value, icon: Icon, color, bg }) => (
                            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
                                    <Icon className={`w-5 h-5 ${color}`} />
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-gray-900">{value}</p>
                                    <p className="text-xs text-gray-500 font-medium">{label}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Score Bar */}
                {summary && summary.total_leads > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-black text-gray-700 uppercase tracking-widest">Score Promedio de Calidad</p>
                            <span className={`text-2xl font-black ${summary.avg_score >= 80 ? 'text-emerald-600' : summary.avg_score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                {summary.avg_score}%
                            </span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${
                                summary.avg_score >= 80 ? 'bg-emerald-500' :
                                summary.avg_score >= 50 ? 'bg-amber-400' : 'bg-red-500'
                            }`} style={{ width: `${summary.avg_score}%` }} />
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 mt-1 font-medium">
                            <span>Incompleto</span><span>Óptimo</span>
                        </div>
                    </div>
                )}

                {/* Filter Tabs */}
                <div className="flex gap-2 bg-gray-100 p-1 rounded-2xl w-fit">
                    {[
                        { key: 'all', label: 'Todos' },
                        { key: 'critical', label: 'Críticos' },
                        { key: 'warning', label: 'Atención' },
                        { key: 'healthy', label: 'Saludables' },
                    ].map(tab => (
                        <button key={tab.key}
                            onClick={() => setFilter(tab.key as typeof filter)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                filter === tab.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                            }`}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Lead List */}
                {loading ? (
                    <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                        <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                        <p className="text-gray-900 font-bold">Sin problemas en esta categoría</p>
                        <p className="text-sm text-gray-500 mt-1">
                            {summary?.total_leads === 0 ? 'No hay leads para analizar.' : 'Todos los leads en esta categoría están correctos.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest px-1 mb-3">
                            {filtered.length} lead{filtered.length !== 1 ? 's' : ''} · ordenados por prioridad
                        </p>
                        {filtered.map(report => (
                            <LeadRow
                                key={report.lead_id}
                                report={report}
                                expanded={expandedId === report.lead_id}
                                onToggle={() => setExpandedId(expandedId === report.lead_id ? null : report.lead_id)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
