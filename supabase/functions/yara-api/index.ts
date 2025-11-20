import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, type = 'all', limit = 20 } = await req.json();
    
    console.log('Yara API request:', { query, type, limit });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const response: any = {
      query,
      timestamp: new Date().toISOString(),
      results: {}
    };

    // Fetch events if requested
    if (type === 'all' || type === 'events') {
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('market', 'argentina')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (eventsError) {
        console.error('Error fetching events:', eventsError);
      } else {
        // Filter future events
        const now = new Date();
        const futureEvents = events?.filter(event => {
          if (!event.date) return true;
          const eventDate = new Date(event.date);
          return eventDate >= now;
        }) || [];

        response.results.events = futureEvents;
      }
    }

    // Fetch coupons if requested
    if (type === 'all' || type === 'coupons') {
      const { data: coupons, error: couponsError } = await supabase
        .from('user_coupons')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (couponsError) {
        console.error('Error fetching coupons:', couponsError);
      } else {
        response.results.coupons = coupons || [];
      }
    }

    // Fetch top lists if requested
    if (type === 'all' || type === 'lists') {
      const { data: topLists, error: listsError } = await supabase
        .from('top_lists')
        .select(`
          *,
          items:top_list_items(*)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (listsError) {
        console.error('Error fetching top lists:', listsError);
      } else {
        response.results.top_lists = topLists || [];
      }
    }

    // If query provided, use AI to generate recommendations
    if (query) {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      
      if (LOVABLE_API_KEY) {
        const contextData = {
          events: response.results.events || [],
          coupons: response.results.coupons || [],
          top_lists: response.results.top_lists || []
        };

        const systemPrompt = `You are Yara, an AI assistant for Buenos Aires. You have access to the following data:
- ${contextData.events.length} events
- ${contextData.coupons.length} coupons/perks
- ${contextData.top_lists.length} curated lists

Based on the user's query, provide relevant recommendations in a structured format.
Always respond in JSON format with this structure:
{
  "message": "your conversational response",
  "recommendations": [
    {
      "type": "event|coupon|list",
      "id": "item_id",
      "title": "item title",
      "description": "brief description",
      "relevance": "why this is relevant to the query"
    }
  ]
}`;

        try {
          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `User query: ${query}\n\nContext: ${JSON.stringify(contextData)}` }
              ],
              temperature: 0.7,
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const aiContent = aiData.choices[0].message.content;
            
            try {
              const parsedAI = JSON.parse(aiContent);
              response.ai_response = parsedAI;
            } catch {
              response.ai_response = { message: aiContent };
            }
          }
        } catch (aiError) {
          console.error('AI error:', aiError);
          response.ai_error = 'Failed to generate AI recommendations';
        }
      }
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Yara API error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
