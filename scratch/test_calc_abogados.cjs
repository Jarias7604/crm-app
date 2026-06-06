const { calculateQuoteFinancialsV2 } = require('../src/utils/quoteUtils.ts');

// Since it's TS, we can mock or just write a JS version of the quote.
const quote = {
  id: "5006a0af-e643-4f55-bad6-bc683694a1a1",
  company_id: "ee91c9f0-3e3a-44b6-8907-42a4af518f4b",
  lead_id: "52f11cd2-3ade-4100-9d79-fdc9198acde5",
  nombre_cliente: "Jorge Cruz ",
  empresa_cliente: "",
  email_cliente: "",
  plan_nombre: "Cotización Personalizada",
  total_anual: 610.2,
  total_mensual: 0,
  estado: "aceptada",
  telefono_cliente: "",
  volumen_dtes: 0,
  costo_plan_anual: 0,
  costo_plan_mensual: 0,
  costo_implementacion: 0,
  modulos_adicionales: [
    {
      tipo: "servicio",
      nombre: "Poder administrativo",
      pago_unico: 600,
      costo_anual: 0,
      descripcion: "Creamos poder con limitantes para la compra de propiedades con codigo de 10.2",
      costo_mensual: 0
    }
  ],
  servicio_whatsapp: false,
  costo_whatsapp: 0,
  servicio_personalizacion: false,
  costo_personalizacion: 0,
  descuento_porcentaje: -0.2,
  iva_porcentaje: 13,
  plazo_meses: 1,
  metadata: {
    porcentaje_anticipo: 100
  }
};

const plan = {
  titulo: "Membership",
  interes_porcentaje: 10,
  tipo_ajuste: "discount"
};

// Simple JS mock of calculateQuoteFinancialsV2:
// Let's run it by importing the built files or writing a quick evaluator.
console.log("Mock calculation:");
