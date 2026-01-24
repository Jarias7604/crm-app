import { X, Plus, User, Mail, DollarSign, Shield, Building2, MapPin } from 'lucide-react';
import type { Lead, LeadStatus, LeadPriority, Profile } from '../types';
import { STATUS_CONFIG } from '../types';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

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
        <div className="fixed inset-0 z-50 bg-[#F8FAFC] flex flex-col">
            {/* Header - Modern & Elevated */}
            <div className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-8 shadow-sm relative z-10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Plus className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Nuevo Lead</h1>
                        <p className="text-sm text-gray-500 font-medium font-serif">Registra una nueva oportunidad estratégica</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    type="button"
                    className="w-10 h-10 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-all group border border-gray-100"
                >
                    <X className="w-5 h-5 text-gray-400 group-hover:text-gray-900 transition-colors" />
                </button>
            </div>

            <form onSubmit={onSubmit} className="flex-1 flex overflow-hidden">
                {/* Content Area */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Side - Form Container */}
                    <div className="flex-1 overflow-y-auto p-10">
                        <div className="max-w-4xl mx-auto space-y-10">
                            {/* Contact Information Group */}
                            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/40 space-y-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                        <User className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Información de Contacto</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2 px-1">Nombre Completo del Contacto *</label>
                                        <div className="relative">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                            <Input
                                                required
                                                value={formData.name || ''}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                className="pl-12 h-12 rounded-2xl border-gray-200 focus:ring-blue-500 focus:border-blue-500 font-bold bg-gray-50/30"
                                                placeholder="Ej: Juan Pérez"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2 px-1">Empresa</label>
                                        <div className="relative">
                                            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                            <Input
                                                value={formData.company_name || ''}
                                                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                                className="pl-12 h-12 rounded-2xl border-gray-200 focus:ring-blue-500 focus:border-blue-500 font-bold bg-gray-50/30"
                                                placeholder="Nombre de la institución"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2 px-1">Teléfono</label>
                                        <div className="relative">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">📞</div>
                                            <Input
                                                value={formData.phone || ''}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                className="pl-12 h-12 rounded-2xl border-gray-200 focus:ring-blue-500 focus:border-blue-500 font-bold bg-gray-50/30"
                                                placeholder="+503 7000-0000"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2 px-1">Email Corporativo</label>
                                        <div className="relative">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                            <Input
                                                type="email"
                                                value={formData.email || ''}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                className="pl-12 h-12 rounded-2xl border-gray-200 focus:ring-blue-500 focus:border-blue-500 font-bold bg-gray-50/30"
                                                placeholder="contacto@empresa.com"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2 px-1">Dirección Física</label>
                                        <div className="relative">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">📍</div>
                                            <Input
                                                value={formData.address || ''}
                                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                                className="pl-12 h-12 rounded-2xl border-gray-200 focus:ring-blue-500 focus:border-blue-500 font-bold bg-gray-50/30"
                                                placeholder="Ciudad, Colonia, Calle..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Market Value & Priority Card */}
                            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/40 space-y-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                                        <DollarSign className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Valor de Negocio y Clasificación</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2 px-1">Valor Potencial ($)</label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                                            <Input
                                                type="number"
                                                value={formData.value || ''}
                                                onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                                                className="pl-10 h-12 rounded-2xl border-gray-200 focus:ring-blue-500 font-bold bg-gray-50/30"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2 px-1">Prioridad Estratégica</label>
                                        <select
                                            value={formData.priority || 'medium'}
                                            onChange={(e) => setFormData({ ...formData, priority: e.target.value as LeadPriority })}
                                            className="w-full h-12 rounded-2xl border-gray-200 focus:ring-blue-500 font-bold bg-gray-50/30 px-4 transition-all outline-none"
                                        >
                                            <option value="very_high">🔥 CRÍTICA (Altísima)</option>
                                            <option value="high">⚡ ALTA</option>
                                            <option value="medium">💎 MEDIA</option>
                                            <option value="low">🌊 BAJA</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2 px-1">Estado del Lead</label>
                                        <select
                                            value={formData.status || 'Prospecto'}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value as LeadStatus })}
                                            className="w-full h-12 rounded-2xl border-gray-200 focus:ring-blue-500 font-bold bg-gray-50/30 px-4 transition-all outline-none"
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

                            {/* Assignment & Notes */}
                            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/40 space-y-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                                        <Shield className="w-5 h-5 text-purple-600" />
                                    </div>
                                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Asignación de Cuenta</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2 bg-blue-50/50 p-6 rounded-[2rem] border border-blue-100 space-y-4">
                                        <label className="block text-[10px] font-black text-blue-700 uppercase tracking-[0.2em] mb-2 px-1">Responsable del Registro (Account Manager) *</label>
                                        <select
                                            required
                                            value={formData.assigned_to || ''}
                                            onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                                            className="w-full h-12 rounded-2xl border-blue-200 focus:ring-blue-500 font-bold bg-white px-4 transition-all shadow-sm outline-none"
                                        >
                                            <option value="">Seleccionar responsable...</option>
                                            {teamMembers.map(m => (
                                                <option key={m.id} value={m.id}>
                                                    {m.full_name || m.email}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2 px-1">Notas de la Próxima Estrategia</label>
                                        <textarea
                                            value={formData.next_action_notes || ''}
                                            onChange={(e) => setFormData({ ...formData, next_action_notes: e.target.value })}
                                            rows={3}
                                            className="w-full p-4 rounded-[2rem] border border-gray-200 focus:ring-blue-500 font-medium bg-gray-50/30 text-sm resize-none"
                                            placeholder="Detalla los siguientes pasos de valor para este lead..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Side - Premium Summary Sidebar */}
                    <div className="w-[380px] bg-white border-l border-gray-100 flex flex-col p-8 overflow-y-auto">
                        <div className="flex-1 space-y-6">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest px-1 mb-4 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div>
                                Vista Previa del Perfil
                            </h3>

                            {/* Persona Card */}
                            <div className="bg-gradient-to-br from-[#4449AA] to-[#2A2E6A] p-6 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
                                <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
                                <div className="space-y-6 relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 bg-white/10 backdrop-blur-xl rounded-[1.5rem] flex items-center justify-center border border-white/20 shadow-inner">
                                            <User className="w-8 h-8 text-white select-none opacity-80" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xl font-black leading-tight tracking-tight truncate">{formData.name || 'Empresa ABC'}</p>
                                            <div className="flex flex-col text-[9px] text-blue-100 font-black uppercase tracking-widest mt-1 opacity-70">
                                                {formData.company_name && <span className="truncate">{formData.company_name}</span>}
                                                <span className="flex items-center gap-1.5 mt-0.5">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                                                    Potencial Pipeline
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm border border-white/10">
                                            <p className="text-[8px] font-black text-blue-100 uppercase opacity-60">Valor Potencial</p>
                                            <p className="text-sm font-black mt-0.5">${(formData.value || 0).toLocaleString()}</p>
                                        </div>
                                        <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm border border-white/10">
                                            <p className="text-[8px] font-black text-blue-100 uppercase opacity-60">Prioridad</p>
                                            <p className="text-sm font-black mt-0.5 capitalize">
                                                {formData.priority === 'very_high' ? 'Crítica' :
                                                    formData.priority === 'high' ? 'Alta' :
                                                        formData.priority === 'medium' ? 'Media' : 'Baja'}
                                            </p>
                                        </div>
                                    </div>

                                    {formData.address && (
                                        <div className="bg-white/5 p-3 rounded-2xl border border-white/5 flex items-start gap-2.5">
                                            <MapPin className="w-4 h-4 text-blue-300 mt-0.5" />
                                            <div>
                                                <p className="text-[8px] text-blue-100 font-black uppercase opacity-60">Ubicación</p>
                                                <p className="text-[10px] font-bold leading-relaxed">{formData.address}</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-5 border-t border-white/10 flex items-center justify-between">
                                        <div className="space-y-1">
                                            <p className="text-[8px] text-blue-100 font-black uppercase opacity-50">Email de Contacto</p>
                                            <p className="text-[9px] text-blue-100 font-bold truncate w-32">{formData.email || 'Sin correo asociado'}</p>
                                        </div>
                                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
                                            <Mail className="w-4 h-4 text-blue-300" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Tip/Info Card */}
                            <div className="bg-blue-50/50 p-6 rounded-[2rem] border border-blue-100 space-y-3">
                                <div className="flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-blue-600" />
                                    <p className="text-xs font-black text-blue-900 uppercase tracking-wider">Seguridad y Privacidad</p>
                                </div>
                                <p className="text-[11px] text-blue-700 leading-relaxed font-medium">
                                    Al registrar este lead, se creará una trazabilidad automática. Solo usuarios con los permisos necesarios podrán modificar estos datos sensibles.
                                </p>
                            </div>
                        </div>

                        {/* Sidebar Footer - Buttons */}
                        <div className="mt-auto space-y-3 pt-6 border-t border-gray-100">
                            <Button
                                type="submit"
                                className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-xl shadow-blue-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <Plus className="w-5 h-5" />
                                Crear Estrategia Lead
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                                className="w-full h-14 rounded-2xl border-gray-200 hover:bg-gray-50 font-black text-gray-500 transition-all"
                            >
                                Cancelar
                            </Button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}
