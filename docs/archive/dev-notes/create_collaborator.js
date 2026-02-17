import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mtxqqamitglhehaktgxm.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MTg3NDAsImV4cCI6MjA4NTQ5NDc0MH0.ybK2j-anHpMIlgaH0D-pRz4W6kyb96fNsbXTfT2FE2o'

const supabase = createClient(supabaseUrl, supabaseKey)

async function createCollaborator() {
    // Sign up the user
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: 'colaborador@test.com',
        password: '123456',
        options: {
            data: {
                full_name: 'Usuario Colaborador',
                is_admin_creation: true
            }
        }
    })

    if (authError) {
        console.error('Error creating auth user:', authError)
        return
    }

    console.log('Auth user created:', authData.user.id)

    // Now update the profile to be a collaborator in the Arias company
    const userId = authData.user.id
    const ariasCompanyId = '00000000-0000-0000-0000-000000000000'

    console.log('User ID:', userId)
    console.log('Will assign to company:', ariasCompanyId)
}

createCollaborator()
