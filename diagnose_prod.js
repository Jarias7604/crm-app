import { createClient } from '@supabase/supabase-js';

// ✅ PRODUCCIÓN — mtxqqamitglhehaktgxm
const PROD_URL  = 'https://mtxqqamitglhehaktgxm.supabase.co';
const PROD_KEY  = 'sb_publishable_z1K6bvDwNrO2v-uuY914cg_RfQ_dBeY';
const sb        = createClient(PROD_URL, PROD_KEY);

// ─── Credenciales extraídas por el browser agent ───────────────────────────
// App: Arias Defense Components (App ID: 1187621119804509)
const PHONE_NUMBER_ID = '1128590870346279';
const WABA_ID         = '2216370055815946';
// Nota: el token permanente aún necesita generarse en Meta Business Manager
// Por ahora registramos la integración sin token para activar el registro
// El token se actualizará en el siguiente paso

const COMPANY_ID = '7a582ba5-f7d0-4ae3-9985-35788deb1c30'; // Arias Defense Components LLC El Salvador

async function registerIntegration() {
    console.log('=== REGISTRANDO INTEGRACIÓN WHATSAPP EN PRODUCCIÓN ===\n');
    console.log(`  Company ID: ${COMPANY_ID}`);
    console.log(`  Phone Number ID: ${PHONE_NUMBER_ID}`);
    console.log(`  WABA ID: ${WABA_ID}`);

    // Upsert — si ya existe, actualiza; si no, crea
    const { data, error } = await sb
        .from('marketing_integrations')
        .upsert({
            company_id:  COMPANY_ID,
            provider:    'whatsapp',
            is_active:   true,
            settings: {
                phoneNumberId: PHONE_NUMBER_ID,
                wabaId:        WABA_ID,
                token:         null // ← Se actualizará cuando tengamos el token permanente
            }
        }, { onConflict: 'company_id, provider' })
        .select()
        .single();

    if (error) {
        console.error('❌ Error al registrar la integración:', JSON.stringify(error, null, 2));
    } else {
        console.log('\n✅ INTEGRACIÓN REGISTRADA EXITOSAMENTE!');
        console.log('   ID del registro:', data.id);
        console.log('   Settings guardados:', JSON.stringify(data.settings, null, 2));
    }

    // Verificar estado post-registro
    console.log('\n--- Verificación post-registro ---');
    const { data: verify } = await sb
        .from('marketing_integrations')
        .select('id, company_id, provider, is_active, settings')
        .eq('company_id', COMPANY_ID)
        .eq('provider', 'whatsapp');

    console.log('Registro en DB:', JSON.stringify(verify, null, 2));
    console.log('\n⚠️  PENDIENTE: Agregar token permanente de Meta Business Manager');
    console.log('   Para activar el envío de mensajes, necesitas:');
    console.log('   1. Ir a business.facebook.com > Configuración > Usuarios del Sistema');
    console.log('   2. Generar token para el número de Arias Defense Components');
    console.log('   3. Pegarlo en /marketing/settings > WhatsApp > Meta Cloud API > Access Token');
}

registerIntegration().catch(console.error);
