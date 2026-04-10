import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Download, Sparkles, Palette, Phone, Globe, ChevronRight, ChevronDown, Search, Loader2, ImageIcon, RefreshCw, Upload, Monitor, Pen, Trash2, Undo2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../services/supabase';
import { flyerService } from '../../services/flyerService';
import type { FlyerData } from './FlyerTemplates';
import { TEMPLATE_LIST, RenderFlyer } from './FlyerTemplates';

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
  // ── IMAGEN ──────────────────────────────────────────────────────────────
  { id: 'ig-portrait', label: 'Instagram Retrato',   icon: '📷', type: 'Imagen', platform: 'Instagram', w: 1080, h: 1350, tag: '4:5' },
  { id: 'ig-post',     label: 'Instagram Post',      icon: '📷', type: 'Imagen', platform: 'Instagram', w: 1080, h: 1080, tag: '1:1' },
  { id: 'fb-post',     label: 'Facebook Post',       icon: '👥', type: 'Imagen', platform: 'Facebook',  w: 940,  h: 788,  tag: '6:5' },
  { id: 'li-post',     label: 'LinkedIn Post',       icon: '💼', type: 'Imagen', platform: 'LinkedIn',  w: 1200, h: 628,  tag: '1.91:1' },
  { id: 'li-square',   label: 'LinkedIn Cuadrado',   icon: '💼', type: 'Imagen', platform: 'LinkedIn',  w: 1200, h: 1200, tag: '1:1' },
  { id: 'tw-post',     label: 'Twitter / X Post',    icon: '🐦', type: 'Imagen', platform: 'Twitter',   w: 1200, h: 675,  tag: '16:9' },
  { id: 'yt-thumb',    label: 'YouTube Thumbnail',   icon: '▶️', type: 'Imagen', platform: 'YouTube',   w: 1280, h: 720,  tag: '16:9' },
  { id: 'pinterest',   label: 'Pinterest Pin',       icon: '📌', type: 'Imagen', platform: 'Pinterest', w: 1000, h: 1500, tag: '2:3' },
  { id: 'fb-cover',    label: 'Facebook Portada',    icon: '👥', type: 'Imagen', platform: 'Facebook',  w: 820,  h: 312,  tag: 'Banner' },
  // ── VIDEO ───────────────────────────────────────────────────────────────
  { id: 'vid-story',   label: 'Video Story / Reels', icon: '🎬', type: 'Video',  platform: 'IG/TikTok', w: 1080, h: 1920, tag: '9:16' },
  { id: 'vid-square',  label: 'Video Cuadrado',      icon: '🎬', type: 'Video',  platform: 'IG/FB',    w: 1080, h: 1080, tag: '1:1' },
  { id: 'tiktok',      label: 'TikTok Vertical',     icon: '🎵', type: 'Video',  platform: 'TikTok',   w: 1080, h: 1920, tag: '9:16' },
  { id: 'wa-status',   label: 'WhatsApp Status',     icon: '💬', type: 'Video',  platform: 'WhatsApp', w: 1080, h: 1920, tag: '9:16' },
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
  const [exportReady, setExportReady]   = useState<{url: string; filename: string} | null>(null);

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

  // Step 3 — canvas size + photo upload + zoom
  const [selectedSize, setSelectedSize] = useState(CANVAS_SIZES[0]); // default: Instagram Retrato 4:5
  const [isSizeOpen, setIsSizeOpen]     = useState(false);
  const sizeDropRef = useRef<HTMLDivElement>(null);
  const [photoMode, setPhotoMode]       = useState<'ai' | 'upload'>('ai');
  const [userPhotos, setUserPhotos]     = useState<string[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [previewZoom, setPreviewZoom]   = useState(1.0);
  const [photoLayout, setPhotoLayout]   = useState<'single' | 'split-h' | 'split-v' | 'pip-br' | 'pip-bl'>('single');
  const cropPreviewRef = useRef<HTMLDivElement>(null);
  const isDraggingCrop = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 50, py: 50 });

  // ─── DRAW TOOL STATE ────────────────────────────────────────────────────────
  type DrawLine = { x1: number; y1: number; x2: number; y2: number; color: string; width: number; arrow: boolean };
  const [drawMode, setDrawMode]           = useState(false);
  const [drawLines, setDrawLines]         = useState<DrawLine[]>([]);
  const [drawColor, setDrawColor]         = useState('#FF3B3B');
  const [drawWidth, setDrawWidth]         = useState(4);
  const [drawArrow, setDrawArrow]         = useState(true);
  const drawingRef = useRef<{ active: boolean; startX: number; startY: number }>({ active: false, startX: 0, startY: 0 });
  const svgDrawRef = useRef<SVGSVGElement>(null);
  const drawPreviewRef = useRef<{ x2: number; y2: number } | null>(null);
  const [drawPreviewLine, setDrawPreviewLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

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

  // Handle photo uploads → convert to data URLs, store in userPhotos
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 3 - userPhotos.length);
    if (!files.length) return;
    const readers = files.map(file => new Promise<string>(resolve => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.readAsDataURL(file);
    }));
    Promise.all(readers).then(urls => {
      const merged = [...userPhotos, ...urls].slice(0, 3);
      setUserPhotos(merged);
      setFlyerData(prev => ({
        ...prev,
        bgImageUrl: merged[0] || null,
        bgImage2Url: merged[1] || null,
        bgImagePosition: { x: 50, y: 50 },
      }));
      toast.success(`${urls.length} foto${urls.length > 1 ? 's' : ''} cargada${urls.length > 1 ? 's' : ''}`);
      // Reset input so same file can be re-added
      if (e.target) e.target.value = '';
    });
  };

  // ─── CANVAS COMPOSITOR: merge 2 photos into 1 data URL ─────────────────────
  const composePhotos = useCallback(async (
    url1: string, url2: string,
    layout: 'split-h' | 'split-v' | 'pip-br' | 'pip-bl',
    pos1: { x: number; y: number },
    w: number, h: number
  ): Promise<string> => {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const loadImg = (src: string) => new Promise<HTMLImageElement>(res => {
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => res(img); img.src = src;
    });
    const [img1, img2] = await Promise.all([loadImg(url1), loadImg(url2)]);

    const drawCover = (img: HTMLImageElement, x: number, y: number, dw: number, dh: number, focalX = 50, focalY = 50) => {
      const scaleW = dw / img.width, scaleH = dh / img.height;
      const scale = Math.max(scaleW, scaleH);
      const sw = img.width * scale, sh = img.height * scale;
      const ox = (dw - sw) * (focalX / 100);
      const oy = (dh - sh) * (focalY / 100);
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, dw, dh); ctx.clip();
      ctx.drawImage(img, x + ox, y + oy, sw, sh);
      ctx.restore();
    };

    if (layout === 'split-h') {
      drawCover(img1, 0, 0, w / 2, h, pos1.x, pos1.y);
      drawCover(img2, w / 2, 0, w / 2, h);
      // Divider line
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
    } else if (layout === 'split-v') {
      drawCover(img1, 0, 0, w, h / 2, pos1.x, pos1.y);
      drawCover(img2, 0, h / 2, w, h / 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    } else if (layout === 'pip-br') {
      drawCover(img1, 0, 0, w, h, pos1.x, pos1.y);
      const pw = Math.round(w * 0.38), ph = Math.round(pw * (img2.height / img2.width));
      const px = w - pw - 16, py = h - ph - 16;
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 16;
      drawCover(img2, px, py, pw, ph);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3;
      ctx.strokeRect(px, py, pw, ph);
    } else if (layout === 'pip-bl') {
      drawCover(img1, 0, 0, w, h, pos1.x, pos1.y);
      const pw = Math.round(w * 0.38), ph = Math.round(pw * (img2.height / img2.width));
      const px = 16, py = h - ph - 16;
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 16;
      drawCover(img2, px, py, pw, ph);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3;
      ctx.strokeRect(px, py, pw, ph);
    }
    return canvas.toDataURL('image/jpeg', 0.92);
  }, []);

  // Auto-recompose when layout or photos change
  useEffect(() => {
    const p1 = userPhotos[0], p2 = userPhotos[1];
    if (photoMode !== 'upload' || !p1 || !p2 || photoLayout === 'single') {
      if (p1 && photoLayout === 'single') setFlyerData(prev => ({ ...prev, bgImageUrl: p1 }));
      return;
    }
    const pos = flyerData.bgImagePosition || { x: 50, y: 50 };
    composePhotos(p1, p2, photoLayout as 'split-h' | 'split-v' | 'pip-br' | 'pip-bl', pos, selectedSize.w, selectedSize.h)
      .then(url => setFlyerData(prev => ({ ...prev, bgImageUrl: url })));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoLayout, userPhotos, photoMode, selectedSize.w, selectedSize.h]);


  // Step 3 — flyer data
  const [flyerData, setFlyerData] = useState<FlyerData>({
    title: '', subtitle: '', cta: '', beneficios: [],
    accent: '#1a56db', bgImageUrl: null, bgImagePosition: { x: 50, y: 50 },
    bgImage2Url: null, photoLayout: 'single',
    logoUrl: null, industria: '', phone: '', website: '', templateId: 'bold-split',
    textScale: 1.0, logoSize: 1.0, logoPos: 'top-left',
    subtitleScale: 1.0, subtitleBold: false,
    benefitsScale: 1.0, benefitsBold: false,
    ctaGradient: true,
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
        setFlyerData(prev => ({ ...prev, logoUrl: comp.logo_url, phone: comp.phone || '', website: comp.website || '', logoX: prev.logoX ?? 5, logoY: prev.logoY ?? 5 }));
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
        body: JSON.stringify({ idea, industria: selectedIndustries.join(', '), oferta, tono, seed: Date.now() }),
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

  // ─── EXPORT via html2canvas + showSaveFilePicker ────────────────────────────
  const handleExport = useCallback(async () => {
    if (!flyerRef.current) return;
    setIsExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(flyerRef.current, {
        scale: 2, useCORS: true, allowTaint: false, backgroundColor: null, logging: false,
      });

      const sanitize = (str: string) =>
        (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 40) || 'flyer';
      const filename = `flyer-${sanitize(flyerData.title)}-${sanitize(selectedSize.label)}.png`;

      const blob = await new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b!), 'image/png'));

      // ── Native "Save As" dialog (works on Chrome/Edge regardless of enterprise policy) ──
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: filename,
            types: [{ description: 'PNG Image', accept: { 'image/png': ['.png'] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          toast.success(`✅ Guardado: ${filename}`);
          return;
        } catch (err: any) {
          if (err.name === 'AbortError') return; // User cancelled dialog — OK
          // If showSaveFilePicker fails for any reason, fall through to fallback
        }
      }

      // ── Fallback: open image in new tab (user saves with Ctrl+S) ──
      const url = URL.createObjectURL(blob);
      const newTab = window.open(url, '_blank');
      if (newTab) {
        toast.success('Imagen abierta en nueva pestaña — usa Ctrl+S para guardar');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        // Last resort: anchor download
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        toast.success(`Descargado: ${filename}`);
      }
    } catch (e) {
      console.error(e);
      toast.error('Error al exportar');
    } finally {
      setIsExporting(false);
    }
  }, [flyerData.title, selectedSize.label]);

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

  // ─── LOGO DRAG STATE ─────────────────────────────────────────────────────────
  const dragState = useRef<{ active: boolean; mode: 'move' | 'resize'; startX: number; startY: number; startLogoX: number; startLogoY: number; startLogoSize: number } | null>(null);
  const previewWrapRef = useRef<HTMLDivElement>(null);

  const handleLogoPointerDown = useCallback((e: React.PointerEvent, mode: 'move' | 'resize') => {
    if (!previewWrapRef.current) return;
    e.preventDefault(); e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = {
      active: true, mode,
      startX: e.clientX, startY: e.clientY,
      startLogoX: flyerData.logoX ?? 5,
      startLogoY: flyerData.logoY ?? 5,
      startLogoSize: flyerData.logoSize ?? 1,
    };
  }, [flyerData.logoX, flyerData.logoY, flyerData.logoSize]);

  const handleLogoPointerMove = useCallback((e: React.PointerEvent) => {
    const ds = dragState.current;
    if (!ds?.active || !previewWrapRef.current) return;
    const rect = previewWrapRef.current.getBoundingClientRect();
    const scaleX = selectedSize.w / rect.width;
    const scaleY = selectedSize.h / rect.height;
    const dx = (e.clientX - ds.startX) * scaleX;
    const dy = (e.clientY - ds.startY) * scaleY;
    if (ds.mode === 'move') {
      const nx = Math.max(0, Math.min(90, ds.startLogoX + (dx / selectedSize.w) * 100));
      const ny = Math.max(0, Math.min(90, ds.startLogoY + (dy / selectedSize.h) * 100));
      setFlyerData(prev => ({ ...prev, logoX: +nx.toFixed(1), logoY: +ny.toFixed(1) }));
    } else {
      const delta = (dx + dy) / 200;
      const ns = Math.max(0.3, Math.min(5, ds.startLogoSize + delta));
      setFlyerData(prev => ({ ...prev, logoSize: +ns.toFixed(2) }));
    }
  }, [selectedSize.w, selectedSize.h]);

  const handleLogoPointerUp = useCallback(() => {
    if (dragState.current) dragState.current.active = false;
  }, []);

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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
                style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 12, fontWeight: 800, cursor: isExporting ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
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
                        {/* Drawing Overlay */}
                        {drawMode && (
                          <svg ref={svgDrawRef} style={{ position: "absolute", top: 0, left: 0, width: selectedSize.w, height: selectedSize.h, zIndex: 50, cursor: "crosshair", userSelect: "none" }} onMouseDown={e => { const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const sx = selectedSize.w / rect.width, sy = selectedSize.h / rect.height; const x = (e.clientX - rect.left) * sx, y = (e.clientY - rect.top) * sy; drawingRef.current = { active: true, startX: x, startY: y }; setDrawPreviewLine({ x1: x, y1: y, x2: x, y2: y }); }} onMouseMove={e => { if (!drawingRef.current.active) return; const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const sx = selectedSize.w / rect.width, sy = selectedSize.h / rect.height; const x = (e.clientX - rect.left) * sx, y = (e.clientY - rect.top) * sy; setDrawPreviewLine(prev => prev ? { ...prev, x2: x, y2: y } : null); }} onMouseUp={e => { if (!drawingRef.current.active) return; const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const sx = selectedSize.w / rect.width, sy = selectedSize.h / rect.height; const x2 = (e.clientX - rect.left) * sx, y2 = (e.clientY - rect.top) * sy; const { startX: x1, startY: y1 } = drawingRef.current; if (Math.hypot(x2 - x1, y2 - y1) > 8) { setDrawLines(prev => [...prev, { x1, y1, x2, y2, color: drawColor, width: drawWidth, arrow: drawArrow }]); } drawingRef.current.active = false; setDrawPreviewLine(null); }} onMouseLeave={() => { drawingRef.current.active = false; setDrawPreviewLine(null); }}>
                            <defs>{[...new Set([drawColor, ...drawLines.map((l) => l.color)])].map(c => (<marker key={c} id={`arr-${c.replace("#","")}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill={c} /></marker>))}</defs>
                            {drawLines.map((l, i) => (<line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.color} strokeWidth={l.width} strokeLinecap="round" markerEnd={l.arrow ? `url(#arr-${l.color.replace("#","")})` : undefined} style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))" }} />))}
                            {drawPreviewLine && (<line x1={drawPreviewLine.x1} y1={drawPreviewLine.y1} x2={drawPreviewLine.x2} y2={drawPreviewLine.y2} stroke={drawColor} strokeWidth={drawWidth} strokeLinecap="round" strokeDasharray="12 6" opacity="0.75" markerEnd={drawArrow ? `url(#arr-${drawColor.replace("#","")})` : undefined} />)}
                          </svg>
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
                const rawAccent = idea.paleta?.[0] || ACCENT_COLORS[idx % ACCENT_COLORS.length];
                // Guard: if AI returns white/invalid color, force a visible accent
                const isInvisible = !rawAccent || rawAccent === '#fff' || rawAccent === '#ffffff' || rawAccent === 'white' || rawAccent === 'transparent';
                const accent = isInvisible ? ACCENT_COLORS[idx % ACCENT_COLORS.length] : rawAccent;
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
              <div style={{ borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
                <div style={{ padding: '16px 20px 10px' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#D4AF37', letterSpacing: '0.08em' }}>ESTUDIO DE DISEÑO</div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: '#0f172a' }}>Personaliza tu flyer</div>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* ═══ 1. FOTO DE FONDO ══════════════════════════════════════════ */}
                <div style={{ position: 'relative', zIndex: 20, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff' }}>
                  {/* Tab header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#475569', letterSpacing: '0.06em' }}>📸 FOTO DE FONDO</span>
                    <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 2 }}>
                      <button
                        onClick={() => { setPhotoMode('ai'); setUserPhotos([]); setPhotoLayout('single'); setFlyerData(prev => ({ ...prev, bgImageUrl: null, bgImage2Url: null, bgImagePosition: { x: 50, y: 50 } })); }}
                        style={{ padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: 'none', background: photoMode === 'ai' ? '#fff' : 'transparent', color: photoMode === 'ai' ? '#0f172a' : '#64748b', boxShadow: photoMode === 'ai' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none', transition: 'all 0.15s' }}>
                        🎨 IA
                      </button>
                      <button
                        onClick={() => setPhotoMode('upload')}
                        style={{ padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: 'none', background: photoMode === 'upload' ? '#fff' : 'transparent', color: photoMode === 'upload' ? '#0f172a' : '#64748b', boxShadow: photoMode === 'upload' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none', transition: 'all 0.15s' }}>
                        📷 Mis fotos
                      </button>
                    </div>
                  </div>
                  {/* Content */}
                  <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* ── AI MODE ── */}
                    {photoMode === 'ai' && (
                      <button
                        onClick={() => generateImage({ titulo: flyerData.title, gancho: flyerData.subtitle, beneficios: flyerData.beneficios, cta: flyerData.cta, paleta: [flyerData.accent], tono }, flyerData.accent)}
                        disabled={isLoadingImg}
                        style={{ width: '100%', background: isLoadingImg ? '#f8fafc' : '#fff', color: '#374151', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 16px', fontSize: 12, fontWeight: 700, cursor: isLoadingImg ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s' }}>
                        <RefreshCw size={14} className={isLoadingImg ? 'animate-spin' : ''} />
                        {isLoadingImg ? 'Generando con IA...' : 'Regenerar imagen IA'}
                      </button>
                    )}
                    {/* ── UPLOAD MODE ── */}
                    {photoMode === 'upload' && (
                      <>
                        <input ref={photoInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotoUpload} />
                        {/* Drop zone (empty state) */}
                        {userPhotos.length === 0 && (
                          <button onClick={() => photoInputRef.current?.click()}
                            style={{ width: '100%', padding: '20px 10px', borderRadius: 10, border: '2px dashed #D4AF37', background: '#fffbeb', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                            <Upload size={24} color="#D4AF37" />
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>Subir 1 a 3 fotos</span>
                            <span style={{ fontSize: 10, color: '#b45309' }}>JPG · PNG · WEBP</span>
                          </button>
                        )}
                        {/* Photo thumbnails */}
                        {userPhotos.length > 0 && (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            {userPhotos.map((url, i) => (
                              <div key={i} style={{ position: 'relative', flex: 1, maxWidth: 72 }}>
                                <img src={url} alt={`foto ${i + 1}`}
                                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, display: 'block', border: i === 0 ? '2.5px solid #D4AF37' : '2px solid #e2e8f0' }} />
                                {i === 0 && <div style={{ position: 'absolute', bottom: 3, left: 3, fontSize: 7, fontWeight: 900, background: '#D4AF37', color: '#000', borderRadius: 3, padding: '1px 4px', whiteSpace: 'nowrap' }}>PRINCIPAL</div>}
                                <button
                                  onClick={() => { const np = userPhotos.filter((_, j) => j !== i); setUserPhotos(np); setFlyerData(prev => ({ ...prev, bgImageUrl: np[0] || null, bgImage2Url: np[1] || null })); if (np.length < 2) setPhotoLayout('single'); }}
                                  style={{ position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: '50%', background: '#ef4444', color: '#fff', border: '2px solid #fff', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, zIndex: 2 }}>×</button>
                              </div>
                            ))}
                            {userPhotos.length < 3 && (
                              <button onClick={() => photoInputRef.current?.click()}
                                style={{ width: 56, height: 56, borderRadius: 8, border: '2px dashed #D4AF37', background: '#fffbeb', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, flexShrink: 0 }}>
                                <Upload size={12} color="#D4AF37" />
                                <span style={{ fontSize: 8, fontWeight: 800, color: '#b45309' }}>+FOTO</span>
                              </button>
                            )}
                          </div>
                        )}
                        {/* Crop / Focal point editor */}
                        {userPhotos.length > 0 && (() => {
                          const pos = flyerData.bgImagePosition || { x: 50, y: 50 };
                          const updatePos = (nx: number, ny: number) => {
                            const newPos = { x: Math.round(nx), y: Math.round(ny) };
                            setFlyerData(prev => ({ ...prev, bgImagePosition: newPos }));
                            if (photoLayout !== 'single' && userPhotos[1]) {
                              composePhotos(userPhotos[0], userPhotos[1], photoLayout as 'split-h' | 'split-v' | 'pip-br' | 'pip-bl', newPos, selectedSize.w, selectedSize.h)
                                .then(url => setFlyerData(prev => ({ ...prev, bgImageUrl: url })));
                            } else {
                              setFlyerData(prev => ({ ...prev, bgImageUrl: userPhotos[0] }));
                            }
                          };
                          return (
                            <div style={{ background: '#f8fafc', borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                              <div style={{ fontSize: 9, fontWeight: 800, color: '#64748b', letterSpacing: '0.05em', padding: '6px 10px', borderBottom: '1px solid #f1f5f9' }}>🎯 ENCUADRE — arrastra para enfocar</div>
                              <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div ref={cropPreviewRef}
                                  style={{ width: '100%', height: 70, borderRadius: 8, overflow: 'hidden', position: 'relative', cursor: 'crosshair', userSelect: 'none', backgroundImage: `url(${userPhotos[0]})`, backgroundSize: 'cover', backgroundPosition: `${pos.x}% ${pos.y}%` }}
                                  onMouseDown={e => { isDraggingCrop.current = true; dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }; }}
                                  onMouseMove={e => {
                                    if (!isDraggingCrop.current || !cropPreviewRef.current) return;
                                    const rect = cropPreviewRef.current.getBoundingClientRect();
                                    const dx = (e.clientX - dragStart.current.mx) / rect.width * 100;
                                    const dy = (e.clientY - dragStart.current.my) / rect.height * 100;
                                    updatePos(Math.max(0, Math.min(100, dragStart.current.px - dx)), Math.max(0, Math.min(100, dragStart.current.py - dy)));
                                  }}
                                  onMouseUp={() => { isDraggingCrop.current = false; }}
                                  onMouseLeave={() => { isDraggingCrop.current = false; }}>
                                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                                    <div style={{ width: 24, height: 24, position: 'relative' }}>
                                      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1.5, background: 'rgba(255,255,255,0.9)' }} />
                                      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1.5, background: 'rgba(255,255,255,0.9)' }} />
                                    </div>
                                  </div>
                                  <div style={{ position: 'absolute', bottom: 4, right: 6, fontSize: 8, color: '#fff', fontWeight: 700, background: 'rgba(0,0,0,0.45)', padding: '1px 5px', borderRadius: 4, pointerEvents: 'none' }}>Arrastra para mover</div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '12px 1fr 28px', gap: 4, alignItems: 'center' }}>
                                  <span style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8' }}>X</span>
                                  <input type="range" min={0} max={100} value={pos.x} onChange={e => updatePos(+e.target.value, pos.y)} style={{ accentColor: '#D4AF37' }} />
                                  <span style={{ fontSize: 9, color: '#64748b', textAlign: 'right' }}>{pos.x}%</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '12px 1fr 28px', gap: 4, alignItems: 'center' }}>
                                  <span style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8' }}>Y</span>
                                  <input type="range" min={0} max={100} value={pos.y} onChange={e => updatePos(pos.x, +e.target.value)} style={{ accentColor: '#D4AF37' }} />
                                  <span style={{ fontSize: 9, color: '#64748b', textAlign: 'right' }}>{pos.y}%</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                        {/* Layout picker (only when 2+ photos) */}
                        {userPhotos.length >= 2 && (
                          <div style={{ background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                            <div style={{ fontSize: 9, fontWeight: 800, color: '#64748b', letterSpacing: '0.05em', padding: '6px 10px', borderBottom: '1px solid #f1f5f9' }}>🧩 COMPOSICIÓN 2 FOTOS</div>
                            <div style={{ padding: '8px 10px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
                              {([
                                { k: 'single',  icon: '▪', label: 'Una' },
                                { k: 'split-h', icon: '◧', label: 'Lado' },
                                { k: 'split-v', icon: '⬒', label: 'Arriba' },
                                { k: 'pip-br',  icon: '🔲', label: 'Mini↘' },
                                { k: 'pip-bl',  icon: '🔳', label: 'Mini↙' },
                              ] as const).map(opt => (
                                <button key={opt.k} onClick={() => setPhotoLayout(opt.k)}
                                  style={{ padding: '5px 2px', borderRadius: 7, fontSize: 8, fontWeight: 700, cursor: 'pointer', textAlign: 'center', border: `1.5px solid ${photoLayout === opt.k ? '#D4AF37' : '#e2e8f0'}`, background: photoLayout === opt.k ? '#fffbeb' : '#fff', color: photoLayout === opt.k ? '#92400e' : '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                  <span style={{ fontSize: 14 }}>{opt.icon}</span>
                                  <span>{opt.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* ═══ 2. FORMATO ════════════════════════════════════════════════ */}
                <div style={{ position: 'relative', zIndex: 10 }}>
                  <label style={{ fontSize: 10, fontWeight: 800, color: '#475569', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                    <Monitor size={11} style={{ display: 'inline', marginRight: 4 }} />
                    FORMATO DE PUBLICACIÓN
                  </label>
                  <div ref={sizeDropRef} style={{ position: 'relative' }}>
                    <button onClick={() => setIsSizeOpen(o => !o)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 10, cursor: 'pointer', border: '1.5px solid #D4AF37', background: '#fffbeb', boxShadow: isSizeOpen ? '0 0 0 3px rgba(212,175,55,0.15)' : 'none' }}>
                      <span style={{ fontSize: 18 }}>{selectedSize.icon}</span>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#92400e' }}>{selectedSize.label}</div>
                        <div style={{ fontSize: 10, color: '#b45309' }}>{selectedSize.w}×{selectedSize.h}px · {selectedSize.tag}</div>
                      </div>
                      <ChevronDown size={13} color="#92400e" style={{ transform: isSizeOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>
                    {isSizeOpen && (
                      <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 60, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 12px 40px rgba(0,0,0,0.12)', maxHeight: 240, overflowY: 'auto' }}>
                        {CANVAS_SIZES.map(sz => {
                          const isSel = selectedSize.id === sz.id;
                          return (
                            <button key={sz.id} onClick={() => { setSelectedSize(sz); setIsSizeOpen(false); }}
                              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', border: 'none', cursor: 'pointer', background: isSel ? '#fffbeb' : 'transparent', textAlign: 'left' }}
                              onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = '#f8fafc'; }}
                              onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                              <span style={{ fontSize: 15 }}>{sz.icon}</span>
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

                {/* ═══ 3. PLANTILLA ══════════════════════════════════════════ */}
                <div style={{ position: 'relative', zIndex: 5 }}>
                  <label style={{ fontSize: 10, fontWeight: 800, color: '#475569', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                    <Palette size={11} style={{ display: 'inline', marginRight: 4 }} />
                    PLANTILLA ({TEMPLATE_LIST.length} ESTILOS)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                    {TEMPLATE_LIST.map((t, idx) => (
                      <button key={t.id} onClick={() => setFlyerData(prev => ({ ...prev, templateId: t.id }))}
                        style={{ padding: '8px 10px', borderRadius: 9, textAlign: 'left', border: `1.5px solid ${flyerData.templateId === t.id ? '#D4AF37' : '#e2e8f0'}`, background: flyerData.templateId === t.id ? '#fffbeb' : '#f8fafc', cursor: 'pointer' }}>
                        <div style={{ fontSize: 10, fontWeight: flyerData.templateId === t.id ? 800 : 600, color: flyerData.templateId === t.id ? '#92400e' : '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{idx + 1}. {t.name}</div>
                        <div style={{ fontSize: 9, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ═══ 4. LOGO — drag en el canvas ══════════════════════════ */}
                {flyerData.logoUrl && (
                  <div style={{ fontSize: 9, color: '#64748b', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <img src={flyerData.logoUrl} style={{ width: 22, height: 22, borderRadius: 5, objectFit: 'cover', border: '1px solid #e2e8f0' }} />
                    <span>🖱️ <b>Arrastra</b> el logo en el flyer · esquina inferior para redimensionar</span>
                  </div>
                )}

                {/* ═══ 5. COLOR ══════════════════════════════════════════════════ */}
                <div style={{ position: 'relative', zIndex: 5 }}>
                  <label style={{ fontSize: 10, fontWeight: 800, color: '#475569', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>COLOR DE MARCA</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <label style={{ width: 30, height: 30, borderRadius: '50%', background: 'conic-gradient(red,yellow,green,cyan,blue,magenta,red)', cursor: 'pointer', border: '2px solid #0f172a', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <input type="color" value={flyerData.accent} onChange={e => setFlyerData(prev => ({ ...prev, accent: e.target.value }))} style={{ opacity: 0, width: 0, height: 0 }} />
                    </label>
                    {ACCENT_COLORS.map(c => (
                      <button key={c} onClick={() => setFlyerData(prev => ({ ...prev, accent: c }))}
                        style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: flyerData.accent === c ? '3px solid #0f172a' : '2px solid #fff', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }} />
                    ))}
                  </div>
                </div>

                {/* ═══ 6. TIPOGRAFÍA ══════════════════════════════════════════════ */}
                <div style={{ position: 'relative', zIndex: 5, border: '1.5px solid #bfdbfe', borderRadius: 10, background: '#fff', borderLeft: '4px solid #1a56db' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#1e40af', letterSpacing: '0.06em', padding: '8px 12px', borderBottom: '1px solid #eff6ff', background: '#eff6ff', borderRadius: '8px 8px 0 0' }}>
                    ✦ TIPOGRAFÍA POR ELEMENTO
                  </div>
                  <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Subtítulo */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#374151' }}>Gancho / Subtítulo</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#D4AF37' }}>{Math.round((flyerData.subtitleScale ?? 1) * 100)}%</span>
                          <button onClick={() => setFlyerData(prev => ({ ...prev, subtitleBold: !prev.subtitleBold }))}
                            style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 900, cursor: 'pointer', border: `1.5px solid ${flyerData.subtitleBold ? '#1a56db' : '#e2e8f0'}`, background: flyerData.subtitleBold ? '#1a56db' : '#f8fafc', color: flyerData.subtitleBold ? '#fff' : '#64748b', transition: 'all 0.12s' }}>B</button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <button onClick={() => setFlyerData(prev => ({ ...prev, subtitleScale: Math.max(0.7, +((prev.subtitleScale ?? 1) - 0.1).toFixed(1)) }))}
                          style={{ width: 22, height: 22, borderRadius: 5, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 14, fontWeight: 900, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
                        <input type="range" min={0.7} max={2.0} step={0.1} value={flyerData.subtitleScale ?? 1}
                          onChange={e => setFlyerData(prev => ({ ...prev, subtitleScale: parseFloat(e.target.value) }))}
                          style={{ accentColor: '#1a56db', flex: 1 }} />
                        <button onClick={() => setFlyerData(prev => ({ ...prev, subtitleScale: Math.min(2, +((prev.subtitleScale ?? 1) + 0.1).toFixed(1)) }))}
                          style={{ width: 22, height: 22, borderRadius: 5, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 14, fontWeight: 900, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
                      </div>
                    </div>
                    <div style={{ height: 1, background: '#f1f5f9' }} />
                    {/* Beneficios */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#374151' }}>Beneficios / Puntos</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#D4AF37' }}>{Math.round((flyerData.benefitsScale ?? 1) * 100)}%</span>
                          <button onClick={() => setFlyerData(prev => ({ ...prev, benefitsBold: !prev.benefitsBold }))}
                            style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 900, cursor: 'pointer', border: `1.5px solid ${flyerData.benefitsBold ? '#1a56db' : '#e2e8f0'}`, background: flyerData.benefitsBold ? '#1a56db' : '#f8fafc', color: flyerData.benefitsBold ? '#fff' : '#64748b', transition: 'all 0.12s' }}>B</button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <button onClick={() => setFlyerData(prev => ({ ...prev, benefitsScale: Math.max(0.7, +((prev.benefitsScale ?? 1) - 0.1).toFixed(1)) }))}
                          style={{ width: 22, height: 22, borderRadius: 5, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 14, fontWeight: 900, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
                        <input type="range" min={0.7} max={2.0} step={0.1} value={flyerData.benefitsScale ?? 1}
                          onChange={e => setFlyerData(prev => ({ ...prev, benefitsScale: parseFloat(e.target.value) }))}
                          style={{ accentColor: '#1a56db', flex: 1 }} />
                        <button onClick={() => setFlyerData(prev => ({ ...prev, benefitsScale: Math.min(2, +((prev.benefitsScale ?? 1) + 0.1).toFixed(1)) }))}
                          style={{ width: 22, height: 22, borderRadius: 5, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 14, fontWeight: 900, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
                      </div>
                    </div>
                    <div style={{ height: 1, background: '#f1f5f9' }} />
                    {/* CTA Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#374151' }}>Botón CTA</div>
                        <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>{flyerData.ctaGradient ? 'Degradado activo' : 'Color sólido'}</div>
                      </div>
                      <button onClick={() => setFlyerData(prev => ({ ...prev, ctaGradient: !prev.ctaGradient }))}
                        style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: flyerData.ctaGradient ? 'linear-gradient(135deg, #1a56db, #7c3aed)' : '#e2e8f0', position: 'relative', transition: 'all 0.2s', flexShrink: 0 }}>
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: flyerData.ctaGradient ? 23 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ position: 'relative', zIndex: 5 }}>
                  <label style={{ fontSize: 10, fontWeight: 800, color: '#475569', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>TÍTULO PRINCIPAL</label>
                  <input value={flyerData.title} onChange={e => setFlyerData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Tu título aquí"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e2e8f0', fontSize: 13, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = '#D4AF37'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>

                <div style={{ position: 'relative', zIndex: 5 }}>
                  <label style={{ fontSize: 10, fontWeight: 800, color: '#475569', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>GANCHO COMERCIAL</label>
                  <textarea value={flyerData.subtitle} onChange={e => setFlyerData(prev => ({ ...prev, subtitle: e.target.value }))}
                    placeholder="Gancho o descripción breve" rows={3}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e2e8f0', fontSize: 12, resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                    onFocus={e => e.target.style.borderColor = '#D4AF37'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>

                <div style={{ position: 'relative', zIndex: 5 }}>
                  <label style={{ fontSize: 10, fontWeight: 800, color: '#475569', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>BOTÓN DE ACCIÓN (CTA)</label>
                  <input value={flyerData.cta} onChange={e => setFlyerData(prev => ({ ...prev, cta: e.target.value }))}
                    placeholder="CONTACTAR · MÁS INFO"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e2e8f0', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = '#D4AF37'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>

                <div style={{ position: 'relative', zIndex: 5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ fontSize: 10, fontWeight: 800, color: '#475569', letterSpacing: '0.06em' }}>BENEFICIOS</label>
                    {flyerData.beneficios.length < 5 && (
                      <button
                        onClick={() => setFlyerData(prev => ({ ...prev, beneficios: [...prev.beneficios, ''] }))}
                        style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 9px', borderRadius: 7, border: '1.5px solid #D4AF37', background: '#fffbeb', cursor: 'pointer', fontSize: 11, fontWeight: 800, color: '#92400e' }}
                      >+ Agregar</button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(flyerData.beneficios.length === 0 ? [''] : flyerData.beneficios).map((b, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: 12, color: '#D4AF37', fontWeight: 900, flexShrink: 0 }}>✓</span>
                        <input
                          value={b}
                          onChange={e => setFlyerData(prev => { const nb = [...prev.beneficios]; nb[i] = e.target.value; return { ...prev, beneficios: nb }; })}
                          placeholder={`Beneficio ${i + 1}`}
                          style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                          onFocus={e => e.target.style.borderColor = '#D4AF37'}
                          onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                        />
                        <button
                          onClick={() => setFlyerData(prev => ({ ...prev, beneficios: prev.beneficios.filter((_, j) => j !== i) }))}
                          style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #fecaca', background: '#fff', cursor: 'pointer', fontSize: 14, color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, lineHeight: 1 }}
                        >×</button>
                      </div>
                    ))}
                    {flyerData.beneficios.length === 0 && (
                      <button onClick={() => setFlyerData(prev => ({ ...prev, beneficios: [''] }))}
                        style={{ padding: '8px', borderRadius: 8, border: '1.5px dashed #D4AF37', background: '#fffbeb', cursor: 'pointer', fontSize: 11, color: '#92400e', fontWeight: 700 }}
                      >+ Agregar primer beneficio</button>
                    )}
                  </div>
                </div>


                <div style={{ position: 'relative', zIndex: 5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 800, color: '#475569', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>TELÉFONO</label>
                    <input value={flyerData.phone} onChange={e => setFlyerData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+503 7XXX-XXXX"
                      style={{ width: '100%', padding: '9px 10px', borderRadius: 9, border: '1.5px solid #e2e8f0', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                      onFocus={e => e.target.style.borderColor = '#D4AF37'}
                      onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 800, color: '#475569', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>SITIO WEB</label>
                    <input value={flyerData.website} onChange={e => setFlyerData(prev => ({ ...prev, website: e.target.value }))}
                      placeholder="www.tuempresa.com"
                      style={{ width: '100%', padding: '9px 10px', borderRadius: 9, border: '1.5px solid #e2e8f0', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                      onFocus={e => e.target.style.borderColor = '#D4AF37'}
                      onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                  </div>
                </div>

                </div>

            </div>

            {/* ── RIGHT PANEL: Live Preview ─────────────────────────── */}
            <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 20, position: 'relative', overflow: 'hidden' }}>
              {/* Checkerboard background */}
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-conic-gradient(#cbd5e1 0% 25%, #e2e8f0 0% 50%)', backgroundSize: '20px 20px', opacity: 0.5, pointerEvents: 'none' }} />

              {/* AI loading overlay */}
              {isLoadingImg && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 25, borderRadius: 20, backdropFilter: 'blur(8px)', gap: 12 }}>
                  <ImageIcon size={32} color="#fff" />
                  <Loader2 size={32} color="#D4AF37" className="animate-spin" />
                  <div style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>Generando foto con IA...</div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>FLUX Schnell · ~5 segundos</div>
                </div>
              )}

              {/* ─── DRAW TOOL PANEL ──────────────────────────────────── */}
              <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 40, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Toggle button */}
                <button
                  onClick={() => setDrawMode(m => !m)}
                  title={drawMode ? 'Desactivar dibujo' : 'Dibujar líneas en la foto (ideal para marcar lotes)'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                    background: drawMode ? '#FF3B3B' : 'rgba(0,0,0,0.7)',
                    color: '#fff', fontSize: 11, fontWeight: 800,
                    backdropFilter: 'blur(8px)',
                    boxShadow: drawMode ? '0 0 12px rgba(255,59,59,0.5)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  <Pen size={13} /> {drawMode ? 'DIBUJO ACTIVO' : 'DIBUJAR LÍNEAS'}
                </button>

                {/* Draw controls — only when draw mode is on */}
                {drawMode && (
                  <div style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', borderRadius: 14, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 170 }}>
                    {/* Color swatches */}
                    <div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: 800, marginBottom: 5, letterSpacing: '0.06em' }}>COLOR DE LÍNEA</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {['#FF3B3B','#FFCC00','#00D4AA','#3B82F6','#fff','#000'].map(c => (
                          <button key={c} onClick={() => setDrawColor(c)}
                            style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: drawColor === c ? '2.5px solid #D4AF37' : '2px solid rgba(255,255,255,0.3)', cursor: 'pointer' }} />
                        ))}
                        <label style={{ width: 22, height: 22, borderRadius: '50%', background: 'conic-gradient(red,yellow,green,cyan,blue,magenta,red)', border: '2px solid rgba(255,255,255,0.4)', cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <input type="color" value={drawColor} onChange={e => setDrawColor(e.target.value)} style={{ opacity: 0, width: 0, height: 0 }} />
                        </label>
                      </div>
                    </div>
                    {/* Line width */}
                    <div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: 800, marginBottom: 4, letterSpacing: '0.06em' }}>GROSOR</div>
                      <div style={{ display: 'flex', gap: 5 }}>
                        {[2, 4, 7, 11].map(w => (
                          <button key={w} onClick={() => setDrawWidth(w)}
                            style={{ flex: 1, height: 28, borderRadius: 7, border: `1.5px solid ${drawWidth === w ? '#D4AF37' : 'rgba(255,255,255,0.2)'}`, background: drawWidth === w ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ height: w > 7 ? 6 : w > 3 ? 3 : 1.5, width: '60%', borderRadius: 99, background: '#fff' }} />
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Arrow toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Con flecha →</span>
                      <button onClick={() => setDrawArrow(a => !a)}
                        style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: drawArrow ? '#10b981' : 'rgba(255,255,255,0.2)', position: 'relative', transition: 'background 0.2s' }}>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: drawArrow ? 21 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
                      </button>
                    </div>
                    {/* Undo / Clear */}
                    <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
                      <button onClick={() => setDrawLines(prev => prev.slice(0, -1))}
                        disabled={drawLines.length === 0}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: drawLines.length === 0 ? 'rgba(255,255,255,0.3)' : '#fff', cursor: drawLines.length === 0 ? 'not-allowed' : 'pointer', fontSize: 10, fontWeight: 700 }}>
                        <Undo2 size={11} /> Deshacer
                      </button>
                      <button onClick={() => setDrawLines([])}
                        disabled={drawLines.length === 0}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px', borderRadius: 8, border: '1px solid rgba(255,100,100,0.3)', background: 'rgba(239,68,68,0.12)', color: drawLines.length === 0 ? 'rgba(255,255,255,0.3)' : '#fca5a5', cursor: drawLines.length === 0 ? 'not-allowed' : 'pointer', fontSize: 10, fontWeight: 700 }}>
                        <Trash2 size={11} /> Borrar todo
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Zoom controls — top right */}
              <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 30, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(8px)', borderRadius: 20, padding: '5px 12px' }}>
                <button onClick={() => setPreviewZoom(z => Math.max(0.3, +(z - 0.1).toFixed(1)))} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '0 2px', fontWeight: 700 }}>−</button>
                <span style={{ color: '#fff', fontSize: 11, fontWeight: 800, minWidth: 36, textAlign: 'center' }}>{Math.round(previewZoom * 100)}%</span>
                <button onClick={() => setPreviewZoom(z => Math.min(2.5, +(z + 0.1).toFixed(1)))} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '0 2px', fontWeight: 700 }}>+</button>
                <button onClick={() => setPreviewZoom(1.0)} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', fontSize: 10, cursor: 'pointer', borderRadius: 8, padding: '3px 8px', fontWeight: 700, marginLeft: 4 }}>Reset</button>
              </div>

              {/* ═══ TIPOGRAFÍA — floating below zoom ═══ */}
              <div style={{ position: 'absolute', top: 56, right: 12, zIndex: 30, background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(8px)', borderRadius: 14, padding: '8px 0', minWidth: 130 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em', textAlign: 'center', marginBottom: 4, paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>TIPOGRAFÍA</div>
                {([
                  { id: 'Outfit',           label: 'Outfit',      ff: 'Outfit, sans-serif' },
                  { id: 'Montserrat',       label: 'Montserrat',  ff: 'Montserrat, sans-serif' },
                  { id: 'Oswald',           label: 'Oswald',      ff: 'Oswald, sans-serif' },
                  { id: 'Poppins',          label: 'Poppins',     ff: 'Poppins, sans-serif' },
                  { id: 'Playfair Display', label: 'Playfair',    ff: '"Playfair Display", serif' },
                  { id: 'Bebas Neue',       label: 'Bebas Neue',  ff: '"Bebas Neue", sans-serif' },
                  { id: 'Raleway',          label: 'Raleway',     ff: 'Raleway, sans-serif' },
                  { id: 'Inter',            label: 'Inter',       ff: 'Inter, sans-serif' },
                ]).map(f => {
                  const active = (flyerData.flyerFont ?? 'Outfit') === f.id;
                  return (
                    <button key={f.id}
                      onClick={() => setFlyerData(prev => ({ ...prev, flyerFont: f.id }))}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '5px 12px', border: 'none', background: active ? 'rgba(212,175,55,0.18)' : 'transparent', cursor: 'pointer', fontFamily: f.ff, fontSize: 12, color: active ? '#D4AF37' : 'rgba(255,255,255,0.75)', fontWeight: active ? 800 : 400, transition: 'all 0.1s', boxSizing: 'border-box' }}
                      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
                      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <span>{f.label}</span>
                      {active && <span style={{ fontSize: 9, color: '#D4AF37' }}>✓</span>}
                    </button>
                  );
                })}
              </div>


              {/* ── FLOATING TEXT SIZE TOOLBAR — top center, above flyer ──────── */}
              <div style={{
                position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
                zIndex: 30, display: 'flex', alignItems: 'center', gap: 2,
                background: 'rgba(15,23,42,0.82)', backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.13)',
                borderRadius: 50, padding: '5px 6px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(212,175,55,0.12)',
                userSelect: 'none',
              }}>
                {/* Label */}
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', padding: '0 8px 0 4px', textTransform: 'uppercase' }}>Texto</span>

                {/* A- button */}
                <button
                  onClick={() => setFlyerData(prev => ({ ...prev, textScale: Math.max(0.6, +((prev.textScale ?? 1) - 0.1).toFixed(1)) }))}
                  title="Texto más pequeño"
                  style={{
                    width: 32, height: 32, borderRadius: '50%', border: 'none',
                    background: 'rgba(255,255,255,0.07)',
                    color: '#e2e8f0', cursor: 'pointer',
                    fontSize: 13, fontWeight: 900, letterSpacing: '-0.02em',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s ease', fontFamily: 'inherit',
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.16)'; (e.target as HTMLButtonElement).style.color = '#fff'; }}
                  onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)'; (e.target as HTMLButtonElement).style.color = '#e2e8f0'; }}
                  onMouseDown={e => { (e.target as HTMLButtonElement).style.transform = 'scale(0.88)'; }}
                  onMouseUp={e => { (e.target as HTMLButtonElement).style.transform = 'scale(1)'; }}
                >
                  <span style={{ fontSize: 12 }}>A</span>
                </button>

                {/* Size slider */}
                <input
                  type="range" min={0.6} max={1.6} step={0.05}
                  value={flyerData.textScale ?? 1}
                  onChange={e => setFlyerData(prev => ({ ...prev, textScale: parseFloat(e.target.value) }))}
                  style={{ width: 72, height: 4, accentColor: '#D4AF37', cursor: 'pointer', margin: '0 4px' }}
                  title="Tamaño de texto"
                />

                {/* Percentage */}
                <span style={{
                  color: '#D4AF37', fontSize: 11, fontWeight: 900,
                  minWidth: 38, textAlign: 'center', letterSpacing: '0.02em',
                  transition: 'all 0.15s',
                }}>
                  {Math.round((flyerData.textScale ?? 1) * 100)}%
                </span>

                {/* A+ button */}
                <button
                  onClick={() => setFlyerData(prev => ({ ...prev, textScale: Math.min(1.6, +((prev.textScale ?? 1) + 0.1).toFixed(1)) }))}
                  title="Texto más grande"
                  style={{
                    width: 32, height: 32, borderRadius: '50%', border: 'none',
                    background: 'rgba(255,255,255,0.07)',
                    color: '#e2e8f0', cursor: 'pointer',
                    fontSize: 18, fontWeight: 900,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s ease', fontFamily: 'inherit',
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.16)'; (e.target as HTMLButtonElement).style.color = '#fff'; }}
                  onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)'; (e.target as HTMLButtonElement).style.color = '#e2e8f0'; }}
                  onMouseDown={e => { (e.target as HTMLButtonElement).style.transform = 'scale(0.88)'; }}
                  onMouseUp={e => { (e.target as HTMLButtonElement).style.transform = 'scale(1)'; }}
                >
                  <span style={{ fontSize: 17 }}>A</span>
                </button>

                {/* Reset text scale */}
                {(flyerData.textScale ?? 1) !== 1 && (
                  <button
                    onClick={() => setFlyerData(prev => ({ ...prev, textScale: 1.0 }))}
                    title="Restablecer tamaño"
                    style={{
                      background: 'rgba(212,175,55,0.18)', border: 'none',
                      color: '#D4AF37', fontSize: 9, cursor: 'pointer',
                      borderRadius: 10, padding: '3px 8px', fontWeight: 800,
                      marginLeft: 2, letterSpacing: '0.05em', transition: 'all 0.15s',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(212,175,55,0.32)'; }}
                    onMouseLeave={e => { (e.currentTarget).style.background = 'rgba(212,175,55,0.18)'; }}
                  >RESET</button>
                )}
              </div>

              {/* Format badge — always visible, bottom center (above scroll layer) */}
              <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 30, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '5px 14px', borderRadius: 20, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'none' }}>
                <span>{selectedSize.icon}</span>
                <span style={{ color: selectedSize.type === 'Video' ? '#86efac' : '#fde68a' }}>{selectedSize.type}</span>
                <span>{selectedSize.label} · {selectedSize.w}×{selectedSize.h}px</span>
              </div>

              {/* ─ Scrollable flyer area ──── */}
              {(() => {
                // Compute the preview box size that preserves the format's aspect ratio
                const fmtAspect = selectedSize.h / selectedSize.w;
                const maxW = 490, maxH = 520;
                let baseW = maxW;
                let baseH = baseW * fmtAspect;
                if (baseH > maxH) { baseH = maxH; baseW = maxH / fmtAspect; }

                // previewScale: how much to shrink the template (which renders at selectedSize dimensions)
                // to fit the preview box. previewZoom scales UP from that base.
                const previewScale = Math.min(baseW / selectedSize.w, baseH / selectedSize.h);
                const finalScale = previewScale * previewZoom;

                const zoomed = previewZoom > 1.02;

                return (
                  <div style={{
                    position: 'absolute', inset: 0, zIndex: 10,
                    overflow: 'auto',
                    display: 'flex',
                    alignItems: zoomed ? 'flex-start' : 'center',
                    justifyContent: zoomed ? 'flex-start' : 'center',
                    padding: zoomed ? '52px 20px 52px 20px' : '52px 20px 44px 20px',
                  }}>
                    {/* Outer wrapper sized to POST-scale visual dimensions so layout is correct */}
                    <div style={{
                      width: Math.round(selectedSize.w * finalScale),
                      height: Math.round(selectedSize.h * finalScale),
                      boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
                      borderRadius: 8,
                      flexShrink: 0,
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                    ref={previewWrapRef}
                    onPointerMove={handleLogoPointerMove}
                    onPointerUp={handleLogoPointerUp}
                  >
                      {/* Inner div renders at full format dimensions then scaled down */}
                      <div style={{
                        width: selectedSize.w,
                        height: selectedSize.h,
                        transform: `scale(${finalScale})`,
                        transformOrigin: 'top left',
                        position: 'absolute',
                        top: 0, left: 0,
                      }}>
                        <RenderFlyer d={{ ...flyerData, containerW: selectedSize.w, containerH: selectedSize.h }} />
                        {/* Drag handle — hover-only border, no visible border at rest */}
                        {flyerData.logoUrl && flyerData.logoX != null && flyerData.logoY != null && (() => {
                          const sz = Math.round(32 * (Math.min(selectedSize.w / 540, selectedSize.h / 675)) * (flyerData.logoSize ?? 1));
                          const lx = (flyerData.logoX / 100) * selectedSize.w;
                          const ly = (flyerData.logoY / 100) * selectedSize.h;
                          return (
                            <div style={{ position: 'absolute', left: lx, top: ly, width: sz, height: sz, zIndex: 30, boxSizing: 'border-box', border: '2px dashed transparent', borderRadius: 8, cursor: 'move', transition: 'border-color 0.15s' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.85)'; const r = e.currentTarget.querySelector('.rh') as HTMLElement; if(r) r.style.opacity = '1'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; const r = e.currentTarget.querySelector('.rh') as HTMLElement; if(r) r.style.opacity = '0'; }}
                              onPointerDown={e => handleLogoPointerDown(e, 'move')}>
                              <div className="rh" style={{ position: 'absolute', bottom: -6, right: -6, width: 14, height: 14, background: '#fff', border: '2px solid #1a56db', borderRadius: 4, cursor: 'nwse-resize', opacity: 0, transition: 'opacity 0.15s' }}
                                onPointerDown={e => { e.stopPropagation(); handleLogoPointerDown(e, 'resize'); }} />
                            </div>
                          );
                        })()}
                        {/* First-click activation: click anywhere to place logo in free mode */}
                        {flyerData.logoUrl && flyerData.logoX == null && (
                          <div
                            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 25, cursor: 'crosshair' }}
                            title="Clic para posicionar logo libremente"
                            onPointerDown={e => {
                              const rect = previewWrapRef.current?.getBoundingClientRect();
                              if (!rect) return;
                              const xPct = ((e.clientX - rect.left) / rect.width) * 100;
                              const yPct = ((e.clientY - rect.top) / rect.height) * 100;
                              setFlyerData(prev => ({ ...prev, logoX: +Math.max(0, Math.min(85, xPct)).toFixed(1), logoY: +Math.max(0, Math.min(85, yPct)).toFixed(1) }));
                            }}
                          />
                        )}

                        {/* ─── DRAWING SVG OVERLAY ─────────────────────────── */}
                        {drawMode && (
                          <svg
                            ref={svgDrawRef}
                            style={{ position: 'absolute', top: 0, left: 0, width: selectedSize.w, height: selectedSize.h, zIndex: 50, cursor: 'crosshair', userSelect: 'none' }}
                            onMouseDown={e => {
                              const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
                              const sx = selectedSize.w / rect.width, sy = selectedSize.h / rect.height;
                              const x = (e.clientX - rect.left) * sx, y = (e.clientY - rect.top) * sy;
                              drawingRef.current = { active: true, startX: x, startY: y };
                              setDrawPreviewLine({ x1: x, y1: y, x2: x, y2: y });
                            }}
                            onMouseMove={e => {
                              if (!drawingRef.current.active) return;
                              const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
                              const sx = selectedSize.w / rect.width, sy = selectedSize.h / rect.height;
                              const x = (e.clientX - rect.left) * sx, y = (e.clientY - rect.top) * sy;
                              setDrawPreviewLine(prev => prev ? { ...prev, x2: x, y2: y } : null);
                            }}
                            onMouseUp={e => {
                              if (!drawingRef.current.active) return;
                              const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
                              const sx = selectedSize.w / rect.width, sy = selectedSize.h / rect.height;
                              const x2 = (e.clientX - rect.left) * sx, y2 = (e.clientY - rect.top) * sy;
                              const { startX: x1, startY: y1 } = drawingRef.current;
                              if (Math.hypot(x2 - x1, y2 - y1) > 8) {
                                setDrawLines(prev => [...prev, { x1, y1, x2, y2, color: drawColor, width: drawWidth, arrow: drawArrow }]);
                              }
                              drawingRef.current.active = false;
                              setDrawPreviewLine(null);
                            }}
                            onMouseLeave={() => { drawingRef.current.active = false; setDrawPreviewLine(null); }}
                          >
                            <defs>
                              {[...new Set([drawColor, ...drawLines.map((l) => l.color)])].map(c => (
                                <marker key={c} id={`arr-${c.replace('#','')}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                                  <path d="M0,0 L0,6 L8,3 z" fill={c} />
                                </marker>
                              ))}
                            </defs>
                            {drawLines.map((l, i) => (
                              <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                                stroke={l.color} strokeWidth={l.width} strokeLinecap="round"
                                markerEnd={l.arrow ? `url(#arr-${l.color.replace('#','')})` : undefined}
                                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }}
                              />
                            ))}
                            {drawPreviewLine && (
                              <line x1={drawPreviewLine.x1} y1={drawPreviewLine.y1} x2={drawPreviewLine.x2} y2={drawPreviewLine.y2}
                                stroke={drawColor} strokeWidth={drawWidth} strokeLinecap="round" strokeDasharray="12 6" opacity="0.75"
                                markerEnd={drawArrow ? `url(#arr-${drawColor.replace('#','')})` : undefined}
                              />
                            )}
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

            </div>

          </div>
        )}

      </main>

      {/* Hidden full-size flyer for html2canvas export */}
      {/* Strategy: fill the format WIDTH with the template (scale = selectedSize.w / 540).   */}
      {/* For portrait-taller formats (9:16 etc), the template fills width and is centered    */}
      {/* vertically; remaining space is filled with the accent gradient. For landscape formats*/}
      {/* the template is center-cropped vertically (only bottom may clip slightly).           */}
      <div style={{ position: 'fixed', top: -9999, left: -9999, zIndex: -1, pointerEvents: 'none' }}>
        {(() => {
          // Template renders at exact target dimensions — no scaling needed for export
          return (
            <div ref={flyerRef} style={{ width: selectedSize.w, height: selectedSize.h, overflow: 'hidden', position: 'relative' }}>
              <RenderFlyer d={{ ...flyerData, containerW: selectedSize.w, containerH: selectedSize.h }} />
              
              {/* STATIC SVG OVERLAY FOR EXPORT */}
              <svg style={{ position: 'absolute', top: 0, left: 0, width: selectedSize.w, height: selectedSize.h, pointerEvents: 'none' }}>
                <defs>
                  {[...new Set(drawLines.map(l => l.color))].map(c => (
                    <marker key={c} id={`export-arr-${c.replace('#','')}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L8,3 z" fill={c} />
                    </marker>
                  ))}
                </defs>
                {drawLines.map((l, i) => (
                  <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                    stroke={l.color} strokeWidth={l.width} strokeLinecap="round"
                    markerEnd={l.arrow ? `url(#export-arr-${l.color.replace('#','')})` : undefined}
                    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }}
                  />
                ))}
              </svg>
            </div>
          );
        })()}
      </div>
    </div>
  );
}