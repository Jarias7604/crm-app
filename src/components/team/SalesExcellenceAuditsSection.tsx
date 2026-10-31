// src/components/team/SalesExcellenceAuditsSection.tsx
// Panel de Auditoría y Calidad Comercial ARIAS para TeamPerformance
// Con Filtro Interactivo por Ejecutivo y Diagnóstico Global Consolidado 1:1

import React, { useState, useEffect } from 'react';
import {
    Award, ShieldAlert, CheckCircle2, TrendingUp, Users, Calendar,
    ExternalLink, Sparkles, Flame, ChevronRight, FileText, Target,
    Filter, X, Copy, Check, BarChart2, AlertTriangle, Layers, ArrowRight,
    Lightbulb
} from 'lucide-react';
import toast from 'react-hot-toast';
import { salesAuditService } from '../../services/salesAuditService';
import type { SalesCallAudit, RubricCriterionScore } from '../../types/salesExcellence';
import { OFFICIAL_ARIAS_RUBRIC } from '../../types/salesExcellence';
import { RealCoachingOpportunitiesModal } from '../company/RealCoachingOpportunitiesModal';
import { SalesQualityTrendChart } from './SalesQualityTrendChart';

interface SalesExcellenceAuditsSectionProps {
    companyId: string;
    profileNames: Record<string, string>;
    profileAvatars: Record<string, string | null>;
}

interface RepAggregateDiagnostic {
    repName: string;
    totalDemos: number;
    avgScore: number;
    criteriaStats: {
        id: string;
        name: string;
        maxPoints: number;
        passCount: number;
        failCount: number;
        coachingCount: number;
        passRate: number; // 0 - 100%
        commonGapQuote?: string;
    }[];
    topGaps: { name: string; failCount: number; percentage: number; recommendation: string }[];
    topStrengths: { name: string; passCount: number; percentage: number }[];
    roleplayFocus: string;
    actionRequired: string;
}

export const SalesExcellenceAuditsSection: React.FC<SalesExcellenceAuditsSectionProps> = ({
    companyId,
    profileNames,
    profileAvatars
}) => {
    const [stats, setStats] = useState<{
        totalAudits: number;
        avgScore: number;
        repAverages: Record<string, { count: number; avgScore: number; lastScore: number }>;
        sdrTotals?: Record<string, { count: number; lastDemo: string; demos: string[] }>;
        latestAudits: SalesCallAudit[];
    }>({
        totalAudits: 0,
        avgScore: 0,
        repAverages: {},
        sdrTotals: {},
        latestAudits: []
    });
    const [loading, setLoading] = useState(true);
    const [selectedAudit, setSelectedAudit] = useState<SalesCallAudit | null>(null);
    const [selectedRep, setSelectedRep] = useState<string | null>(null);
    const [activeCoachingTab, setActiveCoachingTab] = useState<'aggregate' | 'single'>('aggregate');
    const [copiedPlan, setCopiedPlan] = useState(false);
    const [isCoachingModalOpen, setIsCoachingModalOpen] = useState(false);
    const [coachingModalDemoId, setCoachingModalDemoId] = useState<string | undefined>(undefined);

    // Resuelve la foto de perfil oficial o avatar ejecutivo de alta resolución
    const getExecutiveAvatar = (repKey: string, displayName: string): string => {
        // 1. Directo desde profileAvatars (por UUID o nombre)
        if (profileAvatars[repKey]) return profileAvatars[repKey]!;
        if (profileAvatars[displayName]) return profileAvatars[displayName]!;
        if (profileAvatars[displayName.toLowerCase().trim()]) return profileAvatars[displayName.toLowerCase().trim()]!;

        // 2. Búsqueda en profileNames (UUID -> Nombre Completo)
        const cleanName = (displayName || '').toLowerCase().trim();
        const cleanKey = (repKey || '').toLowerCase().trim();
        for (const [uid, fullName] of Object.entries(profileNames)) {
            if (fullName) {
                const cleanFull = fullName.toLowerCase().trim();
                if (cleanFull === cleanName || cleanFull === cleanKey) {
                    if (profileAvatars[uid]) return profileAvatars[uid]!;
                }
            }
        }

        // 3. Retratos oficiales ejecutivos ARIAS (garantiza foto real siempre, incluso sin upload en DB)
        if (cleanName.includes('diana') || cleanKey.includes('diana')) {
            return 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80';
        }
        if (cleanName.includes('grecia') || cleanKey.includes('grecia')) {
            return 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80';
        }
        if (cleanName.includes('patricia') || cleanKey.includes('patricia')) {
            return 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80';
        }

        // 4. Fallback de alta resolución con iniciales
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || 'User')}&background=4f46e5&color=fff&size=128&bold=true`;
    };

    useEffect(() => {
        if (companyId) {
            loadStats();
        }

        const handleUpdate = () => {
            loadStats();
        };

        window.addEventListener('sales_audit_updated', handleUpdate);
        return () => window.removeEventListener('sales_audit_updated', handleUpdate);
    }, [companyId]);

    const loadStats = async () => {
        setLoading(true);
        try {
            const data = await salesAuditService.getCompanyAuditStats(companyId);
            setStats(data);
            if (data.latestAudits.length > 0) {
                setSelectedAudit(data.latestAudits[0]);
            }
        } catch (e) {
            console.error('Error loading audit stats', e);
        } finally {
            setLoading(false);
        }
    };

    const getScoreBadge = (score: number) => {
        if (score >= 85) return { color: 'text-emerald-600 bg-emerald-50 border-emerald-200', text: '🟢 Sólido' };
        if (score >= 70) return { color: 'text-amber-600 bg-amber-50 border-amber-200', text: '🟡 Coaching' };
        return { color: 'text-rose-600 bg-rose-50 border-rose-200', text: '🔴 Intervención' };
    };

    // ─── Motor de Diagnóstico Global Agregado por Persona ────────────────────────
    const calculateRepDiagnostic = (targetRep: string, allAudits: SalesCallAudit[]): RepAggregateDiagnostic | null => {
        const cleanTarget = targetRep.toLowerCase().trim();
        const isTeamAll = cleanTarget === 'todo el equipo' || cleanTarget === 'todos';

        const repAudits = isTeamAll
            ? allAudits
            : allAudits.filter(a => {
                const name = (a.sales_rep_name || '').toLowerCase().trim();
                const sdr = (a.sdr_rep_name || '').toLowerCase().trim();
                const id = (a.evaluated_user_id || '').toLowerCase().trim();
                return name.includes(cleanTarget) || cleanTarget.includes(name) || sdr.includes(cleanTarget) || id === cleanTarget;
            });

        if (repAudits.length === 0) return null;

        const totalDemos = repAudits.length;
        const avgScore = Math.round(repAudits.reduce((acc, a) => acc + a.total_score, 0) / totalDemos);

        // Agrupación por los 9 criterios de la Rúbrica Oficial
        const criteriaMap: Record<string, {
            id: string;
            name: string;
            maxPoints: number;
            passCount: number;
            coachingCount: number;
            failCount: number;
            quotes: string[];
            recommendation: string;
        }> = {};

        OFFICIAL_ARIAS_RUBRIC.forEach(rubric => {
            criteriaMap[rubric.id] = {
                id: rubric.id,
                name: rubric.name,
                maxPoints: rubric.max_points,
                passCount: 0,
                coachingCount: 0,
                failCount: 0,
                quotes: [],
                recommendation: ''
            };
        });

        repAudits.forEach(audit => {
            (audit.rubric_scores || []).forEach(criterion => {
                const entry = criteriaMap[criterion.id];
                if (entry) {
                    if (criterion.status === 'pass') entry.passCount++;
                    else if (criterion.status === 'coaching') entry.coachingCount++;
                    else entry.failCount++;

                    if (criterion.evidence_quote && !entry.quotes.includes(criterion.evidence_quote)) {
                        entry.quotes.push(criterion.evidence_quote);
                    }
                    if (criterion.recommendation) {
                        entry.recommendation = criterion.recommendation;
                    }
                }
            });
        });

        const criteriaStats = Object.values(criteriaMap).map(c => ({
            id: c.id,
            name: c.name,
            maxPoints: c.maxPoints,
            passCount: c.passCount,
            failCount: c.failCount,
            coachingCount: c.coachingCount,
            passRate: Math.round((c.passCount / totalDemos) * 100),
            commonGapQuote: c.quotes[0]
        }));

        // Top Errores Recurrentes (ordenados por mayor cantidad de fallas)
        const sortedByFail = [...criteriaStats].sort((a, b) => b.failCount - a.failCount || a.passRate - b.passRate);
        const topGaps = sortedByFail
            .filter(c => c.failCount > 0 || c.passRate < 70)
            .slice(0, 3)
            .map(c => ({
                name: c.name,
                failCount: c.failCount,
                percentage: Math.round((c.failCount / totalDemos) * 100),
                recommendation: criteriaMap[c.id]?.recommendation || 'Reforzar en coaching semanal'
            }));

        // Top Fortalezas Demostradas
        const sortedByPass = [...criteriaStats].sort((a, b) => b.passRate - a.passRate);
        const topStrengths = sortedByPass
            .filter(c => c.passCount > 0)
            .slice(0, 3)
            .map(c => ({
                name: c.name,
                passCount: c.passCount,
                percentage: c.passRate
            }));

        // Roleplay de 7 minutos sugerido según la mayor brecha
        let roleplayFocus = 'Roleplay general de estructura de demo y descubrimiento BANT.';
        if (topGaps.some(g => g.name.toLowerCase().includes('próximo paso') || g.name.toLowerCase().includes('decisión') || g.name.toLowerCase().includes('agenda'))) {
            roleplayFocus = 'Roleplay de Cierre y Agendamiento (7 min): Cierre condicionado y cómo abrir Google Calendar en vivo antes de colgar.';
        } else if (topGaps.some(g => g.name.toLowerCase().includes('impacto') || g.name.toLowerCase().includes('cuantificado') || g.name.toLowerCase().includes('diagnóstico'))) {
            roleplayFocus = 'Roleplay de Diagnóstico Financiero (7 min): Preguntar cuántas horas o dólares le cuesta hoy el dolor al cliente.';
        } else if (topGaps.some(g => g.name.toLowerCase().includes('objeciones'))) {
            roleplayFocus = 'Roleplay de Manejo de Objeciones (7 min): Método ESCUCHAR sin regalar descuentos ni promesas prematuras.';
        }

        const actionRequired = topGaps.length > 0
            ? `Enfocar la sesión 1:1 de esta semana en corregir: "${topGaps[0].name}" (falló en ${topGaps[0].failCount} de ${totalDemos} demos, ${topGaps[0].percentage}% de incidencia).`
            : 'Felicitar al vendedor por mantener 100% de apego a la metodología en todas las demostraciones.';

        return {
            repName: targetRep,
            totalDemos,
            avgScore,
            criteriaStats,
            topGaps,
            topStrengths,
            roleplayFocus,
            actionRequired
        };
    };

    // Manejador del click en un ejecutivo para filtrar
    const handleToggleRepFilter = (name: string | null) => {
        if (!name || selectedRep === name) {
            setSelectedRep(null);
            setActiveCoachingTab('aggregate');
        } else {
            setSelectedRep(name);
            setActiveCoachingTab('aggregate');
            // Auto-seleccionar la primera demo de ese vendedor
            const repFirst = stats.latestAudits.find(a => 
                (a.sales_rep_name || '').toLowerCase().includes(name.toLowerCase()) ||
                (a.sdr_rep_name || '').toLowerCase().includes(name.toLowerCase())
            );
            if (repFirst) setSelectedAudit(repFirst);
        }
    };

    // Filtrar auditorías mostradas en la lista inferior
    const displayedAudits = stats.latestAudits.filter(a => {
        if (!selectedRep) return true;
        const cleanRep = selectedRep.toLowerCase().trim();
        const repName = (a.sales_rep_name || '').toLowerCase().trim();
        const sdrName = (a.sdr_rep_name || '').toLowerCase().trim();
        const evalId = (a.evaluated_user_id || '').toLowerCase().trim();
        return repName.includes(cleanRep) || cleanRep.includes(repName) || sdrName.includes(cleanRep) || evalId === cleanRep;
    });

    // Diagnóstico activo: de la persona seleccionada o de todo el equipo
    const activeDiagnostic = calculateRepDiagnostic(selectedRep || 'Todo el Equipo', stats.latestAudits);

    // Copiar resumen 1:1 al portapapeles
    const handleCopyCoachingReport = () => {
        if (!activeDiagnostic) return;
        const text = `📊 REPORTE DE CALIDAD COMERCIAL 1:1 - ${activeDiagnostic.repName.toUpperCase()}
Calidad Comercial Media: ${activeDiagnostic.avgScore}/100 (${activeDiagnostic.totalDemos} demostraciones auditadas)

🚨 TOP ERRORES SISTÉMICOS RECURRENTES (A Corregir en 1:1):
${activeDiagnostic.topGaps.map((g, i) => `${i + 1}. ${g.name}: Falló en ${g.failCount} de ${activeDiagnostic.totalDemos} demos (${g.percentage}% de error).
   ↳ Corrección: ${g.recommendation}`).join('\n\n')}

🌟 FORTALEZAS DEMOSTRADAS CONSISTENTES:
${activeDiagnostic.topStrengths.map((s, i) => `✓ ${s.name}: Cumplido en ${s.passCount} de ${activeDiagnostic.totalDemos} demos (${s.percentage}% de éxito).`).join('\n')}

🎯 ROLEPLAY DE 7 MINUTOS PARA ESTA SEMANA:
${activeDiagnostic.roleplayFocus}

⚡ ACCIÓN INMEDIATA EXIGIDA:
${activeDiagnostic.actionRequired}
`;
        navigator.clipboard.writeText(text);
        setCopiedPlan(true);
        toast.success(`Plan 1:1 de ${activeDiagnostic.repName} copiado al portapapeles`);
        setTimeout(() => setCopiedPlan(false), 2500);
    };

    return (
        <div className="space-y-6">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                        <Flame className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            Calidad Comercial Media
                        </p>
                        <p className="text-2xl font-black text-slate-800 tracking-tight">
                            {stats.avgScore > 0 ? `${stats.avgScore} / 100` : 'Sin datos'}
                        </p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600">
                        <FileText className="w-6 h-6 text-violet-600" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            Demos Auditadas (Gemini)
                        </p>
                        <p className="text-2xl font-black text-slate-800 tracking-tight">
                            {stats.totalAudits} demos
                        </p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                        <Target className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            Meta de Coaching Semanal
                        </p>
                        <p className="text-2xl font-black text-slate-800 tracking-tight">
                            5 demos / rep
                        </p>
                    </div>
                </div>
            </div>

            {/* Gráfico Interactivo de Evolución de Calidad Comercial en el Tiempo */}
            <SalesQualityTrendChart
                audits={stats.latestAudits}
                selectedRep={selectedRep}
                onSelectRep={handleToggleRepFilter}
                executiveAvatars={{
                    'Diana Morales': getExecutiveAvatar('Diana Morales', 'Diana Morales'),
                    'Grecia Vásquez': getExecutiveAvatar('Grecia Vásquez', 'Grecia Vásquez'),
                    'Patricia Martínez': getExecutiveAvatar('Patricia Martínez', 'Patricia Martínez')
                }}
            />

            {/* Ranking por Vendedor con Filtro Interactivo */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                            <Award className="w-4 h-4 text-indigo-500" />
                            Scorecard de Calidad Comercial por Ejecutivo (AE)
                        </h3>
                        <p className="text-xs text-slate-400">
                            Haz clic en cualquier persona para filtrar todas sus demos y ver su diagnóstico global consolidado
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {selectedRep && (
                            <button
                                onClick={() => setSelectedRep(null)}
                                className="px-3 py-1 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" />
                                Ver Todos ({stats.totalAudits})
                            </button>
                        )}
                        <span className="text-xs font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/60">
                            Meta ARIAS: ≥ 85 pts
                        </span>
                    </div>
                </div>

                {Object.keys(stats.repAverages).length === 0 ? (
                    <div className="text-center py-10 space-y-2">
                        <p className="text-xs text-slate-400">Aún no hay demostraciones auditadas para tu equipo.</p>
                        <p className="text-xs text-indigo-600 font-bold">
                            Para auditar la primera demo, abre cualquier Lead y haz clic en "⚡ Auditar Gemini".
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {Object.entries(stats.repAverages).map(([repId, repData]) => {
                            const matchingAudit = stats.latestAudits.find(a => (a.evaluated_user_id === repId || a.sales_rep_name === repId) && a.sales_rep_name);
                            const name = profileNames[repId] || matchingAudit?.sales_rep_name || (repId !== 'unassigned' && !repId.includes('-') ? repId : 'Ejecutivo de Ventas');
                            const avatar = getExecutiveAvatar(repId, name);
                            const badge = getScoreBadge(repData.avgScore);
                            const isSelected = selectedRep === name;

                            return (
                                <div
                                    key={repId}
                                    onClick={() => handleToggleRepFilter(name)}
                                    className={`py-4 flex items-center justify-between gap-4 px-3 rounded-2xl transition-all cursor-pointer ${
                                        isSelected
                                            ? 'bg-indigo-50/80 ring-2 ring-indigo-500 shadow-xs'
                                            : 'hover:bg-slate-50/80'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <img
                                                src={avatar}
                                                alt={name}
                                                className={`w-11 h-11 rounded-full object-cover border-2 shadow-xs ${
                                                    isSelected ? 'border-indigo-500' : 'border-slate-200'
                                                }`}
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4f46e5&color=fff&size=128&bold=true`;
                                                }}
                                            />
                                            {isSelected && (
                                                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold border border-white">
                                                    ✓
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-xs font-black text-slate-800">{name}</h4>
                                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                                                    AE / Demostradora
                                                </span>
                                                {isSelected && (
                                                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow-2xs">
                                                        Filtrando activo
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-slate-400">
                                                {repData.count} demo(s) auditada(s) · Última puntuación: {repData.lastScore} pts · <span className="text-indigo-600 font-semibold">Clic para ver reporte 1:1</span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${badge.color}`}>
                                                    {badge.text}
                                                </span>
                                                <span className="text-base font-black text-slate-800">
                                                    {repData.avgScore} / 100
                                                </span>
                                            </div>
                                            <div className="w-32 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1 ml-auto">
                                                <div
                                                    className={`h-full rounded-full ${repData.avgScore >= 85 ? 'bg-emerald-500' : repData.avgScore >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                                    style={{ width: `${Math.min(repData.avgScore, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                        <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-indigo-600 rotate-90' : 'text-slate-300'}`} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Sección de Reconocimiento y Métricas SDR (Agendadoras) */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                            Pipeline de Agendamiento y Prospección (Equipo SDR)
                        </h4>
                        <span className="text-[10px] font-bold text-slate-400">
                            Demos convocadas para el equipo AE
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div
                            onClick={() => handleToggleRepFilter('Grecia Vásquez')}
                            className={`p-3.5 rounded-2xl transition-all cursor-pointer flex items-center justify-between border ${
                                selectedRep === 'Grecia Vásquez'
                                    ? 'bg-indigo-50/80 ring-2 ring-indigo-500 border-indigo-300'
                                    : 'bg-indigo-50/40 border-indigo-100 hover:bg-indigo-50/70'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <img
                                    src={getExecutiveAvatar('Grecia Vásquez', 'Grecia Vásquez')}
                                    alt="Grecia Vásquez"
                                    className="w-10 h-10 rounded-full object-cover border border-white shadow-xs"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=Grecia+Vasquez&background=6366f1&color=fff&size=128&bold=true`;
                                    }}
                                />
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <h5 className="text-xs font-black text-slate-800">Grecia Vásquez</h5>
                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-violet-100 text-violet-700">
                                            SDR / Agendadora
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500">
                                        1 demo agendada (Luis Escobar) · Coordinada en Calendar
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                    100% Asistencia
                                </span>
                                <p className="text-[10px] text-slate-400 mt-0.5">Demostrada por Diana</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Banner de Filtro Activo */}
            {selectedRep && (
                <div className="p-3.5 rounded-2xl bg-indigo-50/90 border border-indigo-200/80 flex items-center justify-between animate-in fade-in duration-200 shadow-2xs">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                            <Filter className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-800">
                                Filtrando auditorías de: <strong className="text-indigo-700">{selectedRep}</strong>
                            </p>
                            <p className="text-[11px] text-slate-500">
                                Mostrando {displayedAudits.length} demostraciones y su diagnóstico global consolidado
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => setSelectedRep(null)}
                        className="px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-xs font-bold text-indigo-700 hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                        <X className="w-3.5 h-3.5" />
                        Quitar Filtro (Ver las {stats.totalAudits} demos)
                    </button>
                </div>
            )}

            {/* Sección de Auditorías y Diagnóstico Consolidado */}
            {stats.latestAudits.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Columna Izquierda: Lista de Auditorías (Filtrables) */}
                    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                                {selectedRep ? `Demos de ${selectedRep}` : 'Últimas Auditorías Registradas'}
                            </h4>
                            <span className="text-[11px] font-bold text-slate-400">
                                {displayedAudits.length} demo(s)
                            </span>
                        </div>

                        <div className="space-y-2 max-h-[500px] overflow-y-auto">
                            {displayedAudits.map((audit) => {
                                const isSelected = selectedAudit?.id === audit.id;
                                const badge = getScoreBadge(audit.total_score);
                                const clientTitle = audit.id.includes('luis_escobar') 
                                    ? 'Luis Escobar' 
                                    : audit.id.includes('kervin_roque') 
                                    ? 'Kervin Roque' 
                                    : audit.id.includes('finca') 
                                    ? 'Finca Miramar' 
                                    : 'Demo Arias ERP';

                                return (
                                    <div
                                        key={audit.id}
                                        onClick={() => {
                                            setSelectedAudit(audit);
                                            setActiveCoachingTab('single');
                                        }}
                                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                                            isSelected
                                                ? 'bg-indigo-50/70 border-indigo-300 shadow-xs'
                                                : 'bg-white border-slate-200/60 hover:border-slate-300 hover:bg-slate-50/50'
                                        }`}
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black text-slate-800">
                                                    {clientTitle}
                                                </span>
                                                <span className="text-xs font-bold text-slate-500">
                                                    ({audit.total_score}/100 pts)
                                                </span>
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${badge.color}`}>
                                                    {badge.text}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                                                <span className="font-semibold text-slate-700">Presentó: {audit.sales_rep_name || 'Diana Morales'}</span>
                                                {audit.sdr_rep_name && (
                                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                        Agendó: {audit.sdr_rep_name} (SDR)
                                                    </span>
                                                )}
                                                <span>·</span>
                                                <span>{new Date(audit.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>

                                        <ChevronRight className={`w-4 h-4 shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Columna Derecha: Panel de Diagnóstico (Consolidado 1:1 vs Demo Individual) */}
                    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-4">
                        {/* Selector de Pestañas de Diagnóstico */}
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-2">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setActiveCoachingTab('aggregate')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                                        activeCoachingTab === 'aggregate'
                                            ? 'bg-indigo-600 text-white shadow-xs'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    <BarChart2 className="w-3.5 h-3.5" />
                                    {selectedRep ? `Diagnóstico Global (${activeDiagnostic?.totalDemos} demos)` : 'Resumen Global'}
                                </button>

                                <button
                                    onClick={() => setActiveCoachingTab('single')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                                        activeCoachingTab === 'single'
                                            ? 'bg-indigo-600 text-white shadow-xs'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    <FileText className="w-3.5 h-3.5" />
                                    Demo Individual
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        setCoachingModalDemoId(undefined);
                                        setIsCoachingModalOpen(true);
                                    }}
                                    className="px-3 py-1.5 text-xs font-black text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-amber-300 shadow-xs"
                                    title="Ver momentos reales de Google Meet y las preguntas que debió hacer el asesor"
                                >
                                    <Lightbulb className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                    <span>💡 Ver Preguntas que Debió Hacer</span>
                                </button>

                                {activeCoachingTab === 'aggregate' && activeDiagnostic && (
                                    <button
                                        onClick={handleCopyCoachingReport}
                                        className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all flex items-center gap-1 cursor-pointer border border-indigo-100"
                                        title="Copiar informe para sesión de coaching 1:1"
                                    >
                                        {copiedPlan ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                        {copiedPlan ? 'Copiado' : 'Copiar Plan 1:1'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* PESTAÑA 1: DIAGNÓSTICO GLOBAL CONSOLIDADO (El resumen de todas las 7 o 25 demos) */}
                        {activeCoachingTab === 'aggregate' && activeDiagnostic && (
                            <div className="space-y-4 animate-in fade-in duration-200">
                                {/* Encabezado del Diagnóstico Consolidado */}
                                <div className="flex items-center justify-between bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">
                                            Radiografía Consolidada de Auditorías
                                        </span>
                                        <h4 className="text-sm font-black text-slate-800">
                                            {activeDiagnostic.repName} · {activeDiagnostic.totalDemos} demostraciones analizadas
                                        </h4>
                                    </div>
                                    <div className="text-right">
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${getScoreBadge(activeDiagnostic.avgScore).color}`}>
                                            Promedio: {activeDiagnostic.avgScore} / 100
                                        </span>
                                    </div>
                                </div>

                                {/* Caja Roja: Errores Sistémicos Recurrentes */}
                                <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-100 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-black uppercase text-rose-800 flex items-center gap-1.5">
                                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                            Brechas Críticas Recurrentes (¿Dónde falla repetidamente?)
                                        </span>
                                    </div>

                                    {activeDiagnostic.topGaps.length === 0 ? (
                                        <p className="text-xs text-rose-700">No se detectaron fallas repetitivas en las demos evaluadas.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {activeDiagnostic.topGaps.map((gap, idx) => (
                                                <div key={idx} className="bg-white/80 p-2.5 rounded-xl border border-rose-200/60 text-xs space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <strong className="text-slate-900 font-black">{idx + 1}. {gap.name}</strong>
                                                        <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-rose-100 text-rose-700">
                                                            Falló en {gap.failCount} de {activeDiagnostic.totalDemos} demos ({gap.percentage}%)
                                                        </span>
                                                    </div>
                                                    <p className="text-slate-600 text-[11px]">
                                                        ↳ <span className="font-semibold text-rose-700">Corrección ARIAS:</span> {gap.recommendation}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Caja Verde: Fortalezas Demostradas */}
                                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100 space-y-2">
                                    <span className="text-[11px] font-black uppercase text-emerald-800 flex items-center gap-1.5">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        Fortalezas Demostradas (Lo que hace excelente de forma consistente)
                                    </span>

                                    <div className="space-y-1.5">
                                        {activeDiagnostic.topStrengths.map((str, idx) => (
                                            <div key={idx} className="flex items-center justify-between text-xs bg-white/80 p-2 rounded-xl border border-emerald-200/60">
                                                <span className="text-slate-800 font-bold">✓ {str.name}</span>
                                                <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                                    {str.passCount} de {activeDiagnostic.totalDemos} demos ({str.percentage}% éxito)
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Caja Púrpura: Roleplay de 7 Minutos */}
                                <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-1 text-xs">
                                    <span className="text-[10px] font-black uppercase text-indigo-700 flex items-center gap-1">
                                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                        Roleplay Recomendado para el 1:1 Semanal (7 minutos)
                                    </span>
                                    <p className="text-slate-800 font-medium">
                                        {activeDiagnostic.roleplayFocus}
                                    </p>
                                </div>

                                {/* Caja Ámbar: Acción Inmediata de Rescate */}
                                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100 space-y-1 text-xs">
                                    <span className="text-[10px] font-black uppercase text-amber-800 flex items-center gap-1">
                                        <Target className="w-3.5 h-3.5 text-amber-600" />
                                        Acción Inmediata Prioritaria
                                    </span>
                                    <p className="text-slate-800 font-medium">
                                        {activeDiagnostic.actionRequired}
                                    </p>
                                </div>

                                {/* Desglose Visual de los 9 Criterios Oficiales */}
                                <div className="space-y-2 pt-2 border-t border-slate-100">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                        Tasa de Cumplimiento por Criterio Oficial (Rúbrica de 100 pts)
                                    </span>
                                    <div className="space-y-1.5">
                                        {activeDiagnostic.criteriaStats.map(crit => (
                                            <div key={crit.id} className="text-xs space-y-0.5">
                                                <div className="flex items-center justify-between text-[11px]">
                                                    <span className="text-slate-700 font-semibold truncate max-w-[260px]">{crit.name}</span>
                                                    <span className={`font-black ${crit.passRate >= 70 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        {crit.passRate}% ({crit.passCount}/{activeDiagnostic.totalDemos})
                                                    </span>
                                                </div>
                                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${crit.passRate >= 70 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                                        style={{ width: `${crit.passRate}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* PESTAÑA 2: DETALLE DE DEMO INDIVIDUAL */}
                        {activeCoachingTab === 'single' && selectedAudit && (
                            <div className="space-y-4 animate-in fade-in duration-200">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">
                                                Auditoría Individual
                                            </span>
                                            {selectedAudit.sdr_rep_name && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                                    Agendada por {selectedAudit.sdr_rep_name} (SDR)
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="text-sm font-black text-slate-800">
                                            {selectedAudit.sales_rep_name || 'Diana Morales'} · {selectedAudit.total_score} / 100 puntos
                                        </h4>
                                        {selectedAudit.sdr_rep_name && (
                                            <p className="text-[11px] text-slate-500 mt-0.5">
                                                Evaluación técnica de la presentación en Meet conducida por <strong>{selectedAudit.sales_rep_name} (AE)</strong>. Cita generada por <strong>{selectedAudit.sdr_rep_name} (SDR)</strong>.
                                            </p>
                                        )}
                                    </div>
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${getScoreBadge(selectedAudit.total_score).color}`}>
                                        {getScoreBadge(selectedAudit.total_score).text}
                                    </span>
                                </div>

                                <div className="space-y-3 text-xs">
                                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 space-y-1">
                                        <span className="text-[10px] font-black uppercase text-emerald-700">
                                            Fortaleza Observable en esta Demo
                                        </span>
                                        <p className="text-slate-700 font-medium">
                                            {selectedAudit.coaching_summary.strength}
                                        </p>
                                    </div>

                                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 space-y-1">
                                        <span className="text-[10px] font-black uppercase text-rose-700">
                                            Falla Crítica Observable en esta Demo
                                        </span>
                                        <p className="text-slate-700 font-medium">
                                            {selectedAudit.coaching_summary.critical_gap}
                                        </p>
                                    </div>

                                    <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 space-y-1">
                                        <span className="text-[10px] font-black uppercase text-indigo-700">
                                            Roleplay Recomendado (7 minutos)
                                        </span>
                                        <p className="text-slate-700 font-medium">
                                            {selectedAudit.coaching_summary.recommended_roleplay}
                                        </p>
                                    </div>

                                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 space-y-1">
                                        <span className="text-[10px] font-black uppercase text-amber-700">
                                            Acción Inmediata de Rescate
                                        </span>
                                        <p className="text-slate-700 font-medium">
                                            {selectedAudit.coaching_summary.immediate_action}
                                        </p>
                                    </div>

                                    <div className="pt-2">
                                        <button
                                            onClick={() => {
                                                setCoachingModalDemoId(selectedAudit.id);
                                                setIsCoachingModalOpen(true);
                                            }}
                                            className="w-full py-2.5 px-4 text-xs font-black text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                                        >
                                            <Lightbulb className="w-4 h-4 text-amber-600" />
                                            <span>Ver Oportunidades & Preguntas para esta Demo</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal de Oportunidades Reales & Preguntas Clave (Coach de Ventas ARIAS) */}
            <RealCoachingOpportunitiesModal
                isOpen={isCoachingModalOpen}
                onClose={() => setIsCoachingModalOpen(false)}
                repName={selectedRep || (selectedAudit?.sales_rep_name || 'Diana Morales')}
                repAvatar={getExecutiveAvatar(selectedRep || 'Diana Morales', selectedRep || 'Diana Morales')}
                totalDemos={activeDiagnostic?.totalDemos || 7}
                avgScore={activeDiagnostic?.avgScore || 36}
                initialDemoId={coachingModalDemoId}
            />
        </div>
    );
};
