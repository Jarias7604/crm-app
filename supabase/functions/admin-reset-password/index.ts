// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        // 1. Validate the caller's JWT (anon client — honors RLS)
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'No autorizado' }), {
                status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Client with caller's JWT to verify identity
        const callerClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
            global: { headers: { Authorization: authHeader } }
        });

        const { data: { user: callerUser }, error: authError } = await callerClient.auth.getUser();
        if (authError || !callerUser) {
            return new Response(JSON.stringify({ error: 'Token inválido' }), {
                status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Admin client with service role (for DB lookups + password update)
        const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 2. Verify caller is an admin
        const { data: callerProfile, error: profileError } = await adminClient
            .from('profiles')
            .select('role, company_id')
            .eq('id', callerUser.id)
            .single();

        if (profileError || !callerProfile) {
            return new Response(JSON.stringify({ error: 'Perfil no encontrado' }), {
                status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (!['company_admin', 'super_admin'].includes(callerProfile.role)) {
            return new Response(JSON.stringify({ error: 'Se requiere rol de administrador' }), {
                status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 3. Parse request body
        const { target_user_id, new_password } = await req.json();

        if (!target_user_id || !new_password) {
            return new Response(JSON.stringify({ error: 'Faltan parámetros requeridos' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (new_password.length < 6) {
            return new Response(JSON.stringify({ error: 'La contraseña debe tener al menos 6 caracteres' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 4. Verify target user exists and check company isolation
        const { data: targetProfile, error: targetError } = await adminClient
            .from('profiles')
            .select('role, company_id, full_name, email')
            .eq('id', target_user_id)
            .single();

        if (targetError || !targetProfile) {
            return new Response(JSON.stringify({ error: 'Usuario destino no encontrado' }), {
                status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Company admin can only reset passwords within their own company
        if (callerProfile.role === 'company_admin' && callerProfile.company_id !== targetProfile.company_id) {
            return new Response(JSON.stringify({ error: 'No puedes resetear contraseñas de otra empresa' }), {
                status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Only super_admin can reset another super_admin's password
        if (targetProfile.role === 'super_admin' && callerProfile.role !== 'super_admin') {
            return new Response(JSON.stringify({ error: 'No puedes resetear la contraseña de un Super Admin' }), {
                status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 5. Reset the password using the official Supabase Admin API
        const { data, error: resetError } = await adminClient.auth.admin.updateUserById(
            target_user_id,
            { password: new_password }
        );

        if (resetError) {
            console.error('Password reset error:', resetError);
            return new Response(JSON.stringify({ error: resetError.message }), {
                status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log(`Password reset: ${callerUser.email} reset password for ${targetProfile.email}`);

        return new Response(JSON.stringify({
            success: true,
            message: `Contraseña actualizada para ${targetProfile.full_name}`
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error('Unexpected error:', err);
        return new Response(JSON.stringify({ error: err.message || 'Error inesperado' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
