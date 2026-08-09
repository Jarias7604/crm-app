import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Phone, Loader2, ChevronRight, ArrowLeft, Zap, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase';

const META_APP_ID = import.meta.env.VITE_META_APP_ID || '1187621119804509';
const META_WA_CONFIG_ID = import.meta.env.VITE_META_WA_CONFIG_ID || '1055343583553557';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
  const [loadingMsg, setLoadingMsg] = useState('Esperando autorización de Meta...');
  const stepRef = useRef<Step>('landing');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageListenerRef = useRef<((e: MessageEvent) => void) | null>(null);
  const currentRedirectUriRef = useRef<string>('');
  const exchangingRef = useRef<boolean>(false);

  // Keep stepRef in sync
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  // Check for sessionStorage fallback (when popup opener wasn't available)
  useEffect(() => {
    const code = sessionStorage.getItem('wa_oauth_code');
    const state = sessionStorage.getItem('wa_oauth_state');
    if (code && state === companyId && !exchangingRef.current) {
      sessionStorage.removeItem('wa_oauth_code');
      sessionStorage.removeItem('wa_oauth_state');
      setStep('loading');
      setLoadingMsg('Procesando tu cuenta de WhatsApp...');
      handleCodeExchange(code);
    }
  }, [companyId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (messageListenerRef.current) {
        window.removeEventListener('message', messageListenerRef.current);
      }
    };
  }, []);

  const handleEmbeddedSignup = () => {
    if (!META_WA_CONFIG_ID) {
      toast.error('Falta configuración de Meta. Contacta al administrador.', { duration: 6000 });
      return;
    }

    exchangingRef.current = false;
    // Canonicalize callback URL to remove www. if present so redirect_uri is 100% deterministic
    const cleanOrigin = window.location.origin.replace('://www.', '://');
    const callbackUrl = `${cleanOrigin}/integrations/wa/callback`;
    currentRedirectUriRef.current = callbackUrl;

    const params = new URLSearchParams({
      client_id: META_APP_ID,
      config_id: META_WA_CONFIG_ID,
      redirect_uri: callbackUrl,
      response_type: 'code',
      override_default_response_type: 'true',
      state: companyId,
    });
    const oauthUrl = `https://www.facebook.com/dialog/oauth?${params.toString()}`;

    // Open as popup window
    const popup = window.open(
      oauthUrl,
      'wa-meta-oauth',
      'width=640,height=720,scrollbars=yes,resizable=yes,left=200,top=50'
    );

    if (!popup || popup.closed) {
      toast.error('El navegador bloqueó la ventana emergente. Permite popups en este sitio e intenta nuevamente.', { duration: 8000 });
      return;
    }

    setStep('loading');
    setLoadingMsg('Esperando que completes el proceso en la ventana de Facebook...');

    // Listen for postMessage from WAOAuthCallback
    const handleMessage = (event: MessageEvent) => {
      if (!event.origin.includes('ariascrm.com') && event.origin !== window.location.origin) return;
      if (event.data?.type !== 'WA_OAUTH_CALLBACK') return;

      window.removeEventListener('message', handleMessage);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      if (event.data.code) {
        setLoadingMsg('Verificando tu cuenta de WhatsApp con Meta...');
        handleCodeExchange(event.data.code);
      } else {
        toast.error(event.data.error || 'Conexión cancelada o denegada por Facebook.');
        setStep('landing');
      }
    };

    messageListenerRef.current = handleMessage;
    window.addEventListener('message', handleMessage);

    // Auto-reset if popup is closed without completing
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        setTimeout(() => {
          if (stepRef.current === 'loading' && !exchangingRef.current) {
            window.removeEventListener('message', handleMessage);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setStep('landing');
            toast.error('La ventana de Facebook fue cerrada sin completar el proceso.');
          }
        }, 1500);
      }
    }, 800);

    // Hard timeout: 3 minutes
    timeoutRef.current = setTimeout(() => {
      clearInterval(checkClosed);
      window.removeEventListener('message', handleMessage);
      setStep('landing');
      toast.error('Tiempo agotado. Intenta nuevamente.', { duration: 5000 });
    }, 180_000);
  };

  const handleCodeExchange = async (code: string) => {
    if (exchangingRef.current && code !== 'direct_fetch') return;
    exchangingRef.current = true;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const redirectUriToUse = currentRedirectUriRef.current || `${window.location.origin.replace('://www.', '://')}/integrations/wa/callback`;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-embedded-signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          code,
          company_id: companyId,
          redirect_uri: redirectUriToUse
        }),
      });

      const result = await res.json();
      if (!res.ok || result.error) throw new Error(result.error || 'Error de conexión con Meta');

      setPendingToken(result.token || '');
      const fetchedNumbers: PhoneOption[] = result.numbers || [];
      setNumbers(fetchedNumbers);

      if (fetchedNumbers.length === 1) {
        // Auto-select single number
        const singleNum = fetchedNumbers[0];
        setConnectedPhone(singleNum.display_phone_number);
        setStep('success');
        onSuccess({
          phone: singleNum.display_phone_number,
          phoneNumberId: singleNum.id,
          wabaId: singleNum.waba_id,
          token: result.token || '',
        });
      } else if (fetchedNumbers.length > 1) {
        // Show pick step
        setStep('pick');
      } else {
        throw new Error('No se encontraron números de WhatsApp Business en tu cuenta de Meta.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al validar cuenta de WhatsApp');
      setStep('landing');
    } finally {
      exchangingRef.current = false;
    }
  };

  const handlePickNumber = async (num: PhoneOption) => {
    setStep('loading');
    setLoadingMsg('Guardando número de WhatsApp...');
    try {
      setConnectedPhone(num.display_phone_number);
      setStep('success');
      onSuccess({
        phone: num.display_phone_number,
        phoneNumberId: num.id,
        wabaId: num.waba_id,
        token: pendingToken,
      });
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
      <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest text-center px-4">{loadingMsg}</p>
      <button
        onClick={() => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          if (messageListenerRef.current) window.removeEventListener('message', messageListenerRef.current);
          exchangingRef.current = false;
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
          <p className="text-sm font-black text-gray-900">Selecciona tu número de WhatsApp</p>
          <p className="text-[10px] text-gray-400 font-medium">Se encontraron {numbers.length} número(s) en tu cuenta Meta</p>
        </div>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {numbers.map(num => (
          <button
            key={num.id}
            onClick={() => handlePickNumber(num)}
            className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-gray-100 hover:border-green-500 hover:bg-green-50/40 transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <Phone className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-black text-gray-900">{num.display_phone_number}</p>
                <p className="text-[10px] text-gray-500 font-bold">{num.verified_name}</p>
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
            Vincular tu número oficial de Facebook / Meta para enviar y recibir mensajes directamente desde el CRM.
          </p>
        </div>

        {/* Connect Button */}
        {META_WA_CONFIG_ID ? (
          <div className="space-y-2 pt-2">
            <button
              onClick={handleEmbeddedSignup}
              className="w-full h-12 rounded-2xl bg-[#25D366] hover:bg-[#20C05A] text-white font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2.5 shadow-lg shadow-green-200/60 transition-all hover:translate-y-[-1px] active:scale-95"
            >
              <Zap className="w-4 h-4" />
              Conectar con Meta — 1 Click
            </button>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left space-y-2">
            <p className="text-[10px] font-black text-amber-800 uppercase tracking-wider">⚙️ Configuración Requerida</p>
            <p className="text-[10px] text-amber-700 font-medium">
              Falta <code className="bg-amber-100 px-1 rounded font-mono">VITE_META_WA_CONFIG_ID</code> en las variables de entorno.
            </p>
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {[
          { icon: '🔐', text: 'Se abre la ventana oficial de Facebook Meta' },
          { icon: '📋', text: 'Selecciona tu cuenta de WhatsApp Business' },
          { icon: '✅', text: 'Tu número se registra automáticamente en este workspace' },
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
        Configuración Manual Avanzada (Ingresar Token)
      </button>
    </div>
  );
}
