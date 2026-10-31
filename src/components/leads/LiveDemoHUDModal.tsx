// src/components/leads/LiveDemoHUDModal.tsx
// Copiloto y Guion de Demo en Vivo para Vendedores (Método ARIAS Sales Excellence)

import React, { useState } from 'react';
import {
    X, CheckCircle, HelpCircle, ShieldAlert, Sparkles,
    ChevronDown, ChevronUp, Copy, DollarSign, Target, Clock, MessageSquare, Flame
} from 'lucide-react';
import {
    ARIAS_DISCOVERY_QUESTIONS,
    ARIAS_OBJECTION_SCRIPTS,
    type LiveDemoQuestion,
    type ObjectionScript
} from '../../types/salesExcellence';
import toast from 'react-hot-toast';

interface LiveDemoHUDModalProps {
    isOpen: boolean;
    onClose: () => void;
    leadName: string;
    leadCompany?: string;
    onApplyFindings?: (notes: string) => void;
}

export const LiveDemoHUDModal: React.FC<LiveDemoHUDModalProps> = ({
    isOpen,
    onClose,
    leadName,
    leadCompany,
    onApplyFindings
}) => {
    const [activeTab, setActiveTab] = useState<'questions' | 'objections' | 'rules'>('questions');
    const [checkedQuestions, setCheckedQuestions] = useState<Record<number, boolean>>({});
    const [questionAnswers, setQuestionAnswers] = useState<Record<number, string>>({});
    const [expandedObjection, setExpandedObjection] = useState<string | null>('price');

    if (!isOpen) return null;

    const toggleQuestionCheck = (id: number) => {
        setCheckedQuestions(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleAnswerChange = (id: number, text: string) => {
        setQuestionAnswers(prev => ({ ...prev, [id]: text }));
    };

    const copyScript = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Frase copiada al portapapeles');
    };

    const answeredCount = Object.keys(checkedQuestions).filter(k => checkedQuestions[Number(k)]).length;

    const handleSaveSessionNotes = () => {
        const lines: string[] = [`=== NOTAS DE DEMO (MÉTODO ARIAS) ===`];
        lines.push(`Prospecto: ${leadName} ${leadCompany ? `(${leadCompany})` : ''}`);
        lines.push(`Fecha: ${new Date().toLocaleDateString('es-ES')}`);
        lines.push(``);
        lines.push(`-- Preguntas de Descubrimiento realizadas: ${answeredCount}/${ARIAS_DISCOVERY_QUESTIONS.length} --`);

        ARIAS_DISCOVERY_QUESTIONS.forEach(q => {
            const isChecked = checkedQuestions[q.id];
            const answer = questionAnswers[q.id];
            if (isChecked || answer) {
                lines.push(`• [${isChecked ? '✓' : ' '}] ${q.question}`);
                if (answer) lines.push(`  Respuesta: ${answer}`);
            }
        });

        const compiled = lines.join('\n');
        if (onApplyFindings) {
            onApplyFindings(compiled);
            toast.success('Notas de descubrimiento agregadas al lead');
        } else {
            navigator.clipboard.writeText(compiled);
            toast.success('Notas copiadas al portapapeles');
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex justify-end bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full text-slate-100 overflow-hidden">
                {/* Header Superior */}
                <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-indigo-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                            <Flame className="w-5 h-5 text-amber-300" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-black tracking-tight text-white">
                                    Modo Demo en Vivo · Método ARIAS
                                </h3>
                                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                                    En llamada
                                </span>
                            </div>
                            <p className="text-xs text-indigo-200/70 font-medium">
                                Prospecto: <strong className="text-white">{leadName}</strong> {leadCompany && `· ${leadCompany}`}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Progress bar de preguntas */}
                <div className="px-6 py-2.5 bg-slate-950/70 border-b border-slate-800/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-bold">Descubrimiento obligatorio:</span>
                        <span className={`font-black ${answeredCount >= 5 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {answeredCount} de {ARIAS_DISCOVERY_QUESTIONS.length} preguntas
                        </span>
                    </div>
                    <div className="w-36 bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
                            style={{ width: `${(answeredCount / ARIAS_DISCOVERY_QUESTIONS.length) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="px-6 pt-3 bg-slate-900 border-b border-slate-800 flex gap-2">
                    <button
                        onClick={() => setActiveTab('questions')}
                        className={`pb-3 px-4 text-xs font-black tracking-wide transition-all border-b-2 ${
                            activeTab === 'questions'
                                ? 'border-indigo-400 text-indigo-300'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        🎯 7 Preguntas Obligatorias
                    </button>
                    <button
                        onClick={() => setActiveTab('objections')}
                        className={`pb-3 px-4 text-xs font-black tracking-wide transition-all border-b-2 ${
                            activeTab === 'objections'
                                ? 'border-indigo-400 text-indigo-300'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        ⚡ Respuestas a Objeciones (ESCUCHAR)
                    </button>
                    <button
                        onClick={() => setActiveTab('rules')}
                        className={`pb-3 px-4 text-xs font-black tracking-wide transition-all border-b-2 ${
                            activeTab === 'rules'
                                ? 'border-indigo-400 text-indigo-300'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        📋 Reglas de Pruebas & Cotización
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* Tab 1: 7 Preguntas de Descubrimiento */}
                    {activeTab === 'questions' && (
                        <div className="space-y-4">
                            <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/20 text-xs text-indigo-200 flex items-start gap-2.5">
                                <Sparkles className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <strong className="text-white">Estándar comercial ARIAS:</strong> Haz estas preguntas <em>antes</em> de compartir pantalla. Nunca des un "paseo de módulos" sin conocer el costo del problema y quién decide.
                                </div>
                            </div>

                            {ARIAS_DISCOVERY_QUESTIONS.map((q) => {
                                const isChecked = checkedQuestions[q.id];
                                return (
                                    <div
                                        key={q.id}
                                        className={`p-4 rounded-xl border transition-all ${
                                            isChecked
                                                ? 'bg-slate-800/80 border-emerald-500/40'
                                                : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <button
                                                type="button"
                                                onClick={() => toggleQuestionCheck(q.id)}
                                                className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border transition-all flex-shrink-0 ${
                                                    isChecked
                                                        ? 'bg-emerald-500 border-emerald-400 text-white'
                                                        : 'border-slate-600 hover:border-indigo-400 bg-slate-900/60'
                                                }`}
                                            >
                                                {isChecked && <CheckCircle className="w-3.5 h-3.5" />}
                                            </button>

                                            <div className="flex-1 space-y-1.5">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">
                                                        #{q.id} · {q.category}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400">{q.purpose}</span>
                                                </div>

                                                <p className="text-sm font-bold text-white leading-snug">
                                                    {q.question}
                                                </p>

                                                <input
                                                    type="text"
                                                    value={questionAnswers[q.id] || ''}
                                                    onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                                    placeholder={q.exampleHint}
                                                    className="w-full mt-2 px-3 py-2 bg-slate-900/90 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Tab 2: Matriz de Objeciones */}
                    {activeTab === 'objections' && (
                        <div className="space-y-4">
                            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-2.5">
                                <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <strong className="text-white">Método ESCUCHAR:</strong> Nunca interrumpas al cliente. No ofrezcas descuentos por desesperación ni inventes escasez falsa. Responde siempre con preguntas de decisión condicionada.
                                </div>
                            </div>

                            {ARIAS_OBJECTION_SCRIPTS.map((obj) => {
                                const isExpanded = expandedObjection === obj.id;
                                return (
                                    <div
                                        key={obj.id}
                                        className="bg-slate-800/60 border border-slate-700/80 rounded-xl overflow-hidden"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => setExpandedObjection(isExpanded ? null : obj.id)}
                                            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-800/80 transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-black text-white">{obj.label}</span>
                                            </div>
                                            {isExpanded ? (
                                                <ChevronUp className="w-4 h-4 text-slate-400" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4 text-slate-400" />
                                            )}
                                        </button>

                                        {isExpanded && (
                                            <div className="px-5 pb-5 pt-1 space-y-3.5 border-t border-slate-700/50 text-xs">
                                                <div className="p-2.5 bg-rose-950/40 border border-rose-500/30 rounded-lg text-rose-300 font-bold">
                                                    {obj.dangerWarning}
                                                </div>

                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-black uppercase text-indigo-400">Paso 1: Sondear la causa real</span>
                                                    <div className="p-3 bg-slate-900 rounded-lg border border-slate-700/80 text-slate-200 font-medium flex items-center justify-between">
                                                        <span>{obj.probeQuestion}</span>
                                                        <button
                                                            onClick={() => copyScript(obj.probeQuestion)}
                                                            className="p-1.5 text-slate-400 hover:text-white"
                                                            title="Copiar frase"
                                                        >
                                                            <Copy className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-black uppercase text-emerald-400">Paso 2: Cierre Condicionado (Frase de Cierre)</span>
                                                    <div className="p-3 bg-emerald-950/30 rounded-lg border border-emerald-500/30 text-emerald-100 font-semibold flex items-center justify-between">
                                                        <span>{obj.decisionScript}</span>
                                                        <button
                                                            onClick={() => copyScript(obj.decisionScript)}
                                                            className="p-1.5 text-emerald-400 hover:text-white"
                                                            title="Copiar frase"
                                                        >
                                                            <Copy className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Tab 3: Reglas de Pruebas y Cotizaciones */}
                    {activeTab === 'rules' && (
                        <div className="space-y-5 text-xs">
                            {/* Caso Prueba de 8 Días */}
                            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-850 border border-slate-700/80 space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">📦</span>
                                    <h4 className="text-sm font-black text-white">Reglas Obligatorias para Pruebas (8 días)</h4>
                                </div>
                                <p className="text-slate-300 leading-relaxed">
                                    Nunca actives una prueba gratis "a ver si le gusta". Caso Luis Escobar: activar prueba ≠ venta. Toda prueba debe cumplir:
                                </p>
                                <ul className="space-y-2 text-slate-200 pl-2">
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-400 font-bold">1.</span>
                                        <span><strong>3 Criterios de Éxito:</strong> Acordar exactamente qué 3 tareas debe probar (ej. emitir 5 facturas, cuadrar caja y subir catálogo).</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-400 font-bold">2.</span>
                                        <span><strong>Decisor en la Evaluación:</strong> El dueño o quien paga debe estar en la reunión del día 8.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-400 font-bold">3.</span>
                                        <span><strong>Reunión de Cierre Agendada:</strong> No activar acceso hasta que la cita de decisión esté puesta en el calendario.</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Caso Cotizaciones */}
                            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-850 border border-slate-700/80 space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">📋</span>
                                    <h4 className="text-sm font-black text-white">Reglas para Cotizaciones Formales</h4>
                                </div>
                                <p className="text-slate-300 leading-relaxed">
                                    Caso Nehemías Regalo: <em>Enviar cotización no es cerrar la venta.</em>
                                </p>
                                <ul className="space-y-2 text-slate-200 pl-2">
                                    <li className="flex items-start gap-2">
                                        <span className="text-amber-400 font-bold">•</span>
                                        <span><strong>Revisión en Vivo:</strong> Nunca envíes un PDF esperando respuesta. Di: «¿Revisamos los números juntos 20 minutos el jueves a las 10:00 AM?»</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-amber-400 font-bold">•</span>
                                        <span><strong>Vigencia Real:</strong> La cotización debe tener una vigencia de 7 a 15 días máximos documentada.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-amber-400 font-bold">•</span>
                                        <span><strong>Responsable de Aprobación:</strong> Registrar en el CRM nombre y teléfono de quien firma el cheque o transferencia.</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer con Acciones */}
                <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                        {answeredCount} de {ARIAS_DISCOVERY_QUESTIONS.length} preguntas respondidas
                    </span>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleSaveSessionNotes}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-600/30 flex items-center gap-2"
                        >
                            <Copy className="w-3.5 h-3.5" /> Guardar Notas en Lead
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
