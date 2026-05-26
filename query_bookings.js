import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.vercel' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: authData } = await supabase.auth.signInWithPassword({
        email: 'jarias7604@gmail.com',
        password: 'Arias2026!'
    });

    console.log('Fetching recent booking appointments...');
    const { data: appts, error } = await supabase
        .from('booking_appointments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching appointments:', error);
        return;
    }

    console.log(`Found ${appts.length} appointments:`);
    appts.forEach(a => {
        console.log(`- ID: ${a.id}`);
        console.log(`  Guest: ${a.guest_name} <${a.guest_email}>`);
        console.log(`  Start Time: ${a.start_time} | End Time: ${a.end_time}`);
        console.log(`  Status: ${a.status}`);
        console.log(`  Created At: ${a.created_at}`);
        console.log(`  User ID: ${a.user_id} | Company ID: ${a.company_id}`);
    });
}

check();
