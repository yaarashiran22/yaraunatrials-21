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
        const sqlPrompt = `You are a SQL query generator. Transform the user's natural language query into a PostgreSQL WHERE clause for searching events, coupons, and top_lists.

Available tables and key columns:
- events: title, description, date, time, location, mood, music_type, venue_name, price_range, market='argentina'
- user_coupons: title, description, business_name, neighborhood, discount_amount, is_active=true
- top_lists: title, description, category

Rules:
1. Use ILIKE for text search with % wildcards
2. Filter events by market='argentina' and date >= current_date
3. Filter coupons by is_active=true
4. Return ONLY the WHERE clause conditions (without "WHERE")
5. For keyword searches, use OR across multiple fields (title, description, music_type, venue_name, etc.)
6. For location/neighborhood, use AND to restrict results
7. Combine keyword search (OR) with location filter (AND) when both are present

Example queries:
- "wine events" -> (market = 'argentina' AND date >= CURRENT_DATE AND (title ILIKE '%wine%' OR description ILIKE '%wine%' OR music_type ILIKE '%wine%' OR venue_name ILIKE '%wine%'))
- "wine events in palermo" -> (market = 'argentina' AND date >= CURRENT_DATE AND location ILIKE '%palermo%' AND (title ILIKE '%wine%' OR description ILIKE '%wine%' OR music_type ILIKE '%wine%' OR venue_name ILIKE '%wine%'))
- "cocktail bars in recoleta" -> (category ILIKE '%bars%' AND (title ILIKE '%cocktail%' OR description ILIKE '%cocktail%' OR neighborhood ILIKE '%recoleta%'))

User query: "${query}"
Requested type filter: ${type}

Return ONLY the WHERE clause conditions, no explanation.`;

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
            const whereClause = aiData.choices[0].message.content.trim().replace(/^WHERE\s+/i, "");

            console.log("Generated WHERE clause:", whereClause);

            // Execute smart SQL queries based on type
            if (type === "all" || type === "events") {
              try {
                const { data: smartEvents, error: eventsError } = await supabase
                  .from("events")
                  .select("*")
                  .or(whereClause)
                  .order("created_at", { ascending: false })
                  .limit(limit);

                if (!eventsError && smartEvents) {
                  const now = new Date();
                  response.results.events = smartEvents.filter((event) => {
                    if (!event.date) return true;
                    const eventDate = new Date(event.date);
                    return eventDate >= now;
                  });
                }
              } catch (e) {
                console.error("Smart events query failed:", e);
              }
            }

            if (type === "all" || type === "coupons") {
              try {
                const { data: smartCoupons, error: couponsError } = await supabase
                  .from("user_coupons")
                  .select("*")
                  .or(whereClause)
                  .eq("is_active", true)
                  .order("created_at", { ascending: false })
                  .limit(limit);

                if (!couponsError && smartCoupons) {
                  response.results.coupons = smartCoupons;
                }
              } catch (e) {
                console.error("Smart coupons query failed:", e);
              }
            }

            if (type === "all" || type === "lists") {
              try {
                const { data: smartLists, error: listsError } = await supabase
                  .from("top_lists")
                  .select(`
                    *,
                    items:top_list_items(*)
                  `)
                  .or(whereClause)
                  .order("created_at", { ascending: false })
                  .limit(limit);

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
