import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Twilio webhook received');
    
    // Parse form data from Twilio
    const formData = await req.formData();
    const from = formData.get('From') as string;
    const body = formData.get('Body') as string;
    const to = formData.get('To') as string;

    console.log('Twilio message:', { from, to, body });

    if (!body) {
      console.error('No message body received');
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { 
          headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
          status: 200 
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check for recent conversation (last 30 minutes for better context retention)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recentHistory } = await supabase
      .from('whatsapp_conversations')
      .select('role, content, created_at')
      .eq('phone_number', from)
      .gte('created_at', thirtyMinutesAgo)
      .order('created_at', { ascending: true })
      .limit(30);

    const conversationHistory = recentHistory || [];
    const isNewConversation = conversationHistory.length === 0;
    console.log(`Found ${conversationHistory.length} messages in last 30 minutes for ${from}. Is new conversation: ${isNewConversation}`);

    // Check if message is a greeting OR a conversation starter
    const greetingPatterns = /^(hey|hi|hello|sup|yo|hola|what's up|whats up)[\s!?.]*$/i;
    const conversationStarterPatterns = /^(i'm looking for|i want|show me|find me|i need|looking for|what's|whats|tell me about|i'm into|im into|help me find)/i;
    const isGreeting = greetingPatterns.test(body.trim());
    const isConversationStarter = conversationStarterPatterns.test(body.trim());

    // Get or create WhatsApp user profile
    let { data: whatsappUser } = await supabase
      .from('whatsapp_users')
      .select('*')
      .eq('phone_number', from)
      .maybeSingle();

    // Create new user if doesn't exist
    if (!whatsappUser) {
      console.log('Creating new WhatsApp user for', from);
      const { data: newUser, error: createError } = await supabase
        .from('whatsapp_users')
        .insert({ phone_number: from })
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating WhatsApp user:', createError);
      } else {
        whatsappUser = newUser;
      }
    }

    console.log('WhatsApp user:', whatsappUser ? `Found user ${whatsappUser.name || 'unnamed'}` : 'No user found');

    // If it's a greeting/conversation starter AND a new conversation, OR it's a conversation starter regardless of history, send welcome
    const shouldSendWelcome = (isGreeting && isNewConversation) || isConversationStarter;
    
    let welcomeMessageSent = false;
    if (shouldSendWelcome) {
      console.log('Sending welcome message - new conversation or conversation starter detected');
      
      const welcomeMessage = "Hey welcome to Yara AI - if you're looking for indie events, hidden deals and bohemian spots in Buenos Aires- I got you. What are you looking for?";
      
      // Store welcome response
      await supabase.from('whatsapp_conversations').insert({
        phone_number: from,
        role: 'assistant',
        content: welcomeMessage
      });

      welcomeMessageSent = true;
      
      // For conversation starters, continue to AI processing
      // For greetings only, return welcome and wait for next message
      if (isGreeting && !isConversationStarter) {
        // Store user message
        await supabase.from('whatsapp_conversations').insert({
          phone_number: from,
          role: 'user',
          content: body
        });

        // Return TwiML response with just welcome
        const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${welcomeMessage}</Message>
</Response>`;

        return new Response(twimlResponse, {
          headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
          status: 200
        });
      }
    }

    // Store user message (if not already stored)
    if (!welcomeMessageSent || !isGreeting) {
      await supabase.from('whatsapp_conversations').insert({
        phone_number: from,
        role: 'user',
        content: body
      });
    }

    // Detect and save age from user message
    const agePattern = /\b(\d{1,2})\b/g;
    const ageMatches = body.match(agePattern);
    if (ageMatches && whatsappUser && !whatsappUser.age) {
      // Check if the context suggests they're providing age
      const ageContextPatterns = /(i'm|im|i am|we're|were|we are|age|years? old|año|años)/i;
      if (ageContextPatterns.test(body) || body.trim().length < 20) {
        // Take the first reasonable age (between 10 and 99)
        const ages = ageMatches.map(m => parseInt(m)).filter(a => a >= 10 && a <= 99);
        if (ages.length > 0) {
          console.log(`Detected age(s): ${ages.join(', ')} - saving first age: ${ages[0]}`);
          await supabase
            .from('whatsapp_users')
            .update({ age: ages[0] })
            .eq('id', whatsappUser.id);
          
          // Update local whatsappUser object so AI has the latest data
          whatsappUser.age = ages[0];
        }
      }
    }

    // Detect if this is a recommendation request
    const recommendationKeywords = /\b(recommend|suggest|show me|find me|looking for|what's|any|events?|bars?|clubs?|venues?|places?|tonight|today|tomorrow|weekend|esta noche|hoy|mañana|fin de semana|dance|music|live|party|art|food)\b/i;
    const isRecommendationRequest = recommendationKeywords.test(body);

    // Note: We'll send intro message later with recommendations instead of acknowledgment

    // Build conversation history for AI
    const messages = conversationHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));
    messages.push({ role: 'user', content: body });

    // Call Yara AI chat function with user profile context
    const { data: aiResponse, error: aiError } = await supabase.functions.invoke('yara-ai-chat', {
      body: { 
        messages, 
        stream: false,
        userProfile: whatsappUser, // Pass user profile to AI
        phoneNumber: from // Pass phone number for tracking
      }
    });

    if (aiError) {
      console.error('Yara AI error:', aiError);
      throw aiError;
    }

    // Extract AI response
    let assistantMessage = '';
    if (aiResponse) {
      assistantMessage = aiResponse.message || 'Sorry, I encountered an error processing your request.';
    }

    console.log('Yara AI raw response:', assistantMessage);

    // Try to parse as JSON - extract JSON from text if needed
    let cleanedMessage = assistantMessage.trim();
    
    // Try to extract JSON from the response
    // Look for a JSON object starting with { and ending with }
    const jsonMatch = cleanedMessage.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedMessage = jsonMatch[0];
      console.log('Extracted JSON from response:', cleanedMessage.substring(0, 200) + '...');
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(cleanedMessage);
      console.log('Successfully parsed JSON response with', parsedResponse.recommendations?.length || 0, 'recommendations');
    } catch (e) {
      // Not JSON, just a regular conversational response
      console.log('Response is not valid JSON, treating as conversational text');
      parsedResponse = null;
    }


    // Handle recommendations response (even if empty - don't show raw JSON)
    if (parsedResponse && parsedResponse.recommendations && Array.isArray(parsedResponse.recommendations)) {
      console.log(`Found ${parsedResponse.recommendations.length} recommendations to send`);
      
      // If no recommendations found, send a helpful message instead of JSON
      if (parsedResponse.recommendations.length === 0) {
        const noResultsMessage = "I couldn't find specific matches for that right now. Try asking about something else - like 'bars in Palermo' or 'live music tonight'!";
        
        await supabase.from('whatsapp_conversations').insert({
          phone_number: from,
          role: 'assistant',
          content: noResultsMessage
        });
        
        const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${noResultsMessage}</Message>
</Response>`;
        
        return new Response(twimlResponse, {
          headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
          status: 200
        });
      }
      
      // Increment recommendation count for progressive profiling
      if (whatsappUser) {
        await supabase
          .from('whatsapp_users')
          .update({ recommendation_count: (whatsappUser.recommendation_count || 0) + 1 })
          .eq('id', whatsappUser.id);
      }
      
      // Store the assistant message
      await supabase.from('whatsapp_conversations').insert({
        phone_number: from,
        role: 'assistant',
        content: JSON.stringify(parsedResponse)
      });

      // Get Twilio WhatsApp number
      const twilioWhatsAppNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER') || 'whatsapp:+17622513744';

      // Prepare the intro message
      const welcomeText = welcomeMessageSent ? "Hey welcome to Yara AI - if you're looking for indie events, hidden deals and bohemian spots in Buenos Aires- I got you. What are you looking for?\n\n" : "";
      const introMessage = welcomeText + (parsedResponse.intro_message || "Here are some recommendations for you:");
      
      // Invoke send-whatsapp-recommendations to send both intro and recommendations
      console.log('Triggering send-whatsapp-recommendations function...');
      
      // Call the function directly - it will send all messages including intro
      supabase.functions.invoke('send-whatsapp-recommendations', {
        body: {
          recommendations: parsedResponse.recommendations,
          toNumber: from,
          fromNumber: twilioWhatsAppNumber,
          introText: introMessage
        }
      }).then(({ data, error }) => {
        if (error) {
          console.error('Error invoking send-whatsapp-recommendations:', error);
        } else {
          console.log('Send-whatsapp-recommendations invoked successfully:', data);
        }
      }).catch(error => {
        console.error('Failed to invoke send-whatsapp-recommendations:', error);
      });

      // Return empty TwiML response immediately - messages will be sent by the function
      const emptyTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`;

      console.log('Returning empty TwiML response - recommendations will be sent by background function');
      return new Response(emptyTwiml, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
        status: 200
      });
    }

    // Regular conversational response (no recommendations)
    console.log('Sending conversational response');
    
    // Store the assistant message
    await supabase.from('whatsapp_conversations').insert({
      phone_number: from,
      role: 'assistant',
      content: assistantMessage
    });

    const welcomeText = welcomeMessageSent ? "Hey welcome to Yara AI - if you're looking for indie events, hidden deals and bohemian spots in Buenos Aires- I got you. What are you looking for?\n\n" : "";
    
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${welcomeText}${assistantMessage}</Message>
</Response>`;

    console.log('Sending TwiML response');
    
    return new Response(twimlResponse, {
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      status: 200
    });

  } catch (error) {
    console.error('Error in Twilio webhook:', error);
    
    // Return empty TwiML response on error
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Sorry, I encountered an error. Please try again later.</Message></Response>',
      { 
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
        status: 200 
      }
    );
  }
});
