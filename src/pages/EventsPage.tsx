import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import EventFilterPopup from "@/components/EventFilterPopup";
import EventPopup from "@/components/EventPopup";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEvents } from "@/hooks/useEvents";

const EventsPage = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { events, loading } = useEvents();
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [isEventPopupOpen, setIsEventPopupOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEvents = events.filter(event => 
    event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    event.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEventClick = (event: any) => {
    setSelectedEvent({
      title: event.title,
      image: event.image_url,
      price: event.price ? `${event.price} ₪` : "Free",
      description: event.description || "",
      location: event.location
    });
    setIsEventPopupOpen(true);
  };

  return (
    <div className="min-h-screen bg-background pb-20" dir="ltr">
      <Header 
        title="Events"
        showSearch={true}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search events..."
      />
      
      {/* Content Grid */}
      <main className="px-4 py-4">
        {loading ? (
          <div className="grid grid-cols-3 gap-4">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="w-full aspect-square bg-muted rounded-xl animate-pulse"></div>
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No events available</p>
            <p className="text-xs text-muted-foreground mt-2">DEBUG: Total events: {events.length}</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 auto-rows-max">
            {filteredEvents.map((event) => (
              <div 
                key={event.id}
                onClick={() => handleEventClick(event)}
                className="cursor-pointer w-full hover:scale-105 transition-transform duration-200"
              >
                <div className="bg-card rounded-xl overflow-hidden shadow-sm border">
                  {event.image_url ? (
                    <div className="aspect-square w-full">
                      <img 
                        src={event.image_url} 
                        alt={event.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="aspect-square w-full bg-muted flex items-center justify-center">
                      <span className="text-muted-foreground text-sm">No image</span>
                    </div>
                  )}
                  <div className="p-2">
                    <h3 className="font-semibold text-sm text-left truncate">{event.title}</h3>
                    {event.description && (
                      <p className="text-sm text-muted-foreground text-left mt-1 truncate">{event.description}</p>
                    )}
                    {event.price && (
                      <p className="text-sm font-medium text-primary text-left mt-1">{event.price} ₪</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <EventFilterPopup 
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
      />

      <EventPopup 
        isOpen={isEventPopupOpen}
        onClose={() => setIsEventPopupOpen(false)}
        event={selectedEvent}
      />
      
      <BottomNavigation />
    </div>
  );
};

export default EventsPage;