import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ArrowRight, Loader2, Building2, Phone, Mail, Sparkles, Command } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { leadsService } from '../services/leads';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../types';
import { useDebounce } from '../hooks/useDebounce';
import { supabase } from '../services/supabase';
import { toast } from 'react-hot-toast';

type Mode = 'search' | 'ai';

export function GlobalSearch() {
    const [isOpen, setIsOpen] = useState(false);
    const [mode, setMode] = useState<Mode>('search');
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [aiResult, setAiResult] = useState<{ message: string; suggestedAction?: any } | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();
    const debouncedQuery = useDebounce(query, 300);

    const { data: results, isLoading } = useQuery({
        queryKey: ['global-search', debouncedQuery, mode],
        queryFn: async () => {
            if (mode === 'ai' || debouncedQuery.trim().length < 2) return [];
            return await leadsService.searchLeads(debouncedQuery, 7);
        },
        enabled: isOpen && mode === 'search' && debouncedQuery.trim().length >= 2,
        staleTime: 1000 * 60,
    });

    const handleAiSubmit = async () => {
        const trimmed = query.trim();
        if (!trimmed) return;
        setIsAiLoading(true);
        setAiResult(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) throw new Error('No hay sesión activa. Por favor inicia sesión.');

            const { data: profile } = await supabase
                .from('profiles')
                .select('company_id')
                .eq('id', session.user.id)
                .single();

            if (!profile?.company_id) throw new Error('No se encontró la empresa asociada a tu cuenta.');

            const { data, error } = await supabase.functions.invoke('dashboard-ai-agent', {
                body: { prompt: trimmed, companyId: profile.company_id }
            });

            if (error) throw new Error(error.message);
            if (data?.error) throw new Error(data.error);

            setAiResult(data);
        } catch (err: any) {
            console.error('AI Agent Error:', err);
            toast.error(err.message || 'Error contactando a Sofía. Intenta de nuevo.');
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
                const channel = action.type.split('_')[1];
                const targetIds: string[] = action.targetLeadIds || [];
                if (targetIds.length === 0) throw new Error('No hay destinatarios seleccionados.');

                const messages = targetIds.map((leadId: string) => ({
                    campaign_id: null,
                    company_id: companyId,
                    lead_id: leadId,
                    channel,
                    content: action.draftBody,
                    subject: action.draftSubject || undefined,
                    status: 'pending',
                    scheduled_at: new Date().toISOString()
                }));

                const { error } = await supabase.from('marketing_message_queue').insert(messages);
                if (error) throw error;

                toast.success(`¡${targetIds.length} mensajes enviados a la cola!`, { id: 'ai-action' });
            } else {
                toast.success('¡Acción completada!', { id: 'ai-action' });
            }

            setAiResult(null);
            setQuery('');
        } catch (err: any) {
            console.error('Execute action error:', err);
            toast.error('Error: ' + err.message, { id: 'ai-action' });
        }
    };

    // Open/close shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape' && isOpen) setIsOpen(false);
        };
        const handleCustomEvent = () => setIsOpen(true);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('open-global-search', handleCustomEvent);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('open-global-search', handleCustomEvent);
        };
    }, [isOpen]);

    // Focus when open
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setAiResult(null);
            setMode('search');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 100);
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    // Enter to navigate in search mode
    useEffect(() => {
        if (!isOpen || mode !== 'search') return;
        const handleNav = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => (prev + 1) % (results?.length || 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => (prev - 1 + (results?.length || 1)) % (results?.length || 1)); }
            if (e.key === 'Enter') {
                const lead = results?.[selectedIndex];
                if (lead) { setIsOpen(false); navigate(`/leads?id=${lead.id}`); }
            }
        };
        window.addEventListener('keydown', handleNav);
        return () => window.removeEventListener('keydown', handleNav);
    }, [isOpen, results, selectedIndex, navigate, mode]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[8vh] sm:pt-[12vh] px-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-900/50 backdrop-blur-md"
                onClick={() => setIsOpen(false)}
            />

            {/* Modal */}
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">

                {/* Mode Tabs */}
                <div className="flex items-center border-b border-gray-100 bg-gray-50">
                    <button
                        onClick={() => { setMode('search'); setAiResult(null); }}
                        className={`flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all border-b-2 ${mode === 'search' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-gray-400 hover:text-gray-700'}`}
                    >
                        <Search className="w-4 h-4" />
                        Buscar Lead
                    </button>
                    <button
                        onClick={() => { setMode('ai'); setQuery(''); setAiResult(null); setTimeout(() => inputRef.current?.focus(), 50); }}
                        className={`flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all border-b-2 ${mode === 'ai' ? 'border-purple-600 text-purple-600 bg-white' : 'border-transparent text-gray-400 hover:text-gray-700'}`}
                    >
                        <Sparkles className="w-4 h-4" />
                        Sofía AI
                    </button>
                </div>

                {/* Input */}
                <div className="flex items-center px-4 py-4 border-b border-gray-100">
                    {mode === 'search'
                        ? <Search className="w-5 h-5 text-indigo-400 shrink-0" />
                        : <Sparkles className="w-5 h-5 text-purple-500 shrink-0 animate-pulse" />
                    }
                    <input
                        ref={inputRef}
                        type="text"
                        className="flex-1 bg-transparent border-0 focus:ring-0 text-lg font-medium text-gray-900 placeholder-gray-400 px-3 outline-none"
                        placeholder={mode === 'search' ? 'Busca un lead por nombre, email o teléfono...' : 'Pregúntame algo... ej: ¿Cuántos seguimientos tengo hoy?'}
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setSelectedIndex(0);
                            if (aiResult) setAiResult(null);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && mode === 'ai') {
                                e.preventDefault();
                                handleAiSubmit();
                            }
                        }}
                    />
                    {mode === 'ai' && !isAiLoading && query.trim().length > 0 && (
                        <button
                            onClick={handleAiSubmit}
                            className="ml-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2 shrink-0"
                        >
                            Preguntar <ArrowRight className="w-4 h-4" />
                        </button>
                    )}
                    {isLoading && mode === 'search' && (
                        <Loader2 className="w-5 h-5 text-gray-400 animate-spin shrink-0" />
                    )}
                    <button
                        onClick={() => setIsOpen(false)}
                        className="ml-2 p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600 shrink-0"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Results */}
                <div className="max-h-[55vh] overflow-y-auto">
                    {/* AI Mode */}
                    {mode === 'ai' && (
                        <>
                            {isAiLoading ? (
                                <div className="p-12 text-center flex flex-col items-center">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full animate-pulse" />
                                        <Loader2 className="w-10 h-10 animate-spin text-purple-500 relative z-10" />
                                    </div>
                                    <p className="mt-4 font-bold text-gray-900">Sofía está pensando...</p>
                                    <p className="text-xs text-gray-400 mt-1">Analizando tu base de datos en tiempo real...</p>
                                </div>
                            ) : aiResult ? (
                                <div className="p-5">
                                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl p-5 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl" />
                                        <div className="flex items-start gap-4 relative z-10">
                                            <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/30">
                                                <Sparkles className="w-5 h-5 text-white" />
                                            </div>
                                            <div className="flex-1 space-y-4">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-1">Sofía AI — Operations Manager</p>
                                                    <p className="text-gray-800 font-medium leading-relaxed whitespace-pre-wrap">{aiResult.message}</p>
                                                </div>
                                                {aiResult.suggestedAction && aiResult.suggestedAction.type !== 'none' && (
                                                    <div className="bg-white rounded-xl p-4 border border-purple-100 shadow-sm">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-1.5">
                                                            <Command className="w-3.5 h-3.5" /> Borrador de Mensaje
                                                        </p>
                                                        {aiResult.suggestedAction.draftSubject && (
                                                            <p className="text-sm font-bold text-gray-900 mb-1">
                                                                Asunto: {aiResult.suggestedAction.draftSubject}
                                                            </p>
                                                        )}
                                                        <p className="text-sm text-gray-600 mb-4 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">
                                                            {aiResult.suggestedAction.draftBody}
                                                        </p>
                                                        <button
                                                            onClick={() => executeAction(aiResult.suggestedAction)}
                                                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                                                        >
                                                            <ArrowRight className="w-4 h-4" />
                                                            Ejecutar — Enviar a {aiResult.suggestedAction.targetLeadIds?.length || 0} lead(s)
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { setAiResult(null); setQuery(''); setTimeout(() => inputRef.current?.focus(), 50); }}
                                        className="mt-3 w-full text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
                                    >
                                        ← Nueva pregunta
                                    </button>
                                </div>
                            ) : (
                                <div className="p-10 text-center">
                                    <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <Sparkles className="w-7 h-7 text-purple-500" />
                                    </div>
                                    <p className="font-black text-gray-900 text-lg">Sofía está lista</p>
                                    <p className="text-sm text-gray-400 mt-2 max-w-sm mx-auto">Escribe tu pregunta arriba y presiona <strong>Enter</strong> o el botón <strong>"Preguntar"</strong>.</p>
                                    <div className="mt-5 grid grid-cols-1 gap-2 max-w-sm mx-auto text-left">
                                        {[
                                            '¿Cuántos seguimientos tengo hoy?',
                                            'Recomiéndame un email de seguimiento para mis leads',
                                            '¿Cuáles son mis leads con mayor valor?',
                                        ].map(suggestion => (
                                            <button
                                                key={suggestion}
                                                onClick={() => { setQuery(suggestion); setTimeout(() => inputRef.current?.focus(), 50); }}
                                                className="text-left px-4 py-2.5 bg-gray-50 hover:bg-purple-50 hover:text-purple-700 rounded-lg text-sm text-gray-600 transition-colors border border-gray-100 hover:border-purple-200"
                                            >
                                                {suggestion}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Search Mode */}
                    {mode === 'search' && (
                        <>
                            {query.trim().length < 2 ? (
                                <div className="p-10 text-center text-gray-500">
                                    <Search className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                                    <p className="font-medium text-gray-900">Escribe para buscar</p>
                                    <p className="text-sm mt-1 text-gray-400">Busca leads por nombre, empresa, email o teléfono.</p>
                                </div>
                            ) : isLoading ? (
                                <div className="p-8 text-center">
                                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" />
                                    <p className="mt-3 text-sm text-gray-400">Buscando...</p>
                                </div>
                            ) : results && results.length > 0 ? (
                                <div className="p-2 space-y-1">
                                    {results.map((lead, idx) => {
                                        const isSelected = idx === selectedIndex;
                                        const statusConfig = STATUS_CONFIG[lead.status] || STATUS_CONFIG['Prospecto'];
                                        const priorityConfig = PRIORITY_CONFIG[lead.priority] || PRIORITY_CONFIG['medium'];
                                        return (
                                            <div
                                                key={lead.id}
                                                onMouseEnter={() => setSelectedIndex(idx)}
                                                onClick={() => { setIsOpen(false); navigate(`/leads?id=${lead.id}`); }}
                                                className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${isSelected ? 'bg-indigo-50 ring-1 ring-indigo-500/20' : 'hover:bg-gray-50'} border ${isSelected ? 'border-indigo-100' : 'border-transparent'}`}
                                            >
                                                <div className="flex flex-col gap-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-gray-900 truncate">{lead.name}</span>
                                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
                                                            {statusConfig.label}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                                        {lead.company_name && <div className="flex items-center gap-1.5 truncate"><Building2 className="w-3.5 h-3.5" /><span className="truncate">{lead.company_name}</span></div>}
                                                        {lead.email && <div className="flex items-center gap-1.5 truncate"><Mail className="w-3.5 h-3.5" /><span className="truncate">{lead.email}</span></div>}
                                                        {lead.phone && <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /><span>{lead.phone}</span></div>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0 pl-4">
                                                    <div className="text-right">
                                                        <div className="text-sm font-bold text-gray-900">${(lead.value || 0).toLocaleString()}</div>
                                                        <div className="flex items-center justify-end gap-1 mt-0.5">
                                                            <span className={`w-2 h-2 rounded-full ${priorityConfig.color}`} />
                                                            <span className="text-[10px] uppercase font-bold text-gray-400">{priorityConfig.label}</span>
                                                        </div>
                                                    </div>
                                                    {isSelected && <ArrowRight className="w-5 h-5 text-indigo-500" />}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-10 text-center">
                                    <Search className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                                    <p className="text-gray-500 font-medium">No se encontraron resultados para "{query}"</p>
                                    <p className="text-sm text-gray-400 mt-1">Intenta con un nombre, empresa o teléfono diferente.</p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-4 py-2.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                    <div className="flex items-center gap-3">
                        <span><kbd className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-600 font-mono">↑↓</kbd> Navegar</span>
                        <span><kbd className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-600 font-mono">Enter</kbd> {mode === 'ai' ? 'Preguntar' : 'Abrir'}</span>
                    </div>
                    <span><kbd className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-600 font-mono">Esc</kbd> Cerrar</span>
                </div>
            </div>
        </div>
    );
}
