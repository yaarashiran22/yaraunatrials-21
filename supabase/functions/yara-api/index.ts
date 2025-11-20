import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, type = "all", limit = 20 } = await req.json();

    console.log("Yara API request:", { query, type, limit });

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const response: any = {
      query,
      timestamp: new Date().toISOString(),
      results: {},
    };

    // Fetch events if requested
    if (type === "all" || type === "events") {
      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select("*")
        .eq("market", "argentina")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (eventsError) {
        console.error("Error fetching events:", eventsError);
      } else {
        // Filter future events
        const now = new Date();
        const futureEvents =
          events?.filter((event) => {
            if (!event.date) return true;
            const eventDate = new Date(event.date);
            return eventDate >= now;
          }) || [];

        response.results.events = futureEvents;
      }
    }

    // Fetch coupons if requested
    if (type === "all" || type === "coupons") {
      const { data: coupons, error: couponsError } = await supabase
        .from("user_coupons")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (couponsError) {
        console.error("Error fetching coupons:", couponsError);
      } else {
        response.results.coupons = coupons || [];
      }
    }

    // Fetch top lists if requested
    if (type === "all" || type === "lists") {
      const { data: topLists, error: listsError } = await supabase
        .from("top_lists")
        .select(
          `
          *,
          items:top_list_items(*)
        `,
        )
        .order("created_at", { ascending: false })
        .limit(limit);

      if (listsError) {
        console.error("Error fetching top lists:", listsError);
      } else {
        response.results.top_lists = topLists || [];
      }
    }

    // If query provided, use AI to transform it to SQL and execute
    if (query) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

      if (LOVABLE_API_KEY) {
        const sqlPrompt = `You are a PostgREST filter generator. Transform the user's natural language query into a structured filter object.

Available tables and key columns:
- events: title, description, date, time, location, mood, music_type, venue_name, price_range, market='argentina'
- user_coupons: title, description, business_name, neighborhood, discount_amount, is_active=true
- top_lists: title, description, category

Return a JSON object with these fields:
{
  "keywords": ["word1", "word2"],  // Main search terms (e.g., ["wine"])
  "location": "location_name",      // If location mentioned (e.g., "palermo")
  "category": "category_name"      // If category mentioned for lists
}

Examples:
- "wine events" -> {"keywords": ["wine"], "location": null, "category": null}
- "wine events in palermo" -> {"keywords": ["wine"], "location": "palermo", "category": null}
- "cocktail bars in recoleta" -> {"keywords": ["cocktail"], "location": "recoleta", "category": "bars"}

User query: "${query}"

Return ONLY valid JSON, no explanation.`;

        try {
          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            
            let filters;
            try {
              filters = JSON.parse(filterStr);
              console.log("Generated filters:", filters);
            } catch (parseError) {
              console.error("Failed to parse filter JSON:", parseError);
              filters = { keywords: [], location: null, category: null };
            }

            // Execute smart queries based on type
            if (type === "all" || type === "events") {
              try {
                let query = supabase
                  .from("events")
                  .select("*")
                  .eq("market", "argentina")
                  .gte("date", new Date().toISOString().split('T')[0]);

                // Add location filter if specified
                if (filters.location) {
                  query = query.ilike("location", `%${filters.location}%`);
                }

                // Add keyword filters - must match at least one field
                if (filters.keywords && filters.keywords.length > 0) {
                  const keyword = filters.keywords[0];
                  query = query.or(
                    `title.ilike.%${keyword}%,description.ilike.%${keyword}%,music_type.ilike.%${keyword}%,venue_name.ilike.%${keyword}%,mood.ilike.%${keyword}%`
                  );
                }

                query = query.order("created_at", { ascending: false }).limit(limit);

                const { data: smartEvents, error: eventsError } = await query;

                if (!eventsError && smartEvents) {
                  response.results.events = smartEvents;
                }
              } catch (e) {
                console.error("Smart events query failed:", e);
              }
            }

            if (type === "all" || type === "coupons") {
              try {
                let query = supabase
                  .from("user_coupons")
                  .select("*")
                  .eq("is_active", true);

                if (filters.location) {
                  query = query.ilike("neighborhood", `%${filters.location}%`);
                }

                if (filters.keywords && filters.keywords.length > 0) {
                  const keyword = filters.keywords[0];
                  query = query.or(
                    `title.ilike.%${keyword}%,description.ilike.%${keyword}%,business_name.ilike.%${keyword}%`
                  );
                }

                query = query.order("created_at", { ascending: false }).limit(limit);

                const { data: smartCoupons, error: couponsError } = await query;

                if (!couponsError && smartCoupons) {
                  response.results.coupons = smartCoupons;
                }
              } catch (e) {
                console.error("Smart coupons query failed:", e);
              }
            }

            if (type === "all" || type === "lists") {
              try {
                let query = supabase
                  .from("top_lists")
                  .select(`
                    *,
                    items:top_list_items(*)
                  `);

                if (filters.category) {
                  query = query.ilike("category", `%${filters.category}%`);
                }

                if (filters.keywords && filters.keywords.length > 0) {
                  const keyword = filters.keywords[0];
                  query = query.or(
                    `title.ilike.%${keyword}%,description.ilike.%${keyword}%`
                  );
                }

                query = query.order("created_at", { ascending: false }).limit(limit);

                const { data: smartLists, error: listsError } = await query;

                if (!listsError && smartLists) {
                  response.results.top_lists = smartLists;
                }
              } catch (e) {
                console.error("Smart lists query failed:", e);
              }
            }

            // Generate conversational message
            const messageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  {
                    role: "user",
                    content: `Generate a brief, friendly response for this query: "${query}". Found ${response.results.events?.length || 0} events, ${response.results.coupons?.length || 0} coupons, ${response.results.top_lists?.length || 0} lists. Keep it under 50 words.`,
                  },
                ],
                temperature: 0.7,
              }),
            });

            if (messageResponse.ok) {
              const messageData = await messageResponse.json();
              response.message = messageData.choices[0].message.content;
            }
          }
        } catch (aiError) {
          console.error("AI SQL transformation error:", aiError);
          response.ai_error = "Failed to transform query to SQL";
        }
      }
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Yara API error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
