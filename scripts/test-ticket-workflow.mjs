import test from 'node:test';
import assert from 'node:assert/strict';
import esbuild from 'esbuild';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const bundleResult = await esbuild.build({
    entryPoints: [path.resolve('src/lib/ticketWorkflow.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
});

const code = bundleResult.outputFiles[0].text;
const mod = await import(`data:text/javascript;base64,${Buffer.from(code, 'utf8').toString('base64')}`);

test('TICKET_STATUS_META exposes standardized commercial lifecycle labels', () => {
    assert.equal(mod.TICKET_STATUS_META.new.label, 'Ticket Generado');
    assert.equal(mod.TICKET_STATUS_META.open.label, 'En Proceso');
    assert.equal(mod.TICKET_STATUS_META.pending.label, 'En Espera');
    assert.equal(mod.TICKET_STATUS_META.resolved.label, 'Completado');
    assert.equal(mod.TICKET_STATUS_META.closed.label, 'Cerrado');
});

test('cleanProblemHeadline strips greetings and formats structured Module — Problem titles', () => {
    assert.equal(
        mod.buildStructuredTicketTitle('Inventario', 'Hola buenos días muchachos, no reduce las cantidades del inventario al facturar'),
        'Inventario — No reduce las cantidades del inventario al facturar',
    );
    assert.equal(
        mod.buildStructuredTicketTitle('Facturación DTE', 'buenas tardes soporte error 400 al firmar CCF'),
        'Facturación DTE — Error 400 al firmar CCF',
    );
});

test('validateTicketProblemText rejects vague greetings and accepts clear technical issues', () => {
    assert.equal(mod.validateTicketProblemText('Hola buenas tardes').valid, false);
    assert.equal(mod.validateTicketProblemText('Ayuda por favor').valid, false);
    assert.equal(mod.validateTicketProblemText('Ok gracias').valid, false);
    assert.equal(mod.validateTicketProblemText('No reduce cantidades al facturar').valid, true);
});

test('shouldSendTicketStatusEmail notifies on Ticket Generado, En Proceso y Completado', () => {
    assert.equal(mod.shouldSendTicketStatusEmail('new'), true);
    assert.equal(mod.shouldSendTicketStatusEmail('open'), true);
    assert.equal(mod.shouldSendTicketStatusEmail('resolved'), true);
    assert.equal(mod.shouldSendTicketStatusEmail('pending'), false);
    assert.equal(mod.shouldSendTicketStatusEmail('closed'), false);
});

test('resolveTicketNotifyRecipients deduplicates creator, assignee and watchers while excluding actor', () => {
    const recipients = mod.resolveTicketNotifyRecipients({
        actorId: 'dev-1',
        createdBy: 'agent-1',
        assignedTo: 'dev-1',
        watchers: ['diana-1', 'patricia-1', 'grecia-1', 'agent-1', 'dev-1', '', null],
    });
    assert.deepEqual(recipients, ['agent-1', 'diana-1', 'patricia-1', 'grecia-1']);
});

test('buildCanonicalTicketUrl rewrites Vercel preview/branch origins to https://ariascrm.com', () => {
    assert.equal(
        mod.buildCanonicalTicketUrl('8295834d-1d2d-4396-8def-07708f41ef1a', 'https://crm-app-v2.vercel.app'),
        'https://ariascrm.com/support/tickets?ticket=8295834d-1d2d-4396-8def-07708f41ef1a',
    );
    assert.equal(
        mod.buildCanonicalTicketUrl('8295834d-1d2d-4396-8def-07708f41ef1a', 'http://localhost:5173'),
        'https://ariascrm.com/support/tickets?ticket=8295834d-1d2d-4396-8def-07708f41ef1a',
    );
    assert.equal(
        mod.buildCanonicalTicketUrl('8295834d-1d2d-4396-8def-07708f41ef1a', 'https://www.ariascrm.com/'),
        'https://www.ariascrm.com/support/tickets?ticket=8295834d-1d2d-4396-8def-07708f41ef1a',
    );
});

test('sanitizePostLoginNextPath preserves internal ticket deep-links and blocks external URLs', () => {
    assert.equal(
        mod.sanitizePostLoginNextPath('/support/tickets?ticket=8295834d-1d2d-4396-8def-07708f41ef1a'),
        '/support/tickets?ticket=8295834d-1d2d-4396-8def-07708f41ef1a',
    );
    assert.equal(mod.sanitizePostLoginNextPath('https://evil.example/steal'), '/dashboard');
    assert.equal(mod.sanitizePostLoginNextPath('//evil.example/steal'), '/dashboard');
    assert.equal(mod.sanitizePostLoginNextPath('/login?next=/dashboard'), '/dashboard');
});

test('matchesTicketSearchQuery finds tickets by 4-char ID, #ID, client, accents, and solution', () => {
    const sample = {
        id: '8295834d-1d2d-4396-8def-07708f41ef1a',
        title: 'Facturación DTE — No se puede emitir factura de sujeto excluido',
        lead_name: 'Soporte Técnico Salinera San Jorge',
        solution: 'Se corrigió el correlativo en bodega principal',
        metadata: { module_name: 'Facturación DTE' },
        assigned_to: 'dev-melvin',
    };
    const agents = new Map([['dev-melvin', 'Melvin Rodriguez']]);
    assert.equal(mod.matchesTicketSearchQuery(sample, '8295', agents), true);
    assert.equal(mod.matchesTicketSearchQuery(sample, '#8295834D', agents), true);
    assert.equal(mod.matchesTicketSearchQuery(sample, 'facturacion sujeto excluido', agents), true);
    assert.equal(mod.matchesTicketSearchQuery(sample, 'Salinera', agents), true);
    assert.equal(mod.matchesTicketSearchQuery(sample, 'Melvin', agents), true);
    assert.equal(mod.matchesTicketSearchQuery(sample, 'correlativo', agents), true);
    assert.equal(mod.matchesTicketSearchQuery(sample, '9999inexistente', agents), false);
});
