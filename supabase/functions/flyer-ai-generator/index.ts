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

  const toneDirective = TONE_DIRECTIVES[tone || 'moderno'];
  const colorInstructions = colors && colors.length > 0
    ? `Brand colors to incorporate: ${colors.join(', ')}.`
    : 'Use a harmonious, professional color palette.';

  const ctaText = cta || 'Contact us today';
  const taglineText = tagline ? `Tagline: "${tagline}"` : '';

  // Variant differentiation: each variant gets a different layout/composition seed
  const variantCompositions: Record<string, string> = {
    'A': 'Composition: Bold headline centered at top, product/service visualization in the middle, CTA button at bottom.',
    'B': 'Composition: Left-aligned layout, large imagery on the right side, text hierarchy on the left with high contrast.',
    'C': 'Composition: Diagonal split design, dynamic energy lines, headline breaks across the divider for visual impact.',
  };
  const compositionDirective = variantCompositions[variantSeed || 'A'] || variantCompositions['A'];

  return `Create a COMPLETE, PROFESSIONAL, READY-TO-PUBLISH marketing advertisement flyer for social media.

BUSINESS INFORMATION:
- Company: ${company_name}
${taglineText}
- What to promote: ${prompt}
- Call to action: "${ctaText}"

DESIGN STYLE:
${toneDirective}

COLOR PALETTE:
${colorInstructions}

TYPOGRAPHY REQUIREMENTS:
- Main headline: Large, bold, attention-grabbing — clearly readable
- Supporting text: Clean, legible secondary information
- CTA button or text: Clearly visible with contrast
- Company name: Prominently placed, professional
- ALL TEXT must be spelled correctly and in Spanish unless the prompt is in English

${compositionDirective}

TECHNICAL REQUIREMENTS:
- This is a complete finished advertisement — include ALL text, logos placeholder, and design elements
- Professional print and digital quality
- No watermarks, no placeholder boxes, no lorem ipsum
- The flyer must look like it was designed by a professional graphic design studio
- High contrast between text and background for readability
- Include visual hierarchy: headline → supporting info → CTA

${variantSeed === 'B' ? 'Make this variation feel more editorial and sophisticated.' : ''}
${variantSeed === 'C' ? 'Make this variation feel more energetic and dynamic.' : ''}

The final result must be something a business owner would be proud to post on their social media page immediately.`;
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
