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

// Extract search context from chat history
function extractSearchContext(messages: Array<{ role: string; content: string }>): string {
  // Take the last few messages to understand context
  const recentMessages = messages.slice(-5);
  
  // Combine user messages to understand intent
  const userMessages = recentMessages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join(' ');
  
  // If there's a recent assistant message with recommendations context, include it
  const lastAssistant = recentMessages
    .filter(m => m.role === 'assistant')
    .pop();
  
  let context = userMessages;
  if (lastAssistant && lastAssistant.content.length < 500) {
    context = `${userMessages} Context: ${lastAssistant.content}`;
  }
  
  console.log('semantic-event-search: Extracted search context:', context.substring(0, 200));
  return context;
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

    // Extract search context from chat history
    const searchContext = extractSearchContext(messages);

    // Generate embedding for the search context
    console.log('semantic-event-search: Generating embedding...');
    const queryEmbedding = await generateEmbedding(searchContext, openaiKey);
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
        searchContext: searchContext.substring(0, 200),
        matchCount: fullEvents.length,
        events: fullEvents,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
