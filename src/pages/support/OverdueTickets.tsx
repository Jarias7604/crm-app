import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertTriangle, Clock, Zap, TicketIcon, CalendarRange,
    ArrowUpDown, Download, RefreshCw, Filter, ChevronDown,
    TrendingDown, UserCheck, Tag, X, Flame, ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import {
    ticketService,
    type Ticket,
    type TicketCategory,
    type CompanyAgent,
    type TicketPriority,
} from '../../services/tickets';
import { formatDistanceToNow, format, differenceInHours, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { TicketPanel } from './components/TicketPanel';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function delayText(dueDate: string): { text: string; days: number; hours: number } {
    const now = new Date();
    const due = new Date(dueDate);
    const totalHours = differenceInHours(now, due);
    const days = differenceInDays(now, due);
    const hours = totalHours % 24;
    const text = days > 0 ? `${days}d ${hours}h atrasado` : `${totalHours}h atrasado`;
    return { text, days, hours: totalHours };
}

function delayBadge(totalHours: number) {
    if (totalHours >= 72) return 'bg-red-100 text-red-700 border-red-200';
    if (totalHours >= 24) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-orange-100 text-orange-700 border-orange-200';
}

const PC: Record<TicketPriority, { label: string; color: string; bg: string; icon: string }> = {
    low: { label: 'Baja', color: 'text-gray-500', bg: 'bg-gray-100', icon: '↓' },
    medium: { label: 'Media', color: 'text-blue-500', bg: 'bg-blue-50', icon: '→' },
    high: { label: 'Alta', color: 'text-amber-500', bg: 'bg-amber-50', icon: '↑' },
    urgent: { label: 'Urgente', color: 'text-red-500', bg: 'bg-red-50', icon: '⚡' },
};

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCSV(tickets: Ticket[], categories: TicketCategory[], agents: CompanyAgent[]) {
    const headers = ['ID', 'Título', 'Categoría', 'Prioridad', 'Estado', 'Asignado', 'Creado', 'Vencía', 'Atraso (horas)'];
    const rows = tickets.map(t => {
        const cat = categories.find(c => c.id === t.category_id)?.name || '';
        const agent = agents.find(a => a.id === t.assigned_to)?.full_name || 'Sin asignar';
        const { hours } = t.due_date ? delayText(t.due_date) : { hours: 0 };
        return [
            t.id,
            `"${t.title.replace(/"/g, '""')}"`,
            cat,
            PC[t.priority]?.label || t.priority,
            t.status,
            agent,
            format(new Date(t.created_at), 'yyyy-MM-dd HH:mm'),
            t.due_date ? format(new Date(t.due_date), 'yyyy-MM-dd HH:mm') : '',
            hours,
        ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tickets_atrasados_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado');
}

// ─── Main Component ───────────────────────────────────────────────────────────

type SortKey = 'created_at' | 'due_date' | 'delay' | 'priority';

export default function OverdueTickets() {
    const { profile } = useAuth();
    const navigate = useNavigate();

    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [categories, setCategories] = useState<TicketCategory[]>([]);
    const [agents, setAgents] = useState<CompanyAgent[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Ticket | null>(null);

    // Filters
    const [priorityFilter, setPriorityFilter] = useState<TicketPriority[]>([]);
    const [agentFilter, setAgentFilter] = useState('');
    const [catFilter, setCatFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Sorting
    const [sortKey, setSortKey] = useState<SortKey>('delay');
    const [sortAsc, setSortAsc] = useState(false);

    const load = useCallback(async () => {
        if (!profile?.company_id) return;
        setLoading(true);
        try {
            // Load all active (non-resolved) tickets and filter overdue client-side
            const [allTickets, cats, agts] = await Promise.all([
                ticketService.getTickets(profile.company_id, { status: ['new', 'open', 'pending'] }),
                ticketService.getCategories(profile.company_id),
                ticketService.getAgents(profile.company_id),
            ]);
            const now = new Date();
            const overdue = allTickets.filter(t => t.due_date && new Date(t.due_date) < now);
            setTickets(overdue);
            setCategories(cats);
            setAgents(agts);
        } catch { toast.error('Error al cargar tickets atrasados'); }
        finally { setLoading(false); }
    }, [profile?.company_id]);

    useEffect(() => { load(); }, [load]);

    // ─── Filtered + Sorted list ────────────────────────────────────────────────
    const filtered = useMemo(() => {
        let list = [...tickets];

        if (priorityFilter.length) list = list.filter(t => priorityFilter.includes(t.priority));
        if (agentFilter) list = list.filter(t => t.assigned_to === agentFilter);
        if (catFilter) list = list.filter(t => t.category_id === catFilter);
        if (dateFrom) list = list.filter(t => new Date(t.created_at) >= new Date(dateFrom));
        if (dateTo) list = list.filter(t => new Date(t.created_at) <= new Date(dateTo + 'T23:59:59'));

        const priorityOrder: Record<TicketPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

        list.sort((a, b) => {
            let diff = 0;
            if (sortKey === 'created_at') diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            else if (sortKey === 'due_date') diff = new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime();
            else if (sortKey === 'delay') {
                const da = differenceInHours(new Date(), new Date(a.due_date!));
                const db = differenceInHours(new Date(), new Date(b.due_date!));
                diff = da - db;
            }
            else if (sortKey === 'priority') diff = priorityOrder[a.priority] - priorityOrder[b.priority];
            return sortAsc ? diff : -diff;
        });

        return list;
    }, [tickets, priorityFilter, agentFilter, catFilter, dateFrom, dateTo, sortKey, sortAsc]);

    // ─── KPI calculations ──────────────────────────────────────────────────────
    const kpis = useMemo(() => {
        const total = filtered.length;
        const critical = filtered.filter(t => t.priority === 'urgent' || t.priority === 'high').length;
        const allHours = filtered.map(t => differenceInHours(new Date(), new Date(t.due_date!)));
        const avgHours = total ? Math.round(allHours.reduce((a, b) => a + b, 0) / total) : 0;
        const totalActive = tickets.length; // already filtered to overdue
        const pct = tickets.length > 0 ? Math.round((total / (tickets.length + 1)) * 100) : 0; // rough
        const maxHours = allHours.length ? Math.max(...allHours) : 0;
        const oldest = filtered.find(t => differenceInHours(new Date(), new Date(t.due_date!)) === maxHours);
        return { total, critical, avgHours, pct, maxHours, oldest };
    }, [filtered, tickets]);

    function toggleSort(key: SortKey) {
        if (sortKey === key) setSortAsc(p => !p);
        else { setSortKey(key); setSortAsc(false); }
    }

    function handleUpdated(u: Ticket) {
        setTickets(p => p.filter(t => t.id !== u.id || (u.due_date && new Date(u.due_date) < new Date())));
        setSelected(u);
        load();
    }

    const hasFilters = priorityFilter.length || agentFilter || catFilter || dateFrom || dateTo;

    return (
        <div className="h-full flex min-h-0">
            <div className="flex-1 min-w-0 overflow-y-auto p-5 space-y-5">

                {/* ── Header ── */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                            <div className="w-9 h-9 rounded-xl bg-red-500 flex items-center justify-center shadow-lg shadow-red-200">
                                <AlertTriangle className="w-5 h-5 text-white" />
                            </div>
                            Tickets Atrasados
                        </h1>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5 ml-11">
                            Reporte de vencimientos — {format(new Date(), "d MMM yyyy", { locale: es })}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={load} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={() => exportCSV(filtered, categories, agents)}
                            className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 shadow-sm hover:bg-gray-50"
                        >
                            <Download className="w-4 h-4 text-emerald-500" /> Exportar CSV
                        </button>
                        <button
                            onClick={() => navigate('/support/tickets')}
                            className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 hover:bg-indigo-100"
                        >
                            <TicketIcon className="w-4 h-4" /> Ver todos los tickets
                        </button>
                    </div>
                </div>

                {/* ── KPI Cards ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {[
                        {
                            label: 'Total Atrasados',
                            val: kpis.total,
                            icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
                            bg: 'bg-red-50', vc: 'text-red-700',
                            sub: 'tickets vencidos activos',
                        },
                        {
                            label: 'Críticos',
                            val: kpis.critical,
                            icon: <Flame className="w-4 h-4 text-orange-500" />,
                            bg: 'bg-orange-50', vc: 'text-orange-700',
                            sub: 'urgentes + alta prioridad',
                        },
                        {
                            label: 'Atraso Promedio',
                            val: kpis.avgHours >= 24 ? `${Math.floor(kpis.avgHours / 24)}d ${kpis.avgHours % 24}h` : `${kpis.avgHours}h`,
                            icon: <Clock className="w-4 h-4 text-amber-500" />,
                            bg: 'bg-amber-50', vc: 'text-amber-700',
                            sub: 'promedio de horas atrasadas',
                        },
                        {
                            label: 'Mayor Atraso',
                            val: kpis.maxHours >= 24 ? `${Math.floor(kpis.maxHours / 24)}d` : `${kpis.maxHours}h`,
                            icon: <ShieldAlert className="w-4 h-4 text-purple-500" />,
                            bg: 'bg-purple-50', vc: 'text-purple-700',
                            sub: kpis.oldest ? kpis.oldest.title.slice(0, 20) + '…' : 'sin tickets',
                        },
                        {
                            label: 'Sin Asignar',
                            val: filtered.filter(t => !t.assigned_to).length,
                            icon: <UserCheck className="w-4 h-4 text-blue-500" />,
                            bg: 'bg-blue-50', vc: 'text-blue-700',
                            sub: 'atrasados sin agente',
                        },
                    ].map((k, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
                            <div className={`w-7 h-7 rounded-lg ${k.bg} flex items-center justify-center mb-2`}>{k.icon}</div>
                            <p className={`text-2xl font-black ${k.vc}`}>{k.val}</p>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider mt-0.5">{k.label}</p>
                            <p className="text-[9px] text-gray-300 mt-0.5 truncate">{k.sub}</p>
                        </div>
                    ))}
                </div>

                {/* ── Filters ── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Filter className="w-4 h-4 text-indigo-400" />
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Filtros</span>
                        {hasFilters && (
                            <button
                                onClick={() => { setPriorityFilter([]); setAgentFilter(''); setCatFilter(''); setDateFrom(''); setDateTo(''); }}
                                className="ml-auto flex items-center gap-1 text-[9px] font-black text-red-400 hover:text-red-600 uppercase"
                            >
                                <X className="w-3 h-3" /> Limpiar
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {/* Date From */}
                        <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                                <CalendarRange className="w-3 h-3" /> Creado desde
                            </label>
                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20" />
                        </div>
                        {/* Date To */}
                        <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                                <CalendarRange className="w-3 h-3" /> Creado hasta
                            </label>
                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20" />
                        </div>
                        {/* Category */}
                        <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                                <Tag className="w-3 h-3" /> Categoría
                            </label>
                            <div className="relative">
                                <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 appearance-none pr-7">
                                    <option value="">Todas</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                        </div>
                        {/* Agent */}
                        <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                                <UserCheck className="w-3 h-3" /> Agente
                            </label>
                            <div className="relative">
                                <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 appearance-none pr-7">
                                    <option value="">Todos</option>
                                    {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                                </select>
                                <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                        </div>
                    </div>
                    {/* Priority pills */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest self-center">Prioridad:</span>
                        {(Object.keys(PC) as TicketPriority[]).map(p => (
                            <button key={p} onClick={() => setPriorityFilter(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                                className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border transition-all ${priorityFilter.includes(p) ? `${PC[p].bg} ${PC[p].color} border-current shadow-sm` : 'bg-gray-100 text-gray-400 border-transparent hover:bg-gray-200'}`}>
                                {PC[p].icon} {PC[p].label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Table ── */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            {filtered.length} ticket{filtered.length !== 1 ? 's' : ''} atrasado{filtered.length !== 1 ? 's' : ''}
                        </p>
                        <div className="flex items-center gap-1 text-[9px] font-black text-gray-400 uppercase">
                            <ArrowUpDown className="w-3 h-3" /> Ordenar por:
                            {(['delay', 'priority', 'created_at', 'due_date'] as SortKey[]).map(k => (
                                <button key={k} onClick={() => toggleSort(k)}
                                    className={`px-2.5 py-1 rounded-lg transition-all ${sortKey === k ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-100 text-gray-400'}`}>
                                    {{ delay: 'Atraso', priority: 'Prioridad', created_at: 'Creado', due_date: 'Vencía' }[k]}
                                    {sortKey === k && <span className="ml-0.5">{sortAsc ? '↑' : '↓'}</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-gray-50 bg-gray-50/40">
                                    {['Ticket / Lead', 'Categoría', 'Prioridad', 'Creado', 'Fecha Vencía', '⏰ Tiempo Atrasado', 'Agente', 'Acción'].map(h => (
                                        <th key={h} className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {[0, 1, 2, 3, 4, 5, 6, 7].map(j => <td key={j} className="px-4 py-4"><div className="h-3 bg-gray-100 rounded-full" /></td>)}
                                    </tr>
                                )) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-20 text-center">
                                            <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                                                <TrendingDown className="w-8 h-8 text-emerald-300" />
                                            </div>
                                            <p className="text-sm font-bold text-gray-300">¡Sin tickets atrasados!</p>
                                            <p className="text-[10px] text-gray-200 mt-1">Todos los tickets están al día</p>
                                        </td>
                                    </tr>
                                ) : filtered.map(ticket => {
                                    const { text: delayStr, hours: delayHours } = ticket.due_date ? delayText(ticket.due_date) : { text: '—', hours: 0 };
                                    const cat = categories.find(c => c.id === ticket.category_id);
                                    const agent = agents.find(a => a.id === ticket.assigned_to);
                                    const isSelected = selected?.id === ticket.id;

                                    return (
                                        <tr
                                            key={ticket.id}
                                            onClick={() => setSelected(isSelected ? null : ticket)}
                                            className={`cursor-pointer transition-colors group ${isSelected ? 'bg-red-50/60' : 'hover:bg-gray-50/50'}`}
                                        >
                                            {/* Ticket */}
                                            <td className="px-4 py-3.5 min-w-[200px]">
                                                <p className={`text-sm font-black transition-colors ${isSelected ? 'text-red-700' : 'text-gray-900 group-hover:text-red-600'}`}>
                                                    {ticket.title}
                                                </p>
                                                <p className="text-[10px] text-gray-400 mt-0.5">{ticket.lead?.name || 'Sin lead'}</p>
                                            </td>
                                            {/* Category */}
                                            <td className="px-4 py-3.5">
                                                {cat ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                                                        <span className="text-[10px] font-bold text-gray-600">{cat.name}</span>
                                                    </div>
                                                ) : <span className="text-[10px] text-gray-300">—</span>}
                                            </td>
                                            {/* Priority */}
                                            <td className="px-4 py-3.5">
                                                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${PC[ticket.priority].bg} ${PC[ticket.priority].color}`}>
                                                    {PC[ticket.priority].icon} {PC[ticket.priority].label}
                                                </span>
                                            </td>
                                            {/* Created */}
                                            <td className="px-4 py-3.5 whitespace-nowrap">
                                                <p className="text-[10px] font-bold text-gray-600">{format(new Date(ticket.created_at), 'dd MMM yyyy', { locale: es })}</p>
                                                <p className="text-[9px] text-gray-300">{formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: es })}</p>
                                            </td>
                                            {/* Due date */}
                                            <td className="px-4 py-3.5 whitespace-nowrap">
                                                {ticket.due_date ? (
                                                    <>
                                                        <p className="text-[10px] font-bold text-red-500">{format(new Date(ticket.due_date), 'dd MMM yyyy', { locale: es })}</p>
                                                        <p className="text-[9px] text-red-300">{format(new Date(ticket.due_date), 'HH:mm')}</p>
                                                    </>
                                                ) : <span className="text-[10px] text-gray-200">Sin fecha</span>}
                                            </td>
                                            {/* Delay badge */}
                                            <td className="px-4 py-3.5">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border ${delayBadge(delayHours)}`}>
                                                    <Clock className="w-3 h-3" /> {delayStr}
                                                </span>
                                            </td>
                                            {/* Agent */}
                                            <td className="px-4 py-3.5">
                                                {agent ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center text-[9px] font-black text-indigo-600 shrink-0 overflow-hidden">
                                                            {agent.avatar_url
                                                                ? <img src={agent.avatar_url} className="w-full h-full object-cover" alt="" />
                                                                : agent.full_name?.charAt(0)?.toUpperCase() || '?'}
                                                        </div>
                                                        <span className="text-[10px] font-bold text-gray-600 truncate max-w-[80px]">{agent.full_name}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[9px] font-bold text-red-400 flex items-center gap-1">
                                                        <Zap className="w-3 h-3" /> Sin asignar
                                                    </span>
                                                )}
                                            </td>
                                            {/* Action */}
                                            <td className="px-4 py-3.5">
                                                <button
                                                    onClick={e => { e.stopPropagation(); setSelected(isSelected ? null : ticket); }}
                                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${isSelected ? 'bg-red-100 text-red-600' : 'hover:bg-gray-100 text-gray-400'}`}
                                                >
                                                    {isSelected ? 'Cerrar' : 'Ver'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    {filtered.length > 0 && (
                        <div className="px-5 py-3 border-t border-gray-50 bg-red-50/30 flex items-center justify-between">
                            <p className="text-[9px] font-bold text-red-400">
                                {filtered.length} ticket{filtered.length !== 1 ? 's' : ''} vencido{filtered.length !== 1 ? 's' : ''} |
                                {' '}{filtered.filter(t => !t.assigned_to).length} sin asignar
                            </p>
                            <button onClick={() => exportCSV(filtered, categories, agents)}
                                className="flex items-center gap-1 text-[9px] font-black text-emerald-500 hover:text-emerald-700 uppercase">
                                <Download className="w-3 h-3" /> Exportar lista filtrada
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Detail Panel */}
            {selected && (
                <div className="w-[360px] shrink-0 border-l border-gray-100 overflow-hidden">
                    <TicketPanel
                        ticket={selected}
                        categories={categories}
                        agents={agents}
                        companyId={profile?.company_id || ''}
                        authorId={profile?.id || ''}
                        onClose={() => setSelected(null)}
                        onUpdate={handleUpdated}
                    />
                </div>
            )}
        </div>
    );
}
