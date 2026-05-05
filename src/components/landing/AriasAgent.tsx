import { useState, useRef, useEffect } from 'react';
import { X, Send, Calendar, MessageSquare, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Message {
  role: 'agent' | 'user';
  text: string;
}

const RESPONSES_EN: Record<string, string> = {
  'default': "Great question! I'd love to help you learn more about Arias CRM. You can start a free 15-day trial, or I can connect you with our sales team for a personalized demo. What would you prefer?",
  'price': "We offer 3 plans: Starter, Pro, and Enterprise. You can see all pricing details in our pricing section below. Want me to scroll you there?",
  'trial': "Absolutely! You can start a free 15-day trial right now — no credit card required. Just click 'Start for free' in the top menu to get started!",
  'demo': "I'd be happy to set up a demo for you! Our team can walk you through the full platform. Click 'Book a meeting' to schedule a time that works for you.",
  'feature': "Arias CRM includes Sales Pipeline, Marketing Automation, Service Desk, AI Agents, Lead Hunter, Quote Builder, Revenue Intelligence, and much more. What area interests you most?",
  'help': "Of course! I can help you with: pricing info, starting a free trial, booking a demo, or learning about our features. Just ask!",
  'hi': "Hey there! 👋 Welcome to Arias CRM. I'm Arias, your AI sales agent. How can I help you today?",
};

const RESPONSES_ES: Record<string, string> = {
  'default': "¡Excelente pregunta! Me encantaría ayudarte a conocer más sobre Arias CRM. Puedes iniciar una prueba gratuita de 15 días, o puedo conectarte con nuestro equipo de ventas para una demo personalizada. ¿Qué prefieres?",
  'price': "Ofrecemos 3 planes: Starter, Pro y Enterprise. Puedes ver todos los precios en la sección de precios más abajo. ¿Te llevo allí?",
  'trial': "¡Por supuesto! Puedes iniciar una prueba gratuita de 15 días ahora mismo — sin tarjeta de crédito. Solo haz clic en 'Comenzar gratis' en el menú superior.",
  'demo': "¡Con gusto agendo una demo para ti! Nuestro equipo te puede mostrar toda la plataforma. Haz clic en 'Agendar reunión' para elegir un horario.",
  'feature': "Arias CRM incluye Pipeline de Ventas, Automatización de Marketing, Mesa de Servicio, Agentes IA, Lead Hunter, Cotizador, Inteligencia de Ingresos y mucho más. ¿Qué área te interesa más?",
  'help': "¡Claro! Puedo ayudarte con: información de precios, iniciar prueba gratuita, agendar una demo, o conocer nuestras funcionalidades. ¡Solo pregunta!",
  'hi': "¡Hola! 👋 Bienvenido a Arias CRM. Soy Arias, tu agente de ventas con IA. ¿En qué puedo ayudarte hoy?",
};

function getResponse(input: string, lang: string): string {
  const responses = lang === 'es' ? RESPONSES_ES : RESPONSES_EN;
  const lower = input.toLowerCase();
  if (/hola|hey|hi|hello|buenas/i.test(lower)) return responses.hi;
  if (/preci|price|cost|plan|paquete|cuanto/i.test(lower)) return responses.price;
  if (/trial|prueba|gratis|free/i.test(lower)) return responses.trial;
  if (/demo|mostrar|show/i.test(lower)) return responses.demo;
  if (/feature|funcion|caracterist|incluye|ofrec/i.test(lower)) return responses.feature;
  if (/ayud|help|support|soporte/i.test(lower)) return responses.help;
  return responses.default;
}

export default function AriasAgent() {
  const [isOpen, setIsOpen] = useState(false);
  const { i18n } = useTranslation();
  const en = i18n.language !== 'es';
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{ role: 'agent', text: en ? "Hi! 👋 I'm Arias, your AI sales agent. How can I help you today?" : "¡Hola! 👋 Soy Arias, tu agente de ventas con IA. ¿En qué puedo ayudarte hoy?" }]);
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
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-[370px] mb-4 overflow-hidden flex flex-col" style={{ maxHeight: '520px' }}>
          {/* Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0">
                <img src="/arias_agent_avatar.png" alt="Arias" className="w-full h-full object-cover object-top" />
              </div>
              <div>
                <span className="font-semibold text-slate-800 text-sm">Arias</span>
                <span className="text-xs font-medium px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full ml-2">AI Agent</span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-slate-200 rounded-md text-slate-500 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-md' : 'bg-slate-100 text-slate-700 rounded-bl-md'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1">
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}} />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}} />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-2 shrink-0">
              <button onClick={() => handleQuickAction(en ? 'Start a free trial' : 'Iniciar prueba gratis')} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                <MessageSquare className="w-3.5 h-3.5" />{en ? 'Start trial' : 'Prueba gratis'}
              </button>
              <button onClick={() => handleQuickAction(en ? 'Book a demo' : 'Agendar demo')} className="flex items-center gap-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                <Calendar className="w-3.5 h-3.5" />{en ? 'Book demo' : 'Agendar demo'}
              </button>
              <button onClick={() => handleQuickAction(en ? 'What features do you offer?' : '¿Qué funcionalidades ofrecen?')} className="flex items-center gap-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                <Sparkles className="w-3.5 h-3.5" />{en ? 'Features' : 'Funciones'}
              </button>
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-slate-100 shrink-0">
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="relative">
              <input 
                type="text" value={input} onChange={e => setInput(e.target.value)}
                placeholder={en ? 'Ask Arias a question...' : 'Pregúntale algo a Arias...'}
                className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50"
              />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-600 transition-colors">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Button */}
      {!isOpen && (
        <button onClick={() => setIsOpen(true)} className="relative group flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-full shadow-lg hover:shadow-xl hover:bg-blue-700 transition-all duration-300 font-semibold text-sm">
          <Sparkles className="w-5 h-5 text-blue-200" />
          <span>Ask Arias</span>
        </button>
      )}
    </div>
  );
}
