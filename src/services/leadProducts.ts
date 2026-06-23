import { supabase } from './supabase';
import { leadsService } from './leads';
import { logger } from '../utils/logger';
import type { LeadProduct } from '../types';

export const leadProductsService = {
    /**
     * Get all active products of interest for the current company
     */
    async getProducts(): Promise<LeadProduct[]> {
        try {
            const companyId = await leadsService.getActiveCompanyId();
            if (!companyId) return [];

            const { data, error } = await supabase
                .from('lead_products')
                .select('*')
                .eq('company_id', companyId)
                .eq('is_active', true)
                .order('name', { ascending: true });

            if (error) {
                logger.error('Failed to fetch lead products', error, { action: 'getProducts' });
                return [];
            }
            return data || [];
        } catch (error) {
            logger.error('Failed to fetch lead products', error, { action: 'getProducts' });
            return [];
        }
    },

    /**
     * Get all products of interest (including inactive) for management
     */
    async getAllProducts(): Promise<LeadProduct[]> {
        try {
            const companyId = await leadsService.getActiveCompanyId();
            if (!companyId) return [];

            const { data, error } = await supabase
                .from('lead_products')
                .select('*')
                .eq('company_id', companyId)
                .order('name', { ascending: true });

            if (error) {
                logger.error('Failed to fetch all lead products', error, { action: 'getAllProducts' });
                return [];
            }
            return data || [];
        } catch (error) {
            logger.error('Failed to fetch all lead products', error, { action: 'getAllProducts' });
            return [];
        }
    },

    /**
     * Create a new product of interest
     */
    async createProduct(name: string, description?: string): Promise<LeadProduct> {
        try {
            const companyId = await leadsService.getActiveCompanyId();
            if (!companyId) throw new Error('Company not identified');

            const { data, error } = await supabase
                .from('lead_products')
                .insert({
                    company_id: companyId,
                    name: name.trim(),
                    description: description?.trim() || null,
                    is_active: true
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            logger.error('Failed to create lead product', error, { action: 'createProduct', name });
            throw error;
        }
    },

    /**
     * Update a product of interest
     */
    async updateProduct(id: string, updates: Partial<LeadProduct>): Promise<LeadProduct> {
        try {
            const { data, error } = await supabase
                .from('lead_products')
                .update({
                    name: updates.name?.trim(),
                    description: updates.description !== undefined ? (updates.description?.trim() || null) : undefined,
                    is_active: updates.is_active,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            logger.error('Failed to update lead product', error, { action: 'updateProduct', id });
            throw error;
        }
    },

    /**
     * Delete a product of interest
     */
    async deleteProduct(id: string): Promise<void> {
        try {
            const { error } = await supabase
                .from('lead_products')
                .delete()
                .eq('id', id);

            if (error) throw error;
        } catch (error) {
            logger.error('Failed to delete lead product', error, { action: 'deleteProduct', id });
            throw error;
        }
    }
};
