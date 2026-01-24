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

    calcularTotales(params: {
        volumen_dtes: number;
        plan_nombre: string;
        costo_plan_anual: number;
        costo_plan_mensual: number;
        costo_implementacion: number;
        incluir_implementacion: boolean;
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
            incluir_implementacion,
            modulos_adicionales,
            servicio_whatsapp,
            servicio_personalizacion,
            descuento_porcentaje = 0,
            iva_porcentaje = 13
        } = params;

        // 1. CALCULOS ANUALES (Pago Único Frontal)
        const modulos_anual = modulos_adicionales.reduce((sum, m) => sum + m.costo_anual, 0);
        const costo_whatsapp_anual = servicio_whatsapp ? volumen_dtes * 0.025 : 0;
        const costo_personalizacion = servicio_personalizacion ? 150 : 0;

        // Implementación condicional
        const implementacion_final = incluir_implementacion ? costo_implementacion : 0;

        // Subtotal Anual incluye TODO (Plan + Implementación + Módulos + Servicios extra)
        const subtotal_anual = costo_plan_anual + implementacion_final + modulos_anual + costo_whatsapp_anual + costo_personalizacion;

        // Descuento sobre el subtotal anual
        const descuento_monto_anual = (subtotal_anual * descuento_porcentaje) / 100;
        const base_para_iva_anual = subtotal_anual - descuento_monto_anual;

        const iva_monto_anual = (base_para_iva_anual * iva_porcentaje) / 100;
        const total_anual = base_para_iva_anual + iva_monto_anual;

        // 2. CALCULOS MENSUALES (Recurrencia Mensual)
        const modulos_mensual = modulos_adicionales.reduce((sum, m) => sum + m.costo_mensual, 0);
        const costo_whatsapp_mensual = (servicio_whatsapp ? (volumen_dtes * 0.025) : 0) / 12;

        // La cuota mensual recurrente NO incluye la implementación ni personalización (que son pagos únicos)
        const subtotal_mensual_recurrente = costo_plan_mensual + modulos_mensual + costo_whatsapp_mensual;

        // Descuento sobre la cuota mensual
        const descuento_mensual = (subtotal_mensual_recurrente * descuento_porcentaje) / 100;
        const base_para_iva_mensual = subtotal_mensual_recurrente - descuento_mensual;

        const iva_mensual = (base_para_iva_mensual * iva_porcentaje) / 100;
        const cuota_mensual = base_para_iva_mensual + iva_mensual;

        return {
            subtotal_anual: Number(subtotal_anual.toFixed(2)),
            subtotal_mensual: Number(subtotal_mensual_recurrente.toFixed(2)),
            descuento_monto: Number(descuento_monto_anual.toFixed(2)),
            iva_monto: Number(iva_monto_anual.toFixed(2)),
            total_anual: Number(total_anual.toFixed(2)),
            total_mensual: Number(cuota_mensual.toFixed(2)), // AHORA: Valor de una sola cuota mensual recurrente
            costo_whatsapp: Number(costo_whatsapp_anual.toFixed(2)),
            costo_personalizacion,
            iva_porcentaje
        };
    }
}

export const cotizacionesService = new CotizacionesService();
