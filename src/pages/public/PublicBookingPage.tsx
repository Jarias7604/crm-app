import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { bookingService, type BookingLink } from '../../services/bookingService';
import { Clock, MapPin, ChevronLeft, ChevronRight, Check, Loader2, User, Mail, Phone, Building2, MessageSquare, ArrowLeft, Globe, Calendar as CalIcon } from 'lucide-react';
import { format, isSameDay, startOfDay, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

const DAYS_ES = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

type Step = 'calendar' | 'form' | 'confirmed';

export default function PublicBookingPage() {
    const { slug } = useParams<{ slug: string }>();
    const [link, setLink] = useState<(BookingLink & { company_name?: string; company_logo?: string }) | null>(null);
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
            const s = bookingService.generateSlots(link.availability, booked, dateStr, link.duration_minutes, link.buffer_minutes);
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
            await bookingService.createAppointment({
                booking_link_id: link.id, company_id: link.company_id, user_id: link.user_id,
                guest_name: form.name, guest_email: form.email,
                guest_phone: form.phone || undefined, guest_company: form.company || undefined,
                notes: form.notes || undefined,
                start_time: start.toISOString(), end_time: end.toISOString(),
                duration_minutes: link.duration_minutes, timezone: link.timezone,
            });
            setStep('confirmed');
        } catch {
            toast.error('Error al agendar. Por favor intenta de nuevo.');
        } finally {
            setSubmitting(false);
        }
    };

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
        return link.availability.some(a => a.day === date.getDay());
    };

    /* ── LOADING ── */
    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
    );

    /* ── NOT FOUND ── */
    if (notFound || !link) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white text-center p-8">
            <CalIcon className="w-12 h-12 text-gray-200 mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-1">Enlace no encontrado</h1>
            <p className="text-gray-400 text-sm">Este enlace de reserva no existe o ha sido desactivado.</p>
        </div>
    );

    const calendarDays = buildCalendarDays();
    const brandColor = link.color || '#0069FF';

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
            {/* ── CONFIRMED ── */}
            {step === 'confirmed' ? (
                <div className="flex-1 flex items-center justify-center p-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center">
                        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
                            <Check className="w-8 h-8 text-green-500" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mb-1">¡Reunión confirmada!</h2>
                        <p className="text-gray-400 text-sm mb-6">Se ha enviado una confirmación a tu correo.</p>
                        <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2.5 mb-6">
                            <div className="flex items-center gap-3 text-sm text-gray-700">
                                <CalIcon className="w-4 h-4 text-gray-400 shrink-0" />
                                <span className="font-medium">{selectedDate && format(selectedDate, "EEEE dd 'de' MMMM", { locale: es })}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-700">
                                <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                                <span className="font-medium">{selectedSlot && format(new Date(selectedSlot), 'h:mm a')} — {link.duration_minutes} min</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-700">
                                <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                                <span className="font-medium">{link.location}</span>
                            </div>
                        </div>
                        <button onClick={() => { setStep('calendar'); setSelectedDate(null); setSelectedSlot(null); setForm({ name:'',email:'',phone:'',company:'',notes:'' }); }}
                            className="text-sm font-semibold hover:underline" style={{ color: brandColor }}>
                            Agendar otra reunión
                        </button>
                    </div>
                </div>

            ) : step === 'form' ? (
                /* ── FORM ── */
                <div className="flex-1 flex items-center justify-center p-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden max-w-lg w-full">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                            <button onClick={() => setStep('calendar')} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
                                <ArrowLeft className="w-4 h-4 text-gray-500" />
                            </button>
                            <div className="flex-1">
                                <p className="text-xs text-gray-400 font-medium">Confirmar reunión</p>
                                <p className="text-sm font-semibold text-gray-900">
                                    {selectedDate && format(selectedDate, "EEE dd MMM", { locale: es })} · {selectedSlot && format(new Date(selectedSlot), 'h:mm a')} · {link.duration_minutes} min
                                </p>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <InputField icon={User} label="Nombre *" placeholder="Tu nombre" value={form.name} onChange={v => setForm(f => ({...f, name: v}))} />
                                <InputField icon={Mail} label="Email *" placeholder="correo@empresa.com" value={form.email} onChange={v => setForm(f => ({...f, email: v}))} type="email" />
                                <InputField icon={Phone} label="Teléfono" placeholder="+503 0000-0000" value={form.phone} onChange={v => setForm(f => ({...f, phone: v}))} />
                                <InputField icon={Building2} label="Empresa" placeholder="Tu empresa" value={form.company} onChange={v => setForm(f => ({...f, company: v}))} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Notas (opcional)</label>
                                <textarea rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none placeholder:text-gray-300"
                                    placeholder="¿De qué quieres hablar?" value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
                            </div>
                            <button onClick={handleSubmit} disabled={!form.name || !form.email || submitting}
                                className="w-full py-3 rounded-full text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                style={{ backgroundColor: brandColor }}>
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Confirmar reunión
                            </button>
                        </div>
                    </div>
                </div>

            ) : (
                /* ── CALENDAR + SLOTS ── */
                <div className="flex-1 flex items-center justify-center p-4 md:p-8">
                    <div className="w-full max-w-[880px]">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="grid grid-cols-1 md:grid-cols-12">

                                {/* LEFT — Agent Info */}
                                <div className="md:col-span-4 p-6 md:p-8 border-b md:border-b-0 md:border-r border-gray-100">
                                    {/* Company Logo */}
                                    {link.company_logo && (
                                        <img src={link.company_logo} alt={link.company_name} className="h-7 w-auto mb-5 object-contain" />
                                    )}

                                    {/* Agent Avatar */}
                                    {link.avatar_url ? (
                                        <img src={link.avatar_url} className="w-14 h-14 rounded-full object-cover mb-4" alt={link.display_name} />
                                    ) : (
                                        <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold mb-4" style={{ backgroundColor: brandColor }}>
                                            {link.display_name.charAt(0).toUpperCase()}
                                        </div>
                                    )}

                                    <p className="text-sm text-gray-500 font-medium">{link.display_name}</p>
                                    <h1 className="text-xl font-bold text-gray-900 mt-1 mb-4 leading-snug">{link.title || 'Reunión'}</h1>

                                    <div className="space-y-2.5">
                                        <div className="flex items-center gap-2.5 text-sm text-gray-500">
                                            <Clock className="w-4 h-4 text-gray-400" />
                                            <span>{link.duration_minutes} min</span>
                                        </div>
                                        <div className="flex items-center gap-2.5 text-sm text-gray-500">
                                            <MapPin className="w-4 h-4 text-gray-400" />
                                            <span>{link.location}</span>
                                        </div>
                                    </div>

                                    {link.description && (
                                        <p className="mt-5 text-sm text-gray-400 leading-relaxed border-t border-gray-100 pt-4">{link.description}</p>
                                    )}
                                </div>

                                {/* CENTER — Calendar */}
                                <div className={`p-6 md:p-8 ${selectedDate ? 'md:col-span-4 border-b md:border-b-0 md:border-r border-gray-100' : 'md:col-span-8'}`}>
                                    <h2 className="text-sm font-semibold text-gray-900 mb-5">Selecciona fecha y hora</h2>

                                    {/* Month navigation */}
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-sm font-semibold text-gray-900">{MONTHS_ES[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
                                        <div className="flex gap-1">
                                            <button onClick={() => setCurrentMonth(m => addMonths(m, -1))} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
                                                <ChevronLeft className="w-4 h-4 text-gray-500" />
                                            </button>
                                            <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
                                                <ChevronRight className="w-4 h-4 text-gray-500" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Day headers */}
                                    <div className="grid grid-cols-7 mb-1">
                                        {DAYS_ES.map(d => (
                                            <div key={d} className="text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-1.5">{d}</div>
                                        ))}
                                    </div>

                                    {/* Day grid */}
                                    <div className="grid grid-cols-7 gap-0.5">
                                        {calendarDays.map((day, i) => {
                                            if (!day) return <div key={`e-${i}`} />;
                                            const available = isAvailableDay(day);
                                            const selected = selectedDate && isSameDay(day, selectedDate);
                                            const today = isSameDay(day, new Date());
                                            return (
                                                <button
                                                    key={day.toISOString()}
                                                    disabled={!available}
                                                    onClick={() => { setSelectedDate(day); setSelectedSlot(null); }}
                                                    className={`w-full aspect-square rounded-full text-sm font-medium transition-all flex items-center justify-center
                                                        ${selected ? 'text-white' : ''}
                                                        ${!selected && available ? 'text-gray-900 hover:bg-blue-50' : ''}
                                                        ${!available ? 'text-gray-200 cursor-default' : ''}
                                                        ${today && !selected ? 'font-bold' : ''}
                                                    `}
                                                    style={selected ? { backgroundColor: brandColor } : {}}
                                                >
                                                    {day.getDate()}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Timezone */}
                                    <div className="flex items-center gap-1.5 mt-5 text-xs text-gray-400">
                                        <Globe className="w-3.5 h-3.5" />
                                        <span>Hora de El Salvador (CST)</span>
                                    </div>
                                </div>

                                {/* RIGHT — Time Slots (only visible when date selected) */}
                                {selectedDate && (
                                    <div className="md:col-span-4 p-6 md:p-8">
                                        <p className="text-sm font-semibold text-gray-900 mb-4">
                                            {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: es })}
                                        </p>

                                        {loadingSlots ? (
                                            <div className="flex items-center justify-center py-16">
                                                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                                            </div>
                                        ) : slots.length === 0 ? (
                                            <div className="text-center py-16">
                                                <p className="text-sm text-gray-400">Sin horarios disponibles</p>
                                                <p className="text-xs text-gray-300 mt-1">Elige otro día</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                                                {slots.map(slot => {
                                                    const active = selectedSlot === slot;
                                                    return (
                                                        <button
                                                            key={slot}
                                                            onClick={() => {
                                                                if (active) setStep('form');
                                                                else setSelectedSlot(slot);
                                                            }}
                                                            className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all border ${
                                                                active
                                                                    ? 'text-white border-transparent shadow-md'
                                                                    : 'border-blue-200 text-blue-600 hover:border-blue-400 bg-white'
                                                            }`}
                                                            style={active ? { backgroundColor: brandColor, borderColor: brandColor } : {}}
                                                        >
                                                            {active ? (
                                                                <span className="flex items-center justify-center gap-2">
                                                                    {format(new Date(slot), 'h:mm a')}
                                                                    <span className="text-xs bg-white/25 px-2 py-0.5 rounded-full font-bold">Confirmar</span>
                                                                </span>
                                                            ) : (
                                                                format(new Date(slot), 'h:mm a')
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <p className="text-center text-[10px] text-gray-300 mt-5 font-medium">
                            Powered by <span className="font-bold text-gray-400">Arias CRM</span>
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ── Reusable Input ── */
function InputField({ icon: Icon, label, placeholder, value, onChange, type = 'text' }: {
    icon: any; label: string; placeholder: string; value: string; onChange: (v: string) => void; type?: string;
}) {
    return (
        <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
            <div className="relative">
                <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <input type={type} className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all placeholder:text-gray-300"
                    placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
            </div>
        </div>
    );
}
