import React, { useState, useEffect } from 'react';
import { 
  SimplifiedModal, 
  SimplifiedModalContent, 
  SimplifiedModalHeader, 
  SimplifiedModalTitle, 
  SimplifiedModalBody 
} from '@/components/ui/simplified-modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, X, User, Package, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSearch } from '@/contexts/SearchContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';

interface Profile {
  id: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  specialties: string[] | null;
  profile_image_url: string | null;
}

interface Event {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  price: string | null;
  image_url: string | null;
  event_type: string;
  date: string | null;
}

interface UserCoupon {
  id: string;
  title: string;
  description: string | null;
  business_name: string | null;
  discount_amount: string | null;
  image_url: string | null;
  neighborhood: string | null;
}

const SearchPopup = () => {
  const { isSearchOpen, closeSearch } = useSearch();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [coupons, setCoupons] = useState<UserCoupon[]>([]);
  const [loading, setLoading] = useState(false);

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setProfiles([]);
      setEvents([]);
      setCoupons([]);
      return;
    }

    setLoading(true);
    try {
      // Search profiles - including specialties with partial matching
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, username, bio, specialties, profile_image_url')
        .or(`name.ilike.%${query}%,username.ilike.%${query}%,bio.ilike.%${query}%,array_to_string(specialties,',').ilike.%${query}%`)
        .limit(10);

      // Search events and meetups
      const { data: eventsData } = await supabase
        .from('events')
        .select('id, title, description, location, price, image_url, event_type, date')
        .or(`title.ilike.%${query}%,description.ilike.%${query}%,location.ilike.%${query}%`)
        .limit(10);

      // Search user coupons
      const { data: couponsData } = await supabase
        .from('user_coupons')
        .select('id, title, description, business_name, discount_amount, image_url, neighborhood')
        .or(`title.ilike.%${query}%,description.ilike.%${query}%,business_name.ilike.%${query}%,neighborhood.ilike.%${query}%`)
        .limit(10);

      setProfiles(profilesData || []);
      setEvents(eventsData || []);
      setCoupons(couponsData || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);

    return () => clearTimeout(delayedSearch);
  }, [searchQuery]);

  const handleUserClick = (userId: string) => {
    navigate(`/profile/${userId}`);
    closeSearch();
  };

  const handleEventClick = (eventId: string) => {
    navigate(`/event/${eventId}`);
    closeSearch();
  };

  const handleCouponClick = (couponId: string) => {
    // You may want to create a coupon details page or show a popup
    console.log('Coupon clicked:', couponId);
    closeSearch();
  };

  const handleClose = () => {
    setSearchQuery('');
    setProfiles([]);
    setEvents([]);
    setCoupons([]);
    closeSearch();
  };

  return (
    <SimplifiedModal open={isSearchOpen} onOpenChange={handleClose}>
      <SimplifiedModalContent className="max-w-2xl max-h-[85vh] bg-card border-border/20 shadow-2xl">
        <SimplifiedModalHeader className="pb-4 border-b border-border/10">
          <SimplifiedModalTitle className="flex items-center justify-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary/10 to-primary/20 rounded-full">
              <Search className="h-5 w-5 text-primary" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-red-500">Search</h2>
              <p className="text-sm text-muted-foreground font-normal">Find users, items, and more</p>
            </div>
          </SimplifiedModalTitle>
        </SimplifiedModalHeader>
        
        <SimplifiedModalBody className="p-6">
          {/* Search Input */}
          <div className="relative mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search for users, items, events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-12 h-12 text-base bg-muted/30 border-border/40 focus:border-primary transition-all duration-200 rounded-xl"
                autoFocus
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 rounded-full hover:bg-muted/50"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Results Container */}
          <div className="flex-1 overflow-y-auto space-y-6 max-h-[50vh]">
            {loading && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-3 bg-primary/10 rounded-full mb-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
                </div>
                <p className="text-muted-foreground">Searching...</p>
              </div>
            )}

            {!loading && searchQuery && (profiles.length === 0 && events.length === 0 && coupons.length === 0) && (
              <div className="text-center py-12">
                <div className="p-4 bg-muted/20 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Search className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">No results found</h3>
                <p className="text-muted-foreground">Try searching with different keywords</p>
              </div>
            )}

            {/* Users Section */}
            {profiles.length > 0 && (
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 font-semibold text-foreground px-1">
                  <div className="p-1 bg-primary/10 rounded-md">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  Users ({profiles.length})
                </h3>
                <div className="space-y-2">
                  {profiles.map((profile) => (
                    <div
                      key={profile.id}
                      onClick={() => handleUserClick(profile.id)}
                      className="flex items-center gap-4 p-4 rounded-xl hover:bg-muted/50 cursor-pointer transition-all duration-200 border border-border/20 hover:border-primary/30 hover:shadow-sm group"
                    >
                      <Avatar className="h-12 w-12 border-2 border-border/20 group-hover:border-primary/30 transition-colors">
                        <AvatarImage src={profile.profile_image_url || ''} />
                        <AvatarFallback className="bg-gradient-to-br from-primary/10 to-primary/20 text-primary font-semibold">
                          {profile.name?.charAt(0) || profile.username?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {profile.name || profile.username || 'Unknown User'}
                        </div>
                        {profile.specialties && profile.specialties.length > 0 && (
                          <div className="text-sm text-primary font-medium mt-0.5">
                            {profile.specialties.slice(0, 2).join(', ')}
                            {profile.specialties.length > 2 && ' +more'}
                          </div>
                        )}
                        {profile.bio && (
                          <div className="text-sm text-muted-foreground truncate mt-1">
                            {profile.bio}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Events Section */}
            {events.length > 0 && (
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 font-semibold text-foreground px-1">
                  <div className="p-1 bg-secondary/10 rounded-md">
                    <Calendar className="h-4 w-4 text-secondary" />
                  </div>
                  Events & Meetups ({events.length})
                </h3>
                <div className="space-y-2">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      onClick={() => handleEventClick(event.id)}
                      className="flex items-center gap-4 p-4 rounded-xl hover:bg-muted/50 cursor-pointer transition-all duration-200 border border-border/20 hover:border-secondary/30 hover:shadow-sm group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-muted/50 overflow-hidden flex items-center justify-center border border-border/20 group-hover:border-secondary/30 transition-colors">
                        {event.image_url ? (
                          <img 
                            src={event.image_url} 
                            alt={event.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Calendar className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground group-hover:text-secondary transition-colors">
                          {event.title}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {event.event_type && (
                            <span className="text-sm text-secondary font-medium capitalize">
                              {event.event_type}
                            </span>
                          )}
                          {event.location && (
                            <span className="text-sm text-muted-foreground">
                              {event.location}
                            </span>
                          )}
                          {event.price && (
                            <span className="text-sm text-muted-foreground font-medium">
                              {event.price}
                            </span>
                          )}
                        </div>
                        {event.description && (
                          <div className="text-sm text-muted-foreground truncate mt-1">
                            {event.description}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Coupons Section */}
            {coupons.length > 0 && (
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 font-semibold text-foreground px-1">
                  <div className="p-1 bg-orange-500/10 rounded-md">
                    <Package className="h-4 w-4 text-orange-500" />
                  </div>
                  Deals & Coupons ({coupons.length})
                </h3>
                <div className="space-y-2">
                  {coupons.map((coupon) => (
                    <div
                      key={coupon.id}
                      onClick={() => handleCouponClick(coupon.id)}
                      className="flex items-center gap-4 p-4 rounded-xl hover:bg-muted/50 cursor-pointer transition-all duration-200 border border-border/20 hover:border-orange-500/30 hover:shadow-sm group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-muted/50 overflow-hidden flex items-center justify-center border border-border/20 group-hover:border-orange-500/30 transition-colors">
                        {coupon.image_url ? (
                          <img 
                            src={coupon.image_url} 
                            alt={coupon.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground group-hover:text-orange-500 transition-colors">
                          {coupon.title}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {coupon.business_name && (
                            <span className="text-sm text-orange-500 font-medium">
                              {coupon.business_name}
                            </span>
                          )}
                          {coupon.discount_amount && (
                            <span className="text-sm text-muted-foreground font-medium">
                              {coupon.discount_amount}
                            </span>
                          )}
                          {coupon.neighborhood && (
                            <span className="text-sm text-muted-foreground">
                              {coupon.neighborhood}
                            </span>
                          )}
                        </div>
                        {coupon.description && (
                          <div className="text-sm text-muted-foreground truncate mt-1">
                            {coupon.description}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SimplifiedModalBody>
      </SimplifiedModalContent>
    </SimplifiedModal>
  );
};

export default SearchPopup;