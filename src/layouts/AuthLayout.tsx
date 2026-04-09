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

            {/* Right Column: Enterprise Trust & Professionalism */}
            <div className="hidden lg:flex relative w-0 flex-1 bg-[#1a1d4b] overflow-hidden">
                {/* Subtle Corporate Gradients & Structure */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#4449AA] to-[#121433] opacity-90" />
                
                {/* Engineering Grid (Conveys Order, Precision, Data) */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:24px_24px]" />

                <div className="absolute top-6 right-8 z-50">
                    <LanguageSwitcher />
                </div>

                <div className="relative z-10 flex flex-col justify-center items-center w-full px-12 xl:px-24">
                    <div className="max-w-xl w-full">
                        {/* High-Trust Typography */}
                        <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight mb-5 tracking-tight">
                            Control estructurado.<br/>
                            <span className="text-indigo-200">Visión empresarial.</span>
                        </h1>
                        <p className="text-base text-indigo-100/80 mb-12 font-medium leading-relaxed max-w-lg">
                            Un ecosistema diseñado para brindar orden operativo, seguridad en el manejo de datos y una experiencia de usuario moderna y profesional.
                        </p>

                        {/* Enterprise Values Grid (Monochromatic, Clean) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-10">
                            <div className="flex flex-col gap-3">
                                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center border border-white/20">
                                    <Shield className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold text-sm tracking-wide">Seguridad de Grado</h4>
                                    <p className="text-xs text-indigo-200/70 mt-1 leading-relaxed">Protección de datos y aislamiento total de información entre usuarios y roles.</p>
                                </div>
                            </div>
                            
                            <div className="flex flex-col gap-3">
                                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center border border-white/20">
                                    <Target className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold text-sm tracking-wide">Precisión Operativa</h4>
                                    <p className="text-xs text-indigo-200/70 mt-1 leading-relaxed">Gestión de prospectos e inventarios con un orden inquebrantable.</p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center border border-white/20">
                                    <Zap className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold text-sm tracking-wide">Modernización Integral</h4>
                                    <p className="text-xs text-indigo-200/70 mt-1 leading-relaxed">Flujos de trabajo acelerados por arquitectura de software de última generación.</p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center border border-white/20">
                                    <Bot className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold text-sm tracking-wide">Automatización Limpia</h4>
                                    <p className="text-xs text-indigo-200/70 mt-1 leading-relaxed">Procesos delegados al sistema para eliminar el error humano.</p>
                                </div>
                            </div>
                        </div>

                        {/* Professional Data Concept Abstract Component */}
                        <div className="mt-16 relative w-full h-[180px] rounded-2xl bg-gradient-to-b from-white/5 to-transparent border border-white/10 p-1 overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-indigo-400 to-transparent opacity-50" />
                            
                            <div className="w-full h-full rounded-xl bg-[#121433]/50 backdrop-blur-sm flex flex-col p-6">
                                {/* Header of Abstract Widget */}
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                                        <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-[0.2em]">Sistema Operacional Activo</span>
                                    </div>
                                    <div className="text-[10px] text-white/40 font-mono">Última auditoría: {new Date().toLocaleDateString()}</div>
                                </div>
                                
                                {/* Clean Data Lines */}
                                <div className="space-y-4 flex-1">
                                    <div className="w-full flex items-center gap-4">
                                        <div className="w-1/4 h-1.5 bg-white/20 rounded-full" />
                                        <div className="w-3/4 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                            <div className="w-[85%] h-full bg-indigo-400 rounded-full" />
                                        </div>
                                    </div>
                                    <div className="w-full flex items-center gap-4">
                                        <div className="w-1/3 h-1.5 bg-white/20 rounded-full" />
                                        <div className="w-2/3 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                            <div className="w-[60%] h-full bg-indigo-400 rounded-full" />
                                        </div>
                                    </div>
                                    <div className="w-full flex items-center gap-4">
                                        <div className="w-1/5 h-1.5 bg-white/20 rounded-full" />
                                        <div className="w-4/5 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                            <div className="w-[92%] h-full bg-indigo-400 rounded-full" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
