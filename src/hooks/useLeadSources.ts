import { useState, useEffect, useCallback } from 'react';
import { leadSourcesService, type LeadSource } from '../services/leadSourcesService';
import { useAuth } from '../auth/AuthProvider';
import { SOURCE_OPTIONS } from '../types';

/**
 * useLeadSources — loads dynamic lead sources for the active company.
 * Always guarantees available sources even if RLS or simulation mode returns empty.
 */
export function useLeadSources(companyId?: string) {
    const { profile, simulatedCompanyId } = useAuth();
    const activeId = companyId || simulatedCompanyId || profile?.company_id;

    const [sources, setSources] = useState<LeadSource[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await leadSourcesService.getSources(activeId || undefined);
            if (data && data.length > 0) {
                setSources(data);
            } else {
                // Fallback seguro a los orígenes del sistema para que nunca quede vacío
                setSources(SOURCE_OPTIONS.map(opt => ({
                    id: opt.value,
                    company_id: activeId || '',
                    name: opt.label,
                    slug: opt.value,
                    icon: opt.icon,
                    color: opt.color,
                    bg_color: opt.bgColor,
                    is_active: true,
                    is_system: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })));
            }
        } catch {
            setSources(SOURCE_OPTIONS.map(opt => ({
                id: opt.value,
                company_id: activeId || '',
                name: opt.label,
                slug: opt.value,
                icon: opt.icon,
                color: opt.color,
                bg_color: opt.bgColor,
                is_active: true,
                is_system: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })));
        } finally {
            setLoading(false);
        }
    }, [activeId]);

    useEffect(() => { load(); }, [load]);

    /** Lookup a source by its slug or name — useful for display in tables */
    const getBySlug = useCallback((slugOrName: string | null | undefined): LeadSource | undefined => {
        if (!slugOrName) return undefined;
        return sources.find(s => s.slug === slugOrName || s.name.toLowerCase() === slugOrName.toLowerCase());
    }, [sources]);

    /** Formatted option list for <select> / dropdown components */
    const options = sources.map(s => ({
        value: s.slug,
        label: s.name,
        icon: s.icon,
        color: s.color,
        bgColor: s.bg_color,
    }));

    return { sources, options, loading, getBySlug, reload: load };
}

