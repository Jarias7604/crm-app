import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import type { Role } from '../types';

interface RoleProtectedRouteProps {
    allowedRoles: Role[];
}

export default function RoleProtectedRoute({ allowedRoles }: RoleProtectedRouteProps) {
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

    if (!allowedRoles.includes(profile.role)) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
}
