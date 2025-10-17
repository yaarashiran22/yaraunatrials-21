import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import DesktopHeader from '@/components/DesktopHeader';
import BottomNavigation from '@/components/BottomNavigation';
import MoodFilterStrip from '@/components/MoodFilterStrip';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useOptimizedHomepage } from '@/hooks/useOptimizedHomepage';
import FastLoadingSkeleton from '@/components/FastLoadingSkeleton';
import OptimizedProfileCard from '@/components/OptimizedProfileCard';
import ScrollAnimatedCard from '@/components/ScrollAnimatedCard';
import { useUserCoupons } from '@/hooks/useUserCoupons';
import { useCouponClaims } from '@/hooks/useCouponClaims';
import { CouponQRModal } from '@/components/CouponQRModal';
import { AddCouponModal } from '@/components/AddCouponModal';
import { Card, CardContent } from '@/components/ui/card';
import { QrCode, Gift, Store } from 'lucide-react';

const MeetupsPage = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { profile: currentUserProfile } = useProfile(user?.id);
  const navigate = useNavigate();
  
  // Use optimized homepage hook for profiles data
  const {
    profiles,
    loading: profilesLoading
  } = useOptimizedHomepage();
  
  // Mood filter state
  const [selectedMoodFilter, setSelectedMoodFilter] = useState<string>('all');
  
  // Coupons states
  const [selectedCoupon, setSelectedCoupon] = useState<any>(null);
  const [showCouponQR, setShowCouponQR] = useState(false);
  const [showAddCoupon, setShowAddCoupon] = useState(false);
  
  // Fetch all coupons
  const { coupons, loading: couponsLoading } = useUserCoupons();
  const { generateUserCouponQR } = useCouponClaims(user?.id);

  // Mood filter handler
  const handleMoodFilterChange = (filterId: string) => {
    setSelectedMoodFilter(filterId);
    // TODO: Could implement mood-based filtering here if needed
  };

  // Memoize display profiles for meetup organizers
  const displayProfiles = useMemo(() => {
    const profilesList = [];

    // Always show current user first if logged in
    if (user) {
      const currentUserDisplayProfile = {
        id: user.id,
        name: currentUserProfile?.name || user.email?.split('@')[0] || 'You',
        image: currentUserProfile?.profile_image_url || user.user_metadata?.avatar_url || "/lovable-uploads/c7d65671-6211-412e-af1d-6e5cfdaa248e.png",
        isCurrentUser: true,
        hasStories: false
      };
      profilesList.push(currentUserDisplayProfile);
    }

    // Show all other profiles as potential meetup organizers
    if (profiles.length > 0) {
      const filteredProfiles = profiles.filter(p => p.id !== user?.id && p.name?.toLowerCase() !== 'juani');
      
      const otherProfiles = filteredProfiles.map(p => ({
        id: p.id,
        name: p.name || "User",
        image: p.image || "/lovable-uploads/c7d65671-6211-412e-af1d-6e5cfdaa248e.png",
        hasStories: false,
        isCurrentUser: false
      }));
      profilesList.push(...otherProfiles);
    }
    return profilesList;
  }, [user, currentUserProfile, profiles, selectedMoodFilter]);

  // Coupon click handler
  const handleCouponClick = useCallback(async (coupon: any) => {
    try {
      const qrCodeUrl = await generateUserCouponQR(coupon.id);
      setSelectedCoupon({
        ...coupon,
        qr_code_data: qrCodeUrl
      });
      setShowCouponQR(true);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  }, [generateUserCouponQR]);

  return (
    <div className="min-h-screen bg-background" dir="ltr">
      {/* Mobile Header */}
      <div className="lg:hidden">
        <Header title="Coupons" />
      </div>
      
      {/* Desktop Header */}
      <DesktopHeader title="Coupons" />
      
      {/* Mood Filter Strip */}
      <MoodFilterStrip onFilterChange={handleMoodFilterChange} showTitle={false} />
      
      <main className="px-3 lg:px-6 py-3 lg:py-6 space-y-5 lg:space-y-10 pb-24 lg:pb-8 w-full max-w-md lg:max-w-none mx-auto lg:mx-0">
        {/* Community Members Section - Horizontal Carousel */}
        <section className="-mb-1 lg:-mb-1">
          <div className="px-1 lg:px-5 mb-3">
            <h3 className="title-section-white">nearby businesses</h3>
          </div>
          <div className="relative">
            <div className="flex overflow-x-auto gap-2 pb-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40" dir="ltr" style={{
            scrollBehavior: 'smooth'
          }}>
              {profilesLoading ? <FastLoadingSkeleton type="profiles" /> : displayProfiles.length > 0 ? displayProfiles.map((profile, index) => <OptimizedProfileCard key={profile.id} id={profile.id} image={profile.image} name={profile.name} className={`flex-shrink-0 min-w-[90px] animate-fade-in ${index === 0 && user?.id === profile.id ? '' : ''}`} style={{
              animationDelay: `${Math.min(index * 0.03, 0.3)}s`
            } as React.CSSProperties} isCurrentUser={user?.id === profile.id} />) : <div className="text-center py-8 text-muted-foreground w-full">No registered users yet</div>}
            </div>
          </div>
        </section>

        {/* Coupons Section */}
        <section className="home-section">
          <div className="flex justify-between items-center mb-4">
            <h2 className="title-section flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              available coupons
            </h2>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowAddCoupon(true)} 
              className="text-xs px-2 py-1 rounded-full border-2 border-primary bg-transparent text-foreground hover:border-primary/80 gap-1"
            >
              <Plus className="h-3 w-3 text-black" />
            </Button>
          </div>
          
          {couponsLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-40 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : coupons.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Store className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-base mb-2">No coupons available yet</p>
              <p className="text-sm">Be the first to add a coupon!</p>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4 p-2 overflow-visible">
              {coupons.map((coupon, index) => (
                <ScrollAnimatedCard key={coupon.id} index={index}>
                  <Card 
                    className="w-full cursor-pointer hover:shadow-lg transition-all duration-200 border-border/40"
                    onClick={() => handleCouponClick(coupon)}
                  >
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        {/* Coupon Image */}
                        <div className="w-24 h-24 flex-shrink-0 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg flex items-center justify-center overflow-hidden">
                          {coupon.image_url ? (
                            <img 
                              src={coupon.image_url} 
                              alt={coupon.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <QrCode className="h-10 w-10 text-primary" />
                          )}
                        </div>
                        
                        {/* Coupon Details */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-base mb-1 line-clamp-2">{coupon.title}</h3>
                          <p className="text-sm text-muted-foreground mb-2">{coupon.business_name}</p>
                          {coupon.description && (
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{coupon.description}</p>
                          )}
                          <div className="flex items-center justify-between mt-auto">
                            <span className="text-sm bg-primary/10 text-primary px-3 py-1 rounded-full font-semibold">
                              {coupon.discount_amount}% OFF
                            </span>
                            {coupon.valid_until && (
                              <span className="text-xs text-muted-foreground">
                                Valid until {new Date(coupon.valid_until).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </ScrollAnimatedCard>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Add Coupon Modal */}
      {showAddCoupon && (
        <AddCouponModal 
          isOpen={showAddCoupon}
          onClose={() => setShowAddCoupon(false)}
        />
      )}

      {/* Coupon QR Modal */}
      {showCouponQR && selectedCoupon && (
        <CouponQRModal 
          isOpen={showCouponQR}
          onClose={() => {
            setShowCouponQR(false);
            setSelectedCoupon(null);
          }}
          userCoupon={selectedCoupon}
          qrCodeData={selectedCoupon.qr_code_data}
        />
      )}
      
      <BottomNavigation />
    </div>
  );
};

export default MeetupsPage;