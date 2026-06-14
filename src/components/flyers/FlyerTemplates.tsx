// FlyerTemplates.tsx — Professional HTML flyer templates
// These render pixel-perfect marketing flyers identical to Salesforce/Stripe quality
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

function deriveCta(prompt: string, defaultCta?: string): string {
  const match = prompt.match(/(?:cta|bot[oó]n|llamado a la acci[oó]n|acci[oó]n)\s*[:：]\s*([^\n|;.-]+)/i);
  if (match && match[1]) {
    return cleanPhrase(match[1]);
  }
  return defaultCta || 'Contáctanos HOY';
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
      width: 490,
      height: 310,
      background: hasBg ? 'rgba(15, 23, 42, 0.65)' : '#ffffff',
      backdropFilter: hasBg ? 'blur(20px)' : 'none',
      border: hasBg ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #e2e8f0',
      borderRadius: 20,
      boxShadow: hasBg ? '0 20px 50px rgba(0,0,0,0.3)' : '0 15px 30px rgba(15,23,42,0.06)',
      display: 'flex',
      overflow: 'hidden',
      fontFamily: "'Plus Jakarta Sans', sans-serif"
    }}>
      {/* Sidebar navigation */}
      <div style={{
        width: 120,
        background: hasBg ? 'rgba(30, 41, 59, 0.3)' : '#f8fafc',
        borderRight: hasBg ? '1px solid rgba(255,255,255,0.08)' : '1px solid #cbd5e1',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }}>
        {/* Brand Label inside sidebar */}
        <div style={{ fontSize: 10, fontWeight: 900, color: primary, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left' }}>
          🌐 {company}
        </div>
        {/* Sidebar menu items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
          {['Dashboard', 'Leads', 'Contactos', 'Pipelines', 'Tareas', 'Automatizaciones', 'Reportes', 'Configuración'].map((link, idx) => (
            <div key={link} style={{
              fontSize: 8,
              fontWeight: 800,
              padding: '6px 8px',
              borderRadius: 6,
              background: idx === 0 ? (hasBg ? 'rgba(255,255,255,0.1)' : `${primary}12`) : 'transparent',
              color: idx === 0 ? primary : (hasBg ? 'rgba(255,255,255,0.5)' : '#64748b'),
              cursor: 'pointer'
            }}>
              {link}
            </div>
          ))}
        </div>
      </div>

      {/* Main Dashboard body */}
      <div style={{ flex: 1, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Dashboard Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 900, color: hasBg ? '#fff' : '#0f172a' }}>Dashboard</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 10, opacity: 0.5 }}>🔍</span>
            <span style={{ fontSize: 10, opacity: 0.5 }}>🔔</span>
            <span style={{ width: 16, height: 16, borderRadius: '50%', background: primary, color: '#fff', fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>U</span>
          </div>
        </div>

        {/* KPI Cards Grid */}
        <div style={{ display: 'flex', gap: 8 }}>
          {industry.kpis.map((kpi, idx) => (
            <div key={idx} style={{
              flex: 1,
              background: hasBg ? 'rgba(255,255,255,0.04)' : '#ffffff',
              border: hasBg ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e2e8f0',
              borderRadius: 8,
              padding: 8,
              textAlign: 'left'
            }}>
              <div style={{ fontSize: 7, fontWeight: 700, color: hasBg ? 'rgba(255,255,255,0.6)' : '#64748b', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{kpi.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: hasBg ? '#fff' : '#0f172a' }}>{kpi.val}</span>
                <span style={{ fontSize: 7, color: '#10b981', fontWeight: 800 }}>{kpi.change}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Funnel and Activity grid split */}
        <div style={{ display: 'flex', gap: 12, flex: 1 }}>
          {/* Sales Funnel (Left) */}
          <div style={{
            width: 170,
            background: hasBg ? 'rgba(0,0,0,0.15)' : '#f8fafc',
            border: hasBg ? '1px solid rgba(255,255,255,0.04)' : '1px solid #f1f5f9',
            borderRadius: 12,
            padding: 8,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ fontSize: 7, fontWeight: 900, color: hasBg ? 'rgba(255,255,255,0.5)' : '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'left' }}>Embudo de Ventas</div>
            <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ width: 85 }}>
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
            padding: 8,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ fontSize: 7, fontWeight: 900, color: hasBg ? 'rgba(255,255,255,0.5)' : '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'left' }}>Actividad Reciente</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, justifyContent: 'center', textAlign: 'left' }}>
              {[
                { label: 'Nuevo lead ingresado', t: 'hace 2 min' },
                { label: 'AI Bot respondió chat', t: 'hace 5 min' },
                { label: 'Reunión agendada', t: 'hace 15 min' },
                { label: 'Negocio cerrado', t: 'hace 1 hora' }
              ].map((act, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, fontWeight: 600, color: hasBg ? '#cbd5e1' : '#475569' }}>
                  <span>✓ {act.label}</span>
                  <span style={{ opacity: 0.6 }}>{act.t}</span>
                </div>
              ))}
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
      height: 100,
      background: '#ffffff',
      borderTop: '1px solid #e2e8f0',
      padding: '12px 64px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxSizing: 'border-box',
      fontFamily: "'Plus Jakarta Sans', sans-serif"
    }}>
      {/* Left: Stack icons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 8, fontWeight: 900, color: '#94a3b8', letterSpacing: '0.05em' }}>STACK UTILIZADO</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 4 }}>
            ⚛️ React
          </span>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 4 }}>
            📘 TS
          </span>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 4 }}>
            🌊 Tailwind
          </span>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 4 }}>
            🟢 Express
          </span>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 4 }}>
            🍃 MongoDB
          </span>
        </div>
      </div>

      {/* Center: Build list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 8, fontWeight: 900, color: '#94a3b8', letterSpacing: '0.05em' }}>¿CÓMO LO CONSTRUI?</span>
        <div style={{ fontSize: 9, color: '#475569', fontWeight: 600, display: 'flex', gap: 10 }}>
          <span>• Frontend React + TypeScript</span>
          <span>• UI/UX limpio y responsive</span>
          <span>• Backend en Node.js + Express</span>
        </div>
      </div>

      {/* Right: Prompt terminal */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', maxWidth: '30%' }}>
        <span style={{ fontSize: 8, fontWeight: 900, color: '#94a3b8', letterSpacing: '0.05em' }}>PROMPT UTILIZADO PARA GOOGLE ANTIGRAVITY</span>
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 6,
          padding: '4px 8px',
          fontSize: 7,
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
          {data.cta || 'Agenda tu demo gratis →'}
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
    const primary = data.primaryColor || '#0070d2';
    const secondary = data.secondaryColor || '#7c3aed';
    const price = data.price || parsed.price || derivePrice(data.prompt);
    const features = (data.features || parsed.features || deriveFeatures(data.prompt)).slice(0, 3);
    const { h1, h2 } = deriveHeadline(data.prompt, data.company_name);
    const headline = data.headline || parsed.title || h1;
    const subheadline = data.subheadline || parsed.subtitle || h2;
    
    const hasBg = !!data.bgImageUrl;
    const indData = getIndustryData(data.prompt);

    // Split title to apply gradient color to last word
    const titleWords = headline.split(' ');
    const lastWord = titleWords.length > 1 ? titleWords.pop() : '';
    const mainTitle = titleWords.join(' ');

    return (
      <div ref={ref} style={{
        width: 1080, height: 1080,
        background: hasBg 
          ? `url(${data.bgImageUrl}) center/cover no-repeat` 
          : `radial-gradient(circle at 80% 20%, ${primary}12 0%, transparent 60%), radial-gradient(circle at 20% 80%, ${secondary}08 0%, transparent 60%), #ffffff`,
        fontFamily: "'Plus Jakarta Sans', 'Outfit', sans-serif",
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box'
      }}>
        {/* Load Google Fonts directly in the render flow */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Syne:wght@700;800&display=swap" />

        {!hasBg && (
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(#e2e8f0 1.2px, transparent 1.2px)',
            backgroundSize: '35px 35px',
            opacity: 0.45,
            pointerEvents: 'none'
          }} />
        )}
        
        {hasBg && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.4) 45%, rgba(255,255,255,0.95) 100%)',
            pointerEvents: 'none', zIndex: 1
          }} />
        )}

        {/* TOP / MAIN AREA (720px) */}
        <div style={{ flex: 1, display: 'flex', padding: '54px 64px 0', gap: 40, zIndex: 10, position: 'relative' }}>
          
          {/* Left Column: Brand, Headline, Features (480px width) */}
          <div style={{ width: 440, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start' }}>
            {/* Tagline */}
            <div style={{ fontSize: 11, fontWeight: 900, color: secondary, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12, textAlign: 'left' }}>
              {indData.tagline}
            </div>

            {/* Headline */}
            <h1 style={{
              fontSize: headline.length > 25 ? 38 : 46,
              fontWeight: 800,
              color: '#0f172a',
              lineHeight: 1.1,
              margin: '0 0 14px 0',
              textAlign: 'left',
              letterSpacing: '-0.02em',
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'
            }}>
              {mainTitle} {lastWord && <span style={{ color: primary }}>{lastWord}.</span>}
            </h1>

            {/* Description */}
            <p style={{
              fontSize: 13,
              fontWeight: 500,
              color: '#475569',
              lineHeight: 1.5,
              margin: '0 0 28px 0',
              textAlign: 'left',
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'
            }}>
              {subheadline}
            </p>

            {/* Feature stack */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>
              {features.map((feat, idx) => {
                const industryFeature = indData.features[idx] || { title: feat, desc: 'Centraliza y optimiza tu gestión comercial.' };
                const checkIcons = ['🎯', '🤖', '📈'];
                const icon = checkIcons[idx] || '✓';
                return (
                  <div key={idx} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', textAlign: 'left' }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10,
                      background: `${primary}12`, color: primary,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, flexShrink: 0
                    }}>
                      {icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 2 }}>{industryFeature.title}</div>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, lineHeight: 1.4 }}>{industryFeature.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Dashboard Mockup & Chatbot Widget */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'flex-end' }}>
            {/* Dashboard card */}
            {renderDashboardMockup(data.prompt, primary, false, indData, data.company_name)}

            {/* Chatbot & Robot row */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginRight: 20 }}>
              {renderChatbotWidget(indData, primary, false)}
              {renderRobotSVG(primary)}
            </div>
          </div>
        </div>

        {/* MIDDLE PIPELINE TIMELINE BANNER (100px) */}
        <div style={{ height: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>🌙 Tú descansas</span>
            <span style={{ height: 1, width: 60, borderTop: '2px dashed #cbd5e1' }} />
            <span style={{ fontSize: 18 }}>🤖</span>
            <span style={{ height: 1, width: 60, borderTop: '2px dashed #cbd5e1' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>💰 Tu negocio vende</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 900, color: primary, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Automatiza. Delega. Escala.</div>
        </div>

        {/* BOTTOM DARK BANNER (260px) */}
        {renderBottomBanner(primary, secondary, data, indData, false)}

        {/* VERY BOTTOM TECH DETAILS BAR (100px) */}
        {renderTechStackFooter(data.prompt)}
      </div>
    );
  }
);

// ── TEMPLATE B — Studio Bold / Minimal Editorial (Stripe/Linear Dark Style) ────────
export const FlyerTemplateB = React.forwardRef<HTMLDivElement, { data: FlyerData }>(
  ({ data }, ref) => {
    const parsed = parsePrompt(data.prompt);
    const primary = data.primaryColor || '#635bff'; // Stripe purple/blue
    const secondary = data.secondaryColor || '#00d4ff'; // Cyan
    const price = data.price || parsed.price || derivePrice(data.prompt) || '';
    const features = (data.features || parsed.features || deriveFeatures(data.prompt)).slice(0, 3);
    const { h1, h2 } = deriveHeadline(data.prompt, data.company_name);
    const headline = data.headline || parsed.title || h1;
    const subheadline = data.subheadline || parsed.subtitle || h2;
    
    const hasBg = !!data.bgImageUrl;
    const indData = getIndustryData(data.prompt);

    // Split title to apply gradient color to last word
    const titleWords = headline.split(' ');
    const lastWord = titleWords.length > 1 ? titleWords.pop() : '';
    const mainTitle = titleWords.join(' ');

    return (
      <div ref={ref} style={{
        width: 1080, height: 1080,
        background: hasBg 
          ? `url(${data.bgImageUrl}) center/cover no-repeat` 
          : `radial-gradient(circle at 90% 10%, ${primary}20 0%, transparent 60%), radial-gradient(circle at 10% 90%, ${secondary}15 0%, transparent 60%), #090d16`,
        fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif",
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box'
      }}>
        {/* Load Google Fonts directly in the render flow */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Syne:wght@700;800&display=swap" />

        {hasBg && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(9,13,22,0.9) 0%, rgba(9,13,22,0.65) 45%, rgba(9,13,22,0.95) 100%)',
            pointerEvents: 'none', zIndex: 1
          }} />
        )}

        {/* TOP / MAIN AREA (720px) */}
        <div style={{ flex: 1, display: 'flex', padding: '54px 64px 0', gap: 40, zIndex: 10, position: 'relative' }}>
          
          {/* Left Column: Brand, Headline, Features (440px width) */}
          <div style={{ width: 440, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start' }}>
            {/* Tagline */}
            <div style={{ fontSize: 11, fontWeight: 900, color: secondary, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12, textAlign: 'left' }}>
              ⚡ {indData.tagline}
            </div>

            {/* Headline */}
            <h1 style={{
              fontSize: headline.length > 25 ? 38 : 46,
              fontWeight: 800,
              fontFamily: "'Syne', sans-serif",
              color: '#ffffff',
              lineHeight: 1.1,
              margin: '0 0 14px 0',
              textAlign: 'left',
              letterSpacing: '-0.02em',
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'
            }}>
              {mainTitle} {lastWord && <span style={{ color: primary }}>{lastWord}.</span>}
            </h1>

            {/* Description */}
            <p style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.7)',
              lineHeight: 1.5,
              margin: '0 0 28px 0',
              textAlign: 'left',
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'
            }}>
              {subheadline}
            </p>

            {/* Feature stack */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>
              {features.map((feat, idx) => {
                const industryFeature = indData.features[idx] || { title: feat, desc: 'Centraliza y optimiza tu gestión comercial.' };
                const checkIcons = ['🎯', '🤖', '📈'];
                const icon = checkIcons[idx] || '✓';
                return (
                  <div key={idx} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', textAlign: 'left' }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10,
                      background: 'rgba(255,255,255,0.06)', color: primary,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, flexShrink: 0,
                      border: '1px solid rgba(255,255,255,0.08)'
                    }}>
                      {icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', marginBottom: 2 }}>{industryFeature.title}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 500, lineHeight: 1.4 }}>{industryFeature.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Dark Glassmorphic Dashboard Mockup & Chatbot Widget */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'flex-end' }}>
            {/* Dashboard card */}
            {renderDashboardMockup(data.prompt, primary, true, indData, data.company_name)}

            {/* Chatbot & Robot row */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginRight: 20 }}>
              {renderChatbotWidget(indData, primary, true)}
              {renderRobotSVG(primary)}
            </div>
          </div>
        </div>

        {/* MIDDLE PIPELINE TIMELINE BANNER (100px) */}
        <div style={{ height: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>🌙 Tú descansas</span>
            <span style={{ height: 1, width: 60, borderTop: '2px dashed rgba(255,255,255,0.2)' }} />
            <span style={{ fontSize: 18 }}>🤖</span>
            <span style={{ height: 1, width: 60, borderTop: '2px dashed rgba(255,255,255,0.2)' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>💰 Tu negocio vende</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 900, color: primary, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Automatiza. Delega. Escala.</div>
        </div>

        {/* BOTTOM DARK BANNER (260px) */}
        {renderBottomBanner(primary, secondary, data, indData, true)}

        {/* VERY BOTTOM TECH DETAILS BAR (100px) */}
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
  const positionStart = React.useRef({ x: 0, y: 0 });

  const startDrag = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    positionStart.current = { x: d.logoX, y: d.logoY };
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);
  };

  const onDrag = (e: MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    // Calculate percentage shift relative to container width/height
    const pctX = (dx / d.containerW) * 100;
    const pctY = (dy / d.containerH) * 100;
    
    let newX = Math.min(Math.max(positionStart.current.x + pctX, 0), 90);
    let newY = Math.min(Math.max(positionStart.current.y + pctY, 0), 90);
    onMove(newX, newY);
  };

  const endDrag = () => {
    isDragging.current = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', endDrag);
  };

  if (!d.logoUrl) return null;

  return (
    <div style={{
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
