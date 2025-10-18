
import { X, Plus, Calendar, Clock, MapPin, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import BottomNavigation from "@/components/BottomNavigation";
import NeighborhoodSelector from "@/components/NeighborhoodSelector";
import NotificationsPopup from "@/components/NotificationsPopup";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const CreateEventPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const { toast } = useToast();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [eventName, setEventName] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [price, setPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };


  const handleSubmit = async () => {
    if (!eventName.trim()) {
      toast({
        title: "שגיאה",
        description: "נא להזין שם לאירוע",
        variant: "destructive",
      });
      return;
    }

    if (!date || !time || !location.trim()) {
      toast({
        title: "שגיאה",
        description: "נא למלא את כל השדות הנדרשים",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "האירוע נוצר בהצלחה!",
      description: "האירוע שלך נוסף לעמוד האירועים",
    });
    
    // Generate Instagram story after creating event
    const eventData = {
      title: eventName,
      description,
      date,
      time,
      location,
      price,
      image_url: selectedImage
    };
    
    
    
    setIsSubmitting(false);
    navigate('/events');
  };

  return (
    <div className="min-h-screen bg-background pb-20" dir="rtl">
      {/* Custom Header - Same as Home Page */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <Button variant="ghost" size="sm" onClick={() => setShowNotifications(true)}>
          <Bell className="h-5 w-5" />
        </Button>
        <NeighborhoodSelector />
        <div className="flex items-center gap-3">
          <div className="text-3xl font-black font-nunito" style={{ color: '#BB31E9', textShadow: '0 0 2px rgba(187, 49, 233, 0.5)' }}>una</div>
        </div>
      </div>

      {/* Page Title */}
      <div className="p-4 text-center">
        <h1 className="text-lg font-bold text-foreground">אירוע חדש</h1>
      </div>

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-md mx-auto space-y-6">
          {/* Event Name Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block text-right">שם האירוע</label>
            <Input 
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="הזן שם לאירוע"
              className="w-full h-12 text-right bg-card border-2 border-border rounded-full"
            />
          </div>

          {/* Description Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block text-right">תיאור</label>
            <Textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="תאר את האירוע שלך"
              className="w-full min-h-32 text-right bg-card border-2 border-border rounded-3xl resize-none"
            />
          </div>

          {/* Date Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block text-right">תאריך</label>
            <div className="relative">
              <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-12 pr-12 text-right bg-card border-2 border-border rounded-full"
              />
            </div>
          </div>

          {/* Time Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block text-right">שעה</label>
            <div className="relative">
              <Clock className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full h-12 pr-12 text-right bg-card border-2 border-border rounded-full"
              />
            </div>
          </div>

          {/* Location Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block text-right">מיקום</label>
            <div className="relative">
              <MapPin className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="הזן מיקום האירוע"
                className="w-full h-12 pr-12 text-right bg-card border-2 border-border rounded-full"
              />
            </div>
          </div>

          {/* Price Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block text-right">מחיר (אופציונלי)</label>
            <Input 
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="חינם / 50 ₪"
              className="w-full h-12 text-right bg-card border-2 border-border rounded-full"
            />
          </div>

          {/* Image Upload Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block text-right">תמונה (אופציונלי)</label>
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="w-full h-48 bg-card border-2 border-border border-dashed rounded-3xl flex flex-col items-center justify-center hover:bg-muted/20 transition-colors">
                {selectedImage ? (
                  <img 
                    src={selectedImage} 
                    alt="Selected" 
                    className="w-full h-full object-cover rounded-3xl"
                  />
                ) : (
                  <>
                    <Plus className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-foreground font-medium">הוסף תמונה</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-6">
            <Button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full text-lg font-medium"
            >
              {isSubmitting ? "יוצר אירוע..." : "צור אירוע"}
            </Button>
          </div>
        </div>
      </main>
      
      <NotificationsPopup 
        isOpen={showNotifications} 
        onClose={() => setShowNotifications(false)} 
      />
      
      
      <BottomNavigation />
    </div>
  );
};

export default CreateEventPage;
