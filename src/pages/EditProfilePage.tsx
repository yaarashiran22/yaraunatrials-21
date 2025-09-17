import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Bell, Camera, Plus, Coffee, Zap, Heart, Dumbbell, Palette, Users, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import BottomNavigation from "@/components/BottomNavigation";
import NeighborhoodSelector from "@/components/NeighborhoodSelector";
import NotificationsPopup from "@/components/NotificationsPopup";
import InterestsSelector from "@/components/InterestsSelector";
import profile1 from "@/assets/profile-1.jpg";

const moodFilters = [
  { id: "chill", label: "Chill", icon: Coffee, color: "text-blue-500" },
  { id: "go-out", label: "Go Out", icon: Zap, color: "text-orange-500" },
  { id: "romantic", label: "Romantic", icon: Heart, color: "text-pink-500" },
  { id: "active", label: "Active", icon: Dumbbell, color: "text-green-500" },
  { id: "creative", label: "Creative", icon: Palette, color: "text-purple-500" },
  { id: "social", label: "Social", icon: Users, color: "text-indigo-500" },
  { id: "music", label: "Music", icon: Music, color: "text-cyan-500" }
];

const EditProfilePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, updateProfile, uploadProfileImage } = useProfile();
  const [showNotifications, setShowNotifications] = useState(false);
  const [profileImage, setProfileImage] = useState(profile1);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    bio: "",
    location: "",
    specialties: [],
    interests: [],
    openToConnecting: true
  });

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setProfileImage(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (field: string, value: string | boolean | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveChanges = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "User not logged in",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      let profileImageUrl = null;

      // Upload image if a new one was selected
      if (selectedImageFile) {
        profileImageUrl = await uploadProfileImage(selectedImageFile);
      }

      // Prepare update data
      const updateData: any = {
        name: formData.name,
        username: formData.username,
        bio: formData.bio,
        location: formData.location,
        specialties: formData.specialties,
        interests: formData.interests,
        open_to_connecting: formData.openToConnecting,
      };

      // Only include profile_image_url if a new image was uploaded
      if (profileImageUrl) {
        updateData.profile_image_url = profileImageUrl;
      }

      await updateProfile(updateData);
      
      toast({
        title: "Changes saved successfully",
        description: "Your profile has been updated",
      });
      
      // Navigate back after successful save
      navigate(-1);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast({
        title: "Error saving changes",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load existing profile data on component mount
  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        username: profile.username || "",
        bio: profile.bio || "",
        location: profile.location || "",
        specialties: profile.specialties || [],
        interests: profile.interests || [],
        openToConnecting: profile.open_to_connecting !== false // Default to true if null/undefined
      });

      if (profile.profile_image_url) {
        setProfileImage(profile.profile_image_url);
      }
    }
  }, [profile]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary-50/30 to-coral-50/30 relative overflow-hidden" dir="ltr">
      {/* Accent decorative elements */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-coral/20 to-tertiary/20 rounded-full -translate-x-16 -translate-y-16 animate-pulse"></div>
      <div className="absolute top-20 right-0 w-24 h-24 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full translate-x-12 animate-pulse delay-1000"></div>
      <div className="absolute bottom-40 left-4 w-20 h-20 bg-gradient-to-br from-tertiary/20 to-coral/20 rounded-full animate-pulse delay-2000"></div>
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white/70 backdrop-blur-sm border-primary-200/30 relative z-10">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate(user ? `/profile/${user.id}` : '/')}
          className="hover:bg-primary-100/50 transition-all"
        >
          <ArrowLeft className="h-5 w-5 text-primary" />
        </Button>
        <h2 className="text-lg font-semibold bg-gradient-to-r from-primary via-coral to-tertiary bg-clip-text text-transparent">Edit Profile</h2>
        <div></div> {/* Empty div for spacing */}
      </div>

      <main className="px-4 py-6 pb-20 relative z-10">
        {/* Page content starts here - title removed since it's now in header */}

        {/* Profile Picture Section */}
        <div className="flex justify-center mb-8 mt-6">
          <div className="relative">
            <div className="w-[108px] h-[108px] rounded-full bg-gradient-to-br from-coral via-tertiary to-primary p-1 shadow-xl">
              <img 
                src={profileImage}
                alt="Profile picture"
                className="w-full h-full rounded-full object-cover bg-white p-1"
              />
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="absolute -bottom-2 -right-2 rounded-full w-10 h-10 p-0 bg-white border-2 border-tertiary/40 hover:bg-tertiary hover:text-white hover:border-tertiary transition-all shadow-lg hover:shadow-tertiary/25"
              onClick={handleImageClick}
            >
              <Camera className="h-4 w-4" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-6 max-w-md mx-auto bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-primary-200/40 shadow-2xl relative overflow-hidden">
          {/* Form accent decorations */}
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-tertiary/10 to-coral/10 rounded-full translate-x-8 -translate-y-8"></div>
          <div className="absolute bottom-4 left-0 w-12 h-12 bg-gradient-to-br from-secondary/10 to-primary/10 rounded-full -translate-x-6"></div>
          
          {/* Name */}
          <div className="relative z-10">
            <label className="block text-sm font-medium text-foreground mb-2">Name</label>
            <Input 
              placeholder="John Doe"
              className="text-left border-primary-200/50 focus:border-tertiary focus:ring-tertiary/20 bg-white/90 shadow-sm"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
            />
          </div>

          {/* Social Page */}
          <div className="relative z-10">
            <label className="block text-sm font-medium text-foreground mb-2">Social Page</label>
            <Input 
              placeholder="https://instagram.com/johndoe"
              className="text-left border-primary-200/50 focus:border-tertiary focus:ring-tertiary/20 bg-white/90 shadow-sm"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
            />
          </div>

          {/* Bio */}
          <div className="relative z-10">
            <label className="block text-sm font-medium text-foreground mb-2">Bio</label>
            <Textarea 
              placeholder="Tell us a little about yourself..."
              className="text-left min-h-[80px] resize-none border-primary-200/50 focus:border-tertiary focus:ring-tertiary/20 bg-white/90 shadow-sm"
              value={formData.bio}
              onChange={(e) => handleInputChange('bio', e.target.value)}
            />
          </div>

          {/* Location */}
          <div className="relative z-10">
            <label className="block text-sm font-medium text-foreground mb-2">Neighborhood</label>
            <Input 
              placeholder="New York City"
              className="text-left border-primary-200/50 focus:border-tertiary focus:ring-tertiary/20 bg-white/90 shadow-sm"
              value={formData.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
            />
          </div>

          {/* Specialties */}
          <div className="relative z-10">
            <label className="block text-sm font-medium text-foreground mb-3">Specialties</label>
            <div className="flex flex-wrap gap-2">
              {formData.specialties.map((specialty, index) => (
                <div key={index} className="flex items-center gap-2 bg-gradient-to-r from-tertiary-100 via-coral-100 to-primary-100 rounded-full px-3 py-1 border border-tertiary-200/50 shadow-sm hover:shadow-md transition-all">
                  <span className="text-sm text-tertiary-700 font-medium">{specialty}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="p-0 h-4 w-4 hover:bg-tertiary-200/50 text-tertiary-600 hover:text-tertiary-700 rounded-full"
                    onClick={() => {
                      const newSpecialties = formData.specialties.filter((_, i) => i !== index);
                      handleInputChange('specialties', newSpecialties);
                    }}
                  >
                    <Plus className="h-3 w-3 rotate-45" />
                  </Button>
                </div>
              ))}
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-full px-3 py-1 h-7 border-tertiary/40 text-tertiary hover:bg-gradient-to-r hover:from-tertiary hover:to-coral hover:text-white hover:border-tertiary transition-all shadow-sm hover:shadow-md"
                onClick={() => {
                  const newSpecialty = prompt('Add specialty:');
                  if (newSpecialty?.trim()) {
                    const newSpecialties = [...formData.specialties, newSpecialty.trim()];
                    handleInputChange('specialties', newSpecialties);
                  }
                }}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>
          </div>

          {/* Interests */}
          <div className="relative z-10">
            <label className="block text-sm font-medium text-foreground mb-3">Interests</label>
            <InterestsSelector
              selectedInterests={formData.interests}
              onChange={(interests) => handleInputChange('interests', interests)}
              maxInterests={5}
            />
          </div>

          {/* Connection Settings */}
          <div className="space-y-4 pt-4 border-t border-tertiary-200/40 relative z-10">
            <h3 className="text-lg font-semibold bg-gradient-to-r from-secondary via-tertiary to-primary bg-clip-text text-transparent">Connection Settings</h3>
            
            <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-tertiary-50 via-primary-50 to-coral-50 border border-tertiary-200/40 shadow-sm hover:shadow-md transition-all">
              <span className="text-sm font-medium text-tertiary-700">Open to Connecting</span>
              <button 
                onClick={() => handleInputChange('openToConnecting', !formData.openToConnecting)}
                className={`w-12 h-6 rounded-full relative transition-all shadow-inner ${formData.openToConnecting ? 'bg-gradient-to-r from-tertiary via-coral to-primary' : 'bg-neutral-200'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-lg transition-transform ${formData.openToConnecting ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
              </button>
            </div>
          </div>

          {/* Save Button */}
          <Button 
            className="w-full mt-8 h-12 text-base font-medium bg-gradient-to-r from-tertiary via-coral to-primary hover:from-tertiary-600 hover:via-coral-600 hover:to-primary-600 text-white shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 relative z-10"
            onClick={handleSaveChanges}
            disabled={isLoading}
          >
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
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

export default EditProfilePage;