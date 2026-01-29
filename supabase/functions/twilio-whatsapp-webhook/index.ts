import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CONFIGURATION: Set to true to enable bot, false to disable
const BOT_ENABLED = true;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Bot disabled check - return empty response immediately
  if (!BOT_ENABLED) {
    console.log("Bot is disabled via BOT_ENABLED flag");
    return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
      status: 200,
    });
  }

  try {
    console.log("Twilio webhook received");

    // Parse form data from Twilio
    const formData = await req.formData();
    const from = formData.get("From") as string;
    const body = (formData.get("Body") as string) || "";
    const to = formData.get("To") as string;
    const mediaUrl = formData.get("MediaUrl0") as string; // Check for media
    const messageSid = formData.get("MessageSid") as string;

    console.log("Twilio message:", { from, to, body, hasMedia: !!mediaUrl, messageSid });

    // Initialize Supabase client BEFORE any early returns
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // IDEMPOTENCY CHECK: Prevent duplicate message processing from Twilio retries
    if (messageSid) {
      const { data: existingMessage } = await supabase
        .from("processed_whatsapp_messages")
        .select("id")
        .eq("message_sid", messageSid)
        .maybeSingle();

      if (existingMessage) {
        console.log(`Duplicate message detected (MessageSid: ${messageSid}) - skipping processing`);
        return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
          headers: { ...corsHeaders, "Content-Type": "text/xml" },
          status: 200,
        });
      }

      // Mark this message as being processed
      const { error: insertError } = await supabase
        .from("processed_whatsapp_messages")
        .insert({ message_sid: messageSid, phone_number: from });

      if (insertError) {
        // If insert fails due to unique constraint, another request beat us
        if (insertError.code === "23505") {
          console.log(`Race condition detected for MessageSid: ${messageSid} - skipping`);
          return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
            headers: { ...corsHeaders, "Content-Type": "text/xml" },
            status: 200,
          });
        }
        console.error("Error marking message as processed:", insertError);
      } else {
        console.log(`Message ${messageSid} marked as processing`);
      }
    }

    // Send typing indicator
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioWhatsAppNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER") || "whatsapp:+17622513744";

    // Send typing indicator immediately
    try {
      const typingResponse = await fetch(`https://messaging.twilio.com/v2/Indicators/Typing.json`, {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          messageId: messageSid,
          channel: "whatsapp",
        }),
      });
      const typingResult = await typingResponse.json();
      console.log("Typing indicator response:", JSON.stringify(typingResult), "Status:", typingResponse.status);
    } catch (error) {
      console.error("Error sending typing indicator:", error);
    }

    // Check for active event upload flow BEFORE checking for empty body
    const { data: activeUpload } = await supabase
      .from("whatsapp_event_uploads")
      .select("*")
      .eq("phone_number", from)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Allow empty body if we have media AND an active upload (user sending image)
    if (!body && !mediaUrl && !activeUpload) {
      console.error("No message body or media received");
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
        status: 200,
      });
    }

    // Check for recent conversation (last 6 hours for context retention)
    // This balances continuity with relevance - messages older than 6 hours may be outdated
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: recentHistory } = await supabase
      .from("whatsapp_conversations")
      .select("role, content, created_at")
      .eq("phone_number", from)
      .gte("created_at", sixHoursAgo)
      .order("created_at", { ascending: true })
      .limit(50); // Increased limit for longer context window

    const conversationHistory = recentHistory || [];
    const isNewConversation = conversationHistory.length === 0;
    console.log(
      `Found ${conversationHistory.length} messages in last 6 hours for ${from}. Is new conversation: ${isNewConversation}`,
    );

    // Check if message is a greeting OR a conversation starter
    // IMPROVED: More robust detection to avoid treating recommendation requests as greetings
    const bodyTrimmed = body.trim();
    const bodyLowerTrimmed = bodyTrimmed.toLowerCase();
    
    // Greeting patterns - STRICT: only matches if the ENTIRE message is just a greeting
    const greetingPatterns = /^(hey|hi|hello|sup|yo|hola|buenas|what's up|whats up)[\s!?.]*$/i;
    
    // Recommendation request patterns - if ANY of these appear, treat as recommendation request
    const recommendationPatterns = /\b(what's there to do|whats there to do|what to do|things to do|what can i do|what should i do|anything to do|something to do|plans for|eventos|fiestas|parties|events|shows|concerts|clubs|bars|galleries|exhibitions|theater|teatro|música|music|recommend|recommendations|looking for|show me|find me|what are some|dame|dime|tienes|hay algo|qué hay|que hay|donde puedo|busco|quiero ir)\b/i;
    
    // Conversation starters that indicate the user wants something specific
    const conversationStarterPatterns =
      /^(i'm looking for|i want|show me|find me|i need|looking for|what's|whats|tell me about|i'm into|im into|help me find|busco|quiero|necesito|dame)/i;
    
    // Determine intent
    const isStrictGreeting = greetingPatterns.test(bodyTrimmed);
    const hasRecommendationIntent = recommendationPatterns.test(bodyLowerTrimmed);
    const isConversationStarter = conversationStarterPatterns.test(bodyTrimmed);
    
    // CRITICAL FIX: A message is only treated as a greeting if:
    // 1. It matches the strict greeting pattern (entire message is just greeting), AND
    // 2. It does NOT contain any recommendation-related keywords
    const isGreeting = isStrictGreeting && !hasRecommendationIntent;
    
    console.log(`Intent detection: greeting=${isGreeting}, strictGreeting=${isStrictGreeting}, hasRecommendationIntent=${hasRecommendationIntent}, conversationStarter=${isConversationStarter}`);

    // Get or create WhatsApp user profile
    let { data: whatsappUser } = await supabase
      .from("whatsapp_users")
      .select("*")
      .eq("phone_number", from)
      .maybeSingle();

    // Track if this is a brand new user
    let isFirstTimeUser = false;

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
        isFirstTimeUser = true;
      }
    }

    console.log("WhatsApp user:", whatsappUser ? `Found user ${whatsappUser.name || "unnamed"}` : "No user found");

    // Detect language from user message
    if (whatsappUser) {
      const spanishPatterns =
        /\b(hola|buenas|qué|que|donde|dónde|necesito|quiero|busco|me llamo|tengo|años|gracias|por favor|día|noche|evento|eventos|música|arte|comida|bar|fiesta|estoy|buscando)\b/i;
      const isSpanish = spanishPatterns.test(body);

      // Update language preference if not set or if it changed
      if (
        !whatsappUser.preferred_language ||
        (isSpanish && whatsappUser.preferred_language !== "es") ||
        (!isSpanish && whatsappUser.preferred_language !== "en")
      ) {
        const detectedLanguage = isSpanish ? "es" : "en";
        await supabase
          .from("whatsapp_users")
          .update({ preferred_language: detectedLanguage })
          .eq("id", whatsappUser.id);
        whatsappUser.preferred_language = detectedLanguage;
        console.log(`Detected language: ${detectedLanguage}`);
      }
    }

    const userLanguage = whatsappUser?.preferred_language || "en";

    // Check if user wants to upload an event - just send the link, no in-chat flow
    // Include "sumar" (Spanish for add/sum) which is commonly used
    const uploadIntentPatterns = /\b(upload|post|share|add|submit|crear|subir|agregar|publicar|sumar)\s+(an?\s+|un\s+|una\s+)?(event|evento|gig|show|concert|concierto|party|fiesta)\b/i;
    const isUploadIntent = uploadIntentPatterns.test(body.trim());

    // If there's an active upload flow stuck, clear it
    if (activeUpload) {
      console.log("Clearing stuck upload flow for:", from);
      await supabase
        .from("whatsapp_event_uploads")
        .delete()
        .eq("phone_number", from);
    }

    // Handle event upload intent - just send the link
    if (isUploadIntent) {
      console.log("Upload intent detected - sending link");

      const responseMessage =
        userLanguage === "es"
          ? "¡Genial! Podés subir tu evento directamente en nuestra página 🎉\n\n👉 https://theunahub.com/create-event\n\nEs súper fácil y tu evento va a aparecer en la app!"
          : "Awesome! You can upload your event directly on our page 🎉\n\n👉 https://theunahub.com/create-event\n\nIt's super easy and your event will appear in the app!";

      // Store conversation
      await supabase.from("whatsapp_conversations").insert({
        phone_number: from,
        role: "user",
        content: body,
      });

      await supabase.from("whatsapp_conversations").insert({
        phone_number: from,
        role: "assistant",
        content: responseMessage,
      });

      const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${responseMessage}</Message>
</Response>`;

      return new Response(twimlResponse, {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
        status: 200,
      });
    }

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

      // Different greeting for first-time users vs returning users
      let greetingMessage;

      if (isFirstTimeUser) {
        // Special welcome message for first-time users
        greetingMessage =
          userLanguage === "es"
            ? "Hola 👋 Bienvenido a Yara. Soy tu guía de IA para los mejores eventos, fiestas y... descuentos exclusivos de Yara AI en Buenos Aires. Contame- ¿qué estás buscando?"
            : "Hey 👋 Welcome to Yara. I'm your AI guide for Buenos Aires' best events, parties and... exclusive Yara AI discounts. Tell me- what are you looking for?";
      } else if (whatsappUser?.name) {
        // Personalized greeting for known users
        greetingMessage =
          userLanguage === "es"
            ? `¡Hola ${whatsappUser.name}! 👋 ¿Qué estás buscando hoy?`
            : `Hey ${whatsappUser.name}! 👋 What are you looking for today?`;
      } else {
        // Generic greeting for returning users without name
        greetingMessage =
          userLanguage === "es"
            ? "¡Hola! 👋 ¿En qué puedo ayudarte a encontrar en Buenos Aires?"
            : "Hey, welcome to Yara! I'm your AI guide for finding indie events, and anything in the local underground scene. Tell me- what are you looking for?";
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

    // Detect and store user information from message
    if (whatsappUser) {
      const updates: any = {};

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

    // Name/age collection removed - bot no longer asks for personal info

    // Detect if this is a recommendation request
    const recommendationKeywords =
      /\b(recommend|suggest|show me|find me|looking for|i'm looking for|im looking for|i want|i need|can you find|help me find|gimme|dame|quiero|busco|necesito|muéstrame|muestrame)\b/i;
    const isRecommendationRequest = recommendationKeywords.test(body);

    // Progressive profiling: Ask for neighborhood on second recommendation (only if not mentioned)
    if (isRecommendationRequest && whatsappUser) {
      const recCount = whatsappUser.recommendation_count || 0;

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
            "What neighborhood do you usually hang out in or prefer to go out in Buenos Aires?📍";

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

          // Increment recommendation count so we don't ask again
          await supabase
            .from("whatsapp_users")
            .update({ recommendation_count: recCount + 1 })
            .eq("id", whatsappUser.id);

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

        // Increment recommendation count so we don't ask again
        await supabase
          .from("whatsapp_users")
          .update({ recommendation_count: recCount + 1 })
          .eq("id", whatsappUser.id);

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

    // Call Yara AI chat function with user profile context (ONE call only)
    const { data: aiResponse, error: aiError } = await supabase.functions.invoke("yara-ai-chat", {
      body: {
        messages,
        stream: false,
        userProfile: whatsappUser, // Pass user profile to AI
        phoneNumber: from, // Pass phone number for tracking
        useIntroModel: false, // Use standard model
      },
    });

    if (aiError) {
      console.error("Yara AI error:", aiError);
      
      // Log error to database for monitoring
      try {
        await supabase.from('chatbot_errors').insert({
          function_name: 'twilio-whatsapp-webhook-yara-call',
          error_message: aiError.message || 'Unknown error from yara-ai-chat',
          error_stack: aiError.stack || null,
          user_query: body,
          phone_number: from,
          context: {
            whatsappUser: whatsappUser || null,
            messageCount: messages.length,
            timestamp: new Date().toISOString()
          }
        });
      } catch (logError) {
        console.error("Failed to log Yara AI error to database:", logError);
      }
      
      throw aiError;
    }

    // Extract AI response
    let assistantMessage = "";
    let multipleMessages: string[] | undefined;

    if (aiResponse) {
      console.log("Full aiResponse object:", JSON.stringify(aiResponse).substring(0, 1000));
      
      // Check if message exists and is not empty
      if (aiResponse.message && typeof aiResponse.message === 'string' && aiResponse.message.trim()) {
        assistantMessage = aiResponse.message;
      } else if (aiResponse.error) {
        // AI function returned an error in the response body
        console.error("Yara AI returned error in response:", aiResponse.error);
        assistantMessage = "Sorry, I'm having trouble right now. Please try again in a moment! 🙏";
      } else {
        // Empty or undefined message - log for debugging
        console.error("Yara AI returned empty message. Full response:", JSON.stringify(aiResponse));
        assistantMessage = "Hmm, I couldn't process that. Could you try rephrasing? 🤔";
      }
      multipleMessages = aiResponse.messages; // Array of messages if split
    } else {
      console.error("Yara AI returned null/undefined response");
      assistantMessage = "Sorry, I'm having trouble connecting. Please try again! 🙏";
    }

    console.log("Yara AI raw response:", assistantMessage?.substring(0, 500));
    if (multipleMessages) {
      console.log(`Response split into ${multipleMessages.length} messages for Twilio`);
    }

    // Detect if AI is asking for preferences and mark preferences_asked = true
    // This should only happen once per user for vague recommendation requests
    if (whatsappUser && !whatsappUser.preferences_asked) {
      const preferenceQuestionPatterns = [
        /what (type of|kind of) (music|vibe|events?)/i,
        /what are you into/i,
        /what's your vibe/i,
        /what vibe are you looking for/i,
        /personalize your recs/i,
        /to personalize/i,
        /what genre/i,
        /what style/i,
        /what mood/i,
      ];
      
      const isAskingForPreferences = preferenceQuestionPatterns.some(pattern => 
        pattern.test(assistantMessage)
      );
      
      if (isAskingForPreferences) {
        console.log("AI is asking for preferences - marking preferences_asked = true");
        await supabase
          .from("whatsapp_users")
          .update({ preferences_asked: true })
          .eq("id", whatsappUser.id);
        whatsappUser.preferences_asked = true;
      }
    }

    // Try to parse as JSON - extract JSON from text if needed
    let cleanedMessage = assistantMessage.trim();
    let prefixText = ""; // Text before JSON, if any

    // CRITICAL FIX: Handle double-stringified JSON (AI sometimes wraps JSON in quotes with escaped quotes)
    // Pattern: "{ \"key\": \"value\" }" - the entire JSON is wrapped in a string
    if (cleanedMessage.startsWith('"') && cleanedMessage.includes('\\"')) {
      console.log("Detected double-stringified JSON (wrapped in quotes with escaped quotes)");
      try {
        // Try to parse the outer string first
        const unescapedMessage = JSON.parse(cleanedMessage);
        if (typeof unescapedMessage === 'string') {
          cleanedMessage = unescapedMessage.trim();
          console.log("Successfully unescaped double-stringified JSON:", cleanedMessage.substring(0, 200) + "...");
        }
      } catch (e) {
        console.log("Failed to unescape double-stringified JSON, trying manual unescape");
        // Manual fallback: remove outer quotes and unescape inner quotes
        if (cleanedMessage.startsWith('"') && cleanedMessage.endsWith('"')) {
          cleanedMessage = cleanedMessage.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n').trim();
          console.log("Manually unescaped JSON:", cleanedMessage.substring(0, 200) + "...");
        }
      }
    }

    // CRITICAL FIX: Strip markdown code block wrappers (```json ... ```) before parsing
    // This prevents raw JSON from being sent to users when AI wraps response in code blocks
    const markdownJsonMatch = cleanedMessage.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (markdownJsonMatch) {
      console.log("Detected markdown-wrapped JSON, stripping code block markers");
      // Capture any text before the markdown block
      const markdownStartIndex = cleanedMessage.indexOf(markdownJsonMatch[0]);
      if (markdownStartIndex > 0) {
        prefixText = cleanedMessage.substring(0, markdownStartIndex).trim();
        console.log("Found prefix text before markdown JSON:", prefixText?.substring(0, 100));
      }
      cleanedMessage = markdownJsonMatch[1].trim();
      console.log("Extracted JSON from markdown block:", cleanedMessage.substring(0, 200) + "...");
    } else {
      // Try to extract JSON from the response without markdown wrapper
      // Look for a JSON object starting with { and ending with } OR JSON array starting with [ and ending with ]
      const jsonObjectMatch = cleanedMessage.match(/\{[\s\S]*\}/);
      const jsonArrayMatch = cleanedMessage.match(/\[[\s\S]*\]/);
      
      // Use whichever match comes first in the message
      let jsonMatch = null;
      if (jsonObjectMatch && jsonArrayMatch) {
        const objectIndex = cleanedMessage.indexOf(jsonObjectMatch[0]);
        const arrayIndex = cleanedMessage.indexOf(jsonArrayMatch[0]);
        jsonMatch = objectIndex < arrayIndex ? jsonObjectMatch : jsonArrayMatch;
      } else {
        jsonMatch = jsonObjectMatch || jsonArrayMatch;
      }
      
      if (jsonMatch) {
        // Capture any text before the JSON (intro text like "Here are some events...")
        const jsonStartIndex = cleanedMessage.indexOf(jsonMatch[0]);
        if (jsonStartIndex > 0) {
          prefixText = cleanedMessage.substring(0, jsonStartIndex).trim();
          console.log("Found prefix text before JSON:", prefixText?.substring(0, 100));
        }
        cleanedMessage = jsonMatch[0];
        console.log("Extracted JSON from response:", cleanedMessage.substring(0, 200) + "...");
      }
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(cleanedMessage);
      console.log(
        "Successfully parsed JSON response with",
        parsedResponse.recommendations?.length || 0,
        "recommendations",
      );
      
      // CRITICAL FIX: Handle raw JSON array (AI sometimes returns [...] instead of {intro_message, recommendations: [...]})
      if (Array.isArray(parsedResponse)) {
        console.log("AI returned raw JSON array instead of object. Converting to proper format.");
        parsedResponse = {
          intro_message: prefixText || null,
          recommendations: parsedResponse
        };
      }
      
      // CRITICAL FIX: If we successfully parsed JSON with recommendations, 
      // do NOT fall through to conversational path
      if (parsedResponse.recommendations && Array.isArray(parsedResponse.recommendations)) {
        // Use prefix text as intro message if the response didn't include one
        if (prefixText && !parsedResponse.intro_message) {
          parsedResponse.intro_message = prefixText;
          console.log("Using prefix text as intro_message:", prefixText);
        }
      } else {
        // CRITICAL FIX: JSON parsed but recommendations is not a valid array
        // Clear parsedResponse and strip JSON from assistantMessage to prevent sending raw code
        console.log("WARNING: JSON parsed but recommendations is not a valid array. Clearing parsed response.");
        
        // Extract intro_message before clearing parsedResponse
        const introMsg = parsedResponse?.intro_message;
        parsedResponse = null;
        
        if (introMsg && typeof introMsg === 'string' && introMsg.length > 10) {
          assistantMessage = introMsg;
          console.log("Using intro_message from parsed JSON:", introMsg);
        } else {
          assistantMessage = "I found some options for you! Let me check the details...";
        }
      }
    } catch (e) {
      // Not JSON, just a regular conversational response
      console.log("Response is not valid JSON, treating as conversational text");
      parsedResponse = null;
      
      // CRITICAL FIX: Detect when AI outputs raw function call syntax instead of using tool mechanism
      // Pattern matches: "provide_recommendations(...)", "Calling `provide_recommendations` with `{...}`", etc.
      const functionCallPattern = /\b(provide_recommendations|give_recommendations)\s*\([^)]*\)/i;
      const callingFunctionPattern = /calling\s*[`'"]*\s*(provide_recommendations|give_recommendations)[`'"]*\s*(with)?/i;
      
      if (functionCallPattern.test(assistantMessage) || callingFunctionPattern.test(assistantMessage)) {
        console.log("WARNING: AI outputted raw function call syntax instead of using tool mechanism. Extracting query and fetching events directly.");
        
        // Try to extract the user's actual query from the function call parameters
        const paramMatch = assistantMessage.match(/["'`]?time_frame["'`]?\s*:\s*["'`]?([^"'`,}]+)/i);
        const timeFrame = paramMatch ? paramMatch[1].toLowerCase().trim() : "today";
        
        // Instead of asking for clarification, we'll let the fallback in yara-ai-chat handle it
        // by sending a helpful response
        assistantMessage = timeFrame === "today" || timeFrame === "tonight"
          ? "¡Déjame buscar los eventos de hoy para vos! 🔍"
          : "¡Déjame buscar opciones para vos! 🔍";
      }
      // CRITICAL FIX: If the message looks like it contains JSON but failed to parse,
      // strip out any JSON-like content to avoid sending raw code to user
      else if (cleanedMessage.includes('"recommendations"') || cleanedMessage.includes('"type":') || 
               cleanedMessage.includes('"intro_message"') || cleanedMessage.includes('"title":') ||
               (cleanedMessage.trim().startsWith('[') && cleanedMessage.includes('"id":'))) {
        console.log("WARNING: Response contains JSON-like content but failed to parse. Stripping it.");
        
        // CRITICAL FIX: Try to manually extract and re-parse the JSON array
        // This handles cases where the AI returns a raw array that failed initial parsing
        const rawArrayMatch = cleanedMessage.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (rawArrayMatch) {
          try {
            const manualParsed = JSON.parse(rawArrayMatch[0]);
            if (Array.isArray(manualParsed) && manualParsed.length > 0) {
              console.log("Successfully manually parsed JSON array with", manualParsed.length, "items");
              parsedResponse = {
                intro_message: null,
                recommendations: manualParsed
              };
              // Don't fall through to text stripping - we recovered the data!
            }
          } catch (manualParseError) {
            console.log("Manual JSON array parsing also failed:", manualParseError.message);
          }
        }
        
        // If we couldn't recover the JSON, strip it out
        if (!parsedResponse) {
          // Extract only the human-readable text before any JSON
          const jsonPatternStart = cleanedMessage.search(/[\[{]/);
          if (jsonPatternStart > 0) {
            assistantMessage = cleanedMessage.substring(0, jsonPatternStart).trim();
            console.log("Stripped JSON, remaining text:", assistantMessage);
          }
          // If the entire message is JSON-like (starts with [ or {), use fallback
          if (!assistantMessage || assistantMessage.length < 10 || jsonPatternStart === 0) {
            assistantMessage = "I found some options for you! Let me format those properly...";
            console.log("Entire message was JSON-like, using fallback text");
          }
        }
      }
    }

    // Handle recommendations response (even if empty - don't show raw JSON)
    if (parsedResponse && parsedResponse.recommendations && Array.isArray(parsedResponse.recommendations)) {
      console.log(`Found ${parsedResponse.recommendations.length} recommendations to send`);

      // CRITICAL FIX: Filter out jam sessions when user asks for workshops
      const userAskedForWorkshops = /\b(workshop|workshops|class|classes|course|courses|taller|talleres)\b/i.test(body);

      if (userAskedForWorkshops) {
        // Remove jam sessions and other non-workshop events
        const workshopKeywords = /\b(workshop|class|course|taller|masterclass|training|seminar|lesson|tutorial)\b/i;

        parsedResponse.recommendations = parsedResponse.recommendations.filter((rec) => {
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

      // If no recommendations found, check if user was just saying thanks/gratitude
      // In that case, don't send the generic "couldn't find matches" message
      if (parsedResponse.recommendations.length === 0) {
        const gratitudePatterns = /\b(thanks|thank you|gracias|thx|ty|merci|cheers|perfect|awesome|great|ok thanks|cool|nice|got it)\b/i;
        const isGratitude = gratitudePatterns.test(body);
        
        if (isGratitude) {
          console.log("User expressed gratitude but got empty recommendations - using fallback gratitude response");
          const gratitudeResponse = userLanguage === 'es' 
            ? "¡De nada! 🙌 Avisame si necesitás algo más!"
            : "You're welcome! 😊 Let me know if you need anything else!";
          
          await supabase.from("whatsapp_conversations").insert({
            phone_number: from,
            role: "assistant",
            content: gratitudeResponse,
          });

          const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${gratitudeResponse}</Message>
</Response>`;

          return new Response(twimlResponse, {
            headers: { ...corsHeaders, "Content-Type": "text/xml" },
            status: 200,
          });
        }
        
        const noResultsMessage = userLanguage === 'es'
          ? "No encontré opciones específicas para eso ahora. Probá preguntando algo diferente - como 'bares en Palermo' o 'música en vivo esta noche'!"
          : "I couldn't find specific matches for that right now. Try asking about something else - like 'bars in Palermo' or 'live music tonight'!";

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

      // Get Twilio WhatsApp number
      const twilioWhatsAppNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER") || "whatsapp:+17622513744";

      // Prepare the intro message
      const introMessage = parsedResponse.intro_message || "Here are some recommendations for you! 🎯";

      // CRITICAL FIX: Store a human-readable version instead of raw JSON
      // This prevents users from seeing JSON if background function fails
      const humanReadableContent = `${introMessage}\n\n[${parsedResponse.recommendations.length} recommendations sent]`;
      
      await supabase.from("whatsapp_conversations").insert({
        phone_number: from,
        role: "assistant",
        content: humanReadableContent,
      });

      // Trigger send-whatsapp-recommendations in background - it will send intro FIRST, then recommendations
      console.log("Triggering send-whatsapp-recommendations with intro message...");
      
      try {
        const { data: sendData, error: sendError } = await supabase.functions
          .invoke("send-whatsapp-recommendations", {
            body: {
              recommendations: parsedResponse.recommendations,
              toNumber: from,
              fromNumber: twilioWhatsAppNumber,
              introText: introMessage, // Pass intro to background function - it will send it first
            },
          });
        
        if (sendError) {
          console.error("Error invoking send-whatsapp-recommendations:", sendError);
          // CRITICAL FIX: If background function fails, send intro via TwiML as fallback
          const escapedIntro = introMessage
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
          
          const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapedIntro}</Message>
</Response>`;
          
          console.log("Sending fallback TwiML with intro message due to background function error");
          return new Response(fallbackTwiml, {
            headers: { ...corsHeaders, "Content-Type": "text/xml" },
            status: 200,
          });
        }
        
        console.log("Send-whatsapp-recommendations completed successfully:", sendData);
      } catch (invokeError) {
        console.error("Failed to invoke send-whatsapp-recommendations:", invokeError);
        // CRITICAL FIX: Send intro as fallback on exception
        const escapedIntro = introMessage
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&apos;");
        
        const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapedIntro}</Message>
</Response>`;
        
        console.log("Sending fallback TwiML with intro message due to exception");
        return new Response(fallbackTwiml, {
          headers: { ...corsHeaders, "Content-Type": "text/xml" },
          status: 200,
        });
      }

      // Return empty TwiML response (background function handles everything)
      const emptyTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`;

      console.log("Returning empty TwiML (background function will send intro + recommendations)");
      return new Response(emptyTwiml, {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
        status: 200,
      });
    }

    // Regular conversational response (no recommendations)
    console.log("Sending conversational response");

    // CRITICAL FIX: Detect TEASER/PLACEHOLDER messages that should never be sent
    // The AI sometimes outputs these instead of actual recommendations
    const teaserPatterns = [
      /^got$/i,
      /^ok$/i,
      /give me a moment/i,
      /let me (check|look|find|search)/i,
      /one moment/i,
      /moment away/i,
      /technical glitch/i,
      /thanks for your patience/i,
      /be back with/i,
      /in a flash/i,
      /un momento/i,
      /dame un momento/i,
      /just a sec/i,
      /looking (for|up)/i,
      /I'll get back to you/i,
      /I'll be back/i,
      /please wait/i,
      /checking now/i,
      /searching for/i,
      /working on it/i,
      /processing/i,
      /fetching/i,
      /small (technical )?glitch/i,
      /bear with me/i,
      /hang tight/i,
    ];
    
    const isTeaserMessage = teaserPatterns.some(pattern => pattern.test(assistantMessage.trim()));
    const isRecommendationQuery = /\b(event|events|party|parties|bar|bars|club|clubs|tonight|today|tomorrow|weekend|happening|recommend|fiesta|show me|what's on|mañana|hoy|esta noche)\b/i.test(body);
    
    if (isTeaserMessage && isRecommendationQuery) {
      console.log("WARNING: Detected teaser/placeholder message for recommendation query. Fetching events directly.");
      
      // Instead of asking user to retry, fetch events directly from database
      try {
        const today = new Date();
        const buenosAiresOffset = -3 * 60;
        const localTime = new Date(today.getTime() + (today.getTimezoneOffset() + buenosAiresOffset) * 60000);
        
        // Check if query is for tomorrow
        const isTomorrowQuery = /\b(tomorrow|mañana)\b/i.test(body);
        const targetDate = new Date(localTime);
        if (isTomorrowQuery) {
          targetDate.setDate(targetDate.getDate() + 1);
        }
        const targetDateStr = targetDate.toISOString().split('T')[0];
        
        // Fetch events for the target date
        const { data: events } = await supabase
          .from('events')
          .select('id, title, description, date, time, location, venue_name, image_url, external_link')
          .or(`date.eq.${targetDateStr},date.ilike.every ${targetDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()}`)
          .limit(5);
        
        if (events && events.length > 0) {
          console.log(`Found ${events.length} events for fallback. Sending via send-whatsapp-recommendations`);
          
          // Format as recommendations and send via the recommendation function
          const recommendations = events.map(e => ({
            id: e.id,
            type: 'event',
            title: e.title,
            description: e.description || '',
            time: e.time,
            location: e.location || e.venue_name,
            image_url: e.image_url,
            external_link: e.external_link
          }));
          
          const dateLabel = isTomorrowQuery 
            ? (userLanguage === 'es' ? 'mañana' : 'tomorrow')
            : (userLanguage === 'es' ? 'hoy' : 'today');
          
          const introMessage = userLanguage === 'es'
            ? `¡Encontré ${events.length} eventos para ${dateLabel}! 🎉`
            : `Found ${events.length} events for ${dateLabel}! 🎉`;
          
          // Call send-whatsapp-recommendations in background
          supabase.functions.invoke('send-whatsapp-recommendations', {
            body: {
              phoneNumber: from,
              introMessage,
              recommendations
            }
          }).catch(err => console.error('Error sending fallback recommendations:', err));
          
          // Return empty TwiML since recommendations will be sent separately
          const emptyTwiml = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
          console.log("Returning empty TwiML (fallback recommendations being sent)");
          return new Response(emptyTwiml, {
            headers: { ...corsHeaders, "Content-Type": "text/xml" },
            status: 200,
          });
        }
      } catch (fallbackError) {
        console.error("Fallback event fetch failed:", fallbackError);
      }
      
      // If fallback also failed, send retry message
      assistantMessage = userLanguage === 'es' 
        ? "Hmm, parece que algo salió mal. ¿Podés preguntarme de nuevo qué eventos te interesan? 🎯" 
        : "Hmm, something went wrong. Could you ask me again about what events you're looking for? 🎯";
    }

    // CRITICAL SAFETY CHECK: Never store or send raw JSON/markdown code blocks to users
    // This is a final fallback to catch any edge cases
    const hasRawJson = assistantMessage.includes('```json') || 
                       assistantMessage.includes('"recommendations"') ||
                       assistantMessage.includes('"intro_message"');
    
    if (hasRawJson) {
      console.log("WARNING: Detected raw JSON in conversational response, using fallback message");
      assistantMessage = userLanguage === 'es' 
        ? "Encontré algunas opciones para vos! Dame un momento para mostrártelas..." 
        : "I found some options for you! Give me a moment to show them...";
    }

    try {
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
            // Escape XML special characters
            const escapedMsg = msg
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&apos;");
            return `  <Message>${escapedMsg}</Message>`;
          })
          .join("\n");

        const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
${twimlMessages}
</Response>`;

        console.log("Sending split TwiML response");
        return new Response(twimlResponse, {
          headers: { ...corsHeaders, "Content-Type": "text/xml" },
          status: 200,
        });
      }

      // Escape XML special characters for single message
      const escapedMessage = assistantMessage
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

      const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapedMessage}</Message>
</Response>`;

      console.log("Sending TwiML response");

      return new Response(twimlResponse, {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
        status: 200,
      });
    } catch (storageError) {
      console.error("Error storing or sending conversational response:", storageError);

      // Still try to send the message even if storage fails
      const escapedMessage = assistantMessage
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

      const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapedMessage}</Message>
</Response>`;

      return new Response(twimlResponse, {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
        status: 200,
      });
    }
  } catch (error) {
    console.error("Error in Twilio webhook:", error);

    // Initialize supabase for error logging if not already initialized
    let supabaseForLogging;
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && supabaseKey) {
        supabaseForLogging = createClient(supabaseUrl, supabaseKey);
      }
    } catch (e) {
      console.error("Could not create supabase client for logging:", e);
    }

    // Log error to database for monitoring (only if we have the client)
    if (supabaseForLogging) {
      try {
        await supabaseForLogging.from('chatbot_errors').insert({
          function_name: 'twilio-whatsapp-webhook',
          error_message: error.message || 'Unknown error in webhook',
          error_stack: error.stack || null,
          user_query: 'Error occurred before message extraction',
          phone_number: 'Unknown',
          context: {
            timestamp: new Date().toISOString(),
            errorType: error.name || 'UnknownError'
          }
        });
      } catch (logError) {
        console.error("Failed to log webhook error to database:", logError);
      }
    }

    // CRITICAL FIX: Return empty TwiML on error to prevent Twilio from retrying
    // This prevents the "Sorry, I encountered an error" message from being sent
    // multiple times when there are transient issues
    console.log("Returning empty TwiML response due to error (prevents duplicate error messages)");
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
        status: 200,
      },
    );
  }
});
