import React, { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Sparkles, Download, Send, RefreshCw,
  Zap, Image, Check, ChevronLeft, ChevronRight, ChevronDown, Upload, X, Eye, Plus,
  BarChart3, Wand2, Layers, Palette, Type, Layout,
  ExternalLink, Star, Cpu, Building2, Smartphone,
  FolderOpen, Save, Loader2,
  Info, Target, Award, Globe, Moon, Sun, Sliders
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
import {
  FORMATS,
  TONES,
  BRAND_COLORS,
  GRADIENT_PRESETS,
  DEFAULT_BG_IMAGE,
  DEFAULT_LOGO_SVG,
  FONT_OPTIONS,
  css,
} from './flyerStudio/constants';
import {
  calcViralScore,
  getFlyerDimensions,
  urlToBase64,
  getThematicImages,
} from './flyerStudio/helpers';
import {
  FormatSelectionModal,
  ToneSelectionModal,
  BrandColorPickerModal,
  TemplateCatalogModal,
  FreePhotoSelectorModal,
} from './flyerStudio/FlyerSelectionModals';
import {
  SaveFlyerModal,
  FlyerGalleryModal,
  AidaMethodologyModal,
} from './flyerStudio/FlyerLibraryModals';

// ─── Component ────────────────────────────────────────────────────────────────
export default function FlyerStudio() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const flyerRef = useRef<HTMLDivElement>(null);
  const templateRefA = useRef<HTMLDivElement>(null);
  const templateRefB = useRef<HTMLDivElement>(null);
  const templateRefMarketing = useRef<HTMLDivElement>(null);
  const lastGeneratedImg = useRef<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('vibrant-gradient');
  const [previewMode, setPreviewMode] = useState<'template' | 'ai'>('template');
  const [bgMode, setBgMode] = useState<'gradient' | 'photo'>('gradient');

  // Form & Content States
  const [prompt, setPrompt] = useState('Flyer promocional para nuestra oferta especial de temporada.');
  const [cta, setCta] = useState('¡CONTACTAR AHORA!');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [format, setFormat] = useState('ig-post');
  const [flyerWidth, setFlyerWidth] = useState(520);
  const canvasH = Math.round(1080 * (getFlyerDimensions(format).height / getFlyerDimensions(format).width));
  const [tone, setTone] = useState('moderno');
  const [variantCount, setVariantCount] = useState<1 | 2 | 3>(1);
  const [colors, setColors] = useState<string[]>(['#06c7d9', '#2563eb', '#6d4aff']);
  const [gradColor1, setGradColor1] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('flyer_dynamic_gradient');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.c1) return p.c1;
      }
    } catch {}
    return '#06c7d9';
  });
  const [gradColor2, setGradColor2] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('flyer_dynamic_gradient');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.c2) return p.c2;
      }
    } catch {}
    return '#2563eb';
  });
  const [gradColor3, setGradColor3] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('flyer_dynamic_gradient');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.c3) return p.c3;
      }
    } catch {}
    return '#6d4aff';
  });
  const [useThreeColors, setUseThreeColors] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('flyer_dynamic_gradient');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.threeStops !== undefined) return p.threeStops;
      }
    } catch {}
    return true;
  });
  const [gradAngle, setGradAngle] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('flyer_dynamic_gradient');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.angle !== undefined) return p.angle;
      }
    } catch {}
    return 135;
  });
  const [gradType, setGradType] = useState<'linear' | 'radial'>(() => {
    try {
      const saved = localStorage.getItem('flyer_dynamic_gradient');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.type) return p.type;
      }
    } catch {}
    return 'linear';
  });
  const [selectedGradient, setSelectedGradient] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('flyer_dynamic_gradient');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.css) return p.css;
      }
    } catch {}
    return 'linear-gradient(135deg, #06c7d9 0%, #2563eb 50%, #6d4aff 100%)';
  });
  const [badgeTop, setBadgeTop] = useState<string>('+600');
  const [badgeBottom, setBadgeBottom] = useState<string>('CLIENTES SATISFECHOS');
  const [savingBrandColors, setSavingBrandColors] = useState<boolean>(false);

  const updateDynamicGradient = (
    c1: string,
    c2: string,
    c3: string,
    angle: number,
    type: 'linear' | 'radial',
    threeStops = useThreeColors
  ) => {
    let cssGrad = '';
    if (threeStops) {
      cssGrad = type === 'radial'
        ? `radial-gradient(circle at center, ${c1} 0%, ${c2} 50%, ${c3} 100%)`
        : `linear-gradient(${angle}deg, ${c1} 0%, ${c2} 50%, ${c3} 100%)`;
    } else {
      cssGrad = type === 'radial'
        ? `radial-gradient(circle at center, ${c1} 0%, ${c3} 100%)`
        : `linear-gradient(${angle}deg, ${c1} 0%, ${c3} 100%)`;
    }
    setSelectedGradient(cssGrad);
    setBgMode('gradient');
    setSelectedTemplate('vibrant-gradient');
    try {
      localStorage.setItem('flyer_dynamic_gradient', JSON.stringify({
        c1, c2, c3, angle, type, threeStops, css: cssGrad
      }));
    } catch (e) {
      console.warn('Could not save gradient to localStorage:', e);
    }
  };

  const handleColorHexInput = (
    index: 1 | 2 | 3,
    rawVal: string,
    isBlur: boolean = false
  ) => {
    let val = rawVal.trim();
    if (val && !val.startsWith('#')) {
      val = '#' + val;
    }
    if (index === 1) setGradColor1(val);
    if (index === 2) setGradColor2(val);
    if (index === 3) setGradColor3(val);

    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val)) {
      let fullHex = val;
      if (val.length === 4) {
        fullHex = '#' + val[1] + val[1] + val[2] + val[2] + val[3] + val[3];
        if (index === 1) setGradColor1(fullHex);
        if (index === 2) setGradColor2(fullHex);
        if (index === 3) setGradColor3(fullHex);
      }
      const c1 = index === 1 ? fullHex : gradColor1;
      const c2 = index === 2 ? fullHex : gradColor2;
      const c3 = index === 3 ? fullHex : gradColor3;
      updateDynamicGradient(c1, c2, c3, gradAngle, gradType, useThreeColors);
    } else if (isBlur) {
      const fallback = index === 1 ? '#06c7d9' : index === 2 ? '#2563eb' : '#6d4aff';
      const cur = index === 1 ? gradColor1 : index === 2 ? gradColor2 : gradColor3;
      const safe = cur.startsWith('#') && cur.length >= 4 ? cur : fallback;
      if (index === 1) setGradColor1(safe);
      if (index === 2) setGradColor2(safe);
      if (index === 3) setGradColor3(safe);
      const c1 = index === 1 ? safe : gradColor1;
      const c2 = index === 2 ? safe : gradColor2;
      const c3 = index === 3 ? safe : gradColor3;
      updateDynamicGradient(c1, c2, c3, gradAngle, gradType, useThreeColors);
    }
  };

  const handleSaveToCompanyBranding = async () => {
    try {
      setSavingBrandColors(true);
      const company = await brandingService.getMyCompany();
      const currentFeatures = (company.features || {}) as any;
      const brandGradObj = {
        c1: gradColor1,
        c2: gradColor2,
        c3: gradColor3,
        angle: gradAngle,
        type: gradType,
        threeStops: useThreeColors,
        css: selectedGradient
      };
      const updatedFeatures = {
        ...currentFeatures,
        brand_colors: colors,
        brand_gradient: brandGradObj
      };
      
      const payload: any = {
        features: updatedFeatures
      };

      if (logoPreview && !logoPreview.startsWith('data:image/svg+xml;base64,PHN2Zy')) {
        payload.logo_url = logoPreview;
        const companyLogoKey = profile?.company_id ? `flyer_custom_logo_${profile.company_id}` : 'flyer_custom_logo_default';
        localStorage.setItem(companyLogoKey, logoPreview);
      }

      await brandingService.updateBranding(payload);
      const companyColorsKey = profile?.company_id ? `flyer_brand_colors_${profile.company_id}` : 'flyer_brand_colors_default';
      localStorage.setItem(companyColorsKey, JSON.stringify(colors));
      localStorage.setItem('flyer_dynamic_gradient', JSON.stringify(brandGradObj));
      toast.success('🏢 ¡Logo, colores y degradado guardados para toda tu empresa!');
    } catch (err: any) {
      console.error('Error saving brand colors:', err);
      const companyColorsKey = profile?.company_id ? `flyer_brand_colors_${profile.company_id}` : 'flyer_brand_colors_default';
      localStorage.setItem(companyColorsKey, JSON.stringify(colors));
      if (logoPreview) {
        const companyLogoKey = profile?.company_id ? `flyer_custom_logo_${profile.company_id}` : 'flyer_custom_logo_default';
        localStorage.setItem(companyLogoKey, logoPreview);
      }
      toast.success('💾 Guardado en este navegador.');
    } finally {
      setSavingBrandColors(false);
    }
  };

  useEffect(() => {
    if (colors && colors.length > 0) {
      try {
        const companyColorsKey = profile?.company_id ? `flyer_brand_colors_${profile.company_id}` : 'flyer_brand_colors_default';
        localStorage.setItem(companyColorsKey, JSON.stringify(colors));
      } catch {}
    }
  }, [colors, profile?.company_id]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [isLogoCustomized, setIsLogoCustomized] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
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

  // Logo positioning: default to top-left corner
  const [logoX, setLogoX] = useState(4);
  const [logoY, setLogoY] = useState(4);
  const [logoSize, setLogoSize] = useState(1.0);

  const logoRef = useRef<HTMLInputElement>(null);

  const handleLogoFileSelect = async (f: File) => {
    if (!f) return;
    setLogoFile(f);
    setIsLogoCustomized(true);
    // Reset logo position to top-left on new upload
    setLogoX(4);
    setLogoY(4);
    setLogoSize(1.0);

    const companyLogoKey = profile?.company_id ? `flyer_custom_logo_${profile.company_id}` : 'flyer_custom_logo_default';

    // 1. Immediate local base64 preview for instant visual feedback
    const reader = new FileReader();
    reader.onload = ev => {
      const base64 = ev.target?.result as string;
      if (base64) {
        setLogoPreview(base64);
        try {
          localStorage.setItem(companyLogoKey, base64);
          localStorage.removeItem('flyer_custom_logo'); // Clean up unscoped legacy
        } catch {}
      }
    };
    reader.readAsDataURL(f);


    // 2. Upload to Supabase Storage & sync to company branding
    if (profile?.company_id) {
      setUploadingLogo(true);
      const toastId = toast.loading('Guardando logo en tu marca...');
      try {
        const publicUrl = await storageService.uploadLogo(profile.company_id, f);
        if (publicUrl) {
          const remoteUrlKey = `flyer_logo_remote_url_${profile.company_id}`;
          localStorage.setItem(remoteUrlKey, publicUrl);
          await brandingService.updateBranding({ logo_url: publicUrl });
          toast.success('🏢 ¡Logo guardado con éxito para toda tu empresa!', { id: toastId });
        }
      } catch (err: any) {
        console.error('Error uploading logo to storage:', err);
        toast.error('Logo cargado localmente (aviso: error al sincronizar en la nube).', { id: toastId });
      } finally {
        setUploadingLogo(false);
      }
    } else {
      toast.success('Logo cargado');
    }
  };

  const handleRemoveLogo = async () => {
    setLogoFile(null);
    setLogoPreview('');
    setIsLogoCustomized(true);
    const companyLogoKey = profile?.company_id ? `flyer_custom_logo_${profile.company_id}` : 'flyer_custom_logo_default';
    localStorage.removeItem(companyLogoKey);
    localStorage.removeItem('flyer_custom_logo'); // Purge legacy global key
    if (logoRef.current) logoRef.current.value = '';
    if (profile?.company_id) {
      try {
        await brandingService.updateBranding({ logo_url: null });
        toast.success('Logo removido');
      } catch (err) {
        console.error('Error removing logo:', err);
      }
    }
  };

  // State
  const [generating, setGenerating] = useState(false);
  const [variants, setVariants] = useState<string[]>([]);
  const [selected, setSelected] = useState(0);
  const effectiveBgImage = bgMode === 'photo'
    ? (bgUploadPreview || (variants.length > 0 ? variants[selected] : null) || DEFAULT_BG_IMAGE)
    : null;
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

  // ── WhatsApp CTA & QR states ────────────────────────────────────────────────
  const [waEnabled, setWaEnabled] = useState(false);
  const [waNumberSource, setWaNumberSource] = useState<'chatbot' | 'custom'>('chatbot');
  const [waChatbotNumber, setWaChatbotNumber] = useState('');
  const [waCustomNumber, setWaCustomNumber] = useState('');
  const [waMessage, setWaMessage] = useState('Hola, vi su flyer y me gustaría recibir más información.');
  const [waShowQr, setWaShowQr] = useState(false);
  const [waQrPosition, setWaQrPosition] = useState<'bottom-right' | 'bottom-left'>('bottom-right');

  // Computed effective WA phone
  const waEffectivePhone = waNumberSource === 'chatbot' ? waChatbotNumber : waCustomNumber;
  const waLink = waEnabled && waEffectivePhone
    ? `https://wa.me/${waEffectivePhone.replace(/[^\d+]/g, '').replace('+', '')}?text=${encodeURIComponent(waMessage)}`
    : '';

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
  const [bulletShape, setBulletShape] = useState<string>('check');
  const [showBenefits, setShowBenefits] = useState<boolean>(true);
  const [benefitsAlign, setBenefitsAlign] = useState<'left' | 'center' | 'right'>('left');
  const [benefitsLayout, setBenefitsLayout] = useState<'chips' | 'column'>('chips');
  const [showCta, setShowCta] = useState<boolean>(true);
  const [cardBgColor, setCardBgColor] = useState('');
  const [ctaBgColor, setCtaBgColor] = useState('');
  const [ctaTextColor, setCtaTextColor] = useState('');
  const [contactColor, setContactColor] = useState('');
  const [highlightColor, setHighlightColor] = useState('#FFD700');
  const [textY, setTextY] = useState(0);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');
  const [bgOverlayEnabled, setBgOverlayEnabled] = useState<boolean>(true);
  const [bgOverlayColor, setBgOverlayColor] = useState<string>('rgba(0, 0, 0, 0.5)');
  const [bgOverlayOpacity, setBgOverlayOpacity] = useState<number>(0.35);
  const [bgOverlayBlendMode, setBgOverlayBlendMode] = useState<'multiply' | 'overlay' | 'darken' | 'normal'>('multiply');
  const [overlayType, setOverlayType] = useState<'dark' | 'solid' | 'gradient' | 'branding'>('dark');
  const [overlaySolidColor, setOverlaySolidColor] = useState<string>('#000000');
  const [overlayGrad1, setOverlayGrad1] = useState<string>('#581c87');
  const [overlayGrad2, setOverlayGrad2] = useState<string>('#0f172a');

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
            if (data.phone) setPhone(data.phone || '');
            if (data.website) setWebsite(data.website || '');
            const companyLogoKey = `flyer_custom_logo_${profile.company_id}`;
            localStorage.removeItem('flyer_custom_logo'); // Purge legacy unscoped key so it never leaks across tenants
            localStorage.removeItem('flyer_brand_colors'); // Purge legacy unscoped colors

            if (data.logo_url && !isLogoCustomized) {
              try {
                const base64 = await urlToBase64(data.logo_url);
                setLogoPreview(base64 || data.logo_url);
                localStorage.setItem(companyLogoKey, base64 || data.logo_url);
              } catch {
                setLogoPreview(data.logo_url);
                localStorage.setItem(companyLogoKey, data.logo_url);
              }
            } else if (!isLogoCustomized) {
              const savedLogo = localStorage.getItem(companyLogoKey);
              if (savedLogo) {
                setLogoPreview(savedLogo);
              } else {
                setLogoPreview('');
              }
            }
            // Load company branding colors & gradient if configured
            const feats = (data.features || {}) as any;
            if (feats.brand_colors && Array.isArray(feats.brand_colors) && feats.brand_colors.length > 0) {
              setColors(feats.brand_colors);
            }
            if (feats.brand_gradient) {
              const bg = feats.brand_gradient;
              if (bg.c1) setGradColor1(bg.c1);
              if (bg.c2) setGradColor2(bg.c2);
              if (bg.c3) setGradColor3(bg.c3);
              if (bg.angle !== undefined) setGradAngle(bg.angle);
              if (bg.type) setGradType(bg.type);
              if (bg.threeStops !== undefined) setUseThreeColors(bg.threeStops);
              if (bg.css) setSelectedGradient(bg.css);
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
      // Load chatbot WhatsApp number from marketing_integrations
      (async () => {
        try {
          const { data: intData } = await supabase
            .from('marketing_integrations')
            .select('settings')
            .eq('company_id', profile.company_id)
            .eq('provider', 'whatsapp')
            .eq('is_active', true)
            .maybeSingle();
          if (intData?.settings?.phone) {
            setWaChatbotNumber(intData.settings.phone);
          }
        } catch (e) {
          // Silently fail — admin can enter number manually
        }
      })();
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
    setLogoPreview('');
    setLogoX(4);
    setLogoY(4);
    setLogoSize(1.0);
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
        selectedGradient,
        gradColor1,
        gradColor2,
        gradColor3,
        gradAngle,
        gradType,
        useThreeColors,
        badgeTop,
        badgeBottom,
        phone,
        website,
        syncFonts,
        keepCustomText,
        isLogoCustomized,
        // WhatsApp CTA settings
        whatsapp: {
          enabled: waEnabled,
          numberSource: waNumberSource,
          customNumber: waCustomNumber,
          message: waMessage,
          showQr: waShowQr,
          qrPosition: waQrPosition
        }
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
      if (s.selectedGradient !== undefined) setSelectedGradient(s.selectedGradient);
      if (s.gradColor1 !== undefined) setGradColor1(s.gradColor1);
      if (s.gradColor2 !== undefined) setGradColor2(s.gradColor2);
      if (s.gradColor3 !== undefined) setGradColor3(s.gradColor3);
      if (s.gradAngle !== undefined) setGradAngle(s.gradAngle);
      if (s.gradType !== undefined) setGradType(s.gradType);
      if (s.useThreeColors !== undefined) setUseThreeColors(s.useThreeColors);
      if (s.badgeTop !== undefined) setBadgeTop(s.badgeTop);
      if (s.badgeBottom !== undefined) setBadgeBottom(s.badgeBottom);
      
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
      // WhatsApp CTA
      if (s.whatsapp) {
        setWaEnabled(s.whatsapp.enabled ?? false);
        setWaNumberSource(s.whatsapp.numberSource ?? 'chatbot');
        setWaCustomNumber(s.whatsapp.customNumber ?? '');
        setWaMessage(s.whatsapp.message ?? 'Hola, vi su flyer y me gustaría recibir más información.');
        setWaShowQr(s.whatsapp.showQr ?? false);
        setWaQrPosition(s.whatsapp.qrPosition ?? 'bottom-right');
      }

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
        flyerId: loadedFlyerId || null
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
              <label style={css.label}>Datos de Marca y Contacto</label>
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
                    placeholder="Nombre de Empresa / Marca (Ej: Mi Marca, Iclesia)"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = '#6366f1';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = '#cbd5e1';
                      e.currentTarget.style.boxShadow = '0 1px 2px rgba(15, 23, 42, 0.02)';
                    }}
                  />
                  <Building2 size={12} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
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
                    placeholder="Teléfono (Ej: +1 234 567 890)"
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
                    placeholder="Sitio Web (Ej: www.tuempresa.com)"
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ ...css.label, marginBottom: 0 }}>Logo / Imagen de Marca</label>
                {uploadingLogo && (
                  <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> Subiendo a la nube...
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => logoRef.current?.click()}
                  type="button"
                  disabled={uploadingLogo}
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
                    cursor: uploadingLogo ? 'wait' : 'pointer',
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
                  <span>{logoPreview && !logoPreview.startsWith('data:image/svg+xml;base64,PHN2Zy') ? 'Cambiar logo' : 'Subir logo'}</span>
                </button>
                {logoPreview && !logoPreview.startsWith('data:image/svg+xml;base64,PHN2Zy') && (
                  <div style={{ position: 'relative', display: 'inline-flex' }}>
                    <img src={logoPreview} alt="logo" style={{ height: 38, width: 38, objectFit: 'contain', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff' }} />
                    <button onClick={handleRemoveLogo} style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', border: 'none', borderRadius: '50%', width: 15, height: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                      <X size={10} color="#fff" />
                    </button>
                  </div>
                )}
              </div>
              {logoPreview && !logoPreview.startsWith('data:image/svg+xml;base64,PHN2Zy') && (
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
              <input ref={logoRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoFileSelect(f); }} style={{ display: 'none' }} />
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

            {/* ─── SELECTOR PRINCIPAL: DEGRADADO DE COLOR VS FOTO DE FONDO ─── */}
            <div style={{ ...css.section, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ ...css.label, marginBottom: 0 }}>Tipo de Fondo del Flyer</label>
                <span style={{
                  fontSize: 9,
                  fontWeight: 900,
                  color: bgMode === 'gradient' ? '#7c3aed' : '#059669',
                  background: bgMode === 'gradient' ? '#f5f3ff' : '#ecfdf5',
                  padding: '2px 8px',
                  borderRadius: 6,
                  border: `1px solid ${bgMode === 'gradient' ? '#ddd6fe' : '#a7f3d0'}`
                }}>
                  {bgMode === 'gradient' ? '🎨 Degradado Puro Activo' : '📷 Foto de Fondo Activa'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, background: '#f1f5f9', padding: 4, borderRadius: 10 }}>
                <button
                  type="button"
                  id="btn-bg-gradient"
                  onClick={() => {
                    setBgMode('gradient');
                    setSelectedTemplate('vibrant-gradient');
                    toast.success('🎨 Modo Degradado Activado: Mostrando tus 2 o 3 colores');
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: bgMode === 'gradient' ? '#7c3aed' : 'transparent',
                    color: bgMode === 'gradient' ? '#fff' : '#64748b',
                    fontWeight: 800,
                    fontSize: 11,
                    cursor: 'pointer',
                    boxShadow: bgMode === 'gradient' ? '0 2px 6px rgba(124,58,237,0.25)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Palette size={13} />
                  Degradado (2 o 3 Colores)
                </button>
                <button
                  type="button"
                  id="btn-bg-photo"
                  onClick={() => {
                    setBgMode('photo');
                    toast.success('📷 Modo Foto Activado');
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: bgMode === 'photo' ? '#7c3aed' : 'transparent',
                    color: bgMode === 'photo' ? '#fff' : '#64748b',
                    fontWeight: 800,
                    fontSize: 11,
                    cursor: 'pointer',
                    boxShadow: bgMode === 'photo' ? '0 2px 6px rgba(124,58,237,0.25)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Image size={13} />
                  Foto de Fondo
                </button>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                CREADOR DINÁMICO DE DEGRADADOS (3 Colores 100% Personalizable)
            ═══════════════════════════════════════════════════════════════ */}
            <div style={{ ...css.section, background: '#f8fafc', padding: 12, borderRadius: 12, border: bgMode === 'gradient' ? '1.5px solid #c4b5fd' : '1.5px solid #e2e8f0', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Palette size={14} color="#7c3aed" />
                  <span style={{ fontSize: 11, fontWeight: 900, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Creador Dinámico (3 Colores)</span>
                </div>
                {/* Mode toggle: Linear / Radial */}
                <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: 6, padding: 2 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setGradType('linear');
                      updateDynamicGradient(gradColor1, gradColor2, gradColor3, gradAngle, 'linear');
                    }}
                    style={{
                      border: 'none',
                      background: gradType === 'linear' ? '#fff' : 'transparent',
                      color: gradType === 'linear' ? '#0f172a' : '#64748b',
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 4,
                      cursor: 'pointer'
                    }}
                  >
                    Lineal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGradType('radial');
                      updateDynamicGradient(gradColor1, gradColor2, gradColor3, gradAngle, 'radial');
                    }}
                    style={{
                      border: 'none',
                      background: gradType === 'radial' ? '#fff' : 'transparent',
                      color: gradType === 'radial' ? '#0f172a' : '#64748b',
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 4,
                      cursor: 'pointer'
                    }}
                  >
                    Radial
                  </button>
                </div>
              </div>

              {/* Dynamic Live Preview Box */}
              <div style={{
                height: 48,
                borderRadius: 10,
                background: selectedGradient,
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.08)',
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 12px',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.6)', letterSpacing: '0.05em' }}>
                  {gradType === 'radial' ? 'RADIAL' : `${gradAngle}°`} {useThreeColors ? '(3 PUNTOS)' : '(2 PUNTOS)'}
                </span>
                <button
                  type="button"
                  title="Invertir Colores"
                  onClick={() => {
                    const temp = gradColor1;
                    setGradColor1(gradColor3);
                    setGradColor3(temp);
                    updateDynamicGradient(gradColor3, gradColor2, temp, gradAngle, gradType, useThreeColors);
                  }}
                  style={{
                    background: 'rgba(0,0,0,0.35)',
                    backdropFilter: 'blur(6px)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    color: '#fff',
                    borderRadius: 6,
                    padding: '3px 8px',
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  ⇄ Invertir
                </button>
              </div>

              {/* Color Stops Controls: 2 vs 3 Colores Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b' }}>PUNTOS DE COLOR</span>
                <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: 6, padding: 2 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setUseThreeColors(false);
                      updateDynamicGradient(gradColor1, gradColor2, gradColor3, gradAngle, gradType, false);
                    }}
                    style={{
                      border: 'none',
                      background: !useThreeColors ? '#fff' : 'transparent',
                      color: !useThreeColors ? '#0f172a' : '#64748b',
                      fontSize: 9,
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 4,
                      cursor: 'pointer'
                    }}
                  >
                    2 Colores
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUseThreeColors(true);
                      updateDynamicGradient(gradColor1, gradColor2, gradColor3, gradAngle, gradType, true);
                    }}
                    style={{
                      border: 'none',
                      background: useThreeColors ? '#7c3aed' : 'transparent',
                      color: useThreeColors ? '#fff' : '#64748b',
                      fontSize: 9,
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 4,
                      cursor: 'pointer'
                    }}
                  >
                    3 Colores (Pro)
                  </button>
                </div>
              </div>

              {/* 3 Color Pickers: Inicio (0%), Medio (50%), Final (100%) */}
              <div style={{ display: 'grid', gridTemplateColumns: useThreeColors ? '1fr 1fr 1fr' : '1fr 1fr', gap: 6, marginBottom: 12 }}>
                {/* Color 1: Inicio */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: '#64748b' }}>INICIO (0%)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, padding: '4px' }}>
                    <input
                      type="color"
                      value={gradColor1.startsWith('#') && gradColor1.length === 7 ? gradColor1 : '#06c7d9'}
                      onChange={(e) => handleColorHexInput(1, e.target.value)}
                      style={{ width: 22, height: 22, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0, background: 'none' }}
                    />
                    <input
                      type="text"
                      value={gradColor1}
                      placeholder="#06c7d9"
                      onChange={(e) => handleColorHexInput(1, e.target.value)}
                      onBlur={() => handleColorHexInput(1, gradColor1, true)}
                      style={{ border: 'none', outline: 'none', fontSize: 10, fontWeight: 700, color: '#1e293b', width: '100%', fontFamily: 'monospace' }}
                    />
                  </div>
                </div>

                {/* Color 2: Medio (if 3 colors enabled) */}
                {useThreeColors && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#7c3aed' }}>MEDIO (50%)</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fff', border: '1.5px solid #c4b5fd', borderRadius: 8, padding: '4px' }}>
                      <input
                        type="color"
                        value={gradColor2.startsWith('#') && gradColor2.length === 7 ? gradColor2 : '#2563eb'}
                        onChange={(e) => handleColorHexInput(2, e.target.value)}
                        style={{ width: 22, height: 22, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0, background: 'none' }}
                      />
                      <input
                        type="text"
                        value={gradColor2}
                        placeholder="#2563eb"
                        onChange={(e) => handleColorHexInput(2, e.target.value)}
                        onBlur={() => handleColorHexInput(2, gradColor2, true)}
                        style={{ border: 'none', outline: 'none', fontSize: 10, fontWeight: 700, color: '#1e293b', width: '100%', fontFamily: 'monospace' }}
                      />
                    </div>
                  </div>
                )}

                {/* Color 3: Final */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: '#64748b' }}>FINAL (100%)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, padding: '4px' }}>
                    <input
                      type="color"
                      value={gradColor3.startsWith('#') && gradColor3.length === 7 ? gradColor3 : '#6d4aff'}
                      onChange={(e) => handleColorHexInput(3, e.target.value)}
                      style={{ width: 22, height: 22, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0, background: 'none' }}
                    />
                    <input
                      type="text"
                      value={gradColor3}
                      placeholder="#6d4aff"
                      onChange={(e) => handleColorHexInput(3, e.target.value)}
                      onBlur={() => handleColorHexInput(3, gradColor3, true)}
                      style={{ border: 'none', outline: 'none', fontSize: 10, fontWeight: 700, color: '#1e293b', width: '100%', fontFamily: 'monospace' }}
                    />
                  </div>
                </div>
              </div>

              {/* Angle / Direction Controls (if linear) */}
              {gradType === 'linear' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b' }}>DIRECCIÓN / ÁNGULO</span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#7c3aed' }}>{gradAngle}°</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[
                      { label: '↗ 45°', angle: 45 },
                      { label: '→ 90°', angle: 90 },
                      { label: '↘ 135°', angle: 135 },
                      { label: '↓ 180°', angle: 180 },
                      { label: '↙ 225°', angle: 225 },
                    ].map((d) => (
                      <button
                        key={d.angle}
                        type="button"
                        onClick={() => {
                          setGradAngle(d.angle);
                          updateDynamicGradient(gradColor1, gradColor2, gradColor3, d.angle, 'linear', useThreeColors);
                        }}
                        style={{
                          flex: 1,
                          padding: '4px 0',
                          fontSize: 9,
                          fontWeight: 800,
                          borderRadius: 6,
                          border: gradAngle === d.angle ? '1.5px solid #7c3aed' : '1px solid #cbd5e1',
                          background: gradAngle === d.angle ? '#f5f3ff' : '#fff',
                          color: gradAngle === d.angle ? '#7c3aed' : '#475569',
                          cursor: 'pointer'
                        }}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="5"
                    value={gradAngle}
                    onChange={(e) => {
                      const a = parseInt(e.target.value);
                      setGradAngle(a);
                      updateDynamicGradient(gradColor1, gradColor2, gradColor3, a, 'linear', useThreeColors);
                    }}
                    style={{ width: '100%', accentColor: '#7c3aed' }}
                  />
                </div>
              )}

              {/* Botón: Generar con mis colores de marca */}
              {colors.length >= 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const c1 = colors[0];
                    const c2 = colors[1] || colors[0];
                    const c3 = colors[2] || colors[1] || colors[0];
                    setGradColor1(c1);
                    setGradColor2(c2);
                    setGradColor3(c3);
                    const three = colors.length >= 3;
                    setUseThreeColors(three);
                    updateDynamicGradient(c1, c2, c3, gradAngle, gradType, three);
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: '#ede9fe',
                    color: '#6d28d9',
                    border: '1px solid #ddd6fe',
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    marginBottom: 6
                  }}
                >
                  <span>✨</span> Usar mis Colores de Marca ({colors.slice(0, 3).join(' + ')})
                </button>
              )}

              {/* Botón: Guardar en Marca de Empresa (Persistencia Nube) */}
              <button
                type="button"
                onClick={handleSaveToCompanyBranding}
                disabled={savingBrandColors}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: '#f0fdf4',
                  color: '#15803d',
                  border: '1px solid #bbf7d0',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: savingBrandColors ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  marginBottom: 10,
                  transition: 'all 0.15s ease'
                }}
                title="Guarda este degradado y colores en la configuración de tu empresa para que todos los usuarios los tengan guardados siempre"
              >
                <Building2 size={13} color="#15803d" />
                <span>{savingBrandColors ? 'Guardando en Empresa...' : '💾 Guardar en Marca de Empresa'}</span>
              </button>

              {/* Paletas de Inicio Rápido (Click para cargar y editar) */}
              <div>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Cargar Combinación Rápida</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {GRADIENT_PRESETS.map((gp) => (
                    <button
                      key={gp.id}
                      type="button"
                      title={gp.name}
                      onClick={() => {
                        setGradColor1(gp.c1);
                        setGradColor2(gp.c2);
                        setGradColor3(gp.c3);
                        setGradAngle(gp.angle || 135);
                        setGradType(gp.type || 'linear');
                        setUseThreeColors(true);
                        updateDynamicGradient(gp.c1, gp.c2, gp.c3, gp.angle || 135, gp.type || 'linear', true);
                      }}
                      style={{
                        height: 24,
                        borderRadius: 6,
                        background: gp.value,
                        border: '1px solid rgba(0,0,0,0.1)',
                        cursor: 'pointer',
                        padding: 0
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                AJUSTE DE OSCURIDAD / CAPA DE CONTRASTE DEL FONDO
                (Para quitar o poner oscuridad, aclarar fotos y degradados)
            ═══════════════════════════════════════════════════════════════ */}
            <div style={{
              marginBottom: 16,
              background: '#f8fafc',
              border: (bgOverlayEnabled && bgOverlayOpacity > 0) ? '1.5px solid #cbd5e1' : '1.5px solid #e2e8f0',
              borderRadius: 14,
              padding: 12,
              transition: 'all 0.2s ease'
            }}>
              {/* Header with ON/OFF Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {bgOverlayOpacity === 0 ? <Sun size={15} color="#f59e0b" /> : <Moon size={15} color="#6366f1" />}
                  <span style={{ fontSize: 11, fontWeight: 900, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Oscuridad & Contraste del Fondo
                  </span>
                </div>
                <button
                  type="button"
                  id="toggle-dark-overlay"
                  onClick={() => {
                    if (bgOverlayEnabled && bgOverlayOpacity > 0) {
                      setBgOverlayOpacity(0);
                      setBgOverlayEnabled(false);
                      toast.success('☀️ Oscuridad quitada: Fondo 100% claro');
                    } else {
                      setBgOverlayOpacity(0.35);
                      setBgOverlayEnabled(true);
                      toast.success('🌙 Capa oscura activada al 35%');
                    }
                  }}
                  style={{
                    border: 'none',
                    background: (bgOverlayEnabled && bgOverlayOpacity > 0) ? '#6366f1' : '#e2e8f0',
                    color: (bgOverlayEnabled && bgOverlayOpacity > 0) ? '#fff' : '#64748b',
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '3px 9px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'all 0.15s ease'
                  }}
                >
                  {(bgOverlayEnabled && bgOverlayOpacity > 0) ? 'Oscuridad: ON' : 'Oscuridad: OFF'}
                </button>
              </div>

              {/* Slider de Oscuridad / Opacidad */}
              <div style={{ marginBottom: 12, background: '#fff', padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#475569' }}>Nivel de Oscuridad</span>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 900,
                    color: bgOverlayOpacity === 0 ? '#10b981' : bgOverlayOpacity < 0.4 ? '#6366f1' : '#0f172a',
                    background: bgOverlayOpacity === 0 ? '#ecfdf5' : '#f1f5f9',
                    padding: '2px 8px',
                    borderRadius: 6
                  }}>
                    {bgOverlayOpacity === 0 ? '0% (100% Claro / Sin Oscuridad)' : `${Math.round(bgOverlayOpacity * 100)}%`}
                  </span>
                </div>
                <input
                  type="range"
                  id="slider-dark-opacity"
                  min="0"
                  max="1"
                  step="0.05"
                  value={bgOverlayOpacity}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setBgOverlayOpacity(val);
                    setBgOverlayEnabled(val > 0);
                  }}
                  style={{ width: '100%', accentColor: '#6366f1', cursor: 'pointer' }}
                />

                {/* 4 Botones Rápidos de Oscuridad */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5, marginTop: 8 }}>
                  {[
                    { label: '☀️ 0% Claro', val: 0 },
                    { label: '🌤️ 20% Suave', val: 0.2 },
                    { label: '⛅ 45% Medio', val: 0.45 },
                    { label: '🌑 75% Oscuro', val: 0.75 },
                  ].map((p) => {
                    const active = Math.abs(bgOverlayOpacity - p.val) < 0.05;
                    return (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => {
                          setBgOverlayOpacity(p.val);
                          setBgOverlayEnabled(p.val > 0);
                        }}
                        style={{
                          padding: '5px 2px',
                          fontSize: 9,
                          fontWeight: 800,
                          borderRadius: 6,
                          border: active ? '1.5px solid #6366f1' : '1px solid #e2e8f0',
                          background: active ? '#ede9fe' : '#f8fafc',
                          color: active ? '#6366f1' : '#64748b',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.1s ease'
                        }}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selector de Tono de Oscuridad (Color / Branding) */}
              <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', display: 'block', marginBottom: 6 }}>Tono del Filtro / Superposición</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setOverlayType('dark');
                      setBgOverlayColor('rgba(0, 0, 0, 0.65)');
                    }}
                    style={{
                      padding: '6px 8px',
                      fontSize: 10,
                      fontWeight: 700,
                      borderRadius: 7,
                      border: overlayType === 'dark' ? '1.5px solid #6366f1' : '1px solid #cbd5e1',
                      background: overlayType === 'dark' ? '#f5f3ff' : '#fff',
                      color: overlayType === 'dark' ? '#6366f1' : '#475569',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <span>⬛</span> Negro
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOverlayType('branding');
                      const brandColor = colors[0] || '#6366f1';
                      setBgOverlayColor(brandColor);
                    }}
                    style={{
                      padding: '6px 8px',
                      fontSize: 10,
                      fontWeight: 700,
                      borderRadius: 7,
                      border: overlayType === 'branding' ? '1.5px solid #6366f1' : '1px solid #cbd5e1',
                      background: overlayType === 'branding' ? '#f5f3ff' : '#fff',
                      color: overlayType === 'branding' ? '#6366f1' : '#475569',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <span>✨</span> Marca
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOverlayType('solid');
                    }}
                    style={{
                      padding: '6px 8px',
                      fontSize: 10,
                      fontWeight: 700,
                      borderRadius: 7,
                      border: overlayType === 'solid' ? '1.5px solid #6366f1' : '1px solid #cbd5e1',
                      background: overlayType === 'solid' ? '#f5f3ff' : '#fff',
                      color: overlayType === 'solid' ? '#6366f1' : '#475569',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <span>🎨</span> Elegir
                  </button>
                </div>

                {overlayType === 'solid' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, background: '#fff', padding: 6, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <input
                      type="color"
                      value={overlaySolidColor}
                      onChange={(e) => {
                        setOverlaySolidColor(e.target.value);
                        setBgOverlayColor(e.target.value);
                      }}
                      style={{ width: 26, height: 26, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0 }}
                    />
                    <input
                      type="text"
                      value={overlaySolidColor}
                      onChange={(e) => {
                        setOverlaySolidColor(e.target.value);
                        setBgOverlayColor(e.target.value);
                      }}
                      placeholder="#000000"
                      style={{ ...css.input, padding: '4px 8px', fontSize: 11 }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                WHATSAPP CTA & QR CODE SECTION
            ═══════════════════════════════════════════════════════════════ */}
            <div style={{
              marginBottom: 16,
              background: waEnabled
                ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)'
                : '#f8fafc',
              border: waEnabled ? '1.5px solid #86efac' : '1.5px solid #e2e8f0',
              borderRadius: 14,
              overflow: 'hidden',
              transition: 'all 0.3s ease'
            }}>
              {/* Header Toggle */}
              <div style={{
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer'
              }} onClick={() => setWaEnabled(v => !v)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: waEnabled ? '#22c55e' : '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.25s'
                  }}>
                    <span style={{ fontSize: 15 }}>💬</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: waEnabled ? '#15803d' : '#334155' }}>
                      Botón & QR de WhatsApp
                    </div>
                    <div style={{ fontSize: 9, color: waEnabled ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>
                      {waEnabled ? 'Activo — Los clientes podrán contactarte' : 'Añade un QR y link directo a WhatsApp'}
                    </div>
                  </div>
                </div>
                {/* Toggle switch */}
                <div style={{
                  width: 38,
                  height: 22,
                  borderRadius: 11,
                  background: waEnabled ? '#22c55e' : '#cbd5e1',
                  position: 'relative',
                  transition: 'background 0.25s',
                  flexShrink: 0
                }}>
                  <div style={{
                    position: 'absolute',
                    top: 3,
                    left: waEnabled ? 19 : 3,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)'
                  }} />
                </div>
              </div>

              {/* Expanded controls */}
              {waEnabled && (
                <div style={{ padding: '0 14px 14px 14px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid #bbf7d0' }}>

                  {/* Number source selector */}
                  <div style={{ paddingTop: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#54698d', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Número de WhatsApp</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['chatbot', 'custom'] as const).map(src => (
                        <button
                          key={src}
                          type="button"
                          onClick={() => setWaNumberSource(src)}
                          style={{
                            flex: 1,
                            padding: '7px 10px',
                            borderRadius: 8,
                            border: waNumberSource === src ? '1.5px solid #22c55e' : '1.5px solid #e2e8f0',
                            background: waNumberSource === src ? '#dcfce7' : '#fff',
                            color: waNumberSource === src ? '#15803d' : '#64748b',
                            fontSize: 10,
                            fontWeight: 800,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          {src === 'chatbot' ? '🤖 Chatbot de empresa' : '✏️ Número personalizado'}
                        </button>
                      ))}
                    </div>

                    {waNumberSource === 'chatbot' && (
                      <div style={{ marginTop: 6, padding: '6px 10px', background: '#f0fdf4', borderRadius: 8, fontSize: 11, color: '#15803d', fontWeight: 700, border: '1px solid #bbf7d0' }}>
                        {waChatbotNumber
                          ? <span>✓ Detectado: <strong>+{waChatbotNumber.replace(/[^\d]/g, '')}</strong></span>
                          : <span style={{ color: '#f59e0b' }}>⚠️ Sin chatbot configurado — usa número personalizado</span>
                        }
                      </div>
                    )}

                    {waNumberSource === 'custom' && (
                      <input
                        type="tel"
                        placeholder="Ej: +50379710911"
                        value={waCustomNumber}
                        onChange={e => setWaCustomNumber(e.target.value)}
                        style={{
                          ...css.input,
                          marginTop: 6,
                          borderRadius: 8,
                          fontSize: 12,
                          borderColor: '#bbf7d0',
                          background: '#fff'
                        }}
                        onFocus={e => e.target.style.borderColor = '#22c55e'}
                        onBlur={e => e.target.style.borderColor = '#bbf7d0'}
                      />
                    )}
                  </div>

                  {/* Welcome message */}
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#54698d', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Mensaje de Bienvenida</div>
                    <textarea
                      value={waMessage}
                      onChange={e => setWaMessage(e.target.value)}
                      placeholder="Ej: Hola, vi su flyer y me gustaría recibir más información."
                      rows={2}
                      style={{
                        ...css.textarea,
                        minHeight: 58,
                        fontSize: 12,
                        borderRadius: 8,
                        borderColor: '#bbf7d0',
                        resize: 'none'
                      }}
                      onFocus={e => e.target.style.borderColor = '#22c55e'}
                      onBlur={e => e.target.style.borderColor = '#bbf7d0'}
                    />
                  </div>

                  {/* QR toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#fff', borderRadius: 8, border: '1px solid #bbf7d0', cursor: 'pointer' }}
                    onClick={() => setWaShowQr(v => !v)}
                  >
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#334155' }}>Mostrar Código QR en imagen</div>
                      <div style={{ fontSize: 9, color: '#64748b' }}>Se incrusta al descargar el flyer</div>
                    </div>
                    <div style={{
                      width: 34, height: 20, borderRadius: 10,
                      background: waShowQr ? '#22c55e' : '#cbd5e1',
                      position: 'relative', transition: 'background 0.25s', flexShrink: 0
                    }}>
                      <div style={{
                        position: 'absolute', top: 2, left: waShowQr ? 16 : 2,
                        width: 16, height: 16, borderRadius: '50%',
                        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        transition: 'left 0.25s'
                      }} />
                    </div>
                  </div>

                  {/* QR position */}
                  {waShowQr && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#54698d', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Posición del QR</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {([['bottom-right', '↘ Inferior Derecha'], ['bottom-left', '↙ Inferior Izquierda']] as const).map(([pos, label]) => (
                          <button
                            key={pos}
                            type="button"
                            onClick={() => setWaQrPosition(pos)}
                            style={{
                              flex: 1,
                              padding: '6px 8px',
                              borderRadius: 7,
                              border: waQrPosition === pos ? '1.5px solid #22c55e' : '1.5px solid #e2e8f0',
                              background: waQrPosition === pos ? '#dcfce7' : '#fff',
                              color: waQrPosition === pos ? '#15803d' : '#64748b',
                              fontSize: 10,
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preview link */}
                  {waLink && (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '8px 12px',
                        background: '#22c55e',
                        color: '#fff',
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 800,
                        textDecoration: 'none',
                        transition: 'all 0.15s'
                      }}
                    >
                      <span>💬</span> Probar enlace de WhatsApp
                    </a>
                  )}
                </div>
              )}
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
                    {TEMPLATE_LIST.find(t => t.id === selectedTemplate)?.name || 'Seleccionar Plantilla'}
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
                        {/* WhatsApp QR overlay */}
                        {waEnabled && waShowQr && waLink && (
                          <div style={{
                            position: 'absolute',
                            bottom: 10,
                            ...(waQrPosition === 'bottom-right' ? { right: 10 } : { left: 10 }),
                            background: '#fff',
                            padding: 6,
                            borderRadius: 8,
                            boxShadow: '0 2px 12px rgba(0,0,0,0.22)',
                            zIndex: 20,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 3
                          }}>
                            <QRCodeSVG value={waLink} size={56} level="M" />
                            <span style={{ fontSize: 6, fontWeight: 800, color: '#25d366', letterSpacing: '0.02em', textTransform: 'uppercase' }}>WhatsApp</span>
                          </div>
                        )}
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
                            <div data-flyer-canvas="true" style={{ position: 'relative', width: 1080, height: canvasH, '--flyer-title-font': `"${titleFont}",sans-serif`, '--flyer-subtitle-font': `"${subtitleFont}",sans-serif`, '--flyer-benefits-font': `"${benefitsFont}",sans-serif`, '--flyer-cta-font': `"${ctaFont}",sans-serif`, '--flyer-contact-font': `"${contactFont}",sans-serif` } as React.CSSProperties}>
                              <FlyerTemplateA data={{
                                company_name: companyName || 'Mi Empresa',
                                containerW: 1080,
                                containerH: canvasH,
                                prompt, cta: cta || 'CONTACTAR AHORA',
                                headline: manualTitle || 'OFERTA INCREÍBLE',
                                subheadline: manualSubtitle || '¡Aprovecha esta increíble oportunidad hoy mismo!',
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
                              {/* WhatsApp QR overlay on Template A */}
                              {waEnabled && waShowQr && waLink && (
                                <div style={{
                                  position: 'absolute',
                                  bottom: 20,
                                  ...(waQrPosition === 'bottom-right' ? { right: 20 } : { left: 20 }),
                                  background: '#fff',
                                  padding: 10,
                                  borderRadius: 12,
                                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                                  zIndex: 20,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: 4
                                }}>
                                  <QRCodeSVG value={waLink} size={80} level="M" />
                                  <span style={{ fontSize: 10, fontWeight: 800, color: '#25d366', letterSpacing: '0.04em', textTransform: 'uppercase' }}>WhatsApp</span>
                                </div>
                              )}
                            </div>
                          ) : selectedTemplate === 'B' ? (
                            <div data-flyer-canvas="true" style={{ position: 'relative', width: 1080, height: canvasH, '--flyer-title-font': `"${titleFont}",sans-serif`, '--flyer-subtitle-font': `"${subtitleFont}",sans-serif`, '--flyer-benefits-font': `"${benefitsFont}",sans-serif`, '--flyer-cta-font': `"${ctaFont}",sans-serif`, '--flyer-contact-font': `"${contactFont}",sans-serif` } as React.CSSProperties}>
                              <FlyerTemplateB data={{
                                company_name: companyName || 'Mi Empresa',
                                containerW: 1080,
                                containerH: canvasH,
                                prompt, cta: cta || 'CONTACTAR AHORA',
                                headline: manualTitle || 'OFERTA INCREÍBLE',
                                subheadline: manualSubtitle || '¡Aprovecha esta increíble oportunidad hoy mismo!',
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
                              {/* WhatsApp QR overlay */}
                              {waEnabled && waShowQr && waLink && (
                                <div style={{
                                  position: 'absolute',
                                  bottom: 20,
                                  ...(waQrPosition === 'bottom-right' ? { right: 20 } : { left: 20 }),
                                  background: '#fff',
                                  padding: 10,
                                  borderRadius: 12,
                                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                                  zIndex: 20,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: 4
                                }}>
                                  <QRCodeSVG value={waLink} size={80} level="M" />
                                  <span style={{ fontSize: 10, fontWeight: 800, color: '#25d366', letterSpacing: '0.04em', textTransform: 'uppercase' }}>WhatsApp</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div data-flyer-canvas="true" style={{ position: 'relative', width: 1080, height: canvasH, '--flyer-title-font': `"${titleFont}",sans-serif`, '--flyer-subtitle-font': `"${subtitleFont}",sans-serif`, '--flyer-benefits-font': `"${benefitsFont}",sans-serif`, '--flyer-cta-font': `"${ctaFont}",sans-serif`, '--flyer-contact-font': `"${contactFont}",sans-serif` } as React.CSSProperties}>
                              <RenderFlyer d={{
                                title: manualTitle || 'TU OFERTA',
                                subtitle: manualSubtitle || '¡Aprovecha esta increíble oportunidad hoy mismo!',
                                cta: showCta ? (cta || '') : '',
                                showCta,
                                beneficios: showBenefits ? manualFeatures.filter(f => f.trim() !== '') : [],
                                showBenefits,
                                benefitsAlign,
                                benefitsLayout,
                                accent: colors[0] || '#0070d2',
                                bgImageUrl: effectiveBgImage,
                                bgType: bgMode,
                                logoUrl: logoPreview || null,
                                industria: companyName || 'Mi Empresa',
                                companyName: companyName,
                                phone, website, templateId: selectedTemplate,
                                gradientBg: selectedGradient,
                                gradColor1,
                                gradColor2,
                                gradColor3,
                                bgOverlayColor,
                                bgOverlayOpacity: (bgOverlayEnabled && bgOverlayOpacity > 0) ? bgOverlayOpacity : 0,
                                bgOverlayBlendMode,
                                bulletColor: benefitsColor,
                                bulletShape,
                                badgeTextTop: badgeTop,
                                badgeTextBottom: badgeBottom,
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
                              {/* WhatsApp QR overlay */}
                              {waEnabled && waShowQr && waLink && (
                                <div style={{
                                  position: 'absolute',
                                  bottom: 20,
                                  ...(waQrPosition === 'bottom-right' ? { right: 20 } : { left: 20 }),
                                  background: '#fff',
                                  padding: 10,
                                  borderRadius: 12,
                                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                                  zIndex: 20,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: 4
                                }}>
                                  <QRCodeSVG value={waLink} size={80} level="M" />
                                  <span style={{ fontSize: 10, fontWeight: 800, color: '#25d366', letterSpacing: '0.04em', textTransform: 'uppercase' }}>WhatsApp</span>
                                </div>
                              )}
                            </div>
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
            subheadline: manualSubtitle || '¡Aprovecha esta increíble oportunidad hoy mismo!',
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
          {/* WhatsApp QR overlay (Hidden Render) */}
          {waEnabled && waShowQr && waLink && (
            <div style={{
              position: 'absolute',
              bottom: 20,
              ...(waQrPosition === 'bottom-right' ? { right: 20 } : { left: 20 }),
              background: '#fff',
              padding: 10,
              borderRadius: 12,
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              zIndex: 20,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4
            }}>
              <QRCodeSVG value={waLink} size={80} level="M" />
              <span style={{ fontSize: 10, fontWeight: 800, color: '#25d366', letterSpacing: '0.04em', textTransform: 'uppercase' }}>WhatsApp</span>
            </div>
          )}
        </div>

        <div ref={templateRefB} style={{ position: 'relative', width: 1080, height: canvasH }}>
          <FlyerTemplateB data={{
            company_name: companyName || 'Mi Empresa',
            prompt,
            cta: cta || 'CONTACTAR AHORA',
            headline: manualTitle || 'OFERTA INCREÍBLE',
            subheadline: manualSubtitle || '¡Aprovecha esta increíble oportunidad hoy mismo!',
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
          {/* WhatsApp QR overlay (Hidden Render) */}
          {waEnabled && waShowQr && waLink && (
            <div style={{
              position: 'absolute',
              bottom: 20,
              ...(waQrPosition === 'bottom-right' ? { right: 20 } : { left: 20 }),
              background: '#fff',
              padding: 10,
              borderRadius: 12,
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              zIndex: 20,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4
            }}>
              <QRCodeSVG value={waLink} size={80} level="M" />
              <span style={{ fontSize: 10, fontWeight: 800, color: '#25d366', letterSpacing: '0.04em', textTransform: 'uppercase' }}>WhatsApp</span>
            </div>
          )}
        </div>

        <div ref={templateRefMarketing} style={{ position: 'relative', width: 1080, height: canvasH }}>
          <RenderFlyer d={{
            title: manualTitle || 'TU OFERTA',
            subtitle: manualSubtitle || '¡Aprovecha esta increíble oportunidad hoy mismo!',
            cta: showCta ? (cta || '') : '',
            showCta,
            beneficios: showBenefits ? manualFeatures.filter(f => f.trim() !== '') : [],
            showBenefits,
            benefitsAlign,
            benefitsLayout,
            accent: colors[0] || '#0070d2',
            bgImageUrl: effectiveBgImage,
            bgType: bgMode,
            logoUrl: logoPreview || null,
            industria: companyName || 'Mi Empresa',
            companyName: companyName,
            phone, website, templateId: selectedTemplate,
            gradientBg: selectedGradient,
            bgOverlayColor,
            bgOverlayOpacity: (bgOverlayEnabled && bgOverlayOpacity > 0) ? bgOverlayOpacity : 0,
            bgOverlayBlendMode,
            bulletColor: benefitsColor,
            bulletShape,
            badgeTextTop: badgeTop,
            badgeTextBottom: badgeBottom,
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
          {/* WhatsApp QR overlay (Hidden Render) */}
          {waEnabled && waShowQr && waLink && (
            <div style={{
              position: 'absolute',
              bottom: 20,
              ...(waQrPosition === 'bottom-right' ? { right: 20 } : { left: 20 }),
              background: '#fff',
              padding: 10,
              borderRadius: 12,
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              zIndex: 20,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4
            }}>
              <QRCodeSVG value={waLink} size={80} level="M" />
              <span style={{ fontSize: 10, fontWeight: 800, color: '#25d366', letterSpacing: '0.04em', textTransform: 'uppercase' }}>WhatsApp</span>
            </div>
          )}
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
                          headline: manualTitle || 'OFERTA INCREÍBLE', subheadline: manualSubtitle || '¡Aprovecha esta increíble oportunidad hoy mismo!',
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
                          headline: manualTitle || 'OFERTA INCREÍBLE', subheadline: manualSubtitle || '¡Aprovecha esta increíble oportunidad hoy mismo!',
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
                        subtitle: manualSubtitle || '¡Aprovecha esta increíble oportunidad hoy mismo!',
                        cta: showCta ? (cta || '') : '',
                        showCta,
                        beneficios: showBenefits ? manualFeatures.filter(f => f.trim() !== '') : [],
                        showBenefits,
                        benefitsAlign,
                        benefitsLayout,
                        accent: colors[0] || '#0070d2',
                        bgImageUrl: effectiveBgImage,
                        bgType: bgMode,
                        logoUrl: logoPreview || null,
                        industria: companyName || 'Mi Empresa',
                        companyName: companyName,
                        phone, website, templateId: selectedTemplate,
                        gradientBg: selectedGradient,
                        bgOverlayColor,
                        bgOverlayOpacity: (bgOverlayEnabled && bgOverlayOpacity > 0) ? bgOverlayOpacity : 0,
                        bgOverlayBlendMode,
                        bulletColor: benefitsColor,
                        bulletShape,
                        badgeTextTop: badgeTop,
                        badgeTextBottom: badgeBottom,
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
                  {/* Interruptor de Visibilidad */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: showBenefits ? '#f0fdf4' : '#f8fafc', border: `1.5px solid ${showBenefits ? '#86efac' : '#cbd5e1'}`, borderRadius: 10 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: showBenefits ? '#15803d' : '#64748b' }}>
                        {showBenefits ? '✓ Bloque de Beneficios Visible' : '✕ Bloque de Beneficios Oculto'}
                      </div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>
                        {showBenefits ? 'Se muestra en el diseño del flyer' : 'Completamente oculto en el diseño final'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBenefits(!showBenefits)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                        border: 'none',
                        background: showBenefits ? '#16a34a' : '#94a3b8',
                        color: '#fff',
                        transition: '0.15s'
                      }}
                    >
                      {showBenefits ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>

                  {/* Alineación de Beneficios */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                      Alineación de Beneficios
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                      {[
                        { id: 'left', label: '⬅️ Izquierda' },
                        { id: 'center', label: '↔️ Centrado' },
                        { id: 'right', label: '➡️ Derecha' }
                      ].map(al => {
                        const isSel = benefitsAlign === al.id;
                        return (
                          <button
                            key={al.id}
                            type="button"
                            onClick={() => setBenefitsAlign(al.id as any)}
                            style={{
                              padding: '7px 4px',
                              borderRadius: 8,
                              border: isSel ? '1.5px solid #7c3aed' : '1px solid #cbd5e1',
                              background: isSel ? '#f5f3ff' : '#fff',
                              color: isSel ? '#6b21a8' : '#334155',
                              fontWeight: 800,
                              fontSize: 11,
                              cursor: 'pointer'
                            }}
                          >
                            {al.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Disposición / Formato */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                      Disposición / Formato
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                      {[
                        { id: 'column', label: '📋 Lista Vertical' },
                        { id: 'chips', label: '🏷️ Pastillas en Línea' }
                      ].map(lay => {
                        const isSel = benefitsLayout === lay.id;
                        return (
                          <button
                            key={lay.id}
                            type="button"
                            onClick={() => setBenefitsLayout(lay.id as any)}
                            style={{
                              padding: '7px 4px',
                              borderRadius: 8,
                              border: isSel ? '1.5px solid #7c3aed' : '1px solid #cbd5e1',
                              background: isSel ? '#f5f3ff' : '#fff',
                              color: isSel ? '#6b21a8' : '#334155',
                              fontWeight: 800,
                              fontSize: 10,
                              cursor: 'pointer'
                            }}
                          >
                            {lay.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Lista dinámica de Beneficios */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                        Características / Beneficios ({manualFeatures.length})
                      </span>
                      {manualFeatures.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setManualFeatures([]);
                            setKeepCustomText(true);
                          }}
                          style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                        >
                          Vaciar todos
                        </button>
                      )}
                    </div>
                    {manualFeatures.map((feat, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          style={{ ...css.input, flex: 1 }}
                          value={feat}
                          onChange={e => {
                            const copy = [...manualFeatures];
                            copy[idx] = e.target.value;
                            setManualFeatures(copy);
                            setKeepCustomText(true);
                          }}
                          placeholder={`Beneficio ${idx + 1}`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const copy = manualFeatures.filter((_, i) => i !== idx);
                            setManualFeatures(copy);
                            setKeepCustomText(true);
                          }}
                          style={{
                            width: 32,
                            height: 36,
                            borderRadius: 6,
                            border: '1px solid #fecaca',
                            background: '#fef2f2',
                            color: '#ef4444',
                            fontSize: 14,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                          title="Eliminar este beneficio"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setManualFeatures([...manualFeatures, 'Nuevo Beneficio']);
                        setKeepCustomText(true);
                      }}
                      style={{
                        padding: '7px 12px',
                        borderRadius: 8,
                        border: '1px dashed #7c3aed',
                        background: '#f5f3ff',
                        color: '#7c3aed',
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6
                      }}
                    >
                      + Agregar Beneficio
                    </button>
                  </div>

                  {renderFontSelector(benefitsFont, 'benefits')}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569', fontWeight: 800, textTransform: 'uppercase' }}>
                      <span>Escala de Beneficios</span>
                      <span>{benefitsScale.toFixed(2)}x</span>
                    </div>
                    <input type="range" min="0.5" max="2.0" step="0.05" value={benefitsScale} onChange={e => setBenefitsScale(parseFloat(e.target.value))} style={{ width: '100%' }} />
                  </div>

                  {/* Selector de Figura / Icono de Viñetas */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                        Figura de Viñetas / Puntos
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#7c3aed' }}>
                        {bulletShape.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                      {[
                        { id: 'check', label: 'Check', icon: '✓' },
                        { id: 'dot', label: 'Punto', icon: '●' },
                        { id: 'circle', label: 'Círculo', icon: '○' },
                        { id: 'star', label: 'Estrella', icon: '★' },
                        { id: 'sparkle', label: 'Destello', icon: '✨' },
                        { id: 'arrow', label: 'Flecha', icon: '➔' },
                        { id: 'zap', label: 'Rayo', icon: '⚡' },
                        { id: 'diamond', label: 'Rombo', icon: '◆' },
                        { id: 'fire', label: 'Fuego', icon: '🔥' },
                        { id: 'number', label: '1, 2, 3', icon: '1.' },
                      ].map(shape => {
                        const isSelected = bulletShape === shape.id;
                        return (
                          <button
                            key={shape.id}
                            type="button"
                            onClick={() => setBulletShape(shape.id)}
                            style={{
                              padding: '6px 4px',
                              borderRadius: 8,
                              border: isSelected ? '1.5px solid #7c3aed' : '1px solid #cbd5e1',
                              background: isSelected ? '#f5f3ff' : '#fff',
                              color: isSelected ? '#6b21a8' : '#334155',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 2,
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <span style={{ fontSize: 14, fontWeight: 900, lineHeight: 1 }}>{shape.icon}</span>
                            <span style={{ fontSize: 8, fontWeight: 700 }}>{shape.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selector y Swatches de Color de Viñetas */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                      Color de Viñetas / Puntos
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input 
                        type="color" 
                        value={benefitsColor || '#38bdf8'} 
                        onChange={e => setBenefitsColor(e.target.value)} 
                        style={{ width: 36, height: 36, padding: 0, border: '1px solid #d8dde6', cursor: 'pointer', borderRadius: 6, flexShrink: 0 }} 
                      />
                      <input 
                        type="text" 
                        value={benefitsColor} 
                        onChange={e => setBenefitsColor(e.target.value)} 
                        placeholder="#38bdf8"
                        style={css.input} 
                      />
                    </div>
                    {/* Swatches rápidos para los puntos */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                      {[
                        { color: colors[0] || '#06c7d9', label: 'Branding' },
                        { color: '#06c7d9', label: 'Cyan' },
                        { color: '#f59e0b', label: 'Dorado' },
                        { color: '#10b981', label: 'Verde' },
                        { color: '#8b5cf6', label: 'Morado' },
                        { color: '#ffffff', label: 'Blanco' },
                        { color: '#ef4444', label: 'Rojo' },
                        { color: '#38bdf8', label: 'Azul Cielo' }
                      ].map(sw => (
                        <button
                          key={sw.label}
                          type="button"
                          onClick={() => setBenefitsColor(sw.color)}
                          style={{
                            flex: 1, minWidth: 28, height: 24, borderRadius: 5, background: sw.color,
                            border: benefitsColor === sw.color ? '2px solid #7c3aed' : '1px solid rgba(0,0,0,0.15)',
                            boxShadow: benefitsColor === sw.color ? '0 0 0 2px #7c3aed' : 'none',
                            cursor: 'pointer'
                          }}
                          title={sw.label}
                        />
                      ))}
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
                  {/* Interruptor de Visibilidad del Botón CTA */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: (showCta && cta.trim() !== '') ? '#f0fdf4' : '#f8fafc', border: `1.5px solid ${(showCta && cta.trim() !== '') ? '#86efac' : '#cbd5e1'}`, borderRadius: 10 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: (showCta && cta.trim() !== '') ? '#15803d' : '#64748b' }}>
                        {(showCta && cta.trim() !== '') ? '✓ Botón CTA Visible' : '✕ Botón CTA Oculto (Opcional)'}
                      </div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>
                        {(showCta && cta.trim() !== '') ? 'El botón de llamado a la acción se muestra' : 'El flyer no mostrará botón si lo apagas o borras'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCta(!showCta)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                        border: 'none',
                        background: showCta ? '#16a34a' : '#94a3b8',
                        color: '#fff',
                        transition: '0.15s'
                      }}
                    >
                      {showCta ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Texto del Botón CTA</span>
                      {cta && (
                        <button
                          type="button"
                          onClick={() => { setCta(''); setKeepCustomText(true); }}
                          style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                        >
                          Borrar texto (Ocultar)
                        </button>
                      )}
                    </div>
                    <input 
                      style={css.input} 
                      value={cta} 
                      onChange={e => {
                        setCta(e.target.value);
                        setKeepCustomText(true);
                      }}
                      placeholder="Dejar vacío si no deseas botón"
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
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Nombre de Marca / Empresa</span>
                    <input 
                      style={css.input} 
                      type="text" 
                      value={companyName} 
                      onChange={e => setCompanyName(e.target.value)}
                      placeholder="Nombre de tu marca o empresa"
                    />
                  </div>

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
                  {/* Mode switch */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Tipo de Fondo</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, background: '#f1f5f9', padding: 4, borderRadius: 8 }}>
                      <button
                        type="button"
                        onClick={() => { setBgMode('gradient'); setSelectedTemplate('vibrant-gradient'); }}
                        style={{
                          padding: '8px 10px', borderRadius: 6, border: 'none',
                          background: bgMode === 'gradient' ? '#7c3aed' : 'transparent',
                          color: bgMode === 'gradient' ? '#fff' : '#64748b',
                          fontSize: 11, fontWeight: 800, cursor: 'pointer'
                        }}
                      >
                        🎨 Degradado (2 o 3 Colores)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBgMode('photo')}
                        style={{
                          padding: '8px 10px', borderRadius: 6, border: 'none',
                          background: bgMode === 'photo' ? '#7c3aed' : 'transparent',
                          color: bgMode === 'photo' ? '#fff' : '#64748b',
                          fontSize: 11, fontWeight: 800, cursor: 'pointer'
                        }}
                      >
                        📷 Foto de Fondo
                      </button>
                    </div>
                  </div>

                  {/* Nivel de Oscuridad / Aclarar fondo */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Nivel de Oscuridad</span>
                      <span style={{ fontSize: 11, fontWeight: 900, color: bgOverlayOpacity === 0 ? '#10b981' : '#6366f1' }}>
                        {bgOverlayOpacity === 0 ? '0% (100% Claro / Sin Oscuridad)' : `${Math.round(bgOverlayOpacity * 100)}%`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={bgOverlayOpacity}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setBgOverlayOpacity(val);
                        setBgOverlayEnabled(val > 0);
                      }}
                      style={{ width: '100%', accentColor: '#6366f1' }}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
                      {[
                        { label: '☀️ 0% Claro', val: 0 },
                        { label: '🌤️ 20% Suave', val: 0.2 },
                        { label: '⛅ 45% Medio', val: 0.45 },
                        { label: '🌑 75% Oscuro', val: 0.75 },
                      ].map(p => (
                        <button
                          key={p.val}
                          type="button"
                          onClick={() => {
                            setBgOverlayOpacity(p.val);
                            setBgOverlayEnabled(p.val > 0);
                          }}
                          style={{
                            padding: '4px 2px', fontSize: 9, fontWeight: 800, borderRadius: 5,
                            border: Math.abs(bgOverlayOpacity - p.val) < 0.05 ? '1.5px solid #6366f1' : '1px solid #cbd5e1',
                            background: Math.abs(bgOverlayOpacity - p.val) < 0.05 ? '#ede9fe' : '#f8fafc',
                            color: Math.abs(bgOverlayOpacity - p.val) < 0.05 ? '#6366f1' : '#64748b',
                            cursor: 'pointer'
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

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
      <FormatSelectionModal
        isOpen={isFormatModalOpen}
        onClose={() => setIsFormatModalOpen(false)}
        format={format}
        onSelectFormat={setFormat}
      />

      {/* ── TONE SELECTION MODAL ──────────────────────────────────────── */}
      <ToneSelectionModal
        isOpen={isToneModalOpen}
        onClose={() => setIsToneModalOpen(false)}
        tone={tone}
        onSelectTone={setTone}
      />

      {/* ── BRAND COLOR PICKER MODAL ──────────────────────────────────── */}
      <BrandColorPickerModal
        isOpen={isColorModalOpen}
        onClose={() => setIsColorModalOpen(false)}
        customHex={customHex}
        onChangeCustomHex={setCustomHex}
        onApplyColor={toggleColor}
      />

      {/* ── TEMPLATE CATALOG SELECTION MODAL ──────────────────────────── */}
      <TemplateCatalogModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        canvasH={canvasH}
        selectedTemplate={selectedTemplate}
        onSelectTemplate={(templateId) => {
          setSelectedTemplate(templateId);
          setPreviewMode('template');
          setShowFullAiResult(false);
          setIsTemplateModalOpen(false);
          if (templateId === 'vibrant-gradient') {
            setBgMode('gradient');
            toast.success('🎨 Modo Degradado Puro Activado');
          } else {
            setBgMode('photo');
            toast.success('📷 Modo Foto Editorial Activado');
          }
        }}
        bgPhotoUrl={bgUploadPreview || (variants.length > 0 ? variants[selected] : null) || DEFAULT_BG_IMAGE}
        previewBaseData={{
          title: manualTitle || 'TU OFERTA',
          subtitle: manualSubtitle || '¡Aprovecha esta increíble oportunidad hoy mismo!',
          cta: cta || 'CONTACTAR AHORA',
          beneficios:
            manualFeatures.filter((f) => f.trim() !== '').length > 0
              ? manualFeatures.filter((f) => f.trim() !== '')
              : ['✓ Garantía por Escrito', '✓ Soporte Técnico 24/7', '✓ Profesionales Expertos', '✓ Cobertura Inmediata'],
          accent: colors[0] || '#0070d2',
          logoUrl: logoPreview || null,
          industria: companyName || 'Mi Empresa',
          companyName,
          phone,
          website,
          gradientBg: selectedGradient,
          bgOverlayOpacity: bgOverlayEnabled && bgOverlayOpacity > 0 ? bgOverlayOpacity : 0,
          badgeTextTop: badgeTop,
          badgeTextBottom: badgeBottom,
          containerW: 1080,
          containerH: canvasH,
          logoSize,
          logoX,
          logoY,
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
          titleX,
          subtitleX,
          benefitsX,
          ctaX,
          contactX,
          contactColor,
        }}
      />

      {/* ── FREE PHOTO SELECTOR MODAL ──────────────────────────────────────── */}
      <FreePhotoSelectorModal
        isOpen={isFreePhotoModalOpen}
        onClose={() => setIsFreePhotoModalOpen(false)}
        photosPool={freePhotosPool}
        photoIndex={freePhotoIndex}
        onChangePhotoIndex={setFreePhotoIndex}
        onApplyPhoto={handleSelectFreePhoto}
      />

      {/* ── SAVE FLYER MODAL ────────────────────────────────────────────────── */}
      <SaveFlyerModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        designName={newDesignName}
        onChangeDesignName={setNewDesignName}
        loadedFlyerId={loadedFlyerId}
        savingFlyer={savingFlyer}
        onSaveFlyer={handleSaveFlyer}
      />

      {/* ── GALLERY MODAL ("MIS DISEÑOS") ────────────────────────────────────── */}
      <FlyerGalleryModal
        isOpen={isGalleryModalOpen}
        onClose={() => setIsGalleryModalOpen(false)}
        loading={loadingSavedFlyers}
        savedFlyers={savedFlyers}
        editingFlyerId={editingFlyerId}
        editingFlyerName={editingFlyerName}
        onStartRename={(id, name) => {
          setEditingFlyerId(id);
          setEditingFlyerName(name);
        }}
        onChangeEditingName={setEditingFlyerName}
        onCancelRename={() => setEditingFlyerId(null)}
        onConfirmRename={handleRenameFlyer}
        onLoadFlyer={handleLoadFlyer}
        onDeleteFlyer={handleDeleteFlyer}
      />

      {/* ── AIDA METHODOLOGY MODAL ────────────────────────────────────── */}
      <AidaMethodologyModal
        isOpen={isAidaModalOpen}
        onClose={() => setIsAidaModalOpen(false)}
      />
    </div>
  );
}
