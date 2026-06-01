import { useState, useEffect } from 'react';
import { bookingService, type BookingLink } from '../../services/bookingService';
import { useAuth } from '../../auth/AuthProvider';
import {
    Link2, Copy, Check, Clock, Calendar, MapPin,
    Save, Loader2, ExternalLink, Plus, Trash2,
    CopyPlus, ToggleLeft, ToggleRight, ArrowLeft,
    Sliders, Compass
} from 'lucide-react';
import toast from 'react-hot-toast';

const DURATIONS = [15, 30, 45, 60, 90];
const DAYS_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const COLORS = ['#4F46E5', '#7C3AED', '#DB2777', '#059669', '#0891B2', '#D97706', '#DC2626', '#374151'];

const DEFAULT_AVAIL = [1, 2, 3, 4, 5].map(day => ({ day, start: '09:00', end: '17:00' }));

export default function BookingSettings() {
    const { profile } = useAuth();
    const [links, setLinks] = useState<BookingLink[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeMainTab, setActiveMainTab] = useState<'links' | 'appointments'>('links');

    // Editor State
    const [isEditing, setIsEditing] = useState(false);
    const [currentLink, setCurrentLink] = useState<Partial<BookingLink> | null>(null);
    const [slug, setSlug] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [duration, setDuration] = useState(30);
    const [buffer, setBuffer] = useState(10);
    const [maxPerDay, setMaxPerDay] = useState(8);
    const [location, setLocation] = useState('Videollamada (enlace en confirmación)');
    const [color, setColor] = useState('#4F46E5');
    const [isActive, setIsActive] = useState(true);
    const [availability, setAvailability] = useState(DEFAULT_AVAIL);
    const [saving, setSaving] = useState(false);

    const [activeEditorTab, setActiveEditorTab] = useState<'general' | 'availability'>('general');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        loadLinks();
    }, [profile]);

    const loadLinks = async () => {
        setLoading(true);
        try {
            const data = await bookingService.getMyBookingLinks();
            setLinks(data);
            
            // Auto-create a default link if the user has absolutely none
            if (data.length === 0 && profile) {
                const defaultSlug = bookingService.slugify(profile.full_name || 'mi-agenda');
                const defaultLink = await bookingService.upsertBookingLink({
                    slug: defaultSlug,
                    title: 'Reunión de 30 minutos',
                    duration_minutes: 30,
                    buffer_minutes: 10,
                    max_per_day: 8,
                    location: 'Videollamada (enlace en confirmación)',
                    color: '#4F46E5',
                    is_active: true,
                    availability: DEFAULT_AVAIL
                });
                setLinks([defaultLink]);
            }
        } catch (e) {
            console.error('Error loading booking links', e);
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = (linkSlug: string, id: string) => {
        const publicUrl = `${window.location.origin}/book/${linkSlug}`;
        navigator.clipboard.writeText(publicUrl);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
        toast.success('¡Enlace copiado!');
    };

    const handleCreateNew = () => {
        setCurrentLink(null);
        setSlug('');
        setTitle('Nueva Reunión');
        setDescription('');
        setDuration(30);
        setBuffer(10);
        setMaxPerDay(8);
        setLocation('Videollamada (enlace en confirmación)');
        setColor('#4F46E5');
        setIsActive(true);
        setAvailability(DEFAULT_AVAIL);
        setActiveEditorTab('general');
        setIsEditing(true);
    };

    const handleEdit = (linkToEdit: BookingLink) => {
        setCurrentLink(linkToEdit);
        setSlug(linkToEdit.slug);
        setTitle(linkToEdit.title);
        setDescription(linkToEdit.description || '');
        setDuration(linkToEdit.duration_minutes);
        setBuffer(linkToEdit.buffer_minutes);
        setMaxPerDay(linkToEdit.max_per_day);
        setLocation(linkToEdit.location || '');
        setColor(linkToEdit.color);
        setIsActive(linkToEdit.is_active);
        setAvailability(linkToEdit.availability || DEFAULT_AVAIL);
        setActiveEditorTab('general');
        setIsEditing(true);
    };

    const handleDuplicate = async (linkToDup: BookingLink) => {
        const baseSlug = `${linkToDup.slug}-copia`;
        const uniqueSlug = `${baseSlug}-${Math.floor(100 + Math.random() * 900)}`;
        try {
            const duplicated = await bookingService.duplicateBookingLink(linkToDup, uniqueSlug);
            toast.success('¡Reunión duplicada!');
            loadLinks();
            handleEdit(duplicated);
        } catch (e) {
            toast.error('Error al duplicar la reunión');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este tipo de reunión? Los usuarios ya no podrán agendar mediante su enlace.')) return;
        try {
            await bookingService.deleteBookingLink(id);
            toast.success('Tipo de reunión eliminado');
            loadLinks();
        } catch (e) {
            toast.error('Error al eliminar');
        }
    };

    const handleToggleActive = async (linkToToggle: BookingLink) => {
        try {
            const updated = await bookingService.upsertBookingLink({
                id: linkToToggle.id,
                is_active: !linkToToggle.is_active
            });
            toast.success(updated.is_active ? 'Enlace activado' : 'Enlace desactivado');
            setLinks(prev => prev.map(l => l.id === linkToToggle.id ? updated : l));
        } catch (e) {
            toast.error('Error al cambiar estado');
        }
    };

    const handleSave = async () => {
        if (!slug.trim()) { toast.error('El slug es requerido'); return; }
        if (!title.trim()) { toast.error('El título es requerido'); return; }
        
        setSaving(true);
        try {
            await bookingService.upsertBookingLink({
                id: currentLink?.id,
                slug: slug.trim(),
                title: title.trim(),
                description,
                duration_minutes: duration,
                buffer_minutes: buffer,
                max_per_day: maxPerDay,
                location,
                color,
                is_active: isActive,
                availability,
            });
            toast.success('Reunión guardada con éxito ✓');
            setIsEditing(false);
            loadLinks();
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

    if (loading && !isEditing) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        </div>
    );

    // ── VIEW: EDITOR MODE ──
    if (isEditing) {
        const publicUrl = `${window.location.origin}/book/${slug}`;
        return (
            <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in fade-in duration-300">
                {/* Header Editor */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsEditing(false)} className="p-2 rounded-xl hover:bg-gray-50 border border-gray-100 text-gray-500 transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: color }}>
                            <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-gray-900">{currentLink ? 'Editar Tipo de Cita' : 'Nuevo Tipo de Cita'}</h1>
                            <p className="text-xs text-gray-500 font-medium">{title || 'Configura los detalles de tu reunión'}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {currentLink && (
                            <a href={publicUrl} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors">
                                <ExternalLink className="w-3.5 h-3.5" /> Vista previa
                            </a>
                        )}
                        <button onClick={handleSave} disabled={saving}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-black shadow-lg transition-all hover:opacity-90 disabled:opacity-60"
                            style={{ backgroundColor: color }}>
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Guardar Cambios
                        </button>
                    </div>
                </div>

                {/* Editor Tabs */}
                <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-fit">
                    <button onClick={() => setActiveEditorTab('general')}
                        className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${activeEditorTab === 'general' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        ⚙️ General
                    </button>
                    <button onClick={() => setActiveEditorTab('availability')}
                        className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${activeEditorTab === 'availability' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        📅 Disponibilidad
                    </button>
                </div>

                {/* Editor Body */}
                {activeEditorTab === 'general' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* URL / Slug */}
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                            <h3 className="text-xs font-black text-gray-700 uppercase tracking-wider mb-4">🔗 Enlace de Reserva</h3>
                            <div className="flex rounded-xl border border-gray-200 overflow-hidden focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                                <span className="flex items-center px-3 bg-gray-50 text-xs font-bold text-gray-400 border-r border-gray-200 whitespace-nowrap">/book/</span>
                                <input className="flex-1 px-3 py-2.5 text-xs font-bold text-gray-800 outline-none bg-white" placeholder="ej-reunion-demo" value={slug}
                                    onChange={e => setSlug(bookingService.slugify(e.target.value))} />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2">Personaliza el final del enlace. Solo letras minúsculas, números y guiones.</p>
                        </div>

                        {/* Duración */}
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                            <h3 className="text-xs font-black text-gray-700 uppercase tracking-wider mb-4">⏱️ Duración de la Reunión</h3>
                            <div className="grid grid-cols-5 gap-2 mb-4">
                                {DURATIONS.map(d => (
                                    <button key={d} onClick={() => setDuration(d)}
                                        className={`py-2 rounded-xl text-xs font-black transition-all border ${duration === d ? 'text-white border-transparent' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                                        style={duration === d ? { backgroundColor: color } : {}}>
                                        {d}m
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <label className="text-xs font-black text-gray-500 whitespace-nowrap">Buffer entre citas:</label>
                                    <input type="number" min={0} max={60} value={buffer} onChange={e => setBuffer(Number(e.target.value))}
                                        className="w-16 px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-center" />
                                    <span className="text-xs text-gray-400">min</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-black text-gray-500 whitespace-nowrap">Máx. citas al día:</label>
                                    <input type="number" min={1} max={50} value={maxPerDay} onChange={e => setMaxPerDay(Number(e.target.value))}
                                        className="w-14 px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-center" />
                                </div>
                            </div>
                        </div>

                        {/* Título y Descripción */}
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                            <h3 className="text-xs font-black text-gray-700 uppercase tracking-wider mb-4">✏️ Detalles Públicos</h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-1">Nombre del evento *</label>
                                    <input className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                                        placeholder="Ej: Asesoría Técnica de 30 minutos" value={title} onChange={e => setTitle(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-1">Mensaje o descripción (opcional)</label>
                                    <textarea rows={3} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
                                        placeholder="Describe de qué hablarán o qué necesitan preparar para la llamada." value={description} onChange={e => setDescription(e.target.value)} />
                                </div>
                            </div>
                        </div>

                        {/* Apariencia y Ubicación */}
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
                            <h3 className="text-xs font-black text-gray-700 uppercase tracking-wider">🎨 Ubicación y Visualización</h3>
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">Ubicación / Plataforma</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                                    <input className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-800 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                                        value={location} onChange={e => setLocation(e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-2">Color del enlace</label>
                                <div className="flex gap-2 flex-wrap">
                                    {COLORS.map(c => (
                                        <button key={c} onClick={() => setColor(c)}
                                            className={`w-7 h-7 rounded-xl transition-all ${color === c ? 'ring-2 ring-offset-2 scale-110' : 'hover:scale-105'}`}
                                            style={{ backgroundColor: c }} />
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                <span className="text-xs font-bold text-gray-700">¿Este tipo de cita está activo?</span>
                                <button onClick={() => setIsActive(!isActive)}
                                    className={`w-12 h-6 rounded-full transition-all relative ${isActive ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${isActive ? 'left-6' : 'left-0.5'}`} />
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Editor TAB: Availability */
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                        <h3 className="text-sm font-black text-gray-900 mb-1">Horarios para este Tipo de Reunión</h3>
                        <p className="text-xs text-gray-500 mb-6">Personaliza tu disponibilidad para esta cita en particular.</p>
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
                                            <div className="flex items-center gap-2 animate-in slide-in-from-left-2 duration-200">
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
                    </div>
                )}
            </div>
        );
    }

    // ── VIEW: MAIN MANAGER DASHBOARD ──
    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
            {/* Header principal */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                        <Compass className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900">Agenda de Citas & Reuniones</h1>
                        <p className="text-sm text-gray-500 font-medium">Crea diferentes tipos de citas para compartir con prospectos y clientes</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={handleCreateNew}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-black shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all">
                        <Plus className="w-4 h-4" />
                        Nuevo tipo de reunión
                    </button>
                </div>
            </div>

            {/* Selector de pestañas */}
            <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-fit">
                <button onClick={() => setActiveMainTab('links')}
                    className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${activeMainTab === 'links' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    🔗 Mis Enlaces ({links.length})
                </button>
                <button onClick={() => setActiveMainTab('appointments')}
                    className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${activeMainTab === 'appointments' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    📋 Citas Recibidas
                </button>
            </div>

            {/* TAB: Enlaces / Tipos de Cita */}
            {activeMainTab === 'links' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
                    {links.map(item => {
                        const directUrl = `${window.location.origin}/book/${item.slug}`;
                        const isCopied = copiedId === item.id;
                        return (
                            <div key={item.id} className="bg-white rounded-3xl border border-gray-100/80 shadow-sm hover:shadow-xl hover:shadow-gray-100/50 transition-all flex flex-col justify-between overflow-hidden relative group">
                                {/* Barra de color superior */}
                                <div className="h-2 w-full transition-all" style={{ backgroundColor: item.color }} />

                                <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-start gap-2">
                                            <h3 className="font-black text-gray-800 text-sm leading-snug truncate max-w-[80%]" title={item.title}>
                                                {item.title}
                                            </h3>
                                            <button onClick={() => handleToggleActive(item)} title={item.is_active ? 'Desactivar enlace' : 'Activar enlace'} className="shrink-0">
                                                {item.is_active ? (
                                                    <ToggleRight className="w-7 h-7 text-emerald-500" />
                                                ) : (
                                                    <ToggleLeft className="w-7 h-7 text-gray-300" />
                                                )}
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-4 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3.5 h-3.5" style={{ color: item.color }} />
                                                {item.duration_minutes} min
                                            </span>
                                            {item.buffer_minutes > 0 && (
                                                <span className="flex items-center gap-1">
                                                    Buffer: {item.buffer_minutes}m
                                                </span>
                                            )}
                                        </div>

                                        {item.description ? (
                                            <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                                                {item.description}
                                            </p>
                                        ) : (
                                            <p className="text-xs text-gray-300 italic leading-relaxed">
                                                Sin descripción.
                                            </p>
                                        )}
                                    </div>

                                    {/* Link URL banner */}
                                    <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 flex items-center gap-2">
                                        <Link2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                        <span className="text-[10px] font-bold text-gray-500 truncate flex-1">{item.slug}</span>
                                        <button onClick={() => handleCopy(item.slug, item.id)} className={`p-1 rounded transition-all shrink-0 ${isCopied ? 'bg-emerald-500 text-white' : 'text-indigo-600 hover:bg-indigo-50'}`}>
                                            {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Barra de acciones inferior */}
                                <div className="px-6 py-3.5 bg-gray-50/50 border-t border-gray-50 flex items-center justify-between gap-1">
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => handleEdit(item)}
                                            className="px-3 py-1.5 text-[10px] font-black uppercase text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                                            Editar
                                        </button>
                                        <button onClick={() => handleDuplicate(item)} title="Duplicar tipo de cita"
                                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all shrink-0">
                                            <CopyPlus className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(item.id)} title="Eliminar"
                                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all shrink-0">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <a href={directUrl} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200/60 bg-white text-[10px] font-black text-gray-600 hover:bg-gray-50 active:scale-95 transition-all">
                                        <ExternalLink className="w-3 h-3" /> Ver página
                                    </a>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* TAB: Citas recibidas */}
            {activeMainTab === 'appointments' && (
                <AppointmentsTab color="#4F46E5" />
            )}
        </div>
    );
}

function AppointmentsTab({ color }: { color: string }) {
    const [appointments, setAppointments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const from = new Date();
        from.setDate(from.getDate() - 15); // Show more days back in the list
        bookingService.getMyAppointments(from.toISOString()).then(data => {
            setAppointments(data);
            setLoading(false);
        });
    }, []);

    const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
        confirmed: { label: 'Confirmada', color: 'bg-emerald-50 text-emerald-600 border border-emerald-100' },
        cancelled: { label: 'Cancelada', color: 'bg-red-50 text-red-500 border border-red-100' },
        completed: { label: 'Completada', color: 'bg-blue-50 text-blue-600 border border-blue-100' },
        no_show: { label: 'No asistió', color: 'bg-amber-50 text-amber-600 border border-amber-100' },
    };

    if (loading) return <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>;

    if (appointments.length === 0) return (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-16 text-center">
            <Calendar className="w-12 h-12 text-gray-100 mx-auto mb-4" />
            <p className="text-sm font-black text-gray-400">Sin citas recibidas aún</p>
            <p className="text-xs text-gray-300 mt-1">Comparte tus enlaces de reserva en correos y redes sociales para recibir citas.</p>
        </div>
    );

    return (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden animate-in fade-in duration-300">
            <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-base font-black text-gray-900">Mis Citas Recibidas</h3>
                <p className="text-xs text-gray-400">Historial reciente y próximas citas de todos tus enlaces</p>
            </div>
            <div className="divide-y divide-gray-50">
                {appointments.map(appt => {
                    const start = new Date(appt.start_time);
                    const statusCfg = STATUS_CONFIG[appt.status] || STATUS_CONFIG.confirmed;
                    return (
                        <div key={appt.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 hover:bg-gray-50/50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-black text-xs shadow-sm" style={{ backgroundColor: color }}>
                                    {start.getDate()}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-black text-gray-800 flex items-center gap-2">
                                        {appt.guest_name}
                                        {appt.guest_company && (
                                            <span className="text-[10px] font-black uppercase text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                                                {appt.guest_company}
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-xs text-gray-400 truncate flex items-center gap-1.5 mt-0.5">
                                        <span>{appt.guest_email}</span>
                                        {appt.guest_phone && <span>· {appt.guest_phone}</span>}
                                    </p>
                                    {appt.notes && (
                                        <p className="text-[11px] text-gray-400 bg-gray-50 p-2 rounded-lg border border-gray-100 mt-2 max-w-lg leading-relaxed italic">
                                            "{appt.notes}"
                                        </p>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-3 sm:pt-0">
                                <div className="text-left sm:text-right shrink-0">
                                    <p className="text-xs font-black text-gray-700">
                                        {start.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {start.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })} · {appt.duration_minutes}min
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${statusCfg.color}`}>
                                        {statusCfg.label}
                                    </span>
                                    <select
                                        value={appt.status}
                                        onChange={async e => {
                                            await bookingService.updateAppointmentStatus(appt.id, e.target.value as any);
                                            setAppointments(prev => prev.map(a => a.id === appt.id ? { ...a, status: e.target.value } : a));
                                            toast.success('Estado de cita actualizado');
                                        }}
                                        className="text-[10px] font-bold border border-gray-200 rounded-lg px-2 py-1 text-gray-500 outline-none bg-white hover:border-gray-300 transition-colors"
                                    >
                                        <option value="confirmed">Confirmada</option>
                                        <option value="completed">Completada</option>
                                        <option value="no_show">No asistió</option>
                                        <option value="cancelled">Cancelada</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
