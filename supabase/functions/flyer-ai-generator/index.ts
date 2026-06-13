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
  structuredText?: { headline?: string; subheadline?: string; features?: string[]; cta?: string; price?: string };
}): string {
  const { prompt, company_name, colors, tone, variantSeed, mode = 'background', structuredText } = params;

  const primaryColor = (colors && colors.length > 0) ? colors[0] : '#e91e8c';
  const secondaryColor = (colors && colors.length > 1) ? colors[1] : '#1a1a2e';

  // Seed variations for background styles
  const styles: Record<string, string> = {
    'A': `modern premium corporate aesthetic with abstract fluid shapes, smooth metallic surfaces, high-end advertising concept`,
    'B': `minimalistic clean design background with elegant glowing neon lines, digital technology grid, professional advertising lighting`,
    'C': `sophisticated corporate glassmorphism style, atmospheric soft shadows, sleek gradient waves, premium branding background`,
  };

  let selectedStyle = styles[variantSeed || 'A'];
  if (mode === 'full') {
    selectedStyle = selectedStyle.replace(/\bbackground\b/gi, 'marketing composition').replace(/\bbackdrop\b/gi, 'layout');
  }

  if (mode === 'full') {
    const textInstructions = structuredText?.headline
      ? `The flyer MUST prominently feature the following text written clearly with NO typos, in perfect Spanish:
- Main Title/Headline: "${structuredText.headline}"
- Slogan/Subheadline: "${structuredText.subheadline || ''}"
${structuredText.price ? `- Pricing/Offer: "${structuredText.price}"` : ''}
- Button/CTA: "${structuredText.cta || 'Contáctanos hoy'}"
- Company/Brand: "${company_name}"`
      : `The flyer MUST prominently feature the Company Name "${company_name}" and a clear, catchy headline representing: "${prompt}".`;

    return `Create a STUNNING, HIGH-FIDELITY commercial advertising flyer for: "${prompt}". 
Company Name: "${company_name}".
Visual style theme: ${selectedStyle}.
Visual tone direction: ${TONE_DIRECTIVES[tone || 'moderno'] || 'modern, clean and professional advertising layout'}.
Brand colors to integrate: ${primaryColor} and ${secondaryColor}.

${textInstructions}

Instructions: Generate a complete, ready-to-publish marketing flyer. The image itself MUST include beautifully integrated typography, catchy headings, promotional callouts, and an eye-catching layout that clearly communicates the promotion. Make it look like a premium agency-designed social media flyer. Ultra-high details, photorealistic, pixel-perfect.`;
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

    // ── Generate variants sequentially with dall-e-3 fallback ────────────────
    const imageSize = FORMAT_SIZES[format] || '1024x1024';
    // dall-e-3 only supports 1024x1024, 1024x1792, 1792x1024
    const dalleSize = (imageSize === '1024x1536' || imageSize === '1536x1024')
      ? (imageSize === '1024x1536' ? '1024x1792' : '1792x1024')
      : '1024x1024';
    const variantSeeds = ['A', 'B', 'C'].slice(0, count);
    const errors: string[] = [];
    const variants: string[] = [];

    for (const seed of variantSeeds) {
      try {
        const imagePrompt = buildImagePrompt({
          prompt, company_name, tagline, cta, colors, format, tone, variantSeed: seed, mode,
          structuredText: mode === 'full' ? structuredText : undefined
        });

        // ── Try gpt-image-1 first ────────────────────────────────────────────
        let b64: string | null = null;

        const res1 = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'gpt-image-1', prompt: imagePrompt, n: 1, size: imageSize, quality: 'high' }),
        });

        if (res1.ok) {
          const data1 = await res1.json();
          b64 = data1.data?.[0]?.b64_json || null;
          console.log(`Variant ${seed} generated with gpt-image-1`);
        } else {
          const errText1 = await res1.text();
          console.warn(`gpt-image-1 failed for variant ${seed}, falling back to dall-e-3. Error: ${errText1}`);

          // ── Fallback: dall-e-3 ───────────────────────────────────────────
          const res2 = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'dall-e-3',
              prompt: imagePrompt,
              n: 1,
              size: dalleSize,
              quality: 'hd',
              response_format: 'b64_json',
            }),
          });

          if (res2.ok) {
            const data2 = await res2.json();
            b64 = data2.data?.[0]?.b64_json || null;
            console.log(`Variant ${seed} generated with dall-e-3 fallback`);
          } else {
            const errText2 = await res2.text();
            console.error(`dall-e-3 also failed for variant ${seed}: ${errText2}`);
            errors.push(`Variant ${seed}: ${errText2}`);
          }
        }

        if (b64) variants.push(`data:image/png;base64,${b64}`);

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
