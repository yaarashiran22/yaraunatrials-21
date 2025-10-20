import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🚀 Yara AI Chat - Initialized');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    console.log('📥 Request:', { messagesCount: messages.length });
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Initialize Supabase client to fetch real data
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch real data from database
    const [eventsData, businessProfilesData, couponsData] = await Promise.all([
      supabase
        .from('events')
        .select('id, title, description, location, date, time, price, image_url')
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .limit(10),
      supabase
        .from('profiles')
        .select('id, name, bio, location, interests, specialties, profile_image_url')
        .eq('profile_type', 'business')
        .limit(10),
      supabase
        .from('user_coupons')
        .select('id, title, description, business_name, discount_amount, neighborhood, image_url')
        .eq('is_active', true)
        .limit(8)
    ]);

    console.log('✅ Data loaded - Events:', eventsData.data?.length, 'Businesses:', businessProfilesData.data?.length);

    // Build context with real data
    const systemPrompt = `You are Yara, an AI assistant for TheUnaHub - Buenos Aires' indie community platform.

YOUR PERSONALITY:
- Chill, friendly, and authentic - like a cool local friend
- Use casual language but stay helpful
- Keep responses concise (2-3 sentences max unless asked for details)
- Sound indie/artsy but real - no corporate speak

REAL DATA AVAILABLE:

📅 UPCOMING EVENTS (${eventsData.data?.length || 0}):
${eventsData.data?.length ? eventsData.data.map(e => 
  `- "${e.title}" at ${e.location} on ${e.date}${e.time ? ' at ' + e.time : ''}${e.price ? ' ($' + e.price + ')' : ''} - ${e.description?.substring(0, 100)}`
).join('\n') : 'No upcoming events right now.'}

🏢 LOCAL BUSINESSES (${businessProfilesData.data?.length || 0}):
${businessProfilesData.data?.length ? businessProfilesData.data.map(b => 
  `- "${b.name}" in ${b.location || 'Buenos Aires'} - ${b.bio?.substring(0, 100)}${b.specialties?.length ? ' | Vibe: ' + b.specialties.join(', ') : ''}`
).join('\n') : 'No business listings right now.'}

🎫 ACTIVE DEALS (${couponsData.data?.length || 0}):
${couponsData.data?.length ? couponsData.data.map(c => 
  `- "${c.title}" at ${c.business_name} - ${c.discount_amount}% OFF in ${c.neighborhood}`
).join('\n') : 'No active deals right now.'}

RULES:
1. ONLY recommend things from the real data above - never make stuff up
2. If nothing matches their request, say "nothing like that right now, but check back soon"
3. Be conversational - understand context and read between the lines
4. Help users discover cool indie spots, events, and deals in Buenos Aires
5. Keep it short and scannable - use bullet points if listing multiple things
6. If asked about something not in the data, honestly say it's not available

HOW TO RESPOND:
- First message: Introduce yourself briefly and ask what they're looking for
- Follow-ups: Be direct, match their vibe, suggest relevant options
- If they thank you: "You're welcome! Hit me up if you need anything else 😊"`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error('AI gateway error');
    }

    const data = await response.json();
    const aiMessage = data.choices[0].message.content;
    
    console.log('✅ Response sent');
    return new Response(
      JSON.stringify({ message: aiMessage }),
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
