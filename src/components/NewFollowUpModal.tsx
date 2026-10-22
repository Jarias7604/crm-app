import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import {
    X, Phone, Mail, MessageSquare, Video, FileText,
    Calendar, Clock, User, Target, Search, Check, Loader2, Sparkles
} from 'lucide-react';
import { leadsService } from '../services/leads';
import { supabase } from '../services/supabase';
import { localToUtcISO } from '../utils/timezone';
import toast from 'react-hot-toast';

interface NewFollowUpModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialDate?: Date;
    initialLeadId?: string;
    companyId?: string;
    companyTimezone: string;
    currentUserId?: string;
    teamMembers: { id: string; full_name: string; role: string; avatar_url?: string | null }[];
    canAssignOthers?: boolean;
    onSuccess: () => void;
}

const ACTION_OPTIONS = [
    { type: 'call', label: 'Llamada', icon: Phone, color: 'text-emerald-700 bg-emerald-50 border-emerald-300 ring-emerald-400' },
    { type: 'meeting', label: 'Reunión', icon: Video, color: 'text-violet-700 bg-violet-50 border-violet-300 ring-violet-400' },
    { type: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, color: 'text-teal-700 bg-teal-50 border-teal-300 ring-teal-400' },
    { type: 'email', label: 'Email', icon: Mail, color: 'text-blue-700 bg-blue-50 border-blue-300 ring-blue-400' },
    { type: 'quote', label: 'Cotización', icon: FileText, color: 'text-amber-700 bg-amber-50 border-amber-300 ring-amber-400' },
];

const TIME_SLOTS = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30'
];

export default function NewFollowUpModal({
    isOpen,
    onClose,
    initialDate,
    initialLeadId,
    companyId,
    companyTimezone,
    currentUserId,
    teamMembers,
    canAssignOthers = true,
    onSuccess,
}: NewFollowUpModalProps) {
    const [actionType, setActionType] = useState<string>('call');
    const [date, setDate] = useState<string>(() => format(initialDate || new Date(), 'yyyy-MM-dd'));
    const [time, setTime] = useState<string>('09:00');
    const [assignedTo, setAssignedTo] = useState<string>(() => currentUserId || '');
    const [notes, setNotes] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);

    // Lead search & selection
    const [leads, setLeads] = useState<{ id: string; name: string; company_name?: string | null; email?: string | null }[]>([]);
    const [selectedLead, setSelectedLead] = useState<{ id: string; name: string; company_name?: string | null } | null>(null);
    const [leadSearch, setLeadSearch] = useState('');
    const [isSearchingLeads, setIsSearchingLeads] = useState(false);
    const [isLeadDropdownOpen, setIsLeadDropdownOpen] = useState(false);

    useEffect(() => {
        if (initialDate) {
            setDate(format(initialDate, 'yyyy-MM-dd'));
        }
    }, [initialDate]);

    // Load initial leads
    useEffect(() => {
        if (!isOpen) return;
        const loadLeads = async () => {
            try {
                setIsSearchingLeads(true);
                const { data } = await leadsService.getLeads(1, 100, companyId);
                const mapped = (data || []).map(l => ({
                    id: l.id,
                    name: l.name,
                    company_name: l.company_name,
                    email: l.email
                }));
                setLeads(mapped);
                if (initialLeadId) {
                    const match = mapped.find(l => l.id === initialLeadId);
                    if (match) setSelectedLead(match);
                }
            } catch (err) {
                console.error('Error loading leads in modal:', err);
            } finally {
                setIsSearchingLeads(false);
            }
        };
        loadLeads();
    }, [isOpen, companyId, initialLeadId]);

    // Filter leads by search term
    const filteredLeads = useMemo(() => {
        if (!leadSearch.trim()) return leads.slice(0, 15);
        const q = leadSearch.toLowerCase();
        return leads.filter(l =>
            l.name?.toLowerCase().includes(q) ||
            l.company_name?.toLowerCase().includes(q) ||
            l.email?.toLowerCase().includes(q)
        ).slice(0, 15);
    }, [leads, leadSearch]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!date) {
            toast.error('Selecciona una fecha');
            return;
        }

        setIsSaving(true);
        try {
            const followUpDateTime = localToUtcISO(`${date}T${time}`, companyTimezone);
            const actionLabel = ACTION_OPTIONS.find(a => a.type === actionType)?.label || 'Seguimiento';
            const finalNotes = notes.trim() || `Seguimiento: ${actionLabel}${selectedLead ? ` con ${selectedLead.name}` : ''}`;

            await leadsService.createFollowUp({
                lead_id: selectedLead?.id || undefined,
                company_id: companyId,
                date: followUpDateTime,
                notes: finalNotes,
                action_type: actionType as any,
            }, assignedTo || undefined);

            toast.success(`📅 Seguimiento agendado para el ${date} a las ${time}`);
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error creating follow-up:', error);
            toast.error(`Error al agendar: ${error.message || 'Error desconocido'}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-slate-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 p-6 text-white shrink-0 relative">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
                                <Calendar className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black tracking-tight">Programar Seguimiento</h2>
                                <p className="text-xs text-indigo-100 font-medium">Agendar próxima acción en el calendario del equipo</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
                    {/* 1. Tipo de Acción */}
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                            Tipo de Acción
                        </label>
                        <div className="grid grid-cols-5 gap-2">
                            {ACTION_OPTIONS.map(opt => {
                                const Icon = opt.icon;
                                const isSelected = actionType === opt.type;
                                return (
                                    <button
                                        key={opt.type}
                                        type="button"
                                        onClick={() => setActionType(opt.type)}
                                        className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border-2 transition-all ${
                                            isSelected
                                                ? `${opt.color} ring-2 shadow-sm font-black scale-[1.03]`
                                                : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200 hover:text-slate-800'
                                        }`}
                                    >
                                        <Icon className="w-4 h-4 mb-1" />
                                        <span className="text-[10px]">{opt.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 2. Lead asociado (Searchable) */}
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                            Prospecto / Lead (Opcional)
                        </label>
                        {selectedLead ? (
                            <div className="flex items-center justify-between p-3 rounded-2xl bg-indigo-50 border border-indigo-200">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-xs shrink-0">
                                        <Target className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-black text-indigo-950 truncate">{selectedLead.name}</p>
                                        {selectedLead.company_name && (
                                            <p className="text-[10px] font-medium text-indigo-600 truncate">{selectedLead.company_name}</p>
                                        )}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedLead(null)}
                                    className="p-1 rounded-lg hover:bg-indigo-100 text-indigo-600 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="relative">
                                <div className="relative">
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    <input
                                        type="text"
                                        value={leadSearch}
                                        onChange={e => {
                                            setLeadSearch(e.target.value);
                                            setIsLeadDropdownOpen(true);
                                        }}
                                        onFocus={() => setIsLeadDropdownOpen(true)}
                                        placeholder="Buscar lead por nombre, empresa o email..."
                                        className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    />
                                    {isSearchingLeads && (
                                        <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                                    )}
                                </div>

                                {isLeadDropdownOpen && filteredLeads.length > 0 && (
                                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-30 max-h-48 overflow-y-auto">
                                        {filteredLeads.map(l => (
                                            <button
                                                key={l.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedLead(l);
                                                    setIsLeadDropdownOpen(false);
                                                    setLeadSearch('');
                                                }}
                                                className="w-full text-left px-3.5 py-2 hover:bg-indigo-50 flex items-center justify-between text-xs transition-colors"
                                            >
                                                <div className="min-w-0">
                                                    <p className="font-bold text-slate-800 truncate">{l.name}</p>
                                                    {l.company_name && (
                                                        <p className="text-[10px] text-slate-400 truncate">{l.company_name}</p>
                                                    )}
                                                </div>
                                                <Check className="w-3.5 h-3.5 text-indigo-600 opacity-0 hover:opacity-100 shrink-0" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 3. Fecha y Hora */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                                Fecha
                            </label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    required
                                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                                Hora
                            </label>
                            <div className="relative">
                                <select
                                    value={time}
                                    onChange={e => setTime(e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer bg-white"
                                >
                                    {TIME_SLOTS.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* 4. Responsable asignado */}
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                            Responsable Asignado
                        </label>
                        <select
                            value={assignedTo}
                            onChange={e => setAssignedTo(e.target.value)}
                            disabled={!canAssignOthers}
                            className={`w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                                !canAssignOthers ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'bg-white cursor-pointer'
                            }`}
                        >
                            <option value="">Sin asignar / Empresa</option>
                            {teamMembers.map(m => (
                                <option key={m.id} value={m.id}>
                                    {m.full_name} ({m.role})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 5. Notas */}
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                            Notas / Objetivo
                        </label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={3}
                            placeholder="Ej. Revisar propuesta técnica enviada, resolver dudas sobre condiciones de entrega..."
                            className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                        />
                    </div>

                    {/* Buttons */}
                    <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-lg shadow-indigo-200 transition-all disabled:opacity-50"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Agendando...
                                </>
                            ) : (
                                <>
                                    <Check className="w-3.5 h-3.5" />
                                    Agendar Seguimiento
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
