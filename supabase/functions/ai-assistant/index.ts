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
    const { message, userLocation, conversationHistory, userProfile, isWhatsApp, isTrulyFirstMessage } = await req.json();
    console.log('AI Assistant v9.0 - Conversational & Context-Aware - Processing:', { message, userLocation, historyLength: conversationHistory?.length, hasUserProfile: !!userProfile, isWhatsApp, isTrulyFirstMessage });
    
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

    // Fetch only essential data in parallel (optimized for speed)
    // Only fetch events and businesses - most common queries
    const [eventsData, businessProfilesData] = await Promise.all([
      supabase.from('events').select('id, title, description, location, date, time, image_url').gte('date', new Date().toISOString().split('T')[0]).order('date', { ascending: true }).limit(5), // Reduced to 5, removed unused fields
      supabase.from('profiles').select('id, name, bio, location, profile_image_url').eq('profile_type', 'business').limit(5) // Reduced to 5, removed unused fields
    ]);

    console.log('📊 Data fetched - Events:', eventsData.data?.length, 'Businesses:', businessProfilesData.data?.length);

    // Prepare streamlined context with essential data only
    const realData = {
      currentEvents: eventsData.data || [],
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
    if (isTrulyFirstMessage) {
      // Truly first time this phone number has EVER messaged
      console.log('Truly first message ever from this user');
      greetingContext = `\n\n🚨 MANDATORY FIRST MESSAGE FORMAT:
Start your response with this EXACT welcome message:
"Hey! Welcome to Yara AI- if you're looking for cool events, hidden deals and bohemian spots in BA- I got you."

Then IMMEDIATELY continue with an AI-generated response based on what the user asked. For example:
- If they ask about events → Welcome message + recommend 3-4 events
- If they ask about bars → Welcome message + recommend 3-4 bars
- If they just say "hi" → Welcome message + "What vibe are you after?"

DO NOT just send the welcome alone. Always add a relevant AI response after it.`;
    } else if (isFirstMessage || shouldResetConversation) {
      // Returning user after timeout or new session
      console.log('Returning user - keep it simple with Hey + AI response');
      greetingContext = '\n\n🎯 RETURNING USER: Start with "Hey" then provide an AI response based on their message. Be conversational and helpful.';
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

    // Detect gratitude/thanks - MUST be standalone, not part of a question
    const gratitudePatterns = /^(thanks|thank you|thx|ty|appreciate it|cool|awesome|perfect|great|sounds good)[\s!?.]*$/i;
    const isGratitude = gratitudePatterns.test(message.trim());
    
    // Check if message contains a question or request (even if it starts with "thanks")
    const hasQuestionOrRequest = /\b(can|could|would|should|what|where|when|why|how|tell me|show me|find|info|more|about|please)\b/i.test(message);
    
    let gratitudeContext = '';
    if (isGratitude && !hasQuestionOrRequest) {
      // Only treat as pure gratitude if there's NO question/request
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

🚨 CRITICAL - YOU MUST ALWAYS RESPOND WITH REAL CONTENT:
- NEVER use generic fallback messages like "I got your message" or "I'm here"
- ALWAYS generate contextual responses based on the conversation
- If user asks for "more info" → Provide detailed information about what was just discussed
- If unclear → Ask a specific clarifying question based on context
- Use conversation history to understand what they're referring to
- Be helpful and conversational - treat every message as important
` : `
🎯 NO PROFILE - GET INFO FAST:
User is NOT logged in. To personalize:
1. Ask: "Which neighborhood? What are you into?"
2. Use this info immediately to filter recommendations
DO NOT ask for their name or age - focus on location and interests only.
`}

🎯 YOUR VIBE:
${isWhatsApp ? `
🚨 WHATSAPP MODE - CRITICAL RULES:
- 🚨 YOU MUST USE THE TOOL - NEVER send markdown images or text lists
- When recommending events/businesses, ALWAYS call send_recommendation_with_image() 
- Give 3-4 recommendations using the tool 3-4 times
- Each tool call = one recommendation with its image
- DO NOT write lists with markdown like "1. Event name ![](url)"
- DO NOT include image URLs in your text response
- Your "response" field should ONLY have a brief intro like "Check these out:" or "Here's what's happening:"
- Then call the tool multiple times for each recommendation
- Each recommendation should be 1-2 sentences max in the tool's "message" field
- Include WHY it's a good fit in 5-10 words
- Example format:
  * response: "Here are some cool parties:"
  * Tool call 1: send_recommendation_with_image(message: "Soria party at Villa Crespo Oct 24, 10:38 PM. DJ techno set, perfect for a fun night 🎶", image_url: "https://...", recommendation_type: "event")
  * Tool call 2: send_recommendation_with_image(message: "Live Girl Pop Band at San Telmo Oct 22, 8:32 PM. 2000s hits, great for a lively night 🎤", image_url: "https://...", recommendation_type: "event")
  * Tool call 3: send_recommendation_with_image(...)
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

🎯 SMART RECOMMENDATION STRATEGY (NO QUESTIONS):
When user asks about "places to go", "things to do", "parties", etc:
  
  🧠 BE DECISIVE - DON'T ASK, JUST RECOMMEND:
  - "cool parties" / "what's happening" / "events tonight" → Send EVENT recommendations immediately
  - "bar" / "cafe" / "chill spot" / "hang out" → Send BUSINESS recommendations immediately
  - "things to do" / "what's up" / "going out" → Send BOTH events AND businesses (mix them)
  
  🎯 NEVER ASK CLARIFYING QUESTIONS:
  - DON'T ask "You looking for events or bars?"
  - DON'T ask "What neighborhood?"
  - DON'T ask "What are you into?"
  - Just make smart assumptions and send recommendations
  - If they don't specify neighborhood → recommend things across popular areas (Palermo, San Telmo, Recoleta)
  - If they don't specify interests → send diverse options (music, art, food, nightlife)
  
  ✨ PERSONALIZATION EXPLANATIONS:
  - For EACH recommendation, add WHY it's a good fit in 5-10 words
  - Examples:
    * "Great for your age group" (if user age is known)
    * "Matches your jazz vibes" (if user has interests)
    * "Perfect Palermo spot for you" (if user location is known)
    * "Indie crowd, your style" (general vibe matching)
  - If NO user data → use general appeals like "Super popular spot" or "Hidden gem vibe"
  
  📝 RECOMMENDATION FORMAT:
  "[Venue/Event Name] - [1 sentence description]. [Personalization reason in 5-10 words] 🎵/🎨/🍻"
  
  Example: "Jazz Night at Darsena - Live music every Tuesday at 9pm. Matches your jazz vibes perfectly 🎵"

📸 PHOTO RECOMMENDATIONS LIMIT:
- When sending recommendations WITH PHOTOS: Send MAX 5 recommendations with photos
- If you have MORE than 5 recommendations: Send first 5 with photos, then send the rest in ONE text message without photos
- Format the text-only recommendations clearly with numbering (e.g., "6. Bar Name - Description")

🔍 SMART MATCHING ALGORITHM:
${userProfile ? `
PRIORITY ORDER FOR RECOMMENDATIONS:
1. ${hasLocation ? `Prioritize ${userProfile.location} but also suggest nearby neighborhoods` : 'Suggest popular neighborhoods (Palermo, San Telmo, Recoleta)'}
2. ${hasInterests && userProfile.interests.length > 0 ? `Match interests: ${userProfile.interests.join(', ')}` : 'Mix of music, art, food, nightlife'}
3. 🚨 CATEGORY MATCH: Check business bio/specialties match what user is looking for (food→food, art→art, etc.)
4. ${hasAge ? `Target age group ${userProfile.age}` : 'Mix of age-friendly venues'}
5. Match music preferences if user mentioned specific genres (use music_type field)
6. Match venue size to user preferences (intimate for smaller groups, big for parties)
7. Match price_range to user budget (cheap/moderate/expensive)
8. Check conversation history - don't repeat, build on what they liked
9. If they asked for specifics (e.g., "jazz"), ONLY show events with that music_type
` : `Mix popular spots across neighborhoods with diverse vibes (music, art, food, nightlife)`}

🎯 REAL DATA:

🚨 CRITICAL - ONLY FUTURE EVENTS:
ALL events listed below are happening TODAY OR IN THE FUTURE. NEVER mention past events. If a user asks about something that already happened, say "that was in the past, but here's what's coming up..."

📅 EVENTS (${realData.currentEvents.length}) - ALL UPCOMING:
${realData.currentEvents.length > 0 ? realData.currentEvents.map(e => `- "${e.title}" at ${e.location} on ${e.date} ${e.time ? 'at ' + e.time : ''}${e.image_url ? ` [IMAGE: ${e.image_url}]` : ''} - ${e.description?.substring(0, 80)}...`).join('\n') : 'Nothing upcoming rn.'}

🏢 BUSINESSES (${realData.businessProfiles.length}):
${realData.businessProfiles.length > 0 ? realData.businessProfiles.map(b => `- "${b.name}" in ${b.location || 'location'}${b.profile_image_url ? ` [IMAGE: ${b.profile_image_url}]` : ''} - ${b.bio?.substring(0, 80)}...`).join('\n') : 'Nothing rn.'}

📍 Location: ${realData.userLocation}

🤖 HOW TO RESPOND:
1. READ THE USER'S MESSAGE CAREFULLY - understand their intent but DON'T ask clarifying questions
2. BE DECISIVE - make smart assumptions based on context and send recommendations immediately
3. CHECK CONVERSATION HISTORY - understand what was just discussed to provide context-aware responses
4. Keep it SUPER SHORT (2-3 sentences max) - UNLESS it's a greeting, then give a proper intro
5. Be direct - no fluff, no lists unless asked
6. Use casual language like you're texting
7. ONLY mention real stuff from data above
8. 🚨 NEVER ASK CLARIFYING QUESTIONS:
   - DON'T ask "You looking for events or bars?"
   - DON'T ask "What neighborhood are you in?"
   - DON'T ask "What are you into?"
   - Just send recommendations based on smart assumptions
9. ALWAYS ADD PERSONALIZATION:
   - For each recommendation, explain WHY it's a good fit in 5-10 words
   - Use user data if available (age, location, interests)
   - If no user data, use general appeals like "Super popular" or "Hidden gem"
10. Match businesses by age (if user age is known) and neighborhood preference
11. When sharing business info, mention their WhatsApp if available so users can reach out
12. When sharing coupon codes, just drop the code naturally in conversation
13. 🚨 CRITICAL - NEVER USE GENERIC FALLBACKS:
    - If nothing matches: "nothing rn for that vibe"
    - If user asks "more info": Look at conversation history and provide details about what was just recommended
    - If unclear: Make a smart assumption and send recommendations anyway
    - ALWAYS generate real, contextual content - no generic "I'm here" or "I got your message"
14. Sound indie/artsy but authentic
15. Don't oversell - keep it chill
16. Prioritize businesses with similar age targets as the user
17. BE CONVERSATIONAL - understand context, pick up on hints, read between the lines${greetingContext}${repetitionContext}`;

    console.log('🤖 Calling OpenAI with comprehensive data context...');

    // Prepare messages - only keep last 2 user messages for speed
    const recentMessages = conversationHistory && conversationHistory.length > 2
      ? conversationHistory.slice(-2)
      : conversationHistory || [];
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentMessages,
      { role: 'user', content: message }
    ];

    console.log('🤖 Calling OpenAI with conversation context...');

    // Define tools for structured recommendations with images
    const tools = isWhatsApp ? [
      {
        type: "function",
        function: {
          name: "send_recommendation_with_image",
          description: "Send a single recommendation with an image. Call this function MULTIPLE times (3-4 times) to send multiple recommendations, each with their own image.",
          parameters: {
            type: "object",
            properties: {
              message: {
                type: "string",
                description: "The text message for this ONE recommendation (1-2 sentences max)"
              },
              image_url: {
                type: "string",
                description: "The URL of the image to send with this recommendation (event image, business profile picture, or coupon image). If no image available, use empty string."
              },
              recommendation_type: {
                type: "string",
                enum: ["event", "business", "coupon"],
                description: "Type of this recommendation"
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
      max_tokens: 300, // Reduced for speed
      temperature: 0.7 // Reduced for faster, more focused responses
    };

    // Add tools for WhatsApp to enable image sending
    if (isWhatsApp) {
      requestBody.tools = tools;
      requestBody.tool_choice = "required"; // FORCE AI to use the tool - never send markdown images
      requestBody.parallel_tool_calls = true; // Enable calling the tool multiple times for multiple recommendations
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
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('❌ Invalid response format');
      throw new Error('Invalid response format');
    }
    
    const assistantMessage = data.choices[0].message;
    
    // Check if AI used the tool to send images (can be multiple calls)
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      console.log(`🖼️ AI wants to send ${assistantMessage.tool_calls.length} recommendations with images`);
      
      // Collect all recommendations with images
      const recommendations = assistantMessage.tool_calls
        .filter(tc => tc.function.name === 'send_recommendation_with_image')
        .map(tc => {
          const args = JSON.parse(tc.function.arguments);
          return {
            message: args.message,
            image_url: args.image_url || '',
            recommendation_type: args.recommendation_type
          };
        });
      
      return new Response(
        JSON.stringify({ 
          response: assistantMessage.content || '',
          recommendations: recommendations, // Array of multiple recommendations
          success: true 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
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