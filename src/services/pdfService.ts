import { jsPDF } from 'jspdf';
import { supabase } from './supabase';
import { format } from 'date-fns';

// ----------------------------------------------------------------------
// PDF NATIVE MODE - PREMIUM RENDER 1:1
// Replicating CotizacionDetalle.tsx using pure jsPDF commands.
// No external table libraries to avoid Vercel build errors.
// ----------------------------------------------------------------------

export const pdfService = {
    async generateAndUploadQuotePDF(cotizacion: any): Promise<string> {
        try {
            console.log(`Generando PDF UI Match [v${Date.now()}]...`, cotizacion.id);

            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            // --- PALETTE (Based on CotizacionDetalle.tsx) ---
            const C_SLATE_900 = [15, 23, 42];  // #0f172a (Header BG)
            const C_INDIGO_MAIN = [68, 73, 170]; // #4449AA (Brand/Total Box)
            const C_BLUE_500 = [59, 130, 246]; // Blue accents
            const C_GRAY_50 = [249, 250, 251]; // Light BG
            const C_GRAY_100 = [243, 244, 246];
            const C_GRAY_400 = [156, 163, 175];
            const C_GRAY_900 = [17, 24, 39];

            // --- FONTS SETUP ---
            // Standard fonts are Helvetica (Normal/Bold)

            let cursorY = 0;

            // ==========================================
            // 1. HEADER (Dark Section)
            // ==========================================
            const headerHeight = 60;
            doc.setFillColor(C_SLATE_900[0], C_SLATE_900[1], C_SLATE_900[2]);
            doc.rect(0, 0, pageWidth, headerHeight, 'F');

            // Decorative right gradient approximation (Darker overlay)
            // Can't do real gradient easily in raw JS, so we simulate with a rect
            doc.setFillColor(30, 41, 59); // lighter slate
            doc.rect(pageWidth / 2, 0, pageWidth / 2, headerHeight, 'F');
            doc.setFillColor(C_SLATE_900[0], C_SLATE_900[1], C_SLATE_900[2]); // Cover part to simulate gradient? No, simple is safe.
            // Let's stick to solid clean slate.

            // LEFT: Logo & Company Info
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            const companyName = (cotizacion.company?.name || 'ARIAS DEFENSE COMPONENTS').toUpperCase();
            doc.text(companyName, 20, 25);

            // Company Details (Small)
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(148, 163, 184); // slate-400

            let detailsY = 32;
            const companyAddr = cotizacion.company?.address;
            const companyPhone = cotizacion.company?.phone;
            const companyWeb = cotizacion.company?.website || 'WWW.ARIASDEFENSE.COM';

            if (companyAddr) { doc.text(companyAddr.toUpperCase(), 20, detailsY); detailsY += 4; }
            if (companyPhone) { doc.text(companyPhone, 20, detailsY); detailsY += 4; }

            doc.setTextColor(59, 130, 246); // Blue-500
            doc.setFont('helvetica', 'bold');
            doc.text(companyWeb.replace(/^https?:\/\//, '').toUpperCase(), 20, detailsY);

            // RIGHT: Quote Details
            // "COTIZACIÓN OFICIAL"
            doc.setFontSize(7);
            doc.setTextColor(59, 130, 246); // Blue-500
            doc.text('COTIZACIÓN OFICIAL', pageWidth - 20, 20, { align: 'right' });

            // ID
            doc.setFontSize(26);
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'normal'); // "font-light" approximation
            doc.text(String(cotizacion.id).slice(0, 8).toUpperCase(), pageWidth - 20, 32, { align: 'right' });

            // Stats Row (Date | Ref)
            const headerLineY = 40;
            doc.setDrawColor(51, 65, 85); // Slate-700
            doc.line(pageWidth - 90, headerLineY, pageWidth - 20, headerLineY);

            const metaY = 48;
            // Date
            doc.setFontSize(6);
            doc.setTextColor(148, 163, 184);
            doc.setFont('helvetica', 'bold');
            doc.text('FECHA EMISIÓN', pageWidth - 80, metaY);
            doc.setFontSize(9);
            doc.setTextColor(209, 213, 219); // gray-300
            doc.text(format(new Date(cotizacion.created_at || Date.now()), 'dd/MM/yyyy'), pageWidth - 80, metaY + 5);

            // Ref
            doc.setFontSize(6);
            doc.setTextColor(148, 163, 184);
            doc.text('REFERENCIA ID', pageWidth - 40, metaY);
            doc.setFontSize(9);
            doc.setTextColor(209, 213, 219);
            doc.text(String(cotizacion.id).slice(0, 6).toUpperCase(), pageWidth - 40, metaY + 5);


            // ==========================================
            // 2. CLIENT & SUMMARY SECTION
            // ==========================================
            cursorY = 80;

            // --- Left: Client Info ---
            doc.setFontSize(7);
            doc.setTextColor(59, 130, 246); // Blue-500
            doc.setFont('helvetica', 'bold');
            doc.text('CLIENTE RECEPTOR', 20, cursorY);

            cursorY += 10;
            doc.setFontSize(22);
            doc.setTextColor(C_SLATE_900[0], C_SLATE_900[1], C_SLATE_900[2]);
            doc.text(String(cotizacion.nombre_cliente), 20, cursorY);

            // Client Badge / Company
            if (cotizacion.empresa_cliente) {
                cursorY += 8;
                doc.setFontSize(9);
                doc.setTextColor(C_INDIGO_MAIN[0], C_INDIGO_MAIN[1], C_INDIGO_MAIN[2]);
                doc.text(String(cotizacion.empresa_cliente).toUpperCase(), 20, cursorY);
            }

            // Client Contact Box (Small gray bg)
            cursorY += 10;
            const contactBoxY = cursorY;
            doc.setFillColor(249, 250, 251); // Gray-50
            doc.setDrawColor(243, 244, 246);
            doc.roundedRect(20, contactBoxY, 80, 20, 3, 3, 'FD');

            // Icon placeholders
            doc.setFontSize(8);
            doc.setTextColor(C_GRAY_900[0], C_GRAY_900[1], C_GRAY_900[2]);
            doc.text(cotizacion.email_cliente || 'Sin email', 28, contactBoxY + 8);
            if (cotizacion.telefono_cliente) {
                doc.text(cotizacion.telefono_cliente, 28, contactBoxY + 16);
            }


            // --- Right: Executive Summary (Gray Box) ---
            const sumBoxW = 70;
            const sumBoxH = 40;
            const sumBoxX = pageWidth - 20 - sumBoxW;
            const sumBoxY = 75;

            doc.setFillColor(248, 250, 252); // Gray-50
            doc.setDrawColor(226, 232, 240); // Border
            doc.roundedRect(sumBoxX, sumBoxY, sumBoxW, sumBoxH, 4, 4, 'FD');

            doc.setFontSize(7);
            doc.setTextColor(156, 163, 175); // Gray-400
            doc.text('PLAN SELECCIONADO', sumBoxX + 10, sumBoxY + 10);

            doc.setFontSize(12);
            doc.setTextColor(C_INDIGO_MAIN[0], C_INDIGO_MAIN[1], C_INDIGO_MAIN[2]);
            doc.setFont('helvetica', 'bold');
            doc.text(cotizacion.plan_nombre || '', sumBoxX + 10, sumBoxY + 18);

            doc.setFontSize(8);
            doc.setTextColor(55, 65, 81); // Gray-700
            doc.setFont('helvetica', 'normal');
            doc.text(`${(cotizacion.volumen_dtes || 0).toLocaleString()} DTEs/año`, sumBoxX + 10, sumBoxY + 30);


            // ==========================================
            // 3. TABLE ITEMS (Manual Draw)
            // ==========================================
            let tableY = 135;

            // Title
            doc.setFontSize(8);
            doc.setTextColor(59, 130, 246); // Blue-400
            doc.setFont('helvetica', 'bold');
            doc.text('DESGLOSE DE INVERSIÓN', 20, tableY - 10);

            // Table Header Bar
            doc.setFillColor(C_GRAY_50[0], C_GRAY_50[1], C_GRAY_50[2]);
            doc.rect(20, tableY, pageWidth - 40, 10, 'F');
            doc.setDrawColor(C_GRAY_100[0], C_GRAY_100[1], C_GRAY_100[2]);
            doc.line(20, tableY + 10, pageWidth - 20, tableY + 10); // Bottom border

            doc.setFontSize(7);
            doc.setTextColor(156, 163, 175); // Gray-400
            doc.text('DESCRIPCIÓN DEL SERVICIO', 30, tableY + 7);
            doc.text('INVERSIÓN (USD)', pageWidth - 30, tableY + 7, { align: 'right' });

            tableY += 15; // Start content below header

            // --- Helper to draw "Premium" rows ---
            const drawItemRow = (type: string, title: string, subtitle: string, price: number) => {
                // Determine icon color based on type
                let iconColor = [59, 130, 246]; // Blue default
                let iconBg = [239, 246, 255]; // Blue-50

                if (type === 'setup') { iconColor = [234, 88, 12]; iconBg = [255, 247, 237]; } // Orange
                if (type === 'module') { iconColor = [147, 51, 234]; iconBg = [250, 245, 255]; } // Purple
                if (type === 'chat') { iconColor = [22, 163, 74]; iconBg = [240, 253, 244]; } // Green
                if (type === 'custom') { iconColor = [217, 119, 6]; iconBg = [255, 251, 235]; } // Amber

                // Draw Icon Box (Rounded Square simulation)
                const iconSize = 10;
                doc.setFillColor(iconBg[0], iconBg[1], iconBg[2]);
                doc.roundedRect(20, tableY, iconSize, iconSize, 2, 2, 'F');

                // Content Left
                doc.setFontSize(10);
                doc.setTextColor(17, 24, 39); // Gray-900
                doc.setFont('helvetica', 'bold');
                doc.text(title, 35, tableY + 4);

                doc.setFontSize(8);
                doc.setTextColor(107, 114, 128); // Gray-500
                doc.setFont('helvetica', 'normal');
                doc.text(subtitle, 35, tableY + 9);

                // Price Right
                doc.setFontSize(11);
                doc.setTextColor(17, 24, 39);
                doc.setFont('helvetica', 'bold');
                doc.text(`$${price.toLocaleString()}`, pageWidth - 30, tableY + 6, { align: 'right' });

                tableY += 18; // Row Height spacing
            };

            // 1. Plan
            drawItemRow('plan', `Licencia Anual ${cotizacion.plan_nombre}`, 'Incluye suite DTE y soporte técnico base.', cotizacion.costo_plan_anual || 0);

            // 2. Setup
            if (cotizacion.incluir_implementacion) {
                drawItemRow('setup', 'Implementación y Configuración', 'Pago único. Puesta en marcha y capacitación.', cotizacion.costo_implementacion || 0);
            }

            // 3. Modules
            if (cotizacion.modulos_adicionales) {
                cotizacion.modulos_adicionales.forEach((m: any) => {
                    drawItemRow('module', m.nombre, 'Módulo adicional integrado.', m.costo_anual || 0);
                });
            }

            // 4. Chat
            if (cotizacion.servicio_whatsapp) {
                drawItemRow('chat', 'Notificaciones Smart-WhatsApp', 'Automatización de envíos.', cotizacion.costo_whatsapp || 0);
            }

            // 5. Custom
            if (cotizacion.servicio_personalizacion) {
                drawItemRow('custom', 'Personalización White-label', 'Adaptación de marca corporativa.', cotizacion.costo_personalizacion || 0);
            }


            // ==========================================
            // 4. TOTALS (Blue Card)
            // ==========================================
            // Ensure space
            if (tableY + 60 > pageHeight) doc.addPage();

            const totalBoxY = tableY + 10;
            const totalBoxH = 50;

            // Background Indigo
            doc.setFillColor(C_INDIGO_MAIN[0], C_INDIGO_MAIN[1], C_INDIGO_MAIN[2]);
            doc.roundedRect(pageWidth - 20 - 80, totalBoxY, 80, totalBoxH, 6, 6, 'F');

            // Text inside box
            let tCursor = totalBoxY + 15;

            // Subtotal
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text('SUBTOTAL NETO', pageWidth - 80, tCursor);
            doc.setFont('helvetica', 'bold');
            doc.text(`$${(cotizacion.subtotal_anual || 0).toLocaleString()}`, pageWidth - 30, tCursor, { align: 'right' });

            // IVA
            tCursor += 10;
            doc.setFont('helvetica', 'normal');
            doc.text(`IVA (${cotizacion.iva_porcentaje || 13}%)`, pageWidth - 80, tCursor);
            doc.setFont('helvetica', 'bold');
            doc.text(`$${(cotizacion.iva_monto || 0).toLocaleString()}`, pageWidth - 30, tCursor, { align: 'right' });

            // Divider
            tCursor += 5;
            doc.setDrawColor(255, 255, 255);
            doc.setLineWidth(0.1);
            doc.line(pageWidth - 85, tCursor, pageWidth - 35, tCursor);

            // Grand Total
            tCursor += 12;
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text('TOTAL A INVERTIR', pageWidth - 80, tCursor);
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text(`$${(cotizacion.total_anual || 0).toLocaleString()}`, pageWidth - 30, tCursor + 2, { align: 'right' });


            // ==========================================
            // 5. FOOTER
            // ==========================================
            const footerY = pageHeight - 35;
            doc.setFillColor(C_GRAY_50[0], C_GRAY_50[1], C_GRAY_50[2]);
            doc.rect(0, footerY, pageWidth, 35, 'F');
            doc.setDrawColor(C_GRAY_100[0], C_GRAY_100[1], C_GRAY_100[2]);
            doc.line(0, footerY, pageWidth, footerY);

            // Agent Info
            const agentName = (cotizacion.creator?.full_name || 'Agente Comercial').toUpperCase();
            const agentEmail = (cotizacion.creator?.email || 'ventas@ariasdefense.com').toUpperCase();

            // Avatar placeholder
            doc.setFillColor(C_INDIGO_MAIN[0], C_INDIGO_MAIN[1], C_INDIGO_MAIN[2]);
            doc.roundedRect(20, footerY + 8, 12, 12, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.text(agentName.charAt(0), 26, footerY + 16, { align: 'center' });

            // Text info
            doc.setTextColor(C_SLATE_900[0], C_SLATE_900[1], C_SLATE_900[2]);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text('PROPUESTA ELABORADA POR', 38, footerY + 11);

            doc.setFontSize(10);
            doc.text(agentName, 38, footerY + 16);

            doc.setFontSize(7);
            doc.setTextColor(C_GRAY_400[0], C_GRAY_400[1], C_GRAY_400[2]);
            doc.setFont('helvetica', 'normal');
            doc.text(agentEmail, 38, footerY + 20);

            // Right footer info
            doc.setFontSize(7);
            doc.setTextColor(C_INDIGO_MAIN[0], C_INDIGO_MAIN[1], C_INDIGO_MAIN[2]);
            doc.setFont('helvetica', 'bold');
            doc.text('DOCUMENTO OFICIAL', pageWidth - 20, footerY + 12, { align: 'right' });

            doc.setTextColor(C_GRAY_400[0], C_GRAY_400[1], C_GRAY_400[2]);
            doc.text(`${new Date().getFullYear()} ARIAS CRM`, pageWidth - 20, footerY + 18, { align: 'right' });


            // ==========================================
            // OUTPUT & UPLOAD
            // ==========================================
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
            console.error('ERROR PDF NATIVE:', err);
            throw err;
        }
    }
};
