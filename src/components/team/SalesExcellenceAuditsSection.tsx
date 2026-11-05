// src/components/team/SalesExcellenceAuditsSection.tsx
// Panel de Auditoría y Calidad Comercial ARIAS para TeamPerformance
// Con Filtro Estricto por Título de Documento (Google Drive / Gemini) y Diagnóstico Global Consolidado 1:1

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Award, ShieldAlert, CheckCircle2, TrendingUp, Users, Calendar,
    ExternalLink, Sparkles, Flame, ChevronRight, FileText, Target,
    Filter, X, Copy, Check, BarChart2, AlertTriangle, Layers, ArrowRight,
    Lightbulb, DollarSign, RefreshCw, Plus, Search
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
    const navigate = useNavigate();
    const [selectedAudit, setSelectedAudit] = useState<SalesCallAudit | null>(null);
    const [selectedRep, setSelectedRep] = useState<string | null>(null);
    const [leadStatusFilter, setLeadStatusFilter] = useState<'all' | 'Cerrado' | 'Negociación' | 'En seguimiento' | 'Perdido'>('all');
    const [activeCoachingTab, setActiveCoachingTab] = useState<'aggregate' | 'single'>('aggregate');
    const [copiedPlan, setCopiedPlan] = useState(false);
    const [isCoachingModalOpen, setIsCoachingModalOpen] = useState(false);
    const [coachingModalDemoId, setCoachingModalDemoId] = useState<string | undefined>(undefined);
    const [isSyncing, setIsSyncing] = useState(false);

    // Filtro por Título de Documento en Google Drive / Gemini
    const [documentTitleKeyword, setDocumentTitleKeyword] = useState<string>(() => {
        return salesAuditService.getDemoTitleFilterConfig(companyId).requiredKeyword || 'DEMO';
    });
    const [activeDocumentTitleKeyword, setActiveDocumentTitleKeyword] = useState<string>(() => {
        return salesAuditService.getDemoTitleFilterConfig(companyId).requiredKeyword || 'DEMO';
    });

    const [isQuickAuditModalOpen, setIsQuickAuditModalOpen] = useState(false);
    const [quickDocumentTitle, setQuickDocumentTitle] = useState('');
    const [quickClientName, setQuickClientName] = useState('');
    const [quickRepName, setQuickRepName] = useState('Patricia Martínez');
    const [quickSdrName, setQuickSdrName] = useState('');
    const [quickDemoDate, setQuickDemoDate] = useState(() => new Date().toISOString().slice(0, 16));
    const [quickLeadStatus, setQuickLeadStatus] = useState<string>('Negociación');
    const [quickDealValue, setQuickDealValue] = useState<string>('1200');
    const [quickGoogleDocUrl, setQuickGoogleDocUrl] = useState('');
    const [quickNotes, setQuickNotes] = useState('');
    const [isSavingQuickAudit, setIsSavingQuickAudit] = useState(false);

    // Resuelve la foto de perfil oficial o avatar ejecutivo de alta resolución
    const getExecutiveAvatar = (repKey: string, displayName: string): string => {
        if (profileAvatars[repKey]) return profileAvatars[repKey]!;
        if (profileAvatars[displayName]) return profileAvatars[displayName]!;
        if (profileAvatars[displayName.toLowerCase().trim()]) return profileAvatars[displayName.toLowerCase().trim()]!;

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

        if (cleanName.includes('diana') || cleanKey.includes('diana')) {
            return 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80';
        }
        if (cleanName.includes('grecia') || cleanKey.includes('grecia')) {
            return 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80';
        }
        if (cleanName.includes('patricia') || cleanKey.includes('patricia')) {
            return 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80';
        }

        return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || 'User')}&background=4f46e5&color=fff&size=128&bold=true`;
    };

    useEffect(() => {
        if (companyId) {
            const cfg = salesAuditService.getDemoTitleFilterConfig(companyId);
            setDocumentTitleKeyword(cfg.requiredKeyword || 'DEMO');
            setActiveDocumentTitleKeyword(cfg.requiredKeyword || 'DEMO');
            loadStats();
        }

        const handleUpdate = () => {
            loadStats();
        };

        window.addEventListener('sales_audit_updated', handleUpdate);
        return () => window.removeEventListener('sales_audit_updated', handleUpdate);
    }, [companyId]);

    const loadStats = async (showToast = false, customKeyword?: string) => {
        if (showToast) setIsSyncing(true);
        else setLoading(true);
        try {
            const data = await salesAuditService.getCompanyAuditStats(companyId);
            setStats(data);
            if (data.latestAudits.length > 0) {
                setSelectedAudit(prev => {
                    if (prev) {
                        const found = data.latestAudits.find(a => a.id === prev.id);
                        if (found) return found;
                    }
                    return data.latestAudits[0];
                });
            } else {
                setSelectedAudit(null);
            }
            if (showToast) {
                const kwLabel = customKeyword || activeDocumentTitleKeyword || 'DEMO';
                toast.success(
                    `Sincronizados ${data.totalAudits} documento(s) con título "${kwLabel}" desde Google Drive & Meet`
                );
            }
        } catch (e) {
            console.error('Error loading audit stats', e);
            if (showToast) toast.error('Error al sincronizar demostraciones');
        } finally {
            setLoading(false);
            setIsSyncing(false);
        }
    };

    const handleApplyDocumentTitleFilter = async (overrideKeyword?: string) => {
        const cleanVal = (overrideKeyword !== undefined ? overrideKeyword : documentTitleKeyword).trim() || 'DEMO';
        setDocumentTitleKeyword(cleanVal);
        setActiveDocumentTitleKeyword(cleanVal);
        salesAuditService.saveDemoTitleFilterConfig(companyId, {
            requiredKeyword: cleanVal,
            onlyDemosFilter: true
        });
        await loadStats(true, cleanVal);
    };

    const handleSaveQuickAudit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!quickClientName.trim()) {
            toast.error('Ingresa el nombre del cliente o empresa de la demostración');
            return;
        }
        setIsSavingQuickAudit(true);
        try {
            const mainKeyword = (activeDocumentTitleKeyword.split(',')[0] || 'DEMO').trim();
            const effectiveDocTitle =
                quickDocumentTitle.trim() ||
                `${mainKeyword} - ${quickClientName.trim()} - Notas de Gemini`;
            const effectiveNotes =
                quickNotes.trim() ||
                `Documento ${effectiveDocTitle}. Demostración comercial con ${quickClientName.trim()} presentada por ${quickRepName}. Evaluación de requerimientos, presentación de módulos y seguimiento de propuesta.`;
            const evaluation = await salesAuditService.auditGeminiNotes(
                effectiveNotes,
                quickClientName.trim(),
                quickRepName
            );
            const isoDate = quickDemoDate ? new Date(quickDemoDate).toISOString() : new Date().toISOString();
            await salesAuditService.saveAudit({
                company_id: localStorage.getItem('simulated_company_id') || companyId,
                lead_id: `lead_${quickClientName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
                clientName: quickClientName.trim(),
                documentTitle: effectiveDocTitle,
                sales_rep_name: quickRepName,
                sdr_rep_name: quickSdrName.trim() || null,
                lead_status: quickLeadStatus,
                deal_value: Number(quickDealValue) || 0,
                google_doc_url: quickGoogleDocUrl.trim() || null,
                meeting_notes_raw: effectiveNotes,
                total_score: evaluation.totalScore,
                rubric_scores: evaluation.rubricScores,
                coaching_summary: evaluation.coachingSummary,
                extracted_data: evaluation.extractedData,
                status: 'completed',
                created_at: isoDate
            });
            toast.success(`Documento "${effectiveDocTitle}" auditado (${evaluation.totalScore}/100 pts)`);
            setIsQuickAuditModalOpen(false);
            setQuickDocumentTitle('');
            setQuickClientName('');
            setQuickNotes('');
            setQuickGoogleDocUrl('');
            await loadStats(false);
        } catch (err) {
            console.error('Error saving quick audit', err);
            toast.error('No se pudo guardar la auditoría');
        } finally {
            setIsSavingQuickAudit(false);
        }
    };

    const getScoreBadge = (score: number) => {
        if (score >= 85) return { color: 'text-emerald-600 bg-emerald-50 border-emerald-200', text: '🟢 Sólido' };
        if (score >= 70) return { color: 'text-amber-600 bg-amber-50 border-amber-200', text: '🟡 Coaching' };
        return { color: 'text-rose-600 bg-rose-50 border-rose-200', text: '🔴 Intervención' };
    };

    const resolveClientName = (audit: SalesCallAudit | null | undefined): string => {
        if (!audit) return 'Demostración';
        if ((audit as any).companyName) return (audit as any).companyName;
        if ((audit as any).clientName) return (audit as any).clientName;
        const id = (audit.id + ' ' + (audit.lead_id || '')).toLowerCase();
        if (id.includes('luis_escobar')) return 'Minisúper Escobar';
        if (id.includes('finca')) return 'Finca Miramar';
        if (id.includes('sanjose')) return 'Distribuidora San José';
        if (id.includes('roble')) return 'Agropecuaria El Roble';
        if (id.includes('canasta')) return 'Supermercados La Canasta';
        if (id.includes('valle')) return 'Comercializadora del Valle';
        if (id.includes('kervin')) return 'Kervin Roque (Servicios)';
        if (id.includes('transporte')) return 'Transportes Express';
        return audit.lead_id || 'Cliente Comercial';
    };

    const resolveContactPerson = (audit: SalesCallAudit | null | undefined): string => {
        if (!audit) return 'Contacto Comercial';
        if ((audit as any).contactPerson) return String((audit as any).contactPerson);
        const cName = resolveClientName(audit).toLowerCase();
        if (cName.includes('cartopa')) return 'José Durán';
        if (cName.includes('kervin')) return 'Kervin Roque';
        if (cName.includes('escobar')) return 'Luis Escobar';
        if (cName.includes('transporte')) return 'Encargado Operativo (Sin decisor)';
        if (cName.includes('finca')) return 'Gerencia Agrícola Miramar';
        return (audit as any).clientName || 'Contacto del Lead';
    };

    const resolveDocumentTitle = (audit: SalesCallAudit | null | undefined): string => {
        if (!audit) return 'DEMO - Notas de Gemini';
        if ((audit as any).documentTitle) return String((audit as any).documentTitle);
        const cName = resolveClientName(audit);
        return `DEMO - ${cName} - Notas de Gemini`;
    };

    const handleOpenLeadInCrm = (audit: SalesCallAudit | null | undefined) => {
        if (!audit) {
            navigate('/leads');
            return;
        }
        const clientName = resolveClientName(audit);
        const contactPerson = resolveContactPerson(audit);
        navigate('/leads', {
            state: {
                leadId: audit.lead_id,
                clientName,
                contactPerson,
                fromPerformance: true,
                _t: Date.now()
            }
        });
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
                  return (
                      name.includes(cleanTarget) ||
                      cleanTarget.includes(name) ||
                      sdr.includes(cleanTarget) ||
                      id === cleanTarget
                  );
              });

        if (repAudits.length === 0) return null;

        const totalDemos = repAudits.length;
        const avgScore = Math.round(repAudits.reduce((acc, a) => acc + a.total_score, 0) / totalDemos);

        const criteriaMap: Record<
            string,
            {
                id: string;
                name: string;
                maxPoints: number;
                passCount: number;
                coachingCount: number;
                failCount: number;
                quotes: string[];
                recommendation: string;
            }
        > = {};

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

        const sortedByPass = [...criteriaStats].sort((a, b) => b.passRate - a.passRate);
        const topStrengths = sortedByPass
            .filter(c => c.passCount > 0)
            .slice(0, 3)
            .map(c => ({
                name: c.name,
                passCount: c.passCount,
                percentage: c.passRate
            }));

        let roleplayFocus = 'Roleplay general de estructura de demo y descubrimiento BANT.';
        if (
            topGaps.some(
                g =>
                    g.name.toLowerCase().includes('próximo paso') ||
                    g.name.toLowerCase().includes('decisión') ||
                    g.name.toLowerCase().includes('agenda')
            )
        ) {
            roleplayFocus =
                'Roleplay de Cierre y Agendamiento (7 min): Cierre condicionado y cómo abrir Google Calendar en vivo antes de colgar.';
        } else if (
            topGaps.some(
                g =>
                    g.name.toLowerCase().includes('impacto') ||
                    g.name.toLowerCase().includes('cuantificado') ||
                    g.name.toLowerCase().includes('diagnóstico')
            )
        ) {
            roleplayFocus =
                'Roleplay de Diagnóstico Financiero (7 min): Preguntar cuántas horas o dólares le cuesta hoy el dolor al cliente.';
        } else if (topGaps.some(g => g.name.toLowerCase().includes('objeciones'))) {
            roleplayFocus =
                'Roleplay de Manejo de Objeciones (7 min): Método ESCUCHAR sin regalar descuentos ni promesas prematuras.';
        }

        const actionRequired =
            topGaps.length > 0
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

    const handleToggleRepFilter = (name: string | null) => {
        if (!name || selectedRep === name) {
            setSelectedRep(null);
            setActiveCoachingTab('aggregate');
        } else {
            setSelectedRep(name);
            setActiveCoachingTab('aggregate');
            const repFirst = stats.latestAudits.find(
                a =>
                    (a.sales_rep_name || '').toLowerCase().includes(name.toLowerCase()) ||
                    (a.sdr_rep_name || '').toLowerCase().includes(name.toLowerCase())
            );
            if (repFirst) setSelectedAudit(repFirst);
        }
    };

    const dealStats = useMemo(() => {
        const auditsToCount = selectedRep
            ? stats.latestAudits.filter(a => {
                  const cleanRep = selectedRep.toLowerCase().trim();
                  const repName = (a.sales_rep_name || '').toLowerCase().trim();
                  const sdrName = (a.sdr_rep_name || '').toLowerCase().trim();
                  const evalId = (a.evaluated_user_id || '').toLowerCase().trim();
                  return (
                      repName.includes(cleanRep) ||
                      cleanRep.includes(repName) ||
                      sdrName.includes(cleanRep) ||
                      evalId === cleanRep
                  );
              })
            : stats.latestAudits;

        const total = auditsToCount.length;
        const closed = auditsToCount.filter(a => a.lead_status === 'Cerrado' || a.lead_status === 'Cliente');
        const closedCount = closed.length;
        const closedAmount = closed.reduce((sum, a) => sum + (a.deal_value || 0), 0);
        const inNegotiation = auditsToCount.filter(a => a.lead_status === 'Negociación');
        const inNegotiationCount = inNegotiation.length;
        const inNegotiationAmount = inNegotiation.reduce((sum, a) => sum + (a.deal_value || 0), 0);
        const followUp = auditsToCount.filter(
            a => a.lead_status === 'En seguimiento' || a.lead_status === 'Lead calificado'
        );
        const followUpCount = followUp.length;
        const lost = auditsToCount.filter(a => a.lead_status === 'Perdido');
        const lostCount = lost.length;
        const winRate = total > 0 ? Math.round((closedCount / total) * 100) : 0;

        return {
            total,
            closedCount,
            closedAmount,
            inNegotiationCount,
            inNegotiationAmount,
            followUpCount,
            lostCount,
            winRate
        };
    }, [stats.latestAudits, selectedRep]);

    const displayedAudits = stats.latestAudits.filter(a => {
        if (selectedRep) {
            const cleanRep = selectedRep.toLowerCase().trim();
            const repName = (a.sales_rep_name || '').toLowerCase().trim();
            const sdrName = (a.sdr_rep_name || '').toLowerCase().trim();
            const evalId = (a.evaluated_user_id || '').toLowerCase().trim();
            const matchRep =
                repName.includes(cleanRep) ||
                cleanRep.includes(repName) ||
                sdrName.includes(cleanRep) ||
                evalId === cleanRep;
            if (!matchRep) return false;
        }

        if (leadStatusFilter === 'all') return true;
        if (leadStatusFilter === 'Cerrado') return a.lead_status === 'Cerrado' || a.lead_status === 'Cliente';
        if (leadStatusFilter === 'Negociación') return a.lead_status === 'Negociación';
        if (leadStatusFilter === 'En seguimiento')
            return a.lead_status === 'En seguimiento' || a.lead_status === 'Lead calificado';
        if (leadStatusFilter === 'Perdido') return a.lead_status === 'Perdido';
        return true;
    });

    const activeDiagnostic = calculateRepDiagnostic(selectedRep || 'Todo el Equipo', stats.latestAudits);

    const handleCopyCoachingReport = () => {
        if (!activeDiagnostic) return;
        const text = `📊 REPORTE DE CALIDAD COMERCIAL 1:1 - ${activeDiagnostic.repName.toUpperCase()}
Calidad Comercial Media: ${activeDiagnostic.avgScore}/100 (${activeDiagnostic.totalDemos} demostraciones auditadas)

🚨 TOP ERRORES SISTÉMICOS RECURRENTES (A Corregir en 1:1):
${activeDiagnostic.topGaps
    .map(
        (g, i) => `${i + 1}. ${g.name}: Falló en ${g.failCount} de ${activeDiagnostic.totalDemos} demos (${g.percentage}% de error).
   ↳ Corrección: ${g.recommendation}`
    )
    .join('\n\n')}

🌟 FORTALEZAS DEMOSTRADAS CONSISTENTES:
${activeDiagnostic.topStrengths
    .map(s => `✓ ${s.name}: Cumplido en ${s.passCount} de ${activeDiagnostic.totalDemos} demos (${s.percentage}% de éxito).`)
    .join('\n')}

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
            {/* ─── BARRA DE CONTROL: ESCRIBE EL TÍTULO DEL DOCUMENTO DE GOOGLE DRIVE / GEMINI ─── */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl border border-indigo-500/30 p-3.5 sm:p-4 text-white shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-amber-300" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-black uppercase tracking-wider text-white">
                                    Filtro por Título de Documento (Google Drive & Gemini Meet)
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                                    Activo: "{activeDocumentTitleKeyword}"
                                </span>
                            </div>
                            <p className="text-[11px] text-indigo-200/80 mt-0.5">
                                Escribe qué palabra debe tener el <strong>título del documento</strong> cuando hacen una demo (ej. <code className="text-amber-300 font-bold">DEMO</code>, <code className="text-amber-300 font-bold">DEMO ERP</code>). Se ignoran reuniones de Desarrollo, Contabilidad o Soporte.
                            </p>
                        </div>
                    </div>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleApplyDocumentTitleFilter();
                        }}
                        className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0"
                    >
                        <div className="relative flex-1 sm:w-56">
                            <Search className="w-3.5 h-3.5 text-indigo-300 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={documentTitleKeyword}
                                onChange={(e) => setDocumentTitleKeyword(e.target.value)}
                                placeholder="Escribe el título (ej: DEMO)"
                                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/10 border border-indigo-400/40 text-white placeholder-indigo-300/60 text-xs font-mono font-bold focus:outline-none focus:border-amber-400 focus:bg-white/15"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isSyncing}
                            className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition-all cursor-pointer shrink-0 flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                            <span>Traer Solo Este Título</span>
                        </button>
                    </form>
                </div>

                {/* Atajos rápidos de títulos de documento */}
                <div className="flex items-center justify-between flex-wrap gap-2 mt-2.5 pt-2.5 border-t border-white/10 text-[11px]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-indigo-200/70 font-semibold">Títulos rápidos:</span>
                        {['DEMO', 'DEMO ERP', 'DEMO 1', 'Demo Arias ERP'].map(preset => {
                            const isCurrent = activeDocumentTitleKeyword.toLowerCase().trim() === preset.toLowerCase();
                            return (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => handleApplyDocumentTitleFilter(preset)}
                                    className={`px-2.5 py-0.5 rounded-lg font-mono text-[10px] font-black transition-all cursor-pointer ${
                                        isCurrent
                                            ? 'bg-indigo-500 text-white border border-indigo-300 shadow-2xs'
                                            : 'bg-white/10 text-indigo-100 hover:bg-white/20 border border-white/10'
                                    }`}
                                >
                                    📄 {preset}
                                </button>
                            );
                        })}
                    </div>
                    <span className="text-[10px] text-emerald-300/90 font-semibold">
                        ✓ {stats.totalAudits} documento(s) encontrados con título "{activeDocumentTitleKeyword}"
                    </span>
                </div>
            </div>

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

            {/* Scorecard Unificado del Equipo Comercial (Solo Ejecutivas Comerciales: Diana, Patricia, Grecia) */}
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

                    <div className="flex items-center gap-2 flex-wrap">
                        {selectedRep && (
                            <button
                                onClick={() => setSelectedRep(null)}
                                className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center gap-1 cursor-pointer"
                            >
                                <X className="w-3 h-3" />
                                <span>Ver Todos ({stats.totalAudits})</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => loadStats(true)}
                            disabled={isSyncing}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            title="Sincronizar documentos de Google Drive y Google Meet con el título configurado"
                        >
                            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Google Drive'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (selectedRep && !selectedRep.toLowerCase().includes('grecia')) {
                                    setQuickRepName(selectedRep);
                                }
                                const mainKw = (activeDocumentTitleKeyword.split(',')[0] || 'DEMO').trim();
                                setQuickDocumentTitle(`${mainKw} - `);
                                setIsQuickAuditModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-indigo-600 hover:bg-indigo-700 text-white transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                            title="Registrar y auditar un documento de notas de Gemini"
                        >
                            <Plus className="w-3 h-3" />
                            <span>Auditar Nueva Demo</span>
                        </button>
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/60">
                            Meta: ≥ 85 pts
                        </span>
                    </div>
                </div>

                {/* Filas Compactas de Rendimiento (AEs y SDRs juntos de forma ordenada) */}
                <div className="divide-y divide-slate-100">
                    {Object.entries(stats.repAverages).map(([repId, repData]) => {
                        const matchingAudit = stats.latestAudits.find(
                            a => (a.evaluated_user_id === repId || a.sales_rep_name === repId) && a.sales_rep_name
                        );
                        const name =
                            profileNames[repId] ||
                            matchingAudit?.sales_rep_name ||
                            (repId !== 'unassigned' && !repId.includes('-') ? repId : 'Ejecutivo de Ventas');
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
                                            {repData.count} demo(s) con título "{activeDocumentTitleKeyword}" · Clic para filtrar
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
                                    {stats.sdrTotals?.['Grecia Vásquez']?.count || 1} demo(s) agendada(s) ({stats.sdrTotals?.['Grecia Vásquez']?.demos?.slice(0, 3).join(', ') || 'Luis Escobar'}) · Coordinada en Calendar
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

            {/* ─── WORKSPACE DE AUDITORÍAS & COACHING ─── */}
            {stats.latestAudits.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50">
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                                Centro de Documentos Gemini & Coaching
                            </span>
                            <span className="text-slate-300">/</span>
                            <span className="text-xs font-black text-slate-850">
                                {selectedRep ? `Auditorías de ${selectedRep}` : `Documentos "${activeDocumentTitleKeyword}" (${displayedAudits.length})`}
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

                    <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                        {/* ─── COLUMNA IZQUIERDA (Cols 1-7): TABLA COMPACTA DE DOCUMENTOS AUDITADOS ─── */}
                        <div className="lg:col-span-7 p-4 space-y-3">
                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
                                            <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                                            Conversión Comercial de Demos
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => navigate('/leads')}
                                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer transition-colors"
                                    >
                                        <span>Ver Pipeline de Leads</span>
                                        <ArrowRight className="w-3 h-3" />
                                    </button>
                                </div>

                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <button
                                        onClick={() => setLeadStatusFilter('all')}
                                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                            leadStatusFilter === 'all'
                                                ? 'bg-slate-900 text-white shadow-2xs'
                                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                        }`}
                                    >
                                        Todas ({dealStats.total})
                                    </button>
                                    <button
                                        onClick={() => setLeadStatusFilter('Cerrado')}
                                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition-all cursor-pointer flex items-center gap-1 ${
                                            leadStatusFilter === 'Cerrado'
                                                ? 'bg-emerald-600 text-white shadow-2xs'
                                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                                        }`}
                                    >
                                        <span>🔒 Cerrados: {dealStats.closedCount} ({dealStats.winRate}%)</span>
                                        <span className="font-normal opacity-85">· ${dealStats.closedAmount.toLocaleString()}</span>
                                    </button>
                                    <button
                                        onClick={() => setLeadStatusFilter('Negociación')}
                                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                            leadStatusFilter === 'Negociación'
                                                ? 'bg-amber-600 text-white shadow-2xs'
                                                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                                        }`}
                                    >
                                        <span>💼 Negociación: {dealStats.inNegotiationCount}</span>
                                        <span className="font-normal opacity-85">· ${dealStats.inNegotiationAmount.toLocaleString()}</span>
                                    </button>
                                    <button
                                        onClick={() => setLeadStatusFilter('En seguimiento')}
                                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                            leadStatusFilter === 'En seguimiento'
                                                ? 'bg-teal-600 text-white shadow-2xs'
                                                : 'bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100'
                                        }`}
                                    >
                                        <span>📞 Seguimiento: {dealStats.followUpCount}</span>
                                    </button>
                                    <button
                                        onClick={() => setLeadStatusFilter('Perdido')}
                                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                            leadStatusFilter === 'Perdido'
                                                ? 'bg-rose-600 text-white shadow-2xs'
                                                : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                                        }`}
                                    >
                                        <span>❌ Perdidos: {dealStats.lostCount}</span>
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-x-auto overflow-y-auto max-h-[440px] border border-slate-200/80 rounded-xl">
                                <table className="w-full text-left text-xs">
                                    <thead className="sticky top-0 z-10">
                                        <tr className="bg-slate-100/90 text-[10px] font-black uppercase tracking-wider text-slate-600 border-b border-slate-200 backdrop-blur-xs">
                                            <th className="py-2.5 px-3">Empresa / Con Quién Se Habló / Doc. Gemini</th>
                                            <th className="py-2.5 px-2">Presentador (AE)</th>
                                            <th className="py-2.5 px-2">SDR</th>
                                            <th className="py-2.5 px-2 text-center">Puntaje</th>
                                            <th className="py-2.5 px-2 text-center">Calidad Demo</th>
                                            <th className="py-2.5 px-2 text-center">Resultado Lead</th>
                                            <th className="py-2.5 px-2 text-center">Ficha</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {displayedAudits.map((audit) => {
                                            const isSelected = selectedAudit?.id === audit.id;
                                            const badge = getScoreBadge(audit.total_score);
                                            const clientTitle = resolveClientName(audit);
                                            const contactPerson = resolveContactPerson(audit);
                                            const docTitle = resolveDocumentTitle(audit);
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
                                                    {/* Empresa, Contacto con quién se habló & Título del Documento */}
                                                    <td className="py-2.5 px-3 space-y-0.5">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="font-bold text-slate-900 truncate max-w-[165px]">
                                                                🏢 {clientTitle}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 shrink-0">
                                                                · {dateShort} {timeShort}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50/90 px-1.5 py-0.2 rounded border border-emerald-200">
                                                                👤 Habló con: <strong>{contactPerson}</strong>
                                                            </span>
                                                        </div>
                                                        <p
                                                            className="text-[10px] text-indigo-700 font-mono truncate max-w-[240px]"
                                                            title={docTitle}
                                                        >
                                                            📄 {docTitle}
                                                        </p>
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

                                                    {/* Calidad Demo */}
                                                    <td className="py-2.5 px-2 text-center">
                                                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${badge.color}`}>
                                                            {badge.text}
                                                        </span>
                                                    </td>

                                                    {/* Resultado Comercial Lead */}
                                                    <td className="py-2.5 px-2 text-center">
                                                        {audit.lead_status === 'Cerrado' || audit.lead_status === 'Cliente' ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                                                                <span>🔒 Cerrado</span>
                                                                {audit.deal_value ? <span className="opacity-80 font-normal">· ${audit.deal_value}</span> : null}
                                                            </span>
                                                        ) : audit.lead_status === 'Negociación' ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-50 text-amber-800 border border-amber-200">
                                                                <span>💼 Negociación</span>
                                                                {audit.deal_value ? <span className="opacity-80 font-normal">· ${audit.deal_value}</span> : null}
                                                            </span>
                                                        ) : audit.lead_status === 'En seguimiento' ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-teal-50 text-teal-800 border border-teal-200">
                                                                <span>📞 Seguimiento</span>
                                                            </span>
                                                        ) : audit.lead_status === 'Lead calificado' ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-50 text-blue-800 border border-blue-200">
                                                                <span>⭐ Calificado</span>
                                                            </span>
                                                        ) : audit.lead_status === 'Perdido' ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-200">
                                                                <span>❌ Perdido</span>
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] text-slate-400">—</span>
                                                        )}
                                                    </td>

                                                    {/* Acción Ver Lead */}
                                                    <td className="py-2.5 px-2 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOpenLeadInCrm(audit);
                                                            }}
                                                            className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                                            title={`Abrir ficha de ${clientTitle} (${contactPerson}) en CRM`}
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                        </button>
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

                            {activeCoachingTab === 'aggregate' && activeDiagnostic && (
                                <div className="space-y-3 text-xs">
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

                                    <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 border-l-3 border-l-indigo-500 space-y-1 shadow-2xs">
                                        <span className="text-[10px] font-black uppercase text-indigo-700 flex items-center gap-1">
                                            <Sparkles className="w-3 h-3 text-indigo-500" />
                                            Roleplay de 7 min para el 1:1
                                        </span>
                                        <p className="text-[11px] text-slate-700 leading-tight">
                                            {activeDiagnostic.roleplayFocus}
                                        </p>
                                    </div>

                                    <div className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-1">
                                        <span className="text-[10px] font-black uppercase text-emerald-800 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                            Fortaleza Consistente
                                        </span>
                                        <p className="text-[11px] text-slate-700 leading-tight">
                                            {activeDiagnostic.topStrengths[0]?.name || 'CRM veraz y documentado'} ({activeDiagnostic.topStrengths[0]?.percentage || 100}% éxito).
                                        </p>
                                    </div>

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

                            {activeCoachingTab === 'single' && selectedAudit && (
                                <div className="space-y-3 text-xs">
                                    <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex items-start justify-between gap-2">
                                        <div className="min-w-0 pr-2 space-y-0.5">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                                Identificación de la Demo
                                            </span>
                                            <strong className="text-slate-900 font-black text-xs block truncate">
                                                🏢 Empresa: {resolveClientName(selectedAudit)}
                                            </strong>
                                            <span className="text-[11px] font-bold text-emerald-700 block truncate">
                                                👤 Con quién se habló: {resolveContactPerson(selectedAudit)}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-600 block truncate">
                                                👩‍💼 Presentador (AE): {selectedAudit.sales_rep_name || 'Diana Morales'}
                                            </span>
                                            <span className="text-[10px] text-indigo-600 font-mono truncate block">
                                                📄 {resolveDocumentTitle(selectedAudit)}
                                            </span>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className="text-sm font-black text-slate-900 block">
                                                {selectedAudit.total_score} / 100 pts
                                            </span>
                                            <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-black uppercase border ${getScoreBadge(selectedAudit.total_score).color}`}>
                                                {getScoreBadge(selectedAudit.total_score).text}
                                            </span>
                                        </div>
                                    </div>

                                    {selectedAudit.rubric_scores && selectedAudit.rubric_scores.length > 0 && (
                                        <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 space-y-1.5">
                                            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-600">
                                                    Desglose Exacto de Puntaje (9 Criterios)
                                                </span>
                                                <span className="text-[10px] font-black text-indigo-700">
                                                    Suma: {selectedAudit.rubric_scores.reduce((acc, c) => acc + c.score, 0)} / 100 pts
                                                </span>
                                            </div>
                                            <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                                                {selectedAudit.rubric_scores.map((crit, idx) => (
                                                    <div key={crit.id || idx} className="text-[10px] py-1 border-b border-slate-50 last:border-0">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="font-bold text-slate-800 truncate">
                                                                {idx + 1}. {crit.name}
                                                            </span>
                                                            <span className={`shrink-0 px-1.5 py-0.2 rounded font-black ${
                                                                crit.status === 'pass' || crit.score === crit.max_points
                                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                    : crit.status === 'coaching' || crit.score > 0
                                                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                            }`}>
                                                                {crit.score}/{crit.max_points}
                                                            </span>
                                                        </div>
                                                        {crit.evidence_quote && (
                                                            <p className="text-[9px] text-slate-500 leading-tight mt-0.5 line-clamp-2">
                                                                {crit.evidence_quote}
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="p-2.5 rounded-xl bg-slate-900 text-white space-y-1.5 shadow-2xs">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1">
                                                <DollarSign className="w-3 h-3 text-emerald-400" />
                                                Resultado Comercial en CRM
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                                selectedAudit.lead_status === 'Cerrado' || selectedAudit.lead_status === 'Cliente'
                                                    ? 'bg-emerald-500 text-white'
                                                    : selectedAudit.lead_status === 'Negociación'
                                                    ? 'bg-amber-400 text-slate-950 font-black'
                                                    : selectedAudit.lead_status === 'Perdido'
                                                    ? 'bg-rose-500 text-white'
                                                    : 'bg-indigo-400 text-slate-950 font-black'
                                            }`}>
                                                {selectedAudit.lead_status ? `Estado: ${selectedAudit.lead_status}` : 'En Proceso'}
                                            </span>
                                        </div>
                                        {selectedAudit.deal_value ? (
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-slate-300 text-[10px]">Valor de la Oportunidad:</span>
                                                <strong className="text-emerald-400 text-xs font-black">
                                                    ${selectedAudit.deal_value.toLocaleString()} USD
                                                </strong>
                                            </div>
                                        ) : null}
                                        <button
                                            type="button"
                                            onClick={() => handleOpenLeadInCrm(selectedAudit)}
                                            className="w-full mt-1 py-1.5 px-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                        >
                                            <span>Abrir Ficha de {resolveClientName(selectedAudit)} ({resolveContactPerson(selectedAudit)}) en CRM</span>
                                            <ExternalLink className="w-3 h-3" />
                                        </button>
                                    </div>

                                    <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100 space-y-0.5">
                                        <span className="text-[9px] font-black uppercase text-emerald-800 block">
                                            ✓ Fortaleza Demostrada
                                        </span>
                                        <p className="text-[11px] text-slate-700 leading-tight">
                                            {selectedAudit.coaching_summary.strength}
                                        </p>
                                    </div>

                                    <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-100 space-y-0.5">
                                        <span className="text-[9px] font-black uppercase text-rose-800 block">
                                            ⚠️ Falla Crítica a Corregir
                                        </span>
                                        <p className="text-[11px] text-slate-700 leading-tight">
                                            {selectedAudit.coaching_summary.critical_gap}
                                        </p>
                                    </div>

                                    <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-100 space-y-0.5">
                                        <span className="text-[9px] font-black uppercase text-amber-800 block">
                                            ⚡ Acción Inmediata
                                        </span>
                                        <p className="text-[11px] text-slate-700 leading-tight">
                                            {selectedAudit.coaching_summary.immediate_action}
                                        </p>
                                    </div>

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
                totalDemos={activeDiagnostic?.totalDemos || stats.totalAudits || 8}
                avgScore={activeDiagnostic?.avgScore || stats.avgScore || 44}
                initialDemoId={coachingModalDemoId}
                liveAudits={stats.latestAudits}
            />

            {/* Modal para Registrar / Auditar Documento de Demo */}
            {isQuickAuditModalOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden text-slate-800">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-2xs">
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900">
                                        Registrar & Auditar Documento de Demo (Gemini Meet)
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        Escribe el título del documento de Google Drive (debe incluir "{activeDocumentTitleKeyword}")
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsQuickAuditModalOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveQuickAudit} className="p-5 space-y-3.5 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Título del Documento en Google Drive / Gemini *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={quickDocumentTitle}
                                    onChange={(e) => setQuickDocumentTitle(e.target.value)}
                                    placeholder={`Ej. ${activeDocumentTitleKeyword} - Nombre del Cliente - Notas de Gemini`}
                                    className="w-full px-3 py-2 rounded-xl border border-indigo-300 bg-indigo-50/40 font-mono font-bold text-slate-900 focus:border-indigo-500 focus:outline-none text-xs"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Cliente / Empresa *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={quickClientName}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setQuickClientName(val);
                                            const mainKw = (activeDocumentTitleKeyword.split(',')[0] || 'DEMO').trim();
                                            setQuickDocumentTitle(`${mainKw} - ${val} - Notas de Gemini`);
                                        }}
                                        placeholder="Ej. Inversiones del Pacífico"
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 focus:outline-none text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Fecha y Hora de la Demo *
                                    </label>
                                    <input
                                        type="datetime-local"
                                        required
                                        value={quickDemoDate}
                                        onChange={(e) => setQuickDemoDate(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 focus:outline-none text-xs"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Presentador (AE) *
                                    </label>
                                    <select
                                        value={quickRepName}
                                        onChange={(e) => setQuickRepName(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 focus:outline-none text-xs bg-white"
                                    >
                                        <option value="Patricia Martínez">Patricia Martínez (AE)</option>
                                        <option value="Diana Morales">Diana Morales (AE)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Agendado por (SDR Opcional)
                                    </label>
                                    <select
                                        value={quickSdrName}
                                        onChange={(e) => setQuickSdrName(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 focus:outline-none text-xs bg-white"
                                    >
                                        <option value="">Directo AE (Sin SDR)</option>
                                        <option value="Grecia Vásquez">Grecia Vásquez (SDR)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Estado Comercial del Lead
                                    </label>
                                    <select
                                        value={quickLeadStatus}
                                        onChange={(e) => setQuickLeadStatus(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 focus:outline-none text-xs bg-white"
                                    >
                                        <option value="Negociación">💼 Negociación</option>
                                        <option value="En seguimiento">📞 En seguimiento</option>
                                        <option value="Lead calificado">⭐ Lead calificado</option>
                                        <option value="Cerrado">🔒 Cerrado (Ganado)</option>
                                        <option value="Perdido">❌ Perdido</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Valor Oportunidad (USD)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={quickDealValue}
                                        onChange={(e) => setQuickDealValue(e.target.value)}
                                        placeholder="1200"
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 focus:outline-none text-xs"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Enlace a Google Doc / Grabación Meet (Opcional)
                                </label>
                                <input
                                    type="url"
                                    value={quickGoogleDocUrl}
                                    onChange={(e) => setQuickGoogleDocUrl(e.target.value)}
                                    placeholder="https://docs.google.com/document/d/..."
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 focus:outline-none text-xs"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Notas de Gemini (Google Meet) o Resumen de la Demo
                                </label>
                                <textarea
                                    rows={4}
                                    value={quickNotes}
                                    onChange={(e) => setQuickNotes(e.target.value)}
                                    placeholder="Pega aquí las notas generadas por Gemini en Google Meet (agenda, dolores detectados, costo del problema, decisor, manejo de objeciones y fecha del próximo paso)..."
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 focus:outline-none text-xs leading-relaxed"
                                />
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsQuickAuditModalOpen(false)}
                                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingQuickAudit}
                                    className="px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>{isSavingQuickAudit ? 'Auditando...' : 'Auditar y Guardar (100 pts)'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
