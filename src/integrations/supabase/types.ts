export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      communities: {
        Row: {
          access_type: string | null
          category: string | null
          cover_image_url: string | null
          created_at: string | null
          creator_id: string | null
          description: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          member_count: number | null
          name: string
          subcategory: string | null
          tagline: string | null
          updated_at: string | null
        }
        Insert: {
          access_type?: string | null
          category?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          creator_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          member_count?: number | null
          name: string
          subcategory?: string | null
          tagline?: string | null
          updated_at?: string | null
        }
        Update: {
          access_type?: string | null
          category?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          creator_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          member_count?: number | null
          name?: string
          subcategory?: string | null
          tagline?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      community_events: {
        Row: {
          community_id: string | null
          created_at: string | null
          event_id: string | null
          id: string
        }
        Insert: {
          community_id?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
        }
        Update: {
          community_id?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_events_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      community_members: {
        Row: {
          community_id: string | null
          id: string
          joined_at: string | null
          role: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          community_id?: string | null
          id?: string
          joined_at?: string | null
          role?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          community_id?: string | null
          id?: string
          joined_at?: string | null
          role?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_perks: {
        Row: {
          business_name: string | null
          community_id: string | null
          created_at: string | null
          description: string | null
          discount_amount: string | null
          id: string
          image_url: string | null
          is_used: boolean | null
          title: string
          valid_until: string | null
        }
        Insert: {
          business_name?: string | null
          community_id?: string | null
          created_at?: string | null
          description?: string | null
          discount_amount?: string | null
          id?: string
          image_url?: string | null
          is_used?: boolean | null
          title: string
          valid_until?: string | null
        }
        Update: {
          business_name?: string | null
          community_id?: string | null
          created_at?: string | null
          description?: string | null
          discount_amount?: string | null
          id?: string
          image_url?: string | null
          is_used?: boolean | null
          title?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_perks_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_claims: {
        Row: {
          claimed_at: string | null
          id: string
          is_used: boolean | null
          perk_id: string | null
          qr_code_data: string | null
          user_id: string | null
        }
        Insert: {
          claimed_at?: string | null
          id?: string
          is_used?: boolean | null
          perk_id?: string | null
          qr_code_data?: string | null
          user_id?: string | null
        }
        Update: {
          claimed_at?: string | null
          id?: string
          is_used?: boolean | null
          perk_id?: string | null
          qr_code_data?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_claims_perk_id_fkey"
            columns: ["perk_id"]
            isOneToOne: false
            referencedRelation: "community_perks"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_photo_submissions: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          images: string[]
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          images: string[]
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          images?: string[]
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_read: boolean | null
          read_at: string | null
          receiver_id: string | null
          recipient_id: string | null
          sender_id: string | null
          updated_at: string | null
        }
        Insert: {
          content?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          receiver_id?: string | null
          recipient_id?: string | null
          sender_id?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          receiver_id?: string | null
          recipient_id?: string | null
          sender_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      event_companion_requests: {
        Row: {
          created_at: string | null
          event_id: string | null
          id: string
          message: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          message?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          message?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_companion_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvps: {
        Row: {
          created_at: string | null
          event_id: string | null
          id: string
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          date: string | null
          description: string | null
          event_type: string | null
          external_link: string | null
          id: string
          image_url: string | null
          location: string | null
          market: string | null
          mood: string | null
          price: string | null
          time: string | null
          title: string
          updated_at: string | null
          user_id: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string | null
          date?: string | null
          description?: string | null
          event_type?: string | null
          external_link?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          market?: string | null
          mood?: string | null
          price?: string | null
          time?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string | null
          description?: string | null
          event_type?: string | null
          external_link?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          market?: string | null
          mood?: string | null
          price?: string | null
          time?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      friends_feed_posts: {
        Row: {
          content: string | null
          created_at: string
          id: string
          image_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      friends_picture_galleries: {
        Row: {
          created_at: string | null
          id: string
          image_url: string | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          title?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      idea_votes: {
        Row: {
          created_at: string
          id: string
          idea_id: string
          user_id: string
          vote: string
        }
        Insert: {
          created_at?: string
          id?: string
          idea_id: string
          user_id: string
          vote: string
        }
        Update: {
          created_at?: string
          id?: string
          idea_id?: string
          user_id?: string
          vote?: string
        }
        Relationships: []
      }
      items: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          location: string | null
          market: string | null
          meetup_date: string | null
          meetup_time: string | null
          mobile_number: string | null
          price: number | null
          status: string | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          market?: string | null
          meetup_date?: string | null
          meetup_time?: string | null
          mobile_number?: string | null
          price?: number | null
          status?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          market?: string | null
          meetup_date?: string | null
          meetup_time?: string | null
          mobile_number?: string | null
          price?: number | null
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      neighbor_questions: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_anonymous: boolean | null
          message_type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_anonymous?: boolean | null
          message_type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_anonymous?: boolean | null
          message_type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      neighborhood_ideas: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          market: string | null
          neighborhood: string | null
          question: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          market?: string | null
          neighborhood?: string | null
          question: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          market?: string | null
          neighborhood?: string | null
          question?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string | null
          related_user_id: string | null
          title: string | null
          type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          related_user_id?: string | null
          title?: string | null
          type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          related_user_id?: string | null
          title?: string | null
          type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      photo_gallery_likes: {
        Row: {
          created_at: string
          gallery_id: string
          id: string
          image_url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          gallery_id: string
          id?: string
          image_url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          gallery_id?: string
          id?: string
          image_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          image_url: string | null
          location: string | null
          mood: string | null
          updated_at: string | null
          user_id: string | null
          video_url: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          mood?: string | null
          updated_at?: string | null
          user_id?: string | null
          video_url?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          mood?: string | null
          updated_at?: string | null
          user_id?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      profile_photos: {
        Row: {
          created_at: string
          display_order: number
          id: string
          photo_url: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          photo_url: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          photo_url?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          email: string | null
          id: string
          interests: string[] | null
          location: string | null
          mobile_number: string | null
          name: string | null
          profile_image_url: string | null
          specialties: string[] | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          id: string
          interests?: string[] | null
          location?: string | null
          mobile_number?: string | null
          name?: string | null
          profile_image_url?: string | null
          specialties?: string[] | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          interests?: string[] | null
          location?: string | null
          mobile_number?: string | null
          name?: string | null
          profile_image_url?: string | null
          specialties?: string[] | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      recommendation_agreements: {
        Row: {
          agreement_type: string
          created_at: string
          id: string
          recommendation_id: string
          user_id: string
        }
        Insert: {
          agreement_type: string
          created_at?: string
          id?: string
          recommendation_id: string
          user_id: string
        }
        Update: {
          agreement_type?: string
          created_at?: string
          id?: string
          recommendation_id?: string
          user_id?: string
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          instagram_url: string | null
          location: string | null
          market: string | null
          status: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          instagram_url?: string | null
          location?: string | null
          market?: string | null
          status?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          instagram_url?: string | null
          location?: string | null
          market?: string | null
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      smallprofiles: {
        Row: {
          created_at: string
          id: string
          photo: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          photo?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          photo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stories: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          image_url: string | null
          is_announcement: boolean | null
          story_type: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_announcement?: boolean | null
          story_type?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_announcement?: boolean | null
          story_type?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_coupon_claims: {
        Row: {
          claimed_at: string | null
          created_at: string | null
          id: string
          is_used: boolean | null
          perk_id: string | null
          qr_code_data: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string | null
          id?: string
          is_used?: boolean | null
          perk_id?: string | null
          qr_code_data?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          claimed_at?: string | null
          created_at?: string | null
          id?: string
          is_used?: boolean | null
          perk_id?: string | null
          qr_code_data?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_coupon_claims_perk_id_fkey"
            columns: ["perk_id"]
            isOneToOne: false
            referencedRelation: "community_perks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_coupons: {
        Row: {
          business_name: string | null
          created_at: string | null
          description: string | null
          discount_amount: string | null
          id: string
          image_url: string | null
          neighborhood: string | null
          title: string
          updated_at: string | null
          user_id: string | null
          valid_until: string | null
        }
        Insert: {
          business_name?: string | null
          created_at?: string | null
          description?: string | null
          discount_amount?: string | null
          id?: string
          image_url?: string | null
          neighborhood?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
          valid_until?: string | null
        }
        Update: {
          business_name?: string | null
          created_at?: string | null
          description?: string | null
          discount_amount?: string | null
          id?: string
          image_url?: string | null
          neighborhood?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      user_following: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      user_friends: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_locations: {
        Row: {
          created_at: string
          id: string
          status: string | null
          status_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string | null
          status_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string | null
          status_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_picture_galleries: {
        Row: {
          created_at: string | null
          id: string
          image_url: string | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          title?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
