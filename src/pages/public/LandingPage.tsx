import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { CheckCircle2, ArrowRight, Zap, Target, Bot, TrendingUp, Shield, Star, X, MessageSquare, Users, BarChart3, Instagram } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../auth/AuthProvider';
import LandingNavbar from '../../components/landing/LandingNavbar';
import LandingFooter from '../../components/landing/LandingFooter';
import AriasAgent from '../../components/landing/AriasAgent';
import Login from '../Login';
import { useTranslation } from 'react-i18next';

const PLANS = [
  {
    name: 'Starter',
    slug: 'starter',
    annual: 49,
    monthly: 65,
    users: 3,
    desc: 'Para equipos pequeños que quieren vender más.',
    features: ['Pipeline visual + Kanban','Cotizador + PDF profesional','1 AI Bot (Telegram/WhatsApp)','Email campaigns','Reportes básicos'],
    color: 'border-slate-200',
    badge: null,
  },
  {
    name: 'Growth',
    slug: 'growth',
    annual: 99,
    monthly: 129,
    users: 8,
    desc: 'Para equipos en crecimiento que quieren automatizar.',
    features: ['Todo en Starter','Campañas multi-canal','WhatsApp + Telegram + Email','Flyer Studio con IA','Lead Hunter (Google Places)','Reportes avanzados','TikTok + Facebook + Instagram Leads'],
    color: 'border-indigo-500',
    badge: 'Más Popular',
  },
  {
    name: 'Pro',
    slug: 'pro',
    annual: 159,
    monthly: 199,
    users: 15,
    desc: 'Para equipos avanzados con alto volumen.',
    features: ['Todo en Growth','Workflows visuales','API REST + Webhooks','Inbox omnicanal','Multi-workspace','Onboarding dedicado','SLA 99.9%'],
    color: 'border-slate-200',
    badge: null,
  },
];

const CHANNELS = [
  { label: 'TikTok', emoji: '🎵', color: 'from-pink-500 to-red-500' },
  { label: 'Instagram', emoji: '📸', color: 'from-purple-500 to-pink-500' },
  { label: 'Facebook', emoji: '👤', color: 'from-blue-600 to-blue-400' },
  { label: 'WhatsApp', emoji: '💬', color: 'from-emerald-500 to-green-400' },
  { label: 'Telegram', emoji: '✈️', color: 'from-sky-500 to-blue-400' },
  { label: 'Email', emoji: '📧', color: 'from-slate-600 to-slate-400' },
  { label: 'Web Forms', emoji: '🌐', color: 'from-indigo-500 to-violet-500' },
];

const VS_ROWS = [
  { feature: 'Cotizador + PDF profesional', us: true, hubspot: false, respond: false },
  { feature: 'Lead Hunter (Google Places)', us: true, hubspot: false, respond: false },
  { feature: 'Flyer Studio con IA', us: true, hubspot: false, respond: false },
  { feature: 'TikTok/IG/FB Leads automáticos', us: true, hubspot: false, respond: true },
  { feature: 'Pipeline visual (Kanban)', us: true, hubspot: true, respond: false },
  { feature: 'AI Agent 24/7', us: true, hubspot: true, respond: true },
  { feature: 'Campañas multi-canal', us: true, hubspot: true, respond: true },
  { feature: 'Precio mensual base', us: '$65/mo', hubspot: '$890/mo', respond: '$99/mo' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const [annual, setAnnual] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-indigo-500 selection:text-white">
      <LandingNavbar onLoginClick={() => setShowLogin(true)} />

      {/* ═══ HERO ═══ */}
      <section className="relative pt-28 pb-20 lg:pt-40 lg:pb-32 overflow-hidden" style={{background:'linear-gradient(135deg,#0f0c29 0%,#1a1560 40%,#0d1117 100%)'}}>
        <div className="absolute inset-0" style={{backgroundImage:'radial-gradient(ellipse at 20% 50%,rgba(99,102,241,0.25) 0%,transparent 55%),radial-gradient(ellipse at 80% 20%,rgba(16,185,129,0.15) 0%,transparent 55%)'}} />
        {/* Animated dots grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{backgroundImage:'radial-gradient(circle,#fff 1px,transparent 1px)',backgroundSize:'28px 28px'}} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-white/20 rounded-full px-4 py-1.5 mb-8">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-semibold text-emerald-300">El CRM #1 para equipos en Latinoamérica</span>
            </div>

            <h1 className="text-5xl lg:text-7xl font-black text-white tracking-tight leading-[1.05] mb-6">
              Captura leads de<br/>
              <span className="text-transparent bg-clip-text" style={{backgroundImage:'linear-gradient(90deg,#818cf8,#34d399,#f472b6)'}}>
                TikTok, Instagram,<br/>Facebook y más
              </span>
            </h1>

            <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
              El único CRM que unifica captura de leads desde redes sociales, cotizador profesional, AI agents y campañas multi-canal.
              <strong className="text-white"> 40% más barato que HubSpot y respond.io.</strong>
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {user ? (
                <Button onClick={() => navigate('/dashboard')} size="lg" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-10 py-4 h-auto rounded-xl shadow-2xl shadow-indigo-600/30">
                  Ir al Dashboard <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              ) : (
                <>
                  <Button onClick={() => navigate('/register')} size="lg" className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-10 py-4 h-auto rounded-xl text-lg shadow-2xl shadow-indigo-600/30 transition-all hover:scale-105">
                    Prueba 14 días gratis → Sin tarjeta
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => setShowLogin(true)} className="bg-white/5 hover:bg-white/10 border-white/20 text-white font-semibold px-8 py-4 h-auto rounded-xl">
                    Ver demo
                  </Button>
                </>
              )}
            </div>

            {/* Channel pills */}
            <div className="mt-14 flex flex-wrap justify-center gap-3">
              {CHANNELS.map((c) => (
                <div key={c.label} className={`flex items-center gap-2 bg-gradient-to-r ${c.color} text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg`}>
                  <span>{c.emoji}</span>{c.label}
                </div>
              ))}
              <div className="flex items-center gap-2 bg-white/10 border border-white/20 text-white text-sm font-bold px-4 py-2 rounded-full">
                + más canales
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ STATS BAR ═══ */}
      <section className="py-14 bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { num: '40%', label: 'Más barato que HubSpot y respond.io' },
            { num: '7', label: 'Canales de captura de leads' },
            { num: '3x', label: 'Más rápido para cerrar tratos' },
            { num: '24/7', label: 'AI Agents trabajando por ti' },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-4xl font-black text-indigo-600">{s.num}</p>
              <p className="text-sm text-slate-500 mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ SOCIAL LEAD CAPTURE ═══ */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-sm font-black text-indigo-600 uppercase tracking-widest">Captura de Leads Social</span>
            <h2 className="text-4xl font-black text-slate-900 mt-3 mb-4">
              Donde está tu cliente,<br/>ahí capturamos su lead
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Conecta tus anuncios de TikTok, Facebook e Instagram. Cada formulario completado crea automáticamente un lead en tu CRM — sin copiar y pegar.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { emoji: '🎵', platform: 'TikTok Ads', color: 'from-pink-500 to-red-500', desc: 'Leads de TikTok Lead Generation entran al CRM en segundos. El AI bot los contacta automáticamente.' },
              { emoji: '📸', platform: 'Instagram / Facebook Ads', color: 'from-purple-500 to-blue-500', desc: 'Conecta tu página de Meta. Los formularios de Lead Ads crean prospectos con toda su info y el anuncio de origen.' },
              { emoji: '💬', platform: 'WhatsApp + Telegram', color: 'from-emerald-500 to-teal-500', desc: 'El AI Agent responde, califica y agenda reuniones 24/7. El lead queda registrado con el historial completo.' },
            ].map((item) => (
              <div key={item.platform} className="bg-white rounded-2xl p-7 border border-slate-200 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center text-2xl mb-5 shadow-lg`}>
                  {item.emoji}
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">{item.platform}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
                <div className="mt-4 flex items-center gap-1.5 text-emerald-600 text-xs font-black">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Activo en producción
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ EXCLUSIVOS ═══ */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-sm font-black text-amber-600 uppercase tracking-widest">Solo en Arias CRM</span>
            <h2 className="text-4xl font-black text-slate-900 mt-3 mb-4">Features que HubSpot no tiene</h2>
            <p className="text-lg text-slate-500">Y que respond.io nunca tendrá.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: '📄', title: 'Cotizador + PDF Profesional', desc: 'Crea cotizaciones en segundos, envía PDFs con tu branding y recibe pagos desde el portal del cliente. Ningún CRM lo tiene así de completo.' },
              { icon: '🔍', title: 'Lead Hunter', desc: 'Busca prospectos en Google Maps por industria y zona. Importa 500 leads en 1 minuto. Exclusivo nuestro.' },
              { icon: '🎨', title: 'Flyer Studio con IA', desc: 'Diseña materiales de marketing con IA directamente en el CRM. Sin salir a Canva, sin perder tiempo.' },
            ].map((f) => (
              <div key={f.title} className="group p-8 rounded-2xl border-2 border-slate-100 hover:border-indigo-200 hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer bg-gradient-to-b from-white to-slate-50/50">
                <div className="text-4xl mb-5">{f.icon}</div>
                <h3 className="text-xl font-black text-slate-900 mb-3">{f.title}</h3>
                <p className="text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ VS COMPARISON ═══ */}
      <section className="py-24" style={{background:'linear-gradient(135deg,#0f0c29 0%,#1a1560 100%)'}}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-black text-white mb-4">¿Por qué no HubSpot o respond.io?</h2>
            <p className="text-slate-400 text-lg">Compara y decide tú mismo.</p>
          </div>
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-4 bg-white/10">
              <div className="p-4 text-slate-400 text-xs font-black uppercase tracking-wider">Feature</div>
              <div className="p-4 text-indigo-300 text-xs font-black uppercase tracking-wider text-center">Arias CRM ✨</div>
              <div className="p-4 text-slate-400 text-xs font-black uppercase tracking-wider text-center">HubSpot</div>
              <div className="p-4 text-slate-400 text-xs font-black uppercase tracking-wider text-center">respond.io</div>
            </div>
            {VS_ROWS.map((row, i) => (
              <div key={row.feature} className={`grid grid-cols-4 items-center border-t border-white/5 ${i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                <div className="p-4 text-white text-sm font-medium">{row.feature}</div>
                <div className="p-4 text-center">
                  {typeof row.us === 'boolean'
                    ? (row.us ? <span className="text-emerald-400 text-lg">✅</span> : <span className="text-red-400 text-lg">❌</span>)
                    : <span className="text-emerald-300 font-black text-sm">{row.us}</span>}
                </div>
                <div className="p-4 text-center">
                  {typeof row.hubspot === 'boolean'
                    ? (row.hubspot ? <span className="text-emerald-400 text-lg">✅</span> : <span className="text-red-400 text-lg">❌</span>)
                    : <span className="text-red-300 font-black text-sm">{row.hubspot}</span>}
                </div>
                <div className="p-4 text-center">
                  {typeof row.respond === 'boolean'
                    ? (row.respond ? <span className="text-emerald-400 text-lg">✅</span> : <span className="text-red-400 text-lg">❌</span>)
                    : <span className="text-amber-300 font-black text-sm">{row.respond}</span>}
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-slate-500 text-sm mt-6">HubSpot Professional empieza en $890/mo. Nosotros en $65/mo.</p>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section id="pricing" className="py-24 bg-white scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black text-slate-900 mb-4">Precios simples. Sin sorpresas.</h2>
            {/* Toggle */}
            <div className="inline-flex items-center gap-3 bg-slate-100 rounded-full p-1.5">
              <button onClick={() => setAnnual(true)} className={`px-5 py-2 rounded-full text-sm font-black transition-all ${annual ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-900'}`}>
                Anual — 20% off
              </button>
              <button onClick={() => setAnnual(false)} className={`px-5 py-2 rounded-full text-sm font-black transition-all ${!annual ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-900'}`}>
                Mensual
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-start">
            {PLANS.map((plan) => {
              const price = annual ? plan.annual : plan.monthly;
              const isPop = plan.badge;
              return (
                <div key={plan.slug} className={`relative rounded-2xl border-2 p-8 bg-white ${isPop ? 'border-indigo-500 shadow-2xl shadow-indigo-100 scale-[1.03] z-10' : 'border-slate-200 shadow-sm'}`}>
                  {isPop && <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-wider shadow-lg">{plan.badge}</div>}
                  <h3 className="text-xl font-black text-slate-900">{plan.name}</h3>
                  <p className="text-slate-500 text-sm mt-1 mb-5">{plan.desc}</p>
                  <div className="mb-2">
                    <span className="text-5xl font-black text-slate-900">${price}</span>
                    <span className="text-slate-400 font-medium">/mo</span>
                  </div>
                  {annual && <p className="text-xs text-emerald-600 font-black mb-6">Facturado ${price * 12}/año · Ahorras ${(plan.monthly - plan.annual) * 12}/año</p>}
                  {!annual && <p className="text-xs text-slate-400 mb-6">Sin contrato anual · Cancela cuando quieras</p>}
                  <Button onClick={() => navigate('/register')} className={`w-full font-black py-3 rounded-xl mb-6 ${isPop ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'}`}>
                    Prueba 14 días gratis
                  </Button>
                  <ul className="space-y-2.5">
                    <li className="flex items-start gap-2 text-sm text-slate-600">
                      <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                      <span>Hasta <strong>{plan.users}</strong> usuarios (+$12/usuario extra)</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-slate-600">
                      <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                      <span><strong>Contactos ilimitados</strong> — sin cobro por contacto</span>
                    </li>
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                        <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />{f}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="text-center mt-10">
            <p className="text-slate-500 text-sm">¿Necesitas más de 15 usuarios o White Label? <button onClick={() => navigate('/register')} className="text-indigo-600 font-black hover:underline">Habla con ventas →</button></p>
          </div>
        </div>
      </section>

      {/* ═══ WHY US ═══ */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-black text-slate-900 mb-3">Por qué Arias CRM</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: TrendingUp, title: '3x Más Cierres', desc: 'AI scoring, seguimientos automáticos y cotizador integrado = tu equipo cierra más sin más esfuerzo.' },
              { icon: Shield, title: 'Seguridad Enterprise', desc: 'Multi-tenant con Row Level Security. Tus datos 100% aislados. Nunca mezclados con otros clientes.' },
              { icon: Star, title: 'Soporte Real', desc: 'Onboarding en español, soporte en vivo y un equipo que entiende el mercado latinoamericano.' },
              { icon: Zap, title: 'Todo en Uno', desc: 'CRM + Marketing + Cotizador + AI Agents + Lead Hunter. Sin pagar 5 herramientas diferentes.' },
              { icon: Users, title: 'Multi-empresa', desc: 'Agencias y franquicias pueden gestionar múltiples clientes desde una sola plataforma.' },
              { icon: BarChart3, title: 'Analytics en Tiempo Real', desc: 'Dashboard premium con Health Pulse, tendencias de venta y análisis de leads perdidos.' },
            ].map((item) => (
              <div key={item.title} className="bg-white p-6 rounded-2xl border border-slate-200 hover:shadow-md transition-shadow">
                <item.icon className="w-8 h-8 text-indigo-600 mb-4" />
                <h3 className="text-lg font-black text-slate-900 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="py-24 text-center px-4" style={{background:'linear-gradient(135deg,#0f0c29 0%,#1a1560 100%)'}}>
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight">
            Empieza a capturar leads de<br/>
            <span className="text-transparent bg-clip-text" style={{backgroundImage:'linear-gradient(90deg,#818cf8,#34d399)'}}>
              TikTok, Instagram y Facebook
            </span><br/>hoy mismo
          </h2>
          <p className="text-slate-400 text-lg mb-10">14 días gratis. Sin tarjeta de crédito. Configuración en 5 minutos.</p>
          <Button size="lg" onClick={() => navigate('/register')} className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-12 py-5 text-lg rounded-xl shadow-2xl shadow-indigo-600/30 transition-all hover:scale-105">
            Crear cuenta gratis →
          </Button>
          <p className="text-slate-600 text-sm mt-5">40% más barato que HubSpot · Más features que respond.io</p>
        </div>
      </section>

      <LandingFooter />
      <AriasAgent />

      {showLogin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
            <button onClick={() => setShowLogin(false)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-10">
              <X className="w-5 h-5" />
            </button>
            <div className="p-8"><Login /></div>
          </div>
        </div>
      )}
    </div>
  );
}
