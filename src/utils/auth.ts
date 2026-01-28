import { supabase } from '../services/supabase';
import { AuthenticationError, AuthorizationError } from './errors';
import { logger } from './logger';

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
