import { useState, useEffect, useCallback } from 'react';
import {
    Phone, Settings, Activity, CheckCircle2, XCircle, Clock,
    RefreshCw, Bot, PhoneCall, PhoneMissed, BarChart2,
    MessageSquare, ArrowRight, Mic, DollarSign, TrendingUp,
    ChevronDown, Save, Eye, EyeOff, ToggleLeft, ToggleRight,
    AlertCircle, Target, Calendar, Zap, Shield
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import {
    callBotService, type CallBotConfig, type CallQueueItem,
    type CallBotStats, DEFAULT_CALL_BOT_CONFIG
} from '../../services/callBot';
import toast from 'react-hot-toast';

// ─── Status config ─────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
    pending:   { label: 'Pendiente',  color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',   dot: 'bg-amber-400' },
    calling:   { label: 'Llamando',   color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',     dot: 'bg-blue-500 animate-pulse' },
    completed: { label: 'Completada', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
    no_answer: { label: 'Sin resp.',  color: 'text-gray-600',    bg: 'bg-gray-50 border-gray-200',     dot: 'bg-gray-400' },
    cancelled: { label: 'Cancelada',  color: 'text-gray-500',    bg: 'bg-gray-50 border-gray-200',     dot: 'bg-gray-300' },
    failed:    { label: 'Error',      color: 'text-red-700',     bg: 'bg-red-50 border-red-200',       dot: 'bg-red-500' },
    retry:     { label: 'Reintento',  color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200', dot: 'bg-orange-400' },
};

// ─── Cost Estimator ────────────────────────────────────────────────────────
function CostEstimator() {
    const [leads, setLeads] = useState(500);
    const waReplyRate  = 0.30;
    const waLeads      = Math.round(leads * waReplyRate);
    const callLeads    = leads - waLeads;
    const waCost       = leads * 0.0231;
    const callCost     = callLeads * 0.097;   // 3 min × $0.032/min
    const total        = waCost + callCost;
    const savings      = leads * 0.43 - total; // vs Vapi

    return (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">💰 Estimador de Costos</h3>
                    <p className="text-xs text-slate-500 mt-0.5">WhatsApp + Telnyx · Stack propio</p>
                </div>
                <span className="bg-emerald-500/20 text-emerald-400 text-xs font-black px-3 py-1 rounded-full border border-emerald-500/30">
                    Tu stack
                </span>
            </div>

            <div>
                <div className="flex justify-between text-xs text-slate-400 mb-2">
                    <span>Leads por mes</span>
                    <span className="font-black text-white text-base">{leads.toLocaleString()}</span>
                </div>
                <input
                    type="range" min="100" max="5000" step="100"
                    value={leads}
                    onChange={e => setLeads(Number(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-violet-500"
                />
                <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                    <span>100</span><span>5,000</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                    <div className="text-green-400 text-[10px] font-black uppercase tracking-widest mb-1">💬 WhatsApp (30%)</div>
                    <div className="text-2xl font-black text-white">{waLeads}</div>
                    <div className="text-green-400 text-xs font-bold">${waCost.toFixed(2)}/mes</div>
                    <div className="text-slate-500 text-[10px] mt-1">$0.023/conversación</div>
                </div>
                <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3">
                    <div className="text-violet-400 text-[10px] font-black uppercase tracking-widest mb-1">📞 Sofía llama (70%)</div>
                    <div className="text-2xl font-black text-white">{callLeads}</div>
                    <div className="text-violet-400 text-xs font-bold">${callCost.toFixed(2)}/mes</div>
                    <div className="text-slate-500 text-[10px] mt-1">$0.097/llamada (3 min)</div>
                </div>
            </div>

            <div className="border-t border-slate-700 pt-4 space-y-2">
                <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">Tu stack (WA + Telnyx)</span>
                    <span className="text-lg font-black text-emerald-400">${total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center opacity-40">
                    <span className="text-xs text-slate-400 line-through">Solo Vapi (antes)</span>
                    <span className="text-sm font-bold text-red-400 line-through">${(leads * 0.43).toFixed(0)}</span>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 flex justify-between">
                    <span className="text-xs text-emerald-400 font-bold">Ahorras vs Vapi</span>
                    <span className="text-sm font-black text-emerald-400">${savings.toFixed(0)}/mes</span>
                </div>
            </div>
        </div>
    );
}

// ─── Flow Diagram ──────────────────────────────────────────────────────────
function HybridFlowDiagram() {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">⚡ Flujo Activo — WhatsApp → Sofía</h4>
            <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                    {[
                        { icon: '🎯', label: 'Lead nuevo', c: 'bg-blue-50 border-blue-200 text-blue-800' },
                        { icon: '💬', label: 'WhatsApp auto', c: 'bg-green-50 border-green-200 text-green-800' },
                        { icon: '✅', label: 'Responde → califica chat', c: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
                    ].map((n, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <div className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${n.c}`}>
                                <span>{n.icon}</span><span>{n.label}</span>
                            </div>
                            {i < 2 && <span className="text-gray-300 font-bold">→</span>}
                        </div>
                    ))}
                </div>
                <div className="ml-4 border-l-2 border-dashed border-gray-200 pl-4">
                    <p className="text-xs text-gray-400 mb-2">Si no responde en <strong>4 horas</strong>:</p>
                    <div className="flex items-center gap-2 flex-wrap">
                        {[
                            { icon: '📞', label: 'Telnyx llama +503', c: 'bg-violet-50 border-violet-200 text-violet-800' },
                            { icon: '🎙️', label: 'Sofía (tu voz)', c: 'bg-indigo-50 border-indigo-200 text-indigo-800' },
                            { icon: '🤖', label: 'GPT-4o-mini', c: 'bg-slate-50 border-slate-200 text-slate-700' },
                            { icon: '📊', label: 'CRM actualizado', c: 'bg-teal-50 border-teal-200 text-teal-800' },
                        ].map((n, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${n.c}`}>
                                    <span>{n.icon}</span><span>{n.label}</span>
                                </div>
                                {i < 3 && <span className="text-gray-300 font-bold">→</span>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Collapsible section ────────────────────────────────────────────────────
function Section({ title, icon, children, defaultOpen = false, badge }: {
    title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; badge?: string;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-violet-50 rounded-xl flex items-center justify-center text-violet-600">{icon}</div>
                    <span className="text-sm font-black text-gray-800">{title}</span>
                    {badge && <span className="text-[10px] font-black text-violet-600 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">{badge}</span>}
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && <div className="px-5 pb-5 border-t border-gray-50">{children}</div>}
        </div>
    );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5 pt-4">
            <label className="text-xs font-black text-gray-700 uppercase tracking-widest">{label}</label>
            {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
            {children}
        </div>
    );
}

function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
    const [show, setShow] = useState(false);
    return (
        <div className="relative">
            <input
                type={show ? 'text' : 'password'}
                value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-violet-400 transition pr-10"
            />
            <button onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
        </div>
    );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
    return (
        <input
            value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-violet-400 transition"
        />
    );
}

// ─── Queue Card ─────────────────────────────────────────────────────────────
function QueueCard({ item }: { item: CallQueueItem }) {
    const cfg = STATUS_CFG[item.status] || STATUS_CFG.pending;
    return (
        <div className={`flex items-center gap-3 p-3 rounded-xl border ${cfg.bg}`}>
            <div className={`w-2 h-2 rounded-full flex-none ${cfg.dot}`} />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{item.lead?.name || 'Lead'}</p>
                <p className="text-xs text-gray-500">{item.lead?.phone || '—'}</p>
            </div>
            <div className="text-right flex-none">
                <span className={`text-[11px] font-black ${cfg.color}`}>{cfg.label}</span>
                {item.ai_score !== null && (
                    <p className="text-[10px] text-gray-400">Score: {item.ai_score}/100</p>
                )}
            </div>
        </div>
    );
}

// ─── MAIN ───────────────────────────────────────────────────────────────────
export default function CallBot() {
    const { profile } = useAuth();
    const [config, setConfig] = useState<CallBotConfig>(DEFAULT_CALL_BOT_CONFIG);
    const [stats, setStats]   = useState<CallBotStats | null>(null);
    const [queue, setQueue]   = useState<CallQueueItem[]>([]);
    const [stages, setStages] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [tab, setTab]       = useState<'dashboard' | 'config' | 'queue'>('dashboard');
    const [loading, setLoading] = useState(true);
    const [testing, setTesting] = useState(false);
    const [testPhoneInput, setTestPhoneInput] = useState('+503');

    const load = useCallback(async () => {
        if (!profile?.company_id) return;
        try {
            const [cfg, st, q, sg] = await Promise.all([
                callBotService.getConfig(profile.company_id),
                callBotService.getStats(profile.company_id),
                callBotService.getQueue(profile.company_id, 20),
                callBotService.getPipelineStages(profile.company_id),
            ]);
            setConfig(cfg); setStats(st); setQueue(q); setStages(sg);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [profile?.company_id]);

    useEffect(() => { load(); }, [load]);

    const save = async () => {
        if (!profile?.company_id) return;
        setSaving(true);
        try {
            await callBotService.saveConfig(profile.company_id, config);
            toast.success('Configuración guardada ✓');
        } catch { toast.error('Error al guardar'); }
        finally { setSaving(false); }
    };

    const handleTestCall = async () => {
        if (!profile?.company_id) return;
        if (!testPhoneInput || testPhoneInput.length < 8) {
            toast.error('Ingresa un número de teléfono de destino válido');
            return;
        }
        setTesting(true);
        try {
            await callBotService.sendTestCall(profile.company_id, testPhoneInput);
            toast.success('Llamada de prueba lanzada 📞');
        } catch (e: any) {
            toast.error(e.message || 'Error al lanzar llamada de prueba');
        } finally {
            setTesting(false);
        }
    };

    const toggleEnabled = async () => {
        const next = { ...config, enabled: !config.enabled };
        setConfig(next);
        if (profile?.company_id) {
            await callBotService.saveConfig(profile.company_id, next);
            toast.success(next.enabled ? '🎙️ Sofía activada' : 'Bot pausado');
        }
    };

    const upd = (key: keyof CallBotConfig, val: unknown) =>
        setConfig(prev => ({ ...prev, [key]: val }));

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500 font-medium">Cargando AI Sales Engine…</p>
            </div>
        </div>
    );

    const isConfigured = !!(config.telnyx_api_key && config.telnyx_phone);

    return (
        <div className="min-h-screen bg-gray-50/50 p-4 sm:p-6 max-w-7xl mx-auto space-y-6">

            {/* HERO */}
            <div className="relative bg-gradient-to-br from-violet-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20 shadow-xl">
                            <span className="text-2xl">🎙️</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-black text-white">Sofía AI Sales Bot</h1>
                                <span className="bg-violet-500/30 text-violet-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-violet-400/30 uppercase tracking-widest">
                                    Tu propia voz
                                </span>
                            </div>
                            <p className="text-sm text-slate-400 font-medium mt-0.5">
                                WhatsApp califica · Telnyx llama · Sofía convierte en español salvadoreño
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={toggleEnabled}
                        disabled={!isConfigured}
                        className={`flex items-center gap-3 px-5 py-3 rounded-2xl font-black text-sm transition-all border shadow-lg ${
                            config.enabled
                                ? 'bg-emerald-500 border-emerald-400 text-white hover:bg-emerald-600 shadow-emerald-500/30'
                                : 'bg-white/10 border-white/20 text-white hover:bg-white/20 disabled:opacity-40'
                        }`}
                    >
                        {config.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        {config.enabled ? 'Sofía Activa' : isConfigured ? 'Activar Sofía' : 'Configura primero'}
                    </button>
                </div>

                {/* KPIs */}
                {stats && (
                    <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                        {[
                            { label: 'Llamadas hoy',    value: stats.total,       icon: <Phone className="w-4 h-4" />,        color: 'text-blue-300' },
                            { label: 'Calificaron',     value: stats.qualified,   icon: <Target className="w-4 h-4" />,       color: 'text-emerald-300' },
                            { label: 'Tasa contacto',   value: `${stats.contact_rate}%`, icon: <TrendingUp className="w-4 h-4" />, color: 'text-violet-300' },
                            { label: 'Demos agendadas', value: stats.demo_booked, icon: <Calendar className="w-4 h-4" />,     color: 'text-amber-300' },
                        ].map(kpi => (
                            <div key={kpi.label} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4">
                                <div className={`flex items-center gap-1.5 ${kpi.color} mb-2`}>
                                    {kpi.icon}
                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-70">{kpi.label}</span>
                                </div>
                                <p className="text-2xl font-black text-white">{kpi.value}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* TABS */}
            <div className="flex gap-1 bg-white rounded-2xl p-1.5 border border-gray-100 shadow-sm w-fit">
                {([
                    { id: 'dashboard', label: 'Dashboard',  icon: <BarChart2 className="w-4 h-4" /> },
                    { id: 'config',    label: 'Configurar', icon: <Settings className="w-4 h-4" /> },
                    { id: 'queue',     label: 'Cola',        icon: <Activity className="w-4 h-4" /> },
                ] as const).map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black transition-all ${
                            tab === t.id ? 'bg-violet-600 text-white shadow-lg shadow-violet-200' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                        }`}>
                        {t.icon}{t.label}
                    </button>
                ))}
            </div>

            {/* DASHBOARD */}
            {tab === 'dashboard' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-6">
                        <HybridFlowDiagram />
                        {/* System status */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">📡 Estado del Sistema</h4>
                            {[
                                { label: 'WhatsApp Business API', ok: config.wa_enabled, detail: config.wa_enabled ? 'Activo — envía mensajes automáticos' : 'Desactivado' },
                                { label: 'Telnyx (telefonía +503)', ok: !!config.telnyx_api_key, detail: config.telnyx_api_key ? 'API Key configurada' : 'Pendiente — crea cuenta Telnyx' },
                                { label: 'Cartesia (tu voz)', ok: !!config.cartesia_voice_id, detail: config.cartesia_voice_id ? 'Voz clonada lista' : 'Pendiente — clona tu voz' },
                                { label: 'GPT-4o-mini (cerebro)', ok: true, detail: 'OpenAI · Activo' },
                                { label: 'Deepgram (escucha STT)', ok: true, detail: 'Nova-2 · Activo' },
                                { label: 'Cron Job (cada 5 min)', ok: config.enabled, detail: config.enabled ? 'Supabase pg_cron · Activo' : 'Inactivo' },
                            ].map(item => (
                                <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${item.ok ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                                        <span className="text-sm font-bold text-gray-700">{item.label}</span>
                                    </div>
                                    <span className={`text-xs font-medium ${item.ok ? 'text-emerald-600' : 'text-amber-600'}`}>{item.detail}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <CostEstimator />
                </div>
            )}

            {/* CONFIG */}
            {tab === 'config' && (
                <div className="space-y-4">

                    {/* WhatsApp */}
                    <Section title="💬 WhatsApp — Primer Contacto (siempre activo)" icon={<MessageSquare className="w-4 h-4" />} badge="Siempre ON" defaultOpen>
                        <Field label="Mensaje automático al llegar el lead" hint="Se envía inmediatamente cuando entra un lead nuevo">
                            <textarea
                                value={config.wa_first_message}
                                onChange={e => upd('wa_first_message', e.target.value)}
                                rows={4}
                                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-violet-400 transition resize-none"
                            />
                        </Field>
                        <Field label="Horas de espera antes de llamar" hint="Si no responde WhatsApp, Sofía llama automáticamente">
                            <div className="flex items-center gap-3">
                                <input type="number" min={1} max={24} value={config.wa_wait_hours}
                                    onChange={e => upd('wa_wait_hours', Number(e.target.value))}
                                    className="w-24 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-violet-400 text-center"
                                />
                                <span className="text-sm text-gray-500 font-medium">horas de espera</span>
                            </div>
                        </Field>
                    </Section>

                    {/* Telnyx */}
                    <Section title="📞 Telnyx — Llamadas a El Salvador" icon={<Phone className="w-4 h-4" />} defaultOpen>
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-2 flex gap-2 mt-4">
                            <AlertCircle className="w-4 h-4 text-blue-600 flex-none mt-0.5" />
                            <div>
                                <p className="text-xs font-black text-blue-800">Registra tu cuenta Telnyx</p>
                                <p className="text-xs text-blue-700 mt-0.5">
                                    <a href="https://telnyx.com" target="_blank" rel="noopener noreferrer" className="underline font-bold">telnyx.com</a>
                                    {' '}→ Mission Control → API Keys + compra un número El Salvador o USA
                                </p>
                            </div>
                        </div>
                        <Field label="Telnyx API Key">
                            <SecretInput value={config.telnyx_api_key} onChange={v => upd('telnyx_api_key', v)} placeholder="KEY0..." />
                        </Field>
                        <Field label="Connection ID" hint="Mission Control → Voice → Connections → tu SIP Connection ID">
                            <TextInput value={config.telnyx_connection_id} onChange={v => upd('telnyx_connection_id', v)} placeholder="1234567890123456789" />
                        </Field>
                        <Field label="Número saliente" hint="El número desde el que llamará Sofía (formato +503XXXXXXXX o +1XXXXXXXXXX)">
                            <TextInput value={config.telnyx_phone} onChange={v => upd('telnyx_phone', v)} placeholder="+50312345678" />
                        </Field>
                    </Section>

                    {/* Cartesia */}
                    <Section title="🎙️ Cartesia — Tu Voz Clonada" icon={<Mic className="w-4 h-4" />}>
                        <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 mb-2 mt-4 flex gap-2">
                            <Shield className="w-4 h-4 text-violet-600 flex-none mt-0.5" />
                            <div>
                                <p className="text-xs font-black text-violet-800">Clona tu voz en Cartesia</p>
                                <p className="text-xs text-violet-700 mt-0.5">
                                    <a href="https://cartesia.ai" target="_blank" rel="noopener noreferrer" className="underline font-bold">cartesia.ai</a>
                                    {' '}→ Voices → Clone → sube 1 minuto de tu voz → copia el Voice ID
                                </p>
                            </div>
                        </div>
                        <Field label="Cartesia API Key">
                            <SecretInput value={config.cartesia_api_key} onChange={v => upd('cartesia_api_key', v)} placeholder="sk_car_..." />
                        </Field>
                        <Field label="Voice ID" hint="El ID de tu voz clonada en Cartesia">
                            <TextInput value={config.cartesia_voice_id} onChange={v => upd('cartesia_voice_id', v)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                        </Field>
                    </Section>

                    {/* Sofia agent */}
                    <Section title="🤖 Agente Sofía — Guión y Personalidad" icon={<Bot className="w-4 h-4" />}>
                        <Field label="Nombre del agente">
                            <TextInput value={config.agent_name} onChange={v => upd('agent_name', v)} placeholder="Sofía" />
                        </Field>
                        <Field label="Primer mensaje (lo que dice al contestar el lead)">
                            <TextInput value={config.first_message} onChange={v => upd('first_message', v)} placeholder="Buenas, ¿con quién tengo el gusto?..." />
                        </Field>
                        <Field label="System Prompt — Guión completo de Sofía" hint="Define personalidad, reglas y flujo • Español centroamericano obligatorio">
                            <textarea
                                value={config.system_prompt}
                                onChange={e => upd('system_prompt', e.target.value)}
                                rows={14}
                                className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-violet-400 transition resize-none leading-relaxed"
                            />
                        </Field>
                    </Section>

                    {/* Horario */}
                    <Section title="🕐 Horario de Llamadas" icon={<Clock className="w-4 h-4" />}>
                        <div className="grid grid-cols-2 gap-4 pt-4">
                            <Field label="Hora inicio">
                                <input type="time" value={config.call_hours.start}
                                    onChange={e => upd('call_hours', { ...config.call_hours, start: e.target.value })}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-violet-400"
                                />
                            </Field>
                            <Field label="Hora fin">
                                <input type="time" value={config.call_hours.end}
                                    onChange={e => upd('call_hours', { ...config.call_hours, end: e.target.value })}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-violet-400"
                                />
                            </Field>
                        </div>
                        <Field label="Días activos">
                            <div className="flex gap-2 flex-wrap pt-1">
                                {[{ k: 'MON', l: 'L' }, { k: 'TUE', l: 'M' }, { k: 'WED', l: 'X' }, { k: 'THU', l: 'J' }, { k: 'FRI', l: 'V' }, { k: 'SAT', l: 'S' }, { k: 'SUN', l: 'D' }].map(d => {
                                    const active = config.call_days.includes(d.k);
                                    return (
                                        <button key={d.k}
                                            onClick={() => upd('call_days', active ? config.call_days.filter(x => x !== d.k) : [...config.call_days, d.k])}
                                            className={`w-10 h-10 rounded-xl text-sm font-black transition-all ${active ? 'bg-violet-600 text-white shadow-md shadow-violet-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                        >{d.l}</button>
                                    );
                                })}
                            </div>
                        </Field>
                    </Section>

                    {/* Pipeline */}
                    <Section title="🔀 Pipeline — Mover Lead Automáticamente" icon={<Zap className="w-4 h-4" />}>
                        <p className="text-xs text-gray-500 font-medium pt-4 mb-3">Cuando Sofía termina, el lead se mueve a la etapa configurada:</p>
                        {[
                            { key: 'connected_qualified',     label: '✅ Calificó (>50 DTE/mes)',  color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
                            { key: 'demo_booked',             label: '📅 Demo agendada',            color: 'bg-purple-50 border-purple-200 text-purple-800' },
                            { key: 'connected_not_qualified', label: '❌ No calificó',              color: 'bg-red-50 border-red-200 text-red-800' },
                            { key: 'no_answer',               label: '📵 Sin respuesta',            color: 'bg-gray-100 border-gray-200 text-gray-600' },
                        ].map(({ key, label, color }) => (
                            <div key={key} className="flex items-center gap-3 py-2">
                                <div className={`flex-none px-3 py-2 rounded-xl border text-xs font-bold ${color} w-48 text-center`}>{label}</div>
                                <ArrowRight className="w-4 h-4 text-gray-300 flex-none" />
                                <select
                                    value={(config.outcome_mapping as Record<string, string>)[key] || ''}
                                    onChange={e => upd('outcome_mapping', { ...config.outcome_mapping, [key]: e.target.value })}
                                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-violet-400 transition"
                                >
                                    <option value="">— Sin cambio —</option>
                                    {stages.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        ))}
                    </Section>

                    {/* PRUEBA */}
                    <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-5 mt-4">
                        <h4 className="text-emerald-800 font-black mb-1 text-center">Pruébalo ahora mismo</h4>
                        <p className="text-xs text-emerald-600 mb-4 text-center">Enviaremos una llamada de prueba desde tu sistema hacia el número que ingreses aquí.</p>
                        
                        <div className="flex flex-col sm:flex-row items-center gap-3 justify-center w-full max-w-md mx-auto">
                            <input 
                                value={testPhoneInput} 
                                onChange={e => setTestPhoneInput(e.target.value)} 
                                placeholder="+503..." 
                                className="flex-1 px-4 py-3 bg-white border border-emerald-200 rounded-xl text-sm font-bold shadow-sm focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                            />
                            <button onClick={handleTestCall} disabled={testing || !isConfigured}
                                className="px-6 py-3 bg-emerald-500 text-white font-black rounded-xl hover:bg-emerald-600 transition flex items-center gap-2 text-sm shadow-md shadow-emerald-500/30 disabled:opacity-50 flex-none">
                                {testing ? <><RefreshCw className="w-4 h-4 animate-spin" /> Llamando...</> : <><PhoneCall className="w-4 h-4" /> Probar Llamada</>}
                            </button>
                        </div>
                    </div>

                    <button onClick={save} disabled={saving}
                        className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-violet-200 hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-base">
                        {saving ? <><RefreshCw className="w-5 h-5 animate-spin" /> Guardando...</> : <><Save className="w-5 h-5" /> Guardar configuración</>}
                    </button>
                </div>
            )}

            {/* QUEUE */}
            {tab === 'queue' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-black text-gray-900">Cola de llamadas en vivo</h3>
                            <p className="text-xs text-gray-500">{queue.length} registros</p>
                        </div>
                        <button onClick={load} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition shadow-sm">
                            <RefreshCw className="w-3.5 h-3.5" /> Actualizar
                        </button>
                    </div>
                    {queue.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                            <div className="text-4xl mb-3">📭</div>
                            <p className="text-sm font-bold text-gray-500">Cola vacía</p>
                            <p className="text-xs text-gray-400 mt-1">Los leads aparecerán cuando Sofía empiece a llamar</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                            {queue.map(item => (
                                <div key={item.id} className="p-3">
                                    <QueueCard item={item} />
                                    {item.summary && (
                                        <div className="mt-2 ml-5 bg-gray-50 rounded-xl px-3 py-2 text-xs text-gray-600">
                                            <span className="font-bold text-violet-600">Sofía: </span>{item.summary}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
