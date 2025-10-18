import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Send, X, Sparkles, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface AIAssistantPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const AIAssistantPopup: React.FC<AIAssistantPopupProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hey! Welcome to Yara AI- If you're looking for indie events, hidden spots or exclusive deals in BA- i'm here. What vibe are you after?",
      role: 'assistant',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<string>('');
  const [userProfile, setUserProfile] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch user profile if logged in
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user?.id) {
        const { data, error } = await supabase
          .from('profiles')
          .select('age, location, bio, interests')
          .eq('id', user.id)
          .maybeSingle();
        
        if (data && !error) {
          setUserProfile(data);
        }
      }
    };

    fetchUserProfile();
  }, [user]);

  useEffect(() => {
    // Only get location if we don't have it yet and user hasn't been asked recently
    const lastLocationRequest = localStorage.getItem('lastLocationRequest');
    const now = Date.now();
    const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
    
    // Check if we have a stored location that's less than 1 hour old
    const storedLocation = localStorage.getItem('userLocation');
    const storedLocationTime = localStorage.getItem('userLocationTime');
    
    if (storedLocation && storedLocationTime && 
        (now - parseInt(storedLocationTime)) < oneHour) {
      setUserLocation(storedLocation);
      return;
    }
    
    // Only request if we haven't asked recently
    if (lastLocationRequest && (now - parseInt(lastLocationRequest)) < oneHour) {
      return;
    }
    
    if (navigator.geolocation && !userLocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = `${position.coords.latitude}, ${position.coords.longitude}`;
          setUserLocation(location);
          localStorage.setItem('userLocation', location);
          localStorage.setItem('userLocationTime', now.toString());
          localStorage.setItem('lastLocationRequest', now.toString());
        },
        (error) => {
          console.log('Location access denied or unavailable:', error);
          localStorage.setItem('lastLocationRequest', now.toString());
        },
        {
          timeout: 10000,
          maximumAge: 300000 // Accept cached position up to 5 minutes old
        }
      );
    }
  }, [userLocation]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    // Add timeout wrapper
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 45000); // 45 second timeout
    });

    try {
      // Send conversation history for better context
      const conversationHistory = [...messages, userMessage].map(m => ({
        role: m.role,
        content: m.content
      }));

      const result = await Promise.race([
        supabase.functions.invoke('ai-assistant', {
          body: {
            message: inputMessage,
            userLocation: userLocation,
            conversationHistory: conversationHistory,
            userProfile: userProfile // Send user profile data
          }
        }),
        timeoutPromise
      ]);

      const { data, error } = result as any;

      if (error) {
        console.error('Supabase function invoke error:', error);
        throw error;
      }

      // Always show the response message if we get data back
      if (data && data.response) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: data.response,
          role: 'assistant',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        // Fallback if no response
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: 'Sorry, I encountered an error. Please try again.',
          role: 'assistant',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to get AI response. Please try again.",
        variant: "destructive",
      });
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I encountered an error. Please try again or rephrase your question.',
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <Card className="w-full max-w-3xl lg:max-w-4xl max-h-[90vh] lg:max-h-[85vh] min-h-[600px] lg:min-h-[700px] flex flex-col shadow-2xl border border-border rounded-3xl bg-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 flex-shrink-0 bg-white rounded-t-3xl border-b">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#E91E63]" />
            <span className="bg-gradient-to-r from-[#E91E63] to-[#9C27B0] bg-clip-text text-transparent">
              Yara AI
            </span>
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col p-4 lg:p-6 space-y-4 min-h-0 bg-white rounded-b-3xl">
          <ScrollArea className="flex-1 pr-4 overflow-y-auto">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <Sparkles className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] rounded-lg p-3 lg:p-4 break-words ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <p className="text-sm lg:text-base whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  </div>
                  {message.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-2 justify-start">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-gray-100 text-gray-800 rounded-lg p-3">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
          
          <div className="flex gap-2 items-center flex-shrink-0 pt-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask me anything about events, meetups, or neighbors..."
              className="flex-1 bg-white"
              disabled={isLoading}
              autoComplete="off"
              autoFocus
            />
            <Button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              size="icon"
              type="button"
              className="rounded-full"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>,
    document.body
  );
};

export default AIAssistantPopup;