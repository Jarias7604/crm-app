import { useState, useEffect, useRef } from 'react';
import { X, Edit2, Save, RefreshCw, ChevronRight, ChevronDown, UserCheck, MessageSquare, Lock, CalendarDays, Activity, ShieldCheck, CheckCircle2, Send, Search, Trash2, AlertTriangle, Clock, Paperclip, Image, FileVideo, ExternalLink, Microscope, Lightbulb, SearchCode, FileUp, FileBadge2, UploadCloud, Check, Plus } from 'lucide-react';
import { storageService } from '../../../services/storage';
import { ticketService, type Ticket, type TicketCategory, type TicketStatus, type TicketPriority, type CompanyAgent, type TicketComment, type TicketLead, type ResolutionAttachment } from '../../../services/tickets';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { CustomDatePicker } from '../../../components/ui/CustomDatePicker';
import { CustomSelect } from '../../../components/ui/CustomSelect';

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

type PanelTab = 'info' | 'edit' | 'comments' | 'sla' | 'resolution' | 'qa';

interface PanelProps {
    ticket: Ticket; allTickets: Ticket[]; categories: TicketCategory[]; agents: CompanyAgent[]; leads: TicketLead[];
    companyId: string; authorId: string;
    onClose: () => void; onUpdate: (t: Ticket) => void; onDelete: (id: string) => void;
    onSelectTicket: (t: Ticket) => void; onCreateSubticket: (parentId: string) => void;
}

export function TicketPanel({ ticket, allTickets, categories, agents, leads, companyId, authorId, onClose, onUpdate, onDelete, onSelectTicket, onCreateSubticket }: PanelProps) {
    const subTickets = allTickets.filter(t => t.parent_ticket_id === ticket.id);
    const parentTicket = ticket.parent_ticket_id ? allTickets.find(t => t.id === ticket.parent_ticket_id) : null;
    const [tab, setTab] = useState<PanelTab>('info');
    const [editingEst, setEditingEst] = useState(false);
    const [editingAct, setEditingAct] = useState(false);
    const [tempEst, setTempEst] = useState('');
    const [tempAct, setTempAct] = useState('');
    const [uploadingAtt, setUploadingAtt] = useState(false);
    const attFileRef = useRef<HTMLInputElement>(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [leadSearch, setLeadSearch] = useState('');
    const [editingDate, setEditingDate] = useState(false);
    const [parentSearch, setParentSearch] = useState('');
    const [isParentDropdownOpen, setIsParentDropdownOpen] = useState(false);
    const parentDropdownRef = useRef<HTMLDivElement>(null);
    const [dropdownCoords, setDropdownCoords] = useState({ top: 0, left: 0, width: 0 });

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (parentDropdownRef.current && !parentDropdownRef.current.contains(e.target as Node)) {
                setIsParentDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        function handleScroll(e: Event) {
            if (parentDropdownRef.current && parentDropdownRef.current.contains(e.target as Node)) {
                return;
            }
            setIsParentDropdownOpen(false);
        }
        if (isParentDropdownOpen) {
            window.addEventListener('scroll', handleScroll, true);
        }
        return () => window.removeEventListener('scroll', handleScroll, true);
    }, [isParentDropdownOpen]);

    const [form, setForm] = useState({
        status: ticket.status as TicketStatus, priority: ticket.priority as TicketPriority,
        assigned_to: ticket.assigned_to || '', category_id: ticket.category_id || '',
        title: ticket.title, description: ticket.description || '',
        due_date: ticket.due_date ? ticket.due_date.slice(0, 16) : '',
        lead_id: ticket.lead_id || '',
        created_by: ticket.created_by || '',
        resolved_at: ticket.resolved_at ? ticket.resolved_at.slice(0, 16) : '',
        parent_ticket_id: ticket.parent_ticket_id || '',
    });

    // Resolution Report state
    const [resForm, setResForm] = useState({
        findings: ticket.findings || '',
        root_cause: ticket.root_cause || '',
        solution: ticket.solution || '',
    });
    const [resFiles, setResFiles] = useState<File[]>([]);
    const [resUploading, setResUploading] = useState(false);
    const [resSaving, setResSaving] = useState(false);
    const resFileRef = useRef<HTMLInputElement>(null);
    const existingResAttachments: ResolutionAttachment[] = (ticket.metadata?.resolution_attachments as ResolutionAttachment[]) || [];

    useEffect(() => {
        setForm({
            status: ticket.status as TicketStatus, priority: ticket.priority as TicketPriority,
            assigned_to: ticket.assigned_to || '', category_id: ticket.category_id || '',
            title: ticket.title, description: ticket.description || '',
            due_date: ticket.due_date ? ticket.due_date.slice(0, 16) : '',
            lead_id: ticket.lead_id || '',
            created_by: ticket.created_by || '',
            resolved_at: ticket.resolved_at ? ticket.resolved_at.slice(0, 16) : '',
            parent_ticket_id: ticket.parent_ticket_id || '',
        });
        setResForm({
            findings: ticket.findings || '',
            root_cause: ticket.root_cause || '',
            solution: ticket.solution || '',
        });
        setResFiles([]);
        setLeadSearch('');
        setEditingDate(false);
        setTempEst((ticket.estimated_hours ?? 0).toString());
        setTempAct((ticket.actual_hours ?? 0).toString());
    }, [ticket]);

    async function handleSaveResolution() {
        setResSaving(true);
        try {
            let newAttachments: ResolutionAttachment[] = [...existingResAttachments];
            if (resFiles.length > 0) {
                setResUploading(true);
                const uploaded = await Promise.all(
                    resFiles.map(f => storageService.uploadTicketAttachment(companyId, f))
                );
                newAttachments = [...newAttachments, ...uploaded];
                setResUploading(false);
            }
            const updated = await ticketService.updateTicket(ticket.id, {
                findings: resForm.findings || null,
                root_cause: resForm.root_cause || null,
                solution: resForm.solution || null,
                metadata: { ...ticket.metadata, resolution_attachments: newAttachments },
            });
            onUpdate(updated);
            setResFiles([]);
            toast.success('Reporte de resolución guardado ✓');
        } catch { toast.error('Error al guardar el reporte'); }
        finally { setResSaving(false); setResUploading(false); }
    }

    async function handleSave() {
        setSaving(true);
        try {
            const updated = await ticketService.updateTicket(ticket.id, {
                status: form.status, priority: form.priority, assigned_to: form.assigned_to || null,
                category_id: form.category_id || null, title: form.title, description: form.description,
                due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
                lead_id: form.lead_id || null,
                created_by: form.created_by || null,
                resolved_at: form.resolved_at ? new Date(form.resolved_at).toISOString() : null,
                parent_ticket_id: form.parent_ticket_id || null,
            });
            onUpdate(updated); setTab('info'); toast.success('Ticket actualizado ✓');
        } catch (err: any) {
            console.error('Error al actualizar ticket:', err);
            toast.error(err?.message || 'Error al actualizar');
        } finally { setSaving(false); }
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

    // QA & Attachment helpers
    const attachments = (ticket.metadata?.attachments as any[]) || [];

    async function handleAddAttachment(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        if (attachments.length + files.length > 2) {
            toast.error('Solo se permite un máximo de 2 documentos por ticket.');
            return;
        }

        setUploadingAtt(true);
        try {
            const uploaded = await Promise.all(
                Array.from(files).map(f => storageService.uploadTicketAttachment(companyId, f))
            );
            const newAttachments = [...attachments, ...uploaded];
            const updated = await ticketService.updateTicket(ticket.id, {
                metadata: { ...ticket.metadata, attachments: newAttachments }
            });
            onUpdate(updated);
            toast.success('Documento adjuntado con éxito');
        } catch (err) {
            console.error(err);
            toast.error('Error al subir el archivo');
        } finally {
            setUploadingAtt(false);
            if (attFileRef.current) attFileRef.current.value = '';
        }
    }

    async function handleDeleteAttachment(idxToDelete: number) {
        try {
            const newAttachments = attachments.filter((_, idx) => idx !== idxToDelete);
            const updated = await ticketService.updateTicket(ticket.id, {
                metadata: { ...ticket.metadata, attachments: newAttachments }
            });
            onUpdate(updated);
            toast.success('Documento eliminado');
        } catch (err) {
            console.error(err);
            toast.error('Error al eliminar el documento');
        }
    }

    async function handleUpdateEstimatedHours(val: number) {
        try {
            const updated = await ticketService.updateTicket(ticket.id, {
                estimated_hours: val,
            });
            onUpdate(updated);
            toast.success('Horas estimadas actualizadas ✓');
        } catch {
            toast.error('Error al actualizar estimación');
        }
    }

    async function handleUpdateActualHours(val: number) {
        try {
            const updated = await ticketService.updateTicket(ticket.id, {
                actual_hours: val,
            });
            onUpdate(updated);
            toast.success('Horas ejecutadas actualizadas ✓');
        } catch {
            toast.error('Error al actualizar horas ejecutadas');
        }
    }

    async function handleChecklistItemChange(index: number, field: 'status' | 'text', val: any) {
        const checklist = [...(ticket.checklist || [])];
        if (!checklist[index]) return;

        checklist[index] = {
            ...checklist[index],
            [field]: val,
        };

        try {
            const updated = await ticketService.updateTicket(ticket.id, {
                checklist,
            });
            onUpdate(updated);
        } catch {
            toast.error('Error al actualizar caso de prueba');
        }
    }

    async function handleAddChecklistItem() {
        const checklist = [
            ...(ticket.checklist || []),
            { id: `chk-${Date.now()}`, text: '', status: 'pending' as const },
        ];
        try {
            const updated = await ticketService.updateTicket(ticket.id, {
                checklist,
            });
            onUpdate(updated);
        } catch {
            toast.error('Error al agregar caso de prueba');
        }
    }

    async function handleDeleteChecklistItem(itemId: string) {
        const checklist = (ticket.checklist || []).filter(c => c.id !== itemId);
        try {
            const updated = await ticketService.updateTicket(ticket.id, {
                checklist,
            });
            onUpdate(updated);
            toast.success('Caso de prueba eliminado');
        } catch {
            toast.error('Error al eliminar caso de prueba');
        }
    }

    const cat = categories.find(c => c.id === (tab === 'edit' ? form.category_id : ticket.category_id));
    const slaHours = cat?.sla_hours ?? 24;
    const assignedAgent = agents.find(a => a.id === (tab === 'edit' ? form.assigned_to : ticket.assigned_to));
    const tabs = [
        { key: 'info' as PanelTab, label: 'Detalles', icon: <Activity className="w-3 h-3" /> },
        { key: 'edit' as PanelTab, label: 'Editar', icon: <Edit2 className="w-3 h-3" /> },
        { key: 'comments' as PanelTab, label: 'Notas', icon: <MessageSquare className="w-3 h-3" /> },
        { key: 'sla' as PanelTab, label: 'SLA', icon: <ShieldCheck className="w-3 h-3" /> },
        { key: 'resolution' as PanelTab, label: 'Resolución', icon: <FileBadge2 className="w-3 h-3" /> },
        { key: 'qa' as PanelTab, label: 'QA Checklist', icon: <CheckCircle2 className="w-3 h-3" /> },
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

                        {/* Ticket Padre (Si este ticket es hijo) */}
                        {parentTicket && (
                            <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 rounded-xl p-3.5 border border-indigo-100/60 shadow-sm">
                                <p className="text-[9px] font-black text-indigo-500 uppercase mb-1.5 flex items-center gap-1"><Microscope className="w-3 h-3 text-indigo-500" />Ticket Padre</p>
                                <div className="flex items-center justify-between">
                                    <div className="min-w-0">
                                        <p className="text-xs font-black text-gray-800 truncate">{parentTicket.title}</p>
                                        <p className="text-[9px] text-gray-400 mt-0.5">#{parentTicket.id.slice(0, 8).toUpperCase()}</p>
                                    </div>
                                    <button type="button" onClick={() => onSelectTicket(parentTicket)} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-100 px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-0.5 shrink-0 transition-all">Ver <ChevronRight className="w-3.5 h-3.5" /></button>
                                </div>
                            </div>
                        )}

                        {/* Listado de Subtickets (Si este ticket es padre) */}
                        {!ticket.parent_ticket_id && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-[9px] font-black text-gray-400 uppercase flex items-center gap-1"><Activity className="w-3 h-3" />Subtickets ({subTickets.length})</p>
                                    <button type="button" onClick={() => onCreateSubticket(ticket.id)} className="text-[10px] font-black text-indigo-500 hover:text-indigo-700 transition-colors bg-indigo-50/50 hover:bg-indigo-50 px-2 py-1 rounded-lg">+ Agregar Subticket</button>
                                </div>
                                {subTickets.length > 0 ? (
                                    <div className="space-y-2">
                                        {subTickets.map(sub => (
                                            <div key={sub.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-indigo-100 hover:shadow-sm transition-all">
                                                <div className="min-w-0 pr-2">
                                                    <p className="text-xs font-bold text-gray-800 truncate">{sub.title}</p>
                                                    <p className="text-[9px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                                                        <span className="font-bold uppercase" style={{ color: SC[sub.status]?.color || 'gray' }}>{SC[sub.status]?.label}</span>
                                                        {sub.due_date && <span>· Vence: {format(new Date(sub.due_date), "dd MMM · HH:mm", { locale: es })}</span>}
                                                    </p>
                                                </div>
                                                <button type="button" onClick={() => onSelectTicket(sub)} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-white border border-gray-100 px-2.5 py-1 rounded-lg shadow-sm shrink-0 transition-all">Ver</button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-gray-300 italic pl-1">No hay subtickets creados.</p>
                                )}
                            </div>
                        )}

                        {ticket.description && <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100"><p className="text-[9px] font-black text-gray-400 uppercase mb-1.5">Descripción</p><p className="text-xs text-gray-600 leading-relaxed">{ticket.description}</p></div>}
                        {/* ── Attachments Section (Max 2) ── */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="text-[9px] font-black text-gray-400 uppercase flex items-center gap-1">
                                    <Paperclip className="w-3 h-3" /> Documentos Adjuntos ({attachments.length}/2)
                                </p>
                                {attachments.length < 2 && (
                                    <button
                                        type="button"
                                        disabled={uploadingAtt}
                                        onClick={() => attFileRef.current?.click()}
                                        className="text-[10px] font-black text-indigo-500 hover:text-indigo-700 transition-colors bg-indigo-50/50 hover:bg-indigo-50 px-2 py-1 rounded-lg flex items-center gap-1"
                                    >
                                        {uploadingAtt ? (
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <UploadCloud className="w-3.5 h-3.5" />
                                        )}
                                        Adjuntar
                                    </button>
                                )}
                            </div>

                            <input
                                type="file"
                                ref={attFileRef}
                                onChange={handleAddAttachment}
                                className="hidden"
                                accept="image/*,video/*,application/pdf,text/*,.doc,.docx,.xls,.xlsx"
                            />

                            {attachments.length > 0 ? (
                                <div className="grid grid-cols-2 gap-2">
                                    {attachments.map((att: any, idx: number) => {
                                        const isImage = att.type?.startsWith('image/');
                                        const isVideo = att.type?.startsWith('video/');
                                        const sizeKB = Math.round((att.size || 0) / 1024);
                                        const sizeLabel = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;
                                        return (
                                            <div key={idx} className="group relative bg-gray-50 border border-gray-100 rounded-xl overflow-hidden hover:border-indigo-200 hover:shadow-md transition-all flex flex-col justify-between">
                                                <a href={att.url} target="_blank" rel="noopener noreferrer" className="block flex-1">
                                                    {isImage ? (
                                                        <img src={att.url} alt={att.name} className="w-full h-20 object-cover" />
                                                    ) : isVideo ? (
                                                        <div className="w-full h-20 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                                                            <FileVideo className="w-6 h-6 text-gray-300" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-full h-20 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                                                            <Image className="w-6 h-6 text-gray-300" />
                                                        </div>
                                                    )}
                                                    <div className="px-2.5 py-1.5">
                                                        <p className="text-[9px] font-bold text-gray-600 truncate">{att.name}</p>
                                                        <p className="text-[8px] text-gray-300">{sizeLabel}</p>
                                                    </div>
                                                </a>
                                                {/* Delete button absolute in corner */}
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        e.preventDefault();
                                                        handleDeleteAttachment(idx);
                                                    }}
                                                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-lg bg-white/85 hover:bg-red-50 hover:text-red-600 text-gray-400 border border-gray-100 flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                                                    title="Eliminar adjunto"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-6 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                                    <Paperclip className="w-6 h-6 text-gray-300 mx-auto mb-1" />
                                    <p className="text-[10px] text-gray-400 font-medium">No hay documentos adjuntos</p>
                                    <p className="text-[9px] text-gray-300 mt-0.5">Máximo 2 archivos</p>
                                </div>
                            )}

                            {attachments.length >= 2 && (
                                <p className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                                    <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                                    Límite de 2 documentos alcanzado.
                                </p>
                            )}
                        </div>
                        <div className="pt-3 border-t border-gray-100 space-y-2">
                            <p className="text-[10px] text-gray-400 flex items-center gap-1.5">
                                <Clock className="w-3 h-3" />Creado: <span className="font-bold text-gray-600">{format(new Date(ticket.created_at), "dd MMM yyyy · HH:mm", { locale: es })}</span>
                            </p>
                            {ticket.resolved_at && (
                                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                    <div>
                                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Fecha de Cierre</p>
                                        <p className="text-sm font-black text-emerald-700">{format(new Date(ticket.resolved_at), "dd 'de' MMMM yyyy · HH:mm", { locale: es })}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {tab === 'edit' && (
                    <div className="space-y-3.5">
                        <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase">Título</label>
                            <input className="mt-1 w-full px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100 text-sm font-bold focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-200 transition-all" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
                        </div>
                        {/* ── Solicitante ── */}
                        <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase flex items-center gap-1"><UserCheck className="w-3 h-3" />Solicitante</label>
                            <CustomSelect
                                value={form.created_by}
                                onChange={val => setForm(p => ({ ...p, created_by: val }))}
                                options={[
                                    { value: '', label: '— Sin asignar —' },
                                    ...agents.map(a => ({ value: a.id, label: a.full_name }))
                                ]}
                                buttonClassName="mt-1 w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-gray-700 outline-none hover:bg-gray-100/50 transition"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[9px] font-black text-gray-400 uppercase">Estado</label>
                                <CustomSelect
                                    value={form.status}
                                    onChange={val => setForm(p => ({ ...p, status: val as TicketStatus }))}
                                    options={(Object.keys(SC) as TicketStatus[]).map(s => ({ value: s, label: SC[s].label }))}
                                    buttonClassName="mt-1 w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-gray-700 outline-none hover:bg-gray-100/50 transition"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-gray-400 uppercase">Prioridad</label>
                                <CustomSelect
                                    value={form.priority}
                                    onChange={val => setForm(p => ({ ...p, priority: val as TicketPriority }))}
                                    options={(Object.keys(PC) as TicketPriority[]).map(p => ({ value: p, label: PC[p].label, icon: PC[p].icon }))}
                                    buttonClassName="mt-1 w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-gray-700 outline-none hover:bg-gray-100/50 transition"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase flex items-center gap-1"><UserCheck className="w-3 h-3" />Agente</label>
                            <CustomSelect
                                value={form.assigned_to}
                                onChange={val => setForm(p => ({ ...p, assigned_to: val }))}
                                options={[
                                    { value: '', label: '— Sin asignar —' },
                                    ...agents.map(a => ({ value: a.id, label: a.full_name }))
                                ]}
                                buttonClassName="mt-1 w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-gray-700 outline-none hover:bg-gray-100/50 transition"
                            />
                            {agents.length === 0 && <p className="text-[9px] text-amber-500 mt-1">Sin agentes disponibles en esta empresa</p>}
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase">Categoría</label>
                            <CustomSelect
                                value={form.category_id}
                                onChange={val => setForm(p => ({ ...p, category_id: val }))}
                                options={[
                                    { value: '', label: 'Sin categoría' },
                                    ...categories.map(c => ({ value: c.id, label: c.name }))
                                ]}
                                buttonClassName="mt-1 w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-gray-700 outline-none hover:bg-gray-100/50 transition"
                            />
                        </div>

                        {subTickets.length === 0 ? (
                            <div className="relative" ref={parentDropdownRef}>
                                <label className="text-[9px] font-black text-gray-400 uppercase">Ticket Padre</label>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setDropdownCoords({
                                            top: rect.bottom,
                                            left: rect.left,
                                            width: rect.width
                                        });
                                        setIsParentDropdownOpen(!isParentDropdownOpen);
                                    }}
                                    className="mt-1 w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-400/30 transition text-left"
                                >
                                    {form.parent_ticket_id ? (
                                        (() => {
                                            const parent = allTickets.find(t => t.id === form.parent_ticket_id);
                                            return parent ? (
                                                <span className="text-gray-900">
                                                    <span className="text-[9px] font-black text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded-md mr-1.5">
                                                        #{parent.id.slice(0, 8).toUpperCase()}
                                                    </span>
                                                    {parent.title}
                                                </span>
                                            ) : 'Ninguno (Es un ticket principal)';
                                        })()
                                    ) : (
                                        <span className="text-gray-400">Ninguno (Es un ticket principal)</span>
                                    )}
                                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isParentDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isParentDropdownOpen && (
                                    <div
                                        className="fixed bg-white border border-gray-100 rounded-xl shadow-2xl z-[999] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200"
                                        style={{
                                            top: `${dropdownCoords.top + 4}px`,
                                            left: `${dropdownCoords.left}px`,
                                            width: `${dropdownCoords.width}px`
                                        }}
                                    >
                                        {/* Search Input */}
                                        <div className="p-2 border-b border-gray-50 bg-gray-50/50 flex items-center gap-2">
                                            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-1" />
                                            <input
                                                type="text"
                                                placeholder="Buscar ticket..."
                                                value={parentSearch}
                                                onChange={e => setParentSearch(e.target.value)}
                                                className="w-full bg-transparent border-none text-[10px] font-bold focus:ring-0 focus:border-none p-0.5"
                                            />
                                            {parentSearch && (
                                                <button type="button" onClick={() => setParentSearch('')} className="text-gray-400 hover:text-gray-600">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>

                                        {/* List */}
                                        <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-50 custom-scrollbar">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setForm(p => ({ ...p, parent_ticket_id: '' }));
                                                    setIsParentDropdownOpen(false);
                                                    setParentSearch('');
                                                }}
                                                className="w-full text-left px-3 py-2 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50/50 transition-colors"
                                            >
                                                Ninguno (Es un ticket principal)
                                            </button>
                                            {allTickets
                                                .filter(t => t.id !== ticket.id && !t.parent_ticket_id)
                                                .filter(t => 
                                                    t.title.toLowerCase().includes(parentSearch.toLowerCase()) || 
                                                    t.id.toLowerCase().includes(parentSearch.toLowerCase())
                                                )
                                                .map(t => (
                                                    <button
                                                        key={t.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setForm(p => ({ ...p, parent_ticket_id: t.id }));
                                                            setIsParentDropdownOpen(false);
                                                            setParentSearch('');
                                                        }}
                                                        className={`w-full text-left px-3 py-2 text-[10px] font-bold transition-colors hover:bg-gray-50 flex items-center justify-between ${
                                                            form.parent_ticket_id === t.id ? 'bg-indigo-50/40 text-indigo-700' : 'text-gray-700'
                                                        }`}
                                                    >
                                                        <span className="truncate flex items-center gap-1.5">
                                                            <span className="text-[8px] font-black text-indigo-400 bg-indigo-50 px-1 py-0.5 rounded">
                                                                #{t.id.slice(0, 8).toUpperCase()}
                                                            </span>
                                                            {t.title}
                                                        </span>
                                                        {form.parent_ticket_id === t.id && (
                                                            <span className="w-1 h-1 rounded-full bg-indigo-600 shrink-0 ml-2" />
                                                        )}
                                                    </button>
                                                ))}
                                            {allTickets.filter(t => t.id !== ticket.id && !t.parent_ticket_id).filter(t => t.title.toLowerCase().includes(parentSearch.toLowerCase()) || t.id.toLowerCase().includes(parentSearch.toLowerCase())).length === 0 && (
                                                <div className="px-3 py-2 text-center text-[10px] font-bold text-gray-300">
                                                    No se encontraron tickets principales
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div>
                                <label className="text-[9px] font-black text-gray-400 uppercase">Ticket Padre</label>
                                <div className="mt-1 w-full px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100 text-xs font-bold text-gray-400 bg-gray-50/50">
                                    No se puede asignar un padre porque este ticket ya tiene subtickets.
                                </div>
                            </div>
                        )}

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
                                <div className="mt-1 space-y-2">
                                    {/* Spanish custom date picker — no browser calendar */}
                                    <CustomDatePicker
                                        value={form.due_date ? form.due_date.substring(0, 10) : ''}
                                        onChange={(dateStr) => {
                                            const time = form.due_date ? form.due_date.substring(11, 16) : '09:00';
                                            setForm(p => ({ ...p, due_date: dateStr ? `${dateStr}T${time}` : '' }));
                                            if (dateStr) setEditingDate(false);
                                        }}
                                        placeholder="Seleccionar fecha"
                                        variant="light"
                                        forceOpenUp
                                        alignRight
                                    />
                                    {/* Time picker — styled, no popup calendar */}
                                    {form.due_date && (
                                        <div className="flex items-center gap-2 bg-indigo-50 rounded-xl border border-indigo-100 px-3 py-2.5">
                                            <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-wider">Hora:</span>
                                            <input
                                                type="time"
                                                className="flex-1 bg-transparent border-none text-sm font-bold text-indigo-800 focus:outline-none focus:ring-0"
                                                value={form.due_date.substring(11, 16)}
                                                onChange={e => {
                                                    const dateOnly = form.due_date.substring(0, 10);
                                                    setForm(p => ({ ...p, due_date: `${dateOnly}T${e.target.value}` }));
                                                }}
                                            />
                                        </div>
                                    )}
                                    {!form.due_date && (
                                        <p className="text-[9px] text-gray-300 ml-1">Selecciona fecha y hora</p>
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

                        {/* ── Fecha de Cierre (editable) — only for resolved/closed ── */}
                        {(['resolved', 'closed'] as TicketStatus[]).includes(form.status) && (
                            <div>
                                <label className="text-[9px] font-black text-gray-400 uppercase flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />Fecha de Cierre
                                </label>
                                {form.resolved_at ? (
                                    <button
                                        type="button"
                                        onClick={() => setForm(p => ({ ...p, resolved_at: '' }))}
                                        className="mt-1 w-full flex items-center gap-2.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl px-3.5 py-2.5 group hover:border-red-200 hover:from-red-50 hover:to-red-50 transition-all text-left"
                                        title="Click para cambiar o quitar la fecha"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-sm shrink-0">
                                            <CheckCircle2 className="w-4 h-4 text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-black text-emerald-800">
                                                {format(new Date(form.resolved_at), "dd 'de' MMMM yyyy", { locale: es })}
                                            </p>
                                            <p className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />{format(new Date(form.resolved_at), 'HH:mm', { locale: es })} hrs
                                            </p>
                                        </div>
                                        <div
                                            onClick={(e) => { e.stopPropagation(); setForm(p => ({ ...p, resolved_at: '' })); }}
                                            className="w-6 h-6 rounded-full bg-emerald-100 hover:bg-red-100 text-emerald-400 hover:text-red-500 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                                            title="Quitar fecha de cierre"
                                        >
                                            <X className="w-3 h-3" />
                                        </div>
                                    </button>
                                ) : (
                                    <div className="mt-1 space-y-2">
                                        <CustomDatePicker
                                            value={form.resolved_at ? form.resolved_at.substring(0, 10) : ''}
                                            onChange={(dateStr) => {
                                                const time = form.resolved_at ? form.resolved_at.substring(11, 16) : '09:00';
                                                setForm(p => ({ ...p, resolved_at: dateStr ? `${dateStr}T${time}` : '' }));
                                            }}
                                            placeholder="Seleccionar fecha de cierre"
                                            variant="light"
                                            forceOpenUp
                                            alignRight
                                        />
                                        {form.resolved_at && (
                                            <div className="flex items-center gap-2 bg-emerald-50 rounded-xl border border-emerald-100 px-3 py-2.5">
                                                <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider">Hora:</span>
                                                <input
                                                    type="time"
                                                    className="flex-1 bg-transparent border-none text-sm font-bold text-emerald-800 focus:outline-none focus:ring-0"
                                                    value={form.resolved_at.substring(11, 16)}
                                                    onChange={e => {
                                                        const dateOnly = form.resolved_at.substring(0, 10);
                                                        setForm(p => ({ ...p, resolved_at: `${dateOnly}T${e.target.value}` }));
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase">Descripción</label>
                            <textarea rows={3} className="mt-1 w-full px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100 text-xs font-medium focus:ring-2 focus:ring-indigo-400/30 resize-none" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                        </div>
                    </div>
                )}

                {tab === 'comments' && <CommentThread ticketId={ticket.id} companyId={companyId} authorId={authorId} agents={agents} />}

                {tab === 'resolution' && (
                    <div className="space-y-5">
                        {/* ── Header Banner ── */}
                        <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 rounded-2xl p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-200">
                                    <FileBadge2 className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-gray-900">Reporte de Resolución</p>
                                    <p className="text-[10px] text-violet-500 font-bold">Documenta hallazgos para evitar recurrencia</p>
                                </div>
                            </div>
                        </div>

                        {/* ── Findings ── */}
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                                <div className="w-5 h-5 rounded-md bg-blue-100 flex items-center justify-center">
                                    <Microscope className="w-3 h-3 text-blue-600" />
                                </div>
                                Findings / Hallazgos
                            </label>
                            <textarea
                                rows={3}
                                placeholder="¿Qué encontró el técnico? Describe el estado del sistema, síntomas observados..."
                                className="w-full px-4 py-3 bg-blue-50/50 border border-blue-100 rounded-xl text-xs font-medium text-gray-700 focus:ring-2 focus:ring-blue-300/40 focus:border-blue-200 resize-none transition-all placeholder:text-gray-300"
                                value={resForm.findings}
                                onChange={e => setResForm(p => ({ ...p, findings: e.target.value }))}
                            />
                        </div>

                        {/* ── Root Cause ── */}
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                                <div className="w-5 h-5 rounded-md bg-amber-100 flex items-center justify-center">
                                    <SearchCode className="w-3 h-3 text-amber-600" />
                                </div>
                                Causa Raíz / Root Cause
                            </label>
                            <textarea
                                rows={3}
                                placeholder="¿Cuál fue la causa raíz del problema? Ej: configuración incorrecta, falla de hardware, bug de software..."
                                className="w-full px-4 py-3 bg-amber-50/50 border border-amber-100 rounded-xl text-xs font-medium text-gray-700 focus:ring-2 focus:ring-amber-300/40 focus:border-amber-200 resize-none transition-all placeholder:text-gray-300"
                                value={resForm.root_cause}
                                onChange={e => setResForm(p => ({ ...p, root_cause: e.target.value }))}
                            />
                        </div>

                        {/* ── Solution ── */}
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                                <div className="w-5 h-5 rounded-md bg-emerald-100 flex items-center justify-center">
                                    <Lightbulb className="w-3 h-3 text-emerald-600" />
                                </div>
                                Solución Aplicada
                            </label>
                            <textarea
                                rows={4}
                                placeholder="¿Qué se hizo para resolver el problema y evitar que vuelva a ocurrir? Incluye pasos específicos..."
                                className="w-full px-4 py-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-xs font-medium text-gray-700 focus:ring-2 focus:ring-emerald-300/40 focus:border-emerald-200 resize-none transition-all placeholder:text-gray-300"
                                value={resForm.solution}
                                onChange={e => setResForm(p => ({ ...p, solution: e.target.value }))}
                            />
                        </div>

                        {/* ── Adjuntos existentes ── */}
                        {existingResAttachments.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Paperclip className="w-3 h-3" />Adjuntos guardados ({existingResAttachments.length})
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    {existingResAttachments.map((att, idx) => {
                                        const isImage = att.type?.startsWith('image/');
                                        const sizeKB = Math.round((att.size || 0) / 1024);
                                        const sizeLabel = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;
                                        return (
                                            <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer"
                                                className="group relative bg-gray-50 border border-gray-100 rounded-xl overflow-hidden hover:border-indigo-200 hover:shadow-sm transition-all">
                                                {isImage
                                                    ? <img src={att.url} alt={att.name} className="w-full h-20 object-cover" />
                                                    : <div className="w-full h-20 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center"><FileUp className="w-7 h-7 text-gray-300" /></div>
                                                }
                                                <div className="px-2.5 py-2">
                                                    <p className="text-[9px] font-bold text-gray-600 truncate">{att.name}</p>
                                                    <p className="text-[8px] text-gray-300">{sizeLabel}</p>
                                                </div>
                                                <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/10 transition-colors flex items-center justify-center">
                                                    <ExternalLink className="w-5 h-5 text-white opacity-0 group-hover:opacity-80 drop-shadow-lg transition-opacity" />
                                                </div>
                                            </a>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ── Upload nuevos adjuntos ── */}
                        <div className="space-y-2">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                <UploadCloud className="w-3 h-3" />Adjuntar Documentos
                            </p>
                            <input
                                ref={resFileRef} type="file" multiple
                                accept="image/*,.pdf,.doc,.docx,.xlsx,.txt"
                                className="hidden"
                                onChange={e => { if (e.target.files) { setResFiles(p => [...p, ...Array.from(e.target.files!)]); e.target.value = ''; } }}
                            />
                            <div
                                onClick={() => resFileRef.current?.click()}
                                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-violet-400', 'bg-violet-50/50'); }}
                                onDragLeave={e => e.currentTarget.classList.remove('border-violet-400', 'bg-violet-50/50')}
                                onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('border-violet-400', 'bg-violet-50/50'); if (e.dataTransfer.files) setResFiles(p => [...p, ...Array.from(e.dataTransfer.files)]); }}
                                className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center cursor-pointer hover:border-violet-300 hover:bg-violet-50/20 transition-all group"
                            >
                                <UploadCloud className="w-7 h-7 text-gray-200 group-hover:text-violet-400 mx-auto mb-2 transition-colors" />
                                <p className="text-xs font-bold text-gray-400">Arrastra o <span className="text-violet-500">selecciona</span></p>
                                <p className="text-[9px] text-gray-300 mt-0.5">Fotos, PDF, Word, Excel</p>
                            </div>

                            {resFiles.length > 0 && (
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    {resFiles.map((file, idx) => {
                                        const isImage = file.type.startsWith('image/');
                                        const sizeKB = Math.round(file.size / 1024);
                                        const sizeLabel = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;
                                        return (
                                            <div key={idx} className="relative group/f bg-violet-50 border border-violet-100 rounded-xl overflow-hidden">
                                                {isImage
                                                    ? <img src={URL.createObjectURL(file)} alt="" className="w-full h-20 object-cover" />
                                                    : <div className="w-full h-20 flex items-center justify-center"><FileUp className="w-7 h-7 text-violet-300" /></div>
                                                }
                                                <div className="px-2 py-1.5">
                                                    <p className="text-[9px] font-bold text-violet-700 truncate">{file.name}</p>
                                                    <p className="text-[8px] text-violet-400">{sizeLabel}</p>
                                                </div>
                                                <button type="button"
                                                    onClick={() => setResFiles(p => p.filter((_, i) => i !== idx))}
                                                    className="absolute top-1 right-1 w-5 h-5 bg-red-500/80 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover/f:opacity-100 transition-opacity">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

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

                {tab === 'qa' && (() => {
                    const est = Number(ticket.estimated_hours ?? 0);
                    const act = Number(ticket.actual_hours ?? 0);
                    const pct = est > 0 ? Math.min((act / est) * 100, 150) : 0;
                    const over = act > est && est > 0;

                    const checklist = (Array.isArray(ticket.checklist) ? ticket.checklist : []).filter(c => c && typeof c === 'object' && c.id && c.status);
                    const passed = checklist.filter(c => c.status === 'passed').length;
                    const failed = checklist.filter(c => c.status === 'failed').length;
                    const pending = checklist.filter(c => c.status === 'pending').length;

                    return (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            {/* ── TIME COMPARISON WIDGET ── */}
                            <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                    <Clock size={12} className="text-indigo-400" /> Tiempo & Rendimiento
                                </p>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    {/* Estimated hours card */}
                                    <div className="bg-white rounded-xl border border-gray-100 p-3 text-center shadow-sm relative group">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Estimado</p>
                                        {editingEst ? (
                                            <div className="mt-1 flex items-center justify-center">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={tempEst}
                                                    onChange={e => setTempEst(e.target.value)}
                                                    onBlur={() => {
                                                        setEditingEst(false);
                                                        handleUpdateEstimatedHours(Number(tempEst) || 0);
                                                    }}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            setEditingEst(false);
                                                            handleUpdateEstimatedHours(Number(tempEst) || 0);
                                                        } else if (e.key === 'Escape') {
                                                            setEditingEst(false);
                                                            setTempEst((ticket.estimated_hours ?? 0).toString());
                                                        }
                                                    }}
                                                    className="w-16 px-1.5 py-0.5 text-center text-sm font-bold border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
                                                    autoFocus
                                                />
                                            </div>
                                        ) : (
                                            <div
                                                onClick={() => {
                                                    setTempEst((ticket.estimated_hours ?? 0).toString());
                                                    setEditingEst(true);
                                                }}
                                                className="cursor-pointer hover:bg-gray-50 rounded py-0.5 px-2 inline-flex items-center gap-1 mt-0.5"
                                                title="Haz clic para editar"
                                            >
                                                <span className="text-lg font-black text-gray-800">{est}h</span>
                                                <Edit2 className="w-2.5 h-2.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Executed hours card */}
                                    <div className={`rounded-xl border p-3 text-center shadow-sm relative group ${over ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Ejecutado</p>
                                        {editingAct ? (
                                            <div className="mt-1 flex items-center justify-center">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={tempAct}
                                                    onChange={e => setTempAct(e.target.value)}
                                                    onBlur={() => {
                                                        setEditingAct(false);
                                                        handleUpdateActualHours(Number(tempAct) || 0);
                                                    }}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            setEditingAct(false);
                                                            handleUpdateActualHours(Number(tempAct) || 0);
                                                        } else if (e.key === 'Escape') {
                                                            setEditingAct(false);
                                                            setTempAct((ticket.actual_hours ?? 0).toString());
                                                        }
                                                    }}
                                                    className="w-16 px-1.5 py-0.5 text-center text-sm font-bold border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
                                                    autoFocus
                                                />
                                            </div>
                                        ) : (
                                            <div
                                                onClick={() => {
                                                    setTempAct((ticket.actual_hours ?? 0).toString());
                                                    setEditingAct(true);
                                                }}
                                                className="cursor-pointer hover:bg-black/5 rounded py-0.5 px-2 inline-flex items-center gap-1 mt-0.5"
                                                title="Haz clic para editar"
                                            >
                                                <span className={`text-lg font-black ${over ? 'text-rose-600' : 'text-emerald-700'}`}>{act.toFixed(1)}h</span>
                                                <Edit2 className="w-2.5 h-2.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Progress bar */}
                                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-gradient-to-r from-rose-400 to-rose-600' : 'bg-gradient-to-r from-emerald-400 to-emerald-600'}`}
                                        style={{ width: `${Math.min(pct, 100)}%` }}
                                    />
                                </div>
                                <div className="flex justify-between items-center mt-1.5">
                                    <span className="text-[10px] text-gray-400 font-semibold">{pct.toFixed(0)}% del presupuesto</span>
                                    <span className={`text-[10px] font-black uppercase tracking-wider ${over ? 'text-rose-500' : 'text-emerald-600'}`}>
                                        {over ? '⚠ Sobre presupuesto' : est === 0 ? '—' : '✓ En rango'}
                                    </span>
                                </div>
                            </div>

                            {/* ── TEST CASES CHECKLIST ── */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Casos de Prueba</p>
                                        <div className="flex items-center gap-1">
                                            {passed > 0 && <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">{passed} ✓</span>}
                                            {failed > 0 && <span className="text-[9px] font-black bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full">{failed} ✗</span>}
                                            {pending > 0 && <span className="text-[9px] font-black bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{pending} ○</span>}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddChecklistItem}
                                        className="text-xs text-indigo-600 font-bold hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors"
                                    >
                                        <Plus className="w-3 h-3" /> Añadir
                                    </button>
                                </div>

                                {checklist.length > 0 ? (
                                    <div className="space-y-2">
                                        {checklist.map((item, idx) => (
                                            <div
                                                key={item.id}
                                                className={`flex items-center gap-3 group px-3 py-2.5 rounded-xl border transition-all ${
                                                    item.status === 'passed' ? 'bg-emerald-50/60 border-emerald-200/60' :
                                                    item.status === 'failed' ? 'bg-rose-50/60 border-rose-200/60' :
                                                    'bg-white border-gray-100 hover:border-gray-200'
                                                }`}
                                            >
                                                {/* Pass / Fail buttons */}
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleChecklistItemChange(idx, 'status', item.status === 'passed' ? 'pending' : 'passed')}
                                                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                                            item.status === 'passed'
                                                                ? 'bg-emerald-500 text-white shadow-sm'
                                                                : 'bg-gray-100 text-gray-400 hover:bg-emerald-100 hover:text-emerald-600'
                                                        }`}
                                                        title="Marcar como PASADO"
                                                    >
                                                        <Check size={12} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleChecklistItemChange(idx, 'status', item.status === 'failed' ? 'pending' : 'failed')}
                                                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                                            item.status === 'failed'
                                                                ? 'bg-rose-500 text-white shadow-sm'
                                                                : 'bg-gray-100 text-gray-400 hover:bg-rose-100 hover:text-rose-600'
                                                        }`}
                                                        title="Marcar como FALLIDO"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>

                                                {/* Test description input */}
                                                <input
                                                    type="text"
                                                    placeholder="Ej: Validar guardado en BD"
                                                    value={item.text}
                                                    onChange={e => handleChecklistItemChange(idx, 'text', e.target.value)}
                                                    className={`flex-1 bg-transparent text-[13px] outline-none px-1 transition-all ${
                                                        item.status === 'passed' ? 'line-through text-emerald-700/70 font-medium' :
                                                        item.status === 'failed' ? 'text-rose-700 font-semibold' :
                                                        'text-gray-700'
                                                    }`}
                                                />

                                                {/* Status badge */}
                                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                                                    item.status === 'passed' ? 'bg-emerald-100 text-emerald-700' :
                                                    item.status === 'failed' ? 'bg-rose-100 text-rose-700' :
                                                    'bg-gray-100 text-gray-400'
                                                }`}>
                                                    {item.status === 'passed' ? 'Pasó' : item.status === 'failed' ? 'Falló' : 'Pendiente'}
                                                </span>

                                                {/* Delete button */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteChecklistItem(item.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-rose-500 rounded-lg transition-all"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                                        <CheckCircle2 size={24} className="text-gray-300 mx-auto mb-2" />
                                        <p className="text-[13px] text-gray-400 font-medium mb-3">Sin casos de prueba aún</p>
                                        <button
                                            type="button"
                                            onClick={handleAddChecklistItem}
                                            className="text-xs bg-indigo-50 text-indigo-600 font-bold px-4 py-2 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors flex items-center gap-1.5 mx-auto"
                                        >
                                            <Plus size={12} /> Agregar Caso de Prueba
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* ── Save Button (Edit tab) ── */}
            {tab === 'edit' && (
                <div className="px-5 py-4 border-t border-gray-100 bg-gradient-to-t from-gray-50/80 to-white">
                    <button onClick={handleSave} disabled={saving} className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-200/50 disabled:opacity-60 transition-all">
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            )}

            {/* ── Save Button (Resolution tab) ── */}
            {tab === 'resolution' && (
                <div className="px-5 py-4 border-t border-violet-100 bg-gradient-to-t from-violet-50/60 to-white">
                    <button
                        onClick={handleSaveResolution}
                        disabled={resSaving || resUploading}
                        className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-violet-200/50 disabled:opacity-60 transition-all"
                    >
                        {resSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : resUploading ? <UploadCloud className="w-4 h-4 animate-pulse" /> : <FileBadge2 className="w-4 h-4" />}
                        {resSaving ? 'Guardando...' : resUploading ? 'Subiendo archivos...' : 'Guardar Reporte'}
                    </button>
                </div>
            )}
        </div>
    );
}
