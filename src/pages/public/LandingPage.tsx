import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { CheckCircle2, ArrowRight, X, Sparkles, Shield, Zap, TrendingUp, Users, Smartphone, Globe, MessageSquare } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../auth/AuthProvider';
import LandingNavbar from '../../components/landing/LandingNavbar';
import LandingFooter from '../../components/landing/LandingFooter';
import AriasAgent from '../../components/landing/AriasAgent';
import Login from '../Login';

// ─── DATA & SCHEMAS ──────────────────────────────────────────────────────────
const CHANNELS = [
  { name: 'TikTok', color: '#000000', bg: 'rgba(0,0,0,0.06)', active: true },
  { name: 'Instagram', color: '#E1306C', bg: 'rgba(225,48,108,0.06)', active: true },
  { name: 'Facebook', color: '#1877F2', bg: 'rgba(24,119,242,0.06)', active: true },
  { name: 'WhatsApp', color: '#25D366', bg: 'rgba(37,211,102,0.06)', active: true },
  { name: 'Telegram', color: '#0088cc', bg: 'rgba(0,136,204,0.06)', active: true },
  { name: 'Zapier', color: '#FF4F00', bg: 'rgba(255,79,0,0.06)', active: true },
  { name: 'Google Sheets', color: '#0F9D58', bg: 'rgba(15,157,88,0.06)', active: true },
];

const VS_ROWS = [
  { f: 'Captura Automatizada de Ads (TikTok/FB/IG)', us: true,  hub: false, res: true  },
  { f: 'AI Agent Conversacional 24/7 (WhatsApp)',   us: true,  hub: false, res: true  },
  { f: 'Cotizador Integrado con Generación de PDF', us: true,  hub: false, res: false },
  { f: 'Lead Hunter (Google Maps Data Extractor)',  us: true,  hub: false, res: false },
  { f: 'Flyer Studio con Inteligencia Artificial',  us: true,  hub: false, res: false },
  { f: 'Pipeline Visual Kanban Multi-workspace',    us: true,  hub: true,  res: false },
  { f: 'Inbox Omnicanal Colaborativo',              us: true,  hub: true,  res: true  },
  { f: 'Precio Base Mensual sin contrato',          us: '$65', hub: '$890', res: '$99' },
];

const PLANS = [
  { 
    name: 'Starter',  
    annual: 49,  
    monthly: 65,  
    users: 3,  
    desc: 'Esencial para agencias y equipos que inician su aceleración.',
    features: ['Pipeline visual Kanban', 'Cotizador + PDF profesional', '1 AI Bot (Telegram/WhatsApp)', 'Email marketing campaigns', 'Reportes de ventas básicos'] 
  },
  { 
    name: 'Growth',   
    annual: 99,  
    monthly: 129, 
    users: 8,  
    pop: true,
    desc: 'La suite completa de automatización para escalar sin límites.',
    features: ['Todo en Starter', 'Canales ilimitados de mensajería', 'Flyer Studio con IA', 'Lead Hunter (Google Places)', 'Captura nativa de TikTok + Meta Leads', 'Reportes analíticos avanzados'] 
  },
  { 
    name: 'Pro',      
    annual: 159, 
    monthly: 199, 
    users: 15, 
    desc: 'Arquitectura empresarial para grandes operaciones de volumen.',
    features: ['Todo en Growth', 'Workflows visuales automatizados', 'API REST & Webhooks avanzados', 'Inbox omnicanal unificado', 'Multi-workspace corporativo', 'SLA garantizado 99.9%'] 
  },
];

const FEATURES = [
  { icon: '◈', title: 'Cotizador + PDF', body: 'Genera cotizaciones profesionales con tu branding, envíalas por link y recibe pagos. Nadie más lo tiene integrado al CRM.' },
  { icon: '◉', title: 'Lead Hunter', body: 'Encuentra prospectos en Google Maps por industria y zona. 500 leads en 60 segundos. Exclusivo nuestro.' },
  { icon: '◐', title: 'Flyer Studio IA', body: 'Diseña materiales de marketing con inteligencia artificial, sin salir de la plataforma.' },
];

const WHY = [
  { t:'3× más cierres',    b:'AI scoring, seguimientos automáticos y cotizador integrado hacen que tu equipo cierre sin esfuerzo extra.' },
  { t:'Seguridad enterprise', b:'Multi-tenant con Row Level Security. Datos 100% aislados por empresa, nunca mezclados.' },
  { t:'Todo en uno',       b:'CRM + Marketing + Cotizador + AI Agents + Lead Hunter. Sin pagar 5 herramientas diferentes.' },
  { t:'Multi-empresa',     b:'Agencias y franquicias gestionan múltiples clientes desde una sola plataforma.' },
  { t:'Analytics en vivo', b:'Dashboard con Health Pulse, tendencias de venta y análisis completo de leads perdidos.' },
  { t:'Soporte real',      b:'Onboarding en español, soporte en vivo y un equipo que entiende el mercado latinoamericano.' },
];

const FAQS = [
  { q: '¿Cómo funciona la captura de leads de TikTok e Instagram?', a: 'Nos conectamos directamente a las APIs oficiales de TikTok Events y Meta Leads. Cuando un usuario llena un anuncio de formulario, el lead se inyecta en milisegundos en Arias CRM y activa opcionalmente el AI bot para contactarlo al instante.' },
  { q: '¿Qué es el Lead Hunter?', a: 'Es nuestro extractor exclusivo de datos. Te permite ingresar un sector (ej: "Gimnasios") y una ubicación (ej: "Ciudad de México"), y extrae automáticamente nombres, teléfonos oficiales, direcciones y coordenadas de Google Maps, inyectando cientos de leads cualificados en un clic.' },
  { q: '¿Tengo que firmar un contrato a largo plazo?', a: 'No. El plan mensual se puede cancelar en cualquier momento sin penalizaciones. Si eliges el plan anual, obtienes un 20% de descuento directo en tu facturación.' },
  { q: '¿El AI Agent funciona con mi propio número de WhatsApp?', a: 'Sí, puedes conectar tu número empresarial o usar nuestras integraciones oficiales para interactuar sin riesgos de bloqueo y con soporte multi-agente.' },
];

// ─── SVG BRAND LOGOS ─────────────────────────────────────────────────────────
const BrandIcon = ({ name }: { name: string }) => {
  switch (name) {
    case 'WhatsApp':
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#25D366">
          <path d="M12.012 2C6.485 2 2 6.487 2 12.012c0 1.767.46 3.426 1.262 4.887L2 22l5.234-1.373a9.98 9.98 0 004.778 1.208c5.527 0 10.012-4.485 10.012-10.012C22.024 6.487 17.539 2 12.012 2zm6.056 14.195c-.247.697-1.246 1.282-1.722 1.344-.45.06-1.037.09-2.833-.65-2.296-.948-3.774-3.284-3.889-3.438-.115-.15-1.012-1.343-1.012-2.565 0-1.22.638-1.819.866-2.063.228-.244.5-.305.667-.305.167 0 .333.003.479.01.147.007.345-.056.54.417.202.493.689 1.681.748 1.804.06.122.099.266.018.428-.08.163-.122.26-.244.402-.122.143-.257.319-.367.428-.122.12-.249.25-.107.493.143.244.636 1.05 1.36 1.697.933.83 1.716 1.087 1.96 1.208.244.12.387.102.53-.064.143-.167.612-.713.774-.956.163-.244.326-.204.549-.122.224.081 1.411.666 1.654.788.244.12.406.181.465.283.06.099.06.577-.187 1.274z" />
        </svg>
      );
    case 'Telegram':
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#0088cc">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.12 1.13-.64 4.2-1.01 6.18-.15.8-.3 1.2-.55 1.25-.56.09-.94-.33-1.48-.68-.84-.55-1.31-.88-2.12-1.42-.94-.62-.33-1.06.21-1.61.14-.14 2.53-2.32 2.58-2.54.01-.03.01-.13-.05-.18-.06-.05-.15-.03-.22-.02-.1.02-1.68 1.06-4.75 3.13-.45.31-.86.46-1.22.45-.4-.01-1.17-.23-1.74-.41-.7-.23-1.26-.35-1.21-.73.03-.2.27-.4.74-.6 2.9-1.26 4.83-2.1 5.8-2.5 2.76-1.12 3.33-1.32 3.7-1.32.08 0 .27.02.39.12.1.08.13.2.14.3-.01.06 0 .24-.02.39z" />
        </svg>
      );
    case 'Instagram':
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#E1306C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
      );
    case 'Facebook':
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2">
          <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.8c4.56-.93 8-4.96 8-9.8z" />
        </svg>
      );
    case 'TikTok':
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#000000">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.02 1.59 4.23.95.83 2.19 1.4 3.49 1.63v3.9c-.83-.02-1.66-.23-2.43-.55-.77-.38-1.46-.92-2.02-1.57-.02 2.16-.01 4.31-.02 6.47 0 1.25-.26 2.5-.83 3.61-.59.88-1.43 1.58-2.4 2.02-.97.43-2.05.59-3.1.48-1.28-.15-2.5-.77-3.37-1.72-.94-1.12-1.4-2.58-1.28-4.03.11-1.39.77-2.69 1.8-3.56.96-.81 2.2-1.28 3.46-1.29.02 1.34 0 2.67.01 4.01-1.24.08-2.4.92-2.77 2.12-.33.81-.19 1.76.36 2.45.54.73 1.46 1.08 2.36.96.9-.11 1.7-.76 1.99-1.63.15-.55.15-1.13.14-1.7.01-4.49 0-8.98.01-13.47z" />
        </svg>
      );
    case 'Zapier':
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#FF4F00">
          <path d="M19 10.5h-5.5V5c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v5.5H5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.5V19c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-5.5H19c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z" />
        </svg>
      );
    case 'Google Sheets':
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#0F9D58">
          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
        </svg>
      );
    default:
      return null;
  }
};

const Tick = () => (
  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400">
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  </span>
);

const Cross = () => (
  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-500/10 text-slate-600">
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  </span>
);

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [annual, setAnnual] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  // Live Interactive Testing Lead Capture Simulator
  const [simName, setSimName] = useState('');
  const [simPhone, setSimPhone] = useState('');
  const [simStatus, setSimStatus] = useState<'idle' | 'sending' | 'captured'>('idle');

  // ROI Interactive Calculator
  const [leads, setLeads] = useState(500);
  const [leadVal, setLeadVal] = useState(150);

  // Active Tab for Explorer
  const [activeTab, setActiveTab] = useState<'social' | 'agent' | 'billing'>('social');
  
  // Accordion state
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Interactive Feature Toggles for HubSpot Stack Comparison
  const [toggleAds, setToggleAds] = useState(true);
  const [toggleAI, setToggleAI] = useState(true);
  const [toggleQuote, setToggleQuote] = useState(true);
  const [toggleHunter, setToggleHunter] = useState(true);
  const [toggleInbox, setToggleInbox] = useState(true);

  const handleSimulate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simName || !simPhone) return;
    setSimStatus('sending');
    setTimeout(() => {
      setSimStatus('captured');
    }, 1200);
  };

  // Math models for ROI
  const closingRateCompetitor = 0.12; // 12% standard follow up
  const closingRateArias = 0.38; // 38% with immediate AI and quotes
  const closedCompetitor = Math.round(leads * closingRateCompetitor);
  const closedArias = Math.round(leads * closingRateArias);
  const extraRevenue = (closedArias - closedCompetitor) * leadVal;

  // Dyn calculations for comparison toggles
  let hsEquivalent = 90; // HubSpot Base Professional
  if (toggleAds) hsEquivalent += 120;
  if (toggleAI) hsEquivalent += 250;
  if (toggleQuote) hsEquivalent += 150;
  if (toggleHunter) hsEquivalent += 120;
  if (toggleInbox) hsEquivalent += 150;

  return (
    <div className="min-h-screen bg-[#07070d] text-white font-sans antialiased overflow-x-hidden" style={{fontFamily:"'Inter','system-ui',sans-serif"}}>
      <LandingNavbar onLoginClick={() => setShowLogin(true)} />

      {/* ─── HERO WITH LIVE SIMULATOR ────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col justify-center pt-32 pb-24 border-b border-white/[0.05]">
        {/* Futuristic glowing circles */}
        <div className="absolute top-[10%] left-[5%] w-[350px] h-[350px] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />
        <div className="absolute top-[40%] right-[5%] w-[450px] h-[450px] rounded-full bg-emerald-500/10 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[5%] left-[20%] w-[250px] h-[250px] rounded-full bg-purple-500/10 blur-[90px] pointer-events-none" />

        {/* Dynamic Matrix Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-12 gap-12 items-center relative z-10 w-full">
          {/* Left: Persuasive Core copy */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1.5 rounded-full mb-8 self-start">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[10px] font-bold text-indigo-300 tracking-[0.25em] uppercase">Módulo Social Captura V2.0</span>
            </div>

            <h1 className="text-5xl lg:text-7xl font-black leading-[0.95] tracking-tight mb-8">
              La landing page<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-indigo-300 to-emerald-400">
                que devora leads<br />e inyecta ventas.
              </span>
            </h1>

            <p className="text-base lg:text-lg text-slate-400 max-w-xl mb-10 leading-relaxed">
              Integra tus campañas de <span className="text-white font-semibold">TikTok, Instagram y Facebook</span>. AI Agents cualifican y nuestro cotizador profesional cierra el trato. Todo en piloto automático.
            </p>

            <div className="flex items-center gap-4 flex-wrap">
              {user ? (
                <button onClick={() => navigate('/dashboard')} className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-4 rounded-xl transition-all text-sm shadow-xl shadow-indigo-600/30">
                  Entrar al Centro de Control <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <>
                  <button onClick={() => navigate('/register')} className="inline-flex items-center gap-2 bg-white text-slate-950 hover:bg-slate-100 font-bold px-8 py-4 rounded-xl transition-all text-sm shadow-lg">
                    Empezar gratis 14 días <ArrowRight className="w-4 h-4" />
                  </button>
                  <button onClick={() => setShowLogin(true)} className="inline-flex items-center gap-2 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white font-semibold px-8 py-4 rounded-xl transition-all text-sm">
                    Ver demo guiada
                  </button>
                </>
              )}
            </div>

            {/* Micro proof bar */}
            <div className="mt-14 pt-8 border-t border-white/[0.05] flex flex-wrap gap-8 text-slate-500 text-xs">
              <div>🛡️ Encriptación Enterprise</div>
              <div>⚡ Latencia de Ingestión &lt;200ms</div>
              <div>💬 Meta & TikTok API Verified Partner</div>
            </div>
          </div>

          {/* Right: Live Interactive Webhook Simulator Mockup (Extremely high-tech landing page tech!) */}
          <div className="lg:col-span-5 bg-white/[0.02] backdrop-blur border border-white/10 rounded-3xl p-6 relative">
            <div className="absolute -top-3 -right-3 bg-emerald-500 text-slate-950 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow">
              Live Demo
            </div>

            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              </div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Visual Pipeline Simulator</span>
            </div>

            {simStatus === 'idle' && (
              <form onSubmit={handleSimulate} className="space-y-4">
                <p className="text-xs text-slate-400 mb-2">Simula el registro de un prospecto y observa cómo entra en vivo a la cola del CRM:</p>
                <div>
                  <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Nombre Completo</label>
                  <input 
                    type="text" 
                    placeholder="Carlos Mendoza"
                    required
                    value={simName}
                    onChange={e => setSimName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Teléfono o WhatsApp</label>
                  <input 
                    type="tel" 
                    placeholder="+503 7120 4488"
                    required
                    value={simPhone}
                    onChange={e => setSimPhone(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20">
                  <Zap className="w-3.5 h-3.5 fill-current" /> Disparar Webhook de Captura
                </button>
              </form>
            )}

            {simStatus === 'sending' && (
              <div className="py-12 flex flex-col items-center justify-center space-y-4">
                <span className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                <p className="text-xs font-bold text-indigo-400">Procesando firma HMAC & Graph API...</p>
              </div>
            )}

            {simStatus === 'captured' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-white">¡Lead Inyectado al CRM!</p>
                    <p className="text-[11px] text-slate-400 mt-1">El webhook de Meta/TikTok validó el token e inyectó los datos exitosamente en el Tenant ID de pruebas.</p>
                  </div>
                </div>

                <div className="bg-slate-900 border border-white/10 rounded-xl p-4 space-y-2">
                  <p className="text-[10px] font-black text-slate-500 uppercase">Estado en Pipeline Realtime:</p>
                  <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
                    <span className="text-slate-400">Prospecto:</span>
                    <span className="font-bold text-white">{simName}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
                    <span className="text-slate-400">Módulo Asignado:</span>
                    <span className="font-bold text-indigo-400">AI Follow-Up Active</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Acción Bot:</span>
                    <span className="font-bold text-emerald-400">WhatsApp Enviado ✅</span>
                  </div>
                </div>

                <button 
                  onClick={() => { setSimStatus('idle'); setSimName(''); setSimPhone(''); }}
                  className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold py-2 rounded-xl text-xs transition-colors"
                >
                  Probar otra vez
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── DYNAMIC INTEGRATIONS SHOWCASE ────────────────────────────────────── */}
      <section className="py-16 bg-[#040408] border-b border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-slate-500 text-xs font-semibold tracking-[0.2em] uppercase mb-8">Captura omnicanal directa en 1 clic</p>
          <div className="flex flex-wrap justify-center items-center gap-6">
            {CHANNELS.map(ch => (
              <div 
                key={ch.name} 
                className="flex items-center gap-3 border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/10 px-5 py-3 rounded-2xl transition-all cursor-default"
              >
                <BrandIcon name={ch.name} />
                <span className="text-sm font-semibold text-slate-300">{ch.name}</span>
                {ch.active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/50" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── INTERACTIVE ROI & SAVINGS CALCULATOR (Amazing high-converting tool!) ─── */}
      <section className="py-28 bg-[#07070d] border-b border-white/[0.05]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-black text-indigo-400 uppercase tracking-[0.25em]">Simulador de Negocio</span>
            <h2 className="text-4xl font-black text-white mt-3">Calcula el ROI real de Arias CRM</h2>
            <p className="text-slate-500 mt-2">Observa la enorme diferencia monetaria entre perder leads manuales vs automatizar con nosotros.</p>
          </div>

          <div className="grid md:grid-cols-12 gap-8 items-stretch">
            {/* Left: Input sliders */}
            <div className="md:col-span-5 bg-white/[0.02] border border-white/5 rounded-3xl p-8 flex flex-col justify-center space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-slate-300 uppercase">Leads por Mes</label>
                  <span className="text-sm font-black text-indigo-400">{leads} leads</span>
                </div>
                <input 
                  type="range" 
                  min="50" 
                  max="5000" 
                  step="50"
                  value={leads}
                  onChange={e => setLeads(Number(e.target.value))}
                  className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-slate-300 uppercase">Valor de Venta Promedio</label>
                  <span className="text-sm font-black text-indigo-400">${leadVal} USD</span>
                </div>
                <input 
                  type="range" 
                  min="10" 
                  max="2000" 
                  step="10"
                  value={leadVal}
                  onChange={e => setLeadVal(Number(e.target.value))}
                  className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 text-xs text-slate-400 leading-relaxed">
                🚀 Asumimos una tasa del <strong>12% de cierre manual</strong> (competencia) vs un <strong>38% de cierre automatizado</strong> mediante respuestas del AI bot en 5 segundos y cotizaciones instantáneas.
              </div>
            </div>

            {/* Right: Output Glowing Metrics */}
            <div className="md:col-span-7 bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-[150px] h-[150px] rounded-full bg-emerald-500/10 blur-[50px] pointer-events-none" />

              <div className="space-y-6">
                <div>
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Diferencia de Cierre</p>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="bg-slate-950 p-4 rounded-xl border border-white/5">
                      <p className="text-[10px] text-slate-500 font-bold uppercase">Cierres con HubSpot</p>
                      <p className="text-2xl font-black text-slate-400 mt-1">{closedCompetitor} ventas</p>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-xl border border-indigo-500/20">
                      <p className="text-[10px] text-indigo-400 font-bold uppercase">Cierres con Arias CRM</p>
                      <p className="text-2xl font-black text-emerald-400 mt-1">{closedArias} ventas</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-6">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Ingresos Mensuales Adicionales Estimados</p>
                  <p className="text-5xl lg:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-indigo-300 tracking-tight mt-2">
                    +${extraRevenue.toLocaleString()} <span className="text-sm font-medium text-slate-500">USD/mes</span>
                  </p>
                </div>
              </div>

              <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6 border-t border-white/10">
                <p className="text-xs text-slate-500">Ahorra hasta $800/mes en suscripciones redundantes.</p>
                <button onClick={() => navigate('/register')} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-6 py-2.5 rounded-xl text-xs transition-colors shrink-0 shadow-lg shadow-emerald-500/20">
                  Capturar este Retorno Ahora
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── DYNAMIC PRODUCT EXPLORER ────────────────────────────────────────── */}
      <section className="py-28 bg-[#040408] border-b border-white/[0.05]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-black text-indigo-400 uppercase tracking-[0.25em]">Tecnología en Acción</span>
            <h2 className="text-4xl font-black text-white mt-3">Diseño pensado para convertir</h2>
            <p className="text-slate-500 mt-2">Nuestra plataforma cuenta con herramientas exclusivas que la competencia simplemente no ofrece.</p>
          </div>

          {/* Interactive Feature Toggles */}
          <div className="flex justify-center gap-3 mb-12 flex-wrap">
            <button
              onClick={() => setActiveTab('social')}
              className={`px-6 py-3.5 rounded-full text-xs font-black transition-all ${activeTab === 'social' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'}`}
            >
              ⚡ Captura Social Express
            </button>
            <button
              onClick={() => setActiveTab('agent')}
              className={`px-6 py-3.5 rounded-full text-xs font-black transition-all ${activeTab === 'agent' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'}`}
            >
              🤖 AI Agent Autopilot
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`px-6 py-3.5 rounded-full text-xs font-black transition-all ${activeTab === 'billing' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'}`}
            >
              💸 Cotizador & Cobros
            </button>
          </div>

          {/* Dynamic Content Panel */}
          <div className="bg-white/[0.01] border border-white/10 rounded-3xl overflow-hidden grid md:grid-cols-12">
            <div className="p-8 md:p-12 md:col-span-5 flex flex-col justify-center">
              {activeTab === 'social' && (
                <>
                  <span className="text-[10px] font-black bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full uppercase tracking-wider self-start mb-6">Omnicanal V2</span>
                  <h3 className="text-2xl font-black text-white mb-4 leading-tight">Cero leads perdidos en campañas.</h3>
                  <p className="text-sm text-slate-400 leading-relaxed mb-8">
                    Tus formularios de anuncios en redes sociales inyectan datos de forma instantánea. Olvídate de dependencias de Zapier lentas o exportaciones de CSV manuales de fin de semana.
                  </p>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <BrandIcon name="WhatsApp" />
                      <span className="text-xs font-semibold text-slate-300">WhatsApp Webhook Integrado</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <BrandIcon name="TikTok" />
                      <span className="text-xs font-semibold text-slate-300">TikTok Leads API Oficial</span>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'agent' && (
                <>
                  <span className="text-[10px] font-black bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full uppercase tracking-wider self-start mb-6">Autopilot</span>
                  <h3 className="text-2xl font-black text-white mb-4 leading-tight">Contacta a tu prospecto en 5 segundos.</h3>
                  <p className="text-sm text-slate-400 leading-relaxed mb-8">
                    El AI Agent inteligente interactúa con el cliente al instante, califica su interés, responde objeciones comunes y agenda una reunión en tu calendario.
                  </p>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-base">🎯</span>
                      <span className="text-xs font-semibold text-slate-300">Calificación Automática de Prospectos</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-base">📅</span>
                      <span className="text-xs font-semibold text-slate-300">Agendamiento de Citas 24/7</span>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'billing' && (
                <>
                  <span className="text-[10px] font-black bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full uppercase tracking-wider self-start mb-6">Finanzas</span>
                  <h3 className="text-2xl font-black text-white mb-4 leading-tight">Cierra tratos con PDFs impecables.</h3>
                  <p className="text-sm text-slate-400 leading-relaxed mb-8">
                    Genera presupuestos, cotizaciones y facturas profesionales con tu branding de manera nativa. El cliente puede revisar, configurar módulos opcionales y pagar en línea de inmediato.
                  </p>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-base">📄</span>
                      <span className="text-xs font-semibold text-slate-300">Cotizador Dinámico & Editor de PDF</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-base">💳</span>
                      <span className="text-xs font-semibold text-slate-300">Pasarelas de Pago Directas</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Dynamic Screen Mockup */}
            <div className="bg-[#0b0b12] p-8 md:col-span-7 flex items-center justify-center border-t md:border-t-0 md:border-l border-white/[0.08] min-h-[360px] relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-transparent pointer-events-none" />

              {activeTab === 'social' && (
                <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl p-5 shadow-2xl space-y-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-3">
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Ingestado
                    </span>
                    <span className="text-[10px] text-slate-500">Meta Graph API V19.0</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <p className="text-slate-400">Campaña de Origen:</p>
                    <p className="font-bold text-white">📸 Meta Lead Ads — Black Friday Promo</p>
                    <div className="bg-slate-950 p-3 rounded-lg space-y-1.5 text-[11px] text-slate-300">
                      <p><strong>Nombre:</strong> Carlos Mendoza</p>
                      <p><strong>WhatsApp:</strong> +503 7120 4488</p>
                      <p><strong>Campaña ID:</strong> camp_meta_4091</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'agent' && (
                <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl p-5 shadow-2xl space-y-3">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    <span className="text-xs font-black text-white">AI Agent Conversacional</span>
                  </div>
                  <div className="text-[11px] space-y-2 flex flex-col">
                    <div className="bg-slate-800 text-white rounded-lg p-2.5 max-w-[85%] self-start">
                      ¡Hola Carlos! Veo tu interés en Arias CRM. ¿Cuántos asesores tiene tu negocio?
                    </div>
                    <div className="bg-indigo-600 text-white rounded-lg p-2.5 max-w-[85%] self-end">
                      Hola. Somos un equipo de 6 vendedores en nuestra distribuidora.
                    </div>
                    <div className="bg-slate-800 text-white rounded-lg p-2.5 max-w-[85%] self-start">
                      Excelente, el Plan Growth es ideal. ¿Deseas que te agende una demo de 15 minutos mañana?
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'billing' && (
                <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl p-5 shadow-2xl space-y-3">
                  <div className="flex justify-between items-center border-b border-white/5 pb-3">
                    <span className="text-xs font-black text-white">Cotización #1092</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-black">Generada</span>
                  </div>
                  <div className="space-y-2 text-[11px] text-slate-300">
                    <div className="flex justify-between">
                      <span>Base Plan (Growth Anual)</span>
                      <span>$1,188.00/yr</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Módulo Lead Hunter</span>
                      <span>Incluido</span>
                    </div>
                    <div className="flex justify-between border-t border-white/5 pt-2 font-black text-white text-xs">
                      <span>Total</span>
                      <span>$1,188.00</span>
                    </div>
                  </div>
                  <div className="pt-2 flex gap-2">
                    <button className="flex-1 bg-indigo-600 text-white text-[10px] font-black py-2 rounded-lg">Pagar en línea</button>
                    <button className="flex-1 bg-slate-800 text-slate-400 text-[10px] font-black py-2 rounded-lg">Bajar PDF</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── EXCLUSIVOS FEATURE TILES ───────────────────────────────────────── */}
      <section className="py-28 bg-[#07070d] border-b border-white/[0.05]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-16">
            <span className="text-xs font-black text-amber-500 uppercase tracking-[0.25em] mb-4 block">Exclusivos</span>
            <h2 className="text-4xl font-black text-white leading-tight">Features que HubSpot<br />no ofrece a ningún precio.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="p-8 rounded-3xl bg-white/[0.01] border border-white/5 hover:border-white/10 hover:shadow-xl transition-all group">
                <span className="text-2xl text-slate-600 font-black block mb-6 group-hover:text-indigo-400 transition-colors">{f.icon}</span>
                <h3 className="text-base font-black text-white mb-3">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── INTERACTIVE COMPARISON STACK WITH Futuristic TOGGLE SWITCHES ────────── */}
      <section className="py-28 bg-[#040408] border-b border-white/[0.05]">
        <div className="max-w-5xl mx-auto px-6">
          
          <div className="text-center mb-16">
            <span className="text-xs font-black text-indigo-400 uppercase tracking-[0.25em]">El Stack Tecnológico Definitivo</span>
            <h2 className="text-4xl lg:text-5xl font-black text-white mt-3 leading-tight">
              ¿Por qué gastar fortunas en<br />HubSpot o respond.io?
            </h2>
            <p className="text-slate-500 mt-3 max-w-xl mx-auto text-sm">
              Activa o desactiva las herramientas que necesitas para ver el costo acumulado de armar el mismo stack en otras plataformas frente a la tarifa única de Arias CRM.
            </p>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 items-stretch">
            
            {/* Left Col: The High-Tech Toggle Matrix */}
            <div className="lg:col-span-7 bg-[#080812]/50 border border-white/5 rounded-3xl p-8 space-y-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-[200px] h-[200px] bg-indigo-500/5 blur-[80px] pointer-events-none" />
              
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-3">Herramientas & Integraciones</p>
              
              {/* Toggle 1 */}
              <div className="flex items-center justify-between gap-6 p-4 rounded-2xl bg-white/[0.01] border border-white/5 hover:border-white/10 transition-all">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white">Captura Automatizada de Ads (TikTok/FB/IG)</p>
                  <p className="text-xs text-slate-400">Ingestión inmediata de leads sin Zapier ($120/mes de ahorro).</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input 
                    type="checkbox" 
                    checked={toggleAds} 
                    onChange={() => setToggleAds(!toggleAds)} 
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Toggle 2 */}
              <div className="flex items-center justify-between gap-6 p-4 rounded-2xl bg-white/[0.01] border border-white/5 hover:border-white/10 transition-all">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                    AI Agent Conversacional 24/7 (WhatsApp) <Sparkles className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
                  </p>
                  <p className="text-xs text-slate-400">Bot autónomo que califica y agenda citas ($250/mes de ahorro).</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input 
                    type="checkbox" 
                    checked={toggleAI} 
                    onChange={() => setToggleAI(!toggleAI)} 
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Toggle 3 */}
              <div className="flex items-center justify-between gap-6 p-4 rounded-2xl bg-white/[0.01] border border-white/5 hover:border-white/10 transition-all">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white">Cotizador Integrado con PDF Pro</p>
                  <p className="text-xs text-slate-400">Presupuestos interactivos editables en segundos ($150/mes de ahorro).</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input 
                    type="checkbox" 
                    checked={toggleQuote} 
                    onChange={() => setToggleQuote(!toggleQuote)} 
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Toggle 4 */}
              <div className="flex items-center justify-between gap-6 p-4 rounded-2xl bg-white/[0.01] border border-white/5 hover:border-white/10 transition-all">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white">Extractor Lead Hunter (Google Maps)</p>
                  <p className="text-xs text-slate-400">Minería de prospectos B2B en frío ilimitada ($120/mes de ahorro).</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input 
                    type="checkbox" 
                    checked={toggleHunter} 
                    onChange={() => setToggleHunter(!toggleHunter)} 
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Toggle 5 */}
              <div className="flex items-center justify-between gap-6 p-4 rounded-2xl bg-white/[0.01] border border-white/5 hover:border-white/10 transition-all">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white">Inbox Omnicanal WhatsApp / Telegram</p>
                  <p className="text-xs text-slate-400">Bandeja compartida para múltiples agentes ($150/mes de ahorro).</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input 
                    type="checkbox" 
                    checked={toggleInbox} 
                    onChange={() => setToggleInbox(!toggleInbox)} 
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                </label>
              </div>

            </div>

            {/* Right Col: The Live Comparative Price Counter */}
            <div className="lg:col-span-5 bg-[#0c0c1b]/30 border border-indigo-500/20 rounded-3xl p-8 flex flex-col justify-between relative overflow-hidden shadow-[0_0_50px_-12px_rgba(99,102,241,0.2)]">
              <div className="absolute top-0 right-0 w-[180px] h-[180px] bg-indigo-500/10 blur-[60px] pointer-events-none" />
              
              <div className="space-y-6">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-white/5 pb-3">Comparativa de Costo Mensual</p>
                
                {/* Competitor price card */}
                <div className="bg-slate-950/80 border border-white/5 p-5 rounded-2xl">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Stack HubSpot + respond.io</p>
                  <p className="text-4xl font-black text-slate-300 tracking-tight mt-1 animate-fadeIn">
                    ${hsEquivalent} <span className="text-xs font-semibold text-slate-600">USD/mes</span>
                  </p>
                  <p className="text-[10px] text-red-400 mt-2">⚠️ Requiere contratos anuales obligatorios.</p>
                </div>

                {/* Arias CRM flat price card */}
                <div className="bg-indigo-950/20 border border-indigo-500/30 p-5 rounded-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-8 h-8 bg-emerald-500/10 rounded-full blur-md" />
                  <p className="text-[10px] text-indigo-400 font-black uppercase tracking-wider flex items-center gap-1">
                    Arias CRM <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded uppercase font-black tracking-normal">Tarifa Única</span>
                  </p>
                  <p className="text-4xl font-black text-emerald-400 tracking-tight mt-1">
                    $65 <span className="text-xs font-semibold text-emerald-600">USD/mes</span>
                  </p>
                  <p className="text-[10px] text-emerald-400 mt-2 font-semibold">✅ Todo incluido. Cancela cuando quieras.</p>
                </div>

                {/* Savings highlights */}
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <p className="text-[11px] text-slate-300 font-semibold">¡Ahorras hasta con esta configuración!</p>
                  <p className="text-2xl font-black text-emerald-400 mt-1">
                    -${(hsEquivalent - 65)} USD/mes
                  </p>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/5">
                <button onClick={() => navigate('/register')} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl text-xs transition-all shadow-lg shadow-indigo-600/30">
                  Obtener todo el stack por $65/mes
                </button>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* ─── PRICING WITH CLASSIC CAPSULE TOGGLE ────────────────────────────────── */}
      <section id="pricing" className="py-28 scroll-mt-20 border-b border-white/[0.05]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-14">
            <div>
              <span className="text-xs font-black text-indigo-600 uppercase tracking-[0.25em] mb-4 block">Precios Transparentes</span>
              <h2 className="text-4xl font-black text-white leading-tight">Planes simples.<br />Sin cargos ocultos.</h2>
            </div>

            {/* Restored capsule selector exactly as requested */}
            <div className="inline-flex items-center gap-1.5 bg-white/5 rounded-full p-1.5 border border-white/10">
              <button
                onClick={() => setAnnual(true)}
                className={`px-5 py-2 rounded-full text-xs font-black transition-all ${annual ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                Anual — 20% off
              </button>
              <button
                onClick={() => setAnnual(false)}
                className={`px-5 py-2 rounded-full text-xs font-black transition-all ${!annual ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                Mensual
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-start">
            {PLANS.map(plan => {
              const price = annual ? plan.annual : plan.monthly;
              return (
                <div key={plan.name} className={`rounded-3xl p-8 border transition-all bg-white/[0.01] ${plan.pop ? 'border-indigo-500 shadow-2xl shadow-indigo-600/10 relative' : 'border-white/10'}`}>
                  {plan.pop && (
                    <span className="absolute -top-3 left-6 text-[10px] font-black bg-indigo-600 text-white px-3 py-1 rounded-full uppercase tracking-widest shadow">Popular</span>
                  )}
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">{plan.name}</p>
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="text-5xl font-black text-white tracking-tight">${price}</span>
                    <span className="text-slate-500 text-sm font-semibold">/mo</span>
                  </div>
                  {annual && (
                    <p className="text-[11px] text-emerald-400 mb-6 font-semibold">Facturado ${price*12}/año · Ahorras ${(plan.monthly-plan.annual)*12}/año</p>
                  )}
                  <p className="text-xs text-slate-400 leading-relaxed mb-6">{plan.desc}</p>
                  <button onClick={() => navigate('/register')} className={`w-full text-xs font-black py-3 rounded-xl mb-8 transition-all ${plan.pop ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'}`}>
                    Prueba 14 días gratis
                  </button>
                  <ul className="space-y-4">
                    <li className="flex items-start gap-2.5 text-xs text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <span>Hasta <strong>{plan.users}</strong> asesores integrados</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-xs text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <span><strong>Contactos ilimitados</strong> en CRM</span>
                    </li>
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-xs text-slate-500">
                        <CheckCircle2 className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── WHY US ────────────────────────────────────────────────────────── */}
      <section className="py-28 border-b border-white/[0.05]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-16">
            <span className="text-xs font-black text-indigo-600 uppercase tracking-[0.25em] mb-4 block">Beneficios</span>
            <h2 className="text-4xl font-black text-white leading-tight max-w-sm">Resultados, no complejidad.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {WHY.map(w => (
              <div key={w.t} className="group">
                <h3 className="text-sm font-black text-white mb-2 group-hover:text-indigo-400 transition-colors">{w.t}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{w.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── INTERACTIVE FAQ ACCORDION (Top landing tech!) ─── */}
      <section className="py-28 bg-[#040408] border-b border-white/[0.05]">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-black text-indigo-400 uppercase tracking-[0.25em]">Preguntas Frecuentes</span>
            <h2 className="text-4xl font-black text-white mt-3">Todo lo que debes saber</h2>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq, idx) => (
              <div 
                key={idx} 
                className="border border-white/5 bg-white/[0.01] rounded-2xl overflow-hidden transition-all"
              >
                <button
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="w-full p-6 text-left flex justify-between items-center focus:outline-none"
                >
                  <span className="text-sm font-bold text-white">{faq.q}</span>
                  <span className="text-slate-400 font-bold ml-4">
                    {activeFaq === idx ? '−' : '+'}
                  </span>
                </button>
                {activeFaq === idx && (
                  <div className="px-6 pb-6 text-xs text-slate-400 leading-relaxed border-t border-white/[0.03] pt-4 animate-fadeIn">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ───────────────────────────────────────────────────────────── */}
      <section className="py-28 relative">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
        <div className="max-w-2xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-5xl font-black text-white leading-tight mb-6 tracking-tight">
            Empieza a capturar<br />leads hoy mismo.
          </h2>
          <p className="text-slate-400 mb-10 text-sm">14 días gratis · Sin tarjeta de crédito · Configuración en 5 minutos.</p>
          <button onClick={() => navigate('/register')} className="inline-flex items-center gap-2 bg-white text-slate-950 font-bold px-10 py-4 rounded-xl hover:bg-slate-100 transition-all text-sm shadow-2xl shadow-white/20">
            Crear cuenta gratis <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-slate-600 text-xs mt-6">40% más económico que HubSpot · Más versátil que respond.io</p>
        </div>
      </section>

      <LandingFooter />
      <AriasAgent />

      {showLogin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-[#0b0b12] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <button onClick={() => setShowLogin(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-lg transition-colors z-10">
              <X className="w-4 h-4" />
            </button>
            <div className="p-8"><Login /></div>
          </div>
        </div>
      )}
    </div>
  );
}
