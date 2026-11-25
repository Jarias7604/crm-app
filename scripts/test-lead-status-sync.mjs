import test from 'node:test';
import assert from 'node:assert/strict';
import esbuild from 'esbuild';
import path from 'node:path';

const bundleResult = await esbuild.build({
    entryPoints: [path.resolve('src/lib/leadStatusSync.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
});

const code = bundleResult.outputFiles[0].text;
const mod = await import(`data:text/javascript;base64,${Buffer.from(code, 'utf8').toString('base64')}`);

test('manual Perdido or En seguimiento beats stale isNonWaError (exists:false) delivery flag', () => {
    assert.equal(
        mod.resolveCircleLeadStatus({
            leadStatus: 'Perdido',
            metaLeadStatus: 'Erróneo',
            isNonWaError: true,
            hasManualOverride: false,
        }),
        'Perdido',
    );
    assert.equal(
        mod.resolveCircleLeadStatus({
            leadStatus: 'En seguimiento',
            metaLeadStatus: 'Erróneo',
            isNonWaError: true,
            hasManualOverride: false,
        }),
        'En seguimiento',
    );
});

test('Cliente and Cerrado are protected and never auto-downgraded to Erróneo', () => {
    assert.equal(mod.canAutoMarkLeadErroneo('Cliente'), false);
    assert.equal(mod.canAutoMarkLeadErroneo('Cerrado'), false);
    assert.equal(mod.canAutoMarkLeadErroneo('Perdido'), false);
    assert.equal(mod.canAutoMarkLeadErroneo('Prospecto'), true);
    assert.equal(mod.canAutoMarkLeadErroneo('Llamada fría'), true);
    assert.equal(mod.canAutoMarkLeadErroneo('En Nutrición'), true);
    assert.equal(
        mod.resolveCircleLeadStatus({
            leadStatus: 'Cliente',
            metaLeadStatus: 'Erróneo',
            isNonWaError: true,
            hasManualOverride: false,
        }),
        'Cliente',
    );
});

test('untouched Prospecto with isNonWaError resolves to Erróneo unless manually overridden', () => {
    assert.equal(
        mod.resolveCircleLeadStatus({
            leadStatus: 'Prospecto',
            metaLeadStatus: null,
            isNonWaError: true,
            hasManualOverride: false,
        }),
        'Erróneo',
    );
    assert.equal(
        mod.resolveCircleLeadStatus({
            leadStatus: 'Prospecto',
            metaLeadStatus: 'Prospecto',
            isNonWaError: true,
            hasManualOverride: true,
        }),
        'Prospecto',
    );
});

test('shouldPauseAiOnLeadStatus pauses AI qualifier for terminal and discarded stages', () => {
    assert.equal(mod.shouldPauseAiOnLeadStatus('Perdido'), true);
    assert.equal(mod.shouldPauseAiOnLeadStatus('Erróneo'), true);
    assert.equal(mod.shouldPauseAiOnLeadStatus('Cliente'), true);
    assert.equal(mod.shouldPauseAiOnLeadStatus('Cerrado'), true);
    assert.equal(mod.shouldPauseAiOnLeadStatus('Prospecto'), false);
    assert.equal(mod.shouldPauseAiOnLeadStatus('En seguimiento'), false);
});
