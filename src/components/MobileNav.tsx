import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { LayoutDashboard, Users, Calendar, Menu, X, ShieldCheck, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';
import { useState } from 'react';

export default function MobileNav() {
    const { profile, signOut } = useAuth();
    const location = useLocation();
    const { t } = useTranslation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Main tabs (max 4-5 for bottom bar)
    const mainTabs = [
        { name: t('sidebar.dashboard'), href: '/', icon: LayoutDashboard, current: location.pathname === '/' },
        { name: t('sidebar.leads'), href: '/leads', icon: Users, current: location.pathname.startsWith('/leads') },
        { name: t('sidebar.calendar'), href: '/calendar', icon: Calendar, current: location.pathname.startsWith('/calendar') },
    ];

    // Admin tabs for the "More" menu
    const adminTabs = [
        { name: t('sidebar.companies'), href: '/admin/companies', icon: Users, show: profile?.role === 'super_admin' },
        { name: 'Equipo', href: '/company/team', icon: Users, show: profile?.role === 'super_admin' || profile?.role === 'company_admin' },
        { name: 'Permisos', href: '/company/permissions', icon: ShieldCheck, show: profile?.role === 'super_admin' || profile?.role === 'company_admin' },
    ].filter(tab => tab.show);

    return (
        <>
            {/* Bottom Navigation Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 px-4 pb-safe pt-2">
                <div className="flex justify-between items-center h-14">
                    {mainTabs.map((tab) => (
                        <Link
                            key={tab.name}
                            to={tab.href}
                            className={cn(
                                "flex flex-col items-center justify-center w-full h-full space-y-1",
                                tab.current ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            <tab.icon className="w-6 h-6" />
                            <span className="text-[10px] font-medium">{tab.name}</span>
                        </Link>
                    ))}

                    {/* More / Menu Toggle */}
                    <button
                        onClick={() => setIsMenuOpen(true)}
                        className={cn(
                            "flex flex-col items-center justify-center w-full h-full space-y-1",
                            isMenuOpen ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
                        )}
                    >
                        <Menu className="w-6 h-6" />
                        <span className="text-[10px] font-medium">Menú</span>
                    </button>
                </div>
            </div>

            {/* Slide-up Menu for Extra Links & Profile */}
            {isMenuOpen && (
                <div className="fixed inset-0 z-[60] md:hidden">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)} />
                    <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-6 shadow-xl animate-in slide-in-from-bottom duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">{profile?.email}</h3>
                                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">{profile?.role?.replace('_', ' ')}</p>
                            </div>
                            <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-gray-100 rounded-full">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            {adminTabs.map((tab) => (
                                <Link
                                    key={tab.name}
                                    to={tab.href}
                                    onClick={() => setIsMenuOpen(false)}
                                    className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                                >
                                    <div className="p-3 bg-white rounded-full shadow-sm mb-2 text-blue-600">
                                        <tab.icon className="w-6 h-6" />
                                    </div>
                                    <span className="text-sm font-medium text-gray-700">{tab.name}</span>
                                </Link>
                            ))}
                        </div>

                        <button
                            onClick={() => { signOut(); setIsMenuOpen(false); }}
                            className="w-full flex items-center justify-center gap-2 p-4 text-red-600 font-medium bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                            Cerrar Sesión
                        </button>

                        {/* Safe area spacer for bottom nav */}
                        <div className="h-16" />
                    </div>
                </div>
            )}
        </>
    );
}
