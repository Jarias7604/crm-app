// src/components/leads/LiveDemoHUDModal.tsx
// Copiloto y Guion de Demo en Vivo para Vendedores (Método ARIAS Sales Excellence)

import React, { useState } from 'react';
import {
    X, CheckCircle, HelpCircle, ShieldAlert, Sparkles,
    ChevronDown, ChevronUp, Copy, DollarSign, Target, Clock, MessageSquare, Flame,
    Shield, FileCheck, Package, FileText
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
        <div className="fixed inset-0 z-[10000] flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-white border-l border-slate-200 shadow-2xl flex flex-col h-full text-slate-800 overflow-hidden">
                {/* Header Superior Limpio */}
                <div className="px-6 py-5 bg-white border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-xs">
                            <Flame className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-black tracking-tight text-slate-900">
                                    Modo Demo en Vivo · Método ARIAS
                                </h3>
                                <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                                    En llamada
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                Prospecto: <strong className="text-slate-800 font-bold">{leadName}</strong> {leadCompany && `· ${leadCompany}`}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
                        title="Cerrar copiloto"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Progress bar de preguntas */}
                <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-bold">Descubrimiento obligatorio:</span>
                        <span className={`font-black ${answeredCount >= 5 ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {answeredCount} de {ARIAS_DISCOVERY_QUESTIONS.length} preguntas
                        </span>
                    </div>
                    <div className="w-36 bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-rose-500 to-rose-600 transition-all duration-300"
                            style={{ width: `${(answeredCount / ARIAS_DISCOVERY_QUESTIONS.length) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Navigation Tabs (Sin emojis, con iconos vectoriales limpios) */}
                <div className="px-6 pt-2 bg-white border-b border-slate-200 flex gap-2">
                    <button
                        onClick={() => setActiveTab('questions')}
                        className={`pb-3 px-3 text-xs font-black tracking-wide transition-all border-b-2 flex items-center gap-1.5 ${
                            activeTab === 'questions'
                                ? 'border-rose-600 text-rose-700'
                                : 'border-transparent text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        <Target className="w-3.5 h-3.5 text-rose-600" />
                        <span>7 Preguntas Obligatorias</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('objections')}
                        className={`pb-3 px-3 text-xs font-black tracking-wide transition-all border-b-2 flex items-center gap-1.5 ${
                            activeTab === 'objections'
                                ? 'border-rose-600 text-rose-700'
                                : 'border-transparent text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        <Shield className="w-3.5 h-3.5 text-amber-600" />
                        <span>Respuestas a Objeciones</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('rules')}
                        className={`pb-3 px-3 text-xs font-black tracking-wide transition-all border-b-2 flex items-center gap-1.5 ${
                            activeTab === 'rules'
                                ? 'border-rose-600 text-rose-700'
                                : 'border-transparent text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        <FileCheck className="w-3.5 h-3.5 text-blue-600" />
                        <span>Reglas de Pruebas & Cotización</span>
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
                    {/* Tab 1: 7 Preguntas de Descubrimiento */}
                    {activeTab === 'questions' && (
                        <div className="space-y-3.5">
                            <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200/80 text-xs text-rose-900 flex items-start gap-2.5">
                                <Sparkles className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                <div className="leading-relaxed">
                                    <strong className="text-rose-950">Estándar comercial ARIAS:</strong> Haz estas preguntas <em>antes</em> de compartir pantalla. Nunca des un "paseo de módulos" sin conocer el costo del problema y quién decide.
                                </div>
                            </div>

                            {ARIAS_DISCOVERY_QUESTIONS.map((q) => {
                                const isChecked = checkedQuestions[q.id];
                                return (
                                    <div
                                        key={q.id}
                                        className={`p-4 rounded-2xl border transition-all ${
                                            isChecked
                                                ? 'bg-emerald-50/40 border-emerald-300 shadow-xs'
                                                : 'bg-white border-slate-200 hover:border-rose-300 shadow-xs'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <button
                                                type="button"
                                                onClick={() => toggleQuestionCheck(q.id)}
                                                className={`mt-0.5 w-5 h-5 rounded-lg flex items-center justify-center border transition-all shrink-0 ${
                                                    isChecked
                                                        ? 'bg-emerald-600 border-emerald-600 text-white'
                                                        : 'border-slate-300 hover:border-rose-400 bg-white'
                                                }`}
                                            >
                                                {isChecked && <CheckCircle className="w-3.5 h-3.5" />}
                                            </button>

                                            <div className="flex-1 space-y-1.5">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-600">
                                                        #{q.id} · {q.category}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-medium">{q.purpose}</span>
                                                </div>

                                                <p className="text-sm font-extrabold text-slate-900 leading-snug">
                                                    {q.question}
                                                </p>

                                                <input
                                                    type="text"
                                                    value={questionAnswers[q.id] || ''}
                                                    onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                                    placeholder={q.exampleHint}
                                                    className="w-full mt-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
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
                        <div className="space-y-3.5">
                            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <div className="leading-relaxed">
                                    <strong className="text-amber-950">Método ESCUCHAR:</strong> Nunca interrumpas al cliente. No ofrezcas descuentos por desesperación ni inventes escasez falsa. Responde siempre con preguntas de decisión condicionada.
                                </div>
                            </div>

                            {ARIAS_OBJECTION_SCRIPTS.map((obj) => {
                                const isExpanded = expandedObjection === obj.id;
                                return (
                                    <div
                                        key={obj.id}
                                        className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:border-slate-300 transition-all"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => setExpandedObjection(isExpanded ? null : obj.id)}
                                            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-black text-slate-900">{obj.label}</span>
                                            </div>
                                            {isExpanded ? (
                                                <ChevronUp className="w-4 h-4 text-slate-400" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4 text-slate-400" />
                                            )}
                                        </button>

                                        {isExpanded && (
                                            <div className="px-5 pb-5 pt-1 space-y-3.5 border-t border-slate-100 text-xs bg-slate-50/40">
                                                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-bold">
                                                    {obj.dangerWarning}
                                                </div>

                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                                        Paso 1: Sondear la causa real
                                                    </span>
                                                    <div className="p-3 bg-white rounded-xl border border-slate-200 text-slate-800 font-medium flex items-center justify-between shadow-xs">
                                                        <span>{obj.probeQuestion}</span>
                                                        <button
                                                            onClick={() => copyScript(obj.probeQuestion)}
                                                            className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                                                            title="Copiar frase"
                                                        >
                                                            <Copy className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">
                                                        Paso 2: Cierre Condicionado (Frase de Cierre)
                                                    </span>
                                                    <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-emerald-950 font-semibold flex items-center justify-between shadow-xs">
                                                        <span>{obj.decisionScript}</span>
                                                        <button
                                                            onClick={() => copyScript(obj.decisionScript)}
                                                            className="p-1.5 text-emerald-600 hover:text-emerald-800 transition-colors"
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
                        <div className="space-y-4 text-xs">
                            {/* Caso Prueba de 8 Días */}
                            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
                                        <Package className="w-4 h-4" />
                                    </div>
                                    <h4 className="text-sm font-black text-slate-900">Reglas Obligatorias para Pruebas (8 días)</h4>
                                </div>
                                <p className="text-slate-600 leading-relaxed font-medium">
                                    Nunca actives una prueba gratis "a ver si le gusta". Caso Luis Escobar: activar prueba ≠ venta. Toda prueba debe cumplir:
                                </p>
                                <ul className="space-y-2 text-slate-700 pl-2">
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-600 font-bold">1.</span>
                                        <span><strong>3 Criterios de Éxito:</strong> Acordar exactamente qué 3 tareas debe probar (ej. emitir 5 facturas, cuadrar caja y subir catálogo).</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-600 font-bold">2.</span>
                                        <span><strong>Decisor en la Evaluación:</strong> El dueño o quien paga debe estar en la reunión del día 8.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-emerald-600 font-bold">3.</span>
                                        <span><strong>Reunión de Cierre Agendada:</strong> No activar acceso hasta que la cita de decisión esté puesta en el calendario.</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Caso Cotizaciones */}
                            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
                                        <FileText className="w-4 h-4" />
                                    </div>
                                    <h4 className="text-sm font-black text-slate-900">Reglas para Cotizaciones Formales</h4>
                                </div>
                                <p className="text-slate-600 leading-relaxed font-medium">
                                    Caso Nehemías Regalo: <em>Enviar cotización no es cerrar la venta.</em>
                                </p>
                                <ul className="space-y-2 text-slate-700 pl-2">
                                    <li className="flex items-start gap-2">
                                        <span className="text-amber-600 font-bold">•</span>
                                        <span><strong>Revisión en Vivo:</strong> Nunca envíes un PDF esperando respuesta. Di: «¿Revisamos los números juntos 20 minutos el jueves a las 10:00 AM?»</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-amber-600 font-bold">•</span>
                                        <span><strong>Vigencia Real:</strong> La cotización debe tener una vigencia de 7 a 15 días máximos documentada.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-amber-600 font-bold">•</span>
                                        <span><strong>Responsable de Aprobación:</strong> Registrar en el CRM nombre y teléfono de quien firma el cheque o transferencia.</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer con Acciones */}
                <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">
                        {answeredCount} de {ARIAS_DISCOVERY_QUESTIONS.length} preguntas respondidas
                    </span>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleSaveSessionNotes}
                            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm shadow-rose-600/20 flex items-center gap-2 active:scale-95 cursor-pointer"
                        >
                            <Copy className="w-3.5 h-3.5" /> Guardar Notas en Lead
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
