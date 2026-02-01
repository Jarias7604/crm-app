import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { LayoutDashboard, Users, Calendar, Building, LogOut, ShieldCheck, FileText, Settings, ChevronDown, ChevronRight, Package, Tag, Layers, Building2, Megaphone, MessageSquare, CreditCard, ChevronLeft } from 'lucide-react';
import { cn } from '../lib/utils';
import { LanguageSwitcher } from './LanguageSwitcher';
import { brandingService } from '../services/branding';
import { supabase } from '../services/supabase';
import type { Company } from '../types';

export default function Sidebar({ isCollapsed, onToggle }: { isCollapsed: boolean, onToggle: () => void }) {
    const { profile, signOut, setSimulatedCompanyId, setSimulatedRole } = useAuth();
    const location = useLocation();
    const { t } = useTranslation();
    const configPaths = ['/company/branding', '/pricing', '/paquetes', '/items', '/financial-rules'];
    const [configOpen, setConfigOpen] = useState(configPaths.some(path => location.pathname === path));
    const [company, setCompany] = useState<Company | null>(null);

    useEffect(() => {
        // Cargar datos de la empresa si hay un company_id
        if (profile?.company_id) {
            loadCompany();
        } else if (profile?.role === 'super_admin') {
            // Placeholder para super admin si no tiene empresa vinculada
            setCompany({ name: 'System Administration' } as Company);
        }
    }, [profile?.company_id, profile?.role]);

    const loadCompany = async () => {
        try {
            const data = await brandingService.getMyCompany();
            if (data) {
                setCompany(data);
            }
        } catch (error) {
            console.error('Error loading company branding for sidebar:', error);
            // Intentar fallback si falla el servicio pero tenemos el ID
            if (profile?.company_id && !company) {
                const { data: fallbackCompany } = await supabase
                    .from('companies')
                    .select('name, logo_url')
                    .eq('id', profile.company_id)
                    .single();
                if (fallbackCompany) setCompany(fallbackCompany as Company);
            }
        }
    };

    // --- PERMISSION LOGIC ---
    const canAccess = (feature: 'leads' | 'quotes' | 'calendar' | 'marketing' | 'chat') => {
        if (!profile) return false;

        // Si es super_admin tiene acceso a todo
        if (profile.role === 'super_admin') return true;

        // Si no hay empresa cargada todavía, esperamos
        if (!company) return false;

        const licenseKeys: Record<string, string> = {
            leads: 'leads_view',
            quotes: 'cotizaciones.manage_implementation',
            calendar: 'calendar_view_own',
            marketing: 'mkt_view_dashboard',
            chat: 'chat_view_all',
            branding: 'branding',
            pricing: 'pricing',
            paquetes: 'paquetes',
            items: 'items'
        };

        const licenseKey = licenseKeys[feature];
        const isLicensed = company.allowed_permissions?.includes(licenseKey);
        if (!isLicensed && (profile?.role as string) !== 'super_admin') return false;

        if (profile.role === 'company_admin') return true;
        return profile.permissions?.[feature] !== false;
    };

    const navigation = [
        { name: t('sidebar.dashboard'), href: '/', icon: LayoutDashboard, current: location.pathname === '/' }
    ];

    if (canAccess('leads')) {
        navigation.push({ name: t('sidebar.leads'), href: '/leads', icon: Users, current: location.pathname.startsWith('/leads') });
    }

    if (canAccess('quotes')) {
        navigation.push({ name: 'Cotizaciones', href: '/cotizaciones', icon: FileText, current: location.pathname === '/cotizaciones' });
    }

    if (canAccess('calendar')) {
        navigation.push({ name: t('sidebar.calendar'), href: '/calendar', icon: Calendar, current: location.pathname.startsWith('/calendar') });
    }

    if (canAccess('marketing')) {
        navigation.push({
            name: 'Marketing Hub',
            href: '/marketing',
            icon: Megaphone,
            current: location.pathname.startsWith('/marketing') && !location.pathname.startsWith('/marketing/chat')
        });
    }

    if (canAccess('chat')) {
        navigation.push({
            name: 'Mensajes',
            href: '/marketing/chat',
            icon: MessageSquare,
            current: location.pathname.startsWith('/marketing/chat')
        });
    }

    const configSubItemsRaw = [
        { name: 'Marca de Empresa', href: '/company/branding', icon: Building, current: location.pathname === '/company/branding', permissionKey: 'branding' },
        { name: 'Gestión Precios', href: '/pricing', icon: Tag, current: location.pathname === '/pricing', permissionKey: 'pricing' },
        { name: 'Gestión Paquete', href: '/paquetes', icon: Package, current: location.pathname === '/paquetes', permissionKey: 'paquetes' },
        { name: 'Gestión Item', href: '/items', icon: Layers, current: location.pathname === '/items', permissionKey: 'items' },
        { name: 'Gestión Financiera', href: '/financial-rules', icon: CreditCard, current: location.pathname === '/financial-rules', permissionKey: 'financial_rules' },
    ];

    const configSubItems = configSubItemsRaw.filter(item => {
        if (profile?.role === 'super_admin' || profile?.role === 'company_admin') return true;
        return profile?.permissions?.[item.permissionKey!] === true;
    });

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
        <div className={cn(
            "flex flex-col bg-[#0f172a] h-screen fixed left-0 top-0 z-50 transition-all duration-300 ease-in-out border-r border-[#1e293b] group/sidebar",
            isCollapsed ? "w-20 overflow-visible" : "w-64"
        )}>
            {/* Header / Brand */}
            <div className="relative flex flex-col items-center justify-center min-h-[6.5rem] border-b border-[#1e293b] bg-[#0f172a] px-4 py-2">
                {window.location.hostname === 'localhost' && (
                    <div className="absolute top-2 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-md">
                        <p className="text-[8px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                            </span>
                            DEV
                        </p>
                    </div>
                )}
                {/* Toggle Button - Modern White Style */}
                <button
                    onClick={onToggle}
                    className={cn(
                        "absolute -right-3.5 top-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-[#0f172a]/80 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.4)] transition-all duration-300 hover:border-blue-500/50 hover:shadow-[0_0_15px_rgba(59,130,246,0.4)] active:scale-95 group/toggle z-50",
                        isCollapsed ? "rotate-180" : ""
                    )}
                >
                    <div className="relative flex items-center justify-center transition-transform duration-300 group-hover/toggle:scale-125">
                        <div className="absolute inset-0 bg-blue-500/20 blur-md rounded-full opacity-0 group-hover/toggle:opacity-100 transition-opacity" />
                        <ChevronLeft className="h-[18px] w-[18px] text-blue-400 group-hover:text-white transition-colors relative z-10" />
                    </div>
                </button>

                <div className={cn(
                    "w-full flex items-center h-14 overflow-hidden transition-all duration-300",
                    isCollapsed ? "justify-center" : "justify-center px-2"
                )}>
                    {company?.logo_url ? (
                        <img src={company.logo_url} alt={company.name} className={cn("max-h-full max-w-full object-contain transition-all", isCollapsed ? "scale-110" : "")} />
                    ) : company?.name ? (
                        <div className={cn(
                            "flex items-center gap-3 text-white shrink-0 transition-all",
                            isCollapsed ? "justify-center" : "flex-col text-center"
                        )}>
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shrink-0 border border-blue-400/30 shadow-lg shadow-blue-900/20">
                                <Building2 className="w-6 h-6 text-white" />
                            </div>
                            {!isCollapsed && (
                                <div className="flex flex-col min-w-0 max-w-[180px]">
                                    <span className="text-[13px] font-black tracking-tight uppercase truncate text-white leading-tight">
                                        {company.name}
                                    </span>
                                    <span className="text-[8px] font-black text-blue-400 uppercase tracking-[0.25em] mt-0.5 opacity-80">SaaS Business</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-white/20 animate-pulse shrink-0">
                            <Building2 className="w-5 h-5" />
                            {!isCollapsed && <div className="h-4 w-24 bg-white/10 rounded" />}
                        </div>
                    )}
                </div>

                {!isCollapsed && (profile?.id === 'c9c01b04-4160-4e4c-9718-15298c961e9b' || profile?.id === '292bc954-0d25-4147-9526-b7a7268be8e1' || profile?.email?.toLowerCase() === 'jarias7604@gmail.com' || profile?.email?.toLowerCase() === 'jarias@ariasdefense.com') && (
                    <div className="mt-2 flex flex-col items-center gap-1.5 w-full">
                        <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-1.5">
                                <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", localStorage.getItem('simulated_role') ? "bg-amber-500" : "bg-blue-500")} />
                                <span className={cn(
                                    "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border",
                                    localStorage.getItem('simulated_role') ? "text-amber-500 bg-amber-500/10 border-amber-500/20" : "text-gray-400 bg-gray-900/50 border-gray-800/10"
                                )}>
                                    {getRoleTitle()} {localStorage.getItem('simulated_role') && " (SIM)"}
                                </span>
                            </div>
                            {localStorage.getItem('simulated_role') && (
                                <button
                                    onClick={() => setSimulatedRole(null)}
                                    className="text-[8px] font-black text-amber-500/60 hover:text-amber-500 uppercase tracking-[0.2em] transition-all"
                                >
                                    [ Revertir Maestro ]
                                </button>
                            )}
                        </div>

                        <div className="mt-2 w-full px-2 space-y-2">
                            <div className="bg-black/20 rounded-lg p-2 border border-white/5">
                                <p className="text-[7px] text-gray-500 uppercase tracking-tighter mb-1 font-black">Master Debug Info</p>
                                <div className="grid grid-cols-2 gap-1 text-[7px] font-mono text-gray-400">
                                    <span className="opacity-50">ROLE:</span>
                                    <span className="text-blue-400 truncate">{profile?.role}</span>
                                    <span className="opacity-50">COMP:</span>
                                    <span className="text-amber-400 truncate">{profile?.company_id?.substring(0, 8)}...</span>
                                    <span className="opacity-50">LS_R:</span>
                                    <span className="text-emerald-400 truncate">{localStorage.getItem('simulated_role') || 'none'}</span>
                                </div>
                            </div>

                            <select
                                className="w-full bg-[#1e293b]/50 border border-gray-800 shadow-inner rounded-lg px-2 py-1.5 text-[10px] font-bold text-gray-300 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all cursor-pointer hover:bg-[#1e293b]"
                                value={profile?.company_id || ''}
                                onChange={(e) => {
                                    setSimulatedCompanyId(e.target.value || null);
                                }}
                            >
                                <option value="">Contexto Global</option>
                                <option value="7a582ba5-f7d0-4ae3-9985-35788deb1c30">Arias Defense Salvador</option>
                            </select>

                            <select
                                className="w-full bg-[#1e293b]/50 border border-gray-800 shadow-inner rounded-lg px-2 py-1.5 text-[10px] font-bold text-gray-300 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all cursor-pointer hover:bg-[#1e293b]"
                                value={localStorage.getItem('simulated_role') || 'super_admin'}
                                onChange={(e) => setSimulatedRole(e.target.value as any)}
                            >
                                <option value="super_admin">Rol: Super Admin</option>
                                <option value="company_admin">Rol: Administrador Empr.</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <div className={cn(
                "flex-1 flex flex-col pt-6 px-3 custom-scrollbar",
                isCollapsed ? "overflow-visible" : "overflow-y-auto"
            )}>
                <nav className="flex-1 space-y-1.5 focus:outline-none">
                    {navigation.map((item) => (
                        <Link
                            key={item.name}
                            to={item.href}
                            className={cn(
                                item.current
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                                    : 'text-gray-400 hover:bg-[#1e293b] hover:text-white',
                                'group flex items-center rounded-xl transition-all duration-200 focus:outline-none relative',
                                isCollapsed ? "justify-center p-3" : "px-4 py-3"
                            )}
                        >
                            <item.icon className={cn(
                                item.current ? 'text-white' : 'text-gray-400 group-hover:text-white',
                                "h-5 w-5 transition-colors shrink-0",
                                !isCollapsed && "mr-3"
                            )} aria-hidden="true" />

                            {!isCollapsed ? (
                                <span className="text-sm font-semibold tracking-wide truncate">{item.name}</span>
                            ) : (
                                /* Premium Dark Tooltip (Floating Label) */
                                <div className="absolute left-full ml-4 px-3.5 py-2.5 bg-[#0f172a]/95 backdrop-blur-xl text-white text-[11px] font-bold rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 translate-x-[-12px] group-hover:translate-x-0 z-[100] whitespace-nowrap border border-white/10 ring-1 ring-white/5">
                                    <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-[#0f172a] rotate-45 border-l border-b border-white/10" />
                                    <div className="flex items-center gap-2">
                                        <div className="w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                        {item.name}
                                    </div>
                                </div>
                            )}
                        </Link>
                    ))}

                    {/* ACORDEON DE CONFIGURACIÓN / FLYOUT */}
                    {configSubItems.length > 0 && (
                        <div className="group/config relative pt-2">
                            <button
                                onClick={() => !isCollapsed && setConfigOpen(!configOpen)}
                                className={cn(
                                    configPaths.some(path => location.pathname === path) ? 'text-white' : 'text-gray-400 hover:bg-[#1e293b] hover:text-white',
                                    'group flex items-center justify-between w-full rounded-xl transition-all duration-200 outline-none p-3',
                                    !isCollapsed && "px-4"
                                )}
                            >
                                <div className="flex items-center">
                                    <Settings className={cn(
                                        configPaths.some(path => location.pathname === path) ? 'text-white' : 'text-gray-400 group-hover:text-white',
                                        "h-5 w-5 transition-colors shrink-0",
                                        !isCollapsed && "mr-3"
                                    )} />
                                    {!isCollapsed && <span className="text-sm font-semibold">Configuración</span>}
                                </div>
                                {!isCollapsed && (configOpen ? <ChevronDown className="h-4 w-4 opacity-50" /> : <ChevronRight className="h-4 w-4 opacity-50" />)}
                            </button>

                            {/* Flyout Menu (Only when collapsed) */}
                            {isCollapsed ? (
                                <div className="absolute left-full bottom-0 ml-1 w-56 bg-[#0f172a]/95 backdrop-blur-2xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 opacity-0 group-hover/config:opacity-100 pointer-events-none group-hover/config:pointer-events-auto transition-all duration-300 translate-x-[-12px] group-hover/config:translate-x-0 z-[100] overflow-hidden mb-[-8px]">
                                    {/* Invisible Hover Bridge (Crucial to prevent closing) */}
                                    {/* Extends from the icon to the menu to catch fast mouse movements */}
                                    <div className="absolute left-[-40px] top-[-100px] w-[40px] h-[300px]" />

                                    <div className="bg-gradient-to-r from-blue-600/20 to-indigo-600/20 px-4 py-3 border-b border-white/5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Configuración</span>
                                        </div>
                                    </div>
                                    <div className="p-2 space-y-1">
                                        {configSubItems.map((subItem) => (
                                            <Link
                                                key={subItem.name}
                                                to={subItem.href}
                                                className={cn(
                                                    subItem.current ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-gray-300 hover:bg-white/10 hover:text-white',
                                                    'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group/subitem'
                                                )}
                                            >
                                                <subItem.icon className={cn(
                                                    "h-4 w-4 shrink-0 transition-transform duration-300",
                                                    !subItem.current && "group-hover/subitem:scale-125 group-hover/subitem:text-blue-400"
                                                )} />
                                                <span className="text-[11px] font-bold truncate tracking-wide">{subItem.name}</span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                /* Regular Accordion (When expanded) */
                                configOpen && (
                                    <div className="ml-4 pl-4 border-l border-gray-800/50 pt-1 space-y-1">
                                        {configSubItems.map((subItem) => (
                                            <Link
                                                key={subItem.name}
                                                to={subItem.href}
                                                className={cn(
                                                    subItem.current ? 'text-blue-400 bg-blue-500/5 shadow-sm' : 'text-gray-500 hover:text-gray-300 hover:bg-[#1e293b]/50',
                                                    'group flex items-center rounded-lg transition-all duration-200 px-3 py-2 text-xs font-bold'
                                                )}
                                            >
                                                <subItem.icon className={cn(
                                                    subItem.current ? 'text-blue-400' : 'text-gray-600 group-hover:text-gray-300',
                                                    "h-4 w-4 mr-3"
                                                )} />
                                                <span className="truncate">{subItem.name}</span>
                                            </Link>
                                        ))}
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </nav>
            </div>


            {/* Footer */}
            <div className="flex-shrink-0 flex border-t border-[#1e293b] p-4 flex-col gap-3 bg-[#0f172a]">
                {!isCollapsed && <LanguageSwitcher />}

                <div
                    className={cn(
                        "flex items-center w-full rounded-xl transition-all hover:bg-red-500/10 cursor-pointer group/logout relative",
                        isCollapsed ? "justify-center p-3" : "p-3 bg-[#1e293b]/40 border border-gray-800/50 shadow-inner"
                    )}
                    onClick={signOut}
                >
                    <div className="flex items-center min-w-0">
                        <LogOut className={cn(
                            "h-5 w-5 transition-colors shrink-0",
                            isCollapsed ? "text-gray-400 group-hover/logout:text-red-500" : "text-gray-500 group-hover/logout:text-red-400"
                        )} />
                        {!isCollapsed ? (
                            <div className="ml-3 min-w-0">
                                <p className="text-[11px] font-black text-gray-200 truncate leading-none mb-1">
                                    {company?.name || profile?.email?.split('@')[0]}
                                </p>
                                <p className="text-[9px] font-black text-gray-500 group-hover/logout:text-red-400/80 uppercase tracking-widest transition-colors">
                                    {t('sidebar.signOut')}
                                </p>
                            </div>
                        ) : (
                            /* Premium Dark Sign Out Tooltip */
                            <div className="absolute left-full ml-4 px-3.5 py-2.5 bg-red-600/95 backdrop-blur-xl text-white text-[11px] font-bold rounded-xl shadow-[0_10px_30px_rgba(220,38,38,0.3)] opacity-0 group-hover/logout:opacity-100 pointer-events-none transition-all duration-300 translate-x-[-12px] group-hover/logout:translate-x-0 z-[100] whitespace-nowrap border border-white/20">
                                <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-red-600 rotate-45 border-l border-b border-white/10" />
                                <div className="flex items-center gap-2">
                                    <LogOut className="w-3.5 h-3.5" />
                                    {t('sidebar.signOut')}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
