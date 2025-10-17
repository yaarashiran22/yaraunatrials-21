import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import AIAssistantPopup from './AIAssistantPopup';

interface AIAssistantButtonProps {
  variant?: 'floating' | 'toggle';
}

const AIAssistantButton: React.FC<AIAssistantButtonProps> = ({ variant = 'floating' }) => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  if (variant === 'toggle') {
    return (
      <>
        <div className="w-full mb-6">
          <Button
            onClick={() => setIsPopupOpen(true)}
            className="w-full h-14 rounded-2xl shadow-lg bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] hover:from-[#FF5555] hover:to-[#FF7A3D] text-white font-semibold text-lg flex items-center justify-center gap-3 transition-all duration-300 hover:shadow-xl hover:scale-[1.02]"
          >
            <Sparkles className="w-6 h-6" />
            Ask AI Assistant
          </Button>
        </div>
        
        <AIAssistantPopup
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
      
      <AIAssistantPopup
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
      />
    </>
  );
};

export default AIAssistantButton;