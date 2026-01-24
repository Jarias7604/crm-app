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
     * Upload a file related to a chat message
     */
    async uploadMessageFile(companyId: string, conversationId: string, file: File) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `chats/${companyId}/${conversationId}/${fileName}`;

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
     * Get public URL for a file
     */
    async getPublicUrl(path: string) {
        const { data } = supabase.storage
            .from('lead-documents')
            .getPublicUrl(path);

        return data.publicUrl;
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
    },

    /**
     * Upload user avatar to avatars bucket
     */
    async uploadAvatar(userId: string, file: File) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}-${Date.now()}.${fileExt}`;
        const filePath = `public/${fileName}`; // Standardizing path

        const { error } = await supabase.storage
            .from('avatars')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (error) {
            console.error('Storage error:', error);
            throw error;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

        return publicUrl;
    },

    /**
     * Upload company logo to avatars bucket
     */
    async uploadLogo(companyId: string, file: File) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${companyId}-logo-${Date.now()}.${fileExt}`;
        const filePath = `logos/${fileName}`;

        const { error } = await supabase.storage
            .from('avatars')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

        return publicUrl;
    }
};
