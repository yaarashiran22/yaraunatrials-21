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

    // Check if this phone number has EVER messaged before (for truly first-time detection)
    const { count: totalMessageCount } = await supabase
      .from('whatsapp_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('phone_number', from);

    const conversationHistory = recentHistory || [];
    const isNewConversation = conversationHistory.length === 0;
    const isTrulyFirstMessage = (totalMessageCount === 0); // Has NEVER messaged before
    
    console.log(`Found ${conversationHistory.length} messages in last 7 minutes for ${from}. Is new conversation: ${isNewConversation}. Is truly first message ever: ${isTrulyFirstMessage}`);

    // Try to find user profile by WhatsApp number
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, age, location, interests, bio')
      .eq('whatsapp_number', from)
      .maybeSingle();

    console.log('User profile:', profile ? `Found profile for ${profile.name}` : 'No profile found');

    // Store user message
    await supabase.from('whatsapp_conversations').insert({
      phone_number: from,
      role: 'user',
      content: body
    });

    // Send typing indicator to show bot is processing
    // Note: WhatsApp Business API via Twilio doesn't support native "..." typing bubbles
    // But we can send an immediate reaction to acknowledge receipt
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioWhatsAppNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER');

    if (twilioAccountSid && twilioAuthToken && twilioWhatsAppNumber) {
      try {
        // Send a quick reaction emoji to acknowledge receipt (best we can do with WhatsApp API)
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              From: twilioWhatsAppNumber,
              To: from,
              Body: '👀' // Quick acknowledgment
            }).toString()
          }
        );
        console.log('✅ Sent typing acknowledgment');
      } catch (error) {
        console.log('⚠️ Could not send typing indicator:', error);
        // Continue anyway - not critical
      }
    }


    // Call the AI assistant function with history and profile
    const { data: aiResponse, error: aiError } = await supabase.functions.invoke('ai-assistant', {
      body: { 
        message: body,
        userLocation: profile?.location || null,
        conversationHistory: conversationHistory,
        userProfile: profile || null,
        isWhatsApp: true,
        isTrulyFirstMessage: isTrulyFirstMessage
      }
    });

    if (aiError) {
      console.error('AI assistant error:', aiError);
      throw aiError;
    }

    console.log('AI response received:', JSON.stringify(aiResponse));

    // Check if we have recommendations with images
    if (aiResponse?.recommendations && Array.isArray(aiResponse.recommendations) && aiResponse.recommendations.length > 0) {
      console.log(`📸 AI wants to send ${aiResponse.recommendations.length} recommendations with images`);
      
      // Build TwiML response with recommendations
      let twimlMessages = '';
      
      // Add text response if there is one
      if (aiResponse.response && aiResponse.response.trim()) {
        twimlMessages += `<Message>${aiResponse.response}</Message>\n`;
        
        // Store the text response
        await supabase.from('whatsapp_conversations').insert({
          phone_number: from,
          role: 'assistant',
          content: aiResponse.response
        });
      }
      
      // Add each recommendation as a separate message with image
      for (const rec of aiResponse.recommendations) {
        if (rec.image_url && rec.image_url.trim() !== '') {
          twimlMessages += `<Message>
  <Body>${rec.message}</Body>
  <Media>${rec.image_url}</Media>
</Message>\n`;
        } else {
          twimlMessages += `<Message>${rec.message}</Message>\n`;
        }
        
        // Store each recommendation in conversation history
        await supabase.from('whatsapp_conversations').insert({
          phone_number: from,
          role: 'assistant',
          content: rec.message
        });
      }
      
      const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
${twimlMessages}</Response>`;

      console.log('Sending TwiML response with recommendations');
      
      return new Response(twimlResponse, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
        status: 200
      });
    }

    // Single message responses (no recommendations)
    // 🚨 CRITICAL: AI must ALWAYS generate real content, never empty
    if (!aiResponse?.response || !aiResponse.response.trim()) {
      console.error('❌ AI returned empty response - this should never happen');
      console.error('AI Response:', JSON.stringify(aiResponse));
      
      // Log for debugging but still try to recover
      const errorMessage = 'Sorry, I had a hiccup. Can you rephrase that?';
      await supabase.from('whatsapp_conversations').insert({
        phone_number: from,
        role: 'assistant',
        content: errorMessage
      });
      
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${errorMessage}</Message></Response>`,
        { headers: { ...corsHeaders, 'Content-Type': 'text/xml' }, status: 200 }
      );
    }

    const assistantMessage = aiResponse.response;
    console.log('Single message response:', assistantMessage);

    // Store assistant response
    await supabase.from('whatsapp_conversations').insert({
      phone_number: from,
      role: 'assistant',
      content: assistantMessage
    });

    // Return TwiML response
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${assistantMessage}</Message>
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
