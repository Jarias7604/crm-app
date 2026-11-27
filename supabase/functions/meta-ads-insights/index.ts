import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  aggregateMetaInsights,
  computeDateRangePreset,
  computeRoiMetrics,
  normalizeAdAccountId,
  resolveWonDealAmount,
} from './helpers.ts';

const META_API_VERSION = 'v22.0';
const DEFAULT_TZ = 'America/El_Salvador';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface AuthContext {
  userId: string;
  companyId: string | null;
  isPlatformAdmin: boolean;
}

async function resolveAuth(req: Request, supabase: any): Promise<AuthContext | null> {
  const authHeader = req.headers.get('Authorization') || '';
  const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!bearer) return null;

  const { data: userData, error } = await supabase.auth.getUser(bearer);
  if (error || !userData?.user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, company_id, role, is_active, is_platform_owner')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (!profile || profile.is_active === false) return null;
  return {
    userId: profile.id,
    companyId: profile.company_id || null,
    isPlatformAdmin: profile.role === 'super_admin' || profile.is_platform_owner === true,
  };
}

function canAccessCompany(auth: AuthContext, targetCompanyId: string | null | undefined): boolean {
  if (!targetCompanyId) return false;
  if (auth.isPlatformAdmin) return true;
  return Boolean(auth.companyId && auth.companyId === targetCompanyId);
}

function isMetaOrSheetsLead(lead: any): boolean {
  const src = String(lead?.source || '').toLowerCase();
  if (src.includes('facebook') || src.includes('meta') || src.includes('fb') || src.includes('sheet')) {
    return true;
  }
  const p = lead?.raw_meta_payload;
  if (p && typeof p === 'object') {
    const pSrc = String(p.source || '').toLowerCase();
    if (pSrc.includes('facebook') || pSrc.includes('meta') || pSrc.includes('sheet') || p.sheet_name) {
      return true;
    }
  }
  return false;
}

function toSvYmd(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: DEFAULT_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso));
  } catch {
    return String(iso || '').slice(0, 10);
  }
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

async function upsertMetaAdAccounts(
  supabase: any,
  companyId: string,
  accessToken: string,
  accounts: any[],
  mode: 'token' | 'oauth',
  expiresAtIso: string | null,
) {
  const saved: any[] = [];
  for (const acc of accounts) {
    const fullId = normalizeAdAccountId(acc?.id || acc?.account_id);
    if (!fullId) continue;
    const accName = String(acc?.name || '').trim() || `Meta Ads ${fullId}`;
    const { data: upserted, error } = await supabase
      .from('social_accounts')
      .upsert(
        {
          company_id: companyId,
          platform: 'meta_ads',
          account_id: fullId,
          account_name: accName,
          display_name: accName,
          access_token: accessToken,
          token_expires_at: expiresAtIso,
          is_active: true,
          metadata: {
            ad_account_id: fullId,
            currency: acc?.currency || 'USD',
            account_status: acc?.account_status ?? 1,
            connection_mode: mode,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id,platform,account_id' },
      )
      .select('id, company_id, platform, account_id, account_name, display_name, is_active, is_default, metadata')
      .single();

    if (!error && upserted) saved.push(upserted);
  }

  if (saved.length > 0) {
    const { data: existingDefault } = await supabase
      .from('social_accounts')
      .select('id')
      .eq('company_id', companyId)
      .eq('platform', 'meta_ads')
      .eq('is_active', true)
      .eq('is_default', true)
      .maybeSingle();
    if (!existingDefault) {
      await supabase.from('social_accounts').update({ is_default: true }).eq('id', saved[0].id);
      saved[0].is_default = true;
    }
  }

  return saved;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('CRM_SUPABASE_URL') || Deno.env.get('SUPABASE_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !serviceKey) {
      return json({ ok: false, error: 'Missing Supabase env vars' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const auth = await resolveAuth(req, supabase);
    if (!auth) return json({ ok: false, error: 'No autorizado' }, 401);

    const payload = await req.json().catch(() => ({}));
    const action = String(payload?.action || 'get_insights').trim();
    const companyId = String(payload?.company_id || auth.companyId || '').trim();
    if (!companyId || !canAccessCompany(auth, companyId)) {
      return json({ ok: false, error: 'Empresa no autorizada' }, 403);
    }

    // ── ACTION: connect_token (Business Manager System User / Marketing API Token) ──
    if (action === 'connect_token') {
      const token = String(payload?.access_token || '').trim();
      const specificAccount = normalizeAdAccountId(payload?.ad_account_id);
      if (!token) {
        return json({ ok: false, error: 'Ingresa el Access Token de Meta Ads.' });
      }

      let rawAccounts: any[] = [];
      if (specificAccount) {
        const res = await fetchJsonWithTimeout(
          `https://graph.facebook.com/${META_API_VERSION}/${specificAccount}?fields=id,account_id,name,currency,account_status&access_token=${encodeURIComponent(token)}`,
        );
        if (!res.ok || res.data?.error) {
          return json({
            ok: false,
            error: `Meta rechazó la cuenta ${specificAccount}: ${res.data?.error?.message || `HTTP ${res.status}`}`,
          });
        }
        rawAccounts = [res.data];
      } else {
        const res = await fetchJsonWithTimeout(
          `https://graph.facebook.com/${META_API_VERSION}/me/adaccounts?fields=id,account_id,name,currency,account_status&limit=25&access_token=${encodeURIComponent(token)}`,
        );
        if (!res.ok || res.data?.error) {
          return json({
            ok: false,
            error: `Meta rechazó el token: ${res.data?.error?.message || `HTTP ${res.status}`}`,
          });
        }
        rawAccounts = Array.isArray(res.data?.data) ? res.data.data : [];
      }

      if (rawAccounts.length === 0) {
        return json({
          ok: false,
          error: 'El token es válido pero no tiene acceso a ninguna cuenta publicitaria (Ad Account). Asigna la cuenta en Business Manager o indica su ID act_...',
        });
      }

      const saved = await upsertMetaAdAccounts(supabase, companyId, token, rawAccounts, 'token', null);
      return json({ ok: true, connected: saved.length, accounts: saved });
    }

    // ── ACTION: exchange_oauth (Isolated OAuth ads_read flow) ────────────────────
    if (action === 'exchange_oauth') {
      const code = String(payload?.code || '').trim();
      const redirectUri = String(payload?.redirect_uri || 'https://ariascrm.com/integrations/meta/callback')
        .replace('://www.', '://')
        .trim();
      if (!code) return json({ ok: false, error: 'Falta código OAuth de Meta.' });

      const appId = Deno.env.get('META_APP_ID') || '1463889952375598';
      const appSecret = Deno.env.get('META_APP_SECRET') || '';
      if (!appSecret) {
        return json({ ok: false, error: 'META_APP_SECRET no configurado en el servidor.' });
      }

      const tokenRes = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: appId,
            client_secret: appSecret,
            redirect_uri: redirectUri,
            code,
          }).toString(),
        },
      );
      const tokenData = await tokenRes.json().catch(() => ({}));
      if (tokenData?.error || !tokenData?.access_token) {
        return json({
          ok: false,
          error: tokenData?.error?.message || 'Meta rechazó el intercambio de token OAuth.',
        });
      }

      const llRes = await fetchJsonWithTimeout(
        `https://graph.facebook.com/${META_API_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(tokenData.access_token)}`,
      );
      const longToken = llRes.data?.access_token || tokenData.access_token;
      const expiresSec = Number(llRes.data?.expires_in) || 5_184_000;
      const expiresIso = new Date(Date.now() + expiresSec * 1000).toISOString();

      const adRes = await fetchJsonWithTimeout(
        `https://graph.facebook.com/${META_API_VERSION}/me/adaccounts?fields=id,account_id,name,currency,account_status&limit=25&access_token=${encodeURIComponent(longToken)}`,
      );
      if (!adRes.ok || adRes.data?.error) {
        return json({
          ok: false,
          error: `No se pudieron listar cuentas publicitarias: ${adRes.data?.error?.message || `HTTP ${adRes.status}`}`,
        });
      }

      const rawAccounts = Array.isArray(adRes.data?.data) ? adRes.data.data : [];
      if (rawAccounts.length === 0) {
        return json({
          ok: false,
          error: 'Tu usuario Meta no tiene cuentas publicitarias asignadas con permiso ads_read.',
        });
      }

      const saved = await upsertMetaAdAccounts(supabase, companyId, longToken, rawAccounts, 'oauth', expiresIso);
      return json({ ok: true, connected: saved.length, accounts: saved });
    }

    // ── ACTION: disconnect ───────────────────────────────────────────────────────
    if (action === 'disconnect') {
      const accountRowId = String(payload?.account_row_id || '').trim();
      if (!accountRowId) return json({ ok: false, error: 'account_row_id es requerido' });
      await supabase
        .from('social_accounts')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', accountRowId)
        .eq('company_id', companyId)
        .eq('platform', 'meta_ads');
      return json({ ok: true });
    }

    // ── ACTION: get_insights (Default) ───────────────────────────────────────────
    const fallbackRange = computeDateRangePreset('mtd');
    const since = /^\d{4}-\d{2}-\d{2}$/.test(String(payload?.since || ''))
      ? String(payload.since)
      : fallbackRange.since;
    const until = /^\d{4}-\d{2}-\d{2}$/.test(String(payload?.until || ''))
      ? String(payload.until)
      : fallbackRange.until;

    const sinceTs = `${since}T00:00:00-06:00`;
    const untilTs = `${until}T23:59:59.999-06:00`;

    const [{ data: crmLeads }, { data: aiLogs }, { data: adAccounts }, { data: wonLeads }] = await Promise.all([
      supabase
        .from('leads')
        .select('id, source, status, value, created_at, raw_meta_payload')
        .eq('company_id', companyId)
        .gte('created_at', sinceTs)
        .lte('created_at', untilTs)
        .limit(5000),
      supabase
        .from('ai_usage_logs')
        .select('estimated_cost_usd, feature, total_tokens')
        .eq('company_id', companyId)
        .gte('created_at', sinceTs)
        .lte('created_at', untilTs)
        .limit(5000),
      supabase
        .from('social_accounts')
        .select('id, account_id, account_name, display_name, access_token, is_default, metadata, token_expires_at')
        .eq('company_id', companyId)
        .eq('platform', 'meta_ads')
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true }),
      supabase
        .from('leads')
        .select('id, name, company_name, source, status, value, closing_amount, internal_won_date, created_at, raw_meta_payload')
        .eq('company_id', companyId)
        .in('status', ['Cerrado', 'Cliente'])
        .gte('internal_won_date', sinceTs)
        .lte('internal_won_date', untilTs)
        .order('internal_won_date', { ascending: false })
        .limit(2000),
    ]);

    const crmLeadsByDay = new Map<string, number>();
    let totalCrmLeads = 0;
    let metaSheetLeads = 0;

    for (const l of crmLeads || []) {
      totalCrmLeads++;
      if (isMetaOrSheetsLead(l)) metaSheetLeads++;
      const dayKey = toSvYmd(l.created_at);
      if (dayKey) crmLeadsByDay.set(dayKey, (crmLeadsByDay.get(dayKey) || 0) + 1);
    }

    const wonAmountByDay = new Map<string, number>();
    const wonDealsByDay = new Map<string, number>();
    let wonDeals = 0;
    let wonClosedCount = 0;
    let wonClientCount = 0;
    let wonAmount = 0;
    let wonPotential = 0;
    let wonMetaDeals = 0;
    let wonMetaAmount = 0;
    const wonItems: any[] = [];

    for (const l of wonLeads || []) {
      const dealAmount = resolveWonDealAmount(l);
      const dealPotential = Number(l.value) || 0;
      const isMetaSource = isMetaOrSheetsLead(l);
      wonDeals++;
      if (l.status === 'Cerrado') wonClosedCount++;
      if (l.status === 'Cliente') wonClientCount++;
      wonAmount += dealAmount;
      wonPotential += dealPotential;
      if (isMetaSource) {
        wonMetaDeals++;
        wonMetaAmount += dealAmount;
      }

      const wonDateKey = toSvYmd(l.internal_won_date || l.created_at);
      if (wonDateKey) {
        wonAmountByDay.set(wonDateKey, Number(((wonAmountByDay.get(wonDateKey) || 0) + dealAmount).toFixed(2)));
        wonDealsByDay.set(wonDateKey, (wonDealsByDay.get(wonDateKey) || 0) + 1);
      }

      if (wonItems.length < 50) {
        wonItems.push({
          id: l.id,
          name: l.name || 'Lead sin nombre',
          company_name: l.company_name || null,
          status: l.status,
          source: l.source || 'Otros',
          is_meta_source: isMetaSource,
          amount: Number(dealAmount.toFixed(2)),
          value: Number(dealPotential.toFixed(2)),
          won_date: wonDateKey,
        });
      }
    }

    const aiCostUsd = Number(
      (aiLogs || []).reduce((acc: number, row: any) => acc + (Number(row?.estimated_cost_usd) || 0), 0).toFixed(4),
    );
    const crmStats = {
      total_leads: totalCrmLeads,
      meta_sheet_leads: metaSheetLeads,
      won_deals: wonDeals,
      won_closed_count: wonClosedCount,
      won_client_count: wonClientCount,
      won_amount: Number(wonAmount.toFixed(2)),
      won_potential: Number(wonPotential.toFixed(2)),
      won_meta_deals: wonMetaDeals,
      won_meta_amount: Number(wonMetaAmount.toFixed(2)),
      won_items: wonItems,
      ai_cost_usd: aiCostUsd,
      ai_calls: (aiLogs || []).length,
    };

    const safeAccounts = (adAccounts || []).map((a: any) => ({
      id: a.id,
      account_id: a.account_id,
      account_name: a.display_name || a.account_name || a.account_id,
      is_default: Boolean(a.is_default),
      currency: a.metadata?.currency || 'USD',
      connection_mode: a.metadata?.connection_mode || 'token',
    }));

    if (!adAccounts || adAccounts.length === 0) {
      const crmOnlyDateSet = new Set<string>([...crmLeadsByDay.keys(), ...wonAmountByDay.keys()]);
      const crmOnlyDaily = [...crmOnlyDateSet]
        .map((date) => ({
          date,
          spend: 0,
          impressions: 0,
          reach: 0,
          clicks: 0,
          link_clicks: 0,
          meta_leads: 0,
          crm_leads: crmLeadsByDay.get(date) || 0,
          cpl: 0,
          won_amount: wonAmountByDay.get(date) || 0,
          won_deals: wonDealsByDay.get(date) || 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const roi = computeRoiMetrics({
        adSpend: 0,
        aiCost: aiCostUsd,
        wonRevenue: crmStats.won_amount,
        wonDeals: crmStats.won_deals,
        metaWonRevenue: crmStats.won_meta_amount,
        metaWonDeals: crmStats.won_meta_deals,
      });

      return json({
        ok: true,
        connected: false,
        since,
        until,
        active_account: null,
        ad_accounts: [],
        summary: {
          spend: 0,
          impressions: 0,
          reach: 0,
          clicks: 0,
          link_clicks: 0,
          meta_leads: 0,
          ctr: 0,
          cpc: 0,
          cpm: 0,
          cpl: 0,
        },
        daily: crmOnlyDaily,
        campaigns: [],
        crm: crmStats,
        roi,
      });
    }

    const requestedAccId = normalizeAdAccountId(payload?.ad_account_id);
    const activeAcc =
      (requestedAccId && adAccounts.find((a: any) => a.account_id === requestedAccId)) ||
      adAccounts[0];

    const timeRangeParam = encodeURIComponent(JSON.stringify({ since, until }));
    const tokenParam = encodeURIComponent(activeAcc.access_token || '');

    const dailyUrl =
      `https://graph.facebook.com/${META_API_VERSION}/${activeAcc.account_id}/insights` +
      `?fields=date_start,date_stop,spend,impressions,reach,clicks,inline_link_clicks,ctr,cpc,cpm,actions` +
      `&time_range=${timeRangeParam}&time_increment=1&limit=120&access_token=${tokenParam}`;

    const campUrl =
      `https://graph.facebook.com/${META_API_VERSION}/${activeAcc.account_id}/insights` +
      `?level=campaign&fields=campaign_id,campaign_name,spend,impressions,reach,clicks,inline_link_clicks,ctr,cpc,actions` +
      `&time_range=${timeRangeParam}&limit=60&access_token=${tokenParam}`;

    const [dailyRes, campRes] = await Promise.all([
      fetchJsonWithTimeout(dailyUrl),
      fetchJsonWithTimeout(campUrl),
    ]);

    let metaError: string | null = null;
    if (!dailyRes.ok || dailyRes.data?.error) {
      metaError = dailyRes.data?.error?.message || `Meta API HTTP ${dailyRes.status}`;
    } else if (!campRes.ok || campRes.data?.error) {
      metaError = campRes.data?.error?.message || `Meta API HTTP ${campRes.status}`;
    }

    const agg = aggregateMetaInsights(
      Array.isArray(dailyRes.data?.data) ? dailyRes.data.data : [],
      Array.isArray(campRes.data?.data) ? campRes.data.data : [],
    );

    // Merge CRM leads and won deals per day into daily series
    const mergedByDate = new Map(agg.daily.map((d) => [d.date, { ...d }]));
    const ensureDay = (date: string) => {
      const existing = mergedByDate.get(date) || {
        date,
        spend: 0,
        impressions: 0,
        reach: 0,
        clicks: 0,
        link_clicks: 0,
        meta_leads: 0,
        crm_leads: 0,
        cpl: 0,
        won_amount: 0,
        won_deals: 0,
      };
      mergedByDate.set(date, existing);
      return existing;
    };
    for (const [date, count] of crmLeadsByDay.entries()) {
      ensureDay(date).crm_leads = count;
    }
    for (const [date, amt] of wonAmountByDay.entries()) {
      ensureDay(date).won_amount = amt;
    }
    for (const [date, cnt] of wonDealsByDay.entries()) {
      ensureDay(date).won_deals = cnt;
    }
    const mergedDaily = [...mergedByDate.values()].sort((a, b) => a.date.localeCompare(b.date));

    const roi = computeRoiMetrics({
      adSpend: agg.summary.spend,
      aiCost: aiCostUsd,
      wonRevenue: crmStats.won_amount,
      wonDeals: crmStats.won_deals,
      metaWonRevenue: crmStats.won_meta_amount,
      metaWonDeals: crmStats.won_meta_deals,
    });

    return json({
      ok: true,
      connected: true,
      since,
      until,
      active_account: {
        id: activeAcc.id,
        account_id: activeAcc.account_id,
        account_name: activeAcc.display_name || activeAcc.account_name || activeAcc.account_id,
        currency: activeAcc.metadata?.currency || 'USD',
        connection_mode: activeAcc.metadata?.connection_mode || 'token',
      },
      ad_accounts: safeAccounts,
      summary: agg.summary,
      daily: mergedDaily,
      campaigns: agg.campaigns,
      crm: crmStats,
      roi,
      ...(metaError ? { meta_error: metaError } : {}),
    });
  } catch (err: any) {
    console.error('[meta-ads-insights] Error:', err?.message || err);
    return json({ ok: false, error: err?.message || 'Error interno en meta-ads-insights' }, 500);
  }
});
