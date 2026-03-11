import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Building2, Package, Download, FileText, CheckCircle2, PencilLine, Mail, Phone, Settings, MessageSquare, CreditCard } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { parseModules, calculateQuoteFinancialsV2, type CotizacionData } from '../utils/quoteUtils';
import { pdfService } from '../services/pdfService';
import { format } from 'date-fns';
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
    show_breakdown: boolean;
}

export default function PublicQuoteView() {
    const { id } = useParams<{ id: string }>();
    const [cotizacion, setCotizacion] = useState<CotizacionData | null>(null);
    const [financingPlan, setFinancingPlan] = useState<FinancingPlan | null>(null);
    const [pricingItemDescripcion, setPricingItemDescripcion] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [isAccepting, setIsAccepting] = useState(false);
    const [signerName, setSignerName] = useState('');
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [allPlans, setAllPlans] = useState<FinancingPlan[]>([]);
    const [clientSelectedPlanId, setClientSelectedPlanId] = useState<string | null>(null);

    useEffect(() => {
        fetchCotizacion();
    }, [id]);

    // Track client view via SECURITY DEFINER (no auth required)
    useEffect(() => {
        if (!id) return;
        supabase.rpc('track_quote_view', { quote_id: id }).then(() => { });
    }, [id]);

    async function fetchCotizacion() {
        try {
            // ── SECURITY DEFINER RPC: bypasses RLS for anon users ──────────────
            // One call returns quote + company + creator + financing_plan + pricing desc.
            // Replaces 4 separate queries that were blocked for unauthenticated mobile clients.
            const { data, error } = await supabase
                .rpc('get_public_proposal', { quote_id: id });

            if (error) throw error;
            if (!data || data.error) return; // quote not found — handled below

            const { quote, company, creator, financing_plan, pricing_item_descripcion, comparison_plans } = data;

            setCotizacion({
                ...quote,
                company,
                creator,
                modulos_adicionales: parseModules(quote.modulos_adicionales)
            } as CotizacionData);

            if (financing_plan) {
                setFinancingPlan(financing_plan as FinancingPlan);
                setClientSelectedPlanId(financing_plan.id);
            }
            if (pricing_item_descripcion) setPricingItemDescripcion(pricing_item_descripcion);

            // ✅ Planes vienen directamente del RPC (SECURITY DEFINER → sin bloqueo RLS)
            // El RPC ya respeta el orden de planes_comparativa guardado por el agente
            if (comparison_plans && comparison_plans.length > 0) {
                setAllPlans(comparison_plans as FinancingPlan[]);
                // Pre-seleccionar el primer plan (el que pidió el prospecto)
                if (!financing_plan && comparison_plans[0]?.id) {
                    setClientSelectedPlanId(comparison_plans[0].id);
                }
            }
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
            const { error } = await supabase.rpc('accept_quote_public', {
                quote_id: id,
                acceptor_name: signerName.trim()
            });
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
            const selectedPlan = allPlans.find(p => p.id === clientSelectedPlanId) || financingPlan || undefined;
            const pdfUrl = await pdfService.generateAndUploadQuotePDF(
                cotizacion,
                selectedPlan,
                allPlans.length > 0 ? allPlans : undefined
            );
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
                <div className="mt-8 p-6 bg-slate-50 rounded-2xl text-[10px] text-slate-400 font-mono text-left">
                    <p>SUPABASE: {(supabase as any).supabaseUrl}</p>
                    {error && <p className="mt-1 text-red-400">ERROR: {error}</p>}
                </div>
            </div>
        </div>
    );

    // 🎯 CÁLCULOS CENTRALIZADOS — usa el plan elegido por el prospecto
    const clientSelectedPlan = allPlans.find(p => p.id === clientSelectedPlanId) || financingPlan || undefined;
    const plansToShow = allPlans.length > 0 ? allPlans : (financingPlan ? [financingPlan] : []);
    const financials = calculateQuoteFinancialsV2(cotizacion, clientSelectedPlan);
    const { totalImplementacion } = financials;

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans pb-32 md:pb-8 overflow-x-hidden">
            {/* Header Mobile App Style - Sticky */}
            <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 w-full transition-all">
                <div className="h-16 md:h-20 px-4 md:px-12 flex justify-between items-center w-full max-w-7xl mx-auto">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-xs md:text-sm shadow-lg shadow-indigo-600/20">
                            {cotizacion.company?.name?.charAt(0) || 'A'}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] md:text-base font-black text-slate-900 leading-none">PROPUESTA #{cotizacion.id.slice(0, 8).toUpperCase()}</span>
                            <span className="text-[8px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">VENCE EN 30 DÍAS</span>
                        </div>
                    </div>

                    {/* Desktop Actions */}
                    <div className="hidden md:flex items-center gap-4">
                        <Button
                            variant="default"
                            onClick={handleDownloadPDF}
                            disabled={isGeneratingPDF}
                            className="h-12 px-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-black text-[11px] uppercase tracking-widest transition-all"
                        >
                            {isGeneratingPDF ? 'Generando...' : <span className="flex items-center gap-2"><Download className="w-4 h-4" /> PDF</span>}
                        </Button>

                        {cotizacion.estado !== 'aceptada' ? (
                            <Button
                                variant="default"
                                onClick={() => setShowSignatureModal(true)}
                                className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-600/20 transition-all"
                            >
                                <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Aceptar</span>
                            </Button>
                        ) : (
                            <div className="h-12 px-8 flex items-center gap-2 bg-green-50 text-green-600 font-black text-[11px] uppercase tracking-widest rounded-xl border border-green-200">
                                <CheckCircle2 className="w-4 h-4" /> Aceptada
                            </div>
                        )}
                    </div>

                    {/* Mobile Quick Action */}
                    <div className="md:hidden">
                        {cotizacion.estado === 'aceptada' ? (
                            <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center border border-green-100">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                                <FileText className="w-5 h-5" />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 md:px-6 pt-6">
                {/* Mobile Floating Action Bar (Permanent) */}
                <div className="md:hidden fixed bottom-6 left-4 right-4 z-50 flex gap-3">
                    <button
                        onClick={handleDownloadPDF}
                        disabled={isGeneratingPDF}
                        className="flex-1 h-14 bg-white border-2 border-slate-100 rounded-2xl flex items-center justify-center text-slate-900 font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                    >
                        {isGeneratingPDF ? '...' : <><Download className="w-5 h-5 mr-2 text-indigo-600" /> PDF</>}
                    </button>
                    {cotizacion.estado !== 'aceptada' ? (
                        <button
                            onClick={() => setShowSignatureModal(true)}
                            className="flex-[2] h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-600/30 active:scale-95 transition-all"
                        >
                            <CheckCircle2 className="w-5 h-5 mr-2" /> Aceptar Propuesta
                        </button>
                    ) : (
                        <div className="flex-[2] h-14 bg-green-600 text-white rounded-2xl flex items-center justify-center font-black text-[10px] uppercase tracking-widest shadow-xl shadow-green-600/30">
                            <CheckCircle2 className="w-5 h-5 mr-2" /> Propuesta Aceptada
                        </div>
                    )}
                </div>

                {/* Header Section - App-like Hero */}
                <div className="bg-[#0f172a] rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden mb-8 shadow-2xl shadow-slate-900/20">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px] -mr-32 -mt-32"></div>

                    <div className="relative z-10 space-y-8">
                        <div className="flex flex-col md:flex-row justify-between gap-8">
                            <div className="space-y-4">
                                <div className="h-16 flex items-center">
                                    {cotizacion.company?.logo_url ? (
                                        <img src={cotizacion.company.logo_url} alt="" className="max-h-full object-contain" />
                                    ) : (
                                        <div className="flex items-center gap-2 text-indigo-400">
                                            <Building2 className="w-10 h-10" />
                                            <span className="text-2xl font-black uppercase tracking-tighter italic">ARIAS DEFENSE</span>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <h2 className="text-xl font-black uppercase tracking-tight opacity-90">{cotizacion.company?.name || 'ARIAS DEFENSE COMPONENTS'}</h2>
                                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em]">{cotizacion.company?.website?.replace(/^https?:\/\//, '') || 'WWW.ARIASDEFENSE.COM'}</p>
                                </div>
                            </div>

                            <div className="flex flex-col md:items-end gap-2">
                                <span className="bg-indigo-500/20 text-indigo-300 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-500/30 w-fit">
                                    Documento: {cotizacion.id.slice(0, 8).toUpperCase()}
                                </span>
                                <div className="flex gap-6 mt-4 md:text-right">
                                    <div>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">EMITIDO</p>
                                        <p className="text-sm font-black">{format(new Date(cotizacion.created_at), 'dd/MM/yy')}</p>
                                    </div>
                                    <div className="w-px h-8 bg-slate-800"></div>
                                    <div>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">VENCE</p>
                                        <p className="text-sm font-black text-indigo-400">30 DÍAS</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recipient Card */}
                <div className="bg-white rounded-[2rem] p-8 border border-slate-200/60 shadow-sm mb-8">
                    <div className="flex flex-col md:flex-row justify-between gap-8">
                        <div className="space-y-6 flex-1">
                            <div>
                                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] mb-3">PREPARADO PARA</p>
                                <h3 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-none mb-2">{cotizacion.nombre_cliente}</h3>
                                {cotizacion.empresa_cliente && (
                                    <p className="text-slate-500 font-black text-sm uppercase tracking-widest">{cotizacion.empresa_cliente}</p>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <div className="bg-slate-50 px-4 py-2 rounded-xl flex items-center gap-2 border border-slate-100">
                                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-[10px] font-bold text-slate-600">{cotizacion.email_cliente || 'SIN CORREO'}</span>
                                </div>
                                {cotizacion.telefono_cliente && (
                                    <div className="bg-slate-50 px-4 py-2 rounded-xl flex items-center gap-2 border border-slate-100">
                                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="text-[10px] font-bold text-slate-600">{cotizacion.telefono_cliente}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="md:w-64">
                            <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-600/20 text-center flex flex-col items-center">
                                <Package className="w-8 h-8 mb-3 opacity-50" />
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">SOFTWARE PLAN</p>
                                <p className="text-2xl font-black tracking-tight uppercase leading-none">{cotizacion.plan_nombre}</p>
                                <div className="w-full h-px bg-white/20 my-4"></div>
                                <p className="text-[10px] font-bold">{(cotizacion.volumen_dtes || 0).toLocaleString()} DTEs/AÑO</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Investment List - Tappable Mobile List */}
                <div className="space-y-4 mb-10">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] px-2 mb-4">DETALLE DE LA INVERSIÓN</h4>

                    {/* Items List */}
                    <div className="space-y-3">
                        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-start justify-between group active:scale-[0.98] transition-all">
                            <div className="flex items-start gap-4 flex-1">
                                <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <p className="font-black text-slate-900 text-sm leading-none m-0 uppercase">Licenciamiento Anual</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">PLAN {cotizacion.plan_nombre}</p>
                                    {pricingItemDescripcion && (
                                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1">{pricingItemDescripcion}</p>
                                    )}
                                </div>
                            </div>
                            <span className="text-lg font-black text-slate-900 tracking-tight flex-shrink-0">${Number(cotizacion.costo_plan_anual).toLocaleString()}</span>
                        </div>

                        {cotizacion.incluir_implementacion && (
                            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center justify-between group active:scale-[0.98] transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600">
                                        <Settings className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="font-black text-slate-900 text-sm leading-none m-0 uppercase">Implementación</p>
                                        <span className="inline-block mt-1 text-[8px] font-black bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">PAGO ÚNICO</span>
                                    </div>
                                </div>
                                <span className="text-lg font-black text-slate-900 tracking-tight">${Number(cotizacion.costo_implementacion).toLocaleString()}</span>
                            </div>
                        )}

                        {cotizacion.servicio_whatsapp && (
                            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center justify-between group active:scale-[0.98] transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center text-green-600">
                                        <MessageSquare className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="font-black text-slate-900 text-sm leading-none m-0 uppercase">WhatsApp AI Agent</p>
                                        <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">INTEGRACIÓN ROGER</p>
                                    </div>
                                </div>
                                <span className="text-lg font-black text-slate-900 tracking-tight">${Number(cotizacion.costo_whatsapp).toLocaleString()}</span>
                            </div>
                        )}

                        {(cotizacion.modulos_adicionales || []).map((mod: any, idx: number) => {
                            const esPagoUnico = (Number(mod.pago_unico) || 0) > 0;
                            const monto = esPagoUnico ? Number(mod.pago_unico) : (Number(mod.costo_anual || mod.costo) || 0);
                            return (
                                <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-start justify-between group active:scale-[0.98] transition-all text-xs">
                                    <div className="flex items-start gap-4">
                                        <div className={`w-12 h-12 rounded-xl ${esPagoUnico ? 'bg-orange-50 border-orange-100 text-orange-600' : 'bg-purple-50 border-purple-100 text-purple-600'} border flex items-center justify-center flex-shrink-0`}>
                                            <Package className="w-6 h-6" />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <p className="font-black text-slate-900 text-sm leading-none m-0 uppercase">{mod.nombre}</p>
                                            {mod.descripcion && (
                                                <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1">{mod.descripcion}</p>
                                            )}
                                            {esPagoUnico ? (
                                                <span className="inline-block mt-1 text-[8px] font-black bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full w-fit">PAGO ÚNICO</span>
                                            ) : (
                                                <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">MÓDULO ADICIONAL</p>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-lg font-black text-slate-900 tracking-tight flex-shrink-0">${monto.toLocaleString()}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── PLAN DE PAGO COMPARATIVO ───────────────────────────────── */}
                <div className="mb-12">
                    <div className="flex items-center gap-2 px-2 mb-5"
                    >
                        <CreditCard className="w-4 h-4 text-indigo-500" />
                        <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.3em]">ELIGE TU PLAN DE PAGO</h4>
                    </div>

                    {/* Cards — scroll horizontal en móvil, grid en desktop */}
                    {plansToShow.length > 0 && (
                        <div className={`flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory md:mx-0 md:px-0 md:overflow-visible md:pb-0 ${plansToShow.length === 1 ? 'md:grid md:grid-cols-1' :
                            plansToShow.length === 2 ? 'md:grid md:grid-cols-2' :
                                'md:grid md:grid-cols-3'
                            }`}>
                            {plansToShow.map((plan) => {
                                const planCuotas = Number((plan as any).cuotas) || Number((plan as any).meses) || 1;
                                const cotizacionForPlan = { ...cotizacion, cuotas: planCuotas, plazo_meses: planCuotas };
                                const pf = calculateQuoteFinancialsV2(cotizacionForPlan, plan);
                                const isSelected = clientSelectedPlanId === plan.id;
                                const isAgentPick = plan.id === financingPlan?.id;
                                const isDiscount = plan.tipo_ajuste === 'discount';
                                const displayAmt = pf.isPagoUnico ? pf.totalLicencia : pf.cuotaMensual;
                                return (
                                    <button
                                        key={plan.id}
                                        onClick={() => setClientSelectedPlanId(plan.id)}
                                        className={`flex-shrink-0 w-[260px] md:w-auto snap-center text-left rounded-[2rem] p-6 border-2 transition-all duration-200 active:scale-[0.98] focus:outline-none ${isSelected
                                            ? 'border-indigo-500 bg-indigo-50 shadow-xl shadow-indigo-500/10'
                                            : 'bg-white border-slate-200/60 hover:border-indigo-300 hover:shadow-md'
                                            }`}
                                    >
                                        {/* Badges */}
                                        <div className="flex flex-wrap gap-1.5 mb-4 min-h-[22px]">
                                            {plan.es_popular && (
                                                <span className="text-[8px] font-black bg-indigo-500 text-white px-2.5 py-1 rounded-full uppercase tracking-widest">★ Más Popular</span>
                                            )}
                                            {isDiscount && (
                                                <span className="text-[8px] font-black bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full uppercase">Mejor Precio</span>
                                            )}
                                            {isAgentPick && !plan.es_popular && (
                                                <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full uppercase">Recomendado</span>
                                            )}
                                        </div>

                                        {/* Título */}
                                        <h3 className={`text-base font-black uppercase tracking-tight leading-none mb-1 ${isSelected ? 'text-indigo-600' : 'text-slate-900'
                                            }`}>{plan.titulo}</h3>
                                        <p className="text-[10px] text-slate-400 font-medium mb-5 leading-relaxed">{plan.descripcion}</p>

                                        {/* Monto principal */}
                                        <div className={`text-3xl font-black tracking-tighter leading-none mb-1 ${isSelected ? 'text-indigo-600' : 'text-slate-900'
                                            }`}>
                                            ${displayAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            {!pf.isPagoUnico && <span className="text-[11px] font-bold text-slate-400 ml-1">/cuota</span>}
                                        </div>
                                        <p className={`text-[10px] font-bold mb-5 ${pf.isPagoUnico ? 'text-emerald-500' : 'text-blue-500'
                                            }`}>
                                            {pf.isPagoUnico ? 'Pago único adelantado' : `${pf.cuotas} cuotas consecutivas`}
                                        </p>

                                        {/* Desglose */}
                                        <div className="space-y-1.5 mb-5">
                                            <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                                                <span className="truncate">Licencia {cotizacion.plan_nombre}</span>
                                                <span className="font-bold text-slate-700 ml-2 flex-shrink-0">${Number(cotizacion.costo_plan_anual).toLocaleString()}</span>
                                            </div>
                                            {!pf.isPagoUnico && pf.recargoMonto > 0 && (plan.show_breakdown ?? true) && (
                                                <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                                                    <span>Financiamiento</span>
                                                    <span className="text-orange-500">+${pf.recargoMonto.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>
                                            )}
                                            {pf.descuentoManualMonto > 0 && (
                                                <div className="flex justify-between text-[10px] text-emerald-600 font-medium">
                                                    <span>Descuento ({pf.descuentoManualPct}%)</span>
                                                    <span>-${pf.descuentoManualMonto.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                                                <span>IVA ({Math.round(pf.ivaPct * 100)}%)</span>
                                                <span className={pf.isPagoUnico ? 'text-emerald-500' : 'text-blue-500'}>+${pf.ivaLicencia.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="pt-2 border-t border-slate-100 flex justify-between text-[11px] font-bold text-slate-700">
                                                <span>Total Plan</span>
                                                <span>${pf.totalLicencia.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </div>
                                        </div>

                                        {/* CTA */}
                                        <div className={`w-full h-10 rounded-xl flex items-center justify-center text-[10px] font-black uppercase tracking-widest transition-all ${isSelected
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}>
                                            {isSelected
                                                ? <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Plan Seleccionado</>
                                                : 'Seleccionar →'
                                            }
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* PAGO INICIAL — siempre independiente, nunca cambia */}
                    {(() => {
                        const implementacionBase = Number(cotizacion.costo_implementacion) || 0;
                        const modulos = cotizacion.modulos_adicionales || [];
                        const serviciosUnicos = modulos.filter((m: any) => (Number(m.pago_unico) || 0) > 0);
                        const { ivaPct, ivaImplementacion } = financials;
                        if (implementacionBase === 0 && serviciosUnicos.length === 0) return null;
                        return (
                            <div className="mt-6 bg-gradient-to-br from-orange-50 to-amber-50 rounded-[2rem] p-6 shadow-sm border-2 border-orange-200">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 className="text-base font-black uppercase tracking-tight leading-none text-slate-800">PAGO INICIAL</h4>
                                        <p className="text-[10px] text-orange-500 font-bold mt-1">Requerido antes de activar</p>
                                    </div>
                                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                                        <Package className="w-5 h-5 text-orange-500" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    {implementacionBase > 0 && (
                                        <div className="flex justify-between items-center text-[11px] text-slate-600 font-medium gap-2">
                                            <span className="truncate flex-1">Implementación</span>
                                            <span className="font-bold text-slate-800 whitespace-nowrap">${implementacionBase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                    {serviciosUnicos.map((serv: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center text-[11px] text-slate-600 font-medium gap-2">
                                            <span className="truncate flex-1">{serv.nombre}</span>
                                            <span className="font-bold text-slate-800 whitespace-nowrap">${Number(serv.pago_unico).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between items-center text-[11px] text-slate-500 font-medium gap-2">
                                        <span className="truncate flex-1">IVA ({Math.round(ivaPct * 100)}%)</span>
                                        <span className="font-bold text-orange-500 whitespace-nowrap">+$ {ivaImplementacion.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
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
                </div>

            {/* Terms of Service */}
            <div className="mb-8">
                <div className="flex items-center gap-3 px-2 mb-6">
                    <FileText className="w-5 h-5 text-indigo-500" />
                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.3em]">TÉRMINOS DEL SERVICIO</h4>
                </div>
                <div className="bg-white rounded-[2rem] border border-slate-200/60 p-6 md:p-10 space-y-6">
                    <div className="max-h-80 overflow-y-auto pr-4 custom-scrollbar space-y-8">
                        {(cotizacion.company?.terminos_condiciones || '').split('\n\n').filter((p: string) => p.trim()).map((para: string, idx: number) => (
                            <div key={idx} className="flex gap-4 items-start group">
                                <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-[10px] font-black text-indigo-600 shrink-0 group-hover:bg-indigo-50 transition-colors">
                                    {idx + 1}
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                                    {para.trim().split(/(\*\*.*?\*\*)/).map((part, i) =>
                                        part.startsWith('**') && part.endsWith('**')
                                            ? <strong key={i} className="text-slate-900 font-extrabold">{part.slice(2, -2)}</strong>
                                            : part
                                    )}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Creator Footer — same dark shape as the hero header */}
            <div className="bg-[#0f172a] rounded-[2.5rem] p-8 md:p-10 text-white relative overflow-hidden shadow-2xl shadow-slate-900/20">
                <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-[80px] -mr-20 -mt-20 pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex flex-col md:flex-row items-center gap-5 w-full md:w-auto">
                        <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center relative overflow-hidden shrink-0">
                            {cotizacion.creator?.avatar_url ? (
                                <img src={cotizacion.creator.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-white font-black text-2xl">
                                    {(cotizacion.creator?.full_name || cotizacion.creator?.email || 'A').charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>
                        <div className="text-center md:text-left">
                            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-1">ASESOR COMERCIAL</p>
                            <h4 className="text-xl font-black text-white leading-none uppercase tracking-tight">{cotizacion.creator?.full_name || 'AGENTE OFICIAL'}</h4>
                            <p className="text-[10px] font-bold text-slate-400 mt-1.5 lowercase">{cotizacion.creator?.email}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right hidden md:block">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Escanea para compartir</p>
                            <p className="text-[9px] text-slate-600 mt-0.5">#{cotizacion.id.slice(0, 8).toUpperCase()}</p>
                        </div>
                        <div className="w-20 h-20 bg-white p-2.5 rounded-2xl shadow-lg">
                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${window.location.href}`} alt="QR" className="w-full h-full opacity-80" />
                        </div>
                    </div>
                </div>
            </div>

            </div> {/* END max-w-4xl container */}

            {/* Signature Bottom Sheet Style Modal */}
            {showSignatureModal && (
                <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-t-[3rem] md:rounded-[3rem] p-8 md:p-10 shadow-2xl space-y-8 animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300">
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto md:hidden -mt-2 mb-6"></div>
                        <div className="text-center space-y-3">
                            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                                <PencilLine className="w-8 h-8" />
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase m-0">FIRMA DIGITAL</h2>
                            <p className="text-[11px] text-slate-500 font-bold leading-relaxed max-w-[240px] mx-auto uppercase tracking-wide">Ingresa tu nombre para formalizar la aceptación.</p>
                        </div>
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">NOMBRE COMPLETO</label>
                                <input
                                    type="text"
                                    value={signerName}
                                    onChange={(e) => setSignerName(e.target.value)}
                                    placeholder="CRISTOBAL ARIAS"
                                    className="w-full h-16 bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-black text-xl text-slate-800 placeholder:text-slate-200 uppercase"
                                    autoFocus
                                />
                            </div>
                            <div className="flex flex-col gap-3">
                                <Button
                                    variant="default"
                                    onClick={handleAccept}
                                    disabled={isAccepting || !signerName.trim()}
                                    className="h-16 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl transition-all"
                                >
                                    {isAccepting ? 'PROCESANDO...' : 'CONFIRMAR Y FIRMAR'}
                                </Button>
                                <button
                                    onClick={() => setShowSignatureModal(false)}
                                    className="h-12 text-slate-400 hover:text-slate-600 font-black text-[9px] uppercase tracking-widest transition-colors"
                                >
                                    VOLVER A REVISAR
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
                @media (max-width: 768px) {
                    body { -webkit-tap-highlight-color: transparent; }
                }
            `}} />
        </div>
    );
}
