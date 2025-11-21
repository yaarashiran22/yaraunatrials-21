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
    const { messages, userProfile, phoneNumber } = await req.json();
    
    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`n8n-yara-chat: Processing ${messages.length} messages`);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Call the existing yara-ai-chat function with stream=false for JSON responses
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
      console.error('Error calling yara-ai-chat:', error);
      throw new Error(`Failed to get response from Yara: ${error.message}`);
    }
    
    console.log('Successfully got response from yara-ai-chat');
    
    // Pass through LLM for structured data extraction
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const structurePrompt = `Extract and structure the following chatbot response into clean JSON format with these fields:
- message: the conversational text response
- recommendations: array of recommended items (events, coupons, top_lists), each with relevant fields
- type: the type of recommendations (events, coupons, top_lists, mixed)

Raw response to structure:
${JSON.stringify(data)}

Return ONLY valid JSON, no markdown formatting.`;

    const structureResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a data structuring assistant. Extract and format data into clean JSON.' },
          { role: 'user', content: structurePrompt }
        ],
        temperature: 0.1,
      }),
    });

    if (!structureResponse.ok) {
      console.error('Error structuring data with LLM:', await structureResponse.text());
      // Fall back to original response if structuring fails
      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const structuredData = await structureResponse.json();
    let structuredContent = structuredData.choices[0].message.content;

    // Clean up any markdown formatting
    structuredContent = structuredContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    let finalResponse;
    try {
      finalResponse = JSON.parse(structuredContent);
    } catch (e) {
      console.error('Failed to parse structured response, returning original:', e);
      finalResponse = data;
    }

    console.log('Successfully structured response');
    
    return new Response(
      JSON.stringify(finalResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in n8n-yara-chat:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
