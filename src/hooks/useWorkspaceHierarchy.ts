import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../services/supabase';

export interface WorkspaceItem {
    id: string;
    name: string;
    logo_url?: string | null;
    parent_company_id?: string | null;
    isParent: boolean;
}

/**
 * useWorkspaceHierarchy Hook
 * 
 * Implements HubSpot / Salesforce-style Hierarchical Data Roll-up:
 * - If the user is an Admin (company_admin / super_admin) on the Parent Company (Matriz),
 *   they can view consolidated data across all child workstations ('all'), or filter by a specific workstation.
 * - If the user is a Collaborator, or is in a child workstation, they only view their specific workstation's records.
 */
export function useWorkspaceHierarchy() {
    const { profile, simulatedCompanyId } = useAuth();
    const activeCompanyId = simulatedCompanyId || profile?.company_id || '';

    const isAdmin = useMemo(() => {
        return profile?.role === 'super_admin' || profile?.role === 'company_admin' || (profile as any)?.is_platform_owner === true;
    }, [profile?.role, (profile as any)?.is_platform_owner]);

    const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
    const [isParentCompany, setIsParentCompany] = useState<boolean>(true);
    const [selectedWorkspace, setSelectedWorkspace] = useState<string>('all');
    const [loadingHierarchy, setLoadingHierarchy] = useState<boolean>(true);

    const loadHierarchy = useCallback(async () => {
        if (!activeCompanyId) {
            setWorkspaces([]);
            setLoadingHierarchy(false);
            return;
        }

        try {
            // 1. Get company details to check parent status
            const { data: comp } = await supabase
                .from('companies')
                .select('id, name, parent_company_id, logo_url')
                .eq('id', activeCompanyId)
                .maybeSingle();

            const isParent = !comp?.parent_company_id;
            setIsParentCompany(isParent);

            const parentId = comp?.parent_company_id || activeCompanyId;

            // 2. Fetch all child workstations and parent
            const { data: list } = await supabase
                .from('companies')
                .select('id, name, logo_url, parent_company_id')
                .or(`id.eq.${parentId},parent_company_id.eq.${parentId}`)
                .order('name');

            if (list) {
                const formatted: WorkspaceItem[] = list.map(item => ({
                    id: item.id,
                    name: item.name,
                    logo_url: item.logo_url,
                    parent_company_id: item.parent_company_id,
                    isParent: !item.parent_company_id
                }));
                setWorkspaces(formatted);
            }
        } catch (err) {
            console.error('[useWorkspaceHierarchy] Error loading hierarchy:', err);
        } finally {
            setLoadingHierarchy(false);
        }
    }, [activeCompanyId]);

    useEffect(() => {
        loadHierarchy();
    }, [loadHierarchy]);

    // Can this user use the consolidated multi-workspace roll-up?
    const canRollup = useMemo(() => {
        return isAdmin && isParentCompany && workspaces.length > 1;
    }, [isAdmin, isParentCompany, workspaces.length]);

    // All available company IDs under this hierarchy
    const allHierarchyCompanyIds = useMemo(() => {
        if (workspaces.length === 0) return [activeCompanyId].filter(Boolean);
        return workspaces.map(w => w.id);
    }, [workspaces, activeCompanyId]);

    // The effective company IDs array to pass to DB queries
    const targetCompanyIds = useMemo(() => {
        if (!activeCompanyId) return [];
        
        // If user is Admin in Parent and has 'all' selected -> return consolidated array
        if (canRollup && selectedWorkspace === 'all') {
            return allHierarchyCompanyIds;
        }

        // If specific workspace selected -> return only that one
        if (selectedWorkspace && selectedWorkspace !== 'all') {
            return [selectedWorkspace];
        }

        // Default fallback: only active company
        return [activeCompanyId];
    }, [canRollup, selectedWorkspace, allHierarchyCompanyIds, activeCompanyId]);

    return {
        workspaces,
        isParentCompany,
        isAdmin,
        canRollup,
        selectedWorkspace,
        setSelectedWorkspace,
        targetCompanyIds,
        allHierarchyCompanyIds,
        activeCompanyId,
        loadingHierarchy,
        reloadHierarchy: loadHierarchy
    };
}
