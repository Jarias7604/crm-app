import { supabase } from './supabase';
import { logger } from '../utils/logger';
import type { LossReason } from '../types';

/**
 * Service for managing loss reasons (configurable per company)
 */
export const lossReasonsService = {
    /**
     * Get all active loss reasons for the current company
     */
    async getLossReasons(): Promise<LossReason[]> {
        try {
            const { data, error } = await supabase
                .from('loss_reasons')
                .select('*')
                .not('company_id', 'is', null) // Only get company-specific reasons, not templates
                .eq('is_active', true)
                .order('display_order', { ascending: true });

            if (error) {
                logger.error('Failed to fetch loss reasons', error, { action: 'getLossReasons' });
                return []; // Return empty array instead of throwing
            }
            return data || [];
        } catch (error) {
            logger.error('Failed to fetch loss reasons', error, { action: 'getLossReasons' });
            return []; // Return empty array on error
        }
    },

    /**
     * Create a new loss reason
     */
    async createLossReason(reason: string, displayOrder?: number): Promise<LossReason> {
        try {
            // Get the current user's company_id
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            const { data: profile } = await supabase
                .from('profiles')
                .select('company_id')
                .eq('id', user.id)
                .single();

            if (!profile?.company_id) throw new Error('User company not found');

            const { data, error } = await supabase
                .from('loss_reasons')
                .insert({
                    company_id: profile.company_id,
                    reason,
                    display_order: displayOrder ?? 999,
                    is_active: true
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            logger.error('Failed to create loss reason', error, { action: 'createLossReason', reason });
            throw error;
        }
    },

    /**
     * Update a loss reason
     */
    async updateLossReason(id: string, updates: Partial<LossReason>): Promise<void> {
        try {
            const { error } = await supabase
                .from('loss_reasons')
                .update(updates)
                .eq('id', id);

            if (error) throw error;
        } catch (error) {
            logger.error('Failed to update loss reason', error, { action: 'updateLossReason', id });
            throw error;
        }
    },

    /**
     * Soft delete (deactivate) a loss reason
     */
    async deleteLossReason(id: string): Promise<void> {
        try {
            const { error } = await supabase
                .from('loss_reasons')
                .update({ is_active: false })
                .eq('id', id);

            if (error) throw error;
        } catch (error) {
            logger.error('Failed to delete loss reason', error, { action: 'deleteLossReason', id });
            throw error;
        }
    },

    /**
     * Reorder loss reasons
     */
    async reorderLossReasons(reasons: { id: string; display_order: number }[]): Promise<void> {
        try {
            const updates = reasons.map(r =>
                supabase
                    .from('loss_reasons')
                    .update({ display_order: r.display_order })
                    .eq('id', r.id)
            );

            await Promise.all(updates);
        } catch (error) {
            logger.error('Failed to reorder loss reasons', error, { action: 'reorderLossReasons' });
            throw error;
        }
    }
};
