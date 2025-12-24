import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// English and Spanish follow-up messages
const FOLLOWUP_EN = "Hey, looking for anything else in Buenos Aires? I'm here to connect you to the best events in the city 🎉";
const FOLLOWUP_ES = "Hola, ¿estás buscando algo más en Buenos Aires? Estoy acá para conectarte con los mejores eventos de la ciudad 🎉";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting 24-hour follow-up check...");
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioWhatsappNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER') || 'whatsapp:+17622513744';

    if (!twilioAccountSid || !twilioAuthToken) {
      throw new Error('Missing Twilio credentials');
    }

    // Find users who:
    // 1. Were created between 23.5 and 24.5 hours ago (1-hour window around 24h mark)
    // 2. Haven't received follow-up yet
    const now = new Date();
    const twentyThreeAndHalfHoursAgo = new Date(now.getTime() - (23.5 * 60 * 60 * 1000));
    const twentyFourAndHalfHoursAgo = new Date(now.getTime() - (24.5 * 60 * 60 * 1000));

    console.log(`Looking for users created between ${twentyFourAndHalfHoursAgo.toISOString()} and ${twentyThreeAndHalfHoursAgo.toISOString()}`);

    const { data: usersNeedingFollowup, error: fetchError } = await supabase
      .from('whatsapp_users')
      .select('id, phone_number, preferred_language, name, created_at')
      .gte('created_at', twentyFourAndHalfHoursAgo.toISOString())
      .lte('created_at', twentyThreeAndHalfHoursAgo.toISOString())
      .is('first_day_followup_sent_at', null)
      .limit(50); // Process in batches

    if (fetchError) {
      console.error("Error fetching users:", fetchError);
      throw fetchError;
    }

    if (!usersNeedingFollowup || usersNeedingFollowup.length === 0) {
      console.log("No users need 24-hour follow-up at this time");
      return new Response(
        JSON.stringify({ success: true, message: "No users need follow-up", count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${usersNeedingFollowup.length} users needing 24-hour follow-up`);

    const results = [];
    
    for (const user of usersNeedingFollowup) {
      const isSpanish = user.preferred_language === 'es';
      const message = isSpanish ? FOLLOWUP_ES : FOLLOWUP_EN;
      
      console.log(`Sending 24h follow-up to ${user.phone_number} (${isSpanish ? 'Spanish' : 'English'})`);
      
      try {
        // Send WhatsApp message via Twilio
        const formData = new URLSearchParams();
        formData.append('From', twilioWhatsappNumber.startsWith('whatsapp:') ? twilioWhatsappNumber : `whatsapp:${twilioWhatsappNumber}`);
        formData.append('To', user.phone_number);
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
          console.log(`✅ Sent 24h follow-up to ${user.phone_number}`);
          
          // Mark user as having received follow-up
          await supabase
            .from('whatsapp_users')
            .update({ first_day_followup_sent_at: new Date().toISOString() })
            .eq('id', user.id);

          // Store the message in conversation history
          await supabase.from('whatsapp_conversations').insert({
            phone_number: user.phone_number,
            role: 'assistant',
            content: message,
          });

          results.push({ 
            phone_number: user.phone_number, 
            status: 'sent', 
            language: isSpanish ? 'es' : 'en' 
          });
        } else {
          console.error(`❌ Failed to send to ${user.phone_number}:`, result);
          results.push({ 
            phone_number: user.phone_number, 
            status: 'failed', 
            error: result.message 
          });
        }
      } catch (error) {
        console.error(`❌ Error sending to ${user.phone_number}:`, error);
        results.push({ 
          phone_number: user.phone_number, 
          status: 'error', 
          error: error.message 
        });
      }
      
      // Small delay between messages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const sent = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status !== 'sent').length;

    console.log(`24h follow-up complete: ${sent} sent, ${failed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        summary: { total: usersNeedingFollowup.length, sent, failed },
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in 24h follow-up:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
