export interface PainPlaybook {
  id: string;
  label: string;
  product_hint: string;
  keywords: string[];
  strong_modules: string;
  value_proposition: string;
  qualifying_question: string;
  is_active: boolean;
}

export interface BusinessHoursConfig {
  days: number[]; // 0=Sun .. 6=Sat (Mon-Fri = [1,2,3,4,5])
  start: string;  // "08:00"
  end: string;    // "17:30"
  sat_enabled?: boolean;
  sat_start?: string;
  sat_end?: string;
}

export interface DemoSlot {
  index: number;
  startIso: string;
  endIso: string;
  label: string;
}

export interface RoutingRuleLike {
  id: string;
  name: string;
  product_id: string | null;
  strategy: 'fixed' | 'round_robin';
  assignee_user_ids: string[];
  last_assigned_index: number;
  notify_extra_user_ids: string[];
  priority: number;
  is_active: boolean;
}

export interface QualifierAiTurnOutput {
  reply: string;
  action: 'continue' | 'offer_slots' | 'book_demo' | 'handoff_human' | 'close_not_interested';
  selected_slot_index: number | null;
  detected_pain: string | null;
  detected_volume: string | null;
  summary_for_advisor: string;
}

export const DEFAULT_TZ = 'America/El_Salvador';

export const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
  days: [1, 2, 3, 4, 5],
  start: '08:00',
  end: '17:30',
  sat_enabled: true,
  sat_start: '08:00',
  sat_end: '12:00',
};

export const DEFAULT_HANDOFF_KEYWORDS: string[] = [
  'hablar con alguien',
  'persona real',
  'asesor humano',
  'hablar con un asesor',
  'hablar con un humano',
  'paseme con alguien',
  'pásame con alguien',
  'pasame un asesor',
  'llamame',
  'llámeme',
  'llamarme',
  'quiero una llamada',
  'eres un bot',
  'eres robot',
  'quiero contratar',
  'ya quiero contratar',
  'mandeme contrato',
  'mándeme contrato',
  'donde firmo',
  'necesito soporte humano',
];

export const DEFAULT_PAIN_PLAYBOOKS: PainPlaybook[] = [
  {
    id: 'inventarios_productos',
    label: 'Inventarios y Productos',
    product_hint: 'ERP',
    keywords: ['inventario', 'inventarios', 'bodega', 'stock', 'kardex', 'productos', 'existencias'],
    strong_modules: 'Control de Inventario en Tiempo Real, Kardex Automático Multi-Bodega y Mínimos de Stock',
    value_proposition:
      'Con nuestro módulo de Inventarios eliminas las hojas de Excel: cada venta descuenta automáticamente tus existencias por bodega, te alerta antes de quedarte sin producto y cuadra tus costos al centavo.',
    qualifying_question: '¿Actualmente cuántas bodegas o puntos de venta manejan y cuántos códigos aproximados tienen?',
    is_active: true,
  },
  {
    id: 'facturacion_dte',
    label: 'Facturación Electrónica DTE',
    product_hint: 'ERP',
    keywords: ['facturacion', 'facturación', 'dte', 'hacienda', 'factura electronica', 'ticket'],
    strong_modules: 'Facturación Electrónica DTE 100% certificada con Hacienda, Anulaciones, Créditos Fiscales y Envío Automático',
    value_proposition:
      'Nuestra Facturación Electrónica DTE transmite directo al Ministerio de Hacienda en segundos sin pasos manuales, genera tus libros de IVA listos para F07/F14 y evita rechazos o multas.',
    qualifying_question: '¿Ya están emitiendo DTE hoy con otro proveedor o sería su primera implementación con Hacienda?',
    is_active: true,
  },
  {
    id: 'control_integral',
    label: 'Control Integral del Negocio',
    product_hint: 'ERP',
    keywords: ['control integral', 'integral', 'todo el negocio', 'administrar', 'automatizar', 'gerencia'],
    strong_modules: 'ERP Todo-en-Uno: Facturación DTE, Inventarios, Cuentas por Cobrar/Pagar, Bancos y Rentabilidad en Tiempo Real',
    value_proposition:
      'Conectamos tus ventas, compras, inventario, caja y contabilidad en una sola pantalla para que veas utilidad real y flujo de efectivo al instante sin cuadrar archivos dispersos.',
    qualifying_question: '¿Qué parte te quita más horas hoy en el cierre diario o mensual: compras, cobros o reportes?',
    is_active: true,
  },
  {
    id: 'contabilidad_finanzas',
    label: 'Contabilidad y Finanzas',
    product_hint: 'ERP',
    keywords: ['contabilidad', 'finanzas', 'libros de iva', 'iva', 'f07', 'f14', 'conciliacion', 'cuentas'],
    strong_modules: 'Contabilidad Integrada Automática, Libros de IVA (F07/F14), CxC/CxP y Estados Financieros al Día',
    value_proposition:
      'Cada factura y gasto genera automáticamente sus partidas contables y libros de IVA listos para Hacienda, ahorrando días de digitación y errores de cuadre.',
    qualifying_question: '¿Su contador trabaja interno en la empresa o externo, y qué es lo que más tiempo les toma cerrar al mes?',
    is_active: true,
  },
  {
    id: 'ventas_compras',
    label: 'Ventas y Compras',
    product_hint: 'ERP',
    keywords: ['ventas', 'compras', 'pos', 'punto de venta', 'cotizaciones', 'pedidos', 'clientes'],
    strong_modules: 'POS Ágil con DTE, Cotizaciones a Pedido en 1 Clic, Control de Precios/Descuentos y Margen por Vendedor',
    value_proposition:
      'Aceleramos tu punto de venta y tus compras a proveedores actualizando precios, márgenes y comisiones en automático.',
    qualifying_question: '¿Su operación es más de tienda/mostrador, rutas de vendedores o ventas corporativas?',
    is_active: true,
  },
  {
    id: 'siple_lotes',
    label: 'SIPLE · Lotificadoras y Cobros de Lotes',
    product_hint: 'SIPLE',
    keywords: ['siple', 'lote', 'lotes', 'lotific', 'proyectos', 'cuotas', 'inmobiliaria', 'parcelacion'],
    strong_modules: 'SIPLE: Gestión de Proyectos y Lotes, Tablas de Amortización, Cobros, Moras Automáticas y Portal de Clientes',
    value_proposition:
      'Con SIPLE controlas cada lote (disponible, reservado o vendido), calculas primas, cuotas e intereses por mora al instante y emites recibos/DTE sin perder el rastro de ningún pago.',
    qualifying_question: '¿Cuántos proyectos o lotes activos manejan actualmente y cuántos cobros mensuales procesan?',
    is_active: true,
  },
];

export const DEFAULT_QUALIFIER_SYSTEM_PROMPT = `Eres el Asesor Comercial Consultivo de Arias Defense Components en El Salvador (ERP + Facturación Electrónica DTE + Contabilidad + Inventarios + SIPLE).
Tu meta por WhatsApp es:
1. Responder cálido, humano, profesional y breve (máximo 4 líneas por mensaje, sin listas largas).
2. Usar la información que el prospecto ya llenó en el formulario (NO le vuelvas a preguntar lo que ya sabes).
3. Atacar exactamente su "Punto de Mejora (Dolor)" conectándolo con nuestros módulos fuertes.
4. Resolver dudas iniciales sin inventar precios ni contratos falsos.
5. Llevar la conversación de forma natural a agendar una Demo en vivo de 30 minutos con Google Meet dentro de los horarios reales disponibles.
6. Cuando el cliente quiera hablar con una persona real, pida llamada directa o diga que ya quiere contratar, responde con acción "handoff_human".`;

export const DEFAULT_FIRST_TOUCH_TEMPLATE = `Hola {nombre}, ¡qué gusto saludarle de parte de Arias Defense! 👋

Vimos su registro para {empresa} donde nos indicó que buscan mejorar *{dolor}*. {propuesta_dolor}

{pregunta_dolor}`;

export const DEFAULT_HANDOFF_BUSINESS_REPLY =
  '¡Con mucho gusto, {nombre}! Ya trasladé tu caso y todo tu diagnóstico a {asesor}, quien te contactará en los próximos minutos para atenderte personalmente. 🤝';

export const DEFAULT_HANDOFF_AFTER_HOURS_REPLY =
  '¡Con mucho gusto, {nombre}! Ya dejé tu caso marcado como prioritario para {asesor} a primera hora de mañana. Si deseas adelantar, puedes indicarme cuál horario de mañana te queda mejor para tu llamada/demo. 🙌';

export function normalizeQualifierText(raw: unknown): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function isGoogleSheetsLead(
  lead: { source?: string | null; raw_meta_payload?: Record<string, any> | null } | null | undefined,
): boolean {
  if (!lead || typeof lead !== 'object') return false;
  const src = String(lead.source || '').toLowerCase().trim();
  if (src.includes('sheet')) return true;
  const payload =
    lead.raw_meta_payload && typeof lead.raw_meta_payload === 'object' ? lead.raw_meta_payload : null;
  if (!payload) return false;
  const payloadSource = String(payload.source || '').toLowerCase().trim();
  if (payloadSource.includes('sheet')) return true;
  return Boolean(payload.sheet_name && String(payload.sheet_name).trim().length > 0);
}

function isBusinessNameLike(raw?: string | null): boolean {
  const clean = String(raw || '').replace(/\(\+?\d+\)/g, '').trim();
  if (!clean) return true;
  if (/^(sin\s+nombre|contacto|cliente|prospecto|lead|admin|usuario|desconocido|\+?\d+)/i.test(clean)) {
    return true;
  }
  return /\b(inversiones|lotificaci[oó]n|lotificadora|comedor|constructora|corporaci[oó]n|corp\b|grupo|residencial|tienda|ferreter[ií]a|cl[ií]nica|hotel|restaurante|farmacia|supermercado|distribuidora|importadora|servicios|soluciones|agencia|asociaci[oó]n|fundaci[oó]n|iglesia|colegio|escuela|laboratorio|sal[oó]n|transporte|log[ií]stica|inmobiliaria|bienes\s+ra[ií]ces|desarrollos|almac[eé]n|mayorista|s\.a\.|de\s+c\.v\.)\b/i.test(
    clean,
  );
}

export function extractLeadFirstName(fullName?: string | null): string {
  const clean = String(fullName || '').replace(/\(\+?\d+\)/g, '').trim();
  if (!clean || isBusinessNameLike(clean)) return '';
  if (/[_@]/.test(clean)) return '';
  const withoutTitle = clean
    .replace(/^(lic(da|do)?|ing|arq|dr|dra|sr|sra|srta|don|doña|prof|abog|pastor|cnel|gral)\.?\s+/i, '')
    .trim();
  if (!withoutTitle) return '';
  const tokens = withoutTitle.split(/[\s,.-]+/).filter(Boolean);
  const first = tokens[0] || '';
  if (first.length < 2 || /\d/.test(first)) return '';
  if (tokens.length === 1 && first.length > 10) return '';
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function matchPainPlaybook(
  playbooks: PainPlaybook[],
  context: { painText?: string | null; productLabel?: string | null; adName?: string | null },
): PainPlaybook | null {
  const active = (playbooks || []).filter((p) => p && p.is_active !== false);
  if (active.length === 0) return null;

  const normPain = normalizeQualifierText(context.painText);
  const normProduct = normalizeQualifierText(context.productLabel);
  const normAd = normalizeQualifierText(context.adName);

  // 1. Direct match on pain field
  if (normPain) {
    for (const pb of active) {
      if ((pb.keywords || []).some((kw) => normPain.includes(normalizeQualifierText(kw)))) {
        return pb;
      }
    }
  }

  // 2. Match SIPLE if product/ad is SIPLE
  if (normProduct.includes('siple') || /\bsiple\b|\blotes?\b|lotific/i.test(normAd)) {
    const siplePb = active.find(
      (pb) =>
        normalizeQualifierText(pb.product_hint) === 'siple' ||
        (pb.keywords || []).some((kw) => normalizeQualifierText(kw).includes('siple')),
    );
    if (siplePb) return siplePb;
  }

  // 3. Fallback matching ad name keywords
  if (normAd) {
    for (const pb of active) {
      if ((pb.keywords || []).some((kw) => normAd.includes(normalizeQualifierText(kw)))) {
        return pb;
      }
    }
  }

  // 4. Default to Control Integral or first active ERP playbook
  return (
    active.find((pb) => pb.id === 'control_integral') ||
    active[0]
  );
}

export function renderFirstTouchMessage(
  template: string,
  playbook: PainPlaybook | null,
  leadContext: {
    name?: string | null;
    companyName?: string | null;
    painText?: string | null;
    senderSignature?: string | null;
  },
): string {
  const firstName = extractLeadFirstName(leadContext.name);
  const company =
    leadContext.companyName && leadContext.companyName.trim().length > 1
      ? leadContext.companyName.trim()
      : 'su empresa';
  const dolor =
    leadContext.painText && leadContext.painText.trim()
      ? leadContext.painText.trim()
      : playbook?.label || 'sus procesos administrativos';
  const propuesta = playbook?.value_proposition || '';
  const pregunta =
    playbook?.qualifying_question ||
    '¿Le gustaría que revisemos en una demo breve de 20 minutos cómo quedaría aplicado a su negocio?';
  const firma = leadContext.senderSignature || 'Arias Defense';

  const tpl = (template || DEFAULT_FIRST_TOUCH_TEMPLATE).trim();
  let out = tpl
    .replace(/\{nombre\}/gi, firstName)
    .replace(/\{empresa\}/gi, company)
    .replace(/\{dolor\}/gi, dolor)
    .replace(/\{propuesta_dolor\}/gi, propuesta)
    .replace(/\{pregunta_dolor\}/gi, pregunta)
    .replace(/\{firma\}/gi, firma);

  out = out
    .replace(/Hola\s+,/gi, 'Hola,')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return out;
}

export function detectExplicitHandoffIntent(text: string, customKeywords?: string[]): {
  isHandoff: boolean;
  reason: string | null;
} {
  const norm = normalizeQualifierText(text);
  if (!norm) return { isHandoff: false, reason: null };

  const keywords =
    Array.isArray(customKeywords) && customKeywords.length > 0
      ? customKeywords
      : DEFAULT_HANDOFF_KEYWORDS;

  for (const kw of keywords) {
    const nkw = normalizeQualifierText(kw);
    if (nkw && norm.includes(nkw)) {
      return { isHandoff: true, reason: `Palabra clave detectada: "${kw}"` };
    }
  }

  if (
    /\b(pasame|p[aá]seme|comunicame|comun[ií]came|conectar|hablar)\b.*\b(alguien|humano|persona|asesor|ejecutivo|agente|vendedor)\b/i.test(
      norm,
    )
  ) {
    return { isHandoff: true, reason: 'Solicitó atención directa con un asesor humano' };
  }

  if (/\b(deja de molestar|no me escriba un bot|basta|molesto)\b/i.test(norm)) {
    return { isHandoff: true, reason: 'Señal de frustración / requiere intervención humana' };
  }

  return { isHandoff: false, reason: null };
}

function parseHhMm(hhmm: string | undefined, fallbackMinutes: number): number {
  const match = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallbackMinutes;
  const h = Math.min(23, Math.max(0, Number(match[1])));
  const m = Math.min(59, Math.max(0, Number(match[2])));
  return h * 60 + m;
}

export function getZonedParts(date: Date, timezone = DEFAULT_TZ): {
  year: number;
  month: number;
  day: number;
  dayOfWeek: number; // 0=Sun..6=Sat
  hour: number;
  minute: number;
  minutesSinceMidnight: number;
} {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || DEFAULT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const byType = new Map<string, string>();
  for (const p of parts) {
    byType.set(p.type, p.value);
  }
  const wkMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const hourRaw = Number(byType.get('hour') || 0);
  const hour = hourRaw === 24 ? 0 : hourRaw;
  const minute = Number(byType.get('minute') || 0);
  return {
    year: Number(byType.get('year') || date.getUTCFullYear()),
    month: Number(byType.get('month') || 1),
    day: Number(byType.get('day') || 1),
    dayOfWeek: wkMap[byType.get('weekday') || 'Mon'] ?? 1,
    hour,
    minute,
    minutesSinceMidnight: hour * 60 + minute,
  };
}

export function isWithinBusinessHours(
  date: Date,
  businessHours?: Partial<BusinessHoursConfig> | null,
  timezone = DEFAULT_TZ,
): boolean {
  const cfg: BusinessHoursConfig = {
    ...DEFAULT_BUSINESS_HOURS,
    ...(businessHours || {}),
  };
  const zoned = getZonedParts(date, timezone);

  if (zoned.dayOfWeek === 6) {
    if (!cfg.sat_enabled) return false;
    const startMin = parseHhMm(cfg.sat_start, 8 * 60);
    const endMin = parseHhMm(cfg.sat_end, 12 * 60);
    return zoned.minutesSinceMidnight >= startMin && zoned.minutesSinceMidnight < endMin;
  }

  const allowedDays = Array.isArray(cfg.days) ? cfg.days : DEFAULT_BUSINESS_HOURS.days;
  if (!allowedDays.includes(zoned.dayOfWeek)) return false;

  const startMin = parseHhMm(cfg.start, 8 * 60);
  const endMin = parseHhMm(cfg.end, 17 * 60 + 30);
  return zoned.minutesSinceMidnight >= startMin && zoned.minutesSinceMidnight < endMin;
}

function getTimeZoneOffsetMs(date: Date, timezone: string): number {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone || DEFAULT_TZ }));
  return tzDate.getTime() - utcDate.getTime();
}

function zonedWallClockToDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  const guessUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  const offset = getTimeZoneOffsetMs(guessUtc, timezone);
  return new Date(guessUtc.getTime() - offset);
}

const SLOT_LABEL_DAY_FMT_CACHE = new Map<string, Intl.DateTimeFormat>();
function formatSlotLabel(start: Date, timezone: string): string {
  let fmt = SLOT_LABEL_DAY_FMT_CACHE.get(timezone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('es-SV', {
      timeZone: timezone || DEFAULT_TZ,
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    SLOT_LABEL_DAY_FMT_CACHE.set(timezone, fmt);
  }
  const raw = fmt.format(start);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function generateAvailableDemoSlots(input: {
  now?: Date;
  businessHours?: Partial<BusinessHoursConfig> | null;
  timezone?: string;
  durationMinutes?: number;
  bufferMinutes?: number;
  busyIntervals?: Array<{ start: string | Date; end: string | Date }>;
  count?: number;
}): DemoSlot[] {
  const now = input.now || new Date();
  const timezone = input.timezone || DEFAULT_TZ;
  const cfg: BusinessHoursConfig = {
    ...DEFAULT_BUSINESS_HOURS,
    ...(input.businessHours || {}),
  };
  const durationMin = Math.max(15, Math.min(120, Number(input.durationMinutes) || 30));
  const bufferMin = Math.max(0, Math.min(60, Number(input.bufferMinutes ?? 15)));
  const targetCount = Math.max(1, Math.min(6, Number(input.count) || 3));

  const busy = (input.busyIntervals || [])
    .map((b) => ({
      startMs: new Date(b.start).getTime() - bufferMin * 60_000,
      endMs: new Date(b.end).getTime() + bufferMin * 60_000,
    }))
    .filter((b) => Number.isFinite(b.startMs) && Number.isFinite(b.endMs) && b.endMs > b.startMs);

  const minLeadNoticeMs = 60 * 60_000; // at least 1 hour from now
  const earliestAllowedMs = now.getTime() + minLeadNoticeMs;
  const stepMin = 60; // clean top-of-hour or 1h step options for WhatsApp readability
  const baseZoned = getZonedParts(now, timezone);

  const slots: DemoSlot[] = [];

  for (let dayOffset = 0; dayOffset < 10 && slots.length < targetCount; dayOffset++) {
    const probeMidday = new Date(
      Date.UTC(baseZoned.year, baseZoned.month - 1, baseZoned.day + dayOffset, 18, 0, 0),
    );
    const dayParts = getZonedParts(probeMidday, timezone);

    const isSat = dayParts.dayOfWeek === 6;
    const isWorkingDay = isSat
      ? Boolean(cfg.sat_enabled)
      : (cfg.days || DEFAULT_BUSINESS_HOURS.days).includes(dayParts.dayOfWeek);

    if (!isWorkingDay) continue;

    const startMin = parseHhMm(isSat ? cfg.sat_start : cfg.start, 8 * 60);
    const endMin = parseHhMm(isSat ? cfg.sat_end : cfg.end, isSat ? 12 * 60 : 17 * 60 + 30);

    // Pick at most 2 slots per day so options span more than 1 day if helpful
    let perDayCount = 0;
    for (let m = startMin; m + durationMin <= endMin && slots.length < targetCount && perDayCount < 2; m += stepMin) {
      const hour = Math.floor(m / 60);
      const minute = m % 60;
      const slotStart = zonedWallClockToDate(
        dayParts.year,
        dayParts.month,
        dayParts.day,
        hour,
        minute,
        timezone,
      );
      const slotStartMs = slotStart.getTime();
      const slotEndMs = slotStartMs + durationMin * 60_000;

      if (slotStartMs < earliestAllowedMs) continue;

      const overlapsBusy = busy.some((b) => slotStartMs < b.endMs && slotEndMs > b.startMs);
      if (overlapsBusy) continue;

      slots.push({
        index: slots.length + 1,
        startIso: slotStart.toISOString(),
        endIso: new Date(slotEndMs).toISOString(),
        label: formatSlotLabel(slotStart, timezone),
      });
      perDayCount++;
      // Jump extra hour between options on the same day so they offer morning & afternoon contrast
      m += 60;
    }
  }

  return slots;
}

export function selectNextAdvisorFromRules(
  rules: RoutingRuleLike[],
  productId?: string | null,
): {
  rule: RoutingRuleLike | null;
  advisorId: string | null;
  nextIndex: number;
  notifyExtraUserIds: string[];
} {
  const active = (rules || [])
    .filter((r) => r && r.is_active !== false && Array.isArray(r.assignee_user_ids) && r.assignee_user_ids.length > 0)
    .sort((a, b) => (a.priority ?? 10) - (b.priority ?? 10));

  if (active.length === 0) {
    return { rule: null, advisorId: null, nextIndex: -1, notifyExtraUserIds: [] };
  }

  const productRule = productId ? active.find((r) => r.product_id === productId) : undefined;
  const fallbackRule = active.find((r) => !r.product_id);
  const chosen = productRule || fallbackRule || active[0];

  const pool = chosen.assignee_user_ids.filter(Boolean);
  if (pool.length === 0) {
    return { rule: chosen, advisorId: null, nextIndex: -1, notifyExtraUserIds: chosen.notify_extra_user_ids || [] };
  }

  if (chosen.strategy === 'fixed' || pool.length === 1) {
    return {
      rule: chosen,
      advisorId: pool[0],
      nextIndex: 0,
      notifyExtraUserIds: (chosen.notify_extra_user_ids || []).filter((id) => id && id !== pool[0]),
    };
  }

  const prevIdx = Number.isFinite(chosen.last_assigned_index) ? chosen.last_assigned_index : -1;
  const nextIndex = (prevIdx + 1) % pool.length;
  const advisorId = pool[nextIndex];

  return {
    rule: chosen,
    advisorId,
    nextIndex,
    notifyExtraUserIds: (chosen.notify_extra_user_ids || []).filter((id) => id && id !== advisorId),
  };
}

export function buildAdvisorWhatsAppAlert(input: {
  eventType: 'urgent_intake' | 'handoff_human' | 'demo_booked' | 'sla_escalation';
  lead: {
    id: string;
    name?: string | null;
    company_name?: string | null;
    phone?: string | null;
    productLabel?: string | null;
  };
  painText?: string | null;
  urgencyText?: string | null;
  roleTitle?: string | null;
  summary?: string | null;
  demoSlotLabel?: string | null;
  meetLink?: string | null;
  advisorName?: string | null;
  crmBaseUrl?: string | null;
}): string {
  const baseUrl = String(input.crmBaseUrl || 'https://ariascrm.com').replace(/\/+$/, '');
  const deepLink = `${baseUrl}/leads?lead=${input.lead.id}`;

  const headerByEvent: Record<typeof input.eventType, string> = {
    urgent_intake: '🔥 *LEAD CALIENTE NUEVO (Urgencia Alta)*',
    handoff_human: '🙋 *LEAD PIDE HABLAR CON ASESOR*',
    demo_booked: '📅 *DEMO AGENDADA AUTOMÁTICAMENTE*',
    sla_escalation: `⏱️ *ALERTA SLA — Sin respuesta aún (${input.advisorName || 'Asesor'})*`,
  };

  const leadLine = [input.lead.name, input.lead.company_name].filter(Boolean).join(' · ') || 'Prospecto';
  const lines: string[] = [
    headerByEvent[input.eventType],
    `👤 *Prospecto:* ${leadLine}`,
  ];

  const contactBits = [input.lead.phone, input.lead.productLabel ? `📦 ${input.lead.productLabel}` : null].filter(Boolean);
  if (contactBits.length > 0) lines.push(`📞 ${contactBits.join(' · ')}`);
  if (input.roleTitle) lines.push(`💼 *Cargo:* ${input.roleTitle}`);
  if (input.painText) lines.push(`🎯 *Dolor / Mejora:* ${input.painText}`);
  if (input.urgencyText) lines.push(`⚡ *Urgencia:* ${input.urgencyText}`);
  if (input.demoSlotLabel) lines.push(`🗓️ *Horario Demo:* ${input.demoSlotLabel}`);
  if (input.meetLink) lines.push(`🎥 *Google Meet:* ${input.meetLink}`);
  if (input.summary) lines.push(`💬 *Resumen:* ${input.summary}`);
  lines.push(`🔗 *Abrir ficha completa en CRM:* ${deepLink}`);

  return lines.join('\n');
}

export function parseQualifierAiJson(rawContent: string): QualifierAiTurnOutput {
  const fallback: QualifierAiTurnOutput = {
    reply: '',
    action: 'continue',
    selected_slot_index: null,
    detected_pain: null,
    detected_volume: null,
    summary_for_advisor: '',
  };
  if (!rawContent || typeof rawContent !== 'string') return fallback;

  const cleaned = rawContent
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    const validActions = new Set([
      'continue',
      'offer_slots',
      'book_demo',
      'handoff_human',
      'close_not_interested',
    ]);
    const action = validActions.has(parsed?.action) ? parsed.action : 'continue';
    const slotIdx =
      parsed?.selected_slot_index !== null &&
      parsed?.selected_slot_index !== undefined &&
      Number.isFinite(Number(parsed.selected_slot_index))
        ? Number(parsed.selected_slot_index)
        : null;

    return {
      reply: String(parsed?.reply || '').trim(),
      action,
      selected_slot_index: slotIdx,
      detected_pain: parsed?.detected_pain ? String(parsed.detected_pain).trim() : null,
      detected_volume: parsed?.detected_volume ? String(parsed.detected_volume).trim() : null,
      summary_for_advisor: String(parsed?.summary_for_advisor || '').trim(),
    };
  } catch {
    return {
      ...fallback,
      reply: cleaned.slice(0, 600),
    };
  }
}

export interface GoogleCalendarEventLike {
  status?: string | null;
  transparency?: string | null;
  start?: { dateTime?: string | null; date?: string | null } | null;
  end?: { dateTime?: string | null; date?: string | null } | null;
  organizer?: { email?: string | null; self?: boolean | null } | null;
  creator?: { email?: string | null; self?: boolean | null } | null;
  attendees?: Array<{
    email?: string | null;
    self?: boolean | null;
    optional?: boolean | null;
    responseStatus?: string | null;
  }> | null;
}

export function filterPersonalBusyGoogleEvents(
  events: GoogleCalendarEventLike[],
  opts?: {
    advisorEmail?: string | null;
    ignoreUnacceptedInvites?: boolean;
    ignoreAllDayEvents?: boolean;
  },
): Array<{ start: string; end: string }> {
  const ignoreUnaccepted = opts?.ignoreUnacceptedInvites !== false;
  const ignoreAllDay = opts?.ignoreAllDayEvents !== false;
  const advisorEmailNorm = String(opts?.advisorEmail || '').trim().toLowerCase();
  const out: Array<{ start: string; end: string }> = [];

  for (const ev of events || []) {
    if (!ev || ev.status === 'cancelled') continue;
    if (ev.transparency === 'transparent') continue;

    const startDt = ev.start?.dateTime ? String(ev.start.dateTime) : '';
    const endDt = ev.end?.dateTime ? String(ev.end.dateTime) : '';
    if (!startDt || !endDt) {
      if (ignoreAllDay) continue;
      continue;
    }

    const startMs = Date.parse(startDt);
    const endMs = Date.parse(endDt);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;

    const organizerEmailNorm = String(ev.organizer?.email || '').trim().toLowerCase();
    const creatorEmailNorm = String(ev.creator?.email || '').trim().toLowerCase();
    const isOrganizer =
      Boolean(ev.organizer?.self) ||
      (Boolean(advisorEmailNorm) && organizerEmailNorm === advisorEmailNorm) ||
      (!ev.organizer &&
        (Boolean(ev.creator?.self) || (Boolean(advisorEmailNorm) && creatorEmailNorm === advisorEmailNorm)));

    const attendees = Array.isArray(ev.attendees) ? ev.attendees : [];
    const selfAttendee = attendees.find(
      (a) =>
        a?.self === true ||
        (Boolean(advisorEmailNorm) && String(a?.email || '').trim().toLowerCase() === advisorEmailNorm),
    );

    if (selfAttendee) {
      const resp = String(selfAttendee.responseStatus || '').toLowerCase();
      if (resp === 'declined') continue;
      if (!isOrganizer) {
        if (selfAttendee.optional === true) continue;
        if (ignoreUnaccepted && resp !== 'accepted') continue;
      }
    } else if (!isOrganizer && organizerEmailNorm && ignoreUnaccepted) {
      // Event on primary calendar owned by someone else without explicit self acceptance ("en la lupa")
      continue;
    }

    out.push({ start: startDt, end: endDt });
  }

  return out;
}

export function calculateOpenAiCostUsd(input: {
  model: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  audioSeconds?: number | null;
}): number {
  const model = String(input.model || '').toLowerCase().trim();
  const promptTokens = Math.max(0, Number(input.promptTokens) || 0);
  const completionTokens = Math.max(0, Number(input.completionTokens) || 0);
  const audioSeconds = Math.max(0, Number(input.audioSeconds) || 0);

  let cost = 0;
  if (model.includes('whisper')) {
    cost = (audioSeconds / 60) * 0.006;
  } else if (model.includes('mini')) {
    cost = (promptTokens * 0.15) / 1_000_000 + (completionTokens * 0.60) / 1_000_000;
  } else if (model.includes('gpt-4o')) {
    cost = (promptTokens * 2.50) / 1_000_000 + (completionTokens * 10.0) / 1_000_000;
  } else {
    cost = (promptTokens * 0.15) / 1_000_000 + (completionTokens * 0.60) / 1_000_000;
  }

  return Number(cost.toFixed(6));
}

export function estimateAudioDurationSeconds(byteLength: number): number {
  return Math.max(1, Math.round(Math.max(0, Number(byteLength) || 0) / 3000));
}
