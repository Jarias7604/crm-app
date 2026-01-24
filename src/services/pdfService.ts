import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { supabase } from './supabase';

export const pdfService = {
    async generateAndUploadQuotePDF(cotizacion: any): Promise<string> {
        try {
            console.log('Iniciando PDF:', cotizacion.id);

            // Usar constructor seguro
            const DocConstructor = (jsPDF as any).jsPDF || jsPDF;
            const doc = new DocConstructor();

            const pageWidth = doc.internal.pageSize.getWidth();

            // Header Negro Profesional
            doc.setFillColor(15, 23, 42);
            doc.rect(0, 0, pageWidth, 40, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.text('PROPUESTA COMERCIAL', 20, 25);

            // Datos Cliente
            doc.setTextColor(15, 23, 42);
            doc.setFontSize(12);
            doc.text(`CLIENTE: ${cotizacion.nombre_cliente || 'Valorado Cliente'}`, 20, 55);
            if (cotizacion.empresa_cliente) doc.text(cotizacion.empresa_cliente, 20, 62);

            // Tabla Simple (Convertir todo a String para evitar fallos)
            const rows = [];
            rows.push([
                'Suscripcion ' + String(cotizacion.plan_nombre || 'Base'),
                '$' + String(cotizacion.costo_plan_anual || '0')
            ]);

            if (cotizacion.modulos_adicionales && Array.isArray(cotizacion.modulos_adicionales)) {
                cotizacion.modulos_adicionales.forEach((m: any) => {
                    rows.push([String(m.nombre), '$' + String(m.costo_anual || '0')]);
                });
            }

            // Plugin AutoTable
            if ((doc as any).autoTable) {
                (doc as any).autoTable({
                    startY: 75,
                    head: [['Descripcion', 'Precio Anual']],
                    body: rows,
                    headStyles: { fillColor: [68, 73, 170] }
                });
            } else {
                // Fallback si el plugin no carga
                doc.text('Detalle de inversion:', 20, 80);
                rows.forEach((r, i) => doc.text(`${r[0]}: ${r[1]}`, 25, 90 + (i * 7)));
            }

            const finalY = (doc as any).lastAutoTable?.finalY || 150;
            doc.setFontSize(16);
            doc.text(`TOTAL ANUAL: $${String(cotizacion.total_anual || '0')}`, pageWidth - 20, finalY + 20, { align: 'right' });

            // Generar Blob
            const pdfData = doc.output('blob');
            const fileName = `prop_ready_${Date.now()}.pdf`;

            console.log('Subiendo...');
            const { error: uploadError } = await supabase.storage
                .from('quotations')
                .upload(fileName, pdfData, {
                    contentType: 'application/pdf',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('quotations')
                .getPublicUrl(fileName);

            return data.publicUrl;
        } catch (err: any) {
            console.error('PDF ERROR:', err);
            throw err;
        }
    }
};
