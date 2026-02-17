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

    async provisionNewTenant(params: {
        company_name: string;
        company_license_status: string;
        company_rnc?: string | null;
        company_telefono?: string | null;
        company_email?: string | null;
        company_direccion?: string | null;
        company_max_users: number;
        company_allowed_permissions: string[];
        admin_email?: string | null;
        admin_password?: string | null;
        admin_full_name?: string | null;
    }) {
        const { data, error } = await supabase.rpc('provision_new_tenant', {
            p_company_name: params.company_name,
            p_license_status: params.company_license_status,
            p_rnc: params.company_rnc,
            p_telefono: params.company_telefono,
            p_email: params.company_email,
            p_direccion: params.company_direccion,
            p_max_users: params.company_max_users,
            p_allowed_permissions: params.company_allowed_permissions,
            p_admin_email: params.admin_email,
            p_admin_password: params.admin_password,
            p_admin_full_name: params.admin_full_name
        });

        if (error) throw error;
        return data;
    },

    async addCompanyAdmin(params: {
        email: string;
        password: string;
        full_name?: string | null;
        company_id: string;
    }) {
        const { data, error } = await supabase.rpc('admin_create_user', {
            new_email: params.email,
            new_password: params.password,
            new_role: 'company_admin',
            new_full_name: params.full_name || params.email,
            new_phone: null,
            new_company_id: params.company_id,
            new_custom_role_id: null,
            new_birth_date: null,
            new_address: null
        });

        if (error) throw error;
        return data;
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
    },

    async getPermissionDefinitions() {
        const { data, error } = await supabase
            .from('permission_definitions')
            .select('*')
            .order('category', { ascending: true });

        if (error) throw error;
        return data as any[];
    }
};
