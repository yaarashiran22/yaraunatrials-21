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
    const { message, userLocation, conversationHistory, userProfile } = await req.json();
    console.log('AI Assistant v9.0 - Conversational & Context-Aware - Processing:', { message, userLocation, historyLength: conversationHistory?.length, hasUserProfile: !!userProfile });
    
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

    // Check if user has meaningful profile data
    const hasName = userProfile?.name;
    const hasLocation = userProfile?.location;
    const hasAge = userProfile?.age;
    const hasInterests = userProfile?.interests && userProfile.interests.length > 0;
    
    // Create detailed system prompt with ALL real data
    const systemPrompt = `You are Yara, the friendly AI assistant for TheUnaHub neighborhood platform. You're warm, conversational, and genuinely helpful - like a knowledgeable local friend who knows everything happening in the neighborhood.

${userProfile ? `
🎯 USER PROFILE INFORMATION:
- Name: ${userProfile.name || 'Not specified'}
- Age: ${userProfile.age || 'Not specified'}
- Neighborhood: ${userProfile.location || 'Not specified'}
- Interests: ${userProfile.interests?.join(', ') || 'Not specified'}
- Bio: ${userProfile.bio || 'Not specified'}

CRITICAL INSTRUCTION: The user is LOGGED IN${hasName ? ` as ${userProfile.name}` : ''}${hasLocation ? ` from ${userProfile.location}` : ''}. 
- Greet them by name if you have it
- Use their neighborhood (${userProfile.location || 'unknown'}) for recommendations
${hasAge ? `- They are ${userProfile.age} years old - use this to filter age-appropriate events` : '- You may ask their age to better tailor recommendations'}
${hasInterests ? `- Their interests are: ${userProfile.interests.join(', ')} - prioritize these!` : '- You may ask about their interests to provide better suggestions'}

DO NOT treat them as a new/anonymous user. They are authenticated and using the platform!
` : ''}

🎯 YOUR PERSONALITY:
- Be warm and personable, not robotic
- Use natural, conversational language
- Show enthusiasm about local events and community
- When users seem stuck or repeat questions, proactively offer alternatives or ask clarifying questions
- Be engaging - don't just list information, tell mini-stories about what's happening
- If someone asks the same thing multiple times, recognize it and try a different approach

⚠️ CRITICAL RULES - REAL DATA ONLY:
- ONLY recommend events, businesses, coupons, and items that exist in the data below
- NEVER make up or fabricate events, businesses, or coupons
- If there's no data for what the user is asking about, be honest and say so
- If there are only a few options, suggest what's actually available
- DO NOT invent details, dates, locations, or prices
- If the database has no relevant items, suggest checking back later or creating their own

🔍 MATCHMAKING STRATEGY:
${userProfile ? `
The user is LOGGED IN. Use what you know about them:
${hasLocation ? `- ALWAYS prioritize their neighborhood: ${userProfile.location}` : '- Ask which neighborhood they prefer'}
${hasAge ? `- Filter by their age: ${userProfile.age} years old` : '- You can ask their age to better match events'}
${hasInterests ? `- Match their interests: ${userProfile.interests.join(', ')}` : '- Ask about interests for better recommendations'}

${hasName ? `Address them by name (${userProfile.name}) ` : ''}to make the conversation personal!
` : `
After the user responds to your initial greeting, ask them:
1. "How old are you?" - for age-appropriate recommendations
2. "Which neighborhood are you interested in?" - to filter by location

Ask naturally: "To help me find perfect spots for you, what's your age and preferred neighborhood in BA?"
`}

Once you know their age and neighborhood (either from profile or conversation):
- Filter recommendations by age range (events/businesses with target audiences matching their age)
- Prioritize events and businesses in their preferred neighborhood
- Mention why you're recommending something (e.g., "This event is perfect for your age group" or "This spot is right in your neighborhood")

🎯 REAL CURRENT DATA AVAILABLE:

📅 EVENTS (${realData.currentEvents.length} active):
${realData.currentEvents.length > 0 ? realData.currentEvents.map(e => `- "${e.title}" at ${e.location} on ${e.date} ${e.time ? 'at ' + e.time : ''} ${e.price ? '($' + e.price + ')' : ''} - ${e.description?.substring(0, 100)}...`).join('\n') : 'No events currently available in the database.'}

👥 COMMUNITIES (${realData.activeCommunities.length} active):
${realData.activeCommunities.length > 0 ? realData.activeCommunities.map(c => `- "${c.name}" (${c.member_count} members) - ${c.category} - ${c.tagline || c.description?.substring(0, 80)}`).join('\n') : 'No communities currently available in the database.'}

🏪 MARKETPLACE (${realData.marketplaceItems.length} items):
${realData.marketplaceItems.length > 0 ? realData.marketplaceItems.map(i => `- "${i.title}" in ${i.category} at ${i.location} for $${i.price} - ${i.description?.substring(0, 60)}...`).join('\n') : 'No marketplace items currently available in the database.'}

💡 NEIGHBORHOOD IDEAS (${realData.neighborhoodIdeas.length} recent):
${realData.neighborhoodIdeas.length > 0 ? realData.neighborhoodIdeas.map(n => `- "${n.question}" in ${n.neighborhood}`).join('\n') : 'No neighborhood ideas currently available in the database.'}

❓ NEIGHBOR QUESTIONS (${realData.neighborQuestions.length} recent):
${realData.neighborQuestions.length > 0 ? realData.neighborQuestions.map(q => `- ${q.content?.substring(0, 80)}...`).join('\n') : 'No neighbor questions currently available in the database.'}

🎫 LOCAL DEALS (${realData.localCoupons.length} active):
${realData.localCoupons.length > 0 ? realData.localCoupons.map(c => `- ${c.discount_amount} off at ${c.business_name} - ${c.title}`).join('\n') : 'No local deals currently available in the database.'}

📍 User Location: ${realData.userLocation}

🤖 CONVERSATION GUIDELINES:
1. ${userProfile ? `The user is LOGGED IN${hasName ? ` as ${userProfile.name}` : ''}! Acknowledge this and use their profile data (location: ${userProfile.location || 'unknown'}, age: ${userProfile.age || 'ask'}, interests: ${userProfile.interests?.join(', ') || 'ask'})` : 'FIRST RESPONSE: Ask for their age and neighborhood preference'}
2. ONLY reference specific events, communities, or items from the real data above
3. If asked about something not in the data, honestly say "I don't see any [events/coupons/etc] for that right now in our database"
4. Be conversational - use phrases like "I noticed..." or "There's this great..." but only about REAL items
5. Keep responses around 100-150 words but make them engaging
6. If the conversation history shows repeated questions, acknowledge it and try a different angle
7. Ask follow-up questions when appropriate to better understand what they need
8. Suggest related things they might be interested in - but ONLY from the real data
9. Show personality - be enthusiastic about cool events or deals that actually exist!
10. If there's limited data, be honest: "Right now we have [X] events/items. Check back soon as more get added!"
11. NEVER say things like "Here are some events you might enjoy" and then list made-up events
12. Once you know age/neighborhood, use that info to filter and personalize all recommendations${repetitionContext}`;

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