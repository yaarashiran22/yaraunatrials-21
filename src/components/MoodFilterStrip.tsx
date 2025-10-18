import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Coffee, Zap, Heart, Dumbbell, Palette, Users, Leaf, Search, X, MapPin, Calendar, User, Building, ShoppingBag, Music } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useGlobalSearch, SearchResult } from "@/hooks/useGlobalSearch";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

const moodFilters = [
  { id: "all", label: "All", icon: null, color: "text-muted-foreground", activeBg: "bg-muted/80" },
  { id: "chill", label: "Chill", icon: Coffee, color: "text-blue-500", activeBg: "bg-blue-50 dark:bg-blue-950/30" },
  { id: "go-out", label: "Go Out", icon: Zap, color: "text-orange-500", activeBg: "bg-orange-50 dark:bg-orange-950/30" },
  { id: "romantic", label: "Romantic", icon: Heart, color: "text-pink-500", activeBg: "bg-pink-50 dark:bg-pink-950/30" },
  { id: "active", label: "Active", icon: Dumbbell, color: "text-green-400", activeBg: "bg-green-50/70 dark:bg-green-950/20" },
  { id: "creative", label: "Creative", icon: Palette, color: "text-purple-500", activeBg: "bg-purple-50 dark:bg-purple-950/30" },
  { id: "social", label: "Wellness", icon: Leaf, color: "text-green-500", activeBg: "bg-green-50/70 dark:bg-green-950/20" },
  { id: "music", label: "Music", icon: Music, color: "text-cyan-500", activeBg: "bg-cyan-50 dark:bg-cyan-950/30" }
];

interface MoodFilterStripProps {
  onFilterChange?: (filterId: string) => void;
  showTitle?: boolean;
}

const MoodFilterStrip = ({ onFilterChange, showTitle = true }: MoodFilterStripProps) => {
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { results, loading, searchAll, clearSearch } = useGlobalSearch();
  const navigate = useNavigate();

  const handleFilterClick = (filterId: string) => {
    setActiveFilter(filterId);
    onFilterChange?.(filterId);
  };

  const handleSearchOpen = () => {
    setSearchOpen(true);
  };

  const handleSearchClose = () => {
    setSearchOpen(false);
    setSearchQuery("");
    clearSearch();
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      searchAll(searchQuery);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    handleSearchClose();
    
    switch (result.type) {
      case 'event':
        navigate(`/events/${result.id}`);
        break;
      case 'meetup':
        navigate(`/events/${result.id}`); // Meetups also go to events page but could be differentiated
        break;
      case 'community':
        navigate(`/communities/${result.id}`);
        break;
      case 'user':
        navigate(`/profile/${result.id}`);
        break;
      case 'post':
        navigate(`/`); // Navigate to home page
        break;
      case 'item':
        navigate(`/item/${result.id}`);
        break;
      default:
        break;
    }
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'event': return Calendar;
      case 'meetup': return Users;
      case 'community': return Building;
      case 'user': return User;
      case 'post': return MapPin;
      case 'item': return ShoppingBag;
      default: return Search;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'event': return 'text-blue-500';
      case 'meetup': return 'text-green-500';
      case 'community': return 'text-purple-500';
      case 'user': return 'text-green-500';
      case 'post': return 'text-orange-500';
      case 'item': return 'text-pink-500';
      default: return 'text-muted-foreground';
    }
  };

  const renderFilterButtons = () => {
    const allFilter = moodFilters[0];
    const otherFilters = moodFilters.slice(1);

    return (
      <>
        {/* All Filter */}
        <Button
          key={allFilter.id}
          variant="ghost"
          size="sm"
          onClick={() => handleFilterClick(allFilter.id)}
          className={`
            flex-shrink-0 rounded-full px-6 py-3 text-sm font-medium transition-all duration-200 
            flex items-center gap-2 min-w-fit border border-transparent
            ${activeFilter === allFilter.id 
              ? `${allFilter.activeBg} ${allFilter.color} border-current/20` 
              : `${allFilter.color} hover:bg-accent/50`
            }
          `}
        >
          {allFilter.label}
        </Button>


        {/* Other Filters */}
        {otherFilters.map((filter) => {
          const IconComponent = filter.icon;
          return (
            <Button
              key={filter.id}
              variant="ghost"
              size="sm"
              onClick={() => handleFilterClick(filter.id)}
              className={`
                flex-shrink-0 rounded-full px-6 py-3 text-sm font-medium transition-all duration-200 
                flex items-center gap-2 min-w-fit border border-transparent
                ${activeFilter === filter.id 
                  ? `${filter.activeBg} ${filter.color} border-current/20` 
                  : `${filter.color} hover:bg-accent/50`
                }
              `}
            >
              <IconComponent className={`h-4 w-4 ${filter.color}`} />
              {filter.label}
            </Button>
          );
        })}
      </>
    );
  };

  return (
    <>
      <div className="sticky top-[var(--header-height,64px)] z-50 bg-accent/5 backdrop-blur-sm border-b border-border/20 shadow-sm">
        <div className="px-4 lg:px-8 py-3">
          {showTitle && (
            <h3 className="text-lg font-semibold text-foreground mb-4 text-center">
              What mood are you in?
            </h3>
          )}
          <div className="flex overflow-x-auto gap-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40">
            {renderFilterButtons()}
          </div>
        </div>
      </div>

      {/* Search Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] p-0">
          <DialogHeader className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle>Search Everything</DialogTitle>
              <Button variant="ghost" size="sm" onClick={handleSearchClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="px-6">
            <form onSubmit={handleSearchSubmit}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search events, communities, people, posts, items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12"
                  autoFocus
                />
              </div>
            </form>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {loading && (
              <div className="space-y-3 mt-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {results.length > 0 && (
              <div className="space-y-2 mt-4">
                <div className="text-sm text-muted-foreground mb-3">
                  {results.length} results found
                </div>
                {results.map((result) => {
                  const IconComponent = getResultIcon(result.type);
                  return (
                    <div
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleResultClick(result)}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <div className="flex-shrink-0">
                        {result.imageUrl ? (
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={result.imageUrl} alt={result.title} />
                            <AvatarFallback>
                              <IconComponent className={`h-5 w-5 ${getTypeColor(result.type)}`} />
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <IconComponent className={`h-5 w-5 ${getTypeColor(result.type)}`} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm truncate">{result.title}</h4>
                          <Badge variant="secondary" className="text-xs capitalize">
                            {result.type}
                          </Badge>
                        </div>
                        {result.subtitle && (
                          <p className="text-xs text-muted-foreground truncate">
                            {result.subtitle}
                          </p>
                        )}
                        {result.description && (
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {result.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {searchQuery && !loading && results.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No results found for "{searchQuery}"</p>
                <p className="text-sm mt-1">Try different keywords or browse categories</p>
              </div>
            )}

            {!searchQuery && !loading && (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Start typing to search everything</p>
                <p className="text-sm mt-1">Events, communities, people, posts, and more</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MoodFilterStrip;