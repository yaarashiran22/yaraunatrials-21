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
      supabase.from('events').select('id, title, description, date, time, location, price, mood, music_type, venue_size, image_url').gte('date', today).order('date', { ascending: true }).limit(50),
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
        price: e.price,
        mood: e.mood,
        music_type: e.music_type,
        venue_size: e.venue_size,
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

PROGRESSIVE PROFILING (Build profile gradually):
**YOU MUST DO THIS EXACTLY AS INSTRUCTED - THIS IS CRITICAL**
- IMMEDIATELY after the FIRST recommendation (when recommendation_count = 1), you MUST ask: "By the way, what's your name?"
- After the 2nd-3rd recommendation (when recommendation_count = 2 or 3), if name is filled but age OR budget_preference is missing, you MUST ask: "Quick question - what's your age and typical budget for going out?"
- After the 4th-5th recommendation (when recommendation_count = 4 or 5), if favorite_neighborhoods OR interests are missing, you MUST ask: "Which neighborhoods do you usually hang out in, and what are your main interests?"
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
      "description": "Location: [location]. Date: [date]. Time: [time]. Price: [price]. Brief description.",
      "why_recommended": "Short personalized explanation (1-2 sentences) of why this matches their request and profile.",
      "image_url": "full-image-url"
    }
  ]
}

RECOMMENDATION RULES:
- Return MAXIMUM 6 recommendations total (combining database + live recommendations)
- Only include items with image_url
- Keep description under 100 words
- Include location, date, time, price in description
- ALWAYS include "why_recommended" field with personalized explanation based on user's request, profile, and past interactions
- Prioritize matches to user request, but if no perfect matches exist, return the most relevant/interesting events available
- Use user profile (budget, neighborhoods, interests) to further personalize
- NEVER return empty recommendations array if events exist in the database

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
    
    // Check if this is a recommendations response and enhance with Perplexity
    if (message.includes('"recommendations"')) {
      try {
        // Extract JSON from the message (handle cases where AI adds text before JSON)
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
        }
        
        // Get the last user message to understand their query
        const lastUserMessage = messages[messages.length - 1]?.content || '';
        
        // ALWAYS call Perplexity for real-time recommendations (even if DB has no matches)
        const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
        if (perplexityApiKey && perplexityApiKey.trim() !== '') {
          console.log('Fetching real-time recommendations from Perplexity...');
          
          try {
            const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${perplexityApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'sonar',
                messages: [
                  {
                    role: 'system',
                    content: `You are Yara, a friendly Buenos Aires local. Today's date is ${new Date().toISOString().split('T')[0]}. Find 2-3 real, current events or venues that match the user's request. 
                    
CRITICAL: Only return events happening TODAY OR IN THE FUTURE. Do not include any past events.

IMPORTANT: If the user specifies a date or time frame (tonight, tomorrow, next week, mañana, próxima semana, etc.), ONLY return events happening on that specific date or within that time range. Calculate the correct date based on today's date.

Return ONLY a JSON array with this exact structure (no markdown, no extra text):
[
  {
    "title": "Event/Venue Name",
    "description": "Location: [venue/address]. Date: [date]. Time: [time if known]. Brief engaging description (1-2 sentences max, ~30 words).",
    "why_recommended": "Short personalized explanation (1-2 sentences) of why this matches their request.",
    "source": "Website or source URL"
  }
]`
                  },
                  {
                    role: 'user',
                    content: `Find 2-3 specific, real events or venues in Buenos Aires for: ${lastUserMessage}. Include actual venue names, dates, and locations.`
                  }
                ],
                temperature: 0.2,
                max_tokens: 400
              }),
            });

            if (perplexityResponse.ok) {
              const perplexityData = await perplexityResponse.json();
              const perplexityText = perplexityData.choices?.[0]?.message?.content || '';
              
              console.log('Perplexity raw response:', perplexityText);
              
              // Try to parse Perplexity's response
              try {
                let perplexityRecs = JSON.parse(perplexityText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
                
                // Ensure it's an array
                if (!Array.isArray(perplexityRecs)) {
                  perplexityRecs = [perplexityRecs];
                }
                
                // Convert Perplexity recommendations to our format
                const liveRecs = perplexityRecs.map((rec: any, idx: number) => ({
                  type: 'live',
                  id: `perplexity-live-${idx}`,
                  title: rec.title,
                  description: `${rec.description}\n\n🔗 ${rec.source}`,
                  why_recommended: rec.why_recommended || "This is a current, live recommendation happening in Buenos Aires.",
                  image_url: null
                }));
                
                // Combine database recommendations with Perplexity recommendations (max 6 total)
                const dbRecs = parsed.recommendations.slice(0, Math.min(3, 6 - liveRecs.length));
                const finalLiveRecs = liveRecs.slice(0, 6 - dbRecs.length);
                const combinedRecommendations = [...dbRecs, ...finalLiveRecs].slice(0, 6);
                
                // Update intro message
                let updatedIntro = parsed.intro_message;
                if (dbRecs.length > 0 && finalLiveRecs.length > 0) {
                  updatedIntro = `Here are ${combinedRecommendations.length} recommendations for you (${dbRecs.length} from our community + ${finalLiveRecs.length} live):`;
                } else if (dbRecs.length > 0) {
                  updatedIntro = `Here are ${dbRecs.length} recommendations from our community:`;
                } else {
                  updatedIntro = `Here are ${finalLiveRecs.length} live recommendations for you:`;
                }
                
                message = JSON.stringify({
                  intro_message: updatedIntro,
                  recommendations: combinedRecommendations
                });
                
                console.log(`Combined ${dbRecs.length} database + ${liveRecs.length} Perplexity recommendations`);
              } catch (e) {
                console.log('Could not parse Perplexity response as JSON:', e);
              }
            } else {
              const errorText = await perplexityResponse.text();
              console.log('Perplexity API error:', perplexityResponse.status, errorText);
            }
          } catch (e) {
            console.log('Error calling Perplexity:', e);
          }
        }
      } catch (e) {
        console.log('Could not parse or enhance recommendations:', e);
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
