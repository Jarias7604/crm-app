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

  const [{ cotizadorService }, { calculateQuoteFinancialsV2 }, { generateContractDefaults }] = await Promise.all([
    import(pathToFileURL(cotizadorOut).href),
    import(pathToFileURL(quoteUtilsOut).href),
    import(pathToFileURL(contractDefaultsOut).href),
  ]);

  return { cotizadorService, calculateQuoteFinancialsV2, generateContractDefaults };
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
