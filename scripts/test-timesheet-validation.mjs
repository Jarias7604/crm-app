import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const esbuild = require('esbuild');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-timesheet-validation-tests-'));

let mod;
test.before(async () => {
  const outFile = path.join(tmpDir, 'timesheetValidation.mjs');
  await esbuild.build({
    entryPoints: [path.resolve('src/utils/timesheetValidation.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: outFile,
  });
  mod = await import(pathToFileURL(outFile).href);
});

test.after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('1. Exact match (8h vs 8h) allows submission without justification', () => {
  const res = mod.evaluateTimesheetHoursVariance({
    regularHours: 8,
    overtimeHours: 0,
    linkedTaskHours: 8,
    linkedTaskCount: 2,
    justification: '',
  });
  assert.equal(res.status, 'matched');
  assert.equal(res.canSubmit, true);
  assert.equal(res.requiresJustification, false);
  assert.equal(res.differenceHours, 0);
});

test('2. Minor tolerance <= 30 min (0.5h), including decimal tickets, allows submission without justification', () => {
  const minorUnder = mod.evaluateTimesheetHoursVariance({
    regularHours: 8,
    overtimeHours: 0,
    linkedTaskHours: 7.65,
    linkedTaskCount: 2,
  });
  assert.equal(minorUnder.status, 'minor_tolerance');
  assert.equal(minorUnder.canSubmit, true);
  assert.equal(minorUnder.requiresJustification, false);
  assert.equal(minorUnder.absDifferenceMinutes, 21);

  const minorOverBoundary = mod.evaluateTimesheetHoursVariance({
    regularHours: 8,
    overtimeHours: 0,
    linkedTaskHours: 8.5,
    linkedTaskCount: 1,
  });
  assert.equal(minorOverBoundary.status, 'minor_tolerance');
  assert.equal(minorOverBoundary.canSubmit, true);
  assert.equal(minorOverBoundary.requiresJustification, false);

  const decimalSum = +(0.33 + 7.42).toFixed(2);
  const decimalCase = mod.evaluateTimesheetHoursVariance({
    regularHours: 8,
    overtimeHours: 0,
    linkedTaskHours: decimalSum,
    linkedTaskCount: 2,
  });
  assert.equal(decimalCase.status, 'minor_tolerance');
  assert.equal(decimalCase.canSubmit, true);
  assert.equal(decimalCase.absDifferenceMinutes, 15);
});

test('3. Discrepancy > 30 min without justification blocks submission and requires explanation', () => {
  const underGap = mod.evaluateTimesheetHoursVariance({
    regularHours: 8,
    overtimeHours: 0,
    linkedTaskHours: 7.4,
    linkedTaskCount: 2,
  });
  assert.equal(underGap.status, 'needs_justification');
  assert.equal(underGap.requiresJustification, true);
  assert.equal(underGap.canSubmit, false);

  const overGap = mod.evaluateTimesheetHoursVariance({
    regularHours: 8,
    overtimeHours: 0,
    linkedTaskHours: 8.6,
    linkedTaskCount: 2,
  });
  assert.equal(overGap.status, 'needs_justification');
  assert.equal(overGap.requiresJustification, true);
  assert.equal(overGap.canSubmit, false);
});

test('4. Zero linked tasks without justification requires justification before submitting', () => {
  const res = mod.evaluateTimesheetHoursVariance({
    regularHours: 8,
    overtimeHours: 0,
    linkedTaskHours: 0,
    linkedTaskCount: 0,
    justification: '',
  });
  assert.equal(res.status, 'needs_justification');
  assert.equal(res.requiresJustification, true);
  assert.equal(res.canSubmit, false);
});

test('5. Filler or meaningless justifications are rejected', () => {
  const junkInputs = ['ok', 'nada', '...', '12345678', 'aaaaaaaa', 'sin motivo', 'n/a', 'ninguno'];
  for (const text of junkInputs) {
    assert.equal(
      mod.isValidHoursVarianceJustification(text),
      false,
      `Expected junk justification "${text}" to be rejected`,
    );
    const evalRes = mod.evaluateTimesheetHoursVariance({
      regularHours: 8,
      overtimeHours: 0,
      linkedTaskHours: 6,
      linkedTaskCount: 1,
      justification: text,
    });
    assert.equal(evalRes.status, 'needs_justification');
    assert.equal(evalRes.canSubmit, false);
  }
});

test('6. Meaningful justification allows submission with > 30 min variance or 0 linked tasks', () => {
  const validNote = 'Atención directa en chats de WhatsApp y reunión interna';
  assert.equal(mod.isValidHoursVarianceJustification(validNote), true);

  const withGap = mod.evaluateTimesheetHoursVariance({
    regularHours: 8,
    overtimeHours: 0,
    linkedTaskHours: 6.5,
    linkedTaskCount: 2,
    justification: validNote,
  });
  assert.equal(withGap.status, 'justified');
  assert.equal(withGap.isJustificationValid, true);
  assert.equal(withGap.canSubmit, true);

  const zeroTasks = mod.evaluateTimesheetHoursVariance({
    regularHours: 8,
    overtimeHours: 0,
    linkedTaskHours: 0,
    linkedTaskCount: 0,
    justification: validNote,
  });
  assert.equal(zeroTasks.status, 'justified');
  assert.equal(zeroTasks.isJustificationValid, true);
  assert.equal(zeroTasks.canSubmit, true);
});

test('7. Zero total workday hours returns invalid_total and cannot submit', () => {
  const res = mod.evaluateTimesheetHoursVariance({
    regularHours: 0,
    overtimeHours: 0,
    linkedTaskHours: 0,
    linkedTaskCount: 0,
    justification: 'Capacitación interna del equipo de soporte',
  });
  assert.equal(res.status, 'invalid_total');
  assert.equal(res.canSubmit, false);
});

test('8. TS_META serialization, legacy backwards compatibility, and computeTimesheetTasksSummary', () => {
  const serializedWithTasks = mod.serializeWorkSummaryWithMeta({
    workSummary: 'Revisión DTE y soporte WhatsApp',
    projectIds: ['p1'],
    linkedTasks: [{ id: 't1', title: 'Ticket MH', type: 'ticket', hours: 6.5 }],
    hoursVarianceJustification: '1.5h en llamadas y soporte rápido en grupos sin ticket',
  });
  assert.ok(serializedWithTasks.includes('<!--TS_META:'));

  const parsedWithTasks = mod.parseWorkSummaryMeta(serializedWithTasks);
  assert.equal(parsedWithTasks.cleanSummary, 'Revisión DTE y soporte WhatsApp');
  assert.deepEqual(parsedWithTasks.projectIds, ['p1']);
  assert.equal(parsedWithTasks.linkedTasks.length, 1);
  assert.equal(
    parsedWithTasks.hoursVarianceJustification,
    '1.5h en llamadas y soporte rápido en grupos sin ticket',
  );

  // Zero tasks + justification only
  const serializedNoTasks = mod.serializeWorkSummaryWithMeta({
    workSummary: 'Atención general en chats de soporte',
    projectIds: [],
    linkedTasks: [],
    hoursVarianceJustification: 'Soporte continuo en WhatsApp de clientes sin ticket creado',
  });
  const parsedNoTasks = mod.parseWorkSummaryMeta(serializedNoTasks);
  assert.equal(parsedNoTasks.cleanSummary, 'Atención general en chats de soporte');
  assert.equal(parsedNoTasks.linkedTasks.length, 0);
  assert.equal(
    parsedNoTasks.hoursVarianceJustification,
    'Soporte continuo en WhatsApp de clientes sin ticket creado',
  );

  // Legacy TS_META without `j`
  const legacyRaw = 'Trabajo previo\n<!--TS_META:{"p":["p1"],"t":[{"id":"k1","title":"Fix","type":"task","hours":8}]}-->';
  const parsedLegacy = mod.parseWorkSummaryMeta(legacyRaw);
  assert.equal(parsedLegacy.cleanSummary, 'Trabajo previo');
  assert.equal(parsedLegacy.hoursVarianceJustification, null);
  assert.equal(parsedLegacy.linkedTasks.length, 1);

  // Supervisor summary helper
  const summaryWithVariance = mod.computeTimesheetTasksSummary({
    regular_hours: 8,
    overtime_hours: 0,
    linked_tasks: [{ id: 't1', title: 'Ticket MH', type: 'ticket', hours: 6.5 }],
    hours_variance_justification: '1.5h en soporte por WhatsApp',
  });
  assert.equal(summaryWithVariance.totalWorkdayHours, 8);
  assert.equal(summaryWithVariance.linkedTaskCount, 1);
  assert.equal(summaryWithVariance.linkedTaskHours, 6.5);
  assert.equal(summaryWithVariance.differenceHours, 1.5);
  assert.equal(summaryWithVariance.hasSignificantVariance, true);
  assert.equal(summaryWithVariance.hasAnyTasks, true);
  assert.equal(summaryWithVariance.justification, '1.5h en soporte por WhatsApp');
});
