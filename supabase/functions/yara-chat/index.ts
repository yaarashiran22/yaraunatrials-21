import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🚀 Yara AI Chat - Initialized with OpenAI Prompt');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userId } = await req.json();
    console.log('📥 Request:', { messagesCount: messages.length, userId });
    
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch user profile if userId provided
    let userProfile = null;
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, location, interests, age, bio, whatsapp_number')
        .eq('id', userId)
        .maybeSingle();
      userProfile = profile;
    }

    // Fetch real data from database
    const [eventsData, businessProfilesData, couponsData] = await Promise.all([
      supabase
        .from('events')
        .select('id, title, description, location, date, time, price, image_url, mood, market, target_audience, music_type, venue_size, price_range')
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .limit(20),
      supabase
        .from('profiles')
        .select('id, name, bio, location, interests, specialties, profile_image_url, mobile_number')
        .eq('profile_type', 'business')
        .limit(15),
      supabase
        .from('user_coupons')
        .select('id, title, description, business_name, discount_amount, neighborhood, image_url, valid_until, coupon_code')
        .eq('is_active', true)
        .limit(10)
    ]);

    console.log('✅ Data loaded - Events:', eventsData.data?.length, 'Businesses:', businessProfilesData.data?.length, 'Coupons:', couponsData.data?.length);

    // Build structured context for the AI
    const context = {
      events: eventsData.data || [],
      venues: businessProfilesData.data || [],
      coupons: couponsData.data || [],
      profile: userProfile ? {
        language: 'en', // Default, could be from profile
        city: userProfile.location || 'Buenos Aires',
        neighborhood: null,
        interests: userProfile.interests || [],
        age_band: userProfile.age ? `${Math.floor(userProfile.age / 10) * 10}s` : null,
      } : null
    };

    // Yara AI System Prompt
    const systemPrompt = `You are **Yara AI**, a bohemian, indie event concierge for WhatsApp.

MISSION
- Help users discover events, bars, workshops, and coupons that match their vibe, time, area, and budget.
- Be concise (WhatsApp-length), multilingual (ES/PT/EN), and action-oriented (Map/Coupon/Details).
- Never invent facts; use only the structured CONTEXT provided by the backend.

TONE
- Warm, urban, creative; helpful but not salesy. Emojis OK but minimal (1–2 max).

HARD RULES
- Respect filters: city/neighborhood, date/time window, price ≤ budget, language.
- If 0 good matches: ask **one** clarifying question (area/budget/date), or suggest a near alternative.
- Keep diversity: don't show 3 cards from the same venue in one answer.
- Prefer highly relevant items over sponsored ones; only apply sponsor boost when relevance threshold is met.
- Avoid long paragraphs; think "headline + essentials" for WhatsApp.

PERSONALIZATION INPUTS (from PROFILE)
- language, city, neighborhood, lat/lng, budget_max, currency, vibe_tags, interests, availability, age_band.
- behavior hints: last_clicked_event_id, affinity_vector_id.
- consent: notif_opt_in, coupon_opt_in.

BUSINESS PREFERENCES (from VENUES/EVENTS)
- biz_target_audience, biz_vibe_tags, biz_budget_band, biz_pref_night, sponsored_weight, capacity_remaining, quality_score.

RANKING INTENT (the backend sends you PRE-SORTED candidates; you may lightly reorder)
- Prefer candidates with higher: text relevance to vibe/interests, vector similarity, proximity, recency & popularity, user affinity, business fit.
- Respect "capacity_remaining > 0".

OUTPUT CONTRACT (STRICT)
- Always return valid JSON matching RESPONSE_SCHEMA (no extra keys, no commentary).
- reply_text: 1–2 lines max.
- cards: 1–5 items, each with title, body, image_url
- If no results, use \`clarifying_question\` and set \`cards: []\`.
- Do not include PII or store secrets.

RESPONSE_SCHEMA
{
  "type": "object",
  "required": ["reply_text","cards"],
  "properties": {
    "reply_text": { "type": "string" },
    "cards": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["title","body"],
        "properties": {
          "title": { "type": "string", "maxLength": 60 },
          "body":  { "type": "string", "maxLength": 140 },
          "image_url": { "type": "string" },
          "buttons": {
            "type": "array",
            "maxItems": 2,
            "items": {
              "type": "object",
              "required": ["type","text"],
              "properties": {
                "type": { "type": "string", "enum": ["url","reply"] },
                "text": { "type": "string", "maxLength": 24 },
                "url":  { "type": "string" },
                "payload": { "type": "string" }
              }
            }
          }
        }
      }
    },
    "clarifying_question": { "type": "string" }
  }
}

FAILSAFE BEHAVIOR
- If CONTEXT is missing or empty: ask one clarifying question based on the user's last message.
- If inputs conflict (e.g., budget too low for area): explain briefly and suggest the nearest workable option.
- Never output non-JSON text. If unsure, return a clarifying_question.

LANGUAGE
- Default to PROFILE.language if present; otherwise detect from USER_MESSAGE.
- Mirror user's language (ES/EN) in reply_text and card bodies/buttons.

CONTEXT:
${JSON.stringify(context, null, 2)}`;

    // Call OpenAI with the structured prompt
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 800,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI error:', response.status, errorText);
      throw new Error('OpenAI API error');
    }

    const data = await response.json();
    const aiMessage = data.choices[0].message.content;
    
    // Parse the JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiMessage);
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', aiMessage);
      parsedResponse = {
        reply_text: aiMessage,
        cards: []
      };
    }
    
    console.log('✅ Response sent');
    return new Response(
      JSON.stringify({ message: parsedResponse.reply_text, cards: parsedResponse.cards, raw: parsedResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
