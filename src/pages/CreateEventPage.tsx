import { X, Plus, Calendar, Clock, MapPin, Camera, Upload, Coffee, Zap, Heart, Dumbbell, Palette, Users, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageSelector from "@/components/LanguageSelector";
import { useNavigate } from "react-router-dom";

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
    console.log('File selected:', file?.name, file?.type, file?.size);
    if (file) {
      setSelectedFile(file);
      const isVideo = file.type.startsWith('video/');
      setFileType(isVideo ? 'video' : 'image');
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview(e.target?.result as string);
        console.log('File preview set successfully');
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleMood = (moodId: string) => {
    setSelectedMoods(prev => 
      prev.includes(moodId) 
        ? prev.filter(m => m !== moodId)
        : [...prev, moodId]
    );
  };

  const handleSubmit = async () => {
    console.log('Starting event creation...');
    console.log('Selected file state:', selectedFile?.name, selectedFile?.type);

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
      console.log('No file selected - showing error');
      toast({
        title: t('createEvent.error'), 
        description: t('createEvent.addMediaError'),
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
      let imageUrl = null;
      let videoUrl = null;
      
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const userId = user?.id || 'anonymous';
        const fileName = `${userId}/${userId}-${Date.now()}.${fileExt}`;
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

      navigate('/');
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
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-purple-700" dir="ltr">
      <div className="max-w-md mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between py-4 mb-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/')}
            className="text-white hover:bg-white/20 rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-white">
            {eventType === 'meetup' ? t('createEvent.newMeetup') : t('createEvent.newEvent')}
          </h1>
          <LanguageSelector />
        </div>

        <div className="bg-black/80 backdrop-blur-sm rounded-3xl p-6 space-y-6">
          {/* Event Name Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white block text-left">
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
            <label className="text-sm font-medium text-white block text-left">{t('createEvent.description')}</label>
            <Textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={eventType === 'meetup' ? t('createEvent.describeMeetup') : t('createEvent.describeEvent')}
              className="w-full min-h-24 text-left text-black placeholder:text-gray-400 bg-white border-2 border-gray-200 rounded-2xl resize-none"
            />
          </div>

          {/* Date Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white block text-left">{t('createEvent.whatDay')}*</label>
            
            <div className="flex gap-2 mb-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsRecurring(false)}
                className={`flex-1 rounded-full ${!isRecurring ? 'bg-white text-purple-600' : 'bg-white/20 text-white'}`}
              >
                {t('createEvent.specificDate')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsRecurring(true)}
                className={`flex-1 rounded-full ${isRecurring ? 'bg-white text-purple-600' : 'bg-white/20 text-white'}`}
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
                  <SelectTrigger className="w-full h-12 pl-12 text-left bg-white border-2 border-gray-200 rounded-full">
                    <SelectValue placeholder={t('createEvent.selectDayOfWeek')} />
                  </SelectTrigger>
                  <SelectContent className="bg-white border shadow-lg z-[9999]">
                    <SelectItem value="monday">{t('createEvent.monday')}</SelectItem>
                    <SelectItem value="tuesday">{t('createEvent.tuesday')}</SelectItem>
                    <SelectItem value="wednesday">{t('createEvent.wednesday')}</SelectItem>
                    <SelectItem value="thursday">{t('createEvent.thursday')}</SelectItem>
                    <SelectItem value="friday">{t('createEvent.friday')}</SelectItem>
                    <SelectItem value="saturday">{t('createEvent.saturday')}</SelectItem>
                    <SelectItem value="sunday">{t('createEvent.sunday')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Time Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white block text-left">{t('createEvent.time')}</label>
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
            <label className="text-sm font-medium text-white block text-left">{t('createEvent.location')}*</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger className="w-full h-12 pl-12 text-left bg-white border-2 border-gray-200 rounded-full">
                  <SelectValue placeholder={t('createEvent.chooseNeighborhood')} />
                </SelectTrigger>
                <SelectContent className="bg-white border shadow-lg z-[9999] max-h-60">
                  {neighborhoods.map((neighborhood) => (
                    <SelectItem key={neighborhood} value={neighborhood}>
                      {neighborhood}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Venue Name Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white block text-left">{t('createEvent.venueName')}*</label>
            <Input 
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder={t('createEvent.venueNamePlaceholder')}
              className="w-full h-12 text-left text-black placeholder:text-gray-400 bg-white border-2 border-gray-200 rounded-full"
            />
          </div>

          {/* Address Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white block text-left">{t('createEvent.address')}</label>
            <Input 
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t('createEvent.addressPlaceholder')}
              className="w-full h-12 text-left text-black placeholder:text-gray-400 bg-white border-2 border-gray-200 rounded-full"
            />
          </div>

          {/* Price Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white block text-left">{t('createEvent.priceOptional')}</label>
            <Input 
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={t('createEvent.pricePlaceholder')}
              className="w-full h-12 text-left text-black placeholder:text-gray-400 bg-white border-2 border-gray-200 rounded-full"
            />
          </div>

          {/* Instagram Link Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white block text-left">{t('createEvent.instagramLink')}*</label>
            <Input 
              value={externalLink}
              onChange={(e) => setExternalLink(e.target.value)}
              placeholder="https://instagram.com/..."
              className="w-full h-12 text-left text-black placeholder:text-gray-400 bg-white border-2 border-gray-200 rounded-full"
            />
          </div>

          {/* Mood Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white block text-left">{t('createEvent.mood')}*</label>
            <div className="flex flex-wrap gap-2">
              {moodFilters.map((mood) => {
                const Icon = mood.icon;
                const isSelected = selectedMoods.includes(mood.id);
                return (
                  <Button
                    key={mood.id}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleMood(mood.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
                      isSelected 
                        ? `${mood.activeBg} ${mood.color} border-2 border-current` 
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm">{mood.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white block text-left">{t('createEvent.addMedia')}*</label>
            {filePreview ? (
              <div className="relative rounded-2xl overflow-hidden">
                {fileType === 'video' ? (
                  <video 
                    src={filePreview} 
                    className="w-full h-48 object-cover"
                    controls
                  />
                ) : (
                  <img 
                    src={filePreview} 
                    alt="Preview" 
                    className="w-full h-48 object-cover"
                  />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedFile(null);
                    setFilePreview(null);
                    setFileType(null);
                  }}
                  className="absolute top-2 right-2 bg-black/50 text-white hover:bg-black/70 rounded-full h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-white/50 rounded-2xl cursor-pointer hover:border-white/80 transition-colors">
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Upload className="h-8 w-8 text-white/70 mb-2" />
                <span className="text-white/70 text-sm">{t('createEvent.uploadMedia')}</span>
              </label>
            )}
          </div>

          {/* Submit Button */}
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full h-14 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold text-lg rounded-full transition-all"
          >
            {isSubmitting ? t('createEvent.creating') : t('createEvent.createEvent')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateEventPage;
