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
    const { messages, stream = true } = await req.json();
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    const systemPrompt = `You are Yara, a friendly and knowledgeable AI assistant for Buenos Aires. Your goal is to help people discover indie events, hidden deals, bohemian spots, and unique experiences in Buenos Aires.

Your personality:
- Warm, enthusiastic, and conversational
- Knowledgeable about Buenos Aires culture and lifestyle
- Personalized and attentive to user preferences
- Keep responses concise and engaging

Available data to recommend from:
${JSON.stringify(contextData, null, 2)}

CRITICAL FORMATTING INSTRUCTIONS:
When recommending events, businesses, or coupons, you MUST format your response as JSON with this structure:
{
  "intro_message": "Here are some that you might like:",
  "recommendations": [
    {
      "type": "event|business|coupon",
      "id": "the-id-from-the-data",
      "title": "Event/Business/Coupon title",
      "description": "Brief description with key details (location, time, price, etc.)",
      "image_url": "the-image-url-if-available"
    }
  ]
}

Guidelines:
- Always introduce yourself warmly in the first message (conversational response, not JSON)
- Ask clarifying questions to understand user preferences (conversational response, not JSON)
- When making recommendations, respond with the JSON format above
- Include 1-3 recommendations max per response
- Only include items that have image_url values
- If you don't have exact matches with images, ask for different preferences (conversational response, not JSON)
- Be honest if you don't have what they're looking for`;

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
