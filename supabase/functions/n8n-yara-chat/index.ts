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
    
    // Initialize response structure
    let message = '';
    let events = [];
    let coupons = [];
    let top_lists = [];
    
    // Handle different response formats from yara-ai-chat
    // Case 1: Direct message string (from data.message)
    if (typeof data === 'string') {
      message = data;
    } else if (data.message) {
      message = data.message;
    }
    
    // Case 2: Tool calling response (structured recommendations)
    // The data might contain tool_calls or parsed JSON
    try {
      // Check if data itself is a JSON string with recommendations
      let parsedData = data;
      if (typeof data === 'string') {
        try {
          parsedData = JSON.parse(data);
        } catch (e) {
          // Not JSON, keep as string
        }
      }
      
      // Look for recommendations in the parsed data
      if (parsedData && typeof parsedData === 'object') {
        // Case A: Direct recommendations object
        if (parsedData.intro_message && parsedData.recommendations) {
          message = parsedData.intro_message;
          
          // Categorize recommendations by type
          for (const rec of parsedData.recommendations) {
            if (rec.type === 'event') {
              events.push(rec);
            } else if (rec.type === 'coupon') {
              coupons.push(rec);
            } else if (rec.type === 'topListItem' || rec.type === 'top_list') {
              top_lists.push(rec);
            }
          }
        }
        // Case B: Message with embedded JSON
        else if (parsedData.message) {
          const msgContent = parsedData.message;
          
          // Try to extract JSON from the message text
          const jsonMatch = msgContent.match(/\{[\s\S]*?"recommendations"[\s\S]*?\}/);
          if (jsonMatch) {
            try {
              const embedded = JSON.parse(jsonMatch[0]);
              if (embedded.intro_message) {
                message = embedded.intro_message;
              }
              if (embedded.recommendations && Array.isArray(embedded.recommendations)) {
                for (const rec of embedded.recommendations) {
                  if (rec.type === 'event') {
                    events.push(rec);
                  } else if (rec.type === 'coupon') {
                    coupons.push(rec);
                  } else if (rec.type === 'topListItem' || rec.type === 'top_list') {
                    top_lists.push(rec);
                  }
                }
              }
            } catch (e) {
              console.log('Could not parse embedded JSON:', e);
              message = msgContent;
            }
          } else {
            // No embedded JSON, use the message as-is
            message = msgContent;
          }
        }
      }
    } catch (e) {
      console.log('Error parsing yara-ai-chat response:', e);
      // Fallback to message text if available
      if (!message && data.message) {
        message = data.message;
      }
    }
    
    // Return structured response as a single object (not array)
    const structuredResponse = {
      message: message || 'No response generated',
      events,
      coupons,
      top_lists
    };
    
    return new Response(
      JSON.stringify(structuredResponse),
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
