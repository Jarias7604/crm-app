import { supabase } from './supabase';
import type { Profile, Role } from '../types';

export interface Invitation {
    id: string;
    email: string;
    role: Role;
    status: 'pending' | 'accepted' | 'expired';
    created_at: string;
}

export const teamService = {
    // Get current company license info - Optimized
    async getCompanyLimit(companyId: string) {
        const { data: company, error } = await supabase
            .from('companies')
            .select('max_users')
            .eq('id', companyId)
            .single();

        if (error) throw error;
        return company.max_users || 5;
    },

    // Get all members of my company - Optimized
    async getTeamMembers(companyId: string) {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, role, created_at, company_id, full_name, phone, is_active')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Profile[];
    },

    // Get pending invitations - Optimized & Secured
    async getInvitations(companyId: string) {
        const { data, error } = await supabase
            .from('company_invitations')
            .select('*')
            .eq('company_id', companyId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Invitation[];
    },

    // Create a new member directly (Admin only)
    async createMember(data: { email: string; password: string; role: Role; fullName: string; phone?: string; companyId: string }) {
        const { data: stringId, error } = await supabase.rpc('admin_create_user', {
            new_email: data.email,
            new_password: data.password,
            new_role: data.role,
            new_full_name: data.fullName,
            new_phone: data.phone || null,
            new_company_id: data.companyId
        });

        if (error) throw error;
        return stringId;
    },

    // Toggle member status
    async toggleMemberStatus(userId: string, status: boolean) {
        const { error } = await supabase.rpc('toggle_user_status', {
            user_id: userId,
            new_status: status
        });

        if (error) throw error;
    },

    // Update member details
    async updateMember(userId: string, updates: { full_name?: string; phone?: string; role?: Role }) {
        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId);

        if (error) throw error;
    },

    // Invite a new member - Legacy / Optional if you still want to keep invitations
    async inviteMember(email: string, role: Role, companyId: string, createdBy: string) {
        const { data, error } = await supabase
            .from('company_invitations')
            .insert({
                email,
                role,
                company_id: companyId,
                created_by: createdBy
            })
            .select()
            .single();

        if (error) throw error;
        return data as Invitation;
    },

    // Revoke invitation
    async revokeInvitation(id: string) {
        const { error } = await supabase
            .from('company_invitations')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // Delete a team member (Auth + Profile)
    async deleteMember(id: string) {
        const { error } = await supabase.rpc('admin_delete_user', {
            target_user_id: id
        });

        if (error) throw error;
    }
};
