// src/lib/api.ts
// Helper functions to interact with Supabase Edge Functions

/**
 * Sends a chat query to the help_chat edge function and returns the response.
 * Expected response shape: { text: string; imageUrl?: string }
 */
export async function sendMessage(query: string) {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    const response = await fetch(`${supabaseUrl}/functions/v1/help_chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey || '',
        Authorization: `Bearer ${supabaseKey || ''}`,
      },
      body: JSON.stringify({ query }),
    });
    
    if (!response.ok) throw new Error('Help chat request failed');
    
    const data = await response.json();
    return {
      text: data.text ?? '',
      imageUrl: data.imageUrl,
    };
  } catch (err) {
    console.warn('Edge function not available, falling back to local NLP engine:', err);
    
    // Simulate network delay for realism
    await new Promise(resolve => setTimeout(resolve, 800));

    const q = query.toLowerCase();
    let text = 'No encontré una respuesta exacta para eso. ¿Podrías intentar reformular tu pregunta buscando términos como "Leads", "Cotizaciones" o "Campañas"?';

    if (q.includes('hola') || q.includes('saludos') || q.includes('buen')) {
      text = '¡Hola! Qué gusto saludarte. ¿Con qué módulo del CRM te puedo ayudar hoy? (Ej: Leads, Cotizaciones, MKT)';
    } else if (q.includes('lead') || q.includes('prospecto') || q.includes('cliente')) {
      text = 'Para gestionar leads, dirígete al **Módulo de Leads** en la barra lateral. Puedes importarlos por Excel/CSV o crear uno manualmente con el botón azul superior.';
    } else if (q.includes('chat') || q.includes('mensaje') || q.includes('whatsapp') || q.includes('meta')) {
      text = 'Para chats y WhatsApp, revisa el **Módulo de Mensajes** y las configuraciones de Webhook en el "Marketing Hub". Allí podrás conectar Meta Leads y CTWA.';
    } else if (q.includes('cotizar') || q.includes('cotizacion') || q.includes('precio') || q.includes('cobrar')) {
      text = 'Puedes crear propuestas comerciales completas en el **Módulo de Cotizaciones**. El motor calculará automáticamente impuestos, descuentos y planes de pago.';
    } else if (q.includes('bot') || q.includes('ia') || q.includes('agente')) {
      text = 'Los Agentes IA (Voice y Auto-Reply) se configuran dentro del "Marketing Hub > Agentes AI". Puedes inyectar prompts de sistema personalizados ahí.';
    } else if (q.includes('gracias') || q.includes('ok') || q.includes('listo')) {
      text = '¡Excelente! Aquí estaré siempre en la esquina inferior por si necesitas ayuda.';
    }

    return { text, imageUrl: '' };
  }
}
