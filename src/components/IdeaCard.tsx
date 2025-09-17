import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, ThumbsDown, Trash2, MapPin } from 'lucide-react';
import { NeighborhoodIdea } from '@/hooks/useNeighborhoodIdeas';
import { useAuth } from '@/contexts/AuthContext';

interface IdeaCardProps {
  idea: NeighborhoodIdea;
  onVote: (ideaId: string, vote: boolean) => Promise<boolean>;
  onDelete?: (ideaId: string) => Promise<boolean>;
}

const IdeaCard = ({ idea, onVote, onDelete }: IdeaCardProps) => {
  const { user } = useAuth();
  const isOwner = user?.id === idea.user_id;
  const userVote = idea.votes?.user_vote;
  const agreeCount = idea.votes?.agree || 0;
  const disagreeCount = idea.votes?.disagree || 0;
  const totalVotes = agreeCount + disagreeCount;

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'עכשיו';
    if (diffInMinutes < 60) return `לפני ${diffInMinutes} דקות`;
    if (diffInMinutes < 1440) return `לפני ${Math.floor(diffInMinutes / 60)} שעות`;
    return `לפני ${Math.floor(diffInMinutes / 1440)} ימים`;
  };

  const handleVote = async (vote: boolean) => {
    await onVote(idea.id, vote);
  };

  const handleDelete = async () => {
    if (onDelete && window.confirm('האם אתה בטוח שברצונך למחוק את הרעיון?')) {
      await onDelete(idea.id);
    }
  };

  const getVotePercentage = (voteCount: number) => {
    if (totalVotes === 0) return 0;
    return Math.round((voteCount / totalVotes) * 100);
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="p-4 pb-3">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={idea.profiles?.profile_image_url || undefined} />
              <AvatarFallback>{idea.profiles?.name?.[0] || 'A'}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{idea.profiles?.name || 'אנונימי'}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatTimeAgo(idea.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{idea.neighborhood}</span>
                  </div>
                </div>
                {isOwner && onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Question */}
        <div className="px-4 pb-3">
          <p className="text-sm leading-relaxed">{idea.question}</p>
        </div>

        {/* Image */}
        <div className="relative">
          <img
            src={idea.image_url}
            alt="תמונת רעיון"
            className="w-full h-64 object-cover"
          />
        </div>

        {/* Voting Section */}
        <div className="p-4">
          {/* Vote Buttons */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={userVote === 'agree' ? "default" : "outline"}
              size="sm"
              onClick={() => handleVote(true)}
              className="flex-1 gap-2"
              disabled={!user}
            >
              <ThumbsUp className="h-4 w-4" />
              בעד ({agreeCount})
            </Button>
            <Button
              variant={userVote === 'disagree' ? "default" : "outline"}
              size="sm"
              onClick={() => handleVote(false)}
              className="flex-1 gap-2"
              disabled={!user}
            >
              <ThumbsDown className="h-4 w-4" />
              נגד ({disagreeCount})
            </Button>
          </div>

          {/* Vote Results */}
          {totalVotes > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>תוצאות הצבעה</span>
                <span>{totalVotes} הצבעות</span>
              </div>
              
              {/* Progress Bars */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-8 text-green-600 font-medium">{getVotePercentage(agreeCount)}%</span>
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${getVotePercentage(agreeCount)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">בעד</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-8 text-red-600 font-medium">{getVotePercentage(disagreeCount)}%</span>
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div 
                      className="bg-red-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${getVotePercentage(disagreeCount)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">נגד</span>
                </div>
              </div>
            </div>
          )}

          {!user && (
            <div className="text-center text-sm text-muted-foreground mt-2">
              התחבר כדי להצביע
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default IdeaCard;