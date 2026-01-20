import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { LayoutDashboard, Users, Calendar, Building, LogOut, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';
import { LanguageSwitcher } from './LanguageSwitcher';

export default function Sidebar() {
    const { profile, signOut } = useAuth();
    const location = useLocation();

    const { t } = useTranslation();

    const navigation = [
        { name: t('sidebar.dashboard'), href: '/', icon: LayoutDashboard, current: location.pathname === '/' },
        { name: t('sidebar.leads'), href: '/leads', icon: Users, current: location.pathname.startsWith('/leads') },
        { name: t('sidebar.calendar'), href: '/calendar', icon: Calendar, current: location.pathname.startsWith('/calendar') },
    ];

    if (profile?.role === 'super_admin') {
        navigation.push({ name: t('sidebar.companies'), href: '/admin/companies', icon: Building, current: location.pathname.startsWith('/admin/companies') });
    }

    if (profile?.role === 'super_admin' || profile?.role === 'company_admin') {
        navigation.push({ name: 'Equipo', href: '/company/team', icon: Users, current: location.pathname.startsWith('/company/team') });
        navigation.push({ name: 'Permisos', href: '/company/permissions', icon: ShieldCheck, current: location.pathname.startsWith('/company/permissions') });
    }

    const getRoleTitle = () => {
        if (profile?.role === 'super_admin') return 'Super Admin';
        if (profile?.role === 'company_admin') return 'Administrador';
        if (profile?.role === 'sales_agent') return 'Agente de Ventas';
        return 'Colaborador';
    };

    return (
        <div className="flex flex-col w-64 bg-[#0f172a] h-screen fixed left-0 top-0 z-10 transition-transform duration-300 ease-in-out transform translate-x-0 border-r border-[#1e293b]">
            <div className="flex items-center justify-center h-16 border-b border-[#1e293b] flex-col bg-[#0f172a]">
                <span className="text-lg font-bold text-white tracking-wide">CRM Enterprise</span>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    {getRoleTitle()}
                </span>
            </div>
            <div className="flex-1 flex flex-col overflow-y-auto pt-4">
                <nav className="flex-1 px-2 space-y-2">
                    {navigation.map((item) => (
                        <Link
                            key={item.name}
                            to={item.href}
                            className={cn(
                                item.current ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-gray-300 hover:bg-[#1e293b] hover:text-white',
                                'group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200'
                            )}
                        >
                            <item.icon className={cn(
                                item.current ? 'text-white' : 'text-gray-400 group-hover:text-white',
                                "mr-3 flex-shrink-0 h-5 w-5 transition-colors"
                            )} aria-hidden="true" />
                            {item.name}
                        </Link>
                    ))}
                </nav>
            </div>
            <div className="flex-shrink-0 flex border-t border-[#1e293b] p-4 flex-col gap-2 bg-[#0f172a]">
                <LanguageSwitcher />
                <div className="flex items-center w-full rounded-lg p-2 transition-colors hover:bg-[#1e293b] cursor-pointer" onClick={signOut}>
                    <div className="flex items-center">
                        <div>
                            <LogOut className="inline-block h-5 w-5 text-gray-400" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium text-gray-200">
                                {profile?.email}
                            </p>
                            <p className="text-xs font-medium text-gray-400">
                                {t('sidebar.signOut')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
