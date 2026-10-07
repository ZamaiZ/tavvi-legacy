export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      app_server_keys: {
        Row: {
          key_hash: string
          name: string
          updated_at: string
        }
        Insert: {
          key_hash: string
          name: string
          updated_at?: string
        }
        Update: {
          key_hash?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          ip: unknown
          metadata: Json
          restaurant_id: string | null
          subject_id: string | null
          subject_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip?: unknown
          metadata?: Json
          restaurant_id?: string | null
          subject_id?: string | null
          subject_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip?: unknown
          metadata?: Json
          restaurant_id?: string | null
          subject_id?: string | null
          subject_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          created_at: string
          created_by: string
          email: string | null
          expires_at: string
          id: string
          redeemed_at: string | null
          redeemed_by: string | null
          restaurant_id: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["member_role"]
          token_hash: string
        }
        Insert: {
          created_at?: string
          created_by: string
          email?: string | null
          expires_at: string
          id?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          restaurant_id: string | null
          revoked_at?: string | null
          role: Database["public"]["Enums"]["member_role"]
          token_hash: string
        }
        Update: {
          created_at?: string
          created_by?: string
          email?: string | null
          expires_at?: string
          id?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          restaurant_id?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_redeemed_by_fkey"
            columns: ["redeemed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_visible: boolean
          name: string
          position: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_visible?: boolean
          name: string
          position?: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_visible?: boolean
          name?: string
          position?: number
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_media: {
        Row: {
          alt_text: string | null
          created_at: string
          duration_ms: number | null
          focal_x: number
          focal_y: number
          height: number | null
          id: string
          item_id: string
          kind: Database["public"]["Enums"]["media_kind"]
          position: number
          poster_path: string | null
          restaurant_id: string
          storage_path: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          duration_ms?: number | null
          focal_x?: number
          focal_y?: number
          height?: number | null
          id?: string
          item_id: string
          kind: Database["public"]["Enums"]["media_kind"]
          position?: number
          poster_path?: string | null
          restaurant_id: string
          storage_path: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          duration_ms?: number | null
          focal_x?: number
          focal_y?: number
          height?: number | null
          id?: string
          item_id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          position?: number
          poster_path?: string | null
          restaurant_id?: string
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_media_item_same_restaurant"
            columns: ["item_id", "restaurant_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id", "restaurant_id"]
          },
        ]
      }
      menu_item_variants: {
        Row: {
          created_at: string
          id: string
          is_available: boolean
          item_id: string
          name: string
          position: number
          price_cents: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_available?: boolean
          item_id: string
          name: string
          position?: number
          price_cents: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_available?: boolean
          item_id?: string
          name?: string
          position?: number
          price_cents?: number
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_variants_item_same_restaurant"
            columns: ["item_id", "restaurant_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id", "restaurant_id"]
          },
        ]
      }
      menu_items: {
        Row: {
          base_price_cents: number
          category_id: string
          created_at: string
          description: string | null
          dietary_tags: string[]
          id: string
          is_available: boolean
          is_visible: boolean
          name: string
          position: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          base_price_cents: number
          category_id: string
          created_at?: string
          description?: string | null
          dietary_tags?: string[]
          id?: string
          is_available?: boolean
          is_visible?: boolean
          name: string
          position?: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          base_price_cents?: number
          category_id?: string
          created_at?: string
          description?: string | null
          dietary_tags?: string[]
          id?: string
          is_available?: boolean
          is_visible?: boolean
          name?: string
          position?: number
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_same_restaurant"
            columns: ["category_id", "restaurant_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id", "restaurant_id"]
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_tags: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string | null
          last_seen_at: string | null
          nfc_serial: string | null
          nfc_verified_at: string | null
          nfc_verified_by: string | null
          public_token: string
          restaurant_id: string
          table_number: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          last_seen_at?: string | null
          nfc_serial?: string | null
          nfc_verified_at?: string | null
          nfc_verified_by?: string | null
          public_token: string
          restaurant_id: string
          table_number?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          last_seen_at?: string | null
          nfc_serial?: string | null
          nfc_verified_at?: string | null
          nfc_verified_by?: string | null
          public_token?: string
          restaurant_id?: string
          table_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_tags_nfc_verified_by_fkey"
            columns: ["nfc_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_tags_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_calls: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          table_number: number
          tag_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          table_number: number
          tag_id: string
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          table_number?: number
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_calls_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_calls_tag_id_restaurant_id_fkey"
            columns: ["tag_id", "restaurant_id"]
            isOneToOne: false
            referencedRelation: "menu_tags"
            referencedColumns: ["id", "restaurant_id"]
          },
          {
            foreignKeyName: "service_calls_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          data: Json
          id: string
          kind: string
          push_claimed_at: string | null
          read_at: string | null
          restaurant_id: string | null
          territory: string
          title: string
          url: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json
          id?: string
          kind: string
          push_claimed_at?: string | null
          read_at?: string | null
          restaurant_id?: string | null
          territory: string
          title: string
          url: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json
          id?: string
          kind?: string
          push_claimed_at?: string | null
          read_at?: string | null
          restaurant_id?: string | null
          territory?: string
          title?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          granted_at: string
          granted_by: string | null
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_admins_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          expiration_time: string | null
          p256dh: string
          territory: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          expiration_time?: string | null
          p256dh: string
          territory: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          expiration_time?: string | null
          p256dh?: string
          territory?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_counters: {
        Row: {
          bucket: string
          hits: number
          identifier: string
          window_start: string
        }
        Insert: {
          bucket: string
          hits?: number
          identifier: string
          window_start: string
        }
        Update: {
          bucket?: string
          hits?: number
          identifier?: string
          window_start?: string
        }
        Relationships: []
      }
      restaurant_feedback: {
        Row: {
          body: string
          created_at: string
          id: string
          published_at: string | null
          read_at: string | null
          restaurant_id: string
          status: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          published_at?: string | null
          read_at?: string | null
          restaurant_id: string
          status?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          published_at?: string | null
          read_at?: string | null
          restaurant_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_feedback_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_feedback_photos: {
        Row: {
          created_at: string
          feedback_id: string
          height: number
          id: string
          position: number
          restaurant_id: string
          storage_path: string
          width: number
        }
        Insert: {
          created_at?: string
          feedback_id: string
          height: number
          id?: string
          position: number
          restaurant_id: string
          storage_path: string
          width: number
        }
        Update: {
          created_at?: string
          feedback_id?: string
          height?: number
          id?: string
          position?: number
          restaurant_id?: string
          storage_path?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_feedback_photos_feedback_id_restaurant_id_fkey"
            columns: ["feedback_id", "restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_feedback"
            referencedColumns: ["id", "restaurant_id"]
          },
        ]
      }
      restaurants: {
        Row: {
          contact: Json
          cover_path: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          description: string | null
          id: string
          logo_path: string | null
          name: string
          onboarding_completed_at: string | null
          segment: string | null
          slug: string
          status: Database["public"]["Enums"]["restaurant_status"]
          theme: Json
          timezone: string
          updated_at: string
        }
        Insert: {
          contact?: Json
          cover_path?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          logo_path?: string | null
          name: string
          onboarding_completed_at?: string | null
          segment?: string | null
          slug: string
          status?: Database["public"]["Enums"]["restaurant_status"]
          theme?: Json
          timezone?: string
          updated_at?: string
        }
        Update: {
          contact?: Json
          cover_path?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          logo_path?: string | null
          name?: string
          onboarding_completed_at?: string | null
          segment?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["restaurant_status"]
          theme?: Json
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      begin_feedback: {
        Args: { p_body: string; p_key: string; p_photos: Json; p_slug: string }
        Returns: {
          feedback_id: string
          photo_position: number | null
          storage_path: string | null
        }[]
      }
      check_app_server_key: { Args: { p_key: string }; Returns: boolean }
      check_rate_limit: {
        Args: {
          p_bucket: string
          p_identifier: string
          p_max: number
          p_window_seconds: number
        }
        Returns: boolean
      }
      claim_notification_pushes: {
        Args: { p_key: string }
        Returns: {
          auth: string | null
          body: string
          endpoint: string | null
          kind: string
          notification_id: string
          p256dh: string | null
          territory: string
          title: string
          url: string
        }[]
      }
      delete_feedback: { Args: { p_feedback_id: string }; Returns: undefined }
      delete_push_subscription: {
        Args: { p_endpoint: string }
        Returns: undefined
      }
      dispatch_notification: {
        Args: {
          p_audience: string
          p_body: string
          p_data?: Json
          p_exclude_user?: string
          p_kind: string
          p_restaurant_id?: string
          p_roles?: Database["public"]["Enums"]["member_role"][]
          p_territory: string
          p_title: string
          p_url: string
          p_user_ids?: string[]
        }
        Returns: number
      }
      feedback_photo_upload_allowed: { Args: { p_name: string }; Returns: boolean }
      is_category_visible: { Args: { cid: string }; Returns: boolean }
      is_member: { Args: { rid: string }; Returns: boolean }
      is_menu_item_public: { Args: { iid: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      is_restaurant_admin: { Args: { rid: string }; Returns: boolean }
      is_restaurant_public: { Args: { rid: string }; Returns: boolean }
      is_slug_available: { Args: { p_slug: string }; Returns: boolean }
      my_role: {
        Args: { rid: string }
        Returns: Database["public"]["Enums"]["member_role"] | null
      }
      my_push_subscriptions: {
        Args: { p_territory: string }
        Returns: {
          auth: string
          endpoint: string
          p256dh: string
        }[]
      }
      list_restaurant_members: {
        Args: { p_restaurant_id: string }
        Returns: {
          display_name: string
          email: string
          joined_at: string
          member_role: Database["public"]["Enums"]["member_role"]
          membership_id: string
          user_id: string
        }[]
      }
      preview_invite: {
        Args: { p_token: string }
        Returns: {
          invite_kind: string
          invite_role: Database["public"]["Enums"]["member_role"]
          restaurant_name: string | null
        }[]
      }
      prune_push_subscriptions: {
        Args: { p_endpoints: string[] }
        Returns: undefined
      }
      publish_feedback: {
        Args: { p_feedback_id: string; p_key: string }
        Returns: undefined
      }
      request_service_call: {
        Args: { p_key: string; p_token: string; p_allow_create?: boolean }
        Returns: { call_id: string; table_number: number; status: string; created: boolean }[]
      }
      resolve_service_call: {
        Args: { p_call_id: string }
        Returns: {
          call_id: string
          restaurant_id: string
          tag_id: string
          table_number: number
          status: string
          created_at: string
          resolved_at: string | null
          resolved_by: string | null
        }[]
      }
      record_audit: {
        Args: {
          p_action: string
          p_ip?: unknown
          p_metadata?: Json
          p_restaurant_id?: string
          p_subject_id?: string
          p_subject_type: string
        }
        Returns: undefined
      }
      record_menu_tag_nfc_event: {
        Args: {
          p_tag_id: string
          p_operation_id: string
          p_event: string
          p_serial: string
          p_reason?: string | null
        }
        Returns: string | null
      }
      list_menu_tag_nfc_events: {
        Args: { p_tag_id: string }
        Returns: {
          action: string
          serial: string | null
          reason: string | null
          actor_id: string | null
          created_at: string
        }[]
      }
      redeem_invite: { Args: { p_token: string }; Returns: string }
      redeem_platform_invite: {
        Args: { p_name: string; p_slug: string; p_token: string }
        Returns: string
      }
      resolve_menu_tag: {
        Args: { p_token: string }
        Returns: {
          restaurant_slug: string
          tag_label: string
          table_number: number | null
        }[]
      }
      restaurant_id_from_storage_path: {
        Args: { p_name: string }
        Returns: string
      }
      revoke_my_web_push_subscriptions: { Args: never; Returns: undefined }
      save_menu_item: {
        Args: { p_payload: Json }
        Returns: Json
      }
      save_push_subscription: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_expiration_time?: string
          p_p256dh: string
          p_territory: string
        }
        Returns: undefined
      }
      send_test_notification: {
        Args: { p_territory: string; p_url: string }
        Returns: undefined
      }
      server_prune_push_subscriptions: {
        Args: { p_endpoints: string[]; p_key: string }
        Returns: undefined
      }
      set_app_server_key: { Args: { p_key: string }; Returns: undefined }
    }
    Enums: {
      media_kind: "image" | "video"
      member_role: "admin" | "cashier" | "attendant" | "waiter"
      restaurant_status: "draft" | "active" | "suspended"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      media_kind: ["image", "video"],
      member_role: ["admin", "cashier", "attendant", "waiter"],
      restaurant_status: ["draft", "active", "suspended"],
    },
  },
} as const
