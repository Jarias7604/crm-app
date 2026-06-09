import { calculateQuoteFinancialsV2, getVolumeLabel } from '../src/utils/quoteUtils';

function runTests() {
    console.log('🧪 RUNNING PRICING ENGINE TEST SUITE (LOCAL)\n');

    let passed = 0;
    let failed = 0;

    function assert(condition: boolean, message: string) {
        if (condition) {
            console.log(`  ✅ PASSED: ${message}`);
            passed++;
        } else {
            console.error(`  ❌ FAILED: ${message}`);
            failed++;
        }
    }

    // --- TEST CASE 1: Cash Mode (Pago Único) ---
    // Licencia: $1000, Setup: $500, IVA: 13%, Cuotas: 1
    const res1 = calculateQuoteFinancialsV2({
        costo_plan_anual: 1000,
        costo_implementacion: 500,
        iva_porcentaje: 13,
        cuotas: 1
    });

    assert(res1.isPagoUnico === true, 'Resolved single payment mode correctly');
    assert(res1.totalLicencia === 1130, `Total license with VAT should be $1130 (got $${res1.totalLicencia})`);
    assert(res1.totalImplementacion === 565, `Total setup with VAT should be $565 (got $${res1.totalImplementacion})`);
    assert(res1.cuotaMensual === 1130, `Monthly installment for cash mode should match total license (got $${res1.cuotaMensual})`);

    // --- TEST CASE 2: Financing Surcharge Mode (12 Cuotas + 20% Recargo) ---
    // Licencia: $1200, Setup: $300 (setup is exempt from interest), Recargo: 20%, Cuotas: 12
    const res2 = calculateQuoteFinancialsV2({
        costo_plan_anual: 1200,
        costo_implementacion: 300,
        iva_porcentaje: 13,
        recargo_mensual_porcentaje: 20,
        cuotas: 12
    }, {
        tipo_ajuste: 'recharge',
        interes_porcentaje: 20
    });

    assert(res2.isPagoUnico === false, 'Resolved multi-payment mode correctly');
    assert(res2.recargoMonto === 240, `Surcharge amount should be 20% of $1200 ($240) (got $${res2.recargoMonto})`);
    assert(res2.totalLicencia === 1627.20, `Total license with surcharge + VAT should be $1627.20 (got $${res2.totalLicencia})`);
    assert(res2.cuotaMensual === 135.60, `Monthly cuota should be $135.60 (got $${res2.cuotaMensual})`);
    assert(res2.totalImplementacion === 339, `Setup is exempt from interest, should be $339 (got $${res2.totalImplementacion})`);

    // --- TEST CASE 3: Cross-Item Discount (Base License is Zero) ---
    // Licencia: $0, Setup: $1000, Descuento Plan: 20%
    const res3 = calculateQuoteFinancialsV2({
        costo_plan_anual: 0,
        costo_implementacion: 1000,
        iva_porcentaje: 13,
        cuotas: 1
    }, {
        tipo_ajuste: 'discount',
        interes_porcentaje: 20
    });

    assert(res3.descuentoImplementacionMonto === 200, `Cross-item discount should apply 20% to setup cost when license is $0 (got $${res3.descuentoImplementacionMonto})`);
    assert(res3.totalImplementacion === 904, `Setup with discount + VAT should be $904 (got $${res3.totalImplementacion})`);

    // --- TEST CASE 4: Industry Volume Mapping Labels ---
    assert(getVolumeLabel('Defensa') === 'DTEs/año', 'Industry Defense matches DTEs/año');
    assert(getVolumeLabel('Retail') === 'Transacciones/año', 'Industry Retail matches Transacciones/año');
    assert(getVolumeLabel('Salud') === 'Contactos/año', 'Industry Salud matches Contactos/año');
    assert(getVolumeLabel('Iglesia') === 'Miembros/año', 'Industry Iglesia matches Miembros/año');

    console.log(`\n📊 SUMMARY: ${passed} passed, ${failed} failed.`);
    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
