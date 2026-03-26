import { supabase } from './supabase';
import type {
  Client,
  ClientPipelineStage,
  ClientStageDocumentType,
  ClientDocument,
  CreateClientInput,
  UpdateClientInput,
  CreateStageInput,
  ClientPortalData,
} from '../types/clients';

// ─────────────────────────────────────
// PIPELINE STAGES
// ─────────────────────────────────────
export const pipelineStagesService = {
  async getAll(includeInactive = false): Promise<ClientPipelineStage[]> {
    let q = supabase
      .from('client_pipeline_stages')
      .select('*, document_types:client_stage_document_types(*)')
      .order('orden', { ascending: true });
    if (!includeInactive) q = q.eq('activo', true);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as ClientPipelineStage[];
  },

  async create(stage: CreateStageInput): Promise<ClientPipelineStage> {
    const { data, error } = await supabase
      .from('client_pipeline_stages')
      .insert(stage)
      .select()
      .single();
    if (error) throw error;
    return data as ClientPipelineStage;
  },

  async update(id: string, updates: Partial<CreateStageInput> & { activo?: boolean }): Promise<ClientPipelineStage> {
    const { data, error } = await supabase
      .from('client_pipeline_stages')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as ClientPipelineStage;
  },

  async updateOrder(items: { id: string; orden: number }[]): Promise<void> {
    const updates = items.map(({ id, orden }) =>
      supabase.from('client_pipeline_stages').update({ orden }).eq('id', id)
    );
    const results = await Promise.all(updates);
    const err = results.find(r => r.error)?.error;
    if (err) throw err;
  },

  async delete(id: string): Promise<void> {
    // Soft delete
    const { error } = await supabase
      .from('client_pipeline_stages')
      .update({ activo: false })
      .eq('id', id);
    if (error) throw error;
  },
};

// ─────────────────────────────────────
// DOCUMENT TYPES PER STAGE
// ─────────────────────────────────────
export const stageDocTypesService = {
  async getByStage(stageId: string): Promise<ClientStageDocumentType[]> {
    const { data, error } = await supabase
      .from('client_stage_document_types')
      .select('*')
      .eq('stage_id', stageId)
      .order('orden', { ascending: true });
    if (error) throw error;
    return (data || []) as ClientStageDocumentType[];
  },

  async create(input: Omit<ClientStageDocumentType, 'id' | 'company_id' | 'created_at'>): Promise<ClientStageDocumentType> {
    const { data, error } = await supabase
      .from('client_stage_document_types')
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as ClientStageDocumentType;
  },

  async update(id: string, updates: Partial<Pick<ClientStageDocumentType, 'nombre' | 'descripcion' | 'requerido' | 'orden'>>): Promise<ClientStageDocumentType> {
    const { data, error } = await supabase
      .from('client_stage_document_types')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as ClientStageDocumentType;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('client_stage_document_types').delete().eq('id', id);
    if (error) throw error;
  },
};

// ─────────────────────────────────────
// CLIENTS CRUD
// ─────────────────────────────────────
export const clientsService = {
  async getAll(filters?: { esActivo?: boolean }): Promise<Client[]> {
    let q = supabase
      .from('clients')
      .select(`
        *,
        etapa_actual:client_pipeline_stages(*),
        assigned_profile:profiles(id, full_name, email)
      `)
      .order('created_at', { ascending: false });

    if (filters?.esActivo !== undefined) {
      q = q.eq('es_activo', filters.esActivo);
    }

    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as unknown as Client[];
  },

  async getById(id: string): Promise<Client | null> {
    const { data, error } = await supabase
      .from('clients')
      .select(`
        *,
        etapa_actual:client_pipeline_stages(*, document_types:client_stage_document_types(*)),
        assigned_profile:profiles(id, full_name, email),
        documents:client_documents(*, doc_type:client_stage_document_types(*), uploader:profiles(full_name, email))
      `)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as unknown as Client;
  },

  async create(input: CreateClientInput): Promise<Client> {
    const { data, error } = await supabase
      .from('clients')
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as Client;
  },

  async update(id: string, updates: UpdateClientInput): Promise<Client> {
    const { data, error } = await supabase
      .from('clients')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Client;
  },

  async advanceStage(clientId: string, nextStageId: string): Promise<void> {
    const { error } = await supabase
      .from('clients')
      .update({ etapa_actual_id: nextStageId, updated_at: new Date().toISOString() })
      .eq('id', clientId);
    if (error) throw error;
  },

  async promoteToActive(clientId: string): Promise<void> {
    const { error } = await supabase
      .from('clients')
      .update({ es_activo: true, updated_at: new Date().toISOString() })
      .eq('id', clientId);
    if (error) throw error;
  },

  /** Genera el link del portal para enviar al cliente */
  getPortalUrl(portalToken: string): string {
    const base = import.meta.env.VITE_APP_URL || window.location.origin;
    return `${base}/portal/cliente/${portalToken}`;
  },
};

// ─────────────────────────────────────
// DOCUMENTS
// ─────────────────────────────────────
export const clientDocumentsService = {
  async getByClient(clientId: string, stageId?: string): Promise<ClientDocument[]> {
    let q = supabase
      .from('client_documents')
      .select('*, doc_type:client_stage_document_types(*), uploader:profiles(full_name, email)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (stageId) q = q.eq('stage_id', stageId);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as unknown as ClientDocument[];
  },

  async upload(
    clientId: string,
    companyId: string,
    stageId: string | null,
    docTypeId: string | null,
    file: File,
    subioPorCliente = false
  ): Promise<ClientDocument> {
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const path = `clients/${companyId}/${clientId}/${stageId || 'general'}/${fileName}`;

    // Subir a Storage
    const { error: storageError } = await supabase.storage
      .from('lead-documents')
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (storageError) throw storageError;

    // Registrar en BD
    const { data, error } = await supabase
      .from('client_documents')
      .insert({
        company_id: companyId,
        client_id: clientId,
        stage_id: stageId,
        doc_type_id: docTypeId,
        nombre: file.name,
        file_path: path,
        file_size: file.size,
        file_type: file.type,
        subido_por_cliente: subioPorCliente,
      })
      .select()
      .single();
    if (error) throw error;
    return data as ClientDocument;
  },

  async getSignedUrl(filePath: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from('lead-documents')
      .createSignedUrl(filePath, 3600);
    if (error) throw error;
    return data.signedUrl;
  },

  async delete(docId: string, filePath: string): Promise<void> {
    await supabase.storage.from('lead-documents').remove([filePath]);
    const { error } = await supabase.from('client_documents').delete().eq('id', docId);
    if (error) throw error;
  },
};

// ─────────────────────────────────────
// PORTAL PÚBLICO (sin auth)
// ─────────────────────────────────────
export const clientPortalService = {
  async getByToken(token: string): Promise<ClientPortalData | null> {
    const { data: client, error } = await supabase
      .from('clients')
      .select(`
        id, nombre, contacto, company_id,
        etapa_actual:client_pipeline_stages(
          *, document_types:client_stage_document_types(*)
        ),
        documents:client_documents(*, doc_type:client_stage_document_types(*))
      `)
      .eq('portal_token', token)
      .single();

    if (error || !client) return null;

    const etapaActual = (client as any).etapa_actual;

    // Fetch next stage (orden > current) and company info in parallel
    const [nextStageRes, compRes] = await Promise.all([
      supabase
        .from('client_pipeline_stages')
        .select('id, nombre, descripcion, icono, color, orden, es_final')
        .eq('company_id', (client as any).company_id)
        .eq('activo', true)
        .gt('orden', etapaActual?.orden ?? 0)
        .order('orden', { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('companies')
        .select('name, logo_url, portal_terms_text')
        .eq('id', (client as any).company_id)
        .single(),
    ]);

    return {
      client: {
        ...(client as unknown as ClientPortalData['client']),
        proxima_etapa: nextStageRes.data ?? null,
      },
      company: {
        nombre: compRes.data?.name || 'CRM',
        logo_url: compRes.data?.logo_url || null,
        portal_terms_text: compRes.data?.portal_terms_text || null,
      },
    };
  },

  async updatePortalTerms(companyId: string, termsText: string): Promise<void> {
    const { error } = await supabase
      .from('companies')
      .update({ portal_terms_text: termsText })
      .eq('id', companyId);
    if (error) throw error;
  },
};
