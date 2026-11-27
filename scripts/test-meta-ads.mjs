import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const esbuild = require('esbuild');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-meta-ads-tests-'));

let mod;
test.before(async () => {
  const outFile = path.join(tmpDir, 'helpers.mjs');
  await esbuild.build({
    entryPoints: [path.resolve('supabase/functions/meta-ads-insights/helpers.ts')],
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

test('1. normalizeAdAccountId normalizes numeric IDs, act_ prefixes, and empty strings', () => {
  assert.equal(mod.normalizeAdAccountId('1234567890'), 'act_1234567890');
  assert.equal(mod.normalizeAdAccountId('  ACT_987654321  '), 'act_987654321');
  assert.equal(mod.normalizeAdAccountId(''), '');
  assert.equal(mod.normalizeAdAccountId(null), '');
});

test('2. extractMetaLeadCount prioritizes grouped lead actions without double counting', () => {
  const actionsWithBoth = [
    { action_type: 'link_click', value: '84' },
    { action_type: 'lead', value: '12' },
    { action_type: 'onsite_conversion.lead_grouped', value: '12' },
    { action_type: 'offsite_conversion.fb_pixel_lead', value: '3' },
  ];
  assert.equal(mod.extractMetaLeadCount(actionsWithBoth), 12);

  const pixelOnly = [{ action_type: 'offsite_conversion.fb_pixel_lead', value: '5' }];
  assert.equal(mod.extractMetaLeadCount(pixelOnly), 5);
  assert.equal(mod.extractMetaLeadCount([]), 0);
});

test('3. aggregateMetaInsights calculates spend, impressions, clicks, CTR, CPC, CPL, and ordering', () => {
  const dailyRows = [
    {
      date_start: '2026-11-05',
      spend: '24.50',
      impressions: '2000',
      reach: '1600',
      clicks: '50',
      inline_link_clicks: '38',
      actions: [{ action_type: 'onsite_conversion.lead_grouped', value: '4' }],
    },
    {
      date_start: '2026-11-02',
      spend: '15.50',
      impressions: '1000',
      reach: '900',
      clicks: '25',
      actions: [{ action_type: 'lead', value: '4' }],
    },
  ];
  const campRows = [
    {
      campaign_id: 'c1',
      campaign_name: 'ERP Facturación DTE SV',
      spend: '30.00',
      impressions: '2200',
      reach: '1800',
      clicks: '60',
      actions: [{ action_type: 'lead', value: '6' }],
    },
    {
      campaign_id: 'c2',
      campaign_name: 'SIPLE Lotes',
      spend: '10.00',
      impressions: '800',
      reach: '700',
      clicks: '15',
      actions: [{ action_type: 'lead', value: '2' }],
    },
  ];

  const out = mod.aggregateMetaInsights(dailyRows, campRows);
  assert.equal(out.daily[0].date, '2026-11-02');
  assert.equal(out.daily[1].date, '2026-11-05');
  assert.equal(out.summary.spend, 40);
  assert.equal(out.summary.impressions, 3000);
  assert.equal(out.summary.clicks, 75);
  assert.equal(out.summary.meta_leads, 8);
  assert.equal(out.summary.ctr, 2.5);
  assert.equal(out.summary.cpl, 5);
  assert.equal(out.campaigns[0].campaign_id, 'c1');
  assert.equal(out.campaigns[0].cpl, 5);
});

test('4. computeDateRangePreset handles mtd, today, 7d, and last_month cleanly', () => {
  // 2026-11-27 18:00Z = 12:00 PM El Salvador
  const ref = new Date('2026-11-27T18:00:00Z');
  assert.deepEqual(mod.computeDateRangePreset('mtd', ref), { since: '2026-11-01', until: '2026-11-27' });
  assert.deepEqual(mod.computeDateRangePreset('today', ref), { since: '2026-11-27', until: '2026-11-27' });
  assert.deepEqual(mod.computeDateRangePreset('7d', ref), { since: '2026-11-21', until: '2026-11-27' });
  assert.deepEqual(mod.computeDateRangePreset('last_month', ref), { since: '2026-10-01', until: '2026-10-31' });
});

test('5. Edge Function meta-ads-insights/index.ts bundles cleanly without syntax/import errors', async () => {
  const outFile = path.join(tmpDir, 'index.bundle.mjs');
  await esbuild.build({
    entryPoints: [path.resolve('supabase/functions/meta-ads-insights/index.ts')],
    bundle: true,
    platform: 'neutral',
    format: 'esm',
    outfile: outFile,
    external: ['https://esm.sh/*'],
    logLevel: 'silent',
  });
  assert.ok(fs.existsSync(outFile));
  assert.ok(fs.statSync(outFile).size > 2000);
});
