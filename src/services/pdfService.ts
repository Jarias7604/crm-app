import { jsPDF } from 'jspdf';
import { supabase } from './supabase';
import { format } from 'date-fns';

// ----------------------------------------------------------------------
// SOLUCIÓN FINAL "SENIOR": RENDERIZADO MANUAL SIN DEPENDENCIAS EXTERNAS
// Eliminamos jspdf-autotable para garantizar 0% de errores en Vercel.
// Dibujamos la tabla pixel por pixel para un control total.
// ----------------------------------------------------------------------

export const pdfService = {
    async generateAndUploadQuotePDF(cotizacion: any): Promise<string> {
        try {
            console.log(`Generando PDF NATIVE MODE [v${Date.now()}]...`, cotizacion.id);

            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            // Colores
            const slate900 = [15, 23, 42];
            const indigoColor = [68, 73, 170];
            const textMuted = [100, 116, 139];
            const grayLight = [241, 245, 249];

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

            // Branding Lines
            doc.setDrawColor(68, 73, 170); // indigo accent
            doc.setLineWidth(1);
            doc.line(20, 28, 100, 28);

            // Contacto
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(148, 163, 184); // slate-400
            const address = cotizacion.company?.address || 'COL. LA MASCOTA, SAN SALVADOR, EL SALVADOR';
            const contact = `${cotizacion.company?.phone || '+503 7971 8911'}  |  ${cotizacion.company?.website || 'WWW.ARIASDEFENSE.COM'}`;
            doc.text(address, 20, 36);
            doc.text(contact, 20, 41);

            // Metadata Der.
            doc.setTextColor(indigoColor[0], indigoColor[1], indigoColor[2]);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text('COTIZACIÓN OFICIAL', pageWidth - 20, 18, { align: 'right' });

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(28);
            doc.setFont('helvetica', 'normal');
            doc.text(String(cotizacion.id).slice(0, 8).toUpperCase(), pageWidth - 20, 32, { align: 'right' });

            // Linea divisoria header
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
            // 2. CLIENTE & RESUMEN
            // ---------------------------------------------------------
            let cursorY = 80;

            // Etiqueta Cliente
            doc.setTextColor(indigoColor[0], indigoColor[1], indigoColor[2]);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('CLIENTE RECEPTOR', 20, cursorY);

            // Nombre Cliente
            cursorY += 10;
            doc.setTextColor(slate900[0], slate900[1], slate900[2]);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text(String(cotizacion.nombre_cliente).toUpperCase(), 20, cursorY);

            // Empresa Cliente
            if (cotizacion.empresa_cliente) {
                cursorY += 8;
                doc.setFontSize(11);
                doc.setTextColor(indigoColor[0], indigoColor[1], indigoColor[2]);
                doc.text(String(cotizacion.empresa_cliente).toUpperCase(), 20, cursorY);
            }

            // CAJA RESUMEN (Derecha)
            doc.setFillColor(248, 250, 252); // slate-50
            doc.setDrawColor(226, 232, 240); // slate-200
            doc.roundedRect(pageWidth - 85, 70, 65, 35, 3, 3, 'FD');

            doc.setTextColor(indigoColor[0], indigoColor[1], indigoColor[2]);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text('RESUMEN EJECUTIVO', pageWidth - 52.5, 78, { align: 'center' });

            doc.setTextColor(slate900[0], slate900[1], slate900[2]);
            doc.setFontSize(12);
            doc.text(`${cotizacion.plan_nombre}`, pageWidth - 52.5, 88, { align: 'center' });
            doc.setFontSize(8);
            doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
            doc.text(`${(cotizacion.volumen_dtes || 0).toLocaleString()} DTEs/año`, pageWidth - 52.5, 95, { align: 'center' });

            // ---------------------------------------------------------
            // 3. TABLA MANUAL (MANUAL RENDER)
            // ---------------------------------------------------------
            let tableY = 120;
            const colDescX = 20;
            const colPriceX = pageWidth - 20;

            // -- Table Header --
            doc.setFillColor(grayLight[0], grayLight[1], grayLight[2]);
            doc.rect(20, tableY, pageWidth - 40, 10, 'F');

            doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text('DESCRIPCIÓN DEL SERVICIO', colDescX + 5, tableY + 6);
            doc.text('INVERSIÓN (USD)', colPriceX - 5, tableY + 6, { align: 'right' });

            tableY += 10; // Avanzar cursor

            // -- Helper para dibujar filas --
            const drawRow = (title: string, subtitle: string, price: number) => {
                const startY = tableY;

                // Price
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(slate900[0], slate900[1], slate900[2]);
                doc.text(`$${price.toLocaleString()}`, colPriceX - 5, startY + 8, { align: 'right' });

                // Title
                doc.setFontSize(10);
                doc.text(title, colDescX + 5, startY + 8);

                // Subtitle (multiline support basic)
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
                doc.text(subtitle, colDescX + 5, startY + 14);

                // Linea separadora
                tableY += 20; // Altura fija de fila para consistencia
                doc.setDrawColor(241, 245, 249);
                doc.line(colDescX, tableY, colPriceX, tableY);
            };

            // 1. Plan Base
            drawRow(
                `Licencia Anual ${cotizacion.plan_nombre}`,
                'Incluye suite DTE, actualizaciones de ley y soporte técnico base.',
                cotizacion.costo_plan_anual || 0
            );

            // 2. Implementación
            if (cotizacion.incluir_implementacion) {
                drawRow(
                    'Implementación y Configuración',
                    'Configuración inicial, carga de catálogos y capacitación de usuarios.',
                    cotizacion.costo_implementacion || 0
                );
            }

            // 3. Modulos
            if (cotizacion.modulos_adicionales && Array.isArray(cotizacion.modulos_adicionales)) {
                cotizacion.modulos_adicionales.forEach((m: any) => {
                    drawRow(
                        m.nombre,
                        'Módulo adicional integrado a la plataforma.',
                        m.costo_anual || 0
                    );
                });
            }

            // 4. Whatsapp
            if (cotizacion.servicio_whatsapp) {
                drawRow(
                    'Smart-WhatsApp Notifications',
                    'Envío automático de documentos PDF y JSON por WhatsApp.',
                    cotizacion.costo_whatsapp || 0
                );
            }

            // 5. Personalizacion
            if (cotizacion.servicio_personalizacion) {
                drawRow(
                    'Personalización White-Label',
                    'Adaptación de colores, logo y dominio a su marca corporativa.',
                    cotizacion.costo_personalizacion || 0
                );
            }

            // ---------------------------------------------------------
            // 4. TOTALS RECTANGLE
            // ---------------------------------------------------------
            // Verificar si cabe en la página, sino addPage()
            if (tableY + 60 > pageHeight) {
                doc.addPage();
                tableY = 20;
            } else {
                tableY += 10; // Espacio extra
            }

            // Draw Box
            doc.setFillColor(indigoColor[0], indigoColor[1], indigoColor[2]);
            doc.roundedRect(pageWidth - 100, tableY, 80, 50, 4, 4, 'F');

            let totalCursorY = tableY + 15;

            // Labels & Values
            const drawTotalLine = (label: string, val: string, isBig: boolean = false) => {
                doc.setTextColor(255, 255, 255);
                if (isBig) {
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold'); // Bold label for total
                    doc.text(label, pageWidth - 90, totalCursorY);

                    doc.setFontSize(20);
                    doc.text(val, pageWidth - 30, totalCursorY + 8, { align: 'right' });
                } else {
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'normal');
                    doc.text(label, pageWidth - 90, totalCursorY);

                    doc.setFont('helvetica', 'bold');
                    doc.text(val, pageWidth - 30, totalCursorY, { align: 'right' });
                }
            };

            drawTotalLine('SUBTOTAL NETO', `$${(cotizacion.subtotal_anual || 0).toLocaleString()}`);
            totalCursorY += 10;

            drawTotalLine(`IVA (${cotizacion.iva_porcentaje || 13}%)`, `$${(cotizacion.iva_monto || 0).toLocaleString()}`);

            // Separator line inside box
            totalCursorY += 8;
            doc.setDrawColor(255, 255, 255);
            doc.setLineWidth(0.1);
            doc.line(pageWidth - 90, totalCursorY, pageWidth - 30, totalCursorY);

            totalCursorY += 12;
            drawTotalLine('TOTAL A INVERTIR', `$${(cotizacion.total_anual || 0).toLocaleString()}`, true);

            // ---------------------------------------------------------
            // 5. FOOTER
            // ---------------------------------------------------------
            const footerY = pageHeight - 30;
            doc.setFillColor(249, 250, 251);
            doc.rect(0, footerY, pageWidth, 30, 'F');
            doc.setDrawColor(226, 232, 240);
            doc.line(0, footerY, pageWidth, footerY);

            doc.setTextColor(slate900[0], slate900[1], slate900[2]);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text((cotizacion.creator?.full_name || 'AGENTE COMERCIAL').toUpperCase(), 20, footerY + 12);

            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
            doc.text((cotizacion.creator?.email || 'ventas@ariasdefense.com').toUpperCase(), 20, footerY + 18);

            doc.setTextColor(indigoColor[0], indigoColor[1], indigoColor[2]);
            doc.setFont('helvetica', 'bold');
            doc.text('DOCUMENTO VALIDO POR 15 DÍAS', pageWidth - 20, footerY + 12, { align: 'right' });
            doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
            doc.setFont('helvetica', 'normal');
            doc.text('GENERADO POR ARIAS CRM', pageWidth - 20, footerY + 18, { align: 'right' });

            // ---------------------------------------------------------
            // UPLOAD
            // ---------------------------------------------------------
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
            console.error('ERROR PDF MANUAL:', err);
            throw err;
        }
    }
};
