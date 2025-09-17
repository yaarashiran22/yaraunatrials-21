import { Calendar, MapPin, Users, Trash2, Pencil, Edit, X, Star, Heart, MessageCircle, Share2, Bell, ChevronLeft, ChevronRight, Play, Pause, Instagram, Settings, Gift, Plus, LogOut, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { useSecureAuth } from "@/hooks/useSecureAuth";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserMessages } from "@/hooks/useUserMessages";
import { validateUUID, canUserModifyItem } from "@/utils/security";
import { useToast } from "@/hooks/use-toast";
import BottomNavigation from "@/components/BottomNavigation";
import Header from "@/components/Header";
import { useUserEvents } from "@/hooks/useUserEvents";
import { InstagramStoryPopup } from "@/components/InstagramStoryPopup";
import { useFriends } from "@/hooks/useFriends";
import { useFollowing } from "@/hooks/useFollowing";
import { useProfile } from "@/hooks/useProfile";
import { useUserPosts } from "@/hooks/useUserPosts";
import { getRelativeDay } from "@/utils/dateUtils";
import SectionHeader from "@/components/SectionHeader";
import UniformCard from "@/components/UniformCard";
import ProfilePictureViewer from "@/components/ProfilePictureViewer";
import { FeedImageViewer } from "@/components/FeedImageViewer";
import EditEventPopup from "@/components/EditEventPopup";
import { EditCouponModal } from "@/components/EditCouponModal";
import { supabase } from "@/integrations/supabase/client";

import { useMyCoupons } from "@/hooks/useUserCoupons";

import profile1 from "@/assets/profile-1.jpg";
import communityEvent from "@/assets/community-event.jpg";

const ProfilePage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, requireAuth, canAccessResource } = useSecureAuth();
  const { toast } = useToast();
  
  // Use security utility for UUID validation - memoized to prevent re-renders
  const actualProfileId = useMemo(() => {
    if (!id || !validateUUID(id)) {
      return user?.id;
    }
    return id;
  }, [id, user?.id]);
  
  // Check if this is the current user's profile - memoized
  const isOwnProfile = useMemo(() => {
    return user && (!id || !validateUUID(id) || actualProfileId === user.id);
  }, [user, id, actualProfileId]);
  const { profile: profileData, loading, error, refetch } = useProfile(actualProfileId);
  const { events: userEvents, loading: eventsLoading, deleteEvent, refetch: refetchEvents } = useUserEvents(actualProfileId);
  const { imagePosts, loading: postsLoading } = useUserPosts(actualProfileId);
  const { addFriend, isFriend } = useFriends();
  const { isFollowing, toggleFollow, isToggling } = useFollowing();
  const { myCoupons, loading: couponsLoading, deleteCoupon, deleting: deletingCoupon, refreshCoupons } = useMyCoupons(user?.id);
  const { messages, loading: messagesLoading, creating: creatingMessage, updating: updatingMessage, createMessage, updateMessage, deleteMessage } = useUserMessages(actualProfileId);
  
  
  const [showStoryPopup, setShowStoryPopup] = useState(false);
  const [generatedStoryUrl, setGeneratedStoryUrl] = useState<string | null>(null);
  const [generatingStory, setGeneratingStory] = useState(false);
  const [currentEventTitle, setCurrentEventTitle] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState("");
  const [showProfilePicture, setShowProfilePicture] = useState(false);
  const [showFeedImages, setShowFeedImages] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [showEditEvent, setShowEditEvent] = useState(false);
  const [selectedEventForEdit, setSelectedEventForEdit] = useState<any>(null);
  const [showEditCoupon, setShowEditCoupon] = useState(false);
  const [selectedCouponForEdit, setSelectedCouponForEdit] = useState<any>(null);

  // Function to extract dominant colors from an image
  const extractImageColors = (img: HTMLImageElement): { primary: string; secondary: string } => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    // Use smaller canvas for color sampling for performance
    const sampleSize = 50;
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    
    ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
    const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
    const data = imageData.data;
    
    const colorCounts: { [key: string]: number } = {};
    
    // Sample colors from the image
    for (let i = 0; i < data.length; i += 16) { // Sample every 4th pixel
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const alpha = data[i + 3];
      
      // Skip transparent pixels
      if (alpha < 128) continue;
      
      // Group similar colors together (reduce precision)
      const rGroup = Math.floor(r / 32) * 32;
      const gGroup = Math.floor(g / 32) * 32;
      const bGroup = Math.floor(b / 32) * 32;
      
      const colorKey = `${rGroup},${gGroup},${bGroup}`;
      colorCounts[colorKey] = (colorCounts[colorKey] || 0) + 1;
    }
    
    // Get the most common colors
    const sortedColors = Object.entries(colorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);
    
    if (sortedColors.length === 0) {
      // Fallback to default colors
      return { primary: '#3B82F6', secondary: '#8B5CF6' };
    }
    
    const [r1, g1, b1] = sortedColors[0][0].split(',').map(Number);
    const primary = `rgb(${r1}, ${g1}, ${b1})`;
    
    let secondary = primary;
    if (sortedColors.length > 1) {
      const [r2, g2, b2] = sortedColors[1][0].split(',').map(Number);
      secondary = `rgb(${r2}, ${g2}, ${b2})`;
    } else {
      // Create a complementary color if only one dominant color
      const hsl = rgbToHsl(r1, g1, b1);
      const compHue = (hsl.h + 180) % 360;
      secondary = `hsl(${compHue}, ${hsl.s}%, ${Math.max(30, hsl.l - 20)}%)`;
    }
    
    return { primary, secondary };
  };

  // Helper function to convert RGB to HSL
  const rgbToHsl = (r: number, g: number, b: number) => {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    
    return { h: h * 360, s: s * 100, l: l * 100 };
  };

  const generateInstagramStory = async (eventData: any) => {
    setGeneratingStory(true);
    setCurrentEventTitle(eventData.title);
    setShowStoryPopup(true);
    
    try {
      // Create story prompt based on event data
      const eventDate = eventData.date ? `Date: ${eventData.date}` : '';
      const eventTime = eventData.time ? `Time: ${eventData.time}` : '';
      const eventLocation = eventData.location ? `Location: ${eventData.location}` : '';
      const eventPrice = eventData.price ? `Price: ${eventData.price}` : 'Free Entry';
      
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d')!;
      
      // Default gradient colors
      let primaryColor = '#3B82F6'; // blue
      let secondaryColor = '#8B5CF6'; // purple
      
      // Load and add event image if available, and extract colors
      let eventImageElement: HTMLImageElement | null = null;
      if (eventData.image_url || eventData.video_url) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = eventData.image_url || eventData.video_url;
          });
          
          eventImageElement = img;
          
          // Extract colors from the image
          const extractedColors = extractImageColors(img);
          primaryColor = extractedColors.primary;
          secondaryColor = extractedColors.secondary;
          
        } catch (error) {
          console.warn('Failed to load event image for color extraction:', error);
        }
      }
      
      // Create sophisticated gradient background using extracted or default colors
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      
      // Use more mature, muted color palette
      const matureColors = {
        primary: primaryColor === '#3B82F6' ? '#2D3748' : primaryColor, // Dark slate
        secondary: secondaryColor === '#8B5CF6' ? '#4A5568' : secondaryColor, // Warm gray
        accent: '#E2E8F0' // Light gray accent
      };
      
      gradient.addColorStop(0, matureColors.primary);
      gradient.addColorStop(0.6, matureColors.secondary);
      gradient.addColorStop(1, matureColors.accent);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add subtle texture overlay for sophistication
      ctx.save();
      ctx.globalAlpha = 0.03;
      for (let i = 0; i < 200; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        ctx.fillStyle = Math.random() > 0.5 ? 'white' : 'black';
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.restore();
      
      // Draw the event image if loaded
      if (eventImageElement) {
        try {
          // Calculate image dimensions to fit in larger upper portion of story
          const imageHeight = 1100; // Larger upper portion height (was 800)
          const imageWidth = canvas.width;
          const aspectRatio = eventImageElement.width / eventImageElement.height;
          
          let drawWidth = imageWidth;
          let drawHeight = imageWidth / aspectRatio;
          
          if (drawHeight > imageHeight) {
            drawHeight = imageHeight;
            drawWidth = imageHeight * aspectRatio;
          }
          
          const x = (canvas.width - drawWidth) / 2;
          const y = 50; // Reduced margin for larger image (was 100)
          
          // Draw image with rounded corners effect
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(x, y, drawWidth, drawHeight, 20);
          ctx.clip();
          ctx.drawImage(eventImageElement, x, y, drawWidth, drawHeight);
          ctx.restore();
          
          // Add semi-transparent overlay for text readability
          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.fillRect(0, y + drawHeight - 200, canvas.width, 200);
        } catch (error) {
          console.warn('Failed to draw event image:', error);
        }
      }
      
      // Add user profile image and name
      if (profileData?.profile_image_url || profileData?.name) {
        // Add user profile circle at bottom left
        const profileCircleX = 120;
        const profileCircleY = canvas.height - 120;
        const profileCircleRadius = 50;
        
        // Draw profile circle background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(profileCircleX, profileCircleY, profileCircleRadius + 5, 0, Math.PI * 2);
        ctx.fill();
        
        if (profileData.profile_image_url) {
          try {
            const profileImg = new Image();
            profileImg.crossOrigin = 'anonymous';
            
            await new Promise((resolve, reject) => {
              profileImg.onload = resolve;
              profileImg.onerror = reject;
              profileImg.src = profileData.profile_image_url;
            });
            
            // Draw circular profile image
            ctx.save();
            ctx.beginPath();
            ctx.arc(profileCircleX, profileCircleY, profileCircleRadius, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(profileImg, 
              profileCircleX - profileCircleRadius, 
              profileCircleY - profileCircleRadius, 
              profileCircleRadius * 2, 
              profileCircleRadius * 2
            );
            ctx.restore();
          } catch (error) {
            console.warn('Failed to load profile image:', error);
            // Fallback to initials if profile image fails
            if (profileData.name) {
              ctx.fillStyle = '#3B82F6';
              ctx.beginPath();
              ctx.arc(profileCircleX, profileCircleY, profileCircleRadius, 0, Math.PI * 2);
              ctx.fill();
              
              ctx.fillStyle = 'white';
              ctx.font = 'bold 32px Poppins, sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText(profileData.name.charAt(0).toUpperCase(), profileCircleX, profileCircleY + 10);
            }
          }
        } else if (profileData.name) {
          // Draw initials circle
          ctx.fillStyle = '#3B82F6';
          ctx.beginPath();
          ctx.arc(profileCircleX, profileCircleY, profileCircleRadius, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.fillStyle = 'white';
          ctx.font = 'bold 32px Poppins, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(profileData.name.charAt(0).toUpperCase(), profileCircleX, profileCircleY + 10);
        }
        
        // Add user name next to profile circle
        if (profileData.name) {
          ctx.fillStyle = 'white';
          ctx.font = 'bold 28px Nunito, sans-serif';
          ctx.textAlign = 'left';
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.lineWidth = 2;
          ctx.strokeText(`Organized by ${profileData.name}`, profileCircleX + profileCircleRadius + 20, profileCircleY + 8);
          ctx.fillText(`Organized by ${profileData.name}`, profileCircleX + profileCircleRadius + 20, profileCircleY + 8);
        }
      }
      
      
      // Add sophisticated minimal decorations
      ctx.save();
      ctx.globalAlpha = 0.08;
      
      // Add elegant line elements instead of geometric shapes
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      
      // Vertical lines for elegance
      for (let i = 0; i < 5; i++) {
        const x = 100 + (i * 200);
        ctx.beginPath();
        ctx.moveTo(x, 100);
        ctx.lineTo(x + 50, 300);
        ctx.stroke();
      }
      
      // Subtle circular elements
      for (let i = 0; i < 3; i++) {
        const x = 200 + (i * 300);
        const y = 800 + (i * 100);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 80 + (i * 20), 0, Math.PI * 2);
        ctx.stroke();
      }
      
      ctx.restore();

      // Add sophisticated minimal info card
      const cardWidth = 800;
      const cardHeight = 380;
      const cardX = (canvas.width - cardWidth) / 2;
      const cardY = 1250;
      
      // Minimalist card background
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 8);
      ctx.fill();
      
      // Subtle border with sophistication
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // Elegant, sophisticated title
      const titleY = eventData.image_url || eventData.video_url ? 1050 : 500;
      ctx.save();
      
      // Clean, modern typography
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '300 64px "Inter", "Helvetica Neue", sans-serif'; // Light weight for elegance
      ctx.textAlign = 'center';
      
      // Subtle shadow for depth
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
      ctx.shadowBlur = 8;
      
      const titleWords = eventData.title.split(' ');
      let currentTitleY = titleY;
      for (let i = 0; i < titleWords.length; i += 2) {
        const line = titleWords.slice(i, i + 2).join(' ');
        ctx.fillText(line, canvas.width / 2, currentTitleY);
        currentTitleY += 75;
      }
      ctx.restore();
      
      // Clean, minimal info display
      const infoY = cardY + 60;
      const iconSize = 24;
      const textOffsetX = 40;
      
      ctx.font = '400 32px "Inter", "Helvetica Neue", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.shadowColor = 'none';
      
      let currentInfoY = infoY;
      
      // Minimal date display
      if (eventData.date) {
        ctx.save();
        // Simple line icon for date
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(canvas.width / 2 - 200, currentInfoY - iconSize/2, iconSize, iconSize, 4);
        ctx.stroke();
        
        // Date dot
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(canvas.width / 2 - 200 + iconSize/2, currentInfoY, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillText(eventData.date, canvas.width / 2 - 200 + textOffsetX, currentInfoY + 8);
        currentInfoY += 65;
      }
      
      // Draw modern clock icon and time
      if (eventData.time) {
        ctx.save();
        // Clock icon (circle with hands)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(canvas.width / 2 - 202, currentInfoY - 5, iconSize/2, 0, Math.PI * 2);
        ctx.stroke();
        
        // Clock hands
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2 - 202, currentInfoY - 5);
        ctx.lineTo(canvas.width / 2 - 202, currentInfoY - 20);
        ctx.moveTo(canvas.width / 2 - 202, currentInfoY - 5);
        ctx.lineTo(canvas.width / 2 - 190, currentInfoY - 5);
        ctx.stroke();
        ctx.restore();
        
        ctx.fillStyle = 'white';
        ctx.strokeText(eventData.time, canvas.width / 2 - 220 + textOffsetX, currentInfoY + 8);
        ctx.fillText(eventData.time, canvas.width / 2 - 220 + textOffsetX, currentInfoY + 8);
        currentInfoY += 75;
      }
      
      // Minimal location display
      if (eventData.location) {
        ctx.save();
        // Simple location marker
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        const pinX = canvas.width / 2 - 200 + iconSize/2;
        const pinY = currentInfoY;
        
        ctx.beginPath();
        ctx.arc(pinX, pinY - 4, 6, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(pinX, pinY + 2);
        ctx.lineTo(pinX, pinY + 8);
        ctx.stroke();
        
        ctx.restore();
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillText(eventData.location, canvas.width / 2 - 200 + textOffsetX, currentInfoY + 8);
        currentInfoY += 65;
      }
      
      // Minimal price display
      if (eventData.price) {
        ctx.save();
        // Simple price indicator
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        
        const tagX = canvas.width / 2 - 200;
        const tagY = currentInfoY;
        
        // Minimal tag outline
        ctx.beginPath();
        ctx.roundRect(tagX, tagY - 8, iconSize * 0.8, 16, 3);
        ctx.stroke();
        
        // Price dot
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(tagX + 6, tagY, 2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillText(eventData.price, canvas.width / 2 - 200 + textOffsetX, currentInfoY + 8);
      } else {
        // Elegant "FREE" display for no price
        ctx.save();
        // Minimal free indicator
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1;
        
        ctx.beginPath();
        ctx.roundRect(canvas.width / 2 - 200, currentInfoY - 8, iconSize * 1.2, 16, 8);
        ctx.stroke();
        
        ctx.restore();
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillText('FREE ENTRY', canvas.width / 2 - 200 + textOffsetX, currentInfoY + 8);
      }
      
      // Sophisticated, minimal call to action
      ctx.save();
      ctx.font = '500 36px "Inter", "Helvetica Neue", sans-serif';
      ctx.textAlign = 'center';
      
      // Subtle emphasis
      ctx.shadowColor = 'rgba(255, 255, 255, 0.1)';
      ctx.shadowBlur = 4;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.fillText('JOIN THE EVENT!', canvas.width / 2, canvas.height - 180);
      
      // Add border text effect
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
      ctx.lineWidth = 3;
      ctx.strokeText('JOIN THE EVENT!', canvas.width / 2, canvas.height - 180);
      ctx.restore();
      
      // Convert canvas to blob URL
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png');
      });
      
      const storyUrl = URL.createObjectURL(blob);
      setGeneratedStoryUrl(storyUrl);
      
    } catch (error) {
      console.error('Error generating Instagram story:', error);
      toast({
        title: "Story Generation Failed",
        description: "Failed to generate Instagram story. Please try again.",
        variant: "destructive",
      });
      setShowStoryPopup(false);
    } finally {
      setGeneratingStory(false);
    }
  };

  const generateCouponInstagramStory = async (couponData: any) => {
    setGeneratingStory(true);
    setCurrentEventTitle(couponData.title);
    setShowStoryPopup(true);
    
    try {
      // Create canvas for coupon story
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d')!;
      
      // Default gradient colors
      let primaryColor = '#8B5CF6'; // purple
      let secondaryColor = '#EC4899'; // pink
      
      // Load and add coupon image if available, and extract colors
      let couponImageElement: HTMLImageElement | null = null;
      if (couponData.image_url) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = couponData.image_url;
          });
          
          couponImageElement = img;
          
          // Extract colors from the image
          const extractedColors = extractImageColors(img);
          primaryColor = extractedColors.primary;
          secondaryColor = extractedColors.secondary;
          
        } catch (error) {
          console.warn('Failed to load coupon image for color extraction:', error);
        }
      }
      
      // Create gradient background using extracted or default colors
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, primaryColor);
      gradient.addColorStop(1, secondaryColor);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw the coupon image if loaded
      if (couponImageElement) {
        try {
          // Calculate image dimensions to fit in larger upper portion of story
          const imageHeight = 900; // Larger upper portion height (was 700)
          const imageWidth = canvas.width;
          const aspectRatio = couponImageElement.width / couponImageElement.height;
          
          let drawWidth = imageWidth;
          let drawHeight = imageWidth / aspectRatio;
          
          if (drawHeight > imageHeight) {
            drawHeight = imageHeight;
            drawWidth = imageHeight * aspectRatio;
          }
          
          const x = (canvas.width - drawWidth) / 2;
          const y = 100; // Reduced margin for larger image (was 150)
          
          // Draw image with rounded corners effect
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(x, y, drawWidth, drawHeight, 20);
          ctx.clip();
          ctx.drawImage(couponImageElement, x, y, drawWidth, drawHeight);
          ctx.restore();
          
          // Add semi-transparent overlay for text readability
          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.fillRect(0, y + drawHeight - 150, canvas.width, 150);
        } catch (error) {
          console.warn('Failed to draw coupon image:', error);
        }
      }
      
      // Add user profile image and name
      if (profileData?.profile_image_url || profileData?.name) {
        // Add user profile circle at bottom left
        const profileCircleX = 120;
        const profileCircleY = canvas.height - 120;
        const profileCircleRadius = 50;
        
        // Draw profile circle background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(profileCircleX, profileCircleY, profileCircleRadius + 5, 0, Math.PI * 2);
        ctx.fill();
        
        if (profileData.profile_image_url) {
          try {
            const profileImg = new Image();
            profileImg.crossOrigin = 'anonymous';
            
            await new Promise((resolve, reject) => {
              profileImg.onload = resolve;
              profileImg.onerror = reject;
              profileImg.src = profileData.profile_image_url;
            });
            
            // Draw circular profile image
            ctx.save();
            ctx.beginPath();
            ctx.arc(profileCircleX, profileCircleY, profileCircleRadius, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(profileImg, 
              profileCircleX - profileCircleRadius, 
              profileCircleY - profileCircleRadius, 
              profileCircleRadius * 2, 
              profileCircleRadius * 2
            );
            ctx.restore();
          } catch (error) {
            console.warn('Failed to load profile image:', error);
            // Fallback to initials if profile image fails
            if (profileData.name) {
              ctx.fillStyle = '#8B5CF6';
              ctx.beginPath();
              ctx.arc(profileCircleX, profileCircleY, profileCircleRadius, 0, Math.PI * 2);
              ctx.fill();
              
              ctx.fillStyle = 'white';
              ctx.font = 'bold 32px Poppins, sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText(profileData.name.charAt(0).toUpperCase(), profileCircleX, profileCircleY + 10);
            }
          }
        } else if (profileData.name) {
          // Draw initials circle
          ctx.fillStyle = '#8B5CF6';
          ctx.beginPath();
          ctx.arc(profileCircleX, profileCircleY, profileCircleRadius, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.fillStyle = 'white';
          ctx.font = 'bold 32px Poppins, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(profileData.name.charAt(0).toUpperCase(), profileCircleX, profileCircleY + 10);
        }
        
        // Add user name next to profile circle
        if (profileData.name) {
          ctx.fillStyle = 'white';
          ctx.font = 'bold 28px Nunito, sans-serif';
          ctx.textAlign = 'left';
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.lineWidth = 2;
          ctx.strokeText(`Posted by ${profileData.name}`, profileCircleX + profileCircleRadius + 20, profileCircleY + 8);
          ctx.fillText(`Posted by ${profileData.name}`, profileCircleX + profileCircleRadius + 20, profileCircleY + 8);
        }
      }
      
      
      // Add modern floating elements
      ctx.save();
      ctx.globalAlpha = 0.12;
      
      // Create dynamic floating shapes
      for (let i = 0; i < 20; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = Math.random() * 35 + 15;
        
        ctx.fillStyle = i % 2 === 0 ? 'white' : primaryColor;
        
        if (i % 4 === 0) {
          // Hexagons
          ctx.beginPath();
          for (let j = 0; j < 6; j++) {
            const angle = (j * Math.PI) / 3;
            const hexX = x + size * Math.cos(angle);
            const hexY = y + size * Math.sin(angle);
            if (j === 0) ctx.moveTo(hexX, hexY);
            else ctx.lineTo(hexX, hexY);
          }
          ctx.closePath();
          ctx.fill();
        } else if (i % 4 === 1) {
          // Diamonds
          ctx.beginPath();
          ctx.moveTo(x, y - size);
          ctx.lineTo(x + size, y);
          ctx.lineTo(x, y + size);
          ctx.lineTo(x - size, y);
          ctx.closePath();
          ctx.fill();
        } else {
          // Circles
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // Modern coupon card design
      const cardWidth = 920;
      const cardHeight = 500;
      const cardX = (canvas.width - cardWidth) / 2;
      const cardY = 1150;
      
      // Coupon card with gradient and glassmorphism
      ctx.save();
      const cardGradient = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardHeight);
      cardGradient.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
      cardGradient.addColorStop(1, 'rgba(255, 255, 255, 0.1)');
      ctx.fillStyle = cardGradient;
      
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 30);
      ctx.fill();
      
      // Coupon border with dashed effect
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 3;
      ctx.setLineDash([15, 10]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Title with modern typography
      const titleY = couponData.image_url ? 800 : 350;
      ctx.save();
      
      const titleGradient = ctx.createLinearGradient(0, titleY - 60, 0, titleY + 60);
      titleGradient.addColorStop(0, '#FFFFFF');
      titleGradient.addColorStop(1, '#D0D0D0');
      
      ctx.fillStyle = titleGradient;
      ctx.font = 'bold 82px Poppins, sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.lineWidth = 3;
      
      const titleWords = couponData.title.split(' ');
      let currentTitleY = titleY;
      for (let i = 0; i < titleWords.length; i += 2) {
        const line = titleWords.slice(i, i + 2).join(' ');
        ctx.strokeText(line, canvas.width / 2, currentTitleY);
        ctx.fillText(line, canvas.width / 2, currentTitleY);
        currentTitleY += 95;
      }
      ctx.restore();
      
      // Prominent discount badge
      if (couponData.discount_amount) {
        ctx.save();
        
        // Discount circle background
        ctx.fillStyle = '#FF6B6B';
        ctx.beginPath();
        ctx.arc(canvas.width / 2, currentTitleY + 100, 85, 0, Math.PI * 2);
        ctx.fill();
        
        // Discount circle border
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 8;
        ctx.stroke();
        
        // Discount text with glow
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 15;
        ctx.font = 'bold 95px Montserrat, sans-serif';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(couponData.discount_amount, canvas.width / 2, currentTitleY + 115);
        
        ctx.restore();
        currentTitleY += 220;
      }
      
      // Modern info display with geometric icons
      const infoY = cardY + 100;
      const iconSize = 38;
      const textOffsetX = 65;
      
      ctx.font = '48px Nunito, sans-serif';
      ctx.fillStyle = 'white';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.lineWidth = 2;
      
      let currentInfoY = infoY;
      
      // Business icon and name
      if (couponData.business_name) {
        ctx.save();
        // Store/building icon (simplified)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(canvas.width / 2 - 250, currentInfoY - iconSize/2, iconSize, iconSize);
        ctx.fillStyle = secondaryColor;
        ctx.fillRect(canvas.width / 2 - 250, currentInfoY - iconSize/2, iconSize, 12);
        
        // Store front details
        ctx.fillStyle = 'rgba(100, 100, 100, 0.8)';
        ctx.fillRect(canvas.width / 2 - 240, currentInfoY - 5, 8, 15);
        ctx.fillRect(canvas.width / 2 - 225, currentInfoY - 5, 8, 15);
        ctx.restore();
        
        ctx.fillStyle = 'white';
        ctx.strokeText(couponData.business_name, canvas.width / 2 - 250 + textOffsetX, currentInfoY + 10);
        ctx.fillText(couponData.business_name, canvas.width / 2 - 250 + textOffsetX, currentInfoY + 10);
        currentInfoY += 85;
      }
      
      // Location icon and neighborhood
      if (couponData.neighborhood) {
        ctx.save();
        // Modern location pin
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(canvas.width / 2 - 232, currentInfoY - 10, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2 - 232, currentInfoY + 4);
        ctx.lineTo(canvas.width / 2 - 222, currentInfoY + 18);
        ctx.lineTo(canvas.width / 2 - 242, currentInfoY + 18);
        ctx.closePath();
        ctx.fill();
        
        // Inner dot
        ctx.fillStyle = secondaryColor;
        ctx.beginPath();
        ctx.arc(canvas.width / 2 - 232, currentInfoY - 10, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        ctx.fillStyle = 'white';
        ctx.strokeText(couponData.neighborhood, canvas.width / 2 - 250 + textOffsetX, currentInfoY + 10);
        ctx.fillText(couponData.neighborhood, canvas.width / 2 - 250 + textOffsetX, currentInfoY + 10);
        currentInfoY += 85;
      }
      
      // Expiry icon and date
      if (couponData.valid_until) {
        ctx.save();
        // Modern clock/timer icon
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(canvas.width / 2 - 232, currentInfoY - 5, iconSize/2.2, 0, Math.PI * 2);
        ctx.stroke();
        
        // Clock hands
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2 - 232, currentInfoY - 5);
        ctx.lineTo(canvas.width / 2 - 232, currentInfoY - 18);
        ctx.moveTo(canvas.width / 2 - 232, currentInfoY - 5);
        ctx.lineTo(canvas.width / 2 - 218, currentInfoY - 5);
        ctx.stroke();
        
        // Timer indicator dots
        for (let i = 0; i < 4; i++) {
          const angle = (i * Math.PI) / 2;
          const dotX = canvas.width / 2 - 232 + 20 * Math.cos(angle);
          const dotY = currentInfoY - 5 + 20 * Math.sin(angle);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.beginPath();
          ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        
        ctx.fillStyle = 'white';
        ctx.strokeText(`Valid until ${couponData.valid_until}`, canvas.width / 2 - 250 + textOffsetX, currentInfoY + 10);
        ctx.fillText(`Valid until ${couponData.valid_until}`, canvas.width / 2 - 250 + textOffsetX, currentInfoY + 10);
      }
      
      // Modern call to action with neon effect
      ctx.save();
      ctx.font = 'bold 65px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      
      // Create neon glow effect
      ctx.shadowColor = '#FF6B6B';
      ctx.shadowBlur = 25;
      ctx.fillStyle = '#FF6B6B';
      ctx.fillText('CLAIM OFFER!', canvas.width / 2, canvas.height - 170);
      
      // Add bright outline
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255, 107, 107, 0.8)';
      ctx.lineWidth = 4;
      ctx.strokeText('CLAIM OFFER!', canvas.width / 2, canvas.height - 170);
      ctx.restore();
      
      // Convert canvas to blob URL
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png');
      });
      
      const storyUrl = URL.createObjectURL(blob);
      setGeneratedStoryUrl(storyUrl);
      
    } catch (error) {
      console.error('Error generating Instagram story:', error);
      toast({
        title: "Story Generation Failed",
        description: "Failed to generate Instagram story. Please try again.",
        variant: "destructive",
      });
      setShowStoryPopup(false);
    } finally {
      setGeneratingStory(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    console.log('Delete event clicked for ID:', eventId);
    
    // Require authentication
    if (!requireAuth()) {
      console.log('Authentication required failed');
      return;
    }

    // Verify user can delete this event
    const event = userEvents.find(event => event.id === eventId);
    console.log('Found event:', event);
    console.log('User ID:', user?.id);
    console.log('Event user_id:', event?.user_id);
    
    if (!event || !canUserModifyItem(user!.id, event.user_id)) {
      console.log('Permission check failed');
      toast({
        title: "Authorization Error",
        description: "You don't have permission to delete this event",
        variant: "destructive",
      });
      return;
    }

    if (window.confirm('Are you sure you want to delete this event?')) {
      console.log('User confirmed deletion, calling deleteEvent...');
      const result = await deleteEvent(eventId);
      console.log('Delete result:', result);
    }
  };

  const handleEditEvent = (eventId: string) => {
    // Require authentication
    if (!requireAuth()) {
      return;
    }

    // Verify user can edit this event
    const event = userEvents.find(event => event.id === eventId);
    if (!event || !canUserModifyItem(user!.id, event.user_id)) {
      toast({
        title: "Authorization Error",
        description: "You don't have permission to edit this event",
        variant: "destructive",
      });
      return;
    }

    setSelectedEventForEdit(event);
    setShowEditEvent(true);
  };

  const handleDeleteCoupon = async (couponId: string) => {
    if (!requireAuth()) return;

    const coupon = myCoupons.find(c => c.id === couponId);
    if (!coupon || !canUserModifyItem(user!.id, coupon.user_id)) {
      toast({
        title: "Authorization Error",
        description: "You don't have permission to delete this coupon",
        variant: "destructive",
      });
      return;
    }

    if (window.confirm('Are you sure you want to delete this coupon?')) {
      deleteCoupon(couponId);
    }
  };

  const handleEditCoupon = (couponId: string) => {
    if (!requireAuth()) return;

    const coupon = myCoupons.find(c => c.id === couponId);
    if (!coupon || !canUserModifyItem(user!.id, coupon.user_id)) {
      toast({
        title: "Authorization Error",
        description: "You don't have permission to edit this coupon",
        variant: "destructive",
      });
      return;
    }

    setSelectedCouponForEdit(coupon);
    setShowEditCoupon(true);
  };

  // Listen for profile updates (when returning from edit page)
  useEffect(() => {
    const handleFocus = () => {
      refetch();
      refetchEvents(); // Also refresh events when page regains focus
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetch, refetchEvents]);

  // Also refetch when returning from navigation
  useEffect(() => {
    refetch();
  }, [id, user?.id]);

  const handleLogout = () => {
    navigate('/login');
  };

  const handleAddMessage = async () => {
    if (!newMessage.trim()) return;
    
    const success = await createMessage(newMessage);
    if (success) {
      setNewMessage("");
    }
  };

  const handleEditMessage = (messageId: string, currentText: string) => {
    setEditingMessageId(messageId);
    setEditingMessageText(currentText);
  };

  const handleUpdateMessage = async () => {
    if (!editingMessageId || !editingMessageText.trim()) return;
    
    const success = await updateMessage(editingMessageId, editingMessageText);
    if (success) {
      setEditingMessageId(null);
      setEditingMessageText("");
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingMessageText("");
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      await deleteMessage(messageId);
    }
  };

  const handleAddFriend = async () => {
    if (!actualProfileId || isOwnProfile) return;
    
    const success = await addFriend(actualProfileId);
    if (success) {
      // Friend added successfully
    }
  };


  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20" dir="ltr">
        <Header 
          title="Profile"
        />
        <main className="px-4 py-6 pb-20">
          <div className="text-center">Loading...</div>
        </main>
        <BottomNavigation />
      </div>
    );
  }

  // Show error state
  if (error || !profileData) {
    // If no user is authenticated and no valid profile ID, redirect to login
    if (!user && (!actualProfileId || !validateUUID(actualProfileId))) {
      return (
        <div className="min-h-screen bg-background pb-20" dir="ltr">
          <Header 
            title="Profile"
          />
          <main className="px-4 py-6 pb-20">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                Please log in to view profile
              </p>
              <Button onClick={() => navigate('/login')}>
                Login
              </Button>
            </div>
          </main>
          <BottomNavigation />
        </div>
      );
    }
    
    return (
      <div className="min-h-screen bg-background pb-20" dir="ltr">
        <Header 
          title="Profile"
        />
        <main className="px-4 py-6 pb-20">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              {loading ? 'Loading profile...' : (error || 'Profile not found')}
            </p>
            <Button onClick={() => navigate('/profile/edit')} className="mb-4">
              {profileData ? 'Edit Profile' : 'Create Profile'}
            </Button>
            {!loading && !profileData && (
              <p className="text-sm text-muted-foreground">
                User ID: {actualProfileId}
              </p>
            )}
          </div>
        </main>
        <BottomNavigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 font-app" dir="ltr">
      <Header 
        title="Profile"
      />


      <main className="px-4 py-6 pb-20">
        {/* Profile Header */}
        <div className="relative mb-8 p-4 rounded-2xl bg-gradient-to-br from-white to-primary-100 border border-primary-200/30 shadow-card overflow-hidden">
          {/* Subtle background pattern */}
          <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_25%_25%,hsl(var(--primary))_0%,transparent_50%),radial-gradient(circle_at_75%_75%,hsl(var(--coral))_0%,transparent_50%)]"></div>
          
          {/* Settings button positioned at top right */}
          {isOwnProfile && (
            <Button 
              variant="outline" 
              size="sm" 
              className="absolute top-4 right-4 z-20 rounded-full px-3 py-1 h-7 text-xs bg-white/80 backdrop-blur-sm border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all shadow-md hover:shadow-lg font-medium" 
              onClick={() => navigate('/settings')}
            >
              <Settings className="h-3 w-3 mr-1" />
              Settings
            </Button>
          )}
          
          <div className="relative flex items-start gap-4">
            <div className="relative flex-shrink-0 z-10">
              <div className="rounded-full bg-gradient-to-br from-coral to-primary p-0.5 w-[76px] h-[76px]">
                <div className="w-full h-full rounded-full bg-white p-1">
                  <img 
                    src={profileData?.profile_image_url || "/lovable-uploads/c7d65671-6211-412e-af1d-6e5cfdaa248e.png"}
                    alt={profileData?.name || "User"}
                    className="w-[64px] h-[64px] rounded-full object-cover cursor-pointer hover:opacity-80 transition-all hover:scale-105"
                    onClick={() => setShowProfilePicture(true)}
                  />
                </div>
              </div>
            </div>
          
            <div className="flex-1 min-w-0 space-y-3">
              {/* Name and Location */}
              <div className="space-y-2">
                <h1 className="text-xl font-display font-bold bg-gradient-to-r from-primary to-coral bg-clip-text text-transparent">
                  {profileData?.name || "User"}
                </h1>
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-secondary-100 text-secondary-700">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span className="text-sm">{profileData?.location || "Not specified"}</span>
                  </div>
                </div>
              </div>

              {/* Bio */}
              <div className="space-y-3">
                <p className="text-sm text-neutral-700 font-system leading-relaxed">
                  {profileData?.bio || "No description"}
                </p>
                
                {/* Specialties */}
                {profileData?.specialties && profileData.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {profileData.specialties.map((specialty, index) => (
                      <div key={index} className="rounded-full px-3 py-1 bg-gradient-to-r from-coral to-coral-hover text-coral-foreground shadow-sm border border-coral/20 hover:shadow-md transition-all hover:scale-105">
                        <span className="text-xs font-medium">{specialty}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Actions and Links */}
              <div className="flex flex-col gap-3 pt-2">
                {/* Instagram Link */}
                <div className="flex items-center">
                  {profileData?.username ? (
                    <a 
                      href={profileData.username} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 hover:from-purple-200 hover:to-pink-200 transition-all text-sm font-medium"
                    >
                      <Instagram className="h-3 w-3" />
                      Instagram
                    </a>
                  ) : (
                    <span className="text-muted-foreground text-sm">No Instagram</span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  {isOwnProfile && (
                    <>
                       <Button 
                         variant="outline" 
                         size="sm" 
                         className="rounded-full px-3 py-1 h-7 text-xs bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all shadow-md hover:shadow-lg font-medium" 
                         onClick={() => navigate('/profile/edit')}
                       >
                        <Pencil className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    </>
                  )}
                  
                  {!isOwnProfile && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className={`rounded-full px-3 py-1 h-7 text-xs transition-all shadow-sm hover:shadow-md ${isFriend(actualProfileId || '') ? 'bg-gradient-to-r from-success to-success-foreground text-white border-success hover:from-success-foreground hover:to-success' : 'border-success/30 text-success hover:bg-success hover:text-white'}`}
                        onClick={handleAddFriend}
                      >
                        <UserPlus className="h-3 w-3 mr-1" />
                        {isFriend(actualProfileId || '') ? 'Friends' : 'Add'}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className={`rounded-full px-3 py-1 h-7 text-xs transition-all shadow-sm hover:shadow-md ${isFollowing(actualProfileId || '') ? 'bg-gradient-to-r from-primary to-secondary text-white border-primary hover:from-secondary hover:to-primary' : 'border-primary/30 text-primary hover:bg-primary hover:text-white'}`}
                        onClick={() => actualProfileId && toggleFollow(actualProfileId)}
                        disabled={isToggling}
                      >
                        <Heart className="h-3 w-3 mr-1" />
                        {isFollowing(actualProfileId || '') ? 'Following' : 'Follow'}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* Account Type Badge and Business Features */}
        {profileData?.account_type && (
          <section className="mb-8">
          </section>
        )}

        {/* My Events Section - Only shown for own profile */}
        {isOwnProfile && userEvents && userEvents.length > 0 && (
          <section className="mb-8 p-5 rounded-xl bg-gradient-to-br from-secondary-50 to-primary-50 border border-secondary-200/30 shadow-sm">
            <div className="mb-4">
              <h3 className="text-lg font-semibold bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent flex items-center gap-2">
                <Calendar className="h-5 w-5 text-secondary" />
                My Events & Meetups
              </h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {userEvents.map((event) => (
                <div key={event.id} className="relative group">
                  <div 
                    className="bg-white rounded-xl border border-primary/20 overflow-hidden hover:shadow-lg hover:border-primary/40 transition-all hover:-translate-y-1 shadow-sm"
                  >
                    <div className="aspect-video bg-muted">
                      {(event as any).video_url ? (
                        <video 
                          src={(event as any).video_url}
                          className="w-full h-full object-cover"
                          muted
                          autoPlay
                          loop
                          playsInline
                          preload="metadata"
                          poster={event.image_url || communityEvent}
                          onLoadedData={(e) => {
                            // Ensure video plays when loaded
                            e.currentTarget.play().catch(() => {
                              console.log('Autoplay blocked, video will play on user interaction');
                            });
                          }}
                          onError={(e) => {
                            // If video fails to load, hide the video element and show fallback image
                            e.currentTarget.style.display = 'none';
                            console.log('Video failed to load:', (event as any).video_url);
                          }}
                        />
                      ) : (
                        <img 
                          src={event.image_url || communityEvent} 
                          alt={event.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-3 py-1 rounded-full font-medium shadow-sm border transition-all ${
                          event.event_type === 'meetup' 
                            ? 'bg-gradient-to-r from-secondary-100 to-secondary-200 text-secondary-800 border-secondary-300' 
                            : 'bg-gradient-to-r from-success-100 to-success-200 text-success-800 border-success-300'
                        }`}>
                          {event.event_type === 'meetup' ? 'Meetup' : 'Event'}
                        </span>
                        {event.date && (
                          <span className="text-xs text-muted-foreground">
                            {getRelativeDay(event.date)}
                          </span>
                        )}
                      </div>
                      <h4 className="font-medium text-sm mb-2 line-clamp-2">{event.title}</h4>
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{event.description}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span>{event.location || 'Location TBD'}</span>
                        </div>
                        {event.price && (
                          <span className="text-sm font-semibold text-primary">₪{event.price}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                   {/* Edit/Delete/Instagram buttons - show on hover */}
                   <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                     <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 w-8 p-0 bg-pink-50 hover:bg-pink-100 border border-pink-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          generateInstagramStory(event);
                        }}
                        title="Generate Instagram Story"
                      >
                        <Instagram className="h-3 w-3 text-pink-600" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 w-8 p-0 bg-primary-50 hover:bg-primary-100 border border-primary-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditEvent(event.id);
                        }}
                      >
                        <Pencil className="h-3 w-3 text-primary-600" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 w-8 p-0 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 hover:border-red-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEvent(event.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                   </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty state for events */}
        {isOwnProfile && userEvents && userEvents.length === 0 && !eventsLoading && (
          <section className="mb-8 p-6 rounded-xl bg-gradient-to-br from-neutral-50 to-primary-50 border border-neutral-200/50 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">My Events & Meetups</h3>
            </div>
            <div className="text-center py-8 bg-white/50 rounded-xl border border-white/80 backdrop-blur-sm">
              <div className="mb-4 p-3 rounded-full bg-primary-100 w-fit mx-auto">
                <Calendar className="h-8 w-8 text-primary" />
              </div>
              <p className="text-neutral-600 mb-4">You haven't created any events or meetups yet</p>
              <Button 
                onClick={() => navigate('/events/create')}
                className="flex items-center gap-2 bg-gradient-to-r from-primary to-secondary hover:from-primary-600 hover:to-secondary-600 text-white shadow-md hover:shadow-lg transition-all"
              >
                <Plus className="h-4 w-4" />
                Create Your First Event
              </Button>
            </div>
          </section>
        )}

        {/* Logout Button */}
        {isOwnProfile && (
          <div className="mt-8 pt-6 border-t border-primary-200/50">
            <Button 
              variant="outline" 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 text-destructive border-destructive/30 hover:bg-gradient-to-r hover:from-destructive hover:to-destructive-foreground hover:text-white transition-all shadow-sm hover:shadow-md rounded-xl py-3"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        )}

      </main>
      
      <BottomNavigation />
      <ProfilePictureViewer
        isOpen={showProfilePicture}
        onClose={() => setShowProfilePicture(false)}
        imageUrl={profileData?.profile_image_url || ""}
        userName={profileData?.name || "User"}
        userId={actualProfileId}
      />
      <FeedImageViewer
        isOpen={showFeedImages}
        onClose={() => {
          setShowFeedImages(false);
          setSelectedImageId(null);
        }}
        images={imagePosts}
        initialImageId={selectedImageId}
      />
      <EditEventPopup 
        isOpen={showEditEvent}
        onClose={() => {
          setShowEditEvent(false);
          setSelectedEventForEdit(null);
        }}
        eventData={selectedEventForEdit}
        onSuccess={() => {
          refetchEvents();
          setShowEditEvent(false);
          setSelectedEventForEdit(null);
        }}
      />
      <EditCouponModal
        isOpen={showEditCoupon}
        onClose={() => {
          setShowEditCoupon(false);
          setSelectedCouponForEdit(null);
        }}
        coupon={selectedCouponForEdit}
        onUpdate={() => {
          refreshCoupons();
          setShowEditCoupon(false);
          setSelectedCouponForEdit(null);
        }}
      />
      
      <InstagramStoryPopup
        isOpen={showStoryPopup}
        onClose={() => setShowStoryPopup(false)}
        storyUrl={generatedStoryUrl}
        isGenerating={generatingStory}
        title={currentEventTitle}
      />
    </div>
  );
};

export default ProfilePage;