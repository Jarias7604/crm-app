import React, { useState, useEffect, useRef } from 'react';
import { Search, Command, X, ArrowRight, Loader2, Building2, Phone, Mail, Sparkles, TrendingUp, TrendingDown, Activity, AlertTriangle, CalendarCheck, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { leadsService } from '../services/leads';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../types';
import { useDebounce } from '../hooks/useDebounce';

export function GlobalSearch() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();

    // Debounce the search query to avoid spamming the database while typing
    const debouncedQuery = useDebounce(query, 300);

    const isAiMode = debouncedQuery.startsWith('/ai') || debouncedQuery.toLowerCase().includes('resumen') || debouncedQuery.toLowerCase().includes('analisis') || debouncedQuery.toLowerCase().includes('seguimiento');
    const isAiFollowUps = isAiMode && debouncedQuery.toLowerCase().includes('seguimiento');

    const { data: results, isLoading } = useQuery({
        queryKey: ['global-search', debouncedQuery],
        queryFn: async () => {
            if (isAiMode || debouncedQuery.trim().length < 2) return [];
            return await leadsService.searchLeads(debouncedQuery, 7);
        },
        enabled: isOpen && !isAiMode && debouncedQuery.trim().length >= 2,
        staleTime: 1000 * 60, // 1 minute cache
    });

    const { data: aiAnalytics, isLoading: isAiLoading } = useQuery({
        queryKey: ['ai-analytics-summary', debouncedQuery, isAiFollowUps],
        queryFn: async () => {
            if (!isAiMode) return null;
            // Simulated AI delay to show "thinking" effect
            await new Promise(r => setTimeout(r, 800));
            if (isAiFollowUps) {
                return await leadsService.getFollowUpsAnalyticsSummary();
            } else {
                return await leadsService.getLeadsAnalyticsSummary();
            }
        },
        enabled: isOpen && isAiMode,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

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
                const lead = results[selectedIndex];
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
                        placeholder="Busca por nombre, empresa, email o teléfono..."
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setSelectedIndex(0);
                        }}
                    />
                    {isLoading && debouncedQuery.length >= 2 && (
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
                    {(isLoading || isAiLoading) && debouncedQuery.length >= 2 ? (
                        <div className="p-12 text-center flex flex-col items-center justify-center">
                            <div className="relative">
                                {isAiMode && <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full animate-pulse" />}
                                <Loader2 className={`w-10 h-10 animate-spin relative z-10 ${isAiMode ? 'text-purple-500' : 'text-indigo-500'}`} />
                            </div>
                            <p className="mt-4 font-bold text-gray-900">{isAiMode ? 'La IA está analizando tus datos...' : 'Buscando...'}</p>
                            {isAiMode && <p className="text-xs text-gray-500 mt-1">Evaluando estado del pipeline...</p>}
                        </div>
                    ) : isAiMode && aiAnalytics ? (
                        <div className="p-6">
                            <div className={`bg-gradient-to-br border rounded-2xl p-6 shadow-inner relative overflow-hidden ${
                                (aiAnalytics as any).type === 'followups' && (aiAnalytics as any).aiColor === 'red' ? 'from-red-50 to-orange-50 border-red-200' :
                                (aiAnalytics as any).type === 'followups' && (aiAnalytics as any).aiColor === 'amber' ? 'from-amber-50 to-orange-50 border-amber-200' :
                                (aiAnalytics as any).type === 'followups' && (aiAnalytics as any).aiColor === 'emerald' ? 'from-emerald-50 to-teal-50 border-emerald-200' :
                                'from-purple-50 to-indigo-50 border-purple-100'
                            }`}>
                                <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl ${
                                    (aiAnalytics as any).type === 'followups' && (aiAnalytics as any).aiColor === 'red' ? 'bg-red-500/10' :
                                    (aiAnalytics as any).type === 'followups' && (aiAnalytics as any).aiColor === 'amber' ? 'bg-amber-500/10' :
                                    (aiAnalytics as any).type === 'followups' && (aiAnalytics as any).aiColor === 'emerald' ? 'bg-emerald-500/10' :
                                    'bg-purple-500/10'
                                }`} />
                                
                                <div className="flex items-start gap-4 relative z-10">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${
                                        (aiAnalytics as any).type === 'followups' && (aiAnalytics as any).aiColor === 'red' ? 'bg-red-500 shadow-red-500/30' :
                                        (aiAnalytics as any).type === 'followups' && (aiAnalytics as any).aiColor === 'amber' ? 'bg-amber-500 shadow-amber-500/30' :
                                        (aiAnalytics as any).type === 'followups' && (aiAnalytics as any).aiColor === 'emerald' ? 'bg-emerald-500 shadow-emerald-500/30' :
                                        'bg-purple-500 shadow-purple-500/30'
                                    }`}>
                                        <Sparkles className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="space-y-4 flex-1">
                                        <div>
                                            <h3 className={`text-sm font-black uppercase tracking-wider mb-1 ${
                                                (aiAnalytics as any).type === 'followups' && (aiAnalytics as any).aiColor === 'red' ? 'text-red-900' :
                                                (aiAnalytics as any).type === 'followups' && (aiAnalytics as any).aiColor === 'amber' ? 'text-amber-900' :
                                                (aiAnalytics as any).type === 'followups' && (aiAnalytics as any).aiColor === 'emerald' ? 'text-emerald-900' :
                                                'text-purple-900'
                                            }`}>
                                                AI Consultant {(aiAnalytics as any).type === 'followups' ? '- Seguimientos' : '- Cierres'}
                                            </h3>
                                            <p className="text-gray-800 font-medium leading-relaxed">
                                                {(aiAnalytics as any).aiMessage.split('**').map((part, i) => 
                                                    i % 2 === 1 ? <span key={i} className="font-black text-gray-900">{part}</span> : part
                                                )}
                                            </p>
                                        </div>

                                        {(aiAnalytics as any).type === 'leads' && (
                                            <div className="grid grid-cols-2 gap-4 mt-4">
                                                <div className="bg-white rounded-xl p-4 shadow-sm border border-purple-100/50">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Cierres del Mes</p>
                                                    <div className="flex items-end gap-2">
                                                        <span className="text-2xl font-black text-gray-900">{(aiAnalytics as any).wonThisMonth}</span>
                                                        <span className="text-sm font-bold text-gray-400 mb-0.5">/ {(aiAnalytics as any).wonLastMonth} (mes ant.)</span>
                                                    </div>
                                                    <div className={`flex items-center gap-1 mt-2 text-xs font-bold ${(aiAnalytics as any).growthPercentage >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                        {(aiAnalytics as any).growthPercentage >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                                        <span>{Math.abs((aiAnalytics as any).growthPercentage)}% vs mes pasado</span>
                                                    </div>
                                                </div>
                                                
                                                <div className="bg-white rounded-xl p-4 shadow-sm border border-purple-100/50">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Proyección</p>
                                                    <div className="flex items-end gap-2">
                                                        <span className="text-2xl font-black text-gray-900">${(aiAnalytics as any).valueThisMonth.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 mt-2 text-xs font-bold text-indigo-500">
                                                        <Activity className="w-3.5 h-3.5" />
                                                        <span>Tendencia en tiempo real</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {(aiAnalytics as any).type === 'followups' && (
                                            <div className="grid grid-cols-3 gap-4 mt-4">
                                                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Vencidos</p>
                                                    <div className="flex items-center gap-2">
                                                        <AlertTriangle className={`w-4 h-4 ${(aiAnalytics as any).overdue > 0 ? 'text-red-500' : 'text-gray-300'}`} />
                                                        <span className={`text-2xl font-black ${(aiAnalytics as any).overdue > 0 ? 'text-red-600' : 'text-gray-900'}`}>{(aiAnalytics as any).overdue}</span>
                                                    </div>
                                                </div>
                                                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Para Hoy</p>
                                                    <div className="flex items-center gap-2">
                                                        <CalendarCheck className="w-4 h-4 text-amber-500" />
                                                        <span className="text-2xl font-black text-gray-900">{(aiAnalytics as any).today}</span>
                                                    </div>
                                                </div>
                                                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Hechos (Semana)</p>
                                                    <div className="flex items-center gap-2">
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                        <span className="text-2xl font-black text-gray-900">{(aiAnalytics as any).completed}</span>
                                                    </div>
                                                </div>
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
                    ) : displayResults.length === 0 && !isLoading && !isAiMode ? (
                        <div className="p-12 text-center text-gray-500">
                            <p className="font-medium text-gray-900">No encontramos resultados para "{query}"</p>
                            <p className="text-sm mt-1">Revisa la ortografía o intenta con otro término.</p>
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
