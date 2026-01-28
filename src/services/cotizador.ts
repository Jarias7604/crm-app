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
    recargo_mensual_porcentaje: number;    // 20% por defecto, configurable
    recargo_mensual_monto: number;         // Solo si forma_pago = 'mensual'

    // Forma de pago y cálculos
    forma_pago: 'anual' | 'mensual';
    precio_anual_sin_recargo: number;      // Precio si paga anual completo
    precio_anual_con_recargo: number;      // Precio si paga mensual (× 1.20)
    cuota_mensual: number;                 // Solo si forma_pago = 'mensual'
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
        const { data, error } = await supabase
            .from('cotizador_paquetes')
            .update(updates)
            .eq('id', id)
            .select()
            .maybeSingle();

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

    calcularCotizacion(
        paquete: CotizadorPaquete,
        items: CotizadorItem[],
        cantidad_dtes: number,
        forma_pago: 'anual' | 'mensual' = 'mensual',
        descuento_porcentaje: number = 0,
        iva_porcentaje: number = 13,
        incluir_implementacion: boolean = true,
        recargo_mensual_porcentaje: number = 20
    ): CotizacionCalculada {

        let subtotal_pagos_unicos = 0;
        let subtotal_recurrente_base = 0;
        const desglose: DetalleLinea[] = [];

        // 1. IMPLEMENTACIÓN (Pago Único)
        if (incluir_implementacion && paquete.costo_implementacion > 0) {
            subtotal_pagos_unicos += paquete.costo_implementacion;
            desglose.push({
                es_pago_unico: true,
                tipo: 'Pago Único',
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
            tipo: 'Licencia',
            nombre: `${paquete.paquete} (${paquete.cantidad_dtes} DTEs)`,
            precio_anual: paquete.costo_paquete_anual,
            precio_mensual: paquete.costo_paquete_mensual,
            descripcion: 'Licencia de facturación electrónica'
        });

        // 3. ITEMS (separar únicos de recurrentes)
        items.forEach(item => {
            if (item.pago_unico > 0) {
                // ✅ Pago único - NO va a mensual
                subtotal_pagos_unicos += item.pago_unico;
                desglose.push({
                    es_pago_unico: true,
                    tipo: item.tipo === 'modulo' ? 'Módulo' : 'Servicio',
                    nombre: item.nombre,
                    precio_anual: item.pago_unico,
                    precio_mensual: 0,
                    descripcion: 'Pago único'
                });
            } else if (item.precio_por_dte > 0) {
                // Precio por DTE (recurrente)
                const precio = cantidad_dtes * item.precio_por_dte;
                subtotal_recurrente_base += precio;
                desglose.push({
                    es_pago_unico: false,
                    tipo: item.tipo === 'modulo' ? 'Módulo' : 'Servicio',
                    nombre: item.nombre,
                    precio_anual: precio,
                    precio_mensual: precio / 12,
                    descripcion: `${cantidad_dtes.toLocaleString()} DTEs × $${item.precio_por_dte}`
                });
            } else {
                // Recurrente normal
                const precio = item.precio_anual || (item.precio_mensual * 12);
                subtotal_recurrente_base += precio;
                desglose.push({
                    es_pago_unico: false,
                    tipo: item.tipo === 'modulo' ? 'Módulo' : 'Servicio',
                    nombre: item.nombre,
                    precio_anual: precio,
                    precio_mensual: item.precio_mensual || precio / 12,
                    descripcion: 'Recurrente'
                });
            }
        });

        // 4. CALCULAR SEGÚN FORMA DE PAGO
        let precio_recurrente_final = 0;
        let recargo_monto = 0;
        let cuota_mensual = 0;
        let ahorro_pago_anual = 0;

        if (forma_pago === 'anual') {
            // Pago anual: precio base sin recargo
            precio_recurrente_final = subtotal_recurrente_base;
            recargo_monto = 0;
            cuota_mensual = 0;
            // Calcular cuánto se ahorra vs pagar mensual
            ahorro_pago_anual = subtotal_recurrente_base * (recargo_mensual_porcentaje / 100);
        } else {
            // Pago mensual: precio base + recargo 20%
            recargo_monto = subtotal_recurrente_base * (recargo_mensual_porcentaje / 100);
            precio_recurrente_final = subtotal_recurrente_base + recargo_monto;
            cuota_mensual = precio_recurrente_final / 12;
            ahorro_pago_anual = recargo_monto;
        }

        // 5. APLICAR DESCUENTO (solo a recurrentes)
        const descuento_monto = (precio_recurrente_final * descuento_porcentaje) / 100;
        const recurrente_con_descuento = precio_recurrente_final - descuento_monto;

        // 6. CALCULAR IVA
        const iva_pagos_unicos = (subtotal_pagos_unicos * iva_porcentaje) / 100;
        const iva_recurrente = (recurrente_con_descuento * iva_porcentaje) / 100;

        // 7. TOTALES
        const total_pagos_unicos = subtotal_pagos_unicos + iva_pagos_unicos;
        const total_recurrente = recurrente_con_descuento + iva_recurrente;
        const total_general = total_pagos_unicos + total_recurrente;

        // Recalcular cuota mensual si hay descuento
        if (forma_pago === 'mensual') {
            cuota_mensual = total_recurrente / 12;
        }

        return {
            // Pagos únicos
            subtotal_pagos_unicos: Number(subtotal_pagos_unicos.toFixed(2)),
            iva_pagos_unicos: Number(iva_pagos_unicos.toFixed(2)),
            total_pagos_unicos: Number(total_pagos_unicos.toFixed(2)),

            // Recurrentes
            subtotal_recurrente_base: Number(subtotal_recurrente_base.toFixed(2)),
            recargo_mensual_porcentaje,
            recargo_mensual_monto: Number(recargo_monto.toFixed(2)),

            // Forma de pago
            forma_pago,
            precio_anual_sin_recargo: Number(subtotal_recurrente_base.toFixed(2)),
            precio_anual_con_recargo: Number((subtotal_recurrente_base + recargo_monto).toFixed(2)),
            cuota_mensual: Number(cuota_mensual.toFixed(2)),
            ahorro_pago_anual: Number(ahorro_pago_anual.toFixed(2)),

            // Descuentos e impuestos
            descuento_porcentaje,
            descuento_monto: Number(descuento_monto.toFixed(2)),
            iva_porcentaje,
            iva_monto_recurrente: Number(iva_recurrente.toFixed(2)),

            // Totales
            total_recurrente: Number(total_recurrente.toFixed(2)),
            total_general: Number(total_general.toFixed(2)),

            // Información adicional
            paquete,
            items_seleccionados: items,
            desglose
        };
    }
}

export const cotizadorService = new CotizadorService();
