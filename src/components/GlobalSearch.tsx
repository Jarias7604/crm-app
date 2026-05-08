import React, { useState, useEffect, useRef } from 'react';
import { Search, Command, X, ArrowRight, Loader2, Building2, Phone, Mail, Sparkles, TrendingUp, TrendingDown, Activity, AlertTriangle, CalendarCheck, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { leadsService } from '../services/leads';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../types';
import { useDebounce } from '../hooks/useDebounce';
import { supabase } from '../services/supabase';
import { toast } from 'react-hot-toast';

export function GlobalSearch() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();

    // Debounce the search query to avoid spamming the database while typing
    const debouncedQuery = useDebounce(query, 300);

    const isAiMode = debouncedQuery.startsWith('/ai') || query.startsWith('/ai');
    const [aiResult, setAiResult] = useState<{ message: string; suggestedAction?: any } | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);

    const { data: results, isLoading } = useQuery({
        queryKey: ['global-search', debouncedQuery],
        queryFn: async () => {
            if (isAiMode || debouncedQuery.trim().length < 2) return [];
            return await leadsService.searchLeads(debouncedQuery, 7);
        },
        enabled: isOpen && !isAiMode && debouncedQuery.trim().length >= 2,
        staleTime: 1000 * 60, // 1 minute cache
    });

    const handleAiSubmit = async () => {
        if (!query.trim()) return;
        setIsAiLoading(true);
        setAiResult(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session?.user?.id).single();
            
            const { data, error } = await supabase.functions.invoke('dashboard-ai-agent', {
                body: { prompt: query, companyId: profile?.company_id }
            });

            if (error) throw error;
            setAiResult(data);
        } catch (err: any) {
            console.error('Error calling AI Agent:', err);
            toast.error('Hubo un error contactando a Sofía.');
        } finally {
            setIsAiLoading(false);
        }
    };

    const executeAction = async (action: any) => {
        try {
            toast.loading('Ejecutando acción...', { id: 'ai-action' });
            
            const { data: { session } } = await supabase.auth.getSession();
            const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', session?.user?.id).single();
            const companyId = profile?.company_id;

            if (action.type === 'send_email' || action.type === 'send_whatsapp' || action.type === 'send_telegram') {
                const channel = action.type.split('_')[1]; // email, whatsapp, telegram
                const targetIds = action.targetLeadIds || [];
                
                if (targetIds.length === 0) throw new Error('No hay destinatarios seleccionados.');

                const messages = targetIds.map((leadId: string) => ({
                    campaign_id: '00000000-0000-0000-0000-000000000000', // AI ad-hoc messages
                    company_id: companyId,
                    lead_id: leadId,
                    channel: channel,
                    content: action.draftBody,
                    subject: action.draftSubject || undefined,
                    status: 'pending',
                    scheduled_at: new Date().toISOString()
                }));

                const { error } = await supabase.from('marketing_message_queue').insert(messages);
                if (error) throw error;
                
                toast.success(`¡Enviados ${targetIds.length} mensajes a la cola!`, { id: 'ai-action' });
            } else {
                toast.success('¡Acción completada!', { id: 'ai-action' });
            }

            setAiResult(null);
            setQuery('');
        } catch (err: any) {
            console.error('Action error:', err);
            toast.error('Error al ejecutar la acción: ' + err.message, { id: 'ai-action' });
        }
    };

    // Keyboard shortcut to open (Cmd+K or Ctrl+K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(open => !open);
            }
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };
        
        const handleCustomEvent = () => setIsOpen(true);

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('open-global-search', handleCustomEvent);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('open-global-search', handleCustomEvent);
        };
    }, [isOpen]);

    // Handle open/close side-effects
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 100);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    // Keyboard navigation inside the results
    useEffect(() => {
        if (!isOpen || !results || results.length === 0) return;

        const handleNav = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % results.length);
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                if (isAiMode && query.trim().length > 0) {
                    handleAiSubmit();
                    return;
                }
                const lead = results?.[selectedIndex];
                if (lead) {
                    setIsOpen(false);
                    // Navigate to Leads page and open the specific lead
                    navigate(`/leads?id=${lead.id}`);
                }
            }
        };

        window.addEventListener('keydown', handleNav);
        return () => window.removeEventListener('keydown', handleNav);
    }, [isOpen, results, selectedIndex, navigate]);

    if (!isOpen) return null;

    const displayResults = results || [];

    return (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] sm:pt-[15vh] px-4">
            {/* Backdrop with strong blur */}
            <div 
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity"
                onClick={() => setIsOpen(false)}
            />

            {/* Modal */}
            <div className="relative w-full max-w-2xl bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 overflow-hidden ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200">
                {/* Search Header */}
                <div className="relative flex items-center px-4 py-4 border-b border-gray-100">
                    <Search className="w-6 h-6 text-indigo-500 shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        className="flex-1 bg-transparent border-0 focus:ring-0 text-lg font-medium text-gray-900 placeholder-gray-400 px-4 w-full outline-none"
                        placeholder="Busca un lead o pregunta a la IA usando /ai ..."
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setSelectedIndex(0);
                            if (!e.target.value.startsWith('/ai')) {
                                setAiResult(null);
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && isAiMode) {
                                e.preventDefault();
                                handleAiSubmit();
                            }
                        }}
                    />
                    {isAiMode && !isAiLoading && (
                        <button
                            onClick={handleAiSubmit}
                            className="mr-3 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                        >
                            Preguntar <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    )}
                    {isLoading && debouncedQuery.length >= 2 && !isAiMode && (
                        <Loader2 className="w-5 h-5 text-gray-400 animate-spin absolute right-16" />
                    )}
                    <button 
                        onClick={() => setIsOpen(false)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600 shrink-0"
                    >
                        <span className="sr-only">Cerrar</span>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Results Area */}
                <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
                    {(isLoading || isAiLoading) && (debouncedQuery.length >= 2 || isAiMode) ? (
                        <div className="p-12 text-center flex flex-col items-center justify-center">
                            <div className="relative">
                                {isAiMode && <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full animate-pulse" />}
                                <Loader2 className={`w-10 h-10 animate-spin relative z-10 ${isAiMode ? 'text-purple-500' : 'text-indigo-500'}`} />
                            </div>
                            <p className="mt-4 font-bold text-gray-900">{isAiMode ? 'Sofía está pensando...' : 'Buscando...'}</p>
                            {isAiMode && <p className="text-xs text-gray-500 mt-1">Analizando tu base de datos en tiempo real...</p>}
                        </div>
                    ) : isAiMode && aiResult ? (
                        <div className="p-6">
                            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl p-6 shadow-inner relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl" />
                                
                                <div className="flex items-start gap-4 relative z-10">
                                    <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/30">
                                        <Sparkles className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="space-y-4 flex-1">
                                        <div>
                                            <h3 className="text-sm font-black uppercase tracking-wider mb-1 text-purple-900">
                                                Sofía AI - Operations Manager
                                            </h3>
                                            <p className="text-gray-800 font-medium leading-relaxed">
                                                {aiResult.message}
                                            </p>
                                        </div>

                                        {aiResult.suggestedAction && aiResult.suggestedAction.type !== 'none' && (
                                            <div className="mt-4 bg-white/80 rounded-xl p-4 border border-purple-100/50 shadow-sm">
                                                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                                    <Command className="w-3.5 h-3.5" /> Borrador Sugerido
                                                </p>
                                                {aiResult.suggestedAction.draftSubject && (
                                                    <p className="text-sm font-bold text-gray-900 mb-1">
                                                        Asunto: {aiResult.suggestedAction.draftSubject}
                                                    </p>
                                                )}
                                                <p className="text-sm text-gray-600 mb-4 whitespace-pre-wrap">
                                                    {aiResult.suggestedAction.draftBody}
                                                </p>
                                                <button
                                                    onClick={() => executeAction(aiResult.suggestedAction)}
                                                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                                                >
                                                    Ejecutar Acción ({aiResult.suggestedAction.targetLeadIds?.length || 0} leads)
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : query.trim().length < 2 ? (
                        <div className="p-12 text-center text-gray-500">
                            <Command className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="font-medium text-gray-900">Empieza a escribir para buscar</p>
                            <p className="text-sm mt-1">Soportamos búsquedas de texto e <span className="font-bold text-purple-500">Insights con IA (ej: "/ai resumen")</span>.</p>
                        </div>
                    ) : isAiMode && !aiResult ? (
                        <div className="p-12 text-center flex flex-col items-center justify-center bg-gradient-to-b from-transparent to-purple-50/30">
                            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 relative overflow-hidden">
                                <div className="absolute inset-0 bg-purple-500/20 blur-md animate-pulse" />
                                <Sparkles className="w-8 h-8 text-purple-600 relative z-10" />
                            </div>
                            <p className="text-gray-900 font-black text-lg">Modo Sofía AI Activado</p>
                            <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">
                                Presiona <kbd className="px-2 py-1 bg-white border border-gray-200 rounded-md text-xs font-mono font-bold mx-1 shadow-sm">Enter</kbd> para enviarle tu instrucción operativa.
                            </p>
                        </div>
                    ) : debouncedQuery.length >= 2 && results?.length === 0 && !isAiMode ? (
                        <div className="p-12 text-center">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Search className="w-8 h-8 text-gray-300" />
                            </div>
                            <p className="text-gray-500 font-medium">No encontramos resultados para "{query}"</p>
                            <p className="text-sm text-gray-400 mt-1">Revisa la ortografía o intenta con otro término.</p>
                        </div>
                    ) : (
                        <div className="p-2 space-y-1">
                            {displayResults.map((lead, idx) => {
                                const isSelected = idx === selectedIndex;
                                const statusConfig = STATUS_CONFIG[lead.status] || STATUS_CONFIG['Prospecto'];
                                const priorityConfig = PRIORITY_CONFIG[lead.priority] || PRIORITY_CONFIG['medium'];

                                return (
                                    <div 
                                        key={lead.id}
                                        onMouseEnter={() => setSelectedIndex(idx)}
                                        onClick={() => {
                                            setIsOpen(false);
                                            navigate(`/leads?id=${lead.id}`);
                                        }}
                                        className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                                            isSelected 
                                                ? 'bg-indigo-50 border-indigo-100 ring-1 ring-indigo-500/20 shadow-sm' 
                                                : 'hover:bg-gray-50 border-transparent'
                                        } border`}
                                    >
                                        <div className="flex flex-col gap-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-900 truncate">
                                                    {lead.name}
                                                </span>
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
                                                    {statusConfig.label}
                                                </span>
                                            </div>
                                            
                                            <div className="flex items-center gap-4 text-xs font-medium text-gray-500">
                                                {lead.company_name && (
                                                    <div className="flex items-center gap-1.5 truncate">
                                                        <Building2 className="w-3.5 h-3.5 text-gray-400" />
                                                        <span className="truncate">{lead.company_name}</span>
                                                    </div>
                                                )}
                                                {lead.email && (
                                                    <div className="flex items-center gap-1.5 truncate">
                                                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                                                        <span className="truncate">{lead.email}</span>
                                                    </div>
                                                )}
                                                {lead.phone && (
                                                    <div className="flex items-center gap-1.5 truncate">
                                                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                                                        <span>{lead.phone}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 shrink-0 pl-4">
                                            <div className="text-right">
                                                <div className="text-sm font-bold text-gray-900">
                                                    ${(lead.value || 0).toLocaleString()}
                                                </div>
                                                <div className="flex items-center justify-end gap-1 mt-0.5">
                                                    <span className={`w-2 h-2 rounded-full ${priorityConfig.color}`} />
                                                    <span className="text-[10px] uppercase font-bold text-gray-400">
                                                        {priorityConfig.label}
                                                    </span>
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <ArrowRight className="w-5 h-5 text-indigo-500 animate-in slide-in-from-left-2" />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer hints */}
                <div className="bg-gray-50/80 px-4 py-3 flex items-center justify-between border-t border-gray-100 text-xs font-medium text-gray-500">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5">
                            <kbd className="bg-white border border-gray-200 rounded px-1.5 py-0.5 font-sans font-semibold text-gray-700 shadow-sm">↑</kbd>
                            <kbd className="bg-white border border-gray-200 rounded px-1.5 py-0.5 font-sans font-semibold text-gray-700 shadow-sm">↓</kbd>
                            <span>Navegar</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                            <kbd className="bg-white border border-gray-200 rounded px-1.5 py-0.5 font-sans font-semibold text-gray-700 shadow-sm">Enter</kbd>
                            <span>Abrir</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <kbd className="bg-white border border-gray-200 rounded px-1.5 py-0.5 font-sans font-semibold text-gray-700 shadow-sm">Esc</kbd>
                        <span>Cerrar</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
