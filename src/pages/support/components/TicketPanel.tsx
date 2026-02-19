import { useState, useEffect, useRef } from 'react';
import { X, Edit2, Save, RefreshCw, ChevronRight, UserCheck, MessageSquare, Lock, CalendarDays, Activity, ShieldCheck, CheckCircle2, Send, Search, Trash2, AlertTriangle, Clock } from 'lucide-react';
import { ticketService, type Ticket, type TicketCategory, type TicketStatus, type TicketPriority, type CompanyAgent, type TicketComment, type TicketLead } from '../../../services/tickets';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

const SC: Record<TicketStatus, { label: string; color: string; bg: string; darkColor: string }> = {
    new: { label: 'Nuevo', color: 'text-blue-600', bg: 'bg-blue-50', darkColor: 'text-blue-300' },
    open: { label: 'Abierto', color: 'text-indigo-600', bg: 'bg-indigo-50', darkColor: 'text-indigo-300' },
    pending: { label: 'Pendiente', color: 'text-amber-600', bg: 'bg-amber-50', darkColor: 'text-amber-300' },
    resolved: { label: 'Resuelto', color: 'text-emerald-600', bg: 'bg-emerald-50', darkColor: 'text-emerald-300' },
    closed: { label: 'Cerrado', color: 'text-gray-500', bg: 'bg-gray-100', darkColor: 'text-gray-400' },
};
const PC: Record<TicketPriority, { label: string; color: string; bg: string; icon: string }> = {
    low: { label: 'Baja', color: 'text-gray-500', bg: 'bg-gray-100', icon: '↓' },
    medium: { label: 'Media', color: 'text-blue-500', bg: 'bg-blue-50', icon: '→' },
    high: { label: 'Alta', color: 'text-amber-500', bg: 'bg-amber-50', icon: '↑' },
    urgent: { label: 'Urgente', color: 'text-red-500', bg: 'bg-red-50', icon: '⚡' },
};
const STATUS_ORDER: TicketStatus[] = ['new', 'open', 'pending', 'resolved', 'closed'];

function AgentAvatar({ agent, size = 'sm' }: { agent: CompanyAgent; size?: 'sm' | 'md' }) {
    const s = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-sm';
    return (
        <div className={`${s} rounded-xl bg-indigo-100 flex items-center justify-center font-black text-indigo-600 shrink-0 overflow-hidden`}>
            {agent.avatar_url ? <img src={agent.avatar_url} className="w-full h-full object-cover" alt="" /> : agent.full_name?.charAt(0)?.toUpperCase() || '?'}
        </div>
    );
}

function StatusStepper({ status }: { status: TicketStatus }) {
    const idx = STATUS_ORDER.indexOf(status);
    return (
        <div className="flex items-center justify-between px-1">
            {STATUS_ORDER.map((s, i) => {
                const done = i < idx; const active = i === idx;
                return (
                    <div key={s} className="flex items-center flex-1">
                        <div className="flex flex-col items-center gap-1 flex-1">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black transition-all duration-300 ${active ? 'bg-white text-indigo-700 shadow-lg shadow-white/20 scale-110 ring-2 ring-white/30' :
                                    done ? 'bg-emerald-400/90 text-white' :
                                        'bg-white/10 text-white/30 border border-white/10'
                                }`}>
                                {done ? '✓' : i + 1}
                            </div>
                            <span className={`text-[7px] font-black uppercase tracking-wider whitespace-nowrap ${active ? 'text-white' : done ? 'text-emerald-300/80' : 'text-white/20'
                                }`}>{SC[s].label}</span>
                        </div>
                        {i < STATUS_ORDER.length - 1 && (
                            <div className={`h-[2px] flex-1 rounded-full mx-1 mb-4 transition-all ${i < idx ? 'bg-emerald-400/60' : 'bg-white/10'
                                }`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function SlaBar({ ticket, slaHours }: { ticket: Ticket; slaHours: number }) {
    const [now] = useState(Date.now());
    const resolved = ['resolved', 'closed'].includes(ticket.status);
    if (resolved) return <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /><span className="text-[10px] font-bold text-emerald-600">SLA Cumplido</span></div>;
    const elapsed = now - new Date(ticket.created_at).getTime();
    const slaMs = slaHours * 3600000;
    const pct = Math.min(100, (elapsed / slaMs) * 100);
    const barColor = pct < 50 ? '#10B981' : pct < 80 ? '#F59E0B' : '#EF4444';
    const rem = Math.abs(slaMs - elapsed);
    const hLeft = Math.floor(rem / 3600000);
    const badge = pct >= 100 ? { label: 'VENCIDO', css: 'text-red-600 bg-red-50' } : pct >= 80 ? { label: 'EN RIESGO', css: 'text-amber-600 bg-amber-50' } : { label: 'OK', css: 'text-emerald-600 bg-emerald-50' };
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500">{pct >= 100 ? `+${hLeft}h vencido` : `${hLeft}h restantes`}</span>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${badge.css}`}>{badge.label}</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: barColor }} />
            </div>
            <p className="text-[9px] text-gray-400">SLA objetivo: {slaHours}h desde creación</p>
        </div>
    );
}

function CommentThread({ ticketId, companyId, authorId, agents }: { ticketId: string; companyId: string; authorId: string; agents: CompanyAgent[] }) {
    const [comments, setComments] = useState<TicketComment[]>([]);
    const [body, setBody] = useState('');
    const [isInternal, setIsInternal] = useState(false);
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const bottomRef = useRef<HTMLDivElement>(null);
    useEffect(() => { ticketService.getComments(ticketId).then(setComments).catch(() => { }).finally(() => setLoading(false)); }, [ticketId]);
    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [comments]);
    async function send() {
        if (!body.trim()) return;
        setSending(true);
        try { const c = await ticketService.addComment(ticketId, companyId, authorId, body.trim(), isInternal); setComments(p => [...p, c]); setBody(''); }
        catch { toast.error('Error al agregar nota'); } finally { setSending(false); }
    }
    return (
        <div className="flex flex-col gap-3">
            {loading ? <div className="text-center py-6 text-[10px] text-gray-300 font-bold">Cargando...</div>
                : comments.length === 0 ? (
                    <div className="text-center py-8"><MessageSquare className="w-8 h-8 text-gray-100 mx-auto mb-2" /><p className="text-[10px] font-bold text-gray-300 uppercase">Sin seguimientos</p></div>
                ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {comments.map(c => {
                            const agent = agents.find(a => a.id === c.author_id);
                            return (
                                <div key={c.id} className={`rounded-xl p-3 text-xs ${c.is_internal ? 'bg-amber-50 border border-amber-100' : 'bg-gray-50'}`}>
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <div className="w-5 h-5 rounded-md bg-indigo-100 flex items-center justify-center text-[9px] font-black text-indigo-600">{agent?.full_name?.charAt(0) || '?'}</div>
                                        <span className="font-black text-gray-700 text-[10px]">{agent?.full_name || 'Agente'}</span>
                                        {c.is_internal && <span className="flex items-center gap-0.5 text-[8px] font-black text-amber-600"><Lock className="w-2.5 h-2.5" />Interna</span>}
                                        <span className="ml-auto text-[9px] text-gray-400">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: es })}</span>
                                    </div>
                                    <p className="text-gray-600 leading-relaxed">{c.body}</p>
                                </div>
                            );
                        })}
                        <div ref={bottomRef} />
                    </div>
                )}
            <div className="border border-gray-100 rounded-xl overflow-hidden">
                <textarea rows={2} value={body} onChange={e => setBody(e.target.value)} placeholder="Escribe un seguimiento..." className="w-full px-3 py-2 text-xs resize-none border-none focus:ring-0" />
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-100">
                    <button onClick={() => setIsInternal(p => !p)} className={`flex items-center gap-1 text-[9px] font-black uppercase px-2 py-1 rounded-lg ${isInternal ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400'}`}><Lock className="w-3 h-3" />{isInternal ? 'Interna' : 'Pública'}</button>
                    <button onClick={send} disabled={!body.trim() || sending} className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold disabled:opacity-40"><Send className="w-3 h-3" />Enviar</button>
                </div>
            </div>
        </div>
    );
}

type PanelTab = 'info' | 'edit' | 'comments' | 'sla';

interface PanelProps {
    ticket: Ticket; categories: TicketCategory[]; agents: CompanyAgent[]; leads: TicketLead[];
    companyId: string; authorId: string;
    onClose: () => void; onUpdate: (t: Ticket) => void; onDelete: (id: string) => void;
}

export function TicketPanel({ ticket, categories, agents, leads, companyId, authorId, onClose, onUpdate, onDelete }: PanelProps) {
    const [tab, setTab] = useState<PanelTab>('info');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [leadSearch, setLeadSearch] = useState('');
    const [editingDate, setEditingDate] = useState(false);
    const [form, setForm] = useState({
        status: ticket.status as TicketStatus, priority: ticket.priority as TicketPriority,
        assigned_to: ticket.assigned_to || '', category_id: ticket.category_id || '',
        title: ticket.title, description: ticket.description || '',
        due_date: ticket.due_date ? ticket.due_date.slice(0, 16) : '',
        lead_id: ticket.lead_id || '',
    });

    useEffect(() => {
        setForm({
            status: ticket.status as TicketStatus, priority: ticket.priority as TicketPriority,
            assigned_to: ticket.assigned_to || '', category_id: ticket.category_id || '',
            title: ticket.title, description: ticket.description || '',
            due_date: ticket.due_date ? ticket.due_date.slice(0, 16) : '',
            lead_id: ticket.lead_id || '',
        });
        setLeadSearch('');
        setEditingDate(false);
    }, [ticket]);

    async function handleSave() {
        setSaving(true);
        try {
            const updated = await ticketService.updateTicket(ticket.id, {
                status: form.status, priority: form.priority, assigned_to: form.assigned_to || null,
                category_id: form.category_id || null, title: form.title, description: form.description,
                due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
                lead_id: form.lead_id || null,
            });
            onUpdate(updated); setTab('info'); toast.success('Ticket actualizado ✓');
        } catch { toast.error('Error al actualizar'); } finally { setSaving(false); }
    }

    async function handleDelete() {
        if (!confirmDelete) { setConfirmDelete(true); return; }
        setDeleting(true);
        try {
            await ticketService.deleteTicket(ticket.id);
            toast.success('Ticket eliminado');
            onDelete(ticket.id);
        } catch { toast.error('Error al eliminar'); setDeleting(false); setConfirmDelete(false); }
    }

    const cat = categories.find(c => c.id === (tab === 'edit' ? form.category_id : ticket.category_id));
    const slaHours = cat?.sla_hours ?? 24;
    const assignedAgent = agents.find(a => a.id === (tab === 'edit' ? form.assigned_to : ticket.assigned_to));
    const tabs = [
        { key: 'info' as PanelTab, label: 'Info', icon: <Activity className="w-3 h-3" /> },
        { key: 'edit' as PanelTab, label: 'Editar', icon: <Edit2 className="w-3 h-3" /> },
        { key: 'comments' as PanelTab, label: 'Notas', icon: <MessageSquare className="w-3 h-3" /> },
        { key: 'sla' as PanelTab, label: 'SLA', icon: <ShieldCheck className="w-3 h-3" /> },
    ];

    return (
        <div className="flex flex-col h-full bg-white rounded-l-2xl overflow-hidden">
            {/* ── Premium Dark Header ── */}
            <div className="relative bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#3730a3] px-5 pt-5 pb-0">
                {/* Decorative glow */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />

                {/* Top row: badges + actions */}
                <div className="flex items-start justify-between mb-3 relative">
                    <div className="flex-1 min-w-0 pr-3">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className="text-[9px] font-mono font-bold text-indigo-300/80 bg-white/10 backdrop-blur-sm px-2 py-0.5 rounded-md tracking-wider">
                                #{ticket.id.slice(0, 8).toUpperCase()}
                            </span>
                            {ticket.lead?.name && (
                                <span className="text-[9px] font-bold text-white/60 bg-white/10 backdrop-blur-sm px-2 py-0.5 rounded-md truncate max-w-[140px]">
                                    {ticket.lead.name}
                                </span>
                            )}
                        </div>
                        <h3 className="text-[15px] font-black text-white leading-tight line-clamp-2">{ticket.title}</h3>
                        {ticket.due_date && (
                            <div className={`mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold ${new Date(ticket.due_date) < new Date()
                                    ? 'bg-red-500/20 text-red-300 border border-red-500/20'
                                    : 'bg-white/10 text-white/60'
                                }`}>
                                <CalendarDays className="w-3 h-3" />
                                Vence: {format(new Date(ticket.due_date), "dd MMM yyyy · HH:mm", { locale: es })}
                            </div>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5">
                        {confirmDelete ? (
                            <div className="flex items-center gap-1.5 bg-red-500/20 backdrop-blur-sm border border-red-400/30 rounded-xl px-2.5 py-1.5 animate-in fade-in duration-200">
                                <AlertTriangle className="w-3 h-3 text-red-300" />
                                <span className="text-[9px] font-black text-red-200 uppercase">¿Eliminar?</span>
                                <button onClick={handleDelete} disabled={deleting} className="text-[9px] font-black text-red-300 hover:text-white ml-0.5 transition-colors">{deleting ? '...' : 'Sí'}</button>
                                <button onClick={() => setConfirmDelete(false)} className="text-[9px] font-black text-white/40 hover:text-white transition-colors">No</button>
                            </div>
                        ) : (
                            <button onClick={handleDelete} title="Eliminar ticket" className="w-7 h-7 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/10 flex items-center justify-center text-white/30 hover:text-red-300 transition-all">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                        <button onClick={onClose} className="w-7 h-7 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Status stepper on dark bg */}
                <div className="py-3 border-t border-white/10">
                    <StatusStepper status={ticket.status} />
                </div>

                {/* Tabs */}
                <div className="flex gap-1 -mb-px">
                    {tabs.map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-t-xl transition-all ${tab === t.key
                                ? 'bg-white text-indigo-700 shadow-sm'
                                : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                            }`}>
                            {t.icon}{t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {tab === 'info' && (
                    <>
                        <div className="grid grid-cols-2 gap-2.5">
                            <div className={`rounded-xl p-3.5 ${SC[ticket.status].bg} border border-black/5`}>
                                <p className="text-[9px] font-black text-gray-400 uppercase mb-0.5">Estado</p>
                                <p className={`text-sm font-black ${SC[ticket.status].color}`}>{SC[ticket.status].label}</p>
                            </div>
                            <div className={`rounded-xl p-3.5 ${PC[ticket.priority].bg} border border-black/5`}>
                                <p className="text-[9px] font-black text-gray-400 uppercase mb-0.5">Prioridad</p>
                                <p className={`text-sm font-black ${PC[ticket.priority].color}`}>{PC[ticket.priority].icon} {PC[ticket.priority].label}</p>
                            </div>
                        </div>
                        {ticket.due_date && (
                            <div className={`rounded-xl p-3.5 border ${new Date(ticket.due_date) < new Date() ? 'bg-red-50/50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                                <p className="text-[9px] font-black text-gray-400 uppercase mb-1 flex items-center gap-1"><CalendarDays className="w-3 h-3" />Fecha de Vencimiento</p>
                                <p className={`text-sm font-black ${new Date(ticket.due_date) < new Date() ? 'text-red-600' : 'text-gray-800'}`}>
                                    {format(new Date(ticket.due_date), "dd 'de' MMMM yyyy · HH:mm", { locale: es })}
                                </p>
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <p className="text-[9px] font-black text-gray-400 uppercase flex items-center gap-1"><UserCheck className="w-3 h-3" />Agente Asignado</p>
                            {assignedAgent ? (
                                <div className="flex items-center gap-2.5 bg-gray-50 rounded-xl p-3 border border-gray-100"><AgentAvatar agent={assignedAgent} size="md" /><div><p className="text-xs font-bold text-gray-800">{assignedAgent.full_name}</p><p className="text-[10px] text-gray-400">{assignedAgent.email}</p></div></div>
                            ) : <p className="text-xs text-gray-300 italic">Sin asignar</p>}
                        </div>
                        {cat && <div className="flex items-center gap-2.5 bg-gray-50 rounded-xl p-3.5 border border-gray-100"><div className="w-3.5 h-3.5 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: cat.color }} /><span className="text-xs font-bold text-gray-700">{cat.name}</span><span className="text-[10px] text-gray-400 ml-auto bg-gray-100 px-2 py-0.5 rounded-full font-bold">SLA {cat.sla_hours}h</span></div>}
                        {ticket.lead && (
                            <div className="flex items-center gap-2.5 bg-indigo-50/70 rounded-xl p-3 border border-indigo-100">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-sm font-black text-white shadow-sm">{ticket.lead.name.charAt(0)}</div>
                                <div><p className="text-xs font-bold text-gray-800">{ticket.lead.name}</p><p className="text-[10px] text-gray-400">{ticket.lead.email}</p></div>
                            </div>
                        )}
                        {ticket.description && <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100"><p className="text-[9px] font-black text-gray-400 uppercase mb-1.5">Descripción</p><p className="text-xs text-gray-600 leading-relaxed">{ticket.description}</p></div>}
                        <div className="text-[10px] text-gray-400 pt-3 border-t border-gray-100 space-y-1">
                            <p className="flex items-center gap-1.5"><Clock className="w-3 h-3" />Creado: <span className="font-bold text-gray-600">{format(new Date(ticket.created_at), "dd MMM yyyy · HH:mm", { locale: es })}</span></p>
                            {ticket.resolved_at && <p className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-400" />Resuelto: <span className="font-bold text-emerald-600">{format(new Date(ticket.resolved_at), "dd MMM yyyy · HH:mm", { locale: es })}</span></p>}
                        </div>
                    </>
                )}

                {tab === 'edit' && (
                    <div className="space-y-3.5">
                        <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase">Título</label>
                            <input className="mt-1 w-full px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100 text-sm font-bold focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-200 transition-all" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[9px] font-black text-gray-400 uppercase">Estado</label>
                                <select className="mt-1 w-full px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100 text-xs font-bold focus:ring-2 focus:ring-indigo-400/30" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as TicketStatus }))}>
                                    {(Object.keys(SC) as TicketStatus[]).map(s => <option key={s} value={s}>{SC[s].label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-gray-400 uppercase">Prioridad</label>
                                <select className="mt-1 w-full px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100 text-xs font-bold focus:ring-2 focus:ring-indigo-400/30" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as TicketPriority }))}>
                                    {(Object.keys(PC) as TicketPriority[]).map(p => <option key={p} value={p}>{PC[p].label}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase flex items-center gap-1"><UserCheck className="w-3 h-3" />Agente</label>
                            <select className="mt-1 w-full px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100 text-xs font-bold focus:ring-2 focus:ring-indigo-400/30" value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}>
                                <option value="">— Sin asignar —</option>{agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                            </select>
                            {agents.length === 0 && <p className="text-[9px] text-amber-500 mt-1">Sin agentes disponibles en esta empresa</p>}
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase">Categoría</label>
                            <select className="mt-1 w-full px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100 text-xs font-bold focus:ring-2 focus:ring-indigo-400/30" value={form.category_id} onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}>
                                <option value="">Sin categoría</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>

                        {/* ── Premium Date Picker ── */}
                        <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase flex items-center gap-1"><CalendarDays className="w-3 h-3" />Fecha de Vencimiento</label>
                            {form.due_date && !editingDate ? (
                                <button
                                    onClick={() => setEditingDate(true)}
                                    className="mt-1 w-full flex items-center gap-2.5 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-xl px-3.5 py-2.5 group hover:border-indigo-200 transition-all text-left"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-sm shrink-0">
                                        <CalendarDays className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-black text-indigo-800">
                                            {format(new Date(form.due_date), "dd 'de' MMMM yyyy", { locale: es })}
                                        </p>
                                        <p className="text-[10px] font-bold text-indigo-400 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />{format(new Date(form.due_date), "HH:mm", { locale: es })} hrs
                                        </p>
                                    </div>
                                    <div
                                        onClick={(e) => { e.stopPropagation(); setForm(p => ({ ...p, due_date: '' })); setEditingDate(false); }}
                                        className="w-6 h-6 rounded-full bg-indigo-100 hover:bg-red-100 text-indigo-400 hover:text-red-500 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                                        title="Quitar fecha"
                                    >
                                        <X className="w-3 h-3" />
                                    </div>
                                </button>
                            ) : (
                                <div className="mt-1 relative">
                                    <input
                                        type="datetime-local"
                                        className="w-full px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100 text-xs font-bold focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-200 transition-all"
                                        value={form.due_date}
                                        onChange={e => { setForm(p => ({ ...p, due_date: e.target.value })); if (e.target.value) setEditingDate(false); }}
                                        autoFocus={editingDate}
                                    />
                                    {!form.due_date && (
                                        <p className="text-[9px] text-gray-300 mt-1 ml-1">Selecciona fecha y hora</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ── Lead selector ── */}
                        <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase flex items-center gap-1"><UserCheck className="w-3 h-3" />Cliente / Lead</label>
                            <div className="mt-1 bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                                {form.lead_id ? (
                                    <div className="flex items-center gap-2.5 px-3 py-2.5">
                                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-[10px] font-black text-white shrink-0 shadow-sm">
                                            {leads.find(l => l.id === form.lead_id)?.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-xs font-bold text-gray-800 flex-1 truncate">{leads.find(l => l.id === form.lead_id)?.name}</span>
                                        <button type="button" onClick={() => { setForm(p => ({ ...p, lead_id: '' })); setLeadSearch(''); }} className="w-5 h-5 rounded-full bg-gray-100 hover:bg-red-100 text-gray-300 hover:text-red-500 flex items-center justify-center transition-colors"><X className="w-3 h-3" /></button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="relative">
                                            <Search className="w-3 h-3 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
                                            <input type="text" placeholder="Buscar lead..." value={leadSearch} onChange={e => setLeadSearch(e.target.value)}
                                                className="w-full pl-8 pr-3 py-2.5 bg-transparent border-none text-xs font-medium focus:ring-0" />
                                        </div>
                                        <div className="max-h-32 overflow-y-auto border-t border-gray-100">
                                            {leads.filter(l => l.name.toLowerCase().includes(leadSearch.toLowerCase()) || l.email?.toLowerCase().includes(leadSearch.toLowerCase())).slice(0, 6).map(l => (
                                                <button key={l.id} type="button" onClick={() => { setForm(p => ({ ...p, lead_id: l.id })); setLeadSearch(''); }}
                                                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-indigo-50 text-left transition-colors">
                                                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-[9px] font-black text-white shrink-0">{l.name.charAt(0).toUpperCase()}</div>
                                                    <div><p className="text-[10px] font-bold text-gray-700">{l.name}</p><p className="text-[9px] text-gray-400">{l.email || l.phone || '—'}</p></div>
                                                </button>
                                            ))}
                                            {leads.filter(l => l.name.toLowerCase().includes(leadSearch.toLowerCase())).length === 0 && (
                                                <p className="text-[9px] text-gray-300 text-center py-3 font-bold">Sin resultados</p>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase">Descripción</label>
                            <textarea rows={3} className="mt-1 w-full px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100 text-xs font-medium focus:ring-2 focus:ring-indigo-400/30 resize-none" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                        </div>
                    </div>
                )}

                {tab === 'comments' && <CommentThread ticketId={ticket.id} companyId={companyId} authorId={authorId} agents={agents} />}

                {tab === 'sla' && (
                    <div className="space-y-4">
                        <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl p-4 space-y-3">
                            <p className="text-[9px] font-black text-indigo-600 uppercase flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" />SLA Monitor</p>
                            <SlaBar ticket={ticket} slaHours={slaHours} />
                            <p className="text-[10px] text-gray-500">Categoría: <span className="font-bold text-gray-700">{cat?.name || 'Sin categoría'}</span></p>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                            <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                                <p className="text-[9px] font-black text-gray-400 uppercase mb-1 flex items-center gap-1"><CalendarDays className="w-3 h-3" />Creado</p>
                                <p className="text-[11px] font-black text-gray-700">{format(new Date(ticket.created_at), "dd MMM · HH:mm", { locale: es })}</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                                <p className="text-[9px] font-black text-gray-400 uppercase mb-1 flex items-center gap-1"><Activity className="w-3 h-3" />Último cambio</p>
                                <p className="text-[11px] font-black text-gray-700">{format(new Date(ticket.last_status_change_at), "dd MMM · HH:mm", { locale: es })}</p>
                            </div>
                        </div>
                        {ticket.due_date && (
                            <div className={`rounded-xl p-3.5 border ${new Date(ticket.due_date) < new Date() ? 'bg-red-50/50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                                <p className="text-[9px] font-black text-gray-400 uppercase mb-1 flex items-center gap-1"><CalendarDays className="w-3 h-3" />Fecha Vencimiento</p>
                                <p className={`text-sm font-black ${new Date(ticket.due_date) < new Date() ? 'text-red-600' : 'text-gray-700'}`}>
                                    {format(new Date(ticket.due_date), "dd 'de' MMMM yyyy · HH:mm", { locale: es })}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Save Button ── */}
            {tab === 'edit' && (
                <div className="px-5 py-4 border-t border-gray-100 bg-gradient-to-t from-gray-50/80 to-white">
                    <button onClick={handleSave} disabled={saving} className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-200/50 disabled:opacity-60 transition-all">
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            )}
        </div>
    );
}
