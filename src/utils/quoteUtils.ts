
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
    cuotas?: number;
    descripcion_pago?: string; // Para almacenar la firma/confirmación digital
    metadata?: any;
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

    // B. Cuota (Monto real por pago según divisor de cuotas)
    const divisor = cotizacion.cuotas || (isAnual ? 1 : (plazoMeses || 1));
    const cuotaMensual = recurring12MonthsConIVA / divisor;

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

/**
 * 🎯 LÓGICA CENTRALIZADA DE CÁLCULO DE CUOTAS
 * Esta función implementa la jerarquía correcta: cuotas > plazo_meses > 1
 * Todas las vistas (web, móvil, PDF) DEBEN usar esta función
 */
export interface QuoteFinancialsV2 {
    // Configuración de pago
    cuotas: number;                    // Número real de cuotas (después de jerarquía)
    isPagoUnico: boolean;              // true si cuotas === 1

    // Valores base
    licenciaAnual: number;             // Costo base de licencia sin ajustes
    implementacion: number;            // Costo de implementación
    ivaPct: number;                    // Porcentaje de IVA (ej: 0.13)

    // Ajustes de financiamiento
    ajustePct: number;                 // Porcentaje de recargo/descuento
    tipoAjuste: 'discount' | 'recharge' | 'none';
    recargoMonto: number;              // Monto del recargo en dinero
    ajusteLabel: string;               // Label para mostrar (ej: "Financiamiento (20%)")

    // Licencia ajustada
    licenciaAjustada: number;          // Licencia con recargo/descuento aplicado
    ivaLicencia: number;               // IVA sobre licencia ajustada
    totalLicencia: number;             // Total licencia + IVA
    cuotaMensual: number;              // Pago mensual (totalLicencia / cuotas)

    // Implementación
    ivaImplementacion: number;         // IVA sobre implementación
    totalImplementacion: number;       // Total implementación + IVA

    // Display
    planTitulo: string;                // Título del plan (ej: "12 CUOTAS CONSECUTIVAS")
    planDescripcion: string;           // Descripción del plan

    // Descuento manual del agente
    descuentoManualPct: number;        // Porcentaje (ej: 10)
    descuentoManualMonto: number;      // Monto en $ del descuento manual
}

export const calculateQuoteFinancialsV2 = (
    cotizacion: Partial<CotizacionData>,
    financingPlan?: {
        titulo?: string;
        descripcion?: string;
        interes_porcentaje?: number;
        tipo_ajuste?: 'discount' | 'recharge' | 'none';
    }
): QuoteFinancialsV2 => {
    // 1. JERARQUÍA DE CUOTAS (LA LÓGICA MAESTRA)
    const cuotasVal = Number(cotizacion.cuotas);
    const plazoVal = Number(cotizacion.plazo_meses) || 0;

    let cuotas = 1;

    // Si cuotas está definido y es un número válido (incluso 1), usarlo
    if (!isNaN(cuotasVal) && cuotasVal >= 1) {
        cuotas = cuotasVal;
    }
    // Solo si cuotas NO está definido o es 0, usar plazo_meses como fallback
    else if (plazoVal > 1) {
        cuotas = plazoVal;
    }

    const isPagoUnico = cuotas <= 1;

    // 2. VALORES BASE - SEPARAR PAGOS ÚNICOS DE RECURRENTES
    const licenciaBase = Number(cotizacion.costo_plan_anual) || 0;

    // Parsear módulos adicionales
    const modulosAdicionales = parseModules(cotizacion.modulos_adicionales);

    // SEPARAR: Pagos únicos vs Recurrentes en módulos/servicios
    let costoModulosRecurrentes = 0;
    let costoServiciosUnicos = 0;

    modulosAdicionales.forEach((mod: any) => {
        const pagoUnico = Number(mod.pago_unico) || 0;
        const costoAnual = Number(mod.costo_anual) || Number(mod.costo) || 0;

        if (pagoUnico > 0) {
            // Servicio con pago único → Va al Pago Inicial
            costoServiciosUnicos += pagoUnico;
        } else if (costoAnual > 0) {
            // Módulo/servicio recurrente → Va al Pago Recurrente
            costoModulosRecurrentes += costoAnual;
        }
    });

    // Sumar WhatsApp si está habilitado (RECURRENTE - se diluye en cuotas)
    const costoWhatsApp = cotizacion.servicio_whatsapp ? (Number(cotizacion.costo_whatsapp) || 0) : 0;

    // LICENCIA ANUAL = Licencia base + Módulos recurrentes + WhatsApp (todos los recurrentes)
    const licenciaAnual = licenciaBase + costoModulosRecurrentes + costoWhatsApp;

    // IMPLEMENTACIÓN = Implementación + Servicios únicos (todo lo que se paga una vez)
    const implementacionBase = Number(cotizacion.costo_implementacion) || 0;
    const implementacion = implementacionBase + costoServiciosUnicos;

    const ivaPct = (cotizacion.iva_porcentaje || 13) / 100;

    // 3. AJUSTES DE FINANCIAMIENTO
    const ajustePct = Number(financingPlan?.interes_porcentaje || cotizacion.recargo_mensual_porcentaje || 0) / 100;
    const tipoAjuste = financingPlan?.tipo_ajuste || (ajustePct > 0 ? 'recharge' : 'none');

    let licenciaAjustada = licenciaAnual;
    let ajusteLabel = '';
    let recargoMonto = 0;

    if (tipoAjuste === 'discount') {
        licenciaAjustada = licenciaAnual * (1 - ajustePct);
        ajusteLabel = `Descuento ${Math.round(ajustePct * 100)}%`;
    } else if (tipoAjuste === 'recharge' && ajustePct > 0) {
        recargoMonto = licenciaAnual * ajustePct;
        licenciaAjustada = licenciaAnual + recargoMonto;
        ajusteLabel = `Financiamiento (${Math.round(ajustePct * 100)}%)`;
    }

    // 3b. DESCUENTO MANUAL DEL AGENTE (aplicado sobre licenciaAjustada)
    const descuentoManualPct = Number(cotizacion.descuento_porcentaje || 0);
    const descuentoManualMonto = descuentoManualPct > 0
        ? licenciaAjustada * (descuentoManualPct / 100)
        : 0;
    const licenciaConDescuento = licenciaAjustada - descuentoManualMonto;

    // 4. CÁLCULOS DE LICENCIA
    const ivaLicencia = licenciaConDescuento * ivaPct;
    const totalLicencia = licenciaConDescuento + ivaLicencia;
    const cuotaMensual = cuotas > 1 ? totalLicencia / cuotas : totalLicencia;

    // 5. CÁLCULOS DE IMPLEMENTACIÓN
    const ivaImplementacion = implementacion * ivaPct;
    const totalImplementacion = implementacion + ivaImplementacion;

    // 6. DISPLAY
    const planTitulo = financingPlan?.titulo || cotizacion.descripcion_pago || (isPagoUnico ? '1 Solo pago' : `${cuotas} Meses`);
    const planDescripcion = financingPlan?.descripcion || (isPagoUnico ? 'Pago único adelantado' : `${cuotas} cuotas consecutivas`);

    return {
        cuotas,
        isPagoUnico,
        licenciaAnual,
        implementacion,
        ivaPct,
        ajustePct,
        tipoAjuste,
        recargoMonto,
        ajusteLabel,
        licenciaAjustada,
        ivaLicencia,
        totalLicencia,
        cuotaMensual,
        ivaImplementacion,
        totalImplementacion,
        planTitulo,
        planDescripcion,
        descuentoManualPct,
        descuentoManualMonto
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
