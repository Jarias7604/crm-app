import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// Ideally this should be in .env but for simplicity/speed in this context we'll hardcode or assume .env. 
// Standard practice is .env. I will create .env.local as well.
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validación de variables de entorno requeridas
if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
    console.error('❌ VITE_SUPABASE_URL is missing or invalid! Check Vercel Environment Variables.');
}

if (!supabaseAnonKey) {
    console.error('❌ VITE_SUPABASE_ANON_KEY is missing! Check Vercel Environment Variables.');
}

// Safely create the client or a placeholder to prevent total app crash
const safeUrl = (supabaseUrl && supabaseUrl.startsWith('http')) ? supabaseUrl : 'https://placeholder.supabase.co';
const safeKey = supabaseAnonKey || 'placeholder-key';

export const supabase = createClient(safeUrl, safeKey);
