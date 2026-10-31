// src/components/team/SalesExcellenceAuditsSection.tsx
// Panel de Auditoría y Calidad Comercial ARIAS para TeamPerformance

import React, { useState, useEffect } from 'react';
import {
    Award, ShieldAlert, CheckCircle2, TrendingUp, Users, Calendar,
    ExternalLink, Sparkles, Flame, ChevronRight, FileText, Target
} from 'lucide-react';
import { salesAuditService } from '../../services/salesAuditService';
import type { SalesCallAudit } from '../../types/salesExcellence';
import { useNavigate } from 'react-router-dom';

interface SalesExcellenceAuditsSectionProps {
    companyId: string;
    profileNames: Record<string, string>;
    profileAvatars: Record<string, string | null>;
}

export const SalesExcellenceAuditsSection: React.FC<SalesExcellenceAuditsSectionProps> = ({
    companyId,
    profileNames,
    profileAvatars
}) => {
    const navigate = useNavigate();
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

            {/* Ranking por Vendedor */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                            <Award className="w-4 h-4 text-indigo-500" />
                            Scorecard de Calidad Comercial por Ejecutivo (AE)
                        </h3>
                        <p className="text-xs text-slate-400">
                            Basado en la Rúbrica Oficial de 9 criterios y notas generadas por Gemini en Google Meet
                        </p>
                    </div>
                    <span className="text-xs font-bold text-slate-500">
                        Meta ARIAS: ≥ 85 pts
                    </span>
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

                            return (
                                <div key={repId} className="py-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 px-2 rounded-xl transition-all">
                                    <div className="flex items-center gap-3">
                                        <img
                                            src={avatar}
                                            alt={name}
                                            className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-xs"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4f46e5&color=fff&size=128&bold=true`;
                                            }}
                                        />
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-xs font-black text-slate-800">{name}</h4>
                                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                                                    AE / Demostradora
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-400">
                                                {repData.count} demo(s) auditada(s) · Última puntuación: {repData.lastScore} pts
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
                        <div className="p-3.5 rounded-2xl bg-indigo-50/40 border border-indigo-100 flex items-center justify-between">
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

            {/* Lista de Auditorías Recientes y Detalle */}
            {stats.latestAudits.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Lista */}
                    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 space-y-3">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
                            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                            Últimas Auditorías Registradas
                        </h4>

                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {stats.latestAudits.map((audit) => {
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
                                        onClick={() => setSelectedAudit(audit)}
                                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                                            isSelected
                                                ? 'bg-indigo-50/50 border-indigo-300 shadow-xs'
                                                : 'bg-white border-slate-200/60 hover:border-slate-300'
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

                    {/* Detalle de Auditoría Seleccionada */}
                    {selectedAudit && (
                        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">
                                            Detalle de Coaching 1:1
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
                                        Fortaleza Observable
                                    </span>
                                    <p className="text-slate-700 font-medium">
                                        {selectedAudit.coaching_summary.strength}
                                    </p>
                                </div>

                                <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 space-y-1">
                                    <span className="text-[10px] font-black uppercase text-rose-700">
                                        Falla Crítica Observable
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
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
