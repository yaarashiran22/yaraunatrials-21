import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface NeighborQuestionComment {
  id: string;
  question_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface CreateCommentData {
  question_id: string;
  content: string;
}

export const useNeighborQuestionComments = (questionId?: string) => {
  const [comments, setComments] = useState<NeighborQuestionComment[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchCommentCount = async (qId: string) => {
    try {
      const { count, error } = await supabase
        .from('neighbor_question_comments' as any)
        .select('*', { count: 'exact', head: true })
        .eq('question_id', qId);

      if (error) {
        console.error('Error fetching comment count:', error);
      } else {
        setCommentCount(count || 0);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    }
  };

  const fetchComments = async (qId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('neighbor_question_comments' as any)
        .select('*')
        .eq('question_id', qId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching comments:', error);
        toast({
          title: "Error",
          description: "Error loading comments",
          variant: "destructive",
        });
      } else {
        setComments((data as any) || []);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      toast({
        title: "Error",
        description: "Error loading comments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createComment = async (commentData: CreateCommentData) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You need to log in to comment",
        variant: "destructive",
      });
      return false;
    }

    try {
      setCreating(true);
      
      const { data, error } = await supabase
        .from('neighbor_question_comments' as any)
        .insert([
          {
            question_id: commentData.question_id,
            user_id: user.id,
            content: commentData.content,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Error creating comment:', error);
        toast({
          title: "Error",
          description: "Error posting comment",
          variant: "destructive",
        });
        return false;
      } else {
        toast({
          title: "הצלחה",
          description: "התגובה פורסמה בהצלחה",
        });
        
        // Add the new comment to the list
        setComments(prev => [...prev, data as any]);
        // Update comment count
        setCommentCount(prev => prev + 1);
        return true;
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      toast({
        title: "Error",
        description: "Error posting comment",
        variant: "destructive",
      });
      return false;
    } finally {
      setCreating(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You need to log in to delete comment",
        variant: "destructive",
      });
      return false;
    }

    try {
      const { error } = await supabase
        .from('neighbor_question_comments' as any)
        .delete()
        .eq('id', commentId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting comment:', error);
        toast({
          title: "Error",
          description: "Error deleting comment",
          variant: "destructive",
        });
        return false;
      } else {
        toast({
          title: "הצלחה",
          description: "התגובה נמחקה בהצלחה",
        });
        
        // Remove the comment from the list
        setComments(prev => prev.filter(c => c.id !== commentId));
        // Update comment count
        setCommentCount(prev => Math.max(0, prev - 1));
        return true;
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      toast({
        title: "Error",
        description: "Error deleting comment",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    if (questionId) {
      fetchCommentCount(questionId);
    }
  }, [questionId]);

  return {
    comments,
    commentCount,
    loading,
    creating,
    fetchComments,
    fetchCommentCount,
    createComment,
    deleteComment,
  };
};