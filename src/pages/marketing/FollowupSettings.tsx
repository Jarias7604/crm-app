import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowLeft, Save, Play, Clock, ToggleLeft, ToggleRight,
    MessageSquare, AlertTriangle, RefreshCw, CheckCircle2,
    ChevronDown, ChevronUp, Zap, Users, Timer
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { followupSettingsService, type FollowupSettings, DEFAULT_FOLLOWUP_SETTINGS } from '../../services/marketing/followupSettingsService';
import toast from 'react-hot-toast';

const HOUR_PRESETS = [6, 12, 24, 36, 48, 72, 96, 168];
const TIMEZONE_OPTIONS = [
    { value: 'America/El_Salvador', label: '🇸🇻 El Salvador (GMT-6)' },
    { value: 'America/Guatemala',   label: '🇬🇹 Guatemala (GMT-6)' },
    { value: 'America/Mexico_City', label: '🇲🇽 México (GMT-6)' },
    { value: 'America/New_York',    label: '🇺🇸 Nueva York (GMT-5)' },
    { value: 'America/Bogota',      label: '🇨🇴 Colombia (GMT-5)' },
    { value: 'America/Lima',        label: '🇵🇪 Perú (GMT-5)' },
    { value: 'America/Santiago',    label: '🇨🇱 Chile (GMT-4)' },
    { value: 'Europe/Madrid',       label: '🇪🇸 España (GMT+1/+2)' },
];

function HourSelector({ label, value, onChange, description }: {
    label: string; value: number; onChange: (v: number) => void; description: string;
}) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
                <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    {value >= 168 ? `${(value / 168).toFixed(0)} sem` : value >= 24 ? `${(value / 24).toFixed(1)}d` : `${value}h`}
                </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
                {HOUR_PRESETS.map(h => (
                    <button
                        key={h}
                        onClick={() => onChange(h)}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                            value === h
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                                : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                        }`}
                    >
                        {h >= 168 ? '7d' : h >= 24 ? `${h/24}d` : `${h}h`}
                    </button>
                ))}
                <input
                    type="number"
                    min="1" max="720"
                    value={value}
                    onChange={e => onChange(Math.max(1, Math.min(720, parseInt(e.target.value) || 1)))}
                    className="w-16 px-2 py-1.5 bg-slate-50 rounded-lg text-[10px] font-black text-slate-600 outline-none focus:ring-2 focus:ring-blue-400/30 text-center"
                    title="Horas personalizadas"
                />
            </div>
            <p className="text-[9px] text-slate-400 pl-1">{description}</p>
        </div>
    );
}

function Toggle({ value, onChange, label, description }: {
    value: boolean; onChange: (v: boolean) => void; label: string; description: string;
}) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
            <div>
                <p className="text-sm font-bold text-slate-700">{label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{description}</p>
            </div>
            <button onClick={() => onChange(!value)} className="ml-4 shrink-0">
                {value
                    ? <ToggleRight className="w-8 h-8 text-emerald-500" />
                    : <ToggleLeft  className="w-8 h-8 text-slate-300" />
                }
            </button>
        </div>
    );
}

function TemplateEditor({ num, value, onChange }: {
    num: number; value: string | null; onChange: (v: string | null) => void;
}) {
    const [open, setOpen] = useState(false);
    const isEmpty = !value || value.trim() === '';

    return (
        <div className="border border-slate-100 rounded-2xl overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black ${
                        isEmpty ? 'bg-slate-100 text-slate-400' : 'bg-blue-100 text-blue-600'
                    }`}>#{num}</div>
                    <div className="text-left">
                        <p className="text-xs font-black text-slate-700">Mensaje de Seguimiento #{num}</p>
                        <p className="text-[9px] text-slate-400">
                            {isEmpty ? 'Usando mensaje inteligente automático' : 'Mensaje personalizado activo'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                        isEmpty ? 'bg-slate-100 text-slate-400' : 'bg-emerald-100 text-emerald-600'
                    }`}>
                        {isEmpty ? 'AUTO' : 'CUSTOM'}
                    </span>
                    {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
            </button>

            {open && (
                <div className="px-4 pb-4 space-y-2 bg-slate-50/30">
                    <div className="flex gap-2 flex-wrap mb-2">
                        {['{nombre}', '{empresa}', '{plan}'].map(v => (
                            <button
                                key={v}
                                onClick={() => onChange((value || '') + v)}
                                className="text-[9px] font-black px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                            >
                                + {v}
                            </button>
                        ))}
                        {!isEmpty && (
                            <button
                                onClick={() => onChange(null)}
                                className="text-[9px] font-black px-2 py-1 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors ml-auto"
                            >
                                Usar Auto
                            </button>
                        )}
                    </div>
                    <textarea
                        value={value || ''}
                        onChange={e => onChange(e.target.value || null)}
                        placeholder={`Hola {nombre}, quería retomar nuestra conversación...`}
                        rows={4}
                        className="w-full p-3 bg-white border border-slate-100 rounded-xl text-xs font-medium text-slate-600 outline-none focus:ring-2 focus:ring-blue-400/30 resize-none leading-relaxed"
                    />
                    <p className="text-[9px] text-slate-400">Variables: <code className="bg-slate-100 px-1 rounded">{'{nombre}'}</code> <code className="bg-slate-100 px-1 rounded">{'{empresa}'}</code> <code className="bg-slate-100 px-1 rounded">{'{plan}'}</code></p>
                </div>
            )}
        </div>
    );
}

export default function FollowupSettingsPage() {
    const { profile } = useAuth();
    const [settings, setSettings] = useState<FollowupSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [triggering, setTriggering] = useState(false);
    const [lastRun, setLastRun] = useState<{ sent: number; evaluated: number } | null>(null);

    const load = useCallback(async () => {
        if (!profile?.company_id) return;
        try {
            const data = await followupSettingsService.get(profile.company_id);
            setSettings(data);
        } catch (e: any) {
            toast.error('Error cargando configuración');
        } finally {
            setLoading(false);
        }
    }, [profile?.company_id]);

    useEffect(() => { load(); }, [load]);

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            await followupSettingsService.save(settings);
            toast.success('✅ Configuración guardada');
        } catch (e: any) {
            toast.error('Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleTrigger = async () => {
        if (!profile?.company_id) return;
        setTriggering(true);
        try {
            const result = await followupSettingsService.triggerNow(profile.company_id);
            setLastRun({ sent: result.followups_sent, evaluated: result.evaluated });
            toast.success(`✅ ${result.followups_sent} seguimientos enviados de ${result.evaluated} evaluados`);
        } catch (e: any) {
            toast.error('Error al ejecutar seguimientos');
        } finally {
            setTriggering(false);
        }
    };

    const update = (field: keyof FollowupSettings, value: any) => {
        if (!settings) return;
        setSettings({ ...settings, [field]: value });
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
        </div>
    );

    if (!settings) return null;

    return (
        <div className="flex flex-col bg-white rounded-[3.5rem] shadow-2xl border border-white/60 overflow-hidden font-sans min-h-[calc(100vh-64px)]">
            {/* Header */}
            <div className="flex items-center justify-between px-8 pt-8 pb-4">
                <div className="flex items-center gap-4">
                    <Link to="/marketing/agents" className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-black text-[#0f172a] flex items-center gap-2">
                            <Timer className="w-7 h-7 text-blue-600" />
                            Seguimientos Automáticos
                        </h1>
                        <p className="text-xs text-gray-500 font-medium">Configura cuándo y cómo Sofía hace seguimiento a los leads</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => update('is_active', !settings.is_active)}
                        className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest transition-all ${
                            settings.is_active
                                ? 'bg-emerald-100 text-emerald-600'
                                : 'bg-slate-100 text-slate-400'
                        }`}
                    >
                        {settings.is_active ? 'ACTIVO' : 'INACTIVO'}
                    </button>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 px-8 pb-8 overflow-auto">

                {/* LEFT: Timing + Limits */}
                <div className="lg:col-span-2 space-y-4">

                    {/* Timing Card */}
                    <div className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-xl space-y-6">
                        <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-500" />
                            Tiempos de Seguimiento
                        </h2>

                        <HourSelector
                            label="1er Seguimiento — ¿Cuándo?"
                            value={settings.first_followup_hours}
                            onChange={v => update('first_followup_hours', v)}
                            description="Horas de inactividad antes de enviar el primer mensaje de seguimiento"
                        />
                        <HourSelector
                            label="2do Seguimiento — ¿Cuándo?"
                            value={settings.second_followup_hours}
                            onChange={v => update('second_followup_hours', v)}
                            description="Horas adicionales antes del segundo intento si no hay respuesta"
                        />
                        <HourSelector
                            label="3er Seguimiento — ¿Cuándo?"
                            value={settings.third_followup_hours}
                            onChange={v => update('third_followup_hours', v)}
                            description="Horas antes del mensaje final antes de escalar a un humano"
                        />

                        {/* Max followups */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Máx. intentos antes de escalar</label>
                                <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{settings.max_followups} mensajes</span>
                            </div>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map(n => (
                                    <button
                                        key={n}
                                        onClick={() => update('max_followups', n)}
                                        className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${
                                            settings.max_followups === n
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                                                : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                                        }`}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Message Templates */}
                    <div className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-xl space-y-3">
                        <h2 className="text-sm font-black text-gray-900 flex items-center gap-2 mb-4">
                            <MessageSquare className="w-4 h-4 text-purple-500" />
                            Templates de Mensajes
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full ml-1">Opcional — usa inteligencia automática si está vacío</span>
                        </h2>
                        <TemplateEditor num={1} value={settings.followup_1_template} onChange={v => update('followup_1_template', v)} />
                        <TemplateEditor num={2} value={settings.followup_2_template} onChange={v => update('followup_2_template', v)} />
                        <TemplateEditor num={3} value={settings.followup_3_template} onChange={v => update('followup_3_template', v)} />
                    </div>
                </div>

                {/* RIGHT: Guards + Actions */}
                <div className="space-y-4">

                    {/* Behavior Toggles */}
                    <div className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-xl">
                        <h2 className="text-sm font-black text-gray-900 flex items-center gap-2 mb-4">
                            <Users className="w-4 h-4 text-emerald-500" />
                            Comportamiento
                        </h2>
                        <Toggle
                            value={settings.auto_escalate}
                            onChange={v => update('auto_escalate', v)}
                            label="Escalar a humano automáticamente"
                            description="Crea una alerta en el CRM si el lead no responde tras el máx. de intentos"
                        />
                        <Toggle
                            value={settings.only_business_hours}
                            onChange={v => update('only_business_hours', v)}
                            label="Solo horario de oficina"
                            description="Envía mensajes solo Lun–Vie de 8am a 6pm"
                        />
                        <Toggle
                            value={settings.pause_after_quote}
                            onChange={v => update('pause_after_quote', v)}
                            label="Pausar después de cotizar"
                            description="No envía seguimiento automático si ya se generó una cotización"
                        />

                        {settings.only_business_hours && (
                            <div className="pt-3 space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Zona Horaria</label>
                                <select
                                    value={settings.timezone}
                                    onChange={e => update('timezone', e.target.value)}
                                    className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-bold text-slate-700 outline-none border-none focus:ring-2 focus:ring-blue-400/20"
                                >
                                    {TIMEZONE_OPTIONS.map(tz => (
                                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Timeline Preview */}
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-[24px] text-white">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Vista Previa del Flujo</h3>
                        <div className="space-y-3">
                            {[
                                { icon: '📩', label: 'Lead escribe', time: 'Hora 0', color: 'text-blue-400' },
                                { icon: '🤖', label: '1er seguimiento', time: `+${settings.first_followup_hours}h`, color: 'text-emerald-400' },
                                { icon: '🔁', label: '2do seguimiento', time: `+${settings.first_followup_hours + settings.second_followup_hours}h total`, color: 'text-yellow-400' },
                                { icon: '🚨', label: '3er / Escalar', time: `+${settings.first_followup_hours + settings.second_followup_hours + settings.third_followup_hours}h total`, color: 'text-red-400' },
                            ].map((step, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <span className="text-lg">{step.icon}</span>
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-white">{step.label}</p>
                                    </div>
                                    <span className={`text-[10px] font-black ${step.color}`}>{step.time}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full py-4 bg-slate-900 text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-[0.98] disabled:opacity-50"
                    >
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin text-blue-400" /> : <Save className="w-4 h-4 text-blue-400" />}
                        {saving ? 'Guardando...' : 'Guardar Configuración'}
                    </button>

                    {/* Manual Trigger */}
                    <button
                        onClick={handleTrigger}
                        disabled={triggering}
                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black uppercase tracking-[0.15em] text-[10px] rounded-xl flex items-center justify-center gap-2 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98] disabled:opacity-50"
                    >
                        {triggering
                            ? <RefreshCw className="w-4 h-4 animate-spin" />
                            : <Zap className="w-4 h-4" />
                        }
                        {triggering ? 'Ejecutando...' : 'Ejecutar Seguimientos Ahora'}
                    </button>

                    {/* Last Run Result */}
                    {lastRun && (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                            <div>
                                <p className="text-xs font-black text-emerald-700">Ejecución completada</p>
                                <p className="text-[10px] text-emerald-600">
                                    {lastRun.sent} enviados de {lastRun.evaluated} conversaciones evaluadas
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Info box */}
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
                            El motor corre automáticamente cada 4 horas. Usa el botón de arriba para ejecutarlo manualmente en cualquier momento.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
