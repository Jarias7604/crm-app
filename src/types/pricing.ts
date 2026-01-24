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
