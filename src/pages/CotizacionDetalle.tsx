import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Printer,
    ArrowLeft,
    Mail,
    MessageSquare,
    CheckCircle,
    XCircle,
    Building2,
    FileText,
    Target,
    Package,
    Globe,
    Settings
} from 'lucide-react';
import { cotizacionesService } from '../services/cotizaciones';
import { Button } from '../components/ui/Button';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function CotizacionDetalle() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [cotizacion, setCotizacion] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            loadCotizacion();
        }
    }, [id]);

    const loadCotizacion = async () => {
        try {
            setLoading(true);
            const data = await cotizacionesService.getCotizacion(id!);
            setCotizacion(data);
        } catch (error) {
            console.error('Error loading cotizacion:', error);
            toast.error('No se pudo cargar la cotización');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const updateEstado = async (nuevoEstado: string) => {
        try {
            await cotizacionesService.updateEstado(id!, nuevoEstado as any);
            toast.success(`Cotización ${nuevoEstado}`);
            loadCotizacion();
        } catch (error) {
            toast.error('Error al actualizar estado');
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-500 font-medium">Cargando cotización premium...</p>
        </div>
    );

    if (!cotizacion) return (
        <div className="p-12 text-center">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Cotización no encontrada</h2>
            <p className="text-gray-500 mt-2">El documento que buscas no existe o no tienes permisos para verlo.</p>
            <Button onClick={() => navigate('/cotizaciones')} className="mt-6" variant="outline">
                Volver a la lista
            </Button>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-20 px-4 md:px-0">
            {/* Header / Actions - Hidden on print */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
                <Button onClick={() => navigate('/cotizaciones')} variant="outline" className="border-gray-300">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Volver
                </Button>

                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <Button onClick={handlePrint} className="bg-gray-900 hover:bg-black text-white shadow-lg transition-all active:scale-95">
                        <Printer className="w-4 h-4 mr-2" />
                        Imprimir / Guardar PDF
                    </Button>

                    <div className="h-8 w-[1px] bg-gray-200 mx-2 hidden md:block"></div>

                    {cotizacion.estado === 'borrador' && (
                        <Button onClick={() => updateEstado('enviada')} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                            <Mail className="w-4 h-4 mr-2" />
                            Marcar como Enviada
                        </Button>
                    )}

                    {cotizacion.estado === 'enviada' && (
                        <>
                            <Button onClick={() => updateEstado('aceptada')} className="bg-green-600 hover:bg-green-700 text-white shadow-md">
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Aceptar
                            </Button>
                            <Button onClick={() => updateEstado('rechazada')} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                                <XCircle className="w-4 h-4 mr-2" />
                                Rechazar
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Quote Document - This is the "PDF" part */}
            <div className="bg-white shadow-2xl rounded-3xl overflow-hidden border border-gray-100 print:shadow-none print:border-none print:m-0">
                {/* Visual Header */}
                <div className="bg-[#0f172a] py-4 px-6 md:py-5 md:px-10 text-white border-b border-gray-800 relative overflow-hidden">
                    {/* Minimalist background accent */}
                    <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-900/10 to-transparent"></div>

                    <div className="flex flex-col md:flex-row justify-between items-center md:items-end gap-4 relative z-10">
                        {/* Left/Center: Vertical Branding */}
                        <div className="flex flex-col items-center md:items-start gap-3">
                            <div className="w-64 h-20 flex items-center justify-center md:justify-start">
                                {cotizacion.company?.logo_url ? (
                                    <img src={cotizacion.company.logo_url} alt="" className="max-w-full max-h-full object-contain" />
                                ) : (
                                    <div className="flex items-center gap-2 text-blue-500">
                                        <Building2 className="w-8 h-8" />
                                        <span className="text-xl font-black uppercase tracking-tighter">BRAND</span>
                                    </div>
                                )}
                            </div>
                            <div className="text-center md:text-left">
                                <h2 className="text-lg font-black tracking-tight leading-none text-white uppercase opacity-95">
                                    {cotizacion.company?.name || 'SU EMPRESA'}
                                </h2>
                                <div className="flex flex-col text-[10px] text-gray-500 font-bold uppercase tracking-tight mt-1 items-start">
                                    {(cotizacion.company?.address || cotizacion.company?.phone) && (
                                        <p className="opacity-90 flex flex-wrap gap-x-2">
                                            {cotizacion.company?.address && <span>{cotizacion.company.address}</span>}
                                            {cotizacion.company?.address && cotizacion.company?.phone && <span className="opacity-30">•</span>}
                                            {cotizacion.company?.phone && <span>{cotizacion.company.phone}</span>}
                                        </p>
                                    )}
                                    <p className="text-blue-500 font-black tracking-widest text-[10px]">
                                        {cotizacion.company?.website?.replace(/^https?:\/\//, '') || 'WWW.SUWEBSITE.COM'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Right: Refined Quotation Metadata */}
                        <div className="flex flex-col items-center md:items-end space-y-4">
                            <div className="text-center md:text-right">
                                <p className="text-[9px] font-black text-blue-500 uppercase tracking-[0.4em] mb-1">Cotización Oficial</p>
                                <h1 className="text-4xl font-light tracking-tighter text-white">
                                    {cotizacion.id.slice(0, 8).toUpperCase()}
                                </h1>
                            </div>

                            <div className="flex items-center gap-6 border-t border-gray-800 pt-4 w-full md:w-auto justify-center md:justify-end">
                                <div className="text-center md:text-right">
                                    <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest mb-0.5">Fecha Emisión</p>
                                    <p className="text-xs font-bold text-gray-300">{format(new Date(cotizacion.created_at), 'dd/MM/yyyy')}</p>
                                </div>
                                <div className="w-px h-6 bg-gray-800"></div>
                                <div className="text-center md:text-right">
                                    <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest mb-0.5">Referencia ID</p>
                                    <p className="text-xs font-bold text-gray-300">{cotizacion.id.slice(0, 6).toUpperCase()}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 md:p-16 space-y-12">
                    {/* Billing Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                        <div>
                            <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-6">CLIENTE RECEPTOR</h3>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <p className="text-3xl font-extrabold text-[#0f172a] tracking-tight leading-none">{cotizacion.nombre_cliente}</p>
                                    {cotizacion.empresa_cliente && (
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                            <p className="text-blue-600 font-extrabold text-[10px] uppercase tracking-widest">{cotizacion.empresa_cliente}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                                    <div className="space-y-2">
                                        {cotizacion.email_cliente && (
                                            <div className="space-y-1">
                                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest px-1">Contacto</span>
                                                <div className="bg-gray-50/50 p-2.5 rounded-xl border border-gray-100 flex items-center gap-2">
                                                    <Mail className="w-4 h-4 text-blue-400" />
                                                    <p className="text-sm font-bold text-gray-700">{cotizacion.email_cliente}</p>
                                                </div>
                                            </div>
                                        )}
                                        {cotizacion.telefono_cliente && (
                                            <div className="bg-gray-50/50 p-2.5 rounded-xl border border-gray-100 flex items-center gap-2">
                                                <span className="text-lg">📞</span>
                                                <p className="text-sm font-bold text-gray-700">{cotizacion.telefono_cliente}</p>
                                            </div>
                                        )}
                                    </div>
                                    {cotizacion.direccion_cliente && (
                                        <div className="space-y-1">
                                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest px-1">Ubicación</span>
                                            <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100 flex items-start gap-2 min-h-[82px]">
                                                <span className="text-lg mt-0.5">📍</span>
                                                <p className="text-sm font-bold text-gray-700 leading-relaxed">{cotizacion.direccion_cliente}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="md:text-right flex flex-col items-start md:items-end">
                            <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-6">RESUMEN EJECUTIVO</h3>
                            <div className="space-y-4 w-full">
                                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 inline-block md:ml-auto">
                                    <p className="text-sm font-bold text-gray-400 uppercase mb-1">Plan Seleccionado</p>
                                    <p className="text-xl font-black text-[#4449AA]">{cotizacion.plan_nombre}</p>
                                </div>
                                <p className="text-gray-600 font-medium">Volumen Transaccional: <span className="text-gray-900 font-black">{cotizacion.volumen_dtes.toLocaleString()} DTEs/año</span></p>
                                <div className={`inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase border ${cotizacion.estado === 'aceptada' ? 'bg-green-50 text-green-600 border-green-100' :
                                    cotizacion.estado === 'enviada' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                        'bg-gray-100 text-gray-500 border-gray-200'
                                    }`}>
                                    • {cotizacion.estado}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="space-y-6">
                        <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">DESGLOSE DE INVERSIÓN</h3>
                        <div className="border border-gray-100 rounded-3xl overflow-hidden shadow-sm bg-white">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50 border-b border-gray-100">
                                        <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Descripción del Servicio</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Inversión (USD)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    <tr className="hover:bg-gray-50/30 transition-colors">
                                        <td className="px-8 py-7">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                                                    <Package className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <p className="font-black text-gray-900 text-lg">Licencia Anual {cotizacion.plan_nombre}</p>
                                                    <p className="text-sm text-gray-500 font-medium mt-0.5">Incluye suite DTE y soporte técnico base.</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-7 text-right font-black text-gray-900 text-xl">
                                            ${cotizacion.costo_plan_anual.toLocaleString()}
                                        </td>
                                    </tr>

                                    {cotizacion.incluir_implementacion && (
                                        <tr className="hover:bg-gray-50/30 transition-colors">
                                            <td className="px-8 py-7">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 shadow-sm">
                                                        <Settings className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-gray-900 text-lg">Implementación y Configuración</p>
                                                        <p className="text-sm text-gray-500 font-medium mt-0.5">Puesta en marcha, capacitación y configuración inicial.</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-7 text-right font-black text-gray-900 text-xl">
                                                ${cotizacion.costo_implementacion.toLocaleString()}
                                            </td>
                                        </tr>
                                    )}

                                    {cotizacion.modulos_adicionales?.map((mod: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-gray-50/30 transition-colors">
                                            <td className="px-8 py-7">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 shadow-sm">
                                                        <FileText className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-gray-900 text-lg">
                                                            {mod.tipo === 'servicio' ? 'Servicio' : 'Módulo'}: {mod.nombre}
                                                        </p>
                                                        <p className="text-sm text-gray-500 font-medium mt-0.5">
                                                            {mod.descripcion || 'Integración nativa con su flujo de trabajo actual.'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-7 text-right font-black text-gray-900 text-xl">
                                                ${mod.costo_anual.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}

                                    {cotizacion.servicio_whatsapp && (
                                        <tr className="hover:bg-gray-50/30 transition-colors">
                                            <td className="px-8 py-7">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 shadow-sm">
                                                        <MessageSquare className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-gray-900 text-lg">Notificaciones Smart-WhatsApp</p>
                                                        <p className="text-sm text-gray-500 font-medium mt-0.5">Automatización de envíos y confirmación de lectura.</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-7 text-right font-black text-gray-900 text-xl">
                                                ${cotizacion.costo_whatsapp.toLocaleString()}
                                            </td>
                                        </tr>
                                    )}

                                    {cotizacion.servicio_personalizacion && (
                                        <tr className="hover:bg-gray-50/30 transition-colors">
                                            <td className="px-8 py-7">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 shadow-sm">
                                                        <Target className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-gray-900 text-lg">Personalización de Marca (White-label)</p>
                                                        <p className="text-sm text-gray-500 font-medium mt-0.5">Adaptación total a su identidad corporativa.</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-7 text-right font-black text-gray-900 text-xl">
                                                ${cotizacion.costo_personalizacion.toLocaleString()}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Totales Section */}
                    <div className="flex flex-col md:flex-row justify-between items-start gap-16 pt-6">
                        <div className="flex-1 max-w-md">
                            <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-6">NOTAS Y CONDICIONES</h3>
                            <div className="bg-gray-50/50 p-6 rounded-3xl border border-gray-100 relative">
                                <p className="text-sm text-gray-600 italic leading-relaxed">
                                    {cotizacion.notes || 'Esta propuesta tiene una validez de 30 días calendario. Los precios no incluyen impuestos locales adicionales a los detallados. SaaS Pro garantiza un SLA del 99.9% en todos los servicios detallados.'}
                                </p>
                                <div className="absolute -top-3 -left-3 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-black">
                                    !
                                </div>
                            </div>
                        </div>

                        <div className="w-full md:w-96 space-y-4">
                            <div className="bg-[#4449AA] p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
                                {/* Decorative circle */}
                                <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all"></div>

                                <div className="space-y-4 relative z-10">
                                    <div className="flex justify-between items-center opacity-80">
                                        <span className="text-xs font-bold uppercase tracking-widest">Subtotal Neto</span>
                                        <span className="text-lg font-bold">${cotizacion.subtotal_anual.toLocaleString()}</span>
                                    </div>

                                    {cotizacion.descuento_monto > 0 && (
                                        <div className="flex justify-between items-center text-green-300">
                                            <span className="text-xs font-bold uppercase tracking-widest">Descuento ({cotizacion.descuento_porcentaje}%)</span>
                                            <span className="text-lg font-bold">-${cotizacion.descuento_monto.toLocaleString()}</span>
                                        </div>
                                    )}

                                    {cotizacion.iva_monto > 0 && (
                                        <div className="flex justify-between items-center opacity-80 border-t border-white/10 pt-4">
                                            <span className="text-xs font-bold uppercase tracking-widest">IVA ({cotizacion.iva_porcentaje}%)</span>
                                            <span className="text-lg font-bold">+${cotizacion.iva_monto.toLocaleString()}</span>
                                        </div>
                                    )}

                                    <div className="pt-4 mt-2 border-t-2 border-white/20">
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">Total a Invertir</p>
                                                <p className="text-4xl font-black tracking-tighter">
                                                    ${cotizacion.total_anual.toLocaleString()}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1 text-green-300">Mensual</p>
                                                <p className="text-xs font-medium opacity-80">
                                                    ${cotizacion.total_mensual.toLocaleString()}/mes
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                Todos los valores expresados en USD
                            </p>
                        </div>
                    </div>
                </div>

                {/* Visual Footer */}
                <div className="bg-gray-50/50 px-12 py-10 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-5">
                        <div className="relative">
                            <div className="w-16 h-16 rounded-2xl bg-[#4449AA] flex items-center justify-center text-white font-black text-xl shadow-lg overflow-hidden border-2 border-white">
                                {cotizacion.creator?.avatar_url ? (
                                    <img src={cotizacion.creator.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    (cotizacion.creator?.full_name || cotizacion.creator?.email || 'A').charAt(0).toUpperCase()
                                )}
                            </div>
                            <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Propuesta Elaborada por</p>
                            <p className="text-lg font-black text-gray-900 leading-tight">{(cotizacion.creator?.full_name || 'Agente Comercial').toUpperCase()}</p>
                            <div className="flex flex-wrap gap-4 mt-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                <span className="flex items-center gap-1.5"><Mail className="w-3 h-3" /> {cotizacion.creator?.email}</span>
                                {cotizacion.creator?.website && (
                                    <span className="flex items-center gap-1.5 text-[#4449AA]"><Globe className="w-3 h-3" /> {cotizacion.creator.website.replace(/^https?:\/\//, '')}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-start gap-6">
                        {(cotizacion.company?.website || cotizacion.creator?.website) && (
                            <div className="flex flex-col items-center hidden md:flex">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 text-center">Visita nuestra web</p>
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(cotizacion.company?.website || cotizacion.creator?.website)}`}
                                    alt="QR Website"
                                    className="w-20 h-20 rounded-lg shadow-md border-2 border-white bg-white p-1.5"
                                />
                            </div>
                        )}
                        <div className="h-10 w-px bg-gray-200 hidden md:block"></div>
                        <div className="text-right">
                            <div className="text-[10px] font-black tracking-widest text-[#4449AA] uppercase">
                                {cotizacion.company?.name || 'SaaS PRO'} - {new Date().getFullYear()}
                            </div>
                            <div className="flex flex-col text-[10px] text-gray-600 font-bold uppercase mt-2 space-y-1 items-end">
                                {cotizacion.company?.address && <span className="flex items-center gap-2"><span className="text-blue-500">📍</span> {cotizacion.company.address}</span>}
                                {cotizacion.company?.phone && <span className="flex items-center gap-2"><span className="text-blue-500">📞</span> {cotizacion.company.phone}</span>}
                            </div>
                            <p className="text-[9px] text-gray-400 font-bold mt-2">DOCUMENTO OFICIAL</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Styling */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { margin: 0; size: auto; }
                    body { background: white !important; margin: 0; padding: 0; }
                    .max-w-5xl { max-width: 100% !important; margin: 0 !important; width: 100% !important; }
                    .print\\:hidden { display: none !important; }
                    .print\\:shadow-none { box-shadow: none !important; }
                    .print\\:border-none { border: none !important; }
                    .print\\:m-0 { margin: 0 !important; border-radius: 0 !important; }
                    .rounded-3xl, .rounded-[2.5rem] { border-radius: 0 !important; }
                    nav, footer, .toaster { display: none !important; }
                    .bg-gradient-to-br { background: #4449AA !important; color: white !important; -webkit-print-color-adjust: exact; }
                    .bg-[#4449AA] { background: #4449AA !important; color: white !important; -webkit-print-color-adjust: exact; }
                    .bg-gray-50 { background: #F9FAFB !important; -webkit-print-color-adjust: exact; }
                }
            `}} />
        </div>
    );
}

