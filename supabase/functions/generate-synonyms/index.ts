import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "", 
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openAIApiKey) {
      throw new Error("OpenAI API key not configured");
    }

    // Fetch all current events
    const { data: events, error } = await supabase
      .from("events")
      .select("title, description, music_type, mood")
      .gte("date", new Date().toISOString().split('T')[0])
      .limit(200);

    if (error) throw error;

    // Extract all text content
    const textContent = events?.map(e => 
      [e.title, e.description, e.music_type, e.mood].filter(Boolean).join(" ")
    ).join("\n") || "";

    console.log(`Analyzing ${events?.length || 0} events`);

    // Use AI to extract bilingual keyword pairs
    const prompt = `Analyze this text from events in Buenos Aires, Argentina. Extract bilingual keyword pairs (English/Spanish) that are commonly used together. Return ONLY a JSON object where keys are English words and values are arrays of Spanish equivalents found in the text.

Example format:
{
  "wine": ["vino", "vinito"],
  "coffee": ["café", "cafecito"],
  "music": ["música"]
}

Text to analyze:
${textContent.substring(0, 8000)}`;

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a bilingual keyword extraction expert. Return only valid JSON." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`OpenAI error: ${await aiResponse.text()}`);
    }

    const aiData = await aiResponse.json();
    const synonymText = aiData.choices[0].message.content.trim();
    
    // Extract JSON from potential markdown code blocks
    const jsonMatch = synonymText.match(/\{[\s\S]*\}/);
    const synonyms = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    console.log(`Generated ${Object.keys(synonyms).length} synonym pairs`);

    return new Response(JSON.stringify({ synonyms }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      synonyms: {} // Return empty map on error
    }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
