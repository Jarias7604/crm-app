import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import type { Lead, LeadStatus } from '../types';
import { SOURCE_CONFIG } from '../types';
import {
    MoreVertical,
    Building2,
    Clock,
    Phone,
    Mail,
    User,
    Target,
    Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRef, useEffect, useCallback } from 'react';

interface LeadKanbanProps {
    leads: Lead[];
    teamMembers: any[];
    onUpdateStatus: (leadId: string, newStatus: LeadStatus) => Promise<void>;
    onOpenDetail: (lead: Lead) => void;
}

const COLUMNS: LeadStatus[] = [
    'Prospecto',
    'Lead calificado',
    'En seguimiento',
    'Negociación',
    'Cerrado',
    'Cliente'
];

const COLUMN_COLORS: Record<LeadStatus, string> = {
    'Prospecto': 'bg-slate-700',
    'Lead calificado': 'bg-blue-800',
    'En seguimiento': 'bg-indigo-700',
    'Negociación': 'bg-cyan-700',
    'Cerrado': 'bg-emerald-700',
    'Cliente': 'bg-blue-600',
    'Perdido': 'bg-gray-500',
    'Erróneo': 'bg-red-800',
};

// ─── Auto-scroll zone width in px (how close to the edge triggers scroll)
const SCROLL_ZONE = 120;
// ─── Max scroll speed in px per frame
const MAX_SPEED = 18;

export function LeadKanban({ leads, teamMembers, onUpdateStatus, onOpenDetail }: LeadKanbanProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const animFrameRef = useRef<number | null>(null);
    const mouseXRef = useRef<number>(0);

    const onDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const newStatus = destination.droppableId as LeadStatus;
        await onUpdateStatus(draggableId, newStatus);
    };

    const getLeadsByStatus = (status: LeadStatus) => {
        return leads.filter(lead => lead.status === status);
    };

    const getColumnTotal = (status: LeadStatus) => {
        return getLeadsByStatus(status).reduce((sum, lead) => sum + (lead.value || 0), 0);
    };

    // ── Auto-scroll logic ──────────────────────────────────────────────────
    const autoScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;

        const { left, right } = el.getBoundingClientRect();
        const mouseX = mouseXRef.current;

        let speed = 0;

        if (mouseX < left + SCROLL_ZONE) {
            // Near left edge → scroll left
            const dist = mouseX - left;
            speed = -MAX_SPEED * (1 - Math.max(dist, 0) / SCROLL_ZONE);
        } else if (mouseX > right - SCROLL_ZONE) {
            // Near right edge → scroll right
            const dist = right - mouseX;
            speed = MAX_SPEED * (1 - Math.max(dist, 0) / SCROLL_ZONE);
        }

        if (speed !== 0) {
            el.scrollLeft += speed;
        }

        animFrameRef.current = requestAnimationFrame(autoScroll);
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        mouseXRef.current = e.clientX;
    }, []);

    const handleMouseEnter = useCallback(() => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = requestAnimationFrame(autoScroll);
    }, [autoScroll]);

    const handleMouseLeave = useCallback(() => {
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = null;
        }
    }, []);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        el.addEventListener('mousemove', handleMouseMove);
        el.addEventListener('mouseenter', handleMouseEnter);
        el.addEventListener('mouseleave', handleMouseLeave);

        return () => {
            el.removeEventListener('mousemove', handleMouseMove);
            el.removeEventListener('mouseenter', handleMouseEnter);
            el.removeEventListener('mouseleave', handleMouseLeave);
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        };
    }, [handleMouseMove, handleMouseEnter, handleMouseLeave]);
    // ──────────────────────────────────────────────────────────────────────

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div
                ref={scrollRef}
                className="flex gap-1 overflow-x-auto pb-6 -mx-4 px-4 min-h-[calc(100vh-250px)] scroll-smooth"
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#e2e8f0 transparent' }}
            >
                {COLUMNS.map((status, idx) => (
                    <div key={status} className="flex-shrink-0 w-80 flex flex-col group">
                        {/* Column Header - Arrow Style */}
                        <div className="relative mb-6 pr-4">
                            <div className={`${COLUMN_COLORS[status]} h-16 flex flex-col justify-center px-6 relative z-10 shadow-lg`}
                                style={{
                                    clipPath: idx === COLUMNS.length - 1
                                        ? 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)'
                                        : 'polygon(0% 0%, 85% 0%, 100% 50%, 85% 100%, 0% 100%)'
                                }}>
                                <div className="flex items-center justify-between text-white pr-4">
                                    <div>
                                        <h3 className="font-black text-[11px] uppercase tracking-[0.2em] opacity-80 leading-none mb-1">
                                            {status}
                                        </h3>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-lg font-black tracking-tighter">
                                                {getLeadsByStatus(status).length}
                                            </span>
                                            <span className="text-[10px] font-bold opacity-60">LEADS</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-bold opacity-60 uppercase tracking-widest leading-none mb-1">Valor Total</p>
                                        <p className="text-sm font-black tracking-tight text-white/90">
                                            ${getColumnTotal(status).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Droppable Area */}
                        <Droppable droppableId={status}>
                            {(provided, snapshot) => (
                                <div
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                    className={`flex-1 rounded-2xl transition-all duration-300 ${snapshot.isDraggingOver
                                        ? 'bg-blue-50/50 ring-2 ring-blue-200 ring-inset'
                                        : 'bg-transparent'
                                        } p-2 space-y-4 min-h-[300px]`}
                                >
                                    {getLeadsByStatus(status).map((lead, index) => (
                                        <Draggable key={lead.id} draggableId={lead.id} index={index}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    {...provided.dragHandleProps}
                                                    onClick={() => onOpenDetail(lead)}
                                                    className={`bg-white rounded-[20px] border border-slate-200/60 p-5 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] hover:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-300 group/card cursor-pointer relative overflow-hidden ${snapshot.isDragging ? 'rotate-1 scale-105 shadow-2xl ring-2 ring-blue-500/20 z-50' : ''
                                                        }`}
                                                >
                                                    {/* Priority Indicator Dot */}
                                                    <div className="absolute top-5 left-5">
                                                        {(() => {
                                                            const priorityColors = {
                                                                very_high: 'bg-rose-500 shadow-rose-200',
                                                                high: 'bg-orange-500 shadow-orange-200',
                                                                medium: 'bg-amber-400 shadow-amber-100',
                                                                low: 'bg-blue-400 shadow-blue-100'
                                                            };
                                                            return (
                                                                <div className={`w-2.5 h-2.5 rounded-full ${priorityColors[lead.priority as keyof typeof priorityColors]} shadow-[0_0_8px_2px_rgba(0,0,0,0)] animate-pulse`}></div>
                                                            );
                                                        })()}
                                                    </div>

                                                    <div className="flex justify-end items-center mb-4 pl-4">
                                                        <button className="text-slate-300 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-50">
                                                            <MoreVertical className="w-4 h-4" />
                                                        </button>
                                                    </div>

                                                    {/* Content */}
                                                    <div className="space-y-4">
                                                        <div className="space-y-1">
                                                            <h4 className="font-bold text-[15px] text-slate-900 group-hover/card:text-blue-600 transition-colors leading-tight">
                                                                {lead.name}
                                                            </h4>

                                                            {lead.company_name && (
                                                                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                                                                    <Building2 className="w-3.5 h-3.5 opacity-40" />
                                                                    <span className="truncate">{lead.company_name}</span>
                                                                </div>
                                                            )}

                                                            {lead.source && SOURCE_CONFIG[lead.source] && (
                                                                <div className="flex items-center gap-1.5 mt-1">
                                                                    <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-md border ${SOURCE_CONFIG[lead.source].bgColor} ${SOURCE_CONFIG[lead.source].color} border-current opacity-80`}>
                                                                        {SOURCE_CONFIG[lead.source].icon} {SOURCE_CONFIG[lead.source].label}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center justify-between py-3 border-y border-slate-50">
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Valor</span>
                                                                <span className="text-lg font-black text-slate-900 tracking-tight">
                                                                    ${lead.value?.toLocaleString() || '0'}
                                                                </span>
                                                            </div>

                                                            {lead.assigned_to ? (() => {
                                                                const assignee = teamMembers.find(m => m.id === lead.assigned_to);
                                                                return (
                                                                    <div className="relative">
                                                                        {assignee?.avatar_url ? (
                                                                            <img
                                                                                src={assignee.avatar_url}
                                                                                alt=""
                                                                                className="w-9 h-9 rounded-full object-cover border-2 border-white shadow-md ring-1 ring-slate-100"
                                                                            />
                                                                        ) : (
                                                                            <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center border-2 border-white shadow-md ring-1 ring-slate-100">
                                                                                <User className="w-4 h-4 text-slate-400" />
                                                                            </div>
                                                                        )}
                                                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100">
                                                                            <Target className="w-2.5 h-2.5 text-blue-500" />
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })() : (
                                                                <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center border border-dashed border-slate-300">
                                                                    <User className="w-4 h-4 text-slate-300" />
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Footer - Dates & Icons */}
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex flex-col gap-1.5">
                                                                <div className={`flex items-center gap-1.5 text-[11px] font-bold ${lead.next_followup_date && new Date(lead.next_followup_date) < new Date()
                                                                    ? 'text-rose-500'
                                                                    : 'text-slate-400'
                                                                    }`}>
                                                                    <div className="bg-slate-50 px-2 py-0.5 rounded-md flex items-center gap-1.5 border border-slate-100">
                                                                        <Clock className="w-3 h-3 opacity-60" />
                                                                        <span className="whitespace-nowrap font-black">Prox: {lead.next_followup_date ? (() => {
                                                                            try {
                                                                                const pureDate = lead.next_followup_date.split('T')[0];
                                                                                return format(new Date(`${pureDate}T12:00:00`), 'dd MMM', { locale: es });
                                                                            } catch (e) { return 'TBD'; }
                                                                        })() : 'TBD'}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                                                                    <div className="bg-slate-50 px-2 py-0.5 rounded-md flex items-center gap-1.5 border border-slate-100">
                                                                        <Calendar className="w-3 h-3 opacity-60" />
                                                                        <span className="whitespace-nowrap font-bold">Ingreso: {(() => { try { return format(new Date(lead.created_at.substring(0, 10) + 'T12:00:00'), 'dd MMM', { locale: es }); } catch { return '—'; } })()}</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex gap-1.5">
                                                                {lead.phone && (
                                                                    <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100/50">
                                                                        <Phone className="w-3.5 h-3.5" />
                                                                    </div>
                                                                )}
                                                                {lead.email && (
                                                                    <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100/50">
                                                                        <Mail className="w-3.5 h-3.5" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </div>
                ))}
            </div>
        </DragDropContext>
    );
}
