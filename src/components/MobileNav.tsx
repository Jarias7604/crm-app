import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Users, Calendar, Plus, Menu } from 'lucide-react';
import { cn } from '../lib/utils';
import { useState } from 'react';
import { MobileQuickActions } from './MobileQuickActions';

export default function MobileNav() {
    const location = useLocation();
    const { t } = useTranslation();
    const [isActionsOpen, setIsActionsOpen] = useState(false);

<<<<<<< HEAD
    // Main tabs (max 4-5 for bottom bar)
    const mainTabs = [
        { name: 'Inicio', href: '/', icon: LayoutDashboard, current: location.pathname === '/' },
        { name: t('sidebar.leads'), href: '/leads', icon: Users, current: location.pathname.startsWith('/leads') },
        { name: t('sidebar.calendar'), href: '/calendar', icon: Calendar, current: location.pathname.startsWith('/calendar') },
=======
    // Explicitly mapping labels to ensure they match premium design exactly
    const tabs = [
        {
            name: (t('sidebar.dashboard') || 'DASHBOARD').toUpperCase(),
            href: '/',
            icon: LayoutDashboard,
            current: location.pathname === '/'
        },
        {
            name: (t('sidebar.leads') || 'LEADS').toUpperCase(),
            href: '/leads',
            icon: Users,
            current: location.pathname.startsWith('/leads')
        },
        { isSpacer: true },
        {
            name: (t('sidebar.calendar') || 'CALENDARIO').toUpperCase(),
            href: '/calendar',
            icon: Calendar,
            current: location.pathname.startsWith('/calendar')
        },
        {
            name: 'MENÚ',
            isMenu: true,
            icon: Menu,
            current: isActionsOpen
        },
>>>>>>> 30b17dc9fb97dd1e64651dbcfc3fe7e04a7051fb
    ];

    return (
        <>
            <div className="md:hidden fixed bottom-8 left-1/2 -translate-x-1/2 w-[94%] max-w-[420px] z-[100]">
                {/* Premium Floating Bar */}
                <div className="relative bg-white/90 backdrop-blur-2xl border border-white/40 shadow-[0_20px_40px_rgba(0,0,0,0.15)] rounded-[2.5rem] px-2 h-18 flex items-center justify-between overflow-visible py-2">

                    {/* Glowing Action Button - Popping out exactly as in Image 1 */}
                    <button
                        onClick={() => setIsActionsOpen(true)}
                        className="absolute left-1/2 -translate-x-1/2 -top-7 w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-[0_12px_24px_rgba(79,70,229,0.4)] flex items-center justify-center active:scale-95 hover:scale-105 transition-all duration-300 z-10 border-4 border-white"
                    >
                        <Plus className="w-9 h-9" />
                    </button>

                    {tabs.map((tab, idx) => {
                        if (tab.isSpacer) return <div key="spacer" className="w-16" />;

                        const isTabActive = tab.current;
                        const Icon = tab.icon!;

                        const content = (
                            <div className={cn(
                                "flex flex-col items-center justify-center p-2 transition-all duration-300 relative",
                                isTabActive ? "text-indigo-600 scale-105" : "text-gray-400 opacity-80"
                            )}>
                                <Icon className={cn("w-6 h-6 mb-1", isTabActive ? "stroke-[2.5px]" : "stroke-[2px]")} />
                                <span className="text-[9px] font-black uppercase tracking-tight leading-none">{tab.name}</span>
                                {isTabActive && (
                                    <div className="absolute -bottom-2 w-1.5 h-1.5 bg-indigo-600 rounded-full shadow-[0_0_8px_rgba(79,70,229,0.5)]" />
                                )}
                            </div>
                        );

                        return (
                            <div key={tab.name || idx} className="flex-1 flex justify-center">
                                {tab.isMenu ? (
                                    <button onClick={() => setIsActionsOpen(true)}>
                                        {content}
                                    </button>
                                ) : (
                                    <Link to={tab.href!}>
                                        {content}
                                    </Link>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Premium Action Center */}
            <MobileQuickActions
                isOpen={isActionsOpen}
                onClose={() => setIsActionsOpen(false)}
                onCreateLead={() => {
                    window.dispatchEvent(new CustomEvent('open-create-lead'));
                    setIsActionsOpen(false);
                }}
            />
        </>
    );
}
