import { supabase } from './supabase';
import type { PricingItem, PricingConfig } from '../types/pricing';

class PricingService {
    // Obtener toda la configuración de precios
    async getPricingConfig(): Promise<PricingConfig> {
        const { data, error } = await supabase
            .from('pricing_items')
            .select('*')
            .eq('activo', true)
            .order('orden', { ascending: true });

        if (error) throw error;

        const items = data || [];

        return {
            planes: items.filter((i: any) => i.tipo === 'plan'),
            modulos: items.filter((i: any) => i.tipo === 'modulo'),
            servicios: items.filter((i: any) => i.tipo === 'servicio'),
            implementacion: items.filter((i: any) => i.tipo === 'implementacion')
        };
    }

    // Obtener todos los ítems de un tipo específico
    async getItemsByTipo(tipo: PricingItem['tipo']): Promise<PricingItem[]> {
        const { data, error } = await supabase
            .from('pricing_items')
            .select('*')
            .eq('tipo', tipo)
            .eq('activo', true)
            .order('orden', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    // Obtener un plan basado en el volumen de DTEs
    async getPlanByDTEs(volumen_dtes: number): Promise<PricingItem | null> {
        const { data, error } = await supabase
            .from('pricing_items')
            .select('*')
            .eq('tipo', 'plan')
            .eq('activo', true)
            .gte('max_dtes', volumen_dtes)
            .lte('min_dtes', volumen_dtes)
            .order('orden', { ascending: true })
            .limit(1)
            .single();

        if (error) {
            console.error('Error finding plan:', error);
            return null;
        }
        return data;
    }

    // CRUD para administración
    async createPricingItem(item: Omit<PricingItem, 'id' | 'created_at' | 'updated_at'>) {
        const { data, error } = await supabase
            .from('pricing_items')
            .insert(item)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async updatePricingItem(id: string, updates: Partial<PricingItem>) {
        const { data, error } = await supabase
            .from('pricing_items')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async deletePricingItem(id: string) {
        // Soft delete: solo marcar como inactivo
        const { error } = await supabase
            .from('pricing_items')
            .update({ activo: false })
            .eq('id', id);

        if (error) throw error;
    }

    async getAllPricingItems(includeInactive = false): Promise<PricingItem[]> {
        let query = supabase
            .from('pricing_items')
            .select('*')
            .order('tipo', { ascending: true })
            .order('orden', { ascending: true });

        if (!includeInactive) {
            query = query.eq('activo', true);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    // Calcular precio de un servicio basado en DTEs
    calcularPrecioServicio(item: PricingItem, volumen_dtes: number, cantidad = 1): number {
        if (item.precio_por_dte > 0) {
            return volumen_dtes * item.precio_por_dte * cantidad;
        }
        return item.costo_unico * cantidad;
    }

    // NUEVO: Calcular precio total de un ítem según su fórmula
    calcularPrecioItem(item: PricingItem, volumen_dtes: number, cantidad = 1, periodo: 'anual' | 'mensual' = 'anual'): {
        precio_base: number;
        precio_calculado: number;
        descripcion_calculo: string;
    } {
        let precio_base = periodo === 'anual' ? item.precio_anual : item.precio_mensual;
        let precio_calculado = precio_base;
        let descripcion_calculo = '';

        // Determinar fórmula de cálculo
        const formula = (item.metadata as any)?.formula_calculo || (item.precio_por_dte > 0 ? 'por_dte' : 'fijo');

        switch (formula) {
            case 'por_dte':
                // Precio variable según DTEs
                const precio_dte = item.precio_por_dte || (item.metadata as any)?.precio_base_dte || 0;
                precio_calculado = volumen_dtes * precio_dte * cantidad;
                descripcion_calculo = `${volumen_dtes.toLocaleString()} DTEs × $${precio_dte} × ${cantidad}`;
                break;

            case 'por_cantidad':
                // Precio fijo multiplicado por cantidad
                precio_calculado = precio_base * cantidad;
                descripcion_calculo = `$${precio_base} × ${cantidad} unidad(es)`;
                break;

            case 'fijo':
            default:
                // Precio fijo (plan, módulo estándar)
                precio_calculado = precio_base;
                descripcion_calculo = `Precio ${periodo}`;

                // Agregar costo único si existe
                if (item.costo_unico > 0) {
                    precio_calculado += item.costo_unico;
                    descripcion_calculo += ` + $${item.costo_unico} (único)`;
                }
                break;
        }

        // Aplicar margen de ganancia si existe
        const margen = (item.metadata as any)?.margen_ganancia || 0;
        if (margen > 0) {
            const incremento = (precio_calculado * margen) / 100;
            precio_calculado += incremento;
            descripcion_calculo += ` + ${margen}% margen`;
        }

        return {
            precio_base,
            precio_calculado: Number(precio_calculado.toFixed(2)),
            descripcion_calculo
        };
    }
}

export const pricingService = new PricingService();
