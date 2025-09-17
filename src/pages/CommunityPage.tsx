import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, Gift, ArrowLeft, Globe, Lock, UserPlus } from "lucide-react";
import { Community, useCommunities, useCommunityMembership } from "@/hooks/useCommunities";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import { supabase } from "@/integrations/supabase/client";

const CommunityPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { requestToJoin, getMembershipStatus } = useCommunityMembership();
  const [community, setCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [perks, setPerks] = useState<any[]>([]);

  const membershipStatus = community ? getMembershipStatus(community.id) : null;

  useEffect(() => {
    if (id) {
      fetchCommunity();
      fetchCommunityEvents();
      fetchCommunityPerks();
    }
  }, [id]);

  const fetchCommunity = async () => {
    try {
      const { data, error } = await supabase
        .from('communities')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setCommunity(data as Community);
    } catch (error) {
      console.error('Error fetching community:', error);
      toast({
        title: "Error",
        description: "Failed to load community details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCommunityEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('community_events')
        .select('*')
        .eq('community_id', id)
        .order('date', { ascending: true })
        .limit(5);

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching community events:', error);
    }
  };

  const fetchCommunityPerks = async () => {
    try {
      const { data, error } = await supabase
        .from('community_perks')
        .select('id, title, description, business_name, discount_amount, image_url, valid_until, community_id, created_at')
        .eq('community_id', id)
        .eq('is_active', true)
        .limit(5);

      if (error) throw error;
      setPerks(data || []);
    } catch (error) {
      console.error('Error fetching community perks:', error);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'interests': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'causes': return 'bg-green-100 text-green-800 border-green-200';
      case 'identity': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getAccessIcon = (accessType: string) => {
    switch (accessType) {
      case 'open': return <Globe className="w-4 h-4" />;
      case 'closed': return <Lock className="w-4 h-4" />;
      case 'invite_only': return <UserPlus className="w-4 h-4" />;
      default: return <Lock className="w-4 h-4" />;
    }
  };

  const getAccessLabel = (accessType: string) => {
    switch (accessType) {
      case 'open': return 'Open';
      case 'closed': return 'Approval Required';
      case 'invite_only': return 'Invite Only';
      default: return 'Closed';
    }
  };

  const handleJoinClick = async () => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login to join communities",
        variant: "destructive",
      });
      return;
    }

    if (community?.access_type === 'invite_only') {
      toast({
        title: "Invite Only",
        description: "This community is invite only",
        variant: "destructive",
      });
      return;
    }

    try {
      setJoining(true);
      await requestToJoin(community!.id);
      
      toast({
        title: community?.access_type === 'open' ? "Joined!" : "Request Sent!",
        description: community?.access_type === 'open' 
          ? `You've joined ${community?.name}` 
          : `Your request to join ${community?.name} has been sent`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to join community. Please try again.",
        variant: "destructive",
      });
    } finally {
      setJoining(false);
    }
  };

  const getJoinButtonText = () => {
    if (membershipStatus) {
      switch (membershipStatus.status) {
        case 'approved': return 'Member';
        case 'pending': return 'Pending';
        case 'declined': return 'Declined';
        default: return 'Join';
      }
    }
    return community?.access_type === 'open' ? 'Join' : 'Request to Join';
  };

  const isJoinDisabled = () => {
    return membershipStatus?.status === 'approved' || 
           membershipStatus?.status === 'pending' ||
           community?.access_type === 'invite_only';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
        <BottomNavigation />
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="p-4">
          <div className="text-center py-8">
            <h2 className="text-xl font-semibold mb-2">Community not found</h2>
            <Button onClick={() => navigate('/communities')} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Communities
            </Button>
          </div>
        </div>
        <BottomNavigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      {/* Back Button */}
      <div className="p-4 pt-20">
        <Button 
          onClick={() => navigate('/communities')} 
          variant="ghost" 
          size="sm"
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {/* Community Header */}
        <div className="relative mb-4">
          {/* Cover Image */}
          <div className="h-40 bg-gradient-to-r from-primary/10 to-primary/20 relative rounded-lg overflow-hidden">
            {community.cover_image_url ? (
              <img 
                src={community.cover_image_url} 
                alt={community.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-6xl opacity-50">🏘️</div>
              </div>
            )}

            {/* Access Type Badge */}
            <div className="absolute top-3 right-3">
              <Badge variant="secondary" className="text-xs flex items-center gap-1 bg-white/90">
                {getAccessIcon(community.access_type)}
                {getAccessLabel(community.access_type)}
              </Badge>
            </div>
          </div>

          {/* Community Info */}
          <div className="pt-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-foreground mb-2">{community.name}</h1>
                {community.tagline && (
                  <p className="text-muted-foreground mb-3">{community.tagline}</p>
                )}
                {community.description && (
                  <p className="text-sm text-muted-foreground mb-4">{community.description}</p>
                )}
              </div>
            </div>

            {/* Category and Member Count */}
            <div className="flex items-center justify-between mb-4">
              <Badge className={`capitalize ${getCategoryColor(community.category)}`}>
                {community.subcategory || community.category}
              </Badge>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>{community.member_count} members</span>
              </div>
            </div>

            {/* Join Button */}
            {(!user || community.creator_id !== user.id) && (
              <Button
                onClick={handleJoinClick}
                disabled={isJoinDisabled() || joining}
                className="w-full mb-6"
                variant={membershipStatus?.status === 'approved' ? "secondary" : "default"}
              >
                {joining ? "..." : getJoinButtonText()}
              </Button>
            )}
          </div>
        </div>

        {/* Community Events */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Community Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            {events.length > 0 ? (
              <div className="space-y-3">
                {events.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm line-clamp-1">{event.title}</h4>
                      {event.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{event.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        {event.date && <span>{new Date(event.date).toLocaleDateString()}</span>}
                        {event.location && <span>• {event.location}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No upcoming events</p>
            )}
          </CardContent>
        </Card>

        {/* Community Meetups */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Community Meetups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">No scheduled meetups</p>
          </CardContent>
        </Card>

        {/* Community Coupons/Perks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5" />
              Community Perks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {perks.length > 0 ? (
              <div className="space-y-3">
                {perks.map((perk) => (
                  <div key={perk.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Gift className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm line-clamp-1">{perk.title}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{perk.description}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs font-medium text-green-600">{perk.business_name}</span>
                        {perk.discount_amount && (
                          <span className="text-xs font-bold text-primary">{perk.discount_amount}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No available perks</p>
            )}
          </CardContent>
        </Card>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default CommunityPage;