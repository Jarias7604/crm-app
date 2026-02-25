export interface PricingItem {
    id: string;
    company_id: string | null;
    tipo: 'plan' | 'modulo' | 'servicio' | 'implementacion';
    nombre: string;
    descripcion?: string;
    codigo?: string;
    precio_anual: number;
    precio_mensual: number;
    costo_unico: number;
    min_dtes?: number;
    max_dtes?: number;
    precio_por_dte: number;
    precio_base_dte?: number;
    activo: boolean;
    predeterminado: boolean;
    orden: number;
    formula_calculo?: 'fijo' | 'por_dte' | 'por_cantidad' | 'personalizado';
    margen_ganancia?: number;
    mostrar_en_wizard?: boolean;
    grupo?: string;
    metadata: {
        caracteristicas?: string[];
        icono?: string;
        calculo?: 'fijo' | 'por_dte' | 'por_unidad';
        formula_calculo?: 'fijo' | 'por_dte' | 'por_cantidad' | 'personalizado';
        precio_base_dte?: number;
        margen_ganancia?: number;
        [key: string]: any;
    };
    created_at: string;
    updated_at: string;
}

export interface PricingConfig {
    planes: PricingItem[];
    modulos: PricingItem[];
    servicios: PricingItem[];
    implementacion: PricingItem[];
}

export interface CotizacionItem {
    pricing_item_id: string;
    nombre: string;
    cantidad: number;
    precio_unitario: number;
    precio_total: number;
    tipo: string;
    editable: boolean;
}

export interface PaymentSettings {
    id: string;
    company_id: string | null;
    iva_defecto: number;
    descuento_pago_unico_defecto: number;
    recargo_financiamiento_base: number;
    nota_mejor_precio: string;
    show_financing_breakdown: boolean;
    created_at: string;
    updated_at: string;
}

export interface FinancingPlan {
    id: string;
    company_id: string | null;
    titulo: string;
    meses: number;
    // V3: Nuevo campo para definir cantidad de pagos (Si es null, usamos 'meses' por defecto)
    cuotas?: number;
    // V2: Nuevo campo para tipo de ajuste explícito
    tipo_ajuste?: 'discount' | 'recharge' | 'none';
    interes_porcentaje: number;
    descripcion: string;
    es_popular: boolean;
    activo: boolean;
    orden: number;
    show_breakdown: boolean;
    created_at: string;
    updated_at: string;
}
