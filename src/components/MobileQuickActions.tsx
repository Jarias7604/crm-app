import { Plus, Users, TrendingUp, Calendar, LayoutDashboard, Phone, FileText, UserPlus, Clock, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface QuickAction {
    id: string;
    label: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
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
            icon: <UserPlus className="w-6 h-6" />,
            color: 'text-green-600',
            bgColor: 'bg-green-50',
            action: () => {
                onCreateLead();
                setIsOpen(false);
            },
            shortcut: true
        },
        {
            id: 'leads',
            label: 'Leads',
            icon: <TrendingUp className="w-6 h-6" />,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
            action: () => {
                navigate('/leads');
                setIsOpen(false);
            },
            shortcut: true
        },
        {
            id: 'calendar',
            label: 'Calendario',
            icon: <Calendar className="w-6 h-6" />,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
            action: () => {
                navigate('/calendar');
                setIsOpen(false);
            },
            shortcut: true
        },
        {
            id: 'dashboard',
            label: 'Dashboard',
            icon: <LayoutDashboard className="w-6 h-6" />,
            color: 'text-indigo-600',
            bgColor: 'bg-indigo-50',
            action: () => {
                navigate('/dashboard');
                setIsOpen(false);
            },
            shortcut: true
        },
        {
            id: 'team',
            label: 'Equipo',
            icon: <Users className="w-6 h-6" />,
            color: 'text-orange-600',
            bgColor: 'bg-orange-50',
            action: () => {
                navigate('/team');
                setIsOpen(false);
            },
            shortcut: false
        },
        {
            id: 'follow-ups',
            label: 'Seguimientos',
            icon: <Clock className="w-6 h-6" />,
            color: 'text-pink-600',
            bgColor: 'bg-pink-50',
            action: () => {
                // Navigate to leads with follow-ups filter
                navigate('/leads');
                setIsOpen(false);
            },
            shortcut: false
        },
        {
            id: 'contacts',
            label: 'Contactar',
            icon: <Phone className="w-6 h-6" />,
            color: 'text-teal-600',
            bgColor: 'bg-teal-50',
            action: () => {
                navigate('/leads');
                setIsOpen(false);
            },
            shortcut: false
        },
        {
            id: 'reports',
            label: 'Reportes',
            icon: <FileText className="w-6 h-6" />,
            color: 'text-amber-600',
            bgColor: 'bg-amber-50',
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
                className="md:hidden fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/40 flex items-center justify-center z-40 active:scale-95 transition-transform"
            >
                <Plus className="w-7 h-7" />
            </button>
        );
    }

    return (
        <div className="md:hidden fixed inset-0 z-50 bg-white">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 shadow-md">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-white">Menú</h2>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilter('shortcuts')}
                        className={`flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition-all ${filter === 'shortcuts'
                                ? 'bg-white text-blue-600 shadow-md'
                                : 'bg-white/20 text-white'
                            }`}
                    >
                        Atajos
                    </button>
                    <button
                        onClick={() => setFilter('all')}
                        className={`flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition-all ${filter === 'all'
                                ? 'bg-white text-blue-600 shadow-md'
                                : 'bg-white/20 text-white'
                            }`}
                    >
                        Todos
                    </button>
                </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="p-6 overflow-y-auto h-[calc(100vh-140px)]">
                <div className="grid grid-cols-2 gap-4">
                    {filteredActions.map((action) => (
                        <button
                            key={action.id}
                            onClick={action.action}
                            className={`${action.bgColor} rounded-xl p-6 flex flex-col items-center gap-3 active:scale-95 transition-all shadow-sm hover:shadow-md`}
                        >
                            <div className={`${action.color}`}>
                                {action.icon}
                            </div>
                            <span className={`text-sm font-semibold ${action.color}`}>
                                {action.label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Bottom Safe Area */}
            <div className="h-6 bg-white"></div>
        </div>
    );
}
