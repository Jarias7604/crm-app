import { supabase } from './supabase';
import type { Company } from '../types';

export const brandingService = {
  async getMyCompany(): Promise<Company> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.company_id) throw new Error('No company assigned');

    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', profile.company_id)
      .single();

    if (error) throw error;
    return data as Company;
  },

  async updateBranding(updates: Partial<Company>): Promise<Company> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.company_id) throw new Error('No company assigned');

    const { data, error } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', profile.company_id)
      .select()
      .single();

    if (error) throw error;
    return data as Company;
  },
};
