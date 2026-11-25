import {
  corsHeaders,
  MEDIA_BUCKET,
  MEDIA_MAX_ATTEMPTS,
  MEDIA_RETRY_AFTER_MS,
  GROUP_SYNC_EVERY_MS,
  json,
  digits,
  shellSafe,
  b64Utf8,
} from './types.ts';
import {
  getBridgeState,
  setBridgeState,
  evolutionCredentials,
  normalizeInstance,
  enqueueOutbox,
} from './bridgeState.ts';
import { cleanMeta } from './messageParsing.ts';

// =============================================================================
// Bridge (polled by the Evolution server) — every user value is base64-encoded
// or reduced to [A-Za-z0-9_-] before reaching the shell.
// =============================================================================

export const WEBHOOK_EVENTS = ['MESSAGES_UPSERT', 'CHATS_UPDATE'];
export const WEBHOOK_EVENTS_VERSION = '2026-11-20-chats-update';

export interface BridgeShDeps {
  resolveMainCompanyId: (supabase: any, companyIdParam: string | null) => Promise<string | null>;
  rescopeChats: (supabase: any, companyId: string) => Promise<{ checked: number; changed: any[] }>;
}

export async function handleBridgeSh(
  supabase: any,
  selfUrl: string,
  deps: BridgeShDeps,
): Promise<Response> {
  const { key, instance } = await evolutionCredentials(supabase);
  const safeKey = shellSafe(key);
  const lines: string[] = [];
  const evo = 'http://localhost:8085';
  const now = new Date();
  await setBridgeState(supabase, 'bridge_last_poll', { at: now.toISOString() });

  if (!safeKey) return new Response('# no evolution key configured\n', { headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' } });

  // 0. Recently active conversations: legacy queued items (pre-upgrade) and group subject sync.
  const { data: recent } = await supabase
    .from('tickets')
    .select('id, company_id, metadata')
    .eq('metadata->>source', 'whatsapp_evolution')
    .order('updated_at', { ascending: false })
    .limit(40);
  for (const row of recent || []) {
    const m = row.metadata || {};
    const queue: any[] = Array.isArray(m.pending_whatsapp_outbox) ? m.pending_whatsapp_outbox : [];
    const legacyPending = queue.filter((i) => i && i.status === 'pending');
    const needsSubject = typeof m.whatsapp_jid === 'string' && m.whatsapp_jid.endsWith('@g.us') && !m.group_subject_synced;
    if (legacyPending.length === 0 && !needsSubject) continue;

    for (const item of legacyPending) {
      await enqueueOutbox(supabase, {
        companyId: row.company_id, ticketId: row.id, commentId: item.comment_id || null,
        instance: item.instance || instance, number: item.number, kind: 'text', payload: { text: item.text },
      });
    }
    if (needsSubject) {
      const inst = shellSafe(normalizeInstance(m.evolution_instance || instance));
      const syncUrl = `${selfUrl}?action=sync_group_subject&ticket_id=${shellSafe(row.id)}`;
      lines.push(
        `(curl -s "${evo}/group/findGroupInfos/${inst}?groupJid=${encodeURIComponent(m.whatsapp_jid).replace(/[^a-zA-Z0-9%._-]/g, '')}" -H "apikey: ${safeKey}" | curl -s -X POST "${syncUrl}" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1) &`
      );
    }
    await supabase
      .from('tickets')
      .update({
        metadata: {
          ...cleanMeta(m),
          pending_whatsapp_outbox: queue.map((i) => {
            const { apikey: _k, ...rest } = i || {};
            return rest.status === 'pending' ? { ...rest, status: 'migrated' } : rest;
          }),
          ...(needsSubject ? { group_subject_synced: true } : {}),
        },
      })
      .eq('id', row.id);
  }

  // 1. Outgoing messages (text + media). Each row is claimed atomically (pending -> dispatched).
  const { data: outRows } = await supabase
    .from('whatsapp_outbox')
    .select('id, ticket_id, instance, number, kind, payload')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(20);
  for (const item of outRows || []) {
    const { data: claimed } = await supabase
      .from('whatsapp_outbox')
      .update({ status: 'dispatched', dispatched_at: now.toISOString() })
      .eq('id', item.id)
      .eq('status', 'pending')
      .select('id');
    if (!claimed || claimed.length === 0) continue; // another poll took it
    const inst = shellSafe(normalizeInstance(item.instance || instance));
    const ticketParam = item.ticket_id ? `&ticket_id=${shellSafe(item.ticket_id)}` : '';
    const ackUrl = `${selfUrl}?action=bridge_ack${ticketParam}&outbox_id=${shellSafe(item.id)}`;
    const p = item.payload || {};
    let endpoint = 'sendText';
    let body: Record<string, any> = { number: item.number, text: p.text || '' };
    if (item.kind === 'media' && p.url) {
      endpoint = 'sendMedia';
      body = {
        number: item.number,
        mediatype: p.mediatype,
        mimetype: p.mimetype,
        caption: p.caption || '',
        media: p.url,
        fileName: p.fileName,
      };
    }
    const b64 = b64Utf8(JSON.stringify(body));
    lines.push(
      `EVO_OUT=$(echo "${b64}" | base64 -d | curl -s -X POST "${evo}/message/${endpoint}/${inst}" -H "Content-Type: application/json" -H "apikey: ${safeKey}" -d @-); printf '%s' "$EVO_OUT" | curl -s -X POST "${ackUrl}" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1`
    );
  }

  // 2. Media downloads (images, documents, audio, video). Run in background (&) so they never block outbox polling.
  const staleBefore = new Date(now.getTime() - MEDIA_RETRY_AFTER_MS).toISOString();
  const { data: mediaJobs } = await supabase
    .from('whatsapp_messages')
    .select('id, raw_message, media_attempts, media_status, media_requested_at')
    .in('media_status', ['pending', 'requested'])
    .lt('media_attempts', MEDIA_MAX_ATTEMPTS)
    .gte('created_at', new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: true })
    .limit(6);
  let mediaQueued = 0;
  for (const job of mediaJobs || []) {
    if (mediaQueued >= 3) break;
    if (job.media_status === 'requested' && job.media_requested_at && job.media_requested_at > staleBefore) continue;
    if (!job.raw_message) continue;
    const inst = shellSafe(instance);
    const upUrl = `${selfUrl}?action=upload_media&wamsg=${shellSafe(job.id)}`;
    const b64 = b64Utf8(JSON.stringify({ message: job.raw_message, convertToMp4: false }));
    lines.push(
      `(echo "${b64}" | base64 -d | curl -s -X POST "${evo}/chat/getBase64FromMediaMessage/${inst}" -H "Content-Type: application/json" -H "apikey: ${safeKey}" -d @- | curl -s -X POST "${upUrl}" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1) &`
    );
    await supabase
      .from('whatsapp_messages')
      .update({ media_status: 'requested', media_attempts: Number(job.media_attempts || 0) + 1, media_requested_at: now.toISOString() })
      .eq('id', job.id);
    mediaQueued++;
  }
  // Give up on jobs that exhausted retries.
  await supabase
    .from('whatsapp_messages')
    .update({ media_status: 'failed', media_error: 'No se pudo descargar después de varios intentos' })
    .eq('media_status', 'requested')
    .gte('media_attempts', MEDIA_MAX_ATTEMPTS)
    .lt('media_requested_at', staleBefore);

  // 3. Periodic full group/participant sync (who belongs to which client group).
  const gs = await getBridgeState(supabase, 'groups_sync');
  const lastReq = gs.requested_at ? new Date(gs.requested_at).getTime() : 0;
  if (now.getTime() - lastReq > GROUP_SYNC_EVERY_MS || gs.force === true) {
    const inst = shellSafe(instance);
    lines.push(
      `(curl -s "${evo}/group/fetchAllGroups/${inst}?getParticipants=true" -H "apikey: ${safeKey}" | curl -s -X POST "${selfUrl}?action=sync_all_groups" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1) &`
    );
    await setBridgeState(supabase, 'groups_sync', { ...gs, requested_at: now.toISOString(), force: false });
  }

  // 4. Periodic re-check of chat classifications (every 10 min) so chats follow CRM changes.
  const rs = await getBridgeState(supabase, 'rescope');
  if (!rs.at || now.getTime() - new Date(rs.at).getTime() > 10 * 60 * 1000) {
    await setBridgeState(supabase, 'rescope', { at: now.toISOString() });
    const cid = await deps.resolveMainCompanyId(supabase, null);
    if (cid) {
      deps.rescopeChats(supabase, cid)
        .then((r) => setBridgeState(supabase, 'rescope', { at: now.toISOString(), checked: r.checked, changed: r.changed.slice(0, 50) }))
        .catch((e) => console.error('[wa] rescope error', e));
    }
  }

  // 5. One-time import of photos / documents / audio / video from the chat history
  //    (messages received before media was tracked). Runs automatically once, a few chats per poll.
  let hi = await getBridgeState(supabase, 'history_import');
  const histCid = !hi.status || hi.status === 'requested' ? await deps.resolveMainCompanyId(supabase, null) : null;
  if (histCid) {
    const cid = histCid;
    const since = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000).toISOString();
    const { data: chats } = await supabase
      .from('tickets')
      .select('metadata, updated_at')
      .eq('company_id', cid)
      .eq('metadata->>source', 'whatsapp_evolution')
      .gte('updated_at', since)
      .order('updated_at', { ascending: false })
      .limit(2000);
    const queue: { q: string; t: string }[] = [];
    const seen = new Set<string>();
    for (const c of chats || []) {
      const m = c.metadata || {};
      const tj = String(m.whatsapp_jid || '');
      if (!tj || m.merged_into) continue;
      const evoJids = [tj];
      if (m.whatsapp_lid && !tj.endsWith('@g.us')) evoJids.push(`${digits(m.whatsapp_lid)}@lid`);
      for (const q of evoJids) {
        if (seen.has(q)) continue;
        seen.add(q);
        queue.push({ q, t: tj });
      }
    }
    hi = { status: 'running', token: crypto.randomUUID().replace(/-/g, ''), queue, next: 0, started_at: now.toISOString() };
    await setBridgeState(supabase, 'history_import', hi);
  }
  if (hi.status === 'running' && Array.isArray(hi.queue)) {
    const inst = shellSafe(instance);
    const batch = 3;
    const start = Number(hi.next || 0);
    for (let i = start; i < Math.min(start + batch, hi.queue.length); i++) {
      for (let page = 1; page <= 3; page++) {
        const body = b64Utf8(JSON.stringify({ where: { key: { remoteJid: hi.queue[i].q } }, page, offset: 50 }));
        const impUrl = `${selfUrl}?action=import_history&i=${i}&token=${shellSafe(hi.token)}`;
        lines.push(
          `(echo "${body}" | base64 -d | curl -s -X POST "${evo}/chat/findMessages/${inst}" -H "Content-Type: application/json" -H "apikey: ${safeKey}" -d @- | curl -s -X POST "${impUrl}" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1) &`
        );
      }
    }
    const next = start + batch;
    await setBridgeState(supabase, 'history_import', {
      ...hi,
      next,
      ...(next >= hi.queue.length ? { status: 'done', finished_at: now.toISOString() } : {}),
    });
  }

  // 6. On-demand or auto-triggered Evolution instance heal (connection check + restart + catchup).
  const heal = await getBridgeState(supabase, 'evo_heal');
  if (heal.status === 'requested') {
    const inst = shellSafe(instance);
    const healToken = crypto.randomUUID().replace(/-/g, '');
    const mode = String(heal.mode || 'restart_and_catchup');
    await setBridgeState(supabase, 'evo_heal', {
      ...heal,
      status: 'dispatched',
      token: healToken,
      dispatched_at: now.toISOString(),
    });
    const healUrl = `${selfUrl}?action=report_evo_heal&token=${shellSafe(healToken)}`;
    if (mode === 'check_only') {
      lines.push(
        `(B1=$(curl -s "${evo}/instance/connectionState/${inst}" -H "apikey: ${safeKey}" | base64 | tr -d '\\n'); B2=$(curl -s "${evo}/webhook/find/${inst}" -H "apikey: ${safeKey}" | base64 | tr -d '\\n'); printf '{"state_before":"%s","webhook":"%s","restart":"","state_after":"%s"}' "$B1" "$B2" "$B1" | curl -s -X POST "${healUrl}" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1) &`
      );
    } else if (mode === 'restore_webhook') {
      const whBody = b64Utf8(
        JSON.stringify({
          webhook: {
            enabled: true,
            url: selfUrl,
            webhookByEvents: false,
            webhookBase64: true,
            events: WEBHOOK_EVENTS,
          },
        })
      );
      lines.push(
        `(B1=$(curl -s "${evo}/instance/connectionState/${inst}" -H "apikey: ${safeKey}" | base64 | tr -d '\\n'); echo "${whBody}" | base64 -d | curl -s -X POST "${evo}/webhook/set/${inst}" -H "Content-Type: application/json" -H "apikey: ${safeKey}" -d @- >/dev/null 2>&1; B2=$(curl -s "${evo}/webhook/find/${inst}" -H "apikey: ${safeKey}" | base64 | tr -d '\\n'); B3=$(curl -s "${evo}/instance/connect/${inst}" -H "apikey: ${safeKey}" | base64 | tr -d '\\n'); sleep 8; B4=$(curl -s "${evo}/instance/connectionState/${inst}" -H "apikey: ${safeKey}" | base64 | tr -d '\\n'); printf '{"state_before":"%s","webhook":"%s","restart":"%s","state_after":"%s"}' "$B1" "$B2" "$B3" "$B4" | curl -s -X POST "${healUrl}" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1) &`
      );
    } else if (mode === 'sync_baileys_recv') {
      const { data: signedFix } = await supabase.storage
        .from(MEDIA_BUCKET)
        .createSignedUrl('system/baileys-7.0.0-rc.9-messages-recv.js', 600);
      const fixUrlB64 = b64Utf8(String(signedFix?.signedUrl || ''));
      lines.push(
        `(B1=$(curl -s "${evo}/instance/connectionState/${inst}" -H "apikey: ${safeKey}" | base64 | tr -d '\\n'); DCMD="docker"; if ! docker ps >/dev/null 2>&1 && sudo -n docker ps >/dev/null 2>&1; then DCMD="sudo -n docker"; fi; CID=$($DCMD ps --format '{{.ID}} {{.Ports}}' 2>/dev/null | grep '8085' | head -n 1 | awk '{print $1}'); FURL=$(echo "${fixUrlB64}" | base64 -d); RES="missing_cid"; if [ -n "$CID" ]; then IMG=$($DCMD inspect "$CID" --format '{{.Config.Image}}' 2>/dev/null); $DCMD cp "$CID:/evolution/node_modules/baileys/lib/Socket/messages-recv.js" /tmp/baileys_cur.js 2>/dev/null; if grep -q "CB:status" /tmp/baileys_cur.js 2>/dev/null; then CMT=$($DCMD commit --pause=false "$CID" "$IMG" 2>&1); RES="already_patched_committed:$IMG:$CMT"; elif [ -n "$FURL" ]; then curl -fsSL "$FURL" -o /tmp/baileys_mr.js && grep -q "CB:status" /tmp/baileys_mr.js && grep -q "sourceMappingURL=messages-recv.js.map" /tmp/baileys_mr.js && cp /tmp/baileys_cur.js /tmp/baileys_mr.bak && $DCMD cp /tmp/baileys_mr.js "$CID:/evolution/node_modules/baileys/lib/Socket/messages-recv.js" && CMT=$($DCMD commit --pause=false "$CID" "$IMG" 2>&1) && RST=$($DCMD restart "$CID" 2>&1) && sleep 16 && RES="patched_committed_restarted:$IMG:$CMT:$RST"; fi; fi; B3=$(printf '%s' "$RES" | base64 | tr -d '\\n'); B2=$(curl -s "${evo}/webhook/find/${inst}" -H "apikey: ${safeKey}" | base64 | tr -d '\\n'); B4=$(curl -s "${evo}/instance/connectionState/${inst}" -H "apikey: ${safeKey}" | base64 | tr -d '\\n'); printf '{"state_before":"%s","webhook":"%s","restart":"%s","state_after":"%s"}' "$B1" "$B2" "$B3" "$B4" | curl -s -X POST "${healUrl}" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1) &`
      );
    } else {
      lines.push(
        `(B0=$(curl -s "${evo}/instance/fetchInstances" -H "apikey: ${safeKey}" | base64 | tr -d '\\n'); B1=$(curl -s "${evo}/instance/connectionState/${inst}" -H "apikey: ${safeKey}" | base64 | tr -d '\\n'); B2=$(curl -s "${evo}/webhook/find/${inst}" -H "apikey: ${safeKey}" | base64 | tr -d '\\n'); R1=$(curl -s "${evo}/instance/connect/${inst}" -H "apikey: ${safeKey}"); B3=$(printf '%s' "$R1" | base64 | tr -d '\\n'); sleep 8; B4=$(curl -s "${evo}/instance/connectionState/${inst}" -H "apikey: ${safeKey}" | base64 | tr -d '\\n'); printf '{"evo_info":"%s","state_before":"%s","webhook":"%s","restart":"%s","state_after":"%s"}' "$B0" "$B1" "$B2" "$B3" "$B4" | curl -s -X POST "${healUrl}" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1) &`
      );
    }
  }

  // 6b. Ensure Evolution instance is subscribed to CHATS_UPDATE (no restart needed).
  const whSync = await getBridgeState(supabase, 'webhook_events_sync');
  const lastSyncReq = whSync.requested_at ? new Date(whSync.requested_at).getTime() : 0;
  if (
    heal.status !== 'requested' &&
    heal.status !== 'dispatched' &&
    whSync.version !== WEBHOOK_EVENTS_VERSION &&
    now.getTime() - lastSyncReq > 90 * 1000
  ) {
    const inst = shellSafe(instance);
    const syncToken = crypto.randomUUID().replace(/-/g, '');
    const whBody = b64Utf8(
      JSON.stringify({
        webhook: {
          enabled: true,
          url: selfUrl,
          webhookByEvents: false,
          webhookBase64: true,
          events: WEBHOOK_EVENTS,
        },
      }),
    );
    const ackUrl = `${selfUrl}?action=ack_webhook_events&token=${shellSafe(syncToken)}`;
    lines.push(
      `(echo "${whBody}" | base64 -d | curl -s -X POST "${evo}/webhook/set/${inst}" -H "Content-Type: application/json" -H "apikey: ${safeKey}" -d @- >/dev/null 2>&1; W2=$(curl -s "${evo}/webhook/find/${inst}" -H "apikey: ${safeKey}" | base64 | tr -d '\\n'); printf '{"webhook":"%s"}' "$W2" | curl -s -X POST "${ackUrl}" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1) &`,
    );
    await setBridgeState(supabase, 'webhook_events_sync', {
      ...whSync,
      token: syncToken,
      target_version: WEBHOOK_EVENTS_VERSION,
      requested_at: now.toISOString(),
    });
  }

  // 7. Sequential multi-page catchup of missed text + media messages (chronological order).
  const mc = await getBridgeState(supabase, 'message_catchup');
  if (mc.status === 'running' && Number(mc.page) >= 1) {
    const notBeforeOk = !mc.not_before || now.getTime() >= new Date(mc.not_before).getTime();
    const inflightExpired = !mc.inflight_at || now.getTime() - new Date(mc.inflight_at).getTime() > 40 * 1000;
    if (notBeforeOk && inflightExpired) {
      const inst = shellSafe(instance);
      const pageNum = Number(mc.page);
      const offsetNum = Number(mc.offset || 80);
      const sinceSec = mc.since ? Math.floor(new Date(mc.since).getTime() / 1000) : Math.floor((now.getTime() - 14 * 3600 * 1000) / 1000);
      const whereClause = mc.no_ts_filter ? {} : { messageTimestamp: { gte: sinceSec } };
      const body = b64Utf8(JSON.stringify({ where: whereClause, page: pageNum, offset: offsetNum }));
      const catchupUrl = `${selfUrl}?action=catchup_messages&page=${pageNum}&token=${shellSafe(mc.token)}`;
      lines.push(
        `(echo "${body}" | base64 -d | curl -s -X POST "${evo}/chat/findMessages/${inst}" -H "Content-Type: application/json" -H "apikey: ${safeKey}" -d @- | curl -s -X POST "${catchupUrl}" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1) &`
      );
      await setBridgeState(supabase, 'message_catchup', { ...mc, inflight_at: now.toISOString() });
    }
  }

  // 8. Permanent 2-minute watchdog: checks connectionState + latest messages, auto-recovers
  //    dropped webhooks and auto-restarts the Evolution instance if its webhook emitter freezes.
  const wd = await getBridgeState(supabase, 'evo_watchdog');
  const lastWdReq = wd.requested_at ? new Date(wd.requested_at).getTime() : 0;
  if (
    heal.status !== 'requested' &&
    heal.status !== 'dispatched' &&
    mc.status !== 'running' &&
    now.getTime() - lastWdReq > 2 * 60 * 1000
  ) {
    const inst = shellSafe(instance);
    const wdToken = crypto.randomUUID().replace(/-/g, '');
    const sinceSec = Math.floor((now.getTime() - 6 * 3600 * 1000) / 1000);
    const wdQuery = wd.no_ts_filter && Number(wd.last_total_pages) > 0
      ? { where: {}, page: Number(wd.last_total_pages), offset: 40 }
      : { where: { messageTimestamp: { gte: sinceSec } }, page: 1, offset: 40 };
    const wdBody = b64Utf8(JSON.stringify(wdQuery));
    const wdUrl = `${selfUrl}?action=watchdog_check&token=${shellSafe(wdToken)}`;
    lines.push(
      `(S1=$(curl -s "${evo}/instance/connectionState/${inst}" -H "apikey: ${safeKey}" | base64 | tr -d '\\n'); M1=$(echo "${wdBody}" | base64 -d | curl -s -X POST "${evo}/chat/findMessages/${inst}" -H "Content-Type: application/json" -H "apikey: ${safeKey}" -d @- | base64 | tr -d '\\n'); DCMD="docker"; if ! docker ps >/dev/null 2>&1 && sudo -n docker ps >/dev/null 2>&1; then DCMD="sudo -n docker"; fi; CID=$($DCMD ps --format '{{.ID}} {{.Ports}}' 2>/dev/null | grep '8085' | head -n 1 | awk '{print $1}'); BUP="0"; if [ -n "$CID" ]; then $DCMD cp "$CID:/evolution/node_modules/baileys/package.json" /tmp/b_pkg.json 2>/dev/null; $DCMD cp "$CID:/evolution/node_modules/baileys/lib/Socket/messages-recv.js" /tmp/b_mr.js 2>/dev/null; if grep -q '"7.0.0-rc.9"' /tmp/b_pkg.json 2>/dev/null && ! grep -q 'CB:status' /tmp/b_mr.js 2>/dev/null; then BUP="1"; fi; fi; printf '{"state":"%s","messages":"%s","baileys_unpatched":"%s"}' "$S1" "$M1" "$BUP" | curl -s -X POST "${wdUrl}" -H "Content-Type: application/json" --data-binary @- >/dev/null 2>&1) &`
    );
    await setBridgeState(supabase, 'evo_watchdog', { ...wd, token: wdToken, requested_at: now.toISOString() });
  }

  return new Response(lines.length > 0 ? lines.join('\n') + '\n' : '# idle\n', {
    headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

export async function handleBridgeAck(supabase: any, url: URL, payload: any): Promise<Response> {
  const rawTicketId = String(url.searchParams.get('ticket_id') || payload?.ticket_id || '').trim();
  const ticketId = rawTicketId && rawTicketId !== 'null' && rawTicketId !== 'undefined' ? rawTicketId : '';
  const outboxId = url.searchParams.get('outbox_id') || payload?.outbox_id || '';
  if (!ticketId && !outboxId) return json({ ok: false, error: 'missing ticket_id or outbox_id' }, 400);
  // New bridge lines post Evolution's raw response; legacy ones wrap it in evo_response.
  let evo: any = payload?.evo_response !== undefined ? payload.evo_response : payload;
  if (typeof evo === 'string') {
    try {
      evo = JSON.parse(evo);
    } catch (_e) {
      /* keep string */
    }
  }
  const sentId: string = evo?.key?.id || '';
  const evoError = !sentId ? JSON.stringify(evo || {}).slice(0, 300) : '';
  const nowIso = new Date().toISOString();
  await setBridgeState(supabase, 'bridge_last_ack', { at: nowIso, ok: Boolean(sentId), error: evoError || null });

  if (!outboxId) return json({ ok: true, legacy: true });
  let obQuery = supabase
    .from('whatsapp_outbox')
    .update({
      status: sentId ? 'sent' : 'error',
      acked_at: nowIso,
      ...(sentId ? { wa_message_id: sentId, error: null } : { error: evoError || 'Evolution no confirmó el envío' }),
    })
    .eq('id', outboxId);
  if (ticketId) {
    obQuery = obQuery.eq('ticket_id', ticketId);
  }
  const { data: ob } = await obQuery
    .select('id, company_id, ticket_id, comment_id, number, kind')
    .maybeSingle();
  if (!ob) return json({ ok: false, error: 'outbox item not found' }, 404);

  if (!sentId && /"exists"\s*:\s*false/i.test(evoError) && ob.ticket_id) {
    try {
      const [{ data: inboundRows }, { data: sentRows }, { data: tRow }] = await Promise.all([
        supabase
          .from('whatsapp_messages')
          .select('id')
          .eq('ticket_id', ob.ticket_id)
          .eq('from_me', false)
          .limit(1),
        supabase
          .from('whatsapp_outbox')
          .select('id')
          .eq('ticket_id', ob.ticket_id)
          .eq('status', 'sent')
          .not('wa_message_id', 'is', null)
          .limit(1),
        supabase
          .from('tickets')
          .select('id, company_id, lead_id, metadata')
          .eq('id', ob.ticket_id)
          .maybeSingle(),
      ]);

      const hasInbound = Boolean(inboundRows && inboundRows.length > 0);
      const hasSent = Boolean(sentRows && sentRows.length > 0);
      if (tRow && !hasInbound && !hasSent) {
        const curMeta = cleanMeta(tRow.metadata || {});
        if (curMeta.wa_lead_status_override !== true) {
          await supabase
            .from('tickets')
            .update({
              updated_at: nowIso,
              metadata: {
                ...curMeta,
                wa_delivery_error: 'Sin cuenta de WhatsApp',
                wa_lead_status: 'Erróneo',
                ai_qualifier_active: false,
                wa_attended_at: nowIso,
              },
            })
            .eq('id', tRow.id);

          if (tRow.lead_id) {
            const { data: ld } = await supabase
              .from('leads')
              .select('id, status')
              .eq('id', tRow.lead_id)
              .maybeSingle();
            const curLeadStatus = String(ld?.status || '').trim();
            if (ld && ['', 'Prospecto', 'Llamada fría', 'En Nutrición'].includes(curLeadStatus)) {
              await supabase
                .from('leads')
                .update({ status: 'Erróneo', updated_at: nowIso })
                .eq('id', ld.id);
              await supabase
                .from('lead_qualifier_sessions')
                .update({
                  status: 'closed_discarded',
                  handoff_reason: 'Número sin cuenta de WhatsApp (exists:false)',
                  handoff_at: nowIso,
                })
                .eq('company_id', tRow.company_id)
                .eq('lead_id', ld.id)
                .in('status', ['active', 'pending_first_touch', 'waiting_reply']);
            }
          }
        }
      }
    } catch (syncErr) {
      console.warn('[handleBridgeAck] failed syncing Erróneo state:', syncErr);
    }
  }

  if (sentId && ob.comment_id && ob.ticket_id) {
    // Link the WhatsApp id to the chat line so the fromMe echo is recognised as a duplicate.
    const { data: linked } = await supabase
      .from('whatsapp_messages')
      .update({ wa_message_id: sentId })
      .eq('comment_id', ob.comment_id)
      .is('wa_message_id', null)
      .select('id');
    if (!linked || linked.length === 0) {
      await supabase.from('whatsapp_messages').upsert(
        {
          company_id: ob.company_id, ticket_id: ob.ticket_id, comment_id: ob.comment_id, wa_message_id: sentId,
          remote_jid: ob.number, from_me: true, message_type: ob.kind === 'media' ? 'document' : 'text',
        },
        { onConflict: 'company_id,wa_message_id', ignoreDuplicates: true }
      );
    }
  }
  return json({ ok: true, sent: Boolean(sentId) });
}

export async function handleBridgeStatus(supabase: any): Promise<Response> {
  const [poll, ack, gs, wd, heal, mc, lastWh, whSync, { count: pendingMedia }, { count: failedMedia }, { count: pendingOut }, { count: errorOut }] =
    await Promise.all([
      getBridgeState(supabase, 'bridge_last_poll'),
      getBridgeState(supabase, 'bridge_last_ack'),
      getBridgeState(supabase, 'groups_sync'),
      getBridgeState(supabase, 'evo_watchdog'),
      getBridgeState(supabase, 'evo_heal'),
      getBridgeState(supabase, 'message_catchup'),
      getBridgeState(supabase, 'last_webhook_in'),
      getBridgeState(supabase, 'webhook_events_sync'),
      supabase.from('whatsapp_messages').select('id', { count: 'exact', head: true }).in('media_status', ['pending', 'requested']),
      supabase.from('whatsapp_messages').select('id', { count: 'exact', head: true }).eq('media_status', 'failed'),
      supabase.from('whatsapp_outbox').select('id', { count: 'exact', head: true }).in('status', ['pending', 'dispatched']),
      supabase
        .from('whatsapp_outbox')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'error')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    ]);
  const { key } = await evolutionCredentials(supabase);
  return json({
    ok: true,
    bridge_last_poll: poll.at || null,
    bridge_last_ack: ack.at || null,
    bridge_last_error: ack.error || null,
    last_webhook_in: lastWh.at || null,
    webhook_events_version: whSync.version || null,
    evo_connection_state: wd.connection_state || heal.connection_after || null,
    evo_watchdog_checked_at: wd.checked_at || null,
    evo_watchdog_recovered_total: wd.recovered_total || 0,
    catchup_status: mc.status || null,
    catchup_imported_total: mc.imported_total || 0,
    groups_synced_at: gs.synced_at || null,
    groups_count: gs.groups || 0,
    groups_last_error: gs.last_error || null,
    media_pending: pendingMedia || 0,
    media_failed: failedMedia || 0,
    outbox_pending: pendingOut || 0,
    outbox_errors_24h: errorOut || 0,
    evolution_key_configured: Boolean(key),
  });
}
