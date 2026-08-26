import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const IGNORED_PATTERNS = [
    'sentry', 'wixpress', 'schema.org', 'wordpress.org', 'example.com',
    'sentry-cdn', 'polyfill', 'github', 'facebook', 'twitter',
    'instagram', 'youtube', 'google', 'domain.com', 'email.com',
    '.png', '.jpg', '.jpeg', '.svg', '.webp', '.js', '.css', '.gif',
    'w3.org', 'format', 'type', 'node_modules', 'react', 'chunk', 'min'
];

async function fetchHtml(targetUrl: string): Promise<string | null> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(targetUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
            }
        });

        clearTimeout(timeoutId);
        if (res.ok) {
            return await res.text();
        }
    } catch {
        // Suppress fetch error
    }
    return null;
}

function extractEmailsFromHtml(html: string): string[] {
    const matches = html.match(EMAIL_REGEX);
    if (!matches) return [];

    const valid = Array.from(new Set(matches.map(m => m.toLowerCase()))).filter(email => {
        const isIgnored = IGNORED_PATTERNS.some(pat => email.includes(pat));
        const parts = email.split('.');
        const tld = parts[parts.length - 1] || '';
        return !isIgnored && tld.length >= 2 && tld.length <= 8;
    });

    return valid;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { websiteUrl } = await req.json();

        if (!websiteUrl) {
            return new Response(
                JSON.stringify({ error: 'websiteUrl es requerido' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        let cleanUrl = websiteUrl.trim();
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
            cleanUrl = `https://${cleanUrl}`;
        }

        // 1. Fetch homepage
        let html = await fetchHtml(cleanUrl);
        let foundEmails: string[] = [];

        if (html) {
            foundEmails = extractEmailsFromHtml(html);
        } else if (cleanUrl.startsWith('https://')) {
            // Fallback to http if https fails
            cleanUrl = cleanUrl.replace('https://', 'http://');
            html = await fetchHtml(cleanUrl);
            if (html) foundEmails = extractEmailsFromHtml(html);
        }

        // 2. If no emails on homepage, try common contact subpages
        if (foundEmails.length === 0 && cleanUrl) {
            const subpages = ['/contact', '/contacto', '/contact-us', '/about', '/about-us', '/nosotros'];
            const baseUrl = cleanUrl.replace(/\/$/, '');

            for (const sub of subpages) {
                const subHtml = await fetchHtml(`${baseUrl}${sub}`);
                if (subHtml) {
                    const subEmails = extractEmailsFromHtml(subHtml);
                    if (subEmails.length > 0) {
                        foundEmails = subEmails;
                        break;
                    }
                }
            }
        }

        if (foundEmails.length === 0) {
            return new Response(
                JSON.stringify({ email: null, emails: [], source: 'web_scraper' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Prioritize common business prefixes
        const priorityEmail = foundEmails.find(e =>
            e.startsWith('info@') ||
            e.startsWith('contacto@') ||
            e.startsWith('ventas@') ||
            e.startsWith('hola@') ||
            e.startsWith('admin@') ||
            e.startsWith('pastor@') ||
            e.startsWith('office@') ||
            e.startsWith('contact@')
        );

        const bestEmail = priorityEmail || foundEmails[0];

        return new Response(
            JSON.stringify({
                email: bestEmail,
                emails: foundEmails,
                source: 'web_scraper'
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
