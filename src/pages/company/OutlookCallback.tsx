import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../services/supabase';
import { RefreshCw, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function OutlookCallback() {
    const navigate = useNavigate();
    const location = useLocation();
    const { profile } = useAuth();
    const [status, setStatus] = useState<'waiting' | 'loading' | 'success' | 'error'>('waiting');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [hasRun, setHasRun] = useState(false);

    useEffect(() => {
        if (hasRun) return;

        const params = new URLSearchParams(location.search);
        const code = params.get('code');
        const outlookError = params.get('error');

        if (outlookError) {
            setErrorMessage(
                outlookError === 'access_denied'
                    ? 'Cancelaste la autorización de Microsoft. Intenta de nuevo.'
                    : `Error de Microsoft: ${outlookError}`
            );
            setStatus('error');
            setHasRun(true);
            return;
        }

        if (!code) {
            setErrorMessage('No se recibió el código de autorización de Microsoft. La URL es inválida.');
            setStatus('error');
            setHasRun(true);
            return;
        }

        if (!profile?.id || !profile?.company_id) {
            setStatus('waiting');
            return;
        }

        const handleCallback = async () => {
            setHasRun(true);
            setStatus('loading');

            try {
                const redirectUri = `${window.location.origin}/integrations/outlook/callback`;

                const { data, error: fnError } = await supabase.functions.invoke('outlook-calendar-sync', {
                    body: {
                        action: 'exchange_code',
                        code,
                        redirect_uri: redirectUri,
                        user_id: profile.id,
                        company_id: profile.company_id,
                    }
                });

                if (fnError || !data?.success) {
                    throw new Error(fnError?.message || data?.error || 'Error al conectar con tu cuenta de Microsoft.');
                }

                toast.success('¡Microsoft Outlook conectado exitosamente!');
                setStatus('success');
                setTimeout(() => navigate('/company/integrations'), 1800);

            } catch (err: any) {
                const msg = err.message || 'Error desconocido al conectar con Microsoft.';
                setErrorMessage(msg);
                setStatus('error');
                toast.error(msg);
            }
        };

        handleCallback();
    }, [location.search, profile, hasRun, navigate]);

    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] px-4">
            {status === 'waiting' && (
                <>
                    <RefreshCw className="w-12 h-12 text-blue-400 animate-spin mb-4" />
                    <h2 className="text-xl font-black text-gray-900">Preparando conexión...</h2>
                    <p className="text-gray-500 mt-2 text-sm">Cargando tu perfil de usuario.</p>
                </>
            )}

            {status === 'loading' && (
                <>
                    <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                    <h2 className="text-xl font-black text-gray-900">Conectando con Office 365...</h2>
                    <p className="text-gray-500 mt-2 text-sm">Por favor no cierres esta ventana.</p>
                </>
            )}

            {status === 'success' && (
                <>
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    </div>
                    <h2 className="text-xl font-black text-gray-900">¡Conexión Exitosa!</h2>
                    <p className="text-gray-500 mt-2 text-sm">Sincronizando tu calendario de Outlook...</p>
                </>
            )}

            {status === 'error' && (
                <>
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-black text-gray-900">Algo salió mal</h2>
                    {errorMessage && (
                        <p className="text-red-500 mt-2 text-sm text-center max-w-sm font-medium">{errorMessage}</p>
                    )}
                    <button
                        onClick={() => navigate('/company/integrations')}
                        className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all shadow-md"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Volver a Integraciones
                    </button>
                </>
            )}
        </div>
    );
}
