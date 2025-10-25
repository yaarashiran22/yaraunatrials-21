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

    // Helper function to format date from YYYY-MM-DD to "Month DDth"
    const formatDate = (dateStr: string): string => {
      if (!dateStr) return dateStr;

      // Handle recurring events (e.g., "every monday", "every friday")
      if (dateStr.toLowerCase().includes("every")) {
        return dateStr; // Return as-is for recurring events
      }

      try {
        const date = new Date(dateStr + "T00:00:00");
        const months = [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ];
        const day = date.getDate();
        const month = months[date.getMonth()];

        // Add ordinal suffix (st, nd, rd, th)
        let suffix = "th";
        if (day === 1 || day === 21 || day === 31) suffix = "st";
        else if (day === 2 || day === 22) suffix = "nd";
        else if (day === 3 || day === 23) suffix = "rd";

        return `${month} ${day}${suffix}`;
      } catch (e) {
        console.log("Failed to format date:", dateStr, e);
        return dateStr; // Return original if parsing fails
      }
    };

    // Fetch relevant data from database with image URLs
    // Include recurring events by checking if date contains "every" OR is >= today
    const [eventsResult, itemsResult, couponsResult] = await Promise.all([
      supabase
        .from("events")
        .select(
          "id, title, description, date, time, location, address, price, mood, music_type, venue_size, external_link, image_url",
        )
        .or(`date.gte.${today},date.ilike.%every%`)
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

    // Build context for AI - include IDs and image URLs with formatted dates
    const contextData = {
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        date: formatDate(e.date), // Format date here before sending to AI
        time: e.time,
        location: e.location,
        address: e.address,
        price: e.price,
        mood: e.mood,
        music_type: e.music_type,
        venue_size: e.venue_size,
        external_link: e.external_link,
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

    // Build user context - we'll inject this directly into the conversation
    let userProfileInfo: string[] = [];
    let userContext = "";
    let missingFields: string[] = [];

    if (userProfile) {
      const parts = [];

      // Track what we know about the user for context display
      if (userProfile.name) {
        parts.push(`Name: ${userProfile.name}`);
        userProfileInfo.push(`my name is ${userProfile.name}`);
      } else {
        missingFields.push("name");
      }

      if (userProfile.age) {
        parts.push(`Age: ${userProfile.age}`);
        userProfileInfo.push(`I'm ${userProfile.age} years old`);
      } else {
        missingFields.push("age");
      }

      if (userProfile.email) {
        parts.push(`Email: ${userProfile.email}`);
        userProfileInfo.push(`my email is ${userProfile.email}`);
      } else {
        missingFields.push("email");
      }

      if (userProfile.budget_preference) {
        parts.push(`Budget: ${userProfile.budget_preference}`);
        userProfileInfo.push(`my budget preference is ${userProfile.budget_preference}`);
      } else {
        missingFields.push("budget_preference");
      }

      if (userProfile.favorite_neighborhoods?.length) {
        parts.push(`Neighborhoods: ${userProfile.favorite_neighborhoods.join(", ")}`);
        userProfileInfo.push(`my favorite neighborhoods are ${userProfile.favorite_neighborhoods.join(", ")}`);
      } else {
        missingFields.push("favorite_neighborhoods");
      }

      if (userProfile.interests?.length) {
        parts.push(`Interests: ${userProfile.interests.join(", ")}`);
        userProfileInfo.push(`my interests are ${userProfile.interests.join(", ")}`);
      } else {
        missingFields.push("interests");
      }

      if (userProfile.recommendation_count !== undefined) {
        parts.push(`Recommendations given: ${userProfile.recommendation_count}`);
        userProfileInfo.push(`you've given me ${userProfile.recommendation_count} recommendations so far`);
      }

      if (parts.length > 0) {
        userContext = `\n\nUser Profile Context:\n${parts.join("\n")}`;
        console.log("User Profile Context:", userContext);
      }

      if (missingFields.length > 0) {
        userContext += `\n\nMissing Fields: ${missingFields.join(", ")}`;
        console.log("Missing Fields:", missingFields.join(", "));
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

    // Inject user profile into the first user message to ensure AI sees it
    const enrichedMessages = [...messages];
    
    // If this is the first user message and we have profile info, prepend it
    if (userProfileInfo.length > 0 && enrichedMessages.length > 0) {
      const firstUserMsgIndex = enrichedMessages.findIndex(m => m.role === 'user');
      if (firstUserMsgIndex !== -1) {
        const profilePrefix = `(By the way, ${userProfileInfo.join(", ")}.) `;
        enrichedMessages[firstUserMsgIndex] = {
          ...enrichedMessages[firstUserMsgIndex],
          content: profilePrefix + enrichedMessages[firstUserMsgIndex].content
        };
      }
    }

    const systemPrompt = `You are Yara, a friendly AI assistant for Buenos Aires events and experiences.

**CRITICAL INSTRUCTION - READ THIS FIRST:**
When users ask for recommendations (parties, events, bars, workshops, etc.), you MUST respond with ONLY a JSON object. NO conversational text. NO markdown. JUST JSON starting with { and ending with }.

Example WRONG responses:
❌ "Here are some parties you might like: 1. Event Name..."
❌ "Yes! Here are some recommendations..."
❌ Any text before or after JSON

Example CORRECT response:
✅ {"intro_message":"Here are some parties!","recommendations":[...]}

Today's date is: ${today}
${userContext}

Available data:
${JSON.stringify(contextData, null, 2)}

CRITICAL RESPONSE FORMAT - YOU MUST FOLLOW THIS EXACTLY:

SCENARIO 1 - User greeting, asking follow-up questions, or general conversation:
Respond with PLAIN TEXT ONLY. Be warm and conversational.
- If user asks about age ranges, demographics, or details about previously recommended events, answer based on the event data
- If user asks clarifying questions about recommendations you already gave, refer to the conversation history and provide helpful answers
- Be contextually aware - if they're asking about "these events" or "the recommendations", they're referring to what you previously suggested
- **IMPORTANT**: Keep responses brief and ask ONLY ONE question at a time
- If user asks VERY GENERAL questions about things to do in the city (like "what's happening?", "what should I do?", "any events tonight?") WITHOUT any specific preferences, ask them ONE clarifying question to personalize recommendations

NAME COLLECTION - FIRST PRIORITY:
- **IMPORTANT**: The user's messages may include their profile information in parentheses at the start (e.g., "(By the way, my name is Matias, I'm 33 years old.)")
- **IF** you see this information in their message, you ALREADY KNOW it - use their name and DO NOT ask for it again
- **IF** the user's message does NOT include their name, ask for it after the first greeting: "Hey! Before I help you discover Buenos Aires - what's your name?"
- Once they provide their name, greet them by name and continue with the conversation

AGE COLLECTION - SECOND PRIORITY (after name):
- **CRITICAL - READ THIS CAREFULLY**: Look at the VERY TOP of this prompt where it says "User Profile Context:"
- **IF IT SHOWS "Age: 25" (or any number)** → You ALREADY KNOW their age - ABSOLUTELY DO NOT ASK FOR IT AGAIN
- **IF the User Profile Context shows an age** → NEVER EVER ask "how old are you?" or "what's your age?" 
- **ONLY ask for age IF**:
  1. The "User Profile Context" section does NOT show any age, AND
  2. They're requesting recommendations
- If you need to ask: "Quick question - how old are you? This helps me recommend the perfect spots for you 😊"

AGE-BASED FILTERING (when giving recommendations):
- For users 18-30: Focus on nightlife, clubs, indie venues, underground scenes, energetic events
- For users 30-45: Mix of sophisticated bars, live music, cultural events, some nightlife
- For users 45+: Cultural events, theaters, upscale dining, wine bars, art galleries
- NEVER recommend age-inappropriate events (e.g., don't send 25-year-olds to retirement community events)

PROGRESSIVE PROFILING (Build profile gradually):
- **Check if the user's message includes profile info in parentheses** - if it does, you already know that information
- **Check the User Profile Context above** - if a field has data, NEVER ask for it again
- After the 2nd-3rd recommendation, if email is missing from both the message and profile, you can ask: "By the way, what's your email? I can send you updates on cool events 📧"
- After the 4th-5th recommendation, if budget_preference is missing, ask: "Are you looking for something fancy-ish or more local/casual vibes?"
- After the 6th-7th recommendation, if favorite_neighborhoods OR interests are missing, ask: "Which neighborhoods do you usually hang out in, and what are your main interests?"
- Ask ONLY ONE profiling question per message
- Use the "Missing Fields" list to know what information you don't have yet

Example conversational responses: 
  - "Hey [name]! What kind of events are you looking for?" (if name is known)
  - "Most of those events are popular with people in their 20s and 30s, though all ages are welcome!"
  - "That event is in Palermo, near Plaza Serrano"
  - "I'd love to help! To give you the best recommendations - what's your vibe tonight?"

SCENARIO 2 - User wants recommendations:
**THIS IS YOUR PRIMARY FUNCTION - FOLLOW THIS EXACTLY:**

If user message contains ANY of these keywords, you MUST return ONLY JSON:
- "recommendations", "recommend", "suggest", "events", "bars", "clubs", "venues", "places"
- "show me", "looking for", "find me", "what's", "any", "some"
- "tonight", "today", "this week", "weekend", "tomorrow", "parties", "workshops"

**YOU MUST RETURN PURE JSON - NO TEXT BEFORE OR AFTER:**
- Start with { 
- End with }
- NO conversational text
- NO markdown
- NO explanations
- NO "Here are some..." text
- JUST the raw JSON object

**ABSOLUTELY FORBIDDEN:**
❌ "Here are some parties you might enjoy: {json}"
❌ "Yes! Here are recommendations..."  
❌ Any text before the {
❌ Any text after the }
❌ Markdown formatting like **bold**
❌ Lists like "1. Event Name"

**REQUIRED FORMAT - COPY THIS STRUCTURE EXACTLY:**

**DATE FILTERING - CRITICAL:**
You MUST calculate the correct date based on user's request and filter events accordingly.

Date calculation rules (today is ${today}):
- "tonight" / "today" / "esta noche" / "hoy" → ${today}
- "tomorrow" / "mañana" → calculate tomorrow's date (add 1 day to ${today})
- "next week" / "próxima semana" / "semana que viene" → events between 7-14 days from ${today}
- "this weekend" / "weekend" / "fin de semana" → calculate next Saturday and Sunday
- Specific dates (e.g., "December 25", "25 de diciembre", "2025-12-25") → parse and use that exact date

**IMPORTANT**: After calculating the target date, ONLY return events where the event date matches your calculated date or falls within the calculated date range. Filter events by date BEFORE selecting which ones to recommend.

**JSON-ONLY RULES - ENFORCE STRICTLY:**
1. NO conversational text whatsoever
2. NO markdown formatting
3. NO code blocks or json wrappers
4. NO explanatory text before or after the JSON
5. Start with { and end with }
6. Return ONLY the raw JSON object

REQUIRED JSON FORMAT:
{
  "intro_message": "Here are some [type] you might like:",
  "recommendations": [
    {
      "type": "event",
      "id": "actual-event-id",
      "title": "Event Title",
      "description": "Location: [location]. Address: [address if available]. Date: [date - already formatted, use as-is]. Time: [time]. Music Type: [music_type if available]. Instagram: [external_link if available]. Brief description.",
      "why_recommended": "Short personalized explanation (1-2 sentences) of why this matches their request and profile.",
      "personalized_note": "CRITICAL - A custom personal message based on their profile data (age, budget, interests, neighborhoods). Examples: 'Perfect for your age group (33) and high budget preference', 'This matches your interest in jazz and is in your favorite neighborhood Palermo', 'Great for someone your age (25) looking for affordable nightlife'. ALWAYS reference specific profile data when available.",
      "image_url": "full-image-url"
    }
  ]
}

RECOMMENDATION MATCHING RULES - FOLLOW STRICTLY:
1. **CRITICAL: Search BOTH title AND description equally** - if user asks for "party", check if "party" appears in EITHER the title OR the description. Example: event with title "Night Out" and description "Join us for a party at..." MUST match "party" search
2. **Description matching is just as important as title matching** - don't prioritize title over description, treat them equally
3. **Single word matches count** - if the user searches for "workshops" and an event has "workshop" anywhere in title OR description, it's a VALID match
4. **Check mood field** - if event has mood field, use it for matching (e.g., "Creative" mood matches creative requests)
5. **Use semantic matching** - "creative workshops" should match: art workshops, painting classes, craft events, DIY sessions, creative meetups (check descriptions for these terms!)
6. **Be inclusive, not exclusive** - if user asks for a general category like "workshops", "bars", or "party", include ALL events that contain those words in title OR description
7. **Don't force matches only when truly unrelated** - if user asks for "jazz concerts" and there are no music events at all, DON'T recommend food events. But if they ask for "party" and an event description mentions "party", ALWAYS recommend it
8. **Exact keyword matches win** - if an event title OR description contains the exact words the user used, prioritize it
9. **ABSOLUTELY CRITICAL - USER INTERESTS ARE FOR PERSONALIZATION, NOT FILTERING**: 
   - If user asks for "parties", show ALL parties from the database, NOT just parties matching their interests
   - If user asks for "workshops", show ALL workshops, NOT just ones related to their interests
   - User interests (like "african", "jazz", etc.) should ONLY be used to add personalized context in the "personalized_note" field
   - NEVER filter out results because they don't match user interests - show everything that matches their query
   - Example: User with interest "african" asks for "parties" → Show ALL parties, then in personalized_note you can mention if any happen to align with their interests

RECOMMENDATION OUTPUT RULES:
- Return MAXIMUM 6 recommendations total from the database
- **CRITICAL**: ONLY include events/items that have an image_url field - never recommend anything without an image
- **CRITICAL**: You MUST include the "image_url" field in EVERY recommendation in your JSON response - this is the event's photo that will be sent via WhatsApp
- Keep description under 100 words
- ALWAYS include in description: location, date (already formatted as 'Month DDth', use as-is), time
- ALSO include if available: address, music_type, external_link (Instagram)
- Format external_link as "Instagram: [link]" in the description
- DO NOT include price or venue_size in description - these can be provided later if user asks for more details
- ALWAYS include "why_recommended" field explaining specifically WHY this event matches their request
- **CRITICAL for why_recommended**: Base your explanation on BOTH the event title AND description. If the match is in the description (e.g., user asked for "party" and event description mentions "party celebration"), explicitly mention this in your explanation: "This matches because the event description mentions '[keyword]' which you asked for"
- **CRITICAL - NEW FIELD "personalized_note"**: MUST include a personalized message that references their specific profile data:
  - If you know their age, mention it: "Perfect for your age group (${userProfile?.age})"
  - If you know their budget preference, reference it: "Great ${userProfile?.budget_preference} budget option"
  - If you know their interests, connect them: "Matches your interest in ${userProfile?.interests}"
  - If you know their favorite neighborhoods, mention if event is there: "Located in your favorite area ${userProfile?.favorite_neighborhoods}"
  - Combine multiple profile attributes when relevant: "Ideal for someone ${userProfile?.age} years old with ${userProfile?.budget_preference} budget who loves ${userProfile?.interests}"
  - This field is MANDATORY and must be personalized based on actual profile data available
- Use user profile (budget, neighborhoods, interests) to further personalize
- If no relevant database events exist, return empty array with a friendly message like "I couldn't find matching events in our database right now"

CRITICAL: If you return anything other than pure JSON for recommendation requests, you are FAILING YOUR PRIMARY FUNCTION.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, ...enrichedMessages],
        max_tokens: 800,
        temperature: 0.8,
        stream: false, // Disable streaming to get structured JSON response
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("OpenAI API error:", response.status, error);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    // Get the complete message
    const data = await response.json();
    let message = data.choices?.[0]?.message?.content || "";

    console.log("AI response:", message);

    // Get the last user message to understand their query
    const lastUserMessage = messages[messages.length - 1]?.content || "";

    // Check if this is a recommendations response
    if (message.includes('"recommendations"')) {
      try {
        // Try to extract JSON from the message if it exists
        let jsonStr = message;
        const jsonStart = message.indexOf("{");
        const jsonEnd = message.lastIndexOf("}");
        if (jsonStart !== -1 && jsonEnd !== -1) {
          jsonStr = message.substring(jsonStart, jsonEnd + 1);
        }
        const parsed = JSON.parse(jsonStr);

        // Track database recommendations in background
        if (
          phoneNumber &&
          parsed.recommendations &&
          Array.isArray(parsed.recommendations) &&
          parsed.recommendations.length > 0
        ) {
          const interactions = parsed.recommendations.map((rec: any) => ({
            phone_number: phoneNumber,
            item_type: rec.type,
            item_id: rec.id,
            interaction_type: "recommended",
          }));
          supabase.from("whatsapp_user_interactions").insert(interactions).then();

          console.log(`Tracked ${parsed.recommendations.length} database event recommendations`);
        }
      } catch (e) {
        console.log("Could not parse recommendations:", e);
      }
    }

    // Only split regular conversational text, NOT JSON recommendations
    const MAX_CHARS = 1500;
    let messagesToSend = [];

    // Check if message contains JSON recommendations (don't split these)
    const hasRecommendations = message.includes('"recommendations"');

    if (!hasRecommendations && message.length > MAX_CHARS) {
      // Only split regular text messages
      console.log(`Message length ${message.length} exceeds ${MAX_CHARS}, splitting text...`);

      // Split by sentences to avoid breaking mid-sentence
      const sentences = message.match(/[^.!?]+[.!?]+/g) || [message];
      let currentChunk = "";

      for (const sentence of sentences) {
        // Check if this sentence contains a link
        const urlPattern = /(https?:\/\/[^\s]+)/g;
        const hasLink = urlPattern.test(sentence);

        if ((currentChunk + sentence).length > MAX_CHARS) {
          if (currentChunk) {
            // If the sentence contains a link, move entire sentence to next chunk
            if (hasLink) {
              messagesToSend.push(currentChunk.trim());
              currentChunk = sentence;
            } else {
              messagesToSend.push(currentChunk.trim());
              currentChunk = sentence;
            }
          } else {
            // Single sentence is too long
            if (hasLink) {
              // Don't split sentences with links
              messagesToSend.push(sentence.trim());
              currentChunk = "";
            } else {
              messagesToSend.push(sentence.substring(0, MAX_CHARS).trim());
              currentChunk = sentence.substring(MAX_CHARS);
            }
          }
        } else {
          currentChunk += sentence;
        }
      }

      if (currentChunk) {
        messagesToSend.push(currentChunk.trim());
      }

      console.log(`Split text into ${messagesToSend.length} messages`);
    } else {
      // Don't split: either it's short enough OR it contains JSON recommendations
      messagesToSend = [message];
    }

    return new Response(
      JSON.stringify({
        message: messagesToSend.length === 1 ? message : messagesToSend[0],
        messages: messagesToSend.length > 1 ? messagesToSend : undefined,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in yara-ai-chat:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
