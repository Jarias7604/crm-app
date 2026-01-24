import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { supabase } from './supabase';

export const pdfService = {
    async generateAndUploadQuotePDF(cotizacion: any): Promise<string> {
        const doc = new jsPDF() as any;
        const pageWidth = doc.internal.pageSize.getWidth();

        // Colors
        const primaryColor = [68, 73, 170]; // #4449AA
        const secondaryColor = [15, 23, 42]; // Slate 900

        // Header
        doc.setFillColor(...secondaryColor);
        doc.rect(0, 0, pageWidth, 40, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('PROPUESTA COMERCIAL', 20, 25);

        doc.setFontSize(10);
        doc.text(`ID: ${cotizacion.id.substring(0, 8).toUpperCase()}`, pageWidth - 20, 15, { align: 'right' });
        doc.text(`Fecha: ${new Date(cotizacion.created_at).toLocaleDateString()}`, pageWidth - 20, 25, { align: 'right' });

        // Client Info
        doc.setTextColor(...secondaryColor);
        doc.setFontSize(14);
        doc.text('INFORMACIÓN DEL CLIENTE', 20, 55);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Cliente: ${cotizacion.nombre_cliente}`, 20, 65);
        doc.text(`Empresa: ${cotizacion.empresa_cliente || 'N/A'}`, 20, 72);
        doc.text(`Email: ${cotizacion.email_cliente || 'N/A'}`, 20, 79);
        doc.text(`Teléfono: ${cotizacion.telefono_cliente || 'N/A'}`, 20, 86);

        // Plan Summary
        doc.setTextColor(...primaryColor);
        doc.setFont('helvetica', 'bold');
        doc.text('RESUMEN DEL PLAN', 120, 55);

        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.text(`Plan Seleccionado: ${cotizacion.plan_nombre}`, 120, 65);
        doc.text(`Volumen Anual DTEs: ${cotizacion.volumen_dtes.toLocaleString()}`, 120, 72);

        // Table of items
        const tableRows = [];

        // Base Plan
        tableRows.push([
            'Suscripción Anual - Plan ' + cotizacion.plan_nombre,
            '1',
            `$${cotizacion.costo_plan_anual.toLocaleString()}`,
            `$${cotizacion.costo_plan_anual.toLocaleString()}`
        ]);

        // Implementation
        if (cotizacion.incluir_implementacion) {
            tableRows.push([
                'Servicio de Implementación y Capacitación',
                '1',
                `$${cotizacion.costo_implementacion.toLocaleString()}`,
                `$${cotizacion.costo_implementacion.toLocaleString()}`
            ]);
        }

        // Add-ons
        if (cotizacion.modulos_adicionales && Array.isArray(cotizacion.modulos_adicionales)) {
            cotizacion.modulos_adicionales.forEach((m: any) => {
                tableRows.push([
                    m.nombre,
                    '1',
                    `$${m.costo_anual.toLocaleString()}`,
                    `$${m.costo_anual.toLocaleString()}`
                ]);
            });
        }

        // WhatsApp
        if (cotizacion.servicio_whatsapp) {
            tableRows.push([
                'Servicio de Notificaciones WhatsApp',
                '1',
                `$${cotizacion.costo_whatsapp.toLocaleString()}`,
                `$${cotizacion.costo_whatsapp.toLocaleString()}`
            ]);
        }

        (doc as any).autoTable({
            startY: 100,
            head: [['Concepto', 'Cant.', 'Precio Unit.', 'Subtotal']],
            body: tableRows,
            headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [245, 247, 250] },
            margin: { left: 20, right: 20 }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 10;

        // Totals
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        const marginX = pageWidth - 70;

        doc.text(`Subtotal Anual:`, marginX, finalY);
        doc.text(`$${cotizacion.subtotal_anual.toLocaleString()}`, pageWidth - 20, finalY, { align: 'right' });

        if (cotizacion.descuento_monto > 0) {
            doc.setTextColor(220, 38, 38);
            doc.text(`Descuento (${cotizacion.descuento_porcentaje}%):`, marginX, finalY + 7);
            doc.text(`-$${cotizacion.descuento_monto.toLocaleString()}`, pageWidth - 20, finalY + 7, { align: 'right' });
            doc.setTextColor(0, 0, 0);
        }

        doc.text(`IVA (${cotizacion.iva_porcentaje}%):`, marginX, finalY + 14);
        doc.text(`$${cotizacion.iva_monto.toLocaleString()}`, pageWidth - 20, finalY + 14, { align: 'right' });

        doc.setFontSize(14);
        doc.setTextColor(...primaryColor);
        doc.text(`TOTAL INVERSIÓN:`, marginX, finalY + 25);
        doc.text(`$${cotizacion.total_anual.toLocaleString()}`, pageWidth - 20, finalY + 25, { align: 'right' });

        // Monthly Reference
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'italic');
        doc.text(`* Cuota mensual de referencia: $${cotizacion.total_mensual.toLocaleString()}`, marginX, finalY + 32);

        // Footer
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150, 150, 150);
        const footerText = 'Este documento es una propuesta formal de servicios. Su validez es de 15 días calendario.';
        doc.text(footerText, pageWidth / 2, 280, { align: 'center' });

        // Convert to Blob
        const pdfBlob = doc.output('blob');
        const fileName = `propuesta_${cotizacion.id}.pdf`;
        const filePath = `${fileName}`; // Usamos un path plano para evitar errores de carpetas

        // Upload to Supabase Storage (Using the PUBLIC 'quotations' bucket)
        const { error } = await supabase.storage
            .from('quotations')
            .upload(filePath, pdfBlob, {
                contentType: 'application/pdf',
                upsert: true
            });

        if (error) {
            console.error('Error subiendo PDF a Storage:', error);
            throw error;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('quotations')
            .getPublicUrl(filePath);

        return publicUrl;
    }
};
