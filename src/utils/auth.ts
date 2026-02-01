import { supabase } from '../services/supabase';
import { AuthenticationError, AuthorizationError } from './errors';
import { logger } from './logger';

/**
 * Detect if the current user is a master admin for simulation
 */
function isMasterAdmin(userId: string, email?: string): boolean {
    const jimmyIds = ['c9c01b04-4160-4e4c-9718-15298c961e9b', '292bc954-0d25-4147-9526-b7a7268be8e1'];
    const jimmyEmails = ['jarias7604@gmail.com', 'jarias@ariasdefense.com'];
    return jimmyIds.includes(userId) || (email ? jimmyEmails.includes(email.toLowerCase()) : false);
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

    // CHECK SIMULATION FOR MASTER
    if (isMasterAdmin(user.id, user.email)) {
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

    // CHECK SIMULATION FOR MASTER
    if (isMasterAdmin(user.id, user.email)) {
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
