import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../services/supabase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Eye, EyeOff } from 'lucide-react';

export default function Login() {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
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

    return (
        <div className="space-y-6">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">{t('auth.loginTitle')}</h2>
                <p className="mt-1 text-sm text-gray-500">{t('auth.loginSubtitle')}</p>
            </div>

            <form className="space-y-6" onSubmit={handleLogin}>
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
                        className="mt-1 block w-full h-14 rounded-2xl border-gray-100 bg-gray-50/50"
                    />
                </div>

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
                            className="pr-14 block w-full h-14 rounded-2xl border-gray-100 bg-gray-50/50"
                        />
                        <button
                            type="button"
                            className="absolute inset-y-0 right-0 h-full w-14 flex items-center justify-center bg-indigo-50/80 text-indigo-600 hover:bg-[#4449AA] hover:text-white rounded-r-2xl border-l border-gray-100 transition-all"
                            onClick={() => setShowPassword(!showPassword)}
                            title={showPassword ? "Ocultar Contraseña" : "Ver Contraseña"}
                        >
                            {showPassword ? (
                                <EyeOff className="h-5 w-5" />
                            ) : (
                                <Eye className="h-5 w-5" />
                            )}
                        </button>
                    </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full">
                    {loading ? t('auth.signingIn') : t('auth.signInButton')}
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
