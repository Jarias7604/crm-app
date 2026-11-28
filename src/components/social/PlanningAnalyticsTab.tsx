import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    AlertCircle,
    ArrowUpRight,
    Calendar,
    Check,
    ChevronDown,
    ChevronRight,
    ExternalLink,
    Loader2,
    Plus,
    RefreshCw,
} from 'lucide-react';
import {
    Area,
    AreaChart,
    Bar,
    CartesianGrid,
    ComposedChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import toast from 'react-hot-toast';
import {
    getMetaAdsPresetRange,
    metaAdsService,
    type MetaAdsDatePreset,
    type MetaAdsInsightsResponse,
    type MetaAdsWonDealItem,
} from '../../services/social/metaAdsService';
import type { SocialAccount } from '../../services/social/socialPublishService';
import { matchBrandSocialAccounts } from '../../lib/socialBrandMatcher';
import { MetaAdsIcon, renderPlatformIcon } from './SocialBrandKit';

interface PlanningAnalyticsTabProps {
    companyId: string;
    metaAdsAccounts: SocialAccount[];
    allSocialAccounts?: SocialAccount[];
    onOpenConnect: () => void;
}

type AnalyticsSubTab = 'overview' | 'campaigns' | 'sales';
type SourceScope = 'all' | 'meta_social' | 'meta_ads' | 'other';
type CohortScope = 'all' | 'same_period' | 'previous_period';

const PRESET_OPTIONS: Array<{ id: MetaAdsDatePreset; label: string }> = [
    { id: 'mtd', label: 'Este mes' },
    { id: 'today', label: 'Hoy' },
    { id: '7d', label: '7d' },
    { id: '30d', label: '30d' },
    { id: 'last_month', label: 'Mes ant.' },
    { id: 'custom', label: 'Fechas' },
];

function fmtUsd(n: number, decimals = 2): string {
    const val = Number(n) || 0;
    if (val > 0 && val < 0.01) return `$${val.toFixed(4)}`;
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function matchesSourceScope(item: MetaAdsWonDealItem, scope: SourceScope): boolean {
    if (scope === 'all') return true;
    const isMetaAds = item.origin_bucket ? item.origin_bucket === 'meta_ads' : Boolean(item.is_meta_ads);
    const isMetaOrSocial = item.origin_bucket
        ? item.origin_bucket === 'meta_ads' || item.origin_bucket === 'social'
        : Boolean(item.is_meta_source);

    if (scope === 'meta_ads') return isMetaAds;
    if (scope === 'meta_social') return isMetaOrSocial;
    return !isMetaOrSocial;
}

function matchesCohortScope(item: MetaAdsWonDealItem, scope: CohortScope, since: string): boolean {
    if (scope === 'all') return true;
    const itemCohort =
        item.cohort ||
        (item.created_date && since && item.created_date >= since ? 'same_period' : 'previous_period');
    return itemCohort === scope;
}

function OriginBadge({ item }: { item: MetaAdsWonDealItem }) {
    const bucket = item.origin_bucket || (item.is_meta_ads ? 'meta_ads' : item.is_meta_source ? 'social' : 'other');
    const label = item.source_label || item.source || 'Otros';

    if (bucket === 'meta_ads') {
        return (
            <div className="space-y-0.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-50 text-[#0081FB]">
                    Meta Ads · {label}
                </span>
                {item.campaign_label && (
                    <div className="text-[11px] text-slate-400 truncate max-w-[190px]" title={item.campaign_label}>
                        {item.campaign_label}
                    </div>
                )}
            </div>
        );
    }

    if (bucket === 'social') {
        return (
            <div className="space-y-0.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-violet-50 text-violet-700">
                    {label}
                </span>
                {item.campaign_label && (
                    <div className="text-[11px] text-slate-400 truncate max-w-[190px]" title={item.campaign_label}>
                        {item.campaign_label}
                    </div>
                )}
            </div>
        );
    }

    return <span className="text-xs text-slate-600 font-medium">{label}</span>;
}

export function PlanningAnalyticsTab({
    companyId,
    metaAdsAccounts,
    allSocialAccounts,
    onOpenConnect,
}: PlanningAnalyticsTabProps) {
    const navigate = useNavigate();
    const initialRange = getMetaAdsPresetRange('mtd');

    const [subTab, setSubTab] = useState<AnalyticsSubTab>('overview');
    const [preset, setPreset] = useState<MetaAdsDatePreset>('mtd');
    const [since, setSince] = useState(initialRange.since);
    const [until, setUntil] = useState(initialRange.until);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [accountMenuOpen, setAccountMenuOpen] = useState(false);
    const [sourceScope, setSourceScope] = useState<SourceScope>('all');
    const [cohortScope, setCohortScope] = useState<CohortScope>('all');
    const [chartMode, setChartMode] = useState<'roi' | 'leads'>('roi');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<MetaAdsInsightsResponse | null>(null);

    useEffect(() => {
        if (!accountMenuOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setAccountMenuOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [accountMenuOpen]);

    const handleSelectPreset = (next: MetaAdsDatePreset) => {
        setPreset(next);
        if (next !== 'custom') {
            const range = getMetaAdsPresetRange(next);
            setSince(range.since);
            setUntil(range.until);
        }
    };

    const loadInsights = useCallback(async () => {
        if (!companyId || !since || !until) return;
        setLoading(true);
        try {
            const res = await metaAdsService.getInsights(companyId, {
                since,
                until,
                ad_account_id: selectedAccountId || undefined,
            });
            setData(res);
            if (!selectedAccountId && res.active_account?.account_id) {
                setSelectedAccountId(res.active_account.account_id);
            }
        } catch (err: any) {
            toast.error(err?.message || 'Error al cargar Estadísticas & Ads');
        } finally {
            setLoading(false);
        }
    }, [companyId, since, until, selectedAccountId]);

    useEffect(() => {
        loadInsights();
    }, [loadInsights]);

    const summary = data?.summary || {
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
    };

    const crm = data?.crm || {
        total_leads: 0,
        meta_sheet_leads: 0,
        won_deals: 0,
        won_closed_count: 0,
        won_client_count: 0,
        won_amount: 0,
        won_potential: 0,
        won_meta_deals: 0,
        won_meta_amount: 0,
        won_items: [],
        ai_cost_usd: 0,
        ai_calls: 0,
    };

    const rawDaily = data?.daily || [];
    const campaigns = data?.campaigns || [];
    const connected = Boolean(data?.connected || metaAdsAccounts.length > 0);
    const allWonItems = crm.won_items || [];

    const publishableAccounts = useMemo(
        () => (allSocialAccounts || []).filter((a) => a.platform !== 'meta_ads'),
        [allSocialAccounts],
    );

    const adAccountOptions = useMemo(() => {
        if (data?.ad_accounts?.length) return data.ad_accounts;
        return metaAdsAccounts.map((a) => ({
            id: a.id,
            account_id: a.account_id || a.id,
            account_name: a.display_name || a.account_name || 'Cuenta Meta Ads',
            is_default: a.is_default,
            currency: String(a.metadata?.currency || 'USD'),
            connection_mode: String(a.metadata?.connection_mode || 'oauth'),
        }));
    }, [data?.ad_accounts, metaAdsAccounts]);

    const activeAdAccount = useMemo(
        () =>
            adAccountOptions.find((a) => a.account_id === selectedAccountId) ||
            data?.active_account ||
            adAccountOptions[0] ||
            null,
        [adAccountOptions, selectedAccountId, data?.active_account],
    );

    const activeBrandName = activeAdAccount?.account_name || (connected ? 'Arias Group' : 'Conectar Meta Ads');
    const activeBrandMatch = useMemo(
        () => matchBrandSocialAccounts(activeBrandName, publishableAccounts),
        [activeBrandName, publishableAccounts],
    );

    const cohortSummary = useMemo(() => {
        if (crm.cohort_summary) return crm.cohort_summary;
        let sameDeals = 0;
        let sameAmt = 0;
        let prevDeals = 0;
        let prevAmt = 0;
        let metaAdsDeals = 0;
        let metaAdsAmt = 0;
        let socialDeals = 0;
        let socialAmt = 0;
        let otherDeals = 0;
        let otherAmt = 0;
        for (const item of allWonItems) {
            const isSame = item.cohort
                ? item.cohort === 'same_period'
                : Boolean(item.created_date && item.created_date >= since);
            if (isSame) {
                sameDeals++;
                sameAmt += item.amount || 0;
            } else {
                prevDeals++;
                prevAmt += item.amount || 0;
            }
            const bucket = item.origin_bucket || (item.is_meta_ads ? 'meta_ads' : item.is_meta_source ? 'social' : 'other');
            if (bucket === 'meta_ads') {
                metaAdsDeals++;
                metaAdsAmt += item.amount || 0;
            } else if (bucket === 'social') {
                socialDeals++;
                socialAmt += item.amount || 0;
            } else {
                otherDeals++;
                otherAmt += item.amount || 0;
            }
        }
        return {
            same_period_deals: sameDeals,
            same_period_amount: Number(sameAmt.toFixed(2)),
            previous_period_deals: prevDeals,
            previous_period_amount: Number(prevAmt.toFixed(2)),
            meta_ads_deals: metaAdsDeals,
            meta_ads_amount: Number(metaAdsAmt.toFixed(2)),
            social_deals: socialDeals,
            social_amount: Number(socialAmt.toFixed(2)),
            other_deals: otherDeals,
            other_amount: Number(otherAmt.toFixed(2)),
        };
    }, [crm.cohort_summary, allWonItems, since]);

    const filteredWonItems = useMemo(
        () =>
            allWonItems.filter(
                (item) => matchesSourceScope(item, sourceScope) && matchesCohortScope(item, cohortScope, since),
            ),
        [allWonItems, sourceScope, cohortScope, since],
    );

    const isFiltered = sourceScope !== 'all' || cohortScope !== 'all';
    const totalInvestment = Number((summary.spend + crm.ai_cost_usd).toFixed(2));

    const roiMetrics = useMemo(() => {
        if (!isFiltered && data?.roi) {
            return {
                revenue: data.roi.won_revenue,
                deals: data.roi.won_deals,
                closedCount: crm.won_closed_count ?? 0,
                clientCount: crm.won_client_count ?? 0,
                netProfit: data.roi.net_profit,
                roiPct: data.roi.roi_pct,
                roas: data.roi.roas,
                cac: data.roi.cac,
            };
        }
        const revenue = Number(filteredWonItems.reduce((acc, i) => acc + (Number(i.amount) || 0), 0).toFixed(2));
        const deals = filteredWonItems.length;
        const closedCount = filteredWonItems.filter((i) => i.status === 'Cerrado').length;
        const clientCount = filteredWonItems.filter((i) => i.status === 'Cliente').length;
        const netProfit = Number((revenue - totalInvestment).toFixed(2));
        const roiPct =
            totalInvestment > 0 ? Number((((revenue - totalInvestment) / totalInvestment) * 100).toFixed(1)) : null;
        const roas = summary.spend > 0 ? Number((revenue / summary.spend).toFixed(2)) : null;
        const cac = deals > 0 ? Number((totalInvestment / deals).toFixed(2)) : null;
        return { revenue, deals, closedCount, clientCount, netProfit, roiPct, roas, cac };
    }, [isFiltered, data?.roi, crm.won_closed_count, crm.won_client_count, filteredWonItems, totalInvestment, summary.spend]);

    // Sync daily chart bars with active source & cohort filter
    const dailyChartData = useMemo(() => {
        if (!isFiltered) return rawDaily;
        const wonByDay = new Map<string, { amount: number; count: number }>();
        for (const item of filteredWonItems) {
            const key = item.won_date;
            if (!key) continue;
            const prev = wonByDay.get(key) || { amount: 0, count: 0 };
            prev.amount = Number((prev.amount + (Number(item.amount) || 0)).toFixed(2));
            prev.count += 1;
            wonByDay.set(key, prev);
        }
        return rawDaily.map((pt) => {
            const match = wonByDay.get(pt.date);
            return {
                ...pt,
                won_amount: match ? match.amount : 0,
                won_deals: match ? match.count : 0,
            };
        });
    }, [isFiltered, rawDaily, filteredWonItems]);

    const funnelRows = [
        { label: 'Impresiones Meta', value: summary.impressions, color: 'bg-sky-500', pct: 100 },
        {
            label: 'Clics en Anuncios',
            value: summary.clicks,
            color: 'bg-indigo-500',
            pct: summary.impressions > 0 ? Math.min(100, Math.max(4, (summary.clicks / summary.impressions) * 100 * 12)) : 0,
        },
        {
            label: 'Formularios Llenados (Meta)',
            value: summary.meta_leads,
            color: 'bg-violet-500',
            pct: summary.clicks > 0 ? Math.min(100, Math.max(6, (summary.meta_leads / summary.clicks) * 100)) : 0,
        },
        {
            label: 'Leads Ingresados al CRM',
            value: crm.meta_sheet_leads || crm.total_leads,
            color: 'bg-emerald-500',
            pct: crm.total_leads > 0 ? Math.min(100, Math.max(12, ((crm.meta_sheet_leads || crm.total_leads) / Math.max(summary.meta_leads || crm.total_leads, 1)) * 65)) : 0,
        },
        {
            label: 'Ventas Ganadas (Cerrado / Cliente)',
            value: roiMetrics.deals,
            color: 'bg-amber-500',
            pct: crm.total_leads > 0 ? Math.min(100, Math.max(6, (roiMetrics.deals / crm.total_leads) * 100)) : 0,
        },
    ];

    const openLeadInCrm = (leadId: string) => {
        navigate('/leads', { state: { leadId } });
    };

    const overviewSourcePills: Array<{ id: SourceScope; label: string; count: number }> = [
        { id: 'all', label: 'Todas las ventas CRM', count: crm.won_deals },
        { id: 'meta_social', label: 'Meta y Redes Sociales', count: cohortSummary.meta_ads_deals + cohortSummary.social_deals },
        { id: 'meta_ads', label: 'Solo Meta Ads', count: cohortSummary.meta_ads_deals },
    ];

    const cohortPills: Array<{ id: CohortScope; label: string; count: number }> = [
        { id: 'all', label: 'Todos', count: crm.won_deals },
        { id: 'same_period', label: 'Mismo período', count: cohortSummary.same_period_deals },
        { id: 'previous_period', label: 'Período anterior', count: cohortSummary.previous_period_deals },
    ];

    return (
        <div className="space-y-5">
            {/* TOP METRICOOL-STYLE SUBNAV & PERIOD BAR */}
            <div className="bg-white border border-slate-200/80 rounded-2xl px-5 pt-3 pb-2.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-6 overflow-x-auto">
                    {[
                        { id: 'overview' as AnalyticsSubTab, label: 'Resumen & ROI' },
                        { id: 'campaigns' as AnalyticsSubTab, label: `Campañas Meta (${campaigns.length})` },
                        { id: 'sales' as AnalyticsSubTab, label: `Ventas & Cohorte (${crm.won_deals})` },
                    ].map((tab) => {
                        const active = subTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setSubTab(tab.id)}
                                className={`pb-2 text-[11px] uppercase tracking-wider font-bold whitespace-nowrap border-b-2 transition cursor-pointer ${
                                    active
                                        ? 'text-slate-900 border-zinc-900'
                                        : 'text-slate-400 hover:text-slate-700 border-transparent'
                                }`}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                <div className="flex flex-wrap items-center gap-2 pb-1">
                    <div className="inline-flex items-center rounded-lg bg-slate-100/80 p-0.5">
                        {PRESET_OPTIONS.map((opt) => {
                            const active = preset === opt.id;
                            return (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => handleSelectPreset(opt.id)}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                                        active
                                            ? 'bg-white text-slate-900 shadow-2xs'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs text-slate-600">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="date"
                            value={since}
                            onChange={(e) => {
                                setPreset('custom');
                                setSince(e.target.value);
                            }}
                            className="text-[11px] font-medium text-slate-700 bg-transparent focus:outline-none"
                        />
                        <span className="text-slate-300">→</span>
                        <input
                            type="date"
                            value={until}
                            onChange={(e) => {
                                setPreset('custom');
                                setUntil(e.target.value);
                            }}
                            className="text-[11px] font-medium text-slate-700 bg-transparent focus:outline-none"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={loadInsights}
                        disabled={loading}
                        title="Actualizar datos"
                        className="p-2 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-600 shadow-2xs cursor-pointer transition"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </button>

                    {/* METRICOOL-STYLE BRAND & ACCOUNT SWITCHER DROPDOWN */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setAccountMenuOpen((v) => !v)}
                            className={`inline-flex items-center gap-2.5 pl-1.5 pr-2.5 py-1 rounded-xl border bg-white shadow-2xs transition cursor-pointer ${
                                accountMenuOpen
                                    ? 'border-slate-400 ring-2 ring-slate-900/5'
                                    : 'border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/70'
                            }`}
                            aria-expanded={accountMenuOpen}
                            title="Cambiar cuenta Meta Ads y ver páginas conectadas"
                        >
                            {activeBrandMatch.avatarUrl ? (
                                <img
                                    src={activeBrandMatch.avatarUrl}
                                    alt={activeBrandName}
                                    className="w-7 h-7 rounded-lg object-cover border border-slate-200/80 shrink-0"
                                />
                            ) : (
                                <div className="w-7 h-7 rounded-lg bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                    {activeBrandName
                                        .split(/\s+/)
                                        .filter(Boolean)
                                        .slice(0, 2)
                                        .map((w) => w[0]?.toUpperCase() || '')
                                        .join('') || 'AG'}
                                </div>
                            )}

                            <div className="text-left min-w-0">
                                <div className="text-[12px] font-bold text-slate-900 leading-tight max-w-[165px] truncate">
                                    {activeBrandName}
                                </div>
                                <div className="flex items-center gap-1 mt-0.5">
                                    {connected && <MetaAdsIcon className="w-3.5 h-3.5 shrink-0" />}
                                    {activeBrandMatch.platforms.slice(0, 3).map((platform) => (
                                        <span key={platform} className="inline-flex shrink-0">
                                            {renderPlatformIcon(platform, 'w-3.5 h-3.5')}
                                        </span>
                                    ))}
                                    <span className="text-[10px] font-medium text-slate-400 ml-0.5">
                                        {connected ? activeAdAccount?.currency || 'USD' : 'Sin conectar'}
                                    </span>
                                </div>
                            </div>

                            <ChevronDown
                                className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
                                    accountMenuOpen ? 'rotate-180 text-slate-700' : ''
                                }`}
                            />
                        </button>

                        {accountMenuOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-30"
                                    onClick={() => setAccountMenuOpen(false)}
                                />
                                <div className="absolute right-0 top-full mt-2 w-[350px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-slate-200/90 shadow-[0_20px_50px_rgba(15,23,42,0.16)] overflow-hidden z-40 animate-in fade-in slide-in-from-top-2">
                                    {/* Top Action Card — Metricool "Add brand" pattern */}
                                    <div className="p-2.5 border-b border-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAccountMenuOpen(false);
                                                onOpenConnect();
                                            }}
                                            className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-sky-50/70 hover:border-sky-200 transition text-left cursor-pointer group"
                                        >
                                            <div className="w-9 h-9 rounded-full bg-sky-50 border border-sky-200/80 text-[#0081FB] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                                <Plus className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[12.5px] font-bold text-slate-900">
                                                    Administrar o conectar cuentas
                                                </div>
                                                <div className="text-[11px] text-slate-500">
                                                    {adAccountOptions.length} cuenta(s) Ads · {publishableAccounts.length} red(es) conectadas
                                                </div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#0081FB] shrink-0" />
                                        </button>
                                    </div>

                                    {/* Meta Ads Brand Rows */}
                                    <div className="px-3.5 pt-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        Cuentas Meta Ads (Estadísticas)
                                    </div>
                                    <div className="max-h-[260px] overflow-y-auto divide-y divide-slate-100">
                                        {adAccountOptions.length === 0 ? (
                                            <div className="px-4 py-5 text-center text-xs text-slate-500">
                                                No hay cuentas Meta Ads conectadas todavía.
                                            </div>
                                        ) : (
                                            adAccountOptions.map((acc) => {
                                                const isActive = activeAdAccount?.account_id === acc.account_id;
                                                const match = matchBrandSocialAccounts(acc.account_name, publishableAccounts);
                                                const initialsText =
                                                    acc.account_name
                                                        .split(/\s+/)
                                                        .filter(Boolean)
                                                        .slice(0, 2)
                                                        .map((w) => w[0]?.toUpperCase() || '')
                                                        .join('') || 'MA';
                                                return (
                                                    <button
                                                        key={acc.account_id}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedAccountId(acc.account_id);
                                                            setAccountMenuOpen(false);
                                                        }}
                                                        className={`w-full px-3.5 py-2.5 flex items-center gap-3 text-left transition cursor-pointer border-l-[3px] ${
                                                            isActive
                                                                ? 'border-l-slate-900 bg-slate-50/90'
                                                                : 'border-l-transparent hover:bg-slate-50/60'
                                                        }`}
                                                    >
                                                        {match.avatarUrl ? (
                                                            <img
                                                                src={match.avatarUrl}
                                                                alt={acc.account_name}
                                                                className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                                                            />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                                                                {initialsText}
                                                            </div>
                                                        )}

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                <span className="text-[13px] font-bold text-slate-900 truncate">
                                                                    {acc.account_name}
                                                                </span>
                                                                {acc.is_default && (
                                                                    <span className="px-1.5 py-0.2 rounded-md bg-sky-50 text-[#0081FB] border border-sky-200/70 text-[9.5px] font-bold shrink-0">
                                                                        Principal
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Platform icons connected to this brand */}
                                                            <div className="flex items-center gap-1.5 mt-1">
                                                                <span title={`Meta Ads · ${acc.account_id}`} className="inline-flex">
                                                                    <MetaAdsIcon className="w-4 h-4 shrink-0" />
                                                                </span>
                                                                {match.matched.map((soc) => (
                                                                    <span
                                                                        key={soc.id}
                                                                        title={`${soc.platform} · ${soc.display_name || soc.account_name || ''}`}
                                                                        className="inline-flex"
                                                                    >
                                                                        {renderPlatformIcon(soc.platform, 'w-4 h-4 shrink-0')}
                                                                    </span>
                                                                ))}
                                                                <span className="text-[10.5px] text-slate-400 truncate ml-0.5">
                                                                    {match.matched.length > 0
                                                                        ? `${match.matched.length} página(s) · ${acc.currency || 'USD'}`
                                                                        : `${acc.account_id} · ${acc.currency || 'USD'}`}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {isActive && <Check className="w-4 h-4 text-slate-900 shrink-0" />}
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>

                                    {/* Connected Pages & Networks Footer */}
                                    {publishableAccounts.length > 0 && (
                                        <div className="px-3.5 py-2.5 bg-slate-50/80 border-t border-slate-100 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                    Páginas y redes conectadas ({publishableAccounts.length})
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setAccountMenuOpen(false);
                                                        onOpenConnect();
                                                    }}
                                                    className="text-[11px] font-semibold text-[#0081FB] hover:underline cursor-pointer"
                                                >
                                                    Ver todas →
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 max-h-[84px] overflow-y-auto">
                                                {publishableAccounts.map((acc) => {
                                                    const name = acc.display_name || acc.account_name || acc.platform;
                                                    return (
                                                        <span
                                                            key={acc.id}
                                                            title={`${acc.platform}: ${name}`}
                                                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-slate-200/80 text-[11px] font-medium text-slate-700 max-w-[156px]"
                                                        >
                                                            <span className="inline-flex shrink-0">
                                                                {renderPlatformIcon(acc.platform, 'w-3.5 h-3.5')}
                                                            </span>
                                                            <span className="truncate">{name}</span>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* UNCONNECTED BANNER */}
            {!loading && !connected && (
                <div className="bg-sky-50/70 border border-sky-200/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <MetaAdsIcon className="w-7 h-7 shrink-0" />
                        <div>
                            <p className="text-xs font-bold text-slate-900">
                                Conecta tu cuenta publicitaria Meta Ads para cruzar inversión con tus ventas cerradas
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                Tus conexiones actuales y Metricool no se ven afectados. Mostrando datos CRM para {since} → {until}.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onOpenConnect}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0081FB] hover:bg-[#006FE0] text-white text-xs font-semibold cursor-pointer shrink-0"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Conectar Meta Ads
                    </button>
                </div>
            )}

            {/* META API WARNING */}
            {data?.meta_error && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs text-amber-900">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                            <strong>Meta API:</strong> {data.meta_error}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onOpenConnect}
                        className="text-xs font-bold underline hover:text-amber-950 shrink-0"
                    >
                        Reconectar
                    </button>
                </div>
            )}

            {/* ══ SUB-VIEW 1: RESUMEN & ROI ═════════════════════════════════════════ */}
            {subTab === 'overview' && (
                <div className="space-y-5">
                    {/* CALM INLINE FILTER STRIP */}
                    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                Origen:
                            </span>
                            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100">
                                {overviewSourcePills.map((opt) => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => setSourceScope(opt.id)}
                                        className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                                            sourceScope === opt.id
                                                ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                                                : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                    >
                                        {opt.label} <span className="text-[11px] opacity-70">({opt.count})</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                Cohorte:
                            </span>
                            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100">
                                {cohortPills.map((opt) => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => setCohortScope(opt.id)}
                                        className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                                            cohortScope === opt.id
                                                ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                                                : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                    >
                                        {opt.label} <span className="text-[11px] opacity-70">({opt.count})</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 4 METRICOOL PASTEL KPI TILES (SINGLE CLEAN ROW, NO DUPLICATES) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="rounded-2xl bg-[#EFF6FF] p-5">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700/80">
                                Inversión Total
                            </div>
                            <p className="text-3xl font-black text-slate-900 mt-2 tracking-tight">
                                {loading ? '…' : fmtUsd(totalInvestment)}
                            </p>
                            <p className="text-xs text-blue-900/70 mt-1.5">
                                Meta Ads {fmtUsd(summary.spend)} · IA {fmtUsd(crm.ai_cost_usd, 4)}
                            </p>
                        </div>

                        <div className="rounded-2xl bg-[#ECFDF5] p-5">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700/80">
                                Ventas Ganadas CRM
                            </div>
                            <p className="text-3xl font-black text-emerald-700 mt-2 tracking-tight">
                                {loading ? '…' : fmtUsd(roiMetrics.revenue)}
                            </p>
                            <p className="text-xs text-emerald-900/70 mt-1.5">
                                {roiMetrics.deals} cierre(s) · {roiMetrics.closedCount} Cerrado · {roiMetrics.clientCount} Cliente
                            </p>
                        </div>

                        <div
                            className={`rounded-2xl p-5 ${
                                roiMetrics.roiPct === null
                                    ? 'bg-slate-100'
                                    : roiMetrics.netProfit >= 0
                                      ? 'bg-[#F0FDF4]'
                                      : 'bg-[#FFF1F2]'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span
                                    className={`text-[11px] font-bold uppercase tracking-wider ${
                                        roiMetrics.roiPct === null
                                            ? 'text-slate-600'
                                            : roiMetrics.netProfit >= 0
                                              ? 'text-emerald-700/80'
                                              : 'text-rose-700/80'
                                    }`}
                                >
                                    Utilidad Neta &amp; ROI
                                </span>
                                <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                        roiMetrics.roiPct === null
                                            ? 'bg-slate-200/70 text-slate-700'
                                            : roiMetrics.netProfit >= 0
                                              ? 'bg-emerald-200/70 text-emerald-800'
                                              : 'bg-rose-200/70 text-rose-800'
                                    }`}
                                >
                                    {roiMetrics.roiPct === null
                                        ? 'Sin gasto'
                                        : `${roiMetrics.roiPct >= 0 ? '+' : ''}${roiMetrics.roiPct}% ROI`}
                                </span>
                            </div>
                            <p
                                className={`text-3xl font-black mt-2 tracking-tight ${
                                    roiMetrics.roiPct === null
                                        ? 'text-slate-800'
                                        : roiMetrics.netProfit >= 0
                                          ? 'text-emerald-700'
                                          : 'text-rose-600'
                                }`}
                            >
                                {loading
                                    ? '…'
                                    : `${roiMetrics.netProfit >= 0 ? '+' : '-'}${fmtUsd(Math.abs(roiMetrics.netProfit))}`}
                            </p>
                            <p className="text-xs text-slate-600 mt-1.5">
                                {roiMetrics.roas !== null ? `ROAS ${roiMetrics.roas}x` : 'ROAS —'} ·{' '}
                                {roiMetrics.cac !== null ? `CAC ${fmtUsd(roiMetrics.cac)}` : 'CAC —'}
                            </p>
                        </div>

                        <div className="rounded-2xl bg-[#FEF3C7]/75 p-5">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800/80">
                                Formularios &amp; Leads
                            </div>
                            <p className="text-3xl font-black text-slate-900 mt-2 tracking-tight">
                                {loading ? '…' : summary.meta_leads.toLocaleString()}
                            </p>
                            <p className="text-xs text-amber-900/75 mt-1.5">
                                CPL {fmtUsd(summary.cpl)} · {crm.total_leads} Leads en CRM
                            </p>
                        </div>
                    </div>

                    {/* SIGNATURE METRICOOL CHART CARD */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl p-6">
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                            <div className="flex flex-wrap items-center gap-3">
                                <h3 className="text-sm font-bold text-slate-900">
                                    {chartMode === 'roi'
                                        ? 'Inversión Meta Ads vs Ventas Ganadas'
                                        : 'Inversión diaria vs Formularios y Leads CRM'}
                                </h3>
                                <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setChartMode('roi')}
                                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                                            chartMode === 'roi'
                                                ? 'bg-white text-slate-900 shadow-2xs'
                                                : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                    >
                                        Inversión vs Ganado ($)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setChartMode('leads')}
                                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                                            chartMode === 'leads'
                                                ? 'bg-white text-slate-900 shadow-2xs'
                                                : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                    >
                                        Leads &amp; Formularios
                                    </button>
                                </div>
                            </div>

                            {/* METRICOOL-STYLE TOP-RIGHT PASTEL BADGES */}
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="px-3.5 py-1.5 rounded-xl bg-[#DBEAFE]/70 text-center">
                                    <div className="text-sm font-black text-blue-800 leading-tight">
                                        {fmtUsd(summary.spend)}
                                    </div>
                                    <div className="text-[10px] font-semibold text-blue-700/80">Inversión Ads</div>
                                </div>
                                <div className="px-3.5 py-1.5 rounded-xl bg-[#D1FAE5]/75 text-center">
                                    <div className="text-sm font-black text-emerald-800 leading-tight">
                                        {fmtUsd(roiMetrics.revenue)}
                                    </div>
                                    <div className="text-[10px] font-semibold text-emerald-700/80">Ganado CRM</div>
                                </div>
                                <div className="px-3.5 py-1.5 rounded-xl bg-[#FEF3C7]/85 text-center">
                                    <div className="text-sm font-black text-amber-900 leading-tight">
                                        {cohortSummary.same_period_deals} / {cohortSummary.previous_period_deals}
                                    </div>
                                    <div className="text-[10px] font-semibold text-amber-800/80">Mismo mes / Ant.</div>
                                </div>
                            </div>
                        </div>

                        {loading ? (
                            <div className="h-64 flex items-center justify-center text-xs text-slate-400 gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" /> Cargando serie diaria…
                            </div>
                        ) : dailyChartData.length === 0 ? (
                            <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                                Sin actividad registrada entre {since} y {until}.
                            </div>
                        ) : chartMode === 'roi' ? (
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={dailyChartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="spendCalmGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#0081FB" stopOpacity={0.18} />
                                                <stop offset="95%" stopColor="#0081FB" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="date"
                                            tick={{ fontSize: 11, fill: '#94a3b8' }}
                                            tickFormatter={(v) => String(v).slice(5)}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <YAxis
                                            tick={{ fontSize: 11, fill: '#94a3b8' }}
                                            tickFormatter={(v) => `$${v}`}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <Tooltip
                                            formatter={(value: any, name: any) => [
                                                fmtUsd(Number(value) || 0),
                                                name,
                                            ]}
                                        />
                                        <Bar
                                            dataKey="won_amount"
                                            name="Ganado CRM ($)"
                                            fill="#10B981"
                                            radius={[5, 5, 0, 0]}
                                            maxBarSize={22}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="spend"
                                            name="Inversión Meta ($)"
                                            stroke="#0081FB"
                                            fill="url(#spendCalmGrad)"
                                            strokeWidth={2}
                                        />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={dailyChartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="spendLeadsGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#0081FB" stopOpacity={0.18} />
                                                <stop offset="95%" stopColor="#0081FB" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="crmLeadsGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="date"
                                            tick={{ fontSize: 11, fill: '#94a3b8' }}
                                            tickFormatter={(v) => String(v).slice(5)}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                        <Tooltip />
                                        <Area
                                            yAxisId="left"
                                            type="monotone"
                                            dataKey="spend"
                                            name="Inversión ($)"
                                            stroke="#0081FB"
                                            fill="url(#spendLeadsGrad)"
                                            strokeWidth={2}
                                        />
                                        <Area
                                            yAxisId="right"
                                            type="monotone"
                                            dataKey="crm_leads"
                                            name="Leads CRM"
                                            stroke="#10B981"
                                            fill="url(#crmLeadsGrad)"
                                            strokeWidth={2}
                                        />
                                        <Area
                                            yAxisId="right"
                                            type="monotone"
                                            dataKey="meta_leads"
                                            name="Formularios Meta"
                                            stroke="#8B5CF6"
                                            fill="none"
                                            strokeWidth={2}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    {/* BOTTOM AIRY 2-COLUMN SUMMARY: COHORTE + EMBUDO */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-col justify-between space-y-5">
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900">
                                        Cohorte de Cierres &amp; Alcance Meta Ads
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Separa ventas que entraron y cerraron este mes vs leads de meses anteriores cerrados hoy
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSubTab('sales')}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#0081FB] hover:underline cursor-pointer shrink-0"
                                >
                                    Auditar fechas <ArrowUpRight className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCohortScope('same_period');
                                        setSubTab('sales');
                                    }}
                                    className="text-left rounded-xl bg-emerald-50/70 hover:bg-emerald-50 p-4 transition cursor-pointer"
                                >
                                    <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                                        Ingresaron y cerraron aquí
                                    </div>
                                    <div className="flex items-baseline justify-between mt-1.5">
                                        <span className="text-2xl font-black text-slate-900">
                                            {fmtUsd(cohortSummary.same_period_amount)}
                                        </span>
                                        <span className="text-xs font-semibold text-emerald-700">
                                            {cohortSummary.same_period_deals} trato(s)
                                        </span>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setCohortScope('previous_period');
                                        setSubTab('sales');
                                    }}
                                    className="text-left rounded-xl bg-amber-50/70 hover:bg-amber-50 p-4 transition cursor-pointer"
                                >
                                    <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                                        De mes anterior · cerrados aquí
                                    </div>
                                    <div className="flex items-baseline justify-between mt-1.5">
                                        <span className="text-2xl font-black text-slate-900">
                                            {fmtUsd(cohortSummary.previous_period_amount)}
                                        </span>
                                        <span className="text-xs font-semibold text-amber-800">
                                            {cohortSummary.previous_period_deals} trato(s)
                                        </span>
                                    </div>
                                </button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
                                <div>
                                    <div className="text-[11px] text-slate-400 font-medium">Impresiones</div>
                                    <div className="text-sm font-bold text-slate-900 mt-0.5">
                                        {summary.impressions.toLocaleString()}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[11px] text-slate-400 font-medium">Alcance único</div>
                                    <div className="text-sm font-bold text-slate-900 mt-0.5">
                                        {summary.reach.toLocaleString()}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[11px] text-slate-400 font-medium">Clics · CTR</div>
                                    <div className="text-sm font-bold text-slate-900 mt-0.5">
                                        {summary.clicks.toLocaleString()} · {summary.ctr}%
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[11px] text-slate-400 font-medium">CPC · Consumo IA</div>
                                    <div className="text-sm font-bold text-slate-900 mt-0.5">
                                        {fmtUsd(summary.cpc)} ·{' '}
                                        <Link to="/leads/calificador-ia" className="text-[#4449AA] hover:underline">
                                            {fmtUsd(crm.ai_cost_usd, 4)}
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Embudo Ads → CRM</h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Conversión del período {since} al {until}
                                </p>
                            </div>
                            <div className="space-y-3 pt-1">
                                {funnelRows.map((row) => (
                                    <div key={row.label} className="space-y-1">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-medium text-slate-600">{row.label}</span>
                                            <span className="font-bold text-slate-900">{row.value.toLocaleString()}</span>
                                        </div>
                                        <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${row.color}`}
                                                style={{ width: `${row.value > 0 ? Math.max(4, row.pct) : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ SUB-VIEW 2: CAMPAÑAS META ══════════════════════════════════════════ */}
            {subTab === 'campaigns' && (
                <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900">Rendimiento por Campaña (Meta Ads)</h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Período {since} al {until} · Cuenta {data?.active_account?.account_name || 'Arias Group'}
                            </p>
                        </div>
                        <span className="text-xs font-semibold text-slate-500">
                            {campaigns.length} campaña(s) · Total {fmtUsd(summary.spend)}
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/70 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                    <th className="py-3 px-6">Campaña</th>
                                    <th className="py-3 px-4 text-right">Inversión</th>
                                    <th className="py-3 px-4 text-right">Impresiones</th>
                                    <th className="py-3 px-4 text-right">Clics</th>
                                    <th className="py-3 px-4 text-right">CTR</th>
                                    <th className="py-3 px-4 text-right">CPC</th>
                                    <th className="py-3 px-4 text-right">Formularios</th>
                                    <th className="py-3 px-6 text-right">CPL</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {campaigns.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-12 text-center text-slate-400">
                                            {connected
                                                ? 'No hubo campañas con gasto en este rango de fechas.'
                                                : 'Conecta tu cuenta Meta Ads para consultar tus campañas.'}
                                        </td>
                                    </tr>
                                ) : (
                                    campaigns.map((c) => (
                                        <tr key={c.campaign_id} className="hover:bg-slate-50/60">
                                            <td className="py-3.5 px-6 font-semibold text-slate-900 max-w-[300px] truncate">
                                                {c.campaign_name}
                                            </td>
                                            <td className="py-3.5 px-4 text-right font-bold text-slate-900">{fmtUsd(c.spend)}</td>
                                            <td className="py-3.5 px-4 text-right text-slate-600">{c.impressions.toLocaleString()}</td>
                                            <td className="py-3.5 px-4 text-right text-slate-600">{c.clicks.toLocaleString()}</td>
                                            <td className="py-3.5 px-4 text-right text-slate-600">{c.ctr}%</td>
                                            <td className="py-3.5 px-4 text-right text-slate-600">{fmtUsd(c.cpc)}</td>
                                            <td className="py-3.5 px-4 text-right font-bold text-violet-700">{c.meta_leads}</td>
                                            <td className="py-3.5 px-6 text-right font-semibold text-emerald-700">
                                                {c.meta_leads > 0 ? fmtUsd(c.cpl) : '—'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {campaigns.length > 0 && (
                                <tfoot>
                                    <tr className="bg-slate-50/80 border-t border-slate-200 text-xs font-bold text-slate-900">
                                        <td className="py-3 px-6">Total del período</td>
                                        <td className="py-3 px-4 text-right">{fmtUsd(summary.spend)}</td>
                                        <td className="py-3 px-4 text-right">{summary.impressions.toLocaleString()}</td>
                                        <td className="py-3 px-4 text-right">{summary.clicks.toLocaleString()}</td>
                                        <td className="py-3 px-4 text-right">{summary.ctr}%</td>
                                        <td className="py-3 px-4 text-right">{fmtUsd(summary.cpc)}</td>
                                        <td className="py-3 px-4 text-right text-violet-700">{summary.meta_leads}</td>
                                        <td className="py-3 px-6 text-right text-emerald-700">{fmtUsd(summary.cpl)}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            )}

            {/* ══ SUB-VIEW 3: VENTAS & COHORTE CRM ═══════════════════════════════════ */}
            {subTab === 'sales' && (
                <div className="space-y-5">
                    {/* 3 METRICOOL PASTEL COHORT TILES */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="rounded-2xl bg-[#ECFDF5] p-5">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700/80">
                                Ingresaron y cerraron en este período
                            </div>
                            <p className="text-2xl font-black text-emerald-700 mt-2">
                                {fmtUsd(cohortSummary.same_period_amount)}
                            </p>
                            <p className="text-xs text-emerald-900/75 mt-1">
                                {cohortSummary.same_period_deals} cierre(s) con ingreso desde {since}
                            </p>
                        </div>

                        <div className="rounded-2xl bg-[#FEF3C7]/75 p-5">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800/80">
                                De mes anterior · cerrados aquí
                            </div>
                            <p className="text-2xl font-black text-slate-900 mt-2">
                                {fmtUsd(cohortSummary.previous_period_amount)}
                            </p>
                            <p className="text-xs text-amber-900/75 mt-1">
                                {cohortSummary.previous_period_deals} cierre(s) que entraron antes de {since}
                            </p>
                        </div>

                        <div className="rounded-2xl bg-[#EFF6FF] p-5">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700/80">
                                Atribución por Origen CRM
                            </div>
                            <p className="text-2xl font-black text-slate-900 mt-2">
                                {fmtUsd(cohortSummary.meta_ads_amount + cohortSummary.social_amount)}
                            </p>
                            <p className="text-xs text-blue-900/75 mt-1">
                                Meta Ads: {cohortSummary.meta_ads_deals} · Redes Sociales: {cohortSummary.social_deals} · Otros CRM: {cohortSummary.other_deals}
                            </p>
                        </div>
                    </div>

                    {/* AUDIT FILTERS + PRECISION TABLE */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">
                                    Auditoría Exacta de Ventas Ganadas (Cerrado / Cliente)
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Fecha de ingreso real al CRM, fecha de cierre, días de maduración y origen exacto · Clic en un lead para abrirlo
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100">
                                    {[
                                        { id: 'all' as SourceScope, label: 'Todos' },
                                        { id: 'meta_social' as SourceScope, label: 'Meta y Redes' },
                                        { id: 'meta_ads' as SourceScope, label: 'Solo Meta Ads' },
                                        { id: 'other' as SourceScope, label: 'Otros CRM' },
                                    ].map((opt) => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => setSourceScope(opt.id)}
                                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                                                sourceScope === opt.id
                                                    ? 'bg-white text-slate-900 shadow-2xs'
                                                    : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100">
                                    {cohortPills.map((opt) => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => setCohortScope(opt.id)}
                                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                                                cohortScope === opt.id
                                                    ? 'bg-white text-slate-900 shadow-2xs'
                                                    : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/70 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                        <th className="py-3 px-6">Lead / Empresa</th>
                                        <th className="py-3 px-4">Ingreso CRM</th>
                                        <th className="py-3 px-4">Fecha Cierre</th>
                                        <th className="py-3 px-4">Cohorte / Ciclo</th>
                                        <th className="py-3 px-4">Origen Exacto</th>
                                        <th className="py-3 px-4">Estado</th>
                                        <th className="py-3 px-4 text-right">Cierre Real</th>
                                        <th className="py-3 px-6 text-right">Ficha</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs">
                                    {filteredWonItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="py-12 text-center text-slate-400">
                                                No hay ventas ganadas que coincidan con este filtro de origen o cohorte.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredWonItems.map((item) => {
                                            const isSamePeriod = item.cohort
                                                ? item.cohort === 'same_period'
                                                : Boolean(item.created_date && item.created_date >= since);
                                            return (
                                                <tr
                                                    key={item.id}
                                                    onClick={() => openLeadInCrm(item.id)}
                                                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                                                >
                                                    <td className="py-3.5 px-6">
                                                        <div className="font-semibold text-slate-900">{item.name}</div>
                                                        <div className="text-[11px] text-slate-500">
                                                            {item.company_name || 'Sin empresa'}
                                                            {item.advisor_name ? ` · ${item.advisor_name}` : ''}
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                                                        {item.created_date || '—'}
                                                    </td>
                                                    <td className="py-3.5 px-4 font-mono text-[11px] font-semibold text-slate-900 whitespace-nowrap">
                                                        {item.won_date || '—'}
                                                    </td>
                                                    <td className="py-3.5 px-4 whitespace-nowrap">
                                                        <span
                                                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                                                                isSamePeriod
                                                                    ? 'bg-emerald-50 text-emerald-700'
                                                                    : 'bg-amber-50 text-amber-800'
                                                            }`}
                                                        >
                                                            {isSamePeriod ? 'Mismo período' : 'Mes anterior'}
                                                            {typeof item.days_to_close === 'number'
                                                                ? ` · ${item.days_to_close}d`
                                                                : ''}
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        <OriginBadge item={item} />
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        <span
                                                            className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                                                                item.status === 'Cliente'
                                                                    ? 'bg-emerald-50 text-emerald-700'
                                                                    : 'bg-teal-50 text-teal-700'
                                                            }`}
                                                        >
                                                            {item.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right font-bold text-emerald-700 whitespace-nowrap">
                                                        {fmtUsd(item.amount)}
                                                    </td>
                                                    <td className="py-3.5 px-6 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openLeadInCrm(item.id);
                                                            }}
                                                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4449AA] hover:underline"
                                                        >
                                                            Abrir <ExternalLink className="w-3 h-3" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                                {filteredWonItems.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-slate-50/80 border-t border-slate-200 text-xs font-bold text-slate-900">
                                            <td className="py-3 px-6" colSpan={6}>
                                                Total filtrado ({filteredWonItems.length} cierre{filteredWonItems.length === 1 ? '' : 's'})
                                            </td>
                                            <td className="py-3 px-4 text-right text-emerald-700">
                                                {fmtUsd(roiMetrics.revenue)}
                                            </td>
                                            <td className="py-3 px-6" />
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
