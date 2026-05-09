import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../services/supabase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Eye, EyeOff, KeyRound, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

type LoginMode = 'password' | 'otp';

// ─── Error message translator ─────────────────────────────────────────────────
// Maps raw Supabase/Auth error messages to friendly Spanish user-facing messages.
// Always use this instead of exposing raw error.message to the user.
const translateAuthError = (rawMessage: string): string => {
    const msg = rawMessage.toLowerCase();
    if (msg.includes('invalid login credentials') || msg.includes('invalid credentials'))
        return 'Email o contraseña incorrectos. Verifica tus datos e intenta de nuevo.';
    if (msg.includes('email not confirmed'))
        return 'Tu cuenta no está confirmada. Revisa tu bandeja de entrada y haz clic en el enlace de verificación.';
    if (msg.includes('user not found'))
        return 'No encontramos una cuenta con ese correo electrónico.';
    if (msg.includes('rate limit') || msg.includes('email rate') || msg.includes('over_email_send_rate_limit'))
        return 'Límite de envíos alcanzado. Espera unos minutos e intenta de nuevo, o usa tu contraseña para entrar.';
    if (msg.includes('user already registered') || msg.includes('already exists'))
        return 'Ya existe una cuenta con este correo electrónico.';
    if (msg.includes('password') && msg.includes('short'))
        return 'La contraseña debe tener al menos 6 caracteres.';
    if (msg.includes('signup') && msg.includes('disabled'))
        return 'El registro de nuevas cuentas no está habilitado en este momento.';
    if (msg.includes('token') || msg.includes('otp') || msg.includes('expired'))
        return 'El código ingresado no es válido o ha expirado. Solicita uno nuevo.';
    if (msg.includes('network') || msg.includes('fetch'))
        return 'Error de conexión. Verifica tu internet e intenta de nuevo.';
    // Fallback: don't expose raw English error
    return 'Ocurrió un error inesperado. Por favor intenta de nuevo.';
};

export default function Login() {
    const { t } = useTranslation();
    const [loginMode, setLoginMode] = useState<LoginMode>('password');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const handlePasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(translateAuthError(error.message));
            setLoading(false);
        } else {
            navigate('/dashboard');
        }
    };

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            setError("Ingresa tu correo electrónico primero.");
            return;
        }
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                shouldCreateUser: false,
            },
        });

        if (error) {
            setError(translateAuthError(error.message));
        } else {
            setOtpSent(true);
            toast.success("✅ Código enviado. Revisa tu bandeja de entrada.");
        }
        setLoading(false);
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.verifyOtp({
            email,
            token: otp,
            type: 'email'
        });

        if (error) {
            setError(translateAuthError(error.message));
            setLoading(false);
        } else {
            navigate('/dashboard');
        }
    };

    return (
        <div className="space-y-6">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">{t('auth.loginTitle')}</h2>
                <p className="mt-1 text-sm text-gray-500">{t('auth.loginSubtitle')}</p>
            </div>

            {/* Toggle Modes */}
            <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
                <button
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${loginMode === 'password' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => { setLoginMode('password'); setError(null); }}
                >
                    <KeyRound className="w-4 h-4" />
                    Contraseña
                </button>
                <button
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${loginMode === 'otp' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => { setLoginMode('otp'); setError(null); }}
                >
                    <Mail className="w-4 h-4" />
                    Código (OTP)
                </button>
            </div>

            <form className="space-y-6" onSubmit={
                loginMode === 'password' 
                    ? handlePasswordLogin 
                    : (otpSent ? handleVerifyOtp : handleSendOtp)
            }>
                {error && (
                    <div className="bg-red-50 border-l-4 border-red-400 p-4">
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                )}

                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                        {t('auth.emailLabel')}
                    </label>
                    <Input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loginMode === 'otp' && otpSent}
                        className="mt-1 block w-full h-12 rounded-xl border-gray-100 bg-gray-50/50 disabled:opacity-50"
                    />
                </div>

                {loginMode === 'password' && (
                    <div className="relative">
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                            {t('auth.passwordLabel')}
                        </label>
                        <div className="relative mt-1">
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="pr-12 block w-full h-12 rounded-xl border-gray-100 bg-gray-50/50"
                            />
                            <button
                                type="button"
                                className="absolute inset-y-0 right-0 h-full w-12 flex items-center justify-center bg-indigo-50/80 text-indigo-600 hover:bg-[#4449AA] hover:text-white rounded-r-xl border-l border-gray-100 transition-all"
                                onClick={() => setShowPassword(!showPassword)}
                                title={showPassword ? "Ocultar Contraseña" : "Ver Contraseña"}
                            >
                                {showPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {loginMode === 'otp' && otpSent && (
                    <div className="space-y-2">
                        <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
                            Código de Verificación (6 dígitos)
                        </label>
                        <Input
                            id="otp"
                            type="text"
                            required
                            placeholder="Ej. 123456"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            className="text-center font-mono text-xl tracking-[0.5em] block w-full h-14 rounded-xl border-gray-200 bg-white"
                        />
                        <button 
                            type="button" 
                            onClick={() => { setOtpSent(false); setOtp(''); }}
                            className="text-xs text-indigo-600 hover:underline w-full text-center mt-2 block"
                        >
                            ¿No recibiste el código? Volver a intentar
                        </button>
                    </div>
                )}

                <Button type="submit" disabled={loading} className="w-full">
                    {loading 
                        ? (loginMode === 'otp' && !otpSent ? 'Enviando...' : 'Procesando...') 
                        : (loginMode === 'password' 
                            ? t('auth.signInButton') 
                            : (otpSent ? 'Verificar y Entrar' : 'Enviar Código Mágico'))}
                </Button>
            </form>

            <div className="flex flex-col items-center gap-2">
                {loginMode === 'password' && (
                    <button
                        type="button"
                        onClick={() => { setLoginMode('otp'); setError(null); }}
                        className="text-sm text-slate-400 hover:text-indigo-600 transition-colors font-medium"
                    >
                        ¿Olvidaste tu contraseña? <span className="text-indigo-600 font-bold">Entra con código mágico</span>
                    </button>
                )}
                <Link to="/register" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                    {t('auth.registerLink')}
                </Link>
            </div>
        </div>
    );
}
