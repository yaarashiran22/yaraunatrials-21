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
  console.log(`📱 MessageBird WhatsApp - Received message from ${userPhone}: ${userMessage}`)

  try {
    // Get OpenAI API key
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error('❌ OpenAI API key not found');
      return "I'm having configuration issues. Please try again later.";
    }

    // Check if we should reset the conversation (if last message was more than 2 hours ago)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: recentMessages } = await supabase
      .from('whatsapp_conversations')
      .select('created_at')
      .eq('phone_number', userPhone)
      .gt('created_at', twoHoursAgo)
      .order('created_at', { ascending: false })
      .limit(1);

    const isNewConversation = !recentMessages || recentMessages.length === 0;
    const isGreeting = userMessage.toLowerCase().trim() === 'hey';
    
    // If it's a new conversation or just "hey" after 2h+ silence, start fresh
    if ((isNewConversation || isGreeting) && isGreeting) {
      await supabase.from('whatsapp_conversations').insert({
        phone_number: userPhone,
        role: 'user',
        content: userMessage
      });
      
      const welcomeMessage = "Hey welcome to yara ai - if you're looking for indie events, hidden deals and bohemian spots in Buenos Aires- I'm here. What are you looking for?";
      
      await supabase.from('whatsapp_conversations').insert({
        phone_number: userPhone,
        role: 'assistant',
        content: welcomeMessage
      });
      
      return welcomeMessage;
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
      storiesData,
      businessProfilesData
    ] = await Promise.all([
      supabase.from('events').select('id, title, description, location, date, time, price, mood, event_type').limit(8),
      supabase.from('communities').select('id, name, tagline, description, category, subcategory, member_count').limit(6),
      supabase.from('posts').select('id, content, location, created_at').limit(5),
      supabase.from('items').select('id, title, description, category, location, price').eq('status', 'active').limit(6),
      supabase.from('neighborhood_ideas').select('id, question, neighborhood, market').limit(4),
      supabase.from('neighbor_questions').select('id, content, market, message_type').limit(4),
      supabase.from('user_coupons').select('id, title, description, business_name, discount_amount, neighborhood, coupon_code').limit(8),
      supabase.from('stories').select('id, text_content, story_type').gt('expires_at', 'now()').limit(3),
      supabase.from('profiles').select('id, name, bio, location, age, interests, specialties, whatsapp_number').eq('profile_type', 'business').limit(10)
    ]);

    console.log('📊 Data fetched successfully for WhatsApp - Businesses:', businessProfilesData.data?.length);

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
      businessProfiles: businessProfilesData.data || [],
      userLocation: 'WhatsApp User'
    };

    // Create detailed system prompt (same style as AI assistant)
    const systemPrompt = `You are Yara ai's assistant via WhatsApp. Keep it real, direct, and chill - like texting your artsy friend who knows Buenos Aires' indie scene.

🎯 REAL DATA:

📅 EVENTS (${realData.currentEvents.length}):
${realData.currentEvents.map(e => `- "${e.title}" at ${e.location} on ${e.date} ${e.time ? 'at ' + e.time : ''} ${e.price ? '($' + e.price + ')' : ''} - ${e.description?.substring(0, 100)}...`).join('\n')}

🏢 BUSINESSES (${realData.businessProfiles.length}):
${realData.businessProfiles.map(b => `- "${b.name}"${b.age ? ` (ages ${b.age}+)` : ''} in ${b.location || 'location'} - ${b.bio?.substring(0, 100)}...${b.specialties?.length > 0 ? ' - Vibe: ' + b.specialties.join(', ') : ''}${b.whatsapp_number ? ' - WhatsApp: ' + b.whatsapp_number : ''}`).join('\n')}

👥 COMMUNITIES (${realData.activeCommunities.length}):
${realData.activeCommunities.map(c => `- "${c.name}" (${c.member_count} members) - ${c.category} - ${c.tagline || c.description?.substring(0, 80)}`).join('\n')}

🏪 MARKETPLACE (${realData.marketplaceItems.length}):
${realData.marketplaceItems.map(i => `- "${i.title}" in ${i.category} at ${i.location} for $${i.price} - ${i.description?.substring(0, 60)}...`).join('\n')}

💡 IDEAS (${realData.neighborhoodIdeas.length}):
${realData.neighborhoodIdeas.map(n => `- "${n.question}" in ${n.neighborhood}`).join('\n')}

❓ QUESTIONS (${realData.neighborQuestions.length}):
${realData.neighborQuestions.map(q => `- ${q.content?.substring(0, 80)}...`).join('\n')}

🎫 DEALS (${realData.localCoupons.length}):
${realData.localCoupons.map(c => `- "${c.title}" at ${c.business_name} - ${c.discount_amount}% OFF${c.coupon_code ? ` - Code: ${c.coupon_code}` : ''}`).join('\n')}

🤖 WHATSAPP VIBE:
1. BE SUPER DIRECT - max 1-2 sentences, no fluff
2. Cut to the chase - give specific recommendations immediately
3. Use casual language but stay focused
4. ONLY recommend real things from the data above
5. For places to go: suggest BOTH events AND businesses that fit
6. Include WhatsApp numbers when sharing businesses
7. Drop coupon codes naturally when relevant
8. If nothing matches: "nothing rn that fits"
9. Sound authentic and indie, but keep it brief
10. Minimal formatting - just the facts

🌐 LANGUAGE & TRANSLATION:
**CRITICAL**: Detect the language of the user's message and respond in that language.
- If user writes in English: Translate ALL event/business descriptions from Spanish to English
- If user writes in Spanish: Translate ALL event/business descriptions from English to Spanish
- Users should NEVER receive descriptions in a different language than they're speaking
- Keep translations natural and conversational`;


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
        max_tokens: 60,
        temperature: 0.7
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
  console.log('🌐 MessageBird WhatsApp Webhook received');
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    console.log('📦 MessageBird payload:', JSON.stringify(payload, null, 2))
    
    // MessageBird Conversations API sends messages in this format
    const userPhone = payload.message?.from || payload.contact?.id || ''
    const messageText = payload.message?.content?.text || payload.message?.text || ''
    
    console.log(`📱 Processing - From: ${userPhone}, Message: ${messageText}`)

    if (!messageText || !userPhone) {
      console.log('⚠️ Missing required fields')
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Process the user's message and get AI response
    const responseMessage = await handleUserQuery(messageText, userPhone)
    
    // Log the conversation
    await supabase.from('whatsapp_conversations').insert([
      {
        phone_number: userPhone,
        role: 'user',
        content: messageText
      },
      {
        phone_number: userPhone,
        role: 'assistant',
        content: responseMessage
      }
    ])
    
    // Also log to user_messages for backwards compatibility
    const { error: logError } = await supabase
      .from('user_messages')
      .insert({
        user_id: null,
        message: `WhatsApp (MessageBird) - From: ${userPhone} - Message: ${messageText} - Response: ${responseMessage}`
      })

    if (logError) {
      console.error('Error logging message:', logError)
    }

    console.log('✅ Processing complete, MessageBird will auto-respond')
    
    // MessageBird expects JSON acknowledgment
    // Note: To auto-reply, you'll need to configure MessageBird Flow or use their API separately
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Received'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('💥 Error processing MessageBird webhook:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})