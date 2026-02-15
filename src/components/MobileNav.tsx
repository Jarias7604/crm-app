import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Users, Calendar, Plus } from 'lucide-react';
import { cn } from '../lib/utils';

export default function MobileNav() {
    const location = useLocation();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const tabs = [
        { name: 'Inicio', href: '/', icon: LayoutDashboard, current: location.pathname === '/' },
        { name: t('sidebar.leads'), href: '/leads', icon: Users, current: location.pathname.startsWith('/leads') },
        { name: t('sidebar.calendar'), href: '/calendar', icon: Calendar, current: location.pathname.startsWith('/calendar') },
        {
            name: 'Nuevo',
            isCreate: true,
            icon: Plus,
            current: false
        }
    ];

    return (
        <>
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-[100] pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-around h-18">
                    {tabs.map((tab, idx) => {
                        const isTabActive = tab.current;
                        const Icon = tab.icon!;

                        const content = (
                            <div className={cn(
                                "flex flex-col items-center justify-center py-1 transition-all",
                                isTabActive ? "text-green-600" : "text-gray-400"
                            )}>
                                <Icon className={cn("w-6 h-6 mb-1")} />
                                <span className="text-[10px] font-bold uppercase tracking-tight">{tab.name}</span>
                            </div>
                        );

                        return (
                            <div key={tab.name || idx} className="flex-1 flex justify-center">
                                {tab.isCreate ? (
                                    <button
                                        onClick={() => {
                                            const isOnLeads = location.pathname.startsWith('/leads');
                                            navigate('/leads', {
                                                state: {
                                                    ...(isOnLeads ? location.state : {}),
                                                    openCreateModal: Date.now()
                                                }
                                            });
                                        }}
                                        className="w-full active:scale-90 transition-transform"
                                    >
                                        {content}
                                    </button>
                                ) : (
                                    <Link to={tab.href!} className="w-full text-center">
                                        {content}
                                    </Link>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
}
