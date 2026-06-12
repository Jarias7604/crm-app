
import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    MoreVertical, Send, FileText, Smartphone, Layers,
    Paperclip, TrendingUp, Eye, Zap, Smile, Mail, Phone as PhoneIcon,
    Send as TelegramIcon, MessageSquare, Trash2, UserPlus, Search, X as CloseIcon, ChevronRight, ChevronLeft, Loader2, Mic
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { chatService, type ChatConversation, type ChatMessage } from '../../services/marketing/chatService';
import { leadsService } from '../../services/leads';
import { aiAgentService } from '../../services/marketing/aiAgentService';
import { aiQuoteService } from '../../services/marketing/aiQuoteService';
import { storageService } from '../../services/storage';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { toast } from 'react-hot-toast';

const QUICK_RESPONSES = [
    { label: "👋 Saludo", text: "Hola, ¿cómo estás? Te saluda el equipo de Arias Defense. ¿En qué podemos ayudarte hoy?" },
    { label: "💰 Cotización", text: "Hola, para poder generarte una cotización formal y personalizada, ¿podrías indicarnos tu correo electrónico y qué productos te interesan?" },
    { label: "📞 Agendar Llamada", text: "Hola, me gustaría coordinar una breve llamada de 5 minutos contigo para explicarte mejor los detalles. ¿Te queda bien hoy por la tarde?" },
    { label: "✍️ Datos", text: "¿Nos podrías facilitar tu nombre completo y teléfono de contacto para darte de alta en nuestro sistema?" }
];

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
    const [isSending, setIsSending] = useState(false);
    const [agentStatus, setAgentStatus] = useState<boolean>(false);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const location = useLocation();
    const navigate = useNavigate();
    const hasAutoSelected = useRef<string | null>(null);
    const { profile } = useAuth();
    const { isAdmin } = usePermissions();

    // 1. Initial Load + realtime new message notifications
    useEffect(() => {
        loadData();
        // Realtime: refresh conversation list when any new inbound message arrives
        const sub = chatService.subscribeToConversations(() => loadData());

        // Show toast notification for new messages from contacts NOT currently open
        const newMsgSub = supabase
            .channel('global_new_inbound_toast')
            .on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'marketing_messages'
            }, async (payload: any) => {
                const msg = payload.new;
                if (msg.direction !== 'inbound') return;
                // Only notify if not the currently open conversation
                if (selectedConv?.id === msg.conversation_id) return;

                const { data: conv } = await supabase
                    .from('marketing_conversations')
                    .select('lead_id, channel, leads(name)')
                    .eq('id', msg.conversation_id)
                    .maybeSingle();

                if (conv) {
                    const leadName = (conv as any).leads?.name || 'Nuevo contacto';
                    const channelEmoji = conv.channel === 'whatsapp' ? '📲' : '✈️';
                    toast(`${channelEmoji} Mensaje de ${leadName}`, {
                        icon: conv.channel === 'whatsapp' ? '🟢' : '🔵',
                        duration: 4000
                    });
                    loadData(); // Refresh list to update unread count
                }
            })
            .subscribe();

        return () => {
            sub.unsubscribe();
            newMsgSub.unsubscribe();
        };
    }, [selectedConv?.id]);

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
        } catch (error) {
            console.error('Error loading hub data:', error);
            setLoading(false);
        }
    };

    // 2. Auto-select logic when state or conversations change
    useEffect(() => {
        if (loading || conversations.length === 0) return;

        // If we already handled the auto-selection for this specific navigation, stop.
        if (hasAutoSelected.current === location.key) return;

        const stateConvId = location.state?.conversation_id;
        const stateLead = location.state?.lead;

        if (!stateConvId && !stateLead) {
            hasAutoSelected.current = location.key;
            return;
        }

        // Find best candidate
        let candidate: ChatConversation | undefined = undefined;
        if (stateConvId && stateConvId !== 'new') {
            candidate = conversations.find(c => c.id === stateConvId);
        }
        if (!candidate && stateLead) {
            candidate = conversations.find(c => c.lead?.id === stateLead.id);
        }

        if (candidate) {

            setSelectedConv(candidate);
            hasAutoSelected.current = location.key; // Mark as done
        } else if (stateLead) {
            // If lead provided but no conversation found in list, use a placeholder

            setSelectedConv({
                id: 'new',
                channel: location.state.channel || 'telegram',
                status: 'open',
                last_message: 'Iniciando conversación...',
                last_message_at: new Date().toISOString(),
                unread_count: 0,
                lead: stateLead
            });
            hasAutoSelected.current = location.key; // Mark as done
        }
    }, [location.key, conversations, loading]);

    // 3. Handle incoming quote for review from location state
    useEffect(() => {
        if (location.state?.newQuote) {
            setPendingQuote(location.state.newQuote);
        }
    }, [location.state]);

    // 4. Auto-load leads when modal opens
    useEffect(() => {
        if (showNewChatModal) {
            loadInitialLeads();
        }
    }, [showNewChatModal]);

    const loadInitialLeads = async () => {
        try {
            const { data } = await leadsService.getLeads(1, 40, profile?.company_id || undefined);
            setAvailableLeads(data || []);
        } catch (e) {
            console.error('Error loading initial leads:', e);
        }
    };

    const processedTriggers = useRef<Set<string>>(new Set());

    // 4. Load Messages for Selected Conversation
    useEffect(() => {
        if (selectedConv && selectedConv.id !== 'new') {
            loadMessages(selectedConv.id);
            chatService.markAsRead(selectedConv.id);
            const sub = chatService.subscribeToMessages(selectedConv.id, (msg) => {
                setMessages(prev => {
                    if (prev.find(m => m.id === msg.id)) return prev;
                    return [...prev, msg];
                });

                // If message is inbound and chat is open, mark as read automatically
                if (msg.direction === 'inbound') {
                    chatService.markAsRead(selectedConv.id);
                }
            });
            return () => { sub.unsubscribe(); };
        } else {
            setMessages([]);
        }
    }, [selectedConv?.id]);

    // --- \uD83D\uDC8E GLOBAL AUTO-QUOTE DELIVERY ENGINE ---
    // Watches ALL conversations for AI Quote Triggers and sends PDFs automatically.
    useEffect(() => {
        if (!profile?.company_id) return;


        const globalSub = supabase
            .channel('global_ai_triggers')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'marketing_messages',
                    // Filter: We listen to all inserts, then filter by company in the callback
                },
                async (payload: any) => {
                    const msg = payload.new as ChatMessage;

                    // Only process AI-Generated outbound triggers that aren't dispatched yet
                    if (msg.direction === 'outbound' && msg.metadata?.quote_trigger && !msg.metadata?.pdf_dispatched) {
                        if (processedTriggers.current.has(msg.id)) return;
                        processedTriggers.current.add(msg.id);

                        try {


                            // 1. Fetch Lead ID for this conversation if not available in message
                            const { data: conv } = await supabase
                                .from('marketing_conversations')
                                .select('lead_id, channel')
                                .eq('id', msg.conversation_id)
                                .single();

                            if (!conv?.lead_id) return;

                            // 2. Generate PDF using browser service
                            const trigger = msg.metadata.quote_trigger;
                            const result = await aiQuoteService.processAiQuote({
                                ...trigger,
                                lead_id: conv.lead_id,
                                conversation_id: msg.conversation_id,
                                company_id: profile.company_id
                            });

                            if (result.success && result.pdfUrl) {
                                // 3. Mark as dispatched
                                await chatService.updateMessageMetadata(msg.id, { pdf_dispatched: true });

                                // 4. Send the PDF Message
                                await chatService.sendMessage(
                                    msg.conversation_id,
                                    `¡Hola! Como te mencioné, aquí tienes la propuesta formal detallada para un volumen de ${trigger.dte_volume?.toLocaleString()} DTEs. ¡Quedo atento a tus dudas!`,
                                    'file',
                                    'outbound',
                                    {
                                        url: result.pdfUrl,
                                        fileName: `Propuesta_${result.quote.nombre_cliente?.replace(/\s+/g, '_') || 'Comercial'}.pdf`,
                                        isAutoGenerated: true
                                    }
                                );

                                toast.success(`Propuesta enviada automáticamente a un cliente`, { icon: '🤖' });
                            }
                        } catch (e) {
                            console.error('Global Engine Error:', e);
                            processedTriggers.current.delete(msg.id);
                        }
                    }
                }
            )
            .subscribe();

        return () => { globalSub.unsubscribe(); };
    }, [profile?.company_id]);


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

        // AUTO-TRIGGER AI BOT (Now handled by DB Trigger public.tr_ai_auto_reply for 100% reliability)
        // No client-side processing here to avoid double-messages across multiple tabs.
    }, [messages, agentStatus]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!newMessage.trim() && !pendingFile) || !selectedConv || isSending) return;

        const content = newMessage;
        setNewMessage('');
        setIsSending(true);

        try {
            let convId = selectedConv.id;

            if (convId === 'new') {
                if (!selectedConv.lead?.id) return;
                const cleanPhone = (selectedConv.lead.phone || '').replace(/\D/g, '');
                const extId = selectedConv.channel === 'whatsapp'
                    ? cleanPhone
                    : (selectedConv.channel === 'telegram' ? `notif_${selectedConv.lead.id}` : 'internal');

                const newConv = await chatService.createConversation(
                    selectedConv.lead.id,
                    selectedConv.channel,
                    selectedConv.lead.company_id,
                    extId
                );
                setSelectedConv(newConv);
                convId = newConv.id;
                setConversations(prev => [newConv, ...prev]);
            }

            if (pendingFile) {
                if (!profile?.company_id) throw new Error("Compañía no identificada");
                const path = await storageService.uploadMessageFile(profile.company_id, convId, pendingFile);
                const url = await storageService.getPublicUrl(path);
                const isImage = pendingFile.type.startsWith('image/');

                await chatService.sendMessage(
                    convId,
                    content || (isImage ? '\u200B' : ''), // Use message as caption, or invisible space if image and no text
                    isImage ? 'image' : 'file',
                    'outbound',
                    { url, fileName: pendingFile.name, fileSize: pendingFile.size }
                );
                removePendingFile();
            } else {
                await chatService.sendMessage(convId, content, 'text', 'outbound');
            }
        } catch (error: any) {
            toast.error('Error al enviar: ' + error.message);
            setNewMessage(content); // Restore message on failure
        } finally {
            setIsSending(false);
        }
    };

    const handleAiProcess = async (targetConvId?: string, providedMessage?: string) => {
        const cid = targetConvId || selectedConv?.id;
        if (!cid || !profile?.company_id) return;

        try {
            setIsAiProcessing(true);
            const result = await aiAgentService.processMessage(cid, providedMessage || '', profile.company_id);

            if (result && result.text) {
                await chatService.sendMessage(cid, result.text, 'text', 'outbound', { isAiGenerated: true });
            }

            if (result && result.quote) {
                // If AI generated a quote, set it as pending for human review
                setPendingQuote({
                    ...result.quote,
                    pdfUrl: result.pdfUrl
                });
            }
        } catch (error: any) {
            console.error('AI Error:', error);
        } finally {
            setIsAiProcessing(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedConv || !profile?.company_id) return;

        // Stage file for preview instead of sending immediately
        setPendingFile(file);
        if (file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        } else {
            setPreviewUrl(null);
        }

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removePendingFile = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPendingFile(null);
        setPreviewUrl(null);
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
            // Default to whatsapp if has phone, otherwise telegram
            const defaultChannel = lead.whatsapp_source ? 'whatsapp' : 'whatsapp';
            const placeholder: ChatConversation = {
                id: 'new',
                channel: defaultChannel,
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

            // --- FIX: Handle 'new' conversation placeholder ---
            let convId = selectedConv.id;
            if (convId === 'new') {
                if (!selectedConv.lead?.id) throw new Error("Lead ID missing");
                const cleanPhone = (selectedConv.lead.phone || '').replace(/\D/g, '');
                const extId = selectedConv.channel === 'whatsapp'
                    ? cleanPhone
                    : (selectedConv.channel === 'telegram' ? `notif_${selectedConv.lead.id}` : 'internal');

                const newConv = await chatService.createConversation(
                    selectedConv.lead.id,
                    selectedConv.channel,
                    selectedConv.lead.company_id,
                    extId
                );
                convId = newConv.id;
                setSelectedConv(newConv);
                setConversations(prev => [newConv, ...prev]);
            }

            const leadName = selectedConv.lead?.name || pendingQuote.nombre_cliente || 'Cliente';
            const professionalMessage = `Hola ${leadName}, es un gusto saludarte. Adjunto te envío la propuesta comercial profesional que preparamos para ti. Quedo atento a cualquier duda o comentario.`;

            await chatService.sendMessage(
                convId,
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
        } catch (error: any) {
            console.error('Error sending quote:', error);
            toast.error(`Error al enviar el archivo PDF: ${error.message || 'Error desconocido'}`, { id: 'send-pdf' });
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
        <div className="flex h-[calc(100vh-80px)] md:h-[calc(100vh-2rem)] md:my-4 md:mr-4 bg-[#F8FAFC] rounded-none md:rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border border-white/20 overflow-hidden font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900 relative animate-in fade-in duration-700">
            {/* Soft decorative light */}
            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-indigo-50/20 to-transparent pointer-events-none"></div>

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept="application/pdf,image/*"
            />

            {/* ===== CONVERSATION LIST — Telegram iOS Native Style ===== */}
            <div className={`w-full md:w-[380px] ${selectedConv ? 'hidden md:flex' : 'flex'} flex-col bg-[#f2f2f7] border-r border-black/5 shrink-0 relative overflow-hidden h-full`}>

                {/* HEADER */}
                <div className="px-4 pt-5 pb-2">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[13px] font-semibold text-indigo-500 cursor-pointer hover:text-indigo-700">Editar</span>
                        <h1 className="text-[18px] font-bold text-slate-900 tracking-tight">Chats</h1>
                        <button
                            onClick={() => setShowNewChatModal(true)}
                            className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-600 hover:bg-indigo-100 transition-colors"
                            title="Nueva conversación"
                        >
                            <UserPlus className="w-4 h-4" />
                        </button>
                    </div>

                    {/* SEARCH BAR */}
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar"
                            className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl text-[15px] text-slate-700 placeholder:text-slate-400 outline-none border border-black/5 shadow-sm focus:border-indigo-300 transition-all"
                        />
                    </div>

                    {/* CHANNEL FILTER PILLS */}
                    <div className="flex gap-2 mt-3 pb-1">
                        <button onClick={() => setFilter('all')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all ${ filter === 'all' ? 'bg-indigo-500 text-white shadow-sm' : 'bg-white text-slate-500 border border-black/5'}`}>
                            <Layers className="w-3 h-3" /> Todos
                        </button>
                        <button onClick={() => setFilter('whatsapp')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all ${ filter === 'whatsapp' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-white text-slate-500 border border-black/5'}`}>
                            <Smartphone className="w-3 h-3" /> WhatsApp
                        </button>
                        <button onClick={() => setFilter('telegram')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all ${ filter === 'telegram' ? 'bg-sky-500 text-white shadow-sm' : 'bg-white text-slate-500 border border-black/5'}`}>
                            <TelegramIcon className="w-3 h-3" /> Telegram
                        </button>
                    </div>
                </div>

                {/* CONVERSATION LIST */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white mt-2 rounded-t-2xl">
                    {filteredConversations.map((conv, idx) => {
                        // Generate a consistent gradient color from the name
                        const colors = [
                            'from-indigo-500 to-purple-600',
                            'from-emerald-500 to-teal-600',
                            'from-orange-400 to-pink-500',
                            'from-sky-500 to-blue-600',
                            'from-rose-500 to-red-600',
                            'from-amber-400 to-orange-500',
                            'from-violet-500 to-indigo-600',
                            'from-teal-500 to-emerald-600',
                        ];
                        const colorIdx = (conv.lead?.name?.charCodeAt(0) || 0) % colors.length;
                        const gradient = colors[colorIdx];
                        const isSelected = selectedConv?.id === conv.id;
                        return (
                            <div key={conv.id}>
                                <div
                                    onClick={() => setSelectedConv(conv)}
                                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors relative group ${ isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50' }`}
                                >
                                    {/* AVATAR */}
                                    <div className="relative shrink-0">
                                        <div className={`w-[54px] h-[54px] rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-[22px] font-bold shadow-sm`}>
                                            {conv.lead?.name?.[0]?.toUpperCase() || '?'}
                                        </div>
                                        {/* Channel badge */}
                                        <div className={`absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center ring-2 ring-white ${ conv.channel === 'telegram' ? 'bg-sky-500' : 'bg-emerald-500' }`}>
                                            {conv.channel === 'telegram'
                                                ? <TelegramIcon className="w-2.5 h-2.5 text-white" />
                                                : <Smartphone className="w-2 h-2 text-white" />}
                                        </div>
                                    </div>

                                    {/* CONTENT */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline justify-between">
                                            <h3 className="text-[16px] font-semibold text-slate-900 truncate leading-tight">
                                                {conv.lead?.name || 'Prospecto'}
                                            </h3>
                                            <span className="text-[12px] text-slate-400 ml-2 shrink-0">
                                                {formatTime(conv.last_message_at)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between mt-0.5">
                                            <p className="text-[14px] text-slate-500 truncate leading-tight">
                                                {conv.last_message
                                                    ? conv.last_message.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim() || 'Archivo'
                                                    : 'Nueva conversación'}
                                            </p>
                                            {conv.unread_count > 0 && !isSelected && (
                                                <span className="ml-2 shrink-0 min-w-[20px] h-5 px-1.5 bg-indigo-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center">
                                                    {conv.unread_count > 99 ? '99+' : conv.unread_count}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Delete button (admin) */}
                                    {isAdmin() && (
                                        <button
                                            onClick={(e) => handleDeleteConversation(e, conv.id)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                                {/* Separator */}
                                {idx < filteredConversations.length - 1 && (
                                    <div className="ml-[76px] h-px bg-black/5" />
                                )}
                            </div>
                        );
                    })}
                    {filteredConversations.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                                <MessageSquare className="w-8 h-8 text-slate-300" />
                            </div>
                            <p className="text-[13px] font-semibold text-slate-400">Sin conversaciones</p>
                        </div>
                    )}
                </div>
            </div>

            <div className={`flex-1 ${selectedConv ? 'flex' : 'hidden md:flex'} flex-col bg-[#e5ddd5] rounded-none md:rounded-[32px] overflow-hidden relative isolate min-h-0`}>

                {selectedConv ? (
                    <>
                        {/* HEADER — Telegram/WhatsApp native style */}
                        <header className="px-3 md:px-5 py-3 flex items-center justify-between bg-[#1f2937] sticky top-0 z-30 shrink-0">
                            <div className="flex items-center gap-2 md:gap-4 min-w-0">
                                <button
                                    onClick={() => setSelectedConv(null)}
                                    className="md:hidden p-1.5 rounded-full text-white/70 hover:text-white transition-colors shrink-0"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <div className="relative shrink-0">
                                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg font-black shadow-lg overflow-hidden">
                                        {selectedConv.lead?.name?.[0]}
                                    </div>
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-[#1f2937] rounded-full" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-[15px] md:text-[17px] font-bold text-white tracking-tight truncate max-w-[140px] sm:max-w-[240px]">{selectedConv.lead?.name}</h2>
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${selectedConv.channel === 'whatsapp' ? 'bg-emerald-500/20 text-emerald-400' : selectedConv.channel === 'telegram' ? 'bg-sky-500/20 text-sky-400' : 'bg-indigo-500/20 text-indigo-400'}`}>{selectedConv.channel}</span>
                                    </div>
                                    <p className="text-[11px] text-white/50 font-medium mt-0.5 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block" /> en línea
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-1.5 items-center shrink-0">
                                {selectedConv.lead?.phone && (
                                    <>
                                        <a
                                            href={`tel:${selectedConv.lead.phone}`}
                                            className="h-9 w-9 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-all"
                                            title="Llamar"
                                        >
                                            <PhoneIcon className="w-4 h-4" />
                                        </a>
                                        <a
                                            href={`https://wa.me/${selectedConv.lead.phone.replace(/\D/g, '')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="h-9 w-9 flex items-center justify-center rounded-full text-emerald-400 hover:text-white hover:bg-emerald-500/20 transition-all"
                                            title="WhatsApp"
                                        >
                                            <Smartphone className="w-4 h-4" />
                                        </a>
                                    </>
                                )}
                                <button
                                    onClick={() => handleAiProcess()}
                                    disabled={isAiProcessing || !agentStatus}
                                    title="IA"
                                    className={`h-9 w-9 flex items-center justify-center rounded-full transition-all ${isAiProcessing ? 'text-white/20' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
                                >
                                    <Zap className={`w-4 h-4 ${isAiProcessing ? 'animate-pulse' : ''}`} />
                                </button>
                                <button
                                    onClick={() => navigate('/cotizaciones/nueva-pro', { state: { lead: selectedConv.lead, conversation_id: selectedConv.id, fromChat: true } })}
                                    className="h-9 px-3 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all flex items-center gap-1.5"
                                >
                                    <TrendingUp className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Cotizar</span>
                                </button>
                                <div className="relative group">
                                    <button
                                        onClick={() => setShowDetails(!showDetails)}
                                        className="w-9 h-9 rounded-full flex items-center justify-center transition-all text-white/60 hover:text-white hover:bg-white/10"
                                    >
                                        <MoreVertical className="w-4 h-4" />
                                    </button>
                                    <div className="absolute top-12 right-0 w-48 bg-[#1f2937] rounded-xl shadow-2xl border border-white/10 p-1 hidden group-hover:block z-50">
                                        {isAdmin() && (
                                            <button
                                                onClick={(e) => handleDeleteConversation(e, selectedConv.id)}
                                                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-[11px] font-bold text-red-400 hover:bg-red-500/10 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                ELIMINAR CHAT
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </header>

                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto px-3 md:px-5 py-5 space-y-2 custom-scrollbar scroll-smooth relative"
                            style={{
                                backgroundColor: selectedConv.channel === 'whatsapp' ? '#e5ddd5' : selectedConv.channel === 'telegram' ? '#e6ebee' : '#eef2ff',
                                backgroundImage: selectedConv.channel === 'whatsapp'
                                    ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Cg opacity='0.06' fill='%23000'%3E%3Ccircle cx='50' cy='50' r='4'/%3E%3Ccircle cx='150' cy='80' r='3'/%3E%3Ccircle cx='280' cy='40' r='5'/%3E%3Ccircle cx='350' cy='120' r='3'/%3E%3Ccircle cx='80' cy='180' r='4'/%3E%3Ccircle cx='220' cy='160' r='3'/%3E%3Ccircle cx='320' cy='200' r='4'/%3E%3Ccircle cx='40' cy='270' r='3'/%3E%3Ccircle cx='180' cy='300' r='5'/%3E%3Ccircle cx='310' cy='280' r='3'/%3E%3Ccircle cx='100' cy='350' r='4'/%3E%3Ccircle cx='250' cy='370' r='3'/%3E%3C/g%3E%3C/svg%3E")`
                                    : 'none'
                            }}
                        >
                            {/* SVG wallpaper overlay for WhatsApp / Telegram native feeling */}
                            {selectedConv.channel === 'whatsapp' && (
                                <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath fill-rule='evenodd' d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zM11 61c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm7-43c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm0 43c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm-7-25c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm35-25c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm0 57c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm18-18c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm-36-7c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zm18 18c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zm18-18c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z'/%3E%3C/g%3E%3C/svg%3E\")" }} />
                            )}
                            {selectedConv.channel === 'telegram' && (
                                <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M30 30c2-5 5-8 10-10-5-2-8-5-10-10-2 5-5 8-10 10 5 2 8 5 10 10zm0 0c2 5 5 8 10 10-5 2-8 5-10 10-2-5-5-8-10-10 5-2 8-5 10-10z'/%3E%3C/g%3E%3C/svg%3E\")" }} />
                            )}

                            {messages.map((msg, idx) => (
                                <div key={msg.id || idx} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'} group w-full animate-in fade-in slide-in-from-bottom-2 duration-300 relative z-10`}>
                                    <div className={`flex flex-col gap-1 ${msg.direction === 'outbound' ? 'items-end' : 'items-start'} max-w-[85%] md:max-w-[75%]`}>
                                        <div className={`px-4 py-2.5 rounded-2xl shadow-sm relative ${
                                            msg.direction === 'outbound'
                                                ? (selectedConv.channel === 'whatsapp'
                                                    ? 'bg-[#d9fdd3] text-slate-800 rounded-tr-sm'
                                                    : selectedConv.channel === 'telegram'
                                                        ? 'bg-[#effdde] text-slate-800 rounded-tr-sm'
                                                        : 'bg-indigo-100 text-slate-800 rounded-tr-sm')
                                                : 'bg-white text-slate-800 rounded-tl-sm shadow-sm'
                                        }`}>
                                            <div className="text-[15px] font-normal leading-[1.5] pr-14 pb-1 relative">
                                                {msg.content.startsWith('__QUOTE__') ? (
                                                    <div className="w-fit max-w-[80%] min-w-[200px] mb-1">
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
                                                    <div className="flex flex-col gap-2 mb-1">
                                                        <img src={msg.metadata.url} className="rounded-xl max-w-full cursor-pointer hover:opacity-98 transition-all shadow-sm border border-black/5" onClick={() => window.open(msg.metadata.url)} />
                                                        {msg.content && <p className="text-[13px] px-1 pb-1 opacity-90">{msg.content}</p>}
                                                    </div>
                                                ) : msg.type === 'file' ? (
                                                    <a href={msg.metadata?.url} target="_blank" className="flex items-center gap-3 p-1.5 group/file w-full mb-1">
                                                        <div className="w-9 h-9 rounded-xl bg-slate-800/10 flex items-center justify-center text-slate-700 shrink-0"><Paperclip className="w-4.5 h-4.5" /></div>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-[13px] truncate">{msg.metadata?.fileName || 'Archivo'}</span>
                                                            <span className="text-[10px] opacity-70">Haz clic para descargar</span>
                                                        </div>
                                                    </a>
                                                ) : (msg.type as string) === 'voice' || (msg.type as string) === 'audio' ? (
                                                    <div className="flex flex-col gap-2 min-w-[240px] mb-1">
                                                        <div className="flex items-center gap-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200/50 backdrop-blur-sm">
                                                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
                                                                <PhoneIcon className="w-5 h-5" />
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className="text-[9px] font-black uppercase text-indigo-600/60 tracking-widest mb-0.5">
                                                                    {(msg.metadata?.is_voice || (msg.type as string) === 'voice') ? 'Nota de Voz' : 'Audio Recibido'}
                                                                </p>
                                                                <p className="text-xs font-bold text-slate-700">Telegram Channel</p>
                                                            </div>
                                                            {msg.metadata?.duration && (
                                                                <span className="text-[10px] font-mono bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100/50">
                                                                    {msg.metadata.duration}s
                                                                </span>
                                                            )}
                                                        </div>
                                                        {msg.metadata?.transcription ? (
                                                            <div className="bg-white/60 p-3 rounded-xl border border-indigo-100/50 italic text-[13px] text-slate-600 leading-relaxed shadow-sm relative overflow-hidden group/transcription">
                                                                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/20" />
                                                                "{msg.metadata.transcription}"
                                                            </div>
                                                        ) : (
                                                            <div className="bg-slate-50/30 p-2 rounded-lg border border-dashed border-slate-200 text-center">
                                                                <span className="text-[10px] text-slate-400 font-medium">Procesando transcripción...</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) :
                                                    selectedConv.channel === 'email' || msg.content.includes('</') ? (
                                                        <div
                                                            className={`prose prose-sm max-w-none break-words ${msg.direction === 'outbound' && selectedConv.channel === 'email' ? 'text-slate-900' : msg.direction === 'outbound' ? 'text-white' : 'text-slate-700'}`}
                                                            dangerouslySetInnerHTML={{ __html: msg.content }}
                                                        />
                                                    ) : (
                                                        msg.content
                                                    )}

                                                {/* DELETE BUTTON FOR ADMINS */}
                                                {isAdmin() && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg.id); }}
                                                        className={`absolute -top-3.5 ${msg.direction === 'outbound' ? '-left-8' : '-right-8'} p-1 rounded-full bg-white text-slate-400 hover:text-red-500 hover:bg-slate-50 opacity-0 group-hover:opacity-100 transition-all shadow-sm border border-slate-100 z-10`}
                                                        title="Eliminar mensaje"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                )}

                                                {/* NATIVE TIME & DOUBLE CHECK MARK ALIGNED INSIDE BUBBLE */}
                                                <div className={`absolute bottom-1 right-2 flex items-center gap-0.5 text-[10px] select-none pointer-events-none ${msg.direction === 'outbound' ? 'text-slate-500' : 'text-slate-400'}`}>
                                                    <span>{formatTime(msg.sent_at)}</span>
                                                    {msg.direction === 'outbound' && (
                                                        <span className="flex shrink-0">
                                                            {selectedConv.channel === 'whatsapp' ? (
                                                                <svg className="w-3.5 h-3.5 text-sky-500" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M1 5.5L5 9.5L14 1.5" />
                                                                    <path d="M5 5.5L8 8.5" />
                                                                </svg>
                                                            ) : selectedConv.channel === 'telegram' ? (
                                                                <svg className="w-3.5 h-3.5 text-sky-300" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M1 5.5L5 9.5L14 1.5" />
                                                                    <path d="M5 5.5L8 8.5" />
                                                                </svg>
                                                            ) : (
                                                                <svg className="w-3 h-3 text-current" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M1 5.5L5 9.5L14 1.5" />
                                                                </svg>
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
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

                        {/* INPUT BAR — Telegram native style */}
                        <div className="px-3 pb-3 pt-2 bg-[#f2f2f7] border-t border-black/5">
                            {/* QUICK SUGGESTIONS */}
                            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                                {QUICK_RESPONSES.map((resp, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => setNewMessage(resp.text)}
                                        className="shrink-0 px-3 py-1 bg-white border border-black/8 text-slate-600 rounded-full text-[12px] font-medium transition-all active:scale-95 shadow-sm hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200"
                                    >
                                        {resp.label}
                                    </button>
                                ))}
                            </div>

                            {/* FILE PREVIEW */}
                            {pendingFile && (
                                <div className="mb-2 animate-in slide-in-from-bottom-2 duration-300">
                                    <div className="relative inline-block">
                                        <div className="bg-white rounded-2xl border border-black/8 p-2 shadow-sm overflow-hidden">
                                            {previewUrl ? (
                                                <img src={previewUrl} className="h-28 w-auto rounded-xl object-contain" alt="Preview" />
                                            ) : (
                                                <div className="h-16 w-44 flex items-center gap-3 px-3">
                                                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                                                        <FileText className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[12px] font-semibold text-slate-800 truncate">{pendingFile.name}</p>
                                                        <p className="text-[11px] text-slate-400">{(pendingFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={removePendingFile}
                                            className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-slate-700 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-500 transition-colors z-10"
                                        >
                                            <CloseIcon className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* MESSAGE INPUT ROW */}
                            <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                                {/* Attachment */}
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-white border border-black/8 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm mb-0.5"
                                >
                                    <Paperclip className="w-4 h-4" />
                                </button>

                                {/* Pill Input */}
                                <div className="flex-1 bg-white rounded-[22px] border border-black/8 shadow-sm flex items-end px-4 py-2 gap-2 min-h-[44px]">
                                    <textarea
                                        value={newMessage}
                                        onChange={e => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e as any); } }}
                                        placeholder="Mensaje"
                                        className="flex-1 bg-transparent text-[16px] text-slate-800 outline-none resize-none max-h-32 custom-scrollbar placeholder:text-slate-400 leading-snug self-center"
                                        rows={1}
                                    />
                                    <button type="button" className="text-slate-400 hover:text-amber-500 transition-colors shrink-0 mb-0.5">
                                        <Smile className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Send / Mic */}
                                <button
                                    type="submit"
                                    disabled={((!newMessage.trim() && !pendingFile) || isSending)}
                                    className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-full transition-all shadow-sm mb-0.5 ${
                                        newMessage.trim() || pendingFile
                                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-indigo-200'
                                            : 'bg-white border border-black/8 text-slate-400 hover:text-indigo-600'
                                    }`}
                                >
                                    {isSending
                                        ? <Loader2 className="w-5 h-5 animate-spin" />
                                        : newMessage.trim() || pendingFile
                                        ? <Send className="w-4 h-4" />
                                        : <Mic className="w-4 h-4" />}
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

            {selectedConv && showDetails && (
                <div className="hidden lg:flex w-[260px] bg-white rounded-[32px] border border-slate-100 shadow-sm flex-col overflow-y-auto shrink-0 p-5 space-y-6">
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
            )}

            {showNewChatModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300" style={{ width: '700px', height: '650px', maxWidth: '95vw', display: 'flex', flexDirection: 'column' }}>
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tighter">Nueva Conversación</h3>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Busca un lead para chatear</p>
                            </div>
                            <button onClick={() => setShowNewChatModal(false)} className="p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-400"><CloseIcon className="w-6 h-6" /></button>
                        </div>
                        <div className="p-8 space-y-6 flex-1 flex flex-col min-h-0">
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

                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
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
        </div>
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
