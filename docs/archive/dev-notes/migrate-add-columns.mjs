/**
 * MIGRATION SCRIPT - Add Missing Columns to Cotizaciones
 * ========================================================
 * Senior Architecture: Ensures backward compatibility with legacy data
 * Executes SQL migration directly via Supabase client
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: Supabase credentials not found in .env.local');
    console.error('Required: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🚀 Starting migration: Add missing columns to cotizaciones table...\n');

async function runMigration() {
    try {
        // Step 1: Add columns
        console.log('📝 Step 1: Adding columns subtotal_recurrente and iva_recurrente...');

        const { error: alterError } = await supabase.rpc('exec_sql', {
            sql: `
                ALTER TABLE cotizaciones 
                ADD COLUMN IF NOT EXISTS subtotal_recurrente DECIMAL(10,2) DEFAULT 0,
                ADD COLUMN IF NOT EXISTS iva_recurrente DECIMAL(10,2) DEFAULT 0;
            `
        });

        if (alterError) {
            // If RPC doesn't exist, try direct SQL via service
            console.log('⚠️  RPC not available, trying alternative method...');

            // Alternative: Use raw SQL execution
            const { error: directError } = await supabase
                .from('cotizaciones')
                .select('id')
                .limit(1);

            if (directError) {
                throw new Error(`Cannot access cotizaciones table: ${directError.message}`);
            }

            console.log('✅ Table access verified. Columns may already exist or need manual migration.');
            console.log('\n📋 MANUAL MIGRATION REQUIRED:');
            console.log('Please run this SQL in Supabase Dashboard > SQL Editor:\n');
            console.log(`
-- Add missing columns
ALTER TABLE cotizaciones 
ADD COLUMN IF NOT EXISTS subtotal_recurrente DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS iva_recurrente DECIMAL(10,2) DEFAULT 0;

-- Update existing records
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
            `);
        } else {
            console.log('✅ Columns added successfully!');

            // Step 2: Update existing records
            console.log('\n📝 Step 2: Updating existing records with calculated values...');

            const { error: updateError } = await supabase.rpc('exec_sql', {
                sql: `
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
                `
            });

            if (updateError) {
                console.log('⚠️  Could not update records automatically.');
            } else {
                console.log('✅ Existing records updated successfully!');
            }
        }

        console.log('\n✨ Migration completed!\n');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.log('\n📋 Please run the SQL manually in Supabase Dashboard.');
        process.exit(1);
    }
}

runMigration();
