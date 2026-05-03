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
    incluir_implementacion: boolean;

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

    // Términos de Pago
    tipo_pago?: 'contado' | 'credito' | 'anual' | 'mensual';
    plazo_meses?: number;
    cuotas?: number;
    monto_anticipo?: number;
    subtotal_anticipo?: number;
    iva_anticipo?: number;
    descripcion_pago?: string;

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

export interface PlanCRM {
    nombre: string;
    min_contactos: number;
    max_contactos: number;
    costo_anual: number;
    costo_mensual: number;
    implementacion: number;
    caracteristicas: string[];
}

export const PLANES_CRM: PlanCRM[] = [
    {
        nombre: 'BASIC',
        min_contactos: 0,
        max_contactos: 500,
        costo_anual: 600,
        costo_mensual: 60,
        implementacion: 50,
        caracteristicas: [
            'Hasta 500 Contactos',
            'Gestión de Leads Básica',
            'Portal del Cliente',
            'Soporte por Email'
        ]
    },
    {
        nombre: 'STARTER',
        min_contactos: 501,
        max_contactos: 3000,
        costo_anual: 1200,
        costo_mensual: 120,
        implementacion: 100,
        caracteristicas: [
            'Hasta 3,000 Contactos',
            'Gestión de Embudo Comercial',
            'Portal del Cliente',
            'Soporte Prioritario',
            'Reportes Básicos'
        ]
    },
    {
        nombre: 'PRO',
        min_contactos: 3001,
        max_contactos: 10000,
        costo_anual: 2400,
        costo_mensual: 240,
        implementacion: 200,
        caracteristicas: [
            'Hasta 10,000 Contactos',
            'Automatización de Marketing',
            'Portal del Cliente',
            'Soporte 24/7',
            'Reportes Avanzados',
            'API de Integración'
        ]
    },
    {
        nombre: 'ENTERPRISE',
        min_contactos: 10001,
        max_contactos: 999999,
        costo_anual: 4800,
        costo_mensual: 480,
        implementacion: 500,
        caracteristicas: [
            'Contactos Ilimitados',
            'Agentes IA Multicanal',
            'Múltiples Equipos',
            'Soporte Dedicado',
            'Reportes Personalizados',
            'API Completa'
        ]
    }
];

export const MODULOS_DISPONIBLES: ModuloAdicional[] = [
    {
        nombre: 'Cotizador Avanzado',
        descripcion: 'Motor de cálculo para proyectos complejos',
        costo_anual: 360,
        costo_mensual: 36
    },
    {
        nombre: 'Agente IA',
        descripcion: 'Asistente virtual 24/7 para atención a leads',
        costo_anual: 600,
        costo_mensual: 60
    },
    {
        nombre: 'Marketing Multicanal',
        descripcion: 'Campañas automatizadas por Email y SMS',
        costo_anual: 480,
        costo_mensual: 48
    }
];

export const SERVICIOS_ADICIONALES = {
    whatsapp: {
        nombre: 'Notificaciones WhatsApp',
        descripcion: 'Envío automático de mensajes y cotizaciones por WhatsApp',
        costo_por_contacto: 0.025
    },
    personalizacion: {
        nombre: 'Personalización de Marca',
        descripcion: 'Logo y colores personalizados en portal y documentos',
        costo_unico: 150
    }
};
