import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, Sparkles } from 'lucide-react';
import { sendMessage } from '../../lib/api';

export default function HelpChat() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{role: 'user' | 'bot', content: string, imageUrl?: string}[]>([
    { role: 'bot', content: '¡Hola! Soy tu asistente de Arias CRM. ¿En qué puedo ayudarte hoy?' }
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!query.trim() || loading) return;

    const userMsg = query;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setQuery('');
    setLoading(true);

    try {
      const res = await sendMessage(userMsg);
      setMessages(prev => [...prev, { 
        role: 'bot', 
        content: res.text, 
        imageUrl: res.imageUrl 
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'bot', content: 'Lo siento, tuve un problema al procesar tu solicitud.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
      {/* Chat Window */}
      {open && (
        <div className="mb-4 w-[380px] h-[520px] glass rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in border border-white/40">
          {/* Header */}
          <div className="p-4 bg-indigo-600 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-tight">Asistente Arias</h3>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse mr-1.5" />
                  <span className="text-[10px] opacity-80 uppercase tracking-widest font-bold">En línea</span>
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm transition-all ${
                  m.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                    : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                }`}>
                  <p className="leading-relaxed">{m.content}</p>
                  {m.imageUrl && (
                    <img src={m.imageUrl} alt="Guide" className="mt-2 rounded-lg border border-slate-100 shadow-sm transition-transform hover:scale-[1.02]" />
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-none p-3 shadow-sm">
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-slate-100">
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Pregúntame algo..."
                className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              <button
                onClick={handleSend}
                disabled={!query.trim() || loading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:bg-slate-300 transition-all shadow-md"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-2 text-[10px] text-center text-slate-400 flex items-center justify-center">
              <Sparkles className="w-3 h-3 mr-1 text-indigo-400" />
              Potenciado por Arias IA
            </p>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setOpen(!open)}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 group ${
          open ? 'bg-white text-slate-900 border border-slate-200 rotate-90' : 'bg-indigo-600 text-white'
        }`}
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-7 h-7 group-hover:animate-wiggle" />}
      </button>
    </div>
  );
}
