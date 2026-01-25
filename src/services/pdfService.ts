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


            // Palette
            const C_SLATE_900 = [15, 23, 42];
            const C_INDIGO_MAIN = [68, 73, 170];
            const C_BLUE_500 = [59, 130, 246];
            const C_SLATE_400 = [148, 163, 184];
            const C_GRAY_50 = [249, 250, 251];


            // Helper: Load Image
            const loadImage = async (url: string) => {
                if (!url) return null;
                try {
                    return await new Promise<string>((resolve, reject) => {
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
                        img.onerror = reject;
                        img.src = url;
                    });
                } catch (e) { return null; }
            };

            // ==========================================
            // 1. HEADER
            // ==========================================
            const headerH = 65;
            doc.setFillColor(C_SLATE_900[0], C_SLATE_900[1], C_SLATE_900[2]);
            doc.rect(0, 0, pageWidth, headerH, 'F');

            // Gradient effect (Right side lighter)
            doc.setFillColor(30, 41, 59);
            doc.rect(pageWidth / 1.5, 0, pageWidth - (pageWidth / 1.5), headerH, 'F');

            // LOGO
            const logoData = await loadImage(cotizacion.company?.logo_url);
            if (logoData) {
                doc.addImage(logoData, 'PNG', 20, 15, 45, 18, undefined, 'FAST');
            } else {
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(22);
                doc.setFont('helvetica', 'bold');
                doc.text((cotizacion.company?.name || 'BRAND').slice(0, 10).toUpperCase(), 20, 28);
            }

            // Company Info
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text((cotizacion.company?.name || 'SU EMPRESA').toUpperCase(), 20, 40);

            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(C_SLATE_400[0], C_SLATE_400[1], C_SLATE_400[2]);
            doc.text(`${cotizacion.company?.address || ''} • ${cotizacion.company?.phone || ''}`, 20, 45);

            doc.setTextColor(C_BLUE_500[0], C_BLUE_500[1], C_BLUE_500[2]);
            doc.text((cotizacion.company?.website || '').replace(/^https?:\/\//, '').toUpperCase(), 20, 50);

            // Quote ID (Right)
            doc.setTextColor(C_BLUE_500[0], C_BLUE_500[1], C_BLUE_500[2]);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text('COTIZACIÓN OFICIAL', pageWidth - 20, 20, { align: 'right' });

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(32);
            doc.setFont('helvetica', 'normal'); // Thin look
            doc.text(cotizacion.id.slice(0, 8).toUpperCase(), pageWidth - 20, 35, { align: 'right' });

            // Grid stats
            doc.setDrawColor(51, 65, 85);
            doc.line(pageWidth - 90, 45, pageWidth - 20, 45);

            const gridY = 52;
            doc.setFontSize(6);
            doc.setTextColor(C_SLATE_400[0], C_SLATE_400[1], C_SLATE_400[2]);
            doc.text('FECHA EMISIÓN', pageWidth - 85, gridY);
            doc.text('REFERENCIA ID', pageWidth - 45, gridY);

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(format(new Date(cotizacion.created_at || new Date()), 'dd/MM/yyyy'), pageWidth - 85, gridY + 5);
            doc.text(cotizacion.id.slice(0, 6).toUpperCase(), pageWidth - 45, gridY + 5);


            // ==========================================
            // 2. CLIENT & BODY
            // ==========================================
            let cursorY = 90;

            // Label "CLIENTE RECEPTOR"
            doc.setTextColor(C_BLUE_500[0], C_BLUE_500[1], C_BLUE_500[2]);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text('CLIENTE RECEPTOR', 20, cursorY - 12);

            // Name
            doc.setTextColor(C_SLATE_900[0], C_SLATE_900[1], C_SLATE_900[2]);
            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');
            doc.text(cotizacion.nombre_cliente, 20, cursorY);

            // Company Tag
            if (cotizacion.empresa_cliente) {
                cursorY += 8;
                doc.setFillColor(C_BLUE_500[0], C_BLUE_500[1], C_BLUE_500[2]);
                doc.circle(22, cursorY - 1, 1, 'F'); // Blue dot
                doc.setFontSize(9);
                doc.setTextColor(C_BLUE_500[0], C_BLUE_500[1], C_BLUE_500[2]);
                doc.text(cotizacion.empresa_cliente.toUpperCase(), 26, cursorY);
            }

            // Contact Info Boxes (Gray Backgrounds)
            cursorY += 10;
            doc.setFillColor(C_GRAY_50[0], C_GRAY_50[1], C_GRAY_50[2]);
            doc.setDrawColor(C_GRAY_100[0], C_GRAY_100[1], C_GRAY_100[2]);

            // Email Box
            if (cotizacion.email_cliente) {
                doc.roundedRect(20, cursorY, 80, 12, 3, 3, 'FD');
                doc.setFontSize(8);
                doc.setTextColor(100, 116, 139);
                doc.text(cotizacion.email_cliente, 30, cursorY + 8);
                cursorY += 16;
            }
            // Phone Box
            if (cotizacion.telefono_cliente) {
                doc.roundedRect(20, cursorY, 80, 12, 3, 3, 'FD');
                doc.setFontSize(8);
                doc.setTextColor(100, 116, 139);
                doc.text(cotizacion.telefono_cliente, 30, cursorY + 8);
            }

            // Right Side: Executive Summary
            const summaryX = pageWidth - 90;
            doc.setFillColor(C_GRAY_50[0], C_GRAY_50[1], C_GRAY_50[2]);
            doc.roundedRect(summaryX, 80, 70, 35, 4, 4, 'FD');

            doc.setTextColor(C_SLATE_400[0], C_SLATE_400[1], C_SLATE_400[2]);
            doc.setFontSize(7);
            doc.text('PLAN SELECCIONADO', summaryX + 35, 87, { align: 'center' });

            doc.setTextColor(C_INDIGO_MAIN[0], C_INDIGO_MAIN[1], C_INDIGO_MAIN[2]);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text((cotizacion.plan_nombre || 'N/A').toUpperCase(), summaryX + 35, 95, { align: 'center' });

            doc.setTextColor(C_SLATE_900[0], C_SLATE_900[1], C_SLATE_900[2]);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(`${(cotizacion.volumen_dtes || 0).toLocaleString()} DTEs/año`, summaryX + 35, 102, { align: 'center' });


            // ==========================================
            // 3. TABLE
            // ==========================================
            let tableY = 145;

            // Header
            doc.setFillColor(C_GRAY_50[0], C_GRAY_50[1], C_GRAY_50[2]);
            doc.rect(20, tableY, pageWidth - 40, 12, 'F');

            doc.setTextColor(148, 163, 184);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text('DESCRIPCIÓN DEL SERVICIO', 30, tableY + 8);
            doc.text('INVERSIÓN (USD)', pageWidth - 30, tableY + 8, { align: 'right' });

            tableY += 16;

            const drawRow = (type: string, title: string, subtitle: string, price: number) => {
                // Icon Background
                let iconColor = C_BLUE_500;
                if (type === 'setup') iconColor = [251, 146, 60]; // Orange
                if (type === 'module') iconColor = [168, 85, 247]; // Purple
                if (type === 'chat') iconColor = [34, 197, 94]; // Green

                doc.setFillColor(iconColor[0], iconColor[1], iconColor[2], 0.1);
                doc.roundedRect(20, tableY, 12, 12, 3, 3, 'F');
                // Visual dot for icon
                doc.setFillColor(iconColor[0], iconColor[1], iconColor[2]);
                doc.circle(26, tableY + 6, 2, 'F');

                doc.setTextColor(C_SLATE_900[0], C_SLATE_900[1], C_SLATE_900[2]);
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.text(title, 38, tableY + 5);

                doc.setFontSize(8);
                doc.setTextColor(148, 163, 184);
                doc.setFont('helvetica', 'normal');
                doc.text(subtitle, 38, tableY + 10);

                doc.setTextColor(C_SLATE_900[0], C_SLATE_900[1], C_SLATE_900[2]);
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text(`$${price.toLocaleString()}`, pageWidth - 30, tableY + 7, { align: 'right' });

                tableY += 20;

                // Separator
                doc.setDrawColor(241, 245, 249);
                doc.line(20, tableY - 4, pageWidth - 20, tableY - 4);
            };

            // Items
            drawRow('plan', `Licencia Anual ${cotizacion.plan_nombre}`, 'Suite DTE completa.', cotizacion.costo_plan_anual || 0);
            if (cotizacion.incluir_implementacion) drawRow('setup', 'Implementación y Configuración', 'Pago único.', cotizacion.costo_implementacion || 0);
            cotizacion.modulos_adicionales?.forEach((m: any) => drawRow('module', m.nombre, 'Módulo adicional.', m.costo_anual || 0));
            if (cotizacion.servicio_whatsapp) drawRow('chat', 'Smart-WhatsApp', 'Notificaciones auto.', cotizacion.costo_whatsapp || 0);
            if (cotizacion.servicio_personalizacion) drawRow('setup', 'Personalización White-Label', 'Branding corporativo.', cotizacion.costo_personalizacion || 0);

            // ==========================================
            // 4. TOTALS (INDIGO BOX)
            // ==========================================
            const pageHeight = doc.internal.pageSize.getHeight();
            if (tableY + 60 > pageHeight) doc.addPage();
            const totalBoxY = tableY + 10;
            const totalBoxX = pageWidth - 100;

            doc.setFillColor(C_INDIGO_MAIN[0], C_INDIGO_MAIN[1], C_INDIGO_MAIN[2]);
            doc.roundedRect(totalBoxX, totalBoxY, 80, 55, 6, 6, 'F');

            let ty = totalBoxY + 15;
            doc.setTextColor(255, 255, 255);

            // Subtotal
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text('SUBTOTAL NETO', totalBoxX + 10, ty);
            doc.setFont('helvetica', 'bold');
            doc.text(`$${(cotizacion.subtotal_anual || 0).toLocaleString()}`, pageWidth - 25, ty, { align: 'right' });

            // IVA
            ty += 10;
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(`IVA (${cotizacion.iva_porcentaje}%)`, totalBoxX + 10, ty);
            doc.text(`$${(cotizacion.iva_monto || 0).toLocaleString()}`, pageWidth - 25, ty, { align: 'right' });

            // Line
            doc.setDrawColor(255, 255, 255, 0.2);
            doc.line(totalBoxX + 10, ty + 5, pageWidth - 25, ty + 5);

            // Total
            ty += 18;
            doc.setFontSize(10);
            doc.text('TOTAL A INVERTIR', totalBoxX + 10, ty);
            doc.setFontSize(24);
            doc.text(`$${(cotizacion.total_anual || 0).toLocaleString()}`, pageWidth - 25, ty + 2, { align: 'right' });

            // ==========================================
            // 5. FOOTER (With QR & Avatar)
            // ==========================================
            const footerY = pageHeight - 40;
            doc.setFillColor(C_GRAY_50[0], C_GRAY_50[1], C_GRAY_50[2]);
            doc.rect(0, footerY, pageWidth, 40, 'F');

            // Left: Avatar + Agent Info
            const avatarUrl = cotizacion.creator?.avatar_url;
            const avatarData = await loadImage(avatarUrl);

            if (avatarData) {
                doc.addImage(avatarData, 'PNG', 20, footerY + 8, 12, 12, undefined, 'FAST');
                doc.setDrawColor(C_INDIGO_MAIN[0], C_INDIGO_MAIN[1], C_INDIGO_MAIN[2]);
                doc.setLineWidth(0.5);
                doc.rect(20, footerY + 8, 12, 12); // Border
            } else {
                doc.setFillColor(C_INDIGO_MAIN[0], C_INDIGO_MAIN[1], C_INDIGO_MAIN[2]);
                doc.rect(20, footerY + 8, 12, 12, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(8);
                doc.text((cotizacion.creator?.full_name || 'A').charAt(0).toUpperCase(), 26, footerY + 15, { align: 'center' });
            }

            doc.setTextColor(C_BLUE_500[0], C_BLUE_500[1], C_BLUE_500[2]);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text('PROPUESTA ELABORADA POR', 38, footerY + 12);

            doc.setTextColor(C_SLATE_900[0], C_SLATE_900[1], C_SLATE_900[2]);
            doc.setFontSize(11);
            doc.text((cotizacion.creator?.full_name || 'AGENTE COMERCIAL').toUpperCase(), 38, footerY + 18);

            // Right: QR Code (Website)
            const qrTarget = cotizacion.company?.website || cotizacion.creator?.website || 'https://ariesdefense.com';
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrTarget)}`;
            const qrData = await loadImage(qrUrl);

            if (qrData) {
                doc.addImage(qrData, 'PNG', pageWidth - 35, footerY + 5, 15, 15);
            }

            doc.setTextColor(C_SLATE_400[0], C_SLATE_400[1], C_SLATE_400[2]);
            doc.setFontSize(7);
            doc.text('DOCUMENTO OFICIAL', pageWidth - 40, footerY + 25, { align: 'right' });
            doc.text(cotizacion.company?.name || 'SaaS PRO', pageWidth - 40, footerY + 29, { align: 'right' });


            // OUTPUT
            const pdfBlob = doc.output('blob');
            const fileName = `Propuesta_${cotizacion.nombre_cliente}_${Date.now()}.pdf`;
            const { error } = await supabase.storage.from('quotations').upload(fileName, pdfBlob, { upsert: true });
            if (error) throw error;

            return supabase.storage.from('quotations').getPublicUrl(fileName).data.publicUrl;

        } catch (err: any) {
            console.error('PDF Error:', err);
            throw err;
        }
    }
};
