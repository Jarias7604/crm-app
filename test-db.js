import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data, error } = await supabase
      .from('company_calendars')
      .select('*, integration:calendar_integrations(id, google_email, is_active), accesses:calendar_access(user_id, can_view, profile:profiles!calendar_access_user_id_fkey(id, full_name, avatar_url))')
      .limit(1);
    
    if (error) console.error('ERROR:', error);
    else console.log('SUCCESS:', data);
}
test();
