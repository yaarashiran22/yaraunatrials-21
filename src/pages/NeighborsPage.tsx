import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Users, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ProfilePictureViewer from "@/components/ProfilePictureViewer";

interface UserProfile {
  id: string;
  name: string;
  profile_image_url: string;
  bio?: string;
  location?: string;
}

const NeighborsPage = () => {
  const navigate = useNavigate();
  const [neighbors, setNeighbors] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProfilePicture, setShowProfilePicture] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{imageUrl: string; name: string; userId?: string} | null>(null);

  useEffect(() => {
    const fetchNeighbors = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, profile_image_url, bio, location')
          .not('name', 'is', null)
          .order('name');

        if (error) {
          console.error('Error fetching neighbors:', error);
        } else {
          setNeighbors(data || []);
        }
      } catch (err) {
        console.error('Unexpected error fetching neighbors:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNeighbors();
  }, []);

  const handleNeighborClick = (neighborId: string) => {
    navigate(`/profile/${neighborId}`);
  };

  return (
    <div className="min-h-screen bg-background pb-20" dir="ltr">
      {/* Custom Header with Back Button */}
      <header className="bg-background border-b border-border/20 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/')}
              className="p-2 hover:bg-muted/20 rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">הכר את השכנים</h1>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 pb-32">
        {/* Header Section */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">השכנים שלנו</h1>
          </div>
          <p className="text-muted-foreground">
            הכירו את התושבים הנרשמים באפליקציה שלנו
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">טוען שכנים...</p>
          </div>
        ) : neighbors.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">אין שכנים רשומים עדיין</p>
            <p className="text-sm text-muted-foreground mt-2">היו הראשונים להצטרף לקהילה!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {neighbors.map((neighbor) => (
              <Card 
                key={neighbor.id}
                className="p-4 cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-1"
                onClick={() => handleNeighborClick(neighbor.id)}
              >
                <div className="flex flex-col items-center text-center">
                  <img 
                    src={neighbor.profile_image_url || "/lovable-uploads/c7d65671-6211-412e-af1d-6e5cfdaa248e.png"}
                    alt={neighbor.name}
                    className="w-20 h-20 rounded-full object-cover mb-3 ring-2 ring-primary/20 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedUser({
                        imageUrl: neighbor.profile_image_url || "",
                        name: neighbor.name,
                        userId: neighbor.id
                      });
                      setShowProfilePicture(true);
                    }}
                  />
                  <h3 className="font-semibold text-foreground mb-1">
                    {neighbor.name}
                  </h3>
                  {neighbor.bio && (
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                      {neighbor.bio}
                    </p>
                  )}
                  {neighbor.location && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>{neighbor.location}</span>
                    </div>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3 w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNeighborClick(neighbor.id);
                    }}
                  >
                    צפה בפרופיל
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Statistics */}
        {!loading && neighbors.length > 0 && (
          <div className="mt-8 bg-card/50 backdrop-blur-sm rounded-xl p-4 border border-border/20">
            <div className="flex items-center justify-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-foreground">
                {neighbors.length} שכנים רשומים באפליקציה
              </span>
            </div>
          </div>
        )}
        
        <ProfilePictureViewer
          isOpen={showProfilePicture}
          onClose={() => setShowProfilePicture(false)}
          imageUrl={selectedUser?.imageUrl || ""}
          userName={selectedUser?.name || "משתמש"}
          userId={selectedUser?.userId}
        />
      </main>

      <BottomNavigation />
    </div>
  );
};

export default NeighborsPage;