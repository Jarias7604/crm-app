import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { bookingService, type BookingLink } from '../../services/bookingService';
import { Clock, MapPin, ChevronLeft, ChevronRight, Check, Loader2, User, Mail, Phone, Building2, MessageSquare, ArrowLeft, Globe, Calendar as CalIcon, Shield, Video } from 'lucide-react';
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
            if (!l) {
                setNotFound(true);
            } else {
                setLink(l);
                
                // Auto-select the first available day starting from today
                const today = new Date();
                let targetDate: Date | null = null;
                
                const isAvailableDayLocal = (date: Date) => {
                    const dayOfWeek = date.getDay();
                    const avail = l.availability.some(a => a.day === dayOfWeek);
                    if (!avail) return false;
                    if (startOfDay(date) < startOfDay(new Date())) return false;
                    return true;
                };

                for (let i = 0; i < 30; i++) {
                    const candidate = new Date();
                    candidate.setDate(today.getDate() + i);
                    if (isAvailableDayLocal(candidate)) {
                        targetDate = candidate;
                        break;
                    }
                }
                
                if (targetDate) {
                    setSelectedDate(targetDate);
                    setCurrentMonth(targetDate);
                }
            }
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

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
        </div>
    );

    if (notFound || !link) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white text-center p-8">
            <CalIcon className="w-14 h-14 text-gray-200 mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Enlace no encontrado</h1>
            <p className="text-gray-400">Este enlace de reserva no existe o ha sido desactivado.</p>
        </div>
    );

    const calendarDays = buildCalendarDays();
    const brandColor = link.color || '#0069FF';

    return (
        <div className="min-h-screen bg-white flex flex-col" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>

            {/* ── CONFIRMED ── */}
            {step === 'confirmed' ? (
                <div className="flex-1 flex items-center justify-center p-6">
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12 max-w-md w-full text-center">
                        <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6">
                            <Check className="w-10 h-10 text-green-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Reunión Confirmada!</h2>
                        <p className="text-gray-400 mb-8">Se ha enviado una confirmación a tu correo electrónico.</p>
                        <div className="bg-gray-50 rounded-xl p-5 text-left space-y-3 mb-8">
                            <div className="flex items-center gap-3 text-gray-700">
                                <CalIcon className="w-5 h-5 text-gray-400 shrink-0" />
                                <span className="font-medium">{selectedDate && format(selectedDate, "EEEE dd 'de' MMMM, yyyy", { locale: es })}</span>
                            </div>
                            <div className="flex items-center gap-3 text-gray-700">
                                <Clock className="w-5 h-5 text-gray-400 shrink-0" />
                                <span className="font-medium">{selectedSlot && format(new Date(selectedSlot), 'h:mm a')} — {link.duration_minutes} min</span>
                            </div>
                            <div className="flex items-center gap-3 text-gray-700">
                                <Video className="w-5 h-5 text-gray-400 shrink-0" />
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
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden max-w-xl w-full">
                        <div className="px-8 py-5 border-b border-gray-100 flex items-center gap-4">
                            <button onClick={() => setStep('calendar')} className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
                                <ArrowLeft className="w-4 h-4 text-gray-500" />
                            </button>
                            <div className="flex-1">
                                <p className="text-xs text-gray-400 font-medium">Confirmar tu reunión</p>
                                <p className="text-base font-semibold text-gray-900">
                                    {selectedDate && format(selectedDate, "EEEE dd 'de' MMMM", { locale: es })} · {selectedSlot && format(new Date(selectedSlot), 'h:mm a')}
                                </p>
                            </div>
                        </div>
                        <div className="p-8 space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <InputField icon={User} label="Nombre completo *" placeholder="Tu nombre" value={form.name} onChange={v => setForm(f => ({...f, name: v}))} />
                                <InputField icon={Mail} label="Correo electrónico *" placeholder="correo@empresa.com" value={form.email} onChange={v => setForm(f => ({...f, email: v}))} type="email" />
                                <InputField icon={Phone} label="Teléfono" placeholder="+503 0000-0000" value={form.phone} onChange={v => setForm(f => ({...f, phone: v}))} />
                                <InputField icon={Building2} label="Empresa" placeholder="Nombre de tu empresa" value={form.company} onChange={v => setForm(f => ({...f, company: v}))} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Notas adicionales</label>
                                <textarea rows={3} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-none placeholder:text-gray-300"
                                    placeholder="¿De qué tema quieres hablar en la reunión?" value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
                            </div>
                            <button onClick={handleSubmit} disabled={!form.name || !form.email || submitting}
                                className="w-full py-3.5 rounded-full text-white font-bold text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                style={{ backgroundColor: brandColor }}>
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Confirmar Reunión
                            </button>
                            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-300">
                                <Shield className="w-3 h-3" />
                                <span>Comunicación segura y confidencial</span>
                            </div>
                        </div>
                    </div>
                </div>

            ) : (
                /* ── CALENDAR + SLOTS ── */
                <div className="flex-1 flex items-center justify-center px-4 py-4 md:py-6">
                    <div className="w-full" style={{ maxWidth: '920px' }}>
                        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                            <div className="flex flex-col md:flex-row">

                                {/* LEFT — Agent Info & Branding */}
                                <div className="md:w-[230px] shrink-0 p-5 border-b md:border-b-0 md:border-r border-gray-100 flex flex-col">
                                    {/* Company Logo */}
                                    {link.company_logo ? (
                                        <img src={link.company_logo} alt={link.company_name} className="h-6 w-auto mb-4 object-contain self-start" />
                                    ) : link.company_name ? (
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">{link.company_name}</p>
                                    ) : null}

                                    {/* Agent Photo */}
                                    {link.avatar_url ? (
                                        <img src={link.avatar_url} className="w-14 h-14 rounded-full object-cover mb-3.5 shadow-sm" alt={link.display_name} />
                                    ) : (
                                        <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-3.5 shadow-sm" style={{ backgroundColor: brandColor }}>
                                            {link.display_name.charAt(0).toUpperCase()}
                                        </div>
                                    )}

                                    <p className="text-xs text-gray-400 font-medium">{link.display_name}</p>
                                    <h1 className="text-base font-bold text-gray-900 mt-0.5 leading-snug">
                                        {link.title || `Reunión de ${link.duration_minutes} minutos`}
                                    </h1>

                                    <div className="mt-4 space-y-2">
                                        <div className="flex items-center gap-2.5 text-xs text-gray-500">
                                            <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                                            <span>{link.duration_minutes} min</span>
                                        </div>
                                        <div className="flex items-center gap-2.5 text-xs text-gray-500">
                                            <Video className="w-4 h-4 text-gray-400 shrink-0" />
                                            <span>{link.location}</span>
                                        </div>
                                    </div>

                                    {link.description ? (
                                        <p className="mt-4 text-xs text-gray-400 leading-relaxed border-t border-gray-100 pt-3">
                                            {link.description}
                                        </p>
                                    ) : (
                                        <p className="mt-4 text-xs text-gray-400 leading-relaxed border-t border-gray-100 pt-3">
                                            Agenda una reunión gratuita para discutir tus necesidades. Sin compromisos, sin presión — solo una conversación profesional.
                                        </p>
                                    )}

                                    <div className="mt-auto pt-4">
                                        <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-2.5 flex flex-col gap-1">
                                            <div className="flex items-center gap-1 text-[10px] text-emerald-800 font-black">
                                                <Shield className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                <span>CONEXIÓN 100% SEGURA</span>
                                            </div>
                                            <p className="text-[9px] text-emerald-600 leading-relaxed font-medium">
                                                Portal verificado por Arias CRM. Datos y videollamada cifrados SSL de extremo a extremo.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* CENTER — Calendar */}
                                <div className="flex-1 p-5 md:p-6 border-b md:border-b-0 md:border-r border-gray-100">
                                    <h2 className="text-base font-bold text-gray-900 mb-3">Selecciona fecha y hora</h2>

                                    {/* Month navigation */}
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-sm font-semibold text-gray-900">{MONTHS_ES[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
                                        <div className="flex gap-1">
                                            <button onClick={() => setCurrentMonth(m => addMonths(m, -1))} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
                                                <ChevronLeft className="w-4 h-4 text-gray-400" />
                                            </button>
                                            <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
                                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Day headers */}
                                    <div className="grid grid-cols-7 mb-1.5">
                                        {DAYS_ES.map(d => (
                                            <div key={d} className="text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-1">{d}</div>
                                        ))}
                                    </div>

                                    {/* Day grid */}
                                    <div className="grid grid-cols-7 gap-y-2.5 gap-x-1.5 justify-items-center">
                                        {calendarDays.map((day, i) => {
                                            if (!day) return <div key={`e-${i}`} className="w-9 h-9" />;
                                            const available = isAvailableDay(day);
                                            const selected = selectedDate && isSameDay(day, selectedDate);
                                            const today = isSameDay(day, new Date());
                                            return (
                                                <button
                                                    key={day.toISOString()}
                                                    disabled={!available}
                                                    onClick={() => { setSelectedDate(day); setSelectedSlot(null); }}
                                                    className={`w-9 h-9 rounded-full text-xs transition-all flex items-center justify-center font-bold
                                                        ${selected ? 'text-white' : ''}
                                                        ${!selected && available ? 'text-gray-900 hover:bg-blue-50 cursor-pointer' : ''}
                                                        ${!available ? 'text-gray-200 cursor-default font-normal' : ''}
                                                        ${today && !selected ? 'text-blue-600 border border-blue-100' : ''}
                                                    `}
                                                    style={selected ? { backgroundColor: brandColor } : {}}
                                                >
                                                    {day.getDate()}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Timezone */}
                                    <div className="flex items-center gap-1.5 mt-5 text-[10px] text-gray-400">
                                        <Globe className="w-3.5 h-3.5" />
                                        <span>Hora Central (El Salvador, CST)</span>
                                    </div>
                                </div>

                                {/* RIGHT — Time Slots — always visible */}
                                <div className="md:w-[200px] shrink-0 p-5 flex flex-col justify-start">
                                    {!selectedDate ? (
                                        <div className="flex flex-col items-center justify-center h-full text-center py-16">
                                            <CalIcon className="w-8 h-8 text-gray-100 mb-2" />
                                            <p className="text-xs text-gray-300 font-medium">Selecciona un día</p>
                                            <p className="text-[10px] text-gray-200 mt-0.5">para ver horarios</p>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-sm font-semibold text-gray-900 mb-0.5 capitalize">
                                                {format(selectedDate, "EEEE", { locale: es })}
                                            </p>
                                            <p className="text-xs text-gray-400 mb-3">
                                                {format(selectedDate, "dd 'de' MMMM", { locale: es })}
                                            </p>

                                            {/* Available indicator */}
                                            {slots.length > 0 && !loadingSlots && (
                                                <div className="inline-flex items-center gap-1.5 mb-3 bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-100/50 self-start">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                    <span className="text-[9px] font-black uppercase tracking-wider">disponibles</span>
                                                </div>
                                            )}

                                            {loadingSlots ? (
                                                <div className="flex items-center justify-center py-12">
                                                    <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                                                </div>
                                            ) : slots.length === 0 ? (
                                                <div className="text-center py-12">
                                                    <p className="text-xs text-gray-400 font-medium">Sin horarios</p>
                                                    <p className="text-[10px] text-gray-300 mt-0.5">Elige otro día</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2 max-h-[310px] overflow-y-auto pr-1">
                                                    {slots.map(slot => {
                                                        const active = selectedSlot === slot;
                                                        return (
                                                            <button
                                                                key={slot}
                                                                onClick={() => {
                                                                    if (active) setStep('form');
                                                                    else setSelectedSlot(slot);
                                                                }}
                                                                className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 border ${
                                                                    active
                                                                        ? 'text-white border-transparent shadow-sm bg-emerald-600 font-bold scale-[1.01]'
                                                                        : 'border-emerald-200 text-emerald-700 bg-emerald-50/40 hover:bg-emerald-600 hover:text-white hover:border-transparent'
                                                                }`}
                                                            >
                                                                {active ? (
                                                                    <span className="flex items-center justify-center gap-2">
                                                                        {format(new Date(slot), 'h:mm a')}
                                                                        <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded-full font-bold">Confirmar</span>
                                                                    </span>
                                                                ) : (
                                                                    <span className="flex items-center justify-center gap-1.5">
                                                                        <span className="w-1 h-1 rounded-full bg-emerald-400" />
                                                                        {format(new Date(slot), 'h:mm a')}
                                                                    </span>
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
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">{label}</label>
            <div className="relative">
                <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <input type={type} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all placeholder:text-gray-300"
                    placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
            </div>
        </div>
    );
}
