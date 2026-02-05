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
                    finalProfile = {
                        ...finalProfile,
                        role: (simRole as any) || finalProfile.role,
                        company_id: simCompanyId || finalProfile.company_id,
                        full_name: (finalProfile.full_name || 'Jimmy') + ' [SIMULACIÓN]',
                        // Si simulamos agente de ventas, limpiamos permisos para probar el comportamiento por defecto (restricción)
                        permissions: simRole === 'sales_agent' ? {} : finalProfile.permissions
                    };
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
