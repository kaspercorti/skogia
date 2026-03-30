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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      bank_accounts: {
        Row: {
          account_name: string | null
          account_number_masked: string | null
          bank_name: string
          created_at: string
          current_balance: number
          id: string
          is_connected: boolean
          last_synced_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name?: string | null
          account_number_masked?: string | null
          bank_name: string
          created_at?: string
          current_balance?: number
          id?: string
          is_connected?: boolean
          last_synced_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string | null
          account_number_masked?: string | null
          bank_name?: string
          created_at?: string
          current_balance?: number
          id?: string
          is_connected?: boolean
          last_synced_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bank_transactions: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string
          date: string
          description: string | null
          direction: string
          id: string
          match_reason: string | null
          match_status: string
          matched_invoice_id: string | null
          matched_transaction_id: string | null
          reference: string | null
          transaction_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          direction?: string
          id?: string
          match_reason?: string | null
          match_status?: string
          matched_invoice_id?: string | null
          matched_transaction_id?: string | null
          reference?: string | null
          transaction_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          direction?: string
          id?: string
          match_reason?: string | null
          match_status?: string
          matched_invoice_id?: string | null
          matched_transaction_id?: string | null
          reference?: string | null
          transaction_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_matched_invoice_id_fkey"
            columns: ["matched_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_matched_transaction_id_fkey"
            columns: ["matched_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          organization_number: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          organization_number?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          organization_number?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      forest_activities: {
        Row: {
          created_at: string
          estimated_cost: number
          estimated_income: number
          estimated_net: number
          id: string
          notes: string | null
          planned_date: string | null
          property_id: string
          stand_id: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          estimated_cost?: number
          estimated_income?: number
          estimated_net?: number
          id?: string
          notes?: string | null
          planned_date?: string | null
          property_id: string
          stand_id?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          estimated_cost?: number
          estimated_income?: number
          estimated_net?: number
          id?: string
          notes?: string | null
          planned_date?: string | null
          property_id?: string
          stand_id?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forest_activities_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forest_activities_stand_id_fkey"
            columns: ["stand_id"]
            isOneToOne: false
            referencedRelation: "stands"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          created_at: string
          id: string
          last_synced_at: string | null
          provider: string
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_synced_at?: string | null
          provider: string
          status?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_synced_at?: string | null
          provider?: string
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_ex_vat: number
          amount_inc_vat: number
          category: string | null
          created_at: string
          customer_id: string | null
          description: string | null
          due_date: string
          id: string
          invoice_date: string
          invoice_number: string
          linked_activity_id: string | null
          payment_date: string | null
          property_id: string | null
          sent_at: string | null
          sent_to_email: string | null
          status: string
          updated_at: string
          user_id: string
          vat_amount: number
        }
        Insert: {
          amount_ex_vat?: number
          amount_inc_vat?: number
          category?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          due_date: string
          id?: string
          invoice_date?: string
          invoice_number: string
          linked_activity_id?: string | null
          payment_date?: string | null
          property_id?: string | null
          sent_at?: string | null
          sent_to_email?: string | null
          status?: string
          updated_at?: string
          user_id: string
          vat_amount?: number
        }
        Update: {
          amount_ex_vat?: number
          amount_inc_vat?: number
          category?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          due_date?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          linked_activity_id?: string | null
          payment_date?: string | null
          property_id?: string | null
          sent_at?: string | null
          sent_to_email?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_linked_activity_id_fkey"
            columns: ["linked_activity_id"]
            isOneToOne: false
            referencedRelation: "forest_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          created_at: string
          id: string
          municipality: string | null
          name: string
          productive_forest_ha: number
          total_area_ha: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          municipality?: string | null
          name: string
          productive_forest_ha?: number
          total_area_ha?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          municipality?: string | null
          name?: string
          productive_forest_ha?: number
          total_area_ha?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      receipts: {
        Row: {
          amount_ex_vat: number | null
          approved_at: string | null
          approved_by: string | null
          confidence_score: number | null
          created_at: string
          forest_activity_id: string | null
          id: string
          image_url: string | null
          linked_transaction_id: string | null
          notes: string | null
          property_id: string | null
          receipt_date: string | null
          stand_id: string | null
          status: string
          suggested_account: string | null
          suggested_category: string | null
          supplier_name: string | null
          total_amount: number | null
          updated_at: string
          uploaded_at: string
          user_id: string
          vat_amount: number | null
        }
        Insert: {
          amount_ex_vat?: number | null
          approved_at?: string | null
          approved_by?: string | null
          confidence_score?: number | null
          created_at?: string
          forest_activity_id?: string | null
          id?: string
          image_url?: string | null
          linked_transaction_id?: string | null
          notes?: string | null
          property_id?: string | null
          receipt_date?: string | null
          stand_id?: string | null
          status?: string
          suggested_account?: string | null
          suggested_category?: string | null
          supplier_name?: string | null
          total_amount?: number | null
          updated_at?: string
          uploaded_at?: string
          user_id: string
          vat_amount?: number | null
        }
        Update: {
          amount_ex_vat?: number | null
          approved_at?: string | null
          approved_by?: string | null
          confidence_score?: number | null
          created_at?: string
          forest_activity_id?: string | null
          id?: string
          image_url?: string | null
          linked_transaction_id?: string | null
          notes?: string | null
          property_id?: string | null
          receipt_date?: string | null
          stand_id?: string | null
          status?: string
          suggested_account?: string | null
          suggested_category?: string | null
          supplier_name?: string | null
          total_amount?: number | null
          updated_at?: string
          uploaded_at?: string
          user_id?: string
          vat_amount?: number | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          data: Json | null
          generated_at: string
          id: string
          status: string
          type: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          data?: Json | null
          generated_at?: string
          id?: string
          status?: string
          type: string
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          data?: Json | null
          generated_at?: string
          id?: string
          status?: string
          type?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      stands: {
        Row: {
          age: number | null
          area_ha: number
          created_at: string
          estimated_value: number | null
          growth_rate_percent: number | null
          id: string
          name: string
          notes: string | null
          planned_action: string | null
          planned_year: number | null
          property_id: string
          site_index: string | null
          tree_species: string | null
          updated_at: string
          volume_m3sk: number | null
        }
        Insert: {
          age?: number | null
          area_ha?: number
          created_at?: string
          estimated_value?: number | null
          growth_rate_percent?: number | null
          id?: string
          name: string
          notes?: string | null
          planned_action?: string | null
          planned_year?: number | null
          property_id: string
          site_index?: string | null
          tree_species?: string | null
          updated_at?: string
          volume_m3sk?: number | null
        }
        Update: {
          age?: number | null
          area_ha?: number
          created_at?: string
          estimated_value?: number | null
          growth_rate_percent?: number | null
          id?: string
          name?: string
          notes?: string | null
          planned_action?: string | null
          planned_year?: number | null
          property_id?: string
          site_index?: string | null
          tree_species?: string | null
          updated_at?: string
          volume_m3sk?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stands_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_accounts: {
        Row: {
          created_at: string
          current_balance: number
          estimated_tax_to_pay: number
          id: string
          is_connected: boolean
          last_synced_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_balance?: number
          estimated_tax_to_pay?: number
          id?: string
          is_connected?: boolean
          last_synced_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_balance?: number
          estimated_tax_to_pay?: number
          id?: string
          is_connected?: boolean
          last_synced_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tax_scenarios: {
        Row: {
          created_at: string
          estimated_expenses: number
          estimated_income: number
          estimated_profit: number
          estimated_tax: number
          id: string
          notes: string | null
          scenario_name: string
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          estimated_expenses?: number
          estimated_income?: number
          estimated_profit?: number
          estimated_tax?: number
          id?: string
          notes?: string | null
          scenario_name?: string
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          estimated_expenses?: number
          estimated_income?: number
          estimated_profit?: number
          estimated_tax?: number
          id?: string
          notes?: string | null
          scenario_name?: string
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          bank_transaction_id: string | null
          category: string | null
          created_at: string
          date: string
          description: string | null
          id: string
          invoice_id: string | null
          payment_method: string | null
          property_id: string | null
          stand_id: string | null
          status: string
          type: string
          updated_at: string
          user_id: string
          vat_amount: number
        }
        Insert: {
          amount?: number
          bank_transaction_id?: string | null
          category?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          invoice_id?: string | null
          payment_method?: string | null
          property_id?: string | null
          stand_id?: string | null
          status?: string
          type: string
          updated_at?: string
          user_id: string
          vat_amount?: number
        }
        Update: {
          amount?: number
          bank_transaction_id?: string | null
          category?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          invoice_id?: string | null
          payment_method?: string | null
          property_id?: string | null
          stand_id?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_stand_id_fkey"
            columns: ["stand_id"]
            isOneToOne: false
            referencedRelation: "stands"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          company_name: string | null
          created_at: string
          default_email_message: string | null
          email_signature: string | null
          id: string
          reply_to_email: string | null
          sender_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          default_email_message?: string | null
          email_signature?: string | null
          id?: string
          reply_to_email?: string | null
          sender_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          default_email_message?: string | null
          email_signature?: string | null
          id?: string
          reply_to_email?: string | null
          sender_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      seed_demo_data: { Args: { p_user_id: string }; Returns: undefined }
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
