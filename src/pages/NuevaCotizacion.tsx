import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, User, FileText, Package, DollarSign } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { cotizacionesService } from '../services/cotizaciones';
import { leadsService } from '../services/leads';
import { PLANES_FACTURACION, MODULOS_DISPONIBLES, type ModuloAdicional } from '../types/cotizaciones';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import toast from 'react-hot-toast';

const PASOS = [
    { id: 1, nombre: 'Cliente', icon: User },
    { id: 2, nombre: 'Plan', icon: FileText },
    { id: 3, nombre: 'Módulos', icon: Package },
    { id: 4, nombre: 'Resumen', icon: DollarSign }
];

export default function NuevaCotizacion() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const leadIdParam = searchParams.get('leadId');

    const [pasoActual, setPasoActual] = useState(1);
    const [loading, setLoading] = useState(false);
    const [leads, setLeads] = useState<any[]>([]);

    // Form Data
    const [formData, setFormData] = useState({
        lead_id: leadIdParam || '',
        nombre_cliente: '',
        empresa_cliente: '',
        email_cliente: '',
        telefono_cliente: '',
        volumen_dtes: 0,
        plan_nombre: '',
        costo_plan_anual: 0,
        costo_plan_mensual: 0,
        costo_implementacion: 0,
        modulos_adicionales: [] as ModuloAdicional[],
        servicio_whatsapp: false,
        servicio_personalizacion: false,
        descuento_porcentaje: 0,
        notas: ''
    });

    const [totales, setTotales] = useState({
        subtotal_anual: 0,
        subtotal_mensual: 0,
        descuento_monto: 0,
        iva_monto: 0,
        total_anual: 0,
        total_mensual: 0,
        costo_whatsapp: 0,
        costo_personalizacion: 0,
        iva_porcentaje: 13
    });

    useEffect(() => {
        loadLeads();
    }, []);

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
                    telefono_cliente: lead.phone || ''
                }));
            }
        }
    }, [leadIdParam, leads]);

    useEffect(() => {
        if (formData.volumen_dtes > 0 && !formData.plan_nombre) {
            const planSugerido = PLANES_FACTURACION.find(
                p => formData.volumen_dtes >= p.min_dtes && formData.volumen_dtes <= p.max_dtes
            );
            if (planSugerido) {
                setFormData(prev => ({
                    ...prev,
                    plan_nombre: planSugerido.nombre,
                    costo_plan_anual: planSugerido.costo_anual,
                    costo_plan_mensual: planSugerido.costo_mensual,
                    costo_implementacion: planSugerido.implementacion
                }));
            }
        }
    }, [formData.volumen_dtes]);

    useEffect(() => {
        calcularTotales();
    }, [
        formData.volumen_dtes,
        formData.costo_plan_anual,
        formData.costo_plan_mensual,
        formData.costo_implementacion,
        formData.modulos_adicionales,
        formData.servicio_whatsapp,
        formData.servicio_personalizacion,
        formData.descuento_porcentaje
    ]);

    const loadLeads = async () => {
        try {
            const { data } = await leadsService.getLeads();
            setLeads(data || []);
        } catch (error) {
            console.error('Error loading leads:', error);
        }
    };

    const calcularTotales = () => {
        const result = cotizacionesService.calcularTotales({
            volumen_dtes: formData.volumen_dtes,
            plan_nombre: formData.plan_nombre,
            costo_plan_anual: formData.costo_plan_anual,
            costo_plan_mensual: formData.costo_plan_mensual,
            costo_implementacion: formData.costo_implementacion,
            modulos_adicionales: formData.modulos_adicionales,
            servicio_whatsapp: formData.servicio_whatsapp,
            servicio_personalizacion: formData.servicio_personalizacion,
            descuento_porcentaje: formData.descuento_porcentaje
        });
        setTotales(result);
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
                telefono_cliente: lead.phone || ''
            }));
        }
    };

    const handlePlanChange = (planNombre: string) => {
        const plan = PLANES_FACTURACION.find(p => p.nombre === planNombre);
        if (plan) {
            setFormData(prev => ({
                ...prev,
                plan_nombre: plan.nombre,
                costo_plan_anual: plan.costo_anual,
                costo_plan_mensual: plan.costo_mensual,
                costo_implementacion: plan.implementacion
            }));
        }
    };

    const toggleModulo = (modulo: ModuloAdicional) => {
        setFormData(prev => {
            const existe = prev.modulos_adicionales.find(m => m.nombre === modulo.nombre);
            if (existe) {
                return {
                    ...prev,
                    modulos_adicionales: prev.modulos_adicionales.filter(m => m.nombre !== modulo.nombre)
                };
            } else {
                return {
                    ...prev,
                    modulos_adicionales: [...prev.modulos_adicionales, modulo]
                };
            }
        });
    };

    const handleSubmit = async () => {
        try {
            setLoading(true);

            await cotizacionesService.createCotizacion({
                company_id: profile!.company_id,
                ...formData,
                ...totales,
                estado: 'borrador',
                valida_hasta: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            });

            // Si hay lead asociado, actualizar su estado
            if (formData.lead_id) {
                await leadsService.updateLead(formData.lead_id, {
                    status: 'Cotización enviada'
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
                return formData.plan_nombre !== '';
            case 3:
                return true; // Módulos son opcionales
            case 4:
                return true;
            default:
                return false;
        }
    };

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
        </div>
    );

    const renderPaso2 = () => (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-[#4449AA]">🛡️ Selección de Plan</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PLANES_FACTURACION.map(plan => {
                    const esRecomendado = formData.volumen_dtes >= plan.min_dtes &&
                        formData.volumen_dtes <= plan.max_dtes;
                    const seleccionado = formData.plan_nombre === plan.nombre;

                    return (
                        <div
                            key={plan.nombre}
                            onClick={() => handlePlanChange(plan.nombre)}
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
                                    {plan.min_dtes.toLocaleString()} - {plan.max_dtes === 999999 ? '∞' : plan.max_dtes.toLocaleString()} DTEs/año
                                </p>
                                <p className="text-2xl font-bold text-[#3DCC91]">
                                    ${plan.costo_anual.toLocaleString()}/año
                                </p>
                                <p className="text-sm text-gray-500">
                                    o ${plan.costo_mensual.toLocaleString()}/mes
                                </p>
                            </div>

                            <ul className="space-y-1 text-xs text-gray-600">
                                {plan.caracteristicas.map((car, idx) => (
                                    <li key={idx} className="flex items-start gap-2">
                                        <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                        <span>{car}</span>
                                    </li>
                                ))}
                            </ul>

                            <p className="text-xs text-gray-500 mt-4">
                                Implementación: ${plan.implementacion}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const renderPaso3 = () => (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-[#4449AA]">📦 Módulos y Servicios Adicionales</h2>

            <div>
                <h3 className="text-md font-bold text-gray-700 mb-3">Módulos Disponibles</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {MODULOS_DISPONIBLES.map(modulo => {
                        const seleccionado = formData.modulos_adicionales.some(m => m.nombre === modulo.nombre);

                        return (
                            <div
                                key={modulo.nombre}
                                onClick={() => toggleModulo(modulo)}
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
                                    <span className="text-gray-500">${modulo.costo_anual}/año</span>
                                    <span className="text-gray-500">${modulo.costo_mensual}/mes</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div>
                <h3 className="text-md font-bold text-gray-700 mb-3">Servicios Adicionales</h3>

                <div className="space-y-3">
                    <label className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl hover:border-blue-300 cursor-pointer transition-all">
                        <input
                            type="checkbox"
                            checked={formData.servicio_whatsapp}
                            onChange={(e) => setFormData({ ...formData, servicio_whatsapp: e.target.checked })}
                            className="w-5 h-5 text-blue-600 rounded"
                        />
                        <div className="flex-1">
                            <p className="font-bold text-[#4449AA]">💬 Notificaciones WhatsApp</p>
                            <p className="text-xs text-gray-600">Envío automático de DTE por WhatsApp</p>
                            <p className="text-sm text-gray-500 mt-1">
                                ${(formData.volumen_dtes * 0.025).toFixed(2)} (0.025 x {formData.volumen_dtes} DTEs)
                            </p>
                        </div>
                    </label>

                    <label className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl hover:border-blue-300 cursor-pointer transition-all">
                        <input
                            type="checkbox"
                            checked={formData.servicio_personalizacion}
                            onChange={(e) => setFormData({ ...formData, servicio_personalizacion: e.target.checked })}
                            className="w-5 h-5 text-blue-600 rounded"
                        />
                        <div className="flex-1">
                            <p className="font-bold text-[#4449AA]">🎨 Personalización de Marca</p>
                            <p className="text-xs text-gray-600">Logo y colores personalizados en documentos</p>
                            <p className="text-sm text-gray-500 mt-1">$150 (Costo único)</p>
                        </div>
                    </label>
                </div>
            </div>

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
                </div>
            </div>

            {/* Plan */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="font-bold text-gray-700 mb-3">Plan Seleccionado</h3>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-lg font-bold text-[#4449AA]">{formData.plan_nombre}</p>
                        <p className="text-sm text-gray-600">{formData.volumen_dtes.toLocaleString()} DTEs/año</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xl font-bold text-[#3DCC91]">${formData.costo_plan_anual.toLocaleString()}</p>
                        <p className="text-sm text-gray-500">Implementación: ${formData.costo_implementacion}</p>
                    </div>
                </div>
            </div>

            {/* Módulos */}
            {formData.modulos_adicionales.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <h3 className="font-bold text-gray-700 mb-3">Módulos Adicionales</h3>
                    <div className="space-y-2">
                        {formData.modulos_adicionales.map(mod => (
                            <div key={mod.nombre} className="flex justify-between text-sm">
                                <span>{mod.nombre}</span>
                                <span className="font-semibold">${mod.costo_anual}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Servicios */}
            {(formData.servicio_whatsapp || formData.servicio_personalizacion) && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <h3 className="font-bold text-gray-700 mb-3">Servicios Adicionales</h3>
                    <div className="space-y-2 text-sm">
                        {formData.servicio_whatsapp && (
                            <div className="flex justify-between">
                                <span>WhatsApp</span>
                                <span className="font-semibold">${totales.costo_whatsapp}</span>
                            </div>
                        )}
                        {formData.servicio_personalizacion && (
                            <div className="flex justify-between">
                                <span>Personalización</span>
                                <span className="font-semibold">${totales.costo_personalizacion}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

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
                            <span className="text-lg font-bold text-[#4449AA]">Inversión Anual Total</span>
                            <span className="text-3xl font-extrabold text-[#3DCC91]">${totales.total_anual.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                            <span className="text-sm text-gray-600">O cuota mensual recurrente</span>
                            <span className="text-xl font-bold text-gray-700">${totales.total_mensual.toLocaleString()} / mes</span>
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
                    <h1 className="text-2xl font-extrabold text-[#4449AA]">Nueva Cotización</h1>
                    <p className="text-sm text-gray-500">Asistente de Facturación Electrónica</p>
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
        </div>
    );
}
