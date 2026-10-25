import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { timesheetsService } from '../../services/timesheetsService';
import type { TimesheetEntry } from '../../types/timesheets';
import { supabase } from '../../services/supabase';
import SearchableSelect from '../../components/ui/SearchableSelect';
import { 
  Clock, Calendar, AlertCircle, CheckCircle2, XCircle, 
  Send, Plus, Layers, Ticket, ChevronLeft, ChevronRight, History, 
  Sparkles, FileText, Check, AlertTriangle, ArrowRight, Zap, RefreshCw,
  FolderGit2, Lock, Unlock, ShieldCheck, Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';

// Helper de fechas timezone-safe
function formatDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.getFullYear(), date.getMonth(), diff);
}

export default function MyTimesheet() {
  const { profile, simulatedCompanyId } = useAuth();
  const activeCompanyId = simulatedCompanyId || profile?.company_id;
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'company_admin';
  const [adminOverrideUnlocked, setAdminOverrideUnlocked] = useState<boolean>(false);

  // Selected Date & Reference Week
  const todayStr = useMemo(() => formatDateISO(new Date()), []);
  const [referenceDate, setReferenceDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Form State
  const [regularHours, setRegularHours] = useState<number>(8);
  const [overtimeHours, setOvertimeHours] = useState<number>(0);
  const [overtimeReason, setOvertimeReason] = useState<string>('');
  const [workSummary, setWorkSummary] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [ticketId, setTicketId] = useState<string>('');

  // Horario de Horas Extras
  const [overtimeStartTime, setOvertimeStartTime] = useState<string>('17:00');
  const [overtimeEndTime, setOvertimeEndTime] = useState<string>('21:00');

  // Dropdown options
  const [projects, setProjects] = useState<{ id: string; name: string; description?: string; status?: string }[]>([]);
  const [tickets, setTickets] = useState<{ 
    id: string; 
    title: string; 
    status?: string; 
    priority?: string; 
    lead_name?: string 
  }[]>([]);

  // History State
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [filterTab, setFilterTab] = useState<'week' | 'all' | 'pending'>('week');

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [selectedEntryToDelete, setSelectedEntryToDelete] = useState<TimesheetEntry | null>(null);
  const [deletingTimesheet, setDeletingTimesheet] = useState<boolean>(false);

  const handleOpenDelete = (entry: TimesheetEntry) => {
    setSelectedEntryToDelete(entry);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedEntryToDelete) return;
    setDeletingTimesheet(true);
    try {
      const res = await timesheetsService.deleteTimesheet(selectedEntryToDelete.id);
      if (res.success) {
        toast.success('Registro de jornada eliminado permanentemente.');
        setDeleteModalOpen(false);
        setSelectedEntryToDelete(null);
        await loadInitialData();
      } else {
        toast.error('Error al eliminar registro: ' + (res.error || 'No se pudo eliminar'));
      }
    } catch (err: any) {
      toast.error('Error inesperado: ' + err.message);
    } finally {
      setDeletingTimesheet(false);
    }
  };

  useEffect(() => {
    if (activeCompanyId && profile?.id) {
      loadInitialData();
    }
  }, [activeCompanyId, profile?.id]);

  const loadInitialData = async () => {
    if (!activeCompanyId || !profile?.id) return;
    setLoading(true);
    try {
      // 1. Cargar proyectos de la empresa con descripción y estado
      const { data: projData } = await supabase
        .from('crm_projects')
        .select('id, name, description, status')
        .eq('company_id', activeCompanyId)
        .order('name');
      if (projData) setProjects(projData);

      // 2. Cargar tickets con prioridad, estado y cliente
      const { data: tickData } = await supabase
        .from('tickets')
        .select('id, title, status, priority, lead_name')
        .eq('company_id', activeCompanyId)
        .order('created_at', { ascending: false })
        .limit(100);
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

  // ── Cálculo de los 7 Días de la Semana Actual ───────────────────
  const weekDays = useMemo(() => {
    const monday = getMonday(referenceDate);
    const days: { date: Date; dateStr: string; dayName: string; dayNumber: number }[] = [];
    const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push({
        date: d,
        dateStr: formatDateISO(d),
        dayName: dayNames[i],
        dayNumber: d.getDate(),
      });
    }
    return days;
  }, [referenceDate]);

  // Navegación de Semanas
  const handlePrevWeek = () => {
    const prev = new Date(referenceDate);
    prev.setDate(prev.getDate() - 7);
    setReferenceDate(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(referenceDate);
    next.setDate(next.getDate() + 7);
    setReferenceDate(next);
  };

  const handleTodayWeek = () => {
    const now = new Date();
    setReferenceDate(now);
    setSelectedDate(formatDateISO(now));
  };

  // Entry existente para el día seleccionado
  const selectedDayEntry = useMemo(() => {
    return entries.find(e => e.work_date === selectedDate);
  }, [entries, selectedDate]);

  // Reset del override administrativo cuando cambia la fecha seleccionada
  useEffect(() => {
    setAdminOverrideUnlocked(false);
  }, [selectedDate]);

  // Reglas de inmutabilidad estricta:
  // - 'submitted': el empleado lo envió. En cola de revisión, NO puede cambiarlo.
  // - 'approved': aprobado por supervisor/nómina. Bloqueo total permanente.
  // - 'paid': liquidado en nómina contable. Bloqueo total permanente.
  // - 'rejected': devuelto por supervisor con observación. El empleado SÍ puede corregir y reenviar.
  // - Sin registro / borrador: totalmente editable.
  const isLockedStatus = useMemo(() => {
    if (!selectedDayEntry) return false;
    return ['submitted', 'approved', 'paid'].includes(selectedDayEntry.status);
  }, [selectedDayEntry]);

  // El formulario está bloqueado si el registro tiene estado protegido Y (el usuario no es admin O el admin no ha activado el override explícito)
  const isFormDisabled = isLockedStatus && (!isAdmin || !adminOverrideUnlocked);

  // Cuando cambia el día seleccionado, sincronizamos el formulario
  useEffect(() => {
    if (selectedDayEntry) {
      setRegularHours(selectedDayEntry.regular_hours);
      setOvertimeHours(selectedDayEntry.overtime_hours);
      setOvertimeReason(selectedDayEntry.overtime_reason || '');
      setOvertimeStartTime(selectedDayEntry.overtime_start_time || '17:00');
      setOvertimeEndTime(selectedDayEntry.overtime_end_time || '21:00');
      setWorkSummary(selectedDayEntry.work_summary || '');
      setProjectId(selectedDayEntry.project_id || '');
      setTicketId(selectedDayEntry.ticket_id || '');
    } else {
      // Día nuevo: valores por defecto frescos
      setRegularHours(8);
      setOvertimeHours(0);
      setOvertimeReason('');
      setOvertimeStartTime('17:00');
      setOvertimeEndTime('21:00');
      setWorkSummary('');
      setProjectId('');
      setTicketId('');
    }
  }, [selectedDate, selectedDayEntry]);

  // Acción de Administrador: Devolver al empleado para que lo edite
  const handleAdminUnlockForEmployee = async () => {
    if (!selectedDayEntry || !profile?.id) return;
    const confirmUnlock = window.confirm(
      '¿Deseas devolver este registro al colaborador para que pueda editar sus horas y entregables desde su cuenta?'
    );
    if (!confirmUnlock) return;

    const res = await timesheetsService.unlockTimesheetForEmployee(
      selectedDayEntry.id,
      profile.id,
      'Habilitado por el administrador para que el colaborador realice correcciones.'
    );

    if (res.success) {
      toast.success('Registro devuelto al colaborador con permisos de edición habilitados.');
      setAdminOverrideUnlocked(false);
      await fetchHistory();
    } else {
      toast.error('Error al desbloquear: ' + res.error);
    }
  };

  // Resumen de Horas de la Semana
  const weekStats = useMemo(() => {
    const weekDateStrings = new Set(weekDays.map(d => d.dateStr));
    const weekEntries = entries.filter(e => weekDateStrings.has(e.work_date));

    let reg = 0;
    let ot = 0;
    let otApproved = 0;

    weekEntries.forEach(e => {
      reg += Number(e.regular_hours || 0);
      ot += Number(e.overtime_hours || 0);
      if (e.status === 'approved' || e.status === 'paid') {
        otApproved += Number(e.overtime_hours || 0);
      }
    });

    return {
      total: +(reg + ot).toFixed(1),
      regular: +reg.toFixed(1),
      overtime: +ot.toFixed(1),
      otApproved: +otApproved.toFixed(1),
      entriesCount: weekEntries.length,
    };
  }, [weekDays, entries]);

  // Manejo del Envío
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId || !profile?.id) {
      toast.error('Sesión no disponible');
      return;
    }

    if (isFormDisabled) {
      toast.error('Este registro está bloqueado contra modificaciones.');
      return;
    }

    if (!workSummary.trim()) {
      toast.error('Por favor detalla qué actividades realizaste.');
      return;
    }

    if (overtimeHours > 0) {
      if (!overtimeReason.trim() || overtimeReason.trim().length < 4) {
        toast.error('Es obligatorio justificar el motivo del tiempo extra.');
        return;
      }
      if (!overtimeStartTime || !overtimeEndTime) {
        toast.error('Por favor especifica de qué hora a qué hora se laboró el tiempo extra.');
        return;
      }
    }

    setSubmitting(true);
    const res = await timesheetsService.submitTimesheet({
      companyId: activeCompanyId,
      userId: selectedDayEntry?.user_id || profile.id,
      workDate: selectedDate,
      regularHours: Number(regularHours),
      overtimeHours: Number(overtimeHours),
      overtimeReason: overtimeHours > 0 ? overtimeReason : undefined,
      overtimeStartTime: overtimeHours > 0 ? overtimeStartTime : undefined,
      overtimeEndTime: overtimeHours > 0 ? overtimeEndTime : undefined,
      workSummary,
      projectId: projectId || null,
      ticketId: ticketId || null,
      isAdmin: Boolean(isAdmin && adminOverrideUnlocked),
    });
    setSubmitting(false);

    if (res.success) {
      if (isAdmin && adminOverrideUnlocked) {
        toast.success('Cambios guardados con autorización de administrador.');
        setAdminOverrideUnlocked(false);
      } else if (selectedDayEntry?.status === 'rejected') {
        toast.success('Reporte corregido y reenviado para revisión del supervisor.');
      } else if (overtimeHours > 0) {
        toast.success(`Jornada enviada. Horas extras (${overtimeStartTime} a ${overtimeEndTime}) en revisión.`);
      } else {
        toast.success('Jornada registrada y enviada correctamente.');
      }
      await fetchHistory();
    } else {
      toast.error(res.error || 'No se pudo guardar la jornada');
    }
  };

  const getStatusBadge = (status: TimesheetEntry['status']) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Aprobado
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" /> Corrección Requerida
          </span>
        );
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <Check className="w-3 h-3 text-purple-600" /> Liquidado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" /> Enviado (En Revisión)
          </span>
        );
    }
  };

  // Formateador de texto de fecha amigable
  const formattedSelectedDate = useMemo(() => {
    try {
      const d = new Date(selectedDate + 'T00:00:00');
      return d.toLocaleDateString('es-ES', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // Lista filtrada de entradas para el historial derecho
  const displayedEntries = useMemo(() => {
    const weekDateStrings = new Set(weekDays.map(d => d.dateStr));
    if (filterTab === 'week') {
      return entries.filter(e => weekDateStrings.has(e.work_date));
    }
    if (filterTab === 'pending') {
      return entries.filter(e => e.status === 'submitted' || e.overtime_hours > 0);
    }
    return entries;
  }, [entries, filterTab, weekDays]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 animate-fadeIn font-sans text-slate-800">
      
      {/* ── 1. HEADER MODERNO ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-500/20">
              <Clock className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Mi Registro de Jornada & Horas Extras
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Selecciona el día en el calendario, registra tus entregables y justifica el overtime.
              </p>
            </div>
          </div>
        </div>

        {/* Métrica Resumen Semanal en Header */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
          <span className="text-slate-400 font-medium">Esta Semana:</span>
          <span className="font-bold text-slate-900">{weekStats.total} hrs</span>
          {weekStats.overtime > 0 && (
            <span className="text-amber-700 bg-amber-50 font-bold px-1.5 py-0.2 rounded border border-amber-200 text-[10px]">
              +{weekStats.overtime}h OT
            </span>
          )}
        </div>
      </div>

      {/* ── 2. CALENDARIO SEMANAL INTERACTIVO (QUICKBOOKS / LINEAR STYLE) ── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
        {/* Barra de Navegación de la Semana */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevWeek}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition border border-slate-200/70"
              title="Semana anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextWeek}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition border border-slate-200/70"
              title="Semana siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleTodayWeek}
              className="px-2.5 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition"
            >
              Ir a Hoy
            </button>

            <span className="text-xs font-bold text-slate-800 ml-1">
              Semana: {weekDays[0].dayNumber} {weekDays[0].date.toLocaleDateString('es-ES', { month: 'short' })} – {weekDays[6].dayNumber} {weekDays[6].date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Aprobado
            </span>
            <span className="flex items-center gap-1 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> Enviado
            </span>
            <span className="flex items-center gap-1 font-medium">
              <span className="w-2 h-2 rounded-full bg-rose-500" /> Corrección
            </span>
            <span className="flex items-center gap-1 font-medium text-slate-400">
              <Lock className="w-3 h-3 text-slate-400" /> Bloqueado
            </span>
          </div>
        </div>

        {/* 7 Tarjetas de Días de la Semana */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {weekDays.map(({ dateStr, dayName, dayNumber }) => {
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const entry = entries.find(e => e.work_date === dateStr);
            const hasOvertime = entry && entry.overtime_hours > 0;
            const isEntryLocked = entry && ['submitted', 'approved', 'paid'].includes(entry.status);

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => setSelectedDate(dateStr)}
                className={`relative p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[92px] ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20 shadow-xs'
                    : isToday
                    ? 'border-slate-300 bg-slate-50/70 hover:bg-slate-100/70'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                {/* Cabecera del día */}
                <div className="flex items-center justify-between w-full">
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${
                    isSelected ? 'text-indigo-700' : 'text-slate-500'
                  }`}>
                    {dayName}
                  </span>
                  {isToday && (
                    <span className="text-[9px] font-black bg-indigo-600 text-white px-1.5 py-0.2 rounded-full">
                      HOY
                    </span>
                  )}
                </div>

                {/* Número del día */}
                <div className="my-1">
                  <span className={`text-xl font-bold tracking-tight block ${
                    isSelected ? 'text-indigo-950 font-black' : 'text-slate-800'
                  }`}>
                    {dayNumber}
                  </span>
                </div>

                {/* Badge de Horas Registradas */}
                <div className="w-full">
                  {entry ? (
                    <div className="flex items-center justify-between gap-1 w-full">
                      <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                        {isEntryLocked && (
                          <span title="Registro Bloqueado">
                            <Lock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                          </span>
                        )}
                        {entry.regular_hours}h
                        {hasOvertime && (
                          <span className="text-amber-700 font-bold ml-0.5">+{entry.overtime_hours}h</span>
                        )}
                      </span>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        entry.status === 'approved' || entry.status === 'paid'
                          ? 'bg-emerald-500'
                          : entry.status === 'rejected'
                          ? 'bg-rose-500'
                          : 'bg-amber-400'
                      }`} />
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-semibold block">
                      Sin registrar
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 3. ZONA DE TRABAJO: FORMULARIO + HISTORIAL EN 2 COLUMNAS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* COLUMNA IZQUIERDA: FORMULARIO DEL DÍA SELECCIONADO */}
        <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-indigo-700 font-bold uppercase tracking-wider">
                <Calendar className="w-3.5 h-3.5" />
                {formattedSelectedDate}
              </div>
              <h2 className="text-sm font-bold text-slate-900 mt-0.5">
                {selectedDayEntry?.status === 'approved' || selectedDayEntry?.status === 'paid'
                  ? 'Reporte Aprobado para Nómina'
                  : selectedDayEntry?.status === 'submitted'
                  ? 'Reporte Enviado (En Revisión)'
                  : selectedDayEntry?.status === 'rejected'
                  ? 'Reporte Devuelto para Corrección'
                  : 'Nuevo Registro de Jornada'}
              </h2>
            </div>

            {selectedDayEntry && (
              <div>
                {getStatusBadge(selectedDayEntry.status)}
              </div>
            )}
          </div>

          {/* ── BANNERS INFORMATIVOS DE ESTADO Y SEGURIDAD ── */}

          {/* BANNER 1: Aprobado o Liquidado (Bloqueo Total Legal) */}
          {(selectedDayEntry?.status === 'approved' || selectedDayEntry?.status === 'paid') && !adminOverrideUnlocked && (
            <div className="bg-emerald-50/90 border border-emerald-200/90 rounded-xl p-3.5 flex items-start gap-3 animate-fadeIn">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg shrink-0 mt-0.5">
                <Lock className="w-4 h-4" />
              </div>
              <div className="flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-900">
                    Jornada Aprobada para Nómina (Registro Sellado)
                  </span>
                  <span className="text-[10px] font-bold uppercase bg-emerald-200/80 text-emerald-800 px-2 py-0.5 rounded-full">
                    Inmutable
                  </span>
                </div>
                <p className="text-emerald-800 text-[11px] mt-1 leading-relaxed">
                  Este registro fue validado y cerrado contablemente. Para cumplir con normativas laborales y trazabilidad legal, no puede ser modificado por el colaborador.
                </p>
                {!isAdmin && (
                  <p className="text-[10px] text-emerald-700 mt-1.5 font-medium italic">
                    🔒 Si requieres un ajuste extraordinario, solicita a un administrador que habilite la edición.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* BANNER 2: Enviado (Bloqueado mientras está en cola de revisión) */}
          {selectedDayEntry?.status === 'submitted' && !adminOverrideUnlocked && (
            <div className="bg-amber-50/90 border border-amber-200/90 rounded-xl p-3.5 flex items-start gap-3 animate-fadeIn">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-lg shrink-0 mt-0.5">
                <Lock className="w-4 h-4" />
              </div>
              <div className="flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-900">
                    Jornada Enviada (En Cola de Revisión)
                  </span>
                  <span className="text-[10px] font-bold uppercase bg-amber-200/80 text-amber-800 px-2 py-0.5 rounded-full">
                    Bloqueado
                  </span>
                </div>
                <p className="text-amber-800 text-[11px] mt-1 leading-relaxed">
                  Has enviado este reporte de jornada. Para asegurar la transparencia, no se permite su edición mientras el supervisor evalúa las horas trabajadas.
                </p>
                {!isAdmin && (
                  <p className="text-[10px] text-amber-700 mt-1.5 font-medium italic">
                    🔒 Si necesitas realizar cambios, solicita a tu supervisor que devuelva el registro para corrección.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* BANNER 3: Rechazado / Devuelto para Corrección */}
          {selectedDayEntry?.status === 'rejected' && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-start gap-3 animate-fadeIn">
              <div className="p-2 bg-rose-100 text-rose-700 rounded-lg shrink-0 mt-0.5">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-900">
                    Jornada Devuelta para Corrección
                  </span>
                  <span className="text-[10px] font-bold uppercase bg-rose-200 text-rose-800 px-2 py-0.5 rounded-full">
                    Edición Habilitada
                  </span>
                </div>
                <p className="text-rose-800 text-[11px] mt-1 leading-snug">
                  <strong>Observación del supervisor:</strong> "{selectedDayEntry.rejection_reason || 'Por favor revisar entregables o justificación de tiempo extra'}"
                </p>
                <p className="text-[10px] text-rose-700 mt-1.5 font-medium">
                  ✏️ Los campos han sido habilitados para que corrijas la información y reenvíes tu jornada.
                </p>
              </div>
            </div>
          )}

          {/* BANNER 4: Panel Administrativo de Control y Desbloqueo */}
          {isAdmin && isLockedStatus && (
            <div className="bg-slate-900 text-white rounded-xl p-3.5 space-y-2.5 shadow-md animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  Control de Administrador / Supervisor
                </div>
                <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded">
                  {profile?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                </span>
              </div>

              <p className="text-[11px] text-slate-300 leading-snug">
                Este reporte está bloqueado para el colaborador. Como administrador tienes privilegios para habilitar la modificación directa o devolverlo:
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAdminOverrideUnlocked(!adminOverrideUnlocked)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    adminOverrideUnlocked
                      ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black shadow-sm'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {adminOverrideUnlocked ? (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      Volver a Bloquear
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3.5 h-3.5" />
                      Habilitar Modificación Directa
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleAdminUnlockForEmployee}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                  title="Devolver al colaborador para que lo edite y reenvíe"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                  Permitir que el Empleado lo Edite
                </button>
              </div>

              {adminOverrideUnlocked && (
                <div className="text-[11px] text-amber-200 bg-amber-950/50 p-2 rounded-lg border border-amber-500/30 font-medium">
                  ⚠️ <strong>Modo Edición Administrativa Activo:</strong> Puedes modificar las horas, entregables y asignación. Al guardar, quedará registrado con autorización de administrador.
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Presets Rápidos de Horas */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Horas Regulares Ordinarias
              </label>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isFormDisabled}
                  onClick={() => setRegularHours(8)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                    isFormDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    regularHours === 8
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  8h (Completa)
                </button>
                <button
                  type="button"
                  disabled={isFormDisabled}
                  onClick={() => setRegularHours(4)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                    isFormDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    regularHours === 4
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  4h (Media Jornada)
                </button>
                
                <div className="relative flex-1 min-w-[90px]">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    disabled={isFormDisabled}
                    value={regularHours}
                    onChange={(e) => setRegularHours(Math.max(0, Number(e.target.value)))}
                    required
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 text-right pr-7 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                  <span className="absolute right-2 top-1.5 text-xs text-slate-400 font-bold">h</span>
                </div>
              </div>
            </div>

            {/* Horas Extras (Overtime) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Horas Extras (Overtime)
                </label>
                <span className="text-[10px] text-amber-700 font-medium">Requiere justificación</span>
              </div>

              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="16"
                  disabled={isFormDisabled}
                  placeholder="0"
                  value={overtimeHours || ''}
                  onChange={(e) => setOvertimeHours(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 bg-amber-50/40 border border-amber-200 rounded-xl text-xs font-bold text-amber-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 pr-8 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
                <span className="absolute right-3 top-2 text-xs text-amber-600 font-bold">hrs</span>
              </div>
            </div>

            {/* Justificación y Horario de Horas Extras (Aparece automáticamente si hay overtime) */}
            {overtimeHours > 0 && (
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                  <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-700" />
                    Horario Laborado Adicional
                  </span>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-full">
                    Requerimiento Contable
                  </span>
                </div>

                {/* De qué hora a qué hora */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-amber-900 uppercase mb-1">
                      Desde (Hora Inicio)
                    </label>
                    <input
                      type="time"
                      disabled={isFormDisabled}
                      value={overtimeStartTime}
                      onChange={(e) => setOvertimeStartTime(e.target.value)}
                      required
                      className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-amber-900 uppercase mb-1">
                      Hasta (Hora Fin)
                    </label>
                    <input
                      type="time"
                      disabled={isFormDisabled}
                      value={overtimeEndTime}
                      onChange={(e) => setOvertimeEndTime(e.target.value)}
                      required
                      className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-900 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    ¿Por qué se requirió tiempo extra hoy? (Obligatorio)
                  </div>
                  <textarea
                    rows={2}
                    disabled={isFormDisabled}
                    placeholder="Ej: Despliegue de versión en servidor de cliente fuera de horario, atención de emergencia técnica..."
                    value={overtimeReason}
                    onChange={(e) => setOvertimeReason(e.target.value)}
                    required
                    className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs text-slate-800 focus:outline-none placeholder:text-slate-400 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                  <p className="text-[10px] text-amber-800 leading-snug">
                    📌 Horario registrado: <strong>{overtimeStartTime} a {overtimeEndTime}</strong>. El supervisor lo revisará en la bandeja de Nómina antes de autorizar el pago con recargo de ley.
                  </p>
                </div>
              </div>
            )}

            {/* SELECTORES MODERNOS BUSCABLES (Comboboxes amplios y legibles) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Proyecto Buscable */}
              <SearchableSelect
                label="Proyecto"
                icon={FolderGit2}
                disabled={isFormDisabled}
                placeholder="Seleccionar proyecto..."
                searchPlaceholder="Buscar proyecto por nombre o descripción..."
                noneOptionLabel="(Opcional) Trabajo General / Sin Proyecto"
                value={projectId}
                onChange={setProjectId}
                align="left"
                popoverWidthClass="w-full min-w-[320px] sm:min-w-[460px] md:min-w-[520px]"
                options={projects.map((p) => ({
                  id: p.id,
                  title: p.name,
                  subtitle: p.description ? p.description : undefined,
                  badge: p.status === 'active' ? '🟢 En Curso' : p.status === 'completed' ? '🏁 Concluido' : undefined,
                  badgeColor: p.status === 'active' 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-slate-100 text-slate-600 border-slate-200',
                }))}
              />

              {/* Ticket Buscable */}
              <SearchableSelect
                label="Ticket de Soporte"
                icon={Ticket}
                disabled={isFormDisabled}
                placeholder="Vincular ticket de soporte..."
                searchPlaceholder="Buscar por título, cliente, prioridad o estado..."
                noneOptionLabel="(Opcional) Sin ticket asignado"
                value={ticketId}
                onChange={setTicketId}
                align="right"
                popoverWidthClass="w-full min-w-[320px] sm:min-w-[480px] md:min-w-[560px]"
                options={tickets.map((t) => {
                  const priorityMap: Record<string, { label: string; color: string }> = {
                    urgent: { label: '🔴 Urgente', color: 'bg-rose-50 text-rose-700 border-rose-200' },
                    high: { label: '🟠 Alta', color: 'bg-amber-50 text-amber-800 border-amber-200' },
                    medium: { label: '🔵 Media', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                    low: { label: '⚪ Baja', color: 'bg-slate-100 text-slate-600 border-slate-200' },
                  };
                  const statusMap: Record<string, { label: string; color: string }> = {
                    new: { label: 'Nuevo', color: 'bg-purple-50 text-purple-700 border-purple-200' },
                    open: { label: 'Abierto', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                    pending: { label: 'En Espera', color: 'bg-amber-50 text-amber-700 border-amber-200' },
                    resolved: { label: 'Resuelto', color: 'bg-slate-100 text-slate-600 border-slate-200' },
                    closed: { label: 'Cerrado', color: 'bg-slate-100 text-slate-500 border-slate-200' },
                  };

                  const p = t.priority ? priorityMap[t.priority] : undefined;
                  const s = t.status ? statusMap[t.status] : undefined;

                  return {
                    id: t.id,
                    title: t.title,
                    subtitle: t.lead_name ? `🏢 Cliente: ${t.lead_name}` : undefined,
                    badge: p?.label || s?.label,
                    badgeColor: p?.color || s?.color || 'bg-slate-100 text-slate-600 border-slate-200',
                    secondaryBadge: p && s ? s.label : undefined,
                    secondaryBadgeColor: s?.color,
                  };
                })}
              />
            </div>

            {/* Notas y Entregables del Día */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                ¿Qué hiciste hoy? (Entregables y Solución)
              </label>
              <textarea
                rows={3}
                disabled={isFormDisabled}
                placeholder="Describe brevemente tus avances técnicos, llamadas o tareas concluidas hoy..."
                value={workSummary}
                onChange={(e) => setWorkSummary(e.target.value)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder:text-slate-400 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </div>

            {/* Botón de Envío o Indicador de Bloqueo */}
            {isFormDisabled ? (
              <div className="w-full py-2.5 px-4 bg-slate-100 border border-slate-200 text-slate-400 font-bold rounded-xl text-xs flex items-center justify-center gap-2 select-none cursor-not-allowed shadow-2xs">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                {selectedDayEntry?.status === 'approved' || selectedDayEntry?.status === 'paid'
                  ? 'Jornada Aprobada — Registro Bloqueado'
                  : 'Jornada Enviada — Edición Bloqueada en Revisión'}
              </div>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className={`w-full py-2.5 px-4 font-bold rounded-xl text-xs shadow-md flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer text-white ${
                  adminOverrideUnlocked
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
                    : selectedDayEntry?.status === 'rejected'
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
                }`}
              >
                {adminOverrideUnlocked ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {submitting ? 'Guardando...' : 'Guardar Modificación como Administrador'}
                  </>
                ) : selectedDayEntry?.status === 'rejected' ? (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    {submitting ? 'Enviando...' : 'Corregir y Reenviar Reporte'}
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    {submitting ? 'Guardando...' : selectedDayEntry ? 'Actualizar Reporte del Día' : 'Enviar Reporte de Jornada'}
                  </>
                )}
              </button>
            )}
          </form>
        </div>

        {/* COLUMNA DERECHA: HISTORIAL Y ESTADO DE APROBACIONES */}
        <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900">Historial de Jornadas</h2>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {displayedEntries.length}
              </span>
            </div>

            {/* Filtros rápidos de historial */}
            <div className="inline-flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFilterTab('week')}
                className={`px-2.5 py-1 rounded-md transition ${
                  filterTab === 'week' ? 'bg-white text-indigo-700 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Esta Semana
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('pending')}
                className={`px-2.5 py-1 rounded-md transition ${
                  filterTab === 'pending' ? 'bg-white text-indigo-700 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Pendientes
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`px-2.5 py-1 rounded-md transition ${
                  filterTab === 'all' ? 'bg-white text-indigo-700 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Todos
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs space-y-2">
              <Clock className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
              <p>Cargando tus registros...</p>
            </div>
          ) : displayedEntries.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2 border border-dashed border-slate-200 rounded-xl">
              <FileText className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-700">Sin registros para este filtro</p>
              <p className="text-[11px] text-slate-400">Selecciona cualquier día en el calendario de arriba para empezar a registrar.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
              {displayedEntries.map((entry) => {
                const isSelectedInList = entry.work_date === selectedDate;
                return (
                  <div
                    key={entry.id}
                    onClick={() => setSelectedDate(entry.work_date)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                      isSelectedInList
                        ? 'border-indigo-400 bg-indigo-50/30 shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          📅 {new Date(entry.work_date + 'T00:00:00').toLocaleDateString('es-ES', { 
                            weekday: 'short', 
                            day: 'numeric', 
                            month: 'short' 
                          })}
                        </span>

                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {entry.regular_hours}h reg.
                        </span>

                        {entry.overtime_hours > 0 && (
                          <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            +{entry.overtime_hours}h Extra
                            {(entry.overtime_start_time && entry.overtime_end_time) && (
                              <span className="text-[10px] text-amber-700 font-semibold ml-1">
                                ({entry.overtime_start_time} a {entry.overtime_end_time})
                              </span>
                            )}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {getStatusBadge(entry.status)}

                        {/* Botón Eliminar Registro (Admin o si está enviado/rechazado) */}
                        {(isAdmin || entry.status === 'submitted' || entry.status === 'rejected') && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDelete(entry);
                            }}
                            title="Eliminar este registro"
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Resumen de entregables */}
                    <p className="text-xs text-slate-700 leading-snug line-clamp-2">
                      {entry.work_summary}
                    </p>

                    {/* Justificación de horas extras */}
                    {entry.overtime_hours > 0 && entry.overtime_reason && (
                      <div className="bg-amber-50/70 border border-amber-200/70 rounded-lg p-2 text-[11px] text-amber-900 space-y-0.5">
                        <span className="font-bold block">Justificación overtime:</span>
                        <p className="italic">"{entry.overtime_reason}"</p>
                      </div>
                    )}

                    {/* Motivo de rechazo si aplica */}
                    {entry.status === 'rejected' && entry.rejection_reason && (
                      <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 text-[11px] text-rose-900 space-y-0.5">
                        <span className="font-bold flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" /> Motivo del rechazo de horas extras:
                        </span>
                        <p className="italic">{entry.rejection_reason}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Modal de Confirmación de Eliminación de Jornada */}
      {deleteModalOpen && selectedEntryToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-rose-100 animate-scaleUp">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Eliminar Registro de Jornada</h3>
                <p className="text-xs text-slate-500">Esta acción no se puede deshacer</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs space-y-1.5 text-slate-700">
              <p><strong>Fecha:</strong> {selectedEntryToDelete.work_date}</p>
              <p><strong>Horas:</strong> {selectedEntryToDelete.regular_hours}h regulares + {selectedEntryToDelete.overtime_hours}h extras</p>
              {selectedEntryToDelete.work_summary && (
                <p><strong>Entregables:</strong> {selectedEntryToDelete.work_summary}</p>
              )}
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              ¿Estás seguro de que deseas eliminar este registro? Se borrará de tu historial y se restará del cálculo de horas de la nómina.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deletingTimesheet}
                onClick={() => {
                  setDeleteModalOpen(false);
                  setSelectedEntryToDelete(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingTimesheet}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deletingTimesheet ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Sí, eliminar definitivamente
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
