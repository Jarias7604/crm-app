// src/components/company/RealCoachingOpportunitiesModal.tsx
// Simulador Interactivo de Coaching 1:1 («Otro Nivel») con Datos Reales de Google Meet

import React, { useState } from 'react';
import {
    X, Sparkles, MessageSquare, Copy, Check, Target, Lightbulb,
    HelpCircle, ChevronRight, User, ShieldCheck, PlayCircle, Filter,
    Clock, AlertTriangle, ArrowRight, Volume2, Award, CheckCircle2,
    Calendar, Building2, UserCheck
} from 'lucide-react';
import {
    coachingOpportunitiesService,
    type CoachingOpportunity
} from '../../services/coachingOpportunitiesService';
import toast from 'react-hot-toast';

interface RealCoachingOpportunitiesModalProps {
    isOpen: boolean;
    onClose: () => void;
    repName: string;
    repAvatar?: string;
    totalDemos?: number;
    avgScore?: number;
    initialDemoId?: string;
}

export const RealCoachingOpportunitiesModal: React.FC<RealCoachingOpportunitiesModalProps> = ({
    isOpen,
    onClose,
    repName,
    repAvatar,
    totalDemos = 7,
    avgScore = 36,
    initialDemoId
}) => {
    if (!isOpen) return null;

    // Obtener oportunidades de la ejecutiva seleccionada
    const repOpportunities = coachingOpportunitiesService.getOpportunitiesByRep(repName);

    // Estado del caso activo en el simulador
    const initialIndex = initialDemoId
        ? Math.max(0, repOpportunities.findIndex(o => o.demoId === initialDemoId))
        : 0;

    const [activeCaseIndex, setActiveCaseIndex] = useState<number>(initialIndex);
    const [activeInteractiveStep, setActiveInteractiveStep] = useState<number>(1); // 1 a 5
    const [copiedQuestion, setCopiedQuestion] = useState(false);
    const [copiedFullPlan, setCopiedFullPlan] = useState(false);
    const [isPlayingTrigger, setIsPlayingTrigger] = useState(false);

    const activeCase = repOpportunities[activeCaseIndex] || repOpportunities[0];

    // Resolver avatar oficial o fotográfico
    const resolvedAvatar = repAvatar || (
        repName.toLowerCase().includes('diana')
            ? 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80'
            : repName.toLowerCase().includes('grecia')
            ? 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80'
            : 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80'
    );

    const handleCopyQuestion = () => {
        if (!activeCase) return;
        const text = `🎯 Pregunta recomendada para ${activeCase.clientName} (${activeCase.category}):\n"${activeCase.coachingQuestion}"\n\nContexto: Minuto ${activeCase.minuteTimestamp} cuando el lead dijo: "${activeCase.leadQuote}"`;
        navigator.clipboard.writeText(text);
        setCopiedQuestion(true);
        toast.success('Pregunta copiada al portapapeles');
        setTimeout(() => setCopiedQuestion(false), 2200);
    };

    const handleCopyAllScript = () => {
        const full = coachingOpportunitiesService.formatCoachingScriptClipboard(repName, repOpportunities);
        navigator.clipboard.writeText(full);
        setCopiedFullPlan(true);
        toast.success(`Guión completo de ${repName} copiado al portapapeles`);
        setTimeout(() => setCopiedFullPlan(false), 2500);
    };

    const simulateAudioPlay = () => {
        setIsPlayingTrigger(true);
        toast('Reproduciendo momento de la llamada...', { icon: '🎙️' });
        setTimeout(() => setIsPlayingTrigger(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="w-full max-w-5xl bg-white border border-slate-200 rounded-3xl shadow-2xl flex flex-col max-h-[94vh] text-slate-800 overflow-hidden">
                {/* ─── ENCABEZADO MINIMALISTA DE ALTO NIVEL ─── */}
                <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 text-white flex items-center justify-between border-b border-indigo-500/20">
                    <div className="flex items-center gap-3.5">
                        <div className="relative">
                            <img
                                src={resolvedAvatar}
                                alt={repName}
                                className="w-12 h-12 rounded-2xl object-cover ring-2 ring-indigo-400/50 shadow-md"
                            />
                            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full" />
                        </div>

                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-black tracking-tight text-white">
                                    Simulador de Coaching 1:1
                                </h3>
                                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                                    {repName} (AE)
                                </span>
                                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                                    {totalDemos} demos analizadas
                                </span>
                            </div>
                            <p className="text-xs text-indigo-200/80 font-medium flex items-center gap-1.5 mt-0.5">
                                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                <span>Momentos Reales de Grabación · Presiona los botones interactivos para aprender la técnica del Coach</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCopyAllScript}
                            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-xs cursor-pointer"
                        >
                            {copiedFullPlan ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedFullPlan ? '¡Plan Copiado!' : 'Copiar Plan Completo'}</span>
                        </button>

                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* ─── SELECTOR HORIZONTAL DE CASOS REALES DE LLAMADAS ─── */}
                <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200/80 flex items-center gap-2 overflow-x-auto text-xs">
                    <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider shrink-0 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                        Reunión:
                    </span>
                    {repOpportunities.map((opp, idx) => {
                        const isCurrent = idx === activeCaseIndex;
                        return (
                            <button
                                key={opp.id}
                                onClick={() => {
                                    setActiveCaseIndex(idx);
                                    setActiveInteractiveStep(1); // Reiniciar al paso 1
                                }}
                                className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                                    isCurrent
                                        ? 'bg-slate-900 text-white shadow-xs'
                                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                                }`}
                            >
                                <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-black flex items-center justify-center">
                                    {idx + 1}
                                </span>
                                <span>{opp.clientName}</span>
                                <span className="text-[10px] font-semibold text-slate-400">
                                    ({opp.minuteTimestamp})
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* ─── CUERPO DEL SIMULADOR INTERACTIVO ─── */}
                {activeCase && (
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/50">
                        {/* Ficha Resumen de la Cita */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-base font-black text-slate-900">
                                        {activeCase.clientName}
                                    </h4>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                        {activeCase.clientCompanyType}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                                        Brecha: {activeCase.criterionName}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                                    <span className="flex items-center gap-1 font-semibold text-slate-700">
                                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                                        Momento: Minuto {activeCase.minuteTimestamp} · {activeCase.conversationStage}
                                    </span>
                                    <span>·</span>
                                    <span>{activeCase.demoDate}</span>
                                    {activeCase.sdrName && (
                                        <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                            Agendó: {activeCase.sdrName} (SDR)
                                        </span>
                                    )}
                                </p>
                            </div>

                            <button
                                onClick={handleCopyQuestion}
                                className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                            >
                                {copiedQuestion ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>{copiedQuestion ? '¡Copiada!' : 'Copiar Pregunta de Oro'}</span>
                            </button>
                        </div>

                        {/* ¿Cómo se estaba abordando la conversación? (Contexto Real de la Grabación) */}
                        <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-100/80 text-xs space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800 flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                ¿Cómo se estaba abordando la conversación en este instante?
                            </span>
                            <p className="text-slate-700 font-medium">
                                {activeCase.conversationContext}
                            </p>
                        </div>

                        {/* ─── SELECTOR INTERACTIVO DE PASOS DEL COACH (LOS 5 BOTONES) ─── */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-500 text-[11px] uppercase tracking-wider">
                                    Presiona cada botón interactivo para ver el análisis del Coach:
                                </span>
                                <span className="text-slate-400 font-semibold text-[11px]">
                                    Paso {activeInteractiveStep} de 5
                                </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                <button
                                    onClick={() => setActiveInteractiveStep(1)}
                                    className={`p-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex flex-col items-center gap-1 border ${
                                        activeInteractiveStep === 1
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-300'
                                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    <span className="text-[10px] font-black uppercase tracking-wider opacity-80">Paso 1</span>
                                    <span className="text-center font-black">🗣️ Lo que dijo el Lead</span>
                                </button>

                                <button
                                    onClick={() => setActiveInteractiveStep(2)}
                                    className={`p-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex flex-col items-center gap-1 border ${
                                        activeInteractiveStep === 2
                                            ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-300'
                                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    <span className="text-[10px] font-black uppercase tracking-wider opacity-80">Paso 2</span>
                                    <span className="text-center font-black">🛑 Error del Asesor</span>
                                </button>

                                <button
                                    onClick={() => setActiveInteractiveStep(3)}
                                    className={`p-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex flex-col items-center gap-1 border ${
                                        activeInteractiveStep === 3
                                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-300'
                                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    <span className="text-[10px] font-black uppercase tracking-wider opacity-80">Paso 3</span>
                                    <span className="text-center font-black">🧠 Pregunta de Oro</span>
                                </button>

                                <button
                                    onClick={() => setActiveInteractiveStep(4)}
                                    className={`p-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex flex-col items-center gap-1 border ${
                                        activeInteractiveStep === 4
                                            ? 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-300'
                                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    <span className="text-[10px] font-black uppercase tracking-wider opacity-80">Paso 4</span>
                                    <span className="text-center font-black">🔮 Qué Respondía</span>
                                </button>

                                <button
                                    onClick={() => setActiveInteractiveStep(5)}
                                    className={`p-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex flex-col items-center gap-1 border col-span-2 sm:col-span-1 ${
                                        activeInteractiveStep === 5
                                            ? 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-300'
                                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    <span className="text-[10px] font-black uppercase tracking-wider opacity-80">Paso 5</span>
                                    <span className="text-center font-black">🚀 Jugada de Cierre</span>
                                </button>
                            </div>
                        </div>

                        {/* ─── PANTALLA ACTIVA DEL SIMULADOR ─── */}
                        <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm min-h-[220px] transition-all animate-in fade-in duration-200">
                            {/* PASO 1: LO QUE DIJO EL LEAD */}
                            {activeInteractiveStep === 1 && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1.5">
                                            <Volume2 className="w-3.5 h-3.5" />
                                            Transcripción Real · Minuto {activeCase.minuteTimestamp}
                                        </span>
                                        <button
                                            onClick={simulateAudioPlay}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                                isPlayingTrigger ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                        >
                                            <Volume2 className={`w-3.5 h-3.5 ${isPlayingTrigger ? 'animate-bounce' : ''}`} />
                                            <span>{isPlayingTrigger ? 'Reproduciendo audio...' : 'Simular Audio de la Llamada'}</span>
                                        </button>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 relative">
                                        <div className="text-indigo-500 font-black text-2xl absolute -top-3 left-4 bg-white px-2 rounded-full border border-indigo-200">
                                            “
                                        </div>
                                        <p className="text-sm font-semibold text-slate-900 italic pt-1 leading-relaxed">
                                            {activeCase.leadQuote}
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between pt-2">
                                        <span className="text-xs text-slate-500">
                                            El cliente acaba de dar una pista clave. ¿Qué debió hacer el vendedor?
                                        </span>
                                        <button
                                            onClick={() => setActiveInteractiveStep(2)}
                                            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                                        >
                                            <span>Ver Error del Asesor</span>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* PASO 2: ERROR DEL ASESOR / PUNTO CIEGO */}
                            {activeInteractiveStep === 2 && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5">
                                            <AlertTriangle className="w-3.5 h-3.5" />
                                            Lo que ocurrió en la llamada · Punto Ciego del Asesor
                                        </span>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-2">
                                        <h5 className="font-black text-rose-900 text-xs uppercase tracking-wide">
                                            Reacción de {activeCase.repName} en ese segundo:
                                        </h5>
                                        <p className="text-xs text-rose-950 font-medium">
                                            {activeCase.salesRepReaction}
                                        </p>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                                        <h5 className="font-black text-slate-800 uppercase text-[10px] tracking-wider">
                                            Diagnóstico del Coach:
                                        </h5>
                                        <p className="text-slate-700 font-semibold">
                                            {activeCase.missedOpportunityAnalysis}
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between pt-2">
                                        <button
                                            onClick={() => setActiveInteractiveStep(1)}
                                            className="text-xs font-bold text-slate-500 hover:text-slate-900"
                                        >
                                            ← Volver a lo que dijo el Lead
                                        </button>
                                        <button
                                            onClick={() => setActiveInteractiveStep(3)}
                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                                        >
                                            <span>Ver Pregunta de Oro del Coach</span>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* PASO 3: PREGUNTA DE ORO DEL COACH */}
                            {activeInteractiveStep === 3 && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                                            <Target className="w-3.5 h-3.5" />
                                            La Pregunta Exacta que Debió Hacer en ese Segundo
                                        </span>
                                        <button
                                            onClick={handleCopyQuestion}
                                            className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer border border-emerald-300"
                                        >
                                            {copiedQuestion ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                                            <span>{copiedQuestion ? 'Copiada' : 'Copiar'}</span>
                                        </button>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-white to-emerald-50 border-2 border-emerald-400 shadow-xs space-y-2">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                                            Guión Oficial ARIAS para el Asesor:
                                        </span>
                                        <p className="text-sm font-black text-slate-900 leading-relaxed">
                                            💬 {activeCase.coachingQuestion}
                                        </p>
                                    </div>

                                    <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100 text-xs space-y-1">
                                        <span className="text-[10px] font-black uppercase text-indigo-700 flex items-center gap-1">
                                            <Lightbulb className="w-3 h-3 text-indigo-500" />
                                            Técnica de Venta Aplicada:
                                        </span>
                                        <p className="text-slate-700 font-medium">
                                            {activeCase.coachingTip}
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between pt-2">
                                        <button
                                            onClick={() => setActiveInteractiveStep(2)}
                                            className="text-xs font-bold text-slate-500 hover:text-slate-900"
                                        >
                                            ← Ver Error del Asesor
                                        </button>
                                        <button
                                            onClick={() => setActiveInteractiveStep(4)}
                                            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                                        >
                                            <span>Simular Qué Respondía el Cliente</span>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* PASO 4: SIMULACIÓN DE LO QUE HUBIERA RESPONDIDO EL CLIENTE */}
                            {activeInteractiveStep === 4 && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5">
                                            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                            Simulación Realista · Respuesta Natural del Prospecto
                                        </span>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-900">
                                            Si {activeCase.repName} hubiera hecho la pregunta de oro, el prospecto habría respondido:
                                        </span>
                                        <p className="text-sm font-bold text-slate-900 italic leading-relaxed">
                                            {activeCase.simulatedClientResponse}
                                        </p>
                                    </div>

                                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                                        <span className="text-[10px] font-black uppercase text-slate-700">
                                            Por qué este momento cambia el rumbo de la llamada:
                                        </span>
                                        <p className="text-slate-700 font-medium">
                                            El cliente acaba de admitir y verbalizar en voz alta su dolor económico o su proceso real. Ahora el vendedor tiene la autoridad absoluta para proponer el cierre.
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between pt-2">
                                        <button
                                            onClick={() => setActiveInteractiveStep(3)}
                                            className="text-xs font-bold text-slate-500 hover:text-slate-900"
                                        >
                                            ← Ver Pregunta de Oro
                                        </button>
                                        <button
                                            onClick={() => setActiveInteractiveStep(5)}
                                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                                        >
                                            <span>Ver Jugada de Cierre o Amarre</span>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* PASO 5: JUGADA DE CIERRE O AMARRE FINAL */}
                            {activeInteractiveStep === 5 && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1.5">
                                            <Award className="w-3.5 h-3.5" />
                                            Remate de Venta · Cómo Amarrar la Cita o el Cierre
                                        </span>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50 via-white to-purple-50 border-2 border-purple-300 space-y-2">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-purple-800">
                                            Guión de Remate del Asesor:
                                        </span>
                                        <p className="text-sm font-black text-slate-900 leading-relaxed">
                                            🎯 {activeCase.closingPlay}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                                            <span className="text-[10px] font-black uppercase text-indigo-700">
                                                Impacto Comercial Garantizado:
                                            </span>
                                            <p className="text-slate-700 font-medium">
                                                {activeCase.businessImpact}
                                            </p>
                                        </div>

                                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
                                            <span className="text-[10px] font-black uppercase text-emerald-800">
                                                Roleplay de 2 Minutos para Hoy:
                                            </span>
                                            <p className="text-slate-800 font-medium">
                                                {activeCase.suggestedRoleplay}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2">
                                        <button
                                            onClick={() => setActiveInteractiveStep(4)}
                                            className="text-xs font-bold text-slate-500 hover:text-slate-900"
                                        >
                                            ← Ver Qué Respondía el Cliente
                                        </button>
                                        <button
                                            onClick={() => {
                                                // Avanzar al siguiente caso si existe
                                                const nextIdx = (activeCaseIndex + 1) % repOpportunities.length;
                                                setActiveCaseIndex(nextIdx);
                                                setActiveInteractiveStep(1);
                                                toast.success(`Cargando caso: ${repOpportunities[nextIdx].clientName}`);
                                            }}
                                            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                                        >
                                            <span>Siguiente Demostración</span>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ─── FOOTER MINIMALISTA CON GUÍA RÁPIDA DE COACHING 1:1 ─── */}
                <div className="px-6 py-3.5 bg-slate-900 border-t border-slate-800 text-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>
                            <strong>Regla de Oro del Coach:</strong> En la sesión 1:1, haz que {repName} repita la pregunta en voz alta 3 veces hasta que le salga sin titubear.
                        </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={handleCopyAllScript}
                            className="px-4 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                        >
                            {copiedFullPlan ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedFullPlan ? '¡Plan Copiado!' : 'Copiar Plan para Diana'}</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all cursor-pointer"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
