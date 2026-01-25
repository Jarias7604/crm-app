// @ts-nocheck
import { jsPDF } from 'jspdf';
import { supabase } from './supabase';
import { format } from 'date-fns';

/**
 * 💎 PDF SERVICE - PREMIUM CLONE v4.0
 * -----------------------------------------
 * Replicas the visual hierarchy, colors, and iconography of CotizacionDetalle.tsx
 * using native code to ensure Vercel/Production safety.
 */

export const pdfService = {
    async generateAndUploadQuotePDF(cotizacion: any): Promise<string> {
        try {
            console.log(`✨ Generating Pixel-Perfect PDF for: ${cotizacion.nombre_cliente}`);

            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            // Colors 
            const C_SLATE_900 = [15, 23, 42];
            const C_INDIGO_MAIN = [68, 73, 170];
            const C_BLUE_500 = [59, 130, 246];
            const C_SLATE_400 = [148, 163, 184];
            const C_GRAY_50 = [249, 250, 251];
            const C_GRAY_100 = [243, 244, 246];

            // ==========================================
            // 1. HEADER (SLATE DARK SECTION)
            // ==========================================
            const headerH = 60;
            doc.setFillColor(C_SLATE_900[0], C_SLATE_900[1], C_SLATE_900[2]);
            doc.rect(0, 0, pageWidth, headerH, 'F');

            // Accent Gradient Simulation (Lighter blue on the right)
            doc.setFillColor(30, 41, 59);
            doc.rect(pageWidth / 2, 0, pageWidth / 2, headerH, 'F');

            // Left: Company Profile
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            const companyName = (cotizacion.company?.name || 'ARIAS DEFENSE').toUpperCase();
            doc.text(companyName, 20, 25);

            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(C_SLATE_400[0], C_SLATE_400[1], C_SLATE_400[2]);
            const address = cotizacion.company?.address || 'COL. LA MASCOTA, EDIF. ARIAS DEFENSE';
            const phone = cotizacion.company?.phone || '7123-4567';
            doc.text(`${address} • ${phone}`, 20, 32);

            doc.setTextColor(C_BLUE_500[0], C_BLUE_500[1], C_BLUE_500[2]);
            doc.setFont('helvetica', 'bold');
            const web = (cotizacion.company?.website || 'WWW.ARIASDEFENSE.COM').replace(/^https?:\/\//, '').toUpperCase();
            doc.text(web, 20, 37);

            // Right: Quote Identification
            doc.setTextColor(C_BLUE_500[0], C_BLUE_500[1], C_BLUE_500[2]);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text('COTIZACIÓN OFICIAL', pageWidth - 20, 20, { align: 'right' });

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(32);
            doc.setFont('helvetica', 'normal');
            doc.text(String(cotizacion.id).slice(0, 8).toUpperCase(), pageWidth - 20, 35, { align: 'right' });

            // Stat row
            doc.setDrawColor(71, 85, 105);
            doc.line(pageWidth - 85, 42, pageWidth - 20, 42);

            const statsY = 48;
            doc.setFontSize(6);
            doc.setTextColor(C_SLATE_400[0], C_SLATE_400[1], C_SLATE_400[2]);
            doc.text('FECHA EMISIÓN', pageWidth - 80, statsY);
            doc.text('REFERENCIA ID', pageWidth - 45, statsY);

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(format(new Date(cotizacion.created_at || Date.now()), 'dd/MM/yyyy'), pageWidth - 80, statsY + 5);
            doc.text(String(cotizacion.id).slice(0, 6).toUpperCase(), pageWidth - 45, statsY + 5);


            // ==========================================
            // 2. CLIENT & EXECUTIVE SUMMARY
            // ==========================================
            let cursorY = 85;

            // Client Label
            doc.setTextColor(C_BLUE_500[0], C_BLUE_500[1], C_BLUE_500[2]);
            doc.setFontSize(8);
            doc.text('CLIENTE RECEPTOR', 20, cursorY - 10);

            doc.setTextColor(C_SLATE_900[0], C_SLATE_900[1], C_SLATE_900[2]);
            doc.setFontSize(26);
            doc.setFont('helvetica', 'bold');
            doc.text(String(cotizacion.nombre_cliente).toUpperCase(), 20, cursorY);

            if (cotizacion.empresa_cliente) {
                cursorY += 8;
                doc.setFontSize(11);
                doc.setTextColor(C_INDIGO_MAIN[0], C_INDIGO_MAIN[1], C_INDIGO_MAIN[2]);
                doc.text(cotizacion.empresa_cliente.toUpperCase(), 20, cursorY);
            }

            // Summary Card (Right)
            doc.setFillColor(C_GRAY_50[0], C_GRAY_50[1], C_GRAY_50[2]);
            doc.setDrawColor(C_GRAY_100[0], C_GRAY_100[1], C_GRAY_100[2]);
            doc.roundedRect(pageWidth - 85, 80, 65, 30, 4, 4, 'FD');

            doc.setTextColor(C_INDIGO_MAIN[0], C_INDIGO_MAIN[1], C_INDIGO_MAIN[2]);
            doc.setFontSize(6);
            doc.text('RESUMEN EJECUTIVO', pageWidth - 52.5, 87, { align: 'center' });

            doc.setTextColor(C_SLATE_900[0], C_SLATE_900[1], C_SLATE_900[2]);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(cotizacion.plan_nombre || 'PLAN PERSONALIZADO', pageWidth - 52.5, 96, { align: 'center' });

            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text(`${(cotizacion.volumen_dtes || 0).toLocaleString()} DTEs / año`, pageWidth - 52.5, 103, { align: 'center' });


            // ==========================================
            // 3. TABLE BODY
            // ==========================================
            let tableY = 135;
            doc.setTextColor(C_BLUE_500[0], C_BLUE_500[1], C_BLUE_500[2]);
            doc.setFontSize(8);
            doc.text('DESGLOSE DE INVERSIÓN', 20, tableY - 10);

            // Header row
            doc.setFillColor(C_GRAY_50[0], C_GRAY_50[1], C_GRAY_50[2]);
            doc.rect(20, tableY, pageWidth - 40, 10, 'F');
            doc.setDrawColor(C_GRAY_100[0], C_GRAY_100[1], C_GRAY_100[2]);
            doc.line(20, tableY + 10, pageWidth - 20, tableY + 10);

            doc.setTextColor(C_SLATE_400[0], C_SLATE_400[1], C_SLATE_400[2]);
            doc.setFontSize(7);
            doc.text('DESCRIPCIÓN DEL SERVICIO', 25, tableY + 6.5);
            doc.text('INVERSIÓN (USD)', pageWidth - 25, tableY + 6.5, { align: 'right' });

            tableY += 15;

            const drawItemRow = (type: string, title: string, subtitle: string, price: number) => {
                let iconColor = C_BLUE_500;
                if (type === 'setup') iconColor = [234, 88, 12];
                if (type === 'module') iconColor = [147, 51, 234];
                if (type === 'chat') iconColor = [22, 163, 74];

                // Draw Icon Box
                doc.setFillColor(iconColor[0], iconColor[1], iconColor[2], 0.1);
                doc.roundedRect(20, tableY, 12, 12, 3, 3, 'F');

                // Draw Icon Symbol (Primitive lines)
                doc.setDrawColor(iconColor[0], iconColor[1], iconColor[2]);
                doc.setLineWidth(0.3);
                if (type === 'plan') { // Box
                    doc.rect(23, tableY + 3, 6, 6);
                } else if (type === 'setup') { // Gear
                    doc.circle(26, tableY + 6, 3);
                    doc.line(26, tableY + 2, 26, tableY + 10);
                    doc.line(22, tableY + 6, 30, tableY + 6);
                } else { // Circle/Dot
                    doc.circle(26, tableY + 6, 2, 'F');
                }

                doc.setTextColor(C_SLATE_900[0], C_SLATE_900[1], C_SLATE_900[2]);
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.text(title, 36, tableY + 5);

                doc.setFontSize(9);
                doc.setTextColor(148, 163, 184);
                doc.setFont('helvetica', 'normal');
                doc.text(subtitle, 36, tableY + 10);

                doc.setTextColor(C_SLATE_900[0], C_SLATE_900[1], C_SLATE_900[2]);
                doc.setFontSize(13);
                doc.setFont('helvetica', 'bold');
                doc.text(`$${price.toLocaleString()}`, pageWidth - 25, tableY + 7, { align: 'right' });

                tableY += 21;
                doc.setDrawColor(C_GRAY_100[0], C_GRAY_100[1], C_GRAY_100[2]);
                doc.setLineWidth(0.1);
                doc.line(20, tableY - 4, pageWidth - 20, tableY - 4);
            };

            // Rows
            drawItemRow('plan', `Licencia Anual ${cotizacion.plan_nombre}`, 'Suite completa DTE y soporte técnico.', cotizacion.costo_plan_anual || 0);

            if (cotizacion.incluir_implementacion) {
                drawItemRow('setup', 'Implementación y Configuración', 'Pago único. Puesta en marcha corporativa.', cotizacion.costo_implementacion || 0);
            }

            if (cotizacion.modulos_adicionales) {
                cotizacion.modulos_adicionales.forEach((m: any) => {
                    drawItemRow('module', m.nombre, 'Módulo adicional integrado.', m.costo_anual || 0);
                });
            }

            if (cotizacion.servicio_whatsapp) {
                drawItemRow('chat', 'Servicio Smart-WhatsApp', 'Notificaciones y seguimiento automático.', cotizacion.costo_whatsapp || 0);
            }


            // ==========================================
            // 4. TOTALS (FLOATING INDIGO BOX)
            // ==========================================
            if (tableY + 70 > pageHeight) doc.addPage();
            const totalX = pageWidth - 90;
            const totalY = tableY + 10;

            doc.setFillColor(C_INDIGO_MAIN[0], C_INDIGO_MAIN[1], C_INDIGO_MAIN[2]);
            doc.roundedRect(totalX, totalY, 70, 50, 8, 8, 'F');

            let ty = totalY + 12;
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text('SUBTOTAL NETO', totalX + 8, ty);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(`$${(cotizacion.subtotal_anual || 0).toLocaleString()}`, pageWidth - 28, ty, { align: 'right' });

            ty += 10;
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(`IVA (${cotizacion.iva_porcentaje || 13}%)`, totalX + 8, ty);
            doc.text(`$${(cotizacion.iva_monto || 0).toLocaleString()}`, pageWidth - 28, ty, { align: 'right' });

            doc.setDrawColor(255, 255, 255, 0.3);
            doc.setLineWidth(0.2);
            doc.line(totalX + 8, ty + 4, pageWidth - 28, ty + 4);

            ty += 15;
            doc.setFontSize(9);
            doc.text('TOTAL A INVERTIR', totalX + 8, ty);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text(`$${(cotizacion.total_anual || 0).toLocaleString()}`, pageWidth - 28, ty + 2, { align: 'right' });


            // ==========================================
            // 5. PROFESSIONAL FOOTER
            // ==========================================
            const footY = pageHeight - 35;
            doc.setFillColor(C_GRAY_50[0], C_GRAY_50[1], C_GRAY_50[2]);
            doc.rect(0, footY, pageWidth, 35, 'F');

            doc.setTextColor(C_SLATE_900[0], C_SLATE_900[1], C_SLATE_900[2]);
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.text((cotizacion.creator?.full_name || 'AGENTE DE VENTAS').toUpperCase(), 20, footY + 15);

            doc.setFontSize(8);
            doc.setTextColor(C_SLATE_400[0], C_SLATE_400[1], C_SLATE_400[2]);
            doc.setFont('helvetica', 'normal');
            doc.text((cotizacion.creator?.email || 'ARIASDEFENSE.COM').toUpperCase(), 20, footY + 21);

            doc.setTextColor(C_INDIGO_MAIN[0], C_INDIGO_MAIN[1], C_INDIGO_MAIN[2]);
            doc.setFont('helvetica', 'bold');
            doc.text('DOCUMENTO OFICIAL', pageWidth - 20, footY + 15, { align: 'right' });
            doc.setFontSize(7);
            doc.setTextColor(C_SLATE_400[0], C_SLATE_400[1], C_SLATE_400[2]);
            doc.text('GENERADO ELECTRÓNICAMENTE - VALIDEZ 30 DÍAS', pageWidth - 20, footY + 21, { align: 'right' });


            // EXPORT & UPLOAD
            const pdfBlob = doc.output('blob');
            const quoteFileName = `Propuesta_${cotizacion.nombre_cliente.replace(/\s+/g, '_')}_${Date.now()}.pdf`;

            const { error: uploadError } = await supabase.storage
                .from('quotations')
                .upload(quoteFileName, pdfBlob, { contentType: 'application/pdf', upsert: true });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('quotations').getPublicUrl(quoteFileName);
            return data.publicUrl;

        } catch (err: any) {
            console.error('❌ PDF Generation Error:', err);
            throw err;
        }
    }
};
