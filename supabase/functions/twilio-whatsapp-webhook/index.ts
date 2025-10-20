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

    // Extract phone number without WhatsApp prefix
    const phoneNumber = from.replace('whatsapp:', '');

    // Try to find user profile by WhatsApp number
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, age, location, interests, bio, whatsapp_number')
      .eq('whatsapp_number', phoneNumber)
      .maybeSingle();

    console.log('User profile:', profile ? `Found profile for ${profile.name}` : 'No profile found');

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

    // Handle NEW USERS (no profile)
    if (!profile) {
      // Check if we're in the middle of profile creation
      const lastAssistantMsg = conversationHistory.filter(m => m.role === 'assistant').pop();
      
      if (!lastAssistantMsg || isGreeting || isNewConversation) {
        // First interaction - ask for name
        const welcomeMessage = "Hey there! 👋 Welcome to Yara, your AI concierge for Buenos Aires indie events and nightlife. I'm here to help you discover the best the city has to offer. To personalize your recommendations, could you tell me your name?";
        
        await supabase.from('whatsapp_conversations').insert([
          { phone_number: from, role: 'user', content: body },
          { phone_number: from, role: 'assistant', content: welcomeMessage }
        ]);

        const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${welcomeMessage}</Message>
</Response>`;

        return new Response(twimlResponse, {
          headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
          status: 200
        });
      } 
      else if (lastAssistantMsg.content.includes('could you tell me your name?')) {
        // User provided their name - create profile
        const userName = body.trim();
        
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([{
            whatsapp_number: phoneNumber,
            name: userName,
            open_to_connecting: true
          }]);

        if (profileError) {
          console.error('Error creating profile:', profileError);
          const errorMessage = "Sorry, I had trouble setting up your profile. Let's try again - what's your name?";
          
          await supabase.from('whatsapp_conversations').insert([
            { phone_number: from, role: 'user', content: body },
            { phone_number: from, role: 'assistant', content: errorMessage }
          ]);

          const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${errorMessage}</Message>
</Response>`;

          return new Response(twimlResponse, {
            headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
            status: 200
          });
        }

        const successMessage = `Nice to meet you, ${userName}! 🎉\n\nYour profile is all set up. Now I can help you discover events, businesses, and deals in Buenos Aires tailored just for you!\n\nWhat are you looking for today? (e.g., "What's happening tonight?", "Find me a good restaurant", "Any deals in Palermo?")`;
        
        await supabase.from('whatsapp_conversations').insert([
          { phone_number: from, role: 'user', content: body },
          { phone_number: from, role: 'assistant', content: successMessage }
        ]);

        const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${successMessage}</Message>
</Response>`;

        return new Response(twimlResponse, {
          headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
          status: 200
        });
      }
    }

    // Handle EXISTING USERS with profile
    const shouldSendWelcome = (isGreeting && isNewConversation) || isConversationStarter;
    
    let welcomeMessageSent = false;
    if (shouldSendWelcome && profile) {
      console.log('Sending welcome message - existing user');
      
      const welcomeMessage = `Hey ${profile.name}! 👋 Welcome back to Yara. What are you looking for today?`;
      
      // Store welcome response
      await supabase.from('whatsapp_conversations').insert({
        phone_number: from,
        role: 'assistant',
        content: welcomeMessage
      });

      welcomeMessageSent = true;
      
      // For greetings only, return welcome and wait for next message
      if (isGreeting && !isConversationStarter) {
        await supabase.from('whatsapp_conversations').insert({
          phone_number: from,
          role: 'user',
          content: body
        });

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

    // Build conversation history for AI
    const messages = conversationHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));
    messages.push({ role: 'user', content: body });

    // Build user context for AI
    const userContext = profile ? {
      name: profile.name,
      age: profile.age,
      interests: profile.interests,
      location: profile.location,
      hasProfile: true,
      userId: profile.id
    } : {
      hasProfile: false
    };

    // Call Yara AI chat function (non-streaming for WhatsApp)
    const { data: aiResponse, error: aiError } = await supabase.functions.invoke('yara-ai-chat', {
      body: { messages, stream: false, userContext }
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


    // Handle recommendations with images
    if (parsedResponse && parsedResponse.recommendations && Array.isArray(parsedResponse.recommendations) && parsedResponse.recommendations.length > 0) {
      console.log(`Found ${parsedResponse.recommendations.length} recommendations to send`);
      
      // Store the assistant message
      await supabase.from('whatsapp_conversations').insert({
        phone_number: from,
        role: 'assistant',
        content: JSON.stringify(parsedResponse)
      });

      // Get Twilio WhatsApp number
      const twilioWhatsAppNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER') || 'whatsapp:+17622513744';

      // Prepare the intro message
      const welcomeText = welcomeMessageSent ? `Hey ${profile?.name || 'there'}! 👋 Welcome back to Yara.\n\n` : "";
      const introMessage = welcomeText + (parsedResponse.intro_message || 'Here are some that you might like:');
      
      // Trigger background function to send recommendations (don't await - fire and forget)
      console.log('Triggering send-whatsapp-recommendations function...');
      supabase.functions.invoke('send-whatsapp-recommendations', {
        body: {
          recommendations: parsedResponse.recommendations,
          toNumber: from,
          fromNumber: twilioWhatsAppNumber
        }
      }).then(({ data, error }) => {
        if (error) {
          console.error('Error invoking send-whatsapp-recommendations:', error);
        } else {
          console.log('Send-whatsapp-recommendations invoked successfully:', data);
        }
      });

      // Return intro message immediately via TwiML
      const introTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${introMessage}</Message>
</Response>`;

      console.log('Returning intro TwiML response');
      return new Response(introTwiml, {
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

    const welcomeText = welcomeMessageSent ? `Hey ${profile?.name || 'there'}! 👋 Welcome back to Yara.\n\n` : "";
    
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
