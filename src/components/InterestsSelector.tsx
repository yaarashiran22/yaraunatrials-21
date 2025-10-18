import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface InterestsSelectorProps {
  selectedInterests: string[];
  onChange: (interests: string[]) => void;
  maxInterests?: number;
}

const AVAILABLE_INTERESTS = [
  "🎨 Art & Design",
  "🎵 Music & Concerts", 
  "🍽️ Food & Dining",
  "⚽ Sports & Fitness",
  "🎬 Movies & Cinema",
  "🌱 Nature & Outdoors",
  "💻 Technology",
  "🧘 Wellness & Health",
  "✈️ Travel & Adventure",
  "🎪 Nightlife & Entertainment",
  "👗 Fashion & Style"
];

export const InterestsSelector = ({ 
  selectedInterests, 
  onChange, 
  maxInterests = 5 
}: InterestsSelectorProps) => {
  const handleInterestToggle = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      onChange(selectedInterests.filter(i => i !== interest));
    } else if (selectedInterests.length < maxInterests) {
      onChange([...selectedInterests, interest]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Choose Your Interests
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Select up to {maxInterests} interests to personalize your recommendations
        </p>
        <p className="text-xs text-muted-foreground">
          Selected: {selectedInterests.length}/{maxInterests}
        </p>
      </div>
      
      <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
        {AVAILABLE_INTERESTS.map((interest) => {
          const isSelected = selectedInterests.includes(interest);
          const isDisabled = !isSelected && selectedInterests.length >= maxInterests;
          
          return (
            <Button
              key={interest}
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => handleInterestToggle(interest)}
              disabled={isDisabled}
              className={`text-xs p-2 h-auto text-left justify-start ${
                isSelected 
                  ? "bg-primary text-primary-foreground" 
                  : isDisabled 
                    ? "opacity-50 cursor-not-allowed" 
                    : "hover:bg-primary/10"
              }`}
            >
              {interest}
            </Button>
          );
        })}
      </div>
      
      {selectedInterests.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Selected:</p>
          <div className="flex flex-wrap gap-2">
            {selectedInterests.map((interest) => (
              <Badge 
                key={interest} 
                variant="secondary"
                className="text-xs cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => handleInterestToggle(interest)}
              >
                {interest} ×
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InterestsSelector;