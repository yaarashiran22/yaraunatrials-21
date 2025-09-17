import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export interface NeighborhoodIdea {
  id: string;
  user_id: string;
  question: string;
  image_url: string;
  neighborhood: string;
  market: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    name: string | null;
    profile_image_url?: string | null;
  } | null;
  votes?: {
    agree: number;
    disagree: number;
    user_vote?: string | null;
  };
}

export interface IdeaVote {
  id: string;
  user_id: string;
  idea_id: string;
  vote: string;
  created_at: string;
}

export const useNeighborhoodIdeas = () => {
  const [ideas, setIdeas] = useState<NeighborhoodIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchIdeas = async () => {
    try {
      setLoading(true);
      
      // Fetch ideas with user profiles
      const { data: ideasData, error: ideasError } = await supabase
        .from('neighborhood_ideas')
        .select(`
          *,
          profiles:user_id (
            name,
            profile_image_url
          )
        `)
        .eq('market', 'argentina')
        .order('created_at', { ascending: false });

      if (ideasError) {
        console.error('Error fetching ideas:', ideasError);
        return;
      }

      // Fetch all votes for these ideas
      const ideaIds = ideasData?.map(idea => idea.id) || [];
      const { data: votesData, error: votesError } = await supabase
        .from('idea_votes')
        .select('*')
        .in('idea_id', ideaIds);

      if (votesError) {
        console.error('Error fetching votes:', votesError);
        return;
      }

      // Process votes and attach to ideas
      const ideasWithVotes = ideasData?.map(idea => {
        const ideaVotes = votesData?.filter(vote => vote.idea_id === idea.id) || [];
        const agreeVotes = ideaVotes.filter(vote => vote.vote === 'agree').length;
        const disagreeVotes = ideaVotes.filter(vote => vote.vote === 'disagree').length;
        const userVote = user ? ideaVotes.find(vote => vote.user_id === user.id)?.vote : null;

        return {
          ...idea,
          image_url: idea.image_url || '', // Ensure image_url is always present
          profiles: Array.isArray(idea.profiles) ? idea.profiles[0] : idea.profiles,
          votes: {
            agree: agreeVotes,
            disagree: disagreeVotes,
            user_vote: userVote
          }
        } as NeighborhoodIdea;
      }) || [];

      setIdeas(ideasWithVotes);
    } catch (error) {
      console.error('Unexpected error fetching ideas:', error);
    } finally {
      setLoading(false);
    }
  };

  const createIdea = async (question: string, imageUrl: string, neighborhood: string) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You need to be logged in to post an idea",
        variant: "destructive"
      });
      return false;
    }

    try {
      const { data, error } = await supabase
        .from('neighborhood_ideas')
        .insert([{
          user_id: user.id,
          question,
          image_url: imageUrl,
          neighborhood,
          market: 'argentina'
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating idea:', error);
        toast({
          title: "Error",
          description: "Unable to post the idea",
          variant: "destructive"
        });
        return false;
      }

      toast({
        title: "הרעיון פורסם בהצלחה!"
      });

      // Refresh ideas
      await fetchIdeas();
      return true;
    } catch (error) {
      console.error('Unexpected error creating idea:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
      return false;
    }
  };

  const voteOnIdea = async (ideaId: string, vote: boolean) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You need to be logged in to vote",
        variant: "destructive"
      });
      return false;
    }

    try {
      // Check if user already voted
      const { data: existingVote } = await supabase
        .from('idea_votes')
        .select('*')
        .eq('user_id', user.id)
        .eq('idea_id', ideaId)
        .single();

      if (existingVote) {
        // Update existing vote
        const { error } = await supabase
          .from('idea_votes')
          .update({ vote: vote ? 'agree' : 'disagree' })
          .eq('id', existingVote.id);

        if (error) {
          console.error('Error updating vote:', error);
          return false;
        }
      } else {
        // Create new vote
        const { error } = await supabase
          .from('idea_votes')
          .insert([{
            user_id: user.id,
            idea_id: ideaId,
            vote: vote ? 'agree' : 'disagree'
          }]);

        if (error) {
          console.error('Error creating vote:', error);
          return false;
        }
      }

      // Refresh ideas to update vote counts
      await fetchIdeas();
      return true;
    } catch (error) {
      console.error('Unexpected error voting:', error);
      return false;
    }
  };

  const deleteIdea = async (ideaId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('neighborhood_ideas')
        .delete()
        .eq('id', ideaId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting idea:', error);
        return false;
      }

      toast({
        title: "הרעיון נמחק בהצלחה"
      });

      // Refresh ideas
      await fetchIdeas();
      return true;
    } catch (error) {
      console.error('Unexpected error deleting idea:', error);
      return false;
    }
  };

  useEffect(() => {
    fetchIdeas();
  }, [user]);

  return {
    ideas,
    loading,
    createIdea,
    voteOnIdea,
    deleteIdea,
    refreshIdeas: fetchIdeas
  };
};