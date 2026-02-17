import { supabase } from '../services/supabase';
import { AuthenticationError, AuthorizationError } from './errors';
import { logger } from './logger';

/**
 * Check if the current user has master admin / simulation privileges.
 * Uses the database role (super_admin) as the source of truth instead of hardcoded IDs.
 * The actual role check happens in AuthProvider via the profile fetch.
 */
async function isMasterAdmin(userId: string): Promise<boolean> {
    const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
    return data?.role === 'super_admin';
}

/**
 * Get the current authenticated user's company ID
 * @throws {AuthenticationError} if user is not authenticated
 * @throws {AuthorizationError} if user has no company
 */
export async function getCurrentUserCompanyId(): Promise<string> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        logger.warn('User not authenticated', { error: authError });
        throw new AuthenticationError('User not authenticated');
    }

    // CHECK SIMULATION FOR MASTER (super_admin only)
    if (await isMasterAdmin(user.id)) {
        const simCompanyId = localStorage.getItem('simulated_company_id');
        const simRole = localStorage.getItem('simulated_role');

        // If simulating admin but no specific company, default to El Salvador for testing
        if (simRole === 'company_admin' && !simCompanyId) {
            return '7a582ba5-f7d0-4ae3-9985-35788deb1c30';
        }

        if (simCompanyId) return simCompanyId;
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

    if (profileError) {
        logger.error('Failed to fetch user profile', profileError, { userId: user.id });
        throw new AuthorizationError('Failed to fetch user profile');
    }

    if (!profile?.company_id) {
        logger.warn('User has no company', { userId: user.id });
        throw new AuthorizationError('User has no company assigned');
    }

    return profile.company_id;
}

/**
 * Get the current authenticated user's profile
 */
export async function getCurrentUserProfile() {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        throw new AuthenticationError('User not authenticated');
    }

    // CHECK SIMULATION FOR MASTER (super_admin only)
    if (await isMasterAdmin(user.id)) {
        const simRole = localStorage.getItem('simulated_role') || 'super_admin';
        const simCompanyId = localStorage.getItem('simulated_company_id');
        const effectiveCompanyId = simCompanyId || (simRole === 'company_admin' ? '7a582ba5-f7d0-4ae3-9985-35788deb1c30' : '00000000-0000-0000-0000-000000000000');

        return {
            id: user.id,
            email: user.email,
            role: simRole,
            company_id: effectiveCompanyId,
            full_name: 'Jimmy Arias (Simulated Utility)',
            status: 'active',
            created_at: new Date().toISOString(),
            permissions: { leads: true, quotes: true, calendar: true, marketing: true, chat: true, branding: true, pricing: true, paquetes: true, items: true }
        };
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (profileError) {
        logger.error('Failed to fetch user profile', profileError, { userId: user.id });
        throw new AuthorizationError('Failed to fetch user profile');
    }

    return profile;
}
