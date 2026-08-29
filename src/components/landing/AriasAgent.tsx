import { useState, useRef, useEffect } from 'react';
import { X, Send, Calendar, MessageSquare, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Message {
  role: 'agent' | 'user';
  text: string;
}

const PET_QUOTES_ES = [
  "¿Cansado de Zapier lento? Déjamelo a mí, inyecto leads en 120ms. ⚡",
  "¡Meta Ads conectado! Mis sensores detectaron 5 nuevos leads listos. 🔥",
  "Arias CRM cuesta solo $65. ¡Ahorra hasta $800 con HubSpot! 💸",
  "Lead Hunter activo. ¿Quieres extraer prospectos de El Salvador? 🇸🇻",
  "¡Hola! Soy Ari, tu Sales Sentinel. ¿Listo para cerrar tratos hoy? 🤖",
  "Cotizador Pro listo para generar propuestas impecables en 1 minuto. 📄"
];

const PET_QUOTES_EN = [
  "Tired of slow Zapier? Leave it to me, I inject leads in 120ms. ⚡",
  "Meta Ads connected! My sensors detected 5 new leads ready. 🔥",
  "Arias CRM costs only $65. Save up to $800 compared to HubSpot! 💸",
  "Lead Hunter active. Want to extract prospects from El Salvador? 🇸🇻",
  "Hi! I am Ari, your Sales Sentinel. Ready to close deals today? 🤖",
  "Quote Generator Pro ready to generate flawless proposals in 1 minute. 📄"
];

// Multiple response variants per category — Ari never says the same thing twice
const RESPONSES_EN: Record<string, string[]> = {
  'hi': [
    "Bip Bop! 👋 Hi, I'm Ari — your AI Sales Sentinel. Ready to help you close more deals today?",
    "Hey there! 🤖 Ari here. I can show you how to automate your entire sales pipeline. What's your biggest challenge right now?",
    "Hello! ⚡ I'm Ari, built by the Arias CRM team. Want to see how we turn leads into clients on autopilot?",
  ],
  'price': [
    "Our commercial suite starts at just $49/mo with everything included: WhatsApp AI, PDF quotes, Lead Hunter, and full pipeline. Want to start your 14-day free trial?",
    "Unlike traditional enterprise CRMs that charge hundreds per extra seat, Arias CRM provides a complete sales suite at a fraction of the cost. 💸",
    "Arias CRM is all-inclusive: AI agents, WhatsApp API, Lead Hunter, mobile quotes, and invoicing. 14 days free, no credit card required.",
  ],
  'trial': [
    "Yes! Click 'Start Free Trial' above — your CRM environment is live in under 60 seconds. No credit card required.",
    "Absolutely! 14 days free, full access to every feature. Hit the button at the top and you're in. 🚀",
    "Of course! Just click 'Start Free Trial' — we'll have your workspace up and running immediately. No commitment needed.",
  ],
  'demo': [
    "I'd love to schedule a 15-min demo! Our team will walk you through Lead Hunter, AI agents, and our PDF quote builder live. Want to book now?",
    "Great idea! Let's do a personalized demo where I show you how we capture TikTok & Meta leads in real-time. When works for you?",
    "Demo time! 🎯 We can show you our WhatsApp automation, Kanban pipeline, and the ROI calculator. Just click 'Book demo' below.",
  ],
  'feature': [
    "Key features: 📥 Real-time TikTok & Meta lead capture, 🤖 24/7 WhatsApp AI Agent, 📄 PDF Quote Generator, 🗺️ Google Maps Lead Hunter, 📊 Kanban Pipeline. Which would you like to explore?",
    "We have 9 integrated modules: Lead management, AI chatbot, Marketing automation, PDF quotes, Lead Hunter, Flyer Studio, Omnichannel inbox, Analytics, and Payment portal. All in one platform.",
    "Our top differentiators vs. traditional CRMs: ✅ Built-in WhatsApp API, ✅ Google Maps prospector, ✅ Mobile PDF quote generator, ✅ No per-agent pricing trap. Which matters most to you?",
  ],
  'help': [
    "I'm here to help! Ask me about pricing, features, integrations, or how to get started. What do you need?",
    "Sure! I can assist with: setting up your first workspace, connecting WhatsApp, importing leads from TikTok, or generating your first quote. What's the priority?",
    "Happy to help! Whether it's a technical question or you just want to see a feature in action — I've got you covered. Fire away! 🎯",
  ],
  'default': [
    "Great question! I can help with lead capture, WhatsApp automation, PDF quotes, or B2B prospecting on Google Maps. Which area interests you most?",
    "Interesting! Arias CRM handles the full sales cycle: capture → qualify → quote → close. Want me to walk you through a specific step?",
    "Good one! Our platform connects TikTok Ads, Meta Leads, WhatsApp Business API, and Google Maps — all feeding into one smart pipeline. Want a demo?",
  ],
};

const RESPONSES_ES: Record<string, string[]> = {
  'hi': [
    "¡Bip Bop! 👋 Soy Ari, tu Sales Sentinel con IA. ¿Listo para automatizar tus ventas hoy?",
    "¡Hola! 🤖 Ari aquí. Puedo mostrarte cómo convertir leads en clientes en piloto automático. ¿Cuál es tu mayor reto ahora mismo?",
    "¡Qué tal! ⚡ Soy Ari, creado por el equipo de Arias CRM. ¿Quieres ver cómo duplicamos las tasas de cierre con IA?",
  ],
  'price': [
    "Nuestra suite comercial comienza desde $49/mes con todo incluido: WhatsApp IA, cotizaciones PDF, Lead Hunter y pipeline. ¿Quieres iniciar tus 14 días de prueba gratis?",
    "A diferencia de los CRMs tradicionales que cobran cientos de dólares por usuario extra, Arias CRM te da una suite completa a una fracción del costo. 💸",
    "Arias CRM es todo en uno: AI agents, WhatsApp API, Lead Hunter, cotizador móvil y add-on DTE. 14 días gratis sin tarjeta.",
  ],
  'trial': [
    "¡Claro! Haz clic en 'Empezar gratis' arriba — tu entorno CRM estará listo en menos de 60 segundos. Sin tarjeta de crédito.",
    "¡Por supuesto! 14 días gratis, acceso completo a todas las funciones. Solo presiona el botón arriba. 🚀",
    "¡Cómo no! Solo haz clic en 'Empezar gratis' — activamos tu workspace de inmediato. Sin compromiso.",
  ],
  'demo': [
    "¡Con mucho gusto! Agendemos 15 minutos donde te mostramos Lead Hunter, AI agents y el cotizador PDF en vivo. ¿Cuándo te queda bien?",
    "¡Excelente idea! Te hacemos una demo personalizada donde ves la captura en tiempo real de TikTok y Meta. ¿Qué horario prefieres?",
    "¡Vamos! 🎯 Podemos mostrarte la automatización de WhatsApp, el pipeline Kanban y el calculador de ROI. Solo haz clic en 'Agendar demo'.",
  ],
  'feature': [
    "Funciones clave: 📥 Captura en tiempo real de TikTok & Meta, 🤖 AI Agent 24/7 en WhatsApp, 📄 Cotizador con PDF, 🗺️ Lead Hunter con Extracción de Emails Web para Campañas, 📊 Pipeline Kanban. ¿Cuál quieres explorar?",
    "Tenemos 9 módulos integrados: Gestión de leads, Chatbot IA, Automatización de marketing y correos, Cotizaciones PDF, Lead Hunter con buscador de emails, Flyer Studio, Inbox omnicanal, Analítica y Facturación.",
    "Diferencias clave vs. otros CRMs: ✅ WhatsApp API incluido, ✅ Lead Hunter con escaneo automático de emails web para campañas masivas, ✅ Cotizador PDF móvil, ✅ Sin cobros por usuario extra. ¿Qué te importa más?",
  ],
  'help': [
    "¡Aquí estoy! Pregúntame sobre precios, funciones, integraciones o cómo empezar. ¿Qué necesitas?",
    "¡Claro! Puedo ayudarte con: configurar tu primer workspace, conectar WhatsApp, importar leads de TikTok o generar tu primera cotización.",
    "¡Con gusto! Tanto preguntas técnicas como ver una función en acción — te tengo cubierto. ¡Dispara! 🎯",
  ],
  'default': [
    "¡Buena pregunta! Puedo ayudarte con captura de leads, automatización de WhatsApp, cotizaciones PDF o prospección B2B en Google Maps. ¿Qué área te interesa?",
    "¡Interesante! Arias CRM maneja todo el ciclo de ventas: capturar → calificar → cotizar → cerrar. ¿Quieres que te explique un paso en específico?",
    "¡Buen punto! Nuestra plataforma conecta TikTok Ads, Meta Leads, WhatsApp Business API y Google Maps — todo en un pipeline inteligente. ¿Te muestro una demo?",
  ],
};

// Track last index per key to avoid consecutive repeats
const lastIndexMap: Record<string, number> = {};

function getResponse(input: string, lang: string): string {
  const responses = lang?.startsWith('es') ? RESPONSES_ES : RESPONSES_EN;
  const lower = input.toLowerCase();

  let key = 'default';
  if (/hola|hey|hi|hello|buenas|ari/i.test(lower)) key = 'hi';
  else if (/preci|price|cost|plan|paquete|cuanto/i.test(lower)) key = 'price';
  else if (/trial|prueba|gratis|free/i.test(lower)) key = 'trial';
  else if (/demo|mostrar|show/i.test(lower)) key = 'demo';
  else if (/feature|funcion|caracterist|incluye|ofrec/i.test(lower)) key = 'feature';
  else if (/ayud|help|support|soporte/i.test(lower)) key = 'help';

  const variants = responses[key];
  const last = lastIndexMap[key] ?? -1;
  // Pick a different index than last time
  let idx = Math.floor(Math.random() * variants.length);
  if (variants.length > 1 && idx === last) idx = (idx + 1) % variants.length;
  lastIndexMap[key] = idx;
  return variants[idx];
}

export default function AriasAgent() {
  const [isOpen, setIsOpen] = useState(false);
  const { i18n } = useTranslation();
  const isSpanish = i18n.language?.startsWith('es');
  const en = !isSpanish;
  const quotes = en ? PET_QUOTES_EN : PET_QUOTES_ES;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [showQuote, setShowQuote] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Cycle pet sales tips every 8 seconds
    const interval = setInterval(() => {
      setShowQuote(false);
      setTimeout(() => {
        setQuoteIndex(prev => (prev + 1) % quotes.length);
        setShowQuote(true);
      }, 500);
    }, 8500);
    return () => clearInterval(interval);
  }, [quotes]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{ role: 'agent', text: en ? "Bip Bop! 👋 Hi, I'm Ari, your tech sales pet! How can I help you grow today?" : "¡Bip Bop! 👋 ¡Hola, soy Ari! Tu Sales Sentinel y mascota virtual. ¿En qué puedo ayudarte a vender hoy?" }]);
    }
  }, [isOpen]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'agent', text: getResponse(userMsg, i18n.language) }]);
      setTyping(false);
    }, 800 + Math.random() * 700);
  };

  const handleQuickAction = (text: string) => {
    setMessages(prev => [...prev, { role: 'user', text }]);
    setTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'agent', text: getResponse(text, i18n.language) }]);
      setTyping(false);
    }, 600);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      
      {/* Dynamic blink keyframe inline styling */}
      <style>{`
        @keyframes pet-float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(3deg); }
        }
        @keyframes pet-blink {
          0%, 90%, 100% { transform: scaleY(1); }
          95% { transform: scaleY(0.1); }
        }
        @keyframes ring-spin {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.05); }
          100% { transform: rotate(360deg) scale(1); }
        }
        .animate-pet-float {
          animation: pet-float 3.5s ease-in-out infinite;
        }
        .animate-pet-blink {
          animation: pet-blink 4s infinite;
        }
        .animate-ring-spin {
          animation: ring-spin 6s linear infinite;
        }
      `}</style>

      {/* Chatbot Window */}
      {isOpen && (
        <div className="bg-[#0b0b12] border border-blue-500/30 rounded-3xl shadow-[0_0_50px_rgba(59,130,246,0.25)] w-[370px] mb-4 overflow-hidden flex flex-col backdrop-blur-2xl animate-fadeIn" style={{ maxHeight: '520px' }}>
          
          {/* Header with Pet Status */}
          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02] shrink-0">
            <div className="flex items-center gap-3">
              {/* Pet Head Miniature */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 border border-blue-400/40 flex items-center justify-center relative shadow-lg shadow-blue-500/20">
                <div className="absolute w-7 h-7 rounded-full border border-white/10 animate-ring-spin" />
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-cyan-300 rounded-full animate-pet-blink shadow-[0_0_8px_cyan]" />
                  <div className="w-1.5 h-1.5 bg-cyan-300 rounded-full animate-pet-blink shadow-[0_0_8px_cyan]" />
                </div>
              </div>
              <div>
                <span className="font-black text-white text-sm">Ari</span>
                <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full ml-2">
                  Sales Sentinel
                </span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[220px] bg-slate-950/20">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-none shadow-lg shadow-blue-600/10' 
                    : 'bg-white/5 border border-white/5 text-slate-200 rounded-bl-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/5 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}} />
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}} />
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-2 shrink-0">
              <button onClick={() => handleQuickAction(en ? 'Start a free trial' : 'Iniciar prueba gratis')} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-black transition-all shadow-md shadow-blue-600/20">
                <MessageSquare className="w-3 h-3" />{en ? 'Start trial' : 'Prueba gratis'}
              </button>
              <button onClick={() => handleQuickAction(en ? 'Book a demo' : 'Agendar demo')} className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all">
                <Calendar className="w-3 h-3" />{en ? 'Book demo' : 'Agendar demo'}
              </button>
              <button onClick={() => handleQuickAction(en ? 'What features do you offer?' : '¿Qué funcionalidades ofrecen?')} className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all">
                <Sparkles className="w-3 h-3 text-indigo-400" />{en ? 'Features' : 'Funciones'}
              </button>
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-white/5 shrink-0 bg-white/[0.01]">
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="relative">
              <input 
                type="text" value={input} onChange={e => setInput(e.target.value)}
                placeholder={en ? 'Ask Ari the Sentinel...' : 'Pregúntale algo a Ari...'}
                className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-white/10 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-950 text-white"
              />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white transition-colors">
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Ari the Digital Mascot Pet Closed State */}
      {!isOpen && (
        <div className="flex items-center gap-4 animate-pet-float">
          
          {/* Glowing speech bubble tip */}
          {showQuote && (
            <div className="bg-slate-900/90 backdrop-blur-md border border-blue-500/20 text-white px-4 py-2.5 rounded-2xl shadow-xl max-w-[240px] text-[10px] leading-relaxed relative animate-fadeIn">
              <p className="font-bold text-blue-400 mb-0.5">Ari, Sales Sentinel:</p>
              <p className="text-slate-200">{quotes[quoteIndex]}</p>
              
              {/* Pointer triangle */}
              <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[6px] border-l-slate-900" />
            </div>
          )}

          {/* Glassmorphic Animated Pet Spherical Body */}
          <button 
            onClick={() => setIsOpen(true)}
            className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center relative cursor-pointer group shadow-[0_0_35px_rgba(59,130,246,0.5)] border border-cyan-400/40 hover:scale-110 active:scale-95 transition-all duration-300"
          >
            {/* Spinning Outer Tech Halo Ring */}
            <div className="absolute inset-0 rounded-full border border-white/20 border-dashed animate-ring-spin pointer-events-none group-hover:scale-105 transition-all duration-300" />
            
            {/* Inner glass overlay */}
            <div className="absolute inset-[3px] rounded-full bg-slate-950/65 backdrop-blur-sm flex flex-col items-center justify-center shadow-inner">
              
              {/* Adorable Digital LED dot eyes that blink */}
              <div className="flex gap-1.5 mb-1 mt-1.5">
                <div className="w-2 h-2 bg-cyan-300 rounded-full animate-pet-blink shadow-[0_0_10px_cyan]" />
                <div className="w-2 h-2 bg-cyan-300 rounded-full animate-pet-blink shadow-[0_0_10px_cyan]" />
              </div>

              {/* Holographic antenna light */}
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
              
              <span className="text-[7px] font-black text-cyan-400 mt-1 uppercase tracking-wider scale-95 opacity-80 group-hover:opacity-100 transition-opacity">
                ARI AI
              </span>
            </div>
          </button>

        </div>
      )}
      
    </div>
  );
}
