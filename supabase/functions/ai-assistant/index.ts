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
    const { message, userLocation, conversationHistory, userProfile, isWhatsApp } = await req.json();
    console.log('AI Assistant v9.0 - Conversational & Context-Aware - Processing:', { message, userLocation, historyLength: conversationHistory?.length, hasUserProfile: !!userProfile, isWhatsApp });
    
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
      storiesData,
      businessProfilesData
    ] = await Promise.all([
      supabase.from('events').select('id, title, description, location, date, time, price, mood, event_type, image_url, target_audience, music_type, venue_size, price_range').gte('date', new Date().toISOString().split('T')[0]).order('date', { ascending: true }).limit(8),
      supabase.from('communities').select('id, name, tagline, description, category, subcategory, member_count').limit(6),
      supabase.from('posts').select('id, content, location, created_at').limit(5),
      supabase.from('items').select('id, title, description, category, location, price').eq('status', 'active').limit(6),
      supabase.from('neighborhood_ideas').select('id, question, neighborhood, market').limit(4),
      supabase.from('neighbor_questions').select('id, content, market, message_type').limit(4),
      supabase.from('user_coupons').select('id, title, description, business_name, discount_amount, neighborhood, coupon_code, image_url').eq('is_active', true).limit(8),
      supabase.from('stories').select('id, text_content, story_type').gt('expires_at', 'now()').limit(3),
      supabase.from('profiles').select('id, name, bio, location, age, interests, specialties, whatsapp_number, profile_image_url').eq('profile_type', 'business').limit(10)
    ]);

    console.log('📊 Data fetched - Events:', eventsData.data?.length, 'Communities:', communitiesData.data?.length, 'Posts:', postsData.data?.length, 'Items:', itemsData.data?.length, 'Businesses:', businessProfilesData.data?.length);

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
      businessProfiles: businessProfilesData.data || [],
      userLocation: userLocation || 'Not specified'
    };

    // Detect conversation starters (greetings with no specific question)
    const greetingPatterns = /^(hey|hi|hello|sup|yo|what's up|whats up|hola|heya)[\s!?.]*$/i;
    const isGreeting = greetingPatterns.test(message.trim());
    const isFirstMessage = !conversationHistory || conversationHistory.length <= 1;
    
    // Check for conversation reset (7 minutes of inactivity)
    let shouldResetConversation = false;
    if (conversationHistory && conversationHistory.length > 0) {
      const sevenMinutesAgo = new Date(Date.now() - 7 * 60 * 1000);
      const lastMessageTime = new Date(conversationHistory[conversationHistory.length - 1].created_at || 0);
      shouldResetConversation = lastMessageTime < sevenMinutesAgo;
      console.log('Conversation timeout check:', { lastMessageTime, sevenMinutesAgo, shouldReset: shouldResetConversation });
    }
    
    let greetingContext = '';
    if (isFirstMessage || shouldResetConversation) {
      console.log('Starting fresh conversation - first message or timeout exceeded');
      // Always introduce on first message or after timeout with this exact message
      greetingContext = `\n\n🚨 MANDATORY FIRST MESSAGE - DO NOT DEVIATE:
You MUST respond with this EXACT text word-for-word (copy it exactly as written):
"Hey welcome to yara ai - if you're looking for indie events, hidden deals and bohemian spots in Buenos Aires- I'm here. What are you looking for?"

DO NOT paraphrase, DO NOT add anything, DO NOT change the wording. Use EXACTLY this text.`;
    } else if (isGreeting) {
      greetingContext = '\n\n🎯 IMPORTANT: User greeted you mid-conversation. Keep it brief like: "Hey! What can I help you find?" (1-2 sentences max).';
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

    // Detect gratitude/thanks
    const gratitudePatterns = /^(thanks|thank you|thx|ty|appreciate it|cool|awesome|perfect|great|sounds good)[\s!?.]*$/i;
    const isGratitude = gratitudePatterns.test(message.trim());
    let gratitudeContext = '';
    if (isGratitude) {
      gratitudeContext = '\n\n🙏 IMPORTANT: User just said thanks/expressed gratitude. Respond EXACTLY with: "You\'re welcome- I\'m here if you need anything else 😊" - DO NOT add anything more, DO NOT ask questions, DO NOT make suggestions.';
    }

    // Check if user has meaningful profile data
    const hasName = userProfile?.name;
    const hasLocation = userProfile?.location;
    const hasAge = userProfile?.age;
    const hasInterests = userProfile?.interests && userProfile.interests.length > 0;
    
    // Create detailed system prompt with ALL real data
    const systemPrompt = `You are Yara, TheUnaHub's AI vibe curator. You're chill, direct, and keep it real - like that artsy friend who knows all the best spots but never overhypes.
${gratitudeContext}${greetingContext}${repetitionContext}
${userProfile ? `
🎯 USER PROFILE - PERSONALIZE HEAVILY:
- Name: ${userProfile.name || 'Not specified'}
- Age: ${userProfile.age || 'Not specified'}
- Neighborhood: ${userProfile.location || 'Not specified'}
- Interests: ${userProfile.interests?.join(', ') || 'Not specified'}
- Bio: ${userProfile.bio || 'Not specified'}

🚨 CRITICAL PERSONALIZATION RULES:
${hasLocation ? '1. ONLY recommend things in or near ' + userProfile.location + ' - this is their neighborhood, prioritize it heavily' : '1. Ask which neighborhood they are in to give local recs'}
${hasAge ? '2. They are ' + userProfile.age + ' - filter out events/places that do not match their age range' : ''}
${hasInterests ? '3. Match their vibe: ' + userProfile.interests.join(', ') + ' - ONLY suggest things that align with these interests' : '2. Ask what they are into to personalize'}
4. Reference past conversations - if they asked about jazz before, mention new jazz events
5. Build on context - if they liked a specific place, suggest similar ones
6. Notice patterns - if they always ask about Palermo, focus there
` : `
🎯 NO PROFILE - GET INFO FAST:
User is NOT logged in. To personalize:
1. Ask: "Which neighborhood? What are you into?"
2. Use this info immediately to filter recommendations
DO NOT ask for their name or age - focus on location and interests only.
`}

🎯 YOUR PERSONALITY:
${isWhatsApp ? `
You're Yara - a helpful, friendly local guide who knows Buenos Aires inside out. You're conversational, warm, and smart about understanding context.

🧠 **BE CONTEXTUALLY INTELLIGENT**:
- Read between the lines - understand what the user ACTUALLY wants, not just keywords
- If someone says "goodnight", don't ask them what neighborhood they're in - wish them goodnight!
- If someone says "thanks" or "cool", acknowledge it naturally - don't push a new recommendation unless they ask
- If someone greets you after getting a recommendation, they likely want something NEW - don't repeat yourself
- Use conversation history intelligently to understand the flow
- Be a real person, not a scripted bot

📸 **IMAGE TOOL - USE FOR ALL RECOMMENDATIONS**:
When recommending events, businesses, or coupons, ALWAYS use the send_recommendation_with_image() tool:
- For events: Use event.image_url
- For businesses: Use business.profile_image_url
- For coupons: Use coupon.image_url
- If no image exists, pass empty string but still use the tool

Example: send_recommendation_with_image(
  message: "Jazz night at Café Tortoni, 9pm tonight 🎷",
  image_url: "https://...",
  recommendation_type: "event"
)

💬 **CONVERSATION TYPES - UNDERSTAND CONTEXT**:

**Farewells & Thank Yous**: "goodnight", "bye", "thanks", "thank you"
→ Respond warmly and naturally, close the conversation
→ "Night! 🌙" / "Anytime! 👋" / "Glad I could help! ✨"

**Greetings (after previous interaction)**: "hi", "hey", "hello"
→ They want something NEW - don't repeat last recommendation
→ Fresh start: "Hey! What are you in the mood for?"

**Follow-up Questions**: "more info?", "tell me more", "what time?", "where?"
→ They want details about what you JUST recommended
→ Share: target audience, price range, venue size, music type, exact location, time, date

**Acknowledgments**: "cool", "nice", "awesome", "sounds good"  
→ They're acknowledging, not requesting - respond naturally
→ "Right? It's gonna be good!" / "Let me know if you want more options"

**New Requests**: "any parties?", "what about coffee shops?", "show me more"
→ They want a new recommendation
→ Ask clarifying questions if needed (neighborhood, vibe)
→ Then recommend with the image tool

**Small Talk / Questions**: "how are you?", "what can you do?"
→ Answer naturally and helpfully
→ Keep it conversational

🎯 **YOUR STYLE**:
- Max 2-3 sentences for recommendations (this is WhatsApp!)
- 1 sentence for acknowledgments and follow-ups
- Emoji when it feels natural, not forced
- Casual Buenos Aires vibe - indie/artsy but authentic
- No corporate speak, no over-selling
- Match their energy - if they're brief, you're brief
- Filter by neighborhood when you know it
- Match their interests when you know them
` : `
🎨 WEBSITE CHAT MODE - CONVERSATIONAL BUT CONCISE:
- Keep it SHORT (max 2-3 sentences per response unless they specifically ask for more details)
- Be direct and authentic - no corporate fluff, no over-explaining
- Match the same chill, local friend vibe as WhatsApp
- If recommending multiple things, use bullet points to keep it scannable
- ALWAYS filter by their neighborhood if known
- Match their interests from profile
`}
- Sound like a cool local, not a tour guide
- Use casual language - "tbh", "ngl", "lowkey", "def", "fr", etc. (but don't overdo it)
- Get straight to the point
- If data's limited, just say "nothing rn, but check back"
- Drop the formalities - you're a friend texting back

📚 CONVERSATION MEMORY:
${conversationHistory && conversationHistory.length > 0 ? `
You have ${conversationHistory.length} messages of history. USE IT:
- Remember what they asked about before
- Build on previous recommendations
- Don't repeat suggestions
- Notice their preferences from past questions
- Reference things they seemed interested in
` : 'First conversation - get to know them!'}

⚠️ CRITICAL - REAL DATA ONLY:
- ONLY mention events/businesses/coupons that actually exist below
- NEVER make stuff up
- If nothing matches, say "nothing rn" - don't fake it
- Be honest about what's available
- 🚨 CRITICAL: MATCH BUSINESS CATEGORIES CORRECTLY!
  - If someone asks for FOOD/RESTAURANTS → ONLY recommend businesses with food/restaurant/cafe in their bio or specialties
  - If someone asks for ART → ONLY recommend businesses with art/gallery/creative in their bio or specialties
  - If someone asks for MUSIC → ONLY recommend music venues/events
  - NEVER recommend an art shop for food, or a restaurant for art supplies!

🔍 SMART MATCHING ALGORITHM:
${userProfile ? `
PRIORITY ORDER FOR RECOMMENDATIONS:
1. ${hasLocation ? `Must be in ${userProfile.location} (or walking distance)` : 'Ask neighborhood first'}
2. ${hasInterests && userProfile.interests.length > 0 ? `Must match at least one interest: ${userProfile.interests.join(', ')}` : 'Ask interests to filter'}
3. 🚨 CATEGORY MATCH: Check business bio/specialties match what user is looking for (food→food, art→art, etc.)
4. ${hasAge ? `Filter events by target_audience - user is ${userProfile.age}, so recommend events that match their age group` : 'Ask age to avoid mismatches'}
5. Match music preferences if user mentioned specific genres (use music_type field)
6. Match venue size to user preferences (intimate for smaller groups, big for parties)
7. Match price_range to user budget (cheap/moderate/expensive)
8. Check conversation history - don't repeat, build on what they liked
9. If they asked for specifics (e.g., "jazz"), ONLY show events with that music_type
` : `Ask: "What neighborhood? What are you into?" then match based on category and location`}

🎯 REAL DATA:

🚨 CRITICAL - ONLY FUTURE EVENTS:
ALL events listed below are happening TODAY OR IN THE FUTURE. NEVER mention past events. If a user asks about something that already happened, say "that was in the past, but here's what's coming up..."

📅 EVENTS (${realData.currentEvents.length}) - ALL UPCOMING:
${realData.currentEvents.length > 0 ? realData.currentEvents.map(e => `- "${e.title}" at ${e.location} on ${e.date} ${e.time ? 'at ' + e.time : ''}${e.target_audience ? ` (Ages: ${e.target_audience})` : ''}${e.music_type ? ` | Music: ${e.music_type}` : ''}${e.venue_size ? ` | Venue: ${e.venue_size}` : ''}${e.price_range ? ` | Price: ${e.price_range}` : e.price ? ` ($${e.price})` : ''}${e.image_url ? ` [IMAGE: ${e.image_url}]` : ''} - ${e.description?.substring(0, 100)}...`).join('\n') : 'Nothing upcoming rn.'}

🏢 BUSINESSES (${realData.businessProfiles.length}):
${realData.businessProfiles.length > 0 ? realData.businessProfiles.map(b => `- "${b.name}"${b.age ? ` (ages ${b.age}+)` : ''} in ${b.location || 'location'}${b.profile_image_url ? ` [IMAGE: ${b.profile_image_url}]` : ''} - ${b.bio?.substring(0, 100)}...${b.specialties?.length > 0 ? ' - Vibe: ' + b.specialties.join(', ') : ''}${b.whatsapp_number ? ' - WhatsApp: ' + b.whatsapp_number : ''}`).join('\n') : 'Nothing rn.'}

👥 COMMUNITIES (${realData.activeCommunities.length}):
${realData.activeCommunities.length > 0 ? realData.activeCommunities.map(c => `- "${c.name}" (${c.member_count} members) - ${c.category} - ${c.tagline || c.description?.substring(0, 80)}`).join('\n') : 'Nothing rn.'}

🏪 MARKETPLACE (${realData.marketplaceItems.length}):
${realData.marketplaceItems.length > 0 ? realData.marketplaceItems.map(i => `- "${i.title}" in ${i.category} at ${i.location} for $${i.price} - ${i.description?.substring(0, 60)}...`).join('\n') : 'Nothing rn.'}

💡 IDEAS (${realData.neighborhoodIdeas.length}):
${realData.neighborhoodIdeas.length > 0 ? realData.neighborhoodIdeas.map(n => `- "${n.question}" in ${n.neighborhood}`).join('\n') : 'Nothing rn.'}

❓ QUESTIONS (${realData.neighborQuestions.length}):
${realData.neighborQuestions.length > 0 ? realData.neighborQuestions.map(q => `- ${q.content?.substring(0, 80)}...`).join('\n') : 'Nothing rn.'}

🎫 DEALS (${realData.localCoupons.length}):
${realData.localCoupons.length > 0 ? realData.localCoupons.map(c => `- "${c.title}" at ${c.business_name} - ${c.discount_amount}% OFF${c.coupon_code ? ` - Code: ${c.coupon_code}` : ''}${c.image_url ? ` [IMAGE: ${c.image_url}]` : ''} in ${c.neighborhood || 'neighborhood'}`).join('\n') : 'Nothing rn.'}

📍 Location: ${realData.userLocation}

🤖 HOW TO RESPOND:
1. Keep it SUPER SHORT (2-3 sentences max) - UNLESS it's a greeting, then give a proper intro
2. Be direct - no fluff, no lists unless asked
3. Use casual language like you're texting
4. ONLY mention real stuff from data above
5. When users ask about places to go out/things to do: recommend BOTH events AND businesses that match their vibe
6. Match businesses by age (if user age is known) and neighborhood preference
7. When sharing business info, mention their WhatsApp if available so users can reach out
8. When sharing coupon codes, just drop the code naturally in conversation
9. If nothing matches: "nothing rn for that vibe"
10. Sound indie/artsy but authentic
11. Don't oversell - keep it chill
12. Prioritize businesses with similar age targets as the user${greetingContext}${repetitionContext}`;

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

    // Define tools for structured recommendations with images
    const tools = isWhatsApp ? [
      {
        type: "function",
        function: {
          name: "send_recommendation_with_image",
          description: "MANDATORY tool for sending ANY event, business, or coupon recommendation via WhatsApp. You MUST use this tool for ALL recommendations - do not send plain text event/business/coupon recommendations.",
          parameters: {
            type: "object",
            properties: {
              message: {
                type: "string",
                description: "The recommendation text (1-2 sentences max)"
              },
              image_url: {
                type: "string",
                description: "The full image URL from the event/business/coupon data (use event.image_url, business.profile_image_url, or coupon.image_url). Use empty string if no image available."
              },
              recommendation_type: {
                type: "string",
                enum: ["event", "business", "coupon"],
                description: "Type of recommendation being sent"
              }
            },
            required: ["message", "image_url", "recommendation_type"]
          }
        }
      }
    ] : undefined;

    // Make OpenAI API call with comprehensive context
    const requestBody: any = {
      model: 'gpt-4o-mini',
      messages: messages,
      // Increased max_tokens significantly to prevent truncation of tool call arguments with long URLs
      max_tokens: isWhatsApp ? 500 : (isFirstMessage ? 180 : (isGreeting ? 150 : 100)),
      temperature: 0.9
    };

    // Add tools for WhatsApp to enable image sending
    if (isWhatsApp) {
      requestBody.tools = tools;
      requestBody.tool_choice = "auto"; // Let AI decide when to use the tool
      console.log('🔧 Tools enabled for WhatsApp mode');
      console.log('🔧 Tool definition:', JSON.stringify(tools, null, 2));
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
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
    console.log('🔍 Full OpenAI response:', JSON.stringify(data, null, 2));
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('❌ Invalid response format');
      throw new Error('Invalid response format');
    }
    
    const assistantMessage = data.choices[0].message;
    
    // Log whether AI used tools or not
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      console.log('🛠️ AI IS USING TOOL CALLS');
      console.log('🔍 Tool calls:', JSON.stringify(assistantMessage.tool_calls, null, 2));
    } else {
      console.log('⚠️ WARNING: AI DID NOT USE TOOL CALLS - This is likely wrong for event recommendations!');
      console.log('📝 Plain text response:', assistantMessage.content);
    }
    
    // Check if AI used the tool to send an image
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolCall = assistantMessage.tool_calls[0];
      if (toolCall.function.name === 'send_recommendation_with_image') {
        try {
          // Log raw arguments before parsing
          console.log('🔍 Raw tool call arguments (first 500 chars):', toolCall.function.arguments.substring(0, 500));
          
          const args = JSON.parse(toolCall.function.arguments);
          console.log('🖼️ AI wants to send image:', args.image_url);
          
          return new Response(
            JSON.stringify({ 
              response: args.message,
              image_url: args.image_url,
              recommendation_type: args.recommendation_type,
              success: true 
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        } catch (parseError) {
          console.error('❌ Failed to parse tool call arguments:', parseError);
          console.error('Full tool call object:', JSON.stringify(toolCall, null, 2));
          // Fall through to return text-only response instead of crashing
        }
      }
    }
    
    const aiResponse = assistantMessage.content;
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