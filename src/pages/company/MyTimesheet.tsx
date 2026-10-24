import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { timesheetsService } from '../../services/timesheetsService';
import type { TimesheetEntry } from '../../types/timesheets';
import { supabase } from '../../services/supabase';
import { 
  Clock, Calendar, AlertCircle, CheckCircle2, XCircle, 
  Send, Plus, Layers, Ticket, ChevronRight, History, Sparkles, FileText, Check
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function MyTimesheet() {
  const { profile, simulatedCompanyId } = useAuth();
  const activeCompanyId = simulatedCompanyId || profile?.company_id;

  // Form State
  const [workDate, setWorkDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [regularHours, setRegularHours] = useState<number>(8);
  const [overtimeHours, setOvertimeHours] = useState<number>(0);
  const [overtimeReason, setOvertimeReason] = useState<string>('');
  const [workSummary, setWorkSummary] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [ticketId, setTicketId] = useState<string>('');

  // Dropdown options
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [tickets, setTickets] = useState<{ id: string; title: string }[]>([]);

  // History State
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (activeCompanyId && profile?.id) {
      loadInitialData();
    }
  }, [activeCompanyId, profile?.id]);

  const loadInitialData = async () => {
    if (!activeCompanyId || !profile?.id) return;
    setLoading(true);
    try {
      // 1. Cargar proyectos de la empresa
      const { data: projData } = await supabase
        .from('crm_projects')
        .select('id, name')
        .eq('company_id', activeCompanyId)
        .order('name');
      if (projData) setProjects(projData);

      // 2. Cargar tickets asignados o activos
      const { data: tickData } = await supabase
        .from('tickets')
        .select('id, title')
        .eq('company_id', activeCompanyId)
        .order('created_at', { ascending: false })
        .limit(30);
      if (tickData) setTickets(tickData);

      // 3. Cargar historial del usuario
      await fetchHistory();
    } catch (err) {
      console.error('Error loading initial timesheet data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!activeCompanyId || !profile?.id) return;
    const data = await timesheetsService.getTimesheets({
      companyId: activeCompanyId,
      userId: profile.id,
    });
    setEntries(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId || !profile?.id) {
      toast.error('Sesión no disponible');
      return;
    }

    if (!workSummary.trim()) {
      toast.error('Por favor detalla qué actividades realizaste hoy.');
      return;
    }

    if (overtimeHours > 0 && (!overtimeReason.trim() || overtimeReason.trim().length < 4)) {
      toast.error('Es obligatorio explicar el motivo del tiempo extra.');
      return;
    }

    setSubmitting(true);
    const res = await timesheetsService.submitTimesheet({
      companyId: activeCompanyId,
      userId: profile.id,
      workDate,
      regularHours: Number(regularHours),
      overtimeHours: Number(overtimeHours),
      overtimeReason: overtimeHours > 0 ? overtimeReason : undefined,
      workSummary,
      projectId: projectId || null,
      ticketId: ticketId || null,
    });
    setSubmitting(false);

    if (res.success) {
      toast.success(
        overtimeHours > 0 
          ? 'Jornada enviada. Las horas extras quedaron pendientes de aprobación.' 
          : 'Jornada diaria registrada con éxito.'
      );
      // Reset form parcial
      setWorkSummary('');
      setOvertimeHours(0);
      setOvertimeReason('');
      setTicketId('');
      setProjectId('');
      await fetchHistory();
    } else {
      toast.error(res.error || 'No se pudo guardar la jornada');
    }
  };

  const getStatusBadge = (status: TimesheetEntry['status']) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Aprobado
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" /> Rechazado
          </span>
        );
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <Check className="w-3.5 h-3.5" /> Liquidado / Pagado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" /> Pendiente de Aprobación
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <span className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
              <Clock className="w-6 h-6" />
            </span>
            Mi Registro de Jornada & Horas Extras
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Registra tu tiempo diario y justifica tus horas extras para que sean autorizadas en planilla.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600">Hoy: {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Formulario Diario */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              Nuevo Reporte del Día
            </h2>
            <span className="text-xs font-medium text-slate-400">Paso obligatorio</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Fecha */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Fecha de la Jornada
              </label>
              <input
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
            </div>

            {/* Selector de Horas */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Horas Regulares
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    value={regularHours}
                    onChange={(e) => setRegularHours(Math.max(0, Number(e.target.value)))}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">hrs</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Horas Extras
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="16"
                    value={overtimeHours}
                    onChange={(e) => setOvertimeHours(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3.5 py-2.5 bg-amber-50/40 border border-amber-200 rounded-xl text-sm font-bold text-amber-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-amber-600 font-semibold">hrs</span>
                </div>
              </div>
            </div>

            {/* Motivo de Horas Extras (Condicional Obligatorio) */}
            {overtimeHours > 0 && (
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-2 animate-fadeIn">
                <div className="flex items-center gap-2 text-amber-800 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  ¿Por qué se requirió tiempo extra? (Obligatorio)
                </div>
                <textarea
                  rows={2}
                  placeholder="Ej: Emergencia con servidor caído, extensión en sitio de instalación, cierre urgente de entrega..."
                  value={overtimeReason}
                  onChange={(e) => setOvertimeReason(e.target.value)}
                  required
                  className="w-full p-2.5 bg-white border border-amber-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 placeholder:text-slate-400"
                />
                <p className="text-[11px] text-amber-700 leading-tight">
                  ⚠️ El supervisor revisará esta justificación antes de que se apruebe el pago de las horas extras.
                </p>
              </div>
            )}

            {/* Proyecto o Ticket Asociado (Opcional) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  Proyecto
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">(Opcional) General</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Ticket className="w-3.5 h-3.5 text-slate-400" />
                  Ticket
                </label>
                <select
                  value={ticketId}
                  onChange={(e) => setTicketId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">(Opcional) Ninguno</option>
                  {tickets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title.substring(0, 30)}...
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Resumen de Trabajo */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                ¿Qué hiciste hoy? (Notas y Entregables)
              </label>
              <textarea
                rows={3}
                placeholder="Escribe brevemente las tareas o solución técnica realizada hoy..."
                value={workSummary}
                onChange={(e) => setWorkSummary(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Enviando...' : 'Enviar Reporte de Jornada'}
            </button>
          </form>
        </div>

        {/* Historial Reciente */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-slate-600" />
              Historial de mis Jornadas
            </h2>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              {entries.length} registros
            </span>
          </div>

          {loading ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400">
              <Clock className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
              Cargando tu historial...
            </div>
          ) : entries.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 space-y-2">
              <FileText className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700">Aún no has registrado jornadas</p>
              <p className="text-xs text-slate-400">Completa el formulario a la izquierda para enviar tu primer día de trabajo.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-800">
                        📅 {new Date(entry.work_date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {entry.overtime_hours > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                          ⚡ +{entry.overtime_hours}h Extra
                        </span>
                      )}
                    </div>
                    {getStatusBadge(entry.status)}
                  </div>

                  <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                    {entry.work_summary}
                  </p>

                  {/* Justificación de horas extras si existen */}
                  {entry.overtime_hours > 0 && entry.overtime_reason && (
                    <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3 text-xs space-y-1">
                      <span className="font-bold text-amber-900 block">Motivo del tiempo extra:</span>
                      <p className="text-amber-800">{entry.overtime_reason}</p>
                    </div>
                  )}

                  {/* Rejection / Note feedback */}
                  {entry.status === 'rejected' && entry.rejection_reason && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs space-y-1">
                      <span className="font-bold text-rose-900 flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" /> Motivo del rechazo de horas extras:
                      </span>
                      <p className="text-rose-800">{entry.rejection_reason}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                    <span>
                      Total horas: <strong className="text-slate-700">{entry.regular_hours + entry.overtime_hours}h</strong> ({entry.regular_hours}h reg. + {entry.overtime_hours}h ext.)
                    </span>
                    {entry.reviewed_name && (
                      <span className="text-[11px] text-slate-500">
                        Revisado por: <strong className="text-slate-700">{entry.reviewed_name}</strong>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
