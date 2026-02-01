import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import MobileNav from '../components/MobileNav';
import { cn } from '../lib/utils';
import { useAuth } from '../auth/AuthProvider';
import { useTranslation } from 'react-i18next';

export default function DashboardLayout() {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const { profile } = useAuth();
    const { t, i18n } = useTranslation();
    const location = useLocation();

    // Check if we are in a quote detail view (not editing)
    const isQuoteDetail = location.pathname.startsWith('/cotizaciones/') &&
        !location.pathname.endsWith('/editar') &&
        location.pathname !== '/cotizaciones/nueva' &&
        location.pathname !== '/cotizaciones/nueva-pro';

    return (
        <div className="min-h-screen bg-[#F8F9FD]">
            {/* Desktop Sidebar - Hidden on mobile */}
            <div className="hidden md:block">
                <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
            </div>

            {/* Mobile Bottom Nav - Hidden on desktop */}
            <MobileNav />

            {/* Main Content Area */}
            {/* Dynamic padding based on sidebar state */}
            <div className={cn(
                "transition-all duration-300 ease-in-out flex flex-col min-h-screen pb-20 md:pb-0",
                sidebarCollapsed ? "md:pl-20" : "md:pl-64"
            )}>
                {/* Optimized Global Header - Hidden on Quote Detail for immersion */}
                {!isQuoteDetail && (
                    <header className="w-full px-4 md:px-8 pt-4 pb-6">
                        <div className="max-w-[1580px] mx-auto flex items-center justify-start">
                            <div className="flex flex-col items-start gap-0 group cursor-default">
                                <h2 className="text-[13px] md:text-[14px] font-black text-gray-800 tracking-tight flex items-center gap-1.5 transition-all group-hover:text-indigo-600">
                                    {t('common.greeting', { name: profile?.full_name?.split(' ')[0] || profile?.email?.split('@')[0] })}
                                    <span className="animate-bounce text-[12px]">✨</span>
                                </h2>
                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-[0.25em] opacity-70 group-hover:opacity-100 transition-opacity">
                                    {new Date().toLocaleDateString(i18n.language === 'es' ? 'es-ES' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                        </div>
                    </header>
                )}

                {/* Main Content Area - Clean separation */}
                <main className={cn(
                    "flex-1 w-full pb-8 transition-all",
                    !isQuoteDetail ? "max-w-[1580px] mx-auto px-4 md:px-8" : "pt-0 px-0"
                )}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
