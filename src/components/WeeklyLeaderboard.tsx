/**
 * AgentRanking — F5 of SIA (replaces hardcoded WeeklyLeaderboard)
 * Respects the Dashboard date filter. Score 0-100 quality index.
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';

interface AgentScore {
    userId: string;
    fullName: string;
    avatarUrl: string | null;
    totalActions: number;
    connected: number;
    withNotes: number;
    statusChanges: number;
    score: number;
}

interface WeeklyLeaderboardProps {
    companyId: string;
    currentUserId?: string;
    startDate?: string;   // ISO — from Dashboard dateRange filter
    endDate?: string;     // ISO — from Dashboard dateRange filter
    periodLabel?: string; // e.g. "Este mes"
}

const MEDALS = ['🥇', '🥈', '🥉'];
const TOP_ACTIONS_GOAL = 20;

function calcScore(ag: Omit<AgentScore, 'score'>): number {
    if (ag.totalActions === 0) return 0;
    return Math.round(
        (ag.connected / ag.totalActions) * 40 +
        (ag.withNotes / ag.totalActions) * 25 +
        (ag.statusChanges / ag.totalActions) * 25 +
        Math.min(ag.totalActions / TOP_ACTIONS_GOAL, 1) * 10
    );
}

function ScoreBar({ score, isMe }: { score: number; isMe: boolean }) {
    const color = score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-400' : 'bg-rose-400';
    return (
        <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-1000 ${isMe ? 'bg-indigo-500' : color}`}
                    style={{ width: `${score}%` }}
                />
            </div>
            <span className={`text-[10px] font-black w-6 text-right ${isMe ? 'text-indigo-600' : 'text-gray-500'}`}>{score}</span>
        </div>
    );
}

export function WeeklyLeaderboard({ companyId, currentUserId, startDate, endDate, periodLabel = 'este período' }: WeeklyLeaderboardProps) {
    const [board, setBoard] = useState<AgentScore[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLeaderboard = useCallback(async () => {
        if (!companyId) return;

        let query = supabase
            .from('call_activities')
            .select('user_id, outcome, notes, status_before, status_after')
            .eq('company_id', companyId)
            .limit(500);

        if (startDate) query = query.gte('call_date', startDate);
        if (endDate) query = query.lte('call_date', endDate);

        const { data: activities, error } = await query;
        if (error || !activities) { setLoading(false); return; }

        const userIds = [...new Set(activities.map(a => a.user_id))];
        if (userIds.length === 0) { setBoard([]); setLoading(false); return; }

        const { data: profiles } = await supabase
            .from('profiles').select('id, full_name, avatar_url').in('id', userIds);
        const profileMap = new Map((profiles || []).map(p => [p.id, p]));

        const agentMap = new Map<string, Omit<AgentScore, 'score'>>();
        for (const act of activities) {
            const uid = act.user_id;
            if (!agentMap.has(uid)) {
                const p = profileMap.get(uid);
                agentMap.set(uid, { userId: uid, fullName: p?.full_name || 'Agente', avatarUrl: p?.avatar_url || null, totalActions: 0, connected: 0, withNotes: 0, statusChanges: 0 });
            }
            const ag = agentMap.get(uid)!;
            ag.totalActions++;
            if (act.outcome === 'connected') ag.connected++;
            if (act.notes && act.notes.trim().length > 5) ag.withNotes++;
            if (act.status_before && act.status_after && act.status_before !== act.status_after) ag.statusChanges++;
        }

        setBoard(
            Array.from(agentMap.values())
                .map(ag => ({ ...ag, score: calcScore(ag) }))
                .sort((a, b) => b.score - a.score)
                .slice(0, 5)
        );
        setLoading(false);
    }, [companyId, startDate, endDate]);

    useEffect(() => {
        setLoading(true);
        fetchLeaderboard();
        const interval = setInterval(fetchLeaderboard, 5 * 60_000);
        return () => clearInterval(interval);
    }, [fetchLeaderboard]);

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_15px_rgb(0,0,0,0.03)] p-4 h-full animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-40 mb-4" />
                {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-3 mb-2.5">
                        <div className="w-7 h-7 bg-gray-100 rounded-full" />
                        <div className="flex-1 h-3 bg-gray-100 rounded" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_15px_rgb(0,0,0,0.03)] p-4 flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">🏆 Ranking</h3>
                    <p className="text-[9px] text-gray-400 font-medium mt-0.5 capitalize">{periodLabel}</p>
                </div>
                <div className="bg-amber-50 px-2 py-0.5 rounded-full">
                    <span className="text-[8px] font-black text-amber-600 uppercase tracking-wider">SIA</span>
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 mb-3 pb-2 border-b border-gray-50">
                <span className="text-[8px] font-bold text-gray-300 uppercase tracking-wider">Score 0-100</span>
                {[['bg-emerald-400', '≥70'], ['bg-amber-400', '≥40'], ['bg-rose-400', '<40']].map(([color, label]) => (
                    <div key={label} className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${color}`} />
                        <span className="text-[8px] text-gray-300">{label}</span>
                    </div>
                ))}
            </div>

            {board.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                    <p className="text-3xl mb-2">📊</p>
                    <p className="text-xs font-bold text-gray-300">Sin actividad en este período</p>
                </div>
            ) : (
                <div className="space-y-2 flex-1">
                    {board.map((agent, idx) => {
                        const isMe = agent.userId === currentUserId;
                        const medal = MEDALS[idx] ?? `#${idx + 1}`;
                        return (
                            <div
                                key={agent.userId}
                                className={`flex items-center gap-2.5 p-2 rounded-xl transition-colors ${isMe ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-gray-50'}`}
                            >
                                <span className="text-base w-6 text-center shrink-0">{medal}</span>
                                <div className="shrink-0">
                                    {agent.avatarUrl ? (
                                        <img src={agent.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover border-2 border-white shadow-sm" />
                                    ) : (
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow-sm ${isMe ? 'bg-indigo-200' : 'bg-gray-100'}`}>
                                            <span className={`text-[9px] font-black ${isMe ? 'text-indigo-700' : 'text-gray-500'}`}>
                                                {agent.fullName.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-[10px] font-black truncate leading-tight ${isMe ? 'text-indigo-700' : 'text-slate-800'}`}>
                                        {agent.fullName.split(' ')[0]}
                                        {isMe && <span className="ml-1 text-[8px] text-indigo-400">(tú)</span>}
                                    </p>
                                    <ScoreBar score={agent.score} isMe={isMe} />
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-sm font-black text-slate-700 leading-none">{agent.totalActions}</p>
                                    <p className="text-[7px] font-bold text-gray-300 uppercase">acciones</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
