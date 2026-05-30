import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { CheckCircle2, ArrowRight, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../auth/AuthProvider';
import LandingNavbar from '../../components/landing/LandingNavbar';
import LandingFooter from '../../components/landing/LandingFooter';
import AriasAgent from '../../components/landing/AriasAgent';
import Login from '../Login';

// ─── DATA ────────────────────────────────────────────────────────────────────
const CHANNELS = ['TikTok','Instagram','Facebook','WhatsApp','Telegram','Email','Web'];

const FEATURES = [
  { icon: '◈', title: 'Cotizador + PDF', body: 'Genera cotizaciones profesionales con tu branding, envíalas por link y recibe pagos. Nadie más lo tiene integrado al CRM.' },
  { icon: '◉', title: 'Lead Hunter', body: 'Encuentra prospectos en Google Maps por industria y zona. 500 leads en 60 segundos. Exclusivo nuestro.' },
  { icon: '◐', title: 'Flyer Studio IA', body: 'Diseña materiales de marketing con inteligencia artificial, sin salir de la plataforma.' },
];

const SOCIAL = [
  { platform: 'TikTok Ads', body: 'Leads de TikTok Lead Generation entran al CRM al instante. El AI bot los contacta solo.' },
  { platform: 'Instagram & Facebook', body: 'Conecta Meta Business. Cada formulario de Lead Ads crea un prospecto con el anuncio de origen.' },
  { platform: 'WhatsApp + Telegram', body: 'El AI Agent responde, califica y agenda reuniones 24/7. Todo queda en el historial del lead.' },
];

const VS = [
  { f: 'Cotizador + PDF profesional',   us: true,    hub: false,   res: false  },
  { f: 'Lead Hunter (Google Places)',    us: true,    hub: false,   res: false  },
  { f: 'Flyer Studio con IA',            us: true,    hub: false,   res: false  },
  { f: 'TikTok / IG / FB → Leads',      us: true,    hub: false,   res: true   },
  { f: 'Pipeline visual Kanban',         us: true,    hub: true,    res: false  },
  { f: 'AI Agent 24/7',                  us: true,    hub: true,    res: true   },
  { f: 'Campañas multi-canal',           us: true,    hub: true,    res: true   },
  { f: 'Precio mensual base',            us: '$65',   hub: '$890',  res: '$99'  },
];

const PLANS = [
  { name:'Starter',  annual:49,  monthly:65,  users:3,  pop:false,
    features:['Pipeline + Kanban','Cotizador + PDF','1 AI Bot','Email campaigns','Reportes básicos'] },
  { name:'Growth',   annual:99,  monthly:129, users:8,  pop:true,
    features:['Todo en Starter','WhatsApp · Telegram · Email','Flyer Studio con IA','Lead Hunter','TikTok + FB + IG Leads','Reportes avanzados'] },
  { name:'Pro',      annual:159, monthly:199, users:15, pop:false,
    features:['Todo en Growth','Workflows visuales','API REST + Webhooks','Inbox omnicanal','Multi-workspace','SLA 99.9%'] },
];

const WHY = [
  { t:'3× más cierres',    b:'AI scoring, seguimientos automáticos y cotizador integrado hacen que tu equipo cierre sin esfuerzo extra.' },
  { t:'Seguridad enterprise', b:'Multi-tenant con Row Level Security. Datos 100% aislados por empresa, nunca mezclados.' },
  { t:'Todo en uno',       b:'CRM + Marketing + Cotizador + AI Agents + Lead Hunter. Sin pagar 5 herramientas diferentes.' },
  { t:'Multi-empresa',     b:'Agencias y franquicias gestionan múltiples clientes desde una sola plataforma.' },
  { t:'Analytics en vivo', b:'Dashboard con Health Pulse, tendencias de venta y análisis completo de leads perdidos.' },
  { t:'Soporte real',      b:'Onboarding en español, soporte en vivo y un equipo que entiende el mercado latinoamericano.' },
];

// ─── ICONS ───────────────────────────────────────────────────────────────────
const Tick = ({ dim = false }) => (
  <svg className={`w-[18px] h-[18px] ${dim ? 'text-slate-500' : 'text-indigo-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);
const Cross = () => (
  <svg className="w-[14px] h-[14px] text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const [annual, setAnnual]     = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  return (
    <div className="min-h-screen bg-white font-sans" style={{fontFamily:"'Inter','system-ui',sans-serif"}}>
      <LandingNavbar onLoginClick={() => setShowLogin(true)} />

      {/* ─── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col justify-center pt-20 pb-24 overflow-hidden bg-[#06060a]">
        {/* Noise texture */}
        <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage:'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")'}} />
        {/* Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20 blur-[120px] pointer-events-none" style={{background:'radial-gradient(circle,#4f46e5 0%,transparent 70%)'}} />

        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          {/* Label */}
          <div className="inline-flex items-center gap-2 mb-10">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-xs font-semibold text-indigo-400 tracking-[0.2em] uppercase">El CRM #1 para Latinoamérica</span>
          </div>

          <h1 className="text-6xl lg:text-8xl font-black text-white leading-[0.95] tracking-tight mb-8">
            Captura leads de<br />
            <span className="text-transparent bg-clip-text" style={{backgroundImage:'linear-gradient(135deg,#818cf8 0%,#6366f1 40%,#34d399 100%)'}}>
              TikTok, Instagram<br />y Facebook
            </span>
          </h1>

          <p className="text-lg text-slate-400 max-w-xl mx-auto mb-12 leading-relaxed">
            El único CRM que unifica captura desde redes sociales, cotizador profesional y AI agents —{' '}
            <span className="text-white">40% más barato que HubSpot y respond.io.</span>
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            {user ? (
              <button onClick={() => navigate('/dashboard')} className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-3.5 rounded-xl transition-all text-sm">
                Ir al Dashboard <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button onClick={() => navigate('/register')} className="inline-flex items-center gap-2 bg-white text-slate-900 hover:bg-slate-100 font-bold px-8 py-3.5 rounded-xl transition-all text-sm shadow-lg">
                  Prueba 14 días gratis <ArrowRight className="w-4 h-4" />
                </button>
                <button onClick={() => setShowLogin(true)} className="inline-flex items-center gap-2 border border-white/10 text-slate-400 hover:text-white hover:border-white/20 font-medium px-8 py-3.5 rounded-xl transition-all text-sm">
                  Ver demo
                </button>
              </>
            )}
          </div>

          {/* Channel row */}
          <div className="mt-16 flex flex-wrap justify-center gap-2">
            {CHANNELS.map(c => (
              <span key={c} className="text-xs font-medium text-slate-500 border border-white/[0.08] px-3 py-1.5 rounded-full hover:border-white/20 hover:text-slate-300 transition-colors cursor-default">
                {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── STATS ─────────────────────────────────────────────────────────── */}
      <section className="py-16 border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-10 text-center">
          {[['40%','Más barato que HubSpot'],['7','Canales de captura'],['3×','Más rápido en cerrar'],['24/7','AI Agents activos']].map(([n,l])=>(
            <div key={l}>
              <p className="text-3xl font-black text-slate-900 tracking-tight">{n}</p>
              <p className="text-xs text-slate-400 mt-1 font-medium">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── PAIN POINTS ──────────────────────────────────────────────────── */}
      <section className="py-28 border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-16">
            <p className="text-xs font-black text-red-500 uppercase tracking-[0.25em] mb-4">El problema</p>
            <h2 className="text-4xl font-black text-slate-900 leading-tight max-w-2xl">
              Tu equipo pierde leads todos los días.<br />
              <span className="text-slate-400">Y probablemente no lo sabe.</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {[
              { n:'01', t:'Leads de TikTok e Instagram se pierden', b:'Alguien llena tu formulario de ad. No hay integración. Nadie lo ve. Se va a tu competencia.' },
              { n:'02', t:'Seguimientos que nunca pasan', b:'El vendedor se olvida. No hay recordatorio. El lead se enfría y nadie sabe por qué no cerró.' },
              { n:'03', t:'Cotizaciones que tardan días', b:'Excel, Word, email. Cada cotización manual es tiempo perdido y una oportunidad de parecer amateur.' },
              { n:'04', t:'Sin visibilidad real del pipeline', b:'¿Cuántos leads tienes hoy? ¿Cuánto vale tu pipeline? Si no puedes responder en 10 segundos, hay un problema.' },
            ].map(p => (
              <div key={p.n} className="p-7 rounded-2xl border border-slate-100 flex gap-5">
                <span className="text-xs font-black text-slate-200 shrink-0 mt-0.5 w-6">{p.n}</span>
                <div>
                  <h3 className="text-sm font-black text-slate-900 mb-2">{p.t}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{p.b}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 p-7 rounded-2xl bg-slate-900 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <p className="text-sm font-black mb-1">Arias CRM resuelve todo esto.</p>
              <p className="text-sm text-slate-400">Un solo sistema. Sin hojas de cálculo. Sin procesos manuales.</p>
            </div>
            <button onClick={() => navigate('/register')} className="shrink-0 text-sm font-bold bg-white text-slate-900 px-6 py-3 rounded-xl hover:bg-slate-100 transition-all">
              Empezar gratis →
            </button>
          </div>
        </div>
      </section>

      {/* ─── SOCIAL PROOF ─────────────────────────────────────────────────── */}
      <section className="py-20 bg-slate-50 border-b border-slate-100 overflow-hidden">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-xs font-black text-slate-400 uppercase tracking-[0.25em] mb-10 text-center">Lo que dicen quienes lo usan</p>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { quote:'Antes perdíamos leads de Facebook porque nadie los veía a tiempo. Ahora entran directo al CRM y el bot los contacta solo.', name:'Carlos M.', role:'Director Comercial', co:'Constructora' },
              { quote:'En 30 días duplicamos las cotizaciones enviadas. El PDF profesional le da otra imagen a nuestra empresa ante los clientes.', name:'Laura R.', role:'Gerente de Ventas', co:'Distribuidora' },
              { quote:'HubSpot nos costaba $900 al mes y ni cotizador tenía. Arias CRM hace más por $99. No hay comparación.', name:'Diego T.', role:'CEO', co:'Agencia Digital' },
            ].map(t => (
              <div key={t.name} className="p-7 rounded-2xl bg-white border border-slate-100">
                <p className="text-sm text-slate-600 leading-relaxed mb-6">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-black text-indigo-600">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-400">{t.role} · {t.co}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className="py-28">
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-16">
            <p className="text-xs font-black text-indigo-600 uppercase tracking-[0.25em] mb-4">Cómo funciona</p>
            <h2 className="text-4xl font-black text-slate-900 leading-tight max-w-lg">
              De lead a cliente cerrado.<br />
              <span className="text-slate-400">En el menor tiempo posible.</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step:'1', t:'Lead entra', b:'Desde TikTok, Instagram, Facebook, WhatsApp, Telegram, web o cargado manualmente.' },
              { step:'2', t:'AI califica', b:'El AI Agent responde al instante, hace preguntas clave y clasifica el prospecto automáticamente.' },
              { step:'3', t:'Vendedor actúa', b:'Recibe el lead ya calificado con historial, genera la cotización en segundos y la envía.' },
              { step:'4', t:'Trato cerrado', b:'El cliente paga desde el portal, el contrato queda en el CRM y el siguiente seguimiento está agendado.' },
            ].map((s, i) => (
              <div key={s.step} className="relative">
                {i < 3 && <div className="hidden md:block absolute top-4 left-[calc(100%+0px)] w-full h-px bg-slate-100 z-0" style={{width:'calc(100% - 2rem)',left:'calc(100% - 1rem)'}} />}
                <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-xs font-black text-slate-400 mb-4">{s.step}</div>
                <h3 className="text-sm font-black text-slate-900 mb-2">{s.t}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      <section className="py-28">
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-16">
            <p className="text-xs font-black text-indigo-600 uppercase tracking-[0.25em] mb-4">Captura social</p>
            <h2 className="text-4xl font-black text-slate-900 leading-tight max-w-lg">
              Donde está tu cliente,<br />ahí capturamos el lead.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {SOCIAL.map(s => (
              <div key={s.platform} className="p-7 rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all">
                <p className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3">{s.platform}</p>
                <p className="text-slate-500 text-sm leading-relaxed">{s.body}</p>
                <p className="text-[11px] text-emerald-600 font-bold mt-5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />Activo en producción
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── EXCLUSIVOS ────────────────────────────────────────────────────── */}
      <section className="py-28 bg-slate-50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-16">
            <p className="text-xs font-black text-amber-600 uppercase tracking-[0.25em] mb-4">Solo en Arias CRM</p>
            <h2 className="text-4xl font-black text-slate-900 leading-tight max-w-lg">
              Features que HubSpot<br />no tiene a ningún precio.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="p-8 rounded-2xl bg-white border border-slate-100 hover:shadow-md transition-all group">
                <span className="text-2xl text-slate-200 font-black block mb-6 group-hover:text-indigo-200 transition-colors">{f.icon}</span>
                <h3 className="text-base font-black text-slate-900 mb-3">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── COMPARISON ────────────────────────────────────────────────────── */}
      <section className="py-28 bg-[#06060a]">
        <div className="max-w-3xl mx-auto px-6">
          <div className="mb-14">
            <p className="text-xs font-black text-indigo-400 uppercase tracking-[0.25em] mb-4">Comparación</p>
            <h2 className="text-4xl font-black text-white leading-tight">¿Por qué no HubSpot<br />o respond.io?</h2>
          </div>

          <div className="rounded-2xl overflow-hidden border border-white/[0.06]">
            {/* Header */}
            <div className="grid grid-cols-4 border-b border-white/[0.06] bg-white/[0.02]">
              <div className="p-4" />
              <div className="p-4 text-center border-l border-white/[0.06] bg-indigo-500/[0.08]">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Arias CRM</p>
              </div>
              <div className="p-4 text-center border-l border-white/[0.06]">
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">HubSpot</p>
              </div>
              <div className="p-4 text-center border-l border-white/[0.06]">
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">respond.io</p>
              </div>
            </div>

            {VS.map((row, i) => (
              <div key={row.f} className={`grid grid-cols-4 border-b border-white/[0.04] hover:bg-white/[0.015] transition-colors ${i === VS.length-1?'border-0':''}`}>
                <div className="p-4 pl-5 flex items-center">
                  <span className="text-[13px] text-slate-400">{row.f}</span>
                </div>
                <div className="p-4 flex items-center justify-center border-l border-white/[0.04] bg-indigo-500/[0.04]">
                  {typeof row.us === 'boolean' ? (row.us ? <Tick /> : <Cross />) : <span className="text-indigo-300 font-bold text-sm">{row.us}</span>}
                </div>
                <div className="p-4 flex items-center justify-center border-l border-white/[0.04]">
                  {typeof row.hub === 'boolean' ? (row.hub ? <Tick dim /> : <Cross />) : <span className="text-red-400 font-bold text-sm">{row.hub}</span>}
                </div>
                <div className="p-4 flex items-center justify-center border-l border-white/[0.04]">
                  {typeof row.res === 'boolean' ? (row.res ? <Tick dim /> : <Cross />) : <span className="text-slate-500 font-bold text-sm">{row.res}</span>}
                </div>
              </div>
            ))}
          </div>

          <p className="text-slate-700 text-xs mt-5">HubSpot Professional desde $890/mo · Arias CRM desde $65/mo sin contrato anual.</p>
        </div>
      </section>

      {/* ─── PRICING ───────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-28 scroll-mt-20">
        <div className="max-w-5xl mx-auto px-6">
          {/* Header + toggle */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-14">
            <div>
              <p className="text-xs font-black text-indigo-600 uppercase tracking-[0.25em] mb-4">Precios</p>
              <h2 className="text-4xl font-black text-slate-900 leading-tight">Simples.<br />Sin sorpresas.</h2>
            </div>
            {/* Toggle switch */}
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium transition-colors ${!annual?'text-slate-900':'text-slate-400'}`}>Mensual</span>
              <button
                onClick={() => setAnnual(v => !v)}
                className="relative w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                style={{background: annual ? '#4f46e5' : '#e2e8f0'}}
                aria-label="Toggle billing"
              >
                <span
                  className="absolute top-[3px] w-[18px] h-[18px] bg-white rounded-full shadow transition-all duration-300"
                  style={{left: annual ? '26px' : '3px'}}
                />
              </button>
              <span className={`text-sm font-medium transition-colors ${annual?'text-slate-900':'text-slate-400'}`}>Anual</span>
              {annual && <span className="text-[11px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">−20%</span>}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5 items-start">
            {PLANS.map(plan => {
              const price = annual ? plan.annual : plan.monthly;
              return (
                <div key={plan.name} className={`rounded-2xl p-7 border transition-all ${plan.pop ? 'border-indigo-500 shadow-xl shadow-indigo-50 relative' : 'border-slate-200'}`}>
                  {plan.pop && (
                    <span className="absolute -top-3 left-6 text-[10px] font-black bg-indigo-600 text-white px-3 py-1 rounded-full uppercase tracking-widest">Popular</span>
                  )}
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">{plan.name}</p>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-5xl font-black text-slate-900 tracking-tight">${price}</span>
                    <span className="text-slate-400 text-sm font-medium">/mo</span>
                  </div>
                  {annual && (
                    <p className="text-xs text-slate-400 mb-6">Facturado ${price*12}/año · Ahorras ${(plan.monthly-plan.annual)*12}</p>
                  )}
                  <button onClick={() => navigate('/register')} className={`w-full text-sm font-bold py-2.5 rounded-xl mb-7 transition-all ${plan.pop ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'}`}>
                    Prueba 14 días gratis
                  </button>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2.5 text-sm text-slate-600">
                      <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <span>Hasta <strong>{plan.users}</strong> usuarios</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-sm text-slate-600">
                      <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <span><strong>Contactos ilimitados</strong></span>
                    </li>
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-slate-500">
                        <CheckCircle2 className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <p className="text-center text-xs text-slate-400 mt-8">
            ¿Más de 15 usuarios o White Label?{' '}
            <button onClick={() => navigate('/register')} className="text-indigo-600 font-bold hover:underline">Habla con ventas →</button>
          </p>
        </div>
      </section>

      {/* ─── WHY US ────────────────────────────────────────────────────────── */}
      <section className="py-28 border-t border-slate-100">
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-16">
            <p className="text-xs font-black text-indigo-600 uppercase tracking-[0.25em] mb-4">Por qué elegirnos</p>
            <h2 className="text-4xl font-black text-slate-900 leading-tight max-w-sm">Resultados, no complejidad.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {WHY.map(w => (
              <div key={w.t} className="group">
                <h3 className="text-sm font-black text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">{w.t}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{w.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ───────────────────────────────────────────────────────────── */}
      <section className="py-28 bg-[#06060a]">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-5xl font-black text-white leading-tight mb-6 tracking-tight">
            Empieza a capturar<br />leads hoy mismo.
          </h2>
          <p className="text-slate-500 mb-10 text-base">14 días gratis · Sin tarjeta · Configuración en 5 minutos.</p>
          <button onClick={() => navigate('/register')} className="inline-flex items-center gap-2 bg-white text-slate-900 font-bold px-10 py-4 rounded-xl hover:bg-slate-100 transition-all text-sm shadow-2xl shadow-white/10">
            Crear cuenta gratis <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-slate-700 text-xs mt-6">40% más barato que HubSpot · Más features que respond.io</p>
        </div>
      </section>

      <LandingFooter />
      <AriasAgent />

      {showLogin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <button onClick={() => setShowLogin(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors z-10">
              <X className="w-4 h-4" />
            </button>
            <div className="p-8"><Login /></div>
          </div>
        </div>
      )}
    </div>
  );
}
