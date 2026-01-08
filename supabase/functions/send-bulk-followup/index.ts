import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MESSAGES = {
  en: "Hey! Looking for plans for tonight or the coming days? Here to help with any of those 😊",
  es: "¡Hola! ¿Buscas planes para esta noche o los próximos días? Estoy acá para ayudarte 😊",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { targetDate, dryRun = false } = await req.json();
    
    if (!targetDate) {
      return new Response(
        JSON.stringify({ error: 'targetDate is required (format: YYYY-MM-DD)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all users who signed up on target date
    const startDate = `${targetDate}T00:00:00+00:00`;
    const endDate = `${targetDate}T23:59:59+00:00`;

    const { data: users, error: usersError } = await supabase
      .from('whatsapp_users')
      .select('phone_number, preferred_language, name')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No users found for target date', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${users.length} users from ${targetDate}`);

    if (dryRun) {
      const summary = users.map(u => ({
        phone: u.phone_number,
        language: u.preferred_language || 'en',
        message: MESSAGES[u.preferred_language as keyof typeof MESSAGES] || MESSAGES.en
      }));
      
      return new Response(
        JSON.stringify({ 
          dryRun: true, 
          count: users.length,
          users: summary
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send messages
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioWhatsappNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER');
    
    if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsappNumber) {
      throw new Error('Twilio credentials not configured');
    }

    const formattedFrom = twilioWhatsappNumber.startsWith('whatsapp:') 
      ? twilioWhatsappNumber 
      : `whatsapp:${twilioWhatsappNumber}`;

    const results = {
      success: [] as string[],
      failed: [] as { phone: string; error: string }[],
    };

    for (const user of users) {
      const language = user.preferred_language || 'en';
      const message = MESSAGES[language as keyof typeof MESSAGES] || MESSAGES.en;
      const formattedTo = user.phone_number.startsWith('whatsapp:') 
        ? user.phone_number 
        : `whatsapp:${user.phone_number}`;

      try {
        console.log(`Sending to ${formattedTo} in ${language}...`);

        const formData = new URLSearchParams();
        formData.append('From', formattedFrom);
        formData.append('To', formattedTo);
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
        
        if (!response.ok) {
          console.error(`Failed for ${formattedTo}:`, result);
          results.failed.push({ phone: user.phone_number, error: result.message || 'Unknown error' });
        } else {
          console.log(`✅ Sent to ${formattedTo}`);
          results.success.push(user.phone_number);

          // Store in conversation history
          await supabase.from('whatsapp_conversations').insert({
            phone_number: formattedTo,
            role: 'assistant',
            content: message,
          });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`Error sending to ${user.phone_number}:`, error);
        results.failed.push({ phone: user.phone_number, error: error.message });
      }
    }

    return new Response(
      JSON.stringify({ 
        total: users.length,
        sent: results.success.length,
        failed: results.failed.length,
        failedDetails: results.failed
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
