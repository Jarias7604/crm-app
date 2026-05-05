import React, { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { CreditCard, Zap, AlertTriangle, Package, ExternalLink, Download, FileText, Activity, CheckCircle2, Clock, XCircle, Shield, ChevronRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useSubscription } from '../../hooks/useSubscription';
import { useBillingData } from '../../hooks/useBillingData';
import { supabase } from '../../services/supabase';

// ── Usage Progress Bar ──────────────────────────────────────
const UsageBar = ({ label, current, max, format = (v: number) => v.toString() }: { label: string; current: number; max: number; format?: (v: number) => string }) => {
  const pct = Math.min(100, Math.max(0, (current / max) * 100));
  const color = pct > 90 ? 'bg-red-500' : pct > 75 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="flex-1 min-w-[140px]">
      <div className="flex justify-between text-xs mb-1.5">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="text-slate-500 tabular-nums"><span className="font-bold text-slate-800">{format(current)}</span> / {max >= 999999 ? '∞' : format(max)}</span>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ease-out ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

// ── Invoice Status Badge ────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { dot: string; text: string; label: string }> = {
    paid:     { dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Pagado' },
    pending:  { dot: 'bg-amber-500',   text: 'text-amber-700',  label: 'Pendiente' },
    failed:   { dot: 'bg-red-500',     text: 'text-red-700',    label: 'Fallido' },
    refunded: { dot: 'bg-slate-400',   text: 'text-slate-600',  label: 'Reembolsado' },
    draft:    { dot: 'bg-slate-300',   text: 'text-slate-500',  label: 'Borrador' },
    void:     { dot: 'bg-slate-300',   text: 'text-slate-400',  label: 'Anulado' },
  };
  const c = map[status] || map.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${c.text}`}>
      <span className={`w-2 h-2 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
};

// ── Plan Feature Item ───────────────────────────────────────
const Feature = ({ text, accent }: { text: string; accent: boolean }) => (
  <div className="flex items-start gap-2 py-0.5">
    <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${accent ? 'text-emerald-500' : 'text-slate-300'}`} />
    <span className="text-sm text-slate-700 leading-snug">{text}</span>
  </div>
);

export default function Billing() {
  const { profile } = useAuth();
  const { subscription, loading } = useSubscription();
  const { invoices, usage, loading: loadingBilling } = useBillingData();
  const [plans, setPlans] = useState<any[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  useEffect(() => {
    async function fetchPlans() {
      try {
        const { data, error } = await supabase
          .from('saas_plans')
          .select('*')
          .eq('is_active', true)
          .order('price_monthly', { ascending: true });
        if (error) throw error;
        setPlans(data || []);
      } catch (err) {
        console.error('Error fetching plans:', err);
      } finally {
        setLoadingPlans(false);
      }
    }
    fetchPlans();
  }, []);

  const handleStripePortal = () => {
    const portalUrl = import.meta.env.VITE_STRIPE_PORTAL_URL || 'https://billing.stripe.com/p/login/test_8wM6r31QJ1v229W9AA';
    window.open(portalUrl, '_blank');
  };

  const handleDownloadInvoice = (inv: any) => {
    if (inv.pdfUrl) window.open(inv.pdfUrl, '_blank');
    else if (inv.stripeHostedUrl) window.open(inv.stripeHostedUrl, '_blank');
    else handleStripePortal();
  };

  if (loading || loadingPlans || loadingBilling) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  const isPro = subscription?.planSlug === 'pro' || subscription?.planSlug === 'enterprise';

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 px-1">

      {/* ─── HEADER ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Subscription & Billing</h1>
            <p className="text-sm text-slate-500 mt-0.5">Manage active plan and 501(c)(3) taxpayer status</p>
          </div>
        </div>
      </div>

      {/* ─── PLAN + STRIPE + TAX ROW ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Plan Card (3/5) */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-black text-slate-900 capitalize">
                  {subscription?.planName || subscription?.planSlug || 'Free'}
                </h2>
                {subscription?.isActive && (
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 text-[11px] font-black rounded-full uppercase tracking-wide border border-emerald-200">
                    Active
                  </span>
                )}
                {subscription?.isTrialing && (
                  <span className="px-2.5 py-0.5 bg-amber-100 text-amber-700 text-[11px] font-black rounded-full uppercase tracking-wide border border-amber-200 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Trial
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg text-slate-600">\</span>
                <span className="text-3xl font-black text-slate-900">${subscription?.priceMonthly ?? 0}</span>
                <span className="text-sm text-slate-500 font-medium">/mo</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Next Billing: {subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) : 'N/A'}
              </p>
            </div>
            <button
              onClick={handleStripePortal}
              className="flex items-center gap-2.5 bg-[#635BFF] hover:bg-[#4B45C6] text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-[#635BFF]/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 shrink-0"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <rect width="24" height="24" rx="4" fill="white" fillOpacity="0.2" />
                <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.918 3.757 7.11c0 4.46 2.72 6.024 7.156 7.671 2.811 1.05 3.79 1.825 3.79 2.917 0 .979-.758 1.587-2.172 1.587-1.86 0-4.835-.953-6.763-2.2L4.89 22.62C6.907 23.715 9.857 24 12.165 24c2.643 0 4.814-.637 6.34-1.887 1.633-1.337 2.495-3.251 2.495-5.695 0-4.584-2.779-6.104-7.024-7.268z" fill="white"/>
              </svg>
              Pay with Stripe
            </button>
          </div>
        </div>

        {/* Tax Exemption Card (2/5) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-slate-500" /> Tax Exemption
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Subject to Standard Tax</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs text-slate-500">Tenant ID</span>
              <span className="text-xs font-mono text-slate-600 truncate max-w-[140px]" title={profile?.company_id || ''}>
                {profile?.company_id?.substring(0, 12) || 'N/A'}...
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs text-slate-500">Currency</span>
              <span className="text-xs font-bold text-slate-700">USD</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── AVAILABLE PLANS ────────────────────────────────── */}
      <div>
        <h3 className="text-lg font-black text-slate-900 mb-5 flex items-center gap-2">
          <Package className="w-5 h-5 text-emerald-500" /> Available Plans
        </h3>

        <div className={`grid grid-cols-1 ${plans.length >= 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'} gap-5`}>
          {plans.map((plan) => {
            const isCurrent = subscription?.planSlug === plan.slug;
            const isPopular = plan.slug === 'pro';
            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl border-2 flex flex-col transition-all duration-200 ${
                  isCurrent
                    ? 'border-emerald-400 shadow-lg shadow-emerald-500/10'
                    : isPopular
                    ? 'border-indigo-400 shadow-lg shadow-indigo-500/10'
                    : 'border-slate-200 hover:border-slate-300 shadow-sm'
                }`}
              >
                {/* Current Plan Badge */}
                {isCurrent && (
                  <div className="absolute -top-3.5 left-4">
                    <span className="bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-md">
                      ★ Current Plan
                    </span>
                  </div>
                )}

                <div className="p-6 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className={`w-4 h-4 ${isCurrent ? 'text-emerald-500' : isPopular ? 'text-indigo-500' : 'text-slate-400'}`} />
                    <h4 className="text-lg font-black text-slate-900">{plan.name}</h4>
                  </div>
                  <p className="text-xs text-slate-500 mb-4 min-h-[28px]">{plan.description || `Hasta ${plan.max_users} miembros`}</p>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-3xl font-black text-slate-900">${plan.price_monthly}</span>
                    <span className="text-sm text-slate-400 font-medium">/mo</span>
                  </div>
                </div>

                <div className="flex-grow px-6 pb-4 space-y-1.5">
                  {plan.features?.map((f: string, i: number) => (
                    <Feature key={i} text={f} accent={isCurrent || isPopular} />
                  ))}
                  {plan.features?.length > 6 && (
                    <p className="text-xs text-slate-400 italic pt-1">+ {plan.features.length - 6} more</p>
                  )}
                </div>

                <div className="p-6 pt-3">
                  {isCurrent ? (
                    <div className="w-full py-3 rounded-xl text-center text-sm font-bold text-slate-400 bg-slate-50 border border-slate-200 cursor-default flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Pay ${plan.price_monthly}/mo
                    </div>
                  ) : (
                    <button
                      onClick={handleStripePortal}
                      className={`w-full py-3 rounded-xl text-center text-sm font-bold transition-all border-2 flex items-center justify-center gap-1 ${
                        isPopular
                          ? 'bg-indigo-500 text-white border-indigo-500 hover:bg-indigo-600 shadow-md shadow-indigo-500/20'
                          : 'bg-white text-emerald-600 border-emerald-400 hover:bg-emerald-50'
                      }`}
                    >
                      ↑ Upgrade to {plan.name}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── USAGE METRICS ──────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-5 flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-500" /> Current Cycle Usage
        </h3>
        <div className="flex flex-col sm:flex-row gap-8">
          <UsageBar label="Seats" current={usage.users} max={subscription?.maxUsers || 5} />
          <UsageBar label="Leads" current={usage.leads} max={subscription?.maxLeads || 500} />
          <UsageBar
            label="AI Tokens"
            current={usage.aiTokens}
            max={subscription?.maxAiTokens || 25000}
            format={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toString())}
          />
        </div>
      </div>

      {/* ─── INVOICE HISTORY TABLE ──────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-400" /> SaaS Invoice History
          </h3>
          <span className="text-xs text-slate-400 font-semibold bg-slate-100 px-3 py-1 rounded-full">
            {invoices.length} Payments
          </span>
        </div>

        {invoices.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-400">No invoices yet</p>
            <p className="text-xs text-slate-400 mt-1">Invoices will appear here once a payment is processed.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">N° Factura</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Plan</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Período</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Monto</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.invoiceId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <span className="text-sm font-bold text-slate-800">{inv.invoiceNumber}</span>
                    </td>
                    <td className="px-6 py-3.5 text-sm text-slate-500">
                      {new Date(inv.issuedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize ${
                        inv.planSlug === 'pro' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
                        inv.planSlug === 'enterprise' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                        'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}>
                        {inv.planName || inv.planSlug || 'Starter'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-sm text-slate-500">
                      {inv.billingPeriodStart
                        ? `${new Date(inv.billingPeriodStart).toLocaleDateString('es-ES', { month: 'short' })} – ${new Date(inv.billingPeriodEnd!).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}`
                        : '-'}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="text-sm font-black text-slate-900">${inv.amount.toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {inv.status === 'pending' || inv.status === 'failed' ? (
                        <button
                          onClick={handleStripePortal}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                        >
                          <CreditCard className="w-3 h-3" /> Pagar ahora
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDownloadInvoice(inv)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                          <Download className="w-4 h-4" /> PDF
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
