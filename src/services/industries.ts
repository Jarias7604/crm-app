import { supabase } from './supabase';
import { logger } from '../utils/logger';
import type { Industry } from '../types';

/**
 * Service for managing industries/rubros (configurable per company)
 * Uses RPC functions to avoid PostgREST schema cache issues
 */
export const industriesService = {
    /**
     * Get all active industries for the current company
     */
    async getIndustries(): Promise<Industry[]> {
        try {
            const { data, error } = await supabase.rpc('get_industries');

            if (error) {
                logger.error('Failed to fetch industries', error, { action: 'getIndustries' });
                return [];
            }
            // Filter active only on client side
            return (data || []).filter((i: Industry) => i.is_active);
        } catch (error) {
            logger.error('Failed to fetch industries', error, { action: 'getIndustries' });
            return [];
        }
    },

    /**
     * Get all industries (including inactive) for admin page
     */
    async getAllIndustries(): Promise<Industry[]> {
        try {
            const { data, error } = await supabase.rpc('get_industries');

            if (error) {
                logger.error('Failed to fetch all industries', error, { action: 'getAllIndustries' });
                return [];
            }
            return data || [];
        } catch (error) {
            logger.error('Failed to fetch all industries', error, { action: 'getAllIndustries' });
            return [];
        }
    },

    /**
     * Create a new industry
     */
    async createIndustry(name: string, displayOrder?: number): Promise<Industry> {
        try {
            const { data, error } = await supabase.rpc('create_industry', {
                p_name: name,
                p_display_order: displayOrder ?? 999
            });

            if (error) throw error;
            return data;
        } catch (error) {
            logger.error('Failed to create industry', error, { action: 'createIndustry', name });
            throw error;
        }
    },

    /**
     * Update an industry
     */
    async updateIndustry(id: string, updates: Partial<Industry>): Promise<void> {
        try {
            const { error } = await supabase.rpc('update_industry', {
                p_id: id,
                p_name: updates.name ?? null,
                p_is_active: updates.is_active ?? null,
                p_display_order: updates.display_order ?? null
            });

            if (error) throw error;
        } catch (error) {
            logger.error('Failed to update industry', error, { action: 'updateIndustry', id });
            throw error;
        }
    },

    /**
     * Soft delete (deactivate) an industry
     */
    async deleteIndustry(id: string): Promise<void> {
        try {
            const { error } = await supabase.rpc('update_industry', {
                p_id: id,
                p_is_active: false
            });

            if (error) throw error;
        } catch (error) {
            logger.error('Failed to delete industry', error, { action: 'deleteIndustry', id });
            throw error;
        }
    },

    /**
     * Reorder industries
     */
    async reorderIndustries(industries: { id: string; display_order: number }[]): Promise<void> {
        try {
            const updates = industries.map(i =>
                supabase.rpc('update_industry', {
                    p_id: i.id,
                    p_display_order: i.display_order
                })
            );

            await Promise.all(updates);
        } catch (error) {
            logger.error('Failed to reorder industries', error, { action: 'reorderIndustries' });
            throw error;
        }
    }
};
