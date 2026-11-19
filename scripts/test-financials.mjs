import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const esbuild = require('esbuild');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-financial-tests-'));

async function loadModules() {
  const cotizadorOut = path.join(tmpDir, 'cotizador.mjs');
  const quoteUtilsOut = path.join(tmpDir, 'quoteUtils.mjs');
  const contractDefaultsOut = path.join(tmpDir, 'contractDefaults.mjs');

  await esbuild.build({
    entryPoints: [path.resolve('src/services/cotizador.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: cotizadorOut,
    plugins: [
      {
        name: 'mock-supabase-and-simguard',
        setup(build) {
          build.onResolve({ filter: /^\.\/supabase$/ }, () => ({ path: 'mock-supabase', namespace: 'mock' }));
          build.onResolve({ filter: /^\.\/simGuard$/ }, () => ({ path: 'mock-simguard', namespace: 'mock' }));
          build.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({
            contents: 'export const supabase = {}; export const simGuard = (q) => q;',
            loader: 'js',
          }));
        },
      },
    ],
  });

  await esbuild.build({
    entryPoints: [path.resolve('src/utils/quoteUtils.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: quoteUtilsOut,
  });

  await esbuild.build({
    entryPoints: [path.resolve('src/utils/contractDefaults.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: contractDefaultsOut,
  });

  const [{ cotizadorService }, { calculateQuoteFinancialsV2, getModulePlanPricing }, { generateContractDefaults }] = await Promise.all([
    import(pathToFileURL(cotizadorOut).href),
    import(pathToFileURL(quoteUtilsOut).href),
    import(pathToFileURL(contractDefaultsOut).href),
  ]);

  return { cotizadorService, calculateQuoteFinancialsV2, getModulePlanPricing, generateContractDefaults };
}

function assertClose(actual, expected, label) {
  assert.ok(
    Math.abs(actual - expected) <= 0.011,
    `${label}: expected ${expected}, got ${actual}`,
  );
}

const ilimitadoPkg = (impl = 100, origImpl = 100) => ({
  id: 'pkg-ilimitado',
  company_id: 'comp-1',
  paquete: 'ILIMITADO',
  cantidad_dtes: 20000,
  costo_implementacion: impl,
  _orig_costo_implementacion: origImpl,
  costo_paquete_anual: 650,
  costo_paquete_mensual: 0,
  activo: true,
  orden: 1,
  metadata: null,
  created_at: '',
  updated_at: '',
});

const emptyPkg = () => ({
  id: '__items_only__',
  company_id: 'comp-1',
  paquete: 'Propuesta Personalizada',
  cantidad_dtes: 0,
  costo_implementacion: 0,
  _orig_costo_implementacion: 0,
  costo_paquete_anual: 0,
  costo_paquete_mensual: 0,
  activo: true,
  orden: 0,
  metadata: null,
  created_at: '',
  updated_at: '',
});

const contabilidadItem = (setupVal = 150, annualVal = 200) => ({
  id: 'mod-contabilidad',
  company_id: 'comp-1',
  tipo: 'modulo',
  nombre: 'Contabilidad',
  pago_unico: setupVal,
  _orig_pago_unico: 150,
  precio_anual: annualVal,
  precio_mensual: 0,
  precio_por_dte: 0,
  incluye_en_paquete: false,
  activo: true,
  orden: 1,
  modelo_precio: 'suscripcion_anual',
  unidad: 'und',
  cantidad_default: 1,
  metadata: null,
  created_at: '',
  updated_at: '',
});

const sucursalItem = () => ({
  id: 'mod-sucursal',
  company_id: 'comp-1',
  tipo: 'modulo',
  nombre: 'Sucursal Adicional',
  pago_unico: 0,
  precio_anual: 150,
  precio_mensual: 0,
  precio_por_dte: 0,
  incluye_en_paquete: false,
  activo: true,
  orden: 2,
  modelo_precio: 'suscripcion_anual',
  unidad: 'und',
  cantidad_default: 1,
  metadata: null,
  created_at: '',
  updated_at: '',
});

const oneTimeOnlyItem = () => ({
  id: 'srv-unico',
  company_id: 'comp-1',
  tipo: 'servicio',
  nombre: 'Capacitación Presencial',
  pago_unico: 250,
  precio_anual: 0,
  precio_mensual: 0,
  precio_por_dte: 0,
  incluye_en_paquete: false,
  activo: true,
  orden: 3,
  modelo_precio: 'precio_fijo',
  unidad: 'und',
  cantidad_default: 1,
  metadata: null,
  created_at: '',
  updated_at: '',
});

const plan1Pago = { titulo: '1 Solo Pago', cuotas: 1, meses: 12, interes_porcentaje: 0, tipo_ajuste: 'none' };
const plan1PagoDesc10 = { titulo: '1 Solo Pago -10%', cuotas: 1, meses: 12, interes_porcentaje: 10, tipo_ajuste: 'discount' };
const plan3Meses = { titulo: '3 Meses', cuotas: 3, meses: 3, interes_porcentaje: 5, tipo_ajuste: 'recharge' };
const plan6Meses = { titulo: '6 Meses', cuotas: 6, meses: 6, interes_porcentaje: 10, tipo_ajuste: 'recharge' };
const plan12Meses = { titulo: '12 Meses', cuotas: 12, meses: 12, interes_porcentaje: 20, tipo_ajuste: 'recharge' };

let loaded;
test.before(async () => {
  loaded = await loadModules();
});

test.after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('1. Caso exacto reportado: híbrido Contabilidad + Sucursal + Ilimitado en 1 Pago y 12 Meses', () => {
  const { cotizadorService, calculateQuoteFinancialsV2 } = loaded;
  const pkg = ilimitadoPkg(100);
  const items = [contabilidadItem(100, 200), sucursalItem()];

  const res1Pago = cotizadorService.calcularCotizacion(pkg, items, 20000, {
    forma_pago: 'anual',
    meses: 12,
    cuotas: 1,
    tipo_ajuste: 'none',
    tasa_ajuste: 0,
    descuento_manual: 0,
    iva_porcentaje: 13,
    incluir_implementacion: true,
  });

  assertClose(res1Pago.subtotal_pagos_unicos, 200, 'Pago inicial subtotal');
  assertClose(res1Pago.iva_pagos_unicos, 26, 'Pago inicial IVA');
  assertClose(res1Pago.total_pagos_unicos, 226, 'Pago inicial total');
  assertClose(res1Pago.subtotal_recurrente_base, 1000, 'Recurrente base');
  assertClose(res1Pago.iva_monto_recurrente, 130, '1 Solo Pago IVA');
  assertClose(res1Pago.total_recurrente, 1130, '1 Solo Pago Total');

  const recSum = res1Pago.desglose.filter((d) => !d.es_pago_unico).reduce((s, d) => s + d.precio_anual, 0);
  assertClose(recSum, res1Pago.subtotal_recurrente_base, 'Suma de líneas recurrentes');

  const res12 = cotizadorService.calcularCotizacion(pkg, items, 20000, {
    forma_pago: 'mensual',
    meses: 12,
    cuotas: 12,
    tipo_ajuste: 'recharge',
    tasa_ajuste: 20,
    descuento_manual: 0,
    iva_porcentaje: 13,
    incluir_implementacion: true,
  });

  assertClose(res12.subtotal_recurrente_base, 1000, '12M base');
  assertClose(res12.recargo_mensual_monto, 200, '12M financiamiento 20%');
  assertClose(res12.iva_monto_recurrente, 156, '12M IVA');
  assertClose(res12.total_recurrente, 1356, '12M Total');
  assertClose(res12.cuota_mensual, 113, '12M Cuota');

  const savedQuote = {
    costo_plan_anual: 650,
    costo_implementacion: 100,
    incluir_implementacion: true,
    modulos_adicionales: [
      { id: 'mod-contabilidad', nombre: 'Contabilidad', pago_unico: 100, costo_anual: 200 },
      { id: 'mod-sucursal', nombre: 'Sucursal Adicional', pago_unico: 0, costo_anual: 150 },
    ],
    iva_porcentaje: 13,
    descuento_porcentaje: 0,
  };

  const v2_1 = calculateQuoteFinancialsV2({ ...savedQuote, cuotas: 1 }, plan1Pago);
  assertClose(v2_1.totalImplementacion, res1Pago.total_pagos_unicos, 'V2 vs Pro Pago Inicial');
  assertClose(v2_1.totalLicencia, res1Pago.total_recurrente, 'V2 vs Pro 1 Solo Pago');

  const v2_12 = calculateQuoteFinancialsV2({ ...savedQuote, cuotas: 12 }, plan12Meses);
  assertClose(v2_12.totalLicencia, res12.total_recurrente, 'V2 vs Pro 12 Meses');
  assertClose(v2_12.cuotaMensual, res12.cuota_mensual, 'V2 vs Pro Cuota');
});

test('2. Setups independientes ($100 + $150 = $282.50) y setup exonerado ($0 manteniendo editable)', () => {
  const { cotizadorService } = loaded;
  const pkg = ilimitadoPkg(100);
  const resUntouched = cotizadorService.calcularCotizacion(pkg, [contabilidadItem(150, 200), sucursalItem()], 20000, {
    forma_pago: 'anual', meses: 12, cuotas: 1, tipo_ajuste: 'none', tasa_ajuste: 0, descuento_manual: 0, iva_porcentaje: 13, incluir_implementacion: true,
  });
  assertClose(resUntouched.total_pagos_unicos, 282.5, 'Setup 100+150');

  const resWaived = cotizadorService.calcularCotizacion(pkg, [contabilidadItem(0, 200), sucursalItem()], 20000, {
    forma_pago: 'anual', meses: 12, cuotas: 1, tipo_ajuste: 'none', tasa_ajuste: 0, descuento_manual: 0, iva_porcentaje: 13, incluir_implementacion: true,
  });
  assertClose(resWaived.total_pagos_unicos, 113, 'Setup solo paquete $100 + IVA = $113');
  const waivedSetupLine = resWaived.desglose.find((d) => d.es_setup_hibrido && d.item_id === 'mod-contabilidad');
  assert.ok(waivedSetupLine, 'La línea editable del setup exonerado debe seguir presente en desglose');
  assert.equal(waivedSetupLine.precio_anual, 0);
});

test('3. Ítem híbrido SIN paquete base no duplica implementación', () => {
  const { cotizadorService, calculateQuoteFinancialsV2 } = loaded;
  const res = cotizadorService.calcularCotizacion(emptyPkg(), [contabilidadItem(150, 200)], 0, {
    forma_pago: 'anual', meses: 12, cuotas: 1, tipo_ajuste: 'none', tasa_ajuste: 0, descuento_manual: 0, iva_porcentaje: 13, incluir_implementacion: true,
  });
  assertClose(res.total_pagos_unicos, 169.5, 'Setup único $150 + IVA');
  assertClose(res.total_recurrente, 226, 'Anualidad $200 + IVA');

  const v2 = calculateQuoteFinancialsV2(
    {
      costo_plan_anual: 0,
      costo_implementacion: 0,
      incluir_implementacion: true,
      modulos_adicionales: [{ id: 'mod-contabilidad', nombre: 'Contabilidad', pago_unico: 150, costo_anual: 200 }],
      iva_porcentaje: 13,
      descuento_porcentaje: 0,
      cuotas: 1,
    },
    plan1Pago,
  );
  assertClose(v2.totalImplementacion, 169.5, 'V2 Pago Inicial sin duplicar');
  assertClose(v2.totalLicencia, 226, 'V2 Recurrente');
});

test('4. Financiamiento 12 Meses (20%) + Descuento manual (10%) coinciden al centavo', () => {
  const { cotizadorService, calculateQuoteFinancialsV2 } = loaded;
  const pkg = ilimitadoPkg(100);
  const items = [contabilidadItem(100, 200), sucursalItem()];
  const res = cotizadorService.calcularCotizacion(pkg, items, 20000, {
    forma_pago: 'mensual', meses: 12, cuotas: 12, tipo_ajuste: 'recharge', tasa_ajuste: 20, descuento_manual: 10, iva_porcentaje: 13, incluir_implementacion: true,
  });
  assertClose(res.recargo_mensual_monto, 200, 'Recargo');
  assertClose(res.descuento_manual_monto, 120, 'Descuento manual 10% sobre 1200');
  assertClose(res.iva_monto_recurrente, 140.4, 'IVA');
  assertClose(res.total_recurrente, 1220.4, 'Total');
  assertClose(res.cuota_mensual, 101.7, 'Cuota');

  const v2 = calculateQuoteFinancialsV2(
    {
      costo_plan_anual: 650,
      costo_implementacion: 100,
      incluir_implementacion: true,
      modulos_adicionales: [
        { id: 'mod-contabilidad', nombre: 'Contabilidad', pago_unico: 100, costo_anual: 200 },
        { id: 'mod-sucursal', nombre: 'Sucursal Adicional', pago_unico: 0, costo_anual: 150 },
      ],
      iva_porcentaje: 13,
      descuento_porcentaje: 10,
      cuotas: 12,
    },
    plan12Meses,
  );
  assertClose(v2.totalLicencia, res.total_recurrente, 'V2 Total');
  assertClose(v2.cuotaMensual, res.cuota_mensual, 'V2 Cuota');
});

test('5. Plan 1 Solo Pago con descuento de plan (10%)', () => {
  const { cotizadorService, calculateQuoteFinancialsV2 } = loaded;
  const pkg = ilimitadoPkg(100);
  const items = [contabilidadItem(100, 200), sucursalItem()];
  const res = cotizadorService.calcularCotizacion(pkg, items, 20000, {
    forma_pago: 'anual', meses: 12, cuotas: 1, tipo_ajuste: 'discount', tasa_ajuste: 10, descuento_manual: 0, iva_porcentaje: 13, incluir_implementacion: true,
  });
  assertClose(res.descuento_monto, 100, 'Descuento plan 10%');
  assertClose(res.iva_monto_recurrente, 117, 'IVA');
  assertClose(res.total_recurrente, 1017, 'Total');

  const v2 = calculateQuoteFinancialsV2(
    {
      costo_plan_anual: 650,
      costo_implementacion: 100,
      incluir_implementacion: true,
      modulos_adicionales: [
        { id: 'mod-contabilidad', nombre: 'Contabilidad', pago_unico: 100, costo_anual: 200 },
        { id: 'mod-sucursal', nombre: 'Sucursal Adicional', pago_unico: 0, costo_anual: 150 },
      ],
      iva_porcentaje: 13,
      descuento_porcentaje: 0,
      cuotas: 1,
    },
    plan1PagoDesc10,
  );
  assertClose(v2.totalLicencia, res.total_recurrente, 'V2 Total con descuento de plan');
});

test('6. Propuesta solo de pago único (sin ítems recurrentes)', () => {
  const { cotizadorService, calculateQuoteFinancialsV2 } = loaded;
  const res = cotizadorService.calcularCotizacion(emptyPkg(), [oneTimeOnlyItem()], 0, {
    forma_pago: 'anual', meses: 1, cuotas: 1, tipo_ajuste: 'none', tasa_ajuste: 0, descuento_manual: 0, iva_porcentaje: 13, incluir_implementacion: true,
  });
  assertClose(res.total_recurrente, 0, 'Recurrente 0');
  assertClose(res.total_pagos_unicos, 282.5, 'Pago único $250 + IVA');

  const v2 = calculateQuoteFinancialsV2(
    {
      costo_plan_anual: 0,
      costo_implementacion: 0,
      incluir_implementacion: true,
      modulos_adicionales: [{ id: 'srv-unico', nombre: 'Capacitación Presencial', pago_unico: 250, costo_anual: 0 }],
      iva_porcentaje: 13,
      descuento_porcentaje: 0,
      cuotas: 1,
    },
    plan1Pago,
  );
  assertClose(v2.totalLicencia, 0, 'V2 Recurrente 0');
  assertClose(v2.totalImplementacion, 282.5, 'V2 Implementacion $282.50');
});

test('7. Modelo con anticipo dinámico (25%) coincide entre ambos motores', () => {
  const { cotizadorService, calculateQuoteFinancialsV2 } = loaded;
  const pkg = ilimitadoPkg(100);
  const items = [contabilidadItem(100, 200), sucursalItem()];
  const res = cotizadorService.calcularCotizacion(pkg, items, 20000, {
    forma_pago: 'mensual',
    meses: 12,
    cuotas: 12,
    tipo_ajuste: 'recharge',
    tasa_ajuste: 20,
    descuento_manual: 0,
    iva_porcentaje: 13,
    incluir_implementacion: true,
    metadata: { porcentaje_anticipo: 25 },
  });

  const v2 = calculateQuoteFinancialsV2(
    {
      costo_plan_anual: 650,
      costo_implementacion: 100,
      incluir_implementacion: true,
      modulos_adicionales: [
        { id: 'mod-contabilidad', nombre: 'Contabilidad', pago_unico: 100, costo_anual: 200 },
        { id: 'mod-sucursal', nombre: 'Sucursal Adicional', pago_unico: 0, costo_anual: 150 },
      ],
      iva_porcentaje: 13,
      descuento_porcentaje: 0,
      cuotas: 12,
      metadata: { porcentaje_anticipo: 25 },
    },
    plan12Meses,
  );

  assertClose(v2.totalImplementacion, res.total_pagos_unicos, 'V2 vs Pro Anticipo 25%');
  assertClose(v2.totalLicencia, res.total_recurrente, 'V2 vs Pro Saldo financiado');
  assertClose(v2.cuotaMensual, res.cuota_mensual, 'V2 vs Pro Cuota financiada');
});

test('8. generateContractDefaults incluye ambos componentes en ítem híbrido y calcula cuota correctamente', () => {
  const { generateContractDefaults } = loaded;
  const contract = generateContractDefaults({
    company: { id: 'comp-1', name: 'Empresa Test' },
    cotizacion: {
      id: 'abcd1234',
      nombre_cliente: 'Cliente Demo',
      plan_nombre: 'ILIMITADO',
      total_anual: 1582,
      monto_anticipo: 226,
      cuotas: 12,
      tipo_pago: 'credito',
      plazo_meses: 12,
      modulos_adicionales: [
        { nombre: 'Contabilidad', pago_unico: 100, costo_anual: 200 },
        { nombre: 'Sucursal Adicional', pago_unico: 0, costo_anual: 150 },
      ],
    },
  });

  const clause1 = contract.clausulas.find((c) => c.numero === 'PRIMERA')?.contenido || '';
  assert.ok(clause1.includes('$200.00 USD/año'), 'Cláusula 1 debe incluir anualidad de Contabilidad ($200.00)');
  assert.ok(clause1.includes('$100.00 USD impl.'), 'Cláusula 1 debe incluir implementación de Contabilidad ($100.00)');
  assertClose(contract.valor_cuota, 113, 'Valor cuota en contrato = (1582 - 226) / 12 = 113');
});

const dualSubscriptionItem = () => ({
  id: 'mod-dual',
  company_id: 'comp-1',
  tipo: 'modulo',
  nombre: 'Contabilidad Pro',
  pago_unico: 100,
  _orig_pago_unico: 100,
  precio_anual: 200,
  precio_mensual: 20,
  precio_mensual_explicito: true,
  es_solo_mensual: false,
  precio_por_dte: 0,
  incluye_en_paquete: false,
  activo: true,
  orden: 1,
  modelo_precio: 'suscripcion_dual',
  unidad: 'und',
  cantidad_default: 1,
  metadata: null,
  created_at: '',
  updated_at: '',
});

const monthlyOnlyItem = () => ({
  id: 'mod-monthly',
  company_id: 'comp-1',
  tipo: 'modulo',
  nombre: 'Soporte Premium Mensual',
  pago_unico: 0,
  precio_anual: 0,
  precio_mensual: 30,
  precio_mensual_explicito: true,
  es_solo_mensual: true,
  precio_por_dte: 0,
  incluye_en_paquete: false,
  activo: true,
  orden: 2,
  modelo_precio: 'suscripcion_mensual',
  unidad: 'und',
  cantidad_default: 1,
  metadata: null,
  created_at: '',
  updated_at: '',
});

test('9. Suscripción Dual ($200/año, $20/mes, $100 setup) respeta los 4 planes de Motor de Precios sin doble recargo', () => {
  const { cotizadorService, calculateQuoteFinancialsV2 } = loaded;
  const dual = dualSubscriptionItem();
  const saved = {
    costo_plan_anual: 0,
    costo_implementacion: 0,
    incluir_implementacion: true,
    modulos_adicionales: [{
      id: dual.id,
      nombre: dual.nombre,
      pago_unico: 100,
      costo_anual: 200,
      costo_mensual: 20,
      precio_mensual_explicito: true,
      es_solo_mensual: false,
    }],
    iva_porcentaje: 13,
    descuento_porcentaje: 0,
  };

  // 1 Solo Pago (0%)
  const r1 = cotizadorService.calcularCotizacion(emptyPkg(), [dual], 0, {
    forma_pago: 'anual', meses: 12, cuotas: 1, tipo_ajuste: 'none', tasa_ajuste: 0, descuento_manual: 0, iva_porcentaje: 13, incluir_implementacion: true,
  });
  assertClose(r1.total_pagos_unicos, 113, '1P Pago Inicial');
  assertClose(r1.subtotal_recurrente_base, 200, '1P Base anual');
  assertClose(r1.total_recurrente, 226, '1P Total anual + IVA');
  const v1 = calculateQuoteFinancialsV2({ ...saved, cuotas: 1 }, plan1Pago);
  assertClose(v1.totalImplementacion, 113, 'V2 1P Inicial');
  assertClose(v1.totalLicencia, 226, 'V2 1P Total');

  // 3 Meses (+5% sobre anual $200 = $210 + IVA = $237.30)
  const r3 = cotizadorService.calcularCotizacion(emptyPkg(), [dual], 0, {
    forma_pago: 'mensual', meses: 3, cuotas: 3, tipo_ajuste: 'recharge', tasa_ajuste: 5, descuento_manual: 0, iva_porcentaje: 13, incluir_implementacion: true,
  });
  assertClose(r3.recargo_mensual_monto, 10, '3M Financiamiento 5%');
  assertClose(r3.total_recurrente, 237.3, '3M Total');
  assertClose(r3.cuota_mensual, 79.1, '3M Cuota');
  const v3 = calculateQuoteFinancialsV2({ ...saved, cuotas: 3 }, plan3Meses);
  assertClose(v3.totalLicencia, r3.total_recurrente, 'V2 3M Total');
  assertClose(v3.cuotaMensual, r3.cuota_mensual, 'V2 3M Cuota');

  // 6 Meses (+10% sobre anual $200 = $220 + IVA = $248.60)
  const r6 = cotizadorService.calcularCotizacion(emptyPkg(), [dual], 0, {
    forma_pago: 'mensual', meses: 6, cuotas: 6, tipo_ajuste: 'recharge', tasa_ajuste: 10, descuento_manual: 0, iva_porcentaje: 13, incluir_implementacion: true,
  });
  assertClose(r6.recargo_mensual_monto, 20, '6M Financiamiento 10%');
  assertClose(r6.total_recurrente, 248.6, '6M Total');
  assertClose(r6.cuota_mensual, 41.43, '6M Cuota');
  const v6 = calculateQuoteFinancialsV2({ ...saved, cuotas: 6 }, plan6Meses);
  assertClose(v6.totalLicencia, r6.total_recurrente, 'V2 6M Total');
  assertClose(v6.cuotaMensual, r6.cuota_mensual, 'V2 6M Cuota');

  // 12 Meses (+20% en plan, pero ítem dual usa $20/mes * 12 = $240 con $0 recargo extra)
  const r12 = cotizadorService.calcularCotizacion(emptyPkg(), [dual], 0, {
    forma_pago: 'mensual', meses: 12, cuotas: 12, tipo_ajuste: 'recharge', tasa_ajuste: 20, descuento_manual: 0, iva_porcentaje: 13, incluir_implementacion: true,
  });
  assertClose(r12.subtotal_recurrente_base, 240, '12M Base mensual directo');
  assertClose(r12.recargo_mensual_monto, 0, '12M Sin doble recargo');
  assertClose(r12.iva_monto_recurrente, 31.2, '12M IVA');
  assertClose(r12.total_recurrente, 271.2, '12M Total');
  assertClose(r12.cuota_mensual, 22.6, '12M Cuota $20 + IVA');
  const v12 = calculateQuoteFinancialsV2({ ...saved, cuotas: 12 }, plan12Meses);
  assertClose(v12.totalLicencia, r12.total_recurrente, 'V2 12M Total');
  assertClose(v12.cuotaMensual, r12.cuota_mensual, 'V2 12M Cuota');
});

test('10. Cotización mixta (Ilimitado $650 + Sucursal $150 + Dual $200/$20m) en 1P, 6M y 12M cuadra al centavo', () => {
  const { cotizadorService, calculateQuoteFinancialsV2, getModulePlanPricing } = loaded;
  const pkg = ilimitadoPkg(100);
  const dual = dualSubscriptionItem();
  const items = [dual, sucursalItem()];
  const saved = {
    costo_plan_anual: 650,
    costo_implementacion: 100,
    incluir_implementacion: true,
    modulos_adicionales: [
      { id: dual.id, nombre: dual.nombre, pago_unico: 100, costo_anual: 200, costo_mensual: 20, precio_mensual_explicito: true, es_solo_mensual: false },
      { id: 'mod-sucursal', nombre: 'Sucursal Adicional', pago_unico: 0, costo_anual: 150, costo_mensual: 0 },
    ],
    iva_porcentaje: 13,
    descuento_porcentaje: 0,
  };

  // 1 Solo Pago -> $1,000 + $130 IVA = $1,130.00
  const r1 = cotizadorService.calcularCotizacion(pkg, items, 20000, {
    forma_pago: 'anual', meses: 12, cuotas: 1, tipo_ajuste: 'none', tasa_ajuste: 0, descuento_manual: 0, iva_porcentaje: 13, incluir_implementacion: true,
  });
  assertClose(r1.total_recurrente, 1130, 'Mixta 1P Total');
  const v1 = calculateQuoteFinancialsV2({ ...saved, cuotas: 1 }, plan1Pago);
  assertClose(v1.totalLicencia, 1130, 'V2 Mixta 1P');

  // 6 Meses (+10%) -> +10% sobre $1,000 = $1,100 + $143 IVA = $1,243.00
  const r6 = cotizadorService.calcularCotizacion(pkg, items, 20000, {
    forma_pago: 'mensual', meses: 6, cuotas: 6, tipo_ajuste: 'recharge', tasa_ajuste: 10, descuento_manual: 0, iva_porcentaje: 13, incluir_implementacion: true,
  });
  assertClose(r6.recargo_mensual_monto, 100, 'Mixta 6M Recargo 10% sobre todo');
  assertClose(r6.total_recurrente, 1243, 'Mixta 6M Total');
  const v6 = calculateQuoteFinancialsV2({ ...saved, cuotas: 6 }, plan6Meses);
  assertClose(v6.totalLicencia, 1243, 'V2 Mixta 6M');

  // 12 Meses (+20%) -> $650 + $150 + $240 = $1,040; +20% SOLO sobre $800 = $160 -> $1,200 + $156 IVA = $1,356.00 ($113/mes)
  const r12 = cotizadorService.calcularCotizacion(pkg, items, 20000, {
    forma_pago: 'mensual', meses: 12, cuotas: 12, tipo_ajuste: 'recharge', tasa_ajuste: 20, descuento_manual: 0, iva_porcentaje: 13, incluir_implementacion: true,
  });
  assertClose(r12.subtotal_recurrente_base, 1040, 'Mixta 12M Base');
  assertClose(r12.recargo_mensual_monto, 160, 'Mixta 12M Recargo 20% SOLO sobre $800');
  assertClose(r12.iva_monto_recurrente, 156, 'Mixta 12M IVA');
  assertClose(r12.total_recurrente, 1356, 'Mixta 12M Total');
  assertClose(r12.cuota_mensual, 113, 'Mixta 12M Cuota');

  const v12 = calculateQuoteFinancialsV2({ ...saved, cuotas: 12 }, plan12Meses);
  assertClose(v12.licenciaAnual, 1040, 'V2 Mixta 12M Base');
  assertClose(v12.recargoMonto, 160, 'V2 Mixta 12M Recargo');
  assertClose(v12.totalLicencia, 1356, 'V2 Mixta 12M Total');
  assertClose(v12.cuotaMensual, 113, 'V2 Mixta 12M Cuota');

  const lineSum12 = 650 + saved.modulos_adicionales.reduce((s, m) => s + getModulePlanPricing(m, 12).amount, 0);
  assertClose(lineSum12 + v12.recargoMonto + v12.ivaLicencia, v12.totalLicencia, 'Suma exacta de líneas en tarjeta 12 Meses');
});

test('11. Suscripción SOLO Mensual ($30/mes, precio_anual = 0) nunca da $0 ni recarga interés extra', () => {
  const { cotizadorService, calculateQuoteFinancialsV2 } = loaded;
  const mon = monthlyOnlyItem();
  const saved = {
    costo_plan_anual: 0,
    costo_implementacion: 0,
    incluir_implementacion: true,
    modulos_adicionales: [{
      id: mon.id,
      nombre: mon.nombre,
      pago_unico: 0,
      costo_anual: 360,
      costo_mensual: 30,
      precio_mensual_explicito: true,
      es_solo_mensual: true,
    }],
    iva_porcentaje: 13,
    descuento_porcentaje: 0,
  };

  for (const [plan, cuotas] of [[plan1Pago, 1], [plan3Meses, 3], [plan6Meses, 6], [plan12Meses, 12]]) {
    const res = cotizadorService.calcularCotizacion(emptyPkg(), [mon], 0, {
      forma_pago: cuotas === 1 ? 'anual' : 'mensual',
      meses: plan.meses,
      cuotas,
      tipo_ajuste: plan.tipo_ajuste,
      tasa_ajuste: plan.interes_porcentaje,
      descuento_manual: 0,
      iva_porcentaje: 13,
      incluir_implementacion: true,
    });
    assertClose(res.total_recurrente, 406.8, `Solo mensual plan ${plan.titulo} = $360 + IVA`);
    assertClose(res.recargo_mensual_monto, 0, `Solo mensual sin interés extra en ${plan.titulo}`);

    const v2 = calculateQuoteFinancialsV2({ ...saved, cuotas }, plan);
    assertClose(v2.totalLicencia, 406.8, `V2 Solo mensual ${plan.titulo}`);
    assertClose(v2.cuotaMensual, res.cuota_mensual, `V2 Cuota ${plan.titulo}`);
  }
});

test('12. Suscripción Dual + descuento manual 10% y generación de contrato coinciden al centavo', () => {
  const { cotizadorService, calculateQuoteFinancialsV2, generateContractDefaults } = loaded;
  const dual = dualSubscriptionItem();
  const r12 = cotizadorService.calcularCotizacion(emptyPkg(), [dual], 0, {
    forma_pago: 'mensual', meses: 12, cuotas: 12, tipo_ajuste: 'recharge', tasa_ajuste: 20, descuento_manual: 10, iva_porcentaje: 13, incluir_implementacion: true,
  });
  // $240 - 10% = $216 + 13% IVA = $244.08 ($20.34/cuota); setup $100 - 10% = $90 + 13% = $101.70
  assertClose(r12.total_recurrente, 244.08, 'Dual 12M con desc 10%');
  assertClose(r12.cuota_mensual, 20.34, 'Dual 12M cuota con desc 10%');
  assertClose(r12.total_pagos_unicos, 101.7, 'Dual Setup con desc 10%');

  const v2 = calculateQuoteFinancialsV2(
    {
      costo_plan_anual: 0,
      costo_implementacion: 0,
      incluir_implementacion: true,
      modulos_adicionales: [{
        id: dual.id,
        nombre: dual.nombre,
        pago_unico: 100,
        costo_anual: 200,
        costo_mensual: 20,
        precio_mensual_explicito: true,
        es_solo_mensual: false,
      }],
      iva_porcentaje: 13,
      descuento_porcentaje: 10,
      cuotas: 12,
    },
    plan12Meses,
  );
  assertClose(v2.totalLicencia, r12.total_recurrente, 'V2 Dual desc 10% Total');
  assertClose(v2.cuotaMensual, r12.cuota_mensual, 'V2 Dual desc 10% Cuota');
  assertClose(v2.totalImplementacion, r12.total_pagos_unicos, 'V2 Dual desc 10% Setup');

  const contract = generateContractDefaults({
    company: { id: 'comp-1', name: 'Empresa Test' },
    cotizacion: {
      id: 'dual9999',
      nombre_cliente: 'Cliente Dual',
      plan_nombre: 'Propuesta Personalizada',
      total_anual: r12.total_general,
      monto_anticipo: r12.total_pagos_unicos,
      cuotas: 12,
      tipo_pago: 'credito',
      plazo_meses: 12,
      modulos_adicionales: [{
        nombre: 'Contabilidad Pro',
        pago_unico: 100,
        costo_anual: 200,
        costo_mensual: 20,
        precio_mensual_explicito: true,
        es_solo_mensual: false,
      }],
    },
  });
  const clause1 = contract.clausulas.find((c) => c.numero === 'PRIMERA')?.contenido || '';
  assert.ok(clause1.includes('$20.00 USD/mes'), 'Contrato en 12 cuotas debe mostrar tarifa mensual $20.00 USD/mes');
  assertClose(contract.valor_cuota, 20.34, 'Cuota contrato dual 12M con desc 10% = $20.34');
});
