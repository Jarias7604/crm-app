import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus, Search, FileText, CheckCircle, XCircle,
    Clock, Eye, Edit, Trash2, X, ChevronRight, DollarSign
} from 'lucide-react';

/* ─── Status config ──────────────────────────────────────────── */
const STATUS: Record<string, {
    label: string;
    chipBg: string;
    chipText: string;
    borderColor: string;
    icon: React.ReactNode;
}> = {
    borrador: {
        label: 'Borrador',
        chipBg: 'bg-gray-100',
        chipText: 'text-gray-600',
        borderColor: '#9CA3AF',
        icon: <Clock className="w-3 h-3" />,
    },
    enviada: {
        label: 'Enviada',
        chipBg: 'bg-blue-50',
        chipText: 'text-blue-700',
        borderColor: '#3B82F6',
        icon: <FileText className="w-3 h-3" />,
    },
    aceptada: {
        label: 'Aceptada',
        chipBg: 'bg-emerald-50',
        chipText: 'text-emerald-700',
        borderColor: '#10B981',
        icon: <CheckCircle className="w-3 h-3" />,
    },
    rechazada: {
        label: 'Rechazada',
        chipBg: 'bg-red-50',
        chipText: 'text-red-700',
        borderColor: '#EF4444',
        icon: <XCircle className="w-3 h-3" />,
    },
    expirada: {
        label: 'Expirada',
        chipBg: 'bg-orange-50',
        chipText: 'text-orange-700',
        borderColor: '#F97316',
        icon: <Clock className="w-3 h-3" />,
    },
};

/* ─── Props ──────────────────────────────────────────────────── */
interface Props {
    cotizaciones: any[];
    stats: {
        total: number;
        aceptadas: number;
        enviadas: number;
        valor_total: number;
        valor_aceptadas: number;
    };
    loading: boolean;
    onDelete: (id: string, nombre?: string) => void;
}

/* ─── Component ──────────────────────────────────────────────── */
export function CotizacionesMobileView({ cotizaciones, stats, loading, onDelete }: Props) {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [sheet, setSheet] = useState<any | null>(null);

    const STATUS_KEYS = ['borrador', 'enviada', 'aceptada', 'rechazada', 'expirada'];

    const filtered = cotizaciones.filter(c => {
        const q = search.toLowerCase();
        const matchSearch = !search ||
            c.nombre_cliente?.toLowerCase().includes(q) ||
            c.empresa_cliente?.toLowerCase().includes(q) ||
            c.plan_nombre?.toLowerCase().includes(q);
        const matchStatus = !statusFilter || c.estado === statusFilter;
        return matchSearch && matchStatus;
    });

    const closeSheet = () => setSheet(null);

    return (
        <div className="flex flex-col bg-gray-50 min-h-screen -mx-4 -mt-4 overflow-x-hidden">

            {/* ── Sticky Header ─────────────────────────────────── */}
            <div className="sticky top-0 z-20 bg-white shadow-sm">
                {/* Title row */}
                <div className="flex items-center justify-between px-4 pt-5 pb-3">
                    <div>
                        <h1 className="text-xl font-black text-[#4449AA] tracking-tight">💰 Cotizaciones</h1>
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5">{stats.total} cotizaciones en total</p>
                    </div>
                </div>

                {/* Search */}
                <div className="relative mx-4 mb-3">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="search"
                        placeholder="Buscar cotización..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-10 py-2.5 bg-gray-100 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4449AA]/20 focus:bg-white transition-all"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 active:scale-90 transition-transform">
                            <X className="w-4 h-4 text-gray-400" />
                        </button>
                    )}
                </div>

                {/* Filter chips — horizontal scroll */}
                <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none">
                    <button
                        onClick={() => setStatusFilter(null)}
                        className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${!statusFilter ? 'bg-[#4449AA] text-white shadow-sm' : 'bg-gray-100 text-gray-500'}`}
                    >
                        Todas
                    </button>
                    {STATUS_KEYS.map(key => {
                        const cfg = STATUS[key];
                        const active = statusFilter === key;
                        return (
                            <button
                                key={key}
                                onClick={() => setStatusFilter(active ? null : key)}
                                className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${active ? `${cfg.chipBg} ${cfg.chipText} ring-1 ring-current/30` : 'bg-gray-100 text-gray-500'}`}
                            >
                                {cfg.icon}
                                {cfg.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Mini Stats Row ────────────────────────────────── */}
            <div className="flex gap-3 px-4 py-3 overflow-x-auto scrollbar-none">
                {/* Total */}
                <div className="flex-shrink-0 bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 min-w-[90px]">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Total</p>
                    <p className="text-2xl font-black text-slate-900 leading-none">{stats.total}</p>
                </div>
                {/* Enviadas */}
                <div className="flex-shrink-0 bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 min-w-[90px]">
                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Enviadas</p>
                    <p className="text-2xl font-black text-blue-600 leading-none">{stats.enviadas}</p>
                </div>
                {/* Aceptadas */}
                <div className="flex-shrink-0 bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 min-w-[100px]">
                    <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Cerradas</p>
                    <p className="text-2xl font-black text-emerald-600 leading-none">{stats.aceptadas}</p>
                </div>
                {/* Valor cerrado */}
                <div className="flex-shrink-0 bg-gradient-to-br from-[#4449AA] to-indigo-700 rounded-2xl px-4 py-3 shadow-lg shadow-[#4449AA]/20 min-w-[120px]">
                    <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-1">Cerrado $</p>
                    <p className="text-xl font-black text-white leading-none">${(stats.valor_aceptadas || 0).toLocaleString()}</p>
                </div>
            </div>

            {/* ── Quotes List ───────────────────────────────────── */}
            <div className="flex-1 px-4 pb-32 space-y-3">

                {/* Loading */}
                {loading && (
                    <div className="space-y-3 pt-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 animate-pulse">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gray-100" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-3 bg-gray-100 rounded-full w-3/4" />
                                        <div className="h-2.5 bg-gray-100 rounded-full w-1/2" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Empty state */}
                {!loading && filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-20 h-20 rounded-3xl bg-indigo-50 flex items-center justify-center mb-5">
                            <DollarSign className="w-10 h-10 text-[#4449AA]/30" />
                        </div>
                        <p className="text-sm font-black text-gray-300 uppercase tracking-widest mb-6">
                            {search || statusFilter ? 'Sin resultados' : 'Sin cotizaciones aún'}
                        </p>
                        {!search && !statusFilter && (
                            <button
                                onClick={() => navigate('/cotizaciones/nueva-pro')}
                                className="flex items-center gap-2 bg-[#4449AA] text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest active:scale-95 transition-transform shadow-lg shadow-[#4449AA]/25"
                            >
                                <Plus className="w-4 h-4" />
                                Crear Primera
                            </button>
                        )}
                    </div>
                )}

                {/* Cards */}
                {!loading && filtered.map(cot => {
                    const cfg = STATUS[cot.estado] || STATUS.borrador;
                    return (
                        <button
                            key={cot.id}
                            onClick={() => setSheet(cot)}
                            className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left active:scale-[0.98] transition-all duration-150 overflow-hidden"
                            style={{ borderLeftWidth: 4, borderLeftColor: cfg.borderColor }}
                        >
                            <div className="flex items-center gap-3">
                                {/* Icon */}
                                <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                                    <FileText className="w-5 h-5 text-[#4449AA]" />
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-0.5">
                                        <p className="text-sm font-black text-gray-900 truncate leading-snug">{cot.nombre_cliente}</p>
                                        <span className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${cfg.chipBg} ${cfg.chipText}`}>
                                            {cfg.icon}
                                            {cfg.label}
                                        </span>
                                    </div>
                                    <p className="text-xs text-blue-600 font-semibold truncate mb-1.5">{cot.empresa_cliente || 'Individual'}</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-black text-gray-900">${(cot.total_anual || 0).toLocaleString()}</span>
                                        <span className="text-gray-200 text-xs">•</span>
                                        <span className="text-[11px] text-gray-400 truncate">{cot.plan_nombre}</span>
                                    </div>
                                </div>

                                {/* Arrow */}
                                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                            </div>

                            {/* Date */}
                            <p className="text-[10px] text-gray-400 mt-2.5 ml-14">
                                {new Date(cot.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                        </button>
                    );
                })}
            </div>

            {/* ── FAB ──────────────────────────────────────────── */}
            <div className="fixed bottom-24 right-4 z-30">
                <button
                    onClick={() => navigate('/cotizaciones/nueva-pro')}
                    className="flex items-center gap-2 bg-[#4449AA] text-white pl-5 pr-6 py-4 rounded-2xl shadow-xl shadow-[#4449AA]/40 active:scale-95 transition-transform font-black text-xs uppercase tracking-widest"
                >
                    <Plus className="w-4 h-4" />
                    Nueva
                </button>
            </div>

            {/* ── Detail Bottom Sheet ───────────────────────────── */}
            {sheet && (
                <div className="fixed inset-0 z-[9999] overflow-hidden">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/40 lead-sheet-backdrop"
                        onClick={closeSheet}
                    />

                    {/* Sheet panel */}
                    <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-[28px] lead-sheet overflow-hidden">
                        {/* Drag handle */}
                        <div className="flex justify-center pt-3 pb-1">
                            <div className="w-10 h-1 bg-gray-200 rounded-full" />
                        </div>

                        {/* Sheet header */}
                        <div className="px-6 pt-3 pb-4 border-b border-gray-100">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-xl font-black text-gray-900 truncate">{sheet.nombre_cliente}</h2>
                                    <p className="text-sm text-blue-600 font-semibold truncate">{sheet.empresa_cliente || 'Individual'}</p>
                                </div>
                                <button
                                    onClick={closeSheet}
                                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform mt-0.5"
                                >
                                    <X className="w-4 h-4 text-gray-600" />
                                </button>
                            </div>

                            {/* Status pill */}
                            {(() => {
                                const cfg = STATUS[sheet.estado] || STATUS.borrador;
                                return (
                                    <span className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-xs font-black ${cfg.chipBg} ${cfg.chipText}`}>
                                        {cfg.icon}
                                        {cfg.label}
                                    </span>
                                );
                            })()}
                        </div>

                        {/* Sheet data grid */}
                        <div className="px-6 py-4 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-3.5 border border-indigo-100/50">
                                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1.5">Total Anual</p>
                                    <p className="text-xl font-black text-gray-900">${(sheet.total_anual || 0).toLocaleString()}</p>
                                </div>
                                <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Volumen DTEs</p>
                                    <p className="text-xl font-black text-gray-900">{(sheet.volumen_dtes || 0).toLocaleString()}</p>
                                </div>
                            </div>

                            <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100">
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Plan</p>
                                <p className="text-sm font-bold text-gray-900">{sheet.plan_nombre || '—'}</p>
                            </div>

                            <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100">
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Fecha de creación</p>
                                <p className="text-sm font-bold text-gray-900">
                                    {new Date(sheet.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                        </div>

                        {/* Sheet actions */}
                        <div className="px-6 pb-10 space-y-3">
                            {/* Primary actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => { navigate(`/cotizaciones/${sheet.id}`); closeSheet(); }}
                                    className="flex-1 flex items-center justify-center gap-2 bg-[#4449AA] text-white py-3.5 rounded-2xl text-sm font-black active:scale-[0.97] transition-transform shadow-lg shadow-[#4449AA]/25"
                                >
                                    <Eye className="w-4 h-4" />
                                    Ver Detalles
                                </button>
                                <button
                                    onClick={() => { navigate(`/cotizaciones/${sheet.id}/editar`); closeSheet(); }}
                                    className="flex-1 flex items-center justify-center gap-2 bg-indigo-50 text-[#4449AA] py-3.5 rounded-2xl text-sm font-black active:scale-[0.97] transition-transform border border-indigo-100"
                                >
                                    <Edit className="w-4 h-4" />
                                    Editar
                                </button>
                            </div>

                            {/* Delete */}
                            <button
                                onClick={() => { onDelete(sheet.id, sheet.nombre_cliente); closeSheet(); }}
                                className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-500 py-3.5 rounded-2xl text-sm font-black active:scale-[0.97] transition-transform border border-red-100"
                            >
                                <Trash2 className="w-4 h-4" />
                                Eliminar Cotización
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
