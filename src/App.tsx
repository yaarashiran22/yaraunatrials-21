import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { Home, User, Users, Settings, Heart } from "lucide-react";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import { NewItemProvider } from "@/contexts/NewItemContext";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import { SearchProvider } from "@/contexts/SearchContext";
import SearchPopup from "@/components/SearchPopup";
import ErrorBoundary from "@/components/ErrorBoundary";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useNewItem } from "@/contexts/NewItemContext";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import Index from "./pages/Index";
import ProfilePage from "./pages/ProfilePage";
import EventsPage from "./pages/EventsPage";
import EventDetailsPage from "./pages/EventDetailsPage";
import ItemDetailsPage from "./pages/ItemDetailsPage";
import MarketplacePage from "./pages/MarketplacePage";
import NeighborhoodProfilePage from "./pages/NeighborhoodProfilePage";
import NeighborsPage from "./pages/NeighborsPage";
import TopListsPage from "./pages/TopListsPage";

import RegisterPage from "./pages/RegisterPage";
import SettingsPage from "./pages/SettingsPage";
import CreatePostPage from "./pages/CreatePostPage";
import EditProfilePage from "./pages/EditProfilePage";
import EditItemPage from "./pages/EditItemPage";
import FavoritesPage from "./pages/FavoritesPage";
import WhatsAppQRPage from "./pages/WhatsAppQRPage";
import ChatbotErrorsPage from "./pages/ChatbotErrorsPage";
import CreateEventPage from "./pages/CreateEventPage";
import NotFound from "./pages/NotFound";



// Desktop navigation item component
const DesktopNavItem = ({ href, icon: Icon, label }: { href: string; icon: any; label: string }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname === href || (href === '/profile/1' && location.pathname.startsWith('/profile'));
  
  return (
    <button
      onClick={() => navigate(href)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
        isActive 
          ? 'bg-primary/10 text-primary border border-primary/20' 
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <span className="font-medium">{label}</span>
    </button>
  );
};

const AppContent = () => {
  const { isOpen, closeNewItem, refreshItems } = useNewItem();
  const { t } = useLanguage();
  return (
    <BrowserRouter>
      {/* Desktop and mobile responsive layout */}
      <div className="min-h-screen w-full">
        {/* Desktop layout - hidden on mobile */}
        <div className="hidden lg:flex w-full min-h-screen">
          {/* Main content area for desktop */}
          <div className="flex-1 ml-64">
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/" element={<Index />} />
              <Route path="/profile/:id" element={<ProfilePage />} />
              <Route path="/profile/edit" element={<EditProfilePage />} />
              <Route path="/items/:itemId/edit" element={<EditItemPage />} />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/event/:id" element={<EventDetailsPage />} />
              <Route path="/events/:id" element={<EventDetailsPage />} />
              <Route path="/item/:id" element={<ItemDetailsPage />} />
              <Route path="/marketplace" element={<MarketplacePage />} />
              <Route path="/neighbors" element={<NeighborsPage />} />
              <Route path="/neighborhood/:id" element={<NeighborhoodProfilePage />} />
              <Route path="/top-lists" element={<TopListsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/favorites" element={<FavoritesPage />} />
              <Route path="/create-post" element={<CreatePostPage />} />
              <Route path="/create-event" element={<CreateEventPage />} />
              <Route path="/whatsapp-qr" element={<WhatsAppQRPage />} />
              <Route path="/chatbot-errors" element={<ChatbotErrorsPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
          
          {/* Left sidebar for desktop navigation */}
          <div className="w-64 bg-card border-r shadow-sm fixed left-0 top-0 h-full overflow-y-auto">
            <div className="p-6">
              <div 
              className="title-section text-3xl cursor-pointer hover:opacity-80 transition-opacity mb-8 text-primary"
                style={{ 
                  color: 'hsl(var(--primary))', 
                  fontFamily: 'Poppins, -apple-system, BlinkMacSystemFont, sans-serif',
                  fontWeight: 700,
                  textTransform: 'lowercase',
                  letterSpacing: '-0.03em'
                }}
                onClick={() => window.location.href = '/'}
                role="button"
                aria-label="Navigate to homepage"
              >
                una
              </div>
              <nav className="space-y-2">
                <DesktopNavItem href="/" icon={Home} label={t('common.home')} />
                <DesktopNavItem href="/profile/1" icon={User} label={t('common.profile')} />
                <DesktopNavItem href="/settings" icon={Settings} label={t('common.settings')} />
              </nav>
            </div>
          </div>
        </div>
        
        {/* Mobile layout - hidden on desktop */}
        <div className="lg:hidden w-full min-h-screen">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={<Index />} />
            <Route path="/profile/:id" element={<ProfilePage />} />
            <Route path="/profile/edit" element={<EditProfilePage />} />
            <Route path="/items/:itemId/edit" element={<EditItemPage />} />
            <Route path="/events" element={<EventsPage />} />
            
            <Route path="/event/:id" element={<EventDetailsPage />} />
            <Route path="/events/:id" element={<EventDetailsPage />} />
            <Route path="/item/:id" element={<ItemDetailsPage />} />
            <Route path="/marketplace" element={<MarketplacePage />} />
            <Route path="/neighbors" element={<NeighborsPage />} />
            <Route path="/neighborhood/:id" element={<NeighborhoodProfilePage />} />
            <Route path="/top-lists" element={<TopListsPage />} />
            
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/create-post" element={<CreatePostPage />} />
            <Route path="/create-event" element={<CreateEventPage />} />
            <Route path="/whatsapp-qr" element={<WhatsAppQRPage />} />
            <Route path="/chatbot-errors" element={<ChatbotErrorsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </div>
      
      
      <SearchPopup />
    </BrowserRouter>
  );
};

const App = () => {
  return (
    <ErrorBoundary>
      <Toaster />
      <Sonner />
      <LanguageProvider>
        <AuthProvider>
          <NewItemProvider>
            <FavoritesProvider>
              <SearchProvider>
                <AppContent />
              </SearchProvider>
            </FavoritesProvider>
          </NewItemProvider>
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
};

export default App;