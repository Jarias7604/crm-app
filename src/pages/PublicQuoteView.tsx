import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Building2, Package, Globe, Download, FileText, CheckCircle2, User, PencilLine, Mail, Phone, Settings, MessageSquare, ChevronRight } from 'lucide-react';
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
                <div className="mt-8 p-6 bg-slate-50 rounded-2xl text-[10px] text-slate-400 font-mono text-left">
                    <p>SUPABASE: {(supabase as any).supabaseUrl}</p>
                    {error && <p className="mt-1 text-red-400">ERROR: {error}</p>}
                </div>
            </div>
        </div>
    );

    const financials = calculateQuoteFinancials(cotizacion);

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans pb-32 md:pb-20 overflow-x-hidden">
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
                        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center justify-between group active:scale-[0.98] transition-all">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="font-black text-slate-900 text-sm leading-none m-0 uppercase">Licenciamiento Anual</p>
                                    <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">PLAN {cotizacion.plan_nombre}</p>
                                </div>
                            </div>
                            <span className="text-lg font-black text-slate-900 tracking-tight">${Number(cotizacion.costo_plan_anual).toLocaleString()}</span>
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

                        {(cotizacion.modulos_adicionales || []).map((mod: any, idx: number) => (
                            <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex items-center justify-between group active:scale-[0.98] transition-all text-xs">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                                        <Package className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="font-black text-slate-900 text-sm leading-none m-0 uppercase">{mod.nombre}</p>
                                        <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">MÓDULO ADICIONAL</p>
                                    </div>
                                </div>
                                <span className="text-lg font-black text-slate-900 tracking-tight">${(Number(mod.costo_anual || mod.costo)).toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Mobile Financial Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
                    <div className="bg-orange-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-orange-600/20 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-12 -mt-12"></div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                                <Package className="w-5 h-5" />
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest leading-none">INVERSIÓN DE ACTIVACIÓN</p>
                        </div>
                        <h4 className="text-[10px] font-bold opacity-60 uppercase mb-1">Pago Inicial Hoy</h4>
                        <p className="text-4xl font-black tracking-tighter">${financials.pagoInicial.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <p className="text-[9px] font-bold opacity-70 mt-4 uppercase tracking-[0.2em]">REQUERIDO PARA ACTIVAR SERVICIOS</p>
                    </div>

                    <div className={`${financials.isMonthly ? 'bg-indigo-600' : 'bg-emerald-600'} rounded-[2.5rem] p-8 text-white shadow-xl shadow-slate-900/20 relative overflow-hidden`}>
                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-12 -mt-12"></div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                                <Globe className="w-5 h-5" />
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest leading-none">{financials.isMonthly ? 'MENSUALIDAD ESTIMADA' : 'INVERSIÓN ANUAL'}</p>
                        </div>
                        <h4 className="text-[10px] font-bold opacity-60 uppercase mb-1">Costo Recurrente</h4>
                        <p className="text-4xl font-black tracking-tighter">
                            ${(financials.isMonthly ? financials.cuotaMensual : financials.totalAnual).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            {financials.isMonthly && <span className="text-xs opacity-50 ml-1">/ MES</span>}
                        </p>
                        <p className="text-[9px] font-bold opacity-70 mt-4 uppercase tracking-[0.2em]">LICENCIAMIENTO + SOPORTE</p>
                    </div>
                </div>

                {/* Terms of Service Accordion-style Area */}
                <div className="mb-20">
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

                {/* Creator Footer Mobile Optimized */}
                <div className="bg-slate-900 rounded-[2.5rem] p-8 md:p-12 mb-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-10">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center p-1 relative overflow-hidden ring-4 ring-indigo-500/20 rotate-3 shrink-0">
                            {cotizacion.creator?.avatar_url ? (
                                <img src={cotizacion.creator.avatar_url} alt="" className="w-full h-full object-cover rounded-2xl" />
                            ) : (
                                <span className="text-white font-black text-3xl">
                                    {(cotizacion.creator?.full_name || cotizacion.creator?.email || 'A').charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-1">ASESOR COMERCIAL</p>
                            <h4 className="text-xl font-black text-white leading-none uppercase tracking-tight">{cotizacion.creator?.full_name || 'AGENTE OFICIAL'}</h4>
                            <p className="text-[10px] font-bold text-slate-500 mt-2 lowercase">{cotizacion.creator?.email}</p>
                        </div>
                    </div>
                    <div className="w-20 h-20 bg-white p-2.5 rounded-2xl shadow-2xl rotate-[-3deg] self-start md:self-auto ml-2 md:ml-0">
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${window.location.href}`} alt="QR" className="w-full h-full grayscale opacity-70" />
                    </div>
                </div>
            </div>

            {/* Signature Bottom Sheet Style Modal */}
            {showSignatureModal && (
                <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-t-[3rem] md:rounded-[3rem] p-8 md:p-10 shadow-2xl space-y-8 animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300">
                        {/* Mobile Handle */}
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
