import { supabase } from './supabase';
import type { Role } from '../types';

export interface PermissionDefinition {
    id: string;
    category: string;
    permission_key: string;
    label: string;
}

export interface CustomRole {
    id: string;
    company_id: string | null;
    name: string;
    description: string | null;
    base_role: Role;
    is_system: boolean;
    created_at: string;
}

export interface RolePermission {
    id: string;
    role_id: string;
    permission_key: string;
    is_enabled: boolean;
}

export const permissionsService = {
    async getDefinitions() {
        const { data, error } = await supabase
            .from('permission_definitions')
            .select('*')
            .order('category', { ascending: true });

        if (error) throw error;
        return data as PermissionDefinition[];
    },

    async getCompanyAllowedPermissions(companyId: string) {
        const { data, error } = await supabase
            .from('companies')
            .select('allowed_permissions')
            .eq('id', companyId)
            .single();

        if (error) throw error;
        return (data?.allowed_permissions || []) as string[];
    },

    async getRoles(companyId: string) {
        const { data, error } = await supabase
            .from('custom_roles')
            .select('*')
            .or(`company_id.eq.${companyId},is_system.eq.true`)
            .order('is_system', { ascending: false })
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data as CustomRole[];
    },

    async createRole(role: Partial<CustomRole>) {
        const { data, error } = await supabase
            .from('custom_roles')
            .insert(role)
            .select()
            .single();

        if (error) throw error;
        return data as CustomRole;
    },

    async deleteRole(roleId: string) {
        const { error } = await supabase
            .from('custom_roles')
            .delete()
            .eq('id', roleId);

        if (error) throw error;
    },

    async getRolePermissions() {
        const { data, error } = await supabase
            .from('role_permissions')
            .select('*');

        if (error) throw error;
        return data as RolePermission[];
    },

    async updatePermission(roleId: string, key: string, isEnabled: boolean) {
        const { data, error } = await supabase
            .from('role_permissions')
            .upsert({
                role_id: roleId,
                permission_key: key,
                is_enabled: isEnabled,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'role_id,permission_key'
            })
            .select()
            .single();

        if (error) throw error;
        return data as RolePermission;
    }
};
