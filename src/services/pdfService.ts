import { jsPDF } from 'jspdf';
import { supabase } from './supabase';
import { format } from 'date-fns';
import { calculateQuoteFinancialsV2, parseModules, type CotizacionData } from '../utils/quoteUtils';
import { imageCache } from '../utils/imageCache';

/**
 * 💎 PREMIUM PDF SERVICE - ARIAS DEFENSE EDITION
 * -----------------------------------------
 * Optimized for speed, horizontal layout, and dedicated T&C page.
 */
type PlanForPDF = {
    titulo?: string;
    descripcion?: string;
    cuotas?: number;
    meses?: number;
    interes_porcentaje?: number;
    tipo_ajuste?: 'discount' | 'recharge' | 'none';
    es_popular?: boolean;
    show_breakdown?: boolean;
};

export const pdfService = {
    async generateAndUploadQuotePDF(
        cotizacion: CotizacionData,
        clientSelectedPlan?: PlanForPDF | null,
        allPlansForComparison?: PlanForPDF[]
    ): Promise<string> {
        try {
            console.log('Generating Optimized Premium PDF...');

            const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 15;

            // --- PALETTE ---
            const COLORS = {
                TEXT_DARK: [15, 23, 42],
                BLUE: [37, 99, 235],
                PURPLE: [79, 70, 229],
                ORANGE: [249, 115, 22],
                GREEN: [22, 163, 74],
                SLATE_400: [148, 163, 184],
                SLATE_500: [100, 116, 139],
                SLATE_100: [241, 245, 249],
                WHITE: [255, 255, 255]
            };

            // Load assets in parallel
            const [logoData, avatarData, qrData] = await imageCache.loadImagesParallel([
                cotizacion.company?.logo_url || '',
                cotizacion.creator?.avatar_url || '',
                `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.href)}`
            ]);

            const drawHeader = () => {
                const headerH = 60;
                doc.setFillColor(15, 23, 42); // bg-[#0f172a]
                doc.rect(0, 0, pageWidth, headerH, 'F');

                // Logo
                if (logoData) {
                    doc.addImage(logoData, 'PNG', margin, 10, 22, 22);
                } else {
                    doc.setFillColor(255, 255, 255);
                    doc.circle(margin + 11, 21, 11, 'F');
                }

                // Company Data
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.text((cotizacion.company?.name || 'ARIAS DEFENSE').toUpperCase(), margin, 40);

                doc.setTextColor(42, 171, 238); // C_BLUE_ACCENT
                doc.setFontSize(8);
                doc.text((cotizacion.company?.website || 'WWW.ARIASDEFENSE.COM').toUpperCase(), margin, 45);

                doc.setTextColor(148, 163, 184);
                doc.setFontSize(7);
                doc.setFont('helvetica', 'normal');
                const addr = doc.splitTextToSize((cotizacion.company?.address || '').toUpperCase(), 100);
                doc.text(addr, margin, 50);

                // Right Header
                doc.setTextColor(42, 171, 238);
                doc.setFontSize(7);
                doc.setFont('helvetica', 'bold');
                doc.text('COTIZACIÓN OFICIAL', pageWidth - margin, 12, { align: 'right' });

                doc.setTextColor(255, 255, 255);
                doc.setFontSize(32);
                doc.text(cotizacion.id.slice(0, 8).toUpperCase(), pageWidth - margin, 24, { align: 'right' });

                doc.setDrawColor(51, 65, 85);
                doc.line(pageWidth - margin - 70, 27, pageWidth - margin, 27);

                doc.setTextColor(148, 163, 184);
                doc.setFontSize(6);
                doc.text('FECHA EMISIÓN', pageWidth - margin - 35, 33, { align: 'right' });
                doc.text('REFERENCIA ID', pageWidth - margin, 33, { align: 'right' });

                doc.setTextColor(255, 255, 255);
                doc.setFontSize(8);
                doc.text(format(new Date(cotizacion.created_at || new Date()), 'dd/MM/yyyy'), pageWidth - margin - 35, 38, { align: 'right' });
                doc.text(cotizacion.id.slice(0, 5).toUpperCase(), pageWidth - margin, 38, { align: 'right' });
            };

            const drawFooter = (pageNum: number) => {
                const footerH = 40;
                const fY = pageHeight - footerH;
                doc.setFillColor(248, 250, 252);
                doc.rect(0, fY, pageWidth, footerH, 'F');
                doc.setDrawColor(226, 232, 240);
                doc.line(0, fY, pageWidth, fY);

                // Page Number
                doc.setTextColor(148, 163, 184);
                doc.setFontSize(7);
                doc.text(`Propuesta Comercial | Página ${pageNum}`, pageWidth / 2, pageHeight - 5, { align: 'center' });

                // Agent Info
                const agentS = 16;
                if (avatarData) {
                    doc.addImage(avatarData, 'PNG', margin, fY + 8, agentS, agentS);
                } else {
                    doc.setFillColor(79, 70, 229);
                    doc.rect(margin, fY + 8, agentS, agentS, 'F');
                }

                doc.setTextColor(37, 99, 235);
                doc.setFontSize(6);
                doc.setFont('helvetica', 'bold');
                doc.text('PROPUESTA ELABORADA POR', margin + agentS + 4, fY + 11);
                doc.setTextColor(15, 23, 42);
                doc.setFontSize(10);
                doc.text((cotizacion.creator?.full_name || 'JIMMY ARIAS').toUpperCase(), margin + agentS + 4, fY + 16);
                doc.setTextColor(100, 116, 139);
                doc.setFontSize(7);
                doc.setFont('helvetica', 'normal');
                doc.text(cotizacion.creator?.email || '', margin + agentS + 4, fY + 20);

                // Center QR
                if (qrData) {
                    doc.addImage(qrData, 'PNG', (pageWidth / 2) - 8, fY + 8, 16, 16);
                    doc.setFontSize(5);
                    doc.text('ESCANEA PARA VER ONLINE', pageWidth / 2, fY + 28, { align: 'center' });
                }

                // Company Right
                doc.setTextColor(79, 70, 229);
                doc.setFontSize(7);
                doc.setFont('helvetica', 'bold');
                doc.text(cotizacion.company?.name || '', pageWidth - margin, fY + 12, { align: 'right' });
                doc.setTextColor(100, 116, 139);
                doc.setFontSize(6);
                doc.setFont('helvetica', 'normal');
                doc.text(cotizacion.company?.phone || '', pageWidth - margin, fY + 16, { align: 'right' });
                doc.text(cotizacion.company?.website || '', pageWidth - margin, fY + 20, { align: 'right' });
            };

            // 🎯 BUSCAR DESCRIPCIÓN DEL PLAN (con fallback)
            let planDescription = '';
            if (cotizacion.plan_nombre) {
                // Intento 1: Coincidencia exacta
                const { data: exactItem } = await supabase
                    .from('cotizador_paquetes')
                    .select('descripcion')
                    .eq('paquete', cotizacion.plan_nombre)
                    .eq('cantidad_dtes', cotizacion.volumen_dtes)
                    .not('descripcion', 'is', null)
                    .neq('descripcion', '')
                    .maybeSingle();

                if (exactItem?.descripcion) {
                    planDescription = exactItem.descripcion;
                } else {
                    // Intento 2: Fallback por nombre
                    const { data: fallbackItem } = await supabase
                        .from('cotizador_paquetes')
                        .select('descripcion')
                        .eq('paquete', cotizacion.plan_nombre)
                        .not('descripcion', 'is', null)
                        .neq('descripcion', '')
                        .limit(1)
                        .maybeSingle();

                    if (fallbackItem?.descripcion) {
                        planDescription = fallbackItem.descripcion;
                    }
                }
            }

            // Start Page 1
            drawHeader();

            let currentY = 75;

            // Client Info
            doc.setTextColor(37, 99, 235);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text('CLIENTE RECEPTOR', margin, currentY - 7);
            doc.setTextColor(15, 23, 42);
            doc.setFontSize(26);
            doc.text(cotizacion.nombre_cliente || '', margin, currentY);

            if (cotizacion.empresa_cliente) {
                currentY += 8;
                doc.setTextColor(37, 99, 235);
                doc.setFontSize(10);
                doc.text(cotizacion.empresa_cliente.toUpperCase(), margin, currentY);
            }

            // Summary Box (Floating Right)
            const sX = pageWidth - margin - 65;
            const sY = 75;
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(sX, sY - 10, 65, 25, 3, 3, 'FD');
            doc.setTextColor(100, 116, 139);
            doc.setFontSize(7);
            doc.text('PLAN SELECCIONADO', sX + 32.5, sY - 3, { align: 'center' });
            doc.setTextColor(79, 70, 229);
            doc.setFontSize(14);
            doc.text((cotizacion.plan_nombre || 'PLAN').toUpperCase(), sX + 32.5, sY + 5, { align: 'center' });
            doc.setTextColor(100, 116, 139);
            doc.setFontSize(6);
            doc.text(`${(cotizacion.volumen_dtes || 0).toLocaleString()} DTEs/año`, sX + 32.5, sY + 10, { align: 'center' });

            currentY = Math.max(currentY + 15, sY + 25);

            // Services Table
            doc.setFillColor(241, 245, 249);
            doc.rect(margin, currentY, pageWidth - (margin * 2), 8, 'F');
            doc.setTextColor(148, 163, 184);
            doc.setFontSize(7);
            doc.text('DESCRIPCIÓN DEL SERVICIO', margin + 5, currentY + 5);
            doc.text('INVERSIÓN (USD)', pageWidth - margin - 5, currentY + 5, { align: 'right' });

            currentY += 14;
            const modulos = parseModules(cotizacion.modulos_adicionales);

            const drawRow = (name: string, price: number, isOneTime: boolean = false, description?: string) => {
                doc.setTextColor(15, 23, 42);
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text(name, margin + 5, currentY);

                if (isOneTime) {
                    const tw = doc.getTextWidth(name);
                    doc.setFillColor(255, 237, 213); // bg-orange-100
                    doc.roundedRect(margin + 5 + tw + 3, currentY - 3, 16, 4, 1, 1, 'F');
                    doc.setTextColor(154, 52, 18);
                    doc.setFontSize(5);
                    doc.text('PAGO ÚNICO', margin + 5 + tw + 11, currentY - 0.2, { align: 'center' });
                }

                doc.setTextColor(15, 23, 42);
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text(`$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - margin - 5, currentY, { align: 'right' });

                // Display description if provided
                if (description) {
                    currentY += 4;
                    doc.setTextColor(100, 116, 139); // slate-500
                    doc.setFontSize(7);
                    doc.setFont('helvetica', 'normal');
                    // Split description to fit within available width
                    const maxDescWidth = pageWidth - (margin * 2) - 60;
                    const descLines = doc.splitTextToSize(description, maxDescWidth);
                    descLines.forEach((line: string) => {
                        doc.text(line, margin + 5, currentY);
                        currentY += 3.5;
                    });
                    currentY -= 3.5; // Adjust for the last line
                }

                doc.setDrawColor(241, 245, 249);
                doc.line(margin, currentY + 4, pageWidth - margin, currentY + 4);
                currentY += 12;
            };

            // Main Items
            drawRow(`Licencia Anual ${cotizacion.plan_nombre}`, cotizacion.costo_plan_anual || 0, false, planDescription);
            if (cotizacion.incluir_implementacion) {
                drawRow('Implementación y Configuración', cotizacion.costo_implementacion || 0, true);
            }
            if (cotizacion.servicio_whatsapp) {
                drawRow('Comunicación WhatsApp', cotizacion.costo_whatsapp || 0);
            }
            // ⚠️  BLOQUE CRÍTICO — NO MODIFICAR SIN LEER ESTO ⚠️
            // ─────────────────────────────────────────────────────────────────
            // BUG ORIGINAL (corregido 2026-02-20): Los módulos de "pago único"
            // (Ej: "Sucursal Adicional", "Descarga masiva de JSON") aparecían
            // como $0.00 en el PDF y sin el badge "PAGO ÚNICO".
            //
            // CAUSA: El código anterior usaba `m.costo_anual` para TODOS los
            // módulos. Los ítems de pago único guardan su precio en `m.pago_unico`
            // y tienen `m.costo_anual = 0`, por eso salían en $0.
            //
            // REGLA INVARIABLE:
            //   - Si pago_unico  > 0 → es un ítem de PAGO ÚNICO (implementación, setup, etc.)
            //     → usar m.pago_unico como precio, isOneTime = true → badge "PAGO ÚNICO"
            //   - Si pago_unico == 0 → es un módulo RECURRENTE
            //     → usar m.costo_anual (o m.costo como fallback)
            //
            // Esta misma lógica existe en:
            //   • PublicQuoteView.tsx  (línea ~413)
            //   • CotizacionDetalle.tsx (línea ~477)
            //   • quoteUtils.ts → calculateQuoteFinancialsV2 (línea ~186)
            // Cualquier cambio aquí DEBE replicarse en esos 3 archivos también.
            // ─────────────────────────────────────────────────────────────────
            modulos.forEach((m: any) => {
                const pagoUnicoMonto = Number(m.pago_unico) || 0;
                const costoAnual = Number(m.costo_anual) || Number(m.costo) || 0;
                const isOneTime = pagoUnicoMonto > 0;                   // ← NO CAMBIAR esta lógica
                const currentCosto = isOneTime ? pagoUnicoMonto : costoAnual; // ← NI esta
                drawRow(m.nombre, currentCosto, isOneTime, m.descripcion);
            });
            // ─────────────────────────────────────────────────────────────────


            // ==========================================
            // HORIZONTAL TOTALS - 3 COLUMNS
            // ==========================================
            // 🎯 CARGAR PLAN DE FINANCIAMIENTO PARA CÁLCULOS CORRECTOS
            const cuotasVal = Number(cotizacion.cuotas);
            const plazoVal = Number(cotizacion.plazo_meses) || 0;
            let numCuotas = 1;
            if (!isNaN(cuotasVal) && cuotasVal >= 1) {
                numCuotas = cuotasVal;
            } else if (plazoVal > 1) {
                numCuotas = plazoVal;
            }

            // 🎯 PLAN DE FINANCIAMIENTO — usar el elegido por el prospecto si está disponible
            const companyId = (cotizacion as any).company_id || (cotizacion.company as any)?.id;
            let financingPlan: { titulo?: string; descripcion?: string; interes_porcentaje?: number; tipo_ajuste?: 'discount' | 'recharge' | 'none' } | undefined;

            if (clientSelectedPlan) {
                // Usar el plan que el prospecto eligió en la vista web
                financingPlan = clientSelectedPlan;
                console.log('[PDF] Plan elegido por prospecto:', clientSelectedPlan.titulo);
            } else if (numCuotas && companyId) {
                // Fallback: buscar en BD el plan que corresponde al plan guardado
                const { data: planData } = await supabase
                    .from('financing_plans')
                    .select('titulo, descripcion, interes_porcentaje, tipo_ajuste')
                    .or(`company_id.eq.${companyId},company_id.is.null`)
                    .eq('cuotas', numCuotas)
                    .eq('activo', true)
                    .order('company_id', { ascending: false, nullsFirst: false })
                    .limit(1)
                    .maybeSingle();

                if (planData) {
                    financingPlan = planData;
                    console.log('[PDF] Plan de financiamiento encontrado:', planData.titulo, 'Interés:', planData.interes_porcentaje);
                }
            }

            // 🎯 CARGAR TODOS LOS PLANES para comparativa si no se pasaron
            let allPlans = allPlansForComparison || [];
            if (allPlans.length === 0 && companyId) {
                const { data: plansData } = await supabase
                    .from('financing_plans')
                    .select('titulo, descripcion, cuotas, interes_porcentaje, tipo_ajuste, es_popular')
                    .eq('company_id', companyId)
                    .eq('activo', true)
                    .order('meses', { ascending: true });
                if (plansData && plansData.length > 0) allPlans = plansData;
            }

            // 🎯 USAR FUNCIÓN CENTRALIZADA PARA CÁLCULOS CON EL PLAN
            const financialsV2 = calculateQuoteFinancialsV2(cotizacion, financingPlan);
            const {
                cuotas: divisor,
                isPagoUnico,
                licenciaAnual: subtotalRecurrenteBase,
                ivaPct,
                ajustePct,
                recargoMonto: recargoFinanciamiento,
                ivaLicencia: ivaRecurrente,
                totalLicencia,
                cuotaMensual,
                totalImplementacion: pagoInicial,
                planTitulo,
                planDescripcion,
                descuentoManualPct,
                descuentoManualMonto
            } = financialsV2;

            // Adaptar al formato que espera el código del PDF
            const financials = {
                pagoInicial,
                totalAnual: totalLicencia,
                cuotaMensual,
                montoPeriodo: totalLicencia,
                isMonthly: !isPagoUnico,
                plazoMeses: divisor,
                ivaPct,
                ajustePct,
                subtotalRecurrenteBase,
                recargoFinanciamiento,
                ivaRecurrente
            };

            const boxW = 89;
            const gap = 2;
            let bx = margin;
            let by = currentY + 10;

            if (by + 50 > pageHeight - 40) {
                doc.addPage();
                by = 20;
            }

            const drawBox = (x: number, y: number, title: string, subtitle: string, mainValue: number, _footerValue: number, color: number[], isRecurrent: boolean = false) => {
                // Calcular número de items para determinar altura dinámica
                const modulosArr = parseModules(cotizacion.modulos_adicionales);
                const serviciosUnicos = modulosArr.filter((m: any) => (Number(m.pago_unico) || 0) > 0);
                const serviciosRec = modulosArr.filter((m: any) => (Number(m.pago_unico) || 0) === 0 && ((Number(m.costo_anual) || Number(m.costo) || 0) > 0));
                const costoWhatsApp = cotizacion.servicio_whatsapp ? (Number(cotizacion.costo_whatsapp) || 0) : 0;
                const implementacionBase = Number(cotizacion.costo_implementacion) || 0;

                // Calcular número de líneas que se van a dibujar
                let numLineasInicial = (implementacionBase > 0 ? 1 : 0) + serviciosUnicos.length + 1; // +1 para IVA
                let numLineasRecurrente = 1 + serviciosRec.length + (costoWhatsApp > 0 ? 1 : 0) + (financials.recargoFinanciamiento > 0 ? 1 : 0) + (descuentoManualMonto > 0 ? 1 : 0) + 1 + 1; // Licencia + módulos + WhatsApp + Financiamiento + Descuento + IVA + Total Plan

                const numLineas = isRecurrent ? numLineasRecurrente : numLineasInicial;
                const lineHeight = 4;
                const headerHeight = 16; // Espacio para título y subtítulo
                const footerHeight = 20; // Espacio para el monto principal
                const h = Math.max(50, headerHeight + (numLineas * lineHeight) + footerHeight);

                // Manual Alpha Blending (Base 255 for White background)
                const r5 = Math.floor(255 - (255 - color[0]) * 0.05);
                const g5 = Math.floor(255 - (255 - color[1]) * 0.05);
                const b5 = Math.floor(255 - (255 - color[2]) * 0.05);

                const r15 = Math.floor(255 - (255 - color[0]) * 0.15);
                const g15 = Math.floor(255 - (255 - color[1]) * 0.15);
                const b15 = Math.floor(255 - (255 - color[2]) * 0.15);

                // 1. Box Body
                doc.setFillColor(r5, g5, b5);
                doc.roundedRect(x, y, boxW, h, 3, 3, 'F');
                doc.setDrawColor(r15, g15, b15);
                doc.roundedRect(x, y, boxW, h, 3, 3, 'D');

                // 2. Accent Bar
                doc.setFillColor(color[0], color[1], color[2]);
                doc.roundedRect(x, y, 1.5, h, 1, 1, 'F');

                // 3. Header Text
                doc.setTextColor(color[0], color[1], color[2]);
                doc.setFontSize(8.5);
                doc.setFont('helvetica', 'bold');
                doc.text(title.toUpperCase(), x + 7, y + 8);

                doc.setTextColor(148, 163, 184);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(5.5);
                doc.text(subtitle.toUpperCase(), x + 7, y + 12);

                // 4. Breakdown
                doc.setTextColor(148, 163, 184);
                doc.setFontSize(5.5);
                doc.setFont('helvetica', 'normal');

                let finalLineY = y + 18; // Guardar la última posición Y

                if (title.includes('INICIAL')) {
                    // Desglose de pagos únicos
                    let lineY = y + 18;

                    if (implementacionBase > 0) {
                        doc.text('Implementación', x + 7, lineY);
                        doc.text(`$${implementacionBase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, x + boxW - 7, lineY, { align: 'right' });
                        lineY += lineHeight;
                    }

                    serviciosUnicos.forEach((serv: any) => {
                        const monto = Number(serv.pago_unico) || 0;
                        doc.text(serv.nombre.substring(0, 18), x + 7, lineY);
                        doc.text(`$${monto.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, x + boxW - 7, lineY, { align: 'right' });
                        lineY += lineHeight;
                    });

                    const subtotalIni = pagoInicial / (1 + financials.ivaPct);
                    const ivaIni = pagoInicial - subtotalIni;

                    doc.text(`IVA (${Math.round(financials.ivaPct * 100)}%)`, x + 7, lineY);
                    doc.setTextColor(color[0], color[1], color[2]);
                    doc.text(`+$ ${ivaIni.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, x + boxW - 7, lineY, { align: 'right' });

                    doc.setDrawColor(r15, g15, b15);
                    doc.setLineWidth(0.1);
                    doc.line(x + 7, lineY + 2, x + boxW - 7, lineY + 2);

                    finalLineY = lineY + 4;
                } else {
                    // Desglose de recurrentes
                    const licenciaBase = Number(cotizacion.costo_plan_anual) || 0;

                    let lineY = y + 18;

                    // Licencia
                    doc.text(`Licencia ${cotizacion.plan_nombre}`, x + 7, lineY);
                    doc.text(`$${licenciaBase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, x + boxW - 7, lineY, { align: 'right' });
                    lineY += lineHeight;

                    // Módulos recurrentes
                    serviciosRec.forEach((serv: any) => {
                        const monto = Number(serv.costo_anual) || Number(serv.costo) || 0;
                        doc.text(serv.nombre.substring(0, 18), x + 7, lineY);
                        doc.text(`$${monto.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, x + boxW - 7, lineY, { align: 'right' });
                        lineY += lineHeight;
                    });

                    // WhatsApp
                    if (costoWhatsApp > 0) {
                        doc.text('WhatsApp', x + 7, lineY);
                        doc.text(`$${costoWhatsApp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, x + boxW - 7, lineY, { align: 'right' });
                        lineY += lineHeight;
                    }

                    const { recargoFinanciamiento, ivaRecurrente } = financials;

                    if (recargoFinanciamiento > 0) {
                        const pctLabel = financials.ajustePct ? ` (${Math.round(financials.ajustePct * 100)}%)` : '';
                        doc.text(`Financiamiento${pctLabel}`, x + 7, lineY);
                        doc.text(`+$ ${recargoFinanciamiento.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, x + boxW - 7, lineY, { align: 'right' });
                        lineY += lineHeight;
                    }

                    // Descuento manual del agente
                    if (descuentoManualMonto > 0) {
                        doc.setTextColor(22, 163, 74); // green-600
                        doc.text(`Descuento (${descuentoManualPct}%)`, x + 7, lineY);
                        doc.text(`-$ ${descuentoManualMonto.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, x + boxW - 7, lineY, { align: 'right' });
                        doc.setTextColor(148, 163, 184); // volver a gris
                        lineY += lineHeight;
                    }

                    doc.text(`IVA (${Math.round(financials.ivaPct * 100)}%)`, x + 7, lineY);
                    doc.setTextColor(color[0], color[1], color[2]);
                    doc.text(`+$ ${ivaRecurrente.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, x + boxW - 7, lineY, { align: 'right' });

                    doc.setDrawColor(r15, g15, b15);
                    doc.setLineWidth(0.1);
                    doc.line(x + 7, lineY + 2, x + boxW - 7, lineY + 2);

                    lineY += 5;

                    doc.setTextColor(51, 65, 85);
                    doc.setFontSize(6);
                    doc.setFont('helvetica', 'bold');
                    const totalPlanLabel = `Total Plan (${divisor} ${divisor === 1 ? 'Cuota' : 'Cuotas'})`;
                    doc.text(totalPlanLabel, x + 7, lineY);
                    doc.text(`$${(mainValue * divisor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, x + boxW - 7, lineY, { align: 'right' });

                    finalLineY = lineY + 4;
                }

                // 5. Main Highlight - Posición dinámica basada en el contenido
                doc.setTextColor(51, 65, 85);
                doc.setFontSize(7);
                doc.setFont('helvetica', 'bold');

                const highlightY = finalLineY + 3;
                const tLabel = isRecurrent
                    ? (divisor > 1 ? `CUOTA DE ${divisor}` : 'TOTAL ANUAL')
                    : 'TOTAL A PAGAR HOY';

                doc.text(tLabel, x + 7, highlightY);

                doc.setTextColor(color[0], color[1], color[2]);
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                const tText = `$${mainValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                doc.text(tText, x + boxW - 7, highlightY, { align: 'right' });

                if (isRecurrent) {
                    doc.setFontSize(4.5);
                    doc.setTextColor(148, 163, 184);
                    doc.setFont('helvetica', 'italic');
                    doc.text('* Plan de pagos consecutivos.', x + boxW / 2, highlightY + 4, { align: 'center' });
                }
            };

            // ── COMPARATIVA DE PLANES DE PAGO ────────────────────────────────────
            doc.setTextColor(99, 102, 241);
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'bold');
            doc.text('PLANES DE PAGO', margin, by - 2);

            if (allPlans.length >= 2) {
                // ── MODO COMPARATIVO: 2 columnas, tarjetas completas ─────────────
                const numCols = Math.min(allPlans.length, 2);
                const totalW = pageWidth - (margin * 2);
                const colW = (totalW - 4) / numCols;
                const colH = 82; // Taller card for full breakdown

                allPlans.slice(0, numCols).forEach((plan: PlanForPDF, idx: number) => {
                    const colX = margin + idx * (colW + 4);
                    const colY = by + 1;

                    const planCuotas = Number(plan.cuotas) || 1;
                    const cotizacionForPlan = { ...cotizacion, cuotas: planCuotas, plazo_meses: planCuotas };
                    const pf = calculateQuoteFinancialsV2(cotizacionForPlan, plan);
                    const isMainPlan = idx === 0; // First plan = LO QUE PIDIÓ (active)
                    const displayAmt = pf.isPagoUnico ? pf.totalLicencia : pf.cuotaMensual;
                    const licenciaBase = Number(cotizacion.costo_plan_anual) || 0;

                    // ── Box background & border ──
                    if (isMainPlan) {
                        doc.setFillColor(238, 242, 255); // indigo-50
                        doc.setDrawColor(99, 102, 241);  // indigo-500
                        doc.setLineWidth(0.5);
                    } else {
                        doc.setFillColor(248, 250, 252); // slate-50
                        doc.setDrawColor(226, 232, 240);
                        doc.setLineWidth(0.3);
                    }
                    doc.roundedRect(colX, colY, colW, colH, 3, 3, 'FD');

                    // ── Left accent bar ──
                    doc.setFillColor(isMainPlan ? 99 : 148, isMainPlan ? 102 : 163, isMainPlan ? 241 : 184);
                    doc.roundedRect(colX, colY, 2, colH, 1, 1, 'F');

                    // ── Badge ──────────────────────────────────────────────────────
                    let textY = colY + 8;
                    if (numCols >= 2 && idx === 0) {
                        doc.setFillColor(249, 115, 22); // orange
                        doc.roundedRect(colX + 5, colY + 3, 24, 5, 1.5, 1.5, 'F');
                        doc.setTextColor(255, 255, 255);
                        doc.setFontSize(4.5);
                        doc.setFont('helvetica', 'bold');
                        doc.text('LO QUE PIDI\u00d3', colX + 17, colY + 6.5, { align: 'center' });
                        textY = colY + 13;
                    } else if (idx === 1) {
                        doc.setFillColor(99, 102, 241); // indigo
                        doc.roundedRect(colX + 5, colY + 3, 28, 5, 1.5, 1.5, 'F');
                        doc.setTextColor(255, 255, 255);
                        doc.setFontSize(4.5);
                        doc.setFont('helvetica', 'bold');
                        doc.text('\u2605 RECOMENDADO', colX + 19, colY + 6.5, { align: 'center' });
                        textY = colY + 13;
                    }

                    // ── Plan title ──────────────────────────────────────────────────
                    doc.setTextColor(isMainPlan ? 67 : 30, isMainPlan ? 56 : 30, isMainPlan ? 202 : 30);
                    doc.setFontSize(9);
                    doc.setFont('helvetica', 'bold');
                    doc.text((plan.titulo || '').toUpperCase(), colX + 5, textY);

                    // ── Description ─────────────────────────────────────────────────
                    doc.setTextColor(148, 163, 184);
                    doc.setFontSize(5.5);
                    doc.setFont('helvetica', 'normal');
                    const descLines = doc.splitTextToSize(plan.descripcion || '', colW - 10);
                    doc.text(descLines[0] || '', colX + 5, textY + 5);

                    // ── Main Amount (large) ─────────────────────────────────────────
                    doc.setTextColor(isMainPlan ? 67 : 15, isMainPlan ? 56 : 23, isMainPlan ? 202 : 42);
                    doc.setFontSize(16);
                    doc.setFont('helvetica', 'bold');
                    doc.text(`$${displayAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, colX + 5, textY + 15);

                    // /cuota & subtitle
                    doc.setFontSize(6);
                    doc.setFont('helvetica', 'normal');
                    if (!pf.isPagoUnico) {
                        doc.setTextColor(148, 163, 184);
                        doc.text('/cuota', colX + 5, textY + 20);
                    }
                    doc.setTextColor(pf.isPagoUnico ? 22 : 37, pf.isPagoUnico ? 163 : 99, pf.isPagoUnico ? 74 : 235);
                    doc.setFontSize(6);
                    doc.text(pf.isPagoUnico ? 'Pago \u00fanico adelantado' : pf.cuotas + ' pagos consecutivos', colX + 5, textY + 25);

                    // ── Separator ───────────────────────────────────────────────────
                    doc.setDrawColor(226, 232, 240);
                    doc.setLineWidth(0.1);
                    doc.line(colX + 5, textY + 28, colX + colW - 5, textY + 28);

                    // ── Breakdown lines ─────────────────────────────────────────────
                    let lineY = textY + 33;
                    const lineH = 5;
                    doc.setFontSize(6);

                    // Licencia
                    doc.setTextColor(100, 116, 139);
                    doc.setFont('helvetica', 'normal');
                    doc.text('Licencia ' + (cotizacion.plan_nombre || ''), colX + 5, lineY);
                    doc.setTextColor(51, 65, 85);
                    doc.setFont('helvetica', 'bold');
                    doc.text(`$${licenciaBase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, colX + colW - 5, lineY, { align: 'right' });
                    lineY += lineH;

                    // Financiamiento (solo si aplica)
                    if (!pf.isPagoUnico && pf.recargoMonto > 0 && (plan.show_breakdown ?? true)) {
                        doc.setTextColor(100, 116, 139);
                        doc.setFont('helvetica', 'normal');
                        doc.text(`Financiamiento ${plan.interes_porcentaje || 0}%`, colX + 5, lineY);
                        doc.setTextColor(249, 115, 22);
                        doc.setFont('helvetica', 'bold');
                        doc.text(`+$${pf.recargoMonto.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, colX + colW - 5, lineY, { align: 'right' });
                        lineY += lineH;
                    }

                    // Descuento
                    if (pf.descuentoManualMonto > 0) {
                        doc.setTextColor(22, 163, 74);
                        doc.setFont('helvetica', 'normal');
                        doc.text(`Descuento (${pf.descuentoManualPct}%)`, colX + 5, lineY);
                        doc.setFont('helvetica', 'bold');
                        doc.text(`-$${pf.descuentoManualMonto.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, colX + colW - 5, lineY, { align: 'right' });
                        lineY += lineH;
                    }

                    // IVA
                    doc.setTextColor(100, 116, 139);
                    doc.setFont('helvetica', 'normal');
                    doc.text(`IVA (${Math.round(pf.ivaPct * 100)}%)`, colX + 5, lineY);
                    doc.setTextColor(isMainPlan ? 67 : 22, isMainPlan ? 56 : 163, isMainPlan ? 202 : 74);
                    doc.setFont('helvetica', 'bold');
                    doc.text(`+$${pf.ivaLicencia.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, colX + colW - 5, lineY, { align: 'right' });
                    lineY += lineH;

                    // Total separator
                    doc.setDrawColor(isMainPlan ? 199 : 226, isMainPlan ? 202 : 232, isMainPlan ? 254 : 240);
                    doc.setLineWidth(0.1);
                    doc.line(colX + 5, lineY - 1, colX + colW - 5, lineY - 1);

                    // Total
                    doc.setTextColor(51, 65, 85);
                    doc.setFontSize(6.5);
                    doc.setFont('helvetica', 'bold');
                    doc.text(`Total (${pf.cuotas} ${pf.cuotas === 1 ? 'cuota' : 'cuotas'})`, colX + 5, lineY + 3);
                    doc.text(`$${pf.totalLicencia.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, colX + colW - 5, lineY + 3, { align: 'right' });

                    // ── Bottom status bar ───────────────────────────────────────────
                    const btnY = colY + colH - 9;
                    doc.setFillColor(isMainPlan ? 99 : 241, isMainPlan ? 102 : 245, isMainPlan ? 241 : 249);
                    doc.roundedRect(colX + 5, btnY, colW - 10, 7, 1.5, 1.5, 'F');
                    doc.setTextColor(isMainPlan ? 255 : 100, isMainPlan ? 255 : 116, isMainPlan ? 255 : 139);
                    doc.setFontSize(5.5);
                    doc.setFont('helvetica', 'bold');
                    doc.text(isMainPlan ? '\u2713 PLAN ACTIVO' : 'ALTERNATIVA', colX + colW / 2, btnY + 4.5, { align: 'center' });
                });

                by += colH + 4;

                // ── PAGO INICIAL — full-width, itemized ──────────────────────────
                if (pagoInicial > 0) {
                    const implementacionBase = Number(cotizacion.costo_implementacion) || 0;
                    const modulosArr = Array.isArray(cotizacion.modulos_adicionales) ? cotizacion.modulos_adicionales : [];
                    const serviciosUnicos = modulosArr.filter((m: any) => (Number(m.pago_unico) || 0) > 0);
                    const subtotalBase = implementacionBase + serviciosUnicos.reduce((s: number, m: any) => s + (Number(m.pago_unico) || 0), 0);
                    const ivaInit = pagoInicial - subtotalBase;
                    const initRowCount = 1 + serviciosUnicos.length + 1; // impl + servicios + IVA
                    const initH = 14 + (initRowCount * 5) + 12;

                    if (by + initH > pageHeight - 40) { drawFooter(1); doc.addPage(); by = 20; }

                    const totalW2 = pageWidth - (margin * 2);
                    doc.setFillColor(255, 247, 237);
                    doc.setDrawColor(253, 186, 116);
                    doc.setLineWidth(0.4);
                    doc.roundedRect(margin, by, totalW2, initH, 3, 3, 'FD');
                    doc.setFillColor(249, 115, 22);
                    doc.roundedRect(margin, by, 2, initH, 1, 1, 'F');

                    doc.setTextColor(249, 115, 22);
                    doc.setFontSize(9);
                    doc.setFont('helvetica', 'bold');
                    doc.text('PAGO INICIAL', margin + 6, by + 8);
                    doc.setTextColor(148, 163, 184);
                    doc.setFontSize(5.5);
                    doc.setFont('helvetica', 'normal');
                    doc.text('Requerido antes de activar', margin + 6, by + 13);

                    let iy = by + 19;
                    const iFontSize = 6.5;

                    if (implementacionBase > 0) {
                        doc.setTextColor(71, 85, 105);
                        doc.setFontSize(iFontSize);
                        doc.setFont('helvetica', 'normal');
                        doc.text('Implementaci\u00f3n', margin + 6, iy);
                        doc.setFont('helvetica', 'bold');
                        doc.text(`$${implementacionBase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, margin + totalW2 - 6, iy, { align: 'right' });
                        iy += 5;
                    }

                    serviciosUnicos.forEach((serv: any) => {
                        doc.setTextColor(71, 85, 105);
                        doc.setFontSize(iFontSize);
                        doc.setFont('helvetica', 'normal');
                        doc.text((serv.nombre || '').substring(0, 30), margin + 6, iy);
                        doc.setFont('helvetica', 'bold');
                        const monto = Number(serv.pago_unico) || 0;
                        doc.text(`$${monto.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, margin + totalW2 - 6, iy, { align: 'right' });
                        iy += 5;
                    });

                    doc.setTextColor(100, 116, 139);
                    doc.setFontSize(iFontSize);
                    doc.setFont('helvetica', 'normal');
                    doc.text(`IVA (${Math.round(financials.ivaPct * 100)}%)`, margin + 6, iy);
                    doc.setTextColor(249, 115, 22);
                    doc.setFont('helvetica', 'bold');
                    doc.text(`+$ ${ivaInit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, margin + totalW2 - 6, iy, { align: 'right' });
                    iy += 2;

                    doc.setDrawColor(253, 186, 116);
                    doc.setLineWidth(0.1);
                    doc.line(margin + 6, iy + 1, margin + totalW2 - 6, iy + 1);
                    iy += 5;

                    doc.setTextColor(71, 85, 105);
                    doc.setFontSize(7);
                    doc.setFont('helvetica', 'bold');
                    doc.text('TOTAL A PAGAR HOY', margin + 6, iy);
                    doc.setTextColor(249, 115, 22);
                    doc.setFontSize(14);
                    doc.text(`$${pagoInicial.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, margin + totalW2 - 6, iy + 1, { align: 'right' });

                    by += initH + 4;
                }

            } else {
                // ── MODO CLÁSICO: 2 boxes (cuando hay 1 plan o ninguno) ───────────
                const badgeH = 12;
                doc.setFillColor(241, 245, 249);
                doc.roundedRect(margin, by + 1, pageWidth - (margin * 2), badgeH, 2, 2, 'F');
                doc.setDrawColor(226, 232, 240);
                doc.roundedRect(margin, by + 1, pageWidth - (margin * 2), badgeH, 2, 2, 'D');

                doc.setTextColor(15, 23, 42);
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                const tituloText = planTitulo.toUpperCase();
                doc.text(tituloText, margin + 5, by + 8);

                const tituloWidth = doc.getTextWidth(tituloText);
                doc.setTextColor(100, 116, 139);
                doc.setFontSize(8.5);
                doc.setFont('helvetica', 'normal');
                doc.text('— ' + planDescripcion, margin + 5 + tituloWidth + 2, by + 8);

                by += badgeH + 10;

                drawBox(bx, by, 'PAGO INICIAL', 'Requerido para activar', pagoInicial, pagoInicial, COLORS.ORANGE);
                const cColor = financials.isMonthly ? COLORS.BLUE : COLORS.GREEN;
                const cTitle = financials.isMonthly ? 'PAGO RECURRENTE' : 'RECURRENTE ANUAL';
                const cSubtitle = divisor > 1 ? `Pago en ${divisor} cuotas` : 'Pago único acumulado';
                drawBox(bx + boxW + gap, by, cTitle, cSubtitle, financials.isMonthly ? cuotaMensual : financials.totalAnual, financials.isMonthly ? financials.montoPeriodo : financials.totalAnual, cColor, true);
            }

            drawFooter(1);

            // ==========================================
            // PAGE 2: TÉRMINOS Y CONDICIONES
            // ==========================================
            const termsText = cotizacion.company?.terminos_condiciones || '';
            if (termsText) {
                doc.addPage();
                doc.setFillColor(15, 23, 42);
                doc.rect(0, 0, pageWidth, 20, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text('TÉRMINOS Y CONDICIONES DEL SERVICIO', margin, 13);

                let ty = 35;
                const terms = termsText.split('\n\n').filter(t => t.trim());

                terms.forEach((para, idx) => {
                    const cleanPara = para.trim().replace(/\s+/g, ' '); // Normalize spaces

                    // Check page overflow
                    const estLines = doc.splitTextToSize(cleanPara, pageWidth - (margin * 2) - 10);
                    if (ty + (estLines.length * 5) > pageHeight - 40) {
                        drawFooter(doc.getNumberOfPages());
                        doc.addPage();
                        ty = 30;
                    }

                    // Number
                    doc.setTextColor(37, 99, 235);
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'bold');
                    doc.text(`${idx + 1}.`, margin, ty);

                    // Robust styled rendering
                    let curX = margin + 8;
                    let curY = ty;
                    const maxWidth = pageWidth - margin - 5;
                    const lineHeight = 4.5;

                    const segments = cleanPara.split(/(\*\*.*?\*\*)/);

                    segments.forEach(segment => {
                        const isBold = segment.startsWith('**') && segment.endsWith('**');
                        const text = isBold ? segment.slice(2, -2) : segment;
                        if (!text) return;

                        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
                        doc.setTextColor(isBold ? 15 : 71, isBold ? 23 : 85, isBold ? 42 : 105);
                        doc.setFontSize(8.5);

                        const words = text.split(' ');
                        words.forEach((word, wIdx) => {
                            if (!word && wIdx > 0 && wIdx < words.length - 1) return;

                            const spacing = (wIdx < words.length - 1 || (!isBold && segment.endsWith(' '))) ? ' ' : '';
                            const wordToPrint = word + spacing;
                            const wordW = doc.getTextWidth(wordToPrint);

                            if (curX + wordW > maxWidth) {
                                curX = margin + 8;
                                curY += lineHeight;
                            }

                            doc.text(wordToPrint, curX, curY);
                            curX += wordW;
                        });
                    });

                    ty = curY + 10;
                });

                drawFooter(doc.getNumberOfPages());
            }

            // Save & Return
            const pdfBlob = doc.output('blob');
            const fileName = `Cotizacion_${cotizacion.nombre_cliente.replace(/\W/g, '_')}_${Date.now()}.pdf`;
            const { error } = await supabase.storage.from('quotations').upload(fileName, pdfBlob);
            if (error) throw error;

            return supabase.storage.from('quotations').getPublicUrl(fileName).data.publicUrl;

        } catch (err: any) {
            console.error('PDF Generation failed:', err);
            throw err;
        }
    }
}
