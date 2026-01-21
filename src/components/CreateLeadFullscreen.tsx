import { X, Plus, User, Phone, Mail, DollarSign, TrendingUp, Clock, Shield } from 'lucide-react';
import { SOURCE_OPTIONS } from '../types';
import type { Lead, LeadStatus, LeadPriority, Profile } from '../types';

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
        <div className="fixed inset-0 z-50 bg-white">
            {/* Header - Compacto */}
            <div className="h-14 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-between px-6 shadow-md">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Plus className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white">Nuevo Lead</h1>
                        <p className="text-xs text-blue-100">Registra una nueva oportunidad de negocio</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    type="button"
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                    <X className="w-5 h-5 text-white" />
                </button>
            </div>

            <form onSubmit={onSubmit} className="h-[calc(100vh-56px)] flex flex-col">
                {/* Content Area */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Side - Form */}
                    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
                        <div className="max-w-4xl mx-auto space-y-4">
                            {/* Contact Information Card */}
                            <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200">
                                <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2 pb-2 border-b border-gray-100">
                                    <User className="w-4 h-4 text-blue-600" />
                                    Información de Contacto
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                            Nombre Contacto *
                                        </label>
                                        <div className="relative">
                                            <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                required
                                                value={formData.name || ''}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                className="w-full pl-9 pr-3 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                                                placeholder="Ej: Juan Pérez"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                            Empresa
                                        </label>
                                        <input
                                            value={formData.company_name || ''}
                                            onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                            className="w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                                            placeholder="Nombre de la empresa"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                            Teléfono
                                        </label>
                                        <div className="relative">
                                            <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                value={formData.phone || ''}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                className="w-full pl-9 pr-3 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                                                placeholder="+503 ..."
                                            />
                                        </div>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                            Email
                                        </label>
                                        <div className="relative">
                                            <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="email"
                                                value={formData.email || ''}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                className="w-full pl-9 pr-3 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                                                placeholder="contacto@empresa.com"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Lead Details Card */}
                            <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200">
                                <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2 pb-2 border-b border-gray-100">
                                    <TrendingUp className="w-4 h-4 text-green-600" />
                                    Detalles del Lead
                                </h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                            Fuente
                                        </label>
                                        <select
                                            value={formData.source || ''}
                                            onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                                            className="w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                                        >
                                            <option value="">Seleccionar...</option>
                                            {SOURCE_OPTIONS.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                            Prioridad
                                        </label>
                                        <select
                                            value={formData.priority || 'medium'}
                                            onChange={(e) => setFormData({ ...formData, priority: e.target.value as LeadPriority })}
                                            className="w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                                        >
                                            <option value="very_high">🔴 Altísima</option>
                                            <option value="high">🟠 Alta</option>
                                            <option value="medium">🟡 Media</option>
                                            <option value="low">⚪ Baja</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                            Estado
                                        </label>
                                        <select
                                            value={formData.status || 'Nuevo lead'}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value as LeadStatus })}
                                            className="w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                                        >
                                            <option value="Nuevo lead">Nuevo lead</option>
                                            <option value="Potencial – En seguimiento">En seguimiento</option>
                                            <option value="Cliente 2025">Cliente 2025</option>
                                            <option value="Cliente 2026">Cliente 2026</option>
                                            <option value="Lead perdido">Perdido</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                                            <DollarSign className="w-3.5 h-3.5 text-green-600" />
                                            Valor Potencial ($)
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.value || ''}
                                            onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                                            className="w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                                            <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                                            Monto de Cierre ($)
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.closing_amount || ''}
                                            onChange={(e) => setFormData({ ...formData, closing_amount: Number(e.target.value) })}
                                            className="w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                                            placeholder="0 si aún no cerró"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Assignment & Follow-up Card */}
                            <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200">
                                <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2 pb-2 border-b border-gray-100">
                                    <Clock className="w-4 h-4 text-purple-600" />
                                    Asignación y Seguimiento
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2 bg-blue-50 p-3.5 rounded-lg border border-blue-200">
                                        <label className="block text-xs font-bold text-blue-700 mb-1.5 flex items-center gap-1">
                                            <Shield className="w-4 h-4" />
                                            Responsable Principal *
                                        </label>
                                        <select
                                            required
                                            value={formData.assigned_to || ''}
                                            onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                                            className="w-full px-3 py-2 rounded-md border border-blue-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white transition-all"
                                        >
                                            <option value="">Seleccionar responsable...</option>
                                            {teamMembers.map(m => (
                                                <option key={m.id} value={m.id}>
                                                    {m.full_name ? `${m.full_name} (${m.email.split('@')[0]})` : m.email}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                            Próximo Seguimiento
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.next_followup_date || ''}
                                            onChange={(e) => setFormData({ ...formData, next_followup_date: e.target.value })}
                                            className="w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                            Seguimiento por
                                        </label>
                                        <select
                                            value={formData.next_followup_assignee || ''}
                                            onChange={(e) => setFormData({ ...formData, next_followup_assignee: e.target.value })}
                                            className="w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                                        >
                                            <option value="">Igual al responsable</option>
                                            {teamMembers.map(m => (
                                                <option key={m.id} value={m.id}>
                                                    {m.full_name ? `${m.full_name} (${m.email.split('@')[0]})` : m.email}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                            Notas próxima acción
                                        </label>
                                        <textarea
                                            value={formData.next_action_notes || ''}
                                            onChange={(e) => setFormData({ ...formData, next_action_notes: e.target.value })}
                                            rows={2}
                                            className="w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none transition-all"
                                            placeholder="¿Qué se debe hacer en el próximo contacto?"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Side - Summary */}
                    <div className="w-72 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-5 text-white shadow-xl">
                        <h3 className="text-base font-bold mb-4 pb-3 border-b border-white/20">Resumen del Lead</h3>
                        <div className="space-y-3">
                            <div className="bg-white/15 rounded-lg p-3 backdrop-blur-md border border-white/20">
                                <p className="text-blue-100 text-[10px] uppercase tracking-wider mb-1.5 font-semibold">Contacto</p>
                                <p className="font-bold text-lg">{formData.name || 'Sin nombre'}</p>
                                {formData.company_name && <p className="text-blue-100 mt-1 text-xs">{formData.company_name}</p>}
                            </div>

                            <div className="bg-white/15 rounded-lg p-3 backdrop-blur-md border border-white/20">
                                <p className="text-blue-100 text-[10px] uppercase tracking-wider mb-1.5 font-semibold">Valor</p>
                                <p className="font-bold text-2xl">${(formData.value || 0).toLocaleString()}</p>
                            </div>

                            <div className="bg-white/15 rounded-lg p-3 backdrop-blur-md border border-white/20">
                                <p className="text-blue-100 text-[10px] uppercase tracking-wider mb-1.5 font-semibold">Prioridad</p>
                                <p className="font-semibold text-sm">
                                    {formData.priority === 'very_high' ? '🔴 Altísima' :
                                        formData.priority === 'high' ? '🟠 Alta' :
                                            formData.priority === 'medium' ? '🟡 Media' : '⚪ Baja'}
                                </p>
                            </div>

                            <div className="bg-white/15 rounded-lg p-3 backdrop-blur-md border border-white/20">
                                <p className="text-blue-100 text-[10px] uppercase tracking-wider mb-1.5 font-semibold">Responsable</p>
                                <p className="font-semibold text-xs">
                                    {formData.assigned_to ?
                                        teamMembers.find(m => m.id === formData.assigned_to)?.full_name ||
                                        teamMembers.find(m => m.id === formData.assigned_to)?.email.split('@')[0] ||
                                        'Seleccionado'
                                        : 'No asignado'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="h-16 bg-white border-t border-gray-200 px-6 flex items-center justify-between shadow-sm">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-400 transition-all text-sm"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className="px-6 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/30 transition-all flex items-center gap-2 text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Crear Lead
                    </button>
                </div>
            </form>
        </div>
    );
}
