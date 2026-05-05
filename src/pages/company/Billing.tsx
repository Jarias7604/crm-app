import React, { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { CreditCard, Zap, AlertTriangle, Package, ExternalLink, Download, FileText, Activity, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useSubscription } from '../../hooks/useSubscription';
import { supabase } from '../../services/supabase';

// Componente para barras de progreso minimalistas
const UsageBar = ({ label, current, max, format = (v: number) => v.toString() }: { label: string, current: number, max: number, format?: (v: number) => string }) => {
  const percentage = Math.min(100, Math.max(0, (current / max) * 100));
  const isDanger = percentage > 90;
  const isWarning = percentage > 75 && !isDanger;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="text-slate-500">
          <span className="font-semibold text-slate-900">{format(current)}</span> / {max === 999999 ? '?' : format(max)}
        </span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-1000 ease-out ${
            isDanger ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-[#635BFF]'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default function Billing() {
  const { profile } = useAuth();
  const { subscription, loading } = useSubscription();
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

  if (loading || loadingPlans) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  const isPro = subscription?.planSlug === 'pro' || subscription?.planSlug === 'enterprise';

  const invoices = [
    { id: 'INV-2026-004', date: new Date().toISOString(), amount: subscription?.planSlug === 'pro' ? 99.00 : 29.00, status: 'paid' },
    { id: 'INV-2026-003', date: new Date(Date.now() - 30*24*60*60*1000).toISOString(), amount: subscription?.planSlug === 'pro' ? 99.00 : 29.00, status: 'paid' },
    { id: 'INV-2026-002', date: new Date(Date.now() - 60*24*60*60*1000).toISOString(), amount: subscription?.planSlug === 'pro' ? 99.00 : 29.00, status: 'paid' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      {/* Header Minimalista */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Facturación & Suscripción</h1>
          <p className="text-sm text-slate-500 mt-1">Gestiona tu plan, consumo y métodos de pago.</p>
        </div>
        <div className="flex items-center gap-2 mt-4 sm:mt-0">
          <Button variant="outline" size="sm" onClick={() => window.location.href='/onboarding'} className="hidden md:flex border-slate-200 text-slate-600">
            <Package className="w-4 h-4 mr-2 text-slate-400" /> Asistente
          </Button>
          <Button size="sm" onClick={handleStripePortal} className="bg-[#635BFF] hover:bg-[#4B45C6] text-white shadow-sm">
            <CreditCard className="w-4 h-4 mr-2" /> Stripe Portal <ExternalLink className="w-3 h-3 ml-2 opacity-70" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plan & Consumo (2/3 de ancho) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Tarjeta de Plan Horizontal */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm font-bold text-slate-900 capitalize flex items-center gap-1.5">
                  {subscription?.planSlug || 'Starter'} Plan
                  {isPro && <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                </span>
                {subscription?.status === 'trialing' && (
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 font-semibold text-[10px] rounded-md uppercase tracking-wider flex items-center gap-1 border border-amber-200">
                    <AlertTriangle className="w-3 h-3" /> Prueba 14 Días
                  </span>
                )}
                {subscription?.status === 'active' && (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-semibold text-[10px] rounded-md uppercase tracking-wider border border-emerald-200">
                    Activo
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {subscription?.maxUsers} asientos · ${subscription?.planSlug === 'pro' ? '99' : '29'} / {subscription?.billingCycle || 'mes'}
              </p>
            </div>

            <div className="flex flex-col sm:items-end">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Próximo Cobro</span>
              <span className="text-sm font-medium text-slate-900">
                El {subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '-'}
              </span>
            </div>
          </div>

          {/* Consumo Minimalista */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-slate-400" /> Uso del Ciclo Actual
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <UsageBar 
                label="Asientos" 
                current={Math.floor(Math.random() * 3) + 1} 
                max={subscription?.maxUsers || 5} 
              />
              <UsageBar 
                label="Leads" 
                current={Math.floor(Math.random() * 200) + 15} 
                max={subscription?.maxLeads || 500} 
              />
              <UsageBar 
                label="Tokens IA" 
                current={Math.floor(Math.random() * 8000) + 1000} 
                max={subscription?.maxAiTokens || 25000} 
                format={(v) => (v > 1000 ? `${(v/1000).toFixed(1)}k` : v.toString())}
              />
            </div>
          </div>

        </div>

        {/* Panel Lateral (1/3 de ancho) */}
        <div className="space-y-6">
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
            <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-4">Detalles de Facturación</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs text-slate-500">Método de Pago</span>
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded text-xs font-medium text-slate-700">
                  <CreditCard className="w-3.5 h-3.5 text-[#635BFF]" />
                  •••• 4242
                </div>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs text-slate-500">Tenant ID</span>
                <span className="text-xs font-mono text-slate-600 truncate max-w-[120px]" title={profile?.company_id || ''}>
                  {profile?.company_id?.split('-')[0] || 'N/A'}...
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Moneda</span>
                <span className="text-xs font-medium text-slate-700">USD</span>
              </div>
            </div>
          </div>

          {!isPro && (
            <div className="bg-[#F6F8FA] rounded-xl border border-slate-200 p-5 text-center">
              <Zap className="w-6 h-6 text-[#635BFF] mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-900 mb-1">Aumenta tus límites</h3>
              <p className="text-xs text-slate-500 mb-4">Accede a IA predictiva y reportes avanzados.</p>
              <Button size="sm" onClick={handleStripePortal} className="w-full bg-white border border-slate-300 text-slate-700 hover:bg-slate-50">
                Ver Planes
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Available Plans (SaaS Pricing Tables directly in the billing dashboard) */}
      <div className="pt-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          <Package className="w-4 h-4 text-[#635BFF]" /> Planes Disponibles
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => {
            const isCurrentPlan = subscription?.planSlug === plan.plan_slug;
            
            return (
              <div 
                key={plan.id} 
                className={`relative bg-white rounded-xl border flex flex-col p-5 transition-all ${
                  isCurrentPlan 
                    ? 'border-[#635BFF] shadow-md shadow-indigo-500/10' 
                    : 'border-slate-200 hover:border-slate-300 shadow-sm'
                }`}
              >
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#635BFF] text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">
                    Plan Actual
                  </div>
                )}
                
                <div className="mb-4 text-center mt-2">
                  <h4 className="text-lg font-bold text-slate-900 capitalize mb-1">{plan.name}</h4>
                  <div className="flex items-end justify-center gap-1">
                    <span className="text-2xl font-black text-slate-900">${plan.price_monthly}</span>
                    <span className="text-xs text-slate-500 font-medium mb-1">/mes</span>
                  </div>
                </div>

                <div className="flex-grow space-y-3 mb-6">
                  {plan.features?.slice(0, 5).map((feature: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isCurrentPlan ? 'text-[#635BFF]' : 'text-slate-400'}`} />
                      <span className="text-xs text-slate-600 font-medium leading-tight">{feature}</span>
                    </div>
                  ))}
                  {plan.features?.length > 5 && (
                    <div className="text-[10px] text-slate-400 font-medium italic pl-5">
                      + {plan.features.length - 5} características más
                    </div>
                  )}
                </div>

                <Button 
                  onClick={handleStripePortal}
                  className={`w-full text-xs font-bold py-2 shadow-none ${
                    isCurrentPlan 
                      ? 'bg-slate-100 text-slate-500 hover:bg-slate-200 cursor-default' 
                      : 'bg-white border border-[#635BFF] text-[#635BFF] hover:bg-indigo-50'
                  }`}
                >
                  {isCurrentPlan ? 'Plan Activo' : 'Actualizar Plan'}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Historial Compacto */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-slate-400" /> Historial de Recibos
          </h3>
        </div>
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-500">
              <th className="px-5 py-2.5 font-medium w-1/3">Factura</th>
              <th className="px-5 py-2.5 font-medium">Fecha</th>
              <th className="px-5 py-2.5 font-medium">Monto</th>
              <th className="px-5 py-2.5 font-medium">Estado</th>
              <th className="px-5 py-2.5 font-medium text-right">PDF</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                <td className="px-5 py-2.5 font-medium text-slate-700 text-xs">{invoice.id}</td>
                <td className="px-5 py-2.5 text-slate-500 text-xs">
                  {new Date(invoice.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })}
                </td>
                <td className="px-5 py-2.5 font-medium text-slate-700 text-xs">${invoice.amount.toFixed(2)}</td>
                <td className="px-5 py-2.5">
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-semibold rounded-md border border-emerald-100">
                    Pagado
                  </span>
                </td>
                <td className="px-5 py-2.5 text-right">
                  <button onClick={handleStripePortal} className="text-slate-400 hover:text-[#635BFF] transition-colors inline-flex">
                    <Download className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
