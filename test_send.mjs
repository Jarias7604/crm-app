// Enviar mensaje de prueba a un número real para confirmar que el sistema funciona
// Usamos el número del dueño del CRM como destino del test
const TOKEN    = 'EAAQ4Ipb5RF0BSH5EZC9zcUO9mBUPyTrPt8o7pAbWYbAFZCUkaL0vzlJbBXf4FFapS81RL6wTnH1DxYgTqrp3T7vkjlvMsBo1ZAZBsdGT8wtz9DsznBdyL7QyqjKBGFXlYfEgoEwCjQ4O9iBoaeMhvgEcEVoOvB2hB2aDn0td9Gs1ByFXv83OeWuhwD8wWGOfnQZDZD';
const PHONE_ID = '1128590870346279';

// Enviar a un número externo — el propio Jimmy para verificar
// Usamos el número de Jimmy como primer destinatario de prueba
const TO_NUMBER = '15036001234'; // ← cambiar al número correcto de prueba

console.log('🧪 Enviando mensaje de test...');
const r = await fetch(`https://graph.facebook.com/v19.0/${PHONE_ID}/messages`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: TO_NUMBER,
    type: 'text',
    text: { body: '✅ CRM Arias Defense: WhatsApp conectado. Este es un mensaje de prueba del sistema.' }
  })
});
const result = await r.json();
console.log('Resultado:', JSON.stringify(result, null, 2));
