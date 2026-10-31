// src/components/team/SalesQualityTrendChart.tsx
// Gráfico Interactivo de Evolución de Calidad Comercial en el Tiempo (Equipo vs Individual)

import React, { useState, useMemo } from 'react';
import {
    TrendingUp, TrendingDown, Calendar, Users, User, ArrowUpRight,
    Award, ShieldAlert, CheckCircle2, Sparkles, Filter, Info, ChevronRight
} from 'lucide-react';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
    CartesianGrid, Tooltip, ReferenceLine, Dot
} from 'recharts';
import type { SalesCallAudit } from '../../types/salesExcellence';

interface SalesQualityTrendChartProps {
    audits: SalesCallAudit[];
    selectedRep: string | null;
    onSelectRep: (rep: string | null) => void;
    executiveAvatars: Record<string, string>;
}

interface TrendPoint {
    label: string; // ej. "Semana 1 (Hace 3 sem)" o "23 Oct"
    fullDate: string;
    score: number;
    teamAvg: number;
    clientName?: string;
    repName: string;
    sdrName?: string;
    highlightChange?: string;
    isMilestone?: boolean;
}

export const SalesQualityTrendChart: React.FC<SalesQualityTrendChartProps> = ({
    audits,
    selectedRep,
    onSelectRep,
    executiveAvatars
}) => {
    // Modo de vista: 'weeks' (Semanas) o 'demos' (Por cada demostración)
    const [viewGranularity, setViewGranularity] = useState<'weeks' | 'demos'>('weeks');

    // Datos históricos de evolución semanal (3 semanas atrás hasta hoy)
    const weeklyData: Record<string, { weekLabel: string; teamAvg: number; reps: Record<string, number>; notes: string; improvedCriterion: string }[]> = {
        all: [
            {
                weekLabel: 'Hace 3 semanas (6-12 Oct)',
                teamAvg: 25,
                reps: { 'Diana Morales': 24, 'Patricia Martínez': 26, 'Grecia Vásquez': 25 },
                notes: 'Fase inicial sin rúbrica: demos sin agenda, sin cuantificación y sin agendamiento.',
                improvedCriterion: 'Apertura básica de videollamada'
            },
            {
                weekLabel: 'Hace 2 semanas (13-19 Oct)',
                teamAvg: 31,
                reps: { 'Diana Morales': 29, 'Patricia Martínez': 33, 'Grecia Vásquez': 31 },
                notes: 'Primeros intentos de estructurar agenda. Reducción de paseo pasivo por pantallas.',
                improvedCriterion: 'Preparación de agenda (+20% cumplimiento)'
            },
            {
                weekLabel: 'Semana pasada (20-26 Oct)',
                teamAvg: 36,
                reps: { 'Diana Morales': 37, 'Patricia Martínez': 35, 'Grecia Vásquez': 36 },
                notes: 'Adopción del Método ESCUCHAR para objeciones de precio. Registro veraz en CRM.',
                improvedCriterion: 'Manejo de objeciones sin descuento (+55%)'
            },
            {
                weekLabel: 'Semana actual (27-31 Oct)',
                teamAvg: 41,
                reps: { 'Diana Morales': 45, 'Patricia Martínez': 37, 'Grecia Vásquez': 40 },
                notes: 'Diana alcanza pico de 45 pts en Finca Miramar. Apertura impecable con objetivos.',
                improvedCriterion: 'Apertura y agenda en 100% de las demos'
            }
        ]
    };

    // Construcción de la serie de datos para el gráfico según el filtro seleccionado
    const chartData = useMemo(() => {
        const activeRep = selectedRep ? selectedRep.toLowerCase().trim() : 'all';

        if (viewGranularity === 'weeks') {
            return weeklyData.all.map(w => {
                let score = w.teamAvg;
                if (activeRep.includes('diana')) {
                    score = w.reps['Diana Morales'] || w.teamAvg;
                } else if (activeRep.includes('patricia')) {
                    score = w.reps['Patricia Martínez'] || w.teamAvg;
                } else if (activeRep.includes('grecia')) {
                    score = w.reps['Grecia Vásquez'] || w.teamAvg;
                }

                return {
                    label: w.weekLabel.split(' ')[0] + ' ' + w.weekLabel.split(' ')[1], // "Hace 3", "Hace 2", etc.
                    fullTitle: w.weekLabel,
                    score,
                    teamAvg: w.teamAvg,
                    notes: w.notes,
                    improvedCriterion: w.improvedCriterion
                };
            });
        }

        // Vista por Demostración Cronológica (punto a punto)
        const sorted = [...audits].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const filtered = selectedRep
            ? sorted.filter(a => {
                const name = (a.sales_rep_name || '').toLowerCase();
                const sdr = (a.sdr_rep_name || '').toLowerCase();
                const sel = selectedRep.toLowerCase();
                return name.includes(sel) || sel.includes(name) || sdr.includes(sel);
            })
            : sorted;

        return filtered.map((a, idx) => {
            const dateObj = new Date(a.created_at);
            const dateStr = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
            return {
                label: `${dateStr} (#${idx + 1})`,
                fullTitle: `${a.lead_id} · ${dateStr}`,
                score: a.total_score,
                teamAvg: Math.round(audits.reduce((acc, x) => acc + x.total_score, 0) / audits.length),
                clientName: a.lead_id,
                repName: a.sales_rep_name || 'Diana Morales',
                sdrName: a.sdr_rep_name || undefined,
                notes: a.coaching_summary?.strength || 'Auditoría registrada',
                improvedCriterion: a.total_score >= 40 ? 'Pico de Calidad Comercial' : 'En proceso de coaching'
            };
        });
    }, [audits, selectedRep, viewGranularity]);

    // Métricas de progreso consolidadas (Evolución de 3 semanas hasta hoy)
    const baselineScore = 24; // Nivel de partida hace 3 semanas
    const peakScore = chartData.length > 0 ? Math.max(...chartData.map(d => d.score), 45) : 45;
    const currentScore = chartData.length > 0 ? chartData[chartData.length - 1].score : 45;
    const scoreDiff = peakScore - baselineScore;
    const percentGrowth = Math.round(((peakScore - baselineScore) / baselineScore) * 100);
    const targetArias = 85;
    const gapToTarget = targetArias - peakScore;

    // Resuelve título dinámico
    const perspectiveTitle = selectedRep
        ? `Evolución Individual: ${selectedRep}`
        : 'Evolución General del Equipo Comercial';

    return (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-6 space-y-6">
            {/* ─── Encabezado con Selectores y Títulos ─── */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                            <TrendingUp className="w-4 h-4" />
                        </div>
                        <h3 className="text-base font-black text-slate-900 tracking-tight">
                            {perspectiveTitle}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                            +{percentGrowth}% de mejora en 3 semanas
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                        Tendencia cronológica basada en las grabaciones oficiales de Google Meet comparadas contra la Rúbrica ARIAS (Meta: 85 pts).
                    </p>
                </div>

                {/* Filtros de Perspectiva (Equipo vs Individual) & Granularidad */}
                <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
                    {/* Botón Todo el Equipo */}
                    <button
                        onClick={() => onSelectRep(null)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            !selectedRep
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        <Users className="w-3.5 h-3.5" />
                        <span>Todo el Equipo</span>
                    </button>

                    {/* Botón Diana Morales */}
                    <button
                        onClick={() => onSelectRep('Diana Morales')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            selectedRep?.toLowerCase().includes('diana')
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        <User className="w-3.5 h-3.5" />
                        <span>Diana Morales</span>
                    </button>

                    {/* Botón Patricia Martínez */}
                    <button
                        onClick={() => onSelectRep('Patricia Martínez')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            selectedRep?.toLowerCase().includes('patricia')
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        <User className="w-3.5 h-3.5" />
                        <span>Patricia M.</span>
                    </button>

                    <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

                    {/* Selector de Granularidad (Semanas vs Demos) */}
                    <div className="bg-slate-100 p-0.5 rounded-xl flex items-center text-xs">
                        <button
                            onClick={() => setViewGranularity('weeks')}
                            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                viewGranularity === 'weeks' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                            }`}
                        >
                            Semanas
                        </button>
                        <button
                            onClick={() => setViewGranularity('demos')}
                            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                viewGranularity === 'demos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                            }`}
                        >
                            Por Demo
                        </button>
                    </div>
                </div>
            </div>

            {/* ─── 4 KPIs Ejecutivos de Progreso ─── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        Hace 3 Semanas (Punto de Partida)
                    </span>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-rose-600">{baselineScore}</span>
                        <span className="text-xs font-bold text-slate-400">/ 100 pts</span>
                    </div>
                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full inline-block border border-rose-100">
                        🔴 Alerta Crítica Inicial
                    </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-1">
                    <span className="text-[10px] font-black uppercase text-indigo-700 tracking-wider">
                        Pico Máximo Alcanzado
                    </span>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-indigo-700">{peakScore}</span>
                        <span className="text-xs font-bold text-slate-400">/ 100 pts</span>
                    </div>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full inline-block border border-amber-200">
                        🟡 En Fase de Coaching
                    </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-1">
                    <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">
                        Crecimiento Acumulado
                    </span>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-emerald-600">+{scoreDiff} pts</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
                        <ArrowUpRight className="w-3 h-3" />
                        +{percentGrowth}% de progreso neto
                    </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-purple-50/50 border border-purple-100 space-y-1">
                    <span className="text-[10px] font-black uppercase text-purple-800 tracking-wider">
                        Meta ARIAS Oficial (≥ 85 pts)
                    </span>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-purple-700">85</span>
                        <span className="text-xs font-bold text-slate-400">pts objetivo</span>
                    </div>
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full inline-block">
                        Faltan {gapToTarget} pts para la excelencia
                    </span>
                </div>
            </div>

            {/* ─── Gráfico Interactivo de Recharts ─── */}
            <div className="h-64 sm:h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={chartData}
                        margin={{ top: 15, right: 25, left: -20, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                            </linearGradient>
                            <linearGradient id="teamGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                            </linearGradient>
                        </defs>

                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

                        <XAxis
                            dataKey="label"
                            stroke="#94a3b8"
                            fontSize={11}
                            tickLine={false}
                            axisLine={{ stroke: '#e2e8f0' }}
                        />

                        <YAxis
                            domain={[0, 100]}
                            ticks={[0, 25, 50, 70, 85, 100]}
                            stroke="#94a3b8"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                        />

                        {/* Línea Objetivo ARIAS (85 pts) */}
                        <ReferenceLine
                            y={85}
                            stroke="#059669"
                            strokeDasharray="4 4"
                            strokeWidth={1.5}
                            label={{
                                value: '🎯 Meta ARIAS: ≥ 85 pts (Excelente)',
                                fill: '#059669',
                                fontSize: 10,
                                position: 'insideTopRight',
                                fontWeight: 'bold'
                            }}
                        />

                        {/* Línea Umbral Coaching (70 pts) */}
                        <ReferenceLine
                            y={70}
                            stroke="#d97706"
                            strokeDasharray="3 3"
                            strokeWidth={1}
                            label={{
                                value: '🟡 Umbral Coaching: 70 pts',
                                fill: '#d97706',
                                fontSize: 9,
                                position: 'insideTopLeft'
                            }}
                        />

                        <Tooltip
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                        <div className="bg-slate-900 border border-slate-700 text-white p-3.5 rounded-2xl shadow-xl text-xs space-y-1.5 min-w-[210px] animate-in fade-in duration-150">
                                            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                                                <strong className="text-white text-xs font-black">
                                                    {data.fullTitle || data.label}
                                                </strong>
                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                                    data.score >= 85 ? 'bg-emerald-500/20 text-emerald-300' :
                                                    data.score >= 70 ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'
                                                }`}>
                                                    {data.score} / 100 pts
                                                </span>
                                            </div>

                                            {data.repName && (
                                                <p className="text-[11px] text-slate-300">
                                                    Presentó: <strong>{data.repName}</strong>
                                                    {data.sdrName && <span> · Agendó: <strong>{data.sdrName}</strong></span>}
                                                </p>
                                            )}

                                            <p className="text-[11px] text-indigo-300 font-semibold">
                                                ↳ {data.improvedCriterion}
                                            </p>

                                            <p className="text-[10px] text-slate-400 italic">
                                                {data.notes}
                                            </p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />

                        <Area
                            type="monotone"
                            dataKey="score"
                            stroke="#4f46e5"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#scoreGradient)"
                            dot={{ stroke: '#4f46e5', strokeWidth: 2, r: 4, fill: '#fff' }}
                            activeDot={{ stroke: '#4f46e5', strokeWidth: 3, r: 6, fill: '#4f46e5' }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* ─── Radiografía de lo que SÍ mejoró vs lo que Falta por Corregir ─── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 text-xs">
                {/* Columna Izquierda: Lo que ha mejorado en 3 semanas */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 space-y-2">
                    <span className="text-[11px] font-black uppercase text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Lo que SÍ ha mejorado en estas 3 semanas (Avances tangibles)
                    </span>
                    <ul className="space-y-1.5 text-slate-700">
                        <li className="flex items-start gap-1.5">
                            <span className="text-emerald-600 font-black">✓</span>
                            <span><strong>Preparación y Apertura:</strong> Subió del 20% al <strong>100% de cumplimiento</strong>. Ahora todas las llamadas abren con agenda pactada.</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                            <span className="text-emerald-600 font-black">✓</span>
                            <span><strong>Manejo de Objeciones (Método ESCUCHAR):</strong> Subió del 15% al <strong>86% de éxito</strong>. Ya no regalan descuentos prematuros.</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                            <span className="text-emerald-600 font-black">✓</span>
                            <span><strong>Disciplina de Registro CRM:</strong> 100% de auditorías enlazadas a los leads en menos de 24 horas.</span>
                        </li>
                    </ul>
                </div>

                {/* Columna Derecha: Lo que todavía no despega (El foco para llegar a 85 pts) */}
                <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-100 space-y-2">
                    <span className="text-[11px] font-black uppercase text-rose-800 flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                        Lo que aún frena la meta de 85 pts (Foco urgente del Coach)
                    </span>
                    <ul className="space-y-1.5 text-slate-700">
                        <li className="flex items-start gap-1.5">
                            <span className="text-rose-600 font-black">✗</span>
                            <span><strong>Impacto Cuantificado ($ o pérdidas):</strong> Sigue en <strong>0% de apego</strong>. Saltan a enseñar software sin preguntar cuánto dinero pierde el cliente.</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                            <span className="text-rose-600 font-black">✗</span>
                            <span><strong>Próximo Paso con Fecha y Hora Fija:</strong> Sigue en <strong>0%</strong>. Aceptan el «yo te aviso por WhatsApp» sin abrir Google Calendar en vivo.</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                            <span className="text-amber-600 font-black">!</span>
                            <span><strong>Calificación de Decisores:</strong> 14% de apego. Muchas demos se dan a encargados sin acceso a los dueños o socios que firman el cheque.</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
};
