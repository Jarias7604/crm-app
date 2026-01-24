import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import type { Lead, LeadStatus } from '../types';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../types';
import {
    MoreVertical,
    Building2,
    DollarSign,
    Clock,
    Phone,
    Mail,
    User
} from 'lucide-react';
import { format } from 'date-fns';

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

export function LeadKanban({ leads, teamMembers, onUpdateStatus, onOpenDetail }: LeadKanbanProps) {
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

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-6 -mx-4 px-4 min-h-[calc(100vh-250px)]">
                {COLUMNS.map(status => (
                    <div key={status} className="flex-shrink-0 w-80 flex flex-col group">
                        {/* Column Header */}
                        <div className="mb-4 flex items-center justify-between px-2">
                            <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${STATUS_CONFIG[status].bgColor} border-2 border-white shadow-sm`}></div>
                                <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wider">
                                    {status}
                                </h3>
                                <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-full border border-gray-200">
                                    {getLeadsByStatus(status).length}
                                </span>
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
                                        : 'bg-gray-50/30'
                                        } p-2 space-y-3 min-h-[150px]`}
                                >
                                    {getLeadsByStatus(status).map((lead, index) => (
                                        <Draggable key={lead.id} draggableId={lead.id} index={index}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    {...provided.dragHandleProps}
                                                    onClick={() => onOpenDetail(lead)}
                                                    className={`bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all group/card cursor-pointer relative ${snapshot.isDragging ? 'rotate-2 scale-105 shadow-xl ring-2 ring-blue-500 z-50' : ''
                                                        }`}
                                                >
                                                    {/* Card Header */}
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${PRIORITY_CONFIG[lead.priority].color} ${PRIORITY_CONFIG[lead.priority].textColor}`}>
                                                            {PRIORITY_CONFIG[lead.priority].label}
                                                        </div>
                                                        <button className="text-gray-300 hover:text-gray-600 transition-colors">
                                                            <MoreVertical className="w-4 h-4" />
                                                        </button>
                                                    </div>

                                                    {/* Content */}
                                                    <div className="space-y-2">
                                                        <h4 className="font-bold text-gray-900 group-hover/card:text-blue-600 transition-colors">
                                                            {lead.name}
                                                        </h4>

                                                        {lead.company_name && (
                                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                                <Building2 className="w-3.5 h-3.5 opacity-70" />
                                                                <span className="truncate">{lead.company_name}</span>
                                                            </div>
                                                        )}

                                                        <div className="flex items-center justify-between pt-2">
                                                            <div className="flex items-center gap-3">
                                                                {lead.assigned_to ? (() => {
                                                                    const assignee = teamMembers.find(m => m.id === lead.assigned_to);
                                                                    return assignee?.avatar_url ? (
                                                                        <img
                                                                            src={assignee.avatar_url}
                                                                            alt=""
                                                                            className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm ring-1 ring-gray-100"
                                                                            title={`Asignado a: ${assignee.full_name || assignee.email}`}
                                                                        />
                                                                    ) : (
                                                                        <div
                                                                            className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border-2 border-white shadow-sm ring-1 ring-gray-100"
                                                                            title={`Asignado a: ${assignee?.full_name || assignee?.email || 'Desconocido'}`}
                                                                        >
                                                                            <User className="w-5 h-5 text-blue-400" />
                                                                        </div>
                                                                    );
                                                                })() : (
                                                                    <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center border border-dashed border-gray-300">
                                                                        <User className="w-5 h-5 text-gray-300" />
                                                                    </div>
                                                                )}
                                                                <span className="text-[10px] text-gray-400 font-medium">Responsable</span>
                                                            </div>

                                                            <div className="text-right">
                                                                <p className="text-xs font-black text-green-600 flex items-center justify-end gap-1">
                                                                    <DollarSign className="w-3 h-3" />
                                                                    {lead.value?.toLocaleString() || '0'}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Footer / Deadlines */}
                                                        {lead.next_followup_date && (
                                                            <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between text-[10px]">
                                                                <div className={`flex items-center gap-1.5 font-bold ${new Date(lead.next_followup_date) < new Date()
                                                                    ? 'text-red-500'
                                                                    : 'text-gray-400'
                                                                    }`}>
                                                                    <Clock className="w-3 h-3" />
                                                                    {format(new Date(lead.next_followup_date), 'dd MMM')}
                                                                </div>

                                                                <div className="flex gap-2">
                                                                    {lead.phone && <Phone className="w-3 h-3 text-gray-300" />}
                                                                    {lead.email && <Mail className="w-3 h-3 text-gray-300" />}
                                                                </div>
                                                            </div>
                                                        )}
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

