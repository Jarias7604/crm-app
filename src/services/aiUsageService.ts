import { supabase } from './supabase';

export interface AiUsageSummary {
    totalCostUsd: number;
    todayCostUsd: number;
    totalCalls: number;
    todayCalls: number;
    uniqueLeadsCount: number;
    avgCostPerLeadUsd: number;
    qualifierCostUsd: number;
    qualifierCalls: number;
    whisperCostUsd: number;
    whisperCalls: number;
    whisperMinutes: number;
    supportCostUsd: number;
    supportCalls: number;
    totalTokens: number;
}

export function createEmptyAiUsageSummary(): AiUsageSummary {
    return {
        totalCostUsd: 0,
        todayCostUsd: 0,
        totalCalls: 0,
        todayCalls: 0,
        uniqueLeadsCount: 0,
        avgCostPerLeadUsd: 0,
        qualifierCostUsd: 0,
        qualifierCalls: 0,
        whisperCostUsd: 0,
        whisperCalls: 0,
        whisperMinutes: 0,
        supportCostUsd: 0,
        supportCalls: 0,
        totalTokens: 0,
    };
}

function getMonthStartIso(timeZone = 'America/El_Salvador'): string {
    try {
        const ymd = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(new Date());
        return new Date(`${ymd.slice(0, 7)}-01T00:00:00-06:00`).toISOString();
    } catch {
        const now = new Date();
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 6, 0, 0)).toISOString();
    }
}

function getTodayDateKey(isoOrDate: string | Date, timeZone = 'America/El_Salvador'): string {
    try {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate);
    } catch {
        return new Date(isoOrDate).toISOString().slice(0, 10);
    }
}

export const aiUsageService = {
    async getUsageSummary(companyId: string, startDateIso?: string): Promise<AiUsageSummary> {
        if (!companyId) return createEmptyAiUsageSummary();
        const sinceIso = startDateIso || getMonthStartIso();
        const todayKey = getTodayDateKey(new Date());

        try {
            const { data, error } = await supabase
                .from('ai_usage_logs')
                .select('feature, total_tokens, audio_seconds, estimated_cost_usd, lead_id, created_at')
                .eq('company_id', companyId)
                .gte('created_at', sinceIso)
                .order('created_at', { ascending: false })
                .limit(5000);

            if (error || !Array.isArray(data)) {
                return createEmptyAiUsageSummary();
            }

            const summary = createEmptyAiUsageSummary();
            const uniqueLeadIds = new Set<string>();
            let totalAudioSec = 0;

            for (const row of data) {
                const cost = Number(row.estimated_cost_usd) || 0;
                const tokens = Number(row.total_tokens) || 0;
                const audioSec = Number(row.audio_seconds) || 0;
                const feat = String(row.feature || '');

                summary.totalCostUsd += cost;
                summary.totalCalls += 1;
                summary.totalTokens += tokens;

                if (row.lead_id) {
                    uniqueLeadIds.add(String(row.lead_id));
                }
                if (row.created_at && getTodayDateKey(row.created_at) === todayKey) {
                    summary.todayCostUsd += cost;
                    summary.todayCalls += 1;
                }

                if (feat === 'lead_qualifier' || feat === 'lead_qualifier_sim') {
                    summary.qualifierCostUsd += cost;
                    summary.qualifierCalls += 1;
                } else if (feat === 'whisper_audio') {
                    summary.whisperCostUsd += cost;
                    summary.whisperCalls += 1;
                    totalAudioSec += audioSec;
                } else {
                    summary.supportCostUsd += cost;
                    summary.supportCalls += 1;
                }
            }

            summary.uniqueLeadsCount = uniqueLeadIds.size;
            summary.avgCostPerLeadUsd =
                summary.uniqueLeadsCount > 0 ? summary.totalCostUsd / summary.uniqueLeadsCount : 0;
            summary.whisperMinutes = Number((totalAudioSec / 60).toFixed(1));

            return summary;
        } catch {
            return createEmptyAiUsageSummary();
        }
    },
};
