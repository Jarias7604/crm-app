import { Users, TrendingUp, Calendar, LayoutDashboard, UserPlus, Clock, Phone, FileText, DollarSign, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface QuickAction {
    id: string;
    label: string;
    icon: React.ReactNode;
    color: string;
    bgColor?: string;
    action: () => void;
    shortcut: boolean;
}

interface MobileHomeMenuProps {
    onCreateLead: () => void;
    onClose?: () => void;
}

export function MobileHomeMenu({ onCreateLead, onClose }: MobileHomeMenuProps) {
    const [filter, setFilter] = useState<'shortcuts' | 'all'>('shortcuts');
    const navigate = useNavigate();

    const quickActions: QuickAction[] = [
        {
            id: 'new-lead',
            label: 'Nuevo Lead',
            icon: <UserPlus className="w-8 h-8" />,
            color: 'text-green-600',
            action: () => {
                onCreateLead();
            },
            shortcut: true
        },
        {
            id: 'leads',
            label: 'Leads',
            icon: <TrendingUp className="w-8 h-8" />,
            color: 'text-green-600',
            action: () => navigate('/leads'),
            shortcut: true
        },
        {
            id: 'calendar',
            label: 'Calendario',
            icon: <Calendar className="w-8 h-8" />,
            color: 'text-green-600',
            action: () => navigate('/calendar'),
            shortcut: true
        },
        {
            id: 'dashboard',
            label: 'Dashboard',
            icon: <LayoutDashboard className="w-8 h-8" />,
            color: 'text-green-600',
            action: () => navigate('/dashboard'),
            shortcut: true
        },
        {
            id: 'cotizaciones',
            label: 'Cotizaciones',
            icon: <DollarSign className="w-8 h-8" />,
            color: 'text-indigo-600',
            bgColor: 'bg-indigo-50',
            action: () => navigate('/cotizaciones'),
            shortcut: true
        },
        {
            id: 'team',
            label: 'Equipo',
            icon: <Users className="w-8 h-8" />,
            color: 'text-green-600',
            action: () => navigate('/company/team'),
            shortcut: true
        },
        {
            id: 'follow-ups',
            label: 'Seguimientos',
            icon: <Clock className="w-8 h-8" />,
            color: 'text-green-600',
            action: () => navigate('/leads'),
            shortcut: true
        },
        {
            id: 'contacts',
            label: 'Contactar',
            icon: <Phone className="w-8 h-8" />,
            color: 'text-green-600',
            action: () => navigate('/leads'),
            shortcut: false
        },
        {
            id: 'reports',
            label: 'Reportes',
            icon: <FileText className="w-8 h-8" />,
            color: 'text-green-600',
            action: () => navigate('/dashboard'),
            shortcut: false
        }
    ];

    const filteredActions = filter === 'shortcuts'
        ? quickActions.filter(a => a.shortcut)
        : quickActions;

    return (
        <div className="flex flex-col h-full bg-gray-50 -mx-4 -mt-4">
            {/* Header */}
            <div className="bg-white px-4 pt-4 pb-3 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    {onClose ? (
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:scale-90 transition-all"
                        >
                            <X className="w-5 h-5 text-gray-600" />
                        </button>
                    ) : (
                        <div className="w-8" />
                    )}
                    <h2 className="text-lg font-bold text-gray-800">Menú</h2>
                    <div className="w-8"></div>
                </div>

                {/* Filter Pills */}
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={() => setFilter('shortcuts')}
                        className={`px-6 py-2 rounded-full font-semibold text-sm transition-all ${filter === 'shortcuts'
                            ? 'bg-green-500 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600'
                            }`}
                    >
                        Shortcuts
                    </button>
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-6 py-2 rounded-full font-semibold text-sm transition-all ${filter === 'all'
                            ? 'bg-green-500 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600'
                            }`}
                    >
                        All
                    </button>
                </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-2 gap-5 max-w-md mx-auto">
                    {filteredActions.map((action) => (
                        <button
                            key={action.id}
                            onClick={action.action}
                            className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3 active:scale-95 transition-all shadow-sm border border-gray-100"
                        >
                            <div className={`w-16 h-16 rounded-2xl ${action.bgColor || 'bg-green-50'} flex items-center justify-center ${action.color}`}>
                                {action.icon}
                            </div>
                            <span className="text-sm font-semibold text-gray-800 text-center">
                                {action.label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
