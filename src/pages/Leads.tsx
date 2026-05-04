import { useEffect, useState, useRef } from 'react';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { LeadTable } from '../components/leads/LeadTable';
import { LeadGrid } from '../components/leads/LeadGrid';
import { LeadDetailPanel } from '../components/leads/LeadDetailPanel';
import { StatusBadge } from '../components/leads/StatusBadge';
import { PriorityBadge } from '../components/leads/PriorityBadge';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { leadsService } from '../services/leads';
import type { Lead, LeadStatus, LeadPriority, FollowUp, LossReason, Industry } from '../types';
import { PRIORITY_CONFIG, STATUS_CONFIG, ACTION_TYPES, SOURCE_CONFIG, SOURCE_OPTIONS } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Plus, User, Phone, Mail, DollarSign, Clock, ChevronRight, X, TrendingUp, LayoutGrid, List, Download, Upload, Loader2, FileText, UploadCloud, Trash2, Layout, MessageSquare, Send, Smartphone, Filter, ChevronDown, CheckCircle, Shield, ArrowUpDown, Search, Target, Calendar, Settings2, SlidersHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { csvHelper } from '../utils/csvHelper';
import { storageService } from '../services/storage';
import { useAuth } from '../auth/AuthProvider';
import { usePermissions } from '../hooks/usePermissions';
import { useMemo } from 'react';
import { CreateLeadFullscreen } from '../components/CreateLeadFullscreen';
import { QuickActionLogger } from '../components/QuickCallLogger';
import { LeadKanban } from '../components/LeadKanban';
import { logger } from '../utils/logger';
import { callTracker } from '../utils/callTracker';
import { callActivityService, ACTION_TYPE_CONFIG, CALL_OUTCOME_CONFIG } from '../services/callActivity';
import type { CallActivity } from '../services/callActivity';
import { lossReasonsService } from '../services/lossReasons';
import { industriesService } from '../services/industries';
import { CustomDatePicker } from '../components/ui/CustomDatePicker';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical } from 'lucide-react';
import { useAriasTables } from '../hooks/useAriasTables';
import { ResponseVelocityBadge } from '../components/ui/ResponseVelocityBadge';
import { useTimezone } from '../hooks/useTimezone';
import { localToUtcISO, DEFAULT_TIMEZONE } from '../utils/timezone';

export default function Leads() {
    const { profile } = useAuth();
    const { hasPermission } = usePermissions();
    const isAdmin = profile?.role === 'super_admin' || profile?.role === 'company_admin';
    // Direct check — bypasses usePermissions inheritance (where 'leads' base would grant 'leads_view_all')
    const canViewAllLeads = isAdmin || (profile?.permissions?.['leads_view_all'] === true);
    const { timezone: rawTimezone } = useTimezone(profile?.company_id);
    const { tableRef: leadsTableRef, wrapperRef: leadsWrapperRef } = useAriasTables();
    const queryClient = useQueryClient();
    const { 
        data: leadsData, 
        isLoading: loading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage
    } = useInfiniteQuery({
        queryKey: ['leads'],
        queryFn: async ({ pageParam }) => {
            const result = await leadsService.getLeadsCursor(1000, pageParam as string | undefined);
            return result;
        },
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        staleTime: 2 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });
    const leads = leadsData?.pages.flatMap(page => page.data) ?? [];
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
                const [teamMembers, setTeamMembers] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        name: '',
        company_name: '' as string | undefined,
        email: '' as string | null,
        phone: '' as string | null,
        status: 'Prospecto' as LeadStatus,
        priority: 'medium' as LeadPriority,
        value: 0,
        closing_amount: 0,
        source: '' as string | null,
        next_followup_date: '' as string | null,
        next_followup_assignee: '' as string | null,
        next_action_notes: '' as string | null,
        assigned_to: '' as string | null, // Permanent owner
    });

    // Time for the scheduled follow-up (independent from formData - not stored in lead columns)
    const [followUpTime, setFollowUpTime] = useState('09:00');

    const [isPriorityFilterOpen, setIsPriorityFilterOpen] = useState(false);
    const priorityFilterRef = useRef<HTMLDivElement>(null);

    const [isLossReasonFilterOpen, setIsLossReasonFilterOpen] = useState(false);
    const lossReasonFilterRef = useRef<HTMLDivElement>(null);

    const [isLostAtStageFilterOpen, setIsLostAtStageFilterOpen] = useState(false);
    const lostAtStageFilterRef = useRef<HTMLDivElement>(null);

    const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
    const dateRangeRef = useRef<HTMLDivElement>(null);

    const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
    const statusFilterRef = useRef<HTMLDivElement>(null);


    const [viewMode, setViewMode] = useState<'grid' | 'list' | 'kanban'>('list');
    const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
    const [sortConfig, setSortConfig] = useState<{ key: keyof Lead | 'value'; direction: 'asc' | 'desc' } | null>(null);

    // Column order persistence
    const [columnOrder, setColumnOrder] = useState<string[]>(() => {
        const saved = localStorage.getItem('lead_column_order');
        const defaultCols = ['name', 'email', 'phone', 'status', 'priority', 'source', 'value', 'assigned_to', 'created_at'];
        if (saved) {
            const parsed = JSON.parse(saved);
            // Add new columns if missing from saved order
            const newCols = defaultCols.filter(c => !parsed.includes(c));
            return newCols.length > 0 ? [...parsed.slice(0, 1), ...newCols, ...parsed.slice(1)] : parsed;
        }
        return defaultCols;
    });

    // Column width persistence
    const DEFAULT_COL_WIDTHS: Record<string, number> = {
        name: 200, email: 180, phone: 140, status: 140,
        priority: 120, source: 130, value: 110, assigned_to: 140, created_at: 120,
    };
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
        try {
            const saved = localStorage.getItem('lead_column_widths');
            return saved ? { ...DEFAULT_COL_WIDTHS, ...JSON.parse(saved) } : { ...DEFAULT_COL_WIDTHS };
        } catch { return { ...DEFAULT_COL_WIDTHS }; }
    });
    const resizingCol = useRef<string | null>(null);
    const resizeStartX = useRef<number>(0);
    const resizeStartWidth = useRef<number>(0);

    const handleColResizeStart = (e: React.MouseEvent, colId: string) => {
        e.preventDefault();
        e.stopPropagation();
        // Read the ACTUAL rendered width of the <th> — not the stored value,
        // which may differ from what the browser painted.
        const th = (e.currentTarget as HTMLElement).closest('th');
        const actualWidth = th ? th.getBoundingClientRect().width : (columnWidths[colId] ?? DEFAULT_COL_WIDTHS[colId] ?? 140);
        resizingCol.current = colId;
        resizeStartX.current = e.clientX;
        resizeStartWidth.current = actualWidth;
        document.body.classList.add('arias-table-resizing');

        const onMouseMove = (ev: MouseEvent) => {
            if (!resizingCol.current) return;
            const delta = ev.clientX - resizeStartX.current;
            const newWidth = Math.max(80, resizeStartWidth.current + delta);
            setColumnWidths(prev => ({ ...prev, [resizingCol.current!]: newWidth }));
        };
        const onMouseUp = () => {
            document.body.classList.remove('arias-table-resizing');
            if (resizingCol.current) {
                setColumnWidths(prev => {
                    const next = { ...prev };
                    localStorage.setItem('lead_column_widths', JSON.stringify(next));
                    return next;
                });
                resizingCol.current = null;
            }
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };


    const handleOnDragEnd = (result: any) => {
        if (!result.destination) return;
        const items = Array.from(columnOrder);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        setColumnOrder(items);
        localStorage.setItem('lead_column_order', JSON.stringify(items));
    };

    const [isImporting, setIsImporting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [priorityFilter, setPriorityFilter] = useState<LeadPriority | 'all' | LeadPriority[]>('all');
    const [assignedFilter, setAssignedFilter] = useState<string | 'all' | string[]>('all');
    const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all' | LeadStatus[]>('all');
    const [sourceFilter, setSourceFilter] = useState<string | 'all' | string[]>('all');
    const [lossReasonFilter, setLossReasonFilter] = useState<string | 'all' | string[]>('all');
    const [lostAtStageFilter, setLostAtStageFilter] = useState<string | 'all' | string[]>('all');
    const [filteredLeadId, setFilteredLeadId] = useState<string | null>(null);
    const [isAssignedFilterOpen, setIsAssignedFilterOpen] = useState(false);
    const assignedFilterRef = useRef<HTMLDivElement>(null);
    const [filteredLeadIds, setFilteredLeadIds] = useState<string[] | null>(null);
    const [completedLeadIds, setCompletedLeadIds] = useState<string[] | null>(null);
    const [calendarDateLabel, setCalendarDateLabel] = useState<string | null>(null);
    const cameFromRef = useRef<string | null>(null);
    const [startDateFilter, setStartDateFilter] = useState<string | null>(null);
    const [endDateFilter, setEndDateFilter] = useState<string | null>(null);
    const [minContactCountFilter, setMinContactCountFilter] = useState<number | null>(null);
    const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const processedStateRef = useRef<string | null>(null);
    const processedOpenRequestRef = useRef<number | null>(null);
    const [lossReasons, setLossReasons] = useState<LossReason[]>([]);
    const [industries, setIndustries] = useState<Industry[]>([]);
    const [isLossModalOpen, setIsLossModalOpen] = useState(false);
    const [lossData, setLossData] = useState({
        lost_reason_id: '',
        lost_notes: ''
    });

    const [isWonModalOpen, setIsWonModalOpen] = useState(false);
    const [wonData, setWonData] = useState({
        won_date: format(new Date(), 'yyyy-MM-dd'),
    });
    const [pendingWonStatus, setPendingWonStatus] = useState<LeadStatus | null>(null);
    const [isCallLoggerOpen, setIsCallLoggerOpen] = useState(false);
    // callStartedAt: set when user taps tel:// on mobile — carries the real call start time
    const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
    // Handle incoming state from Dashboard or Calendar
    useEffect(() => {
        if (location.state) {
            const state = location.state as any;
            const stateKey = JSON.stringify(state);

            // Only apply filters once per state change to allow manual clearing
            if (processedStateRef.current !== stateKey) {
                if (state.priority) setPriorityFilter(state.priority);
                if (state.status) setStatusFilter(state.status);
                if (state.source) setSourceFilter(state.source);
                if (state.assignedFilter) setAssignedFilter(state.assignedFilter);
                if (state.lossReasonId) setLossReasonFilter(state.lossReasonId);
                if (state.lostAtStage) setLostAtStageFilter(state.lostAtStage);
                if (state.leadIds) {
                    setFilteredLeadIds(state.leadIds);
                    if (viewMode === 'kanban') setViewMode('list');
                }
                if (state.completedLeadIds) setCompletedLeadIds(state.completedLeadIds);
                if (state.calendarDate) setCalendarDateLabel(state.calendarDate);
                if (state.fromCalendar) cameFromRef.current = 'calendar';
                // Dashboard sends full ISO timestamps — normalize to yyyy-MM-dd
                if (state.startDate) {
                    const sd = String(state.startDate);
                    setStartDateFilter(sd.length > 10 ? sd.substring(0, 10) : sd);
                }
                if (state.endDate) {
                    const ed = String(state.endDate);
                    setEndDateFilter(ed.length > 10 ? ed.substring(0, 10) : ed);
                }
                if (state.leadId) {
                    setFilteredLeadId(state.leadId);
                    if (viewMode === 'kanban') setViewMode('list');
                }
                if (state.minContactCount) {
                    setMinContactCountFilter(state.minContactCount);
                }
                if (state.openCreateModal) {
                    const openReq = typeof state.openCreateModal === 'number' ? state.openCreateModal : 1;
                    if (processedOpenRequestRef.current !== openReq) {
                        setIsModalOpen(true);
                        processedOpenRequestRef.current = openReq;
                    }
                }
                // Filter leads by activity type (from Rendimiento → channel cards)
                if (state.actionTypeFilter) {
                    supabase
                        .from('call_activities')
                        .select('lead_id')
                        .eq('action_type', state.actionTypeFilter)
                        .then(({ data: rows }) => {
                            if (rows && rows.length > 0) {
                                const ids = [...new Set(rows.map((r: any) => r.lead_id as string))];
                                setFilteredLeadIds(ids);
                                if (viewMode === 'kanban') setViewMode('list');
                            } else {
                                setFilteredLeadIds([]);
                            }
                        });
                }
                processedStateRef.current = stateKey;
            }

            // If leads are already loaded OR when they load, handle selection/opening
            if (state.leadId && leads.length > 0) {
                const targetLead = leads.find(l => l.id === state.leadId);
                if (targetLead) {
                    setSelectedLead(targetLead);
                    setIsDetailOpen(true);
                    loadFollowUps(targetLead.id);

                    // Clear state to prevent reopening on reload
                    window.history.replaceState({}, document.title);
                }
            }
        }
    }, [location.state, leads.length]);
    // -- Click-to-Call mobile: detect return from dialer and auto-open logger --
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState !== 'visible') return;
            const pending = callTracker.getPending();
            if (!pending) return;

            const callLead = leads.find(l => l.id === pending.leadId);
            if (!callLead) {
                callTracker.clear();
                return;
            }

            const startedAt = pending.startedAt;
            callTracker.clear(); // clear before opening

            // Open the lead detail + logger with the real call start time
            openLeadDetail(callLead);
            setCallStartedAt(startedAt);
            // Small delay to let the panel animate in
            setTimeout(() => setIsCallLoggerOpen(true), 300);
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [leads]);

    // Listen for global "Open Create Lead" events (from MobileNav)
    useEffect(() => {
        const handleOpenCreateLead = () => setIsModalOpen(true);
        window.addEventListener('open-create-lead', handleOpenCreateLead);
        return () => window.removeEventListener('open-create-lead', handleOpenCreateLead);
    }, []);

    // Force grid view on mobile initially, but allow changes
    useEffect(() => {
        if (window.innerWidth < 768) {
            setViewMode('grid');
        }
    }, []);

    // Update local state when lead is selected
    useEffect(() => {
        if (selectedLead) {
            // ?? ROBUST FIX: Always load follow-ups when a lead is selected
            loadFollowUps(selectedLead.id);
        }
    }, [selectedLead?.id]); // Use .id to prevent re-running on every re-render

    const toggleLeadSelection = (id: string) => {
        setSelectedLeadIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedLeadIds.length === filteredLeads.length) {
            setSelectedLeadIds([]);
        } else {
            setSelectedLeadIds(filteredLeads.map(l => l.id));
        }
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(`¿Estás seguro de que deseas eliminar ${selectedLeadIds.length} prospectos?`)) return;

        try {
            await Promise.all(selectedLeadIds.map(id => leadsService.deleteLead(id)));
            toast.success(`${selectedLeadIds.length} prospectos eliminados correctamente`);
            setSelectedLeadIds([]);
            loadLeads();
        } catch (error) {
            toast.error("Error al eliminar algunos prospectos");
        }
    };

    const filteredLeads = useMemo(() => {
        return leads.filter(lead => {
            // 🔒 Role-based visibility: collaborators only see their assigned leads
            if (!canViewAllLeads && lead.assigned_to !== profile?.id) return false;

            // Filter by specific lead ID if set (Direct skip)
            if (filteredLeadId) return lead.id === filteredLeadId;

            // Filter by list of lead IDs (KPI logic)
            if (filteredLeadIds && !filteredLeadIds.includes(lead.id)) return false;

            // Filter by search term
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase().trim();
                const matchesSearch =
                    lead.name?.toLowerCase().includes(term) ||
                    lead.email?.toLowerCase().includes(term) ||
                    lead.company_name?.toLowerCase().includes(term) ||
                    lead.phone?.toLowerCase().includes(term) ||
                    lead.next_action_notes?.toLowerCase().includes(term);

                if (!matchesSearch) return false;
            }

            // Filter by priority
            if (priorityFilter !== 'all') {
                if (Array.isArray(priorityFilter)) {
                    if (!priorityFilter.includes(lead.priority as LeadPriority)) return false;
                } else {
                    if (lead.priority !== priorityFilter) return false;
                }
            }

            // Filter by assigned user
            if (assignedFilter !== 'all') {
                if (Array.isArray(assignedFilter)) {
                    if (assignedFilter.includes('unassigned')) {
                        if (lead.assigned_to && !assignedFilter.includes(lead.assigned_to)) return false;
                    } else {
                        if (!lead.assigned_to || !assignedFilter.includes(lead.assigned_to)) return false;
                    }
                } else if (assignedFilter === 'unassigned') {
                    if (lead.assigned_to) return false;
                } else {
                    if (lead.assigned_to !== assignedFilter) return false;
                }
            }

            // Filter by status
            if (statusFilter === 'all') {
                // EXCEPTION: If we are coming from a specific dashboard link (filteredLeadIds), don't auto-hide
                if (filteredLeadIds || filteredLeadId) {
                    // Stay visible
                } else {
                    // Auto-hide Erroneous, Lost, and Nurturing by default from general list ONLY if not explicitly filtering for them
                    if (lead.status === 'Erróneo' || lead.status === 'Perdido' || lead.status === 'En Nutrición') return false;
                }
            } else {
                if (Array.isArray(statusFilter)) {
                    if (!statusFilter.includes(lead.status)) return false;
                } else {
                    if (lead.status !== statusFilter) return false;
                }
            }

            // Filter by source
            if (sourceFilter !== 'all') {
                if (Array.isArray(sourceFilter)) {
                    if (!lead.source || !sourceFilter.includes(lead.source)) return false;
                } else {
                    if (lead.source !== sourceFilter) return false;
                }
            }

            // Filter by loss reason
            if (lossReasonFilter !== 'all') {
                if (Array.isArray(lossReasonFilter)) {
                    if (!lead.lost_reason_id || !lossReasonFilter.includes(lead.lost_reason_id)) return false;
                } else {
                    if (lead.lost_reason_id !== lossReasonFilter) return false;
                }
            }

            // Filter by loss stage
            if (lostAtStageFilter !== 'all') {
                if (Array.isArray(lostAtStageFilter)) {
                    if (!lead.lost_at_stage || !lostAtStageFilter.includes(lead.lost_at_stage)) return false;
                } else {
                    if (lead.lost_at_stage !== lostAtStageFilter) return false;
                }
            }

            // Filter by date range (if provided from dashboard)
            if (startDateFilter || endDateFilter) {
                // Determine which date to use for comparison
                // If we are filtering specifically for Won/Client status, we use internal_won_date as primary source of truth
                const isWonFilter = Array.isArray(statusFilter)
                    ? (statusFilter.includes('Cerrado') || statusFilter.includes('Cliente'))
                    : (statusFilter === 'Cerrado' || statusFilter === 'Cliente');

                const dateToCompare = (isWonFilter && (lead.status === 'Cerrado' || lead.status === 'Cliente') && lead.internal_won_date)
                    ? new Date(lead.internal_won_date)
                    : new Date(lead.created_at);

                if (startDateFilter && dateToCompare < new Date(startDateFilter)) return false;
                if (endDateFilter && dateToCompare > new Date(endDateFilter)) return false;
            }

            // Filter by minimum contact count (from escalation widget)
            if (minContactCountFilter && (lead.contact_count || 0) < minContactCountFilter) return false;

            return true;
        });
    }, [leads, canViewAllLeads, profile?.id, priorityFilter, assignedFilter, statusFilter, sourceFilter, lossReasonFilter, lostAtStageFilter, filteredLeadId, filteredLeadIds, searchTerm, startDateFilter, endDateFilter, minContactCountFilter]);

    const sortedLeads = useMemo(() => {
        if (!sortConfig) return filteredLeads;
        return [...filteredLeads].sort((a, b) => {
            const { key, direction } = sortConfig;
            const valA = a[key] ?? '';
            const valB = b[key] ?? '';
            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredLeads, sortConfig]);

    // ─── Client-side Pagination ─────────────────────────────────────────────
    // Renders only 50 rows to the DOM instead of all 500+
    // Data stays in memory (React Query cache) — only DOM rendering is limited
    const ROWS_PER_PAGE = 50;
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.max(1, Math.ceil(sortedLeads.length / ROWS_PER_PAGE));
    const paginatedLeads = useMemo(() => {
        const start = (currentPage - 1) * ROWS_PER_PAGE;
        return sortedLeads.slice(start, start + ROWS_PER_PAGE);
    }, [sortedLeads, currentPage]);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [filteredLeads.length]);

    const filteredPipelineTotal = useMemo(() => {
        return filteredLeads.reduce((sum, lead) => sum + (lead.value || 0), 0);
    }, [filteredLeads]);

    // Supabase Realtime — actualiza la lista cuando otro usuario crea/edita/elimina un lead
    useEffect(() => {
        const channel = supabase.channel('leads-live')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' },
                () => queryClient.invalidateQueries({ queryKey: ['leads'] })
            ).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [queryClient]);

    useEffect(() => {
        loadTeamMembers();
        loadLossReasons();
        loadIndustries();
    }, []);

    const loadLossReasons = async () => {
        try {
            const reasons = await lossReasonsService.getLossReasons();
            setLossReasons(reasons);
        } catch (error) {
            logger.error('Failed to load loss reasons', error, { action: 'loadLossReasons' });
        }
    };

    const loadIndustries = async () => {
        try {
            const data = await industriesService.getIndustries();
            setIndustries(data);
        } catch (error) {
            logger.error('Failed to load industries', error, { action: 'loadIndustries' });
        }
    };

    const handleDeleteLead = async (id: string, name: string) => {
        if (!confirm(`¿Estás seguro de eliminar el lead "${name}"? Esta acción no se puede deshacer.`)) return;
        try {
            await leadsService.deleteLead(id);
            toast.success(`Lead "${name}" eliminado correctamente`);
            if (selectedLead?.id === id) setIsDetailOpen(false);
            loadLeads();
        } catch (error: any) {
            logger.error('Delete failed', error, { action: 'handleDeleteLead', leadId: id });
            toast.error(`Error al eliminar: ${error.message}`);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedLead || !profile?.company_id) return;

        if (file.type !== 'application/pdf') {
            toast.error('Solo se permiten archivos PDF');
            return;
        }

        setIsUploading(true);
        try {
            const path = await storageService.uploadLeadDocument(profile.company_id, selectedLead.id, file);
            await leadsService.updateLead(selectedLead.id, { document_path: path });
            setSelectedLead({ ...selectedLead, document_path: path });
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            toast.success('PDF cargado correctamente');
        } catch (error: any) {
            logger.error('Upload failed', error, { action: 'handleFileUpload', leadId: selectedLead.id });
            toast.error('Error al subir el archivo: ' + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileDownload = async () => {
        if (!selectedLead?.document_path) return;
        try {
            const url = await storageService.getDownloadUrl(selectedLead.document_path);
            window.open(url, '_blank');
        } catch (error: any) {
            toast.error('Error al descargar: ' + error.message);
        }
    };

    const handleFileDelete = async () => {
        if (!selectedLead?.document_path) return;
        if (!confirm('¿Estás seguro de eliminar este documento?')) return;

        try {
            await storageService.deleteFile(selectedLead.document_path);
            await leadsService.updateLead(selectedLead.id, { document_path: null });
            setSelectedLead({ ...selectedLead, document_path: null });
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            toast.success('Documento eliminado');
        } catch (error: any) {
            toast.error('Error al eliminar: ' + error.message);
        }
    };

    const loadLeads = () => {
        queryClient.invalidateQueries({ queryKey: ['leads'] });
    };

    const handleDownloadTemplate = () => {
        csvHelper.generateExcelTemplate();
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (priorityFilterRef.current && !priorityFilterRef.current.contains(event.target as Node)) {
                setIsPriorityFilterOpen(false);
            }
            if (assignedFilterRef.current && !assignedFilterRef.current.contains(event.target as Node)) {
                setIsAssignedFilterOpen(false);
            }
            if (lossReasonFilterRef.current && !lossReasonFilterRef.current.contains(event.target as Node)) {
                setIsLossReasonFilterOpen(false);
            }
            if (lostAtStageFilterRef.current && !lostAtStageFilterRef.current.contains(event.target as Node)) {
                setIsLostAtStageFilterOpen(false);
            }
            if (statusFilterRef.current && !statusFilterRef.current.contains(event.target as Node)) {
                setIsStatusFilterOpen(false);
            }
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

    const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setIsImporting(true);
            const data = await csvHelper.parse(file, teamMembers);

            if (data.length === 0) {
                toast.error('El archivo está vacío.');
                return;
            }


            if (confirm(`¿Estás seguro de que quieres importar ${data.length} leads?`)) {
                const results = await leadsService.importLeads(data);

                // Clear all filters so imported leads are visible
                setSearchTerm('');
                setPriorityFilter('all');
                setFilteredLeadId(null);

                // Add successfully imported leads to cache and then do a full sync
                if (results.inserted.length > 0) {
                    queryClient.invalidateQueries({ queryKey: ['leads'] });
                }

                // Show detailed results
                if (results.inserted.length > 0 && results.skipped.length === 0 && results.errors.length === 0) {
                    // Perfect import - all leads inserted
                    const leadText = results.inserted.length === 1 ? 'lead importado' : 'leads importados';
                    toast.success(`? ${results.inserted.length} ${leadText} correctamente`);
                } else if (results.inserted.length > 0 && (results.skipped.length > 0 || results.errors.length > 0)) {
                    // Partial import - some succeeded, some failed/skipped
                    const messages = [
                        `? ${results.inserted.length} importado(s)`,
                        results.skipped.length > 0 ? `?? ${results.skipped.length} omitido(s) (duplicados)` : '',
                        results.errors.length > 0 ? `? ${results.errors.length} error(es)` : ''
                    ].filter(Boolean).join('\n');

                    toast.success(messages, { duration: 5000 });

                    // Log details for debugging
                    if (results.skipped.length > 0) {
                        console.log('?? Duplicados omitidos:');
                        results.skipped.forEach(({ lead, reason }) => {
                            console.log(`  - ${lead.name}: ${reason}`);
                        });
                    }
                } else if (results.inserted.length === 0 && results.skipped.length > 0) {
                    // All duplicates - nothing imported
                    const duplicateText = results.skipped.length === 1 ? 'Este lead ya existe' : `Estos ${results.skipped.length} leads ya existen`;
                    const leadName = results.skipped[0]?.lead?.name || 'Sin nombre';

                    let message = results.skipped.length === 1
                        ? `?? ${duplicateText}: ${leadName}`
                        : `?? ${duplicateText}`;

                    toast(message, { duration: 6000, icon: '??' });
                } else {
                    // All failed
                    toast.error('? No se pudo importar ningún lead. Revisa el formato del archivo.');
                }

                // Background sync to ensure consistency
                setTimeout(async () => {
                    try {
                        queryClient.invalidateQueries({ queryKey: ['leads'] });
                    } catch (err) {
                        console.error('Background sync failed:', err);
                    }
                }, 2000);
            }
        } catch (error: any) {
            logger.error('Lead import failed', error, { action: 'handleImportCSV' });
            toast.error(`Fallo en la importación: ${error.message || 'Verifica el formato del archivo'}`);
        } finally {
            setIsImporting(false);
            // Reset input
            e.target.value = '';
        }
    };


    const loadTeamMembers = async () => {
        try {
            const data = await leadsService.getTeamMembers();
            setTeamMembers(data || []);
        } catch (error) {
            logger.error('Failed to load team', error, { action: 'loadTeamMembers' });
        }
    };

    const loadFollowUps = async (leadId: string) => {
        try {
            const [followUpsData, messagesData, activitiesData] = await Promise.all([
                leadsService.getFollowUps(leadId),
                leadsService.getLeadMessages(leadId),
                callActivityService.getLeadCalls(leadId),
            ]);
                                            } catch (error) {
            logger.error('Failed to load history', error, { action: 'loadFollowUps', leadId });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return; // Guard against double submit
        setIsSubmitting(true);
        try {
            // Clean data - convert empty strings to null for UUID fields
            const cleanData = {
                ...formData,
                next_followup_assignee: formData.next_followup_assignee || null,
                next_followup_date: formData.next_followup_date || null,
            };
            const newLead = await leadsService.createLead(cleanData);

            // If a follow-up date was set, create a real follow_up record so it appears in the Calendar
            if (cleanData.next_followup_date && newLead?.id) {
                const companyTimezone = rawTimezone || DEFAULT_TIMEZONE;
                const followUpDateTime = localToUtcISO(
                    `${cleanData.next_followup_date}T${followUpTime}`,
                    companyTimezone
                );
                await leadsService.createFollowUp({
                    lead_id: newLead.id,
                    date: followUpDateTime,
                    notes: formData.next_action_notes?.trim() || 'Seguimiento programado',
                    action_type: 'call',
                }, cleanData.next_followup_assignee || undefined);
            }

            setIsModalOpen(false);
            resetForm();
            loadLeads();
            toast.success('Nuevo lead creado');
        } catch (error: any) {
            logger.error('Failed to create lead', error, { action: 'handleSubmit' });
            toast.error(`Error: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateLead = async (updates: Partial<Lead>) => {
        if (!selectedLead) return;

        // Intercept status change to 'Perdido'
        if ('status' in updates && updates.status === 'Perdido') {
            setIsLossModalOpen(true);
            return;
        }

        // Intercept status change to 'Cerrado' or 'Cliente'
        if ('status' in updates && (updates.status === 'Cerrado' || updates.status === 'Cliente')) {
            setPendingWonStatus(updates.status);
            setWonData({ won_date: format(new Date(), 'yyyy-MM-dd') });
            setIsWonModalOpen(true);
            return;
        }
        try {
            // Clean data - convert empty strings to null for optional fields
            const cleanUpdates = { ...updates };
            if ('next_followup_assignee' in cleanUpdates && !cleanUpdates.next_followup_assignee) {
                cleanUpdates.next_followup_assignee = null;
            }
            if ('next_followup_date' in cleanUpdates && !cleanUpdates.next_followup_date) {
                cleanUpdates.next_followup_date = null;
            }
            if ('assigned_to' in cleanUpdates && !cleanUpdates.assigned_to) {
                cleanUpdates.assigned_to = null;
            }

            const updatedLead = await leadsService.updateLead(selectedLead.id, cleanUpdates);
            setSelectedLead({ ...selectedLead, ...updatedLead });
            loadLeads();

            // Show specific feedback based on what changed
            if ('status' in cleanUpdates) {
                toast.success(`Estado cambiado a: ${STATUS_CONFIG[cleanUpdates.status as LeadStatus]?.label || cleanUpdates.status}`);
            } else if ('priority' in cleanUpdates) {
                toast.success(`Prioridad cambiada a: ${PRIORITY_CONFIG[cleanUpdates.priority as LeadPriority]?.label || cleanUpdates.priority}`);
            } else if ('assigned_to' in cleanUpdates) {
                toast.success('Responsable actualizado');
            } else {
                toast.success('Cambio guardado');
            }
        } catch (error: any) {
            logger.error('Update failed', error, { action: 'handleUpdateLead', leadId: selectedLead.id });
            toast.error(`Error al guardar: ${error.message}`);
        }
    };

    const handleConfirmLoss = async () => {
        if (!selectedLead || !lossData.lost_reason_id) {
            toast.error('Por favor selecciona un motivo de pérdida');
            return;
        }

        try {
            // Capture the stage where the lead was lost
            const lost_at_stage = selectedLead.status;
            const reasonText = lossReasons.find(r => r.id === lossData.lost_reason_id)?.reason || 'Motivo no especificado';

            await leadsService.updateLead(selectedLead.id, {
                status: 'Perdido',
                lost_reason_id: lossData.lost_reason_id,
                lost_at_stage,
                lost_notes: lossData.lost_notes || null,
                lost_date: new Date().toISOString()
            });

            // Create history entry for traceability
            const traceabilityNote = `LEAD PERDIDO. Motivo: ${reasonText}${lossData.lost_notes ? `. Notas: ${lossData.lost_notes}` : ''}`;
            await leadsService.createFollowUp({
                lead_id: selectedLead.id,
                notes: traceabilityNote,
                action_type: 'other',
                date: format(new Date(), 'yyyy-MM-dd')
            });

            setSelectedLead({ ...selectedLead, status: 'Perdido', lost_at_stage, lost_reason_id: lossData.lost_reason_id, lost_notes: lossData.lost_notes });
            loadLeads();
            loadFollowUps(selectedLead.id); // Refresh history view

            setIsLossModalOpen(false);
            setLossData({ lost_reason_id: '', lost_notes: '' });

            toast.success('Lead marcado como perdido');
        } catch (error: any) {
            logger.error('Failed to mark as lost', error, { action: 'handleConfirmLoss', leadId: selectedLead.id });
            toast.error(`Error: ${error.message}`);
        }
    };

    const handleConfirmWon = async () => {
        if (!selectedLead || !pendingWonStatus) return;

        try {
            await leadsService.updateLead(selectedLead.id, {
                status: pendingWonStatus,
                internal_won_date: new Date(`${wonData.won_date}T12:00:00`).toISOString()
            });

            // Create history entry for traceability
            const statusLabel = STATUS_CONFIG[pendingWonStatus]?.label || pendingWonStatus;
            const traceabilityNote = `¡TRATO GANADO! Marcado como ${statusLabel} con fecha de cierre ${wonData.won_date}.`;

            await leadsService.createFollowUp({
                lead_id: selectedLead.id,
                notes: traceabilityNote,
                action_type: 'other',
                date: format(new Date(), 'yyyy-MM-dd')
            });

            setIsWonModalOpen(false);
            setPendingWonStatus(null);
            loadLeads();
            loadFollowUps(selectedLead.id); // Refresh history view
            toast.success('¡Felicitaciones! Trato cerrado con éxito.');
        } catch (error: any) {
            logger.error('Failed to mark as won', error, { action: 'handleConfirmWon', leadId: selectedLead.id });
            toast.error(`Error: ${error.message}`);
        }
    };

    // handleAddFollowUp removed - simplified UI

    const openLeadDetail = (lead: Lead) => {
        setSelectedLead(lead);
        setIsDetailOpen(true);
        setIsCallLoggerOpen(false);
        loadFollowUps(lead.id);
    };

    const resetForm = () => {
        setFormData({
            name: '', company_name: '', email: '', phone: '',
            status: 'Prospecto', priority: 'medium', value: 0, closing_amount: 0, source: '',
            next_followup_date: '', next_followup_assignee: '', next_action_notes: '',
            assigned_to: ''
        });
        setFollowUpTime('09:00'); // Reset hour to default
    };


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
            <div className="w-full max-w-[1500px] mx-auto pb-6 space-y-3">
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
                                Desde: {format(new Date(startDateFilter), 'dd/MM/yyyy')}
                                <button onClick={() => setStartDateFilter(null)} className="hover:text-slate-900 ml-0.5"><X className="w-3 h-3" /></button>
                            </span>
                        )}
                        {endDateFilter && (
                            <span className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-semibold">
                                Hasta: {format(new Date(endDateFilter), 'dd/MM/yyyy')}
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

                {/* VIEW SELECTOR & MAIN CONTENT - Mobile Cards (only for Grid mode) */}
                {viewMode === 'grid' && (
                    <div className="space-y-4 md:hidden">
                        {loading ? (
                            <div className="space-y-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="bg-white rounded-[2rem] p-5 shadow-sm border border-gray-100 animate-pulse">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex gap-2">
                                                <div className="w-16 h-5 bg-gray-100 rounded-full" />
                                                <div className="w-16 h-5 bg-gray-100 rounded-full" />
                                            </div>
                                        </div>
                                        <div className="h-6 bg-gray-100 rounded-lg w-3/4 mb-2" />
                                        <div className="h-4 bg-gray-100 rounded-lg w-1/2 mb-6" />
                                        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-50">
                                            <div className="w-20 h-8 bg-gray-100 rounded-lg" />
                                            <div className="flex gap-2">
                                                <div className="w-10 h-10 bg-gray-100 rounded-xl" />
                                                <div className="w-10 h-10 bg-gray-100 rounded-xl" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : filteredLeads.length === 0 ? (
                            <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-gray-100">
                                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Search className="w-8 h-8 text-gray-300" />
                                </div>
                                <h3 className="text-lg font-black text-gray-900">Sin resultados</h3>
                                <p className="text-gray-400 text-sm font-bold mt-1">Intenta con otros filtros o términos de búsqueda</p>
                            </div>
                        ) : (
                            paginatedLeads.map((lead) => (
                                <div
                                    key={lead.id}
                                    className="bg-white rounded-[2rem] p-5 shadow-sm border border-gray-100 active:scale-[0.98] transition-all relative overflow-hidden"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex gap-2 items-center flex-wrap">
                                            <StatusBadge status={lead.status} />
                                            <PriorityBadge priority={lead.priority} />
                                            {lead.document_path && (
                                                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center gap-1">
                                                    <FileText className="w-3 h-3" /> Cotizado
                                                </span>
                                            )}
                                            {/* F3 — Response Velocity */}
                                            <ResponseVelocityBadge nextFollowupDate={lead.next_followup_date} />
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleLeadSelection(lead.id);
                                                }}
                                                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${selectedLeadIds.includes(lead.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-gray-50 border-gray-200 text-transparent'}`}
                                            >
                                                <CheckCircle className="w-5 h-5 shadow-sm" />
                                            </div>
                                        </div>
                                    </div>

                                    <div onClick={() => openLeadDetail(lead)}>
                                        <h3 className="text-xl font-black text-gray-900 leading-tight mb-1">{lead.name}</h3>
                                        {lead.company_name && (
                                            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{lead.company_name}</p>
                                        )}

                                        <div className="mt-6 flex justify-between items-end border-b border-gray-50 pb-4">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Valor Potencial</p>
                                                <p className="text-xl font-black text-[#4449AA] tracking-tighter">${(lead.value || 0).toLocaleString()}</p>
                                            </div>
                                            {lead.next_followup_date && (
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Próximo</p>
                                                    <div className="flex items-center gap-1.5 justify-end">
                                                        <Calendar className="w-3.5 h-3.5 text-blue-500" />
                                                        <span className="text-xs font-black text-blue-900">
                                                            {(() => { try { return format(new Date(lead.next_followup_date.substring(0, 10) + 'T12:00:00'), 'dd MMM', { locale: es }); } catch { return '—'; } })()}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-4 flex items-center justify-between">
                                            {lead.assigned_to && (() => {
                                                const owner = teamMembers.find(m => m.id === lead.assigned_to);
                                                return (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 rounded-full bg-indigo-50 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center">
                                                            {owner?.avatar_url ? <img src={owner.avatar_url} className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-indigo-300" />}
                                                        </div>
                                                        <p className="text-xs font-bold text-gray-600">{owner?.full_name?.split(' ')[0] || 'Agente'}</p>
                                                    </div>
                                                );
                                            })()}

                                            <div className="flex gap-2">
                                                {lead.phone && (
                                                    <a
                                                        href={`tel:${lead.phone}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            // ?? Mobile click-to-call: record exact start time
                                                            callTracker.start(lead.id);
                                                        }}
                                                        className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm active:bg-indigo-100"
                                                    >
                                                        <Phone className="w-5 h-5" />
                                                    </a>
                                                )}
                                                {lead.phone && (
                                                    <a
                                                        href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="w-11 h-11 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center shadow-sm active:bg-green-100"
                                                    >
                                                        <MessageSquare className="w-5 h-5" />
                                                    </a>
                                                )}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openLeadDetail(lead);
                                                    }}
                                                    className="w-11 h-11 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center shadow-sm active:bg-gray-100"
                                                >
                                                    <ChevronRight className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                        {/* Mobile Grid Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-2 py-3 mt-2">
                                <p className="text-[11px] font-bold text-gray-400">
                                    {((currentPage - 1) * ROWS_PER_PAGE) + 1}–{Math.min(currentPage * ROWS_PER_PAGE, sortedLeads.length)} de {sortedLeads.length}
                                </p>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 text-[10px] font-black rounded-lg disabled:opacity-30 text-gray-500 hover:bg-indigo-50">Anterior</button>
                                    <span className="w-8 h-8 flex items-center justify-center text-[11px] font-black bg-[#4449AA] text-white rounded-lg">{currentPage}</span>
                                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 text-[10px] font-black rounded-lg disabled:opacity-30 text-gray-500 hover:bg-indigo-50">Siguiente</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Render corresponding view based on viewMode */}
                {/* Mobile loading indicator for List/Kanban modes */}
                {loading && viewMode !== 'grid' && (
                    <div className="md:hidden flex items-center justify-center py-16">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cargando...</p>
                        </div>
                    </div>
                )}
                {loading ? (
                    <div className="hidden md:grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 animate-pulse">
                                <div className="flex justify-between mb-4">
                                    <div className="w-20 h-5 bg-gray-100 rounded-full" />
                                    <div className="w-10 h-5 bg-gray-100 rounded-full" />
                                </div>
                                <div className="h-6 bg-gray-100 rounded-lg w-3/4 mb-2" />
                                <div className="h-4 bg-gray-100 rounded-lg w-1/2 mb-6" />
                                <div className="space-y-3 mt-4">
                                    <div className="h-3 bg-gray-50 rounded w-full" />
                                    <div className="h-3 bg-gray-50 rounded w-5/6" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : viewMode === 'grid' ? (
                    /* Grid View */
                    <LeadGrid 
                        paginatedLeads={paginatedLeads}
                        teamMembers={teamMembers}
                        openLeadDetail={openLeadDetail}
                        handleDeleteLead={handleDeleteLead}
                        isAdmin={isAdmin}
                        callTracker={callTracker}
                        setCurrentPage={setCurrentPage}
                        currentPage={currentPage}
                        totalPages={totalPages}
                        ROWS_PER_PAGE={ROWS_PER_PAGE}
                        sortedLeads={sortedLeads}
                    />
                     ) : viewMode === 'list' ? (
                    /* List View - Modern Premium Redesign */
                    <div className="relative animate-in fade-in duration-500">
                        {/* Mobile List Cards */}
                        <div className="md:hidden space-y-2">
                            {filteredLeads.length === 0 ? (
                                <div className="bg-white rounded-2xl p-10 text-center border border-gray-100">
                                    <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                                    <h3 className="text-base font-black text-gray-900">Sin resultados</h3>
                                    <p className="text-gray-400 text-sm font-bold mt-1">Intenta con otros filtros</p>
                                </div>
                            ) : (
                                paginatedLeads.map((lead) => (
                                    <div
                                        key={lead.id}
                                        onClick={() => openLeadDetail(lead)}
                                        className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm active:scale-[0.98] transition-all cursor-pointer"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <h4 className="text-sm font-black text-gray-900 truncate">{lead.name}</h4>
                                                    <StatusBadge status={lead.status} />
                                                    {lead.document_path && (
                                                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full border border-blue-100 bg-blue-50 text-blue-600 flex items-center gap-0.5 uppercase tracking-widest"><FileText className="w-2.5 h-2.5" /> Cotizado</span>
                                                    )}
                                                    {(lead.contact_count || 0) > 0 && (
                                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${(lead.contact_count || 0) >= 6 ? 'bg-red-50 text-red-600' :
                                                            (lead.contact_count || 0) >= 4 ? 'bg-amber-50 text-amber-600' :
                                                                'bg-emerald-50 text-emerald-600'
                                                            }`}>📞{lead.contact_count}</span>
                                                    )}
                                                    {(lead.engagement_score || 0) > 0 && (
                                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${(lead.engagement_score || 0) >= 10 ? 'bg-rose-50 text-rose-600' :
                                                            (lead.engagement_score || 0) >= 5 ? 'bg-orange-50 text-orange-600' :
                                                                'bg-sky-50 text-sky-600'
                                                            }`} title={`Engagement Score: ${lead.engagement_score}`}>🔥{lead.engagement_score}</span>
                                                    )}
                                                </div>
                                                <p className="text-xs font-bold text-gray-400 truncate">{lead.company_name || 'Sin empresa'}</p>
                                            </div>
                                            <div className="text-right ml-3 shrink-0">
                                                <p className="text-sm font-black text-[#4449AA] tracking-tight">${(lead.value || 0).toLocaleString()}</p>
                                                <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Valor</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        {/* Desktop Table */}
                        <div className="hidden md:block bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/80 overflow-hidden transition-all duration-300">
                            <div ref={leadsWrapperRef} className="arias-table-wrapper">
                                <div ref={leadsTableRef} className="arias-table">
                                    <LeadTable 
                                        columnOrder={columnOrder}
                                        columnWidths={columnWidths}
                                        DEFAULT_COL_WIDTHS={DEFAULT_COL_WIDTHS}
                                        handleOnDragEnd={handleOnDragEnd}
                                        handleColResizeStart={handleColResizeStart}
                                        selectedLeadIds={selectedLeadIds}
                                        toggleLeadSelection={toggleLeadSelection}
                                        toggleSelectAll={toggleSelectAll}
                                        sortedLeads={sortedLeads}
                                        paginatedLeads={paginatedLeads}
                                        sortConfig={sortConfig}
                                        setSortConfig={setSortConfig}
                                        teamMembers={teamMembers}
                                        openLeadDetail={openLeadDetail}
                                        completedLeadIds={completedLeadIds}
                                        isAdmin={isAdmin}
                                        handleDeleteLead={handleDeleteLead}
                                        storageService={storageService}
                                        navigate={navigate}
                                    />
                                </div>
                            </div>

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-[#FAFAFB]/60">
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

                        {/* Floating Bulk Actions Bar */}
                        {selectedLeadIds.length > 0 && (
                            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-5 duration-300">
                                <div className="bg-white px-6 py-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gray-100 flex items-center gap-6">
                                    <div className="flex items-center gap-2 pr-6 border-r border-gray-100">
                                        <div className="w-6 h-6 bg-[#4449AA] rounded-full flex items-center justify-center text-[10px] font-black text-white">
                                            {selectedLeadIds.length}
                                        </div>
                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Seleccionados</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={() => setSelectedLeadIds([])}
                                            className="text-xs font-black text-gray-400 hover:text-gray-600 uppercase tracking-widest transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={() => {
                                                navigate('/marketing/campaign/new', {
                                                    state: {
                                                        preSelectedLeads: selectedLeadIds,
                                                        campaignSource: 'leads-bulk'
                                                    }
                                                });
                                            }}
                                            className="flex items-center gap-2 bg-indigo-50 text-indigo-600 hover:bg-[#4449AA] hover:text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm"
                                        >
                                            <Send className="w-3.5 h-3.5" />
                                            Preparar Mensaje
                                        </button>
                                        <button
                                            onClick={handleBulkDelete}
                                            className="flex items-center gap-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Eliminar Seleccionados
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Kanban View */
                    <LeadKanban
                        leads={filteredLeads}
                        teamMembers={teamMembers}
                        onUpdateStatus={async (leadId, newStatus) => {
                            const lead = leads.find(l => l.id === leadId);
                            if (!lead) return;

                            // Intercept status change to 'Perdido' - Open Loss Modal
                            if (newStatus === 'Perdido') {
                                setSelectedLead(lead);
                                setIsLossModalOpen(true);
                                return;
                            }

                            // Intercept status change to 'Cerrado' or 'Cliente' - Open Won Modal
                            if (newStatus === 'Cerrado' || newStatus === 'Cliente') {
                                setSelectedLead(lead);
                                setPendingWonStatus(newStatus);
                                setWonData({ won_date: format(new Date(), 'yyyy-MM-dd') });
                                setIsWonModalOpen(true);
                                return;
                            }

                            try {
                                // Optimistic update via query cache
                                queryClient.setQueryData(['leads'], (old: Lead[] | undefined) =>
                                    (old ?? []).map(l => l.id === leadId ? { ...l, status: newStatus } : l)
                                );

                                await leadsService.updateLead(leadId, { status: newStatus });
                                toast.success(`Estado actualizado a ${newStatus}`);
                            } catch (error) {
                                // Rollback
                                queryClient.invalidateQueries({ queryKey: ['leads'] });
                                toast.error('Error al actualizar estado');
                            }
                        }}
                        onOpenDetail={openLeadDetail}
                    />
                )}

                {leads.length === 0 && !loading && (
                    <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
                        <User className="mx-auto h-12 w-12 text-gray-300" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No hay leads</h3>
                        <p className="mt-1 text-sm text-gray-500">Comienza creando un nuevo lead.</p>
                    </div>
                )}

                {leads.length > 0 && filteredLeads.length === 0 && !loading && (
                    <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
                        <TrendingUp className="mx-auto h-12 w-12 text-gray-300" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No hay leads con estos filtros</h3>
                        <p className="mt-1 text-sm text-gray-500">Intenta cambiar los filtros superiores o limpiar la búsqueda.</p>
                    </div>
                )}
            </div>
            {/* Create Lead Fullscreen */}
            <CreateLeadFullscreen
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                formData={formData}
                setFormData={(data) => setFormData(prev => ({ ...prev, ...data }))}
                teamMembers={teamMembers}
                industries={industries}
                onSubmit={handleSubmit}
                followUpTime={followUpTime}
                setFollowUpTime={setFollowUpTime}
            />

            {/* Lead Detail Slide-Over */}
            <LeadDetailPanel
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                lead={selectedLead!}
                handleUpdateLead={handleUpdateLead}
                teamMembers={teamMembers}
                profile={profile}
                isAdmin={isAdmin}
                navigate={navigate}
                storageService={storageService}
                industries={industries}
                handleFileDownload={handleFileDownload}
                handleFileDelete={handleFileDelete}
                handleFileUpload={handleFileUpload}
                isUploading={isUploading}
                isCallLoggerOpen={isCallLoggerOpen}
                setIsCallLoggerOpen={setIsCallLoggerOpen}
                callStartedAt={callStartedAt}
                setCallStartedAt={setCallStartedAt}
                handleDeleteLead={handleDeleteLead}
                StatusBadge={StatusBadge}
                PriorityBadge={PriorityBadge}
            />

            {/* Won Modal */}
            {
                isWonModalOpen && selectedLead && (
                    <div className="fixed inset-0 z-[10000] overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-black/50" onClick={() => setIsWonModalOpen(false)} />
                            <div className="inline-block align-bottom bg-white rounded-3xl text-left shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full relative z-10">
                                <div className={`bg-gradient-to-br ${pendingWonStatus === 'Cerrado' ? 'from-indigo-50 to-purple-50 border-purple-100' : 'from-indigo-50 to-green-50 border-green-100'} px-6 py-5 border-b`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 ${pendingWonStatus === 'Cerrado' ? 'bg-purple-600' : 'bg-indigo-600'} rounded-2xl flex items-center justify-center shadow-lg transition-colors`}>
                                            <Target className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-gray-900">{pendingWonStatus === 'Cerrado' ? '¡Trato Cerrado!' : '¡Trato Ganado!'}</h3>
                                            <p className="text-sm font-medium text-gray-500 mt-0.5">Registra la fecha de cierre oficial</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white px-6 py-6 space-y-5">
                                    <div className={`${pendingWonStatus === 'Cerrado' ? 'bg-purple-50 border-purple-100' : 'bg-green-50 border-green-100'} border rounded-xl p-4 transition-colors`}>
                                        <p className={`text-xs font-bold ${pendingWonStatus === 'Cerrado' ? 'text-purple-700' : 'text-green-700'} uppercase tracking-wider mb-1`}>Cliente / Proyecto</p>
                                        <p className="text-lg font-black text-gray-900">{selectedLead.name}</p>
                                        {selectedLead.company_name && <p className="text-sm font-medium text-gray-500">{selectedLead.company_name}</p>}
                                        <div className="mt-4 pt-4 border-t border-black/5 flex flex-col gap-2">
                                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Estado Final:</p>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setPendingWonStatus('Cerrado')}
                                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all border ${pendingWonStatus === 'Cerrado'
                                                        ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                                                        : 'bg-white text-purple-600 border-purple-100 hover:bg-purple-50'
                                                        }`}
                                                >
                                                    {STATUS_CONFIG['Cerrado'].icon} Cerrado
                                                </button>
                                                <button
                                                    onClick={() => setPendingWonStatus('Cliente')}
                                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all border ${pendingWonStatus === 'Cliente'
                                                        ? 'bg-green-600 text-white border-green-600 shadow-md'
                                                        : 'bg-white text-green-600 border-green-100 hover:bg-green-50'
                                                        }`}
                                                >
                                                    {STATUS_CONFIG['Cliente'].icon} Cliente
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-700 uppercase tracking-wider block">
                                            Fecha de Cierre <span className="text-indigo-500">*</span>
                                        </label>
                                        <CustomDatePicker
                                            value={wonData.won_date}
                                            onChange={(date) => setWonData({ ...wonData, won_date: date })}
                                            variant="light"
                                        />
                                        <p className="text-[10px] text-gray-400 font-medium italic">
                                            Esta fecha se utilizará para tus reportes de ventas y desempeño.
                                        </p>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-end border-t border-gray-100">
                                    <button
                                        onClick={() => {
                                            setIsWonModalOpen(false);
                                            setPendingWonStatus(null);
                                        }}
                                        className="px-6 py-3 rounded-xl font-black text-sm uppercase tracking-wider text-gray-600 hover:bg-gray-100 transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleConfirmWon}
                                        className="px-6 py-3 rounded-xl font-black text-sm uppercase tracking-wider bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl"
                                    >
                                        Guardar y Cerrar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            {/* Loss Modal */}
            {isLossModalOpen && selectedLead && (
                <div className="fixed inset-0 z-[10000] overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 transition-opacity bg-black/50" onClick={() => setIsLossModalOpen(false)} />
                        <div className="inline-block align-bottom bg-white rounded-3xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full relative z-10">
                            <div className="bg-gradient-to-br from-red-50 to-orange-50 px-6 py-5 border-b border-red-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center shadow-lg">
                                        <X className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-gray-900">Lead Perdido</h3>
                                        <p className="text-sm font-medium text-gray-500 mt-0.5">Registra el motivo de pérdida</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white px-6 py-6 space-y-5">
                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1">Lead Actual</p>
                                    <p className="text-lg font-black text-gray-900">{selectedLead.name}</p>
                                    <p className="text-sm font-medium text-gray-500">{selectedLead.company_name || 'Sin empresa'}</p>
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className="text-xs font-bold text-gray-400">Etapa actual:</span>
                                        <span className={`text-xs font-black px-2 py-1 rounded-lg ${STATUS_CONFIG[selectedLead.status]?.bgColor} ${STATUS_CONFIG[selectedLead.status]?.color}`}>
                                            {STATUS_CONFIG[selectedLead.status]?.icon} {STATUS_CONFIG[selectedLead.status]?.label}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-700 uppercase tracking-wider block">
                                        Motivo de Pérdida <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={lossData.lost_reason_id}
                                        onChange={(e) => setLossData({ ...lossData, lost_reason_id: e.target.value })}
                                        className="w-full rounded-xl border-gray-200 shadow-sm text-sm font-bold text-gray-700 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-red-500 transition-all p-3"
                                    >
                                        <option value="">Selecciona un motivo...</option>
                                        {lossReasons.map(reason => (
                                            <option key={reason.id} value={reason.id}>
                                                {reason.reason}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-700 uppercase tracking-wider block">
                                        Notas Adicionales (Opcional)
                                    </label>
                                    <textarea
                                        value={lossData.lost_notes}
                                        onChange={(e) => setLossData({ ...lossData, lost_notes: e.target.value })}
                                        placeholder="Añade contexto adicional sobre por qué se perdió este lead..."
                                        rows={4}
                                        className="w-full rounded-xl border-gray-200 shadow-sm text-sm font-medium text-gray-700 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-red-500 transition-all p-3 resize-none"
                                    />
                                </div>
                            </div>
                            <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-end border-t border-gray-100">
                                <button
                                    onClick={() => {
                                        setIsLossModalOpen(false);
                                        setLossData({ lost_reason_id: '', lost_notes: '' });
                                    }}
                                    className="px-6 py-3 rounded-xl font-black text-sm uppercase tracking-wider text-gray-600 hover:bg-gray-100 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirmLoss}
                                    disabled={!lossData.lost_reason_id}
                                    className="px-6 py-3 rounded-xl font-black text-sm uppercase tracking-wider bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
                                >
                                    Confirmar Pérdida
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}




