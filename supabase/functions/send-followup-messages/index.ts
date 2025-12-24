import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Detect if text is Spanish based on common Spanish words/patterns
function isSpanish(text: string): boolean {
  const spanishPatterns = [
    /\bhola\b/i,
    /\bpodrías\b/i,
    /\bpor favor\b/i,
    /\bgracias\b/i,
    /\bque hay\b/i,
    /\bdónde\b/i,
    /\bcómo\b/i,
    /\bevento[s]?\b/i,
    /\bbusco\b/i,
    /\bquiero\b/i,
    /\bme podrías\b/i,
    /\bestoy\b/i,
    /\bbuenos días\b/i,
    /\bbuenas\b/i,
  ];
  
  // Check for Spanish patterns
  for (const pattern of spanishPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  // If just "Hola" alone, it's Spanish
  if (text.trim().toLowerCase() === 'hola') {
    return true;
  }
  
  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { users } = await req.json();
    
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioWhatsappNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER');

    if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsappNumber) {
      throw new Error('Missing Twilio credentials');
    }

    const englishMessage = "Hey, looking for anything else in Buenos Aires? I'm here to connect you to the best events in the city 🎉";
    const spanishMessage = "Hola, ¿estás buscando algo más en Buenos Aires? Estoy acá para conectarte con los mejores eventos de la ciudad 🎉";

    const results = [];
    
    for (const user of users) {
      const { phone_number, first_message } = user;
      const useSpanish = isSpanish(first_message || '');
      const message = useSpanish ? spanishMessage : englishMessage;
      
      console.log(`Sending to ${phone_number} (${useSpanish ? 'Spanish' : 'English'}): ${message}`);
      
      try {
        const formData = new URLSearchParams();
        formData.append('From', twilioWhatsappNumber.startsWith('whatsapp:') ? twilioWhatsappNumber : `whatsapp:${twilioWhatsappNumber}`);
        formData.append('To', phone_number);
        formData.append('Body', message);

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
          }
        );

        const result = await response.json();
        
        if (response.ok) {
          console.log(`✅ Sent to ${phone_number}`);
          results.push({ phone_number, status: 'sent', language: useSpanish ? 'es' : 'en' });
        } else {
          console.error(`❌ Failed to send to ${phone_number}:`, result);
          results.push({ phone_number, status: 'failed', error: result.message });
        }
      } catch (error) {
        console.error(`❌ Error sending to ${phone_number}:`, error);
        results.push({ phone_number, status: 'error', error: error.message });
      }
      
      // Small delay between messages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const sent = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status !== 'sent').length;

    return new Response(
      JSON.stringify({ 
        success: true, 
        summary: { total: users.length, sent, failed },
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
