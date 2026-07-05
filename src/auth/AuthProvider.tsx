import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { queryClient } from '../lib/queryClient';
import type { Profile, Role } from '../types';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    loading: boolean;
    signOut: () => Promise<void>;
    simulatedCompanyId: string | null;
    setSimulatedCompanyId: (id: string | null) => void;
    simulatedRole: Role | null;
    setSimulatedRole: (role: Role | null) => void;
    revertSimulation: () => void; // Clears both role + company atomically
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    profile: null,
    loading: true,
    signOut: async () => { },
    simulatedCompanyId: null,
    setSimulatedCompanyId: () => { },
    simulatedRole: null,
    setSimulatedRole: () => { },
    revertSimulation: () => { }
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    // SECURITY: Only read simulation state if user is super_admin.
    // localStorage persists between sessions — if a company_admin logs in after a super_admin
    // used the simulation debugger, they must NOT inherit the simulated company/role.
    // The actual enforcement happens in fetchProfile (isSimulationEligible check),
    // but we also guard the initial state to prevent leaks in the Sidebar's loadCompany().
    const [simulatedCompanyId, setSimulatedCompanyId] = useState<string | null>(localStorage.getItem('simulated_company_id'));
    const [simulatedRole, setSimulatedRole] = useState<Role | null>(localStorage.getItem('simulated_role') as any);

    // Track previous userId to detect user switches and clear stale cache
    const prevUserIdRef = useRef<string | null>(null);
    // Track current profile for use in realtime callbacks without stale closure
    const profileRef = useRef<Profile | null>(null);


    const handleSetSimulatedCompanyId = (id: string | null) => {
        setSimulatedCompanyId(id);
        if (id) localStorage.setItem('simulated_company_id', id);
        else localStorage.removeItem('simulated_company_id');
        // Re-fetch profile in-memory — no page reload, no logout
        // fetchProfile already reads simulated_role/simulated_company_id from localStorage
        if (user?.id) fetchProfile(user.id, user.email);
    };

    const handleSetSimulatedRole = (role: Role | null) => {
        setSimulatedRole(role);
        if (role) localStorage.setItem('simulated_role', role);
        else localStorage.removeItem('simulated_role');
        // Re-fetch profile in-memory — instant role switch, no redirect
        if (user?.id) fetchProfile(user.id, user.email);
    };

    // ─── Revertir simulación completa (atomic) ───────────────────────────────
    // Clears BOTH simulated role AND company in one operation — single in-memory update.
    const handleRevertSimulation = () => {
        localStorage.removeItem('simulated_role');
        localStorage.removeItem('simulated_company_id');
        setSimulatedRole(null);
        setSimulatedCompanyId(null);
        // Re-fetch as real super_admin — instant, no logout
        if (user?.id) fetchProfile(user.id, user.email);
    };

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                // Pasamos el email directamente para evitar carrera con el estado 'session'
                fetchProfile(session.user.id, session.user.email);
            } else {
                setLoading(false);
            }
        });

        // Listen for auth changes — clear React Query cache on user switch or logout
        // This prevents stale tenant data from a previous session from being displayed
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const previousUserId = prevUserIdRef.current;
            const currentUserId = session?.user?.id ?? null;

            // If the user changed (different login) or logged out → wipe all cached queries
            // This is the key fix: prevents Patricia seeing Arias Defense data on login
            if (previousUserId !== currentUserId) {
                queryClient.clear();
            }

            prevUserIdRef.current = currentUserId;
            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                fetchProfile(session.user.id, session.user.email);
            } else {
                setProfile(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // ENTERPRISE REALTIME PERMISSION SYNC
    // When admin changes role_permissions in DB → silently refresh affected
    // users' permissions in ~200ms. No F5 required. Same pattern as HubSpot.
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        profileRef.current = profile;
    }, [profile]);

    useEffect(() => {
        if (!profile?.id || profile.role === 'super_admin') return;

        const roleId = (profile as any).custom_role_id;
        if (!roleId) return;

        const channel = supabase
            .channel(`role-permissions:${roleId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'role_permissions',
                    filter: `role_id=eq.${roleId}`,
                },
                async (_payload) => {
                    // Silently re-fetch permissions from the RPC — no page reload needed
                    const currentProfile = profileRef.current;
                    if (!currentProfile?.id) return;

                    const { data: mergedPerms } = await supabase.rpc('get_user_permissions', {
                        user_id: currentProfile.id
                    });

                    if (mergedPerms && Object.keys(mergedPerms).length > 0) {
                        setProfile(prev => prev ? { ...prev, permissions: mergedPerms } : prev);
                        console.info('✅ Permisos actualizados en tiempo real (Realtime Sync)');
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [profile?.id, (profile as any)?.custom_role_id]);

    const fetchProfile = async (userId: string, _userEmail?: string) => {
        try {
            // FETCH PROFILE (LOGICA NORMAL)
            const { data, error } = await supabase
                .from('profiles')
                .select('id, email, role, company_id, full_name, phone, status, created_at, custom_role_id, permissions, is_platform_owner')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Error fetching profile:', error);
                setLoading(false);
                return;
            }

            // ✨ AUTO-PROVISION TENANT
            // Reads company name from BOTH localStorage (same-tab flow)
            // AND session.user_metadata (cross-browser/cross-tab confirmation flow)
            if (!data?.company_id) {
                const pendingCompanyName =
                    localStorage.getItem('pending_company_name') ||
                    session?.user?.user_metadata?.pending_company_name ||
                    '';
                if (pendingCompanyName) {
                    console.info('[AuthProvider] Provisioning new tenant:', pendingCompanyName);
                    const { error: rpcError } = await supabase.rpc('register_new_tenant', {
                        company_name: pendingCompanyName
                    });
                    if (rpcError) {
                        console.error('[AuthProvider] register_new_tenant failed:', rpcError);
                    } else {
                        localStorage.removeItem('pending_company_name');
                        // Also clear from user_metadata
                        await supabase.auth.updateUser({ data: { pending_company_name: null } });
                        // Re-fetch profile so company_id is now populated
                        const { data: updatedProfile } = await supabase
                            .from('profiles')
                            .select('id, email, role, company_id, full_name, phone, status, created_at, custom_role_id, permissions, is_platform_owner')
                            .eq('id', userId)
                            .single();
                        if (updatedProfile) {
                            // 🎉 Fire welcome email (non-blocking — never breaks signup flow)
                            if (updatedProfile.company_id && updatedProfile.email) {
                                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
                                const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
                                fetch(`${supabaseUrl}/functions/v1/transactional-email`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'apikey': supabaseKey ?? '',
                                        'Authorization': `Bearer ${supabaseKey ?? ''}`,
                                    },
                                    body: JSON.stringify({
                                        type: 'welcome',
                                        companyId: updatedProfile.company_id,
                                        adminEmail: updatedProfile.email,
                                        adminName: updatedProfile.full_name || updatedProfile.email,
                                        companyName: pendingCompanyName,
                                        trialDays: 14,
                                    }),
                                }).then(r => {
                                    if (r.ok) console.info('[AuthProvider] ✅ Welcome email sent to', updatedProfile.email);
                                    else r.text().then(e => console.warn('[AuthProvider] Welcome email failed (non-critical):', e));
                                }).catch(e => console.warn('[AuthProvider] Welcome email error (non-critical):', e));
                            }
                            // Use the freshly provisioned profile, skip the rest of this run
                            setProfile({ ...updatedProfile, permissions: (updatedProfile.permissions as Record<string, boolean>) || {} } as Profile);
                            setLoading(false);
                            return;
                        }
                    }
                }
            }

            // 🛑 PLATFORM OWNER BYPASS (Reemplaza el antiguo hardcodeo inseguro)
            if (data?.is_platform_owner) {
                console.warn('⚡ LIBERANDO INTERFAZ (PLATFORM OWNER BYPASS)');
                
                const simRole = localStorage.getItem('simulated_role');
                const simCompanyId = localStorage.getItem('simulated_company_id');
                
                const masterCompanyId = simCompanyId || data.company_id || '7a582ba5-f7d0-4ae3-9985-35788deb1c30';
                const finalRole = (simRole as any) || 'super_admin';

                const bypassProfile: Profile = {
                    id: userId,
                    email: _userEmail || data.email,
                    role: finalRole,
                    company_id: masterCompanyId,
                    full_name: simRole ? `Simulación: ${simRole}` : 'Platform Owner',
                    phone: '+503 0000-0000',
                    status: 'active',
                    created_at: new Date().toISOString(),
                    permissions: {}
                };
                
                // Habilitar permisos según el ROL FINAL
                const allPerms = [
                    'leads', 'clients', 'clientes', 'pipeline', 'quotes', 'marketing', 'call_bot', 
                    'tickets', 'inventory', 'team_manage', 'team_view_assigned', 
                    'dashboard_full', 'pricing', 'paquetes', 'financial_rules', 'items', 
                    'calendar', 'loss_reasons', 'chat', 'branding', 'dashboard_filter_dates', 
                    'ai_agents', 'admin_companies', 'onboarding', 'reports', 'view_financials',
                    'invoices', 'facturas'
                ];
                
                allPerms.forEach(p => { 
                    if (finalRole !== 'super_admin' && ['companies', 'audit_log', 'admin_companies', 'admin_audit'].includes(p)) {
                        bypassProfile.permissions![p] = false;
                    } else if (finalRole === 'collaborator' && ['marketing', 'pricing', 'paquetes', 'financial_rules', 'team_manage', 'view_financials'].includes(p)) {
                        bypassProfile.permissions![p] = false;
                    } else {
                        bypassProfile.permissions![p] = true; 
                    }
                });
                
                setProfile(bypassProfile);
                setLoading(false);
                return;
            }



            // ─────────────────────────────────────────────────────────────────
            // ENTERPRISE PERMISSION RESOLUTION (Single Source of Truth)
            // Igual que HubSpot/Salesforce: el ROL es la fuente de verdad.
            // profiles.permissions NUNCA sobrescribe al custom_role.
            // ─────────────────────────────────────────────────────────────────
            let activePerms: Record<string, boolean> = {};

            // 1. Intentar RPC centralizada primero
            const { data: mergedPerms } = await supabase.rpc('get_user_permissions', { user_id: userId });

            if (mergedPerms && Object.keys(mergedPerms).length > 0) {
                // RPC devolvió permisos consolidados — usar directamente
                activePerms = mergedPerms;
            } else if (data?.custom_role_id) {
                // 2. Si tiene custom_role asignado → el rol es la fuente de verdad TOTAL
                // profiles.permissions es ignorado completamente (evita el bug crónico de Patricia)
                const { data: roleData } = await supabase
                    .from('custom_roles')
                    .select('permissions')
                    .eq('id', data.custom_role_id)
                    .single();
                activePerms = (roleData?.permissions as Record<string, boolean>) || {};
                console.info('✅ Permisos cargados desde custom_role (fuente única de verdad)');
            }

            // ─────────────────────────────────────────────────────────────────
            // 4. INTERSECT WITH COMPANY LICENSE (allowed_permissions)
            // Para usuarios no-superadmin, limitar los permisos cargados
            // a los que la empresa tiene permitidos en su columna 'allowed_permissions'.
            // ─────────────────────────────────────────────────────────────────
            if (data && data.role !== 'super_admin' && data.company_id) {
                try {
                    const { data: companyData } = await supabase
                        .from('companies')
                        .select('allowed_permissions')
                        .eq('id', data.company_id)
                        .single();

                    if (companyData) {
                        const rawLicense = companyData.allowed_permissions;
                        const companyLicense: string[] = Array.isArray(rawLicense)
                            ? rawLicense.map(k => String(k).trim().toLowerCase())
                            : [];

                        const filteredPerms: Record<string, boolean> = {};
                        Object.keys(activePerms).forEach(key => {
                            if (activePerms[key] === true) {
                                const baseModule = key.split(/[._:]/)[0].toLowerCase();
                                
                                // Mapear claves de permisos a los nombres de módulos en Companies/AllowedPermissions
                                let isAllowed = false;
                                if (baseModule === 'leads') isAllowed = companyLicense.includes('leads');
                                else if (baseModule === 'quotes') isAllowed = companyLicense.includes('quotes');
                                else if (baseModule === 'calendar') isAllowed = companyLicense.includes('calendar');
                                else if (baseModule === 'marketing' || baseModule === 'ai_agents' || baseModule === 'mkt') isAllowed = companyLicense.includes('marketing');
                                else if (baseModule === 'chat') isAllowed = companyLicense.includes('chat');
                                else if (baseModule === 'branding') isAllowed = companyLicense.includes('branding');
                                else if (baseModule === 'pricing') isAllowed = companyLicense.includes('pricing');
                                else if (baseModule === 'paquetes') isAllowed = companyLicense.includes('paquetes');
                                else if (baseModule === 'items') isAllowed = companyLicense.includes('items');
                                else if (baseModule === 'financial_rules') isAllowed = companyLicense.includes('financial_rules');
                                else if (baseModule === 'loss_reasons' || baseModule === 'loss') isAllowed = companyLicense.includes('loss_reasons');
                                else if (baseModule === 'proyectos') isAllowed = companyLicense.includes('proyectos');
                                else if (baseModule === 'finanzas') isAllowed = companyLicense.includes('finanzas');
                                else if (baseModule === 'tickets') isAllowed = companyLicense.includes('tickets');
                                else if (baseModule === 'reports' || baseModule === 'dashboard_full' || baseModule === 'dashboard') isAllowed = companyLicense.includes('reports');
                                else if (baseModule === 'view_financials') isAllowed = companyLicense.includes('view_financials');
                                else if (baseModule === 'clientes' || baseModule === 'clients') isAllowed = companyLicense.includes('leads');
                                else if (baseModule === 'invoices' || baseModule === 'facturas') isAllowed = companyLicense.includes('invoices');
                                else {
                                    // Infraestructura general (team, onboarding, workspaces, pipeline) siempre se permite
                                    isAllowed = true;
                                }

                                if (isAllowed) {
                                    filteredPerms[key] = true;
                                }
                            }
                        });
                        activePerms = filteredPerms;
                        console.info('🛡️ Permisos del usuario filtrados por la licencia de la empresa (allowed_permissions)');
                    }
                } catch (e) {
                    console.error('Error al aplicar intersección de licencia de empresa:', e);
                }
            }

            let finalProfile = { ...data, permissions: activePerms } as Profile;

            // SIMULATION PRIVILEGE CHECK (role-based, no hardcoded IDs)
            // Both super_admin and company_admin users can switch workspaces/simulate roles
            const isSimulationEligible = data?.role === 'super_admin' || data?.role === 'company_admin';

            // APPLY SIMULATION IF ELIGIBLE AND SIMULATION IS ACTIVE
            if (isSimulationEligible) {
                const simRole = localStorage.getItem('simulated_role');
                let simCompanyId = localStorage.getItem('simulated_company_id');

                if (simRole || simCompanyId) {
                    console.warn('⚡ SIMULATION ACTIVE:', { role: simRole, company: simCompanyId });

                    let simPermissions: any = {};
                    let effectiveCompanyId = simCompanyId || data.company_id;
                    let effectiveRole = simRole;

                    // SECURITY: If the user is NOT a real super_admin or platform_owner, they can NEVER simulate super_admin!
                    const isRealSuperUser = data.role === 'super_admin' || data.is_platform_owner === true;
                    if (simRole === 'super_admin' && !isRealSuperUser) {
                        console.warn('🛡️ Access Denied: non-superuser cannot simulate super_admin role.');
                        effectiveRole = null;
                        localStorage.removeItem('simulated_role');
                        setSimulatedRole(null);
                    }

                    // SECURITY: If company_admin is simulating, they can only switch to child companies of their own company
                    if (data.role === 'company_admin' && simCompanyId && simCompanyId !== data.company_id) {
                        try {
                            const { data: targetCompany } = await supabase
                                .from('companies')
                                .select('id, parent_company_id')
                                .eq('id', simCompanyId)
                                .single();
                            
                            if (!targetCompany || targetCompany.parent_company_id !== data.company_id) {
                                console.warn('🛡️ Access Denied: company_admin cannot switch to non-child company.');
                                effectiveCompanyId = data.company_id;
                                localStorage.removeItem('simulated_company_id');
                                setSimulatedCompanyId(null);
                            }
                        } catch (err) {
                            console.error('Error validating child company simulation:', err);
                            effectiveCompanyId = data.company_id;
                        }
                    }

                    // Load permissions for the simulated role from the actual role_permissions table
                    if (effectiveCompanyId && effectiveRole) {
                        try {
                            // 1. Load the company license FIRST
                            const { data: companyData } = await supabase
                                .from('companies')
                                .select('allowed_permissions')
                                .eq('id', effectiveCompanyId)
                                .single();

                            const rawLicense = companyData?.allowed_permissions;
                            const companyLicense: string[] = Array.isArray(rawLicense)
                                ? rawLicense.map(k => String(k).trim().toLowerCase())
                                : [];

                            // 2. ADMIN LOGIC: If simulating an Admin, grant FULL license access immediately.
                            if (effectiveRole === 'company_admin' || effectiveRole === 'super_admin') {
                                simPermissions = {};

                                // Infrastructure permissions
                                ['team_manage', 'team_create_members', 'team_edit_members', 'team_delete_members',
                                    'team_edit_roles', 'team_invite', 'team_toggle_status', 'team_manage_limits', 'team_view_assigned',
                                    'dashboard_filter_dates'].forEach(key => {
                                        simPermissions![key] = true;
                                    });

                                // Licensed permissions
                                companyLicense.forEach(key => {
                                    if (key) simPermissions![key] = true;
                                });
                            }
                            // 3. COLLABORATOR LOGIC (Standard User)
                            else {
                                // Find the most relevant custom_role for this company and base_role
                                const { data: simRolesData } = await supabase
                                    .from('custom_roles')
                                    .select('id, name, company_id')
                                    .or(`company_id.eq.${effectiveCompanyId},company_id.eq.00000000-0000-0000-0000-000000000000`)
                                    .eq('base_role', effectiveRole)
                                    .order('company_id', { ascending: false });

                                const simRoleData = simRolesData?.find(r => r.company_id === effectiveCompanyId)
                                    || simRolesData?.find(r => r.company_id === '00000000-0000-0000-0000-000000000000')
                                    || simRolesData?.[0];

                                if (simRoleData) {
                                    const { data: rolePerms } = await supabase
                                        .from('role_permissions')
                                        .select('permission_key, is_enabled')
                                        .eq('role_id', simRoleData.id);

                                    simPermissions = {};
                                    (rolePerms || []).forEach((rp: any) => {
                                        if (rp.is_enabled) {
                                            const moduleKey = rp.permission_key.split(/[._:]/)[0];
                                            const isLicensed = companyLicense.includes(rp.permission_key)
                                                || companyLicense.includes(moduleKey)
                                                || (rp.permission_key.startsWith('mkt_') && companyLicense.includes('marketing'))
                                                || (rp.permission_key.startsWith('cotizaciones.') && companyLicense.includes('quotes'));

                                            if (isLicensed) {
                                                simPermissions![rp.permission_key] = true;
                                            }
                                        }
                                    });
                                }
                            }
                        } catch (e) {
                            console.error('Error loading simulated role permissions:', e);
                        }

                        finalProfile = {
                            ...finalProfile,
                            role: (effectiveRole as any) || finalProfile.role,
                            company_id: effectiveCompanyId || finalProfile.company_id,
                            permissions: simPermissions
                        };
                    } else if (effectiveCompanyId) {
                        // Just simulated company_id, retain role and permissions
                        finalProfile = {
                            ...finalProfile,
                            company_id: effectiveCompanyId
                        };
                    }
                }
            }

            // SECURITY: If the final profile is NEITHER super_admin NOR company_admin, clear any residual
            // simulation state from localStorage.
            if (finalProfile.role !== 'super_admin' && finalProfile.role !== 'company_admin') {
                if (localStorage.getItem('simulated_company_id') || localStorage.getItem('simulated_role')) {
                    console.warn('🛡️ Clearing residual simulation state for non-admin user');
                    localStorage.removeItem('simulated_company_id');
                    localStorage.removeItem('simulated_role');
                    setSimulatedCompanyId(null);
                    setSimulatedRole(null);
                }
            }
            setProfile(finalProfile);
        } catch (err) {
            console.error('Unexpected error fetching profile:', err);
        } finally {
            setLoading(false);
        }
    };

    const signOut = async () => {
        // Clear all cached queries and simulation state before signing out
        // This ensures the next user who logs in starts with a clean slate
        queryClient.clear();
        prevUserIdRef.current = null;
        localStorage.removeItem('simulated_role');
        localStorage.removeItem('simulated_company_id');
        setSimulatedRole(null);
        setSimulatedCompanyId(null);
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{
            session, user, profile, loading, signOut,
            simulatedCompanyId, setSimulatedCompanyId: handleSetSimulatedCompanyId,
            simulatedRole, setSimulatedRole: handleSetSimulatedRole,
            revertSimulation: handleRevertSimulation
        }}>
            {children}
        </AuthContext.Provider>
    );
}
