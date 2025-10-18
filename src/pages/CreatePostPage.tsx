
import { X, Camera, MapPin, Bell, Image, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import BottomNavigation from "@/components/BottomNavigation";
import NeighborhoodSelector from "@/components/NeighborhoodSelector";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { usePosts } from "@/hooks/usePosts";
import { useSecureAuth } from "@/hooks/useSecureAuth";
import { 
  validateAndSanitizeText, 
  validateImageFile, 
  containsInappropriateContent,
  CONTENT_LIMITS 
} from "@/utils/security";

import profile1 from "@/assets/profile-1.jpg";

const CreatePostPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [location, setLocation] = useState("בת העיר");
  const { createPost, creating } = usePosts();
  const { requireAuth, canPerformAction } = useSecureAuth();

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file
      const validation = validateImageFile(file);
      if (!validation.isValid) {
        toast({
          title: "שגיאה בקובץ",
          description: validation.error,
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    // Require authentication
    if (!requireAuth()) {
      return;
    }

    // Check rate limiting
    if (!canPerformAction('create-post', 5, 300000)) { // 5 posts per 5 minutes
      return;
    }

    // Validate and sanitize content
    const contentValidation = validateAndSanitizeText(content, CONTENT_LIMITS.content, true);
    if (!contentValidation.isValid) {
      toast({
        title: "שגיאה בתוכן",
        description: contentValidation.error,
        variant: "destructive",
      });
      return;
    }

    // Check for inappropriate content
    if (containsInappropriateContent(contentValidation.value)) {
      toast({
        title: "תוכן לא מתאים",
        description: "התוכן מכיל מילים לא מתאימות",
        variant: "destructive",
      });
      return;
    }

    console.log('Creating post...');
    
    const postData = {
      content: contentValidation.value,
      image_url: selectedImage || undefined,
      location: location || undefined,
    };

    const result = await createPost(postData);
    if (result) {
      console.log('Post created successfully, navigating to home');
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20" dir="rtl">
      {/* Header with Cancel and Post buttons */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => navigate(-1)}
          className="text-muted-foreground"
        >
          ביטול
        </Button>
        <h1 className="text-lg font-semibold text-foreground">פוסט חדש</h1>
        <Button 
          onClick={handleSubmit}
          disabled={creating || !content.trim()}
          size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4"
        >
          {creating ? "מפרסם..." : "פרסם"}
        </Button>
      </div>

      <main className="flex-1">
        {/* Profile section */}
        <div className="flex items-start gap-3 p-4 border-b">
          <img 
            src={profile1}
            alt="יערה שיין"
            className="w-10 h-10 rounded-full object-cover"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">יערה שיין</span>
              <Button variant="outline" size="sm" className="text-xs px-2 py-1 h-6">
                <MapPin className="h-3 w-3 ml-1" />
                {location}
              </Button>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="p-4">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="מה קורה בשכונה?"
            className="min-h-[200px] text-lg border-none shadow-none resize-none text-right bg-transparent focus-visible:ring-0 p-0"
            style={{ fontSize: '18px', lineHeight: '1.5' }}
          />
          
          {/* Selected Image Display */}
          {selectedImage && (
            <div className="mt-4 relative">
              <img 
                src={selectedImage} 
                alt="Selected" 
                className="w-full max-h-96 object-cover rounded-lg"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedImage(null)}
                className="absolute top-2 right-2 bg-black/50 text-white hover:bg-black/70 rounded-full p-1 h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Bottom toolbar */}
        <div className="fixed bottom-20 left-0 right-0 bg-background border-t p-4">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <div className="flex items-center gap-4">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <div className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-muted/50 transition-colors">
                  <Camera className="h-5 w-5 text-muted-foreground" />
                </div>
              </label>
              
              <Button variant="ghost" size="sm" className="w-10 h-10 rounded-full p-0">
                <Image className="h-5 w-5 text-muted-foreground" />
              </Button>
              
              <Button variant="ghost" size="sm" className="w-10 h-10 rounded-full p-0">
                <Smile className="h-5 w-5 text-muted-foreground" />
              </Button>
            </div>
            
            <div className="text-sm text-muted-foreground">
              {content.length}/280
            </div>
          </div>
        </div>
      </main>
      
      <BottomNavigation />
    </div>
  );
};

export default CreatePostPage;
