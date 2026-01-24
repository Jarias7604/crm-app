// @ts-nocheck
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { supabase } from './supabase';
import { format } from 'date-fns';

export const pdfService = {
    async generateAndUploadQuotePDF(cotizacion: any): Promise<string> {
        try {
            console.log('Generando PDF Premium 1:1...', cotizacion.id);
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            // Colores Corporativos
            const slate900 = [15, 23, 42];
            const indigoColor = [68, 73, 170];

            // 1. HEADER
            doc.setFillColor(15, 23, 42);
            doc.rect(0, 0, pageWidth, 55, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text((cotizacion.company?.name || 'ARIAS DEFENSE COMPONENTS').toUpperCase(), 20, 22);

            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(148, 163, 184);
            doc.text(`${cotizacion.company?.address || 'COL. LA MASCOTA, SAN SALVADOR, EL SALVADOR'}`, 20, 28);
            doc.text(`${cotizacion.company?.phone || '+503 7971 8911'}  |  ${cotizacion.company?.website || 'WWW.ARIASDEFENSE.COM'}`, 20, 32);

            // Metadata Right
            doc.setTextColor(68, 73, 170);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text('COTIZACIÓN OFICIAL', pageWidth - 20, 18, { align: 'right' });

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(28);
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

            // 2. CLIENTE
            let currentY = 75;
            doc.setTextColor(68, 73, 170);
            doc.setFontSize(10);
            doc.text('CLIENTE RECEPTOR', 20, currentY);

            currentY += 12;
            doc.setTextColor(15, 23, 42);
            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');
            doc.text(String(cotizacion.nombre_cliente).toUpperCase(), 20, currentY);

            if (cotizacion.empresa_cliente) {
                currentY += 8;
                doc.setFontSize(11);
                doc.setTextColor(68, 73, 170);
                doc.text(String(cotizacion.empresa_cliente).toUpperCase(), 20, currentY);
            }

            // Executive Summary Box
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(pageWidth - 85, 70, 65, 35, 4, 4, 'F');
            doc.setTextColor(68, 73, 170);
            doc.setFontSize(8);
            doc.text('RESUMEN EJECUTIVO', pageWidth - 52.5, 78, { align: 'center' });
            doc.setTextColor(15, 23, 42);
            doc.setFontSize(12);
            doc.text(`${cotizacion.plan_nombre}`, pageWidth - 52.5, 88, { align: 'center' });

            // 3. TABLA
            const tableRows: any[][] = [];
            tableRows.push([
                `Licencia Anual ${cotizacion.plan_nombre}\nIncluye suite DTE y soporte técnico base.`,
                `$${(cotizacion.costo_plan_anual || 0).toLocaleString()}`
            ]);

            if (cotizacion.incluir_implementacion) {
                tableRows.push(['Implementación y Configuración (PAGO ÚNICO)', `$${(cotizacion.costo_implementacion || 0).toLocaleString()}`]);
            }

            if (cotizacion.modulos_adicionales && Array.isArray(cotizacion.modulos_adicionales)) {
                cotizacion.modulos_adicionales.forEach(m => {
                    tableRows.push([m.nombre, `$${(m.costo_anual || 0).toLocaleString()}`]);
                });
            }

            if (cotizacion.servicio_whatsapp) {
                tableRows.push(['Notificaciones Smart-WhatsApp', `$${(cotizacion.costo_whatsapp || 0).toLocaleString()}`]);
            }

            doc.autoTable({
                startY: 120,
                head: [['DESCRIPCIÓN DEL SERVICIO', 'INVERSIÓN (USD)']],
                body: tableRows,
                headStyles: { fillColor: [249, 250, 251], textColor: [100, 116, 139], fontStyle: 'bold' },
                columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
                theme: 'grid'
            });

            // 4. TOTALS
            const finalY = (doc as any).lastAutoTable.finalY + 15;
            doc.setFillColor(68, 73, 170);
            doc.roundedRect(pageWidth - 100, finalY, 80, 50, 8, 8, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.text('TOTAL A INVERTIR', pageWidth - 90, finalY + 15);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text(`$${(cotizacion.total_anual || 0).toLocaleString()}`, pageWidth - 30, finalY + 30, { align: 'right' });

            // 5. SUBIDA
            const pdfBlob = doc.output('blob');
            const fileName = `propuesta_${Date.now()}.pdf`;
            const { error: uploadError } = await supabase.storage.from('quotations').upload(fileName, pdfBlob, { contentType: 'application/pdf', upsert: true });

            if (uploadError) throw uploadError;
            const { data } = supabase.storage.from('quotations').getPublicUrl(fileName);
            return data.publicUrl;

        } catch (err: any) {
            console.error('ERROR PDF Build:', err);
            throw err;
        }
    }
};
