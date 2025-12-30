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
    const { recommendations, toNumber, introText } = await req.json();
    
    console.log(`n8n endpoint: Received request to send ${recommendations?.length || 0} recommendations to ${toNumber}`);
    
    if (!recommendations || !Array.isArray(recommendations) || recommendations.length === 0) {
      return new Response(
        JSON.stringify({ error: 'recommendations array is required and must not be empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!toNumber) {
      return new Response(
        JSON.stringify({ error: 'toNumber is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioWhatsAppNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER');
    
    if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsAppNumber) {
      throw new Error('Missing Twilio credentials');
    }

    // Deduplicate recommendations by id
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
    
    console.log(`Sending ${uniqueRecs.length} unique recommendations`);
    
    // Ensure numbers have whatsapp: prefix
    const cleanFrom = twilioWhatsAppNumber.includes('whatsapp:') ? twilioWhatsAppNumber : `whatsapp:${twilioWhatsAppNumber}`;
    const cleanTo = toNumber.includes('whatsapp:') ? toNumber : `whatsapp:${toNumber}`;
    
    console.log(`Using From: ${cleanFrom}, To: ${cleanTo}`);

    const results = [];
    
    // Send intro text first if provided
    if (introText) {
      try {
        // CRITICAL FIX: Detect and handle raw JSON being passed as introText
        // This catches cases where n8n passes the entire response instead of just intro_message
        let cleanIntroText = introText;
        
        if (typeof introText === 'string' && introText.trim().startsWith('{')) {
          try {
            const parsedIntro = JSON.parse(introText);
            if (parsedIntro.intro_message) {
              cleanIntroText = parsedIntro.intro_message;
              console.log('Extracted intro_message from raw JSON:', cleanIntroText);
            }
          } catch (e) {
            // Not valid JSON, use as-is
            console.log('introText looks like JSON but failed to parse, using as-is');
          }
        } else if (typeof introText === 'object' && introText.intro_message) {
          // Handle case where introText is already an object
          cleanIntroText = introText.intro_message;
          console.log('Extracted intro_message from object:', cleanIntroText);
        }
        
        // Additional safety: strip any remaining JSON-like content
        if (typeof cleanIntroText === 'string' && 
            (cleanIntroText.includes('"recommendations"') || cleanIntroText.includes('"intro_message"'))) {
          console.log('WARNING: introText still contains JSON-like content, extracting clean text');
          // Try to extract just the message before any JSON
          const jsonStart = cleanIntroText.search(/[{[]/);
          if (jsonStart > 0) {
            cleanIntroText = cleanIntroText.substring(0, jsonStart).trim();
          } else {
            // Fallback to generic intro
            cleanIntroText = "Here are some recommendations for you! 🎯";
          }
        }
        
        console.log('Sending intro text:', cleanIntroText);
        
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
              Body: cleanIntroText
            }).toString()
          }
        );
        
        if (introResponse.ok) {
          console.log('✅ Intro text sent successfully');
          await new Promise(resolve => setTimeout(resolve, 400));
        } else {
          console.error('❌ Failed to send intro text:', await introResponse.text());
        }
      } catch (error) {
        console.error('❌ Error sending intro text:', error);
      }
    }
    
    // Send recommendations
    for (let i = 0; i < uniqueRecs.length; i++) {
      const rec = uniqueRecs[i];
      
      let title = rec.title;
      if (!title && rec.description) {
        const firstLine = rec.description.split('\n')[0].trim();
        title = firstLine.length > 100 ? 'Event Recommendation' : firstLine;
      }
      
      if (!title) {
        console.log(`Skipping recommendation ${i + 1}: missing title and description`);
        continue;
      }

      let description = rec.description;
      if (!description && rec.why_recommended) {
        description = rec.why_recommended;
      }
      
      if (!description) {
        console.log(`Skipping recommendation ${i + 1}: missing both description and why_recommended`);
        continue;
      }

      // Format description with bold date/time
      let formattedDescription = description;
      if (formattedDescription) {
        formattedDescription = formattedDescription.replace(/Date: ([^\n.]+)/gi, '*Date: $1*');
        formattedDescription = formattedDescription.replace(/Time: ([^\n.]+)/gi, '*Time: $1*');
      }
      
      let messageBody = `*${title}*\n\n${formattedDescription}`;
      
      if (rec.url) {
        messageBody += `\n\n🔗 ${rec.url}`;
      }
      
      // Only add personalized_note for events
      if (rec.personalized_note && rec.type === 'event') {
        messageBody += `\n\n✨ *Just for you:* ${rec.personalized_note}`;
      }
      
      try {
        console.log(`[${i + 1}/${uniqueRecs.length}] Sending: ${rec.title}`);
        
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

      if (i < uniqueRecs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log('✅ Finished sending all recommendations');
    
    return new Response(
      JSON.stringify({ success: true, sent: results.filter(r => r.success).length, total: uniqueRecs.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in n8n-send-recommendations:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
