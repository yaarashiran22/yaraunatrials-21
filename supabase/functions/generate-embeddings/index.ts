import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type TableConfig = {
  name: string;
  textFields: string[];
  selectFields: string;
};

const TABLE_CONFIGS: TableConfig[] = [
  {
    name: 'events',
    textFields: ['title', 'description', 'location', 'mood', 'music_type', 'venue_name'],
    selectFields: 'id, title, description, location, mood, music_type, venue_name',
  },
  {
    name: 'user_coupons',
    textFields: ['title', 'description', 'business_name', 'neighborhood', 'discount_amount'],
    selectFields: 'id, title, description, business_name, neighborhood, discount_amount',
  },
  {
    name: 'items',
    textFields: ['title', 'description', 'category', 'location'],
    selectFields: 'id, title, description, category, location',
  },
  {
    name: 'top_list_items',
    textFields: ['name', 'description', 'location'],
    selectFields: 'id, name, description, location',
  },
];

async function generateEmbedding(text: string, openaiKey: string): Promise<number[]> {
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
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

async function processTable(
  supabase: ReturnType<typeof createClient>,
  openaiKey: string,
  config: TableConfig,
  forceRegenerate: boolean
): Promise<{ processed: number; total: number; errors: number }> {
  console.log(`Processing table: ${config.name}`);

  // Build query - if forceRegenerate, get all records, otherwise only those without embeddings
  let query = supabase
    .from(config.name)
    .select(config.selectFields);

  if (!forceRegenerate) {
    query = query.is('embedding', null);
  }

  const { data: records, error: fetchError } = await query.limit(500);

  if (fetchError) {
    console.error(`Error fetching ${config.name}:`, fetchError);
    throw fetchError;
  }

  if (!records || records.length === 0) {
    console.log(`No records to process in ${config.name}`);
    return { processed: 0, total: 0, errors: 0 };
  }

  console.log(`Found ${records.length} records in ${config.name}`);

  const batchSize = 20;
  let processedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    // Create text representations for embedding
    const texts = batch.map(record => {
      const parts = config.textFields
        .map(field => record[field])
        .filter(Boolean);
      return parts.join(' ');
    });

    try {
      // Generate embeddings using OpenAI batch API
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: texts,
        }),
      });

      if (!embeddingResponse.ok) {
        const error = await embeddingResponse.text();
        console.error(`OpenAI API error for ${config.name}:`, error);
        errorCount += batch.length;
        continue;
      }

      const embeddingData = await embeddingResponse.json();

      // Update records with embeddings
      for (let j = 0; j < batch.length; j++) {
        const record = batch[j];
        const embedding = embeddingData.data[j].embedding;

        const { error: updateError } = await supabase
          .from(config.name)
          .update({ embedding })
          .eq('id', record.id);

        if (updateError) {
          console.error(`Error updating ${config.name} record ${record.id}:`, updateError);
          errorCount++;
        } else {
          processedCount++;
        }
      }

      console.log(`${config.name}: Processed batch ${Math.floor(i / batchSize) + 1}, total: ${processedCount}`);
    } catch (error) {
      console.error(`Batch processing error for ${config.name}:`, error);
      errorCount += batch.length;
    }
  }

  return { processed: processedCount, total: records.length, errors: errorCount };
}

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

    // Parse request body for options
    let tables: string[] | null = null;
    let forceRegenerate = false;

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        // Optional: specify which tables to process
        if (body.tables && Array.isArray(body.tables)) {
          tables = body.tables;
        }
        // Optional: force regenerate all embeddings
        if (body.forceRegenerate === true) {
          forceRegenerate = true;
        }
      } catch {
        // No body or invalid JSON, process all tables
      }
    }

    // Determine which tables to process
    const tablesToProcess = tables
      ? TABLE_CONFIGS.filter(c => tables!.includes(c.name))
      : TABLE_CONFIGS;

    if (tablesToProcess.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid tables specified' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing tables: ${tablesToProcess.map(t => t.name).join(', ')}`);
    console.log(`Force regenerate: ${forceRegenerate}`);

    const results: Record<string, { processed: number; total: number; errors: number }> = {};

    for (const config of tablesToProcess) {
      try {
        results[config.name] = await processTable(supabase, openAIApiKey, config, forceRegenerate);
      } catch (error) {
        console.error(`Failed to process ${config.name}:`, error);
        results[config.name] = { processed: 0, total: 0, errors: -1 };
      }
    }

    const totalProcessed = Object.values(results).reduce((sum, r) => sum + r.processed, 0);
    const totalRecords = Object.values(results).reduce((sum, r) => sum + r.total, 0);
    const totalErrors = Object.values(results).reduce((sum, r) => sum + (r.errors > 0 ? r.errors : 0), 0);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Embeddings generated successfully`,
        summary: {
          totalProcessed,
          totalRecords,
          totalErrors,
        },
        results,
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
