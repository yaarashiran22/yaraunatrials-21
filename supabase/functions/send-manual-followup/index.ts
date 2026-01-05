import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('send-manual-followup: Starting...');

  try {
    const body = await req.json();
    const { 
      targetDate, // e.g., '2026-01-04'
      messageEn = "Hey! Looking for anything fun to do tonight? 🎉",
      messageEs = "¡Hola! ¿Buscas algo divertido para hacer esta noche? 🎉",
      dryRun = false // Set to true to just see who would receive messages
    } = body;

    if (!targetDate) {
      return new Response(
        JSON.stringify({ error: 'targetDate is required (YYYY-MM-DD format)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get users who first texted on the target date
    const { data: users, error: usersError } = await supabase
      .from('whatsapp_users')
      .select('phone_number, preferred_language, name')
      .gte('created_at', `${targetDate}T00:00:00Z`)
      .lt('created_at', `${targetDate}T23:59:59Z`);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    console.log(`Found ${users?.length || 0} users from ${targetDate}`);

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No users found for target date', users: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (dryRun) {
      console.log('DRY RUN - Not sending messages');
      return new Response(
        JSON.stringify({ 
          success: true, 
          dryRun: true,
          message: `Would send to ${users.length} users`,
          users: users.map(u => ({
            phone: u.phone_number,
            language: u.preferred_language || 'en',
            message: (u.preferred_language === 'es') ? messageEs : messageEn
          }))
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send messages via Twilio
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioWhatsappNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER');

    if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsappNumber) {
      throw new Error('Missing Twilio credentials');
    }

    const results = [];

    for (const user of users) {
      const language = user.preferred_language || 'en';
      const message = language === 'es' ? messageEs : messageEn;
      const phoneNumber = user.phone_number;

      console.log(`Sending to ${phoneNumber} (${language}): ${message}`);

      try {
        const formData = new URLSearchParams();
        formData.append('From', twilioWhatsappNumber.startsWith('whatsapp:') ? twilioWhatsappNumber : `whatsapp:${twilioWhatsappNumber}`);
        formData.append('To', phoneNumber);
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
          console.log(`✅ Sent to ${phoneNumber}`);
          
          // Log the message to whatsapp_conversations
          await supabase.from('whatsapp_conversations').insert({
            phone_number: phoneNumber,
            role: 'assistant',
            content: message
          });
          
          results.push({ phone: phoneNumber, status: 'sent', language });
        } else {
          console.error(`❌ Failed to send to ${phoneNumber}:`, result);
          results.push({ phone: phoneNumber, status: 'failed', error: result.message });
        }
      } catch (error) {
        console.error(`❌ Error sending to ${phoneNumber}:`, error);
        results.push({ phone: phoneNumber, status: 'error', error: error.message });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const sent = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status !== 'sent').length;

    console.log(`Summary: ${sent} sent, ${failed} failed out of ${users.length} total`);

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
