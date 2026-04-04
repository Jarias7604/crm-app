import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Download, Sparkles, Palette, Phone, Globe, ChevronRight, ChevronDown, Search, Loader2, ImageIcon, RefreshCw, Upload, Monitor } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../services/supabase';
import { flyerService } from '../../services/flyerService';
import type { FlyerData } from './FlyerTemplates';
import { TEMPLATES, TEMPLATE_LIST } from './FlyerTemplates';

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface FlyerIdea {
  titulo: string;
  gancho: string;
  beneficios: string[];
  cta: string;
  paleta: string[];
  tono: string;
}

// ─── TONES ────────────────────────────────────────────────────────────────────
const TONES = [
  { key: 'premium',    label: 'Premium',    emoji: '👑' },
  { key: 'urgente',    label: 'Urgente',    emoji: '⚡' },
  { key: 'moderno',    label: 'Moderno',    emoji: '✦' },
  { key: 'amigable',   label: 'Amigable',   emoji: '😊' },
  { key: 'corporativo',label: 'Corporativo',emoji: '🏢' },
];

const ACCENT_COLORS = ['#1a56db','#7c3aed','#ef4444','#f59e0b','#10b981','#0ea5e9','#D4AF37','#ec4899','#06b6d4','#84cc16'];

// ─── CANVAS SIZES ─────────────────────────────────────────────────────────────
const CANVAS_SIZES = [
  { id: 'ig-post',      label: 'Instagram Post',    icon: '📷', platform: 'Instagram', w: 1080, h: 1080, tag: '1:1' },
  { id: 'ig-portrait', label: 'Instagram Retrato',  icon: '📷', platform: 'Instagram', w: 1080, h: 1350, tag: '4:5' },
  { id: 'ig-story',    label: 'Instagram Story',    icon: '📱', platform: 'Instagram', w: 1080, h: 1920, tag: '9:16' },
  { id: 'fb-post',     label: 'Facebook Post',      icon: '👥', platform: 'Facebook',  w: 940,  h: 788,  tag: '6:5' },
  { id: 'fb-cover',    label: 'Facebook Portada',   icon: '👥', platform: 'Facebook',  w: 820,  h: 312,  tag: 'Banner' },
  { id: 'li-post',     label: 'LinkedIn Post',      icon: '💼', platform: 'LinkedIn',  w: 1200, h: 628,  tag: '1.91:1' },
  { id: 'li-square',   label: 'LinkedIn Cuadrado',  icon: '💼', platform: 'LinkedIn',  w: 1200, h: 1200, tag: '1:1' },
  { id: 'tw-post',     label: 'Twitter / X',        icon: '🐦', platform: 'Twitter',   w: 1200, h: 675,  tag: '16:9' },
  { id: 'yt-thumb',    label: 'YouTube Thumbnail',  icon: '▶️', platform: 'YouTube',   w: 1280, h: 720,  tag: '16:9' },
  { id: 'tiktok',      label: 'TikTok / Reels',     icon: '🎵', platform: 'TikTok',    w: 1080, h: 1920, tag: '9:16' },
  { id: 'wa-status',   label: 'WhatsApp Status',    icon: '💬', platform: 'WhatsApp', w: 1080, h: 1920, tag: '9:16' },
  { id: 'pinterest',   label: 'Pinterest Pin',      icon: '📌', platform: 'Pinterest', w: 1000, h: 1500, tag: '2:3' },
];

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function FlyerStudio() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const flyerRef = useRef<HTMLDivElement>(null); // hidden full-size for export

  // Steps
  const [step, setStep]           = useState(1);
  const [isLoadingIdeas, setIsLoadingIdeas] = useState(false);
  const [isLoadingImg, setIsLoadingImg]   = useState(false);
  const [isExporting, setIsExporting]   = useState(false);

  // Step 1 — form
  const [industries, setIndustries] = useState<Array<{id:string;name:string}>>([]);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [oferta, setOferta]         = useState('');
  const [tono, setTono]             = useState('premium');

  // Step 2 — ideas
  const [ideas, setIdeas] = useState<FlyerIdea[]>([]);

  // Industry dropdown state
  const [isIndustryOpen, setIsIndustryOpen] = useState(false);
  const [industrySearch, setIndustrySearch]  = useState('');
  const industryDropRef = useRef<HTMLDivElement>(null);

  // Step 3 — canvas size + photo upload
  const [selectedSize, setSelectedSize] = useState(CANVAS_SIZES[1]); // default: Instagram 4:5
  const [isSizeOpen, setIsSizeOpen]     = useState(false);
  const sizeDropRef = useRef<HTMLDivElement>(null);
  const [photoMode, setPhotoMode]       = useState<'ai' | 'upload'>('ai');
  const [userPhotos, setUserPhotos]     = useState<string[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (industryDropRef.current && !industryDropRef.current.contains(e.target as Node)) {
        setIsIndustryOpen(false);
      }
      if (sizeDropRef.current && !sizeDropRef.current.contains(e.target as Node)) {
        setIsSizeOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Handle photo uploads → convert to data URLs
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 3);
    if (!files.length) return;
    const readers = files.map(file => new Promise<string>(resolve => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.readAsDataURL(file);
    }));
    Promise.all(readers).then(urls => {
      setUserPhotos(urls);
      // Use first photo as flyer background immediately
      setFlyerData(prev => ({ ...prev, bgImageUrl: urls[0] }));
      toast.success(`${urls.length} foto${urls.length > 1 ? 's' : ''} cargada${urls.length > 1 ? 's' : ''}`);
    });
  };

  // Step 3 — flyer data
  const [flyerData, setFlyerData] = useState<FlyerData>({
    title: '', subtitle: '', cta: '', beneficios: [],
    accent: '#1a56db', bgImageUrl: null, logoUrl: null,
    industria: '', phone: '', website: '', templateId: 'bold-split',
  });

  // Load industries from DB + company defaults
  useEffect(() => {
    (async () => {
      const { data: ind } = await supabase
        .from('industries')
        .select('id, name')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (ind?.length) setIndustries(ind);

      const { data: comp } = await supabase
        .from('companies')
        .select('logo_url, phone, website')
        .eq('id', profile?.company_id || '')
        .single();
      if (comp) {
        setFlyerData(prev => ({ ...prev, logoUrl: comp.logo_url, phone: comp.phone || '', website: comp.website || '' }));
      }
    })();
  }, [profile?.company_id]);

  // ─── STEP 1 → 2: Generate ideas ────────────────────────────────────────────
  const handleGenerateIdeas = async () => {
    if (!selectedIndustries.length || !oferta.trim()) {
      toast.error('Selecciona al menos un rubro y describe tu oferta');
      return;
    }
    const industriaStr = selectedIndustries.join(', ');
    setIsLoadingIdeas(true);
    try {
      const result = await flyerService.recommendIdeas({
        industria: industriaStr,
        oferta,
        tono,
        companyId: profile?.company_id || '',
        idioma: 'es',
      });
      setIdeas(result);
      setStep(2);
    } catch {
      // Premium AI fallback
      setIdeas([
        {
          titulo: `${industriaStr.toUpperCase()} PREMIUM`,
          gancho: `La mejor solución en ${industriaStr} para tu negocio`,
          beneficios: ['Calidad garantizada', 'Atención personalizada', 'Resultados inmediatos'],
          cta: 'CONTÁCTANOS HOY',
          paleta: ['#1a56db'],
          tono,
        },
        {
          titulo: 'OFERTA ESPECIAL',
          gancho: `Aprovecha nuestra promoción en ${industriaStr}`,
          beneficios: ['Precio competitivo', 'Entrega inmediata', 'Garantía incluida'],
          cta: 'VER OFERTA',
          paleta: ['#f59e0b'],
          tono,
        },
        {
          titulo: `LÍDERES EN ${industriaStr.toUpperCase()}`,
          gancho: 'Te ayudamos a crecer con los mejores recursos del mercado',
          beneficios: ['Experiencia comprobada', 'Tecnología de punta', 'Soporte 24/7'],
          cta: 'SABER MÁS',
          paleta: ['#10b981'],
          tono,
        },
      ]);
      setStep(2);
    } finally {
      setIsLoadingIdeas(false);
    }
  };

  // ─── STEP 2 → 3: Select idea & generate image ──────────────────────────────
  const handleSelectIdea = async (idea: FlyerIdea) => {
    const accent = idea.paleta?.[0] || '#1a56db';
    setFlyerData(prev => ({
      ...prev,
      title: idea.titulo || '',
      subtitle: idea.gancho || '',
      cta: idea.cta || 'CONTÁCTANOS',
      beneficios: idea.beneficios || [],
      accent,
      bgImageUrl: null,
      industria: selectedIndustries[0] || selectedIndustries.join(', '),
    }));
    setStep(3);
    await generateImage(idea, accent);
  };

  const generateImage = async (idea: FlyerIdea, accent: string) => {
    setIsLoadingImg(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/flyer-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
        body: JSON.stringify({ idea, industria: selectedIndustries.join(', '), oferta, tono }),
      });
      const data = await res.json();
      if (data.fondo_url) {
        setFlyerData(prev => ({ ...prev, bgImageUrl: data.fondo_url }));
      } else {
        toast.error('Imagen IA no disponible — usando diseño estructural');
      }
    } catch {
      toast.error('Usando diseño sin foto de fondo');
    } finally {
      setIsLoadingImg(false);
    }
  };

  // ─── EXPORT via html2canvas ─────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (!flyerRef.current) return;
    setIsExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(flyerRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: null,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `flyer-${flyerData.title.toLowerCase().replace(/\s+/g, '-') || 'premium'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('¡Flyer exportado en alta resolución!');
    } catch (e) {
      console.error(e);
      toast.error('Error al exportar');
    } finally {
      setIsExporting(false);
    }
  }, [flyerData.title]);

  // ─── SAVE TO CRM ────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!flyerRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(flyerRef.current, { scale: 2, useCORS: true, backgroundColor: null });
      const blob = await new Promise<Blob>((res) => canvas.toBlob(b => res(b!), 'image/png'));
      const url = await flyerService.uploadFlyer(blob, profile?.company_id || 'shared');
      await flyerService.saveFlyer({
        company_id: profile!.company_id!,
        image_url: url,
        prompt_used: flyerData.subtitle,
        titulo: flyerData.title,
        status: 'ready',
      });
      toast.success('¡Guardado en Galería!');
    } catch {
      toast.error('Error al guardar');
    }
  }, [flyerData, profile]);

  // ─── ACTIVE TEMPLATE COMPONENT ──────────────────────────────────────────────
  const ActiveTemplate = TEMPLATES[flyerData.templateId] || TEMPLATES['bold-split'];

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <header style={{
        height: 60, background: '#fff', borderBottom: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => step > 1 ? setStep(step - 1) : navigate('/marketing')}
            style={{ borderRadius: 10, background: '#f1f5f9', border: 'none', padding: 8, cursor: 'pointer', display: 'flex' }}
          >
            <ArrowLeft size={18} color="#64748b" />
          </button>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#D4AF37', letterSpacing: '0.1em' }}>ARIAS FLYER STUDIO</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#0f172a' }}>Motor de Marketing IA</div>
          </div>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {['Datos', 'Diseño', 'Estudio'].map((label, i) => {
            const s = i + 1;
            const active = step === s;
            const done = step > s;
            return (
              <React.Fragment key={s}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 8,
                    background: done ? '#10b981' : active ? '#D4AF37' : '#e2e8f0',
                    color: done || active ? '#fff' : '#94a3b8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 900,
                  }}>
                    {done ? '✓' : s}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: active ? 800 : 500, color: active ? '#0f172a' : '#94a3b8' }}>
                    {label}
                  </span>
                </div>
                {s < 3 && <ChevronRight size={14} color="#cbd5e1" />}
              </React.Fragment>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          {step === 3 && (
            <>
              <button
                onClick={handleSave}
                style={{ background: '#f1f5f9', color: '#0f172a', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Guardar
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting}
                style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Download size={14} />
                {isExporting ? 'Exportando...' : 'Exportar PNG'}
              </button>
            </>
          )}
        </div>
      </header>

      {/* ── MAIN ───────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflow: 'hidden', padding: 20 }}>

        {/* ══ STEP 1 ══════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div style={{ maxWidth: 860, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, height: '100%' }}>

            {/* Left: Offer */}
            <div style={{ background: '#fff', borderRadius: 20, padding: 28, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#D4AF37', letterSpacing: '0.08em', marginBottom: 6 }}>PASO 1 DE 3</div>
                <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: 0 }}>¿Qué quieres promocionar?</h2>
                <p style={{ fontSize: 13, color: '#64748b', marginTop: 6, marginBottom: 0 }}>Describe tu oferta con el mayor detalle posible — la IA la usará para crear contenido relevante.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', letterSpacing: '0.06em' }}>TU OFERTA / SERVICIO / PRODUCTO</label>
                <textarea
                  value={oferta}
                  onChange={e => setOferta(e.target.value)}
                  placeholder="Ej: Vendo terrenos en Costa del Sol con vista al mar, cerca del aeropuerto, desde $25,000. Plazos disponibles, escritura incluida..."
                  rows={7}
                  style={{
                    flex: 1, padding: '14px 16px', borderRadius: 12,
                    border: '1.5px solid #e2e8f0', fontSize: 14, fontWeight: 400,
                    color: '#0f172a', resize: 'none', outline: 'none', lineHeight: 1.6,
                    fontFamily: 'inherit', transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#D4AF37'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>

              <button
                onClick={handleGenerateIdeas}
                disabled={isLoadingIdeas || !selectedIndustries.length || !oferta.trim()}
                style={{
                  background: !selectedIndustries.length || !oferta.trim() ? '#e2e8f0' : 'linear-gradient(135deg, #D4AF37, #f59e0b)',
                  color: !selectedIndustries.length || !oferta.trim() ? '#94a3b8' : '#000',
                  border: 'none', borderRadius: 14, padding: '16px 24px',
                  fontSize: 14, fontWeight: 900, cursor: !selectedIndustries.length || !oferta.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: !selectedIndustries.length || !oferta.trim() ? 'none' : '0 8px 24px rgba(212,175,55,0.35)',
                  transition: 'all 0.2s',
                }}
              >
                {isLoadingIdeas ? <><Loader2 size={18} className="animate-spin" /> Generando ideas...</> : <><Sparkles size={18} /> Generar ideas con IA</>}
              </button>
            </div>

            {/* Right: Industry + Tone */}
            <div style={{ background: '#fff', borderRadius: 20, padding: 28, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Industry dropdown */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>RUBRO / INDUSTRIA</label>
                <div ref={industryDropRef} style={{ position: 'relative' }}>
                  {/* Trigger — shows pills for each selected */}
                  <button
                    onClick={() => { setIsIndustryOpen(o => !o); setIndustrySearch(''); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6,
                      padding: '10px 12px', borderRadius: 12, cursor: 'pointer', minHeight: 48,
                      border: `1.5px solid ${selectedIndustries.length ? '#D4AF37' : '#e2e8f0'}`,
                      background: selectedIndustries.length ? '#fffbeb' : '#fff',
                      transition: 'all 0.15s', boxShadow: isIndustryOpen ? '0 0 0 3px rgba(212,175,55,0.15)' : 'none',
                    }}
                  >
                    {selectedIndustries.length > 0 ? (
                      <>
                        {selectedIndustries.map(name => {
                          const hue = name.charCodeAt(0) * 5 % 360;
                          return (
                            <span key={name} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              background: `hsl(${hue}, 65%, 55%)`, color: '#fff',
                              fontSize: 12, fontWeight: 700, padding: '4px 10px',
                              borderRadius: 20, whiteSpace: 'nowrap',
                            }}>
                              {name}
                              <span
                                onClick={e => { e.stopPropagation(); setSelectedIndustries(prev => prev.filter(i => i !== name)); }}
                                style={{ cursor: 'pointer', fontSize: 14, lineHeight: 1, opacity: 0.85 }}
                              >×</span>
                            </span>
                          );
                        })}
                        <ChevronDown size={14} color="#92400e" style={{ marginLeft: 'auto', transform: isIndustryOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }} />
                      </>
                    ) : (
                      <>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Search size={13} color="#94a3b8" />
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 500, color: '#94a3b8', flex: 1, textAlign: 'left' }}>Selecciona uno o más rubros...</span>
                        <ChevronDown size={16} color="#94a3b8" style={{ transform: isIndustryOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                      </>
                    )}
                  </button>

                  {/* Dropdown panel */}
                  {isIndustryOpen && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50,
                      background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0',
                      boxShadow: '0 12px 40px rgba(0,0,0,0.12)', overflow: 'hidden',
                      animation: 'dropIn 0.15s ease',
                    }}>
                      {/* Search inside dropdown */}
                      <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Search size={14} color="#94a3b8" />
                        <input
                          autoFocus
                          value={industrySearch}
                          onChange={e => setIndustrySearch(e.target.value)}
                          placeholder="Buscar rubro..."
                          style={{ border: 'none', outline: 'none', fontSize: 13, color: '#374151', flex: 1, background: 'transparent' }}
                        />
                      </div>
                      {/* List */}
                      <div style={{ maxHeight: 220, overflowY: 'auto', padding: '6px 0' }}>
                        {industries
                          .filter(ind => ind.name.toLowerCase().includes(industrySearch.toLowerCase()))
                          .map(ind => {
                            const hue = ind.name.charCodeAt(0) * 5 % 360;
                            const isSelected = selectedIndustries.includes(ind.name);
                            return (
                              <button
                                key={ind.id}
                                onClick={() => setSelectedIndustries(prev =>
                                  isSelected ? prev.filter(i => i !== ind.name) : [...prev, ind.name]
                                )}
                                style={{
                                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                                  padding: '9px 16px', border: 'none', cursor: 'pointer', textAlign: 'left',
                                  background: isSelected ? '#fffbeb' : 'transparent',
                                  transition: 'background 0.1s',
                                }}
                                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#f8fafc'; }}
                                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                              >
                                <div style={{
                                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                  background: `hsl(${hue}, 65%, 55%)`,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 13, fontWeight: 900, color: '#fff',
                                }}>
                                  {ind.name[0].toUpperCase()}
                                </div>
                                <span style={{ flex: 1, fontSize: 14, fontWeight: isSelected ? 700 : 500, color: isSelected ? '#92400e' : '#374151' }}>
                                  {ind.name}
                                </span>
                                <div style={{
                                  width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                                  border: `2px solid ${isSelected ? '#D4AF37' : '#cbd5e1'}`,
                                  background: isSelected ? '#D4AF37' : '#fff',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  {isSelected && <span style={{ color: '#fff', fontSize: 11, fontWeight: 900 }}>✓</span>}
                                </div>
                              </button>
                            );
                          })}
                        {industries.filter(i => i.name.toLowerCase().includes(industrySearch.toLowerCase())).length === 0 && (
                          <div style={{ padding: '16px', textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>Sin resultados</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tone */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', letterSpacing: '0.06em', display: 'block', marginBottom: 10 }}>TONO DE MARCA</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {TONES.map(t => (
                    <button
                      key={t.key}
                      onClick={() => setTono(t.key)}
                      style={{
                        padding: '8px 16px', borderRadius: 10,
                        border: `1.5px solid ${tono === t.key ? '#D4AF37' : '#e2e8f0'}`,
                        background: tono === t.key ? '#fffbeb' : '#f8fafc',
                        color: tono === t.key ? '#92400e' : '#374151',
                        fontSize: 13, fontWeight: tono === t.key ? 800 : 500,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <span>{t.emoji}</span> {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tips */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#166534', marginBottom: 6 }}>💡 TIPS PARA MEJORES RESULTADOS</div>
                <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 12, color: '#166534', lineHeight: 1.8 }}>
                  <li>Menciona precio, ubicación o fecha específica</li>
                  <li>Incluye el beneficio principal del cliente</li>
                  <li>Agrega detalles únicos de tu oferta</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ══ STEP 2 ══════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div style={{ maxWidth: 960, margin: '0 auto' }}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: '0 0 6px' }}>Elige tu concepto publicitario</h2>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>La IA analizó tu oferta y generó estas propuestas. Selecciona la que mejor encaje con tu objetivo.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {ideas.map((idea, idx) => {
                const accent = idea.paleta?.[0] || ACCENT_COLORS[idx % ACCENT_COLORS.length];
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectIdea(idea)}
                    style={{
                      background: '#fff', borderRadius: 20, border: '1.5px solid #e2e8f0',
                      padding: 0, textAlign: 'left', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', overflow: 'hidden',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.06)', transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 16px 40px rgba(0,0,0,0.12)'; (e.currentTarget as HTMLElement).style.borderColor = accent; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'; (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; }}
                  >
                    {/* Card header with accent color */}
                    <div style={{ background: `linear-gradient(135deg, ${accent}, ${accent}bb)`, padding: '20px 20px 16px', position: 'relative' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.08em', marginBottom: 6 }}>
                        {selectedIndustries.join(' · ').toUpperCase() || 'MARKETING'} · {idea.tono?.toUpperCase() || 'PREMIUM'}
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>
                        {idea.titulo}
                      </div>
                      <div style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 800, color: '#fff' }}>
                        #{idx + 1}
                      </div>
                    </div>

                    {/* Card body */}
                    <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                        {idea.gancho}
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(idea.beneficios || []).slice(0, 3).map((b, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <div style={{ width: 18, height: 18, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                              <span style={{ color: '#fff', fontSize: 10, fontWeight: 900 }}>✓</span>
                            </div>
                            <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.4 }}>{b}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* CTA */}
                    <div style={{ padding: '0 20px 20px' }}>
                      <div style={{
                        background: `linear-gradient(135deg, ${accent}, ${accent}bb)`,
                        color: '#fff', padding: '12px 20px', borderRadius: 10,
                        fontSize: 13, fontWeight: 900, textAlign: 'center',
                        letterSpacing: '0.05em',
                      }}>
                        USAR ESTE CONCEPTO →
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ STEP 3 ══════════════════════════════════════════════════════ */}
        {step === 3 && (
          <div style={{ height: '100%', display: 'flex', gap: 16 }}>

            {/* ── LEFT PANEL: Controls ──────────────────────────────── */}
            <div style={{
              width: 320, background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0',
              display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
            }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#D4AF37', letterSpacing: '0.08em' }}>ESTUDIO DE DISEÑO</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: '#0f172a' }}>Personaliza tu flyer</div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* ── FORMAT SIZE DROPDOWN ──────────────────────────── */}
                <div>
                  <label style={{ fontSize: 10, fontWeight: 800, color: '#475569', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>
                    <Monitor size={12} style={{ display: 'inline', marginRight: 4 }} />
                    FORMATO DE PUBLICACIÓN
                  </label>
                  <div ref={sizeDropRef} style={{ position: 'relative' }}>
                    {/* Trigger */}
                    <button
                      onClick={() => setIsSizeOpen(o => !o)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                        borderRadius: 10, cursor: 'pointer', border: '1.5px solid #D4AF37',
                        background: '#fffbeb', transition: 'all 0.15s',
                        boxShadow: isSizeOpen ? '0 0 0 3px rgba(212,175,55,0.15)' : 'none',
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{selectedSize.icon}</span>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#92400e' }}>{selectedSize.label}</div>
                        <div style={{ fontSize: 10, color: '#b45309' }}>{selectedSize.w}×{selectedSize.h}px · {selectedSize.tag}</div>
                      </div>
                      <ChevronDown size={14} color="#92400e" style={{ transform: isSizeOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                    </button>
                    {/* Dropdown panel */}
                    {isSizeOpen && (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 60,
                        background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.12)', overflow: 'hidden', maxHeight: 260, overflowY: 'auto',
                      }}>
                        {CANVAS_SIZES.map(sz => {
                          const isSel = selectedSize.id === sz.id;
                          return (
                            <button key={sz.id} onClick={() => { setSelectedSize(sz); setIsSizeOpen(false); }}
                              style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                padding: '9px 14px', border: 'none', cursor: 'pointer', textAlign: 'left',
                                background: isSel ? '#fffbeb' : 'transparent', transition: 'background 0.1s',
                              }}
                              onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = '#f8fafc'; }}
                              onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                            >
                              <span style={{ fontSize: 16 }}>{sz.icon}</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: isSel ? 800 : 500, color: isSel ? '#92400e' : '#374151' }}>{sz.label}</div>
                                <div style={{ fontSize: 10, color: '#94a3b8' }}>{sz.w}×{sz.h}px · {sz.tag}</div>
                              </div>
                              {isSel && <span style={{ color: '#D4AF37', fontWeight: 900 }}>✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── PHOTO SOURCE: AI vs Upload ─────────────────────── */}
                <div>
                  <label style={{ fontSize: 10, fontWeight: 800, color: '#475569', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>IMAGEN DE FONDO</label>
                  {/* Toggle */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    <button
                      onClick={() => { setPhotoMode('ai'); setFlyerData(prev => ({ ...prev, bgImageUrl: null })); }}
                      style={{
                        flex: 1, padding: '8px', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer',
                        border: `1.5px solid ${photoMode === 'ai' ? '#D4AF37' : '#e2e8f0'}`,
                        background: photoMode === 'ai' ? '#fffbeb' : '#f8fafc',
                        color: photoMode === 'ai' ? '#92400e' : '#64748b',
                      }}
                    >🤖 Generar con IA</button>
                    <button
                      onClick={() => setPhotoMode('upload')}
                      style={{
                        flex: 1, padding: '8px', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer',
                        border: `1.5px solid ${photoMode === 'upload' ? '#D4AF37' : '#e2e8f0'}`,
                        background: photoMode === 'upload' ? '#fffbeb' : '#f8fafc',
                        color: photoMode === 'upload' ? '#92400e' : '#64748b',
                      }}
                    >📷 Mis fotos</button>
                  </div>
                  {/* Upload zone (only when upload mode) */}
                  {photoMode === 'upload' && (
                    <div>
                      <input ref={photoInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotoUpload} />
                      {userPhotos.length === 0 ? (
                        <button
                          onClick={() => photoInputRef.current?.click()}
                          style={{
                            width: '100%', padding: '20px 10px', borderRadius: 10, border: '2px dashed #D4AF37',
                            background: '#fffbeb', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                            alignItems: 'center', gap: 6,
                          }}
                        >
                          <Upload size={20} color="#D4AF37" />
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>Subir 1-3 fotos</span>
                          <span style={{ fontSize: 10, color: '#b45309' }}>JPG, PNG, WEBP · Máx. 10MB c/u</span>
                        </button>
                      ) : (
                        <div>
                          {/* Thumbnails */}
                          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                            {userPhotos.map((url, i) => (
                              <div key={i} style={{ position: 'relative', flex: 1 }}>
                                <img src={url} alt={`foto ${i+1}`} style={{
                                  width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8,
                                  border: flyerData.bgImageUrl === url ? '2px solid #D4AF37' : '2px solid #e2e8f0',
                                  cursor: 'pointer',
                                }}
                                onClick={() => setFlyerData(prev => ({ ...prev, bgImageUrl: url }))}
                                />
                                <button
                                  onClick={() => {
                                    const newPhotos = userPhotos.filter((_, j) => j !== i);
                                    setUserPhotos(newPhotos);
                                    if (flyerData.bgImageUrl === url) {
                                      setFlyerData(prev => ({ ...prev, bgImageUrl: newPhotos[0] || null }));
                                    }
                                  }}
                                  style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: '50%', background: '#ef4444', color: '#fff', border: 'none', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}
                                >×</button>
                              </div>
                            ))}
                            {userPhotos.length < 3 && (
                              <button onClick={() => photoInputRef.current?.click()}
                                style={{ flex: 1, aspectRatio: '1', borderRadius: 8, border: '2px dashed #D4AF37', background: '#fffbeb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 50 }}
                              ><Upload size={14} color="#D4AF37" /></button>
                            )}
                          </div>
                          <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>Toca una foto para usarla como fondo principal</p>
                        </div>
                      )}
                    </div>
                  )}
                  {photoMode === 'ai' && (
                    <button
                      onClick={() => generateImage({ titulo: flyerData.title, gancho: flyerData.subtitle, beneficios: flyerData.beneficios, cta: flyerData.cta, paleta: [flyerData.accent], tono }, flyerData.accent)}
                      disabled={isLoadingImg}
                      style={{ width: '100%', background: '#f1f5f9', color: '#374151', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '10px 16px', fontSize: 12, fontWeight: 700, cursor: isLoadingImg ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <RefreshCw size={14} className={isLoadingImg ? 'animate-spin' : ''} />
                      {isLoadingImg ? 'Generando imagen IA...' : 'Regenerar imagen IA'}
                    </button>
                  )}
                </div>

                {/* Template selector */}
                <div>
                  <label style={{ fontSize: 10, fontWeight: 800, color: '#475569', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>
                    <Palette size={12} style={{ display: 'inline', marginRight: 4 }} />
                    ESTILO ({TEMPLATE_LIST.length} DISEÑOS)
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {TEMPLATE_LIST.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setFlyerData(prev => ({ ...prev, templateId: t.id }))}
                        style={{
                          padding: '10px 14px', borderRadius: 10, textAlign: 'left',
                          border: `1.5px solid ${flyerData.templateId === t.id ? '#D4AF37' : '#e2e8f0'}`,
                          background: flyerData.templateId === t.id ? '#fffbeb' : '#f8fafc',
                          cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2,
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: flyerData.templateId === t.id ? 800 : 600, color: flyerData.templateId === t.id ? '#92400e' : '#374151' }}>{t.name}</span>
                        <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400 }}>{t.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color accent */}
                <div>
                  <label style={{ fontSize: 10, fontWeight: 800, color: '#475569', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>COLOR DE MARCA</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <label style={{ width: 32, height: 32, borderRadius: '50%', background: 'conic-gradient(red, yellow, green, cyan, blue, magenta, red)', cursor: 'pointer', border: '2px solid #0f172a', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <input type="color" value={flyerData.accent} onChange={e => setFlyerData(prev => ({ ...prev, accent: e.target.value }))} style={{ opacity: 0, width: 0, height: 0 }} />
                    </label>
                    {ACCENT_COLORS.map(c => (
                      <button key={c} onClick={() => setFlyerData(prev => ({ ...prev, accent: c }))}
                        style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: flyerData.accent === c ? '3px solid #0f172a' : '2px solid #fff', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }} />
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label style={{ fontSize: 10, fontWeight: 800, color: '#475569', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>TÍTULO PRINCIPAL</label>
                  <input
                    value={flyerData.title}
                    onChange={e => setFlyerData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Tu título aquí"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = '#D4AF37'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                  />
                </div>

                {/* Subtitle */}
                <div>
                  <label style={{ fontSize: 10, fontWeight: 800, color: '#475569', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>GANCHO COMERCIAL</label>
                  <textarea
                    value={flyerData.subtitle}
                    onChange={e => setFlyerData(prev => ({ ...prev, subtitle: e.target.value }))}
                    placeholder="Gancho o descripción breve"
                    rows={3}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                    onFocus={e => e.target.style.borderColor = '#D4AF37'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                  />
                </div>

                {/* CTA */}
                <div>
                  <label style={{ fontSize: 10, fontWeight: 800, color: '#475569', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>BOTÓN DE ACCIÓN (CTA)</label>
                  <input
                    value={flyerData.cta}
                    onChange={e => setFlyerData(prev => ({ ...prev, cta: e.target.value }))}
                    placeholder="CONTÁCTANOS HOY"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = '#D4AF37'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                  />
                </div>

                {/* Benefits */}
                <div>
                  <label style={{ fontSize: 10, fontWeight: 800, color: '#475569', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>PUNTOS CLAVE (máx. 4)</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(flyerData.beneficios.length ? flyerData.beneficios : ['', '', '']).slice(0, 4).map((b, i) => (
                      <input
                        key={i}
                        value={b}
                        onChange={e => {
                          const nb = [...(flyerData.beneficios.length ? flyerData.beneficios : ['', '', ''])];
                          nb[i] = e.target.value;
                          setFlyerData(prev => ({ ...prev, beneficios: nb }));
                        }}
                        placeholder={`Punto clave ${i + 1}`}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                        onFocus={e => e.target.style.borderColor = '#D4AF37'}
                        onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                      />
                    ))}
                  </div>
                </div>

                {/* Contact */}
                <div>
                  <label style={{ fontSize: 10, fontWeight: 800, color: '#475569', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>CONTACTO</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ position: 'relative' }}>
                      <Phone size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        value={flyerData.phone}
                        onChange={e => setFlyerData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+503 7XXX-XXXX"
                        style={{ width: '100%', padding: '9px 12px 9px 28px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ position: 'relative' }}>
                      <Globe size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        value={flyerData.website}
                        onChange={e => setFlyerData(prev => ({ ...prev, website: e.target.value }))}
                        placeholder="www.empresa.com"
                        style={{ width: '100%', padding: '9px 12px 9px 28px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Regenerate button removed — now inside IMAGEN DE FONDO section */}

              </div>
            </div>

            {/* ── RIGHT PANEL: Live Preview ─────────────────────────── */}
            <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
              {/* Checkerboard pattern */}
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-conic-gradient(#cbd5e1 0% 25%, #e2e8f0 0% 50%)', backgroundSize: '20px 20px', opacity: 0.5 }} />

              {/* AI loading overlay */}
              {isLoadingImg && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 20, borderRadius: 20, backdropFilter: 'blur(8px)', gap: 12 }}>
                  <ImageIcon size={32} color="#fff" />
                  <Loader2 size={32} color="#D4AF37" className="animate-spin" />
                  <div style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>Generando foto con IA...</div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>FLUX Schnell · ~5 segundos</div>
                </div>
              )}

              {/* The Flyer — aspect ratio driven by selectedSize */}
              {(() => {
                const aspect = selectedSize.h / selectedSize.w;
                const maxH = 580;
                const maxW = 520;
                let previewW = maxW;
                let previewH = previewW * aspect;
                if (previewH > maxH) { previewH = maxH; previewW = maxH / aspect; }
                const scale = previewW / selectedSize.w;
                return (
                  <div style={{ position: 'relative', zIndex: 10, boxShadow: '0 30px 80px rgba(0,0,0,0.3)', borderRadius: 4 }}>
                    <div style={{ width: previewW, height: previewH, overflow: 'hidden', borderRadius: 4 }}>
                      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: selectedSize.w, height: selectedSize.h }}>
                        <ActiveTemplate d={flyerData} />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Format badge */}
              <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '6px 16px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                {selectedSize.icon} {selectedSize.label} · {selectedSize.w}×{selectedSize.h}px
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Hidden full-size flyer for html2canvas export — exact target dimensions */}
      <div style={{ position: 'fixed', top: -9999, left: -9999, zIndex: -1, pointerEvents: 'none' }}>
        <div ref={flyerRef} style={{ width: selectedSize.w, height: selectedSize.h }}>
          <ActiveTemplate d={flyerData} />
        </div>
      </div>
    </div>
  );
}
