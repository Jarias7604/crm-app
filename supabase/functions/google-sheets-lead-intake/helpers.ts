export const DEFAULT_COMPANY_ID = '7a582ba5-f7d0-4ae3-9985-35788deb1c30';

export const PRODUCT_IDS = {
  ERP: '502c0aaf-9ae4-4a19-a9e8-31ca73861135',
  SIPLE: 'aa44077f-d7ff-44b2-9896-f5f8b4b25e79',
} as const;

export const TZ_EL_SALVADOR = 'America/El_Salvador';

export type SheetIntakeAction =
  | 'created'
  | 'existing_noted'
  | 'already_synced'
  | 'invalid'
  | 'dry_run_create'
  | 'dry_run_existing';

export interface NormalizedSheetLead {
  name: string;
  email: string | null;
  phoneDisplay: string | null;
  phoneDigits: string;
  phoneMatchKey: string;
  companyName: string | null;
  roleTitle: string | null;
  rawIndustry: string | null;
  mappedIndustry: string | null;
  annualInvoices: string | null;
  currentMethod: string | null;
  improvementArea: string | null;
  urgency: string | null;
  priority: 'high' | 'medium' | 'low';
  projectsCount: string | null;
  submittedAt: string | null;
  adName: string | null;
  comments: string | null;
  productId: string | null;
  productLabel: string | null;
  rawFields: Record<string, string>;
}

const SV_TIMESTAMP_FMT = new Intl.DateTimeFormat('es-SV', {
  timeZone: TZ_EL_SALVADOR,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function normalizeHeaderKey(raw: string): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizePhone(raw?: unknown): {
  display: string | null;
  digits: string;
  matchKey: string;
} {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) {
    return { display: null, digits: '', matchKey: '' };
  }

  if (/^[267]\d{7}$/.test(digits)) {
    return {
      display: `+503${digits}`,
      digits,
      matchKey: digits,
    };
  }

  if (/^503[267]\d{7}$/.test(digits)) {
    return {
      display: `+${digits}`,
      digits,
      matchKey: digits.slice(-8),
    };
  }

  return {
    display: digits.length >= 11 ? `+${digits}` : digits,
    digits,
    matchKey: digits.length >= 8 ? digits.slice(-8) : digits,
  };
}

export function normalizeEmail(raw?: unknown): string | null {
  const clean = String(raw ?? '').trim().toLowerCase();
  if (!clean) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return null;
  return clean;
}

export function inferLeadPriority(urgency?: string | null): 'high' | 'medium' | 'low' {
  const text = String(urgency || '').trim();
  if (!text) return 'medium';
  if (/lo\s+antes\s+posible|inmediat|urgente|hoy|esta\s+semana/i.test(text)) {
    return 'high';
  }
  if (/solo\s+(?:estoy\s+)?buscando|solo\s+informaci|evaluando|sin\s+prisa/i.test(text)) {
    return 'low';
  }
  return 'medium';
}

export function detectInterestedProduct(input: {
  adName?: string | null;
  projectsCount?: string | null;
  improvementArea?: string | null;
  annualInvoices?: string | null;
}): { id: string | null; label: string | null } {
  const ad = String(input.adName || '').trim();
  const projects = String(input.projectsCount || '').trim();
  const improvement = String(input.improvementArea || '').trim();
  const invoices = String(input.annualInvoices || '').trim();

  if (/siple|\blotes?\b|lotific|inmobili/i.test(ad) || Boolean(projects)) {
    return { id: PRODUCT_IDS.SIPLE, label: 'SIPLE' };
  }

  if (
    /\berp\b|toma\s+control\s+de\s+tu\s+negocio|conoce\s+tu\s+negocio|facturaci/i.test(ad) ||
    Boolean(invoices) ||
    Boolean(improvement)
  ) {
    return { id: PRODUCT_IDS.ERP, label: 'ERP' };
  }

  return { id: null, label: null };
}

export function mapSheetIndustryToCrm(input: {
  rawIndustry?: string | null;
  companyName?: string | null;
  roleTitle?: string | null;
  productLabel?: string | null;
}): string | null {
  const rawTrim = String(input.rawIndustry || '').trim();
  const rawNorm = normalizeHeaderKey(rawTrim).toLowerCase();
  const company = String(input.companyName || '').trim();
  const role = String(input.roleTitle || '').trim();
  const combinedHint = `${company} ${role}`.trim();

  if (rawNorm === 'comercio y tiendas') {
    if (/farmacia/i.test(company)) return 'Farmacia';
    if (/ferreter/i.test(company)) return 'Ferreteria';
    if (/calzado|ropa|boutique|accesorio|zapato/i.test(company)) return 'Almacen/Boutique';
    return 'Tienda/ Abarroteria/Supermercados';
  }

  if (rawNorm === 'distribucion y ventas al por mayor') {
    return 'Distribuidores/Importadores/Mayoristas';
  }

  if (rawNorm === 'restaurantes y alimentos') {
    return 'Restaurante/Cafeteria/Bar';
  }

  if (rawNorm === 'servicios profesionales') {
    if (/contad|contab/i.test(combinedHint)) return 'Despacho contable';
    if (/imprenta|\bprint\b/i.test(combinedHint)) return 'Imprentas';
    if (/jur[ií]dic|abogad/i.test(combinedHint)) return 'Actividades juridicas';
    return 'Consultores';
  }

  if (!rawTrim || rawNorm === 'otro') {
    if (/farmacia/i.test(combinedHint)) return 'Farmacia';
    if (/ferreter/i.test(combinedHint)) return 'Ferreteria';
    if (/cl[ií]nic/i.test(combinedHint)) return 'Clinicas';
    if (/fundaci[oó]n|asociaci[oó]n/i.test(combinedHint)) return 'Fundaciones/Asociaciones';
    if (/imprenta|\bprint\b/i.test(combinedHint)) return 'Imprentas';
    if (/jur[ií]dic|abogad/i.test(combinedHint)) return 'Actividades juridicas';
    if (/contad|contab/i.test(combinedHint)) return 'Despacho contable';
    if (/agro|agr[ií]col/i.test(combinedHint)) return 'Venta de productos agricolas';
    if (/transporte|log[ií]stic/i.test(combinedHint)) {
      return 'Transporte de carga/ mensajeria/logistica';
    }
  }

  if (input.productLabel === 'SIPLE' && (!rawTrim || rawNorm === 'otro')) {
    return 'Inmobiliarias/Lotificadoras/Administradoras';
  }

  if (rawTrim && rawNorm !== 'otro') {
    return rawTrim;
  }

  return null;
}

const IGNORED_RAW_KEYS = new Set(['ESTADO CRM', 'CRM STATUS', 'ID CRM']);

function pickField(byKey: Map<string, string>, aliases: string[]): string | null {
  for (const alias of aliases) {
    const val = byKey.get(alias);
    if (val && val.trim()) return val.trim();
  }
  return null;
}

export function normalizeSheetRow(row: Record<string, unknown>): NormalizedSheetLead {
  const byKey = new Map<string, string>();
  const rawFields: Record<string, string> = {};

  for (const [k, v] of Object.entries(row || {})) {
    const normKey = normalizeHeaderKey(k);
    if (!normKey) continue;
    const strVal = String(v ?? '').trim();
    if (!byKey.has(normKey)) {
      byKey.set(normKey, strVal);
    }
    if (strVal && !IGNORED_RAW_KEYS.has(normKey)) {
      rawFields[k.trim()] = strVal;
    }
  }

  const name = pickField(byKey, ['NOMBRE COMPLETO', 'NOMBRE', 'FULL NAME', 'CONTACTO']) || '';
  const email = normalizeEmail(
    pickField(byKey, ['CORREO ELECTRONICO', 'CORREO', 'EMAIL', 'E-MAIL', 'MAIL']),
  );
  const rawPhone = pickField(byKey, ['TELEFONO', 'CELULAR', 'WHATSAPP', 'PHONE', 'MOVIL']);
  const phone = normalizePhone(rawPhone);
  const companyName = pickField(byKey, [
    'EMPRESA',
    'NEGOCIO',
    'COMPANY',
    'NOMBRE EMPRESA',
    'RAZON SOCIAL',
  ]);
  const roleTitle = pickField(byKey, ['CARGO', 'PUESTO', 'ROL', 'CATEGORIA DE CARGO']);
  const rawIndustry = pickField(byKey, ['INDUSTRIA', 'RUBRO', 'SECTOR', 'GIRO']);
  const annualInvoices = pickField(byKey, [
    'FACTURAS ANUAL',
    'FACTURAS ANUALES',
    'FACTURAS AL ANO',
  ]);
  const currentMethod = pickField(byKey, ['METODO DE GESTION ACTUAL', 'METODO ACTUAL']);
  const improvementArea = pickField(byKey, ['PUNTO DE MEJORA', 'AREA DE MEJORA', 'NECESIDAD']);
  const urgency = pickField(byKey, ['URGENCIA DE PROJECTO', 'URGENCIA DE PROYECTO', 'URGENCIA', 'PLAZO']);
  const projectsCount = pickField(byKey, [
    'CANTIDAD DE PROYECTOS DISPONIBLES',
    'PROYECTOS DISPONIBLES',
    'CANTIDAD DE PROYECTOS',
  ]);
  const submittedAt = pickField(byKey, ['FECHA DE INGRESO', 'FECHA', 'TIMESTAMP', 'MARCA TEMPORAL']);
  const adName = pickField(byKey, ['ANUNCIO DE CONVERSION', 'ANUNCIO', 'CAMPANA', 'CAMPAIGN']);
  const comments = pickField(byKey, [
    'COMENTARIOS SOBRE PROSPECTO',
    'COMENTARIOS',
    'OBSERVACIONES',
    'NOTAS',
  ]);

  const product = detectInterestedProduct({
    adName,
    projectsCount,
    improvementArea,
    annualInvoices,
  });

  const mappedIndustry = mapSheetIndustryToCrm({
    rawIndustry,
    companyName,
    roleTitle,
    productLabel: product.label,
  });

  return {
    name,
    email,
    phoneDisplay: phone.display,
    phoneDigits: phone.digits,
    phoneMatchKey: phone.matchKey,
    companyName,
    roleTitle,
    rawIndustry,
    mappedIndustry,
    annualInvoices,
    currentMethod,
    improvementArea,
    urgency,
    priority: inferLeadPriority(urgency),
    projectsCount,
    submittedAt,
    adName,
    comments,
    productId: product.id,
    productLabel: product.label,
    rawFields,
  };
}

export function doesLeadMatchContact(
  existing: { phone?: string | null; email?: string | null },
  incoming: { phoneMatchKey: string; email: string | null },
): 'phone' | 'email' | null {
  const existingPhoneKey = normalizePhone(existing.phone).matchKey;
  if (incoming.phoneMatchKey && existingPhoneKey && existingPhoneKey === incoming.phoneMatchKey) {
    return 'phone';
  }
  const existingEmail = normalizeEmail(existing.email);
  if (incoming.email && existingEmail && existingEmail === incoming.email) {
    return 'email';
  }
  return null;
}

export function buildSheetRowKey(input: {
  spreadsheetId?: string;
  sheetName?: string;
  rowNumber?: number;
  phoneMatchKey?: string;
  email?: string | null;
  submittedAt?: string | null;
}): string {
  const sheetPart = normalizeHeaderKey(input.sheetName || 'HOJA')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const rowPart = input.rowNumber ? `r${input.rowNumber}` : 'r0';
  const contactPart = (input.phoneMatchKey || input.email || 'sin-contacto')
    .toLowerCase()
    .replace(/[^a-z0-9@._-]+/g, '');
  const datePart = String(input.submittedAt || '')
    .trim()
    .replace(/[^a-z0-9]+/gi, '');
  return `${sheetPart}:${rowPart}:${contactPart}${datePart ? `:${datePart}` : ''}`;
}

export function formatElSalvadorTimestamp(date = new Date()): string {
  return SV_TIMESTAMP_FMT.format(date).replace(',', '');
}

export function buildNewLeadNotes(
  lead: NormalizedSheetLead,
  meta: { sheetName: string; rowNumber: number },
): string {
  const lines: string[] = [
    `📋 Prospecto ingresado automáticamente desde Google Sheets (${meta.sheetName} · Fila ${meta.rowNumber})`,
  ];

  if (lead.roleTitle) lines.push(`• Cargo: ${lead.roleTitle}`);
  if (lead.productLabel) lines.push(`• Producto detectado: ${lead.productLabel}`);
  if (lead.rawIndustry) {
    const industryLine =
      lead.mappedIndustry && lead.mappedIndustry !== lead.rawIndustry
        ? `${lead.rawIndustry} (CRM: ${lead.mappedIndustry})`
        : lead.rawIndustry;
    lines.push(`• Industria: ${industryLine}`);
  }
  if (lead.annualInvoices) lines.push(`• Facturas anuales: ${lead.annualInvoices}`);
  if (lead.projectsCount) lines.push(`• Proyectos disponibles: ${lead.projectsCount}`);
  if (lead.currentMethod) lines.push(`• Gestión actual: ${lead.currentMethod}`);
  if (lead.improvementArea) lines.push(`• Punto de mejora: ${lead.improvementArea}`);
  if (lead.urgency) lines.push(`• Urgencia: ${lead.urgency}`);
  if (lead.adName) lines.push(`• Anuncio: ${lead.adName}`);
  if (lead.submittedAt) lines.push(`• Fecha formulario: ${lead.submittedAt}`);
  if (lead.comments) lines.push(`• Comentarios: ${lead.comments}`);

  return lines.join('\n');
}

export function buildReentryNote(
  lead: NormalizedSheetLead,
  meta: { sheetName: string; rowNumber: number; now?: Date },
): string {
  const stamp = formatElSalvadorTimestamp(meta.now);
  const parts: string[] = [
    `♻️ Reingreso desde formulario (${stamp} · ${meta.sheetName} fila ${meta.rowNumber})`,
  ];
  if (lead.productLabel) parts.push(`• Producto de interés: ${lead.productLabel}`);
  if (lead.adName) parts.push(`• Anuncio: ${lead.adName}`);
  if (lead.improvementArea) parts.push(`• Punto de mejora: ${lead.improvementArea}`);
  if (lead.projectsCount) parts.push(`• Proyectos: ${lead.projectsCount}`);
  if (lead.urgency) parts.push(`• Urgencia: ${lead.urgency}`);
  if (lead.comments) parts.push(`• Comentarios: ${lead.comments}`);
  return parts.join('\n');
}

export function appendNotePreservingExisting(
  existingNotes: string | null | undefined,
  newNote: string,
): string {
  const prev = String(existingNotes || '').trim();
  const next = String(newNote || '').trim();
  if (!prev) return next;
  if (!next) return prev;
  return `${prev}\n\n${next}`;
}

export function extractSyncKeys(rawMetaPayload: unknown): string[] {
  if (!rawMetaPayload || typeof rawMetaPayload !== 'object') return [];
  const rawList = (rawMetaPayload as Record<string, unknown>).sheet_sync_keys;
  if (!Array.isArray(rawList)) return [];
  return rawList.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export function formatSheetStatusCell(input: {
  action: SheetIntakeAction;
  advisorName?: string | null;
  now?: Date;
  reason?: string;
}): string {
  const stamp = formatElSalvadorTimestamp(input.now);
  const advisorSuffix =
    input.advisorName && input.advisorName.trim() && input.advisorName !== 'Sin asignar'
      ? ` (asesor: ${input.advisorName.trim()})`
      : ' (Sin asignar)';

  switch (input.action) {
    case 'created':
      return `✅ Creado en CRM (${stamp} · Sin asignar)`;
    case 'existing_noted':
      return `♻️ Ya existía${advisorSuffix} — Nota agregada (${stamp})`;
    case 'already_synced':
      return `♻️ Ya existía${advisorSuffix} — Verificado (${stamp})`;
    case 'dry_run_create':
      return `🧪 Simulacro: se crearía nuevo (${stamp})`;
    case 'dry_run_existing':
      return `🧪 Simulacro: ya existe${advisorSuffix}`;
    case 'invalid':
      return `⚠️ Fila incompleta${input.reason ? `: ${input.reason}` : ' (sin teléfono ni correo)'}`;
  }
}
