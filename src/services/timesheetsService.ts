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

      return (data || []).map((row: any) => ({
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
      }));
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
        const { data: updated, error: updateErr } = await supabase
          .from('team_timesheets')
          .update({
            regular_hours: payload.regularHours,
            overtime_hours: payload.overtimeHours,
            overtime_reason: payload.overtimeReason || null,
            work_summary: payload.workSummary,
            project_id: payload.projectId || null,
            task_id: payload.taskId || null,
            ticket_id: payload.ticketId || null,
            status: existing.status === 'approved' ? (payload.isAdmin ? 'approved' : 'submitted') : 'submitted',
            rejection_reason: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (updateErr) throw updateErr;
        return { success: true, data: updated };
      }

      // Registro nuevo
      const { data, error } = await supabase
        .from('team_timesheets')
        .insert([{
          company_id: payload.companyId,
          user_id: payload.userId,
          work_date: payload.workDate,
          regular_hours: payload.regularHours,
          overtime_hours: payload.overtimeHours,
          overtime_reason: payload.overtimeReason || null,
          work_summary: payload.workSummary,
          project_id: payload.projectId || null,
          task_id: payload.taskId || null,
          ticket_id: payload.ticketId || null,
          status: 'submitted',
        }])
        .select()
        .single();

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

  // ── 2. Configuraciones de Pago por Empleado ──────────────────

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

      return (data || []).map((row: any) => ({
        id: row.id,
        company_id: row.company_id,
        user_id: row.user_id,
        user_name: row.user?.full_name || row.user?.email || 'Miembro',
        user_email: row.user?.email || '',
        user_avatar: row.user?.avatar_url || null,
        payment_frequency: row.payment_frequency || 'quincenal',
        contract_type: row.contract_type || 'hourly',
        hourly_rate: Number(row.hourly_rate || 0),
        base_salary: Number(row.base_salary || 0),
        overtime_multiplier: Number(row.overtime_multiplier || 1.5),
        country: row.country || 'SV',
        apply_isss: row.apply_isss ?? true,
        apply_afp: row.apply_afp ?? true,
        apply_renta: row.apply_renta ?? true,
        renta_mode: row.renta_mode || 'percentage',
        renta_percentage: row.renta_percentage !== null && row.renta_percentage !== undefined ? Number(row.renta_percentage) : 10.0,
        isss_percentage: row.isss_percentage !== null && row.isss_percentage !== undefined ? Number(row.isss_percentage) : 3.0,
        afp_percentage: row.afp_percentage !== null && row.afp_percentage !== undefined ? Number(row.afp_percentage) : 7.25,
        custom_deductions: Array.isArray(row.custom_deductions) ? row.custom_deductions : [],
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
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
        payment_frequency: config.payment_frequency,
        contract_type: config.contract_type,
        hourly_rate: config.hourly_rate,
        base_salary: config.base_salary,
        overtime_multiplier: config.overtime_multiplier,
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

      const { error } = await supabase
        .from('payroll_member_configs')
        .upsert(payload, { onConflict: 'company_id,user_id' });

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('upsertPayrollConfig error:', err);
      return { success: false, error: err.message };
    }
  },

  // ── 3. Generación y Cálculo de Planilla en Tiempo Real ──────────

  async calculatePayrollRun(params: {
    companyId: string;
    startDate: string;
    endDate: string;
  }): Promise<{ items: PayrollCalculationItem[]; totalGross: number; totalDeductions: number; totalNet: number }> {
    try {
      // 1. Cargar perfiles y configuraciones
      const configs = await this.getPayrollConfigs(params.companyId);
      const configMap = new Map<string, PayrollMemberConfig>(configs.map(c => [c.user_id, c]));

      // 2. Cargar todos los perfiles de la empresa (para incluir a quienes no tengan config configurada aún)
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
        
        // Horas regulares entran si están submitted o approved (o solo approved si estricto)
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
          payment_frequency: 'quincenal',
          contract_type: 'hourly',
          hourly_rate: 0,
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
        };

        const hours = hoursMap.get(member.id) || { regApproved: 0, otApproved: 0, otPending: 0 };
        
        let regularPay = 0;
        let overtimePay = 0;
        let baseSalaryPart = 0;

        if (cfg.contract_type === 'salary') {
          // Salario fijo (quincenal = mitad de mensual, o completo)
          baseSalaryPart = +(cfg.base_salary || 0).toFixed(2);
          // Si tiene horas extras aprobadas, la tarifa por hora se infiere o usa hourly_rate
          const rate = cfg.hourly_rate > 0 ? cfg.hourly_rate : (cfg.base_salary / 160);
          overtimePay = +(hours.otApproved * (rate * cfg.overtime_multiplier)).toFixed(2);
        } else {
          // Por horas o contratista
          regularPay = +(hours.regApproved * cfg.hourly_rate).toFixed(2);
          overtimePay = +(hours.otApproved * (cfg.hourly_rate * cfg.overtime_multiplier)).toFixed(2);
        }

        const grossPay = +(baseSalaryPart + regularPay + overtimePay).toFixed(2);

        let isss = 0;
        let afp = 0;
        let renta = 0;

        if (cfg.country === 'SV') {
          const isProf = cfg.contract_type === 'services_sv';
          const isQuincenal = cfg.payment_frequency === 'quincenal';
          const svDeds = calculateElSalvadorDeductions(
            grossPay, 
            isQuincenal, 
            isProf,
            cfg.apply_isss,
            cfg.isss_percentage ?? 3.0,
            cfg.apply_afp,
            cfg.afp_percentage ?? 7.25,
            cfg.apply_renta,
            cfg.renta_mode ?? 'percentage',
            cfg.renta_percentage ?? 10.0
          );
          isss = svDeds.isss;
          afp = svDeds.afp;
          renta = svDeds.renta;
        } else {
          // USA y Otros Países (LATAM):
          // Renta editable directa si aplica
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

        // Deducciones y bonos personalizados
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
          country: cfg.country,
          contract_type: cfg.contract_type,
          hourly_rate: cfg.hourly_rate,
          regular_hours: hours.regApproved,
          overtime_hours: hours.otApproved,
          regular_pay: regularPay,
          overtime_pay: overtimePay,
          base_salary_part: baseSalaryPart,
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
