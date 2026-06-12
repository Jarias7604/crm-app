import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Sparkles, Download, Send, RefreshCw, Loader2,
  Zap, Image, Check, ChevronRight, Upload, X, Eye
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../services/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = 1 | 2 | 3;

const FORMATS = [
  { id: 'ig-post',     label: 'Instagram Post',   tag: '1:1',    icon: '📷' },
  { id: 'ig-portrait', label: 'Instagram Retrato', tag: '4:5',   icon: '📷' },
  { id: 'fb-post',     label: 'Facebook Post',     tag: '6:5',   icon: '👥' },
  { id: 'story',       label: 'Story / Reels',     tag: '9:16',  icon: '🎬' },
  { id: 'fb-cover',    label: 'Portada Facebook',  tag: 'Banner', icon: '🖼️' },
  { id: 'li-post',     label: 'LinkedIn',          tag: '1.91:1', icon: '💼' },
];

const TONES = [
  { key: 'premium',     label: 'Premium',     emoji: '👑', desc: 'Lujoso y exclusivo' },
  { key: 'urgente',     label: 'Urgente',     emoji: '⚡', desc: 'Impacto y acción' },
  { key: 'moderno',     label: 'Moderno',     emoji: '✦', desc: 'Minimalista y limpio' },
  { key: 'amigable',    label: 'Amigable',    emoji: '😊', desc: 'Cálido y cercano' },
  { key: 'corporativo', label: 'Corporativo', emoji: '🏢', desc: 'Profesional B2B' },
];

const ACCENT_COLORS = [
  '#0070d2','#7c3aed','#ef4444','#f59e0b','#10b981',
  '#D4AF37','#ec4899','#06b6d4','#1a1a2e','#111827',
];

// ─── Main Component ────────────────────────────────────────────────────────────
export default function FlyerStudio() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(1);
  const [generating, setGenerating] = useState(false);

  // Form state
  const [prompt, setPrompt]             = useState('');
  const [format, setFormat]             = useState('ig-post');
  const [tone, setTone]                 = useState('moderno');
  const [variantCount, setVariantCount] = useState<1|2|3>(1);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [cta, setCta]                   = useState('');
  const [logoFile, setLogoFile]         = useState<File | null>(null);
  const [logoPreview, setLogoPreview]   = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Results state
  const [variants, setVariants]           = useState<string[]>([]);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);

  // Company info
  const [companyName, setCompanyName] = useState('');
  useEffect(() => {
    if (profile?.company_id) {
      supabase.from('companies').select('name').eq('id', profile.company_id).single()
        .then(({ data }) => { if (data?.name) setCompanyName(data.name); });
      // load credit balance
      supabase.from('ai_generation_credits')
        .select('credits_used, credits_limit')
        .eq('company_id', profile.company_id)
        .order('period_start', { ascending: false })
        .limit(1).single()
        .then(({ data }) => {
          if (data) setCreditsRemaining(data.credits_limit - data.credits_used);
          else setCreditsRemaining(20); // default for new companies
        });
    }
  }, [profile]);

  function toggleColor(hex: string) {
    setSelectedColors(prev =>
      prev.includes(hex) ? prev.filter(c => c !== hex) : prev.length < 3 ? [...prev, hex] : prev
    );
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setLogoFile(f);
    const reader = new FileReader();
    reader.onload = ev => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  }

  async function handleGenerate() {
    if (!prompt.trim()) { toast.error('Describe qué quieres promocionar'); return; }
    if (creditsRemaining !== null && creditsRemaining < variantCount) {
      toast.error(`No tienes suficientes créditos. Disponibles: ${creditsRemaining}`);
      return;
    }

    setGenerating(true);
    setStep(2);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/flyer-ai-generator`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            prompt,
            company_name: companyName || 'Mi Empresa',
            cta: cta || undefined,
            colors: selectedColors,
            format,
            tone,
            variant_count: variantCount,
            company_id: profile?.company_id,
          }),
        }
      );

      const json = await res.json();

      if (!res.ok || !json.variants?.length) {
        throw new Error(json.error || 'Error generando el flyer');
      }

      setVariants(json.variants);
      setSelectedVariant(0);
      if (json.credits_remaining !== null && json.credits_remaining !== undefined) {
        setCreditsRemaining(json.credits_remaining);
      }
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || 'Error generando el flyer');
      setStep(1);
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownload(url: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `flyer-${format}-${Date.now()}.png`;
      a.click();
      toast.success('Flyer descargado');
    } catch {
      window.open(url, '_blank');
    }
  }

  async function handlePublishToSocial(url: string) {
    // Store in session and navigate to Social Hub with pre-loaded image
    sessionStorage.setItem('socialhub_prefill_image', url);
    navigate('/marketing/social');
    toast.success('Flyer enviado al Social Hub');
  }

  function handleReset() {
    setStep(1);
    setVariants([]);
    setSelectedVariant(0);
    setPrompt('');
    setCta('');
    setSelectedColors([]);
    setLogoFile(null);
    setLogoPreview('');
  }

  // ─── Styles ─────────────────────────────────────────────────────────────────
  const S = {
    page: {
      height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' as const,
      background: '#f4f6f9', fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden',
    },
    header: {
      padding: '12px 24px', borderBottom: '1px solid #d8dde6',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: '#ffffff', flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
    },
    body: { flex: 1, overflowY: 'auto' as const, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', padding: '40px 24px' },
    card: {
      background: '#ffffff', borderRadius: 12, border: '1px solid #d8dde6',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)', width: '100%', maxWidth: 720, padding: 32,
    },
    label: { fontSize: 11, fontWeight: 800, color: '#54698d', letterSpacing: '0.08em', marginBottom: 8, display: 'block' },
    input: {
      width: '100%', border: '1px solid #d8dde6', borderRadius: 8, padding: '10px 14px',
      fontSize: 13, color: '#0f172a', outline: 'none', boxSizing: 'border-box' as const,
      fontFamily: 'inherit', background: '#fff',
    },
    textarea: {
      width: '100%', border: '1px solid #d8dde6', borderRadius: 8, padding: '12px 14px',
      fontSize: 13, color: '#0f172a', outline: 'none', resize: 'vertical' as const,
      minHeight: 90, fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box' as const,
    },
    primaryBtn: {
      background: 'linear-gradient(135deg, #0070d2, #005fb2)', border: 'none', borderRadius: 8,
      padding: '13px 28px', fontSize: 13, fontWeight: 800, color: '#fff', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
    },
    ghostBtn: {
      background: '#f4f6f9', border: '1px solid #d8dde6', borderRadius: 8,
      padding: '10px 20px', fontSize: 12, fontWeight: 700, color: '#0f172a', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 6,
    },
    sectionGap: { marginBottom: 24 },
  };

  return (
    <div style={S.page}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/marketing')}
            style={{ background: '#fff', border: '1px solid #d8dde6', borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex' }}>
            <ArrowLeft size={15} color="#54698d" strokeWidth={2.5} />
          </button>
          <div>
            <div style={{ fontSize: 9, fontWeight: 900, color: '#D4AF37', letterSpacing: '0.12em' }}>ARIAS CRM · MARKETING</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#081c3b' }}>🎨 AI Flyer Studio</div>
          </div>
        </div>

        {/* Credits badge */}
        {creditsRemaining !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: creditsRemaining > 5 ? '#f0fdf4' : '#fef2f2', border: `1px solid ${creditsRemaining > 5 ? '#bbf7d0' : '#fecaca'}`, borderRadius: 20, padding: '6px 14px' }}>
            <Zap size={12} color={creditsRemaining > 5 ? '#10b981' : '#ef4444'} fill={creditsRemaining > 5 ? '#10b981' : '#ef4444'} />
            <span style={{ fontSize: 12, fontWeight: 700, color: creditsRemaining > 5 ? '#166534' : '#991b1b' }}>
              {creditsRemaining} créditos restantes
            </span>
          </div>
        )}
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div style={S.body}>

        {/* ══ STEP 1: Briefing Form ══════════════════════════════════════════ */}
        {step === 1 && (
          <div style={S.card}>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
                Crea tu flyer con IA
              </div>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                Describe tu oferta, elige el estilo y la IA generará un flyer profesional listo para publicar.
              </div>
            </div>

            {/* What to promote */}
            <div style={S.sectionGap}>
              <label style={S.label}>¿QUÉ QUIERES PROMOCIONAR? *</label>
              <textarea
                style={S.textarea}
                placeholder="Ej: Promoción de fin de mes: 30% descuento en todos los servicios de defensa personal. Incluye kit completo..."
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
              />
            </div>

            {/* CTA */}
            <div style={S.sectionGap}>
              <label style={S.label}>LLAMADA A LA ACCIÓN (CTA)</label>
              <input
                style={S.input}
                placeholder="Ej: Llama ahora · Reserva hoy · Obtén tu descuento"
                value={cta}
                onChange={e => setCta(e.target.value)}
              />
            </div>

            {/* Format */}
            <div style={S.sectionGap}>
              <label style={S.label}>FORMATO</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {FORMATS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    style={{
                      background: format === f.id ? '#eff6ff' : '#f8fafc',
                      border: `1.5px solid ${format === f.id ? '#0070d2' : '#e2e8f0'}`,
                      borderRadius: 8, padding: '10px 8px', cursor: 'pointer', textAlign: 'left' as const,
                    }}
                  >
                    <div style={{ fontSize: 14 }}>{f.icon}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: format === f.id ? '#0070d2' : '#0f172a', marginTop: 4 }}>{f.label}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{f.tag}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Tone */}
            <div style={S.sectionGap}>
              <label style={S.label}>TONO DE DISEÑO</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                {TONES.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setTone(t.key)}
                    style={{
                      background: tone === t.key ? '#eff6ff' : '#f8fafc',
                      border: `1.5px solid ${tone === t.key ? '#0070d2' : '#e2e8f0'}`,
                      borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{t.emoji}</span>
                    <div style={{ textAlign: 'left' as const }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: tone === t.key ? '#0070d2' : '#0f172a' }}>{t.label}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Brand colors */}
            <div style={S.sectionGap}>
              <label style={S.label}>COLORES DE MARCA (máx. 3)</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                {ACCENT_COLORS.map(hex => (
                  <button
                    key={hex}
                    onClick={() => toggleColor(hex)}
                    style={{
                      width: 32, height: 32, borderRadius: '50%', background: hex, border: 'none', cursor: 'pointer',
                      outline: selectedColors.includes(hex) ? `3px solid ${hex}` : '3px solid transparent',
                      outlineOffset: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'outline 0.1s',
                    }}
                  />
                ))}
                {selectedColors.length > 0 && (
                  <button onClick={() => setSelectedColors([])}
                    style={{ fontSize: 11, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* Variant count */}
            <div style={S.sectionGap}>
              <label style={S.label}>¿CUÁNTAS VARIANTES? (1 crédito por variante)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {([1, 2, 3] as const).map(n => (
                  <button
                    key={n}
                    onClick={() => setVariantCount(n)}
                    style={{
                      width: 56, height: 56, borderRadius: 8, border: `1.5px solid ${variantCount === n ? '#0070d2' : '#e2e8f0'}`,
                      background: variantCount === n ? '#eff6ff' : '#f8fafc', cursor: 'pointer',
                      fontSize: 20, fontWeight: 900, color: variantCount === n ? '#0070d2' : '#64748b',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                Cada variante tiene una composición diferente. Recomendamos 1 para probar primero.
              </div>
            </div>

            {/* Logo upload */}
            <div style={{ ...S.sectionGap, marginBottom: 32 }}>
              <label style={S.label}>LOGO / IMAGEN DE REFERENCIA (opcional)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  onClick={() => logoInputRef.current?.click()}
                  style={{ ...S.ghostBtn, flexShrink: 0 }}
                >
                  <Upload size={13} /> {logoFile ? 'Cambiar' : 'Subir logo'}
                </button>
                {logoPreview && (
                  <div style={{ position: 'relative', display: 'inline-flex' }}>
                    <img src={logoPreview} alt="logo" style={{ height: 40, width: 40, objectFit: 'contain', borderRadius: 6, border: '1px solid #e2e8f0' }} />
                    <button onClick={() => { setLogoFile(null); setLogoPreview(''); }}
                      style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', border: 'none', borderRadius: '50%', width: 16, height: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={10} color="#fff" />
                    </button>
                  </div>
                )}
                {logoFile && <span style={{ fontSize: 11, color: '#64748b' }}>{logoFile.name}</span>}
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
            </div>

            {/* Generate button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                Gasta <strong style={{ color: '#0f172a' }}>{variantCount} crédito{variantCount > 1 ? 's' : ''}</strong>
                {creditsRemaining !== null ? ` · Quedan ${creditsRemaining}` : ''}
              </div>
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim()}
                style={{
                  ...S.primaryBtn,
                  opacity: !prompt.trim() ? 0.5 : 1,
                  cursor: !prompt.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                <Sparkles size={14} color="#D4AF37" fill="#D4AF37" />
                Generar con IA
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ══ STEP 2: Generating ════════════════════════════════════════════ */}
        {step === 2 && (
          <div style={{ ...S.card, textAlign: 'center', padding: '64px 32px' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #0070d2, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <Sparkles size={28} color="#fff" />
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
              Generando tu flyer con IA
            </div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 32 }}>
              {variantCount > 1 ? `Creando ${variantCount} variantes...` : 'Procesando con gpt-image-1...'}
              <br />Esto toma entre 15 y 45 segundos.
            </div>
            <div style={{ width: '100%', maxWidth: 320, height: 6, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden', margin: '0 auto' }}>
              <div style={{
                height: '100%', background: 'linear-gradient(90deg, #0070d2, #7c3aed)',
                borderRadius: 99, animation: 'progress-shimmer 2s ease-in-out infinite',
                width: '60%',
              }} />
            </div>
            <style>{`@keyframes progress-shimmer { 0%{width:20%} 50%{width:80%} 100%{width:60%} }`}</style>
          </div>
        )}

        {/* ══ STEP 3: Results ═══════════════════════════════════════════════ */}
        {step === 3 && variants.length > 0 && (
          <div style={{ width: '100%', maxWidth: 900 }}>

            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                  {variants.length > 1 ? `${variants.length} variantes generadas` : 'Flyer generado'}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Selecciona una variante y descárgala o publícala directamente.
                </div>
              </div>
              <button onClick={handleReset} style={S.ghostBtn}>
                <RefreshCw size={13} /> Generar otro
              </button>
            </div>

            {/* Variants grid */}
            <div style={{ display: 'grid', gridTemplateColumns: variants.length === 1 ? '1fr' : variants.length === 2 ? '1fr 1fr' : '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
              {variants.map((url, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedVariant(i)}
                  style={{
                    borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
                    border: `2px solid ${selectedVariant === i ? '#0070d2' : '#e2e8f0'}`,
                    boxShadow: selectedVariant === i ? '0 0 0 3px #bfdbfe' : '0 2px 8px rgba(0,0,0,0.06)',
                    transition: 'all 0.15s', position: 'relative',
                  }}
                >
                  {selectedVariant === i && (
                    <div style={{ position: 'absolute', top: 8, right: 8, background: '#0070d2', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                      <Check size={13} color="#fff" />
                    </div>
                  )}
                  <img src={url} alt={`Variante ${i + 1}`} style={{ width: '100%', display: 'block', objectFit: 'cover' }} />
                  {variants.length > 1 && (
                    <div style={{ padding: '8px 12px', background: selectedVariant === i ? '#eff6ff' : '#f8fafc', fontSize: 11, fontWeight: 700, color: selectedVariant === i ? '#0070d2' : '#64748b' }}>
                      Variante {i + 1}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Action buttons for selected variant */}
            <div style={{ ...S.card, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {creditsRemaining !== null && (
                  <><Zap size={11} color="#10b981" style={{ display: 'inline', marginRight: 4 }} />
                  <strong style={{ color: '#0f172a' }}>{creditsRemaining}</strong> créditos restantes este mes</>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => window.open(variants[selectedVariant], '_blank')}
                  style={{ ...S.ghostBtn }}
                >
                  <Eye size={13} /> Ver en pantalla completa
                </button>
                <button
                  onClick={() => handleDownload(variants[selectedVariant])}
                  style={{ ...S.ghostBtn, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}
                >
                  <Download size={13} /> Descargar
                </button>
                <button
                  onClick={() => handlePublishToSocial(variants[selectedVariant])}
                  style={S.primaryBtn}
                >
                  <Send size={13} /> Publicar en Social Hub
                </button>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}