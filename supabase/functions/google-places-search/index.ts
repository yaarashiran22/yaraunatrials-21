import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlaceResult {
  name: string;
  address: string;
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number;
  openNow?: boolean;
  types?: string[];
  placeId: string;
  location?: {
    lat: number;
    lng: number;
  };
  photoUrl?: string;
  googleMapsUrl?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('google-places-search: Request received');

  try {
    const body = await req.json();
    const { query, location = 'Buenos Aires, Argentina', type, language = 'en' } = body;
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: 'query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      console.error('google-places-search: GOOGLE_PLACES_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Google Places API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`google-places-search: Searching for "${query}" in ${location}`);

    // Use Text Search API for more flexible searches
    const searchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    searchUrl.searchParams.set('query', `${query} in ${location}`);
    searchUrl.searchParams.set('key', apiKey);
    searchUrl.searchParams.set('language', language);
    
    if (type) {
      searchUrl.searchParams.set('type', type);
    }

    const response = await fetch(searchUrl.toString());
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('google-places-search: API error:', data.status, data.error_message);
      return new Response(
        JSON.stringify({ error: `Google Places API error: ${data.status}`, details: data.error_message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (data.status === 'ZERO_RESULTS' || !data.results?.length) {
      console.log('google-places-search: No results found');
      return new Response(
        JSON.stringify({ results: [], message: 'No places found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transform results
    const results: PlaceResult[] = data.results.slice(0, 5).map((place: any) => {
      const result: PlaceResult = {
        name: place.name,
        address: place.formatted_address,
        rating: place.rating,
        userRatingsTotal: place.user_ratings_total,
        priceLevel: place.price_level,
        openNow: place.opening_hours?.open_now,
        types: place.types,
        placeId: place.place_id,
        location: place.geometry?.location ? {
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng
        } : undefined,
        googleMapsUrl: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
      };

      // Generate photo URL if available
      if (place.photos?.[0]?.photo_reference) {
        result.photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${apiKey}`;
      }

      return result;
    });

    console.log(`google-places-search: Found ${results.length} results`);

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('google-places-search: Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
