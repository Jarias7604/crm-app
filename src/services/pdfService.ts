import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { supabase } from './supabase';

export const pdfService = {
    async generateAndUploadQuotePDF(cotizacion: any): Promise<string> {
        try {
            console.log('Iniciando PDF para:', cotizacion.id);
            // Create PDF
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();

            // Colors
            const primaryColor = [68, 73, 170];
            const secondaryColor = [15, 23, 42];

            // Header
            doc.setFillColor(15, 23, 42);
            doc.rect(0, 0, pageWidth, 40, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.text('PROPUESTA COMERCIAL', 20, 25);

            // Body
            doc.setTextColor(15, 23, 42);
            doc.setFontSize(14);
            doc.text('CLIENTE:', 20, 55);
            doc.setFontSize(11);
            doc.text(String(cotizacion.nombre_cliente || 'Cliente'), 20, 65);
            doc.text(String(cotizacion.empresa_cliente || ''), 20, 72);

            // Items Table
            const rows = [];
            rows.push([
                'Suscripción ' + String(cotizacion.plan_nombre || 'Base'),
                '$' + (cotizacion.costo_plan_anual?.toLocaleString() || '0')
            ]);

            if (cotizacion.modulos_adicionales && Array.isArray(cotizacion.modulos_adicionales)) {
                cotizacion.modulos_adicionales.forEach((m: any) => {
                    rows.push([m.nombre, '$' + (m.costo_anual?.toLocaleString() || '0')]);
                });
            }

            (doc as any).autoTable({
                startY: 85,
                head: [['Servicio', 'Precio Anual']],
                body: rows,
                headStyles: { fillColor: primaryColor }
            });

            const finalY = (doc as any).lastAutoTable.finalY + 20;
            doc.setFontSize(16);
            doc.text(`TOTAL: $${cotizacion.total_anual?.toLocaleString() || '0'}`, pageWidth - 20, finalY, { align: 'right' });

            // To Blob
            const blob = doc.output('blob');
            const fileName = `propuesta_${Date.now()}.pdf`;

            console.log('Subiendo a storage...');
            const { error: uploadError } = await supabase.storage
                .from('quotations')
                .upload(fileName, blob, {
                    contentType: 'application/pdf',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('quotations')
                .getPublicUrl(fileName);

            console.log('PDF OK:', data.publicUrl);
            return data.publicUrl;
        } catch (err: any) {
            console.error('ERROR PDF SERVICE:', err);
            throw new Error(`Error en PDF: ${err.message || 'Falla desconocida'}`);
        }
    }
};
