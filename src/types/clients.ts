// ═══════════════════════════════════════════════════════
// MÓDULO CLIENTES — Tipos TypeScript
// ═══════════════════════════════════════════════════════

export interface ClientPipelineStage {
  id: string;
  company_id: string;
  nombre: string;
  descripcion: string | null;
  icono: string;
  color: string;
  orden: number;
  es_final: boolean;
  activo: boolean;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  // relaciones
  document_types?: ClientStageDocumentType[];
  assigned_profile?: { id: string; full_name: string | null; email: string } | null;
}

export interface ClientStageDocumentType {
  id: string;
  stage_id: string;
  company_id: string;
  nombre: string;
  descripcion: string | null;
  requerido: boolean;
  requiere_documento: boolean;
  requiere_texto: boolean;
  orden: number;
  created_at: string;
}

export interface Client {
  id: string;
  company_id: string;
  lead_id: string | null;
  nombre: string;
  contacto: string | null;
  email: string | null;
  telefono: string | null;
  assigned_to: string | null;
  etapa_actual_id: string | null;
  es_activo: boolean;
  portal_token: string;
  notas: string | null;
  created_at: string;
  updated_at: string;
  // relaciones enriquecidas
  etapa_actual?: ClientPipelineStage;
  assigned_profile?: { id: string; full_name: string | null; email: string };
  documents?: ClientDocument[];
  stage_history?: { stage_id: string; entered_at: string; exited_at: string | null }[];
  // fecha real de cierre del trato (viene del lead asociado)
  fecha_cierre_lead?: string | null;
}

export interface ClientDocument {
  id: string;
  company_id: string;
  client_id: string;
  stage_id: string | null;
  doc_type_id: string | null;
  nombre: string;
  file_path: string | null;
  file_size: number | null;
  file_type: string | null;
  subido_por_cliente: boolean;
  uploaded_by: string | null;
  created_at: string;
  valor_texto: string | null;
  // relaciones
  doc_type?: ClientStageDocumentType;
  uploader?: { full_name: string | null; email: string };
}

// Para el portal público del cliente
export interface ClientPortalData {
  client: {
    id: string;
    nombre: string;
    contacto: string | null;
    company_id: string;
    etapa_actual: ClientPipelineStage & {
      document_types: ClientStageDocumentType[];
    };
    proxima_etapa: Pick<ClientPipelineStage, 'id' | 'nombre' | 'descripcion' | 'icono' | 'color' | 'orden' | 'es_final'> | null;
    documents: ClientDocument[];
  };
  company: {
    nombre: string;
    logo_url?: string | null;
    portal_terms_text?: string | null;
    website?: string | null;
    email?: string | null;
  };
}

export interface ClientStageComment {
  id: string;
  company_id: string;
  client_id: string;
  stage_id: string;
  comment: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  // relación
  author?: { id: string; full_name: string | null; email: string; avatar_url?: string | null };
}

// Para formularios
export type CreateClientInput = Pick<
  Client,
  'nombre' | 'contacto' | 'email' | 'telefono' | 'assigned_to' | 'notas'
> & { lead_id?: string; etapa_actual_id?: string };

export type UpdateClientInput = Partial<
  Pick<Client, 'nombre' | 'contacto' | 'email' | 'telefono' | 'assigned_to' | 'notas' | 'etapa_actual_id' | 'es_activo'>
>;

export type CreateStageInput = Pick<
  ClientPipelineStage,
  'company_id' | 'nombre' | 'descripcion' | 'icono' | 'color' | 'orden' | 'es_final' | 'assigned_to'
>;
