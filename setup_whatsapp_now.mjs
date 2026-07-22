// ═══════════════════════════════════════════════════════════════
// SETUP WHATSAPP — PRODUCCIÓN
// ═══════════════════════════════════════════════════════════════
const TOKEN          = 'EAAQ4Ipb5RF0BSH5EZC9zcUO9mBUPyTrPt8o7pAbWYbAFZCUkaL0vzlJbBXf4FFapS81RL6wTnH1DxYgTqrp3T7vkjlvMsBo1ZAZBsdGT8wtz9DsznBdyL7QyqjKBGFXlYfEgoEwCjQ4O9iBoaeMhvgEcEVoOvB2hB2aDn0td9Gs1ByFXv83OeWuhwD8wWGOfnQZDZD';
const PHONE_ID       = '1128590870346279';
const WABA_ID        = '2216370055815946';
const COMPANY_ID     = '7a582ba5-f7d0-4ae3-9985-35788deb1c30';
const SUPABASE_URL   = 'https://mtxqqamitglhehaktgxm.supabase.co';

// ── PASO 1: Verificar número real via Meta Graph API ──────────────────────
console.log('\n🔍 PASO 1: Verificando número de teléfono en Meta...');
try {
  const r = await fetch(
    `https://graph.facebook.com/v19.0/${PHONE_ID}?fields=display_phone_number,verified_name,quality_rating,status&access_token=${TOKEN}`
  );
  const data = await r.json();
  if (data.error) {
    console.error('❌ Error en Meta API:', JSON.stringify(data.error));
  } else {
    console.log('✅ Número registrado en Meta:');
    console.log('   Número real:    ', data.display_phone_number);
    console.log('   Nombre:         ', data.verified_name);
    console.log('   Estado:         ', data.status);
    console.log('   Calidad:        ', data.quality_rating);
  }
} catch (e) {
  console.error('❌ Fetch a Meta falló:', e.message);
}

// ── PASO 2: Listar todos los números en el WABA ───────────────────────────
console.log('\n🔍 PASO 2: Listando TODOS los números en tu WABA...');
try {
  const r = await fetch(
    `https://graph.facebook.com/v19.0/${WABA_ID}/phone_numbers?fields=display_phone_number,id,status,verified_name&access_token=${TOKEN}`
  );
  const data = await r.json();
  if (data.error) {
    console.error('❌ Error:', JSON.stringify(data.error));
  } else {
    console.log('✅ Números disponibles en tu cuenta:');
    (data.data || []).forEach((n, i) => {
      console.log(`   [${i+1}] ${n.display_phone_number} | ID: ${n.id} | Estado: ${n.status}`);
    });
    if (!data.data?.length) console.log('   (ninguno registrado todavía)');
  }
} catch (e) {
  console.error('❌ Fetch WABA falló:', e.message);
}

// ── PASO 3: Insertar en Supabase via Management REST ─────────────────────
console.log('\n💾 PASO 3: Insertando integración en Supabase...');
try {
  const payload = {
    company_id: COMPANY_ID,
    provider:   'whatsapp',
    is_active:  true,
    settings: {
      phoneNumberId: PHONE_ID,
      wabaId:        WABA_ID,
      token:         TOKEN
    }
  };

  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/marketing_integrations`,
    {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MTg3NDAsImV4cCI6MjA4NTQ5NDc0MH0.ybK2j-anHpMIlgaH0D-pRz4W6kyb96fNsbXTfT2FE2o',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MTg3NDAsImV4cCI6MjA4NTQ5NDc0MH0.ybK2j-anHpMIlgaH0D-pRz4W6kyb96fNsbXTfT2FE2o',
        'Prefer':        'return=representation,resolution=merge-duplicates'
      },
      body: JSON.stringify(payload)
    }
  );
  const result = await r.json();
  if (r.ok) {
    const row = Array.isArray(result) ? result[0] : result;
    if (row?.id) {
      console.log('✅ INSERTADO EN DB!  ID:', row.id);
      console.log('   provider:', row.provider, '| is_active:', row.is_active);
    } else {
      console.log('⚠️  Respuesta:', JSON.stringify(result));
    }
  } else {
    console.error('❌ HTTP', r.status, JSON.stringify(result));
    // Si es RLS, necesitamos la clave directa del dashboard
    if (result?.code === '42501') {
      console.log('\n⚠️  BLOQUEADO POR RLS — Ve al Supabase SQL Editor y corre el SQL de abajo:');
      console.log(`
INSERT INTO public.marketing_integrations (company_id, provider, is_active, settings)
VALUES (
  '${COMPANY_ID}',
  'whatsapp',
  true,
  '${JSON.stringify(payload.settings)}'::jsonb
)
ON CONFLICT (company_id, provider) DO UPDATE 
  SET settings = EXCLUDED.settings, is_active = true
RETURNING id;
`);
    }
  }
} catch (e) {
  console.error('❌ Error al insertar en Supabase:', e.message);
}

// ── PASO 4: Verificar webhook actual en Meta ──────────────────────────────
console.log('\n🔗 PASO 4: Verificando configuración de Webhook en Meta...');
try {
  const r = await fetch(
    `https://graph.facebook.com/v19.0/1187621119804509/subscriptions?access_token=${TOKEN}`
  );
  const data = await r.json();
  if (data.error) {
    console.error('❌ Error:', JSON.stringify(data.error));
  } else {
    console.log('✅ Subscripciones del App:');
    console.log(JSON.stringify(data, null, 2));
  }
} catch (e) {
  console.error('❌ Fetch webhook falló:', e.message);
}

console.log('\n✅ SCRIPT COMPLETADO');
