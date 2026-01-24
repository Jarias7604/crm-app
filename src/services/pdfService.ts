import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { supabase } from './supabase';
import { format } from 'date-fns';

export const pdfService = {
    async generateAndUploadQuotePDF(cotizacion: any): Promise<string> {
        try {
            console.log('Generando PDF Premium...', cotizacion.id);
            const doc = new jsPDF() as any;
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            // Colors
            const darkBg = [15, 23, 42]; // Slate 900
            const accentBg = [68, 73, 170]; // #4449AA
            const textMuted = [100, 116, 139]; // Slate 400
            const successColor = [61, 204, 145]; // Green

            // 1. HEADER (Visual Header)
            doc.setFillColor(...darkBg);
            doc.rect(0, 0, pageWidth, 45, 'F');

            // Company Info (Left)
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text((cotizacion.company?.name || 'ARIAS DEFENSE COMPONENTS').toUpperCase(), 20, 18);

            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(150, 150, 150);
            const address = cotizacion.company?.address || 'COL. LA MASCOTA SAN SALVADOR, EL SALVADOR';
            const phone = cotizacion.company?.phone || '+503 7971 8911';
            doc.text(`${address}  •  ${phone}`, 20, 24);

            doc.setTextColor(68, 73, 170);
            doc.setFont('helvetica', 'bold');
            doc.text((cotizacion.company?.website || 'WWW.ARIASDEFENSE.COM').toUpperCase(), 20, 29);

            // Ref metadata (Right)
            doc.setTextColor(...accentBg);
            doc.setFontSize(8);
            doc.text('COTIZACIÓN OFICIAL', pageWidth - 20, 15, { align: 'right' });

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(24);
            doc.setFont('helvetica', 'normal');
            doc.text(cotizacion.id.slice(0, 8).toUpperCase(), pageWidth - 20, 28, { align: 'right' });

            doc.setDrawColor(30, 41, 59);
            doc.line(pageWidth - 80, 34, pageWidth - 20, 34);

            doc.setFontSize(7);
            doc.setTextColor(100, 116, 139);
            doc.text('FECHA EMISIÓN', pageWidth - 80, 39);
            doc.text('REFERENCIA ID', pageWidth - 45, 39);

            doc.setTextColor(200, 200, 200);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text(format(new Date(cotizacion.created_at || Date.now()), 'dd/MM/yyyy'), pageWidth - 80, 42);
            doc.text(cotizacion.id.slice(0, 6).toUpperCase(), pageWidth - 45, 42);

            // 2. CLIENT INFO & SUMMARY
            let currentY = 60;

            doc.setTextColor(...accentBg);
            doc.setFontSize(9);
            doc.text('CLIENTE RECEPTOR', 20, currentY);

            currentY += 10;
            doc.setTextColor(...darkBg);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text(String(cotizacion.nombre_cliente).toUpperCase(), 20, currentY);

            if (cotizacion.empresa_cliente) {
                currentY += 7;
                doc.setFontSize(11);
                doc.setTextColor(...textMuted);
                doc.text(cotizacion.empresa_cliente, 20, currentY);
            }

            // Executive Summary Box (Right)
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(pageWidth - 85, 60, 65, 30, 3, 3, 'F');
            doc.setTextColor(...accentBg);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text('RESUMEN EJECUTIVO', pageWidth - 52.5, 68, { align: 'center' });

            doc.setTextColor(...darkBg);
            doc.setFontSize(10);
            doc.text(`PLAN SELECCIONADO: ${cotizacion.plan_nombre}`, pageWidth - 52.5, 75, { align: 'center' });
            doc.setFontSize(8);
            doc.setTextColor(...textMuted);
            doc.text(`VOLUMEN: ${cotizacion.volumen_dtes?.toLocaleString()} DTEs/año`, pageWidth - 52.5, 82, { align: 'center' });

            // Small info below client
            currentY += 12;
            doc.setDrawColor(241, 245, 249);
            doc.line(20, currentY, 100, currentY);

            currentY += 8;
            doc.setFontSize(8);
            doc.setTextColor(...textMuted);
            doc.text('CONTACTO', 20, currentY);

            currentY += 5;
            doc.setTextColor(...darkBg);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(`${cotizacion.email_cliente || 'N/A'}`, 20, currentY);
            if (cotizacion.telefono_cliente) {
                doc.text(`  •  ${cotizacion.telefono_cliente}`, 60, currentY);
            }

            // 3. INVESTMENT TABLE
            currentY = 105;
            doc.setTextColor(...accentBg);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text('DESGLOSE DE INVERSIÓN', 20, currentY);

            const tableRows = [];
            // Plan
            tableRows.push([
                `LICENCIA ANUAL ${cotizacion.plan_nombre}\nIncluye suite DTE y soporte técnico base.`,
                `$${(cotizacion.costo_plan_anual || 0).toLocaleString()}`
            ]);

            // Implementation
            if (cotizacion.incluir_implementacion) {
                tableRows.push([
                    'IMPLEMENTACIÓN Y CONFIGURACIÓN (PAGO ÚNICO)\nPuesta en marcha, capacitación y configuración inicial.',
                    `$${(cotizacion.costo_implementacion || 0).toLocaleString()}`
                ]);
            }

            // Modules
            if (cotizacion.modulos_adicionales && Array.isArray(cotizacion.modulos_adicionales)) {
                cotizacion.modulos_adicionales.forEach((m: any) => {
                    tableRows.push([
                        `${m.nombre}\nServicio complementario activado.`,
                        `$${(m.costo_anual || 0).toLocaleString()}`
                    ]);
                });
            }

            // WhatsApp
            if (cotizacion.servicio_whatsapp) {
                tableRows.push([
                    'NOTIFICACIONES SMART-WHATSAPP\nAutomatización de envíos y confirmación.',
                    `$${(cotizacion.costo_whatsapp || 0).toLocaleString()}`
                ]);
            }

            // Personalization
            if (cotizacion.servicio_personalizacion) {
                tableRows.push([
                    'PERSONALIZACIÓN DE MARCA (WHITE-LABEL)\nAdaptación total a su identidad corporativa.',
                    `$${(cotizacion.costo_personalizacion || 0).toLocaleString()}`
                ]);
            }

            doc.autoTable({
                startY: currentY + 5,
                head: [['DESCRIPCIÓN DEL SERVICIO', 'INVERSIÓN (USD)']],
                body: tableRows,
                headStyles: { fillColor: [249, 250, 251], textColor: [100, 116, 139], fontSize: 7, fontStyle: 'bold' },
                bodyStyles: { textColor: [15, 23, 42], fontSize: 9, cellPadding: 6 },
                columnStyles: { 1: { halign: 'right', fontStyle: 'bold', fontSize: 11 } },
                alternateRowStyles: { fillColor: [255, 255, 255] },
                margin: { left: 20, right: 20 },
                theme: 'grid',
                styles: { lineColor: [241, 245, 249] }
            });

            // 4. TOTALS
            currentY = doc.lastAutoTable.finalY + 15;

            doc.setFillColor(...accentBg);
            doc.roundedRect(pageWidth - 90, currentY, 70, 45, 5, 5, 'F');

            let totalY = currentY + 10;
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.text('SUBTOTAL NETO', pageWidth - 80, totalY);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(`$${(cotizacion.subtotal_anual || 0).toLocaleString()}`, pageWidth - 30, totalY, { align: 'right' });

            if (cotizacion.descuento_monto > 0) {
                totalY += 7;
                doc.setFontSize(7);
                doc.setTextColor(200, 255, 200);
                doc.text(`DESCUENTO (${cotizacion.descuento_porcentaje}%)`, pageWidth - 80, totalY);
                doc.text(`-$${(cotizacion.descuento_monto || 0).toLocaleString()}`, pageWidth - 30, totalY, { align: 'right' });
                doc.setTextColor(255, 255, 255);
            }

            totalY += 7;
            doc.setFontSize(7);
            doc.text(`IVA (${cotizacion.iva_porcentaje || 13}%)`, pageWidth - 80, totalY);
            doc.text(`$${(cotizacion.iva_monto || 0).toLocaleString()}`, pageWidth - 30, totalY, { align: 'right' });

            totalY += 4;
            doc.setDrawColor(255, 255, 255, 0.2);
            doc.line(pageWidth - 80, totalY, pageWidth - 30, totalY);

            totalY += 8;
            doc.setFontSize(8);
            doc.text('TOTAL INVERSIÓN ANUAL', pageWidth - 80, totalY);
            doc.setFontSize(16);
            doc.text(`$${(cotizacion.total_anual || 0).toLocaleString()}`, pageWidth - 30, totalY + 6, { align: 'right' });

            // Notes
            doc.setTextColor(...accentBg);
            doc.setFontSize(8);
            doc.text('NOTAS Y CONDICIONES', 20, currentY);
            doc.setTextColor(...textMuted);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'italic');
            const notes = cotizacion.notes || 'Esta propuesta tiene una validez de 30 días calendario. Los precios no incluyen impuestos locales adicionales a los detallados. SaaS Pro garantiza un SLA del 99.9% en todos los servicios detallados.';
            doc.text(doc.splitTextToSize(notes, 80), 20, currentY + 7);

            // 5. FOOTER (Agent Info)
            const footerY = pageHeight - 40;
            doc.setFillColor(249, 250, 251);
            doc.rect(0, footerY, pageWidth, 40, 'F');
            doc.setDrawColor(226, 232, 240);
            doc.line(0, footerY, pageWidth, footerY);

            // Agent logo/name
            doc.setTextColor(...accentBg);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text('PROPUESTA ELABORADA POR', 20, footerY + 12);

            doc.setTextColor(...darkBg);
            doc.setFontSize(12);
            doc.text((cotizacion.creator?.full_name || 'AGENTE COMERCIAL').toUpperCase(), 20, footerY + 20);

            doc.setTextColor(...textMuted);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.text(`${cotizacion.creator?.email || 'ventas@ariasdefense.com'}`, 20, footerY + 26);

            // Right side footer
            doc.setTextColor(...accentBg);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text(`${(cotizacion.company?.name || 'ARIAS DEFENSE').toUpperCase()} - ${new Date().getFullYear()}`, pageWidth - 20, footerY + 15, { align: 'right' });

            doc.setTextColor(...textMuted);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.text('DOCUMENTO OFICIAL', pageWidth - 20, footerY + 30, { align: 'right' });

            // GENERATE BLOB & UPLOAD
            const pdfBlob = doc.output('blob');
            const fileName = `propuesta_${cotizacion.id.slice(0, 8)}_${Date.now()}.pdf`;

            const { error: uploadError } = await supabase.storage
                .from('quotations')
                .upload(fileName, pdfBlob, {
                    contentType: 'application/pdf',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('quotations')
                .getPublicUrl(fileName);

            return data.publicUrl;

        } catch (err: any) {
            console.error('ERROR PDF PREMIUM:', err);
            throw new Error(`Falla en PDF Premium: ${err.message}`);
        }
    }
};
