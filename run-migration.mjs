/**
 * SIMPLIFIED MIGRATION SCRIPT
 * ===========================
 * Senior Architecture: No external dependencies, uses built-in fetch
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read .env.local file manually
const envPath = join(__dirname, '.env.local');
let SUPABASE_URL = '';
let SUPABASE_KEY = '';

try {
    const envContent = readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');

    for (const line of lines) {
        if (line.startsWith('VITE_SUPABASE_URL=')) {
            SUPABASE_URL = line.split('=')[1].trim().replace(/['"]/g, '');
        }
        if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) {
            SUPABASE_KEY = line.split('=')[1].trim().replace(/['"]/g, '');
        }
        if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
            SUPABASE_KEY = line.split('=')[1].trim().replace(/['"]/g, '');
        }
    }
} catch (error) {
    console.error('❌ Could not read .env.local file');
    process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Supabase credentials not found');
    process.exit(1);
}

const SQL_MIGRATION = `
-- Add missing columns to cotizaciones
ALTER TABLE cotizaciones 
ADD COLUMN IF NOT EXISTS subtotal_recurrente DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS iva_recurrente DECIMAL(10,2) DEFAULT 0;

-- Update existing records with calculated values
UPDATE cotizaciones
SET 
    subtotal_recurrente = CASE 
        WHEN total_anual > 0 AND (subtotal_recurrente IS NULL OR subtotal_recurrente = 0) THEN
            (total_anual - COALESCE(monto_anticipo, 0)) / (1 + (COALESCE(iva_porcentaje, 13) / 100.0))
        ELSE subtotal_recurrente
    END,
    iva_recurrente = CASE 
        WHEN total_anual > 0 AND (iva_recurrente IS NULL OR iva_recurrente = 0) THEN
            (total_anual - COALESCE(monto_anticipo, 0)) - 
            ((total_anual - COALESCE(monto_anticipo, 0)) / (1 + (COALESCE(iva_porcentaje, 13) / 100.0)))
        ELSE iva_recurrente
    END
WHERE total_anual > 0;
`;

console.log('🚀 Executing migration via Supabase REST API...\n');
console.log('SQL to execute:');
console.log(SQL_MIGRATION);
console.log('\n' + '='.repeat(80));

async function executeMigration() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            },
            body: JSON.stringify({ sql: SQL_MIGRATION })
        });

        if (!response.ok) {
            console.log('⚠️  REST API method not available.');
            console.log('\n📋 SOLUTION: Run this SQL in Supabase Dashboard manually:\n');
            console.log('1. Go to: https://supabase.com/dashboard');
            console.log('2. Select your project');
            console.log('3. Click "SQL Editor" in left sidebar');
            console.log('4. Paste and run the SQL shown above');
            console.log('\n✅ After running, refresh your app and try generating PDF again.');
        } else {
            const result = await response.json();
            console.log('✅ Migration executed successfully!');
            console.log('Result:', result);
        }
    } catch (error) {
        console.log('\n📋 MANUAL MIGRATION REQUIRED:');
        console.log('Go to Supabase Dashboard > SQL Editor and run the SQL shown above.');
    }
}

executeMigration();
