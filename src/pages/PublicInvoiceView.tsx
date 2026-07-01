import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Building2, Mail, Phone, Printer, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '../components/ui/Button';
import toast from 'react-hot-toast';

export default function PublicInvoiceView() {
    const { id } = useParams<{ id: string }>();
    const [invoice, setInvoice] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (id) {
            fetchInvoice();
        }
    }, [id]);

    async function fetchInvoice() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('facturas')
                .select(`
                    *,
                    company:companies(id, name, logo_url, website, address, phone, industry)
                `)
                .eq('id', id)
                .single();

            if (error) throw error;
            setInvoice(data);
        } catch (error: any) {
            console.error('Error fetching invoice:', error);
            setError(error.message || 'Error al cargar la factura');
            toast.error('No se pudo cargar la factura');
        } finally {
            setLoading(false);
        }
    }

    const handlePrint = () => {
        window.print();
    };

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

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4449AA]"></div>
            </div>
        );
    }

    if (!invoice) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center p-8 bg-white rounded-3xl shadow-xl max-w-md">
                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">Factura no encontrada</h1>
                    <p className="text-slate-500 mt-2 text-sm leading-relaxed">El enlace puede haber expirado o es incorrecto.</p>
                    {error && <p className="mt-4 text-xs text-red-400 font-mono">ERROR: {error}</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50/50 pb-20 print:bg-white print:pb-0">
            {/* Action Bar */}
            <div className="sticky top-0 z-40 bg-white border-b border-gray-200 w-full shadow-sm print:hidden">
                <div className="h-16 sm:h-20 px-4 sm:px-12 flex justify-between items-center w-full max-w-7xl mx-auto">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#4449AA] flex items-center justify-center text-white font-black text-xs sm:text-sm shadow-lg shadow-[#4449AA]/20">
                            {invoice.company?.name?.charAt(0) || 'A'}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs sm:text-base font-black text-slate-900 leading-none">FACTURA {invoice.numero_factura}</span>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">COMPARTIDA POR EL PROVEEDOR</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="default"
                            onClick={handlePrint}
                            className="h-10 sm:h-12 px-3 sm:px-8 rounded-xl bg-[#4449AA] hover:bg-[#383d8f] text-white shadow-lg shadow-[#4449AA]/20 font-black text-[11px] uppercase tracking-widest flex items-center gap-2 transition-all"
                        >
                            <Printer className="w-4 h-4" />
                            <span className="hidden sm:inline">Imprimir / Guardar PDF</span>
                        </Button>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">
                <div className="bg-white rounded-[2.5rem] border border-slate-200/60 overflow-hidden shadow-xl print:border-none print:shadow-none">
                    {/* Header: Dark banner with company logo and invoice summary */}
                    <div className="bg-[#0f172a] p-6 sm:p-10 md:p-14 text-white relative overflow-hidden print:bg-[#0f172a] print:text-white">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] -mr-32 -mt-32"></div>
                        <div className="relative z-10 flex flex-col md:flex-row justify-between gap-8">
                            <div className="space-y-4">
                                <div className="h-16 flex items-center">
                                    {invoice.company?.logo_url ? (
                                        <img src={invoice.company.logo_url} alt="" className="max-h-full object-contain" />
                                    ) : (
                                        <div className="flex items-center gap-2 text-blue-400">
                                            <Building2 className="w-10 h-10" />
                                            <span className="text-2xl font-black uppercase tracking-tighter italic">{invoice.company?.name || 'MI EMPRESA'}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <h2 className="text-xl font-black uppercase tracking-tight opacity-90">{invoice.company?.name || ''}</h2>
                                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em]">{invoice.company?.website?.replace(/^https?:\/\//, '') || ''}</p>
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
                        {/* Customer Info & Status */}
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

                        {/* Invoice Meta Table */}
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

                        {/* Dual Addresses */}
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

                        {/* Items Table */}
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

                        {/* Totals & Notes */}
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
                }
            `}} />
        </div>
    );
}
