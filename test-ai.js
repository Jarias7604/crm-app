import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

async function testAgent() {
    const payload = {
        prompt: "¿Como esta el performance de Diana Morales?",
        companyId: "bd45c38d-8a21-4f18-a6d1-4cc46db43d5f",
        performanceContext: {
            userPerformance: [
                {
                    user_name: "Diana Morales",
                    total_leads: 191,
                    leads_won: 65,
                    leads_lost: 7,
                    win_rate: 90.3,
                    closed_amount: 575
                }
            ],
            callSummary: []
        },
        isPerformanceChat: true
    };

    console.log('Invoking function on:', supabaseUrl);
    const response = await fetch(`${supabaseUrl}/functions/v1/dashboard-ai-agent`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify(payload)
    });

    const text = await response.text();
    console.log('Status:', response.status);
    console.log('Body:', text);
}

testAgent();
