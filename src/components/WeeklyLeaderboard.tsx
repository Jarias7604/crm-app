/**
 * WeeklyLeaderboard — F5 of SIA (System for Activity Intelligence)
 *
 * Weekly top performers widget. Visible to all users (agents see where they rank).
 * Score formula (0-100):
 *   Connect Rate   × 40pts
 *   Notes Rate     × 25pts  (actions with notes)
 *   Conversion Rate× 25pts  (actions that changed lead status)
 *   Volume Score   × 10pts  (normalized to 20 actions/week = max)
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
    score: number; // 0-100
}

interface WeeklyLeaderboardProps {
    companyId: string;
    currentUserId?: string;
}

const MEDALS = ['🥇', '🥈', '🥉'];
const TOP_ACTIONS_GOAL = 20; // Full volume score at 20 actions/week

function calcScore(agent: Omit<AgentScore, 'score'>): number {
    if (agent.totalActions === 0) return 0;
    const connectRate = agent.connected / agent.totalActions;
    const notesRate = agent.withNotes / agent.totalActions;
    const convRate = agent.statusChanges / agent.totalActions;
    const volScore = Math.min(agent.totalActions / TOP_ACTIONS_GOAL, 1);
    return Math.round(
        connectRate * 40 +
        notesRate * 25 +
        convRate * 25 +
        volScore * 10
    );
}

function ScoreBar({ score, isMe }: { score: number; isMe: boolean }) {
    const color = score >= 70
        ? 'bg-emerald-500'
        : score >= 40
            ? 'bg-amber-400'
            : 'bg-rose-400';

    return (
        <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-1000 ${isMe ? 'bg-indigo-500' : color}`}
                    style={{ width: `${score}%` }}
                />
            </div>
            <span className={`text-[10px] font-black w-6 text-right ${isMe ? 'text-indigo-600' : 'text-gray-500'}`}>
                {score}
            </span>
        </div>
    );
}

export function WeeklyLeaderboard({ companyId, currentUserId }: WeeklyLeaderboardProps) {
    const [board, setBoard] = useState<AgentScore[]>([]);
    const [loading, setLoading] = useState(true);
    const [weekLabel, setWeekLabel] = useState('');

    const fetchLeaderboard = useCallback(async () => {
        if (!companyId) return;

        // Monday of current week
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=Sun
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() + diffToMonday);
        weekStart.setHours(0, 0, 0, 0);

        const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        setWeekLabel(`semana del ${weekStart.getDate()} ${months[weekStart.getMonth()]}`);

        const { data: activities, error } = await supabase
            .from('call_activities')
            .select(`
                user_id,
                outcome,
                notes,
                status_before,
                status_after,
                profiles!user_id (full_name, avatar_url)
            `)
            .eq('company_id', companyId)
            .gte('call_date', weekStart.toISOString())
            .limit(500);

        if (error || !activities) return;

        const agentMap = new Map<string, Omit<AgentScore, 'score'>>();

        for (const act of activities) {
            const uid = act.user_id;
            const profile = (act as any).profiles;
            if (!agentMap.has(uid)) {
                agentMap.set(uid, {
                    userId: uid,
                    fullName: profile?.full_name || 'Agente',
                    avatarUrl: profile?.avatar_url || null,
                    totalActions: 0,
                    connected: 0,
                    withNotes: 0,
                    statusChanges: 0,
                });
            }
            const ag = agentMap.get(uid)!;
            ag.totalActions++;
            if (act.outcome === 'connected') ag.connected++;
            if (act.notes && act.notes.trim().length > 5) ag.withNotes++;
            if (act.status_before && act.status_after && act.status_before !== act.status_after) ag.statusChanges++;
        }

        const scored: AgentScore[] = Array.from(agentMap.values())
            .map(ag => ({ ...ag, score: calcScore(ag) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5); // Top 5

        setBoard(scored);
        setLoading(false);
    }, [companyId]);

    useEffect(() => {
        fetchLeaderboard();
        const interval = setInterval(fetchLeaderboard, 5 * 60_000); // refresh every 5min
        return () => clearInterval(interval);
    }, [fetchLeaderboard]);

    const myRank = currentUserId ? board.findIndex(a => a.userId === currentUserId) : -1;

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_15px_rgb(0,0,0,0.03)] p-4 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-40 mb-3" />
                {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-gray-100 rounded-full" />
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
                    <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                        🏆 Ranking Semanal
                    </h3>
                    <p className="text-[9px] text-gray-400 font-medium mt-0.5 capitalize">{weekLabel}</p>
                </div>
                <div className="bg-amber-50 px-2 py-0.5 rounded-full">
                    <span className="text-[8px] font-black text-amber-600 uppercase tracking-wider">SIA</span>
                </div>
            </div>

            {/* Score legend */}
            <div className="flex items-center gap-3 mb-3 pb-2 border-b border-gray-50">
                <span className="text-[8px] font-bold text-gray-300 uppercase tracking-wider">Score 0-100</span>
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-[8px] text-gray-300">≥70</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-[8px] text-gray-300">≥40</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-rose-400" />
                    <span className="text-[8px] text-gray-300">&lt;40</span>
                </div>
            </div>

            {board.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                    <p className="text-3xl mb-2">📊</p>
                    <p className="text-xs font-bold text-gray-300">Sin datos esta semana</p>
                </div>
            ) : (
                <div className="space-y-2 flex-1">
                    {board.map((agent, idx) => {
                        const isMe = agent.userId === currentUserId;
                        const medal = MEDALS[idx] ?? `#${idx + 1}`;

                        return (
                            <div
                                key={agent.userId}
                                className={`flex items-center gap-2.5 p-2 rounded-xl transition-colors ${isMe
                                        ? 'bg-indigo-50 border border-indigo-100'
                                        : 'hover:bg-gray-50'
                                    }`}
                            >
                                {/* Medal / Rank */}
                                <span className="text-base w-6 text-center shrink-0">{medal}</span>

                                {/* Avatar */}
                                <div className="shrink-0">
                                    {agent.avatarUrl ? (
                                        <img
                                            src={agent.avatarUrl}
                                            alt=""
                                            className="w-7 h-7 rounded-full object-cover border-2 border-white shadow-sm"
                                        />
                                    ) : (
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow-sm ${isMe ? 'bg-indigo-200' : 'bg-gray-100'}`}>
                                            <span className={`text-[9px] font-black ${isMe ? 'text-indigo-700' : 'text-gray-500'}`}>
                                                {agent.fullName.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Name + bar */}
                                <div className="flex-1 min-w-0">
                                    <p className={`text-[10px] font-black truncate leading-tight ${isMe ? 'text-indigo-700' : 'text-slate-800'}`}>
                                        {agent.fullName.split(' ')[0]}
                                        {isMe && <span className="ml-1 text-[8px] text-indigo-400 font-medium">(tú)</span>}
                                    </p>
                                    <ScoreBar score={agent.score} isMe={isMe} />
                                </div>

                                {/* Actions count */}
                                <div className="text-right shrink-0">
                                    <p className="text-sm font-black text-slate-700 leading-none">{agent.totalActions}</p>
                                    <p className="text-[7px] font-bold text-gray-300 uppercase">acciones</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Footer: my rank if outside top 5 */}
            {myRank === -1 && currentUserId && board.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-50 text-center">
                    <p className="text-[9px] text-gray-300 font-bold">Aún no tienes actividad esta semana</p>
                </div>
            )}
        </div>
    );
}
