import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const esbuild = require('esbuild');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-lead-intake-profile-tests-'));

let mod;
test.before(async () => {
  const outFile = path.join(tmpDir, 'leadIntakeProfile.mjs');
  await esbuild.build({
    entryPoints: [path.resolve('src/utils/leadIntakeProfile.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: outFile,
  });
  mod = await import(pathToFileURL(outFile).href);
});

test.after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('1. Extracts structured intake profile from raw_meta_payload.fields (real Evany-style row)', () => {
  const lead = {
    id: 'lead-1',
    created_at: '2026-11-22T15:00:00Z',
    meta_campaign_name: 'ERP | Clientes potenciales | audiencia intereses B2B',
    raw_meta_payload: {
      source: 'google_sheets',
      sheet_name: 'NOVIEMBRE 2026',
      row_number: 29,
      synced_at: '2026-11-22T15:05:00Z',
      fields: {
        'NOMBRE COMPLETO': 'Evany Susana Ortiz Calvo',
        'CORREO ELECTRONICO': 'evany@salon.com',
        'TELÉFONO': '50378889900',
        EMPRESA: 'Susana Calvo Salón',
        CARGO: 'Propietaria',
        INDUSTRIA: 'Servicios',
        'FACTURAS ANUAL': 'De 500 a 2,000',
        'MÉTODO DE GESTIÓN ACTUAL': 'Manualmente (Excel, papel, etc.)',
        'PUNTO DE MEJORA': 'Inventarios y productos',
        'URGENCIA DE PROJECTO': 'Lo antes posible',
        'ANUNCIO DE CONVERSION': 'ERP | Clientes potenciales | audiencia intereses B2B',
      },
    },
  };

  const profile = mod.extractLeadIntakeProfile(lead);
  assert.equal(profile.hasData, true);
  assert.equal(profile.sourceSheetName, 'NOVIEMBRE 2026');
  assert.equal(profile.sourceRowNumber, 29);
  assert.equal(profile.urgencyLevel, 'high');
  assert.equal(profile.values.cargo, 'Propietaria');
  assert.equal(profile.values.facturas_anual, 'De 500 a 2,000');
  assert.equal(profile.values.metodo_actual, 'Manualmente (Excel, papel, etc.)');
  assert.equal(profile.values.punto_de_mejora, 'Inventarios y productos');
  assert.equal(profile.values.urgencia, 'Lo antes posible');
  assert.equal(mod.getLeadIntakeFieldValue(lead, 'punto_de_mejora'), 'Inventarios y productos');
});

test('2. Falls back cleanly to next_action_notes for older leads without raw_meta_payload.fields', () => {
  const legacyLead = {
    id: 'lead-legacy',
    created_at: '2026-11-21T20:00:00Z',
    next_action_notes: [
      '📋 Prospecto ingresado automáticamente desde Google Sheets (NOVIEMBRE 2026 · Fila 26)',
      '• Cargo: Operaciones y logística',
      '• Producto detectado: ERP',
      '• Industria: Comercio y tiendas (CRM: Tienda/ Abarroteria/Supermercados)',
      '• Facturas anuales: Menos de 500',
      '• Gestión actual: Manualmente (Excel, papel, etc.)',
      '• Punto de mejora: Inventarios y productos',
      '• Urgencia: Lo antes posible',
      '• Anuncio: ERP | Clientes potenciales',
    ].join('\n'),
    raw_meta_payload: null,
  };

  const profile = mod.extractLeadIntakeProfile(legacyLead);
  assert.equal(profile.hasData, true);
  assert.equal(profile.sourceSheetName, 'NOVIEMBRE 2026');
  assert.equal(profile.sourceRowNumber, 26);
  assert.equal(profile.urgencyLevel, 'high');
  assert.equal(profile.values.cargo, 'Operaciones y logística');
  assert.equal(profile.values.facturas_anual, 'Menos de 500');
  assert.equal(profile.values.punto_de_mejora, 'Inventarios y productos');
  assert.equal(mod.isAutoSheetIntakeNote(legacyLead.next_action_notes), true);
  assert.equal(mod.isAutoSheetIntakeNote('Cliente pidió llamar mañana a las 10am'), false);
});

test('3. Dynamically discovers brand-new Excel columns for multi-tenant SaaS field config', () => {
  const leads = [
    {
      raw_meta_payload: {
        fields: {
          'NOMBRE COMPLETO': 'Carlos',
          'PUNTO DE MEJORA': 'Facturación electrónica',
          '¿Cuántas sucursales tiene?': '4 sucursales',
        },
      },
    },
  ];

  const discovered = mod.discoverAvailableIntakeFields(leads);
  const extra = discovered.find((f) => f.key === 'extra:cuantas_sucursales_tiene');
  assert.ok(extra, 'Debe descubrir columnas nuevas del Excel automáticamente');
  assert.equal(extra.isExtra, true);
  assert.equal(mod.getLeadIntakeFieldValue(leads[0], extra.key), '4 sucursales');
});

test('4. Infers urgency levels and builds complete initial + reentry timeline events', () => {
  assert.equal(mod.inferUrgencyLevel('Lo antes posible'), 'high');
  assert.equal(mod.inferUrgencyLevel('En los próximos 1 a 3 meses'), 'medium');
  assert.equal(mod.inferUrgencyLevel('Por ahora solo estoy buscando información'), 'low');
  assert.equal(mod.inferUrgencyLevel(''), null);

  const leadWithReentry = {
    id: 'lead-re',
    created_at: '2026-11-20T10:00:00Z',
    raw_meta_payload: {
      sheet_name: 'NOVIEMBRE 2026',
      row_number: 10,
      synced_at: '2026-11-20T10:01:00Z',
      fields: {
        'PUNTO DE MEJORA': 'Inventarios y productos',
        'URGENCIA DE PROJECTO': 'Lo antes posible',
      },
      reentries: [
        {
          at: '2026-11-22T14:30:00Z',
          sheet_name: 'NOVIEMBRE 2026',
          row_number: 30,
          ad_name: 'ERP | Retargeting',
          product: 'ERP',
          urgency: 'Lo antes posible',
          improvement_area: 'Facturación electrónica',
          comments: 'Quiere demo esta semana',
        },
      ],
    },
  };

  const events = mod.buildLeadIntakeTimelineEvents(leadWithReentry);
  assert.equal(events.length, 2);
  assert.equal(events[0].kind, 'initial');
  assert.equal(events[1].kind, 'reentry');
  assert.equal(events[1].rowNumber, 30);
  assert.ok(events[1].entries.some((e) => e.value === 'Quiere demo esta semana'));
});
