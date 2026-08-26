import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

interface FeatureProtectedRouteProps {
    feature: 'leads' | 'quotes' | 'calendar' | 'marketing' | 'chat' | 'invoices' | 'facturas' | 'clientes' | 'proyectos' | 'finanzas' | 'tickets';
    allowedRoles?: string[];
}

export default function FeatureProtectedRoute({ feature, allowedRoles }: FeatureProtectedRouteProps) {
    const { profile, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!profile) {
        return <Navigate to="/login" replace />;
    }

    // Super Admin has access to everything
    if (profile.role === 'super_admin') return <Outlet />;

    // Role check if specified
    if (allowedRoles && !allowedRoles.includes(profile.role)) {
        return <Navigate to="/" replace />;
    }

    // Permission Check Logic (Synced with Sidebar via AuthProvider RPC)
    const canAccess = () => {
        if (!profile) return false;
        if (profile.permissions?.[feature] === true) return true;
        
        // Granular check: e.g. for 'clientes', allow if 'clientes.view' or 'clientes.manage' or 'clientes' is true
        const hasGranular = Object.keys(profile.permissions || {}).some(
            k => (k === feature || k.startsWith(`${feature}.`)) && profile.permissions?.[k] === true
        );
        if (hasGranular) return true;
        
        return false;
    };

    if (!canAccess()) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
}

