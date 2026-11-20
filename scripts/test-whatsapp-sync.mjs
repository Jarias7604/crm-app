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
