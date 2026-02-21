/**
 * ManagerLivePulse — F4 of SIA (System for Activity Intelligence)
 *
 * Real-time team activity monitor for managers.
 * Shows: each agent's today stats, connected rate, last seen, activity feed.
 * Polls every 60 seconds. Only visible to company_admin / managers.
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { ACTION_TYPE_CONFIG } from '../services/callActivity';
import type { ActionType } from '../services/callActivity';

interface AgentPulse {
    userId: string;
    fullName: string;
    avatarUrl: string | null;
    totalToday: number;
    connected: number;
    lastActivityAt: string | null; // ISO string
}

interface RecentActivity {
    id: string;
    userId: string;
    fullName: string;
    avatarUrl: string | null;
    actionType: ActionType;
    outcome: string;
    leadName: string | null;
    createdAt: string;
}

interface ManagerLivePulseProps {
    companyId: string;
}

function timeAgo(isoString: string): string {
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
}

function ConnectRateBar({ rate }: { rate: number }) {
    const color = rate >= 60 ? 'bg-emerald-500' : rate >= 30 ? 'bg-yellow-400' : 'bg-red-400';
    return (
        <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${rate}%` }} />
            </div>
            <span className="text-[9px] font-black text-gray-500 w-6 text-right">{rate}%</span>
        </div>
    );
}

export function ManagerLivePulse({ companyId }: ManagerLivePulseProps) {
    const [agents, setAgents] = useState<AgentPulse[]>([]);
    const [recent, setRecent] = useState<RecentActivity[]>([]);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!companyId) return;

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // Fetch today's activities + profile info
        const { data: activities, error } = await supabase
            .from('call_activities')
            .select(`
                id,
                user_id,
                outcome,
                action_type,
                created_at,
                leads!lead_id (name),
                profiles!user_id (full_name, avatar_url)
            `)
            .eq('company_id', companyId)
            .gte('call_date', todayStart.toISOString())
            .order('created_at', { ascending: false })
            .limit(200);

        if (error || !activities) return;

        // Aggregate by agent
        const agentMap = new Map<string, AgentPulse>();
        for (const act of activities) {
            const profile = (act as any).profiles;
            const uid = act.user_id;
            if (!agentMap.has(uid)) {
                agentMap.set(uid, {
                    userId: uid,
                    fullName: profile?.full_name || 'Agente',
                    avatarUrl: profile?.avatar_url || null,
                    totalToday: 0,
                    connected: 0,
                    lastActivityAt: act.created_at,
                });
            }
            const ag = agentMap.get(uid)!;
            ag.totalToday++;
            if (act.outcome === 'connected') ag.connected++;
            if (!ag.lastActivityAt || act.created_at > ag.lastActivityAt) {
                ag.lastActivityAt = act.created_at;
            }
        }

        // Sort: most active first
        const sortedAgents = Array.from(agentMap.values()).sort((a, b) => b.totalToday - a.totalToday);
        setAgents(sortedAgents);

        // Recent feed: last 8 activities
        const feed: RecentActivity[] = activities.slice(0, 8).map((act: any) => ({
            id: act.id,
            userId: act.user_id,
            fullName: act.profiles?.full_name || 'Agente',
            avatarUrl: act.profiles?.avatar_url || null,
            actionType: act.action_type as ActionType,
            outcome: act.outcome,
            leadName: act.leads?.name || null,
            createdAt: act.created_at,
        }));
        setRecent(feed);
        setLastRefresh(new Date());
        setLoading(false);
    }, [companyId]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 60_000); // poll every 60s
        return () => clearInterval(interval);
    }, [fetchData]);

    const totalActionsToday = agents.reduce((s, a) => s + a.totalToday, 0);
    const totalConnected = agents.reduce((s, a) => s + a.connected, 0);
    const teamConnectRate = totalActionsToday > 0 ? Math.round((totalConnected / totalActionsToday) * 100) : 0;
    const activeAgents = agents.filter(a => {
        if (!a.lastActivityAt) return false;
        return (Date.now() - new Date(a.lastActivityAt).getTime()) < 2 * 3600_000; // active in last 2h
    }).length;

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_15px_rgb(0,0,0,0.03)] p-4 col-span-full animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-40 mb-3" />
                <div className="flex gap-3">
                    {[1, 2, 3].map(i => <div key={i} className="flex-1 h-16 bg-gray-50 rounded-xl" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_15px_rgb(0,0,0,0.03)] p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Live Pulse</span>
                    </div>
                    <span className="text-[9px] text-gray-300 hidden sm:block">
                        · actualizado {timeAgo(lastRefresh.toISOString())}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-center">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Acciones hoy</p>
                        <p className="text-lg font-black text-slate-900 leading-none">{totalActionsToday}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Conectados</p>
                        <p className="text-lg font-black text-emerald-600 leading-none">{teamConnectRate}%</p>
                    </div>
                    <div className="text-center">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Activos</p>
                        <p className="text-lg font-black text-indigo-600 leading-none">{activeAgents}/{agents.length}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Agent Cards */}
                <div className="lg:col-span-3">
                    {agents.length === 0 ? (
                        <div className="text-center py-8 text-gray-300">
                            <p className="text-3xl mb-2">📭</p>
                            <p className="text-xs font-bold">Sin actividad hoy</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {agents.map((agent, idx) => {
                                const connectRate = agent.totalToday > 0
                                    ? Math.round((agent.connected / agent.totalToday) * 100)
                                    : 0;
                                const isActive = agent.lastActivityAt &&
                                    (Date.now() - new Date(agent.lastActivityAt).getTime()) < 2 * 3600_000;

                                return (
                                    <div key={agent.userId} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50/80 hover:bg-indigo-50/40 transition-colors group">
                                        {/* Rank */}
                                        <span className="text-[10px] font-black text-gray-300 w-4 text-center">{idx + 1}</span>

                                        {/* Avatar */}
                                        <div className="relative shrink-0">
                                            {agent.avatarUrl ? (
                                                <img src={agent.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center border-2 border-white shadow-sm">
                                                    <span className="text-[10px] font-black text-indigo-600">
                                                        {agent.fullName.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                            )}
                                            {isActive && (
                                                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white" />
                                            )}
                                        </div>

                                        {/* Name + rate bar */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-black text-slate-800 truncate leading-tight">{agent.fullName}</p>
                                            <ConnectRateBar rate={connectRate} />
                                        </div>

                                        {/* Stats */}
                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className="text-center">
                                                <p className="text-base font-black text-slate-900 leading-none">{agent.totalToday}</p>
                                                <p className="text-[7px] font-bold text-gray-400 uppercase">hoy</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[9px] font-black text-gray-300">
                                                    {agent.lastActivityAt ? timeAgo(agent.lastActivityAt) : '—'}
                                                </p>
                                                <p className="text-[7px] font-bold text-gray-300 uppercase">último</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Recent Activity Feed */}
                <div className="lg:col-span-2 border-l border-gray-50 pl-4">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Actividad reciente</p>
                    {recent.length === 0 ? (
                        <p className="text-xs text-gray-300 font-bold text-center py-4">Sin actividad</p>
                    ) : (
                        <div className="space-y-1.5">
                            {recent.map(act => {
                                const cfg = ACTION_TYPE_CONFIG[act.actionType] || ACTION_TYPE_CONFIG.call;
                                const isConnected = act.outcome === 'connected';
                                return (
                                    <div key={act.id} className="flex items-center gap-2 group">
                                        <span className="text-sm shrink-0">{cfg.icon}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black text-slate-700 truncate leading-tight">
                                                {act.fullName.split(' ')[0]}
                                                {act.leadName && <span className="font-medium text-gray-400"> → {act.leadName}</span>}
                                            </p>
                                            <p className={`text-[9px] font-bold ${isConnected ? 'text-emerald-500' : 'text-gray-300'}`}>
                                                {isConnected ? '✓ Conectado' : act.outcome.replace('_', ' ')}
                                            </p>
                                        </div>
                                        <span className="text-[9px] text-gray-300 shrink-0">{timeAgo(act.createdAt)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
