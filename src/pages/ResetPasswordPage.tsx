import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ResetPasswordPage = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to update password",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Your password has been updated successfully",
          variant: "default",
        });
        navigate('/login');
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
          
          <p className="text-lg font-playfair font-medium mt-2 mb-6 italic bg-gradient-to-r from-coral via-primary to-coral bg-clip-text text-transparent tracking-wide">
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
            Reset Password
          </h1>

          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div>
              <Input
                type="password"
                placeholder="New Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 text-left bg-white/80 border-primary-200/40 focus:border-primary focus:ring-primary/20 rounded-lg"
                required
                minLength={6}
              />
            </div>

            <div>
              <Input
                type="password"
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full h-12 text-left bg-white/80 border-primary-200/40 focus:border-primary focus:ring-primary/20 rounded-lg"
                required
                minLength={6}
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-primary to-coral hover:from-primary-600 hover:to-coral-600 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
              disabled={isLoading}
            >
              {isLoading ? 'Updating Password...' : 'Update Password'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-primary hover:text-coral font-medium transition-colors"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;