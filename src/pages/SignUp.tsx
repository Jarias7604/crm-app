import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../services/supabase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export default function SignUp() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // 1. Register user with Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        // Store in user_metadata so it survives cross-browser/cross-tab
                        // email confirmation (localStorage is unreliable in those cases)
                        pending_company_name: companyName.trim()
                    }
                }
            });

            if (authError) throw authError;

            if (authData.user) {
                // Detect existing email: Supabase returns identities: [] for already-registered users
                if (authData.user.identities && authData.user.identities.length === 0) {
                    setError('Este correo ya está registrado. Por favor inicia sesión en lugar de registrarte.');
                    setLoading(false);
                    return;
                }

                // Save companyName so AuthProvider can provision the tenant
                // after the user confirms their email and returns to the app.
                localStorage.setItem('pending_company_name', companyName.trim());

                if (authData.session) {
                    // Auto-confirm is ON — user is already logged in
                    navigate('/');
                } else {
                    // Email confirmation required
                    setError('__EMAIL_SENT__');
                    setLoading(false);
                }
            }
        } catch (err: any) {
            // Translate common Supabase errors to Spanish
            const msg: string = err.message || '';
            if (msg.includes('email rate limit') || msg.includes('rate limit')) {
                setError('Demasiados intentos de registro. Espera unos minutos e intenta de nuevo.');
            } else if (msg.includes('already registered') || msg.includes('User already registered')) {
                setError('Este correo ya está registrado. Intenta iniciar sesión.');
            } else if (msg.includes('Password should be at least')) {
                setError('La contraseña debe tener al menos 6 caracteres.');
            } else {
                setError(msg);
            }
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="text-center">
                <h2 className="text-2xl font-black text-white">{t('auth.signUpTitle')}</h2>
                <p className="mt-1.5 text-xs text-slate-400">{t('auth.signUpSubtitle')}</p>
            </div>

            <form className="space-y-5" onSubmit={handleSignUp}>
                {error === '__EMAIL_SENT__' ? (
                    <div className="bg-emerald-500/10 border-l-4 border-emerald-500 p-4 rounded-r-xl">
                        <p className="text-xs text-emerald-400 font-semibold">
                            ✅ ¡Revisa tu correo! Te enviamos un enlace de confirmación a <strong>{email}</strong>.
                            Haz clic en el enlace y tu cuenta quedará lista automáticamente.
                        </p>
                    </div>
                ) : error ? (
                    <div className="bg-red-500/10 border-l-4 border-red-500 p-4 rounded-r-xl">
                        <p className="text-xs text-red-400 font-semibold">{error}</p>
                    </div>
                ) : null}

                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                        {t('auth.companyNameLabel')}
                    </label>
                    <Input
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="mt-1 block w-full h-12 rounded-xl border-white/10 bg-slate-900 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                        {t('auth.emailLabel')}
                    </label>
                    <Input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mt-1 block w-full h-12 rounded-xl border-white/10 bg-slate-900 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                        {t('auth.passwordLabel')}
                    </label>
                    <Input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="mt-1 block w-full h-12 rounded-xl border-white/10 bg-slate-900 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                </div>

                <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black h-12 rounded-xl transition-all shadow-lg shadow-blue-600/25 border-0">
                    {loading ? t('auth.creatingAccount') : t('auth.createAccountButton')}
                </Button>
            </form>

            <div className="text-center pt-2">
                <Link to="/login" className="text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline">
                    {t('auth.loginLink')}
                </Link>
            </div>
        </div>
    );
}
