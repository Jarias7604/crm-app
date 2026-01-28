import { jsPDF } from 'jspdf';
import { supabase } from './supabase';
import { format } from 'date-fns';
import { calculateQuoteFinancials, parseModules, type CotizacionData } from '../utils/quoteUtils';

/**
 * 💎 PREMIUM PDF SERVICE - ARIAS DEFENSE EDITION
 * -----------------------------------------
 * Matches requested screenshot exactly.
 */
export const pdfService = {
    async generateAndUploadQuotePDF(cotizacion: CotizacionData): Promise<string> {
        try {
            console.log('Generating Premium PDF vMax.5...');

            // Robust data handling
            const modulosArray = parseModules(cotizacion.modulos_adicionales);

            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            // --- PREMIUM PALETTE ---
            const C_TEXT_DARK = [15, 23, 42];
            const C_BLUE_ACCENT = [42, 171, 238]; // #2AABEE
            const C_PURPLE_MAIN = [68, 73, 170];  // #4449AA
            const C_GRAY_TEXT = [100, 116, 139];  // #64748b

            const loadImage = async (url: string) => {
                if (!url) return null;
                try {
                    return await new Promise<string>((resolve) => {
                        const img = new Image();
                        img.crossOrigin = "Anonymous";
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            canvas.width = img.width;
                            canvas.height = img.height;
                            const ctx = canvas.getContext('2d');
                            ctx?.drawImage(img, 0, 0);
                            resolve(canvas.toDataURL('image/png'));
                        };
                        img.onerror = () => resolve(null as any);
                        img.src = url;
                    });
                } catch (e) { return null; }
            };

            const footerH = 40;
            const footerStart = pageHeight - footerH;
            let currentCursorY = 0;

            // ==========================================
            // 1. PAGE 1 HEADER (FULL WIDTH DARK BOX)
            // ==========================================
            const headerH = 60;
            doc.setFillColor(15, 23, 42);
            doc.rect(0, 0, pageWidth, headerH, 'F');

            // --- Logo ---
            const contentMargin = 15;
            const leftPad = contentMargin;
            const logoSize = 22; // Increased to match screenshot
            let logoY = 10;
            const logoData = await loadImage(cotizacion.company?.logo_url || '');

            if (logoData) {
                doc.addImage(logoData, 'PNG', leftPad, logoY, logoSize, logoSize);
            } else {
                doc.setFillColor(255, 255, 255);
                doc.circle(leftPad + (logoSize / 2), logoY + (logoSize / 2), logoSize / 2, 'F');
                doc.setTextColor(15, 23, 42);
                doc.setFontSize(logoSize / 3);
                doc.text('LOGO', leftPad + (logoSize / 2), logoY + (logoSize / 2) + 2, { align: 'center' });
            }

            // Company Name & Info (Below Logo)
            let companyTextY = logoY + logoSize + 8;
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text((cotizacion.company?.name || 'ARIAS DEFENSE COMPONENTS').toUpperCase(), leftPad, companyTextY);

            companyTextY += 5;
            doc.setTextColor(C_BLUE_ACCENT[0], C_BLUE_ACCENT[1], C_BLUE_ACCENT[2]);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.text((cotizacion.company?.website || 'WWW.ARIASDEFENSE.COM').toUpperCase(), leftPad, companyTextY);

            companyTextY += 4.5;
            doc.setTextColor(148, 163, 184); // Slate 400
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            let addrLine = cotizacion.company?.address || 'COL. LA MASCOTA, SAN SALVADOR';
            const splitAddr = doc.splitTextToSize(addrLine.toUpperCase(), 100);
            doc.text(splitAddr, leftPad, companyTextY);

            // --- Right Side Header ---
            const rightPad = pageWidth - contentMargin;
            const rightTopY = 12;

            doc.setTextColor(C_BLUE_ACCENT[0], C_BLUE_ACCENT[1], C_BLUE_ACCENT[2]);
            doc.setFontSize(7);
            doc.text('COTIZACIÓN OFICIAL', rightPad, rightTopY, { align: 'right' });

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(32);
            doc.setFont('helvetica', 'normal');
            doc.text(cotizacion.id.slice(0, 8).toUpperCase(), rightPad, rightTopY + 12, { align: 'right' });

            // Divider Line
            doc.setDrawColor(51, 65, 85);
            doc.setLineWidth(0.2);
            doc.line(rightPad - 70, rightTopY + 17, rightPad, rightTopY + 17);

            // Metadata Below Line
            const metaY = rightTopY + 23;
            doc.setTextColor(148, 163, 184);
            doc.setFontSize(6);
            doc.setFont('helvetica', 'bold');
            doc.text('FECHA EMISIÓN', rightPad - 35, metaY, { align: 'right' });
            doc.text('REFERENCIA ID', rightPad, metaY, { align: 'right' });

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.text(format(new Date(cotizacion.created_at || new Date()), 'dd/MM/yyyy'), rightPad - 35, metaY + 5, { align: 'right' });
            doc.text(cotizacion.id.slice(0, 5).toUpperCase(), rightPad, metaY + 5, { align: 'right' });

            currentCursorY = headerH + 25;

            // ==========================================
            // 2. CLIENT & EXECUTIVE SUMMARY
            // ==========================================
            // Client (Left)
            doc.setTextColor(C_BLUE_ACCENT[0], C_BLUE_ACCENT[1], C_BLUE_ACCENT[2]);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text('CLIENTE RECEPTOR', 15, currentCursorY - 12);

            doc.setTextColor(C_TEXT_DARK[0], C_TEXT_DARK[1], C_TEXT_DARK[2]);
            doc.setFontSize(26);
            doc.setFont('helvetica', 'bold');
            doc.text(cotizacion.nombre_cliente || 'Jimmy Arias', 15, currentCursorY);

            if (cotizacion.empresa_cliente) {
                currentCursorY += 8;
                doc.setFillColor(C_BLUE_ACCENT[0], C_BLUE_ACCENT[1], C_BLUE_ACCENT[2]);
                doc.circle(17, currentCursorY - 2, 2, 'F');
                doc.setTextColor(C_BLUE_ACCENT[0], C_BLUE_ACCENT[1], C_BLUE_ACCENT[2]);
                doc.setFontSize(10);
                doc.text(cotizacion.empresa_cliente.toUpperCase(), 22, currentCursorY);
            }

            // Executive Summary Box (Right)
            const summaryX = pageWidth - 80;
            const summaryY = headerH + 15;

            doc.setTextColor(C_BLUE_ACCENT[0], C_BLUE_ACCENT[1], C_BLUE_ACCENT[2]);
            doc.setFontSize(7);
            doc.text('RESUMEN EJECUTIVO', pageWidth - 15, summaryY - 3, { align: 'right' });

            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(summaryX, summaryY, 65, 22, 3, 3, 'FD');

            doc.setTextColor(C_GRAY_TEXT[0], C_GRAY_TEXT[1], C_GRAY_TEXT[2]);
            doc.setFontSize(7);
            doc.text('PLAN SELECCIONADO', summaryX + 32.5, summaryY + 7, { align: 'center' });

            doc.setTextColor(C_PURPLE_MAIN[0], C_PURPLE_MAIN[1], C_PURPLE_MAIN[2]);
            doc.setFontSize(14);
            doc.text((cotizacion.plan_nombre || 'STARTER').toUpperCase(), summaryX + 32.5, summaryY + 14, { align: 'center' });

            const volumeY = summaryY + 28;
            doc.setTextColor(C_GRAY_TEXT[0], C_GRAY_TEXT[1], C_GRAY_TEXT[2]);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            const volText = `Volumen Transaccional: `;
            const volVal = `${(cotizacion.volumen_dtes || 1200).toLocaleString()} DTEs/año`;
            const volTotalW = doc.getTextWidth(volText) + doc.getTextWidth(volVal);
            const volStartX = summaryX + 32.5 - (volTotalW / 2);

            doc.text(volText, volStartX, volumeY);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(C_TEXT_DARK[0], C_TEXT_DARK[1], C_TEXT_DARK[2]);
            doc.text(volVal, volStartX + doc.getTextWidth(volText), volumeY);

            // Status Badge
            const statusText = `• ${(cotizacion.estado || 'BORRADOR').toUpperCase()}`;
            doc.setFontSize(6);
            const badgeW = doc.getTextWidth(statusText) + 8;
            doc.setFillColor(241, 245, 249);
            doc.roundedRect(summaryX + 32.5 - (badgeW / 2), volumeY + 4, badgeW, 5, 2.5, 2.5, 'F');
            doc.setTextColor(148, 163, 184);
            doc.text(statusText, summaryX + 32.5, volumeY + 7.5, { align: 'center' });


            // ==========================================
            // 3. SERVICE TABLE
            // ==========================================
            let tableY = Math.max(currentCursorY + 15, volumeY + 25);

            const drawTableHeader = (y: number) => {
                doc.setFillColor(241, 245, 249);
                doc.rect(15, y, pageWidth - 30, 8, 'F');
                doc.setTextColor(148, 163, 184);
                doc.setFontSize(7);
                doc.setFont('helvetica', 'bold');
                doc.text('DESCRIPCIÓN DEL SERVICIO', 20, y + 5);
                doc.text('INVERSIÓN (USD)', pageWidth - 20, y + 5, { align: 'right' });
            };

            drawTableHeader(tableY);
            tableY += 15;

            // SENIOR HELPER: Precision Vector Icon Engine (Compact & Clean)
            const drawIconSimple = (type: string, x: number, y: number, color: number[], isDarkBg: boolean = false) => {
                const s = 0.14; // Even smaller scale for elite presentation
                doc.setDrawColor(color[0], color[1], color[2]);

                // Background Styling
                if (isDarkBg) {
                    doc.setFillColor(30, 41, 59); // Dark Pizarra (matches screenshot)
                } else {
                    doc.setFillColor(color[0], color[1], color[2], 0.08); // Subtle glassmorphism
                }
                doc.roundedRect(x - 3.5, y - 3.5, 7, 7, 2, 2, 'F');

                doc.setLineWidth(0.3);
                doc.setLineCap(1);
                doc.setLineJoin(1);

                if (type === 'plan') { // Lucide: FileText
                    doc.line(x - 8 * s, y - 10 * s, x + 2 * s, y - 10 * s);
                    doc.line(x + 2 * s, y - 10 * s, x + 8 * s, y - 4 * s);
                    doc.line(x + 8 * s, y - 4 * s, x + 8 * s, y + 10 * s);
                    doc.line(x + 8 * s, y + 10 * s, x - 8 * s, y + 10 * s);
                    doc.line(x - 8 * s, y + 10 * s, x - 8 * s, y - 10 * s);
                    doc.line(x + 2 * s, y - 10 * s, x + 2 * s, y - 4 * s);
                    doc.line(x + 2 * s, y - 4 * s, x + 8 * s, y - 4 * s);
                    // Detail lines
                    doc.line(x - 4 * s, y + 1 * s, x + 4 * s, y + 1 * s);
                    doc.line(x - 4 * s, y + 5 * s, x + 4 * s, y + 5 * s);
                    doc.line(x - 4 * s, y - 3 * s, x - 1 * s, y - 3 * s);
                } else if (type === 'setup') { // Lucide: Settings
                    doc.circle(x, y, 1.8 * s * 4);
                    for (let i = 0; i < 8; i++) {
                        const a = (i * 45) * Math.PI / 180;
                        doc.line(x + Math.cos(a) * 1.8 * s * 4, y + Math.sin(a) * 1.8 * s * 4, x + Math.cos(a) * 2.6 * s * 4, y + Math.sin(a) * 2.6 * s * 4);
                    }
                    doc.circle(x, y, 0.8 * s * 4);
                } else if (type === 'chat') { // Lucide: MessageSquare
                    doc.roundedRect(x - 8 * s, y - 7 * s, 16 * s, 14 * s, 1, 1);
                    doc.line(x - 4 * s, y + 7 * s, x - 7 * s, y + 10 * s);
                    doc.line(x - 7 * s, y + 10 * s, x - 7 * s, y + 7 * s);
                } else if (type === 'module') { // Lucide: Package
                    doc.line(x, y - 10 * s, x + 9 * s, y - 5 * s);
                    doc.line(x + 9 * s, y - 5 * s, x + 9 * s, y + 5 * s);
                    doc.line(x + 9 * s, y + 5 * s, x, y + 10 * s);
                    doc.line(x, y + 10 * s, x - 9 * s, y + 5 * s);
                    doc.line(x - 9 * s, y + 5 * s, x - 9 * s, y - 5 * s);
                    doc.line(x - 9 * s, y - 5 * s, x, y - 10 * s);
                    doc.line(x - 9 * s, y - 5 * s, x, y);
                    doc.line(x, y, x + 9 * s, y - 5 * s);
                    doc.line(x, y, x, y + 10 * s);
                    doc.line(x - 4 * s, y - 8 * s, x + 5 * s, y - 3 * s);
                } else if (type === 'globe') { // Lucide: Globe
                    doc.circle(x, y, 9 * s);
                    doc.line(x - 9 * s, y, x + 9 * s, y);
                    doc.line(x, y - 9 * s, x, y + 9 * s);
                    doc.ellipse(x, y, 4 * s, 9 * s);
                } else if (type === 'target') { // Lucide: Target
                    doc.circle(x, y, 9 * s);
                    doc.circle(x, y, 5.5 * s);
                    doc.setFillColor(color[0], color[1], color[2], 1);
                    doc.circle(x, y, 2 * s, 'F');
                }
            };

            const drawRow = (iconType: string, title: string, _subtitle: string, price: number, isOneTime: boolean = false) => {
                const rowH = 14; // More compact rows
                if (tableY + rowH > footerStart - 25) { // More aggressive page filling
                    doc.addPage();
                    tableY = 25;
                    drawTableHeader(tableY);
                    tableY += 12;
                }

                // Match Screenshot Icons by drawing them
                let baseColor = C_BLUE_ACCENT;
                if (iconType === 'setup') baseColor = [249, 115, 22];
                if (iconType === 'module') baseColor = [168, 85, 247]; // Purple
                if (iconType === 'chat') baseColor = [34, 197, 94]; // Green

                drawIconSimple(iconType, 21, tableY + 4, baseColor);

                doc.setTextColor(15, 23, 42); // Black Slate
                doc.setFontSize(10.5);
                doc.setFont('helvetica', 'bold');
                doc.text(title, 34, tableY + 5.5);

                if (isOneTime) {
                    const tW = doc.getTextWidth(title);
                    doc.setFillColor(255, 237, 213); // bg-orange-100
                    doc.roundedRect(34 + tW + 4, tableY + 3, 16, 4, 1, 1, 'F');
                    doc.setTextColor(154, 52, 18); // text-orange-800
                    doc.setFontSize(5);
                    doc.text('PAGO ÚNICO', 34 + tW + 12, tableY + 5.8, { align: 'center' });
                }

                // Subtitle removed to match UI capture (cleaner)
                // doc.text(subtitle, 34, tableY + 10);

                doc.setTextColor(15, 23, 42);
                doc.setFontSize(12.5);
                doc.setFont('helvetica', 'bold');
                doc.text(`$${price.toLocaleString()}`, pageWidth - 20, tableY + 5.5, { align: 'right' });

                doc.setDrawColor(241, 245, 249);
                doc.line(15, tableY + 10, pageWidth - 15, tableY + 10);
                tableY += 14;
            };

            // Rows
            drawRow('plan', `Licencia Anual ${cotizacion.plan_nombre || 'STARTER'}`, 'Sube DTE y soporte cloud.', cotizacion.costo_plan_anual || 245, false);
            if (cotizacion.incluir_implementacion !== false) {
                drawRow('setup', 'Implementación y Configuración', 'Puesta en marcha, capacitación y configuración inicial.', cotizacion.costo_implementacion || 100, true);
            }
            if (cotizacion.servicio_whatsapp) {
                drawRow('chat', 'Servicio WhatsApp', 'Notificaciones automáticas vía WhatsApp.', cotizacion.costo_whatsapp || 0, false);
            }
            // Additional Modules
            modulosArray.forEach((m: any) => {
                drawRow('module', m.nombre, m.descripcion || 'Integración nativa.', m.costo_anual || 0, m.costo_mensual === 0);
            });

            // ==========================================
            // 4. TOTALS SECTION
            // ==========================================
            if (tableY + 70 > footerStart) {
                doc.addPage();
                tableY = 20;
            } else {
                tableY += 10;
            }

            // Notes (Left)
            const labelY = tableY;
            const notesY = labelY + 6; // Space for label

            doc.setTextColor(C_BLUE_ACCENT[0], C_BLUE_ACCENT[1], C_BLUE_ACCENT[2]);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text('NOTAS Y CONDICIONES', 15, labelY + 3);

            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(15, notesY, 80, 60, 3, 3, 'FD');

            doc.setFillColor(219, 234, 254);
            doc.circle(23, notesY + 8, 4, 'F');
            doc.setTextColor(37, 99, 235);
            doc.setFontSize(8);
            doc.text('!', 23, notesY + 11, { align: 'center' });

            doc.setTextColor(100, 116, 139);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            const notes = cotizacion.notes || 'Esta propuesta tiene una validez de 30 días calendario. Los precios no incluyen impuestos locales adicionales. SLA garantizado del 99.9%.';
            const splitNotes = doc.splitTextToSize(notes, 70);
            doc.text(splitNotes, 20, notesY + 16);

            // === RESUMEN DE INVERSIÓN - PROFESSIONAL COLORED BOXES ===
            const boxW = 85;
            const boxX = pageWidth - 15 - boxW;

            /**
             * COMPREHENSIVE DEFENSIVE CALCULATIONS
             * ====================================
             * Centralized pricing engine for consistency
             */
            const financials = calculateQuoteFinancials(cotizacion);
            const {
                subtotalRecurrenteBase,
                recargoFinanciamiento,
                ivaRecurrente,
                isMonthly,
                pagoInicial,
                recargoMensualPct,
                totalAnual
            } = financials;

            const recargoMensual = recargoMensualPct * 100;
            const hasInitial = pagoInicial > 0;

            console.log('🎨🎨🎨 STARTING COLORED BOXES SECTION 🎨🎨🎨');
            console.log('notesY:', notesY);
            console.log('boxX:', boxX, 'boxW:', boxW);
            console.log('hasInitial:', hasInitial);
            console.log('isMonthly:', isMonthly);
            console.log('subtotalRecurrenteBase:', subtotalRecurrenteBase);
            console.log('recargoFinanciamiento:', recargoFinanciamiento);
            console.log('ivaRecurrente:', ivaRecurrente);

            let ty = notesY; // ALIGN BOXES TOP WITH NOTES BOX TOP
            console.log('Starting ty position:', ty);

            // === 1. PAGO INICIAL (ORANGE GRADIENT BOX) ===
            if (hasInitial) {
                console.log('📦 Drawing ORANGE BOX - Pago Inicial');
                const orangeBoxH = 34; // Increased for better padding

                // Orange light background
                doc.setFillColor(255, 247, 237);
                doc.roundedRect(boxX, ty, boxW, orangeBoxH, 3, 3, 'F');

                // Left orange border
                doc.setFillColor(249, 115, 22);
                doc.roundedRect(boxX, ty, 3, orangeBoxH, 0, 0, 'F');

                let ity = ty + 8;

                // Title
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8);
                doc.setTextColor(124, 45, 18);
                doc.text('PAGO INICIAL', boxX + 10, ity);

                // Icon in box (Small & Dark Bg)
                drawIconSimple('module', boxX + boxW - 8, ty + 8, [249, 115, 22], true);

                ity += 4;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(5);
                doc.setTextColor(154, 52, 18);
                doc.text('Requerido antes de activar', boxX + 10, ity);

                ity += 5;
                // Details
                doc.setTextColor(120, 113, 108);
                doc.setFontSize(6);
                doc.text('Implementación + Servicios', boxX + 10, ity);
                doc.setFont('helvetica', 'bold');
                doc.text(`$${(cotizacion.subtotal_anticipo || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, boxX + boxW - 8, ity, { align: 'right' });

                ity += 3.5;
                doc.setFont('helvetica', 'normal');
                doc.text(`IVA (${cotizacion.iva_porcentaje || 13}%)`, boxX + 10, ity);
                doc.setTextColor(194, 65, 12);
                doc.setFont('helvetica', 'bold');
                doc.text(`+$${(cotizacion.iva_anticipo || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, boxX + boxW - 8, ity, { align: 'right' });

                // Divider
                doc.setDrawColor(251, 191, 36);
                doc.setLineWidth(0.3);
                doc.line(boxX + 10, ity + 2.5, boxX + boxW - 8, ity + 2.5);

                ity += 8; // More space for total
                // TOTAL A PAGAR HOY
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7);
                doc.setTextColor(15, 23, 42); // Dark Slate
                doc.text('TOTAL A PAGAR HOY', boxX + 10, ity);
                doc.setFontSize(15); // Slightly larger
                doc.setTextColor(234, 88, 12);
                doc.text(`$${cotizacion.monto_anticipo.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, boxX + boxW - 8, ity, { align: 'right' });

                ty += orangeBoxH + 4;
            }

            // === 2. PAGO RECURRENTE (BLUE/GREEN GRADIENT BOX) ===
            console.log('📦 Drawing BLUE/GREEN BOX - Pago Recurrente at ty:', ty);
            const recurBoxH = 42; // Increased for better padding
            const recurColor = isMonthly ? [219, 234, 254] : [220, 252, 231];
            const recurBorder = isMonthly ? [37, 99, 235] : [22, 163, 74];
            const recurText = isMonthly ? [30, 58, 138] : [20, 83, 45];

            // Calculate financing surcharge from quotation data
            // Removed extra recargoMensual declaration to use the one from financials above

            doc.setFillColor(recurColor[0], recurColor[1], recurColor[2]);
            doc.roundedRect(boxX, ty, boxW, recurBoxH, 3, 3, 'F');

            // Left colored border
            doc.setFillColor(recurBorder[0], recurBorder[1], recurBorder[2]);
            doc.roundedRect(boxX, ty, 3, recurBoxH, 0, 0, 'F');

            let rty = ty + 7;

            // Title
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(recurText[0], recurText[1], recurText[2]);
            const recurTitle = 'PAGO RECURRENTE';
            doc.text(recurTitle, boxX + 10, rty);

            // Icon in box (Small & Dark Bg)
            drawIconSimple('globe', boxX + boxW - 8, ty + 8, recurBorder, true);

            rty += 3.5;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5);
            doc.setTextColor(recurText[0] + 30, recurText[1] + 30, recurText[2] + 30);
            doc.text('1 cuota mensual', boxX + 10, rty);

            rty += 5;
            // Line 1: Base cost
            doc.setTextColor(100, 116, 139);
            doc.setFontSize(5.5);
            doc.setFont('helvetica', 'normal');
            doc.text('Licencia + Módulos', boxX + 10, rty);
            doc.setFont('helvetica', 'bold');
            doc.text(`$${subtotalRecurrenteBase.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, boxX + boxW - 8, rty, { align: 'right' });

            // Line 2: Financing surcharge (only for monthly)
            if (isMonthly) {
                rty += 3;
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(37, 99, 235); // Blue accent
                doc.text(`+ Recargo (${recargoMensual}%)`, boxX + 10, rty);
                doc.setFont('helvetica', 'bold');
                doc.text(`+$${recargoFinanciamiento.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, boxX + boxW - 8, rty, { align: 'right' });
            }

            // Line 3: IVA
            rty += 3;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text(`IVA (${cotizacion.iva_porcentaje || 13}%)`, boxX + 10, rty);
            doc.setTextColor(recurBorder[0], recurBorder[1], recurBorder[2]);
            doc.setFont('helvetica', 'bold');
            doc.text(`+$${ivaRecurrente.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, boxX + boxW - 8, rty, { align: 'right' });

            // Divider
            doc.setDrawColor(recurBorder[0], recurBorder[1], recurBorder[2], 0.3);
            doc.setLineWidth(0.3);
            doc.line(boxX + 10, rty + 2, boxX + boxW - 8, rty + 2);

            rty += 8; // More space for total
            // CUOTA MENSUAL (large)
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(15, 23, 42);
            doc.text('CUOTA MENSUAL', boxX + 10, rty);
            doc.setFontSize(15); // Slightly larger
            doc.setTextColor(recurBorder[0], recurBorder[1], recurBorder[2]);
            const recurrentVal = isMonthly ? (cotizacion.total_mensual || 0) : (totalAnual - pagoInicial);
            doc.text(`$${recurrentVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, boxX + boxW - 13, rty, { align: 'right' });
            doc.setFontSize(6);
            doc.text('/mes', boxX + boxW - 8, rty, { align: 'right' });

            ty += recurBoxH + 4;

            // === 3. INVERSIÓN GENERAL (PURPLE BOX) ===
            console.log('📦 Drawing PURPLE BOX - Inversión General at ty:', ty);
            const totalBoxH = 28; // Increased height for premium look

            // Purple solid
            doc.setFillColor(79, 70, 229);
            doc.roundedRect(boxX, ty, boxW, totalBoxH, 3, 3, 'F');

            let tty = ty + 7;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(255, 255, 255);
            doc.text('INVERSIÓN GENERAL', boxX + 10, tty);

            // Icon in box (Small & Dark Bg)
            drawIconSimple('target', boxX + boxW - 8, ty + 8, [255, 255, 255], true);

            tty += 3;
            doc.setFontSize(5);
            doc.setTextColor(224, 231, 255);
            const totalDesc = hasInitial
                ? `Incluye pago inicial + ${isMonthly ? '1 cuotas' : 'pago anual'}`
                : isMonthly ? '1 cuota mensuales' : 'Pago anual completo';
            doc.text(totalDesc, boxX + 10, tty);

            // Total amount - Large and Impactful
            doc.setFontSize(28); // Matches screenshot impact
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 255, 255);
            doc.text(`$${(cotizacion.total_anual || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, boxX + 10, tty + 15);

            if (isMonthly) {
                doc.setFontSize(7);
                doc.setTextColor(224, 231, 255);
                doc.text(`$${(cotizacion.total_mensual || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}/mes`, boxX + boxW - 8, tty + 15, { align: 'right' });
            }

            ty += totalBoxH + 4;

            // USD disclaimer
            doc.setTextColor(100, 116, 139);
            doc.setFontSize(5);
            doc.setFont('helvetica', 'italic');
            doc.text('Todos los valores expresados en USD', boxX + (boxW / 2), ty, { align: 'center' });


            // ==========================================
            // 5. FOOTER (ONLY LAST PAGE)
            // ==========================================
            const fY = footerStart;
            doc.setFillColor(248, 250, 252);
            doc.rect(0, fY, pageWidth, footerH, 'F');
            doc.setDrawColor(226, 232, 240);
            doc.line(0, fY, pageWidth, fY);

            // Agent Photo (Square as in screenshot)
            const agentX = 15;
            const agentY = fY + 8;
            const agentS = 16;
            const avatarData = await loadImage(cotizacion.creator?.avatar_url || '');

            if (avatarData) {
                doc.addImage(avatarData, 'PNG', agentX, agentY, agentS, agentS);
            } else {
                doc.setFillColor(C_PURPLE_MAIN[0], C_PURPLE_MAIN[1], C_PURPLE_MAIN[2]);
                doc.rect(agentX, agentY, agentS, agentS, 'F');
                doc.setTextColor(255, 255, 255);
                doc.text((cotizacion.creator?.full_name || 'A').charAt(0), agentX + (agentS / 2), agentY + (agentS / 2) + 2, { align: 'center' });
            }

            doc.setTextColor(C_BLUE_ACCENT[0], C_BLUE_ACCENT[1], C_BLUE_ACCENT[2]);
            doc.setFontSize(6);
            doc.setFont('helvetica', 'bold');
            doc.text('PROPUESTA ELABORADA POR', agentX + agentS + 4, fY + 11);

            doc.setTextColor(C_TEXT_DARK[0], C_TEXT_DARK[1], C_TEXT_DARK[2]);
            doc.setFontSize(10);
            doc.text((cotizacion.creator?.full_name || 'JIMMY ARIAS').toUpperCase(), agentX + agentS + 4, fY + 16);

            doc.setTextColor(100, 116, 139);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.text(cotizacion.creator?.email || 'jarias1981@gmail.com', agentX + agentS + 4, fY + 20);

            // QR (Center)
            const qrUri = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(cotizacion.company?.website || 'https://ariasdefense.com')}`;
            const qrData = await loadImage(qrUri);
            if (qrData) {
                doc.addImage(qrData, 'PNG', (pageWidth / 2) - 8, fY + 8, 16, 16);
                doc.setFontSize(5);
                doc.text('VISITA NUESTRA WEB', pageWidth / 2, fY + 28, { align: 'center' });
            }

            // Company Info (Right)
            doc.setTextColor(C_PURPLE_MAIN[0], C_PURPLE_MAIN[1], C_PURPLE_MAIN[2]);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text(`${cotizacion.company?.name || 'Arias Defense Components LLC El Salvador'} - 2026`, pageWidth - 15, fY + 12, { align: 'right' });

            doc.setTextColor(100, 116, 139);
            doc.setFontSize(6);
            doc.setFont('helvetica', 'normal');
            doc.text('Col. la Mascota San Salvador, El Salvador', pageWidth - 15, fY + 16, { align: 'right' });
            doc.text('+503 7911 8911', pageWidth - 15, fY + 20, { align: 'right' });

            doc.setTextColor(148, 163, 184);
            doc.text('DOCUMENTO OFICIAL', pageWidth - 15, fY + 28, { align: 'right' });

            // Finalize - FORCE NEW PDF EVERY TIME
            console.log('✅ Generating PDF with professional colored boxes...');
            const pdfBlob = doc.output('blob');
            const uniqueId = Math.random().toString(36).substring(2, 15);
            const fileName = `Cotizacion_NUEVO_${(cotizacion.nombre_cliente || 'Cliente').replace(/\s+/g, '_')}_${Date.now()}_${uniqueId}.pdf`;
            const { error } = await supabase.storage.from('quotations').upload(fileName, pdfBlob, { upsert: false, contentType: 'application/pdf' });
            if (error) throw error;

            return supabase.storage.from('quotations').getPublicUrl(fileName).data.publicUrl;

        } catch (err: any) {
            console.error('Premium PDF Error:', err);
            throw err;
        }
    }
};
