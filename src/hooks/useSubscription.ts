import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../auth/AuthProvider';

export interface SubscriptionData {
  subscriptionId: string | null;
  planSlug: 'starter' | 'pro' | 'enterprise' | null;
  planName: string | null;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused' | null;
  billingCycle: 'monthly' | 'annual' | null;
  priceMonthly: number;
  priceAnnual: number;
  maxUsers: number;
  maxLeads: number;
  maxAiTokens: number;
  features: string[];
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  // Helpers
  isActive: boolean;
  isTrialing: boolean;
  isPastDue: boolean;
  isCanceled: boolean;
  hasPro: boolean;
  hasEnterprise: boolean;
  daysUntilExpiry: number | null;
}

const defaultSubscription: SubscriptionData = {
  subscriptionId: null,
  planSlug: null,
  planName: null,
  status: null,
  billingCycle: null,
  priceMonthly: 0,
  priceAnnual: 0,
  maxUsers: 5,
  maxLeads: 500,
  maxAiTokens: 25000,
  features: [],
  trialEndsAt: null,
  currentPeriodEnd: null,
  stripeCustomerId: null,
  isActive: false,
  isTrialing: false,
  isPastDue: false,
  isCanceled: false,
  hasPro: false,
  hasEnterprise: false,
  daysUntilExpiry: null,
};

let cachedSubscription: SubscriptionData | null = null;
let cacheExpiry: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function useSubscription() {
  const { profile } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData>(
    cachedSubscription ?? defaultSubscription
  );
  const [loading, setLoading] = useState(!cachedSubscription);
  const [error, setError] = useState<string | null>(null);

  // Super Admin always has full access — bypass subscription checks
  const isSuperAdmin = profile?.role === 'super_admin' || profile?.is_platform_owner;

  useEffect(() => {
    if (!profile?.company_id) return;

    // Use cache if still fresh
    if (cachedSubscription && Date.now() < cacheExpiry) {
      setSubscription(cachedSubscription);
      setLoading(false);
      return;
    }

    const fetchSubscription = async () => {
      try {
        setLoading(true);
        const { data, error: rpcError } = await supabase.rpc('get_company_subscription');

        if (rpcError) throw rpcError;

        if (!data || data.length === 0) {
          // No subscription found — default to starter/trialing
          setSubscription(defaultSubscription);
          return;
        }

        const row = data[0];
        const expiryDate = row.current_period_end ?? row.trial_ends_at;
        const daysUntilExpiry = expiryDate
          ? Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null;

        const result: SubscriptionData = {
          subscriptionId: row.subscription_id,
          planSlug: row.plan_slug,
          planName: row.plan_name,
          status: row.status,
          billingCycle: row.billing_cycle,
          priceMonthly: row.price_monthly,
          priceAnnual: row.price_annual,
          maxUsers: row.max_users,
          maxLeads: row.max_leads,
          maxAiTokens: row.max_ai_tokens,
          features: row.features ?? [],
          trialEndsAt: row.trial_ends_at,
          currentPeriodEnd: row.current_period_end,
          stripeCustomerId: row.stripe_customer_id,
          isActive: row.status === 'active' || row.status === 'trialing',
          isTrialing: row.status === 'trialing',
          isPastDue: row.status === 'past_due',
          isCanceled: row.status === 'canceled',
          hasPro: ['pro', 'enterprise'].includes(row.plan_slug ?? ''),
          hasEnterprise: row.plan_slug === 'enterprise',
          daysUntilExpiry,
        };

        cachedSubscription = result;
        cacheExpiry = Date.now() + CACHE_TTL_MS;
        setSubscription(result);
      } catch (err: any) {
        setError(err.message ?? 'Error loading subscription');
        console.error('[useSubscription] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [profile?.company_id]);

  // Super admins bypass all restrictions
  const hasFeature = (requiredPlan: 'starter' | 'pro' | 'enterprise'): boolean => {
    if (isSuperAdmin) return true;
    if (!subscription.isActive) return false;
    const planHierarchy = { starter: 1, pro: 2, enterprise: 3 };
    const userLevel = planHierarchy[subscription.planSlug ?? 'starter'] ?? 0;
    const requiredLevel = planHierarchy[requiredPlan] ?? 0;
    return userLevel >= requiredLevel;
  };

  const invalidateCache = () => {
    cachedSubscription = null;
    cacheExpiry = 0;
  };

  return {
    subscription,
    loading,
    error,
    isSuperAdmin,
    hasFeature,
    invalidateCache,
  };
}
