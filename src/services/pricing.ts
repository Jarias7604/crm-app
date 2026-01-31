import { supabase } from './supabase';
import type { PricingItem, PricingConfig, PaymentSettings, FinancingPlan } from '../types/pricing';

class PricingService {
    // Obtener configuración de pagos (IVA, descuentos base, etc)
    async getPaymentSettings(companyId?: string): Promise<PaymentSettings | null> {
        let query = supabase.from('payment_settings').select('*');

        if (companyId) {
            query = query.eq('company_id', companyId);
        } else {
            query = query.is('company_id', null);
        }

        const { data, error } = await query.maybeSingle();
        if (error) {
            console.error('Error fetching payment settings:', error);
            return null;
        }
        return data;
    }

    // Obtener planes de financiamiento dinámicos
    async getFinancingPlans(companyId?: string): Promise<FinancingPlan[]> {
        let query = supabase
            .from('financing_plans')
            .select('*')
            .eq('activo', true)
            .order('orden', { ascending: true });

        // Intentar obtener de la compañía, si no hay, obtener globales (null)
        const { data, error } = await query;
        if (error) {
            console.error('Error fetching financing plans:', error);
            return [];
        }

        // Si hay planes específicos de la compañía, usarlos. 
        // Si no, filtrar los que tienen company_id null (globales)
        if (companyId && data.some(p => p.company_id === companyId)) {
            return data.filter(p => p.company_id === companyId);
        }

        return data.filter(p => p.company_id === null);
    }
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
    // --- ADMINISTRACIÓN DE FINANCIAMIENTO ---

    async createFinancingPlan(plan: Omit<FinancingPlan, 'id' | 'created_at'>) {
        const { data, error } = await supabase
            .from('financing_plans')
            .insert(plan)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async updateFinancingPlan(id: string, updates: Partial<FinancingPlan>) {
        const { data, error } = await supabase
            .from('financing_plans')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async deleteFinancingPlan(id: string) {
        // En lugar de borrar, mejor desactivar (soft delete) para historial
        const { error } = await supabase
            .from('financing_plans')
            .delete() // Usamos delete físico por simplicidad inicial, o cambiar a update activo=false
            .eq('id', id);

        if (error) throw error;
    }

    // --- CONFIGURACIÓN GLOBAL DE PAGOS ---

    async updatePaymentSettings(companyId: string, settings: Partial<PaymentSettings>) {
        // Upsert basado en company_id
        const { data, error } = await supabase
            .from('payment_settings')
            .upsert({
                company_id: companyId,
                ...settings,
                updated_at: new Date().toISOString()
            }, { onConflict: 'company_id' })
            .select()
            .single();

        if (error) throw error;
        return data;
    }
    async updateFinancingPlansOrder(items: { id: string, orden: number }[]) {
        // Usamos Promise.all para actualizaciones paralelas ya que upsert requiere todos los campos NOT NULL
        const promises = items.map(item =>
            supabase
                .from('financing_plans')
                .update({
                    orden: item.orden,
                    updated_at: new Date().toISOString()
                })
                .eq('id', item.id)
        );

        const results = await Promise.all(promises);

        // Verificar si hubo algún error en alguna de las promesas
        const error = results.find(r => r.error)?.error;
        if (error) throw error;

        return true;
    }
}

export const pricingService = new PricingService();
