import { addMonths, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export type ContractExpirationSeverity = 'active' | 'notice' | 'warning' | 'urgent' | 'expired' | 'indefinite';

export interface ContractExpirationInfo {
  status: ContractExpirationSeverity;
  daysLeft: number | null;
  label: string;
  badgeText: string;
  colorClass: {
    badge: string;
    text: string;
    border: string;
    bg: string;
    dot: string;
  };
}

/**
 * Normaliza una fecha string YYYY-MM-DD para evitar desfaces de huso horario UTC
 */
export function parseLocalDate(dateStr: string): Date {
  const clean = dateStr.substring(0, 10);
  return new Date(`${clean}T12:00:00`);
}

/**
 * Calcula automáticamente fecha_fin y fecha_primer_cobro a partir de vigencia y meses gratis
 */
export function calculateContractDates(
  fechaInicioStr?: string | null,
  vigenciaMeses: number = 12,
  mesesGracia: number = 0
): {
  fechaInicio: string;
  fechaFin: string;
  fechaPrimerCobro: string;
} {
  const inicio = parseLocalDate(fechaInicioStr || format(new Date(), 'yyyy-MM-dd'));
  const fin = addMonths(inicio, Math.max(1, vigenciaMeses));
  const primerCobro = mesesGracia > 0 ? addMonths(inicio, mesesGracia) : inicio;

  return {
    fechaInicio: format(inicio, 'yyyy-MM-dd'),
    fechaFin: format(fin, 'yyyy-MM-dd'),
    fechaPrimerCobro: format(primerCobro, 'yyyy-MM-dd'),
  };
}

/**
 * Analiza el estado de vencimiento de un contrato para generar recordatorios y alertas
 */
export function getContractExpirationInfo(fechaFinStr: string | null | undefined): ContractExpirationInfo {
  if (!fechaFinStr) {
    return {
      status: 'indefinite',
      daysLeft: null,
      label: 'Sin fecha de vencimiento',
      badgeText: 'Indefinido',
      colorClass: {
        badge: 'bg-slate-100 text-slate-600 border-slate-200',
        text: 'text-slate-600',
        border: 'border-slate-200',
        bg: 'bg-slate-50',
        dot: 'bg-slate-400',
      },
    };
  }

  const hoy = new Date();
  hoy.setHours(12, 0, 0, 0);
  const fin = parseLocalDate(fechaFinStr);
  const daysLeft = differenceInCalendarDays(fin, hoy);

  if (daysLeft < 0) {
    const daysAgo = Math.abs(daysLeft);
    return {
      status: 'expired',
      daysLeft,
      label: `Vencido hace ${daysAgo} día${daysAgo === 1 ? '' : 's'}`,
      badgeText: `Vencido (${daysAgo}d)`,
      colorClass: {
        badge: 'bg-rose-100 text-rose-700 border-rose-200',
        text: 'text-rose-600',
        border: 'border-rose-200',
        bg: 'bg-rose-50/70',
        dot: 'bg-rose-500',
      },
    };
  }

  if (daysLeft <= 30) {
    return {
      status: 'urgent',
      daysLeft,
      label: daysLeft === 0 ? 'Vence hoy' : `¡Vence en ${daysLeft} día${daysLeft === 1 ? '' : 's'}!`,
      badgeText: daysLeft === 0 ? 'Vence hoy' : `Vence en ${daysLeft}d`,
      colorClass: {
        badge: 'bg-amber-100 text-amber-800 border-amber-300 font-black animate-pulse',
        text: 'text-amber-700',
        border: 'border-amber-300',
        bg: 'bg-amber-50/80',
        dot: 'bg-amber-500',
      },
    };
  }

  if (daysLeft <= 60) {
    return {
      status: 'warning',
      daysLeft,
      label: `Próximo a vencer (${daysLeft} días)`,
      badgeText: `Por vencer (${daysLeft}d)`,
      colorClass: {
        badge: 'bg-yellow-50 text-yellow-800 border-yellow-200 font-bold',
        text: 'text-yellow-700',
        border: 'border-yellow-200',
        bg: 'bg-yellow-50/60',
        dot: 'bg-yellow-500',
      },
    };
  }

  if (daysLeft <= 90) {
    return {
      status: 'notice',
      daysLeft,
      label: `Vence en ~${Math.ceil(daysLeft / 30)} meses (${daysLeft} días)`,
      badgeText: `~${Math.ceil(daysLeft / 30)} meses`,
      colorClass: {
        badge: 'bg-blue-50 text-blue-700 border-blue-200 font-semibold',
        text: 'text-blue-700',
        border: 'border-blue-200',
        bg: 'bg-blue-50/50',
        dot: 'bg-blue-500',
      },
    };
  }

  return {
    status: 'active',
    daysLeft,
    label: `Vigente (${Math.floor(daysLeft / 30)} meses restantes)`,
    badgeText: 'Vigente',
    colorClass: {
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      bg: 'bg-emerald-50/50',
      dot: 'bg-emerald-500',
    },
  };
}

/**
 * Formatea una fecha ISO o string en español legible (ej: "15 Nov 2026")
 */
export function formatContractDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = parseLocalDate(dateStr);
    return format(d, 'dd MMM yyyy', { locale: es });
  } catch {
    return dateStr;
  }
}
