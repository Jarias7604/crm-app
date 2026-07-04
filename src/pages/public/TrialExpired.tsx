import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { Clock, Zap, Shield, Star, ArrowRight, LogOut } from 'lucide-react';
import Logo from '../../components/ui/Logo';

export default function TrialExpired() {
    const { profile, signOut } = useAuth();
    const navigate = useNavigate();
    const [trialInfo, setTrialInfo] = useState<{
        daysLeft: number;
        expiresAt: string | null;
        planName: string;
    } | null>(null);

    useEffect(() => {
        if (!profile?.company_id) return;
        supabase
            .rpc('get_company_subscription')
            .then(({ data }) => {
                if (data && data[0]) {
                    const sub = data[0];
                    const expiresAt = sub.trial_ends_at || sub.current_period_end;
                    const daysLeft = expiresAt
                        ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)
                        : 0;
                    setTrialInfo({
                        daysLeft: Math.max(0, daysLeft),
                        expiresAt: expiresAt
                            ? new Date(expiresAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
                            : null,
                        planName: sub.plan_name || 'Starter',
                    });
                }
            });
    }, [profile?.company_id]);

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-[#07070c] flex items-center justify-center p-6 relative overflow-hidden"
            style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* Ambient blobs */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-red-600/10 blur-[150px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-indigo-500/8 blur-[130px] pointer-events-none" />

            <div className="relative z-10 w-full max-w-lg">
                {/* Logo */}
                <div className="flex justify-center mb-8">
                    <Logo mode="dark" height={44} />
                </div>

                {/* Main card */}
                <div className="bg-slate-900/80 border border-white/10 rounded-3xl backdrop-blur-xl overflow-hidden shadow-2xl">
                    {/* Red header bar */}
                    <div className="bg-gradient-to-r from-red-600 to-orange-500 p-6 text-center">
                        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <Clock className="w-7 h-7 text-white" />
                        </div>
                        <h1 className="text-xl font-black text-white mb-1">Tu período de prueba ha terminado</h1>
                        <p className="text-red-100 text-sm">
                            {trialInfo?.expiresAt
                                ? `Tu trial venció el ${trialInfo.expiresAt}`
                                : 'Tu acceso gratuito ha expirado'}
                        </p>
                    </div>

                    {/* Body */}
                    <div className="p-8">
                        <p className="text-slate-300 text-sm text-center mb-6 leading-relaxed">
                            Tus datos, leads y configuraciones están <strong className="text-white">100% seguros</strong> y
                            disponibles. Activa tu suscripción para continuar donde lo dejaste.
                        </p>

                        {/* Plan options */}
                        <div className="space-y-3 mb-6">
                            {[
                                { name: 'Starter', price: '$29', desc: 'Leads, Cotizaciones, Calendario', color: 'border-blue-500/40 hover:border-blue-400', badge: null },
                                { name: 'Pro', price: '$99', desc: 'Todo + Marketing Hub + AI', color: 'border-purple-500/40 hover:border-purple-400', badge: '⭐ Popular' },
                                { name: 'Enterprise', price: '$299', desc: 'Todo ilimitado + SLA 99.9%', color: 'border-slate-500/40 hover:border-slate-400', badge: null },
                            ].map(plan => (
                                <div
                                    key={plan.name}
                                    className={`flex items-center justify-between p-4 rounded-2xl border bg-white/3 transition-all cursor-default ${plan.color}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-white font-bold text-sm">{plan.name}</span>
                                                {plan.badge && (
                                                    <span className="text-[10px] font-black bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                        {plan.badge}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-slate-400 text-xs">{plan.desc}</p>
                                        </div>
                                    </div>
                                    <span className="text-white font-black text-lg">{plan.price}<span className="text-slate-400 text-xs font-normal">/mes</span></span>
                                </div>
                            ))}
                        </div>

                        {/* CTA */}
                        <button
                            onClick={() => navigate('/company/billing')}
                            className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-indigo-500/25 hover:-translate-y-0.5 flex items-center justify-center gap-2 mb-3"
                        >
                            <Zap className="w-4 h-4" />
                            Activar mi suscripción ahora
                            <ArrowRight className="w-4 h-4" />
                        </button>

                        {/* Trust badges */}
                        <div className="flex justify-center gap-6 text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-6">
                            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Sin contratos</span>
                            <span className="flex items-center gap-1"><Star className="w-3 h-3" /> Cancela fácil</span>
                        </div>

                        {/* Sign out */}
                        <button
                            onClick={handleSignOut}
                            className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-slate-300 text-xs font-semibold py-2 transition-colors"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                            Cerrar sesión
                        </button>
                    </div>
                </div>

                <p className="text-center text-[10px] text-slate-600 mt-6 uppercase tracking-widest font-bold">
                    © {new Date().getFullYear()} Arias CRM · Todos los derechos reservados
                </p>
            </div>
        </div>
    );
}
