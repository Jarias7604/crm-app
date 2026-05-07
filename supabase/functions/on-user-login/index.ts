import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * AUTH HOOK: on-user-login
 * ==========================
 * Se ejecuta en CADA LOGIN de cualquier usuario.
 * Inyecta company_id y role en el JWT app_metadata automáticamente.
 * 
 * Esto garantiza que el RLS (get_auth_company_id()) siempre funcione
 * sin importar si el usuario fue creado manual o vía signup.
 * 
 * RESULTADO: Cualquier empresa nueva que se registre verá sus datos
 * inmediatamente sin necesidad de intervención manual.
 */
serve(async (req) => {
  try {
    const payload = await req.json()
    const { user } = payload

    if (!user?.id) {
      return new Response(JSON.stringify({ error: 'No user in payload' }), { status: 400 })
    }

    // Use service role to read profile (bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Fetch the user's profile to get company_id and role
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('company_id, role')
      .eq('id', user.id)
      .single()

    if (error || !profile) {
      console.error('Profile not found for user:', user.id, error?.message)
      // Return original token without modification — don't break login
      return new Response(JSON.stringify(payload), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Inject company_id and role into app_metadata
    // This is what get_auth_company_id() reads from the JWT
    const updatedPayload = {
      ...payload,
      user: {
        ...user,
        app_metadata: {
          ...user.app_metadata,
          company_id: profile.company_id,
          role: profile.role
        }
      }
    }

    console.log(`✅ JWT enriched for ${user.email}: company_id=${profile.company_id}, role=${profile.role}`)

    return new Response(JSON.stringify(updatedPayload), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('Auth hook error:', err)
    // CRITICAL: Never break login — return original payload on error
    const payload = await req.json().catch(() => ({}))
    return new Response(JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
