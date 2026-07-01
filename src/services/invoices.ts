import { supabase } from './supabase';

export interface InvoiceItem {
    tag_number?: string;
    item_detail: string;
    stock_number?: string;
    amount: number;
}

export interface Invoice {
    id?: string;
    company_id: string;
    cotizacion_id?: string | null;
    numero_factura: string;
    workorder?: string;
    status: 'draft' | 'unpaid' | 'paid' | 'void' | 'refunded';
    
    // Client / Billing Info
    nombre_cliente: string;
    empresa_cliente?: string;
    email_cliente?: string;
    telefono_cliente?: string;
    
    // Billing Address (Bill To)
    bill_to_name?: string;
    bill_to_account?: string;
    bill_to_company?: string;
    bill_to_address?: string;
    
    // Shipping Address (Ship To)
    ship_to_name?: string;
    ship_to_company?: string;
    ship_to_address?: string;
    
    // Order/Shipping Info
    date_ordered?: string;
    date_shipped?: string;
    due_date?: string;
    buyer_dept?: string;
    customer_po?: string;
    dismantler?: string;
    core?: number;
    ro_number?: string;
    truck?: string;
    salesperson?: string;
    
    // Items
    items: InvoiceItem[];
    
    // Financials
    subtotal: number;
    iva: number;
    fuel_charge?: number;
    total: number;
    
    notas?: string;
    created_at?: string;
    updated_at?: string;
}

class InvoicesService {
    async getInvoices(companyId: string) {
        const { data, error } = await supabase
            .from('facturas')
            .select('*')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Invoice[];
    }

    async getInvoice(id: string) {
        const { data, error } = await supabase
            .from('facturas')
            .select(`
                *,
                company:companies(id, name, logo_url, website, address, phone, industry)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    }

    async createInvoice(invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>) {
        const { data, error } = await supabase
            .from('facturas')
            .insert(invoice)
            .select()
            .single();

        if (error) throw error;
        return data as Invoice;
    }

    async updateInvoice(id: string, updates: Partial<Invoice>) {
        const { data, error } = await supabase
            .from('facturas')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Invoice;
    }

    async deleteInvoice(id: string) {
        const { error } = await supabase
            .from('facturas')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }

    async convertQuoteToInvoice(quoteId: string, companyId: string) {
        // 1. Fetch Quote
        const { data: quote, error: quoteErr } = await supabase
            .from('cotizaciones')
            .select(`
                *,
                lead:leads(id, name, email, company_name, phone)
            `)
            .eq('id', quoteId)
            .single();

        if (quoteErr) throw quoteErr;
        if (!quote) throw new Error('Quote not found');

        // 2. Fetch last invoice number to increment
        const { count, error: countErr } = await supabase
            .from('facturas')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', companyId);
        
        if (countErr) throw countErr;
        const nextNum = 1000 + (count || 0) + 1;
        const numeroFactura = `INV-${nextNum}`;

        // 3. Map items from quote to invoice format
        // Check if there are modulos_adicionales or base plan items
        const itemsList: InvoiceItem[] = [];
        
        // Add base plan item
        if (quote.plan_nombre) {
            itemsList.push({
                item_detail: `Plan: ${quote.plan_nombre} (${quote.volumen_dtes} DTEs/mes) - Pago Anual`,
                amount: Number(quote.costo_plan_anual) || 0
            });
        }

        // Add implementation item if included
        if (quote.incluir_implementacion && Number(quote.costo_implementacion) > 0) {
            itemsList.push({
                item_detail: 'Costo de Implementación y Setup Inicial',
                amount: Number(quote.costo_implementacion) || 0
            });
        }

        // Add additional modules
        let parsedModules = [];
        try {
            parsedModules = typeof quote.modulos_adicionales === 'string'
                ? JSON.parse(quote.modulos_adicionales)
                : (quote.modulos_adicionales || []);
        } catch (e) {
            console.error('Error parsing quote modules:', e);
        }

        if (Array.isArray(parsedModules)) {
            parsedModules.forEach((m: any) => {
                itemsList.push({
                    item_detail: `Módulo Adicional: ${m.nombre || m.item_detail || 'Módulo'}`,
                    amount: Number(m.costo_anual || m.amount) || 0
                });
            });
        }

        // Add WhatsApp service
        if (quote.servicio_whatsapp) {
            itemsList.push({
                item_detail: 'Servicio de WhatsApp Business API (volumen estimado)',
                amount: Number(quote.volumen_dtes * 0.025) || 0
            });
        }

        // Add customization service
        if (quote.servicio_personalizacion) {
            itemsList.push({
                item_detail: 'Servicio de Personalización de Plantillas DTE',
                amount: 150.00
            });
        }

        // 4. Populate invoice structure
        const invoiceData: Omit<Invoice, 'id' | 'created_at' | 'updated_at'> = {
            company_id: companyId,
            cotizacion_id: quoteId,
            numero_factura: numeroFactura,
            status: 'unpaid',
            nombre_cliente: quote.lead?.name || 'Cliente sin nombre',
            empresa_cliente: quote.lead?.company_name || quote.nombre_cliente || '',
            email_cliente: quote.lead?.email || '',
            telefono_cliente: quote.lead?.phone || '',
            
            // Default Bill To
            bill_to_name: quote.lead?.name || '',
            bill_to_company: quote.lead?.company_name || quote.nombre_cliente || '',
            
            items: itemsList,
            subtotal: Number(quote.subtotal_anual) || 0,
            iva: Number(quote.iva_monto) || 0,
            total: Number(quote.total_anual) || 0,
            notas: quote.notas || 'Generado automáticamente a partir de Cotización aceptada.'
        };

        // 5. Create Invoice
        return this.createInvoice(invoiceData);
    }
}

export const invoicesService = new InvoicesService();
