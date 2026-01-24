import { useState, useEffect, useRef } from 'react';
import {
    Search,
    Send,
    MoreVertical,
    Video,
    Image as ImageIcon,
    Paperclip,
    Smile,
    User,
    Mail,
    Phone as PhoneIcon,
    CheckCheck,
    Clock,
    MessageSquare,
    Send as TelegramIcon,
    Smartphone,
    Bot
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { chatService, type ChatConversation, type ChatMessage } from '../../services/marketing/chatService';
import toast from 'react-hot-toast';

export default function ChatHub() {
    const [conversations, setConversations] = useState<ChatConversation[]>([]);
    const [selectedConv, setSelectedConv] = useState<ChatConversation | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [filter, setFilter] = useState<'all' | 'whatsapp' | 'telegram' | 'web'>('all');
    const [loading, setLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const location = useLocation();

    // 1. Initial Load of Conversations
    useEffect(() => {
        loadConversations();

        // Subscribe to conversation updates (new chats, unread counts)
        const sub = chatService.subscribeToConversations(() => {
            loadConversations();
        });

        return () => {
            sub.unsubscribe();
        };
    }, []);

    const loadConversations = async () => {
        try {
            const data = await chatService.getConversations();
            setConversations(data);

            // Handle deep linking after loading
            if (location.state?.lead && !selectedConv) {
                const leadId = location.state.lead.id;
                const existing = data.find(c => c.lead?.id === leadId);
                if (existing) {
                    setSelectedConv(existing);
                } else {
                    // Create a placeholder for new conversation
                    const placeholder: ChatConversation = {
                        id: 'new',
                        channel: location.state.channel || 'telegram',
                        status: 'open',
                        last_message: 'Iniciando conversación...',
                        last_message_at: new Date().toISOString(),
                        unread_count: 0,
                        lead: {
                            id: leadId,
                            name: location.state.lead.name,
                            email: location.state.lead.email,
                            company_name: location.state.lead.company_name
                        }
                    };
                    setSelectedConv(placeholder);
                }
            }
        } catch (error) {
            console.error('Error loading conversations:', error);
        } finally {
            setLoading(false);
        }
    };

    // 2. Load Messages when selection changes
    useEffect(() => {
        if (selectedConv && selectedConv.id !== 'new') {
            loadMessages(selectedConv.id);
            chatService.markAsRead(selectedConv.id);

            // Subscribe to new messages for this chat
            const sub = chatService.subscribeToMessages(selectedConv.id, (msg) => {
                setMessages(prev => {
                    if (prev.find(m => m.id === msg.id)) return prev;
                    return [...prev, msg];
                });
            });

            return () => {
                sub.unsubscribe();
            };
        } else {
            setMessages([]);
        }
    }, [selectedConv?.id]);

    const loadMessages = async (id: string) => {
        try {
            const data = await chatService.getMessages(id);
            setMessages(data);
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedConv) return;

        const content = newMessage;
        setNewMessage('');

        try {
            if (selectedConv.id === 'new') {
                toast.error('La integración real requiere configurar el Webhook para este canal.');
                return;
            }

            await chatService.sendMessage(selectedConv.id, content);
            // The message will be added to state via subscription
        } catch (error: any) {
            toast.error('Error al enviar: ' + error.message);
        }
    };

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (loading) return <div className="flex h-full items-center justify-center font-bold text-slate-400">Cargando central de mensajes...</div>;

    return (
        <div className="flex h-[calc(100vh-100px)] bg-white rounded-3xl border border-gray-100 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
            {/* 1. Sidebar: Lista de Chats */}
            <div className="w-[360px] border-r border-gray-100 flex flex-col bg-[#fcfdfe]">
                <div className="p-6 space-y-5">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Mensajes</h2>
                        <button className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400">
                            <MoreVertical className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar chats..."
                            className="w-full pl-11 pr-4 py-2.5 bg-slate-100/50 border-none rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 text-sm font-medium transition-all outline-none placeholder:text-slate-400"
                        />
                    </div>

                    <div className="flex gap-2">
                        {['all', 'whatsapp', 'telegram'].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f as any)}
                                className={`px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ${filter === f
                                    ? 'bg-slate-800 text-white shadow-lg'
                                    : 'bg-white text-slate-400 border border-slate-100 hover:border-slate-300'}`}
                            >
                                {f === 'all' ? 'Todos' : f}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-1">
                    {conversations.filter(c => filter === 'all' || c.channel === filter).map(conv => (
                        <button
                            key={conv.id}
                            onClick={() => setSelectedConv(conv)}
                            className={`w-full p-4 flex gap-4 text-left rounded-2xl transition-all group relative ${selectedConv?.id === conv.id
                                ? 'bg-blue-50/50 ring-1 ring-blue-100'
                                : 'hover:bg-slate-50'
                                }`}
                        >
                            <div className="relative shrink-0">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold shadow-sm ${conv.channel === 'telegram' ? 'bg-sky-500' : conv.channel === 'whatsapp' ? 'bg-emerald-500' : 'bg-slate-800'
                                    }`}>
                                    {conv.lead?.name?.[0] || '?'}
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-lg flex items-center justify-center border-2 border-white shadow-sm overflow-hidden">
                                    {conv.channel === 'telegram' ? <TelegramIcon className="w-2.5 h-2.5 text-sky-500" /> : <Smartphone className="w-2.5 h-2.5 text-emerald-500" />}
                                </div>
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-0.5">
                                    <h3 className={`text-sm font-bold truncate ${selectedConv?.id === conv.id ? 'text-blue-600' : 'text-slate-700'}`}>
                                        {conv.lead?.name || 'Cliente Desconocido'}
                                    </h3>
                                    <span className="text-[10px] font-medium text-slate-400">{formatTime(conv.last_message_at)}</span>
                                </div>
                                <p className="text-xs text-slate-400 font-medium truncate leading-tight">{conv.last_message}</p>
                            </div>

                            {conv.unread_count > 0 && (
                                <div className="absolute top-1/2 -translate-y-1/2 right-4 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[9px] font-black shadow-md border-2 border-white">
                                    {conv.unread_count}
                                </div>
                            )}
                        </button>
                    ))}

                    {conversations.length === 0 && (
                        <div className="p-8 text-center text-slate-300 text-xs font-bold uppercase tracking-widest">
                            No hay conversaciones todavía
                        </div>
                    )}
                </div>
            </div>

            {/* 2. Chat Principal */}
            {selectedConv ? (
                <div className="flex-1 flex flex-col bg-white">
                    <div className="px-8 py-5 border-b border-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 font-black border border-slate-200 shadow-sm">
                                    {selectedConv.lead?.name?.[0] || '?'}
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-800 tracking-tight">{selectedConv.lead?.name || 'Cargando...'}</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedConv.channel} • Conectado</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1">
                            <button className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all">
                                <Search className="w-4.5 h-4.5" />
                            </button>
                            <button className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all">
                                <Video className="w-4.5 h-4.5" />
                            </button>
                            <button className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all">
                                <MoreVertical className="w-4.5 h-4.5" />
                            </button>
                        </div>
                    </div>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto px-10 py-8 space-y-6 bg-slate-50/10">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[75%] space-y-1 ${msg.direction === 'outbound' ? 'items-end' : 'items-start'} flex flex-col`}>
                                    <div className={`px-5 py-3.5 rounded-3xl text-sm font-semibold leading-relaxed shadow-sm transition-all hover:shadow-md ${msg.direction === 'outbound'
                                        ? 'bg-slate-900 text-white rounded-tr-none'
                                        : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'
                                        }`}>
                                        {msg.content}
                                    </div>
                                    <div className="flex items-center gap-1.5 px-2">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase">{formatTime(msg.sent_at)}</span>
                                        {msg.direction === 'outbound' && (
                                            <CheckCheck className={`w-3 h-3 ${msg.status === 'read' ? 'text-blue-500' : 'text-slate-300'}`} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {messages.length === 0 && selectedConv.id !== 'new' && (
                            <div className="flex h-full items-center justify-center text-slate-300 font-bold uppercase text-[10px] tracking-[0.3em]">
                                Cargando historial...
                            </div>
                        )}
                        {selectedConv.id === 'new' && (
                            <div className="flex flex-col items-center justify-center h-full space-y-4 text-center">
                                <Bot className="w-12 h-12 text-blue-200" />
                                <p className="text-slate-400 text-xs font-bold max-w-xs leading-relaxed">
                                    Esta es una conversación nueva. Envía el primer mensaje para activarla.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="p-8">
                        <form onSubmit={handleSendMessage} className="bg-slate-100/60 rounded-[32px] p-2 flex items-center gap-2 group focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/5 focus-within:shadow-xl transition-all border border-transparent focus-within:border-slate-200">
                            <button type="button" className="p-4 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all">
                                <Smile className="w-5 h-5" />
                            </button>
                            <input
                                type="text"
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                                placeholder="Escribe un mensaje..."
                                className="flex-1 bg-transparent py-3 px-2 outline-none text-sm font-bold text-slate-700 placeholder:text-slate-400"
                            />
                            <button type="button" className="p-4 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all mr-1">
                                <Paperclip className="w-5 h-5" />
                            </button>
                            <button
                                type="submit"
                                disabled={!newMessage.trim()}
                                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-white p-4 rounded-full shadow-lg shadow-blue-500/30 transition-all hover:scale-105 active:scale-95"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </form>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center bg-[#fcfdfe] p-12 text-center">
                    <div className="w-20 h-20 bg-blue-50 rounded-[2rem] flex items-center justify-center mb-8 animate-pulse">
                        <MessageSquare className="w-8 h-8 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">Central de Comunicación</h2>
                    <p className="text-sm text-slate-400 max-w-sm leading-relaxed font-bold uppercase tracking-widest text-[11px]">
                        Selecciona un chat para continuar la prospección
                    </p>
                </div>
            )}

            {/* 3. Panel de Detalles (Derecho) */}
            {selectedConv && (
                <div className="w-[320px] bg-white border-l border-slate-50 flex flex-col animate-in slide-in-from-right duration-700 shadow-[-20px_0_40px_rgba(0,0,0,0.01)]">
                    <div className="p-8 text-center space-y-6">
                        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-4xl mx-auto shadow-2xl shadow-blue-600/20 rotate-3 hover:rotate-0 transition-transform cursor-pointer">
                            {selectedConv.lead?.name?.[0] || '?'}
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">{selectedConv.lead?.name || 'Visitante'}</h3>
                            <p className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full w-fit mx-auto mt-2 uppercase tracking-tighter">
                                {selectedConv.lead?.company_name || 'Sin empresa'}
                            </p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-8">
                        <div className="space-y-5">
                            <DetailRow icon={Mail} label="Email" value={selectedConv.lead?.email || 'No disponible'} />
                            <DetailRow icon={PhoneIcon} label="Identificador" value={selectedConv.id === 'new' ? 'Pendiente' : 'Activo'} />
                            <DetailRow icon={Clock} label="Zona" value="GMT -6 (SV)" />
                        </div>

                        <div className="space-y-3 pt-6 border-t border-slate-50">
                            <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">CRM Sales Hub</h4>
                            <button className="w-full flex items-center justify-center gap-3 py-3.5 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10">
                                <User className="w-4 h-4" /> Perfil Lead
                            </button>
                            <button className="w-full flex items-center justify-center gap-3 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">
                                <ImageIcon className="w-4 h-4" /> Cotizar
                            </button>
                        </div>

                        <div className="p-5 bg-indigo-50/50 rounded-3xl border border-indigo-100 flex gap-4">
                            <Bot className="w-5 h-5 text-indigo-500 shrink-0" />
                            <p className="text-[11px] text-indigo-900/80 font-bold leading-relaxed italic">
                                "El sistema monitoriza este canal en tiempo real buscando señales de compra."
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function DetailRow({ icon: Icon, label, value }: any) {
    return (
        <div className="flex items-start gap-4 group">
            <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 transition-colors group-hover:bg-blue-50 group-hover:text-blue-500">
                <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{label}</p>
                <p className="text-xs font-bold text-slate-700 truncate">{value}</p>
            </div>
        </div>
    );
}
