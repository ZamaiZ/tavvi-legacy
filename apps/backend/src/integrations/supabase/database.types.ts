export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
export type Database = {
  public: {
    Tables: {
      profiles: { Row: { id: string; display_name: string; avatar_path: string | null; created_at: string; updated_at: string }; Insert: { id: string; display_name: string; avatar_path?: string | null }; Update: { display_name?: string; avatar_path?: string | null }; Relationships: [] }
      platform_admins: { Row: { user_id: string; granted_at: string; granted_by: string | null }; Insert: { user_id: string; granted_at?: string; granted_by?: string | null }; Update: { user_id?: string; granted_at?: string; granted_by?: string | null }; Relationships: [] }
      invites: {
        Row: { id: string; created_at: string; created_by: string; email: string | null; expires_at: string; redeemed_at: string | null; redeemed_by: string | null; restaurant_id: string | null; revoked_at: string | null; role: Database['public']['Enums']['member_role']; token_hash: string }
        Insert: { id?: string; created_at?: string; created_by: string; email?: string | null; expires_at: string; redeemed_at?: string | null; redeemed_by?: string | null; restaurant_id: string | null; revoked_at?: string | null; role: Database['public']['Enums']['member_role']; token_hash: string }
        Update: { email?: string | null; expires_at?: string; redeemed_at?: string | null; redeemed_by?: string | null; revoked_at?: string | null; token_hash?: string }
        Relationships: []
      }
      restaurants: {
        Row: { id: string; name: string; slug: string; segment: string | null; status: Database['public']['Enums']['restaurant_status']; deleted_at: string | null; created_at: string; updated_at: string; created_by: string | null; contact: Json; cover_path: string | null; currency: string; description: string | null; logo_path: string | null; onboarding_completed_at: string | null; theme: Json; timezone: string }
        Insert: { id?: string; name: string; slug: string; segment?: string | null; status?: Database['public']['Enums']['restaurant_status']; deleted_at?: string | null }
        Update: { name?: string; slug?: string; segment?: string | null; status?: Database['public']['Enums']['restaurant_status']; deleted_at?: string | null; onboarding_completed_at?: string | null }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      is_platform_admin: { Args: never; Returns: boolean }
      check_rate_limit: { Args: { p_bucket: string; p_identifier: string; p_max: number; p_window_seconds: number }; Returns: boolean }
      record_audit: { Args: { p_action: string; p_ip?: unknown; p_metadata?: Json; p_restaurant_id?: string; p_subject_id?: string; p_subject_type: string }; Returns: undefined }
      list_platform_admin_invites: { Args: never; Returns: { id: string; email: string | null; expires_at: string; redeemed_at: string | null; revoked_at: string | null; created_at: string; created_by_email: string; redeemed_by_email: string | null }[] }
      get_platform_admin_invite: { Args: { p_invite_id: string }; Returns: { id: string; email: string | null; expires_at: string; redeemed_at: string | null; revoked_at: string | null; created_at: string; created_by_email: string; redeemed_by_email: string | null }[] }
      create_platform_admin_invite: { Args: { p_email: string | null; p_expires_in_days: number; p_token_hash: string; p_trusted_ip?: string | null }; Returns: { id: string }[] }
      revoke_platform_admin_invite: { Args: { p_invite_id: string; p_trusted_ip?: string | null }; Returns: { id: string; revoked_at: string }[] }
      rotate_platform_admin_invite: { Args: { p_invite_id: string; p_token_hash: string }; Returns: { id: string; email: string | null; expires_at: string }[] }
      list_restaurant_members: { Args: { p_restaurant_id: string }; Returns: { membership_id: string; user_id: string; email: string; display_name: string | null; member_role: Database['public']['Enums']['member_role']; joined_at: string }[] }
      register_mobile_device_contract: { Args: { p_device_id: string; p_device_secret_hash: unknown }; Returns: string }
      get_mobile_device_contract: { Args: { p_device_id: string; p_device_secret_hash: unknown }; Returns: { id: string; user_id: string; revoked_at: string | null; revoked_reason: string | null }[] }
      revoke_mobile_device_contract: { Args: { p_device_id: string; p_device_secret_hash: unknown; p_reason: 'user_disabled' | 'admin_removed' }; Returns: boolean }
      is_my_device_contract_active: { Args: { p_device_id: string }; Returns: boolean }
      revoke_all_my_devices: { Args: never; Returns: undefined }
    }
    Enums: { member_role: 'admin' | 'cashier' | 'attendant' | 'waiter'; restaurant_status: 'draft' | 'active' | 'suspended' }
    CompositeTypes: { [_ in never]: never }
  }
}
