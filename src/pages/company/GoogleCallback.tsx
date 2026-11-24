import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../services/supabase';
import { RefreshCw, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function GoogleCallback() {
    const navigate = useNavigate();
    const location = useLocation();
    const { profile, simulatedCompanyId } = useAuth();
    const [status, setStatus] = useState<'waiting' | 'loading' | 'success' | 'error'>('waiting');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [enableUrl, setEnableUrl] = useState<string>('');
    const [successLabel, setSuccessLabel] = useState<string>('Redirigiendo a tus integraciones...');
    const [hasRun, setHasRun] = useState(false);

    useEffect(() => {
        // Guard: if already running or completed, don't re-run
        if (hasRun) return;

        const params = new URLSearchParams(location.search);
        const code = params.get('code');
        const googleError = params.get('error');
        const stateParam = params.get('state') || '';
        const isYouTube = stateParam.startsWith('youtube:');

        // Case 1: Google returned an error (user cancelled, etc.)
        if (googleError) {
            setErrorMessage(
                googleError === 'access_denied'
                    ? 'Cancelaste la autorización de Google. Intenta de nuevo.'
                    : `Error de Google: ${googleError}`
            );
            setStatus('error');
            setHasRun(true);
            return;
        }

        // Case 2: No auth code in the URL
        if (!code) {
            setErrorMessage('No se recibió el código de autorización de Google. La URL es inválida.');
            setStatus('error');
            setHasRun(true);
            return;
        }

        // Case 3: Profile not loaded yet — wait for the next render cycle
        if (!profile?.id || !profile?.company_id) {
            setStatus('waiting');
            return;
        }

        // Case 4: Everything ready — proceed with token exchange
        const handleCallback = async () => {
            setHasRun(true);
            setStatus('loading');

            try {
                const redirectUri = `${window.location.origin}/integrations/google/callback`;

                if (isYouTube) {
                    const targetCompanyId =
                        stateParam.slice('youtube:'.length).trim() || simulatedCompanyId || profile.company_id;
                    const { data, error: ytErr } = await supabase.functions.invoke('youtube-oauth', {
                        body: {
                            action: 'exchange_code',
                            code,
                            redirect_uri: redirectUri,
                            company_id: targetCompanyId,
                        },
                    });

                    if (ytErr || !data?.success) {
                        let detailedError = data?.error || '';
                        let foundEnableUrl = data?.enable_url || '';
                        if (!detailedError && ytErr) {
                            try {
                                const parsed = await (ytErr as any)?.context?.json?.();
                                if (parsed?.error) detailedError = parsed.error;
                                if (parsed?.enable_url) foundEnableUrl = parsed.enable_url;
                            } catch {
                                // fallback below
                            }
                        }
                        if (foundEnableUrl) setEnableUrl(foundEnableUrl);
                        throw new Error(detailedError || ytErr?.message || 'Error conectando canal de YouTube.');
                    }

                    const names = Array.isArray(data.accounts)
                        ? data.accounts.map((a: any) => a.account_name).filter(Boolean).join(', ')
                        : '';
                    toast.success(`¡YouTube conectado${names ? `: ${names}` : ''}!`);
                    setSuccessLabel('Redirigiendo a Planning → Conexiones...');
                    setStatus('success');
                    setTimeout(() => navigate('/marketing/planning?tab=connections'), 1600);
                    return;
                }

                const { data, error: fnError } = await supabase.functions.invoke('google-calendar-sync', {
                    body: {
                        action: 'exchange_code',
                        code,
                        redirect_uri: redirectUri,
                        user_id: profile.id,
                        company_id: profile.company_id,
                    }
                });

                if (fnError || !data?.success) {
                    throw new Error(fnError?.message || data?.error || 'Error al intercambiar el código de autorización.');
                }

                toast.success('¡Google Calendar conectado exitosamente!');
                setSuccessLabel('Redirigiendo a tus integraciones...');
                setStatus('success');
                setTimeout(() => navigate('/company/integrations'), 1800);

            } catch (err: any) {
                const msg = err.message || 'Error desconocido al conectar con Google.';
                setErrorMessage(msg);
                setStatus('error');
                toast.error(msg);
            }
        };

        handleCallback();
    }, [location.search, profile, simulatedCompanyId, hasRun, navigate]);

    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] px-4">

            {/* WAITING — profile loading */}
            {status === 'waiting' && (
                <>
                    <RefreshCw className="w-12 h-12 text-indigo-400 animate-spin mb-4" />
                    <h2 className="text-xl font-black text-gray-900">Preparando conexión...</h2>
                    <p className="text-gray-500 mt-2 text-sm">Cargando tu perfil de usuario.</p>
                </>
            )}

            {/* LOADING — exchanging token */}
            {status === 'loading' && (
                <>
                    <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
                    <h2 className="text-xl font-black text-gray-900">Conectando con Google...</h2>
                    <p className="text-gray-500 mt-2 text-sm">Por favor no cierres esta ventana.</p>
                </>
            )}

            {/* SUCCESS */}
            {status === 'success' && (
                <>
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    </div>
                    <h2 className="text-xl font-black text-gray-900">¡Conexión Exitosa!</h2>
                    <p className="text-gray-500 mt-2 text-sm">{successLabel}</p>
                </>
            )}

            {/* ERROR — with descriptive message and retry button */}
            {status === 'error' && (
                <>
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-black text-gray-900">Algo salió mal</h2>
                    {errorMessage && (
                        <p className="text-red-500 mt-2 text-sm text-center max-w-md">{errorMessage}</p>
                    )}
                    {enableUrl && (
                        <a
                            href={enableUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-all shadow-md"
                        >
                            Habilitar YouTube Data API v3 en Google Cloud
                        </a>
                    )}
                    <button
                        onClick={() =>
                            navigate(
                                new URLSearchParams(location.search).get('state')?.startsWith('youtube:')
                                    ? '/marketing/planning?tab=connections'
                                    : '/company/integrations',
                            )
                        }
                        className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all shadow-md"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Volver
                    </button>
                </>
            )}
        </div>
    );
}
