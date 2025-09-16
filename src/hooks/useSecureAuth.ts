import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { validateUUID, checkRateLimit } from '@/utils/security';

export const useSecureAuth = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  // Enhanced authentication check
  const requireAuth = (redirectTo = '/login') => {
    if (isLoading) return false;
    
    if (!user) {
      toast({
        title: "Login Required",
        description: "You need to log in to perform this action",
        variant: "destructive",
      });
      navigate(redirectTo);
      return false;
    }
    return true;
  };

  // Check if user can perform action with rate limiting
  const canPerformAction = (action: string, maxRequests = 5, windowMs = 60000): boolean => {
    if (!user) return false;
    
    const allowed = checkRateLimit(user.id, action, maxRequests, windowMs);
    if (!allowed) {
      toast({
        title: "Too Many Requests",
        description: "Please wait a moment before performing this action again",
        variant: "destructive",
      });
    }
    return allowed;
  };

  // Validate user access to resource
  const canAccessResource = (resourceUserId: string): boolean => {
    if (!user) return false;
    
    if (!validateUUID(resourceUserId)) {
      toast({
        title: "Error",
        description: "Invalid user ID",
        variant: "destructive",
      });
      return false;
    }
    
    return user.id === resourceUserId;
  };

  // Check if anonymous user (for restrictions)
  const isAnonymousUser = (): boolean => {
    return user?.is_anonymous === true;
  };

  // Get user session info for security logging
  const getUserInfo = () => {
    if (!user) return null;
    
    return {
      id: user.id,
      email: user.email,
      isAnonymous: user.is_anonymous,
      lastSignIn: user.last_sign_in_at,
    };
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    requireAuth,
    canPerformAction,
    canAccessResource,
    isAnonymousUser,
    getUserInfo,
  };
};