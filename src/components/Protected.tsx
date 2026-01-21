import type { ReactNode } from 'react';
import { usePermissions } from '../hooks/usePermissions';

interface ProtectedProps {
    children: ReactNode;
    permission?: string;
    anyPermissions?: string[];
    allPermissions?: string[];
    requireAdmin?: boolean;
    requireSuperAdmin?: boolean;
    fallback?: ReactNode;
}

/**
 * Componente para proteger contenido basado en permisos
 * Super Admin SIEMPRE puede ver todo
 */
export function Protected({
    children,
    permission,
    anyPermissions,
    allPermissions,
    requireAdmin,
    requireSuperAdmin,
    fallback = null
}: ProtectedProps) {
    const {
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        isAdmin,
        isSuperAdmin,
        loading
    } = usePermissions();

    // Mientras carga, no mostrar nada
    if (loading) {
        return <>{fallback}</>;
    }

    // Super Admin puede ver TODO
    if (isSuperAdmin()) {
        return <>{children}</>;
    }

    // Verificar si requiere Super Admin específicamente
    if (requireSuperAdmin) {
        return <>{fallback}</>;
    }

    // Verificar si requiere cualquier tipo de admin
    if (requireAdmin && !isAdmin()) {
        return <>{fallback}</>;
    }

    // Verificar permiso único
    if (permission && !hasPermission(permission)) {
        return <>{fallback}</>;
    }

    // Verificar si tiene al menos uno de los permisos
    if (anyPermissions && !hasAnyPermission(anyPermissions)) {
        return <>{fallback}</>;
    }

    // Verificar si tiene todos los permisos
    if (allPermissions && !hasAllPermissions(allPermissions)) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}

/**
 * Componente para mostrar algo solo si NO tiene permiso
 * Útil para mostrar mensajes de "No autorizado"
 */
export function WithoutPermission({
    children,
    permission
}: {
    children: ReactNode;
    permission: string;
}) {
    const { hasPermission, isSuperAdmin } = usePermissions();

    // Super Admin siempre tiene permiso, así que nunca muestra esto
    if (isSuperAdmin()) {
        return null;
    }

    if (hasPermission(permission)) {
        return null;
    }

    return <>{children}</>;
}
