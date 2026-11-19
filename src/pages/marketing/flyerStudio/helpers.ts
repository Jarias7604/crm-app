// ─── Virality Score & Asset Helpers (local, no API) ───────────────────────────

export function calcViralScore(prompt: string, cta: string, phone: string, website: string) {
  if (!prompt.trim() || prompt.trim().length < 10) return { score: 0, level: 'none', tips: [] as string[] };
  let score = 0;
  const tips: string[] = [];
  // Price or discount
  if (/\$[\d,.]+|precio|costo|gratis|%\s*off|descuento|oferta|promo/i.test(prompt)) score += 18;
  else tips.push('💰 Agrega precio o descuento concreto (ej: $12.95/mes, 30% OFF)');
  // Urgency
  if (/hoy|ahora|urgente|l[ií]mite|temporada|exclusiv|solo hasta|quedan/i.test(prompt)) score += 20;
  else tips.push('⚡ Añade urgencia: HOY, OFERTA LIMITADA, SOLO ESTA SEMANA');
  // Benefits / features
  if (/incluye|ofrece|benefici|caracter|servicios|lleva|contiene/i.test(prompt)) score += 15;
  else tips.push('✅ Lista 3 beneficios clave (ej: incluye: Facturación, Inventario, Reportes)');
  // CTA
  if (cta.trim().length > 2) score += 10;
  else tips.push('🎯 Define tu CTA (ej: "Llama HOY", "Prueba gratis")');
  // Contact info
  if (phone.trim() || website.trim()) score += 8;
  // Prompt length sweet spot
  const len = prompt.trim().length;
  if (len >= 80 && len <= 400) score += 15; else if (len > 40) score += 7;
  else tips.push('📝 Describe más tu oferta (al menos 80 caracteres)');
  // Numbers / specifics
  if (/\d+/.test(prompt)) score += 9;
  // Structured tags
  if (/t[íi]tulo:|subt[íi]tulo:|incluye:/i.test(prompt)) score += 5;
  const s = Math.min(score, 100);
  const level = s >= 75 ? 'viral' : s >= 50 ? 'bueno' : s >= 30 ? 'mejorable' : 'bajo';
  return { score: s, level, tips: tips.slice(0, 3) };
}

export const getFlyerDimensions = (formatId: string) => {
  switch (formatId) {
    case 'ig-post':     return { width: 520, height: 520 };
    case 'ig-portrait': return { width: 460, height: 575 };
    case 'fb-post':     return { width: 520, height: 433 };
    case 'story':       return { width: 370, height: 657 };
    case 'fb-cover':    return { width: 540, height: 200 };
    case 'li-post':     return { width: 540, height: 284 };
    default:            return { width: 520, height: 520 };
  }
};

export async function urlToBase64(url: string): Promise<string> {
  if (!url) return '';
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to convert blob to base64'));
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error fetching and converting image to base64:', error);
    return '';
  }
}

export function getThematicImages(prompt: string, industry?: string): string[] {
  const lI = (industry || '').toLowerCase();
  const lP = prompt.toLowerCase();
  const U = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1080&q=80`;
  const CHURCH = [
    'photo-1544427920-c49ccfb85579','photo-1438232992991-995b7058bbb3','photo-1519491050282-cf00c82424b4',
    'photo-1507692049790-de58290a4334','photo-1470225620780-dba8ba36b745','photo-1511671782779-c97d3d27a1d4',
    'photo-1492684223066-81342ee5ff30','photo-1499209974431-9dddcece7f88','photo-1465847899084-d164df4dedc6',
    'photo-1510525009512-ad7fc13eefab','photo-1529070538774-1843cb3265df','photo-1516450360452-9312f5e86fc7',
    'photo-1514525253161-7a46d19cd819','photo-1523580494863-6f3031224c94','photo-1505373877841-8d25f7d46678'
  ].map(U);
  const FINANCE = [
    'photo-1554224155-8d04cb21cd6c','photo-1460925895917-afdab827c52f','photo-1551288049-bebda4e38f71',
    'photo-1559526324-4b87b5e36e44','photo-1579532537598-459ecdaf39cc','photo-1507679799987-c73779587ccf',
    'photo-1486406146926-c627a92ad1ab','photo-1454165804606-c3d57bc86b40','photo-1551836022-d5d88e9218df',
    'photo-1507238691740-187a5b1d37b8','photo-1590283603385-17ffb3a7f29f','photo-1611974789855-9c2a0a7236a3'
  ].map(U);
  const TECH = ['photo-1551288049-bebda4e38f71','photo-1460925895917-afdab827c52f','photo-1504868584819-f8e8b4b6d7e3','photo-1518770660439-4636190af475','photo-1488590528505-98d2b5aba04b','photo-1461749280684-dccba630e2f6','photo-1504639725590-34d0984388bd','photo-1551434678-e076c223a692','photo-1522071820081-009f0129c71c','photo-1542744173-8e7e53415bb0','photo-1486312338219-ce68d2c6f44d','photo-1498050108023-c5249f4df085','photo-1531297484001-80022131f5a1','photo-1519389950473-47ba0277781c','photo-1600880292203-757bb62b4baf','photo-1560472355-536de3962603','photo-1553877522-43269d4ea984'].map(U);
  const FOOD = ['photo-1513104890138-7c749659a591','photo-1504674900247-0877df9cc836','photo-1565299624946-b28f40a0ae38','photo-1568901346375-23c9450c58cd','photo-1512621776951-a57141f2eefd','photo-1544025162-d76694265947','photo-1578985545062-69928b1d9587','photo-1555396273-367ea4eb4db5','photo-1540189549336-e6e99c3679fe','photo-1567620905732-2d1ec7ab7445'].map(U);
  const MEDICAL = ['photo-1622253692010-333f2da6031d','photo-1559839734-2b71ea197ec2','photo-1576091160550-2173dba999ef','photo-1584515906207-523b4c207da7','photo-1537368910025-700350fe46c7','photo-1476480862126-209bfaa8edc8','photo-1519494026892-80bbd2d6fd0d','photo-1551076805-e1869033e561','photo-1631815541552-b5848c1a596c','photo-1505751172876-fa1923c5c528'].map(U);
  const DENTAL = ['photo-1629909613654-28e377c37b09','photo-1588776814546-1ffcf47267a5','photo-1606811971618-4486d14f3f99','photo-1629909615184-74f495363b67','photo-1552566626-52f8b828add9','photo-1576765608535-5f04d1e3f289'].map(U);
  const BEAUTY = ['photo-1560066984-138dadb4c035','photo-1522337360788-8b13dee7a37e','photo-1604654894610-df63bc536371','photo-1540555700478-4be289fbecef','photo-1512290923902-8a9f81dc236c','photo-1562322140-8baeececf3df'].map(U);
  const GYM = ['photo-1517838277536-f5f99be501cd','photo-1534438327276-14e5300c3a48','photo-1571902943202-507ec2618e8f','photo-1526506118085-60ce8714f8c5','photo-1549719386-74dfcbf7dbed','photo-1584735935682-2f2b69dff9d2'].map(U);
  const LEGAL = ['photo-1589829545856-d10d557cf95f','photo-1521587760476-6c12a4b040da','photo-1521791136368-1a46827d06e5','photo-1507679799987-c73779587ccf','photo-1551836022-d5d88e9218df'].map(U);
  const CAFE = ['photo-1501339847302-ac426a4a7cbb','photo-1495474472287-4d71bcdd2085','photo-1509042239860-f550ce710b93','photo-1442512595331-e89e73853f31','photo-1554118811-1e0d58224f24'].map(U);
  const REALESTATE = ['photo-1560518883-ce09059eeffa','photo-1512917774080-9991f1c4c750','photo-1564013799919-ab600027ffc6','photo-1600585154340-be6161a56a0c','photo-1600607687939-ce8a6c25118c','photo-1582407947304-fd86f028f716','photo-1558618666-fcd25c85cd64','photo-1523217582562-09d0def993a6','photo-1484154218962-a197022b5858','photo-1502672260266-1c1ef2d93688'].map(U);
  const BEACH = ['photo-1507525428034-b723cf961d3e','photo-1510414842594-a61c69b5ae57','photo-1544551763-46a013bb70d5','photo-1559494007-9f5847c49d94','photo-1571003123894-1f0594d2b5d9','photo-1527489377706-5bf97e608852','photo-1501785888041-af3ef285b470','photo-1506953823976-52e1fdc0149a','photo-1573843981267-be1999ff37cd','photo-1540202404-a2f29016b523','photo-1469474968028-56623f02e42e','photo-1582610116397-edb72e9b9b4e','photo-1596178065887-1198b6148b2b','photo-1561731216-c3a4d99437d5','photo-1519046904884-53103b34b206'].map(U);
  const AUTO = ['photo-1486006920555-c77dce18193b','photo-1619642751034-765dfdf7c58e','photo-1568605117036-5fe5e7bab0b7','photo-1492144534655-ae79c964c9d7','photo-1525609004556-c46c7d6cf0a3','photo-1503376780353-7e6692767b70'].map(U);
  const EDUCATION = ['photo-1523240795612-9a054b0db644','photo-1509062522246-3755977927d7','photo-1497633762265-9d179a990aa6','photo-1524178232363-1fb2b075b655','photo-1513542789411-b6a5d4f31634'].map(U);
  const DEFENSE = ['photo-1555597673-b21d5c935865','photo-1509198397868-475647b2a1e5','photo-1563986768609-322da13575f3','photo-1614064641938-3bbee52942c7'].map(U);
  const GENERAL = ['photo-1460925895917-afdab827c52f','photo-1519389950473-47ba0277781c','photo-1522071820081-009f0129c71c','photo-1531403009284-440f080d1e12','photo-1486406146926-c627a92ad1ab','photo-1522202176988-66273c2fd55f','photo-1504384308090-c894fdcc538d','photo-1517245386807-bb43f82c33c4'].map(U);
  function pick(t: string) {
    if (/iglesia|iclesia|culto|pastor|ministerio|adoraci[oó]n|cristian|fe|alabanza|congregaci[oó]n|servicio religioso|templo|church|worship/i.test(t)) return CHURCH;
    if (/facturaci[oó]n|factura|contab|finanz|impuesto|fiscal|auditor/i.test(t)) return FINANCE;
    if (/playa|lotes?|terreno|vacaci[óo]n|vacaciones|resort|turismo|para[ío]so|club privado|sol y|arena|oc[ée]ano|caribe|tropical|frente al mar|vista al mar|costa|riviera|bungal/i.test(t)) return BEACH;
    if (/laboratorio|cl[íi]nica|m[eé]dic|farmacia|salud|hospital|doctor|odontolog|dental|dentista|pediatr|enfermer/i.test(t)) return /dental|dentista|odontolog/i.test(t)?DENTAL:MEDICAL;
    if (/restaurante|comida|food|pizza|taco|burger|hamburgues|sushi|pupusa/i.test(t)) return FOOD;
    if (/cafeter[íi]a|caf[eé]|panadería|panaderia/i.test(t)) return CAFE;
    if (/crm|software|saas|tecnolog|digital|sistema|plataforma|ecommerce|inteligencia artificial|embudos|automatizaci|inventario|reportes/i.test(t)) return TECH;
    if (/belleza|salon|uñas|spa|maquillaje|cabello|peluquer/i.test(t)) return BEAUTY;
    if (/gym|gimnasio|fitness|deporte|entrenamiento/i.test(t)) return GYM;
    if (/curso|taller|capacitaci[oó]n|escuela|universidad|estudiante|colegio|aprender/i.test(t)) return EDUCATION;
    if (/abogado|legal|firma|leyes|derecho/i.test(t)) return LEGAL;
    if (/casa|inmobiliaria|apartamento|propiedad|construcci|bienes ra[íi]ces/i.test(t)) return REALESTATE;
    if (/taller|automotriz|mec[aá]nico|veh[íi]culo|repuesto|carro/i.test(t)) return AUTO;
    if (/defensa|karate|marciales|taekwondo/i.test(t)) return DEFENSE;
    return null;
  }
  const chosen = (lI && pick(lI)) || pick(lP) || GENERAL;
  return [...chosen].sort(() => Math.random() - 0.5);
}
