import { Outlet } from 'react-router-dom';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { Shield, Target, Zap, Bot, MessageSquare, Sparkles } from 'lucide-react';
import Logo from '../components/ui/Logo';

export default function AuthLayout() {
    return (
        <div className="min-h-screen bg-[#07070c] flex text-white relative overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
            
            {/* Ambient glowing technology blobs */}
            <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-blue-600/10 blur-[130px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-[150px] pointer-events-none" />

            {/* Left Column: Premium Login Container */}
            <div className="flex-1 flex flex-col justify-center py-12 px-6 sm:px-12 lg:flex-none lg:w-[540px] xl:w-[620px] 2xl:w-[700px] relative z-10 bg-slate-950/40 backdrop-blur-3xl border-r border-white/5">
                
                {/* Mobile Language Switcher */}
                <div className="absolute top-6 right-6 lg:hidden">
                    <LanguageSwitcher />
                </div>
                
                <div className="mx-auto w-full max-w-md">
                    {/* Arias Premium Logo */}
                    <div className="text-left mb-10">
                        <Logo mode="dark" height={56} />
                    </div>

                    {/* Form Outlet */}
                    <div className="relative">
                        <Outlet />
                    </div>
                </div>

                {/* Footer Copyright */}
                <div className="mt-16 text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    &copy; {new Date().getFullYear()} Arias CRM. Todos los derechos reservados.
                </div>
            </div>

            {/* Right Column: High-Tech Showcase Panel */}
            <div className="hidden lg:flex relative w-0 flex-1 bg-[#090911] overflow-hidden items-center">
                {/* Visual grid backdrop overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b0e_1px,transparent_1px),linear-gradient(to_bottom,#1e293b0e_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40" />
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-indigo-950/20 to-transparent opacity-95" />

                {/* Language Switcher Desktop */}
                <div className="absolute top-6 right-8 z-50">
                    <LanguageSwitcher />
                </div>

                <div className="relative z-10 w-full px-16 xl:px-24">
                    <div className="max-w-xl w-full">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-white font-black text-[10px] uppercase tracking-wider shadow-xl backdrop-blur-md mb-6">
                          <Zap className="w-3.5 h-3.5 text-amber-400" /> Superior a Salesforce y HubSpot
                        </div>
                        
                        <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight mb-4 tracking-tight">
                            Poder Absoluto.<br/>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                                Increíblemente fácil de usar.
                            </span>
                        </h1>
                        
                        <p className="text-sm text-slate-400 mb-12 leading-relaxed max-w-lg">
                            La plataforma todo en uno diseñada para ser intuitiva desde el primer segundo. Cierra más tratos, eleva el éxito de tus clientes y controla todo tu ecosistema sin configuraciones complejas.
                        </p>

                        {/* Features Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10 shadow-lg">
                                    <Target className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold text-sm mb-0.5">Resultados Reales</h4>
                                    <p className="text-[11px] text-slate-500 leading-normal">Tus clientes verán métricas y entregas impecables.</p>
                                </div>
                            </div>
                            
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10 shadow-lg">
                                    <Zap className="w-5 h-5 text-amber-400" />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold text-sm mb-0.5">100% Intuitivo</h4>
                                    <p className="text-[11px] text-slate-500 leading-normal">Diseño amigable. Tu equipo lo usará el mismo día.</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10 shadow-lg">
                                    <Bot className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold text-sm mb-0.5">Cotizador AI</h4>
                                    <p className="text-[11px] text-slate-500 leading-normal">A diferencia de la competencia, la IA está integrada.</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10 shadow-lg">
                                    <MessageSquare className="w-5 h-5 text-cyan-400" />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold text-sm mb-0.5">Omnicanalidad</h4>
                                    <p className="text-[11px] text-slate-500 leading-normal">WhatsApp centralizado y ecosistema de marketing.</p>
                                </div>
                            </div>
                        </div>

                        {/* Glass Panel Mockup Simulation */}
                        <div className="mt-16 relative rounded-2xl bg-white/[0.02] border border-white/10 p-6 backdrop-blur-md shadow-2xl overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="flex items-center gap-4 mb-4">
                                <div className="flex gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/60"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60"></div>
                                </div>
                                <div className="h-4 w-32 bg-white/5 rounded overflow-hidden">
                                     <div className="w-full h-full bg-white/10 animate-pulse"></div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="h-2 w-3/4 bg-white/5 rounded"></div>
                                <div className="h-2 w-1/2 bg-white/5 rounded"></div>
                                <div className="h-2 w-5/6 bg-white/5 rounded"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
        </div>
    );
}
