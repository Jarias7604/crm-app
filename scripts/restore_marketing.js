import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Asegurarse de que el directorio actual es la raíz del proyecto
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Proyecto de Producción (Destino)
const destUrl = process.env.VITE_SUPABASE_URL;
const destKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Proyecto de Respaldo (Origen)
const sourceUrl = process.env.BACKUP_SUPABASE_URL || 'https://ikofyypxphrqkncimszt.supabase.co';
const sourceKey = process.env.BACKUP_SUPABASE_SERVICE_KEY;

if (!destUrl || !destKey || !sourceUrl || !sourceKey) {
  console.error("Faltan variables de entorno críticas.");
  process.exit(1);
}

const sourceSupabase = createClient(sourceUrl, sourceKey, { auth: { persistSession: false } });
const destSupabase = createClient(destUrl, destKey, { auth: { persistSession: false } });

const COMPANY_ID = '7a582ba5-f7d0-4ae3-9985-35788deb1c30';

async function restoreMarketing() {
  console.log('Iniciando restauración de Marketing...');

  const tables = [
    'marketing_integrations',
    'marketing_ai_agents',
    'marketing_templates',
    'marketing_campaigns',
    'marketing_conversations',
    'marketing_messages'
  ];

  for (const table of tables) {
    console.log(`\nExtrayendo ${table}...`);
    
    // Para messages, como no tienen company_id, buscamos los vinculados a las conversaciones de la compañía
    let query = sourceSupabase.from(table).select('*');
    
    if (table === 'marketing_messages') {
        const { data: convs } = await sourceSupabase.from('marketing_conversations').select('id').eq('company_id', COMPANY_ID);
        if (!convs || convs.length === 0) {
             console.log(`No hay conversaciones, saltando mensajes.`);
             continue;
        }
        const convIds = convs.map(c => c.id);
        query = query.in('conversation_id', convIds);
    } else {
        query = query.eq('company_id', COMPANY_ID);
    }

    const { data: records, error: extractError } = await query;

    if (extractError) {
      console.error(`Error extrayendo ${table}:`, extractError);
      continue;
    }

    if (!records || records.length === 0) {
      console.log(`0 registros encontrados para ${table}.`);
      continue;
    }

    console.log(`Encontrados ${records.length} registros en ${table}. Insertando en producción...`);

    // Inyectar en lotes de 50
    const BATCH_SIZE = 50;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await destSupabase.from(table).upsert(batch, { onConflict: 'id', ignoreDuplicates: true });
      if (insertError) {
          console.error(`Error insertando lote en ${table}:`, insertError.message);
      } else {
          console.log(`Lote insertado correctamente en ${table}`);
      }
    }
  }

  console.log('\n✅ Restauración de Marketing completada.');
}

restoreMarketing().catch(console.error);
