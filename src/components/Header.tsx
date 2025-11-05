
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Users } from "lucide-react";

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
  const navigate = useNavigate();

  return (
    <header className="header-bar border-b border-border shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left side - Title */}
          <div className="flex items-center flex-shrink-0">
            <h1 className="text-lg font-black bg-gradient-to-r from-[#E91E63] to-[#9C27B0] bg-clip-text text-transparent" style={{ 
              fontFamily: 'Poppins, -apple-system, BlinkMacSystemFont, sans-serif',
              fontWeight: 900,
              letterSpacing: '0.02em'
            }}>
              Yara AI
            </h1>
          </div>
          
          {/* Center - Empty space */}
          <div className="flex-1"></div>
          
          {/* Right side - Join Button */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              onClick={() => navigate('/join-me')}
              className="bg-gradient-to-r from-[#E91E63] to-[#9C27B0] text-white hover:opacity-90 px-3 py-2 h-9 gap-1 text-sm font-semibold"
            >
              <Users className="h-4 w-4" />
              Join
            </Button>
          </div>
          
        </div>
      </div>
    </header>
  );
};

export default Header;
