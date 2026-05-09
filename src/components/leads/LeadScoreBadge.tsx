/**
 * LeadScoreBadge — Visual AI Score indicator
 * 
 * Displays the lead temperature (🔥 Hot / ☀️ Warm / ❄️ Cold) with an
 * animated score ring and tooltip showing the full breakdown.
 * 
 * Usage:
 *   <LeadScoreBadge lead={lead} />
 *   <LeadScoreBadge lead={lead} variant="compact" />
 */

import React, { useMemo, useState } from 'react';
import { calculateLeadScore, TEMPERATURE_CONFIG, type ScoreBreakdown } from '../../services/leadScoringService';
import type { Lead } from '../../types';

interface LeadScoreBadgeProps {
    lead: Partial<Lead>;
    variant?: 'full' | 'compact' | 'ring';
    className?: string;
}

export const LeadScoreBadge: React.FC<LeadScoreBadgeProps> = ({
    lead,
    variant = 'compact',
    className = '',
}) => {
    const [showTooltip, setShowTooltip] = useState(false);

    const breakdown: ScoreBreakdown = useMemo(() => calculateLeadScore(lead), [
        lead.value, lead.closing_amount, lead.email, lead.phone,
        lead.company_name, lead.status, lead.contact_count,
        lead.source, lead.created_at, lead.address,
    ]);

    const config = TEMPERATURE_CONFIG[breakdown.temperature];
    const pct = breakdown.total;

    // ── Ring-only variant (for table cells) ──────────────────────────────────
    if (variant === 'ring') {
        const circumference = 2 * Math.PI * 14; // r=14
        const offset = circumference - (pct / 100) * circumference;
        const strokeColor =
            breakdown.temperature === 'hot' ? '#EF4444' :
            breakdown.temperature === 'warm' ? '#F59E0B' : '#3B82F6';

        return (
            <div
                className={`relative inline-flex items-center justify-center ${className}`}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
            >
                <svg width="36" height="36" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#F3F4F6" strokeWidth="3" />
                    <circle
                        cx="18" cy="18" r="14" fill="none"
                        stroke={strokeColor}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        transform="rotate(-90 18 18)"
                        className="transition-all duration-700 ease-out"
                    />
                </svg>
                <span className="absolute text-[9px] font-black" style={{ color: strokeColor }}>
                    {pct}
                </span>

                {/* Tooltip */}
                {showTooltip && (
                    <ScoreTooltip breakdown={breakdown} config={config} />
                )}
            </div>
        );
    }

    // ── Compact badge (for grid cards) ───────────────────────────────────────
    if (variant === 'compact') {
        return (
            <div
                className={`relative inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${config.bgColor} ${config.color} ${config.borderColor} ${className}`}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
            >
                <span>{config.emoji}</span>
                <span>{pct}</span>

                {showTooltip && (
                    <ScoreTooltip breakdown={breakdown} config={config} />
                )}
            </div>
        );
    }

    // ── Full variant (for detail panel) ─────────────────────────────────────
    return (
        <div className={`${config.bgColor} rounded-xl border ${config.borderColor} p-4 ${className}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">{config.emoji}</span>
                    <div>
                        <p className={`text-sm font-black ${config.color}`}>
                            Lead {config.label}
                        </p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            AI Score: {pct}/100
                        </p>
                    </div>
                </div>
                {/* Mini ring */}
                <div className="relative">
                    <svg width="48" height="48" viewBox="0 0 48 48">
                        <circle cx="24" cy="24" r="20" fill="none" stroke="#F3F4F6" strokeWidth="4" />
                        <circle
                            cx="24" cy="24" r="20" fill="none"
                            stroke={
                                breakdown.temperature === 'hot' ? '#EF4444' :
                                breakdown.temperature === 'warm' ? '#F59E0B' : '#3B82F6'
                            }
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeDasharray={2 * Math.PI * 20}
                            strokeDashoffset={(2 * Math.PI * 20) - (pct / 100) * (2 * Math.PI * 20)}
                            transform="rotate(-90 24 24)"
                            className="transition-all duration-1000 ease-out"
                        />
                    </svg>
                    <span className={`absolute inset-0 flex items-center justify-center text-sm font-black ${config.color}`}>
                        {pct}
                    </span>
                </div>
            </div>

            {/* Factor breakdown */}
            <div className="space-y-1.5">
                {breakdown.factors.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest truncate">
                                    {f.name}
                                </span>
                                <span className="text-[9px] font-black text-gray-400">
                                    {f.points}/{f.maxPoints}
                                </span>
                            </div>
                            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-700 ease-out"
                                    style={{
                                        width: `${(f.points / f.maxPoints) * 100}%`,
                                        backgroundColor:
                                            f.points / f.maxPoints >= 0.7 ? '#10B981' :
                                            f.points / f.maxPoints >= 0.4 ? '#F59E0B' : '#EF4444',
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── Tooltip (shared by compact + ring) ──────────────────────────────────────

const ScoreTooltip: React.FC<{
    breakdown: ScoreBreakdown;
    config: typeof TEMPERATURE_CONFIG['hot'];
}> = ({ breakdown, config }) => (
    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 p-3 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
            <span className="text-lg">{config.emoji}</span>
            <div>
                <p className={`text-xs font-black ${config.color}`}>
                    Lead {config.label} — {breakdown.total}/100
                </p>
                <p className="text-[9px] text-gray-400">Scoring AI automático</p>
            </div>
        </div>
        <div className="space-y-1">
            {breakdown.factors.map((f, i) => (
                <div key={i} className="flex items-center justify-between">
                    <span className="text-[9px] text-gray-500 truncate flex-1">{f.name}</span>
                    <span className={`text-[9px] font-black ml-2 ${f.points >= f.maxPoints * 0.7 ? 'text-emerald-500' : f.points >= f.maxPoints * 0.4 ? 'text-amber-500' : 'text-gray-400'}`}>
                        +{f.points}
                    </span>
                </div>
            ))}
        </div>
        <div className="mt-2 pt-1.5 border-t border-gray-100 text-[8px] text-gray-300 text-center">
            Powered by Arias AI Engine™
        </div>
    </div>
);
