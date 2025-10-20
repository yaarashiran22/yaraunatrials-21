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

    // Check for recent conversation (last 7 minutes)
    const sevenMinutesAgo = new Date(Date.now() - 7 * 60 * 1000).toISOString();
    const { data: recentHistory } = await supabase
      .from('whatsapp_conversations')
      .select('role, content, created_at')
      .eq('phone_number', from)
      .gte('created_at', sevenMinutesAgo)
      .order('created_at', { ascending: true })
      .limit(20);

    const conversationHistory = recentHistory || [];
    const isNewConversation = conversationHistory.length === 0;
    console.log(`Found ${conversationHistory.length} messages in last 7 minutes for ${from}. Is new conversation: ${isNewConversation}`);

    // Check if message is a greeting OR a conversation starter
    const greetingPatterns = /^(hey|hi|hello|sup|yo|hola|what's up|whats up)[\s!?.]*$/i;
    const conversationStarterPatterns = /^(i'm looking for|i want|show me|find me|i need|looking for|what's|whats|tell me about|i'm into|im into|help me find)/i;
    const isGreeting = greetingPatterns.test(body.trim());
    const isConversationStarter = conversationStarterPatterns.test(body.trim());

    // Try to find user profile by WhatsApp number
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, age, location, interests, bio')
      .eq('whatsapp_number', from)
      .maybeSingle();

    console.log('User profile:', profile ? `Found profile for ${profile.name}` : 'No profile found');

    // If it's a greeting/conversation starter AND a new conversation, OR it's a conversation starter regardless of history, send welcome
    const shouldSendWelcome = (isGreeting && isNewConversation) || isConversationStarter;
    
    let welcomeMessageSent = false;
    if (shouldSendWelcome) {
      console.log('Sending welcome message - new conversation or conversation starter detected');
      
      const welcomeMessage = "Hey welcome to yara ai - if you're looking for indie events, hidden deals and bohemian spots in Buenos Aires- I got you. What are you looking for?";
      
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

    // Build conversation history for AI
    const messages = conversationHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));
    messages.push({ role: 'user', content: body });

    // Call Yara AI chat function (non-streaming for WhatsApp)
    const { data: aiResponse, error: aiError } = await supabase.functions.invoke('yara-ai-chat', {
      body: { messages, stream: false }
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

      // Get Twilio credentials
      const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
      const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
      const twilioWhatsAppNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER') || 'whatsapp:+17622513744';

      if (!twilioAccountSid || !twilioAuthToken) {
        console.error('Missing Twilio credentials');
        throw new Error('Twilio credentials not configured');
      }

      // Send intro message via TwiML (this will be the immediate response)
      const welcomeText = welcomeMessageSent ? "Hey welcome to yara ai - if you're looking for indie events, hidden deals and bohemian spots in Buenos Aires- I got you. What are you looking for?\n\n" : "";
      const introMessage = welcomeText + (parsedResponse.intro_message || 'Here are some that you might like:');
      
      const introTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${introMessage}</Message>
</Response>`;

      // Send follow-up messages with images as background task
      const sendRecommendations = async () => {
        console.log('Starting to send recommendations...');
        
        // Ensure both numbers have whatsapp: prefix
        const fromNumber = twilioWhatsAppNumber.startsWith('whatsapp:') 
          ? twilioWhatsAppNumber 
          : `whatsapp:${twilioWhatsAppNumber}`;
        const toNumber = from.startsWith('whatsapp:') 
          ? from 
          : `whatsapp:${from}`;
        
        console.log(`Will send from: ${fromNumber} to: ${toNumber}`);
        
        for (let i = 0; i < parsedResponse.recommendations.length; i++) {
          const rec = parsedResponse.recommendations[i];
          if (rec.image_url && rec.title && rec.description) {
            const messageBody = `*${rec.title}*\n\n${rec.description}`;
            
            try {
              console.log(`[${i+1}/${parsedResponse.recommendations.length}] Sending: ${rec.title}`);
              
              const twilioResponse = await fetch(
                `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
                    'Content-Type': 'application/x-www-form-urlencoded',
                  },
                  body: new URLSearchParams({
                    From: fromNumber,
                    To: toNumber,
                    Body: messageBody,
                    MediaUrl: rec.image_url
                  }).toString()
                }
              );

              if (!twilioResponse.ok) {
                const errorText = await twilioResponse.text();
                console.error(`Twilio error for ${rec.title}:`, twilioResponse.status, errorText);
              } else {
                const result = await twilioResponse.json();
                console.log(`✓ Sent ${rec.title}. SID: ${result.sid}`);
              }
            } catch (error) {
              console.error(`Error sending ${rec.title}:`, error);
            }

            // Delay between messages
            if (i < parsedResponse.recommendations.length - 1) {
              console.log('Waiting 1 second before next message...');
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } else {
            console.log(`Skipping recommendation ${i+1}: missing image_url or content`);
          }
        }
        console.log('Finished sending all recommendations');
      };

      // Use EdgeRuntime.waitUntil to ensure background task completes
      try {
        EdgeRuntime.waitUntil(sendRecommendations());
        console.log('Background task registered');
      } catch (error) {
        console.error('Error registering background task:', error);
        // If EdgeRuntime.waitUntil is not available, just await it
        await sendRecommendations();
      }

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

    const welcomeText = welcomeMessageSent ? "Hey welcome to yara ai - if you're looking for indie events, hidden deals and bohemian spots in Buenos Aires- I got you. What are you looking for?\n\n" : "";
    
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
