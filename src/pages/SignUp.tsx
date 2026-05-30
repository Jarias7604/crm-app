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
            // 1. Sign Up user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
            });

            if (authError) throw authError;

            if (authData.user) {
                // 2. Call RPC to create company and assign role
                // We wait a moment to ensure trigger created the profile first (usually fast)
                // Ideally the trigger runs synchronously within transaction of signup? No, supabase triggers are usually immediate.
                // We can call the RPC now.

                // Note: The user might not be "signed in" immediately depending on email confirmation settings.
                // If "Enable Email Confirmations" is ON (default), the user can't login yet, so RPC will fail if it requires auth.
                // However, standard Supabase dev projects often have email confirmation OFF or we need to warn user.
                // For this demo, let's assume auto-confirm or session exists.

                // If session exists (auto-confirm is on usually for dev):
                if (authData.session) {
                    const { error: rpcError } = await supabase.rpc('register_new_tenant', {
                        company_name: companyName
                    });

                    if (rpcError) throw rpcError;

                    navigate('/');
                } else {
                    // Email confirmation required
                    setError('Check your email to confirm account, then login.');
                    setLoading(false);
                }
            }
        } catch (err: any) {
            setError(err.message);
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
                {error && (
                    <div className="bg-red-500/10 border-l-4 border-red-500 p-4 rounded-r-xl">
                        <p className="text-xs text-red-400 font-semibold">{error}</p>
                    </div>
                )}

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
