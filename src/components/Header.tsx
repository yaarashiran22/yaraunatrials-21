
import NeighborhoodSelector from "@/components/NeighborhoodSelector";
import NeighborhoodIndicator from "@/components/NeighborhoodIndicator";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { LogOut, User, Home, Settings, ChevronDown, Heart, Plus, MapPin, Search, Zap, MessageCircle } from "lucide-react";
import logoImage from "@/assets/reference-image.png";
import { useNewItem } from "@/contexts/NewItemContext";
import { useSearch } from "@/contexts/SearchContext";
import { useState } from "react";

interface HeaderProps {
  title?: string;
  showSearch?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  onNeighborhoodChange?: (neighborhood: string) => void;
}

const Header = ({ 
  title, 
  showSearch = false, 
  searchValue = "", 
  onSearchChange, 
  searchPlaceholder,
  onNeighborhoodChange
}: HeaderProps) => {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { openNewItem } = useNewItem();
  const { openSearch } = useSearch();
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('All');

  const neighborhoods = [
    'All',
    'Palermo Soho',
    'Palermo Hollywood',
    'Villa Crespo',
    'San Telmo',
    'Chacarita'
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleLogoClick = () => {
    navigate('/');
  };

  return (
    <header className="header-bar border-b border-border shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left side - Title */}
          <div className="flex items-center flex-shrink-0">
            <h1 className="text-lg font-black text-primary" style={{ 
              fontFamily: 'Poppins, -apple-system, BlinkMacSystemFont, sans-serif',
              fontWeight: 900,
              letterSpacing: '0.02em'
            }}>
              Yara AI
            </h1>
          </div>
          
          {/* Center - Neighborhood Dropdown */}
          <div className="flex-1 flex justify-center px-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className="bg-background text-foreground hover:bg-accent border-border px-3 py-2 h-9 gap-1 text-sm"
                >
                  <MapPin className="h-4 w-4" />
                  {selectedNeighborhood}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-white border-border z-[9999]">
                {neighborhoods.map((neighborhood) => (
                  <DropdownMenuItem 
                    key={neighborhood}
                    onClick={() => setSelectedNeighborhood(neighborhood)}
                    className="cursor-pointer hover:bg-accent"
                  >
                    {neighborhood}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          {/* Right side - Profile Button */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {user ? (
              <Button 
                variant="ghost" 
                size="sm" 
                className="p-2.5 h-9 w-9 bg-white text-primary hover:bg-gray-100 border-gray-200 rounded-full"
                onClick={() => navigate('/profile/1')}
              >
                <User className="h-4 w-4" />
              </Button>
            ) : (
              <Button 
                variant="ghost" 
                size="sm" 
                className="p-2.5 h-9 w-9 bg-white text-primary hover:bg-gray-100 border-gray-200 rounded-full"
                onClick={() => navigate('/login')}
              >
                <User className="h-4 w-4" />
              </Button>
            )}
          </div>
          
        </div>
      </div>
    </header>
  );
};

export default Header;
