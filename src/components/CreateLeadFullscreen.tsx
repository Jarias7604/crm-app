import { useState, useRef, useEffect } from 'react';
import { X, Plus, Building2, Phone, MapPin, DollarSign, Globe, UserCheck, StickyNote, ChevronDown, CheckCircle, Mail } from 'lucide-react';
import type { Lead, LeadStatus, LeadPriority, Profile } from '../types';
import { STATUS_CONFIG, SOURCE_CONFIG, PRIORITY_CONFIG } from '../types';
import { CustomDatePicker } from './ui/CustomDatePicker';
import { format } from 'date-fns';

interface CreateLeadFullscreenProps {
    isOpen: boolean;
    onClose: () => void;
    formData: Partial<Lead>;
    setFormData: (data: Partial<Lead>) => void;
    teamMembers: Profile[];
    onSubmit: (e: React.FormEvent) => void;
}

/* ─── Premium Dropdown ─── */
function PremiumSelect({
    value,
    onChange,
    options,
    placeholder,
    icon: Icon
}: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string; icon?: string; color?: string; bgColor?: string }[];
    placeholder: string;
    icon?: any;
}) {
    const [open, setOpen] = useState(false);
    const [openUp, setOpenUp] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const btnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleToggle = () => {
        if (!open && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            setOpenUp(spaceBelow < 280);
        }
        setOpen(!open);
    };

    const selected = options.find(o => o.value === value);

    return (
        <div className="relative" ref={ref}>
            <button
                ref={btnRef}
                type="button"
                onClick={handleToggle}
                className={`w-full h-12 rounded-xl border-2 bg-white px-4 flex items-center justify-between transition-all text-sm ${open ? 'border-indigo-400 ring-4 ring-indigo-50 shadow-md' : 'border-gray-200 hover:border-gray-300 shadow-sm'
                    }`}
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    {Icon && <Icon className="w-4 h-4 text-gray-400 shrink-0" />}
                    {selected ? (
                        <span className="flex items-center gap-2 font-semibold text-gray-800 truncate">
                            {selected.icon && <span className="text-base">{selected.icon}</span>}
                            {selected.label}
                        </span>
                    ) : (
                        <span className="text-gray-400 font-medium">{placeholder}</span>
                    )}
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className={`absolute left-0 right-0 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 py-2 animate-in fade-in duration-200 max-h-60 overflow-y-auto ${openUp ? 'bottom-full mb-2 slide-in-from-bottom-2' : 'top-full mt-2 slide-in-from-top-2'
                    }`}>
                    {options.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors ${value === opt.value
                                ? 'bg-indigo-50 text-indigo-700'
                                : 'text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <span className="flex items-center gap-2.5">
                                {opt.icon && <span className="text-base">{opt.icon}</span>}
                                <span className="font-semibold text-sm">{opt.label}</span>
                            </span>
                            {value === opt.value && <CheckCircle className="w-4 h-4 text-indigo-500" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export function CreateLeadFullscreen({ isOpen, onClose, formData, setFormData, teamMembers, onSubmit }: CreateLeadFullscreenProps) {
    if (!isOpen) return null;

    const today = format(new Date(), 'yyyy-MM-dd');

    const sourceOptions = Object.entries(SOURCE_CONFIG).map(([value, config]) => ({
        value,
        label: config.label,
        icon: config.icon,
    }));

    const statusOptions = Object.entries(STATUS_CONFIG).map(([value, config]) => ({
        value,
        label: config.label,
        icon: config.icon,
    }));

    const memberOptions = teamMembers.map(m => ({
        value: m.id,
        label: m.full_name || m.email || 'Usuario',
        icon: '👤',
    }));

    return (
        <div className="fixed inset-0 z-[200] animate-in fade-in duration-200">
            {/* Overlay: transparent on mobile, dark on desktop */}
            <div className="absolute inset-0 bg-white md:bg-black/50 md:backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} />

            {/* Container: fullscreen mobile | centered modal desktop */}
            <div className="relative h-full md:h-auto md:max-h-[95vh] md:max-w-[920px] md:mx-auto md:mt-[2.5vh] bg-white md:rounded-2xl md:shadow-2xl flex flex-col overflow-hidden">

                {/* ═══ Header ═══ */}
                <div className="h-14 bg-gradient-to-r from-indigo-600 to-blue-600 flex items-center justify-between px-5 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                            <Plus className="w-4 h-4 text-white" />
                        </div>
                        <h1 className="text-sm font-bold text-white tracking-tight uppercase">Nuevo Prospecto</h1>
                    </div>
                    <button
                        onClick={onClose}
                        type="button"
                        className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                    >
                        <X className="w-4 h-4 text-white" />
                    </button>
                </div>

                <form onSubmit={onSubmit} className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto">

                        {/* ═══════════════════════════════════════════ */}
                        {/* STEP 1: ¿QUIÉN ES? — Lo más importante     */}
                        {/* ═══════════════════════════════════════════ */}
                        <div className="px-5 md:px-8 pt-6 pb-5">
                            <div className="flex items-center gap-2.5 mb-5">
                                <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center">1</div>
                                <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">¿Quién es el contacto?</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                {/* Nombre — PROTAGONISTA */}
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.15em] mb-1.5">
                                        Nombre Completo *
                                    </label>
                                    <input
                                        required
                                        value={formData.name || ''}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full h-13 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 font-semibold text-gray-900 bg-white px-4 shadow-sm outline-none transition-all text-base placeholder:text-gray-300"
                                        placeholder="Ej: María García López"
                                        autoFocus
                                    />
                                </div>

                                {/* Empresa */}
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.15em] mb-1.5">Empresa</label>
                                    <div className="relative">
                                        <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            value={formData.company_name || ''}
                                            onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                            className="w-full h-12 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 font-medium text-gray-700 bg-white pl-11 pr-4 shadow-sm outline-none transition-all text-sm placeholder:text-gray-300"
                                            placeholder="Nombre de la empresa"
                                        />
                                    </div>
                                </div>

                                {/* Teléfono */}
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.15em] mb-1.5">Teléfono</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            value={formData.phone || ''}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            className="w-full h-12 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 font-medium text-gray-700 bg-white pl-11 pr-4 shadow-sm outline-none transition-all text-sm placeholder:text-gray-300"
                                            placeholder="+503 7000-0000"
                                        />
                                    </div>
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.15em] mb-1.5">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="email"
                                            value={formData.email || ''}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full h-12 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 font-medium text-gray-700 bg-white pl-11 pr-4 shadow-sm outline-none transition-all text-sm placeholder:text-gray-300"
                                            placeholder="correo@ejemplo.com"
                                        />
                                    </div>
                                </div>

                                {/* Dirección */}
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.15em] mb-1.5">Dirección</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            value={formData.address || ''}
                                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                            className="w-full h-12 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 font-medium text-gray-700 bg-white pl-11 pr-4 shadow-sm outline-none transition-all text-sm placeholder:text-gray-300"
                                            placeholder="San Salvador, El Salvador"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="mx-5 md:mx-8 border-t border-dashed border-gray-200" />

                        {/* ═══════════════════════════════════════════ */}
                        {/* STEP 2: NEGOCIO — Configuración del deal   */}
                        {/* ═══════════════════════════════════════════ */}
                        <div className="px-5 md:px-8 pt-5 pb-5">
                            <div className="flex items-center gap-2.5 mb-5">
                                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center">2</div>
                                <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">Detalles del Negocio</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-4">
                                {/* Fecha de Ingreso */}
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.15em] mb-1.5">
                                        Fecha de Ingreso
                                    </label>
                                    <CustomDatePicker
                                        value={formData.created_at ? format(new Date(formData.created_at), 'yyyy-MM-dd') : today}
                                        onChange={(date) => {
                                            if (date) {
                                                setFormData({ ...formData, created_at: new Date(`${date}T12:00:00`).toISOString() });
                                            }
                                        }}
                                        variant="light"
                                        className="w-full"
                                    />
                                </div>

                                {/* Valor Pipeline */}
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.15em] mb-1.5">Valor Pipeline ($)</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="number"
                                            value={formData.value || ''}
                                            onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                                            className="w-full h-12 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 font-medium text-gray-700 bg-white pl-11 pr-4 shadow-sm outline-none transition-all text-sm placeholder:text-gray-300"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                {/* Monto de Cierre */}
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.15em] mb-1.5">Monto Cierre ($)</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                                        <input
                                            type="number"
                                            value={formData.closing_amount || ''}
                                            onChange={(e) => setFormData({ ...formData, closing_amount: Number(e.target.value) })}
                                            className="w-full h-12 rounded-xl border-2 border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 font-medium text-gray-700 bg-white pl-11 pr-4 shadow-sm outline-none transition-all text-sm placeholder:text-gray-300"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                {/* Prioridad — Pill buttons premium */}
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.15em] mb-1.5">Temperatura</label>
                                    <div className="grid grid-cols-4 gap-1.5">
                                        {(Object.entries(PRIORITY_CONFIG) as [LeadPriority, { label: string; icon: string; color: string }][]).map(([key, config]) => (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, priority: key })}
                                                className={`h-12 rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all text-xs font-bold ${formData.priority === key
                                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md scale-[1.02]'
                                                    : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:bg-gray-50'
                                                    }`}
                                            >
                                                <span className="text-sm leading-none">{config.icon}</span>
                                                <span className="text-[9px] font-black uppercase">{config.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Fuente — Premium Dropdown */}
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.15em] mb-1.5">Fuente / Origen</label>
                                    <PremiumSelect
                                        value={formData.source || ''}
                                        onChange={(v) => setFormData({ ...formData, source: v })}
                                        options={sourceOptions}
                                        placeholder="Seleccionar fuente..."
                                        icon={Globe}
                                    />
                                </div>

                                {/* Estado — Premium Dropdown */}
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.15em] mb-1.5">Estado</label>
                                    <PremiumSelect
                                        value={formData.status || 'Prospecto'}
                                        onChange={(v) => setFormData({ ...formData, status: v as LeadStatus })}
                                        options={statusOptions}
                                        placeholder="Seleccionar estado..."
                                    />
                                </div>

                                {/* Responsable — Premium Dropdown, spans 2 cols on desktop */}
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.15em] mb-1.5">Responsable Principal *</label>
                                    <PremiumSelect
                                        value={formData.assigned_to || ''}
                                        onChange={(v) => setFormData({ ...formData, assigned_to: v })}
                                        options={memberOptions}
                                        placeholder="Seleccionar responsable..."
                                        icon={UserCheck}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="mx-5 md:mx-8 border-t border-dashed border-gray-200" />

                        {/* ═══════════════════════════════════════════ */}
                        {/* STEP 3: SEGUIMIENTO — Opcional              */}
                        {/* ═══════════════════════════════════════════ */}
                        <div className="px-5 md:px-8 pt-5 pb-6">
                            <div className="flex items-center gap-2.5 mb-5">
                                <div className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-black flex items-center justify-center">3</div>
                                <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">Próximo Seguimiento</h2>
                                <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Opcional</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-4">
                                {/* Fecha */}
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.15em] mb-1.5">Fecha</label>
                                    <CustomDatePicker
                                        value={formData.next_followup_date || ''}
                                        onChange={(date) => setFormData({ ...formData, next_followup_date: date || '' })}
                                        variant="light"
                                        className="w-full"
                                    />
                                </div>

                                {/* Asignado */}
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.15em] mb-1.5">Asignado a</label>
                                    <PremiumSelect
                                        value={formData.next_followup_assignee || ''}
                                        onChange={(v) => setFormData({ ...formData, next_followup_assignee: v })}
                                        options={[{ value: '', label: 'Mismo responsable', icon: '👤' }, ...memberOptions]}
                                        placeholder="Mismo responsable"
                                        icon={UserCheck}
                                    />
                                </div>

                                {/* Notas */}
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.15em] mb-1.5">Notas de acción</label>
                                    <div className="relative">
                                        <StickyNote className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            value={formData.next_action_notes || ''}
                                            onChange={(e) => setFormData({ ...formData, next_action_notes: e.target.value })}
                                            className="w-full h-12 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 font-medium text-gray-700 bg-white pl-11 pr-4 shadow-sm outline-none transition-all text-sm placeholder:text-gray-300"
                                            placeholder="Llamar para cotizar..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ═══ Footer ═══ */}
                    <div className="px-5 md:px-8 py-4 bg-gray-50 border-t border-gray-100 shrink-0">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 h-11 rounded-xl border-2 border-gray-200 text-gray-500 font-bold text-sm hover:bg-gray-100 transition-all hidden md:block"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="flex-1 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm uppercase tracking-widest shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                CREAR PROSPECTO
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
