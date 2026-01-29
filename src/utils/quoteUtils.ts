
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
    plazo_meses?: number;
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
        terminos_condiciones?: string;
    };
    creator?: {
        full_name: string;
        email: string;
        avatar_url?: string;
    };
}

export const calculateQuoteFinancials = (cotizacion: Partial<CotizacionData>) => {
    const isAnual = cotizacion.tipo_pago === 'anual';
    const ivaPct = (cotizacion.iva_porcentaje || 13) / 100;
    const baseSurchargePct = (cotizacion.recargo_mensual_porcentaje || 20) / 100;
    const totalGeneral = cotizacion.total_anual || 0;
    const pagoInicial = cotizacion.monto_anticipo || 0;
    const plazoMeses = cotizacion.plazo_meses || (isAnual ? 12 : 1);

    // Determinamos el recargo basado en el plazo REAL
    let termSurchargePct = 0;
    if (!isAnual) {
        if (plazoMeses === 1) termSurchargePct = baseSurchargePct;
        else if (plazoMeses === 3) termSurchargePct = baseSurchargePct * 0.75;
        else if (plazoMeses === 6) termSurchargePct = baseSurchargePct * 0.5;
        else if (plazoMeses === 9) termSurchargePct = baseSurchargePct * 0.25;
    }

    // El totalGeneral = Pagos Únicos (pagoInicial) + Recurrente 12 Meses con Recargo
    const recurring12MonthsConIVA = totalGeneral - pagoInicial;

    // A. Desglose ANUAL (Para la lista detallada)
    // Formula: TotalAnual = BaseAnual * (1 + surcharge) * (1 + iva)
    const subtotalRecurrenteBaseAnual = recurring12MonthsConIVA / ((1 + termSurchargePct) * (1 + ivaPct));
    const recargoFinanciamientoAnual = subtotalRecurrenteBaseAnual * termSurchargePct;
    const ivaRecurrenteAnual = (subtotalRecurrenteBaseAnual + recargoFinanciamientoAnual) * ivaPct;

    // B. Cuota MENSUAL (Promedio real que paga el cliente)
    const cuotaMensual = recurring12MonthsConIVA / 12;

    // C. Total del PERIODO (El pago que toca hacer ahora o en 1 mes)
    const montoPeriodo = cuotaMensual * plazoMeses;

    // Totales para el Pago Inicial
    const subtotalAnticipo = pagoInicial / (1 + ivaPct);
    const ivaAnticipo = pagoInicial - subtotalAnticipo;

    return {
        isMonthly: !isAnual,
        plazoMeses,
        ivaPct,
        termSurchargePct,
        totalAnual: totalGeneral,
        pagoInicial,
        // Usamos los valores anuales para el desglose visual de la tarjeta
        subtotalRecurrenteBase: subtotalRecurrenteBaseAnual,
        recargoFinanciamiento: recargoFinanciamientoAnual,
        ivaRecurrente: ivaRecurrenteAnual,
        // Totales de pago
        cuotaMensual,
        montoPeriodo,
        totalRecurrenteConIVA: montoPeriodo, // Alias para compatibilidad parcial
        subtotalAnticipo,
        ivaAnticipo
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
