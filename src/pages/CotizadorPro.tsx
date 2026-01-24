import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, FileText, DollarSign, Search, X } from 'lucide-react';
import { cotizadorService, type CotizadorPaquete, type CotizadorItem } from '../services/cotizador';
import { leadsService } from '../services/leads';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { cotizacionesService } from '../services/cotizaciones';
import { useAuth } from '../auth/AuthProvider';
import toast from 'react-hot-toast';

export default function CotizadorPro() {
    const navigate = useNavigate();
    const { profile } = useAuth();
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
        notas: ''
    });

    const [paqueteSugerido, setPaqueteSugerido] = useState<CotizadorPaquete | null>(null);
    const [totales, setTotales] = useState({
        subtotal_anual: 0,
        subtotal_mensual: 0,
        descuento_monto: 0,
        iva_monto: 0,
        total_anual: 0,
        total_mensual: 0,
        desglose: [] as any[]
    });

    useEffect(() => {
        loadData();
        loadLeads();
    }, []);

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
    }, [formData.paquete_id, formData.modulos_ids, formData.servicios_ids, formData.descuento_porcentaje, formData.volumen_dtes]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [paqData, itemsData] = await Promise.all([
                cotizadorService.getAllPaquetes(),
                cotizadorService.getAllItems()
            ]);

            setPaquetes(paqData);
            setModulos(itemsData.filter(i => i.tipo === 'modulo'));
            setServicios(itemsData.filter(i => i.tipo === 'servicio'));
        } catch (error) {
            console.error('Error loading data:', error);
            toast.error('Error al cargar datos');
        } finally {
            setLoading(false);
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
            console.error('Error buscando paquete:', error);
        }
    };

    const calcularTotales = () => {
        const paqueteSeleccionado = paquetes.find(p => p.id === formData.paquete_id);
        if (!paqueteSeleccionado) {
            setTotales({
                subtotal_anual: 0,
                subtotal_mensual: 0,
                descuento_monto: 0,
                iva_monto: 0,
                total_anual: 0,
                total_mensual: 0,
                desglose: []
            });
            return;
        }

        const itemsSeleccionados = [
            ...modulos.filter(m => formData.modulos_ids.includes(m.id)),
            ...servicios.filter(s => formData.servicios_ids.includes(s.id))
        ];

        const cotizacion = cotizadorService.calcularCotizacion(
            paqueteSeleccionado,
            itemsSeleccionados,
            formData.volumen_dtes,
            formData.descuento_porcentaje,
            formData.iva_porcentaje
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
            ].map(item => ({
                nombre: item.nombre,
                tipo: item.tipo,
                descripcion: item.descripcion || '',
                costo_anual: item.precio_por_dte > 0
                    ? formData.volumen_dtes * item.precio_por_dte
                    : (item.pago_unico || item.precio_anual),
                costo_mensual: item.precio_mensual || 0
            }));

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
                costo_plan_anual: paqueteSeleccionado.costo_paquete_anual,
                costo_plan_mensual: paqueteSeleccionado.costo_paquete_mensual,
                costo_implementacion: paqueteSeleccionado.costo_implementacion,
                modulos_adicionales: todosLosItems,
                servicio_whatsapp: whatsappSeleccionado,
                costo_whatsapp: whatsappServicio
                    ? (whatsappServicio.precio_por_dte > 0
                        ? formData.volumen_dtes * whatsappServicio.precio_por_dte
                        : whatsappServicio.precio_anual)
                    : 0,
                servicio_personalizacion: personalizacionSeleccionada,
                costo_personalizacion: personalizacionServicio
                    ? (personalizacionServicio.pago_unico || personalizacionServicio.precio_anual)
                    : 0,
                subtotal_anual: totales.subtotal_anual,
                subtotal_mensual: totales.subtotal_mensual,
                descuento_porcentaje: formData.descuento_porcentaje,
                descuento_monto: totales.descuento_monto,
                iva_porcentaje: formData.iva_porcentaje,
                iva_monto: totales.iva_monto,
                total_anual: totales.total_anual,
                total_mensual: totales.total_mensual,
                notas: formData.notas,
                incluir_implementacion: formData.incluir_implementacion,
                estado: 'borrador' as const
            };

            await cotizacionesService.createCotizacion(cotizacionData);
            toast.success('✅ Cotización creada exitosamente');
            navigate('/cotizaciones');
        } catch (error: any) {
            console.error('Error creando cotización:', error);
            const errorMessage = error?.message || error?.toString() || 'Error al crear cotización';
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
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-extrabold text-[#4449AA]">📋 Nueva Cotización Profesional</h1>
                <p className="text-sm text-gray-500 mt-1">Sistema dinámico de cotización basado en paquetes</p>
            </div>

            {/* Indicador de Pasos */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center justify-between">
                    {[1, 2, 3, 4].map((paso) => (
                        <div key={paso} className="flex items-center flex-1">
                            <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${paso <= pasoActual
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 text-gray-500'
                                    }`}
                            >
                                {paso}
                            </div>
                            <div className="flex-1 ml-3">
                                <p className={`text-sm font-bold ${paso <= pasoActual ? 'text-blue-600' : 'text-gray-400'}`}>
                                    {paso === 1 && 'Cliente'}
                                    {paso === 2 && 'Paquete'}
                                    {paso === 3 && 'Módulos/Servicios'}
                                    {paso === 4 && 'Resumen'}
                                </p>
                            </div>
                            {paso < 4 && (
                                <div
                                    className={`h-0.5 w-full ${paso < pasoActual ? 'bg-blue-600' : 'bg-gray-200'
                                        }`}
                                />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Contenido */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                {/* PASO 1: Cliente */}
                {pasoActual === 1 && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-extrabold text-[#4449AA] mb-2">Información del Cliente</h2>
                            <p className="text-sm text-gray-500">Configure los detalles del cliente para esta cotización</p>
                        </div>

                        {/* Selector de Lead Ultra Profesional */}
                        {!formData.usar_lead ? (
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-8 hover:shadow-lg transition-all duration-300">
                                <div className="flex items-start gap-6">
                                    <div className="flex-shrink-0">
                                        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                                            <FileText className="w-8 h-8 text-white" />
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">¿Trabajar con un Lead existente?</h3>
                                        <p className="text-sm text-gray-600 mb-4">
                                            Seleccione un Lead de su pipeline para auto-completar la información del cliente de forma inmediata.
                                        </p>
                                        <button
                                            onClick={() => setShowLeadSelector(true)}
                                            className="inline-flex items-center gap-2 bg-white border-2 border-blue-600 text-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-blue-600 hover:text-white transition-all duration-200 shadow-sm hover:shadow-md"
                                        >
                                            <Search className="w-5 h-5" />
                                            Seleccionar Lead Existente
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl p-6 hover:shadow-lg transition-all duration-300">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center">
                                            <FileText className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Lead Seleccionado</p>
                                            <p className="text-lg font-bold text-gray-900">{formData.cliente_nombre}</p>
                                            {formData.cliente_email && (
                                                <p className="text-sm text-gray-600">{formData.cliente_email}</p>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setFormData({
                                                ...formData,
                                                usar_lead: false,
                                                lead_id: null,
                                                cliente_nombre: '',
                                                cliente_email: ''
                                            });
                                        }}
                                        className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600"
                                        title="Remover Lead"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
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
                                        <div className="text-right">
                                            <p className="font-bold text-green-600">
                                                ${modulo.precio_anual.toFixed(2)}/año
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                ${modulo.precio_mensual.toFixed(2)}/mes
                                            </p>
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
                                        <div className="text-right">
                                            {servicio.precio_por_dte > 0 ? (
                                                <>
                                                    <p className="font-bold text-green-600">
                                                        ${(formData.volumen_dtes * servicio.precio_por_dte).toFixed(2)}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {formData.volumen_dtes.toLocaleString()} × ${servicio.precio_por_dte}
                                                    </p>
                                                </>
                                            ) : servicio.pago_unico > 0 ? (
                                                <>
                                                    <p className="font-bold text-green-600">
                                                        ${servicio.pago_unico.toFixed(2)}
                                                    </p>
                                                    <p className="text-xs text-gray-500">Pago único</p>
                                                </>
                                            ) : (
                                                <p className="font-bold text-green-600">
                                                    ${servicio.precio_anual.toFixed(2)}/año
                                                </p>
                                            )}
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* PASO 4: Resumen */}
                {pasoActual === 4 && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-bold text-[#4449AA]">💰 Resumen de Cotización</h2>
                            <div className="text-right">
                                <p className="text-xs text-gray-500 font-bold uppercase">Volumen Contratado</p>
                                <p className="text-sm font-black text-blue-600">
                                    {formData.volumen_dtes.toLocaleString()} DTEs/año
                                    <span className="text-gray-400 font-normal ml-2">({Math.round(formData.volumen_dtes / 12).toLocaleString()} mes)</span>
                                </p>
                            </div>
                        </div>

                        {/* Desglose */}
                        <div className="space-y-2">
                            {totales.desglose.map((item, idx) => (
                                <div key={idx} className="flex justify-between p-2 bg-gray-50 rounded">
                                    <div>
                                        <p className="font-semibold text-gray-800">
                                            {item.tipo}: {item.nombre}
                                        </p>
                                        {item.descripcion && (
                                            <p className="text-xs text-gray-500">{item.descripcion}</p>
                                        )}
                                    </div>
                                    <p className="font-bold text-gray700">
                                        ${item.precio_anual.toFixed(2)}
                                    </p>
                                </div>
                            ))}
                        </div>

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

                        {/* Totales */}
                        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Subtotal:</span>
                                    <span className="font-semibold">${totales.subtotal_anual.toFixed(2)}</span>
                                </div>
                                {totales.descuento_monto > 0 && (
                                    <div className="flex justify-between text-sm text-red-600">
                                        <span>Descuento ({formData.descuento_porcentaje}%):</span>
                                        <span className="font-semibold">-${totales.descuento_monto.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center text-sm p-1.5 bg-white/40 rounded-lg">
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <span>IVA %:</span>
                                        <input
                                            type="number"
                                            className="w-10 bg-white border border-gray-200 rounded px-1 text-xs font-bold"
                                            value={formData.iva_porcentaje}
                                            onChange={(e) => setFormData({ ...formData, iva_porcentaje: Number(e.target.value) })}
                                        />
                                    </div>
                                    <span className="font-semibold text-gray-700">+${totales.iva_monto.toFixed(2)}</span>
                                </div>
                                <div className="border-t-2 border-blue-300 pt-2">
                                    <div className="flex justify-between text-lg font-extrabold text-blue-600">
                                        <span>TOTAL ANUAL:</span>
                                        <span>${totales.total_anual.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-gray-600 mt-1 italic border-t border-blue-100 pt-1">
                                        <span>Equivalente mensual aproximado:</span>
                                        <span className="font-bold text-gray-800">${(totales.total_anual / 12).toFixed(2)}/mes</span>
                                    </div>
                                </div>
                            </div>

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

                            {/* Notas */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Notas adicionales
                                </label>
                                <textarea
                                    value={formData.notas}
                                    onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5"
                                    rows={3}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Botones de Navegación */}
                <div className="flex justify-between mt-8">
                    <Button
                        onClick={handleAnterior}
                        variant="outline"
                        disabled={pasoActual === 1}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Anterior
                    </Button>

                    {pasoActual < 4 ? (
                        <Button onClick={handleSiguiente} className="bg-blue-600 hover:bg-blue-700 text-white">
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

            {/* Preview Flotante */}
            {pasoActual > 1 && (
                <div className="fixed top-24 right-6 bg-white border-2 border-green-500 rounded-xl shadow-2xl p-4 w-72 z-50">
                    <h4 className="font-bold text-sm text-[#4449AA] mb-2 flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Precio en Tiempo Real
                    </h4>
                    <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-600">Subtotal:</span>
                            <span className="font-semibold">${totales.subtotal_anual.toLocaleString()}</span>
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
                            <span className="font-black text-xs">+${totales.iva_monto.toLocaleString()}</span>
                        </div>
                        <div className="border-t pt-2 mt-2">
                            <div className="flex justify-between text-lg font-bold text-green-600">
                                <span>Total:</span>
                                <span>${totales.total_anual.toLocaleString()}</span>
                            </div>
                            <p className="text-xs text-gray-500 text-right">
                                ${(totales.total_anual / 12).toFixed(2)}/mes
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Selector de Leads - Cobertura Total Garantizada (Fuera de contenedores padres para evitar stacking context issues) */}
            {
                showLeadSelector && (
                    <div
                        className="fixed inset-0 bg-black flex items-center justify-center"
                        style={{
                            zIndex: 9999999,
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            width: '100vw',
                            height: '100vh',
                            backgroundColor: 'black'
                        }}
                        onClick={() => { setShowLeadSelector(false); setSearchLead(''); }}
                    >
                        <div
                            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col m-4"
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
        </div >
    );
}
