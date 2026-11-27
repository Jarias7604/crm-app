import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Bot, Coins, Mic, MessageSquare, RefreshCw } from 'lucide-react';
import {
    aiUsageService,
    createEmptyAiUsageSummary,
    type AiUsageSummary,
} from '../services/aiUsageService';

interface AiUsageCostCardProps {
    companyId: string;
    startDate?: string;
    periodLabel?: string;
    budgetUsd?: number;
    variant?: 'compact' | 'bi';
    showConfigLink?: boolean;
}

export function formatUsd(amount: number): string {
    const val = Number(amount) || 0;
    if (val === 0) return '$0.00';
    if (val < 0.01) return `$${val.toFixed(4)}`;
    if (val < 1) return `$${val.toFixed(3)}`;
    return `$${val.toFixed(2)}`;
}

export function AiUsageCostCard({
    companyId,
    startDate,
    periodLabel = 'Mes actual',
    budgetUsd = 20,
    variant = 'compact',
    showConfigLink = false,
}: AiUsageCostCardProps) {
    const [summary, setSummary] = useState<AiUsageSummary>(() => createEmptyAiUsageSummary());
    const [loading, setLoading] = useState(true);

    const loadSummary = useCallback(async () => {
        if (!companyId) return;
        setLoading(true);
        try {
            const res = await aiUsageService.getUsageSummary(companyId, startDate);
            setSummary(res);
        } finally {
            setLoading(false);
        }
    }, [companyId, startDate]);

    useEffect(() => {
        loadSummary();
    }, [loadSummary]);

    const safeBudget = budgetUsd > 0 ? budgetUsd : 20;
    const budgetPct = Math.min(100, Math.round((summary.totalCostUsd / safeBudget) * 100));

    if (variant === 'bi') {
        return (
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#4449AA]">
                            <Coins className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-gray-900">Consumo Estimado OpenAI (IA)</h3>
                            <p className="text-xs text-gray-500">
                                {periodLabel} · Control real de tokens (gpt-4o-mini) y audios (Whisper)
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={loadSummary}
                            disabled={loading}
                            className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
                            title="Actualizar consumo IA"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        {showConfigLink && (
                            <Link
                                to="/leads/calificador-ia"
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-xs font-bold text-[#4449AA] transition"
                            >
                                Configurar Calificador IA
                                <ArrowUpRight className="w-3.5 h-3.5" />
                            </Link>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                            Gasto Total ({periodLabel})
                        </p>
                        <p className="text-2xl font-black text-gray-900">{formatUsd(summary.totalCostUsd)} USD</p>
                        <p className="text-[11px] text-gray-500 mt-1">
                            {summary.totalCalls} respuestas IA · {summary.totalTokens.toLocaleString()} tokens
                        </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                            Consumo Hoy
                        </p>
                        <p className="text-2xl font-black text-indigo-600">{formatUsd(summary.todayCostUsd)} USD</p>
                        <p className="text-[11px] text-gray-500 mt-1">{summary.todayCalls} interacciones hoy</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                            Costo Promedio / Lead
                        </p>
                        <p className="text-2xl font-black text-emerald-600">
                            {formatUsd(summary.avgCostPerLeadUsd)}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-1">
                            {summary.uniqueLeadsCount} lead(s) atendidos por IA
                        </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-1.5">
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Desglose por Uso</p>
                        <div className="flex items-center justify-between text-xs">
                            <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                                <Bot className="w-3.5 h-3.5 text-[#4449AA]" /> Calificador
                            </span>
                            <span className="font-bold text-slate-900">
                                {formatUsd(summary.qualifierCostUsd)} ({summary.qualifierCalls})
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                                <Mic className="w-3.5 h-3.5 text-amber-600" /> Audios Whisper
                            </span>
                            <span className="font-bold text-slate-900">
                                {formatUsd(summary.whisperCostUsd)} ({summary.whisperMinutes}m)
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> Soporte IA
                            </span>
                            <span className="font-bold text-slate-900">
                                {formatUsd(summary.supportCostUsd)} ({summary.supportCalls})
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            <Coins className="w-3.5 h-3.5 text-[#4449AA]" />
                            Consumo IA ({periodLabel})
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400">
                            Meta {formatUsd(safeBudget)}
                        </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-xl font-black text-slate-900">
                            {formatUsd(summary.totalCostUsd)} USD
                        </span>
                        <span className="text-[11px] text-slate-500">
                            ({summary.totalTokens.toLocaleString()} tok)
                        </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${
                                budgetPct >= 85 ? 'bg-rose-500' : 'bg-[#4449AA]'
                            }`}
                            style={{ width: `${Math.max(budgetPct > 0 ? 4 : 0, budgetPct)}%` }}
                        />
                    </div>
                </div>

                <div className="sm:border-l sm:border-slate-100 sm:pl-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Gasto Hoy</p>
                    <p className="text-xl font-black text-indigo-600 mt-0.5">{formatUsd(summary.todayCostUsd)} USD</p>
                    <p className="text-[11px] text-slate-500">{summary.todayCalls} llamada(s) IA hoy</p>
                </div>

                <div className="sm:border-l sm:border-slate-100 sm:pl-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Promedio / Lead
                    </p>
                    <p className="text-xl font-black text-emerald-600 mt-0.5">
                        {formatUsd(summary.avgCostPerLeadUsd)}
                    </p>
                    <p className="text-[11px] text-slate-500">
                        {summary.uniqueLeadsCount} lead(s) atendidos
                    </p>
                </div>

                <div className="sm:border-l sm:border-slate-100 sm:pl-4 flex items-center justify-between gap-2">
                    <div className="space-y-1 text-[11px]">
                        <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                            <Bot className="w-3.5 h-3.5 text-[#4449AA]" />
                            Calificador: {formatUsd(summary.qualifierCostUsd)} ({summary.qualifierCalls})
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                            <Mic className="w-3.5 h-3.5 text-amber-600" />
                            Voz Whisper: {formatUsd(summary.whisperCostUsd)} ({summary.whisperMinutes} min)
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                            Soporte: {formatUsd(summary.supportCostUsd)} ({summary.supportCalls})
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={loadSummary}
                        disabled={loading}
                        className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition shrink-0"
                        title="Recargar consumo IA"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>
        </div>
    );
}
