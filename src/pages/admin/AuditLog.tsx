import { useState, useEffect, useCallback } from 'react';
import {
    Shield, Search, Filter, ChevronLeft, ChevronRight,
    Clock, User, FileText, Users, Megaphone, Building,
    ArrowUpDown, Eye, RefreshCw, Activity, Loader2,
    AlertTriangle, CheckCircle2, Edit3, Trash2,
    LogIn, Upload, Download, Lock, Zap, ChevronDown
} from 'lucide-react';
import { auditLogService, type AuditLogEntry, type AuditLogFilters } from '../../services/auditLog';

// === ACTION METADATA ===
const ACTION_META: Record<string, { label: string; color: string; icon: any; bg: string }> = {
    INSERT: { label: 'Creado', color: 'text-emerald-600', icon: CheckCircle2, bg: 'bg-emerald-50 border-emerald-100' },
    UPDATE: { label: 'Actualizado', color: 'text-blue-600', icon: Edit3, bg: 'bg-blue-50 border-blue-100' },
    DELETE: { label: 'Eliminado', color: 'text-red-600', icon: Trash2, bg: 'bg-red-50 border-red-100' },
    STATUS_CHANGE: { label: 'Cambio Estado', color: 'text-amber-600', icon: ArrowUpDown, bg: 'bg-amber-50 border-amber-100' },
    PERMISSION_CHANGE: { label: 'Cambio Permiso', color: 'text-purple-600', icon: Lock, bg: 'bg-purple-50 border-purple-100' },
    LOGIN: { label: 'Inicio Sesión', color: 'text-cyan-600', icon: LogIn, bg: 'bg-cyan-50 border-cyan-100' },
    LOGOUT: { label: 'Cerrar Sesión', color: 'text-gray-600', icon: LogIn, bg: 'bg-gray-50 border-gray-100' },
    EXPORT: { label: 'Exportación', color: 'text-indigo-600', icon: Download, bg: 'bg-indigo-50 border-indigo-100' },
    IMPORT: { label: 'Importación', color: 'text-teal-600', icon: Upload, bg: 'bg-teal-50 border-teal-100' },
    RPC_CALL: { label: 'Operación', color: 'text-orange-600', icon: Zap, bg: 'bg-orange-50 border-orange-100' },
    OTHER: { label: 'Otro', color: 'text-gray-500', icon: Activity, bg: 'bg-gray-50 border-gray-100' },
};

const ENTITY_META: Record<string, { label: string; icon: any; color: string }> = {
    lead: { label: 'Lead', icon: Users, color: 'text-blue-500' },
    cotizacion: { label: 'Cotización', icon: FileText, color: 'text-indigo-500' },
    profile: { label: 'Usuario', icon: User, color: 'text-purple-500' },
    company: { label: 'Empresa', icon: Building, color: 'text-amber-500' },
    campaign: { label: 'Campaña', icon: Megaphone, color: 'text-pink-500' },
};

// === HELPERS ===
function timeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'Hace un momento';
    if (diffMin < 60) return `Hace ${diffMin}m`;
    if (diffHr < 24) return `Hace ${diffHr}h`;
    if (diffDay < 7) return `Hace ${diffDay}d`;
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString('es-ES', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}

// === MAIN COMPONENT ===
export default function AuditLog() {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [entityTypes, setEntityTypes] = useState<string[]>([]);

    // Stats
    const [stats, setStats] = useState({ total_events: 0, events_today: 0, unique_users: 0, top_actions: [] as any[] });

    // Filters
    const [filters, setFilters] = useState<AuditLogFilters>({});
    const [showFilters, setShowFilters] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const pageSize = 50;
    const totalPages = Math.ceil(totalCount / pageSize);

    const loadData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const appliedFilters = { ...filters };
            if (searchTerm.trim()) appliedFilters.search = searchTerm.trim();

            const [logsResult, statsResult, types] = await Promise.all([
                auditLogService.getLogs(page, appliedFilters),
                auditLogService.getStats(),
                auditLogService.getEntityTypes()
            ]);

            setLogs(logsResult.data);
            setTotalCount(logsResult.count);
            setStats(statsResult);
            setEntityTypes(types);
        } catch (error) {
            console.error('Error loading audit logs:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [page, filters, searchTerm]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleFilterChange = (key: keyof AuditLogFilters, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value || undefined }));
        setPage(0);
    };

    const clearFilters = () => {
        setFilters({});
        setSearchTerm('');
        setPage(0);
    };

    const activeFilterCount = Object.values(filters).filter(Boolean).length + (searchTerm ? 1 : 0);

    // === RENDER ===
    if (loading && logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <Loader2 className="w-10 h-10 text-[#4449AA] animate-spin" />
                <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Cargando registro de actividad...</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[1500px] mx-auto pb-6 space-y-6 animate-in fade-in duration-500">

            {/* Page Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-200">
                        <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-2xl font-extrabold text-[#4449AA] tracking-tight uppercase">
                            Registro de <span className="text-gray-900 font-black">Actividad</span>
                        </h1>
                        <p className="text-[13px] text-gray-400 font-medium">
                            Auditoría completa de cambios en la plataforma
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => loadData(true)}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-[11px] font-black uppercase tracking-widest text-gray-500 hover:text-[#4449AA] hover:border-[#4449AA]/30 transition-all shadow-sm disabled:opacity-50"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                    Actualizar
                </button>
            </header>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                    icon={Activity}
                    label="Total Eventos"
                    value={stats.total_events.toLocaleString()}
                    color="from-blue-500 to-indigo-600"
                    shadowColor="shadow-blue-200"
                />
                <StatCard
                    icon={Clock}
                    label="Eventos Hoy"
                    value={stats.events_today.toLocaleString()}
                    color="from-emerald-500 to-teal-600"
                    shadowColor="shadow-emerald-200"
                />
                <StatCard
                    icon={Users}
                    label="Usuarios Activos"
                    value={stats.unique_users.toLocaleString()}
                    color="from-purple-500 to-violet-600"
                    shadowColor="shadow-purple-200"
                />
            </div>

            {/* Main Card */}
            <div className="bg-white rounded-[2rem] shadow-[0_8px_40px_rgb(0,0,0,0.03)] border border-gray-100/50 overflow-hidden">

                {/* Toolbar */}
                <div className="px-8 py-5 border-b border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gray-50/30">
                    {/* Search */}
                    <div className="relative w-full md:w-96 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 group-focus-within:text-[#4449AA] transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, email, entidad..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
                            className="w-full h-11 pl-12 pr-4 rounded-xl bg-white border border-gray-200 focus:border-[#4449AA]/30 focus:ring-4 focus:ring-[#4449AA]/5 outline-none transition-all font-bold text-sm placeholder:text-gray-300"
                        />
                    </div>

                    {/* Filter Toggle */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all ${activeFilterCount > 0
                                ? 'bg-[#4449AA] text-white border-[#4449AA] shadow-lg shadow-indigo-200'
                                : 'bg-white text-gray-500 border-gray-200 hover:border-[#4449AA]/30'
                                }`}
                        >
                            <Filter className="w-3.5 h-3.5" />
                            Filtros
                            {activeFilterCount > 0 && (
                                <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                                    {activeFilterCount}
                                </span>
                            )}
                            <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                        </button>

                        {activeFilterCount > 0 && (
                            <button
                                onClick={clearFilters}
                                className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:underline"
                            >
                                Limpiar
                            </button>
                        )}

                        {/* Results Count */}
                        <span className="text-[11px] font-bold text-gray-400 shrink-0">
                            {totalCount.toLocaleString()} registros
                        </span>
                    </div>
                </div>

                {/* Filters Panel (Collapsible) */}
                {showFilters && (
                    <div className="px-8 py-4 bg-gray-50/50 border-b border-gray-100 animate-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <FilterSelect
                                label="Acción"
                                value={filters.action || ''}
                                onChange={(v) => handleFilterChange('action', v)}
                                options={[
                                    { value: '', label: 'Todas las acciones' },
                                    ...Object.entries(ACTION_META).map(([k, v]) => ({ value: k, label: v.label }))
                                ]}
                            />
                            <FilterSelect
                                label="Entidad"
                                value={filters.entity_type || ''}
                                onChange={(v) => handleFilterChange('entity_type', v)}
                                options={[
                                    { value: '', label: 'Todas las entidades' },
                                    ...entityTypes.map(t => ({
                                        value: t,
                                        label: ENTITY_META[t]?.label || t.charAt(0).toUpperCase() + t.slice(1)
                                    }))
                                ]}
                            />
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Desde</label>
                                <input
                                    type="date"
                                    value={filters.date_from || ''}
                                    onChange={(e) => handleFilterChange('date_from', e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm font-bold text-gray-700 outline-none focus:border-[#4449AA]/30"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Hasta</label>
                                <input
                                    type="date"
                                    value={filters.date_to || ''}
                                    onChange={(e) => handleFilterChange('date_to', e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm font-bold text-gray-700 outline-none focus:border-[#4449AA]/30"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Timeline List */}
                <div className="divide-y divide-gray-50 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                    {logs.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center text-gray-300">
                            <AlertTriangle className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-[11px] font-black uppercase tracking-widest">Sin registros de actividad</p>
                            <p className="text-[10px] text-gray-400 mt-1">Los cambios se registran automáticamente</p>
                        </div>
                    ) : (
                        logs.map((log) => {
                            const actionMeta = ACTION_META[log.action] || ACTION_META.OTHER;
                            const entityMeta = ENTITY_META[log.entity_type] || { label: log.entity_type, icon: Activity, color: 'text-gray-400' };
                            const isExpanded = expandedId === log.id;
                            const ActionIcon = actionMeta.icon;
                            const EntityIcon = entityMeta.icon;

                            return (
                                <div
                                    key={log.id}
                                    className="group hover:bg-gray-50/60 transition-all cursor-pointer"
                                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                                >
                                    <div className="px-8 py-4 flex items-center gap-5">
                                        {/* Action Icon */}
                                        <div className={`w-10 h-10 shrink-0 rounded-xl border flex items-center justify-center ${actionMeta.bg} transition-transform group-hover:scale-105`}>
                                            <ActionIcon className={`w-4.5 h-4.5 ${actionMeta.color}`} />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {/* Action Badge */}
                                                <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${actionMeta.bg} ${actionMeta.color}`}>
                                                    {actionMeta.label}
                                                </span>
                                                {/* Entity Badge */}
                                                <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500">
                                                    <EntityIcon className={`w-3 h-3 ${entityMeta.color}`} />
                                                    {entityMeta.label}
                                                </span>
                                                {/* Entity Name */}
                                                {log.entity_name && (
                                                    <span className="text-[11px] font-black text-gray-800 truncate max-w-[200px]">
                                                        {log.entity_name}
                                                    </span>
                                                )}
                                            </div>
                                            {/* Description */}
                                            {log.description && (
                                                <p className="text-[12px] text-gray-500 font-medium mt-0.5 truncate">{log.description}</p>
                                            )}
                                        </div>

                                        {/* User */}
                                        <div className="hidden md:flex flex-col items-end gap-0.5 shrink-0 min-w-[120px]">
                                            <span className="text-[11px] font-black text-gray-700 truncate max-w-[150px]">
                                                {log.user_name || log.user_email?.split('@')[0] || 'Sistema'}
                                            </span>
                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                                                {log.user_role === 'super_admin' ? 'Super Admin' : log.user_role === 'company_admin' ? 'Admin' : log.user_role || 'Sistema'}
                                            </span>
                                        </div>

                                        {/* Time */}
                                        <div className="flex flex-col items-end gap-0.5 shrink-0">
                                            <span className="text-[11px] font-bold text-gray-500">{timeAgo(log.created_at)}</span>
                                            <span className="text-[9px] text-gray-400 font-mono">{new Date(log.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>

                                        {/* Expand indicator */}
                                        <Eye className={`w-4 h-4 shrink-0 transition-all ${isExpanded ? 'text-[#4449AA] rotate-0' : 'text-gray-200 group-hover:text-gray-400'}`} />
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="px-8 pb-6 animate-in slide-in-from-top-1 fade-in duration-200">
                                            <div className="ml-[60px] bg-gray-50/80 rounded-2xl p-6 border border-gray-100 space-y-4">
                                                {/* Metadata Row */}
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[10px]">
                                                    <div>
                                                        <span className="font-black text-gray-400 uppercase tracking-widest block mb-1">Fecha / Hora</span>
                                                        <span className="font-bold text-gray-700">{formatTime(log.created_at)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="font-black text-gray-400 uppercase tracking-widest block mb-1">Usuario</span>
                                                        <span className="font-bold text-gray-700">{log.user_email || 'Sistema'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="font-black text-gray-400 uppercase tracking-widest block mb-1">ID Entidad</span>
                                                        <span className="font-mono font-bold text-gray-700 break-all">{log.entity_id || '—'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="font-black text-gray-400 uppercase tracking-widest block mb-1">Acción</span>
                                                        <span className={`font-black ${actionMeta.color}`}>{log.action}</span>
                                                    </div>
                                                </div>

                                                {/* Value Changes */}
                                                {(log.old_values || log.new_values) && (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {log.old_values && (
                                                            <div className="bg-red-50/50 rounded-xl p-4 border border-red-100/50">
                                                                <span className="text-[9px] font-black text-red-500 uppercase tracking-widest block mb-2">Valores anteriores</span>
                                                                <pre className="text-[10px] font-mono text-red-700/80 whitespace-pre-wrap break-all">
                                                                    {JSON.stringify(log.old_values, null, 2)}
                                                                </pre>
                                                            </div>
                                                        )}
                                                        {log.new_values && (
                                                            <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100/50">
                                                                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block mb-2">Valores nuevos</span>
                                                                <pre className="text-[10px] font-mono text-emerald-700/80 whitespace-pre-wrap break-all">
                                                                    {JSON.stringify(log.new_values, null, 2)}
                                                                </pre>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-8 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/30">
                        <span className="text-[11px] font-bold text-gray-400">
                            Página {page + 1} de {totalPages}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-[#4449AA] hover:border-[#4449AA]/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                disabled={page >= totalPages - 1}
                                className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-[#4449AA] hover:border-[#4449AA]/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// === SUB-COMPONENTS ===

function StatCard({ icon: Icon, label, value, color, shadowColor }: {
    icon: any; label: string; value: string; color: string; shadowColor: string;
}) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg ${shadowColor}`}>
                <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
                <p className="text-2xl font-black text-gray-900 leading-tight">{value}</p>
            </div>
        </div>
    );
}

function FilterSelect({ label, value, onChange, options }: {
    label: string; value: string; onChange: (v: string) => void;
    options: { value: string; label: string }[];
}) {
    return (
        <div className="space-y-1">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm font-bold text-gray-700 outline-none focus:border-[#4449AA]/30 cursor-pointer appearance-none"
            >
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        </div>
    );
}
