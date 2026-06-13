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
    const { industria, oferta, tono, idioma = 'es', images } = await req.json();

    if (!oferta) {
      return new Response(JSON.stringify({ error: 'Falta la descripción de la oferta' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';
    if (!openaiKey) {
      // Fallback local robusto por si no hay API key configurada
      return new Response(JSON.stringify({ ideas: getFallbackIdeas(industria, oferta, tono) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = `Analiza la oferta comercial y el rubro provisto por el usuario y genera exactamente 3 ideas diferentes, creativas y altamente persuasivas para flyers publicitarios de redes sociales.
    
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

    const userContent: any[] = [{ type: 'text', text: prompt }];

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
