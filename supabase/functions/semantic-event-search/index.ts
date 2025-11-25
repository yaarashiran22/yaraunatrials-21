import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate embedding using OpenAI
async function generateEmbedding(text: string, openaiKey: string): Promise<number[]> {
  console.log('semantic-event-search: Generating embedding for text length:', text.length);
  
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('semantic-event-search: OpenAI embedding error:', errorText);
    throw new Error(`OpenAI embedding failed: ${errorText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// Use LLM to extract user intent from chat history
async function extractUserIntent(messages: Array<{ role: string; content: string }>, openaiKey: string): Promise<string> {
  console.log('semantic-event-search: Extracting user intent from', messages.length, 'messages');
  
  const recentMessages = messages.slice(-6);
  const chatHistory = recentMessages.map(m => `${m.role}: ${m.content}`).join('\n');
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a search query extractor. Analyze the chat history and extract what the user is looking for in terms of events/activities in Buenos Aires.

Output ONLY a short, focused search query (max 50 words) that captures the user's intent. Include relevant keywords like:
- Event type (party, concert, art exhibition, brunch, yoga, etc.)
- Mood/vibe (chill, energetic, romantic, social, artsy)
- Music type if mentioned (jazz, techno, latin, live music)
- Location/neighborhood if mentioned
- Time preference if mentioned (tonight, weekend, afternoon)

Do NOT include greetings, small talk, or irrelevant details. Just the core search intent.`
        },
        {
          role: 'user',
          content: `Chat history:\n${chatHistory}\n\nExtract the search query:`
        }
      ],
      max_tokens: 100,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('semantic-event-search: Intent extraction error:', errorText);
    // Fallback to simple extraction
    const userMessages = recentMessages.filter(m => m.role === 'user').map(m => m.content).join(' ');
    console.log('semantic-event-search: Falling back to raw user messages');
    return userMessages;
  }

  const data = await response.json();
  const intent = data.choices[0].message.content.trim();
  console.log('semantic-event-search: Extracted intent:', intent);
  return intent;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('semantic-event-search: Request received');

  try {
    const body = await req.json();
    console.log('semantic-event-search: Request body keys:', Object.keys(body));
    
    const { messages, matchCount = 10, matchThreshold = 0.3 } = body;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.error('semantic-event-search: Invalid messages array');
      return new Response(
        JSON.stringify({ error: 'messages array is required and must not be empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`semantic-event-search: Processing ${messages.length} messages`);

    // Get API keys
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openaiKey) {
      console.error('semantic-event-search: OPENAI_API_KEY not configured');
      throw new Error('OPENAI_API_KEY not configured');
    }

    if (!supabaseUrl || !supabaseKey) {
      console.error('semantic-event-search: Supabase configuration missing');
      throw new Error('Supabase configuration missing');
    }

    // Step 1: Extract user intent using LLM
    console.log('semantic-event-search: Step 1 - Extracting user intent...');
    const userIntent = await extractUserIntent(messages, openaiKey);

    // Step 2: Generate embedding for the refined intent
    console.log('semantic-event-search: Step 2 - Generating embedding...');
    const queryEmbedding = await generateEmbedding(userIntent, openaiKey);
    console.log('semantic-event-search: Embedding generated, dimensions:', queryEmbedding.length);

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Call match_events RPC function
    console.log('semantic-event-search: Calling match_events with threshold:', matchThreshold, 'count:', matchCount);
    const { data: matchedEvents, error: matchError } = await supabase.rpc('match_events', {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: matchThreshold,
      match_count: matchCount,
    });

    if (matchError) {
      console.error('semantic-event-search: match_events error:', matchError);
      throw new Error(`match_events failed: ${matchError.message}`);
    }

    console.log('semantic-event-search: Found', matchedEvents?.length || 0, 'matching events');

    // If we have matches, fetch full event details (without embedding)
    let fullEvents = [];
    if (matchedEvents && matchedEvents.length > 0) {
      const eventIds = matchedEvents.map((e: any) => e.id);
      
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select(`
          id, title, description, date, time, location, address,
          price, price_range, image_url, video_url, external_link,
          event_type, mood, market, target_audience, music_type,
          venue_size, venue_name, ticket_link
        `)
        .in('id', eventIds);

      if (eventsError) {
        console.error('semantic-event-search: Error fetching event details:', eventsError);
        throw new Error(`Failed to fetch event details: ${eventsError.message}`);
      }

      // Merge similarity scores with full event data
      fullEvents = events?.map(event => {
        const match = matchedEvents.find((m: any) => m.id === event.id);
        return {
          ...event,
          similarity: match?.similarity || 0,
        };
      }).sort((a, b) => b.similarity - a.similarity) || [];
    }

    console.log('semantic-event-search: Returning', fullEvents.length, 'events with full details');

    return new Response(
      JSON.stringify({
        success: true,
        extractedIntent: userIntent,
        matchCount: fullEvents.length,
        events: fullEvents,
      }),
    );

  } catch (error) {
    console.error('semantic-event-search: Error:', error);
    console.error('semantic-event-search: Error stack:', error.stack);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        stack: error.stack 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
