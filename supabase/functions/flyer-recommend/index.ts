// @ts-nocheck
// flyer-recommend v3.0 — Intelligent Photo Search + AI Flyer Ideas

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HARDCODED: Record<string, string[]> = {
  beach: ['photo-1507525428034-b723cf961d3e','photo-1510414842594-a61c69b5ae57','photo-1544551763-46a013bb70d5','photo-1559494007-9f5847c49d94','photo-1571003123894-1f0594d2b5d9','photo-1527489377706-5bf97e608852','photo-1501785888041-af3ef285b470','photo-1506953823976-52e1fdc0149a','photo-1573843981267-be1999ff37cd','photo-1540202404-a2f29016b523','photo-1469474968028-56623f02e42e','photo-1519046904884-53103b34b206','photo-1596178065887-1198b6148b2b','photo-1561731216-c3a4d99437d5','photo-1582610116397-edb72e9b9b4e'],
  food: ['photo-1513104890138-7c749659a591','photo-1504674900247-0877df9cc836','photo-1565299624946-b28f40a0ae38','photo-1568901346375-23c9450c58cd','photo-1579871494447-9811cf80d66c','photo-1512621776951-a57141f2eefd','photo-1544025162-d76694265947','photo-1563379091339-03b21ab4a4f8','photo-1578985545062-69928b1d9587','photo-1555396273-367ea4eb4db5','photo-1540189549336-e6e99c3679fe','photo-1482049016688-2d3e1b311543','photo-1484723091739-30a097e8f929','photo-1567620905732-2d1ec7ab7445','photo-1565299585323-38d6b0865b47'],
  dental: ['photo-1629909613654-28e377c37b09','photo-1588776814546-1ffcf47267a5','photo-1471864190281-a93a3070b6de','photo-1579684389782-64d84b5e901a','photo-1598256989800-fe5f95da9787','photo-1606811971618-4486d14f3f99','photo-1629909615184-74f495363b67','photo-1560185007-c5ca9d2c014d','photo-1468495244123-6c6c332eeece','photo-1596462502278-27bfdc403348','photo-1460157491444-f1a517793577','photo-1512223792601-592a9809eed4','photo-1552566626-52f8b828add9','photo-1576765608535-5f04d1e3f289','photo-1516549655169-df83a0774514'],
  medical: ['photo-1622253692010-333f2da6031d','photo-1559839734-2b71ea197ec2','photo-1586015555751-63bb77f4322a','photo-1576091160550-2173dba999ef','photo-1607619056574-7b8d304a3b24','photo-1537368910025-700350fe46c7','photo-1584515906207-523b4c207da7','photo-1476480862126-209bfaa8edc8','photo-1519494026892-80bbd2d6fd0d','photo-1505751172876-fa1923c5c528','photo-1527613426441-4da17471b66d','photo-1551076805-e1869033e561','photo-1579684389782-64d84b5e901a','photo-1631815541552-b5848c1a596c','photo-1516549655169-df83a0774514'],
  beauty: ['photo-1560066984-138dadb4c035','photo-1522337360788-8b13dee7a37e','photo-1607779097040-26e80aa78e66','photo-1519699047748-de8e457a634e','photo-1604654894610-df63bc536371','photo-1540555700478-4be289fbecef','photo-1582095133179-bfd08e2fc6b3','photo-1512290923902-8a9f81dc236c','photo-1562322140-8baeececf3df','photo-1616394584738-fc6e612e71b9','photo-1527799820374-dcf8d9d4a438','photo-1500840216050-6ffa99d7cd76','photo-1515377905703-c4788e51af15','photo-1590156546746-c23109b257c3','photo-1596462502278-27bfdc403348'],
  gym: ['photo-1517838277536-f5f99be501cd','photo-1534438327276-14e5300c3a48','photo-1541534741688-6078c6bfb5c5','photo-1571902943202-507ec2618e8f','photo-1605296867304-46d5465a25f1','photo-1526506118085-60ce8714f8c5','photo-1517963879433-6ad2b056d712','photo-1518611012118-696072aa579a','photo-1549719386-74dfcbf7dbed','photo-1593079831268-3381b0db4a77','photo-1574680096145-d05b474e2155','photo-1594381898411-846e7d193883','photo-1584735935682-2f2b69dff9d2','photo-1518310383802-64c2de311b2','photo-1476480862126-209bfaa8edc8'],
  realestate: ['photo-1560518883-ce09059eeffa','photo-1512917774080-9991f1c4c750','photo-1564013799919-ab600027ffc6','photo-1600585154340-be6161a56a0c','photo-1600210492486-724fe5c67fb0','photo-1560520653-9e0e4c89eb11','photo-1600596542815-ffad4c1539a9','photo-1504307651254-35680f356dfd','photo-1522708323590-d24dbb6b0267','photo-1582407947304-fd86f028f716','photo-1502672260266-1c1ef2d93688','photo-1484154218962-a197022b5858','photo-1513584684374-8bab748fbf90','photo-1505691938895-1758d7feb511','photo-1600607687939-ce8a6c25118c'],
  tech: ['photo-1518770660439-4636190af475','photo-1488590528505-98d2b5aba04b','photo-1461749280684-dccba630e2f6','photo-1504639725590-34d0984388bd','photo-1551434678-e076c223a692','photo-1542744173-8e7e53415bb0','photo-1486312338219-ce68d2c6f44d','photo-1498050108023-c5249f4df085','photo-1531297484001-80022131f5a1','photo-1519389950473-47ba0277781c','photo-1600880292203-757bb62b4baf','photo-1560472355-536de3962603','photo-1553877522-43269d4ea984','photo-1573164713714-d95e436ab8d6','photo-1522071820081-009f0129c71c'],
  general: ['photo-1460925895917-afdab827c52f','photo-1519389950473-47ba0277781c','photo-1522071820081-009f0129c71c','photo-1454165804606-c3d57bc86b40','photo-1531403009284-440f080d1e12','photo-1486406146926-c627a92ad1ab','photo-1516321318423-f06f85e504b3','photo-1551836022-d5d88e9218df','photo-1507238691740-187a5b1d37b8','photo-1531538606174-0f90ff5dce83','photo-1522202176988-66273c2fd55f','photo-1497366216548-37526070297c','photo-1497215728101-856f4ea42174','photo-1504384308090-c894fdcc538d','photo-1517245386807-bb43f82c33c4'],
};

function regexCategory(text: string): string {
  const t = text.toLowerCase();
  if (/playa|lote|terreno|vacaci|resort|tropical|caribe|costa|para[ií]so|bungal|arena|oc[eé]ano|playa|riviera|frente al mar/i.test(t)) return 'beach';
  if (/pizza|comida|restaurante|pupusa|taco|burger|sushi|hamburguesa/i.test(t)) return 'food';
  if (/dental|dentista|diente|odontolog/i.test(t)) return 'dental';
  if (/doctor|m[eé]dico|farmacia|medicina|salud|hospital|cl[ií]nica|pediatra/i.test(t)) return 'medical';
  if (/belleza|salon|spa|maquillaje|cabello|peluquer/i.test(t)) return 'beauty';
  if (/gym|gimnasio|fitness|ejercicio|entrenamiento/i.test(t)) return 'gym';
  if (/casa|inmobiliaria|propiedad|apartamento|bienes ra[ií]ces|construcci/i.test(t)) return 'realestate';
  if (/crm|software|saas|tecnolog|digital|startup|ecommerce|app/i.test(t)) return 'tech';
  return 'general';
}

const REGEX_TERMS: Record<string, string> = {
  beach: 'tropical beach paradise ocean',
  food: 'delicious food restaurant meal',
  dental: 'dental clinic smile teeth',
  medical: 'medical healthcare doctor clinic',
  beauty: 'beauty salon spa hair',
  gym: 'gym fitness workout exercise',
  realestate: 'modern house real estate property',
  tech: 'technology software digital innovation',
  general: 'professional business advertising',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, prompt, industria, oferta, tono, idioma = 'es', images, industry } = body;
    const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';

    // ── SEARCH PHOTOS ─────────────────────────────────────────────────────────
    if (action === 'search-photos') {
      if (!prompt) {
        return new Response(JSON.stringify({ error: 'Falta el prompt' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const unsplashKey = Deno.env.get('UNSPLASH_ACCESS_KEY') || '';

      // Clean prompt — remove structural labels before sending to GPT
      const cleanPrompt = prompt
        .replace(/titulo:|subtitulo:|sub.?titulo:|cta:|incluye:|precio:|beneficios:|descripcion:|gancho:|oferta:/gi, '')
        .replace(/\s+/g, ' ').trim().substring(0, 300);

      // Step 1: Regex detects known categories FIRST (fast, guaranteed correct)
      // This covers beach, food, gym, etc. regardless of how the brief is worded
      const detectedCat = regexCategory(cleanPrompt + ' ' + (industry || ''));
      let searchTerms = detectedCat !== 'general' ? REGEX_TERMS[detectedCat] : '';

      // Step 2: GPT only for truly unknown topics (galaxia, hormiga, lapiz, etc.)
      if (!searchTerms && openaiKey) {
        try {
          const r = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: 'Extract 3-4 English keywords for Unsplash photo search that match the visual theme. Return ONLY the keywords. Examples: "hormiga" → "ant insect macro", "galaxia" → "galaxy stars space", "lapiz" → "pencils colorful art".',
                },
                { role: 'user', content: cleanPrompt }
              ],
              max_tokens: 20, temperature: 0,
            }),
          });
          if (r.ok) {
            const d = await r.json();
            const kw = d.choices?.[0]?.message?.content?.trim();
            if (kw && kw.length > 2) searchTerms = kw;
          }
        } catch (_) {}
      }

      // Step 3: Final fallback if everything failed
      if (!searchTerms) searchTerms = REGEX_TERMS.general;

      // Step 3: Unsplash Search API
      let photos: string[] = [];
      if (unsplashKey) {
        try {
          const res = await fetch(
            `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchTerms)}&per_page=15`,
            { headers: { 'Authorization': `Client-ID ${unsplashKey}` } }
          );
          if (res.ok) {
            const d = await res.json();
            photos = (d.results || []).map((p: any) => p.urls.regular);
          }
        } catch (_) {}
      }

      // Step 4: Hardcoded fallback if Unsplash fails
      if (photos.length < 4) {
        const cat = regexCategory((prompt || '') + ' ' + (industry || ''));
        const ids = HARDCODED[cat] || HARDCODED.general;
        photos = ids.map(id => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1080&q=80`);
      }

      return new Response(JSON.stringify({ photos }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── GENERATE IDEAS ────────────────────────────────────────────────────────
    if (!oferta) {
      return new Response(JSON.stringify({ error: 'Falta la descripción de la oferta' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!openaiKey) {
      return new Response(JSON.stringify({ ideas: getFallbackIdeas(industria, oferta, tono) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const gptPrompt = `Analiza la oferta comercial y el rubro provisto y genera exactamente 3 ideas diferentes, creativas y altamente persuasivas para flyers publicitarios de redes sociales.
    
    Rubro/Industria: ${industria}
    Oferta Comercial: ${oferta}
    Tono de la Marca: ${tono}
    Idioma de respuesta: ${idioma === 'es' ? 'Español salvadoreño / latinoamericano natural' : 'Inglés'}

    Para cada idea define:
    1. titulo: Título principal llamativo, corto e impactante (máximo 4-5 palabras).
    2. gancho: Subtítulo o frase de enganche persuasiva (máximo 1 oración).
    3. beneficios: Lista de exactamente 3 beneficios clave. Cortos y contundentes.
    4. tono: El tono utilizado.
    5. cta: Llamado a la acción persuasivo. NUNCA inventes precios ni descuentos si el usuario no los incluyó.
    6. paleta: Lista de 2-3 colores en hexadecimal que representen visualmente el tono.

    Responde SOLO con un objeto JSON con la clave "ideas" que contenga un arreglo de 3 objetos. Sin markdown ni explicaciones.`;

    const userContent: any[] = [{ type: 'text', text: gptPrompt }];
    if (images && Array.isArray(images)) {
      for (const img of images) userContent.push({ type: 'image_url', image_url: { url: img } });
    }
    if (images && images.length > 0) {
      userContent[0].text += ' Además, analiza las imágenes adjuntas y alinea los conceptos con lo que se muestra en ellas.';
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Eres un redactor creativo senior y experto en marketing y diseño gráfico publicitario para redes sociales en América Latina.' },
          { role: 'user', content: userContent }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8
      })
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ ideas: getFallbackIdeas(industria, oferta, tono) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    const ideas = parsed.ideas || getFallbackIdeas(industria, oferta, tono);

    return new Response(JSON.stringify({ ideas }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function getFallbackIdeas(industria = 'Servicios', oferta = '', tono = 'premium') {
  const colors: Record<string, string[]> = {
    premium: ['#7c3aed', '#f59e0b', '#1e293b'],
    urgente: ['#ef4444', '#1e293b', '#f59e0b'],
    moderno: ['#0ea5e9', '#10b981', '#0f172a'],
    amigable: ['#ec4899', '#f59e0b', '#3b82f6'],
    corporativo: ['#1a56db', '#475569', '#1e293b'],
  };
  const c = colors[tono] || colors.premium;
  return [
    { titulo: `${industria.toUpperCase()} PREMIUM`, gancho: 'La mejor solución premium para tu negocio.', beneficios: ['Atención 100% personalizada', 'Materiales de alta durabilidad', 'Garantía real por escrito'], cta: 'QUIERO SABER MÁS', paleta: c, tono },
    { titulo: 'PROMOCIÓN EXCLUSIVA', gancho: `Aprovecha hoy el beneficio exclusivo en ${industria}.`, beneficios: ['Descuento único por lanzamiento', 'Facilidades de pago flexibles', 'Soporte técnico preferencial'], cta: 'RESERVAR OFERTA', paleta: [c[1] || '#f59e0b', c[0] || '#7c3aed'], tono },
    { titulo: 'EL CAMBIO QUE BUSCABAS', gancho: 'Optimiza tus resultados con la oferta definitiva del mercado.', beneficios: ['Ahorro significativo en costos', 'Procesos automatizados', 'Asesoría técnica incluida'], cta: 'COMENZAR AHORA', paleta: [c[2] || '#1e293b', c[1] || '#f59e0b'], tono },
  ];
}
