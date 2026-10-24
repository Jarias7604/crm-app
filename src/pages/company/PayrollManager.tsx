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
import { 
  Clock, CheckCircle2, XCircle, AlertTriangle, DollarSign, 
  Users, Settings2, Calculator, ShieldCheck, Filter, Download,
  ChevronLeft, ChevronRight, Search, Plus, Trash2, Edit3, Eye, FileText,
  Printer, ArrowUpRight, Check, Sparkles, Building2, Calendar, RefreshCw,
  FileCheck2, Award
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

  // Config Member Edit Modal
  const [editingConfig, setEditingConfig] = useState<PayrollMemberConfig | null>(null);
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);

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

      // 2. Cargar solicitudes de horas extras pendientes
      const allTimesheets = await timesheetsService.getTimesheets({
        companyId: activeCompanyId,
        status: 'submitted',
      });
      setPendingApprovals(allTimesheets.filter(t => t.overtime_hours > 0 || t.status === 'submitted'));

      // 3. Cargar cálculo de planilla
      const calc = await timesheetsService.calculatePayrollRun({
        companyId: activeCompanyId,
        startDate,
        endDate,
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

  // ── Configuración de Miembro ───────────────────────────────────

  const handleOpenEditConfig = (member: { id: string; full_name: string; email: string }) => {
    const existing = memberConfigs.find(c => c.user_id === member.id);
    if (existing) {
      setEditingConfig({ 
        ...existing,
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
        payment_frequency: 'quincenal',
        contract_type: 'hourly',
        hourly_rate: 10,
        base_salary: 0,
        overtime_multiplier: 1.5,
        country: 'SV',
        apply_isss: true,
        apply_afp: true,
        apply_renta: true,
        renta_mode: 'percentage',
        renta_percentage: 10.0,
        isss_percentage: 3.0,
        afp_percentage: 7.25,
        custom_deductions: [],
      });
    }
    setEditModalOpen(true);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConfig) return;
    const res = await timesheetsService.upsertPayrollConfig(editingConfig);
    if (res.success) {
      toast.success('Regla salarial guardada correctamente.');
      setEditModalOpen(false);
      await loadAllData();
    } else {
      toast.error('Error al guardar: ' + res.error);
    }
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

          {/* Fechas personalizadas sutiles */}
          <div className="hidden lg:flex items-center gap-1.5 ml-3 pl-3 border-l border-slate-200 text-xs text-slate-500">
            <span>Desde:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-slate-700"
            />
            <span>Hasta:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-slate-700"
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
        <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-xs">
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
            {pendingApprovals.length === 0 ? 'Sin horas extras pendientes' : 'Requiere tu autorización'}
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
                  <th className="py-2.5 px-3">Régimen</th>
                  <th className="py-2.5 px-3 text-center">Horas Reg.</th>
                  <th className="py-2.5 px-3 text-center">Overtime Aprobado</th>
                  <th className="py-2.5 px-3 text-right">Tarifa / Base</th>
                  <th className="py-2.5 px-3 text-right">Total Bruto</th>
                  <th className="py-2.5 px-3 text-right text-rose-600">ISSS</th>
                  <th className="py-2.5 px-3 text-right text-rose-600">AFP</th>
                  <th className="py-2.5 px-3 text-right text-rose-600 font-bold">Renta</th>
                  <th className="py-2.5 px-4 text-right font-bold text-emerald-800">Neto a Pagar</th>
                  <th className="py-2.5 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      <Clock className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                      Calculando nómina en tiempo real...
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      No se encontraron colaboradores para este período o filtro.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.user_id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Colaborador */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {item.user_name.charAt(0)}
                          </div>
                          <div>
                            <span className="block font-bold text-slate-900 leading-tight">{item.user_name}</span>
                            <span className="text-[10px] text-slate-400 font-normal leading-tight">{item.user_email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Régimen */}
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100/90 px-2 py-0.5 rounded text-[10px] border border-slate-200/60">
                          {item.country === 'SV' ? '🇸🇻 SV' : item.country === 'US' ? '🇺🇸 US' : '🌎 LATAM'}
                          <span className="text-slate-400">•</span>
                          <span>{item.contract_type}</span>
                        </span>
                      </td>

                      {/* Horas Regulares */}
                      <td className="py-2.5 px-3 text-center font-semibold text-slate-700">
                        {item.regular_hours}h
                      </td>

                      {/* Overtime Aprobado */}
                      <td className="py-2.5 px-3 text-center">
                        {item.overtime_hours > 0 ? (
                          <span className="inline-flex items-center gap-0.5 font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[11px]">
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            +{item.overtime_hours}h
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                        {item.pending_overtime_count > 0 && (
                          <span className="block text-[9px] text-amber-600 font-semibold" title="Horas extras sin autorizar">
                            ({item.pending_overtime_count}h pend.)
                          </span>
                        )}
                      </td>

                      {/* Tarifa / Base */}
                      <td className="py-2.5 px-3 text-right text-slate-600 font-medium">
                        {item.contract_type === 'salary' ? (
                          `$${item.base_salary_part.toFixed(2)} fij.`
                        ) : (
                          `$${item.hourly_rate.toFixed(2)}/h`
                        )}
                      </td>

                      {/* Total Bruto */}
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        ${item.gross_pay.toFixed(2)}
                      </td>

                      {/* ISSS */}
                      <td className="py-2.5 px-3 text-right text-slate-600">
                        {item.isss > 0 ? `-$${item.isss.toFixed(2)}` : '—'}
                      </td>

                      {/* AFP */}
                      <td className="py-2.5 px-3 text-right text-slate-600">
                        {item.afp > 0 ? `-$${item.afp.toFixed(2)}` : '—'}
                      </td>

                      {/* Renta */}
                      <td className="py-2.5 px-3 text-right font-bold text-rose-700">
                        {item.renta > 0 ? `-$${item.renta.toFixed(2)}` : '—'}
                      </td>

                      {/* Neto a Pagar */}
                      <td className="py-2.5 px-4 text-right">
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-800 text-sm">
                          ${item.net_pay.toFixed(2)}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
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
                            aria-label="Editar tarifas e impuestos"
                            onClick={() => handleOpenEditConfig({ id: item.user_id, full_name: item.user_name, email: item.user_email })}
                            className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition cursor-pointer"
                            title="Editar tarifas e impuestos"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 5. TAB 2: HORAS EXTRAS (ADP QUEUE STYLE) ────────────────── */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl p-3 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold text-amber-900 block">Bandeja de Autorización Previa</span>
              <p className="text-amber-800 text-[11px] mt-0.5">
                Las horas extras no aprobadas aquí se excluyen automáticamente de la nómina.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs">
              <Clock className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
              Cargando solicitudes...
            </div>
          ) : pendingApprovals.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-xl p-8 text-center space-y-1.5">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="font-bold text-slate-800 text-sm">Bandeja al día</p>
              <p className="text-xs text-slate-400">No hay horas extras pendientes de aprobación.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pendingApprovals.map((entry) => (
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

                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      +{entry.overtime_hours} hrs extra
                    </span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/70 rounded-lg p-2.5 text-xs text-slate-800 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Motivo del tiempo extra:
                    </span>
                    <p className="italic text-slate-700 leading-snug">"{entry.overtime_reason || 'Sin justificación'}"</p>
                  </div>

                  <div className="text-[11px] text-slate-500 leading-snug">
                    <strong className="text-slate-700">Entregables:</strong> {entry.work_summary}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleApprove(entry)}
                      className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Aprobar Overtime
                    </button>
                    <button
                      onClick={() => handleOpenReject(entry)}
                      className="py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 6. TAB 3: CONFIGURACIÓN DE TARIFAS (GUSTO / ADP STYLE) ──── */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Perfiles Salariales y Parámetros Fiscales</h3>
              <p className="text-xs text-slate-500">Configura tarifas por hora, modo de contrato y reglas impositivas de cada miembro.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {teamProfiles.map((member) => {
              const cfg = memberConfigs.find(c => c.user_id === member.id);
              return (
                <div
                  key={member.id}
                  className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center font-bold text-xs">
                        {member.full_name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 leading-tight">{member.full_name || 'Sin nombre'}</h4>
                        <span className="text-[10px] text-slate-400 font-normal leading-tight">{member.email}</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 space-y-1 text-[11px] text-slate-600">
                      <div className="flex justify-between">
                        <span>Régimen:</span>
                        <strong className="text-slate-800">
                          {cfg?.country === 'SV' ? '🇸🇻 El Salvador' : cfg?.country === 'US' ? '🇺🇸 USA' : '🌎 LATAM'}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Modalidad:</span>
                        <strong className="text-slate-800">{cfg?.contract_type || 'Por Horas'}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Tarifa Base:</span>
                        <strong className="text-emerald-700 font-bold">${cfg?.hourly_rate || 0}/hr</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Renta:</span>
                        <strong className="text-indigo-700 font-bold">
                          {cfg?.apply_renta 
                            ? (cfg.renta_mode === 'table' ? 'Tabla MH' : `${cfg.renta_percentage || 10}% Directo`)
                            : 'Exento (0%)'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenEditConfig(member)}
                    className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Editar Parámetros
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
                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Doc. Identidad / Código</span>
                    <span className="font-bold text-slate-900 block text-xs">
                      EMP-{selectedPayStub.user_id.slice(0, 6).toUpperCase()}
                    </span>
                    <span className="text-[10px] text-slate-500 block">DUI / ID: Registrado</span>
                  </div>

                  <div className="p-2.5 space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Régimen & Modalidad</span>
                    <span className="font-bold text-slate-900 block text-xs">
                      {isSV ? 'El Salvador (SV)' : selectedPayStub.country === 'US' ? 'Estados Unidos (US)' : 'LATAM'}
                    </span>
                    <span className="text-[10px] text-slate-600 block">
                      {selectedPayStub.contract_type === 'salary' ? 'Salario Fijo' : 'Servicios / Por Horas'}
                    </span>
                  </div>

                  <div className="p-2.5 space-y-0.5 bg-slate-50/50">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Período Liquidado</span>
                    <span className="font-bold text-indigo-950 block text-xs">{periodLabel}</span>
                    <span className="text-[10px] text-slate-500 block">Quincena Oficial</span>
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
                          {selectedPayStub.contract_type === 'salary' ? (
                            <tr>
                              <td className="py-1.5 px-2.5 font-mono text-[10px] text-slate-500">P-101</td>
                              <td className="py-1.5 px-2 text-slate-800">Sueldo Base Quincenal</td>
                              <td className="py-1.5 px-2 text-center text-slate-600">15 d</td>
                              <td className="py-1.5 px-2.5 text-right font-medium text-slate-900">
                                ${selectedPayStub.base_salary_part.toFixed(2)}
                              </td>
                            </tr>
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
                                Horas Extras Autorizadas ({cfg?.overtime_multiplier || 1.5}x)
                              </td>
                              <td className="py-1.5 px-2 text-center font-bold text-amber-800">
                                +{selectedPayStub.overtime_hours.toFixed(1)}h
                              </td>
                              <td className="py-1.5 px-2.5 text-right font-bold text-amber-900">
                                +${selectedPayStub.overtime_pay.toFixed(2)}
                              </td>
                            </tr>
                          )}

                          {selectedPayStub.other_additions > 0 && (
                            <tr>
                              <td className="py-1.5 px-2.5 font-mono text-[10px] text-slate-500">P-103</td>
                              <td className="py-1.5 px-2 text-slate-800">Bonificación / Incentivo</td>
                              <td className="py-1.5 px-2 text-center text-slate-600">—</td>
                              <td className="py-1.5 px-2.5 text-right font-medium text-slate-900">
                                ${selectedPayStub.other_additions.toFixed(2)}
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

      {/* ── 8. MODAL DE CONFIGURACIÓN SALARIAL (GUSTO / QUICKBOOKS) ─── */}
      {editModalOpen && editingConfig && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Parámetros Salariales e Impuestos</h3>
                <span className="text-xs text-slate-400">{editingConfig.user_name}</span>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-3.5">
              {/* País y Modalidad */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    País / Régimen
                  </label>
                  <select
                    value={editingConfig.country}
                    onChange={(e) => setEditingConfig({ ...editingConfig, country: e.target.value as PayrollCountry })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="SV">🇸🇻 El Salvador</option>
                    <option value="US">🇺🇸 USA (1099 / W2)</option>
                    <option value="OTHER">🌎 LATAM / Personalizado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Tipo de Contrato
                  </label>
                  <select
                    value={editingConfig.contract_type}
                    onChange={(e) => setEditingConfig({ ...editingConfig, contract_type: e.target.value as ContractType })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="hourly">Por Horas</option>
                    <option value="salary">Salario Fijo</option>
                    <option value="contractor_1099">Contratista 1099</option>
                    <option value="services_sv">Servicios Profesionales</option>
                  </select>
                </div>
              </div>

              {/* Tarifa y Multiplicador */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Tarifa Base ($ / hora o fij.)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingConfig.hourly_rate}
                      onChange={(e) => setEditingConfig({ ...editingConfig, hourly_rate: Number(e.target.value) })}
                      className="w-full pl-6 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Recargo Horas Extras
                  </label>
                  <select
                    value={editingConfig.overtime_multiplier}
                    onChange={(e) => setEditingConfig({ ...editingConfig, overtime_multiplier: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    <option value={1.5}>1.5x (Hora Extra Ordinaria)</option>
                    <option value={2.0}>2.0x (Hora Extra Doble / Asueto)</option>
                    <option value={1.0}>1.0x (Sin recargo)</option>
                  </select>
                </div>
              </div>

              {/* Controles Dinámicos de Retenciones con Switch (Gusto/QuickBooks style) */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 space-y-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Retenciones Fiscales Dinámicas
                </span>

                {/* Switch Renta */}
                <div className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={editingConfig.apply_renta}
                        onChange={(val) => setEditingConfig({ ...editingConfig, apply_renta: val })}
                        size="sm"
                      />
                      <span className="text-xs font-bold text-slate-800">Retención de Renta</span>
                    </div>

                    {editingConfig.apply_renta && (
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                        {editingConfig.renta_mode === 'table' ? 'Tabla MH' : `${editingConfig.renta_percentage || 10}%`}
                      </span>
                    )}
                  </div>

                  {editingConfig.apply_renta && (
                    <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-100">
                      <div>
                        <select
                          value={editingConfig.renta_mode || 'percentage'}
                          onChange={(e) => setEditingConfig({ 
                            ...editingConfig, 
                            renta_mode: e.target.value as any 
                          })}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] font-bold text-slate-700"
                        >
                          <option value="percentage">% Directo</option>
                          <option value="table">Tramos de Ley (MH)</option>
                        </select>
                      </div>

                      {editingConfig.renta_mode !== 'table' && (
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
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-indigo-700 text-right pr-6"
                          />
                          <span className="absolute right-2 top-1 text-[11px] text-slate-400 font-bold">%</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Switches ISSS & AFP */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">ISSS</span>
                      <Switch
                        checked={editingConfig.apply_isss}
                        onChange={(val) => setEditingConfig({ ...editingConfig, apply_isss: val })}
                        size="sm"
                      />
                    </div>
                    {editingConfig.apply_isss && (
                      <div className="relative pt-0.5">
                        <input
                          type="number"
                          step="0.01"
                          value={editingConfig.isss_percentage ?? 3.0}
                          onChange={(e) => setEditingConfig({ ...editingConfig, isss_percentage: Number(e.target.value) })}
                          className="w-full px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-700 text-right pr-5"
                        />
                        <span className="absolute right-1.5 top-1 text-[10px] text-slate-400 font-bold">%</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">AFP</span>
                      <Switch
                        checked={editingConfig.apply_afp}
                        onChange={(val) => setEditingConfig({ ...editingConfig, apply_afp: val })}
                        size="sm"
                      />
                    </div>
                    {editingConfig.apply_afp && (
                      <div className="relative pt-0.5">
                        <input
                          type="number"
                          step="0.01"
                          value={editingConfig.afp_percentage ?? 7.25}
                          onChange={(e) => setEditingConfig({ ...editingConfig, afp_percentage: Number(e.target.value) })}
                          className="w-full px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-700 text-right pr-5"
                        />
                        <span className="absolute right-1.5 top-1 text-[10px] text-slate-400 font-bold">%</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
                >
                  Guardar Parámetros
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 9. MODAL RECHAZO DE OVERTIME ────────────────────────────── */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-4 space-y-3 shadow-xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center gap-2 text-rose-600">
              <XCircle className="w-5 h-5" />
              <h3 className="text-sm font-bold text-slate-900">Rechazar Horas Extras</h3>
            </div>
            <p className="text-xs text-slate-600 leading-snug">
              Indica la razón por la que no se autoriza el tiempo extra de{' '}
              <strong>{selectedEntryToReject?.user_name}</strong> (+{selectedEntryToReject?.overtime_hours}h).
            </p>
            <textarea
              rows={2}
              value={rejectionReasonInput}
              onChange={(e) => setRejectionReasonInput(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setRejectModalOpen(false)}
                className="px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-3 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
              >
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
