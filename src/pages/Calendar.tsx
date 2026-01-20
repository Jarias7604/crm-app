import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    isSameMonth,
    isSameDay,
    eachDayOfInterval
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Users, Clock } from 'lucide-react';
import { leadsService } from '../services/leads';
import type { Lead } from '../types';

export default function Calendar() {
    const navigate = useNavigate();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const { data } = await leadsService.getLeads(1, 1000); // Get more for calendar
            setLeads(data || []);
        } catch (error) {
            console.error('Error loading leads for calendar:', error);
        } finally {
            setLoading(false);
        }
    };

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    // Helper to parse "YYYY-MM-DD" safely in LOCAL time to avoid UTC shifts
    const parseLocal = (dateStr: string | null) => {
        if (!dateStr) return null;
        const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
        return new Date(year, month - 1, day, 12, 0, 0); // Noon local
    };

    const renderHeader = () => {
        return (
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <CalendarIcon className="w-7 h-7 text-blue-600" />
                        Calendario de Seguimientos
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm text-gray-500">Planifica tus próximas acciones.</p>
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-bold rounded-full border border-blue-100 uppercase tracking-tighter">
                            Hoy: {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-4 bg-white p-2 rounded-xl shadow-sm border border-gray-200">
                    <button
                        onClick={prevMonth}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-lg font-bold text-gray-800 min-w-[150px] text-center capitalize">
                        {format(currentMonth, 'MMMM yyyy', { locale: es })}
                    </span>
                    <button
                        onClick={nextMonth}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
        );
    };

    const renderDays = () => {
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        return (
            <div className="grid grid-cols-7 mb-2">
                {days.map((day) => (
                    <div key={day} className="text-center text-xs font-black text-gray-400 uppercase tracking-widest py-2">
                        {day}
                    </div>
                ))}
            </div>
        );
    };

    const renderCells = () => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        // Force week to start on Sunday (0) to match labels
        const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
        const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

        const days = eachDayOfInterval({ start: startDate, end: endDate });

        return (
            <div className="grid grid-cols-7 bg-gray-200 gap-px rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                {days.map((day) => {
                    // Filter leads for this specific day
                    const dayLeads = leads.filter(lead => {
                        const followupDate = parseLocal(lead.next_followup_date);
                        return followupDate && isSameDay(followupDate, day);
                    });

                    const isCurrentMonth = isSameMonth(day, monthStart);
                    const isToday = isSameDay(day, new Date());

                    return (
                        <div
                            key={day.toString()}
                            className={`min-h-[120px] bg-white p-3 transition-colors ${!isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'text-gray-900'
                                } ${isToday ? 'bg-blue-50/30' : ''}`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-sm font-bold ${isToday ? 'bg-blue-600 text-white w-7 h-7 flex items-center justify-center rounded-full' : ''}`}>
                                    {format(day, 'd')}
                                </span>
                                <span className="text-[8px] text-gray-400 font-bold uppercase">
                                    {format(day, 'EEEE', { locale: es })}
                                </span>
                                {dayLeads.length > 0 && (
                                    <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                                        {dayLeads.length} {dayLeads.length === 1 ? 'Lead' : 'Leads'}
                                    </span>
                                )}
                            </div>

                            <div className="space-y-1">
                                {dayLeads.slice(0, 3).map((lead) => (
                                    <button
                                        key={lead.id}
                                        onClick={() => navigate('/leads')}
                                        className="w-full text-left text-[10px] p-1.5 rounded bg-gray-50 hover:bg-blue-100 hover:text-blue-700 transition-all border border-gray-100 border-l-2 border-l-blue-500 overflow-hidden text-ellipsis whitespace-nowrap block"
                                    >
                                        <span className="font-bold">{lead.name}</span>
                                    </button>
                                ))}
                                {dayLeads.length > 3 && (
                                    <button
                                        onClick={() => navigate('/leads')}
                                        className="text-[9px] text-blue-600 font-bold hover:underline"
                                    >
                                        + {dayLeads.length - 3} más...
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto pb-12">
            {renderHeader()}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                {renderDays()}
                {loading ? (
                    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        <p className="text-gray-500 font-medium">Cargando seguimientos...</p>
                    </div>
                ) : (
                    renderCells()
                )}
            </div>

            {/* Legend / Info */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-blue-600 rounded-2xl p-6 text-white flex items-center gap-4 shadow-lg shadow-blue-200">
                    <div className="bg-blue-500 p-3 rounded-xl">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-blue-100 text-sm">Pendientes Hoy</p>
                        <h3 className="text-2xl font-bold">
                            {leads.filter(l => {
                                const d = parseLocal(l.next_followup_date);
                                return d && isSameDay(d, new Date());
                            }).length}
                        </h3>
                    </div>
                </div>
                <div className="bg-gray-900 rounded-2xl p-6 text-white flex items-center gap-4 shadow-lg shadow-gray-200">
                    <div className="bg-gray-800 p-3 rounded-xl">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-gray-400 text-sm">Total Planificados</p>
                        <h3 className="text-2xl font-bold">
                            {leads.filter(l => l.next_followup_date).length}
                        </h3>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-gray-100 flex items-center gap-4 shadow-sm">
                    <div className="bg-green-100 p-3 rounded-xl text-green-600">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-gray-500 text-sm">Próximo Mes</p>
                        <h3 className="text-2xl font-bold text-gray-900">
                            {leads.filter(l => {
                                const d = parseLocal(l.next_followup_date);
                                return d && isSameMonth(d, addMonths(new Date(), 1));
                            }).length}
                        </h3>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Mock trending icon if not imported correctly from lucide
function TrendingUp({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
        </svg>
    );
}
