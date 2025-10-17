
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
          {/* Left side - Empty */}
          <div className="flex items-center w-32">
          </div>
          
          {/* Center - Title */}
          <div className="flex justify-center flex-1">
            <h1 className="text-2xl font-black text-primary" style={{ 
              fontFamily: 'Poppins, -apple-system, BlinkMacSystemFont, sans-serif',
              fontWeight: 900,
              letterSpacing: '0.02em'
            }}>
              Yara AI
            </h1>
          </div>
          
          {/* Right side - Profile Button */}
          <div className="flex items-center gap-2 w-32 justify-end">
            {user ? (
              <Button 
                variant="ghost" 
                size="sm" 
                className="p-2.5 h-10 w-10 bg-white text-primary hover:bg-gray-100 border-gray-200 rounded-full"
                onClick={() => navigate('/profile/1')}
              >
                <User className="h-5 w-5" />
              </Button>
            ) : (
              <Button 
                variant="ghost" 
                size="sm" 
                className="p-2.5 h-10 w-10 bg-white text-primary hover:bg-gray-100 border-gray-200 rounded-full"
                onClick={() => navigate('/login')}
              >
                <User className="h-5 w-5" />
              </Button>
            )}
          </div>
          
        </div>
      </div>
    </header>
  );
};

export default Header;
