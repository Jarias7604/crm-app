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
  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400">
    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  </span>
);

const Cross = () => (
  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-500/15 text-red-400">
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  </span>
);

// ─── HIGH-TECH PRODUCT DETAILS DATA (For interactive info modal popups) ─────
const PRODUCT_DETAILS: Record<string, {
  title: string;
  tag: string;
  desc: string;
  bullets: string[];
  metric: string;
  metricLabel: string;
  techStack: string[];
  mockup: string;
}> = {
  'tiktok-api': {
    title: 'TikTok API Ingestión Express',
    tag: 'INTEGRACIÓN DIRECTA V2',
    desc: 'Conéctate directamente a la API oficial de TikTok Leads sin intermediarios lentos o costosos como Zapier. Recibe prospectos en tiempo real con latencia menor a 120ms.',
    bullets: [
      'Suscripción automática a webhooks oficiales de TikTok Leads.',
      'Validación de firma HMAC y cifrado SHA-256 para seguridad absoluta.',
      'Sincronización instantánea con campos del CRM.',
      'Acciones automatizadas inmediatas al recibir el lead.'
    ],
    metric: '<120ms',
    metricLabel: 'Latencia de Ingestión',
    techStack: ['TikTok Graph API', 'HMAC Validation', 'SHA-256 Encryption'],
    mockup: 'tiktok'
  },
  'meta-ads': {
    title: 'Meta Leads API & Webhook',
    tag: 'CAMPANAS FB/IG',
    desc: 'Inyecta datos de prospectos desde formularios de Facebook e Instagram al instante. Nuestro sistema procesa las peticiones de Meta Graph API de manera asíncrona para garantizar cero pérdida de registros.',
    bullets: [
      'Conexión nativa con Meta Leads Ads API.',
      'Desduplicación automática de prospectos basada en teléfono/email.',
      'Disparadores automáticos de secuencias de seguimiento.',
      'Asignación automática de leads según canal o presupuesto.'
    ],
    metric: '100%',
    metricLabel: 'Tasa de Captura',
    techStack: ['Meta Graph API v19.0', 'Webhook Handshake', 'Async Queueing'],
    mockup: 'meta'
  },
  'whatsapp-gen': {
    title: 'WhatsApp Lead Generator Widget',
    tag: 'CAPTURA DESDE SITIO WEB',
    desc: 'Un widget flotante premium para tu landing page que convierte visitantes pasivos en conversaciones activas de WhatsApp. Inicia el bot calificador en 5 segundos.',
    bullets: [
      'Widget altamente personalizable con micro-animaciones.',
      'Captura previa de datos clave (nombre, negocio) antes del desvío.',
      'Enrutamiento inteligente según disponibilidad del agente.',
      'Historial de chats enlazado al perfil del lead automáticamente.'
    ],
    metric: '+35%',
    metricLabel: 'Conversión de Tráfico',
    techStack: ['React Widget', 'WhatsApp Click-to-Chat', 'Lead Router'],
    mockup: 'whatsapp'
  },
  'ai-agent': {
    title: 'AI Agent Conversacional Autopilot',
    tag: 'INTELIGENCIA ARTIFICIAL GPT-4',
    desc: 'Tu agente de ventas virtual que trabaja 24/7 en WhatsApp. Califica prospectos, resuelve objeciones comunes y agenda citas directamente en tu calendario.',
    bullets: [
      'Respuestas hiper-contextuales impulsadas por GPT-4o.',
      'Calificación de leads en base a presupuesto y urgencia.',
      'Agendamiento de citas en tiempo real con Google Calendar y Outlook.',
      'Transferencia fluida a agentes humanos cuando se detecta intención de compra caliente.'
    ],
    metric: '38%',
    metricLabel: 'Tasa de Conversión (vs 12% manual)',
    techStack: ['GPT-4o API', 'Embeddings vectoriales', 'Calendar OAuth Sync'],
    mockup: 'ai_agent'
  },
  'omnicanal': {
    title: 'Bandeja de Entrada Omnicanal',
    tag: 'COLABORACIÓN EN EQUIPO',
    desc: 'Una bandeja centralizada y colaborativa para que todo tu equipo atienda chats de WhatsApp, Instagram, Facebook y Telegram sin cruzar cuentas ni perder contexto.',
    bullets: [
      'Conversaciones multi-canal en un solo hilo unificado.',
      'Notas internas invisibles para el cliente para soporte de equipo.',
      'Asignación manual o rotativa (Round-Robin) de chats.',
      'Respuestas rápidas, plantillas oficiales y envío de cotizaciones en un clic.'
    ],
    metric: '0',
    metricLabel: 'Mensajes Sin Responder',
    techStack: ['WebSockets', 'Shared Inbox Orchestrator', 'Rotative Allocator'],
    mockup: 'inbox'
  },
  'lead-hunter': {
    title: 'Lead Hunter (Google Maps Extractor)',
    tag: 'MINERÍA DE LEADS B2B',
    desc: 'La herramienta definitiva para la prospección B2B en frío. Extrae automáticamente cientos de empresas locales con teléfonos, correos y páginas web con solo ingresar una palabra clave y una ciudad.',
    bullets: [
      'Extracción directa desde Google Places API.',
      'Validación de números telefónicos y formatos internacionales.',
      'Enriquecimiento automático de emails buscando dominios activos.',
      'Exportación en un clic o inyección directa a embudos de marketing.'
    ],
    metric: '500+',
    metricLabel: 'Leads/minuto extraídos',
    techStack: ['Google Places SDK', 'Web Scraper Crawler', 'Deduplication Pipeline'],
    mockup: 'hunter'
  },
  'cotizador': {
    title: 'Cotizador Profesional Dinámico',
    tag: 'FINANZAS & DOCUMENTOS PRO',
    desc: 'Crea propuestas comerciales y cotizaciones con partidas detalladas en menos de 60 segundos. Genera PDFs espectaculares adaptados a la marca de tu empresa de forma automática.',
    bullets: [
      'Cálculo exacto de impuestos, descuentos y esquemas de pago.',
      'Módulos opcionales configurables por el cliente final.',
      'Control de versiones de propuestas y validez comercial.',
      'Generador PDF con firma digital y marca de agua corporativa.'
    ],
    metric: '<1 min',
    metricLabel: 'Tiempo de Creación',
    techStack: ['PDF Rendering Engine', 'Catalog Sync', 'Taxation Logic Salvador'],
    mockup: 'cotizador'
  },
  'cobros': {
    title: 'Portal de Cobros & Facturación',
    tag: 'FLUJO DE CAJA ACELERADO',
    desc: 'Un portal público y seguro para tu cliente donde puede revisar su cotización comercial y pagarte directamente en línea mediante tarjeta de crédito o transferencia.',
    bullets: [
      'Integración directa con pasarelas de pago locales.',
      'Soporte para múltiples monedas y pasarelas.',
      'Generación automática de recibos y facturas fiscales.',
      'Recordatorios automatizados de pago vía WhatsApp.'
    ],
    metric: '2.5x',
    metricLabel: 'Velocidad de Recaudo',
    techStack: ['Payment Gateway APIs', 'Receipt Auto-generator', 'Invoice Tracker'],
    mockup: 'cobros'
  },
  'flyer': {
    title: 'Flyer Studio IA',
    tag: 'MARKETING MULTIMEDIA',
    desc: 'Genera contenido promocional de alto impacto para campañas utilizando inteligencia artificial. Diseña artes listos para publicar en Instagram y Facebook sin saber de diseño gráfico.',
    bullets: [
      'Generador de imágenes impulsado por IA para productos.',
      'Adaptación automática de formatos para historias y publicaciones.',
      'Escribe copys promocionales de alta conversión adjuntos al flyer.',
      'Programador de publicaciones automáticas en canales oficiales.'
    ],
    metric: '90%',
    metricLabel: 'Ahorro en Costo de Diseño',
    techStack: ['Creative AI Models', 'Layout Auto-composer', 'FB Publisher API'],
    mockup: 'flyer'
  }
};

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

  // Active product/feature for detailed popup modal
  const [activeProductDetail, setActiveProductDetail] = useState<string | null>(null);

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
      <LandingNavbar onLoginClick={() => setShowLogin(true)} onProductClick={setActiveProductDetail} />

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

      {/* ─── DYNAMIC PRODUCT EXPLORER (LIGHT THEME MIX) ────────────────────────── */}
      <section className="py-28 bg-[#f8fafc] border-y border-slate-200/60 relative overflow-hidden">
        {/* Subtle grid pattern background for the light theme */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-35" />

        <div className="max-w-5xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <span className="text-xs font-black text-blue-600 uppercase tracking-[0.25em]">Tecnología en Acción</span>
            <h2 className="text-4xl lg:text-5xl font-black text-slate-900 mt-3 leading-tight">Diseño pensado para convertir</h2>
            <p className="text-slate-600 mt-3 max-w-xl mx-auto text-sm">Nuestra plataforma cuenta con herramientas exclusivas que la competencia simplemente no ofrece.</p>
          </div>

          {/* Interactive Feature Toggles - Light themed */}
          <div className="flex justify-center gap-3 mb-12 flex-wrap">
            <button
              onClick={() => setActiveTab('social')}
              className={`px-6 py-3.5 rounded-full text-xs font-black transition-all ${activeTab === 'social' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-slate-200/60 text-slate-700 hover:text-slate-900 border border-slate-300/40'}`}
            >
              ⚡ Captura Social Express
            </button>
            <button
              onClick={() => setActiveTab('agent')}
              className={`px-6 py-3.5 rounded-full text-xs font-black transition-all ${activeTab === 'agent' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-slate-200/60 text-slate-700 hover:text-slate-900 border border-slate-300/40'}`}
            >
              🤖 AI Agent Autopilot
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`px-6 py-3.5 rounded-full text-xs font-black transition-all ${activeTab === 'billing' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-slate-200/60 text-slate-700 hover:text-slate-900 border border-slate-300/40'}`}
            >
              💸 Cotizador & Cobros
            </button>
          </div>

          {/* Dynamic Content Panel - Premium Light Box */}
          <div className="bg-white border border-slate-200/80 rounded-3xl shadow-xl overflow-hidden grid md:grid-cols-12">
            <div className="p-8 md:p-12 md:col-span-5 flex flex-col justify-center bg-slate-50/50">
              {activeTab === 'social' && (
                <>
                  <span className="text-[10px] font-black bg-blue-100 text-blue-700 border border-blue-200/60 px-3 py-1 rounded-full uppercase tracking-wider self-start mb-6">Omnicanal V2</span>
                  <h3 className="text-2xl font-black text-slate-900 mb-4 leading-tight">Cero leads perdidos en campañas.</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-8">
                    Tus formularios de anuncios en redes sociales inyectan datos de forma instantánea. Olvídate de dependencias de Zapier lentas o exportaciones de CSV manuales de fin de semana.
                  </p>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <BrandIcon name="WhatsApp" />
                      <span className="text-xs font-bold text-slate-700">WhatsApp Webhook Integrado</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <BrandIcon name="TikTok" />
                      <span className="text-xs font-bold text-slate-700">TikTok Leads API Oficial</span>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'agent' && (
                <>
                  <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200/60 px-3 py-1 rounded-full uppercase tracking-wider self-start mb-6">Autopilot</span>
                  <h3 className="text-2xl font-black text-slate-900 mb-4 leading-tight">Contacta a tu prospecto en 5 segundos.</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-8">
                    El AI Agent inteligente interactúa con el cliente al instante, califica su interés, responde objeciones comunes y agenda una reunión en tu calendario.
                  </p>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-base">🎯</span>
                      <span className="text-xs font-bold text-slate-700">Calificación Automática de Prospectos</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-base">📅</span>
                      <span className="text-xs font-bold text-slate-700">Agendamiento de Citas 24/7</span>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'billing' && (
                <>
                  <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 border border-indigo-200/60 px-3 py-1 rounded-full uppercase tracking-wider self-start mb-6">Finanzas</span>
                  <h3 className="text-2xl font-black text-slate-900 mb-4 leading-tight">Cierra tratos con PDFs impecables.</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-8">
                    Genera presupuestos, cotizaciones y facturas profesionales con tu branding de manera nativa. El cliente puede revisar, configurar módulos opcionales y pagar en línea de inmediato.
                  </p>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-base">📄</span>
                      <span className="text-xs font-bold text-slate-700">Cotizador Dinámico & Editor de PDF</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-base">💳</span>
                      <span className="text-xs font-bold text-slate-700">Pasarelas de Pago Directas</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Dynamic Screen Mockup - Beautiful dark-slate inside canvas */}
            <div className="bg-[#0b0b12] p-8 md:col-span-7 flex items-center justify-center border-t md:border-t-0 md:border-l border-slate-200/60 min-h-[360px] relative">
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

      {/* ─── PRICING COMPARISON MATRIX (Inspired by respond.io Pricing Grid) ─── */}
      <section id="pricing" className="py-28 bg-[#07070d] border-b border-white/[0.05] scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-black text-indigo-400 uppercase tracking-[0.25em] mb-4 block">Comparativa Premium</span>
            <h2 className="text-4xl lg:text-5xl font-black text-white leading-tight">
              Encuentra el plan perfecto para tu equipo
            </h2>
            <p className="text-slate-400 mt-4 max-w-xl mx-auto text-sm">
              Compara detalladamente las características y descubre por qué Arias CRM es la mejor alternativa integrada del mercado.
            </p>
          </div>

          {/* Pricing Grid & Table Wrapper */}
          <div className="bg-[#0b0b18]/40 border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(99,102,241,0.05)]">
            
            {/* 1. Header Control Panel */}
            <div className="p-8 border-b border-white/10 bg-[#0c0c1b]/60 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-4">
                <span className="text-sm font-black text-white uppercase tracking-wider">Comparar Planes</span>
                
                {/* Yearly / Monthly Toggle Switch */}
                <div className="inline-flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/10">
                  <button
                    onClick={() => setAnnual(true)}
                    className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all ${
                      annual ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Anual (20% OFF)
                  </button>
                  <button
                    onClick={() => setAnnual(false)}
                    className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all ${
                      !annual ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Mensual
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-500 font-medium">
                🚀 Prueba gratis por 14 días · Sin tarjetas · Configuración en 5 minutos
              </div>
            </div>

            {/* 2. Scrollable Table Container */}
            <div className="overflow-x-auto lg:overflow-visible">
              <table className="w-full min-w-[900px] border-collapse text-left">
                {/* Plan Header row */}
                <thead>
                  <tr>
                    {/* Characteristics Header */}
                    <th className="lg:sticky lg:top-[96px] z-30 lg:bg-[#07070d]/95 lg:backdrop-blur-md p-6 text-sm font-black text-slate-500 uppercase tracking-widest w-[30%] border-b border-white/10">
                      Características
                    </th>
                    
                    {/* Starter Header */}
                    <th className="lg:sticky lg:top-[96px] z-30 lg:bg-[#07070d]/95 lg:backdrop-blur-md p-6 text-center w-[17.5%] border-r border-b border-white/10">
                      <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Starter</p>
                      <div className="flex items-baseline justify-center gap-0.5 mb-4">
                        <span className="text-3xl font-black text-white">${annual ? 49 : 65}</span>
                        <span className="text-[10px] text-slate-500">/mes</span>
                      </div>
                      <button onClick={() => navigate('/register')} className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 text-[10px] font-bold py-2 rounded-xl transition-all">
                        Iniciar Prueba
                      </button>
                    </th>

                    {/* Growth Header (Highlighted) */}
                    <th className="lg:sticky lg:top-[96px] z-30 lg:bg-[#0c0c22]/95 lg:backdrop-blur-md p-6 text-center w-[20%] border-x border-b border-indigo-500/25 relative shadow-[0_4px_30px_rgba(99,102,241,0.08)]">
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[8px] font-black bg-indigo-600 text-white px-2.5 py-1 rounded-full uppercase tracking-widest shadow-md">
                        Recomendado
                      </span>
                      <p className="text-xs font-black text-indigo-400 uppercase tracking-wider mb-2 mt-1">Growth</p>
                      <div className="flex items-baseline justify-center gap-0.5 mb-4">
                        <span className="text-3xl font-black text-emerald-400">${annual ? 99 : 129}</span>
                        <span className="text-[10px] text-slate-500">/mes</span>
                      </div>
                      <button onClick={() => navigate('/register')} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-black py-2 rounded-xl transition-all shadow-lg shadow-emerald-500/10">
                        Iniciar Prueba
                      </button>
                    </th>

                    {/* Pro Header */}
                    <th className="lg:sticky lg:top-[96px] z-30 lg:bg-[#07070d]/95 lg:backdrop-blur-md p-6 text-center w-[17.5%] border-x border-b border-white/10">
                      <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Pro</p>
                      <div className="flex items-baseline justify-center gap-0.5 mb-4">
                        <span className="text-3xl font-black text-white">${annual ? 159 : 199}</span>
                        <span className="text-[10px] text-slate-500">/mes</span>
                      </div>
                      <button onClick={() => navigate('/register')} className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 text-[10px] font-bold py-2 rounded-xl transition-all">
                        Iniciar Prueba
                      </button>
                    </th>

                    {/* Enterprise Header */}
                    <th className="lg:sticky lg:top-[96px] z-30 lg:bg-[#07070d]/95 lg:backdrop-blur-md p-6 text-center w-[15%] border-b border-white/10">
                      <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Enterprise</p>
                      <div className="flex items-baseline justify-center gap-0.5 mb-4 h-9 items-center">
                        <span className="text-sm font-black text-indigo-300 uppercase tracking-wider">Personalizado</span>
                      </div>
                      <button onClick={() => navigate('/register')} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold py-2 rounded-xl transition-all">
                        Contactar
                      </button>
                    </th>
                  </tr>
                </thead>

                {/* Table Body Content */}
                <tbody>
                  
                  {/* CATEGORY 1: CAPACIDAD Y USO */}
                  <tr className="bg-white/[0.02] border-b border-white/5">
                    <td colSpan={5} className="p-5 pl-6 text-xs lg:text-sm font-black text-indigo-400 uppercase tracking-[0.2em]">
                      Capacidad y Uso
                    </td>
                  </tr>

                  <tr className="border-b border-white/5 hover:bg-white/[0.01] transition-colors">
                    <td className="p-6 pl-6 text-sm lg:text-base text-slate-200 font-bold">Asesores Incluidos</td>
                    <td className="p-6 text-center text-sm lg:text-base text-slate-300 border-r border-white/5">3 asesores</td>
                    <td className="p-6 text-center text-sm lg:text-base text-emerald-400 font-extrabold bg-indigo-500/[0.03] border-x border-indigo-500/20">8 asesores</td>
                    <td className="p-6 text-center text-sm lg:text-base text-slate-300 border-r border-white/5">15 asesores</td>
                    <td className="p-6 text-center text-sm lg:text-base text-indigo-300 font-extrabold">Ilimitados</td>
                  </tr>

                  <tr className="border-b border-white/5 hover:bg-white/[0.01] transition-colors">
                    <td className="p-6 pl-6 text-sm lg:text-base text-slate-200 font-bold">Contactos en CRM</td>
                    <td className="p-6 text-center text-sm lg:text-base text-slate-300 border-r border-white/5">Ilimitados</td>
                    <td className="p-6 text-center text-sm lg:text-base text-emerald-400 font-extrabold bg-indigo-500/[0.03] border-x border-indigo-500/20">Ilimitados</td>
                    <td className="p-6 text-center text-sm lg:text-base text-slate-300 border-r border-white/5">Ilimitados</td>
                    <td className="p-6 text-center text-sm lg:text-base text-indigo-300 font-extrabold">Personalizado</td>
                  </tr>

                  <tr className="border-b border-white/5 hover:bg-white/[0.01] transition-colors">
                    <td className="p-6 pl-6 text-sm lg:text-base text-slate-200 font-bold">Workspaces Multi-Empresa</td>
                    <td className="p-6 text-center text-sm lg:text-base text-slate-300 border-r border-white/5">1 workspace</td>
                    <td className="p-6 text-center text-sm lg:text-base text-slate-300 bg-indigo-500/[0.03] border-x border-indigo-500/20">3 workspaces</td>
                    <td className="p-6 text-center text-sm lg:text-base text-slate-300 border-r border-white/5">10 workspaces</td>
                    <td className="p-6 text-center text-sm lg:text-base text-indigo-300 font-extrabold">Ilimitados</td>
                  </tr>

                  {/* CATEGORY 2: CANALES INCLUIDOS */}
                  <tr className="bg-white/[0.02] border-b border-white/5">
                    <td colSpan={5} className="p-5 pl-6 text-xs lg:text-sm font-black text-indigo-400 uppercase tracking-[0.2em]">
                      Canales Oficiales
                    </td>
                  </tr>

                  <tr className="border-b border-white/5 hover:bg-white/[0.01] transition-colors">
                    <td className="p-6 pl-6 text-sm lg:text-base text-slate-200 font-bold flex items-center gap-2.5">
                      <BrandIcon name="WhatsApp" /> WhatsApp API Oficial
                    </td>
                    <td className="p-6 text-center border-r border-white/5"><Tick /></td>
                    <td className="p-6 text-center bg-indigo-500/[0.03] border-x border-indigo-500/20"><Tick /></td>
                    <td className="p-6 text-center border-r border-white/5"><Tick /></td>
                    <td className="p-6 text-center"><Tick /></td>
                  </tr>

                  <tr className="border-b border-white/5 hover:bg-white/[0.01] transition-colors">
                    <td className="p-6 pl-6 text-sm lg:text-base text-slate-200 font-bold flex items-center gap-2.5">
                      <BrandIcon name="Instagram" /> Instagram Direct
                    </td>
                    <td className="p-6 text-center border-r border-white/5"><Tick /></td>
                    <td className="p-6 text-center bg-indigo-500/[0.03] border-x border-indigo-500/20"><Tick /></td>
                    <td className="p-6 text-center border-r border-white/5"><Tick /></td>
                    <td className="p-6 text-center"><Tick /></td>
                  </tr>

                  <tr className="border-b border-white/5 hover:bg-white/[0.01] transition-colors">
                    <td className="p-6 pl-6 text-sm lg:text-base text-slate-200 font-bold flex items-center gap-2.5">
                      <BrandIcon name="Facebook" /> Facebook Messenger
                    </td>
                    <td className="p-6 text-center border-r border-white/5"><Tick /></td>
                    <td className="p-6 text-center bg-indigo-500/[0.03] border-x border-indigo-500/20"><Tick /></td>
                    <td className="p-6 text-center border-r border-white/5"><Tick /></td>
                    <td className="p-6 text-center"><Tick /></td>
                  </tr>

                  <tr className="border-b border-white/5 hover:bg-white/[0.01] transition-colors">
                    <td className="p-6 pl-6 text-sm lg:text-base text-slate-200 font-bold flex items-center gap-2.5">
                      <BrandIcon name="TikTok" /> TikTok Leads API
                    </td>
                    <td className="p-6 text-center border-r border-white/5"><Cross /></td>
                    <td className="p-6 text-center bg-indigo-500/[0.03] border-x border-indigo-500/20"><Tick /></td>
                    <td className="p-6 text-center border-r border-white/5"><Tick /></td>
                    <td className="p-6 text-center"><Tick /></td>
                  </tr>

                  <tr className="border-b border-white/5 hover:bg-white/[0.01] transition-colors">
                    <td className="p-6 pl-6 text-sm lg:text-base text-slate-200 font-bold flex items-center gap-2.5">
                      <BrandIcon name="Telegram" /> Telegram Bot
                    </td>
                    <td className="p-6 text-center border-r border-white/5"><Tick /></td>
                    <td className="p-6 text-center bg-indigo-500/[0.03] border-x border-indigo-500/20"><Tick /></td>
                    <td className="p-6 text-center border-r border-white/5"><Tick /></td>
                    <td className="p-6 text-center"><Tick /></td>
                  </tr>

                  {/* CATEGORY 3: AI & AUTOMATIZACION */}
                  <tr className="bg-white/[0.02] border-b border-white/5">
                    <td colSpan={5} className="p-5 pl-6 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                      AI & Automatización
                    </td>
                  </tr>

                  <tr className="border-b border-white/5 hover:bg-white/[0.01] transition-colors">
                    <td className="p-6 pl-6 text-sm lg:text-base text-slate-200 font-bold">AI Sales Agent Bot</td>
                    <td className="p-6 text-center text-sm lg:text-base text-slate-300 border-r border-white/5">1 bot activo</td>
                    <td className="p-6 text-center text-sm lg:text-base text-emerald-400 font-extrabold bg-indigo-500/[0.03] border-x border-indigo-500/20">Bots Ilimitados</td>
                    <td className="p-6 text-center text-sm lg:text-base text-slate-300 border-r border-white/5">Bots Ilimitados</td>
                    <td className="p-6 text-center text-sm lg:text-base text-indigo-300 font-bold">Bots Dedicados</td>
                  </tr>

                  <tr className="border-b border-white/5 hover:bg-white/[0.01] transition-colors">
                    <td className="p-6 pl-6 text-sm lg:text-base text-slate-200 font-bold">Cotizador PDF Profesional</td>
                    <td className="p-6 text-center text-sm lg:text-base text-slate-300 border-r border-white/5">Básico</td>
                    <td className="p-6 text-center text-sm lg:text-base text-emerald-400 font-extrabold bg-indigo-500/[0.03] border-x border-indigo-500/20">Avanzado + Logo</td>
                    <td className="p-6 text-center text-sm lg:text-base text-slate-300 border-r border-white/5">Avanzado + Multi-moneda</td>
                    <td className="p-6 text-center text-sm lg:text-base text-indigo-300 font-bold">API de Cotización</td>
                  </tr>

                  <tr className="border-b border-white/5 hover:bg-white/[0.01] transition-colors">
                    <td className="p-6 pl-6 text-sm lg:text-base text-slate-200 font-bold">Lead Hunter (Google Maps)</td>
                    <td className="p-6 text-center border-r border-white/5"><Cross /></td>
                    <td className="p-6 text-center text-sm lg:text-base text-slate-300 bg-indigo-500/[0.03] border-x border-indigo-500/20">✓ (500 leads/min)</td>
                    <td className="p-6 text-center text-sm lg:text-base text-slate-300 border-r border-white/5">✓ (Ilimitado)</td>
                    <td className="p-6 text-center text-sm lg:text-base text-indigo-300 font-bold">✓ (Ilimitado)</td>
                  </tr>

                  <tr className="border-b border-white/5 hover:bg-white/[0.01] transition-colors">
                    <td className="p-6 pl-6 text-sm lg:text-base text-slate-200 font-bold">Flyer Studio con IA</td>
                    <td className="p-6 text-center border-r border-white/5"><Cross /></td>
                    <td className="p-6 text-center bg-indigo-500/[0.03] border-x border-indigo-500/20"><Tick /></td>
                    <td className="p-6 text-center border-r border-white/5"><Tick /></td>
                    <td className="p-6 text-center"><Tick /></td>
                  </tr>

                  <tr className="border-b border-white/5 hover:bg-white/[0.01] transition-colors">
                    <td className="p-6 pl-6 text-sm lg:text-base text-slate-200 font-bold">Workflows Automatizados</td>
                    <td className="p-6 text-center border-r border-white/5"><Cross /></td>
                    <td className="p-6 text-center bg-indigo-500/[0.03] border-x border-indigo-500/20"><Cross /></td>
                    <td className="p-6 text-center border-r border-white/5"><Tick /></td>
                    <td className="p-6 text-center"><Tick /></td>
                  </tr>

                  {/* CATEGORY 4: SOPORTE Y GARANTIAS */}
                  <tr className="bg-white/[0.02] border-b border-white/5">
                    <td colSpan={5} className="p-5 pl-6 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                      Soporte y Garantías
                    </td>
                  </tr>

                  <tr className="border-b border-white/5 hover:bg-white/[0.01] transition-colors">
                    <td className="p-6 pl-6 text-sm lg:text-base text-slate-200 font-bold">Canal de Soporte</td>
                    <td className="p-6 text-center text-sm lg:text-base text-slate-300 border-r border-white/5">Email</td>
                    <td className="p-6 text-center text-sm lg:text-base text-emerald-400 font-extrabold bg-indigo-500/[0.03] border-x border-indigo-500/20">WhatsApp + Email</td>
                    <td className="p-6 text-center text-sm lg:text-base text-slate-300 border-r border-white/5">Soporte 24/7</td>
                    <td className="p-6 text-center text-sm lg:text-base text-indigo-300 font-bold">SLA Dedicado 24/7</td>
                  </tr>

                  <tr className="border-b border-white/5 hover:bg-white/[0.01] transition-colors">
                    <td className="p-6 pl-6 text-sm lg:text-base text-slate-200 font-bold">Onboarding</td>
                    <td className="p-6 text-center text-sm lg:text-base text-slate-300 border-r border-white/5">Documentación</td>
                    <td className="p-6 text-center text-sm lg:text-base text-slate-300 bg-indigo-500/[0.03] border-x border-indigo-500/20">Guiado</td>
                    <td className="p-6 text-center text-sm lg:text-base text-slate-300 border-r border-white/5">1-a-1 Dedicado</td>
                    <td className="p-6 text-center text-sm lg:text-base text-indigo-300 font-bold">1-a-1 Dedicado</td>
                  </tr>

                </tbody>
              </table>
            </div>

          </div>

          {/* ─── DIRECT COMPETITOR VALUE COMPARISON MATRIX (Arias CRM vs HubSpot vs respond.io) ─── */}
          <div className="mt-24 border-t border-white/10 pt-20">
            <div className="text-center mb-16">
              <span className="text-xs font-black text-emerald-400 uppercase tracking-[0.25em] mb-4 block">
                ¿Por qué pagar miles de dólares de más?
              </span>
              <h3 className="text-3xl lg:text-4xl font-black text-white leading-tight">
                Comparativa Real de Valor y Capacidades
              </h3>
              <p className="text-slate-400 mt-4 max-w-2xl mx-auto text-sm">
                Analiza de forma honesta el costo y las prestaciones de las tres alternativas líderes. Arias CRM te ofrece el stack de ventas completo de alta gama a una fracción de su costo ordinario.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 items-stretch">
              
              {/* Competitor 1: HubSpot CRM */}
              <div className="bg-[#0b0b18]/25 border border-white/5 rounded-3xl p-8 flex flex-col justify-between hover:border-white/10 transition-all group">
                <div>
                  <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
                    <span className="text-base font-black text-slate-500 uppercase tracking-widest">HubSpot CRM</span>
                    <span className="text-[9px] bg-red-500/10 text-red-400 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                      Muy Costoso
                    </span>
                  </div>
                  
                  <p className="text-xs text-slate-400 leading-relaxed mb-6">
                    El software tradicional corporativo. Excelente reputación, pero requiere pagar miles de dólares en módulos separados, cobra extra por cada asesor y te bloquea en contratos anuales.
                  </p>

                  <ul className="space-y-4 mb-8">
                    <li className="flex items-start gap-3 text-xs text-slate-400">
                      <Cross />
                      <span><strong>$890/mes</strong> (Plan Professional base para equipo chico)</span>
                    </li>
                    <li className="flex items-start gap-3 text-xs text-slate-400">
                      <Cross />
                      <span><strong>Cobro extra por contacto</strong> (marketing vs comercial)</span>
                    </li>
                    <li className="flex items-start gap-3 text-xs text-slate-400">
                      <Cross />
                      <span><strong>Sin cotizador PDF profesional</strong> integrado por defecto</span>
                    </li>
                    <li className="flex items-start gap-3 text-xs text-slate-400">
                      <Cross />
                      <span><strong>Sin extractor de Google Maps</strong> (requiere software externo)</span>
                    </li>
                    <li className="flex items-start gap-3 text-xs text-slate-400">
                      <Cross />
                      <span><strong>Contratos anuales forzosos</strong> y cargos de onboarding</span>
                    </li>
                  </ul>
                </div>

                <div className="border-t border-white/5 pt-6 text-center">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Costo Anual Estimado:</p>
                  <p className="text-3xl font-black text-slate-300 mt-1.5">$10,680+ USD</p>
                </div>
              </div>

              {/* The Champion: Arias CRM */}
              <div className="bg-[#0c0c24]/50 border-2 border-indigo-500 rounded-3xl p-8 flex flex-col justify-between relative shadow-[0_0_50px_rgba(99,102,241,0.15)] hover:scale-[1.03] transition-all group">
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[9px] font-black bg-indigo-600 text-white px-3 py-1 rounded-full uppercase tracking-widest shadow-md">
                  La Mejor Inversión
                </span>
                
                <div>
                  <div className="flex items-center justify-between border-b border-indigo-500/25 pb-4 mb-6">
                    <span className="text-base font-black text-indigo-400 uppercase tracking-widest">Arias CRM</span>
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">
                      Todo Incluido
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed mb-6 font-medium">
                    Ofrecemos la suite completa sin parches externos. Inbox unificado omnicanal, cotizador profesional interactivo, extractor de leads de Google Maps ilimitado y Flyer Studio con IA.
                  </p>

                  <ul className="space-y-4 mb-8">
                    <li className="flex items-start gap-3 text-xs text-slate-200">
                      <Tick />
                      <span><strong>$65/mes</strong> (Tarifa única plana sin cargos ocultos)</span>
                    </li>
                    <li className="flex items-start gap-3 text-xs text-slate-200">
                      <Tick />
                      <span><strong>Contactos e Ingestión Ilimitada</strong> gratis</span>
                    </li>
                    <li className="flex items-start gap-3 text-xs text-slate-200">
                      <Tick />
                      <span><strong>Lead Hunter de Google Maps</strong> gratis integrado</span>
                    </li>
                    <li className="flex items-start gap-3 text-xs text-slate-200">
                      <Tick />
                      <span><strong>Cotizador interactivo y PDF</strong> con tu propia marca</span>
                    </li>
                    <li className="flex items-start gap-3 text-xs text-slate-200">
                      <Tick />
                      <span><strong>Cancela cuando quieras</strong>, sin contratos obligatorios</span>
                    </li>
                  </ul>
                </div>

                <div className="border-t border-indigo-500/20 pt-6 text-center">
                  <p className="text-xs text-indigo-300 font-semibold uppercase tracking-wider">Costo Anual Fijo:</p>
                  <p className="text-4xl font-black text-emerald-400 mt-1.5">$780 USD</p>
                </div>
              </div>

              {/* Competitor 3: Respond.io */}
              <div className="bg-[#0b0b18]/25 border border-white/5 rounded-3xl p-8 flex flex-col justify-between hover:border-white/10 transition-all group">
                <div>
                  <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
                    <span className="text-base font-black text-slate-500 uppercase tracking-widest">Respond.io</span>
                    <span className="text-[9px] bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                      Inbox Limitado
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed mb-6">
                    Excelente bandeja omnicanal para chats, pero carece por completo de base de datos CRM avanzada, procesos de cierre de ventas, cotizaciones o captación B2B en frío.
                  </p>

                  <ul className="space-y-4 mb-8">
                    <li className="flex items-start gap-3 text-xs text-slate-400">
                      <Cross />
                      <span><strong>$99/mes</strong> (Plan básico con límite de solo 5 asesores)</span>
                    </li>
                    <li className="flex items-start gap-3 text-xs text-slate-400">
                      <Cross />
                      <span><strong>Límite estricto de contactos</strong> mensuales activos</span>
                    </li>
                    <li className="flex items-start gap-3 text-xs text-slate-400">
                      <Cross />
                      <span><strong>Sin cotizaciones ni facturación</strong> comercial integrada</span>
                    </li>
                    <li className="flex items-start gap-3 text-xs text-slate-400">
                      <Cross />
                      <span><strong>Sin generadores ni extractores</strong> de leads fríos</span>
                    </li>
                    <li className="flex items-start gap-3 text-xs text-slate-400">
                      <Cross />
                      <span><strong>Costos adicionales</strong> por volumen de mensajes activos</span>
                    </li>
                  </ul>
                </div>

                <div className="border-t border-white/5 pt-6 text-center">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Costo Anual Base:</p>
                  <p className="text-3xl font-black text-slate-300 mt-1.5">$1,188+ USD</p>
                </div>
              </div>

            </div>
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

      {/* ─── INTERACTIVE FAQ ACCORDION (LIGHT THEME MIX) ─── */}
      <section className="py-28 bg-[#f8fafc] border-y border-slate-200/60">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-black text-blue-600 uppercase tracking-[0.25em]">Preguntas Frecuentes</span>
            <h2 className="text-4xl font-black text-slate-900 mt-3">Todo lo que debes saber</h2>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq, idx) => (
              <div 
                key={idx} 
                className="border border-slate-200 bg-white rounded-2xl overflow-hidden shadow-sm transition-all"
              >
                <button
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="w-full p-6 text-left flex justify-between items-center focus:outline-none"
                >
                  <span className="text-sm font-bold text-slate-800">{faq.q}</span>
                  <span className="text-slate-500 font-bold ml-4">
                    {activeFaq === idx ? '−' : '+'}
                  </span>
                </button>
                {activeFaq === idx && (
                  <div className="px-6 pb-6 text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-4 animate-fadeIn">
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
      {/* ─── FUTURISTIC FEATURE DETAILS OVERLAY MODAL ────────────────────────── */}
      {activeProductDetail && (() => {
        const prod = PRODUCT_DETAILS[activeProductDetail];
        if (!prod) return null;
        return (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-6 bg-slate-950/80 backdrop-blur-xl animate-fadeIn">
            <div className="relative w-full max-w-4xl bg-[#080812] border border-blue-500/30 rounded-3xl shadow-[0_0_80px_-15px_rgba(59,130,246,0.3)] overflow-hidden grid md:grid-cols-12 max-h-[90vh] md:max-h-[85vh]">
              
              {/* Decorative radial tech mesh */}
              <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-blue-600/5 blur-[100px] pointer-events-none" />

              {/* Close Button */}
              <button 
                onClick={() => setActiveProductDetail(null)} 
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all z-20"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Left Side: Rich Detailed Product Copy */}
              <div className="md:col-span-7 p-8 md:p-10 overflow-y-auto space-y-6 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full uppercase tracking-wider inline-block mb-4">
                    {prod.tag}
                  </span>
                  
                  <h3 className="text-3xl font-black text-white leading-tight">
                    {prod.title}
                  </h3>
                  
                  <p className="text-sm text-slate-400 mt-4 leading-relaxed">
                    {prod.desc}
                  </p>

                  <div className="mt-6 space-y-3">
                    {prod.bullets.map((b, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="text-emerald-400 font-bold text-sm shrink-0">✓</span>
                        <span className="text-xs text-slate-300 leading-normal">{b}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5 space-y-4">
                  {/* Tech stack badge tags */}
                  <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Tecnología & Protocolo</p>
                    <div className="flex gap-2 flex-wrap">
                      {prod.techStack.map(ts => (
                        <span key={ts} className="text-[10px] bg-slate-900 border border-white/5 text-slate-400 px-2.5 py-1 rounded-lg">
                          {ts}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button 
                      onClick={() => { setActiveProductDetail(null); navigate('/register'); }}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-black px-6 py-3.5 rounded-xl text-xs transition-all shadow-lg shadow-blue-600/25 shrink-0"
                    >
                      Comenzar gratis con esta herramienta
                    </button>
                    <button 
                      onClick={() => setActiveProductDetail(null)}
                      className="border border-white/10 hover:bg-white/5 text-slate-300 font-bold px-6 py-3.5 rounded-xl text-xs transition-all"
                    >
                      Volver a la landing
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Side: Simulated Live Telemetry Sandbox Mockup */}
              <div className="md:col-span-5 bg-slate-950/80 border-t md:border-t-0 md:border-l border-white/10 p-8 flex flex-col justify-center items-center relative overflow-hidden min-h-[300px]">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent pointer-events-none" />
                
                {/* Product Live Metric Card */}
                <div className="absolute top-6 left-6 right-6 bg-slate-900/60 border border-white/5 p-4 rounded-2xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{prod.metricLabel}</p>
                    <p className="text-lg font-black text-emerald-400 tracking-tight">{prod.metric}</p>
                  </div>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-black animate-pulse">
                    LIVE TELEMETRY
                  </span>
                </div>

                <div className="w-full max-w-xs mt-12">
                  
                  {/* TIKTOK API MOCKUP */}
                  {prod.mockup === 'tiktok' && (
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 shadow-2xl space-y-3 font-mono text-[9px] text-slate-300 overflow-x-auto">
                      <p className="text-indigo-400 font-bold border-b border-white/5 pb-1">POST /api/webhooks/tiktok</p>
                      <p>{"{"}</p>
                      <p className="pl-3">"event": "LEAD_CAPTURE",</p>
                      <p className="pl-3">"signature_sha256": "8a02f9...",</p>
                      <p className="pl-3">"lead_data": {"{"}</p>
                      <p className="pl-6">"full_name": "Carlos Mendoza",</p>
                      <p className="pl-6">"whatsapp": "+50371204488",</p>
                      <p className="pl-6">"business": "Repuestos SV"</p>
                      <p className="pl-3">{"}"}</p>
                      <p>{"}"}</p>
                      <p className="text-emerald-400 font-bold border-t border-white/5 pt-1">HTTP 200 OK (Processed in 118ms)</p>
                    </div>
                  )}

                  {/* META MOCKUP */}
                  {prod.mockup === 'meta' && (
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 shadow-2xl space-y-3 text-xs">
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <span className="font-bold text-white">Meta Webhook Ingestion</span>
                        <span className="text-[9px] text-indigo-400">v19.0 API</span>
                      </div>
                      <div className="space-y-1.5 text-[11px] text-slate-300">
                        <p><strong>Campaign ID:</strong> camp_meta_lead_ads</p>
                        <p><strong>Source Channel:</strong> Instagram Feed</p>
                        <div className="bg-slate-950 p-2.5 rounded-lg border border-white/5 text-[10px] space-y-1">
                          <p><strong>WhatsApp:</strong> +503 7120 4488</p>
                          <p><strong>Status:</strong> Deduplicated & Queued</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* WHATSAPP WIDGET */}
                  {prod.mockup === 'whatsapp' && (
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 shadow-2xl space-y-3">
                      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-xs font-bold text-white">Arias Web widget</span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl border border-white/5 space-y-2 text-[10px]">
                        <p className="text-slate-400">¿Quieres agilizar tus ventas con WhatsApp?</p>
                        <input type="text" placeholder="Tu nombre..." value="Carlos" className="w-full bg-slate-900 border border-white/10 p-2 rounded text-[10px] text-white" readOnly />
                        <button className="w-full bg-emerald-600 text-white p-2 rounded text-[10px] font-bold">Chatear con AI Agent</button>
                      </div>
                    </div>
                  )}

                  {/* AI AGENT CHAT */}
                  {prod.mockup === 'ai_agent' && (
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 shadow-2xl space-y-3">
                      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                        <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
                        <span className="text-xs font-bold text-white">AI Agent Conversational</span>
                      </div>
                      <div className="text-[10px] space-y-2 flex flex-col max-h-[140px] overflow-y-auto">
                        <div className="bg-slate-800 text-white rounded-lg p-2 max-w-[85%] self-start leading-normal">
                          ¡Hola! Veo tu interés en Arias CRM. ¿Cuántos vendedores son?
                        </div>
                        <div className="bg-indigo-600 text-white rounded-lg p-2 max-w-[85%] self-end leading-normal">
                          Hola, somos 6 asesores.
                        </div>
                        <div className="bg-slate-800 text-white rounded-lg p-2 max-w-[85%] self-start leading-normal">
                          Excelente, agendo tu demo para mañana a las 3:00 PM.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* OMNICHANNEL INBOX */}
                  {prod.mockup === 'inbox' && (
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 shadow-2xl space-y-3">
                      <p className="text-xs font-bold text-white border-b border-white/5 pb-2">Cola Omnicanal</p>
                      <div className="space-y-2 text-[10px]">
                        <div className="flex justify-between items-center bg-slate-950 p-2 rounded border-l-2 border-emerald-500">
                          <span>WhatsApp - Repuestos SV</span>
                          <span className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded text-[8px]">Calificado</span>
                        </div>
                        <div className="flex justify-between items-center bg-slate-950 p-2 rounded border-l-2 border-blue-500">
                          <span>TikTok - Black Friday SV</span>
                          <span className="bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded text-[8px]">Pendiente</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* LEAD HUNTER */}
                  {prod.mockup === 'hunter' && (
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 shadow-2xl space-y-2 text-xs">
                      <p className="font-bold text-white">Lead Hunter Scraper</p>
                      <div className="bg-slate-950 p-2.5 rounded-lg border border-white/5 space-y-1.5 text-[9px] text-slate-300">
                        <p className="text-emerald-400 font-bold">✓ 342 empresas extraídas</p>
                        <div className="border-t border-white/5 pt-1 space-y-1">
                          <p>1. Taller Mecánico Premium - +503 2244 8899</p>
                          <p>2. Distribuidora Santa Tecla - info@santecla.com</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* COTIZADOR */}
                  {prod.mockup === 'cotizador' && (
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 shadow-2xl space-y-2.5 text-xs">
                      <p className="font-bold text-white">Interactive PDF Proposal</p>
                      <div className="bg-slate-950 p-2.5 rounded-lg border border-white/5 text-[9px] space-y-1 text-slate-300">
                        <div className="flex justify-between">
                          <span>Plan Growth Anual</span>
                          <span>$1,188.00</span>
                        </div>
                        <div className="flex justify-between border-t border-white/5 pt-1 font-bold text-white">
                          <span>Total</span>
                          <span>$1,188.00</span>
                        </div>
                      </div>
                      <button className="w-full bg-indigo-600 text-white text-[9px] py-1.5 rounded font-bold">Generar Enlace Seguro</button>
                    </div>
                  )}

                  {/* COBROS */}
                  {prod.mockup === 'cobros' && (
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 shadow-2xl space-y-3">
                      <p className="text-xs font-bold text-white border-b border-white/5 pb-2">Portal de Recaudo</p>
                      <div className="space-y-2 text-[10px] text-slate-300">
                        <p>Cotización #1092 - Aceptada</p>
                        <div className="flex gap-2">
                          <button className="flex-1 bg-blue-600 text-white p-2 rounded text-[8px] font-bold">Tarjeta de Crédito</button>
                          <button className="flex-1 bg-slate-950 border border-white/10 text-slate-300 p-2 rounded text-[8px] font-bold">Transferencia</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* FLYER */}
                  {prod.mockup === 'flyer' && (
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 shadow-2xl space-y-2 text-xs">
                      <p className="font-bold text-white">Flyer Canvas Preview</p>
                      <div className="aspect-square bg-slate-950 rounded-lg flex items-center justify-center border border-white/5 text-[9px] text-slate-500">
                        [ Creative AI Artwork Generator ]
                      </div>
                    </div>
                  )}

                </div>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
}

