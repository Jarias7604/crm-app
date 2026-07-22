// Subir foto de perfil de WhatsApp — Arias Defense Components
// Usando el ícono circular del avión (perfecto para foto de perfil)
import { readFileSync } from 'node:fs';
import { createReadStream, statSync } from 'node:fs';

const TOKEN    = 'EAAQ4Ipb5RF0BSH5EZC9zcUO9mBUPyTrPt8o7pAbWYbAFZCUkaL0vzlJbBXf4FFapS81RL6wTnH1DxYgTqrp3T7vkjlvMsBo1ZAZBsdGT8wtz9DsznBdyL7QyqjKBGFXlYfEgoEwCjQ4O9iBoaeMhvgEcEVoOvB2hB2aDn0td9Gs1ByFXv83OeWuhwD8wWGOfnQZDZD';
const PHONE_ID = '1128590870346279';
const APP_ID   = '1187621119804509';
const IMG_PATH = 'C:\\Users\\jaria\\OneDrive\\Arias Defense\\Logo\\arias logo solo avion.jpg';

const fileBytes = readFileSync(IMG_PATH);
const fileSize  = statSync(IMG_PATH).size;
const mimeType  = 'image/jpeg';

console.log(`📁 Archivo: arias logo solo avion.jpg (${fileSize} bytes)`);
console.log('🚀 Iniciando upload a Meta...\n');

// PASO 1: Iniciar sesión de upload resumible
console.log('PASO 1: Iniciando sesión de upload...');
const r1 = await fetch(
  `https://graph.facebook.com/v19.0/${APP_ID}/uploads?file_length=${fileSize}&file_type=${mimeType}&access_token=${TOKEN}`,
  { method: 'POST' }
);
const session = await r1.json();
if (session.error) {
  console.error('❌ Error iniciando upload:', session.error.message);
  process.exit(1);
}
const uploadSessionId = session.id;
console.log('  ✅ Session ID:', uploadSessionId);

// PASO 2: Subir el archivo
console.log('\nPASO 2: Subiendo imagen...');
const r2 = await fetch(
  `https://graph.facebook.com/v19.0/${uploadSessionId}`,
  {
    method: 'POST',
    headers: {
      'Authorization': `OAuth ${TOKEN}`,
      'file_offset': '0',
      'Content-Type': mimeType,
    },
    body: fileBytes
  }
);
const uploadResult = await r2.json();
if (uploadResult.error) {
  console.error('❌ Error subiendo archivo:', uploadResult.error.message);
  process.exit(1);
}
const handle = uploadResult.h;
console.log('  ✅ Upload handle:', handle);

// PASO 3: Establecer como foto de perfil
console.log('\nPASO 3: Estableciendo como foto de perfil de WhatsApp...');
const r3 = await fetch(
  `https://graph.facebook.com/v19.0/${PHONE_ID}/whatsapp_business_profile`,
  {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      profile_picture_handle: handle
    })
  }
);
const result = await r3.json();
if (result.success) {
  console.log('  ✅ FOTO DE PERFIL ACTUALIZADA EXITOSAMENTE!');
  console.log('  El logo del avión ahora aparece en el número +503 7269-0007 de WhatsApp.');
} else {
  console.error('  ❌ Error:', JSON.stringify(result));
}
