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
import { RenderFlyer, FreeLogo, TEMPLATE_LIST } from './FlyerTemplates';
import type { FlyerData } from './FlyerTemplates';

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

const getFlyerDimensions = (formatId: string) => {
  switch (formatId) {
    case 'ig-post': return { width: 340, height: 340 };
    case 'ig-portrait': return { width: 300, height: 375 };
    case 'fb-post': return { width: 340, height: 283 };
    case 'story': return { width: 240, height: 426 };
    case 'fb-cover': return { width: 380, height: 144 };
    case 'li-post': return { width: 380, height: 200 };
    default: return { width: 340, height: 340 };
  }
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function FlyerStudio() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const flyerRef = useRef<HTMLDivElement>(null);

  // Form & Content States
  const [prompt, setPrompt] = useState('');
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

  // AI suggestions (Sprint 4)
  const [optimizing, setOptimizing] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (!profile?.company_id) return;
    supabase.from('companies').select('name').eq('id', profile.company_id).single()
      .then(({ data }) => { if (data?.name) setCompanyName(data.name); });
    supabase.from('ai_generation_credits')
      .select('credits_used,credits_limit').eq('company_id', profile.company_id)
      .order('period_start', { ascending: false }).limit(1).single()
      .then(({ data }) => setCredits(data ? data.credits_limit - data.credits_used : 20));
  }, [profile]);

  function toggleColor(hex: string) {
    setColors(p => p.includes(hex) ? p.filter(c => c !== hex) : p.length < 3 ? [...p, hex] : p);
  }

  async function generate() {
    if (!prompt.trim()) { toast.error('Describe qué quieres promocionar'); return; }
    setGenerating(true);
    setVariants([]);
    try {
      const { data, error } = await supabase.functions.invoke('flyer-ai-generator', {
        body: {
          prompt,
          company_name: companyName || 'Mi Empresa',
          cta: cta || undefined,
          colors,
          format,
          tone,
          variant_count: variantCount,
          company_id: profile?.company_id
        }
      });
      if (error || !data?.variants?.length) throw new Error(error?.message || data?.error || 'Error generando');
      setVariants(data.variants);
      setSelected(0);
      if (data.credits_remaining != null) setCredits(data.credits_remaining);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
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
    // Build enriched prompt from AI suggestion
    const parts: string[] = [];
    if (idea.titulo) parts.push(idea.titulo);
    if (idea.gancho) parts.push(idea.gancho);
    if (idea.beneficios?.length) parts.push('Beneficios: ' + idea.beneficios.join(', '));
    if (idea.cta) parts.push('CTA: ' + idea.cta);
    if (parts.length) setPrompt(parts.join(' — '));
    if (idea.paleta && idea.paleta.length > 0) {
      setColors(idea.paleta.slice(0, 3));
    }
    if (idea.tono) setTone(idea.tono);
    setShowSuggestions(false);
    toast.success('Sugerencia de Meta AI aplicada al flyer');
  }

  async function handleDownload() {
    if (!flyerRef.current) return;
    setGenerating(true);
    try {
      const canvas = await html2canvas(flyerRef.current, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
        backgroundColor: null
      });
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `flyer-${format}-${Date.now()}.png`;
      a.click();
      toast.success('Flyer personalizado descargado con éxito');
    } catch (err: any) {
      console.error('Error al capturar flyer:', err);
      toast.error('Error al generar la descarga del flyer');
    } finally {
      setGenerating(false);
    }
  }

  async function sendToSocialHub() {
    if (!flyerRef.current) return;
    setGenerating(true);
    try {
      const canvas = await html2canvas(flyerRef.current, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
        backgroundColor: null
      });
      const dataUrl = canvas.toDataURL('image/png');
      sessionStorage.setItem('socialhub_prefill_image', dataUrl);
      navigate('/marketing/social');
      toast.success('✅ Flyer enviado al Panel de Publicidad');
    } catch (err: any) {
      console.error('Error sending to Social Hub:', err);
      toast.error('Error al preparar el flyer para publicar');
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

          <div style={css.colBody}>
            {/* Prompt */}
            <div style={css.section}>
              <label style={css.label}>1. ¿Cuál es tu oferta o idea? *</label>
              <textarea
                style={css.textarea}
                placeholder="Ej: Descuento de verano en facturación electrónica. 100% en la nube y rápido..."
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
              />
              {prompt.trim().length > 3 && (
                <button
                  onClick={optimizeWithMetaAI}
                  disabled={optimizing}
                  style={{
                    marginTop: 8,
                    background: 'linear-gradient(135deg, #7c3aed, #0070d2)',
                    border: 'none',
                    borderRadius: 7,
                    padding: '7px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    width: '100%',
                    boxShadow: '0 2px 5px rgba(124, 58, 237, 0.2)'
                  }}
                >
                  {optimizing ? (
                    <><Cpu size={12} style={{ animation: 'spin 1s linear infinite' }} /> Analizando con Meta AI...</>
                  ) : (
                    <><Sparkles size={12} color="#D4AF37" fill="#D4AF37" /> Autocompletar con Meta AI</>
                  )}
                </button>
              )}
            </div>

            {/* Contact Info */}
            <div style={css.section}>
              <label style={css.label}>2. Datos de Contacto (Se incluirán en el diseño)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input style={css.input} placeholder="Teléfono (Ej: 7971-8911)"
                  value={phone} onChange={e => setPhone(e.target.value)} />
                <input style={css.input} placeholder="Sitio Web (Ej: www.ariasdefense.com)"
                  value={website} onChange={e => setWebsite(e.target.value)} />
              </div>
            </div>

            {/* Logo */}
            <div style={css.section}>
              <label style={css.label}>7. Logo de la Empresa</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => logoRef.current?.click()} style={{ ...css.ghost, fontSize: 11, padding: '7px 12px', flex: 1 }}>
                  <Upload size={12} /> {logoFile ? 'Cambiar logo' : 'Subir logo'}
                </button>
                {logoPreview && (
                  <div style={{ position: 'relative', display: 'inline-flex' }}>
                    <img src={logoPreview} alt="logo" style={{ height: 36, width: 36, objectFit: 'contain', borderRadius: 5, border: '1px solid #e2e8f0' }} />
                    <button onClick={() => { setLogoFile(null); setLogoPreview(''); }} style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', border: 'none', borderRadius: '50%', width: 14, height: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={9} color="#fff" />
                    </button>
                  </div>
                )}
              </div>
              <input ref={logoRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (!f) return; setLogoFile(f); const r = new FileReader(); r.onload = ev => setLogoPreview(ev.target?.result as string); r.readAsDataURL(f); }} style={{ display: 'none' }} />
            </div>

            {/* Custom Flyer Background Image Upload (Ya hecho) */}
            <div style={css.section}>
              <label style={css.label}>8. Cargar Flyer ya Diseñado (Ya hecho)</label>
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
              <label style={css.label}>Variantes de Imagen de Fondo (1 crédito c/u)</label>
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

          <div style={css.colBody}>
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
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' as const }}>
                {BRAND_COLORS.map(hex => (
                  <button key={hex} onClick={() => toggleColor(hex)}
                    style={{ width: 24, height: 24, borderRadius: '50%', background: hex, border: 'none', cursor: 'pointer', outline: colors.includes(hex) ? `2px solid ${hex}` : '2px solid transparent', outlineOffset: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.18)', transition: 'outline 0.1s' }} />
                ))}
                {colors.length > 0 && <button onClick={() => setColors([])} style={{ fontSize: 10, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Limpiar</button>}
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

            {/* Generate button */}
            <div style={{ paddingTop: 8 }}>
              <button onClick={generate} disabled={generating || !prompt.trim()}
                style={{ ...css.btn, opacity: generating || !prompt.trim() ? 0.5 : 1, cursor: generating || !prompt.trim() ? 'not-allowed' : 'pointer', padding: '12px 20px' }}>
                {generating
                  ? <><Cpu size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generando Imagen de Fondo con IA...</>
                  : <><Sparkles size={14} color="#D4AF37" fill="#D4AF37" /> Generar Imagen de Fondo con IA <ChevronRight size={13} /></>
                }
              </button>
              <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
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

          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16, alignItems: showSuggestions ? 'stretch' : 'center', justifyContent: showSuggestions ? 'flex-start' : 'center' }}>

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

            {/* Live Template Preview */}
            {!showSuggestions && !generating && (
              <div style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Variant selector tabs if there are multiple variants generated */}
                {variants.length > 1 && (
                  <div style={{ display: 'flex', gap: 8, background: '#fff', padding: 8, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    {variants.map((_, i) => (
                      <button key={i} onClick={() => setSelected(i)}
                        style={{ flex: 1, padding: '7px', borderRadius: 6, border: `1.5px solid ${selected === i ? '#0070d2' : '#e2e8f0'}`, background: selected === i ? '#eff6ff' : '#f8fafc', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: selected === i ? '#0070d2' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        {selected === i && <Check size={10} />} Variante {i + 1}
                      </button>
                    ))}
                  </div>
                )}

                {/* ── FLYER CANVAS: Pure image from DALL-E 3 or uploaded flyer ── */}
                {(bgUploadPreview || variants.length > 0) ? (
                  <div style={{ display: 'flex', justifyContent: 'center', width: '100%', userSelect: 'none' }}>
                    <div
                      ref={flyerRef}
                      style={{
                        position: 'relative',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.22)',
                        width: getFlyerDimensions(format).width,
                        height: getFlyerDimensions(format).height,
                        flexShrink: 0,
                      }}
                    >
                      {/* The actual AI-generated or uploaded flyer image — full bleed, no HTML overlays */}
                      <img
                        src={bgUploadPreview || variants[selected]}
                        alt="Flyer generado"
                        crossOrigin="anonymous"
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                      {/* Logo overlay — only if user uploaded a logo (draggable) */}
                      {logoPreview && (
                        <FreeLogo
                          d={{ title: '', subtitle: '', cta: '', beneficios: [], accent: '', bgImageUrl: null, logoUrl: logoPreview, industria: '', phone: '', website: '', templateId: 'direct-mockup', containerW: getFlyerDimensions(format).width, containerH: getFlyerDimensions(format).height, logoSize, logoX, logoY }}
                          onMove={(x, y) => { setLogoX(x); setLogoY(y); }}
                          onResize={(s) => setLogoSize(s)}
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  /* Empty state — nothing generated yet */
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40, background: '#fff', borderRadius: 12, border: '2px dashed #e2e8f0', width: '100%', maxWidth: 400 }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#0070d2,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Wand2 size={24} color="#fff" />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>Listo para crear tu flyer</div>
                      <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>Describe tu flyer en el panel izquierdo<br />y presiona <strong>"Generar Imagen con IA"</strong></div>
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center', background: '#f8fafc', padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      💡 La IA usará el motor de DALL-E 3 (mismo que ChatGPT) para crear un flyer 100% profesional
                    </div>
                  </div>
                )}

                {/* Drag hint */}
                {logoPreview && (
                  <div style={{ fontSize: 10, color: '#64748b', textAlign: 'center', fontStyle: 'italic' }}>
                    💡 Tip: Puedes arrastrar y redimensionar el logo directamente sobre el flyer.
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>Acciones de Exportación</div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleDownload}
                      style={{ ...css.ghost, flex: 1, justifyContent: 'center', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontWeight: 700 }}>
                      <Download size={13} /> Descargar Flyer PNG
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}