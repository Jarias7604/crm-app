// @ts-nocheck
// ═══════════════════════════════════════════════════════
// EDGE FUNCTION: client-portal-upload
// Propósito: Permite al cliente subir documentos desde su portal público
//            SIN necesitar autenticación. Valida el portal_token y genera
//            una URL firmada para subir directo a Supabase Storage.
// Seguridad: Solo el token UUID de 36 chars permite acceso — no expone RLS complejo
// ═══════════════════════════════════════════════════════
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Admin client con service_role — bypassea RLS de forma controlada
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { portal_token, doc_type_id, stage_id, file_name, file_type, file_size } = await req.json();

    // ── Validaciones básicas ──────────────────────────────
    if (!portal_token || typeof portal_token !== 'string' || portal_token.length < 30) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!file_name || !file_type) {
      return new Response(JSON.stringify({ error: 'Parámetros de archivo faltantes' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Tipos MIME permitidos (documentos e imágenes)
    const ALLOWED_TYPES = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    ];
    if (!ALLOWED_TYPES.includes(file_type)) {
      return new Response(JSON.stringify({ error: `Tipo de archivo no permitido: ${file_type}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Límite 10MB
    if (file_size && file_size > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'Archivo demasiado grande (máx 10MB)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Buscar cliente por portal_token ───────────────────
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, company_id, nombre, etapa_actual_id')
      .eq('portal_token', portal_token)
      .single();

    if (clientError || !client) {
      console.error('Token no encontrado:', portal_token, clientError);
      return new Response(JSON.stringify({ error: 'Token de portal no válido o expirado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Construir ruta de storage ─────────────────────────
    const ext = file_name.split('.').pop()?.toLowerCase() || 'bin';
    const safeFileName = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const filePath = `clients/${client.company_id}/${client.id}/${stage_id || 'general'}/${safeFileName}`;

    // ── Generar upload URL firmada (5 min de validez) ─────
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('lead-documents')
      .createSignedUploadUrl(filePath);

    if (uploadError || !uploadData) {
      console.error('Error generando upload URL:', uploadError);
      throw new Error('No se pudo generar el enlace de subida');
    }

    // ── Registrar documento en BD ─────────────────────────
    const { data: docRecord, error: docError } = await supabase
      .from('client_documents')
      .insert({
        company_id: client.company_id,
        client_id: client.id,
        stage_id: stage_id || client.etapa_actual_id,
        doc_type_id: doc_type_id || null,
        nombre: file_name,
        file_path: filePath,
        file_size: file_size || null,
        file_type: file_type,
        subido_por_cliente: true,
        uploaded_by: null,
      })
      .select('id')
      .single();

    if (docError) {
      console.error('Error registrando documento:', docError);
      throw new Error('No se pudo registrar el documento');
    }

    // ── Respuesta exitosa ─────────────────────────────────
    return new Response(JSON.stringify({
      upload_url: uploadData.signedUrl,
      upload_token: uploadData.token,
      file_path: filePath,
      doc_id: docRecord.id,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Error en client-portal-upload:', err);
    return new Response(JSON.stringify({ error: err.message || 'Error interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
