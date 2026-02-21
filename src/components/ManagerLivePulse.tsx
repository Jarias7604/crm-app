/**
 * ManagerLivePulse — F4 of SIA
 * Real-time team activity monitor. Respects the Dashboard date filter.
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { ACTION_TYPE_CONFIG } from '../services/callActivity';
import type { ActionType } from '../services/callActivity';

interface AgentPulse {
    userId: string;
    fullName: string;
    avatarUrl: string | null;
    totalActions: number;
    connected: number;
    lastActivityAt: string | null;
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
    startDate?: string;   // ISO — from Dashboard dateRange filter
    endDate?: string;     // ISO — from Dashboard dateRange filter
    periodLabel?: string; // Human-readable label e.g. "Este mes"
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

export function ManagerLivePulse({ companyId, startDate, endDate, periodLabel = 'este período' }: ManagerLivePulseProps) {
    const [agents, setAgents] = useState<AgentPulse[]>([]);
    const [recent, setRecent] = useState<RecentActivity[]>([]);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!companyId) return;

        // Build query with optional date range filter
        let query = supabase
            .from('call_activities')
            .select('id, user_id, outcome, action_type, lead_id, created_at')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })
            .limit(300);

        if (startDate) query = query.gte('call_date', startDate);
        if (endDate) query = query.lte('call_date', endDate);

        const { data: activities, error } = await query;
        if (error || !activities) { setLoading(false); return; }

        // Fetch profiles for unique user_ids
        const userIds = [...new Set(activities.map(a => a.user_id))];
        if (userIds.length === 0) { setAgents([]); setRecent([]); setLoading(false); return; }

        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', userIds);
        const profileMap = new Map((profiles || []).map(p => [p.id, p]));

        // Fetch lead names for top 8 recent activities
        const recentLeadIds = [...new Set(activities.slice(0, 10).map(a => a.lead_id))].filter(Boolean);
        let leadMap = new Map<string, string>();
        if (recentLeadIds.length > 0) {
            const { data: leads } = await supabase
                .from('leads').select('id, name').in('id', recentLeadIds);
            leadMap = new Map((leads || []).map(l => [l.id, l.name]));
        }

        // Aggregate by agent
        const agentMap = new Map<string, AgentPulse>();
        for (const act of activities) {
            const uid = act.user_id;
            if (!agentMap.has(uid)) {
                const p = profileMap.get(uid);
                agentMap.set(uid, {
                    userId: uid,
                    fullName: p?.full_name || 'Agente',
                    avatarUrl: p?.avatar_url || null,
                    totalActions: 0,
                    connected: 0,
                    lastActivityAt: act.created_at,
                });
            }
            const ag = agentMap.get(uid)!;
            ag.totalActions++;
            if (act.outcome === 'connected') ag.connected++;
            if (!ag.lastActivityAt || act.created_at > ag.lastActivityAt) ag.lastActivityAt = act.created_at;
        }

        setAgents(Array.from(agentMap.values()).sort((a, b) => b.totalActions - a.totalActions));

        setRecent(activities.slice(0, 8).map(act => {
            const p = profileMap.get(act.user_id);
            return {
                id: act.id, userId: act.user_id,
                fullName: p?.full_name || 'Agente',
                avatarUrl: p?.avatar_url || null,
                actionType: act.action_type as ActionType,
                outcome: act.outcome,
                leadName: leadMap.get(act.lead_id) || null,
                createdAt: act.created_at,
            };
        }));

        setLastRefresh(new Date());
        setLoading(false);
    }, [companyId, startDate, endDate]);

    useEffect(() => {
        setLoading(true);
        fetchData();
        const interval = setInterval(fetchData, 60_000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const totalActions = agents.reduce((s, a) => s + a.totalActions, 0);
    const totalConnected = agents.reduce((s, a) => s + a.connected, 0);
    const teamConnectRate = totalActions > 0 ? Math.round((totalConnected / totalActions) * 100) : 0;
    const activeAgents = agents.filter(a =>
        a.lastActivityAt && (Date.now() - new Date(a.lastActivityAt).getTime()) < 2 * 3600_000
    ).length;

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_15px_rgb(0,0,0,0.03)] p-4 h-full animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-40 mb-4" />
                <div className="space-y-2">
                    {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-50 rounded-xl" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_15px_rgb(0,0,0,0.03)] p-4 h-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <div>
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Live Pulse</span>
                        <span className="ml-2 text-[9px] text-gray-300">· {periodLabel.toLowerCase()} · act. {timeAgo(lastRefresh.toISOString())}</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-center">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Acciones</p>
                        <p className="text-lg font-black text-slate-900 leading-none">{totalActions}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Conectados</p>
                        <p className="text-lg font-black text-emerald-600 leading-none">{teamConnectRate}%</p>
                    </div>
                    <div className="text-center">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Activos 2h</p>
                        <p className="text-lg font-black text-indigo-600 leading-none">{activeAgents}/{agents.length}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Agent Cards */}
                <div className="lg:col-span-3">
                    {agents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-gray-300">
                            <p className="text-3xl mb-2">📭</p>
                            <p className="text-xs font-bold">Sin actividad en este período</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {agents.map((agent, idx) => {
                                const connectRate = agent.totalActions > 0
                                    ? Math.round((agent.connected / agent.totalActions) * 100) : 0;
                                const isActive = agent.lastActivityAt &&
                                    (Date.now() - new Date(agent.lastActivityAt).getTime()) < 2 * 3600_000;
                                return (
                                    <div key={agent.userId} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50/80 hover:bg-indigo-50/40 transition-colors">
                                        <span className="text-[10px] font-black text-gray-300 w-4 text-center">{idx + 1}</span>
                                        <div className="relative shrink-0">
                                            {agent.avatarUrl ? (
                                                <img src={agent.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center border-2 border-white shadow-sm">
                                                    <span className="text-[10px] font-black text-indigo-600">{agent.fullName.charAt(0).toUpperCase()}</span>
                                                </div>
                                            )}
                                            {isActive && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-black text-slate-800 truncate leading-tight">{agent.fullName}</p>
                                            <ConnectRateBar rate={connectRate} />
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className="text-center">
                                                <p className="text-base font-black text-slate-900 leading-none">{agent.totalActions}</p>
                                                <p className="text-[7px] font-bold text-gray-400 uppercase">total</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[9px] font-black text-gray-300">{agent.lastActivityAt ? timeAgo(agent.lastActivityAt) : '—'}</p>
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
                        <p className="text-xs text-gray-300 font-bold text-center py-6">Sin actividad</p>
                    ) : (
                        <div className="space-y-1.5">
                            {recent.map(act => {
                                const cfg = ACTION_TYPE_CONFIG[act.actionType] || ACTION_TYPE_CONFIG.call;
                                const ok = act.outcome === 'connected';
                                return (
                                    <div key={act.id} className="flex items-center gap-2">
                                        <span className="text-sm shrink-0">{cfg.icon}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black text-slate-700 truncate leading-tight">
                                                {act.fullName.split(' ')[0]}
                                                {act.leadName && <span className="font-medium text-gray-400"> → {act.leadName}</span>}
                                            </p>
                                            <p className={`text-[9px] font-bold ${ok ? 'text-emerald-500' : 'text-gray-300'}`}>
                                                {ok ? '✓ Conectado' : act.outcome.replace('_', ' ')}
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
