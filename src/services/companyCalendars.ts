import { supabase } from './supabase';

export interface CompanyCalendar {
  id: string;
  company_id: string;
  name: string;
  color: string;
  integration_id: string | null;
  created_by: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  
  // Joins
  integration?: { id: string; google_email: string; is_active: boolean } | null;
  accesses?: CalendarAccess[];
}

export interface CalendarAccess {
  id?: string;
  company_calendar_id?: string;
  user_id: string;
  can_view: boolean;
  granted_by?: string;
  created_at?: string;
  
  // Join
  profile?: { id: string; full_name: string; avatar_url: string | null } | null;
}

export const companyCalendarsService = {

  // Obtener todos los calendarios compartidos de la empresa (con accesos)
  async getAll(companyId: string): Promise<CompanyCalendar[]> {
    const { data, error } = await supabase
      .from('company_calendars')
      .select(`
        *,
        integration:calendar_integrations(id, google_email, is_active),
        accesses:calendar_access(
          user_id, can_view,
          profile:profiles!calendar_access_user_id_fkey(id, full_name, avatar_url)
        )
      `)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('sort_order');

    if (error) throw error;
    return (data || []) as unknown as CompanyCalendar[];
  },

  // Obtener los calendarios que YO (usuario en sesión) puedo ver
  async getMyAccessibleCalendars(userId: string) {
    const { data, error } = await supabase
      .from('calendar_access')
      .select(`
        can_view,
        calendar:company_calendars(
          id, name, color,
          integration:calendar_integrations(id, access_token, token_expires_at, refresh_token)
        )
      `)
      .eq('user_id', userId)
      .eq('can_view', true);

    if (error) throw error;
    return data || [];
  },

  // Crear un nuevo calendario compartido
  async create(data: { company_id: string; name: string; color: string; created_by: string }) {
    const { data: result, error } = await supabase
      .from('company_calendars')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return result;
  },

  // Actualizar nombre, color o integracion
  async update(id: string, data: Partial<{ name: string; color: string; integration_id: string }>) {
    const { data: result, error } = await supabase
      .from('company_calendars')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return result;
  },

  // Dar acceso a un usuario
  async grantAccess(calendarId: string, userId: string, grantedBy: string) {
    const { error } = await supabase
      .from('calendar_access')
      .upsert({
        company_calendar_id: calendarId,
        user_id: userId,
        can_view: true,
        granted_by: grantedBy,
      }, { onConflict: 'company_calendar_id,user_id' });

    if (error) throw error;
  },

  // Revocar acceso
  async revokeAccess(calendarId: string, userId: string) {
    const { error } = await supabase
      .from('calendar_access')
      .delete()
      .eq('company_calendar_id', calendarId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  // Archivar (soft delete)
  async archive(id: string) {
    const { error } = await supabase
      .from('company_calendars')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  },
};
