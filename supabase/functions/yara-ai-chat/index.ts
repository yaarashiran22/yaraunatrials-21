import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, stream = true, userProfile = null, phoneNumber = null } = await req.json();
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch user's interaction history for behavioral learning
    let interactionHistory: any[] = [];
    if (phoneNumber) {
      const { data: interactions } = await supabase
        .from('whatsapp_user_interactions')
        .select('item_type, item_id, interaction_type, created_at')
        .eq('phone_number', phoneNumber)
        .order('created_at', { ascending: false })
        .limit(50);
      
      interactionHistory = interactions || [];
    }

    // Get current date for filtering
    const today = new Date().toISOString().split('T')[0];
    
    // Fetch relevant data from database with image URLs
    const [eventsResult, itemsResult, couponsResult] = await Promise.all([
      supabase.from('events').select('id, title, description, date, time, location, address, price, mood, music_type, venue_size, external_link, image_url').gte('date', today).order('date', { ascending: true }).limit(50),
      supabase.from('items').select('id, title, description, category, location, price, image_url').eq('status', 'active').order('created_at', { ascending: false }).limit(50),
      supabase.from('user_coupons').select('id, title, description, business_name, discount_amount, neighborhood, valid_until, image_url').eq('is_active', true).order('created_at', { ascending: false }).limit(50)
    ]);

    const events = eventsResult.data || [];
    const businesses = itemsResult.data || [];
    const coupons = couponsResult.data || [];

    console.log(`Fetched ${events.length} events, ${businesses.length} businesses, ${coupons.length} coupons`);

    // Build context for AI - include IDs and image URLs
    const contextData = {
      events: events.map(e => ({
        id: e.id,
        title: e.title,
        description: e.description,
        date: e.date,
        time: e.time,
        location: e.location,
        address: e.address,
        price: e.price,
        mood: e.mood,
        music_type: e.music_type,
        venue_size: e.venue_size,
        external_link: e.external_link,
        image_url: e.image_url
      })),
      businesses: businesses.map(b => ({
        id: b.id,
        title: b.title,
        description: b.description,
        category: b.category,
        location: b.location,
        price: b.price,
        image_url: b.image_url
      })),
      coupons: coupons.map(c => ({
        id: c.id,
        title: c.title,
        description: c.description,
        business_name: c.business_name,
        discount_amount: c.discount_amount,
        neighborhood: c.neighborhood,
        valid_until: c.valid_until,
        image_url: c.image_url
      }))
    };

    // Build user context for personalization
    let userContext = '';
    if (userProfile) {
      const parts = [];
      if (userProfile.name) parts.push(`Name: ${userProfile.name}`);
      if (userProfile.age) parts.push(`Age: ${userProfile.age}`);
      if (userProfile.budget_preference) parts.push(`Budget: ${userProfile.budget_preference}`);
      if (userProfile.favorite_neighborhoods?.length) parts.push(`Neighborhoods: ${userProfile.favorite_neighborhoods.join(', ')}`);
      if (userProfile.interests?.length) parts.push(`Interests: ${userProfile.interests.join(', ')}`);
      if (userProfile.recommendation_count !== undefined) parts.push(`Recommendations given: ${userProfile.recommendation_count}`);
      
      if (parts.length > 0) {
        userContext = `\n\nUser Profile:\n${parts.join('\n')}`;
      }
    }

    // Add behavioral history for smarter recommendations
    if (interactionHistory.length > 0) {
      const engagedEvents = interactionHistory.filter(i => i.item_type === 'event' && i.interaction_type !== 'recommended');
      const engagedBusinesses = interactionHistory.filter(i => i.item_type === 'business' && i.interaction_type !== 'recommended');
      
      if (engagedEvents.length > 0 || engagedBusinesses.length > 0) {
        userContext += '\n\nBehavioral History (what they actually engaged with):';
        if (engagedEvents.length > 0) {
          userContext += `\n- Asked about ${engagedEvents.length} events (IDs: ${engagedEvents.map(e => e.item_id).join(', ')})`;
        }
        if (engagedBusinesses.length > 0) {
          userContext += `\n- Showed interest in ${engagedBusinesses.length} businesses/items`;
        }
        userContext += '\n- PRIORITIZE recommendations similar to these based on mood, location, category, and vibe';
      }
    }

    const systemPrompt = `You are Yara, a friendly AI assistant for Buenos Aires events and experiences. Use emojis naturally to add warmth (1-2 per message), but don't overdo it.

Today's date is: ${today}

Available data:
${JSON.stringify(contextData, null, 2)}${userContext}

CRITICAL RESPONSE FORMAT - YOU MUST FOLLOW THIS EXACTLY:

SCENARIO 1 - User greeting, asking follow-up questions, or general conversation:
Respond with PLAIN TEXT ONLY. Be warm and conversational.
- If user asks about age ranges, demographics, or details about previously recommended events, answer based on the event data
- If user asks clarifying questions about recommendations you already gave, refer to the conversation history and provide helpful answers
- Be contextually aware - if they're asking about "these events" or "the recommendations", they're referring to what you previously suggested
- **IMPORTANT**: Keep responses brief and ask ONLY ONE question at a time
- If user asks VERY GENERAL questions about things to do in the city (like "what's happening?", "what should I do?", "any events tonight?") WITHOUT any specific preferences, ask them ONE clarifying question to personalize recommendations

AGE COLLECTION - HIGHEST PRIORITY:
**CRITICAL - THIS IS NON-NEGOTIABLE**: If the user requests recommendations AND their age is not saved in the profile, you MUST ask for their age BEFORE giving any recommendations. DO NOT proceed with recommendations without age.
- If they mention going "with friends", "with people", or "we", ask: "Quick question first - what are your ages? (e.g., 25, 28, 30)"
- If they're asking just for themselves, ask: "Quick question first - how old are you? This helps me recommend the perfect spots for you 😊"
- DO NOT give recommendations until you have age information
- DO NOT return JSON recommendations without age
- After they provide their age(s), THEN proceed to give recommendations

AGE-BASED FILTERING (when giving recommendations):
- For users 18-30: Focus on nightlife, clubs, indie venues, underground scenes, energetic events
- For users 30-45: Mix of sophisticated bars, live music, cultural events, some nightlife
- For users 45+: Cultural events, theaters, upscale dining, wine bars, art galleries
- NEVER recommend age-inappropriate events (e.g., don't send 25-year-olds to retirement community events)

PROGRESSIVE PROFILING (Build profile gradually - AFTER age is collected):
- After the 2nd-3rd recommendation (when recommendation_count = 2 or 3), if name is missing, you MUST ask: "By the way, what's your name?"
- After the 4th-5th recommendation (when recommendation_count = 4 or 5), if budget_preference is missing, ask: "Are you looking for something fancy-ish or more local/casual vibes?"
- After the 6th-7th recommendation, if favorite_neighborhoods OR interests are missing, you MUST ask: "Which neighborhoods do you usually hang out in, and what are your main interests?"
- These questions are MANDATORY and must be asked at the specified times
- Ask ONLY ONE profiling question per message

Example conversational responses: 
  - "Hey! I'm Yara. What kind of events are you looking for?"
  - "Most of those events are popular with people in their 20s and 30s, though all ages are welcome!"
  - "That event is in Palermo, near Plaza Serrano"
  - "I'd love to help! To give you the best recommendations - what's your vibe tonight?"

SCENARIO 2 - User wants SPECIFIC recommendations (dance events, bars, techno, etc.):
**ABSOLUTELY CRITICAL - NO EXCEPTIONS**: When user requests specific recommendations, you MUST return PURE JSON ONLY.

DETECTION KEYWORDS FOR JSON RESPONSE (if user message contains ANY of these, return JSON):
- "recommendations", "recommend", "suggest"
- "events", "bars", "clubs", "venues", "places"
- "show me", "looking for", "find me", "what's", "any"
- "tonight", "today", "this week", "weekend", "tomorrow", "next week"
- "dance", "music", "live", "party", "art", "food"
- Spanish: "esta noche", "hoy", "mañana", "próxima semana", "semana que viene", "fin de semana"

**IMPORTANT**: ONLY return JSON if age is already collected. If age is missing, respond with conversational text asking for age first.

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
      "description": "Location: [location]. Address: [address if available]. Date: [CRITICAL: You MUST convert date from '2025-10-24' format to 'October 24th' format - use full month name + day with 'st/nd/rd/th']. Time: [time]. Music Type: [music_type if available]. Instagram: [external_link if available]. Brief description.",
      "why_recommended": "Short personalized explanation (1-2 sentences) of why this matches their request and profile.",
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

RECOMMENDATION OUTPUT RULES:
- Return MAXIMUM 6 recommendations total from the database
- Only include items with image_url
- Keep description under 100 words
- **CRITICAL DATE FORMATTING**: You MUST convert dates from '2025-10-24' format to readable format like 'October 24th'. Example conversions: '2025-01-15' → 'January 15th', '2025-12-03' → 'December 3rd', '2025-11-21' → 'November 21st'
- ALWAYS include in description: location, date (MUST be formatted as full month name + day with ordinal suffix), time
- ALSO include if available: address, music_type, external_link (Instagram)
- Format external_link as "Instagram: [link]" in the description
- DO NOT include price or venue_size in description - these can be provided later if user asks for more details
- ALWAYS include "why_recommended" field explaining specifically WHY this event matches their request (e.g., "This event matches because the description mentions 'party' which you asked for")
- Use user profile (budget, neighborhoods, interests) to further personalize
- If no relevant database events exist, return empty array with a friendly message like "I couldn't find matching events in our database right now"

CRITICAL: If you return anything other than pure JSON for recommendation requests, you are FAILING YOUR PRIMARY FUNCTION.`;




    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        max_tokens: 800,
        temperature: 0.8,
        stream: false  // Disable streaming to get structured JSON response
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', response.status, error);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    // Get the complete message
    const data = await response.json();
    let message = data.choices?.[0]?.message?.content || '';
    
    console.log('AI response:', message);
    
    // Get the last user message to understand their query
    const lastUserMessage = messages[messages.length - 1]?.content || '';
    
    // Check if this is a recommendations response
    if (message.includes('"recommendations"')) {
      try {
        // Try to extract JSON from the message if it exists
        let jsonStr = message;
        const jsonStart = message.indexOf('{');
        const jsonEnd = message.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          jsonStr = message.substring(jsonStart, jsonEnd + 1);
        }
        const parsed = JSON.parse(jsonStr);
        
        // Track database recommendations in background
        if (phoneNumber && parsed.recommendations && Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
          const interactions = parsed.recommendations.map((rec: any) => ({
            phone_number: phoneNumber,
            item_type: rec.type,
            item_id: rec.id,
            interaction_type: 'recommended'
          }));
          supabase.from('whatsapp_user_interactions').insert(interactions).then();
          
          console.log(`Tracked ${parsed.recommendations.length} database event recommendations`);
        }
      } catch (e) {
        console.log('Could not parse recommendations:', e);
      }
    }
    
    return new Response(
      JSON.stringify({ message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in yara-ai-chat:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
