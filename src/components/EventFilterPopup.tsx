
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface EventFilterPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const EventFilterPopup = ({ isOpen, onClose }: EventFilterPopupProps) => {
  const { toast } = useToast();
  const [eventTypes, setEventTypes] = useState({
    party: false,
    concert: false,
    workshop: false,
    sports: false,
    art: false,
    food: false
  });
  const [timeFilter, setTimeFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");

  const handleEventTypeChange = (type: string, checked: boolean) => {
    setEventTypes(prev => ({
      ...prev,
      [type]: checked
    }));
  };

  const handleSave = () => {
    toast({
      title: "הפילטר נשמר!",
      description: "האירועים עודכנו בהתאם להעדפותיך",
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
            className="text-gray-600 hover:text-gray-800"
          >
            <X className="h-5 w-5" />
          </Button>
          
          <div className="text-center">
            <span className="text-3xl font-bold font-nunito" style={{ color: '#BB31E9' }}>una</span>
            <div className="text-xs text-gray-500 mt-1">פילטר אירועים</div>
          </div>
          
          <div className="w-8 h-8"></div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 space-y-8">
          {/* Event Types */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 text-center">סוג אירוע</h3>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4">
              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox 
                  id="party"
                  checked={eventTypes.party}
                  onCheckedChange={(checked) => handleEventTypeChange('party', checked as boolean)}
                />
                <label htmlFor="party" className="text-sm font-medium text-gray-700">מסיבה</label>
              </div>
              
              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox 
                  id="concert"
                  checked={eventTypes.concert}
                  onCheckedChange={(checked) => handleEventTypeChange('concert', checked as boolean)}
                />
                <label htmlFor="concert" className="text-sm font-medium text-gray-700">קונצרט</label>
              </div>
              
              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox 
                  id="workshop"
                  checked={eventTypes.workshop}
                  onCheckedChange={(checked) => handleEventTypeChange('workshop', checked as boolean)}
                />
                <label htmlFor="workshop" className="text-sm font-medium text-gray-700">סדנה</label>
              </div>
              
              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox 
                  id="sports"
                  checked={eventTypes.sports}
                  onCheckedChange={(checked) => handleEventTypeChange('sports', checked as boolean)}
                />
                <label htmlFor="sports" className="text-sm font-medium text-gray-700">ספורט</label>
              </div>
              
              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox 
                  id="art"
                  checked={eventTypes.art}
                  onCheckedChange={(checked) => handleEventTypeChange('art', checked as boolean)}
                />
                <label htmlFor="art" className="text-sm font-medium text-gray-700">אמנות</label>
              </div>
              
              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox 
                  id="food"
                  checked={eventTypes.food}
                  onCheckedChange={(checked) => handleEventTypeChange('food', checked as boolean)}
                />
                <label htmlFor="food" className="text-sm font-medium text-gray-700">אוכל</label>
              </div>
            </div>
          </div>

          {/* Time Filter */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 text-center">זמן</h3>
            <RadioGroup value={timeFilter} onValueChange={setTimeFilter} className="space-y-3">
              <div className="flex items-center justify-center space-x-2 space-x-reverse">
                <RadioGroupItem value="all" id="all-time" />
                <Label htmlFor="all-time" className="text-sm font-medium text-gray-700">הכל</Label>
              </div>
              <div className="flex items-center justify-center space-x-2 space-x-reverse">
                <RadioGroupItem value="today" id="today" />
                <Label htmlFor="today" className="text-sm font-medium text-gray-700">היום</Label>
              </div>
              <div className="flex items-center justify-center space-x-2 space-x-reverse">
                <RadioGroupItem value="tomorrow" id="tomorrow" />
                <Label htmlFor="tomorrow" className="text-sm font-medium text-gray-700">מחר</Label>
              </div>
              <div className="flex items-center justify-center space-x-2 space-x-reverse">
                <RadioGroupItem value="week" id="week" />
                <Label htmlFor="week" className="text-sm font-medium text-gray-700">השבוע</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Price Filter */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 text-center">מחיר</h3>
            <RadioGroup value={priceFilter} onValueChange={setPriceFilter} className="space-y-3">
              <div className="flex items-center justify-center space-x-2 space-x-reverse">
                <RadioGroupItem value="all" id="all-price" />
                <Label htmlFor="all-price" className="text-sm font-medium text-gray-700">הכל</Label>
              </div>
              <div className="flex items-center justify-center space-x-2 space-x-reverse">
                <RadioGroupItem value="free" id="free" />
                <Label htmlFor="free" className="text-sm font-medium text-gray-700">חינם</Label>
              </div>
              <div className="flex items-center justify-center space-x-2 space-x-reverse">
                <RadioGroupItem value="paid" id="paid" />
                <Label htmlFor="paid" className="text-sm font-medium text-gray-700">בתשלום</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Apply Button */}
          <div className="pt-4">
            <Button 
              onClick={handleSave}
              className="w-full h-12 text-white rounded-2xl text-lg font-medium"
              style={{ backgroundColor: '#BB31E9' }}
            >
              החל
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventFilterPopup;
