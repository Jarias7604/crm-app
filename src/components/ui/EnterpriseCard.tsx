import React from 'react';

interface EnterpriseCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
}

export const EnterpriseCard: React.FC<EnterpriseCardProps> = ({
    children,
    className = '',
    ...props
}) => {
    return (
        <div
            className={`bg-white rounded-lg border border-slate-200 shadow-2xs ${className}`}
            {...props}
        >
            {children}
        </div>
    );
};

interface EnterpriseCardHeaderProps {
    title: string;
    icon?: React.ReactNode;
    badge?: React.ReactNode;
    action?: React.ReactNode;
    className?: string;
}

export const EnterpriseCardHeader: React.FC<EnterpriseCardHeaderProps> = ({
    title,
    icon,
    badge,
    action,
    className = '',
}) => {
    return (
        <div
            className={`bg-slate-50/90 border-b border-slate-200 px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between rounded-t-lg ${className}`}
        >
            <div className="flex items-center gap-2 min-w-0">
                {icon && <span className="text-blue-600 shrink-0">{icon}</span>}
                <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider truncate">
                    {title}
                </h4>
                {badge && <span className="shrink-0">{badge}</span>}
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
};

interface EnterpriseCardContentProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
}

export const EnterpriseCardContent: React.FC<EnterpriseCardContentProps> = ({
    children,
    className = 'p-3 sm:p-4 space-y-3 sm:space-y-4',
    ...props
}) => {
    return (
        <div className={className} {...props}>
            {children}
        </div>
    );
};

interface EnterpriseFieldProps {
    label: string;
    icon?: React.ReactNode;
    actionText?: string;
    onActionClick?: () => void;
    actionBadge?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    required?: boolean;
}

export const EnterpriseField: React.FC<EnterpriseFieldProps> = ({
    label,
    icon,
    actionText,
    onActionClick,
    actionBadge,
    children,
    className = 'space-y-1.5',
    required = false,
}) => {
    return (
        <div className={className}>
            <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    {icon && <span className="text-blue-600 shrink-0">{icon}</span>}
                    <span>{label}</span>
                    {required && <span className="text-rose-500">*</span>}
                </label>
                <div className="flex items-center gap-2">
                    {actionBadge}
                    {actionText && onActionClick && (
                        <button
                            type="button"
                            onClick={onActionClick}
                            className="text-blue-600 hover:text-blue-700 bg-blue-50/80 hover:bg-blue-100 px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
                        >
                            {actionText}
                        </button>
                    )}
                </div>
            </div>
            {children}
        </div>
    );
};
