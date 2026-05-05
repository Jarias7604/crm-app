import React, { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { CreditCard, Zap, CheckCircle2, AlertTriangle, ArrowRight, Package, Building2, ExternalLink } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useSubscription } from '../../hooks/useSubscription';
import { useTranslation } from 'react-i18next';

export default function Billing() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const { subscription, loading, refresh } = useSubscription();

  const handleStripePortal = () => {
    // Placeholder para abrir el portal de Stripe o redireccionar a checkout
    alert("Próximamente: Integración con Stripe Customer Portal.");
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-gray-500 font-medium">Cargando información de facturación...</p>
        </div>
      </div>
    );
  }

  const isPro = subscription?.plan_slug === 'pro' || subscription?.plan_slug === 'enterprise';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Facturación y Planes</h1>
          <p className="text-sm text-slate-500 mt-1">Administra tu suscripción, métodos de pago y límites de uso.</p>
        </div>
        <Button onClick={handleStripePortal} className="bg-indigo-600 hover:bg-indigo-700 shadow-md">
          <CreditCard className="w-4 h-4 mr-2" />
          Administrar en Stripe
          <ExternalLink className="w-3 h-3 ml-2 opacity-70" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Current Plan Card */}
        <div className="col-span-1 md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
            <Zap className="w-32 h-32 text-indigo-600" />
          </div>
          <div className="p-6 sm:p-8 relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 bg-indigo-100 text-indigo-700 font-bold text-xs rounded-full uppercase tracking-wider">
                Plan Actual
              </span>
              {subscription?.status === 'trialing' && (
                <span className="px-3 py-1 bg-amber-100 text-amber-700 font-bold text-xs rounded-full uppercase tracking-wider">
                  En Prueba
                </span>
              )}
            </div>
            <h2 className="text-3xl font-black text-slate-900 mb-1 capitalize">
              {subscription?.plan_slug || 'Starter'}
            </h2>
            <p className="text-slate-500 text-sm mb-6 max-w-md">
              {subscription?.status === 'trialing' 
                ? 'Estás en un periodo de prueba gratuito que te da acceso a todas las funciones premium.'
                : 'Tienes acceso a las funciones correspondientes a tu plan activo.'}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Usuarios</div>
                <div className="text-xl font-bold text-slate-800">{subscription?.max_users || 5}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Leads</div>
                <div className="text-xl font-bold text-slate-800">{subscription?.max_leads === 999999 ? 'Ilimitados' : (subscription?.max_leads || 500)}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Tokens IA</div>
                <div className="text-xl font-bold text-slate-800">{subscription?.max_ai_tokens?.toLocaleString() || '25k'}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Renovación</div>
                <div className="text-xl font-bold text-slate-800">
                  {subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : '-'}
                </div>
              </div>
            </div>

            {!isPro && (
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-lg shadow-indigo-500/20">
                <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Zap className="w-5 h-5 text-amber-300" />
                      Sube de nivel con el Plan Pro
                    </h3>
                    <p className="text-indigo-100 text-sm mt-1 max-w-md">
                      Desbloquea Marketing Hub, Agentes IA, Bandeja Omnicanal y límites extendidos para tu equipo.
                    </p>
                  </div>
                  <Button className="bg-white text-indigo-600 hover:bg-slate-50 whitespace-nowrap" onClick={handleStripePortal}>
                    Actualizar Plan <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions / Info */}
        <div className="col-span-1 flex flex-col gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-slate-400" />
              Datos de Facturación
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Empresa</label>
                <div className="text-sm font-medium text-slate-800 mt-1">{subscription?.company_id ? 'Registrada' : 'N/A'}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Método de Pago</label>
                <div className="flex items-center gap-2 mt-1">
                  <CreditCard className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-800">Termina en •••• (Stripe)</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ciclo</label>
                <div className="text-sm font-medium text-slate-800 mt-1 capitalize">{subscription?.billing_cycle || 'Mensual'}</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col items-center justify-center text-center">
            <Package className="w-8 h-8 text-slate-400 mb-3" />
            <h3 className="text-sm font-bold text-slate-900 mb-1">Onboarding Completo</h3>
            <p className="text-xs text-slate-500 mb-4">Revisa la configuración inicial de tu cuenta y los módulos activados.</p>
            <Button variant="outline" size="sm" onClick={() => window.location.href='/onboarding'} className="w-full">
              Abrir Asistente de Inicio
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
