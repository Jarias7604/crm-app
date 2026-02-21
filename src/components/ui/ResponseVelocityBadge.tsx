/**
 * ResponseVelocityBadge — F3 of SIA (System for Activity Intelligence)
 *
 * Shows urgent follow-up timing on lead cards and panels.
 * Helps agents and managers spot overdue / hot leads at a glance.
 *
 * Badge states:
 *   🔴 "Vencido Xd" — follow-up is overdue by X days
 *   🟠 "Vencido"    — overdue by <1 day (same-day miss)
 *   🟡 "Hoy"        — follow-up is scheduled for today
 *   🔵 "Mañana"     — follow-up is tomorrow
 *   (nothing)       — more than 2 days away or no date
 */

interface ResponseVelocityBadgeProps {
    nextFollowupDate: string | null | undefined;
    /** 'pill' = rounded pill (cards), 'inline' = small inline text (detail panel) */
    variant?: 'pill' | 'inline';
    className?: string;
}

function getDaysUntil(dateStr: string): number {
    const now = new Date();
    // Compare at day granularity using local midnight
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(dateStr);
    const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    return Math.round((targetMidnight.getTime() - todayMidnight.getTime()) / 86_400_000);
}

export function ResponseVelocityBadge({
    nextFollowupDate,
    variant = 'pill',
    className = '',
}: ResponseVelocityBadgeProps) {
    if (!nextFollowupDate) return null;

    const days = getDaysUntil(nextFollowupDate);

    // More than 2 days away → not urgent, don't clutter the UI
    if (days > 2) return null;

    let dot = '';
    let label = '';
    let pillClasses = '';
    let inlineClasses = '';

    if (days < -1) {
        // Overdue by more than 1 day
        dot = '●';
        label = `Vencido ${Math.abs(days)}d`;
        pillClasses = 'bg-red-50 border border-red-200 text-red-600';
        inlineClasses = 'text-red-500';
    } else if (days <= 0) {
        // Overdue today or yesterday
        dot = '●';
        label = 'Vencido';
        pillClasses = 'bg-red-50 border border-red-200 text-red-600';
        inlineClasses = 'text-red-500';
    } else if (days === 1) {
        // Today (days == 0 from midnight perspective means today; days==1 check below)
        dot = '●';
        label = 'Hoy';
        pillClasses = 'bg-yellow-50 border border-yellow-200 text-yellow-700';
        inlineClasses = 'text-yellow-600';
    } else {
        // 2 days
        dot = '●';
        label = 'Mañana';
        pillClasses = 'bg-blue-50 border border-blue-200 text-blue-600';
        inlineClasses = 'text-blue-500';
    }

    if (variant === 'inline') {
        return (
            <span className={`inline-flex items-center gap-1 text-[10px] font-black ${inlineClasses} ${className}`}>
                <span className="text-[8px] animate-pulse">{dot}</span>
                {label}
            </span>
        );
    }

    return (
        <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black ${pillClasses} ${className}`}
        >
            <span className="text-[7px] animate-pulse">{dot}</span>
            {label}
        </span>
    );
}
