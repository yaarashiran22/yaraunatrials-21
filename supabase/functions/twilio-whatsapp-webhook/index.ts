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

    // Determine if we should send welcome
    // For known users with names, send "Welcome back [name]" on greetings
    // For new users or unnamed users, send full welcome message
    const shouldSendWelcome = (isGreeting && isNewConversation) || isConversationStarter;
    
    let welcomeMessageSent = false;
    if (shouldSendWelcome) {
      console.log('Sending welcome message - new conversation or conversation starter detected');
      
      // Personalized welcome for known users
      let welcomeMessage;
      if (whatsappUser?.name) {
        welcomeMessage = `Welcome back ${whatsappUser.name}! 👋`;
      } else {
        welcomeMessage = "Hey welcome to Yara AI - if you're looking for indie events, hidden deals and bohemian spots in Buenos Aires- I got you. What are you looking for?";
      }
      
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

    // Send immediate "Thinking.." feedback for non-welcome messages
    if (!shouldSendWelcome) {
      const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
      const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
      const twilioWhatsAppNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER') || 'whatsapp:+17622513744';

      // Send thinking message immediately via Twilio API
      const thinkingMessage = 'Thinking..';
      
      try {
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: twilioWhatsAppNumber,
            To: from,
            Body: thinkingMessage
          })
        });
        console.log('Sent "Thinking.." message');
      } catch (error) {
        console.error('Error sending thinking message:', error);
      }
    }

    // Detect and store user information from message
    if (whatsappUser) {
      const updates: any = {};
      
      // Common words to exclude from name detection
      const commonWords = ['there', 'here', 'thanks', 'thank', 'please', 'hello', 'sorry', 'okay', 'yes', 'yeah'];
      
      // Detect name - check multiple patterns
      if (!whatsappUser.name) {
        // Pattern 1: "My name is John" or "I'm John" or "Me llamo Juan"
        const namePattern1 = /(?:my name is|i'm|i am|me llamo)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i;
        const nameMatch1 = body.match(namePattern1);
        
        // Pattern 2: Just a capitalized name on its own (likely response to "what's your name?")
        // Only match if message is very short (2-20 chars) and is just one or two words
        const namePattern2 = /^([A-Z][a-z]{2,15})(?:\s+[A-Z][a-z]{2,15})?$/;
        const nameMatch2 = body.match(namePattern2);
        
        if (nameMatch1) {
          const detectedName = nameMatch1[1].trim();
          if (!commonWords.includes(detectedName.toLowerCase())) {
            updates.name = detectedName;
            console.log(`Detected name (pattern 1): ${detectedName}`);
          }
        } else if (nameMatch2 && body.trim().length >= 2 && body.trim().length <= 30) {
          // Only match single/double word if message is short and not a common word
          const detectedName = nameMatch2[1].trim();
          if (!commonWords.includes(detectedName.toLowerCase())) {
            updates.name = detectedName;
            console.log(`Detected name (pattern 2): ${detectedName}`);
          }
        }
      }
      
      // Detect age from user message
      const agePattern = /\b(\d{1,2})\b/g;
      const ageMatches = body.match(agePattern);
      if (ageMatches && !whatsappUser.age) {
        // Check if the context suggests they're providing age
        const ageContextPatterns = /(i'm|im|i am|we're|were|we are|age|years? old|año|años)/i;
        if (ageContextPatterns.test(body) || body.trim().length < 20) {
          // Take the first reasonable age (between 10 and 99)
          const ages = ageMatches.map(m => parseInt(m)).filter(a => a >= 10 && a <= 99);
          if (ages.length > 0) {
            updates.age = ages[0];
            console.log(`Detected age: ${ages[0]}`);
          }
        }
      }
      
      // Detect email
      const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
      const emailMatch = body.match(emailPattern);
      if (emailMatch && !whatsappUser.email) {
        updates.email = emailMatch[0];
        console.log(`Detected email: ${emailMatch[0]}`);
      }
      
      // Detect interests from what user wants to visit/attend
      const interestPatterns = [
        /(?:looking for|want to|interested in|like|love|into|attend|visit|go to|check out)\s+([a-zA-Z\s,&-]+?)(?:\.|!|\?|$|tonight|today|tomorrow|this|next)/gi,
        /(?:show me|find me|any)\s+([a-zA-Z\s,&-]+?)(?:\s+(?:tonight|today|tomorrow|events?|bars?|clubs?|places?|in))/gi
      ];
      
      let detectedInterests: string[] = [];
      for (const pattern of interestPatterns) {
        const matches = [...body.matchAll(pattern)];
        for (const match of matches) {
          if (match[1]) {
            const interest = match[1].trim().toLowerCase();
            // Filter out very short or common filler words
            const skipWords = ['the', 'a', 'an', 'some', 'any', 'to', 'for', 'in', 'on', 'at', 'there', 'here'];
            if (interest.length > 3 && !skipWords.includes(interest)) {
              detectedInterests.push(interest);
            }
          }
        }
      }
      
      // Also detect specific interests from keywords
      const interestKeywords = {
        'techno': /\btechno\b/i,
        'house music': /\bhouse\s+music\b/i,
        'electronic': /\belectronic\b/i,
        'live music': /\blive\s+music\b/i,
        'jazz': /\bjazz\b/i,
        'rock': /\brock\b/i,
        'indie': /\bindie\b/i,
        'art': /\b(art|arte|galleries|exhibitions)\b/i,
        'theater': /\b(theater|theatre|teatro)\b/i,
        'dance': /\b(dance|dancing|bailar)\b/i,
        'food': /\b(food|dining|restaurants|comida)\b/i,
        'bars': /\bbars?\b/i,
        'clubs': /\bclubs?\b/i,
        'nightlife': /\bnightlife\b/i,
        'cultural events': /\bcultural\s+events?\b/i,
        'workshops': /\bworkshops?\b/i,
        'markets': /\b(markets?|feria)\b/i
      };
      
      for (const [interest, regex] of Object.entries(interestKeywords)) {
        if (regex.test(body)) {
          detectedInterests.push(interest);
        }
      }
      
      // Remove duplicates and update interests
      if (detectedInterests.length > 0) {
        const uniqueInterests = [...new Set(detectedInterests)];
        const currentInterests = whatsappUser.interests || [];
        const mergedInterests = [...new Set([...currentInterests, ...uniqueInterests])];
        
        if (mergedInterests.length > currentInterests.length) {
          updates.interests = mergedInterests;
          console.log(`Detected interests:`, uniqueInterests, `| Total interests:`, mergedInterests);
        }
      }
      
      // Update user profile if we detected any information
      if (Object.keys(updates).length > 0) {
        await supabase
          .from('whatsapp_users')
          .update(updates)
          .eq('id', whatsappUser.id);
        
        // Update local whatsappUser object so AI has the latest data
        Object.assign(whatsappUser, updates);
        console.log(`Updated user info:`, updates);
      }
    }

    // Detect if this is a recommendation request
    const recommendationKeywords = /\b(recommend|suggest|show me|find me|looking for|what's|any|events?|bars?|clubs?|venues?|places?|tonight|today|tomorrow|weekend|esta noche|hoy|mañana|fin de semana|dance|music|live|party|art|food)\b/i;
    const isRecommendationRequest = recommendationKeywords.test(body);

    // Note: We'll send intro message later with recommendations instead of acknowledgment

    // Build conversation history for AI
    const messages = conversationHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));
    messages.push({ role: 'user', content: body });

    // Call Yara AI chat function with user profile context
    const { data: aiResponse, error: aiError } = await supabase.functions.invoke('yara-ai-chat', {
      body: { 
        messages, 
        stream: false,
        userProfile: whatsappUser, // Pass user profile to AI
        phoneNumber: from // Pass phone number for tracking
      }
    });

    if (aiError) {
      console.error('Yara AI error:', aiError);
      throw aiError;
    }

    // Extract AI response
    let assistantMessage = '';
    let multipleMessages: string[] | undefined;
    
    if (aiResponse) {
      assistantMessage = aiResponse.message || 'Sorry, I encountered an error processing your request.';
      multipleMessages = aiResponse.messages; // Array of messages if split
    }

    console.log('Yara AI raw response:', assistantMessage);
    if (multipleMessages) {
      console.log(`Response split into ${multipleMessages.length} messages for Twilio`);
    }

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


    // Handle recommendations response (even if empty - don't show raw JSON)
    if (parsedResponse && parsedResponse.recommendations && Array.isArray(parsedResponse.recommendations)) {
      console.log(`Found ${parsedResponse.recommendations.length} recommendations to send`);
      
      // If no recommendations found, send a helpful message instead of JSON
      if (parsedResponse.recommendations.length === 0) {
        const noResultsMessage = "I couldn't find specific matches for that right now. Try asking about something else - like 'bars in Palermo' or 'live music tonight'!";
        
        await supabase.from('whatsapp_conversations').insert({
          phone_number: from,
          role: 'assistant',
          content: noResultsMessage
        });
        
        const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${noResultsMessage}</Message>
</Response>`;
        
        return new Response(twimlResponse, {
          headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
          status: 200
        });
      }
      
      // Increment recommendation count for progressive profiling
      if (whatsappUser) {
        await supabase
          .from('whatsapp_users')
          .update({ recommendation_count: (whatsappUser.recommendation_count || 0) + 1 })
          .eq('id', whatsappUser.id);
      }
      
      // Store the assistant message
      await supabase.from('whatsapp_conversations').insert({
        phone_number: from,
        role: 'assistant',
        content: JSON.stringify(parsedResponse)
      });

      // Get Twilio WhatsApp number
      const twilioWhatsAppNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER') || 'whatsapp:+17622513744';

      // Prepare the intro message - send this first before recommendations
      const welcomeText = welcomeMessageSent 
        ? (whatsappUser?.name 
          ? `Welcome back ${whatsappUser.name}! 👋\n\n` 
          : "Hey welcome to Yara AI - if you're looking for indie events, hidden deals and bohemian spots in Buenos Aires- I got you. What are you looking for?\n\n")
        : "";
      const introMessage = welcomeText + "Yes! Sending you the recommendations in just a minute! 🎯";
      
      // Send intro via TwiML immediately
      console.log('Sending intro message via TwiML...');
      
      // Send recommendations with images via Twilio API in background
      console.log('Scheduling recommendations to send via Twilio API...');
      
      const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
      const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
      
      // Ensure both numbers have whatsapp: prefix
      const fromWhatsApp = twilioWhatsAppNumber.startsWith('whatsapp:') 
        ? twilioWhatsAppNumber 
        : `whatsapp:${twilioWhatsAppNumber}`;
      const toWhatsApp = from.startsWith('whatsapp:') 
        ? from 
        : `whatsapp:${from}`;
      
      console.log(`Will send from ${fromWhatsApp} to ${toWhatsApp}`);
      
      const recs = parsedResponse.recommendations;
      
      // Use EdgeRuntime.waitUntil for proper background execution
      EdgeRuntime.waitUntil(
        (async () => {
          // Small delay to ensure intro is received first
          await new Promise(resolve => setTimeout(resolve, 800));
          
          for (let i = 0; i < recs.length; i++) {
            const rec = recs[i];
            
            if (!rec.title || !rec.description) {
              console.log(`Skipping recommendation ${i + 1}: missing title or description`);
              continue;
            }

            // Build message with formatting
            let formattedDescription = rec.description;
            if (formattedDescription) {
              formattedDescription = formattedDescription.replace(/Date: ([^\n.]+)/gi, '*Date: $1*');
              formattedDescription = formattedDescription.replace(/Time: ([^\n.]+)/gi, '*Time: $1*');
            }
            
            let messageBody = `*${rec.title}*\n\n${formattedDescription}`;
            
            if (rec.personalized_note) {
              messageBody += `\n\n✨ *Just for you:* ${rec.personalized_note}`;
            }
            
            if (rec.why_recommended) {
              messageBody += `\n\n💡 ${rec.why_recommended}`;
            }
            
            try {
              console.log(`[${i + 1}/${recs.length}] Sending: ${rec.title} with image: ${rec.image_url || 'no image'}`);
              
              const requestBody: Record<string, string> = {
                From: fromWhatsApp,
                To: toWhatsApp,
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
              } else {
                const result = await twilioResponse.json();
                console.log(`✅ Sent ${rec.title}. SID: ${result.sid}`);
              }
            } catch (error) {
              console.error(`❌ Error sending ${rec.title}:`, error);
            }

            // Delay between messages
            if (i < recs.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
          
          console.log('✅ Finished sending all recommendations');
        })()
      );

      // Return intro message immediately via TwiML
      const introTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${introMessage}</Message>
</Response>`;

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
      content: multipleMessages ? multipleMessages.join('\n\n') : assistantMessage
    });

    const welcomeText = welcomeMessageSent 
      ? (whatsappUser?.name 
        ? `Welcome back ${whatsappUser.name}! 👋\n\n` 
        : "Hey welcome to Yara AI - if you're looking for indie events, hidden deals and bohemian spots in Buenos Aires- I got you. What are you looking for?\n\n")
      : "";
    
    // If message was split, send multiple TwiML messages
    if (multipleMessages && multipleMessages.length > 1) {
      console.log(`Sending ${multipleMessages.length} TwiML messages`);
      
      const twimlMessages = multipleMessages.map((msg, idx) => {
        const prefix = idx === 0 && welcomeText ? welcomeText : '';
        return `  <Message>${prefix}${msg}</Message>`;
      }).join('\n');
      
      const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
${twimlMessages}
</Response>`;
      
      return new Response(twimlResponse, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
        status: 200
      });
    }
    
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
