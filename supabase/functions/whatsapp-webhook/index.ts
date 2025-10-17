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

async function handleUserQuery(userMessage: string, userPhone: string) {
  console.log(`📱 Interakt WhatsApp - Received message from ${userPhone}: ${userMessage}`)

  try {
    // Get OpenAI API key
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error('❌ OpenAI API key not found');
      return "I'm having configuration issues. Please try again later.";
    }

    // Fetch comprehensive data from ALL relevant tables in parallel (same as AI assistant)
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
      supabase.from('user_coupons').select('id, title, description, business_name, discount_amount, neighborhood').limit(4),
      supabase.from('stories').select('id, text_content, story_type').gt('expires_at', 'now()').limit(3)
    ]);

    console.log('📊 Data fetched successfully for WhatsApp');

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

    // Create detailed system prompt (same style as AI assistant)
    const systemPrompt = `You are Yara AI, the friendly AI assistant for TheUnaHub (theunahub.com) neighborhood platform. You're responding via WhatsApp. You're warm, conversational, and genuinely helpful.

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
7. Always sound knowledgeable about the current neighborhood activity`;

    console.log('🤖 Calling OpenAI with comprehensive data context...');

    // Make OpenAI API call
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
        temperature: 0.8
      })
    });

    console.log('📡 OpenAI response status:', response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ OpenAI API error:', response.status, errorData);
      return "I'm having trouble connecting to my AI service. Please try again in a moment.";
    }

    const data = await response.json();
    console.log('✅ Got OpenAI response successfully');
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('❌ Invalid response format');
      return "Sorry, I'm having trouble processing your request. Please try again.";
    }
    
    const aiResponse = data.choices[0].message.content;
    console.log('🎉 Success! Returning AI response');

    return aiResponse;

  } catch (error) {
    console.error('💥 Error in handleUserQuery:', error);
    return "Sorry, I'm having technical difficulties. Please try again.";
  }
}

serve(async (req) => {
  console.log('🌐 Interakt WhatsApp Webhook received');
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    console.log('📦 Interakt payload:', JSON.stringify(payload, null, 2))
    
    // Interakt sends messages in this format
    const messages = payload.messages || payload.data?.messages || []
    
    if (!messages || messages.length === 0) {
      console.log('⚠️ No messages in payload')
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get the first message
    const message = messages[0]
    const userPhone = message.from || message.waId || ''
    const messageText = message.text?.body || message.body || ''
    
    console.log(`📱 Processing - From: ${userPhone}, Message: ${messageText}`)

    if (!messageText || !userPhone) {
      console.log('⚠️ Missing required fields')
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Process the user's message and get AI response
    const responseMessage = await handleUserQuery(messageText, userPhone)
    
    // Send response back through Interakt API
    const interaktApiKey = Deno.env.get('INTERAKT_API_KEY')
    
    if (interaktApiKey) {
      console.log('📤 Sending response back through Interakt...')
      
      const interaktResponse = await fetch('https://api.interakt.ai/v1/public/message/', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${interaktApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          countryCode: '+54', // Argentina
          phoneNumber: userPhone.replace('+', ''),
          type: 'Text',
          template: {
            name: 'text_message',
            languageCode: 'en',
            bodyValues: [responseMessage]
          }
        })
      })
      
      console.log('📡 Interakt API response:', interaktResponse.status)
    } else {
      console.log('⚠️ INTERAKT_API_KEY not set, cannot send response back')
    }

    // Log the interaction to database
    const { error: logError } = await supabase
      .from('user_messages')
      .insert({
        user_id: null,
        message: `WhatsApp (Interakt) - From: ${userPhone} - Message: ${messageText} - Response: ${responseMessage}`
      })

    if (logError) {
      console.error('Error logging message:', logError)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('💥 Error processing Interakt webhook:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})