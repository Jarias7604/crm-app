import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Sparkles, Download, Send, RefreshCw,
  Zap, Image, Check, ChevronLeft, ChevronRight, ChevronDown, Upload, X, Eye, Plus,
  BarChart3, Wand2, Layers, Palette, Type, Layout,
  ExternalLink, Star, Cpu, Crown, Smile, Building2,
  Instagram, Facebook, Linkedin, Smartphone, Video,
  FolderOpen, Save, Loader2, Trash2, Edit2,
  Info, Target, Award, Globe
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../services/supabase';
import html2canvas from 'html2canvas';
import { toPng } from 'html-to-image';
import { RenderFlyer, FreeLogo, TEMPLATE_LIST } from './FlyerTemplates';
import type { FlyerData } from './FlyerTemplates';
import { FlyerTemplateA, FlyerTemplateB, parsePrompt, deriveHeadline, deriveFeatures, derivePrice, deriveCta } from '../../components/flyers/FlyerTemplates';
import { brandingService } from '../../services/branding';
import { storageService } from '../../services/storage';
import { industriesService } from '../../services/industries';

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

const DEFAULT_LOGO_SVG = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+PHBvbHlnb24gcG9pbnRzPSI1MCwxNSA5MCw4MCAxMCw4MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjN2MzYWVkIiBzdHJva2Utd2lkdGg9IjgiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSIxNSIgZmlsbD0iIzdjM2FlZCIvPjwvc3ZnPg==';

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
  select: {
    width: '100%',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '13px',
    color: '#0f172a',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
    background: '#ffffff',
    cursor: 'pointer',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    fontWeight: 700,
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    backgroundSize: '16px 16px',
    paddingRight: '36px',
  },
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

function getThematicImages(prompt: string, industry?: string): string[] {
  const lI = (industry || '').toLowerCase();
  const lP = prompt.toLowerCase();
  const U = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1080&q=80`;
  const TECH = ['photo-1518770660439-4636190af475','photo-1488590528505-98d2b5aba04b','photo-1461749280684-dccba630e2f6','photo-1504639725590-34d0984388bd','photo-1551434678-e076c223a692','photo-1522071820081-009f0129c71c','photo-1542744173-8e7e53415bb0','photo-1486312338219-ce68d2c6f44d','photo-1498050108023-c5249f4df085','photo-1531297484001-80022131f5a1','photo-1519389950473-47ba0277781c','photo-1600880292203-757bb62b4baf','photo-1560472355-536de3962603','photo-1507238691740-187a5b1d37b8','photo-1516321165247-4aa89a48be55'].map(U);
  const FOOD = ['photo-1513104890138-7c749659a591','photo-1504674900247-0877df9cc836','photo-1565299624946-b28f40a0ae38','photo-1568901346375-23c9450c58cd','photo-1512621776951-a57141f2eefd','photo-1544025162-d76694265947','photo-1578985545062-69928b1d9587','photo-1555396273-367ea4eb4db5','photo-1540189549336-e6e99c3679fe','photo-1567620905732-2d1ec7ab7445'].map(U);
  const MEDICAL = ['photo-1622253692010-333f2da6031d','photo-1559839734-2b71ea197ec2','photo-1576091160550-2173dba999ef','photo-1584515906207-523b4c207da7','photo-1537368910025-700350fe46c7','photo-1476480862126-209bfaa8edc8','photo-1519494026892-80bbd2d6fd0d','photo-1551076805-e1869033e561','photo-1631815541552-b5848c1a596c','photo-1505751172876-fa1923c5c528'].map(U);
  const DENTAL = ['photo-1629909613654-28e377c37b09','photo-1588776814546-1ffcf47267a5','photo-1606811971618-4486d14f3f99','photo-1629909615184-74f495363b67','photo-1552566626-52f8b828add9','photo-1576765608535-5f04d1e3f289'].map(U);
  const BEAUTY = ['photo-1560066984-138dadb4c035','photo-1522337360788-8b13dee7a37e','photo-1604654894610-df63bc536371','photo-1540555700478-4be289fbecef','photo-1512290923902-8a9f81dc236c','photo-1562322140-8baeececf3df'].map(U);
  const GYM = ['photo-1517838277536-f5f99be501cd','photo-1534438327276-14e5300c3a48','photo-1571902943202-507ec2618e8f','photo-1526506118085-60ce8714f8c5','photo-1549719386-74dfcbf7dbed','photo-1584735935682-2f2b69dff9d2'].map(U);
  const LEGAL = ['photo-1589829545856-d10d557cf95f','photo-1521587760476-6c12a4b040da','photo-1521791136368-1a46827d06e5','photo-1507679799987-c73779587ccf','photo-1551836022-d5d88e9218df'].map(U);
  const CAFE = ['photo-1501339847302-ac426a4a7cbb','photo-1495474472287-4d71bcdd2085','photo-1509042239860-f550ce710b93','photo-1442512595331-e89e73853f31','photo-1554118811-1e0d58224f24'].map(U);
  const REALESTATE = ['photo-1560518883-ce09059eeffa','photo-1512917774080-9991f1c4c750','photo-1564013799919-ab600027ffc6','photo-1600585154340-be6161a56a0c','photo-1600607687939-ce8a6c25118c'].map(U);
  const AUTO = ['photo-1486006920555-c77dce18193b','photo-1619642751034-765dfdf7c58e','photo-1568605117036-5fe5e7bab0b7','photo-1492144534655-ae79c964c9d7','photo-1525609004556-c46c7d6cf0a3'].map(U);
  const DEFENSE = ['photo-1555597673-b21d5c935865','photo-1509198397868-475647b2a1e5','photo-1563986768609-322da13575f3','photo-1614064641938-3bbee52942c7'].map(U);
  const GENERAL = ['photo-1460925895917-afdab827c52f','photo-1519389950473-47ba0277781c','photo-1522071820081-009f0129c71c','photo-1531403009284-440f080d1e12','photo-1486406146926-c627a92ad1ab','photo-1522202176988-66273c2fd55f','photo-1504384308090-c894fdcc538d','photo-1517245386807-bb43f82c33c4'].map(U);
  function pick(t: string) {
    if (/laboratorio|cl[íi]nica|m[eé]dic|farmacia|salud|hospital|doctor|odontolog|dental|dentista|pediatr|enfermer/i.test(t)) return /dental|dentista|odontolog/i.test(t)?DENTAL:MEDICAL;
    if (/restaurante|comida|food|pizza|taco|burger|hamburgues|sushi|pupusa/i.test(t)) return FOOD;
    if (/cafeter[íi]a|caf[eé]|panadería|panaderia/i.test(t)) return CAFE;
    if (/crm|software|saas|tecnolog|digital|sistema|plataforma|ecommerce|inteligencia artificial|embudos|automatizaci/i.test(t)) return TECH;
    if (/belleza|salon|uñas|spa|maquillaje|cabello|peluquer/i.test(t)) return BEAUTY;
    if (/gym|gimnasio|fitness|deporte|entrenamiento/i.test(t)) return GYM;
    if (/abogado|legal|firma|leyes|derecho/i.test(t)) return LEGAL;
    if (/casa|inmobiliaria|apartamento|propiedad|construcci/i.test(t)) return REALESTATE;
    if (/taller|automotriz|mec[aá]nico|veh[íi]culo|repuesto|carro/i.test(t)) return AUTO;
    if (/defensa|karate|marciales|taekwondo/i.test(t)) return DEFENSE;
    return null;
  }
  return (lI && pick(lI)) || pick(lP) || GENERAL;
}

const FONT_OPTIONS = [
  { value: 'Outfit', name: 'Outfit', desc: 'Moderna & Limpia' },
  { value: 'Montserrat', name: 'Montserrat', desc: 'Geométrica B2B' },
  { value: 'Oswald', name: 'Oswald', desc: 'Condensada Impacto' },
  { value: 'Poppins', name: 'Poppins', desc: 'Redonda Popular' },
  { value: 'Playfair Display', name: 'Playfair Display', desc: 'Serif Elegante' },
  { value: 'Bebas Neue', name: 'Bebas Neue', desc: 'Titulares Sans' },
  { value: 'Raleway', name: 'Raleway', desc: 'Sofisticada Delgado' },
  { value: 'Inter', name: 'Inter', desc: 'Estándar Pro' },
];

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
  const [flyerWidth, setFlyerWidth] = useState(520);
  const canvasH = Math.round(1080 * (getFlyerDimensions(format).height / getFlyerDimensions(format).width));
  const [tone, setTone] = useState('moderno');
  const [variantCount, setVariantCount] = useState<1 | 2 | 3>(1);
  const [colors, setColors] = useState<string[]>(['#7c3aed']);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState(DEFAULT_LOGO_SVG);
  const [isLogoCustomized, setIsLogoCustomized] = useState(false);
  const brandingLoaded = useRef(false);
  const [isFormatModalOpen, setIsFormatModalOpen] = useState(false);
  const [isToneModalOpen, setIsToneModalOpen] = useState(false);
  const [isColorModalOpen, setIsColorModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [customHex, setCustomHex] = useState('#7c3aed');

  // Free photo gallery modal states
  const [isFreePhotoModalOpen, setIsFreePhotoModalOpen] = useState(false);
  const [freePhotoIndex, setFreePhotoIndex] = useState(0);
  const [freePhotosPool, setFreePhotosPool] = useState<string[]>([]);

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
  const [isAidaModalOpen, setIsAidaModalOpen] = useState(false);

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

  const [manualTitle, setManualTitle] = useState('OFERTA ESPECIAL');
  const [keepCustomText, setKeepCustomText] = useState(false);
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
  const [titleFont, setTitleFont] = useState('Outfit');
  const [subtitleFont, setSubtitleFont] = useState('Outfit');
  const [benefitsFont, setBenefitsFont] = useState('Outfit');
  const [ctaFont, setCtaFont] = useState('Outfit');
  const [contactFont, setContactFont] = useState('Outfit');
  const [syncFonts, setSyncFonts] = useState(false);
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false);
  const [industries, setIndustries] = useState<any[]>([]);
  const [selectedIndustry, setSelectedIndustry] = useState<string>('auto');
  const [isIndustryDropdownOpen, setIsIndustryDropdownOpen] = useState(false);
  const [industrySearchQuery, setIndustrySearchQuery] = useState('');
  // Saved designs states
  const [savedFlyers, setSavedFlyers] = useState<any[]>([]);
  const [loadingSavedFlyers, setLoadingSavedFlyers] = useState(false);
  const [savingFlyer, setSavingFlyer] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [newDesignName, setNewDesignName] = useState('');
  const [loadedFlyerId, setLoadedFlyerId] = useState<string | null>(null);
  const [loadedFlyerName, setLoadedFlyerName] = useState<string | null>(null);
  const [editingFlyerId, setEditingFlyerId] = useState<string | null>(null);
  const [editingFlyerName, setEditingFlyerName] = useState('');

  const filteredIndustries = industries.filter(ind =>
    (ind.name || '').toLowerCase().includes(industrySearchQuery.toLowerCase())
  );

  const updateFont = (val: string, element: 'title' | 'subtitle' | 'benefits' | 'cta' | 'contact') => {
    if (syncFonts) {
      setFlyerFont(val);
      setTitleFont(val);
      setSubtitleFont(val);
      setBenefitsFont(val);
      setCtaFont(val);
      setContactFont(val);
    } else {
      if (element === 'title') setTitleFont(val);
      else if (element === 'subtitle') setSubtitleFont(val);
      else if (element === 'benefits') setBenefitsFont(val);
      else if (element === 'cta') setCtaFont(val);
      else if (element === 'contact') setContactFont(val);
    }
  };

  const toggleSyncFonts = (checked: boolean) => {
    setSyncFonts(checked);
    if (checked) {
      let activeFont = flyerFont;
      if (editingElement === 'title') activeFont = titleFont;
      else if (editingElement === 'subtitle') activeFont = subtitleFont;
      else if (editingElement === 'benefits') activeFont = benefitsFont;
      else if (editingElement === 'cta') activeFont = ctaFont;
      else if (editingElement === 'contact') activeFont = contactFont;

      setFlyerFont(activeFont);
      setTitleFont(activeFont);
      setSubtitleFont(activeFont);
      setBenefitsFont(activeFont);
      setCtaFont(activeFont);
      setContactFont(activeFont);
    }
  };

  const renderFontSelector = (currentValue: string, element: 'title' | 'subtitle' | 'benefits' | 'cta' | 'contact') => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Tipo de Letra (Fuente)</span>
        <div style={{ position: 'relative', width: '100%' }}>
          <button
            type="button"
            onClick={() => setIsFontDropdownOpen(!isFontDropdownOpen)}
            style={{
              width: '100%',
              border: isFontDropdownOpen ? '1px solid #7c3aed' : '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '13px',
              color: '#0f172a',
              outline: 'none',
              background: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontWeight: 700,
              boxShadow: isFontDropdownOpen ? '0 0 0 3px rgba(124, 58, 237, 0.1)' : 'none',
              transition: 'all 0.15s ease',
              fontFamily: `"${currentValue}", sans-serif`,
            }}
          >
            <span>{FONT_OPTIONS.find(o => o.value === currentValue)?.name || currentValue}</span>
            <ChevronDown size={16} style={{ color: '#475569', transform: isFontDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>

          {isFontDropdownOpen && (
            <>
              {/* Invisible backdrop to catch outside clicks */}
              <div 
                style={{ position: 'fixed', inset: 0, zIndex: 9999, cursor: 'default' }} 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFontDropdownOpen(false);
                }} 
              />
              {/* Custom Options List */}
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 6,
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                maxHeight: 180,
                overflowY: 'auto',
                zIndex: 10000,
                padding: '4px',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}>
                {FONT_OPTIONS.map(opt => {
                  const isSelected = opt.value === currentValue;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateFont(opt.value, element);
                        setIsFontDropdownOpen(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: isSelected ? '#f5f3ff' : 'transparent',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textAlign: 'left',
                        fontFamily: `"${opt.value}", sans-serif`,
                        fontSize: '13px',
                        fontWeight: isSelected ? 800 : 500,
                        color: isSelected ? '#7c3aed' : '#334155',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseOver={e => {
                        if (!isSelected) {
                          e.currentTarget.style.background = '#f8fafc';
                          e.currentTarget.style.color = '#0f172a';
                        }
                      }}
                      onMouseOut={e => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = '#334155';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ fontSize: '13px' }}>{opt.name}</span>
                        <span style={{ fontSize: '9px', color: isSelected ? '#a78bfa' : '#94a3b8', fontWeight: 400 }}>{opt.desc}</span>
                      </div>
                      {isSelected && <Check size={14} style={{ color: '#7c3aed' }} />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#475569', userSelect: 'none' }}>
          <input 
            type="checkbox" 
            checked={syncFonts} 
            onChange={e => toggleSyncFonts(e.target.checked)} 
            style={{ 
              width: 14, 
              height: 14, 
              cursor: 'pointer',
              accentColor: '#7c3aed',
            }}
          />
          Aplicar la misma fuente a todos los textos
        </label>
      </div>
    );
  };
  const [titleColor, setTitleColor] = useState('');
  const [subtitleColor, setSubtitleColor] = useState('');
  const [benefitsColor, setBenefitsColor] = useState('');
  const [cardBgColor, setCardBgColor] = useState('');
  const [ctaBgColor, setCtaBgColor] = useState('');
  const [ctaTextColor, setCtaTextColor] = useState('');
  const [contactColor, setContactColor] = useState('');
  const [highlightColor, setHighlightColor] = useState('#FFD700');
  const [textY, setTextY] = useState(0);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');

  // Manual text & design overrides (Client Request)
  const [editingElement, setEditingElement] = useState<'title' | 'logo' | 'background' | 'subtitle' | 'benefits' | 'cta' | 'contact' | null>(null);
  const [subtitleBold, setSubtitleBold] = useState(false);
  const [benefitsBold, setBenefitsBold] = useState(false);

  // Scaling states
  const [titleScale, setTitleScale] = useState(1.0);
  const [ctaScale, setCtaScale] = useState(1.0);
  const [contactScale, setContactScale] = useState(1.0);

  // Y Translation states
  const [titleY, setTitleY] = useState(0);
  const [subtitleY, setSubtitleY] = useState(0);
  const [benefitsY, setBenefitsY] = useState(0);
  const [ctaY, setCtaY] = useState(0);
  const [contactY, setContactY] = useState(0);

  // X Translation states
  const [titleX, setTitleX] = useState(0);
  const [subtitleX, setSubtitleX] = useState(0);
  const [benefitsX, setBenefitsX] = useState(0);
  const [ctaX, setCtaX] = useState(0);
  const [contactX, setContactX] = useState(0);

  // Bounding rect for active element overlay
  const [overlayRect, setOverlayRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const [modalPos, setModalPos] = useState({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });
  const modalStart = useRef({ x: 0, y: 0 });
  const isDraggingModal = useRef(false);

  useEffect(() => {
    if (editingElement) {
      setModalPos({ x: 0, y: 0 });
    }
  }, [editingElement]);

  useEffect(() => {
    if (!editingElement || !flyerRef.current) {
      setOverlayRect(null);
      return;
    }

    const updateOverlay = () => {
      if (!flyerRef.current) return;
      const container = flyerRef.current;
      const el = container.querySelector(`[data-element-id="${editingElement}"]`);
      if (el) {
        const containerRect = container.getBoundingClientRect();
        const rect = el.getBoundingClientRect();
        setOverlayRect({
          top: rect.top - containerRect.top,
          left: rect.left - containerRect.left,
          width: rect.width,
          height: rect.height
        });
      } else {
        setOverlayRect(null);
      }
    };

    updateOverlay();
    const timer = setTimeout(updateOverlay, 50);
    return () => clearTimeout(timer);
  }, [
    editingElement,
    selectedTemplate,
    format,
    titleScale,
    subtitleScale,
    benefitsScale,
    ctaScale,
    contactScale,
    titleX,
    subtitleX,
    benefitsX,
    ctaX,
    contactX,
    titleY,
    subtitleY,
    benefitsY,
    ctaY,
    contactY,
    logoX,
    logoY,
    logoSize,
    manualTitle,
    manualSubtitle,
    manualFeatures,
    manualPrice,
    contactColor
  ]);

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

  useEffect(() => {
    if (!flyerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0) {
          setFlyerWidth(width);
        }
      }
    });
    resizeObserver.observe(flyerRef.current);
    return () => resizeObserver.disconnect();
  }, [showFullAiResult, selectedTemplate, variants, previewMode, format, selected]);

  useEffect(() => {
    if (!isFreePhotoModalOpen || freePhotosPool.length === 0) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setFreePhotoIndex(prev => (prev === 0 ? freePhotosPool.length - 1 : prev - 1));
      } else if (e.key === 'ArrowRight') {
        setFreePhotoIndex(prev => (prev === freePhotosPool.length - 1 ? 0 : prev + 1));
      } else if (e.key === 'Escape') {
        setIsFreePhotoModalOpen(false);
      } else if (e.key === 'Enter') {
        // Prevent default form submit or other defaults
        e.preventDefault();
        handleSelectFreePhoto(freePhotosPool[freePhotoIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFreePhotoModalOpen, freePhotosPool, freePhotoIndex]);


  useEffect(() => {
    if (!profile?.company_id) return;
    
    if (!brandingLoaded.current) {
      brandingLoaded.current = true;
      brandingService.getMyCompany()
        .then(async (data) => {
          if (data) {
            if (data.name) setCompanyName(data.name);
            if (data.phone) setPhone(data.phone || '+503 7971-8911');
            if (data.website) setWebsite(data.website || 'www.ariasdefense.com');
            if (data.logo_url && !isLogoCustomized) {
              const base64 = await urlToBase64(data.logo_url);
              setLogoPreview(base64);
            }
          }
        })
        .catch((err) => console.error('Error loading branding:', err));
    }

    supabase.from('ai_generation_credits')
      .select('credits_used,credits_limit').eq('company_id', profile.company_id)
      .order('period_start', { ascending: false }).limit(1).single()
      .then(({ data }) => setCredits(data ? data.credits_limit - data.credits_used : 20));
  }, [profile, isLogoCustomized]);

  // Pre-populate manual inputs from basic parsing as the user types, before they generate
  useEffect(() => {
    if (keepCustomText) return; // Don't overwrite manually customized text
    if (variants.length > 0) return; // Don't overwrite generated/manually modified text
    if (!prompt.trim() || prompt === 'Flyer promocional para nuestra oferta especial de temporada.') return; // Don't overwrite default placeholder values
    const parsed = parsePrompt(prompt);
    const { h1, h2 } = deriveHeadline(prompt, companyName || 'Mi Empresa');
    setManualTitle(parsed.title || h1 || '');
    setManualSubtitle(parsed.subtitle || h2 || '');
    setManualFeatures(parsed.features && parsed.features.length > 0 ? parsed.features : deriveFeatures(prompt).slice(0, 4));
    setManualPrice(parsed.price || derivePrice(prompt) || '');
    
    // Set CTA: parsed first, then derived, then fallback
    const derivedCta = parsed.cta || deriveCta(prompt) || 'CONTACTAR AHORA';
    setCta(derivedCta);
  }, [prompt, companyName, keepCustomText]);
  // Reset dropdown open states when switching edit elements or closing modals
  useEffect(() => {
    setIsFontDropdownOpen(false);
    setIsIndustryDropdownOpen(false);
    setIndustrySearchQuery('');
  }, [editingElement]);

  // Load dynamic industries configured in settings
  useEffect(() => {
    async function loadIndustries() {
      try {
        const list = await industriesService.getIndustries();
        setIndustries(list || []);
      } catch (err) {
        console.error('Failed to load industries in FlyerStudio:', err);
      }
    }
    loadIndustries();
  }, []);

  // Auto-optimize debounced effect removed to prevent overriding user typing. A manual button is now used instead.

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
        if (!keepCustomText) {
          setManualTitle(data.structured_text.headline || '');
          setManualSubtitle(data.structured_text.subheadline || '');
          setManualFeatures(data.structured_text.features && data.structured_text.features.length > 0 ? data.structured_text.features : ['', '', '', '']);
          setManualPrice(data.structured_text.price || '');
          setCta(data.structured_text.cta || 'CONTACTAR AHORA');
        }
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
      const fallbackImgs = getThematicImages(prompt, selectedIndustry);
      let shuffled = [...fallbackImgs].sort(() => Math.random() - 0.5);
      if (currentImg && fallbackImgs.length > 1) {
        let attempts = 0;
        while (shuffled[0] === currentImg && attempts < 15) {
          shuffled = [...fallbackImgs].sort(() => Math.random() - 0.5);
          attempts++;
        }
      }
      const selectedVariants = shuffled.slice(0, 4);
      lastGeneratedImg.current = selectedVariants[0];
      setVariants(selectedVariants);
      
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
      if (!keepCustomText) {
        setManualTitle(fallbackText.headline || '');
        setManualSubtitle(fallbackText.subheadline || '');
        setManualFeatures(fallbackText.features && fallbackText.features.length > 0 ? fallbackText.features : ['', '', '', '']);
        setManualPrice(fallbackText.price || '');
        setCta(fallbackText.cta || 'CONTACTAR AHORA');
      }

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
    
    setGenerating(true);
    const searchToastId = toast.loading('Buscando imágenes sugeridas por la IA...');
    
    try {
      const { data, error } = await supabase.functions.invoke('flyer-recommend', {
        body: {
          action: 'search-photos',
          prompt: prompt,
          industry: selectedIndustry
        }
      });
      
      if (error || !data?.photos || data.photos.length < 4) {
        throw new Error(error?.message || 'No se obtuvieron suficientes fotos');
      }
      
      // Shuffle so each click shows a different order
      const shuffled = [...data.photos].sort(() => Math.random() - 0.5);
      toast.success('¡Imágenes encontradas!', { id: searchToastId });
      setFreePhotosPool(shuffled);

      setFreePhotoIndex(0);
      setIsFreePhotoModalOpen(true);
    } catch (err: any) {
      console.warn('AI photo search failed, using local theme fallback:', err);
      toast.dismiss(searchToastId);
      
      const pool = getThematicImages(prompt, selectedIndustry);
      if (pool.length === 0) {
        toast.error('No se encontraron imágenes para esta descripción.');
        return;
      }
      setFreePhotosPool(pool);
      setFreePhotoIndex(0);
      setIsFreePhotoModalOpen(true);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSelectFreePhoto(selectedPhoto: string) {
    setGenerating(true);
    setVariants([]);
    setBgFile(null);
    setBgUploadPreview('');
    setAiOptimizedText(null);
    setIsFullAiFlyer(false);
    setShowFullAiResult(false);

    try {
      // Create variants array: variant[0] is the selectedPhoto.
      // The other 3 variants are random unique photos from the pool, excluding selectedPhoto.
      const poolWithoutSelected = freePhotosPool.filter(img => img !== selectedPhoto);
      let shuffled = [...poolWithoutSelected].sort(() => Math.random() - 0.5);
      const selectedVariants = [selectedPhoto, ...shuffled.slice(0, 3)];
      
      lastGeneratedImg.current = selectedPhoto;
      setVariants(selectedVariants);

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
      if (!keepCustomText) {
        setManualTitle(fallbackText.headline || '');
        setManualSubtitle(fallbackText.subheadline || '');
        setManualFeatures(fallbackText.features && fallbackText.features.length > 0 ? fallbackText.features : ['', '', '', '']);
        setManualPrice(fallbackText.price || '');
        setCta(fallbackText.cta || 'CONTACTAR AHORA');
      }

      setSelected(0);
      setPreviewMode('ai');
      setShowFullAiResult(false);
      setIsFreePhotoModalOpen(false);
      toast.success('✨ Flyer generado usando la foto seleccionada');
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

  async function fetchSavedFlyers() {
    if (!profile?.company_id) return;
    setLoadingSavedFlyers(true);
    try {
      const { data, error } = await supabase
        .from('marketing_flyers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedFlyers(data || []);
    } catch (e: any) {
      console.error('Error fetching saved flyers:', e);
      toast.error('Error al cargar diseños: ' + e.message);
    } finally {
      setLoadingSavedFlyers(false);
    }
  }

  // Load saved designs once profile is loaded
  useEffect(() => {
    if (profile?.company_id) {
      fetchSavedFlyers();
    }
  }, [profile]);

  async function handleRenameFlyer(id: string, newName: string) {
    if (!newName.trim()) return;
    try {
      const { error } = await supabase
        .from('marketing_flyers')
        .update({ name: newName.trim() })
        .eq('id', id);

      if (error) throw error;
      toast.success('Nombre de diseño actualizado');
      setSavedFlyers(prev => prev.map(f => f.id === id ? { ...f, name: newName.trim() } : f));
      if (loadedFlyerId === id) {
        setLoadedFlyerName(newName.trim());
      }
      setEditingFlyerId(null);
    } catch (e: any) {
      console.error('Error renaming flyer:', e);
      toast.error('Error al renombrar diseño: ' + e.message);
    }
  }

  function handleResetEditor() {
    if (!window.confirm('¿Quieres limpiar el editor para empezar un diseño nuevo?')) return;
    
    // Reset loaded design info
    setLoadedFlyerId(null);
    setLoadedFlyerName(null);
    
    // Reset all texts
    setManualTitle('');
    setManualSubtitle('');
    setManualFeatures(['', '', '', '']);
    setManualPrice('');
    setCta('');
    
    // Reset styling
    setColors(BRAND_COLORS);
    setBgUploadPreview('');
    setLogoPreview(DEFAULT_LOGO_SVG);
    setLogoX(50);
    setLogoY(10);
    setLogoSize(120);
    setTextY(30);
    setTextAlign('center');
    
    // Reset scales
    setTitleScale(1);
    setSubtitleScale(1);
    setBenefitsScale(1);
    setCtaScale(1);
    
    // Reset fonts
    setTitleFont('Outfit');
    setSubtitleFont('Inter');
    setBenefitsFont('Inter');
    setCtaFont('Outfit');
    setContactFont('Inter');
    
    // Reset colors
    setTitleColor('#1e293b');
    setHighlightColor('#7c3aed');
    setSubtitleColor('#475569');
    setBenefitsColor('#334155');
    setCtaBgColor('#7c3aed');
    setCtaTextColor('#ffffff');
    setContactColor('#475569');
    setCardBgColor('#ffffff');
    
    // Reset templates and options
    setFormat('ig-post');
    setSelectedTemplate('bold-split');
    setVariants([]);
    setSelected(0);
    setPreviewMode('template');
    
    toast.success('✨ Editor restablecido a nuevo diseño');
  }

  async function handleSaveFlyer(nameToSave: string, overwrite = false) {
    if (!profile?.company_id) return;
    const name = nameToSave.trim() || `Flyer ${new Date().toLocaleDateString()}`;
    setSavingFlyer(true);
    try {
      // 1. Generate thumbnail
      let thumbnailUrl = '';
      try {
        const ref = selectedTemplate === 'A' ? templateRefA : selectedTemplate === 'B' ? templateRefB : templateRefMarketing;
        const targetRef = showFullAiResult ? flyerRef : ref;
        if (targetRef.current) {
          const canvas = await html2canvas(targetRef.current, {
            useCORS: true,
            allowTaint: true,
            scale: 0.6, // Lightweight thumbnail
            backgroundColor: null
          });
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7));
          if (blob) {
            thumbnailUrl = await storageService.uploadFlyerThumbnail(profile.company_id, blob);
          }
        }
      } catch (err) {
        console.warn('Failed to generate preview thumbnail, proceeding without it:', err);
      }

      // 2. Prepare settings payload
      const settings = {
        manualTitle,
        manualSubtitle,
        manualFeatures,
        manualPrice,
        cta,
        colors,
        bgUploadPreview, // custom uploaded background URL
        logoPreview, // logo URL
        logoX,
        logoY,
        logoSize,
        textY,
        textAlign,
        titleScale,
        subtitleScale,
        benefitsScale,
        ctaScale,
        titleFont,
        subtitleFont,
        benefitsFont,
        ctaFont,
        contactFont,
        titleColor,
        highlightColor,
        subtitleColor,
        benefitsColor,
        ctaBgColor,
        ctaTextColor,
        contactColor,
        cardBgColor,
        phone,
        website,
        syncFonts,
        keepCustomText,
        isLogoCustomized
      };

      const currentImg = bgUploadPreview || (variants.length > 0 ? variants[selected] : lastGeneratedImg.current);

      if (overwrite && loadedFlyerId) {
        // Update existing flyer
        const { error } = await supabase
          .from('marketing_flyers')
          .update({
            name,
            format,
            template_id: selectedTemplate,
            bg_image_url: currentImg || null,
            settings,
            thumbnail_url: thumbnailUrl || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', loadedFlyerId);

        if (error) throw error;
        toast.success('✨ ¡Diseño actualizado con éxito!');
        setLoadedFlyerName(name);
      } else {
        // Insert new flyer
        const { data, error } = await supabase
          .from('marketing_flyers')
          .insert({
            company_id: profile.company_id,
            created_by: profile.id,
            name,
            format,
            template_id: selectedTemplate,
            bg_image_url: currentImg || null,
            settings,
            thumbnail_url: thumbnailUrl || null
          })
          .select()
          .single();

        if (error) throw error;
        toast.success('✨ ¡Diseño guardado con éxito!');
        if (data) {
          setLoadedFlyerId(data.id);
          setLoadedFlyerName(data.name);
        }
      }

      setIsSaveModalOpen(false);
      setNewDesignName('');
      fetchSavedFlyers();
    } catch (e: any) {
      console.error('Error saving flyer:', e);
      toast.error('Error al guardar el diseño: ' + e.message);
    } finally {
      setSavingFlyer(false);
    }
  }

  function handleLoadFlyer(flyer: any) {
    try {
      const s = flyer.settings;
      if (!s) throw new Error('No settings found');

      // Set formats and template
      setFormat(flyer.format || 'ig-post');
      setSelectedTemplate(flyer.template_id || 'bold-split');
      
      // Restore states
      if (s.manualTitle !== undefined) setManualTitle(s.manualTitle);
      if (s.manualSubtitle !== undefined) setManualSubtitle(s.manualSubtitle);
      if (s.manualFeatures !== undefined) setManualFeatures(s.manualFeatures);
      if (s.manualPrice !== undefined) setManualPrice(s.manualPrice);
      if (s.cta !== undefined) setCta(s.cta);
      if (s.colors !== undefined) setColors(s.colors);
      
      if (s.bgUploadPreview !== undefined) setBgUploadPreview(s.bgUploadPreview);
      if (s.logoPreview !== undefined) setLogoPreview(s.logoPreview);
      if (s.logoX !== undefined) setLogoX(s.logoX);
      if (s.logoY !== undefined) setLogoY(s.logoY);
      if (s.logoSize !== undefined) setLogoSize(s.logoSize);
      if (s.textY !== undefined) setTextY(s.textY);
      if (s.textAlign !== undefined) setTextAlign(s.textAlign);
      
      if (s.titleScale !== undefined) setTitleScale(s.titleScale);
      if (s.subtitleScale !== undefined) setSubtitleScale(s.subtitleScale);
      if (s.benefitsScale !== undefined) setBenefitsScale(s.benefitsScale);
      if (s.ctaScale !== undefined) setCtaScale(s.ctaScale);
      
      if (s.titleFont !== undefined) setTitleFont(s.titleFont);
      if (s.subtitleFont !== undefined) setSubtitleFont(s.subtitleFont);
      if (s.benefitsFont !== undefined) setBenefitsFont(s.benefitsFont);
      if (s.ctaFont !== undefined) setCtaFont(s.ctaFont);
      if (s.contactFont !== undefined) setContactFont(s.contactFont);
      
      if (s.titleColor !== undefined) setTitleColor(s.titleColor);
      if (s.highlightColor !== undefined) setHighlightColor(s.highlightColor);
      if (s.subtitleColor !== undefined) setSubtitleColor(s.subtitleColor);
      if (s.benefitsColor !== undefined) setBenefitsColor(s.benefitsColor);
      if (s.ctaBgColor !== undefined) setCtaBgColor(s.ctaBgColor);
      if (s.ctaTextColor !== undefined) setCtaTextColor(s.ctaTextColor);
      if (s.contactColor !== undefined) setContactColor(s.contactColor);
      if (s.cardBgColor !== undefined) setCardBgColor(s.cardBgColor);
      
      if (s.phone !== undefined) setPhone(s.phone);
      if (s.website !== undefined) setWebsite(s.website);
      if (s.syncFonts !== undefined) setSyncFonts(s.syncFonts);
      if (s.keepCustomText !== undefined) setKeepCustomText(s.keepCustomText);
      if (s.isLogoCustomized !== undefined) setIsLogoCustomized(s.isLogoCustomized);

      // Handle background image in variants
      if (flyer.bg_image_url) {
        lastGeneratedImg.current = flyer.bg_image_url;
        setVariants([flyer.bg_image_url]);
        setSelected(0);
        setPreviewMode('ai');
      } else {
        setVariants([]);
        setPreviewMode('template');
      }

      // Track loaded flyer
      setLoadedFlyerId(flyer.id);
      setLoadedFlyerName(flyer.name);
      setNewDesignName(flyer.name);

      setIsGalleryModalOpen(false);
      toast.success(`📂 Diseño "${flyer.name}" cargado correctamente.`);
    } catch (err: any) {
      console.error('Error loading flyer settings:', err);
      toast.error('Error al cargar el diseño: ' + err.message);
    }
  }

  async function handleDeleteFlyer(id: string) {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este diseño?')) return;
    try {
      const { error } = await supabase
        .from('marketing_flyers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Diseño eliminado con éxito.');
      setSavedFlyers(prev => prev.filter(f => f.id !== id));
    } catch (e: any) {
      console.error('Error deleting flyer:', e);
      toast.error('Error al eliminar diseño: ' + e.message);
    }
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

      <header style={{
        ...css.header,
        filter: editingElement !== null ? 'blur(5px)' : 'none',
        opacity: editingElement !== null ? 0.4 : 1,
        pointerEvents: editingElement !== null ? 'none' : 'auto',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
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
              <div style={{ fontSize: 15, fontWeight: 800, color: '#081c3b', display: 'flex', alignItems: 'center', gap: 6 }}>
                AI Flyer Studio
                {loadedFlyerName && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: '#7c3aed', background: '#f5f3ff',
                    border: '1px solid #ddd6fe', borderRadius: 6, padding: '2px 8px',
                    display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 6
                  }}>
                    • {loadedFlyerName}
                    <button 
                      onClick={handleResetEditor} 
                      title="Cerrar y empezar nuevo" 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 1, color: '#7c3aed' }}
                    >
                      <X size={10} />
                    </button>
                  </span>
                )}
              </div>
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

          <div style={{ height: 16, width: 1, background: '#cbd5e1', margin: '0 4px' }} />

          <button
            onClick={() => {
              fetchSavedFlyers();
              setIsGalleryModalOpen(true);
            }}
            style={{
              background: '#fff',
              border: '1px solid #d8dde6',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 11,
              fontWeight: 700,
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'all 0.15s ease'
            }}
          >
            <FolderOpen size={12} color="#64748b" />
            Mis Diseños
          </button>

          <button
            onClick={() => {
              if (loadedFlyerName && !newDesignName) {
                setNewDesignName(loadedFlyerName);
              }
              setIsSaveModalOpen(true);
            }}
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              border: 'none',
              borderRadius: 8,
              padding: '7px 14px',
              fontSize: 11,
              fontWeight: 800,
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 6px rgba(124, 58, 237, 0.15)',
              transition: 'all 0.15s ease'
            }}
          >
            <Save size={12} color="#fff" />
            Guardar Diseño
          </button>
        </div>
      </header>

      {/* ── 3 COLUMNS ──────────────────────────────────────────────────────── */}
      <div style={css.cols}>

        {/* ══ COL 1 — CREATIVE BRIEF (320px) ════════════════════════════════ */}
        <div style={{
          ...css.col('320px'),
          filter: editingElement !== null ? 'blur(5px)' : 'none',
          opacity: editingElement !== null ? 0.4 : 1,
          pointerEvents: editingElement !== null ? 'none' : 'auto',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
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
            {/* Rubro / Industria Selector */}
            <div style={css.section}>
              <label style={css.label}>Rubro / Industria del Negocio</label>
              <div style={{ position: 'relative', width: '100%' }}>
                <button
                  type="button"
                  id="btn-select-industry"
                  onClick={() => setIsIndustryDropdownOpen(!isIndustryDropdownOpen)}
                  style={{
                    width: '100%',
                    border: isIndustryDropdownOpen ? '1.5px solid #7c3aed' : '1.5px solid #cbd5e1',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontSize: '13px',
                    color: '#0f172a',
                    outline: 'none',
                    background: '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontWeight: 700,
                    boxShadow: isIndustryDropdownOpen ? '0 0 0 3px rgba(124, 58, 237, 0.1)' : 'none',
                    transition: 'all 0.15s ease',
                    boxSizing: 'border-box'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {selectedIndustry === 'auto' ? (
                      <>✨ <span style={{ color: '#6366f1' }}>Detectar con IA (Automático)</span></>
                    ) : (
                      selectedIndustry
                    )}
                  </span>
                  <ChevronDown size={15} style={{ color: '#64748b', transform: isIndustryDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>

                {isIndustryDropdownOpen && (
                  <>
                    {/* Invisible backdrop to catch outside clicks */}
                    <div 
                      style={{ position: 'fixed', inset: 0, zIndex: 9999, cursor: 'default' }} 
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsIndustryDropdownOpen(false);
                        setIndustrySearchQuery('');
                      }} 
                    />
                    {/* Custom Options List */}
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: 6,
                      background: '#ffffff',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '10px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                      zIndex: 10000,
                      maxHeight: 380,
                      overflowY: 'auto',
                      padding: 4,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      boxSizing: 'border-box'
                    }}>
                      {/* Search Bar */}
                      <div style={{
                        position: 'sticky',
                        top: 0,
                        background: '#ffffff',
                        padding: '4px 4px 8px 4px',
                        borderBottom: '1px solid #f1f5f9',
                        marginBottom: 4,
                        zIndex: 10001
                      }}>
                        <input
                          type="text"
                          placeholder="🔍 Buscar rubro/industria..."
                          value={industrySearchQuery}
                          onChange={e => setIndustrySearchQuery(e.target.value)}
                          onClick={e => e.stopPropagation()} // Prevent close
                          style={{
                            width: '100%',
                            border: '1.5px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            fontSize: '12px',
                            outline: 'none',
                            boxSizing: 'border-box',
                            fontFamily: 'inherit',
                            transition: 'border-color 0.15s'
                          }}
                          onFocus={e => e.target.style.borderColor = '#7c3aed'}
                          onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                        />
                      </div>

                      {/* If search query is empty, show 'Detectar Automáticamente con IA' */}
                      {!industrySearchQuery.trim() && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedIndustry('auto');
                              setIsIndustryDropdownOpen(false);
                              setIndustrySearchQuery('');
                              if (variants.length > 0) {
                                setVariants([]);
                                setSelected(0);
                                setPreviewMode('template');
                              }
                            }}
                            style={{
                              width: '100%',
                              padding: '5px 10px',
                              fontSize: '12px',
                              fontWeight: selectedIndustry === 'auto' ? 800 : 600,
                              textAlign: 'left',
                              border: 'none',
                              borderRadius: '8px',
                              background: selectedIndustry === 'auto' ? '#f5f3ff' : 'transparent',
                              color: selectedIndustry === 'auto' ? '#6366f1' : '#334155',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              transition: 'all 0.15s ease',
                              boxSizing: 'border-box'
                            }}
                            onMouseEnter={e => {
                              if (selectedIndustry !== 'auto') {
                                e.currentTarget.style.background = '#f8fafc';
                              }
                            }}
                            onMouseLeave={e => {
                              if (selectedIndustry !== 'auto') {
                                e.currentTarget.style.background = 'transparent';
                              }
                            }}
                          >
                            ✨ Detectar Automáticamente con IA
                          </button>

                          <div style={{ height: '1px', background: '#f1f5f9', margin: '4px 8px' }} />
                        </>
                      )}

                      {filteredIndustries.length === 0 ? (
                        <div style={{ padding: '8px 12px', fontSize: '11px', color: '#64748b', textAlign: 'center' }}>
                          No se encontraron rubros
                        </div>
                      ) : (
                        filteredIndustries.map(ind => {
                          const isSelected = selectedIndustry === ind.name;
                          return (
                            <button
                              key={ind.id}
                              type="button"
                              onClick={() => {
                                setSelectedIndustry(ind.name);
                                setIsIndustryDropdownOpen(false);
                                setIndustrySearchQuery('');
                                if (variants.length > 0) {
                                  setVariants([]);
                                  setSelected(0);
                                  setPreviewMode('template');
                                }
                              }}
                              style={{
                                width: '100%',
                                padding: '5px 10px',
                                fontSize: '12px',
                                fontWeight: isSelected ? 800 : 600,
                                textAlign: 'left',
                                border: 'none',
                                borderRadius: '8px',
                                background: isSelected ? '#eff6ff' : 'transparent',
                                color: isSelected ? '#1d4ed8' : '#334155',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                boxSizing: 'border-box'
                              }}
                              onMouseEnter={e => {
                                if (!isSelected) {
                                  e.currentTarget.style.background = '#f8fafc';
                                }
                              }}
                              onMouseLeave={e => {
                                if (!isSelected) {
                                  e.currentTarget.style.background = 'transparent';
                                }
                              }}
                            >
                              {ind.name}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Prompt */}
            <div style={css.section}>
              <label style={css.label}>¿Qué quieres promocionar? *</label>
              <textarea
                id="textarea-prompt"
                style={{
                  ...css.textarea,
                  minHeight: 120,
                  fontSize: 13,
                  lineHeight: 1.6,
                  border: optimizing ? '1.5px solid #7c3aed' : '1px solid #d8dde6',
                  borderRadius: 10,
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)',
                  transition: 'border 0.3s, box-shadow 0.3s'
                }}
                placeholder={'Ej: 30% de descuento en Facturación Electrónica para Pymes este mes — escribe tu idea y haz clic en "Optimizar con IA"...'}
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
              
              {/* Manual AI Optimization Button */}
              {prompt.trim().length > 3 && (
                <button
                  onClick={optimizeWithMetaAI}
                  disabled={optimizing}
                  style={{
                    marginTop: 8,
                    background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                    border: 'none',
                    borderRadius: 10,
                    padding: '10px 16px',
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#fff',
                    cursor: optimizing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    boxShadow: '0 4px 12px rgba(124, 58, 237, 0.15)',
                    transition: 'all 0.2s ease',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                  onMouseEnter={e => {
                    if (!optimizing) {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(124, 58, 237, 0.25)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!optimizing) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.15)';
                    }
                  }}
                >
                  {optimizing ? (
                    <>
                      <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Analizando con Meta AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} color="#fff" />
                      <span>Optimizar con IA</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* ── VIRALITY SCORE — AIDA Copywriting Audit ── */}
            {(() => {
              const vs = calcViralScore(prompt, cta, phone, website);
              if (vs.score === 0) return null;
              const color = vs.level === 'viral' ? '#10b981' : vs.level === 'bueno' ? '#3b82f6' : vs.level === 'mejorable' ? '#f59e0b' : '#ef4444';
              const label = vs.level === 'viral' ? '🔥 Alto impacto' : vs.level === 'bueno' ? '👍 Buen potencial' : vs.level === 'mejorable' ? '⚠️ Mejorable' : '📉 Bajo impacto';
              return (
                <div style={{
                  marginBottom: 20,
                  background: 'linear-gradient(180deg, #ffffff, #f8fafc)',
                  border: `1.5px solid #e2e8f0`,
                  borderRadius: 14,
                  padding: '14px 16px',
                  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.03)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 9, fontWeight: 900, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Auditoría AIDA</span>
                      <span style={{ fontSize: 13, fontWeight: 900, color: '#0f172a', marginTop: 1 }}>Score de Viralidad</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{ fontSize: 14, fontWeight: 900, color }}>{vs.score}/100</span>
                      <span style={{ fontSize: 9, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 1 }}>{label}</span>
                    </div>
                  </div>
                  
                  {/* Progress bar */}
                  <div style={{ height: 6, background: '#f1f5f9', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
                    <div style={{ height: '100%', width: `${vs.score}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)`, borderRadius: 10, transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                  </div>

                  {/* Clean Text Button to Open Modal */}
                  <button
                    type="button"
                    onClick={() => setIsAidaModalOpen(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: '#6366f1',
                      fontSize: 10,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      cursor: 'pointer',
                      marginBottom: 14,
                      transition: 'color 0.15s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#4f46e5'}
                    onMouseLeave={e => e.currentTarget.style.color = '#6366f1'}
                  >
                    <Info size={12} />
                    <span>Ver metodología de cálculo AIDA</span>
                  </button>
                  
                  {vs.tips.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sugerencias de mejora:</div>
                      {vs.tips.map((tip, i) => {
                        // Determine Lucide Icon and color badge depending on the tip content
                        let IconComp = Info;
                        let iconColor = '#6366f1';
                        let iconBg = '#eff6ff';
                        
                        if (tip.includes('💰') || tip.includes('precio') || tip.includes('descuento')) {
                          IconComp = Award;
                          iconColor = '#16a34a';
                          iconBg = '#f0fdf4';
                        } else if (tip.includes('⚡') || tip.includes('urgencia')) {
                          IconComp = Zap;
                          iconColor = '#d97706';
                          iconBg = '#fef3c7';
                        } else if (tip.includes('✅') || tip.includes('beneficio')) {
                          IconComp = Check;
                          iconColor = '#7c3aed';
                          iconBg = '#f5f3ff';
                        } else if (tip.includes('🎯') || tip.includes('CTA')) {
                          IconComp = Target;
                          iconColor = '#059669';
                          iconBg = '#ecfdf5';
                        } else if (tip.includes('📝') || tip.includes('Describe')) {
                          IconComp = Type;
                          iconColor = '#0284c7';
                          iconBg = '#f0f9ff';
                        }

                        // Remove emoji from the rendering string
                        const cleanTip = tip.replace(/^[^\w\s]+/, '').trim();
                        const parts = cleanTip.split(':');
                        const snippet = parts.length > 1 ? parts.slice(1).join(':').trim() : cleanTip;

                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              const addition = snippet.replace(/\(ej:.*/i, '').trim();
                              setPrompt(prev => prev ? `${prev.trim()}. ${addition}` : addition);
                              if (variants.length > 0) { setVariants([]); setSelected(0); setPreviewMode('template'); }
                            }}
                            style={{
                              position: 'relative',
                              fontSize: 10, color: '#334155', fontWeight: 600, lineHeight: 1.45,
                              background: '#fff', border: '1px solid #e2e8f0',
                              borderRadius: 10, padding: '10px 16px 10px 24px', cursor: 'pointer',
                              textAlign: 'left', display: 'flex', alignItems: 'center', width: '100%',
                              boxSizing: 'border-box', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.02)',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = '#6366f1';
                              e.currentTarget.style.background = '#fafafa';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = '#e2e8f0';
                              e.currentTarget.style.background = '#fff';
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 1px 2px rgba(15, 23, 42, 0.02)';
                            }}
                          >
                            <div style={{
                              position: 'absolute',
                              left: -12,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: iconBg,
                              border: `1px solid ${iconColor}22`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 2px 5px rgba(0,0,0,0.06)',
                              flexShrink: 0,
                              zIndex: 2
                            }}>
                              <Plus size={12} color={iconColor} />
                            </div>
                            <span style={{ flex: 1 }}>{cleanTip}</span>
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
              <div style={{ position: 'relative' }}>
                <input
                  style={{
                    ...css.input,
                    borderRadius: 10,
                    padding: '10px 12px 10px 32px',
                    borderColor: '#cbd5e1',
                    fontSize: 12,
                    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.02)',
                    transition: 'all 0.15s ease'
                  }}
                  placeholder="Ej: Reserva hoy · Llama ahora · Obtén 30% off"
                  value={cta}
                  onChange={e => setCta(e.target.value)}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = '#6366f1';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(15, 23, 42, 0.02)';
                  }}
                />
                <Target size={12} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

            {/* Contact Details */}
            <div style={css.section}>
              <label style={css.label}>Datos de Contacto</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{
                      ...css.input,
                      borderRadius: 10,
                      padding: '10px 12px 10px 32px',
                      borderColor: '#cbd5e1',
                      fontSize: 12,
                      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.02)',
                      transition: 'all 0.15s ease'
                    }}
                    placeholder="Teléfono (Ej: 7971-8911)"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = '#6366f1';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = '#cbd5e1';
                      e.currentTarget.style.boxShadow = '0 1px 2px rgba(15, 23, 42, 0.02)';
                    }}
                  />
                  <Smartphone size={12} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{
                      ...css.input,
                      borderRadius: 10,
                      padding: '10px 12px 10px 32px',
                      borderColor: '#cbd5e1',
                      fontSize: 12,
                      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.02)',
                      transition: 'all 0.15s ease'
                    }}
                    placeholder="Sitio Web (Ej: www.ariasdefense.com)"
                    value={website}
                    onChange={e => setWebsite(e.target.value)}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = '#6366f1';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = '#cbd5e1';
                      e.currentTarget.style.boxShadow = '0 1px 2px rgba(15, 23, 42, 0.02)';
                    }}
                  />
                  <Globe size={12} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                </div>
              </div>
            </div>

            {/* Logo */}
            <div style={css.section}>
              <label style={css.label}>Logo / Imagen de Referencia</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => logoRef.current?.click()}
                  type="button"
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1.5px dashed #cbd5e1',
                    background: '#f8fafc',
                    color: '#475569',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#6366f1';
                    e.currentTarget.style.background = '#eff6ff';
                    e.currentTarget.style.color = '#4f46e5';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.color = '#475569';
                  }}
                >
                  <Upload size={13} />
                  <span>{logoFile ? 'Cambiar logo' : 'Subir logo'}</span>
                </button>
                {logoPreview && (
                  <div style={{ position: 'relative', display: 'inline-flex' }}>
                    <img src={logoPreview} alt="logo" style={{ height: 38, width: 38, objectFit: 'contain', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff' }} />
                    <button onClick={() => { setLogoFile(null); setLogoPreview(''); setIsLogoCustomized(true); if (logoRef.current) logoRef.current.value = ''; }} style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', border: 'none', borderRadius: '50%', width: 15, height: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                      <X size={10} color="#fff" />
                    </button>
                  </div>
                )}
              </div>
              {logoPreview && (
                <button
                  type="button"
                  onClick={() => setEditingElement('logo')}
                  style={{
                    ...css.btn,
                    marginTop: 8,
                    fontSize: 11,
                    padding: '8px 12px',
                    background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                    fontWeight: 700
                  }}
                >
                  ⚙️ Ajustar posición y tamaño de Logo
                </button>
              )}
              <input ref={logoRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (!f) return; setLogoFile(f); setIsLogoCustomized(true); const r = new FileReader(); r.onload = ev => setLogoPreview(ev.target?.result as string); r.readAsDataURL(f); }} style={{ display: 'none' }} />
            </div>

            {/* Custom Flyer Upload */}
            <div style={css.section}>
              <label style={css.label}>Cargar Flyer ya Diseñado (Canva / ChatGPT)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => bgUploadRef.current?.click()}
                  type="button"
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: bgUploadPreview ? '1.5px dashed #10b981' : '1.5px dashed #cbd5e1',
                    background: bgUploadPreview ? '#f0fdf4' : '#f8fafc',
                    color: bgUploadPreview ? '#15803d' : '#475569',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    if (!bgUploadPreview) {
                      e.currentTarget.style.borderColor = '#6366f1';
                      e.currentTarget.style.background = '#eff6ff';
                      e.currentTarget.style.color = '#4f46e5';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!bgUploadPreview) {
                      e.currentTarget.style.borderColor = '#cbd5e1';
                      e.currentTarget.style.background = '#f8fafc';
                      e.currentTarget.style.color = '#475569';
                    }
                  }}
                >
                  <Upload size={13} />
                  <span>{bgFile ? 'Cambiar flyer' : 'Subir flyer (ChatGPT / Canva)'}</span>
                </button>
                {bgUploadPreview && (
                  <div style={{ position: 'relative', display: 'inline-flex' }}>
                    <img src={bgUploadPreview} alt="flyer custom bg" style={{ height: 38, width: 38, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <button onClick={() => { setBgFile(null); setBgUploadPreview(''); }} style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', border: 'none', borderRadius: '50%', width: 15, height: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                      <X size={10} color="#fff" />
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
              <div style={{
                display: 'flex',
                background: '#f1f5f9',
                borderRadius: 10,
                padding: 3,
                gap: 4,
                boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.05)'
              }}>
                {([1, 2, 3] as const).map(n => {
                  const active = variantCount === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setVariantCount(n)}
                      style={{
                        flex: 1,
                        height: 32,
                        border: 'none',
                        borderRadius: 8,
                        background: active ? '#fff' : 'transparent',
                        color: active ? '#6366f1' : '#475569',
                        fontWeight: 800,
                        fontSize: 13,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: active ? '0 1px 3px rgba(15, 23, 42, 0.1), 0 1px 2px rgba(15, 23, 42, 0.06)' : 'none'
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Costo: <strong style={{ color: '#0f172a' }}>{variantCount} crédito{variantCount > 1 ? 's' : ''}</strong></span>
                {credits !== null && <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, color: '#475569' }}>Quedan {credits}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* ══ COL 2 — STYLE SETTINGS (340px) ════════════════════════════════ */}
        <div style={{
          ...css.col('340px'),
          filter: editingElement !== null ? 'blur(5px)' : 'none',
          opacity: editingElement !== null ? 0.4 : 1,
          pointerEvents: editingElement !== null ? 'none' : 'auto',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
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
            <div style={{
              margin: '8px 0 12px 0',
              padding: '10px 12px',
              background: keepCustomText ? '#f5f3ff' : '#f8fafc',
              border: keepCustomText ? '1.5px solid #c084fc' : '1px solid #e2e8f0',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              transition: 'all 0.2s ease'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: keepCustomText ? '#6b21a8' : '#334155' }}>
                  Conservar mis textos
                </span>
                <span style={{ fontSize: 9, color: keepCustomText ? '#7e22ce' : '#64748b' }}>
                  No sobrescribir títulos ni detalles al generar fondo
                </span>
              </div>
              <input 
                type="checkbox" 
                checked={keepCustomText} 
                onChange={e => setKeepCustomText(e.target.checked)}
                style={{
                  width: 16,
                  height: 16,
                  cursor: 'pointer',
                  accentColor: '#7c3aed'
                }}
              />
            </div>

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
                @media (max-width: 768px) {
                  .hidden-mobile { display: none !important; }
                }
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
          <div style={{ ...css.colHead, padding: '10px 16px', background: '#fff', borderBottom: '1px solid #dde1e7', flexWrap: 'wrap', gap: '8px 12px', height: 'auto', alignItems: 'center' }}>
            {showSuggestions && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 auto', width: '100%' }}>
                <div style={{ width: 26, height: 26, borderRadius: 6, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Sparkles size={13} color="#7c3aed" />
                </div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
                  Recomendaciones Meta AI
                </div>
                <button onClick={() => setShowSuggestions(false)} style={{ ...css.ghost, padding: '5px 10px', fontSize: 11, marginLeft: 'auto' }}>
                  Cerrar
                </button>
              </div>
            )}
            {!showSuggestions && !generating && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: '1 1 auto', justifyContent: 'flex-start' }}>
                {/* Vista Previa Completa */}
                <button
                  onClick={() => setIsPreviewModalOpen(true)}
                  title="Vista Previa Completa"
                  style={{
                    ...css.ghost,
                    padding: '6px 10px',
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    color: '#475569',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; }}
                >
                  <Eye size={13} color="#475569" />
                  <span className="hidden-mobile">Vista Previa</span>
                </button>

                {/* Descargar PNG */}
                <button
                  onClick={handleDownload}
                  title="Descargar PNG"
                  style={{
                    ...css.ghost,
                    padding: '6px 10px',
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    color: '#166534',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    fontWeight: 700
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#dcfce7'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#f0fdf4'; }}
                >
                  <Download size={13} color="#166534" />
                  <span className="hidden-mobile">Descargar</span>
                </button>

                {/* Enviar a Social Hub */}
                <button
                  id="btn-header-send"
                  onClick={sendToSocialHub}
                  title="Enviar a Redes Sociales"
                  style={{
                    ...css.ghost,
                    padding: '6px 10px',
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    color: '#fff',
                    background: 'linear-gradient(135deg, #0070d2, #005fb2)',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    fontWeight: 700
                  }}
                  onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}
                >
                  <Send size={13} color="#fff" />
                  <span className="hidden-mobile">Publicar</span>
                </button>

                {/* Nuevo (Clear variants if generated) */}
                {variants.length > 0 && (
                  <button
                    onClick={() => setVariants([])}
                    title="Nuevo diseño"
                    style={{
                      ...css.ghost,
                      padding: '6px 10px',
                      fontSize: 11,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      color: '#64748b',
                      background: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                  >
                    <RefreshCw size={11} />
                    <span className="hidden-mobile">Nuevo</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flyer-studio-col" style={{
            position: 'relative',
            flex: 1,
            overflowY: 'auto',
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            alignItems: showSuggestions ? 'stretch' : 'center',
            justifyContent: 'flex-start'
          }}>

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
                position: 'absolute',
                inset: 0,
                background: 'rgba(7,15,43,0.88)',
                backdropFilter: 'blur(12px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50,
                borderRadius: 14,
                gap: 16,
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

            {/* ══ PREVIEW CONTENT WRAPPER ══ */}
            {!showSuggestions && !generating && (
              <div className="flyer-preview-content-wrapper" style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
                width: '100%',
                margin: 'auto 0',
                boxSizing: 'border-box'
              }}>
                {/* ══ CONTROL BAR (Variants & Layout) ══ */}
                {variants.length > 0 && (
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
                {showFullAiResult && (variants.length > 0 || bgUploadPreview) ? (
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

                    {/* Credits status */}
                    {credits !== null && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 }}>
                        <Zap size={11} color={credColor} fill={credColor} />
                        <span style={{ fontSize: 11, color: '#64748b' }}>
                          <strong style={{ color: credColor }}>{credits}</strong> créditos restantes este mes
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Template preview — shown when user selects Template A or B without full AI result */
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
                          transform: `scale(${flyerWidth / 1080})`,
                          transformOrigin: 'top left',
                          width: 1080, height: canvasH, pointerEvents: 'auto'
                        }}>
                          {selectedTemplate === 'A' ? (
                            <div style={{ position: 'relative', width: 1080, height: canvasH }}>
                              <FlyerTemplateA data={{
                                company_name: companyName || 'Mi Empresa',
                                containerW: 1080,
                                containerH: canvasH,
                                prompt, cta: cta || 'CONTACTAR AHORA',
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
                                phone, website, logoUrl: undefined,
                                bgImageUrl: bgUploadPreview || (variants.length > 0 ? variants[selected] : undefined) || DEFAULT_BG_IMAGE,
                                flyerFont,
                                titleFont,
                                subtitleFont,
                                benefitsFont,
                                ctaFont,
                                contactFont,
                                textScale,
                                subtitleScale,
                                benefitsScale,
                                logoSize,
                                logoX,
                                logoY,
                                titleColor,
                                highlightColor,
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
                                benefitsBold, titleScale, titleY, subtitleY, benefitsY, ctaScale, ctaY, contactScale, contactY, onContactClick: () => setEditingElement('contact'),
                                titleX, subtitleX, benefitsX, ctaX, contactX, contactColor
                              }} />
                              {logoPreview && (
                                <FreeLogo
                                  d={{ title: '', subtitle: '', cta: '', beneficios: [], accent: '', bgImageUrl: null, logoUrl: logoPreview, industria: companyName || 'Mi Empresa', phone, website, templateId: 'A', containerW: 1080, containerH: canvasH, logoSize, logoX, logoY, onLogoClick: () => setEditingElement('logo') }}
                                  onMove={(x, y) => { setLogoX(x); setLogoY(y); }}
                                  onResize={(s) => setLogoSize(s)}
                                />
                              )}
                            </div>
                          ) : selectedTemplate === 'B' ? (
                            <div style={{ position: 'relative', width: 1080, height: canvasH }}>
                              <FlyerTemplateB data={{
                                company_name: companyName || 'Mi Empresa',
                                containerW: 1080,
                                containerH: canvasH,
                                prompt, cta: cta || 'CONTACTAR AHORA',
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
                                phone, website, logoUrl: undefined,
                                bgImageUrl: bgUploadPreview || (variants.length > 0 ? variants[selected] : undefined) || DEFAULT_BG_IMAGE,
                                flyerFont,
                                titleFont,
                                subtitleFont,
                                benefitsFont,
                                ctaFont,
                                contactFont,
                                textScale,
                                subtitleScale,
                                benefitsScale,
                                logoSize,
                                logoX,
                                logoY,
                                titleColor,
                                highlightColor,
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
                                benefitsBold, titleScale, titleY, subtitleY, benefitsY, ctaScale, ctaY, contactScale, contactY, onContactClick: () => setEditingElement('contact'),
                                titleX, subtitleX, benefitsX, ctaX, contactX, contactColor
                              }} />
                              {logoPreview && (
                                <FreeLogo
                                  d={{ title: '', subtitle: '', cta: '', beneficios: [], accent: '', bgImageUrl: null, logoUrl: logoPreview, industria: companyName || 'Mi Empresa', phone, website, templateId: 'B', containerW: 1080, containerH: canvasH, logoSize, logoX, logoY, onLogoClick: () => setEditingElement('logo') }}
                                  onMove={(x, y) => { setLogoX(x); setLogoY(y); }}
                                  onResize={(s) => setLogoSize(s)}
                                />
                              )}
                            </div>
                          ) : (
                            <RenderFlyer d={{
                              title: manualTitle || 'TU OFERTA',
                              subtitle: manualSubtitle || 'Soluciones profesionales a la medida de tu negocio.',
                              cta: cta || 'CONTACTAR AHORA',
                              beneficios: manualFeatures.filter(f => f.trim() !== '').length > 0 ? manualFeatures.filter(f => f.trim() !== '') : ['✓ Garantía por Escrito', '✓ Soporte Técnico 24/7', '✓ Profesionales Expertos', '✓ Cobertura Inmediata'],
                              accent: colors[0] || '#0070d2',
                              bgImageUrl: bgUploadPreview || (variants.length > 0 ? variants[selected] : null) || DEFAULT_BG_IMAGE,
                              logoUrl: logoPreview || null,
                              industria: companyName || 'Mi Empresa',
                              phone, website, templateId: selectedTemplate,
                              containerW: 1080, containerH: canvasH,
                              logoSize, logoX, logoY,
                              flyerFont,
                              titleFont,
                              subtitleFont,
                              benefitsFont,
                              ctaFont,
                              contactFont,
                              textScale,
                              subtitleScale,
                              benefitsScale,
                              titleColor,
                              highlightColor,
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
                              benefitsBold, titleScale, titleY, subtitleY, benefitsY, ctaScale, ctaY, contactScale, contactY, onContactClick: () => setEditingElement('contact'),
                              titleX, subtitleX, benefitsX, ctaX, contactX, contactColor }}
                            onLogoMove={(x, y) => { setLogoX(x); setLogoY(y); }}
                            onLogoResize={(s) => setLogoSize(s)}
                            />
                          )}
                        </div>
                        {/* Interactive Drag & Resize Overlay Box */}
                        {overlayRect && (
                          <div
                            style={{
                              position: 'absolute',
                              top: overlayRect.top,
                              left: overlayRect.left,
                              width: overlayRect.width,
                              height: overlayRect.height,
                              border: '2px dashed #7c3aed',
                              boxSizing: 'border-box',
                              zIndex: 30,
                              pointerEvents: 'auto',
                              cursor: 'move',
                              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.15)',
                              borderRadius: 4
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const startX = e.clientX;
                              const startY = e.clientY;
                              const initialX = 
                                editingElement === 'title' ? titleX :
                                editingElement === 'subtitle' ? subtitleX :
                                editingElement === 'benefits' ? benefitsX :
                                editingElement === 'cta' ? ctaX :
                                editingElement === 'contact' ? contactX : 0;
                              const initialY = 
                                editingElement === 'title' ? titleY :
                                editingElement === 'subtitle' ? subtitleY :
                                editingElement === 'benefits' ? benefitsY :
                                editingElement === 'cta' ? ctaY :
                                editingElement === 'contact' ? contactY : 0;
                                
                              const scale = getFlyerDimensions(format).width / 1080;

                              const handleMouseMove = (moveEvent: MouseEvent) => {
                                const dx = moveEvent.clientX - startX;
                                const dy = moveEvent.clientY - startY;
                                const canvasDx = dx / scale;
                                const canvasDy = dy / scale;
                                const newX = initialX + canvasDx;
                                const newY = initialY + canvasDy;
                                
                                if (editingElement === 'title') { setTitleX(newX); setTitleY(newY); }
                                else if (editingElement === 'subtitle') { setSubtitleX(newX); setSubtitleY(newY); }
                                else if (editingElement === 'benefits') { setBenefitsX(newX); setBenefitsY(newY); }
                                else if (editingElement === 'cta') { setCtaX(newX); setCtaY(newY); }
                                else if (editingElement === 'contact') { setContactX(newX); setContactY(newY); }
                              };

                              const handleMouseUp = () => {
                                window.removeEventListener('mousemove', handleMouseMove);
                                window.removeEventListener('mouseup', handleMouseUp);
                              };

                              window.addEventListener('mousemove', handleMouseMove);
                              window.addEventListener('mouseup', handleMouseUp);
                            }}
                          >
                            {/* Label */}
                            <div style={{
                              position: 'absolute',
                              top: -24,
                              left: 0,
                              background: '#7c3aed',
                              color: '#fff',
                              fontSize: 10,
                              fontWeight: 900,
                              padding: '4px 8px',
                              borderRadius: '4px 4px 0 0',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              whiteSpace: 'nowrap',
                              userSelect: 'none',
                              pointerEvents: 'none'
                            }}>
                              {editingElement === 'title' && 'Título'}
                              {editingElement === 'subtitle' && 'Subtítulo'}
                              {editingElement === 'benefits' && 'Beneficios'}
                              {editingElement === 'cta' && 'Botón CTA'}
                              {editingElement === 'contact' && 'Contacto'}
                            </div>

                            {/* Resize Handle */}
                            <div
                              style={{
                                position: 'absolute',
                                bottom: -6,
                                right: -6,
                                width: 14,
                                height: 14,
                                background: '#fff',
                                border: '3px solid #7c3aed',
                                borderRadius: '50%',
                                cursor: 'se-resize',
                                zIndex: 31,
                                boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const startX = e.clientX;
                                const initialScale = 
                                  editingElement === 'title' ? titleScale :
                                  editingElement === 'subtitle' ? subtitleScale :
                                  editingElement === 'benefits' ? benefitsScale :
                                  editingElement === 'cta' ? ctaScale :
                                  editingElement === 'contact' ? contactScale : 1.0;

                                const handleMouseMove = (moveEvent: MouseEvent) => {
                                  const dx = moveEvent.clientX - startX;
                                  const newScale = Math.max(0.4, Math.min(3.0, initialScale + dx / 150));
                                  
                                  if (editingElement === 'title') setTitleScale(newScale);
                                  else if (editingElement === 'subtitle') setSubtitleScale(newScale);
                                  else if (editingElement === 'benefits') setBenefitsScale(newScale);
                                  else if (editingElement === 'cta') setCtaScale(newScale);
                                  else if (editingElement === 'contact') setContactScale(newScale);
                                };

                                const handleMouseUp = () => {
                                  window.removeEventListener('mousemove', handleMouseMove);
                                  window.removeEventListener('mouseup', handleMouseUp);
                                };

                                window.addEventListener('mousemove', handleMouseMove);
                                window.addEventListener('mouseup', handleMouseUp);
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Hidden template render area — captured by html-to-image */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none', zIndex: -1 }}>
        <div ref={templateRefA} style={{ position: 'relative', width: 1080, height: canvasH }}>
          <FlyerTemplateA data={{
            company_name: companyName || 'Mi Empresa',
            prompt,
            cta: cta || 'CONTACTAR AHORA',
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
            logoUrl: undefined,
            bgImageUrl: bgUploadPreview || (variants.length > 0 ? variants[selected] : undefined) || DEFAULT_BG_IMAGE,
            flyerFont,
            titleFont,
            subtitleFont,
            benefitsFont,
            ctaFont,
            contactFont,
            textScale,
            subtitleScale,
            benefitsScale,
            logoSize,
            logoX,
            logoY,
            containerW: 1080,
            containerH: canvasH,
            titleColor,
            highlightColor,
            subtitleColor,
            benefitsColor,
            cardBgColor,
            ctaBgColor,
            ctaTextColor,
            textY,
            textAlign,
            subtitleBold,
            benefitsBold,
            titleScale,
            titleY,
            subtitleY,
            benefitsY,
            ctaScale,
            ctaY,
            contactScale,
            contactY,
            onContactClick: () => setEditingElement('contact'),
            titleX,
            subtitleX,
            benefitsX,
            ctaX,
            contactX,
            contactColor
          }} />
          {logoPreview && (
            <FreeLogo d={{ title: '', subtitle: '', cta: '', beneficios: [], accent: '', bgImageUrl: null, logoUrl: logoPreview, industria: companyName || 'Mi Empresa', phone, website, templateId: 'A', containerW: 1080, containerH: canvasH, logoSize, logoX, logoY }} />
          )}
        </div>

        <div ref={templateRefB} style={{ position: 'relative', width: 1080, height: canvasH }}>
          <FlyerTemplateB data={{
            company_name: companyName || 'Mi Empresa',
            prompt,
            cta: cta || 'CONTACTAR AHORA',
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
            logoUrl: undefined,
            bgImageUrl: bgUploadPreview || (variants.length > 0 ? variants[selected] : undefined) || DEFAULT_BG_IMAGE,
            flyerFont,
            titleFont,
            subtitleFont,
            benefitsFont,
            ctaFont,
            contactFont,
            textScale,
            subtitleScale,
            benefitsScale,
            logoSize,
            logoX,
            logoY,
            containerW: 1080,
            containerH: canvasH,
            titleColor,
            highlightColor,
            subtitleColor,
            benefitsColor,
            cardBgColor,
            ctaBgColor,
            ctaTextColor,
            textY,
            textAlign,
            subtitleBold,
            benefitsBold,
            titleScale,
            titleY,
            subtitleY,
            benefitsY,
            ctaScale,
            ctaY,
            contactScale,
            contactY,
            onContactClick: () => setEditingElement('contact'),
            titleX,
            subtitleX,
            benefitsX,
            ctaX,
            contactX,
            contactColor
          }} />
          {logoPreview && (
            <FreeLogo d={{ title: '', subtitle: '', cta: '', beneficios: [], accent: '', bgImageUrl: null, logoUrl: logoPreview, industria: companyName || 'Mi Empresa', phone, website, templateId: 'B', containerW: 1080, containerH: canvasH, logoSize, logoX, logoY }} />
          )}
        </div>

        <div ref={templateRefMarketing}>
          <RenderFlyer d={{
            title: manualTitle || 'TU OFERTA',
            subtitle: manualSubtitle || 'Soluciones profesionales a la medida de tu negocio.',
            cta: cta || 'CONTACTAR AHORA',
            beneficios: manualFeatures.filter(f => f.trim() !== '').length > 0 ? manualFeatures.filter(f => f.trim() !== '') : ['✓ Garantía por Escrito', '✓ Soporte Técnico 24/7', '✓ Profesionales Expertos', '✓ Cobertura Inmediata'],
            accent: colors[0] || '#0070d2',
            bgImageUrl: bgUploadPreview || (variants.length > 0 ? variants[selected] : null) || DEFAULT_BG_IMAGE,
            logoUrl: logoPreview || null,
            industria: companyName || 'Mi Empresa',
            phone, website, templateId: selectedTemplate,
            containerW: 1080, containerH: canvasH,
            logoSize, logoX, logoY,
            flyerFont,
            titleFont,
            subtitleFont,
            benefitsFont,
            ctaFont,
            contactFont,
            textScale,
            subtitleScale,
            benefitsScale,
            titleColor,
            highlightColor,
            subtitleColor,
            benefitsColor,
            cardBgColor,
            ctaBgColor,
            ctaTextColor,
            textY,
            textAlign,
            subtitleBold,
            benefitsBold,
            titleScale,
            titleY,
            subtitleY,
            benefitsY,
            ctaScale,
            ctaY,
            contactScale,
            contactY,
            onContactClick: () => setEditingElement('contact'),
            titleX,
            subtitleX,
            benefitsX,
            ctaX,
            contactX,
            contactColor
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
                      d={{ title: '', subtitle: '', cta: '', beneficios: [], accent: '', bgImageUrl: null, logoUrl: logoPreview, industria: '', phone: '', website: '', templateId: 'direct-mockup', containerW: 600, containerH: Math.round(600 * (getFlyerDimensions(format).height / getFlyerDimensions(format).width)), logoSize, logoX, logoY }}
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
                  <div style={{ transform: `scale(${sc})`, transformOrigin: 'top left', width: 1080, height: canvasH, pointerEvents: 'none' }}>
                    {selectedTemplate === 'A' ? (
                      <div style={{ position: 'relative', width: 1080, height: canvasH }}>
                        <FlyerTemplateA data={{
                          company_name: companyName || 'Mi Empresa', prompt,
                          cta: cta || 'CONTACTAR AHORA',
                          headline: manualTitle || 'OFERTA INCREÍBLE', subheadline: manualSubtitle || 'Soluciones profesionales a la medida de tu negocio.',
                          features: manualFeatures.some(f => f.trim() !== '') ? manualFeatures : ['✓ Garantía por Escrito', '✓ Soporte Técnico 24/7', '✓ Profesionales Expertos', '✓ Cobertura Inmediata'], price: manualPrice || '¡Precios de Locura!',
                          highlight_title: aiOptimizedText?.highlight_title,
                          highlight_desc: aiOptimizedText?.highlight_desc,
                          benefits: aiOptimizedText?.benefits,
                          mockup_info: aiOptimizedText?.mockup_info,
                          primaryColor: colors[0] || '#e91e8c', secondaryColor: colors[1] || '#1a1a2e',
                          phone, website, logoUrl: undefined,
                          bgImageUrl: bgUploadPreview || (variants.length > 0 ? variants[selected] : undefined) || DEFAULT_BG_IMAGE,
                          flyerFont,
                          titleFont,
                          subtitleFont,
                          benefitsFont,
                          ctaFont,
                          contactFont,
                          textScale,
                          subtitleScale,
                          benefitsScale,
                          logoSize,
                          logoX,
                          logoY,
                          containerW: 1080,
                          containerH: canvasH,
                          titleColor,
                          highlightColor,
                          subtitleColor,
                          benefitsColor,
                          cardBgColor,
                          ctaBgColor,
                          ctaTextColor,
                          textY,
                          textAlign,
                          subtitleBold,
                          benefitsBold,
                          titleScale, titleY, subtitleY, benefitsY, ctaScale, ctaY, contactScale, contactY, onContactClick: () => setEditingElement('contact'),
                          titleX, subtitleX, benefitsX, ctaX, contactX, contactColor }} />
                        {logoPreview && (
                          <FreeLogo d={{ title: '', subtitle: '', cta: '', beneficios: [], accent: '', bgImageUrl: null, logoUrl: logoPreview, industria: companyName || 'Mi Empresa', phone, website, templateId: 'A', containerW: 1080, containerH: canvasH, logoSize, logoX, logoY }} />
                        )}
                      </div>
                    ) : selectedTemplate === 'B' ? (
                      <div style={{ position: 'relative', width: 1080, height: canvasH }}>
                        <FlyerTemplateB data={{
                          company_name: companyName || 'Mi Empresa', prompt,
                          cta: cta || 'CONTACTAR AHORA',
                          headline: manualTitle || 'OFERTA INCREÍBLE', subheadline: manualSubtitle || 'Soluciones profesionales a la medida de tu negocio.',
                          features: manualFeatures.some(f => f.trim() !== '') ? manualFeatures : ['✓ Garantía por Escrito', '✓ Soporte Técnico 24/7', '✓ Profesionales Expertos', '✓ Cobertura Inmediata'], price: manualPrice || '¡Precios de Locura!',
                          highlight_title: aiOptimizedText?.highlight_title,
                          highlight_desc: aiOptimizedText?.highlight_desc,
                          benefits: aiOptimizedText?.benefits,
                          mockup_info: aiOptimizedText?.mockup_info,
                          primaryColor: colors[0] || '#9b1c1c', secondaryColor: colors[1] || '#1a1a2e',
                          phone, website, logoUrl: undefined,
                          bgImageUrl: bgUploadPreview || (variants.length > 0 ? variants[selected] : undefined) || DEFAULT_BG_IMAGE,
                          flyerFont,
                          titleFont,
                          subtitleFont,
                          benefitsFont,
                          ctaFont,
                          contactFont,
                          textScale,
                          subtitleScale,
                          benefitsScale,
                          logoSize,
                          logoX,
                          logoY,
                          containerW: 1080,
                          containerH: canvasH,
                          titleColor,
                          highlightColor,
                          subtitleColor,
                          benefitsColor,
                          cardBgColor,
                          ctaBgColor,
                          ctaTextColor,
                          textY,
                          textAlign,
                          subtitleBold,
                          benefitsBold,
                          titleScale, titleY, subtitleY, benefitsY, ctaScale, ctaY, contactScale, contactY, onContactClick: () => setEditingElement('contact'),
                          titleX, subtitleX, benefitsX, ctaX, contactX, contactColor }} />
                        {logoPreview && (
                          <FreeLogo d={{ title: '', subtitle: '', cta: '', beneficios: [], accent: '', bgImageUrl: null, logoUrl: logoPreview, industria: companyName || 'Mi Empresa', phone, website, templateId: 'B', containerW: 1080, containerH: canvasH, logoSize, logoX, logoY }} />
                        )}
                      </div>
                    ) : (
                      <RenderFlyer d={{
                        title: manualTitle || 'TU OFERTA',
                        subtitle: manualSubtitle || 'Soluciones profesionales a la medida de tu negocio.',
                        cta: cta || 'CONTACTAR AHORA',
                        beneficios: manualFeatures.filter(f => f.trim() !== '').length > 0 ? manualFeatures.filter(f => f.trim() !== '') : ['✓ Garantía por Escrito', '✓ Soporte Técnico 24/7', '✓ Profesionales Expertos', '✓ Cobertura Inmediata'],
                        accent: colors[0] || '#0070d2',
                        bgImageUrl: bgUploadPreview || (variants.length > 0 ? variants[selected] : null) || DEFAULT_BG_IMAGE,
                        logoUrl: logoPreview || null,
                        industria: companyName || 'Mi Empresa',
                        phone, website, templateId: selectedTemplate,
                        containerW: 1080, containerH: canvasH,
                        logoSize, logoX, logoY,
                        flyerFont,
                        titleFont,
                        subtitleFont,
                        benefitsFont,
                        ctaFont,
                        contactFont,
                        textScale,
                        subtitleScale,
                        benefitsScale,
                        titleColor,
                        highlightColor,
                        subtitleColor,
                        benefitsColor,
                        cardBgColor,
                        ctaBgColor,
                        ctaTextColor,
                        textY,
                        textAlign,
                        subtitleBold,
                        benefitsBold,
                        titleScale, titleY, subtitleY, benefitsY, ctaScale, ctaY, contactScale, contactY, onContactClick: () => setEditingElement('contact'),
                        titleX, subtitleX, benefitsX, ctaX, contactX, contactColor }}
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
        <div 
          style={{
            position: 'fixed',
            bottom: 40,
            left: 310,
            zIndex: 1999, // Render on top of normal UI, but does not block canvas pointer-events
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            borderRadius: 24,
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
            width: 380,
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
                      onChange={e => {
                        setManualTitle(e.target.value);
                        setKeepCustomText(true);
                      }}
                      placeholder="Título principal del flyer"
                    />
                    <span style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic', marginTop: -2 }}>
                      💡 Tip: Coloca asteriscos **alrededor del texto** que deseas destacar (ej. **cuentas por cobrar**).
                    </span>
                  </div>

                  {renderFontSelector(titleFont, 'title')}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569', fontWeight: 800, textTransform: 'uppercase' }}>
                      <span>Escala de Título</span>
                      <span>{titleScale.toFixed(2)}x</span>
                    </div>
                    <input type="range" min="0.5" max="2.0" step="0.05" value={titleScale} onChange={e => setTitleScale(parseFloat(e.target.value))} style={{ width: '100%' }} />
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
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Color de Texto Resaltado</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input 
                        type="color" 
                        value={highlightColor} 
                        onChange={e => setHighlightColor(e.target.value)} 
                        style={{ width: 36, height: 36, padding: 0, border: '1px solid #d8dde6', cursor: 'pointer', borderRadius: 6, flexShrink: 0 }} 
                      />
                      <input 
                        type="text" 
                        value={highlightColor} 
                        onChange={e => setHighlightColor(e.target.value)} 
                        placeholder="#FFD700"
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
                      onChange={e => {
                        setManualSubtitle(e.target.value);
                        setKeepCustomText(true);
                      }}
                      placeholder="Subtítulo o gancho descriptivo"
                    />
                  </div>

                  {renderFontSelector(subtitleFont, 'subtitle')}

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
                          setKeepCustomText(true);
                        }}
                        placeholder={`Beneficio ${idx + 1}`}
                      />
                    ))}
                  </div>

                  {renderFontSelector(benefitsFont, 'benefits')}

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
                      onChange={e => {
                        setCta(e.target.value);
                        setKeepCustomText(true);
                      }}
                      placeholder="Ej: REGÍSTRATE HOY"
                    />
                  </div>

                  {renderFontSelector(ctaFont, 'cta')}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Precio (Si aplica)</span>
                    <input 
                      style={css.input} 
                      value={manualPrice} 
                      onChange={e => {
                        setManualPrice(e.target.value);
                        setKeepCustomText(true);
                      }}
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

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569', fontWeight: 800, textTransform: 'uppercase' }}>
                      <span>Escala del Botón</span>
                      <span>{ctaScale.toFixed(2)}x</span>
                    </div>
                    <input type="range" min="0.5" max="3.0" step="0.05" value={ctaScale} onChange={e => setCtaScale(parseFloat(e.target.value))} style={{ width: '100%' }} />
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
                    <input type="range" min="0" max="100" step="1" value={logoX} onChange={e => setLogoX(parseInt(e.target.value))} style={{ width: '100%' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569', fontWeight: 800, textTransform: 'uppercase' }}>
                      <span>Posición Vertical (Y)</span>
                      <span>{logoY.toFixed(0)}%</span>
                    </div>
                    <input type="range" min="0" max="100" step="1" value={logoY} onChange={e => setLogoY(parseInt(e.target.value))} style={{ width: '100%' }} />
                  </div>
                </>
              )}

              {editingElement === 'contact' && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Teléfono</span>
                    <input 
                      style={css.input} 
                      type="text" 
                      value={phone} 
                      onChange={e => setPhone(e.target.value)}
                      placeholder="Teléfono de contacto"
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Sitio Web / Email</span>
                    <input 
                      style={css.input} 
                      type="text" 
                      value={website} 
                      onChange={e => setWebsite(e.target.value)}
                      placeholder="www.tuempresa.com"
                    />
                  </div>

                  {renderFontSelector(contactFont, 'contact')}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569', fontWeight: 800, textTransform: 'uppercase' }}>
                      <span>Escala de Contacto</span>
                      <span>{contactScale.toFixed(2)}x</span>
                    </div>
                    <input type="range" min="0.5" max="3.0" step="0.05" value={contactScale} onChange={e => setContactScale(parseFloat(e.target.value))} style={{ width: '100%' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Color del Texto de Contacto</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input 
                        type="color" 
                        value={contactColor || '#ffffff'} 
                        onChange={e => setContactColor(e.target.value)} 
                        style={{ width: 36, height: 36, padding: 0, border: '1px solid #d8dde6', cursor: 'pointer', borderRadius: 6, flexShrink: 0 }} 
                      />
                      <input 
                        type="text" 
                        value={contactColor} 
                        onChange={e => setContactColor(e.target.value)} 
                        placeholder="Por defecto"
                        style={css.input} 
                      />
                    </div>
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
      {isTemplateModalOpen && (() => {
        const ratio = canvasH / 1080;
        const fitW = ratio > 1.3 ? 120 : 155;
        const fitH = Math.round(fitW * ratio);
        const sc = fitW / 1080;
        
        return (
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
              width: '95%',
              maxWidth: 880,
              maxHeight: '90vh',
              display: 'flex', flexDirection: 'column',
              animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              overflow: 'hidden'
            }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(0, 0, 0, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Catálogo de Plantillas</span>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Selecciona el diseño base para tu flyer (se actualiza con tus datos en tiempo real)</div>
                </div>
                <button onClick={() => setIsTemplateModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                  <X size={18} color="#64748b" />
                </button>
              </div>
              
              <div className="flyer-studio-col" style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Plantillas Corporativas Pro</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                    {/* Template A */}
                    {(() => {
                      const active = selectedTemplate === 'A';
                      return (
                        <button
                          onClick={() => { setSelectedTemplate('A'); setPreviewMode('template'); setShowFullAiResult(false); setIsTemplateModalOpen(false); }}
                          style={{
                            textAlign: 'left',
                            padding: 0,
                            borderRadius: 16,
                            border: `2px solid ${active ? '#7c3aed' : '#f1f5f9'}`,
                            background: '#fff',
                            cursor: 'pointer',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            width: '100%',
                            boxSizing: 'border-box',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: active ? '0 10px 25px -5px rgba(124, 58, 237, 0.15)' : '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.01)',
                            transform: 'none',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 12px 20px -5px rgba(0,0,0,0.08)';
                            if (!active) e.currentTarget.style.borderColor = '#ddd6fe';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.boxShadow = active ? '0 10px 25px -5px rgba(124, 58, 237, 0.15)' : '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.01)';
                            if (!active) e.currentTarget.style.borderColor = '#f1f5f9';
                          }}
                        >
                          <div style={{ width: '100%', height: 200, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #f1f5f9', overflow: 'hidden', position: 'relative' }}>
                            <div style={{ width: fitW, height: fitH, position: 'relative', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', borderRadius: 8, background: '#fff', flexShrink: 0 }}>
                              <div style={{ transform: `scale(${sc})`, transformOrigin: 'top left', width: 1080, height: canvasH, pointerEvents: 'none' }}>
                                <div style={{ position: 'relative', width: 1080, height: canvasH }}>
                                  <FlyerTemplateA data={{
                                    company_name: companyName || 'Mi Empresa',
                                    containerW: 1080,
                                    containerH: canvasH,
                                    prompt, cta: cta || 'CONTACTAR AHORA',
                                    headline: manualTitle || 'OFERTA INCREÍBLE',
                                    subheadline: manualSubtitle || 'Soluciones profesionales a la medida de tu negocio.',
                                    features: manualFeatures.some(f => f.trim() !== '') ? manualFeatures : ['✓ Garantía por Escrito', '✓ Soporte Técnico 24/7', '✓ Profesionales Expertos', '✓ Cobertura Inmediata'],
                                    price: manualPrice || '¡Precios de Locura!',
                                    highlight_title: aiOptimizedText?.highlight_title,
                                    highlight_desc: aiOptimizedText?.highlight_desc,
                                    benefits: aiOptimizedText?.benefits,
                                    mockup_info: aiOptimizedText?.mockup_info,
                                    primaryColor: colors[0] || '#e91e8c',
                                    secondaryColor: colors[1] || '#1a1a2e',
                                    phone, website, logoUrl: undefined,
                                    bgImageUrl: bgUploadPreview || (variants.length > 0 ? variants[selected] : undefined) || DEFAULT_BG_IMAGE,
                                    flyerFont, titleFont, subtitleFont, benefitsFont, ctaFont, contactFont,
                                    textScale, subtitleScale, benefitsScale, logoSize, logoX, logoY,
                                    titleColor, highlightColor, subtitleColor, benefitsColor, cardBgColor, ctaBgColor, ctaTextColor, textY, textAlign,
                                    subtitleBold, benefitsBold, titleScale, titleY, subtitleY, benefitsY, ctaScale, ctaY, contactScale, contactY,
                                    titleX, subtitleX, benefitsX, ctaX, contactX, contactColor
                                  }} />
                                  {logoPreview && (
                                    <FreeLogo d={{ title: '', subtitle: '', cta: '', beneficios: [], accent: '', bgImageUrl: null, logoUrl: logoPreview, industria: companyName || 'Mi Empresa', phone, website, templateId: 'A', containerW: 1080, containerH: canvasH, logoSize, logoX, logoY }} />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 850, color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>✨ Template A — Glow Glassmorphic</span>
                                {active && <span style={{ background: '#7c3aed', color: '#fff', fontSize: 8, padding: '2px 6px', borderRadius: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Activa</span>}
                              </div>
                              <div style={{ fontSize: 9, color: '#64748b', marginTop: 4, lineHeight: 1.3 }}>Diseño moderno con efecto de vidrio esmerilado y luces de neón.</div>
                            </div>
                          </div>
                        </button>
                      );
                    })()}

                    {/* Template B */}
                    {(() => {
                      const active = selectedTemplate === 'B';
                      return (
                        <button
                          onClick={() => { setSelectedTemplate('B'); setPreviewMode('template'); setShowFullAiResult(false); setIsTemplateModalOpen(false); }}
                          style={{
                            textAlign: 'left',
                            padding: 0,
                            borderRadius: 16,
                            border: `2px solid ${active ? '#7c3aed' : '#f1f5f9'}`,
                            background: '#fff',
                            cursor: 'pointer',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            width: '100%',
                            boxSizing: 'border-box',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: active ? '0 10px 25px -5px rgba(124, 58, 237, 0.15)' : '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.01)',
                            transform: 'none',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 12px 20px -5px rgba(0,0,0,0.08)';
                            if (!active) e.currentTarget.style.borderColor = '#ddd6fe';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.boxShadow = active ? '0 10px 25px -5px rgba(124, 58, 237, 0.15)' : '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.01)';
                            if (!active) e.currentTarget.style.borderColor = '#f1f5f9';
                          }}
                        >
                          <div style={{ width: '100%', height: 200, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #f1f5f9', overflow: 'hidden', position: 'relative' }}>
                            <div style={{ width: fitW, height: fitH, position: 'relative', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', borderRadius: 8, background: '#fff', flexShrink: 0 }}>
                              <div style={{ transform: `scale(${sc})`, transformOrigin: 'top left', width: 1080, height: canvasH, pointerEvents: 'none' }}>
                                <div style={{ position: 'relative', width: 1080, height: canvasH }}>
                                  <FlyerTemplateB data={{
                                    company_name: companyName || 'Mi Empresa',
                                    containerW: 1080,
                                    containerH: canvasH,
                                    prompt, cta: cta || 'CONTACTAR AHORA',
                                    headline: manualTitle || 'OFERTA INCREÍBLE',
                                    subheadline: manualSubtitle || 'Soluciones profesionales a la medida de tu negocio.',
                                    features: manualFeatures.some(f => f.trim() !== '') ? manualFeatures : ['✓ Garantía por Escrito', '✓ Soporte Técnico 24/7', '✓ Profesionales Expertos', '✓ Cobertura Inmediata'],
                                    price: manualPrice || '¡Precios de Locura!',
                                    highlight_title: aiOptimizedText?.highlight_title,
                                    highlight_desc: aiOptimizedText?.highlight_desc,
                                    benefits: aiOptimizedText?.benefits,
                                    mockup_info: aiOptimizedText?.mockup_info,
                                    primaryColor: colors[0] || '#9b1c1c',
                                    secondaryColor: colors[1] || '#1a1a2e',
                                    phone, website, logoUrl: undefined,
                                    bgImageUrl: bgUploadPreview || (variants.length > 0 ? variants[selected] : undefined) || DEFAULT_BG_IMAGE,
                                    flyerFont, titleFont, subtitleFont, benefitsFont, ctaFont, contactFont,
                                    textScale, subtitleScale, benefitsScale, logoSize, logoX, logoY,
                                    titleColor, highlightColor, subtitleColor, benefitsColor, cardBgColor, ctaBgColor, ctaTextColor, textY, textAlign,
                                    subtitleBold, benefitsBold, titleScale, titleY, subtitleY, benefitsY, ctaScale, ctaY, contactScale, contactY,
                                    titleX, subtitleX, benefitsX, ctaX, contactX, contactColor
                                  }} />
                                  {logoPreview && (
                                    <FreeLogo d={{ title: '', subtitle: '', cta: '', beneficios: [], accent: '', bgImageUrl: null, logoUrl: logoPreview, industria: companyName || 'Mi Empresa', phone, website, templateId: 'B', containerW: 1080, containerH: canvasH, logoSize, logoX, logoY }} />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 850, color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>🏢 Template B — Editorial Showcase</span>
                                {active && <span style={{ background: '#7c3aed', color: '#fff', fontSize: 8, padding: '2px 6px', borderRadius: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Activa</span>}
                              </div>
                              <div style={{ fontSize: 9, color: '#64748b', marginTop: 4, lineHeight: 1.3 }}>Disposición editorial limpia tipo B2B ideal para mostrar marcas corporativas.</div>
                            </div>
                          </div>
                        </button>
                      );
                    })()}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Catálogo de Marketing (Autorescaling)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                    {TEMPLATE_LIST.map(t => {
                      const active = selectedTemplate === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => { setSelectedTemplate(t.id); setPreviewMode('template'); setShowFullAiResult(false); setIsTemplateModalOpen(false); }}
                          style={{
                            textAlign: 'left',
                            padding: 0,
                            borderRadius: 16,
                            border: `2px solid ${active ? '#7c3aed' : '#f1f5f9'}`,
                            background: '#fff',
                            cursor: 'pointer',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            width: '100%',
                            boxSizing: 'border-box',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: active ? '0 10px 25px -5px rgba(124, 58, 237, 0.15)' : '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.01)',
                            transform: 'none',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 12px 20px -5px rgba(0,0,0,0.08)';
                            if (!active) e.currentTarget.style.borderColor = '#ddd6fe';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.boxShadow = active ? '0 10px 25px -5px rgba(124, 58, 237, 0.15)' : '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.01)';
                            if (!active) e.currentTarget.style.borderColor = '#f1f5f9';
                          }}
                        >
                          <div style={{ width: '100%', height: 200, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #f1f5f9', overflow: 'hidden', position: 'relative' }}>
                            <div style={{ width: fitW, height: fitH, position: 'relative', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', borderRadius: 8, background: '#fff', flexShrink: 0 }}>
                              <div style={{ transform: `scale(${sc})`, transformOrigin: 'top left', width: 1080, height: canvasH, pointerEvents: 'none' }}>
                                <RenderFlyer d={{
                                  title: manualTitle || 'TU OFERTA',
                                  subtitle: manualSubtitle || 'Soluciones profesionales a la medida de tu negocio.',
                                  cta: cta || 'CONTACTAR AHORA',
                                  beneficios: manualFeatures.filter(f => f.trim() !== '').length > 0 ? manualFeatures.filter(f => f.trim() !== '') : ['✓ Garantía por Escrito', '✓ Soporte Técnico 24/7', '✓ Profesionales Expertos', '✓ Cobertura Inmediata'],
                                  accent: colors[0] || '#0070d2',
                                  bgImageUrl: bgUploadPreview || (variants.length > 0 ? variants[selected] : null) || DEFAULT_BG_IMAGE,
                                  logoUrl: logoPreview || null,
                                  industria: companyName || 'Mi Empresa',
                                  phone, website, templateId: t.id,
                                  containerW: 1080, containerH: canvasH,
                                  logoSize, logoX, logoY,
                                  flyerFont, titleFont, subtitleFont, benefitsFont, ctaFont, contactFont,
                                  textScale, subtitleScale, benefitsScale, titleColor, highlightColor, subtitleColor, benefitsColor, cardBgColor, ctaBgColor, ctaTextColor, textY, textAlign,
                                  subtitleBold, benefitsBold, titleScale, titleY, subtitleY, benefitsY, ctaScale, ctaY, contactScale, contactY,
                                  titleX, subtitleX, benefitsX, ctaX, contactX, contactColor
                                }} />
                              </div>
                            </div>
                          </div>
                          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 850, color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>{t.name}</span>
                                {active && <span style={{ background: '#7c3aed', color: '#fff', fontSize: 8, padding: '2px 6px', borderRadius: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Activa</span>}
                              </div>
                              <div style={{ fontSize: 9, color: '#64748b', marginTop: 4, lineHeight: 1.3 }}>{t.desc}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── FREE PHOTO SELECTOR MODAL ──────────────────────────────────────── */}
      {isFreePhotoModalOpen && freePhotosPool.length > 0 && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          animation: 'fadeIn 0.2s ease-out'
        }} onClick={() => setIsFreePhotoModalOpen(false)}>
          <div style={{
            background: '#ffffff', borderRadius: 24, border: '1px solid #e2e8f0',
            width: '100%', maxWidth: 540, overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(15, 23, 42, 0.15)',
            display: 'flex', flexDirection: 'column',
            animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '20px 24px 16px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 900, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Generador Gratis</span>
                <h3 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: '2px 0 0 0' }}>Elige una Imagen Temática</h3>
                <p style={{ fontSize: 10, color: '#64748b', margin: '4px 0 0 0' }}>Selecciona entre 15 fotos premium para usar en tu flyer</p>
              </div>
              <button 
                onClick={() => setIsFreePhotoModalOpen(false)}
                style={{ background: 'rgba(0,0,0,0.04)', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
              >
                <X size={14} color="#0f172a" />
              </button>
            </div>
            
            {/* Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
              {/* Main Image View */}
              <div style={{
                width: '100%', height: 320, background: '#0f172a', borderRadius: 16,
                position: 'relative', overflow: 'hidden', border: '1px solid #e2e8f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <img 
                  src={freePhotosPool[freePhotoIndex]} 
                  alt={`Preview ${freePhotoIndex + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                
                {/* Navigation Arrows */}
                <button
                  type="button"
                  onClick={() => setFreePhotoIndex(prev => (prev === 0 ? freePhotosPool.length - 1 : prev - 1))}
                  style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.9)',
                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)', transition: 'all 0.2s', zIndex: 10
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-50%) scale(1.08)'; e.currentTarget.style.background = '#ffffff'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(-50%) scale(1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.9)'; }}
                >
                  <ChevronLeft size={18} color="#0f172a" />
                </button>
                
                <button
                  type="button"
                  onClick={() => setFreePhotoIndex(prev => (prev === freePhotosPool.length - 1 ? 0 : prev + 1))}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.9)',
                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)', transition: 'all 0.2s', zIndex: 10
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-50%) scale(1.08)'; e.currentTarget.style.background = '#ffffff'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(-50%) scale(1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.9)'; }}
                >
                  <ChevronRight size={18} color="#0f172a" />
                </button>

                {/* Index Counter Badge */}
                <div style={{
                  position: 'absolute', bottom: 12, right: 12,
                  background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)',
                  color: '#ffffff', padding: '4px 10px', borderRadius: 20,
                  fontSize: 10, fontWeight: 700, zIndex: 10
                }}>
                  Foto {freePhotoIndex + 1} de {freePhotosPool.length}
                </div>
              </div>

              {/* Scrollable Thumbnails View */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Todas las opciones ({freePhotosPool.length})</span>
                <div className="flyer-studio-col" style={{ 
                  display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 0', 
                  width: '100%', scrollbarWidth: 'thin'
                }}>
                  {freePhotosPool.map((img, idx) => {
                    const active = idx === freePhotoIndex;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setFreePhotoIndex(idx)}
                        style={{
                          width: 54,
                          height: 54,
                          borderRadius: 10,
                          border: `2px solid ${active ? '#7c3aed' : '#e2e8f0'}`,
                          padding: 0,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          flexShrink: 0,
                          opacity: active ? 1 : 0.65,
                          transform: active ? 'scale(1.05)' : 'none',
                          boxShadow: active ? '0 4px 10px rgba(124,58,237,0.15)' : 'none'
                        }}
                      >
                        <img src={img} alt={`Thumb ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px 20px 24px', background: '#f8fafc', display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setIsFreePhotoModalOpen(false)}
                style={{ background: '#fff', border: '1px solid #d8dde6', borderRadius: 10, padding: '10px 16px', fontSize: 12, fontWeight: 800, color: '#475569', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleSelectFreePhoto(freePhotosPool[freePhotoIndex])}
                style={{
                  background: '#7c3aed', border: 'none', borderRadius: 10,
                  padding: '10px 18px', fontSize: 12, fontWeight: 800, color: '#fff',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(124,58,237,0.2)'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#6d28d9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#7c3aed'; e.currentTarget.style.transform = 'none'; }}
              >
                <Plus size={14} style={{ marginRight: 6 }} />
                Aplicar esta Foto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SAVE FLYER MODAL ────────────────────────────────────────────────── */}
      {isSaveModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div style={{
            background: '#ffffff', borderRadius: 24, border: '1px solid #e2e8f0',
            width: '100%', maxWidth: 420, overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(15, 23, 42, 0.15)',
            display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ padding: '24px 24px 16px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: 0 }}>Guardar Diseño</h3>
                <p style={{ fontSize: 10, color: '#64748b', margin: '4px 0 0 0' }}>Dale un nombre descriptivo a tu publicidad</p>
              </div>
              <button 
                onClick={() => setIsSaveModalOpen(false)}
                style={{ background: 'rgba(0,0,0,0.04)', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={14} color="#0f172a" />
              </button>
            </div>
            
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nombre del diseño</label>
                <input 
                  type="text" 
                  value={newDesignName}
                  onChange={e => setNewDesignName(e.target.value)}
                  placeholder={`Ej: Flyer Oferta Verano ${new Date().toLocaleDateString()}`}
                  style={{ ...css.input, height: 42 }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveFlyer(newDesignName, !!loadedFlyerId);
                  }}
                  autoFocus
                />
              </div>
            </div>

            <div style={{ padding: '16px 24px 24px 24px', background: '#f8fafc', display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
              <button
                onClick={() => setIsSaveModalOpen(false)}
                style={{ background: '#fff', border: '1px solid #d8dde6', borderRadius: 10, padding: '10px 16px', fontSize: 12, fontWeight: 800, color: '#475569', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              {loadedFlyerId ? (
                <>
                  <button
                    onClick={() => handleSaveFlyer(newDesignName, false)}
                    disabled={savingFlyer}
                    style={{
                      background: '#fff', border: '1px solid #ddd6fe', borderRadius: 10,
                      padding: '10px 16px', fontSize: 12, fontWeight: 800, color: '#7c3aed',
                      cursor: savingFlyer ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Guardar como Copia
                  </button>
                  <button
                    onClick={() => handleSaveFlyer(newDesignName, true)}
                    disabled={savingFlyer}
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      border: 'none', borderRadius: 10,
                      padding: '10px 16px', fontSize: 12, fontWeight: 850,
                      color: '#fff',
                      cursor: savingFlyer ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6,
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                    }}
                  >
                    {savingFlyer ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Guardando...</> : 'Actualizar Existente'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleSaveFlyer(newDesignName, false)}
                  disabled={savingFlyer}
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                    border: 'none', borderRadius: 10,
                    padding: '10px 20px', fontSize: 12, fontWeight: 850,
                    color: '#fff',
                    cursor: savingFlyer ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                    boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)'
                  }}
                >
                  {savingFlyer ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Guardando...</> : 'Guardar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── GALLERY MODAL ("MIS DISEÑOS") ────────────────────────────────────── */}
      {isGalleryModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#ffffff', borderRadius: 28, border: '1px solid #e2e8f0',
            width: '100%', maxWidth: 880, maxHeight: '85vh', overflow: 'hidden',
            boxShadow: '0 25px 60px rgba(15, 23, 42, 0.2)',
            display: 'flex', flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '24px 28px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FolderOpen size={20} color="#7c3aed" /> Mis Diseños Guardados
                </h3>
                <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0 0' }}>Historial de flyers y plantillas personalizadas de tu empresa</p>
              </div>
              <button 
                onClick={() => setIsGalleryModalOpen(false)}
                style={{ background: 'rgba(0,0,0,0.04)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} color="#0f172a" />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 28, overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
              {loadingSavedFlyers ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 12 }}>
                  <Loader2 size={36} color="#7c3aed" style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>Cargando tus diseños...</span>
                </div>
              ) : savedFlyers.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 40px', gap: 12, textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <FolderOpen size={24} color="#7c3aed" />
                  </div>
                  <h4 style={{ fontSize: 15, fontWeight: 900, color: '#334155', margin: 0 }}>No tienes diseños guardados</h4>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0, maxWidth: 300 }}>Personaliza cualquier plantilla en el canvas y haz clic en "Guardar Diseño" en la barra superior.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
                  {savedFlyers.map((flyer) => {
                    const parsedDate = new Date(flyer.created_at).toLocaleDateString('es-ES', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                    });
                    const aspectLabel = FORMATS.find(f => f.id === flyer.format)?.label || flyer.format;

                    return (
                      <div 
                        key={flyer.id}
                        style={{
                          background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0',
                          overflow: 'hidden', display: 'flex', flexDirection: 'column',
                          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.03)',
                          transition: 'all 0.2s ease',
                          position: 'relative'
                        }}
                      >
                        {/* Flyer Preview Thumbnail / Placeholder */}
                        <div style={{
                          height: 180, background: '#f1f5f9', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          position: 'relative', overflow: 'hidden', borderBottom: '1px solid #f1f5f9'
                        }}>
                          {flyer.thumbnail_url ? (
                            <img 
                              src={flyer.thumbnail_url} 
                              alt={flyer.name} 
                              style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }}
                            />
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: '#94a3b8' }}>
                              <Image size={24} />
                              <span style={{ fontSize: 9, fontWeight: 700 }}>Sin vista previa</span>
                            </div>
                          )}
                          <div style={{
                            position: 'absolute', bottom: 8, left: 8,
                            background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)',
                            borderRadius: 6, padding: '3px 6px', fontSize: 8, fontWeight: 800, color: '#fff',
                            textTransform: 'uppercase', letterSpacing: '0.05em'
                          }}>
                            {aspectLabel}
                          </div>
                        </div>

                        {/* Card Info */}
                        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                          <div style={{ marginBottom: 12 }}>
                            {editingFlyerId === flyer.id ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                                <input
                                  type="text"
                                  value={editingFlyerName}
                                  onChange={e => setEditingFlyerName(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleRenameFlyer(flyer.id, editingFlyerName);
                                    if (e.key === 'Escape') setEditingFlyerId(null);
                                  }}
                                  style={{
                                    fontSize: 12, fontWeight: 800, color: '#1e293b',
                                    border: '1px solid #7c3aed', borderRadius: 6, padding: '3px 8px',
                                    width: '100%', outline: 'none', background: '#fff', boxSizing: 'border-box'
                                  }}
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleRenameFlyer(flyer.id, editingFlyerName)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: '#10b981' }}
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => setEditingFlyerId(null)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: '#ef4444' }}
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
                                <h4 style={{ fontSize: 13, fontWeight: 900, color: '#1e293b', margin: 0, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={flyer.name}>
                                  {flyer.name}
                                </h4>
                                <button
                                  onClick={() => {
                                    setEditingFlyerId(flyer.id);
                                    setEditingFlyerName(flyer.name);
                                  }}
                                  title="Editar nombre"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: '#94a3b8', transition: 'color 0.15s ease' }}
                                >
                                  <Edit2 size={11} />
                                </button>
                              </div>
                            )}
                            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>
                              Creado: {parsedDate}
                            </div>
                            <div style={{ fontSize: 9, color: '#7c3aed', fontWeight: 700, marginTop: 4 }}>
                              Plantilla: {flyer.template_id === 'A' ? 'Glow Glassmorphic' : flyer.template_id === 'B' ? 'Editorial Showcase' : flyer.template_id}
                            </div>
                          </div>

                          {/* Actions */}
                          <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                            <button
                              onClick={() => handleLoadFlyer(flyer)}
                              style={{
                                flex: 1, background: '#f5f3ff', border: '1px solid #ddd6fe',
                                borderRadius: 8, padding: '7px 0', fontSize: 11, fontWeight: 800,
                                color: '#7c3aed', cursor: 'pointer', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', gap: 6, transition: 'all 0.15s ease'
                              }}
                            >
                              <FolderOpen size={12} />
                              Cargar y Editar
                            </button>
                            <button
                              onClick={() => handleDeleteFlyer(flyer.id)}
                              style={{
                                width: 28, height: 28, background: '#fef2f2', border: '1px solid #fecaca',
                                borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', color: '#ef4444', transition: 'all 0.15s ease'
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 28px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setIsGalleryModalOpen(false)}
                style={{ background: '#fff', border: '1px solid #d8dde6', borderRadius: 10, padding: '8px 16px', fontSize: 11, fontWeight: 800, color: '#475569', cursor: 'pointer' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AIDA METHODOLOGY MODAL ────────────────────────────────────── */}
      {isAidaModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 0.2s ease-out'
        }} onClick={() => setIsAidaModalOpen(false)}>
          <div style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 20,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            width: '100%',
            maxWidth: 480,
            display: 'flex', flexDirection: 'column',
            animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            overflow: 'hidden'
          }} onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: '#eff6ff', display: 'flex',
                  alignItems: 'center', justifyContent: 'center'
                }}>
                  <BarChart3 size={15} color="#3b82f6" />
                </div>
                <span style={{ fontSize: 13, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Metodología AIDA
                </span>
              </div>
              <button
                onClick={() => setIsAidaModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} color="#64748b" />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 18, maxHeight: '80vh', overflowY: 'auto' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Info size={14} color="#6366f1" />
                  Rigor y Metodología
                </div>
                <p style={{ margin: 0, fontSize: 11, color: '#475569', lineHeight: 1.6, textAlign: 'justify' }}>
                  Evaluamos tu brief utilizando una fórmula matemática basada en las mejores prácticas de la industria y la psicología de conversión de la metodología AIDA. Estudios globales de publicidad digital demuestran que estructurar tus textos con estos parámetros clave (Atención, Interés, Deseo y Acción) optimiza la retención del usuario y puede incrementar la conversión en hasta un <strong>400%</strong> frente a copias sin estructura.
                </p>
              </div>

              <div style={{ height: '1px', background: '#f1f5f9' }} />

              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Target size={14} color="#6366f1" />
                  Estructura del Score de Viralidad
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* A - Atención */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, background: '#f0fdf4',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2
                    }}>
                      <Eye size={12} color="#16a34a" />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#1f2937' }}>Atención (A - 18 pts)</div>
                      <div style={{ fontSize: 10, color: '#4b5563', marginTop: 2 }}>
                        Presencia de precios, descuentos claros u ofertas específicas (ej: <em>$12.95, 30% OFF</em>) para captar la mirada del usuario.
                      </div>
                    </div>
                  </div>

                  {/* I - Interés */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, background: '#fef3c7',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2
                    }}>
                      <Zap size={12} color="#d97706" />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#1f2937' }}>Interés (I - 20 pts)</div>
                      <div style={{ fontSize: 10, color: '#4b5563', marginTop: 2 }}>
                        Palabras de urgencia y disparadores de escasez (ej: <em>hoy, oferta limitada, solo esta semana</em>) para retener la atención.
                      </div>
                    </div>
                  </div>

                  {/* D - Deseo */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, background: '#f5f3ff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2
                    }}>
                      <Award size={12} color="#7c3aed" />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#1f2937' }}>Deseo (D - 15 pts)</div>
                      <div style={{ fontSize: 10, color: '#4b5563', marginTop: 2 }}>
                        Exposición estructurada de beneficios clave y propuesta de valor clara (ej: <em>incluye, ofrece, contiene</em>).
                      </div>
                    </div>
                  </div>

                  {/* A - Acción */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, background: '#ecfdf5',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2
                    }}>
                      <Send size={12} color="#059669" />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#1f2937' }}>Acción (A - 18 pts)</div>
                      <div style={{ fontSize: 10, color: '#4b5563', marginTop: 2 }}>
                        Llamada a la Acción (CTA) explícita (10 pts) junto con datos de contacto o URL claros (8 pts) para canalizar la conversión.
                      </div>
                    </div>
                  </div>

                  {/* Estructura y Longitud */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, background: '#f0f9ff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2
                    }}>
                      <Type size={12} color="#0284c7" />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#1f2937' }}>Longitud y Datos (29 pts)</div>
                      <div style={{ fontSize: 10, color: '#4b5563', marginTop: 2 }}>
                        Rango de caracteres óptimo (80-400 chars: 15 pts), inclusión de números o datos (9 pts) y formato estructurado (5 pts).
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div style={{
              padding: '14px 20px',
              background: '#f8fafc',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setIsAidaModalOpen(false)}
                style={{
                  background: '#0f172a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '8px 16px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#1e293b'}
                onMouseLeave={e => e.currentTarget.style.background = '#0f172a'}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
