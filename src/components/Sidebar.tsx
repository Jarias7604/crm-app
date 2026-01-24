import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { LayoutDashboard, Users, Calendar, Building, LogOut, ShieldCheck, FileText, Settings, ChevronDown, ChevronRight, Package, Tag, Layers, Building2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { LanguageSwitcher } from './LanguageSwitcher';
import { brandingService } from '../services/branding';
import type { Company } from '../types';

export default function Sidebar() {
    const { profile, signOut } = useAuth();
    const location = useLocation();
    const { t } = useTranslation();
    const [configOpen, setConfigOpen] = useState(location.pathname.startsWith('/config'));
    const [company, setCompany] = useState<Company | null>(null);

    useEffect(() => {
        if (profile?.company_id) {
            loadCompany();
        }
    }, [profile?.company_id]);

    const loadCompany = async () => {
        try {
            const data = await brandingService.getMyCompany();
            setCompany(data);
        } catch (error) {
            console.error('Error loading company branding for sidebar:', error);
        }
    };

    const navigation = [
        { name: t('sidebar.dashboard'), href: '/', icon: LayoutDashboard, current: location.pathname === '/' },
        { name: t('sidebar.leads'), href: '/leads', icon: Users, current: location.pathname.startsWith('/leads') },
        { name: 'Cotizaciones', href: '/cotizaciones', icon: FileText, current: location.pathname === '/cotizaciones' },
        { name: t('sidebar.calendar'), href: '/calendar', icon: Calendar, current: location.pathname.startsWith('/calendar') },
    ];

    const configSubItems = [
        { name: 'Marca de Empresa', href: '/config/branding', icon: Building, current: location.pathname === '/config/branding' },
        { name: 'Gestión Precios', href: '/config/pricing', icon: Tag, current: location.pathname === '/config/pricing' },
        { name: 'Gestión Paquete', href: '/config/paquetes', icon: Package, current: location.pathname === '/config/paquetes' },
        { name: 'Gestión Item', href: '/config/items', icon: Layers, current: location.pathname === '/config/items' },
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
            <div className="flex items-center justify-center min-h-[5rem] border-b border-[#1e293b] flex-col bg-[#0f172a] px-4 py-2">
                <div className="w-full flex items-center justify-center h-12 mb-1">
                    {company?.logo_url ? (
                        <img src={company.logo_url} alt={company.name} className="max-h-full max-w-full object-contain" />
                    ) : (
                        <div className="flex items-center gap-2 text-white">
                            <Building2 className="w-5 h-5 text-blue-500" />
                            <span className="text-sm font-black tracking-tight uppercase truncate">
                                {company?.name || 'CRM Enterprise'}
                            </span>
                        </div>
                    )}
                </div>
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest bg-gray-900/50 px-2 py-0.5 rounded-full border border-gray-800/10">
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

                    {/* ACORDEON DE CONFIGURACIÓN */}
                    {(profile?.role === 'super_admin' || profile?.role === 'company_admin') && (
                        <div className="space-y-1">
                            <button
                                onClick={() => setConfigOpen(!configOpen)}
                                className={cn(
                                    location.pathname.startsWith('/config') ? 'text-white' : 'text-gray-300 hover:bg-[#1e293b] hover:text-white',
                                    'group flex items-center justify-between w-full px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 outline-none'
                                )}
                            >
                                <div className="flex items-center">
                                    <Settings className={cn(
                                        location.pathname.startsWith('/config') ? 'text-white' : 'text-gray-400 group-hover:text-white',
                                        "mr-3 flex-shrink-0 h-5 w-5 transition-colors"
                                    )} />
                                    <span>Configuración</span>
                                </div>
                                {configOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>

                            {configOpen && (
                                <div className="space-y-1 ml-4 pt-1">
                                    {configSubItems.map((subItem) => (
                                        <Link
                                            key={subItem.name}
                                            to={subItem.href}
                                            className={cn(
                                                subItem.current ? 'bg-blue-600/20 text-blue-400 border-l-2 border-blue-500' : 'text-gray-400 hover:bg-[#1e293b] hover:text-white',
                                                'group flex items-center px-4 py-2 text-xs font-bold rounded-r-lg transition-all duration-200'
                                            )}
                                        >
                                            <subItem.icon className={cn(
                                                subItem.current ? 'text-blue-400' : 'text-gray-500 group-hover:text-white',
                                                "mr-3 h-4 w-4"
                                            )} />
                                            {subItem.name}
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
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
