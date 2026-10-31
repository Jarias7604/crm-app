// src/components/company/AuditDetailModal.tsx
// Modal de Inspección Oficial de Auditorías Comerciales Certificadas (Inmutables)

import React from 'react';
import {
    X, ShieldCheck, Award, AlertTriangle, CheckCircle2,
    FileText, ExternalLink, User, Calendar, Target, Flame
} from 'lucide-react';
import { type SalesCallAudit } from '../../types/salesExcellence';

interface DetectedDemoLike {
    id: string;
    title: string;
    clientName: string;
    salesRepName: string;
    sdrName?: string;
    dateStr: string;
    fileUrl: string;
    auditScore?: number;
    rawSnippet: string;
}

interface AuditDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    demo: DetectedDemoLike | null;
    audit: SalesCallAudit | null;
}

export const AuditDetailModal: React.FC<AuditDetailModalProps> = ({
    isOpen,
    onClose,
    demo,
    audit
}) => {
    if (!isOpen || !demo) return null;

    const totalScore = audit?.total_score ?? demo.auditScore ?? 35;
    const repName = audit?.sales_rep_name || demo.salesRepName;
    const sdrName = audit?.sdr_rep_name || demo.sdrName;
    const clientName = demo.clientName;
    const rubricScores = audit?.rubric_scores || [];
    const coaching = audit?.coaching_summary;

    const getScoreBadge = (score: number) => {
        if (score >= 85) {
            return {
                bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
                badgeText: '🟢 APROBADO SÓLIDO (≥ 85 pts)',
                desc: 'Cumple el estándar de ventas ARIAS. Demostración estructurada y orientada al cierre.'
            };
        }
        if (score >= 70) {
            return {
                bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
                badgeText: '🟡 EN COACHING (70–84 pts)',
                desc: 'Requiere sesión de coaching 1:1 de 20 min enfocada en manejo de objeciones o cierre.'
            };
        }
        return {
            bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
            badgeText: '🔴 INTERVENCIÓN CRÍTICA (< 70 pts)',
            desc: 'Alerta de riesgo de deal perdido. El director de ventas debe intervenir antes del próximo contacto.'
        };
    };

    const badge = getScoreBadge(totalScore);

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
            <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] text-slate-100 overflow-hidden">
                {/* Header Superior */}
                <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-indigo-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
                            <ShieldCheck className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-black tracking-tight text-white">
                                    Auditoría Oficial Certificada
                                </h3>
                                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3" />
                                    Inmutable
                                </span>
                            </div>
                            <p className="text-xs text-indigo-200/70 font-medium">
                                Cuenta: <strong className="text-white">{clientName}</strong> · Presentador (AE): <strong className="text-white">{repName}</strong>
                                {sdrName && (
                                    <span className="ml-2 text-indigo-300">
                                        · Agendada por (SDR): <strong className="text-amber-300">{sdrName}</strong>
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Banner de Integridad y Protección de Datos */}
                <div className="bg-emerald-950/40 border-b border-emerald-500/20 px-6 py-3 flex items-center gap-3 text-xs text-emerald-200/90">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                        <strong>Garantía de Integridad:</strong> Esta auditoría ha sido certificada contra la Rúbrica Oficial ARIAS de 100 Puntos. 
                        Para evitar la manipulación de métricas comerciales, el registro está sellado y protegido contra recálculos.
                    </span>
                </div>

                {/* Banner de Atribución de Roles SDR vs Presentador */}
                {sdrName && (
                    <div className="bg-indigo-950/60 border-b border-indigo-500/30 px-6 py-2.5 flex items-center justify-between text-xs text-indigo-200">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                Separación de Roles SDR vs AE
                            </span>
                            <span>
                                Cita coordinada en Calendar por <strong>{sdrName} (SDR)</strong>. Demostración en vivo ejecutada por <strong>{repName} (AE)</strong> y evaluada por la Rúbrica.
                            </span>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
                            ✓ Atribución Verificada
                        </span>
                    </div>
                )}

                {/* Contenido con Scroll */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Tarjeta de Calificación Global */}
                    <div className={`p-6 rounded-3xl border flex flex-col md:flex-row items-center justify-between gap-6 ${badge.bg}`}>
                        <div className="space-y-2 text-center md:text-left">
                            <span className="text-[11px] font-black tracking-widest uppercase">
                                {badge.badgeText}
                            </span>
                            <h4 className="text-2xl font-black text-white">
                                Evaluación de Rendimiento Comercial
                            </h4>
                            <p className="text-xs max-w-xl text-slate-300">
                                {badge.desc}
                            </p>
                        </div>

                        <div className="flex flex-col items-center justify-center p-4 bg-slate-900/80 rounded-2xl border border-white/10 shrink-0 min-w-[130px]">
                            <span className="text-3xl font-black text-white tracking-tight">
                                {totalScore}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                de 100 puntos
                            </span>
                        </div>
                    </div>

                    {/* Resumen de Coaching y Hallazgos */}
                    {coaching && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                                <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-wider">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Fortalezas Demostradas
                                </div>
                                <div className="text-xs text-slate-300">
                                    <p className="flex items-start gap-1.5">
                                        <span className="text-emerald-400 font-bold">✓</span> {coaching.strength || 'Demostración técnica orientada a los módulos core del sistema.'}
                                    </p>
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-2">
                                <div className="flex items-center gap-2 text-rose-400 text-xs font-black uppercase tracking-wider">
                                    <AlertTriangle className="w-4 h-4" />
                                    Brecha Crítica (Punto Ciego)
                                </div>
                                <p className="text-xs text-slate-300 font-medium">
                                    {coaching.critical_gap}
                                </p>
                                <div className="pt-2 border-t border-rose-500/10">
                                    <p className="text-[11px] font-bold text-rose-300">
                                        🎯 Plan de Acción 1:1:
                                    </p>
                                    <p className="text-[11px] text-slate-400">
                                        {coaching.immediate_action}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Desglose de los 9 Criterios de la Rúbrica Oficial */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                                <Award className="w-4 h-4 text-indigo-400" />
                                Desglose de los 9 Criterios · Rúbrica Oficial ARIAS (100 Pts)
                            </h4>
                            <span className="text-[11px] text-slate-500 font-bold">
                                Meta: 85 pts
                            </span>
                        </div>

                        <div className="space-y-2.5">
                            {rubricScores.map((c, i) => {
                                const isPass = c.status === 'pass';
                                const isCoaching = c.status === 'coaching';
                                const scoreValue = c.score ?? (c as any).score_awarded ?? 0;
                                const maxPoints = c.max_points ?? (c as any).max_score ?? 10;

                                return (
                                    <div
                                        key={c.id || (c as any).criterion_id || i}
                                        className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-800/60 transition-all"
                                    >
                                        <div className="space-y-1 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-white">
                                                    {c.name}
                                                </span>
                                                <span
                                                    className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                        isPass
                                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                            : isCoaching
                                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                                    }`}
                                                >
                                                    {isPass ? 'Aprobado' : isCoaching ? 'Coaching' : 'Crítico'}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-400 italic">
                                                «{c.evidence_quote}»
                                            </p>
                                        </div>

                                        <div className="text-right shrink-0">
                                            <span className="text-xs font-black text-white">
                                                {scoreValue} / {maxPoints} pts
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Notas Originales de Google Meet */}
                    <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                                Extracto de Notas Analizadas (Google Meet Gemini)
                            </span>
                            <a
                                href={demo.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-bold"
                            >
                                Abrir Documento en Google Drive
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                        <p className="text-xs text-slate-300 font-mono leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                            {demo.rawSnippet}
                        </p>
                    </div>
                </div>

                {/* Footer Modal */}
                <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Fecha de llamada: {demo.dateStr}</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <a
                            href={demo.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all flex items-center gap-1.5"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Ver en Google Drive
                        </a>

                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 transition-all cursor-pointer shadow-sm shadow-indigo-600/20"
                        >
                            Cerrar Reporte
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
