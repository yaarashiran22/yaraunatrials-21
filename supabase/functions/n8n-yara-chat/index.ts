import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('n8n-yara-chat: Request received');

  try {
    const body = await req.json();
    console.log('n8n-yara-chat: Request body parsed:', JSON.stringify(body));
    
    const { messages, userProfile, phoneNumber } = body;
    
    if (!messages || !Array.isArray(messages)) {
      console.error('n8n-yara-chat: Invalid messages array');
      return new Response(
        JSON.stringify({ error: 'messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`n8n-yara-chat: Processing ${messages.length} messages`);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('n8n-yara-chat: Supabase configuration missing');
      throw new Error('Supabase configuration missing');
    }
    
    console.log('n8n-yara-chat: Creating Supabase client');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Call the existing yara-ai-chat function with stream=false for JSON responses
    console.log('n8n-yara-chat: Calling yara-ai-chat function');
    const { data, error } = await supabase.functions.invoke('yara-ai-chat', {
      body: {
        messages,
        stream: false, // Get JSON responses for n8n
        userProfile,
        phoneNumber,
        useIntroModel: false
      }
    });
    
    if (error) {
      console.error('n8n-yara-chat: Error calling yara-ai-chat:', error);
      throw new Error(`Failed to get response from Yara: ${error.message}`);
    }
    
    console.log('n8n-yara-chat: Successfully got response from yara-ai-chat');
    console.log('n8n-yara-chat: Response data:', JSON.stringify(data));
    
    // Simply return the data from yara-ai-chat without additional LLM processing
    // n8n can handle the parsing on their end
    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('n8n-yara-chat: Error:', error);
    console.error('n8n-yara-chat: Error stack:', error.stack);
    return new Response(
      JSON.stringify({ 
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
