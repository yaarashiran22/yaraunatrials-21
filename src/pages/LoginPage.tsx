
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Paperclip, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import InterestsSelector from "@/components/InterestsSelector";

const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const { signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Sign up form data
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    neighborhood: '',
    age: '',
    origin: '',
    profileType: 'personal',
    whatsappNumber: '',
    instagram: ''
  });
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { error } = await resetPassword(resetEmail);
      
      if (!error) {
        setShowForgotPassword(false);
        setResetEmail("");
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
    if (!formData.name.trim() || !formData.email.trim() || !formData.password.trim() || !formData.age || !formData.origin) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (formData.profileType === 'business' && !formData.whatsappNumber.trim()) {
      toast({
        title: "Error",
        description: "Business profiles must provide a WhatsApp number",
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
          age: parseInt(formData.age),
          origin: formData.origin,
          profile_type: formData.profileType,
          whatsapp_number: formData.profileType === 'business' ? formData.whatsappNumber : null,
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
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
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
          <div className="text-center mb-16">
          <div className="flex items-center justify-center cursor-pointer" onClick={() => navigate('/')}>
              <div 
                className="text-4xl font-black cursor-pointer hover:opacity-80 transition-opacity"
                style={{ 
                  background: 'linear-gradient(90deg, hsl(310 82% 52%), hsl(276 83% 58%))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  fontFamily: 'Poppins, -apple-system, BlinkMacSystemFont, sans-serif',
                  fontWeight: 700,
                  textTransform: 'lowercase',
                  letterSpacing: '-0.03em'
                }}
              >
                Yara AI
              </div>
            </div>
            
            <p className="text-lg font-bold mt-3 mb-6 tracking-wide drop-shadow-sm"
               style={{
                 background: 'linear-gradient(90deg, hsl(310 82% 52%), hsl(276 83% 58%))',
                 WebkitBackgroundClip: 'text',
                 WebkitTextFillColor: 'transparent',
                 backgroundClip: 'text'
               }}>
              Everything Worth Knowing
            </p>
            
          </div>

          {/* Form */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-white/20">
            <h1 
              className="text-xl text-center mb-6"
              style={{ 
                background: 'linear-gradient(90deg, hsl(310 82% 52%), hsl(276 83% 58%))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
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
                  className="w-full h-12 text-left text-white bg-white/10 border-white/20 focus:border-coral focus:ring-coral/20 rounded-lg placeholder:text-white/60"
                  required
                />
              </div>

              <div>
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 text-left text-white bg-white/10 border-white/20 focus:border-coral focus:ring-coral/20 rounded-lg placeholder:text-white/60"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 border-0"
                style={{
                  background: 'linear-gradient(90deg, hsl(310 82% 52%), hsl(276 83% 58%))'
                }}
                disabled={isLoading}
              >
                {isLoading ? 'Logging in...' : 'Login'}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm hover:opacity-80 transition-opacity"
                style={{
                  background: 'linear-gradient(90deg, hsl(310 82% 62%), hsl(276 83% 68%))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}
              >
                Forgot your password?
              </button>
            </div>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(false)}
                className="font-medium hover:opacity-80 transition-opacity"
                style={{
                  background: 'linear-gradient(90deg, hsl(310 82% 52%), hsl(276 83% 58%))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}
              >
                Don't have an account? Sign up
              </button>
            </div>

            {/* Forgot Password Modal */}
            {showForgotPassword && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-foreground">Reset Password</h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowForgotPassword(false)}
                      className="p-1"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Enter your email address and we'll send you a link to reset your password.
                      </p>
                      <Input
                        type="email"
                        placeholder="Email address"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="w-full h-12 text-black bg-white border-primary-200/40 focus:border-primary focus:ring-primary/20 rounded-lg"
                        required
                      />
                    </div>
                    
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowForgotPassword(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="flex-1 bg-gradient-to-r from-primary to-coral hover:from-primary-600 hover:to-coral-600 text-white"
                      >
                        {isLoading ? 'Sending...' : 'Send Reset Link'}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Sign up form
  return (
    <div className="min-h-screen bg-black pb-20">
      {/* Header with X button */}
      <div className="flex justify-end items-center pt-4 px-4">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setIsLogin(true)}
          className="p-2 hover:bg-coral-100/50 text-coral transition-all"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <main className="container mx-auto px-4">
        {/* Page Title */}
        <div className="text-center mb-6 mt-8">
          <h1 className="text-3xl font-bold mb-3"
              style={{
                background: 'linear-gradient(90deg, hsl(310 82% 52%), hsl(276 83% 58%))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>Sign Up</h1>
          <p className="text-white/80 text-sm max-w-md mx-auto px-4">
            Welcome to Yara AI- your personal concierge for finding indie events, exclusive deals and bohemian spots in your city.
          </p>
        </div>

        <div className="max-w-md mx-auto">
          {/* Form Container */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-6 border border-white/20">
            <div className="space-y-4">
              <div>
                <Input 
                  placeholder="Name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full h-12 text-left text-black bg-white border-white/20 focus:border-coral focus:ring-coral/20 rounded-lg placeholder:text-gray-500"
                />
              </div>
              
              <div>
                <Input 
                  placeholder="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full h-12 text-left text-black bg-white border-white/20 focus:border-coral focus:ring-coral/20 rounded-lg placeholder:text-gray-500"
                />
              </div>
              
              <div>
                <Input 
                  placeholder="Password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className="w-full h-12 text-left text-black bg-white border-white/20 focus:border-coral focus:ring-coral/20 rounded-lg placeholder:text-gray-500"
                />
              </div>

              <div>
                <Input 
                  placeholder="Confirm Password"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  className="w-full h-12 text-left text-black bg-white border-white/20 focus:border-coral focus:ring-coral/20 rounded-lg placeholder:text-gray-500"
                />
              </div>
              
              <div>
                <Input 
                  placeholder="Neighborhood"
                  value={formData.neighborhood}
                  onChange={(e) => handleInputChange('neighborhood', e.target.value)}
                  className="w-full h-12 text-left text-black bg-white border-white/20 focus:border-coral focus:ring-coral/20 rounded-lg placeholder:text-gray-500"
                />
              </div>
              
              <div>
                <Input 
                  type="number"
                  placeholder="Age"
                  value={formData.age}
                  onChange={(e) => handleInputChange('age', e.target.value)}
                  className="w-full h-12 text-left text-black bg-white border-white/20 focus:border-coral focus:ring-coral/20 rounded-lg placeholder:text-gray-500"
                  required
                />
              </div>

              <div>
                <select
                  value={formData.origin}
                  onChange={(e) => handleInputChange('origin', e.target.value)}
                  className="w-full h-12 text-left text-black bg-white border border-white/20 focus:border-coral focus:ring-coral/20 rounded-lg px-3 py-2"
                  required
                >
                  <option value="">Where I'm from</option>
                  <option value="Argentina">Argentina</option>
                  <option value="Abroad">Abroad</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-white text-sm font-medium">Profile Type</label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => handleInputChange('profileType', 'personal')}
                    className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                      formData.profileType === 'personal'
                        ? 'border-[hsl(310,82%,52%)] bg-[hsl(310,82%,52%)]/10 text-white'
                        : 'border-white/20 bg-white/5 text-white/60'
                    }`}
                  >
                    Personal
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInputChange('profileType', 'business')}
                    className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                      formData.profileType === 'business'
                        ? 'border-[hsl(310,82%,52%)] bg-[hsl(310,82%,52%)]/10 text-white'
                        : 'border-white/20 bg-white/5 text-white/60'
                    }`}
                  >
                    Business
                  </button>
                </div>
              </div>

              {formData.profileType === 'business' && (
                <div>
                  <Input 
                    type="tel"
                    placeholder="WhatsApp Number (for internal use only)"
                    value={formData.whatsappNumber}
                    onChange={(e) => handleInputChange('whatsappNumber', e.target.value)}
                    className="w-full h-12 text-left text-black bg-white border-white/20 focus:border-coral focus:ring-coral/20 rounded-lg placeholder:text-gray-500"
                    required
                  />
                </div>
              )}
              
              <div>
                <Input 
                  placeholder="Instagram (link to profile)"
                  value={formData.instagram}
                  onChange={(e) => handleInputChange('instagram', e.target.value)}
                  className="w-full h-12 text-left text-black bg-white border-white/20 focus:border-coral focus:ring-coral/20 rounded-lg placeholder:text-gray-500"
                />
              </div>
            </div>

            {/* Interests Section */}
            <div className="pt-6">
              <InterestsSelector
                selectedInterests={selectedInterests}
                onChange={setSelectedInterests}
                maxInterests={5}
              />
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
                    <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center overflow-hidden border-2 border-dashed border-white/40 hover:border-white/60 transition-all shadow-sm hover:shadow-md">
                      {profileImage ? (
                        <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center">
                          <Paperclip className="h-6 w-6 text-white mx-auto" />
                          <span className="text-xs text-white mt-1 block">Upload</span>
                        </div>
                    )}
                  </div>
                </label>
                <div>
                  <span className="text-white font-medium">Profile Picture</span>
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
              className="font-medium hover:opacity-80 transition-opacity"
              style={{
                background: 'linear-gradient(90deg, hsl(310 82% 52%), hsl(276 83% 58%))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
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
