import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Users, Calendar, Plus, MessageSquare, FileText, UserPlus, X } from 'lucide-react';
import { cn } from '../lib/utils';

export default function MobileNav() {
    const location = useLocation();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [showActionSheet, setShowActionSheet] = useState(false);

    const tabs = [
        { name: 'Inicio', href: '/dashboard', icon: LayoutDashboard, current: location.pathname === '/dashboard' },
        { name: t('sidebar.leads'), href: '/leads', icon: Users, current: location.pathname.startsWith('/leads') },
        { name: 'Chat', href: '/marketing/chat', icon: MessageSquare, current: location.pathname.startsWith('/marketing/chat') },
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

            {/* ── Bottom Navigation Bar ── */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-[100] pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-around h-18">
                    {tabs.map((tab, idx) => {
                        const isTabActive = tab.current;
                        const Icon = tab.icon!;

                        const content = (
                            <div className={cn(
                                "flex flex-col items-center justify-center py-1 transition-all relative",
                                tab.isCreate
                                    ? showActionSheet ? "text-[#4449AA]" : "text-gray-500"
                                    : tab.href === '/marketing/chat' && isTabActive
                                    ? "text-emerald-600"
                                    : tab.href === '/marketing/chat'
                                    ? "text-gray-400"
                                    : isTabActive ? "text-green-600" : "text-gray-400"
                            )}>
                                {tab.href === '/marketing/chat' && isTabActive && (
                                    <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-emerald-500 mb-1" />
                                )}
                                <Icon className={cn(
                                    "w-6 h-6 mb-1",
                                    tab.isCreate ? (showActionSheet ? "rotate-45 duration-200" : "rotate-0 duration-200") : "",
                                    "transition-transform",
                                    tab.href === '/marketing/chat' && isTabActive ? "stroke-emerald-600" : ""
                                )} />
                                <span className="text-[10px] font-bold uppercase tracking-tight">{tab.name}</span>
                            </div>
                        );

                        return (
                            <div key={tab.name || idx} className="flex-1 flex justify-center">
                                {tab.isCreate ? (
                                    <button
                                        onClick={() => setShowActionSheet(prev => !prev)}
                                        className="w-full active:scale-90 transition-transform"
                                    >
                                        {content}
                                    </button>
                                ) : (
                                    <Link
                                        to={tab.href!}
                                        className="w-full text-center"
                                        onClick={() => setShowActionSheet(false)}
                                    >
                                        {content}
                                    </Link>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
}
