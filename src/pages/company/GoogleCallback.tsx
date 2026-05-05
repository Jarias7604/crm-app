import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../services/supabase';
import { RefreshCw, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function GoogleCallback() {
    const navigate = useNavigate();
    const location = useLocation();
    const { profile } = useAuth();
    const [status, setStatus] = useState<'waiting' | 'loading' | 'success' | 'error'>('waiting');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [hasRun, setHasRun] = useState(false);

    useEffect(() => {
        // Guard: if already running or completed, don't re-run
        if (hasRun) return;

        const params = new URLSearchParams(location.search);
        const code = params.get('code');
        const googleError = params.get('error');

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
        // This fixes the race condition: useAuth is async, profile starts as null
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
    }, [location.search, profile, hasRun, navigate]);

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
                    <p className="text-gray-500 mt-2 text-sm">Redirigiendo a tus integraciones...</p>
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
                        <p className="text-red-500 mt-2 text-sm text-center max-w-sm">{errorMessage}</p>
                    )}
                    <button
                        onClick={() => navigate('/company/integrations')}
                        className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all shadow-md"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Volver a Integraciones
                    </button>
                </>
            )}
        </div>
    );
}
