import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { leadsService } from '../services/leads';
import { logger } from '../utils/logger';
import toast from 'react-hot-toast';

/**
 * Hook to fetch paginated leads with automatic caching
 */
export function useLeads(page = 1, pageSize = 50) {
    return useQuery({
        queryKey: queryKeys.leads.list(page, pageSize),
        queryFn: async () => {
            logger.debug('Fetching leads', { page, pageSize });
            return leadsService.getLeads(page, pageSize);
        },
        staleTime: 2 * 60 * 1000, // 2 minutes
    });
}

/**
 * Hook to fetch team members
 */
export function useTeamMembers() {
    return useQuery({
        queryKey: queryKeys.team.members(),
        queryFn: async () => {
            logger.debug('Fetching team members');
            return leadsService.getTeamMembers();
        },
        staleTime: 10 * 60 * 1000, // 10 minutes - team doesn't change often
    });
}

/**
 * Hook to fetch follow-ups for a specific lead
 */
export function useFollowUps(leadId: string) {
    return useQuery({
        queryKey: queryKeys.leads.followUps(leadId),
        queryFn: async () => {
            logger.debug('Fetching follow-ups', { leadId });
            return leadsService.getFollowUps(leadId);
        },
        enabled: !!leadId, // Only fetch if leadId is provided
        staleTime: 1 * 60 * 1000, // 1 minute
    });
}

/**
 * Hook to create a new lead with optimistic updates
 */
export function useCreateLead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: leadsService.createLead,
        onSuccess: () => {
            // Invalidate leads list to refetch
            queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
            toast.success('Nuevo lead creado');
        },
        onError: (error: any) => {
            logger.error('Failed to create lead', error, { action: 'useCreateLead' });
            toast.error(`Error: ${error.message}`);
        },
    });
}

/**
 * Hook to update a lead
 */
export function useUpdateLead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: any }) =>
            leadsService.updateLead(id, updates),
        onSuccess: (_, variables) => {
            // Invalidate specific lead and list
            queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
        },
        onError: (error: any) => {
            logger.error('Failed to update lead', error, { action: 'useUpdateLead' });
            toast.error(`Error al guardar: ${error.message}`);
        },
    });
}

/**
 * Hook to delete a lead
 */
export function useDeleteLead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: leadsService.deleteLead,
        onSuccess: () => {
            // Invalidate leads list
            queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
            toast.success('Lead eliminado correctamente');
        },
        onError: (error: any) => {
            logger.error('Failed to delete lead', error, { action: 'useDeleteLead' });
            toast.error(`Error al eliminar: ${error.message}`);
        },
    });
}

/**
 * Hook to import leads from CSV
 */
export function useImportLeads() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: leadsService.importLeads,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
            toast.success('Leads importados correctamente');
        },
        onError: (error: any) => {
            logger.error('Failed to import leads', error, { action: 'useImportLeads' });
            toast.error(`Fallo en la importación: ${error.message || 'Verifica el formato del archivo CSV'}`);
        },
    });
}
