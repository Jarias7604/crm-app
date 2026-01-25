import { useState, useEffect, useRef } from 'react';
import {
    Search,
    Send,
    MoreVertical,
    Paperclip,
    Smile,
    User,
    Mail,
    Phone as PhoneIcon,
    CheckCheck,
    MessageSquare,
    Send as TelegramIcon,
    Smartphone,
    Bot,
    Users,
    FileText,
    TrendingUp,
    Zap,
    X,
    Filter
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { chatService, type ChatConversation, type ChatMessage } from '../../services/marketing/chatService';
import { leadsService } from '../../services/leads';
import { storageService } from '../../services/storage';
import { useAuth } from '../../auth/AuthProvider';
import toast from 'react-hot-toast';

export default function ChatHub() {
    const [conversations, setConversations] = useState<ChatConversation[]>([]);
    const [leads, setLeads] = useState<any[]>([]);
    const [selectedConv, setSelectedConv] = useState<ChatConversation | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sidebarView, setSidebarView] = useState<'chats' | 'leads'>('chats');
    const [showDetails, setShowDetails] = useState(true);
    const [loading, setLoading] = useState(true);
    const [pendingQuote, setPendingQuote] = useState<any>(null);
    const [isUploading, setIsUploading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const location = useLocation();
    const navigate = useNavigate();
    const { profile } = useAuth();

    // 1. Initial Load
    useEffect(() => {
        loadData();
        const sub = chatService.subscribeToConversations(() => loadData());
        return () => { sub.unsubscribe(); };
    }, []);

    // 2. Handle incoming quote for review from location state
    useEffect(() => {
        if (location.state?.newQuote) {
            setPendingQuote(location.state.newQuote);
        }
    }, [location.state]);

    const loadData = async () => {
        try {
            const [conversationsData, leadsData] = await Promise.all([
                chatService.getConversations(),
                leadsService.getLeads(1, 20)
            ]);
            setConversations(conversationsData);
            setLeads(leadsData.data || []);
            setLoading(false);

            if (location.state?.lead && !selectedConv) {
                const leadId = location.state.lead.id;
                const existing = conversationsData.find(c => c.lead?.id === leadId);
                if (existing) {
                    setSelectedConv(existing);
                } else {
                    const placeholder: ChatConversation = {
                        id: 'new',
                        channel: location.state.channel || 'telegram',
                        status: 'open',
                        last_message: 'Iniciando conversación...',
                        last_message_at: new Date().toISOString(),
                        unread_count: 0,
                        lead: location.state.lead
                    };
                    setSelectedConv(placeholder);
                }
            }
        } catch (error) {
            console.error('Error loading hub data:', error);
            setLoading(false);
        }
    };

    // 3. Load Messages & Realtime Subscription
    useEffect(() => {
        if (selectedConv && selectedConv.id !== 'new') {
            loadMessages(selectedConv.id);
            chatService.markAsRead(selectedConv.id);
            const sub = chatService.subscribeToMessages(selectedConv.id, (msg) => {
                setMessages(prev => {
                    if (prev.find(m => m.id === msg.id)) return prev;
                    return [...prev, msg];
                });
            });
            return () => { sub.unsubscribe(); };
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
            let convId = selectedConv.id;

            if (convId === 'new') {
                if (!selectedConv.lead?.id) return;
                const newConv = await chatService.createConversation(
                    selectedConv.lead.id,
                    selectedConv.channel
                );
                setSelectedConv(newConv);
                convId = newConv.id;
                // Add the new conversation to the list so it doesn't look empty
                setConversations(prev => [newConv, ...prev]);
            }

            await chatService.sendMessage(convId, content);
        } catch (error: any) {
            toast.error('Error al enviar: ' + error.message);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedConv?.id || !profile?.company_id) return;

        try {
            setIsUploading(true);
            const path = await storageService.uploadMessageFile(profile.company_id, selectedConv.id, file);

            // Use signed URL for better security and accessibility if bucket is private
            const url = await storageService.getDownloadUrl(path);

            const isImage = file.type.startsWith('image/');
            await chatService.sendMessage(
                selectedConv.id,
                `📁 Archivo: ${file.name}`,
                isImage ? 'image' : 'file',
                { url, fileName: file.name, fileSize: file.size }
            );

            toast.success('Archivo enviado correctamente');
        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error('Error al subir el archivo');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSendPendingQuote = async () => {
        if (!pendingQuote || !selectedConv) return;
        try {
            // We follow the user's request: mention the lead name, a greeting and attach the professional PDF
            // We follow the user's request: mention the lead name, a greeting and attach the professional PDF
            // ALWAYS ensure we have a PDF URL. If not provided, generate it.
            let finalPdfUrl = pendingQuote.pdfUrl;

            if (!finalPdfUrl) {
                toast.loading('Generando PDF oficial...', { id: 'send-pdf' });
                const { pdfService } = await import('../../services/pdfService');
                finalPdfUrl = await pdfService.generateAndUploadQuotePDF(pendingQuote);
            } else {
                toast.loading('Enviando propuesta PDF...', { id: 'send-pdf' });
            }

            const leadName = selectedConv.lead?.name || pendingQuote.nombre_cliente || 'Cliente';
            const professionalMessage = `Hola ${leadName}, es un gusto saludarte. Adjunto te envío la propuesta comercial profesional que preparamos para ti. Quedo atento a cualquier duda o comentario.`;

            await chatService.sendMessage(
                selectedConv.id,
                professionalMessage,
                'file',
                {
                    url: finalPdfUrl,
                    fileName: `Propuesta_${pendingQuote.nombre_cliente?.replace(/\s+/g, '_') || 'Comercial'}.pdf`,
                    isAutoGenerated: true
                }
            );
            toast.success('¡Propuesta enviada exitosamente!', { id: 'send-pdf' });

            setPendingQuote(null);
        } catch (error) {
            console.error('Error sending quote:', error);
            toast.error('Error al enviar el archivo PDF', { id: 'send-pdf' });
        }
    };

    const handleEditPendingQuote = () => {
        if (!pendingQuote) return;
        navigate(`/cotizaciones/${pendingQuote.id}/editar`, {
            state: {
                lead: selectedConv?.lead,
                conversation_id: selectedConv?.id,
                fromChat: true
            }
        });
    };

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const handleSelectLead = (lead: any) => {
        const existing = conversations.find(c => c.lead?.id === lead.id);
        if (existing) {
            setSelectedConv(existing);
        } else {
            const placeholder: ChatConversation = {
                id: 'new',
                channel: 'telegram',
                status: 'open',
                last_message: 'Nueva conversación...',
                last_message_at: new Date().toISOString(),
                unread_count: 0,
                lead: {
                    id: lead.id,
                    name: lead.name,
                    email: lead.email,
                    company_name: lead.company_name,
                    phone: lead.phone
                }
            };
            setSelectedConv(placeholder);
        }
    };

    if (loading) return (
        <div className="flex h-screen items-center justify-center bg-slate-50/50">
            <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-[3px] border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
                <p className="text-slate-400 font-medium text-[11px] tracking-widest uppercase">Cargando Inbox...</p>
            </div>
        </div>
    );

    return (
        <div className="flex h-[calc(100vh-100px)] w-full gap-6 p-6 animate-in fade-in duration-700">
            {/* Hidden File Input */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept="application/pdf,image/*"
            />

            {/* List Sidebar */}
            <div className="w-[380px] flex flex-col bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden shrink-0">
                <div className="p-8 pb-4 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-black text-slate-800 tracking-tighter">Mensajes</h2>
                        <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                            <button
                                onClick={() => setSidebarView('chats')}
                                className={`p-2.5 rounded-lg transition-all ${sidebarView === 'chats' ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-400'}`}
                            >
                                <MessageSquare className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setSidebarView('leads')}
                                className={`p-2.5 rounded-lg transition-all ${sidebarView === 'leads' ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-400'}`}
                            >
                                <Users className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300" />
                        <input
                            type="text"
                            placeholder={sidebarView === 'chats' ? "Buscar conversación..." : "Buscar lead..."}
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all outline-none font-bold text-sm text-slate-700 placeholder:text-slate-300"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-8 space-y-2">
                    {sidebarView === 'chats' ? (
                        conversations.map(conv => (
                            <button
                                key={conv.id}
                                onClick={() => setSelectedConv(conv)}
                                className={`w-full p-4 flex gap-4 text-left rounded-2xl transition-all relative ${selectedConv?.id === conv.id ? 'bg-blue-50/50 border border-blue-100/50' : 'hover:bg-slate-50'}`}
                            >
                                <div className="relative shrink-0">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-sm ${selectedConv?.id === conv.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                        {conv.lead?.name?.[0] || '?'}
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-xl shadow-sm flex items-center justify-center border-2 border-white">
                                        {conv.channel === 'telegram' ? <TelegramIcon className="w-3 h-3 text-blue-500" /> : <Smartphone className="w-3 h-3 text-emerald-500" />}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0 pt-1">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h3 className={`text-[13px] font-black truncate tracking-tight ${selectedConv?.id === conv.id ? 'text-blue-700' : 'text-slate-700'}`}>
                                            {conv.lead?.name || 'Prospecto'}
                                        </h3>
                                        <span className="text-[9px] font-black text-slate-300">{formatTime(conv.last_message_at)}</span>
                                    </div>
                                    <p className={`text-[12px] truncate font-bold leading-tight ${selectedConv?.id === conv.id ? 'text-blue-600/60' : 'text-slate-400'}`}>
                                        {conv.last_message}
                                    </p>
                                </div>
                                {conv.unread_count > 0 && <div className="w-2 h-2 bg-blue-600 rounded-full mt-3 shadow-lg shadow-blue-500/20" />}
                            </button>
                        ))
                    ) : (
                        leads.length > 0 ? leads.map(lead => (
                            <button
                                key={lead.id}
                                onClick={() => handleSelectLead(lead)}
                                className="w-full p-4 flex gap-4 text-left rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100"
                            >
                                <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-black text-lg">
                                    {lead.name?.[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-[13px] font-black text-slate-800 tracking-tight truncate">{lead.name}</h3>
                                    <p className="text-[11px] font-bold text-slate-400 truncate">{lead.company_name || 'Individual'}</p>
                                </div>
                                <Filter className="w-4 h-4 text-slate-200 self-center" />
                            </button>
                        )) : (
                            <div className="p-10 text-center space-y-4">
                                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto"><Bot className="w-8 h-8 text-slate-200" /></div>
                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No hay leads</p>
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden relative">
                {selectedConv ? (
                    <>
                        <header className="px-10 py-6 border-b border-slate-50 flex items-center justify-between bg-white z-10">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-black text-2xl shadow-xl">
                                    {selectedConv.lead?.name?.[0] || '?'}
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 tracking-tighter leading-none mb-2">{selectedConv.lead?.name}</h2>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Activo en {selectedConv.channel}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => navigate('/cotizaciones/nueva-pro', { state: { lead: selectedConv.lead, conversation_id: selectedConv.id, fromChat: true } })}
                                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20"
                                >
                                    Nueva Cotización
                                </button>
                                <button
                                    onClick={() => setShowDetails(!showDetails)}
                                    className={`p-3.5 rounded-2xl transition-all ${showDetails ? 'bg-slate-100 text-blue-600' : 'bg-white text-slate-300 border border-slate-100'}`}
                                >
                                    <Zap className="w-5 h-5" />
                                </button>
                                <button className="p-3.5 text-slate-300 hover:bg-slate-50 rounded-2xl transition-all"><MoreVertical className="w-5 h-5" /></button>
                            </div>
                        </header>

                        {/* REVIEW QUOTE BAR */}
                        {pendingQuote && (
                            <div className="absolute top-[88px] left-0 right-0 bg-blue-600 text-white px-10 py-4 flex items-center justify-between animate-in slide-in-from-top duration-500 z-20 shadow-lg">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><FileText className="w-6 h-6" /></div>
                                    <div>
                                        <p className="text-[11px] font-black uppercase tracking-widest leading-none mb-1">Cotización Lista</p>
                                        <p className="text-sm font-bold">Resumen: ${pendingQuote.total_anual?.toLocaleString()} - {pendingQuote.nombre_cliente}</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={handleEditPendingQuote} className="px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase transition-all">Seguir Editando</button>
                                    <button onClick={handleSendPendingQuote} className="px-5 py-2.5 bg-white text-blue-600 hover:bg-blue-50 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm">Enviar al Chat</button>
                                    <button onClick={() => setPendingQuote(null)} className="p-2.5 hover:bg-white/10 rounded-xl transition-all"><X className="w-5 h-5" /></button>
                                </div>
                            </div>
                        )}

                        <div ref={scrollRef} className="flex-1 overflow-y-auto px-12 py-10 space-y-12 bg-slate-50/20 custom-scrollbar">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-500`}>
                                    <div className={`max-w-[70%] space-y-2.5 ${msg.direction === 'outbound' ? 'items-end' : 'items-start'} flex flex-col`}>
                                        <div className={`px-7 py-4 rounded-[2.5rem] text-[15px] font-bold leading-relaxed shadow-sm relative ${msg.direction === 'outbound'
                                            ? 'bg-slate-900 text-white rounded-br-none'
                                            : 'bg-white text-slate-700 rounded-bl-none border border-slate-100 shadow-slate-200/50'
                                            }`}>
                                            {msg.content.startsWith('__QUOTE__') ? (
                                                <div className="space-y-4 py-2 min-w-[200px]">
                                                    <div className="flex items-center gap-3 text-blue-400">
                                                        <FileText className="w-8 h-8" />
                                                        <div className="font-black text-white">Propuesta Comercial</div>
                                                    </div>
                                                    <div className="h-px bg-white/10" />
                                                    <div className="flex justify-between items-center py-2">
                                                        <span className="text-[12px] font-bold opacity-60">Inversión:</span>
                                                        <span className="text-emerald-400 text-lg font-black">
                                                            ${(() => {
                                                                try {
                                                                    const data = JSON.parse(msg.content.substring(9).trim());
                                                                    return data.total?.toLocaleString() || '0';
                                                                } catch (e) { return '0'; }
                                                            })()}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            try {
                                                                const quoteData = JSON.parse(msg.content.substring(9).trim());
                                                                navigate(`/cotizaciones/${quoteData.id}`);
                                                            } catch (e) {
                                                                toast.error('Error al abrir la cotización');
                                                            }
                                                        }}
                                                        className="w-full py-3 bg-white/10 hover:bg-white text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                                    >
                                                        Ver Detalle / Exportar PDF
                                                    </button>
                                                </div>
                                            ) : msg.type === 'file' || msg.type === 'image' ? (
                                                <div className="space-y-3">
                                                    {msg.type === 'image' && msg.metadata?.url && (
                                                        <img
                                                            src={msg.metadata.url}
                                                            alt="Preview"
                                                            className="max-w-full rounded-xl border border-white/10 cursor-pointer hover:opacity-90 transition-all"
                                                            onClick={() => window.open(msg.metadata.url, '_blank')}
                                                        />
                                                    )}
                                                    <div className="flex items-center gap-3 text-blue-400">
                                                        <FileText className="w-6 h-6" />
                                                        <div className="font-bold truncate max-w-[150px]">{msg.metadata?.fileName || 'Archivo'}</div>
                                                    </div>
                                                    <a
                                                        href={msg.metadata?.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="block w-full text-center py-2 bg-white/10 hover:bg-white/20 rounded-lg text-[10px] font-black uppercase transition-all"
                                                    >
                                                        Ver / Descargar
                                                    </a>
                                                </div>
                                            ) : msg.content}
                                        </div>
                                        <div className="flex items-center gap-2 px-3 opacity-30">
                                            <span className="text-[9px] font-black uppercase tracking-widest">{formatTime(msg.sent_at)}</span>
                                            {msg.direction === 'outbound' && <CheckCheck className="w-3.5 h-3.5" />}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Input Area */}
                        <div className="px-10 pb-10 pt-4 bg-white border-t border-slate-50">
                            {isUploading && (
                                <div className="mb-4 flex items-center gap-3 text-blue-600 animate-pulse">
                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Subiendo archivo...</span>
                                </div>
                            )}
                            <form onSubmit={handleSendMessage} className="bg-slate-50 rounded-[32px] p-2 flex items-center gap-3 border border-slate-100 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/5 transition-all">
                                <button type="button" className="p-4 text-slate-300 hover:text-blue-600 transition-all"><Smile className="w-7 h-7" /></button>
                                <textarea
                                    value={newMessage}
                                    onChange={e => setNewMessage(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e as any); } }}
                                    placeholder="Escribe un mensaje..."
                                    className="flex-1 bg-transparent py-4 font-bold text-sm text-slate-700 outline-none resize-none max-h-32 custom-scrollbar"
                                />
                                <div className="flex items-center gap-1.5 pr-2">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-4 text-slate-300 hover:text-blue-600 transition-all"
                                    >
                                        <Paperclip className="w-6 h-6" />
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!newMessage.trim() || isUploading}
                                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-white p-5 rounded-[22px] shadow-xl shadow-blue-600/30 transition-all"
                                    >
                                        <Send className="w-6 h-6" />
                                    </button>
                                </div>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-20 text-center bg-slate-50/10">
                        <div className="w-32 h-32 bg-slate-50 rounded-[40px] flex items-center justify-center mb-10 border border-slate-100">
                            <MessageSquare className="w-14 h-14 text-slate-200" />
                        </div>
                        <h2 className="text-4xl font-black text-slate-900 mb-6 tracking-tighter">Inbox Centralizado</h2>
                        <p className="text-[12px] text-slate-400 max-w-sm leading-loose font-black uppercase tracking-[0.25em]">Selecciona una conversación o lead para ver los detalles y mensajes.</p>
                    </div>
                )}
            </div>

            {/* Right Information Sidebar */}
            {
                selectedConv && showDetails && (
                    <div className="w-[360px] bg-white rounded-[32px] border border-slate-100 shadow-sm flex flex-col overflow-y-auto custom-scrollbar shrink-0">
                        <div className="p-10 text-center space-y-8 bg-gradient-to-b from-slate-50/50 to-white">
                            <div className="w-36 h-36 rounded-[48px] bg-gradient-to-br from-indigo-600 to-blue-700 flex items-center justify-center text-white font-black text-6xl mx-auto shadow-2xl shadow-blue-600/30 rotate-3">
                                {selectedConv.lead?.name?.[0] || '?'}
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tighter mb-2">{selectedConv.lead?.name || 'Visitante'}</h3>
                                <span className="px-4 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-black rounded-xl border border-blue-100 uppercase tracking-widest">{selectedConv.lead?.company_name || 'Individual'}</span>
                            </div>
                        </div>
                        <div className="px-8 pb-12 space-y-12">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-5 bg-slate-50 rounded-[24px] border border-slate-100 text-center">
                                    <TrendingUp className="w-5 h-5 text-blue-600 mx-auto mb-2" />
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Score IA</p>
                                    <p className="text-xl font-black text-slate-800 tracking-tighter">98/100</p>
                                </div>
                                <div className="p-5 bg-slate-50 rounded-[24px] border border-slate-100 text-center">
                                    <Zap className="w-5 h-5 text-amber-500 mx-auto mb-2" />
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Interés</p>
                                    <p className="text-xl font-black text-slate-800 tracking-tighter">Alto</p>
                                </div>
                            </div>
                            <div className="space-y-6">
                                <h4 className="text-[11px] font-black text-slate-300 uppercase tracking-widest">Información de Contacto</h4>
                                <div className="space-y-4">
                                    <InfoItem icon={Mail} label="Email" value={selectedConv.lead?.email || 'No identificado'} />
                                    <InfoItem icon={PhoneIcon} label="Teléfono" value={selectedConv.lead?.phone || 'Sin número'} />
                                </div>
                            </div>
                            <div className="space-y-3 pt-6">
                                <button
                                    onClick={() => navigate('/leads', { state: { leadId: selectedConv.lead?.id } })}
                                    className="w-full py-5 bg-slate-900 text-white rounded-[24px] text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl shadow-slate-900/10"
                                >
                                    <User className="w-4.5 h-4.5" /> Perfil Completo
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

function InfoItem({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
    return (
        <div className="flex items-center gap-5 group">
            <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-200 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all">
                <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0 border-b border-slate-50 pb-2">
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">{label}</p>
                <p className="text-[13px] font-bold text-slate-800 truncate tracking-tight">{value}</p>
            </div>
        </div>
    );
}
