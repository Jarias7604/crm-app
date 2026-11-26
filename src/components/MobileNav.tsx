import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Users, Calendar, Plus, MessageSquare, FileText, UserPlus, X } from 'lucide-react';
import { cn } from '../lib/utils';

export default function MobileNav() {
    const location = useLocation();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [showActionSheet, setShowActionSheet] = useState(false);
    const [mobileChatOpen, setMobileChatOpen] = useState(false);

    useEffect(() => {
        if (!location.pathname.startsWith('/support/chat')) {
            setMobileChatOpen(false);
        }
    }, [location.pathname]);

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<boolean>).detail;
            setMobileChatOpen(Boolean(detail));
        };
        window.addEventListener('arias:mobile-chat-open', handler);
        return () => window.removeEventListener('arias:mobile-chat-open', handler);
    }, []);

    if (mobileChatOpen && location.pathname.startsWith('/support/chat')) {
        return null;
    }

    const tabs = [
        { name: 'Inicio', href: '/dashboard', icon: LayoutDashboard, current: location.pathname === '/dashboard' },
        { name: t('sidebar.leads'), href: '/leads', icon: Users, current: location.pathname.startsWith('/leads') },
        { name: 'Chat', href: '/support/chat', icon: MessageSquare, current: location.pathname.startsWith('/support/chat') },
        { name: t('sidebar.calendar'), href: '/calendar', icon: Calendar, current: location.pathname.startsWith('/calendar') },
        {
            name: 'Nuevo',
            isCreate: true,
            icon: Plus,
            current: false
        }
    ];

    const handleNewQuote = () => {
        setShowActionSheet(false);
        navigate('/cotizaciones/nueva-pro');
    };

    const handleNewLead = () => {
        setShowActionSheet(false);
        navigate('/leads', { state: { openCreateModal: Date.now() } });
    };

    return (
        <>
            {/* ── iOS-style Action Sheet ── */}
            {showActionSheet && (
                <div
                    className="md:hidden fixed inset-0 z-[200] flex flex-col justify-end"
                    onClick={() => setShowActionSheet(false)}
                >
                    {/* Dark overlay */}
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-200" />

                    {/* Bottom Sheet panel */}
                    <div
                        className="relative bg-white rounded-t-[2rem] shadow-2xl animate-in slide-in-from-bottom duration-300"
                        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Drag Handle */}
                        <div className="flex justify-center pt-3 pb-2">
                            <div className="w-10 h-1 bg-gray-200 rounded-full" />
                        </div>

                        {/* Title */}
                        <div className="px-5 pb-3 border-b border-gray-100">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Crear nuevo</p>
                        </div>

                        {/* Action Buttons */}
                        <div className="px-4 py-3 space-y-3">

                            {/* Nueva Cotización */}
                            <button
                                onClick={handleNewQuote}
                                className="w-full flex items-center gap-4 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl active:scale-[0.98] active:bg-indigo-100 transition-all"
                            >
                                <div className="w-12 h-12 bg-[#4449AA] rounded-xl flex items-center justify-center shadow-lg shadow-[#4449AA]/25 flex-shrink-0">
                                    <FileText className="w-6 h-6 text-white" />
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-black text-slate-900 text-base leading-tight">Nueva Cotización</p>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">Crear propuesta comercial</p>
                                </div>
                                <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                    <span className="text-[#4449AA] text-sm font-black">›</span>
                                </div>
                            </button>

                            {/* Nuevo Lead */}
                            <button
                                onClick={handleNewLead}
                                className="w-full flex items-center gap-4 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl active:scale-[0.98] active:bg-emerald-100 transition-all"
                            >
                                <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/25 flex-shrink-0">
                                    <UserPlus className="w-6 h-6 text-white" />
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-black text-slate-900 text-base leading-tight">Nuevo Lead / Contacto</p>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">Agregar prospecto al CRM</p>
                                </div>
                                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                    <span className="text-emerald-600 text-sm font-black">›</span>
                                </div>
                            </button>
                        </div>

                        {/* Cancel */}
                        <div className="px-4 pb-2">
                            <button
                                onClick={() => setShowActionSheet(false)}
                                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gray-100 active:bg-gray-200 rounded-2xl transition-all"
                            >
                                <X className="w-4 h-4 text-gray-500" />
                                <span className="text-sm font-black text-gray-600 uppercase tracking-wide">Cancelar</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Bottom Navigation Bar (iOS 26 Liquid Glass Floating Dock) ── */}
            <div
                className="md:hidden fixed bottom-0 left-0 right-0 z-[100] px-3 pointer-events-none"
                style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
            >
                <nav
                    style={{ WebkitBackdropFilter: 'blur(10px) saturate(180%)', backdropFilter: 'blur(10px) saturate(180%)' }}
                    className="pointer-events-auto mx-auto max-w-md h-[64px] px-2 rounded-full bg-white/30 border border-white/75 ring-1 ring-slate-900/[0.06] shadow-[0_10px_30px_rgba(15,23,42,0.13),inset_0_1.5px_1px_rgba(255,255,255,0.85),inset_0_-1px_2px_rgba(15,23,42,0.05)] flex items-center justify-around"
                >
                    {tabs.map((tab, idx) => {
                        const isTabActive = tab.current;
                        const isActive = tab.isCreate ? showActionSheet : isTabActive;
                        const Icon = tab.icon!;

                        const content = (
                            <div className={cn(
                                "inline-flex flex-col items-center justify-center transition-all relative rounded-full",
                                isActive
                                    ? "bg-blue-600/[0.12] text-blue-600 px-3.5 py-1.5"
                                    : "text-slate-950 px-2.5 py-1.5"
                            )}>
                                <Icon
                                    strokeWidth={isActive ? 2.25 : 1.9}
                                    className={cn(
                                        "w-[22px] h-[22px] mb-0.5 transition-transform",
                                        tab.isCreate ? (showActionSheet ? "rotate-45 duration-200" : "rotate-0 duration-200") : ""
                                    )}
                                />
                                <span className="text-[10px] font-bold uppercase tracking-tight leading-none">{tab.name}</span>
                            </div>
                        );

                        return (
                            <div key={tab.name || idx} className="flex-1 flex justify-center">
                                {tab.isCreate ? (
                                    <button
                                        onClick={() => setShowActionSheet(prev => !prev)}
                                        className="w-full flex justify-center active:scale-90 transition-transform"
                                    >
                                        {content}
                                    </button>
                                ) : (
                                    <Link
                                        to={tab.href!}
                                        className="w-full flex justify-center text-center"
                                        onClick={() => setShowActionSheet(false)}
                                    >
                                        {content}
                                    </Link>
                                )}
                            </div>
                        );
                    })}
                </nav>
            </div>
        </>
    );
}
