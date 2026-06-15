// FlyerTemplates.tsx — Professional HTML flyer templates
// These render pixel-perfect marketing flyers identical to Salesforce/Stripe quality
// Captured to PNG using html-to-image library

import React from 'react';
import { renderTitleWithHighlights } from '../../pages/marketing/FlyerTemplates';

export interface FlyerData {
  company_name: string;
  headline?: string;
  subheadline?: string;
  prompt: string;
  cta: string;
  price?: string;
  phone?: string;
  email?: string;
  website?: string;
  features?: string[];
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
  tone?: string;
  bgImageUrl?: string;
  highlight_title?: string;
  highlight_desc?: string;
  benefits?: { title: string; desc: string; icon: string }[];
  mockup_info?: {
    title: string;
    kpis: { label: string; val: string; change?: string }[];
  };
  flyerFont?: string;
  textScale?: number;
  subtitleScale?: number;
  benefitsScale?: number;
  logoSize?: number;
  logoX?: number;
  logoY?: number;
  highlightColor?: string;
  containerW?: number;
  containerH?: number;
  titleColor?: string;
  subtitleColor?: string;
  benefitsColor?: string;
  cardBgColor?: string;
  ctaBgColor?: string;
  ctaTextColor?: string;
  textY?: number;
  textAlign?: 'left' | 'center' | 'right';
  onTitleClick?: () => void;
  onSubtitleClick?: () => void;
  onBenefitsClick?: () => void;
  onCtaClick?: () => void;
  onLogoClick?: () => void;
  onBgClick?: () => void;
  subtitleBold?: boolean;
  benefitsBold?: boolean;
  titleScale?: number;
  titleX?: number;
  titleY?: number;
  subtitleX?: number;
  subtitleY?: number;
  benefitsX?: number;
  benefitsY?: number;
  ctaScale?: number;
  ctaX?: number;
  ctaY?: number;
  contactScale?: number;
  contactX?: number;
  contactY?: number;
  contactColor?: string;
  textX?: number;
  onContactClick?: () => void;
  titleFont?: string;
  subtitleFont?: string;
  benefitsFont?: string;
  ctaFont?: string;
  contactFont?: string;
}

export const getFontFamily = (f?: string) =>
  f && f !== 'Outfit' ? `'${f}','Outfit','Inter',sans-serif` : "'Outfit','Inter',sans-serif";

// ── Utility: clean phrases from bullet points or numbers ──────────────────────
function cleanPhrase(text: string): string {
  return text
    .replace(/^[-*•+\s\d.]+\s*/, '') // Remove bullet points or numbers at start
    .replace(/[;.,—:|]+$/, '')        // Remove trailing punctuation
    .trim();
}

export interface ParsedPrompt {
  title?: string;
  subtitle?: string;
  features?: string[];
  price?: string;
  cta?: string;
  phone?: string;
  website?: string;
}

export function parsePrompt(prompt: string): ParsedPrompt {
  if (!prompt) return {};

  const tags = [
    { key: 'title', regex: /(?:t[íi]tulo(?: principal| del flyer)?|headline)\s*[:：]/i },
    { key: 'subtitle', regex: /(?:subt[íi]tulo(?: del flyer)?|sub-headline|bajada)\s*[:：]/i },
    { key: 'features', regex: /(?:incluye|ofrece|beneficios|caracter[íi]sticas|servicios|lleva|contiene)\s*[:：]/i },
    { key: 'price', regex: /(?:precio|costo|desde|price|valor)\s*[:：]/i },
    { key: 'cta', regex: /(?:cta|bot[oó]n|llamada a la acci[oó]n|acci[oó]n|accion)\s*[:：]/i },
    { key: 'phone', regex: /(?:whatsapp|tel[eé]fono|contacto|celular|phone)\s*[:：]/i },
    { key: 'website', regex: /(?:sitio(?: web)?|web|p[aá]gina|link|url|website)\s*[:：]/i },
  ];

  const matches: { key: string; start: number; end: number }[] = [];
  for (const tag of tags) {
    const match = tag.regex.exec(prompt);
    if (match) {
      matches.push({
        key: tag.key,
        start: match.index,
        end: match.index + match[0].length
      });
    }
  }

  matches.sort((a, b) => a.start - b.start);

  const result: ParsedPrompt = {};

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const valStart = current.end;
    const valEnd = next ? next.start : prompt.length;
    let val = prompt.substring(valStart, valEnd).trim();
    
    val = val.replace(/^[:：\s,.-]+|[:：\s,.-]+$/g, '');

    if (current.key === 'title') result.title = val;
    else if (current.key === 'subtitle') result.subtitle = val;
    else if (current.key === 'price') result.price = val;
    else if (current.key === 'cta') result.cta = val;
    else if (current.key === 'phone') result.phone = val;
    else if (current.key === 'website') result.website = val;
    else if (current.key === 'features') {
      result.features = val
        .split(/[,;\n]|y\s+/)
        .map(item => item.trim().replace(/^[:：\s,.-]+|[:：\s,.-]+$/g, ''))
        .filter(item => item.length > 2);
    }
  }

  return result;
}

export function deriveHeadline(prompt: string, company: string): { h1: string; h2: string } {
  if (!prompt || !prompt.trim()) {
    return { h1: 'Diseño Profesional', h2: company };
  }

  // 1. Look for explicit tags like Título/Subtítulo or Headline/Subheadline. Allow punctuation within tags.
  const titleMatch = prompt.match(/(?:t[íi]tulo|headline|t[íi]tulo del flyer|t[íi]tulo principal)\s*[:：]\s*([^\n|]+)/i);
  const subMatch = prompt.match(/(?:subt[íi]tulo|subheadline|descripci[oó]n corta)\s*[:：]\s*([^\n|]+)/i);

  let h1 = '';
  let h2 = '';

  if (titleMatch && titleMatch[1]) {
    h1 = cleanPhrase(titleMatch[1]);
  }
  if (subMatch && subMatch[1]) {
    h2 = cleanPhrase(subMatch[1]);
  }

  if (h1 && h2) return { h1, h2 };

  // Connectors helper for smart splitting in Spanish
  const isConnector = (word: string) => {
    const w = word.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return ['para', 'con', 'de', 'y', 'en', 'o', 'a', 'que', 'como', 'sin', 'sobre', 'del', 'al', 'por', 'desde', 'e', 'u'].includes(w);
  };

  // 2. Look for splitters like newlines
  const lines = prompt.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0);
  if (!h1 && lines.length > 0) {
    const firstLine = lines[0];
    const firstLineWords = firstLine.split(/\s+/);
    
    if (firstLineWords.length <= 14) {
      // If the first line is reasonably short (<= 14 words), keep it entirely as h1
      h1 = cleanPhrase(firstLine);
      if (!h2 && lines.length > 1) {
        h2 = cleanPhrase(lines[1]);
      }
    } else {
      // If the first line is long (> 14 words), split it dynamically using connectors
      let splitIdx = -1;
      // Search for a connector to split before, ideally between word 4 and 9
      for (let i = 4; i <= 9 && i < firstLineWords.length; i++) {
        if (isConnector(firstLineWords[i])) {
          splitIdx = i;
          break;
        }
      }
      
      if (splitIdx !== -1) {
        h1 = cleanPhrase(firstLineWords.slice(0, splitIdx).join(' '));
        if (!h2) {
          h2 = cleanPhrase(firstLineWords.slice(splitIdx).join(' '));
        }
      } else {
        // Fallback split in the middle (between 6 and 8 words)
        const mid = Math.min(8, Math.max(5, Math.floor(firstLineWords.length / 2)));
        h1 = cleanPhrase(firstLineWords.slice(0, mid).join(' '));
        if (!h2) {
          h2 = cleanPhrase(firstLineWords.slice(mid).join(' '));
        }
      }
    }
  }

  // 3. Look for dashes or bullets as separators if h1 is still empty
  if (!h1) {
    const parts = prompt.split(/[—|•]|\s{2,}/);
    if (parts.length > 1) {
      const firstPartWords = parts[0].trim().split(/\s+/);
      if (firstPartWords.length <= 14) {
        h1 = cleanPhrase(parts[0]);
        if (!h2) {
          h2 = cleanPhrase(parts[1]);
        }
      }
    }
  }

  // 4. Fallbacks if h1 is still empty
  if (!h1) {
    const words = prompt.trim().split(/\s+/);
    if (words.length <= 12) {
      h1 = cleanPhrase(prompt);
    } else {
      // Try to find a connector to split on
      let splitIdx = -1;
      for (let i = 4; i <= 9 && i < words.length; i++) {
        if (isConnector(words[i])) {
          splitIdx = i;
          break;
        }
      }
      if (splitIdx !== -1) {
        h1 = cleanPhrase(words.slice(0, splitIdx).join(' '));
        if (!h2) {
          h2 = cleanPhrase(words.slice(splitIdx).join(' '));
        }
      } else {
        h1 = cleanPhrase(words.slice(0, 8).join(' '));
      }
    }
  }

  // Fallback for h2 if still empty
  if (!h2) {
    const words = prompt.trim().split(/\s+/);
    const h1WordsCount = h1.split(/\s+/).length;
    if (words.length > h1WordsCount) {
      h2 = cleanPhrase(words.slice(h1WordsCount, h1WordsCount + 12).join(' '));
    } else {
      h2 = `${company} — Innovación a tu alcance`;
    }
  }

  // Capitalize first letter of each sentence
  if (h1.length > 0) h1 = h1.charAt(0).toUpperCase() + h1.slice(1);
  if (h2.length > 0) h2 = h2.charAt(0).toUpperCase() + h2.slice(1);

  return { h1, h2 };
}

export function deriveFeatures(prompt: string): string[] {
  if (!prompt || !prompt.trim()) return [];

  const features: string[] = [];

  // 1. Try to find bullet points or list items
  const listMatches = prompt.matchAll(/(?:[-*•+]|\b\d\.)\s*([^\n,;•-]+)/g);
  for (const match of listMatches) {
    const val = cleanPhrase(match[1]);
    if (val.length > 3 && val.length < 35 && !features.includes(val)) {
      features.push(val);
    }
  }

  // 2. Try to find comma-separated items after list indicators
  if (features.length < 3) {
    const listMatch = prompt.match(/(?:incluye|ofrece|beneficios|caracter[íi]sticas|servicios|lleva|contiene)\s*[:：]?\s*([^.\n]+)/i);
    if (listMatch && listMatch[1]) {
      const items = listMatch[1].split(/[,;]|y\s+/).map(i => cleanPhrase(i)).filter(i => i.length > 3 && i.length < 35);
      items.forEach(item => {
        if (!features.includes(item) && features.length < 4) {
          features.push(item);
        }
      });
    }
  }

  // 3. Fallback to keyword search in prompt
  const lower = prompt.toLowerCase();
  if (lower.includes('factur') && !features.includes('Facturación Electrónica')) {
    features.push('Facturación Electrónica');
  }
  if ((lower.includes('inventario') || lower.includes('bodega') || lower.includes('compras')) && !features.includes('Inventario y Bodega')) {
    features.push('Inventario y Bodega');
  }
  if ((lower.includes('venta') || lower.includes('cliente') || lower.includes('crm')) && !features.includes('Control de Clientes')) {
    features.push('Control de Clientes');
  }
  if ((lower.includes('reporte') || lower.includes('analítica') || lower.includes('dashboard') || lower.includes('métrica')) && !features.includes('Reportes en Tiempo Real')) {
    features.push('Reportes en Tiempo Real');
  }
  if ((lower.includes('hacienda') || lower.includes('dte') || lower.includes('mh')) && !features.includes('100% Cumple con MH')) {
    features.push('100% Cumple con MH');
  }
  if ((lower.includes('soporte') || lower.includes('ayuda') || lower.includes('atencion')) && !features.includes('Soporte Premium 24/7')) {
    features.push('Soporte Premium 24/7');
  }
  if ((lower.includes('nube') || lower.includes('cloud') || lower.includes('web')) && !features.includes('Acceso en la Nube')) {
    features.push('Acceso en la Nube');
  }
  if ((lower.includes('seguridad') || lower.includes('seguro') || lower.includes('respaldo')) && !features.includes('Seguridad Garantizada')) {
    features.push('Seguridad Garantizada');
  }

  // 4. Fill to 3 features with default high-quality items if empty
  while (features.length < 3) {
    const defaults = ['Fácil de Configurar', 'Seguridad Garantizada', 'Acceso en la Nube', 'Soporte 24/7'];
    const next = defaults.find(d => !features.includes(d));
    if (next) features.push(next); else break;
  }

  return features.slice(0, 3); // Max 3 features looks best on our layouts
}

export function derivePrice(prompt: string): string {
  const match = prompt.match(/\$[d\d,.]+/);
  if (match) return match[0];
  const match2 = prompt.match(/([\d,.]+)\s*(d[oó]lar|d[oó]lares|dollar|usd)/i);
  if (match2) return '$' + match2[1];
  return ''; 
}

function derivePhone(prompt: string, defaultPhone?: string): string {
  const match = prompt.match(/(?:📱|whatsapp|tel|tel[eé]fono|celular|cel|llama al|contacto:)\s*[:：]?\s*(\+?[\d\s()-]{8,18}\b)/i);
  if (match) {
    const clean = match[1].trim();
    const digits = clean.replace(/\D/g, '');
    if (digits.length >= 7) return clean;
  }
  return defaultPhone || '';
}

function deriveWebsite(prompt: string, defaultWebsite?: string): string {
  const match = prompt.match(/(?:🌐|sitio|web|visita|url:|link:|www\.)\s*[:：]?\s*(\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]{2,}\b)/i);
  if (match) {
    const clean = match[1].trim().toLowerCase();
    if (!clean.includes('hacienda.gob') && !clean.includes('mh.gob') && clean.length > 4) {
      return clean;
    }
  }
  return defaultWebsite || '';
}

export function deriveCta(prompt: string, defaultCta?: string): string {
  const match = prompt.match(/(?:cta|bot[oó]n|llamado a la acci[oó]n|acci[oó]n)\s*[:：]\s*([^\n|;.-]+)/i);
  if (match && match[1]) {
    return cleanPhrase(match[1]);
  }
  return defaultCta || 'CONTACTAR AHORA';
}

export interface IndustryContent {
  highlight_title: string;
  highlight_desc: string;
  benefits: { title: string; desc: string; icon: string }[];
  mockup_title: string;
  kpis: { label: string; val: string; change?: string }[];
}

export function deriveIndustryContent(prompt: string, data: Partial<FlyerData>): IndustryContent {
  const lower = (prompt || '').toLowerCase();
  
  if (lower.includes('perro') || lower.includes('canin') || lower.includes('mascota') || lower.includes('adiestra') || lower.includes('k9')) {
    return {
      highlight_title: data.highlight_title || '¿Quieres el mejor adiestramiento canino?',
      highlight_desc: data.highlight_desc || 'Programas personalizados para obediencia, socialización y defensa.',
      benefits: data.benefits && data.benefits.length >= 3 ? data.benefits : [
        { title: 'Conducta Canina', desc: 'Soluciona problemas de comportamiento y agresión.', icon: '🐕' },
        { title: 'Entrenadores Pro', desc: 'Instructores certificados con amplia experiencia.', icon: '🎓' },
        { title: 'Resultados Reales', desc: 'Adiestramiento garantizado para todas las razas.', icon: '✅' }
      ],
      mockup_title: data.mockup_info?.title || 'Registro K9',
      kpis: data.mockup_info?.kpis && data.mockup_info.kpis.length >= 4 ? data.mockup_info.kpis : [
        { label: 'Perros', val: '180+' },
        { label: 'Clases', val: '1,240' },
        { label: 'Eficacia', val: '99.4%' },
        { label: 'Calificación', val: '5.0 ★' }
      ]
    };
  }
  
  if (lower.includes('pizz') || lower.includes('hamburgue') || lower.includes('taco') || lower.includes('comida') || lower.includes('restauran') || lower.includes('sabor') || lower.includes('chef') || lower.includes('cocin')) {
    return {
      highlight_title: data.highlight_title || '¿Listo para probar el mejor sabor?',
      highlight_desc: data.highlight_desc || 'Ingredientes seleccionados, recetas originales y el mejor ambiente para ti.',
      benefits: data.benefits && data.benefits.length >= 3 ? data.benefits : [
        { title: 'Sabor Único', desc: 'Recetas artesanales preparadas con pasión.', icon: '🍕' },
        { title: 'Servicio Rápido', desc: 'Directo a tu mesa o entrega a domicilio.', icon: '⚡' },
        { title: 'Ingredientes Frescos', desc: 'La mejor calidad en cada bocado.', icon: '🍅' }
      ],
      mockup_title: data.mockup_info?.title || 'Menú Digital',
      kpis: data.mockup_info?.kpis && data.mockup_info.kpis.length >= 4 ? data.mockup_info.kpis : [
        { label: 'Pedidos', val: '2,450' },
        { label: 'Valoraciones', val: '4.8 ★' },
        { label: 'Entregas', val: '99.2%' },
        { label: 'Especiales', val: '12' }
      ]
    };
  }
  
  if (lower.includes('segurid') || lower.includes('guardia') || lower.includes('vigilan') || lower.includes('patrulla') || lower.includes('defens')) {
    return {
      highlight_title: data.highlight_title || '¿Buscas la máxima seguridad?',
      highlight_desc: data.highlight_desc || 'Sistemas de protección, guardias entrenados y monitoreo permanente.',
      benefits: data.benefits && data.benefits.length >= 3 ? data.benefits : [
        { title: 'Vigilancia 24/7', desc: 'Monitoreo constante y respuesta inmediata.', icon: '🚨' },
        { title: 'Guardias Expertos', desc: 'Personal altamente calificado y evaluado.', icon: '👮' },
        { title: 'Control Total', desc: 'Sistemas avanzados para proteger lo tuyo.', icon: '🔒' }
      ],
      mockup_title: data.mockup_info?.title || 'Centro de Mando',
      kpis: data.mockup_info?.kpis && data.mockup_info.kpis.length >= 4 ? data.mockup_info.kpis : [
        { label: 'Cámaras', val: '32' },
        { label: 'Guardias', val: '18' },
        { label: 'Alarmas', val: 'Activa' },
        { label: 'Respuesta', val: '< 3 min' }
      ]
    };
  }
  
  if (lower.includes('dent') || lower.includes('odont') || lower.includes('dient') || lower.includes('sonris') || lower.includes('ortodon')) {
    return {
      highlight_title: data.highlight_title || '¿Quieres la sonrisa de tus sueños?',
      highlight_desc: data.highlight_desc || 'Tratamientos dentales avanzados para toda tu familia con especialistas.',
      benefits: data.benefits && data.benefits.length >= 3 ? data.benefits : [
        { title: 'Odontólogos Pro', desc: 'Profesionales con amplia experiencia.', icon: '🦷' },
        { title: 'Tecnología 3D', desc: 'Diagnósticos precisos y sin dolor.', icon: '🔬' },
        { title: 'Planes Flexibles', desc: 'Financiamiento a tu medida para todo tratamiento.', icon: '💳' }
      ],
      mockup_title: data.mockup_info?.title || 'Historial Clínico',
      kpis: data.mockup_info?.kpis && data.mockup_info.kpis.length >= 4 ? data.mockup_info.kpis : [
        { label: 'Pacientes', val: '1,520' },
        { label: 'Clínicas', val: '2' },
        { label: 'Citas Mes', val: '340' },
        { label: 'Opiniones', val: '4.9 ★' }
      ]
    };
  }
  
  return {
    highlight_title: data.highlight_title || '¿Quieres automatizar tu negocio y vender más?',
    highlight_desc: data.highlight_desc || 'Aumenta la productividad de tu equipo con herramientas inteligentes y control de leads.',
    benefits: data.benefits && data.benefits.length >= 3 ? data.benefits : [
      { title: 'Eficiencia', desc: 'Automatiza tareas repetitivas y ahorra tiempo.', icon: '⚡' },
      { title: 'Control Total', desc: 'Gestiona tus clientes y ventas en un solo lugar.', icon: '👥' },
      { title: 'Crecimiento', desc: 'Incrementa tus conversiones con seguimiento inteligente.', icon: '📈' }
    ],
    mockup_title: data.mockup_info?.title || 'Control de Leads',
    kpis: data.mockup_info?.kpis && data.mockup_info.kpis.length >= 4 ? data.mockup_info.kpis : [
      { label: 'Leads Nuevos', val: '240+' },
      { label: 'Conversión', val: '18.4%' },
      { label: 'Atención', val: '< 2 min' },
      { label: 'Satisfacción', val: '4.9 ★' }
    ]
  };
}

export function getFeatureIcon(f: string): string {
  const lower = f.toLowerCase();
  if (lower.includes('factur') || lower.includes('dte')) return '📄';
  if (lower.includes('inventario') || lower.includes('bodega') || lower.includes('stock')) return '📦';
  if (lower.includes('client') || lower.includes('crm') || lower.includes('lead')) return '👥';
  if (lower.includes('report') || lower.includes('analit') || lower.includes('dashboard') || lower.includes('métrica')) return '📊';
  if (lower.includes('hacienda') || lower.includes('mh') || lower.includes('cumple')) return '✅';
  if (lower.includes('soporte') || lower.includes('24/7') || lower.includes('atencion')) return '🛠️';
  if (lower.includes('nube') || lower.includes('cloud') || lower.includes('web')) return '☁️';
  if (lower.includes('segur') || lower.includes('segundo') || lower.includes('respaldo')) return '🔒';
  if (lower.includes('configur') || lower.includes('rapido') || lower.includes('fácil') || lower.includes('facil')) return '⚡';
  return '✨';
}

export function renderApiGearsIcon(color: string): React.ReactNode {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function renderDataChartsIcon(color: string): React.ReactNode {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

export function renderUserNetworkIcon(color: string): React.ReactNode {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function renderCloudIcon(color: string): React.ReactNode {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 19A3.5 3.5 0 0 0 21 15.5c0-2.79-2.54-4.5-5-4.5-.42-1.89-1.92-3.5-4-3.5a4.34 4.34 0 0 0-4.1 3.5c-2.42 0-4.4 1.91-4.4 4.25A4.26 4.26 0 0 0 7 19z" />
    </svg>
  );
}

export function renderLockIcon(color: string): React.ReactNode {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function renderCreditCardIcon(color: string): React.ReactNode {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

export function renderSupportIcon(color: string): React.ReactNode {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

export function renderStarIcon(color: string): React.ReactNode {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export interface FeatureBulletData {
  title: string;
  bullets: string[];
  icon: React.ReactNode;
}

export function getFeatureBullets(f: string, prompt: string, color: string): FeatureBulletData {
  const lower = (f || '').toLowerCase();
  
  if (lower.includes('factur') || lower.includes('dte') || lower.includes('mh') || lower.includes('cumple')) {
    return {
      title: 'Facturación Inteligente',
      bullets: [
        'Emisión de DTEs en segundos',
        'Validación directa ante Hacienda',
        'Envío automático a clientes'
      ],
      icon: renderCreditCardIcon(color)
    };
  }
  
  if (lower.includes('inventario') || lower.includes('bodega') || lower.includes('stock')) {
    return {
      title: 'Control de Inventario',
      bullets: [
        'Stock sincronizado en tiempo real',
        'Alertas de stock mínimo y órdenes',
        'Trazabilidad total de almacén'
      ],
      icon: renderCloudIcon(color)
    };
  }
  
  if (lower.includes('client') || lower.includes('crm') || lower.includes('lead') || lower.includes('contacto') || lower.includes('convers')) {
    return {
      title: 'Gestión de Clientes (CRM)',
      bullets: [
        'Historial unificado de contactos',
        'Segmentación inteligente de leads',
        'Seguimiento automático de embudos'
      ],
      icon: renderUserNetworkIcon(color)
    };
  }
  
  if (lower.includes('report') || lower.includes('analit') || lower.includes('dashboard') || lower.includes('métrica') || lower.includes('gráfico')) {
    return {
      title: 'Analíticas Avanzadas',
      bullets: [
        'Métricas clave del negocio en vivo',
        'Reportes exportables al instante',
        'Monitoreo de metas de ventas'
      ],
      icon: renderDataChartsIcon(color)
    };
  }
  
  if (lower.includes('automat') || lower.includes('bot') || lower.includes('asistente') || lower.includes('inteligencia') || lower.includes('configur') || lower.includes('rapido') || lower.includes('fácil') || lower.includes('facil')) {
    return {
      title: 'Automatización & AI Bots',
      bullets: [
        'Calificación de leads 24/7 en vivo',
        'Respuestas inmediatas sin esperas',
        'Integración directa con WhatsApp'
      ],
      icon: renderApiGearsIcon(color)
    };
  }
  
  if (lower.includes('segur') || lower.includes('segundo') || lower.includes('respaldo') || lower.includes('cifrado')) {
    return {
      title: 'Seguridad Grado Enterprise',
      bullets: [
        'Encriptación SSL / HTTPS activa',
        'Respaldos automáticos en la nube',
        'Cumplimiento HIPAA / GDPR estricto'
      ],
      icon: renderLockIcon(color)
    };
  }
  
  if (lower.includes('nube') || lower.includes('cloud') || lower.includes('web') || lower.includes('acceso')) {
    return {
      title: 'Acceso Cloud Multiplataforma',
      bullets: [
        'Disponible desde móvil o PC',
        'Sincronización instantánea',
        'Sin instalaciones ni servidores'
      ],
      icon: renderCloudIcon(color)
    };
  }
  
  if (lower.includes('soporte') || lower.includes('ayuda') || lower.includes('atencion') || lower.includes('24/7') || lower.includes('premium')) {
    return {
      title: 'Soporte Premium 24/7',
      bullets: [
        'Especialistas listos para ayudarte',
        'Tiempos de respuesta inmediatos',
        'Onboarding personalizado incluido'
      ],
      icon: renderSupportIcon(color)
    };
  }

  // Fallback depending on prompt industry
  const type = getIndustryType(prompt);
  if (type === 'k9') {
    return {
      title: f || 'Entrenamiento K9',
      bullets: [
        'Seguimiento diario por mascota',
        'Reportes de conducta y avance',
        'Alertas de vacunas y clases'
      ],
      icon: renderUserNetworkIcon(color)
    };
  } else if (type === 'food') {
    return {
      title: f || 'Gastronomía y Delivery',
      bullets: [
        'Comandas directas en tiempo real',
        'Control y despacho de delivery',
        'Menú digital QR autogestionable'
      ],
      icon: renderApiGearsIcon(color)
    };
  } else if (type === 'security') {
    return {
      title: f || 'Vigilancia y Protección',
      bullets: [
        'Monitoreo activo perimetral',
        'Envío inmediato de unidades K9',
        'Reportes encriptados en la nube'
      ],
      icon: renderLockIcon(color)
    };
  } else if (type === 'dental') {
    return {
      title: f || 'Historial Clínico Dental',
      bullets: [
        'Odontograma y citas digitales',
        'Fichas con radiografías 3D',
        'Confirmación por WhatsApp'
      ],
      icon: renderSupportIcon(color)
    };
  }

  return {
    title: f || 'Optimización SaaS CRM',
    bullets: [
      'Centraliza leads y contactos',
      'Flujos de venta automatizados',
      'Toma decisiones basadas en datos'
    ],
    icon: renderStarIcon(color)
  };
}

export function renderIsometricTechVisual(primary: string, secondary: string): React.ReactNode {
  return (
    <svg width="880" height="340" viewBox="0 0 880 340" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        {/* Soft dropshadow for glass panels */}
        <filter id="glassShadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="16" stdDeviation="20" floodColor="#0f172a" floodOpacity="0.1" />
        </filter>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="10" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        {/* Gradients */}
        <linearGradient id="glassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="glassBorder" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={primary} stopOpacity="0.8" />
          <stop offset="100%" stopColor={secondary} stopOpacity="0.2" />
        </linearGradient>
      </defs>

      {/* Ambient background glow center */}
      <circle cx="440" cy="170" r="160" fill={primary} opacity="0.06" style={{ filter: 'url(#glow)' }} />

      {/* Central Hub Node (Base) */}
      <ellipse cx="440" cy="170" rx="90" ry="45" fill="none" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" strokeDasharray="5,5" />
      <ellipse cx="440" cy="170" rx="140" ry="70" fill="none" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="1" />

      {/* Interconnecting synchronization flow lines */}
      {/* Connector left to center */}
      <path d="M 230 200 C 300 200, 360 170, 440 170" fill="none" stroke="url(#lineGrad)" strokeWidth="2" strokeDasharray="6,4" />
      {/* Connector center to right */}
      <path d="M 440 170 C 520 170, 580 140, 650 140" fill="none" stroke="url(#lineGrad)" strokeWidth="2" />
      {/* Connector top to center */}
      <path d="M 440 80 L 440 170" fill="none" stroke={primary} strokeWidth="1.5" strokeDasharray="4,4" opacity="0.5" />

      {/* Tilted Floating Panel 1 (Left - Database & Integration) */}
      <g filter="url(#glassShadow)">
        {/* Panel background */}
        <polygon points="120,130 260,90 260,230 120,270" fill="url(#glassGrad)" stroke="url(#glassBorder)" strokeWidth="1.5" />
        {/* Mini UI Details inside Panel 1 */}
        {/* Simulated data blocks */}
        <polygon points="140,150 200,133 200,153 140,170" fill={primary} opacity="0.15" />
        <polygon points="140,180 240,152 240,162 140,190" fill="rgba(15,23,42,0.1)" />
        <polygon points="140,200 220,177 220,187 140,210" fill="rgba(15,23,42,0.1)" />
        {/* Accent indicator */}
        <circle cx="230" cy="120" r="4" fill={primary} />
        <line x1="220" y1="123" x2="240" y2="117" stroke="rgba(15,23,42,0.2)" strokeWidth="2" />
      </g>

      {/* Tilted Floating Panel 2 (Center-Top - Flow Automation) */}
      <g filter="url(#glassShadow)">
        <polygon points="360,70 520,30 520,130 360,170" fill="url(#glassGrad)" stroke="url(#glassBorder)" strokeWidth="1.5" />
        {/* Nodes flow visual inside Panel 2 */}
        <circle cx="400" cy="120" r="5" fill={primary} />
        <circle cx="480" cy="70" r="5" fill={secondary} />
        <path d="M 400 120 L 480 70" stroke="rgba(15,23,42,0.15)" strokeWidth="2" />
        {/* Glass panel mini graph */}
        <path d="M 380 145 L 420 125 L 460 115 L 500 85" fill="none" stroke={primary} strokeWidth="2" />
        <circle cx="500" cy="85" r="3" fill={primary} />
      </g>

      {/* Tilted Floating Panel 3 (Right - Reporting & Analytics) */}
      <g filter="url(#glassShadow)">
        <polygon points="620,110 760,70 760,210 620,250" fill="url(#glassGrad)" stroke="url(#glassBorder)" strokeWidth="1.5" />
        {/* Bar chart inside Panel 3 */}
        {/* Bar 1 */}
        <polygon points="640,210 660,204 660,154 640,160" fill="rgba(15,23,42,0.1)" />
        {/* Bar 2 */}
        <polygon points="675,200 695,194 695,124 675,130" fill={primary} opacity="0.8" />
        {/* Bar 3 */}
        <polygon points="710,190 730,184 730,104 710,110" fill={secondary} opacity="0.8" />
      </g>

      {/* Foreground glowing connection nodes */}
      <circle cx="230" cy="200" r="6" fill={primary} style={{ filter: 'url(#glow)' }} />
      <circle cx="230" cy="200" r="3" fill="#ffffff" />

      <circle cx="440" cy="170" r="8" fill={secondary} style={{ filter: 'url(#glow)' }} />
      <circle cx="440" cy="170" r="4" fill="#ffffff" />

      <circle cx="650" cy="140" r="6" fill={primary} style={{ filter: 'url(#glow)' }} />
      <circle cx="650" cy="140" r="3" fill="#ffffff" />
    </svg>
  );
}


function getIndustryType(prompt: string): 'k9' | 'food' | 'security' | 'dental' | 'saas' {
  const lower = (prompt || '').toLowerCase();
  if (lower.includes('perro') || lower.includes('canin') || lower.includes('mascota') || lower.includes('adiestra') || lower.includes('k9')) {
    return 'k9';
  }
  if (lower.includes('pizz') || lower.includes('hamburgue') || lower.includes('taco') || lower.includes('comida') || lower.includes('restauran') || lower.includes('sabor') || lower.includes('chef') || lower.includes('cocin')) {
    return 'food';
  }
  if (lower.includes('segurid') || lower.includes('guardia') || lower.includes('vigilan') || lower.includes('patrulla') || lower.includes('defens')) {
    return 'security';
  }
  if (lower.includes('dent') || lower.includes('odont') || lower.includes('dient') || lower.includes('sonris') || lower.includes('ortodon')) {
    return 'dental';
  }
  return 'saas';
}

interface IndustryDetails {
  type: 'k9' | 'food' | 'security' | 'dental' | 'saas';
  tagline: string;
  kpis: { label: string; val: string; change: string }[];
  funnelStages: string[];
  chatbotGreeting: string;
  features: { title: string; desc: string }[];
  bottomFeatures: { title: string; desc: string }[];
}

function getIndustryData(prompt: string): IndustryDetails {
  const type = getIndustryType(prompt);
  
  if (type === 'k9') {
    return {
      type,
      tagline: 'CRM PARA CONTROL CANINO',
      kpis: [
        { label: 'Perros Totales', val: '180', change: '+12%' },
        { label: 'Clases Semanales', val: '320', change: '+8%' },
        { label: 'Evaluados Hoy', val: '14', change: '+25%' }
      ],
      funnelStages: ['Nuevos', 'Evaluados', 'Entrenando', 'Graduados', 'Activos'],
      chatbotGreeting: '¡Hola! 🐾 ¿Quieres agendar una evaluación de obediencia para tu mascota hoy?',
      features: [
        { title: 'Organiza y controla', desc: 'Centraliza expedientes de perros, vacunas y temperamento en un solo lugar.' },
        { title: 'Bot AI que atiende', desc: 'Nuestro asistente califica consultas de dueños 24/7 de manera automática.' },
        { title: 'Vendes sin parar', desc: 'Automatiza recordatorios de clases, vacunas y pagos por WhatsApp.' }
      ],
      bottomFeatures: [
        { title: 'Gestión K9', desc: 'Control por mascota.' },
        { title: 'Automatizaciones', desc: 'Alertas automáticas.' },
        { title: 'Integraciones', desc: 'WhatsApp & Calendarios.' },
        { title: 'Reportes en Vivo', desc: 'Estadísticas de avance.' },
        { title: 'Seguro y Confiable', desc: 'Datos protegidos.' }
      ]
    };
  }
  
  if (type === 'food') {
    return {
      type,
      tagline: 'CRM PARA RESTAURANTES Y DELIVERY',
      kpis: [
        { label: 'Pedidos Totales', val: '2,450', change: '+18%' },
        { label: 'Mesas Ocupadas', val: '32', change: '+10%' },
        { label: 'Clientes Nuevos', val: '98', change: '+20%' }
      ],
      funnelStages: ['Visitas', 'Pedidos', 'Preparando', 'En Camino', 'Entregado'],
      chatbotGreeting: '¡Hola! 🍕 ¿Deseas ordenar del menú especial o reservar tu mesa hoy?',
      features: [
        { title: 'Organiza y controla', desc: 'Gestiona órdenes de salón, llevar y delivery desde una sola pantalla.' },
        { title: 'Bot AI que atiende', desc: 'Toma comanda y responde preguntas frecuentes a tus comensales 24/7.' },
        { title: 'Vendes sin parar', desc: 'Automatiza ofertas personalizadas y notificaciones de envío al instante.' }
      ],
      bottomFeatures: [
        { title: 'Pedidos Pro', desc: 'Comandas digitales.' },
        { title: 'Automatizaciones', desc: 'Fideliza clientes.' },
        { title: 'Repartidores', desc: 'Control de entregas.' },
        { title: 'Caja Diaria', desc: 'Cuadre en vivo.' },
        { title: 'Menú QR', desc: 'Digital interactivo.' }
      ]
    };
  }
  
  if (type === 'security') {
    return {
      type,
      tagline: 'CRM PARA EMPRESAS DE SEGURIDAD',
      kpis: [
        { label: 'Sensores Activos', val: '1,250', change: '+5%' },
        { label: 'Cámaras Online', val: '320', change: '+12%' },
        { label: 'Incidentes Hoy', val: '0', change: 'Estable' }
      ],
      funnelStages: ['Alertas', 'Verificando', 'Despacho', 'Asegurado', 'Resuelto'],
      chatbotGreeting: '¡Hola! 🛡️ Centro de Mando Activo. ¿Quieres verificar el estado de tus alarmas?',
      features: [
        { title: 'Organiza y controla', desc: 'Registra incidencias de cámaras, guardias y bitácoras en un solo lugar.' },
        { title: 'Bot AI que atiende', desc: 'Monitorea señales de emergencia y califica alertas críticas 24/7.' },
        { title: 'Vendes sin parar', desc: 'Automatiza reportes a clientes y renovaciones de contratos anuales.' }
      ],
      bottomFeatures: [
        { title: 'Incidentes', desc: 'Bitácoras automatizadas.' },
        { title: 'Automatizaciones', desc: 'Despacho de patrulla.' },
        { title: 'Integraciones', desc: 'Cámaras y sensores.' },
        { title: 'Reportes en Vivo', desc: 'Estado de perímetros.' },
        { title: 'Seguro y Confiable', desc: 'Encriptación militar.' }
      ]
    };
  }
  
  if (type === 'dental') {
    return {
      type,
      tagline: 'CRM PARA CLÍNICAS Y ODONTÓLOGOS',
      kpis: [
        { label: 'Pacientes Activos', val: '1,520', change: '+14%' },
        { label: 'Citas Reservadas', val: '340', change: '+9%' },
        { label: 'Tratamientos Hoy', val: '18', change: '+15%' }
      ],
      funnelStages: ['Contacto', 'Evaluación', 'Tratamiento', 'Control', 'Satisfecho'],
      chatbotGreeting: '¡Hola! 🦷 ¿Quieres programar una evaluación dental o cambiar tu cita?',
      features: [
        { title: 'Organiza y controla', desc: 'Centraliza fichas clínicas, radiografías y odontograma de tus pacientes.' },
        { title: 'Bot AI que atiende', desc: 'Confirma citas por WhatsApp y atiende dudas de pacientes 24/7.' },
        { title: 'Vendes sin parar', desc: 'Automatiza presupuestos y recordatorios preventivos de limpieza dental.' }
      ],
      bottomFeatures: [
        { title: 'Odontograma', desc: 'Fichas clínicas 3D.' },
        { title: 'Automatizaciones', desc: 'WhatsApp recordatorios.' },
        { title: 'Facturación', desc: 'Control de presupuestos.' },
        { title: 'Citas en Vivo', desc: 'Calendario digital.' },
        { title: 'Seguro y Confiable', desc: 'Cumple HIPAA/MH.' }
      ]
    };
  }
  
  return {
    type,
    tagline: 'CRM INTELIGENTE Y AUTOMATIZADO',
    kpis: [
      { label: 'Leads Totales', val: '1,250', change: '+18%' },
      { label: 'En Contacto', val: '320', change: '+12%' },
      { label: 'Clientes Nuevos', val: '98', change: '+25%' }
    ],
    funnelStages: ['Nuevos', 'Contactados', 'Interesados', 'Propuesta', 'Cerrados'],
    chatbotGreeting: '¡Hola! 👋 Soy tu asistente AI. ¿En qué puedo ayudarte a vender más hoy?',
    features: [
      { title: 'Organiza y controla', desc: 'Centraliza todos tus leads, contactos y oportunidades de venta en un solo lugar.' },
      { title: 'Bot AI que convierte', desc: 'Nuestro Bot AI atiende consultas 24/7, calificando leads en automático.' },
      { title: 'Vendes sin parar', desc: 'Automatiza seguimientos, respuestas y cierres para que tu negocio nunca descanse.' }
    ],
    bottomFeatures: [
      { title: 'Gestión de Leads', desc: 'Captura y organiza leads.' },
      { title: 'Automatizaciones', desc: 'Crea flujos inteligentes.' },
      { title: 'Integraciones', desc: 'Conecta tus herramientas.' },
      { title: 'Reportes en Vivo', desc: 'Toma decisiones con datos.' },
      { title: 'Seguro y Confiable', desc: 'Datos siempre protegidos.' }
    ]
  };
}

// ── SVG Funnel Component ──────────────────────────────────────────────────────
function renderFunnelSVG(primary: string): React.ReactNode {
  return (
    <svg viewBox="0 0 100 80" style={{ width: '100%', height: 90, display: 'block' }}>
      <polygon points="10,2 90,2 80,14 20,14" fill={primary} opacity="0.9" />
      <polygon points="20,16 80,16 72,28 28,28" fill={primary} opacity="0.85" />
      <polygon points="28,30 72,30 65,42 35,42" fill={primary} opacity="0.75" />
      <polygon points="35,44 65,44 58,56 42,56" fill={primary} opacity="0.65" />
      <polygon points="42,58 58,58 53,68 47,68" fill={primary} opacity="0.55" />
    </svg>
  );
}

// ── SVG Funnel Labels ─────────────────────────────────────────────────────────
function renderFunnelLabels(stages: string[]): React.ReactNode {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, paddingLeft: 8 }}>
      {stages.map((s, i) => {
        const colors = ['#0070d2', '#7c3aed', '#ef4444', '#f59e0b', '#10b981'];
        const bulletColor = colors[i] || '#cbd5e1';
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 7, fontWeight: 700, color: '#334155' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: bulletColor }} />
              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: 45 }}>{s}</span>
            </div>
            <span style={{ opacity: 0.8 }}>{100 - i * 20}%</span>
          </div>
        );
      })}
    </div>
  );
}

// ── SVG Robot Assistant Component ──────────────────────────────────────────────
function renderRobotSVG(primary: string): React.ReactNode {
  return (
    <svg viewBox="0 0 100 100" style={{ width: 140, height: 140, zIndex: 12 }}>
      {/* Body */}
      <rect x="25" y="45" width="50" height="40" rx="15" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2.5" />
      <circle cx="50" cy="65" r="14" fill={primary} opacity="0.1" />
      <circle cx="50" cy="65" r="7" fill={primary} />
      {/* Head */}
      <rect x="20" y="10" width="60" height="42" rx="20" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2.5" />
      {/* Face Screen */}
      <rect x="28" y="18" width="44" height="26" rx="10" fill="#0f172a" />
      {/* Glowing Eyes */}
      <path d="M37 28 Q41 25 45 28" fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
      <path d="M55 28 Q59 25 63 28" fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
      {/* Neck */}
      <rect x="44" y="48" width="12" height="6" fill="#cbd5e1" />
      {/* Ears/Antenna */}
      <circle cx="16" cy="31" r="5" fill="#cbd5e1" />
      <circle cx="84" cy="31" r="5" fill="#cbd5e1" />
      <circle cx="50" cy="6" r="3.5" fill={primary} />
      <line x1="50" y1="10" x2="50" y2="6" stroke="#cbd5e1" strokeWidth="2" />
    </svg>
  );
}

// ── SVG Chatbot dialog bubble ─────────────────────────────────────────────────
function renderChatbotWidget(industry: IndustryDetails, primary: string, hasBg: boolean): React.ReactNode {
  return (
    <div style={{
      width: 250,
      background: hasBg ? 'rgba(15, 23, 42, 0.65)' : '#ffffff',
      backdropFilter: hasBg ? 'blur(16px)' : 'none',
      border: hasBg ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #e2e8f0',
      borderRadius: 20,
      padding: 14,
      boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      fontFamily: "'Plus Jakarta Sans', sans-serif"
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: primary, color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>🤖</div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: hasBg ? '#fff' : '#0f172a' }}>Bot AI</div>
          <div style={{ fontSize: 7, fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 2 }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#10b981' }} /> En línea
          </div>
        </div>
      </div>
      {/* Chat Bubble content */}
      <div style={{
        background: hasBg ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9',
        padding: '8px 12px',
        borderRadius: '0 12px 12px 12px',
        fontSize: 10,
        fontWeight: 600,
        color: hasBg ? '#f1f5f9' : '#334155',
        lineHeight: 1.4,
        textAlign: 'left'
      }}>
        {industry.chatbotGreeting}
      </div>
      {/* Mock input field */}
      <div style={{
        background: hasBg ? 'rgba(0, 0, 0, 0.2)' : '#f8fafc',
        border: hasBg ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #d8dde6',
        borderRadius: 10,
        padding: '6px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: 9,
        color: '#94a3b8'
      }}>
        <span>Escribe tu mensaje...</span>
        <span style={{ fontSize: 10, color: primary }}>➔</span>
      </div>
    </div>
  );
}

// ── SVG Funnel Funnel Funnel dashboard ──────────────────────────────────────────
function renderDashboardMockup(prompt: string, primary: string, hasBg: boolean, industry: IndustryDetails, company: string): React.ReactNode {
  return (
    <div style={{
      width: 880,
      height: 340,
      background: hasBg ? 'rgba(15, 23, 42, 0.65)' : '#ffffff',
      backdropFilter: hasBg ? 'blur(20px)' : 'none',
      border: hasBg ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #dde1e7',
      borderRadius: 16,
      boxShadow: hasBg ? '0 25px 60px rgba(0,0,0,0.4)' : '0 20px 40px rgba(15,23,42,0.06)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: "'Plus Jakarta Sans', sans-serif"
    }}>
      {/* Browser top title bar */}
      <div style={{
        height: 34,
        background: hasBg ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
        borderBottom: hasBg ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        {/* Left window control dots */}
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56' }} />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }} />
        </div>
        {/* Mock address bar */}
        <div style={{
          width: 320,
          height: 20,
          background: hasBg ? 'rgba(0,0,0,0.2)' : '#ffffff',
          border: hasBg ? '1px solid rgba(255,255,255,0.06)' : '1px solid #dde1e7',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 9,
          color: hasBg ? 'rgba(255,255,255,0.5)' : '#94a3b8',
          letterSpacing: '0.02em'
        }}>
          🔒 app.{company.toLowerCase().replace(/[^a-z0-9]/g, '') || 'saas'}.com
        </div>
        <div style={{ width: 42 }} /> {/* balance spacers */}
      </div>

      {/* Main mockup content area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar navigation */}
        <div style={{
          width: 170,
          background: hasBg ? 'rgba(30, 41, 59, 0.3)' : '#f8fafc',
          borderRight: hasBg ? '1px solid rgba(255,255,255,0.08)' : '1px solid #dde1e7',
          padding: '16px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          flexShrink: 0
        }}>
          {/* Brand Label inside sidebar */}
          <div style={{ fontSize: 10, fontWeight: 900, color: primary, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⚡</span> {company}
          </div>
          {/* Sidebar menu items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
            {['Dashboard', 'Leads / Prospectos', 'Automatizaciones', 'Reportes de Conversión', 'Configuración del Sistema'].map((link, idx) => (
              <div key={link} style={{
                fontSize: 10,
                fontWeight: 800,
                padding: '8px 10px',
                borderRadius: 6,
                background: idx === 0 ? (hasBg ? 'rgba(255,255,255,0.1)' : `${primary}12`) : 'transparent',
                color: idx === 0 ? primary : (hasBg ? 'rgba(255,255,255,0.6)' : '#64748b'),
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: idx === 0 ? primary : (hasBg ? 'rgba(255,255,255,0.2)' : '#94a3b8') }} />
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{link}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Main Dashboard body */}
        <div style={{ flex: 1, padding: 18, display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}>
          {/* Dashboard Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 900, color: hasBg ? '#fff' : '#0f172a' }}>Panel General</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 10, opacity: 0.5 }}>🔍</span>
              <span style={{ fontSize: 10, opacity: 0.5 }}>🔔</span>
              <span style={{ width: 20, height: 20, borderRadius: '50%', background: primary, color: '#fff', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>U</span>
            </div>
          </div>

          {/* KPI Cards Grid */}
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            {industry.kpis.map((kpi, idx) => (
              <div key={idx} style={{
                flex: 1,
                background: hasBg ? 'rgba(255,255,255,0.04)' : '#ffffff',
                border: hasBg ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 10,
                textAlign: 'left'
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: hasBg ? 'rgba(255,255,255,0.6)' : '#64748b', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{kpi.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: hasBg ? '#fff' : '#0f172a' }}>{kpi.val}</span>
                  <span style={{ fontSize: 9, color: '#10b981', fontWeight: 800 }}>{kpi.change}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Funnel and Activity grid split */}
          <div style={{ display: 'flex', gap: 14, flex: 1, minHeight: 0 }}>
            {/* Sales Funnel (Left) */}
            <div style={{
              width: 320,
              background: hasBg ? 'rgba(0,0,0,0.15)' : '#f8fafc',
              border: hasBg ? '1px solid rgba(255,255,255,0.04)' : '1px solid #f1f5f9',
              borderRadius: 12,
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0
            }}>
              <div style={{ fontSize: 8, fontWeight: 900, color: hasBg ? 'rgba(255,255,255,0.5)' : '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'left', flexShrink: 0 }}>Embudo de Conversión</div>
              <div style={{ display: 'flex', alignItems: 'center', flex: 1, minHeight: 0 }}>
                <div style={{ width: 120, flexShrink: 0 }}>
                  {renderFunnelSVG(primary)}
                </div>
                {renderFunnelLabels(industry.funnelStages)}
              </div>
            </div>

            {/* Recent Activity (Right) */}
            <div style={{
              flex: 1,
              background: hasBg ? 'rgba(0,0,0,0.15)' : '#f8fafc',
              border: hasBg ? '1px solid rgba(255,255,255,0.04)' : '1px solid #f1f5f9',
              borderRadius: 12,
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0
            }}>
              <div style={{ fontSize: 8, fontWeight: 900, color: hasBg ? 'rgba(255,255,255,0.5)' : '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'left', flexShrink: 0 }}>Actividad de Automatización</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, justifyContent: 'center', textAlign: 'left', minHeight: 0 }}>
                {[
                  { label: 'AI Bot: Conversación calificada', t: 'hace 2 min' },
                  { label: 'Lead calificado & registrado en CRM', t: 'hace 5 min' },
                  { label: 'Notificación enviada por WhatsApp', t: 'hace 10 min' },
                  { label: 'Onboarding automatizado iniciado', t: 'hace 30 min' }
                ].map((act, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 600, color: hasBg ? '#cbd5e1' : '#475569', gap: 8 }}>
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>✓ {act.label}</span>
                    <span style={{ opacity: 0.6, flexShrink: 0 }}>{act.t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SVG Tech Stack Emojis/Logos for very bottom row ───────────────────────────
function renderTechStackFooter(prompt: string): React.ReactNode {
  return (
    <div style={{
      height: 120,
      background: '#ffffff',
      borderTop: '1px solid #e2e8f0',
      padding: '16px 64px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxSizing: 'border-box',
      fontFamily: "'Plus Jakarta Sans', sans-serif"
    }}>
      {/* Left: Stack icons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: '#94a3b8', letterSpacing: '0.08em' }}>STACK UTILIZADO</span>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
            ⚛️ React
          </span>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
            📘 TS
          </span>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
            🌊 Tailwind
          </span>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
            🟢 Express
          </span>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
            🍃 MongoDB
          </span>
        </div>
      </div>

      {/* Center: Build list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: '#94a3b8', letterSpacing: '0.08em' }}>¿CÓMO LO CONSTRUI?</span>
        <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, display: 'flex', gap: 12 }}>
          <span>• Frontend React + TypeScript</span>
          <span>• UI/UX limpio y responsive</span>
          <span>• Backend en Node.js + Express</span>
        </div>
      </div>

      {/* Right: Prompt terminal */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', maxWidth: '30%' }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: '#94a3b8', letterSpacing: '0.08em' }}>PROMPT UTILIZADO PARA GOOGLE ANTIGRAVITY</span>
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 6,
          padding: '6px 10px',
          fontSize: 10,
          color: '#334155',
          fontFamily: 'monospace',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '100%'
        }}>
          "{prompt}"
        </div>
      </div>
    </div>
  );
}

// ── SVG Dark bottom box containing CTA button & 5 mini feature blocks ─────────
function renderBottomBanner(primary: string, secondary: string, data: FlyerData, industry: IndustryDetails, isDarkTheme: boolean): React.ReactNode {
  return (
    <div style={{
      height: 260,
      background: isDarkTheme ? '#030712' : '#090d16',
      borderTop: isDarkTheme ? '1px solid rgba(255,255,255,0.06)' : 'none',
      padding: '24px 64px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      boxSizing: 'border-box',
      fontFamily: "'Plus Jakarta Sans', sans-serif"
    }}>
      {/* 5 Features Grid */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        {industry.bottomFeatures.map((feat, idx) => {
          const checkIcons = ['👥', '⚡', '🔌', '📊', '🔒'];
          const icon = checkIcons[idx] || '✓';
          return (
            <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10 }}>{icon}</span>
                <span style={{ fontSize: 10, fontWeight: 900, color: '#ffffff' }}>{feat.title}</span>
              </div>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', fontWeight: 500, lineHeight: 1.3 }}>{feat.desc}</span>
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div style={{ height: 1, width: '100%', background: 'rgba(255,255,255,0.1)' }} />

      {/* Bottom Footer Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Left: CTA button */}
        <div style={{
          background: `linear-gradient(135deg, ${primary}, ${primary}cc)`,
          color: '#ffffff',
          fontWeight: 800,
          fontSize: 13,
          padding: '12px 28px',
          borderRadius: 12,
          boxShadow: `0 6px 20px ${primary}35`,
          border: '1px solid rgba(255,255,255,0.15)',
          cursor: 'pointer',
          whiteSpace: 'nowrap'
        }}>
          {data.cta || 'CONTACTAR AHORA'}
        </div>

        {/* Center: QR Code mockup */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 44, height: 44, background: '#fff', padding: 4, borderRadius: 6, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2, boxSizing: 'border-box' }}>
            {[1,0,1,1,0, 0,1,0,0,1, 1,1,0,1,0, 0,0,1,1,1, 1,0,1,0,1].map((v, i) => (
              <div key={i} style={{ background: v ? '#0f172a' : '#fff' }} />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', fontWeight: 700, letterSpacing: '0.02em' }}>¡Escanea y comienza hoy!</span>
            <span style={{ fontSize: 11, color: '#ffffff', fontWeight: 800 }}>{data.website || 'leadmaster.com/demo'}</span>
          </div>
        </div>

        {/* Right: Phone, Web or Socials */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {data.phone && (
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>📱 {data.phone}</span>
          )}
          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>Síguenos en: Facebook · Instagram · LinkedIn</span>
        </div>
      </div>
    </div>
  );
}

// ── TEMPLATE A — Classic Corporate (Redesigned with HubSpot/Salesforce Style) ──────
export const FlyerTemplateA = React.forwardRef<HTMLDivElement, { data: FlyerData }>(
  ({ data }, ref) => {
    const parsed = parsePrompt(data.prompt);
    const primary = data.primaryColor || '#0052FF'; // Vibrant tech blue
    const secondary = data.secondaryColor || '#0f172a'; // Midnight navy
    
    // Default values matching User Request
    const defaultHeadline = 'REVOLUCIONA TU WORKFLOW.';
    const defaultSubheadline = 'CRM Inteligente de Leads y Automatización Total.';
    const defaultCta = 'CONTACTAR AHORA';
    const defaultPrice = 'Desde $12.95';

    const price = data.price || parsed.price || derivePrice(data.prompt) || defaultPrice;
    const features = data.features || parsed.features || deriveFeatures(data.prompt);
    
    // Ensure we have exactly 4 features
    while (features.length < 4) {
      const defaults = ['Integración Total', 'Automatización IA', 'Seguridad Avanzada', 'Gestión Simplificada'];
      const next = defaults.find(d => !features.includes(d));
      if (next) features.push(next); else break;
    }
    const cleanFeatures = features.slice(0, 4);

    const { h1, h2 } = deriveHeadline(data.prompt, data.company_name);
    const headline = data.headline || parsed.title || (h1 && h1 !== 'Diseño Profesional' ? h1 : defaultHeadline);
    const subheadline = data.subheadline || parsed.subtitle || (h2 && h2 !== data.company_name ? h2 : defaultSubheadline);
    const cta = data.cta || parsed.cta || deriveCta(data.prompt) || defaultCta;
    
    const hasBg = !!data.bgImageUrl;
    const indData = getIndustryData(data.prompt);

    // Dynamic scannable QR code API integration
    const qrUrl = data.website || 'www.ariasdefense.com';
    const formattedQrUrl = qrUrl.startsWith('http://') || qrUrl.startsWith('https://') ? qrUrl : `https://${qrUrl}`;
    const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(formattedQrUrl)}`;

    // Split title to apply gradient color to last word
    const titleWords = headline.split(' ');
    const lastWord = titleWords.length > 1 ? titleWords.pop() : '';
    const mainTitle = titleWords.join(' ');

    return (
      <div ref={ref}
        className={data.onBgClick ? "editable-element" : undefined}
        onClick={data.onBgClick ? (e) => { e.stopPropagation(); data.onBgClick?.(); } : undefined}
        style={{
          width: 1080, height: data.containerH || 1080,
          background: hasBg 
            ? `url('${data.bgImageUrl}') center/cover no-repeat` 
            : `radial-gradient(circle at 90% 10%, ${primary}12 0%, transparent 60%), #ffffff`,
          fontFamily: data.flyerFont ? getFontFamily(data.flyerFont) : "'Plus Jakarta Sans', 'Outfit', sans-serif",
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          justifyContent: 'space-between',
          cursor: data.onBgClick ? 'pointer' : 'default',
          '--flyer-title-font': getFontFamily(data.titleFont || data.flyerFont),
          '--flyer-subtitle-font': getFontFamily(data.subtitleFont || data.flyerFont),
          '--flyer-benefits-font': getFontFamily(data.benefitsFont || data.flyerFont),
          '--flyer-cta-font': getFontFamily(data.ctaFont || data.flyerFont),
          '--flyer-contact-font': getFontFamily(data.contactFont || data.flyerFont),
        } as React.CSSProperties}
      >
        {/* Load Google Fonts directly in the render flow */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Syne:wght@700;800&display=swap" />

        {!hasBg && (
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(#f1f5f9 1.5px, transparent 1.5px)',
            backgroundSize: '40px 40px',
            opacity: 0.8,
            pointerEvents: 'none'
          }} />
        )}

        {/* 1. TOP MAIN WRAPPER (Header + Hero Area + Feature Grid) */}
        <div style={{
          margin: hasBg ? '50px 64px 0 64px' : '0',
          padding: hasBg ? '40px' : '50px 64px 0 64px',
          background: data.cardBgColor || (hasBg ? 'rgba(255, 255, 255, 0.85)' : 'transparent'),
          backdropFilter: hasBg ? 'blur(24px)' : 'none',
          borderRadius: hasBg ? '24px' : '0',
          border: hasBg ? '1px solid rgba(255, 255, 255, 0.4)' : 'none',
          boxShadow: hasBg ? '0 20px 50px rgba(0,0,0,0.12)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flex: 1,
          zIndex: 10,
          position: 'relative',
          boxSizing: 'border-box',
          transform: data.textY ? `translateY(${data.textY}px)` : undefined
        }}>
          {/* Header Section */}
          <div style={{ 
            display: 'flex', flexDirection: 'column', 
            alignItems: data.textAlign === 'left' ? 'flex-start' : data.textAlign === 'right' ? 'flex-end' : 'center', 
            textAlign: data.textAlign || 'center', 
            width: '100%' 
          }}>
            {/* Tagline */}
            <div style={{ fontSize: 14, fontWeight: 900, color: primary, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 12 }}>
              {indData.tagline || 'SaaS CRM - CONTROL INTELIGENTE'}
            </div>

            {/* Headline */}
            <h1 
              data-element-id="title"
              className={data.onTitleClick ? "editable-element flyer-title-element" : "flyer-title-element"}
              onClick={data.onTitleClick ? (e) => { e.stopPropagation(); data.onTitleClick?.(); } : undefined}
              style={{
                fontSize: (headline.length > 25 ? 44 : 54) * (data.titleScale ?? data.textScale ?? 1),
                fontWeight: 900,
                color: data.titleColor || '#1a1a1a', // Charcoal / Customizer titleColor
                lineHeight: 1.1,
                letterSpacing: '-0.03em', // Tight letter-spacing
                textTransform: 'uppercase',
                margin: '0 0 12px 0',
                width: '100%',
                transform: (data.titleX || data.titleY) ? `translate(${data.titleX ?? 0}px, ${data.titleY ?? 0}px)` : undefined
              }}
            >
              {headline.includes('**') ? renderTitleWithHighlights(headline, data.titleColor || '#1a1a1a', data.highlightColor) : headline}
            </h1>

            {/* Sub-headline / Value Prop */}
            <p 
              data-element-id="subtitle"
              className={data.onSubtitleClick ? "editable-element flyer-subtitle-element" : "flyer-subtitle-element"}
              onClick={data.onSubtitleClick ? (e) => { e.stopPropagation(); data.onSubtitleClick?.(); } : undefined}
              style={{
                fontSize: 18 * (data.subtitleScale ?? 1),
                fontWeight: data.subtitleBold ? 900 : 500,
                color: data.subtitleColor || '#475569', // Slate Gray / Customizer subtitleColor
                lineHeight: 1.4,
                letterSpacing: '0.01em',
                margin: 0,
                maxWidth: 880,
                transform: (data.subtitleX || data.subtitleY) ? `translate(${data.subtitleX ?? 0}px, ${data.subtitleY ?? 0}px)` : undefined
              }}
            >
              {subheadline}
            </p>
          </div>

          {/* Hero Area: Centered Browser Mockup (HIDDEN IF BACKGROUND ACTIVE) */}
          {!hasBg && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', margin: '18px 0' }}>
              {renderIsometricTechVisual(primary, '#00d4ff')}
            </div>
          )}

          {/* Feature Grid (4-Column Layout dynamic gap) */}
          <div 
            data-element-id="benefits"
            className={data.onBenefitsClick ? "editable-element flyer-benefits-element" : "flyer-benefits-element"}
            onClick={data.onBenefitsClick ? (e) => { e.stopPropagation(); data.onBenefitsClick?.(); } : undefined}
            style={{ 
              display: 'flex', gap: cleanFeatures.length > 3 ? 24 : 48, width: '100%', marginBottom: 24,
              transform: (data.benefitsX || data.benefitsY) ? `translate(${data.benefitsX ?? 0}px, ${data.benefitsY ?? 0}px)` : undefined
            }}
          >
            {cleanFeatures.map((feat, idx) => {
              const featData = getFeatureBullets(feat, data.prompt, primary);
              return (
                <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  {/* Subtle modern minimalist line-art icon */}
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: hasBg ? 'rgba(255, 255, 255, 0.5)' : '#f8fafc',
                    border: '1px solid #dde1e7', color: primary,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 14, flexShrink: 0
                  }}>
                    {featData.icon}
                  </div>
                  {/* Title */}
                  <span style={{ fontSize: 16 * (data.benefitsScale ?? 1), fontWeight: data.benefitsBold ? 900 : 800, color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                    {featData.title}
                  </span>
                  {/* Bullets */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                    {featData.bullets.map((bullet, bIdx) => (
                      <span key={bIdx} style={{ fontSize: 13 * (data.benefitsScale ?? 1), color: '#64748b', fontWeight: data.benefitsBold ? 800 : 500, lineHeight: 1.4, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                        • {bullet}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. BOTTOM CONTRACTING SOLID BANNER BLOCK */}
        <div style={{
          height: 240,
          background: '#0f172a', // Midnight navy
          padding: '28px 64px 20px 64px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
          fontFamily: data.flyerFont ? getFontFamily(data.flyerFont) : "'Plus Jakarta Sans', sans-serif",
          zIndex: 10,
          position: 'relative'
        }}>
          {/* Main banner elements */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* Left pricing */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em' }}>PLAN ENTERPRISE</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 38 * (data.textScale ?? 1), fontWeight: 900, color: '#ffffff' }}>{price}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>/mes</span>
              </div>
            </div>

            {/* Center QR Code */}
            <div 
              data-element-id="contact"
              className={data.onContactClick ? "editable-element flyer-contact-element" : "flyer-contact-element"}
              onClick={data.onContactClick ? (e) => { e.stopPropagation(); data.onContactClick?.(); } : undefined}
              style={{ 
                display: 'flex', alignItems: 'center', gap: 16,
                cursor: data.onContactClick ? 'pointer' : 'default',
                transform: (data.contactX || data.contactY || data.contactScale) 
                  ? `translate(${data.contactX ?? 0}px, ${data.contactY ?? 0}px) scale(${data.contactScale ?? 1})` 
                  : undefined,
                transformOrigin: 'center'
              }}
            >
              <div style={{
                width: 80, height: 80,
                background: '#ffffff',
                padding: 4,
                borderRadius: 8,
                border: `2px solid ${primary}`,
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}>
                <img 
                  src={qrCodeApiUrl} 
                  crossOrigin="anonymous" 
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                  alt="QR Code" 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', gap: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em' }}>DEMO EN VIVO</span>
                <span style={{ fontSize: 15, fontWeight: 900, color: data.contactColor || '#ffffff', letterSpacing: '0.02em' }}>
                  {data.phone ? `${data.phone} · ` : ''}{data.website || 'ariasdefense.com'}
                </span>
              </div>
            </div>

            {/* Right CTA Button */}
            <div 
              data-element-id="cta"
              className={data.onCtaClick ? "editable-element flyer-cta-element" : "flyer-cta-element"}
              onClick={data.onCtaClick ? (e) => { e.stopPropagation(); data.onCtaClick?.(); } : undefined}
              style={{
                background: data.ctaBgColor || primary,
                color: data.ctaTextColor || '#ffffff',
                fontWeight: 900,
                fontSize: 16 * (data.ctaScale ?? 1),
                letterSpacing: '0.05em',
                padding: '16px 32px',
                borderRadius: 50,
                boxShadow: `0 8px 20px ${(data.ctaBgColor || primary)}30`,
                border: 'none',
                cursor: 'pointer',
                textTransform: 'uppercase',
                transform: (data.ctaX || data.ctaY) ? `translate(${data.ctaX ?? 0}px, ${data.ctaY ?? 0}px)` : undefined
              }}
            >
              {cta}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, width: '100%', background: 'rgba(255,255,255,0.08)' }} />

          {/* Trust anchors */}
          <div style={{
            textAlign: 'center',
            fontSize: 13,
            fontWeight: 800,
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase'
          }}>
            Soporte 24/7 • Prueba de 14 Días
          </div>
        </div>

        {/* 3. VERY BOTTOM TECH DETAILS BAR */}
        {renderTechStackFooter(data.prompt)}
      </div>
    );
  }
);

// ── TEMPLATE B — Studio Bold / Minimal Editorial (Stripe/Linear Dark Style) ────────
export const FlyerTemplateB = React.forwardRef<HTMLDivElement, { data: FlyerData }>(
  ({ data }, ref) => {
    const parsed = parsePrompt(data.prompt);
    const primary = data.primaryColor || '#0f172a'; // Midnight navy
    const secondary = data.secondaryColor || '#D4AF37'; // Brushed Gold
    
    // Default values matching User Request
    const defaultHeadline = 'REVOLUCIONA TU WORKFLOW.';
    const defaultSubheadline = 'CRM Inteligente de Leads y Automatización Total.';
    const defaultCta = 'CONTACTAR AHORA';
    const defaultPrice = 'Desde $12.95';

    const price = data.price || parsed.price || derivePrice(data.prompt) || defaultPrice;
    const features = data.features || parsed.features || deriveFeatures(data.prompt);
    
    // Ensure we have exactly 4 features
    while (features.length < 4) {
      const defaults = ['Integración Total', 'Automatización IA', 'Seguridad Avanzada', 'Gestión Simplificada'];
      const next = defaults.find(d => !features.includes(d));
      if (next) features.push(next); else break;
    }
    const cleanFeatures = features.slice(0, 4);

    const { h1, h2 } = deriveHeadline(data.prompt, data.company_name);
    const headline = data.headline || parsed.title || (h1 && h1 !== 'Diseño Profesional' ? h1 : defaultHeadline);
    const subheadline = data.subheadline || parsed.subtitle || (h2 && h2 !== data.company_name ? h2 : defaultSubheadline);
    const cta = data.cta || parsed.cta || deriveCta(data.prompt) || defaultCta;
    
    const hasBg = !!data.bgImageUrl;
    const indData = getIndustryData(data.prompt);

    // Dynamic scannable QR code API integration
    const qrUrl = data.website || 'www.ariasdefense.com';
    const formattedQrUrl = qrUrl.startsWith('http://') || qrUrl.startsWith('https://') ? qrUrl : `https://${qrUrl}`;
    const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(formattedQrUrl)}`;

    // Split title to apply gradient color to last word
    const titleWords = headline.split(' ');
    const lastWord = titleWords.length > 1 ? titleWords.pop() : '';
    const mainTitle = titleWords.join(' ');

    return (
      <div ref={ref}
        className={data.onBgClick ? "editable-element" : undefined}
        onClick={data.onBgClick ? (e) => { e.stopPropagation(); data.onBgClick?.(); } : undefined}
        style={{
          width: 1080, height: data.containerH || 1080,
          background: hasBg 
            ? `url('${data.bgImageUrl}') center/cover no-repeat` 
            : `radial-gradient(circle at 10% 90%, ${secondary}08 0%, transparent 60%), #ffffff`,
          fontFamily: data.flyerFont ? getFontFamily(data.flyerFont) : "'Outfit', 'Plus Jakarta Sans', sans-serif",
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          justifyContent: 'space-between',
          cursor: data.onBgClick ? 'pointer' : 'default',
          '--flyer-title-font': getFontFamily(data.titleFont || data.flyerFont),
          '--flyer-subtitle-font': getFontFamily(data.subtitleFont || data.flyerFont),
          '--flyer-benefits-font': getFontFamily(data.benefitsFont || data.flyerFont),
          '--flyer-cta-font': getFontFamily(data.ctaFont || data.flyerFont),
          '--flyer-contact-font': getFontFamily(data.contactFont || data.flyerFont),
        } as React.CSSProperties}
      >
        {/* Load Google Fonts directly in the render flow */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Syne:wght@700;800&display=swap" />

        {!hasBg && (
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(#f1f5f9 1.5px, transparent 1.5px)',
            backgroundSize: '40px 40px',
            opacity: 0.8,
            pointerEvents: 'none'
          }} />
        )}

        {/* 1. TOP MAIN WRAPPER (Header + Hero Area + Feature Grid) */}
        <div style={{
          margin: hasBg ? '50px 64px 0 64px' : '0',
          padding: hasBg ? '40px' : '50px 64px 0 64px',
          background: data.cardBgColor || (hasBg ? 'rgba(15, 23, 42, 0.72)' : 'transparent'),
          backdropFilter: hasBg ? 'blur(24px)' : 'none',
          borderRadius: hasBg ? '24px' : '0',
          border: hasBg ? `1.5px solid ${secondary}40` : 'none',
          boxShadow: hasBg ? '0 20px 50px rgba(0,0,0,0.3)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flex: 1,
          zIndex: 10,
          position: 'relative',
          boxSizing: 'border-box',
          transform: data.textY ? `translateY(${data.textY}px)` : undefined
        }}>
          {/* Header Section */}
          <div style={{ 
            display: 'flex', flexDirection: 'column', 
            alignItems: data.textAlign === 'left' ? 'flex-start' : data.textAlign === 'right' ? 'flex-end' : 'center', 
            textAlign: data.textAlign || 'center', 
            width: '100%' 
          }}>
            {/* Tagline */}
            <div style={{ fontSize: 14, fontWeight: 900, color: secondary, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 12 }}>
              ⚡ {indData.tagline || 'SaaS CRM - CONTROL INTELIGENTE'}
            </div>

            {/* Headline */}
            <h1 
              data-element-id="title"
              className={data.onTitleClick ? "editable-element flyer-title-element" : "flyer-title-element"}
              onClick={data.onTitleClick ? (e) => { e.stopPropagation(); data.onTitleClick?.(); } : undefined}
              style={{
                fontSize: (headline.length > 25 ? 44 : 54) * (data.titleScale ?? data.textScale ?? 1),
                fontWeight: 900,
                fontFamily: "'Syne', sans-serif",
                color: data.titleColor || (hasBg ? '#ffffff' : primary), // White text if glass overlay on BG, else Midnight Navy
                lineHeight: 1.1,
                letterSpacing: '-0.03em', // Tight letter-spacing
                textTransform: 'uppercase',
                margin: '0 0 12px 0',
                width: '100%',
                transform: (data.titleX || data.titleY) ? `translate(${data.titleX ?? 0}px, ${data.titleY ?? 0}px)` : undefined
              }}
            >
              {headline.includes('**') ? renderTitleWithHighlights(headline, data.titleColor || (hasBg ? '#ffffff' : primary), data.highlightColor) : headline}
            </h1>

            {/* Sub-headline / Value Prop */}
            <p 
              data-element-id="subtitle"
              className={data.onSubtitleClick ? "editable-element flyer-subtitle-element" : "flyer-subtitle-element"}
              onClick={data.onSubtitleClick ? (e) => { e.stopPropagation(); data.onSubtitleClick?.(); } : undefined}
              style={{
                fontSize: 18 * (data.subtitleScale ?? 1),
                fontWeight: data.subtitleBold ? 900 : 500,
                color: data.subtitleColor || (hasBg ? 'rgba(255, 255, 255, 0.85)' : '#475569'), // Light text if glass overlay, else Slate Gray
                lineHeight: 1.4,
                letterSpacing: '0.01em',
                margin: 0,
                maxWidth: 880,
                transform: (data.subtitleX || data.subtitleY) ? `translate(${data.subtitleX ?? 0}px, ${data.subtitleY ?? 0}px)` : undefined
              }}
            >
              {subheadline}
            </p>
          </div>

          {/* Hero Area: Centered Browser Mockup (Now SVG isometric visual) */}
          {!hasBg && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', margin: '18px 0', position: 'relative' }}>
              {/* Ambient background glow center */}
              <div style={{
                position: 'absolute',
                width: '90%',
                height: '90%',
                background: `radial-gradient(circle, ${secondary}08 0%, transparent 70%)`,
                zIndex: -1,
                pointerEvents: 'none'
              }} />
              {renderIsometricTechVisual(primary, secondary)}
            </div>
          )}

          {/* Feature Grid (4-Column Layout dynamic gap) */}
          <div 
            data-element-id="benefits"
            className={data.onBenefitsClick ? "editable-element flyer-benefits-element" : "flyer-benefits-element"}
            onClick={data.onBenefitsClick ? (e) => { e.stopPropagation(); data.onBenefitsClick?.(); } : undefined}
            style={{ 
              display: 'flex', gap: cleanFeatures.length > 3 ? 24 : 48, width: '100%', marginBottom: 24,
              transform: (data.benefitsX || data.benefitsY) ? `translate(${data.benefitsX ?? 0}px, ${data.benefitsY ?? 0}px)` : undefined
            }}
          >
            {cleanFeatures.map((feat, idx) => {
              const featData = getFeatureBullets(feat, data.prompt, secondary);
              return (
                <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  {/* Subtle modern minimalist line-art icon */}
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: hasBg ? 'rgba(255, 255, 255, 0.08)' : '#f8fafc',
                    border: hasBg ? `1px solid ${secondary}30` : '1px solid #dde1e7', color: secondary,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 14, flexShrink: 0
                  }}>
                    {featData.icon}
                  </div>
                  {/* Title */}
                  <span style={{ fontSize: 16 * (data.benefitsScale ?? 1), fontWeight: data.benefitsBold ? 900 : 800, color: hasBg ? '#ffffff' : primary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                    {featData.title}
                  </span>
                  {/* Bullets */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                    {featData.bullets.map((bullet, bIdx) => (
                      <span key={bIdx} style={{ fontSize: 13 * (data.benefitsScale ?? 1), color: hasBg ? 'rgba(255, 255, 255, 0.7)' : '#64748b', fontWeight: data.benefitsBold ? 800 : 500, lineHeight: 1.4, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                        • {bullet}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. BOTTOM CONTRACTING SOLID BANNER BLOCK */}
        <div style={{
          height: 240,
          background: '#1a1a1a', // Rich charcoal
          padding: '28px 64px 20px 64px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
          fontFamily: data.flyerFont ? getFontFamily(data.flyerFont) : "'Plus Jakarta Sans', sans-serif",
          zIndex: 10,
          position: 'relative'
        }}>
          {/* Main banner elements */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* Left pricing */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em' }}>PLAN ENTERPRISE</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 38 * (data.textScale ?? 1), fontWeight: 900, color: secondary }}>{price}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>/mes</span>
              </div>
            </div>

            {/* Center QR Code */}
            <div 
              data-element-id="contact"
              className={data.onContactClick ? "editable-element flyer-contact-element" : "flyer-contact-element"}
              onClick={data.onContactClick ? (e) => { e.stopPropagation(); data.onContactClick?.(); } : undefined}
              style={{ 
                display: 'flex', alignItems: 'center', gap: 16,
                cursor: data.onContactClick ? 'pointer' : 'default',
                transform: (data.contactX || data.contactY || data.contactScale) 
                  ? `translate(${data.contactX ?? 0}px, ${data.contactY ?? 0}px) scale(${data.contactScale ?? 1})` 
                  : undefined,
                transformOrigin: 'center'
              }}
            >
              <div style={{
                width: 80, height: 80,
                background: '#ffffff',
                padding: 4,
                borderRadius: 8,
                border: `2px solid ${secondary}`,
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}>
                <img 
                  src={qrCodeApiUrl} 
                  crossOrigin="anonymous" 
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                  alt="QR Code" 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', gap: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em' }}>DEMO EN VIVO</span>
                <span style={{ fontSize: 15, fontWeight: 900, color: data.contactColor || '#ffffff', letterSpacing: '0.02em' }}>
                  {data.phone ? `${data.phone} · ` : ''}{data.website || 'ariasdefense.com'}
                </span>
              </div>
            </div>

            {/* Right CTA Button */}
            <div 
              data-element-id="cta"
              className={data.onCtaClick ? "editable-element flyer-cta-element" : "flyer-cta-element"}
              onClick={data.onCtaClick ? (e) => { e.stopPropagation(); data.onCtaClick?.(); } : undefined}
              style={{
                background: data.ctaBgColor || '#ffffff',
                color: data.ctaTextColor || '#1a1a1a',
                fontWeight: 900,
                fontSize: 16 * (data.ctaScale ?? 1),
                letterSpacing: '0.05em',
                padding: '16px 32px',
                borderRadius: 50,
                boxShadow: `0 8px 20px ${(data.ctaBgColor || '#ffffff')}05`,
                border: `1.5px solid ${secondary}`,
                cursor: 'pointer',
                textTransform: 'uppercase',
                transform: (data.ctaX || data.ctaY) ? `translate(${data.ctaX ?? 0}px, ${data.ctaY ?? 0}px)` : undefined
              }}
            >
              {cta}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, width: '100%', background: 'rgba(255,255,255,0.08)' }} />

          {/* Trust anchors */}
          <div style={{
            textAlign: 'center',
            fontSize: 13,
            fontWeight: 800,
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase'
          }}>
            Soporte 24/7 • Prueba de 14 Días
          </div>
        </div>

        {/* 3. VERY BOTTOM TECH DETAILS BAR */}
        {renderTechStackFooter(data.prompt)}
      </div>
    );
  }
);
export const RenderFlyer: React.FC<{ data: FlyerData; templateId?: string }> = ({ data, templateId }) => {
  return templateId === 'B' ? <FlyerTemplateB data={data} /> : <FlyerTemplateA data={data} />;
};

export const FreeLogo: React.FC<{
  d: FlyerData & {
    containerW: number;
    containerH: number;
    logoSize: number;
    logoX: number;
    logoY: number;
    templateId: string;
  };
  onMove: (x: number, y: number) => void;
  onResize: (s: number) => void;
}> = ({ d, onMove, onResize }) => {
  const isDragging = React.useRef(false);
  const dragStart = React.useRef({ x: 0, y: 0 });
  const parentRect = React.useRef<DOMRect | null>(null);

  const startDrag = (e: React.MouseEvent) => {
    isDragging.current = true;
    const parent = e.currentTarget.parentElement;
    if (parent) {
      parentRect.current = parent.getBoundingClientRect();
      const logoRect = e.currentTarget.getBoundingClientRect();
      dragStart.current = { x: e.clientX - logoRect.left, y: e.clientY - logoRect.top };
    }
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);
  };

  const onDrag = (e: MouseEvent) => {
    if (!isDragging.current || !parentRect.current) return;
    const currentLeft = e.clientX - parentRect.current.left - dragStart.current.x;
    const currentTop = e.clientY - parentRect.current.top - dragStart.current.y;
    const pctX = Math.min(100, Math.max(0, (currentLeft / parentRect.current.width) * 100));
    const pctY = Math.min(100, Math.max(0, (currentTop / parentRect.current.height) * 100));
    onMove(pctX, pctY);
  };

  const endDrag = () => {
    isDragging.current = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', endDrag);
  };

  if (!d.logoUrl) return null;

  return (
    <div 
      className={d.onLogoClick ? "editable-element" : undefined}
      onClick={d.onLogoClick ? (e) => { e.stopPropagation(); d.onLogoClick?.(); } : undefined}
      style={{
        position: 'absolute',
        left: `${d.logoX}%`,
        top: `${d.logoY}%`,
        cursor: 'move',
        zIndex: 40,
        transform: `scale(${d.logoSize})`,
        transformOrigin: 'top left',
        padding: 6,
        background: 'rgba(255,255,255,0.92)',
        borderRadius: 12,
        boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
        border: '1px solid rgba(255,255,255,0.8)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        userSelect: 'none'
      }}
      onMouseDown={startDrag}
    >
      <img src={d.logoUrl} crossOrigin="anonymous" style={{ maxHeight: 34, maxWidth: 110, objectFit: 'contain' }} alt="Logo flotante" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }} onMouseDown={e => e.stopPropagation()}>
        <button 
          onClick={() => onResize(Math.min(d.logoSize + 0.1, 2.5))}
          style={{ width: 14, height: 14, fontSize: 8, fontWeight: 900, background: '#fff', border: '1px solid #d8dde6', borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          +
        </button>
        <button 
          onClick={() => onResize(Math.max(d.logoSize - 0.1, 0.4))}
          style={{ width: 14, height: 14, fontSize: 8, fontWeight: 900, background: '#fff', border: '1px solid #d8dde6', borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          -
        </button>
      </div>
    </div>
  );
};

export const TEMPLATE_LIST = [
  { id: 'A', name: 'Flyer Moderno A (Glow Glassmorphic)' },
  { id: 'B', name: 'Flyer Bold B (Editorial Showcase)' }
];
