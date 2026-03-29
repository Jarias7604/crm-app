import { useState, useEffect, useCallback } from 'react';
import { itemTypesService, type CatalogItemType } from '../services/itemTypes';
import { useAuth } from '../auth/AuthProvider';

interface UseItemTypesOptions {
    includeInactive?: boolean;
}

interface UseItemTypesReturn {
    types: CatalogItemType[];
    systemTypes: CatalogItemType[];    // company_id = null
    companyTypes: CatalogItemType[];   // company_id = current
    loading: boolean;
    error: string | null;
    reload: () => Promise<void>;
    /** All slugs for dynamic filter tabs */
    slugs: string[];
    /** Get display name by slug (fallback to slug itself) */
    getName: (slug: string) => string;
    /** Get hex color by slug */
    getColor: (slug: string) => string;
}

export function useItemTypes(options: UseItemTypesOptions = {}): UseItemTypesReturn {
    const { profile } = useAuth();
    const [types, setTypes] = useState<CatalogItemType[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = options.includeInactive
                ? await itemTypesService.getAllIncludingInactive()
                : await itemTypesService.getAll();
            setTypes(data);
        } catch (err: any) {
            console.error('[useItemTypes] Error loading item types:', err);
            setError(err.message || 'Error al cargar tipos de ítem');
            // Fallback to safe defaults so the UI never breaks
            setTypes([
                { id: 'sys-1', company_id: null, name: 'Módulo',   slug: 'modulo',   color: '#8B5CF6', icon: 'package',    is_active: true, sort_order: 1, is_system: true, created_at: '', updated_at: '' },
                { id: 'sys-2', company_id: null, name: 'Servicio',  slug: 'servicio', color: '#10B981', icon: 'settings',   is_active: true, sort_order: 2, is_system: true, created_at: '', updated_at: '' },
                { id: 'sys-3', company_id: null, name: 'Otro',      slug: 'otro',     color: '#6B7280', icon: 'circle',     is_active: true, sort_order: 3, is_system: true, created_at: '', updated_at: '' },
            ]);
        } finally {
            setLoading(false);
        }
    }, [options.includeInactive]);

    useEffect(() => {
        if (profile?.company_id) {
            load();
        }
    }, [profile?.company_id, load]);

    const companyId = profile?.company_id;
    const systemTypes = types.filter(t => t.company_id === null);
    const companyTypes = types.filter(t => t.company_id === companyId);
    const slugs = types.map(t => t.slug);

    const getName = (slug: string): string =>
        types.find(t => t.slug === slug)?.name ?? slug;

    const getColor = (slug: string): string =>
        types.find(t => t.slug === slug)?.color ?? '#6B7280';

    return {
        types,
        systemTypes,
        companyTypes,
        loading,
        error,
        reload: load,
        slugs,
        getName,
        getColor,
    };
}
