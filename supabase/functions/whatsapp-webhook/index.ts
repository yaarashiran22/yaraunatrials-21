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
  const message = userMessage.toLowerCase().trim()
  
  console.log(`Received message from ${userPhone}: ${userMessage}`)

  // Handle different types of queries
  if (message.includes('events') || message.includes('event')) {
    // Get upcoming events
    const { data: events, error } = await supabase
      .from('events')
      .select('title, description, date, time, location')
      .limit(3)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching events:', error)
      return "Sorry, I couldn't fetch events right now. Please try again later."
    }

    if (!events || events.length === 0) {
      return "No upcoming events found. Stay tuned for new events!"
    }

    let response = "🎉 *Upcoming Events:*\n\n"
    events.forEach((event, index) => {
      response += `${index + 1}. *${event.title}*\n`
      if (event.description) response += `   ${event.description}\n`
      if (event.date) response += `   📅 ${event.date}`
      if (event.time) response += ` at ${event.time}`
      if (event.location) response += `\n   📍 ${event.location}`
      response += "\n\n"
    })

    return response

  } else if (message.includes('recommendations') || message.includes('recommend')) {
    // Get recommendations
    const { data: recommendations, error } = await supabase
      .from('recommendations')
      .select('title, description, category, location')
      .eq('status', 'active')
      .limit(3)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching recommendations:', error)
      return "Sorry, I couldn't fetch recommendations right now. Please try again later."
    }

    if (!recommendations || recommendations.length === 0) {
      return "No recommendations available at the moment. Check back later!"
    }

    let response = "⭐ *Latest Recommendations:*\n\n"
    recommendations.forEach((rec, index) => {
      response += `${index + 1}. *${rec.title}*\n`
      if (rec.description) response += `   ${rec.description}\n`
      if (rec.category) response += `   🏷️ ${rec.category}`
      if (rec.location) response += `\n   📍 ${rec.location}`
      response += "\n\n"
    })

    return response

  } else if (message.includes('community') || message.includes('communities')) {
    // Get communities
    const { data: communities, error } = await supabase
      .from('communities')
      .select('name, description, category, member_count')
      .eq('is_active', true)
      .limit(3)
      .order('member_count', { ascending: false })

    if (error) {
      console.error('Error fetching communities:', error)
      return "Sorry, I couldn't fetch communities right now. Please try again later."
    }

    if (!communities || communities.length === 0) {
      return "No active communities found. Be the first to create one!"
    }

    let response = "🏘️ *Active Communities:*\n\n"
    communities.forEach((community, index) => {
      response += `${index + 1}. *${community.name}*\n`
      if (community.description) response += `   ${community.description}\n`
      if (community.category) response += `   🏷️ ${community.category}\n`
      response += `   👥 ${community.member_count || 0} members\n\n`
    })

    return response

  } else if (message.includes('marketplace') || message.includes('items') || message.includes('buy') || message.includes('sell')) {
    // Get marketplace items
    const { data: items, error } = await supabase
      .from('items')
      .select('title, description, price, category, location')
      .eq('status', 'active')
      .limit(3)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching items:', error)
      return "Sorry, I couldn't fetch marketplace items right now. Please try again later."
    }

    if (!items || items.length === 0) {
      return "No items available in the marketplace right now. Check back later!"
    }

    let response = "🛍️ *Marketplace Items:*\n\n"
    items.forEach((item, index) => {
      response += `${index + 1}. *${item.title}*\n`
      if (item.description) response += `   ${item.description}\n`
      if (item.price) response += `   💰 $${item.price}\n`
      if (item.category) response += `   🏷️ ${item.category}`
      if (item.location) response += `\n   📍 ${item.location}`
      response += "\n\n"
    })

    return response

  } else if (message.includes('help') || message === 'hi' || message === 'hello' || message === 'start') {
    return `👋 *Welcome to our Community Bot!*

I can help you with:
• *Events* - Get upcoming events
• *Recommendations* - Latest recommendations  
• *Communities* - Active communities
• *Marketplace* - Items for sale/wanted
• *Help* - Show this menu

Just type what you're looking for! For example:
- "Show me events"
- "Any recommendations?"
- "What communities are active?"
- "What's in the marketplace?"`

  } else {
    return `🤔 I didn't understand that. Type *help* to see what I can do for you!

You can ask me about:
• Events
• Recommendations
• Communities  
• Marketplace
• Help`
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