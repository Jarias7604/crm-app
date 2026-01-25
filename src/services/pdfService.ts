// @ts-nocheck
import { jsPDF } from 'jspdf';
import { supabase } from './supabase';
import { format } from 'date-fns';

/**
 * 🛡️ PDF SERVICE - PREMIUM UI NATIVE MODE
 * -----------------------------------------
 * This implementation REPLICATES the exact React UI (CotizacionDetalle.tsx)
 * using pure coordinates to ensure 100% compatibility with Vercel and Production.
 * NO external table dependencies are used to avoid "is not a function" errors.
 */

export const pdfService = {
    async generateAndUploadQuotePDF(cotizacion: any): Promise<string> {
        try {
            console.log(`🚀 Generando PDF Premium 1:1 [vFINAL] para: ${cotizacion.id}`);

            // Standard A4
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            // Palette (Exact Match from CotizacionDetalle.tsx)
            const C_SLATE_900 = [15, 23, 42];  // #0f172a (Header)
            const C_INDIGO_MAIN = [68, 73, 170]; // #4449AA (Brand/Total)
            const C_BLUE_500 = [59, 130, 246]; // Blue accents
            const C_SLATE_400 = [148, 163, 184];
            const C_SLATE_700 = [51, 65, 85];
            const C_GRAY_50 = [249, 250, 251];
            const C_GRAY_100 = [243, 244, 246];

            // ==========================================
            // 1. HEADER (SLATE DARK SECTION)
            // ==========================================
            const headerH = 55;
            doc.setFillColor(C_SLATE_900[0], C_SLATE_900[1], C_SLATE_900[2]);
            doc.rect(0, 0, pageWidth, headerH, 'F');

            // Left: Company Branding
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            const companyName = (cotizacion.company?.name || 'ARIAS DEFENSE COMPONENTS').toUpperCase();
            doc.text(companyName, 20, 22);

            // Company Info (Small)
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(C_SLATE_400[0], C_SLATE_400[1], C_SLATE_400[2]);
            const address = cotizacion.company?.address || 'COL. LA MASCOTA, SAN SALVADOR, EL SALVADOR';
            const web = (cotizacion.company?.website || 'WWW.ARIASDEFENSE.COM').replace(/^https?:\/\//, '').toUpperCase();
            doc.text(address, 20, 28);

            doc.setTextColor(C_BLUE_500[0], C_BLUE_500[1], C_BLUE_500[2]);
            doc.setFont('helvetica', 'bold');
            doc.text(web, 20, 32);

            // Right: Metadata
            doc.setTextColor(C_BLUE_500[0], C_BLUE_500[1], C_BLUE_500[2]);
            doc.setFontSize(8);
            doc.text('COTIZACIÓN OFICIAL', pageWidth - 20, 18, { align: 'right' });

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(28);
            doc.setFont('helvetica', 'normal');
            doc.text(String(cotizacion.id).slice(0, 8).toUpperCase(), pageWidth - 20, 32, { align: 'right' });

            // Divider & Row
            doc.setDrawColor(C_SLATE_700[0], C_SLATE_700[1], C_SLATE_700[2]);
            doc.line(pageWidth - 80, 38, pageWidth - 20, 38);

            doc.setFontSize(7);
            doc.setTextColor(C_SLATE_400[0], C_SLATE_400[1], C_SLATE_400[2]);
            doc.text('FECHA EMISIÓN', pageWidth - 80, 43);
            doc.text('REFERENCIA ID', pageWidth - 45, 43);

            doc.setTextColor(241, 245, 249);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(format(new Date(cotizacion.created_at || Date.now()), 'dd/MM/yyyy'), pageWidth - 80, 48);
            doc.text(String(cotizacion.id).slice(0, 6).toUpperCase(), pageWidth - 45, 48);

            // ==========================================
            // 2. CLIENT & SUMMARY
            // ==========================================
            let cursorY = 75;
            doc.setTextColor(C_BLUE_500[0], C_BLUE_500[1], C_BLUE_500[2]);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('CLIENTE RECEPTOR', 20, cursorY);

            cursorY += 12;
            doc.setTextColor(C_SLATE_900[0], C_SLATE_900[1], C_SLATE_900[2]);
            doc.setFontSize(24);
            doc.text(String(cotizacion.nombre_cliente).toUpperCase(), 20, cursorY);

            if (cotizacion.empresa_cliente) {
                cursorY += 8;
                doc.setFontSize(11);
                doc.setTextColor(C_INDIGO_MAIN[0], C_INDIGO_MAIN[1], C_INDIGO_MAIN[2]);
                doc.text(String(cotizacion.empresa_cliente).toUpperCase(), 20, cursorY);
            }

            // Summary Box (Right)
            doc.setFillColor(C_GRAY_50[0], C_GRAY_50[1], C_GRAY_50[2]);
            doc.setDrawColor(C_GRAY_100[0], C_GRAY_100[1], C_GRAY_100[2]);
            doc.roundedRect(pageWidth - 85, 70, 65, 35, 4, 4, 'FD');

            doc.setTextColor(C_INDIGO_MAIN[0], C_INDIGO_MAIN[1], C_INDIGO_MAIN[2]);
            doc.setFontSize(8);
            doc.text('RESUMEN EJECUTIVO', pageWidth - 52.5, 78, { align: 'center' });

            doc.setTextColor(C_SLATE_900[0], C_SLATE_900[1], C_SLATE_900[2]);
            doc.setFontSize(12);
            doc.text(`${cotizacion.plan_nombre}`, pageWidth - 52.5, 88, { align: 'center' });
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(`${(cotizacion.volumen_dtes || 0).toLocaleString()} DTEs/año`, pageWidth - 52.5, 95, { align: 'center' });

            // ==========================================
            // 3. TABLE (MANUAL RENDER)
            // ==========================================
            let tableY = 120;
            doc.setFontSize(10);
            doc.setTextColor(C_BLUE_500[0], C_BLUE_500[1], C_BLUE_500[2]);
            doc.setFont('helvetica', 'bold');
            doc.text('DESGLOSE DE INVERSIÓN', 20, tableY);

            tableY += 8;
            doc.setFillColor(C_GRAY_50[0], C_GRAY_50[1], C_GRAY_50[2]);
            doc.rect(20, tableY, pageWidth - 40, 10, 'F');

            doc.setTextColor(100, 116, 139);
            doc.setFontSize(8);
            doc.text('DESCRIPCIÓN DEL SERVICIO', 25, tableY + 6.5);
            doc.text('INVERSIÓN (USD)', pageWidth - 25, tableY + 6.5, { align: 'right' });

            tableY += 10;

            const drawRow = (title: string, subtitle: string, price: number, color: number[]) => {
                // Icon Box
                doc.setFillColor(color[0], color[1], color[2], 0.1);
                doc.roundedRect(20, tableY + 2, 10, 10, 2, 2, 'F');

                doc.setTextColor(C_SLATE_900[0], C_SLATE_900[1], C_SLATE_900[2]);
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text(title, 35, tableY + 6.5);

                doc.setTextColor(100, 116, 139);
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.text(subtitle, 35, tableY + 11);

                doc.setTextColor(C_SLATE_900[0], C_SLATE_900[1], C_SLATE_900[2]);
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.text(`$${price.toLocaleString()}`, pageWidth - 25, tableY + 8, { align: 'right' });

                tableY += 18;
                doc.setDrawColor(C_GRAY_100[0], C_GRAY_100[1], C_GRAY_100[2]);
                doc.line(20, tableY, pageWidth - 20, tableY);
            };

            // Items
            drawRow(`Licencia Anual ${cotizacion.plan_nombre}`, 'Incluye suite DTE y soporte técnico base.', cotizacion.costo_plan_anual || 0, [59, 130, 246]);

            if (cotizacion.incluir_implementacion) {
                drawRow('Implementación y Configuración', 'Puesta en marcha, capacitación y configuración inicial.', cotizacion.costo_implementacion || 0, [234, 88, 12]);
            }

            if (cotizacion.modulos_adicionales) {
                cotizacion.modulos_adicionales.forEach((m: any) => {
                    drawRow(m.nombre, 'Módulo adicional especializado.', m.costo_anual || 0, [147, 51, 234]);
                });
            }

            if (cotizacion.servicio_whatsapp) {
                drawRow('Notificaciones Smart-WhatsApp', 'Automatización de envíos y confirmación.', cotizacion.costo_whatsapp || 0, [22, 163, 74]);
            }

            if (cotizacion.servicio_personalizacion) {
                drawRow('Personalización White-Label', 'Adaptación total a su marca corporativa.', cotizacion.costo_personalizacion || 0, [245, 158, 11]);
            }

            // ==========================================
            // 4. TOTALS (INDIGO CARD)
            // ==========================================
            if (tableY + 60 > pageHeight) doc.addPage();
            const totalY = tableY + 15;

            doc.setFillColor(C_INDIGO_MAIN[0], C_INDIGO_MAIN[1], C_INDIGO_MAIN[2]);
            doc.roundedRect(pageWidth - 100, totalY, 80, 50, 6, 6, 'F');

            let tY = totalY + 12;
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text('SUBTOTAL NETO', pageWidth - 90, tY);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(`$${(cotizacion.subtotal_anual || 0).toLocaleString()}`, pageWidth - 30, tY, { align: 'right' });

            tY += 10;
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(`IVA (${cotizacion.iva_porcentaje || 13}%)`, pageWidth - 90, tY);
            doc.text(`$${(cotizacion.iva_monto || 0).toLocaleString()}`, pageWidth - 30, tY, { align: 'right' });

            doc.setDrawColor(255, 255, 255, 0.2);
            doc.line(pageWidth - 90, tY + 4, pageWidth - 30, tY + 4);

            tY += 15;
            doc.setFontSize(10);
            doc.text('TOTAL A INVERTIR', pageWidth - 90, tY);
            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');
            doc.text(`$${(cotizacion.total_anual || 0).toLocaleString()}`, pageWidth - 30, tY + 2, { align: 'right' });

            // ==========================================
            // 5. FOOTER
            // ==========================================
            const footerY = pageHeight - 35;
            doc.setFillColor(C_GRAY_50[0], C_GRAY_50[1], C_GRAY_50[2]);
            doc.rect(0, footerY, pageWidth, 35, 'F');

            doc.setTextColor(C_SLATE_900[0], C_SLATE_900[1], C_SLATE_900[2]);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text((cotizacion.creator?.full_name || 'AGENTE COMERCIAL').toUpperCase(), 20, footerY + 15);

            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text((cotizacion.creator?.email || 'ventas@ariasdefense.com').toUpperCase(), 20, footerY + 22);

            doc.setTextColor(C_INDIGO_MAIN[0], C_INDIGO_MAIN[1], C_INDIGO_MAIN[2]);
            doc.setFont('helvetica', 'bold');
            doc.text('DOCUMENTO OFICIAL', pageWidth - 20, footerY + 15, { align: 'right' });

            // GENERATE & UPLOAD
            const pdfBlob = doc.output('blob');
            const fileName = `propuesta_${cotizacion.id.slice(0, 8)}_${Date.now()}.pdf`;

            const { error: uploadError } = await supabase.storage
                .from('quotations')
                .upload(fileName, pdfBlob, { contentType: 'application/pdf', upsert: true });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('quotations').getPublicUrl(fileName);
            return data.publicUrl;

        } catch (err: any) {
            console.error('❌ ERROR PDF NATIVE:', err);
            throw err;
        }
    }
};
