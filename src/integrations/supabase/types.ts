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
      import_batches: {
        Row: {
          created_at: string
          created_by: string
          file_name: string
          id: string
          kind: string
          market_id: string
          published: number
          published_at: string | null
          status: string
          total: number
        }
        Insert: {
          created_at?: string
          created_by?: string
          file_name?: string
          id?: string
          kind: string
          market_id: string
          published?: number
          published_at?: string | null
          status?: string
          total?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          file_name?: string
          id?: string
          kind?: string
          market_id?: string
          published?: number
          published_at?: string | null
          status?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      import_rows: {
        Row: {
          action: string
          barcode: string
          batch_id: string
          brand: string
          category: string
          errors: string[]
          id: string
          name: string
          offer_price: number | null
          price: number | null
          product_id: string | null
          row_no: number
          size: number | null
          unit: string
          valid_until: string | null
          warnings: string[]
        }
        Insert: {
          action?: string
          barcode?: string
          batch_id: string
          brand?: string
          category?: string
          errors?: string[]
          id?: string
          name?: string
          offer_price?: number | null
          price?: number | null
          product_id?: string | null
          row_no: number
          size?: number | null
          unit?: string
          valid_until?: string | null
          warnings?: string[]
        }
        Update: {
          action?: string
          barcode?: string
          batch_id?: string
          brand?: string
          category?: string
          errors?: string[]
          id?: string
          name?: string
          offer_price?: number | null
          price?: number | null
          product_id?: string | null
          row_no?: number
          size?: number | null
          unit?: string
          valid_until?: string | null
          warnings?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      market_members: {
        Row: {
          market_id: string
          user_id: string
        }
        Insert: {
          market_id: string
          user_id: string
        }
        Update: {
          market_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_members_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      markets: {
        Row: {
          address: string
          created_at: string
          id: string
          is_demo: boolean
          name: string
          neighborhood: string
        }
        Insert: {
          address?: string
          created_at?: string
          id: string
          is_demo?: boolean
          name: string
          neighborhood?: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          is_demo?: boolean
          name?: string
          neighborhood?: string
        }
        Relationships: []
      }
      offers: {
        Row: {
          id: string
          market_id: string
          price: number
          product_id: string
          valid_until: string
        }
        Insert: {
          id: string
          market_id: string
          price: number
          product_id: string
          valid_until: string
        }
        Update: {
          id?: string
          market_id?: string
          price?: number
          product_id?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: number
          market_id: string
          new_price: number
          old_price: number | null
          product_id: string
          source: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: number
          market_id: string
          new_price: number
          old_price?: number | null
          product_id: string
          source?: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: number
          market_id?: string
          new_price?: number
          old_price?: number | null
          product_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_history_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      prices: {
        Row: {
          market_id: string
          price: number
          product_id: string
          recorded_at: string
          source: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          market_id: string
          price: number
          product_id: string
          recorded_at?: string
          source?: string
          updated_at: string
          updated_by?: string | null
        }
        Update: {
          market_id?: string
          price?: number
          product_id?: string
          recorded_at?: string
          source?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prices_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          brand: string
          category: string
          created_at: string
          emoji: string
          group_key: string
          id: string
          image_path: string | null
          is_demo: boolean
          name: string
          size: number
          status: string
          unit: string
        }
        Insert: {
          barcode?: string | null
          brand?: string
          category: string
          created_at?: string
          emoji?: string
          group_key: string
          id: string
          image_path?: string | null
          is_demo?: boolean
          name: string
          size: number
          status?: string
          unit: string
        }
        Update: {
          barcode?: string | null
          brand?: string
          category?: string
          created_at?: string
          emoji?: string
          group_key?: string
          id?: string
          image_path?: string | null
          is_demo?: boolean
          name?: string
          size?: number
          status?: string
          unit?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      shopping_list_items: {
        Row: {
          bought: boolean
          product_id: string
          qty: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bought?: boolean
          product_id: string
          qty?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          bought?: boolean
          product_id?: string
          qty?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_product: { Args: { _product_id: string }; Returns: boolean }
      can_manage_market: { Args: { _market_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_catalog_editor: { Args: never; Returns: boolean }
      is_market_member: {
        Args: { _market_id: string; _user_id: string }
        Returns: boolean
      }
      publish_import_batch: { Args: { p_batch_id: string }; Returns: number }
      save_market_item: {
        Args: {
          p_market_id: string
          p_offer_id: string
          p_offer_price: number
          p_price: number
          p_product: Json
          p_updated_at: string
          p_valid_until: string
        }
        Returns: undefined
      }
      save_market_item_v2: {
        Args: {
          p_market_id: string
          p_offer_id: string
          p_offer_price: number
          p_price: number
          p_product: Json
          p_source: string
          p_updated_at: string
          p_valid_until: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "market" | "customer"
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
    Enums: {
      app_role: ["admin", "market", "customer"],
    },
  },
} as const
