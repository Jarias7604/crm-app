export type TimesheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';

export interface TimesheetEntry {
  id: string;
  company_id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  user_avatar?: string | null;
  work_date: string;
  regular_hours: number;
  overtime_hours: number;
  overtime_reason?: string | null;
  work_summary: string;
  project_id?: string | null;
  project_name?: string | null;
  task_id?: string | null;
  task_title?: string | null;
  ticket_id?: string | null;
  ticket_title?: string | null;
  status: TimesheetStatus;
  reviewed_by?: string | null;
  reviewed_name?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export type PayrollCountry = 'SV' | 'US' | 'OTHER';
export type PaymentFrequency = 'semanal' | 'quincenal' | 'mensual' | 'por_hora';
export type ContractType = 'hourly' | 'salary' | 'contractor_1099' | 'services_sv';

export interface CustomDeductionRule {
  id: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  is_addition?: boolean; // true para bonos/viáticos, false para descuentos
}

export interface PayrollMemberConfig {
  id?: string;
  company_id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  user_avatar?: string | null;
  payment_frequency: PaymentFrequency;
  contract_type: ContractType;
  hourly_rate: number;
  base_salary: number;
  overtime_multiplier: number;
  country: PayrollCountry;
  apply_isss: boolean;
  apply_afp: boolean;
  apply_renta: boolean;
  renta_mode?: 'percentage' | 'table' | 'none';
  renta_percentage?: number;
  isss_percentage?: number;
  afp_percentage?: number;
  custom_deductions: CustomDeductionRule[];
  created_at?: string;
  updated_at?: string;
}

export interface PayrollCalculationItem {
  user_id: string;
  user_name: string;
  user_email: string;
  user_avatar?: string | null;
  country: PayrollCountry;
  contract_type: ContractType;
  hourly_rate: number;
  regular_hours: number;
  overtime_hours: number;
  regular_pay: number;
  overtime_pay: number;
  base_salary_part: number;
  gross_pay: number;
  isss: number;
  afp: number;
  renta: number;
  other_deductions: number;
  other_additions: number;
  net_pay: number;
  pending_overtime_count: number;
}

export interface PayrollRun {
  id: string;
  company_id: string;
  period_start: string;
  period_end: string;
  name: string;
  status: 'draft' | 'approved' | 'paid';
  total_gross: number;
  total_deductions: number;
  total_net: number;
  created_by?: string | null;
  paid_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}
