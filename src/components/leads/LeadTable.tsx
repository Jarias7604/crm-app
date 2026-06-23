import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, ArrowUpDown, Shield, ChevronRight, Trash2, CheckCircle, Target, FileText, Mail, Phone, Calendar, Send, User, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { format, differenceInHours, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { SOURCE_CONFIG } from '../../types';
import type { Lead, LeadProduct } from '../../types';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { LeadScoreBadge } from './LeadScoreBadge';
import { ResponseVelocityBadge } from '../ui/ResponseVelocityBadge';

interface LeadTableProps {
    columnOrder: string[];
    columnWidths: Record<string, number>;
    DEFAULT_COL_WIDTHS: Record<string, number>;
    handleOnDragEnd: (result: any) => void;
    handleColResizeStart: (e: React.MouseEvent, colId: string) => void;
    selectedLeadIds: string[];
    toggleLeadSelection: (id: string) => void;
    toggleSelectAll: () => void;
    sortedLeads: Lead[];
    paginatedLeads: Lead[];
    sortConfig: { key: keyof Lead; direction: 'asc' | 'desc' } | null;
    setSortConfig: React.Dispatch<React.SetStateAction<{ key: keyof Lead; direction: 'asc' | 'desc' } | null>>;
    teamMembers: any[];
    openLeadDetail: (lead: Lead) => void;
    completedLeadIds: string[] | null;
    isAdmin: boolean;
    handleDeleteLead: (id: string, name: string) => void;
    storageService: any;
    navigate: any;
    products: LeadProduct[];
}

export const LeadTable: React.FC<LeadTableProps> = ({
    columnOrder,
    columnWidths,
    DEFAULT_COL_WIDTHS,
    handleOnDragEnd,
    handleColResizeStart,
    selectedLeadIds,
    toggleLeadSelection,
    toggleSelectAll,
    sortedLeads,
    paginatedLeads,
    sortConfig,
    setSortConfig,
    teamMembers,
    openLeadDetail,
    completedLeadIds,
    isAdmin,
    handleDeleteLead,
    storageService,
    navigate,
    products,
}) => {
    return (
        <table
                                        className="divide-y divide-gray-50"
                                        style={{
                                            tableLayout: 'fixed',
                                            width: columnOrder.reduce((sum, id) => sum + (columnWidths[id] ?? DEFAULT_COL_WIDTHS[id] ?? 140), 48 + 160),
                                        }}
                                    >
                                        <DragDropContext
                                            onDragStart={() => { document.body.style.cursor = 'move'; document.body.style.userSelect = 'none'; }}
                                            onDragEnd={(result) => { document.body.style.cursor = ''; document.body.style.userSelect = ''; handleOnDragEnd(result); }}
                                        >
                                            <Droppable droppableId="columns" direction="horizontal">
                                                {(provided) => (
                                                    <thead className="bg-[#FAFAFB]">
                                                        <tr ref={provided.innerRef} {...provided.droppableProps}>
                                                            <th scope="col" className="px-6 py-4 text-left bg-[#FAFAFB]">
                                                                <div className="flex items-center">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedLeadIds.length === sortedLeads.length && sortedLeads.length > 0}
                                                                        onChange={toggleSelectAll}
                                                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer transition-all"
                                                                    />
                                                                </div>
                                                            </th>

                                                            {columnOrder.map((colId, index) => (
                                                                <Draggable key={colId} draggableId={colId} index={index}>
                                                                    {(provided, snapshot) => (
                                                                            <th
                                                                                ref={provided.innerRef}
                                                                                {...provided.draggableProps}
                                                                                scope="col"
                                                                                style={{
                                                                                    ...provided.draggableProps.style,
                                                                                    width: columnWidths[colId] ?? DEFAULT_COL_WIDTHS[colId] ?? 140,
                                                                                    minWidth: 80,
                                                                                }}
                                                                                className={`px-4 py-4 text-left text-[11px] font-black uppercase tracking-[0.15em] transition-all relative select-none border-b border-slate-200/80 ${
                                                                                    snapshot.isDragging
                                                                                        ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/30 rounded-lg opacity-95 z-50'
                                                                                        : 'bg-slate-50 text-slate-500'
                                                                                }`}
                                                                            >
                                                                                <div className="flex items-center gap-2">
                                                                                    <div
                                                                                        {...provided.dragHandleProps}
                                                                                        title="Arrastra para reordenar"
                                                                                        style={{ cursor: 'move' }}
                                                                                        className={`transition-all flex items-center rounded p-0.5 ${
                                                                                            snapshot.isDragging
                                                                                                ? 'text-white/90 bg-white/20'
                                                                                                : 'text-slate-300 hover:text-indigo-600 hover:bg-indigo-50'
                                                                                        }`}
                                                                                    >
                                                                                        <GripVertical className="w-4 h-4" />
                                                                                    </div>

                                                                                {colId === 'name' && (
                                                                                    <div
                                                                                        className="cursor-pointer hover:text-indigo-600 transition-colors group flex items-center gap-1"
                                                                                        onClick={() => setSortConfig({
                                                                                            key: 'name',
                                                                                            direction: sortConfig?.key === 'name' && sortConfig.direction === 'asc' ? 'desc' : 'asc'
                                                                                        })}
                                                                                    >
                                                                                        Nombre / Empresa
                                                                                        <ArrowUpDown className={`w-3 h-3 ${sortConfig?.key === 'name' ? 'text-indigo-600' : 'text-slate-300 group-hover:text-indigo-500'} transition-all`} />
                                                                                    </div>
                                                                                )}

                                                                                {colId === 'email' && (
                                                                                    <div
                                                                                        className="cursor-pointer hover:text-indigo-600 transition-colors group flex items-center gap-1"
                                                                                        onClick={() => setSortConfig({
                                                                                            key: 'email',
                                                                                            direction: sortConfig?.key === 'email' && sortConfig.direction === 'asc' ? 'desc' : 'asc'
                                                                                        })}
                                                                                    >
                                                                                        Email
                                                                                        <ArrowUpDown className={`w-3 h-3 ${sortConfig?.key === 'email' ? 'text-indigo-600' : 'text-slate-300 group-hover:text-indigo-500'} transition-all`} />
                                                                                    </div>
                                                                                )}

                                                                                {colId === 'phone' && (
                                                                                    <div
                                                                                        className="cursor-pointer hover:text-indigo-600 transition-colors group flex items-center gap-1"
                                                                                        onClick={() => setSortConfig({
                                                                                            key: 'phone',
                                                                                            direction: sortConfig?.key === 'phone' && sortConfig.direction === 'asc' ? 'desc' : 'asc'
                                                                                        })}
                                                                                    >
                                                                                        Teléfono
                                                                                        <ArrowUpDown className={`w-3 h-3 ${sortConfig?.key === 'phone' ? 'text-indigo-600' : 'text-slate-300 group-hover:text-indigo-500'} transition-all`} />
                                                                                    </div>
                                                                                )}

                                                                                {colId === 'status' && (
                                                                                    <div
                                                                                        className="cursor-pointer hover:text-indigo-600 transition-colors group flex items-center gap-1"
                                                                                        onClick={() => setSortConfig({
                                                                                            key: 'status',
                                                                                            direction: sortConfig?.key === 'status' && sortConfig.direction === 'asc' ? 'desc' : 'asc'
                                                                                        })}
                                                                                    >
                                                                                        Estado
                                                                                        <ArrowUpDown className={`w-3 h-3 ${sortConfig?.key === 'status' ? 'text-indigo-600' : 'text-slate-300 group-hover:text-indigo-500'} transition-all`} />
                                                                                    </div>
                                                                                )}

                                                                                {colId === 'priority' && (
                                                                                    <div
                                                                                        className="cursor-pointer hover:text-indigo-600 transition-colors group flex items-center gap-1"
                                                                                        onClick={() => setSortConfig({
                                                                                            key: 'priority',
                                                                                            direction: sortConfig?.key === 'priority' && sortConfig.direction === 'asc' ? 'desc' : 'asc'
                                                                                        })}
                                                                                    >
                                                                                        Prioridad
                                                                                        <ArrowUpDown className={`w-3 h-3 ${sortConfig?.key === 'priority' ? 'text-indigo-600' : 'text-slate-300 group-hover:text-indigo-500'} transition-all`} />
                                                                                    </div>
                                                                                )}

                                                                                {colId === 'source' && (
                                                                                    <div
                                                                                        className="cursor-pointer hover:text-indigo-600 transition-colors group flex items-center gap-1"
                                                                                        onClick={() => setSortConfig({
                                                                                            key: 'source',
                                                                                            direction: sortConfig?.key === 'source' && sortConfig.direction === 'asc' ? 'desc' : 'asc'
                                                                                        })}
                                                                                    >
                                                                                        Fuente
                                                                                        <ArrowUpDown className={`w-3 h-3 ${sortConfig?.key === 'source' ? 'text-indigo-600' : 'text-slate-300 group-hover:text-indigo-500'} transition-all`} />
                                                                                    </div>
                                                                                )}

                                                                                {colId === 'created_at' && (
                                                                                    <div
                                                                                        className="cursor-pointer hover:text-indigo-600 transition-colors group flex items-center gap-1"
                                                                                        onClick={() => setSortConfig({
                                                                                            key: 'created_at',
                                                                                            direction: sortConfig?.key === 'created_at' && sortConfig.direction === 'asc' ? 'desc' : 'asc'
                                                                                        })}
                                                                                    >
                                                                                        Creado el
                                                                                        <ArrowUpDown className={`w-3 h-3 ${sortConfig?.key === 'created_at' ? 'text-indigo-600' : 'text-slate-300 group-hover:text-indigo-500'} transition-all`} />
                                                                                    </div>
                                                                                )}

                                                                                {colId === 'internal_won_date' && (
                                                                                    <div
                                                                                        className="cursor-pointer hover:text-indigo-600 transition-colors group flex items-center gap-1"
                                                                                        onClick={() => setSortConfig({
                                                                                            key: 'internal_won_date' as keyof Lead,
                                                                                            direction: sortConfig?.key === 'internal_won_date' && sortConfig.direction === 'asc' ? 'desc' : 'asc'
                                                                                        })}
                                                                                    >
                                                                                        Fecha Cierre
                                                                                        <ArrowUpDown className={`w-3 h-3 ${sortConfig?.key === 'internal_won_date' ? 'text-indigo-600' : 'text-slate-300 group-hover:text-indigo-500'} transition-all`} />
                                                                                    </div>
                                                                                )}

                                                                                {colId === 'value' && (
                                                                                    <div
                                                                                        className="cursor-pointer hover:text-indigo-600 transition-colors group flex items-center gap-1"
                                                                                        onClick={() => setSortConfig({
                                                                                            key: 'value',
                                                                                            direction: sortConfig?.key === 'value' && sortConfig.direction === 'asc' ? 'desc' : 'asc'
                                                                                        })}
                                                                                    >
                                                                                        Valor
                                                                                        <ArrowUpDown className={`w-3 h-3 ${sortConfig?.key === 'value' ? 'text-indigo-600' : 'text-slate-300 group-hover:text-indigo-500'} transition-all`} />
                                                                                    </div>
                                                                                )}

                                                                                {colId === 'last_follow_up_at' && (
                                                                                    <div
                                                                                        className="cursor-pointer hover:text-indigo-600 transition-colors group flex items-center gap-1"
                                                                                        onClick={() => setSortConfig({
                                                                                            key: 'last_follow_up_at' as keyof Lead,
                                                                                            direction: sortConfig?.key === 'last_follow_up_at' && sortConfig.direction === 'asc' ? 'desc' : 'asc'
                                                                                        })}
                                                                                    >
                                                                                        Último Seguimiento
                                                                                        <ArrowUpDown className={`w-3 h-3 ${sortConfig?.key === 'last_follow_up_at' ? 'text-indigo-600' : 'text-slate-300 group-hover:text-indigo-500'} transition-all`} />
                                                                                    </div>
                                                                                )}

                                                                                {colId === 'assigned_to' && (
                                                                                    <div
                                                                                        className="cursor-pointer hover:text-indigo-600 transition-colors group flex items-center gap-1"
                                                                                        onClick={() => setSortConfig({
                                                                                            key: 'assigned_to',
                                                                                            direction: sortConfig?.key === 'assigned_to' && sortConfig.direction === 'asc' ? 'desc' : 'asc'
                                                                                        })}
                                                                                    >
                                                                                        Asignado
                                                                                        <ArrowUpDown className={`w-3 h-3 ${sortConfig?.key === 'assigned_to' ? 'text-indigo-600' : 'text-slate-300 group-hover:text-indigo-500'} transition-all`} />
                                                                                    </div>
                                                                                )}

                                                                                {colId === 'interested_product_id' && (
                                                                                    <div
                                                                                        className="cursor-pointer hover:text-indigo-600 transition-colors group flex items-center gap-1"
                                                                                        onClick={() => setSortConfig({
                                                                                            key: 'interested_product_id' as keyof Lead,
                                                                                            direction: sortConfig?.key === 'interested_product_id' && sortConfig.direction === 'asc' ? 'desc' : 'asc'
                                                                                        })}
                                                                                    >
                                                                                        Producto
                                                                                        <ArrowUpDown className={`w-3 h-3 ${sortConfig?.key === 'interested_product_id' ? 'text-indigo-600' : 'text-slate-300 group-hover:text-indigo-500'} transition-all`} />
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            {/* Resize handle — always a thin visible line, indigo on hover */}
                                                                            <div
                                                                                onMouseDown={(e) => handleColResizeStart(e, colId)}
                                                                                onMouseEnter={(e) => {
                                                                                    const bar = e.currentTarget.querySelector('div') as HTMLElement | null;
                                                                                    if (bar) bar.style.background = '#a5b4fc';
                                                                                }}
                                                                                onMouseLeave={(e) => {
                                                                                    const bar = e.currentTarget.querySelector('div') as HTMLElement | null;
                                                                                    if (bar) bar.style.background = 'rgba(203,213,225,0.2)';
                                                                                }}
                                                                                style={{
                                                                                    position: 'absolute', right: 0, top: 0, bottom: 0,
                                                                                    width: 10, cursor: 'col-resize', zIndex: 10,
                                                                                    userSelect: 'none',
                                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                                }}
                                                                            >
                                                                                <div style={{
                                                                                    width: 1, height: '50%', borderRadius: 2,
                                                                                    background: 'rgba(203,213,225,0.2)',
                                                                                    transition: 'background 0.15s',
                                                                                }} />
                                                                            </div>
                                                                        </th>
                                                                    )}
                                                                </Draggable>
                                                            ))}

                                                            {provided.placeholder}
                                                            <th scope="col" style={{ width: 160, minWidth: 160, position: 'sticky', right: 0, zIndex: 4, boxShadow: '-2px 0 6px rgba(0,0,0,0.04)' }} className="px-4 py-4 text-center text-xs font-black text-gray-400 uppercase tracking-widest bg-[#FAFAFB]">
                                                                Acciones
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                )}
                                            </Droppable>
                                        </DragDropContext>
                                        <tbody className="bg-white divide-y divide-slate-100/60">
                                            {paginatedLeads.map((lead) => {
                                                const isSelected = selectedLeadIds.includes(lead.id);
                                                return (
                                                    <tr
                                                        key={lead.id}
                                                        className={`group transition-all duration-300 ease-out hover:shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-[2px] relative z-0 hover:z-10 bg-white rounded-xl ${isSelected ? 'bg-indigo-50/50' : 'hover:bg-indigo-50/20'}`}
                                                    >
                                                        <td className="px-6 py-4 whitespace-nowrap bg-inherit" onClick={(e) => e.stopPropagation()}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => toggleLeadSelection(lead.id)}
                                                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer transition-all"
                                                            />
                                                        </td>
                                                        {columnOrder.map((colId) => (
                                                            <td key={colId} className="px-4 py-4 overflow-hidden">
                                                                {colId === 'name' && (
                                                                    <div className="flex items-center gap-2 cursor-pointer min-w-0" onClick={() => openLeadDetail(lead)}>
                                                                        {completedLeadIds && (
                                                                            completedLeadIds.includes(lead.id) ? (
                                                                                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                                                                            ) : (
                                                                                <Target className="w-4 h-4 text-red-400 shrink-0" />
                                                                            )
                                                                        )}
                                                                        <div className="flex flex-col min-w-0">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-sm font-bold text-gray-900 group-hover:text-[#4449AA] transition-colors truncate" title={lead.name}>{lead.name}</span>
                                                                                {((lead.cotizaciones?.length ?? 0) > 0 || lead.document_path) && (
                                                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-50 text-blue-600 border border-blue-100 uppercase tracking-widest shrink-0" title="Cotización Generada">
                                                                                        <FileText className="w-2.5 h-2.5" />
                                                                                        Cotizado
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <span className="text-xs text-blue-600 font-bold truncate" title={lead.company_name || 'Individual'}>{lead.company_name || 'Individual'}</span>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {colId === 'email' && (
                                                                    lead.email ? (
                                                                        <div className="flex items-center gap-1.5 max-w-[180px]">
                                                                            <Mail className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                                                            <span className="text-[11px] font-semibold text-gray-700 truncate" title={lead.email}>{lead.email}</span>
                                                                        </div>
                                                                    ) : null
                                                                )}

                                                                {colId === 'phone' && (
                                                                    lead.phone ? (
                                                                        <div className="flex items-center gap-1.5">
                                                                            <Phone className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                                                            <span className="text-[11px] font-semibold text-gray-700">{lead.phone}</span>
                                                                        </div>
                                                                    ) : null
                                                                )}

                                                                {colId === 'status' && (
                                                                    <div className="flex items-center gap-1.5">
                                                                        <StatusBadge status={lead.status} />
                                                                        {(lead.contact_count || 0) > 0 && (
                                                                            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-black rounded-full border ${(lead.contact_count || 0) >= 6 ? 'bg-red-50 text-red-600 border-red-200' :
                                                                                (lead.contact_count || 0) >= 4 ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                                                                    'bg-emerald-50 text-emerald-600 border-emerald-200'
                                                                                }`} title={`${lead.contact_count} intentos de contacto`}>
                                                                                📞{lead.contact_count}
                                                                            </span>
                                                                        )}
                                                                        {(lead.engagement_score || 0) > 0 && (
                                                                            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-black rounded-full border ${(lead.engagement_score || 0) >= 10 ? 'bg-rose-50 text-rose-600 border-rose-200' :
                                                                                (lead.engagement_score || 0) >= 5 ? 'bg-orange-50 text-orange-600 border-orange-200' :
                                                                                    'bg-sky-50 text-sky-600 border-sky-200'
                                                                                }`} title={`Engagement Score: ${lead.engagement_score}`}>
                                                                                🔥{lead.engagement_score}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {colId === 'priority' && (
                                                                    <div className="flex items-center gap-2">
                                                                        <PriorityBadge priority={lead.priority} />
                                                                        <LeadScoreBadge lead={lead} variant="ring" />
                                                                    </div>
                                                                )}

                                                                {colId === 'source' && (
                                                                    lead.source && SOURCE_CONFIG[lead.source] ? (
                                                                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100 w-fit">
                                                                            <span>{SOURCE_CONFIG[lead.source].icon}</span>
                                                                            <span className="uppercase tracking-tight">{SOURCE_CONFIG[lead.source].label}</span>
                                                                        </div>
                                                                    ) : null
                                                                )}

                                                                {colId === 'value' && (
                                                                    <div>
                                                                        <div className="text-sm font-black text-slate-900">${(lead.value || 0).toLocaleString()}</div>
                                                                        {(lead.closing_amount || 0) > 0 && <div className="text-[10px] text-indigo-600 font-black uppercase tracking-tighter">Cierre: ${lead.closing_amount.toLocaleString()}</div>}
                                                                    </div>
                                                                )}

                                                                {colId === 'assigned_to' && (
                                                                    lead.assigned_to ? (() => {
                                                                        const owner = teamMembers.find(m => m.id === lead.assigned_to);
                                                                        return (
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shadow-sm">
                                                                                    {owner?.avatar_url ? (
                                                                                        <img src={owner.avatar_url} alt="" className="w-full h-full object-cover" />
                                                                                    ) : (
                                                                                        <User className="w-3.5 h-3.5 text-slate-400" />
                                                                                    )}
                                                                                </div>
                                                                                <span className="text-[11px] font-bold text-slate-600 truncate max-w-[80px]">
                                                                                    {owner?.full_name?.split(' ')[0] || owner?.email.split('@')[0]}
                                                                                </span>
                                                                            </div>
                                                                        );
                                                                    })() : <span className="text-gray-300">-</span>
                                                                )}

                                                                {colId === 'last_follow_up_at' && (() => {
                                                                    const d = lead.last_follow_up_at;
                                                                    if (!d) return (
                                                                        <span className="text-[10px] text-gray-300 font-bold">—</span>
                                                                    );
                                                                    const date = new Date(d);
                                                                    const hoursAgo = differenceInHours(new Date(), date);
                                                                    const daysAgo  = differenceInDays(new Date(), date);
                                                                    const relLabel = hoursAgo < 1 ? 'Hace menos de 1h'
                                                                        : hoursAgo < 24 ? `Hace ${hoursAgo}h`
                                                                        : daysAgo === 1 ? 'Ayer'
                                                                        : `Hace ${daysAgo}d`;
                                                                    const badgeColor = hoursAgo < 24
                                                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                                        : hoursAgo < 48
                                                                        ? 'bg-amber-50 text-amber-600 border-amber-100'
                                                                        : 'bg-red-50 text-red-500 border-red-100';
                                                                    return (
                                                                        <div className="flex flex-col gap-0.5">
                                                                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500">
                                                                                <Clock className="w-3 h-3 text-indigo-400 shrink-0" />
                                                                                <span>{(() => { try { return format(new Date(d.substring(0,10)+'T12:00:00'), 'dd MMM yyyy', { locale: es }).toUpperCase(); } catch { return '—'; } })()}</span>
                                                                            </div>
                                                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border w-fit ${badgeColor}`}>{relLabel}</span>
                                                                        </div>
                                                                    );
                                                                })()}

                                                                {colId === 'created_at' && (
                                                                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500">
                                                                        <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                                                        <span>{(() => { try { return format(new Date(lead.created_at.substring(0, 10) + 'T12:00:00'), 'dd MMM yyyy', { locale: es }).toUpperCase(); } catch { return '—'; } })()}</span>
                                                                    </div>
                                                                )}

                                                                {colId === 'internal_won_date' && (
                                                                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500">
                                                                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                                                        <span>{lead.internal_won_date ? (() => { try { return format(new Date(lead.internal_won_date.substring(0, 10) + 'T12:00:00'), 'dd MMM yyyy', { locale: es }).toUpperCase(); } catch { return '—'; } })() : '—'}</span>
                                                                    </div>
                                                                )}

                                                                {colId === 'interested_product_id' && (() => {
                                                                    const prod = products.find(p => p.id === lead.interested_product_id);
                                                                    return prod ? (
                                                                        <span className="text-[11px] font-bold text-slate-600 truncate max-w-[120px] inline-block" title={prod.name}>
                                                                            {prod.name}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-gray-300">-</span>
                                                                    );
                                                                })()}
                                                            </td>
                                                        ))}

                                                        <td className="px-4 py-4 bg-inherit" style={{ position: 'sticky', right: 0, zIndex: 2, boxShadow: '-4px 0 12px rgba(0,0,0,0.02)' }}>
                                                            <div className="flex justify-center items-center gap-1.5 transition-all opacity-70 group-hover:opacity-100">
                                                                {((lead.cotizaciones?.length ?? 0) > 0 || lead.document_path) && (
                                                                    <>
                                                                        <button
                                                                            onClick={async (e) => {
                                                                                e.stopPropagation();
                                                                                if (lead.document_path?.startsWith('cotizacion:')) {
                                                                                    const cotId = lead.document_path.replace('cotizacion:', '');
                                                                                    navigate(`/cotizaciones/${cotId}`);
                                                                                    return;
                                                                                }
                                                                                const path = lead.document_path;
                                                                                if (path) {
                                                                                    try {
                                                                                        const url = await storageService.getDownloadUrl(path);
                                                                                        window.open(url, '_blank');
                                                                                    } catch (err) {
                                                                                        console.error('Error fetching PDF url:', err);
                                                                                    }
                                                                                }
                                                                            }}
                                                                            className="p-1.5 text-blue-500 hover:text-white hover:bg-blue-600 rounded-lg transition-all shadow-sm bg-blue-50/50"
                                                                            title="Ver PDF"
                                                                        >
                                                                            <FileText className="w-4 h-4" />
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                navigate('/marketing/campaign/new', {
                                                                                    state: { preSelectedLeads: [lead.id], campaignSource: 'leads-resend' }
                                                                                });
                                                                            }}
                                                                            className="p-1.5 text-emerald-500 hover:text-white hover:bg-emerald-600 rounded-lg transition-all shadow-sm bg-emerald-50/50"
                                                                            title="Re-enviar Cotización"
                                                                        >
                                                                            <Send className="w-4 h-4" />
                                                                        </button>
                                                                    </>
                                                                )}
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); openLeadDetail(lead); }}
                                                                    className="p-1.5 text-indigo-500 hover:text-white hover:bg-indigo-600 rounded-lg transition-all shadow-sm bg-indigo-50/80"
                                                                >
                                                                    <ChevronRight className="w-4 h-4" />
                                                                </button>
                                                                {isAdmin && (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleDeleteLead(lead.id, lead.name); }}
                                                                        className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-600 rounded-lg transition-all shadow-sm bg-rose-50/50"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
    );
};
