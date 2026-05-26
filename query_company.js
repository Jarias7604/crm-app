import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// Read Vercel env
const envContent = fs.readFileSync('.env.vercel', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^"|"$/g, '');
    }
});

const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('Logging in as jarias7604@gmail.com...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'jarias7604@gmail.com',
        password: 'Arias2026!'
    });

    if (authError) {
        console.error('Login failed:', authError);
        return;
    }

    console.log('Login successful! User ID:', authData.user.id);

    console.log('Querying company...');
    const { data: company, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', '7a582ba5-f7d0-4ae3-9985-35788deb1c30')
        .maybeSingle();

    if (error) {
        console.error('Error fetching company:', error);
        return;
    }

    console.log('Company found:', company);
}

check();
