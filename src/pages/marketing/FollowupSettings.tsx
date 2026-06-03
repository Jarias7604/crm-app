import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowLeft, Save, Clock, ToggleLeft, ToggleRight,
    MessageSquare, AlertTriangle, RefreshCw, CheckCircle2,
    ChevronDown, ChevronUp, Zap, Users, Timer, FlaskConical, BarChart2, RotateCcw, Info,
    Bell, ShieldAlert, Send, Smartphone, UserCheck, Moon, Radio
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { followupSettingsService, type FollowupSettings, DEFAULT_FOLLOWUP_SETTINGS } from '../../services/marketing/followupSettingsService';
import { supabase } from '../../services/supabase';
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

function ActiveInfoTooltip() {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(v => !v)}
                className="w-6 h-6 rounded-full bg-slate-100 hover:bg-blue-100 text-slate-400 hover:text-blue-600 flex items-center justify-center transition-all"
                title="¿Qué hace este toggle?"
            >
                <Info className="w-3.5 h-3.5" />
            </button>

            {open && (
                <div className="absolute right-0 top-8 z-50 w-72 bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-slate-900/10 p-4 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                            <Timer className="w-4 h-4 text-emerald-600" />
                        </div>
                        <p className="text-xs font-black text-slate-800">Seguimientos Automáticos</p>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                        Cuando está <strong className="text-emerald-600">ACTIVO</strong>, Sofía (tu agente IA) envía mensajes automáticos por Telegram a leads que no han respondido, siguiendo los tiempos configurados abajo.
                    </p>
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                            <span><strong>Activo:</strong> Sofía envía seguimientos automáticamente</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                            <span><strong>Inactivo:</strong> Los seguimientos se pausan completamente</span>
                        </div>
                    </div>
                    <p className="text-[9px] text-blue-600 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 mt-3 leading-relaxed">
                        💡 El toggle se guarda <strong>automáticamente</strong> al activarlo o pausarlo.
                    </p>
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
    const [profiles, setProfiles] = useState<any[]>([]);
    const [hubTab, setHubTab] = useState<'telegram'|'whatsapp'|'slack'|'sla'>('telegram');

    const load = useCallback(async () => {
        if (!profile?.company_id) return;
        try {
            const [data, { data: profilesData }] = await Promise.all([
                followupSettingsService.get(profile.company_id),
                supabase.from('profiles').select('id, full_name, email').eq('company_id', profile.company_id).order('full_name')
            ]);
            setSettings(data);
            setProfiles(profilesData || []);
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

    const updateDeptRoute = (dept: 'sales'|'accounting'|'support', channel: 'telegram'|'whatsapp'|'slack', value: string) => {
        if (!settings) return;
        const cur = settings.dept_routing ?? { sales:{telegram:'',whatsapp:'',slack:''}, accounting:{telegram:'',whatsapp:'',slack:''}, support:{telegram:'',whatsapp:'',slack:''} };
        setSettings({ ...settings, dept_routing: { ...cur, [dept]: { ...cur[dept], [channel]: value } } });
    };

    // Auto-save is_active immediately when toggled (no manual Save needed)
    const handleToggleActive = async () => {
        if (!settings || !profile?.company_id) return;
        const newValue = !settings.is_active;
        setSettings({ ...settings, is_active: newValue }); // optimistic UI update
        try {
            await followupSettingsService.updateActiveState(profile.company_id, newValue);
            toast.success(newValue
                ? '✅ Seguimientos activados'
                : '⏸️ Seguimientos pausados'
            );
        } catch (e: any) {
            // Revert on failure and show real error
            setSettings({ ...settings, is_active: !newValue });
            toast.error(`No se pudo guardar: ${e.message || 'Error desconocido'}`);
        }
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
                    {/* Info tooltip */}
                    <ActiveInfoTooltip />

                    {/* Status label */}
                    <span className={`text-[10px] font-black tracking-widest transition-colors ${
                        settings.is_active ? 'text-emerald-600' : 'text-slate-400'
                    }`}>
                        {settings.is_active ? 'ACTIVO' : 'INACTIVO'}
                    </span>

                    {/* Premium toggle switch — auto-saves on click */}
                    <button
                        onClick={handleToggleActive}
                        title={settings.is_active ? 'Pausar seguimientos automáticos' : 'Activar seguimientos automáticos'}
                        className={`relative w-14 h-7 rounded-full transition-all duration-300 shadow-inner focus:outline-none ${
                            settings.is_active
                                ? 'bg-emerald-500 shadow-emerald-200'
                                : 'bg-slate-200'
                        }`}
                    >
                        <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
                            settings.is_active ? 'translate-x-7' : 'translate-x-0'
                        }`} />
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

                    {/* ── A/B Testing Panel ─────────────────────────────── */}
                    <div className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-xl space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                                <FlaskConical className="w-4 h-4 text-violet-500" />
                                A/B Testing de Templates
                                <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full ml-1">Experimental</span>
                            </h2>
                            <button
                                onClick={() => update('ab_testing_enabled', !settings.ab_testing_enabled)}
                                className="ml-4 shrink-0"
                            >
                                {settings.ab_testing_enabled
                                    ? <ToggleRight className="w-8 h-8 text-violet-500" />
                                    : <ToggleLeft  className="w-8 h-8 text-slate-300" />}
                            </button>
                        </div>

                        {settings.ab_testing_enabled ? (
                            <>
                                <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-[11px] text-violet-700 font-medium leading-relaxed">
                                    🧪 Sofía alternará automáticamente entre <strong>Template A</strong> (los de arriba) y <strong>Template B</strong> (los de abajo). El sistema registra cuál genera más respuestas.
                                </div>

                                {/* Template B editors */}
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Variante B</p>
                                    {[1, 2, 3].map(num => {
                                        const key = `followup_${num}_template_b` as keyof typeof settings;
                                        const val = settings[key] as string | null;
                                        return (
                                            <TemplateEditor
                                                key={`b-${num}`}
                                                num={num}
                                                value={val}
                                                onChange={v => update(key, v)}
                                            />
                                        );
                                    })}
                                </div>

                                {/* Live A/B Stats */}
                                <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                            <BarChart2 className="w-3.5 h-3.5" /> Estadísticas en vivo
                                        </p>
                                        <button
                                            onClick={async () => {
                                                if (!confirm('¿Reiniciar contadores A/B a cero?')) return;
                                                await followupSettingsService.resetAbStats(settings.company_id);
                                                update('ab_stats', { a_sent: 0, b_sent: 0, a_responses: 0, b_responses: 0 });
                                                toast.success('Contadores reiniciados');
                                            }}
                                            className="text-[9px] text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                                        >
                                            <RotateCcw className="w-3 h-3" /> Reiniciar
                                        </button>
                                    </div>
                                    {(['a', 'b'] as const).map(variant => {
                                        const sent      = settings.ab_stats?.[`${variant}_sent`]      || 0;
                                        const responses = settings.ab_stats?.[`${variant}_responses`] || 0;
                                        const rate      = sent > 0 ? Math.round((responses / sent) * 100) : 0;
                                        const barColor  = variant === 'a' ? 'bg-blue-500' : 'bg-violet-500';
                                        const textColor = variant === 'a' ? 'text-blue-600' : 'text-violet-600';
                                        return (
                                            <div key={variant}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className={`text-[10px] font-black uppercase ${textColor}`}>Variante {variant.toUpperCase()}</span>
                                                    <span className="text-[10px] text-slate-400">{sent} enviados · {responses} respuestas · <strong className={textColor}>{rate}% respuesta</strong></span>
                                                </div>
                                                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all ${barColor}`}
                                                        style={{ width: `${Math.min(rate, 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {(settings.ab_stats?.a_sent || 0) + (settings.ab_stats?.b_sent || 0) === 0 && (
                                        <p className="text-[10px] text-slate-400 text-center pt-1">Los datos aparecerán cuando Sofía empiece a enviar seguimientos.</p>
                                    )}
                                </div>
                            </>
                        ) : (
                            <p className="text-[11px] text-slate-400">
                                Activa el A/B testing para que Sofía pruebe dos versiones de cada mensaje y descubras cuál convierte mejor.
                            </p>
                        )}
                    </div>

                    {/* ── NOTIFICATION HUB ── */}
                    <div className="bg-white rounded-[24px] border border-gray-100 shadow-xl overflow-hidden">
                        {/* Header */}
                        <div className="px-6 pt-5 pb-4 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-2xl bg-violet-100 flex items-center justify-center">
                                    <Radio className="w-4 h-4 text-violet-600" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                                        Hub de Alertas
                                        <span className="text-[9px] font-bold text-violet-600 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full">Multi-Canal</span>
                                    </h2>
                                    <p className="text-[10px] text-slate-400">Activa canales simultáneos — cada uno entrega alertas en paralelo</p>
                                </div>
                            </div>
                            {/* Tab Navigator */}
                            <div className="flex gap-0 mt-4 border-b border-slate-100">
                                {([
                                    { id: 'telegram', label: 'Telegram',  color: '#229ED9', activeChannels: [settings.escalation_ch_agent_tg, settings.escalation_ch_group_tg] },
                                    { id: 'whatsapp', label: 'WhatsApp',  color: '#25D366', activeChannels: [settings.escalation_ch_whatsapp] },
                                    { id: 'slack',    label: 'Slack',     color: '#611f69', activeChannels: [settings.escalation_ch_slack] },
                                    { id: 'sla',      label: 'SLA & DND', color: '#6366f1', activeChannels: [] },
                                ] as const).map(tab => {
                                    const isActive = hubTab === tab.id;
                                    const hasActive = tab.activeChannels.some(Boolean);
                                    return (
                                        <button key={tab.id} type="button" onClick={() => setHubTab(tab.id as any)}
                                            className="relative px-4 py-2.5 text-[11px] font-black transition-colors focus:outline-none flex items-center gap-1.5"
                                            style={{ color: isActive ? tab.color : '#94a3b8' }}>
                                            {hasActive && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tab.color }} />}
                                            {tab.label}
                                            {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ backgroundColor: tab.color }} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="p-5">

                            {/* ── TELEGRAM TAB ── */}
                            {hubTab === 'telegram' && (
                                <div className="space-y-4">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Canales Activos</p>

                                    {/* Agente Directo */}
                                    <div className={`rounded-2xl border transition-all ${settings.escalation_ch_agent_tg ? 'border-[#229ED9]/25 bg-[#229ED9]/5' : 'border-slate-100'}`}>
                                        <div className="flex items-center gap-3 p-3.5">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${settings.escalation_ch_agent_tg ? 'bg-[#229ED9]' : 'bg-slate-100'}`}>
                                                <Smartphone className="w-4 h-4 text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <p className={`text-xs font-black ${settings.escalation_ch_agent_tg ? 'text-[#229ED9]' : 'text-slate-500'}`}>Telegram — Agente Directo</p>
                                                <p className="text-[9px] text-slate-400">Notifica al Telegram personal del agente asignado al lead</p>
                                            </div>
                                            {settings.escalation_ch_agent_tg && <span className="text-[9px] font-black text-[#229ED9] bg-[#229ED9]/10 px-2 py-0.5 rounded-full">ACTIVO</span>}
                                            <button type="button" onClick={() => update('escalation_ch_agent_tg', !settings.escalation_ch_agent_tg)} className="shrink-0 focus:outline-none">
                                                {settings.escalation_ch_agent_tg ? <ToggleRight className="w-7 h-7 text-[#229ED9]" /> : <ToggleLeft className="w-7 h-7 text-slate-300" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Grupo Central */}
                                    <div className={`rounded-2xl border transition-all ${settings.escalation_ch_group_tg ? 'border-[#229ED9]/25 bg-[#229ED9]/5' : 'border-slate-100'}`}>
                                        <div className="flex items-center gap-3 p-3.5">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${settings.escalation_ch_group_tg ? 'bg-[#229ED9]' : 'bg-slate-100'}`}>
                                                <Send className="w-4 h-4 text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <p className={`text-xs font-black ${settings.escalation_ch_group_tg ? 'text-[#229ED9]' : 'text-slate-500'}`}>Telegram — Grupo Central</p>
                                                <p className="text-[9px] text-slate-400">Un grupo general para todas las alertas del equipo</p>
                                            </div>
                                            {settings.escalation_ch_group_tg && <span className="text-[9px] font-black text-[#229ED9] bg-[#229ED9]/10 px-2 py-0.5 rounded-full">ACTIVO</span>}
                                            <button type="button" onClick={() => update('escalation_ch_group_tg', !settings.escalation_ch_group_tg)} className="shrink-0 focus:outline-none">
                                                {settings.escalation_ch_group_tg ? <ToggleRight className="w-7 h-7 text-[#229ED9]" /> : <ToggleLeft className="w-7 h-7 text-slate-300" />}
                                            </button>
                                        </div>
                                        {settings.escalation_ch_group_tg && (
                                            <div className="px-3.5 pb-3.5">
                                                <input type="text" placeholder="Chat ID del grupo  Ej: -100123456789"
                                                    value={settings.escalation_telegram_chat_id || ''}
                                                    onChange={e => update('escalation_telegram_chat_id', e.target.value || null)}
                                                    className="w-full p-2.5 bg-white border border-[#229ED9]/20 rounded-xl text-xs font-semibold text-slate-600 outline-none placeholder:text-slate-300 focus:ring-2 focus:ring-[#229ED9]/15" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Department Routing — Telegram */}
                                    <div className="border-t border-slate-50 pt-4 space-y-3">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grupos por Departamento</p>
                                            <p className="text-[9px] text-slate-400 mt-0.5">Cada departamento recibe alertas en su propio grupo de Telegram</p>
                                        </div>
                                        {([
                                            { key: 'sales',      emoji: '💼', label: 'Ventas' },
                                            { key: 'accounting', emoji: '📊', label: 'Contabilidad' },
                                            { key: 'support',    emoji: '🛠', label: 'Soporte Técnico' },
                                        ] as const).map(dept => (
                                            <div key={dept.key} className="flex items-center gap-3">
                                                <span className="text-[11px] font-black text-slate-600 w-28 shrink-0">{dept.emoji} {dept.label}</span>
                                                <input type="text" placeholder="Chat ID del grupo (opcional)"
                                                    value={settings.dept_routing?.[dept.key]?.telegram || ''}
                                                    onChange={e => updateDeptRoute(dept.key, 'telegram', e.target.value)}
                                                    className="flex-1 p-2 bg-slate-50 border-none rounded-xl text-xs font-semibold text-slate-600 outline-none placeholder:text-slate-300 focus:ring-2 focus:ring-[#229ED9]/15 focus:bg-white transition-colors" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── WHATSAPP TAB ── */}
                            {hubTab === 'whatsapp' && (
                                <div className="space-y-4">
                                    {/* WhatsApp Channel */}
                                    <div className={`rounded-2xl border transition-all ${settings.escalation_ch_whatsapp ? 'border-[#25D366]/25 bg-[#25D366]/5' : 'border-slate-100'}`}>
                                        <div className="flex items-center gap-3 p-3.5">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white font-black text-sm ${settings.escalation_ch_whatsapp ? 'bg-[#25D366]' : 'bg-slate-100'}`}>W</div>
                                            <div className="flex-1">
                                                <p className={`text-xs font-black ${settings.escalation_ch_whatsapp ? 'text-[#25D366]' : 'text-slate-500'}`}>WhatsApp Business API</p>
                                                <p className="text-[9px] text-slate-400">Meta Cloud API — alertas a números individuales o por departamento</p>
                                            </div>
                                            {settings.escalation_ch_whatsapp && <span className="text-[9px] font-black text-[#25D366] bg-[#25D366]/10 px-2 py-0.5 rounded-full">ACTIVO</span>}
                                            <button type="button" onClick={() => update('escalation_ch_whatsapp', !settings.escalation_ch_whatsapp)} className="shrink-0 focus:outline-none">
                                                {settings.escalation_ch_whatsapp ? <ToggleRight className="w-7 h-7 text-[#25D366]" /> : <ToggleLeft className="w-7 h-7 text-slate-300" />}
                                            </button>
                                        </div>
                                        {settings.escalation_ch_whatsapp && (
                                            <div className="px-3.5 pb-3.5 space-y-2">
                                                <input type="tel" placeholder="Número Principal  Ej: +15551234567"
                                                    value={settings.escalation_whatsapp_number || ''}
                                                    onChange={e => update('escalation_whatsapp_number', e.target.value || null)}
                                                    className="w-full p-2.5 bg-white border border-[#25D366]/20 rounded-xl text-xs font-semibold text-slate-600 outline-none placeholder:text-slate-300" />
                                                <input type="text" placeholder="API Token (Meta Cloud / 360dialog)"
                                                    value={settings.escalation_whatsapp_token || ''}
                                                    onChange={e => update('escalation_whatsapp_token', e.target.value || null)}
                                                    className="w-full p-2.5 bg-white border border-[#25D366]/20 rounded-xl text-xs font-semibold text-slate-600 outline-none placeholder:text-slate-300" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Info box */}
                                    <div className="flex gap-2 bg-amber-50 border border-amber-100 rounded-2xl p-3">
                                        <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                        <p className="text-[9px] text-amber-700 leading-relaxed">WhatsApp no soporta grupos como Telegram. Usa <strong>números destino diferentes</strong> para enrutar por departamento — cada número puede ser un agente o un número de grupo de WhatsApp Business.</p>
                                    </div>

                                    {/* Department Routing — WhatsApp */}
                                    <div className="border-t border-slate-50 pt-4 space-y-3">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Números por Departamento</p>
                                            <p className="text-[9px] text-slate-400 mt-0.5">Cada departamento recibe alertas en su número de WhatsApp</p>
                                        </div>
                                        {([
                                            { key: 'sales',      emoji: '💼', label: 'Ventas' },
                                            { key: 'accounting', emoji: '📊', label: 'Contabilidad' },
                                            { key: 'support',    emoji: '🛠', label: 'Soporte Técnico' },
                                        ] as const).map(dept => (
                                            <div key={dept.key} className="flex items-center gap-3">
                                                <span className="text-[11px] font-black text-slate-600 w-28 shrink-0">{dept.emoji} {dept.label}</span>
                                                <input type="tel" placeholder="+503 xxxx xxxx (opcional)"
                                                    value={settings.dept_routing?.[dept.key]?.whatsapp || ''}
                                                    onChange={e => updateDeptRoute(dept.key, 'whatsapp', e.target.value)}
                                                    className="flex-1 p-2 bg-slate-50 border-none rounded-xl text-xs font-semibold text-slate-600 outline-none placeholder:text-slate-300 focus:ring-2 focus:ring-[#25D366]/15 focus:bg-white transition-colors" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── SLACK TAB ── */}
                            {hubTab === 'slack' && (
                                <div className="space-y-4">
                                    <div className={`rounded-2xl border transition-all ${settings.escalation_ch_slack ? 'border-purple-200 bg-purple-50/30' : 'border-slate-100'}`}>
                                        <div className="flex items-center gap-3 p-3.5">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${settings.escalation_ch_slack ? 'bg-purple-600' : 'bg-slate-100'}`}>
                                                <Bell className="w-4 h-4 text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <p className={`text-xs font-black ${settings.escalation_ch_slack ? 'text-purple-700' : 'text-slate-500'}`}>Slack / Microsoft Teams</p>
                                                <p className="text-[9px] text-slate-400">Webhooks entrantes — un canal general o por departamento</p>
                                            </div>
                                            {settings.escalation_ch_slack && <span className="text-[9px] font-black text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">ACTIVO</span>}
                                            <button type="button" onClick={() => update('escalation_ch_slack', !settings.escalation_ch_slack)} className="shrink-0 focus:outline-none">
                                                {settings.escalation_ch_slack ? <ToggleRight className="w-7 h-7 text-purple-600" /> : <ToggleLeft className="w-7 h-7 text-slate-300" />}
                                            </button>
                                        </div>
                                        {settings.escalation_ch_slack && (
                                            <div className="px-3.5 pb-3.5">
                                                <input type="url" placeholder="Webhook General  https://hooks.slack.com/services/..."
                                                    value={settings.escalation_webhook_url || ''}
                                                    onChange={e => update('escalation_webhook_url', e.target.value || null)}
                                                    className="w-full p-2.5 bg-white border border-purple-100 rounded-xl text-xs font-semibold text-slate-600 outline-none placeholder:text-slate-300" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Department Routing — Slack */}
                                    <div className="border-t border-slate-50 pt-4 space-y-3">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Webhooks por Departamento</p>
                                            <p className="text-[9px] text-slate-400 mt-0.5">Cada departamento puede tener su propio canal de Slack o Teams</p>
                                        </div>
                                        {([
                                            { key: 'sales',      emoji: '💼', label: 'Ventas' },
                                            { key: 'accounting', emoji: '📊', label: 'Contabilidad' },
                                            { key: 'support',    emoji: '🛠', label: 'Soporte Técnico' },
                                        ] as const).map(dept => (
                                            <div key={dept.key} className="flex items-center gap-3">
                                                <span className="text-[11px] font-black text-slate-600 w-28 shrink-0">{dept.emoji} {dept.label}</span>
                                                <input type="url" placeholder="Webhook URL (opcional)"
                                                    value={settings.dept_routing?.[dept.key]?.slack || ''}
                                                    onChange={e => updateDeptRoute(dept.key, 'slack', e.target.value)}
                                                    className="flex-1 p-2 bg-slate-50 border-none rounded-xl text-xs font-semibold text-slate-600 outline-none placeholder:text-slate-300 focus:ring-2 focus:ring-purple-200/40 focus:bg-white transition-colors" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── SLA & DND TAB ── */}
                            {hubTab === 'sla' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Timer className="w-3 h-3" /> SLA de Respuesta</label>
                                            <select value={settings.escalation_sla_minutes} onChange={e => update('escalation_sla_minutes', parseInt(e.target.value))}
                                                className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-bold text-slate-700 outline-none border-none">
                                                <option value="15">⚡ 15 min — Urgente</option>
                                                <option value="30">✅ 30 min — Normal</option>
                                                <option value="60">🕐 1 hora</option>
                                                <option value="120">🕑 2 horas</option>
                                                <option value="240">🕓 4 horas</option>
                                                <option value="1440">📅 24 horas</option>
                                            </select>
                                            <p className="text-[9px] text-slate-400">Si el agente no atiende el lead dentro de este plazo, se dispara la alerta.</p>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><UserCheck className="w-3 h-3 text-rose-400" /> Agente Fallback</label>
                                            <select value={settings.escalation_backup_agent_id || ''} onChange={e => update('escalation_backup_agent_id', e.target.value || null)}
                                                className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-bold text-slate-700 outline-none border-none">
                                                <option value="">— Ninguno —</option>
                                                {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                                            </select>
                                            <p className="text-[9px] text-slate-400">Recibirá la alerta secundaria si el primer agente no responde.</p>
                                        </div>
                                    </div>
                                    <div className="border-t border-slate-50 pt-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Moon className="w-3.5 h-3.5 text-slate-400" /> Horario No Molestar (DND)</p>
                                                <p className="text-[9px] text-slate-400">Las alertas se pausan fuera del horario laboral</p>
                                            </div>
                                            <button type="button" onClick={() => update('escalation_dnd_enabled', !settings.escalation_dnd_enabled)} className="shrink-0 focus:outline-none">
                                                {settings.escalation_dnd_enabled ? <ToggleRight className="w-7 h-7 text-indigo-500" /> : <ToggleLeft className="w-7 h-7 text-slate-300" />}
                                            </button>
                                        </div>
                                        {settings.escalation_dnd_enabled && (
                                            <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-2xl p-3">
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block text-center">Inicio (Silenciar)</label>
                                                    <input type="time" value={settings.escalation_dnd_start} onChange={e => update('escalation_dnd_start', e.target.value)}
                                                        className="w-full p-2 bg-white border border-slate-100 rounded-xl text-xs font-bold text-center text-slate-600 outline-none" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block text-center">Fin (Reactivar)</label>
                                                    <input type="time" value={settings.escalation_dnd_end} onChange={e => update('escalation_dnd_end', e.target.value)}
                                                        className="w-full p-2 bg-white border border-slate-100 rounded-xl text-xs font-bold text-center text-slate-600 outline-none" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
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
