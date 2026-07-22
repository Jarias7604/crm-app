import { useState } from 'react';
import {
    Wifi, CheckCircle2, XCircle, RefreshCw, ChevronRight,
    Phone, Key, ArrowLeft, Copy, Check, ExternalLink,
    Building2, Settings, Zap
} from 'lucide-react';
import toast from 'react-hot-toast';

interface PhoneNumber {
    id: string;
    display_phone_number: string;
    verified_name: string;
    status: string;
    quality_rating: string;
}

interface Props {
    onSave: (data: { token: string; phoneNumberId: string; wabaId: string; phone: string }) => Promise<void>;
    onCancel: () => void;
    initialToken?: string;
}

const WEBHOOK_URL = 'https://mtxqqamitglhehaktgxm.supabase.co/functions/v1/meta-webhook';
const VERIFY_TOKEN = 'crm_secure_verify';

type Step = 'guide' | 'token' | 'pick' | 'done';

const PRE_STEPS = [
    {
        num: 1,
        icon: Building2,
        title: 'Crea un Sistema de Usuario en Meta',
        actions: [
            { text: 'Ir a Meta Business Suite → Configuración → Usuarios del Sistema', link: 'https://business.facebook.com/settings/system-users' },
            { text: 'Crea un Usuario del Sistema con rol "Administrador"' },
        ],
    },
    {
        num: 2,
        icon: Key,
        title: 'Genera tu Access Token permanente',
        actions: [
            { text: 'Clic en "Generar token" → Elige tu App de WhatsApp' },
            { text: 'Marca los permisos: whatsapp_business_messaging y whatsapp_business_management' },
            { text: 'Copia el token — solo se muestra una vez' },
        ],
        warning: 'El token solo aparece una vez. Cópialo antes de cerrar.',
    },
    {
        num: 3,
        icon: Settings,
        title: 'Configura el Webhook en Meta Developers (solo 1 vez)',
        actions: [
            { text: 'Ve a developers.facebook.com → Tu App → WhatsApp → Configuración → Webhook', link: 'https://developers.facebook.com' },
            { text: 'Usa la URL y el Token de abajo, suscribe el campo "messages"' },
        ],
        isCopy: true,
    },
];

export default function WhatsAppConnectWizard({ onSave, onCancel, initialToken = '' }: Props) {
    const [step, setStep] = useState<Step>('guide');
    const [token, setToken] = useState(initialToken);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [phones, setPhones] = useState<{ waba_id: string; numbers: PhoneNumber[] }[]>([]);
    const [selected, setSelected] = useState<{ phone: PhoneNumber; waba_id: string } | null>(null);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);

    const copy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
        toast.success('Copiado');
    };

    const handleFetchNumbers = async () => {
        if (!token.trim()) { setError('Ingresa tu Access Token primero.'); return; }
        setLoading(true); setError('');
        try {
            const r1 = await fetch(
                `https://graph.facebook.com/v19.0/me/businesses?fields=name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name,status,quality_rating}}&access_token=${token.trim()}`
            );
            const d1 = await r1.json();
            if (d1.error) throw new Error(d1.error.message);

            const results: { waba_id: string; numbers: PhoneNumber[] }[] = [];
            for (const biz of d1.data || []) {
                for (const waba of biz.owned_whatsapp_business_accounts?.data || []) {
                    const nums = waba.phone_numbers?.data || [];
                    if (nums.length > 0) results.push({ waba_id: waba.id, numbers: nums });
                }
            }

            if (results.length === 0) {
                const r2 = await fetch(
                    `https://graph.facebook.com/v19.0/me?fields=whatsapp_business_accounts{id,phone_numbers{id,display_phone_number,verified_name,status,quality_rating}}&access_token=${token.trim()}`
                );
                const d2 = await r2.json();
                for (const waba of d2.whatsapp_business_accounts?.data || []) {
                    const nums = waba.phone_numbers?.data || [];
                    if (nums.length > 0) results.push({ waba_id: waba.id, numbers: nums });
                }
            }

            if (results.length === 0) throw new Error('No se encontraron números. Verifica que el System User tenga acceso al WABA.');
            setPhones(results);
            setStep('pick');
        } catch (e: any) {
            setError(e.message || 'No se pudo conectar con Meta. Revisa el token.');
        } finally { setLoading(false); }
    };

    const handleSave = async () => {
        if (!selected) return;
        setSaving(true);
        try {
            await onSave({ token: token.trim(), phoneNumberId: selected.phone.id, wabaId: selected.waba_id, phone: selected.phone.display_phone_number });
            setStep('done');
        } catch (e: any) {
            toast.error(e.message || 'Error al guardar.');
        } finally { setSaving(false); }
    };

    // ── STEP: Guía de preparación ──────────────────────────────────────────────
    if (step === 'guide') return (
        <div className="space-y-5">
            <div className="flex items-center gap-2 pb-1">
                <div className="w-1 h-5 bg-green-500 rounded-full" />
                <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Antes de conectar, completa estos pasos en Meta</p>
            </div>

            {PRE_STEPS.map((s) => {
                const Icon = s.icon;
                return (
                    <div key={s.num} className="border border-gray-100 rounded-2xl p-4 space-y-3 bg-gray-50/30">
                        {/* Step header */}
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-green-500 flex items-center justify-center shrink-0">
                                <span className="text-white text-[11px] font-black">{s.num}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4 text-gray-400" />
                                <p className="text-sm font-black text-gray-800">{s.title}</p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="space-y-1.5 pl-11">
                            {s.actions.map((a, i) => (
                                <div key={i} className="flex items-start gap-2">
                                    <ChevronRight className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
                                    <p className="text-xs text-gray-600 font-medium">
                                        {a.text}
                                        {a.link && (
                                            <a href={a.link} target="_blank" rel="noreferrer" className="ml-1.5 inline-flex items-center gap-0.5 text-blue-500 underline font-bold">
                                                Abrir <ExternalLink className="w-3 h-3" />
                                            </a>
                                        )}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* Warning */}
                        {s.warning && (
                            <div className="ml-11 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                                <XCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                <p className="text-[10px] text-amber-700 font-bold">{s.warning}</p>
                            </div>
                        )}

                        {/* Webhook copy box */}
                        {s.isCopy && (
                            <div className="ml-11 bg-white border border-gray-200 rounded-xl overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                                    <div>
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">URL de Callback</p>
                                        <p className="text-[10px] font-mono text-gray-700 break-all">{WEBHOOK_URL}</p>
                                    </div>
                                    <button onClick={() => copy(WEBHOOK_URL, 'url')} className="ml-2 p-1.5 hover:bg-gray-50 rounded-lg shrink-0">
                                        {copied === 'url' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                                    </button>
                                </div>
                                <div className="flex items-center justify-between px-3 py-2">
                                    <div>
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Token de Verificación</p>
                                        <p className="text-[10px] font-mono text-gray-700">{VERIFY_TOKEN}</p>
                                    </div>
                                    <button onClick={() => copy(VERIFY_TOKEN, 'vt')} className="ml-2 p-1.5 hover:bg-gray-50 rounded-lg shrink-0">
                                        {copied === 'vt' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}

            <div className="flex gap-3 pt-2">
                <button onClick={onCancel} className="flex-1 h-11 rounded-2xl border border-gray-200 text-gray-400 font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all">
                    Cancelar
                </button>
                <button
                    onClick={() => setStep('token')}
                    className="flex-[2] h-11 rounded-2xl bg-green-500 hover:bg-green-600 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-green-100 transition-all"
                >
                    <Zap className="w-4 h-4" />
                    Ya los completé — Conectar ahora
                </button>
            </div>
        </div>
    );

    // ── STEP: Token ────────────────────────────────────────────────────────────
    if (step === 'token') return (
        <div className="space-y-4">
            <button onClick={() => setStep('guide')} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 font-bold transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Volver a la guía
            </button>

            <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-green-500 flex items-center justify-center">
                    <Key className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                    <p className="text-sm font-black text-gray-900">Pega tu Access Token</p>
                    <p className="text-[10px] text-gray-400 font-medium">El token generado en el Paso 2 de la guía</p>
                </div>
            </div>

            <textarea
                value={token}
                onChange={e => { setToken(e.target.value); setError(''); }}
                placeholder="EAAQ4Ipb5RF0..."
                rows={3}
                className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 focus:border-green-400 focus:bg-white outline-none font-mono text-[11px] transition-all resize-none"
            />

            {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-600 font-medium">
                    <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {error}
                </div>
            )}

            <button
                onClick={handleFetchNumbers}
                disabled={loading || !token.trim()}
                className="w-full h-11 rounded-2xl bg-green-500 hover:bg-green-600 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-green-100 transition-all disabled:opacity-50"
            >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                {loading ? 'Buscando tus números...' : 'Buscar mis números de WhatsApp'}
            </button>
        </div>
    );

    // ── STEP: Pick number ──────────────────────────────────────────────────────
    if (step === 'pick') return (
        <div className="space-y-4">
            <button onClick={() => setStep('token')} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 font-bold transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Cambiar token
            </button>

            <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-green-500 flex items-center justify-center">
                    <Phone className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                    <p className="text-sm font-black text-gray-900">Selecciona el número de WhatsApp</p>
                    <p className="text-[10px] text-gray-400 font-medium">
                        {phones.reduce((a, p) => a + p.numbers.length, 0)} número(s) encontrado(s) en tu cuenta
                    </p>
                </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
                {phones.map(({ waba_id, numbers }) =>
                    numbers.map(num => (
                        <button
                            key={num.id}
                            onClick={() => { setSelected({ phone: num, waba_id }); handleSave(); }}
                            className="w-full flex items-center justify-between p-3.5 rounded-2xl border-2 border-gray-100 hover:border-green-400 hover:bg-green-50/30 transition-all text-left group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                                    <Phone className="w-4 h-4 text-green-500" />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-gray-900">{num.display_phone_number}</p>
                                    <p className="text-[10px] text-gray-400 font-medium">{num.verified_name}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${num.status === 'CONNECTED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
                                    {num.status === 'CONNECTED' ? '● Activo' : num.status}
                                </span>
                                {saving
                                    ? <RefreshCw className="w-4 h-4 text-green-400 animate-spin" />
                                    : <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-green-500 transition-colors" />}
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );

    // ── STEP: Done ─────────────────────────────────────────────────────────────
    if (step === 'done') return (
        <div className="text-center space-y-4 py-6">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <div>
                <h3 className="text-base font-black text-gray-900">¡WhatsApp Conectado!</h3>
                <p className="text-sm text-gray-400 font-medium mt-1">
                    <strong>{selected?.phone.display_phone_number}</strong> está activo y listo para recibir leads.
                </p>
            </div>
            <button
                onClick={onCancel}
                className="w-full h-11 rounded-2xl bg-gray-900 text-white font-black text-[10px] uppercase tracking-widest transition-all hover:bg-black"
            >
                Cerrar
            </button>
        </div>
    );

    return null;
}
