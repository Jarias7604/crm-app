import { createClient } from '@supabase/supabase-js';

// Production defaults to guarantee 100% uptime even if Vercel env is in transition
const PROD_DEFAULT_URL = 'https://ikofyypxphrqkncimszt.supabase.co';
const PROD_DEFAULT_ANON_KEY = 'sb_publishable_ku4xvR7ICmj7LS0otLEF_Q_0usehBy4';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// If env var points to legacy paused database (mtxqq), automatically heal to active production project (ikofyy)
const supabaseUrl = (rawUrl && rawUrl.startsWith('http') && !rawUrl.includes('mtxqq'))
    ? rawUrl
    : PROD_DEFAULT_URL;

const supabaseAnonKey = (rawKey && rawKey.startsWith('sb_publishable_') && !rawUrl?.includes('mtxqq'))
    ? rawKey
    : PROD_DEFAULT_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

