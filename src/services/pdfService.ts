// @ts-nocheck
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from './supabase';
import { format } from 'date-fns';

export const pdfService = {
    async generateAndUploadQuotePDF(cotizacion: any): Promise<string> {
        try {
            console.log(`Generando PDF Safe Mode [v${Date.now()}]...`, cotizacion.id);

            // 1. Setup Basic
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            // Colores
            const slate900 = [15, 23, 42];
            const indigoColor = [68, 73, 170];

            // ---------------------------------------------------------
            // HEADER
            // ---------------------------------------------------------
            doc.setFillColor(15, 23, 42); // slate900
            doc.rect(0, 0, pageWidth, 55, 'F');

            // Logo Text
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text((cotizacion.company?.name || 'ARIAS DEFENSE COMPONENTS').toUpperCase(), 20, 22);

            // Contact
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(148, 163, 184); // textMuted
            doc.text(`${cotizacion.company?.address || 'COL. LA MASCOTA, SAN SALVADOR, EL SALVADOR'}`, 20, 28);

            // Metadata Right
            doc.setTextColor(68, 73, 170); // indigo
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text('COTIZACIÓN OFICIAL', pageWidth - 20, 18, { align: 'right' });

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(28);
            doc.setFont('helvetica', 'normal');
            doc.text(String(cotizacion.id).slice(0, 8).toUpperCase(), pageWidth - 20, 32, { align: 'right' });

            // ---------------------------------------------------------
            // CLIENT
            // ---------------------------------------------------------
            let currentY = 75;
            doc.setTextColor(68, 73, 170);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('CLIENTE RECEPTOR', 20, currentY);

            currentY += 12;
            doc.setTextColor(15, 23, 42);
            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');
            doc.text(String(cotizacion.nombre_cliente).toUpperCase(), 20, currentY);

            // ---------------------------------------------------------
            // TABLE (Safe V4 Implementation)
            // ---------------------------------------------------------
            const tableRows = [];
            tableRows.push([
                `Licencia Anual ${cotizacion.plan_nombre || 'Base'}`,
                `$${(cotizacion.costo_plan_anual || 0).toLocaleString()}`
            ]);

            if (cotizacion.modulos_adicionales && Array.isArray(cotizacion.modulos_adicionales)) {
                cotizacion.modulos_adicionales.forEach((m: any) => {
                    tableRows.push([m.nombre, `$${(m.costo_anual || 0).toLocaleString()}`]);
                });
            }

            // Invocar autoTable directamente (Patrón bb3d801 que funcionó)
            autoTable(doc, {
                startY: 130,
                head: [['SERVICIO', 'INVERSIÓN']],
                body: tableRows,
                headStyles: { fillColor: [68, 73, 170], textColor: [255, 255, 255] },
                theme: 'grid'
            });

            // ---------------------------------------------------------
            // TOTALS
            // ---------------------------------------------------------
            const finalY = (doc as any).lastAutoTable?.finalY + 20 || 180;

            doc.setTextColor(15, 23, 42);
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text(`TOTAL: $${(cotizacion.total_anual || 0).toLocaleString()}`, pageWidth - 20, finalY, { align: 'right' });

            // Output
            const pdfBlob = doc.output('blob');
            const fileName = `propuesta_final_${Date.now()}.pdf`;

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
            console.error('PDF FAILURE:', err);
            // Fallback extremo
            return 'https://via.placeholder.com/150';
        }
    }
};
