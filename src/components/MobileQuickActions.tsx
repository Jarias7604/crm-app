import { Plus, Users, TrendingUp, Calendar, LayoutDashboard, Phone, FileText, UserPlus, Clock, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface QuickAction {
    id: string;
    label: string;
    icon: React.ReactNode;
    color: string;
    action: () => void;
    shortcut: boolean;
}

interface MobileQuickActionsProps {
    onCreateLead: () => void;
}

export function MobileQuickActions({ onCreateLead }: MobileQuickActionsProps) {
    const [isOpen, setIsOpen] = useState(false);
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
                setIsOpen(false);
            },
            shortcut: true
        },
        {
            id: 'leads',
            label: 'Leads',
            icon: <TrendingUp className="w-8 h-8" />,
            color: 'text-green-600',
            action: () => {
                navigate('/leads');
                setIsOpen(false);
            },
            shortcut: true
        },
        {
            id: 'calendar',
            label: 'Calendario',
            icon: <Calendar className="w-8 h-8" />,
            color: 'text-green-600',
            action: () => {
                navigate('/calendar');
                setIsOpen(false);
            },
            shortcut: true
        },
        {
            id: 'dashboard',
            label: 'Dashboard',
            icon: <LayoutDashboard className="w-8 h-8" />,
            color: 'text-green-600',
            action: () => {
                navigate('/dashboard');
                setIsOpen(false);
            },
            shortcut: true
        },
        {
            id: 'team',
            label: 'Equipo',
            icon: <Users className="w-8 h-8" />,
            color: 'text-green-600',
            action: () => {
                navigate('/team');
                setIsOpen(false);
            },
            shortcut: false
        },
        {
            id: 'follow-ups',
            label: 'Seguimientos',
            icon: <Clock className="w-8 h-8" />,
            color: 'text-green-600',
            action: () => {
                navigate('/leads');
                setIsOpen(false);
            },
            shortcut: false
        },
        {
            id: 'contacts',
            label: 'Contactar',
            icon: <Phone className="w-8 h-8" />,
            color: 'text-green-600',
            action: () => {
                navigate('/leads');
                setIsOpen(false);
            },
            shortcut: false
        },
        {
            id: 'reports',
            label: 'Reportes',
            icon: <FileText className="w-8 h-8" />,
            color: 'text-green-600',
            action: () => {
                navigate('/dashboard');
                setIsOpen(false);
            },
            shortcut: false
        }
    ];

    const filteredActions = filter === 'shortcuts'
        ? quickActions.filter(a => a.shortcut)
        : quickActions;

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="md:hidden fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-green-600 text-white shadow-xl shadow-green-500/50 flex items-center justify-center z-40 active:scale-95 transition-all"
            >
                <Plus className="w-7 h-7" />
            </button>
        );
    }

    return (
        <div className="md:hidden fixed inset-0 z-50 bg-gray-50 flex flex-col">
            {/* Header */}
            <div className="bg-white px-4 pt-4 pb-3 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <button
                        onClick={() => setIsOpen(false)}
                        className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                    >
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
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
                            <div className={`w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center ${action.color}`}>
                                {action.icon}
                            </div>
                            <span className="text-sm font-semibold text-gray-800 text-center">
                                {action.label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Bottom Navigation Placeholder */}
            <div className="h-20 bg-white border-t border-gray-200 flex items-center justify-around px-6">
                <button className="flex flex-col items-center gap-1">
                    <LayoutDashboard className="w-6 h-6 text-gray-400" />
                    <span className="text-xs text-gray-500">Dashboard</span>
                </button>
                <button className="flex flex-col items-center gap-1">
                    <TrendingUp className="w-6 h-6 text-gray-400" />
                    <span className="text-xs text-gray-500">Leads</span>
                </button>
                <button className="flex flex-col items-center gap-1">
                    <Calendar className="w-6 h-6 text-gray-400" />
                    <span className="text-xs text-gray-500">Calendar</span>
                </button>
                <button className="flex flex-col items-center gap-1">
                    <Users className="w-6 h-6 text-gray-400" />
                    <span className="text-xs text-gray-500">More</span>
                </button>
            </div>
        </div>
    );
}
