const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://mtxqqamitglhehaktgxm.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTkxODc0MCwiZXhwIjoyMDg1NDk0NzQwfQ.b64QK9CbdD1lYh0cxWDsDvT9Me0AQRXw6kpKnUvGHV4'
);

async function diagnose() {
    console.log('=== DIAGNÓSTICO COMPLETO TELEGRAM ===\n');

    // 1. Find Jimmy
    console.log('1. Buscando lead Jimmy...');
    const { data: jimmys } = await supabase
        .from('leads')
        .select('id, name, email, phone, company_id')
        .ilike('name', '%jimmy%');
    
    console.log('Leads encontrados:', JSON.stringify(jimmys, null, 2));

    if (!jimmys || jimmys.length === 0) {
        console.log('❌ No se encontró ningún lead con nombre Jimmy');
        return;
    }

    // 2. Check conversations for each Jimmy
    for (const jimmy of jimmys) {
        console.log(`\n2. Verificando conversaciones para ${jimmy.name} (${jimmy.id})...`);
        
        const { data: convs } = await supabase
            .from('marketing_conversations')
            .select('id, channel, external_id, status, created_at')
            .eq('lead_id', jimmy.id);
        
        console.log('Conversaciones:', JSON.stringify(convs, null, 2));

        if (convs && convs.length > 0) {
            const tgConv = convs.find(c => c.channel === 'telegram');
            if (tgConv) {
                console.log(`\n✅ Conversación Telegram encontrada! ID: ${tgConv.id}, Chat ID: ${tgConv.external_id}`);
                
                // 3. Check last 5 messages in this conversation
                console.log('\n3. Últimos 5 mensajes en la conversación:');
                const { data: msgs } = await supabase
                    .from('marketing_messages')
                    .select('id, direction, content, status, created_at, metadata')
                    .eq('conversation_id', tgConv.id)
                    .order('created_at', { ascending: false })
                    .limit(5);
                
                console.log(JSON.stringify(msgs, null, 2));

                // 4. Try sending a test message directly
                console.log('\n4. Enviando mensaje de prueba DIRECTO...');
                const { data: newMsg, error: insertErr } = await supabase
                    .from('marketing_messages')
                    .insert({
                        conversation_id: tgConv.id,
                        direction: 'outbound',
                        content: '🤖 TEST desde diagnóstico — Si ves esto, el sistema funciona!',
                        type: 'text',
                        status: 'pending',
                        metadata: { source: 'diagnostic_test' }
                    })
                    .select()
                    .single();
                
                if (insertErr) {
                    console.log('❌ Error insertando mensaje:', insertErr.message);
                } else {
                    console.log('✅ Mensaje insertado:', newMsg.id);
                    console.log('Esperando 5 segundos para que el webhook dispare...');
                    await new Promise(r => setTimeout(r, 5000));

                    // Check status
                    const { data: updated } = await supabase
                        .from('marketing_messages')
                        .select('status, metadata')
                        .eq('id', newMsg.id)
                        .single();
                    
                    console.log('Estado después de 5s:', JSON.stringify(updated, null, 2));
                }
            } else {
                console.log('❌ No hay conversación de Telegram para este Jimmy');
            }
        } else {
            console.log('❌ No hay conversaciones');
        }
    }

    // 5. Check Telegram integration
    console.log('\n5. Verificando integración Telegram...');
    const { data: tgInt } = await supabase
        .from('marketing_integrations')
        .select('provider, is_active, settings')
        .eq('provider', 'telegram');
    
    // Mask token for safety
    const masked = tgInt?.map(i => ({
        ...i,
        settings: { ...i.settings, token: i.settings?.token ? `...${i.settings.token.slice(-6)}` : 'MISSING' }
    }));
    console.log('Integraciones Telegram:', JSON.stringify(masked, null, 2));
}

diagnose().catch(console.error);
