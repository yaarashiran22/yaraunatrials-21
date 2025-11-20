import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function generateQueryEmbedding(query: string, openAIApiKey: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAIApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
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
    const { query, type = "all", limit = 20, age, neighborhood, mood, vibe, music_type, budget, style_preference, favorite_neighborhoods, language } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

    // Parse temporal expressions into date filters
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    
    let dateFilter: string | null = null;
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes("tonight") || queryLower.includes("today")) {
      dateFilter = today;
    } else if (queryLower.includes("tomorrow")) {
      dateFilter = tomorrowStr;
    } else if (queryLower.includes("this weekend")) {
      // Find next Saturday
      const nextSaturday = new Date(now);
      const daysUntilSaturday = (6 - now.getDay() + 7) % 7;
      nextSaturday.setDate(now.getDate() + (daysUntilSaturday === 0 ? 7 : daysUntilSaturday));
      dateFilter = nextSaturday.toISOString().split("T")[0];
    }
    
    console.log(`Date filter detected: ${dateFilter} for query: ${query}`);

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
          // First, get all events that match the date filter
          let dateFilteredQuery = supabase
            .from("events")
            .select("id, title, description, date, time, location, address, venue_name, price, price_range, image_url, video_url, external_link, ticket_link, event_type, mood, market, music_type, venue_size, target_audience, user_id, created_at, updated_at, embedding");
          
          // Apply date filter
          if (dateFilter) {
            dateFilteredQuery = dateFilteredQuery.eq("date", dateFilter);
          } else {
            dateFilteredQuery = dateFilteredQuery.gte("date", new Date().toISOString().split("T")[0]);
          }
          
          const { data: dateFilteredEvents, error: dateError } = await dateFilteredQuery;
          
          if (!dateError && dateFilteredEvents && dateFilteredEvents.length > 0) {
            // Now do semantic matching only on the date-filtered events
            const dateFilteredIds = dateFilteredEvents.map(e => e.id);
            
            const { data: matchedEvents, error: matchError } = await supabase.rpc("match_events", {
              query_embedding: queryEmbedding,
              match_threshold: 0.35,
              match_count: limit * 2,
            });

            if (!matchError && matchedEvents && matchedEvents.length > 0) {
              // Filter matched events to only include those that passed the date filter
              const relevantMatches = matchedEvents.filter((e: any) => dateFilteredIds.includes(e.id));
              
              if (relevantMatches.length > 0) {
                const eventIds = relevantMatches.map((e: any) => e.id);
                let eventQuery = supabase
                  .from("events")
                  .select(
                    "id, title, description, date, time, location, address, venue_name, price, price_range, image_url, video_url, external_link, ticket_link, event_type, mood, market, music_type, venue_size, target_audience, user_id, created_at, updated_at",
                  )
                  .in("id", eventIds);

                // Apply user preference filters
                if (neighborhood) {
                  eventQuery = eventQuery.or(`location.ilike.%${neighborhood}%,address.ilike.%${neighborhood}%`);
                }
                if (favorite_neighborhoods && Array.isArray(favorite_neighborhoods) && favorite_neighborhoods.length > 0) {
                  const neighborhoodConditions = favorite_neighborhoods
                    .map((n) => `location.ilike.%${n}%,address.ilike.%${n}%`)
                    .join(",");
                  eventQuery = eventQuery.or(neighborhoodConditions);
                }
                if (mood) {
                  eventQuery = eventQuery.ilike("mood", `%${mood}%`);
                }
                if (vibe) {
                  eventQuery = eventQuery.ilike("mood", `%${vibe}%`);
                }
                if (music_type) {
                  eventQuery = eventQuery.ilike("music_type", `%${music_type}%`);
                }
                if (style_preference) {
                  eventQuery = eventQuery.ilike("mood", `%${style_preference}%`);
                }
                if (budget) {
                  if (budget.toLowerCase().includes("free")) {
                    eventQuery = eventQuery.or("price.is.null,price_range.ilike.%free%");
                  } else if (budget.toLowerCase().includes("low")) {
                    eventQuery = eventQuery.or("price.lte.1000,price_range.ilike.%$%");
                  } else if (budget.toLowerCase().includes("medium")) {
                    eventQuery = eventQuery.or("price.lte.3000,price_range.ilike.%$$%");
                  }
                }

                const { data: fullEvents, error: fetchError } = await eventQuery
                  .order("date", { ascending: true })
                  .limit(limit);

                if (!fetchError && fullEvents && fullEvents.length > 0) {
                  response.results.events = fullEvents;
                  console.log(`Found ${fullEvents.length} events via semantic search with user preferences`);
                }
              }
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

    // Fallback: keyword search with auto-generated synonyms
    if (!response.results.events || response.results.events.length === 0) {
      // Fetch synonym map from the generate-synonyms function
      const { data: synonymData } = await supabase.functions.invoke("generate-synonyms");
      const synonymMap: Record<string, string[]> = synonymData?.synonyms || {};

      console.log(`Synonym map has ${Object.keys(synonymMap).length} entries`);
      console.log(`Sample synonyms: ${JSON.stringify(Object.fromEntries(Object.entries(synonymMap).slice(0, 3)))}`);

      const keywords = query.toLowerCase().match(/\b\w{4,}\b/g) || [];
      const expandedKeywords = keywords.flatMap((kw) => synonymMap[kw] || [kw]);

      console.log(`Keyword fallback - original: ${keywords.join(",")}, expanded: ${expandedKeywords.join(",")}`);

      if (expandedKeywords.length > 0) {
        const orConditions = expandedKeywords
          .map((kw) => `title.ilike.%${kw}%,description.ilike.%${kw}%,music_type.ilike.%${kw}%,mood.ilike.%${kw}%`)
          .join(",");

        let keywordQuery = supabase
          .from("events")
          .select(
            "id, title, description, date, time, location, address, venue_name, price, price_range, image_url, video_url, external_link, ticket_link, event_type, mood, market, music_type, venue_size, target_audience, user_id, created_at, updated_at",
          )
          .or(orConditions);
        
        // Apply date filter
        if (dateFilter) {
          keywordQuery = keywordQuery.eq("date", dateFilter);
        } else {
          keywordQuery = keywordQuery.gte("date", new Date().toISOString().split("T")[0]);
        }

        // Apply user preference filters
        if (neighborhood) {
          keywordQuery = keywordQuery.or(`location.ilike.%${neighborhood}%,address.ilike.%${neighborhood}%`);
        }
        if (favorite_neighborhoods && Array.isArray(favorite_neighborhoods) && favorite_neighborhoods.length > 0) {
          const neighborhoodConditions = favorite_neighborhoods
            .map((n) => `location.ilike.%${n}%,address.ilike.%${n}%`)
            .join(",");
          keywordQuery = keywordQuery.or(neighborhoodConditions);
        }
        if (mood) {
          keywordQuery = keywordQuery.ilike("mood", `%${mood}%`);
        }
        if (vibe) {
          keywordQuery = keywordQuery.ilike("mood", `%${vibe}%`);
        }
        if (music_type) {
          keywordQuery = keywordQuery.ilike("music_type", `%${music_type}%`);
        }
        if (style_preference) {
          keywordQuery = keywordQuery.ilike("mood", `%${style_preference}%`);
        }
        if (budget) {
          if (budget.toLowerCase().includes("free")) {
            keywordQuery = keywordQuery.or("price.is.null,price_range.ilike.%free%");
          } else if (budget.toLowerCase().includes("low")) {
            keywordQuery = keywordQuery.or("price.lte.1000,price_range.ilike.%$%");
          } else if (budget.toLowerCase().includes("medium")) {
            keywordQuery = keywordQuery.or("price.lte.3000,price_range.ilike.%$$%");
          }
        }

        const { data: keywordEvents } = await keywordQuery.order("date", { ascending: true }).limit(limit);

        if (keywordEvents && keywordEvents.length > 0) {
          response.results.events = keywordEvents;
          console.log(`Found ${keywordEvents.length} events via keyword fallback with user preferences`);
        }
      }
    }

    if (!response.results.events || response.results.events.length === 0) {
      // Final fallback: just show upcoming events
      let fallbackQuery = supabase
        .from("events")
        .select(
          "id, title, description, date, time, location, address, venue_name, price, price_range, image_url, video_url, external_link, ticket_link, event_type, mood, market, music_type, venue_size, target_audience, user_id, created_at, updated_at",
        )
        .eq("market", "argentina");
      
      // Apply date filter
      if (dateFilter) {
        fallbackQuery = fallbackQuery.eq("date", dateFilter);
      } else {
        fallbackQuery = fallbackQuery.gte("date", new Date().toISOString().split("T")[0]);
      }
      
      const { data: events } = await fallbackQuery
        .order("date", { ascending: true })
        .limit(limit);
      response.results.events = events || [];
      console.log(`Fallback: showing ${events?.length || 0} upcoming events`);
    }

    // Translate results if language parameter is provided
    if (language && language !== "es") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        // Translate events
        if (response.results.events && response.results.events.length > 0) {
          const eventsToTranslate = response.results.events.map((e: any) => ({
            id: e.id,
            title: e.title,
            description: e.description,
            location: e.location,
            address: e.address,
            venue_name: e.venue_name,
          }));
          
          const translateResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [{
                role: "user",
                content: `Translate the following event data to language code "${language}". Return ONLY valid JSON array with the same structure, translating title, description, location, address, and venue_name fields: ${JSON.stringify(eventsToTranslate)}`
              }],
            }),
          });
          
          if (translateResponse.ok) {
            const translateData = await translateResponse.json();
            const translatedEvents = JSON.parse(translateData.choices[0].message.content.trim());
            response.results.events = response.results.events.map((e: any) => {
              const translated = translatedEvents.find((t: any) => t.id === e.id);
              return translated ? { ...e, ...translated } : e;
            });
          }
        }

        // Translate coupons
        if (response.results.coupons && response.results.coupons.length > 0) {
          const couponsToTranslate = response.results.coupons.map((c: any) => ({
            id: c.id,
            title: c.title,
            description: c.description,
            business_name: c.business_name,
          }));
          
          const translateResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [{
                role: "user",
                content: `Translate the following coupon data to language code "${language}". Return ONLY valid JSON array with the same structure, translating title, description, and business_name fields: ${JSON.stringify(couponsToTranslate)}`
              }],
            }),
          });
          
          if (translateResponse.ok) {
            const translateData = await translateResponse.json();
            const translatedCoupons = JSON.parse(translateData.choices[0].message.content.trim());
            response.results.coupons = response.results.coupons.map((c: any) => {
              const translated = translatedCoupons.find((t: any) => t.id === c.id);
              return translated ? { ...c, ...translated } : c;
            });
          }
        }

        // Translate top lists
        if (response.results.top_lists && response.results.top_lists.length > 0) {
          const listsToTranslate = response.results.top_lists.map((l: any) => ({
            id: l.id,
            title: l.title,
            description: l.description,
            items: l.items?.map((i: any) => ({
              id: i.id,
              name: i.name,
              description: i.description,
            })),
          }));
          
          const translateResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [{
                role: "user",
                content: `Translate the following list data to language code "${language}". Return ONLY valid JSON array with the same structure, translating title, description, and item names/descriptions: ${JSON.stringify(listsToTranslate)}`
              }],
            }),
          });
          
          if (translateResponse.ok) {
            const translateData = await translateResponse.json();
            const translatedLists = JSON.parse(translateData.choices[0].message.content.trim());
            response.results.top_lists = response.results.top_lists.map((l: any) => {
              const translated = translatedLists.find((t: any) => t.id === l.id);
              if (translated) {
                return {
                  ...l,
                  title: translated.title,
                  description: translated.description,
                  items: l.items?.map((i: any) => {
                    const translatedItem = translated.items?.find((ti: any) => ti.id === i.id);
                    return translatedItem ? { ...i, name: translatedItem.name, description: translatedItem.description } : i;
                  }),
                };
              }
              return l;
            });
          }
        }
      }
    }

    if (query) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        const eventCount = response.results.events?.length || 0;
        const couponCount = response.results.coupons?.length || 0;
        const listCount = response.results.top_lists?.length || 0;
        const languageInstruction = language && language !== "es" ? ` Respond in the language corresponding to ISO 639-1 code "${language}".` : "";
        const messagePrompt = `You are Yara. User asked: "${query}". Found ${eventCount} events, ${couponCount} coupons, and ${listCount} lists. Write a VERY brief friendly response (1-2 sentences) that ONLY says you found or didn't find results. DO NOT include any details about the actual results like names, dates, or descriptions.${languageInstruction}`;
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: messagePrompt }],
          }),
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
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
