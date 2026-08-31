import { useState, useEffect, useCallback } from 'react';
import { leadSourcesService, type LeadSource } from '../services/leadSourcesService';
import { useAuth } from '../auth/AuthProvider';

/**
 * useLeadSources — loads dynamic lead sources for the active company.
 * Drop-in replacement for the hardcoded SOURCE_CONFIG / SOURCE_OPTIONS.
 */
export function useLeadSources(companyId?: string) {
    const { profile, simulatedCompanyId } = useAuth();
    const activeId = companyId || simulatedCompanyId || profile?.company_id;

    const [sources, setSources] = useState<LeadSource[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        if (!activeId) { setLoading(false); return; }
        setLoading(true);
        const data = await leadSourcesService.getSources(activeId);
        setSources(data);
        setLoading(false);
    }, [activeId]);

    useEffect(() => { load(); }, [load]);

    /** Lookup a source by its slug — useful for display in tables */
    const getBySlug = useCallback((slug: string | null | undefined): LeadSource | undefined => {
        if (!slug) return undefined;
        return sources.find(s => s.slug === slug);
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
