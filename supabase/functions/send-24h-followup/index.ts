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
    console.log("Starting 5 PM Buenos Aires follow-up check...");
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioWhatsappNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER') || 'whatsapp:+17622513744';

    if (!twilioAccountSid || !twilioAuthToken) {
      throw new Error('Missing Twilio credentials');
    }

    // Get current time in Buenos Aires (UTC-3)
    const now = new Date();
    const buenosAiresOffset = -3 * 60; // UTC-3 in minutes
    const buenosAiresTime = new Date(now.getTime() + (buenosAiresOffset + now.getTimezoneOffset()) * 60 * 1000);
    
    console.log(`Current Buenos Aires time: ${buenosAiresTime.toISOString()}`);
    
    // Calculate "yesterday" in Buenos Aires time
    // We want users who first messaged BEFORE today (Buenos Aires time) and haven't received follow-up
    const todayStartBA = new Date(buenosAiresTime);
    todayStartBA.setHours(0, 0, 0, 0);
    
    // Convert back to UTC for database query
    const todayStartUTC = new Date(todayStartBA.getTime() - (buenosAiresOffset + now.getTimezoneOffset()) * 60 * 1000);
    
    console.log(`Looking for users who first messaged before ${todayStartUTC.toISOString()} (midnight BA time)`);

    // Find users who:
    // 1. Were created before today (Buenos Aires time) - meaning they messaged yesterday or earlier
    // 2. Haven't received follow-up yet
    // 3. Were created within the last 7 days (don't send to very old users who never got follow-up)
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

    const { data: usersNeedingFollowup, error: fetchError } = await supabase
      .from('whatsapp_users')
      .select('id, phone_number, preferred_language, name, created_at')
      .lt('created_at', todayStartUTC.toISOString())
      .gte('created_at', sevenDaysAgo.toISOString())
      .is('first_day_followup_sent_at', null)
      .limit(50); // Process in batches

    if (fetchError) {
      console.error("Error fetching users:", fetchError);
      throw fetchError;
    }

    if (!usersNeedingFollowup || usersNeedingFollowup.length === 0) {
      console.log("No users need follow-up at this time");
      return new Response(
        JSON.stringify({ success: true, message: "No users need follow-up", count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${usersNeedingFollowup.length} users needing 5 PM follow-up`);

    const results = [];
    
    for (const user of usersNeedingFollowup) {
      const isSpanish = user.preferred_language === 'es';
      const message = isSpanish ? FOLLOWUP_ES : FOLLOWUP_EN;
      
      console.log(`Sending 5 PM follow-up to ${user.phone_number} (${isSpanish ? 'Spanish' : 'English'}) - first msg: ${user.created_at}`);
      
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
          console.log(`✅ Sent 5 PM follow-up to ${user.phone_number}`);
          
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
            language: isSpanish ? 'es' : 'en',
            first_msg: user.created_at
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

    console.log(`5 PM follow-up complete: ${sent} sent, ${failed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        summary: { total: usersNeedingFollowup.length, sent, failed },
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in 5 PM follow-up:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
