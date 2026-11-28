import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const esbuild = require('esbuild');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-wa-sync-tests-'));

async function loadModules() {
  const syncOut = path.join(tmpDir, 'whatsappSync.mjs');
  const helpersOut = path.join(tmpDir, 'waHelpers.mjs');
  const classOut = path.join(tmpDir, 'classification.mjs');
  const aiOut = path.join(tmpDir, 'aiHelpers.mjs');
  const msgOut = path.join(tmpDir, 'messageParsing.mjs');

  await esbuild.build({
    entryPoints: [path.resolve('src/services/whatsappSync.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: syncOut,
    plugins: [
      {
        name: 'mock-supabase',
        setup(build) {
          build.onResolve({ filter: /^\.\/supabase$/ }, () => ({ path: 'mock-supabase', namespace: 'mock' }));
          build.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({
            contents: 'export const supabase = {};',
            loader: 'js',
          }));
        },
      },
    ],
  });

  await esbuild.build({
    entryPoints: [path.resolve('src/pages/support/whatsapp/helpers.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: helpersOut,
    plugins: [
      {
        name: 'mock-wa-helpers-deps',
        setup(build) {
          build.onResolve({ filter: /^lucide-react$/ }, () => ({ path: 'mock-lucide', namespace: 'mock' }));
          build.onResolve({ filter: /(?:^|[\\/])supabase(?:\.ts)?$/ }, () => ({ path: 'mock-supa2', namespace: 'mock' }));
          build.onLoad({ filter: /mock-lucide/, namespace: 'mock' }, () => ({
            contents: 'export const Building2 = {}; export const HelpCircle = {}; export const UserPlus = {}; export const ShieldCheck = {}; export const Ban = {};',
            loader: 'js',
          }));
          build.onLoad({ filter: /mock-supa2/, namespace: 'mock' }, () => ({
            contents: 'export const supabase = {};',
            loader: 'js',
          }));
        },
      },
    ],
  });

  await Promise.all([
    esbuild.build({
      entryPoints: [path.resolve('supabase/functions/evolution-whatsapp-webhook/classification.ts')],
      bundle: true,
      platform: 'neutral',
      format: 'esm',
      outfile: classOut,
    }),
    esbuild.build({
      entryPoints: [path.resolve('supabase/functions/evolution-whatsapp-webhook/aiHelpers.ts')],
      bundle: true,
      platform: 'neutral',
      format: 'esm',
      outfile: aiOut,
    }),
    esbuild.build({
      entryPoints: [path.resolve('supabase/functions/evolution-whatsapp-webhook/messageParsing.ts')],
      bundle: true,
      platform: 'neutral',
      format: 'esm',
      outfile: msgOut,
    }),
  ]);

  const [waSync, waHelpers, classification, aiHelpers, messageParsing] = await Promise.all([
    import(pathToFileURL(syncOut).href),
    import(pathToFileURL(helpersOut).href),
    import(pathToFileURL(classOut).href),
    import(pathToFileURL(aiOut).href),
    import(pathToFileURL(msgOut).href),
  ]);

  return { waSync, waHelpers, classification, aiHelpers, messageParsing };
}

let loaded;
test.before(async () => {
  loaded = await loadModules();
});

test.after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('1. Cross-device read sync marks Device B as read and re-arms unread on newer message', () => {
  const { computeEffectiveCircleUnread } = loaded.waSync;
  const t1 = '2026-11-18T15:00:00.000Z';
  const t2 = '2026-11-18T15:05:00.000Z';

  // Device B sees unread when neither device has read t1
  assert.equal(
    computeEffectiveCircleUnread({
      lastMessageAt: t1,
      unreadOrWaitingReply: true,
      localReadAt: null,
      syncedReadAt: null,
    }),
    true,
  );

  // Device A reads t1 and syncs wa_read_by[userId] = t1 -> Device B immediately sees read
  assert.equal(
    computeEffectiveCircleUnread({
      lastMessageAt: t1,
      unreadOrWaitingReply: true,
      localReadAt: null,
      syncedReadAt: t1,
    }),
    false,
  );

  // Client sends newer message at t2 -> Device B shows unread again even though syncedReadAt is t1
  assert.equal(
    computeEffectiveCircleUnread({
      lastMessageAt: t2,
      unreadOrWaitingReply: true,
      localReadAt: null,
      syncedReadAt: t1,
    }),
    true,
  );
});

test('2. Cross-device forced-unread sync propagates and clears when Device B reads it', () => {
  const { computeEffectiveCircleUnread } = loaded.waSync;
  const t1 = '2026-11-18T16:00:00.000Z';

  // Device A marks conversation manually unread -> syncedForcedUnreadAt === t1
  assert.equal(
    computeEffectiveCircleUnread({
      lastMessageAt: t1,
      unreadOrWaitingReply: false,
      localReadAt: null,
      syncedReadAt: null,
      localForcedUnreadAt: null,
      syncedForcedUnreadAt: t1,
    }),
    true,
  );

  // User opens conversation on Device B (localReadAt === t1) -> clears forced unread immediately
  assert.equal(
    computeEffectiveCircleUnread({
      lastMessageAt: t1,
      unreadOrWaitingReply: false,
      localReadAt: t1,
      syncedReadAt: null,
      localForcedUnreadAt: null,
      syncedForcedUnreadAt: t1,
    }),
    false,
  );
});

test('3. buildReadStateMetadataPatch preserves unrelated metadata and caps wa_read_by at maxUsers', () => {
  const { buildReadStateMetadataPatch } = loaded.waSync;
  const existingReadBy = {};
  for (let i = 1; i <= 5; i++) {
    existingReadBy[`user-${i}`] = `2026-11-18T10:0${i}:00.000Z`;
  }

  const baseMeta = {
    source: 'whatsapp_evolution',
    wa_scope: 'lead',
    last_whatsapp_message: 'Hola quiero cotización',
    wa_read_by: existingReadBy,
  };

  // Read mode preserves unrelated fields and caps map to 3 newest entries
  const afterRead = buildReadStateMetadataPatch(
    baseMeta,
    'user-6',
    'read',
    '2026-11-18T11:00:00.000Z',
    3,
  );
  assert.equal(afterRead.wa_scope, 'lead');
  assert.equal(afterRead.last_whatsapp_message, 'Hola quiero cotización');
  assert.equal(Object.keys(afterRead.wa_read_by).length, 3);
  assert.equal(afterRead.wa_read_by['user-6'], '2026-11-18T11:00:00.000Z');
  assert.equal(afterRead.wa_read_by['user-1'], undefined);

  // Attended mode sets both wa_read_by and wa_attended_at
  const afterAttended = buildReadStateMetadataPatch(
    afterRead,
    'user-6',
    'attended',
    '2026-11-18T11:05:00.000Z',
    25,
  );
  assert.equal(afterAttended.wa_attended_at, '2026-11-18T11:05:00.000Z');
  assert.equal(afterAttended.wa_read_by['user-6'], '2026-11-18T11:05:00.000Z');

  // Unread mode removes user read & attended_at and sets wa_forced_unread_by
  const afterUnread = buildReadStateMetadataPatch(
    afterAttended,
    'user-6',
    'unread',
    '2026-11-18T11:05:00.000Z',
    25,
  );
  assert.equal(afterUnread.wa_read_by['user-6'], undefined);
  assert.equal(afterUnread.wa_attended_at, undefined);
  assert.equal(afterUnread.wa_forced_unread_by['user-6'], '2026-11-18T11:05:00.000Z');
});

test('4. mergeQuickRepliesWithDefaults prioritizes remote DB, backfills local v2/v1, and guards malformed data', () => {
  const { mergeQuickRepliesWithDefaults } = loaded.waSync;
  const defaults = [
    { id: 'def-1', scope: 'ventas', label: 'Saludo', text: 'Hola!' },
    { id: 'def-2', scope: 'soporte', label: 'Soporte', text: 'Revisando...' },
  ];
  const remote = [{ id: 'rem-1', scope: 'ventas', label: 'Catálogo', text: 'Adjunto catálogo' }];
  const localV2 = [{ id: 'loc-1', scope: 'soporte', label: 'Local', text: 'Texto local' }];
  const legacyV1 = [{ id: 'leg-1', scope: 'ventas', label: 'Legacy', text: 'Texto legacy' }];

  // Remote DB takes precedence without triggering backfill
  const rRemote = mergeQuickRepliesWithDefaults(remote, localV2, legacyV1, defaults);
  assert.deepEqual(rRemote.replies, remote);
  assert.equal(rRemote.shouldBackfillRemote, false);

  // If remote empty and local v2 exists, use local v2 and trigger backfill
  const rLocal = mergeQuickRepliesWithDefaults(null, localV2, legacyV1, defaults);
  assert.deepEqual(rLocal.replies, localV2);
  assert.equal(rLocal.shouldBackfillRemote, true);

  // If remote & v2 empty and legacy v1 exists, merge defaults + v1 and trigger backfill
  const rLegacy = mergeQuickRepliesWithDefaults(null, null, legacyV1, defaults);
  assert.equal(rLegacy.replies.length, 3);
  assert.equal(rLegacy.shouldBackfillRemote, true);

  // Corrupted payloads fall back safely to defaults without backfill
  const rCorrupt = mergeQuickRepliesWithDefaults('bad-json', [{ invalid: true }], 'oops', defaults);
  assert.deepEqual(rCorrupt.replies, defaults);
  assert.equal(rCorrupt.shouldBackfillRemote, false);
});

test('5. evolution-whatsapp-webhook Deno module graph bundles cleanly with zero unresolved imports', async () => {
  const result = await esbuild.build({
    entryPoints: [path.resolve('supabase/functions/evolution-whatsapp-webhook/index.ts')],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    external: ['https://*'],
  });

  assert.equal(result.errors.length, 0);
  assert.ok(result.outputFiles.length > 0);
  const bundledCode = result.outputFiles[0].text;
  assert.ok(bundledCode.length > 1000, 'Bundled webhook code should be non-empty');
  assert.ok(bundledCode.includes('handleBridgeSh'), 'Bundled code must include handleBridgeSh');
  assert.ok(bundledCode.includes('classifyIssueCategory'), 'Bundled code must include classifyIssueCategory');
  assert.ok(bundledCode.includes('cleanMeta'), 'Bundled code must include cleanMeta');
});

test('6. Extracted webhook Deno helpers preserve classification, AI closed-lead, and parsing behavior', () => {
  const { classification, aiHelpers, messageParsing } = loaded;

  // Classification
  const supportRes = classification.classifyIssueCategory('No nos deja facturar DTE da error en Hacienda');
  assert.equal(supportRes.supportChannel, 'soporte');
  assert.equal(supportRes.isActualSupportProblem, true);

  const salesRes = classification.classifyIssueCategory('Hola quiero información sobre precios y planes de cotización');
  assert.equal(salesRes.supportChannel, 'ventas');
  assert.equal(salesRes.isActualSupportProblem, false);

  const greetingRes = classification.classifyIssueCategory('Buenos días equipo, muchas gracias!');
  assert.equal(greetingRes.isActualSupportProblem, false);

  // Auto resolved reply detection & rendering
  assert.equal(aiHelpers.isAlreadyResolvedReply('Ya resolvimos muchas gracias'), true);
  assert.equal(aiHelpers.isAlreadyResolvedReply('Ya resolvimos, cuánto cuesta otro plan?'), false);
  const rendered = aiHelpers.renderResolvedReplyTemplate('Gracias {nombre} de {empresa}', 'Juan Pérez');
  assert.equal(rendered, 'Gracias Juan de Juan Pérez');

  // Message parsing + cleanMeta
  const unwrapped = messageParsing.unwrapMessage({
    ephemeralMessage: {
      message: {
        extendedTextMessage: { text: 'Hola desde efímero' },
      },
    },
  });
  assert.equal(messageParsing.extractText(unwrapped, {}, {}), 'Hola desde efímero');

  const sanitized = messageParsing.cleanMeta({
    evolution_apikey: 'SECRET_SHOULD_BE_REMOVED',
    pending_audio_jobs: [1, 2],
    wa_read_by: { u1: '2026-11-18T12:00:00.000Z' },
  });
  assert.equal(sanitized.evolution_apikey, undefined);
  assert.equal(sanitized.pending_audio_jobs, undefined);
  assert.deepEqual(sanitized.wa_read_by, { u1: '2026-11-18T12:00:00.000Z' });
});

test('7. buildReadStateMetadataPatch tracks wa_attended_by on attended and clears it on unread', () => {
  const { buildReadStateMetadataPatch } = loaded.waSync;
  const afterAttended = buildReadStateMetadataPatch(
    { source: 'whatsapp_evolution' },
    'user-melvin',
    'attended',
    '2026-11-20T14:00:00.000Z',
  );
  assert.equal(afterAttended.wa_attended_at, '2026-11-20T14:00:00.000Z');
  assert.equal(afterAttended.wa_attended_by, 'user-melvin');

  const afterUnread = buildReadStateMetadataPatch(
    afterAttended,
    'user-melvin',
    'unread',
    '2026-11-20T14:00:00.000Z',
  );
  assert.equal(afterUnread.wa_attended_at, undefined);
  assert.equal(afterUnread.wa_attended_by, undefined);
});

test('8. computeCircleTeamActivity distinguishes unopened, seen by teammate, replied by team, attended, and idle', () => {
  const { computeCircleTeamActivity } = loaded.waHelpers;
  const tMsg = '2026-11-20T15:00:00.000Z';
  const tOldRead = '2026-11-20T14:00:00.000Z';
  const tNewRead = '2026-11-20T15:02:00.000Z';
  const agentMap = new Map([
    ['u-jimmy', 'Jimmy Arias'],
    ['u-patty', 'Patricia López'],
    ['u-melvin', 'Melvin Sorto'],
  ]);

  // 1) Unopened: Patricia opened an older message, nobody opened tMsg
  const unopened = computeCircleTeamActivity({
    lastFrom: 'client',
    lastMessageAt: tMsg,
    unreadOrWaitingReply: true,
    isManuallyAttended: false,
    isCourtesyClosing: false,
    readByMap: { 'u-patty': tOldRead },
    currentUserId: 'u-jimmy',
    currentUserName: 'Jimmy Arias',
    agentMap,
  });
  assert.equal(unopened.teamStatus, 'unopened');
  assert.equal(unopened.seenByMe, false);
  assert.deepEqual(unopened.seenByOtherNames, []);

  // 2) Seen waiting by teammate: Patricia opened tMsg, Jimmy did not
  const seenByPatty = computeCircleTeamActivity({
    lastFrom: 'client',
    lastMessageAt: tMsg,
    unreadOrWaitingReply: true,
    isManuallyAttended: false,
    isCourtesyClosing: false,
    readByMap: { 'u-patty': tNewRead },
    currentUserId: 'u-jimmy',
    currentUserName: 'Jimmy Arias',
    agentMap,
  });
  assert.equal(seenByPatty.teamStatus, 'seen_waiting');
  assert.equal(seenByPatty.seenByMe, false);
  assert.deepEqual(seenByPatty.seenByOtherNames, ['Patricia']);

  // 3) Seen waiting by current user only
  const seenByMeOnly = computeCircleTeamActivity({
    lastFrom: 'client',
    lastMessageAt: tMsg,
    unreadOrWaitingReply: true,
    isManuallyAttended: false,
    isCourtesyClosing: false,
    readByMap: { 'u-jimmy': tNewRead },
    currentUserId: 'u-jimmy',
    currentUserName: 'Jimmy Arias',
    agentMap,
  });
  assert.equal(seenByMeOnly.teamStatus, 'seen_waiting');
  assert.equal(seenByMeOnly.seenByMe, true);
  assert.deepEqual(seenByMeOnly.seenByOtherNames, []);

  // 4) Replied by teammate & replied by current user
  const repliedByPatty = computeCircleTeamActivity({
    lastFrom: 'staff',
    lastMessageAt: tMsg,
    unreadOrWaitingReply: false,
    isManuallyAttended: false,
    isCourtesyClosing: false,
    readByMap: {},
    currentUserId: 'u-jimmy',
    currentUserName: 'Jimmy Arias',
    agentMap,
    lastStaffReplyBy: 'Patricia López',
  });
  assert.equal(repliedByPatty.teamStatus, 'replied');
  assert.equal(repliedByPatty.repliedByShortName, 'Patricia');

  const repliedByMe = computeCircleTeamActivity({
    lastFrom: 'staff',
    lastMessageAt: tMsg,
    unreadOrWaitingReply: false,
    isManuallyAttended: false,
    isCourtesyClosing: false,
    readByMap: {},
    currentUserId: 'u-jimmy',
    currentUserName: 'Jimmy Arias',
    agentMap,
    lastStaffReplyBy: 'Jimmy Arias',
  });
  assert.equal(repliedByMe.teamStatus, 'replied');
  assert.equal(repliedByMe.repliedByShortName, 'Tú');

  // 5) Manually attended by Melvin
  const attended = computeCircleTeamActivity({
    lastFrom: 'client',
    lastMessageAt: tMsg,
    unreadOrWaitingReply: false,
    isManuallyAttended: true,
    isCourtesyClosing: false,
    readByMap: { 'u-melvin': tNewRead },
    currentUserId: 'u-jimmy',
    currentUserName: 'Jimmy Arias',
    agentMap,
    attendedByUserId: 'u-melvin',
  });
  assert.equal(attended.teamStatus, 'attended');
  assert.equal(attended.attendedByShortName, 'Melvin');

  // 6) Unanswered outbound reactivation stays idle
  const idleReact = computeCircleTeamActivity({
    lastFrom: 'staff',
    lastMessageAt: tMsg,
    unreadOrWaitingReply: false,
    isManuallyAttended: false,
    isCourtesyClosing: false,
    readByMap: {},
    currentUserId: 'u-jimmy',
    currentUserName: 'Jimmy Arias',
    agentMap,
    isReactivation: true,
    reactivationReplied: false,
  });
  assert.equal(idleReact.teamStatus, 'idle');
});

test('9. Multi-filter helpers support combinable Bandejas + Estados without conflicts', () => {
  const {
    toggleBucketSelection,
    toggleStateFilterSelection,
    matchesCircleBucketAndTray,
    matchesCircleStateFilters,
  } = loaded.waHelpers;

  // Toggle buckets cleanly
  let buckets = toggleBucketSelection([], 'reactivados');
  assert.deepEqual(buckets, ['reactivados']);
  buckets = toggleBucketSelection(buckets, 'soporte');
  assert.deepEqual(buckets, ['reactivados', 'soporte']);
  buckets = toggleBucketSelection(buckets, 'reactivados');
  assert.deepEqual(buckets, ['soporte']);

  // State toggle resolves mutual exclusions cleanly
  let states = toggleStateFilterSelection([], 'unopened');
  states = toggleStateFilterSelection(states, 'unread');
  assert.deepEqual(states, ['unopened', 'unread']);
  states = toggleStateFilterSelection(states, 'replied');
  assert.deepEqual(states, ['unread', 'replied']);
  states = toggleStateFilterSelection(states, 'waiting');
  assert.deepEqual(states, ['unread', 'waiting']);

  // Matching Reactivados + Sin abrir excludes already-seen or replied reactivated leads
  const reactUnopened = { isWhatsApp: true, scope: 'lead', isReactivation: true, teamStatus: 'unopened', unreadOrWaitingReply: true };
  const reactSeenByPatty = { isWhatsApp: true, scope: 'lead', isReactivation: true, teamStatus: 'seen_waiting', unreadOrWaitingReply: true };
  const soporteUnopened = { isWhatsApp: true, scope: 'soporte', isReactivation: false, teamStatus: 'unopened', unreadOrWaitingReply: true };
  const spamItem = { isWhatsApp: true, scope: 'spam', isReactivation: false, teamStatus: 'unopened', unreadOrWaitingReply: true };

  assert.equal(
    matchesCircleBucketAndTray(reactUnopened, ['reactivados'], null) &&
      matchesCircleStateFilters(reactUnopened, ['unopened'], true),
    true,
  );
  assert.equal(
    matchesCircleBucketAndTray(reactSeenByPatty, ['reactivados'], null) &&
      matchesCircleStateFilters(reactSeenByPatty, ['unopened'], true),
    false,
  );
  assert.equal(
    matchesCircleBucketAndTray(soporteUnopened, ['soporte', 'por_clasificar'], null) &&
      matchesCircleStateFilters(soporteUnopened, ['unopened'], true),
    true,
  );
  assert.equal(matchesCircleBucketAndTray(spamItem, [], null), false);
  assert.equal(matchesCircleBucketAndTray(spamItem, [], 'spam'), true);
});

test('10. extractChatReadUpdates parses CHATS_UPDATE payloads and skips invalid or broadcast entries', () => {
  const { extractChatReadUpdates } = loaded.messageParsing;

  const updates = extractChatReadUpdates({
    event: 'chats.update',
    data: [
      { remoteJid: '50370001111@s.whatsapp.net', unreadCount: 0 },
      { id: '120363000111@g.us', unreadMessages: -1 },
      { remoteJid: 'status@broadcast', unreadCount: 0 },
      { id: '12345@newsletter', unreadCount: 0 },
      { remoteJid: '50370002222@s.whatsapp.net', lastMsgTimestamp: 1700000000 }, // no numeric unreadCount
    ],
  });
  assert.deepEqual(updates, [
    { jid: '50370001111@s.whatsapp.net', altJid: '', unreadCount: 0 },
    { jid: '120363000111@g.us', altJid: '', unreadCount: -1 },
  ]);

  // Single-object payload variant with alt JID
  const single = extractChatReadUpdates({
    remoteJid: '999888777@lid',
    remoteJidAlt: '50371112222@s.whatsapp.net',
    unreadCount: 0,
  });
  assert.deepEqual(single, [
    { jid: '999888777@lid', altJid: '50371112222@s.whatsapp.net', unreadCount: 0 },
  ]);
});

test('11. computeCircleTeamActivity shows WhatsApp external reader without hiding named CRM teammates', () => {
  const { computeCircleTeamActivity, WA_EXTERNAL_READER_KEY } = loaded.waHelpers;
  const tMsg = '2026-11-20T18:00:00.000Z';
  const tRead = '2026-11-20T18:01:00.000Z';
  const agentMap = new Map([['u-patty', 'Patricia López']]);

  // Opened only on WhatsApp phone/Web
  const waOnly = computeCircleTeamActivity({
    lastFrom: 'client',
    lastMessageAt: tMsg,
    unreadOrWaitingReply: true,
    isManuallyAttended: false,
    isCourtesyClosing: false,
    readByMap: { [WA_EXTERNAL_READER_KEY]: tRead },
    currentUserId: 'u-jimmy',
    currentUserName: 'Jimmy Arias',
    agentMap,
  });
  assert.equal(waOnly.teamStatus, 'seen_waiting');
  assert.equal(waOnly.seenByMe, false);
  assert.deepEqual(waOnly.seenByOtherNames, ['WhatsApp']);

  // Opened on WhatsApp phone AND by Patricia in CRM -> Patricia listed first
  const waAndPatty = computeCircleTeamActivity({
    lastFrom: 'client',
    lastMessageAt: tMsg,
    unreadOrWaitingReply: true,
    isManuallyAttended: false,
    isCourtesyClosing: false,
    readByMap: { [WA_EXTERNAL_READER_KEY]: tRead, 'u-patty': tRead },
    currentUserId: 'u-jimmy',
    currentUserName: 'Jimmy Arias',
    agentMap,
  });
  assert.equal(waAndPatty.teamStatus, 'seen_waiting');
  assert.deepEqual(waAndPatty.seenByOtherNames, ['Patricia', 'WhatsApp']);
});

test('12. isCourtesyClosingMessage catches polite closings without swallowing real support requests', () => {
  const { isCourtesyClosingMessage } = loaded.waHelpers;

  // Should be detected as courtesy closings
  for (const msg of [
    'Está bien, gracias por la observación',
    'Bueno, muchas gracias.',
    'Muchísimas gracias',
    'Ah vaya está bien gracias',
    'Gracia muy fino',
    'Muchas gracias por su ayuda',
    'Ok, perfecto',
    'Listo gracias',
  ]) {
    assert.equal(isCourtesyClosingMessage(msg), true, `Expected true for: ${msg}`);
  }

  // Should NOT be suppressed (real pending requests / follow-ups)
  for (const msg of [
    'Ok.hay me confirma, gracias',
    'gracias estamos al pendiente, aun no hemos realizado el pago',
    'Ya confirme',
    'Está bien, pero tengo un error al facturar',
    'Gracias, ¿me puede revisar?',
    'Buenos días, necesito cotización',
  ]) {
    assert.equal(isCourtesyClosingMessage(msg), false, `Expected false for: ${msg}`);
  }
});

test('13. Quoted reply helpers format and parse WhatsApp reply prefixes cleanly', () => {
  const { formatQuotedReplyText, parseQuotedReplyPrefix } = loaded.waHelpers;
  const formatted = formatQuotedReplyText(
    { id: 'm1', senderName: 'Salinera San Jorge', text: 'Error al emitir\nfactura sujeto excluido' },
    'Ya lo estamos revisando en Ingeniería.',
  );
  assert.equal(
    formatted,
    '> Salinera San Jorge: Error al emitir factura sujeto excluido\n\nYa lo estamos revisando en Ingeniería.',
  );

  const parsed = parseQuotedReplyPrefix(formatted);
  assert.deepEqual(parsed, {
    quote: {
      author: 'Salinera San Jorge',
      text: 'Error al emitir factura sujeto excluido',
    },
    body: 'Ya lo estamos revisando en Ingeniería.',
  });

  const plain = parseQuotedReplyPrefix('Hola buenas tardes, ¿cómo le ayudo?');
  assert.deepEqual(plain, {
    quote: null,
    body: 'Hola buenas tardes, ¿cómo le ayudo?',
  });

  const longQuote = formatQuotedReplyText(
    { id: 'm2', senderName: 'Cliente', text: 'A'.repeat(160) },
    'Recibido',
  );
  const parsedLong = parseQuotedReplyPrefix(longQuote);
  assert.equal(parsedLong.quote?.text.length, 120);
  assert.equal(parsedLong.quote?.text.endsWith('...'), true);
});

test('14. Failed outbox filter, retryable error guard, and QR TTL countdown behave accurately', () => {
  const {
    toggleStateFilterSelection,
    matchesCircleStateFilters,
    isRetryableOutboxError,
    computeQrRemainingSeconds,
  } = loaded.waHelpers;

  // Failed filter toggles cleanly and matches only circles with failedOutboxCount > 0
  let states = toggleStateFilterSelection([], 'failed');
  assert.deepEqual(states, ['failed']);
  states = toggleStateFilterSelection(states, 'replied');
  assert.deepEqual(states, ['replied']);
  states = toggleStateFilterSelection(states, 'failed');
  assert.deepEqual(states, ['failed']);

  const failedLead = { teamStatus: 'idle', unreadOrWaitingReply: false, failedOutboxCount: 2 };
  const okLead = { teamStatus: 'idle', unreadOrWaitingReply: false, failedOutboxCount: 0 };
  assert.equal(matchesCircleStateFilters(failedLead, ['failed'], false), true);
  assert.equal(matchesCircleStateFilters(okLead, ['failed'], false), false);

  // exists:false is non-retryable; 401/500/empty errors are retryable
  assert.equal(isRetryableOutboxError('{"exists":false,"jid":"50370001111"}'), false);
  assert.equal(isRetryableOutboxError('{"status":500,"message":"Connection Closed"}'), true);
  assert.equal(isRetryableOutboxError(null), true);

  // QR remaining seconds countdown
  const baseMs = Date.parse('2026-11-25T22:00:00.000Z');
  assert.equal(computeQrRemainingSeconds('2026-11-25T22:00:00.000Z', 55, baseMs), 55);
  assert.equal(computeQrRemainingSeconds('2026-11-25T22:00:00.000Z', 55, baseMs + 20_000), 35);
  assert.equal(computeQrRemainingSeconds('2026-11-25T22:00:00.000Z', 55, baseMs + 60_000), 0);
  assert.equal(computeQrRemainingSeconds(null, 55, baseMs), 0);
});

test('15. shouldTriggerLeadQualifier & buildQualifierInvokeHeaders handle catchup, voice notes, and scopes', () => {
  const { shouldTriggerLeadQualifier, buildQualifierInvokeHeaders, QUALIFIER_CATCHUP_MAX_AGE_MS } = loaded.aiHelpers;

  // Live lead text reply -> triggers
  assert.equal(
    shouldTriggerLeadQualifier({
      isCatchup: false,
      msgAgeMs: 2_000,
      isStaff: false,
      isGroup: false,
      scope: 'lead',
      aiQualifierActive: true,
      effectiveLeadId: 'lead-1',
      messageText: 'Pero es para restaurante',
    }),
    true,
  );

  // Recent Watchdog catchup (< 15m) -> triggers
  assert.equal(
    shouldTriggerLeadQualifier({
      isCatchup: true,
      msgAgeMs: 45_000,
      isStaff: false,
      isGroup: false,
      scope: 'lead',
      aiQualifierActive: true,
      effectiveLeadId: 'lead-1',
      messageText: 'Hola sii pero no es Pae',
    }),
    true,
  );

  // Old historical catchup (> 15m) -> blocked
  assert.equal(
    shouldTriggerLeadQualifier({
      isCatchup: true,
      msgAgeMs: QUALIFIER_CATCHUP_MAX_AGE_MS + 60_000,
      isStaff: false,
      isGroup: false,
      scope: 'lead',
      aiQualifierActive: true,
      effectiveLeadId: 'lead-1',
      messageText: 'Mensaje viejo',
    }),
    false,
  );

  // Unassigned lead in por_clasificar with active qualifier & ticket.lead_id -> triggers
  assert.equal(
    shouldTriggerLeadQualifier({
      isCatchup: false,
      msgAgeMs: 1_000,
      isStaff: false,
      isGroup: false,
      scope: 'por_clasificar',
      aiQualifierActive: true,
      effectiveLeadId: 'lead-unassigned',
      messageText: 'Me interesa ver el sistema',
    }),
    true,
  );

  // Transcribed voice note -> triggers; non-audio media without caption -> blocked
  assert.equal(
    shouldTriggerLeadQualifier({
      isCatchup: false,
      msgAgeMs: 5_000,
      isStaff: false,
      isGroup: false,
      scope: 'lead',
      aiQualifierActive: true,
      effectiveLeadId: 'lead-1',
      messageText: '[Nota de voz del prospecto]: "Somos 3 sucursales"',
      hasNonAudioMediaWithoutCaption: false,
    }),
    true,
  );
  assert.equal(
    shouldTriggerLeadQualifier({
      isCatchup: false,
      msgAgeMs: 5_000,
      isStaff: false,
      isGroup: false,
      scope: 'lead',
      aiQualifierActive: true,
      effectiveLeadId: 'lead-1',
      messageText: '',
      hasNonAudioMediaWithoutCaption: true,
    }),
    false,
  );

  // Staff / Group / Inactive AI -> blocked
  assert.equal(
    shouldTriggerLeadQualifier({
      isCatchup: false,
      msgAgeMs: 1_000,
      isStaff: true,
      isGroup: false,
      scope: 'lead',
      aiQualifierActive: true,
      effectiveLeadId: 'lead-1',
      messageText: 'Hola',
    }),
    false,
  );
  assert.equal(
    shouldTriggerLeadQualifier({
      isCatchup: false,
      msgAgeMs: 1_000,
      isStaff: false,
      isGroup: true,
      scope: 'lead',
      aiQualifierActive: true,
      effectiveLeadId: 'lead-1',
      messageText: 'Hola',
    }),
    false,
  );

  // Headers include both x-sheets-sync-secret and Bearer/apikey when available
  assert.deepEqual(buildQualifierInvokeHeaders('sync-123', 'srv-456'), {
    'Content-Type': 'application/json',
    'x-sheets-sync-secret': 'sync-123',
    Authorization: 'Bearer srv-456',
    apikey: 'srv-456',
  });
  assert.deepEqual(buildQualifierInvokeHeaders('', 'srv-only'), {
    'Content-Type': 'application/json',
    'x-sheets-sync-secret': 'srv-only',
    Authorization: 'Bearer srv-only',
    apikey: 'srv-only',
  });
});

test('16. classifyLeadStageGroup and isFreshLeadWithinHours separate Nuevos, En proceso, and Renovaciones cleanly', () => {
  const { classifyLeadStageGroup, isFreshLeadWithinHours } = loaded.waHelpers;
  assert.equal(classifyLeadStageGroup('Prospecto'), 'nuevos');
  assert.equal(classifyLeadStageGroup(null), 'nuevos');
  assert.equal(classifyLeadStageGroup(''), 'nuevos');
  assert.equal(classifyLeadStageGroup('En seguimiento'), 'en_proceso');
  assert.equal(classifyLeadStageGroup('Lead calificado'), 'en_proceso');
  assert.equal(classifyLeadStageGroup('Negociación'), 'en_proceso');
  assert.equal(classifyLeadStageGroup('Cliente'), 'renovaciones');
  assert.equal(classifyLeadStageGroup('Cerrado'), 'renovaciones');
  assert.equal(classifyLeadStageGroup('Perdido'), 'perdidos');
  assert.equal(classifyLeadStageGroup('Erróneo'), 'erroneos');

  const now = Date.parse('2026-11-28T01:00:00Z');
  assert.equal(isFreshLeadWithinHours('2026-11-27T12:00:00Z', 48, now), true);
  assert.equal(isFreshLeadWithinHours('2026-11-20T12:00:00Z', 48, now), false);
  assert.equal(isFreshLeadWithinHours(null, 48, now), false);
});
