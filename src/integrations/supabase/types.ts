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
      chatbot_errors: {
        Row: {
          context: Json | null
          created_at: string | null
          error_message: string
          error_stack: string | null
          function_name: string
          id: string
          notes: string | null
          phone_number: string | null
          resolved: boolean | null
          user_query: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          error_message: string
          error_stack?: string | null
          function_name: string
          id?: string
          notes?: string | null
          phone_number?: string | null
          resolved?: boolean | null
          user_query?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          error_message?: string
          error_stack?: string | null
          function_name?: string
          id?: string
          notes?: string | null
          phone_number?: string | null
          resolved?: boolean | null
          user_query?: string | null
        }
        Relationships: []
      }
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
          address: string | null
          created_at: string | null
          date: string | null
          description: string | null
          embedding: string | null
          event_type: string | null
          external_link: string | null
          id: string
          image_url: string | null
          location: string | null
          market: string | null
          mood: string | null
          music_type: string | null
          price: string | null
          price_range: string | null
          target_audience: string | null
          ticket_link: string | null
          time: string | null
          title: string
          updated_at: string | null
          user_id: string | null
          venue_name: string | null
          venue_size: string | null
          video_url: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          embedding?: string | null
          event_type?: string | null
          external_link?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          market?: string | null
          mood?: string | null
          music_type?: string | null
          price?: string | null
          price_range?: string | null
          target_audience?: string | null
          ticket_link?: string | null
          time?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
          venue_name?: string | null
          venue_size?: string | null
          video_url?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          embedding?: string | null
          event_type?: string | null
          external_link?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          market?: string | null
          mood?: string | null
          music_type?: string | null
          price?: string | null
          price_range?: string | null
          target_audience?: string | null
          ticket_link?: string | null
          time?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
          venue_name?: string | null
          venue_size?: string | null
          video_url?: string | null
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
      join_requests: {
        Row: {
          additional_photos: string[] | null
          age: number | null
          created_at: string
          description: string | null
          event_id: string | null
          expires_at: string
          id: string
          name: string
          phone_number: string
          photo_url: string | null
        }
        Insert: {
          additional_photos?: string[] | null
          age?: number | null
          created_at?: string
          description?: string | null
          event_id?: string | null
          expires_at?: string
          id?: string
          name: string
          phone_number: string
          photo_url?: string | null
        }
        Update: {
          additional_photos?: string[] | null
          age?: number | null
          created_at?: string
          description?: string | null
          event_id?: string | null
          expires_at?: string
          id?: string
          name?: string
          phone_number?: string
          photo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "join_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
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
          age: number | null
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          email: string | null
          id: string
          interests: string[] | null
          location: string | null
          mobile_number: string | null
          name: string | null
          open_to_connecting: boolean | null
          origin: string | null
          profile_image_url: string | null
          profile_type: string | null
          specialties: string[] | null
          updated_at: string | null
          username: string | null
          whatsapp_number: string | null
        }
        Insert: {
          age?: number | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          id: string
          interests?: string[] | null
          location?: string | null
          mobile_number?: string | null
          name?: string | null
          open_to_connecting?: boolean | null
          origin?: string | null
          profile_image_url?: string | null
          profile_type?: string | null
          specialties?: string[] | null
          updated_at?: string | null
          username?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          age?: number | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          interests?: string[] | null
          location?: string | null
          mobile_number?: string | null
          name?: string | null
          open_to_connecting?: boolean | null
          origin?: string | null
          profile_image_url?: string | null
          profile_type?: string | null
          specialties?: string[] | null
          updated_at?: string | null
          username?: string | null
          whatsapp_number?: string | null
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
      top_list_items: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          list_id: string
          location: string | null
          name: string
          url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          list_id: string
          location?: string | null
          name: string
          url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          list_id?: string
          location?: string | null
          name?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "top_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "top_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      top_lists: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tracked_instagram_pages: {
        Row: {
          created_at: string
          id: string
          instagram_handle: string
          is_active: boolean | null
          last_scanned_at: string | null
          notes: string | null
          page_name: string | null
          page_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          instagram_handle: string
          is_active?: boolean | null
          last_scanned_at?: string | null
          notes?: string | null
          page_name?: string | null
          page_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          instagram_handle?: string
          is_active?: boolean | null
          last_scanned_at?: string | null
          notes?: string | null
          page_name?: string | null
          page_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_coupon_claims: {
        Row: {
          claimed_at: string | null
          coupon_code: string | null
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
          coupon_code?: string | null
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
          coupon_code?: string | null
          created_at?: string | null
          id?: string
          is_used?: boolean | null
          perk_id?: string | null
          qr_code_data?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_coupons: {
        Row: {
          business_name: string | null
          coupon_code: string | null
          created_at: string | null
          description: string | null
          discount_amount: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          neighborhood: string | null
          title: string
          updated_at: string | null
          user_id: string | null
          valid_until: string | null
        }
        Insert: {
          business_name?: string | null
          coupon_code?: string | null
          created_at?: string | null
          description?: string | null
          discount_amount?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          neighborhood?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
          valid_until?: string | null
        }
        Update: {
          business_name?: string | null
          coupon_code?: string | null
          created_at?: string | null
          description?: string | null
          discount_amount?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
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
          latitude: number | null
          longitude: number | null
          status: string | null
          status_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          status?: string | null
          status_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          status?: string | null
          status_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          content: string
          created_at: string
          id: string
          phone_number: string
          role: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          phone_number: string
          role: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          phone_number?: string
          role?: string
        }
        Relationships: []
      }
      whatsapp_event_uploads: {
        Row: {
          created_at: string
          date: string | null
          description: string | null
          expires_at: string
          id: string
          image_url: string | null
          instagram_handle: string | null
          phone_number: string
          state: string
          time: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date?: string | null
          description?: string | null
          expires_at?: string
          id?: string
          image_url?: string | null
          instagram_handle?: string | null
          phone_number: string
          state?: string
          time?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string | null
          description?: string | null
          expires_at?: string
          id?: string
          image_url?: string | null
          instagram_handle?: string | null
          phone_number?: string
          state?: string
          time?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_user_interactions: {
        Row: {
          created_at: string | null
          id: string
          interaction_type: string
          item_id: string
          item_type: string
          phone_number: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          interaction_type: string
          item_id: string
          item_type: string
          phone_number: string
        }
        Update: {
          created_at?: string | null
          id?: string
          interaction_type?: string
          item_id?: string
          item_type?: string
          phone_number?: string
        }
        Relationships: []
      }
      whatsapp_users: {
        Row: {
          activity_frequency: string | null
          age: number | null
          budget_preference: string | null
          created_at: string
          favorite_neighborhoods: string[] | null
          id: string
          interests: string[] | null
          music_preferences: string[] | null
          name: string | null
          phone_number: string
          preferred_language: string | null
          recommendation_count: number
          updated_at: string
          wants_ai_recommendations: boolean | null
        }
        Insert: {
          activity_frequency?: string | null
          age?: number | null
          budget_preference?: string | null
          created_at?: string
          favorite_neighborhoods?: string[] | null
          id?: string
          interests?: string[] | null
          music_preferences?: string[] | null
          name?: string | null
          phone_number: string
          preferred_language?: string | null
          recommendation_count?: number
          updated_at?: string
          wants_ai_recommendations?: boolean | null
        }
        Update: {
          activity_frequency?: string | null
          age?: number | null
          budget_preference?: string | null
          created_at?: string
          favorite_neighborhoods?: string[] | null
          id?: string
          interests?: string[] | null
          music_preferences?: string[] | null
          name?: string | null
          phone_number?: string
          preferred_language?: string | null
          recommendation_count?: number
          updated_at?: string
          wants_ai_recommendations?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_past_events: { Args: never; Returns: undefined }
      generate_coupon_code: { Args: never; Returns: string }
      match_events: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          description: string
          id: string
          similarity: number
          title: string
        }[]
      }
      update_community_membership_status: {
        Args: { membership_id: string; new_status: string }
        Returns: Json
      }
      update_meetup_join_status: {
        Args: { new_status: string; rsvp_id: string }
        Returns: Json
      }
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
