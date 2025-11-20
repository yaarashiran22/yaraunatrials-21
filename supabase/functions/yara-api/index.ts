import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate embedding for a query using OpenAI
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

    // Use semantic search if query is provided and we have OpenAI key
    if (query && openAIApiKey) {
      try {
        // Generate embedding for the query
        const queryEmbedding = await generateQueryEmbedding(query, openAIApiKey);
        console.log("Generated query embedding");

        // Search events using semantic similarity
        if (type === "all" || type === "events") {
          const { data: matchedEvents, error: matchError } = await supabase.rpc('match_events', {
            query_embedding: queryEmbedding,
            match_threshold: 0.3,
            match_count: limit
          });

          if (matchError) {
            console.error('Error in semantic search:', matchError);
          } else if (matchedEvents && matchedEvents.length > 0) {
            // Fetch full event details
            const eventIds = matchedEvents.map((e: any) => e.id);
            const { data: fullEvents, error: fetchError } = await supabase
              .from('events')
              .select('*')
              .in('id', eventIds)
              .gte('date', new Date().toISOString().split('T')[0])
              .order('date', { ascending: true });
            
            if (!fetchError && fullEvents) {
              response.results.events = fullEvents;
              console.log(`Found ${fullEvents.length} events via semantic search`);
            }
          } else {
            console.log('No events matched via semantic search');
            response.results.events = [];
          }
        }

        // For coupons and lists, fall back to keyword search for now
        if (type === "all" || type === "coupons") {
          const { data: coupons, error: couponsError } = await supabase
            .from("user_coupons")
            .select("*")
            .eq("is_active", true)
            .or(`title.ilike.%${query}%,description.ilike.%${query}%,business_name.ilike.%${query}%`)
            .order("created_at", { ascending: false })
            .limit(limit);

          if (!couponsError) {
            response.results.coupons = coupons || [];
          }
        }

        if (type === "all" || type === "lists") {
          const { data: topLists, error: listsError } = await supabase
            .from("top_lists")
            .select(`*,items:top_list_items(*)`)
            .or(`title.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%`)
            .order("created_at", { ascending: false })
            .limit(limit);

          if (!listsError) {
            response.results.top_lists = topLists || [];
          }
        }

      } catch (embeddingError) {
        console.error("Embedding error, falling back to basic search:", embeddingError);
      }
    }
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [{ role: "user", content: sqlPrompt }],
              temperature: 0.3,
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            let filterStr = aiData.choices[0].message.content.trim();
            
            // Remove markdown code blocks if present
            filterStr = filterStr.replace(/^```json\s*/i, '').replace(/^```\s*/,'').replace(/```$/,'').trim();
            

    // Fallback: If no query or semantic search failed/no results, return recent items
    if (!query || !response.results.events || response.results.events.length === 0) {
      if (type === "all" || type === "events") {
        const { data: events, error: eventsError } = await supabase
          .from("events")
          .select("*")
          .eq("market", "argentina")
          .gte("date", new Date().toISOString().split('T')[0])
          .order("date", { ascending: true })
          .limit(limit);

        if (!eventsError) {
          response.results.events = events || [];
        }
      }

      if (!response.results.coupons && (type === "all" || type === "coupons")) {
        const { data: coupons, error: couponsError } = await supabase
          .from("user_coupons")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (!couponsError) {
          response.results.coupons = coupons || [];
        }
      }

      if (!response.results.top_lists && (type === "all" || type === "lists")) {
        const { data: topLists, error: listsError } = await supabase
          .from("top_lists")
          .select(`*,items:top_list_items(*)`)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (!listsError) {
          response.results.top_lists = topLists || [];
        }
      }
    }

    // Generate conversational message with AI
    if (query) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        try {
          const messagePrompt = `You are Yara, a friendly local guide for Buenos Aires. 

User asked: "${query}"

You found:
- ${response.results.events?.length || 0} events
- ${response.results.coupons?.length || 0} coupons
- ${response.results.top_lists?.length || 0} curated lists

Write a brief, warm response (2-3 sentences max) about what you found. Be conversational and helpful.`;

          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [{ role: "user", content: messagePrompt }],
              temperature: 0.7,
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            response.message = aiData.choices[0].message.content.trim();
          }
        } catch (aiError) {
          console.error("AI message generation failed:", aiError);
          response.message = `Found ${response.results.events?.length || 0} events for you!`;
        }
      }
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in yara-api:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
