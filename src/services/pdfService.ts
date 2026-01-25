// @ts-nocheck
import { jsPDF } from 'jspdf';
import { supabase } from './supabase';
import { format } from 'date-fns';

// NOTA: Versión simplificada para validar despliegue en Vercel.
// Si esta versión funciona (Círculo Verde), el problema era la librería de tablas.

export const pdfService = {
    async generateAndUploadQuotePDF(cotizacion: any): Promise<string> {
        try {
            console.log(`Generando PDF DIAGNOSTICO [v${Date.now()}]...`, cotizacion.id);

            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();

            // ---------------------------------------------------------
            // HEADER SIMPLE
            // ---------------------------------------------------------
            doc.setFillColor(15, 23, 42);
            doc.rect(0, 0, pageWidth, 40, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(16);
            doc.text('ARIAS DEFENSE - PRUEBA DE SISTEMA', 20, 25);

            // ---------------------------------------------------------
            // BODY SIMPLE
            // ---------------------------------------------------------
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(12);
            doc.text(`Cotización: ${cotizacion.id}`, 20, 60);
            doc.text(`Cliente: ${cotizacion.nombre_cliente}`, 20, 70);
            doc.text(`Plan: ${cotizacion.plan_nombre}`, 20, 80);
            doc.text(`Total: $${(cotizacion.total_anual || 0).toLocaleString()}`, 20, 90);

            doc.text('NOTA: Este es un PDF de diagnóstico para restaurar el servicio.', 20, 110);
            doc.text('Si ves esto, el sistema se ha recuperado exitosamente.', 20, 120);

            // ---------------------------------------------------------
            // GENERAR
            // ---------------------------------------------------------
            const pdfBlob = doc.output('blob');
            const fileName = `propuesta_diag_${Date.now()}.pdf`;

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
            throw err;
        }
    }
};
