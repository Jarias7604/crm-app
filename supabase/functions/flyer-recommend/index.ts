// @ts-nocheck
// flyer-recommend v1.0 — AI Flyer Idea Generator
// Routes: POST / (generates creative flyer ideas based on industry, offer and tone)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, prompt, industria, oferta, tono, idioma = 'es', images, industry } = body;

    const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';

    // Handle dynamic photo search
    if (action === 'search-photos') {
      if (!prompt) {
        return new Response(JSON.stringify({ error: 'Falta el prompt de búsqueda' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Use curated category matching directly — Unsplash HTML scraping is unreliable
      // (returns random page images, not search results). Categories cover all major industries.
      let uniquePhotos: string[] = [];
      {
        const categories: Record<string, string[]> = {
          food: [
            'photo-1513104890138-7c749659a591',
            'photo-1504674900247-0877df9cc836',
            'photo-1565299624946-b28f40a0ae38',
            'photo-1568901346375-23c9450c58cd',
            'photo-1579871494447-9811cf80d66c',
            'photo-1565299585323-38d6b0865b47',
            'photo-1512621776951-a57141f2eefd',
            'photo-1544025162-d76694265947',
            'photo-1563379091339-03b21ab4a4f8',
            'photo-1578985545062-69928b1d9587',
            'photo-1555396273-367ea4eb4db5',
            'photo-1540189549336-e6e99c3679fe',
            'photo-1482049016688-2d3e1b311543',
            'photo-1484723091739-30a097e8f929',
            'photo-1567620905732-2d1ec7ab7445'
          ],
          dental: [
            'photo-1629909613654-28e377c37b09',
            'photo-1588776814546-1ffcf47267a5',
            'photo-1471864190281-a93a3070b6de',
            'photo-1579684389782-64d84b5e901a',
            'photo-1598256989800-fe5f95da9787',
            'photo-1606811971618-4486d14f3f99',
            'photo-1629909615184-74f495363b67',
            'photo-1560185007-c5ca9d2c014d',
            'photo-1468495244123-6c6c332eeece',
            'photo-1596462502278-27bfdc403348',
            'photo-1460157491444-f1a517793577',
            'photo-1512223792601-592a9809eed4',
            'photo-1552566626-52f8b828add9',
            'photo-1576765608535-5f04d1e3f289',
            'photo-1516549655169-df83a0774514'
          ],
          medical: [
            'photo-1622253692010-333f2da6031d',
            'photo-1559839734-2b71ea197ec2',
            'photo-1586015555751-63bb77f4322a',
            'photo-1576091160550-2173dba999ef',
            'photo-1607619056574-7b8d304a3b24',
            'photo-1537368910025-700350fe46c7',
            'photo-1584515906207-523b4c207da7',
            'photo-1476480862126-209bfaa8edc8',
            'photo-1516549655169-df83a0774514',
            'photo-1519494026892-80bbd2d6fd0d',
            'photo-1505751172876-fa1923c5c528',
            'photo-1527613426441-4da17471b66d',
            'photo-1551076805-e1869033e561',
            'photo-1579684389782-64d84b5e901a',
            'photo-1631815541552-b5848c1a596c'
          ],
          defense: [
            'photo-1555597673-b21d5c935865',
            'photo-1544045560-723f24137ade',
            'photo-1509198397868-475647b2a1e5',
            'photo-1599058917212-d750089bc07e',
            'photo-1557597774-9d273605dfa9',
            'photo-1563986768609-322da13575f3',
            'photo-1517649763962-0c623066013b',
            'photo-1551854838-212c50b4c184',
            'photo-1501724391406-81a1bbbaeb28',
            'photo-1579758629938-03607ccdbaba',
            'photo-1495364141860-b0d03eccd065',
            'photo-1521295121783-8a321d551ad2',
            'photo-1600585154526-990dced4db0d',
            'photo-1508962914676-134849a727f0',
            'photo-1614064641938-3bbee52942c7'
          ],
          auto: [
            'photo-1486006920555-c77dce18193b',
            'photo-1619642751034-765dfdf7c58e',
            'photo-1517524206127-48bbd363f3d7',
            'photo-1507767439269-2c64f107e609',
            'photo-1511919884226-fd3cad34687c',
            'photo-1601362840469-51e4d8d59085',
            'photo-1580273916550-e323be2ae537',
            'photo-1530047139182-5485141a7265',
            'photo-1568605117036-5fe5e7bab0b7',
            'photo-1492144534655-ae79c964c9d7',
            'photo-1617886322168-72b886573c3c',
            'photo-1616788494707-ec28f08d05a1',
            'photo-1506015391300-4802dc74de2e',
            'photo-1516575150278-77136aed6920',
            'photo-1525609004556-c46c7d6cf0a3'
          ],
          beauty: [
            'photo-1560066984-138dadb4c035',
            'photo-1522337360788-8b13dee7a37e',
            'photo-1607779097040-26e80aa78e66',
            'photo-1519699047748-de8e457a634e',
            'photo-1604654894610-df63bc536371',
            'photo-1540555700478-4be289fbecef',
            'photo-1582095133179-bfd08e2fc6b3',
            'photo-1512290923902-8a9f81dc236c',
            'photo-1596462502278-27bfdc403348',
            'photo-1562322140-8baeececf3df',
            'photo-1616394584738-fc6e612e71b9',
            'photo-1527799820374-dcf8d9d4a438',
            'photo-1500840216050-6ffa99d7cd76',
            'photo-1515377905703-c4788e51af15',
            'photo-1590156546746-c23109b257c3'
          ],
          gym: [
            'photo-1517838277536-f5f99be501cd',
            'photo-1534438327276-14e5300c3a48',
            'photo-1541534741688-6078c6bfb5c5',
            'photo-1571902943202-507ec2618e8f',
            'photo-1605296867304-46d5465a25f1',
            'photo-1476480862126-209bfaa8edc8',
            'photo-1526506118085-60ce8714f8c5',
            'photo-1517963879433-6ad2b056d712',
            'photo-1518611012118-696072aa579a',
            'photo-1549719386-74dfcbf7dbed',
            'photo-1593079831268-3381b0db4a77',
            'photo-1574680096145-d05b474e2155',
            'photo-1594381898411-846e7d193883',
            'photo-1584735935682-2f2b69dff9d2',
            'photo-1518310383802-64c2de311b2'
          ],
          legal: [
            'photo-1589829545856-d10d557cf95f',
            'photo-1505664194779-8bebcb95c02e',
            'photo-1453728013993-6d66e9c9123a',
            'photo-1521587760476-6c12a4b040da',
            'photo-1450133064473-71024230f91b',
            'photo-1521791136368-1a46827d06e5',
            'photo-1507679799987-c73779587ccf',
            'photo-1447069387593-a5de0862481e',
            'photo-1589829085413-56de8ae18c73',
            'photo-1455390582262-044cdead277a',
            'photo-1425421598808-4a22ce59cc97',
            'photo-1486406146926-c627a92ad1ab',
            'photo-1497366216548-37526070297c',
            'photo-1551836022-d5d88e9218df',
            'photo-1516321318423-f06f85e504b3'
          ],
          cafe: [
            'photo-1501339847302-ac426a4a7cbb',
            'photo-1495474472287-4d71bcdd2085',
            'photo-1509042239860-f550ce710b93',
            'photo-1514432324607-a09d9b4aefdd',
            'photo-1442512595331-e89e73853f31',
            'photo-1555507036-ab1f4038808a',
            'photo-1554118811-1e0d58224f24',
            'photo-1507133750040-4a8f57021571',
            'photo-1511920170033-f8396924c348',
            'photo-1509440159596-0249088772ff',
            'photo-1497935586351-b67a49e012bf',
            'photo-1517256064527-09c53b2d0bc6',
            'photo-1521017432531-fbd92d768814',
            'photo-1498804103079-a6351b050096',
            'photo-1558961309-dbdf000a127b'
          ],
          realestate: [
            'photo-1560518883-ce09059eeffa',
            'photo-1512917774080-9991f1c4c750',
            'photo-1564013799919-ab600027ffc6',
            'photo-1600585154340-be6161a56a0c',
            'photo-1600210492486-724fe5c67fb0',
            'photo-1560520653-9e0e4c89eb11',
            'photo-1600596542815-ffad4c1539a9',
            'photo-1504307651254-35680f356dfd',
            'photo-1522708323590-d24dbb6b0267',
            'photo-1582407947304-fd86f028f716',
            'photo-1502672260266-1c1ef2d93688',
            'photo-1484154218962-a197022b5858',
            'photo-1513584684374-8bab748fbf90',
            'photo-1505691938895-1758d7feb511',
            'photo-1600607687939-ce8a6c25118c'
          ],
          pets: [
            'photo-1583511655857-d19b40a7a54e',
            'photo-1543466835-00a7907e9de1',
            'photo-1514888286974-6c03e2ca1dba',
            'photo-1576201836106-db1758fd1c97',
            'photo-1535268647977-a403b69fc756',
            'photo-1552053831-71594a27632d',
            'photo-1533738363-b7f9aef128ce',
            'photo-1628009368231-7bb7cfcb0def',
            'photo-1516734212186-a967f81ad0d7',
            'photo-1585110396000-c9ffd4e4b308',
            'photo-1450778869180-41d0601e046e',
            'photo-1548199973-03cce0bbc87b',
            'photo-1504595403659-9088ce801e29',
            'photo-1518791841217-8f162f1e1131',
            'photo-1530281700549-e82e7bf110d6'
          ],
          education: [
            'photo-1523050854058-8df90110c9f1',
            'photo-1427504494785-3a9ca7044f45',
            'photo-1503676260728-1c00da094a0b',
            'photo-1509062522246-3755977927d7',
            'photo-1497633762265-9d179a990aa6',
            'photo-1516321318423-f06f85e504b3',
            'photo-1535982330050-f1c2ee7cddab',
            'photo-1577896851231-70ef18881754',
            'photo-1557672172-298e090bd0f1',
            'photo-1576086213369-97a306d36557',
            'photo-1501504905252-473c47e087f8',
            'photo-1434030216411-0b793f4b4173',
            'photo-1524995997946-a1c2e315a42f',
            'photo-1522202176988-66273c2fd55f',
            'photo-1507537297725-24a1c029d3ca'
          ],
          cleaning: [
            'photo-1581578731548-c64695cc6952',
            'photo-1527515637462-cff94eecc1ac',
            'photo-1563453392212-326f5e854473',
            'photo-1584820927498-cfe5211fd8bf',
            'photo-1545173168-9f1947e80135',
            'photo-1581578732697-761a308876e6',
            'photo-1558317374-067fb5f30001',
            'photo-1528740561666-ac2479e00021',
            'photo-1507652313519-d4e9174996dd',
            'photo-1603796846097-bee99e4a60c9',
            'photo-1556742049-0cfed4f6a45d',
            'photo-1582738411706-bfc8e691d1c2',
            'photo-1583907608452-715d716254d5',
            'photo-1607082348824-0a96f2a4b9da',
            'photo-1518349619113-03114f06ac3a'
          ],
          yoga: [
            'photo-1544367567-0f2fcb009e0b',
            'photo-1506126613408-eca07ce68773',
            'photo-1508672019048-805c876b67e2',
            'photo-1518611012118-696072aa579a',
            'photo-1575052814086-f385e2e2ad1b',
            'photo-1608571423902-eed4a5ad8108',
            'photo-1518241353330-0f7941c2d9b5',
            'photo-1515377905703-c4788e51af15',
            'photo-1576092768241-dec231879fc3',
            'photo-1592432678016-e910b452f9a2',
            'photo-1545205597-3d9d02c29597',
            'photo-1512438248247-f0f2a5a8b7f0',
            'photo-1599447421416-3414500d18a5',
            'photo-1518241423405-7c0098aa9920',
            'photo-1529693662653-9d4e9174996dd'
          ],
          accounting: [
            'photo-1554224155-8d04cb21cd6c',
            'photo-1454165804606-c3d57bc86b40',
            'photo-1579621970563-ebec7560ff3e',
            'photo-1460925895917-afdab827c52f',
            'photo-1580519542036-c47de6196ba5',
            'photo-1544377193-33dcf4d68fb5',
            'photo-1526304640581-d334cdbbf45e',
            'photo-1586486855514-8c633cc6fa98',
            'photo-1551836022-d5d88e9218df',
            'photo-1559526324-4b87b5e36e44',
            'photo-1542838132-92c53300491e',
            'photo-1502945015378-0e284029ddf8',
            'photo-1521898284481-a5ec348cb555',
            'photo-1518186285589-2f7649de83e0',
            'photo-1504868584819-f8e8b4b6d7e3'
          ],
          hardware: [
            'photo-1581244277943-fe4a9c777189',
            'photo-1530124560072-aec9361891df',
            'photo-1504148455328-c376907d081c',
            'photo-1513694203232-719a280e022f',
            'photo-1534224039826-c7a0dea0e66a',
            'photo-1562259949-e8e7689d7828',
            'photo-1497366216548-37526070297c',
            'photo-1504307651254-35680f356dfd',
            'photo-1621905251189-08b45d6a269e',
            'photo-1586864387967-d02ef85d93e8',
            'photo-1504222490345-c075b6008014',
            'photo-1518770660439-4636190af475',
            'photo-1567306226416-28f0efdc888a',
            'photo-1608613304899-ea8098577e38',
            'photo-1426927308491-6380b6a9936f'
          ],
          general: [
            'photo-1460925895917-afdab827c52f',
            'photo-1519389950473-47ba0277781c',
            'photo-1522071820081-009f0129c71c',
            'photo-1454165804606-c3d57bc86b40',
            'photo-1531403009284-440f080d1e12',
            'photo-1486406146926-c627a92ad1ab',
            'photo-1516321318423-f06f85e504b3',
            'photo-1551836022-d5d88e9218df',
            'photo-1507238691740-187a5b1d37b8',
            'photo-1531538606174-0f90ff5dce83',
            'photo-1522202176988-66273c2fd55f',
            'photo-1497366216548-37526070297c',
            'photo-1497215728101-856f4ea42174',
            'photo-1504384308090-c894fdcc538d',
            'photo-1517245386807-bb43f82c33c4'
          ],
          tech: [
            'photo-1518770660439-4636190af475',
            'photo-1488590528505-98d2b5aba04b',
            'photo-1461749280684-dccba630e2f6',
            'photo-1504639725590-34d0984388bd',
            'photo-1551434678-e076c223a692',
            'photo-1522071820081-009f0129c71c',
            'photo-1542744173-8e7e53415bb0',
            'photo-1486312338219-ce68d2c6f44d',
            'photo-1498050108023-c5249f4df085',
            'photo-1531297484001-80022131f5a1',
            'photo-1519389950473-47ba0277781c',
            'photo-1600880292203-757bb62b4baf',
            'photo-1560472355-536de3962603',
            'photo-1553877522-43269d4ea984',
            'photo-1573164713714-d95e436ab8d6'
          ]
        };

        const lower = ((prompt || '') + ' ' + (industry || '')).toLowerCase();
        let chosenCategory = 'general';

        if (/\b(pizza|comida|restaurante|food|pupusa|pupusas|taco|tacos|burger|hamburguesa|sushi)\b/i.test(lower)) {
          chosenCategory = 'food';
        } else if (/\b(crm|software|saas|aplicaci[oó]n|app|sistema|tecnolog[íi]a|digital|ventas en l[íi]nea|marketing digital|embudos|pipeline|automatizaci[oó]n|analytics|plataforma|startup|desarrollador|programaci[oó]n|web|ecommerce|e-commerce|inteligencia artificial|ia)\b/i.test(lower)) {
          chosenCategory = 'tech';
        } else if (/\b(dentista|dental|diente|dientes|cl[íi]nica dental|odontolog[íi]a)\b/i.test(lower)) {
          chosenCategory = 'dental';
        } else if (/\b(doctor|doctores|m[eé]dico|m[eé]dicos|farmacia|farmacias|medicina|medicinas|salud|hospital|hospitales|cl[íi]nica|medical|consultorio|pediatra|terapia|enfermera)\b/i.test(lower)) {
          chosenCategory = 'medical';
        } else if (/\b(defensa|karate|marciales|taekwondo)\b/i.test(lower)) {
          chosenCategory = 'defense';
        } else if (/\b(belleza|salon|sal[oó]n|u[ñn]as|spa|maquillaje|cabello|peluquer[íi]a)\b/i.test(lower)) {
          chosenCategory = 'beauty';
        } else if (/\b(gym|gimnasio|fit|fitness|ejercicio|entrenamiento)\b/i.test(lower)) {
          chosenCategory = 'gym';
        } else if (/\b(abogado|legal|firma|leyes|derecho)\b/i.test(lower)) {
          chosenCategory = 'legal';
        } else if (/\b(cafe|café|panaderia|panader[íi]a|reposter[íi]a|dulce|cafeter[íi]a)\b/i.test(lower)) {
          chosenCategory = 'cafe';
        } else if (/\b(casa|inmobiliaria|apartamento|hogar|propiedad|real estate|construcci[oó]n)\b/i.test(lower)) {
          chosenCategory = 'realestate';
        } else if (/\b(perro|gato|mascota|veterinario|veterinaria|animal)\b/i.test(lower)) {
          chosenCategory = 'pets';
        } else if (/\b(educacion|educaci[oó]n|escuela|colegio|curso|clases|estudiar)\b/i.test(lower)) {
          chosenCategory = 'education';
        } else if (/\b(limpieza|lavado|limpiar|planchado|orden)\b/i.test(lower)) {
          chosenCategory = 'cleaning';
        } else if (/\b(yoga|wellness|meditaci[oó]n|relajaci[oó]n)\b/i.test(lower)) {
          chosenCategory = 'yoga';
        } else if (/\b(contable|finanzas|dinero|taxes|impuestos|accounting)\b/i.test(lower)) {
          chosenCategory = 'accounting';
        } else if (/\b(ferreter[íi]a|herramienta|herramientas|tornillo|martillo|carpinter[íi]a|brocha|tools)\b/i.test(lower)) {
          chosenCategory = 'hardware';
        } else if (/\b(taller|carro|carros|veh[íi]culo|mec[aá]nico|repuestos|automotriz)\b/i.test(lower)) {
          chosenCategory = 'auto';
        }

        const photoIds = categories[chosenCategory] || categories.general;
        uniquePhotos = photoIds.map(id => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1080&q=80`);
      }

      return new Response(JSON.stringify({ photos: uniquePhotos }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!oferta) {
      return new Response(JSON.stringify({ error: 'Falta la descripción de la oferta' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!openaiKey) {
      // Fallback local robusto por si no hay API key configurada
      return new Response(JSON.stringify({ ideas: getFallbackIdeas(industria, oferta, tono) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const gptPrompt = `Analiza la oferta comercial y el rubro provisto por el usuario y genera exactamente 3 ideas diferentes, creativas y altamente persuasivas para flyers publicitarios de redes sociales.
    
    Rubro/Industria: ${industria}
    Oferta Comercial: ${oferta}
    Tono de la Marca: ${tono}
    Idioma de respuesta: ${idioma === 'es' ? 'Español salvadoreño / latinoamericano natural' : 'Inglés'}

    Para cada una de las 3 ideas debes definir:
    1. titulo: Un título principal llamativo, corto e impactante (máximo 4 a 5 palabras).
    2. gancho: Un subtítulo o frase de enganche súper persuasiva que conecte con la necesidad del cliente (máximo 1 oración).
    3. beneficios: Una lista de exactamente 3 beneficios o características clave del producto/servicio. Cortas y contundentes.
    4. tono: El tono utilizado (debe encajar con el tono provisto).
    5. cta: Un texto de llamado a la acción persuasivo (ej: 'QUIERO MI DESCUENTO', 'REGISTRARME HOY', 'COMPRAR AHORA'). ATENCIÓN: NUNCA inventes precios, ni porcentajes de descuento (como 30% OFF o $12.95/mes) si el usuario NO los ha incluido explícitamente en la 'Oferta Comercial'.
    6. paleta: Una lista de exactamente 2 o 3 colores complementarios en formato hexadecimal (ej: ["#7c3aed", "#10b981"]) que representen visualmente el tono de la marca. Evita colores invisibles como el blanco puro si no es de contraste.

    Devuelve la respuesta estrictamente como un objeto JSON con la clave "ideas" que contenga un arreglo de 3 objetos con las propiedades indicadas. No agregues explicaciones externas ni markdown de código.`;

    const userContent: any[] = [{ type: 'text', text: gptPrompt }];

    if (images && Array.isArray(images)) {
      for (const img of images) {
        userContent.push({
          type: 'image_url',
          image_url: { url: img }
        });
      }
    }

    if (images && images.length > 0) {
      const visualPrompt = ` Además, analiza las imágenes adjuntas. Los anuncios y conceptos de flyers generados deben alinearse visualmente y conceptualmente con lo que se muestra en estas fotos (ej: si son computadoras, oficinas, o productos específicos). El título y gancho deben complementar de manera lógica y atractiva lo que se observa en las imágenes.`;
      userContent[0].text += visualPrompt;
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
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
      const errText = await res.text();
      console.error('OpenAI Error:', errText);
      return new Response(JSON.stringify({ ideas: getFallbackIdeas(industria, oferta, tono) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    const parsedContent = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    const ideas = parsedContent.ideas || getFallbackIdeas(industria, oferta, tono);

    return new Response(JSON.stringify({ ideas }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error general:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Lógica de Fallback de Alta Fidelidad
function getFallbackIdeas(industria = 'Servicios', oferta = '', tono = 'premium') {
  const defaultColors = {
    premium: ['#7c3aed', '#f59e0b', '#1e293b'],
    urgente: ['#ef4444', '#1e293b', '#f59e0b'],
    moderno: ['#0ea5e9', '#10b981', '#0f172a'],
    amigable: ['#ec4899', '#f59e0b', '#3b82f6'],
    corporativo: ['#1a56db', '#475569', '#1e293b']
  };

  const colors = defaultColors[tono] || defaultColors.premium;

  return [
    {
      titulo: `${industria.toUpperCase()} PREMIUM`,
      gancho: `La mejor solución y atención premium para tu negocio.`,
      beneficios: [
        'Atención 100% personalizada',
        'Materiales de alta durabilidad',
        'Garantía real por escrito'
      ],
      cta: 'QUIERO SABER MÁS',
      paleta: colors,
      tono
    },
    {
      titulo: 'PROMOCIÓN EXCLUSIVA',
      gancho: `Aprovecha hoy el beneficio exclusivo en ${industria}.`,
      beneficios: [
        'Descuento único por lanzamiento',
        'Facilidades de pago flexibles',
        'Soporte técnico preferencial'
      ],
      cta: 'RESERVAR OFERTA',
      paleta: [colors[1] || '#f59e0b', colors[0] || '#7c3aed'],
      tono
    },
    {
      titulo: 'EL CAMBIO QUE BUSCABAS',
      gancho: `Optimiza tus resultados con la oferta definitiva del mercado.`,
      beneficios: [
        'Ahorro del 30% en costos',
        'Procesos automatizados',
        'Asesoría técnica de por vida'
      ],
      cta: 'COMENZAR AHORA',
      paleta: [colors[2] || '#1e293b', colors[1] || '#f59e0b'],
      tono
    }
  ];
}
