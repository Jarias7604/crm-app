import { supabase } from './supabase';
import type { Cotizacion, ModuloAdicional } from '../types/cotizaciones';

class CotizacionesService {
    // Crear una nueva cotización
    async createCotizacion(cotizacion: Omit<Cotizacion, 'id' | 'created_at' | 'updated_at'>) {
        const { data: { user } } = await supabase.auth.getUser();

        const { data, error } = await supabase
            .from('cotizaciones')
            .insert({
                ...cotizacion,
                created_by: user?.id,
                modulos_adicionales: JSON.stringify(cotizacion.modulos_adicionales)
            })
            .select()
            .single();

        if (error) throw error;

        // Parse modulos back to array
        if (data) {
            data.modulos_adicionales = typeof data.modulos_adicionales === 'string'
                ? JSON.parse(data.modulos_adicionales)
                : data.modulos_adicionales;
        }

        return data;
    }

    // Obtener todas las cotizaciones de la compañía
    async getCotizaciones(companyId: string) {
        const { data, error } = await supabase
            .from('cotizaciones')
            .select(`
                *,
                lead:leads(id, name, email),
                creator:profiles!created_by(full_name, email, avatar_url)
            `)
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Parse modulos_adicionales for each cotizacion
        return data?.map((cot: any) => ({
            ...cot,
            modulos_adicionales: typeof cot.modulos_adicionales === 'string'
                ? JSON.parse(cot.modulos_adicionales)
                : (cot.modulos_adicionales || [])
        })) || [];
    }

    // Obtener cotizaciones de un lead específico
    async getCotizacionesByLead(leadId: string) {
        const { data, error } = await supabase
            .from('cotizaciones')
            .select('*')
            .eq('lead_id', leadId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return data?.map((cot: any) => ({
            ...cot,
            modulos_adicionales: typeof cot.modulos_adicionales === 'string'
                ? JSON.parse(cot.modulos_adicionales)
                : (cot.modulos_adicionales || [])
        })) || [];
    }

    // Obtener una cotización por ID
    async getCotizacion(id: string) {
        const { data, error } = await supabase
            .from('cotizaciones')
            .select(`
                *,
                lead:leads(id, name, email, company_name, phone),
                creator:profiles!created_by(full_name, email, avatar_url),
                company:companies(id, name, logo_url, website, address, phone)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        if (data) {
            data.modulos_adicionales = typeof data.modulos_adicionales === 'string'
                ? JSON.parse(data.modulos_adicionales)
                : (data.modulos_adicionales || []);
        }

        return data;
    }

    // Actualizar cotización
    async updateCotizacion(id: string, updates: Partial<Cotizacion>) {
        const updateData: any = { ...updates };

        if (updates.modulos_adicionales) {
            updateData.modulos_adicionales = JSON.stringify(updates.modulos_adicionales);
        }

        const { data, error } = await supabase
            .from('cotizaciones')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        if (data) {
            data.modulos_adicionales = typeof data.modulos_adicionales === 'string'
                ? JSON.parse(data.modulos_adicionales)
                : data.modulos_adicionales;
        }

        return data;
    }

    // Eliminar cotización
    async deleteCotizacion(id: string) {
        const { error } = await supabase
            .from('cotizaciones')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }

    // Cambiar estado de cotización
    async updateEstado(id: string, estado: Cotizacion['estado']) {
        return this.updateCotizacion(id, { estado });
    }

    // Obtener estadísticas de cotizaciones
    async getStats(companyId: string) {
        const { data, error } = await supabase
            .from('cotizaciones')
            .select('estado, total_anual')
            .eq('company_id', companyId);

        if (error) throw error;

        const stats = {
            total: data?.length || 0,
            borrador: 0,
            enviadas: 0,
            aceptadas: 0,
            rechazadas: 0,
            valor_total: 0,
            valor_aceptadas: 0
        };

        data?.forEach((cot: any) => {
            if (cot.estado === 'borrador') stats.borrador++;
            if (cot.estado === 'enviada') stats.enviadas++;
            if (cot.estado === 'aceptada') stats.aceptadas++;
            if (cot.estado === 'rechazada') stats.rechazadas++;

            stats.valor_total += Number(cot.total_anual) || 0;
            if (cot.estado === 'aceptada') {
                stats.valor_aceptadas += Number(cot.total_anual) || 0;
            }
        });

        return stats;
    }

    // Calcular totales de una cotización
    calcularTotales(params: {
        volumen_dtes: number;
        plan_nombre: string;
        costo_plan_anual: number;
        costo_plan_mensual: number;
        costo_implementacion: number;
        modulos_adicionales: ModuloAdicional[];
        servicio_whatsapp: boolean;
        servicio_personalizacion: boolean;
        descuento_porcentaje?: number;
        iva_porcentaje?: number;
    }) {
        const {
            volumen_dtes,
            costo_plan_anual,
            costo_plan_mensual,
            costo_implementacion,
            modulos_adicionales,
            servicio_whatsapp,
            servicio_personalizacion,
            descuento_porcentaje = 0,
            iva_porcentaje = 13
        } = params;

        // Calcular costos de módulos
        const modulos_anual = modulos_adicionales.reduce((sum, m) => sum + m.costo_anual, 0);
        const modulos_mensual = modulos_adicionales.reduce((sum, m) => sum + m.costo_mensual, 0);

        // Calcular WhatsApp (por DTE)
        const costo_whatsapp = servicio_whatsapp ? volumen_dtes * 0.025 : 0;

        // Personalización (costo único)
        const costo_personalizacion = servicio_personalizacion ? 150 : 0;

        // Subtotales
        const subtotal_anual = costo_plan_anual + costo_implementacion + modulos_anual + costo_whatsapp + costo_personalizacion;
        const subtotal_mensual = (costo_plan_mensual * 12) + costo_implementacion + (modulos_mensual * 12) + costo_whatsapp + costo_personalizacion;

        // Descuento
        const descuento_monto = (subtotal_anual * descuento_porcentaje) / 100;
        const subtotal_con_descuento = subtotal_anual - descuento_monto;

        // IVA
        const iva_monto = (subtotal_con_descuento * iva_porcentaje) / 100;

        // Totales finales
        const total_anual = subtotal_con_descuento + iva_monto;
        const total_mensual = (subtotal_mensual - (subtotal_mensual * (descuento_porcentaje / 100))) + iva_monto;

        return {
            subtotal_anual: Number(subtotal_anual.toFixed(2)),
            subtotal_mensual: Number(subtotal_mensual.toFixed(2)),
            descuento_monto: Number(descuento_monto.toFixed(2)),
            iva_monto: Number(iva_monto.toFixed(2)),
            total_anual: Number(total_anual.toFixed(2)),
            total_mensual: Number(total_mensual.toFixed(2)),
            costo_whatsapp: Number(costo_whatsapp.toFixed(2)),
            costo_personalizacion,
            iva_porcentaje
        };
    }
}

export const cotizacionesService = new CotizacionesService();
