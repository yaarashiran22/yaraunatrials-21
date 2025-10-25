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
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("Lovable API key not configured");
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

      if (userProfile.activity_frequency) {
        parts.push(`Activity Frequency: ${userProfile.activity_frequency}`);
        userProfileInfo.push(`I go out ${userProfile.activity_frequency}`);
      } else {
        missingFields.push("activity_frequency");
      }

      if (userProfile.wants_ai_recommendations !== null && userProfile.wants_ai_recommendations !== undefined) {
        parts.push(`Wants AI Recommendations: ${userProfile.wants_ai_recommendations ? 'Yes' : 'No'}`);
        userProfileInfo.push(`I ${userProfile.wants_ai_recommendations ? 'do' : 'do not'} want to receive AI-initiated recommendations`);
      } else {
        missingFields.push("wants_ai_recommendations");
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

    // Calculate date context for better AI understanding
    const todayDate = new Date();
    const dayOfWeek = todayDate.getDay(); // 0 = Sunday, 6 = Saturday
    const nextSaturday = new Date(todayDate);
    nextSaturday.setDate(todayDate.getDate() + ((6 - dayOfWeek + 7) % 7 || 7));
    const nextSunday = new Date(nextSaturday);
    nextSunday.setDate(nextSaturday.getDate() + 1);
    
    const dateContext = `
Current Date Information:
- Today is: ${today} (${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]})
- This weekend is: ${nextSaturday.toISOString().split('T')[0]} (Saturday) and ${nextSunday.toISOString().split('T')[0]} (Sunday)
- When user says "this weekend" or "the weekend", they mean ${nextSaturday.toISOString().split('T')[0]} and ${nextSunday.toISOString().split('T')[0]}
`;

    const systemPrompt = `You are Yara, a friendly AI assistant for Buenos Aires events and experiences. Use emojis naturally to add warmth (1-2 per message), but don't overdo it.

${dateContext}
${userContext}

Available data:
${JSON.stringify(contextData, null, 2)}

CRITICAL RESPONSE FORMAT - YOU MUST FOLLOW THIS EXACTLY:

When user asks for recommendations (events, bars, places, etc.), you will use the provide_recommendations tool.
For all other conversations (greetings, questions, clarifications), respond with conversational text.

CONVERSATIONAL RESPONSES (no tool call):
- User greetings, follow-up questions, or general conversation
- Questions about previously recommended events or details
- If user asks VERY GENERAL questions without specifics, ask ONE clarifying question
- **IMPORTANT**: Keep responses brief and ask ONLY ONE question at a time

NAME COLLECTION - FIRST PRIORITY:
- **IMPORTANT**: The user's messages may include their profile information in parentheses at the start (e.g., "(By the way, my name is Matias, I'm 33 years old.)")
- **IF** you see this information in their message, you ALREADY KNOW it - use their name and DO NOT ask for it again
- **IF** the user's message does NOT include their name, ask for it after the first greeting: "Hey! Before I help you discover Buenos Aires - what's your name?"
- Once they provide their name, greet them by name and continue with the conversation

AGE COLLECTION - SECOND PRIORITY (after name):
- **CRITICAL**: Check the "User Profile Context" section at the top - if it shows "Age: [number]", you ALREADY KNOW their age - NEVER ask for it
- **IF** the user's message includes their age in parentheses (e.g., "I'm 33 years old"), you ALREADY KNOW their age - DO NOT ask for it
- **IF** the User Profile Context does NOT show an age AND their message does NOT include age AND they request recommendations, ask for age:
  - If they mention going "with friends", "with people", or "we", ask: "Quick question - what are your ages? (e.g., 25, 28, 30)"
  - If they're asking just for themselves, ask: "Quick question - how old are you? This helps me recommend the perfect spots for you 😊"

ACTIVITY FREQUENCY COLLECTION - THIRD PRIORITY (after name and age):
- **CRITICAL**: Check the "User Profile Context" section at the top - if it shows "Activity Frequency: [value]", you ALREADY KNOW it - NEVER ask again
- **IF** activity frequency is missing from profile, ask casually: "By the way, how often do you usually go out? (daily, weekly, monthly, etc.)"

AI RECOMMENDATIONS PREFERENCE - FOURTH PRIORITY:
- **CRITICAL**: Check the "User Profile Context" section - if it shows "Wants AI Recommendations: Yes/No", you ALREADY KNOW it - NEVER ask again
- **IF** wants_ai_recommendations preference is missing from profile, ask: "Would you like me to send you personalized recommendations whenever I find something perfect for you? 🎯"

AGE-BASED FILTERING (when giving recommendations):
- For users 18-30: Focus on nightlife, clubs, indie venues, underground scenes, energetic events
- For users 30-45: Mix of sophisticated bars, live music, cultural events, some nightlife
- For users 45+: Cultural events, theaters, upscale dining, wine bars, art galleries
- NEVER recommend age-inappropriate events (e.g., don't send 25-year-olds to retirement community events)

PROGRESSIVE PROFILING (Build profile gradually):
- **Check if the user's message includes profile info in parentheses** - if it does, you already know that information
- **Check the User Profile Context above** - if a field has data, NEVER ask for it again
- After the 4th-5th recommendation, if budget_preference is missing, ask: "Are you looking for something fancy-ish or more local/casual vibes?"
- After the 6th-7th recommendation, if favorite_neighborhoods OR interests are missing, ask: "Which neighborhoods do you usually hang out in, and what are your main interests?"
- Ask ONLY ONE profiling question per message
- Use the "Missing Fields" list to know what information you don't have yet
- **NEVER ask for email** - we don't collect email addresses

Example conversational responses: 
  - "Hey [name]! What kind of events are you looking for?" (if name is known)
  - "Most of those events are popular with people in their 20s and 30s, though all ages are welcome!"
  - "That event is in Palermo, near Plaza Serrano"
  - "I'd love to help! To give you the best recommendations - what's your vibe tonight?"

RECOMMENDATION REQUESTS (use provide_recommendations tool):
When user wants specific recommendations about events, bars, places, etc., you will call the provide_recommendations tool.

Detection keywords: "recommendations", "recommend", "suggest", "events", "bars", "clubs", "venues", "places", "show me", "looking for", "find me", "what's", "any", "tonight", "today", "this week", "weekend", "tomorrow", "next week", "dance", "music", "live", "party", "art", "food"
Spanish: "esta noche", "hoy", "mañana", "próxima semana", "semana que viene", "fin de semana"

**IMPORTANT**: ONLY use the tool if age is already collected. If age is missing, respond with conversational text asking for age first.

**DATE INTERPRETATION:**
- "tonight" / "today" / "esta noche" / "hoy" → Use today's date from Date Context
- "tomorrow" / "mañana" → Add 1 day to today's date  
- "this weekend" / "weekend" / "fin de semana" / "the weekend" → Use the EXACT dates from "This weekend is:" in Date Context
- "next week" → Events 7-14 days from today
- Specific dates → Parse and use that exact date

**CRITICAL**: When user says "this weekend", use the exact dates provided in Date Context. DO NOT ask for clarification.

**CRITICAL IMAGE_URL REQUIREMENT:**
- The image_url field is MANDATORY for every recommendation
- Copy the EXACT image_url value from the event data
- If an event has no image_url, DO NOT include that event
- Images are sent via WhatsApp, so image_url MUST be present

RECOMMENDATION MATCHING & OUTPUT RULES (for provide_recommendations tool):
1. Search BOTH title AND description equally for keywords
2. Use semantic matching (e.g., "creative workshops" matches art/craft/DIY events)
3. Check mood field for matching vibes
4. Prioritize exact keyword matches in title or description
5. Return MAXIMUM 6 recommendations
6. ONLY include items that have an image_url field
7. Filter by date BEFORE recommending
8. Personalize using user profile (age, budget, interests, neighborhoods)
9. If no matches exist, return empty array

**CRITICAL**: The provide_recommendations tool enforces that image_url is included for every recommendation.`;

    // Get the last user message to understand their query
    const lastUserMessage = messages[messages.length - 1]?.content || "";
    
    // Keywords that indicate a recommendation request
    const recommendationKeywords = /\b(recommend|suggest|show me|find me|looking for|what's|any|events?|bars?|clubs?|venues?|places?|tonight|today|tomorrow|weekend|esta noche|hoy|mañana|fin de semana|dance|music|live|party|art|food)\b/i;

    // Build request body
    const requestBody: any = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        ...enrichedMessages,
      ],
      max_completion_tokens: 2000,
    };

    // Check if this is likely a recommendation request
    const isLikelyRecommendation = lastUserMessage && recommendationKeywords.test(lastUserMessage);
    
    if (isLikelyRecommendation) {
      // Use structured output with tool calling to guarantee all fields including image_url
      requestBody.tools = [
        {
          type: "function",
          function: {
            name: "provide_recommendations",
            description: "Provide event, business, or coupon recommendations to the user",
            parameters: {
              type: "object",
              properties: {
                intro_message: {
                  type: "string",
                  description: "A friendly intro message like 'Here are some events you might like:'"
                },
                recommendations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["event", "business", "coupon"] },
                      id: { type: "string", description: "The actual ID from the database" },
                      title: { type: "string", description: "The event/item title from the database" },
                      description: { type: "string", description: "Location, address, date, time, and other details" },
                      why_recommended: { type: "string", description: "Why this matches their request" },
                      personalized_note: { type: "string", description: "Personal message based on their profile" },
                      image_url: { type: "string", description: "REQUIRED - The exact image_url from the database event" }
                    },
                    required: ["type", "id", "title", "description", "why_recommended", "personalized_note", "image_url"],
                    additionalProperties: false
                  }
                }
              },
              required: ["intro_message", "recommendations"],
              additionalProperties: false
            }
          }
        }
      ];
      requestBody.tool_choice = { type: "function", function: { name: "provide_recommendations" } };
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Lovable AI error:", response.status, error);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please contact support." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Lovable AI error: ${response.status}`);
    }

    // Get the complete message
    const data = await response.json();
    
    // Check if we got a tool call response (structured recommendations)
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let message: string;
    
    if (toolCall && toolCall.function?.name === "provide_recommendations") {
      // Parse the structured output
      const functionArgs = JSON.parse(toolCall.function.arguments);
      message = JSON.stringify(functionArgs);
      console.log("AI response (structured):", message);
    } else {
      // Regular conversational response
      message = data.choices?.[0]?.message?.content || "";
      console.log("AI response (conversational):", message);
    }


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
