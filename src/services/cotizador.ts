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

export interface CotizacionCalculada {
    paquete: CotizadorPaquete;
    items_seleccionados: CotizadorItem[];
    subtotal_anual: number;
    subtotal_mensual: number;
    descuento_porcentaje: number;
    descuento_monto: number;
    iva_porcentaje: number;
    iva_monto: number;
    total_anual: number;
    total_mensual: number;
    desglose: any[];
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
            .single();

        if (error) throw error;
        return data;
    }

    async updatePaquete(id: string, updates: Partial<CotizadorPaquete>): Promise<CotizadorPaquete> {
        const { data, error } = await supabase
            .from('cotizador_paquetes')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
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
            .single();

        if (error) throw error;
        return data;
    }

    async updateItem(id: string, updates: Partial<CotizadorItem>): Promise<CotizadorItem> {
        const { data, error } = await supabase
            .from('cotizador_items')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
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
        descuento_porcentaje: number = 0,
        iva_porcentaje: number = 13,
        incluir_implementacion: boolean = true
    ): CotizacionCalculada {
        let subtotal_anual = 0;
        let subtotal_mensual = 0;
        const desglose: any[] = [];

        // 1. PAQUETE BASE (Solo licencia)
        subtotal_anual += paquete.costo_paquete_anual;
        subtotal_mensual += (paquete.costo_paquete_mensual * 12);

        desglose.push({
            tipo: 'Paquete',
            nombre: `${paquete.paquete} (${paquete.cantidad_dtes} DTEs)`,
            precio_anual: paquete.costo_paquete_anual,
            precio_mensual: paquete.costo_paquete_mensual,
            descripcion: 'Licencia anual de facturación electrónica'
        });

        // 2. IMPLEMENTACIÓN (Línea separada)
        if (incluir_implementacion) {
            const costo_imp = paquete.costo_implementacion;
            subtotal_anual += costo_imp;
            subtotal_mensual += costo_imp;

            desglose.push({
                tipo: 'Implementación',
                nombre: 'Servicios de Implementación',
                precio_anual: costo_imp,
                precio_mensual: 0,
                descripcion: 'Configuración inicial, carga de datos y capacitación (Pago único)'
            });
        }

        // 2. ITEMS SELECCIONADOS
        items.forEach(item => {
            let precio_item_anual = 0;
            let precio_item_mensual = 0;
            let descripcion = '';

            if (item.precio_por_dte > 0) {
                // Precio variable según DTEs
                precio_item_anual = cantidad_dtes * item.precio_por_dte;
                precio_item_mensual = cantidad_dtes * item.precio_por_dte;
                descripcion = `${cantidad_dtes.toLocaleString()} DTEs × $${item.precio_por_dte}`;
            } else if (item.pago_unico > 0) {
                // Pago único
                precio_item_anual = item.pago_unico;
                precio_item_mensual = item.pago_unico;
                descripcion = 'Pago único';
            } else {
                // Precio anual/mensual estándar
                precio_item_anual = item.precio_anual;
                precio_item_mensual = item.precio_mensual * 12;
                descripcion = 'Precio anual';
            }

            subtotal_anual += precio_item_anual;
            subtotal_mensual += precio_item_mensual;

            desglose.push({
                tipo: item.tipo === 'modulo' ? 'Módulo' : 'Servicio',
                nombre: item.nombre,
                precio_anual: precio_item_anual,
                precio_mensual: item.precio_mensual || 0,
                descripcion
            });
        });

        // 3. APLICAR DESCUENTO
        const descuento_monto = (subtotal_anual * descuento_porcentaje) / 100;
        const subtotal_con_descuento = subtotal_anual - descuento_monto;

        // 4. CALCULAR IVA
        const iva_monto = (subtotal_con_descuento * iva_porcentaje) / 100;
        const total_anual = subtotal_con_descuento + iva_monto;

        // El total mensual es simplemente el total anual dividido en 12 cuotas
        const total_mensual = total_anual / 12;

        return {
            paquete,
            items_seleccionados: items,
            subtotal_anual: Number(subtotal_anual.toFixed(2)),
            subtotal_mensual: Number((subtotal_anual / 12).toFixed(2)),
            descuento_porcentaje,
            descuento_monto: Number(descuento_monto.toFixed(2)),
            iva_porcentaje,
            iva_monto: Number(iva_monto.toFixed(2)),
            total_anual: Number(total_anual.toFixed(2)),
            total_mensual: Number(total_mensual.toFixed(2)),
            desglose
        };
    }
}

export const cotizadorService = new CotizadorService();
