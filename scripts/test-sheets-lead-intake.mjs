import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const esbuild = require('esbuild');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-sheets-lead-intake-tests-'));

let helpers;
test.before(async () => {
  const outFile = path.join(tmpDir, 'helpers.mjs');
  await esbuild.build({
    entryPoints: [path.resolve('supabase/functions/google-sheets-lead-intake/helpers.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: outFile,
  });
  helpers = await import(pathToFileURL(outFile).href);
});

test.after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('1. Maps real NOVIEMBRE 2026 ERP and SIPLE rows by header name', () => {
  const erpRow = {
    'NOMBRE COMPLETO': 'jose Domingo Méndez',
    'CORREO ELECTRONICO': 'jmendez63512@hotmail.com',
    'TELÉFONO': '50377422064',
    EMPRESA: 'produses S A de CV',
    CARGO: 'Operaciones y logística',
    INDUSTRIA: 'Comercio y tiendas',
    'FACTURAS ANUAL': 'Menos de 500',
    'MÉTODO DE GESTIÓN ACTUAL': 'Manualmente (Excel, papel, etc.)',
    'PUNTO DE MEJORA': 'Inventarios y productos',
    'URGENCIA DE PROJECTO': 'Lo antes posible',
    'CANTIDAD DE PROYECTOS DISPONIBLES': '',
    'FECHA DE INGRESO': '21/11/2026 1:20:56',
    'ANUNCIO DE CONVERSION': 'ERP | Clientes potenciales | audiencia intereses B2B',
  };

  const erpLead = helpers.normalizeSheetRow(erpRow);
  assert.equal(erpLead.name, 'jose Domingo Méndez');
  assert.equal(erpLead.email, 'jmendez63512@hotmail.com');
  assert.equal(erpLead.phoneDisplay, '+50377422064');
  assert.equal(erpLead.phoneMatchKey, '77422064');
  assert.equal(erpLead.companyName, 'produses S A de CV');
  assert.equal(erpLead.priority, 'high');
  assert.equal(erpLead.productLabel, 'ERP');
  assert.equal(erpLead.productId, helpers.PRODUCT_IDS.ERP);
  assert.equal(erpLead.mappedIndustry, 'Tienda/ Abarroteria/Supermercados');

  const sipleRow = {
    'NOMBRE COMPLETO': 'Maria Elena',
    'CORREO ELECTRONICO': 'm_de_ruiz@hotmail.com',
    'TELÉFONO': '50372090859',
    EMPRESA: 'RUESCO INVERSIONES',
    CARGO: 'Gerente general',
    INDUSTRIA: '',
    'FACTURAS ANUAL': '',
    'MÉTODO DE GESTIÓN ACTUAL': 'Manualmente (Excel, papel, etc.)',
    'PUNTO DE MEJORA': '',
    'URGENCIA DE PROJECTO': 'En los próximos 1 a 3 meses',
    'CANTIDAD DE PROYECTOS DISPONIBLES': '1 a 3 proyectos',
    'FECHA DE INGRESO': '5/11/2026 4:33:01',
    'ANUNCIO DE CONVERSION': 'Estatico - Donde consultas los pagos de cada lote',
  };

  const sipleLead = helpers.normalizeSheetRow(sipleRow);
  assert.equal(sipleLead.priority, 'medium');
  assert.equal(sipleLead.productLabel, 'SIPLE');
  assert.equal(sipleLead.productId, helpers.PRODUCT_IDS.SIPLE);
  assert.equal(sipleLead.mappedIndustry, 'Inmobiliarias/Lotificadoras/Administradoras');
});

test('2. Maps OCTUBRE 2026 rows regardless of changed column structure', () => {
  const octRow = {
    'NOMBRE COMPLETO': 'Nehemias Regalo Sandoval',
    'CORREO ELECTRONICO': 'LOGISTICA.ORANGEBLUE@GMAIL.COM',
    'TELÉFONO': '50378093882',
    EMPRESA: 'OBL SA de CV',
    CARGO: 'Contador administrativo',
    INDUSTRIA: 'Servicios profesionales',
    'FACTURAS ANUAL': 'De 500 a 2,000',
    'MÉTODO DE GESTIÓN ACTUAL': 'Con un sistema contratado o arrendado',
    'PUNTO DE MEJORA': 'Contabilidad y finanzas',
    'URGENCIA DE PROJECTO': 'Por ahora solo estoy buscando información',
    'FECHA DE INGRESO': '14/10/2026 21:56:52',
    'ANUNCIO DE CONVERSION': 'Estatico - Toma control de tu negocio',
    'COMENTARIOS SOBRE PROSPECTO': '',
    'CATEGORÍA DE CARGO': 'Contabilidad y Finanzas',
  };

  const lead = helpers.normalizeSheetRow(octRow);
  assert.equal(lead.email, 'logistica.orangeblue@gmail.com');
  assert.equal(lead.priority, 'low');
  assert.equal(lead.productLabel, 'ERP');
  assert.equal(lead.mappedIndustry, 'Despacho contable');
});

test('3. Normalizes SV/foreign phone variants and matches existing contacts without duplicates', () => {
  assert.deepEqual(helpers.normalizePhone('75556666'), {
    display: '+50375556666',
    digits: '75556666',
    matchKey: '75556666',
  });
  assert.deepEqual(helpers.normalizePhone('50372090859'), {
    display: '+50372090859',
    digits: '50372090859',
    matchKey: '72090859',
  });
  assert.deepEqual(helpers.normalizePhone('+503 7911-1687'), {
    display: '+50379111687',
    digits: '50379111687',
    matchKey: '79111687',
  });
  assert.deepEqual(helpers.normalizePhone('4166427631'), {
    display: '4166427631',
    digits: '4166427631',
    matchKey: '66427631',
  });

  // Match by normalized last 8 digits even when DB has 7555-6666 and Sheet has 50375556666
  assert.equal(
    helpers.doesLeadMatchContact(
      { phone: '7555-6666', email: null },
      { phoneMatchKey: '75556666', email: 'other@example.com' },
    ),
    'phone',
  );

  // Fallback match by normalized email when phone differs
  assert.equal(
    helpers.doesLeadMatchContact(
      { phone: '+50370000001', email: 'M_DE_RUIZ@HOTMAIL.COM' },
      { phoneMatchKey: '79999999', email: 'm_de_ruiz@hotmail.com' },
    ),
    'email',
  );

  // Non-match
  assert.equal(
    helpers.doesLeadMatchContact(
      { phone: '+50370000001', email: 'uno@test.com' },
      { phoneMatchKey: '79999999', email: 'dos@test.com' },
    ),
    null,
  );
});

test('4. Detects product ERP vs SIPLE and infers priorities accurately', () => {
  assert.equal(
    helpers.detectInterestedProduct({ adName: 'Carrusel - Todo en un sistema SIPLE - Copy' }).label,
    'SIPLE',
  );
  assert.equal(
    helpers.detectInterestedProduct({ projectsCount: '4 a 6 proyectos' }).label,
    'SIPLE',
  );
  assert.equal(
    helpers.detectInterestedProduct({ adName: 'Estatico ERP - Conoce tu negocio' }).label,
    'ERP',
  );
  assert.equal(helpers.inferLeadPriority('Lo antes posible'), 'high');
  assert.equal(helpers.inferLeadPriority('En los próximos 1 a 3 meses'), 'medium');
  assert.equal(helpers.inferLeadPriority('Por ahora solo estoy buscando información'), 'low');
});

test('5. Maps Sheet industries and business hints to exact General CRM catalog', () => {
  assert.equal(
    helpers.mapSheetIndustryToCrm({
      rawIndustry: 'Comercio y tiendas',
      companyName: 'Farmacia alexander',
    }),
    'Farmacia',
  );
  assert.equal(
    helpers.mapSheetIndustryToCrm({
      rawIndustry: 'Comercio y tiendas',
      companyName: 'calzado Deportivo',
    }),
    'Almacen/Boutique',
  );
  assert.equal(
    helpers.mapSheetIndustryToCrm({
      rawIndustry: 'Distribución y ventas al por mayor',
      companyName: 'Phone center',
    }),
    'Distribuidores/Importadores/Mayoristas',
  );
  assert.equal(
    helpers.mapSheetIndustryToCrm({
      rawIndustry: 'Restaurantes y alimentos',
      companyName: 'Flesch503',
    }),
    'Restaurante/Cafeteria/Bar',
  );
  assert.equal(
    helpers.mapSheetIndustryToCrm({
      rawIndustry: 'Servicios profesionales',
      companyName: 'Impacto print y variedades',
    }),
    'Imprentas',
  );
  assert.equal(
    helpers.mapSheetIndustryToCrm({
      rawIndustry: 'Servicios profesionales',
      companyName: 'Agrolav',
    }),
    'Consultores',
  );
  assert.equal(
    helpers.mapSheetIndustryToCrm({
      rawIndustry: '',
      companyName: 'Fundasantiados: Fundacion Santiaguena de Desarrollo Social.',
      productLabel: 'SIPLE',
    }),
    'Fundaciones/Asociaciones',
  );
});

test('6. Formats structured CRM notes and appends re-entry alerts without losing history', () => {
  const lead = helpers.normalizeSheetRow({
    'NOMBRE COMPLETO': 'Elvita Lopez',
    'TELÉFONO': '50375139810',
    EMPRESA: 'Impacto print y variedades',
    CARGO: 'Gerente',
    INDUSTRIA: 'Servicios profesionales',
    'FACTURAS ANUAL': 'Menos de 500',
    'URGENCIA DE PROJECTO': 'Lo antes posible',
    'ANUNCIO DE CONVERSION': 'ERP | Clientes potenciales',
    'COMENTARIOS SOBRE PROSPECTO': 'Solicita cotización formal',
  });

  const newNotes = helpers.buildNewLeadNotes(lead, { sheetName: 'NOVIEMBRE 2026', rowNumber: 18 });
  assert.ok(newNotes.includes('NOVIEMBRE 2026 · Fila 18'));
  assert.ok(newNotes.includes('Cargo: Gerente'));
  assert.ok(newNotes.includes('Producto detectado: ERP'));
  assert.ok(newNotes.includes('Solicita cotización formal'));

  const reentryNote = helpers.buildReentryNote(lead, {
    sheetName: 'NOVIEMBRE 2026',
    rowNumber: 18,
    now: new Date('2026-11-21T20:00:00Z'),
  });
  assert.ok(reentryNote.includes('Reingreso desde formulario'));
  assert.ok(reentryNote.includes('NOVIEMBRE 2026 fila 18'));

  const combined = helpers.appendNotePreservingExisting('Llamar el lunes a las 9am', reentryNote);
  assert.ok(combined.startsWith('Llamar el lunes a las 9am\n\n♻️ Reingreso desde formulario'));
});

test('7. Generates deterministic row keys, parses sync keys, and formats ESTADO CRM labels', () => {
  const k1 = helpers.buildSheetRowKey({
    sheetName: 'NOVIEMBRE 2026',
    rowNumber: 27,
    phoneMatchKey: '77422064',
    submittedAt: '21/11/2026 1:20:56',
  });
  assert.equal(k1, 'noviembre-2026:r27:77422064:2111202612056');

  assert.deepEqual(helpers.extractSyncKeys({ sheet_sync_keys: [k1, 123, ''] }), [k1]);
  assert.deepEqual(helpers.extractSyncKeys(null), []);

  const fixedDate = new Date('2026-11-21T21:15:00Z');
  const createdCell = helpers.formatSheetStatusCell({ action: 'created', now: fixedDate });
  assert.ok(createdCell.includes('✅ Creado en CRM'));
  assert.ok(createdCell.includes('Sin asignar'));

  const existingCell = helpers.formatSheetStatusCell({
    action: 'existing_noted',
    advisorName: 'Patricia Martínez',
    now: fixedDate,
  });
  assert.ok(existingCell.includes('♻️ Ya existía (asesor: Patricia Martínez)'));
});

test('8. Edge Function google-sheets-lead-intake/index.ts bundles cleanly for Deno', async () => {
  const result = await esbuild.build({
    entryPoints: [path.resolve('supabase/functions/google-sheets-lead-intake/index.ts')],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    external: ['https://*'],
  });

  assert.equal(result.errors.length, 0);
  assert.ok(result.outputFiles.length > 0);
  const code = result.outputFiles[0].text;
  assert.ok(code.includes('SHEETS_SYNC_SECRET'));
  assert.ok(code.includes('normalizeSheetRow'));
  assert.ok(code.includes('raw_meta_payload'));
  assert.ok(code.includes('lead_ai_memory'));
});

test('9. Builds structured AI memory facts for downstream WhatsApp qualification', () => {
  const lead = helpers.normalizeSheetRow({
    'NOMBRE COMPLETO': 'Evany Susana Ortiz Calvo',
    'TELÉFONO': '50378889900',
    EMPRESA: 'Susana Calvo Salón',
    CARGO: 'Propietaria',
    'FACTURAS ANUAL': 'De 500 a 2,000',
    'MÉTODO DE GESTIÓN ACTUAL': 'Manualmente (Excel, papel, etc.)',
    'PUNTO DE MEJORA': 'Inventarios y productos',
    'URGENCIA DE PROJECTO': 'Lo antes posible',
    'ANUNCIO DE CONVERSION': 'ERP | Clientes potenciales',
  });

  const facts = helpers.buildAiMemoryFacts(lead, {
    sheetName: 'NOVIEMBRE 2026',
    rowNumber: 29,
    syncedAt: '2026-11-22T20:00:00Z',
  });

  assert.equal(facts.cargo, 'Propietaria');
  assert.equal(facts.facturas_anual, 'De 500 a 2,000');
  assert.equal(facts.punto_de_mejora, 'Inventarios y productos');
  assert.equal(facts.urgencia, 'Lo antes posible');
  assert.equal(facts.prioridad_urgencia, 'high');
  assert.equal(facts.producto_interes, 'ERP');
  assert.equal(facts.sheet_origen, 'NOVIEMBRE 2026');
  assert.equal(facts.fila_origen, 29);
  assert.ok(facts.raw_form_fields && facts.raw_form_fields.CARGO === 'Propietaria');
});
