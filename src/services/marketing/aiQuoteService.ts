
import { pricingService } from '../pricing';
import { cotizacionesService } from '../cotizaciones';
import { pdfService } from '../pdfService';
import { supabase } from '../supabase';
import type { ModuloAdicional } from '../../types/cotizaciones';

export interface AiQuoteTrigger {
    dte_volume: number;
    plan_id?: string;
    modules?: string[];
    include_imp?: boolean;
    lead_id: string;
    conversation_id: string;
    company_id: string;
}

export const aiQuoteService = {
    /**
     * Processes a trigger from the AI to generate a real quote.
     */
    async processAiQuote(trigger: AiQuoteTrigger) {
        try {
            console.log('AI Trigger received:', trigger);

            // 1. Get Pricing Configuration
            const config = await pricingService.getPricingConfig();

            // 2. Select Plan based on DTEs or ID
            let selectedItem = config.planes.find(p => p.id === trigger.plan_id);
            if (!selectedItem) {
                const planResult = await pricingService.getPlanByDTEs(trigger.dte_volume);
                if (planResult) selectedItem = planResult;
            }

            if (!selectedItem) {
                throw new Error(`No se encontró un plan adecuado para ${trigger.dte_volume} DTEs`);
            }

            // 3. Map Modules (Advanced AI Matching)
            // The AI might send IDs "MOD_CXC" or simple names "Compras". We try to match both.
            const requestedModules = trigger.modules || [];
            const selectedModulesItems = config.modulos.filter(m => {
                const search = requestedModules.map(rm => rm.toLowerCase());
                return search.some(s =>
                    m.id?.toLowerCase() === s ||
                    m.nombre.toLowerCase().includes(s) ||
                    m.codigo?.toLowerCase() === s
                );
            });

            const modulosAdicionales: ModuloAdicional[] = selectedModulesItems.map(m => ({
                nombre: m.nombre,
                costo_anual: m.precio_anual,
                costo_mensual: m.precio_mensual,
                descripcion: m.descripcion
            }));


            // 4. Calculate Totals using core logic
            const totals = cotizacionesService.calcularTotales({
                volumen_dtes: trigger.dte_volume,
                plan_nombre: selectedItem.nombre,
                costo_plan_anual: selectedItem.precio_anual,
                costo_plan_mensual: selectedItem.precio_mensual,
                costo_implementacion: selectedItem.costo_unico || 0,
                incluir_implementacion: trigger.include_imp ?? true,
                modulos_adicionales: modulosAdicionales,
                servicio_whatsapp: trigger.modules?.includes('whatsapp') || false,
                servicio_personalizacion: false
            });

            // 5. Create the Quote in DB with real lead name
            const { data: leadData } = await supabase.from('leads').select('name').eq('id', trigger.lead_id).single();

            const newQuote = await cotizacionesService.createCotizacion({
                company_id: trigger.company_id,
                lead_id: trigger.lead_id,
                nombre_cliente: leadData?.name || 'Cliente de AI',
                volumen_dtes: trigger.dte_volume,
                plan_nombre: selectedItem.nombre,
                costo_plan_anual: selectedItem.precio_anual,
                costo_plan_mensual: selectedItem.precio_mensual,
                costo_implementacion: selectedItem.costo_unico || 0,
                incluir_implementacion: trigger.include_imp ?? true,
                modulos_adicionales: modulosAdicionales,
                servicio_whatsapp: trigger.modules?.includes('whatsapp') || false,
                costo_whatsapp: totals.costo_whatsapp,
                servicio_personalizacion: false,
                costo_personalizacion: totals.costo_personalizacion,
                subtotal_anual: totals.subtotal_anual,
                subtotal_mensual: totals.subtotal_mensual,
                descuento_porcentaje: 0,
                descuento_monto: totals.descuento_monto,
                iva_porcentaje: totals.iva_porcentaje,
                iva_monto: totals.iva_monto,
                total_anual: totals.total_anual,
                total_mensual: totals.total_mensual,
                estado: 'enviada'
            });

            // 6. Generate PDF
            console.log('Generating PDF for auto-quote...');
            const pdfUrl = await pdfService.generateAndUploadQuotePDF(newQuote);

            // 7. Do NOT send automatically here, return the quote and PDF info 
            // so the UI can show it for review or send it if preferred.
            console.log('AI: Quote generated successfully:', newQuote.id);

            return {
                success: true,
                quoteId: newQuote.id,
                pdfUrl,
                quote: newQuote
            };

        } catch (error) {
            console.error('Error in processAiQuote:', error);
            throw error;
        }
    }
};
