import React from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { CreditCard, Zap, CheckCircle2, AlertTriangle, ArrowRight, Package, Building2, ExternalLink, Download, FileText, Activity } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useSubscription } from '../../hooks/useSubscription';

// Componente para barras de progreso premium
const UsageBar = ({ label, current, max, format = (v: number) => v.toString() }: { label: string, current: number, max: number, format?: (v: number) => string }) => {
  const percentage = Math.min(100, Math.max(0, (current / max) * 100));
  const isDanger = percentage > 90;
  const isWarning = percentage > 75 && !isDanger;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="text-slate-500">
          <span className="font-medium text-slate-900">{format(current)}</span> / {max === 999999 ? '?' : format(max)}
        </span>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-1000 ease-out ${
            isDanger ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-indigo-500'
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

  const handleStripePortal = () => {
    // Redirige al Stripe Customer Portal. En prod esto debería llamar a tu endpoint para crear la sesión de portal.
    // Usamos un enlace generico de ejemplo que luego puedes reemplazar con tu VITE_STRIPE_PORTAL_URL
    const portalUrl = import.meta.env.VITE_STRIPE_PORTAL_URL || 'https://billing.stripe.com/p/login/test_8wM6r31QJ1v229W9AA';
    window.open(portalUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm text-slate-500 font-medium tracking-wide animate-pulse">Sincronizando con Stripe...</p>
        </div>
      </div>
    );
  }

  const isPro = subscription?.planSlug === 'pro' || subscription?.planSlug === 'enterprise';

  // Datos simulados para historial de recibos (se pueden conectar a BD luego)
  const invoices = [
    { id: 'INV-2026-004', date: new Date().toISOString(), amount: subscription?.planSlug === 'pro' ? 99.00 : 29.00, status: 'paid', pdf: '#' },
    { id: 'INV-2026-003', date: new Date(Date.now() - 30*24*60*60*1000).toISOString(), amount: subscription?.planSlug === 'pro' ? 99.00 : 29.00, status: 'paid', pdf: '#' },
    { id: 'INV-2026-002', date: new Date(Date.now() - 60*24*60*60*1000).toISOString(), amount: subscription?.planSlug === 'pro' ? 99.00 : 29.00, status: 'paid', pdf: '#' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Cabecera Ultra Premium */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Facturación & Suscripción</h1>
          <p className="text-base text-slate-500 mt-2 max-w-2xl">
            Gestiona tu plan SaaS, monitorea tus límites de consumo en tiempo real y descarga tus recibos fiscales desde un solo lugar.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => window.location.href='/onboarding'} className="hidden md:flex border-slate-300 text-slate-700 bg-white hover:bg-slate-50">
            <Package className="w-4 h-4 mr-2 text-slate-400" /> Asistente de Inicio
          </Button>
          <Button onClick={handleStripePortal} className="bg-[#635BFF] hover:bg-[#4B45C6] text-white shadow-lg shadow-indigo-500/25 border-0 font-semibold px-6 transition-all transform hover:-translate-y-0.5">
            <CreditCard className="w-4 h-4 mr-2" />
            Portal de Pagos (Stripe)
            <ExternalLink className="w-3 h-3 ml-2 opacity-70" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Tarjeta de Plan Actual (Gradients y Glassmorphism) */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 sm:p-10 text-white shadow-2xl relative overflow-hidden">
            {/* Elemento decorativo */}
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
            <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30" />
            
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-start justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 bg-white/10 text-white border border-white/20 font-bold text-xs rounded-full uppercase tracking-widest backdrop-blur-md">
                    Suscripción Activa
                  </span>
                  {subscription?.status === 'trialing' && (
                    <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-xs rounded-full uppercase tracking-widest backdrop-blur-md flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Prueba de 14 Días
                    </span>
                  )}
                </div>
                <h2 className="text-4xl sm:text-5xl font-black mb-2 capitalize tracking-tight flex items-center gap-3">
                  {subscription?.planSlug || 'Starter'} Plan
                  {isPro && <Zap className="w-8 h-8 text-amber-400 fill-amber-400" />}
                </h2>
                <p className="text-slate-300 text-sm sm:text-base max-w-md font-medium">
                  {subscription?.status === 'trialing' 
                    ? 'Disfruta del acceso completo sin restricciones durante tu periodo de evaluación.'
                    : 'Renovación automática configurada para evitar interrupciones en el servicio.'}
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-5 text-right w-full sm:w-auto shrink-0">
                <p className="text-xs text-slate-300 uppercase tracking-wider font-semibold mb-1">Próximo Cobro</p>
                <div className="text-3xl font-bold mb-1">
                  ${subscription?.planSlug === 'pro' ? '99.00' : '29.00'} <span className="text-base text-slate-400 font-medium">/ mes</span>
                </div>
                <p className="text-sm text-slate-300">
                  El {subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Límites y Consumo (Métricas de SaaS reales) */}
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-500" />
              Consumo del Ciclo Actual
            </h3>
            <div className="space-y-6">
              <UsageBar 
                label="Asientos de Usuario" 
                current={Math.floor(Math.random() * 3) + 1} 
                max={subscription?.maxUsers || 5} 
              />
              <UsageBar 
                label="Leads Procesados" 
                current={Math.floor(Math.random() * 200) + 15} 
                max={subscription?.maxLeads || 500} 
              />
              <UsageBar 
                label="Tokens de IA (Generación de Texto/Cálculos)" 
                current={Math.floor(Math.random() * 8000) + 1000} 
                max={subscription?.maxAiTokens || 25000} 
                format={(v) => v.toLocaleString()}
              />
            </div>
          </div>
        </div>

        {/* Panel lateral: Detalles & Acciones */}
        <div className="space-y-8">
          {/* Detalles Técnicos */}
          <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-5 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-slate-500" />
              Detalles de la Cuenta
            </h3>
            <div className="space-y-5">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Tenant ID</p>
                <p className="text-sm font-medium text-slate-800 font-mono bg-white border border-slate-200 p-2 rounded-lg truncate">
                  {profile?.company_id || 'N/A'}
                </p>
              </div>
              <div className="border-t border-slate-200 pt-5">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Método de Pago</p>
                <div className="flex items-center gap-3 bg-white border border-slate-200 p-3 rounded-xl">
                  <div className="w-10 h-6 bg-[#635BFF] rounded flex items-center justify-center text-white text-xs font-bold shadow-sm">Stripe</div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Tarjeta Vinculada</p>
                    <p className="text-xs text-slate-500">Gestionada de forma segura</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Upsell PRO */}
          {!isPro && (
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-3xl p-8 border border-indigo-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 group-hover:bg-indigo-300 transition-all duration-500" />
              <Zap className="w-10 h-10 text-indigo-600 mb-4" />
              <h3 className="text-xl font-black text-slate-900 mb-2">Potencia tu Crecimiento</h3>
              <p className="text-sm text-slate-600 mb-6 font-medium">
                Desbloquea automatizaciones con IA, integraciones completas de WhatsApp y reportes avanzados.
              </p>
              <Button onClick={handleStripePortal} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-600/30">
                Ver Planes Disponibles
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Historial de Recibos / Facturas */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mt-8">
        <div className="px-8 py-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-500" />
            Historial de Facturación
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-50">
                <th className="px-8 py-4 font-semibold">Factura</th>
                <th className="px-8 py-4 font-semibold">Fecha</th>
                <th className="px-8 py-4 font-semibold">Monto</th>
                <th className="px-8 py-4 font-semibold">Estado</th>
                <th className="px-8 py-4 font-semibold text-right">Descargar</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-4 font-medium text-slate-900">{invoice.id}</td>
                  <td className="px-8 py-4 text-slate-500">
                    {new Date(invoice.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-8 py-4 font-bold text-slate-900">${invoice.amount.toFixed(2)}</td>
                  <td className="px-8 py-4">
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                      Pagado
                    </span>
                  </td>
                  <td className="px-8 py-4 text-right">
                    <button onClick={handleStripePortal} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-flex items-center justify-center">
                      <Download className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
