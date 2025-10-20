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

    // Check if this is the very first time this phone number has texted (ever)
    const { data: allHistory } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('phone_number', from)
      .limit(1);

    const isFirstTimeUser = !allHistory || allHistory.length === 0;
    console.log(`Is first time user: ${isFirstTimeUser}`);

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
    
    if (shouldSendWelcome) {
      console.log('Sending welcome message - new conversation or conversation starter detected');
      
      // Store user message
      await supabase.from('whatsapp_conversations').insert({
        phone_number: from,
        role: 'user',
        content: body
      });

      // Different welcome message for first-time users vs returning users
      const welcomeMessage = isFirstTimeUser 
        ? "Hey, welcome to Yara AI! If you're looking for indie events, hidden spots and exclusive deals in Buenos Aires- I got you. What vibe are you after?"
        : "hey- what are you looking for?";
      
      console.log(`Sending ${isFirstTimeUser ? 'first-time' : 'returning'} user welcome message`);
      
      // Store welcome response
      await supabase.from('whatsapp_conversations').insert({
        phone_number: from,
        role: 'assistant',
        content: welcomeMessage
      });

      // Return TwiML response
      const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${welcomeMessage}</Message>
</Response>`;

      return new Response(twimlResponse, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
        status: 200
      });
    }

    // Store user message
    await supabase.from('whatsapp_conversations').insert({
      phone_number: from,
      role: 'user',
      content: body
    });

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
      
      // Return user-friendly error message
      const errorResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Sorry, I encountered an error processing your request.</Message>
</Response>`;
      
      return new Response(errorResponse, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
        status: 200
      });
    }

    // Check if we got multiple recommendations
    const recommendations = aiResponse?.recommendations; // Array of recommendations
    const singleResponse = aiResponse?.response; // Single text response (fallback)
    
    if (recommendations && recommendations.length > 0) {
      console.log(`📸 Sending ${recommendations.length} separate recommendation messages`);
      
      // Send each recommendation as a separate message
      const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
      const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
      const twilioWhatsAppNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER');
      
      if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsAppNumber) {
        console.error('Missing Twilio credentials');
      } else {
        // Send each recommendation as a separate message via Twilio API
        for (const rec of recommendations) {
          console.log(`Sending recommendation: ${rec.message.substring(0, 50)}...`);
          
          // Store each recommendation in conversation history
          await supabase.from('whatsapp_conversations').insert({
            phone_number: from,
            role: 'assistant',
            content: rec.message
          });
          
          // Prepare Twilio API request
          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
          const formBody = new URLSearchParams({
            From: twilioWhatsAppNumber,
            To: from,
            Body: rec.message
          });
          
          // Add media if image URL exists
          if (rec.image_url) {
            formBody.append('MediaUrl', rec.image_url);
          }
          
          // Send via Twilio API
          const twilioResponse = await fetch(twilioUrl, {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formBody
          });
          
          if (!twilioResponse.ok) {
            console.error('Twilio API error:', await twilioResponse.text());
          } else {
            console.log('✅ Sent recommendation message via Twilio API');
          }
        }
      }
      
      // Return empty TwiML since we sent messages via API
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
          status: 200
        }
      );
    }
    
    // Fallback to single response (backward compatibility)
    const assistantMessage = singleResponse || 'Sorry, I encountered an error processing your request.';
    const imageUrl = aiResponse?.image_url;
    console.log('AI response:', assistantMessage);
    if (imageUrl) {
      console.log('📸 Image URL to send:', imageUrl);
    }

    // Store assistant response
    await supabase.from('whatsapp_conversations').insert({
      phone_number: from,
      role: 'assistant',
      content: assistantMessage
    });

    // Return TwiML response with optional media
    let twimlResponse: string;
    
    if (imageUrl) {
      // Send message with image
      twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>
    <Body>${assistantMessage}</Body>
    <Media>${imageUrl}</Media>
  </Message>
</Response>`;
    } else {
      // Send text-only message
      twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${assistantMessage}</Message>
</Response>`;
    }

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
