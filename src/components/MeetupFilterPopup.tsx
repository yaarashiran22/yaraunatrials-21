import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface MeetupFilterPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const MeetupFilterPopup = ({ isOpen, onClose }: MeetupFilterPopupProps) => {
  const { toast } = useToast();
  const [meetupTypes, setMeetupTypes] = useState({
    coffee: false,
    sports: false,
    social: false,
    study: false,
    creative: false,
    food: false
  });
  const [timeFilter, setTimeFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");

  const handleMeetupTypeChange = (type: string, checked: boolean) => {
    setMeetupTypes(prev => ({
      ...prev,
      [type]: checked
    }));
  };

  const handleSave = () => {
    toast({
      title: "Filter applied!",
      description: "Meetups updated according to your preferences",
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header with una logo */}
        <div className="flex items-center justify-between p-4 pb-6">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onClose}
            className="text-foreground hover:text-primary"
          >
            <X className="h-5 w-5" />
          </Button>
          
          <div className="text-center">
            <span className="text-3xl font-bold text-primary">una</span>
            <div className="text-xs text-foreground mt-1">meetup filters</div>
          </div>
          
          <div className="w-8 h-8"></div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 space-y-8">
          {/* Meetup Types */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground text-center">Meetup Type</h3>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4">
              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox 
                  id="coffee"
                  checked={meetupTypes.coffee}
                  onCheckedChange={(checked) => handleMeetupTypeChange('coffee', checked as boolean)}
                />
                <label htmlFor="coffee" className="text-sm font-medium text-foreground">Coffee</label>
              </div>
              
              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox 
                  id="sports"
                  checked={meetupTypes.sports}
                  onCheckedChange={(checked) => handleMeetupTypeChange('sports', checked as boolean)}
                />
                <label htmlFor="sports" className="text-sm font-medium text-foreground">Sports</label>
              </div>
              
              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox 
                  id="social"
                  checked={meetupTypes.social}
                  onCheckedChange={(checked) => handleMeetupTypeChange('social', checked as boolean)}
                />
                <label htmlFor="social" className="text-sm font-medium text-foreground">Social</label>
              </div>
              
              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox 
                  id="study"
                  checked={meetupTypes.study}
                  onCheckedChange={(checked) => handleMeetupTypeChange('study', checked as boolean)}
                />
                <label htmlFor="study" className="text-sm font-medium text-foreground">Study</label>
              </div>
              
              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox 
                  id="creative"
                  checked={meetupTypes.creative}
                  onCheckedChange={(checked) => handleMeetupTypeChange('creative', checked as boolean)}
                />
                <label htmlFor="creative" className="text-sm font-medium text-foreground">Creative</label>
              </div>
              
              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox 
                  id="food"
                  checked={meetupTypes.food}
                  onCheckedChange={(checked) => handleMeetupTypeChange('food', checked as boolean)}
                />
                <label htmlFor="food" className="text-sm font-medium text-foreground">Food</label>
              </div>
            </div>
          </div>

          {/* Time Filter */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground text-center">Time</h3>
            <RadioGroup value={timeFilter} onValueChange={setTimeFilter} className="space-y-3">
              <div className="flex items-center justify-center space-x-2 space-x-reverse">
                <RadioGroupItem value="all" id="all-time" />
                <Label htmlFor="all-time" className="text-sm font-medium text-foreground">All</Label>
              </div>
              <div className="flex items-center justify-center space-x-2 space-x-reverse">
                <RadioGroupItem value="today" id="today" />
                <Label htmlFor="today" className="text-sm font-medium text-foreground">Today</Label>
              </div>
              <div className="flex items-center justify-center space-x-2 space-x-reverse">
                <RadioGroupItem value="tomorrow" id="tomorrow" />
                <Label htmlFor="tomorrow" className="text-sm font-medium text-foreground">Tomorrow</Label>
              </div>
              <div className="flex items-center justify-center space-x-2 space-x-reverse">
                <RadioGroupItem value="week" id="week" />
                <Label htmlFor="week" className="text-sm font-medium text-foreground">This Week</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Location Filter */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground text-center">Location</h3>
            <RadioGroup value={locationFilter} onValueChange={setLocationFilter} className="space-y-3">
              <div className="flex items-center justify-center space-x-2 space-x-reverse">
                <RadioGroupItem value="all" id="all-location" />
                <Label htmlFor="all-location" className="text-sm font-medium text-foreground">All</Label>
              </div>
              <div className="flex items-center justify-center space-x-2 space-x-reverse">
                <RadioGroupItem value="nearby" id="nearby" />
                <Label htmlFor="nearby" className="text-sm font-medium text-foreground">Nearby</Label>
              </div>
              <div className="flex items-center justify-center space-x-2 space-x-reverse">
                <RadioGroupItem value="neighborhood" id="neighborhood" />
                <Label htmlFor="neighborhood" className="text-sm font-medium text-foreground">My Neighborhood</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Apply Button */}
          <div className="pt-4">
            <Button 
              onClick={handleSave}
              className="w-full h-12 bg-primary hover:bg-primary-600 text-white rounded-2xl text-lg font-medium"
            >
              Apply Filter
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetupFilterPopup;