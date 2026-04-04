import { supabase } from './supabase';

export interface FlyerIdea {
  titulo: string;
  gancho: string;
  beneficios: string[];
  tono: string;
  cta: string;
  paleta: string[];
}

export interface FlyerAsset {
  id: string;
  company_id: string;
  image_url: string;
  prompt_used: string | null;
  titulo: string | null;
  status: 'generating' | 'ready' | 'error';
  created_at: string;
}

export interface FlyerSchedule {
  id: string;
  company_id: string;
  flyer_asset_id: string;
  channel: 'whatsapp' | 'telegram' | 'email';
  audience: 'all' | 'hot' | 'warm' | 'cold';
  cron_expression: string;
  is_active: boolean;
  ultimo_disparo: string | null;
  created_at: string;
}

export interface GenerateFlyerParams {
  companyId: string;
  idea: FlyerIdea;
  industria: string;
  oferta: string;
  logoUrl?: string | null;
}

export interface RecommendIdeasParams {
  industria: string;
  oferta: string;
  tono: string;
  companyId: string;
  idioma?: string;
}

export const flyerService = {
  async recommendIdeas(params: RecommendIdeasParams): Promise<FlyerIdea[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No autenticado');
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/flyer-recommend`,
      { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${session.access_token}` 
        }, 
        body: JSON.stringify(params) 
      }
    );
    if (!res.ok) { 
      const err = await res.json().catch(() => ({ error: res.statusText })); 
      throw new Error(err.error || 'Error al obtener ideas'); 
    }
    const data = await res.json();
    return (data.ideas || []) as FlyerIdea[];
  },

  async listFlyers(companyId: string, limit = 20): Promise<FlyerAsset[]> {
    const { data, error } = await supabase
      .from('flyer_assets')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as FlyerAsset[];
  },

  async listSchedules(companyId: string): Promise<FlyerSchedule[]> {
    const { data, error } = await supabase
      .from('flyer_schedules')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as FlyerSchedule[];
  },

  async createSchedule(params: Omit<FlyerSchedule, 'id' | 'created_at' | 'ultimo_disparo'>): Promise<FlyerSchedule> {
    const { data, error } = await supabase
      .from('flyer_schedules')
      .insert(params)
      .select()
      .single();
    if (error) throw error;
    return data as FlyerSchedule;
  },

  async toggleSchedule(scheduleId: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('flyer_schedules')
      .update({ is_active: isActive })
      .eq('id', scheduleId);
    if (error) throw error;
  },

  async deleteSchedule(scheduleId: string): Promise<void> {
    const { error } = await supabase
      .from('flyer_schedules')
      .delete()
      .eq('id', scheduleId);
    if (error) throw error;
  },

  async saveFlyer(asset: Omit<FlyerAsset, "id" | "created_at">): Promise<FlyerAsset> {
    const { data, error } = await supabase
      .from('flyer_assets')
      .insert(asset)
      .select()
      .single();
    if (error) throw error;
    return data as FlyerAsset;
  },

  async uploadFlyer(blob: Blob, companyId: string): Promise<string> {
    const fileName = `${companyId}/${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage
      .from('marketing_assets')
      .upload(fileName, blob, { contentType: 'image/png' });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('marketing_assets')
      .getPublicUrl(fileName);

    return publicUrl;
  }
};