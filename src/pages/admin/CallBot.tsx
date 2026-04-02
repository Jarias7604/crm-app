import { useState, useEffect, useCallback } from 'react';
import {
    Phone, Settings, Zap, Activity, CheckCircle2, XCircle,
    Clock, RefreshCw, Play, StopCircle, Bot,
    PhoneCall, PhoneIncoming, PhoneMissed, BarChart2,
    AlertTriangle, X, MessageSquare, ChevronRight,
    ToggleLeft, ToggleRight, ArrowRight, Calendar, Mic
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import {
    callBotService, type CallBotConfig, type CallQueueItem,
    type CallBotStats, DEFAULT_CALL_BOT_CONFIG
} from '../../services/callBot';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    pending:   { label: 'Pendiente',  color: 'text-amber-600',   bg: 'bg-amber-50',   icon: <Clock className="w-3.5 h-3.5" /> },
    calling:   { label: 'Llamando',   color: 'text-blue-600',    bg: 'bg-blue-50',    icon: <PhoneCall className="w-3.5 h-3.5 animate-pulse" /> },
    completed: { label: 'Completada', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    no_answer: { label: 'Sin resp.',  color: 'text-gray-500',    bg: 'bg-gray-100',   icon: <PhoneMissed className="w-3.5 h-3.5" /> },
    cancelled: { label: 'Cancelada',  color: 'text-gray-400',    bg: 'bg-gray-50',    icon: <StopCircle className="w-3.5 h-3.5" /> },
    failed:    { label: 'Error',      color: 'text-red-600',     bg: 'bg-red-50',     icon: <XCircle className="w-3.5 h-3.5" /> },
};
const OUTCOME_CFG: Record<string, { label: string; color: string }> = {
    connected_qualified:     { label: '✅ Calificó',      color: 'text-emerald-700' },
    connected_not_qualified: { label: '❌ No calificó',   color: 'text-red-600'     },
    no_answer:               { label: '📵 Sin respuesta', color: 'text-gray-500'    },
    voicemail:               { label: '📨 Buzón',         color: 'text-purple-600'  },
    error:                   { label: '⚠️ Error',         color: 'text-red-500'     },
};

// ─── Pipeline Flow Diagram ────────────────────────────────────────────────────
function PipelineFlowMap({ mapping, stages, onChange }: {
    mapping: CallBotConfig['outcome_mapping'];
    stages: string[];
    onChange: (m: CallBotConfig['outcome_mapping']) => void;
}) {
    const outcomes = [
        { key: 'connected_qualified', label: '✅ Calificó', color: 'bg-emerald-100 border-emerald-300 text-emerald-800' },
        { key: 'demo_booked', label: '📅 Demo agendada', color: 'bg-purple-100 border-purple-300 text-purple-800' },
        { key: 'connected_not_qualified', label: '❌ No calificó', color: 'bg-red-100 border-red-300 text-red-800' },
        { key: 'no_answer', label: '📵 Sin respuesta', color: 'bg-gray-100 border-gray-300 text-gray-700' },
    ] as const;

    return (
        <div className="space-y-3">
            <p className="text-xs text-gray-500 font-medium">Cuando termine una llamada, el lead se moverá automáticamente a la etapa que configures:</p>
            {outcomes.map(({ key, label, color }) => (
                <div key={key} className="flex items-center gap-3">
                    <div className={`flex-none px-3 py-2 rounded-xl border text-xs font-bold ${color} min-w-[160px] text-center`}>
                        {label}
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 flex-none" />
                    <select
                        value={(mapping as unknown as Record<string, string>)[key] || ''}
                        onChange={e => onChange({ ...mapping, [key]: e.target.value })}
                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-violet-400 transition appearance-none"
                    >
                        <option value="">— Sin cambio —</option>
                        {stages.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            ))}
        </div>
    );
}

// ─── Setup Wizard ─────────────────────────────────────────────────────────────
const STEPS = ['Vapi', 'Agente', 'Disparadores', 'Pipeline', 'Confirmar'];

function SetupWizard({ config, stages, onSave, onClose }: {
    config: CallBotConfig;
    stages: string[];
    onSave: (c: Partial<CallBotConfig>) => Promise<void>;
    onClose: () => void;
}) {
    const [step, setStep] = useState(0);
    const [form, setForm] = useState<CallBotConfig>({ ...config });
    const [saving, setSaving] = useState(false);
    const upd = (p: Partial<CallBotConfig>) => setForm(prev => ({ ...prev, ...p }));

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave({ ...form, enabled: true });
            toast.success('¡Call Bot configurado y activo!');
            onClose();
        } catch { toast.error('Error al guardar'); }
        finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-7 pt-6 pb-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                                <Bot className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-white">Configurar Call Bot</h3>
                                <p className="text-[9px] text-white/60 font-bold uppercase tracking-widest">Paso {step + 1} de {STEPS.length}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl text-white/70 hover:text-white">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex gap-1.5">
                        {STEPS.map((s, i) => (
                            <button key={s} onClick={() => setStep(i)}
                                className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all ${i === step ? 'bg-white text-indigo-700' : i < step ? 'bg-white/30 text-white' : 'bg-white/10 text-white/40'}`}>
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4 overflow-y-auto max-h-[62vh]">

                    {/* Step 0 — Vapi */}
                    {step === 0 && (
                        <div className="space-y-4">
                            <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4">
                                <p className="text-xs font-black text-violet-700 mb-1">🔑 Conecta tu cuenta Vapi</p>
                                <p className="text-[11px] text-violet-500">Vapi usa voces de ElevenLabs/OpenAI — 100% natural, no robótico.</p>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">API Key Privada de Vapi</label>
                                <input className="mt-1.5 w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-mono focus:ring-2 focus:ring-violet-400 transition"
                                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                    value={form.vapi_api_key}
                                    onChange={e => upd({ vapi_api_key: e.target.value.trim() })} />
                                <p className="text-[10px] text-gray-400 mt-1 ml-1">dashboard.vapi.ai → API Keys → Private Key</p>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ID del Asistente Vapi</label>
                                <input className="mt-1.5 w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-mono focus:ring-2 focus:ring-violet-400 transition"
                                    placeholder="e5b5aac9-5f4f-43b2-8079-6a296f2d5f6e"
                                    value={form.vapi_assistant_id}
                                    onChange={e => upd({ vapi_assistant_id: e.target.value.trim() })} />
                                <p className="text-[10px] text-gray-400 mt-1 ml-1">dashboard.vapi.ai → Assistants → selecciona "Sofia - Arias CRM"</p>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ID del Número de Teléfono</label>
                                <input className="mt-1.5 w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-mono focus:ring-2 focus:ring-violet-400 transition"
                                    placeholder="fc4554b3-6774-4392-bbb8-faafc5c5f161"
                                    value={form.vapi_phone_number_id}
                                    onChange={e => upd({ vapi_phone_number_id: e.target.value.trim() })} />
                                <p className="text-[10px] text-gray-400 mt-1 ml-1">dashboard.vapi.ai → Phone Numbers → "Arias CRM - Sofia" → copia el ID</p>
                            </div>
                            {/* Quick fill for known values */}
                            <button
                                onClick={() => upd({
                                    vapi_api_key: 'a4eaa6da-78c5-49be-8c3d-672b63280af3',
                                    vapi_assistant_id: 'e5b5aac9-5f4f-43b2-8079-6a296f2d5f6e',
                                    vapi_phone_number_id: 'fc4554b3-6774-4392-bbb8-faafc5c5f161',
                                    vapi_phone_number: '+1 (681) 822-9167',
                                })}
                                className="w-full py-2.5 bg-indigo-50 border border-dashed border-indigo-200 rounded-2xl text-xs font-black text-indigo-600 hover:bg-indigo-100 transition"
                            >
                                ⚡ Autocompletar con credenciales de Arias CRM
                            </button>
                        </div>
                    )}

                    {/* Step 1 — Agente */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nombre del Agente AI</label>
                                <input className="mt-1.5 w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-violet-400"
                                    placeholder="Sofía, Carlos, María..."
                                    value={form.agent_name}
                                    onChange={e => upd({ agent_name: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Horario de llamadas</label>
                                <div className="grid grid-cols-2 gap-3 mt-1.5">
                                    <div>
                                        <p className="text-[9px] text-gray-400 mb-1">Desde</p>
                                        <input type="time" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold"
                                            value={form.call_hours.start}
                                            onChange={e => upd({ call_hours: { ...form.call_hours, start: e.target.value } })} />
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-gray-400 mb-1">Hasta</p>
                                        <input type="time" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold"
                                            value={form.call_hours.end}
                                            onChange={e => upd({ call_hours: { ...form.call_hours, end: e.target.value } })} />
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50 rounded-2xl p-4">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Días activos</label>
                                <div className="flex gap-2 mt-2 flex-wrap">
                                    {[['MON','Lun'],['TUE','Mar'],['WED','Mié'],['THU','Jue'],['FRI','Vie'],['SAT','Sáb'],['SUN','Dom']].map(([k, lbl]) => (
                                        <button key={k} onClick={() => {
                                            const days = form.call_days.includes(k)
                                                ? form.call_days.filter(d => d !== k)
                                                : [...form.call_days, k];
                                            upd({ call_days: days });
                                        }} className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${form.call_days.includes(k) ? 'bg-violet-600 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-500'}`}>
                                            {lbl}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ── Guión del Agente ── */}
                            <div className="border-t border-gray-100 pt-4 space-y-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <Mic className="w-3.5 h-3.5 text-violet-500" />
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Guión del Agente</p>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Primer mensaje (al contestar)</label>
                                    <input
                                        className="mt-1.5 w-full px-4 py-3 bg-violet-50 border border-violet-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-violet-400 transition"
                                        placeholder="Ej: Buenas, con quien tengo el gusto? Soy Sofia de Arias Defense."
                                        value={form.first_message ?? ''}
                                        onChange={e => upd({ first_message: e.target.value })}
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1 ml-1">Exactamente lo primero que dirá la IA al contestar la llamada.</p>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Instrucciones (System Prompt)</label>
                                        <span className="text-[9px] text-gray-300 font-bold">{(form.system_prompt ?? '').length} chars</span>
                                    </div>
                                    <textarea
                                        rows={7}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-medium text-gray-700 focus:ring-2 focus:ring-violet-400 transition resize-none leading-relaxed"
                                        placeholder="Describe quién es el agente, qué puede y no puede decir, cuál es su misión..."
                                        value={form.system_prompt ?? ''}
                                        onChange={e => upd({ system_prompt: e.target.value })}
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1 ml-1">El agente seguirá estas instrucciones durante toda la llamada. Incluye reglas de idioma, tono, y misión.</p>
                                </div>

                                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                                    <p className="text-[10px] font-black text-amber-700 mb-1">💡 Tips para sonar más humano</p>
                                    <ul className="text-[10px] text-amber-600 space-y-0.5 list-disc ml-3">
                                        <li>Di "NUNCA digas que eres una IA"</li>
                                        <li>Limita a 1-2 oraciones por respuesta</li>
                                        <li>Di que escuche y reaccione antes de preguntar</li>
                                        <li>Prohíbe explícitamente mencionar precios</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2 — Disparadores */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <p className="text-sm font-black text-gray-900">⏱️ Lead nuevo → llamar en</p>
                                        <p className="text-[11px] text-gray-500">Cuando llega un lead al CRM con teléfono</p>
                                    </div>
                                    <button onClick={() => upd({
                                        triggers: {
                                            ...form.triggers,
                                            new_lead_minutes: form.triggers.new_lead_minutes === null ? 59 : null
                                        }
                                    })} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all ${form.triggers.new_lead_minutes !== null ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                        {form.triggers.new_lead_minutes !== null ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                                        {form.triggers.new_lead_minutes !== null ? 'ON' : 'OFF'}
                                    </button>
                                </div>
                                {form.triggers.new_lead_minutes !== null && (
                                    <div className="flex items-center gap-3">
                                        <input type="number" min={1} max={1440}
                                            className="w-20 px-3 py-2 bg-white border border-violet-200 rounded-xl text-sm font-black text-center"
                                            value={form.triggers.new_lead_minutes}
                                            onChange={e => upd({ triggers: { ...form.triggers, new_lead_minutes: parseInt(e.target.value) || 59 } })} />
                                        <span className="text-sm text-gray-600 font-medium">minutos después de ser registrado</span>
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Reintentos si no contesta</label>
                                <div className="flex items-center gap-3 mt-1.5">
                                    <select className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold appearance-none"
                                        value={form.max_retries}
                                        onChange={e => upd({ max_retries: parseInt(e.target.value) })}>
                                        {[0, 1, 2, 3].map(n => <option key={n} value={n}>{n} {n === 1 ? 'reintento' : 'reintentos'}</option>)}
                                    </select>
                                    <span className="text-sm text-gray-500 flex-none">cada</span>
                                    <select className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold appearance-none"
                                        value={form.retry_hours}
                                        onChange={e => upd({ retry_hours: parseInt(e.target.value) })}>
                                        {[1, 2, 3, 4, 6, 8, 24].map(h => <option key={h} value={h}>{h}h</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3 — Pipeline */}
                    {step === 3 && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                                <p className="text-xs font-black text-blue-700 mb-1">🔁 Mapa de resultados → Embudo de ventas</p>
                                <p className="text-[11px] text-blue-500">Al terminar cada llamada, el lead se mueve automáticamente a la etapa configurada.</p>
                            </div>
                            <PipelineFlowMap
                                mapping={form.outcome_mapping}
                                stages={stages}
                                onChange={m => upd({ outcome_mapping: m })}
                            />
                        </div>
                    )}

                    {/* Step 4 — Confirmar */}
                    {step === 4 && (
                        <div className="space-y-3">
                            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 space-y-2.5">
                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Resumen</p>
                                {[
                                    ['Proveedor', 'Vapi AI (voz natural)'],
                                    ['Número', form.vapi_phone_number || 'Vapi #fc4554b3'],
                                    ['Agente', form.agent_name],
                                    ['Horario', `${form.call_hours.start} – ${form.call_hours.end}`],
                                    ['Trigger', form.triggers.new_lead_minutes ? `Leads nuevos en ${form.triggers.new_lead_minutes} min` : 'Solo manual'],
                                    ['Reintentos', `${form.max_retries}x cada ${form.retry_hours}h`],
                                    ['Calificó →', form.outcome_mapping.connected_qualified || '—'],
                                    ['Sin resp →', form.outcome_mapping.no_answer || '—'],
                                ].map(([k, v]) => (
                                    <div key={k} className="flex justify-between gap-3">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">{k}</span>
                                        <span className="text-xs font-bold text-gray-800 truncate">{v}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-700 font-medium">Al activar, el bot llamará leads automáticamente. Puedes pausarlo en cualquier momento.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                    <button onClick={() => step > 0 ? setStep(s => s - 1) : onClose()}
                        className="px-4 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 transition">
                        {step > 0 ? '← Anterior' : 'Cancelar'}
                    </button>
                    {step < STEPS.length - 1 ? (
                        <button onClick={() => setStep(s => s + 1)}
                            className="bg-violet-600 text-white px-6 py-2.5 rounded-xl text-sm font-black hover:bg-violet-700 transition shadow-lg shadow-violet-200 flex items-center gap-2">
                            Siguiente <ChevronRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button onClick={handleSave} disabled={saving}
                            className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-black hover:bg-emerald-700 transition shadow-lg shadow-emerald-200 flex items-center gap-2 disabled:opacity-50">
                            <Zap className="w-4 h-4" />
                            {saving ? 'Activando...' : 'Activar Call Bot'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Transcript Viewer ────────────────────────────────────────────────────────
function TranscriptViewer({ call, onClose }: { call: CallQueueItem; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div>
                        <p className="text-sm font-black text-gray-900">{call.lead?.name ?? 'Lead'}</p>
                        <p className="text-[10px] text-gray-400">
                            {call.outcome ? OUTCOME_CFG[call.outcome]?.label : '—'} ·
                            {call.duration_seconds ? ` ${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s` : ''}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
                </div>
                {call.summary && (
                    <div className="px-6 py-3 bg-violet-50 border-b border-violet-100">
                        <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest mb-1">Resumen AI</p>
                        <p className="text-xs text-violet-800 font-medium">{call.summary}</p>
                    </div>
                )}
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    {call.transcript.length === 0 ? (
                        <p className="text-center text-sm text-gray-300 font-bold py-8">Sin transcripción disponible</p>
                    ) : call.transcript.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'bot' ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${msg.role === 'bot' ? 'bg-violet-50 text-violet-900' : 'bg-gray-900 text-white'}`}>
                                <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${msg.role === 'bot' ? 'text-violet-400' : 'text-gray-400'}`}>
                                    {msg.role === 'bot' ? '🤖 Sofía' : '👤 Lead'}
                                </p>
                                <p className="text-xs font-medium leading-relaxed">{msg.content}</p>
                            </div>
                        </div>
                    ))}
                </div>
                {call.ai_score !== null && (
                    <div className="px-6 py-3 border-t border-gray-100 flex items-center gap-3">
                        <span className="text-[10px] font-black text-gray-400 uppercase">Score AI</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-violet-500" style={{ width: `${call.ai_score}%` }} />
                        </div>
                        <span className="text-sm font-black text-violet-600">{call.ai_score}/100</span>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CallBot() {
    const { profile } = useAuth();
    const [config, setConfig] = useState<CallBotConfig>(DEFAULT_CALL_BOT_CONFIG);
    const [queue, setQueue] = useState<CallQueueItem[]>([]);
    const [stats, setStats] = useState<CallBotStats | null>(null);
    const [stages, setStages] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSetup, setShowSetup] = useState(false);
    const [selectedCall, setSelectedCall] = useState<CallQueueItem | null>(null);
    const [triggering, setTriggering] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!profile?.company_id) return;
        try {
            const [cfg, q, s, st] = await Promise.all([
                callBotService.getConfig(profile.company_id),
                callBotService.getQueue(profile.company_id),
                callBotService.getStats(profile.company_id),
                callBotService.getLeadStatuses(profile.company_id),
            ]);
            setConfig(cfg);
            setQueue(q);
            setStats(s);
            setStages(st);
        } catch { toast.error('Error al cargar Call Bot'); }
        finally { setLoading(false); }
    }, [profile?.company_id]);

    useEffect(() => { load(); }, [load]);

    const handleSaveConfig = async (patch: Partial<CallBotConfig>) => {
        if (!profile?.company_id) return;
        await callBotService.saveConfig(profile.company_id, patch);
        setConfig(p => ({ ...p, ...patch }));
        await load();
    };

    const handleToggle = async () => {
        if (!config.vapi_api_key && !config.enabled) { setShowSetup(true); return; }
        await handleSaveConfig({ enabled: !config.enabled });
        toast.success(config.enabled ? 'Call Bot pausado' : '✅ Call Bot activado');
    };

    const handleTriggerCall = async (queueId: string) => {
        setTriggering(queueId);
        try {
            const res = await callBotService.triggerVapiCall(queueId);
            if (res.success) { toast.success('📞 Llamada iniciada'); load(); }
            else toast.error(res.error || 'Error al iniciar llamada');
        } catch { toast.error('Error al iniciar llamada'); }
        finally { setTriggering(null); }
    };

    const isVapiConfigured = !!(config.vapi_api_key && config.vapi_assistant_id && config.vapi_phone_number_id);

    return (
        <div className="h-full overflow-y-auto p-5 space-y-5">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-200">
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                        Call Bot AI
                    </h1>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5 ml-11">
                        Agente Vapi · Español latinoamericano · Voz natural
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={load} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button onClick={() => setShowSetup(true)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 shadow-sm">
                        <Settings className="w-4 h-4 text-violet-500" />
                        Configurar
                    </button>
                    <button onClick={handleToggle}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all ${config.enabled
                            ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-200'
                            : 'bg-violet-600 hover:bg-violet-700 text-white shadow-violet-200'}`}>
                        {config.enabled ? <><StopCircle className="w-4 h-4" />Pausar</> : <><Play className="w-4 h-4" />Activar Bot</>}
                    </button>
                </div>
            </div>

            {/* Status banner */}
            <div className={`rounded-2xl border p-4 flex items-center gap-3 transition-all ${config.enabled ? 'bg-emerald-50 border-emerald-200' : isVapiConfigured ? 'bg-gray-50 border-gray-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className={`w-3 h-3 rounded-full shrink-0 ${config.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
                <div className="flex-1">
                    <p className={`text-sm font-black ${config.enabled ? 'text-emerald-700' : 'text-gray-600'}`}>
                        {config.enabled
                            ? `✅ Call Bot activo — Agente "${config.agent_name}" · Vapi`
                            : isVapiConfigured
                                ? `⚪ Bot pausado — Agente "${config.agent_name}" configurado`
                                : '⚠️ Sin configurar — Abre el asistente de configuración'}
                    </p>
                    {config.enabled && (
                        <p className="text-[11px] text-emerald-600 mt-0.5">
                            {config.vapi_phone_number || 'Vapi #fc4554b3'} ·
                            {config.call_hours.start}–{config.call_hours.end} ·
                            {config.triggers.new_lead_minutes ? ` Llama en ${config.triggers.new_lead_minutes} min` : ' Solo manual'}
                        </p>
                    )}
                </div>
                {!isVapiConfigured && (
                    <button onClick={() => setShowSetup(true)}
                        className="ml-auto px-3 py-1.5 bg-violet-600 text-white text-xs font-black rounded-xl hover:bg-violet-700 whitespace-nowrap">
                        Configurar →
                    </button>
                )}
            </div>

            {/* KPI Strip */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {[
                        { label: 'Hoy', val: stats.total_today, color: 'text-gray-800', bg: 'bg-gray-100', icon: <Phone className="w-4 h-4 text-gray-500" /> },
                        { label: 'Esta semana', val: stats.total_week, color: 'text-gray-700', bg: 'bg-gray-50', icon: <BarChart2 className="w-4 h-4 text-gray-400" /> },
                        { label: 'Pendientes', val: stats.pending, color: 'text-amber-700', bg: 'bg-amber-50', icon: <Clock className="w-4 h-4 text-amber-500" /> },
                        { label: 'Conectadas', val: stats.connected, color: 'text-blue-700', bg: 'bg-blue-50', icon: <PhoneIncoming className="w-4 h-4 text-blue-500" /> },
                        { label: 'Calificaron', val: stats.qualified, color: 'text-emerald-700', bg: 'bg-emerald-50', icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" /> },
                        { label: 'Demos', val: stats.demos_booked, color: 'text-purple-700', bg: 'bg-purple-50', icon: <Calendar className="w-4 h-4 text-purple-500" /> },
                        { label: 'Tasa contacto', val: `${stats.contact_rate}%`, color: 'text-indigo-700', bg: 'bg-indigo-50', icon: <Activity className="w-4 h-4 text-indigo-500" /> },
                    ].map((k, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 hover:shadow-md transition-shadow">
                            <div className={`w-7 h-7 rounded-lg ${k.bg} flex items-center justify-center mb-2`}>{k.icon}</div>
                            <p className={`text-xl font-black ${k.color}`}>{k.val}</p>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider mt-0.5">{k.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Pipeline Flow Preview */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Flujo de resultados → Embudo</p>
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    <div className="flex-none text-center">
                        <div className="w-20 h-16 bg-violet-100 rounded-2xl flex flex-col items-center justify-center gap-1 border border-violet-200">
                            <Mic className="w-5 h-5 text-violet-600" />
                            <span className="text-[9px] font-black text-violet-700">LLAMADA</span>
                        </div>
                    </div>
                    {[
                        { label: '✅ Calificó', target: config.outcome_mapping.connected_qualified, color: 'bg-emerald-50 border-emerald-200' },
                        { label: '📅 Demo', target: config.outcome_mapping.demo_booked, color: 'bg-purple-50 border-purple-200' },
                        { label: '❌ No calificó', target: config.outcome_mapping.connected_not_qualified, color: 'bg-red-50 border-red-200' },
                        { label: '📵 Sin resp.', target: config.outcome_mapping.no_answer, color: 'bg-gray-100 border-gray-200' },
                    ].map(({ label, target, color }) => (
                        <div key={label} className="flex items-center gap-2 flex-none">
                            <ArrowRight className="w-4 h-4 text-gray-200" />
                            <div className={`rounded-xl border px-3 py-2 ${color}`}>
                                <p className="text-[9px] font-black text-gray-600">{label}</p>
                                <p className="text-[10px] font-bold text-gray-800 mt-0.5">{target || '—'}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <button onClick={() => setShowSetup(true)} className="mt-3 text-[10px] font-black text-violet-500 hover:text-violet-700 transition">
                    ✏️ Modificar mapeo
                </button>
            </div>

            {/* Queue Table */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                    <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Cola de llamadas</p>
                    <p className="text-[10px] text-gray-400 font-bold">{queue.length} registros</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-gray-50 bg-gray-50/40">
                                {['Lead / Teléfono', 'Trigger', 'Estado', 'Resultado', 'Score', 'Agendada', 'Acciones'].map(h => (
                                    <th key={h} className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? Array.from({ length: 4 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    {Array.from({ length: 7 }).map((_, j) => (
                                        <td key={j} className="px-4 py-4"><div className="h-3 bg-gray-100 rounded-full" /></td>
                                    ))}
                                </tr>
                            )) : queue.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center">
                                        <Bot className="w-10 h-10 text-gray-100 mx-auto mb-3" />
                                        <p className="text-sm font-bold text-gray-300">
                                            {config.enabled ? 'Sin llamadas aún' : 'Activa el bot para empezar'}
                                        </p>
                                    </td>
                                </tr>
                            ) : queue.map(call => {
                                const sc = STATUS_CFG[call.status] ?? STATUS_CFG.failed;
                                const oc = call.outcome ? OUTCOME_CFG[call.outcome] : null;
                                return (
                                    <tr key={call.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-4 py-3.5">
                                            <p className="text-sm font-black text-gray-900">{call.lead?.name ?? '—'}</p>
                                            <p className="text-[10px] text-gray-400">{call.lead?.phone ?? 'Sin teléfono'}</p>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <span className="text-[9px] font-black text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-md uppercase">
                                                {call.trigger_type === 'new_lead_auto' ? '⏱ Auto' : call.trigger_type === 'stage_change' ? '🔄 Etapa' : '👆 Manual'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <span className={`flex items-center gap-1.5 w-fit px-2 py-1 rounded-full text-[9px] font-black ${sc.bg} ${sc.color}`}>
                                                {sc.icon}{sc.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            {oc ? <span className={`text-xs font-bold ${oc.color}`}>{oc.label}</span> : <span className="text-[10px] text-gray-200">—</span>}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            {call.ai_score !== null ? (
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-10 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                        <div className="h-full bg-violet-500 rounded-full" style={{ width: `${call.ai_score}%` }} />
                                                    </div>
                                                    <span className="text-[10px] font-black text-violet-600">{call.ai_score}</span>
                                                </div>
                                            ) : <span className="text-[10px] text-gray-200">—</span>}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <span className="text-[10px] text-gray-400">
                                                {formatDistanceToNow(new Date(call.scheduled_at), { addSuffix: true, locale: es })}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-1">
                                                {call.status === 'pending' && isVapiConfigured && (
                                                    <button
                                                        onClick={() => handleTriggerCall(call.id)}
                                                        disabled={triggering === call.id}
                                                        title="Llamar ahora"
                                                        className="p-1.5 rounded-lg hover:bg-green-100 text-gray-400 hover:text-green-600 transition disabled:opacity-50">
                                                        {triggering === call.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PhoneCall className="w-3.5 h-3.5" />}
                                                    </button>
                                                )}
                                                {call.transcript.length > 0 && (
                                                    <button onClick={() => setSelectedCall(call)}
                                                        title="Ver transcripción"
                                                        className="p-1.5 rounded-lg hover:bg-violet-100 text-gray-400 hover:text-violet-600 transition">
                                                        <MessageSquare className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                {['pending', 'retry'].includes(call.status) && (
                                                    <button onClick={() => callBotService.cancelCall(call.id).then(load)}
                                                        title="Cancelar"
                                                        className="p-1.5 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-600 transition">
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            {showSetup && (
                <SetupWizard
                    config={config}
                    stages={stages}
                    onSave={handleSaveConfig}
                    onClose={() => setShowSetup(false)}
                />
            )}
            {selectedCall && (
                <TranscriptViewer call={selectedCall} onClose={() => setSelectedCall(null)} />
            )}
        </div>
    );
}
