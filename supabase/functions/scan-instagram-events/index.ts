import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InstagramPost {
  caption?: string;
  timestamp?: string;
  imageUrl?: string;
}

interface ExtractedEvent {
  title: string;
  date?: string;
  time?: string;
  location?: string;
  description?: string;
  price?: string;
  external_link?: string;
  image_url?: string;
  music_type?: string;
  venue_name?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apifyApiKey = Deno.env.get('APIFY_API_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting Instagram event scan...');

    // Get all active Instagram pages to scan
    const { data: trackedPages, error: pagesError } = await supabase
      .from('tracked_instagram_pages')
      .select('*')
      .eq('is_active', true);

    if (pagesError) throw pagesError;

    console.log(`Found ${trackedPages?.length || 0} Instagram pages to scan`);

    let totalEventsAdded = 0;

    for (const page of trackedPages || []) {
      try {
        console.log(`Scanning @${page.instagram_handle}...`);

        // Call Apify to scrape Instagram profile posts
        const apifyResponse = await fetch(`https://api.apify.com/v2/acts/apify~instagram-profile-scraper/runs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apifyApiKey}`,
          },
          body: JSON.stringify({
            usernames: [page.instagram_handle],
            resultsLimit: 10, // Get last 10 posts
            addParentData: false,
          }),
        });

        if (!apifyResponse.ok) {
          console.error(`Apify error for @${page.instagram_handle}:`, await apifyResponse.text());
          continue;
        }

        const apifyRun = await apifyResponse.json();
        const runId = apifyRun.data.id;

        // Wait for the scraping to complete (with timeout)
        let attempts = 0;
        let runData;
        
        while (attempts < 30) { // 30 attempts * 2 sec = 1 min timeout
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const statusResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
            headers: { 'Authorization': `Bearer ${apifyApiKey}` },
          });
          
          runData = await statusResponse.json();
          
          if (runData.data.status === 'SUCCEEDED') break;
          if (runData.data.status === 'FAILED') {
            console.error(`Apify run failed for @${page.instagram_handle}`);
            break;
          }
          
          attempts++;
        }

        if (runData?.data?.status !== 'SUCCEEDED') {
          console.error(`Timeout or failure for @${page.instagram_handle}`);
          continue;
        }

        // Get the dataset results
        const datasetId = runData.data.defaultDatasetId;
        const datasetResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items`, {
          headers: { 'Authorization': `Bearer ${apifyApiKey}` },
        });

        const posts: InstagramPost[] = await datasetResponse.json();
        console.log(`Retrieved ${posts.length} posts from @${page.instagram_handle}`);
        
        // Log what we actually got from Apify
        if (posts.length > 0) {
          console.log(`Sample post data:`, JSON.stringify(posts[0]).substring(0, 500));
        } else {
          console.log(`No posts returned from Apify for @${page.instagram_handle}`);
        }

        // Use Lovable AI to analyze posts and extract event info
        for (const post of posts) {
          if (!post.caption) {
            console.log(`Skipping post from @${page.instagram_handle} - no caption`);
            continue;
          }
          
          console.log(`Analyzing post from @${page.instagram_handle} with caption: "${post.caption.substring(0, 200)}..."`);


          try {
            const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${lovableApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'google/gemini-2.5-flash',
                messages: [
                  {
                    role: 'system',
                    content: `You are an expert at extracting FUTURE event information from Instagram posts. 
CRITICAL: Only extract events that are UPCOMING/FUTURE events, not past events or general announcements.

Analyze the caption and determine if it's advertising a FUTURE event. If yes, extract:
- title (event name)
- date (MUST be in YYYY-MM-DD format. If only day/month is given, infer the year. Today is ${new Date().toISOString().split('T')[0]})
- time (in HH:MM 24-hour format if possible, or original text like "10 PM")
- location (specific location or address if mentioned)
- venue_name (venue name if mentioned)
- description (brief 1-2 sentence summary of the event)
- price (if mentioned, e.g., "Free", "$20", "5000 ARS")
- music_type (genre if mentioned, e.g., "House", "Techno", "Live Music")

Return ONLY valid JSON with these fields, or return {"is_event": false} if:
- It's not an event post
- It's a past event
- It's just a general announcement or photo

Be strict: only return events with clear future dates.`,
                  },
                  {
                    role: 'user',
                    content: `Caption: ${post.caption}\nPost Timestamp: ${post.timestamp || 'Unknown'}`,
                  },
                ],
              }),
            });

            const aiData = await aiResponse.json();
            const content = aiData.choices?.[0]?.message?.content;

            if (!content) {
              console.log(`No AI response content for post from @${page.instagram_handle}`);
              continue;
            }

            console.log(`AI response for @${page.instagram_handle}:`, content);

            let eventData;
            try {
              eventData = JSON.parse(content);
            } catch (parseError) {
              console.error(`Failed to parse AI response as JSON:`, content);
              continue;
            }

            if (eventData.is_event === false || !eventData.title) {
              console.log(`Not an event post from @${page.instagram_handle} - AI determined: ${eventData.is_event === false ? 'not an event' : 'missing title'}`);
              continue;
            }

            // Skip if event date is in the past
            if (eventData.date) {
              const eventDate = new Date(eventData.date);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              
              if (eventDate < today) {
                console.log(`Event "${eventData.title}" is in the past (${eventData.date}), skipping`);
                continue;
              }
            }

            // Check if event already exists (by title + date)
            const { data: existingEvents } = await supabase
              .from('events')
              .select('id')
              .ilike('title', eventData.title)
              .limit(1);

            if (existingEvents && existingEvents.length > 0) {
              console.log(`Event "${eventData.title}" already exists, skipping`);
              continue;
            }

            // Insert new event
            const { error: insertError } = await supabase
              .from('events')
              .insert({
                title: eventData.title,
                description: eventData.description || post.caption?.substring(0, 500),
                date: eventData.date,
                time: eventData.time,
                location: eventData.location,
                venue_name: eventData.venue_name || page.page_name,
                price: eventData.price,
                music_type: eventData.music_type,
                external_link: `https://instagram.com/${page.instagram_handle}`,
                image_url: post.imageUrl,
                event_type: 'event',
                market: 'Buenos Aires', // Adjust based on your needs
              });

            if (insertError) {
              console.error(`Error inserting event:`, insertError);
            } else {
              console.log(`✅ Added event: "${eventData.title}" from @${page.instagram_handle}`);
              totalEventsAdded++;
            }

          } catch (aiError) {
            console.error(`AI analysis error:`, aiError);
          }
        }

        // Update last_scanned_at for this page
        await supabase
          .from('tracked_instagram_pages')
          .update({ last_scanned_at: new Date().toISOString() })
          .eq('id', page.id);

      } catch (pageError) {
        console.error(`Error scanning @${page.instagram_handle}:`, pageError);
      }
    }

    console.log(`✅ Instagram scan complete! Added ${totalEventsAdded} new events.`);

    return new Response(
      JSON.stringify({
        success: true,
        pagesScanned: trackedPages?.length || 0,
        eventsAdded: totalEventsAdded,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in Instagram scanner:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
