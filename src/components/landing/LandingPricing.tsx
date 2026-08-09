import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const PLANS = [
  {
    name: 'Starter',
    slug: 'starter',
    monthly: 65,
    annual: 49,
    usersES: 'Hasta 3 usuarios',
    usersEN: 'Up to 3 users',
    descES: 'Esencial para equipos pequeños que inician.',
    descEN: 'Essential for small teams getting started.',
    color: 'border-gray-200',
    features: {
      es: ['Pipeline Kanban visual', 'Cotizador + PDF profesional', '1 AI Bot (WhatsApp/Telegram)', 'Campañas de email', 'Reportes básicos de ventas'],
      en: ['Visual Kanban pipeline', 'Quote generator + PDF', '1 AI Bot (WhatsApp/Telegram)', 'Email campaigns', 'Basic sales reports'],
    }
  },
  {
    name: 'Growth',
    slug: 'growth',
    monthly: 129,
    annual: 99,
    usersES: 'Hasta 8 usuarios',
    usersEN: 'Up to 8 users',
    descES: 'La suite completa para escalar sin límites.',
    descEN: 'The complete suite to scale without limits.',
    popular: true,
    color: 'border-red-500',
    features: {
      es: ['Todo en Starter', 'Flyer Studio con IA', 'Lead Hunter (Google Maps)', 'Captura TikTok + Meta Leads', 'Workspaces multi-agente', 'Reportes analíticos avanzados'],
      en: ['Everything in Starter', 'Flyer Studio with AI', 'Lead Hunter (Google Maps)', 'TikTok + Meta Leads capture', 'Multi-agent workspaces', 'Advanced analytics'],
    }
  },
  {
    name: 'Pro',
    slug: 'pro',
    monthly: 199,
    annual: 159,
    usersES: 'Hasta 15 usuarios',
    usersEN: 'Up to 15 users',
    descES: 'Arquitectura empresarial para grandes operaciones.',
    descEN: 'Enterprise architecture for large operations.',
    color: 'border-gray-200',
    features: {
      es: ['Todo en Growth', 'API REST & Webhooks avanzados', 'Inbox omnicanal unificado', 'Multi-workspace corporativo', 'Workflows visuales automatizados', 'SLA garantizado 99.9%'],
      en: ['Everything in Growth', 'Advanced REST API & Webhooks', 'Unified omnichannel inbox', 'Corporate multi-workspace', 'Automated visual workflows', 'Guaranteed SLA 99.9%'],
    }
  },
];

const COMPARE_ROWS = [
  { featureES: 'Captura de leads TikTok / Meta', featureEN: 'TikTok / Meta lead capture', us: true, hub: false, sf: false },
  { featureES: 'Agente IA en WhatsApp 24/7', featureEN: '24/7 AI Agent on WhatsApp', us: true, hub: false, sf: false },
  { featureES: 'Cotizador integrado + PDF', featureEN: 'Integrated quote generator + PDF', us: true, hub: false, sf: false },
  { featureES: 'Lead Hunter (Google Maps)', featureEN: 'Lead Hunter (Google Maps)', us: true, hub: false, sf: false },
  { featureES: 'Flyer Studio con IA', featureEN: 'Flyer Studio with AI', us: true, hub: false, sf: false },
  { featureES: 'Pipeline Kanban visual', featureEN: 'Visual Kanban pipeline', us: true, hub: true, sf: true },
  { featureES: 'Bandeja omnicanal colaborativa', featureEN: 'Collaborative omnichannel inbox', us: true, hub: true, sf: true },
  { featureES: 'Precio mensual base', featureEN: 'Base monthly price', us: '$65', hub: '$890', sf: '$150+' },
];

const Check = ({ ok, label }: { ok: boolean | string; label?: string }) => {
  if (typeof ok === 'string') return <span className="text-sm font-black text-gray-800">{ok}</span>;
  return ok
    ? <span className="inline-flex w-6 h-6 rounded-full bg-emerald-100 items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={3} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
      </span>
    : <span className="inline-flex w-6 h-6 rounded-full bg-gray-100 items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={3} className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </span>;
};

export default function LandingPricing() {
  const [annual, setAnnual] = useState(true);
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isES = i18n.language?.startsWith('es');
  const t = (es: string, en: string) => isES ? es : en;

  return (
    <section className="bg-white py-24 border-b border-gray-100" id="pricing">
      <div className="max-w-7xl mx-auto px-6">

        {/* Header */}
        <div className="text-center mb-16">
          <span className="text-xs font-black text-red-600 uppercase tracking-[0.25em]">
            {t('Precios Claros', 'Clear Pricing')}
          </span>
          <h2 className="text-4xl lg:text-5xl font-black text-gray-900 mt-3">
            {t('Sin sorpresas. Sin contratos.', 'No surprises. No contracts.')}
          </h2>
          <p className="text-gray-500 mt-4 text-lg">
            {t('Cancela cuando quieras. El plan anual incluye 2 meses gratis.', 'Cancel anytime. Annual plan includes 2 months free.')}
          </p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-4 mt-8 bg-gray-100 p-1.5 rounded-full">
            <button
              onClick={() => setAnnual(false)}
              className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${!annual ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
            >
              {t('Mensual', 'Monthly')}
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${annual ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
            >
              {t('Anual', 'Annual')}
              <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">-25%</span>
            </button>
          </div>
        </div>

        {/* Plans grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {PLANS.map((plan) => (
            <div
              key={plan.slug}
              className={`relative rounded-3xl border-2 ${plan.color} p-8 ${plan.popular ? 'shadow-2xl shadow-red-100 bg-white ring-2 ring-red-500' : 'bg-white shadow-sm'} transition-transform hover:-translate-y-1`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs font-black px-6 py-1.5 rounded-full shadow">
                  {t('MÁS POPULAR', 'MOST POPULAR')}
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-black text-gray-900 mb-1">{plan.name}</h3>
                <p className="text-sm text-gray-500">{isES ? plan.descES : plan.descEN}</p>
              </div>

              <div className="mb-2">
                <div className="flex items-end gap-1">
                  <span className="text-5xl font-black text-gray-900">
                    ${annual ? plan.annual : plan.monthly}
                  </span>
                  <span className="text-gray-400 mb-2 text-sm">/mo</span>
                </div>
                {annual && (
                  <p className="text-xs text-gray-400">
                    {t('Facturado anualmente', 'Billed annually')} (${(annual ? plan.annual : plan.monthly) * 12}/yr)
                  </p>
                )}
              </div>

              <p className="text-xs text-gray-400 mb-6 pb-6 border-b border-gray-100">
                {isES ? plan.usersES : plan.usersEN}
              </p>

              <ul className="space-y-3 mb-8">
                {plan.features[isES ? 'es' : 'en'].map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={3} className="w-4 h-4 flex-shrink-0 mt-0.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => navigate('/register')}
                className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all ${
                  plan.popular
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/25'
                    : 'bg-gray-900 hover:bg-gray-800 text-white'
                }`}
              >
                {t('Empezar gratis', 'Get started free')}
              </button>
            </div>
          ))}
        </div>

        {/* Comparison table */}
        <div>
          <h3 className="text-2xl font-black text-gray-900 text-center mb-8">
            {t('¿Por qué Arias CRM vs HubSpot?', 'Why Arias CRM vs HubSpot?')}
          </h3>
          <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-4 text-sm font-black text-gray-700 w-1/2">
                    {t('Característica', 'Feature')}
                  </th>
                  <th className="px-6 py-4 text-center">
                    <span className="inline-block bg-red-600 text-white text-xs font-black px-4 py-1.5 rounded-full">Arias CRM</span>
                  </th>
                  <th className="px-6 py-4 text-center">
                    <span className="text-sm font-bold text-gray-400">HubSpot</span>
                  </th>
                  <th className="px-6 py-4 text-center">
                    <span className="text-sm font-bold text-gray-400">Salesforce</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row, i) => (
                  <tr key={i} className={`border-b border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                      {isES ? row.featureES : row.featureEN}
                    </td>
                    <td className="px-6 py-4 text-center"><Check ok={row.us} /></td>
                    <td className="px-6 py-4 text-center"><Check ok={row.hub} /></td>
                    <td className="px-6 py-4 text-center"><Check ok={row.sf} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-center text-xs text-gray-400 mt-4">
            {t('* Precios de HubSpot y Salesforce basados en tarifas públicas para pymes con funcionalidades equivalentes.', '* HubSpot and Salesforce prices based on public rates for SMBs with equivalent features.')}
          </p>
        </div>
      </div>
    </section>
  );
}
