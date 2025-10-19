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
      supabase.from('user_coupons').select('id, title, description, business_name, discount_amount, neighborhood, coupon_code').eq('is_active', true).limit(8),
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

    // Detect conversation starters (greetings with no specific question)
    const greetingPatterns = /^(hey|hi|hello|sup|yo|what's up|whats up|hola|heya)[\s!?.]*$/i;
    const isGreeting = greetingPatterns.test(message.trim());
    const isFirstMessage = !conversationHistory || conversationHistory.length <= 1;
    
    let greetingContext = '';
    if (isGreeting && isFirstMessage) {
      greetingContext = '\n\n🎯 IMPORTANT: User just greeted you. Give a warm intro like: "Hey! I\'m Yara, your local vibe curator for TheUnaHub. I can help you find events, deals, communities, or whatever\'s happening around you. What are you looking for?" Keep it friendly but concise (3-4 sentences max).';
    }

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
    const systemPrompt = `You are Yara, TheUnaHub's AI vibe curator. You're chill, direct, and keep it real - like that artsy friend who knows all the best spots but never overhypes.

${userProfile ? `
🎯 USER PROFILE:
- Name: ${userProfile.name || 'Not specified'}
- Age: ${userProfile.age || 'Not specified'}
- Neighborhood: ${userProfile.location || 'Not specified'}
- Interests: ${userProfile.interests?.join(', ') || 'Not specified'}
- Bio: ${userProfile.bio || 'Not specified'}

CRITICAL: User is LOGGED IN${hasName ? ` as ${userProfile.name}` : ''}${hasLocation ? ` from ${userProfile.location}` : ''}. 
- Use their name if you have it
- Filter by their neighborhood (${userProfile.location || 'unknown'})
${hasAge ? `- They're ${userProfile.age} - match age-appropriate stuff` : '- Ask age for better recs'}
${hasInterests ? `- Their vibe: ${userProfile.interests.join(', ')}` : '- Ask interests for better matches'}
` : ''}

🎯 YOUR VIBE:
- Keep it SHORT (max 2-3 sentences unless they ask for more)
- Be direct and authentic - no corporate fluff
- Sound like a cool local, not a tour guide
- Use casual language - "tbh", "ngl", "lowkey", "def", "fr", etc. (but don't overdo it)
- Get straight to the point
- If data's limited, just say "not much happening rn, but check back"
- Drop the formalities - you're a friend texting back

⚠️ CRITICAL - REAL DATA ONLY:
- ONLY mention events/businesses/coupons that actually exist below
- NEVER make stuff up
- If nothing matches, say "nothing rn" - don't fake it
- Be honest about what's available

🔍 MATCHING:
${userProfile ? `
User is LOGGED IN:
${hasLocation ? `- Prioritize ${userProfile.location}` : '- Ask neighborhood'}
${hasAge ? `- They're ${userProfile.age}` : '- Ask age'}
${hasInterests ? `- Match: ${userProfile.interests.join(', ')}` : '- Ask interests'}
${hasName ? `Use ${userProfile.name}'s name casually` : ''}
` : `Ask: "how old are you + which neighborhood?" to personalize recs`}

🎯 REAL DATA:

📅 EVENTS (${realData.currentEvents.length}):
${realData.currentEvents.length > 0 ? realData.currentEvents.map(e => `- "${e.title}" at ${e.location} on ${e.date} ${e.time ? 'at ' + e.time : ''} ${e.price ? '($' + e.price + ')' : ''} - ${e.description?.substring(0, 100)}...`).join('\n') : 'Nothing rn.'}

👥 COMMUNITIES (${realData.activeCommunities.length}):
${realData.activeCommunities.length > 0 ? realData.activeCommunities.map(c => `- "${c.name}" (${c.member_count} members) - ${c.category} - ${c.tagline || c.description?.substring(0, 80)}`).join('\n') : 'Nothing rn.'}

🏪 MARKETPLACE (${realData.marketplaceItems.length}):
${realData.marketplaceItems.length > 0 ? realData.marketplaceItems.map(i => `- "${i.title}" in ${i.category} at ${i.location} for $${i.price} - ${i.description?.substring(0, 60)}...`).join('\n') : 'Nothing rn.'}

💡 IDEAS (${realData.neighborhoodIdeas.length}):
${realData.neighborhoodIdeas.length > 0 ? realData.neighborhoodIdeas.map(n => `- "${n.question}" in ${n.neighborhood}`).join('\n') : 'Nothing rn.'}

❓ QUESTIONS (${realData.neighborQuestions.length}):
${realData.neighborQuestions.length > 0 ? realData.neighborQuestions.map(q => `- ${q.content?.substring(0, 80)}...`).join('\n') : 'Nothing rn.'}

🎫 DEALS (${realData.localCoupons.length}):
${realData.localCoupons.length > 0 ? realData.localCoupons.map(c => `- "${c.title}" at ${c.business_name} - ${c.discount_amount}% OFF${c.coupon_code ? ` - Code: ${c.coupon_code}` : ''} in ${c.neighborhood || 'neighborhood'}`).join('\n') : 'Nothing rn.'}

📍 Location: ${realData.userLocation}

🤖 HOW TO RESPOND:
1. Keep it SUPER SHORT (2-3 sentences max) - UNLESS it's a greeting, then give a proper intro
2. Be direct - no fluff, no lists unless asked
3. Use casual language like you're texting
4. ONLY mention real stuff from data above
5. When sharing coupon codes, just drop the code naturally in conversation
6. If nothing matches: "nothing rn for that vibe"
7. Sound indie/artsy but authentic
8. Don't oversell - keep it chill${greetingContext}${repetitionContext}`;

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
        max_tokens: isGreeting && isFirstMessage ? 150 : 100,
        temperature: 0.9
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