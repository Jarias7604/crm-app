import { supabase } from './supabase';
import type { 
  TimesheetEntry, 
  PayrollMemberConfig, 
  PayrollCalculationItem, 
  PayrollRun,
  CustomDeductionRule
} from '../types/timesheets';

// ================================================================
// CALCULADORA FISCAL DINÁMICA MULTI-PAÍS (SV, USA, LATAM)
// ================================================================

export function calculateElSalvadorDeductions(
  grossPay: number, 
  isQuincenal = true, 
  isProfessionalServices = false,
  applyIsss = true,
  isssRate = 3.0,
  applyAfp = true,
  afpRate = 7.25,
  applyRenta = true,
  rentaMode: 'percentage' | 'table' | 'none' = 'percentage',
  rentaRate = 10.0
) {
  // 1. ISSS Dinámico: Tasa editable (default 3%), tope mensual $30 / quincenal $15
  let isss = 0;
  if (applyIsss && !isProfessionalServices) {
    const isssMax = isQuincenal ? 15 : 30;
    isss = +Math.min(grossPay * (isssRate / 100), isssMax).toFixed(2);
  }

  // 2. AFP Dinámico: Tasa editable (default 7.25%)
  let afp = 0;
  if (applyAfp && !isProfessionalServices) {
    afp = +(grossPay * (afpRate / 100)).toFixed(2);
  }

  // 3. Renta Dinámica:
  let renta = 0;
  if (applyRenta) {
    if (rentaMode === 'percentage' || isProfessionalServices) {
      // Retención porcentual directa configurable (ej: 10%, 15%, etc.)
      const rate = rentaRate > 0 ? rentaRate : 10.0;
      renta = +(grossPay * (rate / 100)).toFixed(2);
    } else if (rentaMode === 'table') {
      // Tramos Oficiales del Ministerio de Hacienda
      const taxableIncome = Math.max(0, +(grossPay - isss - afp).toFixed(2));
      if (isQuincenal) {
        if (taxableIncome <= 236.00) {
          renta = 0;
        } else if (taxableIncome <= 447.71) {
          renta = +((taxableIncome - 236.00) * 0.10 + 8.83).toFixed(2);
        } else if (taxableIncome <= 1019.05) {
          renta = +((taxableIncome - 447.72) * 0.20 + 30.00).toFixed(2);
        } else {
          renta = +((taxableIncome - 1019.05) * 0.30 + 144.27).toFixed(2);
        }
      } else {
        if (taxableIncome <= 472.00) {
          renta = 0;
        } else if (taxableIncome <= 895.24) {
          renta = +((taxableIncome - 472.00) * 0.10 + 17.67).toFixed(2);
        } else if (taxableIncome <= 2038.10) {
          renta = +((taxableIncome - 895.24) * 0.20 + 60.00).toFixed(2);
        } else {
          renta = +((taxableIncome - 2038.10) * 0.30 + 288.57).toFixed(2);
        }
      }
    }
  }

  return { isss, afp, renta };
}

export function processCustomDeductions(grossPay: number, rules: CustomDeductionRule[]) {
  let otherDeductions = 0;
  let otherAdditions = 0;

  for (const r of rules || []) {
    const val = r.type === 'percentage' 
      ? +(grossPay * (r.value / 100)).toFixed(2)
      : +r.value.toFixed(2);

    if (r.is_addition) {
      otherAdditions += val;
    } else {
      otherDeductions += val;
    }
  }

  return { 
    otherDeductions: +otherDeductions.toFixed(2), 
    otherAdditions: +otherAdditions.toFixed(2) 
  };
}

// ================================================================
// SERVICIO DE BASE DE DATOS (TIMESHEETS & PAYROLL)
// ================================================================

export const timesheetsService = {
  // ── 1. Timesheets (Jornadas y Horas Extras) ───────────────────
  
  async getTimesheets(params: {
    companyId: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  }): Promise<TimesheetEntry[]> {
    try {
      let query = supabase
        .from('team_timesheets')
        .select(`
          *,
          user:profiles!team_timesheets_user_id_fkey(full_name, email, avatar_url),
          reviewer:profiles!team_timesheets_reviewed_by_fkey(full_name)
        `)
        .eq('company_id', params.companyId)
        .order('work_date', { ascending: false });

      if (params.userId) query = query.eq('user_id', params.userId);
      if (params.startDate) query = query.gte('work_date', params.startDate);
      if (params.endDate) query = query.lte('work_date', params.endDate);
      if (params.status && params.status !== 'all') query = query.eq('status', params.status);

      const { data, error } = await query;
      if (error) {
        console.warn('Error fetching team_timesheets:', error.message);
        return [];
      }

      return (data || []).map((row: any) => {
        // Extraer horario de horas extras si viene en columnas o embebido en motivo
        let otStart = row.overtime_start_time || null;
        let otEnd = row.overtime_end_time || null;
        if ((!otStart || !otEnd) && row.overtime_reason) {
          const match = row.overtime_reason.match(/\[Horario:\s*([0-9:]+\s*(?:AM|PM)?)\s*a\s*([0-9:]+\s*(?:AM|PM)?)\]/i);
          if (match) {
            otStart = otStart || match[1];
            otEnd = otEnd || match[2];
          }
        }

        return {
          id: row.id,
          company_id: row.company_id,
          user_id: row.user_id,
          user_name: row.user?.full_name || row.user?.email || 'Colaborador',
          user_email: row.user?.email || '',
          user_avatar: row.user?.avatar_url || null,
          work_date: row.work_date,
          regular_hours: Number(row.regular_hours || 0),
          overtime_hours: Number(row.overtime_hours || 0),
          overtime_reason: row.overtime_reason,
          overtime_start_time: otStart,
          overtime_end_time: otEnd,
          work_summary: row.work_summary,
          project_id: row.project_id,
          task_id: row.task_id,
          ticket_id: row.ticket_id,
          status: row.status,
          reviewed_by: row.reviewed_by,
          reviewed_name: row.reviewer?.full_name || null,
          reviewed_at: row.reviewed_at,
          rejection_reason: row.rejection_reason,
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      });
    } catch (err) {
      console.error('getTimesheets exception:', err);
      return [];
    }
  },

  async submitTimesheet(payload: {
    companyId: string;
    userId: string;
    workDate: string;
    regularHours: number;
    overtimeHours: number;
    overtimeReason?: string;
    overtimeStartTime?: string | null;
    overtimeEndTime?: string | null;
    workSummary: string;
    projectId?: string | null;
    taskId?: string | null;
    ticketId?: string | null;
    isAdmin?: boolean;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // Si overtime > 0, es obligatorio justificar
      if (payload.overtimeHours > 0 && (!payload.overtimeReason || payload.overtimeReason.trim().length < 3)) {
        return { success: false, error: 'Es obligatorio justificar el motivo de las horas extras.' };
      }

      // Si se proporcionó horario de horas extras, asegurar que quede embebido en la justificación
      let formattedReason = payload.overtimeReason || null;
      if (payload.overtimeHours > 0 && payload.overtimeStartTime && payload.overtimeEndTime) {
        if (!formattedReason?.includes('[Horario:')) {
          formattedReason = `[Horario: ${payload.overtimeStartTime} a ${payload.overtimeEndTime}] ${formattedReason || ''}`.trim();
        }
      }

      // 1. Verificar si ya existe registro para ese colaborador en esa fecha
      const { data: existing } = await supabase
        .from('team_timesheets')
        .select('id, status')
        .eq('company_id', payload.companyId)
        .eq('user_id', payload.userId)
        .eq('work_date', payload.workDate)
        .maybeSingle();

      if (existing) {
        // Reglas de inmutabilidad estricta
        if ((existing.status === 'approved' || existing.status === 'paid') && !payload.isAdmin) {
          return {
            success: false,
            error: 'Esta jornada ya fue aprobada para nómina y está bloqueada contra modificaciones. Solo un administrador puede alterarla.'
          };
        }

        if (existing.status === 'submitted' && !payload.isAdmin) {
          return {
            success: false,
            error: 'Esta jornada ya fue enviada y está en cola de revisión. Una vez enviada no puede modificarse por el colaborador a menos que un administrador lo autorice.'
          };
        }

        // Si es rechazado o si es administrador, permitir actualización
        const updatePayload: any = {
          regular_hours: payload.regularHours,
          overtime_hours: payload.overtimeHours,
          overtime_reason: formattedReason,
          work_summary: payload.workSummary,
          project_id: payload.projectId || null,
          task_id: payload.taskId || null,
          ticket_id: payload.ticketId || null,
          status: existing.status === 'approved' ? (payload.isAdmin ? 'approved' : 'submitted') : 'submitted',
          rejection_reason: null,
          updated_at: new Date().toISOString(),
        };

        // Incluir columnas si existen en DB
        if (payload.overtimeStartTime) updatePayload.overtime_start_time = payload.overtimeStartTime;
        if (payload.overtimeEndTime) updatePayload.overtime_end_time = payload.overtimeEndTime;

        let { data: updated, error: updateErr } = await supabase
          .from('team_timesheets')
          .update(updatePayload)
          .eq('id', existing.id)
          .select()
          .single();

        // Fallback si las columnas nuevas de horas extras no existen aún en DB
        if (updateErr && updateErr.message?.includes('overtime_start_time')) {
          delete updatePayload.overtime_start_time;
          delete updatePayload.overtime_end_time;
          const retry = await supabase
            .from('team_timesheets')
            .update(updatePayload)
            .eq('id', existing.id)
            .select()
            .single();
          updated = retry.data;
          updateErr = retry.error;
        }

        if (updateErr) throw updateErr;
        return { success: true, data: updated };
      }

      // Registro nuevo
      const insertPayload: any = {
        company_id: payload.companyId,
        user_id: payload.userId,
        work_date: payload.workDate,
        regular_hours: payload.regularHours,
        overtime_hours: payload.overtimeHours,
        overtime_reason: formattedReason,
        work_summary: payload.workSummary,
        project_id: payload.projectId || null,
        task_id: payload.taskId || null,
        ticket_id: payload.ticketId || null,
        status: 'submitted',
      };

      if (payload.overtimeStartTime) insertPayload.overtime_start_time = payload.overtimeStartTime;
      if (payload.overtimeEndTime) insertPayload.overtime_end_time = payload.overtimeEndTime;

      let { data, error } = await supabase
        .from('team_timesheets')
        .insert([insertPayload])
        .select()
        .single();

      // Fallback si las columnas nuevas no existen aún
      if (error && error.message?.includes('overtime_start_time')) {
        delete insertPayload.overtime_start_time;
        delete insertPayload.overtime_end_time;
        const retry = await supabase
          .from('team_timesheets')
          .insert([insertPayload])
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      console.error('submitTimesheet error:', err);
      return { success: false, error: err.message || 'Error al guardar jornada' };
    }
  },

  async approveTimesheet(id: string, reviewerId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('team_timesheets')
        .update({
          status: 'approved',
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          rejection_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async rejectTimesheet(id: string, reviewerId: string, reason: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('team_timesheets')
        .update({
          status: 'rejected',
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason || 'Horas extras no autorizadas',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async unlockTimesheetForEmployee(id: string, reviewerId: string, note?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('team_timesheets')
        .update({
          status: 'rejected',
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          rejection_reason: note || 'Habilitado por el administrador para que el colaborador realice correcciones.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async deleteTimesheet(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('team_timesheets')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // ── 2. Configuraciones de Pago por Empleado (Ficha Técnica Salarial) ──

  async getPayrollConfigs(companyId: string): Promise<PayrollMemberConfig[]> {
    try {
      const { data, error } = await supabase
        .from('payroll_member_configs')
        .select(`
          *,
          user:profiles!payroll_member_configs_user_id_fkey(full_name, email, avatar_url)
        `)
        .eq('company_id', companyId);

      if (error) {
        console.warn('Error loading payroll_member_configs:', error.message);
        return [];
      }

      return (data || []).map((row: any) => {
        // Fallback de retrocompatibilidad si columnas nuevas estaban guardadas en custom_deductions
        const metaCode = row.employee_code || row.custom_deductions?.find?.((d: any) => d.id === '__meta_employee_code')?.name || '';
        const metaHireDate = row.hire_date || row.custom_deductions?.find?.((d: any) => d.id === '__meta_hire_date')?.name || '';
        const metaWeeklyHours = row.expected_weekly_hours !== undefined && row.expected_weekly_hours !== null
          ? Number(row.expected_weekly_hours)
          : (Number(row.custom_deductions?.find?.((d: any) => d.id === '__meta_weekly_hours')?.value) || 44.0);
        const metaAppliesOt = row.applies_overtime !== undefined && row.applies_overtime !== null
          ? Boolean(row.applies_overtime)
          : (row.custom_deductions?.find?.((d: any) => d.id === '__meta_applies_ot') 
              ? row.custom_deductions.find((d: any) => d.id === '__meta_applies_ot').value === 1 
              : true);
        const metaCommMode = row.commission_mode || row.custom_deductions?.find?.((d: any) => d.id === '__meta_comm_mode')?.name || 'manual';
        const metaCommRate = row.commission_rate !== undefined && row.commission_rate !== null
          ? Number(row.commission_rate)
          : (Number(row.custom_deductions?.find?.((d: any) => d.id === '__meta_comm_rate')?.value) || 0);
        const metaKpiBonus = row.bonus_kpi_default !== undefined && row.bonus_kpi_default !== null
          ? Number(row.bonus_kpi_default)
          : (Number(row.custom_deductions?.find?.((d: any) => d.id === '__meta_kpi_bonus')?.value) || 0);

        const cleanDeductions = (Array.isArray(row.custom_deductions) ? row.custom_deductions : []).filter(
          (d: any) => !d.id?.startsWith('__meta_')
        );

        return {
          id: row.id,
          company_id: row.company_id,
          user_id: row.user_id,
          user_name: row.user?.full_name || row.user?.email || 'Miembro',
          user_email: row.user?.email || '',
          user_avatar: row.user?.avatar_url || null,
          employee_code: metaCode,
          hire_date: metaHireDate,
          payment_frequency: row.payment_frequency || 'quincenal',
          contract_type: row.contract_type || 'hourly',
          hourly_rate: Number(row.hourly_rate || 0),
          base_salary: Number(row.base_salary || 0),
          expected_weekly_hours: metaWeeklyHours,
          applies_overtime: metaAppliesOt,
          overtime_multiplier: Number(row.overtime_multiplier || 1.5),
          commission_mode: metaCommMode,
          commission_rate: metaCommRate,
          bonus_kpi_default: metaKpiBonus,
          country: row.country || 'SV',
          apply_isss: row.apply_isss ?? true,
          apply_afp: row.apply_afp ?? true,
          apply_renta: row.apply_renta ?? true,
          renta_mode: row.renta_mode || 'percentage',
          renta_percentage: row.renta_percentage !== null && row.renta_percentage !== undefined ? Number(row.renta_percentage) : 10.0,
          isss_percentage: row.isss_percentage !== null && row.isss_percentage !== undefined ? Number(row.isss_percentage) : 3.0,
          afp_percentage: row.afp_percentage !== null && row.afp_percentage !== undefined ? Number(row.afp_percentage) : 7.25,
          custom_deductions: cleanDeductions,
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      });
    } catch (err) {
      console.error('getPayrollConfigs exception:', err);
      return [];
    }
  },

  async upsertPayrollConfig(config: PayrollMemberConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const payload: any = {
        company_id: config.company_id,
        user_id: config.user_id,
        employee_code: config.employee_code || null,
        hire_date: config.hire_date || null,
        payment_frequency: config.payment_frequency,
        contract_type: config.contract_type,
        hourly_rate: config.hourly_rate,
        base_salary: config.base_salary,
        expected_weekly_hours: config.expected_weekly_hours || 44.0,
        applies_overtime: config.applies_overtime ?? true,
        overtime_multiplier: config.overtime_multiplier,
        commission_mode: config.commission_mode || 'manual',
        commission_rate: config.commission_rate || 0,
        bonus_kpi_default: config.bonus_kpi_default || 0,
        country: config.country,
        apply_isss: config.apply_isss,
        apply_afp: config.apply_afp,
        apply_renta: config.apply_renta,
        renta_mode: config.renta_mode || 'percentage',
        renta_percentage: config.renta_percentage !== undefined ? config.renta_percentage : 10.0,
        isss_percentage: config.isss_percentage !== undefined ? config.isss_percentage : 3.0,
        afp_percentage: config.afp_percentage !== undefined ? config.afp_percentage : 7.25,
        custom_deductions: config.custom_deductions || [],
        updated_at: new Date().toISOString(),
      };

      let { error } = await supabase
        .from('payroll_member_configs')
        .upsert(payload, { onConflict: 'company_id,user_id' });

      // Fallback seguro si la base de datos aún no tiene ejecutada la migración de nuevas columnas
      if (error && (error.message?.includes('employee_code') || error.message?.includes('expected_weekly_hours') || error.message?.includes('applies_overtime'))) {
        console.warn('Columnas nuevas no detectadas en DB, usando compatibilidad retroactiva vía custom_deductions');
        const preservedDeds = (config.custom_deductions || []).filter((d: any) => !d.id?.startsWith('__meta_'));
        const metaRules = [
          { id: '__meta_employee_code', name: config.employee_code || '', type: 'fixed', value: 0 },
          { id: '__meta_hire_date', name: config.hire_date || '', type: 'fixed', value: 0 },
          { id: '__meta_weekly_hours', name: 'weekly_hours', type: 'fixed', value: config.expected_weekly_hours || 44.0 },
          { id: '__meta_applies_ot', name: 'applies_ot', type: 'fixed', value: config.applies_overtime ? 1 : 0 },
          { id: '__meta_comm_mode', name: config.commission_mode || 'manual', type: 'fixed', value: 0 },
          { id: '__meta_comm_rate', name: 'comm_rate', type: 'fixed', value: config.commission_rate || 0 },
          { id: '__meta_kpi_bonus', name: 'kpi_bonus', type: 'fixed', value: config.bonus_kpi_default || 0 },
        ];
        delete payload.employee_code;
        delete payload.hire_date;
        delete payload.expected_weekly_hours;
        delete payload.applies_overtime;
        delete payload.commission_mode;
        delete payload.commission_rate;
        delete payload.bonus_kpi_default;
        payload.custom_deductions = [...preservedDeds, ...metaRules];

        const retry = await supabase
          .from('payroll_member_configs')
          .upsert(payload, { onConflict: 'company_id,user_id' });
        error = retry.error;
      }

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('upsertPayrollConfig error:', err);
      return { success: false, error: err.message };
    }
  },

  // ── 3. Motor Contable de Planilla en Tiempo Real (Contador Senior) ──

  async calculatePayrollRun(params: {
    companyId: string;
    startDate: string;
    endDate: string;
    periodAdjustments?: Record<string, {
      kpiBonus?: number;
      commissionAmount?: number;
      commissionNotes?: string;
    }>;
  }): Promise<{ items: PayrollCalculationItem[]; totalGross: number; totalDeductions: number; totalNet: number }> {
    try {
      // 1. Cargar perfiles y configuraciones salariales
      const configs = await this.getPayrollConfigs(params.companyId);
      const configMap = new Map<string, PayrollMemberConfig>(configs.map(c => [c.user_id, c]));

      // 2. Cargar todos los perfiles de la empresa
      const { data: teamMembers } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .eq('company_id', params.companyId);

      // 3. Cargar todos los timesheets del período
      const timesheets = await this.getTimesheets({
        companyId: params.companyId,
        startDate: params.startDate,
        endDate: params.endDate,
      });

      // Agrupar timesheets por user_id
      const hoursMap = new Map<string, { regApproved: number; otApproved: number; otPending: number }>();
      for (const ts of timesheets) {
        const curr = hoursMap.get(ts.user_id) || { regApproved: 0, otApproved: 0, otPending: 0 };
        
        // Horas regulares entran si están submitted o approved
        if (ts.status === 'approved' || ts.status === 'submitted') {
          curr.regApproved += ts.regular_hours;
        }

        // ⛔ REGLA DE ORO: Las horas extras SOLO se pagan si están APROBADAS
        if (ts.status === 'approved') {
          curr.otApproved += ts.overtime_hours;
        } else if (ts.status === 'submitted' && ts.overtime_hours > 0) {
          curr.otPending += ts.overtime_hours;
        }

        hoursMap.set(ts.user_id, curr);
      }

      let totalGross = 0;
      let totalDeductions = 0;
      let totalNet = 0;

      const items: PayrollCalculationItem[] = (teamMembers || []).map(member => {
        const cfg: PayrollMemberConfig = configMap.get(member.id) || {
          company_id: params.companyId,
          user_id: member.id,
          employee_code: 'EMP-' + member.id.slice(0, 4).toUpperCase(),
          hire_date: '',
          payment_frequency: 'quincenal',
          contract_type: 'services_sv',
          hourly_rate: 0,
          base_salary: 0,
          expected_weekly_hours: 44.0,
          applies_overtime: true,
          overtime_multiplier: 1.5,
          country: 'SV',
          apply_isss: false,
          apply_afp: false,
          apply_renta: true,
          renta_mode: 'percentage',
          renta_percentage: 10.0,
          isss_percentage: 3.0,
          afp_percentage: 7.25,
          custom_deductions: [],
        };

        const hours = hoursMap.get(member.id) || { regApproved: 0, otApproved: 0, otPending: 0 };
        
        // ── A. Determinación de Horas Pactadas del Período ──
        // Semanal: 1 semana (ej. 44h)
        // Quincenal: 2 semanas (ej. 88h)
        // Mensual: 4 semanas (ej. 176h estándar contable)
        const weeklyHrs = Number(cfg.expected_weekly_hours || 44.0);
        let expectedPeriodHours = 0;
        if (cfg.payment_frequency === 'mensual') {
          expectedPeriodHours = +(weeklyHrs * 4).toFixed(1); // 44 * 4 = 176.0h
        } else if (cfg.payment_frequency === 'quincenal') {
          expectedPeriodHours = +(weeklyHrs * 2).toFixed(1); // 44 * 2 = 88.0h
        } else if (cfg.payment_frequency === 'semanal') {
          expectedPeriodHours = +(weeklyHrs).toFixed(1); // 44.0h
        } else {
          expectedPeriodHours = +(weeklyHrs * 2).toFixed(1);
        }

        const baseSalaryPactado = +(Number(cfg.base_salary || 0)).toFixed(2);
        const regularHoursWorked = +(hours.regApproved).toFixed(1);

        // ── B. Tarifa por Hora Efectiva (Cálculo Contable Transparente) ──
        // Si tiene Salario Fijo o Servicios Profesionales con monto mensual:
        // Tarifa Hora = Sueldo Pactado / Horas Esperadas del Período (ej: $800 / 176h = $4.5455/h)
        let effectiveHourlyRate = 0;
        const isFixedSalaryOrServices = ['salary', 'services_sv', 'services'].includes(cfg.contract_type);

        if (isFixedSalaryOrServices) {
          if (expectedPeriodHours > 0 && baseSalaryPactado > 0) {
            effectiveHourlyRate = +(baseSalaryPactado / expectedPeriodHours).toFixed(4);
          } else {
            effectiveHourlyRate = Number(cfg.hourly_rate || 0);
          }
        } else {
          // Por horas o contratista
          effectiveHourlyRate = Number(cfg.hourly_rate || 0);
        }

        // ── C. Cálculo de Salario Regular Devengado y Prorrateo ──
        let regularPay = 0;
        let hoursDeficit = 0;
        let hoursDeficitDeduction = 0;

        if (isFixedSalaryOrServices) {
          if (baseSalaryPactado > 0) {
            if (regularHoursWorked >= expectedPeriodHours) {
              // Cumplió completamente su jornada: se paga su sueldo base íntegro pactado
              regularPay = baseSalaryPactado;
              hoursDeficit = 0;
              hoursDeficitDeduction = 0;
            } else {
              // Trabajó menos de las horas pactadas
              hoursDeficit = +(expectedPeriodHours - regularHoursWorked).toFixed(1);
              if (regularHoursWorked === 0) {
                // Si no laboró ninguna hora, el descuento es el salario base pactado íntegro y devengado es $0.00
                hoursDeficitDeduction = baseSalaryPactado;
                regularPay = 0;
              } else {
                hoursDeficitDeduction = +(hoursDeficit * effectiveHourlyRate).toFixed(2);
                hoursDeficitDeduction = Math.min(hoursDeficitDeduction, baseSalaryPactado);
                regularPay = Math.max(0, +(baseSalaryPactado - hoursDeficitDeduction).toFixed(2));
              }
            }
          } else {
            // Contrato sin salario base pactado ($0.00): se devenga por horas efectivamente trabajadas
            regularPay = +(regularHoursWorked * effectiveHourlyRate).toFixed(2);
            hoursDeficit = 0;
            hoursDeficitDeduction = 0;
          }
        } else {
          // Contrato por horas estricto
          regularPay = +(regularHoursWorked * effectiveHourlyRate).toFixed(2);
          hoursDeficit = 0;
          hoursDeficitDeduction = 0;
        }

        // ── D. Cálculo de Horas Extras con Horario y Regla de Aplicación ──
        const appliesOvertime = cfg.applies_overtime ?? true;
        let overtimePay = 0;
        if (appliesOvertime && hours.otApproved > 0) {
          const otMultiplier = Number(cfg.overtime_multiplier || 1.5);
          overtimePay = +(hours.otApproved * (effectiveHourlyRate * otMultiplier)).toFixed(2);
        }

        // Recolectar detalle de horarios de horas extras laboradas
        const userOtEntries = timesheets.filter(t => t.user_id === member.id && t.overtime_hours > 0 && t.status === 'approved');
        const overtimeScheduleDetails = userOtEntries.length > 0
          ? userOtEntries.map(t => {
              const schedule = t.overtime_start_time && t.overtime_end_time 
                ? `${t.overtime_start_time} a ${t.overtime_end_time}`
                : (t.overtime_reason?.match(/\[Horario:\s*([^\]]+)\]/i)?.[1] || 'Horario extraordinario');
              return `${t.overtime_hours}h (${schedule})`;
            }).join(', ')
          : undefined;

        // ── E. Bonos por KPIs y Comisiones Parametrizadas ──
        const adj = params.periodAdjustments?.[member.id];
        const kpiBonus = adj?.kpiBonus !== undefined ? Number(adj.kpiBonus) : Number(cfg.bonus_kpi_default || 0);
        let commissionAmount = 0;
        if (adj?.commissionAmount !== undefined) {
          commissionAmount = Number(adj.commissionAmount);
        } else if (cfg.commission_mode === 'manual') {
          commissionAmount = Number(cfg.commission_rate || 0);
        }
        const commissionNotes = adj?.commissionNotes || (
          cfg.commission_mode === 'percentage_sales' && cfg.commission_rate ? `${cfg.commission_rate}% sobre ventas logradas` :
          cfg.commission_mode === 'fixed_per_deal' && cfg.commission_rate ? `$${cfg.commission_rate} por cliente/cierre` : undefined
        );

        // ── F. Total Haberes Devengados ──
        const grossPay = +(regularPay + overtimePay + kpiBonus + commissionAmount).toFixed(2);

        // ── G. Deducciones de Ley y Fiscales ──
        let isss = 0;
        let afp = 0;
        let renta = 0;

        if (cfg.country === 'SV') {
          const isProf = cfg.contract_type === 'services_sv' || cfg.contract_type === 'services';
          const isQuincenal = cfg.payment_frequency === 'quincenal';
          const svDeds = calculateElSalvadorDeductions(
            grossPay, 
            isQuincenal, 
            isProf,
            cfg.apply_isss && !isProf,
            cfg.isss_percentage ?? 3.0,
            cfg.apply_afp && !isProf,
            cfg.afp_percentage ?? 7.25,
            cfg.apply_renta,
            isProf ? 'percentage' : (cfg.renta_mode ?? 'percentage'),
            isProf ? 10.0 : (cfg.renta_percentage ?? 10.0)
          );
          isss = svDeds.isss;
          afp = svDeds.afp;
          renta = svDeds.renta;
        } else {
          // USA y Otros Países (LATAM):
          if (cfg.apply_renta && (cfg.renta_percentage ?? 0) > 0) {
            renta = +(grossPay * ((cfg.renta_percentage || 10) / 100)).toFixed(2);
          }
          if (cfg.apply_isss && (cfg.isss_percentage ?? 0) > 0) {
            isss = +(grossPay * ((cfg.isss_percentage || 0) / 100)).toFixed(2);
          }
          if (cfg.apply_afp && (cfg.afp_percentage ?? 0) > 0) {
            afp = +(grossPay * ((cfg.afp_percentage || 0) / 100)).toFixed(2);
          }
        }

        // Deducciones y bonos personalizados adicionales
        const { otherDeductions, otherAdditions } = processCustomDeductions(grossPay, cfg.custom_deductions);

        const subtotalDeductions = +(isss + afp + renta + otherDeductions).toFixed(2);
        const netPay = Math.max(0, +(grossPay - subtotalDeductions + otherAdditions).toFixed(2));

        totalGross += grossPay;
        totalDeductions += subtotalDeductions;
        totalNet += netPay;

        return {
          user_id: member.id,
          user_name: member.full_name || member.email || 'Miembro',
          user_email: member.email || '',
          user_avatar: member.avatar_url,
          employee_code: cfg.employee_code,
          hire_date: cfg.hire_date,
          country: cfg.country,
          contract_type: cfg.contract_type,
          payment_frequency: cfg.payment_frequency,
          hourly_rate: cfg.hourly_rate,
          effective_hourly_rate: effectiveHourlyRate,
          expected_period_hours: expectedPeriodHours,
          regular_hours: regularHoursWorked,
          hours_deficit: hoursDeficit,
          hours_deficit_deduction: hoursDeficitDeduction,
          overtime_hours: hours.otApproved,
          applies_overtime: appliesOvertime,
          regular_pay: regularPay,
          overtime_pay: overtimePay,
          base_salary: baseSalaryPactado,
          base_salary_part: baseSalaryPactado,
          kpi_bonus: kpiBonus,
          commission_amount: commissionAmount,
          commission_notes: commissionNotes,
          overtime_schedule_details: overtimeScheduleDetails,
          gross_pay: grossPay,
          isss,
          afp,
          renta,
          other_deductions: otherDeductions,
          other_additions: otherAdditions,
          net_pay: netPay,
          pending_overtime_count: hours.otPending,
        };
      });

      return {
        items,
        totalGross: +totalGross.toFixed(2),
        totalDeductions: +totalDeductions.toFixed(2),
        totalNet: +totalNet.toFixed(2),
      };
    } catch (err) {
      console.error('calculatePayrollRun exception:', err);
      return { items: [], totalGross: 0, totalDeductions: 0, totalNet: 0 };
    }
  }
};
