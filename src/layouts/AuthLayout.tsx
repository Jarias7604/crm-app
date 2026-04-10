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

            {/* Right Column: Premium Showcase */}
            <div className="hidden lg:flex relative w-0 flex-1 bg-[#0f172a] overflow-hidden">
                {/* Background Decor */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#4449AA] via-indigo-900 to-[#1e1b4b] opacity-90" />
                
                {/* Abstract Shapes */}
                <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-white opacity-5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500 opacity-10 rounded-full blur-3xl" />
                
                <div className="absolute top-6 right-8 z-50">
                    <LanguageSwitcher />
                </div>

                <div className="relative z-10 flex flex-col justify-center items-center w-full px-12 xl:px-24">
                    <div className="max-w-xl w-full">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white font-bold text-xs shadow-xl backdrop-blur-md mb-6">
                            <Zap className="w-4 h-4 text-amber-300" /> Superior a Salesforce y HubSpot
                        </div>
                        <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight mb-4">
                            Poder Absoluto.<br/>
                            <span className="text-indigo-200">Increíblemente fácil de usar.</span>
                        </h1>
                        <p className="text-lg text-indigo-100 mb-12 font-medium leading-relaxed opacity-90">
                            La plataforma todo en uno diseñada para ser intuitiva desde el primer segundo. Cierra más tratos, eleva el éxito de tus clientes y controla todo tu ecosistema sin configuraciones complejas.
                        </p>

                        {/* Features Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/10 shadow-lg">
                                    <Target className="w-5 h-5 text-indigo-300" />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold mb-1">Resultados Reales</h4>
                                    <p className="text-sm text-indigo-200/70">Tus clientes verán métricas y entregas impecables.</p>
                                </div>
                            </div>
                            
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/10 shadow-lg">
                                    <Zap className="w-5 h-5 text-amber-300" />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold mb-1">100% Intuitivo</h4>
                                    <p className="text-sm text-indigo-200/70">Diseño amigable. Tu equipo lo usará el mismo día.</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/10 shadow-lg">
                                    <Bot className="w-5 h-5 text-emerald-300" />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold mb-1">Cotizador AI</h4>
                                    <p className="text-sm text-indigo-200/70">A diferencia de la competencia, la IA está integrada.</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/10 shadow-lg">
                                    <MessageSquare className="w-5 h-5 text-sky-300" />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold mb-1">Omnicanalidad</h4>
                                    <p className="text-sm text-indigo-200/70">WhatsApp centralizado y ecosistema de marketing.</p>
                                </div>
                            </div>
                        </div>

                        {/* Glass Panel Mockup Simulation */}
                        <div className="mt-16 relative rounded-2xl bg-white/5 border border-white/10 p-6 backdrop-blur-md shadow-2xl overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="flex items-center gap-4 mb-4">
                                <div className="flex gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                                </div>
                                <div className="h-4 w-32 bg-white/10 rounded overflow-hidden">
                                     <div className="w-full h-full bg-white/20 animate-pulse"></div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="h-2 w-3/4 bg-white/10 rounded"></div>
                                <div className="h-2 w-1/2 bg-white/10 rounded"></div>
                                <div className="h-2 w-5/6 bg-white/10 rounded"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
