import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ikofyypxphrqkncimszt.supabase.co'
// Ideally this should be in .env but for simplicity/speed in this context we'll hardcode or assume .env. 
// Standard practice is .env. I will create .env.local as well.
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
