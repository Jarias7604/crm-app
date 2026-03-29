import { supabase } from './supabase';

// =====================================================
// TYPES
// =====================================================

export interface CatalogItemType {
    id: string;
    company_id: string | null;   // NULL = sistema global (visible para todos)
    name: string;                // Display: "Módulo", "Carro Sedán"
    slug: string;                // Internal key: "modulo", "carro_sedan"
    color: string;               // Hex color for badge
    icon: string;                // Lucide icon name
    is_active: boolean;
    sort_order: number;
    is_system: boolean;          // Virtual: company_id === null
    created_at: string;
    updated_at: string;
}

export type NewCatalogItemType = Omit<CatalogItemType, 'id' | 'is_system' | 'created_at' | 'updated_at'>;

// =====================================================
// DEFAULT COLORS — para asignar automáticamente
// =====================================================
const PALETTE = [
    '#8B5CF6', '#3B82F6', '#10B981', '#F97316',
    '#EF4444', '#14B8A6', '#F59E0B', '#6366F1',
    '#EC4899', '#84CC16',
];

export function pickColor(index: number): string {
    return PALETTE[index % PALETTE.length];
}

// =====================================================
// SERVICE
// =====================================================

class ItemTypesService {

    /**
     * Load item types for the current user:
     * - System global types (company_id = NULL)
     * - Company-specific custom types (company_id = current)
     * RLS handles the filtering automatically.
     */
    async getAll(): Promise<CatalogItemType[]> {
        const { data, error } = await supabase
            .from('catalog_item_types')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true });

        if (error) throw error;

        return (data || []).map(item => ({
            ...item,
            is_system: item.company_id === null,
        }));
    }

    async getAllIncludingInactive(): Promise<CatalogItemType[]> {
        const { data, error } = await supabase
            .from('catalog_item_types')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true });

        if (error) throw error;

        return (data || []).map(item => ({
            ...item,
            is_system: item.company_id === null,
        }));
    }

    async create(payload: Omit<NewCatalogItemType, 'company_id' | 'slug'>, companyId: string): Promise<CatalogItemType> {
        // Generate slug from name if not provided
        const slug = this._toSlug(payload.name);

        const { data, error } = await supabase
            .from('catalog_item_types')
            .insert({
                ...payload,
                slug,
                company_id: companyId,
            })
            .select()
            .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('No se pudo crear el tipo de ítem. Verifica tus permisos.');

        return { ...data, is_system: false };
    }

    async update(id: string, updates: Partial<Pick<CatalogItemType, 'name' | 'color' | 'icon' | 'sort_order' | 'is_active'>>): Promise<CatalogItemType> {
        const { data, error } = await supabase
            .from('catalog_item_types')
            .update(updates)
            .eq('id', id)
            .select()
            .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('No se pudo actualizar. Solo puedes editar tipos propios de tu empresa.');

        return { ...data, is_system: data.company_id === null };
    }

    async deactivate(id: string): Promise<void> {
        await this.update(id, { is_active: false });
    }

    async reactivate(id: string): Promise<void> {
        await this.update(id, { is_active: true });
    }

    /** Convert display name to a safe slug */
    _toSlug(name: string): string {
        return name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')  // remove accents
            .replace(/[^a-z0-9]+/g, '_')       // spaces/symbols to _
            .replace(/^_+|_+$/g, '');           // trim underscores
    }

    /** Get the badge color class from a hex color (for dynamic rendering) */
    getBadgeStyle(color: string): React.CSSProperties {
        return {
            backgroundColor: `${color}20`,  // 12% opacity background
            color: color,
            border: `1px solid ${color}40`,
        };
    }
}

export const itemTypesService = new ItemTypesService();
