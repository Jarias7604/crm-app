// Comparar las dos apps: "Arias Defense" (7987) vs "Arias Defense Components" (4509)
const TOKEN = 'EAAQ4Ipb5RF0BSH5EZC9zcUO9mBUPyTrPt8o7pAbWYbAFZCUkaL0vzlJbBXf4FFapS81RL6wTnH1DxYgTqrp3T7vkjlvMsBo1ZAZBsdGT8wtz9DsznBdyL7QyqjKBGFXlYfEgoEwCjQ4O9iBoaeMhvgEcEVoOvB2hB2aDn0td9Gs1ByFXv83OeWuhwD8wWGOfnQZDZD';

// App 1: "Arias Defense" — App ID termina en 7987
const APP_7987 = '1132495918667987';
// App 2: "Arias Defense Components" — App ID termina en 4509 (la actual)
const APP_4509 = '1187621119804509';
const WABA_ID  = '2216370055815946';

console.log('=== COMPARACIÓN DE APPS DE META ===\n');

// Verificar qué WABA tiene cada app
console.log('📱 App "Arias Defense" (termina en 7987):');
const r1 = await fetch(
  `https://graph.facebook.com/v19.0/${APP_7987}/subscribed_whatsapp_business_accounts?access_token=${TOKEN}`
);
const d1 = await r1.json();
if (d1.error) console.log('   ❌ Sin acceso o sin WhatsApp:', d1.error.message);
else console.log('   WABA vinculada:', JSON.stringify(d1.data || d1));

console.log('\n📱 App "Arias Defense Components" (termina en 4509) — LA ACTUAL:');
const r2 = await fetch(
  `https://graph.facebook.com/v19.0/${APP_4509}/subscribed_whatsapp_business_accounts?access_token=${TOKEN}`
);
const d2 = await r2.json();
if (d2.error) console.log('   ❌ Error:', d2.error.message);
else console.log('   WABA vinculada:', JSON.stringify(d2.data || d2));

// Verificar quién está suscrito al WABA actual
console.log('\n🔗 Apps suscritas al WABA (2216370055815946):');
const r3 = await fetch(
  `https://graph.facebook.com/v19.0/${WABA_ID}/subscribed_apps?access_token=${TOKEN}`
);
const d3 = await r3.json();
if (d3.data) {
  d3.data.forEach(app => {
    const info = app.whatsapp_business_api_data;
    console.log(`   ✅ ${info?.name || 'App'} — ID: ${info?.id}`);
  });
} else console.log('   ', JSON.stringify(d3));

console.log('\n=== RESUMEN ===');
console.log('La configuración ANTERIOR estaba en: "Arias Defense" (App 7987)');
console.log('La configuración ACTUAL está en:     "Arias Defense Components" (App 4509)');
console.log('El número +503 7269-0007 sigue siendo el mismo en ambas cuentas.');
