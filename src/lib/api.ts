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
    if (!response.ok) {
      throw new Error('Help chat request failed');
    }
    const data = await response.json();
    return {
      text: data.text ?? '',
      imageUrl: data.imageUrl,
    };
  } catch (err) {
    console.error('sendMessage error:', err);
    return { text: 'Error contacting help service.', imageUrl: '' };
  }
}
