import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { LogOut, User, Plus, ChevronDown, Settings, MessageCircle } from "lucide-react";
import { useNewItem } from "@/contexts/NewItemContext";
import LanguageSelector from "@/components/LanguageSelector";
import NeighborhoodSelector from "@/components/NeighborhoodSelector";
import NeighborhoodIndicator from "@/components/NeighborhoodIndicator";
import AIAssistantPopup from "@/components/AIAssistantPopup";
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
  const [showAIAssistant, setShowAIAssistant] = useState(false);

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
            <h1 className="text-4xl font-black text-primary" style={{ 
              fontFamily: 'Poppins, -apple-system, BlinkMacSystemFont, sans-serif',
              fontWeight: 900,
              letterSpacing: '0.02em'
            }}>
              יערה שירן
            </h1>
          </div>
          
          {/* Center section - AI Assistant */}
          <div className="flex-1 max-w-2xl mx-8 flex justify-center">
            <Button 
              variant="outline" 
              className="bg-background text-foreground hover:bg-accent border-border px-6 py-3 h-11 gap-2"
              onClick={() => setShowAIAssistant(true)}
            >
              <MessageCircle className="h-5 w-5" />
              Ask AI Assistant
            </Button>
          </div>
          
          {/* Right section - Actions */}
          <div className="flex items-center gap-4 flex-shrink-0">
            {/* Location Switcher */}
            <Button 
              variant="outline" 
              className="bg-accent text-accent-foreground hover:bg-accent/80 px-4 py-2 h-11"
            >
              📍 Buenos Aires
            </Button>
            
            {/* User menu */}
            {user && (
              <Button 
                variant="outline" 
                className="rounded-full px-5 py-2 h-11"
                onClick={() => navigate('/profile/1')}
              >
                <User className="h-4 w-4 mr-2" />
                {user.email?.split('@')[0] || t('common.profile')}
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {/* AI Assistant Popup */}
      <AIAssistantPopup
        isOpen={showAIAssistant}
        onClose={() => setShowAIAssistant(false)}
      />
    </header>
  );
};

export default DesktopHeader;