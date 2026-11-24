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
