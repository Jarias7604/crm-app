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

    console.log('Querying all profiles...');
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url, role');

    if (error) {
        console.error('Error fetching profiles:', error);
        return;
    }

    console.log(`Found ${profiles?.length || 0} profiles:`);
    profiles?.forEach(p => {
        console.log(`- ${p.email} | ${p.full_name} | Role: ${p.role} | Avatar: ${p.avatar_url}`);
    });
}

check();
