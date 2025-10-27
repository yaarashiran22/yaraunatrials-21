import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Twilio webhook received");

    // Parse form data from Twilio
    const formData = await req.formData();
    const from = formData.get("From") as string;
    const body = formData.get("Body") as string;
    const to = formData.get("To") as string;

    console.log("Twilio message:", { from, to, body });

    if (!body) {
      console.error("No message body received");
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
        status: 200,
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check for recent conversation (last 30 minutes for better context retention)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recentHistory } = await supabase
      .from("whatsapp_conversations")
      .select("role, content, created_at")
      .eq("phone_number", from)
      .gte("created_at", thirtyMinutesAgo)
      .order("created_at", { ascending: true })
      .limit(30);

    const conversationHistory = recentHistory || [];
    const isNewConversation = conversationHistory.length === 0;
    console.log(
      `Found ${conversationHistory.length} messages in last 30 minutes for ${from}. Is new conversation: ${isNewConversation}`,
    );

    // Check if message is a greeting OR a conversation starter
    const greetingPatterns = /^(hey|hi|hello|sup|yo|hola|what's up|whats up)[\s!?.]*$/i;
    const conversationStarterPatterns =
      /^(i'm looking for|i want|show me|find me|i need|looking for|what's|whats|tell me about|i'm into|im into|help me find)/i;
    const isGreeting = greetingPatterns.test(body.trim());
    const isConversationStarter = conversationStarterPatterns.test(body.trim());

    // Get or create WhatsApp user profile
    let { data: whatsappUser } = await supabase
      .from("whatsapp_users")
      .select("*")
      .eq("phone_number", from)
      .maybeSingle();

    // Create new user if doesn't exist
    if (!whatsappUser) {
      console.log("Creating new WhatsApp user for", from);
      const { data: newUser, error: createError } = await supabase
        .from("whatsapp_users")
        .insert({ phone_number: from })
        .select()
        .single();

      if (createError) {
        console.error("Error creating WhatsApp user:", createError);
      } else {
        whatsappUser = newUser;
      }
    }

    console.log("WhatsApp user:", whatsappUser ? `Found user ${whatsappUser.name || "unnamed"}` : "No user found");

    // Handle greetings - respond immediately without calling AI
    // For ALL greetings (new or existing conversations), just send a friendly response
    if (isGreeting && !isConversationStarter) {
      console.log("Detected greeting - responding directly without AI");

      // Store user message
      await supabase.from("whatsapp_conversations").insert({
        phone_number: from,
        role: "user",
        content: body,
      });

      // Personalized greeting for known users
      let greetingMessage;
      if (whatsappUser?.name) {
        greetingMessage = `Hey ${whatsappUser.name}! 👋 What are you looking for today?`;
      } else {
        greetingMessage = "Hey there! 👋 What can I help you find in Buenos Aires?";
      }

      // Store greeting response
      await supabase.from("whatsapp_conversations").insert({
        phone_number: from,
        role: "assistant",
        content: greetingMessage,
      });

      // Return TwiML response with just greeting
      const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${greetingMessage}</Message>
</Response>`;

      return new Response(twimlResponse, {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
        status: 200,
      });
    }

    // Store user message
    await supabase.from("whatsapp_conversations").insert({
      phone_number: from,
      role: "user",
      content: body,
    });

    // Send immediate "Thinking.." feedback
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioWhatsAppNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER") || "whatsapp:+17622513744";

    // Send thinking message immediately via Twilio API
    const thinkingMessage = "Thinking..";

    try {
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: twilioWhatsAppNumber,
          To: from,
          Body: thinkingMessage,
        }),
      });
      console.log('Sent "Thinking.." message');
    } catch (error) {
      console.error("Error sending thinking message:", error);
    }

    // Detect and store user information from message
    if (whatsappUser) {
      const updates: any = {};

      // Detect name only from explicit statements like "My name is John" or "I'm John"
      if (!whatsappUser.name) {
        const namePattern = /(?:my name is|i'm|i am|me llamo|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i;
        const nameMatch = body.match(namePattern);

        if (nameMatch) {
          const detectedName = nameMatch[1].trim();
          updates.name = detectedName;
          console.log(`Detected name from explicit statement: ${detectedName}`);
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
          const ages = ageMatches.map((m) => parseInt(m)).filter((a) => a >= 10 && a <= 99);
          if (ages.length > 0) {
            updates.age = ages[0];
            console.log(`Detected age: ${ages[0]}`);
          }
        }
      }

      // Detect neighborhood from user message
      const neighborhoodKeywords = [
        "palermo",
        "palermo soho",
        "palermo hollywood",
        "villa crespo",
        "san telmo",
        "recoleta",
        "belgrano",
        "caballito",
        "almagro",
        "chacarita",
        "colegiales",
        "puerto madero",
        "barracas",
        "la boca",
        "retiro",
        "microcentro",
        "monserrat",
        "boedo",
        "flores",
        "parque patricios",
        "constitución",
        "balvanera",
        "once",
        "núñez",
        "saavedra",
        "villa urquiza",
        "villa del parque",
        "versalles",
      ];

      const bodyLower = body.toLowerCase();
      const detectedNeighborhoods: string[] = [];

      for (const neighborhood of neighborhoodKeywords) {
        if (bodyLower.includes(neighborhood)) {
          detectedNeighborhoods.push(neighborhood);
        }
      }

      if (detectedNeighborhoods.length > 0) {
        const currentNeighborhoods = whatsappUser.favorite_neighborhoods || [];
        const mergedNeighborhoods = [...new Set([...currentNeighborhoods, ...detectedNeighborhoods])];

        if (mergedNeighborhoods.length > currentNeighborhoods.length) {
          updates.favorite_neighborhoods = mergedNeighborhoods;
          console.log(`Detected neighborhoods:`, detectedNeighborhoods, `| Total neighborhoods:`, mergedNeighborhoods);
        }
      }

      // Detect interests from what user wants to visit/attend
      const interestPatterns = [
        /(?:looking for|want to|interested in|like|love|into|attend|visit|go to|check out)\s+([a-zA-Z\s,&-]+?)(?:\.|!|\?|$|tonight|today|tomorrow|this|next)/gi,
        /(?:show me|find me|any)\s+([a-zA-Z\s,&-]+?)(?:\s+(?:tonight|today|tomorrow|events?|bars?|clubs?|places?|in))/gi,
      ];

      let detectedInterests: string[] = [];
      for (const pattern of interestPatterns) {
        const matches = [...body.matchAll(pattern)];
        for (const match of matches) {
          if (match[1]) {
            const interest = match[1].trim().toLowerCase();
            // Filter out very short or common filler words
            const skipWords = ["the", "a", "an", "some", "any", "to", "for", "in", "on", "at", "there", "here"];
            if (interest.length > 3 && !skipWords.includes(interest)) {
              detectedInterests.push(interest);
            }
          }
        }
      }

      // Also detect specific interests from keywords
      const interestKeywords = {
        techno: /\btechno\b/i,
        "house music": /\bhouse\s+music\b/i,
        electronic: /\belectronic\b/i,
        "live music": /\blive\s+music\b/i,
        jazz: /\bjazz\b/i,
        rock: /\brock\b/i,
        indie: /\bindie\b/i,
        art: /\b(art|arte|galleries|exhibitions)\b/i,
        theater: /\b(theater|theatre|teatro)\b/i,
        dance: /\b(dance|dancing|bailar)\b/i,
        food: /\b(food|dining|restaurants|comida)\b/i,
        bars: /\bbars?\b/i,
        clubs: /\bclubs?\b/i,
        nightlife: /\bnightlife\b/i,
        "cultural events": /\bcultural\s+events?\b/i,
        workshops: /\bworkshops?\b/i,
        markets: /\b(markets?|feria)\b/i,
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

      // Detect music preferences
      const musicGenreKeywords = {
        techno: /\btechno\b/i,
        house: /\bhouse\s+music\b|\bhouse\b/i,
        "deep house": /\bdeep\s+house\b/i,
        electronic: /\belectronic\b|\bedm\b/i,
        trance: /\btrance\b/i,
        "drum and bass": /\bdrum\s+and\s+bass\b|\bd&b\b|\bdnb\b/i,
        dubstep: /\bdubstep\b/i,
        jazz: /\bjazz\b/i,
        blues: /\bblues\b/i,
        rock: /\brock\b/i,
        "hard rock": /\bhard\s+rock\b/i,
        "punk rock": /\bpunk\s+rock\b|\bpunk\b/i,
        indie: /\bindie\b/i,
        alternative: /\balternative\b/i,
        pop: /\bpop\b/i,
        "k-pop": /\bk-pop\b|\bkpop\b/i,
        "hip hop": /\bhip\s+hop\b|\bhiphop\b|\brap\b/i,
        trap: /\btrap\b/i,
        reggaeton: /\breggaeton\b/i,
        salsa: /\bsalsa\b/i,
        bachata: /\bbachata\b/i,
        cumbia: /\bcumbia\b/i,
        tango: /\btango\b/i,
        folk: /\bfolk\b/i,
        country: /\bcountry\b/i,
        classical: /\bclassical\b/i,
        opera: /\bopera\b/i,
        metal: /\bmetal\b/i,
        reggae: /\breggae\b/i,
        funk: /\bfunk\b/i,
        soul: /\bsoul\b/i,
        "r&b": /\br&b\b|\brnb\b/i,
        disco: /\bdisco\b/i,
        ambient: /\bambient\b/i,
        experimental: /\bexperimental\b/i,
        "live music": /\blive\s+music\b/i,
      };

      let detectedMusicGenres: string[] = [];
      for (const [genre, regex] of Object.entries(musicGenreKeywords)) {
        if (regex.test(body)) {
          detectedMusicGenres.push(genre);
        }
      }

      // Remove duplicates and update music preferences
      if (detectedMusicGenres.length > 0) {
        const uniqueGenres = [...new Set(detectedMusicGenres)];
        const currentMusicPreferences = whatsappUser.music_preferences || [];
        const mergedMusicPreferences = [...new Set([...currentMusicPreferences, ...uniqueGenres])];

        if (mergedMusicPreferences.length > currentMusicPreferences.length) {
          updates.music_preferences = mergedMusicPreferences;
          console.log(`Detected music genres:`, uniqueGenres, `| Total music preferences:`, mergedMusicPreferences);
        }
      }

      // Update user profile if we detected any information
      if (Object.keys(updates).length > 0) {
        await supabase.from("whatsapp_users").update(updates).eq("id", whatsappUser.id);

        // Update local whatsappUser object so AI has the latest data
        Object.assign(whatsappUser, updates);
        console.log(`Updated user info:`, updates);
      }
    }

    // Ask for name proactively after first non-greeting message
    if (whatsappUser && !whatsappUser.name && conversationHistory.length >= 2 && !isGreeting) {
      const askNameMessage = "By the way, can I ask what your name is? 😊";

      await supabase.from("whatsapp_conversations").insert({
        phone_number: from,
        role: "assistant",
        content: askNameMessage,
      });

      const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${askNameMessage}</Message>
</Response>`;

      return new Response(twimlResponse, {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
        status: 200,
      });
    }

    // Detect if this is a recommendation request
    const recommendationKeywords =
      /\b(recommend|suggest|show me|find me|looking for|i'm looking for|im looking for|i want|i need|can you find|help me find|gimme|dame)\b/i;
    const isRecommendationRequest = recommendationKeywords.test(body);

    // Progressive profiling: Ask for name and age before first recommendations
    if (isRecommendationRequest && whatsappUser) {
      const recCount = whatsappUser.recommendation_count || 0;

      // First recommendation request: Ask for name if missing
      if (recCount === 0 && !whatsappUser.name) {
        const askNameMessage = "Great! Before I send you the best recommendations, what's your name? 😊";

        await supabase.from("whatsapp_conversations").insert({
          phone_number: from,
          role: "user",
          content: body,
        });

        await supabase.from("whatsapp_conversations").insert({
          phone_number: from,
          role: "assistant",
          content: askNameMessage,
        });

        const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${askNameMessage}</Message>
</Response>`;

        return new Response(twimlResponse, {
          headers: { ...corsHeaders, "Content-Type": "text/xml" },
          status: 200,
        });
      }

      // First recommendation request: Ask for age if name exists but age missing
      if (recCount === 0 && whatsappUser.name && !whatsappUser.age) {
        const askAgeMessage = `Nice to meet you, ${whatsappUser.name}! And how old are you? This helps me find more specific events for you. 🎉`;

        await supabase.from("whatsapp_conversations").insert({
          phone_number: from,
          role: "user",
          content: body,
        });

        await supabase.from("whatsapp_conversations").insert({
          phone_number: from,
          role: "assistant",
          content: askAgeMessage,
        });

        const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${askAgeMessage}</Message>
</Response>`;

        return new Response(twimlResponse, {
          headers: { ...corsHeaders, "Content-Type": "text/xml" },
          status: 200,
        });
      }

      // Second recommendation request: Ask for preferred neighborhood (only if not mentioned in current message)
      if (
        recCount === 1 &&
        (!whatsappUser.favorite_neighborhoods || whatsappUser.favorite_neighborhoods.length === 0)
      ) {
        // Check if user already mentioned a neighborhood in this message
        const neighborhoodKeywords = [
          "palermo",
          "palermo soho",
          "palermo hollywood",
          "villa crespo",
          "san telmo",
          "recoleta",
          "belgrano",
          "caballito",
          "almagro",
          "chacarita",
          "colegiales",
          "puerto madero",
          "barracas",
          "la boca",
          "retiro",
          "microcentro",
          "monserrat",
          "boedo",
          "flores",
          "parque patricios",
          "constitución",
          "balvanera",
          "once",
          "núñez",
          "saavedra",
          "villa urquiza",
          "villa del parque",
          "versalles",
        ];

        const bodyLower = body.toLowerCase();
        const hasNeighborhoodInMessage = neighborhoodKeywords.some((n) => bodyLower.includes(n));

        // Only ask if they didn't mention a neighborhood in their message
        if (!hasNeighborhoodInMessage) {
          const askNeighborhoodMessage =
            "What neighborhood do you usually hang out in or prefer to go out in Buenos Aires? (e.g., Palermo, Villa Crespo, San Telmo) 📍";

          await supabase.from("whatsapp_conversations").insert({
            phone_number: from,
            role: "user",
            content: body,
          });

          await supabase.from("whatsapp_conversations").insert({
            phone_number: from,
            role: "assistant",
            content: askNeighborhoodMessage,
          });

          const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${askNeighborhoodMessage}</Message>
</Response>`;

          return new Response(twimlResponse, {
            headers: { ...corsHeaders, "Content-Type": "text/xml" },
            status: 200,
          });
        }
        // If neighborhood is mentioned, continue to process the recommendation
      }

      // Third recommendation request: Ask for budget preference if missing
      if (recCount === 2 && !whatsappUser.budget_preference) {
        const askBudgetMessage = "Are you looking for something fancy-ish or more local/casual vibes? 💰";

        await supabase.from("whatsapp_conversations").insert({
          phone_number: from,
          role: "user",
          content: body,
        });

        await supabase.from("whatsapp_conversations").insert({
          phone_number: from,
          role: "assistant",
          content: askBudgetMessage,
        });

        const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${askBudgetMessage}</Message>
</Response>`;

        return new Response(twimlResponse, {
          headers: { ...corsHeaders, "Content-Type": "text/xml" },
          status: 200,
        });
      }
    }

    // Build conversation history for AI
    const messages = conversationHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));
    messages.push({ role: "user", content: body });

    // isRecommendationRequest already declared earlier (line 391-393)
    // Using the same variable for the AI intro logic below

    // For recommendation requests, generate and send AI intro first using fast model
    if (isRecommendationRequest) {
      console.log("Detected recommendation request - generating AI intro with fast model");
      
      const { data: introResponse, error: introError } = await supabase.functions.invoke("yara-ai-chat", {
        body: {
          messages,
          stream: false,
          userProfile: whatsappUser,
          phoneNumber: from,
          useIntroModel: true, // Use fast model for intro
        },
      });

      if (!introError && introResponse) {
        let aiIntroText = null;
        const introText = introResponse.message || introResponse.response || introResponse.text;
        
        // Try to parse as JSON to extract intro_message
        try {
          const parsedIntro = JSON.parse(introText);
          aiIntroText = parsedIntro.intro_message;
        } catch (e) {
          // If not JSON, use as-is
          aiIntroText = introText;
        }

        // Send AI intro if we got one
        if (aiIntroText && aiIntroText.trim()) {
          try {
            await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`, {
              method: "POST",
              headers: {
                Authorization: "Basic " + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                From: twilioWhatsAppNumber,
                To: from,
                Body: aiIntroText,
              }),
            });
            console.log("Sent AI intro message:", aiIntroText);
          } catch (error) {
            console.error("Error sending AI intro:", error);
          }
        }
      }
    }

    // Call Yara AI chat function with user profile context (using standard model)
    const { data: aiResponse, error: aiError } = await supabase.functions.invoke("yara-ai-chat", {
      body: {
        messages,
        stream: false,
        userProfile: whatsappUser, // Pass user profile to AI
        phoneNumber: from, // Pass phone number for tracking
        useIntroModel: false, // Use standard model for main response
      },
    });

    if (aiError) {
      console.error("Yara AI error:", aiError);
      throw aiError;
    }

    // Extract AI response
    let assistantMessage = "";
    let multipleMessages: string[] | undefined;

    if (aiResponse) {
      assistantMessage = aiResponse.message || "Sorry, I encountered an error processing your request.";
      multipleMessages = aiResponse.messages; // Array of messages if split
    }

    console.log("Yara AI raw response:", assistantMessage);
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
      console.log("Extracted JSON from response:", cleanedMessage.substring(0, 200) + "...");
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(cleanedMessage);
      console.log(
        "Successfully parsed JSON response with",
        parsedResponse.recommendations?.length || 0,
        "recommendations",
      );
    } catch (e) {
      // Not JSON, just a regular conversational response
      console.log("Response is not valid JSON, treating as conversational text");
      parsedResponse = null;
    }

    // Handle recommendations response (even if empty - don't show raw JSON)
    if (parsedResponse && parsedResponse.recommendations && Array.isArray(parsedResponse.recommendations)) {
      console.log(`Found ${parsedResponse.recommendations.length} recommendations to send`);
      
      // CRITICAL FIX: Filter out jam sessions when user asks for workshops
      const userAskedForWorkshops = /\b(workshop|workshops|class|classes|course|courses|taller|talleres)\b/i.test(body);
      
      if (userAskedForWorkshops) {
        // Remove jam sessions and other non-workshop events
        const workshopKeywords = /\b(workshop|class|course|taller|masterclass|training|seminar|lesson|tutorial)\b/i;
        
        parsedResponse.recommendations = parsedResponse.recommendations.filter(rec => {
          // Check if title or description contains workshop keywords
          const titleHasWorkshop = workshopKeywords.test(rec.title || "");
          const descHasWorkshop = workshopKeywords.test(rec.description || "");
          const whyHasWorkshop = workshopKeywords.test(rec.why_recommended || "");
          
          // Explicitly exclude jam sessions
          const isJamSession = /\bjam\s+session\b/i.test(rec.title || "");
          
          if (isJamSession) {
            console.log(`Filtering out jam session: ${rec.title}`);
            return false;
          }
          
          // Only include if it has workshop keywords
          return titleHasWorkshop || descHasWorkshop || whyHasWorkshop;
        });
        
        console.log(`After workshop filtering: ${parsedResponse.recommendations.length} recommendations`);
      }

      // If no recommendations found, send a helpful message instead of JSON
      if (parsedResponse.recommendations.length === 0) {
        const noResultsMessage =
          "I couldn't find specific matches for that right now. Try asking about something else - like 'bars in Palermo' or 'live music tonight'!";

        await supabase.from("whatsapp_conversations").insert({
          phone_number: from,
          role: "assistant",
          content: noResultsMessage,
        });

        const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${noResultsMessage}</Message>
</Response>`;

        return new Response(twimlResponse, {
          headers: { ...corsHeaders, "Content-Type": "text/xml" },
          status: 200,
        });
      }

      // Increment recommendation count for progressive profiling
      if (whatsappUser) {
        await supabase
          .from("whatsapp_users")
          .update({ recommendation_count: (whatsappUser.recommendation_count || 0) + 1 })
          .eq("id", whatsappUser.id);
      }

      // Store the assistant message
      await supabase.from("whatsapp_conversations").insert({
        phone_number: from,
        role: "assistant",
        content: JSON.stringify(parsedResponse),
      });

      // Get Twilio WhatsApp number
      const twilioWhatsAppNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER") || "whatsapp:+17622513744";

      // Prepare the intro message - send this first before recommendations
      const introMessage = parsedResponse.intro_message || "Yes! Sending you the recommendations in just a minute! 🎯";

      // Send intro via TwiML immediately
      console.log("Sending intro message via TwiML...");

      // Trigger send-whatsapp-recommendations in the background (don't wait for it)
      console.log("Triggering send-whatsapp-recommendations function in background...");
      supabase.functions
        .invoke("send-whatsapp-recommendations", {
          body: {
            recommendations: parsedResponse.recommendations,
            toNumber: from,
            fromNumber: twilioWhatsAppNumber,
            introText: null, // Don't send intro from background - already sent via TwiML
          },
        })
        .then(({ data, error }) => {
          if (error) {
            console.error("Error invoking send-whatsapp-recommendations:", error);
          } else {
            console.log("Send-whatsapp-recommendations completed successfully:", data);
          }
        })
        .catch((error) => {
          console.error("Failed to invoke send-whatsapp-recommendations:", error);
        });

      // Return intro message immediately via TwiML (don't wait for recommendations)
      const introTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${introMessage}</Message>
</Response>`;

      console.log("Returning intro TwiML response immediately");
      return new Response(introTwiml, {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
        status: 200,
      });
    }

    // Regular conversational response (no recommendations)
    console.log("Sending conversational response");

    // Store the assistant message
    await supabase.from("whatsapp_conversations").insert({
      phone_number: from,
      role: "assistant",
      content: multipleMessages ? multipleMessages.join("\n\n") : assistantMessage,
    });

    // If message was split, send multiple TwiML messages
    if (multipleMessages && multipleMessages.length > 1) {
      console.log(`Sending ${multipleMessages.length} TwiML messages`);

      const twimlMessages = multipleMessages
        .map((msg) => {
          return `  <Message>${msg}</Message>`;
        })
        .join("\n");

      const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
${twimlMessages}
</Response>`;

      return new Response(twimlResponse, {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
        status: 200,
      });
    }

    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${assistantMessage}</Message>
</Response>`;

    console.log("Sending TwiML response");

    return new Response(twimlResponse, {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in Twilio webhook:", error);

    // Return empty TwiML response on error
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Sorry, I encountered an error. Please try again later.</Message></Response>',
      {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
        status: 200,
      },
    );
  }
});
