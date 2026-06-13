import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Sparkles, Download, Send, RefreshCw,
  Zap, Image, Check, ChevronRight, Upload, X, Eye,
  BarChart3, Wand2, Layers, Palette, Type, Layout,
  ExternalLink, Star, Cpu, Crown, Smile, Building2,
  Instagram, Facebook, Linkedin, Smartphone, Video
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../services/supabase';
import html2canvas from 'html2canvas';
import { toPng } from 'html-to-image';
import { RenderFlyer, FreeLogo, TEMPLATE_LIST } from './FlyerTemplates';
import type { FlyerData } from './FlyerTemplates';
import { FlyerTemplateA, FlyerTemplateB, parsePrompt, deriveHeadline, deriveFeatures, derivePrice } from '../../components/flyers/FlyerTemplates';
import { brandingService } from '../../services/branding';

// ─── Data ─────────────────────────────────────────────────────────────────────
const FORMATS = [
  { id: 'ig-post', label: 'Instagram Post', tag: '1:1', icon: Instagram },
  { id: 'ig-portrait', label: 'IG Retrato', tag: '4:5', icon: Smartphone },
  { id: 'fb-post', label: 'Facebook Post', tag: '6:5', icon: Facebook },
  { id: 'story', label: 'Story / Reels', tag: '9:16', icon: Video },
  { id: 'fb-cover', label: 'Portada Facebook', tag: 'Banner', icon: Layout },
  { id: 'li-post', label: 'LinkedIn', tag: '1.91:1', icon: Linkedin },
];

const TONES = [
  { key: 'premium', label: 'Premium', icon: Crown, color: '#D4AF37' },
  { key: 'urgente', label: 'Urgente', icon: Zap, color: '#ef4444' },
  { key: 'moderno', label: 'Moderno', icon: Sparkles, color: '#7c3aed' },
  { key: 'amigable', label: 'Amigable', icon: Smile, color: '#10b981' },
  { key: 'corporativo', label: 'Corporativo', icon: Building2, color: '#0070d2' },
];

const BRAND_COLORS = [
  '#0070d2', '#7c3aed', '#ef4444', '#f59e0b',
  '#10b981', '#D4AF37', '#ec4899', '#06b6d4',
  '#1a1a2e', '#111827',
];

// ─── Styles ───────────────────────────────────────────────────────────────────
const css = {
  page: { height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' as const, background: '#f0f2f5', fontFamily: 'system-ui,-apple-system,sans-serif', overflow: 'hidden' },
  header: { padding: '10px 20px', background: '#fff', borderBottom: '1px solid #dde1e7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  cols: { flex: 1, display: 'flex', gap: 0, overflow: 'hidden' },
  col: (w: string, bg = '#fff', border = true) => ({ width: w, flexShrink: 0, background: bg, borderRight: border ? '1px solid #dde1e7' : 'none', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' }),
  colHead: { padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  colBody: { flex: 1, overflowY: 'auto' as const, padding: '16px 18px' },
  label: { fontSize: 10, fontWeight: 800, color: '#54698d', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 6, display: 'block' },
  input: { width: '100%', border: '1px solid #d8dde6', borderRadius: 7, padding: '9px 12px', fontSize: 13, color: '#0f172a', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const, background: '#fff' },
  textarea: { width: '100%', border: '1px solid #d8dde6', borderRadius: 7, padding: '10px 12px', fontSize: 13, color: '#0f172a', outline: 'none', resize: 'vertical' as const, minHeight: 100, fontFamily: 'inherit', boxSizing: 'border-box' as const },
  section: { marginBottom: 20 },
  pill: (active: boolean, accent = '#0070d2') => ({ border: `1.5px solid ${active ? accent : '#e2e8f0'}`, borderRadius: 7, padding: '7px 10px', cursor: 'pointer', background: active ? `${accent}10` : '#f8fafc', transition: 'all 0.12s', display: 'flex', alignItems: 'center', gap: 5 }),
  btn: { background: 'linear-gradient(135deg,#0070d2,#005fb2)', border: 'none', borderRadius: 7, padding: '11px 20px', fontSize: 12, fontWeight: 800, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, width: '100%', justifyContent: 'center' as const },
  ghost: { background: '#f4f6f9', border: '1px solid #d8dde6', borderRadius: 7, padding: '9px 14px', fontSize: 12, fontWeight: 700, color: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
};

// ─── Virality Score (local, no API) ──────────────────────────────────────────
function calcViralScore(prompt: string, cta: string, phone: string, website: string) {
  if (!prompt.trim() || prompt.trim().length < 10) return { score: 0, level: 'none', tips: [] as string[] };
  let score = 0;
  const tips: string[] = [];
  const p = prompt.toLowerCase();
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

const getFlyerDimensions = (formatId: string) => {
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

async function urlToBase64(url: string): Promise<string> {
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

// ─── Component ────────────────────────────────────────────────────────────────
export default function FlyerStudio() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const flyerRef = useRef<HTMLDivElement>(null);
  const templateRefA = useRef<HTMLDivElement>(null);
  const templateRefB = useRef<HTMLDivElement>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<'A' | 'B'>('B');
  const [previewMode, setPreviewMode] = useState<'template' | 'ai'>('template');

  // Form & Content States
  const [prompt, setPrompt] = useState('');
  const [cta, setCta] = useState('');
  const [phone, setPhone] = useState('+503 7971-8911');
  const [website, setWebsite] = useState('www.ariasdefense.com');
  const [format, setFormat] = useState('ig-post');
  const [tone, setTone] = useState('moderno');
  const [variantCount, setVariantCount] = useState<1 | 2 | 3>(1);
  const [colors, setColors] = useState<string[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');

  // Custom background upload states
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [bgUploadPreview, setBgUploadPreview] = useState('');
  const bgUploadRef = useRef<HTMLInputElement>(null);

  // Logo positioning
  const [logoX, setLogoX] = useState(5);
  const [logoY, setLogoY] = useState(5);
  const [logoSize, setLogoSize] = useState(1.0);

  const logoRef = useRef<HTMLInputElement>(null);

  // State
  const [generating, setGenerating] = useState(false);
  const [variants, setVariants] = useState<string[]>([]);
  const [selected, setSelected] = useState(0);
  const [credits, setCredits] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // AI suggestions (Sprint 4)
  const [optimizing, setOptimizing] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Auto-optimize (debounced — fires 2.5s after user stops typing)
  const [autoOptimizing, setAutoOptimizing] = useState(false);
  const autoOptRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoOptPrompt = useRef('');
  const userSelectedColors = useRef(false);

  // Structured B2B ad copy generated by GPT-4o-mini
  const [aiOptimizedText, setAiOptimizedText] = useState<{
    headline?: string;
    subheadline?: string;
    features?: string[];
    cta?: string;
    price?: string;
    highlight_title?: string;
    highlight_desc?: string;
    benefits?: { title: string; desc: string; icon: string }[];
    mockup_info?: {
      title: string;
      kpis: { label: string; val: string; change?: string }[];
    };
  } | null>(null);
  const [isFullAiFlyer, setIsFullAiFlyer] = useState(false);
  // showFullAiResult: true = imagen DALL-E 3 pura generada, false = mostrar plantilla HTML
  const [showFullAiResult, setShowFullAiResult] = useState(false);

  useEffect(() => {
    if (!profile?.company_id) return;
    
    brandingService.getMyCompany()
      .then(async (data) => {
        if (data) {
          if (data.name) setCompanyName(data.name);
          if (data.phone) setPhone(data.phone || '+503 7971-8911');
          if (data.website) setWebsite(data.website || 'www.ariasdefense.com');
          if (data.logo_url) {
            const base64 = await urlToBase64(data.logo_url);
            setLogoPreview(base64);
          }
        }
      })
      .catch((err) => console.error('Error loading branding:', err));

    supabase.from('ai_generation_credits')
      .select('credits_used,credits_limit').eq('company_id', profile.company_id)
      .order('period_start', { ascending: false }).limit(1).single()
      .then(({ data }) => setCredits(data ? data.credits_limit - data.credits_used : 20));
  }, [profile]);

  // ── Auto-optimize brief with IA as user types ─────────────────────────────
  useEffect(() => {
    // Skip: same as last auto-optimized, too short, no company, or already structured/edited
    if (!prompt.trim() || prompt.trim().length < 40) return;
    if (prompt === lastAutoOptPrompt.current) return;
    if (/t[íi]tulo:|incluye:|cta:/i.test(prompt)) return; // Don't overwrite manually customized/structured text
    if (showSuggestions) return;

    autoOptRef.current = setTimeout(async () => {
      setAutoOptimizing(true);
      try {
        const { data, error } = await supabase.functions.invoke('flyer-recommend', {
          body: { oferta: prompt, tono: tone, industria: 'General', idioma: 'es' }
        });
        if (error || !data?.ideas?.length) return;
        const best = data.ideas[0];
        const parts: string[] = [];
        if (best.titulo) parts.push(`título: ${best.titulo}`);
        if (best.gancho) parts.push(best.gancho);
        if (best.beneficios?.length) parts.push(`incluye: ${best.beneficios.join(', ')}`);
        if (best.cta) parts.push(`cta: ${best.cta}`);
        const enriched = parts.join('. ');
        if (enriched) {
          lastAutoOptPrompt.current = enriched;
          setPrompt(enriched);
        }
        if (best.paleta?.length > 0 && !userSelectedColors.current) setColors(best.paleta.slice(0, 3));
        if (best.cta && !cta.trim()) setCta(best.cta);
        if (best.tono) setTone(best.tono);
        // CRITICAL: clear stale AI variants — they don't match the new brief
        setVariants([]);
        setSelected(0);
        setPreviewMode('template');
        toast.success('✨ IA mejoró tu brief automáticamente', { duration: 2000 });
      } catch (_) { /* silent fail */ }
      finally { setAutoOptimizing(false); }
    }, 2500);

    return () => { if (autoOptRef.current) clearTimeout(autoOptRef.current); };
  }, [prompt]);

  function toggleColor(hex: string) {
    userSelectedColors.current = true;
    setColors(p => {
      const lower = hex.toLowerCase();
      const exists = p.some(c => c.toLowerCase() === lower);
      if (exists) {
        return p.filter(c => c.toLowerCase() !== lower);
      } else {
        return p.length < 3 ? [...p, hex] : p;
      }
    });
  }

  async function generate(mode: 'full' | 'background' = 'background') {
    if (!prompt.trim()) { toast.error('Describe qué quieres promocionar'); return; }
    setGenerating(true);
    setVariants([]);
    setAiOptimizedText(null); // Clear previous B2B structured copy
    setIsFullAiFlyer(mode === 'full');
    setShowFullAiResult(false); // Reset — se activa solo cuando DALL-E responde con éxito

    const promptToSubmit = mode === 'background'
      ? prompt
          .replace(/t[íi]tulo:|subt[íi]tulo:|incluye:|cta:|whatsapp:|tel[eé]fono:|contacto:|celular:|sitio:|web:|p[aá]gina|link|url/gi, '')
          .replace(/\b\d{8,18}\b/g, '') // remove phone numbers
          .trim()
      : prompt.trim();

    try {
      const { data, error } = await supabase.functions.invoke('flyer-ai-generator', {
        body: {
          prompt: promptToSubmit,
          company_name: companyName || 'Mi Empresa',
          cta: cta || undefined,
          colors,
          format,
          tone,
          variant_count: variantCount,
          company_id: profile?.company_id,
          mode
        }
      });
      if (error || !data?.variants?.length) throw new Error(error?.message || data?.error || 'Error generando');
      setVariants(data.variants);
      if (data.structured_text) {
        setAiOptimizedText(data.structured_text);
      }
      setSelected(0);
      setPreviewMode('ai');
      // Modo 'full': la imagen de DALL-E ES el flyer — mostrarlo como imagen pura
      // Modo 'background': usarla como fondo de la plantilla HTML
      setShowFullAiResult(mode === 'full');
      if (data.credits_remaining != null) setCredits(data.credits_remaining);
      if (mode === 'full') {
        toast.success('✨ ¡Flyer Profesional con IA generado!');
      } else {
        toast.success('🎨 Fondo IA generado — diseño HTML superpuesto.');
      }
    } catch (e: any) {
      console.warn('AI generation failed, applying premium stock fallback:', e);
      // Fallback: search for keywords in the prompt to match a beautiful Unsplash stock image
      const lower = prompt.toLowerCase();
      let fallbackImg = 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1080&q=80'; // tech / general B2B
      
      if (/\b(pizza|comida|restaurante|food|pupusa|pupusas|taco|tacos|burger|hamburguesa|sushi)\b/i.test(lower)) {
        fallbackImg = 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1080&q=80'; // pizza / food
      } else if (/\b(dentista|dental|diente|dientes|cl[íi]nica|odontolog[íi]a)\b/i.test(lower)) {
        fallbackImg = 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1080&q=80'; // dental
      } else if (/\b(defensa|seguridad|karate|marciales|taekwondo)\b/i.test(lower)) {
        fallbackImg = 'https://images.unsplash.com/photo-1555597673-b21d5c935865?auto=format&fit=crop&w=1080&q=80'; // martial arts
      } else if (/\b(taller|auto|carro|veh[íi]culo|mec[aá]nico|motor)\b/i.test(lower)) {
        fallbackImg = 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=1080&q=80'; // auto workshop
      } else if (/\b(belleza|salon|sal[oó]n|u[ñn]as|spa|maquillaje|cabello|peluquer[íi]a)\b/i.test(lower)) {
        fallbackImg = 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1080&q=80'; // beauty salon
      } else if (/\b(gym|gimnasio|fit|fitness|ejercicio|entrenamiento)\b/i.test(lower)) {
        fallbackImg = 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1080&q=80'; // gym
      } else if (/\b(abogado|legal|firma|consultor[íi]a|leyes|derecho)\b/i.test(lower)) {
        fallbackImg = 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1080&q=80'; // law/legal
      }

      setVariants([fallbackImg]);
      
      // Also generate optimized copy locally based on basic parsing since openai failed
      const parsed = parsePrompt(prompt);
      const { h1, h2 } = deriveHeadline(prompt, companyName || 'Mi Empresa');
      setAiOptimizedText({
        headline: parsed.title || h1,
        subheadline: parsed.subtitle || h2,
        features: parsed.features || deriveFeatures(prompt).slice(0, 3),
        cta: parsed.cta || cta || 'Contáctanos hoy',
        price: parsed.price || derivePrice(prompt) || ''
      });

      setSelected(0);
      setPreviewMode('ai');
      setShowFullAiResult(false); // Fallback Unsplash → se usa como fondo de la plantilla HTML
      toast.success('✨ Usando imagen temática como fondo. Para flyer IA completo, verifica créditos.');
    } finally {
      setGenerating(false);
    }
  }

  async function generateFromTemplate() {
    await handleDownload();
  }

  async function optimizeWithMetaAI() {
    if (!prompt.trim()) { toast.error('Escribe una descripción básica primero'); return; }
    setOptimizing(true);
    setSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke('flyer-recommend', {
        body: {
          oferta: prompt,
          tono: tone,
          industria: 'General',
          idioma: 'es'
        }
      });
      if (error || !data?.ideas?.length) throw new Error(error?.message || data?.error || 'No se pudieron generar sugerencias');
      setSuggestions(data.ideas);
      setShowSuggestions(true);
      toast.success('¡Análisis de Meta AI completado!');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setOptimizing(false);
    }
  }

  function applySuggestion(idea: any) {
    // Merge into existing brief intelligently
    const parts: string[] = [];
    if (idea.titulo) parts.push(`título: ${idea.titulo}`);
    if (idea.gancho) parts.push(idea.gancho);
    if (idea.beneficios?.length) parts.push(`incluye: ${idea.beneficios.join(', ')}`);
    if (idea.cta) parts.push(`cta: ${idea.cta}`);
    const enriched = parts.join('. ');
    if (enriched) {
      setPrompt(enriched);
      lastAutoOptPrompt.current = enriched; // prevent re-triggering auto-optimize
    }
    if (idea.paleta && idea.paleta.length > 0) setColors(idea.paleta.slice(0, 3));
    if (idea.cta && !cta.trim()) setCta(idea.cta);
    if (idea.tono) setTone(idea.tono);
    // CRITICAL: clear stale AI variants — they don't match the new brief
    setVariants([]);
    setSelected(0);
    setPreviewMode('template');
    setShowSuggestions(false);
    toast.success('✨ Propuesta aplicada al brief');
  }

  async function handleDownload() {
    setGenerating(true);
    try {
      let dataUrl = '';
      if (bgUploadPreview || (previewMode === 'ai' && variants.length > 0)) {
        if (!flyerRef.current) { toast.error('Flyer no está listo'); return; }
        const canvas = await html2canvas(flyerRef.current, {
          useCORS: true,
          allowTaint: true,
          scale: 2,
          backgroundColor: null
        });
        dataUrl = canvas.toDataURL('image/png');
      } else {
        const ref = selectedTemplate === 'A' ? templateRefA : templateRefB;
        if (!ref.current) throw new Error('Template not ready');
        const canvas = await html2canvas(ref.current, {
          useCORS: true,
          allowTaint: true,
          scale: 2,
          backgroundColor: null
        });
        dataUrl = canvas.toDataURL('image/png');
      }
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `flyer-${format}-${Date.now()}.png`;
      a.click();
      toast.success('Flyer personalizado descargado con éxito');
    } catch (err: any) {
      console.error('Error al capturar flyer:', err);
      toast.error('Error al generar la descarga del flyer: ' + err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function sendToSocialHub() {
    setGenerating(true);
    try {
      let dataUrl = '';
      if (bgUploadPreview || (previewMode === 'ai' && variants.length > 0)) {
        if (!flyerRef.current) { toast.error('Flyer no está listo'); return; }
        const canvas = await html2canvas(flyerRef.current, {
          useCORS: true, allowTaint: true, scale: 2, backgroundColor: null
        });
        dataUrl = canvas.toDataURL('image/png');
      } else {
        const ref = selectedTemplate === 'A' ? templateRefA : templateRefB;
        if (!ref.current) throw new Error('Template not ready');
        const canvas = await html2canvas(ref.current, {
          useCORS: true, allowTaint: true, scale: 2, backgroundColor: null
        });
        dataUrl = canvas.toDataURL('image/png');
      }
      sessionStorage.setItem('socialhub_prefill_image', dataUrl);
      
      // Save metadata to enable correct context parsing in SocialHub
      const meta = {
        prompt,
        title: prompt.split('—')[0]?.trim() || '',
        colors,
      };
      sessionStorage.setItem('socialhub_prefill_meta', JSON.stringify(meta));

      navigate('/marketing/social');
      toast.success('✅ Flyer enviado al Panel de Publicidad');
    } catch (err: any) {
      console.error('Error al preparar el flyer:', err);
      toast.error('Error al preparar el flyer para publicar: ' + err.message);
    } finally {
      setGenerating(false);
    }
  }

  const credColor = credits === null ? '#94a3b8' : credits > 10 ? '#10b981' : credits > 3 ? '#f59e0b' : '#ef4444';

  return (
    <div style={css.page}>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header style={css.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/marketing')}
            style={{ background: '#fff', border: '1px solid #d8dde6', borderRadius: 7, padding: 7, cursor: 'pointer', display: 'flex' }}>
            <ArrowLeft size={14} color="#54698d" />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg,#0070d2,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Wand2 size={16} color="#fff" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: 8, fontWeight: 900, color: '#D4AF37', letterSpacing: '0.12em' }}>ARIAS CRM · SOCIAL MEDIA HUB</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#081c3b' }}>AI Flyer Studio</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {credits !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: credits > 10 ? '#f0fdf4' : credits > 3 ? '#fffbeb' : '#fef2f2', border: `1px solid ${credColor}40`, borderRadius: 20, padding: '5px 12px' }}>
              <Zap size={11} color={credColor} fill={credColor} />
              <span style={{ fontSize: 11, fontWeight: 700, color: credColor }}>{credits} créditos</span>
            </div>
          )}
          <button onClick={() => navigate('/marketing/ai-credits')} style={{ ...css.ghost, padding: '6px 12px', fontSize: 11 }}>
            <BarChart3 size={12} /> Uso
          </button>
        </div>
      </header>

      {/* ── 3 COLUMNS ──────────────────────────────────────────────────────── */}
      <div style={css.cols}>

        {/* ══ COL 1 — CREATIVE BRIEF (320px) ════════════════════════════════ */}
        <div style={css.col('320px')}>
          <div style={css.colHead}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Type size={13} color="#0070d2" />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>Brief Creativo</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>Describe tu publicidad</div>
            </div>
          </div>

          <div className="flyer-studio-col" style={css.colBody}>
            {/* Prompt */}
            <div style={css.section}>
              <label style={css.label}>¿Qué quieres promocionar? *</label>
              <textarea
                style={{ ...css.textarea, minHeight: 120, fontSize: 13, lineHeight: 1.6, border: autoOptimizing ? '1.5px solid #7c3aed' : '1px solid #d8dde6', transition: 'border 0.3s' }}
                placeholder={'Ej: 30% OFF en servicios de defensa personal este verano — escribe tu idea y la IA la mejorará automáticamente...'}
                value={prompt}
                onChange={e => {
                  setPrompt(e.target.value);
                  // CRITICAL: clear stale AI variants when brief changes
                  if (variants.length > 0) {
                    setVariants([]);
                    setSelected(0);
                    setPreviewMode('template');
                  }
                }}
              />
              {/* Auto-optimize status */}
              {autoOptimizing && (
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#7c3aed', fontWeight: 700 }}>
                  <Cpu size={10} style={{ animation: 'spin 1s linear infinite' }} />
                  IA mejorando tu brief...
                </div>
              )}
              {/* Manual regenerate — secondary option */}
              {!autoOptimizing && prompt.trim().length > 3 && lastAutoOptPrompt.current && (
                <button
                  onClick={optimizeWithMetaAI}
                  disabled={optimizing}
                  style={{ marginTop: 6, background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 10px', fontSize: 10, fontWeight: 700, color: '#7c3aed', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  {optimizing ? <><Cpu size={10} style={{ animation: 'spin 1s linear infinite' }} /> Regenerando...</> : <><RefreshCw size={10} /> Regenerar sugerencia</>}
                </button>
              )}
            </div>

            {/* ── VIRALITY SCORE — shown BEFORE generating ── */}
            {(() => {
              const vs = calcViralScore(prompt, cta, phone, website);
              if (vs.score === 0) return null;
              const color = vs.level === 'viral' ? '#10b981' : vs.level === 'bueno' ? '#3b82f6' : vs.level === 'mejorable' ? '#f59e0b' : '#ef4444';
              const label = vs.level === 'viral' ? '🔥 Alto impacto' : vs.level === 'bueno' ? '👍 Buen potencial' : vs.level === 'mejorable' ? '⚠️ Mejorable' : '📉 Bajo impacto';
              return (
                <div style={{ marginBottom: 20, background: `${color}08`, border: `1.5px solid ${color}30`, borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 900, color: '#0f172a', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Score de Viralidad</span>
                    <span style={{ fontSize: 11, fontWeight: 900, color }}>{vs.score}/100 · {label}</span>
                  </div>
                  <div style={{ height: 6, background: '#e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: vs.tips.length > 0 ? 10 : 0 }}>
                    <div style={{ height: '100%', width: `${vs.score}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)`, borderRadius: 10, transition: 'width 0.4s ease' }} />
                  </div>
                  {vs.tips.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, marginBottom: 2 }}>👆 Toca una sugerencia para agregarla al brief:</div>
                      {vs.tips.map((tip, i) => {
                        // Extract the actionable text after the first colon if present
                        const parts = tip.split(':');
                        const snippet = parts.length > 1 ? parts.slice(1).join(':').trim() : tip;
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              const addition = snippet.replace(/\(ej:.*/i, '').trim();
                              setPrompt(prev => prev ? `${prev.trim()}. ${addition}` : addition);
                              // Clear stale AI variants
                              if (variants.length > 0) { setVariants([]); setSelected(0); setPreviewMode('template'); }
                            }}
                            style={{
                              fontSize: 10, color: '#475569', fontWeight: 600, lineHeight: 1.4,
                              background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.1)',
                              borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                              textAlign: 'left', display: 'block', width: '100%',
                              transition: 'background 0.15s, transform 0.1s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.transform = 'translateX(2px)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.7)'; e.currentTarget.style.transform = 'translateX(0)'; }}
                          >
                            {tip} <span style={{ color: '#7c3aed', fontSize: 9 }}>→ agregar</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* CTA */}
            <div style={css.section}>
              <label style={css.label}>Llamada a la Acción (CTA)</label>
              <input style={css.input} placeholder="Ej: Reserva hoy · Llama ahora · Obtén 30% off"
                value={cta}
                onChange={e => setCta(e.target.value)}
              />
            </div>

            {/* Contact Details */}
            <div style={css.section}>
              <label style={css.label}>Datos de Contacto</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input style={css.input} placeholder="Teléfono (Ej: 7971-8911)"
                  value={phone} onChange={e => setPhone(e.target.value)} />
                <input style={css.input} placeholder="Sitio Web (Ej: www.ariasdefense.com)"
                  value={website} onChange={e => setWebsite(e.target.value)} />
              </div>
            </div>

            {/* Logo */}
            <div style={css.section}>
              <label style={css.label}>Logo / Imagen de Referencia</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => logoRef.current?.click()} style={{ ...css.ghost, fontSize: 11, padding: '7px 12px', flex: 1 }}>
                  <Upload size={12} /> {logoFile ? 'Cambiar logo' : 'Subir logo'}
                </button>
                {logoPreview && (
                  <div style={{ position: 'relative', display: 'inline-flex' }}>
                    <img src={logoPreview} alt="logo" style={{ height: 36, width: 36, objectFit: 'contain', borderRadius: 5, border: '1px solid #e2e8f0' }} />
                    <button onClick={() => { setLogoFile(null); setLogoPreview(''); if (logoRef.current) logoRef.current.value = ''; }} style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', border: 'none', borderRadius: '50%', width: 14, height: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={9} color="#fff" />
                    </button>
                  </div>
                )}
              </div>
              <input ref={logoRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (!f) return; setLogoFile(f); const r = new FileReader(); r.onload = ev => setLogoPreview(ev.target?.result as string); r.readAsDataURL(f); }} style={{ display: 'none' }} />
            </div>

            {/* Custom Flyer Upload */}
            <div style={css.section}>
              <label style={css.label}>Cargar Flyer ya Diseñado (Canva / ChatGPT)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => bgUploadRef.current?.click()} style={{ ...css.ghost, fontSize: 11, padding: '7px 12px', flex: 1, background: bgUploadPreview ? '#f0fdf4' : '#f4f6f9', borderColor: bgUploadPreview ? '#bbf7d0' : '#d8dde6' }}>
                  <Upload size={12} /> {bgFile ? 'Cambiar flyer' : 'Subir flyer (ChatGPT / Canva)'}
                </button>
                {bgUploadPreview && (
                  <div style={{ position: 'relative', display: 'inline-flex' }}>
                    <img src={bgUploadPreview} alt="flyer custom bg" style={{ height: 36, width: 36, objectFit: 'cover', borderRadius: 5, border: '1px solid #e2e8f0' }} />
                    <button onClick={() => { setBgFile(null); setBgUploadPreview(''); }} style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', border: 'none', borderRadius: '50%', width: 14, height: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={9} color="#fff" />
                    </button>
                  </div>
                )}
              </div>
              <input ref={bgUploadRef} type="file" accept="image/*" onChange={e => {
                const f = e.target.files?.[0];
                if (!f) return;
                setBgFile(f);
                const r = new FileReader();
                r.onload = ev => {
                  setBgUploadPreview(ev.target?.result as string);
                  toast.success('¡Flyer subido! Se mostrará al 100% sin superposiciones');
                };
                r.readAsDataURL(f);
              }} style={{ display: 'none' }} />
              <div style={{ fontSize: 9, color: '#64748b', marginTop: 4 }}>
                Sube la imagen generada por ChatGPT para agregarle el logo flotante encima.
              </div>
            </div>

            {/* Variants */}
            <div style={css.section}>
              <label style={css.label}>¿Cuántas variantes? (1 crédito c/u)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {([1, 2, 3] as const).map(n => (
                  <button key={n} onClick={() => setVariantCount(n)}
                    style={{ flex: 1, height: 36, border: `1.5px solid ${variantCount === n ? '#0070d2' : '#e2e8f0'}`, borderRadius: 7, background: variantCount === n ? '#eff6ff' : '#f8fafc', cursor: 'pointer', fontSize: 15, fontWeight: 900, color: variantCount === n ? '#0070d2' : '#94a3b8' }}>
                    {n}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 5 }}>
                Costo: <strong style={{ color: '#0f172a' }}>{variantCount} crédito{variantCount > 1 ? 's' : ''}</strong>
                {credits !== null ? ` · Quedan ${credits}` : ''}</div>
            </div>
          </div>
        </div>

        {/* ══ COL 2 — STYLE SETTINGS (340px) ════════════════════════════════ */}
        <div style={css.col('340px')}>
          <div style={css.colHead}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Palette size={13} color="#7c3aed" />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>Estilo & Formato</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>Define el look del flyer</div>
            </div>
          </div>

          <div className="flyer-studio-col" style={css.colBody}>
            {/* Format (2 Columns) */}
            <div style={css.section}>
              <label style={css.label}>Formato</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {FORMATS.map(f => {
                  const IconComponent = f.icon;
                  return (
                    <button key={f.id} onClick={() => setFormat(f.id)}
                      style={{ ...css.pill(format === f.id), flexDirection: 'row' as const, alignItems: 'center', padding: '8px 10px', gap: 6 }}>
                      <IconComponent size={13} color={format === f.id ? '#0070d2' : '#54698d'} />
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: format === f.id ? '#0070d2' : '#0f172a', lineHeight: 1.1 }}>{f.label}</span>
                        <span style={{ fontSize: 9, color: '#94a3b8' }}>{f.tag}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tone (2 Columns) */}
            <div style={css.section}>
              <label style={css.label}>Tono de diseño</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {TONES.map(t => {
                  const ToneIcon = t.icon;
                  return (
                    <button key={t.key} onClick={() => setTone(t.key)}
                      style={{ ...css.pill(tone === t.key), justifyContent: 'flex-start', gap: 6, padding: '8px 10px' }}>
                      <ToneIcon size={13} color={tone === t.key ? '#0070d2' : t.color} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: tone === t.key ? '#0070d2' : '#0f172a' }}>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Brand colors */}
            <div style={css.section}>
              <label style={css.label}>Colores de marca (máx. 3)</label>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                {BRAND_COLORS.map(hex => {
                  const isSelected = colors.map(c => c.toLowerCase()).includes(hex.toLowerCase());
                  return (
                    <button
                      key={hex}
                      type="button"
                      onClick={(e) => { e.preventDefault(); toggleColor(hex); }}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: hex,
                        border: isSelected ? '2px solid #fff' : '1px solid rgba(0,0,0,0.1)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: isSelected 
                          ? '0 0 0 2px #0070d2, 0 4px 8px rgba(0,0,0,0.15)' 
                          : '0 1px 3px rgba(0,0,0,0.12)',
                        transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                        transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                        padding: 0
                      }}
                    >
                      {isSelected && (
                        <Check 
                          size={11} 
                          color={
                            hex === '#fff' || hex === '#D4AF37' || hex === '#f59e0b' || hex === '#10b981'
                              ? '#0f172a' 
                              : '#ffffff'
                          } 
                          strokeWidth={3.5} 
                        />
                      )}
                    </button>
                  );
                })}
                {colors.length > 0 && (
                  <button 
                    type="button"
                    onClick={(e) => { e.preventDefault(); setColors([]); userSelectedColors.current = true; }} 
                    style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', marginLeft: 6 }}
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Adjustments & Fine Tuning */}
            <div style={css.section}>
              <label style={css.label}>Ajustes de Escala</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569', fontWeight: 700 }}>
                    <span>Tamaño de Logo</span>
                    <span>{logoSize.toFixed(1)}x</span>
                  </div>
                  <input type="range" min="0.4" max="2.5" step="0.1" value={logoSize} onChange={e => setLogoSize(parseFloat(e.target.value))} style={{ width: '100%', height: 4 }} />
                </div>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                AI GENERATION BUTTONS — Primary: Full DALL-E 3 flyer
            ═══════════════════════════════════════════════════════════════ */}
            <div style={{ paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>

              {/* MAIN BUTTON — Full AI Flyer via DALL-E 3 */}
              <button
                onClick={() => generate('full')}
                disabled={generating || !prompt.trim()}
                style={{
                  background: generating
                    ? 'linear-gradient(135deg,#64748b,#475569)'
                    : 'linear-gradient(135deg,#7c3aed,#0070d2)',
                  border: 'none', borderRadius: 10,
                  padding: '14px 20px', fontSize: 14, fontWeight: 900,
                  color: '#fff',
                  cursor: generating || !prompt.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', justifyContent: 'center',
                  opacity: !prompt.trim() ? 0.5 : 1,
                  boxShadow: generating ? 'none' : '0 6px 20px rgba(124,58,237,0.4)',
                  transition: 'all 0.2s ease',
                  letterSpacing: '0.01em'
                }}
              >
                {generating && isFullAiFlyer ? (
                  <><Cpu size={16} style={{ animation: 'spin 1s linear infinite' }} /> gpt-image-1 creando tu flyer...</>
                ) : (
                  <><Sparkles size={16} color="#fff" fill="#fff" /> Generar Flyer Profesional con IA</>
                )}
              </button>

              {/* Description */}
              <div style={{ fontSize: 10, color: '#64748b', textAlign: 'center', lineHeight: 1.5, padding: '0 4px' }}>
                ✨ <strong>gpt-image-1</strong> crea una imagen <strong>100% original</strong> con tipografía, diseño y contenido integrado — calidad de agencia profesional
              </div>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0' }}>
                <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.06em' }}>O BIEN</span>
                <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
              </div>

              {/* SECONDARY — Template selector + background-only */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { setSelectedTemplate('A'); setPreviewMode('template'); setShowFullAiResult(false); }}
                  style={{ flex: 1, border: `1.5px solid ${selectedTemplate === 'A' && !showFullAiResult ? '#e91e8c' : '#e2e8f0'}`, borderRadius: 7, padding: '7px 6px', background: selectedTemplate === 'A' && !showFullAiResult ? '#fce4ec' : '#f8fafc', cursor: 'pointer', fontSize: 10, fontWeight: 700, color: selectedTemplate === 'A' && !showFullAiResult ? '#c2185b' : '#64748b' }}>
                  🎨 Template A
                </button>
                <button onClick={() => { setSelectedTemplate('B'); setPreviewMode('template'); setShowFullAiResult(false); }}
                  style={{ flex: 1, border: `1.5px solid ${selectedTemplate === 'B' && !showFullAiResult ? '#9b1c1c' : '#e2e8f0'}`, borderRadius: 7, padding: '7px 6px', background: selectedTemplate === 'B' && !showFullAiResult ? '#fef2f2' : '#f8fafc', cursor: 'pointer', fontSize: 10, fontWeight: 700, color: selectedTemplate === 'B' && !showFullAiResult ? '#9b1c1c' : '#64748b' }}>
                  🏢 Template B
                </button>
                <button onClick={() => generate('background')} disabled={generating || !prompt.trim()}
                  style={{ flex: 1.4, background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 7, padding: '7px 8px', fontSize: 10, fontWeight: 700, color: '#475569', cursor: generating || !prompt.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, opacity: generating || !prompt.trim() ? 0.5 : 1 }}>
                  {generating && !isFullAiFlyer ? <><Cpu size={10} style={{ animation: 'spin 1s linear infinite' }} /> Cargando...</> : <><Image size={10} color="#6366f1" /> Fondo IA</>}
                </button>
              </div>

              <style>{`
                @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
                @keyframes fadeIn{from{opacity:0}to{opacity:1}}
                @keyframes scaleIn{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}
                @keyframes pulse-ring{0%{transform:scale(0.8);opacity:1}100%{transform:scale(2.4);opacity:0}}
                .flyer-studio-col::-webkit-scrollbar { width: 5px; }
                .flyer-studio-col::-webkit-scrollbar-track { background: transparent; }
                .flyer-studio-col::-webkit-scrollbar-thumb { background: transparent; border-radius: 10px; }
                .flyer-studio-col:hover::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); }
                .flyer-studio-col::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.25); }
                .flyer-studio-col { scrollbar-width: thin; scrollbar-color: transparent transparent; }
                .flyer-studio-col:hover { scrollbar-color: rgba(0,0,0,0.15) transparent; }
              `}</style>
            </div>
          </div>
        </div>

        {/* ══ COL 3 — PREVIEW & RESULTS (flex:1) ════════════════════════════ */}
        <div style={{ ...css.col('1fr', '#f0f2f5', false), flex: 1 }}>
          <div style={{ ...css.colHead, background: '#fff', borderBottom: '1px solid #dde1e7' }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: showSuggestions ? '#f5f3ff' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {showSuggestions ? <Sparkles size={13} color="#7c3aed" /> : <Image size={13} color="#10b981" />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
                {showSuggestions ? 'Recomendaciones Meta AI' : 'Vista Previa & Resultados'}
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>
                {showSuggestions ? 'Sugerencias de alto rendimiento basadas en campañas exitosas' : generating ? 'Generando tu flyer...' : variants.length > 0 ? `${variants.length} variante${variants.length > 1 ? 's' : ''} lista${variants.length > 1 ? 's' : ''}` : 'Tu flyer aparecerá aquí'}
              </div>
            </div>
            {showSuggestions && (
              <button onClick={() => setShowSuggestions(false)} style={{ ...css.ghost, padding: '5px 10px', fontSize: 11 }}>
                Cerrar
              </button>
            )}
            {!showSuggestions && variants.length > 0 && (
              <button onClick={() => setVariants([])} style={{ ...css.ghost, padding: '5px 10px', fontSize: 11 }}>
                <RefreshCw size={11} /> Nuevo
              </button>
            )}
          </div>

          <div className="flyer-studio-col" style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16, alignItems: showSuggestions ? 'stretch' : 'center', justifyContent: showSuggestions ? 'flex-start' : 'center' }}>

            {/* Suggestions View */}
            {showSuggestions && suggestions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 480, margin: '0 auto' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textAlign: 'center' }}>
                  Selecciona una de las 3 propuestas optimizadas para aplicar los textos y colores automáticamente:
                </div>
                {suggestions.map((idea, index) => (
                  <div key={index} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10, fontWeight: 900, color: '#7c3aed', background: '#f5f3ff', padding: '3px 8px', borderRadius: 20, textTransform: 'uppercase' }}>Propuesta {index + 1}</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {idea.paleta?.map((c: string) => (
                          <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'inline-block' }} />
                        ))}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{idea.titulo}</div>
                    <div style={{ fontSize: 12, color: '#475569', fontStyle: 'italic', borderLeft: '3px solid #e2e8f0', paddingLeft: 8 }}>{idea.gancho}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                      {idea.beneficios?.map((b: string, bi: number) => (
                        <div key={bi} style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Check size={10} color="#10b981" /> {b}
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: '#0f172a', fontWeight: 700, marginTop: 4 }}>
                      CTA Sugerido: <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>{idea.cta}</span>
                    </div>
                    <button
                      onClick={() => applySuggestion(idea)}
                      style={{ ...css.btn, background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', marginTop: 8, padding: '8px 16px' }}
                    >
                      Aplicar esta propuesta
                    </button>
                  </div>
                ))}
              </div>
            )}


            {/* ══ LOADING OVERLAY while generating ══ */}
            {generating && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(7,15,43,0.88)',
                backdropFilter: 'blur(12px)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                zIndex: 50, borderRadius: 14, gap: 16,
                animation: 'fadeIn 0.3s ease'
              }}>
                <div style={{ position: 'relative', width: 72, height: 72 }}>
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '4px solid #7c3aed', animation: 'pulse-ring 1.5s ease-out infinite' }} />
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#0070d2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={28} color="#fff" />
                  </div>
                </div>
                <div style={{ color: '#fff', fontWeight: 900, fontSize: 15, textAlign: 'center' }}>DALL·E 3 creando tu flyer...</div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, textAlign: 'center', maxWidth: 220, lineHeight: 1.5 }}>Generando diseño profesional con IA — esto toma ~20 segundos</div>
              </div>
            )}

            {/* ══ EMPTY STATE — no variants yet ══ */}
            {!showFullAiResult && !bgUploadPreview && variants.length === 0 && !generating && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 14, padding: '40px 20px',
                textAlign: 'center', height: '100%', minHeight: 340
              }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed22,#0070d222)', border: '2px dashed #7c3aed40', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Wand2 size={32} color="#7c3aed" strokeWidth={1.5} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Tu flyer generado por IA aparecerá aquí</div>
                <div style={{ fontSize: 12, color: '#64748b', maxWidth: 260, lineHeight: 1.6 }}>
                  Escribe tu brief en la columna izquierda y presiona <strong>"Generar Flyer Profesional con IA"</strong>. <strong>gpt-image-1</strong> creará una imagen completa y única.
                </div>
                <div style={{ background: '#f1f5f9', borderRadius: 10, padding: '10px 16px', fontSize: 11, color: '#475569', lineHeight: 1.6, maxWidth: 280 }}>
                  💡 <strong>Tip:</strong> Cuanto más detallado sea tu brief (tipo de negocio, oferta, colores, tono), mejor será el resultado.
                </div>
              </div>
            )}

            {/* ══ CONTROL BAR (Variants & Layout) ══ */}
            {!showSuggestions && !generating && variants.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '10px 14px', borderRadius: 10, border: '1px solid #dde1e7', gap: 10, width: '100%', maxWidth: 480, boxSizing: 'border-box' }}>
                {/* Layout selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#54698d', textTransform: 'uppercase' }}>Diseño:</span>
                  <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 3, borderRadius: 6 }}>
                    <button onClick={() => { setShowFullAiResult(false); setSelectedTemplate('A'); }}
                      style={{ border: 'none', borderRadius: 4, padding: '4px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer', background: (!showFullAiResult && selectedTemplate === 'A') ? '#fff' : 'transparent', color: (!showFullAiResult && selectedTemplate === 'A') ? '#0070d2' : '#64748b', boxShadow: (!showFullAiResult && selectedTemplate === 'A') ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
                      Template A
                    </button>
                    <button onClick={() => { setShowFullAiResult(false); setSelectedTemplate('B'); }}
                      style={{ border: 'none', borderRadius: 4, padding: '4px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer', background: (!showFullAiResult && selectedTemplate === 'B') ? '#fff' : 'transparent', color: (!showFullAiResult && selectedTemplate === 'B') ? '#0070d2' : '#64748b', boxShadow: (!showFullAiResult && selectedTemplate === 'B') ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
                      Template B
                    </button>
                    <button onClick={() => setShowFullAiResult(true)}
                      style={{ border: 'none', borderRadius: 4, padding: '4px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer', background: showFullAiResult ? '#fff' : 'transparent', color: showFullAiResult ? '#0070d2' : '#64748b', boxShadow: showFullAiResult ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
                      Imagen Pura
                    </button>
                  </div>
                </div>

                {/* Variant selector */}
                {variants.length > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#54698d', textTransform: 'uppercase' }}>Variante:</span>
                    <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 3, borderRadius: 6 }}>
                      {variants.map((_, i) => (
                        <button key={i} onClick={() => setSelected(i)}
                          style={{ border: 'none', borderRadius: 4, width: 22, height: 22, fontSize: 10, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: selected === i ? '#fff' : 'transparent', color: selected === i ? '#0070d2' : '#64748b', boxShadow: selected === i ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ══ AI RESULT IMAGE ══ */}
            {!showSuggestions && !generating && (showFullAiResult || bgUploadPreview) && variants.length > 0 ? (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Full AI Image */}
                <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                  <div
                    ref={flyerRef}
                    onClick={() => setIsPreviewModalOpen(true)}
                    style={{
                      position: 'relative', borderRadius: 14, overflow: 'hidden',
                      boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
                      width: '100%',
                      maxWidth: `min(${getFlyerDimensions(format).width}px, 100%)`,
                      aspectRatio: `${getFlyerDimensions(format).width} / ${getFlyerDimensions(format).height}`,
                      cursor: 'zoom-in', border: '1px solid #dde1e7',
                      transition: 'transform 0.2s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.01)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    <img
                      src={bgUploadPreview || variants[selected]}
                      alt="Flyer Profesional con IA"
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#fff' }}
                    />
                    {/* Logo overlay */}
                    {logoPreview && (
                      <FreeLogo
                        d={{ title: '', subtitle: '', cta: '', beneficios: [], accent: '', bgImageUrl: null, logoUrl: logoPreview, industria: '', phone: '', website: '', templateId: 'direct-mockup', containerW: getFlyerDimensions(format).width, containerH: getFlyerDimensions(format).height, logoSize, logoX, logoY }}
                        onMove={(x, y) => { setLogoX(x); setLogoY(y); }}
                        onResize={s => setLogoSize(s)}
                      />
                    )}
                    {/* Hover hint */}
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.05)', opacity: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.2s', zIndex: 10 }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '0'; }}
                    >
                      <div style={{ background: 'rgba(255,255,255,0.95)', padding: '8px 16px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: '#0f172a', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>
                        🔍 Vista Previa Completa
                      </div>
                    </div>
                  </div>
                </div>
                {/* Badge */}
                <div style={{ textAlign: 'center', fontSize: 10, color: '#10b981', fontWeight: 700 }}>
                  ✅ Flyer generado con IA — 100% original y único
                </div>

                {/* Logo drag tip */}
                {logoPreview && (
                  <div style={{ fontSize: 10, color: '#64748b', textAlign: 'center', fontStyle: 'italic' }}>
                    💡 Tip: Puedes arrastrar y redimensionar el logo directamente sobre el flyer.
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>Acciones de Exportación</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setIsPreviewModalOpen(true)}
                      style={{ ...css.ghost, flex: 1, justifyContent: 'center', background: '#f8fafc', border: '1px solid #cbd5e1' }}>
                      🔍 Vista Previa Completa
                    </button>
                    <button onClick={handleDownload}
                      style={{ ...css.ghost, flex: 1, justifyContent: 'center', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontWeight: 700 }}>
                      <Download size={13} /> Descargar PNG
                    </button>
                  </div>
                  <button onClick={sendToSocialHub}
                    style={{ ...css.btn, background: 'linear-gradient(135deg,#0070d2,#005fb2)' }}>
                    <Send size={13} />
                    Enviar a Publicación (Redes Sociales)
                    <ChevronRight size={13} />
                  </button>
                  <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center', marginTop: 2 }}>
                    El flyer se abrirá en el Panel de Publicidad listo para publicar
                  </div>
                </div>

                {/* Credits status */}
                {credits !== null && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Zap size={11} color={credColor} fill={credColor} />
                    <span style={{ fontSize: 11, color: '#64748b' }}>
                      <strong style={{ color: credColor }}>{credits}</strong> créditos restantes este mes
                    </span>
                  </div>
                )}
              </div>
            ) : null}

            {/* Template preview — shown when user selects Template A or B without full AI result */}
            {!showSuggestions && !generating && !showFullAiResult && !bgUploadPreview && variants.length > 0 && (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Canvas */}
                <div style={{ display: 'flex', justifyContent: 'center', width: '100%', userSelect: 'none' }}>
                  <div
                    ref={flyerRef}
                    onClick={() => setIsPreviewModalOpen(true)}
                    style={{
                      position: 'relative', borderRadius: 14, overflow: 'hidden',
                      boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
                      width: '100%',
                      maxWidth: `min(${getFlyerDimensions(format).width}px, 100%)`,
                      aspectRatio: `${getFlyerDimensions(format).width} / ${getFlyerDimensions(format).height}`,
                      cursor: 'zoom-in', border: '1px solid #dde1e7', background: '#fff',
                      transition: 'transform 0.2s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.01)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    <div style={{
                      position: 'absolute', top: 0, left: 0,
                      transform: `scale(${getFlyerDimensions(format).width / 1080})`,
                      transformOrigin: 'top left',
                      width: 1080, height: 1080, pointerEvents: 'none'
                    }}>
                      {selectedTemplate === 'A' ? (
                        <FlyerTemplateA data={{
                          company_name: companyName || 'Mi Empresa',
                          prompt, cta: aiOptimizedText?.cta || cta || 'Contáctanos HOY',
                          headline: aiOptimizedText?.headline,
                          subheadline: aiOptimizedText?.subheadline,
                          features: aiOptimizedText?.features,
                          price: aiOptimizedText?.price,
                          highlight_title: aiOptimizedText?.highlight_title,
                          highlight_desc: aiOptimizedText?.highlight_desc,
                          benefits: aiOptimizedText?.benefits,
                          mockup_info: aiOptimizedText?.mockup_info,
                          primaryColor: colors[0] || '#e91e8c',
                          secondaryColor: colors[1] || (colors[0] ? '#0f172a' : '#1a1a2e'),
                          phone, website, logoUrl: logoPreview || undefined,
                          bgImageUrl: (previewMode === 'ai' && variants.length > 0) ? variants[selected] : undefined
                        }} />
                      ) : (
                        <FlyerTemplateB data={{
                          company_name: companyName || 'Mi Empresa',
                          prompt, cta: aiOptimizedText?.cta || cta || 'Activa HOY MISMO',
                          headline: aiOptimizedText?.headline,
                          subheadline: aiOptimizedText?.subheadline,
                          features: aiOptimizedText?.features,
                          price: aiOptimizedText?.price,
                          highlight_title: aiOptimizedText?.highlight_title,
                          highlight_desc: aiOptimizedText?.highlight_desc,
                          benefits: aiOptimizedText?.benefits,
                          mockup_info: aiOptimizedText?.mockup_info,
                          primaryColor: colors[0] || '#9b1c1c',
                          secondaryColor: colors[1] || (colors[0] ? '#0f172a' : '#1a1a2e'),
                          phone, website, logoUrl: logoPreview || undefined,
                          bgImageUrl: (previewMode === 'ai' && variants.length > 0) ? variants[selected] : undefined
                        }} />
                      )}
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>Acciones de Exportación</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setIsPreviewModalOpen(true)}
                      style={{ ...css.ghost, flex: 1, justifyContent: 'center', background: '#f8fafc', border: '1px solid #cbd5e1' }}>
                      🔍 Vista Previa Completa
                    </button>
                    <button onClick={handleDownload}
                      style={{ ...css.ghost, flex: 1, justifyContent: 'center', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontWeight: 700 }}>
                      <Download size={13} /> Descargar PNG
                    </button>
                  </div>
                  <button onClick={sendToSocialHub}
                    style={{ ...css.btn, background: 'linear-gradient(135deg,#0070d2,#005fb2)' }}>
                    <Send size={13} />
                    Enviar a Publicación (Redes Sociales)
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Hidden template render area — captured by html-to-image */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none', zIndex: -1 }}>
        <FlyerTemplateA ref={templateRefA} data={{
          company_name: companyName || 'Mi Empresa',
          prompt,
          cta: aiOptimizedText?.cta || cta || 'Contáctanos HOY',
          headline: aiOptimizedText?.headline,
          subheadline: aiOptimizedText?.subheadline,
          features: aiOptimizedText?.features,
          price: aiOptimizedText?.price,
          highlight_title: aiOptimizedText?.highlight_title,
          highlight_desc: aiOptimizedText?.highlight_desc,
          benefits: aiOptimizedText?.benefits,
          mockup_info: aiOptimizedText?.mockup_info,
          primaryColor: colors[0] || '#e91e8c',
          secondaryColor: colors[1] || (colors[0] ? '#0f172a' : '#1a1a2e'),
          phone, website,
          logoUrl: logoPreview || undefined,
          bgImageUrl: (previewMode === 'ai' && variants.length > 0) ? variants[selected] : undefined
        }} />
        <FlyerTemplateB ref={templateRefB} data={{
          company_name: companyName || 'Mi Empresa',
          prompt,
          cta: aiOptimizedText?.cta || cta || 'Activa HOY MISMO',
          headline: aiOptimizedText?.headline,
          subheadline: aiOptimizedText?.subheadline,
          features: aiOptimizedText?.features,
          price: aiOptimizedText?.price,
          highlight_title: aiOptimizedText?.highlight_title,
          highlight_desc: aiOptimizedText?.highlight_desc,
          benefits: aiOptimizedText?.benefits,
          mockup_info: aiOptimizedText?.mockup_info,
          primaryColor: colors[0] || '#9b1c1c',
          secondaryColor: colors[1] || (colors[0] ? '#0f172a' : '#1a1a2e'),
          phone, website,
          logoUrl: logoPreview || undefined,
          bgImageUrl: (previewMode === 'ai' && variants.length > 0) ? variants[selected] : undefined
        }} />
      </div>

      {/* ── HIGH FIDELITY MODAL PREVIEW ────────────────────────────────────────── */}
      {isPreviewModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(15, 23, 42, 0.82)',
          backdropFilter: 'blur(16px)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 0.2s ease-out',
          padding: 20
        }}>
          {/* Close button at top right */}
          <button 
            onClick={() => setIsPreviewModalOpen(false)}
            style={{
              position: 'absolute', top: 20, right: 20,
              background: 'rgba(255,255,255,0.1)', border: 'none',
              borderRadius: '50%', width: 40, height: 40,
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
          >
            <X size={20} color="#fff" />
          </button>

          {/* Modal Content Card */}
          <div style={{
            background: '#ffffff', borderRadius: 20,
            overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            display: 'flex', flexDirection: 'column',
            maxWidth: '90vw', maxHeight: '94vh',
            animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            {/* Header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Vista Previa en Alta Resolución</span>
                <div style={{ fontSize: 11, color: '#64748b' }}>Revisa la alineación y los textos antes de publicar</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#0070d2', background: '#eff6ff', padding: '4px 10px', borderRadius: 20 }}>
                Formato: {format.toUpperCase()}
              </span>
            </div>

            {/* Body (The Image or Live template) */}
            <div style={{ 
              background: '#f1f5f9', padding: '12px 20px', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              overflow: 'hidden',
              flex: 1,
              minHeight: 0
            }}>
              {bgUploadPreview || (showFullAiResult && variants.length > 0) ? (
                <div style={{
                  position: 'relative',
                  maxWidth: 'min(82vw, 680px)',
                  maxHeight: 'calc(94vh - 155px)',
                  width: '100%',
                  borderRadius: 14,
                  boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
                  background: '#fff',
                  overflow: 'hidden',
                  aspectRatio: `${getFlyerDimensions(format).width} / ${getFlyerDimensions(format).height}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <img
                    src={bgUploadPreview || variants[selected]}
                    alt="Flyer en Alta Resolución"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                  />
                  {logoPreview && (
                    <FreeLogo
                      d={{ title: '', subtitle: '', cta: '', beneficios: [], accent: '', bgImageUrl: null, logoUrl: logoPreview, industria: '', phone: '', website: '', templateId: 'direct-mockup', containerW: 600, containerH: 600, logoSize, logoX, logoY }}
                      onMove={(x, y) => { setLogoX(x); setLogoY(y); }}
                      onResize={(s) => setLogoSize(s)}
                    />
                  )}
                </div>
              ) : (() => {
                // Scale template to fit within available modal space (no scroll)
                const maxH = Math.min(window.innerHeight * 0.72, 650);
                const ratio = getFlyerDimensions(format).width / getFlyerDimensions(format).height;
                const fitW = Math.min(maxH * ratio, 700);
                const fitH = fitW / ratio;
                const sc = fitW / 1080;
                return (
                <div style={{
                  width: fitW, height: fitH, overflow: 'hidden', position: 'relative',
                  borderRadius: 14, boxShadow: '0 20px 50px rgba(0,0,0,0.15)', background: '#fff'
                }}>
                  {bgUploadPreview ? (
                    <img src={bgUploadPreview} alt="Flyer Vista Previa" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                  ) : (
                    <div style={{ transform: `scale(${sc})`, transformOrigin: 'top left', width: 1080, height: 1080, pointerEvents: 'none' }}>
                      {selectedTemplate === 'A' ? (
                        <FlyerTemplateA data={{
                          company_name: companyName || 'Mi Empresa', prompt,
                          cta: aiOptimizedText?.cta || cta || 'Contáctanos HOY',
                          headline: aiOptimizedText?.headline, subheadline: aiOptimizedText?.subheadline,
                          features: aiOptimizedText?.features, price: aiOptimizedText?.price,
                          highlight_title: aiOptimizedText?.highlight_title,
                          highlight_desc: aiOptimizedText?.highlight_desc,
                          benefits: aiOptimizedText?.benefits,
                          mockup_info: aiOptimizedText?.mockup_info,
                          primaryColor: colors[0] || '#e91e8c', secondaryColor: colors[1] || '#1a1a2e',
                          phone, website, logoUrl: logoPreview || undefined,
                          bgImageUrl: (previewMode === 'ai' && variants.length > 0) ? variants[selected] : undefined
                        }} />
                      ) : (
                        <FlyerTemplateB data={{
                          company_name: companyName || 'Mi Empresa', prompt,
                          cta: aiOptimizedText?.cta || cta || 'Activa HOY MISMO',
                          headline: aiOptimizedText?.headline, subheadline: aiOptimizedText?.subheadline,
                          features: aiOptimizedText?.features, price: aiOptimizedText?.price,
                          highlight_title: aiOptimizedText?.highlight_title,
                          highlight_desc: aiOptimizedText?.highlight_desc,
                          benefits: aiOptimizedText?.benefits,
                          mockup_info: aiOptimizedText?.mockup_info,
                          primaryColor: colors[0] || '#9b1c1c', secondaryColor: colors[1] || '#1a1a2e',
                          phone, website, logoUrl: logoPreview || undefined,
                          bgImageUrl: (previewMode === 'ai' && variants.length > 0) ? variants[selected] : undefined
                        }} />
                      )}
                    </div>
                  )}
                </div>
                );
              })()}
            </div>

            {/* Footer Actions */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setIsPreviewModalOpen(false)}
                style={{ ...css.ghost, background: '#fff', border: '1px solid #d8dde6', padding: '10px 20px' }}
              >
                Cerrar
              </button>
              <button 
                onClick={() => { handleDownload(); setIsPreviewModalOpen(false); }}
                style={{ ...css.ghost, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontWeight: 700, padding: '10px 20px' }}
              >
                <Download size={13} style={{ marginRight: 6 }} /> Descargar PNG
              </button>
              <button 
                onClick={() => { sendToSocialHub(); setIsPreviewModalOpen(false); }}
                style={{ ...css.btn, padding: '10px 24px', width: 'auto' }}
              >
                <Send size={13} style={{ marginRight: 6 }} /> Confirmar y Enviar a Redes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}