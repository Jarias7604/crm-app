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
const FEATURES = [
  { icon: '◈', title: 'Cotizador + PDF', body: 'Genera cotizaciones profesionales con tu branding, envíalas por link y recibe pagos. Nadie más lo tiene integrado al CRM.' },
  { icon: '◉', title: 'Lead Hunter', body: 'Encuentra prospectos en Google Maps por industria y zona. 500 leads en 60 segundos. Exclusivo nuestro.' },
  { icon: '◐', title: 'Flyer Studio IA', body: 'Diseña materiales de marketing con inteligencia artificial, sin salir de la plataforma.' },
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

// ─── ORIGINAL BRAND INTEGRATION LOGOS ─────────────────────────────────────────
const WhatsAppIcon = ({ className = "w-6 h-6" }) => (
  <span className={`inline-flex items-center justify-center rounded-full bg-[#25D366]/10 p-2 shrink-0`}>
    <svg className={className} viewBox="0 0 24 24" fill="#25D366">
      <path d="M12.012 2C6.485 2 2 6.487 2 12.012c0 1.767.46 3.426 1.262 4.887L2 22l5.234-1.373a9.98 9.98 0 004.778 1.208c5.527 0 10.012-4.485 10.012-10.012C22.024 6.487 17.539 2 12.012 2zm6.056 14.195c-.247.697-1.246 1.282-1.722 1.344-.45.06-1.037.09-2.833-.65-2.296-.948-3.774-3.284-3.889-3.438-.115-.15-1.012-1.343-1.012-2.565 0-1.22.638-1.819.866-2.063.228-.244.5-.305.667-.305.167 0 .333.003.479.01.147.007.345-.056.54.417.202.493.689 1.681.748 1.804.06.122.099.266.018.428-.08.163-.122.26-.244.402-.122.143-.257.319-.367.428-.122.12-.249.25-.107.493.143.244.636 1.05 1.36 1.697.933.83 1.716 1.087 1.96 1.208.244.12.387.102.53-.064.143-.167.612-.713.774-.956.163-.244.326-.204.549-.122.224.081 1.411.666 1.654.788.244.12.406.181.465.283.06.099.06.577-.187 1.274z" />
    </svg>
  </span>
);

const TelegramIcon = ({ className = "w-6 h-6" }) => (
  <span className={`inline-flex items-center justify-center rounded-full bg-[#0088cc]/10 p-2 shrink-0`}>
    <svg className={className} viewBox="0 0 24 24" fill="#0088cc">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.12 1.13-.64 4.2-1.01 6.18-.15.8-.3 1.2-.55 1.25-.56.09-.94-.33-1.48-.68-.84-.55-1.31-.88-2.12-1.42-.94-.62-.33-1.06.21-1.61.14-.14 2.53-2.32 2.58-2.54.01-.03.01-.13-.05-.18-.06-.05-.15-.03-.22-.02-.1.02-1.68 1.06-4.75 3.13-.45.31-.86.46-1.22.45-.4-.01-1.17-.23-1.74-.41-.7-.23-1.26-.35-1.21-.73.03-.2.27-.4.74-.6 2.9-1.26 4.83-2.1 5.8-2.5 2.76-1.12 3.33-1.32 3.7-1.32.08 0 .27.02.39.12.1.08.13.2.14.3-.01.06 0 .24-.02.39z" />
    </svg>
  </span>
);

const InstagramIcon = ({ className = "w-6 h-6" }) => (
  <span className={`inline-flex items-center justify-center rounded-full bg-[#E1306C]/10 p-2 shrink-0`}>
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#E1306C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  </span>
);

const FacebookIcon = ({ className = "w-6 h-6" }) => (
  <span className={`inline-flex items-center justify-center rounded-full bg-[#1877F2]/10 p-2 shrink-0`}>
    <svg className={className} viewBox="0 0 24 24" fill="#1877F2">
      <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.8c4.56-.93 8-4.96 8-9.8z" />
    </svg>
  </span>
);

const TikTokIcon = ({ className = "w-6 h-6" }) => (
  <span className={`inline-flex items-center justify-center rounded-full bg-[#000000]/10 p-2 shrink-0`}>
    <svg className={className} viewBox="0 0 24 24" fill="#000000">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.02 1.59 4.23.95.83 2.19 1.4 3.49 1.63v3.9c-.83-.02-1.66-.23-2.43-.55-.77-.38-1.46-.92-2.02-1.57-.02 2.16-.01 4.31-.02 6.47 0 1.25-.26 2.5-.83 3.61-.59.88-1.43 1.58-2.4 2.02-.97.43-2.05.59-3.1.48-1.28-.15-2.5-.77-3.37-1.72-.94-1.12-1.4-2.58-1.28-4.03.11-1.39.77-2.69 1.8-3.56.96-.81 2.2-1.28 3.46-1.29.02 1.34 0 2.67.01 4.01-1.24.08-2.4.92-2.77 2.12-.33.81-.19 1.76.36 2.45.54.73 1.46 1.08 2.36.96.9-.11 1.7-.76 1.99-1.63.15-.55.15-1.13.14-1.7.01-4.49 0-8.98.01-13.47z" />
    </svg>
  </span>
);

const ZapierIcon = ({ className = "w-6 h-6" }) => (
  <span className={`inline-flex items-center justify-center rounded-full bg-[#FF4F00]/10 p-2 shrink-0`}>
    <svg className={className} viewBox="0 0 24 24" fill="#FF4F00">
      <path d="M19 10.5h-5.5V5c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v5.5H5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.5V19c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-5.5H19c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z" />
    </svg>
  </span>
);

const SheetsIcon = ({ className = "w-6 h-6" }) => (
  <span className={`inline-flex items-center justify-center rounded-full bg-[#0F9D58]/10 p-2 shrink-0`}>
    <svg className={className} viewBox="0 0 24 24" fill="#0F9D58">
      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
    </svg>
  </span>
);

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const [annual, setAnnual] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  // Dynamic Product Explorer Tab State
  const [activeTab, setActiveTab] = useState<'capture' | 'convert' | 'close'>('capture');

  return (
    <div className="min-h-screen bg-white font-sans" style={{fontFamily:"'Inter','system-ui',sans-serif"}}>
      <LandingNavbar onLoginClick={() => setShowLogin(true)} />

      {/* ─── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col justify-center pt-20 pb-24 overflow-hidden bg-[#06060a]">
        <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage:'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")'}} />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20 blur-[120px] pointer-events-none" style={{background:'radial-gradient(circle,#4f46e5 0%,transparent 70%)'}} />

        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
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

          {/* Dynamic Channels Row with original brand colored icons */}
          <div className="mt-16 flex flex-wrap justify-center items-center gap-8 bg-white/5 backdrop-blur border border-white/10 p-6 rounded-2xl max-w-3xl mx-auto">
            <div className="flex items-center gap-2">
              <TikTokIcon />
              <span className="text-xs font-semibold text-white">TikTok</span>
            </div>
            <div className="flex items-center gap-2">
              <InstagramIcon />
              <span className="text-xs font-semibold text-white">Instagram</span>
            </div>
            <div className="flex items-center gap-2">
              <FacebookIcon />
              <span className="text-xs font-semibold text-white">Facebook</span>
            </div>
            <div className="flex items-center gap-2">
              <WhatsAppIcon />
              <span className="text-xs font-semibold text-white">WhatsApp</span>
            </div>
            <div className="flex items-center gap-2">
              <TelegramIcon />
              <span className="text-xs font-semibold text-white">Telegram</span>
            </div>
            <div className="flex items-center gap-2">
              <ZapierIcon />
              <span className="text-xs font-semibold text-white">Zapier</span>
            </div>
            <div className="flex items-center gap-2">
              <SheetsIcon />
              <span className="text-xs font-semibold text-white">Google Sheets</span>
            </div>
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

      {/* ─── DYNAMIC PRODUCT EXPLORER (As requested: shows products beautifully like competitors do) ─── */}
      <section className="py-28 bg-[#f8fafc] border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-black text-indigo-600 uppercase tracking-[0.25em] mb-4">Explora el Producto</p>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Cómo dominamos a respond.io y HubSpot</h2>
            <p className="text-slate-500 mt-2">Haz clic en los toggles abajo para ver cómo funciona nuestra tecnología.</p>
          </div>

          {/* Interactive Feature Toggles */}
          <div className="flex justify-center gap-3 mb-12 flex-wrap">
            <button
              onClick={() => setActiveTab('capture')}
              className={`px-6 py-3 rounded-full text-sm font-black transition-all ${activeTab === 'capture' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'}`}
            >
              🚀 Captura Social Automática
            </button>
            <button
              onClick={() => setActiveTab('convert')}
              className={`px-6 py-3 rounded-full text-sm font-black transition-all ${activeTab === 'convert' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'}`}
            >
              🤖 AI Agents de Conversión
            </button>
            <button
              onClick={() => setActiveTab('close')}
              className={`px-6 py-3 rounded-full text-sm font-black transition-all ${activeTab === 'close' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'}`}
            >
              💸 Cotizador & Cierre de Tratos
            </button>
          </div>

          {/* Dynamic Content Frame */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden grid md:grid-cols-12">
            <div className="p-8 md:p-12 md:col-span-5 flex flex-col justify-center">
              {activeTab === 'capture' && (
                <>
                  <span className="text-[11px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-wider self-start mb-6">Omnicanal</span>
                  <h3 className="text-2xl font-black text-slate-900 mb-4 leading-tight">Cero fricción. Captura garantizada.</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-6">
                    Tus prospectos de TikTok Lead Generation, Meta Lead Ads e Instagram entran al CRM en menos de 5 segundos. Las APIs conectan directamente, sin depender de intermediarios lentos.
                  </p>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-center gap-2 text-xs font-bold text-slate-700">
                      <WhatsAppIcon className="w-4 h-4" /> WhatsApp Webhook multi-empresa
                    </li>
                    <li className="flex items-center gap-2 text-xs font-bold text-slate-700">
                      <TikTokIcon className="w-4 h-4" /> Captura nativa TikTok Leads
                    </li>
                  </ul>
                </>
              )}
              {activeTab === 'convert' && (
                <>
                  <span className="text-[11px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-wider self-start mb-6">Inteligencia Artificial</span>
                  <h3 className="text-2xl font-black text-slate-900 mb-4 leading-tight">Bots expertos calificados 24/7.</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-6">
                    El AI Agent interactúa con el prospecto por WhatsApp o Telegram al instante. Realiza la calificación automatizada y agenda una reunión en tu calendario de ventas sin intervención humana.
                  </p>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-center gap-2 text-xs font-bold text-slate-700">
                      🎯 Lead scoring inteligente
                    </li>
                    <li className="flex items-center gap-2 text-xs font-bold text-slate-700">
                      📅 Auto-agendamiento por chat
                    </li>
                  </ul>
                </>
              )}
              {activeTab === 'close' && (
                <>
                  <span className="text-[11px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-wider self-start mb-6">Finanzas</span>
                  <h3 className="text-2xl font-black text-slate-900 mb-4 leading-tight">Cotizaciones de marca en 10s.</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-6">
                    Crea cotizaciones profesionales integradas en formato PDF desde el CRM. Tus clientes pueden revisar las partidas, seleccionar opciones opcionales y pagar directamente en línea en tu portal de cobros.
                  </p>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-center gap-2 text-xs font-bold text-slate-700">
                      📄 Cotizador visual nativo
                    </li>
                    <li className="flex items-center gap-2 text-xs font-bold text-slate-700">
                      💳 Pasarela integrada de cobros
                    </li>
                  </ul>
                </>
              )}
              <button onClick={() => navigate('/register')} className="inline-flex items-center gap-2 bg-slate-950 hover:bg-slate-900 text-white font-bold text-xs px-6 py-3.5 rounded-xl transition-all self-start">
                Probar esta herramienta gratis <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Interactive Preview Mockup Screen (Visual representation of competitive tech) */}
            <div className="bg-slate-950 p-8 md:col-span-7 flex items-center justify-center border-t md:border-t-0 md:border-l border-slate-800 relative min-h-[350px]">
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-emerald-500/5 pointer-events-none" />
              {activeTab === 'capture' && (
                <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-xl p-5 shadow-2xl relative z-10">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Capturado
                    </span>
                    <span className="text-[10px] text-slate-500">TikTok Leads API</span>
                  </div>
                  <p className="text-xs text-slate-400">Origen de Campaña:</p>
                  <p className="text-xs font-bold text-white mb-3">🎵 TikTok Ads - Latam Expansion</p>
                  <div className="bg-slate-950/50 rounded-lg p-3 space-y-1.5 text-[11px] text-slate-300">
                    <p><strong>Nombre:</strong> Carlos Mendoza</p>
                    <p><strong>Teléfono:</strong> +503 7120 4488</p>
                    <p><strong>Formulario:</strong> Registro_Starter_Promo</p>
                  </div>
                  <div className="mt-4 flex justify-between items-center text-[10px] text-slate-500">
                    <span>Estado: <strong>Nuevo</strong></span>
                    <span>Trazabilidad: <strong>100%</strong></span>
                  </div>
                </div>
              )}
              {activeTab === 'convert' && (
                <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-xl p-5 shadow-2xl relative z-10 space-y-3">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span className="text-xs font-black text-white">AI Agent Conversacional</span>
                  </div>
                  <div className="text-[11px] space-y-2">
                    <div className="bg-slate-800 text-white rounded-lg p-2.5 max-w-[80%]">
                      Hola Carlos, veo que te registraste para Arias CRM. ¿Qué sector tiene tu negocio?
                    </div>
                    <div className="bg-indigo-600 text-white rounded-lg p-2.5 max-w-[80%] self-end ml-auto">
                      Hola! Tengo una distribuidora comercial de alimentos.
                    </div>
                    <div className="bg-slate-800 text-white rounded-lg p-2.5 max-w-[80%]">
                      Excelente. Te he calificado como **Lead de Alto Valor**. ¿Te gustaría agendar una demo mañana a las 10:00 AM?
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'close' && (
                <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-xl p-5 shadow-2xl relative z-10">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-3">
                    <span className="text-xs font-black text-white">Cotización #1092</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold">Generada</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px] text-slate-300">
                      <span>Base Plan (Growth Anual)</span>
                      <span>$1,188.00/yr</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-300">
                      <span>Módulo Lead Hunter</span>
                      <span>Incluido</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-300">
                      <span>AI Agent Setup</span>
                      <span>$150.00</span>
                    </div>
                    <div className="border-t border-white/5 pt-2 flex justify-between text-xs font-black text-white">
                      <span>Total Neto</span>
                      <span>$1,338.00</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/5 flex gap-2">
                    <button className="flex-1 bg-indigo-600 text-white text-[10px] font-black py-2 rounded-lg">Aprobar & Pagar</button>
                    <button className="flex-1 bg-slate-800 text-slate-400 text-[10px] font-black py-2 rounded-lg">Bajar PDF</button>
                  </div>
                </div>
              )}
            </div>
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

      {/* ─── PRICING (Reverted pricing toggle to user's favorite capsule style) ─── */}
      <section id="pricing" className="py-28 scroll-mt-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-14">
            <div>
              <p className="text-xs font-black text-indigo-600 uppercase tracking-[0.25em] mb-4">Precios</p>
              <h2 className="text-4xl font-black text-slate-900 leading-tight">Simples.<br />Sin sorpresas.</h2>
            </div>

            {/* Restored Capsule Toggle Switch they liked */}
            <div className="inline-flex items-center gap-1.5 bg-slate-100 rounded-full p-1.5 border border-slate-200">
              <button
                onClick={() => setAnnual(true)}
                className={`px-5 py-2 rounded-full text-xs font-black transition-all ${annual ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Anual — 20% off
              </button>
              <button
                onClick={() => setAnnual(false)}
                className={`px-5 py-2 rounded-full text-xs font-black transition-all ${!annual ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
              >
                Mensual
              </button>
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
