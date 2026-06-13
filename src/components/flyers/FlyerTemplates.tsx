// FlyerTemplates.tsx — Professional HTML flyer templates
// These render pixel-perfect marketing flyers identical to ChatGPT quality
// Captured to PNG using html-to-image library

import React from 'react';

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
}

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

export interface IndustryContent {
  highlight_title: string;
  highlight_desc: string;
  benefits: { title: string; desc: string; icon: string }[];
  mockup_title: string;
  kpis: { label: string; val: string; change?: string }[];
}

export function deriveIndustryContent(prompt: string, data: Partial<FlyerData>): IndustryContent {
  const lower = (prompt || '').toLowerCase();
  
  // 1. K9 / Dog Training / Pets
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
  
  // 2. Food / Restaurants / Pizza
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

  // 3. Security / Guard / Defense
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

  // 4. Dental / Odontology / Clinics
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

  // 5. Default / B2B ERP
  return {
    highlight_title: data.highlight_title || '¿Quieres saber cuánto tienes que pagar de impuesto?',
    highlight_desc: data.highlight_desc || 'Lleva tu contabilidad al día, facturación electrónica y reportes en tiempo real.',
    benefits: data.benefits && data.benefits.length >= 3 ? data.benefits : [
      { title: 'Declaraciones', desc: 'Preparándote tus declaraciones a tiempo.', icon: '📄' },
      { title: 'Tranquilidad', desc: 'La tranquilidad y seguridad no se compran.', icon: '⏱️' },
      { title: 'Crecimiento', desc: 'Lleva el control total de tus ingresos y gastos.', icon: '📈' }
    ],
    mockup_title: data.mockup_info?.title || 'Dashboard Activo',
    kpis: data.mockup_info?.kpis && data.mockup_info.kpis.length >= 4 ? data.mockup_info.kpis : [
      { label: 'Ventas', val: '$5,234.75' },
      { label: 'Cobrar', val: '$1,414.55' },
      { label: 'Gastos', val: '$1,774.55' },
      { label: 'Utilidad', val: '$2,160.20' }
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

// ── Utility: derive headline from prompt ──────────────────────────────────────
export function deriveHeadline(prompt: string, company: string): { h1: string; h2: string } {
  if (!prompt || !prompt.trim()) {
    return { h1: 'Diseño Profesional', h2: company };
  }

  // 1. Look for explicit tags like Título/Subtítulo or Headline/Subheadline
  const titleMatch = prompt.match(/(?:t[íi]tulo|headline|t[íi]tulo del flyer|t[íi]tulo principal)\s*[:：]\s*([^\n|;.-]+)/i);
  const subMatch = prompt.match(/(?:subt[íi]tulo|subheadline|descripci[oó]n corta)\s*[:：]\s*([^\n|;.-]+)/i);

  let h1 = '';
  let h2 = '';

  if (titleMatch && titleMatch[1]) {
    h1 = cleanPhrase(titleMatch[1]);
  }
  if (subMatch && subMatch[1]) {
    h2 = cleanPhrase(subMatch[1]);
  }

  if (h1 && h2) return { h1, h2 };

  // 2. Look for splitters like double newlines or single newlines
  const lines = prompt.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0);
  if (!h1 && lines.length > 0 && lines[0].split(/\s+/).length <= 10) {
    h1 = cleanPhrase(lines[0]);
    if (!h2 && lines.length > 1) {
      h2 = cleanPhrase(lines[1]);
    }
  }

  // 3. Look for dashes or bullets as separators
  if (!h1) {
    const parts = prompt.split(/[—|•]|\s{2,}/);
    if (parts.length > 1 && parts[0].trim().split(/\s+/).length <= 10) {
      h1 = cleanPhrase(parts[0]);
      h2 = cleanPhrase(parts[1]);
    }
  }

  // Fallbacks
  if (!h1) {
    const words = prompt.trim().split(/\s+/);
    h1 = words.slice(0, 6).join(' ');
    h1 = cleanPhrase(h1);
  }

  if (!h2) {
    const words = prompt.trim().split(/\s+/);
    if (words.length > 6) {
      h2 = words.slice(6, 15).join(' ');
      h2 = cleanPhrase(h2);
    } else {
      h2 = `${company} — Innovación a tu alcance`;
    }
  }

  // Capitalize first letter
  if (h1.length > 0) h1 = h1.charAt(0).toUpperCase() + h1.slice(1);
  if (h2.length > 0) h2 = h2.charAt(0).toUpperCase() + h2.slice(1);

  return { h1, h2 };
}

// ── Utility: derive features from prompt ──────────────────────────────────────
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

// ── Utility: derive price from prompt ─────────────────────────────────────────
export function derivePrice(prompt: string): string {
  const match = prompt.match(/\$[\d,.]+/);
  if (match) return match[0];
  const match2 = prompt.match(/([\d,.]+)\s*(d[oó]lar|d[oó]lares|dollar|usd)/i);
  if (match2) return '$' + match2[1];
  return ''; 
}

// ── Utility: derive phone from prompt ─────────────────────────────────────────
function derivePhone(prompt: string, defaultPhone?: string): string {
  const match = prompt.match(/(?:📱|whatsapp|tel|tel[eé]fono|celular|cel|llama al|contacto:)\s*[:：]?\s*(\+?[\d\s()-]{8,18}\b)/i);
  if (match) {
    const clean = match[1].trim();
    const digits = clean.replace(/\D/g, '');
    if (digits.length >= 7) return clean;
  }
  return defaultPhone || '';
}

// ── Utility: derive website from prompt ───────────────────────────────────────
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

// ── Utility: derive CTA from prompt ───────────────────────────────────────────
function deriveCta(prompt: string, defaultCta?: string): string {
  const match = prompt.match(/(?:cta|bot[oó]n|llamado a la acci[oó]n|acci[oó]n)\s*[:：]\s*([^\n|;.-]+)/i);
  if (match && match[1]) {
    return cleanPhrase(match[1]);
  }
  return defaultCta || 'Contáctanos HOY';
}

// ── ICON SVGs ─────────────────────────────────────────────────────────────────
const icons: Record<string, string> = {
  'Facturación Electrónica': '📄',
  'Inventario y Bodega': '📦',
  'Control de Clientes': '👥',
  'Reportes en Tiempo Real': '📊',
  '100% Cumple con MH': '✅',
  'Soporte Premium 24/7': '🛠️',
  'Acceso en la Nube': '☁️',
  'Seguridad Garantizada': '🔒',
  'Fácil de Configurar': '⚡',
};

// ── TEMPLATE A — Classic Corporate (Redesigned with Mockups & Premium Aesthetics) ───
export const FlyerTemplateA = React.forwardRef<HTMLDivElement, { data: FlyerData }>(
  ({ data }, ref) => {
    const parsed = parsePrompt(data.prompt);
    const primary = data.primaryColor || '#e91e8c';
    const secondary = data.secondaryColor || '#1a1a2e';
    const price = data.price || parsed.price || derivePrice(data.prompt);
    const features = (data.features || parsed.features || deriveFeatures(data.prompt)).slice(0, 3);
    const { h1, h2 } = deriveHeadline(data.prompt, data.company_name);
    const headline = data.headline || parsed.title || h1;
    const subheadline = data.subheadline || parsed.subtitle || h2;
    const phone = data.phone || parsed.phone || derivePhone(data.prompt);
    const website = data.website || parsed.website || deriveWebsite(data.prompt);
    const cta = data.cta || parsed.cta || deriveCta(data.prompt, 'Contáctanos HOY');
    
    const industry = deriveIndustryContent(data.prompt, data);
    const hasBg = !!data.bgImageUrl;

    return (
      <div ref={ref} style={{
        width: 1080, height: 1080,
        background: hasBg ? `url(${data.bgImageUrl}) center/cover no-repeat` : `radial-gradient(circle at 100% 0%, ${primary}08 0%, rgba(255,255,255,0) 45%), radial-gradient(circle at 0% 100%, ${secondary}05 0%, rgba(255,255,255,0) 45%), #ffffff`,
        fontFamily: "'Outfit', 'Inter', 'Segoe UI', Arial, sans-serif",
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {!hasBg && (
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(#e2e8f0 1.2px, transparent 1.2px)',
            backgroundSize: '30px 30px',
            opacity: 0.35,
            pointerEvents: 'none'
          }} />
        )}
        
        {hasBg && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.75) 100%)',
            pointerEvents: 'none', zIndex: 1
          }} />
        )}

        {/* TOP SECTION */}
        <div style={{ padding: '52px 64px 24px', flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 10 }}>
          <div style={{ flex: 1, marginRight: 32, display: 'flex', flexDirection: 'column' }}>
            <div style={{
              fontSize: headline.length > 30 ? 38 : 48,
              fontWeight: 900,
              color: hasBg ? '#ffffff' : '#0f172a',
              textShadow: hasBg ? '0 4px 10px rgba(0,0,0,0.8)' : 'none',
              lineHeight: 1.1,
              marginBottom: 12,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
            }}>
              {headline}
            </div>
            <div style={{
              fontSize: 22,
              fontWeight: 700,
              color: hasBg ? '#f8fafc' : '#475569',
              textShadow: hasBg ? '0 2px 6px rgba(0,0,0,0.8)' : 'none',
              marginBottom: 24,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
            }}>{subheadline}</div>

            {price && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 14,
                background: `linear-gradient(135deg, ${primary}, ${primary}dd)`, borderRadius: 16, padding: '14px 32px',
                boxShadow: `0 10px 25px ${primary}35`, border: '1px solid rgba(255,255,255,0.15)',
                alignSelf: 'flex-start'
              }}>
                <span style={{ fontSize: 16, color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Desde</span>
                <span style={{ fontSize: 44, color: '#fff', fontWeight: 900, lineHeight: 1 }}>{price}</span>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>+ IVA</span>
              </div>
            )}
          </div>

          <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            {data.logoUrl ? (
              <div style={{ background: hasBg ? 'rgba(255,255,255,0.95)' : 'transparent', padding: hasBg ? 12 : 0, borderRadius: 16, boxShadow: hasBg ? '0 4px 12px rgba(0,0,0,0.15)' : 'none' }}>
                <img src={data.logoUrl} crossOrigin="anonymous" style={{ maxHeight: 80, maxWidth: 200, objectFit: 'contain' }} alt="Logo" />
              </div>
            ) : (
              <div style={{ padding: '14px 24px', background: hasBg ? 'rgba(255,255,255,0.95)' : `${primary}08`, borderRadius: 16, border: `2px dashed ${primary}60`, boxShadow: hasBg ? '0 4px 12px rgba(0,0,0,0.1)' : 'none' }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: primary, letterSpacing: '0.02em' }}>{data.company_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* MIDDLE SECTION: Features & Optional Laptop */}
        <div style={{ flex: 1, display: 'flex', padding: '0 64px', gap: 48, zIndex: 10, alignItems: 'center' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20, justifyContent: 'center' }}>
            {features.map((f, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 16,
                background: hasBg ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.6)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(226, 232, 240, 0.8)', borderRadius: 20,
                padding: '18px 22px', boxShadow: '0 8px 24px rgba(15,23,42,0.06)'
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: `linear-gradient(135deg, ${primary}12, ${primary}25)`, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, color: primary
                }}>
                  {getFeatureIcon(f)}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', marginBottom: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{f}</div>
                  <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.4, fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    Solución ideal para tu negocio.
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* LAPTOP ONLY IF NO BACKGROUND IMAGE */}
          {!hasBg && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div style={{ position: 'relative', width: 400, filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.12))' }}>
                <div style={{ background: '#1e293b', borderRadius: '16px 16px 0 0', padding: '12px 12px 0', border: '1px solid rgba(255,255,255,0.12)', borderBottom: 'none' }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#ff5f57' }} />
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#febc2e' }} />
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#28c840' }} />
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, height: 230, border: '1px solid rgba(0,0,0,0.04)' }}>
                    <div style={{ background: secondary, borderRadius: 6, padding: '8px 12px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#fff', fontSize: 10, fontWeight: 800 }}>{industry.mockup_title}</span>
                      <span style={{ color: primary, fontSize: 14, fontWeight: 900 }}>●</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      {industry.kpis.map((kpi, idx) => (
                        <div key={idx} style={{ flex: 1, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 6, textAlign: 'center' }}>
                          <div style={{ fontSize: 8, color: '#64748b', marginBottom: 2, fontWeight: 700 }}>{kpi.label}</div>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#0f172a' }}>{kpi.val}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 6, marginBottom: 8, display: 'flex', alignItems: 'flex-end', gap: 4, height: 62 }}>
                      {[35, 55, 45, 75, 50, 85, 65, 95].map((h, idx) => (
                        <div key={idx} style={{ flex: 1, background: idx === 7 ? primary : `${primary}45`, borderRadius: '2px 2px 0 0', height: `${h}%` }} />
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ background: '#e2e8f0', height: 12, borderRadius: '0 0 4px 4px', border: '1px solid #cbd5e1' }} />
                <div style={{ background: '#cbd5e1', height: 6, borderRadius: '0 0 10px 10px', width: '110%', marginLeft: '-5%' }} />
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM BENEFITS (Always visible, adapted) */}
        <div style={{ background: hasBg ? 'rgba(15,23,42,0.85)' : '#f8fafc', borderTop: hasBg ? 'none' : '1px solid #e2e8f0', padding: '22px 48px', display: 'flex', gap: 18, zIndex: 10, backdropFilter: hasBg ? 'blur(10px)' : 'none' }}>
          {features.slice(0, 3).map((feat, idx) => (
            <div key={idx} style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 12,
              background: hasBg ? 'rgba(255,255,255,0.1)' : '#fff',
              border: hasBg ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
              borderRadius: 14, padding: '14px 18px',
              boxShadow: hasBg ? 'none' : '0 4px 12px rgba(15,23,42,0.03)'
            }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>{getFeatureIcon(feat)}</span>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: hasBg ? '#fff' : primary, marginBottom: 2, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{feat}</div>
                <div style={{ fontSize: 11, color: hasBg ? 'rgba(255,255,255,0.7)' : '#64748b', fontWeight: 500 }}>Rápido y profesional.</div>
              </div>
            </div>
          ))}
        </div>

        {/* FOOTER */}
        <div style={{ background: secondary, padding: '18px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10, flexWrap: 'nowrap', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, maxWidth: '40%' }}>
            <div style={{ color: '#fff', fontSize: 18, fontWeight: 900, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.company_name}</div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              {phone && <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 700 }}>📱 {phone}</span>}
              {website && <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 600 }}>🌐 {website}</span>}
            </div>
          </div>
          <div style={{
            background: `linear-gradient(135deg, ${primary}, ${primary}cc)`,
            borderRadius: 10, padding: '12px 24px',
            color: '#fff', fontWeight: 800, fontSize: 13,
            boxShadow: `0 6px 15px ${primary}40`,
            whiteSpace: 'nowrap', flexShrink: 0,
            maxWidth: '50%', overflow: 'hidden', textOverflow: 'ellipsis'
          }}>
            {cta || 'Contáctanos HOY'}
          </div>
        </div>
      </div>
    );
  }
);
\nexport const FlyerTemplateB = React.forwardRef<HTMLDivElement, { data: FlyerData }>(
  ({ data }, ref) => {
    const parsed = parsePrompt(data.prompt);
    const primary = data.primaryColor || '#9b1c1c';
    const secondary = data.secondaryColor || '#1a1a2e';
    const price = data.price || parsed.price || derivePrice(data.prompt) || '';
    
    const industry = deriveIndustryContent(data.prompt, data);
    const rawFeatures = data.features || parsed.features || deriveFeatures(data.prompt);
    const defaultFeatures = industry.benefits.map(b => b.title).concat(['Soporte 24/7', 'Garantía Total']);
    const features: string[] = [];
    for (let i = 0; i < 4; i++) features.push(rawFeatures[i] || defaultFeatures[i] || 'Servicio Premium');

    const { h1, h2 } = deriveHeadline(data.prompt, data.company_name);
    const headline = data.headline || parsed.title || h1 || '¿Listo para lo mejor?';
    const subheadline = data.subheadline || parsed.subtitle || h2 || `${data.company_name} — Siempre a tu servicio`;
    const phone = data.phone || parsed.phone || derivePhone(data.prompt);
    const website = data.website || parsed.website || deriveWebsite(data.prompt);
    const cta = data.cta || parsed.cta || deriveCta(data.prompt, `Todo con ${data.company_name}`);

    const hasBg = !!data.bgImageUrl;

    return (
      <div ref={ref} style={{
        width: 1080, height: 1080,
        background: hasBg ? `url(${data.bgImageUrl}) center/cover no-repeat` : '#f8fafc',
        fontFamily: "'Outfit', 'Inter', 'Segoe UI', Arial, sans-serif",
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {!hasBg && (
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(#e2e8f0 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px', opacity: 0.5, pointerEvents: 'none'
          }} />
        )}
        
        {hasBg && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 45%, rgba(0,0,0,0.85) 100%)',
            pointerEvents: 'none', zIndex: 1
          }} />
        )}

        {/* HEADER SECTION */}
        <div style={{ paddingTop: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10, paddingLeft: 60, paddingRight: 60 }}>
          {data.logoUrl && (
            <div style={{ marginBottom: 20, background: hasBg ? 'rgba(255,255,255,0.95)' : 'transparent', padding: hasBg ? '10px 20px' : 0, borderRadius: 12 }}>
              <img src={data.logoUrl} crossOrigin="anonymous" style={{ maxHeight: 70, maxWidth: 200, objectFit: 'contain' }} alt="Logo" />
            </div>
          )}
          <h1 style={{
            fontSize: headline.length > 30 ? 40 : 50,
            fontWeight: 900,
            color: hasBg ? '#ffffff' : '#0f172a',
            textAlign: 'center', margin: 0, lineHeight: 1.1,
            textShadow: hasBg ? '0 4px 12px rgba(0,0,0,0.8)' : 'none',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
          }}>
            {headline}
          </h1>
          <p style={{
            fontSize: 22, fontWeight: 700,
            color: hasBg ? '#f1f5f9' : '#334155',
            textAlign: 'center', margin: '12px 0 0 0',
            textShadow: hasBg ? '0 2px 6px rgba(0,0,0,0.8)' : 'none',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
          }}>
            {subheadline}
          </p>
        </div>

        {/* MAIN CONTENT AREA */}
        <div style={{ flex: 1, position: 'relative', zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 60px' }}>
          
          {price && (
            <div style={{
              background: primary, color: '#fff',
              padding: '12px 32px', borderRadius: 16,
              fontWeight: 900, fontSize: 32,
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
              display: 'flex', alignItems: 'baseline', gap: 8,
              marginBottom: 30, transform: 'rotate(-2deg)'
            }}>
              <span style={{ fontSize: 16, fontWeight: 700, textTransform: 'uppercase' }}>Desde</span>
              <span>{price}</span>
            </div>
          )}

          {/* If no background, show the laptop layout. If background, show a beautiful Grid of features */}
          {hasBg ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, width: '100%', maxWidth: 800 }}>
              {features.map((feat, i) => (
                <div key={i} style={{
                  background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)',
                  padding: '24px', borderRadius: 20,
                  display: 'flex', alignItems: 'center', gap: 16,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.15)'
                }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: `${primary}15`, color: primary, fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {getFeatureIcon(feat)}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{feat}</div>
                </div>
              ))}
            </div>
          ) : (
             <div style={{ position: 'relative', width: '100%', height: 400, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ position: 'absolute', top: 20, left: 0, width: 220, textAlign: 'center' }}>
                  <div style={{ width: 70, height: 70, borderRadius: '50%', background: '#fff', border: `3px solid ${primary}`, color: primary, fontSize: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', boxShadow: '0 6px 16px rgba(0,0,0,0.08)' }}>{getFeatureIcon(features[0])}</div>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>{features[0]}</span>
                </div>
                <div style={{ position: 'absolute', bottom: 20, left: 0, width: 220, textAlign: 'center' }}>
                  <div style={{ width: 70, height: 70, borderRadius: '50%', background: '#fff', border: `3px solid ${primary}`, color: primary, fontSize: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', boxShadow: '0 6px 16px rgba(0,0,0,0.08)' }}>{getFeatureIcon(features[1])}</div>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>{features[1]}</span>
                </div>
                <div style={{ position: 'absolute', top: 20, right: 0, width: 220, textAlign: 'center' }}>
                  <div style={{ width: 70, height: 70, borderRadius: '50%', background: '#fff', border: `3px solid ${primary}`, color: primary, fontSize: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', boxShadow: '0 6px 16px rgba(0,0,0,0.08)' }}>{getFeatureIcon(features[2])}</div>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>{features[2]}</span>
                </div>
                <div style={{ position: 'absolute', bottom: 20, right: 0, width: 220, textAlign: 'center' }}>
                  <div style={{ width: 70, height: 70, borderRadius: '50%', background: '#fff', border: `3px solid ${primary}`, color: primary, fontSize: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', boxShadow: '0 6px 16px rgba(0,0,0,0.08)' }}>{getFeatureIcon(features[3])}</div>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>{features[3]}</span>
                </div>

                {/* Laptop Center */}
                <div style={{ width: 440, filter: 'drop-shadow(0 20px 35px rgba(0,0,0,0.12))', zIndex: 5 }}>
                  <div style={{ background: '#1e293b', borderRadius: '16px 16px 0 0', padding: '10px 10px 0', border: '1px solid rgba(255,255,255,0.12)', borderBottom: 'none' }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f57' }} />
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#febc2e' }} />
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#28c840' }} />
                    </div>
                    <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, height: 200, border: '1px solid rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '6px 10px', marginBottom: 8, borderRadius: 5 }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: '#334155' }}>{industry.mockup_title}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
                        {industry.kpis.map((kpi, idx) => (
                          <div key={idx} style={{ flex: 1, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 5, padding: '5px 6px' }}>
                            <div style={{ fontSize: 6, color: '#64748b', fontWeight: 700, marginBottom: 2 }}>{kpi.label}</div>
                            <div style={{ fontSize: 9, fontWeight: 900, color: '#0f172a' }}>{kpi.val}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{ background: '#cbd5e1', height: 12, borderRadius: '0 0 4px 4px', border: '1px solid #94a3b8' }} />
                  <div style={{ background: '#94a3b8', height: 6, borderRadius: '0 0 10px 10px', width: '112%', marginLeft: '-6%', borderTop: 'none' }} />
                </div>
             </div>
          )}
        </div>

        {/* PROMPTED TEXT */}
        <div style={{ padding: '20px 100px', textAlign: 'center', zIndex: 10 }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: hasBg ? '#fff' : '#0f172a', margin: 0, textShadow: hasBg ? '0 2px 8px rgba(0,0,0,0.8)' : 'none' }}>
            {industry.highlight_title}
          </h2>
        </div>

        {/* BOTTOM CARDS */}
        <div style={{ display: 'flex', gap: 20, zIndex: 10, padding: '0 60px 40px' }}>
          {industry.benefits.slice(0, 3).map((item, idx) => (
            <div key={idx} style={{
              flex: 1, background: hasBg ? 'rgba(255,255,255,0.9)' : '#fff', border: '1px solid #e2e8f0',
              borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
              boxShadow: hasBg ? '0 8px 24px rgba(0,0,0,0.3)' : '0 4px 12px rgba(15,23,42,0.04)'
            }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: `${primary}15`, color: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                {item.icon}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: primary, marginBottom: 2, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.title}</div>
                <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* FOOTER BAR */}
        <div style={{
          height: 72, background: primary, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 48px', zIndex: 10, flexShrink: 0
        }}>
          <div style={{ color: '#fff', fontSize: 16, fontWeight: 800, flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {data.company_name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexShrink: 0 }}>
            {phone && <span style={{ color: 'rgba(255,255,255,0.95)', fontSize: 15, fontWeight: 800 }}>📱 {phone}</span>}
            {website && <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: 700 }}>🌐 {website}</span>}
          </div>
          <div style={{
            background: '#090d16', color: '#fff', padding: '12px 28px', borderRadius: 24,
            fontWeight: 800, fontSize: 14, boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.1)', marginLeft: 32
          }}>
            {cta || 'Contáctanos HOY'}
          </div>
        </div>
      </div>
    );
  }
);
\nFlyerTemplateA.displayName = 'FlyerTemplateA';
FlyerTemplateB.displayName = 'FlyerTemplateB';
