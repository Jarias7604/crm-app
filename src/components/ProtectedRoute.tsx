import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

export default function ProtectedRoute() {
    const { session, loading, profile } = useAuth();
    const location = useLocation();
    const [trialExpired, setTrialExpired] = useState(false);
    const [subChecked, setSubChecked] = useState(false);

    useEffect(() => {
        // Super admins and platform owners are never blocked
        if (!profile?.company_id || profile?.role === 'super_admin') {
            setSubChecked(true);
            return;
        }
        // Don't block on billing page itself
        if (location.pathname === '/company/billing' || location.pathname === '/trial-expired') {
            setSubChecked(true);
            return;
        }

        supabase.rpc('get_company_subscription').then(({ data }) => {
            if (data && data[0]) {
                const sub = data[0];
                const now = new Date();

                // Check if trial has expired
                if (sub.status === 'trialing' && sub.trial_ends_at) {
                    const trialEnd = new Date(sub.trial_ends_at);
                    if (trialEnd < now) {
                        setTrialExpired(true);
                        setSubChecked(true);
                        return;
                    }
                }

                // Check if subscription period has ended (past_due or canceled + expired)
                if ((sub.status === 'past_due' || sub.status === 'canceled') && sub.current_period_end) {
                    const periodEnd = new Date(sub.current_period_end);
                    if (periodEnd < now) {
                        setTrialExpired(true);
                        setSubChecked(true);
                        return;
                    }
                }
            }
            setSubChecked(true);
        }).catch(() => setSubChecked(true)); // On error, let through — never block on network issues
    }, [profile?.company_id, profile?.role, location.pathname]);

    if (loading) {
        return <div className="flex items-center justify-center min-h-screen bg-[#07070c]">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>;
    }

    if (!session) {
        return <Navigate to="/login" replace />;
    }

    if (subChecked && trialExpired) {
        return <Navigate to="/trial-expired" replace />;
    }

    return <Outlet />;
}
