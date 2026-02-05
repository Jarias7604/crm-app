import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

interface SearchRequest {
    query: string;
    location: string;
}

interface PlaceResult {
    place_id: string;
    name: string;
    formatted_address: string;
    formatted_phone_number?: string;
    website?: string;
    rating?: number;
    user_ratings_total?: number;
    types?: string[];
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { query, location }: SearchRequest = await req.json();

        if (!query || !location) {
            return new Response(
                JSON.stringify({ error: 'Query and location are required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Get Google API Key from environment
        const GOOGLE_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY');

        if (!GOOGLE_API_KEY) {
            console.error('GOOGLE_PLACES_API_KEY not found in env');
            // Fallback to mock data if API key is not configured
            return new Response(
                JSON.stringify({
                    results: generateMockResults(query, location),
                    source: 'mock'
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Step 1: Text Search using the NEW Places API (Multi-page support)
        const textSearchUrl = 'https://places.googleapis.com/v1/places:searchText';
        let allPlaces: any[] = [];
        let nextPageToken: string | null = null;
        let pageCount = 0;
        const maxPages = 3; // Approx 60 results (20 per page)

        do {
            const response = await fetch(textSearchUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': GOOGLE_API_KEY,
                    'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,nextPageToken'
                },
                body: JSON.stringify({
                    textQuery: `${query} in ${location}`,
                    languageCode: 'es',
                    pageToken: nextPageToken || undefined,
                    maxResultCount: 20 // Default/Max for searchText is usually 20 per request
                })
            });

            const data = await response.json();

            if (!response.ok) {
                console.error(`Google Places API Error (Page ${pageCount + 1}):`, data);
                if (allPlaces.length === 0) {
                    return new Response(
                        JSON.stringify({
                            error: 'Error searching businesses',
                            details: data.error?.message || 'Unknown error',
                            results: generateMockResults(query, location),
                            source: 'mock_fallback'
                        }),
                        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }
                break; // Return what we have so far
            }

            if (data.places) {
                allPlaces = [...allPlaces, ...data.places];
            }

            nextPageToken = data.nextPageToken;
            pageCount++;

            // Small delay between page requests if needed (Google recommendation for legacy API, 
            // usually less critical for New API but good for stability)
            if (nextPageToken && pageCount < maxPages) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }

        } while (nextPageToken && pageCount < maxPages);

        if (allPlaces.length === 0) {
            return new Response(
                JSON.stringify({ results: [], source: 'google' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Map New API results to our format
        const validResults = allPlaces.map((place: any) => ({
            id: place.id,
            business_name: place.displayName?.text || 'Sin Nombre',
            category: query,
            address: place.formattedAddress,
            phone: place.nationalPhoneNumber,
            website: place.websiteUri?.replace(/^https?:\/\//, ''),
            rating: place.rating,
            review_count: place.userRatingCount || 0,
            source: 'google_maps',
            is_imported: false
        }));

        return new Response(
            JSON.stringify({
                results: validResults,
                source: 'google',
                count: validResults.length,
                pages_fetched: pageCount
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Edge Function error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});

// Fallback mock data generator
function generateMockResults(query: string, location: string) {
    const types = ['Elite', 'Premium', 'Solutions', 'Group', 'Services', 'Associates', 'Center', 'Global'];

    return Array.from({ length: 20 }).map((_, i) => ({
        id: `mock_${Date.now()}_${i}`,
        business_name: `${capitalize(query)} ${types[i % types.length]} ${i + 1}`,
        category: query,
        address: `${Math.floor(Math.random() * 900) + 10} Main St, ${location}`,
        phone: `+503 ${Math.floor(Math.random() * 8999) + 1000}-${Math.floor(Math.random() * 8999) + 1000}`,
        website: Math.random() > 0.3 ? `www.${query.replace(/\s/g, '').toLowerCase()}${i}.com` : undefined,
        rating: 3.5 + (Math.random() * 1.5),
        review_count: Math.floor(Math.random() * 1200),
        source: 'google_maps',
        is_imported: false
    }));
}

function capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
