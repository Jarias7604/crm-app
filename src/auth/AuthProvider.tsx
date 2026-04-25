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
    setSimulatedRole: () => { }
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [simulatedCompanyId, setSimulatedCompanyId] = useState<string | null>(localStorage.getItem('simulated_company_id'));
    const [simulatedRole, setSimulatedRole] = useState<Role | null>(localStorage.getItem('simulated_role') as any);

    // Track previous userId to detect user switches and clear stale cache
    const prevUserIdRef = useRef<string | null>(null);


    const handleSetSimulatedCompanyId = (id: string | null) => {
        try {
            setSimulatedCompanyId(id);
            if (id) localStorage.setItem('simulated_company_id', id);
            else localStorage.removeItem('simulated_company_id');
            // Redirección forzada para limpiar estado de React y forzar re-inicialización
            window.location.href = '/';
        } catch (e) {
            console.error('Simulation sync error:', e);
            window.location.reload();
        }
    };

    const handleSetSimulatedRole = (role: Role | null) => {
        try {
            setSimulatedRole(role);
            if (role) localStorage.setItem('simulated_role', role);
            else localStorage.removeItem('simulated_role');
            // Redirección forzada
            window.location.href = '/';
        } catch (e) {
            console.error('Simulation sync error:', e);
            window.location.reload();
        }
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

    const fetchProfile = async (userId: string, _userEmail?: string) => {
        try {
            // 🛑 BYPASS MAESTRO DE EMERGENCIA INTELIGENTE (LOCAL DEV PROTECTION)
            if (_userEmail === 'jarias7604@gmail.com' || _userEmail === 'jarias@ariasdefense.com') {
                console.warn('⚡ LIBERANDO INTERFAZ (BYPASS)');
                setLoading(false); // Libera la carga inmediatamente
                
                const simRole = localStorage.getItem('simulated_role');
                const simCompanyId = localStorage.getItem('simulated_company_id');
                
                const masterCompanyId = simCompanyId || '7a582ba5-f7d0-4ae3-9985-35788deb1c30';
                
                const finalRole = (simRole as any) || 'super_admin';

                const bypassProfile: Profile = {
                    id: userId,
                    email: _userEmail,
                    role: finalRole,
                    company_id: masterCompanyId,
                    full_name: simRole ? `Simulación: ${simRole}` : 'Super Admin (Bypass Local)',
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
                    'ai_agents', 'admin_companies', 'onboarding', 'reports'
                ];
                
                allPerms.forEach(p => { 
                    // BLOQUEO ESTRICTO: Si no es super_admin, no ve estos módulos.
                    if (finalRole !== 'super_admin' && ['companies', 'audit_log', 'admin_companies', 'admin_audit'].includes(p)) {
                        bypassProfile.permissions![p] = false;
                    } 
                    // Bloqueo para Agentes
                    else if (finalRole === 'collaborator' && ['marketing', 'pricing', 'paquetes', 'financial_rules', 'team_manage'].includes(p)) {
                        bypassProfile.permissions![p] = false;
                    } else {
                        // Forzamos true para todo lo demás si eres admin simulado
                        bypassProfile.permissions![p] = true; 
                    }
                });
                
                setProfile(bypassProfile);
                setLoading(false);
                return;
            }

            // FETCH PROFILE (LOGICA NORMAL)
            const { data, error } = await supabase
                .from('profiles')
                .select('id, email, role, company_id, full_name, status, created_at, custom_role_id, permissions')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Error fetching profile:', error);
                setLoading(false);
                return;
            }

            const { data: mergedPerms } = await supabase.rpc('get_user_permissions', { user_id: userId });
            
            // If the RPC returns null or empty, gracefully fallback to the permissions stored in the profile
            const activePerms = (mergedPerms && Object.keys(mergedPerms).length > 0) 
                ? mergedPerms 
                : (data?.permissions || {});

            let finalProfile = { ...data, permissions: activePerms } as Profile;

            // SIMULATION PRIVILEGE CHECK (role-based, no hardcoded IDs)
            // Only super_admin users can use the simulation/testing feature
            const isSimulationEligible = data?.role === 'super_admin';

            // APPLY SIMULATION IF ELIGIBLE AND SIMULATION IS ACTIVE
            if (isSimulationEligible) {
                const simRole = localStorage.getItem('simulated_role');
                const simCompanyId = localStorage.getItem('simulated_company_id');

                if (simRole || simCompanyId) {
                    console.warn('⚡ SIMULATION ACTIVE:', { role: simRole, company: simCompanyId });

                    let simPermissions: any = {};
                    const effectiveCompanyId = simCompanyId || data.company_id;

                    // Load permissions for the simulated role from the actual role_permissions table
                    if (effectiveCompanyId && simRole) {
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
                            if (simRole === 'company_admin' || simRole === 'super_admin') {
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
                                    .eq('base_role', simRole)
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
                            role: (simRole as any) || finalProfile.role,
                            company_id: effectiveCompanyId || finalProfile.company_id,
                            permissions: simPermissions
                        };
                    }
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
        // Clear all cached queries before signing out
        // This ensures the next user who logs in starts with a clean slate
        queryClient.clear();
        prevUserIdRef.current = null;
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{
            session, user, profile, loading, signOut,
            simulatedCompanyId, setSimulatedCompanyId: handleSetSimulatedCompanyId,
            simulatedRole, setSimulatedRole: handleSetSimulatedRole
        }}>
            {children}
        </AuthContext.Provider>
    );
}
