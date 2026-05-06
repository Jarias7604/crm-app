import React, { useState, useRef, useEffect } from 'react';
import { Search, LayoutGrid, List, Layout, Download, Upload, Loader2, Plus, SlidersHorizontal, ChevronDown, CheckCircle, Filter, Calendar, X, User } from 'lucide-react';
import { Button } from '../ui/Button';
import { CustomDatePicker } from '../ui/CustomDatePicker';
import { PRIORITY_CONFIG, STATUS_CONFIG, SOURCE_CONFIG } from '../../types';
import type { Lead, LeadStatus, LeadPriority, LossReason } from '../../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface LeadToolbarProps {
    filteredLeads: Lead[];
    leads: Lead[];
    filteredPipelineTotal: number;
    teamMembers: any[];
    lossReasons: LossReason[];
    
    // States & Setters
    searchTerm: string;
    setSearchTerm: (v: string) => void;
    viewMode: 'grid' | 'list' | 'kanban';
    setViewMode: (v: 'grid' | 'list' | 'kanban') => void;
    
    statusFilter: LeadStatus | 'all' | LeadStatus[];
    setStatusFilter: (v: any) => void;
    priorityFilter: LeadPriority | 'all' | LeadPriority[];
    setPriorityFilter: (v: any) => void;
    assignedFilter: string | 'all' | string[];
    setAssignedFilter: (v: any) => void;
    sourceFilter: string | 'all' | string[];
    setSourceFilter: (v: any) => void;
    lossReasonFilter: string | 'all' | string[];
    setLossReasonFilter: (v: any) => void;
    lostAtStageFilter: string | 'all' | string[];
    setLostAtStageFilter: (v: any) => void;
    
    startDateFilter: string | null;
    setStartDateFilter: (v: string | null) => void;
    endDateFilter: string | null;
    setEndDateFilter: (v: string | null) => void;
    
    filteredLeadId: string | null;
    setFilteredLeadId: (v: string | null) => void;
    filteredLeadIds: string[] | null;
    setFilteredLeadIds: (v: string[] | null) => void;
    completedLeadIds: string[] | null;
    setCompletedLeadIds: (v: string[] | null) => void;
    calendarDateLabel: string | null;
    setCalendarDateLabel: (v: string | null) => void;
    
    // Actions
    handleDownloadTemplate: () => void;
    handleImportCSV: (e: any) => void;
    isImporting: boolean;
    setIsModalOpen: (v: boolean) => void;
    navigate: any;
    cameFromRef: any;
    setMinContactCountFilter: (v: any) => void;
    csvHelper: any;
}

export const LeadToolbar: React.FC<LeadToolbarProps> = ({
    filteredLeads, leads, filteredPipelineTotal, teamMembers, lossReasons,
    searchTerm, setSearchTerm, viewMode, setViewMode,
    statusFilter, setStatusFilter, priorityFilter, setPriorityFilter,
    assignedFilter, setAssignedFilter, sourceFilter, setSourceFilter,
    lossReasonFilter, setLossReasonFilter, lostAtStageFilter, setLostAtStageFilter,
    startDateFilter, setStartDateFilter, endDateFilter, setEndDateFilter,
    filteredLeadId, setFilteredLeadId, filteredLeadIds, setFilteredLeadIds,
    completedLeadIds, setCompletedLeadIds, calendarDateLabel, setCalendarDateLabel,
    handleDownloadTemplate, handleImportCSV, isImporting, setIsModalOpen,
    navigate, cameFromRef, setMinContactCountFilter, csvHelper
}) => {
    // Local UI states
    const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
    const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
    const [isPriorityFilterOpen, setIsPriorityFilterOpen] = useState(false);
    const [isAssignedFilterOpen, setIsAssignedFilterOpen] = useState(false);
    const [isLossReasonFilterOpen, setIsLossReasonFilterOpen] = useState(false);
    const [isLostAtStageFilterOpen, setIsLostAtStageFilterOpen] = useState(false);
    const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);

    const statusFilterRef = useRef<HTMLDivElement>(null);
    const priorityFilterRef = useRef<HTMLDivElement>(null);
    const assignedFilterRef = useRef<HTMLDivElement>(null);
    const lossReasonFilterRef = useRef<HTMLDivElement>(null);
    const lostAtStageFilterRef = useRef<HTMLDivElement>(null);
    const dateRangeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (priorityFilterRef.current && !priorityFilterRef.current.contains(event.target as Node)) setIsPriorityFilterOpen(false);
            if (assignedFilterRef.current && !assignedFilterRef.current.contains(event.target as Node)) setIsAssignedFilterOpen(false);
            if (lossReasonFilterRef.current && !lossReasonFilterRef.current.contains(event.target as Node)) setIsLossReasonFilterOpen(false);
            if (lostAtStageFilterRef.current && !lostAtStageFilterRef.current.contains(event.target as Node)) setIsLostAtStageFilterOpen(false);
            if (statusFilterRef.current && !statusFilterRef.current.contains(event.target as Node)) setIsStatusFilterOpen(false);
            if (dateRangeRef.current && !dateRangeRef.current.contains(event.target as Node)) setIsDateRangeOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const PriorityDropdown = () => (
        <div className="relative" ref={priorityFilterRef}>
            <button
                onClick={() => setIsPriorityFilterOpen(!isPriorityFilterOpen)}
                className={`flex items-center gap-2 bg-white border px-3 py-2 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-all shadow-sm h-9 min-w-[150px] justify-between ${priorityFilter !== 'all' ? 'border-indigo-300 text-indigo-600' : 'border-gray-200 text-gray-600'}`}
            >
                <div className="flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 opacity-60" />
                    <span>{priorityFilter === 'all' ? 'Prioridad' : Array.isArray(priorityFilter) ? 'Varias' : (PRIORITY_CONFIG as any)[priorityFilter]?.label}</span>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 opacity-40 transition-transform duration-300 ${isPriorityFilterOpen ? 'rotate-180' : ''}`} />
            </button>

            {isPriorityFilterOpen && (
                <div className="absolute left-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 py-2 animate-in fade-in slide-in-from-top-2">
                    <button
                        onClick={() => {
                            setPriorityFilter('all');
                            setFilteredLeadId(null);
                            setIsPriorityFilterOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors flex items-center justify-between ${priorityFilter === 'all'
                            ? 'bg-indigo-50 text-indigo-600'
                            : 'text-gray-500 hover:bg-gray-50'
                            }`}
                    >
                        <span>Todas las prioridades</span>
                        {priorityFilter === 'all' && <CheckCircle className="w-3.5 h-3.5" />}
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    {(Object.entries(PRIORITY_CONFIG) as [LeadPriority, { label: string, icon: string, color: string, textColor: string }][]).map(([key, config]) => (
                        <button
                            key={key}
                            onClick={() => {
                                setPriorityFilter(key);
                                setFilteredLeadId(null);
                                setIsPriorityFilterOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors flex items-center justify-between ${priorityFilter === key
                                ? 'bg-indigo-50 text-indigo-600'
                                : 'text-gray-500 hover:bg-gray-50'
                                }`}
                        >
                            <span className="flex items-center gap-2">
                                <span>{config.icon}</span>
                                {config.label}
                            </span>
                            {priorityFilter === key && <CheckCircle className="w-3.5 h-3.5" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );


    const StatusDropdown = () => (
        <div className="relative" ref={statusFilterRef}>
            <button
                onClick={() => setIsStatusFilterOpen(!isStatusFilterOpen)}
                className={`flex items-center gap-2 bg-white border px-3 py-2 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-all shadow-sm h-9 min-w-[150px] justify-between ${statusFilter !== 'all' ? 'border-blue-300 text-blue-600' : 'border-gray-200 text-gray-600'}`}
            >
                <div className="flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5 opacity-60" />
                    <span>{statusFilter === 'all' ? 'Estado' : Array.isArray(statusFilter) ? 'Varios' : STATUS_CONFIG[statusFilter as LeadStatus]?.label || statusFilter}</span>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 opacity-40 transition-transform duration-300 ${isStatusFilterOpen ? 'rotate-180' : ''}`} />
            </button>

            {isStatusFilterOpen && (
                <div className="absolute left-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 py-2 animate-in fade-in slide-in-from-top-2">
                    <button
                        onClick={() => { setStatusFilter('all'); setIsStatusFilterOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors ${statusFilter === 'all' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        Todos los estados
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    {(Object.entries(STATUS_CONFIG) as [LeadStatus, any][]).map(([key, config]) => (
                        <button
                            key={key}
                            onClick={() => { setStatusFilter(key); setIsStatusFilterOpen(false); }}
                            className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors flex items-center gap-2 ${statusFilter === key ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            <span>{config.icon}</span>
                            {config.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );

    


    const LossReasonDropdown = () => (
        <div className="relative" ref={lossReasonFilterRef}>
            <button
                onClick={() => setIsLossReasonFilterOpen(!isLossReasonFilterOpen)}
                className={`flex items-center gap-2 bg-white border px-3 py-2 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-all shadow-sm h-9 min-w-[150px] justify-between ${lossReasonFilter !== 'all' ? 'border-amber-300 text-amber-600' : 'border-gray-200 text-gray-600'}`}
            >
                <div className="flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 opacity-60" />
                    <span className="truncate max-w-[110px]">{lossReasonFilter === 'all' ? 'Motivo pérdida' : lossReasons.find(r => r.id === lossReasonFilter)?.reason || 'Motivo'}</span>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 opacity-40 transition-transform duration-300 ${isLossReasonFilterOpen ? 'rotate-180' : ''}`} />
            </button>

            {isLossReasonFilterOpen && (
                <div className="absolute left-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 py-2 animate-in fade-in slide-in-from-top-2">
                    <button
                        onClick={() => { setLossReasonFilter('all'); setIsLossReasonFilterOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors ${lossReasonFilter === 'all' ? 'bg-amber-50 text-amber-600' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        Todos los motivos
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    {lossReasons.map(reason => (
                        <button
                            key={reason.id}
                            onClick={() => { setLossReasonFilter(reason.id); setIsLossReasonFilterOpen(false); }}
                            className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors ${lossReasonFilter === reason.id ? 'bg-amber-50 text-amber-600' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            {reason.reason}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );


    const LossStageDropdown = () => (
        <div className="relative" ref={lostAtStageFilterRef}>
            <button
                onClick={() => setIsLostAtStageFilterOpen(!isLostAtStageFilterOpen)}
                className={`flex items-center gap-2 bg-white border px-3 py-2 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-all shadow-sm h-9 min-w-[140px] justify-between ${lostAtStageFilter !== 'all' ? 'border-rose-300 text-rose-600' : 'border-gray-200 text-gray-600'}`}
            >
                <div className="flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 opacity-60" />
                    <span>{lostAtStageFilter === 'all' ? 'Etapa pérdida' : STATUS_CONFIG[lostAtStageFilter as LeadStatus]?.label || lostAtStageFilter}</span>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 opacity-40 transition-transform duration-300 ${isLostAtStageFilterOpen ? 'rotate-180' : ''}`} />
            </button>

            {isLostAtStageFilterOpen && (
                <div className="absolute left-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 py-2 animate-in fade-in slide-in-from-top-2">
                    <button
                        onClick={() => { setLostAtStageFilter('all'); setIsLostAtStageFilterOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors ${lostAtStageFilter === 'all' ? 'bg-rose-50 text-rose-600' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        Todas las etapas
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    {(Object.entries(STATUS_CONFIG) as [LeadStatus, any][])
                        .filter(([key]) => key !== 'Perdido')
                        .map(([key, config]) => (
                            <button
                                key={key}
                                onClick={() => { setLostAtStageFilter(key); setIsLostAtStageFilterOpen(false); }}
                                className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors flex items-center gap-2 ${lostAtStageFilter === key ? 'bg-rose-50 text-rose-600' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                <span>{config.icon}</span>
                                {config.label}
                            </button>
                        ))}
                </div>
            )}
        </div>
    );


    const MobileFilterModal = () => {
        if (!isMobileFilterOpen) return null;

        const activeFiltersCount =
            (statusFilter === 'all' ? 0 : Array.isArray(statusFilter) ? statusFilter.length : 1) +
            (priorityFilter === 'all' ? 0 : Array.isArray(priorityFilter) ? priorityFilter.length : 1) +
            (assignedFilter === 'all' ? 0 : Array.isArray(assignedFilter) ? assignedFilter.length : 1) +
            (sourceFilter === 'all' ? 0 : Array.isArray(sourceFilter) ? sourceFilter.length : 1) +
            (lossReasonFilter === 'all' ? 0 : Array.isArray(lossReasonFilter) ? lossReasonFilter.length : 1) +
            (lostAtStageFilter === 'all' ? 0 : Array.isArray(lostAtStageFilter) ? lostAtStageFilter.length : 1) +
            (startDateFilter !== null ? 1 : 0) +
            (endDateFilter !== null ? 1 : 0);

        return (
            <div className="fixed inset-0 z-[100] md:hidden">
                <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
                    onClick={() => setIsMobileFilterOpen(false)}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto">
                    <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />

                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-xl font-black text-[#4449AA]">Filtros Avanzados</h3>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{activeFiltersCount} filtros activos</p>
                        </div>
                        <button
                            onClick={() => setIsMobileFilterOpen(false)}
                            className="p-2 bg-gray-50 rounded-full text-gray-400"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="space-y-6 pb-10">
                        {/* Estado del Prospecto - Multi-select */}
                        <section>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 block">Estado del Prospecto</label>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setStatusFilter('all')}
                                    className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${statusFilter === 'all' ? 'bg-[#4449AA] text-white shadow-md' : 'bg-gray-50 text-gray-500 border border-gray-100'}`}
                                >
                                    Todos
                                </button>
                                {(Object.entries(STATUS_CONFIG) as [LeadStatus, any][]).map(([key, config]) => {
                                    const isActive = Array.isArray(statusFilter) ? statusFilter.includes(key) : statusFilter === key;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => {
                                                if (statusFilter === 'all') {
                                                    setStatusFilter([key]);
                                                } else if (Array.isArray(statusFilter)) {
                                                    const next = statusFilter.includes(key) ? statusFilter.filter(s => s !== key) : [...statusFilter, key];
                                                    setStatusFilter(next.length === 0 ? 'all' : next);
                                                } else {
                                                    setStatusFilter(statusFilter === key ? 'all' : [statusFilter, key]);
                                                }
                                            }}
                                            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${isActive ? `${config.bgColor} ${config.color} shadow-md ring-2 ring-current ring-opacity-30` : 'bg-gray-50 text-gray-500 border border-gray-100'}`}
                                        >
                                            {isActive && <span>?</span>}
                                            <span>{config.icon}</span>
                                            {config.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Prioridad - Multi-select */}
                        <section>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 block">Prioridad</label>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => { setPriorityFilter('all'); setFilteredLeadId(null); }}
                                    className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${priorityFilter === 'all' ? 'bg-[#4449AA] text-white shadow-md' : 'bg-gray-50 text-gray-500 border border-gray-100'}`}
                                >
                                    Todas
                                </button>
                                {(Object.entries(PRIORITY_CONFIG) as [LeadPriority, { label: string, icon: string, color: string, textColor: string }][]).map(([key, config]) => {
                                    const isActive = Array.isArray(priorityFilter) ? priorityFilter.includes(key) : priorityFilter === key;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => {
                                                setFilteredLeadId(null);
                                                if (priorityFilter === 'all') {
                                                    setPriorityFilter([key]);
                                                } else if (Array.isArray(priorityFilter)) {
                                                    const next = priorityFilter.includes(key) ? priorityFilter.filter(s => s !== key) : [...priorityFilter, key];
                                                    setPriorityFilter(next.length === 0 ? 'all' : next);
                                                } else {
                                                    setPriorityFilter(priorityFilter === key ? 'all' : [priorityFilter, key]);
                                                }
                                            }}
                                            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${isActive ? 'bg-indigo-50 text-indigo-600 shadow-md ring-2 ring-indigo-300' : 'bg-gray-50 text-gray-500 border border-gray-100'}`}
                                        >
                                            {isActive && <span>?</span>}
                                            <span>{config.icon}</span>
                                            {config.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Fuente - Multi-select */}
                        <section>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 block">Fuente</label>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setSourceFilter('all')}
                                    className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${sourceFilter === 'all' ? 'bg-[#4449AA] text-white shadow-md' : 'bg-gray-50 text-gray-500 border border-gray-100'}`}
                                >
                                    Todas
                                </button>
                                {Object.entries(SOURCE_CONFIG).map(([key, config]) => {
                                    const isActive = Array.isArray(sourceFilter) ? sourceFilter.includes(key) : sourceFilter === key;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => {
                                                if (sourceFilter === 'all') {
                                                    setSourceFilter([key]);
                                                } else if (Array.isArray(sourceFilter)) {
                                                    const next = sourceFilter.includes(key) ? sourceFilter.filter(s => s !== key) : [...sourceFilter, key];
                                                    setSourceFilter(next.length === 0 ? 'all' : next);
                                                } else {
                                                    setSourceFilter(sourceFilter === key ? 'all' : [sourceFilter, key]);
                                                }
                                            }}
                                            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${isActive ? `${config.bgColor} ${config.color} shadow-md ring-2 ring-current ring-opacity-30` : 'bg-gray-50 text-gray-500 border border-gray-100'}`}
                                        >
                                            {isActive && <span>?</span>}
                                            {config.icon} {config.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Responsable - Multi-select */}
                        <section>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 block">Responsable</label>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setAssignedFilter('all')}
                                    className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${assignedFilter === 'all' ? 'bg-[#4449AA] text-white shadow-md' : 'bg-gray-50 text-gray-500 border border-gray-100'}`}
                                >
                                    Todos
                                </button>
                                {[{ id: 'unassigned', label: 'Sin Asignar', avatar: null }, ...teamMembers.map(m => ({ id: m.id, label: m.full_name?.split(' ')[0] || m.email, avatar: m.avatar_url }))].map(item => {
                                    const isActive = Array.isArray(assignedFilter) ? assignedFilter.includes(item.id) : assignedFilter === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => {
                                                if (assignedFilter === 'all') {
                                                    setAssignedFilter([item.id]);
                                                } else if (Array.isArray(assignedFilter)) {
                                                    const next = assignedFilter.includes(item.id) ? assignedFilter.filter(s => s !== item.id) : [...assignedFilter, item.id];
                                                    setAssignedFilter(next.length === 0 ? 'all' : next);
                                                } else {
                                                    setAssignedFilter(assignedFilter === item.id ? 'all' : [assignedFilter, item.id]);
                                                }
                                            }}
                                            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${isActive ? (item.id === 'unassigned' ? 'bg-amber-50 text-amber-600 shadow-md ring-2 ring-amber-300' : 'bg-indigo-50 text-indigo-600 shadow-md ring-2 ring-indigo-300') : 'bg-gray-50 text-gray-500 border border-gray-100'}`}
                                        >
                                            {isActive && <span>?</span>}
                                            {item.id !== 'unassigned' && (
                                                <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                                                    {item.avatar ? <img src={item.avatar} alt="" className="w-full h-full object-cover" /> : <User className="w-3 h-3 text-slate-400" />}
                                                </div>
                                            )}
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Motivo de Pérdida - Multi-select */}
                        <section>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 block">Motivo de Pérdida</label>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setLossReasonFilter('all')}
                                    className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${lossReasonFilter === 'all' ? 'bg-[#4449AA] text-white shadow-md' : 'bg-gray-50 text-gray-500 border border-gray-100'}`}
                                >
                                    Todos
                                </button>
                                {lossReasons.map(reason => {
                                    const isActive = Array.isArray(lossReasonFilter) ? lossReasonFilter.includes(reason.id) : lossReasonFilter === reason.id;
                                    return (
                                        <button
                                            key={reason.id}
                                            onClick={() => {
                                                if (lossReasonFilter === 'all') {
                                                    setLossReasonFilter([reason.id]);
                                                } else if (Array.isArray(lossReasonFilter)) {
                                                    const next = lossReasonFilter.includes(reason.id) ? lossReasonFilter.filter(s => s !== reason.id) : [...lossReasonFilter, reason.id];
                                                    setLossReasonFilter(next.length === 0 ? 'all' : next);
                                                } else {
                                                    setLossReasonFilter(lossReasonFilter === reason.id ? 'all' : [lossReasonFilter, reason.id]);
                                                }
                                            }}
                                            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${isActive ? 'bg-amber-50 text-amber-600 shadow-md ring-2 ring-amber-300' : 'bg-gray-50 text-gray-500 border border-gray-100'}`}
                                        >
                                            {isActive && <span>?</span>}
                                            {reason.reason}
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Etapa de Pérdida - Multi-select */}
                        <section>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 block">Etapa de Pérdida</label>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setLostAtStageFilter('all')}
                                    className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${lostAtStageFilter === 'all' ? 'bg-[#4449AA] text-white shadow-md' : 'bg-gray-50 text-gray-500 border border-gray-100'}`}
                                >
                                    Todas
                                </button>
                                {(Object.entries(STATUS_CONFIG) as [LeadStatus, any][])
                                    .filter(([key]) => key !== 'Perdido')
                                    .map(([key, config]) => {
                                        const isActive = Array.isArray(lostAtStageFilter) ? lostAtStageFilter.includes(key) : lostAtStageFilter === key;
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => {
                                                    if (lostAtStageFilter === 'all') {
                                                        setLostAtStageFilter([key]);
                                                    } else if (Array.isArray(lostAtStageFilter)) {
                                                        const next = lostAtStageFilter.includes(key) ? lostAtStageFilter.filter(s => s !== key) : [...lostAtStageFilter, key];
                                                        setLostAtStageFilter(next.length === 0 ? 'all' : next);
                                                    } else {
                                                        setLostAtStageFilter(lostAtStageFilter === key ? 'all' : [lostAtStageFilter, key]);
                                                    }
                                                }}
                                                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${isActive ? 'bg-rose-50 text-rose-600 shadow-md ring-2 ring-rose-300' : 'bg-gray-50 text-gray-500 border border-gray-100'}`}
                                            >
                                                {isActive && <span>?</span>}
                                                <span>{config.icon}</span>
                                                {config.label}
                                            </button>
                                        );
                                    })}
                            </div>
                        </section>

                        <button
                            onClick={() => {
                                setFilteredLeadId(null);
                                setFilteredLeadIds(null);
                                setCompletedLeadIds(null);
                                setCalendarDateLabel(null);
                                setStatusFilter('all');
                                setPriorityFilter('all');
                                setAssignedFilter('all');
                                setSourceFilter('all');
                                setLossReasonFilter('all');
                                setLostAtStageFilter('all');
                                setStartDateFilter(null);
                                setEndDateFilter(null);
                                setIsMobileFilterOpen(false);
                            }}
                            className="w-full py-4 text-red-500 font-bold text-sm uppercase tracking-widest bg-red-50 rounded-2xl mt-4"
                        >
                            Limpiar Filtros
                        </button>

                        <button
                            onClick={() => setIsMobileFilterOpen(false)}
                            className="w-full py-5 bg-[#4449AA] text-white font-black text-sm uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-indigo-100"
                        >
                            Aplicar Filtros
                        </button>
                    </div>
                </div>
            </div>
        );
    };



    return (
        <>
            {MobileFilterModal()}
            {/* -- ROW 1: Title + Stats · Search + Actions -- */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    {/* Left: Title + Stats */}
                    <div className="flex items-center justify-between md:justify-start gap-4 w-full md:w-auto">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-[#4449AA] tracking-tight">Lead Discovery</h1>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block" />
                                <p className="text-[13px] text-gray-500 font-semibold">
                                    {filteredLeads.length} de {leads.length} prospectos
                                    {filteredPipelineTotal > 0 && (
                                        <span className="text-emerald-600 ml-1">· ${filteredPipelineTotal.toLocaleString()}</span>
                                    )}
                                </p>
                                {/* Badge Legend Tooltip */}
                                <div className="relative group/legend ml-1">
                                    <button className="w-4 h-4 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors" type="button">
                                        <span className="text-[8px] font-black text-gray-400 leading-none">?</span>
                                    </button>
                                    <div className="absolute left-0 top-full mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-gray-100 p-3 opacity-0 invisible group-hover/legend:opacity-100 group-hover/legend:visible transition-all duration-200 z-50">
                                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">Indicadores</p>
                                        <div className="space-y-2">
                                            <div className="flex items-start gap-2">
                                                <span className="text-[10px] shrink-0">📞</span>
                                                <div>
                                                    <p className="text-[10px] font-bold text-gray-700">Intentos de contacto</p>
                                                    <p className="text-[9px] text-gray-400">Verde &lt;4 · Ámbar 4-5 · Rojo 6+</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <span className="text-[10px] shrink-0">🔥</span>
                                                <div>
                                                    <p className="text-[10px] font-bold text-gray-700">Engagement Score</p>
                                                    <p className="text-[9px] text-gray-400">Enviado=1pt · Abierto=5 · Click=10</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span><span className="text-[8px] text-gray-400">1-4</span></span>
                                                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span><span className="text-[8px] text-gray-400">5-9</span></span>
                                                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span><span className="text-[8px] text-gray-400">10+</span></span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Mobile filter trigger */}
                        <button
                            onClick={() => setIsMobileFilterOpen(true)}
                            className="md:hidden p-3 bg-white border border-gray-100 rounded-2xl shadow-sm text-[#4449AA] relative"
                        >
                            <SlidersHorizontal className="w-5 h-5" />
                            {(() => {
                                const totalChips =
                                    (statusFilter === 'all' ? 0 : Array.isArray(statusFilter) ? statusFilter.length : 1) +
                                    (priorityFilter === 'all' ? 0 : Array.isArray(priorityFilter) ? priorityFilter.length : 1) +
                                    (assignedFilter === 'all' ? 0 : Array.isArray(assignedFilter) ? assignedFilter.length : 1) +
                                    (sourceFilter === 'all' ? 0 : Array.isArray(sourceFilter) ? sourceFilter.length : 1) +
                                    (lossReasonFilter === 'all' ? 0 : Array.isArray(lossReasonFilter) ? lossReasonFilter.length : 1) +
                                    (lostAtStageFilter === 'all' ? 0 : Array.isArray(lostAtStageFilter) ? lostAtStageFilter.length : 1);
                                return totalChips > 0 ? (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white">
                                        {totalChips}
                                    </span>
                                ) : null;
                            })()}
                        </button>
                    </div>

                    {/* Right: Search + View toggles + Actions */}
                    <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
                        <div className="flex-1 min-w-[220px] max-w-sm">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre, email, empresa..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                />
                                {searchTerm && (
                                    <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex bg-gray-50 rounded-xl p-1 border border-gray-100">
                            <button onClick={() => setViewMode('grid')} className={`flex items-center justify-center gap-1.5 px-3 py-2.5 md:p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`} title="Cards">
                                <LayoutGrid className="w-5 h-5 md:w-4 md:h-4" /><span className="md:hidden text-xs font-semibold ml-1">Cards</span>
                            </button>
                            <button onClick={() => setViewMode('list')} className={`flex items-center justify-center gap-1.5 px-3 py-2.5 md:p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`} title="Lista">
                                <List className="w-5 h-5 md:w-4 md:h-4" /><span className="md:hidden text-xs font-semibold ml-1">Lista</span>
                            </button>
                            <button onClick={() => setViewMode('kanban')} className={`flex items-center justify-center gap-1.5 px-3 py-2.5 md:p-2 rounded-lg transition-all ${viewMode === 'kanban' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`} title="Kanban">
                                <Layout className="w-5 h-5 md:w-4 md:h-4" /><span className="md:hidden text-xs font-semibold ml-1">Kanban</span>
                            </button>
                        </div>
                        <div className="hidden sm:flex items-center gap-1.5">
                            <Button variant="outline" className="flex items-center gap-1.5 h-9 px-3 text-xs font-semibold border-gray-200 text-gray-600" onClick={handleDownloadTemplate}>
                                <Download className="w-3.5 h-3.5" /><span className="hidden lg:inline ml-1">Plantilla</span>
                            </Button>
                            <Button variant="outline" className="flex items-center gap-1.5 h-9 px-3 text-xs font-semibold border-gray-200 text-gray-600" onClick={() => { const l = filteredLeads.length > 0 ? filteredLeads : leads; csvHelper.exportLeads(l, teamMembers); toast.success('Exportación iniciada'); }}>
                                <Download className="w-3.5 h-3.5 rotate-180" /><span className="hidden lg:inline ml-1">Exportar</span>
                            </Button>
                            <div className="relative">
                                <input type="file" accept=".csv,.xlsx" onChange={handleImportCSV} className="absolute inset-0 opacity-0 cursor-pointer" disabled={isImporting} />
                                <Button variant="outline" className="flex items-center gap-1.5 h-9 px-3 text-xs font-semibold border-gray-200 text-gray-600" disabled={isImporting}>
                                    {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                    <span className="hidden lg:inline ml-1">Importar</span>
                                </Button>
                            </div>
                        </div>
                        <Button onClick={() => setIsModalOpen(true)} className="flex-1 sm:flex-none h-9 bg-[#4449AA] hover:bg-[#383d8f] px-5 text-xs font-bold text-white shadow-md shadow-indigo-100 transition-all border-none rounded-xl">
                            <Plus className="w-4 h-4 mr-1.5" />Nuevo Prospecto
                        </Button>
                    </div>
                </div>

                {/* ROW 2: Filter Toolbar */}
                <div className="hidden md:flex items-center gap-2 bg-white border border-gray-100 rounded-2xl px-4 py-2.5 shadow-sm flex-wrap">
                    <span className="text-[11px] font-semibold text-gray-400">Filtros</span>
                    <div className="w-px h-4 bg-gray-200 mx-1" />
                    <StatusDropdown />
                    <PriorityDropdown />
                    <div className="relative" ref={assignedFilterRef}>
                        <button
                            onClick={() => setIsAssignedFilterOpen(!isAssignedFilterOpen)}
                            className={`flex items-center gap-2 bg-white border px-3 py-2 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-all shadow-sm h-9 min-w-[130px] justify-between ${assignedFilter !== 'all' ? 'border-indigo-300 text-indigo-600 bg-indigo-50/30' : 'border-gray-200 text-gray-600'}`}
                        >
                            <div className="flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5 opacity-60" />
                                <span>{assignedFilter === 'all' ? 'Responsable' : assignedFilter === 'unassigned' ? 'Sin asignar' : teamMembers.find(m => m.id === assignedFilter)?.full_name?.split(' ')[0] || 'Agente'}</span>
                            </div>
                            <ChevronDown className={`h-3.5 w-3.5 opacity-40 transition-transform duration-300 ${isAssignedFilterOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isAssignedFilterOpen && (
                            <div className="absolute left-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 py-2 animate-in fade-in slide-in-from-top-2">
                                <button onClick={() => { setAssignedFilter('all'); setIsAssignedFilterOpen(false); }} className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors ${assignedFilter === 'all' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}>Todos los responsables</button>
                                <div className="border-t border-gray-100 my-1" />
                                {teamMembers.map(member => (
                                    <button key={member.id} onClick={() => { setAssignedFilter(member.id); setIsAssignedFilterOpen(false); }} className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center gap-2 ${assignedFilter === member.id ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}>
                                        <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">{member.avatar_url ? <img src={member.avatar_url} alt="" className="w-full h-full object-cover" /> : <User className="w-3 h-3 text-slate-400" />}</div>
                                        {member.full_name || member.email}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="w-px h-4 bg-gray-200 mx-1" />
                    <LossReasonDropdown />
                    <LossStageDropdown />

                    {/* -- Spacer pushes date range to the right -- */}
                    <div className="flex-1" />

                    {/* -- Date Range Picker -- */}
                    <div className="relative" ref={dateRangeRef}>
                        <button
                            onClick={() => setIsDateRangeOpen(!isDateRangeOpen)}
                            className={`flex items-center gap-2 border px-3 py-2 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-all shadow-sm h-9 ${(startDateFilter || endDateFilter) ? 'border-teal-300 text-teal-700 bg-teal-50/40' : 'border-gray-200 text-gray-600 bg-white'}`}
                        >
                            <Calendar className="h-3.5 w-3.5 opacity-60 flex-shrink-0" />
                            <span>
                                {startDateFilter || endDateFilter
                                    ? `${startDateFilter ? format(new Date(startDateFilter + 'T12:00:00'), 'dd MMM', { locale: es }) : '…'} – ${endDateFilter ? format(new Date(endDateFilter + 'T12:00:00'), 'dd MMM', { locale: es }) : '…'}`
                                    : 'Período'}
                            </span>
                            {(startDateFilter || endDateFilter) ? (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setStartDateFilter(null); setEndDateFilter(null); }}
                                    className="ml-0.5 text-teal-400 hover:text-teal-700 transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            ) : (
                                <ChevronDown className={`h-3.5 w-3.5 opacity-40 transition-transform duration-300 ${isDateRangeOpen ? 'rotate-180' : ''}`} />
                            )}
                        </button>

                        {isDateRangeOpen && (
                            <div className="absolute right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 p-4 animate-in fade-in slide-in-from-top-2 duration-200" style={{ minWidth: '320px' }}>
                                {/* Header */}
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[11px] font-black text-gray-400 uppercase tracking-[0.15em]">Rango de fechas</span>
                                    <button onClick={() => setIsDateRangeOpen(false)} className="text-gray-300 hover:text-gray-500 transition-colors p-1 rounded-lg hover:bg-gray-50">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {/* Presets */}
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                    {[
                                        { label: 'Hoy', days: 0 },
                                        { label: 'Últ. 7 días', days: 7 },
                                        { label: 'Últ. 30 días', days: 30 },
                                        { label: 'Este mes', days: -1 },
                                    ].map(({ label, days }) => (
                                        <button
                                            key={label}
                                            onClick={() => {
                                                const today = new Date();
                                                const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
                                                if (days === 0) {
                                                    setStartDateFilter(fmt(today));
                                                    setEndDateFilter(fmt(today));
                                                } else if (days === -1) {
                                                    const start = new Date(today.getFullYear(), today.getMonth(), 1);
                                                    setStartDateFilter(fmt(start));
                                                    setEndDateFilter(fmt(today));
                                                } else {
                                                    const start = new Date(today);
                                                    start.setDate(today.getDate() - days);
                                                    setStartDateFilter(fmt(start));
                                                    setEndDateFilter(fmt(today));
                                                }
                                                setIsDateRangeOpen(false);
                                            }}
                                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-gray-500 bg-gray-50 border border-gray-100 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200 transition-all"
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>

                                <div className="border-t border-gray-50 my-3" />

                                {/* Date pickers — forceOpenDown previene que el calendario se salga por arriba */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-1.5 block">Desde</label>
                                        <CustomDatePicker
                                            value={startDateFilter || ''}
                                            onChange={(d) => setStartDateFilter(d || null)}
                                            placeholder="Inicio"
                                            variant="light"
                                            forceOpenDown
                                            alignRight
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-1.5 block">Hasta</label>
                                        <CustomDatePicker
                                            value={endDateFilter || ''}
                                            onChange={(d) => setEndDateFilter(d || null)}
                                            placeholder="Fin"
                                            variant="light"
                                            minDate={startDateFilter || undefined}
                                            forceOpenDown
                                            alignRight
                                        />
                                    </div>
                                </div>

                                {/* Apply button */}
                                <button
                                    onClick={() => setIsDateRangeOpen(false)}
                                    className="mt-3 w-full py-2 rounded-xl text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-sm shadow-teal-100"
                                >
                                    Aplicar
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ROW 3: Active filter chips */}
                {(filteredLeadId || filteredLeadIds || calendarDateLabel || statusFilter !== 'all' || priorityFilter !== 'all' || assignedFilter !== 'all' || sourceFilter !== 'all' || lossReasonFilter !== 'all' || lostAtStageFilter !== 'all' || startDateFilter || endDateFilter) && (
                    <div className="hidden md:flex items-center gap-2 flex-wrap animate-in fade-in slide-in-from-top-1 duration-200">
                        <span className="text-[11px] text-gray-400 font-medium">Activos:</span>
                        {calendarDateLabel && (
                            <span className="inline-flex items-center gap-1.5 bg-teal-50 text-teal-700 border border-teal-200 px-2.5 py-1 rounded-lg text-xs font-semibold capitalize">
                                📅 {calendarDateLabel} · {completedLeadIds?.length ?? 0}/{filteredLeadIds?.length ?? 0} hechos
                                <button onClick={() => { setFilteredLeadIds(null); setCompletedLeadIds(null); setCalendarDateLabel(null); }} className="hover:text-teal-900 ml-0.5"><X className="w-3 h-3" /></button>
                            </span>
                        )}
                        {statusFilter !== 'all' && (
                            <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg text-xs font-semibold">
                                Estado: {Array.isArray(statusFilter) ? `${statusFilter.length} sel.` : STATUS_CONFIG[statusFilter as LeadStatus]?.label || statusFilter}
                                <button onClick={() => setStatusFilter('all')} className="hover:text-blue-900 ml-0.5"><X className="w-3 h-3" /></button>
                            </span>
                        )}
                        {priorityFilter !== 'all' && (
                            <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-lg text-xs font-semibold">
                                Prioridad: {Array.isArray(priorityFilter) ? `${priorityFilter.length} sel.` : (PRIORITY_CONFIG as any)[priorityFilter]?.label || priorityFilter}
                                <button onClick={() => { setPriorityFilter('all'); setFilteredLeadId(null); }} className="hover:text-indigo-900 ml-0.5"><X className="w-3 h-3" /></button>
                            </span>
                        )}
                        {assignedFilter !== 'all' && (
                            <span className="inline-flex items-center gap-1.5 bg-violet-50 text-violet-700 border border-violet-200 px-2.5 py-1 rounded-lg text-xs font-semibold">
                                Responsable: {assignedFilter === 'unassigned' ? 'Sin asignar' : Array.isArray(assignedFilter) ? `${assignedFilter.length} sel.` : teamMembers.find(m => m.id === assignedFilter)?.full_name?.split(' ')[0] || 'Agente'}
                                <button onClick={() => setAssignedFilter('all')} className="hover:text-violet-900 ml-0.5"><X className="w-3 h-3" /></button>
                            </span>
                        )}
                        {sourceFilter !== 'all' && (
                            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs font-semibold">
                                Fuente: {Array.isArray(sourceFilter) ? `${sourceFilter.length} sel.` : SOURCE_CONFIG[sourceFilter]?.label || sourceFilter}
                                <button onClick={() => setSourceFilter('all')} className="hover:text-emerald-900 ml-0.5"><X className="w-3 h-3" /></button>
                            </span>
                        )}
                        {lossReasonFilter !== 'all' && (
                            <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-lg text-xs font-semibold">
                                Motivo: {Array.isArray(lossReasonFilter) ? `${lossReasonFilter.length} sel.` : lossReasons.find(r => r.id === lossReasonFilter)?.reason || 'Motivo'}
                                <button onClick={() => setLossReasonFilter('all')} className="hover:text-amber-900 ml-0.5"><X className="w-3 h-3" /></button>
                            </span>
                        )}
                        {lostAtStageFilter !== 'all' && (
                            <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-lg text-xs font-semibold">
                                Etapa: {Array.isArray(lostAtStageFilter) ? `${lostAtStageFilter.length} sel.` : STATUS_CONFIG[lostAtStageFilter as LeadStatus]?.label || lostAtStageFilter}
                                <button onClick={() => setLostAtStageFilter('all')} className="hover:text-rose-900 ml-0.5"><X className="w-3 h-3" /></button>
                            </span>
                        )}
                        {startDateFilter && (
                            <span className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-semibold">
                                Desde: {format(startDateFilter.length === 10 ? new Date(startDateFilter + 'T12:00:00') : new Date(startDateFilter), 'dd/MM/yyyy')}
                                <button onClick={() => setStartDateFilter(null)} className="hover:text-slate-900 ml-0.5"><X className="w-3 h-3" /></button>
                            </span>
                        )}
                        {endDateFilter && (
                            <span className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-semibold">
                                Hasta: {format(endDateFilter.length === 10 ? new Date(endDateFilter + 'T12:00:00') : new Date(endDateFilter), 'dd/MM/yyyy')}
                                <button onClick={() => setEndDateFilter(null)} className="hover:text-slate-900 ml-0.5"><X className="w-3 h-3" /></button>
                            </span>
                        )}
                        <button
                            onClick={() => {
                                if (cameFromRef.current === 'calendar') { cameFromRef.current = null; navigate('/calendar'); return; }
                                setFilteredLeadId(null); setFilteredLeadIds(null);
                                setStatusFilter('all'); setPriorityFilter('all'); setAssignedFilter('all');
                                setSourceFilter('all'); setLossReasonFilter('all'); setLostAtStageFilter('all');
                                setStartDateFilter(null); setEndDateFilter(null); setMinContactCountFilter(null);
                            }}
                            className="text-xs font-semibold text-gray-400 hover:text-red-500 transition-colors ml-1 flex items-center gap-1"
                        >
                            <X className="w-3 h-3" /> Limpiar todo
                        </button>
                    </div>
                )}

                
        </>
    );
};
