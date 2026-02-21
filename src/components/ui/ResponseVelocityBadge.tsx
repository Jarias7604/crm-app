/**
 * ResponseVelocityBadge — F3 of SIA (System for Activity Intelligence)
 *
 * Shows urgent follow-up timing on lead cards and panels.
 * Helps agents and managers spot overdue / hot leads at a glance.
 *
 * Badge states:
 *   🔴 "Vencido Xd" — overdue by X days (days < 0)
 *   🟡 "Hoy"        — follow-up is today (days = 0)
 *   🔵 "Mañana"     — follow-up is tomorrow (days = 1)
 *   (nothing)       — more than 1 day away or no date
 */

interface ResponseVelocityBadgeProps {
    nextFollowupDate: string | null | undefined;
    /** 'pill' = rounded pill (cards), 'inline' = small inline text (detail panel) */
    variant?: 'pill' | 'inline';
    className?: string;
}

/**
 * Returns days until the follow-up date (negative = overdue).
 * Parses dates at local noon to avoid UTC midnight → wrong local day bugs.
 */
function getDaysUntil(dateStr: string): number {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    // Extract YYYY-MM-DD and parse as local noon to avoid TZ off-by-one
    const datePart = dateStr.split('T')[0].split(' ')[0]; // handles "2026-02-19 00:00:00+00" too
    const target = new Date(`${datePart}T12:00:00`);
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

    // More than 1 day away → not urgent, don't clutter the UI
    if (days > 1) return null;

    let dot = '●';
    let label = '';
    let pillClasses = '';
    let inlineClasses = '';

    if (days < 0) {
        // Overdue
        const absDays = Math.abs(days);
        label = absDays > 1 ? `Vencido ${absDays}d` : 'Vencido';
        pillClasses = 'bg-red-50 border border-red-200 text-red-600';
        inlineClasses = 'text-red-500';
    } else if (days === 0) {
        // Today
        label = 'Hoy';
        pillClasses = 'bg-yellow-50 border border-yellow-200 text-yellow-700';
        inlineClasses = 'text-yellow-600';
    } else {
        // Tomorrow (days === 1)
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
