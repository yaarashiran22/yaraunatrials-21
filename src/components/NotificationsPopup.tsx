import { X, Check, UserPlus, Users, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  SimplifiedModal, 
  SimplifiedModalContent, 
  SimplifiedModalHeader, 
  SimplifiedModalTitle, 
  SimplifiedModalBody 
} from "@/components/ui/simplified-modal";
import { useNotifications } from "@/hooks/useNotifications";
import { useMeetupJoinRequests } from "@/hooks/useMeetupJoinRequests";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface NotificationsPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationsPopup = ({ isOpen, onClose }: NotificationsPopupProps) => {
  const { notifications, loading, markAsRead, markAllAsRead, refreshNotifications } = useNotifications();
  const { handleJoinRequest } = useMeetupJoinRequests();
  const [processingRequests, setProcessingRequests] = useState<Set<string>>(new Set());
  const { t } = useLanguage();

  if (!isOpen) return null;

  const handleMeetupJoinRequestAction = async (notificationId: string, relatedUserId: string, action: 'approve' | 'decline') => {
    if (processingRequests.has(notificationId)) return;
    
    setProcessingRequests(prev => new Set(prev).add(notificationId));
    
    try {
      // Get the RSVP ID from the notification - we'll need to fetch this
      // For now, we'll get all pending RSVPs for this user and find the right one
      const { data: rsvps, error } = await supabase
        .from('event_rsvps')
        .select('id, event_id, events!inner(title, user_id)')
        .eq('user_id', relatedUserId)
        .eq('status', 'pending');

      if (error || !rsvps?.length) {
        throw new Error('Could not find join request');
      }

      // Find the RSVP that matches this notification
      const rsvp = rsvps[0]; // For now, take the first pending request
      
      const success = await handleJoinRequest(rsvp.id, action === 'approve' ? 'approved' : 'declined');

      if (success) {
        markAsRead(notificationId);
        setTimeout(() => refreshNotifications(), 500);
      }
    } catch (error) {
      console.error('Error handling meetup join request:', error);
    } finally {
      setProcessingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });
    }
  };


  const handleNotificationClick = (notificationId: string, isRead: boolean) => {
    if (!isRead) {
      markAsRead(notificationId);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true
      });
    } catch {
      return "Unknown time";
    }
  };

  return (
    <SimplifiedModal open={isOpen} onOpenChange={onClose}>
      <SimplifiedModalContent className="max-w-lg max-h-[85vh] bg-white">
        <SimplifiedModalHeader>
          <SimplifiedModalTitle>Notifications</SimplifiedModalTitle>
          {notifications.length > 0 && (
            <Button 
              variant="ghost" 
              size="default" 
              onClick={markAllAsRead}
              className="absolute right-16 top-6"
            >
              Mark all read
            </Button>
          )}
        </SimplifiedModalHeader>

        <SimplifiedModalBody className="overflow-y-auto max-h-[60vh] px-0">
          {loading ? (
            <div className="flex items-center justify-center py-content-spacious">
              <div className="text-muted-foreground text-lg">Loading notifications...</div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex items-center justify-center py-content-spacious">
              <div className="text-muted-foreground text-center">
                <div className="mb-2 text-lg">No new notifications</div>
                <div className="text-base">We'll update you here about new activities</div>
              </div>
            </div>
          ) : (
            notifications.map((notification) => (
              <div 
                key={notification.id} 
                className={`flex items-start gap-4 p-content-normal border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors ${
                  !notification.is_read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                }`}
                onClick={() => handleNotificationClick(notification.id, notification.is_read)}
              >
                {notification.related_user?.profile_image_url ? (
                  <img 
                    src={notification.related_user.profile_image_url}
                    alt="Profile"
                    className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-base font-medium">
                      {notification.related_user?.name?.charAt(0) || '?'}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-base text-foreground leading-relaxed mb-2">
                      {notification.related_user?.name && (
                        <span className="font-medium">{notification.related_user.name} </span>
                      )}
                      {notification.message}
                    </p>
                    {!notification.is_read && (
                      <div className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0 mt-1"></div>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatTimeAgo(notification.created_at)}
                  </span>
                 
                 {processingRequests.has(notification.id) && (
                   <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                     <div className="animate-spin w-4 h-4 border border-current border-t-transparent rounded-full"></div>
                     Processing...
                   </div>
                 )}
                </div>
              </div>
            ))
          )}
        </SimplifiedModalBody>
      </SimplifiedModalContent>
    </SimplifiedModal>
  );
};

export default NotificationsPopup;