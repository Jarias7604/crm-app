import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { format } from 'date-fns';
import { Building2, Mail, Phone, ArrowLeft, Trash2, Printer, CheckCircle, AlertTriangle, XCircle, CreditCard } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { invoicesService, type Invoice } from '../services/invoices';
import toast from 'react-hot-toast';
import { useAuth } from '../auth/AuthProvider';

export default function FacturaDetalle() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { profile } = useAuth();
    const isAdmin = profile?.role === 'super_admin' || profile?.role === 'company_admin';

    const [invoice, setInvoice] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    useEffect(() => {
        if (id) {
            fetchInvoice();
        }
    }, [id]);

    async function fetchInvoice() {
        try {
            setLoading(true);
            const data = await invoicesService.getInvoice(id!);
            setInvoice(data);
        } catch (error) {
            console.error('Error fetching invoice:', error);
            toast.error('No se pudo cargar la factura');
        } finally {
            setLoading(false);
        }
    }

    const handlePrint = () => {
        window.print();
    };

    const handleUpdateStatus = async (newStatus: 'paid' | 'void' | 'unpaid') => {
        if (!invoice) return;
        const confirmMsg = newStatus === 'paid' 
            ? '¿Estás seguro de marcar esta factura como PAGADA?' 
            : newStatus === 'void' 
                ? '¿Estás seguro de ANULAR esta factura?' 
                : '¿Estás seguro de marcar esta factura como PENDIENTE?';
        
        if (!window.confirm(confirmMsg)) return;

        setIsUpdatingStatus(true);
        try {
            await invoicesService.updateInvoice(invoice.id, { status: newStatus });
            toast.success(`Factura actualizada a ${newStatus === 'paid' ? 'Pagada' : newStatus === 'void' ? 'Anulada' : 'Pendiente'}`);
            fetchInvoice();
        } catch (error) {
            console.error('Error updating invoice status:', error);
            toast.error('No se pudo actualizar el estado');
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleDelete = async () => {
        if (!invoice) return;
        if (!window.confirm('¿Estás seguro de eliminar esta factura permanentemente?')) return;

        try {
            await invoicesService.deleteInvoice(invoice.id);
            toast.success('Factura eliminada');
            navigate('/facturas');
        } catch (error) {
            console.error('Error deleting invoice:', error);
            toast.error('No se pudo eliminar la factura');
        }
    };

    if (loading) return <div className="p-8 text-center">Cargando factura...</div>;
    if (!invoice) return <div className="p-8 text-center text-red-500">Factura no encontrada</div>;

    const getStatusText = (status: string) => {
        switch (status) {
            case 'paid': return 'PAGADA';
            case 'void': return 'ANULADA';
            case 'unpaid': return 'PENDIENTE';
            case 'draft': return 'BORRADOR';
            case 'refunded': return 'REEMBOLSADA';
            default: return status.toUpperCase();
        }
    };

    return (
        <div className="min-h-screen bg-gray-50/50 pb-20 print:bg-white print:pb-0">
            {/* Action Bar */}
            <div className="sticky top-0 z-40 bg-white border-b border-gray-200 w-full shadow-sm print:hidden">
                <div className="h-16 sm:h-20 px-4 sm:px-12 flex justify-between items-center w-full">
                    <div className="flex items-center gap-2 sm:gap-6">
                        <Button
                            variant="ghost"
                            onClick={() => navigate('/facturas')}
                            className="text-gray-400 hover:text-gray-900 group flex items-center gap-1 sm:gap-2 px-0 hover:bg-transparent"
                        >
                            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                            <span className="text-sm font-bold uppercase tracking-widest hidden sm:inline">Volver</span>
                        </Button>

                        <div className="h-8 w-px bg-gray-100 hidden sm:block"></div>

                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] leading-none mb-1">Factura</span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm sm:text-base font-black text-slate-900 leading-none">{invoice.numero_factura}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-4">
                        <Button
                            variant="default"
                            onClick={handlePrint}
                            className="h-10 sm:h-12 px-3 sm:px-8 rounded-xl bg-[#4449AA] hover:bg-[#383d8f] text-white shadow-lg shadow-[#4449AA]/20 font-black text-[11px] uppercase tracking-widest flex items-center gap-2 transition-all"
                        >
                            <Printer className="w-4 h-4" />
                            <span className="hidden sm:inline">Imprimir / Guardar PDF</span>
                        </Button>

                        {/* Admin actions to update invoice status */}
                        {isAdmin && invoice.status !== 'paid' && invoice.status !== 'void' && (
                            <Button
                                variant="default"
                                onClick={() => handleUpdateStatus('paid')}
                                disabled={isUpdatingStatus}
                                className="h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-2"
                            >
                                <CheckCircle className="w-4 h-4" />
                                <span>Marcar Pagada</span>
                            </Button>
                        )}

                        {isAdmin && invoice.status === 'paid' && (
                            <div className="h-12 px-6 flex items-center gap-2 bg-green-50 text-green-600 font-black text-[11px] uppercase tracking-widest rounded-xl border border-green-200">
                                <CheckCircle className="w-4 h-4" />
                                Pagada
                            </div>
                        )}

                        {isAdmin && invoice.status !== 'void' && (
                            <Button
                                variant="default"
                                onClick={() => handleUpdateStatus('void')}
                                disabled={isUpdatingStatus}
                                className="h-12 px-6 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 font-black text-[11px] uppercase tracking-widest rounded-xl flex items-center gap-2"
                            >
                                <XCircle className="w-4 h-4" />
                                <span>Anular Factura</span>
                            </Button>
                        )}

                        {invoice.status === 'void' && (
                            <div className="h-12 px-6 flex items-center gap-2 bg-red-50 text-red-600 font-black text-[11px] uppercase tracking-widest rounded-xl border border-red-200">
                                <XCircle className="w-4 h-4" />
                                Anulada
                            </div>
                        )}

                        {isAdmin && (
                            <>
                                <div className="h-8 w-px bg-gray-100 hidden md:block mx-1"></div>
                                <Button
                                    variant="ghost"
                                    onClick={handleDelete}
                                    className="hidden md:flex h-12 w-12 p-0 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Print styling injection */}
            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    body {
                        background-color: white !important;
                        color: black !important;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                    .print\\:shadow-none {
                        box-shadow: none !important;
                    }
                    .print\\:border-none {
                        border: none !important;
                    }
                    .print\\:m-0 {
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .min-h-screen {
                        min-height: auto !important;
                    }
                }
            `}} />

            <div className="max-w-5xl mx-auto mt-6 px-4 print:mt-0 print:px-0">
                {/* Invoice Document */}
                <div className="bg-white shadow-2xl rounded-3xl overflow-hidden border border-gray-100 print:shadow-none print:border-none print:m-0">
                    {/* Visual Header */}
                    <div className="bg-[#0f172a] py-6 px-8 md:py-8 md:px-12 text-white border-b border-gray-800 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-blue-900/20 to-transparent"></div>

                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                            <div className="flex flex-col gap-4">
                                <div className="h-16 flex items-center">
                                    {invoice.company?.logo_url ? (
                                        <img src={invoice.company.logo_url} alt="" className="max-h-full object-contain" />
                                    ) : (
                                        <div className="flex items-center gap-2 text-blue-400">
                                            <Building2 className="w-10 h-10" />
                                            <span className="text-2xl font-black uppercase tracking-tighter">BRAND</span>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-xl font-black tracking-tight leading-none text-white uppercase opacity-95">
                                        {invoice.company?.name || 'SU EMPRESA'}
                                    </h2>
                                    <div className="flex flex-col text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1.5 gap-0.5">
                                        <p className="opacity-80 flex items-center gap-2">
                                            {invoice.company?.address || 'Dirección de la Empresa'}
                                            {invoice.company?.phone && <><span className="w-1 h-1 rounded-full bg-gray-700"></span> {invoice.company.phone}</>}
                                        </p>
                                        <p className="text-blue-400 font-extrabold">
                                            {invoice.company?.website?.replace(/^https?:\/\//, '') || 'WWW.SUWEBSITE.COM'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col items-start md:items-end gap-2">
                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em]">Factura Comercial</p>
                                <h1 className="text-5xl font-light tracking-tighter text-white uppercase leading-none">
                                    {invoice.numero_factura}
                                </h1>
                                <div className="w-24 h-0.5 bg-blue-500/30 rounded-full mt-2 self-start md:self-end"></div>
                                <div className="flex gap-8 mt-2">
                                    <div className="text-left md:text-right">
                                        <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest leading-none mb-1">Fecha Emisión</p>
                                        <p className="text-[11px] font-bold text-gray-300">{invoice.created_at ? format(new Date(invoice.created_at), 'dd/MM/yyyy') : '--/--/----'}</p>
                                    </div>
                                    <div className="text-left md:text-right">
                                        <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest leading-none mb-1">Vencimiento</p>
                                        <p className="text-[11px] font-bold text-gray-300">
                                            {invoice.due_date ? format(new Date(invoice.due_date), 'dd/MM/yyyy') : 'Contra Entrega'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 sm:p-8 md:p-14 space-y-10 bg-white text-slate-900">
                        {/* Section 1: Customer Info & Status */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                            <div className="md:col-span-7 space-y-4">
                                <div>
                                    <p className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] mb-2">FACTURADO A</p>
                                    <h3 className="text-3xl font-extrabold text-slate-900 tracking-tighter leading-none mb-1.5">
                                        {invoice.nombre_cliente}
                                    </h3>
                                    {invoice.empresa_cliente && (
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                            <p className="text-blue-600 font-black text-[10px] uppercase tracking-widest">{invoice.empresa_cliente}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-100">
                                    <div className="bg-slate-50 border border-slate-200/60 rounded-xl px-3.5 py-2 flex items-center gap-2.5 text-xs text-slate-700">
                                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="font-bold truncate">{invoice.email_cliente || 'Sin email'}</span>
                                    </div>
                                    {invoice.telefono_cliente && (
                                        <div className="bg-slate-50 border border-slate-200/60 rounded-xl px-3.5 py-2 flex items-center gap-2.5 text-xs text-slate-700">
                                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                                            <span className="font-bold">{invoice.telefono_cliente}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="md:col-span-5 flex flex-col items-start md:items-end">
                                <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2">ESTADO DE PAGO</p>
                                <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Monto Total Factura</p>
                                    <p className="text-2xl font-black text-slate-950 tracking-tight leading-none mb-2">
                                        ${Number(invoice.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                    <div className="flex justify-center">
                                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 border ${invoice.status === 'paid' ? 'bg-green-50 text-green-600 border-green-100' :
                                            invoice.status === 'unpaid' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                'bg-slate-100 text-slate-500 border-slate-200'
                                            }`}>
                                            <span className={`w-1 h-1 rounded-full ${invoice.status === 'paid' ? 'bg-green-600' :
                                                invoice.status === 'unpaid' ? 'bg-amber-500' : 'bg-slate-400'
                                                }`}></span>
                                            {getStatusText(invoice.status)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: US style Invoice Meta Table */}
                        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/80 border-b border-slate-200 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                            <th className="px-4 py-3 border-r border-slate-200">Invoice Date</th>
                                            <th className="px-4 py-3 border-r border-slate-200">Due Date</th>
                                            <th className="px-4 py-3 border-r border-slate-200">Payment Terms</th>
                                            <th className="px-4 py-3 border-r border-slate-200">Customer PO</th>
                                            <th className="px-4 py-3 border-r border-slate-200">Work Order</th>
                                            <th className="px-4 py-3 border-r border-slate-200">Ship Date</th>
                                            <th className="px-4 py-3">Ship Via / Salesperson</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="font-bold text-slate-800 bg-white">
                                            <td className="px-4 py-3.5 border-r border-slate-200">
                                                {invoice.created_at ? format(new Date(invoice.created_at), 'dd/MM/yyyy') : '--/--/----'}
                                            </td>
                                            <td className="px-4 py-3.5 border-r border-slate-200 text-indigo-700">
                                                {invoice.due_date ? format(new Date(invoice.due_date), 'dd/MM/yyyy') : 'Contra Entrega'}
                                            </td>
                                            <td className="px-4 py-3.5 border-r border-slate-200 text-slate-600 font-extrabold">
                                                {invoice.due_date ? 'Net 30' : 'Due on Receipt'}
                                            </td>
                                            <td className="px-4 py-3.5 border-r border-slate-200 text-slate-600">
                                                {invoice.customer_po || '--'}
                                            </td>
                                            <td className="px-4 py-3.5 border-r border-slate-200 text-slate-600">
                                                {invoice.workorder || '--'}
                                            </td>
                                            <td className="px-4 py-3.5 border-r border-slate-200 text-slate-500">
                                                {invoice.date_shipped ? format(new Date(invoice.date_shipped), 'dd/MM/yyyy') : '--'}
                                            </td>
                                            <td className="px-4 py-3.5 text-slate-500">
                                                <div className="flex flex-col">
                                                    <span>{invoice.truck || 'FedEx'}</span>
                                                    {invoice.salesperson && <span className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">{invoice.salesperson}</span>}
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Section 3: Dual Addresses (Bill To & Ship To) */}
                        {(invoice.bill_to_address || invoice.ship_to_address) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                                {invoice.bill_to_address ? (
                                    <div className="bg-slate-50/60 p-5 rounded-2xl border border-slate-200/50">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Facturar A (Bill To)</h4>
                                        <p className="text-sm font-extrabold text-slate-900">{invoice.bill_to_company || invoice.bill_to_name || invoice.nombre_cliente}</p>
                                        {invoice.bill_to_account && <p className="text-[11px] text-gray-500 font-bold uppercase mt-0.5">Cuenta: {invoice.bill_to_account}</p>}
                                        <p className="text-xs text-slate-600 mt-2 leading-relaxed whitespace-pre-wrap font-medium">{invoice.bill_to_address}</p>
                                    </div>
                                ) : (
                                    <div className="bg-slate-50/60 p-5 rounded-2xl border border-slate-200/50">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Facturar A (Bill To)</h4>
                                        <p className="text-sm font-extrabold text-slate-900">{invoice.nombre_cliente}</p>
                                        {invoice.empresa_cliente && <p className="text-xs text-slate-600 font-bold uppercase">{invoice.empresa_cliente}</p>}
                                    </div>
                                )}
                                {invoice.ship_to_address && (
                                    <div className="bg-slate-50/60 p-5 rounded-2xl border border-slate-200/50">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Enviar A (Ship To)</h4>
                                        <p className="text-sm font-extrabold text-slate-900">{invoice.ship_to_company || invoice.ship_to_name || invoice.nombre_cliente}</p>
                                        <p className="text-xs text-slate-600 mt-2 leading-relaxed whitespace-pre-wrap font-medium">{invoice.ship_to_address}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Section 4: Items Table */}
                        <div className="space-y-4 pt-4">
                            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
                                <h3 className="text-xs font-black uppercase tracking-widest text-[#4449AA]">Detalle de Ítems</h3>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                            <th className="py-2.5">Part / Stock #</th>
                                            <th className="py-2.5">Tag #</th>
                                            <th className="py-2.5">Descripción del Ítem</th>
                                            <th className="py-2.5 text-right">Inversión (USD)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {invoice.items && invoice.items.length > 0 ? (
                                            invoice.items.map((item: any, idx: number) => (
                                                <tr key={idx} className="hover:bg-slate-50/20">
                                                    <td className="py-3.5 font-mono text-slate-600 font-bold">
                                                        {item.stock_number || '--'}
                                                    </td>
                                                    <td className="py-3.5 font-mono text-slate-500 font-bold">
                                                        {item.tag_number || '--'}
                                                    </td>
                                                    <td className="py-3.5">
                                                        <span className="font-extrabold text-slate-900">{item.item_detail}</span>
                                                    </td>
                                                    <td className="py-3.5 text-right font-black text-slate-900">
                                                        ${Number(item.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={4} className="py-8 text-center text-slate-400">Sin ítems definidos</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Section 5: Totals & Notes */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-6 border-t border-slate-200">
                            <div className="md:col-span-7">
                                {invoice.notas && (
                                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                                        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Términos y Notas de Envío</h4>
                                        <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">{invoice.notas}</p>
                                    </div>
                                )}
                            </div>

                            <div className="md:col-span-5 space-y-2.5">
                                <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-widest">
                                    <span>Subtotal</span>
                                    <span className="font-black text-slate-800">${Number(invoice.subtotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-widest">
                                    <span>IVA (13%)</span>
                                    <span className="font-black text-slate-800">${Number(invoice.iva || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                {invoice.fuel_charge && invoice.fuel_charge > 0 && (
                                    <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-widest">
                                        <span>Fuel Charge</span>
                                        <span className="font-black text-slate-800">${Number(invoice.fuel_charge).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                )}
                                <div className="h-px bg-slate-200 my-2"></div>
                                <div className="flex justify-between items-center text-sm font-black text-slate-900 uppercase tracking-widest">
                                    <span>Total Facturado</span>
                                    <span className="text-lg font-black text-[#4449AA]">
                                        ${Number(invoice.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
