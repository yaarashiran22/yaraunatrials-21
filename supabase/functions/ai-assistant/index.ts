import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('AI Assistant function started - v5.0 - Fresh Deploy!');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userLocation, conversationHistory } = await req.json();
    console.log('AI Assistant v9.0 - Conversational & Context-Aware - Processing:', { message, userLocation, historyLength: conversationHistory?.length });
    
    // Get OpenAI API key
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error('❌ OpenAI API key not found');
      return new Response(
        JSON.stringify({ 
          response: "I'm having configuration issues. Please try again later.",
          success: true,
          error: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('✅ API key found! Fetching comprehensive data from TheUnaHub...');

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch comprehensive data from ALL relevant tables in parallel
    const [
      eventsData,
      communitiesData, 
      postsData,
      itemsData,
      neighborIdeasData,
      neighborQuestionsData,
      couponsData,
      storiesData
    ] = await Promise.all([
      supabase.from('events').select('id, title, description, location, date, time, price, mood, event_type').limit(8),
      supabase.from('communities').select('id, name, tagline, description, category, subcategory, member_count').limit(6),
      supabase.from('posts').select('id, content, location, created_at').limit(5),
      supabase.from('items').select('id, title, description, category, location, price').eq('status', 'active').limit(6),
      supabase.from('neighborhood_ideas').select('id, question, neighborhood, market').limit(4),
      supabase.from('neighbor_questions').select('id, content, market, message_type').limit(4),
      supabase.from('user_coupons').select('id, title, description, business_name, discount_amount, neighborhood').eq('is_active', true).limit(4),
      supabase.from('stories').select('id, text_content, story_type').gt('expires_at', 'now()').limit(3)
    ]);

    console.log('📊 Data fetched - Events:', eventsData.data?.length, 'Communities:', communitiesData.data?.length, 'Posts:', postsData.data?.length, 'Items:', itemsData.data?.length);

    // Prepare comprehensive context with REAL data
    const realData = {
      currentEvents: eventsData.data || [],
      activeCommunities: communitiesData.data || [],
      recentPosts: postsData.data || [],
      marketplaceItems: itemsData.data || [],
      neighborhoodIdeas: neighborIdeasData.data || [],
      neighborQuestions: neighborQuestionsData.data || [],
      localCoupons: couponsData.data || [],
      activeStories: storiesData.data || [],
      userLocation: userLocation || 'Not specified'
    };

    // Detect repetitive messages
    let repetitionContext = '';
    if (conversationHistory && conversationHistory.length >= 3) {
      const lastThreeUser = conversationHistory
        .filter(m => m.role === 'user')
        .slice(-3)
        .map(m => m.content.toLowerCase().trim());
      
      if (lastThreeUser.length === 3 && 
          lastThreeUser[0] === lastThreeUser[1] && 
          lastThreeUser[1] === lastThreeUser[2]) {
        repetitionContext = '\n\n⚠️ IMPORTANT: User has asked the same question 3 times. They likely need more specific help or a different approach. Be proactive, offer specific suggestions, ask clarifying questions, or provide actionable next steps.';
      }
    }

    // Create detailed system prompt with ALL real data
    const systemPrompt = `You are Una, the friendly AI assistant for TheUnaHub neighborhood platform. You're warm, conversational, and genuinely helpful - like a knowledgeable local friend who knows everything happening in the neighborhood.

🎯 YOUR PERSONALITY:
- Be warm and personable, not robotic
- Use natural, conversational language
- Show enthusiasm about local events and community
- When users seem stuck or repeat questions, proactively offer alternatives or ask clarifying questions
- Be engaging - don't just list information, tell mini-stories about what's happening
- If someone asks the same thing multiple times, recognize it and try a different approach

🎯 REAL CURRENT DATA AVAILABLE:

📅 EVENTS (${realData.currentEvents.length} active):
${realData.currentEvents.map(e => `- "${e.title}" at ${e.location} on ${e.date} ${e.time ? 'at ' + e.time : ''} ${e.price ? '($' + e.price + ')' : ''} - ${e.description?.substring(0, 100)}...`).join('\n')}

👥 COMMUNITIES (${realData.activeCommunities.length} active):
${realData.activeCommunities.map(c => `- "${c.name}" (${c.member_count} members) - ${c.category} - ${c.tagline || c.description?.substring(0, 80)}`).join('\n')}

🏪 MARKETPLACE (${realData.marketplaceItems.length} items):
${realData.marketplaceItems.map(i => `- "${i.title}" in ${i.category} at ${i.location} for $${i.price} - ${i.description?.substring(0, 60)}...`).join('\n')}

💡 NEIGHBORHOOD IDEAS (${realData.neighborhoodIdeas.length} recent):
${realData.neighborhoodIdeas.map(n => `- "${n.question}" in ${n.neighborhood}`).join('\n')}

❓ NEIGHBOR QUESTIONS (${realData.neighborQuestions.length} recent):
${realData.neighborQuestions.map(q => `- ${q.content?.substring(0, 80)}...`).join('\n')}

🎫 LOCAL DEALS (${realData.localCoupons.length} active):
${realData.localCoupons.map(c => `- ${c.discount_amount} off at ${c.business_name} - ${c.title}`).join('\n')}

📍 User Location: ${realData.userLocation}

🤖 CONVERSATION GUIDELINES:
1. Reference specific events, communities, or items from the real data
2. Be conversational - use phrases like "I noticed..." or "There's this great..."
3. Keep responses around 100-150 words but make them engaging
4. If the conversation history shows repeated questions, acknowledge it and try a different angle
5. Ask follow-up questions when appropriate to better understand what they need
6. Suggest related things they might be interested in
7. Show personality - be enthusiastic about cool events or deals!${repetitionContext}`;

    console.log('🤖 Calling OpenAI with comprehensive data context...');

    // Prepare messages with conversation history
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(conversationHistory && conversationHistory.length > 1 
        ? conversationHistory.slice(1, -1) // Exclude initial greeting and current message
        : []
      ),
      { role: 'user', content: message }
    ];

    console.log('🤖 Calling OpenAI with conversation context...');

    // Make OpenAI API call with comprehensive context
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 200,
        temperature: 0.8
      })
    });

    console.log('📡 OpenAI response status:', response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ OpenAI API error:', response.status, errorData);
      
      return new Response(
        JSON.stringify({ 
          response: "I'm having trouble connecting to my AI service. Please try again in a moment.",
          success: true,
          error: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('✅ Got OpenAI response successfully');
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('❌ Invalid response format');
      throw new Error('Invalid response format');
    }
    
    const aiResponse = data.choices[0].message.content;
    console.log('🎉 Success! Returning AI response with comprehensive real data');

    return new Response(
      JSON.stringify({ 
        response: aiResponse,
        success: true 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('💥 Error in ai-assistant function:', error);
    
    let errorMessage = "Sorry, I'm having technical difficulties. Please try again.";
    
    if (error.message.includes('API key')) {
      errorMessage = "I'm having API configuration issues. Please contact support.";
    } else if (error.message.includes('timeout')) {
      errorMessage = "The request timed out. Please try a shorter question.";
    }
    
    return new Response(
      JSON.stringify({ 
        response: errorMessage,
        success: true,
        error: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});