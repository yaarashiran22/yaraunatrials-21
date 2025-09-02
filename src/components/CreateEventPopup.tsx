import { X, Plus, Calendar, Clock, MapPin, Camera, Upload, Coffee, Zap, Heart, Dumbbell, Palette, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";

interface CreateEventPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onEventCreated?: () => void;
  initialEventType?: 'event' | 'meetup';
}

const CreateEventPopup = ({ isOpen, onClose, onEventCreated, initialEventType = 'event' }: CreateEventPopupProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const [eventName, setEventName] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [price, setPrice] = useState("");
  const [externalLink, setExternalLink] = useState("");
  const [eventType, setEventType] = useState<'event' | 'meetup'>(initialEventType);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string>("");
  const [isOpenDate, setIsOpenDate] = useState(false);

  // Mood filters from home page
  const moodFilters = [
    { id: "chill", label: "Chill", icon: Coffee, color: "text-blue-500", activeBg: "bg-blue-50 dark:bg-blue-950/30" },
    { id: "go-out", label: "Go Out", icon: Zap, color: "text-orange-500", activeBg: "bg-orange-50 dark:bg-orange-950/30" },
    { id: "romantic", label: "Romantic", icon: Heart, color: "text-pink-500", activeBg: "bg-pink-50 dark:bg-pink-950/30" },
    { id: "active", label: "Active", icon: Dumbbell, color: "text-green-500", activeBg: "bg-green-50 dark:bg-green-950/30" },
    { id: "creative", label: "Creative", icon: Palette, color: "text-purple-500", activeBg: "bg-purple-50 dark:bg-purple-950/30" },
    { id: "social", label: "Social", icon: Users, color: "text-indigo-500", activeBg: "bg-indigo-50 dark:bg-indigo-950/30" }
  ];

  // Neighborhoods available in the website - Buenos Aires neighborhoods
  const neighborhoods = [
    "Palermo",
    "Palermo Soho",
    "Palermo Hollywood", 
    "Recoleta",
    "San Telmo",
    "Villa Crespo"
  ];

  if (!isOpen) return null;

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const isVideo = file.type.startsWith('video/');
      setFileType(isVideo ? 'video' : 'image');
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    console.log('Starting event creation...');
    
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to create an event",
        variant: "destructive",
      });
      return;
    }

    if (!eventName.trim()) {
      toast({
        title: "Error",
        description: "Please enter an event name",
        variant: "destructive",
      });
      return;
    }

    if (!date.trim() && !isOpenDate) {
      toast({
        title: "Error",
        description: "Please enter an event date or select open date option",
        variant: "destructive",
      });
      return;
    }

    if (!location.trim()) {
      toast({
        title: "Error",
        description: "Please enter an event location",
        variant: "destructive",
      });
      return;
    }

    if (!selectedFile) {
      toast({
        title: "Error", 
        description: "Please add an image or video for the event",
        variant: "destructive",
      });
      return;
    }

    console.log('File details:', {
      name: selectedFile.name,
      type: selectedFile.type,
      fileType: fileType,
      size: selectedFile.size
    });

    setIsSubmitting(true);
    
    try {
      // Upload file to Supabase storage
      let imageUrl = null;
      let videoUrl = null;
      
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${user.id}/${user.id}-${Date.now()}.${fileExt}`;
        const bucketName = fileType === 'video' ? 'videos' : 'item-images';
        
        console.log('Attempting upload:', { fileName, bucketName, fileSize: selectedFile.size });
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(fileName, selectedFile);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw uploadError;
        }
        
        console.log('Upload successful:', uploadData);
        
        const { data } = supabase.storage
          .from(bucketName)
          .getPublicUrl(fileName);
          
        console.log('Public URL generated:', data.publicUrl);
          
        if (fileType === 'video') {
          videoUrl = data.publicUrl;
        } else {
          imageUrl = data.publicUrl;
        }
      }

      const { error } = await supabase
        .from('events')
        .insert({
          user_id: user.id,
          title: eventName.trim(),
          description: description.trim() || null,
          date: isOpenDate ? null : (date || null),
          time: isOpenDate ? null : (time || null),
          location: location.trim(),
          price: price.trim() || null,
          image_url: imageUrl,
          video_url: videoUrl,
          external_link: externalLink.trim() || null,
          event_type: eventType,
          mood: selectedMood || null,
          market: 'argentina' // Argentina market only
        });

      if (error) throw error;

      toast({
        title: eventType === 'meetup' ? "Meetup created successfully!" : "Event created successfully!",
        description: eventType === 'meetup' ? "Your meetup has been added to the meetups page" : "Your event has been added to the events page",
      });

      // Reset form
      setEventName("");
      setDescription("");
      setDate("");
      setTime("");
      setLocation("");
      setPrice("");
      setExternalLink("");
      setEventType('event');
      setSelectedFile(null);
      setFilePreview(null);
      setFileType(null);
      setSelectedMood("");
      setIsOpenDate(false);

      // Call callback to refresh data
      if (onEventCreated) {
        onEventCreated();
      }

      onClose();
    } catch (error) {
      console.error('Error creating event:', error);
      toast({
        title: "Error",
        description: "Could not create the event. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4" dir="ltr">
      <div className="bg-background rounded-t-3xl md:rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold text-foreground">
            {eventType === 'meetup' ? 'New Meetup' : 'New Event'}
          </h2>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="rounded-full"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Event Name Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block text-left">
              Title*
            </label>
            <Input 
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder={eventType === 'meetup' ? 'Enter meetup name' : 'Enter event name'}
              className="w-full h-12 text-left bg-card border-2 border-border rounded-full"
            />
          </div>

          {/* Description Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block text-left">Description</label>
            <Textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={eventType === 'meetup' ? 'Describe your meetup' : 'Describe your event'}
              className="w-full min-h-24 text-left bg-card border-2 border-border rounded-2xl resize-none"
            />
          </div>

          {/* Date Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block text-left">What Day*</label>
            
            {/* Open Date Option */}
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="open-date"
                checked={isOpenDate}
                onChange={(e) => {
                  setIsOpenDate(e.target.checked);
                  if (e.target.checked) {
                    setDate("");
                    setTime("");
                  }
                }}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <label htmlFor="open-date" className="text-sm text-foreground cursor-pointer">
                Open date (no specific day - open invite)
              </label>
            </div>

            {!isOpenDate && (
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full h-12 pl-12 text-left bg-card border-2 border-border rounded-full"
                />
              </div>
            )}
          </div>

          {/* Time Field */}
          {!isOpenDate && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground block text-left">Time</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full h-12 pl-12 text-left bg-card border-2 border-border rounded-full"
                />
              </div>
            </div>
          )}

          {/* Location Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block text-left">Location*</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger className="w-full h-12 pl-12 text-left bg-background border-2 border-border rounded-full">
                  <SelectValue placeholder="Choose neighborhood" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50 max-h-60">
                  {neighborhoods.map((neighborhood) => (
                    <SelectItem 
                      key={neighborhood} 
                      value={neighborhood}
                      className="text-left cursor-pointer hover:bg-muted"
                    >
                      {neighborhood}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Price Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block text-left">Price (Optional)</label>
            <Input 
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Free / ₪50"
              className="w-full h-12 text-left bg-card border-2 border-border rounded-full"
            />
          </div>

          {/* External Link Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block text-left">External Link (Optional)</label>
            <Input 
              value={externalLink}
              onChange={(e) => setExternalLink(e.target.value)}
              placeholder="https://example.com"
              className="w-full h-12 text-left bg-card border-2 border-border rounded-full"
            />
          </div>

          {/* What Mood Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block text-left">What Mood</label>
            <div className="flex flex-wrap gap-2">
              {moodFilters.map((mood) => {
                const IconComponent = mood.icon;
                return (
                  <Button
                    key={mood.id}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedMood(selectedMood === mood.id ? "" : mood.id)}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-200
                      ${selectedMood === mood.id
                        ? `${mood.activeBg} ${mood.color} border-current/20`
                        : `${mood.color} border-border hover:bg-accent/50`
                      }
                    `}
                  >
                    <IconComponent className={`h-4 w-4 ${mood.color}`} />
                    <span className="text-sm">{mood.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Media Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block text-left">Image or Video*</label>
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileUpload}
                className="hidden"
                id="media-upload"
              />
              <label 
                htmlFor="media-upload"
                className="w-full h-12 bg-card border-2 border-border rounded-full flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Camera className="h-5 w-5" />
                  <span className="text-sm">{selectedFile ? selectedFile.name : "Choose image or video"}</span>
                </div>
              </label>
              {filePreview && (
                <div className="w-full h-32 bg-muted rounded-2xl overflow-hidden">
                  {fileType === 'video' ? (
                    <video 
                      src={filePreview} 
                      className="w-full h-full object-cover"
                      controls
                      muted
                    />
                  ) : (
                    <img 
                      src={filePreview} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <Button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full text-lg font-medium"
            >
              {isSubmitting ? 
                (eventType === 'meetup' ? "Creating meetup..." : "Creating event...") : 
                (eventType === 'meetup' ? "Create Meetup" : "Create Event")
              }
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateEventPopup;