import { Shield, Check, X, Info, Loader2 } from 'lucide-react';
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
        return rolePermissions.find(p => p.role === role && p.permission_key === key)?.is_enabled ?? false;
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
    return (
        <div className="space-y-8 max-w-5xl mx-auto pb-12">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Shield className="w-7 h-7 text-blue-600" />
                    Roles y Permisos
                </h1>
                <p className="text-gray-500">Consulta qué puede hacer cada nivel de acceso en la plataforma.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-purple-50 p-6 rounded-xl border border-purple-100">
                    <h3 className="text-purple-900 font-bold text-lg mb-2">Super Admin</h3>
                    <p className="text-sm text-purple-700">Dueño de la plataforma. Gestiona empresas, licencias y el sistema global.</p>
                </div>
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                    <h3 className="text-blue-900 font-bold text-lg mb-2">Admin Empresa</h3>
                    <p className="text-sm text-blue-700">Dueño del negocio. Gestiona su equipo completo y todos los leads de su empresa.</p>
                </div>
                <div className="bg-green-50 p-6 rounded-xl border border-green-100">
                    <h3 className="text-green-900 font-bold text-lg mb-2">Agente Ventas</h3>
                    <p className="text-sm text-green-700">Equipo operativo. Enfocado en gestionar y convertir sus leads asignados.</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-1/2">Acción / Permiso</th>
                            <th className="px-6 py-4 text-center text-xs font-bold text-purple-600 uppercase tracking-wider">Super</th>
                            <th className="px-6 py-4 text-center text-xs font-bold text-blue-600 uppercase tracking-wider">Admin</th>
                            <th className="px-6 py-4 text-center text-xs font-bold text-green-600 uppercase tracking-wider">Agente</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {Object.entries(groupedDefinitions).map(([category, defs]) => (
                            <div key={category} className="contents">
                                <tr className="bg-gray-50/50">
                                    <td colSpan={4} className="px-6 py-2 text-xs font-black text-gray-400 uppercase tracking-widest">
                                        {category}
                                    </td>
                                </tr>
                                {defs.map((def) => (
                                    <tr key={def.permission_key} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-sm text-gray-700">{def.label}</td>

                                        {/* Super Column */}
                                        <td className="px-6 py-4 text-center">
                                            {isSuperAdmin ? (
                                                <div className="flex justify-center">
                                                    <Switch
                                                        checked={isEnabled('super_admin', def.permission_key)}
                                                        onChange={() => handleToggle('super_admin', def.permission_key, isEnabled('super_admin', def.permission_key))}
                                                        disabled={saving === `super_admin-${def.permission_key}`}
                                                        size="sm"
                                                    />
                                                </div>
                                            ) : (
                                                isEnabled('super_admin', def.permission_key) ? <Check className="w-5 h-5 text-green-500 mx-auto" strokeWidth={3} /> : <X className="w-5 h-5 text-gray-300 mx-auto" />
                                            )}
                                        </td>

                                        {/* Admin Column */}
                                        <td className="px-6 py-4 text-center">
                                            {isSuperAdmin ? (
                                                <div className="flex justify-center">
                                                    <Switch
                                                        checked={isEnabled('company_admin', def.permission_key)}
                                                        onChange={() => handleToggle('company_admin', def.permission_key, isEnabled('company_admin', def.permission_key))}
                                                        disabled={saving === `company_admin-${def.permission_key}`}
                                                        size="sm"
                                                    />
                                                </div>
                                            ) : (
                                                isEnabled('company_admin', def.permission_key) ? <Check className="w-5 h-5 text-green-500 mx-auto" strokeWidth={3} /> : <X className="w-5 h-5 text-gray-300 mx-auto" />
                                            )}
                                        </td>

                                        {/* Agent Column */}
                                        <td className="px-6 py-4 text-center">
                                            {isSuperAdmin ? (
                                                <div className="flex justify-center">
                                                    <Switch
                                                        checked={isEnabled('sales_agent', def.permission_key)}
                                                        onChange={() => handleToggle('sales_agent', def.permission_key, isEnabled('sales_agent', def.permission_key))}
                                                        disabled={saving === `sales_agent-${def.permission_key}`}
                                                        size="sm"
                                                    />
                                                </div>
                                            ) : (
                                                isEnabled('sales_agent', def.permission_key) ? <Check className="w-5 h-5 text-green-500 mx-auto" strokeWidth={3} /> : <X className="w-5 h-5 text-gray-300 mx-auto" />
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </div>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="bg-blue-600 p-6 rounded-xl text-white flex items-start gap-4">
                <div className="bg-blue-500 p-2 rounded-lg">
                    <Info className="w-6 h-6" />
                </div>
                <div>
                    <h4 className="font-bold text-lg">💡 Nota sobre Privacidad SaaS</h4>
                    <p className="text-blue-100 text-sm mt-1">
                        Por diseño de seguridad, el **Super Admin** puede ver empresas y configuraciones globales, pero **NO puede ver los leads privados** de las empresas cliente. Esto garantiza la confidencialidad total de los datos de tus clientes.
                    </p>
                </div>
            </div>
        </div>
    );
}
