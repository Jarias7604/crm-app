// Verificar estado completo del webhook y la integración
const TOKEN      = 'EAAQ4Ipb5RF0BSH5EZC9zcUO9mBUPyTrPt8o7pAbWYbAFZCUkaL0vzlJbBXf4FFapS81RL6wTnH1DxYgTqrp3T7vkjlvMsBo1ZAZBsdGT8wtz9DsznBdyL7QyqjKBGFXlYfEgoEwCjQ4O9iBoaeMhvgEcEVoOvB2hB2aDn0td9Gs1ByFXv83OeWuhwD8wWGOfnQZDZD';
const PHONE_ID   = '1128590870346279';
const WABA_ID    = '2216370055815946';
const APP_ID     = '1187621119804509';

// 1. Estado del número de teléfono
console.log('📱 NÚMERO DE TELÉFONO:');
const r1 = await fetch(`https://graph.facebook.com/v19.0/${PHONE_ID}?fields=display_phone_number,verified_name,quality_rating,status,is_official_business_account&access_token=${TOKEN}`);
const phone = await r1.json();
if (phone.error) console.log('  ❌', phone.error.message);
else console.log(`  ✅ ${phone.display_phone_number} | Estado: ${phone.status} | Calidad: ${phone.quality_rating}`);

// 2. Verificar webhook subscriptions del WABA
console.log('\n🔗 WEBHOOK SUBSCRIPTIONS DEL WABA:');
const r2 = await fetch(`https://graph.facebook.com/v19.0/${WABA_ID}/subscribed_apps?access_token=${TOKEN}`);
const subs = await r2.json();
if (subs.error) console.log('  ❌', subs.error.message);
else console.log('  Subscribed apps:', JSON.stringify(subs.data || subs, null, 2));

// 3. Enviar mensaje de prueba al mismo número (echo test)
console.log('\n🧪 ENVIANDO MENSAJE DE PRUEBA (echo al mismo número):');
const testMsg = {
  messaging_product: 'whatsapp',
  to: '50372690007',
  type: 'text',
  text: { body: '✅ CRM Arias: Tu WhatsApp está conectado correctamente. Los leads llegarán aquí.' }
};
const r3 = await fetch(`https://graph.facebook.com/v19.0/${PHONE_ID}/messages`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(testMsg)
});
const msgResult = await r3.json();
if (msgResult.error) console.log('  ❌ Error al enviar:', msgResult.error.message);
else console.log('  ✅ Mensaje enviado! Message ID:', msgResult.messages?.[0]?.id);

console.log('\n✅ Verificación completa');
