import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, User, FileText, Package, DollarSign, Loader } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { cotizacionesService } from '../services/cotizaciones';
import { pricingService } from '../services/pricing';
import { leadsService } from '../services/leads';
import type { ModuloAdicional } from '../types/cotizaciones';
import type { PricingItem } from '../types/pricing';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import toast from 'react-hot-toast';

const PASOS = [
    { id: 1, nombre: 'Cliente', icon: User },
    { id: 2, nombre: 'Plan', icon: FileText },
    { id: 3, nombre: 'Módulos', icon: Package },
    { id: 4, nombre: 'Resumen', icon: DollarSign }
];

export default function NuevaCotizacionDinamica() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const leadIdParam = searchParams.get('leadId');

    const [pasoActual, setPasoActual] = useState(1);
    const [loading, setLoading] = useState(false);
    const [loadingPricing, setLoadingPricing] = useState(true);
    const [leads, setLeads] = useState<any[]>([]);

    // DATOS DINÁMICOS DESDE BD
    const [planesDisponibles, setPlanesDisponibles] = useState<PricingItem[]>([]);
    const [modulosDisponibles, setModulosDisponibles] = useState<PricingItem[]>([]);
    const [serviciosDisponibles, setServiciosDisponibles] = useState<PricingItem[]>([]);
    const [planSeleccionado, setPlanSeleccionado] = useState<PricingItem | null>(null);

    // Form Data
    const [formData, setFormData] = useState({
        lead_id: leadIdParam || '',
        nombre_cliente: '',
        empresa_cliente: '',
        email_cliente: '',
        telefono_cliente: '',
        direccion_cliente: '',
        volumen_dtes: 0,
        plan_id: '',
        modulos_ids: [] as string[],
        servicios_ids: [] as string[],
        descuento_porcentaje: 0,
        incluir_implementacion: true,
        notas: ''
    });

    const [totales, setTotales] = useState({
        subtotal_anual: 0,
        subtotal_mensual: 0,
        descuento_monto: 0,
        total_anual: 0,
        total_mensual: 0,
        desglose: [] as any[]
    });

    // CARGAR DATOS DINÁMICOS AL INICIO
    useEffect(() => {
        loadLeads();
        loadPricingData();
    }, []);

    const loadPricingData = async () => {
        try {
            setLoadingPricing(true);
            const config = await pricingService.getPricingConfig();
            setPlanesDisponibles(config.planes);
            setModulosDisponibles(config.modulos);
            setServiciosDisponibles(config.servicios);
        } catch (error) {
            console.error('Error loading pricing:', error);
            toast.error('Error al cargar configuración de precios');
        } finally {
            setLoadingPricing(false);
        }
    };

    const loadLeads = async () => {
        try {
            const { data } = await leadsService.getLeads();
            setLeads(data || []);
        } catch (error) {
            console.error('Error loading leads:', error);
        }
    };

    // AUTO-CARGAR DATOS DEL LEAD
    useEffect(() => {
        if (leadIdParam && leads.length > 0) {
            const lead = leads.find(l => l.id === leadIdParam);
            if (lead) {
                setFormData(prev => ({
                    ...prev,
                    lead_id: lead.id,
                    nombre_cliente: lead.name,
                    empresa_cliente: lead.company_name || '',
                    email_cliente: lead.email || '',
                    telefono_cliente: lead.phone || '',
                    direccion_cliente: lead.address || lead.address_line1 || ''
                }));
            }
        }
    }, [leadIdParam, leads]);

    // SUGERENCIA AUTOMÁTICA DE PLAN SEGÚN DTEs
    useEffect(() => {
        if (formData.volumen_dtes > 0 && planesDisponibles.length > 0) {
            const planSugerido = planesDisponibles.find(
                p => formData.volumen_dtes >= (p.min_dtes || 0) &&
                    formData.volumen_dtes <= (p.max_dtes || 999999)
            );

            if (planSugerido && formData.plan_id !== planSugerido.id) {
                setFormData(prev => ({ ...prev, plan_id: planSugerido.id }));
                setPlanSeleccionado(planSugerido);
            }
        }
    }, [formData.volumen_dtes, planesDisponibles]);

    // RECALCULAR TOTALES EN TIEMPO REAL
    useEffect(() => {
        calcularTotales();
    }, [
        planSeleccionado,
        formData.modulos_ids,
        formData.servicios_ids,
        formData.volumen_dtes,
        formData.descuento_porcentaje
    ]);

    const calcularTotales = () => {
        let subtotal_anual = 0;
        let subtotal_mensual = 0;
        const desglose: any[] = [];

        // 1. PLAN BASE (usando fórmula dinámica)
        if (planSeleccionado) {
            const calculoPlan = pricingService.calcularPrecioItem(
                planSeleccionado,
                formData.volumen_dtes,
                1,
                'anual'
            );

            subtotal_anual += calculoPlan.precio_calculado;
            subtotal_mensual += calculoPlan.precio_calculado;

            desglose.push({
                tipo: 'Plan',
                nombre: planSeleccionado.nombre,
                precio_anual: calculoPlan.precio_calculado,
                precio_mensual: planSeleccionado.precio_mensual,
                descripcion: calculoPlan.descripcion_calculo
            });
        }

        // 2. MÓDULOS SELECCIONADOS (usando fórmula dinámica)
        formData.modulos_ids.forEach(moduloId => {
            const modulo = modulosDisponibles.find(m => m.id === moduloId);
            if (modulo) {
                const calculoModulo = pricingService.calcularPrecioItem(
                    modulo,
                    formData.volumen_dtes,
                    1,
                    'anual'
                );

                subtotal_anual += calculoModulo.precio_calculado;
                subtotal_mensual += calculoModulo.precio_calculado;

                desglose.push({
                    tipo: 'Módulo',
                    nombre: modulo.nombre,
                    precio_anual: calculoModulo.precio_calculado,
                    precio_mensual: modulo.precio_mensual,
                    descripcion: calculoModulo.descripcion_calculo
                });
            }
        });

        // 3. SERVICIOS SELECCIONADOS (usando fórmula dinámica)
        formData.servicios_ids.forEach(servicioId => {
            const servicio = serviciosDisponibles.find(s => s.id === servicioId);
            if (servicio) {
                const calculoServicio = pricingService.calcularPrecioItem(
                    servicio,
                    formData.volumen_dtes,
                    1,
                    'anual'
                );

                subtotal_anual += calculoServicio.precio_calculado;
                subtotal_mensual += calculoServicio.precio_calculado;

                desglose.push({
                    tipo: 'Servicio',
                    nombre: servicio.nombre,
                    precio_anual: calculoServicio.precio_calculado,
                    precio_mensual: servicio.precio_mensual,
                    calculo: calculoServicio.descripcion_calculo
                });
            }
        });

        // 4. APLICAR DESCUENTO
        const descuento_monto = (subtotal_anual * formData.descuento_porcentaje) / 100;
        const total_anual = subtotal_anual - descuento_monto;
        const total_mensual = subtotal_mensual - descuento_monto;

        setTotales({
            subtotal_anual: Number(subtotal_anual.toFixed(2)),
            subtotal_mensual: Number(subtotal_mensual.toFixed(2)),
            descuento_monto: Number(descuento_monto.toFixed(2)),
            total_anual: Number(total_anual.toFixed(2)),
            total_mensual: Number(total_mensual.toFixed(2)),
            desglose
        });
    };

    const handleLeadChange = (leadId: string) => {
        const lead = leads.find(l => l.id === leadId);
        if (lead) {
            setFormData(prev => ({
                ...prev,
                lead_id: lead.id,
                nombre_cliente: lead.name,
                empresa_cliente: lead.company_name || '',
                email_cliente: lead.email || '',
                telefono_cliente: lead.phone || '',
                direccion_cliente: lead.address || lead.address_line1 || ''
            }));
        }
    };

    const handlePlanChange = (planId: string) => {
        const plan = planesDisponibles.find(p => p.id === planId);
        if (plan) {
            setFormData(prev => ({ ...prev, plan_id: planId }));
            setPlanSeleccionado(plan);
        }
    };

    const toggleModulo = (moduloId: string) => {
        setFormData(prev => {
            const existe = prev.modulos_ids.includes(moduloId);
            if (existe) {
                return {
                    ...prev,
                    modulos_ids: prev.modulos_ids.filter(id => id !== moduloId)
                };
            } else {
                return {
                    ...prev,
                    modulos_ids: [...prev.modulos_ids, moduloId]
                };
            }
        });
    };

    const toggleServicio = (servicioId: string) => {
        setFormData(prev => {
            const existe = prev.servicios_ids.includes(servicioId);
            if (existe) {
                return {
                    ...prev,
                    servicios_ids: prev.servicios_ids.filter(id => id !== servicioId)
                };
            } else {
                return {
                    ...prev,
                    servicios_ids: [...prev.servicios_ids, servicioId]
                };
            }
        });
    };

    const handleSubmit = async () => {
        try {
            setLoading(true);

            // Preparar datos para guardar
            const modulos_adicionales: ModuloAdicional[] = formData.modulos_ids.map(id => {
                const modulo = modulosDisponibles.find(m => m.id === id);
                return {
                    nombre: modulo!.nombre,
                    descripcion: modulo!.descripcion,
                    costo_anual: modulo!.precio_anual,
                    costo_mensual: modulo!.precio_mensual
                };
            });

            const cotizacionData = {
                company_id: profile!.company_id,
                lead_id: formData.lead_id || null,
                nombre_cliente: formData.nombre_cliente,
                empresa_cliente: formData.empresa_cliente,
                email_cliente: formData.email_cliente,
                telefono_cliente: formData.telefono_cliente,
                direccion_cliente: formData.direccion_cliente,
                volumen_dtes: formData.volumen_dtes,
                plan_nombre: planSeleccionado!.nombre,
                costo_plan_anual: planSeleccionado!.precio_anual,
                costo_plan_mensual: planSeleccionado!.precio_mensual,
                costo_implementacion: planSeleccionado!.costo_unico,
                modulos_adicionales,
                servicio_whatsapp: formData.servicios_ids.some(id =>
                    serviciosDisponibles.find(s => s.id === id)?.codigo === 'SRV_WHATSAPP'
                ),
                costo_whatsapp: totales.desglose.find(d => d.nombre.includes('WhatsApp'))?.precio_anual || 0,
                servicio_personalizacion: formData.servicios_ids.some(id =>
                    serviciosDisponibles.find(s => s.id === id)?.codigo === 'SRV_TICKETS'
                ),
                costo_personalizacion: totales.desglose.find(d => d.nombre.includes('Personalización'))?.costo_unico || 0,
                subtotal_anual: totales.subtotal_anual,
                subtotal_mensual: totales.subtotal_mensual,
                descuento_porcentaje: formData.descuento_porcentaje,
                descuento_monto: totales.descuento_monto,
                total_anual: totales.total_anual,
                total_mensual: totales.total_mensual,
                iva_porcentaje: 13,
                iva_monto: Number((totales.total_anual - (totales.total_anual / 1.13)).toFixed(2)),
                estado: 'borrador' as const,
                valida_hasta: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                incluir_implementacion: formData.incluir_implementacion,
                notas: formData.notas
            };

            await cotizacionesService.createCotizacion(cotizacionData);

            // Actualizar lead si existe a estado Negociación
            if (formData.lead_id) {
                await leadsService.updateLead(formData.lead_id, {
                    status: 'Negociación'
                });
            }

            toast.success('✅ Cotización creada exitosamente');
            navigate('/cotizaciones');
        } catch (error: any) {
            console.error('Error creating cotizacion:', error);
            toast.error('Error al crear cotización');
        } finally {
            setLoading(false);
        }
    };

    const validarPaso = () => {
        switch (pasoActual) {
            case 1:
                return formData.nombre_cliente.trim() !== '' && formData.volumen_dtes > 0;
            case 2:
                return formData.plan_id !== '';
            case 3:
                return true;
            case 4:
                return true;
            default:
                return false;
        }
    };

    // RENDERIZADO DINÁMICO DE PASOS
    const renderPaso1 = () => (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-[#4449AA]">📋 Información del Cliente</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                        Seleccionar Lead (Opcional)
                    </label>
                    <select
                        value={formData.lead_id}
                        onChange={(e) => handleLeadChange(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="">Nuevo cliente (manual)</option>
                        {leads.map(lead => (
                            <option key={lead.id} value={lead.id}>
                                {lead.name} {lead.company_name ? `- ${lead.company_name}` : ''}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                        Nombre del Cliente *
                    </label>
                    <Input
                        value={formData.nombre_cliente}
                        onChange={(e) => setFormData({ ...formData, nombre_cliente: e.target.value })}
                        placeholder="Juan Pérez"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                        Empresa
                    </label>
                    <Input
                        value={formData.empresa_cliente}
                        onChange={(e) => setFormData({ ...formData, empresa_cliente: e.target.value })}
                        placeholder="Empresa S.A. de C.V."
                    />
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                        Email
                    </label>
                    <Input
                        type="email"
                        value={formData.email_cliente}
                        onChange={(e) => setFormData({ ...formData, email_cliente: e.target.value })}
                        placeholder="juan@empresa.com"
                    />
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                        Teléfono
                    </label>
                    <Input
                        type="tel"
                        value={formData.telefono_cliente}
                        onChange={(e) => setFormData({ ...formData, telefono_cliente: e.target.value })}
                        placeholder="7000-0000"
                    />
                </div>

                <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                        🗺️ Dirección
                    </label>
                    <Input
                        value={formData.direccion_cliente}
                        onChange={(e) => setFormData({ ...formData, direccion_cliente: e.target.value })}
                        placeholder="Calle Principal #123, Colonia Las Flores"
                    />
                </div>

                <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                        📊 Volumen Estimado de DTEs al Año *
                    </label>
                    <Input
                        type="number"
                        value={formData.volumen_dtes || ''}
                        onChange={(e) => setFormData({ ...formData, volumen_dtes: Number(e.target.value) })}
                        placeholder="Ej: 3000"
                        required
                        min="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Este dato determina el plan recomendado automáticamente
                    </p>
                </div>
            </div>
        </div >
    );

    const renderPaso2 = () => {
        if (loadingPricing) {
            return (
                <div className="flex items-center justify-center py-12">
                    <Loader className="w-8 h-8 animate-spin text-blue-600" />
                    <span className="ml-3 text-gray-600">Cargando planes...</span>
                </div>
            );
        }

        return (
            <div className="space-y-6">
                <h2 className="text-xl font-bold text-[#4449AA]">🛡️ Selección de Plan</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {planesDisponibles.map(plan => {
                        const esRecomendado = formData.volumen_dtes >= (plan.min_dtes || 0) &&
                            formData.volumen_dtes <= (plan.max_dtes || 999999);
                        const seleccionado = formData.plan_id === plan.id;

                        const caracteristicas = plan.metadata?.caracteristicas || [];

                        return (
                            <div
                                key={plan.id}
                                onClick={() => handlePlanChange(plan.id)}
                                className={`relative cursor-pointer border-2 rounded-xl p-6 transition-all ${seleccionado
                                    ? 'border-blue-500 bg-blue-50 shadow-lg'
                                    : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                                    }`}
                            >
                                {esRecomendado && (
                                    <div className="absolute -top-3 right-4 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                                        ⭐ Recomendado
                                    </div>
                                )}

                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-[#4449AA]">{plan.nombre}</h3>
                                    {seleccionado && <Check className="w-6 h-6 text-blue-600" />}
                                </div>

                                <div className="space-y-2 mb-4">
                                    <p className="text-sm text-gray-600">
                                        {(plan.min_dtes || 0).toLocaleString()} - {(plan.max_dtes || 0) === 999999 ? '∞' : (plan.max_dtes || 0).toLocaleString()} DTEs/año
                                    </p>
                                    <p className="text-2xl font-bold text-[#3DCC91]">
                                        ${plan.precio_anual.toLocaleString()}/año
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        o ${plan.precio_mensual.toLocaleString()}/mes
                                    </p>
                                </div>

                                {caracteristicas.length > 0 && (
                                    <ul className="space-y-1 text-xs text-gray-600">
                                        {caracteristicas.map((car: string, idx: number) => (
                                            <li key={idx} className="flex items-start gap-2">
                                                <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                                <span>{car}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                <p className="text-xs text-gray-500 mt-4">
                                    Implementación: ${plan.costo_unico}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderPaso3 = () => {
        if (loadingPricing) {
            return (
                <div className="flex items-center justify-center py-12">
                    <Loader className="w-8 h-8 animate-spin text-blue-600" />
                </div>
            );
        }

        return (
            <div className="space-y-6">
                <h2 className="text-xl font-bold text-[#4449AA]">📦 Módulos y Servicios Adicionales</h2>

                {/* MÓDULOS */}
                {modulosDisponibles.length > 0 && (
                    <div>
                        <h3 className="text-md font-bold text-gray-700 mb-3">Módulos Disponibles</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {modulosDisponibles.map(modulo => {
                                const seleccionado = formData.modulos_ids.includes(modulo.id);

                                return (
                                    <div
                                        key={modulo.id}
                                        onClick={() => toggleModulo(modulo.id)}
                                        className={`cursor-pointer border-2 rounded-xl p-4 transition-all ${seleccionado
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 hover:border-blue-300'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-bold text-[#4449AA]">{modulo.nombre}</h4>
                                            {seleccionado && <Check className="w-5 h-5 text-blue-600" />}
                                        </div>
                                        <p className="text-xs text-gray-600 mb-2">{modulo.descripcion}</p>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">${modulo.precio_anual}/año</span>
                                            <span className="text-gray-500">${modulo.precio_mensual}/mes</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* SERVICIOS */}
                {serviciosDisponibles.length > 0 && (
                    <div>
                        <h3 className="text-md font-bold text-gray-700 mb-3">Servicios Adicionales</h3>

                        <div className="space-y-3">
                            {serviciosDisponibles.map(servicio => {
                                const seleccionado = formData.servicios_ids.includes(servicio.id);

                                let precioTexto = '';
                                if (servicio.precio_por_dte > 0) {
                                    const costo = formData.volumen_dtes * servicio.precio_por_dte;
                                    precioTexto = `$${costo.toFixed(2)} (${servicio.precio_por_dte} × ${formData.volumen_dtes} DTEs)`;
                                } else if (servicio.costo_unico > 0) {
                                    precioTexto = `$${servicio.costo_unico} (Costo único)`;
                                } else {
                                    precioTexto = `$${servicio.precio_anual}/año o $${servicio.precio_mensual}/mes`;
                                }

                                return (
                                    <label
                                        key={servicio.id}
                                        className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl hover:border-blue-300 cursor-pointer transition-all"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={seleccionado}
                                            onChange={() => toggleServicio(servicio.id)}
                                            className="w-5 h-5 text-blue-600 rounded"
                                        />
                                        <div className="flex-1">
                                            <p className="font-bold text-[#4449AA]">{servicio.nombre}</p>
                                            <p className="text-xs text-gray-600">{servicio.descripcion}</p>
                                            <p className="text-sm text-gray-500 mt-1">{precioTexto}</p>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* DESCUENTO */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                        💰 Descuento (%)
                    </label>
                    <Input
                        type="number"
                        value={formData.descuento_porcentaje || ''}
                        onChange={(e) => setFormData({ ...formData, descuento_porcentaje: Number(e.target.value) })}
                        placeholder="0"
                        min="0"
                        max="100"
                    />
                </div>
            </div>
        );
    };

    const renderPaso4 = () => (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-[#4449AA]">✅ Resumen de Cotización</h2>

            {/* Cliente */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="font-bold text-gray-700 mb-3">Cliente</h3>
                <div className="space-y-1 text-sm">
                    <p><span className="font-semibold">Nombre:</span> {formData.nombre_cliente}</p>
                    {formData.empresa_cliente && <p><span className="font-semibold">Empresa:</span> {formData.empresa_cliente}</p>}
                    {formData.email_cliente && <p><span className="font-semibold">Email:</span> {formData.email_cliente}</p>}
                    {formData.telefono_cliente && <p><span className="font-semibold">Teléfono:</span> {formData.telefono_cliente}</p>}
                    {formData.direccion_cliente && <p><span className="font-semibold">Dirección:</span> {formData.direccion_cliente}</p>}
                    <p><span className="font-semibold">Volumen DTEs:</span> {formData.volumen_dtes.toLocaleString()}/año</p>
                </div>
            </div>

            {/* Desglose Dinámico */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="font-bold text-gray-700 mb-3">Desglose de Costos</h3>
                <div className="space-y-3">
                    {totales.desglose.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start border-b border-gray-100 pb-2">
                            <div>
                                <p className="font-semibold text-gray-700">{item.nombre}</p>
                                <p className="text-xs text-gray-500">{item.tipo}</p>
                                {item.calculo && <p className="text-xs text-blue-600">{item.calculo}</p>}
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-[#3DCC91]">${item.precio_anual.toLocaleString()}/año</p>
                                {item.implementacion && (
                                    <p className="text-xs text-gray-500">+ ${item.implementacion} implementación</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Totales */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6">
                <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal Anual</span>
                        <span className="font-semibold">${totales.subtotal_anual.toLocaleString()}</span>
                    </div>

                    {formData.descuento_porcentaje > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                            <span>Descuento ({formData.descuento_porcentaje}%)</span>
                            <span className="font-semibold">-${totales.descuento_monto.toLocaleString()}</span>
                        </div>
                    )}

                    <div className="border-t-2 border-blue-200 pt-3">
                        <div className="flex justify-between items-center">
                            <span className="text-lg font-bold text-[#4449AA]">Total Anual</span>
                            <span className="text-3xl font-extrabold text-[#3DCC91]">${totales.total_anual.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                            <span className="text-sm text-gray-600">Total Mensual (12 cuotas)</span>
                            <span className="text-xl font-bold text-gray-700">${(totales.total_mensual / 12).toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Notas */}
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                    📝 Notas Internas (Opcional)
                </label>
                <textarea
                    value={formData.notas}
                    onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="Observaciones, condiciones especiales, etc."
                />
            </div>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/cotizaciones')}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-extrabold text-[#4449AA]">Nueva Cotización Dinámica</h1>
                    <p className="text-sm text-gray-500">Precios cargados automáticamente desde configuración</p>
                </div>
            </div>

            {/* Stepper */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between">
                    {PASOS.map((paso, index) => {
                        const Icon = paso.icon;
                        const esActual = pasoActual === paso.id;
                        const esCompletado = pasoActual > paso.id;

                        return (
                            <div key={paso.id} className="flex items-center flex-1">
                                <div className="flex flex-col items-center flex-1">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${esActual
                                        ? 'bg-blue-500 text-white shadow-lg'
                                        : esCompletado
                                            ? 'bg-green-500 text-white'
                                            : 'bg-gray-200 text-gray-500'
                                        }`}>
                                        {esCompletado ? <Check className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                                    </div>
                                    <p className={`text-xs font-bold mt-2 ${esActual ? 'text-blue-600' : 'text-gray-500'}`}>
                                        {paso.nombre}
                                    </p>
                                </div>
                                {index < PASOS.length - 1 && (
                                    <div className={`h-1 flex-1 transition-all ${esCompletado ? 'bg-green-500' : 'bg-gray-200'}`} />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Contenido del Paso */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                {pasoActual === 1 && renderPaso1()}
                {pasoActual === 2 && renderPaso2()}
                {pasoActual === 3 && renderPaso3()}
                {pasoActual === 4 && renderPaso4()}
            </div>

            {/* Botones de Navegación */}
            <div className="flex justify-between">
                <Button
                    onClick={() => setPasoActual(Math.max(1, pasoActual - 1))}
                    disabled={pasoActual === 1}
                    variant="outline"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Anterior
                </Button>

                {pasoActual < 4 ? (
                    <Button
                        onClick={() => setPasoActual(pasoActual + 1)}
                        disabled={!validarPaso()}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        Siguiente
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                ) : (
                    <Button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="bg-green-600 hover:bg-green-700 text-white"
                    >
                        {loading ? 'Guardando...' : 'Crear Cotización'}
                        <Check className="w-4 h-4 ml-2" />
                    </Button>
                )}
            </div>

            {/* Preview en Tiempo Real */}
            {pasoActual > 1 && (
                <div className="fixed top-24 right-6 bg-white border-2 border-blue-500 rounded-xl shadow-2xl p-4 w-80 z-50">
                    <h4 className="font-bold text-sm text-[#4449AA] mb-2">💰 Precio en Tiempo Real</h4>
                    <div className="space-y-1 text-xs">
                        {planSeleccionado && (
                            <p className="text-gray-600">Plan: <span className="font-semibold">{planSeleccionado.nombre}</span></p>
                        )}
                        {formData.modulos_ids.length > 0 && (
                            <p className="text-gray-600">Módulos: <span className="font-semibold">{formData.modulos_ids.length}</span></p>
                        )}
                        <div className="border-t pt-2 mt-2">
                            <p className="text-lg font-bold text-[#3DCC91]">
                                ${totales.total_anual.toLocaleString()}/año
                            </p>
                            <p className="text-xs text-gray-500">
                                ${(totales.total_mensual / 12).toFixed(2)}/mes
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
