import { ArrowRight, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import BottomNavigation from "@/components/BottomNavigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import InterestsSelector from "@/components/InterestsSelector";
import { useLanguage } from "@/contexts/LanguageContext";

const RegisterPage = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    mobileNumber: '',
    neighborhood: '',
    bio: '',
    socialEmail: '',
    instagram: '',
    facebook: '',
    tiktok: '',
    linkedin: ''
  });
  
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfileImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.email.trim() || !formData.password.trim()) {
      toast({
        title: t('register.error'),
        description: t('register.fillRequired'),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Register the user
      const { error: signUpError } = await signUp(formData.email, formData.password, formData.name, '');
      
      if (signUpError) {
        console.error('Sign up error:', signUpError);
        toast({
          title: t('register.registrationError'),
          description: signUpError.message || t('register.unableToRegister'),
          variant: "destructive",
        });
        return;
      }

      // Wait a moment for the user to be created
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get the newly created user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Create or update the profile with all the information
        const profileData = {
          id: user.id,
          email: formData.email,
          name: formData.name,
          mobile_number: '',
          location: formData.neighborhood,
          bio: formData.bio,
          profile_image_url: profileImage,
          username: formData.instagram ? `https://instagram.com/${formData.instagram}` : null,
          show_in_search: true,
          is_private: false,
          interests: selectedInterests
        };

        const { error: profileError } = await supabase
          .from('profiles')
          .upsert(profileData);

        if (profileError) {
          console.error('Profile creation error:', profileError);
          // Don't fail completely if profile creation fails
        }
      }

      toast({
        title: t('register.registrationSuccess'),
        description: t('register.profileCreated'),
        variant: "default",
      });

      // Navigate to home page
      navigate('/');
      
    } catch (error) {
      console.error('Registration error:', error);
      toast({
        title: t('register.error'),
        description: t('register.unexpectedError'),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Custom Header */}
      <header className="sticky top-0 z-50 bg-card border-b shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Back arrow - Left side */}
            <div className="flex items-center">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate(-1)}
              >
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Title - Center */}
            <div className="text-center">
              {/* Empty - title moved to page content */}
            </div>
            
            {/* Logo - Right side */}
            <div className="flex items-center gap-2">
              <div className="text-center">
                <div className="flex items-center justify-center">
                  <div className="text-3xl font-black font-nunito" style={{ color: '#BB31E9', textShadow: '0 0 2px rgba(187, 49, 233, 0.5)' }}>una</div>
                </div>
                
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">{t('register.signUp')}</h1>
          
          {/* Welcome Description */}
          <div className="px-4 mt-4">
            <p className="text-base text-muted-foreground leading-relaxed">
              {t('register.welcome')}
            </p>
          </div>
        </div>

        <div className="max-w-md mx-auto">
          {/* Form Container with white background */}
          <div className="bg-card rounded-2xl shadow-lg p-6 mb-6">
            <div className="space-y-4">
              <div>
                <Input 
                  placeholder={t('register.name')}
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full h-12 text-left bg-background border border-border rounded-lg"
                />
              </div>
              
              <div>
                <Input 
                  placeholder={t('register.email')}
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full h-12 text-left bg-background border border-border rounded-lg"
                />
              </div>
              
              <div>
                <Input 
                  placeholder={t('register.password')}
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className="w-full h-12 text-left bg-background border border-border rounded-lg"
                />
              </div>
              
              
              <div>
                <Input 
                  placeholder={t('register.neighborhood')}
                  value={formData.neighborhood}
                  onChange={(e) => handleInputChange('neighborhood', e.target.value)}
                  className="w-full h-12 text-left bg-background border border-border rounded-lg"
                />
              </div>
              
              <div>
                <Input 
                  placeholder={t('register.shortBio')}
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  className="w-full h-12 text-left bg-background border border-border rounded-lg"
                />
              </div>
            </div>


            {/* Profile Photo Section */}
            <div className="pt-6">
              <div className="flex items-center gap-3">
                <label htmlFor="profile-upload" className="cursor-pointer">
                  <input
                    id="profile-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center overflow-hidden border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors">
                    {profileImage ? (
                      <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center">
                        <Paperclip className="h-6 w-6 text-muted-foreground mx-auto" />
                        <span className="text-xs text-muted-foreground mt-1 block">Upload</span>
                      </div>
                    )}
                  </div>
                </label>
                <div>
                  <span className="text-foreground font-medium">{t('register.profilePicture')}</span>
                  <p className="text-sm text-muted-foreground">{t('register.uploadPhoto')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Interests Section */}
          <div className="bg-card rounded-2xl shadow-lg p-6 mb-6">
            <InterestsSelector
              selectedInterests={selectedInterests}
              onChange={setSelectedInterests}
              maxInterests={5}
            />
          </div>

          {/* Social Networks Section */}
          <div className="bg-card rounded-2xl shadow-lg p-6">
            <h2 className="text-lg font-bold text-foreground mb-4 text-center">{t('register.socialNetworks')}</h2>
            <div className="space-y-4">
              <div>
                <Input 
                  placeholder={t('register.facebook')}
                  value={formData.facebook}
                  onChange={(e) => handleInputChange('facebook', e.target.value)}
                  className="w-full h-12 text-left bg-background border border-border rounded-lg"
                />
              </div>
              
              <div>
                <Input 
                  placeholder={t('register.tiktok')}
                  value={formData.tiktok}
                  onChange={(e) => handleInputChange('tiktok', e.target.value)}
                  className="w-full h-12 text-left bg-background border border-border rounded-lg"
                />
              </div>
              
              <div>
                <Input 
                  placeholder={t('register.linkedin')}
                  value={formData.linkedin}
                  onChange={(e) => handleInputChange('linkedin', e.target.value)}
                  className="w-full h-12 text-left bg-background border border-border rounded-lg"
                />
              </div>
            </div>
            
            {/* Submit Button */}
            <div className="mt-6">
              <Button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full h-12 text-white text-lg font-medium rounded-lg !bg-gradient-to-r !from-[#E91E63] !to-[#9C27B0] hover:!from-[#D81B60] hover:!to-[#8E24AA]"
              >
                {isSubmitting ? t('register.registering') : t('register.signUp')}
              </Button>
            </div>
          </div>
        </div>
      </main>
      
      <BottomNavigation />
    </div>
  );
};

export default RegisterPage;