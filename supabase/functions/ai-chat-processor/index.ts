// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';
import { format } from "https://esm.sh/date-fns";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 🌍 CONFIGURACIÓN DE DOMINIO
// const FRONTEND_URL = "http://localhost:5173"; 
const FRONTEND_URL = "https://crm-app-v2.vercel.app";
/**
 * 💎 V59: THE RESTORED MASTERPIECE
 * - Exact Layout Match with pdfService.ts
 * - Restored Notes Section (Missing in V58)
 * - Restored Detailed Totals Box (with Subtotal, Check, Discount logic)
 * - Restored Filename Format
 */
/**
 * 💎 V60: THE UNIFIED STANDARD
 * - Exact Match with pdfService.ts (Horizontal Layout)
 * - Shared Financial Logic
 * - Identical Color Palette
 */
function calculateQuoteFinancials(cot: any) {
    const isAnual = cot.tipo_pago === 'anual' || !cot.tipo_pago;
    const ivaPct = (cot.iva_porcentaje || 13) / 100;
    const baseSurchargePct = (cot.recargo_mensual_porcentaje || 20) / 100;
    const totalGeneral = Number(cot.total_anual || 0);
    const pagoInicial = Number(cot.monto_anticipo || cot.costo_implementacion || 0);
    const plazoMeses = cot.plazo_meses || (isAnual ? 12 : 1);

    let termSurchargePct = 0;
    if (!isAnual) {
        if (plazoMeses === 1) termSurchargePct = baseSurchargePct;
        else if (plazoMeses === 3) termSurchargePct = baseSurchargePct * 0.75;
        else if (plazoMeses === 6) termSurchargePct = baseSurchargePct * 0.5;
        else if (plazoMeses === 9) termSurchargePct = baseSurchargePct * 0.25;
    }

    const recurring12MonthsConIVA = totalGeneral - pagoInicial;
    const subtotalRecurrenteBaseAnual = recurring12MonthsConIVA / ((1 + termSurchargePct) * (1 + ivaPct));
    const recargoFinanciamientoAnual = subtotalRecurrenteBaseAnual * termSurchargePct;
    const ivaRecurrenteAnual = (subtotalRecurrenteBaseAnual + recargoFinanciamientoAnual) * ivaPct;

    const divisor = cot.cuotas || (isAnual ? 1 : (plazoMeses || 1));
    const cuotaMensual = recurring12MonthsConIVA / divisor;

    return {
        isMonthly: !isAnual,
        plazoMeses,
        ivaPct,
        termSurchargePct,
        totalAnual: totalGeneral,
        pagoInicial,
        subtotalRecurrenteBase: subtotalRecurrenteBaseAnual,
        recargoFinanciamiento: recargoFinanciamientoAnual,
        ivaRecurrente: ivaRecurrenteAnual,
        cuotaMensual,
        divisor
    };
}

async function generateQuotePDF(cot: any, company: any, creator: any, lead: any, supabase: any) {
    try {
        const pdfDoc = await PDFDocument.create();

        // 1. LOAD LOGO (If exists)
        let logoImg = null;
        if (company?.logo_url) {
            try {
                const resp = await fetch(company.logo_url);
                if (resp.ok) {
                    const imgData = await resp.arrayBuffer();
                    const contentType = resp.headers.get('content-type') || '';
                    if (contentType.includes('png')) logoImg = await pdfDoc.embedPng(imgData);
                    else if (contentType.includes('jpeg') || contentType.includes('jpg')) logoImg = await pdfDoc.embedJpg(imgData);
                }
            } catch (e) {
                console.error("Error loading logo:", e);
            }
        }

        let page = pdfDoc.addPage([595.28, 841.89]);
        const { width, height } = page.getSize();
        const fReg = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const fItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

        // Standard Colors
        const C_DARK = rgb(15 / 255, 23 / 255, 42 / 255);
        const C_BLUE = rgb(37 / 255, 99 / 255, 235 / 255);
        const C_PURPLE = rgb(79 / 255, 70 / 255, 229 / 255);
        const C_ORANGE = rgb(249 / 255, 115 / 255, 22 / 255);
        const C_GREEN = rgb(22 / 255, 163 / 255, 74 / 255);
        const C_SLATE_400 = rgb(148 / 255, 163 / 255, 184 / 255);
        const C_SLATE_500 = rgb(100 / 255, 116 / 255, 139 / 255);
        const C_SLATE_100 = rgb(241 / 255, 245 / 255, 249 / 255);
        const C_BORDER = rgb(226 / 255, 232 / 255, 240 / 255);
        const C_WHITE = rgb(1, 1, 1);

        const mmToPt = (mm: number) => mm * 2.83465;
        const invY = (mmY: number) => 841.89 - mmToPt(mmY);

        const drawRightText = (p: any, text: string, x: number, y: number, size: number, font: any, color: any) => {
            const tw = font.widthOfTextAtSize(text, size);
            p.drawText(text, { x: mmToPt(x) - tw, y: invY(y), size, font, color });
        };

        const drawFooter = async (p: any, pageNum: number) => {
            p.drawRectangle({ x: 0, y: 0, width, height: mmToPt(40), color: C_SLATE_100 });
            p.drawLine({ start: { x: 0, y: mmToPt(40) }, end: { x: width, y: mmToPt(40) }, thickness: 0.5, color: C_BORDER });

            const m = 15;
            const rm = 210 - m;
            p.drawRectangle({ x: mmToPt(m), y: mmToPt(18), width: mmToPt(14), height: mmToPt(14), color: C_DARK });
            const initLetter = (creator?.full_name || 'A')[0].toUpperCase();
            const initW = fBold.widthOfTextAtSize(initLetter, 12);
            p.drawText(initLetter, { x: mmToPt(m + 7) - (initW / 2), y: mmToPt(18 + 5), size: 12, font: fBold, color: C_WHITE });

            p.drawText('PROPUESTA ELABORADA POR', { x: mmToPt(m + 20), y: mmToPt(32), size: 5, font: fBold, color: C_BLUE });
            p.drawText((creator?.full_name || 'Agente Comercial').toUpperCase(), { x: mmToPt(m + 20), y: mmToPt(24), size: 10, font: fBold, color: C_DARK });
            p.drawText(creator?.email || '', { x: mmToPt(m + 20), y: mmToPt(18), size: 7, font: fReg, color: C_SLATE_500 });

            drawRightText(p, (company?.name || '').toUpperCase(), rm, 28, 7, fBold, C_PURPLE);
            drawRightText(p, company?.phone || '', rm, 22, 6, fReg, C_SLATE_500);
            drawRightText(p, company?.website || '', rm, 18, 6, fReg, C_SLATE_500);

            const pNumText = `Propuesta Comercial | Página ${pageNum}`;
            const pNumW = fReg.widthOfTextAtSize(pNumText, 7);
            p.drawText(pNumText, { x: (width / 2) - (pNumW / 2), y: mmToPt(5), size: 7, font: fReg, color: C_SLATE_400 });
        };

        const drawHeader = (p: any) => {
            p.drawRectangle({ x: 0, y: invY(60), width, height: mmToPt(60), color: C_DARK });
            const m = 15;

            // Draw Logo
            if (logoImg) {
                const dims = logoImg.scale(0.3); // Adjust scale
                const hLimit = mmToPt(20);
                const finalH = dims.height > hLimit ? hLimit : dims.height;
                const finalW = (finalH / dims.height) * dims.width;
                p.drawImage(logoImg, { x: mmToPt(m), y: invY(10 + (finalH / 2.8)), width: finalW, height: finalH });
            }

            // Company Info (With overlap prevention)
            const compName = (company?.name || 'SU EMPRESA').toUpperCase();
            const fontSizeComp = compName.length > 25 ? 9 : 11;
            p.drawText(compName, { x: mmToPt(m), y: invY(40), size: fontSizeComp, font: fBold, color: C_WHITE });

            const webUrl = (company?.website || 'WWW.ARIASDEFENSE.COM').replace(/^https?:\/\//, '').toUpperCase();
            p.drawText(webUrl, { x: mmToPt(m), y: invY(45), size: 8, font: fBold, color: rgb(42 / 255, 171 / 255, 238 / 255) });

            drawRightText(p, 'COTIZACIÓN OFICIAL', 210 - m, 12, 7, fBold, rgb(42 / 255, 171 / 255, 238 / 255));
            drawRightText(p, cot.id.slice(0, 8).toUpperCase(), 210 - m, 24, 32, fReg, C_WHITE);
            p.drawLine({ start: { x: mmToPt(210 - m - 70), y: invY(27) }, end: { x: mmToPt(210 - m), y: invY(27) }, thickness: 0.5, color: rgb(51 / 255, 65 / 255, 85 / 255) });

            drawRightText(p, 'FECHA EMISIÓN', 210 - m - 35, 33, 6, fBold, C_SLATE_400);
            drawRightText(p, 'REFERENCIA ID', 210 - m, 33, 6, fBold, C_SLATE_400);
            drawRightText(p, format(new Date(), 'dd/MM/yyyy'), 210 - m - 35, 38, 8, fBold, rgb(209 / 255, 213 / 255, 219 / 255));
            drawRightText(p, cot.id.slice(0, 5).toUpperCase(), 210 - m, 38, 8, fBold, rgb(209 / 255, 213 / 255, 219 / 255));
        };

        drawHeader(page);
        let curY = 75;
        const m = 15;
        const rm = 210 - m;

        // Client
        page.drawText('CLIENTE RECEPTOR', { x: mmToPt(m), y: invY(curY - 7), size: 7, font: fBold, color: C_BLUE });
        page.drawText((cot.nombre_cliente || 'Cliente').toUpperCase(), { x: mmToPt(m), y: invY(curY), size: 26, font: fBold, color: C_DARK });
        if (lead?.company_name) {
            curY += 8;
            page.drawText(lead.company_name.toUpperCase(), { x: mmToPt(m), y: invY(curY), size: 10, font: fBold, color: C_BLUE });
        }

        // Summary Box
        const sX = 135;
        const sY = 75;
        page.drawRectangle({ x: mmToPt(sX), y: invY(sY + 15), width: mmToPt(60), height: mmToPt(25), color: C_SLATE_100, borderColor: C_BORDER, borderWidth: 0.5 });
        const planT = (cot.plan_nombre || 'Plan').toUpperCase();
        const pTW = fBold.widthOfTextAtSize(planT, 14);
        page.drawText(planT, { x: mmToPt(sX + 30) - (pTW / 2), y: invY(sY + 5), size: 14, font: fBold, color: C_PURPLE });
        const vT = `${(cot.volumen_dtes || 0).toLocaleString()} DTEs/año`;
        const vTW = fReg.widthOfTextAtSize(vT, 6);
        page.drawText(vT, { x: mmToPt(sX + 30) - (vTW / 2), y: invY(sY + 10), size: 6, font: fReg, color: C_SLATE_500 });

        curY = Math.max(curY + 25, sY + 25);

        // Table Header
        page.drawRectangle({ x: mmToPt(m), y: invY(curY + 8), width: mmToPt(180), height: mmToPt(8), color: rgb(241 / 255, 245 / 255, 249 / 255) });
        page.drawText('DESCRIPCIÓN DEL SERVICIO', { x: mmToPt(m + 5), y: invY(curY + 5), size: 7, font: fBold, color: C_SLATE_400 });
        drawRightText(page, 'INVERSIÓN (USD)', rm - 5, curY + 5, 7, fBold, C_SLATE_400);

        curY += 14;
        const drawRow = (title: string, price: number, isOneTime = false) => {
            page.drawText(title, { x: mmToPt(m + 5), y: invY(curY), size: 10, font: fBold, color: C_DARK });
            if (isOneTime) {
                const tw = fBold.widthOfTextAtSize(title, 10);
                page.drawRectangle({ x: mmToPt(m + 5 + tw + 3), y: invY(curY + 1), width: mmToPt(16), height: mmToPt(4), color: rgb(255 / 255, 237 / 255, 213 / 255) });
                page.drawText('PAGO ÚNICO', { x: mmToPt(m + 5 + tw + 11) - (fBold.widthOfTextAtSize('PAGO ÚNICO', 5) / 2), y: invY(curY - 1.8), size: 5, font: fBold, color: rgb(154 / 255, 52 / 255, 18 / 255) });
            }
            drawRightText(page, `$${Number(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, rm - 5, curY, 12, fBold, C_DARK);
            page.drawLine({ start: { x: mmToPt(m), y: invY(curY + 4) }, end: { x: mmToPt(rm), y: invY(curY + 4) }, thickness: 0.2, color: C_SLATE_100 });
            curY += 12;
        };

        drawRow(`Licencia Anual ${cot.plan_nombre}`, cot.costo_plan_anual || 0);
        if (cot.costo_implementacion) drawRow('Implementación y Configuración', cot.costo_implementacion, true);
        if (cot.modulos_adicionales) {
            cot.modulos_adicionales.forEach((mod: any) => {
                drawRow(mod.nombre, mod.costo_anual || mod.costo || 0, (mod.costo_mensual || 0) === 0);
            });
        }

        // Financial Boxes (Horizontal)
        const fin = calculateQuoteFinancials(cot);
        let by = curY + 10;
        if (by + 60 > 297 - 40) {
            await drawFooter(page, 1);
            page = pdfDoc.addPage([595.28, 841.89]);
            drawHeader(page);
            by = 70;
        }

        const boxW = 89;
        const gap = 2;

        const drawFinBox = (x: number, y: number, title: string, subtitle: string, mainValue: number, color: any, isRecurrent = false) => {
            const h = 50;
            // Background (Light Version)
            page.drawRectangle({ x: mmToPt(x), y: invY(y + h), width: mmToPt(boxW), height: mmToPt(h), color: rgb(1, 1, 1) }); // White base
            page.drawRectangle({ x: mmToPt(x), y: invY(y + h), width: mmToPt(boxW), height: mmToPt(h), color: color, opacity: 0.05 });
            page.drawRectangle({ x: mmToPt(x), y: invY(y + h), width: mmToPt(boxW), height: mmToPt(h), color: color, opacity: 0.1, borderColor: color, borderWidth: 0.5 });

            // Accent
            page.drawRectangle({ x: mmToPt(x), y: invY(y + h), width: mmToPt(1.5), height: mmToPt(h), color: color });

            page.drawText(title, { x: mmToPt(x + 7), y: invY(y + 8), size: 8.5, font: fBold, color: color });
            page.drawText(subtitle, { x: mmToPt(x + 7), y: invY(y + 12), size: 5.5, font: fReg, color: C_SLATE_400 });

            let lineY = y + 18;
            if (isRecurrent) {
                page.drawText('Licencia + Módulos', { x: mmToPt(x + 7), y: invY(lineY), size: 5.5, font: fReg, color: C_SLATE_400 });
                drawRightText(page, `$${fin.subtotalRecurrenteBase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, x + boxW - 7, lineY, 6, fBold, C_DARK);
                lineY += 4;
                if (fin.recargoFinanciamiento > 0) {
                    page.drawText('+ Recargo Financiamiento', { x: mmToPt(x + 7), y: invY(lineY), size: 5.5, font: fReg, color: C_BLUE });
                    drawRightText(page, `+$ ${fin.recargoFinanciamiento.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, x + boxW - 7, lineY, 6, fBold, C_BLUE);
                    lineY += 4;
                }
                const ivaL = `IVA (${Math.round(fin.ivaPct * 100)}%)`;
                page.drawText(ivaL, { x: mmToPt(x + 7), y: invY(lineY), size: 5.5, font: fReg, color: C_SLATE_400 });
                drawRightText(page, `+$ ${fin.ivaRecurrente.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, x + boxW - 7, lineY, 6, fBold, color);
            } else {
                const sub = fin.pagoInicial / (1 + fin.ivaPct);
                page.drawText('Implementación + Servicios', { x: mmToPt(x + 7), y: invY(lineY), size: 5.5, font: fReg, color: C_SLATE_400 });
                drawRightText(page, `$${sub.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, x + boxW - 7, lineY, 6, fBold, C_DARK);
                lineY += 4;
                const ivaL = `IVA (${Math.round(fin.ivaPct * 100)}%)`;
                page.drawText(ivaL, { x: mmToPt(x + 7), y: invY(lineY), size: 5.5, font: fReg, color: C_SLATE_400 });
                drawRightText(page, `+$ ${(fin.pagoInicial - sub).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, x + boxW - 7, lineY, 6, fBold, color);
            }

            const hY = y + 40;
            const tL = isRecurrent ? (fin.divisor > 1 ? `Cuota de ${fin.divisor}` : 'TOTAL RECURRENTE') : 'TOTAL INICIAL';
            page.drawText(tL, { x: mmToPt(x + 7), y: invY(hY), size: 7.5, font: fBold, color: C_DARK });
            const valS = `$${mainValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            drawRightText(page, valS, x + boxW - 7, hY, 13, fBold, color);
        };

        drawFinBox(m, by, 'PAGO INICIAL', 'Requerido para activar', fin.pagoInicial, C_ORANGE);
        const rColor = fin.isMonthly ? C_BLUE : C_GREEN;
        const rTitle = fin.isMonthly ? 'PAGO RECURRENTE' : 'RECURRENTE ANUAL';
        const rSub = fin.divisor > 1 ? `Pago en ${fin.divisor} cuotas` : 'Pago único acumulado';
        drawFinBox(m + boxW + gap, by, rTitle, rSub, fin.isMonthly ? fin.cuotaMensual : fin.totalAnual, rColor, true);

        // Terms & Conditions (Page 2)
        if (company?.terminos_condiciones) {
            await drawFooter(page, pdfDoc.getPageCount());
            const page2 = pdfDoc.addPage([595.28, 841.89]);
            page2.drawRectangle({ x: 0, y: 841.89 - mmToPt(20), width, height: mmToPt(20), color: C_DARK });
            page2.drawText('TÉRMINOS Y CONDICIONES DEL SERVICIO', { x: mmToPt(m), y: 841.89 - mmToPt(13), size: 12, font: fBold, color: C_WHITE });

            let ty = 35;
            const terms = company.terminos_condiciones.split('\n\n').filter((p: string) => p.trim());
            terms.forEach((para: string, idx: number) => {
                const marker = `${idx + 1}.`;
                page2.drawText(marker, { x: mmToPt(m), y: invY(ty), size: 8, font: fBold, color: C_BLUE });

                // Manual word wrap for accurate Y tracking
                const words = para.trim().replace(/\*\*/g, '').split(' ');
                let currentLine = '';
                const maxWidth = mmToPt(rm - m - 12);

                for (const word of words) {
                    const testLine = currentLine ? `${currentLine} ${word}` : word;
                    const testWidth = fReg.widthOfTextAtSize(testLine, 8.5);

                    if (testWidth > maxWidth && currentLine) {
                        page2.drawText(currentLine, { x: mmToPt(m + 8), y: invY(ty), size: 8.5, font: fReg, color: C_DARK });
                        ty += 4.5; // Line height
                        currentLine = word;
                    } else {
                        currentLine = testLine;
                    }
                }
                if (currentLine) {
                    page2.drawText(currentLine, { x: mmToPt(m + 8), y: invY(ty), size: 8.5, font: fReg, color: C_DARK });
                }
                ty += 10; // Paragraph gap
            });
            await drawFooter(page2, 2);
        } else {
            await drawFooter(page, 1);
        }

        const bytes = await pdfDoc.save();
        const fname = `Cotizacion_${(cot.nombre_cliente || 'Cliente').replace(/\W/g, '_')}_${Date.now()}.pdf`;
        await supabase.storage.from('quotations').upload(fname, bytes, { contentType: 'application/pdf', upsert: true });
        return { url: supabase.storage.from('quotations').getPublicUrl(fname).data.publicUrl };
    } catch (e: any) { return { url: null, error: e.message }; }
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { conversationId } = await req.json(); // Only ID is strictly needed now
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

        // 1. Get Conversation & Lead Context
        const { data: conv } = await supabase.from('marketing_conversations')
            .select('*, lead:leads(*)')
            .eq('id', conversationId)
            .single();

        if (!conv) throw new Error("Conversation not found");
        const companyId = conv.company_id;
        const lead = conv.lead;

        // 2. Get AI Agent Config
        const { data: agent } = await supabase.from('marketing_ai_agents')
            .select('*')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .maybeSingle();

        if (!agent) return new Response(JSON.stringify({ skipped: true, reason: "No active agent" }), { headers: corsHeaders });

        // 3. Get Pricing Context (specific for this company)
        const { data: pricingItems } = await supabase.from('pricing_items')
            .select('*')
            .eq('company_id', companyId)
            .eq('activo', true)
            .order('orden', { ascending: true });

        const pricing = {
            planes: pricingItems?.filter((i: any) => i.tipo === 'plan') || [],
            modulos: pricingItems?.filter((i: any) => i.tipo === 'modulo') || []
        };

        // 4. Build System Prompt (Dynamic)
        const systemPrompt = `
            Eres ${agent.name || 'Asistente IA'}, ${agent.role_description || 'un consultor comercial experto'}.
            Tu tono es ${agent.tone || 'profesional'}.
            Estás hablando con ${lead?.name || 'el cliente'} de la empresa ${lead?.company_name || 'su negocio'}.
            
            OBJETIVO:
            Asesorar sobre facturación electrónica y vender el plan adecuado. 
            NUNCA digas "voy a preparar la cotización", emítela INMEDIATAMENTE usando el código de abajo.

            CONOCIMIENTO DE PRECIOS REALES:
            - Planes: ${JSON.stringify(pricing.planes.map((p: any) => ({ nombre: p.nombre, dtes: `Hasta ${p.max_dtes}`, precio: p.precio_anual })))}
            - Módulos: ${JSON.stringify(pricing.modulos.map((m: any) => ({ nombre: m.nombre, precio: m.precio_anual })))}

            MEMORIA:
            Recuerda lo que el usuario ha dicho anteriormente (ver historial adjunto).
            
            REGLA CRÍTICA DE COTIZACIÓN (MANDATORIA):
            Cuando el cliente pida precios, una cotización, o acepte una recomendación, DEBES incluir este bloque EXACTO al final de tu mensaje:
            QUOTE_TRIGGER: { "plan_name": "NombreDelPlan", "dte_volume": 5000, "items": ["Modulo1", "Modulo2"] }
            
            - plan_name: Debe ser uno de los nombres del catálogo anterior (ej: "Starter", "Business" o "Enterprise").
            - dte_volume: El volumen que el cliente mencionó o el máximo del plan seleccionado.
            - items: Lista de nombres de módulos adicionales solicitados.
        `;

        // 5. Get OpenAI Key
        const { data: iconf } = await supabase.from('marketing_integrations')
            .select('settings').eq('company_id', companyId).eq('provider', 'openai').eq('is_active', true).maybeSingle();
        const apiKey = iconf?.settings?.apiKey;
        if (!apiKey) throw new Error("OpenAI API Key not found");

        // 6. Memory (Last 15 messages for better context)
        const { data: history } = await supabase.from('marketing_messages')
            .select('content, direction, type, sent_at, created_at')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(15);

        // Reverse so the oldest is first in the array sent to OpenAI
        const previousMessages = (history || []).reverse().map((msg: any) => ({
            role: msg.direction === 'inbound' ? 'user' : 'assistant',
            content: msg.type === 'image' ? '[User sent an image]' : msg.content
        }));

        // Check if the last message is indeed from user (inbound). 
        // We only respond if the latest message in this conversation history is from the user.
        const lastMsg = history?.[0];
        if (lastMsg?.direction === 'outbound') {
            console.log("Skipping AI: Last message in history is outbound.");
            return new Response(JSON.stringify({ skipped: true, reason: "Last message was outbound" }), { headers: corsHeaders });
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...previousMessages
                ],
                temperature: 0.7,
            }),
        });
        const aiData = await response.json();
        const aiContent = aiData.choices?.[0]?.message?.content || "";

        // 4. PDF Generation Logic
        let finalPdfUrl = null;
        let finalMsgType = 'text';
        let cleanText = aiContent;

        if (!aiData.choices || aiData.choices.length === 0) {
            console.error("OpenAI Error Response:", JSON.stringify(aiData));
            if (aiData.error?.code === 'insufficient_quota') {
                cleanText = "⚠️ [Nota del Sistema]: Mi cerebro de IA (OpenAI) se ha quedado sin saldo. Por favor, revisa tu cuota y facturación en OpenAI.";
            } else {
                throw new Error(aiData.error?.message || "OpenAI returned no choices");
            }
        }

        const triggerMatch = cleanText.match(/\[\[QUOTE:\s*({[\s\S]*?})\s*\]\]/) || cleanText.includes('QUOTE_TRIGGER:');

        if (triggerMatch) {
            console.log('Quote Trigger Detected');
            let volume = 3000;
            let planNameRequested = "";
            let extraItems = [];

            // Parsing Logic
            try {
                if (aiContent.includes('QUOTE_TRIGGER:')) {
                    const parts = aiContent.split('QUOTE_TRIGGER:');
                    cleanText = parts[0].trim();
                    const data = JSON.parse(parts[1].trim());
                    volume = data.dte_volume || 3000;
                    planNameRequested = data.plan_name || "";
                    extraItems = data.items || [];
                } else {
                    const m = aiContent.match(/\[\[QUOTE:\s*({[\s\S]*?})\s*\]\]/);
                    if (m) {
                        const data = JSON.parse(m[1]);
                        volume = data.dte_volume || 3000;
                        planNameRequested = data.plan_name || "";
                        extraItems = data.items || [];
                    }
                }
            } catch (e) { console.error("Parse Error", e); }

            // Semantic Cleanup: Always remove the trigger block from the user message
            cleanText = aiContent.replace(/\[\[\s*QUOTE\s*:[\s\S]*?\]\]/gi, '').replace(/QUOTE_TRIGGER:[\s\S]*/gi, '').trim();

            // 4.1. FIND REAL PLAN AND PRICES
            // Get Pricing Context (specific for this company)
            const { data: DBpricingItems } = await supabase.from('pricing_items')
                .select('*')
                .eq('company_id', companyId)
                .eq('activo', true)
                .order('orden', { ascending: true });

            const planes = DBpricingItems?.filter((i: any) => i.tipo === 'plan') || [];
            const modulos = DBpricingItems?.filter((i: any) => i.tipo === 'modulo') || [];

            // Find best plan match
            let selectedPlan = planes.find((p: any) =>
                p.nombre.toLowerCase().includes(planNameRequested.toLowerCase()) ||
                (volume > 0 && volume <= (p.max_dtes || 9999999))
            ) || planes[0];

            let baseAnual = Number(selectedPlan?.precio_anual || 0);
            let implementation = Number(selectedPlan?.costo_unico || 0);
            let extrasTotal = 0;

            // Map extras from DB
            const dbExtras = [];
            for (const itemRequested of extraItems) {
                const name = typeof itemRequested === 'string' ? itemRequested : itemRequested.name;
                const dbMod = modulos.find((m: any) => m.nombre.toLowerCase().includes(name.toLowerCase()));
                if (dbMod) {
                    dbExtras.push({
                        nombre: dbMod.nombre,
                        costo: dbMod.precio_anual, // For compatibility
                        costo_anual: dbMod.precio_anual, // For frontend detail view
                        costo_mensual: dbMod.precio_anual / 12,
                        tipo: dbMod.tipo,
                        descripcion: dbMod.descripcion || ""
                    });
                    extrasTotal += Number(dbMod.precio_anual || dbMod.costo_unico || 0);
                }
            }

            const subtotal = baseAnual + implementation + extrasTotal;
            const iva = subtotal * 0.13;
            const total = subtotal + iva;

            // 4.2. Generate Data
            const { data: comp } = await supabase.from('companies').select('*').eq('id', companyId).single();
            const { data: profiles } = await supabase.from('profiles').select('full_name, email').eq('company_id', companyId).limit(1);
            const prof = profiles?.[0] || { full_name: 'Agente AI', email: 'ai@ariasdefense.com' };

            const { data: quoteObj, error: quoteError } = await supabase.from('cotizaciones').insert({
                company_id: companyId,
                lead_id: lead.id,
                nombre_cliente: lead?.name || 'Cliente',
                volumen_dtes: volume,
                plan_nombre: selectedPlan?.nombre || 'PLAN PERSONALIZADO',
                costo_plan_anual: baseAnual,
                costo_plan_mensual: baseAnual / 12,
                costo_implementacion: implementation,
                modulos_adicionales: dbExtras,
                subtotal_anual: subtotal,
                subtotal_mensual: subtotal / 12,
                total_anual: total,
                total_mensual: total / 12,
                iva_porcentaje: 13,
                iva_monto: iva,
                estado: 'borrador'
            }).select().single();

            if (quoteError) console.error("Quote Insert Error:", quoteError);

            if (quoteObj) {
                // Generate PDF as backup/downloadable
                const pdfRes = await generateQuotePDF(quoteObj, comp, prof, lead, supabase);
                if (pdfRes.url) {
                    finalPdfUrl = pdfRes.url;
                }

                // Construct the Public Web Link
                const publicUrl = `${FRONTEND_URL}/propuesta/${quoteObj.id}`;
                cleanText += `\n\n🚀 **Puedes revisar, firmar y descargar tu propuesta oficial aquí:**\n${publicUrl}`;
                finalMsgType = 'text'; // We send the link in the text now
            }
        }

        // 5. Save Message
        const { error: insertError } = await supabase.from('marketing_messages').insert({
            conversation_id: conversationId,
            content: cleanText || "Aquí tienes tu cotización.",
            direction: 'outbound',
            type: finalMsgType,
            status: 'pending',
            metadata: {
                url: finalPdfUrl,
                fileName: finalPdfUrl ? 'Cotizacion.pdf' : null,
                isAiGenerated: true,
                processed_by: 'ai-processor-v2'
            }
        });

        if (insertError) throw insertError;

        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

    } catch (err: any) {
        console.error('FATAL:', err.message);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
});
