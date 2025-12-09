import { ArrowLeft, Calendar, Clock, MapPin, Camera, Coffee, Zap, Heart, Dumbbell, Palette, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSelector from "@/components/LanguageSelector";

const CreateEventPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  const [eventName, setEventName] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringDay, setRecurringDay] = useState("");
  const [location, setLocation] = useState("");
  const [price, setPrice] = useState("");
  const [externalLink, setExternalLink] = useState("");
  const [eventType, setEventType] = useState<'event' | 'meetup'>('event');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [targetAudience, setTargetAudience] = useState("");
  const [musicType, setMusicType] = useState("");
  const [venueSize, setVenueSize] = useState("");
  const [venueName, setVenueName] = useState("");
  const [address, setAddress] = useState("");
  const [ticketLink, setTicketLink] = useState("");

  const moodFilters = [
    { id: "chill", label: "Chill", icon: Coffee, color: "text-blue-500", activeBg: "bg-blue-50 dark:bg-blue-950/30" },
    { id: "go-out", label: "Go Out", icon: Zap, color: "text-orange-500", activeBg: "bg-orange-50 dark:bg-orange-950/30" },
    { id: "romantic", label: "Romantic", icon: Heart, color: "text-pink-500", activeBg: "bg-pink-50 dark:bg-pink-950/30" },
    { id: "active", label: "Active", icon: Dumbbell, color: "text-green-500", activeBg: "bg-green-50 dark:bg-green-950/30" },
    { id: "creative", label: "Creative", icon: Palette, color: "text-purple-500", activeBg: "bg-purple-50 dark:bg-purple-950/30" },
    { id: "social", label: "Social", icon: Users, color: "text-indigo-500", activeBg: "bg-indigo-50 dark:bg-indigo-950/30" }
  ];

  const neighborhoods = [
    "Palermo",
    "Palermo Soho",
    "Palermo Hollywood", 
    "Recoleta",
    "San Telmo",
    "Villa Crespo",
    "Chacarita",
    "Other"
  ];

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

    if (!eventName.trim()) {
      toast({
        title: t('createEvent.error'),
        description: t('createEvent.enterEventNameError'),
        variant: "destructive",
      });
      return;
    }

    if (!isRecurring && !date.trim()) {
      toast({
        title: t('createEvent.error'),
        description: t('createEvent.enterDateError'),
        variant: "destructive",
      });
      return;
    }

    if (isRecurring && !recurringDay.trim()) {
      toast({
        title: t('createEvent.error'),
        description: t('createEvent.selectRecurringDayError'),
        variant: "destructive",
      });
      return;
    }

    if (!location.trim()) {
      toast({
        title: t('createEvent.error'),
        description: t('createEvent.enterLocationError'),
        variant: "destructive",
      });
      return;
    }

    if (!venueName.trim()) {
      toast({
        title: t('createEvent.error'),
        description: t('createEvent.enterVenueNameError'),
        variant: "destructive",
      });
      return;
    }

    if (selectedMoods.length === 0) {
      toast({
        title: t('createEvent.error'),
        description: t('createEvent.selectMoodError'),
        variant: "destructive",
      });
      return;
    }

    if (!externalLink.trim()) {
      toast({
        title: t('createEvent.error'),
        description: "Please add an Instagram link",
        variant: "destructive",
      });
      return;
    }

    if (!selectedFile) {
      toast({
        title: t('createEvent.error'), 
        description: t('createEvent.addMediaError'),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      let imageUrl = null;
      let videoUrl = null;
      
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const userId = user?.id || 'anonymous';
        const fileName = `${userId}/${userId}-${Date.now()}.${fileExt}`;
        const bucketName = fileType === 'video' ? 'videos' : 'item-images';
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(fileName, selectedFile);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw uploadError;
        }
        
        const { data } = supabase.storage
          .from(bucketName)
          .getPublicUrl(fileName);
          
        if (fileType === 'video') {
          videoUrl = data.publicUrl;
        } else {
          imageUrl = data.publicUrl;
        }
      }

      const { error } = await supabase
        .from('events')
        .insert({
          user_id: user?.id || null,
          title: eventName.trim(),
          description: description.trim() || null,
          date: isRecurring ? `every ${recurringDay}` : (date || null),
          time: time || null,
          location: location.trim(),
          price: price.trim() || null,
          image_url: imageUrl,
          video_url: videoUrl,
          external_link: externalLink.trim() || null,
          event_type: eventType,
          mood: selectedMoods.join(','),
          market: 'argentina',
          target_audience: targetAudience.trim() || null,
          music_type: musicType.trim() || null,
          venue_size: venueSize || null,
          venue_name: venueName.trim(),
          address: address.trim() || null,
          ticket_link: ticketLink.trim() || null
        });

      if (error) throw error;

      toast({
        title: eventType === 'meetup' ? t('createEvent.meetupCreatedSuccess') : t('createEvent.eventCreatedSuccess'),
        description: eventType === 'meetup' ? t('createEvent.meetupCreatedDesc') : t('createEvent.eventCreatedDesc'),
      });

      navigate('/events');
    } catch (error) {
      console.error('Error creating event:', error);
      toast({
        title: t('createEvent.error'),
        description: t('createEvent.createEventError'),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(262,60%,18%)] via-[hsl(290,50%,22%)] to-[hsl(320,45%,20%)]" dir="ltr">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-br from-[hsl(262,60%,18%)] via-[hsl(290,50%,22%)] to-[hsl(320,45%,20%)] border-b border-[hsl(290,40%,30%)]">
        <div className="flex items-center justify-between p-4 max-w-2xl mx-auto">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(-1)}
            className="rounded-full text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">
            {eventType === 'meetup' ? t('createEvent.newMeetup') : t('createEvent.newEvent')}
          </h1>
          <LanguageSelector />
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-2xl mx-auto pb-24">
        {/* Event Name Field */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground block text-left">
            {t('createEvent.eventTitle')}*
          </label>
          <Input 
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder={eventType === 'meetup' ? t('createEvent.enterMeetupName') : t('createEvent.enterEventName')}
            className="w-full h-12 text-left text-black placeholder:text-gray-400 bg-white border-2 border-gray-200 rounded-full"
          />
        </div>

        {/* Description Field */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground block text-left">{t('createEvent.description')}</label>
          <Textarea 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={eventType === 'meetup' ? t('createEvent.describeMeetup') : t('createEvent.describeEvent')}
            className="w-full min-h-24 text-left text-black placeholder:text-gray-400 bg-white border-2 border-gray-200 rounded-2xl resize-none"
          />
        </div>

        {/* Date Field */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground block text-left">{t('createEvent.whatDay')}*</label>
          
          <div className="flex gap-2 mb-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsRecurring(false)}
              className={`flex-1 rounded-full ${!isRecurring ? 'bg-primary text-primary-foreground' : 'bg-muted text-purple-600'}`}
            >
              {t('createEvent.specificDate')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsRecurring(true)}
              className={`flex-1 rounded-full ${isRecurring ? 'bg-primary text-primary-foreground' : 'bg-muted text-purple-600'}`}
            >
              {t('createEvent.recurringEvent')}
            </Button>
          </div>

          {!isRecurring ? (
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-12 pl-12 text-left text-black placeholder:text-gray-400 bg-white border-2 border-gray-200 rounded-full"
              />
            </div>
          ) : (
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
              <Select value={recurringDay} onValueChange={setRecurringDay}>
                <SelectTrigger className="w-full h-12 pl-12 text-left bg-white border-2 border-border rounded-full">
                  <SelectValue placeholder={t('createEvent.selectDayOfWeek')} />
                </SelectTrigger>
                <SelectContent className="bg-white border shadow-lg z-[9999]">
                  <SelectItem value="monday" className="text-left cursor-pointer hover:bg-muted">{t('createEvent.monday')}</SelectItem>
                  <SelectItem value="tuesday" className="text-left cursor-pointer hover:bg-muted">{t('createEvent.tuesday')}</SelectItem>
                  <SelectItem value="wednesday" className="text-left cursor-pointer hover:bg-muted">{t('createEvent.wednesday')}</SelectItem>
                  <SelectItem value="thursday" className="text-left cursor-pointer hover:bg-muted">{t('createEvent.thursday')}</SelectItem>
                  <SelectItem value="friday" className="text-left cursor-pointer hover:bg-muted">{t('createEvent.friday')}</SelectItem>
                  <SelectItem value="saturday" className="text-left cursor-pointer hover:bg-muted">{t('createEvent.saturday')}</SelectItem>
                  <SelectItem value="sunday" className="text-left cursor-pointer hover:bg-muted">{t('createEvent.sunday')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Time Field */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground block text-left">{t('createEvent.time')}</label>
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full h-12 pl-12 text-left text-black placeholder:text-gray-400 bg-white border-2 border-gray-200 rounded-full"
            />
          </div>
        </div>

        {/* Location Field */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground block text-left">{t('createEvent.location')}*</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger className="w-full h-12 pl-12 text-left bg-white border-2 border-border rounded-full">
                <SelectValue placeholder={t('createEvent.chooseNeighborhood')} />
              </SelectTrigger>
              <SelectContent className="bg-white border shadow-lg z-[9999] max-h-60">
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

        {/* Event Organizer Field */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground block text-left">Event Organizer*</label>
          <Input 
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
            placeholder={t('createEvent.venueNamePlaceholder')}
            className="w-full h-12 text-left text-black placeholder:text-gray-400 bg-white border-2 border-gray-200 rounded-full"
          />
        </div>

        {/* Address Field */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground block text-left">{t('createEvent.address')}</label>
          <Input 
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t('createEvent.addressPlaceholder')}
            className="w-full h-12 text-left text-black placeholder:text-gray-400 bg-white border-2 border-gray-200 rounded-full"
          />
        </div>

        {/* Price Field */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground block text-left">{t('createEvent.priceOptional')}</label>
          <Input 
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={t('createEvent.pricePlaceholder')}
            className="w-full h-12 text-left text-black placeholder:text-gray-400 bg-white border-2 border-gray-200 rounded-full"
          />
        </div>

        {/* Ticket Link Field */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground block text-left">Ticket Link (Optional)</label>
          <Input 
            value={ticketLink}
            onChange={(e) => setTicketLink(e.target.value)}
            placeholder="https://..."
            className="w-full h-12 text-left text-black placeholder:text-gray-400 bg-white border-2 border-gray-200 rounded-full"
          />
        </div>

        {/* Instagram Link Field */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground block text-left">Instagram Page Link*</label>
          <Input 
            value={externalLink}
            onChange={(e) => setExternalLink(e.target.value)}
            placeholder="https://instagram.com/..."
            className="w-full h-12 text-left text-black placeholder:text-gray-400 bg-white border-2 border-gray-200 rounded-full"
          />
        </div>

        {/* Target Audience Field */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground block text-left">{t('createEvent.targetAudience')}</label>
          <Input 
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            placeholder={t('createEvent.targetAudiencePlaceholder')}
            className="w-full h-12 text-left text-black placeholder:text-gray-400 bg-white border-2 border-gray-200 rounded-full"
          />
        </div>

        {/* Music Type Field */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground block text-left">{t('createEvent.musicType')}</label>
          <Input 
            value={musicType}
            onChange={(e) => setMusicType(e.target.value)}
            placeholder={t('createEvent.musicTypePlaceholder')}
            className="w-full h-12 text-left text-black placeholder:text-gray-400 bg-white border-2 border-gray-200 rounded-full"
          />
        </div>

        {/* What Mood Section */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground block text-left">{t('createEvent.whatMood')}* (Choose up to 2)</label>
          <div className="flex flex-wrap gap-2">
            {moodFilters.map((mood) => {
              const IconComponent = mood.icon;
              const isSelected = selectedMoods.includes(mood.id);
              return (
                <Button
                  key={mood.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (isSelected) {
                      setSelectedMoods(selectedMoods.filter(m => m !== mood.id));
                    } else if (selectedMoods.length < 2) {
                      setSelectedMoods([...selectedMoods, mood.id]);
                    }
                  }}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-200
                    ${isSelected
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
          <label className="text-sm font-medium text-foreground block text-left">{t('createEvent.addMedia')}*</label>
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
              className="w-full h-12 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <Camera className="h-5 w-5" />
                <span className="text-sm">{selectedFile ? selectedFile.name : t('createEvent.chooseMedia')}</span>
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
              (eventType === 'meetup' ? t('createEvent.creatingMeetup') : t('createEvent.creatingEvent')) : 
              (eventType === 'meetup' ? t('createEvent.postMeetup') : t('createEvent.postEvent'))
            }
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateEventPage;
