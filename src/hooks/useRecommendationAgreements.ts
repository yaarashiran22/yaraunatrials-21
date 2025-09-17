import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export const useRecommendationAgreements = (recommendationId: string) => {
  const [agreementCount, setAgreementCount] = useState(0);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // Fetch agreement count and user's agreement status
  const fetchAgreements = async () => {
    if (!recommendationId) return;

    try {
      // Get total count
      const { count } = await supabase
        .from('recommendation_agreements')
        .select('*', { count: 'exact', head: true })
        .eq('recommendation_id', recommendationId);

      setAgreementCount(count || 0);

      // Check if current user has agreed
      if (user) {
        const { data } = await supabase
          .from('recommendation_agreements')
          .select('id')
          .eq('recommendation_id', recommendationId)
          .eq('user_id', user.id)
          .maybeSingle();

        setHasAgreed(!!data);
      }
    } catch (error) {
      console.error('Error fetching agreements:', error);
    }
  };

  // Toggle agreement
  const toggleAgreement = async () => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "You need to log in to agree with recommendations",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      if (hasAgreed) {
        // Remove agreement
        await supabase
          .from('recommendation_agreements')
          .delete()
          .eq('recommendation_id', recommendationId)
          .eq('user_id', user.id);

        setHasAgreed(false);
        setAgreementCount(prev => Math.max(0, prev - 1));
      } else {
        // Add agreement
        await supabase
          .from('recommendation_agreements')
          .insert({
            recommendation_id: recommendationId,
            user_id: user.id,
            agreement_type: 'agree'
          });

        setHasAgreed(true);
        setAgreementCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error toggling agreement:', error);
      toast({
        title: "Error",
        description: "Unable to update agreement",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgreements();
  }, [recommendationId, user]);

  return {
    agreementCount,
    hasAgreed,
    loading,
    toggleAgreement
  };
};