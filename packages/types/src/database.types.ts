export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      application_incidents: {
        Row: {
          fingerprint: string
          first_seen_at: string
          id: string
          last_seen_at: string
          occurrences: number
          organization_id: string
          reporter_user_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          route: string
          source: string
        }
        Insert: {
          fingerprint: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          occurrences?: number
          organization_id: string
          reporter_user_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          route: string
          source: string
        }
        Update: {
          fingerprint?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          occurrences?: number
          organization_id?: string
          reporter_user_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_incidents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_type: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          organization_id: string
          quote_id: string | null
        }
        Insert: {
          action: string
          actor_type?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          organization_id: string
          quote_id?: string | null
        }
        Update: {
          action?: string
          actor_type?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          organization_id?: string
          quote_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_items: {
        Row: {
          active: boolean
          amount: number
          created_at: string
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount?: number
          created_at?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "labor_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_services: {
        Row: {
          active: boolean
          amount: number
          category: string | null
          created_at: string
          description: string
          id: string
          notes: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount?: number
          category?: string | null
          created_at?: string
          description: string
          id?: string
          notes?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          notes?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "labor_services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          revoked_at: string | null
          role: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          organization_id: string
          revoked_at?: string | null
          role: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          revoked_at?: string | null
          role?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          organization_id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          address_complement: string | null
          address_line: string | null
          address_number: string | null
          city: string | null
          created_at: string
          default_parts_margin_percent: number
          default_quote_notes: string | null
          district: string | null
          email: string | null
          legal_name: string | null
          organization_id: string
          phone: string | null
          postal_code: string | null
          quote_validity_days: number
          state: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address_complement?: string | null
          address_line?: string | null
          address_number?: string | null
          city?: string | null
          created_at?: string
          default_parts_margin_percent?: number
          default_quote_notes?: string | null
          district?: string | null
          email?: string | null
          legal_name?: string | null
          organization_id: string
          phone?: string | null
          postal_code?: string | null
          quote_validity_days?: number
          state?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address_complement?: string | null
          address_line?: string | null
          address_number?: string | null
          city?: string | null
          created_at?: string
          default_parts_margin_percent?: number
          default_quote_notes?: string | null
          district?: string | null
          email?: string | null
          legal_name?: string | null
          organization_id?: string
          phone?: string | null
          postal_code?: string | null
          quote_validity_days?: number
          state?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          cnpj: string | null
          created_at: string
          id: string
          name: string
          plan: string
          slug: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          id?: string
          name: string
          plan?: string
          slug: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          id?: string
          name?: string
          plan?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          order_id: string
          organization_id: string
          quantity: number
          quote_item_id: string
          received_at: string | null
          received_quantity: number
          side: string | null
          specification: string | null
          status: string
          total_amount: number
          unit: string
          unit_amount: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          id?: string
          order_id: string
          organization_id: string
          quantity: number
          quote_item_id: string
          received_at?: string | null
          received_quantity?: number
          side?: string | null
          specification?: string | null
          status?: string
          total_amount: number
          unit: string
          unit_amount: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          order_id?: string
          organization_id?: string
          quantity?: number
          quote_item_id?: string
          received_at?: string | null
          received_quantity?: number
          side?: string | null
          specification?: string | null
          status?: string
          total_amount?: number
          unit?: string
          unit_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_quote_item_id_fkey"
            columns: ["quote_item_id"]
            isOneToOne: false
            referencedRelation: "quote_items"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          code: string
          created_at: string
          id: string
          notes: string | null
          ordered_at: string | null
          organization_id: string
          quote_id: string
          received_at: string | null
          status: string
          supplier_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          code?: string
          created_at?: string
          id?: string
          notes?: string | null
          ordered_at?: string | null
          organization_id: string
          quote_id: string
          received_at?: string | null
          status?: string
          supplier_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          notes?: string | null
          ordered_at?: string | null
          organization_id?: string
          quote_id?: string
          received_at?: string | null
          status?: string
          supplier_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          category: string
          chosen_amount: number | null
          created_at: string
          description: string
          id: string
          notes: string | null
          organization_id: string
          purchase_status: string
          quantity: number
          quote_id: string
          sale_total_amount: number | null
          sale_unit_amount: number | null
          side: string | null
          specification: string | null
          supplier_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          category: string
          chosen_amount?: number | null
          created_at?: string
          description: string
          id?: string
          notes?: string | null
          organization_id: string
          purchase_status?: string
          quantity?: number
          quote_id: string
          sale_total_amount?: number | null
          sale_unit_amount?: number | null
          side?: string | null
          specification?: string | null
          supplier_id?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          chosen_amount?: number | null
          created_at?: string
          description?: string
          id?: string
          notes?: string | null
          organization_id?: string
          purchase_status?: string
          quantity?: number
          quote_id?: string
          sale_total_amount?: number | null
          sale_unit_amount?: number | null
          side?: string | null
          specification?: string | null
          supplier_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_public_links: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          last_viewed_at: string | null
          organization_id: string
          quote_id: string
          revoked_at: string | null
          token: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          last_viewed_at?: string | null
          organization_id: string
          quote_id: string
          revoked_at?: string | null
          token: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          last_viewed_at?: string | null
          organization_id?: string
          quote_id?: string
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_public_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_public_links_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_services: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          labor_amount: number | null
          labor_service_id: string | null
          needs_part: boolean
          organization_id: string
          quote_id: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          id?: string
          labor_amount?: number | null
          labor_service_id?: string | null
          needs_part?: boolean
          organization_id: string
          quote_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          labor_amount?: number | null
          labor_service_id?: string | null
          needs_part?: boolean
          organization_id?: string
          quote_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_services_labor_service_id_fkey"
            columns: ["labor_service_id"]
            isOneToOne: false
            referencedRelation: "labor_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_services_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_supplier_item_responses: {
        Row: {
          availability: string | null
          awarded: boolean
          brand_option: string | null
          created_at: string
          delivery: string | null
          id: string
          notes: string | null
          organization_id: string
          quote_item_id: string
          request_id: string
          total_price: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          availability?: string | null
          awarded?: boolean
          brand_option?: string | null
          created_at?: string
          delivery?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          quote_item_id: string
          request_id: string
          total_price: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          availability?: string | null
          awarded?: boolean
          brand_option?: string | null
          created_at?: string
          delivery?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          quote_item_id?: string
          request_id?: string
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_supplier_item_responses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_supplier_item_responses_quote_item_id_fkey"
            columns: ["quote_item_id"]
            isOneToOne: false
            referencedRelation: "quote_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_supplier_item_responses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "quote_supplier_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_supplier_request_items: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          quote_item_id: string
          request_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          quote_item_id: string
          request_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          quote_item_id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_supplier_request_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_supplier_request_items_quote_item_id_fkey"
            columns: ["quote_item_id"]
            isOneToOne: false
            referencedRelation: "quote_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_supplier_request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "quote_supplier_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_supplier_requests: {
        Row: {
          created_at: string
          id: string
          message: string
          opened_at: string | null
          organization_id: string
          quote_id: string
          responded_at: string | null
          response_amount: number | null
          response_delivery: string | null
          response_notes: string | null
          status: string
          supplier_id: string
          updated_at: string
          winner: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          opened_at?: string | null
          organization_id: string
          quote_id: string
          responded_at?: string | null
          response_amount?: number | null
          response_delivery?: string | null
          response_notes?: string | null
          status?: string
          supplier_id: string
          updated_at?: string
          winner?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          opened_at?: string | null
          organization_id?: string
          quote_id?: string
          responded_at?: string | null
          response_amount?: number | null
          response_delivery?: string | null
          response_notes?: string | null
          status?: string
          supplier_id?: string
          updated_at?: string
          winner?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "quote_supplier_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_supplier_requests_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_supplier_requests_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          commercial_approved_at: string | null
          commercial_rejected_at: string | null
          commercial_rejection_reason: string | null
          commercial_status: string
          created_at: string
          created_by: string | null
          customer_id: string
          discount_amount: number
          discount_type: string
          discount_value: number
          final_amount: number | null
          id: string
          labor_sale_amount: number
          mileage: number | null
          notes: string | null
          organization_id: string
          parts_cost_amount: number
          parts_sale_amount: number
          priority: string
          protocol: string
          status: string
          subtotal_amount: number
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          commercial_approved_at?: string | null
          commercial_rejected_at?: string | null
          commercial_rejection_reason?: string | null
          commercial_status?: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          discount_amount?: number
          discount_type?: string
          discount_value?: number
          final_amount?: number | null
          id?: string
          labor_sale_amount?: number
          mileage?: number | null
          notes?: string | null
          organization_id: string
          parts_cost_amount?: number
          parts_sale_amount?: number
          priority?: string
          protocol: string
          status?: string
          subtotal_amount?: number
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          commercial_approved_at?: string | null
          commercial_rejected_at?: string | null
          commercial_rejection_reason?: string | null
          commercial_status?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          discount_amount?: number
          discount_type?: string
          discount_value?: number
          final_amount?: number | null
          id?: string
          labor_sale_amount?: number
          mileage?: number | null
          notes?: string | null
          organization_id?: string
          parts_cost_amount?: number
          parts_sale_amount?: number
          priority?: string
          protocol?: string
          status?: string
          subtotal_amount?: number
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_categories: {
        Row: {
          active: boolean | null
          created_at: string
          id: string
          name: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_category_links: {
        Row: {
          category_id: string
          created_at: string
          organization_id: string
          supplier_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          organization_id: string
          supplier_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          organization_id?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_category_links_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "supplier_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_category_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_category_links_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          notes: string | null
          organization_id: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          brand: string | null
          created_at: string
          customer_id: string | null
          id: string
          mileage: number | null
          model: string
          model_year: number | null
          notes: string | null
          organization_id: string
          plate: string
          updated_at: string
          version: string | null
        }
        Insert: {
          brand?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          mileage?: number | null
          model: string
          model_year?: number | null
          notes?: string | null
          organization_id: string
          plate: string
          updated_at?: string
          version?: string | null
        }
        Update: {
          brand?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          mileage?: number | null
          model?: string
          model_year?: number | null
          notes?: string | null
          organization_id?: string
          plate?: string
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_services: {
        Row: {
          category: string | null
          completed_at: string | null
          created_at: string
          description: string
          id: string
          labor_amount: number
          labor_service_id: string | null
          needs_part: boolean
          notes: string | null
          organization_id: string
          quote_service_id: string | null
          started_at: string | null
          status: string
          updated_at: string
          work_order_id: string
        }
        Insert: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          description: string
          id?: string
          labor_amount?: number
          labor_service_id?: string | null
          needs_part?: boolean
          notes?: string | null
          organization_id: string
          quote_service_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          work_order_id: string
        }
        Update: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string
          id?: string
          labor_amount?: number
          labor_service_id?: string | null
          needs_part?: boolean
          notes?: string | null
          organization_id?: string
          quote_service_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_services_labor_service_id_fkey"
            columns: ["labor_service_id"]
            isOneToOne: false
            referencedRelation: "labor_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_services_quote_service_id_fkey"
            columns: ["quote_service_id"]
            isOneToOne: false
            referencedRelation: "quote_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_services_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          code: string
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          quote_id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          code?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          quote_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          quote_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_organization_invite: {
        Args: { target_token: string }
        Returns: Json
      }
      approve_quote_commercial: {
        Args: { target_org_id: string; target_quote_id: string }
        Returns: string
      }
      award_supplier_quote_item: {
        Args: {
          target_org_id: string
          target_quote_item_id: string
          target_request_id: string
        }
        Returns: number
      }
      complete_work_order_service: {
        Args: { target_org_id: string; target_work_order_service_id: string }
        Returns: string
      }
      create_additional_organization: {
        Args: {
          organization_city: string
          organization_cnpj: string
          organization_email: string
          organization_legal_name: string
          organization_name: string
          organization_phone: string
          organization_slug: string
          organization_state: string
          organization_whatsapp: string
        }
        Returns: Json
      }
      create_organization: {
        Args: {
          organization_cnpj?: string
          organization_name: string
          organization_slug: string
        }
        Returns: string
      }
      create_organization_invite: {
        Args: {
          target_email: string
          target_org_id: string
          target_role: string
        }
        Returns: Json
      }
      create_quote: {
        Args: {
          items?: Json
          services?: Json
          target_customer_id: string
          target_mileage?: number
          target_notes?: string
          target_org_id: string
          target_priority: string
          target_vehicle_id: string
        }
        Returns: {
          protocol: string
          quote_id: string
        }[]
      }
      create_quote_public_link: {
        Args: { target_org_id: string; target_quote_id: string }
        Returns: string
      }
      create_quote_v2: {
        Args: {
          items: Json
          services: Json
          target_customer_id: string
          target_mileage: number
          target_notes: string
          target_org_id: string
          target_priority: string
          target_vehicle_id: string
        }
        Returns: {
          protocol: string
          quote_id: string
        }[]
      }
      finalize_quote_supplier_awards: {
        Args: { target_org_id: string; target_quote_id: string }
        Returns: number
      }
      get_organization_commercial_defaults: {
        Args: { target_org_id: string }
        Returns: Json
      }
      get_organization_document_profile: {
        Args: { target_org_id: string }
        Returns: Json
      }
      get_owned_application_incidents: {
        Args: {
          filter_organization_id?: string
          filter_query?: string
          filter_status?: string
          result_limit?: number
          result_offset?: number
        }
        Returns: {
          fingerprint: string
          first_seen_at: string
          incident_id: string
          last_seen_at: string
          occurrences: number
          organization_id: string
          organization_name: string
          reporter_user_id: string
          resolution_note: string
          resolved_at: string
          resolved_by: string
          route: string
          source: string
          total_count: number
        }[]
      }
      get_owned_network_activity: {
        Args: {
          filter_category?: string
          filter_organization_id?: string
          filter_period_end?: string
          filter_period_start?: string
          filter_query?: string
          result_limit?: number
          result_offset?: number
        }
        Returns: {
          action: string
          actor_type: string
          actor_user_id: string
          category: string
          client_count: number
          created_at: string
          customer_name: string
          entity_id: string
          entity_type: string
          event_id: string
          governance_count: number
          metadata: Json
          organization_id: string
          organization_name: string
          organizations_with_activity: number
          quote_id: string
          quote_protocol: string
          total_count: number
          vehicle_plate: string
        }[]
      }
      get_owned_organization_overview: {
        Args: { report_month?: string }
        Returns: {
          active_members: number
          active_work_orders: number
          approved_amount_month: number
          approved_quotes_month: number
          customers_total: number
          last_quote_at: string
          open_purchase_orders: number
          organization_id: string
          organization_name: string
          organization_slug: string
          quotes_month: number
          rejected_quotes_month: number
          vehicles_total: number
          waiting_quotes_month: number
        }[]
      }
      has_org_role: {
        Args: { allowed_roles: string[]; target_org_id: string }
        Returns: boolean
      }
      is_org_member: { Args: { target_org_id: string }; Returns: boolean }
      list_organization_invites: {
        Args: { target_org_id: string }
        Returns: {
          created_at: string
          email: string
          expires_at: string
          invite_id: string
          role: string
        }[]
      }
      list_organization_team: {
        Args: { target_org_id: string }
        Returns: {
          email: string
          full_name: string
          joined_at: string
          phone: string
          role: string
          status: string
          user_id: string
        }[]
      }
      mark_purchase_order_ordered: {
        Args: { target_order_id: string; target_org_id: string }
        Returns: string
      }
      orbiq_assert_permission: {
        Args: { target_org_id: string; target_permission: string }
        Returns: undefined
      }
      orbiq_current_org_role: {
        Args: { target_org_id: string }
        Returns: string
      }
      orbiq_has_any_permission: {
        Args: { target_org_id: string; target_permissions: string[] }
        Returns: boolean
      }
      orbiq_has_permission: {
        Args: { target_org_id: string; target_permission: string }
        Returns: boolean
      }
      orbiq_list_my_permissions: {
        Args: { target_org_id: string }
        Returns: string[]
      }
      orbiq_permissions_for_role: {
        Args: { target_role: string }
        Returns: string[]
      }
      orbiq_sync_awarded_supplier_items: {
        Args: { target_org_id: string; target_quote_id: string }
        Returns: number
      }
      orbiq_write_audit_log: {
        Args: {
          target_action: string
          target_actor_type: string
          target_actor_user_id: string
          target_entity_id: string
          target_entity_type: string
          target_metadata: Json
          target_org_id: string
          target_quote_id: string
        }
        Returns: undefined
      }
      prepare_quote_supplier_requests: {
        Args: {
          target_org_id: string
          target_quote_id: string
          target_requests: Json
        }
        Returns: number
      }
      public_decide_quote: {
        Args: {
          target_decision: string
          target_reason: string
          target_token: string
        }
        Returns: Json
      }
      public_get_organization_invite: {
        Args: { target_token: string }
        Returns: Json
      }
      public_get_quote: { Args: { target_token: string }; Returns: Json }
      public_get_workshop_profile: {
        Args: { target_token: string }
        Returns: Json
      }
      receive_purchase_order_all: {
        Args: { target_order_id: string; target_org_id: string }
        Returns: number
      }
      receive_purchase_order_item: {
        Args: { target_order_item_id: string; target_org_id: string }
        Returns: string
      }
      refresh_quote_material_status: {
        Args: { target_org_id: string; target_quote_id: string }
        Returns: boolean
      }
      reject_quote_commercial: {
        Args: {
          target_org_id: string
          target_quote_id: string
          target_reason: string
        }
        Returns: undefined
      }
      reopen_quote_commercial: {
        Args: { target_org_id: string; target_quote_id: string }
        Returns: undefined
      }
      report_application_incident: {
        Args: {
          target_fingerprint: string
          target_org_id: string
          target_route: string
          target_source: string
        }
        Returns: {
          incident_id: string
          occurrence_count: number
        }[]
      }
      resolve_application_incident: {
        Args: { target_incident_id: string; target_resolution_note: string }
        Returns: boolean
      }
      revoke_organization_invite: {
        Args: { target_invite_id: string; target_org_id: string }
        Returns: undefined
      }
      revoke_quote_public_link: {
        Args: { target_org_id: string; target_quote_id: string }
        Returns: undefined
      }
      save_labor_service: {
        Args: {
          target_amount: number
          target_category: string
          target_description: string
          target_notes: string
          target_org_id: string
          target_service_id: string
        }
        Returns: string
      }
      save_quote_commercial: {
        Args: {
          target_discount_type: string
          target_discount_value: number
          target_items: Json
          target_org_id: string
          target_quote_id: string
        }
        Returns: {
          discount_amount: number
          final_amount: number
          labor_sale_amount: number
          parts_cost_amount: number
          parts_sale_amount: number
          subtotal_amount: number
        }[]
      }
      save_supplier: {
        Args: {
          target_category_ids: string[]
          target_name: string
          target_notes: string
          target_org_id: string
          target_supplier_id: string
          target_whatsapp: string
        }
        Returns: string
      }
      save_supplier_response: {
        Args: {
          target_delivery: string
          target_items: Json
          target_notes: string
          target_org_id: string
          target_request_id: string
        }
        Returns: number
      }
      set_labor_service_active: {
        Args: {
          target_active: boolean
          target_org_id: string
          target_service_id: string
        }
        Returns: undefined
      }
      set_organization_member_status: {
        Args: {
          target_org_id: string
          target_status: string
          target_user_id: string
        }
        Returns: undefined
      }
      set_supplier_active: {
        Args: {
          target_active: boolean
          target_org_id: string
          target_supplier_id: string
        }
        Returns: undefined
      }
      set_work_order_service_labor: {
        Args: {
          target_labor_service_id: string
          target_org_id: string
          target_work_order_service_id: string
        }
        Returns: number
      }
      start_work_order_service: {
        Args: { target_org_id: string; target_work_order_service_id: string }
        Returns: string
      }
      sync_quote_purchase_orders: {
        Args: { target_org_id: string; target_quote_id: string }
        Returns: number
      }
      sync_quote_work_order: {
        Args: { target_org_id: string; target_quote_id: string }
        Returns: string
      }
      update_organization_member_role: {
        Args: {
          target_org_id: string
          target_role: string
          target_user_id: string
        }
        Returns: undefined
      }
      update_organization_settings: {
        Args: {
          target_address_complement: string
          target_address_line: string
          target_address_number: string
          target_city: string
          target_cnpj: string
          target_default_parts_margin_percent: number
          target_default_quote_notes: string
          target_district: string
          target_email: string
          target_legal_name: string
          target_name: string
          target_org_id: string
          target_phone: string
          target_postal_code: string
          target_quote_validity_days: number
          target_state: string
          target_whatsapp: string
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

