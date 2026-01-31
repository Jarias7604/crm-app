import { jsPDF } from 'jspdf';
import { supabase } from './supabase';
import { format } from 'date-fns';
import { calculateQuoteFinancials, parseModules, type CotizacionData } from '../utils/quoteUtils';
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

            const drawRow = (name: string, price: number, isOneTime: boolean = false) => {
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
                drawRow(m.nombre, m.costo_anual || 0, (m.costo_mensual || 0) === 0);
            });

            // ==========================================
            // HORIZONTAL TOTALS - 3 COLUMNS
            // ==========================================
            const financials = calculateQuoteFinancials(cotizacion);
            const {
                pagoInicial,
                totalAnual,
                cuotaMensual,
                montoPeriodo,
                isMonthly,
                plazoMeses
            } = financials;

            const divisor = cotizacion.cuotas || (isMonthly ? plazoMeses : 1);

            const boxW = 89;
            const gap = 2;
            let bx = margin;
            let by = currentY + 10;

            if (by + 50 > pageHeight - 40) {
                doc.addPage();
                by = 20;
            }

            const drawBox = (x: number, y: number, title: string, subtitle: string, mainValue: number, footerValue: number, color: number[], isRecurrent: boolean = false) => {
                const h = 50;
                // Manual Alpha Blending (Base 255 for White background)
                const r5 = Math.floor(255 - (255 - color[0]) * 0.05);
                const g5 = Math.floor(255 - (255 - color[1]) * 0.05);
                const b5 = Math.floor(255 - (255 - color[2]) * 0.05);

                const r10 = Math.floor(255 - (255 - color[0]) * 0.10);
                const g10 = Math.floor(255 - (255 - color[1]) * 0.10);
                const b10 = Math.floor(255 - (255 - color[2]) * 0.10);

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

                if (title.includes('INICIAL')) {
                    const subtotalIni = pagoInicial / (1 + financials.ivaPct);
                    const ivaIni = pagoInicial - subtotalIni;

                    doc.text('Implementación + Servicios', x + 7, y + 18);
                    doc.text(`$${subtotalIni.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, x + boxW - 7, y + 18, { align: 'right' });

                    doc.text(`IVA (${Math.round(financials.ivaPct * 100)}%)`, x + 7, y + 22);
                    doc.setTextColor(color[0], color[1], color[2]);
                    doc.text(`+$ ${ivaIni.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, x + boxW - 7, y + 22, { align: 'right' });

                    doc.setDrawColor(r15, g15, b15);
                    doc.setLineWidth(0.1);
                    doc.line(x + 7, y + 24, x + boxW - 7, y + 24);
                } else {
                    const { subtotalRecurrenteBase, recargoFinanciamiento, ivaRecurrente } = financials;

                    doc.text('Licencia + Módulos', x + 7, y + 18);
                    doc.text(`$${subtotalRecurrenteBase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, x + boxW - 7, y + 18, { align: 'right' });

                    if (recargoFinanciamiento > 0) {
                        doc.text('Recargo Financiamiento', x + 7, y + 22);
                        doc.text(`+$ ${recargoFinanciamiento.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, x + boxW - 7, y + 22, { align: 'right' });

                        doc.text(`IVA (13%)`, x + 7, y + 26);
                        doc.setTextColor(color[0], color[1], color[2]);
                        doc.text(`+$ ${ivaRecurrente.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, x + boxW - 7, y + 26, { align: 'right' });
                    } else {
                        doc.text(`IVA (13%)`, x + 7, y + 22);
                        doc.setTextColor(color[0], color[1], color[2]);
                        doc.text(`+$ ${ivaRecurrente.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, x + boxW - 7, y + 22, { align: 'right' });
                    }

                    doc.setDrawColor(r15, g15, b15);
                    doc.setLineWidth(0.1);
                    doc.line(x + 7, y + (recargoFinanciamiento > 0 ? 28 : 24), x + boxW - 7, y + (recargoFinanciamiento > 0 ? 28 : 24));

                    doc.setTextColor(51, 65, 85);
                    doc.setFontSize(6.5);
                    doc.setFont('helvetica', 'bold');
                    const totalPlanLabel = `Total Plan (${divisor} ${divisor === 1 ? 'Cuota' : 'Cuotas'})`;
                    doc.text(totalPlanLabel, x + 7, y + (recargoFinanciamiento > 0 ? 32 : 28));
                    doc.text(`$${(mainValue * divisor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, x + boxW - 7, y + (recargoFinanciamiento > 0 ? 32 : 28), { align: 'right' });
                }

                // 5. Main Highlight
                doc.setTextColor(51, 65, 85);
                doc.setFontSize(7.5);
                doc.setFont('helvetica', 'bold');

                const highlightY = isRecurrent ? (financials.recargoFinanciamiento > 0 ? 42 : 38) : 34;
                const tLabel = isRecurrent
                    ? (divisor > 1 ? `Cuota de ${divisor}` : 'TOTAL RECURRENTE')
                    : 'TOTAL INICIAL';

                doc.text(tLabel, x + 7, y + highlightY);

                doc.setTextColor(color[0], color[1], color[2]);
                doc.setFontSize(13);
                doc.setFont('helvetica', 'bold');
                const tText = `$${mainValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                doc.text(tText, x + boxW - 14, y + highlightY, { align: 'right' });

                if (isRecurrent && divisor > 1) {
                    doc.setFontSize(6);
                    doc.text(' / cuota', x + (boxW - 14) + 1, y + highlightY);
                }

                if (isRecurrent) {
                    doc.setFontSize(5);
                    doc.setTextColor(color[0], color[1], color[2]);
                    doc.setFont('helvetica', 'italic');
                    doc.text('* Plan de pagos consecutivos.', x + boxW / 2, y + highlightY + 4, { align: 'center' });
                }
            };

            // Drawing boxes
            drawBox(bx, by, 'PAGO INICIAL', 'Requerido para activar', pagoInicial, pagoInicial, COLORS.ORANGE);
            const cColor = isMonthly ? COLORS.BLUE : COLORS.GREEN;
            const cTitle = isMonthly ? 'PAGO RECURRENTE' : 'RECURRENTE ANUAL';
            const cSubtitle = divisor > 1 ? `Pago en ${divisor} cuotas` : 'Pago único acumulado';
            drawBox(bx + boxW + gap, by, cTitle, cSubtitle, isMonthly ? cuotaMensual : totalAnual, isMonthly ? montoPeriodo : totalAnual, cColor, true);

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
