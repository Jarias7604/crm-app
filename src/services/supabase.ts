import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validación de variables de entorno requeridas
if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
    console.error('❌ VITE_SUPABASE_URL is missing or invalid! Check Vercel Environment Variables.');
}

if (!supabaseAnonKey) {
    console.error('❌ VITE_SUPABASE_ANON_KEY is missing! Check Vercel Environment Variables.');
}

// Safely create the client to prevent total app crash if env vars are missing
const safeUrl = (supabaseUrl && supabaseUrl.startsWith('http')) ? supabaseUrl : 'https://placeholder.supabase.co';
const safeKey = supabaseAnonKey || 'placeholder-key';

export const supabase = createClient(safeUrl, safeKey);
