import { useEffect, useState } from 'react';
import { adminService } from '../../services/admin';
import type { Company, LicenseStatus } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Plus, Building, MoreHorizontal, Shield } from 'lucide-react';
import { format } from 'date-fns';

export default function Companies() {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        license_status: 'active' as LicenseStatus,
        rnc: '',
        telefono: '',
        email: '',
        direccion: '',
    });
    const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
    const [permissionDefinitions, setPermissionDefinitions] = useState<any[]>([]);
    const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<any>(null);
    const [tempPermissions, setTempPermissions] = useState<string[]>([]);

    useEffect(() => {
        loadCompanies();
        loadDefinitions();
    }, []);

    const loadDefinitions = async () => {
        try {
            const defs = await adminService.getPermissionDefinitions();
            setPermissionDefinitions(defs);
        } catch (error) {
            console.error('Failed to load permission definitions', error);
        }
    };

    const loadCompanies = async () => {
        try {
            const data = await adminService.getCompanies();
            setCompanies(data);
        } catch (error) {
            console.error('Failed to load companies', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingCompanyId) {
                await adminService.updateCompany(editingCompanyId, formData);
            } else {
                await adminService.createCompany(formData);
            }
            setIsModalOpen(false);
            setEditingCompanyId(null);
            setFormData({ name: '', license_status: 'active', rnc: '', telefono: '', email: '', direccion: '' });
            loadCompanies();
        } catch (error) {
            console.error('Failed to save company', error);
            alert('Error al guardar la empresa');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-800';
            case 'expired': return 'bg-red-100 text-red-800';
            case 'trial': return 'bg-blue-100 text-blue-800';
            case 'manual_hold': return 'bg-yellow-100 text-yellow-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const [editingLimit, setEditingLimit] = useState<{ id: string, limit: number } | null>(null);

    const handleUpdateLimit = async () => {
        if (!editingLimit) return;
        try {
            await adminService.updateCompany(editingLimit.id, { max_users: editingLimit.limit });
            setEditingLimit(null);
            loadCompanies();
        } catch (error) {
            console.error('Failed to update limit', error);
        }
    };


    const handleOpenLicense = (company: any) => {
        setSelectedCompany(company);
        setTempPermissions(company.allowed_permissions || []);
        setIsLicenseModalOpen(true);
    };

    const handleSaveLicense = async () => {
        if (!selectedCompany) return;
        try {
            await adminService.updateCompany(selectedCompany.id, { allowed_permissions: tempPermissions });
            setIsLicenseModalOpen(false);
            loadCompanies();
        } catch (error) {
            console.error('Failed to update licenses', error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestión de Empresas (SaaS)</h1>
                    <p className="mt-1 text-sm text-gray-500">Administra registros, límites de usuarios y suscripciones globales.</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Registrar Empresa
                </Button>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuarios / Límite</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Creado</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Empresa</th>
                            <th className="relative px-6 py-3"><span className="sr-only">Acciones</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {companies.map((company: any) => (
                            <tr key={company.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                                            <Building className="h-5 w-5" />
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-semibold text-gray-900">{company.name}</div>
                                            <div className="text-xs text-gray-500">ID: {company.id.slice(0, 8)}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(company.license_status)}`}>
                                        {company.license_status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    {editingLimit?.id === company.id ? (
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="number"
                                                className="w-20 h-8"
                                                value={editingLimit?.limit || 0}
                                                onChange={e => setEditingLimit({ id: company.id, limit: parseInt(e.target.value) })}
                                            />
                                            <Button size="sm" onClick={handleUpdateLimit}>Ok</Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 group">
                                            <span className={`font-medium ${company.user_count >= (company.max_users || 5) ? 'text-red-600' : 'text-gray-900'}`}>
                                                {company.user_count} / {company.max_users || 5}
                                            </span>
                                            <button
                                                onClick={() => setEditingLimit({ id: company.id, limit: company.max_users || 5 })}
                                                className="opacity-0 group-hover:opacity-100 text-blue-600 text-xs hover:underline transition-opacity"
                                            >
                                                Editar
                                            </button>
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {format(new Date(company.created_at), 'dd MMM yyyy')}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-400">
                                    {company.id.slice(0, 8)}...
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleOpenLicense(company)}
                                        title="Gestionar Licencia"
                                        className="text-indigo-600 hover:text-indigo-900"
                                    >
                                        <Shield className="h-4 h-4 mr-1" />
                                        Licencia
                                    </Button>
                                    <button
                                        onClick={() => {
                                            setEditingCompanyId(company.id);
                                            setFormData({
                                                name: company.name,
                                                license_status: company.license_status,
                                                rnc: company.rnc || '',
                                                telefono: company.telefono || '',
                                                email: company.email || '',
                                                direccion: company.direccion || '',
                                            });
                                            setIsModalOpen(true);
                                        }}
                                        className="text-blue-600 hover:text-blue-900 p-2"
                                        title="Editar Perfil"
                                    >
                                        <MoreHorizontal className="h-5 w-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {loading && (
                            <tr>
                                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">Loading companies...</td>
                            </tr>
                        )}
                        {!loading && companies.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500">No companies found. Create one to get started.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingCompanyId(null);
                    setFormData({ name: '', license_status: 'active', rnc: '', telefono: '', email: '', direccion: '' });
                }}
                title={editingCompanyId ? `Editar Empresa: ${formData.name}` : "Registrar Nueva Empresa"}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 mb-1">Nombre de la Empresa</label>
                            <Input
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Ej: Arias Defense"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">RNC / Tax ID</label>
                            <Input
                                value={formData.rnc}
                                onChange={(e) => setFormData({ ...formData, rnc: e.target.value })}
                                placeholder="001-XXXXXXX-X"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Estado de Licencia</label>
                            <select
                                value={formData.license_status}
                                onChange={(e) => setFormData({ ...formData, license_status: e.target.value as LicenseStatus })}
                                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm"
                            >
                                <option value="active">Activo</option>
                                <option value="trial">Prueba (Trial)</option>
                                <option value="expired">Expirado</option>
                                <option value="manual_hold">Retenido (Hold)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Teléfono</label>
                            <Input
                                value={formData.telefono}
                                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                                placeholder="+503 XXXX-XXXX"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Email Corporativo</label>
                            <Input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="contacto@empresa.com"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 mb-1">Dirección Física</label>
                            <Input
                                value={formData.direccion}
                                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                                placeholder="Ave. Principal, Edificio X, Nivel Y"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end pt-6 border-t gap-3 mt-4">
                        <Button type="button" variant="ghost" onClick={() => {
                            setIsModalOpen(false);
                            setEditingCompanyId(null);
                        }}>Cancelar</Button>
                        <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                            {editingCompanyId ? "Guardar Cambios" : "Crear Empresa"}
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={isLicenseModalOpen}
                onClose={() => setIsLicenseModalOpen(false)}
                title={`Configurar Licencia: ${selectedCompany?.name}`}
            >
                <div className="space-y-6">
                    <p className="text-sm text-gray-500">
                        Selecciona qué permisos y módulos específicos están habilitados para esta empresa.
                        Los cambios afectan a todos los usuarios de la organización.
                    </p>

                    <div className="max-h-[60vh] overflow-y-auto px-1">
                        {Object.entries(
                            permissionDefinitions.reduce((acc, def) => {
                                if (!acc[def.category]) acc[def.category] = [];
                                acc[def.category].push(def);
                                return acc;
                            }, {} as Record<string, any[]>)
                        ).map(([category, defs]) => (
                            <div key={category} className="mb-6">
                                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
                                    <div className="w-1 h-4 bg-blue-500 rounded mr-2"></div>
                                    {category}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {(defs as any[]).map((def) => (
                                        <label
                                            key={def.id}
                                            className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${tempPermissions.includes(def.permission_key)
                                                ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-100'
                                                : 'bg-white border-gray-100 hover:bg-gray-50'
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={tempPermissions.includes(def.permission_key)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setTempPermissions([...tempPermissions, def.permission_key]);
                                                    } else {
                                                        setTempPermissions(tempPermissions.filter(pk => pk !== def.permission_key));
                                                    }
                                                }}
                                                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                            />
                                            <div className="ml-3">
                                                <div className="text-sm font-medium text-gray-900">{def.label}</div>
                                                <div className="text-xs text-gray-500 font-mono">{def.permission_key}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end pt-4 border-t gap-3">
                        <Button variant="ghost" onClick={() => setIsLicenseModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveLicense}>Guardar Cambios de Licencia</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
