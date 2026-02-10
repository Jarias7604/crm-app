import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
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

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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

    const fetchProfile = async (userId: string, userEmail?: string) => {
        try {
            const emailToUse = userEmail?.toLowerCase();

            // BYPASS MAESTRO (DETERMINISMO ABSOLUTO)
            const jimmyIds = ['c9c01b04-4160-4e4c-9718-15298c961e9b', '292bc954-0d25-4147-9526-b7a7268be8e1'];
            const jimmyEmails = ['jarias7604@gmail.com', 'jarias@ariasdefense.com'];

            const isJimmy = jimmyIds.includes(userId) || (emailToUse && jimmyEmails.includes(emailToUse));

            // CARGA NORMAL (PARA TODOS)
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
            let finalProfile = { ...data, permissions: mergedPerms } as Profile;

            // APLICAR BYPASS SI ES JIMMY Y HAY SIMULACIÓN ACTIVA
            if (isJimmy) {
                const simRole = localStorage.getItem('simulated_role');
                const simCompanyId = localStorage.getItem('simulated_company_id');

                if (simRole || simCompanyId) {
                    console.warn('⚡ MASTER SIMULATION ACTIVE:', { role: simRole, company: simCompanyId });

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

                            console.log('📦 Company License Loaded:', companyLicense);

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

                                // MASTER BYPASS: For Jimmy, always ensure critical modules are visible if licensed
                                if (isJimmy) {
                                    ['leads', 'quotes', 'calendar', 'marketing', 'chat'].forEach(key => {
                                        if (companyLicense.includes(key)) {
                                            simPermissions![key] = true;
                                        }
                                    });
                                }
                            }
                            // 3. COLLABORATOR LOGIC (Standard User)
                            else {
                                // Find the most relevant custom_role for this company and base_role
                                // Priority: 1. Company-specific role, 2. System role
                                const { data: simRolesData } = await supabase
                                    .from('custom_roles')
                                    .select('id, name, company_id')
                                    .or(`company_id.eq.${effectiveCompanyId},company_id.eq.00000000-0000-0000-0000-000000000000`)
                                    .eq('base_role', simRole)
                                    .order('company_id', { ascending: false }); // Nulls/0000 will be last


                                // Filter manually to find the best match
                                const simRoleData = simRolesData?.find(r => r.company_id === effectiveCompanyId)
                                    || simRolesData?.find(r => r.company_id === '00000000-0000-0000-0000-000000000000')
                                    || simRolesData?.[0];

                                if (simRoleData) {
                                    console.log(`🎯 Simulated Role Match: ${simRoleData.name} (${simRoleData.id})`);

                                    // Load enabled permissions for this Collaborator role
                                    const { data: rolePerms } = await supabase
                                        .from('role_permissions')
                                        .select('permission_key, is_enabled')
                                        .eq('role_id', simRoleData.id);

                                    simPermissions = {};
                                    (rolePerms || []).forEach((rp: any) => {
                                        if (rp.is_enabled) {
                                            // Validate against license
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
                                } else {
                                    console.warn('⚠️ No Collaborator role found for simulation');
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
