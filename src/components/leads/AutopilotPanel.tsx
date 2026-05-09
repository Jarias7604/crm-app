/**
 * AutopilotPanel — Panel de Recomendaciones del Sales Autopilot
 * 
 * Muestra en el detalle de un lead:
 *  - La acción que el motor recomienda
 *  - El razonamiento del AI
 *  - Botones para EJECUTAR o descartar
 *  - Canal y mensaje generado
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Zap, Send, X, ChevronDown, ChevronUp, MessageSquare, Mail, Phone, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { runAutopilotForLead, type AutopilotAction } from '../../services/marketing/salesAutopilot';
import type { Lead } from '../../types';

interface AutopilotPanelProps {
    lead: Lead;
    companyId: string;
    onActionExecuted?: (action: AutopilotAction) => void;
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
    whatsapp:  <span className="text-emerald-600">📱 WhatsApp</span>,
    telegram:  <span className="text-sky-600">✈️ Telegram</span>,
    email:     <span className="text-blue-600">📧 Email</span>,
    internal:  <span className="text-gray-500">📋 Interno</span>,
};

const ACTION_LABELS: Record<string, string> = {
    send_discount_offer:   '🏷️ Oferta con Descuento',
    send_quote_link:       '📊 Enviar Cotización',
    switch_channel:        '🔄 Cambiar Canal',
    reactivate_lead:       '🔥 Reactivar Lead',
    escalate_to_human:     '👤 Escalar a Humano',
    send_testimonial:      '⭐ Enviar Casos de Éxito',
    schedule_followup:     '📅 Programar Seguimiento',
    update_stage:          '📈 Actualizar Etapa',
    send_value_proposition:'💎 Propuesta de Valor',
};

const PRIORITY_CONFIG = {
    1: { label: 'Inmediato', color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
    2: { label: 'Hoy',       color: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
    3: { label: 'Esta semana',color: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
};

export const AutopilotPanel: React.FC<AutopilotPanelProps> = ({ lead, companyId, onActionExecuted }) => {
    const [action, setAction] = useState<AutopilotAction | null>(null);
    const [loading, setLoading] = useState(true);
    const [executing, setExecuting] = useState(false);
    const [executed, setExecuted] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [showMessage, setShowMessage] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadRecommendation = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await runAutopilotForLead(lead.id, companyId, { execute: false });
            setAction(result.action);
        } catch (err: any) {
            setError('No se pudo analizar el lead');
        } finally {
            setLoading(false);
        }
    }, [lead.id, companyId]);

    useEffect(() => {
        loadRecommendation();
    }, [loadRecommendation]);

    const handleExecute = async () => {
        if (!action) return;
        setExecuting(true);
        try {
            const result = await runAutopilotForLead(lead.id, companyId, { execute: true });
            if (result.result?.success) {
                setExecuted(true);
                onActionExecuted?.(action);
            } else {
                setError(result.result?.error || 'Error al ejecutar la acción');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setExecuting(false);
        }
    };

    // No mostrar si no hay acción o fue descartada
    if (dismissed || (!loading && !action)) return null;

    const priorityConfig = action ? PRIORITY_CONFIG[action.priority] : null;

    return (
        <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-violet-100">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center shadow-sm">
                        <Zap className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <p className="text-xs font-black text-violet-800 uppercase tracking-widest">
                            AI Sales Autopilot
                        </p>
                        <p className="text-[9px] text-violet-400 font-semibold">
                            Motor de ventas autónomo
                        </p>
                    </div>
                </div>
                {!executed && (
                    <button
                        onClick={() => setDismissed(true)}
                        className="p-1 text-violet-300 hover:text-violet-600 rounded transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="p-4">
                {loading && (
                    <div className="flex items-center gap-3 py-2">
                        <Loader className="w-4 h-4 text-violet-500 animate-spin" />
                        <span className="text-xs text-violet-600 font-semibold">
                            Analizando datos del lead...
                        </span>
                    </div>
                )}

                {error && (
                    <div className="flex items-center gap-2 text-xs text-red-600">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {error}
                    </div>
                )}

                {executed && (
                    <div className="flex items-center gap-2 text-xs text-emerald-700 font-bold">
                        <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
                        ✅ Acción ejecutada — el mensaje está en cola de envío
                    </div>
                )}

                {!loading && !error && !executed && action && (
                    <div className="space-y-3">
                        {/* Action type + priority */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-violet-900">
                                {ACTION_LABELS[action.type] || action.type}
                            </span>
                            {priorityConfig && (
                                <span className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full border ${priorityConfig.color}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${priorityConfig.dot}`} />
                                    {priorityConfig.label}
                                </span>
                            )}
                            <span className="text-[10px] font-semibold">
                                {CHANNEL_ICONS[action.channel]}
                            </span>
                        </div>

                        {/* AI Reasoning */}
                        <div className="text-[10px] text-violet-700 bg-violet-100/60 rounded-lg px-3 py-2 border border-violet-100">
                            <span className="font-black text-violet-800">🧠 Razonamiento: </span>
                            {action.reasoning}
                        </div>

                        {/* Internal note */}
                        <div className="text-[10px] text-gray-500 bg-white/70 rounded-lg px-3 py-1.5 border border-gray-100">
                            {action.internalNote}
                        </div>

                        {/* Message preview toggle */}
                        <button
                            onClick={() => setShowMessage(!showMessage)}
                            className="flex items-center gap-1.5 text-[10px] font-bold text-violet-600 hover:text-violet-800 transition-colors"
                        >
                            <MessageSquare className="w-3 h-3" />
                            {showMessage ? 'Ocultar mensaje' : 'Ver mensaje que se enviará'}
                            {showMessage ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        {showMessage && (
                            <div className="bg-white rounded-xl border border-gray-100 p-3 text-[11px] text-gray-700 font-medium leading-relaxed whitespace-pre-line shadow-sm">
                                {action.message}
                            </div>
                        )}

                        {/* Discount badge */}
                        {action.discount && (
                            <div className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                                🏷️ Descuento del {action.discount}% incluido en la oferta
                            </div>
                        )}

                        {/* Execute button */}
                        <button
                            onClick={handleExecute}
                            disabled={executing}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-xs font-black rounded-xl transition-all shadow-sm hover:shadow-md"
                        >
                            {executing ? (
                                <>
                                    <Loader className="w-3.5 h-3.5 animate-spin" />
                                    Ejecutando...
                                </>
                            ) : (
                                <>
                                    <Send className="w-3.5 h-3.5" />
                                    Ejecutar ahora via {action.channel}
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
