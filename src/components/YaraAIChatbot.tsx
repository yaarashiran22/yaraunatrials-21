import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, X, Sparkles, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  cards?: Array<{
    title: string;
    body: string;
    image_url?: string;
    buttons?: Array<{
      type: 'url' | 'reply';
      text: string;
      url?: string;
      payload?: string;
    }>;
  }>;
}

interface YaraAIChatbotProps {
  isOpen: boolean;
  onClose: () => void;
}

const YaraAIChatbot: React.FC<YaraAIChatbotProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hey! Welcome to Yara AI - if you're looking for indie events, hidden deals and bohemian spots in Buenos Aires - I'm here. What are you looking for?",
      role: 'assistant',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

    try {
      // Build conversation history for context
      const conversationMessages = [...messages, userMessage].map(m => ({
        role: m.role,
        content: m.content
      }));

      const { data, error } = await supabase.functions.invoke('yara-chat', {
        body: { messages: conversationMessages }
      });

      if (error) {
        console.error('Error calling Yara AI:', error);
        throw error;
      }

      console.log('Yara AI Response:', data);

      if (data?.message) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: data.message,
          role: 'assistant',
          timestamp: new Date(),
          cards: data.cards || []
        };
        console.log('Adding assistant message with cards:', assistantMessage.cards?.length || 0);
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error('No response from AI');
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
        content: 'Sorry, I encountered an error. Please try again.',
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
      <Card className="w-full max-w-3xl lg:max-w-4xl max-h-[90vh] lg:max-h-[85vh] min-h-[600px] lg:min-h-[700px] flex flex-col shadow-2xl border-2 border-primary/20 rounded-3xl bg-gradient-to-br from-white to-primary/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 flex-shrink-0 rounded-t-3xl border-b border-primary/10 bg-white/95 backdrop-blur-sm">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              Yara AI
            </span>
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 hover:bg-primary/10"
          >
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col p-4 lg:p-6 space-y-4 min-h-0">
          <ScrollArea className="flex-1 pr-4 overflow-y-auto">
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="space-y-3">
                  <div
                    className={`flex gap-3 ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center flex-shrink-0 mt-1">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div
                      className={`max-w-[75%] rounded-2xl p-4 break-words shadow-sm ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-white/80 backdrop-blur-sm text-gray-800 border border-gray-200'
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
                  
                  {/* Display cards if present */}
                  {message.cards && message.cards.length > 0 && (
                    <div className="ml-11 space-y-2">
                      {message.cards.map((card, idx) => (
                        <div key={idx} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                          {card.image_url && (
                            <img src={card.image_url} alt={card.title} className="w-full h-32 object-cover" />
                          )}
                          <div className="p-3">
                            <h4 className="font-semibold text-sm text-gray-900 mb-1">{card.title}</h4>
                            <p className="text-xs text-gray-600 leading-relaxed">{card.body}</p>
                            {card.buttons && card.buttons.length > 0 && (
                              <div className="flex gap-2 mt-3">
                                {card.buttons.map((btn, btnIdx) => (
                                  btn.type === 'url' && btn.url ? (
                                    <a
                                      key={btnIdx}
                                      href={btn.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                                    >
                                      {btn.text}
                                    </a>
                                  ) : null
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-200">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
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
              placeholder="Ask me about events, spots, or deals..."
              className="flex-1 bg-white/90 backdrop-blur-sm border-gray-300 focus:border-primary"
              disabled={isLoading}
              autoComplete="off"
              autoFocus
            />
            <Button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              size="icon"
              type="button"
              className="rounded-full h-10 w-10 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
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

export default YaraAIChatbot;
