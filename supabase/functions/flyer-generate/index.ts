// @ts-nocheck
// flyer-generate v1.0 — AI Graphic Asset Generator
// Routes: POST / (generates high-fidelity background image for flyers using DALL-E 3)

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
    const { idea, industria, oferta, tono, customPrompt } = await req.json();

    if (!industria) {
      return new Response(JSON.stringify({ error: 'Falta la industria o rubro' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';
    if (!openaiKey) {
      console.warn('OPENAI_API_KEY no configurado en Deno. Usando Unsplash Fallback.');
      return new Response(JSON.stringify({ fondo_url: getUnsplashFallback(industria) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prompt sumamente optimizado para DALL-E 3
    // Regla crucial: "no text", "no words", "space for copy", "studio photography"
    let imagePrompt = '';
    if (customPrompt) {
      imagePrompt = `${customPrompt}. Professional, high-end commercial studio photography. Modern, clean, atmospheric lighting, soft shadows, extremely high detail. Composition: Perfect background for advertising, plenty of negative space for overlay text. CRITICAL RULE: DO NOT write any text, letters, words, typos, characters, brand logos, or watermarks. Absolutely NO text in the image.`;
    } else {
      imagePrompt = `Professional, high-end commercial studio photography representing the sector of: ${industria}.
    Theme/Concept: ${idea?.titulo || 'Business'} - ${idea?.gancho || oferta}.
    Visual Style: Modern, clean, atmospheric lighting, soft shadows, extremely high detail. Elegant and minimal.
    Composition: Perfect background for advertising. It must have plenty of negative space and clean areas for placing overlay text. The main elements should be artistically positioned on one side or bottom.
    CRITICAL RULE: DO NOT write any text, letters, words, typos, characters, brand logos, or watermarks. Absolutely NO text in the image. Pure conceptual clean background.`;
    }

    let res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: imagePrompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard'
      })
    });

    let data;
    if (!res.ok) {
      const errText = await res.text();
      console.warn('DALL-E 3 failed, trying DALL-E 2. Error:', errText);
      
      // Fallback to DALL-E 2
      res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'dall-e-2',
          prompt: imagePrompt.substring(0, 950), // DALL-E 2 has a shorter prompt limit (1000 chars)
          n: 1,
          size: '1024x1024'
        })
      });

      if (!res.ok) {
        const errText2 = await res.text();
        console.error('DALL-E 2 failed as well. Error:', errText2);
        return new Response(JSON.stringify({ fondo_url: getUnsplashFallback(industria) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    data = await res.json();
    const fondo_url = data.data?.[0]?.url;

    if (!fondo_url) {
      return new Response(JSON.stringify({ fondo_url: getUnsplashFallback(industria) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ fondo_url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error general en flyer-generate:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Fallbacks dinámicos e hiper-realistas usando Unsplash Source
function getUnsplashFallback(industria = '') {
  const norm = industria.toLowerCase();
  
  if (norm.includes('inmobiliaria') || norm.includes('bienes raíces') || norm.includes('propiedad') || norm.includes('terreno') || norm.includes('casa')) {
    return 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1080&auto=format&fit=crop';
  }
  if (norm.includes('comida') || norm.includes('restaurante') || norm.includes('café') || norm.includes('pastelería') || norm.includes('panadería')) {
    return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1080&auto=format&fit=crop';
  }
  if (norm.includes('médico') || norm.includes('salud') || norm.includes('dental') || norm.includes('clínica') || norm.includes('odontología') || norm.includes('farmacia') || norm.includes('medicina') || norm.includes('doctor') || norm.includes('hospital') || norm.includes('bienestar') || norm.includes('remedio') || norm.includes('medicamento') || norm.includes('pastillas') || norm.includes('wellness')) {
    return 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?q=80&w=1080&auto=format&fit=crop';
  }
  if (norm.includes('gimnasio') || norm.includes('fit') || norm.includes('deporte') || norm.includes('entrenamiento')) {
    return 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=1080&auto=format&fit=crop';
  }
  if (norm.includes('auto') || norm.includes('taller') || norm.includes('car') || norm.includes('vehículo')) {
    return 'https://images.unsplash.com/photo-1617788138017-80ad40651399?q=80&w=1080&auto=format&fit=crop';
  }
  if (norm.includes('factura') || norm.includes('contabilidad') || norm.includes('finanzas') || norm.includes('tributo') || norm.includes('impuesto') || norm.includes('billing') || norm.includes('contador') || norm.includes('declaración') || norm.includes('declaracion') || norm.includes('pyme')) {
    return 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=1080&auto=format&fit=crop';
  }
  if (norm.includes('tecnología') || norm.includes('software') || norm.includes('computación') || norm.includes('digital')) {
    return 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=1080&auto=format&fit=crop';
  }
  if (norm.includes('belleza') || norm.includes('spa') || norm.includes('peluquería') || norm.includes('estética')) {
    return 'https://images.unsplash.com/photo-1560750588-73207b1ef5b8?q=80&w=1080&auto=format&fit=crop';
  }
  if (norm.includes('educación') || norm.includes('escuela') || norm.includes('curso') || norm.includes('universidad')) {
    return 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1080&auto=format&fit=crop';
  }

  // Fallback general premium (fondo abstracto y elegante de oficina/marketing)
  return 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1080&auto=format&fit=crop';
}
