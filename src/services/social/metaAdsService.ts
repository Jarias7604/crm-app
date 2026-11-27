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
        won_amount: number;
        ai_cost_usd: number;
        ai_calls: number;
    };
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
