import { useState, useEffect, useRef } from 'react';
import {
    Search,
    Send,
    MoreVertical,
    Phone,
    Video,
    Image as ImageIcon,
    Paperclip,
    Smile,
    User,
    Mail,
    Phone as PhoneIcon,
    Building2,
    CheckCheck,
    Clock,
    MessageSquare,
    MessageCircle,
    Send as TelegramIcon,
    Smartphone,
    Bot
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Message {
    id: string;
    content: string;
    direction: 'inbound' | 'outbound';
    sent_at: string;
    status?: 'sent' | 'delivered' | 'read';
}

interface Conversation {
    id: string;
    channel: 'whatsapp' | 'telegram' | 'web';
    status: string;
    last_message: string;
    last_message_at: string;
    unread_count: number;
    lead: {
        name: string;
        email: string;
        company: string;
        avatar?: string;
    };
}

export default function ChatHub() {
    const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [filter, setFilter] = useState<'all' | 'whatsapp' | 'telegram' | 'web'>('all');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Mock Conversations - Ideally fetch from Supabase
    const conversations: Conversation[] = [
        {
            id: '1',
            channel: 'telegram',
            status: 'open',
            last_message: 'Hola, me gustaría saber los precios del paquete Pro',
            last_message_at: new Date().toISOString(),
            unread_count: 2,
            lead: {
                name: 'Nestor Rodriguez',
                email: 'nestor@email.com',
                company: 'Estudios Eléctricos',
            }
        },
        {
            id: '2',
            channel: 'whatsapp',
            status: 'open',
            last_message: 'Confirmado el pago de la suscripción mensual',
            last_message_at: new Date(Date.now() - 3600000).toISOString(),
            unread_count: 0,
            lead: {
                name: 'Anelda Garcia',
                email: 'anelda@garcia.com',
                company: 'Independientes S.A',
            }
        },
        {
            id: '3',
            channel: 'web',
            status: 'open',
            last_message: '¿Tienen soporte técnico los domingos?',
            last_message_at: new Date(Date.now() - 86400000).toISOString(),
            unread_count: 0,
            lead: {
                name: 'Miguel Carlo',
                email: 'miguel@carlo.com',
                company: 'Arroz Fuentes',
            }
        }
    ];

    useEffect(() => {
        if (selectedConv) {
            // Mock messages loading
            setMessages([
                { id: '1', content: '¡Hola! ¿En qué puedo ayudarte hoy?', direction: 'outbound', sent_at: new Date(Date.now() - 7200000).toISOString(), status: 'read' },
                { id: '2', content: selectedConv.last_message, direction: 'inbound', sent_at: selectedConv.last_message_at }
            ]);
        }
    }, [selectedConv]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedConv) return;

        const msg: Message = {
            id: Date.now().toString(),
            content: newMessage,
            direction: 'outbound',
            sent_at: new Date().toISOString(),
            status: 'sent'
        };

        setMessages([...messages, msg]);
        setNewMessage('');

        // Simular respuesta después de 2 segundos
        setTimeout(() => {
            toast.success('Respuesta del bot simulada');
        }, 1000);
    };

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const isToday = (isoString: string) => {
        const date = new Date(isoString);
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    return (
        <div className="flex h-[calc(100vh-120px)] bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Conversations Sidebar */}
            <div className="w-[380px] border-r border-gray-100 flex flex-col bg-gray-50/30">
                <div className="p-6 bg-white border-b border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-black text-[#0f172a] tracking-tight">Centro de Chats</h2>
                        <button className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400">
                            <MoreVertical className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="relative mb-4">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar conversación..."
                            className="w-full pl-11 pr-4 py-3 bg-gray-100 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 text-sm focus:border-blue-500 transition-all outline-none"
                        />
                    </div>

                    <div className="flex gap-2">
                        <FilterChip label="Todos" active={filter === 'all'} onClick={() => setFilter('all')} />
                        <FilterChip label="WhatsApp" active={filter === 'whatsapp'} onClick={() => setFilter('whatsapp')} />
                        <FilterChip label="Telegram" active={filter === 'telegram'} onClick={() => setFilter('telegram')} />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {conversations.map(conv => (
                        <button
                            key={conv.id}
                            onClick={() => setSelectedConv(conv)}
                            className={`w-full p-6 flex gap-4 text-left border-b border-gray-100/50 transition-all relative group ${selectedConv?.id === conv.id ? 'bg-white shadow-[0_10px_30px_rgba(0,0,0,0.04)] z-10' : 'hover:bg-white/50'}`}
                        >
                            {selectedConv?.id === conv.id && <div className="absolute left-0 top-6 bottom-6 w-1 bg-blue-600 rounded-r-full" />}

                            <div className="relative">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-600 font-bold text-lg select-none">
                                    {conv.lead.name.split(' ').map(n => n[0]).join('')}
                                </div>
                                <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-lg flex items-center justify-center border-2 border-white shadow-sm ${conv.channel === 'whatsapp' ? 'bg-green-500' : conv.channel === 'telegram' ? 'bg-sky-500' : 'bg-gray-800'
                                    } text-white`}>
                                    {conv.channel === 'whatsapp' && <Smartphone className="w-3 h-3" />}
                                    {conv.channel === 'telegram' && <TelegramIcon className="w-3 h-3" />}
                                    {conv.channel === 'web' && <MessageCircle className="w-3 h-3" />}
                                </div>
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className={`font-bold truncate ${selectedConv?.id === conv.id ? 'text-blue-600' : 'text-gray-900'}`}>{conv.lead.name}</h3>
                                    <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap ml-2">
                                        {isToday(conv.last_message_at) ? formatTime(conv.last_message_at) : 'Ayer'}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 font-medium line-clamp-1">{conv.last_message}</p>

                                {conv.unread_count > 0 && (
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{conv.unread_count} nuevos</span>
                                    </div>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            {selectedConv ? (
                <div className="flex-1 flex flex-col bg-white">
                    {/* Chat Header */}
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-20">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 font-bold">
                                {selectedConv.lead.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900">{selectedConv.lead.name}</h3>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">En línea</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <HeaderAction icon={Phone} />
                            <HeaderAction icon={Video} />
                            <div className="w-px h-6 bg-gray-100 mx-2" />
                            <HeaderAction icon={Search} />
                            <HeaderAction icon={MoreVertical} />
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto p-8 space-y-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed"
                    >
                        <div className="flex justify-center mb-8">
                            <span className="bg-gray-100/80 backdrop-blur-sm text-gray-500 text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest">Hoy</span>
                        </div>

                        {messages.map((msg, i) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                                style={{ animationDelay: `${i * 50}ms` }}
                            >
                                <div className={`max-w-[70%] relative ${msg.direction === 'outbound' ? 'order-1' : 'order-2'}`}>
                                    <div className={`p-4 rounded-2xl shadow-sm text-sm font-medium leading-relaxed ${msg.direction === 'outbound'
                                        ? 'bg-[#0f172a] text-white rounded-tr-none'
                                        : 'bg-white border border-gray-100 text-gray-700 rounded-tl-none'
                                        }`}>
                                        {msg.content}
                                    </div>
                                    <div className={`mt-2 flex items-center gap-1.5 ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                                        <span className="text-[10px] font-bold text-gray-400">{formatTime(msg.sent_at)}</span>
                                        {msg.direction === 'outbound' && (
                                            <CheckCheck className={`w-3.5 h-3.5 ${msg.status === 'read' ? 'text-blue-500' : 'text-gray-300'}`} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Input Area */}
                    <div className="p-6 bg-white border-t border-gray-100">
                        <form
                            onSubmit={handleSendMessage}
                            className="bg-gray-50 rounded-2xl p-2 flex items-center gap-2 border border-transparent focus-within:border-blue-500/20 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/5 transition-all"
                        >
                            <button type="button" className="p-3 text-gray-400 hover:text-blue-600 transition-colors">
                                <Paperclip className="w-5 h-5" />
                            </button>
                            <input
                                type="text"
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                                placeholder="Escribe un mensaje..."
                                className="flex-1 bg-transparent py-3 px-2 outline-none text-sm font-medium text-gray-700"
                            />
                            <button type="button" className="p-3 text-gray-400 hover:text-blue-600 transition-colors">
                                <Smile className="w-5 h-5" />
                            </button>
                            <button
                                type="submit"
                                disabled={!newMessage.trim()}
                                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white p-3 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </form>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center bg-white p-12 text-center">
                    <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-8 animate-bounce transition-all duration-1000">
                        <MessageSquare className="w-10 h-10 text-blue-600" />
                    </div>
                    <h2 className="text-3xl font-black text-[#0f172a] mb-4 tracking-tight">Tu Central Omnicanal</h2>
                    <p className="text-gray-500 max-w-md leading-relaxed font-medium">
                        Selecciona una conversación a la izquierda para empezar a chatear.
                        Tus mensajes de WhatsApp, Telegram y Web aparecerán aquí unificados.
                    </p>

                    <div className="grid grid-cols-3 gap-8 mt-16 opacity-30">
                        <div className="flex flex-col items-center gap-2">
                            <Smartphone className="w-8 h-8 text-green-500" />
                            <span className="text-xs font-bold uppercase tracking-widest">WhatsApp</span>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <TelegramIcon className="w-8 h-8 text-sky-500" />
                            <span className="text-xs font-bold uppercase tracking-widest">Telegram</span>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <Bot className="w-8 h-8 text-indigo-500" />
                            <span className="text-xs font-bold uppercase tracking-widest">Leads AI</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Right Lead Details Panel */}
            {selectedConv && (
                <div className="w-[340px] border-l border-gray-100 bg-white flex flex-col animate-in slide-in-from-right-4 duration-500">
                    <div className="p-8 text-center border-b border-gray-100">
                        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-3xl mx-auto mb-6 shadow-xl shadow-blue-500/20">
                            {selectedConv.lead.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <h3 className="text-xl font-black text-gray-900 mb-1">{selectedConv.lead.name}</h3>
                        <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">{selectedConv.lead.company}</p>
                    </div>

                    <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1">
                        <div>
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Información de Contacto</h4>
                            <div className="space-y-4">
                                <LeadDetail icon={Mail} label="Email" value={selectedConv.lead.email} />
                                <LeadDetail icon={PhoneIcon} label="WhatsApp" value="+503 7654-3210" />
                                <LeadDetail icon={Building2} label="Empresa" value={selectedConv.lead.company} />
                                <LeadDetail icon={Clock} label="Zona Horaria" value="GMT -6 (El Salvador)" />
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Acciones CRM</h4>
                            <div className="grid grid-cols-1 gap-3">
                                <button className="w-full py-3 bg-blue-50 text-blue-600 font-bold rounded-xl text-xs hover:bg-blue-100 transition-colors flex items-center justify-center gap-2">
                                    <User className="w-4 h-4" /> Ver Perfil de Lead
                                </button>
                                <button className="w-full py-3 bg-indigo-50 text-indigo-600 font-bold rounded-xl text-xs hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2">
                                    <ImageIcon className="w-4 h-4" /> Crear Cotización
                                </button>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                            <p className="text-[10px] font-bold text-gray-400 mb-2 uppercase">Nota del Agente AI</p>
                            <p className="text-xs text-gray-600 leading-relaxed italic">
                                "El cliente está interesado en el paquete corporativo pero tiene dudas sobre la implementación en la nube."
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function FilterChip({ label, active, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${active
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-100'
                }`}
        >
            {label}
        </button>
    );
}

function HeaderAction({ icon: Icon }: any) {
    return (
        <button className="p-2.5 hover:bg-gray-50 rounded-xl transition-colors text-gray-500 hover:text-blue-600">
            <Icon className="w-5 h-5" />
        </button>
    );
}

function LeadDetail({ icon: Icon, label, value }: any) {
    return (
        <div className="flex items-start gap-4">
            <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 shrink-0">
                <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
                <p className="text-[10px] font-bold text-gray-400 uppercase">{label}</p>
                <p className="text-sm font-bold text-gray-900 truncate">{value}</p>
            </div>
        </div>
    );
}
