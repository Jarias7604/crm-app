// @ts-nocheck
// flyer-ai-generator v2.0 — Premium AI Flyer Engine using gpt-image-1
// Replaces: flyer-generate (DALL-E 3 background only)
// This generates complete, ready-to-publish marketing flyers with text, design, and branding.
//
// POST /flyer-ai-generator
// Body: {
//   prompt: string,           // user's description of what to promote
//   company_name: string,
//   tagline?: string,
//   cta?: string,             // call to action text
//   colors?: string[],        // brand color hex values
//   format: string,           // 'ig-post'|'ig-portrait'|'fb-post'|'fb-cover'|'story'
//   tone?: string,            // 'premium'|'urgente'|'moderno'|'amigable'|'corporativo'
//   logo_url?: string,        // company logo URL (included in prompt context)
//   reference_urls?: string[],// reference images for style
//   variant_count: 1|2|3,     // how many variants to generate
//   company_id: string,
// }
//
// Returns: { variants: string[], credits_remaining: number }

// Supabase Edge Function config — extend timeout to 150s for AI image generation
export const config = { runtime: 'edge', maxDuration: 150 };

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Format → gpt-image-1 size mapping ─────────────────────────────────────────
const FORMAT_SIZES: Record<string, string> = {
  'ig-post': '1024x1024',
  'ig-portrait': '1024x1536',
  'ig-story': '1024x1536',
  'fb-post': '1024x1024',
  'fb-cover': '1536x1024',
  'li-post': '1536x1024',
  'li-square': '1024x1024',
  'tw-post': '1536x1024',
  'yt-thumb': '1536x1024',
  'pinterest': '1024x1536',
  'story': '1024x1536',
  'vid-story': '1024x1536',
  'tiktok': '1024x1536',
  'wa-status': '1024x1536',
};

// ── Tone → design direction ────────────────────────────────────────────────────
const TONE_DIRECTIVES: Record<string, string> = {
  'premium': 'Ultra-premium, luxury feel. Dark backgrounds, gold accents, elegant serif typography, high-end photography style. Think Rolls Royce, Apple, or Louis Vuitton advertising.',
  'urgente': 'High-energy, urgent feel. Bold red and yellow accents, large impactful text, arrows and visual momentum. Creates FOMO and immediate action.',
  'moderno': 'Clean, modern, minimalist. Geometric shapes, bold sans-serif fonts, white space, gradient accents. Feels like a cutting-edge tech startup.',
  'amigable': 'Warm, approachable, human. Bright colors, rounded shapes, friendly smiling people if relevant, soft shadows. Creates trust and connection.',
  'corporativo': 'Professional, trustworthy, authoritative. Navy blues, clean grid layout, business photography, structured hierarchy. Enterprise and B2B feel.',
};

// ── Build the master prompt for gpt-image-1 ───────────────────────────────────
function buildImagePrompt(params: {
  prompt: string;
  company_name: string;
  tagline?: string;
  cta?: string;
  colors?: string[];
  format: string;
  tone?: string;
  variantSeed?: string;
}): string {
  const { prompt, company_name, tagline, cta, colors, format, tone, variantSeed } = params;

  const primaryColor = (colors && colors.length > 0) ? colors[0] : '#e91e8c';
  const secondaryColor = (colors && colors.length > 1) ? colors[1] : '#1a1a2e';
  const ctaText = cta || 'Contáctanos hoy';
  const taglineText = tagline || '';

  const layoutVariants: Record<string, string> = {
    'A': `LAYOUT — VARIANT A (Classic Corporate):
TOP SECTION (white background):
- Small colored badge/pill at top center with text "SOLUCIÓN INTEGRAL PARA TU NEGOCIO" in ${primaryColor}
- Very large bold black headline (2 lines): derived from "${prompt}" 
- Subtitle line below in dark gray

MIDDLE SECTION:
- LEFT COLUMN: 4 feature rows, each with a colored square icon on the left and bold title + description text. Features related to: ${prompt}
- RIGHT COLUMN: Realistic laptop computer mockup showing a professional dashboard/app screenshot with charts, numbers, graphs inside the screen. Next to it a smartphone showing the mobile version.

BOTTOM SECTION (${primaryColor} colored background area):
- LEFT: Large price display "DESDE $12.95/mes" in white bold text with "SIN CONTRATOS LARGOS" badge below
- CENTER: CTA button "${ctaText}" in large white bold text with WhatsApp icon
- RIGHT: Tagline text in white

FOOTER (dark ${secondaryColor} bar):
- Company logo placeholder LEFT, WhatsApp number CENTER-LEFT, Email CENTER-RIGHT, Website RIGHT
- All in white text on dark background`,

    'B': `LAYOUT — VARIANT B (Bold Impact):
BACKGROUND: Clean white with ${primaryColor} accent elements

TOP: 
- Attention-grabbing question headline in black: large, bold, 2 lines
- Company name "${company_name}" in ${primaryColor} color, bold

CENTER:
- Large laptop mockup showing professional software/dashboard, centered
- 4 circular icons arranged around the laptop (top-left, top-right, bottom-left, bottom-right) each with icon + label for key features

PRICE BADGE: Prominent badge center showing price, colored in ${primaryColor}

BOTTOM STRIP (${primaryColor} background):
- 3 benefit boxes side by side, each with small icon and text
- Final tagline bar in dark color

FOOTER: Contact info row`,

    'C': `LAYOUT — VARIANT C (Minimal Premium):
Clean white background, bold typography, minimal elements

HEADER: Company badge top-left, social proof text top-right
HERO: Massive bold headline taking 40% of space, with ${primaryColor} color accent on key word
SUBTEXT: 2-3 lines explaining the offer from: ${prompt}
VISUAL: Full-bleed product/service image right side
FEATURES: 3 horizontal pill-shaped feature highlights
CTA SECTION: Large "${ctaText}" button in ${primaryColor}
FOOTER: Minimal contact line`,
  };

  const layout = layoutVariants[variantSeed || 'A'];

  return `Design a PIXEL-PERFECT, PRINT-READY professional marketing flyer. Style: like a top agency in Latin America created it for a B2B software company.

COMPANY: ${company_name}
WHAT TO PROMOTE: ${prompt}
CALL TO ACTION: "${ctaText}"
${taglineText ? `TAGLINE: "${taglineText}"` : ''}
PRIMARY COLOR: ${primaryColor}
SECONDARY COLOR: ${secondaryColor}

${layout}

MANDATORY DESIGN RULES:
1. CRITICAL — ALL text must be in PERFECT Spanish spelling. Zero tolerance for typos. 
   CORRECT: "Reportes" (NEVER "Ruportes"), "Tiempo" (NEVER "Tiempò"), "Facturación" (NEVER "Facturacion"), 
   "Inventario", "Clientes", "Ventas", "Seguridad", "Solución", "Gestión", "Automatización"
   If unsure of a word, use a simpler synonym. NEVER render garbled or misspelled text.
2. Typography: Use clean sans-serif fonts (like Inter, Montserrat or similar). Headlines BOLD, body text regular weight
3. The flyer must look EXACTLY like a professional designer made it — not AI-generated
4. Include realistic UI/dashboard mockup on a laptop screen (showing charts, numbers, graphs — it represents the software being promoted)
5. Price must be visible and prominent if mentioned in the prompt
6. Feature icons must be clean, professional vector-style icons (not clip art)
7. Color usage: primary color ${primaryColor} for accents, badges, CTA buttons. White for main background. Dark color for text.
8. High resolution, sharp edges, no blur, no distortion, no warped letters
9. The final result should be indistinguishable from a Canva Pro or Adobe Express professional template
10. Include the company name "${company_name}" prominently
11. NEVER mix fonts mid-word. NEVER render emoji as unicode boxes. NEVER distort text.

This flyer will be published on Instagram/Facebook. It must immediately communicate value and drive action.\`;
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const {
      prompt,
      company_name = 'Mi Empresa',
      tagline,
      cta,
      colors = [],
      format = 'ig-post',
      tone = 'moderno',
      variant_count = 1,
      company_id,
    } = body;

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'prompt is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const count = Math.min(Math.max(parseInt(variant_count) || 1, 1), 3);

    // ── Check and deduct credits ─────────────────────────────────────────────
    if (company_id) {
      const { data: creditResult } = await supabase
        .rpc('consume_ai_flyer_credits', { p_company_id: company_id, p_count: count });

      if (creditResult && !creditResult.ok) {
        return new Response(JSON.stringify({
          error: 'No tienes suficientes créditos este mes.',
          credits_used: creditResult.used,
          credits_limit: creditResult.limit,
          remaining: creditResult.remaining,
        }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ── Generate variants in parallel ────────────────────────────────────────
    const imageSize = FORMAT_SIZES[format] || '1024x1024';
    const variantSeeds = ['A', 'B', 'C'].slice(0, count);
    const errors: string[] = [];

    const generationPromises = variantSeeds.map(async (seed) => {
      const imagePrompt = buildImagePrompt({
        prompt, company_name, tagline, cta, colors, format, tone, variantSeed: seed
      });

      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt: imagePrompt,
          n: 1,
          size: imageSize,
          quality: 'medium',
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`Variant ${seed} failed:`, errText);
        errors.push(`Variant ${seed}: ${errText}`);
        return null;
      }

      const data = await res.json();
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) return null;
      return `data:image/png;base64,${b64}`;
    });

    const rawVariants = await Promise.all(generationPromises);
    const variants = rawVariants.filter(Boolean) as string[];

    if (variants.length === 0) {
      const errorDetails = errors.join(' | ');
      console.error('All variants failed:', errorDetails);
      return new Response(JSON.stringify({ error: 'Error generando imagen. Por favor intenta de nuevo.', details: errorDetails }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── Log to ai_generated_flyers ───────────────────────────────────────────
    if (company_id && variants.length > 0) {
      await supabase.from('ai_generated_flyers').insert({
        company_id,
        prompt_used: prompt,
        format,
        tone,
        image_urls: variants,
        credits_spent: count,
      });
    }

    // ── Get updated credit balance ───────────────────────────────────────────
    let creditsRemaining = null;
    if (company_id) {
      const { data: creditRow } = await supabase
        .from('ai_generation_credits')
        .select('credits_used, credits_limit')
        .eq('company_id', company_id)
        .order('period_start', { ascending: false })
        .limit(1)
        .single();

      if (creditRow) {
        creditsRemaining = creditRow.credits_limit - creditRow.credits_used;
      }
    }

    return new Response(JSON.stringify({
      variants,
      count: variants.length,
      credits_remaining: creditsRemaining,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('flyer-ai-generator error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
