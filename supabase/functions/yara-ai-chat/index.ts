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

    // Fetch relevant data from database with image URLs
    const [eventsResult, itemsResult, couponsResult] = await Promise.all([
      supabase.from('events').select('id, title, description, date, time, location, price, mood, music_type, venue_size, image_url').order('created_at', { ascending: false }).limit(50),
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

    const systemPrompt = `You are Yara, a friendly AI assistant for Buenos Aires events and experiences.

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
**CRITICAL**: When user asks for SPECIFIC types of events/places (like "dance events", "techno parties", "bars", "art galleries", etc.), ALWAYS respond with JSON recommendations.
DO NOT ask clarifying questions. DO NOT respond with conversational text.
Respond with ONLY A JSON OBJECT. NO TEXT BEFORE OR AFTER. NO MARKDOWN.
NO \`\`\`json wrapper. JUST THE RAW JSON OBJECT.

USE USER PROFILE DATA to filter and personalize recommendations when available.

The JSON structure MUST be exactly this:
{
  "intro_message": "Here are some [type] you might like:",
  "recommendations": [
    {
      "type": "event",
      "id": "actual-event-id",
      "title": "Event Title",
      "description": "Location: [location]. Date: [date]. Time: [time]. Price: [price]. Brief description of what to expect.",
      "image_url": "full-image-url"
    }
  ]
}

RULES FOR RECOMMENDATIONS:
- Maximum 3 recommendations
- Only include events that have an image_url
- Keep description under 100 words
- Include location, date, time, price in the description
- NO extra text, NO markdown, NO explanations
- Return ONLY the JSON object
- Match the user's request (if they ask for "dance events", filter for dance/music events)
- Use user profile preferences (budget, neighborhoods, interests) to personalize results

IMPORTANT: If user asks "I'm looking for dance events" or "show me bars" or any specific category - RESPOND WITH JSON, NOT CONVERSATIONAL TEXT.`;


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
    const message = data.choices?.[0]?.message?.content || '';
    
    console.log('AI response:', message);
    
    // Track recommendations in background (don't await)
    if (phoneNumber && message.includes('"recommendations"')) {
      try {
        const parsed = JSON.parse(message);
        if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
          const interactions = parsed.recommendations.map((rec: any) => ({
            phone_number: phoneNumber,
            item_type: rec.type,
            item_id: rec.id,
            interaction_type: 'recommended'
          }));
          
          // Log recommendations asynchronously
          supabase.from('whatsapp_user_interactions').insert(interactions).then();
        }
      } catch (e) {
        console.log('Could not parse recommendations for tracking:', e);
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
