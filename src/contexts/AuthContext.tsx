import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import { toast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name?: string, mobileNumber?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  signInAnonymously: () => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  // Backward compatibility
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Session error:', error);
      }
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      
      // Handle authentication events for better UX
      if (event === 'SIGNED_OUT') {
        // Clear any cached data on signout
        setSession(null);
        setUser(null);
      }
      
      // Handle token refresh failure - sign out user
      if (event === 'TOKEN_REFRESHED' && !session) {
        console.log('Token refresh failed, signing out user');
        setSession(null);
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) {
        console.error('Sign in error:', error);
        toast({
          title: "שגיאת התחברות",
          description: error.message || "שגיאה בהתחברות",
          variant: "destructive",
        });
      }

      return { error };
    } catch (error) {
      console.error('Sign in error:', error);
      return { error };
    }
  };

  const signUp = async (email: string, password: string, name?: string, mobileNumber?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { 
          name: name || '',
          mobile_number: mobileNumber || ''
        }
      }
    });
    return { error };
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      
      // Clear localStorage first to prevent any token issues
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          localStorage.removeItem(key);
        }
      });
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error);
        toast({
          title: "שגיאה",
          description: "בעיה בהתנתקות מהמערכת",
          variant: "destructive",
        });
        throw error;
      }
      
      // Force clear state
      setSession(null);
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signInAnonymously = async () => {
    const { data, error } = await supabase.auth.signInAnonymously();
    return { error };
  };

  const resetPassword = async (email: string) => {
    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        console.error('Password reset error:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to send reset email",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Password Reset Email Sent",
          description: "Check your email for a link to reset your password",
          variant: "default",
        });
      }

      return { error };
    } catch (error) {
      console.error('Password reset error:', error);
      return { error };
    }
  };

  // Backward compatibility methods
  const login = async (email: string, password: string): Promise<boolean> => {
    const { error } = await signIn(email, password);
    return !error;
  };

  const logout = () => {
    signOut();
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      signIn,
      signUp,
      signOut,
      signInAnonymously,
      resetPassword,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};