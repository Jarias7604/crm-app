import { supabase } from './supabase';
import type { Contract, CreateContractInput, SignContractInput } from '../types/contracts';

export const contractsService = {
  // Obtener contratos de la empresa
  async getByCompany(companyId: string | string[]): Promise<Contract[]> {
    let q = supabase.from('contracts').select('*');

    if (Array.isArray(companyId)) {
      if (companyId.length === 1) {
        q = q.eq('company_id', companyId[0]);
      } else if (companyId.length > 1) {
        q = q.in('company_id', companyId);
      }
    } else if (companyId) {
      q = q.eq('company_id', companyId);
    }

    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as Contract[];
  },

  // Obtener contratos vinculados a un lead
  async getByLead(leadId: string): Promise<Contract[]> {
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as Contract[];
  },

  // Obtener contratos vinculados a un cliente
  async getByClient(clientId: string): Promise<Contract[]> {
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as Contract[];
  },

  // Obtener contrato de una cotización específica
  async getByCotizacion(cotizacionId: string): Promise<Contract | null> {
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('cotizacion_id', cotizacionId)
      .order('created_at', { ascending: false })
      .maybeSingle();

    if (error) throw error;
    return data as Contract | null;
  },

  // Obtener contrato por ID
  async getById(id: string): Promise<Contract | null> {
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Contract;
  },

  // Obtener contrato para vista pública (sin autenticación requerida)
  async getPublicContract(id: string): Promise<{ contract: Contract; company: any } | null> {
    try {
      // Intentar primero vía RPC SECURITY DEFINER
      const { data, error } = await supabase.rpc('get_public_contract', { contract_id: id });
      if (!error && data && !data.error) {
        return {
          contract: data.contract as Contract,
          company: data.company,
        };
      }
    } catch {
      // Fallback a select directo si RPC no estuviera migrada aún
    }

    const { data: contract, error: contractErr } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', id)
      .single();

    if (contractErr || !contract) return null;

    const { data: company } = await supabase
      .from('companies')
      .select('id, name, logo_url, website, address, phone, tax_id')
      .eq('id', contract.company_id)
      .single();

    return {
      contract: contract as Contract,
      company: company || contract.datos_empresa,
    };
  },

  // Crear nuevo contrato
  async create(input: CreateContractInput): Promise<Contract> {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('contracts')
      .insert({
        ...input,
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data as Contract;
  },

  // Actualizar contrato
  async update(id: string, updates: Partial<CreateContractInput> & { status?: string; pdf_url?: string }): Promise<Contract> {
    const { data, error } = await supabase
      .from('contracts')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Contract;
  },

  // Firma pública del contrato
  async signPublic(id: string, signInput: SignContractInput): Promise<{ success: boolean; contract?: Contract; message?: string }> {
    try {
      const { data, error } = await supabase.rpc('sign_contract_public', {
        p_contract_id: id,
        p_signer_name: signInput.signer_name,
        p_signer_identification: signInput.signer_identification,
        p_signer_cargo: signInput.signer_cargo || 'Representante Autorizado',
        p_signature_image: signInput.signature_image,
        p_signer_ip: signInput.signer_ip || null,
        p_signer_user_agent: signInput.signer_user_agent || (typeof navigator !== 'undefined' ? navigator.userAgent : null),
      });

      if (!error && data && data.success) {
        return { success: true, contract: data.contract as Contract, message: data.message };
      }
    } catch {
      // Continuar con fallback directo
    }

    // Fallback directo si RPC no está lista
    const { data: updated, error: updateError } = await supabase
      .from('contracts')
      .update({
        status: 'firmado',
        firmado_digitalmente: true,
        firmado_en: new Date().toISOString(),
        firmante_nombre: signInput.signer_name,
        firmante_identificacion: signInput.signer_identification,
        firmante_cargo: signInput.signer_cargo || 'Representante Autorizado',
        firma_imagen: signInput.signature_image,
        firmante_ip: signInput.signer_ip || null,
        firmante_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;
    return { success: true, contract: updated as Contract };
  },

  // Eliminar contrato
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('contracts').delete().eq('id', id);
    if (error) throw error;
  },
};
