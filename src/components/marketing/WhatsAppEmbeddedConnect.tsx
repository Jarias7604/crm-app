import { useState, useEffect } from 'react';
import { CheckCircle2, Phone, Loader2, ChevronRight, RefreshCw, ArrowLeft, Zap, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase';

const META_APP_ID = import.meta.env.VITE_META_APP_ID || '1187621119804509';
const META_WA_CONFIG_ID = import.meta.env.VITE_META_WA_CONFIG_ID || '';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

declare global { interface Window { FB: any; fbAsyncInit: any; } }

interface PhoneOption { id: string; display_phone_number: string; verified_name: string; status: string; waba_id: string; }
interface Props {
  companyId: string;
  onSuccess: (data: { phone: string; phoneNumberId: string; wabaId: string; token: string }) => void;
  onSwitchManual: () => void;
}

type Step = 'landing' | 'loading' | 'pick' | 'success';

export default function WhatsAppEmbeddedConnect({ companyId, onSuccess, onSwitchManual }: Props) {
  const [step, setStep] = useState<Step>('landing');
  const [numbers, setNumbers] = useState<PhoneOption[]>([]);
  const [pendingToken, setPendingToken] = useState('');
  const [connectedPhone, setConnectedPhone] = useState('');
  const [sdkReady, setSdkReady] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Conectando con Meta...');
  const loadingTimerRef = { current: null as ReturnType<typeof setTimeout> | null };

  // Load Facebook JS SDK
  useEffect(() => {
    if (window.FB) { setSdkReady(true); return; }
    window.fbAsyncInit = () => {
      window.FB.init({ appId: META_APP_ID, autoLogAppEvents: true, xfbml: false, version: 'v21.0' });
      setSdkReady(true);
    };
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    return () => { /* SDK stays loaded */ };
  }, []);

  const handleEmbeddedSignup = () => {
    if (!sdkReady || !window.FB) {
      toast.error('SDK de Facebook no cargó. Recarga la página.');
      return;
    }
    if (!META_WA_CONFIG_ID) {
      toast.error('Falta VITE_META_WA_CONFIG_ID en las variables de entorno.');
      return;
    }
    setStep('loading');
    setLoadingMsg('Conectando con Meta...');

    // Auto-reset after 45 seconds if callback never fires (popup blocked)
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    loadingTimerRef.current = setTimeout(() => {
      setStep('landing');
      toast.error('Tiempo de espera agotado. ¿Popups bloqueados? Permite popups de este sitio e intenta de nuevo.', { duration: 8000 });
    }, 45000);

    window.FB.login(
      async (response: any) => {
        if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
        if (response?.authResponse?.code) {
          setLoadingMsg('Procesando tu cuenta...');
          await handleCodeExchange(response.authResponse.code);
        } else if (response?.status === 'connected' && response?.authResponse?.accessToken) {
          // FB returned an access token instead of a code (config mismatch)
          toast.error('Configuración de Meta incompleta. Usa el Modo Avanzado.', { duration: 8000 });
          setStep('landing');
        } else {
          toast.error('Conexión cancelada o popup bloqueado. Intenta de nuevo.');
          setStep('landing');
        }
      },
      {
        config_id: META_WA_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, featureType: '', sessionInfoVersion: '3' },
      }
    );
  };

  const handleCodeExchange = async (code: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-embedded-signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ code, company_id: companyId }),
      });
      const result = await res.json();
      if (!res.ok || result.error) throw new Error(result.error || 'Error del servidor');

      if (result.auto_saved) {
        setConnectedPhone(result.phone_number);
        setStep('success');
        onSuccess({ phone: result.phone_number, phoneNumberId: result.phone_number_id, wabaId: result.waba_id, token: '' });
      } else {
        setPendingToken(result.token);
        setNumbers(result.numbers || []);
        setStep('pick');
      }
    } catch (err: any) {
      toast.error(err.message);
      setStep('landing');
    }
  };

  const handlePickNumber = async (num: PhoneOption) => {
    setStep('loading');
    try {
      // Save the selected number via onSuccess callback
      setConnectedPhone(num.display_phone_number);
      setStep('success');
      onSuccess({ phone: num.display_phone_number, phoneNumberId: num.id, wabaId: num.waba_id, token: pendingToken });
    } catch (err: any) {
      toast.error(err.message);
      setStep('pick');
    }
  };

  // ── LOADING ────────────────────────────────────────────────────────────────
  if (step === 'loading') return (
    <div className="flex flex-col items-center justify-center py-10 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center animate-pulse">
        <span className="text-3xl">📱</span>
      </div>
      <Loader2 className="w-6 h-6 text-green-500 animate-spin" />
      <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{loadingMsg}</p>
      <p className="text-[10px] text-gray-400 font-medium text-center max-w-xs">
        Se abrió una ventana de Facebook. Complétala y regresa aquí.
      </p>
      <button
        onClick={() => {
          if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
          setStep('landing');
        }}
        className="text-[10px] text-gray-400 underline hover:text-gray-600 transition-colors mt-2"
      >
        Cancelar y volver
      </button>
    </div>
  );

  // ── PICK NUMBER ────────────────────────────────────────────────────────────
  if (step === 'pick') return (
    <div className="space-y-4">
      <button onClick={() => setStep('landing')} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 font-bold transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Volver
      </button>
      <div className="flex items-center gap-3 pb-2">
        <div className="w-9 h-9 rounded-xl bg-green-500 flex items-center justify-center shrink-0">
          <Phone className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-black text-gray-900">Selecciona el número</p>
          <p className="text-[10px] text-gray-400 font-medium">{numbers.length} número(s) encontrado(s)</p>
        </div>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {numbers.map(num => (
          <button
            key={num.id}
            onClick={() => handlePickNumber(num)}
            className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-gray-100 hover:border-green-400 hover:bg-green-50/30 transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
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
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-green-500 transition-colors" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  // ── SUCCESS ────────────────────────────────────────────────────────────────
  if (step === 'success') return (
    <div className="text-center space-y-5 py-6">
      <div className="relative w-20 h-20 mx-auto">
        <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow text-sm">✅</div>
      </div>
      <div>
        <h3 className="text-lg font-black text-gray-900">¡WhatsApp Conectado!</h3>
        <p className="text-sm text-gray-500 font-medium mt-1">
          <span className="font-black text-green-600">{connectedPhone}</span> ya recibe leads en este workspace.
        </p>
      </div>
      <div className="flex items-center justify-center gap-2 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-[10px] font-black text-green-700 uppercase tracking-widest">Activo y Recibiendo Mensajes</span>
      </div>
    </div>
  );

  // ── LANDING ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50/50 border border-green-100 rounded-3xl p-6 text-center space-y-3">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-white shadow-sm border border-green-100 flex items-center justify-center text-3xl">📱</div>
        <div>
          <h3 className="text-base font-black text-gray-900">Conecta WhatsApp Business</h3>
          <p className="text-[11px] text-gray-500 font-medium mt-1 max-w-xs mx-auto">
            Recibe y responde leads directamente desde el CRM. Sin salir a Meta.
          </p>
        </div>

        {/* Embedded Signup Button */}
        {META_WA_CONFIG_ID ? (
          <button
            onClick={handleEmbeddedSignup}
            disabled={!sdkReady}
            className="w-full h-12 rounded-2xl bg-[#25D366] hover:bg-[#20C05A] text-white font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2.5 shadow-lg shadow-green-200/60 transition-all hover:translate-y-[-1px] active:scale-95 disabled:opacity-50"
          >
            {sdkReady ? (
              <>
                <Zap className="w-4 h-4" />
                Conectar con Meta — 1 Click
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Cargando...
              </>
            )}
          </button>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left space-y-2">
            <p className="text-[10px] font-black text-amber-800 uppercase tracking-wider">⚙️ Configuración Requerida</p>
            <p className="text-[10px] text-amber-700 font-medium">
              Para usar Embedded Signup, agrega <code className="bg-amber-100 px-1 rounded font-mono">VITE_META_WA_CONFIG_ID</code> en tu <code className="bg-amber-100 px-1 rounded font-mono">.env</code>.<br />
              Obtenlo en: <span className="font-black">Meta App → WhatsApp → Embedded Signup → Configuration Profile</span>
            </p>
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {[
          { icon: '🔐', text: 'Login con tu cuenta de Facebook' },
          { icon: '📋', text: 'Selecciona tu cuenta de WhatsApp Business' },
          { icon: '✅', text: 'Tu número queda activo en este workspace' },
        ].map((s, i) => (
          <div key={i} className="flex items-center gap-3 px-1">
            <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-sm shrink-0">{s.icon}</div>
            <p className="text-[11px] text-gray-500 font-medium">{s.text}</p>
          </div>
        ))}
      </div>

      {/* Divider + Manual fallback */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100" /></div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-[9px] font-black text-gray-300 uppercase tracking-widest">O también puedes</span>
        </div>
      </div>

      <button
        onClick={onSwitchManual}
        className="w-full h-10 rounded-xl border border-gray-100 text-gray-400 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:border-gray-200 hover:text-gray-600 transition-all"
      >
        <Settings className="w-3.5 h-3.5" />
        Configuración Manual Avanzada
      </button>
    </div>
  );
}
