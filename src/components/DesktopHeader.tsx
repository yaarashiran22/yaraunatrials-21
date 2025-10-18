import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { LogOut, User, Plus, ChevronDown, Settings, MapPin } from "lucide-react";
import { useNewItem } from "@/contexts/NewItemContext";
import LanguageSelector from "@/components/LanguageSelector";
import NeighborhoodSelector from "@/components/NeighborhoodSelector";
import NeighborhoodIndicator from "@/components/NeighborhoodIndicator";
import { useState } from "react";

interface DesktopHeaderProps {
  title?: string;
  showSearch?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  onNotificationsClick?: () => void;
}

const DesktopHeader = ({ 
  title, 
  showSearch = false, 
  searchValue = "", 
  onSearchChange, 
  searchPlaceholder,
  onNotificationsClick
}: DesktopHeaderProps) => {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { openNewItem } = useNewItem();
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

  return (
    <header className="hidden lg:block bg-card border-b border-border shadow-sm sticky top-0 z-40">
      <div className="container mx-auto px-8 py-6">
        <div className="flex items-center justify-between gap-8">
          {/* Left section - Title */}
          <div className="flex-shrink-0">
            <h1 className="text-xl font-black bg-gradient-to-r from-[#E91E63] to-[#9C27B0] bg-clip-text text-transparent" style={{ 
              fontFamily: 'Poppins, -apple-system, BlinkMacSystemFont, sans-serif',
              fontWeight: 900,
              letterSpacing: '0.02em'
            }}>
              Yara AI
            </h1>
          </div>
          
          {/* Center section - Neighborhood Dropdown */}
          <div className="flex-1 max-w-2xl mx-8 flex justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className="bg-white text-black hover:bg-gray-100 border-gray-300 px-6 py-3 h-11 gap-2"
                >
                  <MapPin className="h-5 w-5" />
                  {selectedNeighborhood}
                  <ChevronDown className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-background border-border z-50">
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
          
          {/* Right section - Actions */}
          <div className="flex items-center gap-4 flex-shrink-0">
            {/* Profile Button */}
            {user ? (
              <Button 
                variant="outline" 
                className="rounded-full px-5 py-2 h-11"
                onClick={() => navigate('/profile/1')}
              >
                <User className="h-4 w-4 mr-2" />
                {user.email?.split('@')[0] || t('common.profile')}
              </Button>
            ) : (
              <Button 
                variant="outline" 
                className="rounded-full px-5 py-2 h-11"
                onClick={() => navigate('/login')}
              >
                <User className="h-4 w-4 mr-2" />
                Login
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default DesktopHeader;