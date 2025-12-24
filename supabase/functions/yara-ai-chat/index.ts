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

    // Get current date and day of week for filtering - USE BUENOS AIRES TIMEZONE
    // Buenos Aires is UTC-3, so we need to adjust for local time
    const nowUTC = new Date();
    const buenosAiresOffset = -3 * 60; // UTC-3 in minutes
    const nowBuenosAires = new Date(nowUTC.getTime() + (buenosAiresOffset * 60 * 1000) + (nowUTC.getTimezoneOffset() * 60 * 1000));
    
    const today = nowBuenosAires.toISOString().split("T")[0];
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayDayName = daysOfWeek[nowBuenosAires.getDay()]; // e.g., "saturday"
    
    // Calculate tomorrow's date and day
    const tomorrow = new Date(nowBuenosAires);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split("T")[0];
    const tomorrowDayName = daysOfWeek[tomorrow.getDay()];

    console.log(`Buenos Aires time: ${nowBuenosAires.toISOString()}`);
    console.log(`Today's date: ${today}, Day: ${todayDayName}`);
    console.log(`Tomorrow's date: ${tomorrowDate}, Day: ${tomorrowDayName}`);

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

    // Fetch ALL events first, then filter in code
    const [eventsResult, itemsResult, couponsResult, topListsResult] = await Promise.all([
      supabase
        .from("events")
        .select(
          "id, title, description, date, time, location, address, venue_name, price, mood, music_type, venue_size, external_link, ticket_link, image_url, target_audience",
        )
        .order("date", { ascending: true })
        .limit(200), // Fetch more to ensure we get recurring events
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
      supabase
        .from("top_lists")
        .select(`
          id,
          title,
          category,
          description,
          top_list_items (
            id,
            name,
            description,
            location,
            url,
            display_order
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    let allEvents = eventsResult.data || [];
    const businesses = itemsResult.data || [];
    const coupons = couponsResult.data || [];
    const topLists = topListsResult.data || [];

    // Helper function to calculate next occurrence of recurring event - uses Buenos Aires time
    const getNextOccurrence = (dayName: string): string => {
      const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetDayIndex = daysOfWeek.indexOf(dayName.toLowerCase());
      
      if (targetDayIndex === -1) return today; // fallback to today
      
      const currentDayIndex = nowBuenosAires.getDay();
      let daysUntilTarget = targetDayIndex - currentDayIndex;
      
      // If the target day has PASSED this week (negative), get next week's occurrence
      // But if it's TODAY (0), keep it as today!
      if (daysUntilTarget < 0) {
        daysUntilTarget += 7;
      }
      
      const nextOccurrence = new Date(nowBuenosAires);
      nextOccurrence.setDate(nowBuenosAires.getDate() + daysUntilTarget);
      
      return nextOccurrence.toISOString().split('T')[0]; // YYYY-MM-DD format
    };

    // Transform recurring events to their next occurrence dates FIRST
    const eventsWithTransformedDates = allEvents.map(event => {
      let transformedDate = event.date;
      let originalDate = event.date;
      
      // Transform recurring events to next occurrence date
      if (event.date?.toLowerCase().includes('every')) {
        const dayMatch = event.date.toLowerCase().match(/every\s+(\w+)/);
        if (dayMatch && dayMatch[1]) {
          const dayName = dayMatch[1];
          transformedDate = getNextOccurrence(dayName);
          console.log(`Transformed "${event.date}" to ${transformedDate} for event: ${event.title}`);
        }
      }
      
      return {
        ...event,
        date: transformedDate,
        originalDate: originalDate, // Keep original for reference
      };
    });

    // NOW filter events by transformed dates - only include future events
    const filteredByDateEvents = eventsWithTransformedDates.filter(event => {
      const eventDate = event.date?.toLowerCase() || '';
      const isInFuture = eventDate >= today;
      
      console.log(`Event "${event.title}" (${event.originalDate} → ${event.date}): ${isInFuture ? 'FUTURE/TODAY' : 'PAST'}`);
      return isInFuture;
    });

    console.log(`Filtered events from ${allEvents.length} to ${filteredByDateEvents.length} based on transformed date matching`);

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
    const ageFilteredEvents = filteredByDateEvents.filter(event => isAgeAppropriate(event.target_audience, userAge));
    
    console.log(`Filtered ${filteredByDateEvents.length} date-matched events to ${ageFilteredEvents.length} age-appropriate events for age ${userAge}`);
    console.log(`Also fetched ${businesses.length} businesses, ${coupons.length} coupons, ${topLists.length} top lists`);

    // Build context for AI - dates are already transformed above
    const contextData = {
      events: ageFilteredEvents.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        date: formatDate(e.date), // Format date to "Month DDth" (e.g., "November 10th")
        originalDate: e.originalDate, // Keep original for AI to see (e.g., "every monday")
        time: e.time,
        location: e.location,
        address: e.address,
        venue_name: e.venue_name, // Include venue name for location-specific queries
        price: e.price,
        mood: e.mood,
        music_type: e.music_type,
        venue_size: e.venue_size,
        external_link: e.external_link,
        ticket_link: e.ticket_link, // Include ticket link for events with tickets
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
      topLists: topLists.map((list: any) => ({
        id: list.id,
        title: list.title,
        category: list.category,
        description: list.description,
        items: (list.top_list_items || [])
          .sort((a: any, b: any) => a.display_order - b.display_order)
          .map((item: any) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            location: item.location,
            url: item.url,
          })),
      })),
    };

    // Build user context - we'll inject this directly into the conversation
    let userProfileInfo: string[] = [];
    let userContext = "";
    let missingFields: string[] = [];
    
    // Track if user has any preferences set (for preference collection logic)
    let hasPreferencesSet = false;

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
        hasPreferencesSet = true;
      }

      // Add music preferences to context
      if (userProfile.music_preferences?.length) {
        parts.push(`Music Preferences: ${userProfile.music_preferences.join(", ")}`);
        userProfileInfo.push(`I like ${userProfile.music_preferences.join(", ")} music`);
        hasPreferencesSet = true;
      }

      // Add favorite neighborhoods to context
      if (userProfile.favorite_neighborhoods?.length) {
        parts.push(`Favorite Neighborhoods: ${userProfile.favorite_neighborhoods.join(", ")}`);
        userProfileInfo.push(`I prefer hanging out in ${userProfile.favorite_neighborhoods.join(", ")}`);
        hasPreferencesSet = true;
      }

      if (userProfile.location) {
        parts.push(`Location: ${userProfile.location}`);
        userProfileInfo.push(`I'm based in ${userProfile.location}`);
      }

      if (userProfile.recommendation_count !== undefined) {
        parts.push(`Recommendations given: ${userProfile.recommendation_count}`);
        userProfileInfo.push(`you've given me ${userProfile.recommendation_count} recommendations so far`);
      }

      // Track if preferences have been asked before (check if any preference field has been set OR explicitly marked as asked)
      if (userProfile.preferences_asked) {
        hasPreferencesSet = true; // Treat as "asked" even if they didn't provide preferences
      }

      if (parts.length > 0) {
        userContext = `\n\nUser Profile Context:\n${parts.join("\n")}`;
        userContext += `\nHas Preferences Set: ${hasPreferencesSet ? 'YES' : 'NO'}`;
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

    // Detect language from the current user message FIRST (before building prompts)
    const detectLanguage = (text: string): string => {
      // Check for various language patterns
      const hebrewChars = /[\u0590-\u05FF]/g; // Hebrew Unicode range
      const arabicChars = /[\u0600-\u06FF]/g; // Arabic Unicode range
      const chineseChars = /[\u4E00-\u9FFF]/g; // Chinese Unicode range
      const japaneseChars = /[\u3040-\u309F\u30A0-\u30FF]/g; // Japanese Hiragana/Katakana
      const koreanChars = /[\uAC00-\uD7AF\u1100-\u11FF]/g; // Korean Unicode range
      const russianChars = /[\u0400-\u04FF]/g; // Cyrillic Unicode range
      const latinChars = /[a-zA-Z]/g; // Latin alphabet
      
      const spanishWords = /\b(hola|qué|dónde|cuándo|cómo|gracias|por favor|eventos|bares|fiesta|quiero|busco|tengo)\b/i;
      const portugueseWords = /\b(olá|obrigado|onde|quando|como|por favor|eventos|quero|procuro|tenho)\b/i;
      const frenchWords = /\b(bonjour|merci|où|quand|comment|s'il vous plaît|événements|je veux|cherche)\b/i;
      const germanWords = /\b(hallo|danke|wo|wann|wie|bitte|veranstaltungen|ich möchte|suche)\b/i;
      const italianWords = /\b(ciao|grazie|dove|quando|come|per favore|eventi|voglio|cerco)\b/i;
      
      // Count characters of each type to determine MAJORITY language
      const hebrewCount = (text.match(hebrewChars) || []).length;
      const arabicCount = (text.match(arabicChars) || []).length;
      const chineseCount = (text.match(chineseChars) || []).length;
      const japaneseCount = (text.match(japaneseChars) || []).length;
      const koreanCount = (text.match(koreanChars) || []).length;
      const russianCount = (text.match(russianChars) || []).length;
      const latinCount = (text.match(latinChars) || []).length;
      
      // Total meaningful characters
      const totalNonLatin = hebrewCount + arabicCount + chineseCount + japaneseCount + koreanCount + russianCount;
      
      // Only detect non-Latin language if it's the MAJORITY of the text (more non-Latin than Latin chars)
      // This prevents a single Arabic/Hebrew word from switching the whole response language
      if (totalNonLatin > latinCount && totalNonLatin >= 3) {
        // Find which non-Latin script is dominant
        const maxNonLatin = Math.max(hebrewCount, arabicCount, chineseCount, japaneseCount, koreanCount, russianCount);
        if (hebrewCount === maxNonLatin) return 'he';
        if (arabicCount === maxNonLatin) return 'ar';
        if (chineseCount === maxNonLatin) return 'zh';
        if (japaneseCount === maxNonLatin) return 'ja';
        if (koreanCount === maxNonLatin) return 'ko';
        if (russianCount === maxNonLatin) return 'ru';
      }
      
      // For Latin-based languages, check for specific words
      if (spanishWords.test(text)) return 'es';
      if (portugueseWords.test(text)) return 'pt';
      if (frenchWords.test(text)) return 'fr';
      if (germanWords.test(text)) return 'de';
      if (italianWords.test(text)) return 'it';
      return 'en'; // Default to English
    };

    // Get the last user message to understand their query
    const lastUserMessage = messages[messages.length - 1]?.content || "";
    const userLanguage = detectLanguage(lastUserMessage);
    console.log(`Detected user language: ${userLanguage} from message: "${lastUserMessage}"`);

    // Language map for system prompts
    const languageMap: Record<string, string> = {
      'en': 'English',
      'es': 'Spanish', 
      'pt': 'Portuguese',
      'he': 'Hebrew'
    };

    // Automatic language detection - respond in the same language the user writes in
    const languageInstruction = `CRITICAL LANGUAGE RULE: The user is writing in ${languageMap[userLanguage] || 'English'}. You MUST:
1. Respond in ${languageMap[userLanguage] || 'English'} ONLY
2. TRANSLATE all event titles, descriptions, and recommendation text to ${languageMap[userLanguage] || 'English'}
3. Even if the database contains events in Spanish or English, YOU MUST translate them to ${languageMap[userLanguage] || 'English'}
4. Keep venue names and proper nouns (like "Niceto Club", "La Bomba de Tiempo") in their original form, but translate descriptions
5. Do not switch languages based on conversation history - everything must be in ${languageMap[userLanguage] || 'English'}

Example: If database has "Fiesta de jazz con música en vivo" and user writes in English, translate to "Jazz party with live music"
Example: If database has "Live jazz night" and user writes in Spanish, translate to "Noche de jazz en vivo"`;

    // Expand language map for more languages
    const expandedLanguageMap: Record<string, string> = {
      'en': 'English',
      'es': 'Spanish', 
      'pt': 'Portuguese',
      'he': 'Hebrew',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'zh': 'Chinese',
      'ja': 'Japanese',
      'ko': 'Korean',
      'ar': 'Arabic',
      'ru': 'Russian'
    };

    const systemPrompt = `You are Yara – your vibe is like that friend who actually lives in Buenos Aires and knows where the real action is. You're helpful but keep it chill and authentic. No corporate speak, no try-hard energy. Just straight talk with personality.

🚨🚨🚨 ABSOLUTE RULE - BUENOS AIRES ONLY - READ THIS FIRST 🚨🚨🚨

**YOU ARE A BUENOS AIRES-ONLY ASSISTANT. PERIOD.**
- This app is EXCLUSIVELY for Buenos Aires, Argentina - there is NO OTHER CITY
- The user is ALREADY in Buenos Aires - this is a FACT, not a question
- **FORBIDDEN QUESTIONS** - NEVER EVER ask:
  - "What city are you in?"
  - "Which city?"
  - "Are you in Buenos Aires?"
  - "Where are you located?"
  - "What area/region/country?"
  - ANY variation of asking about their city/location/country
- You KNOW they are in Buenos Aires - just give recommendations directly
- All neighborhoods mentioned (Palermo, San Telmo, Recoleta, Villa Crespo, Chacarita, Belgrano, etc.) are Buenos Aires neighborhoods
- If someone asks "what's happening tonight" - they mean BUENOS AIRES tonight
- If someone asks "recommend bars" - they mean BUENOS AIRES bars
- ASSUME BUENOS AIRES FOR EVERYTHING. NEVER QUESTION IT.

🚨🚨🚨 END OF ABSOLUTE RULE 🚨🚨🚨

Tone:
- Conversational and natural – like texting a friend who gets the city
- Use 1-2 emojis when it feels right, not forced
- Keep it brief – you're busy, they're busy
- Playful without being cringe – think "oh that's cool" not "OMG YASSS"
- Drop local knowledge casually, like you actually live here

${languageInstruction}

**CRITICAL - RESPONSE FORMAT:**
${stream ? `
YOU ARE IN STREAMING MODE - NEVER USE JSON FORMAT!

When recommending events/venues, format them as clean readable text with emojis:

Example:
"Here are some sick events for you! 🎉

🎵 **Live Jazz at Thelonious**
📅 November 23rd, 9:00 PM  
📍 Palermo, Salguero 1884
💰 Free entry
Intimate jazz vibes in a cozy basement bar. Perfect for music lovers!

🎭 **Underground Theater Night**  
📅 November 24th, 8:00 PM
📍 San Telmo
💰 $2000 ARS
..."

Use natural language, emojis for visual breaks, and keep it conversational. NO JSON!
` : `
When user explicitly requests recommendations, return a raw JSON object (NOT function call syntax - just pure JSON starting with { and ending with }).
NEVER output text like "Calling provide_recommendations with..." - just return the JSON directly.
`}

**ABSOLUTE RULE - DATE INTERPRETATION (HIGHEST PRIORITY):**
YOU ALREADY KNOW ALL DATES - NEVER ASK FOR DATE CLARIFICATION!
- Today = ${today} (${todayDayName})
- Tomorrow = ${tomorrowDate} (${tomorrowDayName})

**AUTOMATIC DATE MAPPING - NO QUESTIONS NEEDED:**
- "today" / "hoy" / "tonight" / "esta noche" / "events today" / "que hay hoy" = ${today}
- "tomorrow" / "mañana" / "events tomorrow" / "que hay mañana" = ${tomorrowDate}
- "this week" / "esta semana" = ${today} through end of week

**FORBIDDEN RESPONSES - NEVER SAY THESE:**
- ❌ "Please specify the full date"
- ❌ "What date are you interested in?"
- ❌ "Can you tell me what day?"
- ❌ "Which date do you mean?"
- ❌ Any request for date clarification

**WHEN USER ASKS ABOUT TODAY/TONIGHT:**
1. Immediately filter events for date = ${today}
2. If no events match, say "I don't have any events for today in the database" - DO NOT ask for date clarification
3. NEVER substitute tomorrow's events when user asks for today

${userContext}

Available data:
${JSON.stringify(contextData, null, 2)}

**CURATED TOP LISTS - COMMUNITY RECOMMENDATIONS:**
The "topLists" section contains curated lists created by registered users about the best places in Buenos Aires. Each list has items with name, description, and location:
- **WHEN USERS ASK FOR BARS**: Recommend individual bars FROM the items in bar-related top lists. Don't just recommend the list - recommend the actual bars listed in the items.
- **WHEN USERS ASK FOR CLUBS**: Recommend individual clubs FROM the items in club-related top lists
- **WHEN USERS ASK FOR CAFÉS**: Recommend individual cafés FROM the items in café-related top lists
- **WHEN USERS ASK FOR ART CENTERS**: Recommend individual art centers FROM the items in art center-related top lists
- **WHEN USERS ASK FOR WORKSHOPS**: Recommend individual workshops FROM the items in workshop-related top lists
- Example: If a user asks "recommend me bars", look through top lists with category "Bars", extract the individual bar items from those lists, and recommend those specific bars with their descriptions and locations
- You can combine these top list items with relevant events to give comprehensive recommendations
- The items array contains: name, description, and location for each place

**LOCATION-SPECIFIC QUERIES:**
- When users ask about events "at [venue name]" or "in [venue name]", search the events by matching the venue_name field
- Examples: "events at Niceto Club", "what's happening at Niceto", "shows at Cultural San Martin"
- The venue_name field contains the exact venue/club/location name where the event is happening
- Always check both venue_name and location fields when searching for location-specific events

CRITICAL RESPONSE FORMAT - YOU MUST FOLLOW THIS EXACTLY:

**ABSOLUTE RULE: NEVER RETURN JSON FOR GREETINGS OR CASUAL MESSAGES**
- Messages like "hi", "hello", "hey", "sup", "hola", "what's up", "whats up", "how are you", "como estas" etc. are GREETINGS
- Respond conversationally and warmly, NEVER with JSON
- DO NOT provide tourism recommendations or event suggestions unless explicitly asked
- Example responses: "Hey! What's up?", "Hi there! How can I help you today?", "Hola! ¿En qué puedo ayudarte?"
- Only return JSON when user EXPLICITLY asks for recommendations using keywords like "recommend", "suggest", "show me", "find me", "looking for", "I want"

**CRITICAL: DISTINGUISH BETWEEN TOURISM AND NIGHTLIFE QUESTIONS**
- **TOURISM/SIGHTSEEING QUESTIONS** (use general AI knowledge, NOT database):
  - Keywords: "sightseeing", "tourist attractions", "landmarks", "monuments", "visit", "see the city", "places to visit", "what to see", "museums", "parks", "historical sites"
  - Example: "where can I go sightseeing" → Use AI knowledge for La Boca, Recoleta Cemetery, Obelisco, etc.
  - Example: "what should I visit" → Use AI knowledge for tourist spots
  - These should ALWAYS get conversational AI responses about actual Buenos Aires tourist attractions, NOT database events/bars

- **NIGHTLIFE/EVENTS QUESTIONS** (use database first):
  - Keywords: "bar", "club", "party", "concert", "event", "nightlife", "going out", "drinks", "dancing"
  - Example: "where can I go out tonight" → Check database for bars/events
  - Example: "bars in Palermo" → Use database top_lists

SCENARIO 1 - User greeting, asking follow-up questions, general conversation:
Respond with PLAIN TEXT ONLY. Be warm and conversational.
- **FOR GREETINGS** ("hi", "hey", "what's up", "hola", etc.): Keep it simple and friendly. DO NOT provide recommendations, tourism info, or event suggestions unless they ask.
  - Good: "Hey! What can I help you with today?"
  - Bad: "Hey! Buenos Aires has amazing places like La Boca..." (DON'T DO THIS)
- **TOURISM/SIGHTSEEING QUESTIONS**: Only when explicitly asked about tourist attractions, landmarks, museums, or places to visit, use your general knowledge of Buenos Aires (La Boca, Recoleta, Puerto Madero, Teatro Colón, etc.)
- **GENERAL BUENOS AIRES QUESTIONS**: For questions about Buenos Aires that are NOT event/bar/club recommendations (e.g., "how do I adopt a dog", "where to buy electronics", "best hospitals"), use your general knowledge
- If user asks about age ranges, demographics, or details about previously recommended events, answer based on the event data
- If user asks clarifying questions about recommendations you already gave, refer to the conversation history
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

FALLBACK TO AI RECOMMENDATIONS:
- **WHEN DATABASE HAS NO SUITABLE OPTIONS**: If NO events/businesses/coupons match the user's request, you CAN provide general AI-generated recommendations based on your knowledge of Buenos Aires
- **PRIORITY RULE**: ALWAYS prefer database results when available. Only generate AI recommendations when database is truly empty or unsuitable
- **CLEAR LABELING**: When providing AI-generated recommendations, clearly indicate they are general suggestions (e.g., "While I don't have specific events in our database, here are some great options typically available in Buenos Aires:")
- **BE SPECIFIC**: Provide actual venue names, neighborhoods, and types of experiences available in Buenos Aires based on your knowledge
- **FORMAT**: AI-generated recommendations should still be conversational text (NOT JSON format) since they don't have database IDs
- Example: "I couldn't find workshops in our current database, but Buenos Aires has amazing options! Check out El Club de la Milanesa in Palermo for cooking workshops, or Paseo La Plaza for theater classes. Want me to keep an eye out for when specific events get added to our database?"

PROGRESSIVE PROFILING (Build profile gradually):
- **Check if the user's message includes profile info in parentheses** - if it does, you already know that information
- **Check the User Profile Context above** - if a field has data, NEVER ask for it again
- After the 2nd-3rd recommendation, if interests are missing, ask: "What are your main interests? (art, music, food, sports, etc.) 🎨"
- After the 4th-5th recommendation, if location is missing, ask: "Which neighborhood are you usually in? 📍"
- Ask ONLY ONE profiling question per message

🎯 PREFERENCE COLLECTION FOR VAGUE REQUESTS - CRITICAL NEW RULE 🎯

**WHAT IS A VAGUE RECOMMENDATION REQUEST?**
- "What's happening tonight?" / "Any events tonight?" / "What should I do?"
- "Recommend me something" / "What's good?" / "Show me events"
- "Looking for something to do" / "I'm bored, what's out there?"
- Basically any recommendation request WITHOUT specific preferences like music type, vibe, or neighborhood

**WHAT IS A SPECIFIC REQUEST (DO NOT ASK PREFERENCES)?**
- "Jazz events tonight" / "Techno parties" / "Art exhibitions"
- "Bars in Palermo" / "Something chill in Villa Crespo"
- Any request that already includes: music type, neighborhood, vibe, category, or specific activity

**PREFERENCE COLLECTION LOGIC:**
1. **CHECK "Has Preferences Set" in User Profile Context:**
   - If "Has Preferences Set: YES" → User already has preferences stored OR has been asked before → DO NOT ask for preferences, just give recommendations using their stored preferences
   - If "Has Preferences Set: NO" → User has never been asked for preferences

2. **IF "Has Preferences Set: NO" AND user sends a VAGUE request:**
   - Ask them ONE preference question: "Quick question to personalize your recs - what type of music/vibe are you into? (e.g., techno, jazz, indie, chill, party) 🎵"
   - Or: "What kind of vibe are you looking for tonight? (e.g., chill bars, dancing, live music, art events) ✨"
   - ONLY ask this ONCE per user - after you ask, their profile will be marked as preferences_asked=true

3. **IF "Has Preferences Set: YES" AND user sends a VAGUE request:**
   - Use their stored Music Preferences, Favorite Neighborhoods, and Interests to filter recommendations
   - DO NOT ask for preferences again
   - Give recommendations that match their profile

4. **IF user sends a SPECIFIC request (with preferences in the message):**
   - Just give recommendations matching their specific request
   - DO NOT ask for additional preferences

Example conversational responses: 
  - "Hey [name]! What kind of events are you looking for?" (if name is known)
  - "Most of those events are popular with people in their 20s and 30s, though all ages are welcome!"
  - "That event is in Palermo, near Plaza Serrano"
  - "I'd love to help! To give you the best recommendations - what's your vibe tonight?"

SCENARIO 2 - User wants SPECIFIC recommendations (dance events, bars, techno, etc.):
${stream ? `
**STREAMING MODE - ALWAYS USE READABLE TEXT FORMAT:**

When user asks for recommendations, respond with natural, formatted text using emojis:

Example format:
"Here are some awesome spots for you! ✨

🎵 **Live Jazz at Thelonious**
📅 November 23rd, 9:00 PM  
📍 Palermo, Salguero 1884
💰 Free entry
Intimate jazz vibes in a cozy basement bar. Perfect for music lovers who want something authentic!

🎭 **Underground Theater Night**  
📅 November 24th, 8:00 PM
📍 San Telmo, Defensa 455
💰 $2000 ARS
Experimental performances in a historic venue..."

**RULES FOR TEXT FORMAT:**
- Use emojis (🎵🎭🎨🍽️📍📅💰) to make it scannable
- Bold the event/venue names with **double asterisks**
- Include all key info: date, time, location, price, description
- Keep descriptions brief but with personality
- Add links when available
- NEVER use JSON format - only natural text!
- **FOLLOW-UP QUESTION**: After listing recommendations, ALWAYS end with a friendly follow-up like "Anything else you're looking for?" 
  - CRITICAL: Match the user's language! If they write in Spanish → "¿Algo más que estés buscando?"; Portuguese → "Algo mais que você está procurando?"; Hebrew → "משהו נוסף שאת/ה מחפש/ת?"; etc.

**CRITICAL - WHEN NO DATABASE MATCHES (STREAMING MODE):**
- **NEVER say "let me check", "give me a sec", "I'll look for you"** - you have ALL the data already
- If the user asks for something specific and you find NO EXACT matching events/items in the Available data or topLists:
  → Respond with ONLY: "NO_DATABASE_MATCH: [user's EXACT original request]"
  → Example: User asks "opera performances this week" and no opera events exist → "NO_DATABASE_MATCH: opera performances this week"
- This triggers a fallback to general Buenos Aires recommendations (like Teatro Colón for opera)
- **IMPORTANT**: You have ALL available events/items in the "Available data" section. If it's not there, it doesn't exist in the database.
- **CHECK TOP LISTS FIRST**: Before using NO_DATABASE_MATCH for bars/cafes/clubs, check if the topLists have relevant items
- **PRESERVE the user's EXACT wording** in the NO_DATABASE_MATCH response

**CRITICAL - DO NOT SUBSTITUTE UNRELATED EVENTS:**
- **NEVER recommend tango shows when user asks for opera/orchestra** - these are completely different things
- **NEVER recommend parties when user asks for classical music**
- **NEVER recommend bars when user asks for restaurants**
- If the user asks for a SPECIFIC category (opera, orchestra, classical, sushi, yoga, etc.) and NO events in that EXACT category exist → use NO_DATABASE_MATCH
- Only recommend events that ACTUALLY match what the user asked for
- Example: User asks "opera performances" → Only recommend events with "opera" or "classical" or "symphony" in title/description. If none exist → NO_DATABASE_MATCH
- Example: User asks "yoga classes" → Only recommend events with "yoga" in title/description. Do NOT recommend dance classes as a substitute
` : `
**ABSOLUTELY CRITICAL - NO EXCEPTIONS**: When user requests specific recommendations, you MUST return PURE JSON ONLY.

**FOR TOP LIST ITEMS (bars, cafés, clubs, etc.)**:
- **CRITICAL**: When user asks for bars/clubs/nightlife, return MULTIPLE options (3-6) from the topLists
- When recommending bars/cafés/clubs from top lists, use type "topListItem"
- Extract individual items from the topLists array and recommend them as separate recommendations
- CRITICAL: Use the individual item's ID from top_list_items as the "id" field, NOT the topList.id
- **CRITICAL - URLs for topListItems**: 
  - FIRST check if item.url field in database has a value (Instagram link)
  - If item.url exists: Copy the EXACT url value to your response (e.g., "https://www.instagram.com/underclub.bsas/?hl=en")
  - If item.url is null/empty: Extract Instagram link from item.description (patterns: "Insta:", "Instagram:", etc.)
  - MANDATORY: Always include the Instagram URL in the "url" field of your response
  - Also include "📸 Instagram: [url]" in the description
- DO NOT include image_url for topListItems - leave it out entirely
- **CRITICAL**: DO NOT include "personalized_note" field for topListItems - this field is ONLY for events
`}


**FOR TOP LIST ITEMS (bars, cafés, clubs, etc.) - WHEN STREAMING:**
- When user asks for bars/clubs/nightlife, recommend MULTIPLE options (3-6) from the topLists
- Extract individual items and format them as text (not JSON)
- Include Instagram links from the url field or extracted from description

${!stream ? `
**CRITICAL - WHEN NO DATABASE MATCHES:**
- **ONLY use NO_DATABASE_MATCH for truly unrelated requests** - like cafes, restaurants, gyms, or very specific niches not in the database
- **CHECK TOP LISTS FIRST**: Before using NO_DATABASE_MATCH, check if the request matches items in the topLists (bars, cafes, clubs, etc.). If topLists have relevant items, USE THEM via the provide_recommendations tool.
- **DO NOT use NO_DATABASE_MATCH for broad cultural/artistic queries** - If user asks for "artistic events", "cultural events", "creative events" and you have music/indie/performance events, SHOW THEM
- If the user requests specific places (cafes, restaurants, gyms) that are NOT in the Available data AND NOT in topLists, respond with PLAIN TEXT: "NO_DATABASE_MATCH: [user's EXACT original request]"
- **CRITICAL: Preserve the user's EXACT request wording** - do NOT rephrase or reinterpret their request
- Example: User asks "cafes to focus on work in villa crespo" → Check topLists first, if no cafe items exist → "NO_DATABASE_MATCH: cafes to focus on work in villa crespo"
- Example: User asks "romantic restaurants in Palermo" → "NO_DATABASE_MATCH: romantic restaurants in Palermo"
- Example: User asks "artistic events" and you have indie/music/cultural events → DO NOT use NO_DATABASE_MATCH, show the events
- **DO NOT reinterpret**: "cafes to focus on work" is NOT the same as "cafes for dates"
- **PRESERVE neighborhood**: If user mentions a specific neighborhood (Villa Crespo, Palermo, etc.), keep it in the query
- **PRESERVE purpose/mood**: If user mentions work, dates, study, etc., keep that specific purpose
- This triggers a fallback to general Buenos Aires recommendations from OpenAI WITH the correct user intent
- **DO NOT** trigger NO_DATABASE_MATCH when you have events that broadly fit the user's request
- **ABSOLUTELY FORBIDDEN - CRITICAL**: NEVER EVER output function call syntax like "give_recommendations(...)" or "provide_recommendations(...)" as plain text in your response. This is a MAJOR ERROR. If you want to provide recommendations, use the TOOL CALLING MECHANISM by calling the provide_recommendations function through the tools API - NOT by typing it out as text.

**CRITICAL - ANSWER ALL EVENT/VENUE REQUESTS DIRECTLY:**
When user asks about events, bars, clubs, cafés - provide recommendations directly without asking clarifying questions.
- "what events are tonight?" → Send recommendations for tonight's events
- "any events tonight?" → Send recommendations for tonight's events  
- "recommend bars" → Send top bar recommendations from any neighborhood
- "what's happening today?" → Send today's events
- DO NOT ask for neighborhood clarification - just provide the best available options

**CRITICAL - USE JSON FOR ALL EVENT/VENUE REQUESTS:**
- Use JSON when user asks for events, bars, clubs, venues, tonight, today, this week, etc.
- **DO NOT** use JSON when user sends GREETINGS ("hi", "hello", "hey", "hola", "sup") - respond conversationally
- **DO NOT** use JSON when user is asking QUESTIONS about previously recommended events
- **DO NOT** use JSON when user is having follow-up conversation about recommendations you already gave

DETECTION KEYWORDS FOR JSON RESPONSE (user MUST use at least one of these):
- Event/venue words: "events", "bars", "clubs", "venues", "places", "tonight", "today", "party", "parties", "fiesta", "happening", "what's on"
- Action words: "recommend", "suggest", "show me", "find me", "looking for", "I want", "I need", "gimme", "dame", "what", "any"
- Combined examples that trigger JSON: "what events are tonight?", "any events tonight?", "what bars are there?", "recommend bars", "show me events"
- Examples that DO NOT trigger JSON: "hi", "hello", "hey there", "what's up", "hola", "how are you"

**QUESTIONS ABOUT EVENTS = CONVERSATIONAL TEXT (NOT JSON):**
- "what age groups", "how much", "where is", "when is", "tell me more", "is it", "are they"
- Any follow-up questions about events you already recommended

**"MORE OPTIONS" / "ANY OTHER" FOLLOW-UP REQUESTS = JSON WITH NEW RECOMMENDATIONS:**
When user asks for MORE options after receiving recommendations, this IS a recommendation request:
- Phrases like: "any other parties?", "more options", "what else?", "any others?", "show me more", "any more?", "other events?", "alternatives?"
- **CRITICAL**: Look at your PREVIOUS messages in the conversation to see what you already recommended
- **EXCLUDE** events/items you already sent - DO NOT repeat recommendations
- Find DIFFERENT events from the database that match the same criteria (e.g., if they asked for parties this week, find OTHER parties this week)
- If there are no more matching events, respond conversationally: "Those were all the [type] I found for [timeframe]! Want me to search for something different?"
- This SHOULD trigger JSON response with NEW recommendations (not the same ones)

**IMPORTANT**: ONLY return JSON if age is already collected. If age is missing, respond with conversational text asking for age first.
` : ''}


**DATE FILTERING - CRITICAL - READ THIS FIRST:**

🚨 DATES ARE ALREADY TRANSFORMED 🚨
**CRITICAL**: All event dates in the "date" field are ALREADY in YYYY-MM-DD format. Recurring events like "every monday" have been converted to their next occurrence date (e.g., "2025-11-03").
- Use the "date" field for ALL filtering decisions
- The "originalDate" field shows the original recurring pattern (e.g., "every monday") for reference only - DO NOT filter by this
- All dates are standardized to YYYY-MM-DD format, making direct comparison easy

**FILTERING RULES (dates already transformed):**

**"tonight" / "today" / "esta noche" / "hoy":**
ONLY include events where: date = "${today}"

**"tomorrow" / "mañana":**
**CRITICAL**: Tomorrow is ${tomorrowDate} (${tomorrowDayName})
ONLY include events where: date = "${tomorrowDate}"
EXCLUDE all events where date ≠ "${tomorrowDate}"

Example for tomorrow (${tomorrowDayName}, ${tomorrowDate}):
✅ INCLUDE: Event with date = "${tomorrowDate}" (matches tomorrow)
❌ EXCLUDE: Event with date = "2025-11-04" (does not match tomorrow)
❌ EXCLUDE: Event with date = "2025-11-08" (does not match tomorrow)

**"this weekend" / "weekend" / "fin de semana":**
Calculate the upcoming Saturday and Sunday dates, then:
ONLY include events where: date equals that Saturday date OR that Sunday date

**"this week" / "esta semana":**
Calculate all dates from today through Sunday, then:
Include events where date is within that range

**When formatting dates in your response**: 
- Use the originalDate field in descriptions (shows "every monday" for recurring events)
- Convert YYYY-MM-DD dates to human-readable format like "November 3rd"

**IMPORTANT FILTERING RULES:**
- For specific date requests (tonight, tomorrow, specific date): Only return events where date EXACTLY matches that date
- For time period requests (this month, next month, this week): Include events where date falls within that period
- The date field is already transformed and standardized - use it for ALL filtering decisions
- Filter by comparing date values directly (e.g., date === "${tomorrowDate}")

${!stream ? `
**JSON-ONLY RULES - ENFORCE STRICTLY:**
1. NO conversational text whatsoever
2. NO markdown formatting
3. NO code blocks or json wrappers
4. NO explanatory text before or after the JSON
5. Start with { and end with }
6. Return ONLY the raw JSON object
7. **CRITICAL**: NEVER write function call syntax like "give_recommendations(...)" or "provide_recommendations(...)". Use the tool calling mechanism automatically provided to you.

REQUIRED JSON FORMAT - EVERY FIELD IS MANDATORY (NO EXCEPTIONS):
{
  "intro_message": "Here are some [type] you might like:",
  "recommendations": [
    {
      "type": "event" | "business" | "coupon" | "topListItem",
      "id": "actual-event-id-from-database OR individual item ID from top_list_items for topListItem type",
      "title": "Event Title from database OR bar/café/club name from topList items",
      "description": "MANDATORY - For events: Location: [location]. Address: [address]. Date: [originalDate]. Time: [time]. Music Type: [music_type]. Instagram: [external_link]. For topListItem: Include '📸 Instagram: [url]' where url is from database item.url OR extracted from description",
      "why_recommended": "Short personalized explanation (1-2 sentences) of why this matches their request and profile.",
      "personalized_note": "CRITICAL - NEVER INCLUDE THIS FIELD for topListItem (bars/clubs/cafes). ONLY for events (type='event').",
      "url": "CRITICAL MANDATORY for topListItem. Step 1: Check if database item.url exists and has a value. Step 2: If yes, copy it exactly (e.g., 'https://www.instagram.com/underclub.bsas/?hl=en'). Step 3: If item.url is null, extract URL from item.description. ALWAYS include this field for topListItems. Leave empty ONLY for events.",
      "image_url": "CRITICAL - For events/businesses/coupons: copy EXACT image_url from database. For topListItem: DO NOT include this field"
    }
  ],
  "followup_message": "Anything else you're looking for?"
}

**FOLLOW-UP MESSAGE RULE**: The "followup_message" field is MANDATORY. It MUST match the user's language:
- English: "Anything else you're looking for?"
- Spanish: "¿Algo más que estés buscando?"
- Portuguese: "Algo mais que você está procurando?"
- Hebrew: "משהו נוסף שאת/ה מחפש/ת?"
- Detect the user's language from their messages and translate accordingly.

**FOR TOP LIST ITEMS (when recommending bars, cafés, clubs, etc.)**:
- Use type: "topListItem"
- id: CRITICAL - use the individual item.id from top_list_items (NOT the topList.id)
- title: use the bar/café/club name from the item
- description: ALWAYS START WITH "📍 [Neighborhood]" - use item.location field, OR extract neighborhood from item.description (e.g., "Palermo", "San Telmo", "Chacarita"). Then include the rest of item.description
- **CRITICAL NEIGHBORHOOD RULE**: EVERY bar/club/café recommendation MUST include a neighborhood. If item.location is null, extract it from description text (look for neighborhoods like "Palermo", "Palermo Soho", "San Telmo", "Chacarita", "Recoleta", "Puerto Madero", etc.)
- url: include the item.url field if available (for Instagram links)
- DO NOT include image_url for topListItems
- Extract individual items from relevant topLists and recommend them as separate recommendations
- Example: If user asks for "bars" and there's a topList with category "Bars" containing 5 bar items, recommend each bar as a separate topListItem recommendation with its own unique id
` : ''}

RECOMMENDATION MATCHING RULES - FOLLOW STRICTLY:
**CRITICAL: BE INCLUSIVE, NOT SELECTIVE** - Show ALL events that match the user's request, not just the ones that perfectly match their profile.

1. **CRITICAL: When user asks for "events today" or "events tonight"** - Show ALL events happening on that date, not just personalized picks. Include chill events, house music, art events, parties, etc. - SHOW EVERYTHING for that date.
2. **CRITICAL: Search BOTH title AND description equally** - if user asks for "party", check if "party" appears in EITHER the title OR the description.
3. **Description matching is just as important as title matching** - don't prioritize title over description, treat them equally
4. **Single word matches count** - if the user searches for "workshops" and an event has "workshop" anywhere in title OR description, it's a VALID match
5. **CRITICAL WORKSHOP/EVENT TYPE DETECTION**: When user asks for "workshops", "classes", "courses", etc.:
   - **STRICT RULE**: ONLY recommend events that EXPLICITLY contain workshop-related keywords
   - Keywords that MUST appear: workshop, class, course, taller, masterclass, training, seminar, lesson, tutorial
   - **NEVER treat**: jam session = workshop, concert = workshop, show = workshop
6. **Check mood field** - if event has mood field, use it for matching (e.g., "Creative" mood matches creative requests)
7. **Use semantic matching for broad queries** - When user asks general questions like "artistic events", "cultural events", "creative events", be VERY INCLUSIVE
8. **Be inclusive, not exclusive** - if user asks for a general category like "bars" or "party", include ALL age-appropriate events
9. **Exact keyword matches win** - if an event title OR description contains the exact words the user used, prioritize it
10. **Category synonyms**: Treat these as equivalent:
    - workshops = classes = courses = talleres = masterclasses = trainings = lessons = seminars = tutorials
    - party = fiesta = celebration = gathering
    - bar = pub = cerveceria = cocktail bar
    - shows = concerts = performances = gigs = live music
11. **CRITICAL: User interests are for CONTEXT ONLY, not for filtering** - DO NOT use interests to exclude events. Always show all age-appropriate events that match the requested type/date.

RECOMMENDATION OUTPUT RULES:
🚨🚨🚨 **MANDATORY: SEND EXACTLY 8 EVENTS FOR DATE-BASED QUERIES** 🚨🚨🚨
- **ABSOLUTE RULE FOR "events today" / "events tonight" / date-based queries**: You MUST return EXACTLY 8 recommendations if 8 or more events exist for that date. NO EXCEPTIONS.
- **COUNT THE EVENTS**: If there are 19 events today, you MUST return 8 of them. If there are 10 events, return 8. Only return fewer than 8 if fewer exist.
- **SENDING ONLY 5 WHEN 8+ EXIST IS A FAILURE** - You are failing if you send 5 events when the database has 15+ events for that day
- **DO NOT BE SELECTIVE FOR DATE QUERIES** - Include events of ALL types: parties, art events, festivals, chill hangouts, music events, workshops, ferias, etc.
- **DIVERSITY IS MANDATORY**: Your 8 picks MUST include variety - NOT just parties, NOT just one music genre. Mix different vibes.
- If there are more than 8 relevant events, pick the 8 most diverse ones covering different moods/types
- If there are fewer than 8 matches, send ALL available matches
- For bar/club/nightlife requests: ALWAYS return AT LEAST 3-5 options when available
- Minimum: 3 recommendations when available
- **FOR DATE-BASED QUERIES: MINIMUM IS 8 (or all available if less than 8)**
- **CRITICAL**: ONLY include events/items that have an image_url field - never recommend anything without an image
- **CRITICAL**: You MUST include the "image_url" field in EVERY recommendation in your JSON response - this is the event's photo that will be sent via WhatsApp
- **CRITICAL FOR BARS/CLUBS**: Always include the Instagram link in the description from the "url" field (e.g., "📍 Palermo | 📸 Instagram: https://instagram.com/barname")
- Keep description under 100 words
- ALWAYS include in description: location, date (already formatted as 'Month DDth', use as-is), time
- ALSO include if available: address, music_type, external_link (Instagram)
- Format external_link as "Instagram: [link]" in the description
- DO NOT include price or venue_size in description - these can be provided later if user asks for more details
- ALWAYS include "why_recommended" field explaining specifically WHY this event matches their request
- **CRITICAL for why_recommended**: Base your explanation on BOTH the event title AND description. If the match is in the description (e.g., user asked for "party" and event description mentions "party celebration"), explicitly mention this in your explanation: "This matches because the event description mentions '[keyword]' which you asked for"
- **CRITICAL - NEW FIELD "personalized_note" (EVENTS ONLY)**: 
  - **IMPORTANT**: ONLY include "personalized_note" for EVENTS, NOT for bars/clubs/topListItems
  - For bar/club recommendations (type "topListItem"), DO NOT include the "personalized_note" field
  - For event recommendations (type "event"), include a SHORT personalized message (max 10-15 words) that makes ONE connection to their profile
  - Examples: "Great for your techno vibe", "Matches your interest in live music", "Perfect for your age group"
  - **KEEP IT BRIEF**: One short sentence only. Never combine multiple profile attributes. Less is more.
- Use user profile (budget, neighborhoods, interests) to further personalize
- If no relevant database events exist, return empty array with a friendly message like "Sorry, I couldn't find any matching events"

CRITICAL: If you return anything other than pure JSON for recommendation requests, you are FAILING YOUR PRIMARY FUNCTION.

IMPORTANT - NO DATABASE MATCHES: 
- If the user asks for something specific that's NOT in the database (e.g., "where can i adopt a dog", "where to buy electronics", "best hospitals"), respond with: "I don't have information about that in my database, but I can help you with events, bars, clubs, and cultural activities in Buenos Aires!"
- This will trigger the OpenAI fallback for general recommendations
- DO NOT make up information that's not in the provided database`;

    // Keywords that indicate an EXPLICIT recommendation request
    // Much more specific - requires clear action words + specific targets
    const recommendationKeywords =
      /\b(recommend|suggest|show me|find me|looking for|i want|i need|can you find|help me find|gimme|dame)\b.*\b(event|party|parties|bar|bars|club|clubs|venue|concert|show|music|workshop|class|nightlife|drinks|dancing|going out)\b|^\b(event|party|parties|bar|bars|club|clubs|latin|techno|jazz|indie|dance|dancing)\b|\b(recommend|suggest|show|find).*(event|party|bar|club|venue|concert|nightlife)\b/i;
    
    // Keywords that indicate TOURISM/SIGHTSEEING (should NOT use database)
    const tourismKeywords = /\b(sightseeing|tourist|attractions|landmarks|monuments|visit|places to visit|what to see|what to visit|museums?|parks?|historical|historic|tours?|guided|landmarks?)\b/i;
    
    // Check if this is a tourism question (should use AI knowledge, not database)
    const isTourismQuestion = lastUserMessage && tourismKeywords.test(lastUserMessage);
    
    // Check if this is likely a recommendation request (and NOT a tourism question)
    const isLikelyRecommendation = lastUserMessage && recommendationKeywords.test(lastUserMessage) && !isTourismQuestion;
    // Build request body
    const requestBody: any = {
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: systemPrompt }, ...enrichedMessages],
      max_completion_tokens: 4000,
    };
    if (isLikelyRecommendation && !stream) {
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
                      type: { type: "string", enum: ["event", "business", "coupon", "topListItem"] },
                      id: { type: "string", description: "The actual ID from the database. For topListItem, use the individual item ID from top_list_items, NOT the topList.id" },
                      title: { type: "string", description: "The event/item title from database OR bar/café/club name from topList items" },
                      description: { type: "string", description: "MANDATORY - For events: Location, address, date, time. For topListItem: item description and location. DO NOT include image URLs here." },
                      why_recommended: { type: "string", description: "Why this matches their request" },
                      personalized_note: { type: "string", description: "ONLY for events (type: 'event'). DO NOT include for topListItem. Personal message based on their profile" },
                      image_url: { type: "string", description: "MANDATORY - The image URL from the database for this event/item. This will be sent via WhatsApp." },
                      url: {
                        type: "string",
                        description: "Optional - Instagram link or external URL for the item. For topListItem, use the url field from the database.",
                      },
                      ticket_link: {
                        type: "string",
                        description: "IMPORTANT - For events with tickets, include the ticket_link from the database. This is the direct link where users can buy tickets.",
                      },
                    },
                    required: [
                      "type",
                      "id",
                      "title",
                      "description",
                      "why_recommended",
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

    // Add streaming support
    requestBody.stream = stream;
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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

    // If streaming is enabled, return the stream directly
    if (stream && response.body) {
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Get the complete message for non-streaming
    const data = await response.json();
    console.log("Full AI response:", JSON.stringify(data, null, 2));

    // Check if we got a tool call response (structured recommendations)
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let message: string;
    let hasRecommendations = false;

    if (toolCall && toolCall.function?.name === "provide_recommendations") {
      // Parse the structured output
      const functionArgs = JSON.parse(toolCall.function.arguments);
      message = JSON.stringify(functionArgs);
      hasRecommendations = functionArgs.recommendations && functionArgs.recommendations.length > 0;
      console.log("AI response (structured):", message);
    } else {
      // Regular conversational response
      message = data.choices?.[0]?.message?.content || "";
      console.log("AI response (conversational):", message);
      
      // CRITICAL FIX: Detect when AI outputs function call syntax as text instead of JSON
      // Pattern: "Calling `provide_recommendations` with `{...}`"
      const functionCallPattern = /calling\s*[`'"]*\s*(provide_recommendations|give_recommendations)[`'"]*\s*(with)?/i;
      const isFunctionCallText = functionCallPattern.test(message);
      
      if (isFunctionCallText) {
        console.log("DETECTED: AI outputted function call as text. Building recommendations directly.");
        
        // Extract time_frame from the fake function call if present
        const timeFrameMatch = message.match(/["'`]?time_frame["'`]?\s*:\s*["'`]?([^"'`,}]+)/i);
        const timeFrame = timeFrameMatch ? timeFrameMatch[1].toLowerCase().trim() : null;
        
        // Determine which events to show based on time_frame
        let relevantEvents = ageFilteredEvents;
        let timeDescription = "happening soon";
        
        if (timeFrame === "today" || timeFrame === "tonight") {
          relevantEvents = ageFilteredEvents.filter(e => e.date === today);
          timeDescription = userLanguage === 'es' ? "de hoy" : "tonight";
        } else if (timeFrame === "tomorrow") {
          relevantEvents = ageFilteredEvents.filter(e => e.date === tomorrowDate);
          timeDescription = userLanguage === 'es' ? "de mañana" : "tomorrow";
        } else if (timeFrame === "this week" || timeFrame === "this weekend" || timeFrame === "esta semana" || timeFrame === "fin de semana") {
          // Get events within the next 7 days
          const weekFromNow = new Date(nowBuenosAires);
          weekFromNow.setDate(weekFromNow.getDate() + 7);
          const weekFromNowStr = weekFromNow.toISOString().split("T")[0];
          relevantEvents = ageFilteredEvents.filter(e => e.date >= today && e.date <= weekFromNowStr);
          timeDescription = userLanguage === 'es' ? "de esta semana" : "this week";
        }
        
        // Limit to 7 events
        relevantEvents = relevantEvents.slice(0, 7);
        
        if (relevantEvents.length > 0) {
          const recommendations = relevantEvents.map(e => ({
            type: "event",
            id: e.id,
            title: e.title,
            description: `📍 ${e.location || 'Buenos Aires'}. ${e.date ? formatDate(e.date) : ''} ${e.time || ''}. ${e.description?.substring(0, 100) || ''}`,
            why_recommended: userLanguage === 'es' 
              ? `Evento ${timeDescription} que te puede interesar`
              : `Event ${timeDescription} you might enjoy`,
            image_url: e.image_url
          }));
          
          message = JSON.stringify({
            intro_message: userLanguage === 'es' 
              ? `¡Encontré ${relevantEvents.length} eventos ${timeDescription}! 🎉`
              : `Found ${relevantEvents.length} events ${timeDescription}! 🎉`,
            recommendations
          });
          console.log("Built recommendations from function call text:", message);
        } else {
          message = userLanguage === 'es'
            ? `No encontré eventos ${timeDescription}. ¿Querés que busque para otra fecha? 📅`
            : `I couldn't find events ${timeDescription}. Want me to search for another date? 📅`;
        }
      }
      // SAFETY CHECK: If AI returned empty content, check if user was asking about events and provide relevant fallback
      else if (!message || message.trim() === "") {
        console.error("AI returned empty content! Full response:", JSON.stringify(data, null, 2));
        
        // Check if user was asking about events/tonight/today - provide actual recommendations if so
        const lastUserMsgLower = lastUserMessage.toLowerCase();
        const isEventQuery = lastUserMsgLower.includes("event") || lastUserMsgLower.includes("tonight") || 
                            lastUserMsgLower.includes("today") || lastUserMsgLower.includes("esta noche") || 
                            lastUserMsgLower.includes("hoy") || lastUserMsgLower.includes("party") ||
                            lastUserMsgLower.includes("parties") || lastUserMsgLower.includes("fiesta");
        
        if (isEventQuery && ageFilteredEvents.length > 0) {
          // Filter for today's events if query mentions tonight/today
          const isTodayQuery = lastUserMsgLower.includes("tonight") || lastUserMsgLower.includes("today") || 
                              lastUserMsgLower.includes("esta noche") || lastUserMsgLower.includes("hoy");
          
          const relevantEvents = isTodayQuery 
            ? ageFilteredEvents.filter(e => e.date === today).slice(0, 5)
            : ageFilteredEvents.slice(0, 5);
          
          if (relevantEvents.length > 0) {
            // Build a JSON response with available events
            const recommendations = relevantEvents.map(e => ({
              type: "event",
              id: e.id,
              title: e.title,
              description: `📍 ${e.location || 'Buenos Aires'}. ${e.date ? formatDate(e.date) : ''} ${e.time || ''}. ${e.description?.substring(0, 100) || ''}`,
              why_recommended: "This event matches your search for events " + (isTodayQuery ? "tonight" : "happening soon"),
              image_url: e.image_url
            }));
            
            message = JSON.stringify({
              intro_message: userLanguage === 'es' 
                ? `¡Encontré ${relevantEvents.length} eventos para vos! 🎉`
                : `Found ${relevantEvents.length} events for you! 🎉`,
              recommendations
            });
            console.log("Built fallback event recommendations:", message);
          } else {
            message = userLanguage === 'es'
              ? "No encontré eventos para esa fecha. ¿Querés que busque para otro día? 📅"
              : "I couldn't find events for that date. Want me to search for another day? 📅";
          }
        } else {
          message = userLanguage === 'es'
            ? "¡Hola! ¿En qué te puedo ayudar hoy? Puedo recomendarte eventos, bares, fiestas y más en Buenos Aires 🎉"
            : "Hey! What can I help you with today? I can recommend events, bars, parties and more in Buenos Aires 🎉";
        }
      }

      // FALLBACK: For general Buenos Aires questions OR recommendation requests with no database matches
      // Trigger fallback only when Yara explicitly indicates no data
      const messageLower = message.toLowerCase();
      const shouldFallbackToLovableAI = 
        !toolCall && (
          message.startsWith("NO_DATABASE_MATCH:") || 
          // Standard "no results" patterns
          messageLower.includes("no encontré eventos") || 
          messageLower.includes("couldn't find any events") ||
          messageLower.includes("couldn't find any") ||  // Catches "couldn't find any vegan food events"
          messageLower.includes("i couldn't find") ||    // Catches variations like "I couldn't find any matching events"
          messageLower.includes("don't have information about") ||
          messageLower.includes("no tengo información sobre") ||
          // Additional patterns for restaurant/venue queries with no matches
          messageLower.includes("no tengo recomendaciones") ||
          messageLower.includes("don't have recommendations") ||
          messageLower.includes("no tengo datos") ||
          messageLower.includes("i don't have data") ||
          messageLower.includes("no cuento con información") ||
          messageLower.includes("no tengo información específica") ||
          messageLower.includes("i don't have specific information") ||
          // Patterns for "not in database" responses
          messageLower.includes("not in the database") ||
          messageLower.includes("no está en la base de datos") ||
          messageLower.includes("not in my database") ||
          messageLower.includes("no está en mi base") ||
          // Patterns for specific item types not found
          messageLower.includes("no encontré") ||        // Catches "no encontré eventos veganos"
          messageLower.includes("no pude encontrar") ||  // "I couldn't find" in Spanish
          // Patterns for restaurant-specific queries
          (messageLower.includes("restaurantes") && messageLower.includes("no tengo")) ||
          (messageLower.includes("restaurants") && messageLower.includes("don't have"))
        );
      
      if (shouldFallbackToLovableAI) {
        const userQuery = lastUserMessage;
        console.log(`No database match for: "${userQuery}". Falling back to OpenAI for general Buenos Aires knowledge.`);

        try {
          const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
          if (!openAIApiKey) {
            console.error("OPENAI_API_KEY not configured");
            message = userLanguage === 'es'
              ? "Hmm, no tengo esa información específica en este momento. ¿Quieres que te ayude con eventos, bares, clubs o actividades culturales en Buenos Aires? 🎭"
              : "Hmm, I don't have that specific information right now. Would you like help with events, bars, clubs, or cultural activities in Buenos Aires? 🎭";
          } else {
            // Extract location from last user message if specified
            const lastUserMsg = messages[messages.length - 1]?.content?.toLowerCase() || "";
            const locationMatch = lastUserMsg.match(/\b(?:in|en)\s+([a-záéíóúñ\s]+?)(?:\s|$|,|\.|\?|!)/i);
            const specifiedLocation = locationMatch ? locationMatch[1].trim() : null;
            
            const locationInstruction = specifiedLocation 
              ? `CRITICAL: The user specifically asked about ${specifiedLocation.toUpperCase()}. You MUST provide information relevant to ${specifiedLocation}.`
              : '';

            const fallbackResponse = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${openAIApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                  {
                    role: "system",
                    content: `You are Yara, a knowledgeable Buenos Aires local guide. The user asked: "${userQuery}". 
                    
                    **CRITICAL LANGUAGE RULE**: The user is writing in ${languageMap[userLanguage] || 'English'}. You MUST respond ONLY in ${languageMap[userLanguage] || 'English'}. Do not use any other language.
                    
                    **CRITICAL**: Only provide Buenos Aires information if the user is EXPLICITLY asking for it. For greetings or casual chat, respond conversationally without recommendations.
                    
                    **IF USER IS ASKING ABOUT BUENOS AIRES**:
                    
                    **TOURISM & SIGHTSEEING**:
                    - Tourist attractions: La Boca (Caminito), Recoleta Cemetery, Obelisco, Casa Rosada, Puerto Madero
                    - Museums: MALBA, Museo Nacional de Bellas Artes, Evita Museum, MAMBA
                    - Parks: Bosques de Palermo, Reserva Ecológica, Jardín Botánico
                    - Neighborhoods: San Telmo (antiques/tango), Palermo (trendy), Recoleta (elegant)
                    
                    **OTHER TOPICS**:
                    - Pet services (adoption centers, vets), shopping (electronics, clothes), healthcare, transportation, neighborhoods, sports
                    - Give SPECIFIC venue/business names, addresses, and practical details
                    
                    **RESPONSE STYLE**:
                    - If it's a greeting/casual message: Just be friendly, don't volunteer info
                    - If they want Buenos Aires info: Give 2-4 specific recommendations with names and locations
                    - Be warm with 1-2 emojis
                    - Keep under 200 words
                    
                    ${locationInstruction}`,
                  },
                  {
                    role: "user",
                    content: userQuery,
                  },
                ],
                max_tokens: 600,
              }),
            });

            if (fallbackResponse.ok) {
              const fallbackData = await fallbackResponse.json();
              message = fallbackData.choices?.[0]?.message?.content || message;
              console.log("OpenAI fallback response:", message);
            } else {
              const errorText = await fallbackResponse.text();
              console.error("OpenAI fallback error:", fallbackResponse.status, errorText);
              message = userLanguage === 'es'
                ? "Hmm, no tengo esa información específica en este momento. ¿Quieres que te ayude con eventos, bares, clubs o actividades culturales en Buenos Aires? 🎭"
                : "Hmm, I don't have that specific information right now. Would you like help with events, bars, clubs, or cultural activities in Buenos Aires? 🎭";
            }
          }
        } catch (error) {
          console.error("OpenAI fallback error:", error);
          message = userLanguage === 'es'
            ? "Perdón, tuve un problema. Pero puedo ayudarte con eventos, conciertos, bares y vida nocturna en Buenos Aires! ¿Qué te interesa? 🎵"
            : "Sorry, I had a hiccup. But I can help you with events, concerts, bars, and nightlife in Buenos Aires! What interests you? 🎵";
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

        // CRITICAL FIX: Enrich recommendations with image_url, external_link, ticket_link from database if AI omitted them
        if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
          // Create lookup maps for quick access - include all relevant fields
          const eventDataMap = new Map(ageFilteredEvents.map(e => [e.id, { 
            image_url: e.image_url, 
            external_link: e.external_link,
            ticket_link: e.ticket_link 
          }]));
          const businessDataMap = new Map(businesses.map(b => [b.id, { 
            image_url: b.image_url 
          }]));
          const couponDataMap = new Map(coupons.map(c => [c.id, { 
            image_url: c.image_url 
          }]));
          
          parsed.recommendations = parsed.recommendations.map((rec: any) => {
            let enrichedRec = { ...rec };
            
            if (rec.type === 'event') {
              const eventData = eventDataMap.get(rec.id);
              if (eventData) {
                // Enrich image_url if missing
                if (!enrichedRec.image_url && eventData.image_url) {
                  enrichedRec.image_url = eventData.image_url;
                  console.log(`Enriched "${rec.title}" with image_url from database`);
                }
                // Enrich external_link (Instagram) if missing - store as both external_link and url for compatibility
                if (!enrichedRec.external_link && !enrichedRec.url && eventData.external_link) {
                  enrichedRec.external_link = eventData.external_link;
                  enrichedRec.url = eventData.external_link; // Also set url for send-whatsapp-recommendations compatibility
                  console.log(`Enriched "${rec.title}" with external_link/Instagram from database: ${eventData.external_link}`);
                }
                // Enrich ticket_link if missing
                if (!enrichedRec.ticket_link && eventData.ticket_link) {
                  enrichedRec.ticket_link = eventData.ticket_link;
                  console.log(`Enriched "${rec.title}" with ticket_link from database`);
                }
              }
            } else if (rec.type === 'business') {
              const businessData = businessDataMap.get(rec.id);
              if (businessData && !enrichedRec.image_url && businessData.image_url) {
                enrichedRec.image_url = businessData.image_url;
                console.log(`Enriched "${rec.title}" with image_url from database`);
              }
            } else if (rec.type === 'coupon') {
              const couponData = couponDataMap.get(rec.id);
              if (couponData && !enrichedRec.image_url && couponData.image_url) {
                enrichedRec.image_url = couponData.image_url;
                console.log(`Enriched "${rec.title}" with image_url from database`);
              }
            }
            // Note: topListItems already have url field handled by AI from the database
            
            return enrichedRec;
          });
          
          // Update message with enriched recommendations
          message = JSON.stringify(parsed);
          console.log(`Enriched recommendations with data from database`);
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
          const interactions = parsed.recommendations.map((rec: any) => {
            // For topListItem, track the individual item id
            if (rec.type === 'topListItem') {
              return {
                phone_number: phoneNumber,
                item_type: 'topListItem',
                item_id: rec.id, // This is the individual item.id from top_list_items
                interaction_type: "recommended",
              };
            }
            return {
              phone_number: phoneNumber,
              item_type: rec.type,
              item_id: rec.id,
              interaction_type: "recommended",
            };
          });
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
    hasRecommendations = message.includes('"recommendations"');

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

    // If streaming is enabled, return the stream directly
    if (stream && response.body) {
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }
    
    // For non-streaming, return JSON response
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
    
    // Log error to database for monitoring
    try {
      const lastUserMessage = messages && messages.length > 0 
        ? messages[messages.length - 1]?.content 
        : 'Unknown query';
      
      await supabase.from('chatbot_errors').insert({
        function_name: 'yara-ai-chat',
        error_message: error.message || 'Unknown error',
        error_stack: error.stack || null,
        user_query: lastUserMessage,
        phone_number: phoneNumber || null,
        context: {
          userProfile: userProfile || null,
          messageCount: messages?.length || 0,
          stream: stream || false,
          timestamp: new Date().toISOString()
        }
      });
    } catch (logError) {
      console.error("Failed to log error to database:", logError);
    }
    
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
