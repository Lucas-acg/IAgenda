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
      habits: {
        Row: {
          date: string
          id: string
          kind: string
          name: string
          note: string
          time: string
          user_id: string
        }
        Insert: {
          date: string
          id: string
          kind: string
          name: string
          note?: string
          time: string
          user_id: string
        }
        Update: {
          date?: string
          id?: string
          kind?: string
          name?: string
          note?: string
          time?: string
          user_id?: string
        }
        Relationships: [
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
          animations: boolean
          calendarView: string
          compact: boolean
          largeText: boolean
          notifications: boolean
          palette: string
          showSummary: boolean
          user_id: string
          weekStartsMonday: boolean
        }
        Insert: {
          animations?: boolean
          calendarView?: string
          compact?: boolean
          largeText?: boolean
          notifications?: boolean
          palette?: string
          showSummary?: boolean
          user_id: string
          weekStartsMonday?: boolean
        }
        Update: {
          animations?: boolean
          calendarView?: string
          compact?: boolean
          largeText?: boolean
          notifications?: boolean
          palette?: string
          showSummary?: boolean
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      save_iagenda_data: { Args: { payload: Json }; Returns: undefined }
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
