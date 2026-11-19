import type { SupportChannelType } from './types.ts';

// ─── Classification of the PROBLEM category (support only) ───────────────────

export function normalizeGreetingText(text: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/bu3n/g, 'buen')
    .replace(/0la/g, 'ola')
    .replace(/[¡!¿?.,;:👍🙏👌✅🙌😊🤝🙃🟢🐺\-_/()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isGreetingOrClosingAgreement(text: string): boolean {
  const raw = String(text || '').trim();
  if (!raw || /^[.\s…_-]+$/.test(raw)) return true;

  const clean = normalizeGreetingText(raw);
  if (clean.length < 4) return true;

  const startsWithAgreement =
    /^(ok|okay|okey|va|dale|de acuerdo|esta bien|perfecto|excelente|entendido|entiendo|muchas gracias|gracias|mil gracias|ah ok|ah bueno|listo|ya quedo|si esta bien|bueno)\b/i.test(
      clean
    );
  const hasExplicitNewErrorAfterOk =
    /\b(pero sigue|sigue dando|no funciono|volvio a fallar|otro problema|otro error|no ingresa|no me deja|no carga|error|falla)\b/i.test(
      clean
    );
  if (startsWithAgreement && !hasExplicitNewErrorAfterOk && clean.length <= 65) return true;

  const greetingWord =
    '(?:hola+|ola+|buen(?:os|as)?(?:\\s+(?:dias?|tardes?|noches?))?|saludos|hey|alo|que\\s+tal|disculpe|perdon)';
  const vocative =
    '(?:muchachos|chicos|equipo|soporte|amigos?|inges?|ingenieros?|lic(?:enciados?)?|melvin|gerson|jimmy|paty|patricia|estimados?|companeros?|todos|como\\s+estan|como\\s+esta)';
  const pureGreetingRegex = new RegExp(
    `^${greetingWord}(?:\\s+${greetingWord})*(?:\\s+${vocative})*$`,
    'i'
  );
  return pureGreetingRegex.test(clean);
}

export function isNonTechnicalAdministrativeChat(text: string): boolean {
  const clean = normalizeGreetingText(text);
  if (!clean) return false;
  const hasTechFailure =
    /\b(error|falla|fallando|fallo|no puedo|no podemos|no pude|no funciona|no ingresa|no carga|no genera|no transmite|no actualiza|no refleja|no da paso|no da acceso|rechaza|rechazado|bloqueado|caido|correlativo|dte|hacienda|factura|invalidacion|firmador|sello|planilla|iva|anexo|inventario|soporte|ayuda|capacitacion)\b/i.test(
      clean
    );
  if (hasTechFailure) return false;

  return (
    /\b(numero de cuenta|cuenta bancaria|comparte.*cuenta|para el pago de este mes)\b/i.test(clean) ||
    /\b(vamos con la reunion|ya estoy en el link|link de la reunion)\b/i.test(clean) ||
    /\b(para analizarla y hablamos luego|sobre los cambios)\b/i.test(clean)
  );
}

export function stripLeadingGreetingForTicketTitle(text: string): string {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  if (!flat) return '';
  let trimmed = flat;
  const leadingPrefixRe =
    /^(?:(?:hola+|ola+|(?:muy\s+)?buen(?:os|as)?(?:\s+(?:d[ií]as?|tardes?|noches?))?|saludos|estimados?|disculpen?|perd[oó]n|qu[eé]\s+tal)(?:\s+(?:muchachos|chicos|equipo|soporte|amigos?|inges?|ingenieros?|lic(?:enciados?)?|paty|patricia|gerson|melvin|jimmy|estimados?|por\s+favor))?|(?:nos\s+pueden\s+ayudar(?:\s+por\s+favor)?|me\s+pueden\s+ayudar(?:\s+por\s+favor)?|por\s+favor))[\s,!¡¿?.:;\-–—👍🙏👌✅🙌😊🤝🙃🟢🐺]*/i;
  for (let i = 0; i < 4; i++) {
    const next = trimmed.replace(leadingPrefixRe, '').trim();
    if (next === trimmed) break;
    trimmed = next;
  }
  const result = trimmed.length >= 6 ? trimmed : flat;
  return result.charAt(0).toUpperCase() + result.slice(1);
}

export function classifyIssueCategory(text: string): {
  category: string;
  shortCategoryTag: string;
  supportChannel: SupportChannelType;
  isActualSupportProblem: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
} {
  const textWithoutMediaPlaceholders = (text || '')
    .replace(/^\[(Imagen|Video|Sticker|Nota de voz|Documento|Archivo)[^\]]*\]$/i, '')
    .trim();
  const lower = textWithoutMediaPlaceholders
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const has = (list: string[]) => list.some((k) => lower.includes(k));

  const isUrgent = has(['urgente', 'caido', 'se cayo', 'no funciona nada', 'bloqueado', 'no podemos facturar', 'no me deja facturar', 'produccion', 'error critico']);
  const isSales = has(['precio', 'precios', 'costo', 'costos', 'cotizacion', 'cotizar', 'cuanto cuesta', 'cuanto vale', 'planes', 'mensualidad', 'anualidad', 'demo', 'demostracion', 'comprar', 'adquirir', 'contratar', 'licencia', 'licencias', 'paquete', 'paquetes', 'tarifa', 'tarifas', 'implementacion', 'me interesa el sistema', 'informacion del sistema', 'quiero informacion', 'venden', 'ofrecen', 'prospecto']);
  const isAccounting = has(['contabilidad', 'contable', 'contador', 'libro de iva', 'libros de iva', 'libro compras', 'libro ventas', 'consumidor final', 'contribuyente', 'declaracion', 'anexo', 'anexos', 'f07', 'f-07', 'f14', 'f-14', 'f11', 'retencion', 'percepcion', 'planilla', 'planillas', 'isss', 'afp', 'renta', 'balance general', 'estado de resultado', 'partida contable', 'partidas', 'catalogo de cuentas', 'cierre contable', 'conciliacion']);
  const isOtherProduct = has(['otro producto', 'otros productos', 'otro servicio', 'otros servicios', 'catalogo', 'horario de atencion', 'ubicacion', 'direccion', 'estado de cuenta']);
  const hasProblemKeyword = has([
    'error', 'problema', 'falla', 'fallando', 'fallo', 'no deja', 'no me deja', 'no puedo', 'no podemos', 'no pude',
    'no ingresa', 'no me puedo lograr', 'no me puedo loguear', 'no me deja entrar', 'no pude entrar', 'no da paso', 'no da acceso',
    'no hay conexion', 'se ha caido', 'se cayo', 'caido el sistema', 'correlativo', 'no se estan actualizando', 'no actualiza',
    'no refleja', 'arroja error', 'da error', 'sigue dando el problema', 'error de calculo', 'no me deja facturar',
    'no carga', 'no sale', 'no aparece', 'no funciona', 'no genera', 'no transmite', 'no envia', 'no cuadra', 'no imprime', 'impresora',
    'ayuda', 'ayudarme', 'ayuden', 'apoyo', 'soporte', 'revisar', 'revisen', 'arreglar', 'corregir', 'bug', 'lento', 'traba', 'pegado',
    'rechaza', 'rechazado', 'inconveniente', 'duda', 'consulta', 'como hago', 'factura', 'facturar', 'facturacion', 'dte', 'hacienda',
    'invalidacion', 'credito fiscal', 'comprobante', 'liquidacion', 'sello', 'firmador', 'contingencia', 'planilla', 'calculo',
    'permiso', 'acceso', 'contrasena', 'login', 'sincroniza', 'base de datos', 'capacitacion', 'capacitaciom', 'entrenamiento', 'iva'
  ]);
  const isClosingOrGreeting = isGreetingOrClosingAgreement(textWithoutMediaPlaceholders);
  const isAdminNonTech = isNonTechnicalAdministrativeChat(textWithoutMediaPlaceholders);
  const isActualSupportProblem =
    Boolean(lower) && (isUrgent || isAccounting || hasProblemKeyword) && !isClosingOrGreeting && !isAdminNonTech;

  let supportChannel: SupportChannelType = 'soporte';
  let category = 'Soporte General / Consulta';
  let shortCategoryTag = 'Soporte';

  if (isSales && !hasProblemKeyword) {
    supportChannel = 'ventas';
    category = 'Ventas / Precios / Cotización';
    shortCategoryTag = 'Ventas / Precios';
  } else if (isAccounting) {
    supportChannel = 'contabilidad';
    category = 'Contabilidad / IVA / Planillas';
    shortCategoryTag = 'Contabilidad';
  } else if (isOtherProduct && !hasProblemKeyword) {
    supportChannel = 'otros';
    category = 'Otros Productos / Información General';
    shortCategoryTag = 'Otros Productos';
  } else if (/dte|hacienda|factur|invalidaci|credito fiscal|fe\b|contingencia|sello|firmador|correlativo|liquidacion|comprobante/i.test(lower)) {
    category = 'Facturación Electrónica / DTE / Hacienda';
    shortCategoryTag = 'Facturación DTE';
  } else if (/whatsapp\s*api|cola\s+de\s+whatsapp|no\s+envia\s+whatsapp|evolution\s*api|mensajeria\s+whatsapp/i.test(lower)) {
    category = 'WhatsApp / Mensajería / API';
    shortCategoryTag = 'WhatsApp API';
  } else if (/login|acceso|usuario|permiso|contrasen|rol|sesion|no\s+ingresa|loguear|lograr|da\s+paso|entrar/i.test(lower)) {
    category = 'Accesos / Usuarios / Permisos';
    shortCategoryTag = 'Accesos/Permisos';
  } else if (/reporte|excel|pdf|descarga|filtro|estadistica|dashboard/i.test(lower)) {
    category = 'Reportes / Exportación / Datos';
    shortCategoryTag = 'Reportes';
  } else if (/calculo|monto|total|descuento|abono|cuota|prima|cobro/i.test(lower)) {
    supportChannel = 'contabilidad';
    category = 'Cálculos / Finanzas / Pagos';
    shortCategoryTag = 'Contabilidad';
  } else if (/lento|carga|caido|cayo|conexion|servidor|base\s+de\s+datos|sql|sincroni/i.test(lower)) {
    category = 'Infraestructura / Base de Datos / Lentitud';
    shortCategoryTag = 'Base de Datos/Server';
  }

  return { category, shortCategoryTag, supportChannel, isActualSupportProblem, priority: isUrgent ? 'urgent' : 'high' };
}

export function isGenericProblemTitle(title: string): boolean {
  const snippet = String(title || '').replace(/^\[WhatsApp\s*·\s*[^\]]+\]\s*[^:]+:\s*/i, '').trim();
  if (!snippet || snippet.length < 18) return true;
  if (/^\[(Imagen|Video|Sticker|Nota de voz|Documento|Archivo)/i.test(snippet)) return true;
  if (isGreetingOrClosingAgreement(snippet)) return true;
  return /tengo un problema|necesito ayuda|una consulta|me ayudan|hay un error|no funciona|sobre los cambios$/i.test(snippet);
}
