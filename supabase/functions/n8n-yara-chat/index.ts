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
    const { messages, userProfile, phoneNumber } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`n8n-yara-chat: Processing ${messages.length} messages`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Call the existing yara-ai-chat function with stream=false for JSON responses
    const { data, error } = await supabase.functions.invoke("yara-ai-chat", {
      body: {
        messages,
        stream: false, // Get JSON responses for n8n
        userProfile,
        phoneNumber,
        useIntroModel: false,
      },
    });

    if (error) {
      console.error("Error calling yara-ai-chat:", error);
      throw new Error(`Failed to get response from Yara: ${error.message}`);
    }

    console.log("Successfully got response from yara-ai-chat");

    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error in n8n-yara-chat:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
