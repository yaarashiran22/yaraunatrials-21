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
    
    // Deduplicate recommendations by id to prevent sending duplicates
    const uniqueRecs = recommendations.reduce((acc: any[], rec: any) => {
      if (!acc.some(r => r.id === rec.id)) {
        acc.push(rec);
      }
      return acc;
    }, []);
    
    const duplicatesRemoved = recommendations.length - uniqueRecs.length;
    if (duplicatesRemoved > 0) {
      console.log(`Removed ${duplicatesRemoved} duplicate recommendation(s)`);
    }
    
    console.log(`Sending ${uniqueRecs.length} unique recommendations to ${toNumber}`);
    
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
          // Minimal delay before sending recommendations for faster delivery
          await new Promise(resolve => setTimeout(resolve, 400));
        } else {
          console.error('❌ Failed to send intro text:', await introResponse.text());
        }
      } catch (error) {
        console.error('❌ Error sending intro text:', error);
      }
    }
    
    // Now send recommendations
    for (let i = 0; i < uniqueRecs.length; i++) {
      const rec = uniqueRecs[i];
      
      // Extract title from description if not provided
      let title = rec.title;
      if (!title && rec.description) {
        // Try to extract title from first line of description
        const firstLine = rec.description.split('\n')[0].trim();
        title = firstLine.length > 100 ? 'Event Recommendation' : firstLine;
      }
      
      if (!title) {
        console.log(`Skipping recommendation ${i + 1}: missing title and description`);
        continue;
      }

      // Build description from available fields if not provided by AI
      let description = rec.description;
      if (!description && rec.why_recommended) {
        // Construct a minimal description from why_recommended
        description = rec.why_recommended;
      }
      
      if (!description) {
        console.log(`Skipping recommendation ${i + 1}: missing both description and why_recommended`);
        continue;
      }

      // Make date and time bold in the description
      let formattedDescription = description;
      if (formattedDescription) {
        // Bold date patterns (Date: ...)
        formattedDescription = formattedDescription.replace(/Date: ([^\n.]+)/gi, '*Date: $1*');
        // Bold time patterns (Time: ...)
        formattedDescription = formattedDescription.replace(/Time: ([^\n.]+)/gi, '*Time: $1*');
      }
      
      let messageBody = `*${title}*\n\n${formattedDescription}`;
      
      // Add URL link if available (Instagram for clubs/bars, WhatsApp for communities)
      if (rec.url) {
        messageBody += `\n\n🔗 ${rec.url}`;
      }
      
      // CRITICAL: Only add personalized_note for events, NOT for topListItems (clubs/bars/communities)
      if (rec.personalized_note && rec.type === 'event') {
        messageBody += `\n\n✨ *Just for you:* ${rec.personalized_note}`;
      }
      
      try {
        console.log(`[${i + 1}/${uniqueRecs.length}] Sending: ${rec.title}`);
        console.log(`Message body length: ${messageBody.length} chars`);
        console.log(`Has image: ${!!rec.image_url}, Has URL: ${!!rec.url}`);
        
        // Build request body - only include MediaUrl if image exists
        const requestBody: Record<string, string> = {
          From: cleanFrom,
          To: cleanTo,
          Body: messageBody
        };
        
        if (rec.image_url) {
          console.log(`Image URL: ${rec.image_url}`);
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
          console.error(`Full error response:`, errorText);
          results.push({ success: false, title: rec.title, error: errorText });
        } else {
          const result = await twilioResponse.json();
          console.log(`✅ Sent ${rec.title}. SID: ${result.sid}, Status: ${result.status}`);
          results.push({ success: true, title: rec.title, sid: result.sid });
        }
      } catch (error) {
        console.error(`❌ Error sending ${rec.title}:`, error);
        console.error(`Error details:`, error.message, error.stack);
        results.push({ success: false, title: rec.title, error: error.message });
      }

      // Minimal delay between messages for faster delivery
      if (i < uniqueRecs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
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
