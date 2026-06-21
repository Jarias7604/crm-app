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
        company_tax_id?: string | null;
        company_phone?: string | null;
        company_address?: string | null;
        company_max_users: number;
        company_allowed_permissions: string[];
        admin_email?: string | null;
        admin_password?: string | null;
        admin_full_name?: string | null;
    }) {
        // ── Step 1: Create the company only (no user inside the RPC) ──────────
        // We avoid creating the user inside PL/pgSQL because direct auth.users
        // inserts leave internal Supabase Auth fields (identities, etc.) incomplete,
        // causing a 500 "Database error querying schema" on first login.
        const { data: companyData, error: companyError } = await supabase.rpc('provision_new_tenant', {
            p_company_name: params.company_name,
            p_license_status: params.company_license_status,
            p_rnc: params.company_tax_id ?? null,
            p_telefono: params.company_phone ?? null,
            p_email: null,
            p_direccion: params.company_address ?? null,
            p_max_users: params.company_max_users,
            p_allowed_permissions: params.company_allowed_permissions,
            // Always null — admin created separately below via addCompanyAdmin
            p_admin_email: null,
            p_admin_password: null,
            p_admin_full_name: null,
        });

        if (companyError) throw companyError;

        const companyId = (companyData as any).company_id as string;

        // ── Step 2: Create admin user via the safe addCompanyAdmin path ────────
        // admin_create_user() RPC handles auth.users + auth.identities + profiles
        // atomically with the correct identity data for login to work.
        if (params.admin_email && params.admin_password) {
            await this.addCompanyAdmin({
                email: params.admin_email,
                password: params.admin_password,
                full_name: params.admin_full_name ?? null,
                company_id: companyId,
            });
        }

        return companyData;
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
            new_full_name: params.full_name || params.email,
            new_role: 'company_admin',
            new_company_id: params.company_id,
            new_phone: null,
            new_custom_role_id: null,
            new_address_date: null,
            new_address: null
        });

        if (error) throw error;
        return data;
    },

    async updateCompany(id: string, updates: Partial<Company>) {
        const { error } = await supabase
            .from('companies')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
    },

    async deleteCompany(id: string) {
        const { error } = await supabase
            .from('companies')
            .delete()
            .eq('id', id);

        if (error) throw error;
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
