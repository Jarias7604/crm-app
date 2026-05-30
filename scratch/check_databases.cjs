const { createClient } = require('@supabase/supabase-js');

// Database 1: mtxqq (Production listed in masters)
const mtxqqUrl = "https://mtxqqamitglhehaktgxm.supabase.co";
const mtxqqKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MTg3NDAsImV4cCI6MjA4NTQ5NDc0MH0.ybK2j-anHpMIlgaH0D-pRz4W6kyb96fNsbXTfT2FE2o";

// Database 2: ikofyy (Vercel prod environment)
const ikofyyUrl = "https://ikofyypxphrqkncimszt.supabase.co";
const ikofyyKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlrb2Z5eXB4cGhycWtuY2ltc3p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NjU5OTUsImV4cCI6MjA4NDM0MTk5NX0.pSXAndXDDYOdfHqX0LK9l9LNHcW5U73veFM3ybp-jdU";

// Database 3: ubqscy (Testing)
const ubqscyUrl = "https://ubqscyfefgfbmndnypbp.supabase.co";
const ubqscyKey = "sb_publishable_1dt5o9J7DLRvL7ZSUGNgEA_4wBaM56E";

const email = "jarias7604@gmail.com";
const password = "Arias2026!";

async function checkDb(name, url, key) {
    try {
        const supabase = createClient(url, key);
        
        // Log in to get past RLS
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (authError) {
            console.log(`❌ DB ${name}: Login Error: ${authError.message}`);
            return;
        }

        console.log(`🔑 DB ${name}: Login Success (User ID: ${authData.user.id})`);

        // Now query leads count
        const { count, error } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true });
        
        if (error) {
            console.log(`   DB ${name}: Leads Error: ${error.message}`);
        } else {
            console.log(`   DB ${name}: ${count} total leads found!`);
        }

        // Query won deals count
        const { count: wonCount, error: wonError } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .or('status.eq.Cerrado,status.eq.Cliente,status.eq.Ganado');
        if (!wonError) {
            console.log(`   DB ${name}: ${wonCount} won deals found!`);
        }
    } catch (e) {
        console.log(`❌ DB ${name} exception: ${e.message}`);
    }
}

async function run() {
    console.log("=== SECURE DB CHECK WITH AUTH ===");
    await checkDb("mtxqq (Prod)", mtxqqUrl, mtxqqKey);
    await checkDb("ikofyy (Vercel Prod / ikofyypxphrqkncimszt)", ikofyyUrl, ikofyyKey);
    await checkDb("ubqscy (Local Testing / ubqscyfefgfbmndnypbp)", ubqscyUrl, ubqscyKey);
}
run();
