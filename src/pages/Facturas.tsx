import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, CheckCircle, XCircle, Clock, Eye, Trash2, Search, BadgeDollarSign, TrendingUp, AlertTriangle } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { invoicesService, type Invoice } from '../services/invoices';
import { Button } from '../components/ui/Button';
import toast from 'react-hot-toast';

export default function Facturas() {
    const { profile } = useAuth();
    const isAdmin = profile?.role === 'super_admin' || profile?.role === 'company_admin';
    const navigate = useNavigate();

    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | null>(null);

    const [stats, setStats] = useState({
        total: 0,
        paid: 0,
        unpaid: 0,
        void: 0,
        amountTotal: 0,
        amountPaid: 0,
        amountUnpaid: 0
    });

    useEffect(() => {
        if (profile?.company_id) {
            loadInvoices();
        }
    }, [profile?.company_id]);

    const loadInvoices = async () => {
        try {
            setLoading(true);
            const data = await invoicesService.getInvoices(profile!.company_id);
            setInvoices(data);
            
            // Calculate stats
            const totalCount = data.length;
            const paidCount = data.filter(i => i.status === 'paid').length;
            const unpaidCount = data.filter(i => i.status === 'unpaid').length;
            const voidCount = data.filter(i => i.status === 'void').length;
            
            const totalSum = data.reduce((sum, i) => sum + (Number(i.total) || 0), 0);
            const paidSum = data.filter(i => i.status === 'paid').reduce((sum, i) => sum + (Number(i.total) || 0), 0);
            const unpaidSum = data.filter(i => i.status === 'unpaid').reduce((sum, i) => sum + (Number(i.total) || 0), 0);

            setStats({
                total: totalCount,
                paid: paidCount,
                unpaid: unpaidCount,
                void: voidCount,
                amountTotal: totalSum,
                amountPaid: paidSum,
                amountUnpaid: unpaidSum
            });
        } catch (error) {
            console.error('Error loading invoices:', error);
            toast.error('Error al cargar las facturas');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, number: string) => {
        if (!confirm(`¿Estás seguro de eliminar la factura "${number}"? Esta acción es irreversible.`)) return;

        try {
            await invoicesService.deleteInvoice(id);
            toast.success('Factura eliminada correctamente');
            loadInvoices();
        } catch (error) {
            console.error('Error deleting invoice:', error);
            toast.error('No se pudo eliminar la factura');
        }
    };

    const filteredInvoices = invoices.filter(inv => {
        const matchesSearch = !searchTerm ? true : (() => {
            const search = searchTerm.toLowerCase();
            return (
                inv.numero_factura.toLowerCase().includes(search) ||
                inv.nombre_cliente.toLowerCase().includes(search) ||
                inv.empresa_cliente?.toLowerCase().includes(search) ||
                inv.status.toLowerCase().includes(search) ||
                String(inv.total).includes(search)
            );
        })();

        const matchesStatus = !statusFilter ? true : inv.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const getStatusBadge = (status: string) => {
        const badges = {
            draft: { icon: Clock, color: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Borrador' },
            unpaid: { icon: AlertTriangle, color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Pendiente' },
            paid: { icon: CheckCircle, color: 'bg-green-100 text-green-700 border-green-200', label: 'Pagada' },
            void: { icon: XCircle, color: 'bg-red-100 text-red-700 border-red-200', label: 'Anulada' },
            refunded: { icon: Clock, color: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Reembolsada' }
        };

        const badge = badges[status as keyof typeof badges] || badges.draft;
        const Icon = badge.icon;

        return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${badge.color}`}>
                <Icon className="w-3.5 h-3.5" />
                {badge.label}
            </span>
        );
    };

    return (
        <div className="w-full max-w-[1500px] mx-auto pb-12 space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-[#4449AA] tracking-tight flex items-center gap-2">
                        <FileText className="w-8 h-8 text-[#4449AA]" />
                        Facturación
                    </h1>
                    <p className="text-[13px] text-gray-400 font-bold uppercase tracking-wider mt-1">
                        Control de ingresos y facturación de la empresa
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-80">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar factura por número, cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-4 py-3 border border-gray-200 rounded-2xl bg-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4449AA]/10 focus:border-[#4449AA] transition-all duration-200 shadow-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total */}
                <div 
                    onClick={() => setStatusFilter(null)}
                    className={`group relative rounded-2xl p-5 shadow-sm border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md cursor-pointer bg-white ${!statusFilter ? 'border-[#4449AA] ring-2 ring-[#4449AA]/10' : 'border-gray-200/80'}`}
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shadow-sm">
                            <FileText className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Total Facturas</span>
                            <span className="text-2xl font-black text-slate-900 leading-none mt-1">{stats.total}</span>
                        </div>
                    </div>
                    <div className="mt-4 border-t border-gray-100 pt-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Monto Total: <span className="text-slate-900 font-extrabold">${stats.amountTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                    </div>
                </div>

                {/* Paid */}
                <div 
                    onClick={() => setStatusFilter('paid')}
                    className={`group relative rounded-2xl p-5 shadow-sm border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md cursor-pointer bg-white ${statusFilter === 'paid' ? 'border-green-600 ring-2 ring-green-600/10' : 'border-gray-200/80'}`}
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-green-50 text-green-600 border border-green-100 shadow-sm">
                            <CheckCircle className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Pagadas</span>
                            <span className="text-2xl font-black text-slate-900 leading-none mt-1">{stats.paid}</span>
                        </div>
                    </div>
                    <div className="mt-4 border-t border-gray-100 pt-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Cobrado: <span className="text-green-600 font-extrabold">${stats.amountPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                    </div>
                </div>

                {/* Unpaid */}
                <div 
                    onClick={() => setStatusFilter('unpaid')}
                    className={`group relative rounded-2xl p-5 shadow-sm border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md cursor-pointer bg-white ${statusFilter === 'unpaid' ? 'border-amber-500 ring-2 ring-amber-500/10' : 'border-gray-200/80'}`}
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 shadow-sm">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Por Cobrar</span>
                            <span className="text-2xl font-black text-slate-900 leading-none mt-1">{stats.unpaid}</span>
                        </div>
                    </div>
                    <div className="mt-4 border-t border-gray-100 pt-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Pendiente: <span className="text-amber-600 font-extrabold">${stats.amountUnpaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                    </div>
                </div>

                {/* Voided */}
                <div 
                    onClick={() => setStatusFilter('void')}
                    className={`group relative rounded-2xl p-5 shadow-sm border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md cursor-pointer bg-white ${statusFilter === 'void' ? 'border-red-500 ring-2 ring-red-500/10' : 'border-gray-200/80'}`}
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-red-50 text-red-600 border border-red-100 shadow-sm">
                            <XCircle className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Anuladas</span>
                            <span className="text-2xl font-black text-slate-900 leading-none mt-1">{stats.void}</span>
                        </div>
                    </div>
                    <div className="mt-4 border-t border-gray-100 pt-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Sin Efecto</p>
                    </div>
                </div>
            </div>

            {/* Invoices List / Table */}
            <div className="bg-white rounded-[24px] shadow-sm border border-gray-200/80 overflow-hidden">
                {loading ? (
                    <div className="py-20 text-center text-gray-400 font-bold uppercase tracking-widest animate-pulse">
                        Cargando facturas...
                    </div>
                ) : filteredInvoices.length === 0 ? (
                    <div className="py-20 text-center">
                        <FileText className="w-16 h-16 mx-auto text-gray-200 mb-4" />
                        <p className="text-base font-black text-slate-900 uppercase tracking-tight">Sin facturas registradas</p>
                        <p className="text-xs text-gray-400 mt-1">No se encontraron facturas que coincidan con los filtros seleccionados.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Factura #</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Cliente / Empresa</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha Emisión</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Estado</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Monto Total</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredInvoices.map((inv) => (
                                    <tr 
                                        key={inv.id}
                                        className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                                        onClick={() => navigate(`/facturas/${inv.id}`)}
                                    >
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <span className="text-sm font-black text-slate-900 group-hover:text-[#4449AA] transition-colors">
                                                {inv.numero_factura}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-gray-950">{inv.nombre_cliente}</span>
                                                <span className="text-[11px] font-black text-blue-600 uppercase tracking-tight mt-0.5">{inv.empresa_cliente || 'Individual'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-tight">
                                                {inv.created_at ? new Date(inv.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '--/--/----'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            {getStatusBadge(inv.status)}
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <span className="text-sm font-black text-slate-950">
                                                ${Number(inv.total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => navigate(`/facturas/${inv.id}`)}
                                                    className="p-2 text-indigo-400 hover:text-white hover:bg-[#4449AA] rounded-xl transition-all shadow-sm bg-indigo-50/50"
                                                    title="Ver Detalle"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                {isAdmin && (
                                                    <button
                                                        onClick={() => handleDelete(inv.id!, inv.numero_factura)}
                                                        className="p-2 text-rose-400 hover:text-white hover:bg-rose-600 rounded-xl transition-all shadow-sm bg-rose-50/50"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
