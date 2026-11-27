export type MetaAdsPreset = 'mtd' | 'today' | '7d' | '30d' | 'last_month';

export interface MetaActionEntry {
  action_type?: string | null;
  value?: string | number | null;
}

export interface MetaInsightRowLike {
  date_start?: string | null;
  date_stop?: string | null;
  campaign_id?: string | null;
  campaign_name?: string | null;
  spend?: string | number | null;
  impressions?: string | number | null;
  reach?: string | number | null;
  clicks?: string | number | null;
  inline_link_clicks?: string | number | null;
  ctr?: string | number | null;
  cpc?: string | number | null;
  cpm?: string | number | null;
  actions?: MetaActionEntry[] | null;
}

export interface MetaAdsDailyPoint {
  date: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  link_clicks: number;
  meta_leads: number;
  crm_leads: number;
  cpl: number;
}

export interface MetaAdsCampaignPoint {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  link_clicks: number;
  ctr: number;
  cpc: number;
  meta_leads: number;
  cpl: number;
}

export interface MetaAdsSummary {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  link_clicks: number;
  meta_leads: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpl: number;
}

const DEFAULT_TZ = 'America/El_Salvador';

export function normalizeAdAccountId(raw?: string | null): string {
  const cleaned = String(raw || '').trim();
  if (!cleaned) return '';
  if (/^act_\d+$/i.test(cleaned)) {
    return `act_${cleaned.replace(/^act_/i, '')}`;
  }
  const digits = cleaned.replace(/\D+/g, '');
  return digits ? `act_${digits}` : '';
}

const LEAD_ACTION_PRIORITY = [
  'onsite_conversion.lead_grouped',
  'lead',
  'leadgen_grouped',
  'offsite_conversion.fb_pixel_lead',
];

export function extractMetaLeadCount(actions?: MetaActionEntry[] | null): number {
  if (!Array.isArray(actions) || actions.length === 0) return 0;
  for (const preferredType of LEAD_ACTION_PRIORITY) {
    let matchedSum = 0;
    let found = false;
    for (const act of actions) {
      if (String(act?.action_type || '').trim() === preferredType) {
        const val = Number(act?.value);
        if (Number.isFinite(val) && val > 0) {
          matchedSum += val;
          found = true;
        }
      }
    }
    if (found && matchedSum > 0) {
      return Math.round(matchedSum);
    }
  }
  return 0;
}

export function extractMetaLinkClicks(row: MetaInsightRowLike | null | undefined): number {
  if (!row || typeof row !== 'object') return 0;
  const inline = Number(row.inline_link_clicks);
  if (Number.isFinite(inline) && inline > 0) return Math.round(inline);

  if (Array.isArray(row.actions)) {
    const lc = row.actions.find((a) => String(a?.action_type || '').trim() === 'link_click');
    const val = Number(lc?.value);
    if (Number.isFinite(val) && val > 0) return Math.round(val);
  }

  const totalClicks = Number(row.clicks);
  return Number.isFinite(totalClicks) && totalClicks > 0 ? Math.round(totalClicks) : 0;
}

export function aggregateMetaInsights(
  dailyRows: MetaInsightRowLike[],
  campaignRows: MetaInsightRowLike[],
): {
  summary: MetaAdsSummary;
  daily: MetaAdsDailyPoint[];
  campaigns: MetaAdsCampaignPoint[];
} {
  const dailyMap = new Map<string, MetaAdsDailyPoint>();

  for (const r of dailyRows || []) {
    const date = String(r?.date_start || '').slice(0, 10);
    if (!date) continue;
    const spend = Number(r?.spend) || 0;
    const impressions = Math.round(Number(r?.impressions) || 0);
    const reach = Math.round(Number(r?.reach) || 0);
    const clicks = Math.round(Number(r?.clicks) || 0);
    const linkClicks = extractMetaLinkClicks(r);
    const metaLeads = extractMetaLeadCount(r?.actions);

    const prev = dailyMap.get(date) || {
      date,
      spend: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      link_clicks: 0,
      meta_leads: 0,
      crm_leads: 0,
      cpl: 0,
    };
    prev.spend = Number((prev.spend + spend).toFixed(2));
    prev.impressions += impressions;
    prev.reach += reach;
    prev.clicks += clicks;
    prev.link_clicks += linkClicks;
    prev.meta_leads += metaLeads;
    prev.cpl = prev.meta_leads > 0 ? Number((prev.spend / prev.meta_leads).toFixed(2)) : 0;
    dailyMap.set(date, prev);
  }

  const daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  const campaigns: MetaAdsCampaignPoint[] = (campaignRows || [])
    .map((r) => {
      const spend = Number((Number(r?.spend) || 0).toFixed(2));
      const impressions = Math.round(Number(r?.impressions) || 0);
      const reach = Math.round(Number(r?.reach) || 0);
      const clicks = Math.round(Number(r?.clicks) || 0);
      const linkClicks = extractMetaLinkClicks(r);
      const metaLeads = extractMetaLeadCount(r?.actions);
      return {
        campaign_id: String(r?.campaign_id || r?.campaign_name || 'unknown'),
        campaign_name: String(r?.campaign_name || 'Campaña sin nombre'),
        spend,
        impressions,
        reach,
        clicks,
        link_clicks: linkClicks,
        ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
        cpc: clicks > 0 ? Number((spend / clicks).toFixed(2)) : 0,
        meta_leads: metaLeads,
        cpl: metaLeads > 0 ? Number((spend / metaLeads).toFixed(2)) : 0,
      };
    })
    .sort((a, b) => b.spend - a.spend);

  const sourceForTotals = daily.length > 0 ? daily : campaigns;
  const totalSpend = Number(
    sourceForTotals.reduce((acc, row) => acc + (Number(row.spend) || 0), 0).toFixed(2),
  );
  const totalImpressions = sourceForTotals.reduce((acc, row) => acc + (Number(row.impressions) || 0), 0);
  const totalReach = sourceForTotals.reduce((acc, row) => acc + (Number(row.reach) || 0), 0);
  const totalClicks = sourceForTotals.reduce((acc, row) => acc + (Number(row.clicks) || 0), 0);
  const totalLinkClicks = sourceForTotals.reduce((acc, row) => acc + (Number(row.link_clicks) || 0), 0);
  const totalMetaLeads = sourceForTotals.reduce((acc, row) => acc + (Number(row.meta_leads) || 0), 0);

  return {
    summary: {
      spend: totalSpend,
      impressions: totalImpressions,
      reach: totalReach,
      clicks: totalClicks,
      link_clicks: totalLinkClicks,
      meta_leads: totalMetaLeads,
      ctr: totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0,
      cpc: totalClicks > 0 ? Number((totalSpend / totalClicks).toFixed(2)) : 0,
      cpm: totalImpressions > 0 ? Number(((totalSpend / totalImpressions) * 1000).toFixed(2)) : 0,
      cpl: totalMetaLeads > 0 ? Number((totalSpend / totalMetaLeads).toFixed(2)) : 0,
    },
    daily,
    campaigns,
  };
}

function toZonedYmd(date: Date, timeZone = DEFAULT_TZ): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function computeDateRangePreset(
  preset: MetaAdsPreset,
  now = new Date(),
  timeZone = DEFAULT_TZ,
): { since: string; until: string } {
  const todayYmd = toZonedYmd(now, timeZone);
  const [y, m, d] = todayYmd.split('-').map(Number);

  if (preset === 'today') {
    return { since: todayYmd, until: todayYmd };
  }
  if (preset === 'mtd') {
    return { since: `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`, until: todayYmd };
  }
  if (preset === 'last_month') {
    const firstPrev = new Date(Date.UTC(y, m - 2, 1, 12, 0, 0));
    const lastPrev = new Date(Date.UTC(y, m - 1, 0, 12, 0, 0));
    return { since: toZonedYmd(firstPrev, timeZone), until: toZonedYmd(lastPrev, timeZone) };
  }

  const daysBack = preset === '7d' ? 6 : 29;
  const startRef = new Date(Date.UTC(y, m - 1, d - daysBack, 12, 0, 0));
  return { since: toZonedYmd(startRef, timeZone), until: todayYmd };
}
