export type IntakeFieldCategory =
    | 'priority'
    | 'pain'
    | 'scale'
    | 'role'
    | 'context'
    | 'source'
    | 'meta';

export type IntakeUrgencyLevel = 'high' | 'medium' | 'low';

export interface IntakeFieldDefinition {
    key: string;
    label: string;
    shortLabel: string;
    category: IntakeFieldCategory;
    aliases: string[];
    isExtra?: boolean;
}

export interface LeadIntakeDisplaySettings {
    company_id: string;
    visible_in_detail: string[];
    visible_in_table: string[];
    visible_in_ai: string[];
    custom_field_labels: Record<string, string>;
    show_in_timeline: boolean;
}

export interface LeadIntakeEntry {
    key: string;
    label: string;
    shortLabel: string;
    category: IntakeFieldCategory;
    value: string;
    isExtra?: boolean;
}

export interface LeadIntakeProfile {
    hasData: boolean;
    sourceSheetName: string | null;
    sourceRowNumber: number | null;
    syncedAt: string | null;
    urgencyLevel: IntakeUrgencyLevel | null;
    values: Record<string, string>;
    entries: LeadIntakeEntry[];
    reentries: Array<{
        at: string | null;
        sheetName: string | null;
        rowNumber: number | null;
        adName: string | null;
        product: string | null;
        urgency: string | null;
        improvementArea: string | null;
        comments: string | null;
        fields: Record<string, string>;
    }>;
}

export interface LeadIntakeTimelineEvent {
    id: string;
    kind: 'initial' | 'reentry';
    timestamp: string | null;
    sheetName: string | null;
    rowNumber: number | null;
    entries: Array<{ key: string; label: string; value: string }>;
}

export const CANONICAL_INTAKE_FIELDS: IntakeFieldDefinition[] = [
    {
        key: 'urgencia',
        label: 'Urgencia del Proyecto',
        shortLabel: 'Urgencia',
        category: 'priority',
        aliases: ['URGENCIA DE PROJECTO', 'URGENCIA DE PROYECTO', 'URGENCIA', 'PLAZO'],
    },
    {
        key: 'punto_de_mejora',
        label: 'Punto de Mejora (Dolor)',
        shortLabel: 'Punto de Mejora',
        category: 'pain',
        aliases: ['PUNTO DE MEJORA', 'AREA DE MEJORA', 'NECESIDAD'],
    },
    {
        key: 'facturas_anual',
        label: 'Facturas Anuales (Volumen)',
        shortLabel: 'Facturas Anuales',
        category: 'scale',
        aliases: ['FACTURAS ANUAL', 'FACTURAS ANUALES', 'FACTURAS AL ANO'],
    },
    {
        key: 'cargo',
        label: 'Cargo / Rol',
        shortLabel: 'Cargo',
        category: 'role',
        aliases: ['CARGO', 'PUESTO', 'ROL', 'CATEGORIA DE CARGO'],
    },
    {
        key: 'metodo_actual',
        label: 'Método de Gestión Actual',
        shortLabel: 'Gestión Actual',
        category: 'context',
        aliases: ['METODO DE GESTION ACTUAL', 'METODO ACTUAL'],
    },
    {
        key: 'proyectos_disponibles',
        label: 'Proyectos Disponibles (SIPLE)',
        shortLabel: 'Proyectos',
        category: 'scale',
        aliases: ['CANTIDAD DE PROYECTOS DISPONIBLES', 'PROYECTOS DISPONIBLES', 'CANTIDAD DE PROYECTOS'],
    },
    {
        key: 'anuncio',
        label: 'Anuncio / Campaña',
        shortLabel: 'Anuncio',
        category: 'source',
        aliases: ['ANUNCIO DE CONVERSION', 'ANUNCIO', 'CAMPANA', 'CAMPAIGN'],
    },
    {
        key: 'comentarios',
        label: 'Comentarios del Prospecto',
        shortLabel: 'Comentarios',
        category: 'context',
        aliases: ['COMENTARIOS SOBRE PROSPECTO', 'COMENTARIOS', 'OBSERVACIONES', 'NOTAS'],
    },
    {
        key: 'fecha_formulario',
        label: 'Fecha de Formulario',
        shortLabel: 'Fecha Form',
        category: 'meta',
        aliases: ['FECHA DE INGRESO', 'FECHA', 'TIMESTAMP', 'MARCA TEMPORAL'],
    },
];

export const DEFAULT_INTAKE_DISPLAY_SETTINGS: Omit<LeadIntakeDisplaySettings, 'company_id'> = {
    visible_in_detail: [
        'urgencia',
        'punto_de_mejora',
        'facturas_anual',
        'cargo',
        'metodo_actual',
        'proyectos_disponibles',
        'anuncio',
        'comentarios',
    ],
    visible_in_table: ['punto_de_mejora', 'urgencia'],
    visible_in_ai: [
        'urgencia',
        'punto_de_mejora',
        'facturas_anual',
        'cargo',
        'metodo_actual',
        'proyectos_disponibles',
        'anuncio',
        'comentarios',
    ],
    custom_field_labels: {},
    show_in_timeline: true,
};

// Columns already promoted to first-class Lead columns — skip when discovering dynamic extra Excel columns
const BASE_LEAD_HEADER_ALIASES = new Set([
    'NOMBRE COMPLETO', 'NOMBRE', 'FULL NAME', 'CONTACTO',
    'CORREO ELECTRONICO', 'CORREO', 'EMAIL', 'E-MAIL', 'MAIL',
    'TELEFONO', 'CELULAR', 'WHATSAPP', 'PHONE', 'MOVIL',
    'EMPRESA', 'NEGOCIO', 'COMPANY', 'NOMBRE EMPRESA', 'RAZON SOCIAL',
    'INDUSTRIA', 'RUBRO', 'SECTOR', 'GIRO',
    'ESTADO CRM', 'CRM STATUS', 'ID CRM',
]);

export function normalizeIntakeKey(raw: string): string {
    return String(raw || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
}

const ALIAS_TO_CANONICAL = new Map<string, IntakeFieldDefinition>();
for (const def of CANONICAL_INTAKE_FIELDS) {
    for (const alias of def.aliases) {
        ALIAS_TO_CANONICAL.set(normalizeIntakeKey(alias), def);
    }
}

function toTitleLabel(rawHeader: string): string {
    const cleaned = String(rawHeader || '').replace(/\s+/g, ' ').trim();
    if (!cleaned) return 'Campo Extra';
    if (cleaned === cleaned.toUpperCase()) {
        return cleaned
            .toLowerCase()
            .replace(/(^|\s)\S/g, (ch) => ch.toUpperCase());
    }
    return cleaned;
}

function makeExtraKey(rawHeader: string): string {
    const slug = normalizeIntakeKey(rawHeader)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return `extra:${slug || 'campo'}`;
}

export function inferUrgencyLevel(urgency?: string | null): IntakeUrgencyLevel | null {
    const text = String(urgency || '').trim();
    if (!text) return null;
    if (/lo\s+antes\s+posible|inmediat|urgente|hoy|esta\s+semana|\basap\b/i.test(text)) {
        return 'high';
    }
    if (/solo\s+(?:estoy\s+)?buscando|solo\s+informaci|evaluando|sin\s+prisa/i.test(text)) {
        return 'low';
    }
    return 'medium';
}

const NOTE_PREFIX_TO_CANONICAL: Array<{ prefix: RegExp; key: string }> = [
    { prefix: /^cargo$/i, key: 'cargo' },
    { prefix: /^punto de mejora$/i, key: 'punto_de_mejora' },
    { prefix: /^facturas anuales$/i, key: 'facturas_anual' },
    { prefix: /^gesti[oó]n actual$/i, key: 'metodo_actual' },
    { prefix: /^urgencia$/i, key: 'urgencia' },
    { prefix: /^proyectos disponibles$/i, key: 'proyectos_disponibles' },
    { prefix: /^anuncio$/i, key: 'anuncio' },
    { prefix: /^fecha formulario$/i, key: 'fecha_formulario' },
    { prefix: /^comentarios$/i, key: 'comentarios' },
];

function parseIntakeFromNotes(notes?: string | null): {
    sheetName: string | null;
    rowNumber: number | null;
    values: Record<string, string>;
} {
    const result: { sheetName: string | null; rowNumber: number | null; values: Record<string, string> } = {
        sheetName: null,
        rowNumber: null,
        values: {},
    };
    const text = String(notes || '').trim();
    if (!text) return result;

    const headerMatch = text.match(
        /Google Sheets\s*\(([^()·\n]+?)\s*·\s*Fila\s*(\d+)\)/i,
    );
    if (headerMatch) {
        result.sheetName = headerMatch[1].trim();
        result.rowNumber = Number(headerMatch[2]) || null;
    }

    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line.startsWith('•')) continue;
        const colonIdx = line.indexOf(':');
        if (colonIdx <= 1) continue;
        const rawLabel = line.slice(1, colonIdx).trim();
        const val = line.slice(colonIdx + 1).trim();
        if (!val) continue;

        for (const mapping of NOTE_PREFIX_TO_CANONICAL) {
            if (mapping.prefix.test(rawLabel) && !result.values[mapping.key]) {
                result.values[mapping.key] = val;
                break;
            }
        }
    }

    return result;
}

const CANONICAL_BY_KEY = new Map<string, IntakeFieldDefinition>(
    CANONICAL_INTAKE_FIELDS.map((f) => [f.key, f]),
);

function mapRawFieldsToEntries(
    rawFields: Record<string, unknown> | null | undefined,
    customLabels?: Record<string, string>,
): { values: Record<string, string>; entries: LeadIntakeEntry[] } {
    const values: Record<string, string> = {};
    const entriesByKey = new Map<string, LeadIntakeEntry>();

    if (rawFields && typeof rawFields === 'object') {
        for (const [rawKey, rawVal] of Object.entries(rawFields)) {
            const val = String(rawVal ?? '').trim();
            if (!val) continue;
            const norm = normalizeIntakeKey(rawKey);
            if (!norm || BASE_LEAD_HEADER_ALIASES.has(norm)) continue;

            const canonical = ALIAS_TO_CANONICAL.get(norm);
            if (canonical) {
                if (!values[canonical.key]) {
                    values[canonical.key] = val;
                    const label = customLabels?.[canonical.key] || canonical.label;
                    entriesByKey.set(canonical.key, {
                        key: canonical.key,
                        label,
                        shortLabel: customLabels?.[canonical.key] || canonical.shortLabel,
                        category: canonical.category,
                        value: val,
                    });
                }
            } else {
                const extraKey = makeExtraKey(rawKey);
                if (!values[extraKey]) {
                    values[extraKey] = val;
                    const label = customLabels?.[extraKey] || toTitleLabel(rawKey);
                    entriesByKey.set(extraKey, {
                        key: extraKey,
                        label,
                        shortLabel: label,
                        category: 'context',
                        value: val,
                        isExtra: true,
                    });
                }
            }
        }
    }

    // Order canonical fields consistently, then append dynamic extra fields
    const ordered: LeadIntakeEntry[] = [];
    for (const def of CANONICAL_INTAKE_FIELDS) {
        const entry = entriesByKey.get(def.key);
        if (entry) ordered.push(entry);
    }
    for (const entry of entriesByKey.values()) {
        if (entry.isExtra) ordered.push(entry);
    }

    return { values, entries: ordered };
}

export interface LeadLikeInput {
    id?: string;
    meta_campaign_name?: string | null;
    next_action_notes?: string | null;
    raw_meta_payload?: Record<string, any> | null;
    created_at?: string | null;
}

export function extractLeadIntakeProfile(
    lead: LeadLikeInput | null | undefined,
    customLabels?: Record<string, string>,
): LeadIntakeProfile {
    if (!lead) {
        return {
            hasData: false,
            sourceSheetName: null,
            sourceRowNumber: null,
            syncedAt: null,
            urgencyLevel: null,
            values: {},
            entries: [],
            reentries: [],
        };
    }

    const meta = lead.raw_meta_payload && typeof lead.raw_meta_payload === 'object'
        ? lead.raw_meta_payload
        : null;

    const rawFields = meta?.fields && typeof meta.fields === 'object' ? meta.fields : null;
    const mapped = mapRawFieldsToEntries(rawFields, customLabels);

    const parsedNotes = parseIntakeFromNotes(lead.next_action_notes);
    const values: Record<string, string> = { ...mapped.values };
    const entriesByKey = new Map<string, LeadIntakeEntry>(mapped.entries.map((e) => [e.key, e]));

    // Backfill any missing canonical fields from historical structured notes or meta_campaign_name
    for (const [k, v] of Object.entries(parsedNotes.values)) {
        if (!values[k] && v) {
            values[k] = v;
            const def = CANONICAL_BY_KEY.get(k);
            if (def) {
                entriesByKey.set(k, {
                    key: def.key,
                    label: customLabels?.[def.key] || def.label,
                    shortLabel: customLabels?.[def.key] || def.shortLabel,
                    category: def.category,
                    value: v,
                });
            }
        }
    }

    if (!values.anuncio && lead.meta_campaign_name && String(lead.meta_campaign_name).trim()) {
        const ad = String(lead.meta_campaign_name).trim();
        values.anuncio = ad;
        const def = CANONICAL_BY_KEY.get('anuncio')!;
        entriesByKey.set('anuncio', {
            key: def.key,
            label: customLabels?.anuncio || def.label,
            shortLabel: customLabels?.anuncio || def.shortLabel,
            category: def.category,
            value: ad,
        });
    }

    const orderedEntries: LeadIntakeEntry[] = [];
    for (const def of CANONICAL_INTAKE_FIELDS) {
        const entry = entriesByKey.get(def.key);
        if (entry) orderedEntries.push(entry);
    }
    for (const entry of entriesByKey.values()) {
        if (entry.isExtra) orderedEntries.push(entry);
    }

    const reentries = Array.isArray(meta?.reentries)
        ? meta.reentries.map((r: any) => ({
            at: r?.at ? String(r.at) : null,
            sheetName: r?.sheet_name ? String(r.sheet_name) : null,
            rowNumber: r?.row_number ? Number(r.row_number) : null,
            adName: r?.ad_name ? String(r.ad_name) : null,
            product: r?.product ? String(r.product) : null,
            urgency: r?.urgency ? String(r.urgency) : null,
            improvementArea: r?.improvement_area ? String(r.improvement_area) : null,
            comments: r?.comments ? String(r.comments) : null,
            fields: r?.fields && typeof r.fields === 'object' ? r.fields : {},
        }))
        : [];

    return {
        hasData: orderedEntries.length > 0 || reentries.length > 0,
        sourceSheetName: (meta?.sheet_name ? String(meta.sheet_name) : null) || parsedNotes.sheetName,
        sourceRowNumber: (meta?.row_number ? Number(meta.row_number) : null) || parsedNotes.rowNumber,
        syncedAt: meta?.synced_at ? String(meta.synced_at) : null,
        urgencyLevel: inferUrgencyLevel(values.urgencia),
        values,
        entries: orderedEntries,
        reentries,
    };
}

export function getLeadIntakeFieldValue(
    lead: LeadLikeInput | null | undefined,
    fieldKey: string,
): string {
    const profile = extractLeadIntakeProfile(lead);
    return profile.values[fieldKey] || '';
}

export function discoverAvailableIntakeFields(
    leads: LeadLikeInput[],
    customLabels?: Record<string, string>,
): IntakeFieldDefinition[] {
    const extras = new Map<string, IntakeFieldDefinition>();

    for (const lead of leads || []) {
        const rawFields = lead?.raw_meta_payload?.fields;
        if (!rawFields || typeof rawFields !== 'object') continue;
        for (const [rawKey, rawVal] of Object.entries(rawFields)) {
            if (!String(rawVal ?? '').trim()) continue;
            const norm = normalizeIntakeKey(rawKey);
            if (!norm || BASE_LEAD_HEADER_ALIASES.has(norm) || ALIAS_TO_CANONICAL.has(norm)) continue;
            const extraKey = makeExtraKey(rawKey);
            if (!extras.has(extraKey)) {
                const label = customLabels?.[extraKey] || toTitleLabel(rawKey);
                extras.set(extraKey, {
                    key: extraKey,
                    label,
                    shortLabel: label,
                    category: 'context',
                    aliases: [norm],
                    isExtra: true,
                });
            }
        }
    }

    const baseList = CANONICAL_INTAKE_FIELDS.map((f) =>
        customLabels?.[f.key]
            ? { ...f, label: customLabels[f.key], shortLabel: customLabels[f.key] }
            : f,
    );

    return [...baseList, ...Array.from(extras.values())];
}

export function isAutoSheetIntakeNote(notes?: string | null): boolean {
    const text = String(notes || '').trim();
    if (!text) return false;
    const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
    if (blocks.length === 0) return false;
    return blocks.every((block) =>
        /^(?:📋\s*Prospecto ingresado automáticamente desde Google Sheets|♻️\s*Reingreso desde formulario)/i.test(
            block,
        ),
    );
}

export function buildLeadIntakeTimelineEvents(
    lead: LeadLikeInput | null | undefined,
    customLabels?: Record<string, string>,
): LeadIntakeTimelineEvent[] {
    if (!lead) return [];
    const profile = extractLeadIntakeProfile(lead, customLabels);
    const events: LeadIntakeTimelineEvent[] = [];

    if (profile.entries.length > 0) {
        events.push({
            id: `intake-initial-${lead.id || 'lead'}`,
            kind: 'initial',
            timestamp: profile.syncedAt || lead.created_at || null,
            sheetName: profile.sourceSheetName,
            rowNumber: profile.sourceRowNumber,
            entries: profile.entries.map((e) => ({
                key: e.key,
                label: e.label,
                value: e.value,
            })),
        });
    }

    profile.reentries.forEach((reentry, index) => {
        const mapped = mapRawFieldsToEntries(reentry.fields, customLabels);
        const entries: Array<{ key: string; label: string; value: string }> =
            mapped.entries.length > 0
                ? mapped.entries.map((e) => ({ key: e.key, label: e.label, value: e.value }))
                : ([
                    reentry.product ? { key: 'producto', label: 'Producto de interés', value: reentry.product } : null,
                    reentry.improvementArea
                        ? { key: 'punto_de_mejora', label: 'Punto de Mejora (Dolor)', value: reentry.improvementArea }
                        : null,
                    reentry.urgency ? { key: 'urgencia', label: 'Urgencia del Proyecto', value: reentry.urgency } : null,
                    reentry.adName ? { key: 'anuncio', label: 'Anuncio / Campaña', value: reentry.adName } : null,
                    reentry.comments ? { key: 'comentarios', label: 'Comentarios del Prospecto', value: reentry.comments } : null,
                ].filter(Boolean) as Array<{ key: string; label: string; value: string }>);

        events.push({
            id: `intake-reentry-${lead.id || 'lead'}-${index}`,
            kind: 'reentry',
            timestamp: reentry.at,
            sheetName: reentry.sheetName,
            rowNumber: reentry.rowNumber,
            entries,
        });
    });

    return events;
}
