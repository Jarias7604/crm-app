import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const esbuild = require('esbuild');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-support-pulse-tests-'));

async function loadModules() {
  const pulseOut = path.join(tmpDir, 'supportPulse.mjs');
  const ticketsOut = path.join(tmpDir, 'tickets.mjs');

  await Promise.all([
    esbuild.build({
      entryPoints: [path.resolve('src/pages/support/supportPulse.ts')],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile: pulseOut,
    }),
    esbuild.build({
      entryPoints: [path.resolve('src/services/tickets.ts')],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile: ticketsOut,
      plugins: [
        {
          name: 'mock-supabase-and-scopes',
          setup(build) {
            build.onResolve({ filter: /(?:^|[\\/])supabase(?:\.ts)?$/ }, () => ({
              path: 'mock-supabase',
              namespace: 'mock',
            }));
            build.onLoad({ filter: /mock-supabase/, namespace: 'mock' }, () => ({
              contents: 'export const supabase = {};',
              loader: 'js',
            }));
          },
        },
      ],
    }),
  ]);

  const [supportPulse, ticketsMod] = await Promise.all([
    import(pathToFileURL(pulseOut).href),
    import(pathToFileURL(ticketsOut).href),
  ]);

  return { supportPulse, ticketsMod };
}

let loaded;
test.before(async () => {
  loaded = await loadModules();
});

test.after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('1. Deduplicates whatsapp_messages and ticket_comments via comment_id and 15s echo guard', () => {
  const { computeSupportWhatsAppPulse } = loaded.supportPulse;
  const nowMs = Date.parse('2026-11-20T18:00:00.000Z');
  const tickets = [
    {
      id: 't1',
      lead_name: 'Corporación Argoz',
      metadata: { source: 'whatsapp_evolution', whatsapp_jid: '120363000@g.us' },
    },
  ];
  const profiles = [{ id: 'u-melvin', full_name: 'Melvin Rodriguez', phone: '+50370000001' }];
  const comments = [
    {
      id: 'c1',
      ticket_id: 't1',
      author_id: null,
      body: '[10:00 a. m.] 👤 Cliente: No carga DTE',
      is_internal: false,
      created_at: '2026-11-20T16:00:00.000Z',
    },
    {
      id: 'c2',
      ticket_id: 't1',
      author_id: 'u-melvin',
      body: '[10:02 a. m.] 👨‍💻 Melvin Rodriguez: Ya reviso',
      is_internal: false,
      created_at: '2026-11-20T16:02:00.000Z',
    },
    // Internal note must be ignored
    {
      id: 'c-int',
      ticket_id: 't1',
      author_id: 'u-melvin',
      body: 'Nota interna: prueba',
      is_internal: true,
      created_at: '2026-11-20T16:03:00.000Z',
    },
    // CRM comment without comment_id link, echoed 4s later in whatsapp_messages
    {
      id: 'c3-crm',
      ticket_id: 't1',
      author_id: 'u-melvin',
      body: '[10:05 a. m.] 👨‍💻 Melvin Rodriguez: Listo, prueba ahora',
      is_internal: false,
      created_at: '2026-11-20T16:05:00.000Z',
    },
  ];
  const waMessages = [
    {
      id: 'w1',
      ticket_id: 't1',
      comment_id: 'c1',
      from_me: false,
      sender_name: 'Cliente',
      message_ts: '2026-11-20T16:00:00.000Z',
    },
    {
      id: 'w2',
      ticket_id: 't1',
      comment_id: 'c2',
      from_me: true,
      message_ts: '2026-11-20T16:02:00.000Z',
    },
    {
      id: 'w3',
      ticket_id: 't1',
      comment_id: null,
      from_me: true,
      sender_phone: '50370000001',
      message_ts: '2026-11-20T16:05:04.000Z',
    },
  ];

  const pulse = computeSupportWhatsAppPulse({
    tickets,
    waMessages,
    comments,
    profiles,
    options: { daysRange: 7, nowMs },
  });

  // Only 3 distinct non-internal messages (c1, c2, w3/c3-crm)
  assert.equal(pulse.summary.totalMessages, 3);
  assert.equal(pulse.summary.clientMessages, 1);
  assert.equal(pulse.summary.staffMessages, 2);
  assert.equal(pulse.techChatMetrics['Melvin Rodriguez'].staffMessages, 2);
});

test('2. Attributes staff across author_id, comment emoji prefix, sender_phone, and from_me fallback', () => {
  const { computeSupportWhatsAppPulse } = loaded.supportPulse;
  const nowMs = Date.parse('2026-11-20T18:00:00.000Z');
  const tickets = [{ id: 't1', lead_name: 'Cartopaq', metadata: { source: 'whatsapp_evolution' } }];
  const profiles = [
    { id: 'u-melvin', full_name: 'Melvin Rodriguez', phone: '+503 7777-1111' },
    { id: 'u-gerson', full_name: 'Gerson Gutierrez', phone: '+503 7777-2222' },
  ];
  const comments = [
    {
      id: 'c-auth',
      ticket_id: 't1',
      author_id: 'u-melvin',
      body: 'Hola',
      is_internal: false,
      created_at: '2026-11-20T15:00:00.000Z',
    },
    {
      id: 'c-prefix',
      ticket_id: 't1',
      author_id: null,
      body: '[09:10] 👨‍💻 Gerson: Voy revisando',
      is_internal: false,
      created_at: '2026-11-20T15:10:00.000Z',
    },
    // AI Bot should count in staffMessages total, NOT as human effort in techChatMetrics
    {
      id: 'c-ai',
      ticket_id: 't1',
      author_id: null,
      body: '[09:12] 👨‍💻 Asistente IA Soporte: Recibido',
      is_internal: false,
      created_at: '2026-11-20T15:12:00.000Z',
    },
  ];
  const waMessages = [
    {
      id: 'w-phone',
      ticket_id: 't1',
      comment_id: null,
      from_me: true,
      sender_phone: '77771111',
      message_ts: '2026-11-20T15:20:00.000Z',
    },
    {
      id: 'w-fallback',
      ticket_id: 't1',
      comment_id: null,
      from_me: true,
      message_ts: '2026-11-20T15:35:00.000Z',
    },
  ];

  const pulse = computeSupportWhatsAppPulse({
    tickets,
    waMessages,
    comments,
    profiles,
    options: { daysRange: 7, nowMs },
  });

  assert.equal(pulse.summary.staffMessages, 5);
  assert.equal(pulse.techChatMetrics['Melvin Rodriguez'].staffMessages, 2);
  assert.equal(pulse.techChatMetrics['Gerson Gutierrez'].staffMessages, 1);
  assert.equal(pulse.techChatMetrics['WhatsApp Soporte'].staffMessages, 1);
});

test('3. Computes burst-based active chat time accurately across gaps', () => {
  const { computeSupportWhatsAppPulse } = loaded.supportPulse;
  const nowMs = Date.parse('2026-11-20T19:00:00.000Z');
  const tickets = [{ id: 't1', lead_name: 'La Económica', metadata: { source: 'whatsapp_evolution' } }];
  const profiles = [{ id: 'u-melvin', full_name: 'Melvin Rodriguez' }];

  // Burst 1: 14:00 (base 2.5m) + 14:05 (+5m) + 14:15 (+10m) = 17.5m
  // 2h gap -> Burst 2: 16:15 (base 2.5m)
  // Total = 20m -> Math.round = 20 min -> 0.3h
  const comments = [
    { id: 'c1', ticket_id: 't1', author_id: 'u-melvin', body: '1', created_at: '2026-11-20T14:00:00.000Z' },
    { id: 'c2', ticket_id: 't1', author_id: 'u-melvin', body: '2', created_at: '2026-11-20T14:05:00.000Z' },
    { id: 'c3', ticket_id: 't1', author_id: 'u-melvin', body: '3', created_at: '2026-11-20T14:15:00.000Z' },
    { id: 'c4', ticket_id: 't1', author_id: 'u-melvin', body: '4', created_at: '2026-11-20T16:15:00.000Z' },
  ];
  // Force alert threshold 4 so we also inspect estMinutes on the ticket
  const pulse = computeSupportWhatsAppPulse({
    tickets,
    waMessages: [],
    comments,
    profiles,
    options: { daysRange: 7, pingPongThreshold: 4, nowMs },
  });

  assert.equal(pulse.pingPongAlerts.length, 1);
  assert.equal(pulse.pingPongAlerts[0].estMinutes, 20);
  assert.equal(pulse.summary.estTotalStaffHours, 0.3);
});

test('4. Detects Ping-Pong chats (>= 12 msgs in one El Salvador day) and daily active client counts', () => {
  const { computeSupportWhatsAppPulse } = loaded.supportPulse;
  const nowMs = Date.parse('2026-11-20T22:00:00.000Z');
  const tickets = [
    { id: 't-noisy', lead_name: 'Cliente Ruidoso', metadata: { source: 'whatsapp_evolution', whatsapp_jid: '111@g.us' } },
    { id: 't-quiet', lead_name: 'Cliente Tranquilo', metadata: { source: 'whatsapp_evolution', whatsapp_jid: '222@s.whatsapp.net' } },
  ];
  const profiles = [{ id: 'u-melvin', full_name: 'Melvin Rodriguez' }];

  const comments = [];
  for (let i = 0; i < 14; i++) {
    comments.push({
      id: `n-${i}`,
      ticket_id: 't-noisy',
      author_id: i % 2 === 0 ? null : 'u-melvin',
      body: `msg ${i}`,
      created_at: `2026-11-20T16:${String(i).padStart(2, '0')}:00.000Z`,
    });
  }
  for (let i = 0; i < 4; i++) {
    comments.push({
      id: `q-${i}`,
      ticket_id: 't-quiet',
      author_id: i % 2 === 0 ? null : 'u-melvin',
      body: `quiet ${i}`,
      created_at: `2026-11-20T17:0${i}:00.000Z`,
    });
  }

  const pulse = computeSupportWhatsAppPulse({
    tickets,
    waMessages: [],
    comments,
    profiles,
    options: { daysRange: 5, pingPongThreshold: 12, nowMs },
  });

  assert.equal(pulse.pingPongAlerts.length, 1);
  assert.equal(pulse.pingPongAlerts[0].clientName, 'Cliente Ruidoso');
  assert.equal(pulse.pingPongAlerts[0].peakDayMessages, 14);
  assert.equal(pulse.pingPongAlerts[0].circleId, 'wa:111@g.us');
  assert.equal(pulse.summary.todayClients, 2);
  assert.equal(pulse.summary.pingPongCount, 1);
});

test('5. Root-cause metadata helpers preserve unrelated metadata, cap at 40, and mark dev_resolved_at', () => {
  const {
    appendRootCauseMetadataPatch,
    extractRootCauseEntries,
    markRootCauseDevResolvedPatch,
  } = loaded.supportPulse;

  let meta = {
    source: 'whatsapp_evolution',
    wa_read_by: { 'u-1': '2026-11-20T10:00:00.000Z' },
  };

  for (let i = 1; i <= 45; i++) {
    meta = appendRootCauseMetadataPatch(
      meta,
      {
        id: `rc-${i}`,
        at: new Date(Date.UTC(2026, 10, 1, 10, i, 0)).toISOString(),
        by: 'u-melvin',
        by_name: 'Melvin Rodriguez',
        type: i % 2 === 0 ? 'system_bug' : 'temp_patch',
        note: `Error #${i}`,
      },
      40,
    );
  }

  assert.deepEqual(meta.wa_read_by, { 'u-1': '2026-11-20T10:00:00.000Z' });
  const entries = extractRootCauseEntries(meta);
  assert.equal(entries.length, 40);
  assert.equal(entries[0].id, 'rc-45');

  const resolvedMeta = markRootCauseDevResolvedPatch(
    meta,
    'rc-45',
    'Jimmy Arias',
    '2026-11-20T20:00:00.000Z',
  );
  const afterEntries = extractRootCauseEntries(resolvedMeta);
  assert.equal(afterEntries[0].dev_resolved_by, 'Jimmy Arias');
  assert.equal(resolvedMeta.wa_root_cause_last.dev_resolved_at, '2026-11-20T20:00:00.000Z');
});

test('6. countChatMessagesLast24h ignores internal notes and older messages', () => {
  const { countChatMessagesLast24h } = loaded.supportPulse;
  const nowMs = Date.parse('2026-11-20T18:00:00.000Z');
  const count = countChatMessagesLast24h(
    [
      { created_at: '2026-11-20T17:00:00.000Z', is_internal: false },
      { created_at: '2026-11-19T19:00:00.000Z', is_internal: false },
      { created_at: '2026-11-20T17:30:00.000Z', is_internal: true }, // ignored
      { created_at: '2026-11-19T17:59:00.000Z', is_internal: false }, // > 24h ago
    ],
    nowMs,
  );
  assert.equal(count, 2);
});

test('7. computeTicketAiTimeBenchmark evaluates actualHours when passed as 5th argument', () => {
  const { computeTicketAiTimeBenchmark } = loaded.ticketsMod;
  const res = computeTicketAiTimeBenchmark(
    'Error reportado: No timbra DTE',
    'Error en firma',
    'P1 · Hacienda',
    0,
    1.0,
  );
  assert.equal(res.reportedHours, 1.0);
  assert.equal(res.status, 'fair');
});

test('8. Merges multiple tickets sharing the same WhatsApp group JID without duplicate ping-pong rows', () => {
  const { computeSupportWhatsAppPulse } = loaded.supportPulse;
  const nowMs = Date.parse('2026-11-20T20:00:00.000Z');
  const tickets = [
    {
      id: 't-old-closed',
      lead_name: 'Corporación Argoz',
      status: 'closed',
      updated_at: '2026-11-10T10:00:00.000Z',
      metadata: { source: 'whatsapp_evolution', whatsapp_jid: 'argoz-group@g.us' },
    },
    {
      id: 't-new-open',
      lead_name: 'Soporte tecnico Arias - Corp Argoz',
      status: 'open',
      updated_at: '2026-11-20T18:00:00.000Z',
      metadata: { source: 'whatsapp_evolution', whatsapp_jid: 'argoz-group@g.us' },
    },
  ];
  const profiles = [{ id: 'u-gerson', full_name: 'Gerson Gutierrez' }];

  const comments = [];
  for (let i = 0; i < 8; i++) {
    comments.push({
      id: `o-${i}`,
      ticket_id: 't-old-closed',
      author_id: i % 2 === 0 ? null : 'u-gerson',
      body: `old ${i}`,
      created_at: `2026-11-20T15:${String(i).padStart(2, '0')}:00.000Z`,
    });
  }
  for (let i = 0; i < 8; i++) {
    comments.push({
      id: `n-${i}`,
      ticket_id: 't-new-open',
      author_id: i % 2 === 0 ? null : 'u-gerson',
      body: `new ${i}`,
      created_at: `2026-11-20T16:${String(i).padStart(2, '0')}:00.000Z`,
    });
  }

  const pulse = computeSupportWhatsAppPulse({
    tickets,
    waMessages: [],
    comments,
    profiles,
    options: { daysRange: 7, pingPongThreshold: 12, nowMs },
  });

  // Both tickets merge into 1 single Argoz conversation (16 msgs total, NOT 2 rows)
  assert.equal(pulse.summary.todayClients, 1);
  assert.equal(pulse.pingPongAlerts.length, 1);
  assert.equal(pulse.pingPongAlerts[0].ticketId, 't-new-open');
  assert.equal(pulse.pingPongAlerts[0].peakDayMessages, 16);
});

test('9. techFilter excludes conversations handled primarily by another technician even with stray replies', () => {
  const { computeSupportWhatsAppPulse } = loaded.supportPulse;
  const nowMs = Date.parse('2026-11-20T22:00:00.000Z');
  const tickets = [
    {
      id: 't-argoz',
      lead_name: 'Soporte tecnico Arias - Corp Argoz',
      status: 'open',
      metadata: { source: 'whatsapp_evolution', whatsapp_jid: 'argoz@g.us' },
    },
    {
      id: 't-med',
      lead_name: 'Soporte Tecnico Medicina Popular',
      status: 'open',
      metadata: { source: 'whatsapp_evolution', whatsapp_jid: 'med@g.us' },
    },
  ];
  const profiles = [
    { id: 'u-melvin', full_name: 'Melvin Rodriguez' },
    { id: 'u-gerson', full_name: 'Gerson Gutierrez' },
  ];

  const comments = [];
  // Argoz: 10 client msgs + 9 Gerson msgs + 1 stray Melvin msg => primaryTech = Gerson
  for (let i = 0; i < 10; i++) {
    comments.push({
      id: `ac-${i}`,
      ticket_id: 't-argoz',
      author_id: null,
      body: `cliente argoz ${i}`,
      created_at: `2026-11-20T15:${String(i).padStart(2, '0')}:00.000Z`,
    });
  }
  for (let i = 0; i < 9; i++) {
    comments.push({
      id: `ag-${i}`,
      ticket_id: 't-argoz',
      author_id: 'u-gerson',
      body: `gerson argoz ${i}`,
      created_at: `2026-11-20T16:${String(i).padStart(2, '0')}:00.000Z`,
    });
  }
  comments.push({
    id: 'am-stray',
    ticket_id: 't-argoz',
    author_id: 'u-melvin',
    body: 'saludo rapido de Melvin',
    created_at: '2026-11-20T16:30:00.000Z',
  });

  // Medicina Popular: 8 client msgs + 7 Melvin msgs => primaryTech = Melvin
  for (let i = 0; i < 8; i++) {
    comments.push({
      id: `mc-${i}`,
      ticket_id: 't-med',
      author_id: null,
      body: `cliente med ${i}`,
      created_at: `2026-11-20T17:${String(i).padStart(2, '0')}:00.000Z`,
    });
  }
  for (let i = 0; i < 7; i++) {
    comments.push({
      id: `mm-${i}`,
      ticket_id: 't-med',
      author_id: 'u-melvin',
      body: `melvin med ${i}`,
      created_at: `2026-11-20T18:${String(i).padStart(2, '0')}:00.000Z`,
    });
  }

  const pulseMelvin = computeSupportWhatsAppPulse({
    tickets,
    waMessages: [],
    comments,
    profiles,
    options: { daysRange: 7, pingPongThreshold: 12, nowMs, techFilter: 'Melvin Rodriguez' },
  });

  // Filtered view shows ONLY Medicina Popular (NOT Gerson's Argoz chat!)
  assert.equal(pulseMelvin.pingPongAlerts.length, 1);
  assert.equal(pulseMelvin.pingPongAlerts[0].ticketId, 't-med');
  assert.equal(pulseMelvin.summary.todayClients, 1);
  assert.equal(pulseMelvin.summary.totalMessages, 15);
  // Global techChatMetrics still keeps both Melvin & Gerson for side-by-side comparison cards
  assert.equal(pulseMelvin.techChatMetrics['Gerson Gutierrez'].pingPongChatsCount, 1);
  assert.equal(pulseMelvin.techChatMetrics['Melvin Rodriguez'].pingPongChatsCount, 1);
});
