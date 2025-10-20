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

    // Call the AI assistant function with history and profile
    const { data: aiResponse, error: aiError } = await supabase.functions.invoke('ai-assistant', {
      body: { 
        message: body,
        userLocation: profile?.location || null,
        conversationHistory: conversationHistory,
        userProfile: profile || null,
        isWhatsApp: true  // Enable ultra-short WhatsApp mode
      }
    });

    if (aiError) {
      console.error('AI assistant error:', aiError);
      throw aiError;
    }

    console.log('AI response received:', JSON.stringify(aiResponse));

    // Check if we have multiple recommendations with images
    if (aiResponse?.recommendations && Array.isArray(aiResponse.recommendations)) {
      console.log(`📸 Sending ${aiResponse.recommendations.length} recommendations with images via Twilio`);
      
      // Send each recommendation as a separate message with its image
      const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
      const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
      const twilioWhatsAppNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER');
      
      if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsAppNumber) {
        console.error('❌ Twilio credentials missing');
        throw new Error('Twilio credentials not configured');
      }

      // Send up to 5 recommendations with images
      const recsWithImages = aiResponse.recommendations.slice(0, 5);
      const recsWithoutImages = aiResponse.recommendations.slice(5);
      
      // Send recommendations with images via Twilio API
      for (const rec of recsWithImages) {
        const messageData: any = {
          From: twilioWhatsAppNumber,
          To: from,
          Body: rec.message
        };
        
        // Only add MediaUrl if image_url exists and is not empty
        if (rec.image_url && rec.image_url.trim() !== '') {
          messageData.MediaUrl = rec.image_url;
        }
        
        try {
          const twilioResponse = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
            {
              method: 'POST',
              headers: {
                'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams(messageData).toString()
            }
          );
          
          if (!twilioResponse.ok) {
            const errorText = await twilioResponse.text();
            console.error('Twilio API error:', twilioResponse.status, errorText);
          } else {
            console.log(`✅ Sent recommendation with ${rec.image_url ? 'image' : 'text only'}`);
          }
        } catch (error) {
          console.error('Error sending message via Twilio:', error);
        }
        
        // Store each recommendation in conversation history
        await supabase.from('whatsapp_conversations').insert({
          phone_number: from,
          role: 'assistant',
          content: rec.message
        });
      }
      
      // If there are more than 5 recommendations, send the rest as one text message
      if (recsWithoutImages.length > 0) {
        const textOnlyMessage = recsWithoutImages
          .map((rec, idx) => `${idx + 6}. ${rec.message}`)
          .join('\n\n');
        
        const messageData = {
          From: twilioWhatsAppNumber,
          To: from,
          Body: textOnlyMessage
        };
        
        try {
          await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
            {
              method: 'POST',
              headers: {
                'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams(messageData).toString()
            }
          );
          console.log(`✅ Sent ${recsWithoutImages.length} text-only recommendations`);
        } catch (error) {
          console.error('Error sending text-only recommendations:', error);
        }
        
        await supabase.from('whatsapp_conversations').insert({
          phone_number: from,
          role: 'assistant',
          content: textOnlyMessage
        });
      }
      
      // Return empty TwiML since we've already sent messages via Twilio API
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
          status: 200
        }
      );
    }

    // Fallback for single message responses (no tool calls)
    const assistantMessage = aiResponse?.response || 'Sorry, I encountered an error processing your request.';
    console.log('Single message response:', assistantMessage);

    // Store assistant response
    await supabase.from('whatsapp_conversations').insert({
      phone_number: from,
      role: 'assistant',
      content: assistantMessage
    });

    // Return TwiML response (text only for fallback)
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${welcomeMessageSent ? "Hey welcome to yara ai - if you're looking for indie events, hidden deals and bohemian spots in Buenos Aires- I got you. What are you looking for?\n\n" : ""}${assistantMessage}</Message>
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
