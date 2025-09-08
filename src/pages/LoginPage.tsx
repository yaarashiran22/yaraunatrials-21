
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Paperclip, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Sign up form data
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    neighborhood: '',
    bio: '',
    instagram: ''
  });
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

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success!",
          description: "Logged in successfully",
        });
        navigate('/');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUpSubmit = async () => {
    if (!formData.name.trim() || !formData.email.trim() || !formData.password.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields (name, email and password)",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Register the user
      const { error: signUpError } = await signUp(formData.email, formData.password, formData.name, '');
      
      if (signUpError) {
        console.error('Sign up error:', signUpError);
        toast({
          title: "Registration Error",
          description: signUpError.message || "Unable to register",
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
          is_private: false
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
        title: "Registration completed successfully!",
        description: "Your profile has been created and will appear on the home page",
        variant: "default",
      });

      // Navigate to home page
      navigate('/');
      
    } catch (error) {
      console.error('Registration error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLogin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary-50/30 to-coral-50/30 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* Header with X button */}
          <div className="flex justify-end mb-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/')}
              className="p-2 hover:bg-primary-100/50 text-primary transition-all"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Logo */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center cursor-pointer" onClick={() => navigate('/')}>
              <div 
                className="text-5xl font-black cursor-pointer hover:opacity-80 transition-opacity"
                style={{ 
                  color: 'hsl(var(--primary))', 
                  fontFamily: 'Poppins, -apple-system, BlinkMacSystemFont, sans-serif',
                  fontWeight: 700,
                  textTransform: 'lowercase',
                  letterSpacing: '-0.03em'
                }}
              >
                una
              </div>
            </div>
            
            <p className="text-sm font-medium mt-2 mb-6" style={{ color: 'hsl(var(--coral))' }}>
              Everything Worth Knowing
            </p>
            
          </div>

          {/* Form */}
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-primary-200/30">
            <h1 
              className="text-xl text-center mb-6 bg-gradient-to-r from-primary to-coral bg-clip-text text-transparent"
              style={{ 
                fontFamily: 'Poppins, -apple-system, BlinkMacSystemFont, sans-serif',
                fontWeight: 700,
                letterSpacing: '-0.03em'
              }}
            >
              Login
            </h1>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 text-left bg-white/80 border-primary-200/40 focus:border-primary focus:ring-primary/20 rounded-lg"
                  required
                />
              </div>

              <div>
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 text-left bg-white/80 border-primary-200/40 focus:border-primary focus:ring-primary/20 rounded-lg"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-primary to-coral hover:from-primary-600 hover:to-coral-600 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
                disabled={isLoading}
              >
                {isLoading ? 'Logging in...' : 'Login'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(false)}
                className="text-primary hover:text-coral font-medium transition-colors"
              >
                Don't have an account? Sign up
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Sign up form
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-coral-50/30 to-primary-50/30 pb-20">
      {/* Header with X button */}
      <div className="flex justify-between items-center pt-4 px-4">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setIsLogin(true)}
          className="p-2 hover:bg-coral-100/50 text-coral transition-all"
        >
          <X className="h-5 w-5" />
        </Button>
        <div></div> {/* Spacer for centering */}
      </div>

      {/* Logo */}
      <div className="text-center pt-4 pb-6">
        <div className="flex items-center justify-center cursor-pointer" onClick={() => navigate('/')}>
          <div 
            className="text-5xl font-black cursor-pointer hover:opacity-80 transition-opacity"
            style={{ 
              color: 'hsl(var(--coral))', 
              fontFamily: 'Poppins, -apple-system, BlinkMacSystemFont, sans-serif',
              fontWeight: 700,
              textTransform: 'lowercase',
              letterSpacing: '-0.03em'
            }}
          >
            una
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4">
        {/* Page Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Sign Up</h1>
        </div>

        <div className="max-w-md mx-auto">
          {/* Form Container */}
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-6 border border-coral-200/30">
            <div className="space-y-4">
              <div>
                <Input 
                  placeholder="Name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full h-12 text-left bg-white/80 border-coral-200/40 focus:border-coral focus:ring-coral/20 rounded-lg"
                />
              </div>
              
              <div>
                <Input 
                  placeholder="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full h-12 text-left bg-white/80 border-coral-200/40 focus:border-coral focus:ring-coral/20 rounded-lg"
                />
              </div>
              
              <div>
                <Input 
                  placeholder="Password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className="w-full h-12 text-left bg-white/80 border-coral-200/40 focus:border-coral focus:ring-coral/20 rounded-lg"
                />
              </div>
              
              <div>
                <Input 
                  placeholder="Neighborhood"
                  value={formData.neighborhood}
                  onChange={(e) => handleInputChange('neighborhood', e.target.value)}
                  className="w-full h-12 text-left bg-white/80 border-coral-200/40 focus:border-coral focus:ring-coral/20 rounded-lg"
                />
              </div>
              
              <div>
                <Input 
                  placeholder="Short Bio"
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  className="w-full h-12 text-left bg-white/80 border-coral-200/40 focus:border-coral focus:ring-coral/20 rounded-lg"
                />
              </div>
              
              <div>
                <Input 
                  placeholder="Instagram (link to profile)"
                  value={formData.instagram}
                  onChange={(e) => handleInputChange('instagram', e.target.value)}
                  className="w-full h-12 text-left bg-white/80 border-coral-200/40 focus:border-coral focus:ring-coral/20 rounded-lg"
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
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-coral-100 to-primary-100 flex items-center justify-center overflow-hidden border-2 border-dashed border-coral/40 hover:border-coral transition-all shadow-sm hover:shadow-md">
                    {profileImage ? (
                      <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center">
                        <Paperclip className="h-6 w-6 text-coral mx-auto" />
                        <span className="text-xs text-coral mt-1 block">Upload</span>
                      </div>
                    )}
                  </div>
                </label>
                <div>
                  <span className="text-foreground font-medium bg-gradient-to-r from-coral to-primary bg-clip-text text-transparent">Profile Picture</span>
                  <p className="text-sm text-muted-foreground">Click to upload your profile photo</p>
                </div>
              </div>
            </div>
            {/* Submit Button */}
            <div className="mt-6">
              <Button 
                onClick={handleSignUpSubmit}
                disabled={isLoading}
                className="w-full h-12 text-white text-lg font-medium rounded-lg bg-gradient-to-r from-coral to-primary hover:from-coral-600 hover:to-primary-600 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
              >
                {isLoading ? 'Registering...' : 'Sign Up'}
              </Button>
            </div>

            {/* Switch to Login */}
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(true)}
                className="text-coral hover:text-primary font-medium transition-colors"
              >
                Already have an account? Login
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
