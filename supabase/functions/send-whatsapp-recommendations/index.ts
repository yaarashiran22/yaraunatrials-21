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
    const { recommendations, toNumber, fromNumber, introText } = await req.json();
    
    console.log(`Sending ${recommendations.length} recommendations to ${toNumber}`);
    
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    
    if (!twilioAccountSid || !twilioAuthToken) {
      throw new Error('Missing Twilio credentials');
    }

    // Ensure numbers have whatsapp: prefix
    const cleanFrom = fromNumber.includes('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;
    const cleanTo = toNumber.includes('whatsapp:') ? toNumber : `whatsapp:${toNumber}`;
    
    console.log(`Using From: ${cleanFrom}, To: ${cleanTo}`);

    const results = [];
    
    // Send intro text first if provided
    if (introText) {
      try {
        console.log('Sending intro text:', introText);
        
        const introResponse = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              From: cleanFrom,
              To: cleanTo,
              Body: introText
            }).toString()
          }
        );
        
        if (introResponse.ok) {
          console.log('✅ Intro text sent successfully');
          // Wait a moment before sending recommendations
          await new Promise(resolve => setTimeout(resolve, 1500));
        } else {
          console.error('❌ Failed to send intro text:', await introResponse.text());
        }
      } catch (error) {
        console.error('❌ Error sending intro text:', error);
      }
    }
    
    // Now send recommendations
    for (let i = 0; i < recommendations.length; i++) {
      const rec = recommendations[i];
      
      if (!rec.title || !rec.description) {
        console.log(`Skipping recommendation ${i + 1}: missing title or description`);
        continue;
      }

      const messageBody = `*${rec.title}*\n\n${rec.description}`;
      
      try {
        console.log(`[${i + 1}/${recommendations.length}] Sending: ${rec.title}`);
        
        // Build request body - only include MediaUrl if image exists
        const requestBody: Record<string, string> = {
          From: cleanFrom,
          To: cleanTo,
          Body: messageBody
        };
        
        if (rec.image_url) {
          requestBody.MediaUrl = rec.image_url;
        }
        
        const twilioResponse = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(requestBody).toString()
          }
        );

        if (!twilioResponse.ok) {
          const errorText = await twilioResponse.text();
          console.error(`❌ Failed to send ${rec.title}: ${twilioResponse.status} - ${errorText}`);
          results.push({ success: false, title: rec.title, error: errorText });
        } else {
          const result = await twilioResponse.json();
          console.log(`✅ Sent ${rec.title}. SID: ${result.sid}`);
          results.push({ success: true, title: rec.title, sid: result.sid });
        }
      } catch (error) {
        console.error(`❌ Error sending ${rec.title}:`, error);
        results.push({ success: false, title: rec.title, error: error.message });
      }

      // Wait between messages to avoid rate limits
      if (i < recommendations.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('✅ Finished sending all recommendations');
    
    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-whatsapp-recommendations:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
