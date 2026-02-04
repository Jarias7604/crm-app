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
export const pdfService = {
    async generateAndUploadQuotePDF(cotizacion: CotizacionData): Promise<string> {
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
            drawRow(`Licencia Anual ${cotizacion.plan_nombre}`, cotizacion.costo_plan_anual || 0);
            if (cotizacion.incluir_implementacion) {
                drawRow('Implementación y Configuración', cotizacion.costo_implementacion || 0, true);
            }
            if (cotizacion.servicio_whatsapp) {
                drawRow('Comunicación WhatsApp', cotizacion.costo_whatsapp || 0);
            }
            modulos.forEach((m: any) => {
                const currentCosto = m.costo_anual || m.costo || 0;
                const isOneTime = (m.costo_mensual || 0) === 0 && currentCosto > 0;
                drawRow(m.nombre, currentCosto, isOneTime, m.descripcion);
            });


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

            // Buscar el plan de financiamiento correspondiente
            const companyId = (cotizacion as any).company_id || (cotizacion.company as any)?.id;
            let financingPlan: { titulo?: string; descripcion?: string; interes_porcentaje?: number; tipo_ajuste?: 'discount' | 'recharge' | 'none' } | undefined;
            if (numCuotas && companyId) {
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
                totalImplementacion: pagoInicial
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
                let numLineasRecurrente = 1 + serviciosRec.length + (costoWhatsApp > 0 ? 1 : 0) + (financials.recargoFinanciamiento > 0 ? 1 : 0) + 1 + 1; // Licencia + módulos + WhatsApp + Financiamiento + IVA + Total Plan

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

            // Drawing boxes
            drawBox(bx, by, 'PAGO INICIAL', 'Requerido para activar', pagoInicial, pagoInicial, COLORS.ORANGE);
            const cColor = financials.isMonthly ? COLORS.BLUE : COLORS.GREEN;
            const cTitle = financials.isMonthly ? 'PAGO RECURRENTE' : 'RECURRENTE ANUAL';
            const cSubtitle = divisor > 1 ? `Pago en ${divisor} cuotas` : 'Pago único acumulado';
            drawBox(bx + boxW + gap, by, cTitle, cSubtitle, financials.isMonthly ? cuotaMensual : financials.totalAnual, financials.isMonthly ? financials.montoPeriodo : financials.totalAnual, cColor, true);

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
