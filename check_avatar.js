import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'jarias7604@gmail.com',
        password: 'Arias2026!'
    });

    if (authError) {
        console.error('Authentication error:', authError);
        return;
    }

    console.log('Successfully authenticated as:', authData.user.email);
    console.log('Authenticated User ID:', authData.user.id);

    // Fetch profile of authenticated user
    const { data: myProfile, error: myProfError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

    if (myProfError) {
        console.error('Error fetching my profile:', myProfError);
    } else {
        console.log('\nMY PROFILE DETAILS:');
        console.log('ID:', myProfile?.id);
        console.log('Email:', myProfile?.email);
        console.log('Full Name:', myProfile?.full_name);
        console.log('Avatar URL:', myProfile?.avatar_url);
    }

    // Fetch booking link for slug 'platform-owner'
    const { data: link, error: linkErr } = await supabase
        .from('booking_links')
        .select('*')
        .eq('slug', 'platform-owner')
        .maybeSingle();

    if (linkErr) {
        console.error('Error fetching booking link:', linkErr);
    } else {
        console.log('\nBOOKING LINK DETAILS:');
        console.log('ID:', link?.id);
        console.log('Slug:', link?.slug);
        console.log('User ID:', link?.user_id);
        console.log('Display Name:', link?.display_name);
        console.log('Avatar URL:', link?.avatar_url);
    }

    // Fetch all profiles
    const { data: profiles, error: profsError } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url');

    if (profsError) {
        console.error('Error fetching all profiles:', profsError);
    } else {
        console.log('\nALL PROFILES IN DB:');
        profiles.forEach(p => {
            console.log(`- ID: ${p.id} | Email: ${p.email} | Name: ${p.full_name} | Avatar: ${p.avatar_url}`);
        });
    }
}

check();
