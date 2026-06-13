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

// ── Build the master prompt for DALL-E 3 ───────────────────────────────────────
function buildImagePrompt(params: {
  prompt: string;
  company_name: string;
  tagline?: string;
  cta?: string;
  colors?: string[];
  format: string;
  tone?: string;
  variantSeed?: string;
  mode?: 'full' | 'background';
}): string {
  const { prompt, company_name, colors, tone, variantSeed, mode = 'background' } = params;

  const primaryColor = (colors && colors.length > 0) ? colors[0] : '#e91e8c';
  const secondaryColor = (colors && colors.length > 1) ? colors[1] : '#1a1a2e';

  // Seed variations for background styles
  const styles: Record<string, string> = {
    'A': `modern premium corporate aesthetic with abstract fluid shapes, smooth metallic surfaces, high-end advertising concept`,
    'B': `minimalistic clean design background with elegant glowing neon lines, digital technology grid, professional advertising lighting`,
    'C': `sophisticated corporate glassmorphism style, atmospheric soft shadows, sleek gradient waves, premium branding background`,
  };

  const selectedStyle = styles[variantSeed || 'A'];

  if (mode === 'full') {

    const layoutA = `LAYOUT: Clean left-text + right-mockup on WHITE background.
TOP SECTION (company badge): "${company_name}" in small, clean horizontal text badge at top-left, with a thin ${primaryColor} colored bar below it. Sits 80px from top edge.
HEADLINE (huge, dark): 3-5 word ultra-bold headline in ${secondaryColor || '#0f172a'}, stacked on 2-3 lines. 1-2 key words highlighted in ${primaryColor}. Positioned left half, 80px from left edge.
SUBTEXT: 1 short line of supporting text below headline, normal weight, gray color.
FEATURES: 2-3 bullet points with small filled square icons in ${primaryColor}. Short 4-6 word phrases. Left half.
PRICE BADGE (if price mentioned): Bold pill badge in ${primaryColor}, white text "DESDE [price]". Left side, 80px from bottom.
CTA BUTTON: Wide rounded button in ${primaryColor}, white bold text. Centered or left-aligned, 80px from bottom.
MOCKUP: Laptop or tablet showing relevant dashboard/app UI. RIGHT half, vertically centered. 80px from right edge. 80px from bottom edge. Fully visible, NO part cut off.
BACKGROUND: Pure white with very subtle light gray dot grid. Small ${primaryColor} geometric accent in top-right corner.`;

    const layoutB = `LAYOUT: Centered design on white with top color bar.
TOP BANNER: Full-width ${primaryColor} color strip, height ~12% of canvas. Company name "${company_name}" in white, centered, clean sans-serif.
HEADLINE: Very large bold dark text, center-aligned, 2 lines. Contrasting key words in ${primaryColor}.
MOCKUP: Laptop or phone centered in middle of canvas, slightly below headline. Fully contained — all 4 edges of device visible, min 80px from canvas edges.
FEATURES ROW: 3 feature pills centered horizontally below mockup. Each: small icon + 3-4 word text.
PRICE BADGE: Centered, ${primaryColor} background, white text "DESDE [price]" if mentioned.
CTA: Wide pill button in ${primaryColor}, white text, centered, 80px from bottom.
BACKGROUND: Pure white body area with subtle geometric light pattern.`;

    const layoutC = `LAYOUT: Pink/brand gradient left + white right.
LEFT HALF: Diagonal gradient from ${primaryColor} to a darker shade. Company name "${company_name}" at top in white, bold, small size. 80px from left/top edges. HUGE white headline ALL-CAPS 2-3 lines. 2 feature bullets in white. Price badge: white pill with ${primaryColor} text. CTA white button with ${primaryColor} text.
RIGHT HALF: White background. Laptop or phone mockup fully contained — 80px from top, bottom and right canvas edges. No device edges cut off. Subtle drop shadow.
DIVIDER: Soft curved diagonal line separating left gradient from white.
BACKGROUND: Bright gradient on left, clean white on right.`;

    const layouts: Record<string, string> = { A: layoutA, B: layoutB, C: layoutC };
    const layout = layouts[variantSeed || 'A'];

    return `You are a senior art director at a top Latin American advertising agency. Create a PROFESSIONAL, PRINT-READY social media flyer image.

BUSINESS BRIEF:
- What to advertise: "${prompt}"
- Company: "${company_name}"
- Primary color: ${primaryColor}
- Secondary/dark color: ${secondaryColor || '#1a1a2e'}
- Tone: ${TONE_DIRECTIVES[tone || 'moderno'] || 'Modern, clean, professional'}

${layout}

ABSOLUTE NON-NEGOTIABLE RULES:
1. SAFE ZONE: Every single text, button, icon, logo and device mockup must be at least 80 pixels (8%) from ALL 4 edges of the canvas. If something is close to an edge, move it inward.
2. NO CLIPPING: Device mockups (laptop, phone, tablet) must be 100% visible. Not a single pixel of the device may be cut off by the canvas border.
3. COMPANY NAME: Must appear in the TOP portion of the flyer as a clean horizontal brand badge, NOT at the very bottom edge.
4. FONT STYLE: Use modern geometric sans-serif fonts only. Bold, clean, no decorative scripts.
5. SPANISH COPY: All text in perfect Spanish with correct accents and spelling. Extract content from the brief.
6. BACKGROUND: Keep background WHITE or very light — never dark full-bleed unless it is the Layout C gradient style.
7. QUALITY: Final result must look like a $1000 professional agency design. Pixel-perfect alignment. Clean visual hierarchy.`;
  }

  return `Design a STUNNING, HIGH-FIDELITY commercial advertising background. 
Style theme: ${selectedStyle}.
Topic/Sector details: "${prompt}".
Visual mood: Professional commercial studio photography, sleek lighting, rich colors, premium advertising look.
Brand colors to integrate: ${primaryColor} and ${secondaryColor}.
Composition: Perfect B2B backdrop with a lot of clean negative space, designed as an advertising canvas to overlay HTML text and product dashboard mockups.

CRITICAL MANDATORY RULES:
1. STRICTLY NO TEXT, NO LETTERS, NO WORDS, NO WRITING, NO TYPOS, NO ALPHABET, NO CHARACTERS. The image must be 100% clean and free of any text.
2. NO LAPTOPS, NO SMARTPHONES, NO COMPUTERS, NO HARDWARE. Do not render any electronic devices, screens, or mockups.
3. Clean empty space. Maintain large solid/gradient areas with soft light so that text can be easily read when overlayed.
4. No blur, sharp high-fidelity rendering, pixel-perfect.`;
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
      mode = 'background',
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

    // ── Generate optimized ad copy using GPT-4o-mini ─────────────────────────
    let structuredText = {
      headline: '',
      subheadline: '',
      features: [] as string[],
      cta: cta || 'Contáctanos hoy',
      price: '',
    };

    try {
      const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are an expert copywriter. Your task is to extract and optimize advertising copy in Spanish from a raw prompt description. 
You MUST return a JSON object with this exact structure:
{
  "headline": "A short, ultra-catchy 2-5 word main title in Spanish",
  "subheadline": "A supporting slogan or dynamic offer of 4-8 words in Spanish",
  "features": ["Feature 1 (max 4 words)", "Feature 2 (max 4 words)", "Feature 3 (max 4 words)"],
  "cta": "WhatsApp / Call to action button text (max 3 words)",
  "price": "Clean price text if mentioned (e.g. '$18.95/mes' or 'Desde $12.95'), otherwise empty"
}
CRITICAL: Use PERFECT Spanish spelling. Zero spelling mistakes, zero typos, clean accents. Do not include markdown formatting, just raw JSON.`,
            },
            {
              role: 'user',
              content: `Optimize this brief for a B2B flyer: "${prompt}". Company name: "${company_name}". Default CTA: "${cta || ''}"`,
            }
          ],
          response_format: { type: 'json_object' }
        }),
      });

      if (chatRes.ok) {
        const chatData = await chatRes.json();
        const content = JSON.parse(chatData.choices?.[0]?.message?.content || '{}');
        if (content.headline) {
          structuredText = {
            headline: content.headline,
            subheadline: content.subheadline || '',
            features: Array.isArray(content.features) ? content.features.slice(0, 3) : [],
            cta: content.cta || cta || 'Contáctanos hoy',
            price: content.price || '',
          };
        }
      }
    } catch (chatErr) {
      console.error('Chat completions copywriting failed:', chatErr);
    }

    // ── Generate variants sequentially (gpt-image-1 rate-limit safe) ─────────
    const imageSize = FORMAT_SIZES[format] || '1024x1024';
    const variantSeeds = ['A', 'B', 'C'].slice(0, count);
    const errors: string[] = [];
    const variants: string[] = [];

    for (const seed of variantSeeds) {
      try {
        const imagePrompt = buildImagePrompt({
          prompt, company_name, tagline, cta, colors, format, tone, variantSeed: seed, mode
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
            quality: 'high',
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error(`Variant ${seed} failed:`, errText);
          errors.push(`Variant ${seed}: ${errText}`);
        } else {
          const data = await res.json();
          const b64 = data.data?.[0]?.b64_json;
          if (b64) variants.push(`data:image/png;base64,${b64}`);
        }
      } catch (e: any) {
        errors.push(`Variant ${seed} exception: ${e.message}`);
      }
    }

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
      structured_text: structuredText,
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
