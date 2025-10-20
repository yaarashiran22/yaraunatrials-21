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
    const { messages } = await req.json();
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch relevant data from database
    const [eventsResult, itemsResult, couponsResult] = await Promise.all([
      supabase.from('events').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('items').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(50),
      supabase.from('user_coupons').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(50)
    ]);

    const events = eventsResult.data || [];
    const businesses = itemsResult.data || [];
    const coupons = couponsResult.data || [];

    console.log(`Fetched ${events.length} events, ${businesses.length} businesses, ${coupons.length} coupons`);

    // Build context for AI
    const contextData = {
      events: events.map(e => ({
        title: e.title,
        description: e.description,
        date: e.date,
        time: e.time,
        location: e.location,
        price: e.price,
        mood: e.mood,
        music_type: e.music_type,
        venue_size: e.venue_size
      })),
      businesses: businesses.map(b => ({
        title: b.title,
        description: b.description,
        category: b.category,
        location: b.location,
        price: b.price
      })),
      coupons: coupons.map(c => ({
        title: c.title,
        description: c.description,
        business_name: c.business_name,
        discount_amount: c.discount_amount,
        neighborhood: c.neighborhood,
        valid_until: c.valid_until
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

Guidelines:
- Always introduce yourself warmly in the first message
- Ask clarifying questions to understand user preferences (mood, budget, location, type of activity)
- Make personalized recommendations based on the available data
- If you don't have exact matches, suggest similar options or ask for different preferences
- Include relevant details like location, price, date/time when recommending
- Be honest if you don't have what they're looking for
- Keep responses conversational and friendly, not robotic`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        max_completion_tokens: 500,
        stream: true
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', response.status, error);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
      },
    });

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
