// Actualizar perfil de negocio de WhatsApp y solicitar cambio de nombre
const TOKEN    = 'EAAQ4Ipb5RF0BSH5EZC9zcUO9mBUPyTrPt8o7pAbWYbAFZCUkaL0vzlJbBXf4FFapS81RL6wTnH1DxYgTqrp3T7vkjlvMsBo1ZAZBsdGT8wtz9DsznBdyL7QyqjKBGFXlYfEgoEwCjQ4O9iBoaeMhvgEcEVoOvB2hB2aDn0td9Gs1ByFXv83OeWuhwD8wWGOfnQZDZD';
const PHONE_ID = '1128590870346279';

// ── PASO 1: Actualizar Business Profile (descripción, about, vertical) ────
console.log('✏️  Actualizando perfil de negocio...');
const r1 = await fetch(
  `https://graph.facebook.com/v19.0/${PHONE_ID}/whatsapp_business_profile`,
  {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      about: 'Arias Defense Components — Equipamiento y soluciones de defensa.',
      address: 'El Salvador',
      description: 'Arias Defense Components LLC. Contacta a nuestro equipo para más información sobre productos y servicios.',
      email: 'info@ariasdefense.com',
      vertical: 'RETAIL',
      websites: ['https://ariascrm.com']
    })
  }
);
const p1 = await r1.json();
if (p1.success) console.log('  ✅ Perfil actualizado exitosamente!');
else console.log('  Respuesta:', JSON.stringify(p1));

// ── PASO 2: Solicitar cambio de nombre a "Arias Defense Components" ────────
console.log('\n📝 Solicitando cambio de nombre a "Arias Defense Components"...');
const r2 = await fetch(
  `https://graph.facebook.com/v19.0/${PHONE_ID}`,
  {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      new_name: 'Arias Defense Components'
    })
  }
);
const p2 = await r2.json();
if (p2.success) {
  console.log('  ✅ Solicitud de nombre enviada a Meta para revisión!');
  console.log('  El nuevo nombre aparecerá en 1-3 días hábiles.');
} else if (p2.error) {
  console.log('  ⚠️  Respuesta Meta:', p2.error.message);
  // Puede que el nombre ya esté en proceso o sea el mismo
} else {
  console.log('  Respuesta:', JSON.stringify(p2));
}

// ── PASO 3: Verificar perfil actual ───────────────────────────────────────
console.log('\n📋 Perfil actual del número:');
const r3 = await fetch(
  `https://graph.facebook.com/v19.0/${PHONE_ID}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,vertical,websites,verified_name&access_token=${TOKEN}`
);
const p3 = await r3.json();
if (p3.data?.[0]) {
  const prof = p3.data[0];
  console.log('  Nombre verificado:', prof.verified_name);
  console.log('  About:           ', prof.about);
  console.log('  Descripción:     ', prof.description);
  console.log('  Foto de perfil:  ', prof.profile_picture_url || '(ninguna configurada)');
  console.log('  Vertical:        ', prof.vertical);
  console.log('  Sitio web:       ', prof.websites?.[0]);
} else {
  console.log('  ', JSON.stringify(p3));
}

console.log('\n⚠️  PENDIENTE — LOGO:');
console.log('   Para subir el logo de Arias Defense Components necesito el archivo.');
console.log('   Opciones:');
console.log('   1. Dame la ruta del logo en tu computadora');
console.log('   2. O ve a: business.facebook.com/wa/manage/phone-numbers/');
console.log('      y súbelo manualmente desde el perfil del número.');
