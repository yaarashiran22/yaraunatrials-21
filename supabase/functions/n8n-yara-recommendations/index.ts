import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, userProfile = null } = await req.json();
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: 'query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`n8n-yara-recommendations: Processing query: "${query}"`);
    
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("Lovable API key not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current date and day of week for filtering
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayDayName = daysOfWeek[now.getDay()];
    
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split("T")[0];
    const tomorrowDayName = daysOfWeek[tomorrow.getDay()];

    console.log(`Today: ${today} (${todayDayName}), Tomorrow: ${tomorrowDate} (${tomorrowDayName})`);

    // Helper function to format date
    const formatDate = (dateStr: string): string => {
      if (!dateStr || dateStr.toLowerCase().includes("every")) {
        return dateStr;
      }

      try {
        const date = new Date(dateStr + "T00:00:00");
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const day = date.getDate();
        const month = months[date.getMonth()];

        let suffix = "th";
        if (day === 1 || day === 21 || day === 31) suffix = "st";
        else if (day === 2 || day === 22) suffix = "nd";
        else if (day === 3 || day === 23) suffix = "rd";

        return `${month} ${day}${suffix}`;
      } catch (e) {
        return dateStr;
      }
    };

    // Fetch data from database
    const [eventsResult, itemsResult, couponsResult, topListsResult] = await Promise.all([
      supabase
        .from("events")
        .select("id, title, description, date, time, location, address, venue_name, price, mood, music_type, venue_size, external_link, image_url, target_audience")
        .order("date", { ascending: true })
        .limit(200),
      supabase
        .from("items")
        .select("id, title, description, category, location, price, image_url")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("user_coupons")
        .select("id, title, description, business_name, discount_amount, neighborhood, valid_until, image_url")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("top_lists")
        .select(`
          id,
          title,
          category,
          description,
          top_list_items (
            id,
            name,
            description,
            location,
            url,
            display_order
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    let allEvents = eventsResult.data || [];
    const businesses = itemsResult.data || [];
    const coupons = couponsResult.data || [];
    const topLists = topListsResult.data || [];

    // Helper function for recurring events
    const getNextOccurrence = (dayName: string, fromDate: Date = new Date()): string => {
      const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetDayIndex = daysOfWeek.indexOf(dayName.toLowerCase());
      
      if (targetDayIndex === -1) return fromDate.toISOString().split('T')[0];
      
      const currentDayIndex = fromDate.getDay();
      let daysUntilTarget = targetDayIndex - currentDayIndex;
      
      if (daysUntilTarget <= 0) {
        daysUntilTarget += 7;
      }
      
      const nextOccurrence = new Date(fromDate);
      nextOccurrence.setDate(fromDate.getDate() + daysUntilTarget);
      
      return nextOccurrence.toISOString().split('T')[0];
    };

    // Transform recurring events to next occurrence dates
    const eventsWithTransformedDates = allEvents.map(event => {
      let transformedDate = event.date;
      let originalDate = event.date;
      
      if (event.date?.toLowerCase().includes('every')) {
        const dayMatch = event.date.toLowerCase().match(/every\s+(\w+)/);
        if (dayMatch && dayMatch[1]) {
          const dayName = dayMatch[1];
          transformedDate = getNextOccurrence(dayName);
        }
      }
      
      return {
        ...event,
        date: transformedDate,
        originalDate: originalDate,
      };
    });

    // Filter events by date - only future events
    const filteredByDateEvents = eventsWithTransformedDates.filter(event => {
      const eventDate = event.date?.toLowerCase() || '';
      return eventDate >= today;
    });

    console.log(`Filtered events from ${allEvents.length} to ${filteredByDateEvents.length} based on date`);

    // Helper function to check age appropriateness
    const isAgeAppropriate = (targetAudience: string | null, userAge: number | null): boolean => {
      if (!targetAudience || !userAge) return true;
      
      if (targetAudience.includes('-')) {
        const [minAge, maxAge] = targetAudience.split('-').map(s => parseInt(s.trim()));
        return userAge >= minAge && userAge <= maxAge;
      } else if (targetAudience.includes('+')) {
        const minAge = parseInt(targetAudience.replace('+', '').trim());
        return userAge >= minAge;
      }
      
      return true;
    };

    // Filter events by age if user has an age
    const userAge = userProfile?.age;
    const ageFilteredEvents = filteredByDateEvents.filter(event => isAgeAppropriate(event.target_audience, userAge));
    
    console.log(`Filtered to ${ageFilteredEvents.length} age-appropriate events for age ${userAge}`);

    // Build context data
    const contextData = {
      events: ageFilteredEvents.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        date: formatDate(e.date),
        originalDate: e.originalDate,
        time: e.time,
        location: e.location,
        address: e.address,
        venue_name: e.venue_name,
        price: e.price,
        mood: e.mood,
        music_type: e.music_type,
        venue_size: e.venue_size,
        external_link: e.external_link,
        image_url: e.image_url,
        target_audience: e.target_audience,
      })),
      businesses: businesses.map((b) => ({
        id: b.id,
        title: b.title,
        description: b.description,
        category: b.category,
        location: b.location,
        price: b.price,
        image_url: b.image_url,
      })),
      coupons: coupons.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        business_name: c.business_name,
        discount_amount: c.discount_amount,
        neighborhood: c.neighborhood,
        valid_until: c.valid_until,
        image_url: c.image_url,
      })),
      topLists: topLists.map((list: any) => ({
        id: list.id,
        title: list.title,
        category: list.category,
        description: list.description,
        items: (list.top_list_items || [])
          .sort((a: any, b: any) => a.display_order - b.display_order)
          .map((item: any) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            location: item.location,
            url: item.url,
          })),
      })),
    };

    // Build user context
    let userContext = "";
    if (userProfile) {
      const parts = [];
      if (userProfile.name) parts.push(`Name: ${userProfile.name}`);
      if (userProfile.age) parts.push(`Age: ${userProfile.age}`);
      if (userProfile.interests?.length) parts.push(`Interests: ${userProfile.interests.join(", ")}`);
      if (userProfile.location) parts.push(`Location: ${userProfile.location}`);
      
      if (parts.length > 0) {
        userContext = `\n\nUser Profile:\n${parts.join("\n")}`;
      }
    }

    const userLanguage = userProfile?.preferred_language || 'en';
    const languageInstruction = userLanguage === 'es'
      ? 'CRITICAL: Respond ONLY in Spanish. All messages and recommendations must be in Spanish.'
      : 'CRITICAL: Respond ONLY in English. All messages and recommendations must be in English.';

    const systemPrompt = `You are Yara - a Buenos Aires events assistant. ${languageInstruction}

${userContext}

Available data:
${JSON.stringify(contextData, null, 2)}

CRITICAL DATE INFORMATION:
- Today's date: ${today} (${todayDayName})
- Tomorrow's date: ${tomorrowDate} (${tomorrowDayName})

**RESPONSE FORMAT - PURE JSON ONLY:**

Return ONLY a raw JSON object with this exact structure:
{
  "intro_message": "Brief intro text",
  "recommendations": [
    {
      "type": "event" | "business" | "coupon" | "topListItem",
      "id": "database-id",
      "title": "Title from database",
      "description": "For events: include Location, Address, Date, Time, Music Type, Instagram link. For topListItem: include location and Instagram URL",
      "why_recommended": "1-2 sentence personalized explanation",
      "personalized_note": "ONLY for type='event', NOT for topListItem",
      "url": "MANDATORY for topListItem (Instagram link from item.url or description)",
      "image_url": "ONLY for events/businesses/coupons, NOT for topListItem"
    }
  ]
}

**TOP LIST ITEMS (bars, cafés, clubs):**
- When recommending bars/clubs/cafés: use type "topListItem"
- Use individual item.id from top_list_items as the "id"
- Include Instagram URL in "url" field (from item.url or extracted from description)
- Include "📸 Instagram: [url]" in description
- DO NOT include image_url for topListItems
- DO NOT include personalized_note for topListItems

**CRITICAL RULES:**
1. Return ONLY the raw JSON object - no markdown, no code blocks, no text before/after
2. Start with { and end with }
3. All event dates are already transformed to YYYY-MM-DD format
4. Filter by the "date" field for date-based queries
5. For "tonight"/"today": only events where date = "${today}"
6. For "tomorrow": only events where date = "${tomorrowDate}"
7. Search BOTH title AND description equally for keywords
8. Be inclusive - if keyword appears in title OR description, it's a match
9. For broad queries (artistic events, cultural events), be VERY INCLUSIVE

User query: "${query}"

Provide relevant recommendations based on this query.`;

    console.log("Calling AI with query...");

    // Call AI
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const aiResponse = aiData.choices[0].message.content;
    
    console.log("AI raw response:", aiResponse);

    // Parse AI response
    let recommendations;
    try {
      // Try to parse as JSON directly
      recommendations = JSON.parse(aiResponse);
    } catch (e) {
      // If it's wrapped in markdown code blocks, extract JSON
      const jsonMatch = aiResponse.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        recommendations = JSON.parse(jsonMatch[1]);
      } else {
        // Try to find JSON object in the response
        const jsonObjectMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
          recommendations = JSON.parse(jsonObjectMatch[0]);
        } else {
          throw new Error("Could not parse AI response as JSON");
        }
      }
    }

    console.log(`Successfully parsed ${recommendations.recommendations?.length || 0} recommendations`);

    return new Response(
      JSON.stringify(recommendations),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in n8n-yara-recommendations:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
