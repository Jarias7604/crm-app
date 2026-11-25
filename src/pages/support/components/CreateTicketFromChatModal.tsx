import React, { useEffect, useState } from 'react';
import {
  X,
  Ticket as TicketIcon,
  Sparkles,
  Check,
  Bell,
  Users,
  AlertCircle,
  Loader2,
  CalendarClock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../services/supabase';
import {
  ticketService,
  type Ticket,
  type TicketCategory,
  type TicketPriority,
  type CompanyAgent,
} from '../../../services/tickets';
import {
  TICKET_MODULES,
  buildStructuredTicketTitle,
  validateTicketProblemText,
} from '../../../lib/ticketWorkflow';

interface CreateTicketFromChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string;
  clientName: string;
  companyId: string;
  currentUserId: string;
  currentUserName: string;
  agents: CompanyAgent[];
  categories: TicketCategory[];
  onCreated: (ticket: Ticket) => void;
}

const COMMERCIAL_NAME_RE = /diana|patricia|paty|grecia/i;
const COMMERCIAL_ROLE_RE = /ventas|comercial|sales|geren|admin|account/i;

export const CreateTicketFromChatModal: React.FC<CreateTicketFromChatModalProps> = ({
  isOpen,
  onClose,
  ticketId,
  clientName,
  companyId,
  currentUserId,
  currentUserName,
  agents,
  categories,
  onCreated,
}) => {
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [moduleName, setModuleName] = useState<string>(TICKET_MODULES[0]);
  const [problem, setProblem] = useState('');
  const [summary, setSummary] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [watchers, setWatchers] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !ticketId) return;
    let cancelled = false;

    // Default watchers: commercial team (Diana, Patricia, Grecia, sales/admin) minus current actor
    const defaultWatchers = agents
      .filter(
        (a) =>
          a.id !== currentUserId &&
          (COMMERCIAL_NAME_RE.test(a.full_name || '') || COMMERCIAL_ROLE_RE.test(a.role || ''))
      )
      .slice(0, 6)
      .map((a) => a.id);
    setWatchers(defaultWatchers);
    setErrorMsg(null);
    setAssignedTo('');
    setDueDate('');
    setDrafting(true);

    supabase.functions
      .invoke('evolution-whatsapp-webhook', {
        body: { action: 'draft_technical_ticket', ticket_id: ticketId },
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data?.ok && data?.draft) {
          const d = data.draft;
          if (d.module) setModuleName(String(d.module));
          if (d.problem_summary) setProblem(String(d.problem_summary));
          if (d.description_summary) setSummary(String(d.description_summary));
          if (d.category_id) setCategoryId(String(d.category_id));
          if (['low', 'medium', 'high', 'urgent'].includes(String(d.priority))) {
            setPriority(d.priority as TicketPriority);
          }
        }
      })
      .catch(() => {
        // Fallback leaves fields editable without blocking
      })
      .finally(() => {
        if (!cancelled) setDrafting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, ticketId, agents, currentUserId]);

  if (!isOpen) return null;

  const toggleWatcher = (uid: string) => {
    setWatchers((prev) => (prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]));
  };

  const previewTitle = buildStructuredTicketTitle(moduleName, problem || 'Describe el problema puntual...');
  const validation = validateTicketProblemText(problem);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.valid) {
      setErrorMsg(validation.reason || 'Completa el título del problema.');
      return;
    }
    setErrorMsg(null);
    setSaving(true);
    const tid = toast.loading('Generando Ticket Técnico...');
    try {
      const { data, error } = await supabase.functions.invoke(
        'evolution-whatsapp-webhook',
        {
          body: {
            action: 'set_technical_ticket',
            ticket_id: ticketId,
            is_technical_ticket: true,
            module: moduleName,
            problem_summary: problem.trim(),
            custom_title: buildStructuredTicketTitle(moduleName, problem),
            description_summary: summary.trim() || problem.trim(),
            category_id: categoryId || null,
            priority,
            assigned_to: assignedTo || null,
            due_date: dueDate ? new Date(`${dueDate}T18:00:00`).toISOString() : null,
            watchers,
          },
        }
      );

      if (error || !data?.ok || !data?.ticket) {
        throw new Error(data?.error || error?.message || 'No se pudo generar el ticket');
      }

      // Notify team (Bell + Email) in background without blocking modal close
      ticketService.notifyTicketLifecycleChange({
        companyId,
        ticket: data.ticket as Ticket,
        previousStatus: null,
        newStatus: 'new',
        actorId: currentUserId,
        actorName: currentUserName,
        agents,
        extraWatcherIds: watchers,
        forceNotify: true,
      });

      toast.success('Ticket Técnico generado y equipo notificado', { id: tid });
      onCreated(data.ticket as Ticket);
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Error al generar ticket técnico';
      setErrorMsg(msg);
      toast.error(msg, { id: tid });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90dvh] overflow-hidden flex flex-col border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <TicketIcon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black leading-tight truncate">
                Crear Ticket Técnico Formal
              </h3>
              <p className="text-[11px] text-indigo-100 font-semibold truncate">
                Cliente: {clientName} · Se notificará en estado Ticket Generado
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {drafting && (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-xs font-bold text-indigo-700">
              <Sparkles className="w-4 h-4 animate-pulse shrink-0" />
              <span>La IA está redactando el título claro (Módulo — Problema) desde el chat...</span>
            </div>
          )}

          {/* Live Title Preview */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Vista previa en Service Hub
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                Ticket Generado
              </span>
            </div>
            <p className="text-sm font-black text-slate-900 leading-snug">{previewTitle}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">
                Módulo *
              </label>
              <select
                value={moduleName}
                onChange={(e) => setModuleName(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                {Array.from(new Set([...TICKET_MODULES, moduleName].filter(Boolean))).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">
                Problema concreto *
              </label>
              <input
                type="text"
                required
                value={problem}
                onChange={(e) => {
                  setProblem(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Ej: No reduce las cantidades del inventario al facturar"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">
              Resumen técnico para el desarrollador
            </label>
            <textarea
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Qué ocurre, pasos o datos clave reportados por el cliente..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">
                Categoría SLA
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (SLA {c.sla_hours}h)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">
                Prioridad
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">
                Asignar a (Desarrollador / Agente)
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="">Sin asignar todavía</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1 mb-1.5">
                <CalendarClock className="w-3 h-3" /> Fecha límite (opcional)
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
          </div>

          {/* Watchers / Notify Commercial Team */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5 mb-2">
              <Bell className="w-3.5 h-3.5 text-indigo-500" />
              <span>Notificar cambios al equipo (Campana + Email)</span>
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2.5 rounded-2xl bg-slate-50 border border-slate-200">
              {agents.map((a) => {
                const selected = watchers.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleWatcher(a.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition ${
                      selected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    {selected ? <Check className="w-3 h-3" /> : <Users className="w-3 h-3 opacity-50" />}
                    <span>{a.full_name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || drafting}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-lg shadow-indigo-200 inline-flex items-center gap-2 transition disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <TicketIcon className="w-4 h-4" />}
              <span>{saving ? 'Generando...' : 'Generar Ticket y Notificar'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
