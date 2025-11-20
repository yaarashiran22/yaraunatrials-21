import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Send, Sparkles, MapPin } from 'lucide-react';
import { createPortal } from 'react-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface EventLocation {
  title: string;
  lat: number;
  lng: number;
  address?: string;
  time?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  mapData?: EventLocation[]; // Special field for map rendering
}

interface YaraAIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

const YaraAIAssistant: React.FC<YaraAIAssistantProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hey! I'm Yara 👋 Your AI guide to Buenos Aires. Looking for indie events, hidden deals, or bohemian spots? I've got you covered! What are you in the mood for?"
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yara-ai-chat`;

  // Fetch user profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (data) {
        setUserProfile({
          name: data.name,
          age: data.age,
          interests: data.interests,
          location: data.location,
          recommendation_count: 0
        });
      }
    };
    
    if (isOpen) {
      fetchProfile();
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // DEMO: Trigger demo map when user asks for events tonight
  const triggerDemoMap = (userInput: string) => {
    const isDemoTrigger = userInput.toLowerCase().includes('events tonight') || 
                          userInput.toLowerCase().includes('what\'s happening tonight');
    
    if (isDemoTrigger) {
      // Demo event locations in Buenos Aires
      const demoEvents: EventLocation[] = [
        { title: "Live Jazz @ Thelonious", lat: -34.5870, lng: -58.4263, address: "Palermo", time: "9:00 PM" },
        { title: "Indie Rock Night", lat: -34.6202, lng: -58.3731, address: "San Telmo", time: "10:00 PM" },
        { title: "Techno Underground", lat: -34.5998, lng: -58.4386, address: "Villa Crespo", time: "11:00 PM" },
      ];

      const demoResponse: Message = {
        role: 'assistant',
        content: "Here are the hottest events happening tonight in Buenos Aires! Check out the map below to see where they're at:",
        mapData: demoEvents
      };

      setMessages(prev => [...prev, demoResponse]);
      return true;
    }
    return false;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    
    // Check if this should trigger the demo
    if (triggerDemoMap(currentInput)) {
      return;
    }

    setIsLoading(true);

    // Extract age from user message if provided
    const ageMatch = input.match(/\b(\d{2})\b/);
    if (ageMatch && !userProfile?.age) {
      const age = parseInt(ageMatch[1]);
      if (age >= 18 && age <= 99) {
        const updatedProfile = { ...userProfile, age };
        setUserProfile(updatedProfile);
        
        // Update profile in database if user is logged in
        if (user) {
          await supabase
            .from('profiles')
            .update({ age })
            .eq('id', user.id);
        }
      }
    }

    // Extract name from user message if provided (simple heuristic)
    if (!userProfile?.name && messages.length === 1) {
      // If this is first response after greeting, assume it's their name
      const potentialName = input.trim().split(' ')[0];
      if (potentialName && potentialName.length > 1 && /^[A-Za-z]+$/.test(potentialName)) {
        const updatedProfile = { ...userProfile, name: potentialName };
        setUserProfile(updatedProfile);
        
        // Update profile in database if user is logged in
        if (user) {
          await supabase
            .from('profiles')
            .update({ name: potentialName })
            .eq('id', user.id);
        }
      }
    }

    try {
      const response = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          userProfile,
          stream: true // Enable streaming
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to get response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      let buffer = '';

      // Add placeholder for assistant message
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (let line of lines) {
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                return updated;
              });
            }
          } catch (e) {
            // Partial JSON, will be completed in next chunk
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again!'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <Card className="w-full max-w-2xl h-[600px] flex flex-col bg-gradient-to-br from-background via-background to-[#E91E63]/5 shadow-2xl border-[#E91E63]/20">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#E91E63]/20 bg-gradient-to-r from-[#E91E63]/10 via-[#9C27B0]/10 to-[#E91E63]/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E91E63] to-[#9C27B0] flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-lg bg-gradient-to-r from-[#E91E63] to-[#9C27B0] bg-clip-text text-transparent">Yara AI</h2>
              <p className="text-xs text-muted-foreground">Your Buenos Aires Guide</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-[#E91E63]/10">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx}>
                <div
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-[#E91E63] to-[#9C27B0] text-white shadow-md'
                        : 'bg-muted/80 border border-[#E91E63]/10'
                    }`}
                  >
                    <div 
                      className="text-sm whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{
                        __html: msg.content
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\n/g, '<br/>')
                      }}
                    />
                  </div>
                </div>
                
                {/* Render map if message has mapData */}
                {msg.mapData && msg.mapData.length > 0 && (
                  <div className="mt-3">
                    <EventsMap events={msg.mapData} />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted/80 border border-[#E91E63]/10 rounded-2xl px-4 py-2.5">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-[#E91E63] animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-[#9C27B0] animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-[#E91E63] animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t border-[#E91E63]/20 bg-gradient-to-r from-[#E91E63]/5 to-[#9C27B0]/5">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Try: events tonight"
              className="flex-1 bg-white border-[#E91E63]/20 focus:border-[#E91E63]/40 focus:ring-[#E91E63]/20"
              disabled={isLoading}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="bg-gradient-to-r from-[#E91E63] to-[#9C27B0] hover:from-[#D81B60] hover:to-[#8E24AA] text-white shadow-lg"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>,
    document.body
  );
};

// Mini map component for events
const EventsMap: React.FC<{ events: EventLocation[] }> = ({ events }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Buenos Aires center
    const buenosAiresCenter: [number, number] = [-34.6118, -58.3960];

    // Create map
    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView(buenosAiresCenter, 12);

    mapInstanceRef.current = map;

    // Add tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
    }).addTo(map);

    // Add event markers
    events.forEach((event, idx) => {
      // Create custom marker with number
      const icon = L.divIcon({
        html: `
          <div class="flex flex-col items-center">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-[#E91E63] to-[#9C27B0] text-white font-bold flex items-center justify-center shadow-lg border-2 border-white">
              ${idx + 1}
            </div>
            <div class="w-1 h-4 bg-gradient-to-b from-[#E91E63]/80 to-transparent"></div>
          </div>
        `,
        className: 'event-marker',
        iconSize: [32, 44],
        iconAnchor: [16, 44],
        popupAnchor: [0, -44]
      });

      L.marker([event.lat, event.lng], { icon })
        .addTo(map)
        .bindPopup(`
          <div class="text-sm">
            <div class="font-semibold text-[#E91E63]">${event.title}</div>
            ${event.time ? `<div class="text-xs text-muted-foreground mt-1">🕒 ${event.time}</div>` : ''}
            ${event.address ? `<div class="text-xs text-muted-foreground mt-1">📍 ${event.address}</div>` : ''}
          </div>
        `);
    });

    // Fit bounds to show all markers
    if (events.length > 0) {
      const bounds = L.latLngBounds(events.map(e => [e.lat, e.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [events]);

  return (
    <div className="rounded-xl overflow-hidden border border-[#E91E63]/20 shadow-lg">
      <div className="bg-gradient-to-r from-[#E91E63]/10 to-[#9C27B0]/10 px-3 py-2 flex items-center gap-2 border-b border-[#E91E63]/20">
        <MapPin className="w-4 h-4 text-[#E91E63]" />
        <span className="text-sm font-medium">Events happening tonight</span>
      </div>
      <div ref={mapRef} className="w-full h-64" />
      <div className="bg-muted/30 px-3 py-2 text-xs space-y-1">
        {events.map((event, idx) => (
          <div key={idx} className="flex items-start gap-2">
            <span className="font-bold text-[#E91E63] min-w-[16px]">{idx + 1}.</span>
            <div className="flex-1">
              <span className="font-medium">{event.title}</span>
              {event.time && <span className="text-muted-foreground ml-2">• {event.time}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default YaraAIAssistant;
