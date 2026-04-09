// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CRM_RESET_REDIRECT = 'https://crm-app-v2.vercel.app/update-password';

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'No autorizado' }), {
                status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: authHeader } }
        });

        const { data: { user: callerUser }, error: authError } = await callerClient.auth.getUser();
        if (authError || !callerUser) {
            return new Response(JSON.stringify({ error: 'Token invalido' }), {
                status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        const { data: callerProfile } = await adminClient
            .from('profiles')
            .select('role, company_id, full_name, email')
            .eq('id', callerUser.id)
            .single();

        if (!callerProfile || !['company_admin', 'super_admin'].includes(callerProfile.role)) {
            return new Response(JSON.stringify({ error: 'Se requiere rol de administrador' }), {
                status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const bodyText = await req.text();
        const { target_user_id, new_password, mode = 'direct' } = JSON.parse(bodyText);

        if (!target_user_id) {
            return new Response(JSON.stringify({ error: 'target_user_id requerido' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const [{ data: targetProfile }, { data: authUserData }] = await Promise.all([
            adminClient.from('profiles').select('role, company_id, full_name, email').eq('id', target_user_id).single(),
            adminClient.auth.admin.getUserById(target_user_id)
        ]);

        if (!targetProfile) {
            return new Response(JSON.stringify({ error: 'Usuario destino no encontrado' }), {
                status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const targetAuthEmail = authUserData?.user?.email || targetProfile.email;

        // super_admin bypasses ALL restrictions
        if (callerProfile.role !== 'super_admin') {
            if (callerProfile.company_id !== targetProfile.company_id) {
                return new Response(JSON.stringify({ error: 'No puedes resetear contrasenas de otra empresa' }), {
                    status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
            if (targetProfile.role === 'super_admin') {
                return new Response(JSON.stringify({ error: 'No puedes resetear la contrasena de un Super Admin' }), {
                    status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        const ipAddress = req.headers.get('x-forwarded-for') || 'unknown';
        const callerEmail = callerProfile.email || callerUser.email || 'unknown';

        if (mode === 'email_link') {
            if (!targetAuthEmail) {
                return new Response(JSON.stringify({ error: 'El usuario no tiene correo electronico registrado.' }), {
                    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
            const { error: linkError } = await adminClient.auth.resetPasswordForEmail(
                targetAuthEmail, { redirectTo: CRM_RESET_REDIRECT }
            );
            if (linkError) {
                return new Response(JSON.stringify({ error: linkError.message }), {
                    status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
            
            // ANTI-FAIL: Wrap logs in try-catch so it never breaks the UI flow
            try {
                await adminClient.from('password_reset_log').insert({
                    target_user_id, target_email: targetAuthEmail,
                    target_full_name: targetProfile.full_name || null,
                    performed_by_id: callerUser.id, performed_by_email: callerEmail,
                    performed_by_role: callerProfile.role, ip_address: ipAddress, reset_method: 'email_link'
                });
            } catch(e) { console.warn('Log insert failed:', e.message); }
            
            console.log(`[reset-password] EMAIL LINK: ${callerEmail} -> ${targetAuthEmail}`);
            
            return new Response(JSON.stringify({
                success: true, mode: 'email_link',
                message: `Enlace enviado a ${targetAuthEmail}`
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // MODE B: Direct
        if (!new_password || new_password.length < 6) {
            return new Response(JSON.stringify({ error: 'Contrasena invalida (minimo 6 caracteres)' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log(`[reset-password] Updating password for user ${target_user_id}`);

        // MAIN ACTION: Update password
        const { error: resetError } = await adminClient.auth.admin.updateUserById(
            target_user_id, { password: new_password }
        );

        if (resetError) {
            console.error('Password reset error:', resetError.message);
            return new Response(JSON.stringify({ error: resetError.message }), {
                status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // ANTI-FAIL: Wrap logs in try-catch so it never breaks the UI flow
        try {
            await adminClient.from('password_reset_log').insert({
                target_user_id, target_email: targetAuthEmail || 'unknown',
                target_full_name: targetProfile.full_name || null,
                performed_by_id: callerUser.id, performed_by_email: callerEmail,
                performed_by_role: callerProfile.role, ip_address: ipAddress, reset_method: 'direct'
            });
        } catch(e) { console.warn('Log insert failed:', e.message); }

        console.log(`[reset-password] SUCCESS: ${callerEmail} -> ${targetAuthEmail}`);

        return new Response(JSON.stringify({
            success: true, mode: 'direct',
            message: `Contrasena actualizada para ${targetProfile.full_name || targetAuthEmail}`
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err) {
        console.error('Unexpected error:', err.message);
        return new Response(JSON.stringify({ error: err.message || 'Error inesperado' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
