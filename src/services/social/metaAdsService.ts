import { supabase } from '../supabase';

export type MetaAdsDatePreset = 'mtd' | 'today' | '7d' | '30d' | 'last_month' | 'custom';

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
    won_amount: number;
    won_deals: number;
}

export type LeadOriginBucket = 'meta_ads' | 'social' | 'other';
export type WonDealCohort = 'same_period' | 'previous_period';

export interface MetaAdsWonDealItem {
    id: string;
    name: string;
    company_name: string | null;
    advisor_name?: string | null;
    status: string;
    source: string;
    source_label?: string;
    origin_bucket?: LeadOriginBucket;
    is_meta_source: boolean;
    is_meta_ads?: boolean;
    campaign_label?: string | null;
    amount: number;
    value: number;
    created_date?: string;
    won_date: string;
    cohort?: WonDealCohort;
    days_to_close?: number;
}

export interface MetaAdsCohortSummary {
    same_period_deals: number;
    same_period_amount: number;
    previous_period_deals: number;
    previous_period_amount: number;
    meta_ads_deals: number;
    meta_ads_amount: number;
    social_deals: number;
    social_amount: number;
    other_deals: number;
    other_amount: number;
}

export interface MetaAdsRoiSummary {
    ad_spend: number;
    ai_cost: number;
    total_investment: number;
    won_revenue: number;
    won_deals: number;
    meta_won_revenue: number;
    meta_won_deals: number;
    net_profit: number;
    roi_pct: number | null;
    roas: number | null;
    cac: number | null;
    meta_net_profit: number;
    meta_roi_pct: number | null;
    meta_roas: number | null;
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

export interface MetaAdsAccountSummary {
    id: string;
    account_id: string;
    account_name: string;
    is_default?: boolean;
    currency: string;
    connection_mode: string;
}

export interface MetaAdsInsightsResponse {
    ok: boolean;
    connected: boolean;
    since: string;
    until: string;
    active_account: MetaAdsAccountSummary | null;
    ad_accounts: MetaAdsAccountSummary[];
    summary: {
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
    };
    daily: MetaAdsDailyPoint[];
    campaigns: MetaAdsCampaignPoint[];
    crm: {
        total_leads: number;
        meta_sheet_leads: number;
        won_deals: number;
        won_closed_count?: number;
        won_client_count?: number;
        won_amount: number;
        won_potential?: number;
        won_meta_deals?: number;
        won_meta_amount?: number;
        cohort_summary?: MetaAdsCohortSummary;
        won_items?: MetaAdsWonDealItem[];
        ai_cost_usd: number;
        ai_calls: number;
    };
    roi?: MetaAdsRoiSummary;
    meta_error?: string | null;
    error?: string;
}

function toSvYmd(date: Date): string {
    try {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/El_Salvador',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(date);
    } catch {
        return date.toISOString().slice(0, 10);
    }
}

export function getMetaAdsPresetRange(preset: Exclude<MetaAdsDatePreset, 'custom'>): {
    since: string;
    until: string;
} {
    const today = toSvYmd(new Date());
    const [y, m, d] = today.split('-').map(Number);

    if (preset === 'today') return { since: today, until: today };
    if (preset === 'mtd') {
        return { since: `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`, until: today };
    }
    if (preset === 'last_month') {
        const firstPrev = new Date(Date.UTC(y, m - 2, 1, 12, 0, 0));
        const lastPrev = new Date(Date.UTC(y, m - 1, 0, 12, 0, 0));
        return { since: toSvYmd(firstPrev), until: toSvYmd(lastPrev) };
    }
    const back = preset === '7d' ? 6 : 29;
    const ref = new Date(Date.UTC(y, m - 1, d - back, 12, 0, 0));
    return { since: toSvYmd(ref), until: today };
}

export const metaAdsService = {
    async invoke<T = any>(body: Record<string, any>): Promise<T> {
        const { data, error } = await supabase.functions.invoke('meta-ads-insights', { body });
        if (error) throw new Error(error.message || 'Error al consultar Meta Ads');
        if (data && data.ok === false) {
            throw new Error(data.error || 'Error en Meta Ads');
        }
        return data as T;
    },

    async connectWithToken(companyId: string, accessToken: string, adAccountId?: string) {
        return this.invoke<{ ok: boolean; connected: number; accounts: any[] }>({
            action: 'connect_token',
            company_id: companyId,
            access_token: accessToken,
            ad_account_id: adAccountId || '',
        });
    },

    async exchangeOAuth(companyId: string, code: string, redirectUri: string) {
        return this.invoke<{ ok: boolean; connected: number; accounts: any[] }>({
            action: 'exchange_oauth',
            company_id: companyId,
            code,
            redirect_uri: redirectUri,
        });
    },

    async getInsights(
        companyId: string,
        params: { since: string; until: string; ad_account_id?: string | null },
    ): Promise<MetaAdsInsightsResponse> {
        return this.invoke<MetaAdsInsightsResponse>({
            action: 'get_insights',
            company_id: companyId,
            since: params.since,
            until: params.until,
            ...(params.ad_account_id ? { ad_account_id: params.ad_account_id } : {}),
        });
    },

    async disconnect(companyId: string, accountRowId: string) {
        return this.invoke<{ ok: boolean }>({
            action: 'disconnect',
            company_id: companyId,
            account_row_id: accountRowId,
        });
    },
};
