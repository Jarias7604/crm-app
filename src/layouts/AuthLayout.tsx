import { Outlet } from 'react-router-dom';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { Shield, Target, Zap, Bot, MessageSquare } from 'lucide-react';

export default function AuthLayout() {
    return (
        <div className="min-h-screen bg-white flex">
            {/* Left Column: Form */}
            <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:w-[500px] xl:w-[600px] 2xl:w-[700px] relative">
                <div className="absolute top-6 right-6 lg:hidden">
                    <LanguageSwitcher />
                </div>
                
                <div className="mx-auto w-full max-w-md lg:max-w-sm xl:max-w-md">
                    <div className="text-left mb-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-[#4449AA] rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                                <Shield className="w-5 h-5 text-white" />
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                                CRM Enterprise
                            </h2>
                        </div>
                    </div>

                    <div className="bg-white lg:shadow-none lg:border-0 lg:p-0 sm:shadow-xl sm:rounded-3xl sm:p-10 border border-gray-100 sm:bg-white bg-transparent">
                        <Outlet />
                    </div>
                </div>
                <div className="mt-12 text-center text-xs text-gray-400 font-medium">
                    &copy; {new Date().getFullYear()} CRM Enterprise. Todos los derechos reservados.
                </div>
            </div>

            {/* Right Column: Aggressive Marketing & Differentiators */}
            <div className="hidden lg:flex relative w-0 flex-1 bg-[#0b0f19] overflow-hidden">
                {/* Advanced Tech Background */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-[#0b0f19] to-[#0b0f19]" />
                
                <div className="absolute top-6 right-8 z-50">
                    <LanguageSwitcher />
                </div>

                <div className="relative z-10 flex flex-col justify-center items-center w-full h-full px-12 xl:px-20">
                    <div className="max-w-2xl w-full text-center mb-10">
                        {/* Dominant Marketing Copy */}
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-bold text-[10px] uppercase tracking-widest mb-6">
                            <Zap className="w-3.5 h-3.5" /> La Ventaja Competitiva Definitiva
                        </div>
                        <h1 className="text-4xl xl:text-[2.75rem] font-black text-white leading-[1.1] mb-5 tracking-tight">
                            No compres software.<br/>
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-blue-400 to-cyan-400">Invierte en dominio del mercado.</span>
                        </h1>
                        <p className="text-[15px] text-indigo-200/70 font-medium leading-relaxed max-w-xl mx-auto">
                            Mientras la competencia usa herramientas desconectadas, nuestro ecosistema unifica Inteligencia Artificial, Marketing y Ventas en un solo motor de alta precisión.
                        </p>
                    </div>

                    {/* Highly Visual "Hub and Spoke" Flow Diagram (CSS Only) */}
                    <div className="relative w-full max-w-xl h-[400px] flex items-center justify-center mt-4">
                        {/* Connecting Lines SVG */}
                        <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }}>
                            <defs>
                                <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#818cf8" stopOpacity="0.2" />
                                    <stop offset="50%" stopColor="#818cf8" stopOpacity="0.8" />
                                    <stop offset="100%" stopColor="#818cf8" stopOpacity="0.2" />
                                </linearGradient>
                            </defs>
                            {/* Lines from Center to Nodes */}
                            <path d="M 288 200 L 100 80" stroke="url(#lineGrad)" strokeWidth="2" strokeDasharray="4 4" className="animate-[dash_20s_linear_infinite]" />
                            <path d="M 288 200 L 476 80" stroke="url(#lineGrad)" strokeWidth="2" strokeDasharray="4 4" className="animate-[dash_20s_linear_infinite]" />
                            <path d="M 288 200 L 60 200" stroke="url(#lineGrad)" strokeWidth="2" strokeDasharray="4 4" className="animate-[dash_20s_linear_infinite]" />
                            <path d="M 288 200 L 516 200" stroke="url(#lineGrad)" strokeWidth="2" strokeDasharray="4 4" className="animate-[dash_20s_linear_infinite]" />
                            <path d="M 288 200 L 288 340" stroke="url(#lineGrad)" strokeWidth="3" className="opacity-50" />
                        </svg>

                        <style>{`
                            @keyframes dash {
                                to { stroke-dashoffset: 1000; }
                            }
                        `}</style>

                        {/* Central Hub Container */}
                        <div className="relative z-10 w-28 h-28 rounded-full bg-gradient-to-br from-indigo-500 to-blue-700 p-1 shadow-[0_0_60px_rgba(99,102,241,0.4)] animate-pulse" style={{ animationDuration: '3s' }}>
                            <div className="w-full h-full rounded-full bg-[#0b0f19] flex flex-col items-center justify-center">
                                <Bot className="w-8 h-8 text-indigo-400 mb-1" />
                                <span className="text-[10px] font-black text-white tracking-widest">NÚCLEO AI</span>
                            </div>
                        </div>

                        {/* The Differentiating Features (Nodes) */}
                        {/* Node 1: Top Left */}
                        <div className="absolute top-[40px] left-[20px] bg-white/5 border border-indigo-500/20 backdrop-blur-md rounded-2xl p-4 w-48 shadow-xl transition-transform hover:scale-105 group">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 group-hover:text-indigo-200"><Target className="w-4 h-4" /></div>
                                <h4 className="text-white font-bold text-xs">Lead Hunter AI</h4>
                            </div>
                            <p className="text-[10px] text-gray-400 leading-relaxed">Captación hipersegmentada con radar geo-satelital integrado.</p>
                        </div>

                        {/* Node 2: Top Right */}
                        <div className="absolute top-[40px] right-[20px] bg-white/5 border border-amber-500/20 backdrop-blur-md rounded-2xl p-4 w-48 shadow-xl transition-transform hover:scale-105 group">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 group-hover:text-amber-200"><Zap className="w-4 h-4" /></div>
                                <h4 className="text-white font-bold text-xs">Cotizador Inteligente</h4>
                            </div>
                            <p className="text-[10px] text-gray-400 leading-relaxed">Proyecciones precisas y cierres instantáneos que aniquilan la demora tradicional.</p>
                        </div>

                        {/* Node 3: Middle Left */}
                        <div className="absolute top-[170px] left-[-20px] bg-white/5 border border-emerald-500/20 backdrop-blur-md rounded-2xl p-4 w-44 shadow-xl transition-transform hover:scale-105 group">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 group-hover:text-emerald-200"><Shield className="w-4 h-4" /></div>
                                <h4 className="text-white font-bold text-xs">Aislamiento Total</h4>
                            </div>
                            <p className="text-[10px] text-gray-400 leading-relaxed">Arquitectura empresarial multi-tenant con seguridad RLS militar.</p>
                        </div>

                        {/* Node 4: Middle Right */}
                        <div className="absolute top-[170px] right-[-20px] bg-white/5 border border-sky-500/20 backdrop-blur-md rounded-2xl p-4 w-44 shadow-xl transition-transform hover:scale-105 group">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-300 group-hover:text-sky-200"><MessageSquare className="w-4 h-4" /></div>
                                <h4 className="text-white font-bold text-xs">Omnicanalidad</h4>
                            </div>
                            <p className="text-[10px] text-gray-400 leading-relaxed">WhatsApp, Email y Redes en un canal unificado imbatible.</p>
                        </div>

                        {/* Node 5: Bottom Center */}
                        <div className="absolute bottom-[20px] bg-white/5 border border-purple-500/20 backdrop-blur-md rounded-2xl p-4 w-64 shadow-2xl transition-transform hover:scale-105 group text-center mt-5">
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
                                <h4 className="text-white font-black text-[13px] uppercase tracking-widest">ECOSISTEMA UNIFICADO</h4>
                            </div>
                            <p className="text-[11px] text-gray-300 font-medium">El único CRM que te permite dominar el mercado.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
