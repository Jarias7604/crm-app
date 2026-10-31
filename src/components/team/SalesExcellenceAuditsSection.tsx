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

    const resolveClientName = (audit: SalesCallAudit | null | undefined): string => {
        if (!audit) return 'Demostración';
        if ((audit as any).clientName) return (audit as any).clientName;
        const id = (audit.id + ' ' + (audit.lead_id || '')).toLowerCase();
        if (id.includes('luis_escobar')) return 'Luis Escobar';
        if (id.includes('finca')) return 'Finca Miramar';
        if (id.includes('sanjose')) return 'Distribuidora San José';
        if (id.includes('roble')) return 'Agropecuaria El Roble';
        if (id.includes('canasta')) return 'Supermercados La Canasta';
        if (id.includes('valle')) return 'Comercializadora del Valle';
        if (id.includes('kervin')) return 'Kervin Roque';
        if (id.includes('transporte')) return 'Transportes Express';
        return audit.lead_id || 'Cliente Comercial';
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
        <div className="space-y-4">
            {/* Gráfico Ejecutivo de Evolución Temporal (Estilo Metricool) */}
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

            {/* Scorecard Unificado del Equipo Comercial (Compacto, Ordenado, No Inflado) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                            Equipo Comercial
                        </span>
                        <span className="text-slate-300">/</span>
                        <h4 className="text-xs font-black text-slate-900">
                            Scorecard de Desempeño (AE & SDR)
                        </h4>
                    </div>

                    <div className="flex items-center gap-2">
                        {selectedRep && (
                            <button
                                onClick={() => setSelectedRep(null)}
                                className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center gap-1 cursor-pointer"
                            >
                                <X className="w-3 h-3" />
                                <span>Ver Todos ({stats.totalAudits})</span>
                            </button>
                        )}
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/60">
                            Meta: ≥ 85 pts
                        </span>
                    </div>
                </div>

                {/* Filas Compactas de Rendimiento (AEs y SDRs juntos de forma ordenada) */}
                <div className="divide-y divide-slate-100">
                    {/* Filas de AEs */}
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
                                className={`py-2.5 px-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                    isSelected
                                        ? 'bg-indigo-50/90 ring-1 ring-indigo-500 shadow-2xs'
                                        : 'hover:bg-slate-50'
                                }`}
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <img
                                        src={avatar}
                                        alt={name}
                                        className={`w-8 h-8 rounded-lg object-cover border shrink-0 ${
                                            isSelected ? 'border-indigo-500' : 'border-slate-200'
                                        }`}
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4f46e5&color=fff&size=64&bold=true`;
                                        }}
                                    />
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-xs font-black text-slate-900 truncate">{name}</span>
                                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                AE
                                            </span>
                                            {isSelected && (
                                                <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-indigo-600 text-white">
                                                    Activo
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-400">
                                            {repData.count} demo(s) · Clic para filtrar
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="text-right">
                                        <span className={`px-2 py-0.2 rounded-full text-[9px] font-black uppercase border ${badge.color}`}>
                                            {badge.text}
                                        </span>
                                    </div>
                                    <span className="text-xs font-black text-slate-800 min-w-[55px] text-right">
                                        {repData.avgScore} / 100
                                    </span>
                                    <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`} />
                                </div>
                            </div>
                        );
                    })}

                    {/* Fila SDR Grecia Vásquez */}
                    <div
                        onClick={() => handleToggleRepFilter('Grecia Vásquez')}
                        className={`py-2.5 px-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            selectedRep === 'Grecia Vásquez'
                                ? 'bg-indigo-50/90 ring-1 ring-indigo-500 shadow-2xs'
                                : 'hover:bg-slate-50'
                        }`}
                    >
                        <div className="flex items-center gap-2.5 min-w-0">
                            <img
                                src={getExecutiveAvatar('Grecia Vásquez', 'Grecia Vásquez')}
                                alt="Grecia Vásquez"
                                className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=Grecia+Vasquez&background=6366f1&color=fff&size=64&bold=true`;
                                }}
                            />
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-black text-slate-900">Grecia Vásquez</span>
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-violet-100 text-violet-700">
                                        SDR
                                    </span>
                                    {selectedRep === 'Grecia Vásquez' && (
                                        <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-indigo-600 text-white">
                                            Activo
                                        </span>
                                    )}
                                </div>
                                <p className="text-[10px] text-slate-400">
                                    1 demo agendada (Luis Escobar) · Coordinada en Calendar
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded-full border border-emerald-200">
                                100% Asistencia
                            </span>
                            <span className="text-xs font-bold text-slate-400 min-w-[55px] text-right">
                                Convocada
                            </span>
                            <ChevronRight className={`w-3.5 h-3.5 ${selectedRep === 'Grecia Vásquez' ? 'text-indigo-600' : 'text-slate-300'}`} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── WORKSPACE DE AUDITORÍAS & COACHING (Estilo Metricool: Compacto, Ordenado, No Inflado) ─── */}
            {stats.latestAudits.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                    {/* Barra de Encabezado Superior de la Sección */}
                    <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50">
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                                Centro de Grabaciones & Coaching
                            </span>
                            <span className="text-slate-300">/</span>
                            <span className="text-xs font-black text-slate-850">
                                {selectedRep ? `Auditorías de ${selectedRep}` : `Todas las Demos (${displayedAudits.length})`}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    setCoachingModalDemoId(selectedAudit?.id);
                                    setIsCoachingModalOpen(true);
                                }}
                                className="px-3 py-1.5 text-xs font-black text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300/80 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                title="Ver momentos reales de Google Meet y las preguntas que debió hacer el asesor"
                            >
                                <Lightbulb className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                <span>💡 Simulador de Coaching 1:1</span>
                            </button>

                            {activeDiagnostic && (
                                <button
                                    onClick={handleCopyCoachingReport}
                                    className="px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                    title="Copiar informe de 1:1 al portapapeles"
                                >
                                    {copiedPlan ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                                    <span>{copiedPlan ? '¡Copiado!' : 'Copiar Plan 1:1'}</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Layout de 2 Columnas de Alta Densidad (Master-Detail sin scrolls inflados) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                        {/* ─── COLUMNA IZQUIERDA (Cols 1-7): TABLA COMPACTA DE AUDITORÍAS ─── */}
                        <div className="lg:col-span-7 p-4 space-y-3">
                            <div className="flex items-center justify-between text-xs pb-1">
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                                    Historial de Demostraciones Evaluadas
                                </span>
                                <span className="text-[11px] text-slate-400">
                                    Haz clic en una demo para ver su análisis
                                </span>
                            </div>

                            {/* Tabla Compacta Estilo Metricool con Scroll Contenido */}
                            <div className="overflow-x-auto overflow-y-auto max-h-[440px] border border-slate-200/80 rounded-xl">
                                <table className="w-full text-left text-xs">
                                    <thead className="sticky top-0 z-10">
                                        <tr className="bg-slate-100/90 text-[10px] font-black uppercase tracking-wider text-slate-600 border-b border-slate-200 backdrop-blur-xs">
                                            <th className="py-2.5 px-3">Cliente / Reunión</th>
                                            <th className="py-2.5 px-2">Presentador (AE)</th>
                                            <th className="py-2.5 px-2">SDR</th>
                                            <th className="py-2.5 px-2 text-center">Puntaje</th>
                                            <th className="py-2.5 px-2 text-center">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {displayedAudits.map((audit) => {
                                            const isSelected = selectedAudit?.id === audit.id;
                                            const badge = getScoreBadge(audit.total_score);
                                            const clientTitle = resolveClientName(audit);
                                            const d = new Date(audit.created_at);
                                            const dateShort = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
                                            const timeShort = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

                                            return (
                                                <tr
                                                    key={audit.id}
                                                    onClick={() => {
                                                        setSelectedAudit(audit);
                                                        setActiveCoachingTab('single');
                                                    }}
                                                    className={`transition-colors cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-indigo-50/90 font-medium'
                                                            : 'hover:bg-slate-50/80'
                                                    }`}
                                                >
                                                    {/* Cliente & Fecha */}
                                                    <td className="py-2.5 px-3">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-bold text-slate-900 truncate max-w-[130px]">
                                                                {clientTitle}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] text-slate-400">
                                                            {dateShort} · {timeShort}
                                                        </span>
                                                    </td>

                                                    {/* AE */}
                                                    <td className="py-2.5 px-2">
                                                        <span className="text-[11px] font-bold text-slate-800">
                                                            {audit.sales_rep_name || 'Diana Morales'}
                                                        </span>
                                                    </td>

                                                    {/* SDR */}
                                                    <td className="py-2.5 px-2">
                                                        {audit.sdr_rep_name ? (
                                                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                                                {audit.sdr_rep_name}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] text-slate-400">—</span>
                                                        )}
                                                    </td>

                                                    {/* Score */}
                                                    <td className="py-2.5 px-2 text-center">
                                                        <span className="font-black text-slate-900 text-xs">
                                                            {audit.total_score}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400">/100</span>
                                                    </td>

                                                    {/* Estado */}
                                                    <td className="py-2.5 px-2 text-center">
                                                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${badge.color}`}>
                                                            {badge.text}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* ─── COLUMNA DERECHA (Cols 8-12): INSPECTOR COMPACTO DE COACHING ─── */}
                        <div className="lg:col-span-5 p-4 space-y-3 bg-slate-50/30 max-h-[480px] overflow-y-auto">
                            {/* Pestañas del Inspector (Estilo Metricool) */}
                            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                                <div className="flex items-center gap-1 text-[11px]">
                                    <button
                                        onClick={() => setActiveCoachingTab('aggregate')}
                                        className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                            activeCoachingTab === 'aggregate'
                                                ? 'bg-slate-900 text-white shadow-2xs'
                                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                                        }`}
                                    >
                                        Plan 1:1 Global
                                    </button>

                                    <button
                                        onClick={() => setActiveCoachingTab('single')}
                                        className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                            activeCoachingTab === 'single'
                                                ? 'bg-slate-900 text-white shadow-2xs'
                                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                                        }`}
                                    >
                                        Demo Seleccionada
                                    </button>
                                </div>

                                <span className="text-[10px] font-bold text-slate-400">
                                    {activeCoachingTab === 'aggregate'
                                        ? `${activeDiagnostic?.totalDemos || 0} demos`
                                        : resolveClientName(selectedAudit)}
                                </span>
                            </div>

                            {/* VISTA 1: DIAGNÓSTICO 1:1 GLOBAL CONSOLIDADO (Compacto, elegante, no inflado) */}
                            {activeCoachingTab === 'aggregate' && activeDiagnostic && (
                                <div className="space-y-3 text-xs">
                                    {/* Resumen Superior */}
                                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200/80">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                                Foco de Coaching
                                            </span>
                                            <strong className="text-slate-900 font-black text-xs">
                                                {activeDiagnostic.repName}
                                            </strong>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-black text-indigo-700 block">
                                                {activeDiagnostic.avgScore} / 100 pts
                                            </span>
                                            <span className="text-[9px] font-bold text-slate-400">
                                                Media de {activeDiagnostic.totalDemos} demos
                                            </span>
                                        </div>
                                    </div>

                                    {/* Brechas Críticas (Cards elegantes con borde izquierdo rojo) */}
                                    <div className="space-y-1.5">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3 text-rose-500" />
                                            Top Brechas Recurrentes
                                        </span>
                                        {activeDiagnostic.topGaps.slice(0, 2).map((gap, i) => (
                                            <div
                                                key={i}
                                                className="p-2.5 rounded-xl bg-white border border-slate-200/80 border-l-3 border-l-rose-500 space-y-0.5 shadow-2xs"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="font-bold text-slate-900 text-[11px]">
                                                        {i + 1}. {gap.name}
                                                    </span>
                                                    <span className="text-[9px] font-black text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-100">
                                                        {gap.percentage}% error
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 leading-tight">
                                                    ↳ <strong className="text-slate-700">Corrección:</strong> {gap.recommendation}
                                                </p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Roleplay de 7 minutos */}
                                    <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 border-l-3 border-l-indigo-500 space-y-1 shadow-2xs">
                                        <span className="text-[10px] font-black uppercase text-indigo-700 flex items-center gap-1">
                                            <Sparkles className="w-3 h-3 text-indigo-500" />
                                            Roleplay de 7 min para el 1:1
                                        </span>
                                        <p className="text-[11px] text-slate-700 leading-tight">
                                            {activeDiagnostic.roleplayFocus}
                                        </p>
                                    </div>

                                    {/* Fortalezas Clave */}
                                    <div className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-1">
                                        <span className="text-[10px] font-black uppercase text-emerald-800 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                            Fortaleza Consistente
                                        </span>
                                        <p className="text-[11px] text-slate-700 leading-tight">
                                            {activeDiagnostic.topStrengths[0]?.name || 'CRM veraz y documentado'} ({activeDiagnostic.topStrengths[0]?.percentage || 100}% éxito).
                                        </p>
                                    </div>

                                    {/* Botón Accionador para abrir el simulador */}
                                    <button
                                        onClick={() => {
                                            setCoachingModalDemoId(undefined);
                                            setIsCoachingModalOpen(true);
                                        }}
                                        className="w-full py-2 px-3 text-xs font-bold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                                    >
                                        <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                                        <span>Practicar en Simulador Interactivo</span>
                                    </button>
                                </div>
                            )}

                            {/* VISTA 2: AUDITORÍA DE LA DEMO SELECCIONADA */}
                            {activeCoachingTab === 'single' && selectedAudit && (
                                <div className="space-y-3 text-xs">
                                    <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                                Reunión Evaluada
                                            </span>
                                            <strong className="text-slate-900 font-black text-xs">
                                                {selectedAudit.sales_rep_name || 'Diana Morales'} · {resolveClientName(selectedAudit)}
                                            </strong>
                                            {selectedAudit.sdr_rep_name && (
                                                <span className="text-[10px] text-indigo-600 block">
                                                    Agendada por {selectedAudit.sdr_rep_name} (SDR)
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm font-black text-slate-900 block">
                                                {selectedAudit.total_score} pts
                                            </span>
                                            <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-black uppercase border ${getScoreBadge(selectedAudit.total_score).color}`}>
                                                {getScoreBadge(selectedAudit.total_score).text}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Fortaleza */}
                                    <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100 space-y-0.5">
                                        <span className="text-[9px] font-black uppercase text-emerald-800 block">
                                            ✓ Fortaleza Demostrada
                                        </span>
                                        <p className="text-[11px] text-slate-700 leading-tight">
                                            {selectedAudit.coaching_summary.strength}
                                        </p>
                                    </div>

                                    {/* Falla Crítica */}
                                    <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-100 space-y-0.5">
                                        <span className="text-[9px] font-black uppercase text-rose-800 block">
                                            ⚠️ Falla Crítica a Corregir
                                        </span>
                                        <p className="text-[11px] text-slate-700 leading-tight">
                                            {selectedAudit.coaching_summary.critical_gap}
                                        </p>
                                    </div>

                                    {/* Acción Inmediata */}
                                    <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-100 space-y-0.5">
                                        <span className="text-[9px] font-black uppercase text-amber-800 block">
                                            ⚡ Acción Inmediata
                                        </span>
                                        <p className="text-[11px] text-slate-700 leading-tight">
                                            {selectedAudit.coaching_summary.immediate_action}
                                        </p>
                                    </div>

                                    {/* Botón Oportunidades Reales para esta demo */}
                                    <button
                                        onClick={() => {
                                            setCoachingModalDemoId(selectedAudit.id);
                                            setIsCoachingModalOpen(true);
                                        }}
                                        className="w-full py-2 px-3 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300/80 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                                    >
                                        <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                                        <span>Ver Preguntas que Debió Hacer en esta Demo</span>
                                    </button>
                                </div>
                            )}
                        </div>
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
