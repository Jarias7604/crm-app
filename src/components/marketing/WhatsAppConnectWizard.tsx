import { useState } from 'react';
import { Wifi, CheckCircle2, XCircle, RefreshCw, ChevronRight, Phone, Key, ArrowLeft, ExternalLink, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface PhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name: string;
  status: string;
  quality_rating: string;
}

interface Props {
  /** Called when the user has selected a number and wants to save */
  onSave: (data: { token: string; phoneNumberId: string; wabaId: string; phone: string }) => Promise<void>;
  /** Called when the user cancels */
  onCancel: () => void;
  /** Optional: pre-fill token */
  initialToken?: string;
}

const WEBHOOK_URL = 'https://mtxqqamitglhehaktgxm.supabase.co/functions/v1/meta-webhook';
const VERIFY_TOKEN = 'crm_secure_verify';

type Step = 'token' | 'pick' | 'webhook' | 'done';

export default function WhatsAppConnectWizard({ onSave, onCancel, initialToken = '' }: Props) {
  const [step, setStep] = useState<Step>('token');
  const [token, setToken] = useState(initialToken);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [phones, setPhones] = useState<{ waba_id: string; numbers: PhoneNumber[] }[]>([]);
  const [selected, setSelected] = useState<{ phone: PhoneNumber; waba_id: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  // Step 1 → Step 2: Fetch all phone numbers for this token
  const handleFetchNumbers = async () => {
    if (!token.trim()) {
      setError('Ingresa tu Access Token primero.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Get all WABAs linked to this token
      const r1 = await fetch(
        `https://graph.facebook.com/v19.0/me/businesses?fields=name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name,status,quality_rating}}&access_token=${token.trim()}`
      );
      const d1 = await r1.json();

      if (d1.error) throw new Error(d1.error.message);

      // Collect all WABAs + numbers
      const results: { waba_id: string; numbers: PhoneNumber[] }[] = [];

      const businesses = d1.data || [];
      for (const biz of businesses) {
        const wabas = biz.owned_whatsapp_business_accounts?.data || [];
        for (const waba of wabas) {
          const nums = waba.phone_numbers?.data || [];
          if (nums.length > 0) {
            results.push({ waba_id: waba.id, numbers: nums });
          }
        }
      }

      // Fallback: try direct WABA phone numbers if businesses API doesn't work
      if (results.length === 0) {
        // Try getting phone numbers directly via the token's WABA
        const r2 = await fetch(
          `https://graph.facebook.com/v19.0/me?fields=whatsapp_business_accounts{id,phone_numbers{id,display_phone_number,verified_name,status,quality_rating}}&access_token=${token.trim()}`
        );
        const d2 = await r2.json();
        const wabas2 = d2.whatsapp_business_accounts?.data || [];
        for (const waba of wabas2) {
          const nums = waba.phone_numbers?.data || [];
          if (nums.length > 0) {
            results.push({ waba_id: waba.id, numbers: nums });
          }
        }
      }

      if (results.length === 0 || results.every(r => r.numbers.length === 0)) {
        throw new Error('No se encontraron números de WhatsApp asociados a este token. Verifica que el System User tenga acceso al WABA.');
      }

      setPhones(results);
      setStep('pick');
    } catch (e: any) {
      setError(e.message || 'No se pudo conectar con Meta. Revisa el token.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2 → Step 3
  const handleSelectNumber = (phone: PhoneNumber, waba_id: string) => {
    setSelected({ phone, waba_id });
    setStep('webhook');
  };

  // Step 3 → Save
  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await onSave({
        token: token.trim(),
        phoneNumberId: selected.phone.id,
        wabaId: selected.waba_id,
        phone: selected.phone.display_phone_number,
      });
      setStep('done');
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  // ── UI ─────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        {(['token', 'pick', 'webhook', 'done'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 transition-all ${
              step === s ? 'bg-green-500 text-white scale-110' :
              (['pick', 'webhook', 'done'].indexOf(step) > ['token', 'pick', 'webhook', 'done'].indexOf(s))
                ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
            }`}>
              {(['pick', 'webhook', 'done'].indexOf(step) > ['token', 'pick', 'webhook', 'done'].indexOf(s))
                ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            {i < 3 && <div className={`h-0.5 flex-1 rounded transition-all ${
              (['pick', 'webhook', 'done'].indexOf(step) > i) ? 'bg-green-200' : 'bg-gray-100'
            }`} />}
          </div>
        ))}
      </div>

      {/* ── STEP 1: Token ─────────────────────────────────────────────────── */}
      {step === 'token' && (
        <div className="space-y-5">
          <div>
            <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
              <Key className="w-5 h-5 text-green-500" />
              Ingresa tu Access Token de Meta
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Genera un <strong>System User Token permanente</strong> en tu cuenta de Meta Business.{' '}
              <a
                href="https://business.facebook.com/settings/system-users"
                target="_blank"
                rel="noreferrer"
                className="text-blue-500 underline inline-flex items-center gap-0.5"
              >
                Ir a Meta Business <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>

          {/* Mini guide */}
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-2">
            <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Cómo obtener el token</p>
            {[
              'Entra a business.facebook.com → Configuración → Usuarios del Sistema',
              'Crea un "Usuario del Sistema" o usa uno existente',
              'Clic en "Generar token" → Elige tu app → Marca "whatsapp_business_messaging"',
              'Copia el token y pégalo abajo',
            ].map((step, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="w-4 h-4 rounded-full bg-blue-200 text-blue-700 text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-xs text-blue-700 font-medium">{step}</p>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Access Token</label>
            <textarea
              value={token}
              onChange={e => { setToken(e.target.value); setError(''); }}
              placeholder="EAAQ4Ipb5RF0..."
              rows={3}
              className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 focus:border-green-400 focus:bg-white outline-none font-mono text-[11px] transition-all resize-none"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-600 font-medium">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 h-12 rounded-2xl border border-gray-200 text-gray-400 font-black text-[11px] uppercase tracking-widest hover:bg-gray-50 transition-all">
              Cancelar
            </button>
            <button
              onClick={handleFetchNumbers}
              disabled={loading || !token.trim()}
              className="flex-[2] h-12 rounded-2xl bg-green-500 hover:bg-green-600 text-white font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-green-100 transition-all disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
              {loading ? 'Buscando números...' : 'Buscar mis números'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Pick number ────────────────────────────────────────────── */}
      {step === 'pick' && (
        <div className="space-y-5">
          <div>
            <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
              <Phone className="w-5 h-5 text-green-500" />
              Selecciona el número de WhatsApp
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Encontramos {phones.reduce((a, p) => a + p.numbers.length, 0)} número(s) en tu cuenta. Elige el que quieres conectar a este workspace.
            </p>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto">
            {phones.map(({ waba_id, numbers }) =>
              numbers.map(num => (
                <button
                  key={num.id}
                  onClick={() => handleSelectNumber(num, waba_id)}
                  className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-gray-100 hover:border-green-400 hover:bg-green-50/30 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                      <Phone className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-900">{num.display_phone_number}</p>
                      <p className="text-[10px] text-gray-400 font-medium">{num.verified_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                      num.status === 'CONNECTED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                      'bg-amber-50 text-amber-600 border border-amber-200'
                    }`}>
                      {num.status === 'CONNECTED' ? '✅ Activo' : num.status}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-green-500 transition-colors" />
                  </div>
                </button>
              ))
            )}
          </div>

          <button onClick={() => setStep('token')} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 font-bold transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Cambiar token
          </button>
        </div>
      )}

      {/* ── STEP 3: Webhook reminder ──────────────────────────────────────── */}
      {step === 'webhook' && selected && (
        <div className="space-y-5">
          <div>
            <h3 className="text-base font-black text-gray-900">Último paso — Configura el Webhook</h3>
            <p className="text-xs text-gray-400 mt-1">
              Necesitas configurar el webhook en Meta Developers para que los mensajes lleguen al CRM.
              Es solo una vez por App de Meta.
            </p>
          </div>

          {/* Selected number summary */}
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl p-3">
            <Phone className="w-5 h-5 text-green-500 shrink-0" />
            <div>
              <p className="text-sm font-black text-green-900">{selected.phone.display_phone_number}</p>
              <p className="text-[10px] text-green-600 font-medium">{selected.phone.verified_name}</p>
            </div>
          </div>

          {/* Webhook instructions */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
            <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Pasos en Meta Developers</p>
            <ol className="space-y-2">
              {[
                'Ve a developers.facebook.com → Tu App → WhatsApp → Configuración',
                'En la sección "Webhook", haz clic en "Verificar y guardar"',
                'Usa los datos de abajo:',
              ].map((s, i) => (
                <li key={i} className="flex gap-2 text-xs text-amber-800 font-medium">
                  <span className="font-black">{i + 1}.</span> {s}
                </li>
              ))}
            </ol>

            <div className="bg-white border border-amber-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase">URL de Callback</p>
                  <p className="text-[10px] font-mono text-gray-700 break-all">{WEBHOOK_URL}</p>
                </div>
                <button onClick={() => copyText(WEBHOOK_URL, 'url')} className="p-1.5 hover:bg-gray-50 rounded-lg transition-colors shrink-0">
                  {copied === 'url' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                </button>
              </div>
              <div className="flex items-center justify-between border-t border-amber-100 pt-2">
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase">Token de Verificación</p>
                  <p className="text-[10px] font-mono text-gray-700">{VERIFY_TOKEN}</p>
                </div>
                <button onClick={() => copyText(VERIFY_TOKEN, 'vt')} className="p-1.5 hover:bg-gray-50 rounded-lg transition-colors shrink-0">
                  {copied === 'vt' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                </button>
              </div>
            </div>

            <p className="text-[10px] text-amber-700">
              Después de guardar el webhook, suscribe el campo <strong>messages</strong> y guarda.
            </p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('pick')} className="flex-1 h-12 rounded-2xl border border-gray-200 text-gray-400 font-black text-[11px] uppercase tracking-widest hover:bg-gray-50 transition-all">
              Atrás
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-[2] h-12 rounded-2xl bg-green-500 hover:bg-green-600 text-white font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-green-100 transition-all disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {saving ? 'Guardando...' : 'Guardar y Activar'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Done ──────────────────────────────────────────────────── */}
      {step === 'done' && selected && (
        <div className="text-center space-y-4 py-4">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <div>
            <h3 className="text-lg font-black text-gray-900">¡WhatsApp Conectado!</h3>
            <p className="text-sm text-gray-400 mt-1">
              <strong>{selected.phone.display_phone_number}</strong> está activo y listo para recibir leads.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="w-full h-12 rounded-2xl bg-gray-900 text-white font-black text-[11px] uppercase tracking-widest transition-all hover:bg-black"
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}
