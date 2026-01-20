import { supabase } from './supabase';

export const storageService = {
    /**
     * Upload a file to a specific path
     */
    async uploadLeadDocument(companyId: string, leadId: string, file: File) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${companyId}/${leadId}/${fileName}`;

        const { data, error } = await supabase.storage
            .from('lead-documents')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (error) throw error;
        return data.path;
    },

    /**
     * Get a temporary download URL for a file
     */
    async getDownloadUrl(path: string) {
        const { data, error } = await supabase.storage
            .from('lead-documents')
            .createSignedUrl(path, 3600); // 1 hour expiration

        if (error) throw error;
        return data.signedUrl;
    },

    /**
     * Delete a file from storage
     */
    async deleteFile(path: string) {
        const { error } = await supabase.storage
            .from('lead-documents')
            .remove([path]);

        if (error) throw error;
    }
};
