import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { brandingService } from '../services/branding';
import { useState, useEffect } from 'react';
import type { Company } from '../types';

interface FeatureProtectedRouteProps {
    feature: 'leads' | 'quotes' | 'calendar' | 'marketing' | 'chat';
    allowedRoles?: string[];
}

export default function FeatureProtectedRoute({ feature, allowedRoles }: FeatureProtectedRouteProps) {
    const { profile, loading } = useAuth();
    const [company, setCompany] = useState<Company | null>(null);
    const [isValidating, setIsValidating] = useState(true);

    useEffect(() => {
        if (profile?.company_id) {
            brandingService.getMyCompany().then(data => {
                setCompany(data);
                setIsValidating(false);
            }).catch(() => {
                setIsValidating(false);
            });
        } else {
            setIsValidating(false);
        }
    }, [profile?.company_id]);

    if (loading || isValidating) {
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

    // Permission Check Logic (Synced with Sidebar.tsx)
    const canAccess = () => {
        // Core features that default to true if licensed
        const coreFeatures = ['leads', 'quotes', 'calendar'];

        const licenseKeys: Record<string, string> = {
            leads: 'leads_view',
            quotes: 'cotizaciones.manage_implementation',
            calendar: 'calendar_view_own',
            marketing: 'mkt_view_dashboard',
            chat: 'chat_view_all'
        };

        const licenseKey = licenseKeys[feature];
        const isLicensed = company?.allowed_permissions?.includes(licenseKey);

        // If not licensed (and not super_admin), no access
        if (!isLicensed && profile.role !== 'super_admin') return false;

        // Company Admin typically has access to all licensed features
        if (profile.role === 'company_admin') return true;

        // For other roles (sales_agent, etc.), check explicit permissions
        const explicitPerm = profile.permissions?.[feature];

        if (explicitPerm === false) return false;
        if (explicitPerm === true) return true;

        // Default: true for core, false for non-core (marketing, chat, etc.)
        return coreFeatures.includes(feature);
    };

    if (!canAccess()) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
}
