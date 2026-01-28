import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { format } from 'date-fns';
import { Building2, Mail, Phone, Package, Globe, Trash2, Send, Download, ArrowLeft, Settings, FileText, MessageSquare } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { pdfService } from '../services/pdfService';
import { calculateQuoteFinancials, parseModules, type CotizacionData } from '../utils/quoteUtils';
import toast from 'react-hot-toast';

export default function CotizacionDetalle() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [cotizacion, setCotizacion] = useState<CotizacionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

    useEffect(() => {
        fetchCotizacion();
    }, [id]);

    async function fetchCotizacion() {
        try {
            const { data, error } = await supabase
                .from('cotizaciones')
                .select(`
                    *,
                    company:companies(*),
                    creator:profiles(*),
                    lead:leads(*)
                `)
                .eq('id', id)
                .single();

            if (error) throw error;

            // Handle modulos_adicionales parsing
            const parsedData = {
                ...data,
                modulos_adicionales: parseModules(data.modulos_adicionales)
            };

            setCotizacion(parsedData as CotizacionData);
        } catch (error: any) {
            console.error('Error fetching cotizacion:', error);
            toast.error('No se pudo cargar la cotización');
        } finally {
            setLoading(false);
        }
    }

    const handleDownloadPDF = async () => {
        if (!cotizacion) return;
        setIsGeneratingPDF(true);
        try {
            const pdfUrl = await pdfService.generateAndUploadQuotePDF(cotizacion);
            window.open(pdfUrl, '_blank');
            toast.success('PDF generado correctamente');
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast.error('Error al generar el PDF');
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    const handleShareTelegram = () => {
        if (!cotizacion) return;
        const text = `Hola ${cotizacion.nombre_cliente}, adjunto la cotización ${cotizacion.id.slice(0, 8)} para el plan ${cotizacion.plan_nombre}. Puedes verla aquí: ${window.location.href}`;
        window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(text)}`, '_blank');
    };

    const handleDelete = async () => {
        if (!window.confirm('¿Estás seguro de que deseas eliminar esta cotización?')) return;
        try {
            const { error } = await supabase
                .from('cotizaciones')
                .delete()
                .eq('id', id);
            if (error) throw error;
            toast.success('Cotización eliminada');
            navigate('/cotizaciones');
        } catch (error) {
            toast.error('No se pudo eliminar la cotización');
        }
    };

    if (loading) return <div className="p-8 text-center">Cargando cotización...</div>;
    if (!cotizacion) return <div className="p-8 text-center text-red-500">Cotización no encontrada</div>;

    return (
        <div className="min-h-screen bg-gray-50/50 pb-20">
            {/* Action Bar */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-50 px-4 md:px-8 py-4 shadow-sm">
                <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
                    <Button variant="ghost" onClick={() => navigate('/cotizaciones')} className="text-gray-500 hover:text-gray-900 group">
                        <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                        Volver
                    </Button>

                    <div className="flex items-center gap-2 md:gap-3">
                        <Button
                            variant="default"
                            onClick={handleDownloadPDF}
                            disabled={isGeneratingPDF}
                            className={`
                                min-w-[160px] relative transition-all duration-300
                                bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-200/50 
                                hover:shadow-blue-300/50 hover:-translate-y-0.5 active:scale-95
                                disabled:opacity-80 disabled:cursor-not-allowed
                                flex items-center justify-center
                            `}
                        >
                            {isGeneratingPDF ? (
                                <>
                                    <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span className="animate-pulse">Generando...</span>
                                </>
                            ) : (
                                <>
                                    <Download className="w-4 h-4 mr-2" />
                                    Descargar PDF
                                </>
                            )}
                        </Button>
                        <Button
                            variant="default"
                            onClick={handleShareTelegram}
                            className="bg-[#0088cc] text-white hover:bg-[#0077b5]"
                        >
                            <Send className="w-4 h-4 mr-2" />
                            Compartir
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={handleDelete}
                            className="text-red-500 hover:bg-red-50"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto mt-8 px-4">
                {/* Quote Document */}
                <div className="bg-white shadow-2xl rounded-3xl overflow-hidden border border-gray-100 print:shadow-none print:border-none print:m-0">
                    {/* Visual Header - Exact PDF Style */}
                    <div className="bg-[#0f172a] py-6 px-8 md:py-8 md:px-12 text-white border-b border-gray-800 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-blue-900/20 to-transparent"></div>

                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                            <div className="flex flex-col gap-4">
                                <div className="h-16 flex items-center">
                                    {cotizacion.company?.logo_url ? (
                                        <img src={cotizacion.company.logo_url} alt="" className="max-h-full object-contain" />
                                    ) : (
                                        <div className="flex items-center gap-2 text-blue-400">
                                            <Building2 className="w-10 h-10" />
                                            <span className="text-2xl font-black uppercase tracking-tighter">BRAND</span>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-xl font-black tracking-tight leading-none text-white uppercase opacity-95">
                                        {cotizacion.company?.name || 'SU EMPRESA'}
                                    </h2>
                                    <div className="flex flex-col text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1.5 gap-0.5">
                                        <p className="opacity-80 flex items-center gap-2">
                                            {cotizacion.company?.address || 'Dirección de la Empresa'}
                                            {cotizacion.company?.phone && <><span className="w-1 h-1 rounded-full bg-gray-700"></span> {cotizacion.company.phone}</>}
                                        </p>
                                        <p className="text-blue-400 font-extrabold">
                                            {cotizacion.company?.website?.replace(/^https?:\/\//, '') || 'WWW.SUWEBSITE.COM'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col items-start md:items-end gap-2">
                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em]">Cotización Oficial</p>
                                <h1 className="text-5xl font-light tracking-tighter text-white uppercase leading-none">
                                    {cotizacion.id.slice(0, 8)}
                                </h1>
                                <div className="w-24 h-0.5 bg-blue-500/30 rounded-full mt-2 self-start md:self-end"></div>
                                <div className="flex gap-8 mt-2">
                                    <div className="text-left md:text-right">
                                        <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest leading-none mb-1">Fecha Emisión</p>
                                        <p className="text-[11px] font-bold text-gray-300">{cotizacion.created_at ? format(new Date(cotizacion.created_at), 'dd/MM/yyyy') : '--/--/----'}</p>
                                    </div>
                                    <div className="text-left md:text-right">
                                        <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest leading-none mb-1">Referencia ID</p>
                                        <p className="text-[11px] font-bold text-gray-300">#{cotizacion.id.slice(0, 5).toUpperCase()}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 md:p-14 space-y-12 bg-white text-slate-900">
                        {/* Section 2: Prepared For & Executive Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
                            <div className="md:col-span-7 space-y-6 text-slate-900">
                                <div>
                                    <p className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] mb-3">CLIENTE RECEPTOR</p>
                                    <h3 className="text-4xl font-extrabold text-slate-900 tracking-tighter leading-none mb-2">
                                        {cotizacion.nombre_cliente}
                                    </h3>
                                    {cotizacion.empresa_cliente && (
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                            <p className="text-blue-600 font-black text-xs uppercase tracking-widest">{cotizacion.empresa_cliente}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-slate-100">
                                    <div className="bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-2.5 flex items-center gap-3">
                                        <Mail className="w-4 h-4 text-slate-400" />
                                        <span className="text-sm font-bold text-slate-700 truncate">{cotizacion.email_cliente || 'Sin email'}</span>
                                    </div>
                                    {cotizacion.telefono_cliente && (
                                        <div className="bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-2.5 flex items-center gap-3">
                                            <Phone className="w-4 h-4 text-slate-400" />
                                            <span className="text-sm font-bold text-slate-700">{cotizacion.telefono_cliente}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="md:col-span-5 flex flex-col items-start md:items-end">
                                <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mb-3">RESUMEN EJECUTIVO</p>
                                <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 relative overflow-hidden text-center">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-bold">Plan Seleccionado</p>
                                    <p className="text-2xl font-black text-indigo-700 tracking-tight leading-none uppercase">
                                        {cotizacion.plan_nombre}
                                    </p>
                                    <div className="h-px bg-slate-200 my-3 mx-4"></div>
                                    <p className="text-xs text-slate-600 font-medium">
                                        Volumen: <span className="font-bold text-slate-900">{cotizacion.volumen_dtes.toLocaleString()} DTEs/año</span>
                                    </p>
                                    <div className="mt-3 flex justify-center">
                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border ${cotizacion.estado === 'aceptada' ? 'bg-green-50 text-green-600 border-green-100' :
                                            cotizacion.estado === 'enviada' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                'bg-slate-100 text-slate-500 border-slate-200'
                                            }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${cotizacion.estado === 'aceptada' ? 'bg-green-600' :
                                                cotizacion.estado === 'enviada' ? 'bg-blue-600' : 'bg-slate-400'
                                                }`}></span>
                                            {cotizacion.estado}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Tables */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em]">DESGLOSE DE SERVICIOS</p>
                                <p className="text-[8px] font-bold text-slate-400 uppercase">Valores en USD</p>
                            </div>

                            <div className="overflow-hidden border border-slate-200 rounded-2xl shadow-sm bg-slate-50/20">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100/80 border-b border-slate-200">
                                            <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Descripción</th>
                                            <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Inversión</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        <tr className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-6 transition-all">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-600">
                                                        <FileText className="w-5 h-5" />
                                                    </div>
                                                    <span className="font-black text-slate-900">Licencia Anual {cotizacion.plan_nombre}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-6 text-right font-black text-slate-900 text-lg">
                                                ${cotizacion.costo_plan_anual.toLocaleString()}
                                            </td>
                                        </tr>
                                        {cotizacion.incluir_implementacion && (
                                            <tr className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center flex-shrink-0 text-orange-600">
                                                            <Settings className="w-5 h-5" />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-black text-slate-900">Implementación</span>
                                                            <span className="bg-orange-100 text-orange-700 text-[8px] font-black px-1.5 py-0.5 rounded tracking-tighter">PAGO ÚNICO</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6 text-right font-black text-slate-900 text-lg">
                                                    ${cotizacion.costo_implementacion.toLocaleString()}
                                                </td>
                                            </tr>
                                        )}
                                        {cotizacion.servicio_whatsapp && (
                                            <tr className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center flex-shrink-0 text-green-600">
                                                            <MessageSquare className="w-5 h-5" />
                                                        </div>
                                                        <span className="font-black text-slate-900">Servicio WhatsApp</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6 text-right font-black text-slate-900 text-lg">
                                                    ${(cotizacion.costo_whatsapp || 0).toLocaleString()}
                                                </td>
                                            </tr>
                                        )}
                                        {(Array.isArray(cotizacion.modulos_adicionales) ? cotizacion.modulos_adicionales : [])?.map((mod: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center flex-shrink-0 text-purple-600">
                                                            <Package className="w-5 h-5" />
                                                        </div>
                                                        <span className="font-black text-slate-900">{mod.nombre}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6 text-right font-black text-slate-900 text-lg">
                                                    ${mod.costo_anual.toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Section 4: Summary & Terms */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 pt-6">
                            <div className="md:col-span-6 space-y-6">
                                <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em]">NOTAS Y CONDICIONES</p>
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 relative">
                                    <div className="absolute -top-3 left-6 w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-black shadow-sm border border-blue-200">!</div>
                                    <p className="text-sm text-slate-500 italic leading-relaxed pt-2">
                                        {cotizacion.notes || 'Esta propuesta tiene una validez de 30 días calendario. SaaS Pro garantiza un SLA del 99.9% en todos los servicios detallados.'}
                                    </p>
                                </div>
                            </div>

                            <div className="md:col-span-6 space-y-4">
                                {(() => {
                                    const financials = calculateQuoteFinancials(cotizacion);
                                    const {
                                        isMonthly,
                                        pagoInicial,
                                        totalAnual,
                                        subtotalRecurrenteBase,
                                        recargoFinanciamiento,
                                        ivaRecurrente,
                                        totalRecurrenteConIVA
                                    } = financials;

                                    // Local labels
                                    const ivaPctLabel = cotizacion.iva_porcentaje || 13;
                                    const recargoLabel = cotizacion.recargo_mensual_porcentaje || 20;

                                    return (
                                        <>
                                            {pagoInicial > 0 && (
                                                <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 shadow-sm text-slate-900">
                                                    <div className="flex justify-between items-center mb-3">
                                                        <div>
                                                            <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest">PAGO INICIAL</h4>
                                                            <p className="text-[9px] text-orange-400 font-bold">Requerido antes de activar</p>
                                                        </div>
                                                        <Package className="w-5 h-5 text-orange-600" />
                                                    </div>
                                                    <div className="space-y-1.5 border-t border-orange-100 pt-3">
                                                        <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                                                            <span>Implementación + Servicios</span>
                                                            <span className="font-bold text-slate-700">${(pagoInicial / (1 + (cotizacion.iva_porcentaje || 13) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                        </div>
                                                        <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                                                            <span>IVA ({cotizacion.iva_porcentaje || 13}%)</span>
                                                            <span className="font-bold text-orange-600">+$ {(pagoInicial - (pagoInicial / (1 + (cotizacion.iva_porcentaje || 13) / 100))).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                        </div>
                                                        <div className="flex justify-between items-end pt-2 border-t border-orange-200 mt-2">
                                                            <span className="text-[10px] font-black text-slate-900 uppercase">Total a pagar hoy</span>
                                                            <span className="text-xl font-black text-orange-600 tracking-tighter">${pagoInicial.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className={`${isMonthly ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'} border rounded-2xl p-5 shadow-sm text-slate-900`}>
                                                <div className="flex justify-between items-center mb-3">
                                                    <div>
                                                        <h4 className={`text-[10px] font-black ${isMonthly ? 'text-blue-600' : 'text-green-600'} uppercase tracking-widest leading-none`}>
                                                            {isMonthly ? 'PAGO RECURRENTE' : 'PAGO ANUAL'}
                                                        </h4>
                                                        <p className={`text-[9px] ${isMonthly ? 'text-blue-400' : 'text-green-400'} font-bold mt-1`}>
                                                            {isMonthly ? '1 cuota mensual' : 'Pago completo anual'}
                                                        </p>
                                                    </div>
                                                    <Globe className={`w-5 h-5 ${isMonthly ? 'text-blue-600' : 'text-green-600'}`} />
                                                </div>
                                                <div className={`space-y-1.5 border-t ${isMonthly ? 'border-blue-100' : 'border-green-100'} pt-3`}>
                                                    <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                                                        <span>Licencia + Módulos</span>
                                                        <span className="font-bold text-slate-700">${subtotalRecurrenteBase.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                    {isMonthly && (
                                                        <div className="flex justify-between text-[11px] text-blue-600 font-medium">
                                                            <span>+ Recargo ({recargoLabel}%)</span>
                                                            <span className="font-bold">+$ {recargoFinanciamiento.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                                                        <span>IVA ({ivaPctLabel}%)</span>
                                                        <span className={`font-bold ${isMonthly ? 'text-blue-600' : 'text-green-600'}`}>+$ {ivaRecurrente.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                    <div className={`flex justify-between items-end pt-2 border-t ${isMonthly ? 'border-blue-200' : 'border-green-200'} mt-2`}>
                                                        <span className="text-[10px] font-black text-slate-900 uppercase">
                                                            {isMonthly ? 'Cuota mensual' : 'Total recurrente'}
                                                        </span>
                                                        <span className={`text-xl font-black ${isMonthly ? 'text-blue-600' : 'text-green-600'} tracking-tighter`}>
                                                            ${(isMonthly ? (totalRecurrenteConIVA / 1) : totalRecurrenteConIVA).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                            {isMonthly && <span className="text-[10px] opacity-60 ml-0.5">/mes</span>}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-gradient-to-br from-indigo-700 to-purple-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden group">
                                                <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all"></div>
                                                <div className="flex justify-between items-end relative z-10">
                                                    <div>
                                                        <h4 className="text-[10px] font-black uppercase tracking-[0.25em] opacity-60 mb-2">INVERSIÓN GENERAL</h4>
                                                        <p className="text-4xl font-black tracking-tighter">${totalAnual.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                    {/* Visual Footer */}
                    <div className="bg-slate-50 px-10 py-10 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-10">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 rounded-2xl bg-[#0f172a] flex items-center justify-center text-white font-black text-xl shadow-lg border-2 border-white overflow-hidden">
                                {cotizacion.creator?.avatar_url ? (
                                    <img src={cotizacion.creator.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    (cotizacion.creator?.full_name || cotizacion.creator?.email || 'A').charAt(0).toUpperCase()
                                )}
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 font-bold">Propuesta Gestada por</p>
                                <h4 className="text-lg font-black text-slate-900">{(cotizacion.creator?.full_name || 'Agente Comercial').toUpperCase()}</h4>
                                <div className="flex items-center gap-3 mt-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    <span className="flex items-center gap-1.5 truncate max-w-[150px]"><Mail className="w-3 h-3 text-blue-500" /> {cotizacion.creator?.email}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${window.location.href}`} alt="QR" className="w-full h-full grayscale opacity-70" />
                            </div>
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
                    .max-w-7xl, .max-w-5xl { max-width: 100% !important; margin: 0 !important; width: 100% !important; }
                    nav, .Action-Bar, .sticky, .Action-Bar, button { display: none !important; }
                    .bg-white { background: white !important; }
                    .bg-slate-50 { background: #F8FAFC !important; -webkit-print-color-adjust: exact; }
                    .bg-[#0f172a] { background: #0f172a !important; color: white !important; -webkit-print-color-adjust: exact; }
                    .text-slate-900 { color: #0f172a !important; }
                }
            `}} />
        </div>
    );
}
