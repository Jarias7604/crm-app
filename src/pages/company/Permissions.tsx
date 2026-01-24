import { Shield, Check, X, Info, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { permissionsService, type PermissionDefinition, type RolePermission } from '../../services/permissions';
import Switch from '../../components/ui/Switch';

export default function Permissions() {
    const { profile } = useAuth();
    const [definitions, setDefinitions] = useState<PermissionDefinition[]>([]);
    const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

    const isSuperAdmin = profile?.role === 'super_admin';

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [defs, perms] = await Promise.all([
                permissionsService.getDefinitions(),
                permissionsService.getRolePermissions()
            ]);
            setDefinitions(defs);
            setRolePermissions(perms);
        } catch (error) {
            console.error('Error loading permissions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (role: any, key: string, currentStatus: boolean) => {
        const toggleId = `${role}-${key}`;
        try {
            setSaving(toggleId);
            await permissionsService.updatePermission(role, key, !currentStatus);

            // Update local state
            setRolePermissions(prev => {
                const existing = prev.find(p => p.role === role && p.permission_key === key);
                if (existing) {
                    return prev.map(p => p.role === role && p.permission_key === key ? { ...p, is_enabled: !currentStatus } : p);
                } else {
                    return [...prev, { id: 'temp', role, permission_key: key, is_enabled: !currentStatus }];
                }
            });
        } catch (error) {
            console.error('Error updating permission:', error);
            alert('Error al actualizar el permiso');
        } finally {
            setSaving(null);
        }
    };

    const isEnabled = (role: string, key: string) => {
        // Super Admin SIEMPRE tiene todos los permisos habilitados
        if (role === 'super_admin') {
            return true;
        }
        return rolePermissions.find(p => p.role === role && p.permission_key === key)?.is_enabled ?? false;
    };

    const toggleCategory = (category: string) => {
        setExpandedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(category)) {
                newSet.delete(category);
            } else {
                newSet.add(category);
            }
            return newSet;
        });
    };

    const getCategoryIcon = (category: string) => {
        const icons: Record<string, string> = {
            'Configuración': '⚙️',
            'Equipo': '👥',
            'Leads': '🎯',
            'Seguimientos': '📋',
            'Calendario': '📅',
            'Dashboard': '📊'
        };
        return icons[category] || '📌';
    };

    const getCategoryColor = (category: string): string => {
        const colors: Record<string, string> = {
            'Configuración': 'purple',
            'Equipo': 'blue',
            'Leads': 'green',
            'Seguimientos': 'yellow',
            'Calendario': 'pink',
            'Dashboard': 'indigo'
        };
        return colors[category] || 'gray';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
        );
    }

    // Group definitions by category
    const groupedDefinitions = definitions.reduce((acc, def) => {
        if (!acc[def.category]) acc[def.category] = [];
        acc[def.category].push(def);
        return acc;
    }, {} as Record<string, PermissionDefinition[]>);

    const categories = Object.keys(groupedDefinitions).sort();

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-12">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Shield className="w-7 h-7 text-blue-600" />
                    Roles y Permisos
                </h1>
                <p className="text-gray-500">Sistema de control de acceso detallado por rol. Gestiona qué puede hacer cada nivel de usuario.</p>
            </div>

            {/* Role Descriptions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border-2 border-purple-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-lg">S</div>
                        <h3 className="text-purple-900 font-bold text-lg">Super Admin</h3>
                    </div>
                    <p className="text-sm text-purple-700">Dueño de la plataforma. Control total sobre empresas, licencias y configuración global del sistema.</p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border-2 border-blue-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg">A</div>
                        <h3 className="text-blue-900 font-bold text-lg">Admin Empresa</h3>
                    </div>
                    <p className="text-sm text-blue-700">Dueño del negocio. Gestiona su equipo completo, todos los leads y configuraciones de su empresa.</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border-2 border-green-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-lg">V</div>
                        <h3 className="text-green-900 font-bold text-lg">Agente Ventas</h3>
                    </div>
                    <p className="text-sm text-green-700">Equipo operativo. Enfocado en gestionar y convertir sus leads asignados de forma eficiente.</p>
                </div>
            </div>

            {/* Accordion Permissions Table */}
            <div className="space-y-3">
                {categories.map(category => {
                    const isExpanded = expandedCategories.has(category);
                    const color = getCategoryColor(category);
                    const icon = getCategoryIcon(category);
                    const permissions = groupedDefinitions[category];

                    return (
                        <div key={category} className="bg-white rounded-xl shadow-sm border-2 border-gray-200 overflow-hidden">
                            {/* Category Header (Clickable) */}
                            <button
                                onClick={() => toggleCategory(category)}
                                className={`w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-${color}-50 to-white hover:from-${color}-100 transition-all`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{icon}</span>
                                    <div className="text-left">
                                        <h3 className="text-lg font-bold text-gray-900">{category}</h3>
                                        <p className="text-xs text-gray-500">{permissions.length} permisos configurables</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs font-bold px-3 py-1 rounded-full bg-${color}-100 text-${color}-700`}>
                                        {permissions.length}
                                    </span>
                                    {isExpanded ? (
                                        <ChevronDown className="w-5 h-5 text-gray-400" />
                                    ) : (
                                        <ChevronRight className="w-5 h-5 text-gray-400" />
                                    )}
                                </div>
                            </button>

                            {/* Permissions Table (Collapsible) */}
                            {isExpanded && (
                                <div className="border-t-2 border-gray-100">
                                    <table className="min-w-full">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-1/2">
                                                    Permiso / Acción
                                                </th>
                                                <th className="px-6 py-3 text-center text-xs font-bold text-purple-600 uppercase tracking-wider">
                                                    Super
                                                </th>
                                                <th className="px-6 py-3 text-center text-xs font-bold text-blue-600 uppercase tracking-wider">
                                                    Admin
                                                </th>
                                                <th className="px-6 py-3 text-center text-xs font-bold text-green-600 uppercase tracking-wider">
                                                    Agente
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {permissions.map((perm) => (
                                                <tr key={perm.permission_key} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-2 h-2 rounded-full bg-${color}-500`}></div>
                                                            <span className="text-sm text-gray-700 font-medium">{perm.label}</span>
                                                        </div>
                                                    </td>

                                                    {/* Super Admin Column */}
                                                    <td className="px-6 py-4 text-center">
                                                        {isSuperAdmin ? (
                                                            <div className="flex justify-center">
                                                                <Switch
                                                                    checked={isEnabled('super_admin', perm.permission_key)}
                                                                    onChange={() => handleToggle('super_admin', perm.permission_key, isEnabled('super_admin', perm.permission_key))}
                                                                    disabled={saving === `super_admin-${perm.permission_key}`}
                                                                    size="sm"
                                                                />
                                                            </div>
                                                        ) : (
                                                            isEnabled('super_admin', perm.permission_key) ?
                                                                <Check className="w-5 h-5 text-green-500 mx-auto" strokeWidth={3} /> :
                                                                <X className="w-5 h-5 text-gray-300 mx-auto" />
                                                        )}
                                                    </td>

                                                    {/* Admin Column */}
                                                    <td className="px-6 py-4 text-center">
                                                        {isSuperAdmin ? (
                                                            <div className="flex justify-center">
                                                                <Switch
                                                                    checked={isEnabled('company_admin', perm.permission_key)}
                                                                    onChange={() => handleToggle('company_admin', perm.permission_key, isEnabled('company_admin', perm.permission_key))}
                                                                    disabled={saving === `company_admin-${perm.permission_key}`}
                                                                    size="sm"
                                                                />
                                                            </div>
                                                        ) : (
                                                            isEnabled('company_admin', perm.permission_key) ?
                                                                <Check className="w-5 h-5 text-green-500 mx-auto" strokeWidth={3} /> :
                                                                <X className="w-5 h-5 text-gray-300 mx-auto" />
                                                        )}
                                                    </td>

                                                    {/* Agent Column */}
                                                    <td className="px-6 py-4 text-center">
                                                        {isSuperAdmin ? (
                                                            <div className="flex justify-center">
                                                                <Switch
                                                                    checked={isEnabled('sales_agent', perm.permission_key)}
                                                                    onChange={() => handleToggle('sales_agent', perm.permission_key, isEnabled('sales_agent', perm.permission_key))}
                                                                    disabled={saving === `sales_agent-${perm.permission_key}`}
                                                                    size="sm"
                                                                />
                                                            </div>
                                                        ) : (
                                                            isEnabled('sales_agent', perm.permission_key) ?
                                                                <Check className="w-5 h-5 text-green-500 mx-auto" strokeWidth={3} /> :
                                                                <X className="w-5 h-5 text-gray-300 mx-auto" />
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Info Card */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-xl text-white shadow-lg flex items-start gap-4">
                <div className="bg-blue-500 p-3 rounded-lg">
                    <Info className="w-6 h-6" />
                </div>
                <div>
                    <h4 className="font-bold text-lg mb-2">💡 Sobre Privacidad y Seguridad</h4>
                    <p className="text-blue-100 text-sm leading-relaxed">
                        Por diseño de seguridad multi-tenant, el <strong>Super Admin</strong> gestiona la plataforma y las empresas,
                        pero <strong>NO tiene acceso a los datos privados</strong> (leads, seguimientos, documentos) de las empresas cliente.
                        Esto garantiza la <strong>confidencialidad total</strong> de los datos de negocio de cada empresa.
                    </p>
                </div>
            </div>
        </div>
    );
}
