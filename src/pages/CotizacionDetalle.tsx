import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { format } from 'date-fns';
import { Building2, Mail, Phone, Package, Globe, Trash2, Send, Download, ArrowLeft, Settings, FileText, MessageSquare, CreditCard, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { pdfService } from '../services/pdfService';
import { parseModules, calculateQuoteFinancialsV2, type CotizacionData } from '../utils/quoteUtils';
import toast from 'react-hot-toast';

interface FinancingPlan {
    id: string;
    titulo: string;
    descripcion: string;
    cuotas: number;
    meses: number;
    interes_porcentaje: number;
    tipo_ajuste: 'discount' | 'recharge' | 'none';
    es_popular: boolean;
}

export default function CotizacionDetalle() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [cotizacion, setCotizacion] = useState<CotizacionData | null>(null);
    const [financingPlan, setFinancingPlan] = useState<FinancingPlan | null>(null);
    const [loading, setLoading] = useState(true);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [isAccepting, setIsAccepting] = useState(false);

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
                    creator:profiles!created_by(*),
                    lead:leads(*)
                `)
                .eq('id', id)
                .maybeSingle();

            if (error) throw error;

            // Handle modulos_adicionales parsing
            const parsedData = {
                ...data,
                modulos_adicionales: parseModules(data.modulos_adicionales)
            };

            setCotizacion(parsedData as CotizacionData);

            // Cargar el plan de financiamiento correspondiente
            // LÓGICA CORREGIDA: Respetar cuotas explícitas (incluso si es 1)
            // Solo usar plazo_meses como fallback si cuotas NO está definido
            const cuotasVal = Number(data?.cuotas);
            const plazoVal = Number(data?.plazo_meses) || 0;

            let numCuotas = 1;
            if (!isNaN(cuotasVal) && cuotasVal >= 1) {
                numCuotas = cuotasVal;
            } else if (plazoVal > 1) {
                numCuotas = plazoVal;
            }

            if (numCuotas && data?.company_id) {
                const { data: planData } = await supabase
                    .from('financing_plans')
                    .select('*')
                    .or(`company_id.eq.${data.company_id},company_id.is.null`)
                    .eq('cuotas', numCuotas)
                    .eq('activo', true)
                    .order('company_id', { ascending: false, nullsFirst: false })
                    .limit(1)
                    .maybeSingle();

                console.log('[CotizacionDetalle] Buscando plan con cuotas:', numCuotas, 'encontrado:', planData?.titulo);

                if (planData) {
                    setFinancingPlan(planData as FinancingPlan);
                }
            }
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

    const handleAceptarPropuesta = async () => {
        if (!cotizacion) return;
        if (!window.confirm('¿Deseas marcar esta propuesta como ACEPTADA? Esta acción actualizará el estado de la cotización.')) return;

        setIsAccepting(true);
        try {
            const { error } = await supabase
                .from('cotizaciones')
                .update({
                    estado: 'aceptada',
                    descripcion_pago: `Aceptada manualmente el ${new Date().toLocaleString()}`
                })
                .eq('id', id);

            if (error) throw error;

            toast.success('¡Propuesta marcada como ACEPTADA!');
            fetchCotizacion(); // Recargar datos
        } catch (error) {
            console.error('Error al aceptar:', error);
            toast.error('Error al actualizar el estado');
        } finally {
            setIsAccepting(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Cargando cotización...</div>;
    if (!cotizacion) return <div className="p-8 text-center text-red-500">Cotización no encontrada</div>;

    return (
        <div className="min-h-screen bg-gray-50/50 pb-20">
            {/* Action Bar - Immersive, Edge-to-Edge, Zero Gaps */}
            <div className="sticky top-0 z-40 bg-white border-b border-gray-200 w-full transition-all overflow-hidden shadow-sm">
                <div className="h-20 px-12 flex justify-between items-center w-full">
                    <div className="flex items-center gap-6">
                        <Button
                            variant="ghost"
                            onClick={() => navigate('/cotizaciones')}
                            className="text-gray-400 hover:text-gray-900 group flex items-center gap-2 px-0 hover:bg-transparent"
                        >
                            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                            <span className="text-sm font-bold uppercase tracking-widest">Volver</span>
                        </Button>

                        <div className="h-8 w-px bg-gray-100"></div>

                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] leading-none mb-1.5">ID Propuesta</span>
                            <div className="flex items-center gap-2">
                                <span className="text-base font-black text-slate-900 leading-none">#{cotizacion.id.slice(0, 8).toUpperCase()}</span>
                                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[9px] font-black text-blue-600 uppercase tracking-tighter">Oficial</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <Button
                            variant="default"
                            onClick={handleDownloadPDF}
                            disabled={isGeneratingPDF}
                            className={`
                                h-12 px-8 rounded-xl transition-all duration-300
                                bg-[#4449AA] hover:bg-[#383d8f] text-white shadow-lg shadow-[#4449AA]/20
                                font-black text-[11px] uppercase tracking-widest
                            `}
                        >
                            {isGeneratingPDF ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Generando...</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Download className="w-4 h-4" />
                                    <span>Descargar PDF</span>
                                </div>
                            )}
                        </Button>

                        <Button
                            variant="default"
                            onClick={handleShareTelegram}
                            className="h-12 px-6 bg-white border border-gray-200 text-slate-800 hover:bg-gray-50 hover:border-gray-300 font-bold text-[11px] uppercase tracking-widest rounded-xl shadow-sm hidden md:flex items-center gap-2"
                        >
                            <Send className="w-4 h-4 text-[#0088cc]" />
                            Compartir
                        </Button>

                        {/* Botón Aceptar Propuesta - Solo visible si no está aceptada */}
                        {cotizacion.estado !== 'aceptada' ? (
                            <Button
                                variant="default"
                                onClick={handleAceptarPropuesta}
                                disabled={isAccepting}
                                className="h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-600/20 hidden md:flex items-center gap-2"
                            >
                                {isAccepting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Procesando...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span>Aceptar</span>
                                    </>
                                )}
                            </Button>
                        ) : (
                            <div className="h-12 px-6 flex items-center gap-2 bg-green-50 text-green-600 font-black text-[11px] uppercase tracking-widest rounded-xl border border-green-200">
                                <CheckCircle2 className="w-4 h-4" />
                                Aceptada
                            </div>
                        )}

                        <div className="h-8 w-px bg-gray-100 hidden md:block mx-1"></div>

                        <Button
                            variant="ghost"
                            onClick={handleDelete}
                            className="h-12 w-12 p-0 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                        >
                            <Trash2 className="w-5 h-5" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto mt-6 px-4">
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
                                        Volumen: <span className="font-bold text-slate-900">{(cotizacion.volumen_dtes || 0).toLocaleString()} DTEs/año</span>
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
                                                ${(Number(cotizacion.costo_plan_anual) || 0).toLocaleString()}
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
                                                    ${(Number(cotizacion.costo_implementacion) || 0).toLocaleString()}
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
                                        {(Array.isArray(cotizacion.modulos_adicionales) ? cotizacion.modulos_adicionales : [])?.map((mod: any, idx: number) => {
                                            const esPagoUnico = (Number(mod.pago_unico) || 0) > 0;
                                            const monto = esPagoUnico ? Number(mod.pago_unico) : (Number(mod.costo_anual || mod.costo) || 0);
                                            return (
                                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-6">
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-10 h-10 rounded-xl ${esPagoUnico ? 'bg-orange-50 border-orange-100 text-orange-600' : 'bg-purple-50 border-purple-100 text-purple-600'} border flex items-center justify-center flex-shrink-0`}>
                                                                <Package className="w-5 h-5" />
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-black text-slate-900">{mod.nombre}</span>
                                                                {esPagoUnico && (
                                                                    <span className="bg-orange-100 text-orange-700 text-[8px] font-black px-1.5 py-0.5 rounded tracking-tighter">PAGO ÚNICO</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-6 text-right font-black text-slate-900 text-lg">
                                                        ${monto.toLocaleString()}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Section 4: Summary & Financials - Dynamic Layout */}
                        <div className="pt-8 space-y-8 px-8 md:px-12">
                            {/* RESUMEN DE INVERSIÓN - USANDO FUNCIÓN CENTRALIZADA */}
                            {(() => {
                                // 🎯 USAR FUNCIÓN CENTRALIZADA PARA CÁLCULOS
                                const financials = calculateQuoteFinancialsV2(cotizacion, financingPlan || undefined);
                                const {
                                    cuotas,
                                    isPagoUnico,
                                    licenciaAnual,
                                    implementacion,
                                    ivaPct,
                                    recargoMonto,
                                    ajusteLabel,
                                    ivaLicencia,
                                    totalLicencia,
                                    cuotaMensual,
                                    ivaImplementacion,
                                    totalImplementacion,
                                    planTitulo,
                                    tipoAjuste
                                } = financials;

                                return (
                                    <>
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em]">RESUMEN DE INVERSIÓN</p>
                                            <div className="flex items-center gap-2">
                                                <CreditCard className="w-4 h-4 text-slate-400" />
                                                <p className="text-xs font-bold text-slate-600">
                                                    {planTitulo}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {/* CUADRO PAGO INICIAL - Estilo claro con borde naranja con DESGLOSE */}
                                            {(() => {
                                                // Calcular desglose de pagos únicos
                                                const implementacionBase = Number(cotizacion.costo_implementacion) || 0;

                                                // Servicios únicos de modulos_adicionales (incluye cualquier servicio con pago_unico > 0)
                                                const modulosArr = Array.isArray(cotizacion.modulos_adicionales) ? cotizacion.modulos_adicionales : [];
                                                const serviciosUnicos = modulosArr
                                                    .filter((mod: any) => (Number(mod.pago_unico) || 0) > 0)
                                                    .map((mod: any) => ({
                                                        nombre: mod.nombre,
                                                        monto: Number(mod.pago_unico) || 0
                                                    }));

                                                const subtotalUnicos = implementacionBase + serviciosUnicos.reduce((sum: number, s: any) => sum + s.monto, 0);

                                                return (
                                                    <div className={`bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-6 shadow-sm border-2 border-orange-200 flex flex-col justify-between ${implementacion === 0 ? 'opacity-50' : ''}`}>
                                                        <div className="flex justify-between items-start mb-4">
                                                            <div>
                                                                <h4 className="text-lg font-black uppercase tracking-tight leading-none text-slate-800">PAGO INICIAL</h4>
                                                                <p className="text-[11px] text-orange-500 font-bold mt-1">Requerido antes de activar</p>
                                                            </div>
                                                            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                                                                <Package className="w-5 h-5 text-orange-500" />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            {/* Implementación */}
                                                            {implementacionBase > 0 && (
                                                                <div className="flex justify-between items-center text-[11px] text-slate-600 font-medium gap-2">
                                                                    <span className="truncate flex-1">Implementación</span>
                                                                    <span className="font-bold text-slate-800 whitespace-nowrap">${implementacionBase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                </div>
                                                            )}
                                                            {/* Servicios únicos (incluye personalización, sucursal, etc) */}
                                                            {serviciosUnicos.map((serv: any, idx: number) => (
                                                                <div key={idx} className="flex justify-between items-center text-[11px] text-slate-600 font-medium gap-2">
                                                                    <span className="truncate flex-1">{serv.nombre}</span>
                                                                    <span className="font-bold text-slate-800 whitespace-nowrap">${serv.monto.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                </div>
                                                            ))}
                                                            {/* Subtotal si hay más de un item */}
                                                            {(implementacionBase > 0 ? 1 : 0) + serviciosUnicos.length > 1 && (
                                                                <div className="flex justify-between items-center text-[11px] text-slate-500 font-medium pt-1 border-t border-orange-100 gap-2">
                                                                    <span className="truncate flex-1">Subtotal</span>
                                                                    <span className="font-bold text-slate-700 whitespace-nowrap">${subtotalUnicos.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                </div>
                                                            )}
                                                            {/* IVA */}
                                                            <div className="flex justify-between items-center text-[11px] text-slate-500 font-medium gap-2">
                                                                <span className="truncate flex-1">IVA ({Math.round(ivaPct * 100)}%)</span>
                                                                <span className="font-bold text-orange-500 whitespace-nowrap">+$ {ivaImplementacion.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                            </div>
                                                            {/* Total */}
                                                            <div className="pt-3 border-t border-orange-200 mt-2">
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-[11px] font-black uppercase tracking-wide text-slate-700">TOTAL A PAGAR HOY</span>
                                                                    <span className="text-2xl font-black tracking-tighter leading-none text-orange-600">${totalImplementacion.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* CUADRO PAGO RECURRENTE - Estilo claro con borde azul con DESGLOSE */}
                                            {(() => {
                                                // Calcular desglose de recurrentes
                                                const licenciaBase = Number(cotizacion.costo_plan_anual) || 0;
                                                const costoWhatsApp = cotizacion.servicio_whatsapp ? (Number(cotizacion.costo_whatsapp) || 0) : 0;

                                                // Módulos recurrentes de modulos_adicionales
                                                const modulosArr = Array.isArray(cotizacion.modulos_adicionales) ? cotizacion.modulos_adicionales : [];
                                                const serviciosRecurrentes = modulosArr
                                                    .filter((mod: any) => (Number(mod.pago_unico) || 0) === 0 && ((Number(mod.costo_anual) || Number(mod.costo) || 0) > 0))
                                                    .map((mod: any) => ({
                                                        nombre: mod.nombre,
                                                        monto: Number(mod.costo_anual) || Number(mod.costo) || 0
                                                    }));

                                                const totalRecurrenteBase = licenciaBase + serviciosRecurrentes.reduce((sum: number, s: any) => sum + s.monto, 0) + costoWhatsApp;

                                                return (
                                                    <div className={`bg-gradient-to-br ${isPagoUnico ? 'from-emerald-50 to-green-50 border-emerald-200' : 'from-blue-50 to-indigo-50 border-blue-200'} rounded-2xl p-6 shadow-sm border-2 flex flex-col justify-between`}>
                                                        <div className="flex justify-between items-start mb-4">
                                                            <div>
                                                                <h4 className="text-lg font-black uppercase tracking-tight leading-none text-slate-800">
                                                                    {isPagoUnico ? 'LICENCIA ANUAL' : 'PAGO RECURRENTE'}
                                                                </h4>
                                                                <p className={`text-[11px] ${isPagoUnico ? 'text-emerald-500' : 'text-blue-500'} font-bold mt-1`}>
                                                                    {isPagoUnico ? 'Pago único adelantado' : `Pago en ${cuotas} cuotas`}
                                                                </p>
                                                            </div>
                                                            <div className={`w-10 h-10 rounded-xl ${isPagoUnico ? 'bg-emerald-100' : 'bg-blue-100'} flex items-center justify-center`}>
                                                                <Globe className={`w-5 h-5 ${isPagoUnico ? 'text-emerald-500' : 'text-blue-500'}`} />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            {/* Licencia base */}
                                                            <div className="flex justify-between items-center text-[11px] text-slate-600 font-medium gap-2">
                                                                <span className="truncate flex-1">Licencia {cotizacion.plan_nombre}</span>
                                                                <span className="font-bold text-slate-800 whitespace-nowrap">${licenciaBase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                            </div>
                                                            {/* Módulos recurrentes */}
                                                            {serviciosRecurrentes.map((serv: any, idx: number) => (
                                                                <div key={idx} className="flex justify-between items-center text-[11px] text-slate-600 font-medium gap-2">
                                                                    <span className="truncate flex-1">{serv.nombre}</span>
                                                                    <span className="font-bold text-slate-800 whitespace-nowrap">${serv.monto.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                </div>
                                                            ))}
                                                            {/* WhatsApp */}
                                                            {costoWhatsApp > 0 && (
                                                                <div className="flex justify-between items-center text-[11px] text-slate-600 font-medium gap-2">
                                                                    <span className="truncate flex-1">WhatsApp</span>
                                                                    <span className="font-bold text-slate-800 whitespace-nowrap">${costoWhatsApp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                </div>
                                                            )}
                                                            {/* Financiamiento (solo si hay recargo) */}
                                                            {!isPagoUnico && recargoMonto > 0 && (
                                                                <div className="flex justify-between items-center text-[11px] text-slate-500 font-medium gap-2">
                                                                    <span className="truncate flex-1">{ajusteLabel}</span>
                                                                    <span className="font-bold text-orange-500 whitespace-nowrap">+${recargoMonto.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                </div>
                                                            )}
                                                            {/* Descuento (solo si aplica) */}
                                                            {isPagoUnico && tipoAjuste === 'discount' && ajusteLabel && (
                                                                <div className="flex justify-between items-center text-[11px] text-emerald-600 font-medium gap-2">
                                                                    <span className="truncate flex-1">🎉 {ajusteLabel}</span>
                                                                    <span className="font-bold whitespace-nowrap">Aplicado</span>
                                                                </div>
                                                            )}
                                                            {/* IVA */}
                                                            <div className="flex justify-between items-center text-[11px] text-slate-500 font-medium gap-2">
                                                                <span className="truncate flex-1">IVA ({Math.round(ivaPct * 100)}%)</span>
                                                                <span className={`font-bold whitespace-nowrap ${isPagoUnico ? 'text-emerald-500' : 'text-blue-500'}`}>+$ {ivaLicencia.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                            </div>

                                                            {/* Total Plan (solo para financiado) */}
                                                            {!isPagoUnico && (
                                                                <div className="pt-2 mt-1">
                                                                    <div className="flex justify-between items-center text-[11px] text-slate-700 font-bold gap-2">
                                                                        <span className="truncate flex-1">Total Plan ({cuotas} Cuotas)</span>
                                                                        <span className="whitespace-nowrap">${totalLicencia.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Cuota Final */}
                                                            <div className="pt-3 border-t border-slate-200 mt-2">
                                                                <div className="flex justify-between items-end">
                                                                    <div>
                                                                        <span className="text-[11px] font-black uppercase tracking-wide block text-slate-700">
                                                                            {isPagoUnico ? 'Total Licencia Anual' : `Cuota de ${cuotas}`}
                                                                        </span>
                                                                        {!isPagoUnico && (
                                                                            <span className="text-[9px] text-slate-400 italic">* Plan de pagos consecutivos.</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <span className={`text-2xl font-black tracking-tighter leading-none ${isPagoUnico ? 'text-emerald-600' : 'text-blue-600'}`}>
                                                                            ${(isPagoUnico ? totalLicencia : cuotaMensual).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                        </span>
                                                                        {!isPagoUnico && <span className="text-sm text-slate-400">/cuota</span>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </>
                                );
                            })()}

                            {/* Terms & Conditions Section - Dedicated Page Area */}
                            <div className="mt-16 pt-12 border-t border-gray-100 flex flex-col">
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Términos y Condiciones</h2>
                                </div>
                                <div className="w-full bg-slate-50/50 rounded-3xl p-6 md:p-8 border border-slate-100">
                                    <div className="flex flex-col gap-6">
                                        {(cotizacion.company?.terminos_condiciones || '').split('\n\n').filter((p: string) => p.trim()).map((para: string, idx: number) => (
                                            <div key={idx} className="flex gap-4 items-start">
                                                <span className="text-sm font-black text-blue-600 shrink-0 mt-0.5 min-w-[24px]">
                                                    {idx + 1}.
                                                </span>
                                                <div className="flex-1">
                                                    <p className="text-sm text-slate-600 leading-relaxed font-medium">
                                                        {para.trim().split(/(\*\*.*?\*\*)/).map((part, i) =>
                                                            part.startsWith('**') && part.endsWith('**')
                                                                ? <strong key={i} className="text-slate-900 font-black">{part.slice(2, -2)}</strong>
                                                                : part
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {!(cotizacion.company?.terminos_condiciones) && (
                                        <p className="text-center text-slate-400 italic text-sm">
                                            No se han definido términos y condiciones específicos para esta propuesta.
                                        </p>
                                    )}
                                </div>
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
