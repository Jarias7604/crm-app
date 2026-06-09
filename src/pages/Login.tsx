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
    if (msg.includes('invalid api key'))
        return 'Error de configuración: la API Key de Supabase es inválida. Revisa tu archivo .env.local.';
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
                <h2 className="text-2xl font-black text-white">{t('auth.loginTitle')}</h2>
                <p className="mt-1.5 text-xs text-slate-400">{t('auth.loginSubtitle')}</p>
            </div>

            {/* Toggle Modes - Premium Dark Theme */}
            <div className="flex bg-slate-900 border border-white/5 p-1 rounded-xl mb-6">
                <button
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${loginMode === 'password' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10' : 'text-slate-400 hover:text-slate-200'}`}
                    onClick={() => { setLoginMode('password'); setError(null); }}
                >
                    <KeyRound className="w-3.5 h-3.5" />
                    Contraseña
                </button>
                <button
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${loginMode === 'otp' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10' : 'text-slate-400 hover:text-slate-200'}`}
                    onClick={() => { setLoginMode('otp'); setError(null); }}
                >
                    <Mail className="w-3.5 h-3.5" />
                    Código (OTP)
                </button>
            </div>

            <form className="space-y-5" onSubmit={
                loginMode === 'password' 
                    ? handlePasswordLogin 
                    : (otpSent ? handleVerifyOtp : handleSendOtp)
            }>
                {error && (
                    <div className="bg-red-500/10 border-l-4 border-red-500 p-4 rounded-r-xl">
                        <p className="text-xs text-red-400 font-semibold">{error}</p>
                    </div>
                )}

                <div>
                    <label htmlFor="email" className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                        {t('auth.emailLabel')}
                    </label>
                    <Input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loginMode === 'otp' && otpSent}
                        className="mt-1 block w-full h-12 rounded-xl border-white/10 bg-slate-900 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-40"
                    />
                </div>

                {loginMode === 'password' && (
                    <div className="relative">
                        <label htmlFor="password" className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                            {t('auth.passwordLabel')}
                        </label>
                        <div className="relative mt-1">
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="pr-12 block w-full h-12 rounded-xl border-white/10 bg-slate-900 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                                type="button"
                                className="absolute inset-y-0 right-0 h-full w-12 flex items-center justify-center bg-white/5 text-slate-400 hover:text-white rounded-r-xl border-l border-white/5 transition-all"
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
                        <label htmlFor="otp" className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                            Código de Verificación (6 dígitos)
                        </label>
                        <Input
                            id="otp"
                            type="text"
                            required
                            placeholder="Ej. 123456"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            className="text-center font-mono text-xl tracking-[0.5em] block w-full h-14 rounded-xl border-white/10 bg-slate-900 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                        <button 
                            type="button" 
                            onClick={() => { setOtpSent(false); setOtp(''); }}
                            className="text-xs text-blue-400 hover:text-blue-300 hover:underline w-full text-center mt-2 block font-bold"
                        >
                            ¿No recibiste el código? Volver a intentar
                        </button>
                    </div>
                )}

                <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black h-12 rounded-xl transition-all shadow-lg shadow-blue-600/25 border-0">
                    {loading 
                        ? (loginMode === 'otp' && !otpSent ? 'Enviando...' : 'Procesando...') 
                        : (loginMode === 'password' 
                            ? t('auth.signInButton') 
                            : (otpSent ? 'Verificar y Entrar' : 'Enviar Código Mágico'))}
                </Button>
            </form>

            <div className="flex flex-col items-center gap-2 pt-2">
                {loginMode === 'password' && (
                    <button
                        type="button"
                        onClick={() => { setLoginMode('otp'); setError(null); }}
                        className="text-xs text-slate-400 hover:text-blue-400 transition-colors font-semibold"
                    >
                        ¿Olvidaste tu contraseña? <span className="text-blue-400 font-bold hover:underline">Entra con código mágico</span>
                    </button>
                )}
                <Link to="/register" className="text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline">
                    {t('auth.registerLink')}
                </Link>
            </div>
        </div>
    );
}
