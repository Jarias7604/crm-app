import type { TimesheetLinkedTask } from '../types/timesheets';

export const TIMESHEET_MATCH_EPSILON_HOURS = 0.01;
export const TIMESHEET_MINOR_TOLERANCE_HOURS = 0.5;
export const TIMESHEET_JUSTIFICATION_MIN_CHARS = 8;

export type TimesheetVarianceStatus =
  | 'invalid_total'
  | 'matched'
  | 'minor_tolerance'
  | 'needs_justification'
  | 'justified';

export interface TimesheetVarianceEvaluation {
  status: TimesheetVarianceStatus;
  totalWorkdayHours: number;
  linkedTaskHours: number;
  differenceHours: number;
  absDifferenceHours: number;
  absDifferenceMinutes: number;
  requiresJustification: boolean;
  isJustificationValid: boolean;
  canSubmit: boolean;
  trimmedJustification: string;
}

const NON_ANSWER_JUSTIFICATION_REGEX =
  /^(?:ningun[ao]?|sin\s+motivo|sin\s+justificacion|no\s+aplica|sin\s+comentarios?|n\/?a|nada|ok+|prueba|test|ninguno|xd+)[.\s!¡?¿-]*$/i;

export function isValidHoursVarianceJustification(raw?: string | null): boolean {
  const clean = String(raw || '').replace(/\s+/g, ' ').trim();
  if (clean.length < TIMESHEET_JUSTIFICATION_MIN_CHARS) return false;

  const letters = clean.match(/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/g) || [];
  if (letters.length < 4) return false;

  if (/^(.)\1+$/i.test(clean.replace(/\s+/g, ''))) return false;

  const accentNormalized = clean
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (NON_ANSWER_JUSTIFICATION_REGEX.test(accentNormalized)) return false;

  return true;
}

export function evaluateTimesheetHoursVariance(input: {
  regularHours: number;
  overtimeHours: number;
  linkedTaskHours: number;
  linkedTaskCount: number;
  justification?: string | null;
}): TimesheetVarianceEvaluation {
  const totalWorkdayHours = +(
    Math.max(0, Number(input.regularHours) || 0) +
    Math.max(0, Number(input.overtimeHours) || 0)
  ).toFixed(2);
  const linkedTaskHours = +Math.max(0, Number(input.linkedTaskHours) || 0).toFixed(2);
  const differenceHours = +(totalWorkdayHours - linkedTaskHours).toFixed(2);
  const absDifferenceHours = +Math.abs(differenceHours).toFixed(2);
  const absDifferenceMinutes = Math.round(absDifferenceHours * 60);
  const trimmedJustification = String(input.justification || '').replace(/\s+/g, ' ').trim();
  const isJustificationValid = isValidHoursVarianceJustification(trimmedJustification);

  if (totalWorkdayHours <= 0) {
    return {
      status: 'invalid_total',
      totalWorkdayHours,
      linkedTaskHours,
      differenceHours,
      absDifferenceHours,
      absDifferenceMinutes,
      requiresJustification: false,
      isJustificationValid,
      canSubmit: false,
      trimmedJustification,
    };
  }

  if (input.linkedTaskCount > 0 && absDifferenceHours < TIMESHEET_MATCH_EPSILON_HOURS) {
    return {
      status: 'matched',
      totalWorkdayHours,
      linkedTaskHours,
      differenceHours,
      absDifferenceHours,
      absDifferenceMinutes,
      requiresJustification: false,
      isJustificationValid,
      canSubmit: true,
      trimmedJustification,
    };
  }

  if (input.linkedTaskCount > 0 && absDifferenceHours <= TIMESHEET_MINOR_TOLERANCE_HOURS) {
    return {
      status: 'minor_tolerance',
      totalWorkdayHours,
      linkedTaskHours,
      differenceHours,
      absDifferenceHours,
      absDifferenceMinutes,
      requiresJustification: false,
      isJustificationValid,
      canSubmit: true,
      trimmedJustification,
    };
  }

  return {
    status: isJustificationValid ? 'justified' : 'needs_justification',
    totalWorkdayHours,
    linkedTaskHours,
    differenceHours,
    absDifferenceHours,
    absDifferenceMinutes,
    requiresJustification: true,
    isJustificationValid,
    canSubmit: isJustificationValid,
    trimmedJustification,
  };
}

export function parseWorkSummaryMeta(rawSummary?: string | null): {
  cleanSummary: string;
  projectIds: string[];
  linkedTasks: TimesheetLinkedTask[];
  hoursVarianceJustification: string | null;
} {
  let cleanSummary = String(rawSummary || '');
  let projectIds: string[] = [];
  let linkedTasks: TimesheetLinkedTask[] = [];
  let hoursVarianceJustification: string | null = null;

  const metaMatch = cleanSummary.match(/\n?<!--TS_META:([\s\S]*?)-->/);
  if (metaMatch) {
    cleanSummary = cleanSummary.replace(metaMatch[0], '').trim();
    try {
      const parsed = JSON.parse(metaMatch[1]);
      if (Array.isArray(parsed.p)) projectIds = parsed.p.filter(Boolean);
      if (Array.isArray(parsed.t)) linkedTasks = parsed.t;
      if (typeof parsed.j === 'string' && parsed.j.trim()) {
        hoursVarianceJustification = parsed.j.trim();
      }
    } catch {
      // Ignore malformed metadata block so the visible summary remains intact
    }
  } else {
    cleanSummary = cleanSummary.trim();
  }

  return {
    cleanSummary,
    projectIds,
    linkedTasks,
    hoursVarianceJustification,
  };
}

export function serializeWorkSummaryWithMeta(input: {
  workSummary: string;
  projectIds?: string[];
  linkedTasks?: TimesheetLinkedTask[];
  hoursVarianceJustification?: string | null;
}): string {
  const cleanSummary = String(input.workSummary || '')
    .replace(/\n?<!--TS_META:[\s\S]*?-->/g, '')
    .trim();
  const projectIds = Array.isArray(input.projectIds) ? input.projectIds.filter(Boolean) : [];
  const linkedTasks = Array.isArray(input.linkedTasks) ? input.linkedTasks : [];
  const justification = String(input.hoursVarianceJustification || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (projectIds.length > 0 || linkedTasks.length > 0 || Boolean(justification)) {
    const meta: {
      p: string[];
      t: TimesheetLinkedTask[];
      j?: string;
    } = {
      p: projectIds,
      t: linkedTasks,
      ...(justification ? { j: justification } : {}),
    };
    return `${cleanSummary}\n<!--TS_META:${JSON.stringify(meta)}-->`;
  }

  return cleanSummary;
}

export function computeTimesheetTasksSummary(entry: {
  regular_hours: number;
  overtime_hours: number;
  linked_tasks?: TimesheetLinkedTask[];
  hours_variance_justification?: string | null;
}) {
  const totalWorkdayHours = +(
    Math.max(0, Number(entry.regular_hours) || 0) +
    Math.max(0, Number(entry.overtime_hours) || 0)
  ).toFixed(2);
  const linkedTasks = Array.isArray(entry.linked_tasks) ? entry.linked_tasks : [];
  const linkedTaskCount = linkedTasks.length;
  const linkedTaskHours = +linkedTasks
    .reduce((sum, t) => sum + Number(t.hours || 0), 0)
    .toFixed(2);
  const differenceHours = +(totalWorkdayHours - linkedTaskHours).toFixed(2);
  const absDifferenceHours = +Math.abs(differenceHours).toFixed(2);
  const justification =
    typeof entry.hours_variance_justification === 'string' && entry.hours_variance_justification.trim()
      ? entry.hours_variance_justification.trim()
      : null;
  const hasAnyTasks = linkedTaskCount > 0;
  const hasSignificantVariance =
    Boolean(justification) ||
    (linkedTaskCount > 0 && absDifferenceHours > TIMESHEET_MINOR_TOLERANCE_HOURS) ||
    (linkedTaskCount === 0 && totalWorkdayHours > 0 && Boolean(justification));

  return {
    totalWorkdayHours,
    linkedTaskCount,
    linkedTaskHours,
    differenceHours,
    absDifferenceHours,
    hasAnyTasks,
    hasSignificantVariance,
    justification,
  };
}
