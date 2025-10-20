import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import YaraAIChatbot from './YaraAIChatbot';
import { useLanguage } from '@/contexts/LanguageContext';

interface AIAssistantButtonProps {
  variant?: 'floating' | 'toggle';
}

const AIAssistantButton: React.FC<AIAssistantButtonProps> = ({ variant = 'floating' }) => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const { t } = useLanguage();

  if (variant === 'toggle') {
    return (
      <>
        <div className="w-full mb-6">
          <Button
            onClick={() => setIsPopupOpen(true)}
            className="w-full h-12 rounded-2xl shadow-lg bg-gradient-to-r from-[#E91E63] to-[#9C27B0] hover:from-[#D81B60] hover:to-[#8E24AA] text-white font-semibold text-base flex items-center justify-center gap-2.5 transition-all duration-300 hover:shadow-xl hover:scale-[1.02]"
          >
            <Sparkles className="w-5 h-5" />
            {t('ai.askYaraAI')}
          </Button>
        </div>
        
        <YaraAIChatbot
          isOpen={isPopupOpen}
          onClose={() => setIsPopupOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <Button
        onClick={() => setIsPopupOpen(true)}
        className="fixed bottom-32 lg:bottom-20 right-4 z-50 rounded-full w-14 h-14 shadow-lg bg-red-500 hover:bg-red-600 text-white"
        size="icon"
      >
        <Sparkles className="w-7 h-7" />
      </Button>
      
      <YaraAIChatbot
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
      />
    </>
  );
};

export default AIAssistantButton;