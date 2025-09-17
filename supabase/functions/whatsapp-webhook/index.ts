import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Twilio credentials
const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!
const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')!
const whatsappNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER')!

async function sendWhatsAppMessage(to: string, message: string) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  
  const body = new URLSearchParams({
    From: `whatsapp:${whatsappNumber}`,
    To: `whatsapp:${to}`,
    Body: message
  })

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString()
  })

  return response.json()
}

async function handleUserQuery(userMessage: string, userPhone: string) {
  console.log(`WhatsApp Bot - Received message from ${userPhone}: ${userMessage}`)

  try {
    // Get OpenAI API key
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error('❌ OpenAI API key not found');
      return "I'm having configuration issues. Please try again later.";
    }

    // Fetch comprehensive data from ALL relevant tables in parallel
    const [
      eventsData,
      communitiesData, 
      postsData,
      itemsData,
      neighborIdeasData,
      neighborQuestionsData,
      couponsData,
      storiesData
    ] = await Promise.all([
      supabase.from('events').select('id, title, description, location, date, time, price, mood, event_type').limit(8),
      supabase.from('communities').select('id, name, tagline, description, category, subcategory, member_count').limit(6),
      supabase.from('posts').select('id, content, location, created_at').limit(5),
      supabase.from('items').select('id, title, description, category, location, price').eq('status', 'active').limit(6),
      supabase.from('neighborhood_ideas').select('id, question, neighborhood, market').limit(4),
      supabase.from('neighbor_questions').select('id, content, market, message_type').limit(4),
      supabase.from('user_coupons').select('id, title, description, business_name, discount_amount, neighborhood').eq('is_active', true).limit(4),
      supabase.from('stories').select('id, text_content, story_type').gt('expires_at', 'now()').limit(3)
    ]);

    console.log('📊 WhatsApp Bot - Data fetched successfully');

    // Prepare comprehensive context with REAL data
    const realData = {
      currentEvents: eventsData.data || [],
      activeCommunities: communitiesData.data || [],
      recentPosts: postsData.data || [],
      marketplaceItems: itemsData.data || [],
      neighborhoodIdeas: neighborIdeasData.data || [],
      neighborQuestions: neighborQuestionsData.data || [],
      localCoupons: couponsData.data || [],
      activeStories: storiesData.data || [],
      userLocation: 'WhatsApp User'
    };

    // Create detailed system prompt with ALL real data for WhatsApp
    const systemPrompt = `You are the AI assistant for TheUnaHub (theunahub.com), a vibrant neighborhood social platform. You're responding via WhatsApp to user ${userPhone}. You have access to REAL, current data and should provide specific, helpful responses based on actual content.

🎯 REAL CURRENT DATA AVAILABLE:

📅 EVENTS (${realData.currentEvents.length} active):
${realData.currentEvents.map(e => `- "${e.title}" at ${e.location} on ${e.date} ${e.time ? 'at ' + e.time : ''} ${e.price ? '($' + e.price + ')' : ''} - ${e.description?.substring(0, 100)}...`).join('\n')}

👥 COMMUNITIES (${realData.activeCommunities.length} active):
${realData.activeCommunities.map(c => `- "${c.name}" (${c.member_count} members) - ${c.category} - ${c.tagline || c.description?.substring(0, 80)}`).join('\n')}

🏪 MARKETPLACE (${realData.marketplaceItems.length} items):
${realData.marketplaceItems.map(i => `- "${i.title}" in ${i.category} at ${i.location} for $${i.price} - ${i.description?.substring(0, 60)}...`).join('\n')}

💡 NEIGHBORHOOD IDEAS (${realData.neighborhoodIdeas.length} recent):
${realData.neighborhoodIdeas.map(n => `- "${n.question}" in ${n.neighborhood}`).join('\n')}

❓ NEIGHBOR QUESTIONS (${realData.neighborQuestions.length} recent):
${realData.neighborQuestions.map(q => `- ${q.content?.substring(0, 80)}...`).join('\n')}

🎫 LOCAL DEALS (${realData.localCoupons.length} active):
${realData.localCoupons.map(c => `- ${c.discount_amount} off at ${c.business_name} - ${c.title}`).join('\n')}

🤖 WHATSAPP INSTRUCTIONS:
1. ALWAYS mention specific events, communities, or items from the real data when relevant
2. Reference actual names, locations, dates, and prices from the database
3. Be conversational and helpful, like a local neighborhood expert
4. Keep responses under 200 words but packed with specific information
5. Use WhatsApp formatting (*bold*, _italic_) when appropriate
6. If asked about events, mention specific ones by name and details
7. If asked about communities, reference actual community names and member counts
8. For marketplace questions, mention real items and prices
9. Always sound knowledgeable about the current neighborhood activity
10. Format responses nicely for WhatsApp with emojis and proper spacing`;

    console.log('🤖 WhatsApp Bot - Calling OpenAI with comprehensive data context...');

    // Make OpenAI API call with comprehensive context
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 200,
        temperature: 0.7
      })
    });

    console.log('📡 WhatsApp Bot - OpenAI response status:', response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ WhatsApp Bot - OpenAI API error:', response.status, errorData);
      return "I'm having trouble connecting to my AI service. Please try again in a moment.";
    }

    const data = await response.json();
    console.log('✅ WhatsApp Bot - Got OpenAI response successfully');
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('❌ WhatsApp Bot - Invalid response format');
      return "Sorry, I'm having trouble processing your request. Please try again.";
    }
    
    const aiResponse = data.choices[0].message.content;
    console.log('🎉 WhatsApp Bot - Success! Returning AI response with comprehensive real data');

    return aiResponse;

  } catch (error) {
    console.error('💥 WhatsApp Bot - Error in handleUserQuery:', error);
    
    let errorMessage = "Sorry, I'm having technical difficulties. Please try again.";
    
    if (error.message.includes('API key')) {
      errorMessage = "I'm having API configuration issues. Please contact support.";
    } else if (error.message.includes('timeout')) {
      errorMessage = "The request timed out. Please try a shorter question.";
    }
    
    return errorMessage;
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const formData = await req.formData()
    
    // Extract Twilio webhook data
    const from = formData.get('From')?.toString() || ''
    const body = formData.get('Body')?.toString() || ''
    const messageSid = formData.get('MessageSid')?.toString() || ''
    
    // Extract phone number (remove whatsapp: prefix)
    const userPhone = from.replace('whatsapp:', '')
    
    console.log(`Webhook received - From: ${userPhone}, Body: ${body}, MessageSid: ${messageSid}`)

    if (!body || !userPhone) {
      console.log('Missing required fields')
      return new Response('Missing required fields', { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    // Process the user's message and get response
    const responseMessage = await handleUserQuery(body, userPhone)
    
    // Send response back to user
    const twilioResponse = await sendWhatsAppMessage(userPhone, responseMessage)
    console.log('Twilio response:', twilioResponse)

    // Log the interaction to database (optional)
    const { error: logError } = await supabase
      .from('user_messages')
      .insert({
        user_id: null, // We don't have user_id from WhatsApp
        message: `WhatsApp - From: ${userPhone} - Message: ${body} - Response: ${responseMessage}`
      })

    if (logError) {
      console.error('Error logging message:', logError)
    }

    return new Response('Message processed successfully', {
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    })

  } catch (error) {
    console.error('Error processing WhatsApp webhook:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})