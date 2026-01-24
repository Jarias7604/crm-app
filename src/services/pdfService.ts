import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { supabase } from './supabase';

export const pdfService = {
    async generateAndUploadQuotePDF(cotizacion: any): Promise<string> {
        try {
            console.log('Generando PDF Completo:', cotizacion);
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();

            // 1. HEADER PROFESIONAL (Basado en la imagen de la UI)
            doc.setFillColor(15, 23, 42); // Slate 900
            doc.rect(0, 0, pageWidth, 50, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.text('ARIAS DEFENSE COMPONENTS LLC', 20, 20);

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text('COL. LA MASCOTA, SAN SALVADOR, EL SALVADOR  •  +503 7971 8911', 20, 28);
            doc.text('WWW.ARIASDEFENSE.COM', 20, 34);

            doc.setFontSize(10);
            doc.text(`FECHA EMISION: ${new Date().toLocaleDateString()}`, pageWidth - 20, 20, { align: 'right' });
            doc.text(`REFERENCIA ID: ${cotizacion.id.substring(0, 8).toUpperCase()}`, pageWidth - 20, 28, { align: 'right' });

            // 2. CLIENTE Y RESUMEN
            doc.setTextColor(68, 73, 170); // Azul Principal
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('CLIENTE RECEPTOR:', 20, 70);

            doc.setTextColor(15, 23, 42);
            doc.setFontSize(22);
            doc.text(String(cotizacion.nombre_cliente).toUpperCase(), 20, 85);

            if (cotizacion.empresa_cliente) {
                doc.setFontSize(12);
                doc.setTextColor(100, 116, 139);
                doc.text(cotizacion.empresa_cliente, 20, 95);
            }

            // Cuadro de Resumen Ejecutivo
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(pageWidth - 85, 65, 65, 35, 3, 3, 'F');
            doc.setTextColor(68, 73, 170);
            doc.setFontSize(9);
            doc.text('RESUMEN EJECUTIVO', pageWidth - 52.5, 75, { align: 'center' });
            doc.setTextColor(15, 23, 42);
            doc.setFontSize(11);
            doc.text(`PLAN: ${cotizacion.plan_nombre}`, pageWidth - 52.5, 85, { align: 'center' });
            doc.text(`DTEs: ${cotizacion.volumen_dtes?.toLocaleString()}/año`, pageWidth - 52.5, 92, { align: 'center' });

            // 3. TABLA DE INVERSION (DESGLOSE COMPLETO)
            const rows = [];

            // Item 1: El Plan
            rows.push([
                `Licencia Anual ${cotizacion.plan_nombre}\nIncluye suite DTE y soporte técnico base.`,
                `$${Number(cotizacion.costo_plan_anual || 0).toLocaleString()}`
            ]);

            // Item 2: Implementación
            if (cotizacion.incluir_implementacion) {
                rows.push([
                    'Implementación y Configuración (PAGO ÚNICO)\nPuesta en marcha, capacitación y configuración inicial.',
                    `$${Number(cotizacion.costo_implementacion || 0).toLocaleString()}`
                ]);
            }

            // Item 3: Módulos Adicionales
            if (cotizacion.modulos_adicionales && Array.isArray(cotizacion.modulos_adicionales)) {
                cotizacion.modulos_adicionales.forEach((m: any) => {
                    rows.push([
                        `${m.nombre}\nServicio complementario activado.`,
                        `$${Number(m.costo_anual || 0).toLocaleString()}`
                    ]);
                });
            }

            // Item 4: WhatsApp
            if (cotizacion.servicio_whatsapp) {
                rows.push([
                    'Servicio de Notificaciones WhatsApp\nEnvío automático de comprobantes.',
                    `$${Number(cotizacion.costo_whatsapp || 0).toLocaleString()}`
                ]);
            }

            (doc as any).autoTable({
                startY: 110,
                head: [['DESCRIPCIÓN DEL SERVICIO', 'INVERSIÓN (USD)']],
                body: rows,
                headStyles: { fillColor: [241, 245, 249], textColor: [100, 116, 139], fontSize: 8, fontStyle: 'bold' },
                bodyStyles: { textColor: [15, 23, 42], fontSize: 10, cellPadding: 6 },
                columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
                alternateRowStyles: { fillColor: [255, 255, 255] },
                margin: { left: 20, right: 20 }
            });

            // 4. TOTALES
            const finalY = (doc as any).lastAutoTable.finalY + 10;
            const marginTotal = pageWidth - 20;

            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139);
            doc.text('SUBTOTAL:', marginTotal - 40, finalY);
            doc.text(`$${Number(cotizacion.subtotal_anual || 0).toLocaleString()}`, marginTotal, finalY, { align: 'right' });

            if (cotizacion.descuento_monto > 0) {
                doc.setTextColor(220, 38, 38);
                doc.text(`DESCUENTO (${cotizacion.descuento_porcentaje}%):`, marginTotal - 40, finalY + 7);
                doc.text(`-$${Number(cotizacion.descuento_monto || 0).toLocaleString()}`, marginTotal, finalY + 7, { align: 'right' });
            }

            doc.setTextColor(100, 116, 139);
            doc.text(`IVA (${cotizacion.iva_porcentaje || 13}%):`, marginTotal - 40, finalY + 14);
            doc.text(`$${Number(cotizacion.iva_monto || 0).toLocaleString()}`, marginTotal, finalY + 14, { align: 'right' });

            // Linea de Total
            doc.setDrawColor(226, 232, 240);
            doc.line(marginTotal - 60, finalY + 18, marginTotal, finalY + 18);

            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(61, 204, 145); // Color verde de la UI
            doc.text('TOTAL INVERSIÓN ANUAL:', marginTotal - 80, finalY + 30);
            doc.text(`$${Number(cotizacion.total_anual || 0).toLocaleString()}`, marginTotal, finalY + 30, { align: 'right' });

            // Cuota Mensual de Referencia
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139);
            doc.setFont('helvetica', 'normal');
            doc.text(`* Cuota mensual recurrente de referencia: $${Number(cotizacion.total_mensual || 0).toLocaleString()}`, 20, finalY + 45);

            // 5. FOOTER
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text('Esta propuesta comercial tiene una validez de 15 días calendario.', pageWidth / 2, 285, { align: 'center' });

            // SUBIDA A STORAGE
            const blob = doc.output('blob');
            const fileName = `propuesta_${Date.now()}.pdf`;

            const { error: uploadError } = await supabase.storage
                .from('quotations')
                .upload(fileName, blob, { contentType: 'application/pdf', upsert: true });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('quotations').getPublicUrl(fileName);
            return data.publicUrl;

        } catch (err: any) {
            console.error('ERROR PDF COMPLETO:', err);
            throw new Error(`Error al generar documento completo: ${err.message}`);
        }
    }
};
