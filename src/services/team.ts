import { supabase } from './supabase';
import type { Profile, Role, CustomRole } from '../types';

export interface Invitation {
    id: string;
    email: string;
    role: Role;
    status: 'pending' | 'accepted' | 'expired';
    created_at: string;
}

export const teamService = {
    // Get current company license info
    async getCompanyLimit(companyId: string) {
        const { data: company, error } = await supabase
            .from('companies')
            .select('max_users')
            .eq('id', companyId)
            .single();

        if (error) throw error;
        return company.max_users || 5;
    },

    // Get all members of my company - Updated with all fields
    async getTeamMembers(companyId: string) {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, role, created_at, company_id, full_name, phone, is_active, avatar_url, website, permissions, custom_role_id, birth_date, address')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Profile[];
    },

    // Get pending invitations
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

    // Create a new member directly (Admin only) - Updated for new fields
    async createMember(data: {
        email: string;
        password: string;
        role: Role;
        fullName: string;
        phone?: string;
        companyId: string;
        permissions?: any;
        customRoleId?: string;
        birthDate?: string;
        address?: string;
    }) {
        const { data: stringId, error } = await supabase.rpc('admin_create_user', {
            new_email: data.email,
            new_password: data.password,
            new_role: data.role,
            new_full_name: data.fullName,
            new_phone: data.phone || null,
            new_company_id: data.companyId,
            new_custom_role_id: data.customRoleId || null,
            new_birth_date: data.birthDate || null,
            new_address: data.address || null
        });

        if (error) throw error;
        return stringId;
    },

    // Update member details
    async updateMember(userId: string, updates: {
        full_name?: string | null;
        phone?: string | null;
        role?: Role;
        avatar_url?: string | null;
        website?: string | null;
        permissions?: any;
        custom_role_id?: string | null;
        birth_date?: string | null;
        address?: string | null;
    }) {
        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId);

        if (error) throw error;
    },

    // Delete a team member
    async deleteMember(id: string) {
        const { error } = await supabase.rpc('admin_delete_user', {
            target_user_id: id
        });
        if (error) throw error;
    },

    // Get roles
    async getRoles(companyId: string) {
        const { data, error } = await supabase
            .from('custom_roles')
            .select('*')
            .or(`company_id.eq.${companyId},is_system.eq.true`)
            .order('is_system', { ascending: false });

        if (error) throw error;
        return data as CustomRole[];
    }
};
