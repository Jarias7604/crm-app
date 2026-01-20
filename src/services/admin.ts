import { supabase } from './supabase';
import type { Company } from '../types';

export const adminService = {
    async getCompanies() {
        const { data, error } = await supabase
            .from('companies')
            .select(`
                *,
                user_count:profiles(count)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Transform user_count from [{count: n}] to n
        return data.map(c => ({
            ...c,
            user_count: c.user_count?.[0]?.count || 0
        })) as (Company & { user_count: number })[];
    },

    async createCompany(company: Partial<Company>) {
        const { data, error } = await supabase
            .from('companies')
            .insert(company)
            .select()
            .single();

        if (error) throw error;
        return data as Company;
    },

    async updateCompany(id: string, updates: Partial<Company>) {
        const { data, error } = await supabase
            .from('companies')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Company;
    }
};
