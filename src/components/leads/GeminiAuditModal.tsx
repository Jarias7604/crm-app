// src/components/leads/GeminiAuditModal.tsx
// Auditoría de Demos de Google Meet con Gemini AI según la Rúbrica ARIAS de 100 Puntos

import React, { useState, useEffect } from 'react';
import {
    X, Sparkles, AlertTriangle, CheckCircle2, Award, FileText,
    ExternalLink, ArrowRight, RefreshCw, Loader2, ShieldCheck, Flame, ChevronRight
} from 'lucide-react';
import { salesAuditService } from '../../services/salesAuditService';
import {
    type SalesCallAudit,
    type RubricCriterionScore,
    type AuditCoachingSummary,
    type ExtractedLeadData
} from '../../types/salesExcellence';
import toast from 'react-hot-toast';

interface GeminiAuditModalProps {
    isOpen: boolean;
    onClose: () => void;
    lead: any;
    profile: any;
    onLeadUpdated?: (updates: any) => Promise<void>;
}

export const GeminiAuditModal: React.FC<GeminiAuditModalProps> = ({
    isOpen,
    onClose,
    lead,
    profile,
    onLeadUpdated
}) => {
    const [googleDocUrl, setGoogleDocUrl] = useState('');
    const [meetingNotesRaw, setMeetingNotesRaw] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [pastAudits, setPastAudits] = useState<SalesCallAudit[]>([]);
    const [currentAuditResult, setCurrentAuditResult] = useState<{
        totalScore: number;
        rubricScores: RubricCriterionScore[];
        coachingSummary: AuditCoachingSummary;
        extractedData: ExtractedLeadData;
    } | null>(null);

    useEffect(() => {
        if (isOpen && lead?.id) {
            loadLeadAudits();
        }
    }, [isOpen, lead?.id]);

    const loadLeadAudits = async () => {
        if (!lead?.id) return;
        try {
            const audits = await salesAuditService.getAuditsByLead(lead.id);
            setPastAudits(audits);
            if (audits.length > 0 && !currentAuditResult) {
                // Display latest audit
                const latest = audits[0];
                setCurrentAuditResult({
                    totalScore: latest.total_score,
                    rubricScores: latest.rubric_scores,
                    coachingSummary: latest.coaching_summary,
                    extractedData: latest.extracted_data
                });
                if (latest.google_doc_url) setGoogleDocUrl(latest.google_doc_url);
                if (latest.meeting_notes_raw) setMeetingNotesRaw(latest.meeting_notes_raw);
            }
        } catch (e) {
            console.error('Error loading audits:', e);
        }
    };

    if (!isOpen) return null;

    const handleRunAudit = async () => {
        const textToAudit = meetingNotesRaw.trim();
        if (!textToAudit && !googleDocUrl.trim()) {
            toast.error('Pega el resumen o notas generadas por Gemini (Google Meet) o el enlace del Google Doc.');
            return;
        }

        setIsAnalyzing(true);
        try {
            const effectiveText = textToAudit || `Notas de demostración desde Google Doc: ${googleDocUrl}`;
            const result = await salesAuditService.auditGeminiNotes(
                effectiveText,
                lead.name || 'Prospecto',
                profile?.full_name || 'Vendedor'
            );

            setCurrentAuditResult(result);
            toast.success(`¡Auditoría completada! Puntuación: ${result.totalScore}/100`);

            // Auto-guardar la auditoría
            setIsSaving(true);
            await salesAuditService.saveAudit({
                company_id: lead.company_id || profile?.company_id || '',
                lead_id: lead.id,
                evaluated_user_id: lead.assigned_to || profile?.id || null,
                auditor_id: profile?.id || null,
                google_doc_url: googleDocUrl.trim() || null,
                meeting_notes_raw: effectiveText,
                total_score: result.totalScore,
                rubric_scores: result.rubricScores,
                coaching_summary: result.coachingSummary,
                extracted_data: result.extractedData,
                status: 'completed'
            });
            setIsSaving(false);

            await loadLeadAudits();
        } catch (error: any) {
            console.error('Error running audit:', error);
            toast.error('Ocurrió un error al auditar las notas.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleApplyDataToLead = async () => {
        if (!currentAuditResult || !onLeadUpdated) return;
        const updates: any = {};
        const ext = currentAuditResult.extractedData;

        if (ext.next_step) {
            updates.next_action_notes = `[Auditoría Gemini] Próximo paso: ${ext.next_step}. ${currentAuditResult.coachingSummary.immediate_action}`;
        }

        // Set next follow-up date to 1 business day if empty or needed
        if (!lead.next_followup_date) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            updates.next_followup_date = tomorrow.toISOString().split('T')[0];
        }

        try {
            await onLeadUpdated(updates);
            toast.success('Campos del lead actualizados con los hallazgos de la auditoría');
        } catch (e) {
            toast.error('No se pudieron actualizar los campos del lead.');
        }
    };

    const getScoreBadge = (score: number) => {
        if (score >= 85) {
            return {
                bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
                badgeText: 'SÓLIDO (85–100)',
                desc: 'Cumple el estándar comercial ARIAS. Listo para avanzar a cierre.'
            };
        }
        if (score >= 70) {
            return {
                bg: 'bg-amber-50 border-amber-200 text-amber-800',
                badgeText: 'COACHING (70–84)',
                desc: 'Requiere sesión 1:1 de 20 minutos enfocada en los puntos débiles identificados.'
            };
        }
        return {
            bg: 'bg-rose-50 border-rose-200 text-rose-800',
            badgeText: 'INTERVENCIÓN (< 70)',
            desc: 'Alerta crítica. El director debe revisar este deal antes del próximo contacto.'
        };
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] text-slate-800 overflow-hidden">
                {/* Header Superior */}
                <div className="px-6 py-5 bg-white border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-xs">
                            <Sparkles className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-black tracking-tight text-slate-900">
                                    Auditoría de Demostración con Gemini AI
                                </h3>
                                <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
                                    Google Meet
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium">
                                Lead: <strong className="text-slate-800">{lead.name}</strong> · Vendedor evaluado: <strong className="text-slate-800">{lead.assigned_to_name || profile?.full_name || 'Vendedor'}</strong>
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body con Scroll */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Caja de Entrada de Datos de Gemini */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black uppercase text-indigo-700 tracking-wider">
                                    Fuente de Notas de la Reunión
                                </span>
                            </div>
                            <span className="text-[11px] text-slate-500 font-medium">
                                Generado por "Take notes for me" de Google Meet
                            </span>
                        </div>

                        {/* Input Google Doc URL */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                Enlace al Google Doc de Gemini (Opcional):
                            </label>
                            <input
                                type="url"
                                value={googleDocUrl}
                                onChange={(e) => setGoogleDocUrl(e.target.value)}
                                placeholder="https://docs.google.com/document/d/..."
                                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>

                        {/* Textarea Notas de Gemini */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                                <span>Pega el texto del Resumen o Transcripción de Gemini:</span>
                                <span className="text-[10px] text-slate-500">Copia y pega desde Google Meet o Docs</span>
                            </label>
                            <textarea
                                rows={4}
                                value={meetingNotesRaw}
                                onChange={(e) => setMeetingNotesRaw(e.target.value)}
                                placeholder="Pega aquí el texto que Gemini generó al terminar la llamada de Google Meet (ej. problemas mencionados, objeciones de precio, requerimientos técnicos y acuerdos finales)..."
                                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 leading-relaxed"
                            />
                        </div>

                        {/* Botón Auditar */}
                        <div className="flex justify-end pt-1">
                            <button
                                type="button"
                                disabled={isAnalyzing}
                                onClick={handleRunAudit}
                                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-2.5 disabled:opacity-50 cursor-pointer"
                            >
                                {isAnalyzing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Auditando contra Rúbrica ARIAS...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4 text-white" />
                                        Auditar Demo con Rúbrica Oficial (100 Puntos)
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Resultados de la Auditoría */}
                    {currentAuditResult && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Score Card Hero */}
                            {(() => {
                                const badgeInfo = getScoreBadge(currentAuditResult.totalScore);
                                return (
                                    <div className={`p-6 rounded-2xl border ${badgeInfo.bg} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5`}>
                                        <div className="flex items-center gap-4">
                                            <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 flex flex-col items-center justify-center text-center shadow-xs">
                                                <span className="text-2xl font-black text-slate-900">
                                                    {currentAuditResult.totalScore}
                                                </span>
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                                    / 100 pts
                                                </span>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-black tracking-wide border bg-white shadow-xs">
                                                    {badgeInfo.badgeText}
                                                </span>
                                                <p className="text-xs text-slate-600 max-w-lg leading-relaxed">
                                                    {badgeInfo.desc}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleApplyDataToLead}
                                            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-xs cursor-pointer"
                                        >
                                            <ShieldCheck className="w-4 h-4 text-indigo-600" />
                                            Actualizar Lead con Hallazgos
                                        </button>
                                    </div>
                                );
                            })()}

                            {/* Plan de Coaching 1:1 de 20 Minutos */}
                            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                                <div className="flex items-center gap-2">
                                    <Award className="w-4 h-4 text-amber-500" />
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                                        Plan de Coaching Semanal 1:1 (20 minutos)
                                    </h4>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                    <div className="p-3.5 rounded-xl bg-white border border-emerald-200 space-y-1 shadow-xs">
                                        <span className="text-[10px] font-black uppercase text-emerald-700 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                                            1 Fortaleza Observable
                                        </span>
                                        <p className="text-slate-700 font-medium leading-relaxed">
                                            {currentAuditResult.coachingSummary.strength}
                                        </p>
                                    </div>

                                    <div className="p-3.5 rounded-xl bg-white border border-rose-200 space-y-1 shadow-xs">
                                        <span className="text-[10px] font-black uppercase text-rose-700 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                                            1 Falla Crítica Observable
                                        </span>
                                        <p className="text-slate-700 font-medium leading-relaxed">
                                            {currentAuditResult.coachingSummary.critical_gap}
                                        </p>
                                    </div>

                                    <div className="p-3.5 rounded-xl bg-white border border-indigo-200 space-y-1 shadow-xs">
                                        <span className="text-[10px] font-black uppercase text-indigo-700 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                                            Roleplay Sugerido de 7 minutos
                                        </span>
                                        <p className="text-slate-700 font-medium leading-relaxed">
                                            {currentAuditResult.coachingSummary.recommended_roleplay}
                                        </p>
                                    </div>

                                    <div className="p-3.5 rounded-xl bg-white border border-amber-200 space-y-1 shadow-xs">
                                        <span className="text-[10px] font-black uppercase text-amber-700 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                                            Acción Inmediata de Rescate de este Deal
                                        </span>
                                        <p className="text-slate-700 font-medium leading-relaxed">
                                            {currentAuditResult.coachingSummary.immediate_action}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Desglose de los 9 Criterios Oficiales */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                                    Desglose de los 9 Criterios de Evaluación
                                </h4>

                                <div className="space-y-2">
                                    {currentAuditResult.rubricScores.map((criterion, idx) => (
                                        <div
                                            key={criterion.id}
                                            className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs"
                                        >
                                            <div className="space-y-1 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-slate-400 text-[10px]">
                                                        #{idx + 1}
                                                    </span>
                                                    <span className="font-bold text-slate-900">
                                                        {criterion.name}
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                                        criterion.status === 'pass'
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            : criterion.status === 'coaching'
                                                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                    }`}>
                                                        {criterion.status === 'pass' ? 'Cumplido' : criterion.status === 'coaching' ? 'Mejorable' : 'Fallo Crítico'}
                                                    </span>
                                                </div>
                                                <p className="text-slate-600 text-[11px] italic">
                                                    «{criterion.evidence_quote}»
                                                </p>
                                                <p className="text-indigo-600 text-[11px] font-medium">
                                                    Recomendación: {criterion.recommendation}
                                                </p>
                                            </div>

                                            <div className="text-right flex-shrink-0">
                                                <span className="text-base font-black text-slate-900">
                                                    {criterion.score}
                                                </span>
                                                <span className="text-slate-400 text-[11px]">
                                                    /{criterion.max_points} pts
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Modal */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                    <span>
                        {pastAudits.length > 0 ? `${pastAudits.length} auditoría(s) registradas para este lead` : 'Sin auditorías previas'}
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold transition-all cursor-pointer"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};
