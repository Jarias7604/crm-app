import { supabase } from './supabase';
import type { Role } from '../types';

export interface PermissionDefinition {
    id: string;
    category: string;
    permission_key: string;
    label: string;
    is_system_only: boolean;
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
        // Obtenemos roles de sistema (empresa 0000...) y roles de la empresa actual
        const { data, error } = await supabase
            .from('custom_roles')
            .select('*')
            .or(`company_id.eq.${companyId},company_id.eq.00000000-0000-0000-0000-000000000000`)
            .order('is_system', { ascending: false })
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Eliminar duplicados por nombre, priorizando los que tienen company_id específico
        const uniqueRoles: CustomRole[] = [];
        const seenNames = new Set<string>();

        // Primero procesamos los de la empresa (si hay)
        data.forEach(role => {
            if (role.company_id === companyId) {
                uniqueRoles.push(role);
                seenNames.add(role.name.toLowerCase());
            }
        });

        // Luego agregamos los de sistema solo si no existe ya uno con ese nombre para la empresa
        data.forEach(role => {
            if (role.company_id !== companyId && !seenNames.has(role.name.toLowerCase())) {
                uniqueRoles.push(role);
                seenNames.add(role.name.toLowerCase());
            }
        });

        return uniqueRoles;
    },

    async getRoleMemberCounts(companyId: string) {
        const { data, error } = await supabase
            .from('profiles')
            .select('custom_role_id')
            .eq('company_id', companyId);

        if (error) throw error;

        const counts: Record<string, number> = {};
        data.forEach(p => {
            if (p.custom_role_id) {
                counts[p.custom_role_id] = (counts[p.custom_role_id] || 0) + 1;
            }
        });
        return counts;
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
