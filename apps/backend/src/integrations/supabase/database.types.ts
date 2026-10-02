export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: { [_ in never]: never }
    Views: { [_ in never]: never }
    Functions: {
      claim_notification_pushes: {
        Args: { p_key: string }
        Returns: {
          notification_id: string
          territory: string
          kind: string
          title: string
          body: string
          url: string
          endpoint: string | null
          p256dh: string | null
          auth: string | null
        }[]
      }
      server_prune_push_subscriptions: { Args: { p_key: string; p_endpoints: string[] }; Returns: undefined }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
