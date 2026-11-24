import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const esbuild = require('esbuild');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-social-planning-tests-'));

let mod;
test.before(async () => {
  const outFile = path.join(tmpDir, 'helpers.mjs');
  await esbuild.build({
    entryPoints: [path.resolve('supabase/functions/arias-social-bridge/helpers.ts')],
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

test('1. Extracts ChatGPT openaiFileIdRefs, direct image_url, and base64 payloads accurately', () => {
  const fromRef = mod.extractImageCandidate({
    openaiFileIdRefs: [
      {
        name: 'episodio-15.png',
        id: 'file-123',
        mime_type: 'image/png',
        download_link: 'https://files.oaiusercontent.com/signed-temp-link.png',
      },
    ],
  });
  assert.equal(fromRef.url, 'https://files.oaiusercontent.com/signed-temp-link.png');
  assert.equal(fromRef.mimeType, 'image/png');
  assert.equal(fromRef.fileName, 'episodio-15.png');

  const fromUrl = mod.extractImageCandidate({ image_url: 'https://cdn.example.com/flyer.jpg' });
  assert.equal(fromUrl.url, 'https://cdn.example.com/flyer.jpg');
  assert.equal(fromUrl.mimeType, 'image/jpeg');

  const fromB64 = mod.extractImageCandidate({
    image_base64: 'data:image/jpeg;base64,aGVsbG8=',
  });
  assert.equal(fromB64.url, null);
  assert.equal(fromB64.base64, 'aGVsbG8=');
  assert.equal(fromB64.mimeType, 'image/jpeg');
});

test('2. Resolves target accounts across page_names, explicit IDs, and platform defaults', () => {
  const active = [
    { platform: 'facebook', account_id: 'fb-1', account_name: 'Arias Group', is_default: true, is_active: true },
    { platform: 'facebook', account_id: 'fb-2', account_name: 'Jimmy Arias AI + Lean', is_default: false, is_active: true },
    { platform: 'instagram', account_id: 'ig-1', account_name: 'ariasdefense', is_default: true, is_active: true },
  ];

  const byNames = mod.normalizeTargetAccounts(
    { page_names: ['Jimmy Arias AI + Lean', 'Arias Group'] },
    active,
  );
  assert.equal(byNames.length, 2);
  assert.deepEqual(
    byNames.map((t) => t.account_id),
    ['fb-2', 'fb-1'],
  );

  const byDefaults = mod.normalizeTargetAccounts({ platforms: ['facebook', 'instagram'] }, active);
  assert.equal(byDefaults.length, 2);
  assert.equal(byDefaults[0].account_id, 'fb-1');
  assert.equal(byDefaults[1].account_id, 'ig-1');
});

test('3. Validates and normalizes scheduled_at ISO strings with El Salvador -06:00 default', () => {
  const localNoTz = mod.validateScheduledIso('2026-11-24T10:30');
  assert.equal(localNoTz.valid, true);
  assert.equal(localNoTz.iso, '2026-11-24T16:30:00.000Z');

  const empty = mod.validateScheduledIso(null);
  assert.equal(empty.valid, true);
  assert.equal(empty.iso, null);

  const bad = mod.validateScheduledIso('not-a-date');
  assert.equal(bad.valid, false);
});

test('4. Generates deterministic SHA-256 hashes, prefixed tokens, and OpenAPI spec with openaiFileIdRefs', async () => {
  const tok1 = mod.generateSecureToken('arias_gpt_');
  const tok2 = mod.generateSecureToken('arias_gpt_');
  assert.ok(tok1.startsWith('arias_gpt_'));
  assert.notEqual(tok1, tok2);

  const h1 = await mod.sha256Hex(tok1);
  const h2 = await mod.sha256Hex(tok1);
  assert.equal(h1.length, 64);
  assert.equal(h1, h2);

  const schema = mod.buildChatGptOpenApiSchema('https://mtxqqamitglhehaktgxm.supabase.co/functions/v1/arias-social-bridge');
  assert.ok(schema.paths['/accounts']);
  assert.ok(schema.paths['/memory']);
  assert.ok(schema.paths['/posts'].post.requestBody.content['application/json'].schema.properties.openaiFileIdRefs);

  const instr = mod.buildChatGptSystemInstructions('Arias Defense');
  assert.ok(instr.includes('getContentMemory'));
  assert.ok(instr.includes('Planning'));
});

test('5. Edge Function arias-social-bridge/index.ts bundles cleanly without syntax/import errors', async () => {
  const outFile = path.join(tmpDir, 'index.bundle.mjs');
  await esbuild.build({
    entryPoints: [path.resolve('supabase/functions/arias-social-bridge/index.ts')],
    bundle: true,
    platform: 'neutral',
    format: 'esm',
    outfile: outFile,
    external: ['https://deno.land/*', 'https://esm.sh/*'],
    logLevel: 'silent',
  });
  assert.ok(fs.existsSync(outFile));
  assert.ok(fs.statSync(outFile).size > 2000);
});
