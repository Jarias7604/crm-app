
import { pricingService } from '../pricing';
import { cotizacionesService } from '../cotizaciones';
import { pdfService } from '../pdfService';
import { supabase } from '../supabase';
import type { ModuloAdicional } from '../../types/cotizaciones';

export interface AiQuoteTrigger {
    dte_volume: number;
    plan_id?: string;
    modules?: string[]
    include_imp?: boolean;
    lead_id: string;
    conversation_id: string;
    company_id: string;
    /** Optional: explicit plan IDs [planPedido, planAlternativo].
     *  If omitted, the service will auto-find a complementary plan. */
    comparison_plan_ids?: string[];
}

export const aiQuoteService = {
    /**
     * Processes a trigger from the AI to generate a real quote.
     * Automatically includes a comparative plan so the lead can see both options.
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

            // 5. Resolve comparative plans ─────────────────────────────────────
            // If the caller already specified which plans to compare, use those.
            // Otherwise, auto-find an "opposite type" companion plan:
            //   • Selected plan is monthly (cuotas > 1)  → find a single-payment plan
            //   • Selected plan is one-time (cuotas === 1)  → find the cheapest monthly plan
            let planesComparativaIds: string[] = [];

            if (trigger.comparison_plan_ids && trigger.comparison_plan_ids.length >= 1) {
                // Caller explicitly provided plans: just use them as-is
                planesComparativaIds = trigger.comparison_plan_ids;
                // Ensure the triggered plan is always the first (= "lo que pidió")
                if (selectedItem.id && !planesComparativaIds.includes(selectedItem.id)) {
                    planesComparativaIds = [selectedItem.id, ...planesComparativaIds];
                }
            } else if (selectedItem.id) {
                // Auto-detect: query active financing_plans for the companion
                const { data: allFinancingPlans } = await supabase
                    .from('financing_plans')
                    .select('id, titulo, cuotas, meses, tipo_ajuste, activo')
                    .eq('activo', true)
                    .order('cuotas', { ascending: true });

                if (allFinancingPlans && allFinancingPlans.length > 1) {
                    const selectedFP = allFinancingPlans.find(p => p.id === selectedItem!.id);
                    const isMonthly = selectedFP ? (Number(selectedFP.cuotas) || Number(selectedFP.meses) || 1) > 1 : true;

                    // Find a plan of the opposite type
                    const companion = allFinancingPlans.find(p => {
                        if (p.id === selectedItem!.id) return false;
                        const pCuotas = Number(p.cuotas) || Number(p.meses) || 1;
                        // Prefer opposite payment type
                        return isMonthly ? pCuotas <= 1 : pCuotas > 1;
                    });

                    if (companion) {
                        // Order: [lo que pidió, alternativa/recomendada]
                        planesComparativaIds = [selectedItem.id, companion.id];
                    } else {
                        // No opposite found — just use the selected plan alone
                        planesComparativaIds = [selectedItem.id];
                    }
                } else if (selectedItem.id) {
                    planesComparativaIds = [selectedItem.id];
                }
            }

            // Also fetch the full FinancingPlan objects for the PDF
            let allPlansForPDF: any[] = [];
            if (planesComparativaIds.length > 0) {
                const { data: fpData } = await supabase
                    .from('financing_plans')
                    .select('id, titulo, descripcion, cuotas, meses, interes_porcentaje, tipo_ajuste, es_popular, show_breakdown')
                    .in('id', planesComparativaIds)
                    .eq('activo', true);

                if (fpData && fpData.length > 0) {
                    // Preserve the order of planesComparativaIds
                    allPlansForPDF = planesComparativaIds
                        .map(pid => fpData.find(p => p.id === pid))
                        .filter(Boolean);
                }
            }

            // 6. Create the Quote in DB with real lead name
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
                estado: 'enviada',
                // ✅ Save comparative plan IDs so the public link shows both plans
                ...(planesComparativaIds.length > 0 ? { planes_comparativa: planesComparativaIds } : {})
            } as any);

            // 7. Find the primary financing plan object (first plan = lo que pidió)
            const primaryPlan = allPlansForPDF[0] || null;

            // 8. Generate PDF with both plans ────────────────────────────────────
            console.log('Generating comparative PDF for auto-quote...');
            const pdfUrl = await pdfService.generateAndUploadQuotePDF(
                newQuote,
                primaryPlan,
                allPlansForPDF.length > 0 ? allPlansForPDF : undefined
            );

            console.log('AI: Quote generated with comparative plans:', planesComparativaIds);

            return {
                success: true,
                quoteId: newQuote.id,
                pdfUrl,
                quote: newQuote,
                planesComparativa: planesComparativaIds
            };

        } catch (error) {
            console.error('Error in processAiQuote:', error);
            throw error;
        }
    }
};
