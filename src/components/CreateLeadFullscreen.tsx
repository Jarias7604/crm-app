import { X, Plus, User, Mail, Building2, Phone, MapPin, DollarSign, Shield } from 'lucide-react';
import type { Lead, LeadStatus, LeadPriority, Profile } from '../types';
import { STATUS_CONFIG, SOURCE_OPTIONS } from '../types';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { CustomDatePicker } from './ui/CustomDatePicker';

interface CreateLeadFullscreenProps {
    isOpen: boolean;
    onClose: () => void;
    formData: Partial<Lead>;
    setFormData: (data: Partial<Lead>) => void;
    teamMembers: Profile[];
    onSubmit: (e: React.FormEvent) => void;
}

export function CreateLeadFullscreen({ isOpen, onClose, formData, setFormData, teamMembers, onSubmit }: CreateLeadFullscreenProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] bg-white flex flex-col animate-in fade-in duration-300">
            {/* Header - Minimalist */}
            <div className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                        <Plus className="w-5 h-5 text-indigo-600" />
                    </div>
                    <h1 className="text-lg font-bold text-indigo-900 tracking-tight">Nuevo Prospecto</h1>
                </div>
                <button
                    onClick={onClose}
                    type="button"
                    className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center"
                >
                    <X className="w-5 h-5 text-gray-400" />
                </button>
            </div>

            <form onSubmit={onSubmit} className="flex-1 flex flex-col overflow-hidden relative">
                {/* Scrollable Form Area */}
                <div className="flex-1 overflow-y-auto px-6 pt-8 pb-32">
                    <div className="max-w-md mx-auto space-y-8">

                        {/* Field: Nombre */}
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] px-1">
                                NOMBRE COMPLETO *
                            </label>
                            <Input
                                required
                                value={formData.name || ''}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="h-14 rounded-2xl border-gray-200 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-gray-700 bg-white shadow-sm"
                                placeholder="Nombre completo del contacto"
                            />
                        </div>

                        {/* Field: Empresa */}
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] px-1">
                                EMPRESA
                            </label>
                            <Input
                                value={formData.company_name || ''}
                                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                className="h-14 rounded-2xl border-gray-200 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-gray-700 bg-white shadow-sm"
                                placeholder="Nombre de la empresa"
                            />
                        </div>

                        {/* Field: Teléfono */}
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] px-1">
                                TELÉFONO
                            </label>
                            <Input
                                value={formData.phone || ''}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="h-14 rounded-2xl border-gray-200 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-gray-700 bg-white shadow-sm"
                                placeholder="Ej: +503 7000-0000"
                            />
                        </div>

                        {/* Field: Email */}
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] px-1">
                                EMAIL
                            </label>
                            <Input
                                type="email"
                                value={formData.email || ''}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="h-14 rounded-2xl border-gray-200 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-gray-700 bg-white shadow-sm"
                                placeholder="correo@ejemplo.com"
                            />
                        </div>

                        {/* Advanced Fields - Still simplified but available */}
                        <div className="pt-4 space-y-8">
                            {/* Valor y Moneda */}
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] px-1">
                                    Valor del Negocio ($)
                                </label>
                                <Input
                                    type="number"
                                    value={formData.value || ''}
                                    onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                                    className="h-14 rounded-2xl border-gray-200 focus:ring-indigo-500 font-medium text-gray-700 bg-white shadow-sm"
                                    placeholder="0.00"
                                />
                            </div>

                            {/* Asignación */}
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] px-1">
                                    Responsable Principal *
                                </label>
                                <select
                                    required
                                    value={formData.assigned_to || ''}
                                    onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                                    className="w-full h-14 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 font-medium text-gray-700 bg-white px-4 shadow-sm outline-none"
                                >
                                    <option value="">Seleccionar responsable...</option>
                                    {teamMembers.map(m => (
                                        <option key={m.id} value={m.id}>
                                            {m.full_name || m.email}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Estado */}
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] px-1">
                                    Estado del Prospecto
                                </label>
                                <select
                                    value={formData.status || 'Prospecto'}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value as LeadStatus })}
                                    className="w-full h-14 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 font-medium text-gray-700 bg-white px-4 shadow-sm outline-none"
                                >
                                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                        <option key={key} value={key}>
                                            {config.icon} {config.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Fixed Footer Button - Vibrant Indigo */}
                <div className="fixed bottom-0 left-0 right-0 p-6 bg-white shrink-0 border-t border-gray-100 pb-safe">
                    <Button
                        type="submit"
                        className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        CREAR PROSPECTO
                    </Button>
                </div>
            </form>
        </div>
    );
}
