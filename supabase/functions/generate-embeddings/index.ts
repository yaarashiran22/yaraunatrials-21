import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openAIApiKey || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get events without embeddings
    const { data: events, error: fetchError } = await supabase
      .from('events')
      .select('id, title, description, location, mood, music_type')
      .is('embedding', null)
      .limit(100);

    if (fetchError) {
      console.error('Error fetching events:', fetchError);
      throw fetchError;
    }

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No events need embeddings', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${events.length} events for embeddings`);

    // Process events in batches
    const batchSize = 20;
    let processedCount = 0;

    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      
      // Create text representations for embedding
      const texts = batch.map(event => {
        const parts = [
          event.title,
          event.description,
          event.location,
          event.mood,
          event.music_type
        ].filter(Boolean);
        return parts.join(' ');
      });

      // Generate embeddings using OpenAI
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: texts,
        }),
      });

      if (!embeddingResponse.ok) {
        const error = await embeddingResponse.text();
        console.error('OpenAI API error:', error);
        throw new Error(`OpenAI API error: ${error}`);
      }

      const embeddingData = await embeddingResponse.json();

      // Update events with embeddings
      for (let j = 0; j < batch.length; j++) {
        const event = batch[j];
        const embedding = embeddingData.data[j].embedding;

        const { error: updateError } = await supabase
          .from('events')
          .update({ embedding })
          .eq('id', event.id);

        if (updateError) {
          console.error(`Error updating event ${event.id}:`, updateError);
        } else {
          processedCount++;
        }
      }

      console.log(`Processed batch ${Math.floor(i / batchSize) + 1}, total: ${processedCount}`);
    }

    return new Response(
      JSON.stringify({
        message: 'Embeddings generated successfully',
        processed: processedCount,
        total: events.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-embeddings:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
