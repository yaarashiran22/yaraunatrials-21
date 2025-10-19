import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Camera, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import BottomNavigation from "@/components/BottomNavigation";
import NotificationsPopup from "@/components/NotificationsPopup";

const EditProfilePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, updateProfile, uploadProfileImage } = useProfile();
  const [showNotifications, setShowNotifications] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    bio: "",
    location: "",
    instagram: "",
    facebook: "",
    tiktok: "",
    linkedin: ""
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

  const handleInputChange = (field: string, value: string) => {
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
        bio: formData.bio,
        location: formData.location,
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
      
      let errorMessage = "Please try again later";
      if (error.code === "23505" && error.message.includes("username")) {
        errorMessage = "This username is already taken. Please choose a different one.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error saving changes",
        description: errorMessage,
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
        bio: profile.bio || "",
        location: profile.location || "",
        instagram: "",
        facebook: "",
        tiktok: "",
        linkedin: ""
      });

      if (profile.profile_image_url) {
        // Add cache-busting to prevent stale images
        const imageUrl = profile.profile_image_url.includes('?') 
          ? profile.profile_image_url 
          : `${profile.profile_image_url}?t=${Date.now()}`;
        setProfileImage(imageUrl);
      } else {
        setProfileImage(null);
      }
    }
  }, [profile]);

  return (
    <div className="min-h-screen bg-white pb-20" dir="ltr">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate(user ? `/profile/${user.id}` : '/')}
          className="text-black hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold text-black">Edit Profile</h2>
        <div></div>
      </div>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          {/* Profile Picture Section */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border-2 border-gray-200">
                {profileImage ? (
                  <img 
                    src={profileImage}
                    alt="Profile picture"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 text-gray-400" />
                )}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="absolute -bottom-2 -right-2 rounded-full w-10 h-10 p-0 bg-white border-gray-300 hover:bg-gray-50"
                onClick={handleImageClick}
              >
                <Camera className="h-4 w-4 text-black" />
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

          {/* Form Container */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-black mb-2">Name</label>
                <Input 
                  placeholder="Name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full h-12 text-left bg-white border border-gray-300 rounded-lg text-black placeholder:text-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-2">Neighborhood</label>
                <Input 
                  placeholder="Neighborhood"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  className="w-full h-12 text-left bg-white border border-gray-300 rounded-lg text-black placeholder:text-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-2">Bio</label>
                <Textarea 
                  placeholder="Short Bio"
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  className="w-full min-h-[80px] text-left bg-white border border-gray-300 rounded-lg resize-none text-black placeholder:text-gray-400"
                />
              </div>
            </div>
          </div>

          {/* Social Networks Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-black mb-4 text-center">Social Networks</h2>
            <div className="space-y-4">
              <div>
                <Input 
                  placeholder="Instagram @"
                  value={formData.instagram}
                  onChange={(e) => handleInputChange('instagram', e.target.value)}
                  className="w-full h-12 text-left bg-white border border-gray-300 rounded-lg text-black placeholder:text-gray-400"
                />
              </div>
              
              <div>
                <Input 
                  placeholder="Facebook"
                  value={formData.facebook}
                  onChange={(e) => handleInputChange('facebook', e.target.value)}
                  className="w-full h-12 text-left bg-white border border-gray-300 rounded-lg text-black placeholder:text-gray-400"
                />
              </div>
              
              <div>
                <Input 
                  placeholder="TikTok @"
                  value={formData.tiktok}
                  onChange={(e) => handleInputChange('tiktok', e.target.value)}
                  className="w-full h-12 text-left bg-white border border-gray-300 rounded-lg text-black placeholder:text-gray-400"
                />
              </div>
              
              <div>
                <Input 
                  placeholder="LinkedIn"
                  value={formData.linkedin}
                  onChange={(e) => handleInputChange('linkedin', e.target.value)}
                  className="w-full h-12 text-left bg-white border border-gray-300 rounded-lg text-black placeholder:text-gray-400"
                />
              </div>
            </div>
            
            {/* Save Button */}
            <div className="mt-6">
              <Button 
                onClick={handleSaveChanges}
                disabled={isLoading}
                className="w-full h-12 text-white text-lg font-medium rounded-lg"
                style={{ backgroundColor: '#BB31E9' }}
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
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

export default EditProfilePage;