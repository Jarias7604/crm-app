import { useState, useCallback, useEffect, useMemo } from 'react';
import { TicketIcon, AlertCircle, CheckCircle2, Filter, Plus, Search, ChevronDown, Timer, ShieldCheck, X, Zap, TrendingUp, RefreshCw, AlertTriangle, UserCheck, Edit2, MoreHorizontal, CalendarDays, Tag, Send, ArrowUpDown, CalendarRange, Trophy, CalendarClock, Settings, Users } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { ticketService, type Ticket, type TicketCategory, type TicketStatus, type TicketPriority, type TicketStats, type CompanyAgent, type TicketLead } from '../../services/tickets';
import { Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { CategoryManager } from './components/CategoryManager';
import { TicketPanel } from './components/TicketPanel';

const SC: Record<TicketStatus, { label: string; color: string; bg: string }> = {
    new: { label: 'Nuevo', color: 'text-blue-600', bg: 'bg-blue-50' },
    open: { label: 'Abierto', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    pending: { label: 'Pendiente', color: 'text-amber-600', bg: 'bg-amber-50' },
    resolved: { label: 'Resuelto', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    closed: { label: 'Cerrado', color: 'text-gray-500', bg: 'bg-gray-100' },
};
const PC: Record<TicketPriority, { label: string; color: string; bg: string; icon: string }> = {
    low: { label: 'Baja', color: 'text-gray-500', bg: 'bg-gray-100', icon: '↓' },
    medium: { label: 'Media', color: 'text-blue-500', bg: 'bg-blue-50', icon: '→' },
    high: { label: 'Alta', color: 'text-amber-500', bg: 'bg-amber-50', icon: '↑' },
    urgent: { label: 'Urgente', color: 'text-red-500', bg: 'bg-red-50', icon: '⚡' },
};
const PCOLS = ['#6B7280', '#3B82F6', '#F59E0B', '#EF4444'];
const STATUS_ORDER: TicketStatus[] = ['new', 'open', 'pending', 'resolved', 'closed'];

function AgentAvatar({ agent }: { agent: CompanyAgent }) {
    return (
        <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-[10px] font-black text-indigo-600 shrink-0 overflow-hidden">
            {agent.avatar_url ? <img src={agent.avatar_url} className="w-full h-full object-cover" alt="" /> : agent.full_name?.charAt(0)?.toUpperCase() || '?'}
        </div>
    );
}

const Tip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name?: string }[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    return <div className="bg-white border border-gray-100 rounded-xl shadow-xl px-4 py-3 text-xs">{label && <p className="font-bold text-gray-400 mb-1">{label}</p>}{payload.map((p, i) => <p key={i} className="font-black text-gray-800">{p.name ? `${p.name}: ` : ''}{p.value}</p>)}</div>;
};

type ComplianceRow = { agent: { id: string; full_name: string | null; avatar_url: string | null }; total: number; done: number; pct: number };

function Charts({ stats, agentCompliance, onOpenConfig }: {
    stats: TicketStats;
    onStatusClick?: (s: TicketStatus) => void;
    agentCompliance: ComplianceRow[];
    onOpenConfig: () => void;
}) {
    const dData = stats.byDay.map(d => ({ name: format(new Date(d.date + 'T12:00:00'), 'dd/MM', { locale: es }), T: d.count }));
    const pData = stats.byPriority.map(p => ({ name: PC[p.priority as TicketPriority]?.label || p.priority, value: p.count }));
    const maxP = Math.max(...pData.map(p => p.value), 1);
    const globalPct = agentCompliance.length
        ? Math.round(agentCompliance.reduce((s, r) => s + r.done, 0) / Math.max(agentCompliance.reduce((s, r) => s + r.total, 0), 1) * 100)
        : null;
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Compact Compliance card — replaces 'Por Estado' donut */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Compliance</p>
                    <div className="flex items-center gap-2">
                        {globalPct !== null && (
                            <span className={`text-sm font-black ${globalPct >= 80 ? 'text-emerald-600' : globalPct >= 50 ? 'text-amber-500' : 'text-red-500'
                                }`}>{globalPct}%</span>
                        )}
                        <button onClick={onOpenConfig} className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-indigo-50 text-gray-300 hover:text-indigo-500 transition-all">
                            <Settings className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
                {agentCompliance.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-200 py-4">
                        <Trophy className="w-8 h-8 mb-1" />
                        <p className="text-[10px] font-bold text-gray-300">Sin datos en rango</p>
                    </div>
                ) : (
                    <div className="space-y-2 overflow-y-auto flex-1 max-h-[140px] pr-0.5">
                        {agentCompliance.map((row, idx) => {
                            const col = row.pct >= 80 ? '#10B981' : row.pct >= 50 ? '#F59E0B' : '#EF4444';
                            const textCol = row.pct >= 80 ? 'text-emerald-600' : row.pct >= 50 ? 'text-amber-500' : 'text-red-500';
                            return (
                                <div key={row.agent.id}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[9px] text-gray-300 w-3 shrink-0">{idx + 1}</span>
                                        <div className="w-5 h-5 rounded-md bg-gray-100 flex items-center justify-center text-[8px] font-black text-gray-500 shrink-0 overflow-hidden">
                                            {row.agent.avatar_url ? <img src={row.agent.avatar_url} className="w-full h-full object-cover" alt="" /> : row.agent.full_name?.charAt(0)?.toUpperCase() || '?'}
                                        </div>
                                        <span className="text-[10px] font-bold text-gray-600 flex-1 truncate">{row.agent.full_name || 'Sin asignar'}</span>
                                        <span className={`text-[10px] font-black ${textCol}`}>{row.pct}%</span>
                                    </div>
                                    <div className="ml-8 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${row.pct}%`, backgroundColor: col }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            {/* Bar chart */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Últimos 7 Días</p>
                <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={dData} barSize={8}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 700, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={16} />
                        <Tooltip content={<Tip />} />
                        <Bar dataKey="T" name="Tickets" fill="#6366F1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            {/* Priority bars */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Por Prioridad</p>
                <div className="space-y-3">
                    {pData.map((p, i) => (
                        <div key={i}>
                            <div className="flex justify-between mb-0.5"><span className="text-[10px] font-bold text-gray-600">{p.name}</span><span className="text-[10px] font-black text-gray-800">{p.value}</span></div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(p.value / maxP) * 100}%`, backgroundColor: PCOLS[i % PCOLS.length] }} /></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function Tickets() {
    const { profile } = useAuth();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [allTickets, setAllTickets] = useState<Ticket[]>([]);  // all statuses, used for compliance
    const [categories, setCategories] = useState<TicketCategory[]>([]);
    const [agents, setAgents] = useState<CompanyAgent[]>([]);
    const [leads, setLeads] = useState<TicketLead[]>([]);
    const [leadSearch, setLeadSearch] = useState('');
    const [stats, setStats] = useState<TicketStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Ticket | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isCategoryOpen, setIsCategoryOpen] = useState(false);
    const [catFilter, setCatFilter] = useState('');
    const [agentFilter, setAgentFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<TicketStatus[]>(['new', 'open', 'pending']);
    const [search, setSearch] = useState('');
    const [newT, setNewT] = useState({ title: '', description: '', category_id: '', priority: 'medium' as TicketPriority, due_date: '', lead_id: '' });
    // Advanced filters
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [priorityFilter, setPriorityFilter] = useState<TicketPriority[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    // Sorting
    type SortKey = 'created_at' | 'due_date' | 'priority';
    const [sortKey, setSortKey] = useState<SortKey>('created_at');
    const [sortAsc, setSortAsc] = useState(false);
    function toggleSort(k: SortKey) { if (sortKey === k) setSortAsc(p => !p); else { setSortKey(k); setSortAsc(false); } }
    // Compliance filter — default current month
    const todayStr = new Date().toISOString().slice(0, 10);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const [compFrom, setCompFrom] = useState(monthStart);
    const [compTo, setCompTo] = useState(todayStr);
    // Compliance settings modal
    const [compConfigOpen, setCompConfigOpen] = useState(false);
    const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set()); // empty = all
    const [compFromDraft, setCompFromDraft] = useState(monthStart);
    const [compToDraft, setCompToDraft] = useState(todayStr);
    const [agentSearch, setAgentSearch] = useState('');
    function openCompConfig() { setCompFromDraft(compFrom); setCompToDraft(compTo); setCompConfigOpen(true); }
    function applyCompConfig() { setCompFrom(compFromDraft); setCompTo(compToDraft); setCompConfigOpen(false); }
    function toggleAgent(id: string) { setSelectedAgents(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }

    const load = useCallback(async () => {
        if (!profile?.company_id) return;
        setLoading(true);
        try {
            const [t, c, s, a, all, l] = await Promise.all([
                ticketService.getTickets(profile.company_id, { status: statusFilter, categoryId: catFilter || undefined, assignedTo: agentFilter || undefined }),
                ticketService.getCategories(profile.company_id),
                ticketService.getStats(profile.company_id),
                ticketService.getAgents(profile.company_id),
                ticketService.getTickets(profile.company_id),  // no filter — for compliance
                ticketService.getLeads(profile.company_id),
            ]);
            setTickets(t); setCategories(c); setStats(s); setAgents(a); setAllTickets(all); setLeads(l);
        } catch { toast.error('Error al cargar tickets'); }
        finally { setLoading(false); }
    }, [profile?.company_id, statusFilter, catFilter, agentFilter]);

    useEffect(() => { load(); }, [load]);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!profile) return;
        const tid = toast.loading('Creando...');
        try {
            await ticketService.createTicket({
                company_id: profile.company_id!, title: newT.title, description: newT.description,
                category_id: newT.category_id || null, priority: newT.priority, status: 'new',
                lead_id: newT.lead_id || null, assigned_to: null, metadata: {}, created_by: profile.id,
                due_date: newT.due_date ? new Date(newT.due_date).toISOString() : null,
            });
            toast.success('Ticket creado', { id: tid });
            setIsCreateOpen(false);
            setNewT({ title: '', description: '', category_id: '', priority: 'medium', due_date: '', lead_id: '' });
            setLeadSearch('');
            load();
        } catch { toast.error('Error', { id: tid }); }
    }

    function handleUpdated(u: Ticket) {
        setTickets(p => p.map(t => t.id === u.id ? u : t)); setSelected(u);
        if (profile?.company_id) ticketService.getStats(profile.company_id).then(setStats).catch(() => { });
    }

    function handleDeleted(id: string) {
        setTickets(p => p.filter(t => t.id !== id));
        setAllTickets(p => p.filter(t => t.id !== id));
        setSelected(null);
        if (profile?.company_id) ticketService.getStats(profile.company_id).then(setStats).catch(() => { });
    }

    function handleDonutClick(status: TicketStatus) {
        setStatusFilter(p => p.includes(status) ? p.filter(s => s !== status) : [status]);
    }

    const filtered = useMemo(() => {
        const pOrder: Record<TicketPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
        let list = tickets.filter(t => {
            const q = search.toLowerCase();
            if (q && !t.title.toLowerCase().includes(q) && !(t.lead?.name || '').toLowerCase().includes(q)) return false;
            if (priorityFilter.length && !priorityFilter.includes(t.priority)) return false;
            if (dateFrom && new Date(t.created_at) < new Date(dateFrom)) return false;
            if (dateTo && new Date(t.created_at) > new Date(dateTo + 'T23:59:59')) return false;
            return true;
        });
        list.sort((a, b) => {
            let d = 0;
            if (sortKey === 'created_at') d = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            else if (sortKey === 'due_date') d = (a.due_date ? new Date(a.due_date).getTime() : Infinity) - (b.due_date ? new Date(b.due_date).getTime() : Infinity);
            else if (sortKey === 'priority') d = pOrder[a.priority] - pOrder[b.priority];
            return sortAsc ? d : -d;
        });
        return list;
    }, [tickets, search, priorityFilter, dateFrom, dateTo, sortKey, sortAsc]);

    // Agent compliance: uses ALL tickets (incl. resolved/closed) — not the table's filtered state
    const agentCompliance = useMemo(() => {
        const from = compFrom ? new Date(compFrom) : null;
        const to = compTo ? new Date(compTo + 'T23:59:59') : null;
        const pool = allTickets.filter(t => {
            if (!t.due_date) return false;
            const d = new Date(t.due_date);
            if (from && d < from) return false;
            if (to && d > to) return false;
            if (selectedAgents.size > 0 && !selectedAgents.has(t.assigned_to || '__unassigned__')) return false;
            return true;
        });
        const map: Record<string, { agent: typeof agents[0]; total: number; done: number }> = {};
        pool.forEach(t => {
            const key = t.assigned_to || '__unassigned__';
            if (!map[key]) {
                const agent = agents.find(a => a.id === t.assigned_to);
                map[key] = { agent: agent ?? { id: '__unassigned__', full_name: 'Sin asignar', avatar_url: null, email: '' } as any, total: 0, done: 0 };
            }
            map[key].total++;
            if (['resolved', 'closed'].includes(t.status)) map[key].done++;
        });
        return Object.values(map)
            .map(r => ({ ...r, pct: r.total === 0 ? 0 : Math.round((r.done / r.total) * 100) }))
            .sort((a, b) => b.pct - a.pct);
    }, [allTickets, agents, compFrom, compTo, selectedAgents]);

    const kpis = stats ? [
        { label: 'Abiertos', val: stats.open, icon: <TicketIcon className="w-4 h-4 text-blue-600" />, bg: 'bg-blue-50', vc: 'text-blue-700' },
        { label: 'Urgentes', val: stats.urgent, icon: <AlertCircle className="w-4 h-4 text-red-500" />, bg: 'bg-red-50', vc: 'text-red-700' },
        { label: 'Pendientes', val: stats.pending, icon: <Timer className="w-4 h-4 text-amber-500" />, bg: 'bg-amber-50', vc: 'text-amber-700' },
        { label: 'Resueltos', val: stats.resolved, icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />, bg: 'bg-emerald-50', vc: 'text-emerald-700' },
        { label: 'Creados Hoy', val: stats.createdToday, icon: <CalendarDays className="w-4 h-4 text-indigo-500" />, bg: 'bg-indigo-50', vc: 'text-indigo-700' },
        { label: 'Resueltos Hoy', val: stats.resolvedToday, icon: <TrendingUp className="w-4 h-4 text-purple-500" />, bg: 'bg-purple-50', vc: 'text-purple-700' },
        { label: 'Total', val: stats.total, icon: <MoreHorizontal className="w-4 h-4 text-gray-500" />, bg: 'bg-gray-100', vc: 'text-gray-700' },
        { label: 'SLA Prom.', val: `${stats.avgResolutionTimeHours}h`, icon: <ShieldCheck className="w-4 h-4 text-teal-500" />, bg: 'bg-teal-50', vc: 'text-teal-700' },
    ] : [];

    return (
        <div className="h-full flex min-h-0">
            <div className="flex-1 min-w-0 overflow-y-auto p-5 space-y-5">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200"><TicketIcon className="w-5 h-5 text-white" /></div>
                            Service Hub
                        </h1>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5 ml-11">Gestión Inteligente de Soporte</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={load} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
                        <button onClick={() => setIsCategoryOpen(true)} className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 shadow-sm hover:bg-gray-50"><Tag className="w-4 h-4 text-indigo-500" />Categorías</button>
                        <button onClick={() => setIsCreateOpen(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-200 hover:bg-indigo-700"><Plus className="w-4 h-4" />Nuevo Ticket</button>
                    </div>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                    {kpis.map((k, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 hover:shadow-md transition-shadow">
                            <div className={`w-7 h-7 rounded-lg ${k.bg} flex items-center justify-center mb-2`}>{k.icon}</div>
                            <p className={`text-xl font-black ${k.vc}`}>{k.val}</p>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider mt-0.5">{k.label}</p>
                        </div>
                    ))}
                </div>

                {/* Charts */}
                {stats && stats.total > 0 && <Charts stats={stats} onStatusClick={handleDonutClick} agentCompliance={agentCompliance} onOpenConfig={openCompConfig} />}

                {/* Settings Modal for Compliance */}
                {compConfigOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setCompConfigOpen(false)}>
                        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
                        <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center"><Settings className="w-4 h-4 text-white" /></div>
                                        <div><p className="text-sm font-black text-gray-900">Configurar Compliance</p><p className="text-[10px] text-gray-400">Rango y agentes</p></div>
                                    </div>
                                    <button onClick={() => setCompConfigOpen(false)} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200"><X className="w-4 h-4" /></button>
                                </div>
                            </div>
                            <div className="px-6 py-5 space-y-5">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-3"><CalendarClock className="w-3.5 h-3.5" /> Rango (due_date)</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><p className="text-[9px] font-bold text-gray-400 mb-1">Desde</p><input type="date" value={compFromDraft} onChange={e => setCompFromDraft(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500/30" /></div>
                                        <div><p className="text-[9px] font-bold text-gray-400 mb-1">Hasta</p><input type="date" value={compToDraft} onChange={e => setCompToDraft(e.target.value)} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500/30" /></div>
                                    </div>
                                    <div className="flex gap-2 mt-2 flex-wrap">
                                        {[['Este mes', monthStart, todayStr] as const, ['Últ. 7 días', new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10), todayStr] as const, ['Últ. 30 días', new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), todayStr] as const].map(([label, from, to]) => (
                                            <button key={label} onClick={() => { setCompFromDraft(from); setCompToDraft(to); }} className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${compFromDraft === from && compToDraft === to ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{label}</button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center justify-between mb-3">
                                        <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Agentes</span>
                                        <button onClick={() => setSelectedAgents(new Set())} className="text-[9px] font-bold text-indigo-500 hover:text-indigo-700 normal-case">Todos</button>
                                    </label>
                                    <div className="relative mb-2"><Search className="w-3.5 h-3.5 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" /><input type="text" placeholder="Buscar agente..." value={agentSearch} onChange={e => setAgentSearch(e.target.value)} className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500/20" /></div>
                                    <div className="space-y-1 max-h-48 overflow-y-auto">
                                        {agents.filter(a => a.full_name?.toLowerCase().includes(agentSearch.toLowerCase())).map(a => (
                                            <button key={a.id} onClick={() => toggleAgent(a.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${selectedAgents.has(a.id) ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-gray-50 border border-transparent'}`}>
                                                <div className={`w-4 h-4 rounded shrink-0 border-2 flex items-center justify-center transition-all ${selectedAgents.has(a.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>{selectedAgents.has(a.id) && <CheckCircle2 className="w-3 h-3 text-white" />}</div>
                                                <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center text-[10px] font-black text-indigo-600 shrink-0 overflow-hidden">{a.avatar_url ? <img src={a.avatar_url} className="w-full h-full object-cover" alt="" /> : a.full_name?.charAt(0)?.toUpperCase() || '?'}</div>
                                                <span className={`text-xs font-bold flex-1 text-left ${selectedAgents.has(a.id) ? 'text-indigo-800' : 'text-gray-600'}`}>{a.full_name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="px-6 pb-6 flex gap-3">
                                <button onClick={() => setCompConfigOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-500 hover:bg-gray-50">Cancelar</button>
                                <button onClick={applyCompConfig} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700">Aplicar filtros</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Ticket Table */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* ── Filters panel ── */}
                    <div className="border-b border-gray-100 px-5 py-3.5 space-y-3">
                        {/* Top row */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* Category dropdown */}
                                <div className="relative group">
                                    <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-50 text-xs font-black text-gray-700 uppercase hover:bg-gray-100">
                                        <Tag className="w-3.5 h-3.5 text-indigo-500" />{categories.find(c => c.id === catFilter)?.name || 'Categorías'}<ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                    </button>
                                    <div className="hidden group-hover:block absolute top-full left-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1 min-w-[180px]">
                                        <button onClick={() => setCatFilter('')} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-xs font-bold text-gray-500">Todas</button>
                                        {categories.map(c => (
                                            <button key={c.id} onClick={() => setCatFilter(c.id)} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-xs font-bold text-gray-500 flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />{c.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {/* Agent dropdown */}
                                <div className="relative group">
                                    <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-50 text-xs font-black text-gray-700 uppercase hover:bg-gray-100">
                                        <UserCheck className="w-3.5 h-3.5 text-indigo-500" />{agents.find(a => a.id === agentFilter)?.full_name || 'Agentes'}<ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                    </button>
                                    <div className="hidden group-hover:block absolute top-full left-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1 min-w-[180px]">
                                        <button onClick={() => setAgentFilter('')} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-xs font-bold text-gray-500">Todos</button>
                                        {agents.map(a => <button key={a.id} onClick={() => setAgentFilter(a.id)} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-xs font-bold text-gray-500">{a.full_name}</button>)}
                                    </div>
                                </div>
                                <div className="h-4 w-px bg-gray-200" />
                                {/* Status pills */}
                                <div className="flex bg-gray-50 p-1 rounded-xl gap-0.5 flex-wrap">
                                    {(Object.keys(SC) as TicketStatus[]).map(s => (
                                        <button key={s} onClick={() => setStatusFilter(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])} className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${statusFilter.includes(s) ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>{SC[s].label}</button>
                                    ))}
                                </div>
                                <div className="h-4 w-px bg-gray-200" />
                                {/* Expand/collapse advanced filters */}
                                <button onClick={() => setShowFilters(p => !p)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase transition-all ${showFilters ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                    }`}>
                                    <Filter className="w-3.5 h-3.5" />
                                    Filtros
                                    {(priorityFilter.length > 0 || dateFrom || dateTo) && (
                                        <span className="w-4 h-4 bg-indigo-600 text-white rounded-full text-[8px] font-black flex items-center justify-center">
                                            {priorityFilter.length + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0)}
                                        </span>
                                    )}
                                </button>
                                {/* Clear all */}
                                {(catFilter || agentFilter || priorityFilter.length || dateFrom || dateTo) && (
                                    <button onClick={() => { setCatFilter(''); setAgentFilter(''); setPriorityFilter([]); setDateFrom(''); setDateTo(''); }}
                                        className="flex items-center gap-1 text-[9px] font-black text-red-400 hover:text-red-600 uppercase px-2 py-1.5 rounded-lg hover:bg-red-50">
                                        <X className="w-3 h-3" /> Limpiar
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Sort buttons */}
                                <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1">
                                    <ArrowUpDown className="w-3 h-3 text-gray-400 ml-1" />
                                    {([['created_at', 'Fecha'], ['priority', 'Prioridad'], ['due_date', 'Vence']] as [string, string][]).map(([k, label]) => (
                                        <button key={k} onClick={() => toggleSort(k as any)}
                                            className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${sortKey === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                                                }`}>
                                            {label}{sortKey === k && (sortAsc ? ' ↑' : ' ↓')}
                                        </button>
                                    ))}
                                </div>
                                {/* Search */}
                                <div className="relative">
                                    <Search className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input type="text" placeholder="Buscar ticket..." className="pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm w-44 focus:ring-2 focus:ring-indigo-500/20" value={search} onChange={e => setSearch(e.target.value)} />
                                </div>
                            </div>
                        </div>

                        {/* Advanced filters row (collapsible) */}
                        {showFilters && (
                            <div className="pt-2 border-t border-gray-50 grid grid-cols-2 md:grid-cols-4 gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                {/* Date from */}
                                <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                                        <CalendarRange className="w-3 h-3" /> Creado desde
                                    </label>
                                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20" />
                                </div>
                                {/* Date to */}
                                <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                                        <CalendarRange className="w-3 h-3" /> Creado hasta
                                    </label>
                                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20" />
                                </div>
                                {/* Priority pills */}
                                <div className="col-span-2">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                                        <AlertTriangle className="w-3 h-3" /> Prioridad
                                    </label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {(Object.keys(PC) as TicketPriority[]).map(p => (
                                            <button key={p} onClick={() => setPriorityFilter(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                                                className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase border transition-all ${priorityFilter.includes(p)
                                                    ? `${PC[p].bg} ${PC[p].color} border-current shadow-sm`
                                                    : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'
                                                    }`}>
                                                {PC[p].icon} {PC[p].label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead><tr className="border-b border-gray-50 bg-gray-50/40">
                                <th className="px-5 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Ticket</th>
                                <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Categoría</th>
                                <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">SLA</th>
                                <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Estado</th>
                                <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Prioridad</th>
                                <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Asignado</th>
                                <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Vence</th>
                                <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Acción</th>
                            </tr></thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? Array.from({ length: 4 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">{[0, 1, 2, 3, 4, 5, 6, 7].map(j => <td key={j} className="px-4 py-4"><div className="h-3 bg-gray-100 rounded-full" /></td>)}</tr>
                                )) : filtered.length === 0 ? (
                                    <tr><td colSpan={8} className="py-16 text-center"><TicketIcon className="w-10 h-10 text-gray-100 mx-auto mb-3" /><p className="text-sm font-bold text-gray-300">No hay tickets</p></td></tr>
                                ) : filtered.map(ticket => {
                                    const isSelected = selected?.id === ticket.id;
                                    const cat = categories.find(c => c.id === ticket.category_id);
                                    const sla = cat?.sla_hours ?? 24;
                                    const pct = Math.min(100, (Date.now() - new Date(ticket.created_at).getTime()) / (sla * 3600000) * 100);
                                    const barColor = pct < 50 ? '#10B981' : pct < 80 ? '#F59E0B' : '#EF4444';
                                    const resolved = ['resolved', 'closed'].includes(ticket.status);
                                    const agent = agents.find(a => a.id === ticket.assigned_to);
                                    const stepIdx = STATUS_ORDER.indexOf(ticket.status);
                                    const overdue = ticket.due_date && new Date(ticket.due_date) < new Date();
                                    return (
                                        <tr key={ticket.id} onClick={() => setSelected(isSelected ? null : ticket)} className={`cursor-pointer transition-colors group ${isSelected ? 'bg-indigo-50/60' : 'hover:bg-gray-50/50'}`}>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    <span className="text-[9px] font-black text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded-md tracking-widest">#{ticket.id.slice(0, 8).toUpperCase()}</span>
                                                    {ticket.lead?.name && (
                                                        <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-md truncate max-w-[120px]">{ticket.lead.name}</span>
                                                    )}
                                                </div>
                                                <p className={`text-sm font-black ${isSelected ? 'text-indigo-700' : 'text-gray-900 group-hover:text-indigo-600'} transition-colors`}>{ticket.title}</p>
                                                <p className="text-[9px] text-gray-300 mt-0.5">{formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: es })}</p>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                {cat ? <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} /><span className="text-[10px] font-bold text-gray-600">{cat.name}</span></div> : <span className="text-[10px] text-gray-300">—</span>}
                                            </td>
                                            <td className="px-4 py-3.5 min-w-[160px]">
                                                {resolved ? (<div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span className="text-xs font-bold text-emerald-600">Completado</span></div>)
                                                    : (<div className="space-y-1.5">
                                                        {/* % + label row */}
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: barColor }}>
                                                                {Math.round(pct)}%
                                                            </span>
                                                            <span className="text-[9px] text-gray-300">{sla}h SLA</span>
                                                        </div>
                                                        {/* Progress bar */}
                                                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                                                        </div>
                                                        {/* Step dots */}
                                                        <div className="flex gap-0.5">{STATUS_ORDER.slice(0, 4).map((_, i) => <div key={i} className={`flex-1 h-0.5 rounded-full ${i <= stepIdx ? 'bg-indigo-400' : 'bg-gray-100'}`} />)}</div>
                                                        {pct >= 80 && <div className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-500" /><span className="text-[10px] font-black text-amber-600">En riesgo</span></div>}
                                                        {pct >= 100 && <div className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-red-500" /><span className="text-[10px] font-black text-red-600">SLA vencido</span></div>}
                                                    </div>)}
                                            </td>
                                            <td className="px-4 py-3.5 text-center"><span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${SC[ticket.status].bg} ${SC[ticket.status].color}`}>{SC[ticket.status].label}</span></td>
                                            <td className="px-4 py-3.5"><span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${PC[ticket.priority].bg} ${PC[ticket.priority].color}`}>{PC[ticket.priority].icon} {PC[ticket.priority].label}</span></td>
                                            <td className="px-4 py-3.5">
                                                {agent ? <div className="flex items-center gap-1.5"><AgentAvatar agent={agent} /><span className="text-[10px] font-bold text-gray-600 truncate max-w-[80px]">{agent.full_name}</span></div> : <span className="text-[10px] text-gray-300 italic">Sin asignar</span>}
                                            </td>
                                            <td className="px-4 py-3.5">
                                                {ticket.due_date ? <span className={`text-[10px] font-bold ${overdue ? 'text-red-500' : 'text-gray-500'}`}>{format(new Date(ticket.due_date), 'dd MMM', { locale: es })}{overdue && ' ⚠️'}</span> : <span className="text-[10px] text-gray-200">—</span>}
                                            </td>
                                            <td className="px-4 py-3.5 text-right">
                                                <button onClick={e => { e.stopPropagation(); setSelected(isSelected ? null : ticket); }} className={`p-1.5 rounded-lg transition-all ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-100 text-gray-400'}`}><Edit2 className="w-3.5 h-3.5" /></button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {filtered.length > 0 && (
                        <div className="px-5 py-2.5 border-t border-gray-50 flex items-center justify-between">
                            <p className="text-[10px] font-bold text-gray-400">{filtered.length} ticket{filtered.length !== 1 ? 's' : ''} mostrados</p>
                            <div className="flex items-center gap-1 text-[10px] font-black text-indigo-500"><TrendingUp className="w-3 h-3" />{stats?.total ?? 0} total</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Detail Panel — fixed overlay like Leads panel */}
            {selected && (
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-40" onClick={() => setSelected(null)} />
                    {/* Panel */}
                    <div className="fixed top-0 right-0 bottom-0 w-[380px] z-50 shadow-2xl animate-in slide-in-from-right duration-300">
                        <TicketPanel ticket={selected} categories={categories} agents={agents} leads={leads} companyId={profile?.company_id || ''} authorId={profile?.id || ''} onClose={() => setSelected(null)} onUpdate={handleUpdated} onDelete={handleDeleted} />
                    </div>
                </>
            )}

            {/* Category Manager */}
            {isCategoryOpen && (
                <CategoryManager categories={categories} companyId={profile?.company_id || ''} onClose={() => setIsCategoryOpen(false)} onChanged={setCategories} />
            )}

            {/* Create Modal */}
            {isCreateOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsCreateOpen(false)} />
                    <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
                        <form onSubmit={handleCreate}>
                            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200"><Zap className="w-5 h-5 text-white" /></div>
                                    <div><h3 className="text-lg font-black text-gray-900">Nuevo Ticket</h3><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Caso de soporte</p></div>
                                </div>
                                <button type="button" onClick={() => setIsCreateOpen(false)} className="p-2 hover:bg-white/80 rounded-xl text-gray-400"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Título *</label>
                                    <input required type="text" placeholder="Ej: Error al acceder al dashboard" className="mt-1.5 w-full px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20" value={newT.title} onChange={e => setNewT(p => ({ ...p, title: e.target.value }))} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Categoría</label>
                                        <select className="mt-1.5 w-full px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20" value={newT.category_id} onChange={e => setNewT(p => ({ ...p, category_id: e.target.value }))}>
                                            <option value="">Sin categoría</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Prioridad</label>
                                        <select className="mt-1.5 w-full px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20" value={newT.priority} onChange={e => setNewT(p => ({ ...p, priority: e.target.value as TicketPriority }))}>
                                            <option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="urgent">Urgente</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><CalendarDays className="w-3 h-3" />Fecha de Vencimiento</label>
                                    <input type="datetime-local" className="mt-1.5 w-full px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20" value={newT.due_date} onChange={e => setNewT(p => ({ ...p, due_date: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><UserCheck className="w-3 h-3" />Cliente / Lead</label>
                                    <div className="mt-1.5 bg-gray-50 rounded-2xl overflow-hidden">
                                        <div className="relative">
                                            <Search className="w-3.5 h-3.5 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
                                            <input type="text" placeholder="Buscar cliente..." value={leadSearch} onChange={e => setLeadSearch(e.target.value)}
                                                className="w-full pl-8 pr-3 py-2.5 bg-transparent border-none text-sm focus:ring-0 font-medium" />
                                        </div>
                                        {newT.lead_id && (
                                            <div className="flex items-center gap-2 px-3 pb-2">
                                                <span className="flex items-center gap-1.5 bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-lg text-xs font-bold">
                                                    {leads.find(l => l.id === newT.lead_id)?.name}
                                                    <button type="button" onClick={() => { setNewT(p => ({ ...p, lead_id: '' })); setLeadSearch(''); }} className="ml-1 hover:text-red-500"><X className="w-3 h-3" /></button>
                                                </span>
                                            </div>
                                        )}
                                        {!newT.lead_id && (
                                            <div className="max-h-36 overflow-y-auto border-t border-gray-100">
                                                {leads.filter(l => l.name.toLowerCase().includes(leadSearch.toLowerCase()) || l.email?.toLowerCase().includes(leadSearch.toLowerCase())).slice(0, 8).map(l => (
                                                    <button key={l.id} type="button" onClick={() => { setNewT(p => ({ ...p, lead_id: l.id })); setLeadSearch(''); }}
                                                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-indigo-50 transition-colors text-left">
                                                        <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-[10px] font-black text-indigo-600 shrink-0">{l.name.charAt(0).toUpperCase()}</div>
                                                        <div><p className="text-xs font-bold text-gray-800">{l.name}</p><p className="text-[9px] text-gray-400">{l.email || l.phone || '—'}</p></div>
                                                    </button>
                                                ))}
                                                {leads.filter(l => l.name.toLowerCase().includes(leadSearch.toLowerCase())).length === 0 && (
                                                    <p className="text-[10px] text-gray-300 text-center py-3 font-bold">Sin resultados</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Descripción</label>
                                    <textarea rows={3} placeholder="Detalla el problema..." className="mt-1.5 w-full px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 resize-none" value={newT.description} onChange={e => setNewT(p => ({ ...p, description: e.target.value }))} />
                                </div>
                            </div>
                            <div className="px-6 py-4 bg-gray-50/60 border-t border-gray-100 flex items-center justify-end gap-3">
                                <button type="button" onClick={() => setIsCreateOpen(false)} className="px-5 py-2.5 text-sm font-black text-gray-400 hover:text-gray-600">Cancelar</button>
                                <button type="submit" className="bg-indigo-600 text-white px-8 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-200"><Send className="w-4 h-4" />Crear Ticket</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
