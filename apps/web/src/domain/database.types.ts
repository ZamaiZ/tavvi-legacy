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
          public_token: string
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          last_seen_at?: string | null
          public_token: string
          restaurant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          last_seen_at?: string | null
          public_token?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_tags_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
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
      push_events: {
        Row: {
          actor_id: string
          claimed_at: string | null
          created_at: string
          id: string
          kind: string
          member_role: Database["public"]["Enums"]["member_role"] | null
          restaurant_id: string
        }
        Insert: {
          actor_id: string
          claimed_at?: string | null
          created_at?: string
          id?: string
          kind: string
          member_role?: Database["public"]["Enums"]["member_role"] | null
          restaurant_id: string
        }
        Update: {
          actor_id?: string
          claimed_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          member_role?: Database["public"]["Enums"]["member_role"] | null
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
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
      check_rate_limit: {
        Args: {
          p_bucket: string
          p_identifier: string
          p_max: number
          p_window_seconds: number
        }
        Returns: boolean
      }
      claim_push_deliveries: {
        Args: never
        Returns: {
          actor_email: string
          auth: string
          endpoint: string
          event_id: string
          kind: string
          member_role: Database["public"]["Enums"]["member_role"]
          p256dh: string
          restaurant_id: string
          restaurant_name: string
        }[]
      }
      delete_push_subscription: {
        Args: { p_endpoint: string }
        Returns: undefined
      }
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
        }[]
      }
      restaurant_id_from_storage_path: {
        Args: { p_name: string }
        Returns: string
      }
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

