import { supabase } from '../supabase';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const IGNORED_PATTERNS = [
    'sentry', 'wixpress', 'schema.org', 'wordpress.org', 'example.com',
    'sentry-cdn', 'polyfill', 'github', 'facebook', 'twitter',
    'instagram', 'youtube', 'google', 'domain.com', 'email.com',
    '.png', '.jpg', '.jpeg', '.svg', '.webp', '.js', '.css', '.gif',
    'w3.org', 'format', 'type', 'node_modules', 'react', 'chunk', 'min'
];

/**
 * Scrapes a single website URL for published email addresses
 */
export async function scrapeWebsiteEmail(websiteUrl: string): Promise<string | null> {
    if (!websiteUrl) return null;

    // Primary: Call server-side Edge Function (bypasses CORS, crawls subpages /contact, /contacto, /about)
    try {
        const { data, error } = await supabase.functions.invoke('scrape-website-email', {
            body: { websiteUrl }
        });

        if (!error && data && data.email) {
            return data.email;
        }
    } catch {
        // Fallback to client proxy if edge function invocation fails
    }

    try {
        let cleanUrl = websiteUrl.trim();
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
            cleanUrl = `https://${cleanUrl}`;
        }

        // Try CORS proxies to bypass client-side CORS restrictions
        const proxyUrls = [
            `https://api.allorigins.win/raw?url=${encodeURIComponent(cleanUrl)}`,
            `https://corsproxy.io/?${encodeURIComponent(cleanUrl)}`
        ];

        let htmlText = '';

        for (const proxy of proxyUrls) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 7000); // 7s timeout

                const response = await fetch(proxy, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (response.ok) {
                    htmlText = await response.text();
                    if (htmlText && htmlText.length > 100) break;
                }
            } catch (err) {
                // Ignore proxy error and try next
            }
        }

        if (!htmlText) return null;

        // Find all matches in HTML body
        const matches = htmlText.match(EMAIL_REGEX);
        if (!matches || matches.length === 0) return null;

        // Clean & filter valid human emails
        const validEmails = Array.from(new Set(matches.map(m => m.toLowerCase()))).filter(email => {
            // Must contain @ and valid domain structure
            const isIgnored = IGNORED_PATTERNS.some(pat => email.includes(pat));
            const parts = email.split('.');
            const tld = parts[parts.length - 1] || '';
            return !isIgnored && tld.length >= 2 && tld.length <= 8;
        });

        if (validEmails.length === 0) return null;

        // Prioritize common business prefixes: info@, contacto@, ventas@, etc.
        const priorityEmail = validEmails.find(e =>
            e.startsWith('info@') ||
            e.startsWith('contacto@') ||
            e.startsWith('ventas@') ||
            e.startsWith('hola@') ||
            e.startsWith('admin@') ||
            e.startsWith('soporte@')
        );

        return priorityEmail || validEmails[0];
    } catch (error) {
        console.error(`[WebEmailScraper] Failed to scrape ${websiteUrl}:`, error);
        return null;
    }
}

/**
 * Scrapes emails for a list of leads in controlled parallel batches
 */
export async function batchScrapeLeadEmails(
    leads: { id: string; website?: string | null; email?: string | null }[],
    onProgress?: (leadId: string, foundEmail: string) => void
): Promise<{ scannedCount: number; foundCount: number }> {
    const leadsToScrape = leads.filter(l => l.website && !l.email);
    if (leadsToScrape.length === 0) return { scannedCount: 0, foundCount: 0 };

    let foundCount = 0;
    const batchSize = 3;

    for (let i = 0; i < leadsToScrape.length; i += batchSize) {
        const chunk = leadsToScrape.slice(i, i + batchSize);
        await Promise.all(
            chunk.map(async lead => {
                if (!lead.website) return;
                const email = await scrapeWebsiteEmail(lead.website);
                if (email) {
                    foundCount++;
                    if (onProgress) onProgress(lead.id, email);
                }
            })
        );
    }

    return { scannedCount: leadsToScrape.length, foundCount };
}
