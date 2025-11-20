import { Plus, PenTool, Calendar, ShoppingBag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import CreateEventPopup from "./CreateEventPopup";

const CreateActionSelector = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const [isOpen, setIsOpen] = useState(false);
  const [showEventPopup, setShowEventPopup] = useState(false);


  const actions = [
    {
      icon: PenTool,
      label: t('navigation.createPost'),
      onClick: () => {
        navigate('/create-post');
        setIsOpen(false);
      },
      visible: true // Always visible for all users
    },
    {
      icon: Calendar,
      label: t('navigation.createEvent'),
      onClick: () => {
        setShowEventPopup(true);
        setIsOpen(false);
      },
      visible: true // Anyone can create events
    },
    {
      icon: ShoppingBag,
      label: t('navigation.createItem'),
      onClick: () => {
        navigate('/new-item');
        setIsOpen(false);
      },
      visible: true // Always visible for all users
    }
  ].filter(action => action.visible); // Filter out non-visible actions

  if (isOpen) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
        <div className="bg-background rounded-2xl p-6 mx-4 w-full max-w-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-foreground">{t('common.whatWouldYouLikeToCreate')}</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-3">
            {actions.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                className="w-full h-12 justify-start gap-3"
                onClick={action.onClick}
              >
                <action.icon className="h-5 w-5" />
                <span>{action.label}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Button
        size="lg"
        onClick={() => setIsOpen(true)}
        className="rounded-full w-14 h-14 shadow-lg flex flex-col items-center justify-center"
        style={{ backgroundColor: '#BB31E9', color: 'hsl(0 0% 100%)' }}
      >
        <Plus className="h-6 w-6 text-primary-foreground" />
      </Button>
      
      <CreateEventPopup 
        isOpen={showEventPopup}
        onClose={() => setShowEventPopup(false)}
        onEventCreated={() => {
          setShowEventPopup(false);
          // Optionally refresh events data here
        }}
      />
    </>
  );
};

export default CreateActionSelector;
