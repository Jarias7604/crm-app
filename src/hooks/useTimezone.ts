import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { DEFAULT_TIMEZONE } from '../utils/timezone';

/**
 * Fetches and caches the IANA timezone for a given company.
 * Falls back to DEFAULT_TIMEZONE while loading or on error.
 *
 * Usage:
 *   const { timezone } = useTimezone(companyId);
 */
export function useTimezone(companyId: string | undefined | null): { timezone: string; loading: boolean } {
    const [timezone, setTimezone] = useState<string>(DEFAULT_TIMEZONE);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!companyId) {
            setLoading(false);
            return;
        }

        let cancelled = false;

        const fetchTimezone = async () => {
            try {
                const { data } = await supabase
                    .from('companies')
                    .select('timezone')
                    .eq('id', companyId)
                    .single();
                if (!cancelled && data?.timezone) {
                    setTimezone(data.timezone);
                }
            } catch {
                // Use default timezone on error
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchTimezone();

        return () => { cancelled = true; };
    }, [companyId]);

    return { timezone, loading };
}
