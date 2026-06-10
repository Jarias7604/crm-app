import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Bot, User, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { toast } from 'react-hot-toast';

interface Message {
    id: string;
    role: 'ai' | 'user';
    content: string;
}

interface AIPerformanceChatProps {
    companyId: string;
    isOpen: boolean;
    onClose: () => void;
    performanceContext: any; // Passed from TeamPerformance
}

export function AIPerformanceChat({ companyId, isOpen, onClose, performanceContext }: AIPerformanceChatProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'init',
            role: 'ai',
            content: 'Hola, soy Sofía AI. Estoy analizando el rendimiento de tu equipo en tiempo real. ¿Qué te gustaría saber sobre los números de hoy?'
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSend = async () => {
        const text = input.trim();
        if (!text) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            // Trim context to prevent payload size issues
            const trimmedContext = {
                userPerformance: performanceContext?.userPerformance?.map((u: any) => ({
                    user_name: performanceContext?.profileNames?.[u.user_id] || 'Usuario Desconocido',
                    total_leads: u.total_leads,
                    leads_won: u.leads_won,
                    leads_lost: u.leads_lost,
                    win_rate: u.win_rate,
                    closed_amount: u.closed_amount
                })),
                callSummary: performanceContext?.callSummary?.map((c: any) => ({
                    user_name: performanceContext?.profileNames?.[c.user_id] || 'Usuario Desconocido',
                    calls_total: c.calls_total,
                    calls_connected: c.calls_connected,
                    calls_no_answer: c.calls_no_answer,
                    unique_leads_called: c.unique_leads_called
                }))
            };

            const { data, error } = await supabase.functions.invoke('dashboard-ai-agent', {
                body: { 
                    prompt: text, 
                    companyId,
                    performanceContext: trimmedContext
                }
            });

            if (error) throw new Error(error.message);
            if (data?.error) throw new Error(data.error);

            const aiMsg: Message = { 
                id: (Date.now() + 1).toString(), 
                role: 'ai', 
                content: data.message || 'No pude generar una respuesta. Intenta de nuevo.'
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch (err: any) {
            console.error('AI Chat Error:', err);
            toast.error(err.message || 'Error contactando a Sofía.');
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'ai',
                content: '❌ Lo siento, ocurrió un error al analizar los datos. Por favor, intenta de nuevo.'
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed bottom-6 right-6 w-[400px] h-[600px] bg-white rounded-2xl shadow-[0_8px_40px_rgb(0,0,0,0.12)] border border-gray-100 flex flex-col overflow-hidden z-[9999] animate-in slide-in-from-bottom-8 fade-in duration-300">
            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                        <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white">Sofía AI Analyst</h3>
                        <p className="text-[10px] text-purple-100 font-medium">Analizando datos en vivo</p>
                    </div>
                </div>
                <button 
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-5 bg-gray-50/50 space-y-4">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            msg.role === 'user' ? 'bg-indigo-100' : 'bg-purple-100'
                        }`}>
                            {msg.role === 'user' ? (
                                <User className="w-4 h-4 text-indigo-600" />
                            ) : (
                                <Bot className="w-4 h-4 text-purple-600" />
                            )}
                        </div>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed shadow-sm ${
                            msg.role === 'user' 
                                ? 'bg-indigo-600 text-white rounded-tr-sm' 
                                : 'bg-white border border-gray-100 text-gray-700 rounded-tl-sm'
                        }`}>
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                            <Bot className="w-4 h-4 text-purple-600" />
                        </div>
                        <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-2">
                            <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                            <span className="text-[13px] text-gray-500 font-medium">Sofía está analizando...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-100 shrink-0">
                <div className="relative flex items-center">
                    <input 
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Pregunta por qué Diana tiene 0 llamadas..."
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                        disabled={isLoading}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 w-8 h-8 flex items-center justify-center bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:hover:bg-purple-600 text-white rounded-lg transition-colors"
                    >
                        <Send className="w-4 h-4 ml-0.5" />
                    </button>
                </div>
                <div className="mt-2 text-center">
                    <span className="text-[10px] font-medium text-gray-400">
                        La IA tiene acceso a los KPIs y métricas mostradas en pantalla
                    </span>
                </div>
            </div>
        </div>
    );
}
