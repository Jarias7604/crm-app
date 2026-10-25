import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { timesheetsService } from '../../services/timesheetsService';
import type { 
  TimesheetEntry, 
  PayrollMemberConfig, 
  PayrollCalculationItem,
  PayrollCountry,
  ContractType,
  PaymentFrequency,
  CustomDeductionRule
} from '../../types/timesheets';
import { supabase } from '../../services/supabase';
import Switch from '../../components/ui/Switch';
import { CustomSelect, type SelectOption } from '../../components/ui/CustomSelect';
import { CustomDatePicker } from '../../components/ui/CustomDatePicker';
import { 
  Clock, CheckCircle2, XCircle, AlertTriangle, DollarSign, 
  Users, Settings2, Calculator, ShieldCheck, Filter, Download,
  ChevronLeft, ChevronRight, Search, Plus, Trash2, Edit3, Eye, FileText,
  Printer, ArrowUpRight, Check, Sparkles, Building2, Calendar, RefreshCw,
  FileCheck2, Award, Briefcase, Zap, Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { numberToWordsSpanish } from '../../utils/numberToWords';

export default function PayrollManager() {
  const { profile, simulatedCompanyId } = useAuth();
  const activeCompanyId = simulatedCompanyId || profile?.company_id;

  // Active Main View Tab
  const [activeTab, setActiveTab] = useState<'payroll' | 'approvals' | 'settings'>('payroll');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [countryFilter, setCountryFilter] = useState<'ALL' | PayrollCountry>('ALL');

  // Period Date Range (ADP / QuickBooks Quincenal standard)
  const today = new Date();
  const isFirstHalf = today.getDate() <= 15;
  const initialStart = new Date(today.getFullYear(), today.getMonth(), isFirstHalf ? 1 : 16)
    .toISOString().split('T')[0];
  const initialEnd = new Date(today.getFullYear(), today.getMonth(), isFirstHalf ? 15 : new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate())
    .toISOString().split('T')[0];

  const [startDate, setStartDate] = useState<string>(initialStart);
  const [endDate, setEndDate] = useState<string>(initialEnd);

  // Data States
  const [pendingApprovals, setPendingApprovals] = useState<TimesheetEntry[]>([]);
  const [payrollSummary, setPayrollSummary] = useState<{
    items: PayrollCalculationItem[];
    totalGross: number;
    totalDeductions: number;
    totalNet: number;
  }>({ items: [], totalGross: 0, totalDeductions: 0, totalNet: 0 });

  const [memberConfigs, setMemberConfigs] = useState<PayrollMemberConfig[]>([]);
  const [teamProfiles, setTeamProfiles] = useState<{ id: string; full_name: string; email: string; avatar_url?: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [companyInfo, setCompanyInfo] = useState<{ 
    name?: string;
    tax_id?: string;
    rnc?: string;
    direccion?: string;
    address?: string;
    phone?: string;
    telefono?: string;
    email?: string;
    logo_url?: string;
    country?: string;
  } | null>(null);

  // Pay Stub (Recibo de Pago) Drawer / Modal
  const [selectedPayStub, setSelectedPayStub] = useState<PayrollCalculationItem | null>(null);

  // Rejection Modal
  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);
  const [selectedEntryToReject, setSelectedEntryToReject] = useState<TimesheetEntry | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>('');

  // Delete Timesheet Modal (Hard Delete exclusivo de Administrador)
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [selectedEntryToDelete, setSelectedEntryToDelete] = useState<TimesheetEntry | null>(null);
  const [deletingTimesheet, setDeletingTimesheet] = useState<boolean>(false);
  const [approvalsFilter, setApprovalsFilter] = useState<'all' | 'overtime'>('all');

  // Config Member Edit Modal (Ficha Técnica de Empleado)
  const [editingConfig, setEditingConfig] = useState<PayrollMemberConfig | null>(null);
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [editModalTab, setEditModalTab] = useState<'salary' | 'incentives' | 'taxes'>('salary');

  // Period Adjustments Modal (Bonos y Comisiones del Período)
  const [periodAdjustments, setPeriodAdjustments] = useState<Record<string, { kpiBonus?: number; commissionAmount?: number; commissionNotes?: string }>>({});
  const [adjustModalOpen, setAdjustModalOpen] = useState<boolean>(false);
  const [adjustingItem, setAdjustingItem] = useState<PayrollCalculationItem | null>(null);
  const [adjKpiBonus, setAdjKpiBonus] = useState<number>(0);
  const [adjCommissionAmount, setAdjCommissionAmount] = useState<number>(0);
  const [adjCommissionNotes, setAdjCommissionNotes] = useState<string>('');

  useEffect(() => {
    if (activeCompanyId) {
      loadAllData();
      loadCompanyInfo();
    }
  }, [activeCompanyId, startDate, endDate]);

  const loadCompanyInfo = async () => {
    if (!activeCompanyId) return;
    try {
      const { data } = await supabase
        .from('companies')
        .select('name, tax_id, rnc, direccion, address, phone, telefono, email, logo_url, country')
        .eq('id', activeCompanyId)
        .single();
      if (data) setCompanyInfo(data);
    } catch { /* silent */ }
  };

  const loadAllData = async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    try {
      // 1. Cargar perfiles de equipo
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .eq('company_id', activeCompanyId);
      if (profs) setTeamProfiles(profs);

      // 2. Cargar solicitudes pendientes de aprobación
      const allTimesheets = await timesheetsService.getTimesheets({
        companyId: activeCompanyId,
        status: 'submitted',
      });
      setPendingApprovals(allTimesheets);

      // 3. Cargar cálculo de planilla
      const calc = await timesheetsService.calculatePayrollRun({
        companyId: activeCompanyId,
        startDate,
        endDate,
        periodAdjustments,
      });
      setPayrollSummary(calc);

      // 4. Cargar configuraciones de miembros
      const configs = await timesheetsService.getPayrollConfigs(activeCompanyId);
      setMemberConfigs(configs);
    } catch (err) {
      console.error('Error loading payroll data:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Navegación rápida de quincenas (ADP / QuickBooks style) ────

  const handleNavigatePeriod = (direction: 'prev' | 'next') => {
    const curStart = new Date(startDate + 'T00:00:00');
    let nextStart: Date;
    let nextEnd: Date;

    if (direction === 'prev') {
      if (curStart.getDate() > 15) {
        // Pasar a la 1a quincena del mismo mes
        nextStart = new Date(curStart.getFullYear(), curStart.getMonth(), 1);
        nextEnd = new Date(curStart.getFullYear(), curStart.getMonth(), 15);
      } else {
        // Pasar a la 2a quincena del mes anterior
        const prevMonth = curStart.getMonth() - 1;
        const year = curStart.getFullYear();
        const lastDayPrev = new Date(year, prevMonth + 1, 0).getDate();
        nextStart = new Date(year, prevMonth, 16);
        nextEnd = new Date(year, prevMonth, lastDayPrev);
      }
    } else {
      if (curStart.getDate() <= 15) {
        // Pasar a la 2a quincena del mismo mes
        const lastDay = new Date(curStart.getFullYear(), curStart.getMonth() + 1, 0).getDate();
        nextStart = new Date(curStart.getFullYear(), curStart.getMonth(), 16);
        nextEnd = new Date(curStart.getFullYear(), curStart.getMonth(), lastDay);
      } else {
        // Pasar a la 1a quincena del mes siguiente
        nextStart = new Date(curStart.getFullYear(), curStart.getMonth() + 1, 1);
        nextEnd = new Date(curStart.getFullYear(), curStart.getMonth() + 1, 15);
      }
    }

    setStartDate(nextStart.toISOString().split('T')[0]);
    setEndDate(nextEnd.toISOString().split('T')[0]);
  };

  // ── Aprobación y Rechazo de Overtime ───────────────────────────

  const handleApprove = async (entry: TimesheetEntry) => {
    if (!profile?.id) return;
    const res = await timesheetsService.approveTimesheet(entry.id, profile.id);
    if (res.success) {
      toast.success(`Horas extras de ${entry.user_name} aprobadas (+${entry.overtime_hours}h)`);
      await loadAllData();
    } else {
      toast.error('Error al aprobar: ' + res.error);
    }
  };

  const handleOpenReject = (entry: TimesheetEntry) => {
    setSelectedEntryToReject(entry);
    setRejectionReasonInput('Horas extras no autorizadas previamente.');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedEntryToReject || !profile?.id) return;
    const res = await timesheetsService.rejectTimesheet(
      selectedEntryToReject.id, 
      profile.id, 
      rejectionReasonInput
    );
    if (res.success) {
      toast.success('Horas extras rechazadas. Quedan excluidas de la nómina.');
      setRejectModalOpen(false);
      setSelectedEntryToReject(null);
      await loadAllData();
    } else {
      toast.error('Error al rechazar: ' + res.error);
    }
  };

  // ── Eliminación Permanente de Registros (Hard Delete para Admin) ──

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
        toast.success(`Registro de jornada de ${selectedEntryToDelete.user_name} eliminado permanentemente.`);
        setDeleteModalOpen(false);
        setSelectedEntryToDelete(null);
        await loadAllData();
      } else {
        toast.error('Error al eliminar registro: ' + (res.error || 'No se pudo eliminar de la base de datos'));
      }
    } catch (err: any) {
      toast.error('Error inesperado: ' + err.message);
    } finally {
      setDeletingTimesheet(false);
    }
  };

  // ── Configuración de Ficha de Empleado (Parámetros Salariales) ──

  const handleOpenEditConfig = (member: { id: string; full_name: string; email: string }) => {
    const existing = memberConfigs.find(c => c.user_id === member.id);
    if (existing) {
      setEditingConfig({ 
        ...existing,
        user_name: member.full_name || existing.user_name,
        user_email: member.email || existing.user_email,
        employee_code: existing.employee_code || ('EMP-' + member.id.slice(0, 4).toUpperCase()),
        hire_date: existing.hire_date || '',
        payment_frequency: existing.payment_frequency || 'quincenal',
        contract_type: existing.contract_type || 'services_sv',
        base_salary: Number(existing.base_salary || 0),
        hourly_rate: Number(existing.hourly_rate || 0),
        expected_weekly_hours: Number(existing.expected_weekly_hours || 44.0),
        applies_overtime: existing.applies_overtime ?? true,
        overtime_multiplier: Number(existing.overtime_multiplier || 1.5),
        commission_mode: existing.commission_mode || 'manual',
        commission_rate: Number(existing.commission_rate || 0),
        bonus_kpi_default: Number(existing.bonus_kpi_default || 0),
        country: existing.country || 'SV',
        apply_isss: existing.apply_isss ?? (existing.contract_type === 'salary'),
        apply_afp: existing.apply_afp ?? (existing.contract_type === 'salary'),
        apply_renta: existing.apply_renta ?? true,
        renta_mode: existing.renta_mode || 'percentage',
        renta_percentage: existing.renta_percentage !== undefined ? existing.renta_percentage : 10.0,
        isss_percentage: existing.isss_percentage !== undefined ? existing.isss_percentage : 3.0,
        afp_percentage: existing.afp_percentage !== undefined ? existing.afp_percentage : 7.25,
        custom_deductions: Array.isArray(existing.custom_deductions) ? existing.custom_deductions : [],
      });
    } else {
      setEditingConfig({
        company_id: activeCompanyId!,
        user_id: member.id,
        user_name: member.full_name,
        user_email: member.email,
        employee_code: 'EMP-' + member.id.slice(0, 4).toUpperCase(),
        hire_date: new Date().toISOString().split('T')[0],
        payment_frequency: 'quincenal',
        contract_type: 'services_sv',
        base_salary: 800,
        hourly_rate: 0,
        expected_weekly_hours: 44.0,
        applies_overtime: true,
        overtime_multiplier: 1.5,
        commission_mode: 'manual',
        commission_rate: 0,
        bonus_kpi_default: 0,
        country: 'SV',
        apply_isss: false,
        apply_afp: false,
        apply_renta: true,
        renta_mode: 'percentage',
        renta_percentage: 10.0,
        isss_percentage: 3.0,
        afp_percentage: 7.25,
        custom_deductions: [],
      });
    }
    setEditModalTab('salary');
    setEditModalOpen(true);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConfig) return;
    const res = await timesheetsService.upsertPayrollConfig(editingConfig);
    if (res.success) {
      toast.success('Ficha técnica salarial actualizada correctamente.');
      setEditModalOpen(false);
      await loadAllData();
    } else {
      toast.error('Error al guardar: ' + res.error);
    }
  };

  // ── Ajuste de Bonos y Comisiones del Período ───────────────────

  const handleOpenAdjustModal = (item: PayrollCalculationItem) => {
    setAdjustingItem(item);
    const existing = periodAdjustments[item.user_id];
    setAdjKpiBonus(existing?.kpiBonus !== undefined ? existing.kpiBonus : item.kpi_bonus);
    setAdjCommissionAmount(existing?.commissionAmount !== undefined ? existing.commissionAmount : item.commission_amount);
    setAdjCommissionNotes(existing?.commissionNotes || item.commission_notes || '');
    setAdjustModalOpen(true);
  };

  const handleSaveAdjustModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem || !activeCompanyId) return;
    const updated = {
      ...periodAdjustments,
      [adjustingItem.user_id]: {
        kpiBonus: Number(adjKpiBonus),
        commissionAmount: Number(adjCommissionAmount),
        commissionNotes: adjCommissionNotes.trim() || undefined,
      }
    };
    setPeriodAdjustments(updated);
    setAdjustModalOpen(false);
    
    // Recalcular instantáneamente
    const calc = await timesheetsService.calculatePayrollRun({
      companyId: activeCompanyId,
      startDate,
      endDate,
      periodAdjustments: updated,
    });
    setPayrollSummary(calc);
    toast.success(`Bonos y comisiones actualizados para ${adjustingItem.user_name}.`);
  };

  // Filtrado de Colaboradores
  const filteredItems = useMemo(() => {
    return payrollSummary.items.filter(item => {
      const matchSearch = item.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.user_email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCountry = countryFilter === 'ALL' || item.country === countryFilter;
      return matchSearch && matchCountry;
    });
  }, [payrollSummary.items, searchTerm, countryFilter]);

  // Filtro de solicitudes en Bandeja de Aprobaciones
  const filteredApprovals = useMemo(() => {
    if (approvalsFilter === 'overtime') {
      return pendingApprovals.filter(t => t.overtime_hours > 0);
    }
    return pendingApprovals;
  }, [pendingApprovals, approvalsFilter]);

  const pendingOvertimeCount = useMemo(() => {
    return pendingApprovals.filter(t => t.overtime_hours > 0).length;
  }, [pendingApprovals]);

  // Formato de Período Legible
  const periodLabel = useMemo(() => {
    try {
      const d1 = new Date(startDate + 'T00:00:00');
      const d2 = new Date(endDate + 'T00:00:00');
      return `${d1.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} – ${d2.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    } catch {
      return `${startDate} – ${endDate}`;
    }
  }, [startDate, endDate]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-5 animate-fadeIn font-sans text-slate-800">
      
      {/* ── 1. HEADER COMPACTO ESTILO ADP / QUICKBOOKS ─────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
              <Calculator className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Nómina & Control de Overtime
            </h1>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Activo
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Cálculo dinámico de retenciones fiscales y aprobación estricta de horas extras.
          </p>
        </div>

        {/* Tab Selector Minimalista (QuickBooks style) */}
        <div className="inline-flex bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 self-start sm:self-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('payroll')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'payroll'
                ? 'bg-white text-indigo-700 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Planilla
          </button>

          <button
            onClick={() => setActiveTab('approvals')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'approvals'
                ? 'bg-white text-indigo-700 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Horas Extras
            {pendingApprovals.length > 0 && (
              <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {pendingApprovals.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'bg-white text-indigo-700 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            Tarifas
          </button>
        </div>
      </div>

      {/* ── 2. BARRA DE CONTROL DEL PERÍODO (ADP WORKFORCE STYLE) ──── */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Selector de Fecha Quincenal Rápido */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleNavigatePeriod('prev')}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition border border-slate-200/60"
            title="Quincena anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200/80 text-xs font-bold text-slate-800">
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            <span>{periodLabel}</span>
          </div>

          <button
            onClick={() => handleNavigatePeriod('next')}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition border border-slate-200/60"
            title="Quincena siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Fechas personalizadas con CustomDatePicker moderno */}
          <div className="hidden lg:flex items-center gap-2 ml-3 pl-3 border-l border-slate-200 text-xs text-slate-500">
            <span className="font-semibold text-slate-600">Desde:</span>
            <CustomDatePicker
              value={startDate}
              onChange={setStartDate}
              variant="white"
              className="w-32"
            />
            <span className="font-semibold text-slate-600">Hasta:</span>
            <CustomDatePicker
              value={endDate}
              onChange={setEndDate}
              variant="white"
              className="w-32"
            />
          </div>

          <button
            onClick={loadAllData}
            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition ml-1"
            title="Recalcular período"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>

        {/* Búsqueda y Filtro de País */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Buscar colaborador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 w-48 sm:w-56"
            />
          </div>

          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value as any)}
            className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="ALL">Todos los países</option>
            <option value="SV">🇸🇻 El Salvador</option>
            <option value="US">🇺🇸 USA</option>
            <option value="OTHER">🌎 LATAM</option>
          </select>
        </div>
      </div>

      {/* ── 3. METRIC STRIP (ESTILO QUICKBOOKS / ADP EXECUTIVE) ─────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Neto */}
        <div className="bg-white border border-emerald-200/90 rounded-xl p-3.5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Neto a Transferir
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 tracking-tight mt-1">
            ${payrollSummary.totalNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">
            Monto líquido disponible para pago
          </span>
        </div>

        {/* Total Bruto */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Total Bruto Devengado
          </span>
          <p className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            ${payrollSummary.totalGross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">
            Salario base + Overtime aprobado
          </span>
        </div>

        {/* Retenciones */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-xs">
          <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block">
            Retenciones Fiscales
          </span>
          <p className="text-2xl font-bold text-rose-600 tracking-tight mt-1">
            -${payrollSummary.totalDeductions.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">
            Renta directa, ISSS, AFP y deducciones
          </span>
        </div>

        {/* Overtime Queue */}
        <div 
          onClick={() => setActiveTab('approvals')}
          className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-xs cursor-pointer hover:border-amber-300 transition"
          title="Ver bandeja de aprobaciones y solicitudes pendientes"
        >
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
            Horas Extras en Cola
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-bold text-amber-900 tracking-tight">
              {pendingApprovals.length}
            </p>
            <span className="text-xs font-semibold text-slate-400">solicitudes</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">
            {pendingApprovals.length === 0 ? 'Sin solicitudes pendientes' : 'Requiere tu autorización'}
          </span>
        </div>
      </div>

      {/* ── 4. TAB 1: PLANILLA DE PAGO (QUICKBOOKS / GUSTO STYLE) ───── */}
      {activeTab === 'payroll' && (
        <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Desglose Individual de Nómina
              </h2>
              <span className="text-[11px] text-slate-500 font-semibold bg-white px-2 py-0.5 rounded border border-slate-200">
                {filteredItems.length} colaboradores
              </span>
            </div>
            
            <button
              onClick={() => {
                // Export simple CSV
                const headers = ['Colaborador,Email,Pais,Modalidad,Horas_Reg,Horas_Ext,Bruto,ISSS,AFP,Renta,Neto\n'];
                const rows = filteredItems.map(i => 
                  `"${i.user_name}","${i.user_email}","${i.country}","${i.contract_type}",${i.regular_hours},${i.overtime_hours},${i.gross_pay},${i.isss},${i.afp},${i.renta},${i.net_pay}`
                ).join('\n');
                const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Nomina_${startDate}_al_${endDate}.csv`;
                a.click();
                toast.success('Reporte CSV descargado');
              }}
              className="text-xs font-semibold text-slate-600 hover:text-indigo-600 flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">Colaborador</th>
                  <th className="py-2.5 px-3">Modalidad</th>
                  <th className="py-2.5 px-3 text-center">Jornada (Horas)</th>
                  <th className="py-2.5 px-3 text-right">Base Pactada</th>
                  <th className="py-2.5 px-3 text-right">Salario Devengado</th>
                  <th className="py-2.5 px-3 text-center">Overtime</th>
                  <th className="py-2.5 px-3 text-right">Bonos KPI</th>
                  <th className="py-2.5 px-3 text-right">Comisiones</th>
                  <th className="py-2.5 px-3 text-right">Total Bruto</th>
                  <th className="py-2.5 px-3 text-right text-rose-600">Retenciones</th>
                  <th className="py-2.5 px-4 text-right font-bold text-emerald-800">Neto a Pagar</th>
                  <th className="py-2.5 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-400">
                      <Clock className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                      Calculando nómina en tiempo real...
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-400">
                      No se encontraron colaboradores para este período o filtro.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const totalDeductionsItem = item.isss + item.afp + item.renta + item.other_deductions;
                    const isFixed = ['salary', 'services_sv', 'services'].includes(item.contract_type);

                    return (
                      <tr key={item.user_id} className="hover:bg-slate-50/80 transition-colors group">
                        {/* Colaborador */}
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                              {item.user_name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 leading-tight">{item.user_name}</span>
                                {item.employee_code && (
                                  <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-600 px-1 rounded border border-slate-200">
                                    {item.employee_code}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-normal leading-tight">{item.user_email}</span>
                            </div>
                          </div>
                        </td>

                        {/* Modalidad y Frecuencia */}
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100/90 px-2 py-0.5 rounded text-[10px] border border-slate-200/60">
                            {item.contract_type === 'services_sv' || item.contract_type === 'services' 
                              ? 'Servicios Prof.' 
                              : item.contract_type === 'salary' 
                              ? 'Planilla Fija' 
                              : 'Por Horas'}
                            <span className="text-slate-400">•</span>
                            <span className="capitalize">{item.payment_frequency}</span>
                          </span>
                        </td>

                        {/* Jornada (Horas Trabajadas vs Esperadas) */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-slate-800">
                              {item.regular_hours}h <span className="text-slate-400 font-normal">/ {item.expected_period_hours}h</span>
                            </span>
                            {item.hours_deficit > 0 ? (
                              <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1 rounded border border-amber-200 mt-0.5">
                                -{item.hours_deficit}h falta
                              </span>
                            ) : item.regular_hours >= item.expected_period_hours && item.expected_period_hours > 0 ? (
                              <span className="text-[9px] font-bold text-emerald-700 mt-0.5">
                                ✓ Completa
                              </span>
                            ) : null}
                          </div>
                        </td>

                        {/* Base Pactada */}
                        <td className="py-2.5 px-3 text-right text-slate-600 font-medium">
                          {isFixed ? (
                            `$${item.base_salary_part.toFixed(2)}`
                          ) : (
                            `$${item.hourly_rate.toFixed(2)}/h`
                          )}
                        </td>

                        {/* Salario Ordinario Devengado */}
                        <td className="py-2.5 px-3 text-right font-medium text-slate-900">
                          <div>
                            <span className="font-bold">${item.regular_pay.toFixed(2)}</span>
                            {item.hours_deficit_deduction > 0 && (
                              <span className="block text-[9px] text-rose-600 font-medium" title="Descuento por horas faltantes">
                                (-${item.hours_deficit_deduction.toFixed(2)})
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Overtime */}
                        <td className="py-2.5 px-3 text-center">
                          {!item.applies_overtime ? (
                            <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-1.5 py-0.5 rounded">
                              No Aplica
                            </span>
                          ) : item.overtime_hours > 0 ? (
                            <div>
                              <span className="inline-flex items-center gap-0.5 font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[11px]">
                                <Sparkles className="w-3 h-3 text-amber-500" />
                                +{item.overtime_hours}h (${item.overtime_pay.toFixed(2)})
                              </span>
                              {item.pending_overtime_count > 0 && (
                                <span className="block text-[9px] text-amber-600 font-semibold mt-0.5" title="Horas extras sin autorizar">
                                  ({item.pending_overtime_count}h pend.)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Bonos KPI */}
                        <td className="py-2.5 px-3 text-right">
                          {item.kpi_bonus > 0 ? (
                            <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                              +${item.kpi_bonus.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Comisiones */}
                        <td className="py-2.5 px-3 text-right">
                          {item.commission_amount > 0 ? (
                            <div>
                              <span className="font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                +${item.commission_amount.toFixed(2)}
                              </span>
                              {item.commission_notes && (
                                <span className="block text-[9px] text-slate-400 truncate max-w-[100px] ml-auto">
                                  {item.commission_notes}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Total Bruto */}
                        <td className="py-2.5 px-3 text-right font-black text-slate-900">
                          ${item.gross_pay.toFixed(2)}
                        </td>

                        {/* Retenciones Fiscales y de Ley */}
                        <td className="py-2.5 px-3 text-right font-medium text-rose-700">
                          {totalDeductionsItem > 0 ? `-$${totalDeductionsItem.toFixed(2)}` : '—'}
                        </td>

                        {/* Neto a Pagar */}
                        <td className="py-2.5 px-4 text-right">
                          <span className="inline-flex items-center gap-1 font-black text-emerald-800 text-sm">
                            ${item.net_pay.toFixed(2)}
                          </span>
                        </td>

                        {/* Acciones */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              id={`btn-adjust-${item.user_id}`}
                              aria-label="Ajustar bonos y comisiones"
                              onClick={() => handleOpenAdjustModal(item)}
                              className="p-1 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded transition cursor-pointer"
                              title="Ajustar Bonos de KPIs y Comisiones del Período"
                            >
                              <Award className="w-4 h-4" />
                            </button>
                            <button
                              id={`btn-payslip-${item.user_id}`}
                              aria-label="Ver boleta de pago"
                              onClick={() => setSelectedPayStub(item)}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition cursor-pointer"
                              title="Ver boleta oficial de pago / pay stub"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            <button
                              id={`btn-edit-config-${item.user_id}`}
                              aria-label="Editar ficha salarial"
                              onClick={() => handleOpenEditConfig({ id: item.user_id, full_name: item.user_name, email: item.user_email })}
                              className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition cursor-pointer"
                              title="Configurar Ficha de Empleado"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 5. TAB 2: BANDEJA DE APROBACIONES Y HORAS EXTRAS ─────────── */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Bandeja de Aprobación de Jornadas y Horas Extras</h3>
              <p className="text-xs text-slate-500">
                Revisa, aprueba, rechaza o elimina registros de jornada antes de procesar el pago de nómina.
              </p>
            </div>

            <div className="inline-flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setApprovalsFilter('all')}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${
                  approvalsFilter === 'all'
                    ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todas ({pendingApprovals.length})
              </button>
              <button
                type="button"
                onClick={() => setApprovalsFilter('overtime')}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${
                  approvalsFilter === 'overtime'
                    ? 'bg-white text-indigo-700 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Solo Horas Extras ({pendingOvertimeCount})
              </button>
            </div>
          </div>

          <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl p-3 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold text-amber-900 block">Bandeja de Autorización y Control Contable</span>
              <p className="text-amber-800 text-[11px] mt-0.5">
                Las horas extras no aprobadas aquí se excluyen automáticamente de la nómina. Como Administrador, también puedes eliminar registros de prueba o erróneos con el botón 🗑️.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs">
              <Clock className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
              Cargando solicitudes...
            </div>
          ) : filteredApprovals.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-xl p-8 text-center space-y-1.5">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="font-bold text-slate-800 text-sm">Bandeja al día</p>
              <p className="text-xs text-slate-400">
                {approvalsFilter === 'overtime' 
                  ? 'No hay horas extras pendientes de aprobación.' 
                  : 'No hay solicitudes de jornada pendientes de revisión.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredApprovals.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-100">
                        {entry.user_name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{entry.user_name}</h4>
                        <span className="text-[10px] text-slate-400 font-medium">
                          📅 {new Date(entry.work_date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {entry.regular_hours}h reg.
                      </span>
                      {entry.overtime_hours > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          +{entry.overtime_hours}h extra
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-500 border border-slate-200">
                          Sin overtime
                        </span>
                      )}
                    </div>
                  </div>

                  {entry.overtime_hours > 0 && (
                    <div className="bg-slate-50 border border-slate-200/70 rounded-lg p-2.5 text-xs text-slate-800 space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Motivo del tiempo extra:
                      </span>
                      <p className="italic text-slate-700 leading-snug">"{entry.overtime_reason || 'Sin justificación'}"</p>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-500 leading-snug">
                    <strong className="text-slate-700">Entregables:</strong> {entry.work_summary || 'Sin descripción'}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleApprove(entry)}
                      className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {entry.overtime_hours > 0 ? 'Aprobar Overtime' : 'Aprobar Jornada'}
                    </button>
                    <button
                      onClick={() => handleOpenReject(entry)}
                      className="py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      Rechazar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenDelete(entry)}
                      title="Eliminar permanentemente este registro de la base de datos (Admin)"
                      className="p-1.5 bg-slate-50 hover:bg-rose-100 text-slate-400 hover:text-rose-700 border border-slate-200 hover:border-rose-300 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 6. TAB 3: CONFIGURACIÓN DE FICHAS DE EMPLEADO (GUSTO / QUICKBOOKS STYLE) ──── */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Fichas Técnicas y Salariales de Colaboradores</h3>
              <p className="text-xs text-slate-500">
                Parámetros contractuales, códigos de empleado, salarios pactados, horas semanales y reglas de horas extras.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {teamProfiles.map((member) => {
              const cfg = memberConfigs.find(c => c.user_id === member.id);
              const isFixed = ['salary', 'services_sv', 'services'].includes(cfg?.contract_type || '');
              const weeklyHours = cfg?.expected_weekly_hours || 44.0;
              const periodHours = cfg?.payment_frequency === 'mensual' 
                ? weeklyHours * 4 
                : cfg?.payment_frequency === 'quincenal' 
                ? weeklyHours * 2 
                : weeklyHours;
              const hourlyEquiv = isFixed && periodHours > 0 && (cfg?.base_salary || 0) > 0
                ? ((cfg?.base_salary || 0) / periodHours).toFixed(2)
                : (cfg?.hourly_rate || 0).toFixed(2);

              return (
                <div
                  key={member.id}
                  className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3.5 hover:border-indigo-300 transition-all"
                >
                  <div className="space-y-2.5">
                    {/* Cabecera con Avatar, Código y Nombre */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                          {member.full_name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-bold text-slate-900 leading-tight">{member.full_name || 'Sin nombre'}</h4>
                            <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200">
                              {cfg?.employee_code || ('EMP-' + member.id.slice(0, 4).toUpperCase())}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-normal leading-tight block">{member.email}</span>
                        </div>
                      </div>

                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full capitalize">
                        {cfg?.payment_frequency || 'quincenal'}
                      </span>
                    </div>

                    {/* Detalle Salarial y Contractual */}
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 space-y-1.5 text-[11px] text-slate-600">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Contrato:</span>
                        <strong className="text-slate-800 font-semibold">
                          {cfg?.contract_type === 'services_sv' || cfg?.contract_type === 'services' 
                            ? '💼 Servicios Profesionales' 
                            : cfg?.contract_type === 'salary' 
                            ? '🏢 Planilla Fija (Asalariado)' 
                            : '⏱️ Por Horas'}
                        </strong>
                      </div>

                      {cfg?.hire_date && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Fecha Ingreso:</span>
                          <strong className="text-slate-700 font-medium">{cfg.hire_date}</strong>
                        </div>
                      )}

                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Sueldo Base Pactado:</span>
                        <strong className="text-slate-900 font-bold text-xs">
                          {isFixed 
                            ? `$${(cfg?.base_salary || 0).toFixed(2)} / ${cfg?.payment_frequency || 'período'}` 
                            : `$${(cfg?.hourly_rate || 0).toFixed(2)}/h`}
                        </strong>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Jornada Pactada:</span>
                        <strong className="text-slate-700 font-medium">
                          {weeklyHours}h/sem ({periodHours}h {cfg?.payment_frequency || 'período'})
                        </strong>
                      </div>

                      <div className="flex justify-between items-center border-t border-slate-200/60 pt-1">
                        <span className="text-slate-500">Tarifa Hora Equivalente:</span>
                        <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded text-[10px]">
                          ${hourlyEquiv}/h
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">¿Aplica Horas Extras?:</span>
                        {cfg?.applies_overtime ? (
                          <span className="font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded text-[10px]">
                            Sí ({cfg.overtime_multiplier || 1.5}x)
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium text-[10px]">
                            No aplica
                          </span>
                        )}
                      </div>

                      {(cfg?.bonus_kpi_default || 0) > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Bono KPI Base:</span>
                          <strong className="text-indigo-700 font-bold">+${cfg?.bonus_kpi_default}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenEditConfig(member)}
                    className="w-full py-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border border-transparent hover:border-indigo-200"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Editar Ficha de Empleado
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 7. COMPROBANTE OFICIAL DE PAGO (FORMATO CORPORATIVO INSTITUCIONAL / ADP / SAP) ── */}
      {selectedPayStub && (() => {
        const cfg = memberConfigs.find(c => c.user_id === selectedPayStub.user_id);
        const companyLegalName = (companyInfo?.name || 'ARIAS DEFENSE TESTING, S.A. DE C.V.').toUpperCase();
        const taxId = companyInfo?.tax_id || companyInfo?.rnc || '0614-280391-102-1';
        const address = companyInfo?.direccion || companyInfo?.address || 'San Salvador, El Salvador, C.A.';
        const contact = companyInfo?.email || 'rrhh@ariasdefensetesting.com';
        const phone = companyInfo?.phone || companyInfo?.telefono || '+503 2200-0000';
        
        const voucherCode = `NOM-${new Date(startDate).getFullYear()}${String(new Date(startDate).getMonth() + 1).padStart(2, '0')}-${selectedPayStub.user_id.slice(0, 4).toUpperCase()}`;
        const totalDevengado = selectedPayStub.gross_pay;
        const totalDeducciones = selectedPayStub.isss + selectedPayStub.afp + selectedPayStub.renta + selectedPayStub.other_deductions;
        const totalNeto = selectedPayStub.net_pay;
        const legalWords = numberToWordsSpanish(totalNeto, 'DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA');
        const issueDateFormatted = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
        const isSV = selectedPayStub.country === 'SV';

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs overflow-y-auto flex flex-col items-center justify-start p-2 sm:p-6 print:p-0 print:bg-white print:static print:overflow-visible">
            {/* Reglas de Impresión de Alta Precisión (@media print) */}
            <style>{`
              @media print {
                @page {
                  size: letter portrait;
                  margin: 10mm 15mm;
                }
                body {
                  background: #ffffff !important;
                  color: #000000 !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                body * {
                  visibility: hidden !important;
                }
                #printable-payslip, #printable-payslip * {
                  visibility: visible !important;
                }
                #printable-payslip {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  max-width: 100% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  border: none !important;
                  box-shadow: none !important;
                  background: #ffffff !important;
                  font-size: 10pt !important;
                  line-height: 1.3 !important;
                  display: block !important;
                }
                .no-print {
                  display: none !important;
                }
              }
            `}</style>

            {/* Barra de Herramientas Superior (Solo en Pantalla, Oculta en Impresión) */}
            <div className="no-print w-full max-w-[820px] bg-slate-900 text-white rounded-t-xl px-4 py-3 flex items-center justify-between shadow-md mb-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold tracking-wide uppercase text-slate-100">
                    Boleta Oficial de Liquidación de Haberes
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    Constancia tributaria y contable de pago oficial
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir / Guardar PDF</span>
                </button>
                <button
                  onClick={() => setSelectedPayStub(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                  title="Cerrar vista previa"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Documento Físico Oficial (Hoja Carta Formal) */}
            <div
              id="printable-payslip"
              className="w-full max-w-[820px] bg-white border border-slate-300 p-8 sm:p-10 shadow-2xl text-slate-900 font-sans print:shadow-none print:border-none print:p-0 print:max-w-none print:w-full space-y-5"
            >
              {/* ENCABEZADO INSTITUCIONAL DE LA EMPRESA */}
              <div className="border-b-2 border-slate-900 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded bg-slate-900 text-white font-serif font-bold text-lg flex items-center justify-center shrink-0">
                        {companyLegalName.charAt(0)}
                      </div>
                      <div>
                        <h1 className="text-base sm:text-lg font-bold font-serif tracking-tight text-slate-900 leading-tight">
                          {companyLegalName}
                        </h1>
                        <span className="text-[11px] font-semibold text-slate-600 block">
                          DEPARTAMENTO DE GESTIÓN HUMANA Y FINANZAS
                        </span>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 pt-1 space-y-0.5 font-medium leading-tight">
                      <p><strong>NIT / Identificación Fiscal:</strong> {taxId} • <strong>NRC:</strong> 298412-5</p>
                      <p><strong>Dirección:</strong> {address}</p>
                      <p><strong>Contacto:</strong> {contact} • Tel: {phone}</p>
                    </div>
                  </div>

                  <div className="border-2 border-slate-900 p-3 rounded-none bg-slate-50 text-right min-w-[240px] space-y-1 shrink-0">
                    <span className="block text-[10px] font-black tracking-widest text-slate-800 uppercase border-b border-slate-300 pb-1">
                      COMPROBANTE DE PAGO Y LIQUIDACIÓN
                    </span>
                    <p className="text-xs font-mono font-bold text-slate-900">
                      {voucherCode}
                    </p>
                    <div className="text-[10px] text-slate-600 space-y-0.5 pt-0.5">
                      <p><span className="font-semibold">Fecha de Emisión:</span> {issueDateFormatted}</p>
                      <p><span className="font-semibold">Moneda Oficial:</span> Dólares (USD)</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* DATOS DEL COLABORADOR Y CONTRATACIÓN (CUADRÍCULA FORMAL) */}
              <div className="border border-slate-400 text-[11px]">
                <div className="bg-slate-100 border-b border-slate-300 px-3 py-1 font-bold text-[10px] tracking-wider text-slate-700 uppercase">
                  I. INFORMACIÓN GENERAL DEL COLABORADOR
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-300">
                  <div className="p-2.5 space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Nombre del Titular</span>
                    <span className="font-bold text-slate-900 block text-xs">{selectedPayStub.user_name}</span>
                    <span className="text-[10px] text-slate-500 block truncate">{selectedPayStub.user_email}</span>
                  </div>

                  <div className="p-2.5 space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Código de Empleado / ID</span>
                    <span className="font-bold text-slate-900 block text-xs">
                      {selectedPayStub.employee_code || ('EMP-' + selectedPayStub.user_id.slice(0, 4).toUpperCase())}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      Ingreso: {selectedPayStub.hire_date || 'No registrada'}
                    </span>
                  </div>

                  <div className="p-2.5 space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Régimen & Modalidad</span>
                    <span className="font-bold text-slate-900 block text-xs">
                      {selectedPayStub.contract_type === 'services_sv' || selectedPayStub.contract_type === 'services' 
                        ? 'Servicios Profesionales' 
                        : selectedPayStub.contract_type === 'salary' 
                        ? 'Planilla Fija Asalariada' 
                        : 'Por Horas'}
                    </span>
                    <span className="text-[10px] text-slate-600 block">
                      Jornada: {selectedPayStub.expected_period_hours}h pactadas ({cfg?.expected_weekly_hours || 44}h/sem)
                    </span>
                  </div>

                  <div className="p-2.5 space-y-0.5 bg-slate-50/50">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Período Liquidado</span>
                    <span className="font-bold text-indigo-950 block text-xs">{periodLabel}</span>
                    <span className="text-[10px] text-slate-500 block capitalize">Frecuencia: {selectedPayStub.payment_frequency || 'quincenal'}</span>
                  </div>
                </div>
              </div>

              {/* TABLA CONTABLE DE PERCEPCIONES Y DEDUCCIONES (DOUBLE ENTRY FORMAL) */}
              <div>
                <div className="bg-slate-100 border border-b-0 border-slate-400 px-3 py-1 font-bold text-[10px] tracking-wider text-slate-700 uppercase">
                  II. DETALLE DE VALORES DEVENGADOS Y RETENCIONES LEGALES
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 border border-slate-400 divide-y md:divide-y-0 md:divide-x divide-slate-400 text-xs">
                  
                  {/* COLUMNA IZQUIERDA: PERCEPCIONES */}
                  <div className="flex flex-col justify-between">
                    <div>
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-300 text-[10px] text-slate-600 font-bold uppercase">
                            <th className="py-1.5 px-2.5 w-14">Cód.</th>
                            <th className="py-1.5 px-2">Concepto / Haberes</th>
                            <th className="py-1.5 px-2 text-center w-16">Horas</th>
                            <th className="py-1.5 px-2.5 text-right w-20">Importe ($)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-[11px]">
                          {['salary', 'services_sv', 'services'].includes(selectedPayStub.contract_type) ? (
                            selectedPayStub.hours_deficit > 0 ? (
                              <>
                                <tr>
                                  <td className="py-1.5 px-2.5 font-mono text-[10px] text-slate-500">P-101</td>
                                  <td className="py-1.5 px-2 text-slate-800">Sueldo Base Pactado del Período</td>
                                  <td className="py-1.5 px-2 text-center text-slate-600">{selectedPayStub.expected_period_hours}h</td>
                                  <td className="py-1.5 px-2.5 text-right font-medium text-slate-900">
                                    ${selectedPayStub.base_salary_part.toFixed(2)}
                                  </td>
                                </tr>
                                <tr className="bg-rose-50/50">
                                  <td className="py-1.5 px-2.5 font-mono text-[10px] text-rose-700">P-101D</td>
                                  <td className="py-1.5 px-2 text-rose-800 italic">
                                    (-) Horas ordinarias no laboradas (${selectedPayStub.effective_hourly_rate.toFixed(2)}/h)
                                  </td>
                                  <td className="py-1.5 px-2 text-center text-rose-700 font-bold">
                                    -{selectedPayStub.hours_deficit}h
                                  </td>
                                  <td className="py-1.5 px-2.5 text-right font-bold text-rose-700">
                                    -${selectedPayStub.hours_deficit_deduction.toFixed(2)}
                                  </td>
                                </tr>
                                <tr className="bg-slate-50/70 font-semibold">
                                  <td className="py-1.5 px-2.5 font-mono text-[10px] text-slate-600">P-101N</td>
                                  <td className="py-1.5 px-2 text-slate-900">
                                    = Salario Ordinario Devengado
                                  </td>
                                  <td className="py-1.5 px-2 text-center text-slate-800">
                                    {selectedPayStub.regular_hours}h
                                  </td>
                                  <td className="py-1.5 px-2.5 text-right text-slate-900">
                                    ${selectedPayStub.regular_pay.toFixed(2)}
                                  </td>
                                </tr>
                              </>
                            ) : (
                              <tr>
                                <td className="py-1.5 px-2.5 font-mono text-[10px] text-slate-500">P-101</td>
                                <td className="py-1.5 px-2 text-slate-800">
                                  Salario Ordinario Pactado Cumplido
                                </td>
                                <td className="py-1.5 px-2 text-center text-slate-700 font-semibold">
                                  {selectedPayStub.regular_hours}h
                                </td>
                                <td className="py-1.5 px-2.5 text-right font-medium text-slate-900">
                                  ${selectedPayStub.regular_pay.toFixed(2)}
                                </td>
                              </tr>
                            )
                          ) : (
                            <tr>
                              <td className="py-1.5 px-2.5 font-mono text-[10px] text-slate-500">P-101</td>
                              <td className="py-1.5 px-2 text-slate-800">
                                Horas Ordinarias laboradas (${selectedPayStub.hourly_rate.toFixed(2)}/h)
                              </td>
                              <td className="py-1.5 px-2 text-center text-slate-700 font-semibold">
                                {selectedPayStub.regular_hours.toFixed(1)}h
                              </td>
                              <td className="py-1.5 px-2.5 text-right font-medium text-slate-900">
                                ${selectedPayStub.regular_pay.toFixed(2)}
                              </td>
                            </tr>
                          )}

                          {selectedPayStub.overtime_hours > 0 && (
                            <tr className="bg-amber-50/40">
                              <td className="py-1.5 px-2.5 font-mono text-[10px] text-amber-800">P-102</td>
                              <td className="py-1.5 px-2 text-amber-950 font-medium">
                                <div>
                                  <span>Horas Extras Autorizadas ({cfg?.overtime_multiplier || 1.5}x)</span>
                                  {selectedPayStub.overtime_schedule_details && (
                                    <span className="block text-[10px] text-amber-800 font-semibold">
                                      Horario: {selectedPayStub.overtime_schedule_details}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-1.5 px-2 text-center font-bold text-amber-800">
                                +{selectedPayStub.overtime_hours.toFixed(1)}h
                              </td>
                              <td className="py-1.5 px-2.5 text-right font-bold text-amber-900">
                                +${selectedPayStub.overtime_pay.toFixed(2)}
                              </td>
                            </tr>
                          )}

                          {selectedPayStub.kpi_bonus > 0 && (
                            <tr className="bg-indigo-50/30">
                              <td className="py-1.5 px-2.5 font-mono text-[10px] text-indigo-700">P-103</td>
                              <td className="py-1.5 px-2 text-indigo-950 font-medium">
                                Bono por Cumplimiento de Metas / KPIs
                              </td>
                              <td className="py-1.5 px-2 text-center text-slate-400">—</td>
                              <td className="py-1.5 px-2.5 text-right font-bold text-indigo-900">
                                +${selectedPayStub.kpi_bonus.toFixed(2)}
                              </td>
                            </tr>
                          )}

                          {selectedPayStub.commission_amount > 0 && (
                            <tr className="bg-emerald-50/30">
                              <td className="py-1.5 px-2.5 font-mono text-[10px] text-emerald-700">P-104</td>
                              <td className="py-1.5 px-2 text-emerald-950 font-medium">
                                <div>
                                  <span>Comisiones por Ventas / Objetivos</span>
                                  {selectedPayStub.commission_notes && (
                                    <span className="block text-[10px] text-emerald-700 font-normal">
                                      ({selectedPayStub.commission_notes})
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-1.5 px-2 text-center text-slate-400">—</td>
                              <td className="py-1.5 px-2.5 text-right font-bold text-emerald-800">
                                +${selectedPayStub.commission_amount.toFixed(2)}
                              </td>
                            </tr>
                          )}

                          {selectedPayStub.other_additions > 0 && (
                            <tr>
                              <td className="py-1.5 px-2.5 font-mono text-[10px] text-slate-500">P-105</td>
                              <td className="py-1.5 px-2 text-slate-800">Otras Bonificaciones / Incentivos</td>
                              <td className="py-1.5 px-2 text-center text-slate-600">—</td>
                              <td className="py-1.5 px-2.5 text-right font-medium text-slate-900">
                                +${selectedPayStub.other_additions.toFixed(2)}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Subtotal Percepciones */}
                    <div className="bg-slate-100 border-t border-slate-400 p-2 flex items-center justify-between text-xs font-bold text-slate-900 mt-6">
                      <span>TOTAL HABERES DEVENGADOS:</span>
                      <span className="font-mono text-sm">${totalDevengado.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* COLUMNA DERECHA: DEDUCCIONES */}
                  <div className="flex flex-col justify-between">
                    <div>
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-300 text-[10px] text-slate-600 font-bold uppercase">
                            <th className="py-1.5 px-2.5 w-14">Cód.</th>
                            <th className="py-1.5 px-2">Concepto / Retención</th>
                            <th className="py-1.5 px-2 text-center w-16">Tasa</th>
                            <th className="py-1.5 px-2.5 text-right w-20">Descuento ($)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-[11px]">
                          {/* Renta */}
                          <tr>
                            <td className="py-1.5 px-2.5 font-mono text-[10px] text-slate-500">R-201</td>
                            <td className="py-1.5 px-2 text-slate-800">
                              Impuesto sobre la Renta (MH)
                            </td>
                            <td className="py-1.5 px-2 text-center text-slate-600">
                              {cfg?.apply_renta 
                                ? (cfg.renta_mode === 'table' ? 'Tabla' : `${cfg.renta_percentage || 10}%`)
                                : 'Exento'}
                            </td>
                            <td className="py-1.5 px-2.5 text-right font-medium text-rose-700">
                              {selectedPayStub.renta > 0 ? `-$${selectedPayStub.renta.toFixed(2)}` : '$0.00'}
                            </td>
                          </tr>

                          {/* ISSS */}
                          <tr>
                            <td className="py-1.5 px-2.5 font-mono text-[10px] text-slate-500">R-202</td>
                            <td className="py-1.5 px-2 text-slate-800">Seguro Social (ISSS)</td>
                            <td className="py-1.5 px-2 text-center text-slate-600">
                              {cfg?.apply_isss ? `${cfg.isss_percentage || 3.0}%` : 'Exento'}
                            </td>
                            <td className="py-1.5 px-2.5 text-right font-medium text-slate-700">
                              {selectedPayStub.isss > 0 ? `-$${selectedPayStub.isss.toFixed(2)}` : '$0.00'}
                            </td>
                          </tr>

                          {/* AFP */}
                          <tr>
                            <td className="py-1.5 px-2.5 font-mono text-[10px] text-slate-500">R-203</td>
                            <td className="py-1.5 px-2 text-slate-800">Fondo de Pensiones (AFP)</td>
                            <td className="py-1.5 px-2 text-center text-slate-600">
                              {cfg?.apply_afp ? `${cfg.afp_percentage || 7.25}%` : 'Exento'}
                            </td>
                            <td className="py-1.5 px-2.5 text-right font-medium text-slate-700">
                              {selectedPayStub.afp > 0 ? `-$${selectedPayStub.afp.toFixed(2)}` : '$0.00'}
                            </td>
                          </tr>

                          {/* Otras deducciones */}
                          {selectedPayStub.other_deductions > 0 && (
                            <tr>
                              <td className="py-1.5 px-2.5 font-mono text-[10px] text-slate-500">R-204</td>
                              <td className="py-1.5 px-2 text-slate-800">Otras Deducciones / Préstamos</td>
                              <td className="py-1.5 px-2 text-center text-slate-600">—</td>
                              <td className="py-1.5 px-2.5 text-right font-medium text-rose-700">
                                -${selectedPayStub.other_deductions.toFixed(2)}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Subtotal Deducciones */}
                    <div className="bg-slate-100 border-t border-slate-400 p-2 flex items-center justify-between text-xs font-bold text-slate-900 mt-6">
                      <span>TOTAL DEDUCCIONES Y RETENCIONES:</span>
                      <span className="font-mono text-sm text-rose-700">-${totalDeducciones.toFixed(2)}</span>
                    </div>
                  </div>

                </div>
              </div>

              {/* RESUMEN DE LIQUIDACIÓN Y MONTO EN LETRAS (CAJA DE LIQUIDACIÓN FORMAL) */}
              <div className="border-2 border-slate-900 bg-slate-50 p-4 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-300 pb-2">
                  <div>
                    <span className="text-[10px] font-black tracking-widest uppercase text-slate-700 block">
                      VALOR LÍQUIDO A PAGAR / NETO A PERCIBIR
                    </span>
                    <p className="text-xs text-slate-600">
                      Monto transferido a favor del colaborador luego de retenciones tributarias y de ley.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl sm:text-3xl font-mono font-black text-slate-900 tracking-tight">
                      ${totalNeto.toFixed(2)}
                    </span>
                    <span className="block text-[10px] font-bold text-emerald-800 uppercase">
                      USD • Saldo Totalmente Liquidado
                    </span>
                  </div>
                </div>

                <div className="pt-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">CANTIDAD EN LETRAS:</span>
                  <p className="font-mono font-bold text-xs text-slate-900 tracking-wide uppercase mt-0.5">
                    SON: {legalWords}
                  </p>
                </div>
              </div>

              {/* CLÁUSULA LEGAL DE CONFORMIDAD Y FINIQUITO DE PERÍODO */}
              <div className="border border-slate-300 bg-slate-50/50 p-3 text-[10px] text-slate-600 leading-relaxed text-justify">
                <p>
                  <strong>DECLARACIÓN DE RECIBO Y CONFORMIDAD:</strong> Hago constar que he recibido a mi entera satisfacción de la empresa <strong>{companyLegalName}</strong> la suma líquida detallada en este comprobante, en concepto de pago de sueldos/honorarios y tiempo extraordinario correspondiente al período señalado. Con la recepción del presente valor manifiesto que la empresa no me adeuda suma alguna por conceptos ordinarios ni extraordinarios relativos a dicho período.
                </p>
              </div>

              {/* SECCIÓN DE FIRMAS Y SELLOS (FORMAL DUAL SIGNATURE) */}
              <div className="pt-6 pb-2">
                <div className="grid grid-cols-2 gap-8 text-center text-xs">
                  <div className="space-y-1">
                    <div className="border-b border-slate-800 pb-1 h-12 flex items-end justify-center">
                      {/* Línea de firma */}
                    </div>
                    <strong className="block text-slate-900 font-bold uppercase text-[11px] pt-1">
                      POR LA EMPRESA / GESTIÓN HUMANA
                    </strong>
                    <span className="text-[10px] text-slate-500 block leading-tight">
                      Firma y Sello de Autorización Contable
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="border-b border-slate-800 pb-1 h-12 flex items-end justify-center">
                      {/* Línea de firma */}
                    </div>
                    <strong className="block text-slate-900 font-bold uppercase text-[11px] pt-1">
                      RECIBÍ CONFORME (COLABORADOR)
                    </strong>
                    <span className="text-[10px] text-slate-500 block leading-tight">
                      {selectedPayStub.user_name} • DUI/ID: ______________________
                    </span>
                  </div>
                </div>
              </div>

              {/* PIE DE PÁGINA Y AUDITORÍA ELECTRÓNICA */}
              <div className="border-t border-slate-200 pt-3 flex flex-col sm:flex-row items-center justify-between text-[9px] text-slate-400 font-mono gap-1">
                <span>SISTEMA DE GESTIÓN INTEGRAL ARIAS CRM • MÓDULO DE NÓMINA Y COMPROBANTES FISCALES</span>
                <span>REF: {voucherCode} • VERIFICACIÓN: {selectedPayStub.user_id.slice(0, 8).toUpperCase()}-OK</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 8. MODAL DE CONFIGURACIÓN DE FICHA DE EMPLEADO (EXPEDIENTE LABORAL / GUSTO / ADP) ─── */}
      {editModalOpen && editingConfig && (() => {
        // Cálculo dinámico de tasa horaria según modalidad y horas
        const weeklyHrs = Number(editingConfig.expected_weekly_hours) || 44.0;
        const freq = editingConfig.payment_frequency || 'quincenal';
        const expectedPeriodHrs = freq === 'mensual' 
          ? +(weeklyHrs * 4).toFixed(1) 
          : freq === 'quincenal' 
            ? +(weeklyHrs * 2).toFixed(1) 
            : +(weeklyHrs).toFixed(1);
        const baseSal = Number(editingConfig.base_salary) || 0;
        const equivHourly = expectedPeriodHrs > 0 ? (baseSal / expectedPeriodHrs) : 0;
        const otMultiplier = Number(editingConfig.overtime_multiplier || 1.5);
        const hourlyOtRate = +(equivHourly * otMultiplier).toFixed(2);
        const isHourly = editingConfig.contract_type === 'hourly';
        const isServices = editingConfig.contract_type === 'services_sv' || editingConfig.contract_type === 'services';

        const countryOptions: SelectOption[] = [
          { value: 'SV', label: 'El Salvador (Régimen MH Art. 156 / Código de Trabajo)', shortLabel: 'El Salvador (SV)', icon: '🇸🇻' },
          { value: 'US', label: 'Estados Unidos (Form W-9 / W-8BEN Contractor)', shortLabel: 'Estados Unidos (US)', icon: '🇺🇸' },
          { value: 'OTHER', label: 'Internacional / Remoto (Honorarios sin retención local)', shortLabel: 'Remoto / Int.', icon: '🌐' },
        ];

        const overtimeMultiplierOptions: SelectOption[] = [
          { value: '1.5', label: '1.5x — Extra Ordinaria Diurna (+50%)', shortLabel: '1.5x (Diurna +50%)' },
          { value: '2.0', label: '2.0x — Extra Festivo / Día de Descanso (+100%)', shortLabel: '2.0x (Nocturna/Doble)' },
          { value: '1.25', label: '1.25x — Recargo Nocturno Ordinario (+25%)', shortLabel: '1.25x (Nocturna +25%)' },
          { value: '1.0', label: '1.0x — Tarifa Regular Plana (Sin recargo adicional)', shortLabel: '1.0x (Tarifa Plana)' },
        ];

        const commissionModeOptions: SelectOption[] = [
          { value: 'manual', label: 'Manual (Ajuste libre por cada período de nómina)', shortLabel: 'Manual (Por corte)' },
          { value: 'fixed_per_deal', label: 'Monto Fijo ($) por Trato o Negocio Cerrado', shortLabel: 'Fijo por Trato ($)' },
          { value: 'percentage_sales', label: 'Porcentaje (%) sobre Ventas Facturadas en CRM', shortLabel: 'Porcentaje (%)' },
        ];

        const rentaModeOptions: SelectOption[] = [
          { value: 'percentage', label: 'Porcentaje Directo (% Fijo, ej. 10% Art. 156 MH)', shortLabel: 'Porcentaje Directo (%)' },
          { value: 'table', label: 'Tramos Oficiales de Ley (Ministerio de Hacienda El Salvador)', shortLabel: 'Tramos Oficiales MH' },
        ];

        // ── ESTIMACIÓN EN VIVO DE DEDUCCIONES Y SALARIO NETO (TAB 3) ──
        const estimatedGross = baseSal;
        let estIsss = 0;
        let estAfp = 0;
        let estRenta = 0;

        if (editingConfig.apply_isss && !isServices) {
          const isssMax = freq === 'quincenal' ? 15.0 : 30.0;
          estIsss = Math.min(isssMax, +(estimatedGross * ((editingConfig.isss_percentage ?? 3.0) / 100)).toFixed(2));
        }

        if (editingConfig.apply_afp && !isServices) {
          estAfp = +(estimatedGross * ((editingConfig.afp_percentage ?? 7.25) / 100)).toFixed(2);
        }

        if (editingConfig.apply_renta) {
          if (editingConfig.renta_mode === 'table' && editingConfig.country === 'SV') {
            const taxableBase = Math.max(0, estimatedGross - estIsss - estAfp);
            if (freq === 'quincenal') {
              if (taxableBase <= 236.0) estRenta = 0;
              else if (taxableBase <= 447.62) estRenta = +((taxableBase - 236.0) * 0.10 + 8.83).toFixed(2);
              else if (taxableBase <= 1019.05) estRenta = +((taxableBase - 447.62) * 0.20 + 30.00).toFixed(2);
              else estRenta = +((taxableBase - 1019.05) * 0.30 + 144.28).toFixed(2);
            } else {
              if (taxableBase <= 472.0) estRenta = 0;
              else if (taxableBase <= 895.24) estRenta = +((taxableBase - 472.0) * 0.10 + 17.67).toFixed(2);
              else if (taxableBase <= 2038.10) estRenta = +((taxableBase - 895.24) * 0.20 + 60.00).toFixed(2);
              else estRenta = +((taxableBase - 2038.10) * 0.30 + 288.57).toFixed(2);
            }
          } else {
            const rate = editingConfig.renta_percentage ?? (isServices ? 10.0 : 10.0);
            estRenta = +(estimatedGross * (rate / 100)).toFixed(2);
          }
        }

        const estTotalDeductions = +(estIsss + estAfp + estRenta).toFixed(2);
        const estNet = Math.max(0, +(estimatedGross - estTotalDeductions).toFixed(2));

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200/90 animate-scaleUp max-h-[92vh] flex flex-col overflow-hidden">
              
              {/* ── 1. HEADER FIJO DEL MODAL ── */}
              <div className="flex items-center justify-between p-5 pb-3.5 border-b border-slate-100 shrink-0 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-violet-600 flex items-center justify-center text-white font-black text-lg shadow-sm">
                    {(editingConfig.user_name || 'E').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                        {editingConfig.user_name || 'Colaborador'}
                      </h3>
                      <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 font-bold px-2.5 py-0.5 rounded-full border border-indigo-200">
                        {editingConfig.employee_code || 'EMP-SIN-CÓDIGO'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">{editingConfig.user_email || ''}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* ── 2. BARRA DE TABS SEGMENTADA FIJA ── */}
              <div className="px-5 pt-3 pb-2.5 shrink-0 bg-white border-b border-slate-100">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setEditModalTab('salary')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      editModalTab === 'salary'
                        ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/60 ring-2 ring-indigo-50'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>Contratación y Salario</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditModalTab('incentives')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      editModalTab === 'incentives'
                        ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/60 ring-2 ring-indigo-50'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Extras y Comisiones</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditModalTab('taxes')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      editModalTab === 'taxes'
                        ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/60 ring-2 ring-indigo-50'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Retenciones de Ley</span>
                  </button>
                </div>
              </div>

              {/* ── 3. FORMULARIO CON CUERPO SCROLLEABLE Y FOOTER FIJO ── */}
              <form onSubmit={handleSaveConfig} className="flex-1 flex flex-col min-h-0 overflow-hidden text-xs">
                
                {/* CUERPO DEL MODAL (ÚNICA ÁREA CON SCROLL) */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
                  
                  {/* ── TAB 1: CONTRATACIÓN Y SALARIO ── */}
                  {editModalTab === 'salary' && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      
                      {/* SECCIÓN 1: RÉGIMEN Y CONTRATACIÓN */}
                      <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200/90 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            Régimen Contractual e Identificación
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">Modalidad Laboral</span>
                        </div>
                        
                        {/* 3 Tarjetas Visuales Directas para Tipo de Contrato */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setEditingConfig({
                              ...editingConfig,
                              contract_type: 'services_sv',
                              apply_isss: false,
                              apply_afp: false,
                              apply_renta: true,
                              renta_percentage: 10.0,
                              renta_mode: 'percentage'
                            })}
                            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                              editingConfig.contract_type === 'services_sv'
                                ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-200 shadow-xs'
                                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                                  💼 Servicios Profesionales
                                </span>
                                {editingConfig.contract_type === 'services_sv' && (
                                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500 leading-tight">
                                Honorarios. Retención del 10% según Art. 156 MH.
                              </p>
                            </div>
                            <span className="text-[9px] font-bold text-indigo-700 mt-2 block bg-white py-0.5 px-2 rounded-full w-fit border border-indigo-200">
                              Sin ISSS / AFP
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingConfig({
                              ...editingConfig,
                              contract_type: 'salary',
                              apply_isss: true,
                              apply_afp: true,
                              apply_renta: true,
                              renta_mode: 'table'
                            })}
                            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                              editingConfig.contract_type === 'salary'
                                ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-200 shadow-xs'
                                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                                  🏢 Planilla Asalariada
                                </span>
                                {editingConfig.contract_type === 'salary' && (
                                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500 leading-tight">
                                Salario ordinario fijo con retenciones de ley.
                              </p>
                            </div>
                            <span className="text-[9px] font-bold text-slate-700 mt-2 block bg-white py-0.5 px-2 rounded-full w-fit border border-slate-200">
                              ISSS + AFP + Renta
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingConfig({
                              ...editingConfig,
                              contract_type: 'hourly',
                              apply_isss: false,
                              apply_afp: false,
                              apply_renta: false
                            })}
                            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                              editingConfig.contract_type === 'hourly'
                                ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-200 shadow-xs'
                                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                                  ⏱️ Pago por Horas
                                </span>
                                {editingConfig.contract_type === 'hourly' && (
                                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500 leading-tight">
                                Destajo o tarifa por hora exacta reportada.
                              </p>
                            </div>
                            <span className="text-[9px] font-bold text-slate-700 mt-2 block bg-white py-0.5 px-2 rounded-full w-fit border border-slate-200">
                              Tarifa Variable
                            </span>
                          </button>
                        </div>

                        {/* Fila de Datos: Código, Fecha de Alta (CustomDatePicker), País */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                              Código de Empleado
                            </label>
                            <input
                              type="text"
                              value={editingConfig.employee_code || ''}
                              onChange={(e) => setEditingConfig({ ...editingConfig, employee_code: e.target.value.toUpperCase() })}
                              placeholder="EMP-001"
                              className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-xl font-mono font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-2xs"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                              Fecha de Ingreso / Alta
                            </label>
                            <CustomDatePicker
                              value={editingConfig.hire_date || ''}
                              onChange={(date) => setEditingConfig({ ...editingConfig, hire_date: date })}
                              variant="white"
                              placeholder="Seleccionar fecha"
                              className="w-full"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                              Marco Tributario
                            </label>
                            <CustomSelect
                              value={editingConfig.country || 'SV'}
                              onChange={(val) => setEditingConfig({ ...editingConfig, country: val as PayrollCountry })}
                              options={countryOptions}
                              placeholder="Selecciona país..."
                            />
                          </div>
                        </div>
                      </div>

                      {/* SECCIÓN 2: ESTRUCTURA SALARIAL Y JORNADA */}
                      <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200/90 space-y-3.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              Estructura Salarial y Jornada Laboral
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">
                              Compensación y horas pactadas para el corte de nómina.
                            </span>
                          </div>

                          {/* Pills de Frecuencia */}
                          <div className="inline-flex p-1 bg-white rounded-xl border border-slate-200 shadow-2xs">
                            {(['quincenal', 'mensual', 'semanal'] as PaymentFrequency[]).map((f) => (
                              <button
                                key={f}
                                type="button"
                                onClick={() => setEditingConfig({ ...editingConfig, payment_frequency: f })}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  freq === f
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                }`}
                              >
                                {f === 'quincenal' && 'Quincenal (88h)'}
                                {f === 'mensual' && 'Mensual (176h)'}
                                {f === 'semanal' && 'Semanal (44h)'}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 3 Inputs de Salario y Horas con Altura Estandarizada h-11 */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                              {isHourly 
                                ? 'Tarifa Acordada por Hora ($/h)' 
                                : `Salario por ${freq === 'quincenal' ? 'Quincena' : freq === 'mensual' ? 'Mes' : 'Semana'} ($)`}
                            </label>
                            <div className="relative">
                              <span className="absolute left-3.5 top-3 text-sm text-slate-400 font-bold">$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editingConfig.base_salary}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setEditingConfig({ 
                                    ...editingConfig, 
                                    base_salary: val,
                                    hourly_rate: isHourly ? val : editingConfig.hourly_rate 
                                  });
                                }}
                                className="w-full h-11 pl-8 pr-3 bg-white border border-slate-200 rounded-xl font-mono text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-2xs"
                                placeholder={isHourly ? '5.00' : '800.00'}
                                required
                              />
                            </div>
                            <span className="text-[10px] text-slate-400 block mt-1">
                              {isHourly 
                                ? 'Tarifa por hora que se multiplica por horas reportadas' 
                                : freq === 'quincenal' 
                                  ? `Equivale a $${(baseSal * 2).toFixed(2)} mensual` 
                                  : freq === 'mensual' 
                                    ? `Equivale a $${(baseSal / 2).toFixed(2)} por quincena` 
                                    : `Equivale a $${(baseSal * 4).toFixed(2)} mensual`}
                            </span>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                              Horas del Período ({freq})
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                step="1"
                                min="1"
                                max="300"
                                value={expectedPeriodHrs}
                                onChange={(e) => {
                                  const totalHrs = Number(e.target.value);
                                  const newWeekly = freq === 'mensual' ? totalHrs / 4 : freq === 'quincenal' ? totalHrs / 2 : totalHrs;
                                  setEditingConfig({ ...editingConfig, expected_weekly_hours: +newWeekly.toFixed(2) });
                                }}
                                className="w-full h-11 pl-3 pr-10 bg-white border border-slate-200 rounded-xl font-mono text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-2xs text-right"
                              />
                              <span className="absolute right-3 top-3 text-xs text-slate-400 font-bold">hrs</span>
                            </div>
                            <span className="text-[10px] text-slate-400 block mt-1">
                              {freq === 'mensual' && 'Meta estándar: 176 horas al mes'}
                              {freq === 'quincenal' && 'Meta estándar: 88 horas en quincena'}
                              {freq === 'semanal' && 'Meta estándar: 44 horas a la semana'}
                            </span>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                              Jornada Semanal (hrs/sem)
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                step="0.5"
                                min="1"
                                max="80"
                                value={weeklyHrs}
                                onChange={(e) => setEditingConfig({ ...editingConfig, expected_weekly_hours: Number(e.target.value) })}
                                className="w-full h-11 pl-3 pr-12 bg-white border border-slate-200 rounded-xl font-mono text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-2xs text-right"
                              />
                              <span className="absolute right-3 top-3 text-xs text-slate-400 font-bold">h/sem</span>
                            </div>
                            <span className="text-[10px] text-slate-400 block mt-1">
                              Ley El Salvador: 44h semanales (40h US)
                            </span>
                          </div>
                        </div>

                        {/* Resumen Contable Oficial (4 KPIs Limpios) */}
                        {baseSal > 0 ? (
                          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-3 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Calculator className="w-4 h-4 text-indigo-600" />
                                <span className="text-[11px] font-bold text-slate-900 tracking-tight">
                                  Desglose de Tarifas y Parámetros de Liquidación
                                </span>
                              </div>
                              <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-2.5 py-0.5 rounded-full border border-slate-200">
                                Corte: {freq.toUpperCase()}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                              <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/70">
                                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                                  {isHourly ? 'Tarifa Base' : 'Salario Fijo'}
                                </span>
                                <span className="text-sm font-bold text-slate-900 font-mono mt-0.5 block">
                                  ${baseSal.toFixed(2)}{isHourly && ' / h'}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {isHourly ? 'Por hora ordinaria' : `Pactado (${freq})`}
                                </span>
                              </div>

                              <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/70">
                                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Jornada Pactada</span>
                                <span className="text-sm font-bold text-slate-900 font-mono mt-0.5 block">
                                  {expectedPeriodHrs} hrs
                                </span>
                                <span className="text-[10px] text-slate-500">{weeklyHrs}h / semana</span>
                              </div>

                              <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/70">
                                <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-600 block">
                                  {isHourly ? 'Proyección Período' : 'Valor Hora Base'}
                                </span>
                                <span className="text-sm font-bold text-indigo-700 font-mono mt-0.5 block">
                                  {isHourly 
                                    ? `$${(baseSal * expectedPeriodHrs).toFixed(2)}` 
                                    : `$${equivHourly.toFixed(2)} / h`}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {isHourly ? `${expectedPeriodHrs}h meta estimadas` : `$${baseSal.toFixed(2)} ÷ ${expectedPeriodHrs}h`}
                                </span>
                              </div>

                              <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/70">
                                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Hora Extra ({otMultiplier}x)</span>
                                <span className="text-sm font-bold text-slate-900 font-mono mt-0.5 block">
                                  ${isHourly ? (baseSal * otMultiplier).toFixed(2) : hourlyOtRate.toFixed(2)} / h
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {editingConfig.applies_overtime ? 'Habilitada' : 'Exenta'}
                                </span>
                              </div>
                            </div>

                            <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3 flex items-start gap-2.5">
                              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                              <div className="text-[11px] text-slate-600 leading-relaxed">
                                <strong className="text-slate-800 font-semibold">Política de Liquidación Oficial:</strong>{' '}
                                {isHourly ? (
                                  <span>Para colaboradores bajo modalidad de <strong>Pago por Horas</strong>, el salario devengado se calcula multiplicando exactamente las horas ordinarias aprobadas por su tarifa de <strong>${baseSal.toFixed(2)}/h</strong>.</span>
                                ) : (
                                  <span>El salario pactado es un monto fijo garantizado para el período y no se multiplica por las horas laboradas. Si el colaborador no completa sus <strong>{expectedPeriodHrs} horas pactadas</strong>, el sistema descuenta únicamente las horas no laboradas a razón de <strong>${equivHourly.toFixed(2)}/h</strong>. Las horas extras se liquidan como concepto adicional independiente.</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-4 text-center">
                            <p className="text-xs text-slate-400 font-medium">
                              Ingresa el salario base arriba para calcular automáticamente la tarifa horaria ordinaria y las reglas de liquidación.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── TAB 2: HORAS EXTRAS, BONOS Y COMISIONES (DINÁMICO Y COMPLETO) ── */}
                  {editModalTab === 'incentives' && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      
                      {/* SECCIÓN: POLÍTICA DE HORAS EXTRAS */}
                      <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200/90 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              Política de Horas Extras
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">
                              Habilitación para registro y liquidación de horas extraordinarias.
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={editingConfig.applies_overtime ?? true}
                              onChange={(val) => setEditingConfig({ ...editingConfig, applies_overtime: val })}
                              size="sm"
                            />
                            <span className="text-xs font-bold text-slate-800">
                              {editingConfig.applies_overtime ? 'Aplica Horas Extras' : 'Exento (No aplica)'}
                            </span>
                          </div>
                        </div>

                        {editingConfig.applies_overtime && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/70 items-end">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                                Recargo Legal Horas Extras
                              </label>
                              <CustomSelect
                                value={String(editingConfig.overtime_multiplier || 1.5)}
                                onChange={(val) => setEditingConfig({ ...editingConfig, overtime_multiplier: Number(val) })}
                                options={overtimeMultiplierOptions}
                                placeholder="Selecciona recargo..."
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                                Tarifa Calculada por Hora Extra
                              </label>
                              <div className="h-11 px-4 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-2xs">
                                <span className="text-xs text-slate-500 font-medium">
                                  Tarifa ({editingConfig.overtime_multiplier || 1.5}x):
                                </span>
                                <strong className="text-sm font-bold font-mono text-emerald-700">
                                  {baseSal > 0 
                                    ? `$${isHourly ? (baseSal * otMultiplier).toFixed(2) : hourlyOtRate.toFixed(2)} / hora extra` 
                                    : '—'}
                                </strong>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* SECCIÓN: INCENTIVOS, BONOS Y COMISIONES (FULL CONFIGURACIÓN) */}
                      <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200/90 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              Incentivos, Bonos y Metas Comerciales
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">
                              Parámetros para cálculo de incentivos y metas comerciales.
                            </span>
                          </div>
                          <Award className="w-5 h-5 text-amber-500" />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                              Bono Base por KPIs ($)
                            </label>
                            <div className="relative">
                              <span className="absolute left-3.5 top-3 text-sm text-slate-400 font-bold">$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editingConfig.bonus_kpi_default ?? 0}
                                onChange={(e) => setEditingConfig({ ...editingConfig, bonus_kpi_default: Number(e.target.value) })}
                                className="w-full h-11 pl-8 pr-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-2xs"
                                placeholder="0.00"
                              />
                            </div>
                            <span className="text-[10px] text-slate-400 block mt-1">Bono estándar sugerido</span>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                              Esquema de Comisión
                            </label>
                            <CustomSelect
                              value={editingConfig.commission_mode || 'manual'}
                              onChange={(val) => setEditingConfig({ ...editingConfig, commission_mode: val as any })}
                              options={commissionModeOptions}
                              placeholder="Modo de comisión..."
                            />
                            <span className="text-[10px] text-slate-400 block mt-1">Cálculo de incentivo</span>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                              Tasa / Monto de Comisión
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editingConfig.commission_rate ?? 0}
                                onChange={(e) => setEditingConfig({ ...editingConfig, commission_rate: Number(e.target.value) })}
                                className="w-full h-11 pl-3 pr-8 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-2xs text-right"
                                placeholder="0.00"
                              />
                              <span className="absolute right-3.5 top-3 text-xs text-slate-400 font-bold">
                                {editingConfig.commission_mode === 'percentage_sales' ? '%' : '$'}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block mt-1">
                              {editingConfig.commission_mode === 'percentage_sales' ? 'Porcentaje sobre ventas' : 'Por cada trato cerrado'}
                            </span>
                          </div>
                        </div>

                        {/* Banner Informativo del Esquema de Comisión Seleccionado */}
                        <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-500" />
                            <span className="font-semibold text-slate-700">
                              {editingConfig.commission_mode === 'percentage_sales' && `Comisión del ${editingConfig.commission_rate || 0}% sobre el monto facturado`}
                              {editingConfig.commission_mode === 'fixed_per_deal' && `Bono fijo de $${editingConfig.commission_rate || 0} por cada trato ganado`}
                              {(editingConfig.commission_mode === 'manual' || !editingConfig.commission_mode) && 'Ajuste manual libre por período de corte'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">Modo activo</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── TAB 3: DEDUCCIONES DE LEY Y ESTIMACIÓN EN VIVO ── */}
                  {editModalTab === 'taxes' && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            Retenciones Fiscales y Previsionales de Ley
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">Marco Laboral Aplicable</span>
                        </div>

                        {/* Switch Renta */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2.5 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <Switch
                                checked={editingConfig.apply_renta}
                                onChange={(val) => setEditingConfig({ ...editingConfig, apply_renta: val })}
                                size="sm"
                              />
                              <span className="text-xs font-bold text-slate-800">Retención de Impuesto sobre la Renta</span>
                            </div>

                            {editingConfig.apply_renta && (
                              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                                {editingConfig.renta_mode === 'table' ? 'Tabla MH (Tramos de Ley)' : `${editingConfig.renta_percentage || 10}% Directo`}
                              </span>
                            )}
                          </div>

                          {editingConfig.apply_renta && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 items-end">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 mb-1.5">Modo de Cálculo de Renta</label>
                                <CustomSelect
                                  value={editingConfig.renta_mode || 'percentage'}
                                  onChange={(val) => setEditingConfig({ 
                                    ...editingConfig, 
                                    renta_mode: val as any 
                                  })}
                                  options={rentaModeOptions}
                                  placeholder="Modo de renta..."
                                />
                              </div>

                              {editingConfig.renta_mode !== 'table' ? (
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 mb-1.5">Porcentaje de Retención (%)</label>
                                  <div className="relative">
                                    <input
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      max="100"
                                      value={editingConfig.renta_percentage ?? 10}
                                      onChange={(e) => setEditingConfig({ 
                                        ...editingConfig, 
                                        renta_percentage: Number(e.target.value) 
                                      })}
                                      className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-indigo-700 text-right pr-7 focus:outline-none focus:border-indigo-500"
                                    />
                                    <span className="absolute right-2.5 top-3 text-xs text-slate-400 font-bold">%</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600">
                                  <span className="font-bold text-slate-800 block">Tramos Oficiales de Ley MH:</span>
                                  <span>Cálculo automático progresivo según tablas de retención vigentes en El Salvador.</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Switches ISSS & AFP */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800">ISSS (Seguro Social)</span>
                              <Switch
                                checked={editingConfig.apply_isss}
                                onChange={(val) => setEditingConfig({ ...editingConfig, apply_isss: val })}
                                size="sm"
                              />
                            </div>
                            {editingConfig.apply_isss ? (
                              <div className="relative pt-1">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editingConfig.isss_percentage ?? 3.0}
                                  onChange={(e) => setEditingConfig({ ...editingConfig, isss_percentage: Number(e.target.value) })}
                                  className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 text-right pr-6 focus:outline-none focus:border-indigo-500"
                                />
                                <span className="absolute right-2.5 top-4 text-xs text-slate-400 font-bold">%</span>
                                <span className="text-[10px] text-slate-400 block mt-1">Tope legal: $30/mes ($15/quincena)</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 block font-medium pt-2">No aplica retención de ISSS</span>
                            )}
                          </div>

                          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800">AFP (Fondo de Pensiones)</span>
                              <Switch
                                checked={editingConfig.apply_afp}
                                onChange={(val) => setEditingConfig({ ...editingConfig, apply_afp: val })}
                                size="sm"
                              />
                            </div>
                            {editingConfig.apply_afp ? (
                              <div className="relative pt-1">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editingConfig.afp_percentage ?? 7.25}
                                  onChange={(e) => setEditingConfig({ ...editingConfig, afp_percentage: Number(e.target.value) })}
                                  className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 text-right pr-6 focus:outline-none focus:border-indigo-500"
                                />
                                <span className="absolute right-2.5 top-4 text-xs text-slate-400 font-bold">%</span>
                                <span className="text-[10px] text-slate-400 block mt-1">Aporte previsional de ley (7.25%)</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 block font-medium pt-2">No aplica retención de AFP</span>
                            )}
                          </div>
                        </div>

                        {/* ESTIMACIÓN EN VIVO DE IMPACTO EN EL SALARIO NETO */}
                        {baseSal > 0 && (
                          <div className="bg-gradient-to-r from-slate-100/90 to-indigo-50/60 border border-slate-200/90 rounded-2xl p-3.5 space-y-2 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <Calculator className="w-3.5 h-3.5 text-indigo-600" />
                                Proyección en Vivo de Deducciones y Salario Líquido
                              </span>
                              <span className="text-[10px] font-mono text-slate-500">
                                Base: ${estimatedGross.toFixed(2)}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-500 block">ISSS Estimado</span>
                                <span className="text-xs font-mono font-bold text-rose-600 block mt-0.5">
                                  {estIsss > 0 ? `-$${estIsss.toFixed(2)}` : '$0.00'}
                                </span>
                              </div>

                              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-500 block">AFP Estimado</span>
                                <span className="text-xs font-mono font-bold text-rose-600 block mt-0.5">
                                  {estAfp > 0 ? `-$${estAfp.toFixed(2)}` : '$0.00'}
                                </span>
                              </div>

                              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-500 block">Renta Estimada</span>
                                <span className="text-xs font-mono font-bold text-rose-600 block mt-0.5">
                                  {estRenta > 0 ? `-$${estRenta.toFixed(2)}` : '$0.00'}
                                </span>
                              </div>

                              <div className="bg-indigo-50/80 p-2.5 rounded-xl border border-indigo-200">
                                <span className="text-[10px] text-indigo-700 font-bold block">Neto Estimado</span>
                                <span className="text-xs font-mono font-bold text-indigo-900 block mt-0.5">
                                  ${estNet.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── 4. FOOTER FIJO CON BOTONES DE ACCIÓN (SIEMPRE VISIBLE) ── */}
                <div className="p-4 px-5 border-t border-slate-100 bg-slate-50/80 rounded-b-3xl flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="hidden sm:inline">Parámetros sincronizados con el motor de nómina</span>
                    <span className="sm:hidden">Sincronizado</span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setEditModalOpen(false)}
                      className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 sm:px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-98 rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center gap-2 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      Guardar Ficha del Colaborador
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ── 8B. MODAL DE AJUSTE DE BONOS Y COMISIONES DEL PERÍODO (REQUERIMIENTO 4) ─── */}
      {adjustModalOpen && adjustingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-slate-200 animate-scaleUp">
            
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  <h3 className="text-base font-bold text-slate-900">Percepciones Adicionales del Período</h3>
                </div>
                <span className="text-xs text-slate-500">
                  {adjustingItem.user_name} • {adjustingItem.employee_code || 'EMP'} ({adjustingItem.contract_type})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAdjustModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            {/* Ficha Resumen del Período */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5">
              <div className="flex justify-between items-center text-slate-600">
                <span>Período de Nómina:</span>
                <span className="font-mono font-bold text-slate-800">{startDate} al {endDate}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Salario Base Pactado ({adjustingItem.payment_frequency}):</span>
                <span className="font-mono font-bold text-indigo-700">${adjustingItem.base_salary.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Jornada: Reportadas vs Meta:</span>
                <span className="font-mono text-slate-800">
                  {adjustingItem.regular_hours}h / {adjustingItem.expected_period_hours}h
                  {adjustingItem.hours_deficit > 0 && (
                    <span className="ml-1 text-rose-600 font-bold">(-${adjustingItem.hours_deficit_deduction.toFixed(2)})</span>
                  )}
                </span>
              </div>
              {adjustingItem.overtime_hours > 0 && (
                <div className="flex justify-between items-center text-emerald-700 font-medium">
                  <span>Horas Extras ({adjustingItem.overtime_hours}h):</span>
                  <span className="font-mono font-bold">+${adjustingItem.overtime_pay.toFixed(2)}</span>
                </div>
              )}
            </div>

            <form onSubmit={handleSaveAdjustModal} className="space-y-3.5">
              {/* Bono por KPIs */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Bono por Cumplimiento de KPIs ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={adjKpiBonus}
                    onChange={(e) => setAdjKpiBonus(Number(e.target.value))}
                    className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-indigo-500"
                    placeholder="0.00"
                  />
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Bono asignado por desempeño, puntualidad o cumplimiento de objetivos.
                </span>
              </div>

              {/* Comisiones */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Comisiones por Ventas o Cierres ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={adjCommissionAmount}
                    onChange={(e) => setAdjCommissionAmount(Number(e.target.value))}
                    className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-indigo-500"
                    placeholder="0.00"
                  />
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Monto devengado por ventas logradas en el período.
                </span>
              </div>

              {/* Justificación o Nota */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Detalle / Justificación de Comisiones o Bonos
                </label>
                <input
                  type="text"
                  value={adjCommissionNotes}
                  onChange={(e) => setAdjCommissionNotes(e.target.value)}
                  placeholder="Ej: 5 tratos cerrados en CRM o cumplimiento de meta 120%"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Botones */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Aplicar Percepciones al Período
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 10. MODAL DE CONFIRMACIÓN DE ELIMINACIÓN DE REGISTRO (ADMIN) ── */}
      {deleteModalOpen && selectedEntryToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-rose-100 animate-scaleUp">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Eliminar Registro de Jornada</h3>
                <p className="text-xs text-slate-500">Acción permanente de Administrador</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs space-y-1.5 text-slate-700">
              <p><strong>Colaborador:</strong> {selectedEntryToDelete.user_name}</p>
              <p><strong>Fecha de labor:</strong> {selectedEntryToDelete.work_date}</p>
              <p><strong>Horas:</strong> {selectedEntryToDelete.regular_hours}h regulares + {selectedEntryToDelete.overtime_hours}h extras</p>
              {selectedEntryToDelete.work_summary && (
                <p><strong>Entregables:</strong> {selectedEntryToDelete.work_summary}</p>
              )}
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              ¿Estás seguro de que deseas eliminar este registro permanentemente de la base de datos? Esta acción es irreversible y eliminará por completo estas horas del cálculo de nómina.
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
