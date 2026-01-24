// @ts-nocheck
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from './supabase';
import { format } from 'date-fns';

export const pdfService = {
    async generateAndUploadQuotePDF(cotizacion: any): Promise<string> {
        try {
            console.log(`Generando PDF Premium 1:1 [v${Date.now()}]...`, cotizacion.id);

            // Instancia segura
            const doc = new jsPDF() as any;
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            // Colores
            const slate900 = [15, 23, 42];
            const indigoColor = [68, 73, 170];
            const textMuted = [100, 116, 139];

            // ---------------------------------------------------------
            // 1. HEADER
            // ---------------------------------------------------------
            doc.setFillColor(slate900[0], slate900[1], slate900[2]);
            doc.rect(0, 0, pageWidth, 55, 'F');

            // Logo / Nombre
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text((cotizacion.company?.name || 'ARIAS DEFENSE COMPONENTS').toUpperCase(), 20, 22);

            // Contacto
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(148, 163, 184);
            doc.text(`${cotizacion.company?.address || 'COL. LA MASCOTA, SAN SALVADOR, EL SALVADOR'}`, 20, 28);
            doc.text(`${cotizacion.company?.phone || '+503 7971 8911'}  |  ${cotizacion.company?.website || 'WWW.ARIASDEFENSE.COM'}`, 20, 32);

            // Metadata Der.
            doc.setTextColor(indigoColor[0], indigoColor[1], indigoColor[2]);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text('COTIZACIÓN OFICIAL', pageWidth - 20, 18, { align: 'right' });

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(28);
            doc.setFont('helvetica', 'normal');
            doc.text(String(cotizacion.id).slice(0, 8).toUpperCase(), pageWidth - 20, 32, { align: 'right' });

            doc.setDrawColor(30, 41, 59);
            doc.line(pageWidth - 80, 38, pageWidth - 20, 38);

            doc.setFontSize(7);
            doc.setTextColor(148, 163, 184);
            doc.text('FECHA EMISIÓN', pageWidth - 80, 43);
            doc.text('REFERENCIA ID', pageWidth - 45, 43);

            doc.setTextColor(241, 245, 249);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(format(new Date(cotizacion.created_at || Date.now()), 'dd/MM/yyyy'), pageWidth - 80, 48);
            doc.text(String(cotizacion.id).slice(0, 6).toUpperCase(), pageWidth - 45, 48);

            // ---------------------------------------------------------
            // 2. CLIENTE
            // ---------------------------------------------------------
            let currentY = 75;
            doc.setTextColor(indigoColor[0], indigoColor[1], indigoColor[2]);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('CLIENTE RECEPTOR', 20, currentY);

            currentY += 12;
            doc.setTextColor(slate900[0], slate900[1], slate900[2]);
            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');
            doc.text(String(cotizacion.nombre_cliente).toUpperCase(), 20, currentY);

            if (cotizacion.empresa_cliente) {
                currentY += 8;
                doc.setFontSize(11);
                doc.setTextColor(indigoColor[0], indigoColor[1], indigoColor[2]);
                doc.text(String(cotizacion.empresa_cliente).toUpperCase(), 20, currentY);
            }

            // Summary Box
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(pageWidth - 85, 70, 65, 35, 4, 4, 'F');
            doc.setDrawColor(241, 245, 249);
            doc.roundedRect(pageWidth - 85, 70, 65, 35, 4, 4, 'S');

            doc.setTextColor(indigoColor[0], indigoColor[1], indigoColor[2]);
            doc.setFontSize(8);
            doc.text('RESUMEN EJECUTIVO', pageWidth - 52.5, 78, { align: 'center' });

            doc.setTextColor(slate900[0], slate900[1], slate900[2]);
            doc.setFontSize(12);
            doc.text(`${cotizacion.plan_nombre}`, pageWidth - 52.5, 88, { align: 'center' });
            doc.setFontSize(8);
            doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
            doc.text(`${(cotizacion.volumen_dtes || 0).toLocaleString()} DTEs/año`, pageWidth - 52.5, 95, { align: 'center' });

            // ---------------------------------------------------------
            // 3. TABLE
            // ---------------------------------------------------------
            const tableRows = [];
            tableRows.push([
                `Licencia Anual ${cotizacion.plan_nombre}\nIncluye suite DTE y soporte técnico base.`,
                `$${(cotizacion.costo_plan_anual || 0).toLocaleString()}`
            ]);

            if (cotizacion.incluir_implementacion) {
                tableRows.push(['Implementación y Configuración (PAGO ÚNICO)\nPuesta en marcha, capacitación y configuración inicial.', `$${(cotizacion.costo_implementacion || 0).toLocaleString()}`]);
            }

            if (cotizacion.modulos_adicionales && Array.isArray(cotizacion.modulos_adicionales)) {
                cotizacion.modulos_adicionales.forEach((m: any) => {
                    tableRows.push([
                        `${m.nombre}\nServicio complementario activado.`,
                        `$${(m.costo_anual || 0).toLocaleString()}`
                    ]);
                });
            }

            if (cotizacion.servicio_whatsapp) {
                tableRows.push(['Notificaciones Smart-WhatsApp\nAutomatización de envíos y confirmación.', `$${(cotizacion.costo_whatsapp || 0).toLocaleString()}`]);
            }

            if (cotizacion.servicio_personalizacion) {
                tableRows.push([
                    'Personalización de Marca (White-label)\nAdaptación total a su identidad corporativa.',
                    `$${(cotizacion.costo_personalizacion || 0).toLocaleString()}`
                ]);
            }

            // USO EXPLÍCITO DE AUTOTABLE (ESTANDAR V5)
            // Se garantiza que autoTable se llame como función (Safest for modular environments)
            try {
                if (typeof autoTable === 'function') {
                    autoTable(doc, {
                        startY: 130,
                        head: [['DESCRIPCIÓN DEL SERVICIO', 'INVERSIÓN (USD)']],
                        body: tableRows,
                        headStyles: { fillColor: [249, 250, 251], textColor: [100, 116, 139], fontSize: 8, fontStyle: 'bold' },
                        bodyStyles: { textColor: slate900, fontSize: 10, cellPadding: 8 },
                        columnStyles: {
                            0: { cellWidth: 130 },
                            1: { halign: 'right', fontStyle: 'bold', fontSize: 11 }
                        },
                        alternateRowStyles: { fillColor: [255, 255, 255] },
                        margin: { left: 20, right: 20 },
                        theme: 'grid',
                        styles: { lineColor: [241, 245, 249] }
                    });
                } else {
                    // Fallback por si la librería se comporta como plugin
                    (doc as any).autoTable({
                        startY: 130,
                        head: [['DESCRIPCIÓN DEL SERVICIO', 'INVERSIÓN (USD)']],
                        body: tableRows,
                        headStyles: { fillColor: [249, 250, 251], textColor: [100, 116, 139], fontSize: 8, fontStyle: 'bold' },
                        bodyStyles: { textColor: slate900, fontSize: 10, cellPadding: 8 },
                        columnStyles: {
                            0: { cellWidth: 130 },
                            1: { halign: 'right', fontStyle: 'bold', fontSize: 11 }
                        },
                        alternateRowStyles: { fillColor: [255, 255, 255] },
                        margin: { left: 20, right: 20 },
                        theme: 'grid',
                        styles: { lineColor: [241, 245, 249] }
                    });
                }
            } catch (e) {
                console.warn('Fallback table generation triggered', e);
                // Ultimo recurso: texto plano si falla la tabla
                let y = 130;
                tableRows.forEach(row => {
                    doc.text(`${row[0]} - ${row[1]}`, 20, y);
                    y += 10;
                });
            }


            // ---------------------------------------------------------
            // 4. TOTALS
            // ---------------------------------------------------------
            const finalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 20 : 150;

            const boxHeight = 60;
            const drawY = finalY + boxHeight > pageHeight ? 20 : finalY;
            if (drawY === 20) doc.addPage();

            doc.setFillColor(indigoColor[0], indigoColor[1], indigoColor[2]);
            doc.roundedRect(pageWidth - 100, drawY, 80, 50, 6, 6, 'F');

            let totalCursor = drawY + 12;

            // Subtotal
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text('SUBTOTAL NETO', pageWidth - 90, totalCursor);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(`$${(cotizacion.subtotal_anual || 0).toLocaleString()}`, pageWidth - 30, totalCursor, { align: 'right' });

            // IVA
            totalCursor += 10;
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(`IVA (${cotizacion.iva_porcentaje || 13}%)`, pageWidth - 90, totalCursor);
            doc.text(`$${(cotizacion.iva_monto || 0).toLocaleString()}`, pageWidth - 30, totalCursor, { align: 'right' });

            // Linea
            totalCursor += 6;
            doc.setDrawColor(255, 255, 255, 0.2);
            doc.line(pageWidth - 90, totalCursor, pageWidth - 30, totalCursor);

            // Grand Total
            totalCursor += 12;
            doc.setFontSize(9);
            doc.text('TOTAL A INVERTIR', pageWidth - 90, totalCursor);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text(`$${(cotizacion.total_anual || 0).toLocaleString()}`, pageWidth - 30, totalCursor + 4, { align: 'right' });

            // ---------------------------------------------------------
            // 5. FOOTER
            // ---------------------------------------------------------
            doc.setFillColor(249, 250, 251);
            doc.rect(0, pageHeight - 35, pageWidth, 35, 'F');

            const footerY = pageHeight - 15;
            doc.setTextColor(slate900[0], slate900[1], slate900[2]);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text((cotizacion.creator?.full_name || 'AGENTE COMERCIAL').toUpperCase(), 20, footerY - 5);

            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
            doc.text((cotizacion.creator?.email || 'ventas@ariasdefense.com').toUpperCase(), 20, footerY + 5);

            doc.text('DOCUMENTO OFICIAL', pageWidth - 20, footerY + 5, { align: 'right' });

            // Generar
            const pdfBlob = doc.output('blob');
            const fileName = `propuesta_${Date.now()}.pdf`;

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
            console.error('ERROR CRITICO PDF:', err);
            throw err;
        }
    }
};
