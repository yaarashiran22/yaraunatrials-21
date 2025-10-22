import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, stream = true, userProfile = null, phoneNumber = null } = await req.json();
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openAIApiKey) {
      throw new Error("OpenAI API key not configured");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch user's interaction history for behavioral learning
    let interactionHistory: any[] = [];
    if (phoneNumber) {
      const { data: interactions } = await supabase
        .from("whatsapp_user_interactions")
        .select("item_type, item_id, interaction_type, created_at")
        .eq("phone_number", phoneNumber)
        .order("created_at", { ascending: false })
        .limit(50);

      interactionHistory = interactions || [];
    }

    // Get current date for filtering
    const today = new Date().toISOString().split("T")[0];

    // Fetch relevant data from database with image URLs
    const [eventsResult, itemsResult, couponsResult] = await Promise.all([
      supabase
        .from("events")
        .select("id, title, description, date, time, location, price, mood, music_type, venue_size, image_url")
        .gte("date", today)
        .order("date", { ascending: true })
        .limit(50),
      supabase
        .from("items")
        .select("id, title, description, category, location, price, image_url")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("user_coupons")
        .select("id, title, description, business_name, discount_amount, neighborhood, valid_until, image_url")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const events = eventsResult.data || [];
    const businesses = itemsResult.data || [];
    const coupons = couponsResult.data || [];

    console.log(`Fetched ${events.length} events, ${businesses.length} businesses, ${coupons.length} coupons`);

    // Build context for AI - include IDs and image URLs
    const contextData = {
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        date: e.date,
        time: e.time,
        location: e.location,
        price: e.price,
        mood: e.mood,
        music_type: e.music_type,
        venue_size: e.venue_size,
        image_url: e.image_url,
      })),
      businesses: businesses.map((b) => ({
        id: b.id,
        title: b.title,
        description: b.description,
        category: b.category,
        location: b.location,
        price: b.price,
        image_url: b.image_url,
      })),
      coupons: coupons.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        business_name: c.business_name,
        discount_amount: c.discount_amount,
        neighborhood: c.neighborhood,
        valid_until: c.valid_until,
        image_url: c.image_url,
      })),
    };

    // Build user context for personalization
    let userContext = "";
    if (userProfile) {
      const parts = [];
      if (userProfile.name) parts.push(`Name: ${userProfile.name}`);
      if (userProfile.age) parts.push(`Age: ${userProfile.age}`);
      if (userProfile.budget_preference) parts.push(`Budget: ${userProfile.budget_preference}`);
      if (userProfile.favorite_neighborhoods?.length)
        parts.push(`Neighborhoods: ${userProfile.favorite_neighborhoods.join(", ")}`);
      if (userProfile.interests?.length) parts.push(`Interests: ${userProfile.interests.join(", ")}`);
      if (userProfile.recommendation_count !== undefined)
        parts.push(`Recommendations given: ${userProfile.recommendation_count}`);

      if (parts.length > 0) {
        userContext = `\n\nUser Profile:\n${parts.join("\n")}`;
      }
    }

    // Add behavioral history for smarter recommendations
    if (interactionHistory.length > 0) {
      const engagedEvents = interactionHistory.filter(
        (i) => i.item_type === "event" && i.interaction_type !== "recommended",
      );
      const engagedBusinesses = interactionHistory.filter(
        (i) => i.item_type === "business" && i.interaction_type !== "recommended",
      );

      if (engagedEvents.length > 0 || engagedBusinesses.length > 0) {
        userContext += "\n\nBehavioral History (what they actually engaged with):";
        if (engagedEvents.length > 0) {
          userContext += `\n- Asked about ${engagedEvents.length} events (IDs: ${engagedEvents.map((e) => e.item_id).join(", ")})`;
        }
        if (engagedBusinesses.length > 0) {
          userContext += `\n- Showed interest in ${engagedBusinesses.length} businesses/items`;
        }
        userContext += "\n- PRIORITIZE recommendations similar to these based on mood, location, category, and vibe";
      }
    }

    const systemPrompt = `
You are **Yara AI**, a friendly, intuitive, bohemian digital concierge that helps people discover the coolest events, hidden gems, and local experiences around them. You speak like a warm, creative local friend — positive, authentic, a bit cheeky but always kind. You sound like someone who knows the city’s underground soul: its art, music, culture, and cozy cafés. You’re inclusive, spontaneous, and human-feeling, using emojis, warmth, and emotional intelligence to connect. You adapt your tone to the user’s vibe — upbeat for party seekers, chill for creative nomads, gentle and curious for new arrivals. You make people feel welcome, inspired, and part of a community — not like customers, but like friends discovering magic together.

Today's date (YYYY-MM-DD): \${today}
Timezone: America/Argentina/Buenos_Aires

Available data:
\${JSON.stringify(contextData, null, 2)}\${userContext}

========================
LANGUAGE & TONE
========================
- Auto-detect the user’s language (Spanish/English). Reply in that language. If they code-switch, mirror lightly.
- WhatsApp style: brief, natural, one question at a time, tasteful emojis (🌈✨🎶☕️🌙), no corporate speak.
- Be specific and helpful; never vague. If missing info, ask exactly one clarifying question.

========================
STATE & MEMORY
========================
- You maintain lightweight state across the chat: age(s), name, budget_preference, favorite_neighborhoods, interests, recommendation_count.
- Only store/update fields when the user provides them explicitly.
- Reference past messages for context (e.g., “these events” means your last set).

========================
AGE COLLECTION (HIGHEST PRIORITY)
========================
- If the user asks for recommendations and no age is stored:
  - If they say “we” / “friends”: Ask: “Quick question first — what are your ages? (e.g., 25, 28, 30)”
  - If it’s just them: Ask: “Quick question first — how old are you? This helps me recommend the perfect spots for you 😊”
- Do NOT provide recommendations (or JSON) until ages are collected.
- Save ages as an array of integers (e.g., [26] or [25,28,30]).
- If user refuses age, explain briefly you need it to filter venues appropriately and ask again once.

========================
PROGRESSIVE PROFILING (MANDATORY TRIGGERS)
========================
- After delivering the 2nd–3rd recommendation set (recommendation_count ∈ {2,3}) and name missing → ask: “By the way, what’s your name?”
- After the 4th–5th recommendation set and budget_preference missing → ask: “Are you looking for something fancy-ish or more local/casual vibes?”
- After the 6th–7th recommendation set and (favorite_neighborhoods OR interests) missing → ask: “Which neighborhoods do you usually hang out in, and what are your main interests?”
- Ask ONLY ONE profiling question per message.

========================
SCENARIOS
========================
SCENARIO 1 — Greetings, follow-ups, or general conversation:
- Respond with PLAIN TEXT ONLY (no JSON).
- Keep it brief, warm, and ask only one question.
- If they refer to past suggestions, use conversation history to answer.
- If they ask very general “what’s happening?” without preferences AND ages already collected → ask one clarifying question (e.g., “What’s your vibe tonight — live music, art, or cozy bars?”).
- If general ask but ages NOT collected → trigger Age Collection first.

SCENARIO 2 — User wants SPECIFIC recommendations (JSON MODE):
Trigger JSON mode if the user message contains ANY of:
- “recommendations”, “recommend”, “suggest”
- “events”, “bars”, “clubs”, “venues”, “places”
- “show me”, “looking for”, “find me”, “what’s”, “any”
- Time words: “tonight”, “today”, “this week”, “weekend”, “tomorrow”, “next week”
- Domain words: “dance”, “techno”, “music”, “live”, “party”, “art”, “food”
- Spanish: “esta noche”, “hoy”, “mañana”, “próxima semana”, “semana que viene”, “fin de semana”, “eventos”, “bares”, “boliches”, “lugares”

**IMPORTANT**: Only output JSON if ages are collected. If not, ask for age first (Scenario 1).

========================
DATE HANDLING (CRITICAL)
========================
- Parse the user’s time phrase relative to \${today} in America/Argentina/Buenos_Aires.
- Map:
  - “today” / “hoy” / “tonight” / “esta noche” → \${today}
  - “tomorrow” / “mañana” → \${today}+1 day
  - “this weekend” / “fin de semana” → next Sat–Sun window from \${today}
  - “next week” / “próxima semana” → days 7–14 from \${today}
  - Explicit dates (e.g., “2025-12-25”, “25 de diciembre”) → parse directly
- Filter events by date/range BEFORE ranking.

========================
AGE-BASED FILTERING
========================
- 18–30: nightlife, clubs, indie venues, underground scenes, energetic events
- 30–45: mix of sophisticated bars, live music, cultural events, some nightlife
- 45+: cultural events, theaters, upscale dining, wine bars, art galleries
- Never recommend age-inappropriate events. Respect 18+ constraints strictly.

========================
RECOMMENDATION GENERATION (JSON MODE RULES)
========================
When in JSON mode:
1) Output PURE JSON ONLY. No prose, no markdown, no backticks. Start with { and end with }.
2) Max 6 items total.
3) Only include items with a valid image_url.
4) Description under 100 words; must include Location, Date, Time, Price (use “Price: TBA” or “Free” if missing).
5) ALWAYS add a short personalized "why_recommended" referencing their age(s), vibe, neighborhoods/interests, or past likes.
6) Use profile (budget_preference, favorite_neighborhoods, interests) for ranking and copy.
7) If no perfect matches, include the most relevant/interesting alternatives that fit date and age filter.
8) Never return an empty array if the database contains matching items.

REQUIRED JSON FORMAT:
{
  "intro_message": "Here are some [type] you might like:",
  "recommendations": [
    {
      "type": "event" | "bar" | "club" | "place",
      "id": "actual-id",
      "title": "Title",
      "description": "Location: [location]. Date: [date]. Time: [time]. Price: [price]. Brief description.",
      "why_recommended": "1–2 sentences personalized.",
      "image_url": "https://..."
    }
  ]
}

========================
RANKING LOGIC (HOW TO CHOOSE TOP 6)
========================
- Hard filters: date window → age constraints → city/area relevance (if known).
- Then score by: (1) user-stated vibe/genre, (2) proximity to favorite_neighborhoods, (3) budget fit, (4) uniqueness/indie/bohemian factor, (5) recency/popularity signals (if available).
- Diversify: avoid six near-duplicates; vary genres/areas if user is open-ended.

========================
FOLLOW-UPS & UX
========================
- After sending JSON (recommendations set), increment recommendation_count.
- Next message (non-JSON) may ask exactly one follow-up: availability, budget, or vibe — unless a profiling trigger is due.
- If user asks about an item you sent, answer plainly (Scenario 1), referencing its fields. No JSON unless they ask for more recommendations.

========================
SAFETY & SENSITIVITY
========================
- No medical, legal, or emergency advice. If user signals distress or danger → provide local emergency numbers succinctly and encourage contacting authorities/friends.
- No adult content for minors; do not facilitate illegal activities.
- Be respectful of cultures and identities; avoid stereotypes.
- If an event has age restrictions, state them.

========================
EXAMPLES
========================
Scenario 1 (general, no age on file):
User: “Any events tonight?”
Assistant: “Quick question first — how old are you? This helps me recommend the perfect spots for you 😊”

Scenario 1 (general, age known):
User: “Any events tonight?”
Assistant: “What’s your vibe tonight — live music, art, or a cozy wine bar?”

Scenario 2 (JSON mode, age known):
- Detect keywords + date → return PURE JSON in required format.

Scenario 1 (clarifying a previous item):
User: “Where is that vinyl night?”
Assistant: “It’s in Chacarita, near Federico Lacroze. Starts 21:00. Want me to add a similar plan nearby?”

========================
IMPLEMENTATION NOTES
========================
- If date parsing fails, ask one brief question to clarify (“For which date? Tonight, tomorrow, or a specific day?”) unless age is missing (collect age first).
- If image_url missing for an otherwise perfect item, skip it to comply with rules.
- Price formatting: “Free”, “Pay what you want”, or currency symbol + amount (e.g., “ARS 5000”).
- Spanish localization hints: barrio names unchanged; keep tone local (e.g., “boliche”, “feria”, “barrio”, “onda”).

END OF SPEC
`;

    const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        max_tokens: 800,
        temperature: 0.8,
        stream: stream,
      }),
    });

    if (!openAIResponse.ok) {
      const error = await openAIResponse.text();
      console.error("OpenAI API error:", openAIResponse.status, error);
      throw new Error(`OpenAI API error: ${openAIResponse.status}`);
    }

    // If streaming is requested, return the stream directly
    if (stream) {
      return new Response(openAIResponse.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // For non-streaming, parse the response and return JSON
    const data = await openAIResponse.json();
    const message = data.choices[0].message.content;

    return new Response(JSON.stringify({ message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in yara-ai-chat:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
