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
    const { messages, stream = true, userProfile = null, phoneNumber = null, useIntroModel = false } = await req.json();
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
          "id, title, description, date, time, location, address, price, mood, music_type, venue_size, external_link, image_url, target_audience",
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

    // Helper function to check if user's age matches event's target_audience
    const isAgeAppropriate = (targetAudience: string | null, userAge: number | null): boolean => {
      if (!targetAudience || !userAge) return true; // If no target_audience or no user age, include event
      
      // Parse age ranges like "18-30", "40+", "20-23"
      if (targetAudience.includes('-')) {
        const [minAge, maxAge] = targetAudience.split('-').map(s => parseInt(s.trim()));
        return userAge >= minAge && userAge <= maxAge;
      } else if (targetAudience.includes('+')) {
        const minAge = parseInt(targetAudience.replace('+', '').trim());
        return userAge >= minAge;
      }
      
      return true; // If format is unrecognized, include the event
    };

    // Filter events by age appropriateness if user has an age
    const userAge = userProfile?.age;
    const ageFilteredEvents = events.filter(event => isAgeAppropriate(event.target_audience, userAge));
    
    console.log(`Fetched ${events.length} events, filtered to ${ageFilteredEvents.length} age-appropriate events for age ${userAge}`);
    console.log(`Also fetched ${businesses.length} businesses, ${coupons.length} coupons`);

    // Build context for AI - keep dates in YYYY-MM-DD format for proper filtering
    const contextData = {
      events: ageFilteredEvents.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        date: e.date, // Keep raw date format for AI to filter properly
        time: e.time,
        location: e.location,
        address: e.address,
        price: e.price,
        mood: e.mood,
        music_type: e.music_type,
        venue_size: e.venue_size,
        external_link: e.external_link,
        image_url: e.image_url,
        target_audience: e.target_audience,
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

      if (userProfile.interests?.length) {
        parts.push(`Interests: ${userProfile.interests.join(", ")}`);
        userProfileInfo.push(`my interests are ${userProfile.interests.join(", ")}`);
      }

      if (userProfile.location) {
        parts.push(`Location: ${userProfile.location}`);
        userProfileInfo.push(`I'm based in ${userProfile.location}`);
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
      const firstUserMsgIndex = enrichedMessages.findIndex((m) => m.role === "user");
      if (firstUserMsgIndex !== -1) {
        const profilePrefix = `(By the way, ${userProfileInfo.join(", ")}.) `;
        enrichedMessages[firstUserMsgIndex] = {
          ...enrichedMessages[firstUserMsgIndex],
          content: profilePrefix + enrichedMessages[firstUserMsgIndex].content,
        };
      }
    }

    const userLanguage = userProfile?.preferred_language || 'en';
    const languageInstruction = userLanguage === 'es'
      ? 'CRITICAL: Respond ONLY in Spanish to this user. All messages, recommendations, and questions must be in Spanish.'
      : 'CRITICAL: Respond ONLY in English to this user. All messages, recommendations, and questions must be in English.';

    const systemPrompt = `You are Yara, a friendly AI assistant for Buenos Aires events and experiences. Use emojis naturally to add warmth (1-2 per message), but don't overdo it.

${languageInstruction}

Today's date is: ${today}
${userContext}

Available data:
${JSON.stringify(contextData, null, 2)}

CRITICAL RESPONSE FORMAT - YOU MUST FOLLOW THIS EXACTLY:

**ABSOLUTE RULE: NEVER RETURN JSON FOR GREETINGS OR CASUAL MESSAGES**
- Messages like "hi", "hello", "hey", "sup", "hola" etc. are GREETINGS - respond conversationally, NEVER with JSON
- Only return JSON when user EXPLICITLY asks for recommendations using keywords like "recommend", "suggest", "show me", "find me", "looking for", "I want"

SCENARIO 1 - User greeting, asking follow-up questions, or general conversation:
Respond with PLAIN TEXT ONLY. Be warm and conversational.
- If user asks about age ranges, demographics, or details about previously recommended events, answer based on the event data
- If user asks clarifying questions about recommendations you already gave, refer to the conversation history and provide helpful answers
- Be contextually aware - if they're asking about "these events" or "the recommendations", they're referring to what you previously suggested
- **IMPORTANT**: Keep responses brief and ask ONLY ONE question at a time
- If user asks VERY GENERAL questions about things to do in the city (like "what's happening?", "what should I do?", "any events tonight?") WITHOUT any specific preferences, ask them ONE clarifying question to personalize recommendations

AGE COLLECTION - FIRST PRIORITY:
- **CRITICAL**: Check the "User Profile Context" section at the top - if it shows "Age: [number]", you ALREADY KNOW their age - NEVER ask for it again
- **IF** the user's message includes their age in parentheses (e.g., "I'm 33 years old"), you ALREADY KNOW their age - DO NOT ask for it again
- **IF** the User Profile Context does NOT show an age AND their message does NOT include age, ask for age BEFORE giving recommendations:
  - If they mention going "with friends", "with people", or "we", ask: "Quick question - what are your ages? (e.g., 25, 28, 30)"
  - If they're asking just for themselves, ask: "Quick question - how old are you? This helps me recommend the perfect spots for you 😊"

NAME COLLECTION - AFTER FIRST RECOMMENDATION:
- **IMPORTANT**: The user's messages may include their profile information in parentheses at the start (e.g., "(By the way, my name is Matias, I'm 33 years old.)")
- **IF** you see their name in their message or in the User Profile Context, you ALREADY KNOW it - use their name and DO NOT ask for it again
- **ONLY ASK FOR NAME AFTER YOU'VE GIVEN THE FIRST RECOMMENDATION** - Don't ask during initial greeting
- Once they provide their name, use it naturally in future conversations

AGE-BASED FILTERING (when giving recommendations):
- **CRITICAL - AGE FILTERING IS ALREADY DONE**: The events you receive have ALREADY been filtered by age on the backend. Every event in the "Available events" list is age-appropriate for the user. DO NOT filter by age again.
- **ABSOLUTE RULE**: If the user asks for "workshops" and you see ANY event in the available events that contains workshop/class/course keywords in title or description, YOU MUST recommend it. The event is already age-appropriate.
- **CRITICAL**: If NO events of the requested type exist in the available data, respond with CONVERSATIONAL TEXT (NOT JSON) saying: "I couldn't find any [requested type] in our current database. Would you like me to suggest similar events instead?"
- DO NOT mention "interests" or "age" in your "no results" messages - age filtering is already done, and interests should never filter results
- Example: "I couldn't find any workshops in our current database. Would you like me to suggest creative events instead?"

PROGRESSIVE PROFILING (Build profile gradually):
- **Check if the user's message includes profile info in parentheses** - if it does, you already know that information
- **Check the User Profile Context above** - if a field has data, NEVER ask for it again
- After the 2nd-3rd recommendation, if interests are missing, ask: "What are your main interests? (art, music, food, sports, etc.) 🎨"
- After the 4th-5th recommendation, if location is missing, ask: "Which neighborhood are you usually in? 📍"
- Ask ONLY ONE profiling question per message

Example conversational responses: 
  - "Hey [name]! What kind of events are you looking for?" (if name is known)
  - "Most of those events are popular with people in their 20s and 30s, though all ages are welcome!"
  - "That event is in Palermo, near Plaza Serrano"
  - "I'd love to help! To give you the best recommendations - what's your vibe tonight?"

SCENARIO 2 - User wants SPECIFIC recommendations (dance events, bars, techno, etc.):
**ABSOLUTELY CRITICAL - NO EXCEPTIONS**: When user requests specific recommendations, you MUST return PURE JSON ONLY.

**CRITICAL - WHEN NO DATABASE MATCHES:**
- If the user requests recommendations (cafes, restaurants, general places) and there are NO matching events/businesses in the Available data above, respond with PLAIN TEXT: "NO_DATABASE_MATCH: [user's EXACT original request]"
- **CRITICAL: Preserve the user's EXACT request wording** - do NOT rephrase or reinterpret their request
- Example: User asks "cafes to focus on work in villa crespo" → Respond: "NO_DATABASE_MATCH: cafes to focus on work in villa crespo"
- Example: User asks "romantic restaurants in Palermo" → Respond: "NO_DATABASE_MATCH: romantic restaurants in Palermo"
- **DO NOT reinterpret**: "cafes to focus on work" is NOT the same as "cafes for dates"
- **PRESERVE neighborhood**: If user mentions a specific neighborhood (Villa Crespo, Palermo, etc.), keep it in the query
- **PRESERVE purpose/mood**: If user mentions work, dates, study, etc., keep that specific purpose
- This triggers a fallback to general Buenos Aires recommendations from OpenAI WITH the correct user intent
- **DO NOT** try to recommend unrelated events just to give an answer - admit when database has no matches

**CRITICAL - ONLY USE JSON FOR EXPLICIT RECOMMENDATION REQUESTS:**
- Use JSON ONLY when user is EXPLICITLY asking for suggestions/recommendations with action keywords
- **DO NOT** use JSON when user sends GREETINGS ("hi", "hello", "hey", "hola", "sup") - respond conversationally
- **DO NOT** use JSON when user is asking QUESTIONS about previously recommended events
- **DO NOT** use JSON when user is having follow-up conversation about recommendations you already gave
- **DO NOT** assume they want recommendations just because they have interests in their profile

DETECTION KEYWORDS FOR JSON RESPONSE (user MUST use at least one of these):
- Action words: "recommend", "suggest", "show me", "find me", "looking for", "I want", "I need", "gimme", "dame"
- Combined with: "events", "bars", "clubs", "venues", "places", "tonight", "today", etc.
- Examples that trigger JSON: "recommend dance events", "show me bars in Palermo", "I want live music tonight"
- Examples that DO NOT trigger JSON: "hi", "hello", "hey there", "what's up"

**QUESTIONS ABOUT EVENTS = CONVERSATIONAL TEXT (NOT JSON):**
- "what age groups", "how much", "where is", "when is", "tell me more", "is it", "are they"
- Any follow-up questions about events you already recommended

**IMPORTANT**: ONLY return JSON if age is already collected. If age is missing, respond with conversational text asking for age first.

**DATE FILTERING - CRITICAL:**
You MUST calculate the correct date based on user's request and filter events accordingly.

**IMPORTANT**: Event dates are in YYYY-MM-DD format (e.g., "2025-11-01") OR recurring format (e.g., "every monday"). Use this format for all date calculations.

Date calculation rules (today is ${today}):
- **"tonight" / "today" / "esta noche" / "hoy" → CRITICAL:**
  * Determine what day of week ${today} is (e.g., if ${today} is 2025-10-30, that's Wednesday)
  * ONLY include: 1) events with date = "${today}" OR 2) recurring events that match TODAY's EXACT day of week
  * Example: If today is Wednesday, ONLY include "every wednesday" - DO NOT include "every tuesday", "every monday", etc. even though they're recurring
  * **DO NOT include recurring events from earlier days of the week that already passed**
- "tomorrow" / "mañana" → Calculate tomorrow's date by adding 1 day to ${today} (e.g., if today is 2025-10-28, tomorrow is 2025-10-29). ONLY include recurring events that match TOMORROW's day of week (not today's or earlier days)
- "this week" / "esta semana" → Filter events from ${today} until the end of this week (Sunday) OR recurring events for remaining days of week (e.g., if today is Tuesday, include "every wednesday", "every thursday", "every friday", "every saturday", "every sunday")
- "next week" / "próxima semana" / "semana que viene" → Filter events where date is between 7-14 days from ${today}
- **"this weekend" / "weekend" / "fin de semana" → CRITICAL CALCULATION:**
  * First, determine what day of week today is (${today})
  * If today is Saturday or Sunday: "this weekend" means today + tomorrow (the current weekend)
  * If today is Monday-Friday: "this weekend" means the UPCOMING Saturday and Sunday
  * Example: If today is Tuesday Oct 29, 2025, then "this weekend" = Nov 1 (Sat) and Nov 2 (Sun)
  * Calculate the exact YYYY-MM-DD dates for that Saturday and Sunday
  * **STRICT FILTER**: ONLY include events with those EXACT Saturday/Sunday YYYY-MM-DD dates OR "every saturday"/"every sunday" recurring events
  * **DO NOT include events from other days** - weekend means ONLY Saturday and Sunday

**RECURRING EVENTS - CRITICAL:**
- Events with dates like "every monday", "every friday", etc. occur weekly on that day
- When user asks for a specific date (e.g., "tonight"), calculate what day of the week that is
- Example: If today is Monday and user asks for "tonight", include both date="2025-10-28" AND date="every monday"
- Example: If user asks for "tomorrow" and tomorrow is Tuesday, include both tomorrow's date AND date="every tuesday"
- **CRITICAL FOR "THIS WEEK"**: When user asks for "this week" or "esta semana", you MUST include EVERY recurring event that falls on a remaining day of this week
- Example: If today is Tuesday and user asks for "this week", you MUST include: "every tuesday", "every wednesday", "every thursday", "every friday", "every saturday", "every sunday"
- **DO NOT SKIP recurring events just because there are specific-date events on the same day** - include BOTH
- Days of week: monday, tuesday, wednesday, thursday, friday, saturday, sunday

**When formatting dates in your response**: Convert YYYY-MM-DD to human-readable format like "November 1st" in the description field only. For recurring events, keep as "every [day]".
- Specific dates (e.g., "December 25", "25 de diciembre", "2025-12-25") → parse and use that exact date

**RECURRING EVENTS - CRITICAL:**
- Events with dates like "every friday", "every tuesday", "every monday", etc. are RECURRING EVENTS
- When a user asks for events "in [month]" or "this month" or "next month", ALWAYS include recurring events that match their other criteria (music type, vibe, etc.)
- Example: User asks for "jazz events in November" → include "every friday" jazz events because they occur in November
- Only filter by specific dates when user asks for "tonight", "tomorrow", "this weekend", or a specific date
- For broader time requests (weeks, months, or general "events"), include ALL recurring events that match the user's other criteria

**IMPORTANT**: After calculating the target date, filter events appropriately:
- For specific date requests (tonight, tomorrow, specific date): Only return events with that exact date
- For time period requests (this month, next month, this week): Include both events in that period AND recurring events
- Filter events by date BEFORE selecting which ones to recommend.

**JSON-ONLY RULES - ENFORCE STRICTLY:**
1. NO conversational text whatsoever
2. NO markdown formatting
3. NO code blocks or json wrappers
4. NO explanatory text before or after the JSON
5. Start with { and end with }
6. Return ONLY the raw JSON object

REQUIRED JSON FORMAT - EVERY FIELD IS MANDATORY (NO EXCEPTIONS):
{
  "intro_message": "Here are some [type] you might like:",
  "recommendations": [
    {
      "type": "event",
      "id": "actual-event-id-from-database",
      "title": "Event Title from database",
      "description": "MANDATORY - MUST ALWAYS BE INCLUDED. Format: Location: [location]. Address: [address if available]. Date: [date - already formatted, use as-is]. Time: [time]. Music Type: [music_type if available]. Instagram: [external_link if available]. Brief description of the event.",
      "why_recommended": "Short personalized explanation (1-2 sentences) of why this matches their request and profile.",
      "personalized_note": "CRITICAL - A custom personal message based on their profile data (age, budget, interests, neighborhoods). Examples: 'Perfect for your age group (33) and high budget preference', 'This matches your interest in jazz and is in your favorite neighborhood Palermo', 'Great for someone your age (25) looking for affordable nightlife'. ALWAYS reference specific profile data when available.",
      "image_url": "CRITICAL - YOU MUST COPY THE EXACT image_url VALUE FROM THE DATABASE EVENT - this is the event photo URL that will be sent via WhatsApp. DO NOT omit this field or the images won't be sent!"
    }
  ]
}

**CRITICAL IMAGE_URL REQUIREMENT:**
- The "image_url" field is MANDATORY for every recommendation
- Copy the EXACT image_url value from the event data in the database
- If an event has no image_url in the database, DO NOT include that event in recommendations
- The image_url will be used to send the event photo via WhatsApp, so it MUST be present

RECOMMENDATION MATCHING RULES - FOLLOW STRICTLY:
**CRITICAL: DO NOT FILTER BY USER INTERESTS** - Only filter by: (1) the event type/keywords the user requested, and (2) age appropriateness

1. **CRITICAL: Search BOTH title AND description equally** - if user asks for "party", check if "party" appears in EITHER the title OR the description. Example: event with title "Night Out" and description "Join us for a party at..." MUST match "party" search
2. **Description matching is just as important as title matching** - don't prioritize title over description, treat them equally
3. **Single word matches count** - if the user searches for "workshops" and an event has "workshop" anywhere in title OR description, it's a VALID match
4. **CRITICAL WORKSHOP/EVENT TYPE DETECTION**: When user asks for "workshops", "classes", "courses", etc.:
   - **STRICT RULE**: ONLY recommend events that EXPLICITLY contain workshop-related keywords in their title OR description
   - Keywords that MUST appear: workshop, class, course, taller, masterclass, training, seminar, lesson, tutorial, "learn about", "how to", teaching
   - An event with title "Creative vermuth workshop" is a WORKSHOP - INCLUDE IT
   - An event with description "Join our cooking class" is a WORKSHOP - INCLUDE IT
   - **ABSOLUTE EXCLUSIONS - NEVER RECOMMEND THESE AS WORKSHOPS**:
     * "Live jazz jam session" - This is a JAM SESSION, NOT a workshop
     * Any "jam session" - These are performances/social events, NOT workshops
     * Concerts, shows, performances - NOT workshops unless they explicitly say "workshop" or "class"
     * Social gatherings, meetups, parties - NOT workshops unless they explicitly say "workshop" or "class"
   - **DO NOT justify jam sessions as "interactive events" or "creative workshops"** - they are NOT workshops
   - If an event doesn't use the words "workshop", "class", "course", "taller", "lesson", or "tutorial", DO NOT recommend it for workshop requests
5. **Check mood field** - if event has mood field, use it for matching (e.g., "Creative" mood matches creative requests)
6. **Use semantic matching** - "creative events" should match: art workshops, painting classes, craft events, DIY sessions, creative meetups, vermuth making, cooking classes
7. **Be inclusive, not exclusive** - if user asks for a general category like "bars" or "party", include ALL age-appropriate events that contain those words in title OR description, regardless of the user's interest profile
8. **Don't force matches only when truly unrelated** - if user asks for "jazz concerts" and there are no music events at all, DON'T recommend food events. But if they ask for "party" and an event description mentions "party", ALWAYS recommend it
9. **Exact keyword matches win** - if an event title OR description contains the exact words the user used, prioritize it
10. **Category synonyms**: Treat these as equivalent:
    - workshops = classes = courses = talleres = masterclasses = trainings = lessons = seminars = tutorials
    - party = fiesta = celebration = gathering
    - bar = pub = cerveceria = cocktail bar
    - **CRITICAL - "shows" interpretation**: shows = concerts = performances = gigs = live music = live performances = live entertainment = spectacles
    - When user asks for "shows" or "live shows", include ALL of: concerts, performances, live music events, gigs, theater, comedy shows, any live entertainment
    - **NEVER treat**: jam session = workshop, concert = workshop, show = workshop
11. **CRITICAL: User interests are for CONTEXT ONLY, not for filtering** - The user's interests help you understand their preferences and personalize your responses, but DO NOT use interests to exclude events from recommendations. Always show all age-appropriate events that match the requested type.

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
- If no relevant database events exist, return empty array with a friendly message like "Sorry, I couldn't find any matching events"

CRITICAL: If you return anything other than pure JSON for recommendation requests, you are FAILING YOUR PRIMARY FUNCTION.`;

    // Get the last user message to understand their query
    const lastUserMessage = messages[messages.length - 1]?.content || "";

    // Keywords that indicate an EXPLICIT recommendation request
    // Expanded to catch event/venue requests even without action words
    const recommendationKeywords =
      /\b(recommend|suggest|show me|find me|looking for|i want|i need|can you find|help me find|gimme|dame|are there|is there|any)\b.*\b(event|party|parties|bar|bars|club|clubs|venue|concert|show|music|workshop|class)\b|^\b(event|party|parties|bar|bars|club|clubs|latin|techno|jazz|indie|dance|dancing)\b/i;

    // Build request body
    const requestBody: any = {
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: systemPrompt }, ...enrichedMessages],
      max_completion_tokens: 4000,
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
                  description: "A friendly intro message like 'Here are some events you might like:'",
                },
                recommendations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["event", "business", "coupon"] },
                      id: { type: "string", description: "The actual ID from the database" },
                      title: { type: "string", description: "The event/item title from the database" },
                      description: { type: "string", description: "MANDATORY - NEVER SKIP THIS. Include: Location, address, date, time, and brief event details" },
                      why_recommended: { type: "string", description: "Why this matches their request" },
                      personalized_note: { type: "string", description: "Personal message based on their profile" },
                      image_url: {
                        type: "string",
                        description: "REQUIRED - The exact image_url from the database event",
                      },
                    },
                    required: [
                      "type",
                      "id",
                      "title",
                      "description",
                      "why_recommended",
                      "personalized_note",
                      "image_url",
                    ],
                    additionalProperties: false,
                  },
                },
              },
              required: ["intro_message", "recommendations"],
              additionalProperties: false,
            },
          },
        },
      ];
      requestBody.tool_choice = { type: "function", function: { name: "provide_recommendations" } };
    }

    // Use faster model for intro messages, standard model for recommendations
    const modelToUse = useIntroModel ? "google/gemini-2.5-flash-lite" : "google/gemini-2.5-flash";
    requestBody.model = modelToUse;
    
    console.log(`Using model: ${modelToUse} (useIntroModel: ${useIntroModel})`);

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
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please contact support." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Lovable AI error: ${response.status}`);
    }

    // Get the complete message
    const data = await response.json();
    console.log("Full AI response:", JSON.stringify(data, null, 2));

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

      // FALLBACK: Check if AI detected no database matches
      if (message.startsWith("NO_DATABASE_MATCH:")) {
        const userQuery = message.replace("NO_DATABASE_MATCH:", "").trim();
        console.log(`No database matches found for: "${userQuery}". Falling back to OpenAI for general recommendations.`);

        // Call OpenAI for general Buenos Aires recommendations
        const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
        if (!openaiApiKey) {
          message = userLanguage === 'es' 
            ? "No encontré eventos relacionados en mi base de datos. ¿Quieres que te recomiende otros tipos de eventos?" 
            : "I couldn't find any matching events in my database. Would you like me to suggest other types of events?";
        } else {
          try {
            // Extract location from last user message if specified
            const lastUserMsg = messages[messages.length - 1]?.content?.toLowerCase() || "";
            const locationMatch = lastUserMsg.match(/\b(?:in|en)\s+([a-záéíóúñ\s]+?)(?:\s|$|,|\.|\?|!)/i);
            const specifiedLocation = locationMatch ? locationMatch[1].trim() : null;
            
            const locationInstruction = specifiedLocation 
              ? `CRITICAL: The user specifically asked for recommendations IN ${specifiedLocation.toUpperCase()}. You MUST recommend ONLY venues located in ${specifiedLocation}. Do NOT recommend venues in other neighborhoods.`
              : '';

            const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${openaiApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                  {
                    role: "system",
                    content: `You are Yara, a friendly Buenos Aires local guide. The user asked for "${userQuery}" but there are no matching events in your database. Provide 3-5 general recommendations for ${userQuery} in Buenos Aires. Include specific venue names, neighborhoods, and brief descriptions. Keep it conversational, warm, and helpful. Use emojis naturally (1-2 per message). Respond in ${userLanguage === 'es' ? 'Spanish' : 'English'}. ${locationInstruction}`,
                  },
                  {
                    role: "user",
                    content: `I'm looking for ${userQuery} in Buenos Aires. Can you recommend some places?`,
                  },
                ],
                max_tokens: 500,
                temperature: 0.8,
              }),
            });

            if (openaiResponse.ok) {
              const openaiData = await openaiResponse.json();
              message = openaiData.choices?.[0]?.message?.content || message;
              console.log("OpenAI fallback response:", message);
            } else {
              console.error("OpenAI fallback error:", await openaiResponse.text());
              message = userLanguage === 'es'
                ? "No encontré eventos relacionados en mi base de datos ahora mismo. ¡Pregúntame sobre eventos, conciertos o vida nocturna!"
                : "I couldn't find any matching events in my database right now. Try asking about upcoming events, nightlife, or cultural activities!";
            }
          } catch (error) {
            console.error("OpenAI fallback error:", error);
            message = userLanguage === 'es'
              ? "No encontré eventos relacionados en mi base de datos. ¡Intenta buscar eventos, conciertos o vida nocturna!"
              : "I couldn't find any matching events in my database. Try searching for events, concerts, or nightlife!";
          }
        }
      }

      if (!message) {
        console.error(
          "AI returned empty content. Full message object:",
          JSON.stringify(data.choices?.[0]?.message, null, 2),
        );
      }
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

        // CRITICAL FIX: Filter out age-inappropriate events that AI might hallucinate
        if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
          const ageAppropriateEventIds = new Set(ageFilteredEvents.map(e => e.id));
          
          parsed.recommendations = parsed.recommendations.filter((rec: any) => {
            if (rec.type === 'event' && !ageAppropriateEventIds.has(rec.id)) {
              console.log(`Filtering out age-inappropriate event that AI hallucinated: ${rec.title} (ID: ${rec.id})`);
              return false;
            }
            return true;
          });
          
          console.log(`After age validation: ${parsed.recommendations.length} recommendations`);
        }

        // CRITICAL FIX: Filter out jam sessions when user asks for workshops
        const lastUserMessage = messages[messages.length - 1]?.content?.toLowerCase() || "";
        const userAskedForWorkshops = /\b(workshop|workshops|class|classes|course|courses|taller|talleres)\b/i.test(lastUserMessage);
        
        if (userAskedForWorkshops && parsed.recommendations && Array.isArray(parsed.recommendations)) {
          const workshopKeywords = /\b(workshop|class|course|taller|masterclass|training|seminar|lesson|tutorial)\b/i;
          
          parsed.recommendations = parsed.recommendations.filter((rec: any) => {
            const titleHasWorkshop = workshopKeywords.test(rec.title || "");
            const descHasWorkshop = workshopKeywords.test(rec.description || "");
            
            const isJamSession = /\bjam\s+session\b/i.test(rec.title || "");
            
            if (isJamSession) {
              console.log(`Filtering out jam session from workshop request: ${rec.title}`);
              return false;
            }
            
            return titleHasWorkshop || descHasWorkshop;
          });
          
          console.log(`After workshop filtering: ${parsed.recommendations.length} recommendations`);
          
          // Update the message to reflect filtered recommendations
          message = JSON.stringify(parsed);
        }

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
