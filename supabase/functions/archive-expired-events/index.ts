import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🗄️ Starting archive of expired events...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current date and time
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Calculate 4 hours ago for ongoing event buffer
    const fourHoursAgo = new Date(now.getTime() - (4 * 60 * 60 * 1000));
    const bufferDate = fourHoursAgo.toISOString().split('T')[0];
    
    console.log('Today:', today);
    console.log('Buffer date (4h grace):', bufferDate);

    // Fetch events that are expired (date before today, accounting for 4-hour buffer)
    // Events with date < bufferDate are definitely expired
    const { data: expiredEvents, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .lt('date', bufferDate);

    if (fetchError) {
      console.error('❌ Error fetching expired events:', fetchError);
      throw fetchError;
    }

    if (!expiredEvents || expiredEvents.length === 0) {
      console.log('✅ No expired events to archive');
      return new Response(
        JSON.stringify({ 
          success: true, 
          archivedCount: 0,
          message: 'No expired events to archive'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    console.log(`📦 Found ${expiredEvents.length} expired events to archive`);

    // Prepare events for archiving (map to expired_events schema)
    const eventsToArchive = expiredEvents.map(event => ({
      original_event_id: event.id,
      user_id: event.user_id,
      title: event.title,
      description: event.description,
      date: event.date,
      time: event.time,
      location: event.location,
      price: event.price,
      image_url: event.image_url,
      video_url: event.video_url,
      external_link: event.external_link,
      event_type: event.event_type,
      mood: event.mood,
      market: event.market,
      target_audience: event.target_audience,
      music_type: event.music_type,
      venue_size: event.venue_size,
      price_range: event.price_range,
      venue_name: event.venue_name,
      address: event.address,
      ticket_link: event.ticket_link,
      original_created_at: event.created_at,
      original_updated_at: event.updated_at,
    }));

    // Insert into expired_events table
    const { error: insertError } = await supabase
      .from('expired_events')
      .insert(eventsToArchive);

    if (insertError) {
      console.error('❌ Error inserting into expired_events:', insertError);
      throw insertError;
    }

    console.log(`✅ Archived ${eventsToArchive.length} events`);

    // Delete the original events
    const expiredIds = expiredEvents.map(e => e.id);
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .in('id', expiredIds);

    if (deleteError) {
      console.error('❌ Error deleting original events:', deleteError);
      throw deleteError;
    }

    console.log(`🗑️ Deleted ${expiredIds.length} events from main table`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        archivedCount: eventsToArchive.length,
        message: `Archived ${eventsToArchive.length} expired events`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('💥 Error in archive-expired-events:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
