
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mtxqqamitglhehaktgxm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0Njc5NDAsImV4cCI6MjA1NDA0Mzk0MH0.p5jLiBM';

const conversationId = 'd5b34dff-5007-4fae-b2ee-2a456ab52c9d';

async function debugDevAI() {
    console.log(`Testing Dynamic Quoting for conversation: ${conversationId}`);

    // Simulamos que la IA responde con el disparador de cotización para el plan Business
    // El formato es QUOTE_TRIGGER: { ... }
    const aiSimulatedResponse = `Claro que sí, Jimmy. Para un volumen de 10,000 DTEs te recomiendo nuestro Plan Business. 
    
    QUOTE_TRIGGER: { "dte_volume": 10000, "plan_name": "Business", "items": ["Inventario Avanzado"] }`;

    // Para probar el procesador, necesitamos que el procesador MISMO ejecute la lógica.
    // Pero el procesador llama a OpenAI. Para saltarnos OpenAI y probar la LÓGICA DE COTIZACIÓN,
    // tendríamos que modificar el procesador temporalmente o simplemente confiar en que el código que escribí funciona.

    // Mejor aún: El procesador ya acepta el prompt. 
    // Voy a enviar un prompt que "fuerce" a la IA a responder con ese trigger si es posible, 
    // o simplemente verificaré el resultado de la última ejecución si el usuario lo prueba.

    // Pero espera, puedo hacer un fetch directo al procesador pasando el prompt.
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat-processor`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
            conversationId: conversationId,
            companyId: '7a582ba5-f7d0-4ae3-9985-35788deb1c30'
        })
    });

    const status = response.status;
    const body = await response.text();

    console.log(`Status: ${status}`);
    console.log(`Response: ${body}`);
}

debugDevAI().catch(console.error);
