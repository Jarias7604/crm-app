import { useState, useEffect } from 'react';

interface SessionTimerProps {
    openedAt: number; // Date.now() timestamp when the lead panel was opened
    className?: string;
}

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Live session timer — shows how long the agent has had the lead panel open.
 * Color escalates: green → yellow (>5min) → orange (>15min)
 * This creates natural accountability without being intrusive.
 */
export function SessionTimer({ openedAt, className = '' }: SessionTimerProps) {
    const [elapsed, setElapsed] = useState(Math.floor((Date.now() - openedAt) / 1000));

    useEffect(() => {
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - openedAt) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [openedAt]);

    // Color escalation based on elapsed time
    const isWarm = elapsed >= 5 * 60;   // > 5 min → yellow
    const isHot = elapsed >= 15 * 60;  // > 15 min → orange

    const dotColor = isHot ? 'bg-orange-500' : isWarm ? 'bg-yellow-400' : 'bg-green-500';
    const textColor = isHot ? 'text-orange-600' : isWarm ? 'text-yellow-600' : 'text-green-600';
    const bgColor = isHot ? 'bg-orange-50 border-orange-200' : isWarm ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200';
    const label = isHot ? 'Lleva mucho tiempo' : isWarm ? 'En sesión' : 'En sesión';

    return (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${bgColor} ${textColor} ${className}`}>
            {/* Pulsing dot */}
            <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${dotColor}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
            </span>
            <span>{label}</span>
            <span className="font-mono font-bold tracking-wider">{formatTime(elapsed)}</span>
        </div>
    );
}
