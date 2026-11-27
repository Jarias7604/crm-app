import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const esbuild = require('esbuild');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-lead-qualifier-tests-'));

let mod;
test.before(async () => {
  const outFile = path.join(tmpDir, 'helpers.mjs');
  await esbuild.build({
    entryPoints: [path.resolve('supabase/functions/lead-qualifier-engine/helpers.ts')],
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

test('1. Matches pain playbook by pain field, SIPLE product, and falls back safely', () => {
  const pb1 = mod.matchPainPlaybook(mod.DEFAULT_PAIN_PLAYBOOKS, {
    painText: 'Inventarios y productos',
    productLabel: 'ERP',
  });
  assert.equal(pb1.id, 'inventarios_productos');

  const pb2 = mod.matchPainPlaybook(mod.DEFAULT_PAIN_PLAYBOOKS, {
    painText: '',
    productLabel: 'SIPLE',
    adName: 'Carrusel - Todo en un sistema SIPLE',
  });
  assert.equal(pb2.id, 'siple_lotes');

  const pb3 = mod.matchPainPlaybook(mod.DEFAULT_PAIN_PLAYBOOKS, {
    painText: 'Otro no especificado',
    productLabel: 'ERP',
  });
  assert.equal(pb3.id, 'control_integral');
});

test('2. Renders first touch personalized message cleanly without titles or company-as-name bugs', () => {
  const pb = mod.matchPainPlaybook(mod.DEFAULT_PAIN_PLAYBOOKS, { painText: 'Facturación electrónica' });
  const msg1 = mod.renderFirstTouchMessage(mod.DEFAULT_FIRST_TOUCH_TEMPLATE, pb, {
    name: 'Lic. Evany Susana Ortiz',
    companyName: 'Susana Calvo Salón',
    painText: 'Facturación electrónica',
  });
  assert.ok(msg1.startsWith('Hola Evany,'));
  assert.ok(msg1.includes('Susana Calvo Salón'));
  assert.ok(msg1.includes('*Facturación electrónica*'));

  const msgCorp = mod.renderFirstTouchMessage(mod.DEFAULT_FIRST_TOUCH_TEMPLATE, pb, {
    name: 'Farmacia Salud Total S.A. de C.V.',
    companyName: 'Farmacia Salud Total',
    painText: 'Inventarios y productos',
  });
  assert.ok(msgCorp.startsWith('Hola,'), `Esperaba "Hola," para empresa pero fue: ${msgCorp}`);
});

test('3. Detects explicit handoff to human intents accurately across accents and phrasings', () => {
  assert.equal(mod.detectExplicitHandoffIntent('Quiero hablar con alguien por favor').isHandoff, true);
  assert.equal(mod.detectExplicitHandoffIntent('Llámame ahorita').isHandoff, true);
  assert.equal(mod.detectExplicitHandoffIntent('¿Eres un bot? Pásame con un asesor').isHandoff, true);
  assert.equal(mod.detectExplicitHandoffIntent('Ya quiero contratar el plan anual').isHandoff, true);
  assert.equal(mod.detectExplicitHandoffIntent('Manejamos 3 sucursales y 800 facturas').isHandoff, false);
});

test('4. Evaluates El Salvador business hours accurately (workday, 10pm, Saturday morning/afternoon, Sunday)', () => {
  // Monday 2026-11-23 10:00 AM SV (UTC-6 => 16:00Z)
  assert.equal(
    mod.isWithinBusinessHours(new Date('2026-11-23T16:00:00Z'), mod.DEFAULT_BUSINESS_HOURS, 'America/El_Salvador'),
    true,
  );
  // Monday 2026-11-23 10:00 PM SV (next day 04:00Z)
  assert.equal(
    mod.isWithinBusinessHours(new Date('2026-11-24T04:00:00Z'), mod.DEFAULT_BUSINESS_HOURS, 'America/El_Salvador'),
    false,
  );
  // Saturday 2026-11-28 09:30 AM SV (15:30Z) -> open
  assert.equal(
    mod.isWithinBusinessHours(new Date('2026-11-28T15:30:00Z'), mod.DEFAULT_BUSINESS_HOURS, 'America/El_Salvador'),
    true,
  );
  // Saturday 2026-11-28 02:00 PM SV (20:00Z) -> closed
  assert.equal(
    mod.isWithinBusinessHours(new Date('2026-11-28T20:00:00Z'), mod.DEFAULT_BUSINESS_HOURS, 'America/El_Salvador'),
    false,
  );
  // Sunday 2026-11-29 10:00 AM SV (16:00Z) -> closed
  assert.equal(
    mod.isWithinBusinessHours(new Date('2026-11-29T16:00:00Z'), mod.DEFAULT_BUSINESS_HOURS, 'America/El_Salvador'),
    false,
  );
});

test('5. Generates 3 conflict-free demo slots avoiding booked intervals + buffer inside working hours', () => {
  // Sunday 2026-11-22 10:00 PM SV => Monday 2026-11-23T04:00:00Z
  const now = new Date('2026-11-23T04:00:00Z');
  // Busy Monday 8:00 AM - 8:30 AM SV (14:00Z - 14:30Z) -> with 15 min buffer blocks 08:00 AM slot
  const busyIntervals = [
    { start: '2026-11-23T14:00:00Z', end: '2026-11-23T14:30:00Z' },
  ];
  const slots = mod.generateAvailableDemoSlots({
    now,
    businessHours: mod.DEFAULT_BUSINESS_HOURS,
    timezone: 'America/El_Salvador',
    durationMinutes: 30,
    bufferMinutes: 15,
    busyIntervals,
    count: 3,
  });

  assert.equal(slots.length, 3);
  assert.equal(slots[0].index, 1);
  // First slot must NOT overlap the 14:00Z busy window (8:00 AM SV)
  assert.notEqual(slots[0].startIso, '2026-11-23T14:00:00.000Z');
  assert.ok(new Date(slots[0].startIso).getTime() > new Date('2026-11-23T14:45:00Z').getTime());
});

test('6. Routes leads dynamically across fixed and round-robin rules by product', () => {
  const rules = [
    {
      id: 'r-global',
      name: 'Rotación General ERP',
      product_id: null,
      strategy: 'round_robin',
      assignee_user_ids: ['patricia-id', 'diana-id'],
      last_assigned_index: 0,
      notify_extra_user_ids: ['jimmy-id'],
      priority: 20,
      is_active: true,
    },
    {
      id: 'r-siple',
      name: 'Especialista SIPLE',
      product_id: 'siple-uuid',
      strategy: 'fixed',
      assignee_user_ids: ['jimmy-id'],
      last_assigned_index: -1,
      notify_extra_user_ids: ['patricia-id'],
      priority: 10,
      is_active: true,
    },
  ];

  // For ERP (no specific rule), uses r-global round-robin: index 0 -> next 1 (diana-id)
  const erpPick = mod.selectNextAdvisorFromRules(rules, 'erp-uuid');
  assert.equal(erpPick.rule.id, 'r-global');
  assert.equal(erpPick.advisorId, 'diana-id');
  assert.equal(erpPick.nextIndex, 1);
  assert.deepEqual(erpPick.notifyExtraUserIds, ['jimmy-id']);

  // For SIPLE, matches r-siple fixed rule -> jimmy-id
  const siplePick = mod.selectNextAdvisorFromRules(rules, 'siple-uuid');
  assert.equal(siplePick.rule.id, 'r-siple');
  assert.equal(siplePick.advisorId, 'jimmy-id');
  assert.deepEqual(siplePick.notifyExtraUserIds, ['patricia-id']);
});

test('7. Formats WhatsApp executive advisor alerts with CRM deep-link & parses AI JSON safely', () => {
  const msg = mod.buildAdvisorWhatsAppAlert({
    eventType: 'demo_booked',
    lead: {
      id: '11111111-2222-3333-4444-555555555555',
      name: 'Evany Susana Ortiz',
      company_name: 'Susana Calvo Salón',
      phone: '+50378889900',
      productLabel: 'ERP',
    },
    painText: 'Inventarios y productos',
    urgencyText: 'Lo antes posible',
    roleTitle: 'Propietaria',
    demoSlotLabel: 'Lunes 23 nov · 10:00 a. m.',
    meetLink: 'https://meet.google.com/abc-defg-hij',
    summary: '3 bodegas, urge controlar existencias e iniciar esta semana',
    crmBaseUrl: 'https://ariascrm.com/',
  });

  assert.ok(msg.includes('DEMO AGENDADA'));
  assert.ok(msg.includes('Inventarios y productos'));
  assert.ok(msg.includes('https://meet.google.com/abc-defg-hij'));
  assert.ok(msg.includes('https://ariascrm.com/leads?lead=11111111-2222-3333-4444-555555555555'));

  const parsed = mod.parseQualifierAiJson(
    '```json\n{"reply":"¡Perfecto! Te aparté el lunes a las 10 AM.","action":"book_demo","selected_slot_index":1,"detected_pain":"Inventarios","detected_volume":"500-2000","summary_for_advisor":"Quiere demo ERP"}\n```',
  );
  assert.equal(parsed.action, 'book_demo');
  assert.equal(parsed.selected_slot_index, 1);
  assert.equal(parsed.summary_for_advisor, 'Quiere demo ERP');
});

test('8. Edge Function lead-qualifier-engine/index.ts bundles cleanly without syntax/import errors', async () => {
  const indexOutFile = path.join(tmpDir, 'index.bundle.mjs');
  await esbuild.build({
    entryPoints: [path.resolve('supabase/functions/lead-qualifier-engine/index.ts')],
    bundle: true,
    platform: 'neutral',
    format: 'esm',
    outfile: indexOutFile,
    external: ['https://esm.sh/*'],
    logLevel: 'silent',
  });
  assert.ok(fs.existsSync(indexOutFile));
  assert.ok(fs.statSync(indexOutFile).size > 2000);
});

test('9. Detects Google Sheets leads accurately via source, raw_meta_payload.source, or sheet_name', () => {
  assert.equal(mod.isGoogleSheetsLead({ source: 'google_sheets' }), true);
  assert.equal(
    mod.isGoogleSheetsLead({
      source: 'facebook_ads',
      raw_meta_payload: { source: 'google_sheets', sheet_name: 'NOVIEMBRE 2026' },
    }),
    true,
  );
  assert.equal(
    mod.isGoogleSheetsLead({
      source: 'facebook_ads',
      raw_meta_payload: { sheet_name: 'DICIEMBRE 2026' },
    }),
    true,
  );
  assert.equal(mod.isGoogleSheetsLead({ source: 'manual', raw_meta_payload: null }), false);
  assert.equal(mod.isGoogleSheetsLead({ source: 'facebook_ads', raw_meta_payload: { source: 'meta' } }), false);
  assert.equal(mod.isGoogleSheetsLead(null), false);
});

test('10. Filters Google Calendar events to ignore unaccepted/optional/shared "en la lupa" and transparent items', () => {
  const events = [
    // Own busy meeting -> MUST block
    {
      status: 'confirmed',
      transparency: 'opaque',
      organizer: { email: 'jimmy@ariasdefense.com', self: true },
      start: { dateTime: '2026-11-30T15:00:00Z' },
      end: { dateTime: '2026-11-30T15:30:00Z' },
    },
    // Patricia invite "en la lupa" (needsAction) -> MUST NOT block by default
    {
      status: 'confirmed',
      transparency: 'opaque',
      organizer: { email: 'patricia@ariasdefense.com' },
      attendees: [
        { email: 'patricia@ariasdefense.com', organizer: true, responseStatus: 'accepted' },
        { email: 'jimmy@ariasdefense.com', self: true, responseStatus: 'needsAction' },
      ],
      start: { dateTime: '2026-11-30T16:00:00Z' },
      end: { dateTime: '2026-11-30T16:30:00Z' },
    },
    // Patricia invite accepted BUT optional ("en la lupa") -> MUST NOT block
    {
      status: 'confirmed',
      transparency: 'opaque',
      organizer: { email: 'patricia@ariasdefense.com' },
      attendees: [
        { email: 'jimmy@ariasdefense.com', self: true, optional: true, responseStatus: 'accepted' },
      ],
      start: { dateTime: '2026-11-30T17:00:00Z' },
      end: { dateTime: '2026-11-30T17:30:00Z' },
    },
    // Team meeting explicitly accepted & required -> MUST block
    {
      status: 'confirmed',
      transparency: 'opaque',
      organizer: { email: 'patricia@ariasdefense.com' },
      attendees: [
        { email: 'jimmy@ariasdefense.com', self: true, optional: false, responseStatus: 'accepted' },
      ],
      start: { dateTime: '2026-11-30T18:00:00Z' },
      end: { dateTime: '2026-11-30T18:30:00Z' },
    },
    // Event marked "Disponible" (transparent) -> MUST NOT block
    {
      status: 'confirmed',
      transparency: 'transparent',
      organizer: { email: 'jimmy@ariasdefense.com', self: true },
      start: { dateTime: '2026-11-30T19:00:00Z' },
      end: { dateTime: '2026-11-30T19:30:00Z' },
    },
    // Cancelled event -> MUST NOT block
    {
      status: 'cancelled',
      organizer: { email: 'jimmy@ariasdefense.com', self: true },
      start: { dateTime: '2026-11-30T20:00:00Z' },
      end: { dateTime: '2026-11-30T20:30:00Z' },
    },
    // All-day birthday/reminder -> MUST NOT block
    {
      status: 'confirmed',
      organizer: { email: 'jimmy@ariasdefense.com', self: true },
      start: { date: '2026-11-30' },
      end: { date: '2026-12-01' },
    },
  ];

  const busy = mod.filterPersonalBusyGoogleEvents(events, {
    advisorEmail: 'jimmy@ariasdefense.com',
    ignoreUnacceptedInvites: true,
    ignoreAllDayEvents: true,
  });
  assert.equal(busy.length, 2);
  assert.equal(busy[0].start, '2026-11-30T15:00:00Z');
  assert.equal(busy[1].start, '2026-11-30T18:00:00Z');
});

test('11. Calculates OpenAI gpt-4o-mini and Whisper audio USD costs accurately', () => {
  // gpt-4o-mini: 1000 prompt ($0.15/1M) + 200 completion ($0.60/1M) = 0.00015 + 0.00012 = 0.00027
  const miniCost = mod.calculateOpenAiCostUsd({
    model: 'gpt-4o-mini',
    promptTokens: 1000,
    completionTokens: 200,
  });
  assert.equal(miniCost, 0.00027);

  // whisper-1: 30s = 0.5 min * $0.006 = $0.003
  const whisperCost = mod.calculateOpenAiCostUsd({
    model: 'whisper-1',
    audioSeconds: 30,
  });
  assert.equal(whisperCost, 0.003);

  assert.equal(mod.estimateAudioDurationSeconds(45000), 15);
  assert.equal(mod.estimateAudioDurationSeconds(100), 1);
});

test('12. Edge Function google-calendar-sync/index.ts bundles cleanly without syntax/import errors', async () => {
  const calOutFile = path.join(tmpDir, 'google-calendar-sync.bundle.mjs');
  await esbuild.build({
    entryPoints: [path.resolve('supabase/functions/google-calendar-sync/index.ts')],
    bundle: true,
    platform: 'neutral',
    format: 'esm',
    outfile: calOutFile,
    external: ['https://esm.sh/*', 'https://deno.land/*'],
    logLevel: 'silent',
  });
  assert.ok(fs.existsSync(calOutFile));
  assert.ok(fs.statSync(calOutFile).size > 2000);
});
