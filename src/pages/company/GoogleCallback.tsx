import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../services/supabase';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function GoogleCallback() {
    const navigate = useNavigate();
    const location = useLocation();
    const { profile } = useAuth();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

    useEffect(() => {
        const handleCallback = async () => {
            const params = new URLSearchParams(location.search);
            const code = params.get('code');
            const error = params.get('error');

            if (error) {
                toast.error('Error de autorización: ' + error);
                setStatus('error');
                setTimeout(() => navigate('/company/integrations'), 2000);
                return;
            }

            if (!code || !profile?.company_id || !profile?.id) {
                if (!code) setStatus('error');
                return;
            }

            try {
                // Determine redirect URI dynamically
                const redirectUri = `${window.location.origin}/integrations/google/callback`;

                const { data, error: fnError } = await supabase.functions.invoke('google-calendar-sync', {
                    body: {
                        action: 'exchange_code',
                        code,
                        redirect_uri: redirectUri,
                        user_id: profile.id,
                        company_id: profile.company_id
                    }
                });

                if (fnError || !data?.success) {
                    throw new Error(fnError?.message || data?.error || 'Error al intercambiar el código');
                }

                toast.success('¡Google Calendar conectado exitosamente!');
                setStatus('success');
                setTimeout(() => navigate('/company/integrations'), 1500);
            } catch (err: any) {
                console.error('Google Auth Error:', err);
                toast.error(err.message || 'Error al conectar la cuenta');
                setStatus('error');
                setTimeout(() => navigate('/company/integrations'), 3000);
            }
        };

        handleCallback();
    }, [location.search, navigate, profile]);

    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
            {status === 'loading' && (
                <>
                    <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
                    <h2 className="text-xl font-black text-gray-900">Conectando con Google...</h2>
                    <p className="text-gray-500 mt-2">Por favor no cierres esta ventana.</p>
                </>
            )}
            {status === 'success' && (
                <>
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    </div>
                    <h2 className="text-xl font-black text-gray-900">¡Conexión Exitosa!</h2>
                    <p className="text-gray-500 mt-2">Redirigiendo a tus integraciones...</p>
                </>
            )}
            {status === 'error' && (
                <>
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-black text-gray-900">Algo salió mal</h2>
                    <p className="text-gray-500 mt-2">Redirigiendo...</p>
                </>
            )}
        </div>
    );
}
