import { useEffect, useState } from 'react';
import { adminService } from '../../services/admin';
import type { Company, LicenseStatus } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Plus, Building, MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';

export default function Companies() {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        license_status: 'active' as LicenseStatus,
    });

    useEffect(() => {
        loadCompanies();
    }, []);

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
            await adminService.createCompany(formData);
            setIsModalOpen(false);
            setFormData({ name: '', license_status: 'active' });
            loadCompanies();
        } catch (error) {
            console.error('Failed to create company', error);
            alert('Failed to create company');
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

    const handleToggleFeature = async (id: string, feature: 'marketing' | 'chat', value: boolean, currentFeatures: any) => {
        try {
            const newFeatures = {
                ...(currentFeatures || { marketing: false, chat: false }),
                [feature]: value
            };

            // Optimistic update
            setCompanies(companies.map(c =>
                c.id === id ? { ...c, features: newFeatures } : c
            ));

            await adminService.updateCompany(id, { features: newFeatures });
            // No need to reload if optimistic update was successful, but good for sync
        } catch (error) {
            console.error('Failed to update feature', error);
            // Revert on error would be ideal, but for now just reload
            loadCompanies();
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
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Módulos</th>
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
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <div className="flex gap-3">
                                        <label className="flex items-center space-x-2 text-xs cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={company.features?.marketing || false}
                                                onChange={(e) => handleToggleFeature(company.id, 'marketing', e.target.checked, company.features)}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                                            />
                                            <span>Mkt</span>
                                        </label>
                                        <label className="flex items-center space-x-2 text-xs cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={company.features?.chat || false}
                                                onChange={(e) => handleToggleFeature(company.id, 'chat', e.target.checked, company.features)}
                                                className="rounded border-gray-300 text-green-600 focus:ring-green-500 h-4 w-4"
                                            />
                                            <span>Chat</span>
                                        </label>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button className="text-gray-400 hover:text-gray-600 p-2">
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Company">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Company Name</label>
                        <Input
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="mt-1"
                            placeholder="Startups Inc."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">License Status</label>
                        <select
                            value={formData.license_status}
                            onChange={(e) => setFormData({ ...formData, license_status: e.target.value as LicenseStatus })}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                        >
                            <option value="active">Active</option>
                            <option value="trial">Trial</option>
                            <option value="manual_hold">Manual Hold</option>
                        </select>
                    </div>
                    <div className="flex justify-end pt-4">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="mr-2">Cancel</Button>
                        <Button type="submit">Create Company</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
