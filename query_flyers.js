import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    // Sign in as user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'jarias7604@gmail.com',
      password: 'Arias2026!'
    });
    
    if (authError) {
      console.error("Auth error:", authError);
      return;
    }
    
    // Query recent flyers
    const { data, error } = await supabase
      .from('ai_generated_flyers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    
    if (error) {
      console.error('ERROR:', error);
    } else {
      fs.writeFileSync('flyer_query_results.json', JSON.stringify(data, null, 2));
      console.log('Saved 30 flyers to flyer_query_results.json');
    }
}
test();
