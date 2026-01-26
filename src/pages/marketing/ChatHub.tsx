
import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    MoreVertical, Send, FileText, Smartphone, Layers,
    Paperclip, TrendingUp, Eye, Zap, Smile, Mail, Phone as PhoneIcon,
    Send as TelegramIcon, MessageSquare, Trash2, UserPlus, Search, X as CloseIcon, ChevronRight
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { chatService, type ChatConversation, type ChatMessage } from '../../services/marketing/chatService';
import { leadsService } from '../../services/leads';
import { aiAgentService } from '../../services/marketing/aiAgentService';
import { storageService } from '../../services/storage';
import { useAuth } from '../../auth/AuthProvider';
import { toast } from 'react-hot-toast';

export default function ChatHub() {
    const [conversations, setConversations] = useState<ChatConversation[]>([]);
    const [selectedConv, setSelectedConv] = useState<ChatConversation | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [filter, setFilter] = useState<'all' | 'whatsapp' | 'telegram'>('all');
    const [showDetails, setShowDetails] = useState(true);
    const [loading, setLoading] = useState(true);
    const [pendingQuote, setPendingQuote] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [leadSearch, setLeadSearch] = useState('');
    const [leadStatusFilter, setLeadStatusFilter] = useState('all');
    const [availableLeads, setAvailableLeads] = useState<any[]>([]);
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [agentStatus, setAgentStatus] = useState<boolean>(false);
    const lastProcessedMsgId = useRef<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const location = useLocation();
    const navigate = useNavigate();
    const { profile } = useAuth();
    const { isAdmin } = usePermissions();

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
            const [conversationsData] = await Promise.all([
                chatService.getConversations()
            ]);

            if (profile?.company_id) {
                const agents = await aiAgentService.getAgents(profile.company_id);
                const mainAgent = agents.find(a => a.is_active) || agents[0];
                setAgentStatus(mainAgent?.is_active || false);
            }

            setConversations(conversationsData);
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

    // 3. Auto-load leads when modal opens
    useEffect(() => {
        if (showNewChatModal) {
            loadInitialLeads();
        }
    }, [showNewChatModal]);

    const loadInitialLeads = async () => {
        try {
            const { data } = await leadsService.getLeads(1, 40);
            setAvailableLeads(data || []);
        } catch (e) {
            console.error('Error loading initial leads:', e);
        }
    };

    // 4. Load Messages & Realtime Subscription
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

    const handleDeleteMessage = async (msgId: string) => {
        if (!isAdmin()) return;
        if (!confirm('¿Eliminar este mensaje permanentemente?')) return;

        try {
            await chatService.deleteMessage(msgId);
            setMessages(prev => prev.filter(m => m.id !== msgId));
            toast.success('Mensaje eliminado');
        } catch (error) {
            console.error('Error deleting message:', error);
            toast.error('Error al eliminar mensaje');
        }
    };

    const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
        e.stopPropagation();
        if (!isAdmin()) return;
        if (!confirm('¿ELIMINAR CHAT COMPLETO? Se borrará el historial de este cliente.')) return;

        try {
            await chatService.deleteConversation(convId);
            setConversations(prev => prev.filter(c => c.id !== convId));
            if (selectedConv?.id === convId) setSelectedConv(null);
            toast.success('Conversación eliminada');
        } catch (error) {
            console.error('Error deleting conversation:', error);
            toast.error('Error al eliminar conversación');
        }
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }

        // AUTO-TRIGGER AI BOT
        if (agentStatus && !isAiProcessing && selectedConv && selectedConv.id !== 'new') {
            const lastMsg = messages[messages.length - 1];
            // Condition: Last message is inbound, not yet processed, and not generated by AI
            if (lastMsg && lastMsg.direction === 'inbound' && !lastMsg.metadata?.isAiGenerated && lastMsg.id !== lastProcessedMsgId.current) {
                lastProcessedMsgId.current = lastMsg.id || null;
                handleAiProcess(selectedConv.id, lastMsg.content);
            }
        }
    }, [messages, agentStatus]);

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
                setConversations(prev => [newConv, ...prev]);
            }

            await chatService.sendMessage(convId, content, 'text', 'outbound');
        } catch (error: any) {
            toast.error('Error al enviar: ' + error.message);
        }
    };

    const handleAiProcess = async (targetConvId?: string, providedMessage?: string) => {
        const cid = targetConvId || selectedConv?.id;
        if (!cid || !profile?.company_id) return;

        try {
            setIsAiProcessing(true);
            const response = await aiAgentService.processMessage(cid, providedMessage || '', profile.company_id);

            if (response) {
                await chatService.sendMessage(cid, response, 'text', 'outbound', { isAiGenerated: true });
            }
        } catch (error: any) {
            console.error('AI Error:', error);
        } finally {
            setIsAiProcessing(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedConv?.id || !profile?.company_id) return;

        try {
            const path = await storageService.uploadMessageFile(profile.company_id, selectedConv.id, file);
            const url = await storageService.getDownloadUrl(path);

            const isImage = file.type.startsWith('image/');
            await chatService.sendMessage(
                selectedConv.id,
                `📁 Archivo: ${file.name}`,
                isImage ? 'image' : 'file',
                'outbound',
                { url, fileName: file.name, fileSize: file.size }
            );

            toast.success('Archivo enviado correctamente');
        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error('Error al subir el archivo');
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const searchLeads = (query: string) => {
        setLeadSearch(query);
    };

    const modalFilteredLeads = availableLeads.filter(l => {
        const matchesSearch = !leadSearch.trim() ||
            (l.name?.toLowerCase().includes(leadSearch.toLowerCase()) ||
                l.phone?.includes(leadSearch));

        const matchesStatus = leadStatusFilter === 'all' ||
            (leadStatusFilter === 'prospect' && (l.status === 'Prospecto' || l.status === 'Nuevo')) ||
            (leadStatusFilter === 'client' && (l.status === 'Cliente' || l.status === 'Cerrado'));

        return matchesSearch && matchesStatus;
    });

    const startChatWithLead = (lead: any) => {
        if (!lead.phone) {
            toast.error('Este prospecto no tiene número de teléfono configurado para recibir mensajes.');
            return;
        }

        const existing = conversations.find(c => c.lead?.id === lead.id);
        if (existing) {
            setSelectedConv(existing);
        } else {
            const placeholder: ChatConversation = {
                id: 'new',
                channel: 'telegram',
                status: 'open',
                last_message: 'Iniciando conversación...',
                last_message_at: new Date().toISOString(),
                unread_count: 0,
                lead: lead
            };
            setSelectedConv(placeholder);
        }
        setShowNewChatModal(false);
        setLeadSearch('');
        setAvailableLeads([]);
    };

    const handleSendPendingQuote = async () => {
        if (!pendingQuote || !selectedConv) return;
        try {
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
                'outbound',
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

    const handlePreviewQuote = async () => {
        if (!pendingQuote) return;
        let pdfUrl = pendingQuote.pdfUrl;
        if (!pdfUrl) {
            toast.loading('Generando vista previa...', { id: 'preview-pdf' });
            try {
                const { pdfService } = await import('../../services/pdfService');
                pdfUrl = await pdfService.generateAndUploadQuotePDF(pendingQuote);
                setPendingQuote({ ...pendingQuote, pdfUrl });
            } catch (e) {
                toast.error("Error generando vista previa", { id: 'preview-pdf' });
                return;
            }
        }
        toast.dismiss('preview-pdf');
        window.open(pdfUrl, '_blank');
    };

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (loading) return (
        <div className="flex h-screen items-center justify-center bg-slate-50/50">
            <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-[3px] border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
                <p className="text-slate-400 font-medium text-[11px] tracking-widest uppercase">Cargando Inbox...</p>
            </div>
        </div>
    );

    const filteredConversations = conversations.filter(c => {
        if (filter !== 'all' && c.channel !== filter) return false;

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const name = c.lead?.name?.toLowerCase() || '';
            const phone = c.lead?.phone?.toLowerCase() || '';
            const email = c.lead?.email?.toLowerCase() || '';
            return name.includes(q) || phone.includes(q) || email.includes(q);
        }

        return true;
    });

    return (
        <div className="flex h-[calc(100vh-128px)] bg-white rounded-[3.5rem] shadow-[0_48px_96px_-24px_rgba(0,0,0,0.15)] border border-white/60 overflow-hidden font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900 relative animate-in fade-in duration-700">
            {/* Capa decorativa premium */}
            <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4449AA 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept="application/pdf,image/*"
            />

            <div className="w-[360px] flex flex-col bg-white rounded-[32px] shadow-xl border border-white/50 shrink-0 relative overflow-hidden h-full">
                <div className="p-6 pb-2 space-y-4 relative z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Inbox</h2>
                            <button
                                onClick={() => setShowNewChatModal(true)}
                                className="p-2.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                title="Nueva conversación con Lead"
                            >
                                <UserPlus className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-xl w-[180px]">
                            <FilterButton icon={Layers} active={filter === 'all'} onClick={() => setFilter('all')} />
                            <FilterButton icon={Smartphone} active={filter === 'whatsapp'} onClick={() => setFilter('whatsapp')} activeColor="bg-emerald-500 text-white shadow-emerald-500/30" />
                            <FilterButton icon={TelegramIcon} active={filter === 'telegram'} onClick={() => setFilter('telegram')} activeColor="bg-blue-500 text-white shadow-blue-500/30" />
                        </div>
                    </div>

                    <div className="relative group">
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar cliente..."
                            className="w-full pl-5 pr-5 py-3.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2 custom-scrollbar">
                    {filteredConversations.map(conv => (
                        <div
                            key={conv.id}
                            onClick={() => setSelectedConv(conv)}
                            className={`p-4 rounded-[20px] cursor-pointer transition-all duration-300 border relative group overflow-hidden ${selectedConv?.id === conv.id
                                ? 'bg-blue-600 border-blue-500 shadow-xl shadow-blue-900/20 translate-x-2'
                                : 'bg-white border-transparent hover:bg-white hover:border-slate-100 hover:shadow-lg hover:shadow-slate-200/50 hover:translate-x-1'
                                }`}
                        >
                            <div className="flex gap-4 relative z-10">
                                <div className="relative shrink-0">
                                    <div className={`w-12 h-12 rounded-[16px] flex items-center justify-center font-black text-lg transition-transform group-hover:scale-105 ${selectedConv?.id === conv.id ? 'bg-white text-blue-600 shadow-lg' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                        {conv.lead?.name?.[0] || '?'}
                                    </div>
                                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-white shadow-sm ${conv.channel === 'telegram' ? 'bg-sky-500' : 'bg-emerald-500'
                                        }`}>
                                        {conv.channel === 'telegram' ? <TelegramIcon className="w-2.5 h-2.5 text-white" /> : <Smartphone className="w-2.5 h-2.5 text-white" />}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h3 className={`text-sm font-black truncate tracking-tight ${selectedConv?.id === conv.id ? 'text-white' : 'text-slate-800'}`}>
                                            {conv.lead?.name || 'Prospecto'}
                                        </h3>
                                        <span className={`text-[9px] font-bold ${selectedConv?.id === conv.id ? 'text-blue-200' : 'text-slate-400'}`}>
                                            {formatTime(conv.last_message_at)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <p className={`text-xs truncate max-w-[180px] font-medium ${selectedConv?.id === conv.id ? 'text-blue-100' : 'text-slate-500'}`}>
                                            {conv.last_message || 'Nueva conversación'}
                                        </p>

                                        {/* ADMIN ACTIONS: DELETE CONVERSATION */}
                                        {isAdmin() && (
                                            <button
                                                onClick={(e) => handleDeleteConversation(e, conv.id)}
                                                className={`p-1.5 rounded-full hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 ${selectedConv?.id === conv.id ? 'text-white/50 hover:bg-white/20 hover:text-white' : 'text-slate-300'}`}
                                                title="Eliminar conversación completa"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex-1 flex flex-col bg-white/80 backdrop-blur-xl rounded-[32px] shadow-2xl border border-white/50 overflow-hidden relative isolate min-h-0">
                <div className="absolute inset-0 z-[-1] opacity-40" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-100/30 rounded-full blur-[100px] -z-10 translate-x-1/3 -translate-y-1/3"></div>

                {selectedConv ? (
                    <>
                        <header className="px-8 py-5 flex items-center justify-between border-b border-white/50 bg-white/60 backdrop-blur-md sticky top-0 z-30">
                            <div className="flex items-center gap-5">
                                <div className="relative">
                                    <div className="w-14 h-14 rounded-[20px] bg-slate-900 flex items-center justify-center text-white text-xl font-black shadow-2xl shadow-slate-900/20 overflow-hidden">
                                        {selectedConv.lead?.name?.[0]}
                                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/20" />
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-[3px] border-white rounded-full animate-pulse shadow-sm" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-xl font-black text-slate-900 tracking-tight">{selectedConv.lead?.name}</h2>
                                        <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[9px] font-black uppercase text-slate-500 tracking-widest">{selectedConv.channel}</span>
                                    </div>
                                    <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mt-0.5">
                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block" /> En línea
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3 items-center">
                                <button
                                    onClick={() => handleAiProcess()}
                                    disabled={isAiProcessing || !agentStatus}
                                    title="Pedir respuesta a la IA"
                                    className={`h-11 w-11 flex items-center justify-center rounded-xl border transition-all ${isAiProcessing ? 'bg-slate-50 text-slate-300' : 'bg-white text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50'}`}
                                >
                                    <Zap className={`w-4 h-4 ${isAiProcessing ? 'animate-pulse' : ''}`} />
                                </button>
                                <button
                                    onClick={() => navigate('/cotizaciones/nueva-pro', { state: { lead: selectedConv.lead, conversation_id: selectedConv.id, fromChat: true } })}
                                    className="h-11 px-6 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-600/30 transition-all flex items-center gap-2 group"
                                >
                                    <TrendingUp className="w-4 h-4 text-blue-400 group-hover:text-white transition-colors" />
                                    Cotizar
                                </button>
                                <div className="relative group">
                                    <button
                                        onClick={() => setShowDetails(!showDetails)}
                                        className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${showDetails ? 'bg-slate-200 text-slate-900' : 'bg-white border border-slate-200 text-slate-400 hover:text-slate-900'}`}
                                    >
                                        <MoreVertical className="w-5 h-5" />
                                    </button>

                                    {/* DROPDOWN MENU */}
                                    <div className="absolute top-12 right-0 w-48 bg-white rounded-xl shadow-xl border border-slate-100 p-1 hidden group-hover:block z-50">
                                        {isAdmin() && (
                                            <button
                                                onClick={(e) => handleDeleteConversation(e, selectedConv.id)}
                                                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-[11px] font-bold text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                ELIMINAR CHAT
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div> {/* Closing the flex gap-3 container */}
                        </header>

                        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-8 space-y-6 custom-scrollbar scroll-smooth">
                            {messages.map((msg, idx) => (
                                <div key={msg.id || idx} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'} group w-full`}>
                                    <div className={`flex flex-col gap-1.5 ${msg.direction === 'outbound' ? 'items-end' : 'items-start'} w-full`}>
                                        <div className={`px-6 py-4 rounded-[24px] text-[15px] leading-relaxed relative shadow-sm transition-all hover:shadow-md w-fit max-w-[90%] break-words ${msg.direction === 'outbound'
                                            ? 'bg-slate-900 text-white rounded-br-none shadow-slate-900/10'
                                            : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none shadow-slate-200/40'
                                            }`}>
                                            {msg.content.startsWith('__QUOTE__') ? (
                                                <div className="w-fit max-w-[80%] min-w-[200px]">
                                                    <div className="flex items-center gap-4 mb-3 pb-3 border-b border-white/10">
                                                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-blue-400">
                                                            <FileText className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] font-black uppercase text-white/60 tracking-widest">Documento</p>
                                                            <p className="text-sm font-bold text-white truncate">Propuesta Comercial</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => { try { const d = JSON.parse(msg.content.substring(9).trim()); navigate(`/cotizaciones/${d.id}`); } catch (e) { } }}
                                                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20"
                                                    >
                                                        Ver PDF
                                                    </button>
                                                </div>
                                            ) : msg.type === 'image' && msg.metadata?.url ? (
                                                <img src={msg.metadata.url} className="rounded-xl max-w-full cursor-pointer hover:opacity-95 shadow-sm border border-black/5" onClick={() => window.open(msg.metadata.url)} />
                                            ) : msg.type === 'file' ? (
                                                <a href={msg.metadata?.url} target="_blank" className="flex items-center gap-3 p-2 group-hover/link:underline w-full">
                                                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white shrink-0"><Paperclip className="w-5 h-5" /></div>
                                                    <span className="font-bold underline-offset-4 truncate">{msg.metadata?.fileName || 'Adjunto'}</span>
                                                </a>
                                            ) : (
                                                msg.content
                                            )}

                                            {/* DELETE BUTTON FOR ADMINS */}
                                            {isAdmin() && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg.id); }}
                                                    className={`absolute -top-2 ${msg.direction === 'outbound' ? '-left-8' : '-right-8'} p-1.5 rounded-full bg-white text-slate-400 hover:text-red-500 hover:bg-slate-50 opacity-0 group-hover:opacity-100 transition-all shadow-sm border border-slate-100 z-10`}
                                                    title="Eliminar mensaje"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {formatTime(msg.sent_at)} • {msg.direction === 'outbound' ? 'Entregado' : 'Recibido'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {pendingQuote && (
                            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-[90%] max-w-xl animate-in slide-in-from-bottom-5 duration-500 z-20">
                                <div className="bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] border border-blue-50 overflow-hidden">
                                    <div className="h-1 w-full bg-slate-100 flex">
                                        <div className="h-full bg-blue-500 w-2/3 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                                    </div>

                                    <div className="p-5">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">Proceso de Cotización</h4>
                                                <p className="text-[11px] text-slate-400 font-medium mt-0.5">Editando propuesta para {pendingQuote.nombre_cliente}</p>
                                            </div>
                                            <div className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider border border-blue-100">
                                                Paso 2 de 3
                                            </div>
                                        </div>

                                        <div className="flex gap-3 mt-4">
                                            <button onClick={handleEditPendingQuote} className="px-4 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors">
                                                ← Editar
                                            </button>
                                            <button onClick={handlePreviewQuote} className="flex-1 py-3 bg-white border-2 border-slate-100 hover:border-blue-200 text-slate-700 hover:text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 group">
                                                <Eye className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                                                Previsualizar PDF
                                            </button>
                                            <button onClick={handleSendPendingQuote} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
                                                Enviar PDF <Send className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="px-8 pb-8 pt-2 bg-gradient-to-t from-white via-white to-transparent">
                            <form onSubmit={handleSendMessage} className="bg-white rounded-[24px] p-2 flex items-center gap-2 border border-slate-200 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.05)] focus-within:ring-4 focus-within:ring-blue-100 focus-within:border-blue-300 transition-all">
                                <button type="button" className="p-3 text-slate-400 hover:text-blue-500 transition-colors"><Smile className="w-5 h-5" /></button>
                                <textarea
                                    value={newMessage}
                                    onChange={e => setNewMessage(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e as any); } }}
                                    placeholder="Escribe un mensaje..."
                                    className="flex-1 bg-transparent py-3 text-sm font-medium text-slate-700 outline-none resize-none max-h-24 custom-scrollbar placeholder:text-slate-300"
                                    rows={1}
                                />
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-400 hover:text-blue-500 transition-colors"><Paperclip className="w-5 h-5" /></button>
                                <button type="submit" disabled={!newMessage.trim()} className="p-3 bg-slate-900 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-slate-900 transition-all shadow-md">
                                    <Send className="w-4 h-4" />
                                </button>
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

            {
                selectedConv && showDetails && (
                    <div className="w-[260px] bg-white rounded-[32px] border border-slate-100 shadow-sm flex flex-col overflow-y-auto shrink-0 p-5 space-y-6">
                        <div className="text-center space-y-3">
                            <div className="relative inline-block">
                                <div className="w-20 h-20 rounded-[24px] bg-slate-50 mx-auto flex items-center justify-center text-4xl font-black text-slate-900 shadow-inner border border-white">
                                    {selectedConv.lead?.name?.[0] || '?'}
                                </div>
                                <div className="absolute -bottom-2 inset-x-0 flex justify-center">
                                    <div className="bg-white/90 backdrop-blur-sm border border-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                                        <Zap className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                        <span className="text-[8px] font-black uppercase tracking-wider text-slate-600">High Value</span>
                                    </div>
                                </div>
                            </div>
                            <div className="pt-2">
                                <h3 className="text-lg font-black text-slate-900 leading-tight truncate px-2">{selectedConv.lead?.name || 'Visitante'}</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{selectedConv.lead?.company_name || 'Individual'}</p>
                            </div>
                        </div>

                        <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-[20px] border border-blue-100 text-center relative overflow-hidden group">
                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1 relative z-10">IA Score</p>
                            <div className="text-3xl font-black text-blue-600 tracking-tighter relative z-10 group-hover:scale-110 transition-transform">98</div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-3">
                                <InfoItem icon={Mail} label="EMAIL" value={selectedConv.lead?.email || 'No identificado'} />
                                <InfoItem icon={PhoneIcon} label="TELÉFONO" value={selectedConv.lead?.phone || 'Sin número'} />
                            </div>
                            <button onClick={() => navigate('/leads', { state: { leadId: selectedConv.lead?.id } })} className="w-full py-3 rounded-xl border-2 border-slate-100 font-black text-[9px] uppercase tracking-widest text-slate-500 hover:border-slate-300 hover:text-slate-900 transition-all">Ver Perfil</button>
                        </div>
                    </div>
                )
            }
            {showNewChatModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tighter">Nueva Conversación</h3>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Busca un lead para chatear</p>
                            </div>
                            <button onClick={() => setShowNewChatModal(false)} className="p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-400"><CloseIcon className="w-6 h-6" /></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
                                <button
                                    onClick={() => setLeadStatusFilter('all')}
                                    className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${leadStatusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Todos
                                </button>
                                <button
                                    onClick={() => setLeadStatusFilter('prospect')}
                                    className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${leadStatusFilter === 'prospect' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Prospectos
                                </button>
                                <button
                                    onClick={() => setLeadStatusFilter('client')}
                                    className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${leadStatusFilter === 'client' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Clientes
                                </button>
                            </div>

                            <div className="relative group">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Nombre del cliente o teléfono..."
                                    value={leadSearch}
                                    onChange={(e) => searchLeads(e.target.value)}
                                    className="w-full pl-14 pr-6 py-4.5 bg-slate-50 border-2 border-transparent rounded-[20px] text-sm font-bold text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-blue-500/20 focus:ring-4 focus:ring-blue-500/5 transition-all"
                                />
                            </div>

                            <div className="max-h-[350px] overflow-y-auto custom-scrollbar space-y-2 pr-2">
                                {modalFilteredLeads.length > 0 ? (
                                    modalFilteredLeads.map(lead => (
                                        <button
                                            key={lead.id}
                                            onClick={() => startChatWithLead(lead)}
                                            className="w-full p-4 flex items-center justify-between rounded-2xl hover:bg-blue-50/50 border border-transparent hover:border-blue-100 transition-all group animate-in fade-in slide-in-from-bottom-2 duration-300"
                                        >
                                            <div className="flex items-center gap-4 text-left">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black transition-all ${lead.status === 'Cliente' ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-100 text-slate-400'} group-hover:bg-blue-500 group-hover:text-white`}>
                                                    {lead.name?.[0]}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-black text-slate-900">{lead.name}</p>
                                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${lead.status === 'Cliente' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                                            {lead.status || 'Nuevo'}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{lead.phone || 'Sin teléfono'}</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 translate-x-0 group-hover:translate-x-1 transition-all" />
                                        </button>
                                    ))
                                ) : (
                                    <div className="py-20 text-center space-y-4">
                                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto">
                                            <Search className="w-8 h-8 text-slate-200" />
                                        </div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">No se encontraron leads</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}

function InfoItem({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
    return (
        <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
                <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-0.5">{label}</p>
                <p className="text-[11px] font-bold text-slate-700 truncate">{value}</p>
            </div>
        </div>
    );
}

function FilterButton({ icon: Icon, active, onClick, activeColor = "bg-slate-900 text-white shadow-lg" }: { icon: any, active: boolean, onClick: () => void, activeColor?: string }) {
    return (
        <button
            onClick={onClick}
            className={`flex-1 h-9 rounded-lg flex items-center justify-center transition-all ${active ? activeColor : 'hover:bg-white hover:shadow-sm text-slate-400'}`}
        >
            <Icon className="w-4 h-4" />
        </button>
    );
}
