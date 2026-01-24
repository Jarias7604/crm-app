import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from './supabase';
import { format } from 'date-fns';

interface CotizacionData {
    id: string;
    nombre_cliente: string;
    empresa_cliente?: string;
    email_cliente?: string;
    telefono_cliente?: string;
    plan_nombre: string;
    volumen_dtes: number;
    costo_plan_anual: number;
    incluir_implementacion: boolean;
    costo_implementacion: number;
    modulos_adicionales?: any[];
    servicio_whatsapp?: boolean;
    costo_whatsapp: number;
    servicio_personalizacion?: boolean;
    costo_personalizacion: number;
    subtotal_anual: number;
    descuento_monto: number;
    descuento_porcentaje: number;
    iva_monto: number;
    iva_porcentaje: number;
    total_anual: number;
    total_mensual: number;
    notes?: string;
    created_at?: string;
    company?: {
        name?: string;
        address?: string;
        phone?: string;
        website?: string;
        logo_url?: string;
    };
    creator?: {
        full_name?: string;
        email?: string;
        avatar_url?: string;
    };
}

export const pdfService = {
    async generateAndUploadQuotePDF(cotizacion: CotizacionData): Promise<string> {
        try {
            console.log('Generando PDF 1:1 con la UI Detalle...', cotizacion.id);
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            // Colores Corporativos
            const slate900 = [15, 23, 42]; // #0f172a
            const indigoColor = [68, 73, 170]; // #4449AA (SaaS Pro Principal)
            const blueAccent = [37, 99, 235]; // Blue 600
            const textMuted = [100, 116, 139]; // Slate 400

            // 1. HEADER (MISMO ESTILO QUE CotizacionDetalle.tsx)
            doc.setFillColor(slate900[0], slate900[1], slate900[2]);
            doc.rect(0, 0, pageWidth, 55, 'F'); // Un poco más alto para el branding

            // Logo o Nombre Empresa (Izquierda)
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text((cotizacion.company?.name || 'ARIAS DEFENSE COMPONENTS').toUpperCase(), 20, 22);

            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(148, 163, 184); // Slate 400 ligero
            doc.text(`${cotizacion.company?.address || 'COL. LA MASCOTA, SAN SALVADOR, EL SALVADOR'}`, 20, 28);
            doc.text(`${cotizacion.company?.phone || '+503 7971 8911'}  •  ${cotizacion.company?.website || 'WWW.ARIASDEFENSE.COM'}`, 20, 32);

            // Metadata (Derecha)
            doc.setTextColor(indigoColor[0], indigoColor[1], indigoColor[2]);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text('COTIZACIÓN OFICIAL', pageWidth - 20, 18, { align: 'right' });

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(28);
            doc.setFont('helvetica', 'normal');
            doc.text(cotizacion.id.slice(0, 8).toUpperCase(), pageWidth - 20, 32, { align: 'right' });

            // Linea divisoria en header
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
            doc.text(cotizacion.id.slice(0, 6).toUpperCase(), pageWidth - 45, 48);

            // 2. CLIENTE RECEPTOR (ZONA BLANCA)
            let currentY = 75;
            doc.setTextColor(indigoColor[0], indigoColor[1], indigoColor[2]);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('CLIENTE RECEPTOR', 20, currentY);

            currentY += 12;
            doc.setTextColor(slate900[0], slate900[1], slate900[2]);
            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');
            doc.text((cotizacion.nombre_cliente || 'CLIENTE').toUpperCase(), 20, currentY);

            if (cotizacion.empresa_cliente) {
                currentY += 8;
                doc.setFontSize(11);
                doc.setTextColor(indigoColor[0], indigoColor[1], indigoColor[2]);
                doc.text(String(cotizacion.empresa_cliente).toUpperCase(), 20, currentY);
            }

            // Cuadro Resumen Ejecutivo (Derecha)
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(pageWidth - 85, 70, 65, 35, 4, 4, 'F');
            doc.setDrawColor(241, 245, 249);
            doc.roundedRect(pageWidth - 85, 70, 65, 35, 4, 4, 'S');

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

            // Info de contacto cliente
            currentY += 15;
            doc.setDrawColor(248, 250, 252);
            doc.line(20, currentY, 100, currentY);
            currentY += 10;
            doc.setFontSize(8);
            doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
            doc.text('CONTACTO DIRECTO', 20, currentY);
            currentY += 6;
            doc.setTextColor(slate900[0], slate900[1], slate900[2]);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(`${cotizacion.email_cliente || 'N/A'}`, 20, currentY);
            if (cotizacion.telefono_cliente) {
                doc.text(`  |  ${cotizacion.telefono_cliente}`, 80, currentY);
            }

            // 3. DESGLOSE DE INVERSIÓN (TABLA)
            currentY = 130;
            doc.setTextColor(indigoColor[0], indigoColor[1], indigoColor[2]);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('DESGLOSE DE INVERSIÓN', 20, currentY);

            const tableRows: any[][] = [];
            // Plan Base
            tableRows.push([
                `Licencia Anual ${cotizacion.plan_nombre}\nIncluye suite DTE y soporte técnico base.`,
                `$${(cotizacion.costo_plan_anual || 0).toLocaleString()}`
            ]);

            // Implementación
            if (cotizacion.incluir_implementacion) {
                tableRows.push([
                    'Implementación y Configuración (PAGO ÚNICO)\nPuesta en marcha, capacitación y configuración inicial.',
                    `$${(cotizacion.costo_implementacion || 0).toLocaleString()}`
                ]);
            }

            // Módulos
            if (cotizacion.modulos_adicionales && Array.isArray(cotizacion.modulos_adicionales)) {
                cotizacion.modulos_adicionales.forEach(m => {
                    tableRows.push([
                        `${m.nombre}\nServicio complementario activado.`,
                        `$${(m.costo_anual || 0).toLocaleString()}`
                    ]);
                });
            }

            // WhatsApp
            if (cotizacion.servicio_whatsapp) {
                tableRows.push([
                    'Notificaciones Smart-WhatsApp\nAutomatización de envíos y confirmación.',
                    `$${(cotizacion.costo_whatsapp || 0).toLocaleString()}`
                ]);
            }

            // Personalización
            if (cotizacion.servicio_personalizacion) {
                tableRows.push([
                    'Personalización de Marca (White-label)\nAdaptación total a su identidad corporativa.',
                    `$${(cotizacion.costo_personalizacion || 0).toLocaleString()}`
                ]);
            }

            autoTable(doc, {
                startY: currentY + 5,
                head: [['DESCRIPCIÓN DEL SERVICIO', 'INVERSIÓN (USD)']],
                body: tableRows,
                headStyles: { fillColor: [249, 250, 251], textColor: [100, 116, 139], fontSize: 8, fontStyle: 'bold' },
                bodyStyles: { textColor: slate900, fontSize: 10, cellPadding: 8 },
                columnStyles: {
                    0: { cellWidth: 140 },
                    1: { halign: 'right', fontStyle: 'bold', fontSize: 12 }
                },
                alternateRowStyles: { fillColor: [255, 255, 255] },
                margin: { left: 20, right: 20 },
                theme: 'grid',
                styles: { lineColor: [241, 245, 249] }
            });

            // 4. TOTALS (CUADRO INDIGO COMO EN LA UI)
            currentY = (doc as any).lastAutoTable.finalY + 15;

            // Si el cuadro se sale de la página, creamos una nueva
            if (currentY + 60 > pageHeight) {
                doc.addPage();
                currentY = 20;
            }

            // Dibujar el cuadro de totales
            doc.setFillColor(indigoColor[0], indigoColor[1], indigoColor[2]);
            doc.roundedRect(pageWidth - 100, currentY, 80, 50, 8, 8, 'F');

            let totalY = currentY + 12;
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text('SUBTOTAL NETO', pageWidth - 90, totalY);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(`$${(cotizacion.subtotal_anual || 0).toLocaleString()}`, pageWidth - 30, totalY, { align: 'right' });

            if (cotizacion.descuento_monto > 0) {
                totalY += 8;
                doc.setFontSize(8);
                doc.setTextColor(187, 247, 208); // Verde claro para descuento
                doc.text(`DESCUENTO (${cotizacion.descuento_porcentaje}%)`, pageWidth - 90, totalY);
                doc.text(`-$${(cotizacion.descuento_monto || 0).toLocaleString()}`, pageWidth - 30, totalY, { align: 'right' });
            }

            totalY += 8;
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(`IVA (${cotizacion.iva_porcentaje || 13}%)`, pageWidth - 90, totalY);
            doc.text(`$${(cotizacion.iva_monto || 0).toLocaleString()}`, pageWidth - 30, totalY, { align: 'right' });

            // Línea blanca separadora de total
            totalY += 4;
            doc.setDrawColor(255, 255, 255, 0.2);
            doc.line(pageWidth - 90, totalY, pageWidth - 30, totalY);

            totalY += 10;
            doc.setFontSize(9);
            doc.text('TOTAL A INVERTIR', pageWidth - 90, totalY);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text(`$${(cotizacion.total_anual || 0).toLocaleString()}`, pageWidth - 30, totalY + 8, { align: 'right' });

            // 5. FOOTER (Información Agente)
            const footerY = pageHeight - 35;
            doc.setFillColor(249, 250, 251);
            doc.rect(0, footerY, pageWidth, 35, 'F');
            doc.setDrawColor(226, 232, 240);
            doc.line(0, footerY, pageWidth, footerY);

            doc.setTextColor(indigoColor[0], indigoColor[1], indigoColor[2]);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text('PROPUESTA ELABORADA POR', 20, footerY + 12);

            doc.setTextColor(slate900[0], slate900[1], slate900[2]);
            doc.setFontSize(14);
            doc.text((cotizacion.creator?.full_name || 'AGENTE COMERCIAL').toUpperCase(), 20, footerY + 22);

            doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(`${cotizacion.creator?.email || 'ventas@ariasdefense.com'}  |  WWW.ARIASDEFENSE.COM`, 20, footerY + 28);

            doc.setTextColor(indigoColor[0], indigoColor[1], indigoColor[2]);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(`${new Date().getFullYear()} ARIAS DEFENSE`, pageWidth - 20, footerY + 15, { align: 'right' });
            doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
            doc.setFontSize(8);
            doc.text('DOCUMENTO OFICIAL', pageWidth - 20, footerY + 28, { align: 'right' });

            // 6. SUBIDA A STORAGE
            const pdfBlob = doc.output('blob');
            const fileName = `propuesta_${cotizacion.id.slice(0, 8)}_${Date.now()}.pdf`;

            const { error: uploadError } = await supabase.storage
                .from('quotations')
                .upload(fileName, pdfBlob, { contentType: 'application/pdf', upsert: true });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('quotations').getPublicUrl(fileName);
            return data.publicUrl;

        } catch (err: any) {
            console.error('ERROR PDF 1:1:', err);
            throw new Error(`Falla en PDF Premium: ${err.message}`);
        }
    }
};
