import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from './supabase';
import { format } from 'date-fns';

export const pdfService = {
    async generateAndUploadQuotePDF(cotizacion: any): Promise<string> {
        try {
            console.log('Generando PDF Premium...', cotizacion.id);
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            // Colors
            const darkBg = [15, 23, 42] as [number, number, number];
            const accentBg = [68, 73, 170] as [number, number, number];
            const textMuted = [100, 116, 139] as [number, number, number];

            // 1. HEADER
            doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
            doc.rect(0, 0, pageWidth, 45, 'F');

            // Company Info
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
            doc.setTextColor(accentBg[0], accentBg[1], accentBg[2]);
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
            doc.setTextColor(accentBg[0], accentBg[1], accentBg[2]);
            doc.setFontSize(9);
            doc.text('CLIENTE RECEPTOR', 20, currentY);

            currentY += 10;
            doc.setTextColor(darkBg[0], darkBg[1], darkBg[2]);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text(String(cotizacion.nombre_cliente || 'CLIENTE').toUpperCase(), 20, currentY);

            if (cotizacion.empresa_cliente) {
                currentY += 7;
                doc.setFontSize(11);
                doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
                doc.text(cotizacion.empresa_cliente, 20, currentY);
            }

            // Executive Summary Box (Right)
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(pageWidth - 85, 60, 65, 30, 3, 3, 'F');
            doc.setTextColor(accentBg[0], accentBg[1], accentBg[2]);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text('RESUMEN EJECUTIVO', pageWidth - 52.5, 68, { align: 'center' });

            doc.setTextColor(darkBg[0], darkBg[1], darkBg[2]);
            doc.setFontSize(10);
            doc.text(`PLAN: ${cotizacion.plan_nombre || 'PERSONALIZADO'}`, pageWidth - 52.5, 75, { align: 'center' });
            doc.setFontSize(8);
            doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
            doc.text(`VOLUMEN: ${(cotizacion.volumen_dtes || 0).toLocaleString()} DTEs/año`, pageWidth - 52.5, 82, { align: 'center' });

            currentY = 105;
            doc.setTextColor(accentBg[0], accentBg[1], accentBg[2]);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text('DESGLOSE DE INVERSIÓN', 20, currentY);

            const tableRows = [];
            tableRows.push([
                `LICENCIA ANUAL ${cotizacion.plan_nombre || 'BASE'}\nIncluye suite DTE y soporte técnico base.`,
                `$${(cotizacion.costo_plan_anual || 0).toLocaleString()}`
            ]);

            if (cotizacion.incluir_implementacion) {
                tableRows.push([
                    'IMPLEMENTACIÓN Y CONFIGURACIÓN (PAGO ÚNICO)\nPuesta en marcha, capacitación y configuración inicial.',
                    `$${(cotizacion.costo_implementacion || 0).toLocaleString()}`
                ]);
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
                tableRows.push([
                    'NOTIFICACIONES SMART-WHATSAPP\nAutomatización de envíos y confirmación.',
                    `$${(cotizacion.costo_whatsapp || 0).toLocaleString()}`
                ]);
            }

            if (cotizacion.servicio_personalizacion) {
                tableRows.push([
                    'PERSONALIZACIÓN DE MARCA (WHITE-LABEL)\nAdaptación total a su identidad corporativa.',
                    `$${(cotizacion.costo_personalizacion || 0).toLocaleString()}`
                ]);
            }

            autoTable(doc, {
                startY: currentY + 5,
                head: [['DESCRIPCIÓN DEL SERVICIO', 'INVERSIÓN (USD)']],
                body: tableRows,
                headStyles: { fillColor: [249, 250, 251], textColor: [100, 116, 139], fontSize: 7, fontStyle: 'bold' },
                bodyStyles: { textColor: [15, 23, 42], fontSize: 9, cellPadding: 6 },
                columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
                alternateRowStyles: { fillColor: [255, 255, 255] },
                margin: { left: 20, right: 20 },
                theme: 'grid',
                styles: { lineColor: [241, 245, 249] }
            });

            currentY = (doc as any).lastAutoTable.finalY + 15;

            doc.setFillColor(accentBg[0], accentBg[1], accentBg[2]);
            doc.roundedRect(pageWidth - 90, currentY, 70, 40, 5, 5, 'F');

            let totalY = currentY + 10;
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(7);
            doc.text('SUBTOTAL NETO', pageWidth - 80, totalY);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(`$${(cotizacion.subtotal_anual || 0).toLocaleString()}`, pageWidth - 30, totalY, { align: 'right' });

            totalY += 7;
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.text(`IVA (${cotizacion.iva_porcentaje || 13}%)`, pageWidth - 80, totalY);
            doc.text(`$${(cotizacion.iva_monto || 0).toLocaleString()}`, pageWidth - 30, totalY, { align: 'right' });

            totalY += 8;
            doc.setFontSize(8);
            doc.text('TOTAL INVERSIÓN', pageWidth - 80, totalY);
            doc.setFontSize(16);
            doc.text(`$${(cotizacion.total_anual || 0).toLocaleString()}`, pageWidth - 30, totalY + 6, { align: 'right' });

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
            console.error('ERROR PDF:', err);
            throw new Error(`Falla en PDF: ${err.message}`);
        }
    }
};
