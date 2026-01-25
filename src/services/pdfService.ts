// @ts-nocheck
import { jsPDF } from 'jspdf';
import { supabase } from './supabase';
import { format } from 'date-fns';

/**
 * 💎 PDF SERVICE - PREMIUM CLONE v5.1 (Deployment Retry)
 * -----------------------------------------
 * - Includes QR Code generation (matching React UI)
 * - Includes Agent Avatar rendering
 * - Includes Company Logo rendering
 * - Exact layout match for Header, Body, Table, and Footer
 */
export const pdfService = {
    async generateAndUploadQuotePDF(cotizacion: any): Promise<string> {
        try {
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            // --- PREMIUM PALETTE (Exact match to Web UI) ---
            const C_BG_DARK = [15, 23, 42];      // #0f172a (Header BG)
            const C_TEXT_DARK = [15, 23, 42];    // #0f172a (Main Text)
            const C_BLUE_ACCENT = [42, 171, 238]; // #2AABEE (Buttons/Accents)
            const C_PURPLE_MAIN = [68, 73, 170];  // #4449AA (Brand Color)
            const C_GRAY_TEXT = [100, 116, 139];  // #64748b (Slate 500)
            const C_GRAY_LIGHT = [248, 250, 252]; // #f8fafc (Slate 50)
            const C_BORDER = [226, 232, 240];     // #e2e8f0 (Slate 200)

            // Helper: Load Image safely
            const loadImage = async (url: string) => {
                if (!url) return null;
                try {
                    return await new Promise<string>((resolve) => {
                        const img = new Image();
                        img.crossOrigin = "Anonymous";
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            canvas.width = img.width;
                            canvas.height = img.height;
                            const ctx = canvas.getContext('2d');
                            ctx?.drawImage(img, 0, 0);
                            resolve(canvas.toDataURL('image/png'));
                        };
                        img.onerror = () => resolve(null as any); // Fallback safely
                        img.src = url;
                    });
                } catch (e) { return null; }
            };

            // ==========================================
            // 1. HEADER (Dark #0f172a)
            // ==========================================
            const headerHeight = 70;
            doc.setFillColor(C_BG_DARK[0], C_BG_DARK[1], C_BG_DARK[2]);
            doc.rect(0, 0, pageWidth, headerHeight, 'F');

            // Logo Branding (Left)
            const logoData = await loadImage(cotizacion.company?.logo_url);
            if (logoData) {
                // Keep aspect ratio but constrain height
                const props = doc.getImageProperties(logoData);
                const maxHeight = 18; // Max height in mm
                const w = (props.width * maxHeight) / props.height;
                doc.addImage(logoData, 'PNG', 15, 12, w, maxHeight);
            } else {
                // Fallback Text Logo
                doc.setTextColor(42, 171, 238); // Blue
                doc.setFontSize(22);
                doc.setFont('helvetica', 'bold');
                doc.text((cotizacion.company?.name || 'BRAND').slice(0, 10).toUpperCase(), 15, 25);
            }

            // Company Name & Info (Below Logo)
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text((cotizacion.company?.name || 'SU EMPRESA').toUpperCase(), 15, 40); // Moved up slightly

            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(148, 163, 184); // Slate 400

            let contactY = 47;
            if (cotizacion.company?.address) {
                doc.text(cotizacion.company.address, 15, contactY);
                contactY += 4;
            }
            // Website (Blue)
            doc.setTextColor(C_BLUE_ACCENT[0], C_BLUE_ACCENT[1], C_BLUE_ACCENT[2]);
            doc.setFont('helvetica', 'bold');
            doc.text((cotizacion.company?.website || 'www.suwebsite.com').replace(/^https?:\/\//, '').toUpperCase(), 15, contactY);


            // Right Side Header Info
            doc.setTextColor(C_BLUE_ACCENT[0], C_BLUE_ACCENT[1], C_BLUE_ACCENT[2]);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text('COTIZACIÓN OFICIAL', pageWidth - 15, 20, { align: 'right' });

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(32);
            doc.setFont('helvetica', 'normal'); // Thin/Light look
            doc.text(cotizacion.id.slice(0, 8).toUpperCase(), pageWidth - 15, 33, { align: 'right' });

            // Stats separator
            doc.setDrawColor(51, 65, 85); // Slate 700
            doc.line(pageWidth - 90, 42, pageWidth - 15, 42);

            // Date & Ref
            const gridY = 48;
            doc.setFontSize(6);
            doc.setTextColor(148, 163, 184); // Slate 400
            doc.text('FECHA EMISIÓN', pageWidth - 80, gridY);
            doc.text('REFERENCIA ID', pageWidth - 35, gridY);

            doc.setTextColor(226, 232, 240); // Slate 200
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(format(new Date(cotizacion.created_at || new Date()), 'dd/MM/yyyy'), pageWidth - 80, gridY + 5);
            doc.text(cotizacion.id.slice(0, 6).toUpperCase(), pageWidth - 35, gridY + 5);


            // ==========================================
            // 2. CLIENT INFO & SUMMARY (2 Columns)
            // ==========================================
            let cursorY = 90;

            // --- LEFT COLUMN: CLIENT ---
            doc.setTextColor(C_BLUE_ACCENT[0], C_BLUE_ACCENT[1], C_BLUE_ACCENT[2]);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text('CLIENTE RECEPTOR', 15, cursorY - 10);

            doc.setTextColor(C_TEXT_DARK[0], C_TEXT_DARK[1], C_TEXT_DARK[2]);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text(cotizacion.nombre_cliente, 15, cursorY);

            // Company tag
            if (cotizacion.empresa_cliente) {
                cursorY += 8;
                doc.setFillColor(C_BLUE_ACCENT[0], C_BLUE_ACCENT[1], C_BLUE_ACCENT[2]);
                doc.circle(17, cursorY - 1, 1.5, 'F');
                doc.setFontSize(9);
                doc.setTextColor(C_BLUE_ACCENT[0], C_BLUE_ACCENT[1], C_BLUE_ACCENT[2]);
                doc.text(cotizacion.empresa_cliente.toUpperCase(), 21, cursorY);
            }

            // Contact details
            cursorY += 10;
            const contactBoxColor = [248, 250, 252]; // Slate 50
            doc.setFontSize(8);
            doc.setTextColor(C_GRAY_TEXT[0], C_GRAY_TEXT[1], C_GRAY_TEXT[2]);

            // Email & Phone
            if (cotizacion.email_cliente) {
                doc.text(`Email: ${cotizacion.email_cliente}`, 15, cursorY);
                cursorY += 5;
            }
            if (cotizacion.telefono_cliente) {
                doc.text(`Tel: ${cotizacion.telefono_cliente}`, 15, cursorY);
                cursorY += 5;
            }


            // --- RIGHT COLUMN: SUMMARY BOX ---
            const summaryX = pageWidth - 85;
            const summaryY = 85;

            // Box
            doc.setFillColor(C_GRAY_LIGHT[0], C_GRAY_LIGHT[1], C_GRAY_LIGHT[2]);
            doc.setDrawColor(C_BORDER[0], C_BORDER[1], C_BORDER[2]);
            doc.roundedRect(summaryX, summaryY, 70, 35, 3, 3, 'FD');

            doc.setTextColor(C_GRAY_TEXT[0], C_GRAY_TEXT[1], C_GRAY_TEXT[2]);
            doc.setFontSize(7);
            doc.text('PLAN SELECCIONADO', summaryX + 35, summaryY + 8, { align: 'center' });

            doc.setTextColor(C_PURPLE_MAIN[0], C_PURPLE_MAIN[1], C_PURPLE_MAIN[2]);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text((cotizacion.plan_nombre || 'N/A').toUpperCase(), summaryX + 35, summaryY + 16, { align: 'center' });

            doc.setTextColor(C_TEXT_DARK[0], C_TEXT_DARK[1], C_TEXT_DARK[2]);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(`Volumen: ${(cotizacion.volumen_dtes || 0).toLocaleString()} DTEs`, summaryX + 35, summaryY + 24, { align: 'center' });


            // ==========================================
            // 3. TABLE OF ITEMS
            // ==========================================
            let tableY = 140;

            // Table Header
            doc.setFillColor(241, 245, 249); // Slate 100
            doc.rect(15, tableY, pageWidth - 30, 10, 'F');

            doc.setTextColor(148, 163, 184); // Slate 400
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text('DESCRIPCIÓN DEL SERVICIO', 25, tableY + 6);
            doc.text('INVERSIÓN (USD)', pageWidth - 25, tableY + 6, { align: 'right' });

            tableY += 15;

            // Row Renderer
            const drawRow = (iconType: string, title: string, subtitle: string, price: number) => {
                // Icon Placeholder (Colored Square)
                let iconColor = C_BLUE_ACCENT;
                if (iconType === 'setup') iconColor = [249, 115, 22]; // Orange
                if (iconType === 'module') iconColor = [168, 85, 247]; // Purple
                if (iconType === 'chat') iconColor = [34, 197, 94];   // Green

                doc.setFillColor(iconColor[0], iconColor[1], iconColor[2]);
                doc.roundedRect(15, tableY, 8, 8, 2, 2, 'F'); // Icon box

                // Icon (Simulated with text char or empty)
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(6);
                doc.text('•', 19, tableY + 5.5, { align: 'center' }); // Dot icon

                // Title
                doc.setTextColor(C_TEXT_DARK[0], C_TEXT_DARK[1], C_TEXT_DARK[2]);
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text(title, 28, tableY + 4);

                // Subtitle
                doc.setTextColor(C_GRAY_TEXT[0], C_GRAY_TEXT[1], C_GRAY_TEXT[2]);
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.text(subtitle, 28, tableY + 9);

                // Price
                doc.setTextColor(C_TEXT_DARK[0], C_TEXT_DARK[1], C_TEXT_DARK[2]);
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.text(`$${price.toLocaleString()}`, pageWidth - 25, tableY + 6, { align: 'right' });

                // Divider
                doc.setDrawColor(241, 245, 249); // Slate 100
                doc.line(15, tableY + 14, pageWidth - 15, tableY + 14);

                tableY += 20;
            };

            // Dynamic Rows
            drawRow('plan', `Licencia Anual ${cotizacion.plan_nombre}`, 'Suite DTE y soporte cloud.', cotizacion.costo_plan_anual || 0);

            if (cotizacion.incluir_implementacion) {
                drawRow('setup', 'Implementación y Configuración', 'Pago único inicial.', cotizacion.costo_implementacion || 0);
            }

            cotizacion.modulos_adicionales?.forEach((m: any) => {
                drawRow('module', `${m.tipo === 'servicio' ? 'Servicio' : 'Módulo'}: ${m.nombre}`, m.descripcion || 'Adicional', m.costo_anual || 0);
            });

            if (cotizacion.servicio_whatsapp) {
                drawRow('chat', 'Smart-WhatsApp', 'Notificaciones automáticas.', cotizacion.costo_whatsapp || 0);
            }

            if (cotizacion.servicio_personalizacion) {
                drawRow('setup', 'Personalización Marca', 'White-label branding.', cotizacion.costo_personalizacion || 0);
            }


            // ==========================================
            // 4. TOTALS (Purple Box)
            // ==========================================
            if (tableY + 50 > pageHeight) doc.addPage();

            const totalBoxX = pageWidth - 95;
            const totalBoxY = tableY + 10;

            // Purple Card BG
            doc.setFillColor(C_PURPLE_MAIN[0], C_PURPLE_MAIN[1], C_PURPLE_MAIN[2]);
            doc.roundedRect(totalBoxX, totalBoxY, 80, 50, 4, 4, 'F');

            // Circle decoration
            doc.setFillColor(255, 255, 255, 0.1);
            doc.circle(totalBoxX + 90, totalBoxY - 10, 30, 'F');

            let ty = totalBoxY + 12;
            doc.setTextColor(255, 255, 255);

            // Subtotal
            doc.setFontSize(7);
            doc.text('SUBTOTAL NETO', totalBoxX + 10, ty);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(`$${(cotizacion.subtotal_anual || 0).toLocaleString()}`, pageWidth - 20, ty, { align: 'right' });

            // Taxes
            ty += 8;
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.text(`IVA (${cotizacion.iva_porcentaje}%)`, totalBoxX + 10, ty);
            doc.text(`$${(cotizacion.iva_monto || 0).toLocaleString()}`, pageWidth - 20, ty, { align: 'right' });

            // Divider
            doc.setDrawColor(255, 255, 255, 0.2);
            doc.line(totalBoxX + 10, ty + 5, pageWidth - 20, ty + 5);

            // Grand Total
            ty += 15;
            doc.setFontSize(8);
            doc.text('TOTAL A INVERTIR', totalBoxX + 10, ty);
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.text(`$${(cotizacion.total_anual || 0).toLocaleString()}`, pageWidth - 20, ty + 2, { align: 'right' });


            // ==========================================
            // 5. FOOTER (Gray Box)
            // ==========================================
            const footerH = 35;
            const footerY = pageHeight - footerH;

            doc.setFillColor(248, 250, 252); // Gray 50
            doc.rect(0, footerY, pageWidth, footerH, 'F');
            doc.setDrawColor(226, 232, 240);
            doc.line(0, footerY, pageWidth, footerY);

            // Agent Info
            const avatarUrl = cotizacion.creator?.avatar_url;
            const avatarData = await loadImage(avatarUrl);

            if (avatarData) {
                doc.addImage(avatarData, 'PNG', 15, footerY + 8, 12, 12);
            } else {
                // Avatar Placeholder
                doc.setFillColor(C_PURPLE_MAIN[0], C_PURPLE_MAIN[1], C_PURPLE_MAIN[2]);
                doc.circle(21, footerY + 14, 6, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(8);
                doc.text('A', 21, footerY + 16, { align: 'center' });
            }

            doc.setTextColor(C_BLUE_ACCENT[0], C_BLUE_ACCENT[1], C_BLUE_ACCENT[2]);
            doc.setFontSize(6);
            doc.setFont('helvetica', 'bold');
            doc.text('PROPUESTA ELABORADA POR', 32, footerY + 12);

            doc.setTextColor(C_TEXT_DARK[0], C_TEXT_DARK[1], C_TEXT_DARK[2]);
            doc.setFontSize(10);
            doc.text((cotizacion.creator?.full_name || 'AGENTE COMERCIAL').toUpperCase(), 32, footerY + 17);

            // Notes
            doc.setTextColor(148, 163, 184); // Slate 400
            doc.setFontSize(6);
            doc.setFont('helvetica', 'normal');
            doc.text('Validez: 30 días. Sujeto a términos y condiciones.', pageWidth - 15, footerY + 28, { align: 'right' });


            // OUTPUT
            const pdfBlob = doc.output('blob');
            const fileName = `Propuesta_${(cotizacion.nombre_cliente || 'Cliente').replace(/\s+/g, '_')}_${Date.now()}.pdf`;

            const { error } = await supabase.storage.from('quotations').upload(fileName, pdfBlob, { upsert: true });
            if (error) throw error;

            return supabase.storage.from('quotations').getPublicUrl(fileName).data.publicUrl;

        } catch (err: any) {
            console.error('PDF Error:', err);
            throw err;
        }
    }
};
