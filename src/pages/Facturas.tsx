import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, CheckCircle, XCircle, Clock, Eye, Trash2, Search, BadgeDollarSign, TrendingUp, AlertTriangle, Plus, X, Trash } from 'lucide-react';
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

    // Create Invoice Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form Fields
    const [nombreCliente, setNombreCliente] = useState('');
    const [empresaCliente, setEmpresaCliente] = useState('');
    const [emailCliente, setEmailCliente] = useState('');
    const [telefonoCliente, setTelefonoCliente] = useState('');
    const [customerPo, setCustomerPo] = useState('');
    const [workorder, setWorkorder] = useState('');
    const [shipVia, setShipVia] = useState('');
    const [salesperson, setSalesperson] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [dateShipped, setDateShipped] = useState('');

    const [billToName, setBillToName] = useState('');
    const [billToCompany, setBillToCompany] = useState('');
    const [billToAccount, setBillToAccount] = useState('');
    const [billToAddress, setBillToAddress] = useState('');

    const [shipToName, setShipToName] = useState('');
    const [shipToCompany, setShipToCompany] = useState('');
    const [shipToAddress, setShipToAddress] = useState('');

    const [notas, setNotas] = useState('');
    const [ivaPercent, setIvaPercent] = useState(13);

    const [formItems, setFormItems] = useState<Array<{
        item_detail: string;
        stock_number: string;
        tag_number: string;
        amount: string;
    }>>([
        { item_detail: '', stock_number: '', tag_number: '', amount: '0' }
    ]);

    const handleAddRow = () => {
        setFormItems([...formItems, { item_detail: '', stock_number: '', tag_number: '', amount: '0' }]);
    };

    const handleRemoveRow = (index: number) => {
        if (formItems.length === 1) return;
        setFormItems(formItems.filter((_, i) => i !== index));
    };

    const handleItemChange = (index: number, field: string, value: string) => {
        const newItems = [...formItems];
        newItems[index] = { ...newItems[index], [field]: value };
        setFormItems(newItems);
    };

    const handleCreateInvoiceSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nombreCliente.trim()) {
            toast.error('El nombre del cliente es requerido');
            return;
        }

        // Validate items
        const validItems = formItems.filter(item => item.item_detail.trim());
        if (validItems.length === 0) {
            toast.error('Debe agregar al menos un ítem con descripción');
            return;
        }

        setIsSubmitting(true);
        try {
            const companyId = profile!.company_id;
            const nextInvoiceNum = await invoicesService.getNextInvoiceNumber(companyId);

            const itemsMapped = validItems.map(item => ({
                item_detail: item.item_detail,
                stock_number: item.stock_number || undefined,
                tag_number: item.tag_number || undefined,
                amount: Number(item.amount) || 0
            }));

            const subtotalSum = itemsMapped.reduce((sum, item) => sum + item.amount, 0);
            const ivaSum = subtotalSum * (ivaPercent / 100);
            const totalSum = subtotalSum + ivaSum;

            const invoiceData = {
                company_id: companyId,
                numero_factura: nextInvoiceNum,
                status: 'unpaid' as const,
                nombre_cliente: nombreCliente,
                empresa_cliente: empresaCliente || undefined,
                email_cliente: emailCliente || undefined,
                telefono_cliente: telefonoCliente || undefined,
                customer_po: customerPo || undefined,
                workorder: workorder || undefined,
                truck: shipVia || undefined,
                salesperson: salesperson || undefined,
                due_date: dueDate || undefined,
                date_shipped: dateShipped || undefined,
                
                bill_to_name: billToName || nombreCliente,
                bill_to_company: billToCompany || empresaCliente || undefined,
                bill_to_account: billToAccount || undefined,
                bill_to_address: billToAddress || undefined,
                
                ship_to_name: shipToName || nombreCliente,
                ship_to_company: shipToCompany || empresaCliente || undefined,
                ship_to_address: shipToAddress || undefined,
                
                items: itemsMapped,
                subtotal: subtotalSum,
                iva: ivaSum,
                total: totalSum,
                notas: notas || undefined
            };

            const created = await invoicesService.createInvoice(invoiceData);
            toast.success(`Factura ${created.numero_factura} creada con éxito`);
            
            // Reset state
            setIsCreateModalOpen(false);
            setNombreCliente('');
            setEmpresaCliente('');
            setEmailCliente('');
            setTelefonoCliente('');
            setCustomerPo('');
            setWorkorder('');
            setShipVia('');
            setSalesperson('');
            setDueDate('');
            setDateShipped('');
            setBillToName('');
            setBillToCompany('');
            setBillToAccount('');
            setBillToAddress('');
            setShipToName('');
            setShipToCompany('');
            setShipToAddress('');
            setNotas('');
            setFormItems([{ item_detail: '', stock_number: '', tag_number: '', amount: '0' }]);
            
            // Reload list
            loadInvoices();
        } catch (error: any) {
            console.error('Error creating manual invoice:', error);
            toast.error('No se pudo crear la factura: ' + (error?.message || error));
        } finally {
            setIsSubmitting(false);
        }
    };

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

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
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
                    {isAdmin && (
                        <Button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="h-[46px] px-5 bg-[#4449AA] hover:bg-[#353985] text-white font-black text-[11px] uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Nueva Factura</span>
                        </Button>
                    )}
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

            {/* Manual Invoice Creation Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-4xl rounded-[28px] shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto flex flex-col animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="sticky top-0 bg-white z-10 px-8 py-5 border-b border-slate-100 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-black text-slate-900">Crear Factura Directa</h2>
                                <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                                    Genera una factura manual sin asociar una cotización previa
                                </p>
                            </div>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body / Form */}
                        <form onSubmit={handleCreateInvoiceSubmit} className="p-8 space-y-8 flex-1">
                            {/* Section 1: Customer Details */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest border-b border-blue-50 pb-1">
                                    1. Datos del Cliente
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nombre del Cliente *</label>
                                        <input
                                            type="text"
                                            required
                                            value={nombreCliente}
                                            onChange={(e) => setNombreCliente(e.target.value)}
                                            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-xs focus:outline-none focus:ring-2 focus:ring-[#4449AA]/10 focus:border-[#4449AA] transition-all"
                                            placeholder="Ej. Juan Pérez"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nombre de Empresa</label>
                                        <input
                                            type="text"
                                            value={empresaCliente}
                                            onChange={(e) => setEmpresaCliente(e.target.value)}
                                            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-xs focus:outline-none focus:ring-2 focus:ring-[#4449AA]/10 focus:border-[#4449AA] transition-all"
                                            placeholder="Ej. Arias Defense LLC"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Correo Electrónico</label>
                                        <input
                                            type="email"
                                            value={emailCliente}
                                            onChange={(e) => setEmailCliente(e.target.value)}
                                            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-xs focus:outline-none focus:ring-2 focus:ring-[#4449AA]/10 focus:border-[#4449AA] transition-all"
                                            placeholder="cliente@correo.com"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Teléfono</label>
                                        <input
                                            type="text"
                                            value={telefonoCliente}
                                            onChange={(e) => setTelefonoCliente(e.target.value)}
                                            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-xs focus:outline-none focus:ring-2 focus:ring-[#4449AA]/10 focus:border-[#4449AA] transition-all"
                                            placeholder="+503 7000-0000"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Order Metadata */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest border-b border-blue-50 pb-1">
                                    2. Datos del Envío y Referencia (US Standards)
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Customer PO</label>
                                        <input
                                            type="text"
                                            value={customerPo}
                                            onChange={(e) => setCustomerPo(e.target.value)}
                                            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-xs focus:outline-none focus:ring-2 focus:ring-[#4449AA]/10 focus:border-[#4449AA] transition-all"
                                            placeholder="PO-XXXX"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Work Order</label>
                                        <input
                                            type="text"
                                            value={workorder}
                                            onChange={(e) => setWorkorder(e.target.value)}
                                            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-xs focus:outline-none focus:ring-2 focus:ring-[#4449AA]/10 focus:border-[#4449AA] transition-all"
                                            placeholder="WO-XXXX"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Ship Via / Truck</label>
                                        <input
                                            type="text"
                                            value={shipVia}
                                            onChange={(e) => setShipVia(e.target.value)}
                                            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-xs focus:outline-none focus:ring-2 focus:ring-[#4449AA]/10 focus:border-[#4449AA] transition-all"
                                            placeholder="Ej. FedEx / DHL"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Vendedor</label>
                                        <input
                                            type="text"
                                            value={salesperson}
                                            onChange={(e) => setSalesperson(e.target.value)}
                                            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-xs focus:outline-none focus:ring-2 focus:ring-[#4449AA]/10 focus:border-[#4449AA] transition-all"
                                            placeholder="Vendedor asignado"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Vencimiento</label>
                                        <input
                                            type="date"
                                            value={dueDate}
                                            onChange={(e) => setDueDate(e.target.value)}
                                            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-xs focus:outline-none focus:ring-2 focus:ring-[#4449AA]/10 focus:border-[#4449AA] transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fecha Envío</label>
                                        <input
                                            type="date"
                                            value={dateShipped}
                                            onChange={(e) => setDateShipped(e.target.value)}
                                            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-xs focus:outline-none focus:ring-2 focus:ring-[#4449AA]/10 focus:border-[#4449AA] transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Billing & Shipping Addresses */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b border-blue-50 pb-1">
                                    <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest">
                                        3. Facturación (Bill To) y Envío (Ship To)
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setBillToName(nombreCliente);
                                            setBillToCompany(empresaCliente);
                                            setShipToName(nombreCliente);
                                            setShipToCompany(empresaCliente);
                                        }}
                                        className="text-[10px] font-black text-[#4449AA] hover:underline uppercase tracking-wider"
                                    >
                                        Autocompletar con cliente
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Bill To Card */}
                                    <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/30 space-y-3">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Facturar A (Bill To)</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase">Nombre</label>
                                                <input
                                                    type="text"
                                                    value={billToName}
                                                    onChange={(e) => setBillToName(e.target.value)}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase">Empresa</label>
                                                <input
                                                    type="text"
                                                    value={billToCompany}
                                                    onChange={(e) => setBillToCompany(e.target.value)}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase">Cuenta Cliente</label>
                                                <input
                                                    type="text"
                                                    value={billToAccount}
                                                    onChange={(e) => setBillToAccount(e.target.value)}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs"
                                                    placeholder="Ej. ACC-987"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase">Dirección de Facturación</label>
                                                <textarea
                                                    rows={2}
                                                    value={billToAddress}
                                                    onChange={(e) => setBillToAddress(e.target.value)}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:outline-none"
                                                    placeholder="Calle, Ciudad, Estado, ZIP"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Ship To Card */}
                                    <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/30 space-y-3">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Enviar A (Ship To)</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase">Nombre Receptor</label>
                                                <input
                                                    type="text"
                                                    value={shipToName}
                                                    onChange={(e) => setShipToName(e.target.value)}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-slate-400 uppercase">Empresa Destino</label>
                                                <input
                                                    type="text"
                                                    value={shipToCompany}
                                                    onChange={(e) => setShipToCompany(e.target.value)}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase">Dirección de Envío</label>
                                            <textarea
                                                rows={4}
                                                value={shipToAddress}
                                                onChange={(e) => setShipToAddress(e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:outline-none"
                                                placeholder="Calle, Ciudad, Estado, ZIP"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 4: Invoice Items */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b border-blue-50 pb-1">
                                    <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest">
                                        4. Detalle de Ítems
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={handleAddRow}
                                        className="text-[10px] font-black text-white bg-slate-900 px-3 py-1.5 rounded-xl hover:bg-slate-800 uppercase tracking-wider flex items-center gap-1.5"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Agregar Ítem</span>
                                    </button>
                                </div>

                                <div className="border border-slate-100 rounded-2xl overflow-hidden">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                                <th className="px-4 py-2.5">Stock #</th>
                                                <th className="px-4 py-2.5">Tag #</th>
                                                <th className="px-4 py-2.5 w-[50%]">Descripción del Ítem *</th>
                                                <th className="px-4 py-2.5 text-right">Inversión (USD)</th>
                                                <th className="px-4 py-2.5 text-center w-12"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {formItems.map((item, idx) => (
                                                <tr key={idx} className="bg-white hover:bg-slate-50/10">
                                                    <td className="px-4 py-2.5">
                                                        <input
                                                            type="text"
                                                            value={item.stock_number}
                                                            onChange={(e) => handleItemChange(idx, 'stock_number', e.target.value)}
                                                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-slate-50/30 text-xs font-mono"
                                                            placeholder="Stock #"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <input
                                                            type="text"
                                                            value={item.tag_number}
                                                            onChange={(e) => handleItemChange(idx, 'tag_number', e.target.value)}
                                                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-slate-50/30 text-xs font-mono"
                                                            placeholder="Tag #"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <input
                                                            type="text"
                                                            value={item.item_detail}
                                                            onChange={(e) => handleItemChange(idx, 'item_detail', e.target.value)}
                                                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-extrabold"
                                                            placeholder="Ej. Servicio de Mantenimiento de Turbina"
                                                            required
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={item.amount}
                                                            onChange={(e) => handleItemChange(idx, 'amount', e.target.value)}
                                                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-black text-right"
                                                            placeholder="0.00"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2.5 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveRow(idx)}
                                                            disabled={formItems.length === 1}
                                                            className="p-1.5 text-slate-300 hover:text-rose-500 disabled:opacity-30 rounded-lg transition-all"
                                                        >
                                                            <Trash className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Section 5: Totals, Taxes & Notes */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-4">
                                <div className="md:col-span-7 space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Notas de la Factura</label>
                                        <textarea
                                            rows={4}
                                            value={notas}
                                            onChange={(e) => setNotas(e.target.value)}
                                            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-xs focus:outline-none"
                                            placeholder="Términos y condiciones, detalles de pago..."
                                        />
                                    </div>
                                </div>

                                <div className="md:col-span-5 p-5 rounded-2xl bg-slate-50/50 border border-slate-100 space-y-3 text-xs">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-slate-400 uppercase">Subtotal</span>
                                        <span className="font-extrabold text-slate-700">
                                            ${formItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center gap-4">
                                        <span className="font-bold text-slate-400 uppercase">Tasa de IVA (%)</span>
                                        <input
                                            type="number"
                                            value={ivaPercent}
                                            onChange={(e) => setIvaPercent(Number(e.target.value) || 0)}
                                            className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-right font-black"
                                        />
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-slate-400 uppercase">IVA Calculado</span>
                                        <span className="font-extrabold text-slate-700">
                                            ${(formItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) * (ivaPercent / 100)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="h-px bg-slate-200 my-1"></div>
                                    <div className="flex justify-between items-center text-sm font-black">
                                        <span className="text-slate-900 uppercase">Total Facturado</span>
                                        <span className="text-[#4449AA]">
                                            ${(formItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) * (1 + ivaPercent / 100)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-5 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500"
                                >
                                    Cancelar
                                </button>
                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-6 py-2.5 bg-[#4449AA] hover:bg-[#353985] text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Guardando...</span>
                                        </>
                                    ) : (
                                        <span>Crear Factura</span>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
