import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';
import { KeyRound, Eye, EyeOff, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';

export default function UpdatePassword() {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [sessionReady, setSessionReady] = useState(false);

    // Supabase sends the recovery token as a hash fragment — it auto-processes it via onAuthStateChange
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                setSessionReady(true);
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    const strength = (): { label: string; color: string; width: string } => {
        if (password.length === 0) return { label: '', color: 'bg-gray-100', width: 'w-0' };
        if (password.length < 6) return { label: 'Muy corta', color: 'bg-red-400', width: 'w-1/4' };
        if (password.length < 10) return { label: 'Aceptable', color: 'bg-orange-400', width: 'w-2/4' };
        if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) return { label: 'Buena', color: 'bg-yellow-400', width: 'w-3/4' };
        return { label: 'Excelente', color: 'bg-green-500', width: 'w-full' };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return; }
        if (password !== confirm) { toast.error('Las contraseñas no coinciden'); return; }

        setIsLoading(true);
        const { error } = await supabase.auth.updateUser({ password });
        setIsLoading(false);

        if (error) {
            toast.error(`Error: ${error.message}`);
            return;
        }

        setIsSuccess(true);
        setTimeout(() => navigate('/login'), 3000);
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50">
                <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full mx-4 text-center">
                    <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-10 h-10 text-green-500" />
                    </div>
                    <h1 className="text-2xl font-black text-gray-900 mb-2">¡Contraseña actualizada!</h1>
                    <p className="text-gray-400 text-sm font-medium mb-6">Serás redirigido al login en unos segundos...</p>
                    <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full animate-[progress_3s_linear_forwards]" style={{ animation: 'width 3s linear forwards', width: '100%' }} />
                    </div>
                </div>
            </div>
        );
    }

    const s = strength();

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50">
            <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full mx-4">
                {/* Header */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mb-4">
                        <ShieldCheck className="w-8 h-8 text-indigo-600" />
                    </div>
                    <h1 className="text-2xl font-black text-gray-900 text-center">Nueva Contraseña</h1>
                    <p className="text-sm text-gray-400 font-medium text-center mt-1">
                        Crea una contraseña segura para tu cuenta
                    </p>
                </div>

                {!sessionReady && (
                    <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 mb-6 text-center">
                        <Loader2 className="w-5 h-5 text-orange-400 animate-spin mx-auto mb-2" />
                        <p className="text-[11px] font-black text-orange-600 uppercase tracking-widest">Verificando enlace...</p>
                        <p className="text-[10px] text-gray-400 mt-1">Si llegaste desde el email, espera un momento.</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Password field */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                            Nueva Contraseña
                        </label>
                        <div className="relative">
                            <input
                                id="new-password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Mínimo 6 caracteres"
                                className="w-full h-14 px-4 pr-12 rounded-2xl bg-gray-50 border border-gray-200 font-bold text-gray-900 outline-none focus:bg-white focus:border-indigo-300 transition-all"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        {/* Strength bar */}
                        {password.length > 0 && (
                            <div className="space-y-1">
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all duration-300 ${s.color} ${s.width}`} />
                                </div>
                                <p className={`text-[10px] font-black ${s.color.replace('bg-', 'text-')}`}>{s.label}</p>
                            </div>
                        )}
                    </div>

                    {/* Confirm field */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                            Confirmar Contraseña
                        </label>
                        <input
                            id="confirm-password"
                            type={showPassword ? 'text' : 'password'}
                            value={confirm}
                            onChange={e => setConfirm(e.target.value)}
                            placeholder="Repite la contraseña"
                            className={`w-full h-14 px-4 rounded-2xl bg-gray-50 border font-bold text-gray-900 outline-none focus:bg-white transition-all ${
                                confirm.length > 0
                                    ? password === confirm
                                        ? 'border-green-300 focus:border-green-400'
                                        : 'border-red-300 focus:border-red-400'
                                    : 'border-gray-200 focus:border-indigo-300'
                            }`}
                            required
                        />
                        {confirm.length > 0 && password !== confirm && (
                            <p className="text-[10px] text-red-500 font-bold">Las contraseñas no coinciden</p>
                        )}
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={isLoading || !sessionReady || password.length < 6 || password !== confirm}
                        className="w-full h-14 rounded-2xl bg-[#4449AA] text-white font-black text-[11px] uppercase tracking-widest shadow-lg hover:translate-y-[-2px] transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Actualizando...</>
                        ) : (
                            <><KeyRound className="w-4 h-4" /> Guardar Nueva Contraseña</>
                        )}
                    </button>
                </form>

                <p className="text-center text-[10px] text-gray-300 font-medium mt-6">
                    ¿Recordaste tu contraseña?{' '}
                    <button onClick={() => navigate('/login')} className="text-indigo-500 font-black hover:underline">
                        Iniciar Sesión
                    </button>
                </p>
            </div>
        </div>
    );
}
