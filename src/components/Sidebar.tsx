import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { LayoutDashboard, Users, Calendar, Building, LogOut, ShieldCheck, FileText, Settings, ChevronDown, ChevronRight, Package, Layers, Building2, Megaphone, MessageSquare, CreditCard, ChevronLeft, Zap, Search, Bot, XCircle, Network, BarChart3, UserCircle, Headset, TicketIcon, AlertTriangle, UserCheck, BookOpen, PhoneCall, Sparkles, Brain, Target, Globe } from 'lucide-react';
import { cn } from '../lib/utils';
import { LanguageSwitcher } from './LanguageSwitcher';
import { brandingService } from '../services/branding';
import { supabase } from '../services/supabase';
import type { Company } from '../types';
import toast from 'react-hot-toast';

export default function Sidebar({ isCollapsed, onToggle }: { isCollapsed: boolean, onToggle: () => void }) {
    const { profile, signOut, setSimulatedCompanyId, setSimulatedRole, simulatedCompanyId, revertSimulation } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const { t } = useTranslation();

    interface NavItem {
        id?: string;
        name: string;
        href: string;
        icon: any;
        current: boolean;
        subItems?: { name: string; href: string; icon: any; badge?: number }[];
    }
    const isCallBotEnabled = import.meta.env.VITE_SHOW_CALL_BOT === 'true';
    const configPaths = ['/company/billing', '/company/branding', '/company/integrations', '/catalogo', '/financial-rules', '/loss-reasons', '/industries', '/admin/call-bot'];
    const marketingPaths = ['/marketing', '/marketing/email', '/marketing/lead-hunter', '/marketing/ai-agents', '/marketing/settings', '/marketing/cockpit', '/marketing/engine-config', '/marketing/predictions'];
    const socialPaths = ['/marketing/social', '/marketing/flyers', '/company/social-accounts'];
    const teamPaths = ['/company/team', '/company/teams', '/company/performance'];
    const [configOpen, setConfigOpen] = useState(configPaths.some(path => location.pathname === path));

    // Only one accordion open at a time
    const getInitialAccordion = () => {
        if (socialPaths.some(path => location.pathname.startsWith(path) || location.pathname === path)) return 'social';
        if (marketingPaths.some(path => location.pathname.startsWith(path) && !location.pathname.startsWith('/marketing/chat'))) return 'marketing';
        if (location.pathname.startsWith('/support')) return 'service_hub';
        if (teamPaths.some(path => location.pathname.startsWith(path))) return 'team';
        if (location.pathname.startsWith('/leads')) return 'leads';
        return null;
    };
    const [openAccordion, setOpenAccordion] = useState<string | null>(getInitialAccordion());
    const [company, setCompany] = useState<Company | null>(null);
    const [debugOpen, setDebugOpen] = useState(false);
    const [hotLeadCount, setHotLeadCount] = useState(0);
    const [companiesList, setCompaniesList] = useState<Company[]>([]);
    const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);

    useEffect(() => {
        const isEligible = profile?.id === 'c9c01b04-4160-4e4c-9718-15298c961e9b' || 
                           profile?.id === '292bc954-0d25-4147-9526-b7a7268be8e1' || 
                           profile?.email?.toLowerCase() === 'jarias7604@gmail.com' || 
                           profile?.email?.toLowerCase() === 'jarias@ariasdefense.com';
        if (isEligible) {
            loadAllCompanies();
        }
    }, [profile]);

    const loadAllCompanies = async () => {
        try {
            const { data, error } = await supabase
                .from('companies')
                .select('id, name')
                .order('name');
            if (error) throw error;
            if (data) setCompaniesList(data as Company[]);
        } catch (err) {
            console.error('Error loading companies for sidebar selector:', err);
        }
    };

    const [workspaces, setWorkspaces] = useState<Company[]>([]);

    useEffect(() => {
        if (profile?.company_id && (profile?.role === 'company_admin' || profile?.role === 'super_admin')) {
            loadWorkspaces();
        }
    }, [profile?.company_id, profile?.role]);

    // Listen for child company creations/deletions/updates to refresh workspace selector in real-time
    useEffect(() => {
        const handleRefreshWorkspaces = () => loadWorkspaces();
        window.addEventListener('refresh-workspaces', handleRefreshWorkspaces);
        return () => window.removeEventListener('refresh-workspaces', handleRefreshWorkspaces);
    }, [profile?.company_id]);

    const loadWorkspaces = async () => {
        try {
            let parentId = profile?.company_id;
            if (!parentId) return;

            const { data: currentComp } = await supabase
                .from('companies')
                .select('id, parent_company_id')
                .eq('id', parentId)
                .single();

            if (currentComp?.parent_company_id) {
                parentId = currentComp.parent_company_id;
            }

            const { data, error } = await supabase
                .from('companies')
                .select('id, name, logo_url, parent_company_id')
                .or(`id.eq.${parentId},parent_company_id.eq.${parentId}`)
                .order('name');

            if (error) throw error;
            if (data) setWorkspaces(data as unknown as Company[]);
        } catch (err) {
            console.error('Error loading workspaces:', err);
        }
    };


    useEffect(() => {
        if (profile?.company_id) {
            loadCompany();
        } else if (profile?.role === 'super_admin' && !simulatedCompanyId) {
            setCompany({ name: 'System Administration' } as Company);
        }
    }, [profile?.company_id, profile?.role, simulatedCompanyId]);

    // ≡ƒöÑ Poll hot leads (cierre_inminente) every 60s for sidebar badge
    useEffect(() => {
        if (!profile?.company_id) return;
        const fetchHotLeads = async () => {
            try {
                const { count } = await supabase
                    .from('lead_ai_memory')
                    .select('id', { count: 'exact', head: true })
                    .eq('company_id', profile.company_id)
                    .eq('next_action', 'cierre_inminente');
                setHotLeadCount(count || 0);
            } catch { /* silently ignore */ }
        };
        fetchHotLeads();
        const interval = setInterval(fetchHotLeads, 60000);
        return () => clearInterval(interval);
    }, [profile?.company_id]);

    // ≡ƒôà Fetch trial days remaining (only for company_admin on trial companies)
    useEffect(() => {
        if (!profile?.company_id) return;
        // Super admins and platform owners always have full access ΓÇö skip trial logic
        if (profile?.role === 'super_admin' || (profile as any)?.is_platform_owner) {
            setTrialDaysLeft(null);
            return;
        }
        const fetchTrial = async () => {
            try {
                const { data } = await supabase
                    .from('company_subscriptions')
                    .select('status, trial_ends_at')
                    .eq('company_id', profile.company_id)
                    .single();
                if (data?.status === 'trialing' && data?.trial_ends_at) {
                    const days = Math.max(0, Math.ceil(
                        (new Date(data.trial_ends_at).getTime() - Date.now()) / 86400000
                    ));
                    setTrialDaysLeft(days);
                } else {
                    setTrialDaysLeft(null);
                }
            } catch { /* silent */ }
        };
        fetchTrial();
    }, [profile?.company_id]);

    // Reload branding when wizard or branding page saves changes
    useEffect(() => {
        const handleBrandingUpdate = () => loadCompany();
        window.addEventListener('company-branding-updated', handleBrandingUpdate);
        return () => window.removeEventListener('company-branding-updated', handleBrandingUpdate);
    }, [simulatedCompanyId, profile?.company_id]);

    const loadCompany = async () => {
        try {
            // SECURITY: Only apply simulatedCompanyId when the user is super_admin.
            // If simulatedCompanyId is in localStorage from a previous super_admin session,
            // a company_admin must NEVER inherit it ΓÇö always use their own profile.company_id.
            const isSuperAdmin = profile?.role === 'super_admin';
            const effectiveCompanyId = (isSuperAdmin && simulatedCompanyId) 
                ? simulatedCompanyId 
                : profile?.company_id;

            if (!effectiveCompanyId) return;

            const { data, error } = await supabase
                .from('companies')
                .select('*')
                .eq('id', effectiveCompanyId)
                .single();

            if (error) throw error;
            if (data) setCompany(data as Company);
        } catch (error) {
            console.error('Error loading company branding for sidebar:', error);
        }
    };

    // --- PERMISSION LOGIC ---
    const canAccess = (key: string) => {
        if (!profile) return false;
        // console.log(`≡ƒöì Sidebar Check: ${key} = ${profile.permissions?.[key]}`);
        return profile.permissions?.[key] === true;
    };

    const isSuperOrAdmin = profile?.role === 'super_admin' || profile?.role === 'company_admin';

    const navigation: NavItem[] = [
        { name: t('sidebar.dashboard'), href: '/dashboard', icon: LayoutDashboard, current: location.pathname === '/' || location.pathname === '/dashboard' }
    ];

    if (canAccess('leads') || profile?.role === 'super_admin') {
        navigation.push({
            id: 'leads',
            name: t('sidebar.leads'),
            href: '/leads',
            icon: Users,
            current: location.pathname.startsWith('/leads'),
            subItems: [
                { name: t('sidebar.allLeads'), href: '/leads', icon: Users },
                {
                    name: t('sidebar.readyToBuy'),
                    href: '/leads',
                    icon: Target,
                    badge: hotLeadCount,
                    onClick: () => navigate('/leads?ready=1')
                } as any,
            ]
        });
    }

    if (canAccess('clientes') || profile?.role === 'super_admin') {
        navigation.push({ name: t('sidebar.clients'), href: '/clientes', icon: UserCheck, current: location.pathname.startsWith('/clientes') });
    }

    if (canAccess('proyectos') || profile?.role === 'super_admin') {
        navigation.push({ name: t('sidebar.projects'), href: '/proyectos', icon: Layers, current: location.pathname.startsWith('/proyectos') });
    }

    if (canAccess('quotes') || profile?.role === 'super_admin') {
        navigation.push({ name: t('sidebar.quotes'), href: '/cotizaciones', icon: FileText, current: location.pathname === '/cotizaciones' });
    }

    if (profile?.role === 'super_admin') {
        navigation.push({ name: t('sidebar.billing'), href: '/company/billing', icon: CreditCard, current: location.pathname.startsWith('/company/billing') });
    }

    if (canAccess('finanzas') || profile?.role === 'super_admin') { 
        navigation.push({ name: t('sidebar.finances'), href: '/finanzas', icon: CreditCard, current: location.pathname.startsWith('/finanzas') });
    }

    if (canAccess('calendar') || profile?.role === 'super_admin') {
        const calendarSubItems: any[] = [
            { name: t('sidebar.calendar'), href: '/calendar', icon: Calendar },
        ];
        if (profile?.role === 'super_admin' || profile?.role === 'company_admin') {
            calendarSubItems.push({ name: t('sidebar.myAgenda'), href: '/calendar/booking', icon: BookOpen });
        }
        navigation.push({
            id: 'calendar',
            name: t('sidebar.calendar'),
            href: '/calendar',
            icon: Calendar,
            current: location.pathname.startsWith('/calendar'),
            subItems: calendarSubItems
        });
    }

    if (canAccess('dashboard_full') || canAccess('reports') || profile?.role === 'super_admin') {
        navigation.push({ name: t('sidebar.reportsBi'), href: '/reports', icon: BarChart3, current: location.pathname.startsWith('/reports') });
    }

    if (canAccess('tickets') || profile?.role === 'super_admin') {
        // Support Platform
        navigation.push({
            id: 'service_hub',
            name: t('sidebar.serviceHub'),
            href: '/support/tickets',
            icon: Headset,
            current: location.pathname.startsWith('/support'),
            subItems: [
                { name: t('sidebar.tickets'), href: '/support/tickets', icon: TicketIcon },
                { name: t('sidebar.overdue'), href: '/support/atrasados', icon: AlertTriangle },
                { name: t('sidebar.manualCrm'), href: '/support/manual', icon: BookOpen },
            ]
        });
    }

    if (canAccess('marketing')) {
        navigation.push({
            id: 'marketing',
            name: t('sidebar.marketingHub'),
            href: '/marketing',
            icon: Megaphone,
            current: location.pathname.startsWith('/marketing') && !location.pathname.startsWith('/marketing/chat') && !socialPaths.some(p => location.pathname.startsWith(p)),
            subItems: [
                { name: t('sidebar.dashboard'), href: '/marketing', icon: LayoutDashboard },
                { name: t('sidebar.campaigns'), href: '/marketing/email', icon: Zap },
                { name: t('sidebar.leadHunter'), href: '/marketing/lead-hunter', icon: Search },
                { name: t('sidebar.aiAgents'), href: '/marketing/ai-agents', icon: Bot },
                { name: t('sidebar.cockpitAi'), href: '/marketing/cockpit', icon: Brain, badge: hotLeadCount },
                { name: t('sidebar.oracleAi'), href: '/marketing/predictions', icon: Target },
                { name: t('sidebar.salesEngine'), href: '/marketing/engine-config', icon: Zap },
                { name: t('sidebar.settings'), href: '/marketing/settings', icon: Settings },
            ]
        });

        navigation.push({
            id: 'social',
            name: t('sidebar.socialMediaHub') || 'Social Media Hub',
            href: '/marketing/social',
            icon: Globe,
            current: socialPaths.some(path => location.pathname.startsWith(path) || location.pathname === path),
            subItems: [
                { name: t('sidebar.socialDashboard') || 'Panel de Publicaci├│n', href: '/marketing/social', icon: LayoutDashboard },
                { name: t('sidebar.flyerStudio'), href: '/marketing/flyers', icon: Sparkles },
                { name: t('sidebar.connectedAccounts') || 'Cuentas Conectadas', href: '/company/social-accounts', icon: Network },
            ]
        });
    }

    if (canAccess('chat')) {
        navigation.push({
            name: t('sidebar.messages'),
            href: '/marketing/chat',
            icon: MessageSquare,
            current: location.pathname.startsWith('/marketing/chat')
        });
    }

    const configSubItemsRaw = [
        { name: t('sidebar.companyBrand'), href: '/company/branding', icon: Building, current: location.pathname === '/company/branding', permissionKey: 'branding' },
        { name: t('sidebar.integrations'), href: '/company/integrations', icon: Network, current: location.pathname.startsWith('/company/integrations'), permissionKey: 'branding' },
        { name: t('sidebar.workspaces'), href: '/company/workspaces', icon: Building2, current: location.pathname === '/company/workspaces', permissionKey: 'pipeline.admin' },
        { name: t('sidebar.clientPipeline'), href: '/admin/pipeline', icon: UserCheck, current: location.pathname === '/admin/pipeline', permissionKey: 'pipeline.admin' },
        { name: t('sidebar.productCatalog'), href: '/catalogo', icon: Package, current: location.pathname === '/catalogo', permissionKey: 'pricing' },
        { name: t('sidebar.financialManagement'), href: '/financial-rules', icon: CreditCard, current: location.pathname === '/financial-rules', permissionKey: 'financial_rules' },
        { name: t('sidebar.lossReasons'), href: '/loss-reasons', icon: XCircle, current: location.pathname === '/loss-reasons', permissionKey: 'loss_reasons' },
        { name: t('sidebar.industries'), href: '/industries', icon: Building2, current: location.pathname === '/industries', permissionKey: 'loss_reasons' },
        { name: t('sidebar.callBotAi'), href: '/admin/call-bot', icon: PhoneCall, current: location.pathname === '/admin/call-bot', permissionKey: 'pipeline.admin', proOnly: true },
    ];


    const configSubItems = configSubItemsRaw.filter(item => {
        // Ocultar m├│dulos devOnly en producci├│n
        if ((item as any).devOnly && !isCallBotEnabled) return false;
        // Ocultar m├│dulos proOnly para empresas en trial
        if ((item as any).proOnly && trialDaysLeft !== null && profile?.role !== 'super_admin') return false;
        // Branding siempre visible para company_admin (necesitan cambiar nombre/logo)
        if (item.permissionKey === 'branding' && (profile?.role === 'company_admin' || profile?.role === 'super_admin')) return true;
        return canAccess(item.permissionKey!) || (isSuperOrAdmin && item.permissionKey === 'pipeline.admin');
    });


    if (profile?.role === 'super_admin') {
        navigation.push({ name: t('sidebar.observatory'), href: '/admin/observatory', icon: Sparkles, current: location.pathname.startsWith('/admin/observatory') });
        navigation.push({ name: t('sidebar.companies'), href: '/admin/companies', icon: Building, current: location.pathname.startsWith('/admin/companies') });
        navigation.push({ name: t('sidebar.saasPlans'), href: '/admin/plans', icon: Package, current: location.pathname.startsWith('/admin/plans') });
        navigation.push({ name: t('sidebar.saasBilling'), href: '/admin/billing', icon: CreditCard, current: location.pathname.startsWith('/admin/billing') });
        navigation.push({ name: t('sidebar.audit'), href: '/admin/audit-log', icon: ShieldCheck, current: location.pathname.startsWith('/admin/audit-log') });
    }

    if (profile?.role === 'super_admin' || profile?.role === 'company_admin') {
        navigation.push({
            id: 'team',
            name: t('sidebar.team'),
            href: '/company/team',
            icon: Users,
            current: location.pathname.startsWith('/company/team') || location.pathname.startsWith('/company/teams') || location.pathname.startsWith('/company/performance'),
            subItems: [
                { name: t('sidebar.members'), href: '/company/team', icon: UserCircle },
                { name: t('sidebar.structure'), href: '/company/teams', icon: Network },
                { name: t('sidebar.performance'), href: '/company/performance', icon: BarChart3 },
            ]
        });
        navigation.push({ name: t('sidebar.permissions'), href: '/company/permissions', icon: ShieldCheck, current: location.pathname.startsWith('/company/permissions') });
    }

    const getRoleTitle = () => {
        if (profile?.role === 'super_admin') return t('roles.superAdmin');
        if (profile?.role === 'company_admin') return t('roles.companyAdmin');
        if (profile?.role === 'collaborator') return t('roles.collaborator');
        return t('roles.user');
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
                                    onClick={revertSimulation}
                                    className="text-[8px] font-black text-amber-500/60 hover:text-amber-500 uppercase tracking-[0.2em] transition-all"
                                >
                                    [ Revertir Maestro ]
                                </button>
                            )}
                        </div>

                        <div className="mt-2 w-full px-2">
                            <button
                                onClick={() => setDebugOpen(!debugOpen)}
                                className="w-full flex items-center justify-between p-1.5 bg-black/20 rounded-lg border border-white/5 hover:bg-white/5 transition-colors group mb-2"
                            >
                                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest group-hover:text-gray-300">Debugger</span>
                                {debugOpen ? <ChevronDown className="w-3 h-3 text-gray-500" /> : <ChevronRight className="w-3 h-3 text-gray-500" />}
                            </button>

                            {debugOpen && (
                                <div className="mb-2 bg-black/20 rounded-lg p-2 border border-white/5 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="grid grid-cols-2 gap-1 text-[7px] font-mono text-gray-400">
                                        <span className="opacity-50">ROLE:</span>
                                        <span className="text-blue-400 truncate">{profile?.role}</span>
                                        <span className="opacity-50">COMP:</span>
                                        <span className="text-amber-400 truncate">{profile?.company_id?.substring(0, 8)}...</span>
                                        <span className="opacity-50">LS_R:</span>
                                        <span className="text-emerald-400 truncate">{localStorage.getItem('simulated_role') || 'none'}</span>
                                    </div>
                                    <div className="mt-2 border-t border-white/5 pt-1">
                                        <p className="text-[6px] text-gray-500 uppercase tracking-tighter mb-0.5 font-black">Active Perms (Debug):</p>
                                        <div className="text-[6px] text-gray-400 font-mono leading-tight break-words">
                                            {Object.keys(profile?.permissions || {}).filter(k => profile?.permissions?.[k]).join(', ')}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <select
                                className="w-full bg-[#1e293b]/50 border border-gray-800 shadow-inner rounded-lg px-2 py-1.5 text-[10px] font-bold text-gray-300 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all cursor-pointer hover:bg-[#1e293b]"
                                value={profile?.company_id || ''}
                                onChange={(e) => {
                                    setSimulatedCompanyId(e.target.value || null);
                                }}
                            >
                                <option value="">Contexto Global</option>
                                {companiesList.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>

                            <select
                                className="w-full bg-[#1e293b]/50 border border-gray-800 shadow-inner rounded-lg px-2 py-1.5 text-[10px] font-bold text-gray-300 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all cursor-pointer hover:bg-[#1e293b]"
                                value={localStorage.getItem('simulated_role') || 'super_admin'}
                                onChange={(e) => setSimulatedRole(e.target.value as any)}
                            >
                                <option value="super_admin">Rol: Super Admin</option>
                                <option value="company_admin">Rol: Administrador Empr.</option>
                                <option value="collaborator">Rol: Agente de Ventas</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Workspace Switcher */}
            {!isCollapsed && workspaces.length > 1 && (
                <div className="px-4 py-3 border-b border-[#1e293b] bg-black/10">
                    <label className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                        Workspace Activo
                    </label>
                    <div className="relative">
                        <select
                            className="w-full bg-[#1e293b]/70 border border-gray-800 rounded-xl px-3 py-2 text-xs font-black text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all cursor-pointer hover:bg-[#1e293b] appearance-none"
                            value={profile?.company_id || ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === profile?.company_id) return;
                                setSimulatedCompanyId(val || null);
                                window.dispatchEvent(new CustomEvent('company-changed', { detail: val }));
                                toast.success('Workspace cambiado correctamente');
                            }}
                        >
                            {workspaces.map(w => (
                                <option key={w.id} value={w.id} className="bg-[#0f172a] text-white font-bold py-2">
                                    {w.parent_company_id ? `≡ƒÅó ${w.name}` : `≡ƒææ ${w.name} (Principal)`}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                            <ChevronDown className="w-3.5 h-3.5" />
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation */}
            <div className={cn(
                "flex-1 flex flex-col pt-6 px-3 custom-scrollbar",
                isCollapsed ? "overflow-visible" : "overflow-y-auto"
            )}>
                <nav className="flex-1 space-y-1.5 focus:outline-none">
                    {/* OMNI SEARCH BUTTON */}
                    <button
                        onClick={() => window.dispatchEvent(new CustomEvent('open-global-search'))}
                        className={cn(
                            'group flex items-center justify-between rounded-xl transition-all duration-200 focus:outline-none mb-4 w-full bg-[#1e293b]/50 border border-gray-800 hover:bg-[#1e293b] hover:border-gray-700',
                            isCollapsed ? "p-3" : "px-4 py-2.5"
                        )}
                        title={`${t('sidebar.omniSearch')} (Cmd+K)`}
                    >
                        <div className="flex items-center text-gray-400 group-hover:text-white transition-colors">
                            <Search className={cn("h-5 w-5 shrink-0 transition-colors", !isCollapsed && "mr-3")} />
                            {!isCollapsed && <span className="text-xs font-bold tracking-wide">{t('sidebar.omniSearch')}</span>}
                        </div>
                        {!isCollapsed && (
                            <div className="flex items-center gap-1">
                                <kbd className="bg-black/50 border border-white/10 rounded px-1.5 py-0.5 text-[9px] font-mono text-gray-500 group-hover:text-gray-400">Γîÿ</kbd>
                                <kbd className="bg-black/50 border border-white/10 rounded px-1.5 py-0.5 text-[9px] font-mono text-gray-500 group-hover:text-gray-400">K</kbd>
                            </div>
                        )}
                    </button>

                    {navigation.map((item) => (
                        <div key={item.name} className="space-y-1">
                            {item.subItems && !isCollapsed ? (
                                <>
                                    <button
                                        onClick={() => setOpenAccordion(openAccordion === item.id ? null : item.id!)}
                                        className={cn(
                                            item.current ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-gray-400 hover:bg-[#1e293b] hover:text-white',
                                            'group flex items-center justify-between w-full rounded-xl transition-all duration-200 focus:outline-none p-3 px-4'
                                        )}
                                    >
                                        <div className="flex items-center">
                                            <item.icon className={cn(
                                                item.current ? 'text-white' : 'text-gray-400 group-hover:text-white',
                                                "h-5 w-5 transition-colors shrink-0 mr-3"
                                            )} aria-hidden="true" />
                                            <span className="text-sm font-semibold tracking-wide truncate">{item.name}</span>
                                        </div>
                                        {openAccordion === item.id ? <ChevronDown className="h-4 w-4 opacity-50" /> : <ChevronRight className="h-4 w-4 opacity-50" />}
                                    </button>
                                    {openAccordion === item.id && (
                                    <div className="ml-4 pl-4 border-l border-gray-800/50 pt-1 space-y-1">
                                            {item.subItems.map((sub) => {
                                                const isActive = location.pathname === sub.href && !(sub as any).onClick;
                                                const baseClass = cn(
                                                    isActive ? 'text-blue-400 bg-blue-500/5' : 'text-gray-500 hover:text-gray-300 hover:bg-[#1e293b]/50',
                                                    'group flex items-center justify-between rounded-lg transition-all duration-200 px-3 py-2 text-xs font-bold w-full text-left'
                                                );
                                                const inner = (
                                                    <>
                                                        <div className="flex items-center">
                                                            <sub.icon className={cn(isActive ? 'text-blue-400' : 'text-gray-600 group-hover:text-gray-300', "h-4 w-4 mr-3")} />
                                                            <span className="truncate">{sub.name}</span>
                                                        </div>
                                                        {sub.badge != null && sub.badge > 0 && (
                                                            <span className="ml-2 shrink-0 bg-emerald-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center animate-pulse shadow-sm shadow-emerald-500/50">
                                                                {sub.badge}
                                                            </span>
                                                        )}
                                                    </>
                                                );
                                                return (sub as any).onClick ? (
                                                    <button key={sub.name} onClick={(sub as any).onClick} className={baseClass}>{inner}</button>
                                                ) : (
                                                    <Link key={sub.name} to={sub.href} className={baseClass}>{inner}</Link>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <Link
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
                            )}
                        </div>
                    ))}

                    {/* ACORDEON DE CONFIGURACI├ôN / FLYOUT */}
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
                                    {!isCollapsed && <span className="text-sm font-semibold">{t('sidebar.settings')}</span>}
                                </div>
                                {!isCollapsed && (configOpen ? <ChevronDown className="h-4 w-4 opacity-50" /> : <ChevronRight className="h-4 w-4 opacity-50" />)}
                            </button>

                            {/* Flyout Menu (Only when collapsed) */}
                            {isCollapsed ? (
                                <div className="absolute left-full bottom-0 ml-1 w-56 bg-[#0f172a]/95 backdrop-blur-2xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 opacity-0 group-hover/config:opacity-100 pointer-events-none group-hover/config:pointer-events-auto transition-all duration-300 translate-x-[-12px] group-hover/config:translate-x-0 z-[100] overflow-hidden mb-[-8px]">
                                    {/* Invisible Hover Bridge */}
                                    <div className="absolute left-[-40px] top-[-100px] w-[40px] h-[300px]" />

                                    <div className="bg-gradient-to-r from-blue-600/20 to-indigo-600/20 px-4 py-3 border-b border-white/5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">{t('sidebar.settings')}</span>
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

                    {/* ≡ƒöÆ Locked Pro Modules ΓÇö only for trial company_admins */}
                    {trialDaysLeft !== null && !isCollapsed && profile?.role !== 'super_admin' && !(profile as any)?.is_platform_owner && (
                        <div className="mt-4 pt-3 border-t border-[#1e293b]/60">
                            <p className="px-4 mb-2 text-[9px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-1.5">
                                <span>≡ƒöÆ</span> M├│dulos Pro
                            </p>
                            {[
                                { name: 'Marketing Hub', icon: Megaphone },
                                { name: 'Chat & Mensajes', icon: MessageSquare },
                                { name: 'AI Agents', icon: Bot },
                                { name: 'Social Media', icon: Globe },
                            ].map(item => (
                                <div
                                    key={item.name}
                                    title="Disponible en plan Pro"
                                    className="flex items-center px-4 py-2.5 rounded-xl text-gray-600 cursor-not-allowed select-none opacity-50"
                                >
                                    <item.icon className="h-5 w-5 mr-3 shrink-0" />
                                    <span className="text-sm font-semibold flex-1">{item.name}</span>
                                    <span className="text-[8px] font-black bg-amber-500/15 text-amber-500 border border-amber-500/25 px-1.5 py-0.5 rounded-full">
                                        PRO
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </nav>
            </div>

            {/* Trial Banner */}
            {trialDaysLeft !== null && !isCollapsed && profile?.role !== 'super_admin' && !(profile as any)?.is_platform_owner && (
                <div className="mx-3 mb-2 p-3 bg-gradient-to-br from-amber-500/10 to-orange-600/10 border border-amber-500/20 rounded-xl">
                    <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />
                        <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Trial Activo</span>
                    </div>
                    <p className="text-[11px] text-gray-300 leading-snug">
                        {trialDaysLeft > 0
                            ? <><span className="text-amber-400 font-black">{trialDaysLeft} d├¡as</span> restantes de prueba</>  
                            : <span className="text-red-400 font-bold">Tu trial ha expirado</span>
                        }
                    </p>
                    <Link
                        to="/company/billing"
                        className="mt-2 flex items-center justify-center gap-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 hover:text-amber-300 text-[9px] font-black uppercase tracking-widest rounded-lg py-1.5 transition-all w-full"
                    >
                        Activar Plan Pro ΓåÆ
                    </Link>
                </div>
            )}

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
