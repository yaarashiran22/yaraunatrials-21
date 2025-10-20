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
    const { phoneNumber } = await req.json();
    
    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Delete all conversations for this phone number
    const { error: deleteError } = await supabase
      .from('whatsapp_conversations')
      .delete()
      .eq('phone_number', phoneNumber);

    if (deleteError) {
      console.error('Error deleting conversations:', deleteError);
      throw deleteError;
    }

    // Also reset the whatsapp_user profile to start fresh
    const { error: resetError } = await supabase
      .from('whatsapp_users')
      .update({ 
        name: null,
        age: null,
        budget_preference: null,
        favorite_neighborhoods: null,
        interests: null,
        recommendation_count: 0
      })
      .eq('phone_number', phoneNumber);

    if (resetError) {
      console.error('Error resetting user profile:', resetError);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Conversation history cleared' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in clear-whatsapp-history:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
