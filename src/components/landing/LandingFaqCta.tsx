import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const FAQS = [
  {
    qES: '¿Cómo funciona la captura de leads de TikTok e Instagram?',
    qEN: 'How does lead capture from TikTok and Instagram work?',
    aES: 'Nos conectamos directamente a las APIs oficiales de TikTok Events y Meta Leads. Cuando un usuario llena un anuncio de formulario, el lead se inyecta en milisegundos en Arias CRM y activa opcionalmente el AI bot para contactarlo al instante.',
    aEN: 'We connect directly to the official TikTok Events and Meta Leads APIs. When a user fills out a lead form ad, the lead is injected in milliseconds into Arias CRM and optionally activates the AI bot to contact them instantly.',
  },
  {
    qES: '¿Qué es el Lead Hunter?',
    qEN: 'What is the Lead Hunter?',
    aES: 'Es nuestro extractor exclusivo de datos B2B. Ingresas un sector (ej: "Gimnasios") y una ciudad, y extrae automáticamente nombres, teléfonos oficiales y direcciones de Google Maps, inyectando cientos de leads cualificados en un clic.',
    aEN: 'It is our exclusive B2B data extractor. You enter an industry (e.g. "Gyms") and a city, and it automatically extracts names, official phones and addresses from Google Maps, injecting hundreds of qualified leads in one click.',
  },
  {
    qES: '¿Tengo que firmar un contrato a largo plazo?',
    qEN: 'Do I have to sign a long-term contract?',
    aES: 'No. El plan mensual se puede cancelar en cualquier momento sin penalizaciones. Si eliges el plan anual, obtienes un 25% de descuento directo en tu facturación.',
    aEN: 'No. The monthly plan can be canceled at any time without penalties. If you choose the annual plan, you get a direct 25% discount on your billing.',
  },
  {
    qES: '¿El AI Agent funciona con mi propio número de WhatsApp?',
    qEN: 'Does the AI Agent work with my own WhatsApp number?',
    aES: 'Sí, puedes conectar tu número empresarial mediante el flujo oficial de Meta (WhatsApp Business API) con un clic. El sistema guarda tu token y phone ID automáticamente.',
    aEN: 'Yes, you can connect your business number through the official Meta flow (WhatsApp Business API) with one click. The system saves your token and phone ID automatically.',
  },
  {
    qES: '¿Puedo tener múltiples agentes de ventas en diferentes números?',
    qEN: 'Can I have multiple sales agents on different numbers?',
    aES: 'Sí. Con los Workspaces puedes crear canales independientes para cada agente o departamento, cada uno con su propio número de WhatsApp, leads aislados y conversaciones privadas.',
    aEN: 'Yes. With Workspaces you can create independent channels for each agent or department, each with their own WhatsApp number, isolated leads and private conversations.',
  },
];

const WHY_ITEMS = [
  { icon: '⚡', titleES: '3× más cierres', titleEN: '3× more closes', descES: 'AI scoring, seguimientos automáticos y cotizador integrado hacen que tu equipo cierre sin esfuerzo extra.', descEN: 'AI scoring, automatic follow-ups and integrated quoter make your team close without extra effort.' },
  { icon: '🔒', titleES: 'Seguridad enterprise', titleEN: 'Enterprise security', descES: 'Multi-tenant con Row Level Security. Datos 100% aislados por empresa, nunca mezclados.', descEN: 'Multi-tenant with Row Level Security. 100% isolated company data, never mixed.' },
  { icon: '🧩', titleES: 'Todo en uno', titleEN: 'All in one', descES: 'CRM + Marketing + Cotizador + AI Agents + Lead Hunter. Sin pagar 5 herramientas diferentes.', descEN: 'CRM + Marketing + Quoting + AI Agents + Lead Hunter. Without paying for 5 different tools.' },
  { icon: '🌎', titleES: 'Multi-empresa', titleEN: 'Multi-company', descES: 'Agencias y franquicias gestionan múltiples clientes desde una sola plataforma unificada.', descEN: 'Agencies and franchises manage multiple clients from a single unified platform.' },
  { icon: '📈', titleES: 'Analytics en vivo', titleEN: 'Live Analytics', descES: 'Dashboard con tendencias de venta, análisis de leads perdidos y rendimiento por agente.', descEN: 'Dashboard with sales trends, lost lead analysis and per-agent performance.' },
  { icon: '🤝', titleES: 'Soporte real', titleEN: 'Real Support', descES: 'Onboarding en español, soporte en vivo y un equipo que entiende el mercado latinoamericano.', descEN: 'Spanish onboarding, live support and a team that understands the Latin American market.' },
];

export default function LandingFaqCta() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isES = i18n.language?.startsWith('es');
  const t = (es: string, en: string) => isES ? es : en;

  return (
    <>
      {/* Why Us section */}
      <section className="bg-gray-50 py-24 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-black text-red-600 uppercase tracking-[0.25em]">
              {t('¿Por qué Arias CRM?', 'Why Arias CRM?')}
            </span>
            <h2 className="text-4xl lg:text-5xl font-black text-gray-900 mt-3">
              {t('Construido diferente. Por razones.', 'Built differently. For a reason.')}
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHY_ITEMS.map((item, i) => (
              <div key={i} className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-lg font-black text-gray-900 mb-2">{isES ? item.titleES : item.titleEN}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{isES ? item.descES : item.descEN}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ section */}
      <section className="bg-white py-24 border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-black text-red-600 uppercase tracking-[0.25em]">
              {t('Preguntas Frecuentes', 'Frequently Asked Questions')}
            </span>
            <h2 className="text-4xl font-black text-gray-900 mt-3">
              {t('Respuestas directas', 'Straight answers')}
            </h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="border border-gray-100 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-bold text-gray-900 pr-4">{isES ? faq.qES : faq.qEN}</span>
                  {openFaq === i
                    ? <Minus className="w-4 h-4 text-red-500 flex-shrink-0" />
                    : <Plus className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-6 text-sm text-gray-600 leading-relaxed border-t border-gray-50 pt-4">
                    {isES ? faq.aES : faq.aEN}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-to-br from-[#1a2b5e] via-[#1d3a8a] to-[#0f172a] py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl lg:text-5xl font-black text-white mb-6 leading-tight">
            {t('Tu equipo de ventas merece mejores herramientas.', 'Your sales team deserves better tools.')}
          </h2>
          <p className="text-blue-200/70 text-lg mb-10 max-w-2xl mx-auto">
            {t('Empieza gratis hoy. Sin tarjeta de crédito. Sin contratos. Sin límites de tiempo.', 'Start free today. No credit card. No contracts. No time limits.')}
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button
              onClick={() => navigate('/register')}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-black px-10 py-5 rounded-2xl transition-all text-base shadow-2xl shadow-red-600/30"
            >
              {t('Comenzar prueba gratis — 14 días', 'Start free trial — 14 days')}
              <ArrowRight className="w-5 h-5" />
            </button>
            <a
              href="https://wa.me/50372718911?text=Hola,%20quiero%20saber%20m%C3%A1s%20sobre%20Arias%20CRM"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-8 py-5 rounded-2xl border border-white/20 transition-all text-base"
            >
              <svg viewBox="0 0 24 24" fill="#25D366" className="w-5 h-5">
                <path d="M12.012 2C6.485 2 2 6.487 2 12.012c0 1.767.46 3.426 1.262 4.887L2 22l5.234-1.373a9.98 9.98 0 004.778 1.208c5.527 0 10.012-4.485 10.012-10.012C22.024 6.487 17.539 2 12.012 2z" />
              </svg>
              {t('Hablar con ventas', 'Talk to sales')}
            </a>
          </div>
          <div className="mt-10 flex items-center justify-center gap-8 flex-wrap">
            {[
              t('✓ Sin tarjeta de crédito', '✓ No credit card'),
              t('✓ Cancela cuando quieras', '✓ Cancel anytime'),
              t('✓ Soporte en español', '✓ Spanish support'),
              t('✓ Configuración en 5 min', '✓ 5-min setup'),
            ].map((item, i) => (
              <span key={i} className="text-sm text-blue-200/60 font-medium">{item}</span>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
