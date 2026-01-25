// @ts-nocheck
import { jsPDF } from 'jspdf';
import { supabase } from './supabase';
import { format } from 'date-fns';

/**
 * 💎 PDF SERVICE - FINAL RESTORED VERSION
 * -----------------------------------------
 * Matches "10:16 AM" layout exactly.
 * Gap: 12, HeaderH: 60, Padding: 8
 */
export const pdfService = {
    async generateAndUploadQuotePDF(cotizacion: any): Promise<string> {
        try {
            console.log('Generating PDF vMax.4...'); // Debug marker
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            // --- PREMIUM PALETTE ---
            const C_BG_DARK = [15, 23, 42];      // #0f172a
            const C_TEXT_DARK = [15, 23, 42];    // #0f172a
            const C_BLUE_ACCENT = [42, 171, 238]; // #2AABEE
            const C_PURPLE_MAIN = [68, 73, 170];  // #4449AA
            const C_GRAY_TEXT = [100, 116, 139];  // #64748b
            const C_GRAY_LIGHT = [248, 250, 252]; // #f8fafc
            const C_BORDER = [226, 232, 240];     // #e2e8f0

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

            // ==========================================
            // 1. HEADER (FULL WIDTH & SQUARE)
            // ==========================================
            const headerH = 58; // Calibrated to 58px as requested
            const contentMargin = 15;

            // DRAW HEADER BACKGROUND (Slate 950 deep feel)
            doc.setFillColor(15, 23, 42);
            doc.rect(0, 0, pageWidth, headerH, 'F');

            // --- LEFT SIDE (VERTICAL STACK: LOGO -> NAME -> INFO) ---
            const leftPad = contentMargin;
            const logoSize = 18;
            let currentY = 12; // Starting top margin

            const logoData = await loadImage(cotizacion.company?.logo_url);

            if (logoData) {
                doc.addImage(logoData, 'PNG', leftPad, currentY, logoSize, logoSize);
                currentY += logoSize + 8; // Space after logo
            } else {
                doc.setFillColor(255, 255, 255);
                doc.circle(leftPad + 9, currentY + 9, 9, 'F');
                doc.setTextColor(15, 23, 42);
                doc.setFontSize(8);
                doc.text('LOGO', leftPad + 9, currentY + 10.5, { align: 'center' });
                currentY += logoSize + 8;
            }

            // Company Name (Below Logo)
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text((cotizacion.company?.name || 'EMPRESA DEMO').toUpperCase(), leftPad, currentY);

            // Sub Info (Address & Phone)
            currentY += 5.5;
            doc.setTextColor(100, 116, 139); // Slate 400
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'normal');
            let addrLine = cotizacion.company?.address || 'Dirección de la empresa';
            if (cotizacion.company?.phone) addrLine += `  •  ${cotizacion.company?.phone}`;

            const maxAddrWidth = 100;
            const splitAddr = doc.splitTextToSize(addrLine.toUpperCase(), maxAddrWidth);
            doc.text(splitAddr, leftPad, currentY);

            // Website (Below Address)
            currentY += (Array.isArray(splitAddr) ? (splitAddr.length * 3.5) : 4.5);
            doc.setTextColor(C_BLUE_ACCENT[0], C_BLUE_ACCENT[1], C_BLUE_ACCENT[2]);
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'bold');
            doc.text((cotizacion.company?.website || 'WWW.SITIOWEB.COM').replace(/^https?:\/\//, '').toUpperCase(), leftPad, currentY);

            // --- RIGHT SIDE (IDS & DATES) remains aligned ---
            const rightPad = pageWidth - contentMargin;
            const rightBaseY = 14;

            // "COTIZACIÓN OFICIAL"
            doc.setTextColor(C_BLUE_ACCENT[0], C_BLUE_ACCENT[1], C_BLUE_ACCENT[2]);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text('COTIZACIÓN OFICIAL', rightPad, rightBaseY, { align: 'right' });

            // Main ID (Large White)
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(32); // Prominent as in screenshot
            doc.setFont('helvetica', 'normal');
            doc.text(cotizacion.id.slice(0, 8).toUpperCase(), rightPad, rightBaseY + 11, { align: 'right' });

            // Horizontal Line
            const lineY = rightBaseY + 16;
            doc.setDrawColor(51, 65, 85); // Slate 700
            doc.setLineWidth(0.2);
            doc.line(rightPad - 70, lineY, rightPad, lineY);

            // Info Columns below line
            const infoLabelY = lineY + 5.5;
            const infoValueY = infoLabelY + 5;

            // Date Column
            const colDateX = rightPad - 36;
            doc.setTextColor(148, 163, 184); // Slate 400
            doc.setFontSize(6);
            doc.setFont('helvetica', 'bold');
            doc.text('FECHA EMISIÓN', colDateX, infoLabelY, { align: 'right' });

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.text(format(new Date(cotizacion.created_at || new Date()), 'dd/MM/yyyy'), colDateX, infoValueY, { align: 'right' });

            // Ref ID Column
            doc.setTextColor(148, 163, 184);
            doc.setFontSize(6);
            doc.setFont('helvetica', 'bold');
            doc.text('REFERENCIA ID', rightPad, infoLabelY, { align: 'right' });

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.text(cotizacion.id.slice(0, 6).toUpperCase(), rightPad, infoValueY, { align: 'right' });


            // --- PAGE BALANCE CONSTANTS ---
            const footerH = 40;
            const footerStart = pageHeight - footerH;


            // ==========================================
            // 2. CLIENT INFO (Restored Layout)
            // ==========================================
            let cursorY = headerH + 20;
            // Ensure no overlap
            cursorY = Math.max(cursorY, 95);

            doc.setTextColor(C_BLUE_ACCENT[0], C_BLUE_ACCENT[1], C_BLUE_ACCENT[2]);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text('CLIENTE RECEPTOR', 15, cursorY - 12);

            doc.setTextColor(C_TEXT_DARK[0], C_TEXT_DARK[1], C_TEXT_DARK[2]);
            doc.setFontSize(24); // Restored to 24 as originally requested
            doc.setFont('helvetica', 'bold');
            doc.text(cotizacion.nombre_cliente, 15, cursorY);

            let detailsY = cursorY + 10;
            if (cotizacion.empresa_cliente) {
                doc.setFillColor(C_BLUE_ACCENT[0], C_BLUE_ACCENT[1], C_BLUE_ACCENT[2]);
                doc.circle(17, detailsY - 2.5, 2, 'F');
                doc.setFontSize(10);
                doc.setTextColor(C_BLUE_ACCENT[0], C_BLUE_ACCENT[1], C_BLUE_ACCENT[2]);
                doc.setFont('helvetica', 'bold');
                doc.text(cotizacion.empresa_cliente.toUpperCase(), 22, detailsY);
                detailsY += 8;
            } else if (cotizacion.email_cliente) {
                doc.setFontSize(9);
                doc.setTextColor(C_GRAY_TEXT[0], C_GRAY_TEXT[1], C_GRAY_TEXT[2]);
                doc.setFont('helvetica', 'normal');
                doc.text(cotizacion.email_cliente, 15, detailsY);
            }

            // Summary Box
            const summaryX = pageWidth - 85;
            doc.setTextColor(C_BLUE_ACCENT[0], C_BLUE_ACCENT[1], C_BLUE_ACCENT[2]);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text('RESUMEN EJECUTIVO', summaryX + 70, cursorY - 10, { align: 'right' });

            doc.setFillColor(C_GRAY_LIGHT[0], C_GRAY_LIGHT[1], C_GRAY_LIGHT[2]);
            doc.setDrawColor(C_BORDER[0], C_BORDER[1], C_BORDER[2]);
            doc.roundedRect(summaryX, cursorY - 5, 70, 25, 3, 3, 'FD');

            doc.setTextColor(C_GRAY_TEXT[0], C_GRAY_TEXT[1], C_GRAY_TEXT[2]);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text('PLAN SELECCIONADO', summaryX + 35, cursorY + 2, { align: 'center' });

            doc.setTextColor(C_PURPLE_MAIN[0], C_PURPLE_MAIN[1], C_PURPLE_MAIN[2]);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text((cotizacion.plan_nombre || 'N/A').toUpperCase(), summaryX + 35, cursorY + 12, { align: 'center' });

            const volY = cursorY + 28;
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            const volPrefixWidth = doc.getTextWidth('Volumen Transaccional: ');
            doc.setFont('helvetica', 'bold');
            const volValueWidth = doc.getTextWidth(`${(cotizacion.volumen_dtes || 0).toLocaleString()} DTEs/año`);
            const startX = (summaryX + 35) - ((volPrefixWidth + volValueWidth) / 2);

            doc.setTextColor(C_GRAY_TEXT[0], C_GRAY_TEXT[1], C_GRAY_TEXT[2]);
            doc.setFont('helvetica', 'normal');
            doc.text('Volumen Transaccional: ', startX, volY);

            doc.setFont('helvetica', 'bold');
            doc.setTextColor(C_TEXT_DARK[0], C_TEXT_DARK[1], C_TEXT_DARK[2]);
            doc.text(`${(cotizacion.volumen_dtes || 0).toLocaleString()} DTEs/año`, startX + volPrefixWidth, volY);

            const statusY = volY + 8;
            const statusText = `• ${(cotizacion.estado || 'BORRADOR').toUpperCase()}`;
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            const statusWidth = doc.getTextWidth(statusText) + 12;
            doc.setFillColor(241, 245, 249);
            doc.roundedRect((summaryX + 35) - (statusWidth / 2), statusY - 4, statusWidth, 6, 3, 3, 'F');
            doc.setTextColor(100, 116, 139);
            doc.text(statusText, summaryX + 35, statusY, { align: 'center' });


            // ==========================================
            // 3. TABLE
            // ==========================================
            let tableY = 155; // Lowered from 140 to avoid clashing with Summary Box and Status Badge
            const drawTableHeader = (y: number) => {
                doc.setFillColor(241, 245, 249);
                doc.rect(15, y, pageWidth - 30, 10, 'F');
                doc.setTextColor(148, 163, 184);
                doc.setFontSize(7);
                doc.setFont('helvetica', 'bold');
                doc.text('DESCRIPCIÓN DEL SERVICIO', 20, y + 6);
                doc.text('INVERSIÓN (USD)', pageWidth - 15, y + 6, { align: 'right' });
            };

            drawTableHeader(tableY);
            tableY += 15;

            const drawRow = (iconType: string, title: string, subtitle: string, price: number, isOneTime: boolean = false) => {
                if (tableY + 30 > footerStart) {
                    doc.addPage();
                    tableY = 40;
                    drawTableHeader(tableY);
                    tableY += 15;
                }
                let baseColor = C_BLUE_ACCENT;
                let bgMix = [239, 246, 255];
                if (iconType === 'setup') { baseColor = [249, 115, 22]; bgMix = [255, 247, 237]; }
                if (iconType === 'module') { baseColor = [168, 85, 247]; bgMix = [250, 245, 255]; }
                if (iconType === 'chat') { baseColor = [34, 197, 94]; bgMix = [240, 253, 244]; }
                if (iconType === 'target') { baseColor = [245, 158, 11]; bgMix = [255, 251, 235]; }

                doc.setFillColor(bgMix[0], bgMix[1], bgMix[2]);
                doc.roundedRect(15, tableY, 12, 12, 4, 4, 'F');

                doc.setFillColor(baseColor[0], baseColor[1], baseColor[2]);
                if (iconType === 'setup') {
                    doc.circle(21, tableY + 6, 2.5, 'F');
                    doc.setFillColor(bgMix[0], bgMix[1], bgMix[2]);
                    doc.circle(21, tableY + 6, 1, 'F');
                } else if (iconType === 'module') {
                    doc.rect(19.5, tableY + 3.5, 3, 5, 'F');
                } else if (iconType === 'chat') {
                    doc.roundedRect(18.5, tableY + 4, 5, 4, 1, 1, 'F');
                } else if (iconType === 'target') {
                    doc.circle(21, tableY + 6, 2.5, 'F');
                    doc.setFillColor(bgMix[0], bgMix[1], bgMix[2]);
                    doc.circle(21, tableY + 6, 1.5, 'F');
                    doc.setFillColor(baseColor[0], baseColor[1], baseColor[2]);
                    doc.circle(21, tableY + 6, 0.8, 'F');
                } else {
                    doc.circle(21, tableY + 6, 2, 'F');
                }

                doc.setTextColor(C_TEXT_DARK[0], C_TEXT_DARK[1], C_TEXT_DARK[2]);
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text(title, 32, tableY + 5);

                const titleWidth = doc.getTextWidth(title);
                if (isOneTime) {
                    const badgeX = 32 + titleWidth + 3;
                    doc.setFillColor(255, 237, 213);
                    doc.roundedRect(badgeX, tableY + 2, 16, 4, 1, 1, 'F');
                    doc.setTextColor(154, 52, 18);
                    doc.setFontSize(5);
                    doc.setFont('helvetica', 'bold');
                    doc.text('PAGO ÚNICO', badgeX + 8, tableY + 4.5, { align: 'center' });
                }

                doc.setTextColor(C_GRAY_TEXT[0], C_GRAY_TEXT[1], C_GRAY_TEXT[2]);
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.text(subtitle, 32, tableY + 10);

                doc.setTextColor(C_TEXT_DARK[0], C_TEXT_DARK[1], C_TEXT_DARK[2]);
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                const priceStr = Number.isInteger(price) ? `$${price}` : `$${price.toLocaleString()}`;
                doc.text(priceStr, pageWidth - 15, tableY + 8, { align: 'right' });

                doc.setDrawColor(241, 245, 249);
                doc.setLineDashPattern([], 0);
                doc.line(15, tableY + 16, pageWidth - 15, tableY + 16);
                tableY += 22;
            };

            drawRow('plan', `Licencia Anual ${cotizacion.plan_nombre}`, 'Suite DTE y soporte cloud.', cotizacion.costo_plan_anual || 0, false);
            if (cotizacion.incluir_implementacion) {
                drawRow('setup', 'Implementación y Configuración', 'Puesta en marcha, capacitación y configuración inicial.', cotizacion.costo_implementacion || 0, true);
            }
            cotizacion.modulos_adicionales?.forEach((m: any) => {
                const isOneTime = m.costo_mensual === 0;
                drawRow('module', `${m.tipo === 'servicio' ? 'Servicio' : 'Módulo'}: ${m.nombre}`, m.descripcion || 'Integración nativa con su flujo de trabajo actual.', m.costo_anual || 0, isOneTime);
            });
            if (cotizacion.servicio_whatsapp) drawRow('chat', 'Smart-WhatsApp', 'Notificaciones automáticas.', cotizacion.costo_whatsapp || 0, false);
            if (cotizacion.servicio_personalizacion) drawRow('target', 'Personalización Marca (White-label)', 'Adaptación total a su identidad corporativa.', cotizacion.costo_personalizacion || 0, true);


            // ==========================================
            // 4. TOTALS
            // ==========================================
            const sectionHeight = 60;
            const buffer = 10;
            if (tableY + sectionHeight + buffer > footerStart) {
                doc.addPage();
                tableY = 40;
            }
            const sectionY = tableY + 10;

            // Notes
            const notesBoxWidth = 80;
            const notesBoxHeight = 45;
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(15, sectionY, notesBoxWidth, notesBoxHeight, 3, 3, 'FD');

            doc.setFillColor(219, 234, 254);
            doc.circle(23, sectionY + 8, 4, 'F');
            doc.setTextColor(37, 99, 235);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text('!', 23, sectionY + 9, { align: 'center' });

            doc.setTextColor(C_BLUE_ACCENT[0], C_BLUE_ACCENT[1], C_BLUE_ACCENT[2]);
            doc.setFontSize(6);
            doc.text('NOTAS Y CONDICIONES', 30, sectionY + 7);

            doc.setTextColor(100, 116, 139);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'italic');
            const notesText = doc.splitTextToSize(
                cotizacion.notes || 'Esta propuesta tiene una validez de 30 días calendario. Los precios no incluyen impuestos locales adicionales. SLA garantizado del 99.9%.',
                notesBoxWidth - 15
            );
            doc.text(notesText, 20, sectionY + 15);

            // Totals Box
            const totalBoxWidth = 80;
            const totalBoxX = pageWidth - 15 - totalBoxWidth;

            // Calculate discount robustly
            const dPct = parseFloat(cotizacion.descuento_porcentaje || 0);
            const dMnt = parseFloat(cotizacion.descuento_monto || 0);
            const subtotal = parseFloat(cotizacion.subtotal_anual || 0);

            const discountAmount = dMnt > 0 ? dMnt : (subtotal * (dPct / 100));
            const hasDiscount = discountAmount > 0;
            const boxHeight = hasDiscount ? 65 : 55;

            doc.setFillColor(C_PURPLE_MAIN[0], C_PURPLE_MAIN[1], C_PURPLE_MAIN[2]);
            doc.roundedRect(totalBoxX, sectionY, totalBoxWidth, boxHeight, 6, 6, 'F');

            let ty = sectionY + 12;
            doc.setTextColor(255, 255, 255);

            doc.setFontSize(7);
            doc.text('SUBTOTAL NETO', totalBoxX + 10, ty);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(`$${(cotizacion.subtotal_anual || 0).toLocaleString()}`, totalBoxX + totalBoxWidth - 10, ty, { align: 'right' });

            if (hasDiscount) {
                ty += 8;
                doc.setTextColor(134, 239, 172);
                doc.setFontSize(7);
                doc.setFont('helvetica', 'bold');
                const percentLabel = cotizacion.descuento_porcentaje ? `(${cotizacion.descuento_porcentaje}%)` : '';
                doc.text(`DESCUENTO ${percentLabel}`, totalBoxX + 10, ty);
                doc.text(`-$${discountAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, totalBoxX + totalBoxWidth - 10, ty, { align: 'right' });
                doc.setTextColor(255, 255, 255);
            }

            ty += 8;
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.text(`IVA (${cotizacion.iva_porcentaje || 13}%)`, totalBoxX + 10, ty);
            doc.text(`$${(cotizacion.iva_monto || 0).toLocaleString()}`, totalBoxX + totalBoxWidth - 10, ty, { align: 'right' });

            doc.setDrawColor(255, 255, 255, 0.2);
            doc.line(totalBoxX + 10, ty + 5, totalBoxX + totalBoxWidth - 10, ty + 5);

            const isCredit = cotizacion.tipo_pago === 'credito' && cotizacion.plazo_meses > 0;
            if (isCredit) {
                ty += 12;
                doc.setFontSize(7);
                doc.text('INVERSIÓN TOTAL', totalBoxX + 10, ty);
                doc.text(`$${(cotizacion.total_anual || 0).toLocaleString()}`, totalBoxX + totalBoxWidth - 10, ty, { align: 'right' });

                ty += 6;
                doc.setTextColor(134, 239, 172);
                doc.setFontSize(7);
                doc.setFont('helvetica', 'bold');
                doc.text('PAGO INICIAL / ANTICIPO', totalBoxX + 10, ty);
                doc.text(`$${(cotizacion.monto_anticipo || 0).toLocaleString()}`, totalBoxX + totalBoxWidth - 10, ty, { align: 'right' });

                ty += 12;
                const saldo = (cotizacion.total_anual || 0) - (cotizacion.monto_anticipo || 0);
                const cuota = saldo / cotizacion.plazo_meses;
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(7);
                doc.setFont('helvetica', 'normal');
                doc.text(`Saldo a ${cotizacion.plazo_meses} cuotas de:`, totalBoxX + 10, ty - 3);
                doc.setFontSize(16);
                doc.setFont('helvetica', 'bold');
                doc.text(`$${cuota.toLocaleString(undefined, { maximumFractionDigits: 2 })}/mes`, totalBoxX + totalBoxWidth - 10, ty + 2, { align: 'right' });
            } else {
                ty += 18;
                doc.setFontSize(8);
                doc.text('TOTAL A INVERTIR', totalBoxX + 10, ty);
                doc.setFontSize(22);
                doc.setFont('helvetica', 'bold');
                doc.text(`$${(cotizacion.total_anual || 0).toLocaleString()}`, totalBoxX + totalBoxWidth - 10, ty + 2, { align: 'right' });

                ty += 10;
                const monthlyVal = cotizacion.total_mensual || (cotizacion.total_anual / 12);
                doc.setTextColor(134, 239, 172);
                doc.setFontSize(7);
                doc.setFont('helvetica', 'bold');
                doc.text(`MENSUAL: $${monthlyVal.toLocaleString(undefined, { maximumFractionDigits: 1 })}/mes`, totalBoxX + totalBoxWidth - 10, ty, { align: 'right' });
            }

            doc.setTextColor(148, 163, 184);
            doc.setFontSize(6);
            doc.setFont('helvetica', 'bold');
            doc.text('TODOS LOS VALORES EXPRESADOS EN USD', totalBoxX + (totalBoxWidth / 2), sectionY + 62, { align: 'center' });


            // ==========================================
            // 5. FOOTER
            // ==========================================
            const footerY = footerStart;
            doc.setFillColor(248, 250, 252);
            doc.rect(0, footerY, pageWidth, footerH, 'F');
            doc.setDrawColor(226, 232, 240);
            doc.line(0, footerY, pageWidth, footerY);

            const avatarUrl = cotizacion.creator?.avatar_url;
            const avatarData = await loadImage(avatarUrl);
            const avatarSize = 14;
            const avatarX = 15;
            const avatarY = footerY + 8;

            if (avatarData) {
                doc.addImage(avatarData, 'PNG', avatarX, avatarY, avatarSize, avatarSize);
                doc.setDrawColor(226, 232, 240);
                doc.rect(avatarX, avatarY, avatarSize, avatarSize);
            } else {
                doc.setFillColor(C_PURPLE_MAIN[0], C_PURPLE_MAIN[1], C_PURPLE_MAIN[2]);
                doc.roundedRect(avatarX, avatarY, avatarSize, avatarSize, 3, 3, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(9);
                doc.text('A', avatarX + (avatarSize / 2), avatarY + (avatarSize / 2) + 1, { align: 'center' });
            }

            const agentTextX = 35;
            doc.setTextColor(C_BLUE_ACCENT[0], C_BLUE_ACCENT[1], C_BLUE_ACCENT[2]);
            doc.setFontSize(6);
            doc.setFont('helvetica', 'bold');
            doc.text('PROPUESTA ELABORADA POR', agentTextX, footerY + 10);

            doc.setTextColor(C_TEXT_DARK[0], C_TEXT_DARK[1], C_TEXT_DARK[2]);
            doc.setFontSize(10);
            doc.text((cotizacion.creator?.full_name || 'AGENTE COMERCIAL').toUpperCase(), agentTextX, footerY + 15);

            doc.setTextColor(100, 116, 139);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.text(cotizacion.creator?.email || '', agentTextX, footerY + 19);

            doc.setDrawColor(226, 232, 240);
            doc.line(pageWidth - 85, footerY + 8, pageWidth - 85, footerY + 32);

            const qrTarget = cotizacion.company?.website || cotizacion.creator?.website || 'https://ariesdefense.com';
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrTarget)}`;
            const qrData = await loadImage(qrUrl);

            if (qrData) {
                doc.addImage(qrData, 'PNG', pageWidth - 105, footerY + 8, 16, 16);
                doc.setFontSize(6);
                doc.setTextColor(148, 163, 184);
                doc.text('VISITA NUESTRA WEB', pageWidth - 105, footerY + 28);
            }

            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(C_PURPLE_MAIN[0], C_PURPLE_MAIN[1], C_PURPLE_MAIN[2]);
            doc.text(`${cotizacion.company?.name || 'SaaS PRO'} - ${new Date().getFullYear()}`, pageWidth - 15, footerY + 12, { align: 'right' });

            doc.setTextColor(100, 116, 139);
            doc.setFontSize(6);
            doc.setFont('helvetica', 'normal');

            let addrY = footerY + 17;
            if (cotizacion.company?.address) {
                doc.text(cotizacion.company.address, pageWidth - 15, addrY, { align: 'right' });
                addrY += 3;
            }
            if (cotizacion.company?.phone) {
                doc.text(cotizacion.company.phone, pageWidth - 15, addrY, { align: 'right' });
                addrY += 3;
            }

            doc.setFontSize(6);
            doc.setTextColor(148, 163, 184);
            doc.text('DOCUMENTO OFICIAL', pageWidth - 15, footerY + 28, { align: 'right' });


            // SAVE
            const pdfBlob = doc.output('blob');
            const fileName = `Propuesta_${(cotizacion.nombre_cliente || 'Cliente').replace(/\s+/g, '_')}_${Date.now()}.pdf`;

            const { error } = await supabase.storage.from('quotations').upload(fileName, pdfBlob, { upsert: true });
            if (error) throw error;

            return supabase.storage.from('quotations').getPublicUrl(fileName).data.publicUrl;

        } catch (err: any) {
            console.error('PDF Generation Error:', err);
            throw err;
        }
    }
};
