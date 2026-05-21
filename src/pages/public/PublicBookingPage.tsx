import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { bookingService, type BookingLink } from '../../services/bookingService';
import { Calendar, Clock, MapPin, ChevronLeft, ChevronRight, Check, Loader2, User, Mail, Phone, Building2, MessageSquare, ArrowLeft } from 'lucide-react';
import { format, addDays, isSameDay, startOfDay, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

type Step = 'calendar' | 'form' | 'confirmed';

export default function PublicBookingPage() {
    const { slug } = useParams<{ slug: string }>();
    const [link, setLink] = useState<BookingLink | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    const [step, setStep] = useState<Step>('calendar');
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [slots, setSlots] = useState<string[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);

    const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', notes: '' });
    const [submitting, setSubmitting] = useState(false);
    const [confirmedAppt, setConfirmedAppt] = useState<any>(null);

    useEffect(() => {
        if (!slug) return;
        bookingService.getPublicBookingLink(slug).then(l => {
            if (!l) setNotFound(true);
            else setLink(l);
            setLoading(false);
        });
    }, [slug]);

    useEffect(() => {
        if (!link || !selectedDate) return;
        setLoadingSlots(true);
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        bookingService.getBookedSlots(link.id, dateStr).then(booked => {
            const s = bookingService.generateSlots(
                link.availability,
                booked,
                dateStr,
                link.duration_minutes,
                link.buffer_minutes,
            );
            setSlots(s);
            setSelectedSlot(null);
            setLoadingSlots(false);
        });
    }, [link, selectedDate]);

    const handleSubmit = async () => {
        if (!link || !selectedSlot || !form.name || !form.email) return;
        setSubmitting(true);
        try {
            const start = new Date(selectedSlot);
            const end = new Date(start.getTime() + link.duration_minutes * 60000);
            const appt = await bookingService.createAppointment({
                booking_link_id: link.id,
                company_id: link.company_id,
                user_id: link.user_id,
                guest_name: form.name,
                guest_email: form.email,
                guest_phone: form.phone || undefined,
                guest_company: form.company || undefined,
                notes: form.notes || undefined,
                start_time: start.toISOString(),
                end_time: end.toISOString(),
                duration_minutes: link.duration_minutes,
                timezone: link.timezone,
            });
            setConfirmedAppt(appt);
            setStep('confirmed');
        } catch (e: any) {
            toast.error('Error al agendar. Por favor intenta de nuevo.');
        } finally {
            setSubmitting(false);
        }
    };

    // Build calendar grid
    const buildCalendarDays = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const days: (Date | null)[] = [];
        for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
        for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
        return days;
    };

    const isAvailableDay = (date: Date) => {
        if (!link) return false;
        if (startOfDay(date) < startOfDay(new Date())) return false;
        const dow = date.getDay();
        return link.availability.some(a => a.day === dow);
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
    );

    if (notFound || !link) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 text-center p-8">
            <div className="w-20 h-20 bg-slate-200 rounded-3xl flex items-center justify-center mb-6">
                <Calendar className="w-10 h-10 text-slate-400" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">Enlace no encontrado</h1>
            <p className="text-gray-500">Este enlace de reserva no existe o ha sido desactivado.</p>
        </div>
    );

    const calendarDays = buildCalendarDays();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center p-4">
            <div className="w-full max-w-4xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <p className="text-sm font-bold text-indigo-500 uppercase tracking-widest mb-2">Reserva una reunión</p>
                    <h1 className="text-3xl font-black text-gray-900">con {link.display_name}</h1>
                </div>

                {step === 'confirmed' ? (
                    /* ── Confirmation Screen ── */
                    <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-10 max-w-lg mx-auto text-center animate-in fade-in duration-500">
                        <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                            <Check className="w-10 h-10 text-emerald-500" />
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 mb-2">¡Reunión confirmada!</h2>
                        <p className="text-gray-500 mb-6">Hemos enviado los detalles a tu correo.</p>
                        <div className="bg-gray-50 rounded-2xl p-5 text-left space-y-3 mb-6">
                            <div className="flex items-center gap-3">
                                <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
                                <p className="text-sm font-bold text-gray-700">
                                    {selectedDate && format(selectedDate, "EEEE dd 'de' MMMM yyyy", { locale: es })}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
                                <p className="text-sm font-bold text-gray-700">
                                    {selectedSlot && format(new Date(selectedSlot), 'hh:mm a')} · {link.duration_minutes} min
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <MapPin className="w-4 h-4 text-indigo-400 shrink-0" />
                                <p className="text-sm font-bold text-gray-700">{link.location}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => { setStep('calendar'); setSelectedDate(null); setSelectedSlot(null); setForm({ name:'',email:'',phone:'',company:'',notes:'' }); }}
                            className="text-sm font-bold text-indigo-600 hover:underline"
                        >
                            Agendar otra reunión
                        </button>
                    </div>

                ) : step === 'form' ? (
                    /* ── Contact Form ── */
                    <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden animate-in fade-in duration-300">
                        <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                            <button onClick={() => setStep('calendar')} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                                <ArrowLeft className="w-4 h-4 text-gray-600" />
                            </button>
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Confirmar reunión</p>
                                <p className="text-sm font-black text-gray-800">
                                    {selectedDate && format(selectedDate, "EEE dd MMM", { locale: es })} · {selectedSlot && format(new Date(selectedSlot), 'hh:mm a')} · {link.duration_minutes} min
                                </p>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">Nombre *</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                                        <input className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="Tu nombre completo" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">Email *</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                                        <input type="email" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="correo@empresa.com" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">Teléfono</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                                        <input className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="+503 0000-0000" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">Empresa</label>
                                    <div className="relative">
                                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                                        <input className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="Nombre de tu empresa" value={form.company} onChange={e => setForm(f => ({...f, company: e.target.value}))} />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">Notas adicionales</label>
                                <div className="relative">
                                    <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-gray-300" />
                                    <textarea rows={3} className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none" placeholder="¿Algún tema específico que quieras tratar?" value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
                                </div>
                            </div>
                            <button
                                onClick={handleSubmit}
                                disabled={!form.name || !form.email || submitting}
                                style={{ backgroundColor: link.color }}
                                className="w-full py-3.5 rounded-2xl text-white font-black text-sm shadow-lg transition-all hover:opacity-90 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Confirmar reunión
                            </button>
                        </div>
                    </div>

                ) : (
                    /* ── Calendar + Slots ── */
                    <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                        <div className="grid grid-cols-1 md:grid-cols-3">

                            {/* Left: Agent info */}
                            <div className="md:col-span-1 p-6 border-b md:border-b-0 md:border-r border-gray-100 bg-gradient-to-b from-slate-50 to-white">
                                <div className="flex items-center gap-3 mb-5">
                                    {link.avatar_url ? (
                                        <img src={link.avatar_url} className="w-14 h-14 rounded-2xl object-cover shadow-sm" alt={link.display_name} />
                                    ) : (
                                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-sm" style={{ backgroundColor: link.color }}>
                                            {link.display_name.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Reunión con</p>
                                        <h2 className="text-lg font-black text-gray-900 leading-tight">{link.display_name}</h2>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center gap-2.5 text-sm text-gray-600 font-medium">
                                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                                            <Clock className="w-3.5 h-3.5 text-indigo-500" />
                                        </div>
                                        <span>{link.duration_minutes} minutos</span>
                                    </div>
                                    <div className="flex items-center gap-2.5 text-sm text-gray-600 font-medium">
                                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                                            <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                                        </div>
                                        <span>{link.location}</span>
                                    </div>
                                </div>

                                {link.description && (
                                    <p className="mt-5 text-sm text-gray-500 leading-relaxed border-t border-gray-100 pt-4">{link.description}</p>
                                )}
                            </div>

                            {/* Center: Calendar */}
                            <div className="md:col-span-1 p-6 border-b md:border-b-0 md:border-r border-gray-100">
                                {/* Month nav */}
                                <div className="flex items-center justify-between mb-4">
                                    <button onClick={() => setCurrentMonth(m => addMonths(m, -1))} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors">
                                        <ChevronLeft className="w-4 h-4 text-gray-500" />
                                    </button>
                                    <span className="text-sm font-black text-gray-800">{MONTHS_ES[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
                                    <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors">
                                        <ChevronRight className="w-4 h-4 text-gray-500" />
                                    </button>
                                </div>

                                {/* Day headers */}
                                <div className="grid grid-cols-7 mb-2">
                                    {DAYS_ES.map(d => (
                                        <div key={d} className="text-center text-[9px] font-black text-gray-400 uppercase tracking-wider py-1">{d}</div>
                                    ))}
                                </div>

                                {/* Days */}
                                <div className="grid grid-cols-7 gap-0.5">
                                    {calendarDays.map((day, i) => {
                                        if (!day) return <div key={`e-${i}`} />;
                                        const available = isAvailableDay(day);
                                        const isSelected = selectedDate && isSameDay(day, selectedDate);
                                        const isToday = isSameDay(day, new Date());
                                        return (
                                            <button
                                                key={day.toISOString()}
                                                disabled={!available}
                                                onClick={() => { setSelectedDate(day); setSelectedSlot(null); }}
                                                className={`aspect-square rounded-xl text-xs font-bold transition-all flex items-center justify-center
                                                    ${isSelected ? 'text-white shadow-lg scale-105' : ''}
                                                    ${!isSelected && available ? 'hover:bg-indigo-50 text-gray-700' : ''}
                                                    ${!available ? 'text-gray-200 cursor-not-allowed' : ''}
                                                    ${isToday && !isSelected ? 'ring-2 ring-indigo-300 text-indigo-600' : ''}
                                                `}
                                                style={isSelected ? { backgroundColor: link.color } : {}}
                                            >
                                                {day.getDate()}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Right: Time slots */}
                            <div className="md:col-span-1 p-6">
                                {!selectedDate ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center py-10">
                                        <Calendar className="w-10 h-10 text-gray-100 mb-3" />
                                        <p className="text-sm font-bold text-gray-400">Selecciona una fecha disponible</p>
                                    </div>
                                ) : (
                                    <>
                                        <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">
                                            {format(selectedDate, "EEE dd 'de' MMM", { locale: es })}
                                        </p>
                                        {loadingSlots ? (
                                            <div className="flex items-center justify-center py-10">
                                                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                                            </div>
                                        ) : slots.length === 0 ? (
                                            <div className="text-center py-10">
                                                <p className="text-sm font-bold text-gray-400">Sin horarios disponibles</p>
                                                <p className="text-xs text-gray-300 mt-1">Elige otro día</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                                                {slots.map(slot => {
                                                    const isSelected = selectedSlot === slot;
                                                    return (
                                                        <button
                                                            key={slot}
                                                            onClick={() => {
                                                                if (isSelected) {
                                                                    setStep('form');
                                                                } else {
                                                                    setSelectedSlot(slot);
                                                                }
                                                            }}
                                                            className={`w-full py-2.5 rounded-xl text-sm font-black transition-all border ${
                                                                isSelected
                                                                    ? 'text-white shadow-md scale-[1.02] border-transparent'
                                                                    : 'border-gray-200 text-gray-700 hover:border-indigo-300 hover:text-indigo-600'
                                                            }`}
                                                            style={isSelected ? { backgroundColor: link.color, borderColor: link.color } : {}}
                                                        >
                                                            {isSelected ? (
                                                                <span className="flex items-center justify-center gap-2">
                                                                    {format(new Date(slot), 'hh:mm a')}
                                                                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">Confirmar →</span>
                                                                </span>
                                                            ) : (
                                                                format(new Date(slot), 'hh:mm a')
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <p className="text-center text-xs text-gray-300 mt-6 font-medium">
                    Powered by <span className="font-black text-gray-400">Arias CRM</span>
                </p>
            </div>
        </div>
    );
}
