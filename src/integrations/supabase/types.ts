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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          category: string
          createdAt: string
          date: string
          description: string
          done: boolean
          id: string
          reminder: number
          time: string
          title: string
          user_id: string
        }
        Insert: {
          category: string
          createdAt?: string
          date: string
          description?: string
          done?: boolean
          id: string
          reminder?: number
          time: string
          title: string
          user_id: string
        }
        Update: {
          category?: string
          createdAt?: string
          date?: string
          description?: string
          done?: boolean
          id?: string
          reminder?: number
          time?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      entries: {
        Row: {
          date: string
          id: string
          note: string
          quality: string | null
          time: string
          type: string
          user_id: string
          value: number | null
        }
        Insert: {
          date: string
          id: string
          note?: string
          quality?: string | null
          time: string
          type: string
          user_id: string
          value?: number | null
        }
        Update: {
          date?: string
          id?: string
          note?: string
          quality?: string | null
          time?: string
          type?: string
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      habit_routines: {
        Row: {
          active: boolean
          days: number[]
          id: string
          name: string
          user_id: string
        }
        Insert: {
          active?: boolean
          days?: number[]
          id: string
          name: string
          user_id: string
        }
        Update: {
          active?: boolean
          days?: number[]
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_routines_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      habits: {
        Row: {
          date: string
          id: string
          kind: string
          name: string
          note: string
          routine_id: string | null
          time: string
          user_id: string
        }
        Insert: {
          date: string
          id: string
          kind: string
          name: string
          note?: string
          routine_id?: string | null
          time: string
          user_id: string
        }
        Update: {
          date?: string
          id?: string
          kind?: string
          name?: string
          note?: string
          routine_id?: string | null
          time?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habits_routine_owner_fkey"
            columns: ["user_id", "routine_id"]
            isOneToOne: false
            referencedRelation: "habit_routines"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "habits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      important_days: {
        Row: {
          date: string
          id: string
          name: string
          notify: boolean
          user_id: string
        }
        Insert: {
          date: string
          id: string
          name: string
          notify?: boolean
          user_id: string
        }
        Update: {
          date?: string
          id?: string
          name?: string
          notify?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "important_days_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      preferences: {
        Row: {
          accentColor: string
          animations: boolean
          calendarView: string
          compact: boolean
          largeText: boolean
          notifications: boolean
          palette: string
          showSummary: boolean
          theme: string
          user_id: string
          weekStartsMonday: boolean
        }
        Insert: {
          accentColor?: string
          animations?: boolean
          calendarView?: string
          compact?: boolean
          largeText?: boolean
          notifications?: boolean
          palette?: string
          showSummary?: boolean
          theme?: string
          user_id: string
          weekStartsMonday?: boolean
        }
        Update: {
          accentColor?: string
          animations?: boolean
          calendarView?: string
          compact?: boolean
          largeText?: boolean
          notifications?: boolean
          palette?: string
          showSummary?: boolean
          theme?: string
          user_id?: string
          weekStartsMonday?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatarPath: string
          height: string
          legacy_import_offered: boolean
          name: string
          sleep: string
          sleepGoal: number
          timezone: string
          user_id: string
          wake: string
          waterGoal: number
          weight: string
        }
        Insert: {
          avatarPath?: string
          height?: string
          legacy_import_offered?: boolean
          name?: string
          sleep?: string
          sleepGoal?: number
          timezone?: string
          user_id: string
          wake?: string
          waterGoal?: number
          weight?: string
        }
        Update: {
          avatarPath?: string
          height?: string
          legacy_import_offered?: boolean
          name?: string
          sleep?: string
          sleepGoal?: number
          timezone?: string
          user_id?: string
          wake?: string
          waterGoal?: number
          weight?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          active: boolean
          id: string
          name: string
          time: string
          user_id: string
        }
        Insert: {
          active?: boolean
          id: string
          name: string
          time: string
          user_id: string
        }
        Update: {
          active?: boolean
          id?: string
          name?: string
          time?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      wa_accounts: {
        Row: {
          active: boolean
          connected_at: string
          display_phone_number: string
          phone_number_id: string
          token_ciphertext: string
          user_id: string
          waba_id: string
        }
        Insert: {
          active?: boolean
          connected_at?: string
          display_phone_number?: string
          phone_number_id: string
          token_ciphertext: string
          user_id: string
          waba_id: string
        }
        Update: {
          active?: boolean
          connected_at?: string
          display_phone_number?: string
          phone_number_id?: string
          token_ciphertext?: string
          user_id?: string
          waba_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      wa_assistant_messages: {
        Row: {
          appointment_id: string | null
          body: string
          clarification: string | null
          id: string
          phone: string
          processing_error: string | null
          received_at: string
          sent_at: string
          state: string
          user_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          body: string
          clarification?: string | null
          id: string
          phone: string
          processing_error?: string | null
          received_at?: string
          sent_at: string
          state?: string
          user_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          body?: string
          clarification?: string | null
          id?: string
          phone?: string
          processing_error?: string | null
          received_at?: string
          sent_at?: string
          state?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_assistant_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      wa_contacts: {
        Row: {
          contact_name: string
          last_message_at: string
          last_preview: string
          monitored_since: string | null
          user_id: string
          wa_id: string
          watched: boolean
        }
        Insert: {
          contact_name?: string
          last_message_at?: string
          last_preview?: string
          monitored_since?: string | null
          user_id: string
          wa_id: string
          watched?: boolean
        }
        Update: {
          contact_name?: string
          last_message_at?: string
          last_preview?: string
          monitored_since?: string | null
          user_id?: string
          wa_id?: string
          watched?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "wa_contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      wa_delivery_statuses: {
        Row: {
          applied: boolean
          delivery_id: string
          errors: Json | null
          provider_at: string
          provider_id: string
          status: string
        }
        Insert: {
          applied?: boolean
          delivery_id: string
          errors?: Json | null
          provider_at: string
          provider_id: string
          status: string
        }
        Update: {
          applied?: boolean
          delivery_id?: string
          errors?: Json | null
          provider_at?: string
          provider_id?: string
          status?: string
        }
        Relationships: []
      }
      wa_link_codes: {
        Row: {
          code_hash: string
          expires_at: string
          user_id: string
        }
        Insert: {
          code_hash: string
          expires_at: string
          user_id: string
        }
        Update: {
          code_hash?: string
          expires_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_link_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      wa_messages: {
        Row: {
          ai_error: string | null
          ai_status: string
          appointment_date: string | null
          appointment_id: string | null
          appointment_time: string | null
          appointment_title: string | null
          body: string
          direction: string
          id: string
          sent_at: string
          user_id: string
          wa_id: string
        }
        Insert: {
          ai_error?: string | null
          ai_status?: string
          appointment_date?: string | null
          appointment_id?: string | null
          appointment_time?: string | null
          appointment_title?: string | null
          body?: string
          direction: string
          id: string
          sent_at: string
          user_id: string
          wa_id: string
        }
        Update: {
          ai_error?: string | null
          ai_status?: string
          appointment_date?: string | null
          appointment_id?: string | null
          appointment_time?: string | null
          appointment_title?: string | null
          body?: string
          direction?: string
          id?: string
          sent_at?: string
          user_id?: string
          wa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wa_messages_user_id_wa_id_fkey"
            columns: ["user_id", "wa_id"]
            isOneToOne: false
            referencedRelation: "wa_contacts"
            referencedColumns: ["user_id", "wa_id"]
          },
        ]
      }
      wa_oauth_states: {
        Row: {
          expires_at: string
          state: string
          user_id: string
        }
        Insert: {
          expires_at: string
          state: string
          user_id: string
        }
        Update: {
          expires_at?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      wa_phone_links: {
        Row: {
          linked_at: string
          phone: string
          user_id: string
        }
        Insert: {
          linked_at?: string
          phone: string
          user_id: string
        }
        Update: {
          linked_at?: string
          phone?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_phone_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      wa_processing_control: {
        Row: {
          id: number
          lease_token: string | null
          lease_until: string | null
          paused_reason: string | null
        }
        Insert: {
          id?: number
          lease_token?: string | null
          lease_until?: string | null
          paused_reason?: string | null
        }
        Update: {
          id?: number
          lease_token?: string | null
          lease_until?: string | null
          paused_reason?: string | null
        }
        Relationships: []
      }
      wa_replies: {
        Row: {
          body: string
          delivered_at: string | null
          error: string | null
          failed_at: string | null
          inbound_id: string
          phone: string
          provider_id: string | null
          read_at: string | null
          sent_at: string | null
          state: string
        }
        Insert: {
          body: string
          delivered_at?: string | null
          error?: string | null
          failed_at?: string | null
          inbound_id: string
          phone: string
          provider_id?: string | null
          read_at?: string | null
          sent_at?: string | null
          state?: string
        }
        Update: {
          body?: string
          delivered_at?: string | null
          error?: string | null
          failed_at?: string | null
          inbound_id?: string
          phone?: string
          provider_id?: string | null
          read_at?: string | null
          sent_at?: string | null
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_replies_inbound_id_fkey"
            columns: ["inbound_id"]
            isOneToOne: true
            referencedRelation: "wa_assistant_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_webhook_events: {
        Row: {
          attempts: number
          delivery_id: string
          event: string
          id: number
          payload: Json
          processed_at: string | null
          processing_error: string | null
          received_at: string
        }
        Insert: {
          attempts?: number
          delivery_id: string
          event: string
          id?: number
          payload: Json
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
        }
        Update: {
          attempts?: number
          delivery_id?: string
          event?: string
          id?: number
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      save_iagenda_data: { Args: { payload: Json }; Returns: undefined }
      wa_acquire_lease: { Args: { p_token: string }; Returns: boolean }
      wa_finalize_appointment: {
        Args: {
          p_appointment: Json
          p_message: string
          p_reply: string
          p_user: string
        }
        Returns: undefined
      }
      wa_redeem_code: {
        Args: { p_hash: string; p_phone: string }
        Returns: string
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
  public: {
    Enums: {},
  },
} as const
