import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../services/supabase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Eye, EyeOff, KeyRound, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

type LoginMode = 'password' | 'otp';

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
            setError(error.message);
            setLoading(false);
        } else {
            navigate('/');
        }
    };

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            setError("Ingresa un correo primero.");
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
            if (error.message.toLowerCase().includes('rate limit') || error.message.toLowerCase().includes('email rate')) {
                setError("Límite de envíos alcanzado. Espera unos minutos e intenta de nuevo, o usa tu contraseña para entrar.");
            } else {
                setError(error.message);
            }
        } else {
            setOtpSent(true);
            toast.success("Código enviado. Revisa tu bandeja de entrada.");
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
            setError(error.message);
            setLoading(false);
        } else {
            navigate('/');
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

            <div className="text-center">
                <Link to="/register" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                    {t('auth.registerLink')}
                </Link>
            </div>
        </div>
    );
}
