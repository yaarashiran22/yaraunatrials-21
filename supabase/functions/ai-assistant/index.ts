import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🚀 Yara AI Assistant - Initialized');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userLocation, conversationHistory, userProfile, isWhatsApp, isTrulyFirstMessage } = await req.json();
    console.log('📥 Request:', { message, historyLength: conversationHistory?.length, hasProfile: !!userProfile, isWhatsApp, isTrulyFirstMessage });
    
    // Initialize OpenAI
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error('❌ OpenAI API key missing');
      return new Response(
        JSON.stringify({ 
          response: "I'm having configuration issues. Please try again later.",
          success: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Initialize Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch data in parallel
    const [eventsData, businessesData] = await Promise.all([
      supabase
        .from('events')
        .select('id, title, description, location, date, time, image_url')
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .limit(10),
      supabase
        .from('profiles')
        .select('id, name, bio, location, profile_image_url')
        .eq('profile_type', 'business')
        .limit(10)
    ]);

    console.log('✅ Data loaded - Events:', eventsData.data?.length, 'Businesses:', businessesData.data?.length);

    // Build system prompt
    const systemPrompt = buildSystemPrompt({
      userProfile,
      conversationHistory,
      isTrulyFirstMessage,
      isWhatsApp,
      message,
      events: eventsData.data || [],
      businesses: businessesData.data || []
    });

    // Prepare messages
    const recentHistory = conversationHistory?.slice(-6) || [];
    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentHistory,
      { role: 'user', content: message }
    ];

    // Define tools for WhatsApp
    const tools = isWhatsApp ? [{
      type: "function",
      function: {
        name: "send_recommendation_with_image",
        description: "Send ONE recommendation with image. Call multiple times for multiple recommendations.",
        parameters: {
          type: "object",
          properties: {
            message: { type: "string", description: "1-2 sentence description with personalization" },
            image_url: { type: "string", description: "Full image URL" },
            recommendation_type: { type: "string", enum: ["event", "business"] }
          },
          required: ["message", "image_url", "recommendation_type"]
        }
      }
    }] : undefined;

    // Call OpenAI
    console.log('🤖 Calling OpenAI with GPT-5 Mini...');
    const requestBody: any = {
      model: 'gpt-5-mini-2025-08-07',
      messages,
      max_completion_tokens: 500 // GPT-5 uses max_completion_tokens, not max_tokens
      // Note: GPT-5 does not support temperature parameter
    };

    if (isWhatsApp && tools) {
      requestBody.tools = tools;
      requestBody.parallel_tool_calls = true;
      // Don't force tool usage - let AI decide when to use tools vs text
      console.log('📱 WhatsApp mode: Tools available (AI will decide when to use)');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ OpenAI error:', response.status, errorData);
      return new Response(
        JSON.stringify({ 
          response: "I'm having trouble connecting right now. Try again in a moment.",
          success: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message;

    if (!assistantMessage) {
      console.error('❌ Invalid OpenAI response - no message in choices');
      console.error('Full response:', JSON.stringify(data));
      return new Response(
        JSON.stringify({ 
          response: "Something went wrong. Please try again.",
          success: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 Response analysis:', {
      hasContent: !!assistantMessage.content,
      contentLength: assistantMessage.content?.length || 0,
      hasToolCalls: !!assistantMessage.tool_calls,
      toolCallsCount: assistantMessage.tool_calls?.length || 0,
      finishReason: data.choices?.[0]?.finish_reason
    });

    // Log if response is empty
    if (!assistantMessage.content && !assistantMessage.tool_calls) {
      console.error('❌ EMPTY RESPONSE from OpenAI');
      console.error('Full assistant message:', JSON.stringify(assistantMessage));
      console.error('Finish reason:', data.choices?.[0]?.finish_reason);
    }

    // Handle tool calls (recommendations with images)
    if (assistantMessage.tool_calls?.length > 0) {
      console.log(`📸 Processing ${assistantMessage.tool_calls.length} tool calls for recommendations`);
      
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
          response: assistantMessage.content || 'Check these out:',
          recommendations,
          success: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Regular text response
    const textResponse = assistantMessage.content || "Hey! What can I help you find?";
    console.log('✅ Response sent');

    return new Response(
      JSON.stringify({ 
        response: textResponse,
        success: true 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ 
        response: "Sorry, something went wrong. Please try again.",
        success: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Build system prompt based on context
function buildSystemPrompt(context: {
  userProfile: any;
  conversationHistory: any[];
  isTrulyFirstMessage: boolean;
  isWhatsApp: boolean;
  message: string;
  events: any[];
  businesses: any[];
}): string {
  const { userProfile, conversationHistory, isTrulyFirstMessage, isWhatsApp, message, events, businesses } = context;
  
  // Core personality
  let prompt = `You are Yara, TheUnaHub's AI vibe curator. You're chill, direct, and authentic - like a local friend who knows all the best spots in Buenos Aires.

🎯 PERSONALITY:
- Speak casually (use "tbh", "ngl", "lowkey", "def" naturally, don't overdo it)
- Be decisive - don't ask unnecessary questions
- Keep responses SHORT (2-3 sentences max unless asked for details)
- Sound like you're texting a friend, not giving a tour
- Be honest - if nothing matches, say "nothing rn"

`;

  // Greeting behavior
  const greetingPatterns = /^(hey|hi|hello|sup|yo|what's up|whats up|hola)[\s!?.]*$/i;
  const isGreeting = greetingPatterns.test(message.trim());
  
  if (isTrulyFirstMessage) {
    prompt += `🚨 FIRST MESSAGE EVER:
Start with: "Hey! Welcome to Yara AI- if you're looking for cool events, hidden deals and bohemian spots in BA- I got you."
Then add a relevant response based on their message.

`;
  } else if (isGreeting && (!conversationHistory || conversationHistory.length < 2)) {
    prompt += `🚨 GREETING:
Keep it brief: "Hey! What can I help you find?" 

`;
  }

  // Gratitude detection
  const gratitudePatterns = /^(thanks|thank you|thx|ty|cool|awesome|perfect|great)[\s!?.]*$/i;
  const hasQuestionOrRequest = /\b(can|could|would|what|where|when|why|how|tell|show|find|more|about)\b/i.test(message);
  
  if (gratitudePatterns.test(message.trim()) && !hasQuestionOrRequest) {
    prompt += `🙏 USER SAID THANKS:
Respond exactly: "You're welcome- I'm here if you need anything else 😊"
DO NOT add anything more.

`;
  }

  // WhatsApp mode
  if (isWhatsApp) {
    prompt += `📱 WHATSAPP MODE - TOOL USAGE FOR RECOMMENDATIONS:

🚨 CRITICAL: When recommending 2+ events/businesses, you MUST use the send_recommendation_with_image tool.

WHEN TO USE THE TOOL:
- User asks for: "events", "parties", "bars", "cafes", "recommendations", "things to do"
- You want to share multiple places with images
- Use it 3-5 times (once per recommendation)

WHEN TO USE REGULAR TEXT:
- Greetings ("hi", "hello")
- Questions ("what neighborhood?")  
- Thanks/gratitude responses
- Clarifications
- Single-item responses

TOOL FORMAT:
{
  content: "Check these out:",
  tool_calls: [
    { function: "send_recommendation_with_image", arguments: {...} },
    { function: "send_recommendation_with_image", arguments: {...} }
  ]
}

🚨 NEVER write "send_recommendation_with_image(...)" as text in your response!

`;
  }

  // User profile personalization
  if (userProfile) {
    const interests = userProfile.interests?.join(', ') || 'None specified';
    const location = userProfile.location || 'Unknown';
    const age = userProfile.age || 'Unknown';
    const name = userProfile.name || 'Unknown';
    
    prompt += `👤 USER PROFILE:
- Name: ${name}
- Location: ${location}
- Age: ${age}
- Interests: ${interests}

🎯 PERSONALIZATION RULES:
`;
    
    if (userProfile.location) {
      prompt += `- ONLY recommend things in/near ${location}\n`;
    } else {
      prompt += `- Ask their neighborhood\n`;
    }
    
    if (userProfile.interests?.length > 0) {
      prompt += `- Match their interests: ${interests}\n`;
    } else {
      prompt += `- Ask what they're into\n`;
    }
    
    if (userProfile.age) {
      prompt += `- Filter by age appropriateness (they're ${age})\n`;
    }
    
    prompt += '\n';
  } else {
    prompt += `❓ NO PROFILE:
- Ask: "Which neighborhood? What are you into?"
- Use answers to filter recommendations

`;
  }

  // Recommendation strategy
  prompt += `💡 RECOMMENDATION STRATEGY:
- "cool parties"/"events" → ${isWhatsApp ? 'Use send_recommendation_with_image tool 3-5 times' : 'Send EVENT recommendations (3-5)'}
- "bar"/"cafe"/"chill spot" → ${isWhatsApp ? 'Use send_recommendation_with_image tool 3-5 times' : 'Send BUSINESS recommendations (3-5)'}
- "things to do" → ${isWhatsApp ? 'Use send_recommendation_with_image tool for mix of events AND businesses' : 'Mix events AND businesses'}
- Don't ask clarifying questions - just recommend
- Add personalization to each (5-10 words why it fits)
${isWhatsApp ? '\n🚨 REMEMBER: Use the TOOL, not text, for sending recommendations with images!' : ''}

`;

  // Data context
  prompt += `📊 AVAILABLE DATA:

📅 UPCOMING EVENTS (${events.length}):
${events.length > 0 ? events.map(e => 
  `- "${e.title}" at ${e.location} on ${e.date} ${e.time || ''}${e.image_url ? ` [IMAGE: ${e.image_url}]` : ''}`
).join('\n') : 'None available'}

🏢 BUSINESSES (${businesses.length}):
${businesses.length > 0 ? businesses.map(b => 
  `- "${b.name}" in ${b.location || 'BA'}${b.profile_image_url ? ` [IMAGE: ${b.profile_image_url}]` : ''} - ${b.bio?.substring(0, 100) || 'No description'}`
).join('\n') : 'None available'}

`;

  // Conversation history context
  if (conversationHistory && conversationHistory.length > 0) {
    prompt += `💬 CONVERSATION CONTEXT:
- You have ${conversationHistory.length} previous messages
- Remember what was discussed
- Don't repeat recommendations
- Build on previous context

`;
  }

  // Critical rules
  prompt += `⚠️ CRITICAL RULES:
1. ONLY mention real events/businesses from data above
2. NEVER make up venues, events, or dates
3. If nothing matches: "nothing rn, but check back"
4. Match categories correctly (food→food, art→art, music→music)
5. ALWAYS respond with real content (no generic "I'm here" messages)
6. When user says "more info" - provide details about what was just discussed
7. Be conversational and context-aware`;

  return prompt;
}