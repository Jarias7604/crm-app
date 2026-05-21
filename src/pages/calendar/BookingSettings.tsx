import { useState, useEffect } from 'react';
import { bookingService, type BookingLink } from '../../services/bookingService';
import { useAuth } from '../../auth/AuthProvider';
import {
    Link2, Copy, Check, Clock, Calendar, MapPin,
    Save, Loader2, ExternalLink, Users
} from 'lucide-react';
import toast from 'react-hot-toast';

const DURATIONS = [15, 30, 45, 60, 90];
const DAYS_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const COLORS = ['#4F46E5','#7C3AED','#DB2777','#059669','#0891B2','#D97706','#DC2626','#374151'];

const DEFAULT_AVAIL = [1,2,3,4,5].map(day => ({ day, start: '09:00', end: '17:00' }));

export default function BookingSettings() {
    const { profile } = useAuth();
    const [link, setLink] = useState<BookingLink | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);

    // Form state
    const [slug, setSlug] = useState('');
    const [title, setTitle] = useState('Reunión de 30 minutos');
    const [description, setDescription] = useState('');
    const [duration, setDuration] = useState(30);
    const [buffer, setBuffer] = useState(10);
    const [maxPerDay, setMaxPerDay] = useState(8);
    const [location, setLocation] = useState('Videollamada (enlace en confirmación)');
    const [color, setColor] = useState('#4F46E5');
    const [isActive, setIsActive] = useState(true);
    const [availability, setAvailability] = useState(DEFAULT_AVAIL);

    const [activeTab, setActiveTab] = useState<'config' | 'availability' | 'appointments'>('config');

    useEffect(() => {
        bookingService.getMyBookingLink().then(l => {
            if (l) {
                setLink(l);
                setSlug(l.slug);
                setTitle(l.title);
                setDescription(l.description || '');
                setDuration(l.duration_minutes);
                setBuffer(l.buffer_minutes);
                setMaxPerDay(l.max_per_day);
                setLocation(l.location || '');
                setColor(l.color);
                setIsActive(l.is_active);
                setAvailability(l.availability);
            } else if (profile) {
                // Auto-generate slug from name
                setSlug(bookingService.slugify(profile.full_name || 'mi-agenda'));
            }
            setLoading(false);
        });
    }, [profile]);

    const publicUrl = `${window.location.origin}/book/${slug}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(publicUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('¡Enlace copiado!');
    };

    const handleSave = async () => {
        if (!slug.trim()) { toast.error('El slug es requerido'); return; }
        setSaving(true);
        try {
            const saved = await bookingService.upsertBookingLink({
                id: link?.id,
                slug: slug.trim(),
                title,
                description,
                duration_minutes: duration,
                buffer_minutes: buffer,
                max_per_day: maxPerDay,
                location,
                color,
                is_active: isActive,
                availability,
            });
            setLink(saved);
            toast.success('Configuración guardada ✓');
        } catch (e: any) {
            const msg = e?.message?.includes('duplicate') ? 'Ese slug ya está en uso. Elige otro.' : 'Error al guardar';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const toggleDay = (day: number) => {
        setAvailability(prev => {
            const exists = prev.find(a => a.day === day);
            if (exists) return prev.filter(a => a.day !== day);
            return [...prev, { day, start: '09:00', end: '17:00' }].sort((a, b) => a.day - b.day);
        });
    };

    const updateDayHours = (day: number, field: 'start' | 'end', value: string) => {
        setAvailability(prev => prev.map(a => a.day === day ? { ...a, [field]: value } : a));
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: color }}>
                        <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900">Mi Enlace de Reuniones</h1>
                        <p className="text-sm text-gray-500 font-medium">Comparte tu disponibilidad sin ida y vuelta de emails</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {link && (
                        <a href={publicUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" /> Vista previa
                        </a>
                    )}
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-black shadow-lg transition-all hover:opacity-90 hover:-translate-y-0.5 disabled:opacity-60"
                        style={{ backgroundColor: color }}>
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Guardar
                    </button>
                </div>
            </div>

            {/* Public URL Banner */}
            {link && (
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-4 flex items-center gap-3">
                    <Link2 className="w-5 h-5 text-indigo-500 shrink-0" />
                    <p className="text-sm font-bold text-indigo-700 flex-1 truncate">{publicUrl}</p>
                    <button onClick={handleCopy} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-indigo-500 text-white hover:bg-indigo-600'}`}>
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Copiado' : 'Copiar'}
                    </button>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-fit">
                {([['config','⚙️ General'], ['availability','📅 Disponibilidad'], ['appointments','📋 Citas']] as const).map(([tab, label]) => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        {label}
                    </button>
                ))}
            </div>

            {/* TAB: General Config */}
            {activeTab === 'config' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Slug */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                        <h3 className="text-sm font-black text-gray-700 uppercase tracking-wider mb-4">🔗 URL de tu Enlace</h3>
                        <div className="flex rounded-xl border border-gray-200 overflow-hidden focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                            <span className="flex items-center px-3 bg-gray-50 text-xs font-bold text-gray-400 border-r border-gray-200 whitespace-nowrap">/book/</span>
                            <input className="flex-1 px-3 py-2.5 text-sm font-bold text-gray-800 outline-none bg-white" placeholder="tu-nombre" value={slug}
                                onChange={e => setSlug(bookingService.slugify(e.target.value))} />
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Solo letras, números y guiones</p>
                    </div>

                    {/* Duration & Buffer */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                        <h3 className="text-sm font-black text-gray-700 uppercase tracking-wider mb-4">⏱️ Duración</h3>
                        <div className="grid grid-cols-5 gap-2 mb-4">
                            {DURATIONS.map(d => (
                                <button key={d} onClick={() => setDuration(d)}
                                    className={`py-2 rounded-xl text-xs font-black transition-all border ${duration === d ? 'text-white border-transparent' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                                    style={duration === d ? { backgroundColor: color } : {}}>
                                    {d}m
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="text-xs font-black text-gray-500 whitespace-nowrap">Buffer entre citas:</label>
                            <input type="number" min={0} max={60} value={buffer} onChange={e => setBuffer(Number(e.target.value))}
                                className="w-16 px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-center" />
                            <span className="text-xs text-gray-400">min</span>
                        </div>
                    </div>

                    {/* Title & Description */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                        <h3 className="text-sm font-black text-gray-700 uppercase tracking-wider mb-4">✏️ Descripción</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">Título del evento</label>
                                <input className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                                    value={title} onChange={e => setTitle(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">Descripción (opcional)</label>
                                <textarea rows={3} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
                                    placeholder="¿De qué tratará esta reunión?" value={description} onChange={e => setDescription(e.target.value)} />
                            </div>
                        </div>
                    </div>

                    {/* Location & Color & Active */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
                        <h3 className="text-sm font-black text-gray-700 uppercase tracking-wider">🎨 Apariencia y Ubicación</h3>
                        <div>
                            <label className="text-xs font-bold text-gray-400 block mb-1">Lugar / Plataforma</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                                <input className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                                    value={location} onChange={e => setLocation(e.target.value)} />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 block mb-2">Color de tu enlace</label>
                            <div className="flex gap-2 flex-wrap">
                                {COLORS.map(c => (
                                    <button key={c} onClick={() => setColor(c)}
                                        className={`w-8 h-8 rounded-xl transition-all ${color === c ? 'ring-2 ring-offset-2 scale-110' : 'hover:scale-105'}`}
                                        style={{ backgroundColor: c }} />
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                            <span className="text-sm font-bold text-gray-700">Enlace activo</span>
                            <button onClick={() => setIsActive(!isActive)}
                                className={`w-12 h-6 rounded-full transition-all relative ${isActive ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${isActive ? 'left-6' : 'left-0.5'}`} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: Availability */}
            {activeTab === 'availability' && (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-base font-black text-gray-900 mb-1">Horarios de Disponibilidad</h3>
                    <p className="text-sm text-gray-500 mb-6">Define qué días y horas estás disponible para reuniones</p>
                    <div className="space-y-3">
                        {DAYS_LABELS.map((dayLabel, i) => {
                            const avail = availability.find(a => a.day === i);
                            const isOn = !!avail;
                            return (
                                <div key={i} className={`flex items-center gap-4 p-3 rounded-2xl border transition-all ${isOn ? 'border-indigo-100 bg-indigo-50/30' : 'border-gray-100 bg-gray-50/50'}`}>
                                    <button onClick={() => toggleDay(i)}
                                        className={`w-10 h-6 rounded-full transition-all relative shrink-0 ${isOn ? 'bg-indigo-500' : 'bg-gray-200'}`}>
                                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${isOn ? 'left-4' : 'left-0.5'}`} />
                                    </button>
                                    <span className={`w-10 text-xs font-black uppercase tracking-wider ${isOn ? 'text-indigo-700' : 'text-gray-400'}`}>{dayLabel}</span>
                                    {isOn && avail ? (
                                        <div className="flex items-center gap-2">
                                            <input type="time" value={avail.start} onChange={e => updateDayHours(i, 'start', e.target.value)}
                                                className="px-2 py-1 rounded-lg border border-gray-200 text-xs font-bold text-gray-700" />
                                            <span className="text-gray-300 text-xs font-black">→</span>
                                            <input type="time" value={avail.end} onChange={e => updateDayHours(i, 'end', e.target.value)}
                                                className="px-2 py-1 rounded-lg border border-gray-200 text-xs font-bold text-gray-700" />
                                        </div>
                                    ) : (
                                        <span className="text-xs text-gray-300 font-medium">No disponible</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-6 pt-4 border-t border-gray-100">
                        <button onClick={handleSave} disabled={saving}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-black shadow-md transition-all hover:opacity-90"
                            style={{ backgroundColor: color }}>
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Guardar disponibilidad
                        </button>
                    </div>
                </div>
            )}

            {/* TAB: Appointments */}
            {activeTab === 'appointments' && (
                <AppointmentsTab color={color} />
            )}
        </div>
    );
}

function AppointmentsTab({ color }: { color: string }) {
    const [appointments, setAppointments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const from = new Date();
        from.setDate(from.getDate() - 7);
        bookingService.getMyAppointments(from.toISOString()).then(data => {
            setAppointments(data);
            setLoading(false);
        });
    }, []);

    const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
        confirmed: { label: 'Confirmada', color: 'bg-emerald-50 text-emerald-600' },
        cancelled: { label: 'Cancelada',  color: 'bg-red-50 text-red-500' },
        completed: { label: 'Completada', color: 'bg-blue-50 text-blue-600' },
        no_show:   { label: 'No asistió', color: 'bg-amber-50 text-amber-600' },
    };

    if (loading) return <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>;

    if (appointments.length === 0) return (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-16 text-center">
            <Calendar className="w-12 h-12 text-gray-100 mx-auto mb-4" />
            <p className="text-sm font-black text-gray-400">Sin citas aún</p>
            <p className="text-xs text-gray-300 mt-1">Comparte tu enlace de reservas para recibir citas</p>
        </div>
    );

    return (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-base font-black text-gray-900">Mis Citas</h3>
                <p className="text-xs text-gray-400">Últimos 7 días y próximas</p>
            </div>
            <div className="divide-y divide-gray-50">
                {appointments.map(appt => {
                    const start = new Date(appt.start_time);
                    const statusCfg = STATUS_CONFIG[appt.status] || STATUS_CONFIG.confirmed;
                    return (
                        <div key={appt.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-black text-sm" style={{ backgroundColor: color }}>
                                {start.getDate()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-gray-800">{appt.guest_name}</p>
                                <p className="text-xs text-gray-500 truncate">{appt.guest_email}{appt.guest_company ? ` · ${appt.guest_company}` : ''}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-xs font-black text-gray-700">
                                    {start.toLocaleDateString('es', { weekday:'short', day:'numeric', month:'short' })}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {start.toLocaleTimeString('es', { hour:'2-digit', minute:'2-digit' })} · {appt.duration_minutes}min
                                </p>
                            </div>
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${statusCfg.color}`}>
                                {statusCfg.label}
                            </span>
                            <select
                                value={appt.status}
                                onChange={async e => {
                                    await bookingService.updateAppointmentStatus(appt.id, e.target.value as any);
                                    setAppointments(prev => prev.map(a => a.id === appt.id ? { ...a, status: e.target.value } : a));
                                    toast.success('Estado actualizado');
                                }}
                                className="text-[10px] font-bold border border-gray-200 rounded-lg px-2 py-1 text-gray-500 outline-none"
                            >
                                <option value="confirmed">Confirmada</option>
                                <option value="completed">Completada</option>
                                <option value="no_show">No asistió</option>
                                <option value="cancelled">Cancelada</option>
                            </select>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
