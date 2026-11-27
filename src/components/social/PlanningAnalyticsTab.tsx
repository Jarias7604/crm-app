import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    AlertCircle,
    ArrowUpRight,
    BarChart3,
    Calendar,
    CheckCircle2,
    Coins,
    DollarSign,
    Eye,
    FileCheck2,
    Loader2,
    MousePointerClick,
    Plus,
    RefreshCw,
    TrendingUp,
    Users,
    Wallet,
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
} from '../../services/social/metaAdsService';
import type { SocialAccount } from '../../services/social/socialPublishService';
import { MetaAdsIcon } from './SocialBrandKit';

interface PlanningAnalyticsTabProps {
    companyId: string;
    metaAdsAccounts: SocialAccount[];
    onOpenConnect: () => void;
}

const PRESET_OPTIONS: Array<{ id: MetaAdsDatePreset; label: string }> = [
    { id: 'mtd', label: 'Este Mes (MTD)' },
    { id: 'today', label: 'Hoy' },
    { id: '7d', label: '7 días' },
    { id: '30d', label: '30 días' },
    { id: 'last_month', label: 'Mes pasado' },
    { id: 'custom', label: 'Personalizado' },
];

function fmtUsd(n: number, decimals = 2): string {
    const val = Number(n) || 0;
    if (val > 0 && val < 0.01) return `$${val.toFixed(4)}`;
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function PlanningAnalyticsTab({
    companyId,
    metaAdsAccounts,
    onOpenConnect,
}: PlanningAnalyticsTabProps) {
    const initialRange = getMetaAdsPresetRange('mtd');
    const [preset, setPreset] = useState<MetaAdsDatePreset>('mtd');
    const [since, setSince] = useState(initialRange.since);
    const [until, setUntil] = useState(initialRange.until);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [roiScope, setRoiScope] = useState<'all' | 'meta'>('all');
    const [chartMode, setChartMode] = useState<'roi' | 'leads'>('roi');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<MetaAdsInsightsResponse | null>(null);

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
    const daily = data?.daily || [];
    const campaigns = data?.campaigns || [];
    const connected = Boolean(data?.connected || metaAdsAccounts.length > 0);
    const roi = data?.roi;

    const totalInvestment = roi ? roi.total_investment : Number((summary.spend + crm.ai_cost_usd).toFixed(2));
    const displayedWonRevenue =
        roiScope === 'meta'
            ? (roi ? roi.meta_won_revenue : (crm.won_meta_amount ?? 0))
            : (roi ? roi.won_revenue : crm.won_amount);
    const displayedWonDeals =
        roiScope === 'meta'
            ? (roi ? roi.meta_won_deals : (crm.won_meta_deals ?? 0))
            : (roi ? roi.won_deals : crm.won_deals);
    const displayedNetProfit =
        roiScope === 'meta'
            ? (roi ? roi.meta_net_profit : Number(((crm.won_meta_amount ?? 0) - totalInvestment).toFixed(2)))
            : (roi ? roi.net_profit : Number((crm.won_amount - totalInvestment).toFixed(2)));
    const displayedRoiPct =
        roiScope === 'meta'
            ? (roi ? roi.meta_roi_pct : null)
            : (roi ? roi.roi_pct : null);
    const displayedRoas =
        roiScope === 'meta'
            ? (roi ? roi.meta_roas : null)
            : (roi ? roi.roas : null);
    const displayedCac =
        roiScope === 'meta'
            ? (displayedWonDeals > 0 ? Number((totalInvestment / displayedWonDeals).toFixed(2)) : null)
            : (roi ? roi.cac : null);

    const maxRoiBar = Math.max(totalInvestment, displayedWonRevenue, 1);
    const investmentBarPct = totalInvestment > 0 ? Math.max(4, Math.round((totalInvestment / maxRoiBar) * 100)) : 0;
    const wonBarPct = displayedWonRevenue > 0 ? Math.max(4, Math.round((displayedWonRevenue / maxRoiBar) * 100)) : 0;

    const allWonItems = crm.won_items || [];
    const filteredWonItems =
        roiScope === 'meta' ? allWonItems.filter((item) => item.is_meta_source) : allWonItems;

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
            label: 'Clientes / Cerrados CRM',
            value: crm.won_deals,
            color: 'bg-amber-500',
            pct: crm.total_leads > 0 ? Math.min(100, Math.max(6, (crm.won_deals / crm.total_leads) * 100)) : 0,
        },
    ];

    return (
        <div className="space-y-4">
            {/* FILTER BAR */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                    {PRESET_OPTIONS.map((opt) => {
                        const active = preset === opt.id;
                        return (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => handleSelectPreset(opt.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                    active
                                        ? 'bg-zinc-900 text-white shadow-2xs'
                                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                                }`}
                            >
                                {opt.label}
                            </button>
                        );
                    })}

                    <div className="flex items-center gap-1.5 ml-1 pl-2 border-l border-slate-200">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="date"
                            value={since}
                            onChange={(e) => {
                                setPreset('custom');
                                setSince(e.target.value);
                            }}
                            className="px-2 py-1 rounded-lg border border-slate-200 text-xs text-slate-700"
                        />
                        <span className="text-xs text-slate-400">a</span>
                        <input
                            type="date"
                            value={until}
                            onChange={(e) => {
                                setPreset('custom');
                                setUntil(e.target.value);
                            }}
                            className="px-2 py-1 rounded-lg border border-slate-200 text-xs text-slate-700"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {(data?.ad_accounts?.length || 0) > 1 && (
                        <select
                            value={selectedAccountId}
                            onChange={(e) => setSelectedAccountId(e.target.value)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700"
                        >
                            {data!.ad_accounts.map((acc) => (
                                <option key={acc.account_id} value={acc.account_id}>
                                    {acc.account_name} ({acc.account_id})
                                </option>
                            ))}
                        </select>
                    )}

                    <button
                        type="button"
                        onClick={loadInsights}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Actualizar
                    </button>

                    <button
                        type="button"
                        onClick={onOpenConnect}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0081FB] hover:bg-[#006FE0] text-white text-xs font-semibold cursor-pointer"
                    >
                        <MetaAdsIcon className="w-3.5 h-3.5 ring-1 ring-white/40 rounded-full" />
                        {connected ? 'Cuenta Meta Ads' : 'Conectar Meta Ads'}
                    </button>
                </div>
            </div>

            {/* UNCONNECTED CALLOUT */}
            {!loading && !connected && (
                <div className="bg-sky-50/80 border border-sky-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <MetaAdsIcon className="w-7 h-7 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-bold text-slate-900">
                                Conecta tu cuenta publicitaria Meta Ads (Arias Group) para ver inversión, impresiones, clics y formularios llenados
                            </p>
                            <p className="text-[11px] text-slate-600 mt-0.5">
                                Tus 9 conexiones actuales de Facebook, Instagram y YouTube siguen intactas. Ya estamos mostrando abajo tus Leads reales del CRM y consumo IA para este rango ({since} → {until}).
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onOpenConnect}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0081FB] hover:bg-[#006FE0] text-white text-xs font-semibold cursor-pointer shrink-0"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Ir a Conectar Meta Ads
                    </button>
                </div>
            )}

            {/* META API WARNING IF ANY */}
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
                        Reconectar cuenta
                    </button>
                </div>
            )}

            {/* ROI EXECUTIVE PANEL: INVERSIÓN VS VENTAS GANADAS (CERRADO / CLIENTE) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                            <Wallet className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-bold text-slate-900">
                                    Retorno de Inversión (ROI) · Inversión vs Ventas Ganadas
                                </h3>
                                <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                        displayedRoiPct === null
                                            ? 'bg-slate-100 text-slate-600 border-slate-200'
                                            : displayedNetProfit >= 0
                                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                              : 'bg-rose-50 text-rose-700 border-rose-200'
                                    }`}
                                >
                                    {displayedRoiPct === null
                                        ? 'Sin gasto en rango'
                                        : displayedNetProfit >= 0
                                          ? 'Rentable'
                                          : 'En recuperación'}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                                Período {since} → {until} · Cierres reales CRM en estados <strong>Cerrado</strong> y <strong>Cliente</strong> (sincronizado con Dashboard)
                            </p>
                        </div>
                    </div>

                    <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200">
                        <button
                            type="button"
                            onClick={() => setRoiScope('all')}
                            className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                                roiScope === 'all'
                                    ? 'bg-white text-slate-900 shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Todas las ventas CRM ({crm.won_deals})
                        </button>
                        <button
                            type="button"
                            onClick={() => setRoiScope('meta')}
                            className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                                roiScope === 'meta'
                                    ? 'bg-white text-[#0081FB] shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Solo origen Meta / FB ({crm.won_meta_deals ?? 0})
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Inversión Total
                        </div>
                        <p className="text-xl font-black text-slate-900 mt-1">
                            {loading ? '…' : fmtUsd(totalInvestment)}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            Ads {fmtUsd(summary.spend)} + IA {fmtUsd(crm.ai_cost_usd, 4)}
                        </p>
                    </div>

                    <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                            Ventas Ganadas CRM
                        </div>
                        <p className="text-xl font-black text-emerald-700 mt-1">
                            {loading ? '…' : fmtUsd(displayedWonRevenue)}
                        </p>
                        <p className="text-[11px] text-emerald-800/80 mt-0.5">
                            {roiScope === 'all'
                                ? `${displayedWonDeals} trato(s) · ${crm.won_closed_count ?? 0} Cerrado · ${crm.won_client_count ?? 0} Cliente`
                                : `${displayedWonDeals} trato(s) atribuidos a Meta / FB`}
                        </p>
                    </div>

                    <div
                        className={`rounded-xl border p-3.5 ${
                            displayedNetProfit >= 0
                                ? 'border-emerald-200/80 bg-emerald-50/30'
                                : 'border-rose-200/80 bg-rose-50/40'
                        }`}
                    >
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Utilidad Neta
                        </div>
                        <p
                            className={`text-xl font-black mt-1 ${
                                displayedNetProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                            }`}
                        >
                            {loading
                                ? '…'
                                : `${displayedNetProfit >= 0 ? '+' : '-'}${fmtUsd(Math.abs(displayedNetProfit))}`}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            Ganado − (Inversión Ads + IA)
                        </p>
                    </div>

                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            ROI %
                        </div>
                        <p
                            className={`text-xl font-black mt-1 ${
                                displayedRoiPct === null
                                    ? 'text-slate-700'
                                    : displayedRoiPct >= 0
                                      ? 'text-emerald-700'
                                      : 'text-rose-600'
                            }`}
                        >
                            {loading
                                ? '…'
                                : displayedRoiPct === null
                                  ? '—'
                                  : `${displayedRoiPct >= 0 ? '+' : ''}${displayedRoiPct}%`}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            Retorno porcentual neto
                        </p>
                    </div>

                    <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/40 p-3.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                            ROAS &amp; CAC
                        </div>
                        <p className="text-xl font-black text-indigo-700 mt-1">
                            {loading ? '…' : displayedRoas !== null ? `${displayedRoas}x` : '—'}
                        </p>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                            {displayedRoas !== null
                                ? `Retorno por \$1 Ads · CAC: ${displayedCac !== null ? fmtUsd(displayedCac) : '—'}`
                                : `CAC: ${displayedCac !== null ? fmtUsd(displayedCac) : '—'}`}
                        </p>
                    </div>
                </div>

                {/* Visual comparison bar: Investment vs Won Revenue */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-slate-600">Inversión (Meta Ads + OpenAI IA)</span>
                            <span className="font-bold text-slate-900">{fmtUsd(totalInvestment)}</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-[#0081FB] transition-all"
                                style={{ width: `${investmentBarPct}%` }}
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-emerald-700">
                                Ventas Ganadas ({roiScope === 'all' ? 'Cerrado + Cliente' : 'Origen Meta / FB'})
                            </span>
                            <span className="font-bold text-emerald-700">{fmtUsd(displayedWonRevenue)}</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-emerald-500 transition-all"
                                style={{ width: `${wonBarPct}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* 6 EXECUTIVE KPI CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <span>Inversión Meta Ads</span>
                        <TrendingUp className="w-4 h-4 text-[#0081FB]" />
                    </div>
                    <p className="text-2xl font-black text-slate-900 mt-2">
                        {loading ? '…' : fmtUsd(summary.spend)}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                        CPM: {fmtUsd(summary.cpm)} · {data?.active_account?.currency || 'USD'}
                    </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <span>Impresiones</span>
                        <Eye className="w-4 h-4 text-sky-500" />
                    </div>
                    <p className="text-2xl font-black text-slate-900 mt-2">
                        {loading ? '…' : summary.impressions.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                        Alcance: {summary.reach.toLocaleString()} personas
                    </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <span>Clics Anuncios</span>
                        <MousePointerClick className="w-4 h-4 text-indigo-600" />
                    </div>
                    <p className="text-2xl font-black text-indigo-600 mt-2">
                        {loading ? '…' : summary.clicks.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                        CTR: {summary.ctr}% · CPC: {fmtUsd(summary.cpc)}
                    </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <span>Formularios (Meta)</span>
                        <FileCheck2 className="w-4 h-4 text-violet-600" />
                    </div>
                    <p className="text-2xl font-black text-violet-700 mt-2">
                        {loading ? '…' : summary.meta_leads.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                        Costo / Form (CPL): <strong>{fmtUsd(summary.cpl)}</strong>
                    </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <span>CRM Leads &amp; Cierres</span>
                        <Users className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-2xl font-black text-emerald-600 mt-2">
                        {loading ? '…' : crm.total_leads.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                        Ganados: <strong>{crm.won_deals}</strong> ({fmtUsd(crm.won_amount)})
                    </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <span>Consumo OpenAI IA</span>
                        <Coins className="w-4 h-4 text-amber-500" />
                    </div>
                    <p className="text-2xl font-black text-slate-900 mt-2">
                        {loading ? '…' : fmtUsd(crm.ai_cost_usd, 4)}
                    </p>
                    <Link
                        to="/leads/calificador-ia"
                        className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#4449AA] hover:underline mt-1"
                    >
                        {crm.ai_calls} respuestas · Ver detalle <ArrowUpRight className="w-3 h-3" />
                    </Link>
                </div>
            </div>

            {/* CHARTS ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900">
                                {chartMode === 'roi'
                                    ? 'Evolución diaria: Inversión Meta Ads ($USD) vs Ventas Ganadas ($USD)'
                                    : 'Evolución diaria: Inversión ($USD) vs Formularios y Leads CRM'}
                            </h3>
                            <p className="text-[11px] text-slate-500">
                                Rango {since} al {until} · El Salvador (-06:00)
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200">
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
                            <BarChart3 className="w-4 h-4 text-slate-400 hidden sm:block" />
                        </div>
                    </div>

                    {loading ? (
                        <div className="h-64 flex items-center justify-center text-xs text-slate-400 gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Cargando serie diaria…
                        </div>
                    ) : daily.length === 0 ? (
                        <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                            Sin actividad registrada en el rango seleccionado.
                        </div>
                    ) : chartMode === 'roi' ? (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={daily} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="spendRoiGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0081FB" stopOpacity={0.25} />
                                            <stop offset="95%" stopColor="#0081FB" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 11, fill: '#64748b' }}
                                        tickFormatter={(v) => String(v).slice(5)}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 11, fill: '#64748b' }}
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
                                        radius={[4, 4, 0, 0]}
                                        maxBarSize={26}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="spend"
                                        name="Inversión Meta ($)"
                                        stroke="#0081FB"
                                        fill="url(#spendRoiGrad)"
                                        strokeWidth={2}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={daily} margin={{ top: 10, right: 12, left: -15, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0081FB" stopOpacity={0.28} />
                                            <stop offset="95%" stopColor="#0081FB" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="leadsGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.28} />
                                            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 11, fill: '#64748b' }}
                                        tickFormatter={(v) => String(v).slice(5)}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                    <Tooltip />
                                    <Area
                                        yAxisId="left"
                                        type="monotone"
                                        dataKey="spend"
                                        name="Inversión ($)"
                                        stroke="#0081FB"
                                        fill="url(#spendGrad)"
                                        strokeWidth={2}
                                    />
                                    <Area
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey="crm_leads"
                                        name="Leads CRM"
                                        stroke="#10B981"
                                        fill="url(#leadsGrad)"
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

                {/* FUNNEL SUMMARY */}
                <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3.5">
                    <div>
                        <h3 className="text-sm font-bold text-slate-900">Embudo Ads → CRM</h3>
                        <p className="text-[11px] text-slate-500">
                            Conversión desde impresión hasta cierre en Arias CRM
                        </p>
                    </div>
                    <div className="space-y-3 pt-1">
                        {funnelRows.map((row) => (
                            <div key={row.label} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-medium text-slate-700">{row.label}</span>
                                    <span className="font-bold text-slate-900">{row.value.toLocaleString()}</span>
                                </div>
                                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
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

            {/* CAMPAIGNS TABLE */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-slate-900">Desglose por Campaña (Meta Ads)</h3>
                        <p className="text-[11px] text-slate-500">
                            Ordenado por inversión en el período {since} al {until}
                        </p>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500">
                        {campaigns.length} campaña(s)
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                <th className="py-2.5 px-4">Campaña</th>
                                <th className="py-2.5 px-3 text-right">Inversión</th>
                                <th className="py-2.5 px-3 text-right">Impresiones</th>
                                <th className="py-2.5 px-3 text-right">Clics</th>
                                <th className="py-2.5 px-3 text-right">CTR</th>
                                <th className="py-2.5 px-3 text-right">CPC</th>
                                <th className="py-2.5 px-3 text-right">Formularios</th>
                                <th className="py-2.5 px-4 text-right">CPL</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                            {campaigns.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-8 text-center text-slate-400">
                                        {connected
                                            ? 'No hubo campañas con gasto en el rango de fechas seleccionado.'
                                            : 'Conecta tu cuenta Meta Ads arriba para ver el rendimiento por campaña.'}
                                    </td>
                                </tr>
                            ) : (
                                campaigns.map((c) => (
                                    <tr key={c.campaign_id} className="hover:bg-slate-50/70">
                                        <td className="py-2.5 px-4 font-semibold text-slate-900 max-w-[260px] truncate">
                                            {c.campaign_name}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">{fmtUsd(c.spend)}</td>
                                        <td className="py-2.5 px-3 text-right text-slate-600">{c.impressions.toLocaleString()}</td>
                                        <td className="py-2.5 px-3 text-right text-slate-600">{c.clicks.toLocaleString()}</td>
                                        <td className="py-2.5 px-3 text-right text-slate-600">{c.ctr}%</td>
                                        <td className="py-2.5 px-3 text-right text-slate-600">{fmtUsd(c.cpc)}</td>
                                        <td className="py-2.5 px-3 text-right font-bold text-violet-700">{c.meta_leads}</td>
                                        <td className="py-2.5 px-4 text-right font-semibold text-emerald-700">
                                            {c.meta_leads > 0 ? fmtUsd(c.cpl) : '—'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* WON DEALS AUDIT TABLE (CERRADO / CLIENTE) */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <div>
                            <h3 className="text-sm font-bold text-slate-900">
                                Ventas Ganadas en el Período (Cerrado / Cliente)
                            </h3>
                            <p className="text-[11px] text-slate-500">
                                Cierres reales entre {since} y {until} ·{' '}
                                {roiScope === 'meta' ? 'Filtrado a origen Meta / Facebook' : 'Incluye todos los orígenes del CRM'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                            <DollarSign className="w-3.5 h-3.5" />
                            Total: {fmtUsd(displayedWonRevenue)} ({filteredWonItems.length})
                        </span>
                        <Link
                            to="/leads"
                            className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#4449AA] hover:underline"
                        >
                            Ver Pipeline <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                <th className="py-2.5 px-4">Fecha Cierre</th>
                                <th className="py-2.5 px-3">Lead / Empresa</th>
                                <th className="py-2.5 px-3">Estado</th>
                                <th className="py-2.5 px-3">Origen</th>
                                <th className="py-2.5 px-4 text-right">Cierre Real ($USD)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                            {filteredWonItems.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-slate-400">
                                        {roiScope === 'meta'
                                            ? 'No hay cierres atribuibles a origen Meta / Facebook en este rango de fechas.'
                                            : 'No se registraron ventas en estado Cerrado o Cliente en el rango seleccionado.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredWonItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50/70">
                                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                                            {item.won_date || '—'}
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <div className="font-semibold text-slate-900">{item.name}</div>
                                            {item.company_name && (
                                                <div className="text-[11px] text-slate-500">{item.company_name}</div>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <span
                                                className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                                    item.status === 'Cliente'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : 'bg-teal-50 text-teal-700 border-teal-200'
                                                }`}
                                            >
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3">
                                            {item.is_meta_source ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-[#0081FB] border border-sky-200">
                                                    Meta / FB ({item.source})
                                                </span>
                                            ) : (
                                                <span className="text-slate-600">{item.source}</span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-4 text-right font-bold text-emerald-700">
                                            {fmtUsd(item.amount)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
