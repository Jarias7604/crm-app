// ═══════════════════════════════════════════════════════
// MÓDULO DE CONTRATOS — Tipos TypeScript
// ═══════════════════════════════════════════════════════

export type ContractStatus = 'borrador' | 'enviado' | 'firmado' | 'cancelado';

export interface ContractClause {
  id: string;
  numero: string; // Ej: "PRIMERA", "SEGUNDA"
  titulo: string; // Ej: "OBJETO DEL CONTRATO"
  contenido: string;
  es_personalizada?: boolean;
}

export interface ContractCompanyData {
  nombre: string;
  tax_id?: string;
  representante?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  ciudad_pais?: string;
  logo_url?: string | null;
  website?: string | null;
}

export interface ContractClientData {
  nombre: string;
  empresa?: string;
  tax_id?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  cargo?: string;
}

export interface Contract {
  id: string;
  company_id: string;
  lead_id: string | null;
  client_id: string | null;
  cotizacion_id: string | null;

  contract_number: string;
  title: string;
  status: ContractStatus;

  objeto: string;
  clausulas: ContractClause[];

  monto_total: number;
  forma_pago: string;
  anticipo: number;
  cuotas: number;
  valor_cuota: number;
  vigencia_meses: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  meses_gracia?: number | null;
  fecha_primer_cobro?: string | null;
  notas?: string | null;
  jurisdiccion: string;

  datos_empresa: ContractCompanyData;
  datos_cliente: ContractClientData;

  firmado_digitalmente: boolean;
  firmado_en: string | null;
  firmante_nombre: string | null;
  firmante_identificacion: string | null;
  firmante_cargo: string | null;
  firma_imagen: string | null;
  firmante_ip: string | null;
  firmante_user_agent: string | null;

  pdf_url: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateContractInput {
  company_id: string;
  lead_id?: string | null;
  client_id?: string | null;
  cotizacion_id?: string | null;
  contract_number: string;
  title?: string;
  status?: ContractStatus;
  objeto: string;
  clausulas: ContractClause[];
  monto_total: number;
  forma_pago: string;
  anticipo?: number;
  cuotas?: number;
  valor_cuota?: number;
  vigencia_meses?: number;
  fecha_inicio?: string;
  fecha_fin?: string | null;
  meses_gracia?: number | null;
  fecha_primer_cobro?: string | null;
  notas?: string | null;
  jurisdiccion?: string;
  datos_empresa: ContractCompanyData;
  datos_cliente: ContractClientData;
}

export interface SignContractInput {
  signer_name: string;
  signer_identification: string;
  signer_cargo?: string;
  signature_image: string; // base64 data URL
  signer_ip?: string;
  signer_user_agent?: string;
}
