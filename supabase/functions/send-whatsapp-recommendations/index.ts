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
    const body = await req.json();
    
    // Support both parameter naming conventions
    const recommendations = body.recommendations || [];
    const toNumber = body.toNumber || body.phoneNumber;
    const fromNumber = body.fromNumber || Deno.env.get('TWILIO_WHATSAPP_NUMBER');
    let introText = body.introText || body.introMessage;
    
    // CRITICAL FIX: Detect and extract intro_message from raw JSON
    // This catches cases where n8n passes the entire AI response instead of just the intro_message
    if (introText) {
      if (typeof introText === 'string' && introText.trim().startsWith('{')) {
        try {
          const parsedIntro = JSON.parse(introText);
          if (parsedIntro.intro_message) {
            introText = parsedIntro.intro_message;
            console.log('Extracted intro_message from raw JSON:', introText);
          }
        } catch (e) {
          // Not valid JSON, check if it contains JSON-like content
          if (introText.includes('"intro_message"') || introText.includes('"recommendations"')) {
            console.log('WARNING: introText contains JSON-like content but failed to parse');
            // Try to extract text before JSON starts
            const jsonStart = introText.search(/[{[]/);
            if (jsonStart > 0) {
              introText = introText.substring(0, jsonStart).trim();
            } else {
              // Complete fallback
              introText = "Here are some recommendations for you! 🎉";
            }
          }
        }
      } else if (typeof introText === 'object' && introText.intro_message) {
        introText = introText.intro_message;
        console.log('Extracted intro_message from object:', introText);
      }
    }
    
    // Handle text-only messages (no recommendations)
    if (!recommendations || recommendations.length === 0) {
      if (!introText) {
        return new Response(
          JSON.stringify({ success: false, error: 'No intro text or recommendations provided' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`Sending text-only message to ${toNumber}: ${introText}`);
      
      const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
      const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
      
      if (!twilioAccountSid || !twilioAuthToken) {
        throw new Error('Missing Twilio credentials');
      }
      
      const cleanFrom = fromNumber?.includes('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;
      const cleanTo = toNumber?.includes('whatsapp:') ? toNumber : `whatsapp:${toNumber}`;
      
      const response = await fetch(
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
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Text-only message sent. SID: ${result.sid}`);
        return new Response(
          JSON.stringify({ success: true, messageSid: result.sid }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        const errorText = await response.text();
        console.error(`❌ Failed to send text-only message: ${errorText}`);
        throw new Error(errorText);
      }
    }
    
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
      
      // Get title from multiple possible sources
      // AI might use 'title' or 'name' depending on the item type
      let title = rec.title || rec.name;
      
      // If still no title, try to extract from first line of description
      if (!title && rec.description) {
        const firstLine = rec.description.split('\n')[0].trim();
        // Only use if it's reasonably short (a title, not a paragraph)
        if (firstLine.length <= 100) {
          title = firstLine;
        }
      }
      
      // Log what we have for debugging
      console.log(`Rec ${i + 1} - title: ${rec.title}, name: ${rec.name}, resolved title: ${title}`);
      
      if (!title) {
        console.log(`Skipping recommendation ${i + 1}: could not determine title from title, name, or description`);
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
      
      // Add URL/Instagram link if available
      // Check multiple fields: url (for top list items), external_link (for events), ticket_link
      const linkUrl = rec.url || rec.external_link;
      if (linkUrl) {
        messageBody += `\n\n📸 ${linkUrl}`;
      }
      
      // Add ticket link separately if available (for events)
      if (rec.ticket_link && rec.ticket_link !== linkUrl) {
        messageBody += `\n🎟️ ${rec.ticket_link}`;
      }
      
      // CRITICAL: Only add personalized_note for events, NOT for topListItems (clubs/bars/communities)
      if (rec.personalized_note && rec.type === 'event') {
        messageBody += `\n\n✨ *Just for you:* ${rec.personalized_note}`;
      }
      
      try {
        console.log(`[${i + 1}/${uniqueRecs.length}] Sending: ${rec.title}`);
        console.log(`Message body length: ${messageBody.length} chars`);
        console.log(`Has image: ${!!rec.image_url}, Has URL: ${!!rec.url || !!rec.external_link}`);
        
        // Build request body
        const requestBody: Record<string, string> = {
          From: cleanFrom,
          To: cleanTo,
          Body: messageBody
        };
        
        // Validate image URL before including it
        let useImage = false;
        if (rec.image_url) {
          try {
            // Quick HEAD request to check if image is accessible
            const imageCheck = await fetch(rec.image_url, { 
              method: 'HEAD',
              signal: AbortSignal.timeout(3000) // 3 second timeout
            });
            
            if (imageCheck.ok) {
              const contentType = imageCheck.headers.get('content-type') || '';
              const contentLength = parseInt(imageCheck.headers.get('content-length') || '0');
              
              // Check if it's an image and under 5MB (Twilio limit)
              if (contentType.startsWith('image/') && contentLength < 5 * 1024 * 1024) {
                useImage = true;
                console.log(`✅ Image validated: ${rec.image_url} (${contentType}, ${contentLength} bytes)`);
              } else {
                console.log(`⚠️ Skipping image - invalid type or too large: ${contentType}, ${contentLength} bytes`);
              }
            } else {
              console.log(`⚠️ Image not accessible (${imageCheck.status}): ${rec.image_url}`);
            }
          } catch (imgError) {
            console.log(`⚠️ Image check failed, sending without media: ${imgError.message}`);
          }
        }
        
        if (useImage) {
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
          
          // If media failed, retry without media
          if (errorText.includes('media') && useImage) {
            console.log(`🔄 Retrying without media...`);
            delete requestBody.MediaUrl;
            
            const retryResponse = await fetch(
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
            
            if (retryResponse.ok) {
              const result = await retryResponse.json();
              console.log(`✅ Sent ${rec.title} (without media). SID: ${result.sid}`);
              results.push({ success: true, title: rec.title, sid: result.sid, note: 'sent without media' });
            } else {
              results.push({ success: false, title: rec.title, error: errorText });
            }
          } else {
            results.push({ success: false, title: rec.title, error: errorText });
          }
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
