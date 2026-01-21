import { useAuth } from '../auth/AuthProvider';
import { useEffect, useState } from 'react';
import { permissionsService, type RolePermission } from '../services/permissions';

/**
 * Hook para verificar permisos del usuario actual
 * Super Admin siempre tiene todos los permisos
 */
export function usePermissions() {
    const { profile } = useAuth();
    const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPermissions();
    }, [profile?.role]);

    const loadPermissions = async () => {
        if (!profile?.role) {
            setLoading(false);
            return;
        }

        try {
            const permissions = await permissionsService.getRolePermissions();
            setRolePermissions(permissions);
        } catch (error) {
            console.error('Error loading permissions:', error);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Verifica si el usuario tiene un permiso específico
     * Super Admin SIEMPRE retorna true
     */
    const hasPermission = (permissionKey: string): boolean => {
        // Super Admin tiene TODOS los permisos
        if (profile?.role === 'super_admin') {
            return true;
        }

        // Para otros roles, verificar en la base de datos
        const permission = rolePermissions.find(
            p => p.role === profile?.role && p.permission_key === permissionKey
        );

        return permission?.is_enabled ?? false;
    };

    /**
     * Verifica si el usuario tiene AL MENOS UNO de los permisos especificados
     */
    const hasAnyPermission = (permissionKeys: string[]): boolean => {
        if (profile?.role === 'super_admin') {
            return true;
        }

        return permissionKeys.some(key => hasPermission(key));
    };

    /**
     * Verifica si el usuario tiene TODOS los permisos especificados
     */
    const hasAllPermissions = (permissionKeys: string[]): boolean => {
        if (profile?.role === 'super_admin') {
            return true;
        }

        return permissionKeys.every(key => hasPermission(key));
    };

    /**
     * Verifica si el usuario es Super Admin
     */
    const isSuperAdmin = (): boolean => {
        return profile?.role === 'super_admin';
    };

    /**
     * Verifica si el usuario es Admin de Empresa
     */
    const isCompanyAdmin = (): boolean => {
        return profile?.role === 'company_admin';
    };

    /**
     * Verifica si el usuario es Admin (Super o Company)
     */
    const isAdmin = (): boolean => {
        return isSuperAdmin() || isCompanyAdmin();
    };

    return {
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        isSuperAdmin,
        isCompanyAdmin,
        isAdmin,
        loading,
        rolePermissions
    };
}
