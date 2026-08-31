import { supabase } from './supabase';
import { leadsService } from './leads';
import { logger } from '../utils/logger';

export interface LeadSource {
    id: string;
    company_id: string;
    name: string;
    slug: string;       // e.g. 'facebook_ads', 'referidos'
    icon: string;
    color: string;
    bg_color: string;
    is_active: boolean;
    is_system: boolean;
    created_at: string;
    updated_at: string;
}

export const leadSourcesService = {
    /**
     * Get all active sources for the current company
     */
    async getSources(companyId?: string): Promise<LeadSource[]> {
        try {
            const cid = companyId || await leadsService.getActiveCompanyId();
            if (!cid) return [];

            const { data, error } = await supabase
                .from('lead_sources')
                .select('*')
                .eq('company_id', cid)
                .eq('is_active', true)
                .order('name', { ascending: true });

            if (error) {
                logger.error('Failed to fetch lead sources', error);
                return [];
            }
            return data || [];
        } catch (err) {
            logger.error('Failed to fetch lead sources', err);
            return [];
        }
    },

    /**
     * Get all sources (including inactive) — for admin management
     */
    async getAllSources(companyId?: string): Promise<LeadSource[]> {
        try {
            const cid = companyId || await leadsService.getActiveCompanyId();
            if (!cid) return [];

            const { data, error } = await supabase
                .from('lead_sources')
                .select('*')
                .eq('company_id', cid)
                .order('name', { ascending: true });

            if (error) {
                logger.error('Failed to fetch all lead sources', error);
                return [];
            }
            return data || [];
        } catch (err) {
            logger.error('Failed to fetch all lead sources', err);
            return [];
        }
    },

    /**
     * Find a source by slug (e.g. 'facebook_ads') for a given company
     */
    async findBySlug(slug: string, companyId?: string): Promise<LeadSource | null> {
        try {
            const cid = companyId || await leadsService.getActiveCompanyId();
            if (!cid) return null;

            const { data, error } = await supabase
                .from('lead_sources')
                .select('*')
                .eq('company_id', cid)
                .eq('slug', slug)
                .maybeSingle();

            if (error || !data) return null;
            return data;
        } catch {
            return null;
        }
    },

    /**
     * Create a custom source
     */
    async createSource(source: {
        name: string;
        slug?: string;
        icon?: string;
        color?: string;
        bg_color?: string;
    }): Promise<LeadSource> {
        const companyId = await leadsService.getActiveCompanyId();
        if (!companyId) throw new Error('Company not identified');

        // Auto-generate slug from name if not provided
        const slug = source.slug || source.name
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // remove accents
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '');

        const { data, error } = await supabase
            .from('lead_sources')
            .insert({
                company_id: companyId,
                name: source.name.trim(),
                slug,
                icon: source.icon || '📋',
                color: source.color || 'text-gray-700',
                bg_color: source.bg_color || 'bg-gray-100',
                is_active: true,
                is_system: false,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Update a source (name, icon, active status)
     */
    async updateSource(id: string, updates: Partial<Omit<LeadSource, 'id' | 'company_id' | 'is_system' | 'created_at'>>): Promise<LeadSource> {
        const { data, error } = await supabase
            .from('lead_sources')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Delete a non-system source
     */
    async deleteSource(id: string): Promise<void> {
        const { error } = await supabase
            .from('lead_sources')
            .delete()
            .eq('id', id)
            .eq('is_system', false); // Protect system sources

        if (error) throw error;
    },
};
