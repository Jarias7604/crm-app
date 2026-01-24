import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from './supabase';
import { format } from 'date-fns';

// Definición de tipos para evitar errores de compilación tsc
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
    };
    creator?: {
        full_name?: string;
        email?: string;
    };
}

export const pdfService = {
    async generateAndUploadQuotePDF(cotizacion: CotizacionData): Promise<string> {
        try {
            console.log('Generando PDF Premium...', cotizacion.id);
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            // Colors
            const darkBg: [number, number, number] = [15, 23, 42];
            const accentBg: [number, number, number] = [68, 73, 170];
            const textMuted: [number, number, number] = [100, 116, 139];

            // 1. HEADER
            doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
            doc.rect(0, 0, pageWidth, 45, 'F');

            // Company Info
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text((cotizacion.company?.name || 'ARIAS DEFENSE COMPONENTS').toUpperCase(), 20, 18);

            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(150, 150, 150);
            const address = cotizacion.company?.address || 'COL. LA MASCOTA SAN SALVADOR, EL SALVADOR';
            const phone = cotizacion.company?.phone || '+503 7971 8911';
            doc.text(`${address}  •  ${phone}`, 20, 24);

            doc.setTextColor(68, 73, 170);
            doc.setFont('helvetica', 'bold');
            doc.text((cotizacion.company?.website || 'WWW.ARIASDEFENSE.COM').toUpperCase(), 20, 29);

            // Metadata Right
            doc.setTextColor(accentBg[0], accentBg[1], accentBg[2]);
            doc.setFontSize(8);
            doc.text('COTIZACIÓN OFICIAL', pageWidth - 20, 15, { align: 'right' });

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(24);
            doc.setFont('helvetica', 'normal');
            doc.text(cotizacion.id.slice(0, 8).toUpperCase(), pageWidth - 20, 28, { align: 'right' });

            doc.setDrawColor(30, 41, 59);
            doc.line(pageWidth - 80, 34, pageWidth - 20, 34);

            doc.setFontSize(7);
            doc.setTextColor(100, 116, 139);
            doc.text('FECHA EMISIÓN', pageWidth - 80, 41);
            doc.text('REFERENCIA ID', pageWidth - 45, 41);

            doc.setTextColor(200, 200, 200);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text(format(new Date(cotizacion.created_at || Date.now()), 'dd/MM/yyyy'), pageWidth - 80, 44);
            doc.text(cotizacion.id.slice(0, 6).toUpperCase(), pageWidth - 45, 44);

            // 2. CLIENT INFO
            let currentY = 60;
            doc.setTextColor(accentBg[0], accentBg[1], accentBg[2]);
            doc.setFontSize(9);
            doc.text('CLIENTE RECEPTOR', 20, currentY);

            currentY += 10;
            doc.setTextColor(darkBg[0], darkBg[1], darkBg[2]);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text((cotizacion.nombre_cliente || 'CLIENTE').toUpperCase(), 20, currentY);

            if (cotizacion.empresa_cliente) {
                currentY += 7;
                doc.setFontSize(11);
                doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
                doc.text(cotizacion.empresa_cliente, 20, currentY);
            }

            // Summary Box
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(pageWidth - 85, 60, 65, 30, 3, 3, 'F');
            doc.setTextColor(accentBg[0], accentBg[1], accentBg[2]);
            doc.setFontSize(8);
            doc.text('RESUMEN EJECUTIVO', pageWidth - 52.5, 68, { align: 'center' });
            doc.setTextColor(darkBg[0], darkBg[1], darkBg[2]);
            doc.setFontSize(10);
            doc.text(`PLAN: ${cotizacion.plan_nombre || 'BASE'}`, pageWidth - 52.5, 75, { align: 'center' });
            doc.setFontSize(8);
            doc.text(`DTEs: ${(cotizacion.volumen_dtes || 0).toLocaleString()}/año`, pageWidth - 52.5, 82, { align: 'center' });

            // 3. TABLE
            const tableRows: any[][] = [];
            tableRows.push([
                `LICENCIA ANUAL ${cotizacion.plan_nombre || 'BASE'}\nIncluye suite DTE y soporte técnico base.`,
                `$${(cotizacion.costo_plan_anual || 0).toLocaleString()}`
            ]);

            if (cotizacion.incluir_implementacion) {
                tableRows.push(['IMPLEMENTACIÓN (PAGO ÚNICO)', `$${(cotizacion.costo_implementacion || 0).toLocaleString()}`]);
            }

            if (cotizacion.modulos_adicionales && Array.isArray(cotizacion.modulos_adicionales)) {
                cotizacion.modulos_adicionales.forEach(m => {
                    tableRows.push([m.nombre, `$${(m.costo_anual || 0).toLocaleString()}`]);
                });
            }

            // Use autoTable function directly for production compatibility
            autoTable(doc, {
                startY: 100,
                head: [['DESCRIPCIÓN', 'INVERSIÓN (USD)']],
                body: tableRows,
                headStyles: { fillColor: [249, 250, 251], textColor: [100, 116, 139], fontStyle: 'bold', fontSize: 8 },
                bodyStyles: { textColor: [15, 23, 42], fontSize: 10, cellPadding: 6 },
                columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
                theme: 'grid',
                styles: { lineColor: [241, 245, 249] }
            });

            // 4. TOTALS
            const finalY = (doc as any).lastAutoTable.finalY + 15;
            doc.setFillColor(accentBg[0], accentBg[1], accentBg[2]);
            doc.roundedRect(pageWidth - 90, finalY, 70, 40, 5, 5, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.text('TOTAL INVERSIÓN ANUAL', pageWidth - 80, finalY + 15);
            doc.setFontSize(16);
            doc.text(`$${(cotizacion.total_anual || 0).toLocaleString()}`, pageWidth - 30, finalY + 25, { align: 'right' });

            // 5. FOOTER
            doc.setFillColor(249, 250, 251);
            doc.rect(0, pageHeight - 30, pageWidth, 30, 'F');
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text((cotizacion.creator?.full_name || 'AGENTE').toUpperCase(), 20, pageHeight - 15);
            doc.text('DOCUMENTO OFICIAL', pageWidth - 20, pageHeight - 15, { align: 'right' });

            const pdfBlob = doc.output('blob');
            const fileName = `propuesta_${cotizacion.id.slice(0, 8)}_${Date.now()}.pdf`;
            const { error: uploadError } = await supabase.storage.from('quotations').upload(fileName, pdfBlob, { contentType: 'application/pdf', upsert: true });

            if (uploadError) throw uploadError;
            const { data } = supabase.storage.from('quotations').getPublicUrl(fileName);
            return data.publicUrl;

        } catch (err: any) {
            console.error('ERROR PDF:', err);
            throw new Error(`Falla en PDF: ${err.message}`);
        }
    }
};
