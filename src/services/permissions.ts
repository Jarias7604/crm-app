import { supabase } from './supabase';
import type { Role } from '../types';

export interface PermissionDefinition {
    id: string;
    category: string;
    permission_key: string;
    label: string;
}

export interface RolePermission {
    id: string;
    role: Role;
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

    async getRolePermissions() {
        const { data, error } = await supabase
            .from('role_permissions')
            .select('*');

        if (error) throw error;
        return data as RolePermission[];
    },

    async updatePermission(role: Role, key: string, isEnabled: boolean) {
        const { data, error } = await supabase
            .from('role_permissions')
            .upsert({
                role,
                permission_key: key,
                is_enabled: isEnabled,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'role,permission_key'
            })
            .select()
            .single();

        if (error) throw error;
        return data as RolePermission;
    }
};
