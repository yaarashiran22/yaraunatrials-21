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

    // Store user message in background (non-blocking)
    const storeUserMessage = supabase.from('whatsapp_conversations').insert({
      phone_number: from,
      role: 'user',
      content: body
    });
    // Don't await - let it happen in background

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
      console.log(`📸 Sending ${aiResponse.recommendations.length} recommendations with images via Twilio API`);
      
      // Get Twilio credentials
      const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
      const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
      const twilioWhatsAppNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER');
      
      if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsAppNumber) {
        console.error('❌ Twilio credentials missing');
        throw new Error('Twilio credentials not configured');
      }

      // Send intro text first if there is one
      const introText = aiResponse.response && aiResponse.response.trim() 
        ? aiResponse.response 
        : "Here are some recommendations:";
      
      try {
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
              Body: introText
            }).toString()
          }
        );
        console.log('✅ Sent intro text');
        
        // Store intro in background
        supabase.from('whatsapp_conversations').insert({
          phone_number: from,
          role: 'assistant',
          content: introText
        });
      } catch (error) {
        console.error('Error sending intro:', error);
      }
      
      // Send each recommendation with image via Twilio API (proper WhatsApp format)
      for (const rec of aiResponse.recommendations) {
        const messageParams: any = {
          From: twilioWhatsAppNumber,
          To: from,
          Body: rec.message
        };
        
        // Add MediaUrl if image exists and is valid
        if (rec.image_url && rec.image_url.trim() && rec.image_url.startsWith('http')) {
          messageParams.MediaUrl = rec.image_url;
          console.log('📸 Attaching image:', rec.image_url.substring(0, 80));
        }
        
        try {
          const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
            {
              method: 'POST',
              headers: {
                'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams(messageParams).toString()
            }
          );
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('Twilio error:', response.status, errorText);
          } else {
            console.log(`✅ Sent recommendation ${rec.image_url ? 'with image' : 'text only'}`);
          }
        } catch (error) {
          console.error('Error sending recommendation:', error);
        }
        
        // Store in background
        supabase.from('whatsapp_conversations').insert({
          phone_number: from,
          role: 'assistant',
          content: rec.message
        });
      }
      
      // Return empty TwiML
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
          status: 200
        }
      );
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
