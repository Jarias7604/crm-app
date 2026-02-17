
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mtxqqamitglhehaktgxm.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MTg3NDAsImV4cCI6MjA4NTQ5NDc0MH0.ybK2j-anHpMIlgaH0D-pRz4W6kyb96fNsbXTfT2FE2o'

const supabase = createClient(supabaseUrl, supabaseKey)

async function register() {
    const { data, error } = await supabase.auth.signUp({
        email: 'sales@ariasdefense.com',
        password: '123456',
        options: {
            data: {
                full_name: 'Remote User Test'
            }
        }
    })

    if (error) {
        console.error('Error creating user:', error)
    } else {
        console.log('User created successfully:', data)
    }
}

register()
