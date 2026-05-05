import { useState } from 'react';
import { X, Mic, Send, Calendar, MessageSquare, Sparkles } from 'lucide-react';

export default function AriasAgent() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      
      {/* Chat Window */}
      {isOpen && (
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-[350px] mb-4 overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800">Arias</span>
              <span className="text-xs font-medium px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">AI SDR Agent</span>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-slate-200 rounded-md text-slate-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="p-4 bg-white relative">
            <div className="rounded-xl overflow-hidden mb-4 relative aspect-video bg-slate-100 border border-slate-200">
              <img 
                src="/arias_agent_avatar.png" 
                alt="Arias AI Agent" 
                className="w-full h-full object-cover object-top"
              />
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                <button className="flex items-center gap-1.5 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-semibold text-slate-800 shadow-sm border border-white/50 hover:bg-white transition-colors">
                  <Mic className="w-3.5 h-3.5 text-blue-600" />
                  Speak with Arias
                </button>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Arias CRM's agentic AI automates tasks and personalizes interactions to drive growth. Curious how this fits your business?
            </p>

            <div className="space-y-2 mb-4">
              <p className="text-xs font-medium text-slate-400">Ask me things like:</p>
              <button className="text-sm text-blue-600 hover:underline text-left w-full">Try Arias CRM for free</button>
              <button className="text-sm text-blue-600 hover:underline text-left w-full">How can Arias help my business?</button>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <button className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                <MessageSquare className="w-3.5 h-3.5" />
                Connect with sales
              </button>
              <button className="flex items-center gap-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                <Calendar className="w-3.5 h-3.5" />
                Book a meeting
              </button>
            </div>

            <div className="relative">
              <input 
                type="text" 
                placeholder="Ask Arias a question" 
                className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50"
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-600 transition-colors">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
            <p className="text-[10px] text-slate-400">
              Please note, by continuing, you agree to the terms of our privacy policy. This conversation will be recorded.
            </p>
          </div>
        </div>
      )}

      {/* Floating Avatar Button */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="relative group flex items-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-full shadow-lg hover:shadow-xl hover:bg-indigo-700 transition-all duration-300 animate-in slide-in-from-bottom-5 font-semibold text-sm"
        >
          <Sparkles className="w-5 h-5 text-indigo-200" />
          <span>Ask Arias</span>
        </button>
      )}
    </div>
  );
}
