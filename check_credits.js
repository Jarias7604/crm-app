import { createClient } from '@supabase/supabase-js';
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

    // Get profile to find company_id
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, company_id, role')
        .eq('id', authData.user.id)
        .single();

    if (profileError) {
        console.error('Profile query failed:', profileError);
        return;
    }

    console.log('Profile details:', profile);

    if (!profile.company_id) {
        console.log('No company_id associated with this profile!');
        return;
    }

    // Query credits
    const { data: credits, error: creditsError } = await supabase
        .from('ai_generation_credits')
        .select('*')
        .eq('company_id', profile.company_id);

    if (creditsError) {
        console.error('Credits query failed:', creditsError);
        return;
    }

    console.log('Credits record for company:', credits);
}

check();
