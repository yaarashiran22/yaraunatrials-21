
import { User, Lock, HelpCircle, Mail, LogOut, MapPin, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import BottomNavigation from "@/components/BottomNavigation";
import Header from "@/components/Header";
import LanguageSelector from "@/components/LanguageSelector";
import NeighborhoodSelector from "@/components/NeighborhoodSelector";
import { toast } from "sonner";

const SettingsPage = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { profile } = useProfile();


  const handleLogout = () => {
    logout();
    navigate('/login');
  };



  const settingsOptions = [
    {
      icon: User,
      title: "My Profile",
      onClick: () => navigate('/profile/1')
    },
    {
      icon: Lock,
      title: "Privacy",
      onClick: () => console.log('Privacy settings')
    },
    {
      icon: HelpCircle,
      title: "Help & Contact",
      onClick: () => console.log('Contact info')
    },
    {
      icon: LogOut,
      title: "Logout",
      onClick: handleLogout
    }
  ];

  return (
  <div className="min-h-screen bg-black pb-20" dir="ltr">
      <Header 
        title="Settings"
      />

  <main className="container mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="text-center mb-12">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        </div>


        {/* Language and Location Settings */}
        <div className="max-w-md mx-auto space-y-4 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-md border border-primary-200">
            <h2 className="text-lg font-semibold text-primary mb-4">Preferences</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-primary" />
                  <span className="text-primary font-semibold">Language</span>
                </div>
                <LanguageSelector />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-primary" />
                  <span className="text-primary font-semibold">Neighborhood</span>
                </div>
                <NeighborhoodSelector />
              </div>
            </div>
          </div>
        </div>


        {/* Settings Options */}
        <div className="max-w-md mx-auto space-y-4 mb-16">
          {settingsOptions.map((option, index) => {
            const IconComponent = option.icon;
            return (
              <Button
                key={index}
                variant="white"
                onClick={option.onClick}
                className="w-full h-16 border border-primary-200 rounded-2xl flex items-center justify-between px-6 shadow-md hover:bg-primary-50"
              >
                <IconComponent className="h-6 w-6 text-primary" />
                <span className="text-lg font-semibold text-primary">{option.title}</span>
                <div className="w-6"></div> {/* Spacer for balance */}
              </Button>
            );
          })}
        </div>

        {/* Contact Email */}
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl p-4 shadow-md border border-primary-200">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-primary" />
              <div className="text-sm text-primary font-semibold">
                <span className="font-semibold">yaara.shiran@gmail.com</span>
                <span className="ml-2">For questions and contact</span>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <BottomNavigation />
    </div>
  );
};

export default SettingsPage;
