export interface Cotizacion {
    id: string;
    company_id: string;
    lead_id: string | null;

    // Cliente
    nombre_cliente: string;
    empresa_cliente?: string;
    email_cliente?: string;
    telefono_cliente?: string;
    direccion_cliente?: string;

    // Plan
    volumen_dtes: number;
    plan_nombre: string;
    costo_plan_anual: number;
    costo_plan_mensual: number;
    costo_implementacion: number;

    // Módulos y Servicios
    modulos_adicionales: ModuloAdicional[];
    servicio_whatsapp: boolean;
    costo_whatsapp: number;
    servicio_personalizacion: boolean;
    costo_personalizacion: number;

    // Totales
    subtotal_anual: number;
    subtotal_mensual: number;
    descuento_porcentaje: number;
    descuento_monto: number;
    iva_porcentaje: number;
    iva_monto: number;
    total_anual: number;
    total_mensual: number;

    // Estado
    estado: 'borrador' | 'enviada' | 'aceptada' | 'rechazada' | 'expirada';
    valida_hasta?: string;
    notas?: string;

    created_by?: string;
    created_at: string;
    updated_at: string;
}

export interface ModuloAdicional {
    nombre: string;
    descripcion?: string;
    costo_anual: number;
    costo_mensual: number;
}

export interface PlanFacturacion {
    nombre: string;
    min_dtes: number;
    max_dtes: number;
    costo_anual: number;
    costo_mensual: number;
    implementacion: number;
    caracteristicas: string[];
}

export const PLANES_FACTURACION: PlanFacturacion[] = [
    {
        nombre: 'BASIC',
        min_dtes: 0,
        max_dtes: 500,
        costo_anual: 600,
        costo_mensual: 60,
        implementacion: 50,
        caracteristicas: [
            'Hasta 500 DTEs/año',
            'Emisión de Facturas y CCF',
            'Portal del Cliente',
            'Soporte por Email'
        ]
    },
    {
        nombre: 'STARTER',
        min_dtes: 501,
        max_dtes: 3000,
        costo_anual: 1200,
        costo_mensual: 120,
        implementacion: 100,
        caracteristicas: [
            'Hasta 3,000 DTEs/año',
            'Todos los documentos DTE',
            'Portal del Cliente',
            'Soporte Prioritario',
            'Reportes Básicos'
        ]
    },
    {
        nombre: 'PRO',
        min_dtes: 3001,
        max_dtes: 10000,
        costo_anual: 2400,
        costo_mensual: 240,
        implementacion: 200,
        caracteristicas: [
            'Hasta 10,000 DTEs/año',
            'Todos los documentos DTE',
            'Portal del Cliente',
            'Soporte 24/7',
            'Reportes Avanzados',
            'API de Integración'
        ]
    },
    {
        nombre: 'ENTERPRISE',
        min_dtes: 10001,
        max_dtes: 999999,
        costo_anual: 4800,
        costo_mensual: 480,
        implementacion: 500,
        caracteristicas: [
            'DTEs Ilimitados',
            'Todos los documentos DTE',
            'Múltiples Sucursales',
            'Soporte Dedicado',
            'Reportes Personalizados',
            'API Completa',
            'Integración ERP'
        ]
    }
];

export const MODULOS_DISPONIBLES: ModuloAdicional[] = [
    {
        nombre: 'POS',
        descripcion: 'Punto de Venta Integrado',
        costo_anual: 360,
        costo_mensual: 36
    },
    {
        nombre: 'Compras',
        descripcion: 'Módulo de Gestión de Compras',
        costo_anual: 300,
        costo_mensual: 30
    },
    {
        nombre: 'Inventario',
        descripcion: 'Control de Inventario Avanzado',
        costo_anual: 240,
        costo_mensual: 24
    },
    {
        nombre: 'Contabilidad',
        descripcion: 'Módulo Contable Integrado',
        costo_anual: 480,
        costo_mensual: 48
    },
    {
        nombre: 'Nómina',
        descripcion: 'Gestión de Planilla y RRHH',
        costo_anual: 600,
        costo_mensual: 60
    }
];

export const SERVICIOS_ADICIONALES = {
    whatsapp: {
        nombre: 'Notificaciones WhatsApp',
        descripcion: 'Envío automático de DTE por WhatsApp',
        costo_por_dte: 0.025
    },
    personalizacion: {
        nombre: 'Personalización de Marca',
        descripcion: 'Logo y colores personalizados en documentos',
        costo_unico: 150
    }
};
