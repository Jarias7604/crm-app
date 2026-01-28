
export interface CotizacionItem {
    nombre: string;
    tipo: 'modulo' | 'servicio';
    descripcion?: string;
    costo_anual: number;
    costo_mensual: number;
}

export interface CotizacionData {
    id: string;
    created_at: string;
    nombre_cliente: string;
    empresa_cliente?: string;
    email_cliente?: string;
    telefono_cliente?: string;
    direccion_cliente?: string;
    volumen_dtes: number;
    plan_nombre: string;
    costo_plan_anual: number;
    costo_plan_mensual: number;
    costo_implementacion: number;
    modulos_adicionales: any; // Can be string or array
    servicio_whatsapp: boolean;
    costo_whatsapp: number;
    descuento_porcentaje: number;
    iva_porcentaje: number;
    recargo_mensual_porcentaje: number;
    total_anual: number;
    monto_anticipo: number;
    tipo_pago: 'mensual' | 'anual';
    estado: string;
    subtotal_anticipo: number;
    iva_anticipo: number;
    total_mensual: number;
    notes?: string;
    incluir_implementacion: boolean;
    company?: {
        name: string;
        logo_url?: string;
        website?: string;
        address?: string;
        phone?: string;
    };
    creator?: {
        full_name: string;
        email: string;
        avatar_url?: string;
    };
}

export const calculateQuoteFinancials = (cotizacion: Partial<CotizacionData>) => {
    const isMonthly = cotizacion.tipo_pago === 'mensual';
    const ivaPct = (cotizacion.iva_porcentaje || 13) / 100;
    const recargoMensualPct = (cotizacion.recargo_mensual_porcentaje || 20) / 100;
    const totalAnual = cotizacion.total_anual || 0;
    const pagoInicial = cotizacion.monto_anticipo || 0;

    // Lo que queda por pagar después del anticipo
    const totalRecurrenteConIVA = totalAnual - pagoInicial;

    let subtotalRecurrenteBase = 0;
    let recargoFinanciamiento = 0;
    let ivaRecurrente = 0;

    if (isMonthly) {
        // base = total / ((1 + recargo) * (1 + iva))
        subtotalRecurrenteBase = totalRecurrenteConIVA / ((1 + recargoMensualPct) * (1 + ivaPct));
        recargoFinanciamiento = subtotalRecurrenteBase * recargoMensualPct;
        ivaRecurrente = (subtotalRecurrenteBase + recargoFinanciamiento) * ivaPct;
    } else {
        subtotalRecurrenteBase = totalRecurrenteConIVA / (1 + ivaPct);
        ivaRecurrente = subtotalRecurrenteBase * ivaPct;
    }

    // Cálculos para el Pago Inicial
    const subtotalAnticipo = pagoInicial / (1 + ivaPct);
    const ivaAnticipo = pagoInicial - subtotalAnticipo;

    return {
        isMonthly,
        ivaPct,
        recargoMensualPct,
        totalAnual,
        pagoInicial,
        subtotalRecurrenteBase,
        recargoFinanciamiento,
        ivaRecurrente,
        subtotalAnticipo,
        ivaAnticipo,
        totalRecurrenteConIVA
    };
};

export const parseModules = (modules: any): CotizacionItem[] => {
    if (!modules) return [];
    if (Array.isArray(modules)) return modules;
    try {
        if (typeof modules === 'string') return JSON.parse(modules);
    } catch (e) {
        console.error('Error parsing modules', e);
    }
    return [];
};
