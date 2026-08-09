import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Play } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useTranslation } from 'react-i18next';

const INTEGRATIONS = [
  {
    name: 'WhatsApp', color: '#25D366',
    svg: <svg viewBox="0 0 24 24" fill="#25D366" className="w-5 h-5"><path d="M12.012 2C6.485 2 2 6.487 2 12.012c0 1.767.46 3.426 1.262 4.887L2 22l5.234-1.373a9.98 9.98 0 004.778 1.208c5.527 0 10.012-4.485 10.012-10.012C22.024 6.487 17.539 2 12.012 2zm6.056 14.195c-.247.697-1.246 1.282-1.722 1.344-.45.06-1.037.09-2.833-.65-2.296-.948-3.774-3.284-3.889-3.438-.115-.15-1.012-1.343-1.012-2.565 0-1.22.638-1.819.866-2.063.228-.244.5-.305.667-.305.167 0 .333.003.479.01.147.007.345-.056.54.417.202.493.689 1.681.748 1.804.06.122.099.266.018.428-.08.163-.122.26-.244.402-.122.143-.257.319-.367.428-.122.12-.249.25-.107.493.143.244.636 1.05 1.36 1.697.933.83 1.716 1.087 1.96 1.208.244.12.387.102.53-.064.143-.167.612-.713.774-.956.163-.244.326-.204.549-.122.224.081 1.411.666 1.654.788.244.12.406.181.465.283.06.099.06.577-.187 1.274z" /></svg>
  },
  {
    name: 'TikTok', color: '#000',
    svg: <svg viewBox="0 0 24 24" fill="#111" className="w-5 h-5"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.02 1.59 4.23.95.83 2.19 1.4 3.49 1.63v3.9c-.83-.02-1.66-.23-2.43-.55-.77-.38-1.46-.92-2.02-1.57-.02 2.16-.01 4.31-.02 6.47 0 1.25-.26 2.5-.83 3.61-.59.88-1.43 1.58-2.4 2.02-.97.43-2.05.59-3.1.48-1.28-.15-2.5-.77-3.37-1.72-.94-1.12-1.4-2.58-1.28-4.03.11-1.39.77-2.69 1.8-3.56.96-.81 2.2-1.28 3.46-1.29.02 1.34 0 2.67.01 4.01-1.24.08-2.4.92-2.77 2.12-.33.81-.19 1.76.36 2.45.54.73 1.46 1.08 2.36.96.9-.11 1.7-.76 1.99-1.63.15-.55.15-1.13.14-1.7.01-4.49 0-8.98.01-13.47z" /></svg>
  },
  {
    name: 'Meta', color: '#1877F2',
    svg: <svg viewBox="0 0 24 24" fill="#1877F2" className="w-5 h-5"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.8c4.56-.93 8-4.96 8-9.8z" /></svg>
  },
  {
    name: 'Instagram', color: '#E1306C',
    svg: <svg viewBox="0 0 24 24" fill="none" stroke="#E1306C" strokeWidth="2" className="w-5 h-5"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="#E1306C" stroke="none"/></svg>
  },
  {
    name: 'Telegram', color: '#0088cc',
    svg: <svg viewBox="0 0 24 24" fill="#0088cc" className="w-5 h-5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.12 1.13-.64 4.2-1.01 6.18-.15.8-.3 1.2-.55 1.25-.56.09-.94-.33-1.48-.68-.84-.55-1.31-.88-2.12-1.42-.94-.62-.33-1.06.21-1.61.14-.14 2.53-2.32 2.58-2.54.01-.03.01-.13-.05-.18-.06-.05-.15-.03-.22-.02-.1.02-1.68 1.06-4.75 3.13-.45.31-.86.46-1.22.45-.4-.01-1.17-.23-1.74-.41-.7-.23-1.26-.35-1.21-.73.03-.2.27-.4.74-.6 2.9-1.26 4.83-2.1 5.8-2.5 2.76-1.12 3.33-1.32 3.7-1.32.08 0 .27.02.39.12.1.08.13.2.14.3-.01.06 0 .24-.02.39z"/></svg>
  },
  {
    name: 'Google Maps', color: '#EA4335',
    svg: <svg viewBox="0 0 24 24" fill="#EA4335" className="w-5 h-5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
  },
];

// Zoho-style dashboard mockup SVG
const DashboardMockup = () => (
  <div className="relative w-full max-w-[560px] mx-auto">
    {/* Glow behind */}
    <div className="absolute inset-0 bg-gradient-to-br from-[#1e3a8a]/30 via-[#1d4ed8]/20 to-[#0ea5e9]/10 blur-3xl rounded-3xl" />
    {/* Main card */}
    <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
      {/* Top bar */}
      <div className="bg-[#1a2b5e] px-5 py-3 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 mx-4 bg-white/10 rounded-full px-3 py-1 text-white/50 text-[10px]">ariascrm.com/dashboard</div>
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      </div>
      {/* Dashboard body */}
      <div className="flex h-[340px]">
        {/* Sidebar */}
        <div className="w-12 bg-[#1e2d5a] flex flex-col items-center py-4 gap-4">
          {['▦','◉','◈','◐','⊞','⋮'].map((ic, i) => (
            <div key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] ${i === 0 ? 'bg-blue-500 text-white' : 'text-white/30 hover:text-white/60'}`}>{ic}</div>
          ))}
        </div>
        {/* Content */}
        <div className="flex-1 bg-[#f8faff] p-4 overflow-hidden">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Leads Hoy', val: '247', color: 'text-blue-600', up: '+18%' },
              { label: 'Cerrados', val: '38', color: 'text-emerald-600', up: '+34%' },
              { label: 'Revenue', val: '$24K', color: 'text-violet-600', up: '+22%' },
            ].map((s, i) => (
              <div key={i} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                <p className="text-[9px] text-gray-400 font-medium">{s.label}</p>
                <p className={`text-lg font-black ${s.color} leading-none mt-1`}>{s.val}</p>
                <p className="text-[8px] text-emerald-500 font-bold mt-1">{s.up}</p>
              </div>
            ))}
          </div>
          {/* Pipeline */}
          <div className="mb-3">
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-2">Pipeline de Ventas</p>
            <div className="flex gap-2 overflow-hidden">
              {[
                { stage: 'Nuevos', count: 47, color: 'bg-blue-500' },
                { stage: 'Contactados', count: 32, color: 'bg-indigo-500' },
                { stage: 'Propuesta', count: 18, color: 'bg-violet-500' },
                { stage: 'Cerrados', count: 9, color: 'bg-emerald-500' },
              ].map((col, i) => (
                <div key={i} className="flex-1">
                  <div className={`${col.color} rounded-t-lg px-2 py-1`}>
                    <p className="text-[8px] text-white font-bold">{col.stage}</p>
                    <p className="text-xs text-white font-black">{col.count}</p>
                  </div>
                  <div className="space-y-1 mt-1">
                    {[...Array(Math.min(3, col.count))].map((_, j) => (
                      <div key={j} className="bg-white rounded p-1 border border-gray-100 shadow-sm">
                        <div className="h-1.5 bg-gray-200 rounded w-3/4 mb-1" />
                        <div className="h-1 bg-gray-100 rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* WhatsApp notification pop */}
          <div className="absolute bottom-10 right-6 bg-white rounded-2xl shadow-2xl border border-gray-100 p-3 w-48 animate-bounce" style={{ animationDuration: '3s' }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="white" className="w-3.5 h-3.5"><path d="M12.012 2C6.485 2 2 6.487 2 12.012c0 1.767.46 3.426 1.262 4.887L2 22l5.234-1.373a9.98 9.98 0 004.778 1.208c5.527 0 10.012-4.485 10.012-10.012C22.024 6.487 17.539 2 12.012 2z" /></svg>
              </div>
              <div>
                <p className="text-[9px] font-bold text-gray-800">Nuevo Lead</p>
                <p className="text-[8px] text-gray-400">WhatsApp · ahora</p>
              </div>
            </div>
            <p className="text-[9px] text-gray-600">"Hola, me interesa el servicio..."</p>
            <div className="mt-1.5 bg-blue-600 rounded-lg px-2 py-1 text-center">
              <p className="text-[8px] text-white font-bold">Responder con IA →</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    {/* Floating stat cards */}
    <div className="absolute -left-8 top-1/3 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 w-36">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500 text-base">⚡</div>
        <div>
          <p className="text-[9px] text-gray-400">Respuesta IA</p>
          <p className="text-sm font-black text-gray-800">4 seg</p>
        </div>
      </div>
    </div>
    <div className="absolute -right-6 top-1/4 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 w-32">
      <p className="text-[9px] text-gray-400 font-medium">Tasa de cierre</p>
      <p className="text-xl font-black text-blue-600">38%</p>
      <div className="flex gap-0.5 mt-1">
        {[60,75,50,90,80,95].map((h, i) => (
          <div key={i} className="flex-1 bg-blue-100 rounded-sm" style={{ height: `${h * 0.18}px` }} />
        ))}
      </div>
    </div>
  </div>
);

interface LandingHeroProps {
  onLoginClick: () => void;
}

export default function LandingHero({ onLoginClick }: LandingHeroProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const isES = i18n.language?.startsWith('es');
  const t = (es: string, en: string) => isES ? es : en;

  return (
    <section className="relative bg-white overflow-hidden pt-32 pb-24 border-b border-gray-100">
      {/* Subtle top gradient */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-red-600 to-rose-500" />
      {/* Background gradient blob */}
      <div className="absolute top-[-120px] right-[-200px] w-[700px] h-[700px] rounded-full bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 opacity-70 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-80px] left-[-100px] w-[400px] h-[400px] rounded-full bg-gradient-to-br from-red-50 to-orange-50 opacity-50 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center relative z-10">
        {/* Left */}
        <div>
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 bg-cyan-50 border border-cyan-200 text-cyan-700 text-xs font-bold px-4 py-1.5 rounded-full mb-6 tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
            {t('El CRM de ventas #1 para Latinoamérica', 'The #1 Sales CRM for Latin America')}
          </div>

          <h1 className="text-5xl lg:text-6xl font-black text-gray-900 leading-[1.05] tracking-tight mb-6">
            {t('Convierte leads', 'Turn leads into')}<br />
            {t('en clientes.', 'customers.')}<br />
            <span style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              {t('Automáticamente.', 'Automatically.')}
            </span>
          </h1>

          <p className="text-lg text-gray-500 max-w-lg mb-10 leading-relaxed">
            {t(
              'Arias CRM combina gestión de leads, agente de ventas con IA, WhatsApp, cotizaciones y análisis en una sola plataforma.',
              'Arias CRM combines lead management, AI sales agent, WhatsApp, quotes, and analytics in one platform.'
            )}
          </p>

          {/* CTAs */}
          <div className="flex items-center gap-4 flex-wrap mb-12">
            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)' }}
                className="inline-flex items-center gap-2 text-white font-bold px-8 py-4 rounded-xl transition-all text-base shadow-lg"
              >
                {t('Ir al Dashboard', 'Go to Dashboard')} <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/register')}
                  style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)' }}
                  className="inline-flex items-center gap-2.5 text-white font-bold px-8 py-4 rounded-xl transition-all text-base shadow-lg hover:opacity-90"
                >
                  {t('Prueba gratuita — 14 días', 'Free Trial — 14 days')} <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={onLoginClick}
                  className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold px-7 py-4 rounded-xl border border-gray-200 transition-all text-base"
                >
                  <Play className="w-4 h-4 text-cyan-500" fill="currentColor" />
                  {t('Ver demo', 'Watch Demo')}
                </button>
              </>
            )}
          </div>

          {/* Trust signals */}
          <div className="flex items-center gap-6 flex-wrap">
            {[
              { icon: '✓', text: t('Sin tarjeta de crédito', 'No credit card required') },
              { icon: '✓', text: t('Cancela cuando quieras', 'Cancel anytime') },
              { icon: '✓', text: t('Soporte en español', 'Spanish support') },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 text-sm text-gray-500">
                <span className="text-emerald-500 font-bold">{s.icon}</span>
                {s.text}
              </div>
            ))}
          </div>

          {/* Integration logos */}
          <div className="mt-12 pt-8 border-t border-gray-100">
            <p className="text-xs text-gray-400 uppercase font-bold tracking-widest mb-4">{t('Conectado con', 'Integrates with')}</p>
            <div className="flex items-center gap-5 flex-wrap">
              {INTEGRATIONS.map(int => (
                <div key={int.name} className="flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
                  {int.svg}
                  <span className="text-xs text-gray-500 font-medium">{int.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Dashboard mockup */}
        <div className="hidden lg:block relative">
          <DashboardMockup />
        </div>
      </div>
    </section>
  );
}
