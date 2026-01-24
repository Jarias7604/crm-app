import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { supabase } from './supabase';

export const pdfService = {
    async generateAndUploadQuotePDF(cotizacion: any): Promise<string> {
        try {
            console.log('Iniciando generación de PDF para cotización:', cotizacion.id);
            const doc = new jsPDF() as any;
            const pageWidth = doc.internal.pageSize.getWidth();

            // Colors
            const primaryColor = [68, 73, 170]; // #4449AA
            const secondaryColor = [15, 23, 42]; // Slate 900

            // Header
            doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
            doc.rect(0, 0, pageWidth, 40, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text('PROPUESTA COMERCIAL', 20, 25);

            doc.setFontSize(10);
            doc.text(`ID: ${cotizacion.id.substring(0, 8).toUpperCase()}`, pageWidth - 20, 15, { align: 'right' });
            doc.text(`Fecha: ${new Date().toLocaleDateString()}`, pageWidth - 20, 25, { align: 'right' });

            // Client Info
            doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
            doc.setFontSize(14);
            doc.text('INFORMACIÓN DEL CLIENTE', 20, 55);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Cliente: ${cotizacion.nombre_cliente}`, 20, 65);
            doc.text(`Empresa: ${cotizacion.empresa_cliente || 'N/A'}`, 20, 72);
            doc.text(`Email: ${cotizacion.email_cliente || 'N/A'}`, 20, 79);
            doc.text(`Teléfono: ${cotizacion.telefono_cliente || 'N/A'}`, 20, 86);

            // Table of items
            const tableRows = [];
            tableRows.push([
                'Suscripción Anual - Plan ' + cotizacion.plan_nombre,
                '1',
                `$${cotizacion.costo_plan_anual?.toLocaleString() || '0'}`,
                `$${cotizacion.costo_plan_anual?.toLocaleString() || '0'}`
            ]);

            if (cotizacion.modulos_adicionales && Array.isArray(cotizacion.modulos_adicionales)) {
                cotizacion.modulos_adicionales.forEach((m: any) => {
                    tableRows.push([m.nombre, '1', `$${m.costo_anual?.toLocaleString() || '0'}`, `$${m.costo_anual?.toLocaleString() || '0'}`]);
                });
            }

            (doc as any).autoTable({
                startY: 100,
                head: [['Concepto', 'Cant.', 'Precio Unit.', 'Subtotal']],
                body: tableRows,
                headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] },
            });

            const finalY = (doc as any).lastAutoTable.finalY + 15;
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
            doc.text(`TOTAL INVERSIÓN: $${cotizacion.total_anual?.toLocaleString() || '0'}`, pageWidth - 20, finalY, { align: 'right' });

            // Generate Blob - More robust way
            const pdfOutput = doc.output('arraybuffer');
            const pdfBlob = new Blob([pdfOutput], { type: 'application/pdf' });

            const fileName = `propuesta_${cotizacion.id}.pdf`;
            const filePath = `${fileName}`;

            console.log('Subiendo PDF a Supabase Storage...');
            const { error } = await supabase.storage
                .from('quotations')
                .upload(filePath, pdfBlob, {
                    contentType: 'application/pdf',
                    upsert: true
                });

            if (error) {
                console.error('Error de Storage:', error);
                throw error;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('quotations')
                .getPublicUrl(filePath);

            console.log('PDF generado exitosamente:', publicUrl);
            return publicUrl;
        } catch (err) {
            console.error('Falla crítica en pdfService:', err);
            throw err;
        }
    }
};
