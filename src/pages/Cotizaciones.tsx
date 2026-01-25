import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, CheckCircle, XCircle, Clock, Edit, Trash2, Eye } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { cotizacionesService } from '../services/cotizaciones';
import { Button } from '../components/ui/Button';
import toast from 'react-hot-toast';

export default function Cotizaciones() {
    const { profile } = useAuth();
    const navigate = useNavigate();

    const [cotizaciones, setCotizaciones] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        total: 0,
        borrador: 0,
        enviadas: 0,
        aceptadas: 0,
        rechazadas: 0,
        valor_total: 0,
        valor_aceptadas: 0
    });

    useEffect(() => {
        if (profile?.company_id) {
            loadCotizaciones();
            loadStats();
        }
    }, [profile]);

    const loadCotizaciones = async () => {
        try {
            setLoading(true);
            const data = await cotizacionesService.getCotizaciones(profile!.company_id);
            setCotizaciones(data);
        } catch (error: any) {
            console.error('Error loading cotizaciones:', error);
            toast.error('Error al cargar cotizaciones');
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            const data = await cotizacionesService.getStats(profile!.company_id);
            setStats(data);
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta cotización?')) return;

        try {
            await cotizacionesService.deleteCotizacion(id);
            toast.success('Cotización eliminada');
            loadCotizaciones();
            loadStats();
        } catch (error: any) {
            toast.error('Error al eliminar cotización');
        }
    };

    const getEstadoBadge = (estado: string) => {
        const badges = {
            borrador: { icon: Clock, color: 'bg-gray-100 text-gray-700', label: 'Borrador' },
            enviada: { icon: FileText, color: 'bg-blue-100 text-blue-700', label: 'Enviada' },
            aceptada: { icon: CheckCircle, color: 'bg-green-100 text-green-700', label: 'Aceptada' },
            rechazada: { icon: XCircle, color: 'bg-red-100 text-red-700', label: 'Rechazada' },
            expirada: { icon: Clock, color: 'bg-orange-100 text-orange-700', label: 'Expirada' }
        };

        const badge = badges[estado as keyof typeof badges] || badges.borrador;
        const Icon = badge.icon;

        return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${badge.color}`}>
                <Icon className="w-3.5 h-3.5" />
                {badge.label}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-gray-400">Cargando cotizaciones...</div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[1500px] mx-auto pb-6 space-y-8 animate-in fade-in duration-500">
            {/* Header - Global Standard */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-[#4449AA] tracking-tight">💰 Cotizaciones</h1>
                    <p className="text-[13px] text-gray-400 font-medium">Gestión de cotizaciones de facturación electrónica</p>
                </div>
                <Button
                    onClick={() => navigate('/cotizaciones/nueva-pro')}
                    className="h-10 px-6 bg-[#4449AA] hover:bg-[#383d8f] text-white text-[10px] font-black uppercase tracking-widest border-0 shadow-lg"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva Cotización
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">Total</p>
                            <p className="text-2xl font-bold text-[#4449AA] mt-1">{stats.total}</p>
                        </div>
                        <FileText className="w-8 h-8 text-blue-400" />
                    </div>
                </div>

                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">Aceptadas</p>
                            <p className="text-2xl font-bold text-green-600 mt-1">{stats.aceptadas}</p>
                        </div>
                        <CheckCircle className="w-8 h-8 text-green-400" />
                    </div>
                </div>

                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">Valor Total</p>
                            <p className="text-xl font-bold text-[#4449AA] mt-1">${stats.valor_total.toLocaleString()}</p>
                        </div>
                        <div className="text-4xl">💵</div>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">Valor Cerrado</p>
                            <p className="text-xl font-bold text-green-600 mt-1">${stats.valor_aceptadas.toLocaleString()}</p>
                        </div>
                        <div className="text-4xl">✅</div>
                    </div>
                </div>
            </div>

            {/* Tabla de Cotizaciones */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-[#F5F7FA]">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase">Cliente</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase">Plan</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase">DTEs</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase">Total Anual</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase">Estado</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase">Fecha</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-400 uppercase">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {cotizaciones.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center justify-center text-gray-400">
                                            <FileText className="w-12 h-12 mb-3 opacity-50" />
                                            <p className="text-sm font-medium">No hay cotizaciones</p>
                                            <p className="text-xs mt-1">Crea tu primera cotización usando el botón superior</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                cotizaciones.map((cot) => (
                                    <tr key={cot.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="text-sm font-bold text-[#4449AA]">{cot.nombre_cliente}</p>
                                                {cot.empresa_cliente && (
                                                    <p className="text-xs text-gray-500">{cot.empresa_cliente}</p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-semibold text-gray-700">{cot.plan_nombre}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-gray-600">{cot.volumen_dtes.toLocaleString()}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-base font-bold text-[#3DCC91]">${cot.total_anual.toLocaleString()}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {getEstadoBadge(cot.estado)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs text-gray-500">
                                                {new Date(cot.created_at).toLocaleDateString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => navigate(`/cotizaciones/${cot.id}`)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Ver detalles"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => navigate(`/cotizaciones/${cot.id}/editar`)}
                                                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                {profile?.role === 'company_admin' && (
                                                    <button
                                                        onClick={() => handleDelete(cot.id)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
