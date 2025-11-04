
import { PartyPopper, User, Users, Settings, LogIn, Plus, Heart, Search, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNewItem } from "@/contexts/NewItemContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language, setLanguage } = useLanguage();
  const { user } = useAuth();
  const { openNewItem } = useNewItem();

  const languages = [
    { code: 'es', name: 'Español', flag: '🇦🇷' },
    { code: 'en', name: 'English', flag: '🇺🇸' }
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bottom-nav fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl border-t-2 border-primary/30 lg:hidden shadow-2xl safe-area-inset-bottom">
      {/* Subtle top glow effect */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
      
      <div className="px-4 py-3 relative">
        <div className="flex items-center justify-around w-full max-w-sm mx-auto">
          {/* Home */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className={`flex items-center justify-center h-auto py-3 px-4 transition-all duration-300 rounded-2xl min-h-[3rem] relative overflow-hidden group ${
              isActive('/') 
                ? 'text-foreground' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:scale-105 active:scale-95'
            }`}
          >
            <PartyPopper className={`h-6 w-6 transition-all duration-300 ${isActive('/') ? 'stroke-[2.5]' : 'group-hover:scale-110'}`} />
          </Button>

          {/* Top Lists */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/top-lists')}
            className={`flex items-center justify-center h-auto py-3 px-4 transition-all duration-300 rounded-2xl min-h-[3rem] relative overflow-hidden group ${
              isActive('/top-lists') 
                ? 'text-foreground' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:scale-105 active:scale-95'
            }`}
          >
            <ListChecks className={`h-6 w-6 transition-all duration-300 ${isActive('/top-lists') ? 'stroke-[2.5]' : 'group-hover:scale-110'}`} />
          </Button>

          {/* Profile */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (user) {
                navigate(`/profile/${user.id}`);
              } else {
                navigate('/login');
              }
            }}
            className={`flex items-center justify-center h-auto py-3 px-4 transition-all duration-300 rounded-2xl min-h-[3rem] relative overflow-hidden group ${
              location.pathname.startsWith('/profile') 
                ? 'text-foreground' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:scale-105 active:scale-95'
            }`}
          >
            <User className={`h-6 w-6 transition-all duration-300 ${location.pathname.startsWith('/profile') ? 'stroke-[2.5]' : 'group-hover:scale-110'}`} />
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default BottomNavigation;
