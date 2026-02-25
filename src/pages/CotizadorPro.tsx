import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, FileText, Receipt, Search, X, Package, Globe, Link2, ChevronRight } from 'lucide-react';
import { cotizadorService, type CotizadorPaquete, type CotizadorItem, type CotizacionCalculada } from '../services/cotizador';
import { pricingService } from '../services/pricing';
import type { FinancingPlan, PaymentSettings } from '../types/pricing';
import { leadsService } from '../services/leads';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { cotizacionesService } from '../services/cotizaciones';
import { useAuth } from '../auth/AuthProvider';
import { usePermissions } from '../hooks/usePermissions';
import { pdfService } from '../services/pdfService';
import toast from 'react-hot-toast';
import { logger } from '../utils/logger';

export default function CotizadorPro() {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const { profile } = useAuth();
    const { hasPermission } = usePermissions();
    const [loading, setLoading] = useState(true);
    const [pasoActual, setPasoActual] = useState(1);

    // Datos
    const [leads, setLeads] = useState<any[]>([]);
    const [paquetes, setPaquetes] = useState<CotizadorPaquete[]>([]);
    const [modulos, setModulos] = useState<CotizadorItem[]>([]);
    const [servicios, setServicios] = useState<CotizadorItem[]>([]);
    const [searchLead, setSearchLead] = useState('');
    const [showLeadSelector, setShowLeadSelector] = useState(false);

    // Formulario
    const [formData, setFormData] = useState({
        // Paso 1: Cliente  
        usar_lead: false,
        lead_id: null as string | null,
        cliente_nombre: '',
        cliente_empresa: '',
        cliente_email: '',
        cliente_telefono: '',
        cliente_direccion: '',
        volumen_dtes: 0,

        // Paso 2: Paquete
        paquete_id: '',

        // Paso 3: Módulos y servicios
        modulos_ids: [] as string[],
        servicios_ids: [] as string[],

        // Paso 4: Descuento e IVA
        descuento_porcentaje: 0,
        iva_porcentaje: 13,
        incluir_implementacion: true,

        // Forma de pago
        forma_pago: 'mensual' as 'anual' | 'mensual',
        meses_pago: 1, // Período de pago: 1, 3, 6, 9, o 12 meses
        recargo_mensual_porcentaje: 20,
        pago_anual_seleccionado: false,
        pago_mensual_seleccionado: false
    });

    const [paqueteSugerido, setPaqueteSugerido] = useState<CotizadorPaquete | null>(null);
    const [overrides, setOverrides] = useState<Record<string, number>>({});
    const [implementationOverride, setImplementationOverride] = useState<number | null>(null);
    const [paqueteOverride, setPaqueteOverride] = useState<number | null>(null);
    const [totales, setTotales] = useState<CotizacionCalculada | null>(null);

    // Nuevos estados para pagos dinámicos
    const [financingPlans, setFinancingPlans] = useState<FinancingPlan[]>([]);
    const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

    // Permisos: super_admin ya está cubierto dentro de hasPermission(); company_admin necesita fallback
    // explícito porque no tiene entradas en role_permissions.
    const canChangePaymentMethod = hasPermission('cotizaciones.change_payment_method') || profile?.role === 'company_admin';

    // Estado para widget de precio
    const [isWidgetOpen, setIsWidgetOpen] = useState(true);

    const location = useLocation();

    useEffect(() => {
        const init = async () => {
            await Promise.all([loadData(), loadLeads()]);

            // Si venimos del chat con un lead específico
            if (location.state?.lead) {
                const l = location.state.lead;
                setFormData(prev => ({
                    ...prev,
                    usar_lead: true,
                    lead_id: l.id,
                    cliente_nombre: l.name || '',
                    cliente_empresa: l.company_name || '',
                    cliente_email: l.email || '',
                    cliente_telefono: l.phone || ''
                }));
            }

            if (id) {
                await loadExistingCotizacion(id);
            }
        };
        init();
    }, [id, location.state]);

    const loadExistingCotizacion = async (cotId: string) => {
        try {
            const cot = await cotizacionesService.getCotizacion(cotId);
            if (cot) {
                // Mapear datos de la cotización al formulario
                setFormData(prev => ({
                    ...prev,
                    lead_id: cot.lead_id,
                    cliente_nombre: cot.nombre_cliente,
                    cliente_empresa: cot.empresa_cliente || '',
                    cliente_email: cot.email_cliente || '',
                    cliente_telefono: cot.telefono_cliente || '',
                    cliente_direccion: cot.direccion_cliente || '',
                    volumen_dtes: cot.volumen_dtes,
                    descuento_porcentaje: cot.descuento_porcentaje,
                    iva_porcentaje: cot.iva_porcentaje,
                    incluir_implementacion: cot.incluir_implementacion
                }));

                // Re-encontrar paquete_id y IDs de módulos
                // Nota: Esto requiere que los nombres coincidan
                // Implementación simplificada: asumimos que encontraremos los IDs por nombre
            }
        } catch (error) {
            logger.error('Error loading existing cotizacion', error, { action: 'loadExistingCotizacion', cotId });
            toast.error('Error al cargar la cotización para editar');
        }
    };

    // Bloquear scroll del body cuando el modal está abierto
    useEffect(() => {
        if (showLeadSelector) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        // Cleanup al desmontar
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [showLeadSelector]);

    useEffect(() => {
        if (formData.volumen_dtes > 0) {
            buscarPaqueteSugerido();
        }
    }, [formData.volumen_dtes]);

    useEffect(() => {
        calcularTotales();
    }, [
        formData.paquete_id,
        formData.modulos_ids,
        formData.servicios_ids,
        formData.volumen_dtes,
        formData.incluir_implementacion,
        formData.descuento_porcentaje,
        formData.iva_porcentaje,
        formData.recargo_mensual_porcentaje,
        overrides,
        implementationOverride,
        paqueteOverride,
        selectedPlanId,
        financingPlans
    ]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [paqData, itemsData, plansData, settingsData] = await Promise.all([
                cotizadorService.getAllPaquetes(),
                cotizadorService.getAllItems(),
                pricingService.getFinancingPlans(profile?.company_id),
                pricingService.getPaymentSettings(profile?.company_id)
            ]);

            setPaquetes(paqData);
            setModulos(itemsData.filter(i => i.tipo === 'modulo'));
            setServicios(itemsData.filter(i => i.tipo === 'servicio'));
            setFinancingPlans(plansData);
            setPaymentSettings(settingsData);

            // Configuración Inicial Inteligente
            let defaultPlan: FinancingPlan | undefined = undefined;
            if (plansData.length > 0) {
                // Priorizar plan anual con descuento (pago contado)
                defaultPlan = plansData.find(p => p.tipo_ajuste === 'discount') || plansData[0];
                setSelectedPlanId(defaultPlan.id);
            }

            if (settingsData || defaultPlan) {
                setFormData(prev => {
                    const isDiscountPlan = defaultPlan?.tipo_ajuste === 'discount';

                    return {
                        ...prev,
                        iva_porcentaje: settingsData?.iva_defecto ?? 13,
                        recargo_mensual_porcentaje: settingsData?.recargo_financiamiento_base ?? 20,
                        // El descuento manual empieza en 0, el del plan es interno
                        descuento_porcentaje: 0,
                        forma_pago: isDiscountPlan ? 'anual' : 'mensual',
                        meses_pago: defaultPlan?.meses ?? 1
                    };
                });
            }
        } catch (error) {
            logger.error('Error loading data', error, { action: 'loadData' });
            toast.error('Error al cargar datos dinámicos');
        } finally {
            setLoading(false);
        }
    };

    const loadLeads = async () => {
        try {
            const { data } = await leadsService.getLeads();
            setLeads(data || []);
        } catch (error) {
            logger.error('Error loading leads', error, { action: 'loadLeads' });
        }
    };

    const handleSeleccionarLead = (lead: any) => {
        setFormData({
            ...formData,
            usar_lead: true,
            lead_id: lead.id,
            cliente_nombre: lead.name || '',
            cliente_empresa: lead.company_name || '',
            cliente_email: lead.email || '',
            cliente_telefono: lead.phone || '',
            cliente_direccion: lead.address || lead.address_line1 || ''
        });
        setShowLeadSelector(false);
        setSearchLead('');
    };

    const buscarPaqueteSugerido = async () => {
        try {
            const paquete = await cotizadorService.buscarPaquetePorDTEs(formData.volumen_dtes);
            if (paquete) {
                setPaqueteSugerido(paquete);
                setFormData(prev => ({ ...prev, paquete_id: paquete.id }));
            }
        } catch (error) {
            logger.error('Error buscando paquete', error, { action: 'buscarPaqueteSugerido', volumenDtes: formData.volumen_dtes });
        }
    };

    const calcularTotales = () => {
        const paqueteSeleccionado = paquetes.find(p => p.id === formData.paquete_id);
        if (!paqueteSeleccionado) {
            setTotales(null);
            return;
        }

        const itemsSeleccionados = [
            ...modulos.filter(m => formData.modulos_ids.includes(m.id)),
            ...servicios.filter(s => formData.servicios_ids.includes(s.id))
        ].map(item => {
            // Aplicar override si existe, preservando si es pago único o recurrente
            if (overrides[item.id] !== undefined) {
                const esPagoUnico = (item.pago_unico || 0) > 0;
                const overrideVal = overrides[item.id];
                return {
                    ...item,
                    // Pago único: el override va a pago_unico; Recurrente: el override va a precio_anual
                    pago_unico: esPagoUnico ? overrideVal : 0,
                    precio_anual: esPagoUnico ? 0 : overrideVal,
                    // CRÍTICO: sincronizar precio_mensual para evitar el fallback incorrecto en el motor
                    // cotizador.ts usa `precio_anual || precio_mensual*12` — si precio_anual=0 (falsy en JS)
                    // sin este fix usaría precio_mensual original ignorando el 0 del usuario
                    precio_mensual: esPagoUnico ? item.precio_mensual : overrideVal / 12,
                    precio_por_dte: 0,
                };
            }
            return item;
        });

        // Aplicar override de paquete (precio del plan) y/o implementación
        const packageWithOverride = {
            ...paqueteSeleccionado,
            ...(paqueteOverride !== null ? { costo_paquete_anual: paqueteOverride } : {}),
            ...(implementationOverride !== null ? { costo_implementacion: implementationOverride } : {})
        };

        const selectedPlan = financingPlans.find(p => p.id === selectedPlanId);

        // MOTOR V2: Construir configuración unificada
        const config = {
            forma_pago: (selectedPlan?.tipo_ajuste === 'discount' ? 'anual' : 'mensual') as 'anual' | 'mensual',
            meses: selectedPlan?.meses || 1,
            cuotas: selectedPlan?.cuotas, // V3: Inyectamos cuotas explícitas si existen
            tipo_ajuste: selectedPlan?.tipo_ajuste || 'none',
            tasa_ajuste: selectedPlan?.interes_porcentaje || 0,
            descuento_manual: formData.descuento_porcentaje || 0, // Descuento manual del campo UI
            iva_porcentaje: formData.iva_porcentaje,
            incluir_implementacion: formData.incluir_implementacion
        };

        const cotizacion = cotizadorService.calcularCotizacion(
            packageWithOverride,
            itemsSeleccionados,
            formData.volumen_dtes,
            config
        );

        setTotales(cotizacion);
    };

    const handleSiguiente = () => {
        if (pasoActual === 1 && !formData.cliente_nombre) {
            toast.error('Ingresa el nombre del cliente');
            return;
        }
        if (pasoActual === 1 && formData.volumen_dtes <= 0) {
            toast.error('Ingresa la cantidad de DTEs');
            return;
        }
        if (pasoActual === 2 && !formData.paquete_id) {
            toast.error('Selecciona un paquete');
            return;
        }

        if (pasoActual < 4) {
            setPasoActual(pasoActual + 1);
        }
    };

    const handleAnterior = () => {
        if (pasoActual > 1) {
            setPasoActual(pasoActual - 1);
        }
    };

    const toggleModulo = (id: string) => {
        setFormData(prev => ({
            ...prev,
            modulos_ids: prev.modulos_ids.includes(id)
                ? prev.modulos_ids.filter(m => m !== id)
                : [...prev.modulos_ids, id]
        }));
    };

    const toggleServicio = (id: string) => {
        setFormData(prev => ({
            ...prev,
            servicios_ids: prev.servicios_ids.includes(id)
                ? prev.servicios_ids.filter(s => s !== id)
                : [...prev.servicios_ids, id]
        }));
    };

    const handleGenerar = async () => {
        try {
            const paqueteSeleccionado = paquetes.find(p => p.id === formData.paquete_id);
            if (!paqueteSeleccionado) {
                toast.error('Debe seleccionar un paquete');
                return;
            }

            if (!formData.cliente_nombre) {
                toast.error('Debe ingresar el nombre del cliente');
                return;
            }

            if (!formData.volumen_dtes || formData.volumen_dtes <= 0) {
                toast.error('Debe ingresar el volumen de DTEs');
                return;
            }

            if (!profile?.company_id) {
                toast.error('Error: No se pudo obtener la información de la empresa');
                return;
            }

            if (!totales) {
                toast.error('Error: No se han calculado los totales');
                return;
            }

            // Detectar servicios seleccionados
            const whatsappSeleccionado = formData.servicios_ids.some(id => {
                const servicio = servicios.find(s => s.id === id);
                return servicio?.nombre.toLowerCase().includes('whatsapp');
            });

            const whatsappServicio = servicios.find(s =>
                formData.servicios_ids.includes(s.id) &&
                s.nombre.toLowerCase().includes('whatsapp')
            );

            const personalizacionSeleccionada = formData.servicios_ids.some(id => {
                const servicio = servicios.find(s => s.id === id);
                return servicio?.nombre.toLowerCase().includes('personaliz');
            });

            const personalizacionServicio = servicios.find(s =>
                formData.servicios_ids.includes(s.id) &&
                s.nombre.toLowerCase().includes('personaliz')
            );

            // Preparar modulos y servicios generales para modulos_adicionales
            const todosLosItems = [
                ...modulos.filter(m => formData.modulos_ids.includes(m.id)),
                ...servicios.filter(s =>
                    formData.servicios_ids.includes(s.id) &&
                    !s.nombre.toLowerCase().includes('whatsapp') &&
                    !s.nombre.toLowerCase().includes('personaliz')
                )
            ].map(item => {
                const manualPrice = overrides[item.id];
                const esPagoUnico = (item.pago_unico || 0) > 0;
                const costoCalculado = manualPrice !== undefined
                    ? manualPrice
                    : (item.precio_por_dte > 0
                        ? formData.volumen_dtes * item.precio_por_dte
                        : (item.pago_unico || item.precio_anual));

                return {
                    nombre: item.nombre,
                    tipo: item.tipo,
                    descripcion: item.descripcion || '',
                    // Si es pago único, guardarlo en pago_unico; si no, en costo_anual
                    pago_unico: esPagoUnico ? costoCalculado : 0,
                    costo_anual: esPagoUnico ? 0 : costoCalculado,
                    costo_mensual: item.precio_mensual || 0
                };
            });

            // Preparar datos para guardar (formato correcto)
            const cotizacionData = {
                company_id: profile.company_id,
                lead_id: formData.lead_id,
                nombre_cliente: formData.cliente_nombre,
                empresa_cliente: formData.cliente_empresa,
                email_cliente: formData.cliente_email,
                telefono_cliente: formData.cliente_telefono,
                direccion_cliente: formData.cliente_direccion,
                volumen_dtes: formData.volumen_dtes,
                plan_nombre: paqueteSeleccionado.paquete,
                costo_plan_anual: paqueteOverride ?? paqueteSeleccionado.costo_paquete_anual,
                costo_plan_mensual: paqueteSeleccionado.costo_paquete_mensual,
                costo_implementacion: formData.incluir_implementacion
                    ? (implementationOverride ?? paqueteSeleccionado.costo_implementacion)
                    : 0,
                modulos_adicionales: todosLosItems,
                servicio_whatsapp: whatsappSeleccionado,
                costo_whatsapp: whatsappServicio
                    ? (overrides[whatsappServicio.id] !== undefined
                        ? overrides[whatsappServicio.id]
                        : (whatsappServicio.precio_por_dte > 0
                            ? formData.volumen_dtes * whatsappServicio.precio_por_dte
                            : whatsappServicio.precio_anual))
                    : 0,
                servicio_personalizacion: personalizacionSeleccionada,
                costo_personalizacion: personalizacionServicio
                    ? (overrides[personalizacionServicio.id] !== undefined
                        ? overrides[personalizacionServicio.id]
                        : (personalizacionServicio.pago_unico || personalizacionServicio.precio_anual))
                    : 0,
                subtotal_anual: totales.subtotal_recurrente_base + totales.subtotal_pagos_unicos,
                subtotal_mensual: totales.cuota_mensual,
                descuento_porcentaje: formData.descuento_porcentaje,
                descuento_monto: totales.descuento_monto,
                iva_porcentaje: formData.iva_porcentaje,
                iva_monto: totales.iva_pagos_unicos + totales.iva_monto_recurrente,
                total_anual: totales.total_general,
                total_mensual: (formData.forma_pago === 'mensual' ? totales.cuota_mensual : totales.total_recurrente),
                monto_anticipo: totales.total_pagos_unicos,
                subtotal_anticipo: totales.subtotal_pagos_unicos,
                iva_anticipo: totales.iva_pagos_unicos,
                // TODO: Re-enable after running EJECUTAR_EN_SUPABASE.sql migration
                // subtotal_recurrente: totales.subtotal_recurrente_base,
                // iva_recurrente: totales.iva_monto_recurrente,

                // CORRECCIÓN: Usar valores del plan de financiamiento seleccionado
                tipo_pago: (totales.es_financiado ? 'credito' : 'contado') as 'credito' | 'contado',
                plazo_meses: totales.cuotas, // Usar cuotas como plazo_meses para consistencia
                cuotas: totales.cuotas,
                descripcion_pago: financingPlans.find(p => p.id === selectedPlanId)?.titulo ||
                    (totales.cuotas > 1 ? `${totales.cuotas} Cuotas` : '1 Solo pago'),

                incluir_implementacion: formData.incluir_implementacion,
                estado: 'borrador' as const
            };

            let result;
            if (id) {
                result = await cotizacionesService.updateCotizacion(id, cotizacionData);
                toast.success('✅ Cotización actualizada exitosamente');
            } else {
                result = await cotizacionesService.createCotizacion(cotizacionData);
                toast.success('✅ Cotización creada exitosamente');
            }

            if (location.state?.fromChat) {
                try {
                    toast.loading('Generando PDF oficial...', { id: 'pdf-gen' });
                    const pdfUrl = await pdfService.generateAndUploadQuotePDF(result);
                    toast.success('PDF generado y listo', { id: 'pdf-gen' });

                    navigate('/marketing/chat', {
                        state: {
                            newQuote: { ...result, pdfUrl },
                            conversation_id: location.state.conversation_id,
                            lead: location.state.lead
                        },
                        replace: true
                    });
                } catch (pdfErr: any) {
                    logger.error('PDF generation failed', pdfErr, { action: 'handleGenerar', quoteId: result.id });
                    toast.error(`Falla al crear PDF: ${pdfErr.message || 'Error Desconocido'}`, { id: 'pdf-gen' });
                    navigate('/marketing/chat', {
                        state: {
                            newQuote: result,
                            conversation_id: location.state.conversation_id,
                            lead: location.state.lead
                        },
                        replace: true
                    });
                }
            } else {
                navigate('/cotizaciones');
            }
        } catch (error: any) {
            logger.error('Error procesando cotización', error, { action: 'handleGenerar' });
            const errorMessage = error?.message || error?.toString() || 'Error al procesar cotización';
            toast.error(`Error: ${errorMessage}`);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Cargando cotizador...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 pb-32 sm:pb-6">
                {/* Header — compact on mobile */}
                <div>
                    <h1 className="text-lg sm:text-2xl font-extrabold text-[#4449AA]">📋 Nueva Cotización</h1>
                    <p className="text-xs sm:text-sm text-gray-400 mt-0.5">Sistema dinámico basado en paquetes</p>
                </div>

                {/* ── Indicador de Pasos: Progressive Compact ── */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-5">
                    <div className="flex items-center w-full">
                        {[1, 2, 3, 4].map((paso) => {
                            const LABELS: Record<number, string> = { 1: 'Cliente', 2: 'Paquete', 3: 'Módulos', 4: 'Resumen' };
                            const isCompleted = paso < pasoActual;
                            const isActive = paso === pasoActual;

                            return (
                                <div key={paso} className={`flex items-center ${paso < 4 ? 'flex-1' : ''}`}>
                                    {/* ── Step node ── */}
                                    {isCompleted ? (
                                        // Completed → micro checkmark
                                        <div className="w-6 h-6 rounded-full bg-[#4449AA] flex-shrink-0 flex items-center justify-center shadow-sm ring-2 ring-[#4449AA]/10 transition-all duration-500">
                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    ) : isActive ? (
                                        // Active → branded pill with label
                                        <div className="flex-shrink-0 flex items-center gap-1.5 bg-[#4449AA] text-white px-3 py-1.5 rounded-full shadow-md shadow-[#4449AA]/25 transition-all duration-500">
                                            <span className="text-[11px] font-black w-4 h-4 bg-white/20 rounded-full flex items-center justify-center leading-none">{paso}</span>
                                            <span className="text-[11px] font-black tracking-wide">{LABELS[paso]}</span>
                                        </div>
                                    ) : (
                                        // Future → small circle + mini label
                                        <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
                                            <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center transition-all duration-300">
                                                <span className="text-xs font-bold text-gray-400">{paso}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Connecting line ── */}
                                    {paso < 4 && (
                                        <div className="flex-1 mx-2 h-[2px] bg-gray-100 relative overflow-hidden rounded-full">
                                            <div
                                                className="absolute inset-y-0 left-0 bg-[#4449AA] rounded-full transition-all duration-700 ease-out"
                                                style={{ width: isCompleted ? '100%' : '0%' }}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Contenido */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
                    {/* PASO 1: Cliente */}
                    {pasoActual === 1 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-lg sm:text-2xl font-extrabold text-[#4449AA] mb-1">Información del Cliente</h2>
                                <p className="text-xs sm:text-sm text-gray-400">Configure los detalles del cliente para esta cotización</p>
                            </div>

                            {/* ── Inline Lead Link chip ── */}
                            {!formData.usar_lead ? (
                                // Empty state — compact tappable row
                                <button
                                    onClick={() => setShowLeadSelector(true)}
                                    className="w-full flex items-center gap-3 px-4 py-3.5 bg-gray-50 hover:bg-[#4449AA]/5 border border-dashed border-gray-200 hover:border-[#4449AA]/40 rounded-2xl transition-all duration-200 active:scale-[0.98] group"
                                >
                                    <div className="w-9 h-9 rounded-xl bg-[#4449AA]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#4449AA]/15 transition-colors">
                                        <Link2 className="w-4 h-4 text-[#4449AA]" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-sm font-semibold text-gray-700">Vincular a Lead existente</p>
                                        <p className="text-[11px] text-gray-400 leading-tight">Auto-completa nombre, email y empresa</p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#4449AA] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                                </button>
                            ) : (
                                // Linked state — avatar + info chip
                                <div className="w-full flex items-center gap-3 px-4 py-3 bg-[#4449AA]/5 border border-[#4449AA]/20 rounded-2xl">
                                    <div className="w-9 h-9 rounded-full bg-[#4449AA] flex items-center justify-center flex-shrink-0 text-white font-black text-sm shadow-sm">
                                        {(formData.cliente_nombre || 'L')[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-900 truncate leading-tight">{formData.cliente_nombre}</p>
                                        {formData.cliente_email && (
                                            <p className="text-[11px] text-gray-400 truncate leading-tight">{formData.cliente_email}</p>
                                        )}
                                    </div>
                                    <span className="text-[9px] font-black text-[#4449AA] bg-[#4449AA]/10 px-2 py-0.5 rounded-full uppercase tracking-widest flex-shrink-0">Lead</span>
                                    <button
                                        onClick={() => {
                                            setFormData({ ...formData, usar_lead: false, lead_id: null, cliente_nombre: '', cliente_email: '' });
                                        }}
                                        className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                                        title="Desvincular Lead"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}

                            {/* Formulario de Datos */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Nombre del Cliente *
                                    </label>
                                    <Input
                                        value={formData.cliente_nombre}
                                        onChange={(e) => setFormData({ ...formData, cliente_nombre: e.target.value })}
                                        placeholder="Empresa ABC S.A."
                                        disabled={formData.usar_lead}
                                        className={formData.usar_lead ? 'bg-gray-100 cursor-not-allowed' : ''}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Email
                                    </label>
                                    <Input
                                        type="email"
                                        value={formData.cliente_email}
                                        onChange={(e) => setFormData({ ...formData, cliente_email: e.target.value })}
                                        placeholder="contacto@empresa.com"
                                        disabled={formData.usar_lead}
                                        className={formData.usar_lead ? 'bg-gray-100 cursor-not-allowed border-gray-100' : ''}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Empresa
                                    </label>
                                    <Input
                                        value={formData.cliente_empresa}
                                        onChange={(e) => setFormData({ ...formData, cliente_empresa: e.target.value })}
                                        placeholder="Nombre de la Empresa"
                                        disabled={formData.usar_lead}
                                        className={formData.usar_lead ? 'bg-gray-100 cursor-not-allowed border-gray-100' : ''}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Teléfono
                                    </label>
                                    <Input
                                        value={formData.cliente_telefono}
                                        onChange={(e) => setFormData({ ...formData, cliente_telefono: e.target.value })}
                                        placeholder="7000-0000"
                                        disabled={formData.usar_lead}
                                        className={formData.usar_lead ? 'bg-gray-100 cursor-not-allowed border-gray-100' : ''}
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Dirección Fiscal o Entrega
                                    </label>
                                    <Input
                                        value={formData.cliente_direccion}
                                        onChange={(e) => setFormData({ ...formData, cliente_direccion: e.target.value })}
                                        placeholder="Calle 123, Ciudad"
                                        disabled={formData.usar_lead}
                                        className={formData.usar_lead ? 'bg-gray-100 cursor-not-allowed border-gray-100' : ''}
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Cantidad de DTEs al año *
                                    </label>
                                    <Input
                                        type="number"
                                        value={formData.volumen_dtes || ''}
                                        onChange={(e) => setFormData({ ...formData, volumen_dtes: Number(e.target.value) })}
                                        placeholder="2200"
                                    />
                                    <div className="flex justify-between items-center mt-2">
                                        <p className="text-xs text-gray-500 italic">
                                            💡 Equivalente a <b>{Math.round(formData.volumen_dtes / 12).toLocaleString()} DTEs mensuales</b> aprox.
                                        </p>
                                        {paqueteSugerido && (
                                            <p className="text-sm text-green-600 font-semibold flex items-center gap-1.5">
                                                <span className="bg-green-100 text-green-700 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">✓</span>
                                                Sugerido: {paqueteSugerido.paquete}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PASO 2: Paquete */}
                    {pasoActual === 2 && (
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold text-[#4449AA]">Seleccionar Paquete Base</h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(() => {
                                    const filtered = paquetes.filter(p => {
                                        const maxDtes = Math.max(...paquetes.map(paq => paq.cantidad_dtes));
                                        if (formData.volumen_dtes > maxDtes) return p.cantidad_dtes === maxDtes;
                                        return p.cantidad_dtes >= formData.volumen_dtes;
                                    });

                                    if (filtered.length === 0) {
                                        return (
                                            <div className="col-span-full py-10 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                                <p className="text-gray-500 font-medium">No se encontraron paquetes compatibles.</p>
                                                <p className="text-xs text-gray-400 mt-1">Verifique la configuración o intente con otro volumen.</p>
                                            </div>
                                        );
                                    }

                                    return filtered.slice(0, 8).map((paquete) => (
                                        <div
                                            key={paquete.id}
                                            onClick={() => setFormData({ ...formData, paquete_id: paquete.id })}
                                            className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${formData.paquete_id === paquete.id
                                                ? 'border-blue-600 bg-blue-50'
                                                : 'border-gray-200 hover:border-blue-300'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="font-bold text-lg text-[#4449AA]">
                                                    {paquete.paquete}
                                                </h3>
                                                {paqueteSugerido?.id === paquete.id && (
                                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">
                                                        ⭐ Sugerido
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-600 mb-2">
                                                {paquete.cantidad_dtes.toLocaleString()} DTEs
                                            </p>
                                            <p className="text-2xl font-extrabold text-green-600">
                                                ${paquete.costo_paquete_anual.toFixed(2)}/año
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                + ${paquete.costo_implementacion.toFixed(2)} implementación
                                            </p>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    )}

                    {/* PASO 3: Módulos y Servicios */}
                    {pasoActual === 3 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-lg font-bold text-[#4449AA] mb-4">📌 Módulos Adicionales</h2>
                                <div className="space-y-2">
                                    {modulos.map((modulo) => (
                                        <label
                                            key={modulo.id}
                                            className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                                        >
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.modulos_ids.includes(modulo.id)}
                                                    onChange={() => toggleModulo(modulo.id)}
                                                    className="w-5 h-5 text-blue-600 rounded"
                                                />
                                                <div>
                                                    <p className="font-semibold text-gray-800">{modulo.nombre}</p>
                                                    {modulo.descripcion && (
                                                        <p className="text-xs text-gray-500">{modulo.descripcion}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <div className="text-right flex flex-col items-end">
                                                        {formData.modulos_ids.includes(modulo.id) && hasPermission('cotizaciones.edit_prices') ? (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-gray-400 font-bold">$</span>
                                                                <input
                                                                    type="number"
                                                                    className="w-24 text-right font-bold text-green-600 border border-blue-200 rounded px-2 py-1 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                                    value={overrides[modulo.id] ?? modulo.precio_anual}
                                                                    onChange={(e) => {
                                                                        setOverrides({ ...overrides, [modulo.id]: Number(e.target.value) });
                                                                    }}
                                                                />
                                                                <span className="text-[10px] text-gray-400 font-bold uppercase">/año</span>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <p className="font-bold text-green-600">
                                                                    ${(overrides[modulo.id] ?? modulo.precio_anual).toFixed(2)}/año
                                                                </p>
                                                                <p className="text-xs text-gray-500">
                                                                    ${modulo.precio_mensual.toFixed(2)}/mes
                                                                </p>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h2 className="text-lg font-bold text-[#4449AA] mb-4">🔧 Servicios Adicionales</h2>
                                <div className="space-y-2">
                                    {servicios.map((servicio) => (
                                        <label
                                            key={servicio.id}
                                            className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                                        >
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.servicios_ids.includes(servicio.id)}
                                                    onChange={() => toggleServicio(servicio.id)}
                                                    className="w-5 h-5 text-blue-600 rounded"
                                                />
                                                <div>
                                                    <p className="font-semibold text-gray-800">{servicio.nombre}</p>
                                                    {servicio.descripcion && (
                                                        <p className="text-xs text-gray-500">{servicio.descripcion}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right flex flex-col items-end">
                                                {formData.servicios_ids.includes(servicio.id) && hasPermission('cotizaciones.edit_prices') ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-gray-400 font-bold">$</span>
                                                        <input
                                                            type="number"
                                                            className="w-24 text-right font-bold text-green-600 border border-blue-200 rounded px-2 py-1 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                            value={overrides[servicio.id] ?? (
                                                                servicio.precio_por_dte > 0
                                                                    ? (formData.volumen_dtes * servicio.precio_por_dte)
                                                                    : (servicio.pago_unico > 0 ? servicio.pago_unico : servicio.precio_anual)
                                                            )}
                                                            onChange={(e) => {
                                                                setOverrides({ ...overrides, [servicio.id]: Number(e.target.value) });
                                                            }}
                                                        />
                                                        <span className="text-[10px] text-gray-400 font-bold uppercase">
                                                            {servicio.pago_unico > 0 ? 'Único' : '/año'}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {(() => {
                                                            const currentPrice = overrides[servicio.id] ?? (
                                                                servicio.precio_por_dte > 0
                                                                    ? (formData.volumen_dtes * servicio.precio_por_dte)
                                                                    : (servicio.pago_unico > 0 ? servicio.pago_unico : servicio.precio_anual)
                                                            );
                                                            return (
                                                                <>
                                                                    <p className="font-bold text-green-600">
                                                                        ${currentPrice.toFixed(2)}
                                                                    </p>
                                                                    {servicio.precio_por_dte > 0 && !overrides[servicio.id] && (
                                                                        <p className="text-xs text-gray-500">
                                                                            {formData.volumen_dtes.toLocaleString()} × ${servicio.precio_por_dte}
                                                                        </p>
                                                                    )}
                                                                    {servicio.pago_unico > 0 && (
                                                                        <p className="text-xs text-gray-500">Pago único</p>
                                                                    )}
                                                                    {servicio.precio_anual > 0 && !servicio.pago_unico && !servicio.precio_por_dte && (
                                                                        <p className="text-xs text-gray-500">/año</p>
                                                                    )}
                                                                </>
                                                            );
                                                        })()}
                                                    </>
                                                )}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Toggle Implementación */}
                            {(() => {
                                const paqueteSeleccionado = paquetes.find(p => p.id === formData.paquete_id);
                                const costoImp = paqueteSeleccionado?.costo_implementacion || 0;
                                return costoImp > 0 ? (
                                    <div className="mt-4 flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                        <div>
                                            <p className="font-bold text-sm text-amber-800">🔧 Costo de Implementación</p>
                                            <p className="text-xs text-amber-600 mt-0.5">
                                                ${costoImp.toFixed(2)} — pago único al activar
                                            </p>
                                        </div>
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <span className={`text-xs font-bold ${formData.incluir_implementacion ? 'text-green-600' : 'text-gray-400'}`}>
                                                {formData.incluir_implementacion ? 'INCLUIDA' : 'EXCLUIDA'}
                                            </span>
                                            <div
                                                onClick={() => {
                                                    const turningOn = !formData.incluir_implementacion;
                                                    // Auto-reset to original price if turning ON with price at 0
                                                    if (turningOn && implementationOverride === 0) {
                                                        setImplementationOverride(costoImp);
                                                    }
                                                    setFormData({ ...formData, incluir_implementacion: turningOn });
                                                }}
                                                className={`relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer ${formData.incluir_implementacion ? 'bg-green-500' : 'bg-gray-300'}`}
                                            >
                                                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${formData.incluir_implementacion ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </div>
                                        </label>
                                    </div>
                                ) : null;
                            })()}
                        </div>
                    )}

                    {/* PASO 4: Resumen */}
                    {pasoActual === 4 && (
                        <div className="space-y-6">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                                <h2 className="text-lg font-bold text-[#4449AA]">💰 Resumen de Cotización</h2>
                                <div className="sm:text-right">
                                    <p className="text-xs text-gray-500 font-bold uppercase">Volumen Contratado</p>
                                    <p className="text-sm font-black text-blue-600">
                                        {formData.volumen_dtes.toLocaleString()} DTEs/año
                                        <span className="text-gray-400 font-normal ml-2">({Math.round(formData.volumen_dtes / 12).toLocaleString()} mes)</span>
                                    </p>
                                </div>
                            </div>

                            {/* Desglose Premium */}
                            <div className="space-y-3">
                                {totales?.desglose.map((item, idx) => (
                                    <div key={idx} className="group relative bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="flex gap-3 flex-1 min-w-0">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.tipo === 'Paquete' ? 'bg-blue-50 text-blue-600' :
                                                    item.tipo === 'Implementación' ? 'bg-orange-50 text-orange-600' :
                                                        'bg-purple-50 text-purple-600'
                                                    }`}>
                                                    <FileText className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-gray-900 text-sm sm:text-base truncate">{item.nombre}</p>
                                                        {item.es_pago_unico && (
                                                            <span className="bg-gray-100 text-gray-600 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">Pago Único</span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-0.5">{item.descripcion}</p>
                                                </div>
                                            </div>

                                            <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                                                {(hasPermission('cotizaciones.edit_prices') || profile?.role === 'super_admin' || profile?.role === 'company_admin') ? (() => {
                                                    const itemOriginal = (item.tipo !== 'Implementación' && item.tipo !== 'Paquete')
                                                        ? [...modulos, ...servicios].find(i => i.nombre === item.nombre)
                                                        : null;
                                                    const currentValue =
                                                        item.tipo === 'Implementación'
                                                            ? (implementationOverride ?? item.precio_anual)
                                                            : item.tipo === 'Paquete'
                                                                ? (paqueteOverride ?? item.precio_anual)
                                                                : (itemOriginal && overrides[itemOriginal.id] !== undefined
                                                                    ? overrides[itemOriginal.id]
                                                                    : item.precio_anual);
                                                    return (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-xs text-gray-400 font-bold">$</span>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    className={`w-20 sm:w-28 text-right font-bold text-base border rounded px-2 py-1 focus:ring-2 outline-none ${item.tipo === 'Implementación'
                                                                        ? 'text-orange-600 border-orange-100 bg-orange-50/30 focus:ring-orange-400'
                                                                        : item.tipo === 'Paquete'
                                                                            ? 'text-blue-700 border-blue-200 bg-blue-50/30 focus:ring-blue-400'
                                                                            : 'text-purple-700 border-purple-200 bg-purple-50/30 focus:ring-purple-400'
                                                                        }`}
                                                                    value={currentValue}
                                                                    onChange={(e) => {
                                                                        const val = Number(e.target.value);
                                                                        if (item.tipo === 'Implementación') {
                                                                            setImplementationOverride(val);
                                                                        } else if (item.tipo === 'Paquete') {
                                                                            setPaqueteOverride(val);
                                                                        } else if (itemOriginal) {
                                                                            setOverrides({ ...overrides, [itemOriginal.id]: val });
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                            {/* Restore link — only for Implementación when price is 0 */}
                                                            {item.tipo === 'Implementación' && currentValue === 0 && (() => {
                                                                const origPrice = paquetes.find(p => p.id === formData.paquete_id)?.costo_implementacion || 0;
                                                                return origPrice > 0 ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setImplementationOverride(origPrice)}
                                                                        className="text-[10px] text-orange-500 hover:text-orange-700 font-bold flex items-center gap-0.5 transition-colors"
                                                                        title={`Restaurar precio original: $${origPrice.toFixed(2)}`}
                                                                    >
                                                                        <span>↺</span> Restaurar ${origPrice.toFixed(2)}
                                                                    </button>
                                                                ) : null;
                                                            })()}
                                                        </div>
                                                    );
                                                })() : (
                                                    <p className="font-black text-gray-800 text-lg">
                                                        ${(item.precio_anual).toLocaleString()}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>


                            {/* Forma de Pago - Selector Profesional de Períodos */}
                            <div className="mb-6">
                                <div className="flex items-center justify-between mb-4">
                                    <label className="text-sm font-bold text-gray-700">
                                        🎯 Forma de Pago
                                    </label>
                                    {!canChangePaymentMethod && (
                                        <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                                            🔒 Solo lectura
                                        </span>
                                    )}
                                </div>

                                {/* Opciones de Pago Dinámicas */}
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                    {financingPlans.length > 0 ? (
                                        financingPlans.map((plan) => {
                                            const isSelected = selectedPlanId === plan.id;
                                            const isAnual = plan.meses === 12 && plan.interes_porcentaje === 0 && plan.titulo.toLowerCase().includes('pago');

                                            return (
                                                <button
                                                    key={plan.id}
                                                    type="button"
                                                    onClick={() => {
                                                        if (canChangePaymentMethod) {
                                                            setSelectedPlanId(plan.id);
                                                            const isDiscountPlan = plan.tipo_ajuste === 'discount';

                                                            setFormData({
                                                                ...formData,
                                                                forma_pago: (isDiscountPlan || isAnual) ? 'anual' : 'mensual',
                                                                meses_pago: plan.meses,
                                                                // Reiniciamos descuento manual para evitar doble descuento accidental
                                                                descuento_porcentaje: 0
                                                            });
                                                        }
                                                    }}
                                                    disabled={!canChangePaymentMethod}
                                                    className={`relative p-4 rounded-xl border-2 transition-all group ${isSelected
                                                        ? isAnual
                                                            ? 'border-green-600 bg-gradient-to-br from-green-50 to-green-100 shadow-lg scale-[1.02]'
                                                            : 'border-blue-600 bg-gradient-to-br from-blue-50 to-blue-100 shadow-lg scale-[1.02]'
                                                        : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                                                        } ${!canChangePaymentMethod ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                                                >
                                                    <div className="text-center">
                                                        <div className="text-2xl mb-2">
                                                            {plan.meses === 12 && plan.interes_porcentaje === 0 ? '💰' :
                                                                plan.meses === 3 ? '📊' :
                                                                    plan.meses === 6 ? '📈' :
                                                                        plan.meses === 9 ? '📉' : '📅'}
                                                        </div>
                                                        <p className="font-bold text-gray-900 text-sm">{plan.titulo}</p>
                                                        {plan.descripcion && (
                                                            <p className="text-[10px] text-gray-500 mt-1 truncate">
                                                                {plan.meses === 1 && plan.interes_porcentaje > 0 ? 'Mensual' : plan.descripcion}
                                                            </p>
                                                        )}
                                                        <div className="mt-2 pt-2 border-t border-gray-200">
                                                            <p className={`text-xs font-bold ${plan.tipo_ajuste === 'discount' ? 'text-green-600' : plan.tipo_ajuste === 'recharge' ? 'text-blue-600' : 'text-gray-500'}`}>
                                                                {plan.tipo_ajuste === 'discount' ? `-${plan.interes_porcentaje}% OFF` :
                                                                    plan.tipo_ajuste === 'recharge' ? `+${plan.interes_porcentaje}% Interés` :
                                                                        'Precio Base'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {isSelected && (
                                                        <div className={`absolute -top-2 -right-2 w-6 h-6 ${isAnual ? 'bg-green-600' : 'bg-blue-600'} rounded-full flex items-center justify-center shadow-lg`}>
                                                            <span className="text-white text-xs">✓</span>
                                                        </div>
                                                    )}
                                                    {plan.es_popular && !isAnual && (
                                                        <div className="absolute -top-2 -left-2">
                                                            <span className="bg-yellow-400 text-yellow-900 text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm">
                                                                POPULAR
                                                            </span>
                                                        </div>
                                                    )}
                                                    {isAnual && (
                                                        <div className="absolute -top-2 -left-2">
                                                            <span className="bg-green-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm">
                                                                {paymentSettings?.nota_mejor_precio || 'MEJOR PRECIO'}
                                                            </span>
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })
                                    ) : (
                                        <div className="col-span-full py-4 text-center text-gray-400 text-xs italic">
                                            Cargando planes de financiamiento...
                                        </div>
                                    )}
                                </div>

                                {/* Información contextual Dinámica */}
                                <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100">
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                                            <span className="text-white text-sm">💡</span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-gray-900 mb-1">
                                                {financingPlans.find(p => p.id === selectedPlanId)?.titulo || 'Forma de Pago'}
                                            </p>
                                            <p className="text-xs text-gray-600">
                                                {financingPlans.find(p => p.id === selectedPlanId)?.descripcion || 'Seleccione una opción de pago.'}
                                            </p>
                                            {formData.forma_pago === 'mensual' && (totales?.ahorro_pago_anual || 0) > 0 && (
                                                <div className="mt-2 pt-2 border-t border-blue-200">
                                                    <p className="text-xs font-bold text-blue-700">
                                                        💰 Ahorrá ${(totales?.ahorro_pago_anual || 0).toFixed(2)} eligiendo pago anual
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>


                            {/* CONFIGURACIÓN AVANZADA REMOVIDA A PETICIÓN */}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Descuento */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Descuento (%)
                                    </label>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        value={formData.descuento_porcentaje || ''}
                                        onChange={(e) => setFormData({ ...formData, descuento_porcentaje: Number(e.target.value) })}
                                        placeholder="0"
                                    />
                                </div>

                                {/* IVA */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        IVA (%)
                                    </label>
                                    <div className="space-y-3">
                                        <Input
                                            type="number"
                                            step="0.1"
                                            value={formData.iva_porcentaje || ''}
                                            onChange={(e) => setFormData({ ...formData, iva_porcentaje: Number(e.target.value) })}
                                            placeholder="13"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setFormData({ ...formData, iva_porcentaje: 13 })}
                                                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${formData.iva_porcentaje === 13 ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                            >
                                                13% (Estandar)
                                            </button>
                                            <button
                                                onClick={() => setFormData({ ...formData, iva_porcentaje: 0 })}
                                                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${formData.iva_porcentaje === 0 ? 'bg-green-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                            >
                                                Exento (0%)
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Resumen de Inversión - Profesional y Compacto */}
                            {totales && (
                                <div className="mt-6">
                                    <h3 className="font-bold text-xl text-gray-900 mb-4">Resumen de Inversión</h3>

                                    <div className="space-y-3">

                                        {/* 1. PAGO INICIAL (ORANGE) */}
                                        {totales.total_pagos_unicos > 0 && (
                                            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 shadow-sm">
                                                <div className="flex justify-between items-center mb-3">
                                                    <div>
                                                        <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest leading-none">PAGO INICIAL</h4>
                                                        <p className="text-[9px] text-orange-400 font-bold mt-0.5">Requerido antes de activar</p>
                                                    </div>
                                                    <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600">
                                                        <Package className="w-4 h-4" />
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    {/* Listar cada ítem de pago único por separado */}
                                                    {totales.desglose
                                                        .filter(d => d.es_pago_unico)
                                                        .map((d, i) => (
                                                            <div key={i} className="flex justify-between text-[11px] text-gray-600 font-medium leading-none">
                                                                <span>{d.nombre}</span>
                                                                <span>${d.precio_anual.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                            </div>
                                                        ))
                                                    }
                                                    <div className="flex justify-between text-[11px] text-gray-500 font-medium leading-none pt-1 border-t border-orange-100">
                                                        <span>IVA ({formData.iva_porcentaje}%)</span>
                                                        <span className="text-orange-600">+${totales.iva_pagos_unicos.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                    <div className="pt-2 border-t border-orange-200 mt-2 flex justify-between items-end">
                                                        <span className="text-[10px] font-black text-gray-900 uppercase">Total inicial</span>
                                                        <span className="text-xl font-black text-orange-600 tracking-tighter leading-none">${totales.total_pagos_unicos.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* 2. PAGO RECURRENTE (BLUE/GREEN) */}
                                        <div className={`${formData.forma_pago === 'mensual' ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'} border rounded-2xl p-5 shadow-sm`}>
                                            <div className="flex justify-between items-center mb-3">
                                                <div>
                                                    <h4 className={`text-[10px] font-black ${formData.forma_pago === 'mensual' ? 'text-blue-600' : 'text-green-600'} uppercase tracking-widest leading-none`}>
                                                        {financingPlans.find(p => p.id === selectedPlanId)?.titulo?.toUpperCase() || 'FORMA DE PAGO'}
                                                    </h4>
                                                </div>
                                                <div className={`w-8 h-8 ${formData.forma_pago === 'mensual' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'} rounded-lg flex items-center justify-center`}>
                                                    <Globe className="w-4 h-4" />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between text-[11px] text-gray-500 font-medium leading-none">
                                                    <span>Base Recurrente</span>
                                                    <span>${(() => {
                                                        const selectedPlan = financingPlans.find(p => p.id === selectedPlanId);
                                                        const showBreakdown = selectedPlan?.show_breakdown ?? true;
                                                        return (showBreakdown
                                                            ? totales.subtotal_recurrente_base
                                                            : totales.subtotal_recurrente_base + (totales.recargo_mensual_monto || 0)
                                                        ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                                    })()}</span>
                                                </div>

                                                {(() => {
                                                    const selectedPlan = financingPlans.find(p => p.id === selectedPlanId);
                                                    const showBreakdown = selectedPlan?.show_breakdown ?? true;
                                                    return totales.recargo_mensual_monto > 0 && showBreakdown && (
                                                        <div className="flex justify-between text-[11px] text-blue-600 font-medium leading-none">
                                                            <span>+ Financiamiento ({totales.recargo_aplicado_porcentaje}%)</span>
                                                            <span className="font-bold">+${totales.recargo_mensual_monto.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                        </div>
                                                    );
                                                })()}

                                                {/* Mostrar descuento del plan si existe */}
                                                {financingPlans.find(p => p.id === selectedPlanId)?.tipo_ajuste === 'discount' && totales.ahorro_pago_anual > 0 && (
                                                    <div className="flex justify-between text-[11px] text-green-600 font-medium leading-none">
                                                        <span>- Descuento Pago Anticipado</span>
                                                        <span className="font-bold">-${totales.ahorro_pago_anual.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                )}

                                                {/* Descuento manual del agente */}
                                                {totales.descuento_manual_monto > 0 && (
                                                    <div className="flex justify-between text-[11px] text-emerald-600 font-medium leading-none">
                                                        <span>- Descuento ({formData.descuento_porcentaje}%)</span>
                                                        <span className="font-bold">-${totales.descuento_manual_monto.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                )}

                                                <div className="flex justify-between text-[11px] text-gray-500 font-medium leading-none">
                                                    <span>IVA ({formData.iva_porcentaje}%)</span>
                                                    <span className={formData.forma_pago === 'mensual' ? 'text-blue-600' : 'text-green-600'}>
                                                        +${totales.iva_monto_recurrente.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </div>

                                                <div className={`pt-2 border-t ${formData.forma_pago === 'mensual' ? 'border-blue-200' : 'border-green-200'} mt-2 space-y-2`}>
                                                    <div className="flex justify-between items-end">
                                                        <span className="text-[10px] font-black text-gray-900 uppercase">
                                                            {financingPlans.find(p => p.id === selectedPlanId)?.titulo || 'Total'}
                                                        </span>
                                                        <span className={`text-xl font-black ${formData.forma_pago === 'mensual' ? 'text-blue-600' : 'text-green-600'} tracking-tighter leading-none`}>
                                                            ${(totales.cuota_mensual).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>

                                                </div>
                                            </div>
                                        </div>

                                        {/* 3. INVERSIÓN TOTAL (PURPLE) */}
                                        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden group">
                                            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-all"></div>
                                            <div className="flex justify-between items-end relative z-10">
                                                <div>
                                                    <h4 className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">INVERSIÓN TOTAL</h4>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-2xl font-black tracking-tighter leading-none">${totales.total_general.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Nota de validez */}
                                        <div className="text-center mt-3">
                                            <p className="text-[10px] text-gray-500 italic">
                                                Todos los valores expresados en USD
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Elaborado por */}
                            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                                    {(profile?.full_name || profile?.email || 'A').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Propuesta Elaborada por</p>
                                    <p className="text-sm font-bold text-gray-900">{profile?.full_name || profile?.email || 'Agente Comercial'}</p>
                                </div>
                            </div>

                            {/* Notas removed */}
                        </div>
                    )}

                    {/* ── Navigation Buttons — Desktop ── */}
                    <div className="hidden sm:flex justify-between mt-8">
                        <Button
                            onClick={handleAnterior}
                            variant="outline"
                            disabled={pasoActual === 1}
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Anterior
                        </Button>

                        {pasoActual < 4 ? (
                            <Button onClick={handleSiguiente} className="bg-[#4449AA] hover:bg-[#3a3f95] text-white">
                                Siguiente
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        ) : (
                            <Button onClick={handleGenerar} className="bg-green-600 hover:bg-green-700 text-white">
                                <FileText className="w-4 h-4 mr-2" />
                                Generar Cotización
                            </Button>
                        )}
                    </div>
                </div>

                {/* ── Widget Flotante de Precio — Desktop / tablet ── */}
                {
                    pasoActual > 1 && totales && (
                        <>
                            {isWidgetOpen ? (
                                <div className="fixed top-24 right-6 bg-white border-2 border-green-500 rounded-xl shadow-2xl p-4 w-72 z-50">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="font-bold text-sm text-[#4449AA] flex items-center gap-2">
                                            <Receipt className="w-4 h-4" />
                                            Precio en Tiempo Real
                                        </h4>
                                        <button
                                            onClick={() => setIsWidgetOpen(false)}
                                            className="text-gray-400 hover:text-gray-600 transition-colors"
                                            title="Cerrar"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="space-y-1 text-sm">
                                        {(() => {
                                            const paqSel = paquetes.find(p => p.id === formData.paquete_id);
                                            const costoImp = paqSel?.costo_implementacion || 0;
                                            if (costoImp === 0) return null;
                                            return (
                                                <div className="flex justify-between items-center bg-amber-50 p-2 rounded-lg border border-amber-200 mb-2">
                                                    <div>
                                                        <span className="text-[10px] font-black uppercase text-amber-700 tracking-tighter block">Implementación</span>
                                                        <span className="text-[10px] text-amber-500">${costoImp.toFixed(2)}</span>
                                                    </div>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <span className={`text-[11px] font-bold ${formData.incluir_implementacion ? 'text-green-600' : 'text-gray-400'}`}>
                                                            {formData.incluir_implementacion ? 'SÍ' : 'NO'}
                                                        </span>
                                                        <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${formData.incluir_implementacion ? 'bg-green-500' : 'bg-gray-300'}`}>
                                                            <div className={`w-3 h-3 bg-white rounded-full transition-transform ${formData.incluir_implementacion ? 'translate-x-4' : 'translate-x-0'}`} />
                                                        </div>
                                                        <input
                                                            type="checkbox"
                                                            className="hidden"
                                                            checked={formData.incluir_implementacion}
                                                            onChange={(e) => {
                                                                const turningOn = e.target.checked;
                                                                // Auto-reset to original price if turning ON with price at 0
                                                                if (turningOn && implementationOverride === 0) {
                                                                    setImplementationOverride(costoImp);
                                                                }
                                                                setFormData({ ...formData, incluir_implementacion: turningOn });
                                                            }}
                                                        />
                                                    </label>
                                                </div>
                                            );
                                        })()}
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Subtotal:</span>
                                            <span className="font-semibold">${(totales.subtotal_pagos_unicos + totales.subtotal_recurrente_base).toLocaleString()}</span>
                                        </div>
                                        {totales.descuento_monto > 0 && (
                                            <div className="flex justify-between text-red-600">
                                                <span>Descuento:</span>
                                                <span>-${totales.descuento_monto.toLocaleString()}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center text-blue-600 bg-blue-50/50 p-1.5 rounded-lg border border-blue-100">
                                            <div className="flex items-center gap-1">
                                                <span className="text-[10px] font-black uppercase opacity-70">IVA:</span>
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="number"
                                                        className="w-10 bg-white border border-blue-200 rounded px-1 text-[11px] font-black focus:ring-1 focus:ring-blue-400 outline-none"
                                                        value={formData.iva_porcentaje}
                                                        onChange={(e) => setFormData({ ...formData, iva_porcentaje: Number(e.target.value) })}
                                                    />
                                                    <span className="text-[10px] font-bold">%</span>
                                                </div>
                                            </div>
                                            <span className="font-black text-xs">+${(totales.iva_pagos_unicos + totales.iva_monto_recurrente).toLocaleString()}</span>
                                        </div>
                                        <div className="border-t pt-2 mt-2">
                                            <div className="flex justify-between text-lg font-bold text-green-600">
                                                <span>Total General:</span>
                                                <span>${totales.total_general.toLocaleString()}</span>
                                            </div>
                                            {totales.cuotas > 1 ? (
                                                <p className="text-xs text-gray-500 text-right">
                                                    ${totales.cuota_mensual.toLocaleString()} / {totales.cuotas} cuotas
                                                </p>
                                            ) : (
                                                formData.forma_pago === 'mensual' && (
                                                    <p className="text-xs text-gray-500 text-right">
                                                        ${totales.cuota_mensual.toLocaleString()}/mes
                                                    </p>
                                                )
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsWidgetOpen(true)}
                                    className="fixed top-24 right-6 bg-green-500 hover:bg-green-600 text-white rounded-full p-3 shadow-2xl z-50 transition-all"
                                    title="Ver precios"
                                >
                                    <Receipt className="w-5 h-5" />
                                </button>
                            )}
                        </>
                    )
                }
            </div>
            {/* ── Mobile Sticky Action Bar ── */}
            <div className="sm:hidden fixed bottom-16 left-0 right-0 px-4 z-40">
                <div className="bg-white/80 backdrop-blur-xl border border-gray-200/60 rounded-2xl shadow-xl shadow-black/10 p-3 flex gap-3">
                    {/* Back button — hidden on step 1 */}
                    {pasoActual > 1 && (
                        <button
                            onClick={handleAnterior}
                            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-700 font-bold text-sm active:scale-95 transition-transform hover:border-gray-300"
                        >
                            <ArrowLeft className="w-4 h-4 flex-shrink-0" />
                            Atrás
                        </button>
                    )}

                    {/* Primary CTA */}
                    {pasoActual < 4 ? (
                        <button
                            onClick={handleSiguiente}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#4449AA] text-white font-bold text-sm shadow-md shadow-[#4449AA]/30 active:scale-95 transition-all"
                        >
                            Siguiente
                            <ArrowRight className="w-4 h-4 flex-shrink-0" />
                        </button>
                    ) : (
                        <button
                            onClick={handleGenerar}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 text-white font-bold text-sm shadow-md shadow-green-600/30 active:scale-95 transition-all"
                        >
                            <Receipt className="w-4 h-4 flex-shrink-0" />
                            Generar Cotización
                        </button>
                    )}
                </div>
            </div>

            {/* Modal Selector de Leads - Cobertura Total Garantizada (Fuera de contenedores padres para evitar stacking context issues) */}
            {
                showLeadSelector && (
                    <div
                        className="fixed inset-0 bg-black flex items-center justify-center p-4"
                        style={{
                            zIndex: 9999999,
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            width: '100vw',
                            height: '100vh',
                            backgroundColor: 'rgba(0, 0, 0, 0.7)',
                            backdropFilter: 'blur(4px)'
                        }}
                        onClick={() => { setShowLeadSelector(false); setSearchLead(''); }}
                    >
                        <div
                            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
                            style={{ position: 'relative', zIndex: 10000000 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex-shrink-0">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-xl font-extrabold text-white mb-1 truncate">Seleccionar Lead</h3>
                                        <p className="text-blue-100 text-sm truncate">Elija un Lead para auto-completar los datos</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setShowLeadSelector(false);
                                            setSearchLead('');
                                        }}
                                        className="flex-shrink-0 p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                                    >
                                        <X className="w-5 h-5 text-white" />
                                    </button>
                                </div>
                            </div>

                            {/* Search Bar */}
                            <div className="px-6 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar por nombre, empresa o email..."
                                        value={searchLead}
                                        onChange={(e) => setSearchLead(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400 text-sm transition-all"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* Lista de Leads - Scrollable con más altura */}
                            <div className="overflow-y-auto flex-1 px-6 py-3" style={{ maxHeight: 'calc(90vh - 220px)' }}>
                                {leads
                                    .filter(lead => {
                                        const search = searchLead.toLowerCase();
                                        return !search ||
                                            lead.name?.toLowerCase().includes(search) ||
                                            lead.email?.toLowerCase().includes(search) ||
                                            lead.company_name?.toLowerCase().includes(search);
                                    })
                                    .map((lead) => (
                                        <div
                                            key={lead.id}
                                            onClick={() => handleSeleccionarLead(lead)}
                                            className="group cursor-pointer border-2 border-gray-200 rounded-xl p-3 mb-2 hover:border-blue-500 hover:bg-blue-50 hover:shadow-md transition-all duration-200"
                                        >
                                            <div className="flex items-center gap-3">
                                                {/* Avatar */}
                                                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm">
                                                    {(lead.name || 'L')[0].toUpperCase()}
                                                </div>

                                                {/* Info - Flexible width with truncation */}
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                                                        {lead.name}
                                                    </h4>
                                                    {lead.company_name && (
                                                        <p className="text-sm text-gray-500 truncate">{lead.company_name}</p>
                                                    )}
                                                    {lead.email && (
                                                        <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                                                            <span className="text-gray-400 flex-shrink-0">✉</span>
                                                            <span className="truncate">{lead.email}</span>
                                                        </p>
                                                    )}
                                                    {lead.phone && (
                                                        <p className="text-sm text-gray-600 flex items-center gap-1">
                                                            <span className="text-gray-400 flex-shrink-0">📞</span>
                                                            <span className="truncate">{lead.phone}</span>
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Botón Seleccionar */}
                                                <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap">
                                                        Seleccionar
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                {leads.filter(lead => {
                                    const search = searchLead.toLowerCase();
                                    return !search ||
                                        lead.name?.toLowerCase().includes(search) ||
                                        lead.email?.toLowerCase().includes(search) ||
                                        lead.company_name?.toLowerCase().includes(search);
                                }).length === 0 && (
                                        <div className="text-center py-12">
                                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <Search className="w-8 h-8 text-gray-400" />
                                            </div>
                                            <p className="text-gray-500 font-medium">No se encontraron Leads</p>
                                            <p className="text-gray-400 text-sm mt-1">Intenta con otro término de búsqueda</p>
                                        </div>
                                    )}
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex-shrink-0">
                                <button
                                    onClick={() => {
                                        setShowLeadSelector(false);
                                        setSearchLead('');
                                    }}
                                    className="w-full bg-white border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    );
}
