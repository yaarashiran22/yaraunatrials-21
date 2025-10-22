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
    
    // Build conversation history for AI
    const messages = conversationHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));
    messages.push({ role: 'user', content: body });

    // For recommendation requests: send immediate ack and process in background
    if (isRecommendationRequest) {
      // Process AI response in background for recommendations
      EdgeRuntime.waitUntil((async () => {
        try {
          console.log('Processing recommendation request in background...');
          
          const { data: aiResponse, error: aiError } = await supabase.functions.invoke('yara-ai-chat', {
            body: { messages, stream: false, userProfile: whatsappUser, phoneNumber: from }
          });

          if (aiError) {
            console.error('Yara AI error:', aiError);
            return;
          }

          let assistantMessage = aiResponse?.message || '';
          let cleanedMessage = assistantMessage.trim();
          const jsonMatch = cleanedMessage.match(/\{[\s\S]*\}/);
          if (jsonMatch) cleanedMessage = jsonMatch[0];

          let parsedResponse;
          try {
            parsedResponse = JSON.parse(cleanedMessage);
          } catch (e) {
            parsedResponse = null;
          }

          if (parsedResponse?.recommendations && Array.isArray(parsedResponse.recommendations)) {
            if (parsedResponse.recommendations.length === 0) {
              const noResultsMessage = "I couldn't find specific matches. Try 'bars in Palermo' or 'live music tonight'!";
              await supabase.from('whatsapp_conversations').insert({
                phone_number: from, role: 'assistant', content: noResultsMessage
              });
              
              const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
              const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
              const twilioWhatsAppNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER') || 'whatsapp:+17622513744';
              
              await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`, {
                method: 'POST',
                headers: {
                  'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({ From: twilioWhatsAppNumber, To: from, Body: noResultsMessage })
              });
              return;
            }
            
            if (whatsappUser) {
              await supabase.from('whatsapp_users')
                .update({ recommendation_count: (whatsappUser.recommendation_count || 0) + 1 })
                .eq('id', whatsappUser.id);
            }
            
            await supabase.from('whatsapp_conversations').insert({
              phone_number: from, role: 'assistant', content: JSON.stringify(parsedResponse)
            });

            const twilioWhatsAppNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER') || 'whatsapp:+17622513744';
            await supabase.functions.invoke('send-whatsapp-recommendations', {
              body: {
                recommendations: parsedResponse.recommendations,
                toNumber: from,
                fromNumber: twilioWhatsAppNumber,
                introText: null
              }
            });
          }
        } catch (error) {
          console.error('Background processing error:', error);
        }
      })());

      const welcomeText = welcomeMessageSent ? "Hey welcome to Yara AI - if you're looking for indie events, hidden deals and bohemian spots in Buenos Aires- I got you. What are you looking for?\n\n" : "";
      const immediateMessage = welcomeText + "Yes! Sending you recommendations in just a minute! 🎯";
      
      const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${immediateMessage}</Message>
</Response>`;

      return new Response(twimlResponse, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
        status: 200
      });
    }

    // For conversational messages: wait for AI and respond immediately
    console.log('Processing conversational message...');
    
    const { data: aiResponse, error: aiError } = await supabase.functions.invoke('yara-ai-chat', {
      body: { messages, stream: false, userProfile: whatsappUser, phoneNumber: from }
    });

    if (aiError) {
      console.error('Yara AI error:', aiError);
      throw aiError;
    }

    const assistantMessage = aiResponse?.message || 'Sorry, I encountered an error.';
    
    await supabase.from('whatsapp_conversations').insert({
      phone_number: from, role: 'assistant', content: assistantMessage
    });

    const welcomeText = welcomeMessageSent ? "Hey welcome to Yara AI - if you're looking for indie events, hidden deals and bohemian spots in Buenos Aires- I got you. What are you looking for?\n\n" : "";
    
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${welcomeText}${assistantMessage}</Message>
</Response>`;

    console.log('Sending conversational TwiML response');
    
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
