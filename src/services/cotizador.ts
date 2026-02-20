import { supabase } from './supabase';

// =====================================================
// TIPOS
// =====================================================

export interface CotizadorPaquete {
    id: string;
    company_id: string | null;
    paquete: string;
    cantidad_dtes: number;
    costo_implementacion: number;
    costo_paquete_anual: number;
    costo_paquete_mensual: number;
    activo: boolean;
    orden: number;
    descripcion?: string;
    metadata: any;
    created_at: string;
    updated_at: string;
}

export interface CotizadorItem {
    id: string;
    company_id: string | null;
    tipo: 'modulo' | 'servicio' | 'otro';
    nombre: string;
    codigo?: string;
    pago_unico: number;
    precio_anual: number;
    precio_mensual: number;
    precio_por_dte: number;
    incluye_en_paquete: boolean;
    activo: boolean;
    orden: number;
    descripcion?: string;
    metadata: any;
    created_at: string;
    updated_at: string;
}

export interface DetalleLinea {
    tipo: string;
    nombre: string;
    precio_anual: number;
    precio_mensual: number;
    es_pago_unico: boolean;
    descripcion: string;
}

export interface CotizacionCalculada {
    // Pagos Únicos (implementación, servicios únicos, etc)
    subtotal_pagos_unicos: number;
    iva_pagos_unicos: number;
    total_pagos_unicos: number;

    // Pagos Recurrentes (licencias, módulos, servicios recurrentes)
    subtotal_recurrente_base: number;      // Sin recargo
    recargo_mensual_porcentaje: number;    // Base (e.g. 20%)
    recargo_aplicado_porcentaje: number;   // Calculated based on period (e.g. 10% for 6 months)
    recargo_mensual_monto: number;         // Solo si forma_pago = 'mensual'

    // Forma de pago y cálculos
    forma_pago: 'anual' | 'mensual';
    meses_pago: number;                    // 1, 3, 6, 9, 12
    precio_anual_sin_recargo: number;      // Precio si paga anual completo
    precio_anual_con_recargo: number;      // Precio si paga mensual (con recargo)
    cuota_mensual: number;                 // Valor de la cuotas por periodo
    ahorro_pago_anual: number;             // Incentivo visual

    // Descuentos e impuestos
    descuento_porcentaje: number;
    descuento_monto: number;
    iva_porcentaje: number;
    iva_monto_recurrente: number;

    // Totales finales
    total_recurrente: number;              // Según forma de pago elegida
    total_general: number;                 // Únicos + Recurrente

    // Información adicional
    paquete: CotizadorPaquete;
    items_seleccionados: CotizadorItem[];
    desglose: DetalleLinea[];

    // V4: Installments Meta
    cuotas: number;
    es_financiado: boolean;
}

// =====================================================
// SERVICIO
// =====================================================

class CotizadorService {

    // =================== PAQUETES ===================

    async getAllPaquetes(incluirInactivos = false): Promise<CotizadorPaquete[]> {
        let query = supabase
            .from('cotizador_paquetes')
            .select('*')
            .order('cantidad_dtes', { ascending: true })
            .order('paquete', { ascending: true });

        if (!incluirInactivos) {
            query = query.eq('activo', true);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data || [];
    }

    async getPaquetesPorNombre(nombre: string): Promise<CotizadorPaquete[]> {
        const { data, error } = await supabase
            .from('cotizador_paquetes')
            .select('*')
            .eq('paquete', nombre)
            .eq('activo', true)
            .order('cantidad_dtes', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    async buscarPaquetePorDTEs(cantidad_dtes: number): Promise<CotizadorPaquete | null> {
        const { data, error } = await supabase
            .rpc('buscar_paquete_por_dtes', {
                p_cantidad_dtes: cantidad_dtes,
                p_company_id: null // Busca en globales primero
            });

        if (error) throw error;
        return data && data.length > 0 ? data[0] : null;
    }

    async createPaquete(paquete: Partial<CotizadorPaquete>): Promise<CotizadorPaquete> {
        const { data, error } = await supabase
            .from('cotizador_paquetes')
            .insert(paquete)
            .select()
            .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('No se pudo crear el paquete. Verifique sus permisos.');
        return data;
    }

    async updatePaquete(id: string, updates: Partial<CotizadorPaquete>): Promise<CotizadorPaquete> {
        console.log('[cotizadorService.updatePaquete] Enviando update:', { id, updates });

        const { data, error } = await supabase
            .from('cotizador_paquetes')
            .update(updates)
            .eq('id', id)
            .select()
            .maybeSingle();

        console.log('[cotizadorService.updatePaquete] Respuesta:', { data, error });
        console.log('[cotizadorService.updatePaquete] Descripcion retornada:', data?.descripcion);

        if (error) throw error;
        if (!data) throw new Error('No se pudo actualizar el paquete. Es posible que no tenga permisos para editar este registro global.');
        return data;
    }

    async deletePaquete(id: string): Promise<void> {
        // Soft delete
        await this.updatePaquete(id, { activo: false });
    }

    // =================== ITEMS ===================

    async getAllItems(incluirInactivos = false): Promise<CotizadorItem[]> {
        let query = supabase
            .from('cotizador_items')
            .select('*')
            .order('tipo', { ascending: true })
            .order('orden', { ascending: true });

        if (!incluirInactivos) {
            query = query.eq('activo', true);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data || [];
    }

    async getItemsPorTipo(tipo: 'modulo' | 'servicio' | 'otro'): Promise<CotizadorItem[]> {
        const { data, error } = await supabase
            .from('cotizador_items')
            .select('*')
            .eq('tipo', tipo)
            .eq('activo', true)
            .order('orden', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    async createItem(item: Partial<CotizadorItem>): Promise<CotizadorItem> {
        const { data, error } = await supabase
            .from('cotizador_items')
            .insert(item)
            .select()
            .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('No se pudo crear el item. Verifique sus permisos.');
        return data;
    }

    async updateItem(id: string, updates: Partial<CotizadorItem>): Promise<CotizadorItem> {
        const { data, error } = await supabase
            .from('cotizador_items')
            .update(updates)
            .eq('id', id)
            .select()
            .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('No se pudo actualizar el item. Es posible que no tenga permisos para editar este registro global.');
        return data;
    }

    async deleteItem(id: string): Promise<void> {
        // Soft delete
        await this.updateItem(id, { activo: false });
    }

    // =================== CÁLCULOS ===================

    // =====================================================
    // MOTOR DE CÁLCULO UNIFICADO V2
    // =====================================================

    calcularCotizacion(
        paquete: CotizadorPaquete,
        items: CotizadorItem[],
        cantidad_dtes: number,
        // Configuración Financiera (Plan + IVA)
        config: {
            forma_pago: 'anual' | 'mensual'; // (Derivado del plan.meses: 12='anual' si es contado, sino 'mensual' visualmente) 
            //  NOTA: En V2 'forma_pago' es más visual. Lo que importa son 'meses' y 'tipo_ajuste'.
            meses: number;
            tipo_ajuste: 'discount' | 'recharge' | 'none';  // Nuevo V2
            tasa_ajuste: number; // Porcentaje (interes o descuento)


            iva_porcentaje: number;
            incluir_implementacion: boolean;
            cuotas?: number; // V3: Cantidad de pagos (divisor)
        }
    ): CotizacionCalculada {

        let subtotal_pagos_unicos = 0;
        let subtotal_recurrente_base = 0;
        const desglose: DetalleLinea[] = [];

        // 1. IMPLEMENTACIÓN (Pago Único)
        if (config.incluir_implementacion && paquete.costo_implementacion > 0) {
            subtotal_pagos_unicos += paquete.costo_implementacion;
            desglose.push({
                es_pago_unico: true,
                tipo: 'Implementación',
                nombre: 'Implementación y Configuración',
                precio_anual: paquete.costo_implementacion,
                precio_mensual: 0,
                descripcion: 'Configuración inicial, capacitación (Pago único)'
            });
        }

        // 2. PAQUETE (Recurrente)
        subtotal_recurrente_base += paquete.costo_paquete_anual;
        desglose.push({
            es_pago_unico: false,
            tipo: 'Paquete',
            nombre: `${paquete.paquete} (${paquete.cantidad_dtes} DTEs)`,
            precio_anual: paquete.costo_paquete_anual,
            precio_mensual: paquete.costo_paquete_mensual,
            descripcion: 'Licencia de facturación electrónica'
        });

        // 3. ITEMS (separar únicos de recurrentes)
        items.forEach(item => {
            if (item.pago_unico > 0) {
                subtotal_pagos_unicos += item.pago_unico;
                desglose.push({
                    es_pago_unico: true,
                    tipo: item.tipo === 'modulo' ? 'Módulo' : 'Servicio',
                    nombre: item.nombre,
                    precio_anual: item.pago_unico,
                    precio_mensual: 0,
                    descripcion: item.descripcion || 'Pago único'
                });
            } else if (item.precio_por_dte > 0) {
                const precio = cantidad_dtes * item.precio_por_dte;
                subtotal_recurrente_base += precio;
                desglose.push({
                    es_pago_unico: false,
                    tipo: item.tipo === 'modulo' ? 'Módulo' : 'Servicio',
                    nombre: item.nombre,
                    precio_anual: precio,
                    precio_mensual: precio / 12,
                    descripcion: item.descripcion || `${cantidad_dtes.toLocaleString()} DTEs × $${item.precio_por_dte}`
                });
            } else {
                const precio = item.precio_anual || (item.precio_mensual * 12);
                subtotal_recurrente_base += precio;
                desglose.push({
                    es_pago_unico: false,
                    tipo: item.tipo === 'modulo' ? 'Módulo' : 'Servicio',
                    nombre: item.nombre,
                    precio_anual: precio,
                    precio_mensual: item.precio_mensual || precio / 12,
                    descripcion: item.descripcion || 'Recurrente'
                });
            }
        });

        // 4. LÓGICA FINANCIERA UNIFICADA (V2)
        // Ya no hay caminos separados para "Anual" o "Mensual", todo depende de tipo_ajuste y tasa.

        let precio_recurrente_final = subtotal_recurrente_base;
        let descuento_monto = 0;
        let recargo_monto = 0;
        let ahorro_total = 0;

        // Base para cálculos visuales de ahorro (asume que el precio de lista es lo que paga si es 'none' o 'recharge')
        // Si hay descuento, el ahorro es tangible.

        if (config.tipo_ajuste === 'discount') {
            // APLICA DESCUENTO
            descuento_monto = subtotal_recurrente_base * (config.tasa_ajuste / 100);
            precio_recurrente_final = subtotal_recurrente_base - descuento_monto;
            ahorro_total = descuento_monto;
        } else if (config.tipo_ajuste === 'recharge') {
            // APLICA RECARGO
            recargo_monto = subtotal_recurrente_base * (config.tasa_ajuste / 100);
            precio_recurrente_final = subtotal_recurrente_base + recargo_monto;
            // No hay ahorro real, es un costo extra
        } else {
            // NEUTRO ('none') o cualquier otro
            // Precio de lista.
        }

        // 5. CÁLCULO DE CUOTAS
        // V3: La cuota debe ser el (Total con Recargo e IVA) dividido entre cuotas.
        // Primero calculamos IVA Recurrente
        const iva_recurrente = (precio_recurrente_final * config.iva_porcentaje) / 100;
        const total_recurrente = precio_recurrente_final + iva_recurrente;

        // Divisor: LÓGICA CORREGIDA - Respetar cuotas explícitas (incluso si es 1)
        // Solo usar 'meses' como fallback si cuotas NO está definido o es 0
        let divisor_cuotas = 1;

        if (config.cuotas !== undefined && config.cuotas !== null && config.cuotas >= 1) {
            // Si cuotas está explícitamente definido (incluso 1), usarlo
            divisor_cuotas = config.cuotas;
        } else if (config.meses && config.meses > 1) {
            // Solo si cuotas NO está definido, usar meses como fallback
            divisor_cuotas = config.meses;
        }

        // V4: es_financiado depende de si hay más de una cuota
        const es_financiado = divisor_cuotas > 1;

        // V4: Lógica de Frecuencia Visual
        // Si son cuotas consecutivas (es_financiado), la frecuencia es siempre 1 (Mensual).
        // Si no (pago único), usamos 'meses' (ej. 12 para anual).
        const frecuencia_pago = es_financiado ? 1 : config.meses;

        // Cuota periódica REAL que pagará el cliente (Total Recurrente / Divisor)
        const cuota_periodo = total_recurrente / divisor_cuotas;


        // 6. CALCULAR IVA
        const iva_pagos_unicos = (subtotal_pagos_unicos * config.iva_porcentaje) / 100;


        // 7. TOTALES FINALES
        const total_pagos_unicos = subtotal_pagos_unicos + iva_pagos_unicos;
        // total_recurrente ya calculado arriba para V3
        const total_general = total_pagos_unicos + total_recurrente;

        return {
            subtotal_pagos_unicos: Number(subtotal_pagos_unicos.toFixed(2)),
            iva_pagos_unicos: Number(iva_pagos_unicos.toFixed(2)),
            total_pagos_unicos: Number(total_pagos_unicos.toFixed(2)),

            subtotal_recurrente_base: Number(subtotal_recurrente_base.toFixed(2)),

            // Mapeo legacy para compatibilidad visual
            recargo_mensual_porcentaje: config.tipo_ajuste === 'recharge' ? config.tasa_ajuste : 0,
            recargo_aplicado_porcentaje: config.tipo_ajuste === 'recharge' ? config.tasa_ajuste : 0,
            recargo_mensual_monto: Number(recargo_monto.toFixed(2)),

            forma_pago: config.forma_pago, // Passthrough visual
            // V4: Usamos la frecuencia calculada (1 para cuotas, N para pagos espaciados)
            meses_pago: frecuencia_pago,

            // V4: Metadatos extra para UI
            cuotas: divisor_cuotas,
            es_financiado: es_financiado,

            precio_anual_sin_recargo: Number(subtotal_recurrente_base.toFixed(2)),
            precio_anual_con_recargo: Number(precio_recurrente_final.toFixed(2)),

            cuota_mensual: Number(cuota_periodo.toFixed(2)),

            // Ahorro se calcula diferente según el caso.
            // Si es descuento: Ahorro es el descuento.
            // Si es recargo: No hay ahorro, pero visualmente podríamos compararlo con el pago de contado.
            ahorro_pago_anual: Number(ahorro_total.toFixed(2)),

            descuento_porcentaje: config.tipo_ajuste === 'discount' ? config.tasa_ajuste : 0,
            descuento_monto: Number(descuento_monto.toFixed(2)),

            iva_porcentaje: config.iva_porcentaje,
            iva_monto_recurrente: Number(iva_recurrente.toFixed(2)),

            total_recurrente: Number(total_recurrente.toFixed(2)),
            total_general: Number(total_general.toFixed(2)),

            paquete,
            items_seleccionados: items,
            desglose
        };
    }
}

export const cotizadorService = new CotizadorService();
