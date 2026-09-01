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

// One-time cleanup: a previous build briefly pointed the client at the wrong Supabase
// project (ikofyypxphrqkncimszt). Any auth token/lock it left in localStorage belongs to
// a project this app no longer talks to and can only cause "Lock not released" hangs.
// Remove it so affected users get a clean login against the correct project.
if (typeof window !== 'undefined' && window.localStorage) {
    try {
        const stale: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.includes('ikofyypxphrqkncimszt')) stale.push(k);
        }
        stale.forEach(k => localStorage.removeItem(k));
    } catch {
        /* ignore */
    }
}

export const supabase = createClient(safeUrl, safeKey);

