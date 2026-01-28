import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// Ideally this should be in .env but for simplicity/speed in this context we'll hardcode or assume .env. 
// Standard practice is .env. I will create .env.local as well.
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validación de variables de entorno requeridas
if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL is required. Please check your .env.local file.');
}

if (!supabaseAnonKey) {
    throw new Error('VITE_SUPABASE_ANON_KEY is required. Please check your .env.local file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
