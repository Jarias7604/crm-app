import React from 'react';
import { ChevronRight, FileText, Clock, Trash2, Calendar, Phone, MessageSquare, User, Mail, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SOURCE_CONFIG } from '../../types';
import type { Lead } from '../../types';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { LeadScoreBadge } from './LeadScoreBadge';
import { ResponseVelocityBadge } from '../ui/ResponseVelocityBadge';

interface LeadGridProps {
    paginatedLeads: Lead[];
    teamMembers: any[];
    openLeadDetail: (lead: Lead) => void;
    handleDeleteLead: (id: string, name: string) => void;
    isAdmin: boolean;
    callTracker: { start: (id: string) => void };
    setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
    currentPage: number;
    totalPages: number;
    ROWS_PER_PAGE: number;
    sortedLeads: Lead[];
}

export const LeadGrid: React.FC<LeadGridProps> = ({
    paginatedLeads,
    teamMembers,
    openLeadDetail,
    handleDeleteLead,
    isAdmin,
    callTracker,
    setCurrentPage,
    currentPage,
    totalPages,
    ROWS_PER_PAGE,
    sortedLeads
}) => {
    return (
        <div className="hidden md:grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-in fade-in duration-500">
                        {paginatedLeads.map((lead) => (
                            <div
                                key={lead.id}
                                onClick={() => openLeadDetail(lead)}
                                className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100 hover:shadow-md transition-all cursor-pointer group"
                            >
                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <PriorityBadge priority={lead.priority || 'medium'} />
                                            <StatusBadge status={lead.status} />
                                            <LeadScoreBadge lead={lead} variant="compact" />
                                            {lead.document_path && (
                                                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center gap-1">
                                                    <FileText className="w-3 h-3" /> Cotizado
                                                </span>
                                            )}
                                            {lead.source && SOURCE_CONFIG[lead.source] && (
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${SOURCE_CONFIG[lead.source].bgColor} ${SOURCE_CONFIG[lead.source].color}`}>
                                                    {SOURCE_CONFIG[lead.source].icon} {SOURCE_CONFIG[lead.source].label}
                                                </span>
                                            )}
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors" />
                                    </div>

                                    <h3 className="text-lg font-semibold text-gray-900">{lead.name}</h3>
                                    {lead.company_name && (
                                        <p className="text-sm text-gray-500 font-medium">{lead.company_name}</p>
                                    )}

                                    <div className="mt-5 grid grid-cols-2 gap-4 pb-4">
                                        <div className="flex flex-col">
                                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Valor Potencial</p>
                                            <p className="text-sm font-black text-indigo-600 tracking-tight">
                                                ${(lead.value || 0).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 text-right">Monto Cierre</p>
                                            <p className={`text-sm font-black tracking-tight ${(lead.closing_amount || 0) > 0 ? 'text-green-600' : 'text-gray-300'}`}>
                                                ${(lead.closing_amount || 0).toLocaleString()}
                                            </p>
                                        </div>

                                        {(lead.status === 'Cerrado' || lead.status === 'Cliente') && lead.internal_won_date ? (
                                            <div className="col-span-2 bg-emerald-50/50 rounded-lg p-2.5 flex items-center justify-between border border-emerald-100/30">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                                    <span className="text-xs font-bold text-emerald-700">Cierre:</span>
                                                </div>
                                                <span className="text-xs font-black text-emerald-900 uppercase">
                                                    {(() => {
                                                        try {
                                                            const dateStr = lead.internal_won_date!.split('T')[0];
                                                            const dateObj = new Date(dateStr + 'T12:00:00');
                                                            return format(dateObj, 'dd MMM yyyy', { locale: es }).toUpperCase();
                                                        } catch (e) { return 'N/A'; }
                                                    })()}
                                                </span>
                                            </div>
                                        ) : lead.next_followup_date && (
                                            <div className="col-span-2 bg-blue-50/50 rounded-lg p-2.5 flex items-center justify-between border border-blue-100/30">
                                                <div className="flex items-center gap-2">
                                                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                                                    <span className="text-xs font-bold text-blue-700">Seguimiento:</span>
                                                    {/* F3 — urgency inline */}
                                                    <ResponseVelocityBadge
                                                        nextFollowupDate={lead.next_followup_date}
                                                        variant="inline"
                                                    />
                                                </div>
                                                <span className="text-xs font-black text-blue-900 uppercase">
                                                    {(() => {
                                                        try {
                                                            const dateStr = lead.next_followup_date.split('T')[0];
                                                            const dateObj = new Date(dateStr + 'T12:00:00');
                                                            return format(dateObj, 'dd MMM yyyy', { locale: es }).toUpperCase();
                                                        } catch (e) { return 'N/A'; }
                                                    })()}
                                                </span>
                                            </div>
                                        )}

                                        <div className="col-span-2 grid grid-cols-2 gap-4 pt-2 border-t border-gray-50 mt-2">
                                            {lead.assigned_to && (() => {
                                                const owner = teamMembers.find(m => m.id === lead.assigned_to);
                                                return (
                                                    <div className="flex items-center gap-2">
                                                        {owner?.avatar_url ? (
                                                            <img src={owner.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover border border-white shadow-sm" />
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center border border-white shadow-sm">
                                                                <User className="w-3 h-3 text-indigo-400" />
                                                            </div>
                                                        )}
                                                        <div>
                                                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">Responsable</p>
                                                            <p className="text-sm font-bold text-gray-700 truncate">{owner?.full_name || owner?.email.split('@')[0]}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {lead.next_followup_assignee && (() => {
                                                const assignee = teamMembers.find(m => m.id === lead.next_followup_assignee);
                                                return (
                                                    <div className="flex items-center gap-2 border-l border-gray-100 pl-4">
                                                        {assignee?.avatar_url ? (
                                                            <img src={assignee.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover border border-white shadow-sm" />
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center border border-white shadow-sm">
                                                                <User className="w-3 h-3 text-blue-400" />
                                                            </div>
                                                        )}
                                                        <div>
                                                            <p className="text-xs font-black text-blue-400 uppercase tracking-widest leading-none mb-0.5">Asignado a</p>
                                                            <p className="text-sm font-bold text-gray-700 truncate">{assignee?.full_name || assignee?.email.split('@')[0]}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    <div className="mt-3 pt-3 border-t border-gray-100 flex gap-3 text-xs text-gray-400">
                                        {lead.email && <span className="flex items-center"><Mail className="w-3 h-3 mr-1" />{lead.email}</span>}
                                        {lead.phone && <span className="flex items-center"><Phone className="w-3 h-3 mr-1" />{lead.phone}</span>}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {/* Desktop Grid Pagination */}
                        {totalPages > 1 && (
                            <div className="col-span-full flex items-center justify-between px-6 py-3 bg-white rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                                <p className="text-[11px] font-bold text-gray-400">
                                    {((currentPage - 1) * ROWS_PER_PAGE) + 1}–{Math.min(currentPage * ROWS_PER_PAGE, sortedLeads.length)} de {sortedLeads.length} leads
                                </p>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setCurrentPage(1)}
                                        disabled={currentPage === 1}
                                        className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:bg-indigo-50 hover:text-indigo-600"
                                    >
                                        «
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:bg-indigo-50 hover:text-indigo-600"
                                    >
                                        Anterior
                                    </button>
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let page: number;
                                        if (totalPages <= 5) {
                                            page = i + 1;
                                        } else if (currentPage <= 3) {
                                            page = i + 1;
                                        } else if (currentPage >= totalPages - 2) {
                                            page = totalPages - 4 + i;
                                        } else {
                                            page = currentPage - 2 + i;
                                        }
                                        return (
                                            <button
                                                key={page}
                                                onClick={() => setCurrentPage(page)}
                                                className={`w-8 h-8 text-[11px] font-black rounded-lg transition-all ${
                                                    currentPage === page
                                                        ? 'bg-[#4449AA] text-white shadow-md shadow-indigo-200'
                                                        : 'text-gray-500 hover:bg-indigo-50 hover:text-indigo-600'
                                                }`}
                                            >
                                                {page}
                                            </button>
                                        );
                                    })}
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:bg-indigo-50 hover:text-indigo-600"
                                    >
                                        Siguiente
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(totalPages)}
                                        disabled={currentPage === totalPages}
                                        className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:bg-indigo-50 hover:text-indigo-600"
                                    >
                                        »
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
    );
};
