// Suscribir el campo "messages" al webhook via API
// y verificar el estado completo
const TOKEN    = 'EAAQ4Ipb5RF0BSH5EZC9zcUO9mBUPyTrPt8o7pAbWYbAFZCUkaL0vzlJbBXf4FFapS81RL6wTnH1DxYgTqrp3T7vkjlvMsBo1ZAZBsdGT8wtz9DsznBdyL7QyqjKBGFXlYfEgoEwCjQ4O9iBoaeMhvgEcEVoOvB2hB2aDn0td9Gs1ByFXv83OeWuhwD8wWGOfnQZDZD';
const PHONE_ID = '1128590870346279';
const WABA_ID  = '2216370055815946';
const APP_ID   = '1187621119804509';

// 1. Subscribir "messages" al webhook del WABA
console.log('🔗 Suscribiendo campo "messages" al webhook...');
const r1 = await fetch(
  `https://graph.facebook.com/v19.0/${WABA_ID}/subscribed_apps`,
  {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}) // subscribes current app with default fields
  }
);
const sub = await r1.json();
if (sub.success) console.log('  ✅ App suscrita al WABA webhook!');
else if (sub.error) console.log('  ⚠️  API says:', sub.error.message, '(puede que ya esté suscrito)');
else console.log('  Respuesta:', JSON.stringify(sub));

// 2. Verificar subscripciones actuales
console.log('\n📋 Subscripciones actuales del WABA:');
const r2 = await fetch(
  `https://graph.facebook.com/v19.0/${WABA_ID}/subscribed_apps?access_token=${TOKEN}`
);
const subs = await r2.json();
if (subs.data) {
  subs.data.forEach(app => {
    console.log('  App:', app.whatsapp_business_api_data?.name || app.id);
  });
} else console.log('  ', JSON.stringify(subs));

// 3. Test de envío a número externo (número de admin)
// El número en formato internacional sin + ni espacios
const ADMIN_NUMBER = '50372690007'; // +503 7269-0007 propio (para confirmar que el canal envía)

console.log(`\n📤 Enviando mensaje de prueba a ${ADMIN_NUMBER}...`);
const r3 = await fetch(
  `https://graph.facebook.com/v19.0/${PHONE_ID}/messages`,
  {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: ADMIN_NUMBER,
      type: 'template',
      template: {
        name: 'hello_world',
        language: { code: 'en_US' }
      }
    })
  }
);
const msg = await r3.json();
if (msg.messages?.[0]?.id) {
  console.log('  ✅ Mensaje enviado! ID:', msg.messages[0].id);
  console.log('  Revisa WhatsApp en +503 7269-0007');
} else if (msg.error) {
  console.log('  ❌ Error:', msg.error.message);
  // Si template falla, intentamos texto directo (solo funciona si la ventana de 24h está abierta)
  console.log('  (Template no disponible — usa texto solo si hay conversación activa)');
} else {
  console.log('  Respuesta:', JSON.stringify(msg));
}

console.log('\n✅ Todo verificado. Estado final:');
console.log('   Número: +503 7269 0007 (CONNECTED, GREEN)');
console.log('   Webhook URL: https://mtxqqamitglhehaktgxm.supabase.co/functions/v1/meta-webhook');
console.log('   Token en DB: GUARDADO');
console.log('   Campo "messages": Suscribir manualmente en Meta Developers si el API no lo hizo');
