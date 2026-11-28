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
let matcherMod;
test.before(async () => {
  const outFile = path.join(tmpDir, 'helpers.mjs');
  const matcherOutFile = path.join(tmpDir, 'matcher.mjs');
  await Promise.all([
    esbuild.build({
      entryPoints: [path.resolve('supabase/functions/meta-ads-insights/helpers.ts')],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile: outFile,
    }),
    esbuild.build({
      entryPoints: [path.resolve('src/lib/socialBrandMatcher.ts')],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile: matcherOutFile,
    }),
  ]);
  mod = await import(pathToFileURL(outFile).href);
  matcherMod = await import(pathToFileURL(matcherOutFile).href);
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

test('6. resolveWonDealAmount and computeRoiMetrics match CRM Cerrado/Cliente ROI rules', () => {
  assert.equal(mod.resolveWonDealAmount({ closing_amount: '450.50', value: '900' }), 450.5);
  assert.equal(mod.resolveWonDealAmount({ closing_amount: 0, value: 900 }), 0);
  assert.equal(mod.resolveWonDealAmount({ closing_amount: null, value: '320.25' }), 320.25);
  assert.equal(mod.resolveWonDealAmount({ closing_amount: null, value: null }), 0);

  // Profitable scenario (e.g. $450.65 ad spend + $0.0062 AI vs $994.85 CRM won)
  const roiPos = mod.computeRoiMetrics({
    adSpend: 450.65,
    aiCost: 0.0062,
    wonRevenue: 994.85,
    wonDeals: 3,
    metaWonRevenue: 774.5,
    metaWonDeals: 2,
  });
  assert.equal(roiPos.total_investment, 450.66);
  assert.equal(roiPos.net_profit, 544.19);
  assert.equal(roiPos.roi_pct, 120.8);
  assert.equal(roiPos.roas, 2.21);
  assert.equal(roiPos.cac, 150.22);
  assert.equal(roiPos.meta_net_profit, 323.84);
  assert.equal(roiPos.meta_roi_pct, 71.9);
  assert.equal(roiPos.meta_roas, 1.72);

  // Negative ROI scenario
  const roiNeg = mod.computeRoiMetrics({
    adSpend: 500,
    aiCost: 0,
    wonRevenue: 200,
    wonDeals: 1,
    metaWonRevenue: 0,
    metaWonDeals: 0,
  });
  assert.equal(roiNeg.net_profit, -300);
  assert.equal(roiNeg.roi_pct, -60);
  assert.equal(roiNeg.roas, 0.4);

  // Zero spend & zero deals edge case
  const roiZero = mod.computeRoiMetrics({
    adSpend: 0,
    aiCost: 0,
    wonRevenue: 0,
    wonDeals: 0,
    metaWonRevenue: 0,
    metaWonDeals: 0,
  });
  assert.equal(roiZero.roi_pct, null);
  assert.equal(roiZero.roas, null);
  assert.equal(roiZero.cac, null);
});

test('7. classifyLeadOrigin and classifyWonCohort attribute Redes Sociales, Meta Ads, and same/previous cohorts', () => {
  const fbLead = mod.classifyLeadOrigin({ source: 'facebook_ads', meta_campaign_name: 'ERP SV Nov' });
  assert.equal(fbLead.bucket, 'meta_ads');
  assert.equal(fbLead.is_meta_ads, true);
  assert.equal(fbLead.is_meta_or_social, true);
  assert.equal(fbLead.source_label, 'Facebook Ads');
  assert.equal(fbLead.campaign_label, 'ERP SV Nov');

  const socialLead = mod.classifyLeadOrigin({ source: 'redes_sociales' });
  assert.equal(socialLead.bucket, 'social');
  assert.equal(socialLead.is_meta_ads, false);
  assert.equal(socialLead.is_meta_or_social, true);
  assert.equal(socialLead.source_label, 'Redes Sociales');

  const sheetLead = mod.classifyLeadOrigin({
    source: 'otro',
    raw_meta_payload: { sheet_name: 'Leads_Nov_2026', campaign_name: 'Campaña ERP' },
  });
  assert.equal(sheetLead.bucket, 'meta_ads');
  assert.equal(sheetLead.is_meta_ads, true);
  assert.equal(sheetLead.campaign_label, 'Campaña ERP');

  const directLead = mod.classifyLeadOrigin({ source: 'otro' });
  assert.equal(directLead.bucket, 'other');
  assert.equal(directLead.is_meta_or_social, false);
  assert.equal(directLead.source_label, 'Otros');

  const sameMonth = mod.classifyWonCohort('2026-11-04', '2026-11-13', '2026-11-01');
  assert.deepEqual(sameMonth, { cohort: 'same_period', days_to_close: 9 });

  const prevMonth = mod.classifyWonCohort('2026-10-18', '2026-11-06', '2026-11-01');
  assert.deepEqual(prevMonth, { cohort: 'previous_period', days_to_close: 19 });
});

test('8. matchBrandSocialAccounts & pickDistinctPlatformAccounts match brands to pages and deduplicate platforms', () => {
  const accounts = [
    { id: '1', platform: 'facebook', account_name: 'Jimmy Arias AI + Lean', avatar_url: 'https://cdn.example/jimmy.jpg', is_default: true },
    { id: '2', platform: 'facebook', account_name: 'Arias Defense', avatar_url: 'https://cdn.example/defense.jpg', is_default: false },
    { id: '3', platform: 'facebook', account_name: 'Arias Group', avatar_url: 'https://cdn.example/group.jpg', is_default: false },
    { id: '4', platform: 'instagram', account_name: 'Arias Defense', avatar_url: 'https://cdn.example/defense-ig.jpg', is_default: false },
    { id: '5', platform: 'youtube', account_name: 'Jimmy Arias AI + Lean', avatar_url: 'https://cdn.example/yt.jpg', is_default: false },
    { id: '6', platform: 'meta_ads', account_name: 'Arias Group', avatar_url: null, is_default: true },
  ];

  const jimmyMatch = matcherMod.matchBrandSocialAccounts('Jimmy Arias', accounts);
  assert.deepEqual(jimmyMatch.platforms, ['facebook', 'youtube']);
  assert.equal(jimmyMatch.avatarUrl, 'https://cdn.example/jimmy.jpg');

  const defenseMatch = matcherMod.matchBrandSocialAccounts('Arias Defense Components', accounts);
  assert.deepEqual(defenseMatch.platforms, ['facebook', 'instagram']);
  assert.equal(defenseMatch.matched.some((a) => a.account_name === 'Jimmy Arias AI + Lean'), false);

  const groupMatch = matcherMod.matchBrandSocialAccounts('Arias Group', accounts);
  assert.deepEqual(groupMatch.platforms, ['facebook']);
  assert.equal(groupMatch.matched.length, 1);

  const distinct = matcherMod.pickDistinctPlatformAccounts(accounts, 4);
  assert.deepEqual(
    distinct.map((a) => a.platform),
    ['facebook', 'instagram', 'youtube', 'meta_ads'],
  );
});

test('9. groupSocialBrands clusters FB/IG/YT/Meta Ads per brand and matches spaceless IG handles', () => {
  const fullTopology = [
    { id: 'fb1', platform: 'facebook', account_id: 'fb_ag', account_name: 'Arias Group', avatar_url: 'https://scontent.fb/ag.jpg', is_default: false },
    { id: 'fb2', platform: 'facebook', account_id: 'fb_ja', account_name: 'Jimmy Arias AI + Lean', avatar_url: 'https://scontent.fb/ja.jpg', is_default: true },
    { id: 'fb3', platform: 'facebook', account_id: 'fb_ic', account_name: 'Iclesia AI', avatar_url: 'https://scontent.fb/ic.jpg', is_default: false },
    { id: 'fb4', platform: 'facebook', account_id: 'fb_ad', account_name: 'Arias Defense Components LLC', avatar_url: 'https://scontent.fb/ad.jpg', is_default: false },
    { id: 'ig1', platform: 'instagram', account_id: 'ig_ag', account_name: 'ariasgroupsv', avatar_url: null, is_default: false },
    { id: 'ig2', platform: 'instagram', account_id: 'ig_ja', account_name: 'jimmy.arias147c', avatar_url: null, is_default: false },
    { id: 'yt1', platform: 'youtube', account_id: 'yt_ic', account_name: 'Iclesia', avatar_url: 'https://yt3.ggpht.com/ic.jpg', is_default: true },
    { id: 'yt2', platform: 'youtube', account_id: 'yt_ja', account_name: 'Jimmy Arias', avatar_url: 'https://yt3.ggpht.com/ja.jpg', is_default: false },
    { id: 'yt3', platform: 'youtube', account_id: 'yt_af', account_name: 'ARIAS FINTECH', avatar_url: 'https://yt3.ggpht.com/af.jpg', is_default: false },
    { id: 'ma1', platform: 'meta_ads', account_id: 'act_1', account_name: 'Arias Group', avatar_url: null, is_default: true },
    { id: 'ma2', platform: 'meta_ads', account_id: 'act_2', account_name: 'Arias Defense Components', avatar_url: null, is_default: false },
    { id: 'ma3', platform: 'meta_ads', account_id: 'act_3', account_name: 'Jimmy Arias', avatar_url: null, is_default: false },
  ];

  const brands = matcherMod.groupSocialBrands(fullTopology);
  assert.equal(brands.length, 5);

  const ariasGroup = brands.find((b) => b.name === 'Arias Group');
  assert.ok(ariasGroup);
  assert.deepEqual(ariasGroup.publishableAccountIds.sort(), ['fb_ag', 'ig_ag']);
  assert.equal(ariasGroup.platforms.includes('meta_ads'), true);
  assert.equal(ariasGroup.platforms.includes('instagram'), true);

  const jimmy = brands.find((b) => b.name === 'Jimmy Arias AI + Lean');
  assert.ok(jimmy);
  assert.deepEqual(jimmy.publishableAccountIds.sort(), ['fb_ja', 'ig_ja', 'yt_ja']);
  assert.equal(jimmy.avatarUrls[0], 'https://yt3.ggpht.com/ja.jpg'); // prioritizes reliable YT URL over FB scontent

  const iclesia = brands.find((b) => b.name === 'Iclesia AI');
  assert.ok(iclesia);
  assert.deepEqual(iclesia.publishableAccountIds.sort(), ['fb_ic', 'yt_ic']);
});
