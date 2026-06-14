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
  '#10b981', '#ec4899', '#06b6d4', '#111827',
];

const DEFAULT_BG_IMAGE = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1080&auto=format&fit=crop';

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

function getThematicImages(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  
  if (/\b(pizza|comida|restaurante|food|pupusa|pupusas|taco|tacos|burger|hamburguesa|sushi)\b/i.test(lower)) {
    return [
      'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1080&q=80'
    ];
  }
  if (/\b(dentista|dental|diente|dientes|cl[íi]nica|odontolog[íi]a)\b/i.test(lower)) {
    return [
      'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1579684389782-64d84b5e901a?auto=format&fit=crop&w=1080&q=80'
    ];
  }
  if (/\b(defensa|seguridad|karate|marciales|taekwondo)\b/i.test(lower)) {
    return [
      'https://images.unsplash.com/photo-1555597673-b21d5c935865?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1544045560-723f24137ade?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1599058917212-d750089bc07e?auto=format&fit=crop&w=1080&q=80'
    ];
  }
  if (/\b(taller|auto|carro|veh[íi]culo|mec[aá]nico|motor)\b/i.test(lower)) {
    return [
      'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1517524206127-48bbd363f3d7?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1507767439269-2c64f107e609?auto=format&fit=crop&w=1080&q=80'
    ];
  }
  if (/\b(belleza|salon|sal[oó]n|u[ñn]as|spa|maquillaje|cabello|peluquer[íi]a)\b/i.test(lower)) {
    return [
      'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1607779097040-26e80aa78e66?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=1080&q=80'
    ];
  }
  if (/\b(gym|gimnasio|fit|fitness|ejercicio|entrenamiento)\b/i.test(lower)) {
    return [
      'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=1080&q=80'
    ];
  }
  if (/\b(abogado|legal|firma|consultor[íi]a|leyes|derecho)\b/i.test(lower)) {
    return [
      'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1505664194779-8bebcb95c02e?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1453728013993-6d66e9c9123a?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1080&q=80'
    ];
  }
  if (/\b(cafe|café|panaderia|panader[íi]a|reposter[íi]a|dulce|cafeter[íi]a)\b/i.test(lower)) {
    return [
      'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=1080&q=80'
    ];
  }
  if (/\b(casa|inmobiliaria|apartamento|hogar|propiedad|real estate|construccion|construcci[oó]n)\b/i.test(lower)) {
    return [
      'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1080&q=80'
    ];
  }
  if (/\b(perro|gato|mascota|veterinario|veterinaria|animal)\b/i.test(lower)) {
    return [
      'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1576201836106-db1758fd1c97?auto=format&fit=crop&w=1080&q=80'
    ];
  }
  if (/\b(educacion|educaci[oó]n|escuela|colegio|curso|clases|estudiar)\b/i.test(lower)) {
    return [
      'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1080&q=80'
    ];
  }
  if (/\b(limpieza|lavado|limpiar|planchado|orden)\b/i.test(lower)) {
    return [
      'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=1080&q=80'
    ];
  }
  if (/\b(yoga|wellness|meditacion|meditaci[oó]n|relajacion|relajaci[oó]n)\b/i.test(lower)) {
    return [
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1508672019048-805c876b67e2?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1080&q=80'
    ];
  }
  if (/\b(contable|finanzas|dinero|taxes|impuestos|accounting)\b/i.test(lower)) {
    return [
      'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1080&q=80'
    ];
  }

  return [
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1080&q=80',
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1080&q=80',
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1080&q=80',
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1080&q=80'
  ];
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function FlyerStudio() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const flyerRef = useRef<HTMLDivElement>(null);
  const templateRefA = useRef<HTMLDivElement>(null);
  const templateRefB = useRef<HTMLDivElement>(null);
  const templateRefMarketing = useRef<HTMLDivElement>(null);
  const lastGeneratedImg = useRef<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('bold-split');
  const [previewMode, setPreviewMode] = useState<'template' | 'ai'>('template');

  // Form & Content States
  const [prompt, setPrompt] = useState('Flyer promocional para nuestra oferta especial de temporada.');
  const [cta, setCta] = useState('¡CONTACTAR AHORA!');
  const [phone, setPhone] = useState('+503 7971-8911');
  const [website, setWebsite] = useState('www.ariasdefense.com');
  const [format, setFormat] = useState('ig-post');
  const [tone, setTone] = useState('moderno');
  const [variantCount, setVariantCount] = useState<1 | 2 | 3>(1);
  const [colors, setColors] = useState<string[]>(['#7c3aed']);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [isFormatModalOpen, setIsFormatModalOpen] = useState(false);
  const [isToneModalOpen, setIsToneModalOpen] = useState(false);
  const [isColorModalOpen, setIsColorModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [customHex, setCustomHex] = useState('#7c3aed');

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

  // Manual text & design overrides (Client Request)
  const [editingElement, setEditingElement] = useState<'title' | 'subtitle' | 'benefits' | 'cta' | 'logo' | 'background' | null>(null);
  const [subtitleBold, setSubtitleBold] = useState(false);
  const [benefitsBold, setBenefitsBold] = useState(false);

  const [modalPos, setModalPos] = useState({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });
  const modalStart = useRef({ x: 0, y: 0 });
  const isDraggingModal = useRef(false);

  useEffect(() => {
    if (editingElement) {
      setModalPos({ x: 0, y: 0 });
    }
  }, [editingElement]);

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDraggingModal.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    modalStart.current = { x: modalPos.x, y: modalPos.y };
    document.addEventListener('mousemove', handleHeaderMouseMove);
    document.addEventListener('mouseup', handleHeaderMouseUp);
  };

  const handleHeaderMouseMove = (e: MouseEvent) => {
    if (!isDraggingModal.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setModalPos({
      x: modalStart.current.x + dx,
      y: modalStart.current.y + dy
    });
  };

  const handleHeaderMouseUp = () => {
    isDraggingModal.current = false;
    document.removeEventListener('mousemove', handleHeaderMouseMove);
    document.removeEventListener('mouseup', handleHeaderMouseUp);
  };
  const [manualTitle, setManualTitle] = useState('OFERTA ESPECIAL');
  const [manualSubtitle, setManualSubtitle] = useState('Los mejores servicios y productos profesionales a tu alcance hoy mismo.');
  const [manualFeatures, setManualFeatures] = useState<string[]>([
    '✓ Atención Personalizada 24/7',
    '✓ Calidad 100% Garantizada',
    '✓ Profesionales Altamente Calificados',
    '✓ Descuento por Tiempo Limitado'
  ]);
  const [manualPrice, setManualPrice] = useState('¡Desde $29.99!');
  const [textScale, setTextScale] = useState(1.0);
  const [subtitleScale, setSubtitleScale] = useState(1.0);
  const [benefitsScale, setBenefitsScale] = useState(1.0);
  const [flyerFont, setFlyerFont] = useState('Outfit');
  const [titleColor, setTitleColor] = useState('');
  const [subtitleColor, setSubtitleColor] = useState('');
  const [benefitsColor, setBenefitsColor] = useState('');
  const [cardBgColor, setCardBgColor] = useState('');
  const [ctaBgColor, setCtaBgColor] = useState('');
  const [ctaTextColor, setCtaTextColor] = useState('');
  const [textY, setTextY] = useState(0);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');

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

  // Pre-populate manual inputs from basic parsing as the user types, before they generate
  useEffect(() => {
    if (variants.length > 0) return; // Don't overwrite generated/manually modified text
    if (!prompt.trim() || prompt === 'Flyer promocional para nuestra oferta especial de temporada.') return; // Don't overwrite default placeholder values
    const parsed = parsePrompt(prompt);
    const { h1, h2 } = deriveHeadline(prompt, companyName || 'Mi Empresa');
    setManualTitle(parsed.title || h1 || '');
    setManualSubtitle(parsed.subtitle || h2 || '');
    setManualFeatures(parsed.features && parsed.features.length > 0 ? parsed.features : deriveFeatures(prompt).slice(0, 4));
    setManualPrice(parsed.price || derivePrice(prompt) || '');
  }, [prompt, companyName]);


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
        return p.length < 3 ? [...p, hex] : [...p.slice(1), hex];
      }
    });
  }

  async function generate(mode: 'full' | 'background' = 'background') {
    if (!prompt.trim()) { toast.error('Describe qué quieres promocionar'); return; }
    const currentImg = bgUploadPreview || (variants.length > 0 ? variants[selected] : lastGeneratedImg.current);
    setGenerating(true);
    setVariants([]);
    setBgFile(null);
    setBgUploadPreview('');
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
        setManualTitle(data.structured_text.headline || '');
        setManualSubtitle(data.structured_text.subheadline || '');
        setManualFeatures(data.structured_text.features && data.structured_text.features.length > 0 ? data.structured_text.features : ['', '', '', '']);
        setManualPrice(data.structured_text.price || '');
      }
      setSelected(0);
      setPreviewMode('ai');
      // Modo 'full': la imagen de DALL-E ES el flyer — mostrarlo como imagen pura (ahora por defecto mostramos plantilla)
      // Modo 'background': usarla como fondo de la plantilla HTML
      setShowFullAiResult(false);
      if (data.credits_remaining != null) setCredits(data.credits_remaining);
      if (mode === 'full') {
        toast.success('✨ ¡Flyer Profesional con IA generado!');
      } else {
        toast.success('🎨 Fondo IA generado — diseño HTML superpuesto.');
      }
    } catch (e: any) {
      console.warn('AI generation failed, applying premium stock fallback:', e);
      // Fallback: search for keywords in the prompt to match beautiful Unsplash stock images
      const fallbackImgs = getThematicImages(prompt);
      let shuffled = [...fallbackImgs].sort(() => Math.random() - 0.5);
      if (currentImg && fallbackImgs.length > 1) {
        let attempts = 0;
        while (shuffled[0] === currentImg && attempts < 10) {
          shuffled = [...fallbackImgs].sort(() => Math.random() - 0.5);
          attempts++;
        }
      }
      lastGeneratedImg.current = shuffled[0];
      setVariants(shuffled);
      
      // Also generate optimized copy locally based on basic parsing since openai failed
      const parsed = parsePrompt(prompt);
      const { h1, h2 } = deriveHeadline(prompt, companyName || 'Mi Empresa');
      const fallbackText = {
        headline: parsed.title || h1,
        subheadline: parsed.subtitle || h2,
        features: parsed.features || deriveFeatures(prompt).slice(0, 3),
        cta: parsed.cta || cta || 'Contáctanos hoy',
        price: parsed.price || derivePrice(prompt) || ''
      };
      setAiOptimizedText(fallbackText);
      setManualTitle(fallbackText.headline || '');
      setManualSubtitle(fallbackText.subheadline || '');
      setManualFeatures(fallbackText.features && fallbackText.features.length > 0 ? fallbackText.features : ['', '', '', '']);
      setManualPrice(fallbackText.price || '');

      setSelected(0);
      setPreviewMode('ai');
      setShowFullAiResult(false); // Fallback Unsplash → se usa como fondo de la plantilla HTML
      toast.success('✨ Usando imagen temática como fondo. Para flyer IA completo, verifica créditos.');
    } finally {
      setGenerating(false);
    }
  }

  async function generateFree() {
    if (!prompt.trim()) { toast.error('Describe qué quieres promocionar'); return; }
    const currentImg = bgUploadPreview || (variants.length > 0 ? variants[selected] : lastGeneratedImg.current);
    setGenerating(true);
    setVariants([]);
    setBgFile(null);
    setBgUploadPreview('');
    setAiOptimizedText(null);
    setIsFullAiFlyer(false);
    setShowFullAiResult(false);

    try {
      const fallbackImgs = getThematicImages(prompt);
      let shuffled = [...fallbackImgs].sort(() => Math.random() - 0.5);
      if (currentImg && fallbackImgs.length > 1) {
        let attempts = 0;
        while (shuffled[0] === currentImg && attempts < 10) {
          shuffled = [...fallbackImgs].sort(() => Math.random() - 0.5);
          attempts++;
        }
      }
      lastGeneratedImg.current = shuffled[0];
      setVariants(shuffled);

      // Parse prompt locally to generate structured copy
      const parsed = parsePrompt(prompt);
      const { h1, h2 } = deriveHeadline(prompt, companyName || 'Mi Empresa');
      const fallbackText = {
        headline: parsed.title || h1,
        subheadline: parsed.subtitle || h2,
        features: parsed.features || deriveFeatures(prompt).slice(0, 3),
        cta: parsed.cta || cta || 'Contáctanos hoy',
        price: parsed.price || derivePrice(prompt) || ''
      };
      setAiOptimizedText(fallbackText);
      setManualTitle(fallbackText.headline || '');
      setManualSubtitle(fallbackText.subheadline || '');
      setManualFeatures(fallbackText.features && fallbackText.features.length > 0 ? fallbackText.features : ['', '', '', '']);
      setManualPrice(fallbackText.price || '');

      setSelected(0);
      setPreviewMode('ai');
      setShowFullAiResult(false);
      toast.success('✨ Flyer generado usando imagen temática gratuita');
    } catch (e: any) {
      console.error('Error generating free background:', e);
      toast.error('Error al generar flyer: ' + e.message);
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
      if (showFullAiResult) {
        if (!flyerRef.current) { toast.error('Flyer no está listo'); return; }
        const canvas = await html2canvas(flyerRef.current, {
          useCORS: true,
          allowTaint: true,
          scale: 2,
          backgroundColor: null
        });
        dataUrl = canvas.toDataURL('image/png');
      } else {
        const ref = selectedTemplate === 'A' ? templateRefA : selectedTemplate === 'B' ? templateRefB : templateRefMarketing;
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
      if (showFullAiResult) {
        if (!flyerRef.current) { toast.error('Flyer no está listo'); return; }
        // Use scale: 1.5 and image/jpeg to compress output size and prevent QuotaExceededError in sessionStorage
        const canvas = await html2canvas(flyerRef.current, {
          useCORS: true, allowTaint: true, scale: 1.5, backgroundColor: null
        });
        dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      } else {
        const ref = selectedTemplate === 'A' ? templateRefA : selectedTemplate === 'B' ? templateRefB : templateRefMarketing;
        if (!ref.current) throw new Error('Template not ready');
        // Use scale: 1.5 and image/jpeg to compress output size and prevent QuotaExceededError in sessionStorage
        const canvas = await html2canvas(ref.current, {
          useCORS: true, allowTaint: true, scale: 1.5, backgroundColor: null
        });
        dataUrl = canvas.toDataURL('image/jpeg', 0.85);
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
                id="textarea-prompt"
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
            {/* Format Selection (Modal Trigger) */}
            <div style={css.section}>
              <label style={css.label}>Formato</label>
              <button
                type="button"
                onClick={() => setIsFormatModalOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '10px 14px',
                  background: '#fff',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: 10,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {React.createElement(FORMATS.find(f => f.id === format)?.icon || Smartphone, { size: 16, color: '#7c3aed' })}
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                    {FORMATS.find(f => f.id === format)?.label}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '3px 8px', borderRadius: 6 }}>
                    {FORMATS.find(f => f.id === format)?.tag}
                  </span>
                  <ChevronRight size={14} color="#94a3b8" />
                </div>
              </button>
            </div>

            {/* Tone Selection (Modal Trigger) */}
            <div style={css.section}>
              <label style={css.label}>Tono de diseño</label>
              <button
                type="button"
                onClick={() => setIsToneModalOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '10px 14px',
                  background: '#fff',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: 10,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {React.createElement(TONES.find(t => t.key === tone)?.icon || Sparkles, { size: 16, color: '#0070d2' })}
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                    {TONES.find(t => t.key === tone)?.label}
                  </span>
                </div>
                <ChevronRight size={14} color="#94a3b8" />
              </button>
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
                          ? '0 0 0 2px #0f172a, 0 4px 8px rgba(0,0,0,0.15)' 
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
                            hex === '#fff' || hex === '#f59e0b' || hex === '#10b981'
                              ? '#0f172a' 
                              : '#ffffff'
                          } 
                          strokeWidth={3.5} 
                        />
                      )}
                    </button>
                  );
                })}
                {colors.filter(c => !BRAND_COLORS.map(bc => bc.toLowerCase()).includes(c.toLowerCase())).map(hex => {
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
                        border: '2px solid #fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 0 2px #0f172a, 0 4px 8px rgba(0,0,0,0.15)',
                        transform: 'scale(1.15)',
                        transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                        padding: 0
                      }}
                    >
                      <Check 
                        size={11} 
                        color={
                          hex === '#fff' || hex === '#ffffff' || hex === '#f59e0b' || hex === '#10b981'
                            ? '#0f172a' 
                            : '#ffffff'
                        } 
                        strokeWidth={3.5} 
                      />
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setIsColorModalOpen(true)}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    border: '1px dashed #7c3aed',
                    background: '#f5f3ff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 'bold',
                    color: '#7c3aed',
                    transition: 'all 0.15s ease',
                    padding: 0
                  }}
                >
                  +
                </button>
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

            {/* ═══════════════════════════════════════════════════════════════
                AI GENERATION BUTTONS — Primary: Autocorrected Flyer
            ═══════════════════════════════════════════════════════════════ */}
            <div style={{ paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>

              {/* MAIN BUTTON — AI Flyer with Autocorrected HTML overlay */}
              <button
                id="btn-generate-flyer"
                onClick={() => generate('background')}
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
                {generating ? (
                  <><Cpu size={16} style={{ animation: 'spin 1s linear infinite' }} /> Creando diseño con IA...</>
                ) : (
                  <><Sparkles size={16} color="#fff" fill="#fff" /> Generar Flyer con IA</>
                )}
              </button>

              {/* Description */}
              <div style={{ fontSize: 10, color: '#64748b', textAlign: 'center', lineHeight: 1.5, padding: '0 4px', marginBottom: 4 }}>
                ✨ La IA dibuja un fondo abstracto espectacular y el sistema escribe los textos editables por encima en HTML. ¡Cero errores ortográficos!
              </div>

              {/* FREE STOCK PHOTO BUTTON */}
              <button
                id="btn-generate-free"
                className="btn-free-photo"
                onClick={() => generateFree()}
                disabled={generating || !prompt.trim()}
                style={{
                  border: '1.5px solid #10b981',
                  borderRadius: 10,
                  padding: '12px 20px', fontSize: 13, fontWeight: 900,
                  cursor: generating || !prompt.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', justifyContent: 'center',
                  opacity: !prompt.trim() ? 0.5 : 1,
                  boxShadow: '0 2px 8px rgba(16,185,129,0.1)',
                  transition: 'all 0.2s ease',
                  letterSpacing: '0.01em',
                  marginBottom: 8
                }}
              >
                <Image size={15} color="#10b981" /> Generar con Fotos Gratis
              </button>

              {/* SELECT TEMPLATE CATALOG */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={css.label}>Plantilla del Flyer</label>
                <button
                  type="button"
                  id="select-template"
                  onClick={() => setIsTemplateModalOpen(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '10px 14px',
                    background: '#fff',
                    border: '1.5px solid #7c3aed40',
                    borderRadius: 10,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxSizing: 'border-box'
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                    {selectedTemplate === 'A' 
                      ? '✨ Template A — Glow Glassmorphic' 
                      : selectedTemplate === 'B' 
                      ? '🏢 Template B — Editorial Showcase' 
                      : TEMPLATE_LIST.find(t => t.id === selectedTemplate)?.name || 'Seleccionar Plantilla'}
                  </span>
                  <ChevronRight size={14} color="#94a3b8" />
                </button>
              </div>

              {/* Espaciador estético */}
              <div style={{ height: 4 }} />

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
                .btn-free-photo {
                  background: #fff !important;
                  border: 1.5px solid #10b981 !important;
                  color: #10b981 !important;
                  transition: all 0.2s ease !important;
                }
                .btn-free-photo:hover:not(:disabled) {
                  background: #f0fdf4 !important;
                  box-shadow: 0 4px 12px rgba(16,185,129,0.15) !important;
                  transform: translateY(-1px);
                }
                .btn-free-photo:active:not(:disabled) {
                  transform: translateY(0);
                }
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
              <div id="generating-overlay" style={{
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



            {/* ══ CONTROL BAR (Variants & Layout) ══ */}
            {!showSuggestions && !generating && variants.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '10px 14px', borderRadius: 10, border: '1px solid #dde1e7', gap: 10, width: '100%', maxWidth: 480, boxSizing: 'border-box' }}>
                {/* Status indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                    border: '1px solid #bbf7d0',
                    padding: '5px 10px', borderRadius: 8,
                    fontSize: 10, fontWeight: 800, color: '#16a34a',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}>
                    <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                    <span>Autocorrección y textos editables activos</span>
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
            {!showSuggestions && !generating && showFullAiResult && (variants.length > 0 || bgUploadPreview) ? (
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
            {!showSuggestions && !generating && !showFullAiResult && (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Canvas */}
                <div style={{ display: 'flex', justifyContent: 'center', width: '100%', userSelect: 'none' }}>
                  <div
                    ref={flyerRef}
                    style={{
                      position: 'relative', borderRadius: 14, overflow: 'hidden',
                      boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
                      width: '100%',
                      maxWidth: `min(${getFlyerDimensions(format).width}px, 100%)`,
                      aspectRatio: `${getFlyerDimensions(format).width} / ${getFlyerDimensions(format).height}`,
                      border: '1px solid #dde1e7', background: '#fff',
                      transition: 'transform 0.2s ease',
                      cursor: 'default'
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 0, left: 0,
                      transform: `scale(${getFlyerDimensions(format).width / 1080})`,
                      transformOrigin: 'top left',
                      width: 1080, height: 1080, pointerEvents: 'auto'
                    }}>
                      {selectedTemplate === 'A' ? (
                        <FlyerTemplateA data={{
                          company_name: companyName || 'Mi Empresa',
                          prompt, cta: aiOptimizedText?.cta || cta || '¡CONTÁCTANOS HOY!',
                          headline: manualTitle || 'OFERTA INCREÍBLE',
                          subheadline: manualSubtitle || 'Soluciones profesionales a la medida de tu negocio.',
                          features: manualFeatures.some(f => f.trim() !== '') ? manualFeatures : ['✓ Garantía por Escrito', '✓ Soporte Técnico 24/7', '✓ Profesionales Expertos', '✓ Cobertura Inmediata'],
                          price: manualPrice || '¡Precios de Locura!',
                          highlight_title: aiOptimizedText?.highlight_title,
                          highlight_desc: aiOptimizedText?.highlight_desc,
                          benefits: aiOptimizedText?.benefits,
                          mockup_info: aiOptimizedText?.mockup_info,
                          primaryColor: colors[0] || '#e91e8c',
                          secondaryColor: colors[1] || (colors[0] ? '#0f172a' : '#1a1a2e'),
                          phone, website, logoUrl: logoPreview || undefined,
                          bgImageUrl: bgUploadPreview || (variants.length > 0 ? variants[selected] : undefined) || DEFAULT_BG_IMAGE,
                          flyerFont,
                          textScale,
                          subtitleScale,
                          benefitsScale,
                          logoSize,
                          logoX,
                          logoY,
                          titleColor,
                          subtitleColor,
                          benefitsColor,
                          cardBgColor,
                          ctaBgColor,
                          ctaTextColor,
                          textY,
                          textAlign,
                          onTitleClick: () => setEditingElement('title'),
                          onSubtitleClick: () => setEditingElement('subtitle'),
                          onBenefitsClick: () => setEditingElement('benefits'),
                          onCtaClick: () => setEditingElement('cta'),
                          onLogoClick: () => setEditingElement('logo'),
                          onBgClick: () => setEditingElement('background'),
                          subtitleBold,
                          benefitsBold,
                        }} />
                      ) : selectedTemplate === 'B' ? (
                        <FlyerTemplateB data={{
                          company_name: companyName || 'Mi Empresa',
                          prompt, cta: aiOptimizedText?.cta || cta || '¡CONTÁCTANOS HOY!',
                          headline: manualTitle || 'OFERTA INCREÍBLE',
                          subheadline: manualSubtitle || 'Soluciones profesionales a la medida de tu negocio.',
                          features: manualFeatures.some(f => f.trim() !== '') ? manualFeatures : ['✓ Garantía por Escrito', '✓ Soporte Técnico 24/7', '✓ Profesionales Expertos', '✓ Cobertura Inmediata'],
                          price: manualPrice || '¡Precios de Locura!',
                          highlight_title: aiOptimizedText?.highlight_title,
                          highlight_desc: aiOptimizedText?.highlight_desc,
                          benefits: aiOptimizedText?.benefits,
                          mockup_info: aiOptimizedText?.mockup_info,
                          primaryColor: colors[0] || '#9b1c1c',
                          secondaryColor: colors[1] || (colors[0] ? '#0f172a' : '#1a1a2e'),
                          phone, website, logoUrl: logoPreview || undefined,
                          bgImageUrl: bgUploadPreview || (variants.length > 0 ? variants[selected] : undefined) || DEFAULT_BG_IMAGE,
                          flyerFont,
                          textScale,
                          subtitleScale,
                          benefitsScale,
                          logoSize,
                          logoX,
                          logoY,
                          titleColor,
                          subtitleColor,
                          benefitsColor,
                          cardBgColor,
                          ctaBgColor,
                          ctaTextColor,
                          textY,
                          textAlign,
                          onTitleClick: () => setEditingElement('title'),
                          onSubtitleClick: () => setEditingElement('subtitle'),
                          onBenefitsClick: () => setEditingElement('benefits'),
                          onCtaClick: () => setEditingElement('cta'),
                          onLogoClick: () => setEditingElement('logo'),
                          onBgClick: () => setEditingElement('background'),
                          subtitleBold,
                          benefitsBold,
                        }} />
                      ) : (
                        <RenderFlyer d={{
                          title: manualTitle || 'TU OFERTA',
                          subtitle: manualSubtitle || 'Soluciones profesionales a la medida de tu negocio.',
                          cta: aiOptimizedText?.cta || cta || 'COMIENZA HOY',
                          beneficios: manualFeatures.filter(f => f.trim() !== '').length > 0 ? manualFeatures.filter(f => f.trim() !== '') : ['✓ Garantía por Escrito', '✓ Soporte Técnico 24/7', '✓ Profesionales Expertos', '✓ Cobertura Inmediata'],
                          accent: colors[0] || '#0070d2',
                          bgImageUrl: bgUploadPreview || (variants.length > 0 ? variants[selected] : null) || DEFAULT_BG_IMAGE,
                          logoUrl: logoPreview || null,
                          industria: companyName || 'Mi Empresa',
                          phone, website, templateId: selectedTemplate,
                          containerW: 1080, containerH: 1080,
                          logoSize, logoX, logoY,
                          flyerFont,
                          textScale,
                          subtitleScale,
                          benefitsScale,
                          titleColor,
                          subtitleColor,
                          benefitsColor,
                          cardBgColor,
                          ctaBgColor,
                          ctaTextColor,
                          textY,
                          textAlign,
                          onTitleClick: () => setEditingElement('title'),
                          onSubtitleClick: () => setEditingElement('subtitle'),
                          onBenefitsClick: () => setEditingElement('benefits'),
                          onCtaClick: () => setEditingElement('cta'),
                          onLogoClick: () => setEditingElement('logo'),
                          onBgClick: () => setEditingElement('background'),
                          subtitleBold,
                          benefitsBold,
                        }}
                        onLogoMove={(x, y) => { setLogoX(x); setLogoY(y); }}
                        onLogoResize={(s) => setLogoSize(s)}
                        />
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
                  <button
                    id="btn-send-to-social"
                    onClick={sendToSocialHub}
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
          cta: aiOptimizedText?.cta || cta || '¡CONTÁCTANOS HOY!',
          headline: manualTitle || 'OFERTA INCREÍBLE',
          subheadline: manualSubtitle || 'Soluciones profesionales a la medida de tu negocio.',
          features: manualFeatures.some(f => f.trim() !== '') ? manualFeatures : ['✓ Garantía por Escrito', '✓ Soporte Técnico 24/7', '✓ Profesionales Expertos', '✓ Cobertura Inmediata'],
          price: manualPrice || '¡Precios de Locura!',
          highlight_title: aiOptimizedText?.highlight_title,
          highlight_desc: aiOptimizedText?.highlight_desc,
          benefits: aiOptimizedText?.benefits,
          mockup_info: aiOptimizedText?.mockup_info,
          primaryColor: colors[0] || '#e91e8c',
          secondaryColor: colors[1] || (colors[0] ? '#0f172a' : '#1a1a2e'),
          phone, website,
          logoUrl: logoPreview || undefined,
          bgImageUrl: bgUploadPreview || (variants.length > 0 ? variants[selected] : undefined) || DEFAULT_BG_IMAGE,
          flyerFont,
          textScale,
          subtitleScale,
          benefitsScale,
          logoSize,
          logoX,
          logoY,
          titleColor,
          subtitleColor,
          benefitsColor,
          cardBgColor,
          ctaBgColor,
          ctaTextColor,
          textY,
          textAlign,
          subtitleBold,
          benefitsBold
        }} />
        <FlyerTemplateB ref={templateRefB} data={{
          company_name: companyName || 'Mi Empresa',
          prompt,
          cta: aiOptimizedText?.cta || cta || '¡CONTÁCTANOS HOY!',
          headline: manualTitle || 'OFERTA INCREÍBLE',
          subheadline: manualSubtitle || 'Soluciones profesionales a la medida de tu negocio.',
          features: manualFeatures.some(f => f.trim() !== '') ? manualFeatures : ['✓ Garantía por Escrito', '✓ Soporte Técnico 24/7', '✓ Profesionales Expertos', '✓ Cobertura Inmediata'],
          price: manualPrice || '¡Precios de Locura!',
          highlight_title: aiOptimizedText?.highlight_title,
          highlight_desc: aiOptimizedText?.highlight_desc,
          benefits: aiOptimizedText?.benefits,
          mockup_info: aiOptimizedText?.mockup_info,
          primaryColor: colors[0] || '#9b1c1c',
          secondaryColor: colors[1] || (colors[0] ? '#0f172a' : '#1a1a2e'),
          phone, website,
          logoUrl: logoPreview || undefined,
          bgImageUrl: bgUploadPreview || (variants.length > 0 ? variants[selected] : undefined) || DEFAULT_BG_IMAGE,
          flyerFont,
          textScale,
          subtitleScale,
          benefitsScale,
          logoSize,
          logoX,
          logoY,
          titleColor,
          subtitleColor,
          benefitsColor,
          cardBgColor,
          ctaBgColor,
          ctaTextColor,
          textY,
          textAlign,
          subtitleBold,
          benefitsBold
        }} />
        <div ref={templateRefMarketing}>
          <RenderFlyer d={{
            title: manualTitle || 'TU OFERTA',
            subtitle: manualSubtitle || 'Soluciones profesionales a la medida de tu negocio.',
            cta: aiOptimizedText?.cta || cta || 'COMIENZA HOY',
            beneficios: manualFeatures.filter(f => f.trim() !== '').length > 0 ? manualFeatures.filter(f => f.trim() !== '') : ['✓ Garantía por Escrito', '✓ Soporte Técnico 24/7', '✓ Profesionales Expertos', '✓ Cobertura Inmediata'],
            accent: colors[0] || '#0070d2',
            bgImageUrl: bgUploadPreview || (variants.length > 0 ? variants[selected] : null) || DEFAULT_BG_IMAGE,
            logoUrl: logoPreview || null,
            industria: companyName || 'Mi Empresa',
            phone, website, templateId: selectedTemplate,
            containerW: 1080, containerH: 1080,
            logoSize, logoX, logoY,
            flyerFont,
            textScale,
            subtitleScale,
            benefitsScale,
            titleColor,
            subtitleColor,
            benefitsColor,
            cardBgColor,
            ctaBgColor,
            ctaTextColor,
            textY,
            textAlign,
            subtitleBold,
            benefitsBold
          }} />
        </div>
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
              {showFullAiResult && (variants.length > 0 || bgUploadPreview) ? (
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
                  <div style={{ transform: `scale(${sc})`, transformOrigin: 'top left', width: 1080, height: 1080, pointerEvents: 'none' }}>
                    {selectedTemplate === 'A' ? (
                      <FlyerTemplateA data={{
                        company_name: companyName || 'Mi Empresa', prompt,
                        cta: aiOptimizedText?.cta || cta || '¡CONTÁCTANOS HOY!',
                        headline: manualTitle || 'OFERTA INCREÍBLE', subheadline: manualSubtitle || 'Soluciones profesionales a la medida de tu negocio.',
                        features: manualFeatures.some(f => f.trim() !== '') ? manualFeatures : ['✓ Garantía por Escrito', '✓ Soporte Técnico 24/7', '✓ Profesionales Expertos', '✓ Cobertura Inmediata'], price: manualPrice || '¡Precios de Locura!',
                        highlight_title: aiOptimizedText?.highlight_title,
                        highlight_desc: aiOptimizedText?.highlight_desc,
                        benefits: aiOptimizedText?.benefits,
                        mockup_info: aiOptimizedText?.mockup_info,
                        primaryColor: colors[0] || '#e91e8c', secondaryColor: colors[1] || '#1a1a2e',
                        phone, website, logoUrl: logoPreview || undefined,
                        bgImageUrl: bgUploadPreview || (variants.length > 0 ? variants[selected] : undefined) || DEFAULT_BG_IMAGE,
                        flyerFont,
                        textScale,
                        subtitleScale,
                        benefitsScale,
                        logoSize,
                        logoX,
                        logoY,
                        titleColor,
                        subtitleColor,
                        benefitsColor,
                        cardBgColor,
                        ctaBgColor,
                        ctaTextColor,
                        textY,
                        textAlign,
                        subtitleBold,
                        benefitsBold
                      }} />
                    ) : selectedTemplate === 'B' ? (
                      <FlyerTemplateB data={{
                        company_name: companyName || 'Mi Empresa', prompt,
                        cta: aiOptimizedText?.cta || cta || '¡CONTÁCTANOS HOY!',
                        headline: manualTitle || 'OFERTA INCREÍBLE', subheadline: manualSubtitle || 'Soluciones profesionales a la medida de tu negocio.',
                        features: manualFeatures.some(f => f.trim() !== '') ? manualFeatures : ['✓ Garantía por Escrito', '✓ Soporte Técnico 24/7', '✓ Profesionales Expertos', '✓ Cobertura Inmediata'], price: manualPrice || '¡Precios de Locura!',
                        highlight_title: aiOptimizedText?.highlight_title,
                        highlight_desc: aiOptimizedText?.highlight_desc,
                        benefits: aiOptimizedText?.benefits,
                        mockup_info: aiOptimizedText?.mockup_info,
                        primaryColor: colors[0] || '#9b1c1c', secondaryColor: colors[1] || '#1a1a2e',
                        phone, website, logoUrl: logoPreview || undefined,
                        bgImageUrl: bgUploadPreview || (variants.length > 0 ? variants[selected] : undefined) || DEFAULT_BG_IMAGE,
                        flyerFont,
                        textScale,
                        subtitleScale,
                        benefitsScale,
                        logoSize,
                        logoX,
                        logoY,
                        titleColor,
                        subtitleColor,
                        benefitsColor,
                        cardBgColor,
                        ctaBgColor,
                        ctaTextColor,
                        textY,
                        textAlign,
                        subtitleBold,
                        benefitsBold
                      }} />
                    ) : (
                      <RenderFlyer d={{
                        title: manualTitle || 'TU OFERTA',
                        subtitle: manualSubtitle || 'Soluciones profesionales a la medida de tu negocio.',
                        cta: aiOptimizedText?.cta || cta || 'COMIENZA HOY',
                        beneficios: manualFeatures.filter(f => f.trim() !== '').length > 0 ? manualFeatures.filter(f => f.trim() !== '') : ['✓ Garantía por Escrito', '✓ Soporte Técnico 24/7', '✓ Profesionales Expertos', '✓ Cobertura Inmediata'],
                        accent: colors[0] || '#0070d2',
                        bgImageUrl: bgUploadPreview || (variants.length > 0 ? variants[selected] : null) || DEFAULT_BG_IMAGE,
                        logoUrl: logoPreview || null,
                        industria: companyName || 'Mi Empresa',
                        phone, website, templateId: selectedTemplate,
                        containerW: 1080, containerH: 1080,
                        logoSize, logoX, logoY,
                        flyerFont,
                        textScale,
                        subtitleScale,
                        benefitsScale,
                        titleColor,
                        subtitleColor,
                        benefitsColor,
                        cardBgColor,
                        ctaBgColor,
                        ctaTextColor,
                        textY,
                        textAlign,
                        subtitleBold,
                        benefitsBold
                      }}
                      onLogoMove={(x, y) => { setLogoX(x); setLogoY(y); }}
                      onLogoResize={(s) => setLogoSize(s)}
                      />
                    )}
                  </div>
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

      {/* ── ELEMENT EDIT MODAL ────────────────────────────────────────────────── */}
      {editingElement !== null && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: 'rgba(0, 0, 0, 0.02)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 0.2s ease-out',
          padding: 20
        }} onClick={() => setEditingElement(null)}>
          {/* Prevent click closing when clicking inside the modal card */}
          <div 
            style={{
              background: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              borderRadius: 20,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
              width: '100%',
              maxWidth: 420,
              display: 'flex', flexDirection: 'column',
              transform: `translate(${modalPos.x}px, ${modalPos.y}px)`,
              animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              overflow: 'hidden'
            }} 
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div 
              onMouseDown={handleHeaderMouseDown}
              style={{ 
                padding: '16px 20px', 
                borderBottom: '1px solid rgba(0, 0, 0, 0.08)', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                cursor: 'move',
                userSelect: 'none'
              }}
            >
              <div>
                <span style={{ fontSize: 13, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {editingElement === 'title' && '✏️ Editar Título'}
                  {editingElement === 'subtitle' && '✏️ Editar Subtítulo'}
                  {editingElement === 'benefits' && '✏️ Editar Beneficios'}
                  {editingElement === 'cta' && '✏️ Editar Botón CTA'}
                  {editingElement === 'logo' && '✏️ Ajustar Logo'}
                  {editingElement === 'background' && '✏️ Ajustar Fondo'}
                </span>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Edición en tiempo real</div>
              </div>
              <button 
                onClick={() => setEditingElement(null)}
                onMouseDown={e => e.stopPropagation()}
                style={{
                  background: 'rgba(0, 0, 0, 0.04)', border: 'none',
                  borderRadius: '50%', width: 28, height: 28,
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', transition: 'background 0.2s'
                }}
              >
                <X size={14} color="#0f172a" />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '70vh', overflowY: 'auto' }}>
              {editingElement === 'title' && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Texto del Título</span>
                    <textarea 
                      style={{ ...css.textarea, minHeight: 60 }} 
                      value={manualTitle} 
                      onChange={e => setManualTitle(e.target.value)}
                      placeholder="Título principal del flyer"
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Tipo de Letra (Fuente)</span>
                    <select
                      value={flyerFont}
                      onChange={e => setFlyerFont(e.target.value)}
                      style={{ ...css.input, fontWeight: 700 }}
                    >
                      <option value="Outfit">Outfit (Moderna & Limpia)</option>
                      <option value="Montserrat">Montserrat (Geométrica B2B)</option>
                      <option value="Oswald">Oswald (Condensada Impacto)</option>
                      <option value="Poppins">Poppins (Redonda Popular)</option>
                      <option value="Playfair Display">Playfair Display (Serif Elegante)</option>
                      <option value="Bebas Neue">Bebas Neue (Titulares Sans)</option>
                      <option value="Raleway">Raleway (Sofisticada Delgado)</option>
                      <option value="Inter">Inter (Estándar Pro)</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569', fontWeight: 800, textTransform: 'uppercase' }}>
                      <span>Escala de Título</span>
                      <span>{textScale.toFixed(2)}x</span>
                    </div>
                    <input type="range" min="0.5" max="2.0" step="0.05" value={textScale} onChange={e => setTextScale(parseFloat(e.target.value))} style={{ width: '100%' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Color del Título</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input 
                        type="color" 
                        value={titleColor || '#000000'} 
                        onChange={e => setTitleColor(e.target.value)} 
                        style={{ width: 36, height: 36, padding: 0, border: '1px solid #d8dde6', cursor: 'pointer', borderRadius: 6, flexShrink: 0 }} 
                      />
                      <input 
                        type="text" 
                        value={titleColor} 
                        onChange={e => setTitleColor(e.target.value)} 
                        placeholder="Por defecto"
                        style={css.input} 
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Alineación del Texto</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {(['left', 'center', 'right'] as const).map(align => (
                        <button
                          key={align}
                          type="button"
                          onClick={() => setTextAlign(align)}
                          style={{
                            flex: 1, padding: '8px 12px', fontSize: 11, fontWeight: 700, borderRadius: 6,
                            border: '1px solid #d8dde6',
                            background: textAlign === align ? '#0f172a' : '#fff',
                            color: textAlign === align ? '#fff' : '#0f172a',
                            cursor: 'pointer', transition: 'all 0.2s'
                          }}
                        >
                          {align === 'left' ? 'Izquierda' : align === 'center' ? 'Centro' : 'Derecha'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569', fontWeight: 800, textTransform: 'uppercase' }}>
                      <span>Desplazamiento Vertical</span>
                      <span>{textY}px</span>
                    </div>
                    <input type="range" min="-200" max="200" step="5" value={textY} onChange={e => setTextY(parseInt(e.target.value))} style={{ width: '100%' }} />
                  </div>
                </>
              )}

              {editingElement === 'subtitle' && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Texto del Subtítulo</span>
                    <textarea 
                      style={{ ...css.textarea, minHeight: 60 }} 
                      value={manualSubtitle} 
                      onChange={e => setManualSubtitle(e.target.value)}
                      placeholder="Subtítulo o gancho descriptivo"
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569', fontWeight: 800, textTransform: 'uppercase' }}>
                      <span>Escala de Subtítulo</span>
                      <span>{subtitleScale.toFixed(2)}x</span>
                    </div>
                    <input type="range" min="0.5" max="2.0" step="0.05" value={subtitleScale} onChange={e => setSubtitleScale(parseFloat(e.target.value))} style={{ width: '100%' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Color del Subtítulo</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input 
                        type="color" 
                        value={subtitleColor || '#000000'} 
                        onChange={e => setSubtitleColor(e.target.value)} 
                        style={{ width: 36, height: 36, padding: 0, border: '1px solid #d8dde6', cursor: 'pointer', borderRadius: 6, flexShrink: 0 }} 
                      />
                      <input 
                        type="text" 
                        value={subtitleColor} 
                        onChange={e => setSubtitleColor(e.target.value)} 
                        placeholder="Por defecto"
                        style={css.input} 
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <input 
                      type="checkbox" 
                      id="chk-subtitle-bold" 
                      checked={subtitleBold} 
                      onChange={e => setSubtitleBold(e.target.checked)}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <label htmlFor="chk-subtitle-bold" style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
                      Texto en Negrita (Bold)
                    </label>
                  </div>
                </>
              )}

              {editingElement === 'benefits' && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Características / Beneficios</span>
                    {manualFeatures.map((feat, idx) => (
                      <input
                        key={idx}
                        style={css.input}
                        value={feat}
                        onChange={e => {
                          const copy = [...manualFeatures];
                          copy[idx] = e.target.value;
                          setManualFeatures(copy);
                        }}
                        placeholder={`Beneficio ${idx + 1}`}
                      />
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569', fontWeight: 800, textTransform: 'uppercase' }}>
                      <span>Escala de Beneficios</span>
                      <span>{benefitsScale.toFixed(2)}x</span>
                    </div>
                    <input type="range" min="0.5" max="2.0" step="0.05" value={benefitsScale} onChange={e => setBenefitsScale(parseFloat(e.target.value))} style={{ width: '100%' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Color de Viñetas</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input 
                        type="color" 
                        value={benefitsColor || '#000000'} 
                        onChange={e => setBenefitsColor(e.target.value)} 
                        style={{ width: 36, height: 36, padding: 0, border: '1px solid #d8dde6', cursor: 'pointer', borderRadius: 6, flexShrink: 0 }} 
                      />
                      <input 
                        type="text" 
                        value={benefitsColor} 
                        onChange={e => setBenefitsColor(e.target.value)} 
                        placeholder="Por defecto"
                        style={css.input} 
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <input 
                      type="checkbox" 
                      id="chk-benefits-bold" 
                      checked={benefitsBold} 
                      onChange={e => setBenefitsBold(e.target.checked)}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <label htmlFor="chk-benefits-bold" style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
                      Texto en Negrita (Bold)
                    </label>
                  </div>
                </>
              )}

              {editingElement === 'cta' && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Texto del Botón CTA</span>
                    <input 
                      style={css.input} 
                      value={cta} 
                      onChange={e => setCta(e.target.value)}
                      placeholder="Ej: REGÍSTRATE HOY"
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Precio (Si aplica)</span>
                    <input 
                      style={css.input} 
                      value={manualPrice} 
                      onChange={e => setManualPrice(e.target.value)}
                      placeholder="Ej: Desde $12.95"
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Color de Fondo de Botón</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input 
                        type="color" 
                        value={ctaBgColor || '#000000'} 
                        onChange={e => setCtaBgColor(e.target.value)} 
                        style={{ width: 36, height: 36, padding: 0, border: '1px solid #d8dde6', cursor: 'pointer', borderRadius: 6, flexShrink: 0 }} 
                      />
                      <input 
                        type="text" 
                        value={ctaBgColor} 
                        onChange={e => setCtaBgColor(e.target.value)} 
                        placeholder="Por defecto"
                        style={css.input} 
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Color del Texto de Botón</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input 
                        type="color" 
                        value={ctaTextColor || '#000000'} 
                        onChange={e => setCtaTextColor(e.target.value)} 
                        style={{ width: 36, height: 36, padding: 0, border: '1px solid #d8dde6', cursor: 'pointer', borderRadius: 6, flexShrink: 0 }} 
                      />
                      <input 
                        type="text" 
                        value={ctaTextColor} 
                        onChange={e => setCtaTextColor(e.target.value)} 
                        placeholder="Por defecto"
                        style={css.input} 
                      />
                    </div>
                  </div>
                </>
              )}

              {editingElement === 'logo' && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Reemplazar Logo</span>
                    <button onClick={() => logoRef.current?.click()} style={{ ...css.btn, background: '#0f172a' }}>
                      <Upload size={14} /> Subir nueva imagen de Logo
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569', fontWeight: 800, textTransform: 'uppercase' }}>
                      <span>Escala del Logo</span>
                      <span>{logoSize.toFixed(1)}x</span>
                    </div>
                    <input type="range" min="0.4" max="2.5" step="0.1" value={logoSize} onChange={e => setLogoSize(parseFloat(e.target.value))} style={{ width: '100%' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569', fontWeight: 800, textTransform: 'uppercase' }}>
                      <span>Posición Horizontal (X)</span>
                      <span>{logoX.toFixed(0)}%</span>
                    </div>
                    <input type="range" min="0" max="95" step="1" value={logoX} onChange={e => setLogoX(parseInt(e.target.value))} style={{ width: '100%' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569', fontWeight: 800, textTransform: 'uppercase' }}>
                      <span>Posición Vertical (Y)</span>
                      <span>{logoY.toFixed(0)}%</span>
                    </div>
                    <input type="range" min="0" max="95" step="1" value={logoY} onChange={e => setLogoY(parseInt(e.target.value))} style={{ width: '100%' }} />
                  </div>
                </>
              )}

              {editingElement === 'background' && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Fondo Personalizado (Imagen)</span>
                    <button onClick={() => bgUploadRef.current?.click()} style={{ ...css.btn, background: '#0f172a' }}>
                      <Upload size={14} /> Subir Imagen de Fondo
                    </button>
                    {bgUploadPreview && (
                      <button 
                        onClick={() => { setBgFile(null); setBgUploadPreview(''); }}
                        style={{ ...css.ghost, border: '1px solid #ef4444', color: '#ef4444', justifyContent: 'center' }}
                      >
                        Eliminar Fondo Personalizado
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Color de Tarjeta / Superposición</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input 
                        type="color" 
                        value={cardBgColor || '#000000'} 
                        onChange={e => setCardBgColor(e.target.value)} 
                        style={{ width: 36, height: 36, padding: 0, border: '1px solid #d8dde6', cursor: 'pointer', borderRadius: 6, flexShrink: 0 }} 
                      />
                      <input 
                        type="text" 
                        value={cardBgColor} 
                        onChange={e => setCardBgColor(e.target.value)} 
                        placeholder="Por defecto"
                        style={css.input} 
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(0, 0, 0, 0.08)', background: 'rgba(0, 0, 0, 0.02)', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setEditingElement(null)}
                style={{
                  ...css.btn,
                  width: 'auto',
                  padding: '8px 20px',
                  background: 'linear-gradient(135deg,#0070d2,#005fb2)',
                  fontWeight: 800
                }}
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FORMAT SELECTION MODAL ────────────────────────────────────── */}
      {isFormatModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 3000,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 0.2s ease-out'
        }} onClick={() => setIsFormatModalOpen(false)}>
          <div style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 20,
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
            width: '100%',
            maxWidth: 440,
            display: 'flex', flexDirection: 'column',
            animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            overflow: 'hidden'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0, 0, 0, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Selecciona Formato</span>
              <button onClick={() => setIsFormatModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={16} color="#64748b" />
              </button>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {FORMATS.map(f => {
                const IconComponent = f.icon;
                const active = format === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => { setFormat(f.id); setIsFormatModalOpen(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: 12,
                      border: `1.5px solid ${active ? '#7c3aed' : '#e2e8f0'}`,
                      background: active ? '#7c3aed0a' : '#fff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <IconComponent size={18} color={active ? '#7c3aed' : '#64748b'} />
                      <span style={{ fontSize: 13, fontWeight: active ? 800 : 600, color: '#0f172a' }}>{f.label}</span>
                    </div>
                    <span style={{ fontSize: 11, color: active ? '#7c3aed' : '#94a3b8', fontWeight: 700 }}>{f.tag}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TONE SELECTION MODAL ──────────────────────────────────────── */}
      {isToneModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 3000,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 0.2s ease-out'
        }} onClick={() => setIsToneModalOpen(false)}>
          <div style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 20,
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
            width: '100%',
            maxWidth: 440,
            display: 'flex', flexDirection: 'column',
            animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            overflow: 'hidden'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0, 0, 0, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Selecciona Tono</span>
              <button onClick={() => setIsToneModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={16} color="#64748b" />
              </button>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TONES.map(t => {
                const IconComponent = t.icon;
                const active = tone === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => { setTone(t.key); setIsToneModalOpen(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: 12,
                      border: `1.5px solid ${active ? '#0070d2' : '#e2e8f0'}`,
                      background: active ? '#0070d20a' : '#fff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <IconComponent size={18} color={active ? '#0070d2' : t.color} />
                      <span style={{ fontSize: 13, fontWeight: active ? 800 : 600, color: '#0f172a' }}>{t.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── BRAND COLOR PICKER MODAL ──────────────────────────────────── */}
      {isColorModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 3000,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 0.2s ease-out'
        }} onClick={() => setIsColorModalOpen(false)}>
          <div style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 20,
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
            width: '100%',
            maxWidth: 360,
            display: 'flex', flexDirection: 'column',
            animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            overflow: 'hidden'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0, 0, 0, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Color Personalizado</span>
              <button onClick={() => setIsColorModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={16} color="#64748b" />
              </button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="color"
                  value={customHex}
                  onChange={e => setCustomHex(e.target.value)}
                  style={{
                    width: 50, height: 50, padding: 0,
                    border: '1px solid #d8dde6', cursor: 'pointer', borderRadius: 8, flexShrink: 0
                  }}
                />
                <div style={{ flex: 1 }}>
                  <label style={{ ...css.label, marginBottom: 4 }}>Código HEX</label>
                  <input
                    type="text"
                    placeholder="#000000"
                    value={customHex}
                    onChange={e => setCustomHex(e.target.value)}
                    style={{ ...css.input, textTransform: 'uppercase' }}
                  />
                </div>
              </div>
              
              <button
                type="button"
                onClick={() => {
                  let validHex = customHex.trim();
                  if (!validHex.startsWith('#')) {
                    validHex = '#' + validHex;
                  }
                  if (/^#[0-9A-F]{6}$/i.test(validHex)) {
                    toggleColor(validHex);
                    setIsColorModalOpen(false);
                  } else {
                    toast.error('Código HEX inválido. Usa el formato #RRGGBB');
                  }
                }}
                style={{ ...css.btn, background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}
              >
                Aplicar Color de Marca
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TEMPLATE CATALOG SELECTION MODAL ──────────────────────────── */}
      {isTemplateModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 3000,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 0.2s ease-out'
        }} onClick={() => setIsTemplateModalOpen(false)}>
          <div style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 24,
            boxShadow: '0 20px 45px rgba(0, 0, 0, 0.18)',
            width: '100%',
            maxWidth: 580,
            maxHeight: '85vh',
            display: 'flex', flexDirection: 'column',
            animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            overflow: 'hidden'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(0, 0, 0, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Catálogo de Plantillas</span>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Selecciona el diseño base para tu flyer</div>
              </div>
              <button onClick={() => setIsTemplateModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={18} color="#64748b" />
              </button>
            </div>
            
            <div className="flyer-studio-col" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Plantillas Corporativas Pro</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button
                    onClick={() => { setSelectedTemplate('A'); setPreviewMode('template'); setShowFullAiResult(false); setIsTemplateModalOpen(false); }}
                    style={{
                      textAlign: 'left',
                      padding: '12px 14px',
                      borderRadius: 14,
                      border: `2px solid ${selectedTemplate === 'A' ? '#7c3aed' : '#e2e8f0'}`,
                      background: selectedTemplate === 'A' ? '#7c3aed05' : '#fff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 850, color: '#0f172a' }}>✨ Template A — Glow Glassmorphic</div>
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>Diseño moderno con efecto de vidrio esmerilado y luces de neón.</div>
                  </button>
                  
                  <button
                    onClick={() => { setSelectedTemplate('B'); setPreviewMode('template'); setShowFullAiResult(false); setIsTemplateModalOpen(false); }}
                    style={{
                      textAlign: 'left',
                      padding: '12px 14px',
                      borderRadius: 14,
                      border: `2px solid ${selectedTemplate === 'B' ? '#7c3aed' : '#e2e8f0'}`,
                      background: selectedTemplate === 'B' ? '#7c3aed05' : '#fff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 850, color: '#0f172a' }}>🏢 Template B — Editorial Showcase</div>
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>Disposición editorial limpia tipo B2B ideal para mostrar marcas corporativas.</div>
                  </button>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Catálogo de Marketing (Autorescaling)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {TEMPLATE_LIST.map(t => {
                    const active = selectedTemplate === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => { setSelectedTemplate(t.id); setPreviewMode('template'); setShowFullAiResult(false); setIsTemplateModalOpen(false); }}
                        style={{
                          textAlign: 'left',
                          padding: '12px 14px',
                          borderRadius: 14,
                          border: `2px solid ${active ? '#7c3aed' : '#e2e8f0'}`,
                          background: active ? '#7c3aed05' : '#fff',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          width: '100%',
                          boxSizing: 'border-box'
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: active ? 850 : 700, color: '#0f172a' }}>{t.name}</div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>{t.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}