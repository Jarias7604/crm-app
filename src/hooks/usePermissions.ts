import { useAuth } from '../auth/AuthProvider';

/**
 * Hook para verificar permisos del usuario actual
 * Utiliza los permisos consolidados ya cargados en el Profile por AuthProvider
 * (Procesados vía RPC get_user_permissions y bypass de simulación)
 */
export function usePermissions() {
    const { profile, loading: authLoading } = useAuth();

    /**
     * Verifica si el usuario tiene un permiso específico
     * Super Admin SIEMPRE retorna true
     */
    const hasPermission = (permissionKey: string): boolean => {
        // Super Admin tiene TODOS los permisos
        if (profile?.role === 'super_admin') {
            return true;
        }

        if (!profile?.permissions) return false;

        // Verificar el permiso específico en el mapa de permisos consolidados
        // Se admite tanto el nombre completo como categorías base
        if (profile.permissions[permissionKey] === true) return true;

        // Lógica de herencia/granularidad (Ej: 'leads' habilita 'leads_view' si no hay restricción)
        const moduleKey = permissionKey.split(/[._:]/)[0];
        if (profile.permissions[moduleKey] === true) return true;

        return false;
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
        loading: authLoading, // Sincronizado con el estado de carga de Auth
        profile
    };
}

