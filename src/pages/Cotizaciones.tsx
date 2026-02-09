import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, CheckCircle, XCircle, Clock, Edit, Trash2, Eye, ArrowUpDown, GripVertical, Search } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useAuth } from '../auth/AuthProvider';
import { cotizacionesService } from '../services/cotizaciones';
import { Button } from '../components/ui/Button';
import toast from 'react-hot-toast';

export default function Cotizaciones() {
    const { profile } = useAuth();
    const navigate = useNavigate();

    const [cotizaciones, setCotizaciones] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | null>(null);

    // Column order persistence
    const [columnOrder, setColumnOrder] = useState<string[]>(() => {
        const saved = localStorage.getItem('quote_column_order');
        return saved ? JSON.parse(saved) : ['nombre_cliente', 'plan_nombre', 'volumen_dtes', 'total_anual', 'estado', 'created_at'];
    });

    const handleOnDragEnd = (result: any) => {
        if (!result.destination) return;
        const items = Array.from(columnOrder);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        setColumnOrder(items);
        localStorage.setItem('quote_column_order', JSON.stringify(items));
    };
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

    const handleDelete = async (id: string, nombre?: string) => {
        if (!confirm(`¿Estás seguro de eliminar la cotización de "${nombre || 'este cliente'}"?`)) return;

        try {
            await cotizacionesService.deleteCotizacion(id);
            toast.success('Cotización eliminada');
            loadCotizaciones();
            loadStats();
        } catch (error: any) {
            toast.error('Error al eliminar cotización');
        }
    };

    const toggleSelection = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredCotizaciones.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredCotizaciones.map(c => c.id));
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`¿Estás seguro de eliminar ${selectedIds.length} cotizaciones?`)) return;

        try {
            await Promise.all(selectedIds.map(id => cotizacionesService.deleteCotizacion(id)));
            toast.success(`${selectedIds.length} cotizaciones eliminadas`);
            setSelectedIds([]);
            loadCotizaciones();
            loadStats();
        } catch (error) {
            toast.error('Error al eliminar algunas cotizaciones');
        }
    };

    const filteredCotizaciones = cotizaciones.filter(cot => {
        const matchesSearch = !searchTerm ? true : (() => {
            const search = searchTerm.toLowerCase();
            return (
                cot.nombre_cliente?.toLowerCase().includes(search) ||
                cot.empresa_cliente?.toLowerCase().includes(search) ||
                cot.plan_nombre?.toLowerCase().includes(search) ||
                cot.estado?.toLowerCase().includes(search) ||
                String(cot.total_anual).includes(search) ||
                String(cot.volumen_dtes).includes(search)
            );
        })();

        const matchesStatus = !statusFilter ? true : cot.estado === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const sortedCotizaciones = [...filteredCotizaciones].sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        const valA = a[key] ?? '';
        const valB = b[key] ?? '';

        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
    });

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
        <>
            <div className="w-full max-w-[1500px] mx-auto pb-6 space-y-8 animate-in fade-in duration-500">
                {/* Header - Global Standard */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-extrabold text-[#4449AA] tracking-tight">💰 Cotizaciones</h1>
                        <p className="text-[13px] text-gray-400 font-medium">Gestión de cotizaciones de facturación electrónica</p>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        {/* Minimalist Professional Search Bar */}
                        <div className="relative flex-1 sm:w-64">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 h-4 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Buscar cotización..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="block w-full pl-10 pr-3 py-2 border border-gray-100 rounded-xl bg-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4449AA]/10 focus:border-[#4449AA] transition-all duration-200 shadow-sm"
                            />
                        </div>

                        <Button
                            onClick={() => navigate('/cotizaciones/nueva-pro')}
                            className="h-10 px-6 bg-[#4449AA] hover:bg-[#383d8f] text-white text-[10px] font-black uppercase tracking-widest border-0 shadow-lg"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Nueva Cotización
                        </Button>
                    </div>
                </div>

                {/* Stats Cards */}
                {/* Stats Cards - Senior Architect Premium Redesign */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Total Quotes Card */}
                    <div
                        onClick={() => setStatusFilter(null)}
                        className={`group relative bg-white rounded-2xl p-6 border transition-all duration-500 overflow-hidden cursor-pointer ${!statusFilter ? 'border-[#4449AA] ring-2 ring-[#4449AA]/5 shadow-[0_12px_40px_rgba(68,73,170,0.08)]' : 'border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)]'}`}
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/30 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-blue-100/40 transition-colors duration-500"></div>
                        <div className="relative flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Total</p>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-3xl font-black text-slate-900 tracking-tight">{stats.total}</p>
                                    <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-md">General</span>
                                </div>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500">
                                <div className="w-8 h-8 rounded-xl bg-white/60 backdrop-blur-sm shadow-sm flex items-center justify-center">
                                    <FileText className="w-4 h-4 text-[#4449AA]" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Accepted Quotes Card */}
                    <div
                        onClick={() => setStatusFilter(statusFilter === 'aceptada' ? null : 'aceptada')}
                        className={`group relative bg-white rounded-2xl p-6 border transition-all duration-500 overflow-hidden cursor-pointer ${statusFilter === 'aceptada' ? 'border-emerald-500 ring-2 ring-emerald-500/5 shadow-[0_12px_40px_rgba(16,185,129,0.08)]' : 'border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)]'}`}
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50/30 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-emerald-100/40 transition-colors duration-500"></div>
                        <div className="relative flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Aceptadas</p>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-3xl font-black text-slate-900 tracking-tight">{stats.aceptadas}</p>
                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                        {stats.total > 0 ? `${Math.round((stats.aceptadas / stats.total) * 100)}%` : '0%'}
                                    </span>
                                </div>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500">
                                <div className="w-8 h-8 rounded-xl bg-white/60 backdrop-blur-sm shadow-sm flex items-center justify-center">
                                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Total Value Card */}
                    <div className="group relative bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all duration-500 overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/30 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-indigo-100/40 transition-colors duration-500"></div>
                        <div className="relative flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Valor Total</p>
                                <div className="flex items-baseline gap-1">
                                    <p className="text-2xl font-black text-slate-900 tracking-tight leading-none">${stats.valor_total.toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500">
                                <div className="w-8 h-8 rounded-xl bg-white/60 backdrop-blur-sm shadow-sm flex items-center justify-center">
                                    <span className="text-xs font-black text-indigo-600">$</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Closed Value Card */}
                    <div
                        onClick={() => setStatusFilter(statusFilter === 'aceptada' ? null : 'aceptada')}
                        className={`group relative rounded-2xl p-6 transition-all duration-500 overflow-hidden border-none text-white cursor-pointer ${statusFilter === 'aceptada' ? 'bg-[#383d8f] shadow-[0_20px_60px_rgba(68,73,170,0.3)] ring-2 ring-white/10' : 'bg-[#4449AA] shadow-[0_20px_40px_rgba(68,73,170,0.15)] hover:shadow-[0_30px_60px_rgba(68,73,170,0.25)]'}`}
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-white/20 transition-colors duration-500"></div>
                        <div className="relative flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-indigo-100/70 uppercase tracking-[0.2em]">Valor Cerrado</p>
                                <div className="flex items-baseline gap-1">
                                    <p className="text-2xl font-black text-white tracking-tight leading-none">${stats.valor_aceptadas.toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-500">
                                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                                    <CheckCircle className="w-4 h-4 text-white" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabla de Cotizaciones - Modern Premium Redesign */}
                <div className="relative">
                    <DragDropContext onDragEnd={handleOnDragEnd}>
                        <Droppable droppableId="quote-columns" direction="horizontal">
                            {(provided) => (
                                <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/80 overflow-hidden transition-all duration-300">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-50">
                                            <thead className="bg-[#FAFAFB]">
                                                <tr ref={provided.innerRef} {...provided.droppableProps}>
                                                    <th scope="col" className="px-6 py-4 text-left bg-[#FAFAFB]">
                                                        <div className="flex items-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedIds.length === filteredCotizaciones.length && filteredCotizaciones.length > 0}
                                                                onChange={toggleSelectAll}
                                                                className="w-4 h-4 rounded border-gray-300 text-[#4449AA] focus:ring-[#4449AA] cursor-pointer"
                                                            />
                                                        </div>
                                                    </th>

                                                    {columnOrder.map((colId, index) => (
                                                        <Draggable key={colId} draggableId={colId} index={index}>
                                                            {(provided, snapshot) => (
                                                                <th
                                                                    ref={provided.innerRef}
                                                                    {...provided.draggableProps}
                                                                    scope="col"
                                                                    className={`px-4 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest transition-all ${snapshot.isDragging ? 'bg-indigo-50/80 shadow-sm z-50' : 'bg-[#FAFAFB]'}`}
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <div {...provided.dragHandleProps} className="cursor-move text-gray-300 hover:text-[#4449AA]">
                                                                            <GripVertical className="w-3 h-3" />
                                                                        </div>

                                                                        {colId === 'nombre_cliente' && (
                                                                            <div
                                                                                className="cursor-pointer hover:text-[#4449AA] transition-colors group flex items-center gap-1"
                                                                                onClick={() => setSortConfig({
                                                                                    key: 'nombre_cliente',
                                                                                    direction: sortConfig?.key === 'nombre_cliente' && sortConfig.direction === 'asc' ? 'desc' : 'asc'
                                                                                })}
                                                                            >
                                                                                Cliente
                                                                                <ArrowUpDown className={`w-3 h-3 ${sortConfig?.key === 'nombre_cliente' ? 'text-[#4449AA]' : 'opacity-0 group-hover:opacity-100'}`} />
                                                                            </div>
                                                                        )}

                                                                        {colId === 'plan_nombre' && "Plan / Producto"}
                                                                        {colId === 'volumen_dtes' && "Volumen"}

                                                                        {colId === 'total_anual' && (
                                                                            <div
                                                                                className="cursor-pointer hover:text-[#4449AA] transition-colors group flex items-center gap-1"
                                                                                onClick={() => setSortConfig({
                                                                                    key: 'total_anual',
                                                                                    direction: sortConfig?.key === 'total_anual' && sortConfig.direction === 'asc' ? 'desc' : 'asc'
                                                                                })}
                                                                            >
                                                                                Total Anual
                                                                                <ArrowUpDown className={`w-3 h-3 ${sortConfig?.key === 'total_anual' ? 'text-[#4449AA]' : 'opacity-0 group-hover:opacity-100'}`} />
                                                                            </div>
                                                                        )}

                                                                        {colId === 'estado' && "Estado"}

                                                                        {colId === 'created_at' && (
                                                                            <div
                                                                                className="cursor-pointer hover:text-[#4449AA] transition-colors group flex items-center gap-1"
                                                                                onClick={() => setSortConfig({
                                                                                    key: 'created_at',
                                                                                    direction: sortConfig?.key === 'created_at' && sortConfig.direction === 'asc' ? 'desc' : 'asc'
                                                                                })}
                                                                            >
                                                                                Fecha
                                                                                <ArrowUpDown className={`w-3 h-3 ${sortConfig?.key === 'created_at' ? 'text-[#4449AA]' : 'opacity-0 group-hover:opacity-100'}`} />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </th>
                                                            )}
                                                        </Draggable>
                                                    ))}

                                                    {provided.placeholder}
                                                    <th scope="col" className="px-4 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest text-right bg-[#FAFAFB]">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-50/50">
                                                {sortedCotizaciones.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={columnOrder.length + 2} className="px-6 py-16 text-center">
                                                            <div className="flex flex-col items-center justify-center text-gray-300">
                                                                <FileText className="w-12 h-12 mb-3 opacity-20" />
                                                                <p className="text-sm font-bold uppercase tracking-widest text-gray-400">Sin cotizaciones</p>
                                                                <Button
                                                                    onClick={() => navigate('/cotizaciones/nueva-pro')}
                                                                    variant="outline"
                                                                    className="mt-4 text-[10px] font-black border-gray-100"
                                                                >
                                                                    Crear Primera
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    sortedCotizaciones.map((cot) => {
                                                        const isSelected = selectedIds.includes(cot.id);
                                                        return (
                                                            <tr key={cot.id} className={`group transition-all duration-200 ${isSelected ? 'bg-indigo-50/30' : 'hover:bg-[#FDFDFE]'}`}>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        onChange={() => toggleSelection(cot.id)}
                                                                        className="w-4 h-4 rounded border-gray-300 text-[#4449AA] focus:ring-[#4449AA] cursor-pointer"
                                                                    />
                                                                </td>

                                                                {columnOrder.map((colId) => (
                                                                    <td key={colId} className="px-4 py-4 whitespace-nowrap">
                                                                        {colId === 'nombre_cliente' && (
                                                                            <div className="flex flex-col cursor-pointer" onClick={() => navigate(`/cotizaciones/${cot.id}`)}>
                                                                                <span className="text-sm font-bold text-gray-900 group-hover:text-[#4449AA] transition-colors">{cot.nombre_cliente}</span>
                                                                                <span className="text-[11px] text-blue-600 font-bold">{cot.empresa_cliente || 'Individual'}</span>
                                                                            </div>
                                                                        )}

                                                                        {colId === 'plan_nombre' && (
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                                                                                    <FileText className="w-4 h-4 text-[#4449AA]" />
                                                                                </div>
                                                                                <span className="text-sm font-bold text-gray-700">{cot.plan_nombre}</span>
                                                                            </div>
                                                                        )}

                                                                        {colId === 'volumen_dtes' && (
                                                                            <span className="text-xs font-black text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-100 uppercase tracking-tighter">
                                                                                {cot.volumen_dtes.toLocaleString()} DTEs
                                                                            </span>
                                                                        )}

                                                                        {colId === 'total_anual' && (
                                                                            <span className="text-sm font-black text-slate-900">
                                                                                ${cot.total_anual.toLocaleString()}
                                                                            </span>
                                                                        )}

                                                                        {colId === 'estado' && getEstadoBadge(cot.estado)}

                                                                        {colId === 'created_at' && (
                                                                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">
                                                                                {new Date(cot.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                ))}

                                                                <td className="px-4 py-4 whitespace-nowrap text-right">
                                                                    <div className="flex justify-end gap-1.5 transition-all">
                                                                        <button
                                                                            onClick={() => navigate(`/cotizaciones/${cot.id}`)}
                                                                            className="p-1.5 text-indigo-400 hover:text-white hover:bg-[#4449AA] rounded-lg transition-all shadow-sm bg-indigo-50/50"
                                                                        >
                                                                            <Eye className="w-4 h-4" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => navigate(`/cotizaciones/${cot.id}/editar`)}
                                                                            className="p-1.5 text-indigo-400 hover:text-white hover:bg-[#4449AA] rounded-lg transition-all shadow-sm bg-indigo-50/50"
                                                                        >
                                                                            <Edit className="w-4 h-4" />
                                                                        </button>
                                                                        {profile?.role === 'company_admin' && (
                                                                            <button
                                                                                onClick={() => handleDelete(cot.id, cot.nombre_cliente)}
                                                                                className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-600 rounded-lg transition-all shadow-sm bg-rose-50/50"
                                                                            >
                                                                                <Trash2 className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>


                </div>
            </div>

            {/* Floating Bulk Actions Bar */}
            {selectedIds.length > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-5 duration-300">
                    <div className="bg-white px-6 py-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gray-100 flex items-center gap-6">
                        <div className="flex items-center gap-2 pr-6 border-r border-gray-100">
                            <div className="w-6 h-6 bg-[#4449AA] rounded-full flex items-center justify-center text-[10px] font-black text-white">
                                {selectedIds.length}
                            </div>
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Seleccionados</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setSelectedIds([])}
                                className="text-xs font-black text-gray-400 hover:text-gray-600 uppercase tracking-widest transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                className="flex items-center gap-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                Eliminar Lote
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
