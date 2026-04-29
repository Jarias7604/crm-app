import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../auth/AuthProvider';
import Switch from '../../components/ui/Switch';
import {
    Shield, Plus, Edit2, Trash2, Save, X, Loader2,
    Users, FileText, Calendar, MessageSquare, Megaphone,
    Tag, Package, Layers, CreditCard, XCircle, Building,
    CheckCircle, AlertCircle, ChevronRight
} from 'lucide-react';

// ─── Permission catalog ───────────────────────────────────────────────────────
const ALL_PERMISSIONS = [
    { key: 'leads',          label: 'Leads / Prospectos',    icon: Users,        desc: 'Ver y gestionar leads del pipeline de ventas' },
    { key: 'quotes',         label: 'Cotizaciones',          icon: FileText,     desc: 'Crear y ver cotizaciones de clientes' },
    { key: 'tickets',        label: 'Tickets de Soporte',    icon: CheckCircle,  desc: 'Gestionar tickets y solicitudes de servicio' },
    { key: 'calendar',       label: 'Agenda / Calendario',   icon: Calendar,     desc: 'Ver y crear eventos en la agenda global' },
    { key: 'chat',           label: 'Chat / Mensajes',       icon: MessageSquare,desc: 'Acceder al módulo de mensajería' },
    { key: 'clientes',       label: 'Clientes',              icon: Building,     desc: 'Ver el directorio de clientes activos' },
    { key: 'marketing',      label: 'Marketing Hub',         icon: Megaphone,    desc: 'Campañas, emails y automatizaciones' },
    { key: 'pricing',        label: 'Precios y Tarifas',     icon: Tag,          desc: 'Configurar precios de servicios' },
    { key: 'paquetes',       label: 'Paquetes',              icon: Package,      desc: 'Gestionar paquetes de venta' },
    { key: 'items',          label: 'Catálogo de Items',     icon: Layers,       desc: 'Administrar ítems y productos' },
    { key: 'financial_rules',label: 'Reglas Financieras',    icon: CreditCard,   desc: 'Configurar reglas de pago y crédito' },
    { key: 'loss_reasons',   label: 'Motivos de Pérdida',    icon: XCircle,      desc: 'Administrar razones de cierre perdido' },
    { key: 'dashboard_full', label: 'Dashboard Completo',    icon: Shield,       desc: 'Ver métricas globales y reportes' },
];

interface CustomRole {
    id: string;
    name: string;
    description: string | null;
    base_role: string;
    company_id: string | null;
    is_system: boolean;
    permissions: Record<string, boolean>;
}

const EMPTY_PERMS: Record<string, boolean> = Object.fromEntries(
    ALL_PERMISSIONS.map(p => [p.key, false])
);

const DEFAULT_AGENT_PERMS: Record<string, boolean> = {
    leads: true, quotes: true, tickets: true, calendar: true,
    chat: true, clientes: true, loss_reasons: true,
    marketing: false, pricing: false, paquetes: false,
    items: false, financial_rules: false, dashboard_full: false,
};

export default function RoleManager() {
    const { profile } = useAuth();
    const [roles, setRoles] = useState<CustomRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRole, setSelectedRole] = useState<CustomRole | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [formName, setFormName] = useState('');
    const [formDesc, setFormDesc] = useState('');
    const [formPerms, setFormPerms] = useState<Record<string, boolean>>(EMPTY_PERMS);
    const [usersWithRole, setUsersWithRole] = useState<{ id: string; full_name: string; email: string }[]>([]);

    useEffect(() => {
        if (profile?.company_id) loadRoles();
    }, [profile?.company_id]);

    const loadRoles = async () => {
        if (!profile?.company_id) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('custom_roles')
            .select('*')
            .or(`company_id.eq.${profile.company_id},company_id.eq.00000000-0000-0000-0000-000000000000`)
            .neq('base_role', 'super_admin')
            .order('created_at', { ascending: true });

        if (!error) setRoles((data || []) as CustomRole[]);
        setLoading(false);
    };

    const loadUsersWithRole = async (roleId: string) => {
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('custom_role_id', roleId)
            .eq('company_id', profile!.company_id);
        setUsersWithRole(data || []);
    };

    const openCreate = () => {
        setSelectedRole(null);
        setFormName('');
        setFormDesc('');
        setFormPerms({ ...DEFAULT_AGENT_PERMS });
        setUsersWithRole([]);
        setShowForm(true);
    };

    const openEdit = async (role: CustomRole) => {
        setSelectedRole(role);
        setFormName(role.name);
        setFormDesc(role.description || '');
        const merged = { ...EMPTY_PERMS, ...(role.permissions || {}) };
        setFormPerms(merged);
        setShowForm(true);
        await loadUsersWithRole(role.id);
    };

    const handleToggle = (key: string) => {
        setFormPerms(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSave = async () => {
        if (!formName.trim()) { toast.error('El rol necesita un nombre'); return; }
        if (!profile?.company_id) return;
        setIsSaving(true);
        try {
            if (selectedRole) {
                // UPDATE existing role
                const { error } = await supabase
                    .from('custom_roles')
                    .update({ name: formName.trim(), description: formDesc.trim() || null, permissions: formPerms })
                    .eq('id', selectedRole.id);
                if (error) throw error;

                // Also sync permissions to all profiles using this role
                const { error: profError } = await supabase
                    .from('profiles')
                    .update({ permissions: formPerms })
                    .eq('custom_role_id', selectedRole.id)
                    .eq('company_id', profile.company_id);
                if (profError) console.warn('Profile sync warning:', profError);

                toast.success(`✅ Rol "${formName}" actualizado. ${usersWithRole.length} usuario(s) sincronizado(s).`);
            } else {
                // CREATE new role
                const { data, error } = await supabase
                    .from('custom_roles')
                    .insert({
                        company_id: profile.company_id,
                        name: formName.trim(),
                        description: formDesc.trim() || null,
                        base_role: 'collaborator',
                        is_system: false,
                        permissions: formPerms,
                    })
                    .select()
                    .single();
                if (error) throw error;
                toast.success(`✅ Rol "${formName}" creado exitosamente`);
                setSelectedRole(data as CustomRole);
            }
            await loadRoles();
            setShowForm(false);
        } catch (err: any) {
            toast.error(`Error: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (role: CustomRole) => {
        const users = await supabase
            .from('profiles')
            .select('id')
            .eq('custom_role_id', role.id)
            .eq('company_id', profile!.company_id);
        const count = users.data?.length || 0;
        const msg = count > 0
            ? `Este rol está asignado a ${count} usuario(s). ¿Eliminar de todas formas? Los usuarios quedarán sin rol hasta que les asignes uno nuevo.`
            : `¿Eliminar el rol "${role.name}"?`;
        if (!confirm(msg)) return;
        const { error } = await supabase.from('custom_roles').delete().eq('id', role.id);
        if (error) { toast.error('No se pudo eliminar'); return; }
        toast.success('Rol eliminado');
        if (showForm && selectedRole?.id === role.id) setShowForm(false);
        loadRoles();
    };

    const activeCount = (perms: Record<string, boolean>) =>
        Object.values(perms).filter(Boolean).length;

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
    );

    return (
        <div className="space-y-6">

            {/* ── Header con explicación ────────────────────────────────── */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-3xl border border-indigo-100 p-8">
                <div className="flex items-start justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                                <Shield className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">Perfiles de Acceso</h2>
                                <p className="text-[11px] text-indigo-500 font-bold uppercase tracking-widest">Gestión de Roles del Equipo</p>
                            </div>
                        </div>

                        {/* Instrucciones visuales paso a paso */}
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                            {[
                                { step: '1', color: 'bg-indigo-100 text-indigo-700', text: 'Crea un rol (ej: "Agente de Ventas") y elige qué módulos puede ver' },
                                { step: '2', color: 'bg-blue-100 text-blue-700', text: 'Ve a la lista del equipo, edita un colaborador y asígnale ese rol' },
                                { step: '3', color: 'bg-emerald-100 text-emerald-700', text: 'El colaborador cierra sesión y vuelve a entrar — listo, funciona' },
                            ].map(s => (
                                <div key={s.step} className="flex items-start gap-3 bg-white/60 rounded-2xl p-3 border border-white/80">
                                    <span className={`w-6 h-6 rounded-full ${s.color} flex items-center justify-center text-[11px] font-black shrink-0 mt-0.5`}>{s.step}</span>
                                    <p className="text-[11px] text-gray-600 font-medium leading-snug">{s.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={openCreate}
                        className="h-12 px-6 rounded-2xl bg-indigo-600 text-white font-black text-[11px] uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 active:scale-95 transition-all flex items-center gap-2 shrink-0"
                    >
                        <Plus className="w-4 h-4" />
                        Nuevo Rol
                    </button>
                </div>
            </div>

            {/* ── Lista de roles existentes ─────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {roles.length === 0 ? (
                    <div className="col-span-3 py-16 flex flex-col items-center gap-3 text-gray-300 bg-white rounded-3xl border border-gray-100">
                        <Shield className="w-12 h-12 opacity-20" />
                        <p className="text-[11px] font-black uppercase tracking-widest">No hay roles creados aún</p>
                        <button onClick={openCreate} className="mt-2 px-5 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">
                            Crear primer rol
                        </button>
                    </div>
                ) : roles.map(role => {
                    const count = activeCount(role.permissions || {});
                    const isSelected = selectedRole?.id === role.id && showForm;
                    return (
                        <div key={role.id}
                            className={`bg-white rounded-3xl border p-6 space-y-4 transition-all cursor-pointer hover:shadow-md ${isSelected ? 'border-indigo-300 shadow-md ring-2 ring-indigo-100' : 'border-gray-100 hover:border-indigo-100'}`}
                            onClick={() => openEdit(role)}
                        >
                            {/* Role header */}
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-600' : 'bg-indigo-50'}`}>
                                        <Shield className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-indigo-500'}`} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-black text-gray-900 text-sm uppercase tracking-tight truncate">{role.name}</p>
                                        <p className="text-[10px] text-gray-400 font-medium truncate">{role.description || 'Sin descripción'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={e => { e.stopPropagation(); openEdit(role); }}
                                        className="p-1.5 rounded-lg text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all">
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    {!role.is_system && (
                                        <button onClick={e => { e.stopPropagation(); handleDelete(role); }}
                                            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Permission count bar */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Módulos activos</span>
                                    <span className="text-[11px] font-black text-indigo-600">{count} / {ALL_PERMISSIONS.length}</span>
                                </div>
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                                        style={{ width: `${(count / ALL_PERMISSIONS.length) * 100}%` }} />
                                </div>
                            </div>

                            {/* Active perm chips */}
                            <div className="flex flex-wrap gap-1.5">
                                {ALL_PERMISSIONS.filter(p => role.permissions?.[p.key]).slice(0, 5).map(p => (
                                    <span key={p.key} className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase tracking-wide border border-indigo-100">
                                        {p.label.split(' ')[0]}
                                    </span>
                                ))}
                                {count > 5 && (
                                    <span className="px-2 py-0.5 rounded-lg bg-gray-50 text-gray-400 text-[9px] font-black uppercase tracking-wide border border-gray-100">
                                        +{count - 5} más
                                    </span>
                                )}
                                {count === 0 && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-50 text-red-500 text-[9px] font-black uppercase tracking-wide border border-red-100">
                                        <AlertCircle className="w-2.5 h-2.5" /> Sin permisos
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-1 text-indigo-500 pt-1">
                                <span className="text-[9px] font-black uppercase tracking-widest">Editar permisos</span>
                                <ChevronRight className="w-3 h-3" />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Form de crear/editar ──────────────────────────────────── */}
            {showForm && (
                <div className="bg-white rounded-3xl border border-indigo-100 shadow-xl overflow-hidden">

                    {/* Form header */}
                    <div className="px-8 py-6 bg-gradient-to-r from-indigo-600 to-indigo-700 flex items-center justify-between">
                        <div className="space-y-0.5">
                            <h3 className="text-base font-black text-white uppercase tracking-tight">
                                {selectedRole ? `Editando: ${selectedRole.name}` : 'Crear Nuevo Rol'}
                            </h3>
                            <p className="text-[11px] text-indigo-200 font-medium">
                                {selectedRole
                                    ? `${usersWithRole.length} colaborador(es) con este rol — los cambios aplican inmediatamente`
                                    : 'Define el nombre y elige los módulos que podrá ver este tipo de colaborador'}
                            </p>
                        </div>
                        <button onClick={() => setShowForm(false)}
                            className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-8 space-y-8">

                        {/* Nombre y descripción */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    Nombre del Rol
                                    <span className="text-red-400">*</span>
                                </label>
                                <input
                                    value={formName}
                                    onChange={e => setFormName(e.target.value)}
                                    placeholder="Ej: Agente de Ventas, Soporte Técnico..."
                                    className="w-full h-12 px-4 rounded-2xl border border-gray-200 bg-gray-50 font-bold text-sm text-gray-900 outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all"
                                />
                                <p className="text-[10px] text-gray-400">Este nombre se verá en la lista del equipo</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                    Descripción (opcional)
                                </label>
                                <input
                                    value={formDesc}
                                    onChange={e => setFormDesc(e.target.value)}
                                    placeholder="Ej: Acceso básico para vendedores de campo..."
                                    className="w-full h-12 px-4 rounded-2xl border border-gray-200 bg-gray-50 font-bold text-sm text-gray-900 outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all"
                                />
                                <p className="text-[10px] text-gray-400">Nota interna para recordar para qué sirve este rol</p>
                            </div>
                        </div>

                        {/* Usuarios con este rol */}
                        {usersWithRole.length > 0 && (
                            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
                                <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-[11px] font-black text-amber-700 uppercase tracking-wide mb-1">
                                        {usersWithRole.length} colaborador(es) tienen este rol asignado
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {usersWithRole.map(u => (
                                            <span key={u.id} className="px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-[10px] font-bold text-gray-700">
                                                {u.full_name || u.email}
                                            </span>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-amber-500 mt-2 font-medium">
                                        ⚡ Al guardar, los cambios aplican automáticamente a todos ellos. Deben cerrar sesión y volver a entrar.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Permisos */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-[11px] font-black text-gray-900 uppercase tracking-widest">
                                        Módulos que puede ver este rol
                                    </h4>
                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                        Activa solo los que necesita — menos es más seguro
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setFormPerms(Object.fromEntries(ALL_PERMISSIONS.map(p => [p.key, true])))}
                                        className="px-3 py-1.5 rounded-xl border border-indigo-100 text-indigo-600 text-[9px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all">
                                        Todo ON
                                    </button>
                                    <button
                                        onClick={() => setFormPerms(Object.fromEntries(ALL_PERMISSIONS.map(p => [p.key, false])))}
                                        className="px-3 py-1.5 rounded-xl border border-gray-100 text-gray-400 text-[9px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all">
                                        Todo OFF
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                {ALL_PERMISSIONS.map(({ key, label, icon: Icon, desc }) => {
                                    const on = !!formPerms[key];
                                    return (
                                        <div
                                            key={key}
                                            onClick={() => handleToggle(key)}
                                            className={`group p-4 rounded-2xl border cursor-pointer transition-all select-none
                                                ${on
                                                    ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                                                    : 'bg-gray-50/50 border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors
                                                    ${on ? 'bg-indigo-600 text-white' : 'bg-white text-gray-300 border border-gray-100'}`}>
                                                    <Icon className="w-4 h-4" />
                                                </div>
                                                <Switch
                                                    checked={on}
                                                    onChange={() => handleToggle(key)}
                                                    size="sm"
                                                    colorVariant="blue"
                                                />
                                            </div>
                                            <p className={`text-[11px] font-black uppercase tracking-tight ${on ? 'text-indigo-800' : 'text-gray-400'}`}>
                                                {label}
                                            </p>
                                            <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{desc}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                            <div className="flex items-center gap-2 text-gray-400">
                                <CheckCircle className="w-4 h-4" />
                                <span className="text-[10px] font-bold">
                                    {Object.values(formPerms).filter(Boolean).length} módulo(s) activo(s)
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setShowForm(false)}
                                    className="h-12 px-6 rounded-2xl text-gray-400 hover:text-gray-700 font-black text-[11px] uppercase tracking-widest transition-all">
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving || !formName.trim()}
                                    className="h-12 px-8 rounded-2xl bg-indigo-600 text-white font-black text-[11px] uppercase tracking-widest shadow-lg shadow-indigo-200 hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center gap-2">
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {isSaving ? 'Guardando...' : selectedRole ? 'Guardar Cambios' : 'Crear Rol'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
