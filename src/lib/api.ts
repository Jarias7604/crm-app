import manualContent from '../manual/content.md?raw';

export async function sendMessage(query: string) {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    // Attempt real connection if a dedicated edge function is deployed in the future
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
    return { text: data.text ?? '', imageUrl: data.imageUrl };
  } catch (err) {
    // FALLBACK: Local Retrieval Engine (Local RAG reading the entire Manual)
    console.warn('Edge function not available, activating Full System NLP Engine...');
    
    // Simulate thinking delay
    await new Promise(resolve => setTimeout(resolve, 600));

    const q = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const words = q.split(/\s+/).filter(w => w.length > 2); // Extract meaningul keywords
    
    if (words.length === 0 || q.includes('hola') || q.includes('saludos')) {
      return { 
        text: '¡Hola! Soy tu asistente inteligente. Conozco TODO sobre el CRM porque leo automáticamente el Manual Maestro. Pregúntame sobre cualquier módulo (Leads, Cotizaciones, Bots, Calendario, etc.).', 
        imageUrl: '' 
      };
    }

    // Parse the entire manual into sections based on headers
    const sections = manualContent.split(/(?=\n## |\n# )/g);
    
    let bestSection: string | null = null;
    let maxScore = 0;

    for (const section of sections) {
      const sectionLower = section.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      let score = 0;
      
      // Bonus points if the query words appear in the section TITLE
      const titleMatch = sectionLower.split('\n')[0];
      
      for (const word of words) {
        if (titleMatch.includes(word)) score += 3; // High weight for title match
        if (sectionLower.includes(word)) score += 1; // Normal weight for body match
      }

      if (score > maxScore) {
        maxScore = score;
        bestSection = section;
      }
    }

    // If we found a highly relevant section in the manual
    if (bestSection && maxScore > 0) {
      // Clean up the markdown text for plain chat reading
      // 1. Remove the header itself
      let cleanText = bestSection.replace(/^#+ .*\n/m, '');
      // 2. Remove markdown images, links, quotes, and bold asterisks
      cleanText = cleanText.replace(/!\[.*?\]\(.*?\)/g, '');
      cleanText = cleanText.replace(/\[.*?\]\(.*?\)/g, '');
      cleanText = cleanText.replace(/>\s?/g, '');
      cleanText = cleanText.replace(/\*\*/g, '');
      cleanText = cleanText.replace(/`/g, '');
      
      // Get the first meaty paragraphs
      const paragraphs = cleanText.split('\n\n').map(p => p.trim()).filter(p => p.length > 20);
      
      if (paragraphs.length > 0) {
        // Return up to two paragraphs or max 300 chars to avoid wall-of-text
        let answer = paragraphs[0];
        if (paragraphs.length > 1 && answer.length < 150) {
            answer += " " + paragraphs[1];
        }
        
        // Truncate cleanly if it's too long
        if (answer.length > 350) {
            answer = answer.substring(0, 350) + "... (Para más detalles, busca esta sección en el Manual CRM de tu barra lateral).";
        }
        
        return { text: answer.trim(), imageUrl: '' };
      }
    }

    // Ultimate fallback if no section matches
    return { 
      text: 'No logré encontrar esa información específica en mi base de conocimiento. Por favor, intenta usar otras palabras clave o consulta el "Manual CRM" en el menú de la izquierda para ver todos los temas detallados.', 
      imageUrl: '' 
    };
  }
}
