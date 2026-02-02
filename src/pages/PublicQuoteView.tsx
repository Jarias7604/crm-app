import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Building2, Package, Globe, Download, FileText, CheckCircle2, User, PencilLine, Mail, Phone, Settings, MessageSquare } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { calculateQuoteFinancials, parseModules, type CotizacionData } from '../utils/quoteUtils';
import { pdfService } from '../services/pdfService';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function PublicQuoteView() {
    const { id } = useParams<{ id: string }>();
    const [cotizacion, setCotizacion] = useState<CotizacionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [isAccepting, setIsAccepting] = useState(false);
    const [signerName, setSignerName] = useState('');
    const [showSignatureModal, setShowSignatureModal] = useState(false);

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
                    creator:profiles(*)
                `)
                .eq('id', id)
                .single();

            if (error) throw error;
            setCotizacion({
                ...data,
                modulos_adicionales: parseModules(data.modulos_adicionales)
            } as CotizacionData);
        } catch (error: any) {
            console.error('Error fetching quote:', error);
            setError(error.message || 'Error desconocido');
            toast.error('No se pudo cargar la propuesta');
        } finally {
            setLoading(false);
        }
    }

    const handleAccept = async () => {
        if (!signerName.trim()) {
            toast.error('Por favor ingresa tu nombre para firmar');
            return;
        }

        setIsAccepting(true);
        try {
            const { error } = await supabase
                .from('cotizaciones')
                .update({
                    estado: 'aceptada',
                    descripcion_pago: `Firmada digitalmente por: ${signerName} el ${new Date().toLocaleString()}`
                })
                .eq('id', id);

            if (error) throw error;

            toast.success('¡Propuesta Aceptada Exitosamente!');
            setShowSignatureModal(false);
            fetchCotizacion();
        } catch (error) {
            toast.error('Error al aceptar la propuesta');
        } finally {
            setIsAccepting(false);
        }
    };

    const handleDownloadPDF = async () => {
        if (!cotizacion) return;
        setIsGeneratingPDF(true);
        try {
            const pdfUrl = await pdfService.generateAndUploadQuotePDF(cotizacion);
            window.open(pdfUrl, '_blank');
        } catch (error) {
            toast.error('Error al descargar PDF');
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
    );

    if (!cotizacion) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="text-center p-8 bg-white rounded-3xl shadow-xl max-w-md">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-bold text-slate-800">Propuesta no encontrada</h1>
                <p className="text-slate-500 mt-2 text-sm leading-relaxed">El enlace puede haber expirado o es incorrecto.</p>

                <div className="mt-8 p-6 bg-slate-50 rounded-2xl text-[10px] text-slate-400 font-mono break-all text-left space-y-3">
                    <p className="flex justify-between border-b border-slate-200/50 pb-2">
                        <span className="font-bold text-slate-500 uppercase tracking-tighter">Entorno:</span>
                        <span>{window.location.host}</span>
                    </p>
                    <p className="flex justify-between border-b border-slate-200/50 pb-2">
                        <span className="font-bold text-slate-500 uppercase tracking-tighter">Proyecto Supabase:</span>
                        <span>{(supabase as any).supabaseUrl}</span>
                    </p>
                    {error && (
                        <div className="pt-1">
                            <span className="font-bold text-slate-500 uppercase tracking-tighter block mb-1">Detalle del Error:</span>
                            <span className="text-red-400 leading-normal">{error}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const financials = calculateQuoteFinancials(cotizacion);

    return (
        <div className="min-h-screen bg-gray-50/50 pb-20 font-sans">
            {/* Action Bar - Replicating CotizacionDetalle but for Public View */}
            <div className="sticky top-0 z-40 bg-white border-b border-gray-200 w-full shadow-sm overflow-hidden">
                <div className="h-20 px-4 md:px-12 flex justify-between items-center w-full max-w-7xl mx-auto">
                    <div className="flex items-center gap-4 md:gap-6">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] leading-none mb-1.5">ID Propuesta</span>
                            <div className="flex items-center gap-2">
                                <span className="text-sm md:text-base font-black text-slate-900 leading-none">#{cotizacion.id.slice(0, 8).toUpperCase()}</span>
                                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[8px] md:text-[9px] font-black text-blue-600 uppercase tracking-tighter">Oficial</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 md:gap-4">
                        <Button
                            variant="default"
                            onClick={handleDownloadPDF}
                            disabled={isGeneratingPDF}
                            className="h-10 md:h-12 px-4 md:px-8 rounded-xl bg-[#4449AA] hover:bg-[#383d8f] text-white font-black text-[9px] md:text-[11px] uppercase tracking-widest shadow-lg shadow-[#4449AA]/20 transition-all"
                        >
                            {isGeneratingPDF ? 'Generando...' : (
                                <span className="flex items-center gap-2"><Download className="w-4 h-4" /> <span className="hidden sm:inline">PDF</span></span>
                            )}
                        </Button>

                        {cotizacion.estado !== 'aceptada' ? (
                            <Button
                                variant="default"
                                onClick={() => setShowSignatureModal(true)}
                                className="h-10 md:h-12 px-4 md:px-8 bg-green-600 hover:bg-green-700 text-white font-black text-[9px] md:text-[11px] uppercase tracking-widest rounded-xl shadow-lg shadow-green-600/20 transition-all"
                            >
                                <span className="flex items-center gap-2 font-black"><CheckCircle2 className="w-4 h-4" /> Aceptar</span>
                            </Button>
                        ) : (
                            <div className="h-10 md:h-12 px-4 md:px-8 flex items-center gap-2 bg-green-50 text-green-600 font-black text-[9px] md:text-[11px] uppercase tracking-widest rounded-xl border border-green-200">
                                <CheckCircle2 className="w-4 h-4 text-green-600" /> ¡Aceptada!
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto mt-6 px-4 md:px-6">
                {/* Success Banner */}
                {cotizacion.estado === 'aceptada' && (
                    <div className="mb-6 bg-green-600 text-white px-8 py-4 rounded-3xl flex items-center justify-between shadow-xl shadow-green-600/20 animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="font-black text-xl leading-none uppercase tracking-tight">Propuesta Aceptada Exitosamente</p>
                                <p className="text-sm opacity-80 mt-1 font-medium">{cotizacion.descripcion_pago}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Quote Document - Exact Style of CotizacionDetalle */}
                <div className="bg-white shadow-2xl rounded-[2.5rem] overflow-hidden border border-gray-100 mb-20">
                    {/* Visual Header - Dark Slate Slate Style */}
                    <div className="bg-[#0f172a] py-10 px-8 md:py-12 md:px-14 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-blue-900/20 to-transparent"></div>

                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative z-10">
                            <div className="flex flex-col gap-6">
                                <div className="h-20 flex items-center">
                                    {cotizacion.company?.logo_url ? (
                                        <img src={cotizacion.company.logo_url} alt="" className="max-h-full object-contain" />
                                    ) : (
                                        <div className="flex items-center gap-2 text-blue-400">
                                            <Building2 className="w-12 h-12" />
                                            <span className="text-3xl font-black uppercase tracking-tighter">BRAND</span>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black tracking-tight leading-none text-white uppercase opacity-95">
                                        {cotizacion.company?.name || 'SU EMPRESA'}
                                    </h2>
                                    <div className="flex flex-col text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-3 gap-1">
                                        <p className="opacity-80">
                                            {cotizacion.company?.address || 'EL SALVADOR'}
                                        </p>
                                        <p className="text-blue-400 font-black">
                                            {cotizacion.company?.website?.replace(/^https?:\/\//, '').toUpperCase() || 'WWW.ARIASDEFENSE.COM'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col items-start md:items-end gap-3">
                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em]">Propuesta Comercial</p>
                                <h1 className="text-6xl font-black tracking-tighter text-white uppercase leading-none">
                                    {cotizacion.id.slice(0, 8)}
                                </h1>
                                <div className="w-24 h-1 bg-blue-500/50 rounded-full mt-2 self-start md:self-end"></div>
                                <div className="flex gap-10 mt-4">
                                    <div className="text-left md:text-right">
                                        <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest leading-none mb-1.5">Fecha Emisión</p>
                                        <p className="text-xs font-bold text-gray-300">{format(new Date(cotizacion.created_at), 'dd / MM / yyyy')}</p>
                                    </div>
                                    <div className="text-left md:text-right">
                                        <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest leading-none mb-1.5">Validez</p>
                                        <p className="text-xs font-bold text-gray-300">30 DÍAS CALENDARIO</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 md:p-14 space-y-16 bg-white">
                        {/* Client Info Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-start">
                            <div className="md:col-span-7 space-y-8">
                                <div>
                                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mb-4">PREPARADO PARA</p>
                                    <h3 className="text-5xl font-black text-slate-900 tracking-tighter leading-none mb-3">
                                        {cotizacion.nombre_cliente}
                                    </h3>
                                    {cotizacion.empresa_cliente && (
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                                            <p className="text-blue-600 font-black text-sm uppercase tracking-widest leading-none">{cotizacion.empresa_cliente}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-8 border-t border-slate-100">
                                    <div className="bg-slate-50 border border-slate-200/60 rounded-2xl px-5 py-4 flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400">
                                            <Mail className="w-5 h-5" />
                                        </div>
                                        <span className="text-sm font-bold text-slate-600 truncate">{cotizacion.email_cliente || 'SIN CORREO'}</span>
                                    </div>
                                    {cotizacion.telefono_cliente && (
                                        <div className="bg-slate-50 border border-slate-200/60 rounded-2xl px-5 py-4 flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400">
                                                <Phone className="w-5 h-5" />
                                            </div>
                                            <span className="text-sm font-bold text-slate-600">{cotizacion.telefono_cliente}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="md:col-span-5 flex flex-col items-start md:items-end">
                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-4 text-left md:text-right w-full">RESUMEN DEL PLAN</p>
                                <div className="w-full bg-indigo-600 rounded-[2rem] p-8 text-white shadow-xl shadow-indigo-600/20 text-center relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
                                    <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-3">LICENCIA ACTIVA</p>
                                    <p className="text-4xl font-black tracking-tight leading-none uppercase mb-4">
                                        {cotizacion.plan_nombre}
                                    </p>
                                    <div className="h-px bg-indigo-500/30 my-5 mx-8"></div>
                                    <p className="text-sm font-medium text-indigo-100">
                                        CAPACIDAD: <span className="font-black">{(cotizacion.volumen_dtes || 0).toLocaleString()} DTEs</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* DESGLOSE DE INVERSIÓN */}
                        <div className="space-y-8">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">DESGLOSE DE INVERSIÓN</p>
                                <span className="text-[9px] font-black text-blue-500 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">Valores en Dólares USD</span>
                            </div>

                            <div className="overflow-hidden border border-slate-100 rounded-3xl shadow-sm bg-slate-50/10">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Servicio / Licencia</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Inversión Bruta</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        <tr className="hover:bg-slate-50/30 transition-colors">
                                            <td className="px-8 py-8">
                                                <div className="flex items-center gap-6">
                                                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-600 shadow-sm">
                                                        <FileText className="w-7 h-7" />
                                                    </div>
                                                    <div>
                                                        <span className="font-black text-slate-900 text-lg block">Licenciamiento Anual {cotizacion.plan_nombre}</span>
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase mt-1 block">Acceso completo + Soporte Premier</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-8 text-right font-black text-slate-900 text-2xl tracking-tighter">
                                                ${(Number(cotizacion.costo_plan_anual) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                        {cotizacion.incluir_implementacion && (
                                            <tr className="hover:bg-slate-50/30 transition-colors">
                                                <td className="px-8 py-8">
                                                    <div className="flex items-center gap-6">
                                                        <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center flex-shrink-0 text-orange-600 shadow-sm">
                                                            <Settings className="w-7 h-7" />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-3">
                                                                <span className="font-black text-slate-900 text-lg">Servicio de Implementación</span>
                                                                <span className="bg-orange-100 text-orange-700 text-[9px] font-black px-2 py-1 rounded-lg tracking-tighter uppercase">Pago Único</span>
                                                            </div>
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase mt-1 block">Configuración de ambiente + Firma Digital</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-8 text-right font-black text-slate-900 text-2xl tracking-tighter">
                                                    ${(Number(cotizacion.costo_implementacion) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        )}
                                        {cotizacion.servicio_whatsapp && (
                                            <tr className="hover:bg-slate-50/30 transition-colors">
                                                <td className="px-8 py-8">
                                                    <div className="flex items-center gap-6">
                                                        <div className="w-14 h-14 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center flex-shrink-0 text-green-600 shadow-sm">
                                                            <MessageSquare className="w-7 h-7" />
                                                        </div>
                                                        <div>
                                                            <span className="font-black text-slate-900 text-lg block">Integración Roger AI - WhatsApp</span>
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase mt-1 block">Asistente Virtual 24/7</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-8 text-right font-black text-slate-900 text-2xl tracking-tighter">
                                                    ${(cotizacion.costo_whatsapp || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        )}
                                        {(cotizacion.modulos_adicionales || []).map((mod: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                                                <td className="px-8 py-8">
                                                    <div className="flex items-center gap-6">
                                                        <div className="w-14 h-14 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center flex-shrink-0 text-purple-600 shadow-sm">
                                                            <Package className="w-7 h-7" />
                                                        </div>
                                                        <div>
                                                            <span className="font-black text-slate-900 text-lg block">{mod.nombre}</span>
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase mt-1 block">Módulo Adicional Especializado</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-8 text-right font-black text-slate-900 text-2xl tracking-tighter">
                                                    ${(Number(mod.costo_anual || mod.costo) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* TOTALS GRID - Horizontal Professional Look */}
                        <div className="pt-12">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                {/* PAGO INICIAL BOX */}
                                <div className="bg-orange-50 border-2 border-orange-100 rounded-[2.5rem] p-10 shadow-xl shadow-orange-900/5 flex flex-col justify-between relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-200/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
                                    <div className="flex justify-between items-start mb-8 relative z-10">
                                        <div>
                                            <h4 className="text-2xl font-black text-orange-900 uppercase tracking-tighter leading-none">Pago Hoy</h4>
                                            <p className="text-[11px] text-orange-600/70 font-bold mt-2 tracking-widest uppercase">Inversión Inicial de Activación</p>
                                        </div>
                                        <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-orange-600 shadow-sm">
                                            <Package className="w-7 h-7" />
                                        </div>
                                    </div>
                                    <div className="space-y-4 relative z-10">
                                        <div className="flex justify-between text-sm text-slate-600 font-medium">
                                            <span>Servicios + Impuestos</span>
                                            <span className="font-black text-slate-900">${financials.pagoInicial.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="pt-6 border-t border-orange-200 mt-4 flex justify-between items-end">
                                            <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Total a Pagar</span>
                                            <span className="text-4xl font-black text-orange-600 tracking-tighter leading-none text-right">
                                                ${financials.pagoInicial.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* TOTAL ANUAL / RECURRENTE BOX */}
                                <div className={`${financials.isMonthly ? 'bg-blue-50 border-blue-100' : 'bg-green-50 border-green-100'} border-2 rounded-[2.5rem] p-10 shadow-xl shadow-slate-900/5 flex flex-col justify-between relative overflow-hidden`}>
                                    <div className={`absolute top-0 right-0 w-32 h-32 ${financials.isMonthly ? 'bg-blue-200/20' : 'bg-green-200/20'} rounded-full blur-3xl -mr-16 -mt-16`}></div>
                                    <div className="flex justify-between items-start mb-8 relative z-10">
                                        <div>
                                            <h4 className={`text-2xl font-black ${financials.isMonthly ? 'text-blue-900' : 'text-green-900'} uppercase tracking-tighter leading-none`}>
                                                {financials.isMonthly ? 'Recurrente' : 'Anualidad'}
                                            </h4>
                                            <p className={`text-[11px] ${financials.isMonthly ? 'text-blue-600/70' : 'text-green-600/70'} font-bold mt-2 tracking-widest uppercase`}>
                                                Licencia de Operaciones
                                            </p>
                                        </div>
                                        <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                                            <Globe className={`w-7 h-7 ${financials.isMonthly ? 'text-blue-600' : 'text-green-600'}`} />
                                        </div>
                                    </div>
                                    <div className="space-y-4 relative z-10">
                                        <div className="flex justify-between text-sm text-slate-600 font-medium">
                                            <span>Mantenimiento + Cloud</span>
                                            <span className="font-black text-slate-900">
                                                ${(financials.isMonthly ? financials.cuotaMensual : financials.totalAnual).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className={`pt-6 border-t ${financials.isMonthly ? 'border-blue-200' : 'border-green-200'} mt-4 flex justify-between items-end`}>
                                            <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">
                                                {financials.isMonthly ? 'Mensualidad' : 'Total Anual'}
                                            </span>
                                            <span className={`text-4xl font-black ${financials.isMonthly ? 'text-blue-600' : 'text-green-600'} tracking-tighter leading-none text-right`}>
                                                ${(financials.isMonthly ? financials.cuotaMensual : financials.totalAnual).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                {financials.isMonthly && <span className="text-sm opacity-50 ml-1">/ MES</span>}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* TÉRMINOS Y CONDICIONES SECTION */}
                        <div className="mt-16 pt-16 border-t border-slate-100">
                            <div className="flex items-center gap-4 mb-10">
                                <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Términos del Servicio</h2>
                            </div>

                            <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-10 md:p-12">
                                <div className="space-y-8 max-h-[500px] overflow-y-auto pr-6 custom-scrollbar">
                                    {(cotizacion.company?.terminos_condiciones || '').split('\n\n').filter((p: string) => p.trim()).map((para: string, idx: number) => (
                                        <div key={idx} className="flex gap-6 items-start">
                                            <span className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-sm font-black text-indigo-600 shrink-0 shadow-sm">
                                                {idx + 1}
                                            </span>
                                            <div className="flex-1">
                                                <p className="text-sm text-slate-600 leading-relaxed font-semibold">
                                                    {para.trim().split(/(\*\*.*?\*\*)/).map((part, i) =>
                                                        part.startsWith('**') && part.endsWith('**')
                                                            ? <strong key={i} className="text-slate-900 font-extrabold">{part.slice(2, -2)}</strong>
                                                            : part
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CREATOR FOOTER - Same as internal */}
                    <div className="bg-slate-50 px-10 py-12 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-12">
                        <div className="flex items-center gap-8">
                            <div className="w-20 h-20 rounded-3xl bg-[#0f172a] flex items-center justify-center text-white font-black text-2xl shadow-2xl border-4 border-white overflow-hidden rotate-3">
                                {cotizacion.creator?.avatar_url ? (
                                    <img src={cotizacion.creator.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    (cotizacion.creator?.full_name || cotizacion.creator?.email || 'A').charAt(0).toUpperCase()
                                )}
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-extrabold">Propuesta Gestada por</p>
                                <h4 className="text-2xl font-black text-slate-900 tracking-tight">{(cotizacion.creator?.full_name || 'Agente Comercial').toUpperCase()}</h4>
                                <div className="flex items-center gap-4 mt-2 text-[10px] font-black text-blue-500 uppercase tracking-wider">
                                    <span className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> {cotizacion.creator?.email}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="w-20 h-20 bg-white p-3 rounded-2xl shadow-xl border border-slate-100 rotate-[-3deg]">
                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${window.location.href}`} alt="QR" className="w-full h-full grayscale opacity-80" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Copyright */}
                <div className="text-center pb-20">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">Powered by Arias Defense Intelligence CRM</p>
                </div>
            </div>

            {/* Signature Modal - Enhanced Design */}
            {showSignatureModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl space-y-8 animate-in zoom-in-95 duration-200">
                        <div className="text-center space-y-4">
                            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-2 shadow-inner border border-indigo-100">
                                <PencilLine className="w-10 h-10" />
                            </div>
                            <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Firma Digital</h2>
                            <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-xs mx-auto">Para formalizar y activar esta propuesta comercial, ingresa tu nombre completo como firma digital vinculante.</p>
                        </div>

                        <div className="space-y-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Nombre Completo del Firmante</label>
                                <div className="relative">
                                    <User className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300" />
                                    <input
                                        type="text"
                                        value={signerName}
                                        onChange={(e) => setSignerName(e.target.value)}
                                        placeholder="Ej: Ing. Christopher Arias"
                                        className="w-full pl-14 pr-6 h-16 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-black text-xl text-slate-800 placeholder:text-slate-300 placeholder:font-bold"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-4">
                                <Button
                                    variant="default"
                                    onClick={handleAccept}
                                    disabled={isAccepting || !signerName.trim()}
                                    className="h-16 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl shadow-indigo-600/30 transition-all active:scale-95"
                                >
                                    {isAccepting ? 'Procesando Aceptación...' : 'Confirmar y Firmar Documento'}
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => setShowSignatureModal(false)}
                                    className="h-14 text-slate-400 hover:text-slate-600 font-black text-[10px] uppercase tracking-widest transition-colors"
                                >
                                    Revisar Propuesta Nuevamente
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
