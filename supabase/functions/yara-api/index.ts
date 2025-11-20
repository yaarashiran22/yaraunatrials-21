import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function generateQueryEmbedding(query: string, openAIApiKey: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: query,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI embedding error: ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, type = "all", limit = 20 } = await req.json();
    console.log("Yara API request:", { query, type, limit });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "", 
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

    const response: any = {
      query,
      timestamp: new Date().toISOString(),
      results: {},
    };

    if (query && openAIApiKey) {
      try {
        const queryEmbedding = await generateQueryEmbedding(query, openAIApiKey);
        console.log("Generated query embedding");

        if (type === "all" || type === "events") {
          const { data: matchedEvents, error: matchError } = await supabase.rpc('match_events', {
            query_embedding: queryEmbedding,
            match_threshold: 0.5,
            match_count: limit
          });

          if (!matchError && matchedEvents && matchedEvents.length > 0) {
            const eventIds = matchedEvents.map((e: any) => e.id);
            const { data: fullEvents, error: fetchError } = await supabase
              .from('events')
              .select('id, title, description, date, time, location, address, venue_name, price, price_range, image_url, video_url, external_link, ticket_link, event_type, mood, market, music_type, venue_size, target_audience, user_id, created_at, updated_at')
              .in('id', eventIds)
              .gte('date', new Date().toISOString().split('T')[0])
              .order('date', { ascending: true });
            
            if (!fetchError && fullEvents) {
              response.results.events = fullEvents;
              console.log(`Found ${fullEvents.length} events via semantic search`);
            }
          }
        }

        if (type === "all" || type === "coupons") {
          const { data: coupons } = await supabase
            .from("user_coupons")
            .select("*")
            .eq("is_active", true)
            .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
            .limit(limit);
          response.results.coupons = coupons || [];
        }

        if (type === "all" || type === "lists") {
          const { data: topLists } = await supabase
            .from("top_lists")
            .select(`*,items:top_list_items(*)`)
            .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
            .limit(limit);
          response.results.top_lists = topLists || [];
        }
      } catch (err) {
        console.error("Semantic search failed:", err);
      }
    }

    if (!response.results.events) {
      const { data: events } = await supabase
        .from("events")
        .select("id, title, description, date, time, location, address, venue_name, price, price_range, image_url, video_url, external_link, ticket_link, event_type, mood, market, music_type, venue_size, target_audience, user_id, created_at, updated_at")
        .eq("market", "argentina")
        .gte("date", new Date().toISOString().split('T')[0])
        .order("date", { ascending: true })
        .limit(limit);
      response.results.events = events || [];
    }

    if (query) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        const eventCount = response.results.events?.length || 0;
        const couponCount = response.results.coupons?.length || 0;
        const listCount = response.results.top_lists?.length || 0;
        const messagePrompt = `You are Yara. User asked: "${query}". Found ${eventCount} events, ${couponCount} coupons, and ${listCount} lists. Write a VERY brief friendly response (1-2 sentences) that ONLY says you found or didn't find results. DO NOT include any details about the actual results like names, dates, or descriptions.`;
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "user", content: messagePrompt }] }),
        });
        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          response.message = aiData.choices[0].message.content.trim();
        }
      }
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
